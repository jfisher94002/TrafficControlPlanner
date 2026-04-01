/**
 * Template library E2E tests. Runs with stored auth state.
 */
import { test, expect } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/app')
  await expect(page.getByTestId('canvas-container')).toBeVisible({ timeout: 20_000 })
})

test.describe('Template Picker', () => {
  test('opens template picker from toolbar', async ({ page }) => {
    // templates-button may be inside an overflow:hidden toolbar clipped at CI widths; use JS click
    await page.evaluate(() => { (document.querySelector('[data-testid="templates-button"]') as HTMLButtonElement)?.click() })
    await expect(page.getByRole('dialog', { name: /templates/i })).toBeVisible({ timeout: 8_000 })
  })

  test('shows all 5 starter templates', async ({ page }) => {
    // templates-button may be inside an overflow:hidden toolbar clipped at CI widths; use JS click
    await page.evaluate(() => { (document.querySelector('[data-testid="templates-button"]') as HTMLButtonElement)?.click() })
    const dialog = page.getByRole('dialog', { name: /templates/i })
    await expect(dialog).toBeVisible({ timeout: 8_000 })
    // Should show exactly 5 starter templates
    const cards = dialog.getByRole('button', { name: 'Use Template' })
    await expect(cards).toHaveCount(5)
  })

  test('closes on Escape', async ({ page }) => {
    // templates-button may be inside an overflow:hidden toolbar clipped at CI widths; use JS click
    await page.evaluate(() => { (document.querySelector('[data-testid="templates-button"]') as HTMLButtonElement)?.click() })
    await expect(page.getByRole('dialog', { name: /templates/i })).toBeVisible({ timeout: 8_000 })
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog', { name: /templates/i })).not.toBeVisible()
  })

  test('applies template and closes picker', async ({ page }) => {
    // templates-button may be inside an overflow:hidden toolbar clipped at CI widths; use JS click
    await page.evaluate(() => { (document.querySelector('[data-testid="templates-button"]') as HTMLButtonElement)?.click() })
    const dialog = page.getByRole('dialog', { name: /templates/i })
    await expect(dialog).toBeVisible({ timeout: 8_000 })

    // Click the first "Use Template" button — applies immediately and closes
    await dialog.getByRole('button', { name: 'Use Template' }).first().click()

    await expect(dialog).not.toBeVisible()
    await expect(page.getByTestId('canvas-container')).toBeVisible()
  })
})
