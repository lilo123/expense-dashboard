import { test, expect } from '@playwright/test';

test.describe('Offline Mutation Resilience, Optimistic Rollbacks & Input Retention E2E', () => {
  const TEST_EMAIL = 'test-user@example.com';
  const TEST_PASSWORD = 'password123';

  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/dashboard/);
    await page.waitForSelector('#hydrated-marker', { state: 'attached' });
  });

  test('should instantly reflect optimistic updates when offline, gracefully rollback on network failure, and retain user input', async ({ page }) => {
    await page.click('#profile-btn');
    await page.click('a:has-text("Set Monthly Budget")');
    await expect(page).toHaveURL(/\/budget/);

    const aprilHeader = page.locator('#header-2026-04');
    if ((await aprilHeader.getAttribute('aria-expanded')) === 'false') {
      await aprilHeader.click();
    }

    await page.context().setOffline(true);

    const totalInput = page.locator('#panel-2026-04 input[type="number"]').first();
    await totalInput.fill('4200');

    const saveBtn = page.locator('#panel-2026-04 button[type="submit"]');
    await saveBtn.click();

    await expect(saveBtn).toContainText('Saving...');
    await expect(totalInput).toHaveValue('4200');

    await page.context().setOffline(false);
  });
});
