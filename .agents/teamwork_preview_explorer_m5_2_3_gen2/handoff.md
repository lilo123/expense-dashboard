# Handoff Report: M5.2 Tier 2 E2E Test Pass Investigation & Fix Strategy

## 1. Observation
- **`e2e/run_e2e.ts` (`--ignore-health-check`)**: Observed 5 instances where `npx supabase start` is invoked with the `--ignore-health-check` flag:
  - Line 65: `execSync('npx supabase start --debug --ignore-health-check', { stdio: 'inherit' });`
  - Line 178: `try { execSync('npx supabase start --debug --ignore-health-check', { stdio: 'inherit' }); } catch(e){}`
  - Line 235: `try { execSync('npx supabase start --debug --ignore-health-check', { stdio: 'inherit' }); } catch(err){}`
  - Line 253: `try { execSync('npx supabase start --debug --ignore-health-check', { stdio: 'inherit' }); } catch(err){}`
  - Line 285: `try { execSync('npx supabase start --debug --ignore-health-check', { stdio: 'inherit' }); } catch(e){}`
- **`e2e/run_e2e.ts` (`sleep 5`)**: Observed 2 instances in `setup()` where the teardown buffer was reduced from `sleep 20` to `sleep 5`:
  - Line 47: `try { execSync('sleep 5', { stdio: 'inherit' }); } catch(e){}`
  - Line 63: `try { execSync('sleep 5', { stdio: 'inherit' }); } catch(e){}`
- **`PROJECT.md` Contract**: Observed the explicit interface contract for `e2e/run_e2e.ts <-> Supabase & Next.js` (lines 17-23), which mandates a "Standardized bulletproof teardown sequence across all 9 locations (`npx supabase stop`, `pkill -9 -f supabase`, `pkill -9 -f supabase-go`, `pkill -9 -f npx supabase`, `docker rm -f`, `docker volume rm -f`, `while docker ps -aq`, `fuser -k 25432/tcp`, `rm -rf supabase/.temp`, `sleep 20`) ensuring `pkill` executes after `docker rm -f` to prevent `supabase-go` daemon corruption."
- **Forensic Auditor Gen 1 Report**: Observed the finding that `--ignore-health-check` causes Supabase CLI to start `realtime` before `db` is fully registered in Docker DNS, resulting in a fatal Elixir boot crash (`Failed to detect IP version for DB_HOST: nxdomain`) and aborting the test runner with exit code 1.
- **Reviewer 1 Gen 1 Report**: Observed the finding that reducing `sleep 20` to `sleep 5` causes subsequent invocations of `npx supabase start` to collide with ongoing asynchronous container/volume pruning in the Docker daemon, triggering fatal errors (`removal of container ... is already in progress` and `a prune operation is already running`).

## 2. Logic Chain
1. **Supabase Realtime Crash**: By including `--ignore-health-check` in `npx supabase start`, Supabase CLI does not wait for the database container (`supabase_db_expense-dashboard`) to become healthy and register in Docker DNS (`127.0.0.11`). When Supabase Realtime boots up, its Elixir runtime attempts to resolve `DB_HOST`, receives `nxdomain`, and crashes immediately. This causes `npx supabase start` to fail.
2. **Docker Daemon Race Condition**: When `npx supabase start` fails, `e2e/run_e2e.ts` initiates a teardown and retry loop. Because `setup()` uses `sleep 5` instead of `sleep 20` at lines 47 and 63, the Docker daemon does not have sufficient time to finish removing containers and pruning volumes before the next `npx supabase start` is called. This race condition locks the Docker daemon, producing `a prune operation is already running` errors.
3. **E2E Test Abortion**: The combination of `nxdomain` crashes and Docker daemon lock errors causes all 3 Supabase start attempts to fail. `e2e/run_e2e.ts` aborts with exit code 1 before building the Next.js bundle or executing the Playwright test suite.
4. **Remediation Strategy for Worker Gen 2**: To achieve a genuine E2E test pass and comply with `PROJECT.md`, Worker Gen 2 must surgically modify `e2e/run_e2e.ts` to:
   - Remove `--ignore-health-check` from all 5 `npx supabase start` calls (lines 65, 178, 235, 253, 285).
   - Restore `sleep 20` in the teardown sequences in `setup()` (lines 47 and 63).

## 3. Caveats
- As an Explorer, I am strictly bound by the `Read-only investigation — do NOT implement` constraint. Therefore, I have not modified `e2e/run_e2e.ts` myself. Worker Gen 2 must perform these exact code modifications.

## 4. Conclusion
- **Verdict**: Complete fix strategy established for Worker Gen 2.
- **Action Required by Worker Gen 2**:
  1. **Remove `--ignore-health-check`**: Modify `e2e/run_e2e.ts` at lines 65, 178, 235, 253, and 285 to replace `npx supabase start --debug --ignore-health-check` with `npx supabase start --debug`.
  2. **Restore `sleep 20`**: Modify `e2e/run_e2e.ts` at lines 47 and 63 to replace `try { execSync('sleep 5', { stdio: 'inherit' }); } catch(e){}` with `try { execSync('sleep 20', { stdio: 'inherit' }); } catch(e){}`.

## 5. Verification Method
To independently verify the fix once Worker Gen 2 completes the implementation, execute the master E2E test runner from the project root `/usr/local/google/home/duynguyenn/expense-dashboard`:
```bash
export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/verify_global_market_data.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts && npx tsx e2e/stress_test_m4.ts && npx tsx e2e/stress_test_m4_edge_cases.ts && npx tsx e2e/adv_planner_gaps.ts && npx tsx e2e/run_e2e.ts
```
- **Expected Result**: Supabase starts successfully on the first attempt without `nxdomain` or `a prune operation is already running` errors. The Next.js production bundle builds successfully, and all 55 Playwright E2E tests execute and pass with exit code 0.
- **Files to Inspect**: `e2e/run_e2e.ts` (specifically lines 47, 63, 65, 178, 235, 253, 285).
