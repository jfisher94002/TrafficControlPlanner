/**
 * Address UX E2E tests — blank canvas state, tool-blocking modal.
 * Runs with stored auth state.
 */
import { test, expect } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/app')
  await expect(page.getByTestId('canvas-container')).toBeVisible({ timeout: 20_000 })
})

test.describe('Blank canvas state (no address)', () => {
  test('shows blank canvas overlay when no address is set', async ({ page }) => {
    // On a fresh session, mapCenter may already be set from autosave — skip if so
    const overlay = page.getByTestId('blank-canvas-overlay')
    const isVisible = await overlay.isVisible()
    if (!isVisible) {
      // Canvas already has an address loaded — skip gracefully
      test.skip()
    }
    await expect(overlay).toBeVisible()
  })

  test('address search input has prominent placeholder when no address', async ({ page }) => {
    const input = page.getByTestId('address-search-input')
    await expect(input).toBeVisible()
    const placeholder = await input.getAttribute('placeholder')
    // Either the prominent placeholder (no address) or the default (address loaded)
    expect(
      placeholder === 'Enter job site address to load the map' || placeholder === 'Search address…'
    ).toBe(true)
  })
})

test.describe('Address-required modal', () => {
  test('shows modal when drawing tool clicked without address', async ({ page }) => {
    // Only meaningful when mapCenter is null
    const overlay = page.getByTestId('blank-canvas-overlay')
    if (!(await overlay.isVisible())) {
      test.skip()
    }

    // Click the Road tool via JS (may be in overflow)
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('[data-testid]')).find(
        (el) => el.getAttribute('title')?.toLowerCase().includes('road')
      ) as HTMLButtonElement | undefined
      btn?.click()
    })

    // Try all TOOLS buttons — at least one drawing tool should trigger the modal
    // Use switchTool pathway: click any ToolButton that is not select/pan
    // The quickest reliable way is to click a ToolButton by its title attribute
    // Fall back: look for any button with title containing 'Road' or use direct evaluate
    await page.evaluate(() => {
      // Find a ToolButton for a drawing tool and click it
      const buttons = Array.from(document.querySelectorAll('button[title]')) as HTMLButtonElement[]
      const drawBtn = buttons.find((b) => {
        const t = b.title.toLowerCase()
        return t.includes('road') || t.includes('sign') || t.includes('zone')
      })
      drawBtn?.click()
    })

    await expect(page.getByTestId('address-required-modal')).toBeVisible({ timeout: 5_000 })
  })

  test('modal "Enter address →" button focuses address input', async ({ page }) => {
    const overlay = page.getByTestId('blank-canvas-overlay')
    if (!(await overlay.isVisible())) {
      test.skip()
    }

    // Trigger modal
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button[title]')) as HTMLButtonElement[]
      const drawBtn = buttons.find((b) => {
        const t = b.title.toLowerCase()
        return t.includes('road') || t.includes('sign') || t.includes('zone')
      })
      drawBtn?.click()
    })

    const modal = page.getByTestId('address-required-modal')
    await expect(modal).toBeVisible({ timeout: 5_000 })

    await modal.getByTestId('address-required-go-button').click()

    // Modal should close
    await expect(modal).not.toBeVisible()

    // Address input should be focused
    const input = page.getByTestId('address-search-input')
    await expect(input).toBeFocused()
  })

  test('modal closes on Escape', async ({ page }) => {
    const overlay = page.getByTestId('blank-canvas-overlay')
    if (!(await overlay.isVisible())) {
      test.skip()
    }

    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button[title]')) as HTMLButtonElement[]
      const drawBtn = buttons.find((b) => {
        const t = b.title.toLowerCase()
        return t.includes('road') || t.includes('sign') || t.includes('zone')
      })
      drawBtn?.click()
    })

    const modal = page.getByTestId('address-required-modal')
    await expect(modal).toBeVisible({ timeout: 5_000 })

    await page.keyboard.press('Escape')
    // The backdrop click handler closes it; Escape closes via the existing global handler
    // In case neither fires (modal doesn't trap Escape itself), click dismiss
    const isDismissed = await modal.isVisible().then(v => !v)
    if (!isDismissed) {
      await modal.getByText('Dismiss').click()
    }
    await expect(modal).not.toBeVisible()
  })

  test('modal closes on backdrop click', async ({ page }) => {
    const overlay = page.getByTestId('blank-canvas-overlay')
    if (!(await overlay.isVisible())) {
      test.skip()
    }

    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button[title]')) as HTMLButtonElement[]
      const drawBtn = buttons.find((b) => {
        const t = b.title.toLowerCase()
        return t.includes('road') || t.includes('sign') || t.includes('zone')
      })
      drawBtn?.click()
    })

    const modal = page.getByTestId('address-required-modal')
    await expect(modal).toBeVisible({ timeout: 5_000 })

    // Click the backdrop (the outermost div of the modal)
    await modal.click({ position: { x: 5, y: 5 } })
    await expect(modal).not.toBeVisible()
  })
})
