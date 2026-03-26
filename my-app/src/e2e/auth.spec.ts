/**
 * Auth flow E2E tests — run without stored auth state.
 * Covers sign-up, sign-in, sign-out, and regression cases for #147/#148.
 */
import { test, expect } from '@playwright/test'

const E2E_EMAIL    = process.env.E2E_TEST_EMAIL    ?? 'e2e-test@tcplanpro.com'
const E2E_PASSWORD = process.env.E2E_TEST_PASSWORD ?? 'E2eTestPass2026!'

test.describe('Sign In', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/app')
    await expect(page.getByRole('tab', { name: 'Sign In' })).toBeVisible({ timeout: 15_000 })
  })

  test('signs in with valid credentials and lands on app', async ({ page }) => {
    await page.getByLabel('Email').fill(E2E_EMAIL)
    await page.getByRole('textbox', { name: 'Password' }).fill(E2E_PASSWORD)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page.getByTestId('canvas-stage')).toBeVisible({ timeout: 20_000 })
  })

  test('shows error with wrong password', async ({ page }) => {
    await page.getByLabel('Email').fill(E2E_EMAIL)
    await page.getByRole('textbox', { name: 'Password' }).fill('WrongPassword1!')
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page.getByRole('alert')).toBeVisible()
  })
})

test.describe('Create Account', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/app')
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
  })
})

test.describe('Sign Out', () => {
  test('sign out redirects to landing page', async ({ page }) => {
    // Sign in first
    await page.goto('/app')
    await page.getByLabel('Email').fill(E2E_EMAIL)
    await page.getByRole('textbox', { name: 'Password' }).fill(E2E_PASSWORD)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page.getByTestId('canvas-stage')).toBeVisible({ timeout: 20_000 })

    // Sign out
    await page.getByTestId('sign-out-button').click()
    await expect(page).toHaveURL('/')
  })
})
