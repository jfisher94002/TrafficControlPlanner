/**
 * Plan management E2E tests — dashboard, create, rename, duplicate, delete.
 * Runs with stored auth state.
 */
import { test, expect } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/app')
  await expect(page.getByTestId('canvas-container')).toBeVisible({ timeout: 20_000 })
})

test.describe('Plan Dashboard', () => {
  test('opens plan dashboard', async ({ page }) => {
    await page.getByTestId('open-dashboard').click()
    await expect(page.getByTestId('plan-dashboard')).toBeVisible({ timeout: 10_000 })
  })

  test('creates a new plan', async ({ page }) => {
    await page.getByTestId('open-dashboard').click()
    await expect(page.getByTestId('plan-dashboard')).toBeVisible({ timeout: 10_000 })
    await page.getByTestId('new-plan-btn').click()
    // Dashboard closes and canvas is ready
    await expect(page.getByTestId('canvas-container')).toBeVisible()
  })
})

test.describe('Plan Title', () => {
  test('can rename the current plan', async ({ page }) => {
    const titleInput = page.getByTestId('plan-title-input')
    await expect(titleInput).toBeVisible()
    await titleInput.fill('E2E Test Plan')
    await titleInput.press('Enter')
    await expect(titleInput).toHaveValue('E2E Test Plan')
  })
})
