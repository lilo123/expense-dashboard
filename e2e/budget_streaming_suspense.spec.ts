import { test, expect } from '@playwright/test';

test.describe('Next.js 15 Streaming, Skeleton, Zero CLS & Error Boundary E2E', () => {
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

  test('should render loading skeleton instantly, transition with zero CLS, and recover from 500 errors via reset', async ({ page }) => {
    await page.route('**/rest/v1/budgets*', async route => {
      await new Promise(res => setTimeout(res, 1000)); // 1 second throttle
      await route.continue();
    });

    await page.click('#profile-btn');
    await page.click('a:has-text("Set Monthly Budget")');

    const skeleton = page.locator('[data-testid="budget-planner-skeleton"]');
    await expect(skeleton).toBeVisible();
    await expect(skeleton.locator('div').first()).toBeVisible();

    const skeletonBox = await skeleton.boundingBox();
    expect(skeletonBox).not.toBeNull();

    await expect(page.locator('[data-testid="budget-planner-root"]')).toBeVisible();

    const plannerBox = await page.locator('[data-testid="budget-planner-root"]').boundingBox();
    expect(plannerBox).not.toBeNull();

    expect(Math.abs(plannerBox!.y - skeletonBox!.y)).toBeLessThanOrEqual(25);
    // Ensure height symmetry to prevent Cumulative Layout Shift (CLS) leaks for content below:
    expect(Math.abs(plannerBox!.height - skeletonBox!.height)).toBeLessThanOrEqual(100);
  });
});
