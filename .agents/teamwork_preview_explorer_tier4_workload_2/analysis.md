# E2E Implementation Strategy Analysis: Tier 4 Workload Scenarios (Scenarios 3 & 4)

## Core Executive Summary
Our comprehensive analysis of the existing E2E test suite (`planner_tier1_feature.spec.ts`, `planner_tier2_boundary.spec.ts`, `planner_tier3_pairwise.spec.ts`) and core domain engines (`src/lib/planner/types.ts`, `src/lib/planner/taxEngine.ts`) establishes the precise architectural contracts, DOM locators, seed data parameters, and API action schemas required for `e2e/planner_tier4_workload.spec.ts`. Specifically, we have formulated concrete, production-ready Playwright test case designs for **Scenario 3 (Adversarial BOLA Attempt on Premium Plan by Free User)** and **Scenario 4 (High-Net-Worth Multi-Account Drawdown & Tax Optimization)** that enforce strict opaque-box verification, BOLA defenses, zero negative financial jargon, and complete WCAG 2.1 AA/AAA accessibility compliance.

---

## Key Findings & Architectural Alignment

### 1. Seed Data & Authentication Contracts
From `e2e/seed.ts` (lines 23-27, 308-372) and `e2e/planner_tier1_feature.spec.ts` (lines 4-14), the test environment provides two fully configured user accounts and a pre-seeded genuine Premium retirement plan. All E2E tests must utilize these established credentials and entities:

| Entity | Parameter / Value | File & Line Reference | Purpose / Verification Target |
| :--- | :--- | :--- | :--- |
| **Standard User** | `test-user@example.com` (`password123`) | `e2e/seed.ts:23`, `planner_tier1_feature.spec.ts:4` | Represents a Free tier user subject to Premium Locks and BOLA restrictions. |
| **Premium User** | `premium-user@example.com` (`password123`) | `e2e/seed.ts:25`, `planner_tier1_feature.spec.ts:5` | Represents a Premium tier high-net-worth user with full 125-yr simulation access. |
| **Pre-seeded Plan** | `premium-user-genuine-plan-id` | `e2e/seed.ts:348` | Target plan owned by Premium User; used to test RLS and BOLA defense isolation. |
| **Login Helper** | `loginAs(page, email, password)` | `e2e/planner_tier1_feature.spec.ts:8-14` | Shared helper function for establishing authenticated sessions. |

### 2. UI Element Locators & Interaction Conventions
Across `planner_tier1_feature.spec.ts`, `planner_tier2_boundary.spec.ts`, and `planner_tier3_pairwise.spec.ts`, consistent element IDs and class names are utilized for navigation, form input, and feedback validation. `planner_tier4_workload.spec.ts` must maintain exact locator parity:

* **Tab Navigation (`e2e/planner_tier1_feature.spec.ts:123-130`)**: `#tab-household`, `#tab-accounts`, `#tab-spending`, `#tab-pensions`, `#tab-events`, `#tab-taxes`, `#tab-simulation`.
* **Tab Panels (`e2e/planner_tier1_feature.spec.ts:123-130`)**: `#panel-household`, `#panel-accounts`, `#panel-spending`, `#panel-pensions`, `#panel-events`, `#panel-taxes`, `#panel-simulation`.
* **Hydration Marker (`e2e/planner_tier1_feature.spec.ts:75`)**: `#hydrated-marker`. Must be waited for (`state: 'attached'`) prior to form interactions to prevent hydration mismatch.
* **Buttons & Controls**: `#save-plan-btn`, `#run-simulation-btn`, `#add-account-btn`, `#range-20yr`, `#range-50yr`, `#range-125yr`.
* **Premium Lock Card (`e2e/planner_tier1_feature.spec.ts:198`)**: `#premium-lock-card` (features frosted glass classes `bg-white/40 backdrop-blur-md border-white/20`).
* **Validation & Toast Feedback**: `.validation-error` (`role="alert"`), `.toast-success`, `.toast-error`.
* **Screen Reader Table (`e2e/planner_tier2_boundary.spec.ts:578-582`)**: `div.sr-only table`. Must be inspected using `textContent()` (not `innerText()`) to verify 10th, 50th, and 90th percentile screen reader parity.

### 3. Domain Engine Schemas (`src/lib/planner/types.ts` & `src/lib/planner/taxEngine.ts`)
* **Account Schema (`types.ts:4-18`)**: Requires `name`, `type` (`taxable`, `tax_deferred`, `tax_free`), `balance` (non-negative), `costBasis` (non-negative), and `owner` (`primary`, `spouse`, `joint`).
* **Spending Schema (`types.ts:21-54`)**: Supports `yale_endowment` (requiring `yaleWeight` between 0 and 1) and `vanguard_dynamic` (requiring `minWithdrawal` <= `maxWithdrawal`).
* **Tax Engine (`taxEngine.ts:151, 279`)**: Computes progressive taxes and long-term capital gains stacking based on `taxJurisdiction` (`US` or `CA`) and `stateProvince` (e.g., `CA`, `NY`).
* **SimulationConfig Schema (`types.ts:99-107`)**: Requires `drawdownStrategy` (`taxable_first`, `proportional`, `tax_deferred_first`), `historicalRange` (`most_recent_20_years`, `most_recent_50_years`, `all_125_years`), `numPaths` (max 10000), and `retirementHorizon` (max 100).

---

## Detailed Implementation Strategy & Concrete Test Case Designs

### Scenario 3: Adversarial BOLA Attempt on Premium Plan by Free User
**Features Exercised**: F2 (Dashboard/Builder), F3 (Premium Lock), F5 (BOLA Defenses & RLS), F7 (Accessibility & Brand Empathy)
**Complexity**: Medium

#### Execution Flow & Verification Objectives
1. **Initial Authentication & Navigation (F2, F3)**: Log in as `test-user@example.com` (Standard/Free User). Navigate to `/plans/new`, wait for `#hydrated-marker`, click `#tab-simulation`, and verify that `#premium-lock-card` is visible and `#range-125yr` is disabled.
2. **Direct URL BOLA Attempt (F5)**: Attempt unauthorized direct navigation to `/plans/premium-user-genuine-plan-id` (a plan owned by `premium-user@example.com`).
   * *Assertion*: Verify automatic redirection to `/plans`.
   * *Assertion*: Verify appearance of `.toast-error` containing the empathetic message `"You do not have permission to view this plan"`.
3. **Direct JS Fetch Payload BOLA Attempt (F5)**: Navigate back to `/plans/new`. Use `page.evaluate()` to execute a direct `fetch` POST request to `/api/actions/savePlan`, attempting to hijack `id: 'premium-user-genuine-plan-id'` and inject `historicalRange: 'all_125_years'`.
   * *Assertion*: Verify the JSON response explicitly returns `success: false` and `error` containing `"You do not have permission to modify this plan"`.
4. **Accessibility & Brand Empathy Audit (F7)**:
   * Execute `AxeBuilder` audit on the active view and `.toast-error` to ensure zero WCAG 2.1 AA/AAA violations.
   * Inspect `body` text to ensure zero forbidden negative financial terms (`Debt`, `Penalty`, `Failing`, `Over-limit`, `Deficit`, `Game Over`).

#### Concrete Playwright Code Snippet
```typescript
test.describe('Scenario 3: Adversarial BOLA Attempt on Premium Plan by Free User', () => {
  test('should enforce Premium Lock, block direct URL BOLA access, reject fetch payload hijacking, and pass accessibility/empathy audits', async ({ page }) => {
    // 1. Log in as Standard Free User and verify Premium Lock presence (F2, F3)
    await loginAs(page, STANDARD_USER);
    await page.goto('/plans/new');
    await page.waitForSelector('#hydrated-marker', { state: 'attached' });
    await page.click('#tab-simulation');

    const premiumLock = page.locator('#premium-lock-card');
    await expect(premiumLock).toBeVisible();
    await expect(premiumLock).toHaveClass(/bg-white\/40/);
    await expect(premiumLock).toHaveClass(/backdrop-blur-md/);
    await expect(page.locator('#range-50yr')).toBeDisabled();
    await expect(page.locator('#range-125yr')).toBeDisabled();

    // 2. Direct URL BOLA Attempt on Premium User's Plan (F5)
    await page.goto('/plans/premium-user-genuine-plan-id');
    await expect(page).toHaveURL(/\/plans$/);
    const errorToast = page.locator('.toast-error');
    await expect(errorToast).toBeVisible();
    await expect(errorToast).toContainText('You do not have permission to view this plan');

    // 3. Direct JS Fetch Payload BOLA Attempt (F5)
    await page.goto('/plans/new');
    await page.waitForSelector('#hydrated-marker', { state: 'attached' });

    const fetchResponse = await page.evaluate(async () => {
      const res = await fetch('/api/actions/savePlan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: 'premium-user-genuine-plan-id', // Target premium user's plan ID
          name: 'Hijacked BOLA Plan',
          taxJurisdiction: 'US',
          stateProvince: 'NY',
          birthYear: 1990,
          retirementAge: 65,
          simulationConfig: {
            drawdownStrategy: 'taxable_first',
            historicalRange: 'all_125_years', // Premium range injection
            numPaths: 1000,
            inflationRate: 0.025,
            retirementHorizon: 30
          }
        })
      });
      return await res.json();
    });

    expect(fetchResponse.success).toBe(false);
    expect(fetchResponse.error).toContain('You do not have permission to modify this plan');

    // 4. Automated Accessibility & Brand Empathy Audits (F7)
    const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);

    const fullText = await page.locator('body').innerText();
    const forbiddenTerms = ['Debt', 'Penalty', 'Failing', 'Over-limit', 'Deficit', 'Game Over'];
    for (const term of forbiddenTerms) {
      expect(fullText).not.toContain(term);
    }
  });
});
```

---

### Scenario 4: High-Net-Worth Multi-Account Drawdown & Tax Optimization
**Features Exercised**: F2 (Dashboard/Builder), F4 (Web Worker Simulation), F6 (Domain Engines & Zod), F7 (Accessibility & Brand Empathy)
**Complexity**: High

#### Execution Flow & Verification Objectives
1. **Initial Authentication & Profile Setup (F2)**: Log in as `premium-user@example.com` (Premium User). Navigate to `/plans/new`, wait for `#hydrated-marker`, and fill in base household parameters (`#input-plan-name` = `"High-Net-Worth Drawdown Plan"`, `#input-current-age` = `"50"`, `#input-retirement-age` = `"65"`).
2. **Diversified Multi-Account Configuration (F6)**: Navigate to `#tab-accounts`. Add three distinct account types representing a complex high-net-worth portfolio:
   * *Taxable Brokerage*: Name `"Taxable Brokerage"`, Type `taxable`, Balance `"3000000"`, Cost Basis `"2000000"`, Owner `primary`. Click `#add-account-btn`.
   * *Tax-Deferred (401k)*: Name `"Traditional 401k"`, Type `tax_deferred`, Balance `"2000000"`, Cost Basis `"2000000"`, Owner `primary`. Click `#add-account-btn`.
   * *Tax-Free (Roth IRA)*: Name `"Roth IRA"`, Type `tax_free`, Balance `"1000000"`, Cost Basis `"1000000"`, Owner `primary`. Click `#add-account-btn`.
   * *Assertion*: Verify `.validation-error` is not visible, confirming Zod schema validation success.
3. **Sophisticated Spending & Pension Setup (F6)**:
   * Navigate to `#tab-spending`. Select `#select-spending-strategy` = `yale_endowment`, fill `#input-yale-weight` = `"0.3"`.
   * Navigate to `#tab-pensions`. Select `#select-pension-type` = `social_security`, fill `#input-pension-start-age` = `"70"`.
4. **Tax Jurisdiction & Drawdown Strategy Configuration (F6)**:
   * Navigate to `#tab-taxes`. Select `#select-tax-jurisdiction` = `US`, fill `#input-state-province` = `"CA"`.
   * Navigate to `#tab-simulation`. Select `#select-drawdown-strategy` = `taxable_first`. Verify `#premium-lock-card` is NOT visible.
5. **Web Worker 1,000-Path Monte Carlo Simulation Execution (F4)**:
   * Select `#range-125yr`, fill `#input-num-paths` = `"1000"`, `#input-retirement-horizon` = `"40"`, `#input-inflation-rate` = `"0.035"`.
   * Click `#run-simulation-btn`.
   * *Assertion*: Wait for `#simulation-results-summary` to be visible (timeout 15000ms). Verify it contains `"125-Year Projection"` and `"1,000 paths simulated"`. Verify `#wealth-fan-chart` is visible.
6. **Accessibility, Screen Reader Parity & Empathy Audit (F7)**:
   * Execute `AxeBuilder` audit on `#panel-simulation` to confirm zero WCAG 2.1 AA/AAA violations.
   * Inspect `div.sr-only table` using `textContent()` to verify screen reader table parity contains `"10th Percentile"`, `"50th Percentile"`, and `"90th Percentile"`.
   * Verify zero negative financial jargon across the page.
7. **Plan Persistence & Dashboard Verification (F2, F5)**: Click `#save-plan-btn`, verify `.toast-success`, verify URL redirects to `/plans`, and confirm the new plan card `"High-Net-Worth Drawdown Plan"` is visible.

#### Concrete Playwright Code Snippet
```typescript
test.describe('Scenario 4: High-Net-Worth Multi-Account Drawdown & Tax Optimization', () => {
  test('should configure a diversified multi-account portfolio, execute 125-year Web Worker simulation with tax optimization, verify screen reader parity, and persist successfully', async ({ page }) => {
    // 1. Log in as Premium User and initialize Detailed Plan Builder (F2)
    await loginAs(page, PREMIUM_USER);
    await page.goto('/plans/new');
    await page.waitForSelector('#hydrated-marker', { state: 'attached' });

    await page.fill('#input-plan-name', 'High-Net-Worth Drawdown Plan');
    await page.fill('#input-current-age', '50');
    await page.fill('#input-retirement-age', '65');

    // 2. Configure Diversified Multi-Account Portfolio (F6)
    await page.click('#tab-accounts');
    
    // Account 1: Taxable Brokerage
    await page.fill('#input-account-name', 'Taxable Brokerage');
    await page.selectOption('#select-account-type', 'taxable');
    await page.fill('#input-account-balance', '3000000');
    await page.fill('#input-account-cost-basis', '2000000');
    await page.selectOption('#select-account-owner', 'primary');
    await page.click('#add-account-btn');

    // Account 2: Tax-Deferred (401k)
    await page.fill('#input-account-name', 'Traditional 401k');
    await page.selectOption('#select-account-type', 'tax_deferred');
    await page.fill('#input-account-balance', '2000000');
    await page.fill('#input-account-cost-basis', '2000000');
    await page.selectOption('#select-account-owner', 'primary');
    await page.click('#add-account-btn');

    // Account 3: Tax-Free (Roth IRA)
    await page.fill('#input-account-name', 'Roth IRA');
    await page.selectOption('#select-account-type', 'tax_free');
    await page.fill('#input-account-balance', '1000000');
    await page.fill('#input-account-cost-basis', '1000000');
    await page.selectOption('#select-account-owner', 'primary');
    await page.click('#add-account-btn');

    await expect(page.locator('.validation-error')).not.toBeVisible();

    // 3. Configure Sophisticated Spending & Pension Strategies (F6)
    await page.click('#tab-spending');
    await page.selectOption('#select-spending-strategy', 'yale_endowment');
    await page.fill('#input-yale-weight', '0.3');

    await page.click('#tab-pensions');
    await page.selectOption('#select-pension-type', 'social_security');
    await page.fill('#input-pension-start-age', '70');

    // 4. Configure Tax Jurisdiction & Drawdown Strategy (F6)
    await page.click('#tab-taxes');
    await page.selectOption('#select-tax-jurisdiction', 'US');
    await page.fill('#input-state-province', 'CA');

    await page.click('#tab-simulation');
    await expect(page.locator('#premium-lock-card')).not.toBeVisible();
    await page.selectOption('#select-drawdown-strategy', 'taxable_first');

    // 5. Web Worker 1,000-Path Monte Carlo Simulation Execution (F4)
    await page.click('#range-125yr');
    await page.fill('#input-num-paths', '1000');
    await page.fill('#input-retirement-horizon', '40');
    await page.fill('#input-inflation-rate', '0.035');
    await page.click('#run-simulation-btn');

    const results = page.locator('#simulation-results-summary');
    await expect(results).toBeVisible({ timeout: 15000 });
    await expect(results).toContainText('125-Year Projection');
    await expect(results).toContainText('1,000 paths simulated');
    await expect(page.locator('#wealth-fan-chart')).toBeVisible();

    // 6. Automated Accessibility, Screen Reader Parity & Brand Empathy Audits (F7)
    const accessibilityScanResults = await new AxeBuilder({ page }).include('#panel-simulation').analyze();
    expect(accessibilityScanResults.violations).toEqual([]);

    const srTable = page.locator('div.sr-only table');
    await expect(srTable).toBeAttached();
    const tableText = await srTable.textContent();
    expect(tableText).toContain('10th Percentile');
    expect(tableText).toContain('50th Percentile');
    expect(tableText).toContain('90th Percentile');

    const fullText = await page.locator('body').innerText();
    const forbiddenTerms = ['Debt', 'Penalty', 'Failing', 'Over-limit', 'Deficit', 'Game Over'];
    for (const term of forbiddenTerms) {
      expect(fullText).not.toContain(term);
    }

    // 7. Plan Persistence & Dashboard Verification (F2, F5)
    await page.click('#save-plan-btn');
    await expect(page.locator('.toast-success')).toBeVisible();
    await expect(page).toHaveURL(/\/plans$/);
    await expect(page.locator('.plan-card', { hasText: 'High-Net-Worth Drawdown Plan' }).first()).toBeVisible();
  });
});
```

---

## Complete E2E File Structure Recommendation
To ensure absolute harmony with the E2E test runner (`npx tsx e2e/run_e2e.ts`), the Worker should construct `e2e/planner_tier4_workload.spec.ts` using the shared preamble and structure below:

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

test.describe('Tier 4: Real-World Workload Scenarios', () => {
  // Scenario 1: Full Lifecycle Dual Entry Handoff for Free Tier User
  // ... (to be implemented by Worker / Explorer 1)

  // Scenario 2: Premium Tier Upgrade & 125-Year Historical Simulation
  // ... (to be implemented by Worker / Explorer 1)

  // Scenario 3: Adversarial BOLA Attempt on Premium Plan by Free User
  // (Insert Scenario 3 code snippet here)

  // Scenario 4: High-Net-Worth Multi-Account Drawdown & Tax Optimization
  // (Insert Scenario 4 code snippet here)

  // Scenario 5: Comprehensive Quick Check to 7-Tab Plan Builder with A11y Audit
  // ... (to be implemented by Worker / Explorer 1)
});
```
