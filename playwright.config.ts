import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  globalSetup: './global-setup',
  /* Run tests in files in parallel */
  fullyParallel: false,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    ['html', {
      outputFolder: 'playwright_Results'}],
    ['./customreporter.ts'],
    //['./CustomJsonReporter.ts'],
  ],
  use: {
    baseURL: 'https://www.saucedemo.com/',
    trace: 'on-first-retry',
    headless: false,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    storageState: 'playwright/.auth/user.json'
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    }
  ]
});
