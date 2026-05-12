import { test, expect } from '@playwright/test';

test.describe('Phase 1.65 Extensions: Trigger Seeding & CAD/VND Currency E2E', () => {
  const TEST_EMAIL = 'test-user@example.com';
  const TEST_PASSWORD = 'password123';

  test.beforeEach(async ({ page }) => {
    // 1. Authenticate and log in before each test
    await page.goto('/login');
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/dashboard/);
    
    // Wait for client-side hydration
    await page.waitForSelector('#hydrated-marker', { state: 'attached' });
  });

  test('should verify the Postgres trigger auto-seeded the 16 default categories', async ({ page }) => {
    await page.click('#fab');
    await expect(page.locator('#add-modal')).toBeVisible();

    const categoryDropdown = page.locator('#add-category');
    await expect(categoryDropdown).toBeVisible();

    // Extract option texts from the select element
    const options = await categoryDropdown.evaluate((select: HTMLSelectElement) => {
      return Array.from(select.options).map(opt => opt.text);
    });

    const expectedCategories = [
      'Select category',
      'Housing', 'Utilities', 'Insurance', 'Groceries', 'Dining Out', 
      'Transportation', 'Household', 'Health & Care', 'Subscriptions', 
      'Shopping', 'Entertainment', 'Travel', 'Gifts', 'Education', 'Misc', 'Sport'
    ];

    expect(options.length).toBe(expectedCategories.length);
    
    expectedCategories.forEach(cat => {
      expect(options).toContain(cat);
    });

    await page.click('#add-modal .close-btn');
  });

  test('should log in foreign VND, convert to base CAD (C$), and display compressed pill format in Recent list', async ({ page }) => {
    await page.click('#action-elem-2'); // Go to Recent Tab

    await page.click('#fab');
    await expect(page.locator('#add-modal')).toBeVisible();

    await page.fill('#add-item', 'VND Pho Noodles 🍜');
    
    // Select VND from accessible Currency combobox dropdown
    const currencyDropdown = page.getByRole('combobox', { name: 'Currency' });
    await currencyDropdown.selectOption('VND');
    
    // Enter amount: 100,000 VND
    await page.fill('#add-amount', '100000');
    
    // Select 'Dining Out' category
    await page.locator('#add-category').selectOption({ label: 'Dining Out' });
    
    await page.click('#add-expense-btn');
    await expect(page.locator('#add-modal')).not.toBeVisible();

    const loggedItem = page.locator('.expense-item', { hasText: 'VND Pho Noodles 🍜' }).first();
    await expect(loggedItem).toBeVisible();
    
    const loggedAmountText = await loggedItem.locator('.expense-amount').innerText();
    expect(loggedAmountText).toBe('100K ₫');
  });

  test('should swap Display Currency, convert totals dynamically, and format large numbers', async ({ page }) => {
    const totalLabel = page.locator('#total-amount-desktop');
    await expect(totalLabel).toBeVisible();
    
    const initialTotalText = await totalLabel.innerText();
    expect(initialTotalText).toContain('C$'); 

    // 1. Open Profile dropdown first to access currency selector
    await page.click('#profile-btn');
    const dropdown = page.locator('#profile-dropdown');
    await expect(dropdown).toBeVisible();

    // 2. Select VND
    const dropdownCurrencySelect = dropdown.locator('select[aria-label="Currency"]');
    await expect(dropdownCurrencySelect).toBeVisible();
    await dropdownCurrencySelect.selectOption('VND');

    // Total updates dynamically to VND Millions compressed
    await expect(totalLabel).toContainText('M ₫'); 

    // 3. Open again to swap to EUR
    await page.click('#profile-btn');
    await expect(dropdown).toBeVisible();
    await dropdownCurrencySelect.selectOption('EUR');

    await expect(totalLabel).toContainText('€');
    await expect(totalLabel).not.toContainText('K');
    await expect(totalLabel).not.toContainText('M');
  });

  test('should remember Display Currency preference via LocalStorage across reloads (Hydration-Safe)', async ({ page }) => {
    const totalLabel = page.locator('#total-amount-desktop');
    const dropdown = page.locator('#profile-dropdown');

    // 1. Open dropdown and select VND
    await page.click('#profile-btn');
    await expect(dropdown).toBeVisible();
    const dropdownCurrencySelect = dropdown.locator('select[aria-label="Currency"]');
    await dropdownCurrencySelect.selectOption('VND');
    await expect(totalLabel).toContainText('M ₫');

    // 2. Reload page
    await page.reload();
    await page.waitForSelector('#hydrated-marker', { state: 'attached' });

    // 3. Assert selection is remembered inside dropdown!
    await page.click('#profile-btn');
    await expect(dropdown).toBeVisible();
    await expect(dropdownCurrencySelect).toHaveValue('VND');
    await expect(totalLabel).toContainText('M ₫');
  });
});
