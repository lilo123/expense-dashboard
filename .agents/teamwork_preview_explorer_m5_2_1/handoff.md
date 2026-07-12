# Handoff Report — Milestone 5.2 (Tier 2 E2E Test Pass - Boundary & Corner Cases)

## 1. Observation
- **E2E Test Execution Failure**: Running `npx tsx e2e/run_e2e.ts` fails with exit code 137 (Killed - OOM / timeout) due to Playwright tests timing out repeatedly (30s per test + 2 retries = 90s per test) on `budget_month_picker.spec.ts` and `budget_planner_propagation.spec.ts`, which eventually causes the Next.js server to crash (`Next.js server exited unexpectedly with code null`).
- **`settings.spec.ts` Email Mutation**: `e2e/settings.spec.ts` (lines 82-111) mutates the primary test user email from `test-user@example.com` to `katherine-new@example.com` in Supabase Auth.
- **Missing Login Fallback**: `e2e/budget_month_picker.spec.ts` and `e2e/budget_planner_propagation.spec.ts` attempt to log in using only `test-user@example.com`. Unlike `e2e/yearly_master_toggle.spec.ts` (lines 13-21), they lack a `try/catch` fallback to `katherine-new@example.com`, causing them to fail login and time out if executed after `settings.spec.ts`.
- **Ambiguous Button Locator**: `e2e/budget_month_picker.spec.ts` attempts `await page.click('button:has-text("Budget")')`. In `src/components/DashboardTab.tsx` (lines 212-227), the actual button text is `"Budget View"`. Targeting `"Budget"` is imprecise and fails to reliably toggle `isBudgetView`, preventing `#budget-month-select` from mounting.
- **Missing Seed Data for Calendar Boundary Test**: `e2e/seed.ts` seeds a mock budget for December 2026 (`2026-12`). However, `e2e/budget_month_picker.spec.ts` Test 3 (`should inherit baselines seamlessly across annual calendar boundaries (Dec 2025 -> Jan 2026)`) navigates to `2026-01` expecting a prior budget in `2025-12` to inherit. Because only `2026-12` exists in the database, `priorMonths` in `src/components/BudgetView.tsx` evaluates to `[]`, `totalLimits` becomes `$0.00`, and `await expect(availableBgtCard).not.toContainText('Limits ($0.00)')` fails with a 30s timeout.
- **15 Tier 2 Boundary & Corner Case Tests Identified**:
  - **F1 (Global Market Data Toggle)**:
    1. Zod refinement & validation for `marketDataMode` enum (`'us' | 'global'`) defaulting to `'us'` in `src/schemas/simulationSchema.ts`.
    2. Start year boundary enforcement (`1970` for Global vs `1871` for US) in `src/lib/marketData.ts` (`getValidStartYears`).
    3. Out-of-bounds year fallback objects in `getMarketDataForYear` (`src/lib/marketData.ts`).
    4. Proxy metrics merging (CPI, CAPE, Bonds, Dividends) for Global mode (`createGlobalMarketData` in `src/lib/globalMarketData.ts`).
    5. Differential testing between US and Global modes (`e2e/stress_test_m4.ts`, `e2e/stress_test_m4_edge_cases.ts`).
  - **F2 (Accumulation Phase & Timeline Toggle)**:
    1. Zod refinement for accumulation age boundaries (`currentAge <= retirementAge`) in `src/schemas/simulationSchema.ts`.
    2. Zero-year accumulation edge case (`currentAge == retirementAge`) verified via differential testing in `e2e/stress_test_m4_edge_cases.ts`.
    3. Ignored inputs (`additionalContribution`) in `retirement_only` mode verified in `e2e/stress_test_m4_edge_cases.ts`.
    4. Extreme timeline duration (125 years total: 60 yrs accum + 65 yrs retire) verified in `e2e/stress_test_m4.ts`.
    5. Accumulation phase withdrawal ($0) & contribution logic verified in `e2e/verify_accumulation.ts`.
  - **F3 (Simulation Mode Toggle - Monte Carlo)**:
    1. PRNG determinism & reproducibility boundary (`mulberry32(12345)`) verified in `e2e/verify_monte_carlo.ts`.
    2. Exact run count enforcement (1,000 runs) in `src/workers/simulation.worker.ts`.
    3. Zero-copy columnar buffer allocation (`Float64Array`) verified in `e2e/stress_test_m4.ts`.
    4. Monte Carlo inflation & market data sampling boundary in `src/workers/simulation.worker.ts`.
    5. Extreme allocation (100% cash, 0 portfolio) & guardrail boundaries verified in `e2e/stress_test_m4_edge_cases.ts`.

## 2. Logic Chain
1. `npx tsx e2e/run_e2e.ts` runs Playwright tests in sequence/parallel. `settings.spec.ts` mutates `test-user@example.com` to `katherine-new@example.com`. Subsequent tests (`budget_month_picker.spec.ts`, `budget_planner_propagation.spec.ts`) fail to log in because they do not implement the `katherine-new@example.com` fallback mechanism found in `yearly_master_toggle.spec.ts`.
2. In `budget_month_picker.spec.ts`, `await page.click('button:has-text("Budget")')` fails to reliably click the `"Budget View"` toggle button in `DashboardTab.tsx`. As a result, `isBudgetView` remains `false`, `<BudgetView />` is never mounted, and `await expect(page.locator('#budget-month-select')).toBeVisible()` times out after 30 seconds.
3. In `budget_month_picker.spec.ts` Test 3 (`Dec 2025 -> Jan 2026`), the test fills `#budget-month-select` with `2026-01` and asserts `not.toContainText('Limits ($0.00)')`. However, `e2e/seed.ts` only seeds a budget for `2026-12`. When `BudgetView.tsx` calculates `priorMonths` for `2026-01`, it finds no prior months (`2026-12 < 2026-01` is false). Thus, `totalLimits` evaluates to `0`, the UI displays `Limits ($0.00)`, and the Playwright assertion times out after 30 seconds.
4. The repeated 30-second timeouts across multiple tests and retries accumulate to over 5 minutes of hanging execution, causing the underlying Next.js server to exhaust memory/resources and crash, resulting in the overall test runner failing with exit code 137 (Killed).

## 3. Caveats
- The investigation was conducted in read-only mode (`CODE_ONLY`). No files were modified or executed to verify the fixes directly.
- The proposed fixes assume that no other Playwright test files lack the `katherine-new@example.com` login fallback. If other tests exhibit similar login timeouts, they should be updated with the same fallback pattern.

## 4. Conclusion
To ensure 100% of Tier 2 E2E tests pass with exit code 0, the Worker agent must implement the following concrete fix strategy:
1. **Add Login Fallback**: Update `e2e/budget_month_picker.spec.ts` and `e2e/budget_planner_propagation.spec.ts` (and any other vulnerable spec files) to include the `try/catch` login fallback for `katherine-new@example.com` in `beforeEach`, matching the proven pattern in `e2e/yearly_master_toggle.spec.ts`.
2. **Fix Button Locator**: In `e2e/budget_month_picker.spec.ts`, update `await page.click('button:has-text("Budget")')` to `await page.click('button:has-text("Budget View")')` to precisely target the view toggle button in `src/components/DashboardTab.tsx`.
3. **Seed Prior Year Budget Data**: In `e2e/seed.ts`, add a mock budget record for December 2025 (`2025-12`) alongside the existing `2026-12` record. This ensures that `budget_month_picker.spec.ts` Test 3 successfully inherits the `2025-12` baseline when navigating to `2026-01`.

## 5. Verification Method
The Worker agent can independently verify the fixes by executing the following commands:
```bash
export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin
npx tsx e2e/run_e2e.ts
npx tsx e2e/verify_accumulation.ts
npx tsx e2e/verify_monte_carlo.ts
```
**Success Criteria**: All three test runner scripts must complete successfully with exit code 0, and Playwright must report 100% test pass rates with no timeouts.
