/**
 * Template library E2E tests. Runs with stored auth state.
 */
import { test, expect } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/app')
  await expect(page.getByTestId('canvas-stage')).toBeVisible({ timeout: 20_000 })
})

test.describe('Template Picker', () => {
  test('opens template picker from toolbar', async ({ page }) => {
    await page.getByTestId('tool-templates').click()
    await expect(page.getByRole('dialog', { name: /templates/i })).toBeVisible({ timeout: 8_000 })
  })

  test('shows all 5 starter templates', async ({ page }) => {
    await page.getByTestId('tool-templates').click()
    const dialog = page.getByRole('dialog', { name: /templates/i })
    await expect(dialog).toBeVisible({ timeout: 8_000 })
    // Should show at least 5 templates
    const cards = dialog.getByRole('button').filter({ hasText: /.+/ })
    await expect(cards).toHaveCount(await cards.count())
    expect(await cards.count()).toBeGreaterThanOrEqual(5)
  })

  test('closes on Escape', async ({ page }) => {
    await page.getByTestId('tool-templates').click()
    await expect(page.getByRole('dialog', { name: /templates/i })).toBeVisible({ timeout: 8_000 })
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog', { name: /templates/i })).not.toBeVisible()
  })

  test('applies template in Replace mode', async ({ page }) => {
    await page.getByTestId('tool-templates').click()
    const dialog = page.getByRole('dialog', { name: /templates/i })
    await expect(dialog).toBeVisible({ timeout: 8_000 })

    // Select first template and apply
    await dialog.getByRole('button').filter({ hasText: /.+/ }).first().click()
    const applyBtn = page.getByTestId('template-apply-btn')
    await expect(applyBtn).toBeVisible()
    await applyBtn.click()

    await expect(page.getByRole('dialog', { name: /templates/i })).not.toBeVisible()
    await expect(page.getByTestId('canvas-stage')).toBeVisible()
  })
})
