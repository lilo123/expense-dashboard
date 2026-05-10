import { test, expect } from '@playwright/test';

test.describe('Dashboard Core Flows', () => {
  const TEST_EMAIL = 'test-user@example.com';
  const TEST_PASSWORD = 'password123';

  test.beforeEach(async ({ page }) => {
    // Perform login before each test
    await page.goto('/login');
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/dashboard/);
    
    // Wait for client-side hydration to be complete
    await page.waitForSelector('#hydrated-marker', { state: 'attached' });
  });

  test('should navigate between tabs successfully', async ({ page }) => {
    // Verify initial tab is Dashboard
    await expect(page.locator('.container > #tab-dashboard')).toHaveClass(/active/);

    // Navigate to Recent
    await page.click('#action-elem-2'); // Recent Tab Button
    await expect(page.locator('.container > #tab-recent')).toHaveClass(/active/);
    await expect(page.locator('#select-mode-btn')).toBeVisible();

    // Navigate to Yearly
    await page.click('#action-elem-3'); // Yearly Tab Button
    await expect(page.locator('.container > #tab-yearly')).toHaveClass(/active/);
  });

  test('should successfully log, edit, and delete an expense', async ({ page }) => {
    // Go to Recent tab to see list updates easily
    await page.click('#action-elem-2');

    // --- 1. ADD EXPENSE ---
    await page.click('#fab'); // Open Add Modal
    await expect(page.locator('#add-modal')).toBeVisible();

    await page.fill('#add-item', 'E2E Test Expense');
    await page.fill('#add-amount', '12.75');
    
    // Select first available category option (skipping disabled first option)
    await page.locator('#add-category').selectOption({ index: 1 });
    
    await page.click('#add-expense-btn');
    
    // Verify modal closed and expense added
    await expect(page.locator('#add-modal')).not.toBeVisible();
    const expenseItem = page.locator('.expense-item', { hasText: 'E2E Test Expense' }).first();
    await expect(expenseItem).toBeVisible();
    await expect(expenseItem.locator('.expense-amount')).toContainText('$12.75');

    // Verify Glassmorphism class on added item
    await expect(expenseItem).toHaveClass(/bg-white\/40/);
    await expect(expenseItem).toHaveClass(/backdrop-blur-md/);

    // --- 2. EDIT EXPENSE ---
    await expenseItem.click(); // Click to edit
    await expect(page.locator('#edit-modal')).toBeVisible(); // Assumes edit modal exists with this ID

    await page.fill('#edit-item', 'E2E Test Expense Updated');
    await page.click('#save-edit-btn'); // Save button inside Edit Modal

    await expect(page.locator('#edit-modal')).not.toBeVisible();
    await expect(page.locator('.expense-item', { hasText: 'E2E Test Expense Updated' }).first()).toBeVisible();
    // We don't check for complete absence of "E2E Test Expense" because dirty DB might have duplicates, 
    // but we check that our edited item is visible.

    // --- 3. DELETE EXPENSE ---
    await page.locator('.expense-item', { hasText: 'E2E Test Expense Updated' }).first().click();
    await expect(page.locator('#edit-modal')).toBeVisible();
    
    // Handle confirm dialog
    page.once('dialog', dialog => dialog.accept());
    await page.click('#delete-edit-btn'); // Delete action inside Edit Modal

    await expect(page.locator('#edit-modal')).not.toBeVisible();
    await expect(page.locator('.expense-item', { hasText: 'E2E Test Expense Updated' })).not.toBeVisible();
  });

  test('should support bulk selection and bulk deletion', async ({ page }) => {
    await page.click('#action-elem-2'); // Recent Tab

    // Log 2 separate expenses for bulk actions
    for (let i = 1; i <= 2; i++) {
      await page.click('#fab');
      await page.fill('#add-item', `Bulk Exp ${i}`);
      await page.fill('#add-amount', `${i * 10}`);
      await page.locator('#add-category').selectOption({ index: 1 });
      await page.click('#add-expense-btn');
      await expect(page.locator('#add-modal')).not.toBeVisible();
    }

    // Verify both logged
    const item1 = page.locator('.expense-item', { hasText: 'Bulk Exp 1' });
    const item2 = page.locator('.expense-item', { hasText: 'Bulk Exp 2' });
    await expect(item1).toBeVisible();
    await expect(item2).toBeVisible();

    // Toggle select mode
    await page.click('#select-mode-btn');
    await expect(page.locator('#bulk-actions')).toBeVisible();

    // Select both items
    await item1.click();
    await item2.click();

    // Assert they are visually selected (have active classes)
    await expect(item1).toHaveClass(/bg-zen-sage\/20/);
    await expect(item2).toHaveClass(/bg-zen-sage\/20/);

    // Click bulk delete and confirm
    page.once('dialog', dialog => dialog.accept());
    await page.click('#bulk-delete-btn');

    // Bulk actions should hide, select mode exits
    await expect(page.locator('#bulk-actions')).not.toBeVisible();
    
    // Items should be gone
    await expect(item1).not.toBeVisible();
    await expect(item2).not.toBeVisible();
  });
});
