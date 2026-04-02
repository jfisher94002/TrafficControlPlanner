/**
 * Help modal E2E tests — keyboard handling (#167).
 * Runs with stored auth state.
 */
import { test, expect } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/app')
  await expect(page.getByTestId('canvas-container')).toBeVisible({ timeout: 20_000 })
})

test.describe('Help Modal', () => {
  test('opens via toolbar button', async ({ page }) => {
    await page.getByTestId('help-button').click()
    await expect(page.getByTestId('help-modal')).toBeVisible()
  })

  test('closes via close button', async ({ page }) => {
    await page.getByTestId('help-button').click()
    await expect(page.getByTestId('help-modal')).toBeVisible()
    await page.getByTestId('help-modal-close').click()
    await expect(page.getByTestId('help-modal')).not.toBeVisible()
  })

  test('closes via Escape key', async ({ page }) => {
    await page.getByTestId('help-button').click()
    await expect(page.getByTestId('help-modal')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('help-modal')).not.toBeVisible()
  })

  test('closes via backdrop click', async ({ page }) => {
    await page.getByTestId('help-button').click()
    await expect(page.getByTestId('help-modal')).toBeVisible()
    await page.mouse.click(10, 10)
    await expect(page.getByTestId('help-modal')).not.toBeVisible()
  })

  test('focus is on close button when modal opens', async ({ page }) => {
    await page.getByTestId('help-button').click()
    await expect(page.getByTestId('help-modal')).toBeVisible()
    await expect(page.getByTestId('help-modal-close')).toBeFocused()
  })

  test('focus returns to help button after closing', async ({ page }) => {
    await page.getByTestId('help-button').click()
    await expect(page.getByTestId('help-modal')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('help-modal')).not.toBeVisible()
    await expect(page.getByTestId('help-button')).toBeFocused()
  })
})
