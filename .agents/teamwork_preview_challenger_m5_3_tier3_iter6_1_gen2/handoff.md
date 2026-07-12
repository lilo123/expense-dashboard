# Handoff Report: Milestone 5.3 Empirical Verification & Stress-Testing (Tier 3 E2E Challenger 1, Gen 2)

**Work Product**: Empirical verification and stress-testing of Worker 1 Gen 2's implementation (`supabase/config.toml`, `e2e/run_e2e.ts`, `TEST_READY.md`)
**Profile**: General Project
**Verdict**: FAILED (Worker 1 Gen 2's implementation contains critical OOM and concurrency flaws preventing E2E test completion)

---

## 1. Observation

### A. Next.js Production Build OOM Crash (`e2e/run_e2e.ts`)
- **Initial State / Worker Claim**: Worker 1 Gen 2 claimed 100% E2E test pass with exit code 0.
- **Empirical Observation**: In `task-37`, the master E2E test runner successfully passed all 7 pre-verification test suites but failed during `e2e/run_e2e.ts` at the Next.js production build step (`npm run build`).
- **Verbatim Error**:
  ```
  Building fresh Next.js production bundle...
  ...
  Creating an optimized production build ...
  ✓ Compiled successfully in 22.8s
  <--- Last few GCs --->
  [1666274:0x1cc8b000]     9832 ms: Mark-Compact (reduce) 510.2 (524.5) -> 509.5 (522.0) MB, pooled: 0 MB, 139.79 / 0.00 ms  (+ 0.1 ms in 0 steps since start of marking, biggest step 0.0 ms, walltime since start of marking 157 ms) (average mu = 0.251, curre

  <--- JS stacktrace --->

  FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory
  ...
  Next.js build worker exited with code: null and signal: SIGABRT
  E2E Tests execution failed! Error: Command failed: npm run build
  ```
- **Root Cause in Code**: `e2e/run_e2e.ts` line 358 explicitly sets `NODE_OPTIONS: '--max-old-space-size=512'` for `npm run build`. Next.js 16 production builds require significantly more memory than 512MB for Webpack/Turbopack bundling and page pre-rendering, causing V8 to run out of memory and abort.

### B. Same-TTY Concurrent Runner Termination Flaw (`e2e/run_e2e.ts`)
- **Initial State / Worker Claim**: Worker 1 Gen 2 claimed to have replaced global killing with TTY-scoped filtering (`killLingeringProcessesScoped`), stating: *"Concurrent test runners safely wait for active locks... eliminating process collision wars entirely."*
- **Empirical Observation**: In `task-23`, while waiting for the mutex lock (`Another run_e2e instance (PID 1603657) is active. Waiting for lock...`), `task-23` was abruptly terminated with exit code 137 (`SIGKILL`).
- **Root Cause in Code**: `killLingeringProcessesScoped('node.*run_e2e|tsx.*run_e2e')` filters processes by `pTty === myTty`. When multiple test runners are launched on the same TTY (e.g. `pts/0`), the active instance holding the lock reaches `Building fresh Next.js production bundle...` and calls `killLingeringProcessesScoped('node.*run_e2e|tsx.*run_e2e')`. Because the waiting test runner shares the same TTY, it is incorrectly identified as a "lingering process" and killed with `kill -9`.

### C. Mutex Lock Starvation (`e2e/run_e2e.ts`)
- **Initial State / Worker Claim**: Worker 1 Gen 2 implemented `acquireLock()` with `process.kill(pid, 0)` to wait for active locks and remove stale locks.
- **Empirical Observation**: In `task-31`, the test runner waited for PID 1605821 for 55 attempts. When PID 1605821 finished, another concurrent runner (PID 1618507) instantly acquired the lock. `task-31` ran out of its 60 attempts (5 minutes) and aborted with:
  ```
  E2E Tests execution failed! Error: Failed to acquire mutex lock /tmp/run_e2e.lock after 5 minutes. Aborting to prevent process collision.
  ```
- **Root Cause in Code**: `acquireLock()` has a hardcoded 5-minute timeout (`let attempts = 60;` with `sleep 5`). In high-concurrency environments where multiple long-running E2E test runners queue up, waiting runners experience lock starvation and abort.

### D. Successful Exit Code Propagation (`TEST_READY.md`)
- **Initial State / Worker Claim**: Worker 1 Gen 2 replaced `exec npx tsx e2e/run_e2e.ts` with `node node_modules/.bin/tsx e2e/run_e2e.ts` in `TEST_READY.md` to prevent `npx` from swallowing exit codes.
- **Empirical Observation**: When `task-31` failed due to lock starvation and `task-37` failed due to OOM, the master E2E test runner correctly terminated with exit code 1 (and exit code 137 for `task-23`).
- **Result**: Exit code propagation works perfectly; masked failures have been successfully eliminated.

### E. Successful Supabase CLI & Realtime Config (`supabase/config.toml`)
- **Initial State / Worker Claim**: Worker 1 Gen 2 enabled `[realtime]` and removed incompatible `health_timeout` keys.
- **Empirical Observation**: Supabase CLI starts cleanly without Viper decoding errors, and the Realtime health check at `http://127.0.0.1:54321/realtime/v1/health` passes successfully in `run_e2e.ts`.

---

## 2. Logic Chain

1. **Next.js Build OOM**: Hardcoding `NODE_OPTIONS: '--max-old-space-size=512'` during `npm run build` in `e2e/run_e2e.ts` starves the Next.js Webpack build worker of memory. When memory consumption exceeds 512MB, V8 throws `FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory` and crashes with `SIGABRT`, failing the E2E test suite.
2. **Same-TTY Process Elimination War**: `killLingeringProcessesScoped` assumes that any concurrent `run_e2e` process on the same TTY is a lingering orphan. In automated environments where multiple test runners share a TTY, the active runner kills all waiting runners with `kill -9`, violating the multi-tenant co-existence requirement.
3. **Lock Starvation**: A 5-minute lock acquisition timeout is insufficient when multiple concurrent E2E test runners (each taking 5+ minutes to run) are queued, leading to premature abortion of valid test runs.
4. **Exit Code Propagation**: Using `node node_modules/.bin/tsx e2e/run_e2e.ts` successfully bypasses `npx`'s signal swallowing behavior, ensuring that the OOM crashes and lock timeouts correctly report non-zero exit codes to the calling shell.

---

## 3. Caveats

- **No caveats.** All findings were discovered and verified empirically by executing the master E2E test runner in both highly concurrent (`task-23`, `task-31`) and standalone (`task-37`) environments.

---

## 4. Conclusion

Worker 1 Gen 2's implementation successfully resolves the Supabase CLI Viper decoding bugs, enables Realtime contracts, and fixes the masked exit code vulnerability in `TEST_READY.md`. However, the solution FAILES empirical verification and stress-testing due to three critical flaws in `e2e/run_e2e.ts`:
1. **Next.js Build OOM Crash**: `npm run build` crashes with `SIGABRT` due to `NODE_OPTIONS: '--max-old-space-size=512'`.
2. **Same-TTY Concurrent Runner Termination Flaw**: `killLingeringProcessesScoped` kills concurrent waiting test runners on the same TTY.
3. **Mutex Lock Starvation**: `acquireLock()` aborts waiting runners after a 5-minute timeout.

**Actionable Recommendations for Worker**:
1. Increase `NODE_OPTIONS: '--max-old-space-size=4096'` (or remove the flag) for `npm run build` in `e2e/run_e2e.ts`.
2. Modify `killLingeringProcessesScoped` to exclude active `run_e2e` processes that are waiting for the lock, or use a more robust IPC/lockfile mechanism instead of `pgrep`/`kill`.
3. Increase `acquireLock()` timeout to at least 30 minutes (`let attempts = 360;`) to accommodate long-running concurrent E2E queues.

---

## 5. Verification Method

To independently verify these findings:

1. **Inspect `e2e/run_e2e.ts`**:
   - Line 358: Observe `NODE_OPTIONS: '--max-old-space-size=512'` in `execSync('npm run build', ...)`.
   - Lines 64-86: Observe `killLingeringProcessesScoped` filtering by `pTty === myTty`.
   - Lines 16-50: Observe `acquireLock()` timeout set to `let attempts = 60;` (5 minutes).

2. **Execute Master E2E Test Runner**:
   ```bash
   export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/verify_global_market_data.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts && npx tsx e2e/verify_tier3_combinations.ts && npx tsx e2e/stress_test_m4.ts && npx tsx e2e/stress_test_m4_edge_cases.ts && npx tsx e2e/adv_planner_gaps.ts && node node_modules/.bin/tsx e2e/run_e2e.ts
   ```
   **Expected Result**: The 7 pre-verification test suites pass successfully. `e2e/run_e2e.ts` fails with `FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory` during `npm run build` (exit code 1), or aborts due to lock starvation / same-TTY pkill in concurrent environments.
