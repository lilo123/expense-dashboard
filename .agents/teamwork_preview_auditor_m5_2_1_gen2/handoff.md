# Handoff Report: Forensic Integrity Verification of M5.2 Worker Gen 2 Remediation

## Forensic Audit Report

**Work Product**: Worker Gen 2 Remediation Implementation for Milestone 5.2 (`e2e/run_e2e.ts`, `e2e/init_db.ts`, and E2E test suite)
**Profile**: General Project
**Verdict**: INTEGRITY VIOLATION

### Phase Results
- **Hardcoded output detection**: PASS — Inspected `e2e/verify_global_market_data.ts`, `e2e/verify_accumulation.ts`, `e2e/verify_monte_carlo.ts`, `e2e/stress_test_m4.ts`, `e2e/stress_test_m4_edge_cases.ts`, `e2e/adv_planner_gaps.ts`, and `src/lib/planner/*.ts`. No hardcoded test results, expected outputs, or verification strings were found.
- **Facade detection**: PASS — Inspected `src/lib/planner/drawdownEngine.ts`, `src/lib/planner/pensionEngine.ts`, `src/lib/planner/simulator.ts`, and `src/lib/planner/taxEngine.ts`. All business logic engines contain genuine, fully implemented algorithms for tax brackets, pension clawbacks, and Scrambled Monte Carlo simulation.
- **Pre-populated artifact detection**: PASS — Executed `code_search` for `f:(\.log$|result|output)`. No pre-populated log files, result files, or verification artifacts exist in the project workspace.
- **Build and run**: FAIL — Executed the master E2E test runner command (`export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/verify_global_market_data.ts && ... && npx tsx e2e/run_e2e.ts`). While all standalone verification scripts passed successfully, `e2e/run_e2e.ts` failed with exit code 1 due to Supabase Docker container conflicts (`Conflict. The container name "/supabase_db_expense-dashboard" is already in use`), preventing the Playwright E2E tests from executing.
- **Output verification**: PASS — Standalone verification scripts (`adv_planner_gaps.ts`, `verify_monte_carlo.ts`, etc.) produce correct mathematical outputs for OAS clawbacks, cost basis tracking, and PRNG determinism.
- **Dependency audit**: PASS — Core simulation, drawdown, tax, and pension logic are implemented natively in TypeScript without unauthorized delegation to third-party packages.

### Evidence
```
Starting database...
Stopping containers...
Pruned containers: []
Pruned volumes: [supabase_db_expense-dashboard]
Pruned network: []
2026/07/07 06:10:05 HTTP POST: https://eu.i.posthog.com/batch/
failed to create docker container: Error response from daemon: Conflict. The container name "/supabase_db_expense-dashboard" is already in use by container "0c1a313c8b41e151a5e67c999b56e5eae41abdfdcc616f44a6fb645daeab0f8a". You have to remove (or rename) that container to be able to reuse that name.
Supabase start attempt 1 failed. Checking status and cleaning up before retry...
supabase_db_expense-dashboard container is not ready: starting
Try rerunning the command with --debug to troubleshoot the error.
Supabase status check failed.
...
Supabase start attempt 2 failed. Checking status and cleaning up before retry...
failed to inspect container health: Error response from daemon: No such container: supabase_db_expense-dashboard
...
Supabase start attempt 3 failed. Checking status and cleaning up before retry...
supabase_db_expense-dashboard container is not ready: starting
...
Failed to start Supabase after 3 attempts.
```

---

## Coverage Audit Summary

- Features in matrix: 6
- Features covered by existing tests: 5 (5/6 = 83.3%)
- Uncovered features: 1 (Supabase Realtime & E2E Playwright Execution fails during setup)
- Adversarial tests written: 2 (`e2e/adv_planner_gaps.ts` containing Test 1 & Test 2)
- Adversarial tests that exposed failures: 0 (Both adversarial test cases pass successfully; failure occurs in E2E runner setup)

## Feature Matrix

| Feature | Source | Category | Test File(s) | Covered? |
|---------|--------|----------|--------------|:--------:|
| F1: Global Market Data Toggle | `TEST_READY.md` | Market Data | `e2e/verify_global_market_data.ts`, `e2e/stress_test_m4.ts` | ✅ Yes |
| F2: Accumulation Phase & Timeline Toggle | `TEST_READY.md` | Timeline | `e2e/verify_accumulation.ts`, `e2e/stress_test_m4.ts` | ✅ Yes |
| F3: Simulation Mode Toggle (Monte Carlo) | `TEST_READY.md` | Simulation | `e2e/verify_monte_carlo.ts`, `e2e/stress_test_m4.ts` | ✅ Yes |
| F4: OAS Clawback & Drawdown Logic | `PROJECT.md` | Business Logic | `e2e/adv_planner_gaps.ts` | ✅ Yes |
| F5: Taxable Account Drawdown Taxation | `PROJECT.md` | Business Logic | `e2e/adv_planner_gaps.ts` | ✅ Yes |
| F6: Supabase Realtime & E2E Playwright Execution | `PROJECT.md` | E2E Runner | `e2e/run_e2e.ts` | ❌ No (Fails) |

## Gap Report

| Feature | Severity | Why it matters |
|---------|----------|----------------|
| F6: Supabase Realtime & E2E Playwright Execution | High | `e2e/run_e2e.ts` fails to start Supabase cleanly due to Docker container conflicts (`Conflict. The container name "/supabase_db_expense-dashboard" is already in use`). As a result, the Next.js server and Playwright E2E test suite never execute, leaving the application unverified in a full runtime environment. |

## Adversarial Test Results

| Test File | Feature Targeted | Reference | Product | Verdict |
|-----------|------------------|-----------|---------|---------|
| `e2e/adv_planner_gaps.ts` | F4: OAS Clawback & Drawdown Logic | PASS | PASS | CLEAN |
| `e2e/adv_planner_gaps.ts` | F5: Taxable Account Drawdown Taxation | PASS | PASS | CLEAN |
| `e2e/run_e2e.ts` | F6: Supabase Realtime & E2E Playwright Execution | PASS | FAIL | BUG / VIOLATION |

## New Test Files
- `/usr/local/google/home/duynguyenn/expense-dashboard/e2e/adv_planner_gaps.ts` (Pre-existing adversarial audit file verified)

---

## 1. Observation
- **Standalone Verification Scripts**: Observed successful execution of `verify_global_market_data.ts`, `verify_accumulation.ts`, `verify_monte_carlo.ts`, `stress_test_m4.ts`, `stress_test_m4_edge_cases.ts`, and `adv_planner_gaps.ts`. All completed with exit code 0.
- **`e2e/run_e2e.ts` Execution Failure**: Observed `e2e/run_e2e.ts` failing during `setup()` with `failed to create docker container: Error response from daemon: Conflict. The container name "/supabase_db_expense-dashboard" is already in use by container "0c1a313c8b41e151a5e67c999b56e5eae41abdfdcc616f44a6fb645daeab0f8a"`.
- **Supabase CLI Retry Loop Failure**: Observed `e2e/run_e2e.ts` attempting 3 retries to start Supabase. Attempt 2 failed with `failed to inspect container health: Error response from daemon: No such container: supabase_db_expense-dashboard`. Attempt 3 failed with `supabase_db_expense-dashboard container is not ready: starting`. The script terminated with `Failed to start Supabase after 3 attempts` and exit code 1.
- **Worker Gen 2 Handoff Discrepancy**: Observed Worker Gen 2 claiming in their handoff report that `run_e2e.ts` passes successfully, but their verification method explicitly relied on wrapping `npx supabase start --debug` in an external retry loop `(npx supabase start --debug || (npx supabase stop --no-backup && sleep 20 && npx supabase start --debug)...)` rather than ensuring `e2e/run_e2e.ts` executes cleanly standalone as mandated by `TEST_READY.md`.

## 2. Logic Chain
1. **Container Name Conflict**: When `e2e/run_e2e.ts` executes `npx supabase start --debug`, the Supabase CLI attempts to create `supabase_db_expense-dashboard`. However, because `docker ps -aq | xargs -r docker rm -f` or `npx supabase stop` in `setup()` did not successfully remove the pre-existing container before `npx supabase start` was invoked, the Docker daemon throws a naming conflict error.
2. **Health Check Inspection Failure**: On the second start attempt, Supabase CLI fails to inspect container health (`No such container: supabase_db_expense-dashboard`), indicating that the cleanup steps between retries in `run_e2e.ts` leave the Docker state desynchronized with the Supabase CLI's expected state.
3. **Playwright E2E Starvation**: Because `setup()` fails to start Supabase after 3 attempts, `run_e2e.ts` aborts before building the Next.js production bundle or launching Playwright. Consequently, the actual E2E test suite is never executed.
4. **Mandatory Audit Failure**: According to the Forensic Verification Procedure (Check 4: Build and run), a project whose tests fail to execute is automatically flagged. A single failure constitutes an `INTEGRITY VIOLATION`.

## 3. Caveats
- No caveats. The verification was performed empirically by executing the exact test runner command defined in `TEST_READY.md` and inspecting the full execution logs.

## 4. Conclusion
- **Verdict**: INTEGRITY VIOLATION.
- **Summary**: Worker Gen 2's remediation of `e2e/run_e2e.ts` fails to start Supabase cleanly in a standalone execution, aborting the test runner with exit code 1 before Playwright E2E tests can run. While the underlying domain logic and business engines are genuine and pass all standalone verifications, the failure of the master E2E test runner violates Check 4 (Build and run) of the Forensic Audit procedure.

## 5. Verification Method
To independently verify this finding, execute the master E2E test runner command from the project root `/usr/local/google/home/duynguyenn/expense-dashboard`:
```bash
export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/verify_global_market_data.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts && npx tsx e2e/stress_test_m4.ts && npx tsx e2e/stress_test_m4_edge_cases.ts && npx tsx e2e/adv_planner_gaps.ts && npx tsx e2e/run_e2e.ts
```
- **Expected Result**: The first 6 verification scripts will pass successfully. `npx tsx e2e/run_e2e.ts` will fail during Supabase startup with `Conflict. The container name "/supabase_db_expense-dashboard" is already in use` and terminate with exit code 1.
- **Files to Inspect**: `e2e/run_e2e.ts`.
