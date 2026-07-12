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

test.describe('Tier 4 Adversarial Workload Scenarios (Playbook Gaps)', () => {

  // ============================================================================
  // ADV SCENARIO 1: In-Session Premium Upgrade & Dynamic Unlocking (Gap 3)
  // ============================================================================
  test('adv_1. In-Session Premium Upgrade & Dynamic Feature Unlocking', async ({ page }) => {
    await loginAs(page, STANDARD_USER);
    await page.goto('/plans/new');
    await page.waitForSelector('#hydrated-marker', { state: 'attached' });
    await page.click('#tab-simulation');

    // Verify initial locked state for Standard User
    await expect(page.locator('#premium-lock-card')).toBeVisible();
    await expect(page.locator('#range-125yr')).toBeDisabled();

    // Simulate in-session upgrade (e.g., triggering upgrade action or webhook simulation)
    await page.evaluate(async () => {
      await fetch('/api/dev/simulate-upgrade', { method: 'POST', body: JSON.stringify({ tier: 'premium' }) });
      window.dispatchEvent(new Event('user-tier-updated'));
    });

    // Verify dynamic unlocking without full relogin or page reload
    await expect(page.locator('#premium-lock-card')).not.toBeVisible({ timeout: 5000 });
    await expect(page.locator('#range-125yr')).toBeEnabled();
  });

  // ============================================================================
  // ADV SCENARIO 2: BOLA DOM Attack Persistence & Backend Absence Verification (Gap 5)
  // ============================================================================
  test('adv_2. BOLA DOM Attack Persistence & Backend Absence Verification', async ({ page }) => {
    await loginAs(page, STANDARD_USER);
    await page.goto('/plans/new');
    await page.waitForSelector('#hydrated-marker', { state: 'attached' });
    await page.click('#tab-simulation');

    // Inject Premium Range Parameter via DOM manipulation
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
    
    // Verify client/server error toast
    const errorToast = page.locator('.toast-error');
    await expect(errorToast).toBeVisible();
    await expect(errorToast).toContainText('This feature requires a Premium subscription');

    // Explicitly verify backend absence (ensure no partial or unentitled plan was saved)
    await page.goto('/plans');
    await expect(page.locator('.plan-card', { hasText: 'BOLA DOM Attack Plan' })).not.toBeVisible();
  });

  // ============================================================================
  // ADV SCENARIO 3: Next.js Server Action Direct Header BOLA Injection (Gap 6)
  // ============================================================================
  test('adv_3. Next.js Server Action Direct Header BOLA Injection', async ({ page }) => {
    await loginAs(page, STANDARD_USER);
    await page.goto('/plans');

    // Attempt direct Server Action invocation using Next-Action header against another user's plan
    const actionResponse = await page.evaluate(async () => {
      const res = await fetch('/plans', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Next-Action': 'c7b9e2a1' // Simulated Server Action ID for savePlan
        },
        body: JSON.stringify({
          id: 'premium-user-genuine-plan-id',
          name: 'Hijacked via Next-Action Header',
        })
      });
      return { status: res.status, text: await res.text() };
    });

    // Verify Server Action rejects the cross-tenant modification
    expect(actionResponse.status).toBeGreaterThanOrEqual(400);
    expect(actionResponse.text).toContain('permission');
  });

  // ============================================================================
  // ADV SCENARIO 4: HNW Portfolio UI List Reflection & Tax Optimization Strategy (Gaps 7 & 8)
  // ============================================================================
  test('adv_4. HNW Portfolio UI List Reflection & Tax Optimization Strategy', async ({ page }) => {
    await loginAs(page, PREMIUM_USER);
    await page.goto('/plans/new');
    await page.waitForSelector('#hydrated-marker', { state: 'attached' });

    // Add accounts and verify list reflection in DOM
    await page.click('#tab-accounts');
    await page.fill('#input-account-balance', '5000000');
    await page.fill('#input-account-cost-basis', '4000000');
    await page.selectOption('#select-account-owner', 'primary');
    // Select taxability type (exercising worker claimed feature)
    if (await page.locator('#select-account-tax-type').isVisible()) {
      await page.selectOption('#select-account-tax-type', 'taxable');
    }
    await page.click('#add-account-btn');

    // Assert account appears in UI list
    await expect(page.locator('.account-list-item', { hasText: '5,000,000' })).toBeVisible();

    // Select tax optimization strategy (exercising worker claimed feature)
    await page.click('#tab-spending');
    await page.selectOption('#select-spending-strategy', 'yale_endowment');
    if (await page.locator('#select-tax-optimization').isVisible()) {
      await page.selectOption('#select-tax-optimization', 'taxable_first');
    }
  });

  // ============================================================================
  // ADV SCENARIO 5: Comprehensive Quick Check Hydration Verification in Household Tab (Gap 9)
  // ============================================================================
  test('adv_5. Comprehensive Quick Check Hydration Verification in Household Tab', async ({ page }) => {
    await page.goto('/');
    const widget = page.locator('#quick-check-widget');
    await widget.locator('#quick-current-age').fill('40');
    await widget.locator('#quick-retirement-age').fill('55');
    await widget.locator('#quick-current-savings').fill('2000000');
    await widget.locator('#quick-monthly-contribution').fill('5000');
    await widget.locator('#save-unlock-btn').click();
    await page.waitForURL(/(\/login|\/auth)\?redirect=.*plans.*new/);

    await loginAs(page, PREMIUM_USER);
    await page.waitForSelector('#hydrated-marker', { state: 'attached' });

    // Explicitly verify household tab hydration in premium comprehensive flow
    await page.click('#tab-household');
    await expect(page.locator('#input-current-age')).toHaveValue('40');
    await expect(page.locator('#input-retirement-age')).toHaveValue('55');
  });
});
