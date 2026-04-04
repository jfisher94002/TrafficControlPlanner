/**
 * Address UX E2E tests — blank canvas state, tool-blocking modal.
 * Runs with stored auth state.
 *
 * addInitScript removes tcp_autosave before page scripts run so the app
 * always boots without an address — tests never need to skip.
 */
import { test, expect, type Page } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  // Remove autosave before the page loads so mapCenter initialises as null
  await page.addInitScript(() => localStorage.removeItem('tcp_autosave'))
  await page.goto('/app')
  await expect(page.getByTestId('canvas-container')).toBeVisible({ timeout: 20_000 })
})

/** Click a tool button via JS to bypass overflow:hidden clipping. */
async function clickTool(page: Page, testId: string) {
  await page.evaluate((tid) => {
    (document.querySelector(`[data-testid="${tid}"]`) as HTMLElement | null)?.click()
  }, testId)
}

test.describe('Blank canvas state (no address)', () => {
  test('shows blank canvas overlay when no address is set', async ({ page }) => {
    await expect(page.getByTestId('blank-canvas-overlay')).toBeVisible()
  })

  test('address search input has prominent placeholder when no address', async ({ page }) => {
    const input = page.getByTestId('address-search-input')
    await expect(input).toBeVisible()
    await expect(input).toHaveAttribute('placeholder', 'Enter job site address to load the map')
  })
})

test.describe('Address-required modal', () => {

  test('shows modal when drawing tool clicked without address', async ({ page }) => {
    await clickTool(page, 'tool-road')
    await expect(page.getByTestId('address-required-modal')).toBeVisible({ timeout: 5_000 })
  })

  test('auto-focuses primary button on open', async ({ page }) => {
    await clickTool(page, 'tool-sign')
    await expect(page.getByTestId('address-required-modal')).toBeVisible({ timeout: 5_000 })
    await expect(page.getByTestId('address-required-go-button')).toBeFocused()
  })

  test('"Enter address →" button focuses address input', async ({ page }) => {
    await clickTool(page, 'tool-road')
    const modal = page.getByTestId('address-required-modal')
    await expect(modal).toBeVisible({ timeout: 5_000 })
    await modal.getByTestId('address-required-go-button').click()
    await expect(modal).not.toBeVisible()
    await expect(page.getByTestId('address-search-input')).toBeFocused()
  })

  test('closes on Escape', async ({ page }) => {
    await clickTool(page, 'tool-road')
    const modal = page.getByTestId('address-required-modal')
    await expect(modal).toBeVisible({ timeout: 5_000 })
    await page.keyboard.press('Escape')
    await expect(modal).not.toBeVisible({ timeout: 2_000 })
  })

  test('closes on backdrop click', async ({ page }) => {
    await clickTool(page, 'tool-road')
    const modal = page.getByTestId('address-required-modal')
    await expect(modal).toBeVisible({ timeout: 5_000 })
    await modal.click({ position: { x: 5, y: 5 } })
    await expect(modal).not.toBeVisible()
  })
})
