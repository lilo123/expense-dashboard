import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('M5.4: Tier 4 E2E Test Pass - Strict Accessibility Audits (Challenger Verification)', () => {
  test('1. Public Dual Entry Quick Check Widget - Strict Accessibility Audit', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h2', { hasText: 'Quick Check Widget' })).toBeVisible();
    const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('2. Authenticated Detailed Plan Builder (/calculator) - Strict Accessibility Audit', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'test-user@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
    await page.goto('/calculator');
    await expect(page.locator('h2', { hasText: 'Simulation Parameters' })).toBeVisible();
    const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('3. Premium Lock Card View - Strict Accessibility Audit', async ({ page }) => {
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
    const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('5. Real-World Scenario: Scrambled Monte Carlo + Accumulation Phase - Strict Accessibility Audit', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'test-user@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
    await page.goto('/calculator');
    await page.click('label:has-text("Scrambled Monte Carlo")');
    await page.click('label:has-text("Retirement & Accumulation Period")');
    await expect(page.locator('input[name="additionalContribution"]')).toBeEnabled();
    const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('7. Real-World Scenario: Full Calculator 125-Year Range + Premium Lock - Strict Accessibility Audit', async ({ page }) => {
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
    const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });
});
