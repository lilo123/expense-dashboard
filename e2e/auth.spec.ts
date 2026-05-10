import { test, expect } from '@playwright/test';

test.describe('Authentication Flows', () => {
  // We assume a test user is seeded in the local database
  const TEST_EMAIL = 'test-user@example.com';
  const TEST_PASSWORD = 'password123';

  test('should redirect unauthenticated users to login', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator('h2')).toContainText('Welcome Back');
  });

  test('should display error on invalid login credentials', async ({ page }) => {
    await page.goto('/login');

    await page.fill('input[type="email"]', 'wrong@example.com');
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');

    // Assert empathetic error or standard auth error
    const errorMsg = page.locator('p.text-zen-charcoal'); // Selector based on login page error wrapper
    await expect(errorMsg).toBeVisible();
    await expect(errorMsg).not.toContainText('Game Over'); // Brand sanity check
  });

  test('should successfully login and persist session', async ({ page }) => {
    await page.goto('/login');

    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');

    // Should redirect to dashboard
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.locator('#logout-btn')).toBeVisible();

    // Reload to verify session persistence
    await page.reload();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('should navigate and complete forgot password flow', async ({ page }) => {
    await page.goto('/login');
    await page.click('text=Forgot Password?');

    await expect(page).toHaveURL(/\/forgot-password/);
    await expect(page.locator('h2')).toContainText('Reset Password');

    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.click('button[type="submit"]');

    // Check success message
    const successMsg = page.locator('p.bg-zen-sage\\/20');
    await expect(successMsg).toBeVisible();
    await expect(successMsg).toContainText('Check your email for the password reset link.');
  });
});
