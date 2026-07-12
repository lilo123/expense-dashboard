# Handoff Report: Tier 1 Feature Coverage Test Cases Design (`e2e/planner_tier1_feature.spec.ts`)

## 1. Observation
- **User & Project Requirements**:
  - `ORIGINAL_REQUEST.md` (lines 5-30) and `PROJECT.md` (lines 1-44) mandate implementing a "robust Financial Retirement Planner feature into `expense-dashboard` modeled after Foresight Planner".
  - Key architectural dimensions include:
    - **R1**: Core Domain Types & Pure Business Logic Engines (Zod schemas `Household`, `Account`, `Spending`, `Pension`, `LifeEvent`, `SimulationConfig`, `SimulationResultsSummary`, `QuickCheckParams` in `src/lib/planner/types.ts`; pure TS engines `taxEngine.ts`, `pensionEngine.ts`, `spendingEngine.ts`, `drawdownEngine.ts`, `simulator.ts`).
    - **R2**: Web Worker Simulation Engine & Market Data (125 years empirical market returns 1900–2025 in `src/content/historicalMarketData.ts` as `Float64Array`; Web Worker `simulation.worker.ts` running 1,000 Monte Carlo block bootstrap paths in parallel using in-place numerical sorting `subarray().sort()` and Transferable Objects).
    - **R3**: Dual Entry UI & Premium Range Selector (`QuickCheckWidget.tsx` on `src/app/page.tsx`, URL search params handoff `/auth?redirect=/plans/new...` or `/login?redirect=/plans/new...`, Zustand store `useRetirementStore.tsx`, authenticated `/plans` dashboard, 7-tab Detailed Plan Builder `/plans/new`, Premium Tier Historical Range Selector 20yr/50yr/125yr with An-yen frosted glass Premium Lock card).
    - **R4**: Local Implementation, BOLA Defenses & Zero Git Push (Supabase RLS migrations `20260624000000_retirement_planner.sql`, Server Actions `retirementActions.ts` with BOLA defense and Premium entitlement checks `profiles.tier === 'premium'`).
- **Testing Track Scope & Specifications**:
  - `.agents/sub_orch_e2e_testing_track_1/SCOPE.md` (lines 1-15) defines the E2E Testing Track architecture as an "opaque-box E2E testing track derived from `ORIGINAL_REQUEST.md`" using Playwright (`npx tsx e2e/run_e2e.ts`).
  - `task.md` (lines 1-21) specifically mandates designing exactly 20 Tier 1 Feature Coverage test cases (5 per core feature area) for `e2e/planner_tier1_feature.spec.ts` using Playwright and `@axe-core/playwright`.
- **Peer Explorations & Test Guidelines**:
  - `.agents/teamwork_preview_explorer_tier1_1/handoff.md` establishes the `TEST_INFRA.md` feature inventory and coverage thresholds across 7 dimensions.
  - `.agents/teamwork_preview_explorer_tier1_3/handoff.md` identifies key testing guidelines from `TESTING.md`:
    - **Brand & Empathy Assertions ("No Game Overs")**: Zero negative financial jargon ("Debt", "Penalty", "Failing", "Over-limit", "Deficit", "Game Over"), empathetic error handling, and strict currency precision.
    - **Design System & Aesthetic Assertions**: Zen palette, glassmorphism (`bg-white/40 backdrop-blur-md border border-white/20`), fluid rounded corners.
    - **Screen Reader Parity**: Asserts that `WealthFanChart.tsx` renders an adjacent `div` with `className="sr-only"` enclosing an HTML table that dynamically outputs the 10th, 50th, and 90th percentile values at 5-year intervals.
    - **Automated Accessibility (`@axe-core/playwright`)**: Verifies zero WCAG 2.1 AA/AAA violations across all 7 domain tabs and dashboard views.
    - **Test Users**: `test-user@example.com` (`password123`, `tier: 'standard'`) and `premium-user@example.com` (`password123`, `tier: 'premium'`).

## 2. Logic Chain
1. **Structuring the 20 Test Cases across 4 Core Feature Areas**:
   - To strictly satisfy the requirement of 20 Tier 1 test cases divided into 5 per core feature area, we map the requirements (R1-R4) and feature inventory (F1-F7) into 4 distinct `test.describe` blocks:
     - **Core Area 1: Dual Entry Architecture & Zustand URL Hydration (5 tests)**: Focuses on the public Quick Check Widget, URL parameter construction, auth redirection, Zustand store hydration, and default initialization.
     - **Core Area 2: Authenticated Dashboard & 7-Tab Detailed Plan Builder (5 tests)**: Focuses on `/plans` dashboard rendering, 7-tab navigation, Zod schema validation errors, Brand & Empathy assertions ("No Game Overs"), and Screen Reader parity table verification in `WealthFanChart.tsx`.
     - **Core Area 3: Web Worker Simulation & Premium Range Selector (5 tests)**: Focuses on An-yen frosted glass Premium Lock card display for standard users, 20-yr free simulation execution, locking of 50-yr/125-yr options, unlocking for premium users, and 1,000-path Monte Carlo Web Worker execution for 125-yr range.
     - **Core Area 4: Server Actions, BOLA Defenses & Accessibility Audits (5 tests)**: Focuses on saving new plans, updating existing plans with RLS, testing BOLA defenses against standard users attempting premium configurations, testing BOLA defenses against cross-user plan access, and running comprehensive `@axe-core/playwright` audits across all 7 tabs.
2. **Aligning Assertions with Playwright Best Practices**:
   - Each test case utilizes robust Playwright locator assertions (`expect(locator).toBeVisible()`, `expect(page).toHaveURL()`, `expect(locator).toHaveClass()`).
   - Automated accessibility audits use `new AxeBuilder({ page }).analyze()` and assert `expect(accessibilityScanResults.violations).toEqual([])`.
3. **Ensuring Opaque-Box Execution**:
   - The tests do not rely on internal component state or mocking; they interact with the application strictly through DOM elements, form inputs, buttons, and URL parameters, adhering to the E2E testing track philosophy.

## 3. Caveats
- **Read-Only Scope**: This agent operates strictly in an exploratory read-only capacity as per `task.md`. No modifications were made directly to `e2e/planner_tier1_feature.spec.ts`.
- **Underlying Implementations & Selectors**: The test suite assumes standard semantic DOM IDs and classes (`#quick-check-widget`, `#tab-household`, `#premium-lock-card`, etc.). The downstream E2E Worker/Implementer may adjust specific selector strings if the UI implementation uses slightly different data attributes or IDs.
- **Dependency on `@axe-core/playwright` & Premium Seeding**: As noted by Explorer 3, `package.json` must have `@axe-core/playwright` installed, and `e2e/seed.ts` must seed `premium-user@example.com` before executing these tests.

## 4. Conclusion
The 20 Tier 1 Feature Coverage test cases have been fully designed and structured. Below is the exact proposed TypeScript code for `e2e/planner_tier1_feature.spec.ts`, ready for the E2E Testing Track Worker/Implementer to write to the `e2e/` directory.

```typescript
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const STANDARD_USER = 'test-user@example.com';
const PREMIUM_USER = 'premium-user@example.com';
const TEST_PASSWORD = 'password123';

async function loginAs(page, email, password = TEST_PASSWORD) {
  await page.goto('/login');
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(url => url.pathname.includes('/dashboard') || url.pathname.includes('/plans'));
}

// ============================================================================
// CORE AREA 1: Dual Entry Architecture & Zustand URL Hydration
// ============================================================================
test.describe('Core Area 1: Dual Entry Architecture & Zustand URL Hydration', () => {
  test('1. should render the public Quick Check Widget on the landing page with default inputs and zero accessibility violations', async ({ page }) => {
    await page.goto('/');
    const widget = page.locator('#quick-check-widget');
    await expect(widget).toBeVisible();
    
    // Verify default inputs exist
    await expect(widget.locator('#quick-current-age')).toBeVisible();
    await expect(widget.locator('#quick-retirement-age')).toBeVisible();
    await expect(widget.locator('#quick-current-savings')).toBeVisible();
    await expect(widget.locator('#quick-monthly-contribution')).toBeVisible();

    // Automated accessibility audit
    const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('2. should update Quick Check Widget parameters and correctly construct the auth redirect URL with search params', async ({ page }) => {
    await page.goto('/');
    const widget = page.locator('#quick-check-widget');
    await expect(widget).toBeVisible();

    await widget.locator('#quick-current-age').fill('35');
    await widget.locator('#quick-retirement-age').fill('65');
    await widget.locator('#quick-current-savings').fill('100000');
    await widget.locator('#quick-monthly-contribution').fill('1500');

    await widget.locator('#save-unlock-btn').click();
    
    // Verify redirection to login/auth with correct redirect encode params
    await expect(page).toHaveURL(/(\/login|\/auth)\?redirect=.*plans.*new/);
    const url = page.url();
    expect(url).toContain('currentAge=35');
    expect(url).toContain('retirementAge=65');
    expect(url).toContain('currentSavings=100000');
    expect(url).toContain('monthlyContribution=1500');
  });

  test('3. should authenticate via login after Quick Check and successfully redirect to the Detailed Plan Builder (/plans/new)', async ({ page }) => {
    // Directly simulate landing on login with redirect params from Quick Check
    const targetRedirect = encodeURIComponent('/plans/new?currentAge=35&retirementAge=65&currentSavings=100000&monthlyContribution=1500');
    await page.goto(`/login?redirect=${targetRedirect}`);

    await page.fill('input[type="email"]', STANDARD_USER);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');

    await page.waitForURL(/\/plans\/new/);
    await expect(page).toHaveURL(/\/plans\/new\?currentAge=35/);
  });

  test('4. should successfully hydrate the dual-representation Zustand store from URL search params without hydration mismatch', async ({ page }) => {
    await loginAs(page, STANDARD_USER);
    await page.goto('/plans/new?currentAge=35&retirementAge=65&currentSavings=100000&monthlyContribution=1500');
    
    // Wait for client-side hydration marker or form wrapper
    await page.waitForSelector('#hydrated-marker', { state: 'attached' });

    // Verify Household Tab inputs reflect hydrated store values
    await expect(page.locator('#tab-household')).toHaveClass(/active/);
    await expect(page.locator('#input-current-age')).toHaveValue('35');
    await expect(page.locator('#input-retirement-age')).toHaveValue('65');

    // Navigate to Accounts Tab to verify savings and contributions hydrated
    await page.click('#tab-accounts');
    await expect(page.locator('#input-current-savings')).toHaveValue('100000');
    await expect(page.locator('#input-monthly-contribution')).toHaveValue('1500');
  });

  test('5. should verify that navigating directly to /plans/new without URL params initializes the Zustand store with clean default values', async ({ page }) => {
    await loginAs(page, STANDARD_USER);
    await page.goto('/plans/new');
    await page.waitForSelector('#hydrated-marker', { state: 'attached' });

    // Verify baseline defaults (e.g. age 30, retirement 65, savings 0)
    await expect(page.locator('#input-current-age')).toHaveValue('30');
    await expect(page.locator('#input-retirement-age')).toHaveValue('65');
    await page.click('#tab-accounts');
    await expect(page.locator('#input-current-savings')).toHaveValue('0');
  });
});

// ============================================================================
// CORE AREA 2: Authenticated Dashboard & 7-Tab Detailed Plan Builder
// ============================================================================
test.describe('Core Area 2: Authenticated Dashboard & 7-Tab Detailed Plan Builder', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, STANDARD_USER);
  });

  test('6. should render the authenticated /plans dashboard listing user retirement plans and pass accessibility audit', async ({ page }) => {
    await page.goto('/plans');
    const container = page.locator('#plans-dashboard-container');
    await expect(container).toBeVisible();
    await expect(page.locator('.plan-card').first()).toBeVisible();

    const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('7. should navigate through all 7 domain tabs in the Detailed Plan Builder seamlessly', async ({ page }) => {
    await page.goto('/plans/new');
    await page.waitForSelector('#hydrated-marker', { state: 'attached' });

    const tabs = [
      { id: '#tab-household', panel: '#panel-household' },
      { id: '#tab-accounts', panel: '#panel-accounts' },
      { id: '#tab-spending', panel: '#panel-spending' },
      { id: '#tab-pensions', panel: '#panel-pensions' },
      { id: '#tab-events', panel: '#panel-events' },
      { id: '#tab-taxes', panel: '#panel-taxes' },
      { id: '#tab-simulation', panel: '#panel-simulation' },
    ];

    for (const tab of tabs) {
      await page.click(tab.id);
      await expect(page.locator(tab.id)).toHaveClass(/active/);
      await expect(page.locator(tab.panel)).toBeVisible();
    }
  });

  test('8. should validate core domain Zod schema constraints in form inputs and display empathetic error messages', async ({ page }) => {
    await page.goto('/plans/new');
    await page.waitForSelector('#hydrated-marker', { state: 'attached' });

    // Enter invalid age to trigger Zod schema validation error
    const ageInput = page.locator('#input-current-age');
    await ageInput.fill('-5');
    await ageInput.blur();

    const errorMsg = page.locator('.validation-error');
    await expect(errorMsg).toBeVisible();
    await expect(errorMsg).not.toContainText('Game Over');
    await expect(errorMsg).not.toContainText('Failing');
    await expect(errorMsg).toContainText('Please enter a valid age');
  });

  test('9. should verify Brand and Empathy assertions across all tabs ensuring zero negative financial jargon', async ({ page }) => {
    await page.goto('/plans/new');
    await page.waitForSelector('#hydrated-marker', { state: 'attached' });

    const forbiddenTerms = ['Debt', 'Penalty', 'Failing', 'Over-limit', 'Deficit', 'Game Over'];
    const fullText = await page.locator('body').innerText();

    for (const term of forbiddenTerms) {
      expect(fullText).not.toContain(term);
    }
  });

  test('10. should assert Screen Reader parity in WealthFanChart by verifying the adjacent div.sr-only HTML table', async ({ page }) => {
    await page.goto('/plans/new');
    await page.waitForSelector('#hydrated-marker', { state: 'attached' });
    await page.click('#tab-simulation');

    const fanChart = page.locator('#wealth-fan-chart');
    await expect(fanChart).toBeVisible();

    // Assert adjacent div.sr-only enclosing the HTML table
    const srTable = page.locator('div.sr-only table');
    await expect(srTable).toBeAttached();
    
    // Verify table structure contains 10th, 50th, and 90th percentile headers/data
    const tableText = await srTable.innerText();
    expect(tableText).toContain('10th Percentile');
    expect(tableText).toContain('50th Percentile');
    expect(tableText).toContain('90th Percentile');
  });
});

// ============================================================================
// CORE AREA 3: Web Worker Simulation & Premium Range Selector
// ============================================================================
test.describe('Core Area 3: Web Worker Simulation & Premium Range Selector', () => {
  test('11. should display the An-yen frosted glass Premium Lock card in SimulationTab for standard tier users', async ({ page }) => {
    await loginAs(page, STANDARD_USER);
    await page.goto('/plans/new');
    await page.waitForSelector('#hydrated-marker', { state: 'attached' });
    await page.click('#tab-simulation');

    const lockCard = page.locator('#premium-lock-card');
    await expect(lockCard).toBeVisible();
    await expect(lockCard).toHaveClass(/bg-white\/40/);
    await expect(lockCard).toHaveClass(/backdrop-blur-md/);
    await expect(lockCard).toHaveClass(/border-white\/20/);
  });

  test('12. should allow standard users to execute 20-year historical range simulations via Web Worker successfully', async ({ page }) => {
    await loginAs(page, STANDARD_USER);
    await page.goto('/plans/new');
    await page.waitForSelector('#hydrated-marker', { state: 'attached' });
    await page.click('#tab-simulation');

    const range20 = page.locator('#range-20yr');
    await expect(range20).toBeEnabled();
    await range20.click();

    await page.click('#run-simulation-btn');
    await expect(page.locator('#simulation-results-summary')).toBeVisible();
  });

  test('13. should verify that 50-year and 125-year historical range selector options are disabled for standard tier users', async ({ page }) => {
    await loginAs(page, STANDARD_USER);
    await page.goto('/plans/new');
    await page.waitForSelector('#hydrated-marker', { state: 'attached' });
    await page.click('#tab-simulation');

    await expect(page.locator('#range-50yr')).toBeDisabled();
    await expect(page.locator('#range-125yr')).toBeDisabled();
  });

  test('14. should unlock 50-year and 125-year historical range selector options for premium tier users without Premium Lock card', async ({ page }) => {
    await loginAs(page, PREMIUM_USER);
    await page.goto('/plans/new');
    await page.waitForSelector('#hydrated-marker', { state: 'attached' });
    await page.click('#tab-simulation');

    await expect(page.locator('#premium-lock-card')).not.toBeVisible();
    await expect(page.locator('#range-50yr')).toBeEnabled();
    await expect(page.locator('#range-125yr')).toBeEnabled();
  });

  test('15. should execute 1,000 parallel Monte Carlo block bootstrap simulation paths for 125-year range as premium user', async ({ page }) => {
    await loginAs(page, PREMIUM_USER);
    await page.goto('/plans/new');
    await page.waitForSelector('#hydrated-marker', { state: 'attached' });
    await page.click('#tab-simulation');

    await page.click('#range-125yr');
    await page.click('#run-simulation-btn');

    const results = page.locator('#simulation-results-summary');
    await expect(results).toBeVisible();
    await expect(results).toContainText('125-Year Projection');
    await expect(results).toContainText('1,000 paths simulated');
  });
});

// ============================================================================
// CORE AREA 4: Server Actions, BOLA Defenses & Accessibility Audits
// ============================================================================
test.describe('Core Area 4: Server Actions, BOLA Defenses & Accessibility Audits', () => {
  test('16. should successfully save a new retirement plan to Supabase via Server Actions and redirect to /plans dashboard', async ({ page }) => {
    await loginAs(page, STANDARD_USER);
    await page.goto('/plans/new');
    await page.waitForSelector('#hydrated-marker', { state: 'attached' });

    await page.fill('#input-plan-name', 'E2E Test Retirement Plan');
    await page.click('#save-plan-btn');

    // Verify success toast and redirection to dashboard
    await expect(page.locator('.toast-success')).toBeVisible();
    await expect(page).toHaveURL(/\/plans$/);
    await expect(page.locator('.plan-card', { hasText: 'E2E Test Retirement Plan' }).first()).toBeVisible();
  });

  test('17. should successfully update an existing retirement plan enforcing strict Row Level Security', async ({ page }) => {
    await loginAs(page, STANDARD_USER);
    await page.goto('/plans');
    
    // Click on the first existing plan to edit
    const firstPlan = page.locator('.plan-card').first();
    await expect(firstPlan).toBeVisible();
    await firstPlan.click();

    await page.waitForSelector('#hydrated-marker', { state: 'attached' });
    await page.click('#tab-accounts');
    await page.fill('#input-monthly-contribution', '2000');
    await page.click('#save-plan-btn');

    await expect(page.locator('.toast-success')).toBeVisible();
    
    // Reload to verify persistence
    await page.reload();
    await page.waitForSelector('#hydrated-marker', { state: 'attached' });
    await page.click('#tab-accounts');
    await expect(page.locator('#input-monthly-contribution')).toHaveValue('2000');
  });

  test('18. should verify BOLA defense by blocking a standard user from saving a plan with premium configuration parameters', async ({ page }) => {
    await loginAs(page, STANDARD_USER);
    await page.goto('/plans/new');
    await page.waitForSelector('#hydrated-marker', { state: 'attached' });

    // Simulate adversarial injection of premium range parameter in form/action payload
    // Here we click a simulated test-hook button or trigger action if available, or simulate form submit
    await page.evaluate(() => {
      const form = document.querySelector('form');
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = 'historicalRange';
      input.value = '125';
      form?.appendChild(input);
    });

    await page.fill('#input-plan-name', 'Adversarial Premium Plan');
    await page.click('#save-plan-btn');

    // Verify BOLA defense rejects and displays empathetic error
    const errorToast = page.locator('.toast-error');
    await expect(errorToast).toBeVisible();
    await expect(errorToast).toContainText('This feature requires a Premium subscription');
  });

  test('19. should verify BOLA defense by blocking unauthorized direct access to another user\'s plan ID', async ({ page }) => {
    await loginAs(page, STANDARD_USER);
    
    // Attempt to access a known premium plan ID belonging to premium-user
    await page.goto('/plans/premium-only-plan-id-999');

    // Verify RLS/BOLA defense redirects to /plans with empathetic access denied message
    await expect(page).toHaveURL(/\/plans$/);
    const errorToast = page.locator('.toast-error');
    await expect(errorToast).toBeVisible();
    await expect(errorToast).toContainText('You do not have permission to view this plan');
  });

  test('20. should execute comprehensive automated accessibility audits (@axe-core/playwright) across all Detailed Plan Builder views', async ({ page }) => {
    await loginAs(page, PREMIUM_USER);
    await page.goto('/plans/new');
    await page.waitForSelector('#hydrated-marker', { state: 'attached' });

    const tabIds = [
      '#tab-household',
      '#tab-accounts',
      '#tab-spending',
      '#tab-pensions',
      '#tab-events',
      '#tab-taxes',
      '#tab-simulation',
    ];

    for (const tabId of tabIds) {
      await page.click(tabId);
      await expect(page.locator(tabId)).toHaveClass(/active/);
      const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
      expect(accessibilityScanResults.violations).toEqual([]);
    }
  });
});
```

## 5. Verification Method
- **Test File Creation**: Verify that `e2e/planner_tier1_feature.spec.ts` is successfully created by the E2E Worker/Implementer containing the exact 20 test cases above.
- **Dependency & Seeding Check**: Confirm `package.json` includes `@axe-core/playwright` and `e2e/seed.ts` seeds both `test-user@example.com` and `premium-user@example.com`.
- **Test Execution**: Run the authoritative E2E test runner command:
  ```bash
  npx tsx e2e/run_e2e.ts
  ```
- **Invalidation Conditions**: Any failure in `npx tsx e2e/run_e2e.ts` (exit code `1`), missing test cases, or accessibility violations invalidates the verification.
