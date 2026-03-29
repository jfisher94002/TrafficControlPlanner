/**
 * Beta tools E2E tests — lane mask, crosswalk, turn lane, road shoulders.
 * Runs against staging with stored auth state.
 */
import { test, expect } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/app')
  await expect(page.getByTestId('canvas-container')).toBeVisible({ timeout: 20_000 })
})

// ─── Lane Mask Tool ───────────────────────────────────────────────────────────

test.describe('Beta Tools — Lane Mask', () => {
  test('lane mask tool button is visible in toolbar', async ({ page }) => {
    const btn = page.getByTestId('tool-lane_mask')
    await expect(btn).toBeVisible({ timeout: 8_000 })
  })

  test('pressing M activates lane mask tool', async ({ page }) => {
    await page.keyboard.press('M')
    await expect(page.getByTestId('tool-lane_mask')).toHaveAttribute('aria-pressed', 'true', { timeout: 8_000 })
  })

  test('dragging on canvas with lane mask tool places an object', async ({ page }) => {
    // Activate the lane mask tool
    await page.getByTestId('tool-lane_mask').click()
    await expect(page.getByTestId('tool-lane_mask')).toHaveAttribute('aria-pressed', 'true', { timeout: 8_000 })

    // Record initial object count
    const countEl = page.getByTestId('object-count')
    await expect(countEl).toBeVisible({ timeout: 8_000 })
    const initialText = await countEl.textContent()
    const initialCount = parseInt(initialText ?? '0', 10)

    // Drag on the canvas to place a lane mask
    const canvas = page.getByTestId('canvas-container')
    await canvas.hover({ position: { x: 300, y: 300 } })
    await page.mouse.down()
    await page.mouse.move(400, 350)
    await page.mouse.up()

    // Object count should have increased by 1
    await expect(countEl).toContainText(`${initialCount + 1} objects`, { timeout: 8_000 })
  })

  test('placed lane mask appears in manifest as Lane Masks', async ({ page }) => {
    // Activate and drag to place a lane mask
    await page.getByTestId('tool-lane_mask').click()
    const canvas = page.getByTestId('canvas-container')
    await canvas.hover({ position: { x: 300, y: 300 } })
    await page.mouse.down()
    await page.mouse.move(400, 350)
    await page.mouse.up()

    // Open the manifest tab (right panel is open by default)
    await page.getByTestId('tab-manifest').click()

    // "Lane Masks" row should be visible in the manifest
    await expect(page.getByTestId('manifest-panel').getByText('Lane Masks')).toBeVisible({ timeout: 8_000 })
  })
})

// ─── Crosswalk Tool ───────────────────────────────────────────────────────────

test.describe('Beta Tools — Crosswalk', () => {
  test('crosswalk tool button is visible in toolbar', async ({ page }) => {
    const btn = page.getByTestId('tool-crosswalk')
    await expect(btn).toBeVisible({ timeout: 8_000 })
  })

  test('pressing C activates crosswalk tool', async ({ page }) => {
    await page.keyboard.press('C')
    await expect(page.getByTestId('tool-crosswalk')).toHaveAttribute('aria-pressed', 'true', { timeout: 8_000 })
  })

  test('dragging on canvas with crosswalk tool places an object', async ({ page }) => {
    // Activate the crosswalk tool
    await page.getByTestId('tool-crosswalk').click()
    await expect(page.getByTestId('tool-crosswalk')).toHaveAttribute('aria-pressed', 'true', { timeout: 8_000 })

    // Record initial object count
    const countEl = page.getByTestId('object-count')
    await expect(countEl).toBeVisible({ timeout: 8_000 })
    const initialText = await countEl.textContent()
    const initialCount = parseInt(initialText ?? '0', 10)

    // Drag on the canvas to place a crosswalk
    const canvas = page.getByTestId('canvas-container')
    await canvas.hover({ position: { x: 300, y: 250 } })
    await page.mouse.down()
    await page.mouse.move(400, 250)
    await page.mouse.up()

    // Object count should have increased by 1
    await expect(countEl).toContainText(`${initialCount + 1} objects`, { timeout: 8_000 })
  })

  test('placed crosswalk appears in manifest', async ({ page }) => {
    // Activate and drag to place a crosswalk
    await page.getByTestId('tool-crosswalk').click()
    const canvas = page.getByTestId('canvas-container')
    await canvas.hover({ position: { x: 300, y: 250 } })
    await page.mouse.down()
    await page.mouse.move(400, 250)
    await page.mouse.up()

    // Open the manifest tab
    await page.getByTestId('tab-manifest').click()

    // "Crosswalks" row should be visible in the manifest
    await expect(page.getByTestId('manifest-panel').getByText('Crosswalks')).toBeVisible({ timeout: 8_000 })
  })
})

// ─── Turn Lane Tool ───────────────────────────────────────────────────────────

test.describe('Beta Tools — Turn Lane', () => {
  test('turn lane tool button is visible in toolbar', async ({ page }) => {
    const btn = page.getByTestId('tool-turn_lane')
    await expect(btn).toBeVisible({ timeout: 8_000 })
  })

  test('pressing L activates turn lane tool', async ({ page }) => {
    await page.keyboard.press('L')
    await expect(page.getByTestId('tool-turn_lane')).toHaveAttribute('aria-pressed', 'true', { timeout: 8_000 })
  })

  test('clicking canvas with turn lane tool places an object', async ({ page }) => {
    // Activate the turn lane tool
    await page.getByTestId('tool-turn_lane').click()
    await expect(page.getByTestId('tool-turn_lane')).toHaveAttribute('aria-pressed', 'true', { timeout: 8_000 })

    // Record initial object count
    const countEl = page.getByTestId('object-count')
    await expect(countEl).toBeVisible({ timeout: 8_000 })
    const initialText = await countEl.textContent()
    const initialCount = parseInt(initialText ?? '0', 10)

    // Single click on the canvas to place a turn lane
    const canvas = page.getByTestId('canvas-container')
    await canvas.click({ position: { x: 300, y: 300 } })

    // Object count should have increased by 1
    await expect(countEl).toContainText(`${initialCount + 1} objects`, { timeout: 8_000 })
  })

  test('placed turn lane appears in manifest as Turn Lanes', async ({ page }) => {
    // Activate and click to place a turn lane
    await page.getByTestId('tool-turn_lane').click()
    const canvas = page.getByTestId('canvas-container')
    await canvas.click({ position: { x: 300, y: 300 } })

    // Open the manifest tab
    await page.getByTestId('tab-manifest').click()

    // "Turn Lanes" row should be visible in the manifest
    await expect(page.getByTestId('manifest-panel').getByText('Turn Lanes')).toBeVisible({ timeout: 8_000 })
  })
})

// ─── Road Shoulders (properties) ─────────────────────────────────────────────

test.describe('Beta Tools — Road Shoulders', () => {
  test('placing a road and selecting it shows Shoulder & Sidewalk in properties', async ({ page }) => {
    // Activate the road tool and draw a road
    await page.keyboard.press('R')
    await expect(page.getByTestId('tool-road')).toHaveAttribute('aria-pressed', 'true', { timeout: 8_000 })

    // Use boundingBox so all mouse coords are in the same viewport space
    const canvas = page.getByTestId('canvas-container')
    const box = await canvas.boundingBox()
    await page.mouse.move(box!.x + 200, box!.y + 300)
    await page.mouse.down()
    await page.mouse.move(box!.x + 450, box!.y + 300)
    await page.mouse.up()

    // Road is auto-selected after drawing — properties panel shows immediately
    // The properties panel should show "Shoulder & Sidewalk"
    await expect(page.getByTestId('right-panel').getByText('Shoulder & Sidewalk')).toBeVisible({ timeout: 8_000 })
  })

  test('shoulder width slider is interactive', async ({ page }) => {
    // Place a road using consistent viewport coordinates
    await page.keyboard.press('R')
    const canvas = page.getByTestId('canvas-container')
    const box = await canvas.boundingBox()
    await page.mouse.move(box!.x + 200, box!.y + 300)
    await page.mouse.down()
    await page.mouse.move(box!.x + 450, box!.y + 300)
    await page.mouse.up()

    // Road is auto-selected after drawing — properties panel shows immediately

    // The properties tab should be active (it is by default)
    await expect(page.getByTestId('right-panel').getByText('Shoulder & Sidewalk')).toBeVisible({ timeout: 8_000 })

    // Find the shoulder width range input and interact with it
    const slider = page.getByTestId('right-panel').locator('input[type="range"]').first()
    await expect(slider).toBeVisible({ timeout: 8_000 })

    // Change the slider value — the page should not crash
    await slider.fill('15')
    await expect(page.getByTestId('canvas-container')).toBeVisible({ timeout: 8_000 })
  })
})
