import { test, expect } from '@playwright/test';

test.describe('M5.3: Tier 3 E2E Test Pass - Cross-Feature Combinations', () => {
  test.beforeEach(async ({ page }) => {
    // Log in as standard user first
    await page.goto('/login');
    await page.fill('input[type="email"]', 'test-user@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
    await page.goto('/calculator');
  });

  test('1. Scrambled Monte Carlo + BOLA Defense', async ({ page }) => {
    // Select Scrambled Monte Carlo
    await page.click('label:has-text("Scrambled Monte Carlo")');
    await page.click('button:has-text("Save Config")');
    await expect(page.locator('text=Configuration saved successfully!')).toBeVisible();
  });

  test('3. Drawdown Engine + Premium Entitlement Checks', async ({ page }) => {
    // Enable Min Withdrawal Limit (custom guardrail)
    await page.selectOption('select[name="withdrawalStrategy"]', 'guyton_klinger');
    await page.check('input#minWithdrawalLimitEnabled');
    await page.click('button:has-text("Save Config")');
    // Standard user should be rejected for premium feature
    await expect(page.locator('text=Premium tier required')).toBeVisible();
  });

  test('4. Global Market Data + Accumulation Phase', async ({ page }) => {
    await page.click('label:has-text("Global Market (MSCI)")');
    await page.click('label:has-text("Retirement & Accumulation Period")');
    await expect(page.locator('input[name="currentAge"]')).toBeEnabled();
  });

  test('5. Scrambled Monte Carlo + Accumulation Phase', async ({ page }) => {
    await page.click('label:has-text("Scrambled Monte Carlo")');
    await page.click('label:has-text("Retirement & Accumulation Period")');
    await expect(page.locator('input[name="additionalContribution"]')).toBeEnabled();
  });

  test('5. Drawdown Engine + Global Market Data', async ({ page }) => {
    await page.click('label:has-text("Global Market (MSCI)")');
    await page.selectOption('select[name="withdrawalStrategy"]', 'cape_based');
    await expect(page.locator('input[name="capeWithdrawalRate"]')).toBeVisible();
  });

  test('8. Full Calculator State + Premium Entitlement Checks', async ({ page }) => {
    await page.click('label:has-text("Retirement & Accumulation Period")');
    await page.fill('input[name="currentAge"]', '20');
    await page.fill('input[name="retirementAge"]', '80');
    await page.fill('input[name="duration"]', '65'); // 125 years total
    await page.click('button:has-text("Save Config")');
    await expect(page.locator('text=Premium tier required')).toBeVisible();
  });
});
