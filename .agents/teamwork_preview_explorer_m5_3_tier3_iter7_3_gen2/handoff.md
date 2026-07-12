# Handoff Report: Milestone 5.3 Investigation & Concrete Fix Strategy (Tier 3 E2E Explorer 3, Iteration 7, Gen 2)

## Executive Summary
This report investigates the Forensic Auditor's `INTEGRITY VIOLATION` verdict and Reviewer 1 & 2 `REQUEST_CHANGES` vetoes from Iteration 6. Through rigorous code inspection and synthesis of peer analyses, we identified the exact root causes across `e2e/run_e2e.ts` and `supabase/config.toml`. We provide a concrete, actionable 3-part fix strategy for the Worker to achieve a 100% passing Tier 3 E2E test suite (Cross-Feature Combinations) with exit code 0.

---

## 1. Observation

### A. Next.js Webpack Out-Of-Memory (OOM) Crash (`e2e/run_e2e.ts`)
- **Auditor Finding (Iteration 6)**: The master E2E test runner failed during `npm run build` with `FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory`.
- **Direct Observation**: Inspection of `e2e/run_e2e.ts` at line 380 reveals that `npm run build` is explicitly invoked with a severely restricted V8 heap limit:
  ```typescript
  380:     execSync('npm run build', { stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=512' } });
  ```
  This 512MB limit starves the Next.js webpack production build of memory, deterministically causing the OOM crash.

### B. Concurrent Process Elimination War (`e2e/run_e2e.ts`)
- **Reviewer 1 Finding (Iteration 6)**: `killLingeringProcessesScoped` kills concurrent waiting test runners sharing the same TTY with `kill -9` (exit code 137), violating multi-tenant co-existence.
- **Direct Observation**: Inspection of `e2e/run_e2e.ts` lines 66-104 (`killLingeringProcessesScoped`) shows that it filters target PIDs solely by matching TTY (`pTty === myTty`) and excluding its own direct ancestors (`ancestorPids.has(pid)`):
  ```typescript
  90:     const pidsToKill = pids.filter(pid => {
  91:       if (ancestorPids.has(pid)) return false;
  92:       try {
  93:         const pTty = execSync(`ps -p ${pid} -o tty= 2>/dev/null || true`, { encoding: 'utf-8' }).trim();
  94:         return pTty === myTty;
  95:       } catch (e) {
  96:         return false;
  97:       }
  98:     });
  ```
  When invoked at line 377 (`killLingeringProcessesScoped('node.*run_e2e|tsx.*run_e2e')`) and line 384 (`killLingeringProcessesScoped('node|tsx|jest|webpack')`), it identifies any concurrent `run_e2e` instance waiting for the mutex lock (`/tmp/run_e2e.lock`) in the same TTY as a "lingering process" and terminates it with `kill -9`.

### C. Fatal Supabase CLI Configuration Error (`supabase/config.toml`)
- **Reviewer 2 Finding (Iteration 6)**: Supabase CLI 2.109.0 fails instantly during `npx supabase start` with `failed to parse config: decoding failed... has invalid keys: health_timeout`.
- **Direct Observation**: Inspection of `supabase/config.toml` at line 33 (under the `[db]` table) reveals the explicit presence of `health_timeout`:
  ```toml
  32: # Maximum amount of time to wait for health check when starting the local database.
  33: health_timeout = "10m"
  ```
  In Supabase CLI 2.109.0, `health_timeout` is an invalid/unsupported key. Its presence causes Viper decoding to fail instantly, aborting the E2E test runner during the setup phase.

---

## 2. Logic Chain

1. **Supabase Startup Blocker**: Supabase CLI 2.109.0 enforces strict schema validation via Viper. Because `health_timeout = "10m"` exists at line 33 of `supabase/config.toml`, `npx supabase start` aborts with a fatal decoding error. This prevents the local database from starting, failing all subsequent health checks and blocking E2E test execution.
2. **Next.js Build Starvation**: Even if Supabase starts successfully (e.g., in environments where a separate instance is already running), `e2e/run_e2e.ts` line 380 forces `npm run build` to execute with `NODE_OPTIONS: '--max-old-space-size=512'`. The Next.js webpack compilation requires significantly more heap space than 512MB, leading directly to the `JavaScript heap out of memory` fatal error observed by the Forensic Auditor.
3. **Fratricidal Concurrency Flaw**: In a multi-tenant agent workspace, multiple test runners operate concurrently under the same TTY. While `acquireLock()` correctly implements a file-based mutex (`/tmp/run_e2e.lock`) to allow concurrent runners to wait patiently, `killLingeringProcessesScoped` undermines this entirely. By aggressively killing all matching PIDs in the same TTY, the active test runner terminates waiting peer runners with `kill -9` (exit code 137). This accounts for Reviewer 1's `REQUEST_CHANGES` veto and the finding of self-certifying work.
4. **Synthesis & Remediation**: To achieve a clean E2E test pass and satisfy all auditing/review criteria, a surgical 3-part fix must be implemented by the Worker:
   - Remove `health_timeout` from `supabase/config.toml`.
   - Increase `--max-old-space-size` to `4096` for `npm run build` in `e2e/run_e2e.ts`.
   - Add an explicit exclusion for `run_e2e` processes in `killLingeringProcessesScoped` in `e2e/run_e2e.ts`.

---

## 3. Caveats

- **Read-Only Exploration**: As an Explorer agent, we are strictly constrained to read-only investigation (`Do NOT modify any source code, configuration files, or test scripts`). Therefore, the proposed fixes must be implemented by the Worker agent in the next phase of the loop.
- **Playwright Tests Pending Backend Fixes**: Because the Supabase CLI configuration error and Next.js build OOM prevent the server from initializing successfully, the underlying Playwright UI tests (`npx playwright test`) could not be executed during this exploration. They will be verified once the Worker applies the fix strategy.

---

## 4. Conclusion

The Forensic Auditor's `INTEGRITY VIOLATION` verdict and Reviewer 1 & 2 `REQUEST_CHANGES` vetoes are fully substantiated. The failures stem from three precise, deterministic flaws in `supabase/config.toml` and `e2e/run_e2e.ts`. 

### Concrete Fix Strategy for the Worker (Milestone 5.3)

The Worker must implement the following three surgical modifications:

1. **Fix Supabase CLI Decoding Error (`supabase/config.toml`)**:
   - **Action**: Completely remove line 33 (`health_timeout = "10m"`) from `supabase/config.toml`.

2. **Fix Next.js Webpack OOM Crash (`e2e/run_e2e.ts`)**:
   - **Action**: Modify line 380 of `e2e/run_e2e.ts` to increase `--max-old-space-size` from `512` to `4096`.
   - **Before**:
     ```typescript
     execSync('npm run build', { stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=512' } });
     ```
   - **After**:
     ```typescript
     execSync('npm run build', { stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=4096' } });
     ```

3. **Fix Concurrent Process Elimination War (`e2e/run_e2e.ts`)**:
   - **Action**: Modify `killLingeringProcessesScoped` in `e2e/run_e2e.ts` (lines 90-98) to inspect process arguments (`ps -p ${pid} -o args=`) and explicitly exclude any process whose command line contains `run_e2e`.
   - **Before**:
     ```typescript
     const pidsToKill = pids.filter(pid => {
       if (ancestorPids.has(pid)) return false;
       try {
         const pTty = execSync(`ps -p ${pid} -o tty= 2>/dev/null || true`, { encoding: 'utf-8' }).trim();
         return pTty === myTty;
       } catch (e) {
         return false;
       }
     });
     ```
   - **After**:
     ```typescript
     const pidsToKill = pids.filter(pid => {
       if (ancestorPids.has(pid)) return false;
       try {
         const pArgs = execSync(`ps -p ${pid} -o args= 2>/dev/null || true`, { encoding: 'utf-8' }).trim();
         if (pArgs.includes('run_e2e')) return false;
         const pTty = execSync(`ps -p ${pid} -o tty= 2>/dev/null || true`, { encoding: 'utf-8' }).trim();
         return pTty === myTty;
       } catch (e) {
         return false;
       }
     });
     ```

---

## 5. Verification Method

To independently verify the baseline failures and validate the fixes once implemented:

1. **Verify Baseline Failures (Current State)**:
   - Inspect `supabase/config.toml` at line 33 to confirm `health_timeout = "10m"`.
   - Inspect `e2e/run_e2e.ts` at line 380 to confirm `NODE_OPTIONS: '--max-old-space-size=512'`.
   - Inspect `e2e/run_e2e.ts` at lines 90-98 to confirm `killLingeringProcessesScoped` lacks `run_e2e` exclusion.
   - Execute `node node_modules/.bin/tsx e2e/run_e2e.ts`. Observe Supabase CLI failure (`invalid keys: health_timeout`) or Next.js build OOM (`JavaScript heap out of memory`).

2. **Verify Fix Implementation (Post-Worker State)**:
   - Inspect `supabase/config.toml` to ensure `health_timeout` is completely absent.
   - Inspect `e2e/run_e2e.ts` to ensure line 380 uses `--max-old-space-size=4096` and `killLingeringProcessesScoped` includes `if (pArgs.includes('run_e2e')) return false;`.

3. **Execute Master E2E Test Runner**:
   ```bash
   export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/verify_global_market_data.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts && npx tsx e2e/verify_tier3_combinations.ts && npx tsx e2e/stress_test_m4.ts && npx tsx e2e/stress_test_m4_edge_cases.ts && npx tsx e2e/adv_planner_gaps.ts && node node_modules/.bin/tsx e2e/run_e2e.ts
   ```
   - **Expected Result**: All standalone verification scripts pass. `run_e2e.ts` successfully starts Supabase, runs jest tests, seeds data, builds Next.js without OOM, executes Playwright tests successfully across all browsers, and exits with code 0. Concurrent `run_e2e` instances waiting in the same TTY remain alive and acquire the lock sequentially.
