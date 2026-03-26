/**
 * Auth setup — runs once before the main test suite.
 * Signs in with the E2E test account and saves browser state so all
 * other tests start already authenticated.
 */
import { test as setup, expect } from '@playwright/test'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const AUTH_FILE = path.join(__dirname, '.auth/user.json')

setup('sign in as E2E test user', async ({ page }) => {
  const email    = process.env.E2E_TEST_EMAIL    ?? 'e2e-test@tcplanpro.com'
  const password = process.env.E2E_TEST_PASSWORD ?? 'E2eTestPass2026!'

  await page.goto('/app')

  // Wait for the Amplify Authenticator to mount
  await expect(page.getByRole('tab', { name: 'Sign In' })).toBeVisible({ timeout: 15_000 })

  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()

  // Wait until the app canvas is visible — confirms successful sign-in
  await expect(page.getByTestId('canvas-stage')).toBeVisible({ timeout: 20_000 })

  await page.context().storageState({ path: AUTH_FILE })
})
