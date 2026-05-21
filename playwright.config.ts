import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E konfiguratsiyasi.
 *
 * Ishga tushirish:
 *   npm run test:e2e               — barcha testlar
 *   npm run test:e2e -- --ui       — UI rejimida
 *   PLAYWRIGHT_BASE_URL=http://localhost:3001 npm run test:e2e
 */
export default defineConfig({
    testDir: './e2e',
    timeout: 30_000,
    expect: { timeout: 5_000 },
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: process.env.CI ? [['github'], ['html']] : 'html',
    use: {
        baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',
    },
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],
    webServer: process.env.PLAYWRIGHT_NO_SERVER
        ? undefined
        : {
              command: 'npm run dev',
              port: 3000,
              reuseExistingServer: !process.env.CI,
              timeout: 120_000,
          },
});
