/**
 * Plan management E2E tests — rename, and cloud dashboard (when cloud is enabled).
 * Runs with stored auth state.
 */
import { test, expect } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/app')
  await expect(page.getByTestId('canvas-container')).toBeVisible({ timeout: 20_000 })
})

test.describe('Plan Dashboard', () => {
  test('opens plan dashboard', async ({ page }) => {
    // Cloud Plans button only visible when cloud storage is configured
    const dashBtn = page.getByTestId('cloud-plans-button')
    if (!await dashBtn.isVisible()) {
      test.skip()
      return
    }
    await dashBtn.click()
    await expect(page.getByTestId('plan-dashboard')).toBeVisible({ timeout: 10_000 })
  })

  // NOTE: PlanDashboard is a cloud plan picker, not a new-plan creator.
  // A "New Plan" button doesn't exist yet — skip until that feature lands.
  test.skip('creates a new plan', async ({ page }) => {
    await page.getByTestId('cloud-plans-button').click()
    await expect(page.getByTestId('plan-dashboard')).toBeVisible({ timeout: 10_000 })
    await page.getByTestId('new-plan-btn').click()
    await expect(page.getByTestId('canvas-container')).toBeVisible()
  })
})

test.describe('Plan Title', () => {
  test('can rename the current plan', async ({ page }) => {
    const titleInput = page.getByTestId('plan-title')
    await expect(titleInput).toBeVisible()
    await titleInput.fill('E2E Test Plan')
    await titleInput.press('Enter')
    await expect(titleInput).toHaveValue('E2E Test Plan')
  })
})
