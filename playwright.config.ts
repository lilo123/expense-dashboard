import { defineConfig, devices } from '@playwright/test';

const isCI = !!process.env.CI;

/**
 * See https://playwright.dev/docs/test-configuration.
 */
const chromiumLaunchOptions = {
  args: [
    '--disable-dev-shm-usage',
    '--no-sandbox',
    '--disable-gpu',
    '--disable-web-security',
    '--disable-features=IsolateOrigins,site-per-process',
    '--js-flags=--max-old-space-size=256',
    '--no-zygote',
    '--disable-extensions',
    '--disable-background-networking',
    '--disable-default-apps',
    '--disable-sync',
    '--mute-audio',
    '--disable-logging',
    '--disable-ipc-flooding-protection',
    '--disk-cache-size=1',
    '--media-cache-size=1',
    '--disable-infobars',
    '--disable-breakpad',
    '--disable-canvas-aa',
    '--disable-2d-canvas-clip-faa',
    '--disable-gl-drawing-for-tests',
    '--disable-font-subpixel-rendering',
    '--js-flags=--max-old-space-size=256',
    '--no-zygote',
    '--disable-site-isolation-trials',
    '--disable-extensions'
  ]
};

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  /* Run tests in files in parallel */
  fullyParallel: false,
  /* Maximum time each expect() assertion should wait */
  expect: {
    timeout: 15000,
  },
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: isCI,
  /* Retry on CI only */
  retries: 2,
  /* Opt out of parallel tests on CI. */
  workers: isCI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  /* Shared settings for all the projects below. */
  use: {
    baseURL: 'http://127.0.0.1:3000',
    trace: 'off',
    contextOptions: {
      recordVideo: undefined,
      recordHar: undefined,
      viewport: { width: 1280, height: 720 },
      ignoreHTTPSErrors: true,
    },
  },

  /* Configure projects dynamically based on CI boundary */
  projects: isCI
    ? [
        { name: 'chromium', use: { ...devices['Desktop Chrome'], launchOptions: chromiumLaunchOptions } },
        { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
        { name: 'webkit', use: { ...devices['Desktop Safari'] } },
        { name: 'mobile-chrome', use: { ...devices['Pixel 5'], launchOptions: chromiumLaunchOptions } },
        { name: 'mobile-safari', use: { ...devices['iPhone 12'] } },
      ]
    : [
        { name: 'chromium', use: { ...devices['Desktop Chrome'], launchOptions: chromiumLaunchOptions } },
      ],
});
