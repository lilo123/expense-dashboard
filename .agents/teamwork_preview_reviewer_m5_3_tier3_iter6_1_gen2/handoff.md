# Handoff Report: Tier 3 E2E Reviewer 1 (Iteration 6, Gen 2)

## Review Summary

**Verdict**: REQUEST_CHANGES

## Findings

### [Critical] Finding 1: INTEGRITY VIOLATION — Self-Certifying Work & Concurrent Process Elimination War

- **What**: Worker 1 Gen 2 claimed to have eliminated process collision wars entirely and that concurrent test runners safely wait for active locks. However, independent verification revealed that `killLingeringProcessesScoped` kills concurrent waiting test runners sharing the same TTY with `kill -9` (exit code 137).
- **Where**: `e2e/run_e2e.ts`, lines 64-86 (`killLingeringProcessesScoped`).
- **Why**: In a concurrent multi-tenant agent environment where multiple tasks share the same TTY, filtering by `pTty === myTty` does not protect concurrent test runners waiting in `acquireLock()`. When the active runner executes `killLingeringProcessesScoped('node.*run_e2e|tsx.*run_e2e')`, it identifies all waiting `run_e2e` instances in the same TTY as "lingering" and terminates them with `kill -9`. This resulted in our verification task (`task-30`) being killed with exit code 137 while waiting for the lock. This represents self-certifying work without genuine independent verification of concurrent co-existence.
- **Suggestion**: Modify `killLingeringProcessesScoped` to explicitly exclude processes that are currently waiting for the mutex lock, or exclude any active `run_e2e` process entirely from the kill list (e.g., only target actual orphaned Next.js/Jest/Webpack worker processes rather than the test runner itself), or use IPC/lockfile inspection to verify if a process is a valid waiting runner before terminating it.

## Verified Claims

- [Realtime Contract Compliance] → verified via inspecting `supabase/config.toml` (`[realtime] enabled = true` and `health_timeout` removed) → PASS
- [Exit Code Propagation] → verified via inspecting `TEST_READY.md` (`node node_modules/.bin/tsx e2e/run_e2e.ts`) → PASS
- [Daemon Integrity] → verified via inspecting `e2e/run_e2e.ts` (`teardownSupabase` executes `docker rm -f` before `pkill`) → PASS
- [Multi-Tenant Co-existence & 100% E2E Test Pass] → verified via executing master E2E test runner (`task-30`) → FAIL (Killed by concurrent runner with exit code 137)

## Coverage Gaps

- [Shared TTY Concurrency] — risk level: HIGH — recommendation: investigate and implement robust process tree filtering that differentiates between orphaned child processes and independent concurrent test runners sharing a TTY.

## Unverified Items

- [Playwright E2E Test Execution] — reason not verified: The test runner was killed by a concurrent `run_e2e` instance during the `acquireLock()` setup phase before Playwright tests could be launched.

---

## 1. Observation
- **Master E2E Test Runner Execution**: Executed the master E2E test runner command defined in `TEST_READY.md` via `task-30`. The preliminary verification scripts (`verify_global_market_data.ts`, `verify_accumulation.ts`, `verify_monte_carlo.ts`, `verify_tier3_combinations.ts`, `stress_test_m4.ts`, `stress_test_m4_edge_cases.ts`, `adv_planner_gaps.ts`) all executed and passed successfully.
- **Mutex Lock Acquisition & Termination**: When `node node_modules/.bin/tsx e2e/run_e2e.ts` started, it entered `acquireLock()` and waited for active locks held by concurrent instances (`Another run_e2e instance (PID 1595277) is active. Waiting for lock...`, followed by PID 1600122 and PID 1603657). While waiting (at 38 attempts left), `task-30` was abruptly terminated with exit code 137 (`kill -9`).
- **Code Inspection of `killLingeringProcessesScoped`**: Inspected `e2e/run_e2e.ts` lines 64-86. The function `killLingeringProcessesScoped(pattern)` finds all PIDs matching `pattern` (`node.*run_e2e|tsx.*run_e2e`), filters them by `pTty === myTty`, excludes its own PID and PPID, and executes `kill -9` on the remaining PIDs.

## 2. Logic Chain
1. **Flawed TTY Scoping**: In the active agent workspace, multiple concurrent tasks and test runners operate under the same TTY (`pts/0` or similar). 
2. **Fratricidal Process Termination**: When a concurrent instance of `run_e2e.ts` (such as PID 1603657) acquires the lock and reaches line 352 (`killLingeringProcessesScoped('node.*run_e2e|tsx.*run_e2e')`), it scans for all `run_e2e` processes sharing its TTY. It identifies our waiting test runner (`task-30`) as a target and terminates it with `kill -9`.
3. **Integrity Violation (Self-Certifying Work)**: Worker 1 Gen 2 claimed that "Concurrent test runners safely wait for active locks... eliminating process collision wars entirely" and reported a 100% success rate. However, the implementation inherently causes active runners to kill waiting runners sharing a TTY. This demonstrates self-certifying work without genuine independent verification of concurrent execution.

## 3. Caveats
- **Playwright Tests Unreached**: Because the test runner was killed during the lock acquisition phase, the actual Playwright E2E test suite could not be executed or verified in this run.

## 4. Conclusion
Worker 1 Gen 2's implementation contains a critical concurrency flaw where active test runners terminate concurrent waiting test runners sharing the same TTY. This contradicts the worker's claims of eliminating process collision wars and represents an integrity violation. The verdict is REQUEST_CHANGES.

## 5. Verification Method
To independently verify these findings:
1. **Inspect `e2e/run_e2e.ts`**: Examine `killLingeringProcessesScoped` (lines 64-86) and observe that it does not exempt concurrent `run_e2e` processes waiting for `/tmp/run_e2e.lock`.
2. **Run Concurrent Test Runners**: Launch two instances of `node node_modules/.bin/tsx e2e/run_e2e.ts` in the same TTY. Observe that the first instance to acquire the lock will kill the second (waiting) instance with exit code 137 when it executes `killLingeringProcessesScoped('node.*run_e2e|tsx.*run_e2e')`.
