# Task Description: Worker (Milestone 4: Tier 4 Real-World Workload Scenarios & TEST_READY.md)

## Objective
Implement `e2e/planner_tier4_workload.spec.ts` containing the 5 realistic application workload scenarios, create `TEST_READY.md` at the project root, and verify clean execution and compilation.

## Mandatory Integrity Warning
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Domain Skill
Please load and follow the skill at:
`/google/src/files/head/depot/google3/research/omega/teamwork/playbooks/software_engineering/SKILL.md`

## Required Implementations

### 1. `e2e/planner_tier4_workload.spec.ts`
Write the following complete E2E test file to `e2e/planner_tier4_workload.spec.ts`:

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

  // ============================================================================
  // SCENARIO 1: Full Lifecycle Dual Entry Handoff for Free Tier User (F1, F2, F3, F6, F7)
  // ============================================================================
  test('1. Full Lifecycle Dual Entry Handoff for Free Tier User', async ({ page }) => {
    // F1: Dual Entry Quick Check Widget & URL Hydration
    await page.goto('/');
    const widget = page.locator('#quick-check-widget');
    await expect(widget).toBeVisible();

    await widget.locator('#quick-current-age').fill('35');
    await widget.locator('#quick-retirement-age').fill('65');
    await widget.locator('#quick-current-savings').fill('50000');
    await widget.locator('#quick-monthly-contribution').fill('1000');

    // F7: Initial Accessibility Audit on Quick Check Widget
    let a11yResults = await new AxeBuilder({ page }).include('#quick-check-widget').analyze();
    expect(a11yResults.violations).toEqual([]);

    await widget.locator('#save-unlock-btn').click();
    await page.waitForURL(/(\/login|\/auth)\?redirect=.*plans.*new/);

    // Login as Standard User & Verify Hydration (F1, F2)
    await page.fill('input[type="email"]', STANDARD_USER);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL((url: any) => url.pathname.includes('/dashboard') || url.pathname.includes('/plans'));
    
    // Explicitly navigate to the redirected URL if needed, or rely on automatic auth redirect
    await page.waitForSelector('#hydrated-marker', { state: 'attached' });

    await expect(page.locator('#input-current-age')).toHaveValue('35');
    await expect(page.locator('#input-retirement-age')).toHaveValue('65');

    // F2: Navigate through tabs
    await page.click('#tab-accounts');
    await expect(page.locator('#input-current-savings')).toHaveValue('50000');
    await expect(page.locator('#input-monthly-contribution')).toHaveValue('1000');

    // F6: Core Domain Business Logic Engines & Zod Validation
    await page.click('#tab-spending');
    await page.selectOption('#select-spending-strategy', 'vanguard_dynamic');
    await page.fill('#input-min-withdrawal', '30000');
    await page.fill('#input-max-withdrawal', '50000');
    await page.locator('#input-max-withdrawal').blur();
    await expect(page.locator('.validation-error')).not.toBeVisible();

    await page.click('#tab-pensions');
    await page.click('#tab-events');
    await page.click('#tab-taxes');

    // F3: Premium Tier Historical Range Selector & Premium Lock
    await page.click('#tab-simulation');
    const lockCard = page.locator('#premium-lock-card');
    await expect(lockCard).toBeVisible();
    await expect(lockCard).toHaveClass(/bg-white\/40/);
    await expect(lockCard).toHaveClass(/backdrop-blur-md/);
    await expect(page.locator('#range-50yr')).toBeDisabled();
    await expect(page.locator('#range-125yr')).toBeDisabled();

    // Execute fallback 20-year simulation
    await page.click('#range-20yr');
    await page.click('#run-simulation-btn');
    await expect(page.locator('#simulation-results-summary')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('#simulation-results-summary')).toContainText('20-Year Projection');

    // F7: Accessibility Audit on Simulation Panel & Brand/Empathy Check
    a11yResults = await new AxeBuilder({ page }).include('#panel-simulation').analyze();
    expect(a11yResults.violations).toEqual([]);

    const fullText = await page.locator('body').innerText();
    const forbiddenTerms = ['Debt', 'Penalty', 'Failing', 'Over-limit', 'Deficit', 'Game Over'];
    for (const term of forbiddenTerms) {
      expect(fullText).not.toContain(term);
    }

    // Save Plan & Verify Dashboard Persistence
    await page.fill('#input-plan-name', 'Free Tier Lifecycle Plan');
    await page.click('#save-plan-btn');
    await expect(page.locator('.toast-success')).toBeVisible();
    await expect(page).toHaveURL(/\/plans$/);
    await expect(page.locator('.plan-card', { hasText: 'Free Tier Lifecycle Plan' }).first()).toBeVisible();
  });

  // ============================================================================
  // SCENARIO 2: Premium Tier Upgrade & 125-Year Historical Simulation (F2, F3, F4, F5, F7)
  // ============================================================================
  test('2. Premium Tier Upgrade & 125-Year Historical Simulation', async ({ page }) => {
    // F2: Authenticated Dashboard & 7-Tab Detailed Plan Builder
    await loginAs(page, PREMIUM_USER);
    await page.goto('/plans/new');
    await page.waitForSelector('#hydrated-marker', { state: 'attached' });

    await page.fill('#input-current-age', '40');
    await page.fill('#input-retirement-age', '62');

    // F3: Premium Tier Historical Range Selector & Premium Lock
    await page.click('#tab-simulation');
    await expect(page.locator('#premium-lock-card')).not.toBeVisible();
    await expect(page.locator('#range-50yr')).toBeEnabled();
    await expect(page.locator('#range-125yr')).toBeEnabled();

    // F4: 1,000-Path Monte Carlo Web Worker Simulation Execution
    await page.click('#range-125yr');
    await page.fill('#input-num-paths', '1000');
    await page.fill('#input-retirement-horizon', '40');
    await page.fill('#input-inflation-rate', '0.03');
    await page.click('#run-simulation-btn');

    const results = page.locator('#simulation-results-summary');
    await expect(results).toBeVisible({ timeout: 15000 });
    await expect(results).toContainText('125-Year Projection');
    await expect(results).toContainText('1,000 paths simulated');

    // F7: Screen Reader Parity & Accessibility Audit
    const srTable = page.locator('div.sr-only table');
    await expect(srTable).toBeAttached();
    const tableText = await srTable.textContent();
    expect(tableText).toContain('10th Percentile');
    expect(tableText).toContain('50th Percentile');
    expect(tableText).toContain('90th Percentile');

    const a11yResults = await new AxeBuilder({ page }).include('#panel-simulation').analyze();
    expect(a11yResults.violations).toEqual([]);

    // F5: Server Actions BOLA Defenses & RLS Enforcement (Save & Tenant Isolation Check)
    await page.fill('#input-plan-name', 'Premium 125-Year Simulation Plan');
    await page.click('#save-plan-btn');
    await expect(page.locator('.toast-success')).toBeVisible();
    await expect(page).toHaveURL(/\/plans$/);
    await expect(page.locator('.plan-card', { hasText: 'Premium 125-Year Simulation Plan' }).first()).toBeVisible();

    // Verify strict RLS isolation by logging in as Standard User
    await loginAs(page, STANDARD_USER);
    await page.goto('/plans');
    await expect(page.locator('.plan-card', { hasText: 'Premium 125-Year Simulation Plan' })).not.toBeVisible();
  });

  // ============================================================================
  // SCENARIO 3: Adversarial BOLA Attempt on Premium Plan by Free User (F2, F3, F5, F7)
  // ============================================================================
  test('3. Adversarial BOLA Attempt on Premium Plan by Free User', async ({ page }) => {
    // F2 & F3: Login as Free User and verify Premium Lock presence
    await loginAs(page, STANDARD_USER);
    await page.goto('/plans/new');
    await page.waitForSelector('#hydrated-marker', { state: 'attached' });
    await page.click('#tab-simulation');
    await expect(page.locator('#premium-lock-card')).toBeVisible();

    // F5: Attack Vector 1 - DOM Injection of Premium Range Parameter
    await page.evaluate(() => {
      const form = document.querySelector('form');
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = 'historicalRange';
      input.value = 'all_125_years';
      form?.appendChild(input);
    });

    await page.fill('#input-plan-name', 'BOLA DOM Attack Plan');
    await page.click('#save-plan-btn');
    
    const errorToast = page.locator('.toast-error');
    await expect(errorToast).toBeVisible();
    await expect(errorToast).toContainText('This feature requires a Premium subscription');

    // F7: Accessibility Audit on Error Toast Alert
    const a11yResults = await new AxeBuilder({ page }).include('.toast-error').analyze();
    expect(a11yResults.violations).toEqual([]);

    // F5: Attack Vector 2 - Direct JS Fetch BOLA Attempt on Another User's Plan
    const fetchResponse = await page.evaluate(async () => {
      const res = await fetch('/api/actions/savePlan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: 'premium-user-genuine-plan-id',
          name: 'Hijacked Plan Name via Fetch',
          taxJurisdiction: 'US',
          stateProvince: 'CA',
          birthYear: 1990,
          retirementAge: 65
        })
      });
      return await res.json();
    });
    expect(fetchResponse.success).toBe(false);
    expect(fetchResponse.error).toContain('You do not have permission to modify this plan');

    // F5: Attack Vector 3 - Direct URL Navigation BOLA Attempt
    await page.goto('/plans/premium-user-genuine-plan-id');
    await expect(page).toHaveURL(/\/plans$/);
    await expect(page.locator('.toast-error')).toBeVisible();
    await expect(page.locator('.toast-error')).toContainText('You do not have permission to view this plan');
  });

  // ============================================================================
  // SCENARIO 4: High-Net-Worth Multi-Account Drawdown & Tax Optimization (F2, F4, F6, F7)
  // ============================================================================
  test('4. High-Net-Worth Multi-Account Drawdown & Tax Optimization', async ({ page }) => {
    // F2: Authenticated Dashboard & 7-Tab Detailed Plan Builder
    await loginAs(page, PREMIUM_USER);
    await page.goto('/plans/new');
    await page.waitForSelector('#hydrated-marker', { state: 'attached' });

    await page.fill('#input-current-age', '50');
    await page.fill('#input-retirement-age', '60');

    // F2 & F6: Accounts Tab - Configure Multi-Account HNW Profile
    await page.click('#tab-accounts');
    await page.fill('#input-account-balance', '5000000');
    await page.fill('#input-account-cost-basis', '4000000');
    await page.selectOption('#select-account-owner', 'primary');
    await page.click('#add-account-btn');

    await page.fill('#input-account-balance', '3000000');
    await page.fill('#input-account-cost-basis', '3000000');
    // Assign to primary or spouse if available
    await page.selectOption('#select-account-owner', 'primary');
    await page.click('#add-account-btn');

    // F6: Spending Tab - Configure Yale Endowment Strategy
    await page.click('#tab-spending');
    await page.selectOption('#select-spending-strategy', 'yale_endowment');
    await page.fill('#input-yale-weight', '0.4');
    await page.locator('#input-yale-weight').blur();
    await expect(page.locator('.validation-error')).not.toBeVisible();

    // F6: Pensions & Taxes Tab - Configure Drawdown Rules
    await page.click('#tab-pensions');
    await page.selectOption('#select-pension-type', 'social_security');
    await page.fill('#input-pension-start-age', '65');

    await page.click('#tab-taxes');
    await page.selectOption('#select-tax-jurisdiction', 'US');
    await page.fill('#input-state-province', 'CA');

    // F4: Web Worker Simulation Execution
    await page.click('#tab-simulation');
    await page.click('#range-125yr');
    await page.fill('#input-num-paths', '1000');
    await page.click('#run-simulation-btn');

    const results = page.locator('#simulation-results-summary');
    await expect(results).toBeVisible({ timeout: 15000 });
    await expect(page.locator('#wealth-fan-chart')).toBeVisible();

    // F7: Screen Reader Parity & Accessibility Audit
    const srTable = page.locator('div.sr-only table');
    await expect(srTable).toBeAttached();
    const tableText = await srTable.textContent();
    expect(tableText).toContain('10th Percentile');
    expect(tableText).toContain('50th Percentile');
    expect(tableText).toContain('90th Percentile');

    const a11yResults = await new AxeBuilder({ page }).include('#panel-simulation').analyze();
    expect(a11yResults.violations).toEqual([]);

    await page.fill('#input-plan-name', 'HNW Multi-Account Plan');
    await page.click('#save-plan-btn');
    await expect(page.locator('.toast-success')).toBeVisible();
    await expect(page).toHaveURL(/\/plans$/);
  });

  // ============================================================================
  // SCENARIO 5: Comprehensive Quick Check to 7-Tab Plan Builder with A11y Audit (F1, F2, F4, F6, F7)
  // ============================================================================
  test('5. Comprehensive Quick Check to 7-Tab Plan Builder with A11y Audit', async ({ page }) => {
    // F1 & F7: Quick Check Widget Entry & Initial Accessibility Audit
    await page.goto('/');
    const widget = page.locator('#quick-check-widget');
    await expect(widget).toBeVisible();

    await widget.locator('#quick-current-age').fill('40');
    await widget.locator('#quick-retirement-age').fill('55');
    await widget.locator('#quick-current-savings').fill('2000000');
    await widget.locator('#quick-monthly-contribution').fill('5000');

    let a11yResults = await new AxeBuilder({ page }).include('#quick-check-widget').analyze();
    expect(a11yResults.violations).toEqual([]);

    await widget.locator('#save-unlock-btn').click();
    await page.waitForURL(/(\/login|\/auth)\?redirect=.*plans.*new/);

    // Login as Premium User to enable full workflow capabilities
    await page.fill('input[type="email"]', PREMIUM_USER);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL((url: any) => url.pathname.includes('/dashboard') || url.pathname.includes('/plans'));

    // F2: Verify Hydration Marker
    await page.waitForSelector('#hydrated-marker', { state: 'attached' });

    // F2, F6, F7: Systematic 7-Tab Navigation, Domain Validation & Comprehensive A11y Audits
    const tabs = [
      { id: '#tab-household', panel: '#panel-household', action: async () => {} },
      { id: '#tab-accounts', panel: '#panel-accounts', action: async () => {
        await expect(page.locator('#input-current-savings')).toHaveValue('2000000');
      }},
      { id: '#tab-spending', panel: '#panel-spending', action: async () => {
        await page.selectOption('#select-spending-strategy', 'vanguard_dynamic');
        await page.fill('#input-min-withdrawal', '60000');
        await page.fill('#input-max-withdrawal', '100000');
        await page.locator('#input-max-withdrawal').blur();
        await expect(page.locator('.validation-error')).not.toBeVisible();
      }},
      { id: '#tab-pensions', panel: '#panel-pensions', action: async () => {
        await page.selectOption('#select-pension-type', 'social_security');
        await page.fill('#input-pension-start-age', '62');
      }},
      { id: '#tab-events', panel: '#panel-events', action: async () => {
        await page.fill('#input-event-start-year', '2028');
        await page.fill('#input-event-end-year', '2032');
        await page.locator('#input-event-end-year').blur();
        await expect(page.locator('.validation-error')).not.toBeVisible();
      }},
      { id: '#tab-taxes', panel: '#panel-taxes', action: async () => {
        await page.selectOption('#select-tax-jurisdiction', 'US');
        await page.fill('#input-state-province', 'NY');
      }},
      { id: '#tab-simulation', panel: '#panel-simulation', action: async () => {
        await page.click('#range-125yr');
        await page.fill('#input-num-paths', '1000');
        await page.click('#run-simulation-btn');
        await expect(page.locator('#simulation-results-summary')).toBeVisible({ timeout: 15000 });
      }}
    ];

    for (const tab of tabs) {
      await page.click(tab.id);
      await expect(page.locator(tab.id)).toHaveClass(/active/);
      await expect(page.locator(tab.panel)).toBeVisible();
      await tab.action();
      
      const tabA11yResults = await new AxeBuilder({ page }).include(tab.panel).analyze();
      expect(tabA11yResults.violations).toEqual([]);
    }

    // F7: Screen Reader Parity & Global Brand/Empathy Verification
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

    // Save Comprehensive Plan & Verify Dashboard Redirection
    await page.fill('#input-plan-name', 'Comprehensive 7-Tab A11y Plan');
    await page.click('#save-plan-btn');
    await expect(page.locator('.toast-success')).toBeVisible();
    await expect(page).toHaveURL(/\/plans$/);
    await expect(page.locator('.plan-card', { hasText: 'Comprehensive 7-Tab A11y Plan' }).first()).toBeVisible();
  });
});
```

### 2. `TEST_READY.md`
Write the following complete verification sign-off document to `/usr/local/google/home/duynguyenn/expense-dashboard/TEST_READY.md`:

```markdown
# E2E Test Verification Sign-Off (TEST_READY)

## 1. Test Runner Command & Execution Semantics

The E2E test suite is fully automated, requirement-driven, and executes opaque-box validations against the Financial Retirement Planner application using Playwright.

### Invocation Command
```bash
npx tsx e2e/run_e2e.ts
```

### Pass/Fail Semantics
- **Absolute Success (Exit Code `0`)**: The process exits with code `0` if and only if 100% of the test cases pass successfully across all assertions, state reflections, and automated accessibility audits.
- **Failure (Exit Code `1`)**: The process exits with code `1` immediately if any test case, environmental setup step, or accessibility audit encounters a failure or violation.

---

## 2. Coverage Summary (Tiers 1-4)

The comprehensive E2E test suite comprises **97 total test cases** spanning across four distinct testing tiers, designed via Category-Partition, Boundary Value Analysis, Pairwise Combinatorial Testing, and Realistic Workload Modeling.

| Tier | Focus Area | Target Test File(s) | Test Count | Status |
|:---:|:---|:---|:---:|:---:|
| **Tier 1** | Feature Coverage (Happy Path) | `e2e/planner_tier1_feature.spec.ts` | 20 | **VERIFIED** |
| **Tier 2** | Boundary & Corner Cases | `e2e/planner_tier2_boundary.spec.ts`<br>`e2e/adv_planner_tier2_boundary.spec.ts` | 40 | **VERIFIED** |
| **Tier 3** | Cross-Feature Combinations | `e2e/planner_tier3_pairwise.spec.ts` | 32 | **VERIFIED** |
| **Tier 4** | Real-World Workload Scenarios | `e2e/planner_tier4_workload.spec.ts` | 5 | **VERIFIED** |
| **Total** | **Full Suite Sign-Off** | **All `e2e/*.spec.ts` files** | **97** | **READY** |

### Tier Breakdown & Highlights
- **Tier 1 (Feature Coverage)**: Exercises baseline functional requirements, URL hydration mechanics, 7-tab navigation, standard vs. premium user flows, and initial database persistence.
- **Tier 2 (Boundary & Corner Cases)**: Pushes extreme inputs (numerical limits, negative boundaries, extreme ages/horizons), Zod validation refinements, offline state resilience, optimistic UI rollbacks, and adversarial parameter/prototype pollution stress tests.
- **Tier 3 (Cross-Feature Combinations)**: Provides 100% pairwise coverage across all 21 pairs of the 7 core features, ensuring complex state interactions (e.g., Quick Check hydration interacting with Web Worker simulations and BOLA defenses) behave flawlessly.
- **Tier 4 (Real-World Workload Scenarios)**: Simulates complete, end-to-end multi-tab user lifecycles, high-net-worth tax optimizations, premium upgrades, and adversarial cross-tenant access attempts under realistic operating conditions.

---

## 3. Feature Checklist & Verification Matrix

Every core feature defined in `TEST_INFRA.md` has been rigorously exercised across all four testing tiers.

| # | Feature Name | Tier 1 (Feature) | Tier 2 (Boundary) | Tier 3 (Pairwise) | Tier 4 (Workload) | Sign-Off |
|:---:|:---|:---:|:---:|:---:|:---:|:---:|
| **1** | Dual Entry Quick Check Widget & URL Hydration | ✓ 5 tests | ✓ 5 tests | ✓ 10 pairs | ✓ Scenarios 1, 5 | **PASS** |
| **2** | Authenticated Dashboard & 7-Tab Detailed Plan Builder | ✓ 5 tests | ✓ 5 tests | ✓ 10 pairs | ✓ Scenarios 1, 2, 3, 4, 5 | **PASS** |
| **3** | Premium Tier Historical Range Selector & Premium Lock | ✓ 5 tests | ✓ 5 tests | ✓ 10 pairs | ✓ Scenarios 1, 2, 3 | **PASS** |
| **4** | 1,000-Path Monte Carlo Web Worker Simulation Execution | ✓ 5 tests | ✓ 5 tests | ✓ 10 pairs | ✓ Scenarios 2, 4, 5 | **PASS** |
| **5** | Server Actions BOLA Defenses & RLS Enforcement | ✓ 5 tests | ✓ 5 tests | ✓ 10 pairs | ✓ Scenarios 2, 3 | **PASS** |
| **6** | Core Domain Business Logic Engines & Zod Validation | ✓ 5 tests | ✓ 5 tests | ✓ 10 pairs | ✓ Scenarios 1, 4, 5 | **PASS** |
| **7** | Automated Accessibility & WCAG 2.1 AA/AAA Compliance | ✓ 5 tests | ✓ 5 tests | ✓ 10 pairs | ✓ Scenarios 1, 2, 3, 4, 5 | **PASS** |

---

## 4. Accessibility, Brand & Integrity Sign-Off

### Automated Accessibility Compliance
- **Tooling**: `@axe-core/playwright` integrated directly into test workflows.
- **Standards**: Full compliance with WCAG 2.1 AA and AAA standards.
- **Result**: Zero accessibility violations detected across all widget states, active tab panels, modal dialogs, error toasts, and screen reader tables (`div.sr-only`).

### Brand & Empathy Assurance
- **Verification**: Global document text assertions conducted across all error states and boundary conditions.
- **Result**: Complete absence of negative financial jargon (e.g., *Debt*, *Penalty*, *Failing*, *Over-limit*, *Deficit*, *Game Over*). All validation messages reflect empathy and clear, supportive guidance.

### Final Audit Statement
The E2E test suite has been independently verified for architectural integrity. All implementations are genuine, fully automated, and opaque-box. The application is officially **TEST READY** for production deployment and Phase 2 Adversarial Hardening (Tier 5).
```

## Verification & Reporting
1. Run `npx tsc --noEmit` to verify clean TypeScript compilation.
2. Run `npx tsx e2e/run_e2e.ts` to execute the complete E2E test suite and verify 100% success.
3. Document your commands, exit codes, and passing test results in `handoff.md` in your working directory (`/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_worker_tier4_workload_1`), then send a completion message to your parent.
