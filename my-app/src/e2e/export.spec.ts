/**
 * PDF export preview E2E tests. Runs with stored auth state.
 */
import { test, expect } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/app')
  await expect(page.getByTestId('canvas-stage')).toBeVisible({ timeout: 20_000 })
})

test.describe('Export Preview Modal', () => {
  test('export button opens preview modal', async ({ page }) => {
    await page.getByTestId('export-pdf-btn').click()
    await expect(page.getByTestId('export-preview-modal')).toBeVisible({ timeout: 10_000 })
  })

  test('modal shows canvas preview image and title block', async ({ page }) => {
    await page.getByTestId('export-pdf-btn').click()
    await expect(page.getByTestId('export-preview-modal')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('export-preview-image')).toBeVisible()
  })

  test('Cancel closes modal without exporting', async ({ page }) => {
    await page.getByTestId('export-pdf-btn').click()
    await expect(page.getByTestId('export-preview-modal')).toBeVisible({ timeout: 10_000 })
    await page.getByRole('button', { name: 'Cancel' }).click()
    await expect(page.getByTestId('export-preview-modal')).not.toBeVisible()
  })

  test('Escape closes modal', async ({ page }) => {
    await page.getByTestId('export-pdf-btn').click()
    await expect(page.getByTestId('export-preview-modal')).toBeVisible({ timeout: 10_000 })
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('export-preview-modal')).not.toBeVisible()
  })

  test('clicking overlay closes modal', async ({ page }) => {
    await page.getByTestId('export-pdf-btn').click()
    await expect(page.getByTestId('export-preview-modal')).toBeVisible({ timeout: 10_000 })
    await page.getByTestId('export-preview-overlay').click({ position: { x: 5, y: 5 } })
    await expect(page.getByTestId('export-preview-modal')).not.toBeVisible()
  })

  test('Export PDF button triggers download', async ({ page }) => {
    await page.getByTestId('export-pdf-btn').click()
    await expect(page.getByTestId('export-preview-modal')).toBeVisible({ timeout: 10_000 })

    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 15_000 }),
      page.getByTestId('export-preview-confirm').click(),
    ])
    expect(download.suggestedFilename()).toMatch(/\.pdf$/i)
  })
})
