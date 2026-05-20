/**
 * Playwright config — denial-tool e2e.
 *
 * Runs against the local dev server (port 5175 from vite.config.ts). MSW
 * starts via bootstrap.ts so the network layer is mocked end-to-end.
 *
 * No CI integration yet; locally:
 *   pnpm --filter @tensaw/app-denial-tool dev           # in one terminal
 *   pnpm --filter @tensaw/app-denial-tool e2e           # in another
 */

import { defineConfig, devices } from '@playwright/test';

const PORT = 5175;

export default defineConfig({
  testDir: './playwright',
  fullyParallel: false, // MSW state is shared across the dev server
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
    },
  ],
  webServer: {
    command: 'pnpm dev',
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
