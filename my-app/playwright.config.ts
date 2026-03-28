import { defineConfig, devices } from '@playwright/test'

const STAGING_URL = process.env.STAGING_URL ?? 'https://staging.d1i0disr0t50m8.amplifyapp.com'

export default defineConfig({
  testDir: './src/e2e',
  fullyParallel: false,   // auth tests share state; keep sequential for now
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  timeout: 30_000,
  reporter: [['html', { open: 'never' }], ['list']],

  use: {
    baseURL: STAGING_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
  },

  projects: [
    // Shared auth setup — runs once, saves signed-in state to file
    {
      name: 'setup',
      testMatch: '**/auth.setup.ts',
    },
    // All other tests reuse the signed-in state
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'src/e2e/.auth/user.json',
      },
      dependencies: ['setup'],
      testIgnore: ['**/auth.setup.ts', '**/auth.spec.ts'],
    },
    // Auth tests run without stored state (they test sign-in/up themselves)
    {
      name: 'auth',
      use: { ...devices['Desktop Chrome'] },
      testMatch: '**/auth.spec.ts',
    },
  ],
})
