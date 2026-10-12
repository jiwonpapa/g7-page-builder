import { defineConfig } from '@playwright/test';

if (!process.env.G7PB_PROBE_URL?.startsWith('http://127.0.0.1:')) throw new Error('Isolated loopback fixture URL required');
export default defineConfig({
  testDir: '.', testMatch: 'probe.spec.ts', forbidOnly: true, workers: 1, retries: 0,
  timeout: 45_000, expect: { timeout: 8000 },
  reporter: [['list'], ['json', { outputFile: process.env.G7PB_PROBE_REPORT }]],
  outputDir: process.env.G7PB_PROBE_OUTPUT,
  use: { baseURL: process.env.G7PB_PROBE_URL, viewport: { width: 1600, height: 1000 },
    browserName: 'chromium', channel: 'chrome', screenshot: 'only-on-failure', trace: 'retain-on-failure' },
});
