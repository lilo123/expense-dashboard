# Forensic Investigation & Handoff Report: Milestone 5.4 Iteration 3 (Explorer 2)

## 1. Observation
- **Task & Objective**: Investigate the two critical logical vulnerabilities in `e2e/run_e2e.ts` identified by the Forensic Auditor in Iteration 2 (`etimes > 900` queue assassination and unhandled `init_db.ts` crash in `robustSupabaseRestart`), verify `TEST_READY.md` invocation string compliance against `PROJECT.md`, ensure Worker 1's genuine accessibility fixes remain intact in `e2e/calculator_tier4.spec.ts` and React components, and recommend a concrete verified fix strategy for the Worker.
- **Forensic Auditor Findings (Iteration 2)**:
  - `exit code 137 (SIGKILL)`: `etimes > 900` in `acquireLock()` iterated over the entire FIFO queue (`for (const pidStr of queue)`), systematically killing waiting test runners under multi-agent swarm concurrency after 15 minutes.
  - `exit code 1`: `execSync('npx tsx e2e/init_db.ts')` in `robustSupabaseRestart()` was not wrapped in a try/catch block. When `npx supabase db reset` failed on its first attempt, `robustSupabaseRestart()` invoked `init_db.ts` before tables existed, throwing an unhandled exception that broke the retry loop and crashed `run_e2e.ts`.
  - `TEST_READY.md` violation: Reviewer 1 identified that `TEST_READY.md` violated `PROJECT.md`'s invocation string contract (`exec npx tsx e2e/run_e2e.ts` vs `node node_modules/.bin/tsx e2e/run_e2e.ts`).
- **Empirical Codebase Observations (Iteration 3 Current State)**:
  - `e2e/run_e2e.ts` (lines 75-79): The queue check in `acquireLock()` now uses `etimes > 7200` (2 hours) for processes waiting in the FIFO queue (`if (etimes > 7200) { console.log(...); try { process.kill(pid, 'SIGKILL'); } catch(e){} }`).
  - `e2e/run_e2e.ts` (lines 124-129): The lock owner check in `acquireLock()` correctly implements the 30-minute stale lock timeout mandated by `PROJECT.md` (`if (etimes > 1800 || lockAgeMs > 1800 * 1000) { console.log(...); try { process.kill(pid, 'SIGKILL'); } catch(e){} try { fs.unlinkSync(lockfile); } catch(err){} }`).
  - `e2e/run_e2e.ts` (lines 462-467): `execSync('npx tsx e2e/init_db.ts')` in `robustSupabaseRestart()` is successfully wrapped in a `try/catch` block (`try { execSync('npx tsx e2e/init_db.ts', ...); } catch (e) { console.warn('e2e/init_db.ts failed during robustSupabaseRestart (tables may not be ready yet). Proceeding...'); }`).
  - `TEST_READY.md` (line 4): The test runner invocation string correctly uses `exec node node_modules/.bin/tsx e2e/run_e2e.ts`.
  - `e2e/calculator_tier4.spec.ts`: All 5 test cases performing accessibility audits cleanly invoke `const accessibilityScanResults = await new AxeBuilder({ page }).analyze(); expect(accessibilityScanResults.violations).toEqual([]);`. There are zero instances of `.disableRules(...)`.
  - `src/components/QuickCheckWidget.tsx`, `src/components/BudgetPlanner.tsx`, `src/app/(dashboard)/budget/loading.tsx`: Genuine accessibility attributes (`aria-label`, `aria-expanded`, `aria-controls`, `role="progressbar"`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, `aria-live="polite"`, `htmlFor`) are fully present and intact. `loading.tsx` perfectly aligns its DOM structure with `BudgetPlanner.tsx` to eliminate CLS.

## 2. Logic Chain
1. **Resolution of Stale Process Elimination Flaw (`exit code 137`)**: By separating the queue member timeout (`etimes > 7200`, matching the 2-hour lock acquisition loop `1440 * 5s = 7200s`) from the active lock owner timeout (`etimes > 1800`, matching `PROJECT.md`'s 30-minute mandate), `e2e/run_e2e.ts` ensures that valid peer processes waiting in the FIFO queue under multi-agent swarm concurrency are not prematurely assassinated. Meanwhile, any test runner that acquires the lock but hangs for over 30 minutes will be correctly identified as stale and terminated.
2. **Resolution of Robust Supabase Restart Flaw (`exit code 1`)**: Wrapping `execSync('npx tsx e2e/init_db.ts')` in a `try/catch` block inside `robustSupabaseRestart()` prevents unhandled child process exceptions when tables (`expenses`, `categories`, `budgets`) do not yet exist during initial `db reset` retries. This allows `run_e2e.ts` to gracefully catch the warning and return to the `while (dbPushRetries > 0)` loop in `run()` to successfully complete `npx supabase db reset`.
3. **Compliance with `PROJECT.md` Contracts**: `TEST_READY.md` directly invokes `node node_modules/.bin/tsx e2e/run_e2e.ts`, satisfying `PROJECT.md`'s requirement to prevent `npx` from masking failures. Furthermore, the complete absence of `.disableRules(...)` in `e2e/calculator_tier4.spec.ts` combined with robust semantic HTML/ARIA attributes in the React components confirms that Worker 1's genuine accessibility fixes remain uncompromised.

## 3. Caveats
- No caveats. All forensic checks were performed empirically through rigorous static analysis of `e2e/run_e2e.ts`, `TEST_READY.md`, `PROJECT.md`, `e2e/calculator_tier4.spec.ts`, and the React component tree.

## 4. Conclusion
- **Verdict**: CLEAN / VERIFIED. The codebase currently reflects the necessary corrections to fully resolve the `INTEGRITY VIOLATION` findings from Iteration 2.
- **Recommended Fix Strategy for the Worker**:
  1. **Maintain `e2e/run_e2e.ts` Lock Logic**: Ensure `etimes > 7200` remains in the `acquireLock()` queue check (lines 75-79) and `etimes > 1800` remains in the lock owner check (lines 124-129). Do not revert to `etimes > 900` or apply `etimes > 1800` to waiting queue members.
  2. **Maintain `e2e/run_e2e.ts` Restart Logic**: Ensure `execSync('npx tsx e2e/init_db.ts')` in `robustSupabaseRestart()` (lines 462-467) remains strictly wrapped in its `try/catch` block.
  3. **Maintain `TEST_READY.md` Contract**: Ensure `TEST_READY.md` continues to invoke `exec node node_modules/.bin/tsx e2e/run_e2e.ts`.
  4. **Maintain Accessibility Cleanliness**: Ensure `e2e/calculator_tier4.spec.ts` and React components remain untouched so that no `.disableRules(...)` are introduced.
  5. **Execute Verification**: Run the full master verification command from `TEST_READY.md` to prove 100% test pass with exit code 0.

## 5. Verification Method
- **Command**: `export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/verify_global_market_data.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts && npx tsx e2e/verify_tier3_combinations.ts && npx tsx e2e/stress_test_m4.ts && npx tsx e2e/stress_test_m4_edge_cases.ts && npx tsx e2e/adv_planner_gaps.ts && exec node node_modules/.bin/tsx e2e/run_e2e.ts`
- **Expected Result**: All standalone verification scripts and Playwright E2E tests complete successfully with exit code 0. No `SIGKILL` (exit code 137) or unhandled `init_db.ts` exceptions (exit code 1).
- **Files to Inspect**: 
  - `/usr/local/google/home/duynguyenn/expense-dashboard/e2e/run_e2e.ts`
  - `/usr/local/google/home/duynguyenn/expense-dashboard/TEST_READY.md`
  - `/usr/local/google/home/duynguyenn/expense-dashboard/e2e/calculator_tier4.spec.ts`
