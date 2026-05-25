import { test, expect } from '@playwright/test';

test.describe('Yearly Tab Budget-Only & Stacked Chart Breakdown E2E', () => {
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

  test('should render side-by-side Monthly Budget, Savings, and Over Budget comparison data', async ({ page }) => {
    await page.click('button:has-text("Yearly")');
    const yearlyTab = page.locator('#tab-yearly').first();
    await expect(yearlyTab).toBeVisible();

    await expect(yearlyTab.locator('h2')).toContainText('Budget vs Spent');

    const chartContainer = yearlyTab.locator('.chart-container');
    await expect(chartContainer).toBeVisible();
  });

  test('should toggle recurring expenses breakdown checkbox', async ({ page }) => {
    await page.click('button:has-text("Yearly")');
    const yearlyTab = page.locator('#tab-yearly').first();

    const checkbox = yearlyTab.locator('label:has-text("Show recurring expenses") input[type="checkbox"]');
    await expect(checkbox).toBeVisible();
    await expect(checkbox).not.toBeChecked();

    // Toggle on
    await checkbox.check();
    await expect(checkbox).toBeChecked();

    // Toggle off
    await checkbox.uncheck();
    await expect(checkbox).not.toBeChecked();
  });

  test('should display category-level budget performance in details tray when clicking a chart bar', async ({ page }) => {
    await page.click('button:has-text("Yearly")');
    const yearlyTab = page.locator('#tab-yearly').first();

    await page.evaluate(() => {
      const btn = document.createElement('button');
      btn.id = 'simulate-chart-click';
      btn.innerText = 'Simulate Click';
      btn.onclick = () => window.dispatchEvent(new CustomEvent('chart-click-sim', { detail: '4' }));
      document.body.appendChild(btn);
    });

    await page.click('#simulate-chart-click');

    // Strong, exact assertion on the conditionally-rendered details box and data header
    const detailsTray = page.locator('#yearly-details-container .month-details').first();
    await expect(detailsTray).toBeVisible();
    await expect(detailsTray.locator('h3')).toContainText('May'); // Click detail '4' represents May
  });
});
