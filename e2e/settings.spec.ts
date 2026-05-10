import { test, expect } from '@playwright/test';

test.describe('Phase 1.7: Settings UX & Security Refinements E2E', () => {
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

  test('should verify Profile Avatar toggles dropdown with high-contrast Sign Out and routes to settings', async ({ page }) => {
    const profileBtn = page.locator('#profile-btn');
    await expect(profileBtn).toBeVisible();

    // 1. Open Dropdown
    await profileBtn.click();
    const dropdown = page.locator('#profile-dropdown');
    await expect(dropdown).toBeVisible();

    // 2. Verify the new brand-compliant legible Sign Out option is present
    const signOutBtn = dropdown.locator('button', { hasText: 'Sign Out' });
    await expect(signOutBtn).toBeVisible();
    await expect(signOutBtn).toHaveClass(/text-zen-charcoal/); // Deep Charcoal text
    await expect(signOutBtn).toHaveClass(/hover:bg-zen-peach\/30/); // Soft Pale Peach hover

    // 3. Navigate to Settings
    await dropdown.locator('a', { hasText: 'Account Overview' }).click();
    await expect(page).toHaveURL(/\/settings/);
  });

  test('should enforce read-only locks on General Details and support Pencil edit toggling', async ({ page }) => {
    // Navigate to Settings
    await page.click('#profile-btn');
    await page.locator('#profile-dropdown a', { hasText: 'Account Overview' }).click();
    await expect(page).toHaveURL(/\/settings/);

    const nameInput = page.locator('input[placeholder="Name"]');
    const initialName = await nameInput.inputValue();
    
    // 1. Verified inputs are locked read-only by default!
    await expect(nameInput).toBeDisabled();
    await expect(page.locator('button:has-text("Save Details")')).not.toBeVisible();

    // 2. Click Edit Pencil button to unlock
    await page.click('#edit-profile-btn');
    await expect(nameInput).toBeEnabled();
    
    const saveBtn = page.locator('button:has-text("Save Details")');
    await expect(saveBtn).toBeVisible();

    // 3. Edit display name and click Cancel (should revert values and lock back!)
    await nameInput.fill('Accidental Edit');
    await page.click('button:has-text("Cancel")');
    
    await expect(nameInput).toBeDisabled();
    await expect(nameInput).toHaveValue(initialName);
    await expect(saveBtn).not.toBeVisible();

    // 4. Unlock, edit display name, and save successfully
    await page.click('#edit-profile-btn');
    await nameInput.fill('Katherine Zen');
    await saveBtn.click();

    // Verify metadata update toast
    const successAlert = page.locator('.bg-zen-sage\\/20');
    await expect(successAlert).toBeVisible();
    await expect(successAlert).toContainText('saved successfully');

    // Form locks back after saving!
    await expect(nameInput).toBeDisabled();
  });

  test('should successfully isolate Email Updates and handle Supabase double-confirmation loops', async ({ page }) => {
    // Navigate to Settings
    await page.click('#profile-btn');
    await page.locator('#profile-dropdown a', { hasText: 'Account Overview' }).click();
    await expect(page).toHaveURL(/\/settings/);

    const emailInput = page.locator('input[placeholder="Email"]');

    // 1. Email input is locked read-only by default!
    await expect(emailInput).toBeDisabled();
    await expect(page.locator('button:has-text("Update Email")')).not.toBeVisible();

    // 2. Click Edit Email Pencil to unlock
    await page.click('#edit-email-btn');
    await expect(emailInput).toBeEnabled();
    
    const updateEmailBtn = page.locator('button:has-text("Update Email")');
    await expect(updateEmailBtn).toBeVisible();

    // 3. Save new email, check double verification links info alert
    await emailInput.fill('katherine-new@example.com');
    await updateEmailBtn.click();

    const emailAlert = page.locator('.bg-zen-sage\\/20');
    await expect(emailAlert).toBeVisible();
    // Verifies RLS confirmation dispatches notices
    await expect(emailAlert).toContainText('links have been sent to both');
    
    await expect(emailInput).toBeDisabled();
  });

  test('should collapse password resets and enforce current password re-authentication checks', async ({ page }) => {
    // Navigate to Settings
    await page.click('#profile-btn');
    await page.locator('#profile-dropdown a', { hasText: 'Account Overview' }).click();
    await expect(page).toHaveURL(/\/settings/);

    // 1. Form is collapsed by default
    const currentPassInput = page.locator('input[placeholder="Verify current password"]');
    await expect(currentPassInput).not.toBeVisible();

    // 2. Click Change Password trigger button to unfold
    await page.click('#change-password-btn');
    await expect(currentPassInput).toBeVisible();

    const newPassInput = page.locator('input[placeholder="At least 6 characters"]');
    const confirmPassInput = page.locator('input[placeholder="Repeat new password"]');
    const submitBtn = page.locator('button:has-text("Save Password")');

    // 3. Enter mismatch passwords and verify validation
    await currentPassInput.fill('password123');
    await newPassInput.fill('newSecurePass123');
    await confirmPassInput.fill('wrongMatch456');
    await submitBtn.click();

    let errorAlert = page.locator('.bg-zen-peach\\/20');
    await expect(errorAlert).toBeVisible();
    await expect(errorAlert).toContainText('do not match');

    // 4. Enter incorrect current password and verify secure re-authentication checks reject the reset!
    await currentPassInput.fill('incorrectPass123');
    await newPassInput.fill('newSecurePass123');
    await confirmPassInput.fill('newSecurePass123');
    await submitBtn.click();

    await expect(errorAlert).toContainText('Current password is incorrect');
  });
});
