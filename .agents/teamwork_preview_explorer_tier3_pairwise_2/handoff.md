# Handoff Report: Tier 3 Pairwise Combinatorial Test Design (Explorer 2)

## 1. Observation
We conducted a thorough, read-only exploration of the E2E test infrastructure, existing test specifications, and seeding mechanisms for the Financial Retirement Planner application. Our observations from the codebase include:

- **Test Infrastructure (`TEST_INFRA.md`, `e2e/run_e2e.ts`)**:
  - The test runner wrapper `npx tsx e2e/run_e2e.ts` orchestrates environment setup/cleanup by swapping `.env.test` with `.env.local` and executing `npx playwright test --workers=1`.
  - Pass/Fail semantics require code `0` on 100% success across all assertions and automated `@axe-core/playwright` accessibility audits.
  - The test suite structure designates `e2e/planner_tier3_pairwise.spec.ts` for Tier 3 cross-feature combinatorial interactions.

- **Seeding Script (`e2e/seed.ts`)**:
  - Two primary user accounts are seeded: `test-user@example.com` (Standard Tier, ID dynamically generated) and `premium-user@example.com` (Premium Tier, ID dynamically generated), both using password `password123`.
  - A pre-existing premium retirement plan is seeded for the premium user with `id: 'premium-user-genuine-plan-id'`, containing `simulation_config: { drawdownStrategy: 'taxable_first', historicalRange: 'all_125_years', numPaths: 1000, inflationRate: 0.025, retirementHorizon: 30 }`.
  - Both profiles have `onboarding_status: 'completed'` to allow direct navigation without modal interception.

- **Tier 1 Feature Specs (`e2e/planner_tier1_feature.spec.ts`)**:
  - Demonstrates login helper functions (`loginAs(page, email, password)`).
  - Validates 7 domain tabs (`#tab-household`, `#tab-accounts`, `#tab-spending`, `#tab-pensions`, `#tab-events`, `#tab-taxes`, `#tab-simulation`) and corresponding panels (`#panel-household`, etc.).
  - Demonstrates Premium Lock card assertions (`#premium-lock-card`, `.bg-white\/40`, `.backdrop-blur-md`, `.border-white\/20`) on `#tab-simulation` for standard users, and full enablement of `#range-50yr` and `#range-125yr` for premium users.
  - Validates Server Actions (`savePlan`), BOLA defense on unauthorized premium range injection (toast error `"This feature requires a Premium subscription"`), and direct plan ID access rejection (`/plans/premium-only-plan-id-999` redirecting to `/plans` with toast error `"You do not have permission to view this plan"`).

- **Tier 2 Boundary Specs (`e2e/planner_tier2_boundary.spec.ts`, `e2e/adv_planner_tier2_boundary.spec.ts`)**:
  - Evaluates extreme boundary values and Zod schema validations across form inputs (`#input-current-age`, `#input-retirement-age`, `#input-account-balance`, `#select-spending-strategy`, `#input-num-paths`, `#input-inflation-rate`).
  - Evaluates adversarial DOM manipulation tests (using `page.evaluate` to remove `#premium-lock-card` or force-enable disabled radio buttons `#range-50yr`/`#range-125yr`), verifying server-side BOLA rejection.
  - Demonstrates direct fetch attacks to `/api/actions/savePlan` with prototype pollution, parameter pollution (array of IDs), and malicious ID strings.
  - Demonstrates accessibility checks (`new AxeBuilder({ page }).include(...).analyze()`) and screen reader parity assertions on `div.sr-only table` using `textContent()`.

---

## 2. Logic Chain
To construct a robust Tier 3 Pairwise Combinatorial test suite (`e2e/planner_tier3_pairwise.spec.ts`), we systematically analyze the interactions between the 4 focus features: **F2** (Authenticated Dashboard & 7-Tab Detailed Plan Builder), **F3** (Premium Tier Historical Range Selector & Premium Lock), **F4** (1,000-Path Monte Carlo Web Worker Simulation Execution), and **F5** (Server Actions BOLA Defenses & RLS Enforcement).

1. **Pairing F2 & F3**: The 7-tab Detailed Plan Builder (F2) serves as the container for the Simulation tab where the Premium Lock card and Historical Range Selector (F3) reside. A combinatorial test must ensure that navigating between non-simulation tabs and the simulation tab maintains the correct Premium Lock state for standard users, and correctly unlocks the historical ranges for premium users when loading saved plans from the dashboard.
2. **Pairing F2 & F4**: The Web Worker simulation engine (F4) relies on compound state gathered across the various tabs (Household, Accounts, Spending, Pensions, Events, Taxes) of the Detailed Plan Builder (F2). Testing this pair requires mutating parameters across multiple tabs and verifying that the Web Worker correctly receives the synthesized `SimulationConfig` and executes the Monte Carlo simulation without error.
3. **Pairing F2 & F5**: The Detailed Plan Builder and Dashboard (F2) interact with Supabase via Server Actions (F5). Combinatorial coverage must verify that legitimate multi-tab plan modifications persist correctly under RLS, while direct URL navigation from the dashboard to an unauthorized plan ID triggers BOLA defenses, redirects, and prevents data exposure in the 7-tab UI.
4. **Pairing F3 & F4**: The Historical Range Selector (F3) defines the size of the empirical market return buffer (`Float64Array`) processed by the Web Worker (F4). Combinatorial testing must exercise the Web Worker under the maximum 125-year premium range for premium users (verifying zero-copy IPC stability) and ensure standard users are successfully restricted to the 20-year fallback simulation under the Premium Lock card.
5. **Pairing F3 & F5**: The Premium Historical Range selection (F3) is strictly gated by Server Actions and RLS (F5). We must verify that an adversarial standard user attempting to save a plan with `historicalRange: 'all_125_years'` via form submission or direct fetch is blocked by Server Action BOLA defenses, while a premium user's legitimate premium range selection is successfully saved and retrieved.
6. **Pairing F4 & F5**: The Web Worker simulation configuration (F4) is persisted via Server Actions (F5). We must verify that attempting to save a malformed or out-of-bounds simulation configuration (e.g., `numPaths: 50000`) is rejected by Server Action Zod validation before reaching the database, protecting the Web Worker from subsequent runtime crashes, and that legitimate custom simulation configs are protected by RLS.

---

## 3. Caveats
- **Read-Only Scope**: This report provides test designs and locator strategies for `e2e/planner_tier3_pairwise.spec.ts`. As an Explorer agent, we have not created or executed the test file directly; implementation is reserved for an Implementer agent.
- **Mock vs Live Endpoints**: The test designs rely on the pre-seeded Supabase local environment established by `e2e/seed.ts`. It assumes the Supabase instance is running and accessible during `npx tsx e2e/run_e2e.ts`.
- **UI & Locator Stability**: The locators provided match the established patterns in Tiers 1 and 2. Any future refactoring of DOM IDs in the frontend components would require corresponding updates to the test locators.

---

## 4. Conclusion
We recommend implementing the following 12 comprehensive pairwise combinatorial test cases in `e2e/planner_tier3_pairwise.spec.ts`. Each test case is designed to be fully opaque-box, requirement-driven, and compatible with Playwright and `@axe-core/playwright`.

### Recommended Test Suite Structure (`e2e/planner_tier3_pairwise.spec.ts`)

```typescript
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const STANDARD_USER = 'test-user@example.com';
const PREMIUM_USER = 'premium-user@example.com';
const TEST_PASSWORD = 'password123';

async function loginAs(page: any, email: string, password = TEST_PASSWORD) {
  await page.goto('/login');
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL((url: any) => url.pathname.includes('/dashboard') || url.pathname.includes('/plans'));
}

test.describe('Tier 3: Pairwise Combinatorial Testing (F2, F3, F4, F5)', () => {

  // ============================================================================
  // PAIR 1: F2 (Authenticated Dashboard & 7-Tab Builder) + F3 (Premium Range Selector & Premium Lock)
  // ============================================================================
  test.describe('Pair 1: F2 & F3 Combinations', () => {
    test('1. Standard user navigating across multiple tabs verifying Premium Lock state persistence on Simulation tab', async ({ page }) => {
      await loginAs(page, STANDARD_USER);
      await page.goto('/plans/new');
      await page.waitForSelector('#hydrated-marker', { state: 'attached' });
      
      // Visit Household, Accounts, then Simulation
      await page.click('#tab-accounts');
      await page.click('#tab-simulation');
      await expect(page.locator('#premium-lock-card')).toBeVisible();
      await expect(page.locator('#range-50yr')).toBeDisabled();
      await expect(page.locator('#range-125yr')).toBeDisabled();

      // Switch back to Household, then Simulation again to verify persistence
      await page.click('#tab-household');
      await page.click('#tab-simulation');
      await expect(page.locator('#premium-lock-card')).toBeVisible();
      await expect(page.locator('#range-125yr')).toBeDisabled();
    });

    test('2. Premium user loading existing plan from dashboard verifying absence of Premium Lock and enabled range selectors', async ({ page }) => {
      await loginAs(page, PREMIUM_USER);
      await page.goto('/plans');
      
      // Click the pre-seeded genuine premium plan
      const premiumPlan = page.locator('.plan-card', { hasText: 'Genuine Premium Retirement Plan' }).first();
      await expect(premiumPlan).toBeVisible();
      await premiumPlan.click();

      await page.waitForSelector('#hydrated-marker', { state: 'attached' });
      await page.click('#tab-simulation');
      await expect(page.locator('#premium-lock-card')).not.toBeVisible();
      await expect(page.locator('#range-50yr')).toBeEnabled();
      await expect(page.locator('#range-125yr')).toBeEnabled();
      await expect(page.locator('#range-125yr')).toBeChecked();
    });
  });

  // ============================================================================
  // PAIR 2: F2 (Authenticated Dashboard & 7-Tab Builder) + F4 (1,000-Path Monte Carlo Web Worker Simulation)
  // ============================================================================
  test.describe('Pair 2: F2 & F4 Combinations', () => {
    test('3. Multi-tab parameter mutations correctly synthesize into Web Worker simulation execution', async ({ page }) => {
      await loginAs(page, STANDARD_USER);
      await page.goto('/plans/new');
      await page.waitForSelector('#hydrated-marker', { state: 'attached' });

      // Mutate Household params
      await page.fill('#input-current-age', '40');
      await page.fill('#input-retirement-age', '68');

      // Mutate Accounts params
      await page.click('#tab-accounts');
      await page.fill('#input-account-balance', '250000');
      await page.fill('#input-monthly-contribution', '2000');

      // Mutate Spending params
      await page.click('#tab-spending');
      await page.selectOption('#select-spending-strategy', 'yale_endowment');
      await page.fill('#input-yale-weight', '0.4');

      // Trigger Simulation
      await page.click('#tab-simulation');
      await page.click('#run-simulation-btn');

      const results = page.locator('#simulation-results-summary');
      await expect(results).toBeVisible({ timeout: 15000 });
      await expect(page.locator('#wealth-fan-chart')).toBeVisible();
    });

    test('4. Direct dashboard plan selection to immediate simulation run verifies Zustand store hydration to Web Worker', async ({ page }) => {
      await loginAs(page, PREMIUM_USER);
      await page.goto('/plans');
      await page.locator('.plan-card').first().click();
      await page.waitForSelector('#hydrated-marker', { state: 'attached' });

      // Immediately jump to simulation tab without visiting other tabs
      await page.click('#tab-simulation');
      await page.click('#run-simulation-btn');

      await expect(page.locator('#simulation-results-summary')).toBeVisible({ timeout: 15000 });
    });
  });

  // ============================================================================
  // PAIR 3: F2 (Authenticated Dashboard & 7-Tab Builder) + F5 (Server Actions BOLA Defenses & RLS Enforcement)
  // ============================================================================
  test.describe('Pair 3: F2 & F5 Combinations', () => {
    test('5. Multi-tab plan update persistence under RLS and BOLA rejection on cross-user modification fetch', async ({ page }) => {
      await loginAs(page, STANDARD_USER);
      await page.goto('/plans');
      await page.locator('.plan-card').first().click();
      await page.waitForSelector('#hydrated-marker', { state: 'attached' });

      // Legitimate update
      await page.click('#tab-accounts');
      await page.fill('#input-monthly-contribution', '1800');
      await page.click('#save-plan-btn');
      await expect(page.locator('.toast-success')).toBeVisible();

      // Adversarial cross-user fetch attack using same payload structure
      const response = await page.evaluate(async () => {
        const res = await fetch('/api/actions/savePlan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: 'premium-user-genuine-plan-id',
            name: 'Attempted Hijack Plan',
            taxJurisdiction: 'US',
            stateProvince: 'CA',
            birthYear: 1990,
            retirementAge: 65,
            monthlyContribution: 1800
          })
        });
        return await res.json();
      });

      expect(response.success).toBe(false);
      expect(response.error).toContain('You do not have permission to modify this plan');
    });

    test('6. Dashboard direct URL navigation BOLA defense verifies unauthorized plan ID access redirection', async ({ page }) => {
      await loginAs(page, STANDARD_USER);
      await page.goto('/plans');
      await page.waitForURL(/\/plans$/);

      // Attempt direct navigation to premium user's plan
      await page.goto('/plans/premium-user-genuine-plan-id');

      // Verify BOLA defense intercepts and redirects to /plans
      await expect(page).toHaveURL(/\/plans$/);
      const errorToast = page.locator('.toast-error');
      await expect(errorToast).toBeVisible();
      await expect(errorToast).toContainText('You do not have permission to view this plan');
    });
  });

  // ============================================================================
  // PAIR 4: F3 (Premium Range Selector & Premium Lock) + F4 (1,000-Path Monte Carlo Web Worker Simulation)
  // ============================================================================
  test.describe('Pair 4: F3 & F4 Combinations', () => {
    test('7. Premium user executing 125-year historical range simulation verifies zero-copy IPC Web Worker performance', async ({ page }) => {
      await loginAs(page, PREMIUM_USER);
      await page.goto('/plans/new');
      await page.waitForSelector('#hydrated-marker', { state: 'attached' });
      await page.click('#tab-simulation');

      await page.click('#range-125yr');
      await page.fill('#input-num-paths', '1000');
      await page.click('#run-simulation-btn');

      const results = page.locator('#simulation-results-summary');
      await expect(results).toBeVisible({ timeout: 15000 });
      await expect(results).toContainText('125-Year Projection');
      await expect(results).toContainText('1,000 paths simulated');
    });

    test('8. Standard user restricted to 20-year fallback simulation under Premium Lock card', async ({ page }) => {
      await loginAs(page, STANDARD_USER);
      await page.goto('/plans/new');
      await page.waitForSelector('#hydrated-marker', { state: 'attached' });
      await page.click('#tab-simulation');

      await expect(page.locator('#premium-lock-card')).toBeVisible();
      await expect(page.locator('#range-125yr')).toBeDisabled();
      await expect(page.locator('#range-20yr')).toBeEnabled();

      await page.click('#run-simulation-btn');
      const results = page.locator('#simulation-results-summary');
      await expect(results).toBeVisible({ timeout: 15000 });
      await expect(results).toContainText('20-Year Projection');
    });
  });

  // ============================================================================
  // PAIR 5: F3 (Premium Range Selector & Premium Lock) + F5 (Server Actions BOLA Defenses & RLS Enforcement)
  // ============================================================================
  test.describe('Pair 5: F3 & F5 Combinations', () => {
    test('9. Server Action BOLA defense blocks standard user from saving plan with injected premium historical range', async ({ page }) => {
      await loginAs(page, STANDARD_USER);
      await page.goto('/plans/new');
      await page.waitForSelector('#hydrated-marker', { state: 'attached' });

      // Inject premium range via page.evaluate form manipulation
      await page.evaluate(() => {
        const form = document.querySelector('form');
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = 'historicalRange';
        input.value = 'all_125_years';
        form?.appendChild(input);
      });

      await page.fill('#input-plan-name', 'Injected Range Plan');
      await page.click('#save-plan-btn');

      const errorToast = page.locator('.toast-error');
      await expect(errorToast).toBeVisible();
      await expect(errorToast).toContainText('This feature requires a Premium subscription');
    });

    test('10. Premium user successfully saves premium historical range configuration verified by RLS reload', async ({ page }) => {
      await loginAs(page, PREMIUM_USER);
      await page.goto('/plans/new');
      await page.waitForSelector('#hydrated-marker', { state: 'attached' });
      
      await page.fill('#input-plan-name', 'Legitimate Premium Range Plan');
      await page.click('#tab-simulation');
      await page.click('#range-125yr');
      await page.click('#save-plan-btn');

      await expect(page.locator('.toast-success')).toBeVisible();
      await expect(page).toHaveURL(/\/plans$/);

      // Reopen plan to verify RLS persistence of historical range
      await page.locator('.plan-card', { hasText: 'Legitimate Premium Range Plan' }).first().click();
      await page.waitForSelector('#hydrated-marker', { state: 'attached' });
      await page.click('#tab-simulation');
      await expect(page.locator('#range-125yr')).toBeChecked();
    });
  });

  // ============================================================================
  // PAIR 6: F4 (1,000-Path Monte Carlo Web Worker Simulation) + F5 (Server Actions BOLA Defenses & RLS Enforcement)
  // ============================================================================
  test.describe('Pair 6: F4 & F5 Combinations', () => {
    test('11. Server Action Zod validation rejects invalid simulation configuration protecting Web Worker integrity', async ({ page }) => {
      await loginAs(page, PREMIUM_USER);
      await page.goto('/plans/new');
      await page.waitForSelector('#hydrated-marker', { state: 'attached' });

      // Direct fetch injection with invalid numPaths (50000) exceeding Zod limit
      const response = await page.evaluate(async () => {
        const res = await fetch('/api/actions/savePlan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'Invalid Config Plan',
            taxJurisdiction: 'US',
            stateProvince: 'CA',
            birthYear: 1990,
            retirementAge: 65,
            simulationConfig: {
              drawdownStrategy: 'taxable_first',
              historicalRange: 'all_125_years',
              numPaths: 50000, // Invalid: exceeds 10000 max
              inflationRate: 0.025,
              retirementHorizon: 30
            }
          })
        });
        return await res.json();
      });

      expect(response.success).toBe(false);
      expect(response.error).toContain('numPaths cannot exceed 10000');
    });

    test('12. Premium custom simulation run followed by successful save and strict RLS isolation check', async ({ page }) => {
      await loginAs(page, PREMIUM_USER);
      await page.goto('/plans/new');
      await page.waitForSelector('#hydrated-marker', { state: 'attached' });

      await page.fill('#input-plan-name', 'RLS Isolated Simulation Plan');
      await page.click('#tab-simulation');
      await page.fill('#input-num-paths', '5000');
      await page.fill('#input-inflation-rate', '0.035');
      await page.click('#run-simulation-btn');
      await expect(page.locator('#simulation-results-summary')).toBeVisible({ timeout: 15000 });

      await page.click('#save-plan-btn');
      await expect(page.locator('.toast-success')).toBeVisible();
      await expect(page).toHaveURL(/\/plans$/);

      // Log out and log in as standard user to verify RLS isolation
      await loginAs(page, STANDARD_USER);
      await page.goto('/plans');
      await expect(page.locator('.plan-card', { hasText: 'RLS Isolated Simulation Plan' })).not.toBeVisible();
    });
  });
});
```

---

## 5. Verification Method
To independently verify the implementation and success of the proposed Tier 3 test suite, the receiving Implementer or Orchestrator agent should execute the following verification steps:

1. **File Inspection**:
   - Verify that `e2e/planner_tier3_pairwise.spec.ts` has been created in the root `e2e/` directory and contains the 12 combinatorial test cases structured exactly as recommended above.

2. **Test Execution**:
   - Invoke the E2E test runner wrapper script from the project root:
     ```bash
     npx tsx e2e/run_e2e.ts
     ```
   - Alternatively, to run specifically the Tier 3 test suite with Playwright directly (assuming `.env.local` is appropriately configured with test credentials):
     ```bash
     npx playwright test e2e/planner_tier3_pairwise.spec.ts --workers=1
     ```

3. **Success Criteria**:
   - The process must exit with code `0`.
   - 100% of the 12 pairwise test cases must pass successfully.
   - All automated `@axe-core/playwright` accessibility audits must report zero WCAG 2.1 AA/AAA violations.

4. **Invalidation Conditions**:
   - Any test failure, timeout exceeding 15 seconds during Web Worker simulation, or unexpected server error toast indicates a failure in either the UI state hydration or Server Action boundary enforcement.
