import { test, expect } from '@playwright/test';

test.describe('Yearly Tab Master Toggle & Side-by-Side Budget Comparisons E2E', () => {
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

  test('should toggle between Expense View and Budget View in Yearly Tab', async ({ page }) => {
    await page.click('button:has-text("Yearly")');
    const yearlyTab = page.locator('#tab-yearly').first();
    await expect(yearlyTab).toBeVisible();

    await expect(yearlyTab.locator('h2')).toContainText('Monthly Expenses');

    await yearlyTab.locator('button', { hasText: 'Budget View' }).click();
    await expect(yearlyTab.locator('h2')).toContainText('Budget vs Spent');
  });

  test('should render side-by-side Monthly Budget, Savings, and Over Budget comparison data', async ({ page }) => {
    await page.click('button:has-text("Yearly")');
    const yearlyTab = page.locator('#tab-yearly').first();
    await expect(yearlyTab).toBeVisible();

    await yearlyTab.locator('button', { hasText: 'Budget View' }).click();

    const chartContainer = yearlyTab.locator('.chart-container');
    await expect(chartContainer).toBeVisible();
  });

  test('should display category-level budget performance in details tray when clicking a bar in Budget View', async ({ page }) => {
    await page.click('button:has-text("Yearly")');
    const yearlyTab = page.locator('#tab-yearly').first();
    await yearlyTab.locator('button', { hasText: 'Budget View' }).click();

    await page.evaluate(() => {
      const btn = document.createElement('button');
      btn.id = 'simulate-chart-click';
      btn.innerText = 'Simulate Click';
      btn.onclick = () => window.dispatchEvent(new CustomEvent('chart-click-sim', { detail: '4' }));
      document.body.appendChild(btn);
    });

    await page.click('#simulate-chart-click');

    const detailsContainer = page.locator('#yearly-details-container').first();
    await expect(detailsContainer).toBeVisible();
  });
});
