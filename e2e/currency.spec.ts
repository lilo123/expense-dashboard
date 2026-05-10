import { test, expect } from '@playwright/test';

test.describe('Phase 1.65: Trigger Seeding & Currency System E2E', () => {
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

  test('should verify the Postgres trigger auto-seeded the 16 default categories', async ({ page }) => {
    // Open Add modal to check the categories select dropdown
    await page.click('#fab');
    await expect(page.locator('#add-modal')).toBeVisible();

    const categoryDropdown = page.locator('#add-category');
    await expect(categoryDropdown).toBeVisible();

    // Extract option texts from the select element
    const options = await categoryDropdown.evaluate((select: HTMLSelectElement) => {
      return Array.from(select.options).map(opt => opt.text);
    });

    // Our 16 default categories (+ disabled first option)
    const expectedCategories = [
      'Select category',
      'Housing', 'Utilities', 'Insurance', 'Groceries', 'Dining Out', 
      'Transportation', 'Household', 'Health & Care', 'Subscriptions', 
      'Shopping', 'Entertainment', 'Travel', 'Gifts', 'Education', 'Misc', 'Sport'
    ];

    expect(options.length).toBe(expectedCategories.length);
    
    // Verify the list contains exactly the PRD specified categories
    expectedCategories.forEach(cat => {
      expect(options).toContain(cat);
    });

    // Close modal
    await page.click('#add-modal .close');
  });

  test('should log expense in foreign currency (VND), convert to base USD, and display compressed pill format in list', async ({ page }) => {
    await page.click('#action-elem-2'); // Go to Recent Tab to verify addition

    // 1. Log the foreign expense
    await page.click('#fab');
    await expect(page.locator('#add-modal')).toBeVisible();

    await page.fill('#add-item', 'VND Pho Noodles 🍜');
    
    // Select VND from amount currency dropdown
    const currencyDropdown = page.getByRole('combobox', { name: 'Currency' });
    await currencyDropdown.selectOption('VND');
    
    // Enter amount: 100,000 VND
    await page.fill('#add-amount', '100000');
    
    // Select 'Dining Out' category
    await page.locator('#add-category').selectOption({ label: 'Dining Out' });
    
    await page.click('#add-expense-btn');
    await expect(page.locator('#add-modal')).not.toBeVisible();

    // 2. Assert display in Recent List
    // Should display in the original currency logged (VND) since preferred display currency is still USD (base)
    const loggedItem = page.locator('.expense-item', { hasText: 'VND Pho Noodles 🍜' }).first();
    await expect(loggedItem).toBeVisible();
    
    // Should be formatted in compressed format: 100K ₫
    const loggedAmountText = await loggedItem.locator('.expense-amount').innerText();
    expect(loggedAmountText).toBe('100K ₫');
  });

  test('should swap Display Currency, convert totals dynamically, and shorten large VND numbers', async ({ page }) => {
    // Verify total is initially in USD
    const totalLabel = page.locator('#total-amount');
    await expect(totalLabel).toBeVisible();
    
    const initialTotalText = await totalLabel.innerText();
    expect(initialTotalText).toContain('$'); // Default base display is USD

    // Swap top header Display Currency to VND
    const headerCurrencyDropdown = page.locator('nav select, div.header select'); // Select dropdown in header
    await expect(headerCurrencyDropdown).toBeVisible();
    await headerCurrencyDropdown.selectOption('VND');

    // Total Expense amount should update dynamically to VND
    // We seeded 35 random expenses with amounts between $2.25 and $130.00 (converted to VND in display)
    // The total will be large (e.g., several Million VND). It should be shortened to 'M ₫'!
    await expect(totalLabel).toContainText('M ₫'); // Verify compressed Millions glyph format is used for totals

    // Swapping to EUR should show standard decimal Euro formatting
    await headerCurrencyDropdown.selectOption('EUR');
    await expect(totalLabel).toContainText('€');
    await expect(totalLabel).not.toContainText('K'); // Standard decimal format
    await expect(totalLabel).not.toContainText('M');
  });
});
