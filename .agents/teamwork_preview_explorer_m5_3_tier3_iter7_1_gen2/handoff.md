# Handoff Report: Tier 3 E2E Explorer 1 (Iteration 7, Gen 2)

**Work Product**: Investigation of Forensic Auditor's INTEGRITY VIOLATION verdict and Reviewer 1 & 2 REQUEST_CHANGES vetoes from Iteration 6, with concrete fix strategy for Milestone 5.3.
**Profile**: General Project
**Status**: COMPLETE (Ready for Worker Implementation)

---

## 1. Observation

### A. Forensic Auditor Finding (`e2e/run_e2e.ts`)
- **Reported Issue**: Auditor 1 in Iteration 6 observed that `node node_modules/.bin/tsx e2e/run_e2e.ts` failed during `npm run build` with `FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory`.
- **Direct Observation**: Inspection of `e2e/run_e2e.ts` reveals that line 380 explicitly sets `NODE_OPTIONS: '--max-old-space-size=512'`:
  ```typescript
  380:     execSync('npm run build', { stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=512' } });
  ```
- **Execution Impact**: Restricting the V8 heap size to 512MB during `npm run build` starves the Next.js 16.2.4 webpack production build of memory, deterministically causing an Out-Of-Memory (OOM) crash and aborting the E2E test suite.

### B. Reviewer 1 Finding (`e2e/run_e2e.ts`)
- **Reported Issue**: Reviewer 1 in Iteration 6 observed that `killLingeringProcessesScoped` kills concurrent waiting test runners sharing the same TTY with `kill -9` (exit code 137).
- **Direct Observation**: Inspection of `e2e/run_e2e.ts` lines 66-104 (`killLingeringProcessesScoped`) shows that it finds all PIDs matching `pattern`, filters them by `pTty === myTty`, excludes its own PID and PPID (and ancestors), and executes `kill -9` on the remaining PIDs:
  ```typescript
  89:     const pids = execSync(`pgrep -f "${pattern}" 2>/dev/null || true`, { encoding: 'utf-8' }).split('\n').map(p => p.trim()).filter(Boolean).map(Number);
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
  Furthermore, `killLingeringProcessesScoped` is invoked at line 377 with `node.*run_e2e|tsx.*run_e2e` and at line 384 with `node|tsx|jest|webpack`.
- **Execution Impact**: In a concurrent multi-tenant agent environment where multiple tasks share the same TTY (`pts/0`), when an active test runner reaches line 377 or 384, it identifies all other waiting `run_e2e` instances (which are waiting for the mutex lock `/tmp/run_e2e.lock` in `acquireLock()`) as targets and terminates them with `kill -9`.

### C. Reviewer 2 Finding (`supabase/config.toml`)
- **Reported Issue**: Reviewer 2 in Iteration 6 observed that `health_timeout = "5m"` remained in `supabase/config.toml`, causing Supabase CLI 2.109.0 to fail instantly with `'config.config' has invalid keys: health_timeout`.
- **Direct Observation**: Inspection of `supabase/config.toml` reveals `health_timeout = "10m"` explicitly present at line 33 under the `[db]` table:
  ```toml
  27: [db]
  28: # Port to use for the local database URL.
  29: port = 25432
  30: # Port used by db diff command to initialize the shadow database.
  31: shadow_port = 54320
  32: # Maximum amount of time to wait for health check when starting the local database.
  33: health_timeout = "10m"
  ```
- **Execution Impact**: Supabase CLI 2.109.0 uses Viper to unmarshal `config.toml` with strict key validation. `health_timeout` is an invalid/unsupported key in this version of the Supabase CLI schema. Its presence causes `npx supabase start` to fail instantly with a fatal decoding error (`'config.config' has invalid keys: health_timeout`), preventing Supabase from starting and breaking the entire E2E test runner during the `setup()` phase.

---

## 2. Logic Chain

1. **Supabase CLI Viper Decoding Failure**: Because `health_timeout` is present in `supabase/config.toml` (line 33), Supabase CLI 2.109.0 rejects the configuration file during `npx supabase start`. This prevents the local Supabase Docker containers from starting, causing subsequent health checks (`http://127.0.0.1:54321`) to fail and aborting `run_e2e.ts`. Removing `health_timeout` entirely is required for Supabase to start cleanly.
2. **Next.js Webpack OOM Crash**: Once Supabase starts successfully and the test runner reaches the Next.js build phase (`npm run build`), the explicit `NODE_OPTIONS: '--max-old-space-size=512'` at line 380 restricts the V8 heap to 512MB. Next.js webpack optimization requires significantly more memory, leading to `JavaScript heap out of memory`. Increasing `--max-old-space-size` to `4096` provides sufficient headroom for the production bundle to compile successfully.
3. **Fratricidal Concurrency Flaw**: In `killLingeringProcessesScoped`, filtering solely by `pTty === myTty` fails to distinguish between orphaned worker processes (e.g., lingering jest/webpack workers) and valid concurrent test runners (`run_e2e.ts`) waiting for the mutex lock in `acquireLock()`. When `killLingeringProcessesScoped('node.*run_e2e|tsx.*run_e2e')` is executed at line 377, it actively hunts down and kills peer test runners. By adding explicit command-line filtering (`ps -p ${pid} -o args=`) to exclude any process whose arguments contain `run_e2e`, `verify_`, `stress_test_`, or `adv_`, we ensure perfect multi-tenant co-existence without process elimination wars.

---

## 3. Caveats

- **Read-Only Exploration**: As an Explorer agent, we are strictly constrained to read-only analysis and cannot modify the files or execute state-modifying commands (`blaze build`, `blaze test`, `npm run`) directly.
- **Playwright Tests Pending Verification**: Because the E2E test runner currently fails during `npx supabase start` (due to `health_timeout`) and `npm run build` (due to OOM), the underlying Playwright UI tests (`npx playwright test`) have not yet been executed in this iteration. They will be verified once the Worker implements the recommended fixes.

---

## 4. Conclusion

The Forensic Auditor's `INTEGRITY VIOLATION` verdict and Reviewer 1 & 2 `REQUEST_CHANGES` vetoes are fully substantiated by direct observation of the codebase. To achieve a 100% passing Tier 3 E2E test suite for Milestone 5.3, the Worker must implement a precise, 3-part surgical fix strategy:

### Concrete Fix Strategy for Worker 1 (Iteration 7, Gen 2)

#### 1. Fix Supabase CLI Configuration (`supabase/config.toml`)
- **Target File**: `supabase/config.toml`
- **Action**: Completely remove line 33 (`health_timeout = "10m"`).
- **Rationale**: Eliminates the Viper decoding error (`'config.config' has invalid keys: health_timeout`) in Supabase CLI 2.109.0, allowing `npx supabase start` to execute successfully.

#### 2. Fix Next.js Webpack OOM Crash (`e2e/run_e2e.ts`)
- **Target File**: `e2e/run_e2e.ts`
- **Action**: Modify line 380 to increase `--max-old-space-size` from `512` to `4096`.
  ```typescript
  // Before (Line 380)
  execSync('npm run build', { stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=512' } });

  // After
  execSync('npm run build', { stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=4096' } });
  ```
- **Rationale**: Provides the Next.js webpack compiler with 4GB of heap memory, preventing `JavaScript heap out of memory` fatal errors during production bundle generation.

#### 3. Fix Fratricidal Process Termination (`e2e/run_e2e.ts`)
- **Target File**: `e2e/run_e2e.ts`
- **Action**: Modify `killLingeringProcessesScoped` (lines 90-98) to inspect the command line arguments of each PID and explicitly exclude any process matching `run_e2e`, `verify_`, `stress_test_`, or `adv_`.
  ```typescript
  // Before (Lines 90-98)
  const pidsToKill = pids.filter(pid => {
    if (ancestorPids.has(pid)) return false;
    try {
      const pTty = execSync(`ps -p ${pid} -o tty= 2>/dev/null || true`, { encoding: 'utf-8' }).trim();
      return pTty === myTty;
    } catch (e) {
      return false;
    }
  });

  // After
  const pidsToKill = pids.filter(pid => {
    if (ancestorPids.has(pid)) return false;
    try {
      const args = execSync(`ps -p ${pid} -o args= 2>/dev/null || true`, { encoding: 'utf-8' }).trim();
      if (args.includes('run_e2e') || args.includes('verify_') || args.includes('stress_test_') || args.includes('adv_')) {
        return false;
      }
      const pTty = execSync(`ps -p ${pid} -o tty= 2>/dev/null || true`, { encoding: 'utf-8' }).trim();
      return pTty === myTty;
    } catch (e) {
      return false;
    }
  });
  ```
- **Rationale**: Protects concurrent test runners waiting for the mutex lock `/tmp/run_e2e.lock` in the same TTY, ensuring robust multi-tenant co-existence.

---

## 5. Verification Method

To independently verify the fixes once implemented by the Worker:

1. **Inspect Modified Files**:
   - `supabase/config.toml`: Verify `health_timeout` is completely absent.
   - `e2e/run_e2e.ts`: Verify line 380 contains `NODE_OPTIONS: '--max-old-space-size=4096'`. Verify `killLingeringProcessesScoped` includes the `args.includes('run_e2e')` exclusion logic.

2. **Execute Master E2E Test Runner**:
   ```bash
   export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/verify_global_market_data.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts && npx tsx e2e/verify_tier3_combinations.ts && npx tsx e2e/stress_test_m4.ts && npx tsx e2e/stress_test_m4_edge_cases.ts && npx tsx e2e/adv_planner_gaps.ts && node node_modules/.bin/tsx e2e/run_e2e.ts
   ```
   **Expected Result**: All standalone verification scripts pass. `run_e2e.ts` successfully starts Supabase without Viper decoding errors, completes `npm run build` without OOM errors, does not kill concurrent test runners, and successfully executes the Playwright E2E test suite, exiting with code 0.
