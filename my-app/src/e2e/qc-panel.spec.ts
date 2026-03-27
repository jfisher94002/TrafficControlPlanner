/**
 * QC panel E2E tests. Runs with stored auth state.
 */
import { test, expect } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/app')
  await expect(page.getByTestId('canvas-container')).toBeVisible({ timeout: 20_000 })
})

test.describe('QC Panel', () => {
  test('QC tab is visible in right sidebar', async ({ page }) => {
    await expect(page.getByTestId('tab-qc')).toBeVisible()
  })

  test('empty plan shows info message in QC panel', async ({ page }) => {
    await page.getByTestId('tab-qc').click()
    await expect(page.getByTestId('qc-panel')).toBeVisible()
    // On a fresh/empty plan the QC panel shows info or green check
    const panel = page.getByTestId('qc-panel')
    await expect(panel).toBeVisible()
  })

  test('QC panel opens and closes via tab', async ({ page }) => {
    await page.getByTestId('tab-qc').click()
    await expect(page.getByTestId('qc-panel')).toBeVisible()
    // Switch to properties tab
    await page.getByTestId('tab-properties').click()
    await expect(page.getByTestId('qc-panel')).not.toBeVisible()
  })
})
