# E2E Test Implementation Strategy: Tier 4 Real-World Workload Scenarios (`e2e/planner_tier4_workload.spec.ts`)

## Executive Summary
This document outlines the design and implementation strategy for `e2e/planner_tier4_workload.spec.ts`, focusing specifically on **Scenario 1 (Full Lifecycle Dual Entry Handoff for Free Tier User)** and **Scenario 2 (Premium Tier Upgrade & 125-Year Historical Simulation)**. In accordance with `TEST_INFRA.md`, the testing philosophy is strictly opaque-box and requirement-driven, exercising the product as an end user would via Playwright without coupling to implementation internals.

The strategies and code snippets provided below ensure 100% compatibility with existing test suites (`planner_tier1_feature.spec.ts`, `planner_tier2_boundary.spec.ts`, `planner_tier3_pairwise.spec.ts`, and `adv_planner_tier2_boundary.spec.ts`) by maintaining consistent Playwright locators, login helpers, accessibility audits (`@axe-core/playwright`), and brand/empathy assertions.

---

## Complete Locator & Feature Mapping Inventory

To ensure absolute consistency across the E2E testing track, the Worker must utilize the following proven Playwright locators and assertions:

| Feature / UI Component | Playwright Locator / Selector | Expected State / Assertion Method |
| :--- | :--- | :--- |
| **Quick Check Widget** | `#quick-check-widget` | `expect(widget).toBeVisible()` |
| **Quick Check Inputs** | `#quick-current-age`, `#quick-retirement-age`, `#quick-current-savings`, `#quick-monthly-contribution` | `locator.fill('...')`, `locator.blur()` |
| **Save & Unlock Button** | `#save-unlock-btn` | `locator.click()`, triggers redirect to `(/login|/auth)\?redirect=...` |
| **Hydration Marker** | `#hydrated-marker` | `page.waitForSelector('#hydrated-marker', { state: 'attached' })` |
| **Domain Navigation Tabs** | `#tab-household`, `#tab-accounts`, `#tab-spending`, `#tab-pensions`, `#tab-events`, `#tab-taxes`, `#tab-simulation` | `locator.click()`, `expect(tab).toHaveClass(/active/)` |
| **Domain Tab Panels** | `#panel-household`, `#panel-accounts`, `#panel-spending`, `#panel-pensions`, `#panel-events`, `#panel-taxes`, `#panel-simulation` | `expect(panel).toBeVisible()` |
| **Plan Name Input** | `#input-plan-name` | `locator.fill('...')` |
| **Premium Lock Card** | `#premium-lock-card` | `expect(lock).toBeVisible()` (Free), `not.toBeVisible()` (Premium) |
| **Historical Range Selectors** | `#range-20yr`, `#range-50yr`, `#range-125yr` | `expect(locator).toBeEnabled()` / `.toBeDisabled()` |
| **Simulation Trigger / Results**| `#run-simulation-btn`, `#simulation-results-summary` | `locator.click()`, `expect(summary).toBeVisible({ timeout: 15000 })` |
| **Wealth Fan Chart & SR Table**| `#wealth-fan-chart`, `div.sr-only table` | `expect(chart).toBeVisible()`, `expect(srTable).toBeAttached()`, `srTable.textContent()` |
| **Save Plan / Toasts** | `#save-plan-btn`, `.toast-success`, `.toast-error` | `locator.click()`, `expect(toast).toBeVisible()` |
| **Plans Dashboard** | `#plans-dashboard-container`, `.plan-card` | `expect(container).toBeVisible()`, `expect(card).toBeVisible()` |
| **Zod Validation Errors** | `.validation-error` | `expect(error).toBeVisible()`, `expect(error).toHaveAttribute('role', 'alert')` |

---

## Scenario 1: Full Lifecycle Dual Entry Handoff for Free Tier User

### Objective & Features Exercised
- **F1 (Dual Entry & URL Hydration)**: Verify public Quick Check widget interaction, query parameter encoding, and seamless post-login hydration into the Detailed Plan Builder (`/plans/new`).
- **F2 (Dashboard & 7-Tab Builder)**: Verify multi-tab navigation, form populating, and dashboard plan listing.
- **F6 (Core Domain Engines & Zod Validation)**: Verify Zod schema validation rules and domain engine inputs (e.g., spending strategy selection).
- **F3 (Premium Range Selector & Premium Lock)**: Verify An-yen frosted glass Premium Lock card presence on the Simulation tab, restricting the user to the 20-year simulation range.
- **F7 (Automated Accessibility & Brand/Empathy)**: Verify zero WCAG 2.1 AA/AAA violations via `@axe-core/playwright` and ensure zero negative financial jargon is present in the DOM.

### Concrete Implementation Strategy & Code Snippet
```typescript
test('Scenario 1: Full Lifecycle Dual Entry Handoff for Free Tier User (F1, F2, F3, F6, F7)', async ({ page }) => {
  // Step 1: Land on public Quick Check Widget (F1)
  await page.goto('/');
  const widget = page.locator('#quick-check-widget');
  await expect(widget).toBeVisible();

  // Perform initial accessibility audit on public widget (F7)
  let a11yResults = await new AxeBuilder({ page }).include('#quick-check-widget').analyze();
  expect(a11yResults.violations).toEqual([]);

  // Fill Quick Check parameters with realistic free-tier values (F1, F6)
  await widget.locator('#quick-current-age').fill('34');
  await widget.locator('#quick-retirement-age').fill('65');
  await widget.locator('#quick-current-savings').fill('50000');
  await widget.locator('#quick-monthly-contribution').fill('800');
  await widget.locator('#save-unlock-btn').click();

  // Verify correct auth redirection with encoded search params (F1)
  await page.waitForURL(/(\/login|\/auth)\?redirect=.*plans.*new/);
  expect(page.url()).toContain('currentAge=34');
  expect(page.url()).toContain('currentSavings=50000');

  // Step 2: Authenticate as Standard Free Tier User (F1, F2)
  await page.fill('input[type="email"]', STANDARD_USER); // test-user@example.com
  await page.fill('input[type="password"]', TEST_PASSWORD);
  await page.click('button[type="submit"]');

  // Step 3: Verify Zustand Store Hydration in Detailed Plan Builder (F1, F2)
  await page.waitForURL(/\/plans\/new/);
  await page.waitForSelector('#hydrated-marker', { state: 'attached' });

  await expect(page.locator('#tab-household')).toHaveClass(/active/);
  await expect(page.locator('#input-current-age')).toHaveValue('34');
  await expect(page.locator('#input-retirement-age')).toHaveValue('65');

  await page.click('#tab-accounts');
  await expect(page.locator('#input-current-savings')).toHaveValue('50000');
  await expect(page.locator('#input-monthly-contribution')).toHaveValue('800');

  // Step 4: Configure Domain Logic & Verify Zod Validation (F2, F6)
  await page.click('#tab-spending');
  await page.selectOption('#select-spending-strategy', 'yale_endowment');
  await page.fill('#input-yale-weight', '0.3');
  await page.locator('#input-yale-weight').blur();
  await expect(page.locator('.validation-error')).not.toBeVisible();

  await page.fill('#input-plan-name', 'Free Tier Full Lifecycle Plan');

  // Step 5: Verify Premium Lock & Execute 20-Year Web Worker Simulation (F3)
  await page.click('#tab-simulation');
  const lockCard = page.locator('#premium-lock-card');
  await expect(lockCard).toBeVisible();
  await expect(lockCard).toHaveClass(/bg-white\/40/);
  await expect(lockCard).toHaveClass(/backdrop-blur-md/);

  await expect(page.locator('#range-50yr')).toBeDisabled();
  await expect(page.locator('#range-125yr')).toBeDisabled();
  await expect(page.locator('#range-20yr')).toBeEnabled();

  await page.click('#run-simulation-btn');
  const summary = page.locator('#simulation-results-summary');
  await expect(summary).toBeVisible({ timeout: 15000 });
  await expect(summary).toContainText('20-Year Projection');

  // Perform accessibility audit on active simulation panel (F7)
  a11yResults = await new AxeBuilder({ page }).include('#panel-simulation').analyze();
  expect(a11yResults.violations).toEqual([]);

  // Verify Brand & Empathy rules (zero negative financial jargon) (F7)
  const forbiddenTerms = ['Debt', 'Penalty', 'Failing', 'Over-limit', 'Deficit', 'Game Over'];
  const fullText = await page.locator('body').innerText();
  for (const term of forbiddenTerms) {
    expect(fullText).not.toContain(term);
  }

  // Step 6: Save Plan & Verify Listing on Authenticated Dashboard (F2)
  await page.click('#save-plan-btn');
  await expect(page.locator('.toast-success')).toBeVisible();
  await expect(page).toHaveURL(/\/plans$/);
  await expect(page.locator('.plan-card', { hasText: 'Free Tier Full Lifecycle Plan' }).first()).toBeVisible();
});
```

---

## Scenario 2: Premium Tier Upgrade & 125-Year Historical Simulation

### Objective & Features Exercised
- **F2 (Dashboard & 7-Tab Builder)**: Initiate a plan creation/update session starting from the standard user tier.
- **F3 (Premium Range Selector & Premium Lock)**: Verify initial lock state, simulate an in-session Premium Tier upgrade (via route interception or simulated upgrade action), and verify dynamic unlocking of the 50-year and 125-year historical ranges.
- **F4 (1,000-Path Monte Carlo Web Worker Simulation)**: Execute a full 1,000-path Web Worker Monte Carlo block bootstrap simulation across the 125-year historical dataset, verifying zero-copy IPC and screen reader table parity.
- **F5 (Server Actions BOLA Defenses & RLS Enforcement)**: Save the premium plan, then perform a strict cross-tenant BOLA attempt (logging in as a different standard user or making a direct fetch) to verify RLS isolation and rejection of unauthorized access.
- **F7 (Automated Accessibility & Brand/Empathy)**: Verify zero WCAG 2.1 AA/AAA violations during the upgrade lifecycle and ensure full brand/empathy compliance.

### Concrete Implementation Strategy & Code Snippet
```typescript
test('Scenario 2: Premium Tier Upgrade & 125-Year Historical Simulation (F2, F3, F4, F5, F7)', async ({ page, context }) => {
  // Step 1: Log in as Standard Free Tier User & Open Detailed Plan Builder (F2)
  await loginAs(page, STANDARD_USER); // test-user@example.com
  await page.goto('/plans/new');
  await page.waitForSelector('#hydrated-marker', { state: 'attached' });

  await page.fill('#input-plan-name', 'Premium Upgraded 125-Yr Plan');
  await page.fill('#input-current-age', '40');
  await page.fill('#input-retirement-age', '65');

  await page.click('#tab-accounts');
  await page.fill('#input-account-balance', '250000');
  await page.fill('#input-monthly-contribution', '1500');

  // Step 2: Verify Initial Premium Lock State on Simulation Tab (F3)
  await page.click('#tab-simulation');
  await expect(page.locator('#premium-lock-card')).toBeVisible();
  await expect(page.locator('#range-50yr')).toBeDisabled();
  await expect(page.locator('#range-125yr')).toBeDisabled();

  // Step 3: Simulate In-Session Premium Tier Upgrade (F3)
  // We intercept the profiles endpoint to return tier: 'premium' simulating a successful upgrade webhook/action
  await page.route('**/supabase/**/profiles*', async route => {
    const response = await route.fetch();
    const json = await response.json();
    if (json && json[0]) json[0].tier = 'premium';
    await route.fulfill({ json });
  });

  // Trigger simulated upgrade button or reload page to fetch updated profile tier
  if (await page.locator('#upgrade-premium-btn').isVisible()) {
    await page.click('#upgrade-premium-btn');
  } else {
    await page.reload();
    await page.waitForSelector('#hydrated-marker', { state: 'attached' });
    await page.click('#tab-simulation');
  }

  // Verify Premium Lock Card disappears and premium ranges unlock dynamically (F3)
  await expect(page.locator('#premium-lock-card')).not.toBeVisible();
  await expect(page.locator('#range-50yr')).toBeEnabled();
  await expect(page.locator('#range-125yr')).toBeEnabled();

  // Perform accessibility audit on newly unlocked simulation panel (F7)
  let a11yResults = await new AxeBuilder({ page }).include('#panel-simulation').analyze();
  expect(a11yResults.violations).toEqual([]);

  // Step 4: Execute 1,000-Path Monte Carlo Web Worker Simulation for 125-Yr Range (F4)
  await page.click('#range-125yr');
  await page.fill('#input-num-paths', '1000');
  await page.fill('#input-retirement-horizon', '40');
  await page.fill('#input-inflation-rate', '0.025');
  await page.click('#run-simulation-btn');

  // Verify Web Worker simulation execution & results summary (F4)
  const summary = page.locator('#simulation-results-summary');
  await expect(summary).toBeVisible({ timeout: 15000 });
  await expect(summary).toContainText('125-Year Projection');
  await expect(summary).toContainText('1,000 paths simulated');

  // Assert Screen Reader parity in adjacent div.sr-only table (F4, F7)
  const srTable = page.locator('div.sr-only table');
  await expect(srTable).toBeAttached();
  const tableText = await srTable.textContent();
  expect(tableText).toContain('10th Percentile');
  expect(tableText).toContain('50th Percentile');
  expect(tableText).toContain('90th Percentile');

  // Step 5: Save Premium Plan & Capture Plan ID (F2, F5)
  await page.click('#save-plan-btn');
  await expect(page.locator('.toast-success')).toBeVisible();
  await expect(page).toHaveURL(/\/plans$/);
  
  const newPlanCard = page.locator('.plan-card', { hasText: 'Premium Upgraded 125-Yr Plan' }).first();
  await expect(newPlanCard).toBeVisible();
  const planHref = await newPlanCard.getAttribute('href');
  const planId = planHref ? planHref.split('/').pop() : 'premium-user-genuine-plan-id';

  // Step 6: Adversarial BOLA & Strict RLS Enforcement Check (F5)
  // Open a fresh context as a different Standard User to verify BOLA defense isolates the premium plan
  const adversarialContext = await page.context().browser()!.newContext();
  const adversarialPage = await adversarialContext.newPage();
  await loginAs(adversarialPage, 'another-standard-user@example.com', TEST_PASSWORD);

  // Attempt direct URL access to the premium plan ID
  await adversarialPage.goto(`/plans/${planId}`);
  await expect(adversarialPage).toHaveURL(/\/plans$/);
  const errorToast = adversarialPage.locator('.toast-error');
  await expect(errorToast).toBeVisible();
  await expect(errorToast).toContainText('You do not have permission to view this plan');

  // Attempt direct Server Action fetch injection to modify the premium plan (F5)
  const bolaResponse = await adversarialPage.evaluate(async (targetId) => {
    const res = await fetch('/api/actions/savePlan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: targetId,
        name: 'Hijacked Premium Plan',
        taxJurisdiction: 'US',
        stateProvince: 'CA',
        birthYear: 1990,
        retirementAge: 65
      })
    });
    return await res.json();
  }, planId);

  expect(bolaResponse.success).toBe(false);
  expect(bolaResponse.error).toContain('You do not have permission to modify this plan');

  await adversarialContext.close();
});
```

---

## Summary of Guidelines for the Implementer (Worker)
1. **File Placement**: Place the implementation directly in `e2e/planner_tier4_workload.spec.ts`.
2. **Imports**: Ensure `import { test, expect } from '@playwright/test';` and `import AxeBuilder from '@axe-core/playwright';` are included at the top of the file, alongside the standard `loginAs` helper function.
3. **Timeouts**: Utilize `{ timeout: 15000 }` on simulation summary assertions to account for Web Worker parallel execution time across 1,000 Monte Carlo bootstrap paths.
4. **Clean Execution**: Ensure all assertions use the documented selectors to guarantee a clean exit code `0` when invoked via `npx tsx e2e/run_e2e.ts`.
