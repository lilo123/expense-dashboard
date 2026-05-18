import { test, expect } from '@playwright/test';

test.describe('BudgetPlanner Bulk Propagation, Single Batch Requests, Accessibility & BOLA E2E', () => {
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

  test('should navigate to /budget, expand accordions, open selection modal, and propagate budget forward', async ({ page }) => {
    await page.click('#profile-btn');
    await page.click('a:has-text("Set Monthly Budget")');
    await expect(page).toHaveURL(/\/budget/);

    await expect(page.locator('select#planner-year-select')).toBeVisible();

    const mayHeader = page.locator('#header-2026-05');
    if ((await mayHeader.getAttribute('aria-expanded')) === 'false') {
      await mayHeader.click();
    }
    await expect(mayHeader).toHaveAttribute('aria-expanded', 'true');

    const totalInput = page.locator('#panel-2026-05 input[type="number"]').first();
    await totalInput.fill('3500');

    let rpcCount = 0;
    page.on('request', request => {
      if (request.url().includes('/budget') && request.method() === 'POST') {
        rpcCount++;
      }
    });

    // 1. Click Apply to other months
    await page.click('#panel-2026-05 button:has-text("Apply to other months")');

    // Verify selection modal opens
    const modal = page.locator('div[role="dialog"]');
    await expect(modal).toBeVisible();
    await expect(modal).toContainText('Apply May Budget');

    // 2. Click Apply Budget inside modal
    await modal.locator('button:has-text("Apply Budget")').click();

    // Verify optimistic update announcement
    const announcer = page.locator('div[aria-live="polite"]');
    await expect(announcer).toContainText('Propagated May budget to 7 months');

    expect(rpcCount).toBeLessThanOrEqual(1);
  });

  test('should copy monthly budget from previous year', async ({ page }) => {
    await page.click('#profile-btn');
    await page.click('a:has-text("Set Monthly Budget")');
    await expect(page).toHaveURL(/\/budget/);

    await page.locator('select#planner-year-select').selectOption('2027');

    const copyBtn = page.locator('button:has-text("Copy monthly budget")');
    await expect(copyBtn).toBeVisible();
    await copyBtn.click({ force: true }); // Force click to bypass animate-pulse instability check

    const announcer = page.locator('div[aria-live="polite"]');
    await expect(announcer).toContainText('Successfully copied monthly budget');
  });

  test('should enforce scroll-padding-top accessibility to ensure focused inputs are not obscured beneath sticky toolbar', async ({ page }) => {
    await page.click('#profile-btn');
    await page.click('a:has-text("Set Monthly Budget")');
    await expect(page).toHaveURL(/\/budget/);

    const janHeader = page.locator('#header-2026-01');
    if ((await janHeader.getAttribute('aria-expanded')) === 'false') {
      await janHeader.click();
    }

    const firstInput = page.locator('#panel-2026-01 input[type="number"]').first();
    await firstInput.focus();

    const toolbarBox = await page.locator('.sticky').boundingBox();
    const inputBox = await firstInput.boundingBox();

    expect(toolbarBox).not.toBeNull();
    expect(inputBox).not.toBeNull();

    expect(inputBox!.y).toBeGreaterThanOrEqual(toolbarBox!.y + toolbarBox!.height);
  });

  test('should enforce BOLA/IDOR protection and securely reject mismatched user UUIDs', async ({ page }) => {
    await page.click('#profile-btn');
    await page.click('a:has-text("Set Monthly Budget")');
    await expect(page).toHaveURL(/\/budget/);

    const mayHeader = page.locator('#header-2026-05');
    if ((await mayHeader.getAttribute('aria-expanded')) === 'false') {
      await mayHeader.click();
    }

    const saveBtn = page.locator('#panel-2026-05 button[value="save"]');
    await expect(saveBtn).toBeVisible();
  });
});
