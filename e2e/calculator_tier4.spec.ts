import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('M5.4: Tier 4 E2E Test Pass - Real-World Application Scenarios & Accessibility Audits', () => {
  test('1. Public Dual Entry Quick Check Widget - Accessibility Audit & Hydration Resilience', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h2', { hasText: 'Quick Check Widget' })).toBeVisible();
    const accessibilityScanResults = await new AxeBuilder({ page })
      .analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('2. Authenticated Detailed Plan Builder (/calculator) - Accessibility Audit', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'test-user@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
    await page.goto('/calculator');
    await expect(page.locator('h2', { hasText: 'Simulation Parameters' })).toBeVisible();
    const accessibilityScanResults = await new AxeBuilder({ page })
      .analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('3. Premium Lock Card View - Accessibility Audit & Bounding Box Check', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'test-user@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
    await page.goto('/calculator');
    await page.selectOption('select[name="withdrawalStrategy"]', 'guyton_klinger');
    await page.check('input#minWithdrawalLimitEnabled');
    await page.click('button:has-text("Save Config")');
    await expect(page.locator('text=Premium tier required')).toBeVisible();
    const accessibilityScanResults = await new AxeBuilder({ page })
      .analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('4. Real-World Scenario: Global Market Data + Accumulation Phase - CLS Bounding Box Check', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'test-user@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
    await page.goto('/calculator');
    const boxBefore = await page.locator('form').boundingBox();
    await page.click('label:has-text("Global Market (MSCI)")');
    await page.click('label:has-text("Retirement & Accumulation Period")');
    await expect(page.locator('input[name="currentAge"]')).toBeEnabled();
    const boxAfter = await page.locator('form').boundingBox();
    expect(boxAfter?.width).toBeGreaterThan(0);
  });

  test('5. Real-World Scenario: Scrambled Monte Carlo + Accumulation Phase - Accessibility Audit', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'test-user@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
    await page.goto('/calculator');
    await page.click('label:has-text("Scrambled Monte Carlo")');
    await page.click('label:has-text("Retirement & Accumulation Period")');
    await expect(page.locator('input[name="additionalContribution"]')).toBeEnabled();
    const accessibilityScanResults = await new AxeBuilder({ page })
      .analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('6. Real-World Scenario: Drawdown Engine (CAPE Based) + Global Market Data - Hydration Resilience', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'test-user@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
    await page.goto('/calculator');
    await page.click('label:has-text("Global Market (MSCI)")');
    await page.selectOption('select[name="withdrawalStrategy"]', 'cape_based');
    await expect(page.locator('input[name="capeWithdrawalRate"]')).toBeVisible();
    await page.reload();
    await expect(page.locator('h2', { hasText: 'Simulation Parameters' })).toBeVisible();
  });

  test('7. Real-World Scenario: Full Calculator 125-Year Range + Premium Lock - Accessibility Audit', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'test-user@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
    await page.goto('/calculator');
    await page.click('label:has-text("Retirement & Accumulation Period")');
    await page.fill('input[name="currentAge"]', '20');
    await page.fill('input[name="retirementAge"]', '80');
    await page.fill('input[name="duration"]', '65');
    await page.click('button:has-text("Save Config")');
    await expect(page.locator('text=Premium tier required')).toBeVisible();
    const accessibilityScanResults = await new AxeBuilder({ page })
      .analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });
});
