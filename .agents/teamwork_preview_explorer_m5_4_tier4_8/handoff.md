# Handoff Report: Milestone 5.4 Surgical Fix Strategy (Iteration 3)

## 1. Observation
- **Task & Objective**: Analyze the Forensic Auditor's full evidence report and Reviewer/Challenger feedback from Iteration 2, investigate `e2e/run_e2e.ts` and `TEST_READY.md`, and recommend a surgical fix strategy for Milestone 5.4 (Tier 4 E2E Test Pass - Real-World Application Scenarios).
- **Forensic Auditor Evidence 1 (`exit code 137`)**: Under multi-agent swarm concurrency (`task-29`, `task-43`), E2E test runners waiting in the FIFO mutex queue (`/tmp/run_e2e.queue`) for > 15 minutes were terminated with `exit code 137` (`SIGKILL`).
- **Forensic Auditor Evidence 2 (`exit code 1`)**: When `npx supabase db reset` failed on its first attempt (`task-62`), `run_e2e.ts` caught the error and invoked `robustSupabaseRestart()`. Inside `robustSupabaseRestart()`, `run_e2e.ts` executed `execSync('npx tsx e2e/init_db.ts')`. `init_db.ts` failed after 30 retries because database migrations had not been applied yet (`Connected to Postgres but expenses table not ready yet`). The unhandled exception crashed `run_e2e.ts` with `exit code 1`.
- **`e2e/run_e2e.ts` Inspection**:
  - Lines 75-79 (`acquireLock` queue check): Checks `ps -o etimes= -p ${pid}` and executes `process.kill(pid, 'SIGKILL')` if `etimes > 900` (15 minutes) for any process in the FIFO queue.
  - Lines 124-129 (`acquireLock` lockfile check): Checks `etimes > 900` for the active lock file holder.
  - Lines 241-246 (`killLingeringProcessesScoped`): Checks `etimes > 900` for `run_e2e` processes and skips protecting them, allowing them to be killed.
  - Lines 461-462 (`robustSupabaseRestart`): Executes `execSync('npx tsx e2e/init_db.ts', ...)` without a try/catch block.
- **`TEST_READY.md` Inspection**:
  - Line 4: Specifies `... && exec npx tsx e2e/run_e2e.ts`.
- **`PROJECT.md` Inspection**:
  - Line 23: Explicit interface contract states: `- All test invocation strings must invoke node node_modules/.bin/tsx e2e/run_e2e.ts directly to prevent npx from masking failures.`
  - Line 26: Explicit interface contract states: `- acquireLock must include stale lock detection (process.kill(pid, 0)) and 30-minute timeout.`

## 2. Logic Chain
1. **Stale Process Elimination Flaw (`exit code 137`)**:
   - `acquireLock()` iterates over all PIDs in `/tmp/run_e2e.queue` (lines 75-79) and kills any process where `etimes > 900` (15 minutes). Under multi-agent swarm concurrency (e.g., 18 agents), processes waiting in the FIFO queue for earlier swarm instances to finish easily exceed 15 minutes of waiting time. Killing queued processes after 15 minutes causes cascading swarm assassination.
   - Furthermore, `etimes > 900` (15 minutes) violates `PROJECT.md`'s explicit 30-minute timeout contract (`etimes > 1800`) for the active lock holder (lines 124-129).
   - In `killLingeringProcessesScoped` (lines 241-246), `etimes > 900` causes active test runners waiting in the queue to lose their PID protection, resulting in them being killed during `npm run build`.
   - **Fix Strategy**: For queued processes in `acquireLock()` (line 76) and `killLingeringProcessesScoped` (line 242), increase the timeout to `etimes > 7200` (2 hours, matching `attempts = 1440` * 5s = 7200s). For the active lockfile holder in `acquireLock()` (line 125), increase the timeout to `etimes > 1800` (30 minutes) to strictly satisfy the `PROJECT.md` contract.
2. **Robust Supabase Restart Flaw (`exit code 1`)**:
   - `robustSupabaseRestart()` is invoked during `run()` when `npx supabase db reset` fails on its first attempt (lines 545-547). Because `db reset` has not succeeded yet, the database tables (`expenses`, `categories`, `budgets`) do not exist.
   - Executing `execSync('npx tsx e2e/init_db.ts')` at line 462 inside `robustSupabaseRestart()` before `db reset` succeeds guarantees failure. Because it is not wrapped in a try/catch block, the resulting exception breaks the `while (dbPushRetries > 0)` retry loop and crashes `run_e2e.ts`.
   - **Fix Strategy**: Remove lines 461-462 (`execSync('npx tsx e2e/init_db.ts', ...)`) entirely from `robustSupabaseRestart()`. `init_db.ts` is already correctly executed in `run()` at line 557 immediately after `db reset` succeeds, and is explicitly called during post-build health check recovery at line 622.
3. **`TEST_READY.md` Contract Violation**:
   - `TEST_READY.md` line 4 invokes `exec npx tsx e2e/run_e2e.ts`, which violates `PROJECT.md` line 23 requiring `node node_modules/.bin/tsx e2e/run_e2e.ts`.
   - **Fix Strategy**: Update `TEST_READY.md` line 4 to replace `exec npx tsx e2e/run_e2e.ts` with `exec node node_modules/.bin/tsx e2e/run_e2e.ts`.

## 3. Caveats
- No caveats. All forensic evidence, codebase inspections, and contract verifications were performed empirically through static analysis of `e2e/run_e2e.ts`, `TEST_READY.md`, `PROJECT.md`, and `SCOPE.md`.

## 4. Conclusion
- **Verdict & Recommendation**: The INTEGRITY VIOLATION observed in Iteration 2 is caused by two logical flaws in `e2e/run_e2e.ts` and one contract violation in `TEST_READY.md`. We recommend the following surgical fix strategy for the Worker agent:
  1. **`e2e/run_e2e.ts` (Stale Process Elimination)**:
     - Line 76: Change `if (etimes > 900)` to `if (etimes > 7200)` for queued processes.
     - Line 125: Change `if (etimes > 900)` to `if (etimes > 1800)` for the active lockfile holder.
     - Line 242: Change `if (etimes > 900)` to `if (etimes > 7200)` in `killLingeringProcessesScoped`.
  2. **`e2e/run_e2e.ts` (Robust Supabase Restart)**:
     - Lines 461-462: Delete `console.log('Executing e2e/init_db.ts...');` and `execSync('npx tsx e2e/init_db.ts', ...);` from `robustSupabaseRestart()`.
  3. **`TEST_READY.md` (Test Runner Contract)**:
     - Line 4: Change `exec npx tsx e2e/run_e2e.ts` to `exec node node_modules/.bin/tsx e2e/run_e2e.ts`.

## 5. Verification Method
- **Command**: `export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/verify_global_market_data.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts && npx tsx e2e/verify_tier3_combinations.ts && npx tsx e2e/stress_test_m4.ts && npx tsx e2e/stress_test_m4_edge_cases.ts && npx tsx e2e/adv_planner_gaps.ts && exec node node_modules/.bin/tsx e2e/run_e2e.ts`
- **Expected Result**: All tests pass successfully with exit code 0. No `exit code 137` under swarm concurrency, and no `exit code 1` during `db reset` retries.
- **Files to Inspect**:
  - `/usr/local/google/home/duynguyenn/expense-dashboard/e2e/run_e2e.ts`
  - `/usr/local/google/home/duynguyenn/expense-dashboard/TEST_READY.md`
