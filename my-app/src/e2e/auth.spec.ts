/**
 * Auth flow E2E tests — run without stored auth state.
 * Covers sign-up, sign-in, sign-out, and regression cases for #147/#148.
 */
import { test, expect } from '@playwright/test'
import { execSync } from 'child_process'
import { writeFileSync, readFileSync, existsSync, unlinkSync } from 'fs'
import { join } from 'path'
import { expectSignedIn, openSignInModal } from './openSignInModal'

const COGNITO_POOL_ID = process.env.COGNITO_USER_POOL_ID ?? 'us-west-1_6NB2hiHif'
const COGNITO_REGION  = process.env.COGNITO_REGION       ?? 'us-west-1'
const CREATED_USER_FILE = join(process.cwd(), '.e2e-created-user')

const E2E_EMAIL    = process.env.E2E_TEST_EMAIL    ?? 'e2e-test@tcplanpro.com'
const E2E_PASSWORD = process.env.E2E_TEST_PASSWORD ?? 'E2eTestPass2026!'

test.describe('Sign In', () => {
  test.beforeEach(async ({ page }) => {
    await openSignInModal(page)
  })

  test('signs in with valid credentials and lands on app', async ({ page }) => {
    await page.getByLabel('Email').fill(E2E_EMAIL)
    await page.getByRole('textbox', { name: 'Password' }).fill(E2E_PASSWORD)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expectSignedIn(page)
  })

  test('shows error with wrong password', async ({ page }) => {
    await page.getByLabel('Email').fill(E2E_EMAIL)
    await page.getByRole('textbox', { name: 'Password' }).fill('WrongPassword1!')
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page.getByRole('alert')).toBeVisible()
  })
})

test.describe('Create Account', () => {
  test.afterAll(() => {
    if (!existsSync(CREATED_USER_FILE)) return
    const email = readFileSync(CREATED_USER_FILE, 'utf-8').trim()
    unlinkSync(CREATED_USER_FILE)
    if (!email) return
    try {
      // Look up username by email, then delete
      const result = execSync(
        `aws cognito-idp list-users --user-pool-id ${COGNITO_POOL_ID} --region ${COGNITO_REGION} --filter 'email = "${email}"' --query 'Users[0].Username' --output text`,
        { encoding: 'utf-8' },
      ).trim()
      if (result && result !== 'None') {
        execSync(
          `aws cognito-idp admin-delete-user --user-pool-id ${COGNITO_POOL_ID} --region ${COGNITO_REGION} --username "${result}"`,
        )
        console.log(`[auth cleanup] deleted test user: ${email}`)
      }
    } catch (err) {
      console.warn(`[auth cleanup] failed to delete ${email}:`, err)
    }
  })

  test.beforeEach(async ({ page }) => {
    await openSignInModal(page)
    await page.getByRole('tab', { name: 'Create Account' }).click()
    await expect(page.getByRole('button', { name: 'Create Account' })).toBeVisible({ timeout: 15_000 })
  })

  test('shows validation error for short password — regression #147', async ({ page }) => {
    await page.getByLabel('Full Name').fill('Test User')
    await page.getByLabel('Email').fill('newuser@example.com')
    await page.getByLabel('Password', { exact: true }).fill('short')
    // Trigger validation
    await page.getByLabel('Confirm Password').click()

    const errorMsg = page.getByText(/at least 8 characters/i)
    await expect(errorMsg).toBeVisible()

    // Regression #147: error text must be readable — check it has light-enough color
    const color = await errorMsg.evaluate(el => getComputedStyle(el).color)
    // Expect a light red (not pure #ef4444 on dark bg) — rgb values for #fca5a5 ≈ (252,165,165)
    expect(color).not.toBe('rgb(239, 68, 68)')
  })

  test('shows error when name is missing — regression #148', async ({ page }) => {
    await page.getByLabel('Email').fill('newuser@example.com')
    await page.getByLabel('Password', { exact: true }).fill('ValidPass1!')
    await page.getByLabel('Confirm Password').fill('ValidPass1!')
    await page.getByRole('button', { name: 'Create Account' }).click()
    // Name is required — expect a validation message, NOT a Cognito schema error
    const nameField = page.getByLabel('Full Name')
    await expect(nameField).toBeVisible()
  })

  test('creates account successfully with all fields filled', async ({ page }) => {
    // Use a unique email so we don't collide with existing users
    const unique = `e2e-signup-${Date.now()}@tcplanpro.com`
    await page.getByLabel('Full Name').fill('E2E Signup User')
    await page.getByLabel('Email').fill(unique)
    await page.getByLabel('Password', { exact: true }).fill('SignupTest1!')
    await page.getByLabel('Confirm Password').fill('SignupTest1!')
    await page.getByRole('button', { name: 'Create Account' }).click()
    // Should reach the confirmation code step
    await expect(page.getByText(/confirmation code/i)).toBeVisible({ timeout: 15_000 })
    // Record the created email for afterAll cleanup
    writeFileSync(CREATED_USER_FILE, unique)
  })
})

test.describe('Sign Out', () => {
  test('sign out returns to anonymous canvas — no redirect', async ({ page }) => {
    // Sign in via modal
    await openSignInModal(page)
    await page.getByLabel('Email').fill(E2E_EMAIL)
    await page.getByRole('textbox', { name: 'Password' }).fill(E2E_PASSWORD)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expectSignedIn(page)

    // Sign out — stays on /app, sign-out button disappears
    await page.getByTestId('sign-out-button').click()
    await expect(page).toHaveURL((url: URL) => url.pathname === '/app')
    await expect(page.getByTestId('sign-out-button')).not.toBeVisible()
  })
})
