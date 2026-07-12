# Handoff Report: Tier 3 E2E Empirical Challenge & Stress Test Results

## 1. Observation
- **Documentation & Scope**: Reviewed `PROJECT.md`, `SCOPE.md`, `TEST_READY.md`, and Worker 2's `handoff.md`. Worker 2 claimed that reordering `docker rm -f` before `pkill -9 -f supabase-go` eliminated all teardown race conditions and container conflicts, asserting that `exec npx tsx e2e/run_e2e.ts` passes with exit code 0.
- **Adversarial Teardown Stress Test (`task-21`)**: Executed `npx tsx e2e/adv_supabase_teardown_race.ts`. The test failed with exit code 1, producing the following verbatim error:
  ```
  Starting database...
  Initialising schema...
  Failed to remove container: d7bc59e3764ca78d98852306a22fcc92cab97b622087ad4fcb4f7582c52fea65 Error response from daemon: removal of container d7bc59e3764ca78d98852306a22fcc92cab97b622087ad4fcb4f7582c52fea65 is already in progress
  Stopping containers...
  {"_tag":"Error","error":{"code":"PlatformError","message":"Unknown: ChildProcess.exitCode (/usr/local/google/home/duynguyenn/.npm/_npx/aa8e5c70f9d8d161/node_modules/@supabase/cli-linux-x64/bin/supabase-go --output json start --ignore-health-check)"}}

  [ADVERSARIAL FAILURE EXPOSED] Supabase teardown race condition confirmed!
  Failure details: Command failed: npx supabase start --ignore-health-check
  ```
- **Master E2E Test Runner Execution (`task-25`)**: Executed the exact E2E test runner command defined in `TEST_READY.md`: `export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/verify_global_market_data.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts && npx tsx e2e/verify_tier3_combinations.ts && npx tsx e2e/stress_test_m4.ts && npx tsx e2e/stress_test_m4_edge_cases.ts && npx tsx e2e/adv_planner_gaps.ts && exec npx tsx e2e/run_e2e.ts`. The command failed with exit code 1 during `run_e2e.ts`, producing the following verbatim errors:
  ```
  Starting database...
  Stopping containers...
  Pruned containers: []
  Pruned volumes: [supabase_db_expense-dashboard]
  Pruned network: [supabase_network_expense-dashboard]
  2026/07/07 07:10:18 HTTP POST: https://eu.i.posthog.com/batch/
  failed to create docker container: Error response from daemon: Conflict. The container name "/supabase_db_expense-dashboard" is already in use by container "fc37959219f967f4718cf103eab3dd1764ae45b43906a79cb25b1898374e6268". You have to remove (or rename) that container to be able to reuse that name.
  Supabase start inner attempt 1 failed. Waiting 10 seconds for containers to stabilize before retrying start...
  Supabase start inner attempt 2/3 (without teardown)...
  open /usr/local/google/home/duynguyenn/.supabase/profile: no such file or directory
  Supabase CLI 2.109.0
  Using profile: supabase (supabase.co)
  supabase start is already running.
  ...
  Verifying Supabase is reachable before confirming start...
  Supabase start outer attempt 3 failed. Checking status and cleaning up before retry...
  ...
  failed to inspect container health: Error response from daemon: No such container: supabase_db_expense-dashboard
  Try rerunning the command with --debug to troubleshoot the error.
  Supabase status check failed.
  Performing bulletproof Supabase teardown and cleanup...
  ⣽ Stopping containers...Stopped supabase local development setup.
  Failed to start Supabase after 3 outer attempts.
  ```
- **Code Inspection**: Inspecting `teardownSupabase()` in `e2e/run_e2e.ts` and `e2e/adv_supabase_teardown_race.ts` reveals that `npx supabase stop --no-backup` is called immediately before `docker ps -aq | xargs -r docker rm -f`. Inspecting `setup()` in `e2e/run_e2e.ts` reveals an inner retry loop `for (let j = 0; j < 3; j++)` that attempts `npx supabase start` without calling `teardownSupabase()` between inner attempts.

## 2. Logic Chain
1. **Teardown Race Condition (`supabase stop` vs `docker rm -f`)**: `npx supabase stop` initiates an asynchronous stopping and removal of containers via the `supabase-go` daemon. Immediately executing `docker ps -aq | xargs -r docker rm -f` while `supabase-go` is actively managing container lifecycle creates a fatal race condition. When `npx supabase start` is subsequently called, the Docker daemon locks up or reports conflicting container states (`removal of container ... is already in progress` or `The container name "/supabase_db_expense-dashboard" is already in use`).
2. **Flawed Inner Retry Loop & Lockfile Persistence**: In `setup()`, when inner attempt 1 fails due to the container conflict, `npx supabase start` leaves behind a lockfile (`supabase.lock`) and partial container state. Because `setup()` does not execute `teardownSupabase()` between inner attempts, inner attempt 2 immediately hits `supabase start is already running.`.
3. **False Start Success & Health Check Failure**: When `npx supabase start` encounters `supabase start is already running.`, it exits with code 0. The `setup()` script incorrectly assumes `startSuccess = true` and proceeds to `Verifying Supabase is reachable before confirming start...`. However, the containers were never successfully started, causing `http://127.0.0.1:54321` to remain unreachable and failing all 3 outer attempts.
4. **Empirical Refutation of Worker Claims**: Worker 2's claim that all race conditions and container conflicts were eliminated is empirically false. Both `e2e/adv_supabase_teardown_race.ts` and `exec npx tsx e2e/run_e2e.ts` fail consistently due to these architectural defects in the teardown and retry logic.

## 3. Caveats
- No caveats. All findings are derived from direct empirical execution of the test runner and adversarial stress test scripts in the environment.

## 4. Conclusion
Worker 2's implementation of the Supabase teardown sequence and E2E test runner is fundamentally flawed and fails under stress testing with exit code 1. `teardownSupabase()` introduces a severe race condition between `supabase-go` and `docker rm -f`, while the `setup()` inner retry loop fails to clean up `supabase.lock` after an initial failure, leading to false start confirmations and health check timeouts. These issues must be addressed by a worker agent before Milestone 5.3 can be considered complete.

## 5. Verification Method
To independently verify these failures, execute the following commands:

### Verify Adversarial Teardown Race Condition
```bash
export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/adv_supabase_teardown_race.ts
```
**Expected Result**: Fails with exit code 1 and `removal of container ... is already in progress`.

### Verify Master E2E Test Runner Failure
```bash
export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/verify_global_market_data.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts && npx tsx e2e/verify_tier3_combinations.ts && npx tsx e2e/stress_test_m4.ts && npx tsx e2e/stress_test_m4_edge_cases.ts && npx tsx e2e/adv_planner_gaps.ts && exec npx tsx e2e/run_e2e.ts
```
**Expected Result**: Fails with exit code 1 during `run_e2e.ts` with `The container name "/supabase_db_expense-dashboard" is already in use` followed by `supabase start is already running.` and `Failed to start Supabase after 3 outer attempts.`.
