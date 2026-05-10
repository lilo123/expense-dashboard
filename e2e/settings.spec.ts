import { test, expect } from '@playwright/test';

test.describe('Phase 1.7: Settings & Profile Management E2E', () => {
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

  test('should verify Profile Avatar toggles glassmorphic dropdown and navigates to settings', async ({ page }) => {
    // 1. Individual header buttons are gone
    await expect(page.locator('#siri-btn')).not.toBeVisible();
    await expect(page.locator('#logout-btn')).not.toBeVisible();

    // 2. Profile initials button is visible
    const profileBtn = page.locator('#profile-btn');
    await expect(profileBtn).toBeVisible();
    await expect(profileBtn).toContainText('TE'); // 'test-user' initials 'TE'

    // 3. Click Profile button to open dropdown
    await profileBtn.click();
    const dropdown = page.locator('#profile-dropdown');
    await expect(dropdown).toBeVisible();

    // 4. Verify 4 menu options exist
    await expect(dropdown.locator('a', { hasText: 'Account Overview' })).toBeVisible();
    await expect(dropdown.locator('button', { hasText: 'Siri Setup' })).toBeVisible();
    await expect(dropdown.locator('select[aria-label="Currency"]')).toBeVisible();
    await expect(dropdown.locator('button', { hasText: 'Sign Out' })).toBeVisible();

    // 5. Click Account Overview and verify redirect to /settings
    await dropdown.locator('a', { hasText: 'Account Overview' }).click();
    await expect(page).toHaveURL(/\/settings/);

    // 6. Assert visual glassmorphic layout is present on settings page
    const formContainer = page.locator('.bg-white\\/40').first();
    await expect(formContainer).toBeVisible();
    await expect(formContainer).toHaveClass(/backdrop-blur-md/);
  });

  test('should successfully submit profile updates, trigger auth email changes, and update local Zunstand state', async ({ page }) => {
    // Navigate to Settings
    await page.click('#profile-btn');
    await page.locator('#profile-dropdown a', { hasText: 'Account Overview' }).click();
    await expect(page).toHaveURL(/\/settings/);

    // 1. Verify initial values are loaded (email matches, display_name defaults to email prefix)
    const nameInput = page.locator('input[placeholder="Name"]');
    await expect(nameInput).toHaveValue('test-user');
    
    const emailInput = page.locator('input[placeholder="Email"]');
    await expect(emailInput).toHaveValue(TEST_EMAIL);

    // 2. Modify values: Change name, change email, change AI tone
    await nameInput.fill('Katherine Zen');
    await emailInput.fill('katherine-new@example.com');
    await page.locator('select[aria-label="AI Coach Tone"]').selectOption('strict');
    
    // Click Save Overview
    await page.click('button:has-text("Save Overview")');

    // 3. Verify pending verification message is displayed (empathetic banner!)
    const alertBox = page.locator('.bg-zen-sage\\/20');
    await expect(alertBox).toBeVisible();
    await expect(alertBox).toContainText('verification link has been sent');

    // 4. Go back to dashboard and verify top Avatar initials updated instantly in Zustand!
    await page.click('a:has-text("Back to Dashboard")');
    await expect(page).toHaveURL(/\/dashboard/);
    
    // Initials should now be 'KA' (Katherine Zen)
    await expect(page.locator('#profile-btn')).toContainText('KA');
  });

  test('should validate security password reset forms gracefully', async ({ page }) => {
    // Navigate to Settings
    await page.click('#profile-btn');
    await page.locator('#profile-dropdown a', { hasText: 'Account Overview' }).click();
    await expect(page).toHaveURL(/\/settings/);

    const passInput = page.locator('input[placeholder="At least 6 characters"]');
    const confirmInput = page.locator('input[placeholder="Repeat new password"]');
    const submitBtn = page.locator('button:has-text("Update Password")');

    // 1. Test mismatch passwords validation
    await passInput.fill('pass123');
    await confirmInput.fill('pass456');
    await submitBtn.click();

    let errorAlert = page.locator('.bg-zen-peach\\/20');
    await expect(errorAlert).toBeVisible();
    await expect(errorAlert).toContainText('Passwords do not match');

    // 2. Test too short validation
    await passInput.fill('123');
    await confirmInput.fill('123');
    await submitBtn.click();
    await expect(errorAlert).toContainText('must be at least 6 characters');
  });
});
