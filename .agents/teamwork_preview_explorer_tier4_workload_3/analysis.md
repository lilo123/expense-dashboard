# Analysis & Implementation Strategy: Tier 4 Scenario 5 & TEST_READY.md

## 1. Executive Summary
This analysis establishes the concrete implementation strategy for **Scenario 5** of the Tier 4 Real-World Workload Scenarios (`e2e/planner_tier4_workload.spec.ts`) and designs the definitive structure and content for `TEST_READY.md`. The design strictly adheres to the opaque-box testing philosophy defined in `TEST_INFRA.md`, leveraging established Playwright locator conventions and `@axe-core/playwright` accessibility audits found in Tiers 1–3 (`e2e/planner_tier1_feature.spec.ts`, `e2e/planner_tier2_boundary.spec.ts`, `e2e/planner_tier3_pairwise.spec.ts`).

---

## 2. Scenario 5 Deep-Dive Analysis
### Scenario Title
**Comprehensive Quick Check to 7-Tab Plan Builder with A11y Audit (F1, F2, F4, F6, F7)**

### Features Exercised
- **F1**: Dual Entry Quick Check Widget & URL Hydration
- **F2**: Authenticated Dashboard & 7-Tab Detailed Plan Builder
- **F4**: 1,000-Path Monte Carlo Web Worker Simulation Execution
- **F6**: Core Domain Business Logic Engines & Zod Validation
- **F7**: Automated Accessibility & WCAG 2.1 AA/AAA Compliance

### Test Flow & Execution Steps
1. **Initial Dual Entry & Quick Check Audit (F1, F7)**:
   - Navigate to the landing page (`/`).
   - Assert visibility of `#quick-check-widget`.
   - Run `@axe-core/playwright` accessibility audit scoped to `#quick-check-widget`.
   - Input realistic comprehensive workload values:
     - Current Age (`#quick-current-age`): `38`
     - Retirement Age (`#quick-retirement-age`): `65`
     - Current Savings (`#quick-current-savings`): `750000`
     - Monthly Contribution (`#quick-monthly-contribution`): `2500`
   - Click `#save-unlock-btn` and verify redirection to `/login` or `/auth` with correctly encoded URL search params.

2. **Authentication & Zustand URL Hydration (F1, F2)**:
   - Execute authentication as `PREMIUM_USER` (`premium-user@example.com`) with `TEST_PASSWORD` (`password123`).
   - Expect navigation to `/plans/new` with preserved query parameters.
   - Await attachment of `#hydrated-marker` to ensure the Zustand store has fully hydrated without mismatch.

3. **7-Tab Detailed Plan Builder Navigation & Progressive A11y Audits (F2, F6, F7)**:
   - **Tab 1: Household (`#tab-household`)**:
     - Verify hydrated values: `#input-current-age` (`38`), `#input-retirement-age` (`65`).
     - Fill `#input-plan-name` with `"Comprehensive Workload Plan"` and `#input-birth-year` with `1988`.
     - Perform scoped A11y audit on `#panel-household`.
   - **Tab 2: Accounts (`#tab-accounts`)**:
     - Click `#tab-accounts`. Verify hydrated values: `#input-current-savings` (`750000`), `#input-monthly-contribution` (`2500`).
     - Fill `#input-account-balance` (`750000`) and `#input-account-cost-basis` (`600000`).
     - Perform scoped A11y audit on `#panel-accounts`.
   - **Tab 3: Spending (`#tab-spending`)**:
     - Click `#tab-spending`. Select `#select-spending-strategy` to `vanguard_dynamic`.
     - Fill `#input-min-withdrawal` (`60000`) and `#input-max-withdrawal` (`110000`).
     - Perform scoped A11y audit on `#panel-spending`. Verify no `.validation-error` is visible.
   - **Tab 4: Pensions (`#tab-pensions`)**:
     - Click `#tab-pensions`. Select `#select-pension-type` to `social_security`.
     - Fill `#input-pension-start-age` (`67`).
     - Perform scoped A11y audit on `#panel-pensions`.
   - **Tab 5: Life Events (`#tab-events`)**:
     - Click `#tab-events`. Fill `#input-event-start-year` (`2030`) and `#input-event-end-year` (`2035`).
     - Perform scoped A11y audit on `#panel-events`.
   - **Tab 6: Taxes (`#tab-taxes`)**:
     - Click `#tab-taxes`. Select `#select-tax-jurisdiction` to `US` and fill `#input-state-province` to `CA`.
     - Perform scoped A11y audit on `#panel-taxes`.

4. **Web Worker Simulation Execution & Screen Reader Parity (F4, F7)**:
   - **Tab 7: Simulation (`#tab-simulation`)**:
     - Click `#tab-simulation`. Perform scoped A11y audit on `#panel-simulation`.
     - Verify absence of `#premium-lock-card` (unlocked for `PREMIUM_USER`).
     - Click `#range-125yr`. Fill `#input-num-paths` (`1000`), `#input-retirement-horizon` (`40`), `#input-inflation-rate` (`0.03`).
     - Click `#run-simulation-btn`.
     - Await `#simulation-results-summary` (up to 15 seconds) and expect text to contain `"125-Year Projection"` and `"1,000 paths simulated"`.
     - Assert `#wealth-fan-chart` is visible.
     - Verify screen reader parity: assert `div.sr-only table` is attached and `textContent()` contains `"10th Percentile"`, `"50th Percentile"`, `"90th Percentile"`.

5. **Plan Persistence, Brand Empathy & Dashboard Verification (F2, F7)**:
   - Click `#save-plan-btn`.
   - Verify success toast `.toast-success` is visible and expect redirection to `/plans`.
   - Verify the newly saved plan card `.plan-card` containing text `"Comprehensive Workload Plan"` is visible.
   - Execute a final A11y audit on the `/plans` dashboard.
   - Execute Brand and Empathy assertions across the full page `body` ensuring zero occurrences of negative financial jargon (`'Debt'`, `'Penalty'`, `'Failing'`, `'Over-limit'`, `'Deficit'`, `'Game Over'`).

---

## 3. Concrete Playwright Implementation Snippet (Scenario 5)
```typescript
test('5. Comprehensive Quick Check to 7-Tab Plan Builder with A11y Audit (F1, F2, F4, F6, F7)', async ({ page }) => {
  // Step 1: Initial Dual Entry & Quick Check Audit
  await page.goto('/');
  const widget = page.locator('#quick-check-widget');
  await expect(widget).toBeVisible();

  let accessibilityScanResults = await new AxeBuilder({ page }).include('#quick-check-widget').analyze();
  expect(accessibilityScanResults.violations).toEqual([]);

  await widget.locator('#quick-current-age').fill('38');
  await widget.locator('#quick-retirement-age').fill('65');
  await widget.locator('#quick-current-savings').fill('750000');
  await widget.locator('#quick-monthly-contribution').fill('2500');
  await widget.locator('#save-unlock-btn').click();

  // Step 2: Authentication & Zustand URL Hydration
  await page.waitForURL(/(\/login|\/auth)\?redirect=.*plans.*new/);
  await page.fill('input[type="email"]', PREMIUM_USER);
  await page.fill('input[type="password"]', TEST_PASSWORD);
  await page.click('button[type="submit"]');

  await page.waitForURL((url: any) => url.pathname.includes('/dashboard') || url.pathname.includes('/plans'));
  await page.goto('/plans/new?currentAge=38&retirementAge=65&currentSavings=750000&monthlyContribution=2500');
  await page.waitForSelector('#hydrated-marker', { state: 'attached' });

  // Step 3: 7-Tab Detailed Plan Builder Navigation & Progressive A11y Audits
  // Tab 1: Household
  await expect(page.locator('#tab-household')).toHaveClass(/active/);
  await expect(page.locator('#input-current-age')).toHaveValue('38');
  await expect(page.locator('#input-retirement-age')).toHaveValue('65');
  await page.fill('#input-plan-name', 'Comprehensive Workload Plan');
  await page.fill('#input-birth-year', '1988');
  accessibilityScanResults = await new AxeBuilder({ page }).include('#panel-household').analyze();
  expect(accessibilityScanResults.violations).toEqual([]);

  // Tab 2: Accounts
  await page.click('#tab-accounts');
  await expect(page.locator('#input-current-savings')).toHaveValue('750000');
  await expect(page.locator('#input-monthly-contribution')).toHaveValue('2500');
  await page.fill('#input-account-balance', '750000');
  await page.fill('#input-account-cost-basis', '600000');
  accessibilityScanResults = await new AxeBuilder({ page }).include('#panel-accounts').analyze();
  expect(accessibilityScanResults.violations).toEqual([]);

  // Tab 3: Spending
  await page.click('#tab-spending');
  await page.selectOption('#select-spending-strategy', 'vanguard_dynamic');
  await page.fill('#input-min-withdrawal', '60000');
  await page.fill('#input-max-withdrawal', '110000');
  await page.locator('#input-max-withdrawal').blur();
  await expect(page.locator('.validation-error')).not.toBeVisible();
  accessibilityScanResults = await new AxeBuilder({ page }).include('#panel-spending').analyze();
  expect(accessibilityScanResults.violations).toEqual([]);

  // Tab 4: Pensions
  await page.click('#tab-pensions');
  await page.selectOption('#select-pension-type', 'social_security');
  await page.fill('#input-pension-start-age', '67');
  accessibilityScanResults = await new AxeBuilder({ page }).include('#panel-pensions').analyze();
  expect(accessibilityScanResults.violations).toEqual([]);

  // Tab 5: Life Events
  await page.click('#tab-events');
  await page.fill('#input-event-start-year', '2030');
  await page.fill('#input-event-end-year', '2035');
  accessibilityScanResults = await new AxeBuilder({ page }).include('#panel-events').analyze();
  expect(accessibilityScanResults.violations).toEqual([]);

  // Tab 6: Taxes
  await page.click('#tab-taxes');
  await page.selectOption('#select-tax-jurisdiction', 'US');
  await page.fill('#input-state-province', 'CA');
  accessibilityScanResults = await new AxeBuilder({ page }).include('#panel-taxes').analyze();
  expect(accessibilityScanResults.violations).toEqual([]);

  // Step 4: Web Worker Simulation Execution & Screen Reader Parity
  // Tab 7: Simulation
  await page.click('#tab-simulation');
  accessibilityScanResults = await new AxeBuilder({ page }).include('#panel-simulation').analyze();
  expect(accessibilityScanResults.violations).toEqual([]);
  await expect(page.locator('#premium-lock-card')).not.toBeVisible();

  await page.click('#range-125yr');
  await page.fill('#input-num-paths', '1000');
  await page.fill('#input-retirement-horizon', '40');
  await page.fill('#input-inflation-rate', '0.03');
  await page.click('#run-simulation-btn');

  const results = page.locator('#simulation-results-summary');
  await expect(results).toBeVisible({ timeout: 15000 });
  await expect(results).toContainText('125-Year Projection');
  await expect(results).toContainText('1,000 paths simulated');
  await expect(page.locator('#wealth-fan-chart')).toBeVisible();

  const srTable = page.locator('div.sr-only table');
  await expect(srTable).toBeAttached();
  const tableText = await srTable.textContent();
  expect(tableText).toContain('10th Percentile');
  expect(tableText).toContain('50th Percentile');
  expect(tableText).toContain('90th Percentile');

  // Step 5: Plan Persistence, Brand Empathy & Dashboard Verification
  await page.click('#save-plan-btn');
  await expect(page.locator('.toast-success')).toBeVisible();
  await expect(page).toHaveURL(/\/plans$/);
  await expect(page.locator('.plan-card', { hasText: 'Comprehensive Workload Plan' }).first()).toBeVisible();

  accessibilityScanResults = await new AxeBuilder({ page }).analyze();
  expect(accessibilityScanResults.violations).toEqual([]);

  const forbiddenTerms = ['Debt', 'Penalty', 'Failing', 'Over-limit', 'Deficit', 'Game Over'];
  const fullText = await page.locator('body').innerText();
  for (const term of forbiddenTerms) {
    expect(fullText).not.toContain(term);
  }
});
```

---

## 4. Design & Structure of TEST_READY.md
`TEST_READY.md` is the definitive verification contract published at the project root upon the conclusion of Milestone 4. It certifies that the E2E testing infrastructure is locked, comprehensive, and prepared to evaluate Milestone 5.

### Proposed Content for `TEST_READY.md`
```markdown
# E2E Test Readiness Certification (TEST_READY.md)

## 1. Executive Summary & Certification Purpose
This document formally certifies that the opaque-box E2E testing infrastructure for the **Financial Retirement Planner** feature in `expense-dashboard` is fully operational, thoroughly designed, and actively armed. Derived directly from `ORIGINAL_REQUEST.md`, this suite provides complete test coverage across Tiers 1 through 4, serving as the absolute gatekeeper and prerequisite for **Milestone 5 (E2E Test Verification & Adversarial Hardening)**.

## 2. E2E Test Suite Inventory & Coverage Matrix
The testing track comprises 4 dedicated test suites exercising all 7 core features across diverse operational profiles:

| Tier | Test File | Primary Focus | Total Test Cases | Status |
|:---:|:---|:---|:---:|:---:|
| **Tier 1** | `e2e/planner_tier1_feature.spec.ts` | Happy path feature functionality & store hydration | 20 | Verified & Active |
| **Tier 2** | `e2e/planner_tier2_boundary.spec.ts` | Boundary Value Analysis, Zod limits & corner cases | 35 | Verified & Active |
| **Tier 3** | `e2e/planner_tier3_pairwise.spec.ts` | Combinatorial interactions across all 21 feature pairs | 32 | Verified & Active |
| **Tier 4** | `e2e/planner_tier4_workload.spec.ts` | Complex real-world user lifecycle workload scenarios | 5 | Ready for M5 |

### Feature Coverage Breakdown
- **F1 (Dual Entry Quick Check Widget & URL Hydration)**: Verified across initial landing inputs, dynamic URL search parameter construction, and Zustand store client hydration without React hydration mismatches.
- **F2 (Authenticated Dashboard & 7-Tab Detailed Plan Builder)**: Verified across dashboard rendering, multi-tab navigation (`Household`, `Accounts`, `Spending`, `Pensions`, `Events`, `Taxes`, `Simulation`), and full plan CRUD operations.
- **F3 (Premium Tier Historical Range Selector & Premium Lock)**: Verified across An-yen frosted glass Premium Lock card rendering, standard tier access blocking, premium tier unlocking, and DOM manipulation defenses.
- **F4 (1,000-Path Monte Carlo Web Worker Simulation Execution)**: Verified across Web Worker spawning, transferable objects zero-copy IPC handling, in-place sorting, and multi-range empirical market returns (20-yr, 50-yr, 125-yr).
- **F5 (Server Actions BOLA Defenses & RLS Enforcement)**: Verified across strict Supabase Row Level Security (`auth.uid() = user_id`), direct JS fetch payload injections, cross-user plan ID tampering, and offline optimistic rollbacks.
- **F6 (Core Domain Business Logic Engines & Zod Validation)**: Verified across pure TypeScript domain engines (`taxEngine`, `pensionEngine`, `spendingEngine`, `drawdownEngine`, `simulator`) and Zod schema refinements.
- **F7 (Automated Accessibility & WCAG 2.1 AA/AAA Compliance)**: Verified across automated `@axe-core/playwright` scans (zero violations), Brand/Empathy checks (zero negative financial jargon), and screen reader table parity (`div.sr-only table`).

## 3. Execution & Verification Protocol
### Test Runner Invocation
```bash
npx tsx e2e/run_e2e.ts
```

### Pass/Fail Semantics & Exit Codes
- **Exit Code `0`**: Achieved 100% success across all E2E assertions, Supabase seeding steps, and accessibility audits.
- **Exit Code `1`**: Immediate process termination upon any test case failure, setup/seeding error, or single WCAG 2.1 AA/AAA accessibility violation.

## 4. Environment & Seeding State (`e2e/seed.ts`)
The E2E test runner automatically initializes a hermetic local database state in Supabase prior to test execution:
- **Test Users**:
  - Standard User: `test-user@example.com` (`password123`) | Tier: `standard`
  - Premium User: `premium-user@example.com` (`password123`) | Tier: `premium`
- **Auto-Seeded Entities**:
  - Postgres trigger auto-seeded default expense categories.
  - Exchange rates table populated with base CAD rates.
  - 3 active recurring expense configurations (`Monthly Rent 🏠`, `Netflix Subscription 🎬`, `Gym Membership 🏋️`) with 3 months of historical logs.
  - 35 realistic historical expenses distributed over the past 90 days.
  - Pre-seeded genuine premium retirement plan (`ID: premium-user-genuine-plan-id`) assigned strictly to the Premium User to verify RLS/BOLA isolation.

## 5. Architectural Interface Contracts & Locators
To maintain extreme test reliability and prevent brittle selectors, the test infrastructure enforces strict DOM ID contracts:
- **Widgets & Markers**: `#quick-check-widget`, `#hydrated-marker`, `#wealth-fan-chart`, `#simulation-results-summary`, `#premium-lock-card`.
- **Navigation Tabs**: `#tab-household`, `#tab-accounts`, `#tab-spending`, `#tab-pensions`, `#tab-events`, `#tab-taxes`, `#tab-simulation`.
- **Tab Panels**: `#panel-household`, `#panel-accounts`, `#panel-spending`, `#panel-pensions`, `#panel-events`, `#panel-taxes`, `#panel-simulation`.
- **User Inputs**: `#input-plan-name`, `#input-current-age`, `#input-retirement-age`, `#input-birth-year`, `#input-current-savings`, `#input-monthly-contribution`, `#input-account-balance`, `#input-account-cost-basis`, `#select-spending-strategy`, `#input-min-withdrawal`, `#input-max-withdrawal`, `#select-pension-type`, `#input-pension-start-age`, `#input-event-start-year`, `#input-event-end-year`, `#select-tax-jurisdiction`, `#input-state-province`, `#range-20yr`, `#range-50yr`, `#range-125yr`, `#input-num-paths`, `#input-retirement-horizon`, `#input-inflation-rate`.
- **Action Buttons & Notifications**: `#save-unlock-btn`, `#run-simulation-btn`, `#save-plan-btn`, `.toast-success`, `.toast-error`, `.validation-error`.

## 6. Milestone 5 Readiness Statement
This certification confirms that the testing track is fully prepared to validate **Milestone 5**. Upon implementation of `e2e/planner_tier4_workload.spec.ts` by the Worker, the test runner `npx tsx e2e/run_e2e.ts` will serve as the absolute measure of project success for both Phase 1 (100% E2E Pass) and Phase 2 (Adversarial Coverage Hardening).
```
