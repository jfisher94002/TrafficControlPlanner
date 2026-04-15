/**
 * Auth setup — runs once before the main test suite.
 * Signs in with the E2E test account and saves browser state so all
 * other tests start already authenticated.
 */
import { test as setup } from '@playwright/test'
import path from 'path'
import { fileURLToPath } from 'url'
import { expectSignedIn, openSignInModal } from './openSignInModal'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const AUTH_FILE = path.join(__dirname, '.auth/user.json')

setup('sign in as E2E test user', async ({ page }) => {
  const email    = process.env.E2E_TEST_EMAIL    ?? 'e2e-test@tcplanpro.com'
  const password = process.env.E2E_TEST_PASSWORD ?? 'E2eTestPass2026!'

  await openSignInModal(page)

  await page.getByLabel('Email').fill(email)
  await page.getByRole('textbox', { name: 'Password' }).fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()

  await expectSignedIn(page)

  await page.context().storageState({ path: AUTH_FILE })
})
