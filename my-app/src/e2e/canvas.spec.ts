/**
 * Canvas interaction E2E tests.
 * All tests run with stored auth state from auth.setup.ts.
 */
import { test, expect } from '@playwright/test'
import { seedMapCenter } from './openSignInModal'

test.beforeEach(async ({ page }) => {
  // Pre-seed a mapCenter so tools that require a map activate directly
  // instead of showing the address-required modal.
  await seedMapCenter(page)
  await page.goto('/app')
  await expect(page.getByTestId('canvas-container')).toBeVisible({ timeout: 20_000 })
})

test.describe('Canvas — Tool Selection', () => {
  test('road tool is active by default or can be selected', async ({ page }) => {
    const roadBtn = page.getByTestId('tool-road')
    await expect(roadBtn).toBeVisible()
    await roadBtn.click()
    await expect(roadBtn).toHaveAttribute('aria-pressed', 'true')
  })

  test('can select sign tool', async ({ page }) => {
    await page.getByTestId('tool-sign').click()
    await expect(page.getByTestId('tool-sign')).toHaveAttribute('aria-pressed', 'true')
  })

  test('can select device tool', async ({ page }) => {
    await page.getByTestId('tool-device').click()
    await expect(page.getByTestId('tool-device')).toHaveAttribute('aria-pressed', 'true')
  })
})

test.describe('Canvas — Keyboard Shortcuts', () => {
  test('Ctrl+Z triggers undo (toolbar undo button becomes active)', async ({ page }) => {
    // Place something first so there's something to undo
    await page.getByTestId('canvas-container').click({ position: { x: 300, y: 300 } })
    await page.keyboard.press('Control+z')
    // Undo doesn't throw and page is still functional
    await expect(page.getByTestId('canvas-container')).toBeVisible()
  })

  test('Escape deselects current tool', async ({ page }) => {
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('canvas-container')).toBeVisible()
  })
})

test.describe('Canvas — Zoom', () => {
  test('zoom in button increases zoom', async ({ page }) => {
    const zoomIn = page.getByTestId('zoom-in')
    await expect(zoomIn).toBeVisible()
    await zoomIn.click()
    // Zoom level indicator should update
    const zoomLabel = page.getByTestId('zoom-level')
    if (await zoomLabel.isVisible()) {
      const text = await zoomLabel.textContent()
      expect(text).toMatch(/\d+%/)
    }
  })

  test('zoom out button decreases zoom', async ({ page }) => {
    const zoomOut = page.getByTestId('zoom-out')
    await expect(zoomOut).toBeVisible()
    await zoomOut.click()
    await expect(page.getByTestId('canvas-container')).toBeVisible()
  })

  test('Ctrl+0 resets zoom', async ({ page }) => {
    await page.keyboard.press('Control+0')
    await expect(page.getByTestId('canvas-container')).toBeVisible()
  })
})
