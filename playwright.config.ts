import { defineConfig } from '@playwright/test';
export default defineConfig({
  globalTeardown: './scripts/e2e-teardown.ts',
  testDir: './tests/e2e', workers: 1, timeout: 120_000,
  reporter: 'list', use: { baseURL: 'http://127.0.0.1:4320', channel: 'msedge', actionTimeout: 10_000, trace: 'off', screenshot: 'only-on-failure' },
  webServer: { command: 'node scripts/e2e-server.ts', url: 'http://127.0.0.1:4320/api/status', reuseExistingServer: false, timeout: 90_000 },
});
