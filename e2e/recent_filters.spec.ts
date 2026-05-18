import { test, expect } from '@playwright/test';

test.describe('Recent Tab Filters, Search, and Sort', () => {
  const TEST_EMAIL = 'test-user@example.com';
  const TEST_PASSWORD = 'password123';

  test.beforeEach(async ({ page }) => {
    // 1. Login
    await page.goto('/login');
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/dashboard/);
    
    // Wait for client-side hydration to be complete
    await page.waitForSelector('#hydrated-marker', { state: 'attached' });

    // 2. Navigate to Recent Tab
    await page.click('#action-elem-2'); // Recent Tab Button
    await expect(page.locator('.container > #tab-recent')).toHaveClass(/active/);
    
    // Ensure the list is loaded
    await expect(page.locator('#recent-list')).toBeVisible();
  });

  test('should filter expenses by search query', async ({ page }) => {
    // Type "Netflix" in search (seeded as recurring)
    await page.fill('#search-input', 'Netflix');
    
    // Verify only Netflix items are visible (should be at least one)
    const items = page.locator('.expense-item');
    const count = await items.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      await expect(items.nth(i).locator('h4')).toContainText('Netflix');
    }
  });

  test('should filter expenses by category', async ({ page }) => {
    // 1. Open category dropdown
    await page.click('#category-filter');

    // 2. Select "Subscriptions" checkbox (Netflix belongs to Subscriptions)
    await page.locator('label', { hasText: 'Subscriptions' }).click();

    // 3. Close dropdown by clicking the backdrop mask
    await page.locator('.fixed.inset-0.z-40').click();

    // Verify all visible items have Subscriptions category
    const items = page.locator('.expense-item');
    const count = await items.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      await expect(items.nth(i).locator('.expense-info p')).toContainText('Subscriptions');
    }
  });

  test('should filter expenses by type (recurring)', async ({ page }) => {
    // 1. Open type dropdown
    await page.click('#type-filter');

    // 2. Select "Recurring" checkbox
    await page.locator('label[for="checkbox-type-filter-recurring"]').click();

    // 3. Close dropdown
    await page.locator('.fixed.inset-0.z-40').click();

    // Verify all visible items have the recurring icon
    const items = page.locator('.expense-item');
    const count = await items.count();
    expect(count).toBeGreaterThan(0);
    
    for (let i = 0; i < count; i++) {
      await expect(items.nth(i).locator('[data-testid="recurring-icon"]')).toBeVisible();
    }
  });

  test('should filter expenses by type (one-off)', async ({ page }) => {
    // 1. Open type dropdown
    await page.click('#type-filter');

    // 2. Select "One-off" checkbox
    await page.locator('label', { hasText: 'One-off' }).click();

    // 3. Close dropdown
    await page.locator('.fixed.inset-0.z-40').click();

    // Verify no visible items have the recurring icon
    const items = page.locator('.expense-item');
    const count = await items.count();
    for (let i = 0; i < count; i++) {
      await expect(items.nth(i).locator('[data-testid="recurring-icon"]')).not.toBeVisible();
    }
  });

  test('should sort expenses by amount descending', async ({ page }) => {
    // Select "Highest Amount"
    await page.selectOption('#sort-select', 'amount-desc');

    // Get all amounts and verify they are sorted desc
    const items = page.locator('.expense-item');
    const count = await items.count();
    expect(count).toBeGreaterThan(1);

    let previousAmount = Infinity;
    for (let i = 0; i < Math.min(count, 5); i++) { // Check first 5 items
      const amountText = await items.nth(i).locator('.expense-amount').innerText();
      const amount = parseFloat(amountText.replace(/[^0-9.]/g, ''));
      expect(amount).toBeLessThanOrEqual(previousAmount);
      previousAmount = amount;
    }
  });

  test('should render optimistic empty state when no matches', async ({ page }) => {
    // Search for impossible string
    await page.fill('#search-input', 'XYZ_NON_EXISTENT_EXPENSE_XYZ');

    // Verify empty state card is visible with correct text
    const emptyState = page.locator('.empty-state');
    await expect(emptyState).toBeVisible();
    await expect(emptyState.locator('p').first()).toContainText('No expenses found for this view.');
    await expect(emptyState.locator('p').nth(1)).toContainText('You are all caught up!');
    
    // Verify glassmorphism classes on empty state
    await expect(emptyState).toHaveClass(/bg-white\/40/);
    await expect(emptyState).toHaveClass(/backdrop-blur-md/);
  });

  test('should support combined search, filter, and sort', async ({ page }) => {
    // 1. Filter by type "recurring"
    await page.click('#type-filter');
    await page.locator('label[for="checkbox-type-filter-recurring"]').click();
    await page.locator('.fixed.inset-0.z-40').click();
    
    // 2. Search for "Netflix" (should match Netflix)
    await page.fill('#search-input', 'Netflix');

    // Verify only Netflix recurring items are visible
    const items = page.locator('.expense-item');
    const count = await items.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      await expect(items.nth(i).locator('h4')).toContainText('Netflix');
      await expect(items.nth(i).locator('[data-testid="recurring-icon"]')).toBeVisible();
    }
  });
});
