import { test, expect } from '@playwright/test';

test.describe('Automated Invitation E2E Workflows', () => {
  test('visitor navigating to sign-up toggle encounters invite form and successfully requests access', async ({ page }) => {
    await page.goto('/login#toggle-to-signup');
    await expect(page.locator('h2')).toContainText('Request an Invite');
    await expect(page.locator('text=An-yen is currently invite-only')).toBeVisible();

    await page.fill('input[type="email"]', 'earlyadopter@an-yen.com');
    await page.fill('textarea', 'I am incredibly excited to track my monthly surplus with An-yen!');
    await page.click('button[type="submit"]');

    await expect(page.locator('p.bg-zen-sage\\/20')).toContainText('Your invitation request has been received.');
  });

  test('administrator clicks profile menu button to expose dropdown and navigates to admin dashboard', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'founder@an-yen.com');
    await page.fill('input[type="password"]', 'adminpass123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/dashboard/);

    const profileBtn = page.locator('#profile-btn');
    await profileBtn.waitFor({ state: 'visible' });
    await profileBtn.click();

    const adminLink = page.locator('#profile-dropdown text=Admin Dashboard');
    await expect(adminLink).toBeVisible();
    await adminLink.click();
    await expect(page).toHaveURL(/\/admin/);
  });

  test('non-admin user accessing admin management console is redirected to dashboard', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'standard-user@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/dashboard/);

    await page.goto('/admin');
    await expect(page).toHaveURL(/\/dashboard/);
  });
});
