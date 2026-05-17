import { defineConfig, devices } from '@playwright/test';

const isCI = !!process.env.CI;

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './e2e',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Maximum time each expect() assertion should wait */
  expect: {
    timeout: 15000,
  },
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: isCI,
  /* Retry on CI only */
  retries: isCI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: isCI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  /* Shared settings for all the projects below. */
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },

  /* Configure projects dynamically based on CI boundary */
  projects: isCI
    ? [
        { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
        { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
        { name: 'webkit', use: { ...devices['Desktop Safari'] } },
        { name: 'mobile-chrome', use: { ...devices['Pixel 5'] } },
        { name: 'mobile-safari', use: { ...devices['iPhone 12'] } },
      ]
    : [
        { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
      ],

  /* Run your local dev server before starting the tests */
  webServer: {
    command: 'npm run build && npm run start',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 240000, // 4 minutes to allow for compilation and boot
  },
});
