import { defineConfig, devices } from '@playwright/test'

const baseURL = process.env.E2E_BASE_URL || 'http://127.0.0.1:3100'
const visualWidth = Math.max(900, Math.min(1300, Number(process.env.E2E_VIEWPORT_WIDTH) || 1120))
const visualHeight = Math.max(450, Math.min(800, Number(process.env.E2E_VIEWPORT_HEIGHT) || 600))

/** Keep independent user journeys isolated and observable. */
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.mjs',
  timeout: 120_000,
  expect: { timeout: 12_000 },
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [
    ['list', { printSteps: true }],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['json', { outputFile: 'test-results/results.json' }],
  ],
  outputDir: 'test-results/artifacts',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Moderately sized visible browser for laptop demonstration.
        // Desktop >= 1024px remains active, while 1440px checks run headlessly.
        viewport: { width: visualWidth, height: visualHeight },
        launchOptions: {
          args: ['--window-position=0,0', `--window-size=${visualWidth + 40},${visualHeight + 110}`],
        },
      },
    },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'npm run dev -- --hostname 127.0.0.1 --port 3100',
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        env: { NEXT_TELEMETRY_DISABLED: '1', NEXT_PUBLIC_ESHOP_MODE: 'preview' },
      },
})
