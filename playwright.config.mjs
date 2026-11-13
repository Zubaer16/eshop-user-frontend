import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 45000,
  expect: { timeout: 12000 },
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['json', { outputFile: 'test-results/storefront/results.json' }],
  ],
  outputDir: 'test-results/storefront/artifacts',
  use: {
    baseURL: 'http://127.0.0.1:3211',
    viewport: { width: 1440, height: 1000 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command:
      'node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3211',
    url: 'http://127.0.0.1:3211',
    reuseExistingServer: false,
    timeout: 45000,
  },
})
