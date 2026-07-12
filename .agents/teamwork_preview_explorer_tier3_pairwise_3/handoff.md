# Handoff Report: Tier 3 Pairwise Combinatorial Testing (Explorer 3)

## 1. Observation
- **Task & Scope**: Explored existing test files (`e2e/planner_tier1_feature.spec.ts`, `e2e/planner_tier2_boundary.spec.ts`, `e2e/adv_planner_tier2_boundary.spec.ts`, `e2e/seed.ts`, `e2e/run_e2e.ts`) and `TEST_INFRA.md` to design Tier 3 pairwise combinatorial test cases for `e2e/planner_tier3_pairwise.spec.ts`. Specifically focused on pairs involving F7 (Automated Accessibility & WCAG 2.1 AA/AAA Compliance) combined with F1-F6, and conducted an overall pairwise coverage completeness check across all 7 features.
- **Test Architecture & Setup (`e2e/run_e2e.ts`, `e2e/seed.ts`)**:
  - Executed via `npx tsx e2e/run_e2e.ts`, which swaps `.env.test` into `.env.local` and invokes `npx playwright test --workers=1`.
  - Seed script establishes two primary test accounts: `test-user@example.com` (Standard Tier) and `premium-user@example.com` (Premium Tier).
  - A genuine premium plan is seeded with `id: 'premium-user-genuine-plan-id'`.
- **Existing E2E Patterns (`e2e/planner_tier1_feature.spec.ts`, `e2e/planner_tier2_boundary.spec.ts`, `e2e/adv_planner_tier2_boundary.spec.ts`)**:
  - Playwright test files utilize helper function `loginAs(page, email, password)`.
  - Client-side hydration completion is verified via `await page.waitForSelector('#hydrated-marker', { state: 'attached' })`.
  - Automated accessibility audits are performed using `new AxeBuilder({ page }).analyze()` or scoped via `.include(selector)`.
  - Screen reader parity in simulation charts is verified by inspecting `div.sr-only table` using `textContent()`.
  - BOLA/RLS defenses are verified both via DOM interactions (Premium Lock card `#premium-lock-card`, disabled inputs `#range-50yr`, `#range-125yr`, error toasts `.toast-error`) and via direct JS fetch injection (`fetch('/api/actions/savePlan', ...)`).
- **Feature Inventory (`TEST_INFRA.md`)**:
  - F1: Dual Entry Quick Check Widget & URL Hydration
  - F2: Authenticated Dashboard & 7-Tab Detailed Plan Builder
  - F3: Premium Tier Historical Range Selector & Premium Lock
  - F4: 1,000-Path Monte Carlo Web Worker Simulation Execution
  - F5: Server Actions BOLA Defenses & RLS Enforcement
  - F6: Core Domain Business Logic Engines & Zod Validation
  - F7: Automated Accessibility & WCAG 2.1 AA/AAA Compliance

## 2. Logic Chain
- **Pairwise Combinatorial Mathematics**:
  - For 7 features, the total number of unique pairwise interactions is $7 \times 6 / 2 = 21$ pairs.
  - **Explorer 1** covers pairs within $\{F1, F2, F3, F6\}$: $(F1, F2), (F1, F3), (F1, F6), (F2, F3), (F2, F6), (F3, F6)$ (6 pairs).
  - **Explorer 2** covers pairs within $\{F4, F5, F2, F3\}$: $(F4, F5), (F4, F2), (F4, F3), (F5, F2), (F5, F3), (F2, F3)$ (5 distinct new pairs).
  - **Explorer 3** (this report) covers pairs involving $F7$ with $F1-F6$: $(F1, F7), (F2, F7), (F3, F7), (F4, F7), (F5, F7), (F6, F7)$ (6 distinct new pairs).
- **Completeness Gap Identification**:
  - The sum of distinct pairs covered across the explicit assignments is $6 + 5 + 6 = 17$ pairs.
  - The remaining $21 - 17 = 4$ pairs represent cross-boundary interactions between Explorer 1's unique features $\{F1, F6\}$ and Explorer 2's unique features $\{F4, F5\}$.
  - The 4 missing pairs are: $(F1, F4), (F1, F5), (F4, F6), (F5, F6)$.
- **Actionable Test Design**:
  - To achieve 100% pairwise combinatorial coverage in `e2e/planner_tier3_pairwise.spec.ts`, the implementer must include test cases for the 6 pairs involving F7 plus the 4 gap pairs identified in our completeness check.

## 3. Caveats
- **Read-Only Scope**: This report provides test case designs and locator strategies. No code was modified in `e2e/`.
- **Pre-existing Seed State**: Test designs assume the continued presence of `test-user@example.com`, `premium-user@example.com`, and `premium-user-genuine-plan-id` as established in `e2e/seed.ts`.

## 4. Conclusion
The implementer of `e2e/planner_tier3_pairwise.spec.ts` should implement the following 10 combinatorial test cases to ensure complete pairwise coverage:

### Part 1: Pairs Involving F7 (Automated Accessibility & WCAG 2.1 AA/AAA Compliance)
1. **`(F1, F7)`: Dual Entry Quick Check Widget + Automated Accessibility**
   - *Test Flow*: Navigate to `/`. Perform an automated `@axe-core/playwright` accessibility audit on `#quick-check-widget` during user entry and validation state changes. Ensure form fields (`#quick-current-age`, `#quick-retirement-age`, `#quick-current-savings`, `#quick-monthly-contribution`) maintain accessible labels, focus indicators, and contrast ratios while triggering `#save-unlock-btn`.
   - *Locators & Verification*: `new AxeBuilder({ page }).include('#quick-check-widget').analyze()`, expecting `violations.toEqual([])`.

2. **`(F2, F7)`: Authenticated Dashboard & 7-Tab Detailed Plan Builder + Automated Accessibility**
   - *Test Flow*: Log in as `test-user@example.com`, navigate to `/plans/new`, wait for `#hydrated-marker`. Loop through all 7 domain tabs (`#tab-household` to `#tab-simulation`), inputting valid/invalid data to verify that dynamic error containers (`.validation-error`) have `role="alert"` and zero WCAG violations exist across active tab panels (`#panel-household` to `#panel-simulation`).
   - *Locators & Verification*: Loop `new AxeBuilder({ page }).include(panelId).analyze()`, expecting `violations.toEqual([])`.

3. **`(F3, F7)`: Premium Tier Historical Range Selector & Premium Lock + Automated Accessibility**
   - *Test Flow*: Log in as `test-user@example.com`, navigate to `/plans/new`, click `#tab-simulation`. Perform an accessibility audit on `#premium-lock-card` and disabled radio inputs (`#range-50yr`, `#range-125yr`). Verify the frosted glass overlay maintains proper contrast, does not trap keyboard focus, and correctly conveys disabled state to screen readers.
   - *Locators & Verification*: `new AxeBuilder({ page }).include('#panel-simulation').analyze()`, expecting `violations.toEqual([])`.

4. **`(F4, F7)`: 1,000-Path Monte Carlo Web Worker Simulation + Automated Accessibility**
   - *Test Flow*: Log in as `premium-user@example.com`, navigate to `/plans/new`, click `#tab-simulation`, select `#range-125yr`, click `#run-simulation-btn`. Verify accessibility during loading (`.spinner-loader`) and after results render (`#simulation-results-summary`, `#wealth-fan-chart`). Verify screen reader parity by confirming `div.sr-only table` is populated with `10th Percentile`, `50th Percentile`, and `90th Percentile` data.
   - *Locators & Verification*: `new AxeBuilder({ page }).include('#panel-simulation').analyze()`, `expect(srTable).toBeAttached()`.

5. **`(F5, F7)`: Server Actions BOLA Defenses & RLS Enforcement + Automated Accessibility**
   - *Test Flow*: Log in as `test-user@example.com`, attempt unauthorized access to `/plans/premium-user-genuine-plan-id`. Upon RLS redirection to `/plans` and appearance of `.toast-error`, perform an immediate accessibility audit on the error toast and dashboard container to ensure error notifications are announced (`role="alert"`) without contrast or focus order violations.
   - *Locators & Verification*: `new AxeBuilder({ page }).include('.toast-error').analyze()`, expecting `violations.toEqual([])`.

6. **`(F6, F7)`: Core Domain Business Logic Engines & Zod Validation + Automated Accessibility**
   - *Test Flow*: Log in as `test-user@example.com`, navigate to `/plans/new`, interact with complex business logic inputs in Spending (`#select-spending-strategy`, `#input-yale-weight`), Pensions (`#select-pension-type`, `#input-pension-start-age`), and Events (`#input-event-start-year`, `#input-event-end-year`). Trigger Zod validation errors (`.validation-error`) and verify WCAG compliance and zero negative financial jargon in error copy.
   - *Locators & Verification*: `new AxeBuilder({ page }).analyze()`, expecting `violations.toEqual([])`.

### Part 2: Completeness Gap Pairs (Ensuring 100% Overall Pairwise Coverage)
7. **`(F1, F4)`: Dual Entry Quick Check Widget + 1,000-Path Monte Carlo Web Worker Simulation**
   - *Test Flow*: Start at Quick Check Widget (`/`), enter high net worth savings (`#quick-current-savings` = 2500000), click `#save-unlock-btn`. Log in as `premium-user@example.com`. Land on `/plans/new` with URL search params, wait for `#hydrated-marker`, navigate directly to `#tab-simulation`, select `#range-125yr`, click `#run-simulation-btn`. Verify that the 1,000 Monte Carlo paths correctly incorporate the hydrated initial savings from the Quick Check widget into the simulation summary.
   - *Locators & Verification*: `#quick-check-widget`, `#quick-current-savings`, `#save-unlock-btn`, `#hydrated-marker`, `#tab-simulation`, `#range-125yr`, `#run-simulation-btn`, `#simulation-results-summary`.

8. **`(F1, F5)`: Dual Entry Quick Check Widget + Server Actions BOLA Defenses & RLS Enforcement**
   - *Test Flow*: From the Quick Check Widget (`/`), simulate an adversarial user attempting to tamper with redirect URL search params by injecting unauthorized plan IDs or premium flags (`/login?redirect=/plans/new?currentSavings=500000&id=premium-user-genuine-plan-id&historicalRange=125`). Log in as `test-user@example.com`. Verify that Server Actions and BOLA defenses intercept the unauthorized parameters, reject the BOLA attempt, strip unauthorized flags, and enforce strict RLS without crashing or corrupting the Zustand store.
   - *Locators & Verification*: `#hydrated-marker`, `.toast-error`, `#input-current-savings`.

9. **`(F4, F6)`: 1,000-Path Monte Carlo Web Worker Simulation + Core Domain Business Logic Engines**
   - *Test Flow*: Log in as `premium-user@example.com`, navigate to `/plans/new`, configure complex domain logic parameters in Spending (`yale_endowment`, weight 0.4) and Taxes (Jurisdiction `US`, State `NY`). Switch to `#tab-simulation`, enter edge-case but valid Zod values for Web Worker config (`#input-num-paths` = 10000, `#input-retirement-horizon` = 100, `#input-inflation-rate` = 0.05), select `#range-125yr`, click `#run-simulation-btn`. Verify successful Web Worker execution respecting pure TS domain rules (taxEngine, spendingEngine) and Zod constraints without numerical overflow.
   - *Locators & Verification*: `#tab-spending`, `#select-spending-strategy`, `#input-yale-weight`, `#tab-taxes`, `#tab-simulation`, `#input-num-paths`, `#input-retirement-horizon`, `#input-inflation-rate`, `#range-125yr`, `#run-simulation-btn`, `#simulation-results-summary`.

10. **`(F5, F6)`: Server Actions BOLA Defenses & RLS Enforcement + Core Domain Business Logic Engines**
    - *Test Flow*: Log in as `test-user@example.com`, navigate to `/plans/new`, enter valid domain business logic configurations in Household and Accounts, but use `page.evaluate()` to intercept the `savePlan` fetch call to submit a payload containing valid Zod business engine structures but attempting a BOLA/RLS bypass (e.g. attaching another user's `user_id` or modifying `profiles.tier` in the payload). Verify Server Actions perform strict server-side Zod validation and RLS enforcement, rejecting the payload with a clean error message and zero database modification.
    - *Locators & Verification*: `page.evaluate` fetch to `/api/actions/savePlan`, inspect JSON response `{ success: false, error: ... }`.

## 5. Verification Method
- **Test File Creation**: The implementer will author `e2e/planner_tier3_pairwise.spec.ts` incorporating these 10 test cases alongside any specific cases from Explorer 1 and Explorer 2.
- **Execution Command**: Independent verification is achieved by running the full E2E test suite via the wrapper script:
  ```bash
  npx tsx e2e/run_e2e.ts
  ```
- **Success Criteria**: Process exits with code `0`, confirming 100% success across all combinatorial assertions, RLS defenses, Web Worker executions, and `@axe-core/playwright` accessibility audits.
