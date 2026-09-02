import { defineConfig, devices } from '@playwright/test';

const PC_ONLY_EDITOR_TESTS = /(?:editorInteractionQuality|editorPerformance|editorStructureTheme|editorDocumentBoundary|editorCatalogCode|pageBuilderLifecycle|sitePartLifecycle|globalSiteShellRoutes)\.spec\.ts/;

export default defineConfig({
  testDir: './tests/E2E',
  forbidOnly: true,
  outputDir: './output/playwright/results',
  workers: 1,
  retries: 1,
  timeout: 240_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { outputFolder: './output/playwright/report', open: 'never' }]],
  use: {
    actionTimeout: 10_000,
    baseURL: process.env.G7PB_BASE_URL ?? 'https://g7pb.test',
    ignoreHTTPSErrors: true,
    navigationTimeout: 20_000,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } } },
    {
      name: 'tablet',
      testIgnore: PC_ONLY_EDITOR_TESTS,
      use: { ...devices['iPad (gen 7)'], browserName: 'chromium' },
    },
    {
      name: 'mobile',
      testIgnore: PC_ONLY_EDITOR_TESTS,
      use: { ...devices['iPhone 13'], browserName: 'chromium' },
    },
  ],
});
