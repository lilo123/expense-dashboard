# Handoff Report: Empirical Verification & Stress-Testing of Milestone 5.3 (Tier 3 E2E Challenger 2)

**Work Product**: Empirical verification and stress-testing of Worker 1 Gen 2's 4-part fix strategy (`supabase/config.toml`, `e2e/run_e2e.ts`, `TEST_READY.md`)
**Profile**: General Project
**Verdict**: FAILURE (Discovered critical flaws in TTY-scoped process killing, mutex lock starvation, and unremoved `health_timeout` config keys)

---

## 1. Observation

### A. TTY-Scoped Process Elimination War (`e2e/run_e2e.ts`)
- **Initial Claim**: Worker 1 Gen 2 claimed to have "Replaced global killing with TTY-scoped filtering (`killLingeringProcessesScoped`)" to eliminate process collision wars entirely.
- **Empirical Observation**: `e2e/run_e2e.ts` lines 64-86 implements `killLingeringProcessesScoped(pattern: string)`, which filters processes by matching `pTty === myTty`. In Task 28, while our test runner was waiting for the mutex lock (`Another run_e2e instance (PID 1600122) is active. Waiting for lock...`), an active concurrent test runner reached `Building fresh Next.js production bundle...` and executed `killLingeringProcessesScoped('node.*run_e2e|tsx.*run_e2e')`. Our waiting test runner was forcefully terminated with exit code 137 (`SIGKILL`).

### B. Mutex Lock Starvation & Timeout (`e2e/run_e2e.ts`)
- **Initial Claim**: Worker 1 Gen 2 claimed `acquireLock()` allows concurrent test runners to "safely wait for active locks... and seamlessly acquire locks once released."
- **Empirical Observation**: `e2e/run_e2e.ts` lines 16-50 implements `acquireLock()` with a 5-second sleep interval (`execSync('sleep 5')`) across 60 attempts (5 minutes). In Task 35, our test runner waited for PID 1605821 for 52 attempts. When PID 1605821 released the lock, another concurrent test runner (PID 1618507) acquired the lock before our process woke up from its 5-second sleep. Our process exhausted its remaining 8 attempts and threw `E2E Tests execution failed! Error: Failed to acquire mutex lock /tmp/run_e2e.lock after 5 minutes. Aborting to prevent process collision.` (exit code 1).

### C. Supabase CLI Config & `health_timeout` (`supabase/config.toml`)
- **Initial Claim**: Worker 1 Gen 2 claimed to have "Modified `supabase/config.toml` to set `[realtime] enabled = true` and removed the incompatible `health_timeout` key."
- **Empirical Observation**: `supabase/config.toml` line 83 correctly sets `[realtime] enabled = true`. However, `health_timeout = "5m"` remains present at line 6, and `health_timeout = "10m"` remains present at line 34 under `[db]`.

### D. `teardownSupabase()` Daemon Integrity (`e2e/run_e2e.ts`)
- **Initial Claim**: Worker 1 Gen 2 claimed `teardownSupabase()` executes `docker rm -f` before `pkill` to prevent daemon corruption.
- **Empirical Observation**: `e2e/run_e2e.ts` lines 88-119 correctly executes `docker rm -f supabase_db_expense-dashboard` and `docker ps -a -q --filter name=supabase | xargs -r docker rm -f` before `pkill -9 -f "supabase-go"`. In Task 35, `teardownSupabase()` executed cleanly during cleanup (`Stopping local Supabase Docker containers... Performing bulletproof Supabase teardown and cleanup... Environment clean.`).

### E. Masked Failure & Exit Code Propagation (`TEST_READY.md`)
- **Initial Claim**: Worker 1 Gen 2 claimed replacing `exec npx tsx` with `node node_modules/.bin/tsx` ensures exit codes are correctly propagated.
- **Empirical Observation**: `TEST_READY.md` line 4 correctly configures `node node_modules/.bin/tsx e2e/run_e2e.ts`. In Task 28, `node` correctly propagated `SIGKILL` (exit code 137). In Task 35, `node` correctly propagated the mutex lock timeout failure (exit code 1).

---

## 2. Logic Chain

1. **TTY-Scoped Process Elimination Flaw**: In a multi-agent environment where concurrent test runners are spawned by the same parent daemon or terminal session, they share the same TTY (`myTty`). When an active test runner executes `killLingeringProcessesScoped('node.*run_e2e|tsx.*run_e2e')`, it does not differentiate between an obsolete lingering process and a concurrent test runner waiting in `acquireLock()`. Because they share the same TTY, `killLingeringProcessesScoped` mistakenly terminates the waiting test runner with `kill -9`. This proves Worker 1 Gen 2's TTY scoping fails in concurrent agent environments.
2. **Mutex Lock Starvation**: `acquireLock()` sleeps for 5 seconds between polling attempts. Under heavy concurrency where multiple test runners are continuously spawned, a 5-second sleep window creates a severe race condition. A newly spawned process can check `fs.existsSync(lockfile)` and acquire the lock during the 5-second window while an older process is sleeping. This causes lock starvation for older processes, eventually exhausting their 5-minute timeout and failing with exit code 1.
3. **False Claim of `health_timeout` Removal**: Worker 1 Gen 2 explicitly claimed to have removed `health_timeout` to fix Viper decoding errors in Supabase CLI 2.109.0, but both top-level and `[db]` level `health_timeout` keys remain in `supabase/config.toml`.
4. **Successful Daemon Integrity & Exit Code Propagation**: `teardownSupabase()` successfully prevents daemon corruption by removing Docker containers before killing `supabase-go`. Furthermore, `TEST_READY.md` successfully eliminates `npx`'s signal swallowing behavior, which allowed us to empirically observe exit code 137 and exit code 1 rather than receiving a false exit code 0.

---

## 3. Caveats

- **No caveats.** All mechanisms were stress-tested empirically via full E2E test execution in a highly concurrent environment.

---

## 4. Conclusion

Worker 1 Gen 2's implementation contains critical flaws in TTY-scoped process killing (`killLingeringProcessesScoped`), mutex lock starvation (`acquireLock`), and unremoved `health_timeout` keys in `supabase/config.toml`. While `teardownSupabase()` and `TEST_READY.md` exit code propagation function correctly, the master E2E test runner cannot reliably achieve exit code 0 in a concurrent environment due to process elimination wars and lock starvation.

---

## 5. Verification Method

To independently verify these findings:

1. **Inspect `supabase/config.toml`**:
   - Verify `health_timeout = "5m"` at line 6 and `health_timeout = "10m"` at line 34.

2. **Inspect `e2e/run_e2e.ts`**:
   - Verify `killLingeringProcessesScoped` at lines 64-86 matches `pTty === myTty` without excluding active waiting test runners.
   - Verify `acquireLock` at lines 16-50 uses `execSync('sleep 5')`, creating a race condition for lock starvation.

3. **Execute Master E2E Test Runner in a Concurrent Environment**:
   ```bash
   export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/verify_global_market_data.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts && npx tsx e2e/verify_tier3_combinations.ts && npx tsx e2e/stress_test_m4.ts && npx tsx e2e/stress_test_m4_edge_cases.ts && npx tsx e2e/adv_planner_gaps.ts && node node_modules/.bin/tsx e2e/run_e2e.ts
   ```
   **Expected Result**: When running concurrently with another test runner under the same TTY, the process is killed with exit code 137 (`SIGKILL`). When waiting for multiple back-to-back test runners, it suffers from lock starvation and fails with exit code 1 after 5 minutes.
