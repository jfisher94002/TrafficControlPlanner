/**
 * MUTCD Chapter 6P — Typical Application (TA) scenario automation suite.
 *
 * All 54 TA diagrams are driven from fixture data in:
 *   src/e2e/fixtures/ta-scenarios.ts
 *
 * Fully-defined scenarios assert seed objects and canvas state.
 * Stub scenarios (skip field set) are counted but skipped until their
 * seed data is filled in.
 *
 * To add a scenario: find the entry in ta-scenarios.ts, replace the
 * STUB_SEED/STUB_ASSERT with real data, and remove the `skip` field.
 *
 * ─── Assertions ───────────────────────────────────────────────────────────────
 * 1. Sign IDs present on canvas (from the **seed** via getSignIdsFromSeed; not assert.signs alone)
 * 2. Sign labels match SIGN_DATA (catches MUTCD label mismatches automatically)
 *    Override per-scenario with assert.signLabels if needed.
 * 3. Device IDs present
 * 4. Object types present
 * 5. Taper counts / lengths
 * 6. Visual snapshot — compared against stored baseline (update with
 *    STAGING_URL=http://localhost:5173 npx playwright test --update-snapshots --project=local)
 */

import { test, expect, type Page } from '@playwright/test'
import { TA_SCENARIOS, SIGN_DATA, getSignIdsFromSeed } from './fixtures/ta-scenarios'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Skip all TA scenario tests if the staging deployment doesn't have the
 * seed API yet. Tests auto-enable once the feature deploys to staging.
 *
 * Also registers an init script that clears tcp_autosave before any seed
 * page load — this runs synchronously before React's readAutosave() call,
 * preventing a stale mapCenter from a real user session bleeding in.
 */
test.beforeEach(async ({ page }) => {
  // addInitScript is cumulative per page; the conditional prevents it from
  // clearing autosave on non-seed navigations (e.g., the /app check below).
  await page.addInitScript(() => {
    if (new URLSearchParams(window.location.search).has('seed')) {
      localStorage.removeItem('tcp_autosave')
    }
  })
  await page.goto('/app')
  const hasApi = await page.evaluate(
    () => typeof (window as unknown as Record<string, unknown>).__tcpGetObjects === 'function',
  )
  if (!hasApi) test.skip()
})

/** Seed the canvas and navigate to /app, waiting for the stage to be ready. */
async function seedAndLoad(page: Page, seed: Record<string, unknown>) {
  const encoded = encodeURIComponent(Buffer.from(JSON.stringify(seed)).toString('base64'))
  await page.goto(`/app?seed=${encoded}`)
  await expect(page.getByTestId('canvas-container')).toBeVisible({ timeout: 20_000 })
  // Hide the "enter address" overlay — it appears when mapCenter is null and
  // would obscure canvas objects in screenshots, but is irrelevant to assertions.
  await page.addStyleTag({ content: '[data-testid="blank-canvas-overlay"] { display: none !important; }' })
}

type CanvasObj = {
  type: string
  signData?: { id: string; label?: string }
  deviceData?: { id: string }
  taperLength?: number
}

/** Returns live canvas objects via window.__tcpGetObjects. */
async function getObjects(page: Page): Promise<CanvasObj[]> {
  return page.evaluate(() => {
    const fn = (window as unknown as Record<string, unknown>).__tcpGetObjects
    return typeof fn === 'function' ? (fn as () => CanvasObj[])() : []
  })
}

// ─── Parameterized test loop ──────────────────────────────────────────────────

for (const scenario of TA_SCENARIOS) {
  test(`${scenario.id}: ${scenario.title}`, async ({ page }) => {
    if (scenario.skip) {
      test.skip(true, scenario.skip)
      return
    }

    await seedAndLoad(page, scenario.seed as Record<string, unknown>)

    const objs = await getObjects(page)
    const { assert } = scenario
    // Authoritative: whatever `sign('…')` objects are in the seed. `assert.signs` must
    // match in Vitest; e2e uses the seed so we never pass on a stale/short `assert` alone.
    const signIdsFromSeed = getSignIdsFromSeed(scenario.seed as { objects: unknown[] })

    // Assert required sign ids are present
    for (const signId of signIdsFromSeed) {
      const found = objs.some(o => o.type === 'sign' && o.signData?.id === signId)
      expect(found, `Expected sign "${signId}" on canvas`).toBe(true)
    }

    // Assert sign labels match SIGN_DATA (auto-catches MUTCD label mismatches).
    // Per-scenario overrides via assert.signLabels take precedence.
    for (const signId of signIdsFromSeed) {
      const expectedLabel = assert.signLabels?.[signId] ?? SIGN_DATA[signId]?.label
      if (!expectedLabel) continue
      const obj = objs.find(o => o.type === 'sign' && o.signData?.id === signId)
      expect(
        obj?.signData?.label,
        `Sign "${signId}" label mismatch — expected "${expectedLabel}"`,
      ).toBe(expectedLabel)
    }

    // Assert required device ids are present
    for (const deviceId of assert.devices ?? []) {
      const found = objs.some(o => o.type === 'device' && o.deviceData?.id === deviceId)
      expect(found, `Expected device "${deviceId}" on canvas`).toBe(true)
    }

    // Assert required object types are present
    const foundTypes = objs.map(o => o.type)
    for (const t of assert.objectTypes ?? []) {
      expect(foundTypes, `Expected canvas to contain a "${t}" object`).toContain(t)
    }

    // Assert minimum taper count
    if (assert.minTapers !== undefined) {
      const taperCount = objs.filter(o => o.type === 'taper').length
      expect(taperCount).toBeGreaterThanOrEqual(assert.minTapers)
    }

    // Assert minimum device counts per device id
    for (const [deviceId, minCount] of Object.entries(assert.minDevices ?? {})) {
      const count = objs.filter(o => o.type === 'device' && o.deviceData?.id === deviceId).length
      expect(count, `Expected at least ${minCount} "${deviceId}" devices`).toBeGreaterThanOrEqual(minCount)
    }

    // Assert taper length formula L = laneWidth × speed
    if (assert.taperFormula) {
      const { expectedFt } = assert.taperFormula
      const t = objs.find(o => o.type === 'taper')
      expect(t?.taperLength, `Expected taper length ${expectedFt} ft`).toBe(expectedFt)
    }

    // Assert no devices on canvas
    if (assert.noDevices) {
      const deviceCount = objs.filter(o => o.type === 'device').length
      expect(deviceCount, 'Expected zero device objects on canvas').toBe(0)
    }

    // ── Visual snapshot ────────────────────────────────────────────────────────
    // Masks the status bar (cursor coords are dynamic) and the mini-map.
    // To regenerate baselines:
    //   STAGING_URL=http://localhost:5173 npx playwright test ta-scenarios \
    //     --project=local --update-snapshots
    await expect(page).toHaveScreenshot(`${scenario.id}.png`, {
      maxDiffPixelRatio: 0.02,
      // Mask the status bar (cursor coords change on hover); canvas is stable.
      mask: [page.getByTestId('status-bar')],
    })
  })
}
