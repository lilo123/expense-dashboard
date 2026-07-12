# Handoff Report: Investigation & Concrete Fix Strategy for M5.2 `e2e/run_e2e.ts` (Worker Gen 3 Remediation)

## 1. Observation
- **Master E2E Test Runner Failure**: Forensic Auditor Gen 2 and Challenger 1 Gen 2 observed `e2e/run_e2e.ts` failing with exit code 1 during `setup()`.
- **Verbatim Errors Observed**:
  - `failed to create docker container: Error response from daemon: Conflict. The container name "/supabase_db_expense-dashboard" is already in use by container "0c1a313c8b41e151a5e67c999b56e5eae41abdfdcc616f44a6fb645daeab0f8a".`
  - `supabase start is already running.`
  - `supabase_db_expense-dashboard container is not ready: starting`
  - `Failed to remove container: ... Error response from daemon: removal of container ... is already in progress`
- **`e2e/run_e2e.ts` Redundant Cleanup Logic**: Inspection of `e2e/run_e2e.ts` reveals that identical cleanup blocks (`npx supabase stop`, `docker ps -aq | xargs -r docker rm -f`, `pkill -9`, `sleep 20`) are executed redundantly:
  - Before the retry loop (lines 38-47).
  - Inside the retry loop at the start of each attempt (lines 54-63).
  - Inside the catch block of the retry loop (lines 93-102).
  - Across multiple recovery blocks in `run()` (lines 168-177, 225-234, 243-252, 275-284) and `cleanup()` (lines 119-128).
- **Orphaned Lock Files**: Challenger 2 Gen 2 observed that `pkill -9 -f "supabase"` forcefully terminates `supabase-go`, leaving behind orphaned lock files (`~/.supabase/supabase.lock` and `/tmp/supabase.lock`). `e2e/run_e2e.ts` only removes `supabase/.temp` (line 46, 62, 101, etc.), failing to clear these lock files.
- **Standalone Verification Scripts**: All 6 standalone verification scripts (`verify_global_market_data.ts`, `verify_accumulation.ts`, `verify_monte_carlo.ts`, `stress_test_m4.ts`, `stress_test_m4_edge_cases.ts`, `adv_planner_gaps.ts`) execute successfully with exit code 0, confirming core domain logic correctness.

## 2. Logic Chain
1. **Docker Daemon Race Condition (`removal of container ... is already in progress`)**: In `setup()`, `docker ps -aq | xargs -r docker rm -f` is called immediately before the loop (line 39) and again at the start of the first iteration `i=0` (line 55). Because Docker container removal is asynchronous, the second invocation attempts to remove a container whose removal is already actively in progress by the daemon, triggering a fatal race condition.
2. **Supabase CLI Lock Contention (`supabase start is already running`)**: When `pkill -9 -f "supabase"` executes, `supabase-go` is killed instantly (`SIGKILL`), preventing its normal cleanup routines from deleting `~/.supabase/supabase.lock` and `/tmp/supabase.lock`. When `npx supabase start` is subsequently called, the Supabase CLI detects the orphaned lock files, falsely assumes another instance is running, and aborts.
3. **Container Name Conflict (`Conflict. The container name ... is already in use`)**: Because `npx supabase stop` and `docker rm -f` fail or collide due to lock contention and daemon race conditions, the old `supabase_db_expense-dashboard` container is not properly removed. When `npx supabase start` attempts to create the container, the Docker daemon rejects it due to the naming conflict.
4. **Playwright E2E Starvation**: The failure of `setup()` to boot Supabase causes `run_e2e.ts` to abort before building the Next.js bundle or launching Playwright, leading to the Forensic Auditor's `INTEGRITY VIOLATION` verdict.
5. **Remediation Strategy**: To achieve bulletproof standalone reliability and satisfy the `PROJECT.md` teardown contract, `e2e/run_e2e.ts` must be refactored to use a single, idempotent `teardownSupabase()` helper function. This function must include `rm -rf supabase/.temp ~/.supabase/supabase.lock /tmp/supabase.lock 2>/dev/null || true` and replace the redundant pre-loop, in-loop, and catch-block cleanups so that teardown executes exactly once per startup attempt.

## 3. Caveats
- **Read-Only Constraint**: As Explorer 3, we operated under a strict read-only investigation constraint. We have designed the concrete fix strategy but did not modify `e2e/run_e2e.ts` ourselves. Worker Gen 3 must implement these changes.
- **Playwright Execution**: Playwright E2E tests could not be executed during investigation due to the existing Supabase startup failures in `e2e/run_e2e.ts`.

## 4. Conclusion
- **Verdict**: `e2e/run_e2e.ts` fails standalone execution due to redundant cleanup race conditions and orphaned Supabase CLI lock files.
- **Actionable Recommendation for Worker Gen 3**:
  1. Define a `teardownSupabase()` helper function in `e2e/run_e2e.ts` that implements the full `PROJECT.md` teardown contract plus lock file deletion:
     ```typescript
     function teardownSupabase() {
       console.log('Performing bulletproof Supabase teardown and cleanup...');
       try { execSync('npx supabase stop --no-backup 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
       try { execSync('pkill -9 -f "supabase" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
       try { execSync('pkill -9 -f "supabase-go" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
       try { execSync('pkill -9 -f "npx supabase" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
       try { execSync('fuser -k 25432/tcp 54329/tcp 54321/tcp 54320/tcp 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
       try { execSync('rm -rf supabase/.temp ~/.supabase/supabase.lock /tmp/supabase.lock 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
       try { execSync('docker ps -aq | xargs -r docker rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
       try { execSync('docker volume ls -q | xargs -r docker volume rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
       try { execSync('while docker ps -aq | grep -q . || docker volume ls -q | grep -q "supabase" || docker inspect supabase_db_expense-dashboard >/dev/null 2>&1; do sleep 2; done', { stdio: 'inherit' }); } catch(e){}
       try { execSync('sleep 20', { stdio: 'inherit' }); } catch(e){}
     }
     ```
  2. Refactor `setup()` in `e2e/run_e2e.ts`:
     - Remove the pre-loop cleanup block (lines 38-47).
     - Replace the in-loop cleanup block (lines 54-63) with `teardownSupabase();`.
     - Remove the catch-block cleanup (lines 93-102), as the next loop iteration will invoke `teardownSupabase();`.
  3. Refactor `cleanup()` (lines 119-128) and all recovery blocks in `run()` (lines 168-177, 225-234, 243-252, 275-284) to call `teardownSupabase();`.

## 5. Verification Method
- **Command to Execute**:
  ```bash
  export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/verify_global_market_data.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts && npx tsx e2e/stress_test_m4.ts && npx tsx e2e/stress_test_m4_edge_cases.ts && npx tsx e2e/adv_planner_gaps.ts && npx tsx e2e/run_e2e.ts
  ```
- **Files to Inspect**: `e2e/run_e2e.ts`.
- **Expected Result**: After Worker Gen 3 applies the refactoring, `e2e/run_e2e.ts` will start Supabase cleanly on the first attempt (or recover cleanly without race conditions/lock contention if retried) and execute the Playwright E2E test suite successfully with exit code 0.
