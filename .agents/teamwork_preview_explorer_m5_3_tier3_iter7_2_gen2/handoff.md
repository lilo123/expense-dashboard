# Handoff Report: Milestone 5.3 Investigation & Concrete Fix Strategy (Tier 3 E2E Explorer 2, Iteration 7, Gen 2)

## Executive Summary
An in-depth investigation was conducted into the Forensic Auditor's `INTEGRITY VIOLATION` verdict and Reviewer 1 & 2 `REQUEST_CHANGES` vetoes from Iteration 6. The investigation identified three distinct root causes preventing Milestone 5.3 from achieving a successful 100% E2E test pass:
1. **Next.js Build OOM Crash**: `e2e/run_e2e.ts` restricts `npm run build` to `NODE_OPTIONS: '--max-old-space-size=512'`, starving the Webpack compiler of memory.
2. **Fratricidal Process Termination**: `e2e/run_e2e.ts` executes `killLingeringProcessesScoped`, which forcibly terminates (`kill -9`) concurrent `run_e2e` test runners waiting for the mutex lock in the same TTY.
3. **Supabase CLI Viper Decoding Failure**: `supabase/config.toml` contains an unsupported `health_timeout` key under `[db]`, causing Supabase CLI 2.109.0 to abort instantly during `npx supabase start`.

A concrete, surgical 3-part fix strategy is provided below for the Worker to implement.

---

## 1. Observation

### A. Next.js Build Memory Starvation (`e2e/run_e2e.ts`)
- **File Path**: `/usr/local/google/home/duynguyenn/expense-dashboard/e2e/run_e2e.ts`
- **Line Number**: Line 380
- **Direct Observation**: Line 380 explicitly invokes the Next.js production build with a severely restricted V8 heap limit:
  ```typescript
  execSync('npm run build', { stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=512' } });
  ```
- **Verbatim Error**: As documented in the Forensic Auditor's report (`.agents/teamwork_preview_auditor_m5_3_tier3_iter6_1_gen2/handoff.md`), this memory restriction causes Webpack to crash with a fatal Out-Of-Memory error:
  ```
  FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory
  ```

### B. Fratricidal Process Termination (`e2e/run_e2e.ts`)
- **File Path**: `/usr/local/google/home/duynguyenn/expense-dashboard/e2e/run_e2e.ts`
- **Line Numbers**: Lines 66-104 (`killLingeringProcessesScoped`), Line 377, and Line 384.
- **Direct Observation**:
  - `killLingeringProcessesScoped(pattern)` uses `pgrep -f "${pattern}"` to find matching PIDs, filters them by `pTty === myTty`, excludes its own PID and PPID (`ancestorPids`), and executes `kill -9` on all remaining PIDs (Lines 90-101).
  - Line 377 explicitly invokes: `killLingeringProcessesScoped('node.*run_e2e|tsx.*run_e2e');`
  - Line 384 explicitly invokes: `killLingeringProcessesScoped('node|tsx|jest|webpack');`
- **Verbatim Error**: As documented in Reviewer 1's report (`.agents/teamwork_preview_reviewer_m5_3_tier3_iter6_1_gen2/handoff.md`), when an active test runner reaches Line 377 or Line 384, it identifies all concurrent `run_e2e` instances waiting in `acquireLock()` within the same TTY as "lingering" processes and terminates them with `kill -9` (exit code 137).

### C. Supabase CLI Viper Decoding Failure (`supabase/config.toml`)
- **File Path**: `/usr/local/google/home/duynguyenn/expense-dashboard/supabase/config.toml`
- **Line Number**: Line 33
- **Direct Observation**: Under the `[db]` table, Line 33 explicitly defines:
  ```toml
  health_timeout = "10m"
  ```
- **Verbatim Error**: As documented in Reviewer 2's report (`.agents/teamwork_preview_reviewer_m5_3_tier3_iter6_2_gen2/handoff.md`), Supabase CLI 2.109.0 uses Viper for strict configuration decoding and rejects this key instantly during `npx supabase start --debug`:
  ```
  failed to parse config: decoding failed due to the following error(s):
                                                                        
  'config.config' has invalid keys: health_timeout                      
  Supabase start failed. Performing one final clean teardown and retry...
  ```

---

## 2. Logic Chain

1. **OOM Crash Mechanism**: Next.js 16.2.4 uses Webpack for creating an optimized production build. This process is highly memory-intensive. Restricting the Node.js heap to 512MB (`--max-old-space-size=512`) at line 380 deterministically triggers V8's fatal OOM abort (`Ineffective mark-compacts near heap limit`). Increasing this limit to `4096` will provide Webpack with sufficient memory to complete the build successfully.
2. **Concurrency Collision Mechanism**: In a multi-tenant agent verification environment, multiple test runners operate concurrently under the same TTY (`pts/0`). While `acquireLock()` correctly implements a file-based mutex (`/tmp/run_e2e.lock`) where secondary runners sleep and wait, the primary runner's invocation of `killLingeringProcessesScoped('node.*run_e2e|tsx.*run_e2e')` at line 377 actively hunts down and kills those waiting runners. Furthermore, `killLingeringProcessesScoped('node|tsx|jest|webpack')` at line 384 also matches `node` and `tsx` executing `run_e2e`. To achieve genuine multi-tenant co-existence, `killLingeringProcessesScoped` must inspect the arguments of each target PID (`ps -p ${pid} -o args=`) and explicitly exempt any process containing `run_e2e`. Additionally, line 377 must be removed entirely.
3. **Supabase CLI Abortion Mechanism**: Supabase CLI 2.109.0 enforces a strict schema for `config.toml`. `health_timeout` is an unrecognized key in this schema version. When `npx supabase start` is executed at line 181 of `run_e2e.ts`, Viper throws a fatal decoding error (`'config.config' has invalid keys: health_timeout`), causing Supabase startup to fail. Consequently, all subsequent database health checks, resets, seeds, and Next.js server startups fail, preventing Playwright from running. Completely removing `health_timeout = "10m"` from `supabase/config.toml` will allow Supabase to start cleanly.

---

## 3. Caveats

- **Playwright E2E Tests Unverified in Iteration 6**: Because the E2E test runner in Iteration 6 aborted during Supabase startup (`supabase/config.toml` error) and Next.js build (`OOM` error), the underlying Playwright UI test suite (`npx playwright test`) was never launched. Once the three blocking issues are resolved by the Worker, the Playwright tests will execute.

---

## 4. Conclusion

The Forensic Auditor's `INTEGRITY VIOLATION` verdict and Reviewer 1 & 2 `REQUEST_CHANGES` vetoes are fully substantiated. To achieve a successful Milestone 5.3 E2E test pass with exit code 0, the Worker must implement the following concrete, surgical 3-part fix strategy:

### Concrete Fix Strategy for Worker

#### Fix 1: Resolve Next.js Build OOM Crash (`e2e/run_e2e.ts`)
- **Target File**: `/usr/local/google/home/duynguyenn/expense-dashboard/e2e/run_e2e.ts`
- **Target Line**: Line 380
- **Action**: Increase `--max-old-space-size=512` to `--max-old-space-size=4096`.
- **Replacement Chunk**:
  ```typescript
  // Before (Line 380)
  execSync('npm run build', { stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=512' } });

  // After
  execSync('npm run build', { stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=4096' } });
  ```

#### Fix 2: Prevent Fratricidal Process Termination (`e2e/run_e2e.ts`)
- **Target File**: `/usr/local/google/home/duynguyenn/expense-dashboard/e2e/run_e2e.ts`
- **Target Lines**: Lines 90-98 (`killLingeringProcessesScoped`) and Line 377.
- **Action**: Modify `killLingeringProcessesScoped` to explicitly filter out any process whose command line arguments contain `run_e2e`, and delete Line 377.
- **Replacement Chunk 1 (Lines 90-98)**:
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
        const pArgs = execSync(`ps -p ${pid} -o args= 2>/dev/null || true`, { encoding: 'utf-8' }).trim();
        if (pArgs.includes('run_e2e')) return false;
        const pTty = execSync(`ps -p ${pid} -o tty= 2>/dev/null || true`, { encoding: 'utf-8' }).trim();
        return pTty === myTty;
      } catch (e) {
        return false;
      }
    });
  ```
- **Replacement Chunk 2 (Line 377)**:
  ```typescript
  // Before (Line 377)
    killLingeringProcessesScoped('node.*run_e2e|tsx.*run_e2e');

  // After
    // Removed killLingeringProcessesScoped('node.*run_e2e|tsx.*run_e2e') to prevent killing concurrent test runners
  ```

#### Fix 3: Remove Invalid Supabase Configuration Key (`supabase/config.toml`)
- **Target File**: `/usr/local/google/home/duynguyenn/expense-dashboard/supabase/config.toml`
- **Target Line**: Line 33
- **Action**: Completely remove `health_timeout = "10m"`.
- **Replacement Chunk**:
  ```toml
  // Before (Lines 32-34)
  # Maximum amount of time to wait for health check when starting the local database.
  health_timeout = "10m"
  # The database major version to use. This has to be the same as your remote database's. Run `SHOW

  // After
  # Maximum amount of time to wait for health check when starting the local database.
  # The database major version to use. This has to be the same as your remote database's. Run `SHOW
  ```

---

## 5. Verification Method

To independently verify the success of the fixes once implemented by the Worker:

1. **Inspect Modified Files**:
   - `supabase/config.toml`: Verify `health_timeout` is completely absent.
   - `e2e/run_e2e.ts`: Verify `killLingeringProcessesScoped` includes `if (pArgs.includes('run_e2e')) return false;`. Verify line 380 uses `--max-old-space-size=4096`.

2. **Execute Master E2E Test Runner**:
   ```bash
   export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/verify_global_market_data.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts && npx tsx e2e/verify_tier3_combinations.ts && npx tsx e2e/stress_test_m4.ts && npx tsx e2e/stress_test_m4_edge_cases.ts && npx tsx e2e/adv_planner_gaps.ts && node node_modules/.bin/tsx e2e/run_e2e.ts
   ```
   **Expected Result**: Supabase CLI starts cleanly without Viper decoding errors. `npm run build` completes successfully without OOM aborts. Concurrent test runners safely wait for `/tmp/run_e2e.lock` without being terminated. Playwright E2E tests execute and pass with exit code 0.
