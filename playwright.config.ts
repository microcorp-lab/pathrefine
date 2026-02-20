import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E configuration for PathRefine core app.
 *
 * The dev server (Vite on port 3000) is started automatically before the suite
 * and torn down afterwards. `reuseExistingServer` lets developers keep their
 * own `npm run dev` running while iterating locally.
 *
 * Run:  npx playwright test
 * Debug: npx playwright test --debug
 * UI:   npx playwright test --ui
 */
export default defineConfig({
  testDir: './src/test/e2e',

  /* Run tests sequentially — each spec opens a fresh browser context anyway */
  fullyParallel: false,
  workers: 1,

  /* Fail the build on `test.only` in CI */
  forbidOnly: !!process.env.CI,

  /* 1 retry on CI, 0 locally */
  retries: process.env.CI ? 1 : 0,

  /* Per-test timeout: 30 s */
  timeout: 30_000,
  expect: { timeout: 10_000 },

  reporter: [
    ['list'],
    ['html', { outputFolder: '../../playwright-report', open: 'never' }],
  ],

  use: {
    baseURL: 'http://localhost:3010',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    /* Desktop viewport — ensures "hidden sm:inline" text is visible */
    viewport: { width: 1280, height: 800 },
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    /**
     * Spin up the core/ Vite dev server on a dedicated port (3010) so it
     * never clashes with the root workspace app that may be running on 3000.
     * The core/ app serves EditorView at its root path (/), so tests use
     * localhost:3010/ directly.
     */
    command: 'npx vite --port 3010',
    url: 'http://localhost:3010',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
