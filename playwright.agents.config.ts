import { defineConfig } from '@playwright/test';

// The agents test creates and closes its own database and HTTP server on a free port.
export default defineConfig({
  testDir: './tests/e2e', testMatch: 'agents.spec.ts', workers: 1, timeout: 180_000,
  reporter: 'list', outputDir: '.local/agents-playwright-results',
  use: { channel: 'msedge', actionTimeout: 10_000, trace: 'off', screenshot: 'only-on-failure' }
});
