# Handoff Report: M5.2 Tier 2 E2E Test Pass Investigation & Fix Strategy (Iteration 3)

## 1. Observation
- **`e2e/run_e2e.ts` (`--ignore-health-check` occurrences)**: Observed 5 instances where `npx supabase start` is invoked with the `--ignore-health-check` flag:
  - Line 65: `execSync('npx supabase start --debug --ignore-health-check', { stdio: 'inherit' });`
  - Line 178: `try { execSync('npx supabase start --debug --ignore-health-check', { stdio: 'inherit' }); } catch(e){}`
  - Line 235: `try { execSync('npx supabase start --debug --ignore-health-check', { stdio: 'inherit' }); } catch(err){}`
  - Line 253: `try { execSync('npx supabase start --debug --ignore-health-check', { stdio: 'inherit' }); } catch(err){}`
  - Line 285: `try { execSync('npx supabase start --debug --ignore-health-check', { stdio: 'inherit' }); } catch(e){}`
- **`e2e/run_e2e.ts` (`sleep` buffer occurrences)**: Observed 2 instances in `setup()` where the teardown buffer was reduced to `sleep 5`:
  - Line 47: `try { execSync('sleep 5', { stdio: 'inherit' }); } catch(e){}`
  - Line 63: `try { execSync('sleep 5', { stdio: 'inherit' }); } catch(e){}`
  - Note: Other teardown sequences in `e2e/run_e2e.ts` (lines 102, 128, 177, 234, 252, 284) correctly retain `try { execSync('sleep 20', { stdio: 'inherit' }); } catch(e){}`.
- **`PROJECT.md` (Interface Contracts)**: Observed the explicit contract for `e2e/run_e2e.ts <-> Supabase & Next.js` (lines 17-23), which mandates a "Standardized bulletproof teardown sequence across all 9 locations (`npx supabase stop`, `pkill -9 -f supabase`, `pkill -9 -f supabase-go`, `pkill -9 -f npx supabase`, `docker rm -f`, `docker volume rm -f`, `while docker ps -aq`, `fuser -k 25432/tcp`, `rm -rf supabase/.temp`, `sleep 20`) ensuring `pkill` executes after `docker rm -f` to prevent `supabase-go` daemon corruption."
- **Forensic Auditor Gen 1 Report (`.agents/teamwork_preview_auditor_m5_2_1_gen1/handoff.md`)**: Observed the `INTEGRITY VIOLATION` verdict. The auditor reported that `e2e/run_e2e.ts` failed with exit code 1 because `--ignore-health-check` bypassed the database health check, causing Supabase Realtime to start before `db` was fully registered in Docker DNS, resulting in a fatal Elixir boot crash: `Failed to detect IP version for DB_HOST: nxdomain`.
- **Reviewer 1 Gen 1 Report (`.agents/teamwork_preview_reviewer_m5_2_1_gen1/handoff.md`)**: Observed the `REQUEST_CHANGES (VETO)` verdict. The reviewer reported that reducing `sleep 20` to `sleep 5` at lines 47 and 63 caused `npx supabase start` to collide with ongoing Docker daemon cleanup, triggering fatal errors: `removal of container ... is already in progress` and `failed to prune containers: Error response from daemon: a prune operation is already running`.

## 2. Logic Chain
1. **Supabase Realtime Crash (`nxdomain`)**: By appending `--ignore-health-check` to `npx supabase start` (lines 65, 178, 235, 253, 285), Worker Gen 1 forced the Supabase CLI to start the `realtime` container immediately without waiting for `supabase_db_expense-dashboard` to become healthy and register in Docker DNS (`127.0.0.11`). When `realtime` boots, Elixir attempts to resolve `DB_HOST`, receives `nxdomain`, and crashes, causing `npx supabase start` to fail.
2. **Docker Daemon Race Condition (`a prune operation is already running`)**: `PROJECT.md` explicitly mandates `sleep 20` at the end of the teardown sequence to allow the Docker daemon sufficient time to asynchronously prune containers and volumes. Worker Gen 1's reduction of `sleep 20` to `sleep 5` (lines 47 and 63) does not provide enough time for the Docker daemon to complete `docker rm -f` and volume pruning. When `npx supabase start` is subsequently invoked, it collides with the active cleanup in the Docker daemon, triggering fatal lock errors (`a prune operation is already running`).
3. **Master E2E Test Runner Abortion**: The combined failures of `npx supabase start` due to Docker daemon locks and Supabase Realtime crashes cause all 3 start attempts in `setup()` to fail. Consequently, `e2e/run_e2e.ts` aborts with exit code 1 before building the Next.js bundle or executing the 55 Playwright E2E tests.
4. **Remediation Strategy**: To achieve a genuine E2E test pass and satisfy all architectural contracts, Worker Gen 2 must surgically revert the two specific modifications introduced by Worker Gen 1 in `e2e/run_e2e.ts`: removing `--ignore-health-check` from all 5 `npx supabase start` calls and restoring `sleep 20` at lines 47 and 63.

## 3. Caveats
- No caveats. The investigation was exhaustive, covering all teardown sequences and Supabase startup invocations in `e2e/run_e2e.ts`. The root causes of the E2E test failures were definitively traced to the contract violations identified by Forensic Auditor Gen 1 and Reviewer 1 Gen 1.

## 4. Conclusion
- **Verdict**: The master E2E test runner (`e2e/run_e2e.ts`) fails deterministically due to two distinct contract violations introduced by Worker Gen 1: bypassing database health checks (`--ignore-health-check`) and truncating the teardown buffer (`sleep 5`).
- **Action Required for Worker Gen 2**: Worker Gen 2 must implement the following concrete fix strategy in `/usr/local/google/home/duynguyenn/expense-dashboard/e2e/run_e2e.ts`:
  1. **Remove `--ignore-health-check`**: Modify all 5 instances of `npx supabase start --debug --ignore-health-check` (lines 65, 178, 235, 253, 285) to `npx supabase start --debug`.
  2. **Restore `sleep 20`**: Modify the teardown buffer at line 47 from `try { execSync('sleep 5', { stdio: 'inherit' }); } catch(e){}` to `try { execSync('sleep 20', { stdio: 'inherit' }); } catch(e){}`.
  3. **Restore `sleep 20` (Retry Loop)**: Modify the teardown buffer at line 63 from `try { execSync('sleep 5', { stdio: 'inherit' }); } catch(e){}` to `try { execSync('sleep 20', { stdio: 'inherit' }); } catch(e){}`.

## 5. Verification Method
To independently verify the success of Worker Gen 2's remediation, execute the following steps from the project root `/usr/local/google/home/duynguyenn/expense-dashboard`:

### Step 1: File Inspection
Inspect `e2e/run_e2e.ts` to verify that `--ignore-health-check` has been completely removed and `sleep 20` is restored at lines 47 and 63:
```bash
grep "ignore-health-check" e2e/run_e2e.ts || echo "CLEAN: No ignore-health-check found"
grep "sleep 5" e2e/run_e2e.ts || echo "CLEAN: No sleep 5 found"
```
- **Expected Result**: Both grep commands should return no matches and print the `CLEAN` messages.

### Step 2: Master E2E Test Runner Execution
Execute the master E2E test runner command as defined in `TEST_READY.md`:
```bash
export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/verify_global_market_data.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts && npx tsx e2e/stress_test_m4.ts && npx tsx e2e/stress_test_m4_edge_cases.ts && npx tsx e2e/adv_planner_gaps.ts && npx tsx e2e/run_e2e.ts
```
- **Expected Result**: All verification scripts pass successfully, Supabase starts cleanly without Docker daemon lock errors or `nxdomain` crashes, the Next.js production bundle builds successfully, and all 55 Playwright E2E tests execute and pass with exit code 0.
- **Files to Inspect**: `e2e/run_e2e.ts`.
