import { test, expect } from '@playwright/test';

test.describe('OnboardingModal Inline Category Management & Safeguards E2E', () => {
  const TEST_EMAIL = 'test-user@example.com';
  const TEST_PASSWORD = 'password123';

  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/dashboard/);
    await page.waitForSelector('#hydrated-marker', { state: 'attached' });

    // Dispatch custom event to toggle OnboardingModal open
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('onboarding-sim')));
  });

  test('should allow adding a new category inline and allocating budget', async ({ page }) => {
    const modal = page.locator('.modal-content').first();
    await expect(modal).toBeVisible();

    if (await modal.locator('button:has-text("Continue")').isVisible()) {
      await modal.locator('button:has-text("Continue")').click();
    }

    await expect(modal.locator('h2')).toContainText('Allocate');

    const newCatInput = modal.locator('input[placeholder="New category name..."]');
    await newCatInput.fill('E2E Inline Category');
    await modal.locator('button:has-text("Add")').click();

    await expect(modal.locator('span', { hasText: 'E2E Inline Category' })).toBeVisible();
  });

  test('should safeguard active categories and block deletion if active expenses exist', async ({ page }) => {
    const modal = page.locator('.modal-content').first();
    await expect(modal).toBeVisible();

    if (await modal.locator('button:has-text("Continue")').isVisible()) {
      await modal.locator('button:has-text("Continue")').click();
    }

    let dialogMessage = '';
    page.on('dialog', async dialog => {
      dialogMessage = dialog.message();
      await dialog.dismiss();
    });

    const housingDeleteBtn = modal.locator('div:has(span:has-text("Housing"))').locator('button').first();
    await housingDeleteBtn.click();

    expect(dialogMessage).toContain('contains expenses. Please use the Category Management tab');
    await expect(housingDeleteBtn).toBeFocused();
  });
});
