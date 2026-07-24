import { defineConfig, devices } from '@playwright/test';

/**
 * Buyer-portal e2e. Assumes the API (:3001) + web (:3000) are running against a
 * seeded Star Cement tenant (Slice 0 demo prerequisites).
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: 0,
  use: {
    baseURL: process.env.WEB_BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
