# Handoff Report: Milestone 5.3 E2E Test Runner & Supabase Teardown Investigation

## 1. Observation
- **Documentation & Scope**: Reviewed `PROJECT.md`, `SCOPE.md`, `TEST_READY.md`, and `ORIGINAL_REQUEST.md`. `SCOPE.md` mandates a standardized bulletproof teardown sequence across all locations (`npx supabase stop`, `pkill -9 -f supabase`, `pkill -9 -f supabase-go`, `pkill -9 -f npx supabase`, `docker rm -f`, `docker volume rm -f`, `while docker ps -aq`, `fuser -k 25432/tcp`, `rm -rf supabase/.temp`, `sleep 20`) ensuring `pkill` executes after `docker rm -f` to prevent `supabase-go` daemon corruption.
- **Empirical Failures & Audit Reports**:
  - The Forensic Auditor, Challenger 3, and Challenger 4 independently executed the master E2E test runner command (`export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/verify_global_market_data.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts && npx tsx e2e/verify_tier3_combinations.ts && npx tsx e2e/stress_test_m4.ts && npx tsx e2e/stress_test_m4_edge_cases.ts && npx tsx e2e/adv_planner_gaps.ts && exec npx tsx e2e/run_e2e.ts`). While standalone verification scripts passed, `exec npx tsx e2e/run_e2e.ts` failed with exit code 1.
  - `e2e/adv_supabase_teardown_race.ts` failed with exit code 1 due to a fatal Docker race condition (`removal of container ... is already in progress`).
  - During `Initialising schema...`, `supabase-go` encountered a Docker container removal race condition (`Failed to remove container: ... Error response from daemon: removal of container ... is already in progress`) and crashed with `{"_tag":"Error","error":{"code":"PlatformError","message":"Unknown: ChildProcess.exitCode (/usr/local/google/home/duynguyenn/.npm/_npx/aa8e5c70f9d8d161/node_modules/@supabase/cli-linux-x64/bin/supabase-go --output json --debug start --ignore-health-check)"}}`.
  - Subsequent start attempts failed with `supabase start is already running.` while underlying containers were actually stopped (`Stopped services: [supabase_kong_expense-dashboard ...]`), leading to `Supabase started but http://127.0.0.1:54321 is unreachable.` and `Error response from daemon: Conflict. The container name "/supabase_db_expense-dashboard" is already in use`.
- **Codebase Inspection (`e2e/run_e2e.ts` & `e2e/adv_supabase_teardown_race.ts`)**:
  - **Teardown Sequence**: In `e2e/run_e2e.ts` (lines 14-34) and `e2e/adv_supabase_teardown_race.ts` (lines 10-27), `teardownSupabase()` executes `npx supabase stop --no-backup` and immediately follows it with `docker ps -aq | xargs -r docker rm -f`. There is no buffer sleep between `npx supabase stop` and `docker rm -f`.
  - **Missing Daemon pkill**: Worker 2 removed `pkill -9 -f "supabase"` to avoid killing the test runner script (`adv_supabase_teardown_race.ts`). In `e2e/run_e2e.ts` (lines 26-27) and `e2e/adv_supabase_teardown_race.ts` (lines 20-21), only `pkill -9 -f "supabase-go"` and `pkill -9 -f "npx supabase"` exist. The actual Supabase CLI binary daemon (`node_modules/@supabase/cli/bin/supabase` / `node_modules/@supabase/cli-linux-x64/bin/supabase`) is never killed.
  - **Flawed Inner Retry Loop**: In `e2e/run_e2e.ts`, `setup()` (lines 66-79) and `robustSupabaseRestart()` (lines 149-162) implement an inner retry loop (`Supabase start inner attempt ${j + 1}/3 (without teardown)...`) that does NOT call `teardownSupabase()` between attempts. When `npx supabase start` fails on attempt 1, it leaves behind `supabase.lock` and lockfiles in `$HOME/.supabase`. The `catch (innerErr)` block merely executes `docker start ...`, sets `startSuccess = true`, and breaks, falsely reporting success while leaving the database unreachable.

## 2. Logic Chain
1. **Docker Removal Race Condition**: `npx supabase stop --no-backup` spawns background processes (`supabase-go` / `bin/supabase`) to gracefully stop and remove Supabase Docker containers. Because `teardownSupabase()` immediately executes `docker ps -aq | xargs -r docker rm -f` without waiting, both the Supabase CLI daemon and the `docker rm -f` command attempt to remove the same containers simultaneously. This triggers the fatal Docker daemon error `removal of container ... is already in progress`.
2. **Surviving Supabase CLI Daemon**: By removing `pkill -9 -f "supabase"`, Worker 2 left the background Supabase CLI binary (`bin/supabase`) running across teardowns. When `npx supabase start` is subsequently invoked, this surviving daemon detects its own presence or residual state, falsely concludes `supabase start is already running.`, and skips creating the Docker containers. This leaves `http://127.0.0.1:54321` unreachable and causes container name conflicts (`The container name "/supabase_db_expense-dashboard" is already in use`).
3. **Lockfile Persistence & False Success in Inner Retries**: Because `setup()` and `robustSupabaseRestart()` do not call `teardownSupabase()` within their inner retry loops, an initial `npx supabase start` failure leaves behind `supabase.lock` and `$HOME/.supabase` lockfiles. When the `catch` block catches the error, it attempts `docker start`, assumes success (`startSuccess = true`), and exits the loop. The subsequent health check fails because the containers were never properly initialized, exhausting all outer retries and failing the E2E suite with exit code 1.
4. **Fix Strategy Formulation**: To resolve these integrity violations and restore compliance with `SCOPE.md`, the fix must:
   - Insert `sleep 5` after `npx supabase stop` in `teardownSupabase()` to allow graceful shutdown before `docker rm -f`.
   - Restore `pkill -9 -f "bin/supabase"` in `teardownSupabase()` to ensure the Supabase CLI binary daemon is terminated without killing the `adv_supabase_teardown_race.ts` test runner.
   - Update the inner retry loops in `setup()` and `robustSupabaseRestart()` to explicitly call `teardownSupabase()` before retrying `npx supabase start`, ensuring `supabase.lock` and residual containers are fully cleared.

## 3. Caveats
- No caveats. All findings are empirically backed by the Forensic Auditor, Reviewer 4, Challenger 3, and Challenger 4 reports, and verified through direct inspection of `e2e/run_e2e.ts` and `e2e/adv_supabase_teardown_race.ts`.

## 4. Conclusion
The Milestone 5.3 E2E test runner (`e2e/run_e2e.ts`) and adversarial test (`e2e/adv_supabase_teardown_race.ts`) fail with exit code 1 due to a Docker removal race condition, a surviving Supabase CLI daemon (`bin/supabase`), and lockfile persistence in the inner retry loops. 

### Recommended Concrete Fix Strategy (To be implemented by Worker agent):
1. **Modify `teardownSupabase()` in `e2e/run_e2e.ts` (lines 14-34) and `e2e/adv_supabase_teardown_race.ts` (lines 10-27)**:
   - Add `try { execSync('sleep 5', { stdio: 'inherit' }); } catch(e){}` immediately after `npx supabase stop --no-backup` to eliminate the `docker rm -f` race condition.
   - Add `try { execSync('pkill -9 -f "bin/supabase" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}` under the targeted pkill section to terminate the surviving Supabase CLI daemon.
2. **Modify `setup()` in `e2e/run_e2e.ts` (lines 66-79)**:
   - Remove the flawed `docker start` fallback in `catch (innerErr)`.
   - Update the inner loop to perform `teardownSupabase()` before retrying `npx supabase start`, ensuring `supabase.lock` and `$HOME/.supabase` are cleaned up between inner attempts.
3. **Modify `robustSupabaseRestart()` in `e2e/run_e2e.ts` (lines 149-162)**:
   - Align the inner retry loop with `setup()`, ensuring `teardownSupabase()` is called before each `npx supabase start` retry.

## 5. Verification Method
To independently verify the effectiveness of the proposed fixes once implemented, execute the master E2E test runner command defined in `TEST_READY.md`:

```bash
export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/verify_global_market_data.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts && npx tsx e2e/verify_tier3_combinations.ts && npx tsx e2e/stress_test_m4.ts && npx tsx e2e/stress_test_m4_edge_cases.ts && npx tsx e2e/adv_planner_gaps.ts && exec npx tsx e2e/run_e2e.ts
```

**Expected Result**: All standalone verification scripts and `exec npx tsx e2e/run_e2e.ts` will execute successfully and pass with exit code 0. `e2e/adv_supabase_teardown_race.ts` will also execute cleanly without Docker race conditions or container conflicts.
