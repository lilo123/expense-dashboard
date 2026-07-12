# Handoff Report: Empirical Verification of M5.2 Tier 2 E2E Test Pass

## 1. Observation
- **Master E2E Test Runner Execution**: Executed the master test runner command (`export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/verify_global_market_data.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts && npx tsx e2e/stress_test_m4.ts && npx tsx e2e/stress_test_m4_edge_cases.ts && npx tsx e2e/adv_planner_gaps.ts && npx tsx e2e/run_e2e.ts`) via `run_command` (task-27).
- **Standalone Verification Scripts Success**: Observed that all 6 boundary/corner case test scripts (`verify_global_market_data.ts`, `verify_accumulation.ts`, `verify_monte_carlo.ts`, `stress_test_m4.ts`, `stress_test_m4_edge_cases.ts`, `adv_planner_gaps.ts`) executed successfully and passed with exit code 0.
- **`e2e/run_e2e.ts` Failure**: Observed that `e2e/run_e2e.ts` failed with exit code 1 during `setup()`.
- **Verbatim Errors in `task-27.log`**:
  - Attempt 1 & 2: `supabase start is already running.` and `supabase_db_expense-dashboard container is not ready: starting`.
  - Attempt 3: `Failed to remove container: 8441ade7c2513a19b99e16ef66495d36bd39808714333691737dd59f00efea97 Error response from daemon: removal of container 8441ade7c2513a19b99e16ef66495d36bd39808714333691737dd59f00efea97 is already in progress` followed by `Failed to start Supabase after 3 attempts.`
- **`e2e/run_e2e.ts` Redundant Cleanup Logic**: Observed in `e2e/run_e2e.ts` that `docker ps -aq | xargs -r docker rm -f` and `sleep 20` are executed both before the retry loop (lines 39, 47) and inside the retry loop (lines 55, 63, 94, 102).

## 2. Logic Chain
1. **Boundary & Corner Case Correctness**: The successful execution of `verify_global_market_data.ts`, `verify_accumulation.ts`, `verify_monte_carlo.ts`, `stress_test_m4.ts`, `stress_test_m4_edge_cases.ts`, and `adv_planner_gaps.ts` confirms that the core domain logic, Zod schemas, market data toggles, accumulation compounding math, Monte Carlo determinism, and drawdown engine tax calculations are robust against extreme inputs and edge cases.
2. **Worker Gen 2 Claim Invalidation**: Worker Gen 2 claimed that restoring `sleep 20` at lines 47 and 63 of `e2e/run_e2e.ts` eliminates Docker daemon race conditions. However, empirical execution proves this claim false.
3. **Docker Daemon Race Condition Mechanism**: In `e2e/run_e2e.ts`, `docker ps -aq | xargs -r docker rm -f` is invoked immediately before the loop and again at the start of the loop (`i=0`). This redundant invocation sends conflicting force-remove requests to the Docker daemon. Because container removal is asynchronous, `sleep 20` is insufficient when the daemon is locked in a removal operation. When `npx supabase start --debug` is executed in attempt 3, Supabase Realtime attempts to remove an old container (`8441ade7c2513a19b99e16ef66495d36bd39808714333691737dd59f00efea97`), colliding with the daemon's active removal process and triggering the fatal error `removal of container ... is already in progress`.
4. **Supabase CLI Lock Contention**: In attempts 1 and 2, `pkill -9 -f "supabase"` failed to clear the Supabase CLI's internal lock state or daemon process, causing `npx supabase start` to abort with `supabase start is already running.`.

## 3. Caveats
- We operated under a strict `Review-only` constraint and did not modify `e2e/run_e2e.ts` to fix the Docker daemon race condition or Supabase CLI lock contention.
- Playwright E2E tests in `e2e/run_e2e.ts` could not be executed because the setup phase failed to boot Supabase.

## 4. Conclusion
- **Verdict**: Worker Gen 2's remediation for Milestone 5.2 is PARTIALLY CORRECT but FAILED empirical verification due to a fatal Docker daemon race condition in `e2e/run_e2e.ts`.
- **Core Logic Status**: All 15 Tier 2 boundary & corner case test cases across F1, F2, and F3 in the standalone verification scripts passed successfully.
- **Actionable Recommendation**: The `setup()` function in `e2e/run_e2e.ts` must be refactored to remove redundant `docker rm -f` calls between the pre-loop and loop start, implement a more robust lock cleanup for Supabase CLI (e.g., checking `~/.supabase` or using `supabase stop`), and ensure the Docker daemon has fully released container locks before invoking `npx supabase start`.

## 5. Verification Method
- **Command to Execute**: `export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/verify_global_market_data.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts && npx tsx e2e/stress_test_m4.ts && npx tsx e2e/stress_test_m4_edge_cases.ts && npx tsx e2e/adv_planner_gaps.ts && npx tsx e2e/run_e2e.ts`
- **Files to Inspect**: `e2e/run_e2e.ts` (lines 38-110).
- **Expected Result**: After fixing `e2e/run_e2e.ts`, all verification scripts and `run_e2e.ts` should complete with exit code 0 without encountering `supabase start is already running` or `removal of container ... is already in progress`.
