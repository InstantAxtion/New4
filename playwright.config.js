// Browser tests: `npm test`. They start a static server for web/ and play the real game in Chromium.
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests',
  timeout: 120_000,
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'list' : 'line',
  use: { baseURL: 'http://localhost:4173', ...devices['Pixel 7'], trace: 'off' },
  webServer: { command: 'npx --yes http-server web -p 4173 -s -c-1', url: 'http://localhost:4173/index.html', reuseExistingServer: true, timeout: 60_000 },
});
