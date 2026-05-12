import { test, expect } from '@playwright/test';

test.describe('Phase 1.8: Recurring Expenses Dashboard & Automation E2E', () => {
  const TEST_EMAIL = 'test-user@example.com';
  const TEST_PASSWORD = 'password123';

  test.beforeEach(async ({ page }) => {
    // Authenticate and login
    await page.goto('/login');
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/dashboard/);
    
    // Wait for client-side hydration
    await page.waitForSelector('#hydrated-marker', { state: 'attached' });

    // Forward console logs from browser
    page.on('console', msg => console.log('[BROWSER CONSOLE]', msg.text()));
  });

  test('should verify profile dropdown contains Recurring Expense above Siri Setup', async ({ page }) => {
    const profileBtn = page.locator('#profile-btn');
    await expect(profileBtn).toBeVisible();

    await profileBtn.click();
    const dropdown = page.locator('#profile-dropdown');
    await expect(dropdown).toBeVisible();

    // Verify Recurring Expense exists
    const recurringBtn = dropdown.locator('button', { hasText: 'Recurring Expense' });
    await expect(recurringBtn).toBeVisible();

    // Verify order: Siri Setup should be visible below Recurring Expense
    const siriBtn = dropdown.locator('button', { hasText: 'Siri Setup' });
    await expect(siriBtn).toBeVisible();

    // Let's verify layout hierarchy order
    const recurringBox = await recurringBtn.boundingBox();
    const siriBox = await siriBtn.boundingBox();
    
    if (recurringBox && siriBox) {
      expect(recurringBox.y).toBeLessThan(siriBox.y); // Recurring is ABOVE Siri Setup!
    }
  });

  test('should support full CRUD scheduling flow (Weekly on Friday, End after Occurrences)', async ({ page }) => {
    // 1. Open Modal Dashboard
    await page.click('#profile-btn');
    await page.click('#profile-dropdown button:has-text("Recurring Expense")');
    
    const modal = page.locator('.modal-content');
    await expect(modal).toBeVisible();
    await expect(modal.locator('h2:has-text("Recurring Expense")')).toBeVisible();

    // 2. Transition to Form view
    await modal.locator('button:has-text("+ Add New")').click();
    await expect(modal.locator('h2:has-text("Add Recurring Expense")')).toBeVisible();

    // Verify timezone local run time helper copy exists
    await expect(modal.locator('p:has-text("logged at")')).toBeVisible();

    // 3. Fill schedule parameters
    await modal.locator('input[placeholder*="Rent"]').fill('Spotify Premium');
    await modal.locator('input[placeholder="0.00"]').fill('14.99');
    
    // Switch to Weekly
    await modal.locator('select[aria-label="Frequency"]').selectOption('weekly');
    
    // Verify day pills are visible, select Friday (Fri)
    const friPill = modal.locator('button:has-text("Fri")');
    await expect(friPill).toBeVisible();
    await friPill.click();

    // Set start date to today
    const todayString = new Date().toISOString().split('T')[0];
    await modal.locator('input[type="date"]').first().fill(todayString);

    // Set Until Expiration to 12 Runs (click After radio and fill input)
    await modal.locator('input#endsAfterOccurrences').click();
    await modal.locator('input#maxOccurrencesInput').fill('12');

    // Select first available Category
    await modal.locator('select[aria-label="Category"]').selectOption({ index: 1 });

    // Submit Form
    await modal.locator('button:has-text("Schedule")').click();

    // 4. Verify item is rendered in the dashboard list
    const successAlert = modal.locator('.bg-zen-sage\\/20');
    await expect(successAlert).toBeVisible();
    await expect(successAlert).toContainText('registered successfully');

    // Transitioned back to list view
    await expect(modal.locator('h2:has-text("Recurring Expense")')).toBeVisible();
    
    const listItem = modal.locator('[data-testid="recurring-item"]:has(h4:has-text("Spotify Premium"))');
    await expect(listItem).toBeVisible();
    await expect(listItem.locator('p:has-text("Weekly (Fri)")')).toBeVisible();
    await expect(listItem.locator('p:has-text("0/12 runs")')).toBeVisible();
    await expect(modal.locator('.font-bold:has-text("C$14.99")')).toBeVisible();

    // 5. Delete configuration
    // We mock confirm delete to true
    page.on('dialog', dialog => dialog.accept());
    await listItem.locator('button[aria-label="Delete Config"]').click();

    // Verify removed from list
    await expect(listItem).not.toBeVisible();
  });
});
