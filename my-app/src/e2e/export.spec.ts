/**
 * PDF export E2E tests. Runs with stored auth state.
 *
 * NOTE: Export preview modal tests are skipped — that feature lives in PR #146
 * and hasn't merged yet. Once it lands, replace test.skip() with the real assertions.
 */
import { test, expect } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/app')
  await expect(page.getByTestId('canvas-container')).toBeVisible({ timeout: 20_000 })
})

test.describe('Export Preview Modal', () => {
  test.skip('export button opens preview modal', async ({ page }) => {
    await page.getByTestId('export-pdf-button').click()
    await expect(page.getByTestId('export-preview-modal')).toBeVisible({ timeout: 10_000 })
  })

  test.skip('modal shows canvas preview image and title block', async ({ page }) => {
    await page.getByTestId('export-pdf-button').click()
    await expect(page.getByTestId('export-preview-modal')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('export-preview-image')).toBeVisible()
  })

  test.skip('Cancel closes modal without exporting', async ({ page }) => {
    await page.getByTestId('export-pdf-button').click()
    await expect(page.getByTestId('export-preview-modal')).toBeVisible({ timeout: 10_000 })
    await page.getByRole('button', { name: 'Cancel' }).click()
    await expect(page.getByTestId('export-preview-modal')).not.toBeVisible()
  })

  test.skip('Escape closes modal', async ({ page }) => {
    await page.getByTestId('export-pdf-button').click()
    await expect(page.getByTestId('export-preview-modal')).toBeVisible({ timeout: 10_000 })
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('export-preview-modal')).not.toBeVisible()
  })

  test.skip('clicking overlay closes modal', async ({ page }) => {
    await page.getByTestId('export-pdf-button').click()
    await expect(page.getByTestId('export-preview-modal')).toBeVisible({ timeout: 10_000 })
    await page.getByTestId('export-preview-overlay').click({ position: { x: 5, y: 5 } })
    await expect(page.getByTestId('export-preview-modal')).not.toBeVisible()
  })

  test.skip('Export PDF button triggers download', async ({ page }) => {
    await page.getByTestId('export-pdf-button').click()
    await expect(page.getByTestId('export-preview-modal')).toBeVisible({ timeout: 10_000 })

    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 15_000 }),
      page.getByTestId('export-preview-confirm').click(),
    ])
    expect(download.suggestedFilename()).toMatch(/\.pdf$/i)
  })
})
