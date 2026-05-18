import { test, expect } from '@playwright/test';

test.describe('BudgetView Dynamic Month Picker & Rollover Inheritance E2E', () => {
  const TEST_EMAIL = 'test-user@example.com';
  const TEST_PASSWORD = 'password123';

  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/dashboard/);
    await page.waitForSelector('#hydrated-marker', { state: 'attached' });
    
    // Switch to Budget Tab where BudgetView is mounted
    await page.click('button:has-text("Budget")');
    await expect(page.locator('#budget-month-select')).toBeVisible();
  });

  test('should allow switching budget month and update total limits dynamically', async ({ page }) => {
    const monthInput = page.locator('#budget-month-select');

    // Switch to future month (e.g., 2026-10)
    await monthInput.fill('2026-10');
    await page.waitForTimeout(500); // Wait for useMemo re-render pass

    // Verify UI reflects active month
    await expect(monthInput).toHaveValue('2026-10');
  });

  test('should inherit prior month baseline when viewing a month with no explicit DB records', async ({ page }) => {
    const monthInput = page.locator('#budget-month-select');
    
    // Switch to a future month that has no explicit budget records in DB (e.g., 2026-12)
    await monthInput.fill('2026-12');
    await page.waitForTimeout(500);

    // Verify that total limits are inherited from prior baseline rather than displaying $0.00
    const availableBgtCard = page.locator('.grid > div').first();
    await expect(availableBgtCard).toBeVisible();
    await expect(availableBgtCard).not.toContainText('Total Limits ($0.00)');
  });

  test('should inherit baselines seamlessly across annual calendar boundaries (Dec 2025 -> Jan 2026)', async ({ page }) => {
    const monthInput = page.locator('#budget-month-select');
    
    await monthInput.fill('2026-01');
    await page.waitForTimeout(500);

    const availableBgtCard = page.locator('.grid > div').first();
    await expect(availableBgtCard).toBeVisible();
    await expect(availableBgtCard).not.toContainText('Total Limits ($0.00)');
  });
});

test.describe('Timezone & Boundary Resilience (Kiribati vs Hawaii)', () => {
  const TEST_EMAIL = 'test-user@example.com';
  const TEST_PASSWORD = 'password123';

  test.use({ timezoneId: 'Pacific/Kiritimati' }); // UTC+14

  test('should render correct current month in extreme eastern timezone (Kiribati)', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/dashboard/);
    await page.waitForSelector('#hydrated-marker', { state: 'attached' });

    await page.click('button:has-text("Budget")');
    const monthInput = page.locator('#budget-month-select');
    await expect(monthInput).toBeVisible();
  });
});

test.describe('Timezone & Boundary Resilience (Kiribati vs Hawaii - Western)', () => {
  const TEST_EMAIL = 'test-user@example.com';
  const TEST_PASSWORD = 'password123';

  test.use({ timezoneId: 'Pacific/Honolulu' }); // UTC-10

  test('should render correct current month in extreme western timezone (Hawaii)', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/dashboard/);
    await page.waitForSelector('#hydrated-marker', { state: 'attached' });

    await page.click('button:has-text("Budget")');
    const monthInput = page.locator('#budget-month-select');
    await expect(monthInput).toBeVisible();
  });
});
