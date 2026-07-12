# Handoff Report: Milestone 3 (Tier 3 Cross-Feature Pairwise Combinations)

## 1. Observation
- **Test Infrastructure & E2E Setup (`e2e/run_e2e.ts`, `TEST_INFRA.md`)**:
  - `e2e/run_e2e.ts` lines 1-65 establishes the execution flow (`npx playwright test --workers=1`), handling environment credentials swap (`.env.test` to `.env.local`). 
  - `TEST_INFRA.md` lines 1-48 defines the testing philosophy (Opaque-box, requirement-driven) and the threshold for Tier 3: "pairwise coverage of major feature interactions" specifically targeting `e2e/planner_tier3_pairwise.spec.ts`.
- **Pre-Seeded Environment Data (`e2e/seed.ts`)**:
  - `e2e/seed.ts` lines 23-26 seeds two primary test accounts: Standard User (`test-user@example.com`) and Premium User (`premium-user@example.com`) with password `password123`.
  - `e2e/seed.ts` lines 343-372 seeds a pre-existing genuine premium retirement plan with ID `premium-user-genuine-plan-id` belonging to the Premium User.
- **Existing Test Suites & Locators (`e2e/planner_tier1_feature.spec.ts`, `e2e/planner_tier2_boundary.spec.ts`, `e2e/adv_planner_tier2_boundary.spec.ts`)**:
  - `planner_tier1_feature.spec.ts` lines 1-358 demonstrates standard helper functions (`loginAs`) and locator patterns: `#quick-check-widget`, `#hydrated-marker`, `#tab-household`, `#tab-accounts`, `#tab-spending`, `#tab-pensions`, `#tab-events`, `#tab-taxes`, `#tab-simulation`, `#premium-lock-card`, `#range-20yr`, `#range-50yr`, `#range-125yr`, `#run-simulation-btn`, `#simulation-results-summary`, `.validation-error`, `.toast-success`, `.toast-error`.
  - `planner_tier2_boundary.spec.ts` lines 1-630 utilizes DOM validation checks (`expect(page.locator('.validation-error')).toContainText(...)`), mock route aborts (`page.route('**/api/simulate', ...)`), mock window property injection via `page.evaluate`, and screen reader parity assertions on `div.sr-only table` via `textContent()`.
  - Automated accessibility audits are performed using `new AxeBuilder({ page }).analyze()` across both full pages and scoped containers (`.include('#quick-check-widget')`).
- **Target Feature Sets (`task_description.md`, `SCOPE.md`, `PROJECT.md`)**:
  - **F1**: Dual Entry Quick Check Widget & URL Hydration
  - **F2**: Authenticated Dashboard & 7-Tab Detailed Plan Builder
  - **F3**: Premium Tier Historical Range Selector & Premium Lock
  - **F4**: Core Domain Business Logic Engines & Zod Validation

## 2. Logic Chain
- **Requirement for Pairwise Combinatorial Coverage**:
  - To fulfill the Milestone 3 requirements outlined in `TEST_INFRA.md` and `task_description.md`, we must verify all pairwise combinations among the 4 target features (F1, F2, F3, F6).
  - The number of distinct pairs among 4 features is `C(4, 2) = 6`: (F1, F2), (F1, F3), (F1, F6), (F2, F3), (F2, F6), and (F3, F6).
- **Parameter Variation Strategy**:
  - By selecting distinct operational states for each feature (e.g., standard vs premium users for F3; default vs high-net-worth vs boundary URL params for F1; new plan navigation vs existing plan editing for F2; valid sophisticated config vs invalid cross-field Zod errors for F6), we ensure robust coverage across varied real-world usage patterns.
- **Implementation Mapping to Existing E2E Patterns**:
  - Each pairwise test case can directly inherit the proven Playwright locator strategies, `loginAs` helper flow, and `@axe-core/playwright` accessibility audits observed in Tier 1 and Tier 2 test files, ensuring 100% compatibility with `npx tsx e2e/run_e2e.ts`.

## 3. Caveats
- **No caveats.** All codebase files, test infrastructure scripts, and requirement definitions were successfully inspected without ambiguity or missing dependencies.

## 4. Conclusion
We recommend implementing `e2e/planner_tier3_pairwise.spec.ts` with the following 12 comprehensive pairwise test cases, organized into 6 test description blocks:

### Block 1: (F1, F2) - Quick Check / Hydration ↔ Dashboard / 7-Tab Builder
- **Test Case 1.1 (F1_Custom_High_Net + F2_New_Plan_Navigation):**
  - **Flow:** Enter custom high net-worth inputs in Quick Check widget (`currentAge=45`, `retirementAge=60`, `currentSavings=2500000`, `monthlyContribution=5000`), click `#save-unlock-btn`, login as `test-user@example.com`, land on `/plans/new`, and navigate sequentially across all 7 tabs.
  - **Locators & Assertions:** Assert `#hydrated-marker` is attached. Verify `#input-current-age` is `45`, `#input-retirement-age` is `60`. Click `#tab-accounts` and verify `#input-current-savings` is `2500000`. Click through `#tab-spending`, `#tab-pensions`, `#tab-events`, `#tab-taxes`, `#tab-simulation` verifying each panel appears correctly. Run `AxeBuilder` audit.
- **Test Case 1.2 (F1_Bypass_Direct + F2_Edit_Existing_Plan):**
  - **Flow:** Bypass Quick Check, login directly to `/plans` as `test-user@example.com`, select the first existing plan card, and modify inputs across multiple tabs.
  - **Locators & Assertions:** Verify `#plans-dashboard-container`. Click `.plan-card`. Wait for `#hydrated-marker`. Update `#input-retirement-age` to `67`. Click `#tab-accounts`, update `#input-monthly-contribution` to `1200`. Click `#save-plan-btn` and verify `.toast-success`.

### Block 2: (F1, F3) - Quick Check / Hydration ↔ Premium Range Selector / Premium Lock
- **Test Case 2.1 (F1_Custom_Boundary + F3_Standard_Tier_Locked):**
  - **Flow:** Enter boundary inputs in Quick Check (`currentAge=50`, `retirementAge=50`, `currentSavings=0`, `monthlyContribution=0.01`), login as `test-user@example.com`, redirect to `/plans/new`, and jump directly to `#tab-simulation`.
  - **Locators & Assertions:** Wait for `#hydrated-marker`. Click `#tab-simulation`. Assert `#premium-lock-card` is visible with `bg-white/40 backdrop-blur-md`. Assert `#range-50yr` and `#range-125yr` are disabled. Click `#range-20yr` and `#run-simulation-btn`, verifying `#simulation-results-summary` renders with the boundary hydration data.
- **Test Case 2.2 (F1_Custom_High_Net + F3_Premium_Tier_Unlocked):**
  - **Flow:** Enter high net-worth inputs in Quick Check (`currentAge=40`, `retirementAge=55`, `currentSavings=5000000`, `monthlyContribution=10000`), login as `premium-user@example.com`, redirect to `/plans/new`, and open `#tab-simulation`.
  - **Locators & Assertions:** Wait for `#hydrated-marker`. Click `#tab-simulation`. Assert `#premium-lock-card` is NOT visible. Assert `#range-50yr` and `#range-125yr` are enabled. Select `#range-125yr`, click `#run-simulation-btn`, and verify 1,000 paths simulated successfully for the hydrated 5M portfolio.

### Block 3: (F1, F6) - Quick Check / Hydration ↔ Core Domain Engines / Zod Validation
- **Test Case 3.1 (F1_Bypass_Direct + F6_Invalid_Cross_Field):**
  - **Flow:** Directly navigate to `/plans/new?currentAge=65&retirementAge=55` (invalid cross-field params where retirementAge < currentAge), login as `test-user@example.com`, and inspect Zod validation handling upon hydration.
  - **Locators & Assertions:** Wait for `#hydrated-marker`. Verify Zod engine catches the cross-field violation immediately upon hydration or input blur. Assert `.validation-error` displays "Retirement age cannot be less than current age" and verify zero negative financial jargon in `body`.
- **Test Case 3.2 (F1_Custom_High_Net + F6_Valid_Sophisticated_Config):**
  - **Flow:** Complete Quick Check with high net-worth inputs, login as `test-user@example.com`, land on `/plans/new`, navigate to `#tab-spending`, select `vanguard_dynamic`, and configure min/max withdrawals.
  - **Locators & Assertions:** Wait for `#hydrated-marker`. Click `#tab-spending`. Select `#select-spending-strategy` to `vanguard_dynamic`. Fill `#input-min-withdrawal` with `80000`, `#input-max-withdrawal` with `120000`. Blur input, verify `.validation-error` is not visible. Click `#tab-simulation`, run simulation, and verify pure business logic engines successfully process the dynamic spending rules against the hydrated portfolio.

### Block 4: (F2, F3) - Dashboard / 7-Tab Builder ↔ Premium Range Selector / Premium Lock
- **Test Case 4.1 (F2_Compound_Tab_Updates + F3_Standard_Tier_Attempt_Premium):**
  - **Flow:** Standard user (`test-user@example.com`) logs in, creates `/plans/new`, fills complex data across Household, Accounts, and Pensions tabs, goes to Simulation tab, and attempts to bypass Premium Lock before saving.
  - **Locators & Assertions:** Wait for `#hydrated-marker`. Fill `#input-plan-name` with "Standard Compound Plan". Click `#tab-pensions`, select `social_security`, fill `#input-pension-start-age` with `65`. Click `#tab-simulation`. Verify `#premium-lock-card` is visible. Use `page.evaluate` to inject `historicalRange = 125` into form. Click `#save-plan-btn`. Assert `.toast-error` appears with "This feature requires a Premium subscription".
- **Test Case 4.2 (F2_Edit_Existing_Plan + F3_Premium_Tier_Toggle_All):**
  - **Flow:** Premium user (`premium-user@example.com`) logs into `/plans`, clicks on pre-seeded genuine premium plan card (`premium-user-genuine-plan-id`), navigates to `#tab-simulation`, and toggles through all historical ranges.
  - **Locators & Assertions:** Click `.plan-card` for "Genuine Premium Retirement Plan". Wait for `#hydrated-marker`. Click `#tab-simulation`. Verify `#premium-lock-card` is not visible. Click `#range-20yr`, `#range-50yr`, and `#range-125yr`. Click `#run-simulation-btn`. Verify `#simulation-results-summary` displays "125-Year Projection" and assert `AxeBuilder` accessibility audit passes with zero violations.

### Block 5: (F2, F6) - Dashboard / 7-Tab Builder ↔ Core Domain Engines / Zod Validation
- **Test Case 5.1 (F2_Compound_Tab_Updates + F6_Extreme_Refinements):**
  - **Flow:** Login (`test-user@example.com`), open `/plans/new`, navigate across Accounts, Spending, and Simulation tabs, inputting extreme boundary values that trigger Zod refinements (`yaleWeight = 0`, `inflationRate = 0.5`).
  - **Locators & Assertions:** Wait for `#hydrated-marker`. Click `#tab-spending`, select `yale_endowment`, fill `#input-yale-weight` with `0`. Click `#tab-simulation`, fill `#input-inflation-rate` with `0.5`. Blur input, verify `.validation-error` is not visible. Click `#run-simulation-btn`. Verify simulation executes successfully without throwing Zod errors, and inspect `div.sr-only table` for screen reader parity.
- **Test Case 5.2 (F2_Edit_Existing_Plan + F6_Invalid_Cross_Field):**
  - **Flow:** Login to `/plans` (`test-user@example.com`), select an existing plan, navigate to `#tab-events`, enter an invalid life event date range (`startYear = 2035, endYear = 2030`), and attempt to save.
  - **Locators & Assertions:** Click `.plan-card`. Wait for `#hydrated-marker`. Click `#tab-events`. Fill `#input-event-start-year` with `2035`, `#input-event-end-year` with `2030`. Blur input. Assert `.validation-error` appears with "startYear cannot exceed endYear". Click `#save-plan-btn` and verify save is blocked or rejected, and ensure no negative financial jargon exists on the page.

### Block 6: (F3, F6) - Premium Range Selector / Premium Lock ↔ Core Domain Engines / Zod Validation
- **Test Case 6.1 (F3_Premium_Tier_Unlocked + F6_Valid_Sophisticated_Config):**
  - **Flow:** Premium user (`premium-user@example.com`) opens `/plans/new`, configures a sophisticated financial profile (`vanguard_dynamic` spending, `social_security` pension, `taxable_first` drawdown), selects premium `125-year` range, and executes simulation.
  - **Locators & Assertions:** Wait for `#hydrated-marker`. Click `#tab-spending`, select `vanguard_dynamic`, fill min/max withdrawals (`50000`/`100000`). Click `#tab-pensions`, select `social_security`, fill start age `65`. Click `#tab-simulation`, select `#range-125yr`, fill `#input-num-paths` with `10000`. Click `#run-simulation-btn`. Verify Web Worker simulation completes successfully, displaying `#simulation-results-summary` with "125-Year Projection" and "10,000 paths simulated". Check `div.sr-only table` for 10th, 50th, 90th percentile headers.
- **Test Case 6.2 (F3_Standard_Tier_Locked + F6_Invalid_Cross_Field):**
  - **Flow:** Standard user (`test-user@example.com`) opens `/plans/new`, goes to `#tab-simulation`, enters invalid simulation parameters (`numPaths = 20000` exceeding Zod maximum 10000, `retirementHorizon = 150` exceeding 100), and observes interaction between Zod validation engine and Premium Lock card.
  - **Locators & Assertions:** Wait for `#hydrated-marker`. Click `#tab-simulation`. Verify `#premium-lock-card` is visible. Fill `#input-num-paths` with `20000`, `#input-retirement-horizon` with `150`. Blur input. Verify `.validation-error` displays "numPaths cannot exceed 10000" and "retirementHorizon cannot exceed 100". Verify `#range-50yr` and `#range-125yr` remain securely disabled and unaffected by validation state changes. Perform `AxeBuilder` audit to verify zero accessibility violations.

## 5. Verification Method
- **Execution Verification**:
  - Once the implementer creates `e2e/planner_tier3_pairwise.spec.ts` containing these test cases, verify execution using the established E2E wrapper script:
    ```bash
    npx tsx e2e/run_e2e.ts
    ```
  - Alternatively, run Playwright directly on the specific file:
    ```bash
    npx playwright test e2e/planner_tier3_pairwise.spec.ts --workers=1
    ```
- **Pass/Fail Semantics**:
  - Process must exit with code `0`, indicating 100% success across all Playwright assertions and `@axe-core/playwright` accessibility audits.
