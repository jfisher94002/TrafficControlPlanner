/**
 * MUTCD TA Scenario automation suite.
 *
 * Each test seeds the canvas via window.__tcpSeed() (or ?seed= URL param),
 * then asserts that the required objects are present without manual clicking.
 *
 * Scenarios covered:
 *   TA-1   Work Beyond the Shoulder
 *   TA-3   Work on the Shoulder
 *   TA-6   Shoulder Work with Minor Encroachment
 *   TA-10  Lane Closure using Flaggers
 *   TA-11  Lane Closure with Low Traffic Volumes
 *   TA-12  Lane Closure using Traffic Control Signals
 *   TA-21  Lane Closure on Near Side of Intersection
 *   TA-22  Right Lane Closure on Far Side of Intersection
 *   TA-33  Stationary Lane Closure on a Divided Highway
 *   TA-37  Double Lane Closure on a Freeway
 *   TA-101 Right Lane + Bike Lane Closure (CA)
 *
 * Holes flagged as TODO are tracked in:
 *   #323 Shoulder rendering
 *   #324 Arrow Board modes
 *   #325 Bike lane road type
 */

import { test, expect, type Page } from '@playwright/test'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MAP_CENTER = { lat: 37.7749, lon: -122.4194, zoom: 16 }

/** Seed the canvas and navigate to /app, waiting for stage to be ready. */
async function seedAndLoad(page: Page, seed: Record<string, unknown>) {
  const encoded = Buffer.from(JSON.stringify(seed)).toString('base64')
  await page.goto(`/app?seed=${encoded}`)
  await expect(page.getByTestId('canvas-container')).toBeVisible({ timeout: 20_000 })
}

type CanvasObj = { type: string; signData?: { id: string }; deviceData?: { id: string }; taperLength?: number }

/** Returns live canvas objects via window.__tcpGetObjects (set by the planner on every render). */
async function getObjects(page: Page): Promise<CanvasObj[]> {
  return page.evaluate(() => {
    const fn = (window as unknown as Record<string, unknown>).__tcpGetObjects
    return typeof fn === 'function' ? (fn as () => CanvasObj[])() : []
  })
}

/** Returns all object types currently on the canvas. */
async function getObjectTypes(page: Page): Promise<string[]> {
  return (await getObjects(page)).map(o => o.type)
}

/** Asserts the canvas contains at least one object of each given type. */
async function expectObjectTypes(page: Page, ...types: string[]) {
  const found = await getObjectTypes(page)
  for (const t of types) {
    expect(found, `Expected canvas to contain a "${t}" object`).toContain(t)
  }
}

/** Assert at least one sign with the given signData.id exists on canvas. */
async function expectSign(page: Page, signId: string) {
  const objs = await getObjects(page)
  const found = objs.some(o => o.type === 'sign' && o.signData?.id === signId)
  expect(found, `Expected sign "${signId}" on canvas`).toBe(true)
}

/** Assert at least one device with the given deviceData.id exists on canvas. */
async function expectDevice(page: Page, deviceId: string) {
  const objs = await getObjects(page)
  const found = objs.some(o => o.type === 'device' && o.deviceData?.id === deviceId)
  expect(found, `Expected device "${deviceId}" on canvas`).toBe(true)
}

// ─── Shared sign fixtures ──────────────────────────────────────────────────────

const sign = (id: string, x: number, y: number, mutcd?: string) => ({
  id: `sign-${id}-${x}`,
  type: 'sign',
  x, y, rotation: 0, scale: 1,
  signData: { id, label: id.toUpperCase(), shape: 'diamond', color: '#f97316', textColor: '#111', ...(mutcd ? { mutcd } : {}) },
})

const taper = (id: string, x: number, y: number, speed = 45, laneWidth = 12, numLanes = 1) => ({
  id, type: 'taper', x, y, rotation: 0,
  speed, laneWidth, taperLength: laneWidth * speed, manualLength: false, numLanes,
})

const device = (id: string, deviceId: string, x: number, y: number) => ({
  id, type: 'device', x, y, rotation: 0, scale: 1,
  deviceData: { id: deviceId, label: deviceId, icon: '▣', color: '#fbbf24' },
})

const zone = (id: string, x: number, y: number, w = 300, h = 60) => ({
  id, type: 'zone', x, y, w, h,
})

// ─── TA-1: Work Beyond the Shoulder ───────────────────────────────────────────

test('TA-1: Work beyond shoulder — shoulder work sign, no taper required', async ({ page }) => {
  await seedAndLoad(page, {
    mapCenter: MAP_CENTER,
    objects: [
      sign('shoulderwork', 100, 200, 'W21-5a'),
      sign('roadwork', 200, 200, 'W20-1'),
    ],
  })
  await expectSign(page, 'shoulderwork')
  await expectSign(page, 'roadwork')
  // TODO #323: assert shoulder rendered on road object once shoulder rendering is implemented
})

// ─── TA-3: Work on the Shoulder ───────────────────────────────────────────────

test('TA-3: Work on shoulder — shoulder taper + shoulder work signs', async ({ page }) => {
  await seedAndLoad(page, {
    mapCenter: MAP_CENTER,
    objects: [
      sign('shoulderwork', 100, 200, 'W21-5a'),
      sign('roadwork', 250, 200, 'W20-1'),
      taper('taper-1', 400, 300),
      zone('zone-1', 550, 270),
    ],
  })
  await expectSign(page, 'shoulderwork')
  await expectSign(page, 'roadwork')
  await expectObjectTypes(page, 'taper', 'zone')
  // TODO #323: verify shoulder width property on taper
})

// ─── TA-6: Shoulder Work with Minor Encroachment ──────────────────────────────

test('TA-6: Shoulder + minor encroachment — taper + shift geometry', async ({ page }) => {
  await seedAndLoad(page, {
    mapCenter: MAP_CENTER,
    objects: [
      sign('shoulderwork', 100, 200, 'W21-5a'),
      sign('roadwork', 200, 200, 'W20-1'),
      sign('merge', 350, 200, 'W4-2'),
      taper('taper-1', 500, 300),
      zone('zone-1', 650, 270),
    ],
  })
  await expectSign(page, 'shoulderwork')
  await expectSign(page, 'merge')
  await expectObjectTypes(page, 'taper')
})

// ─── TA-10: Lane Closure using Flaggers ───────────────────────────────────────

test('TA-10: Lane closure with flaggers — flagger device, flagger ahead + one lane signs', async ({ page }) => {
  await seedAndLoad(page, {
    mapCenter: MAP_CENTER,
    objects: [
      // Advance warning signs at 500ft intervals
      sign('roadwork',     100, 300, 'W20-1'),
      sign('flaggerahead', 300, 300, 'W20-7a'),
      sign('onelane',      500, 300, 'W20-4a'),
      // Taper
      taper('taper-1', 700, 300),
      // Work zone
      zone('zone-1', 900, 270),
      // Flagger devices at each end of work zone
      device('flagger-1', 'flagger', 880, 300),
      device('flagger-2', 'flagger', 1200, 300),
    ],
  })
  await expectSign(page, 'roadwork')
  await expectSign(page, 'flaggerahead')
  await expectSign(page, 'onelane')
  await expectDevice(page, 'flagger')
  await expectObjectTypes(page, 'taper', 'zone')
})

// ─── TA-11: Lane Closure with Low Traffic Volumes ─────────────────────────────

test('TA-11: Lane closure low volume — taper only, no devices', async ({ page }) => {
  await seedAndLoad(page, {
    mapCenter: MAP_CENTER,
    objects: [
      sign('roadwork', 100, 300, 'W20-1'),
      sign('onelane',  300, 300, 'W20-4a'),
      taper('taper-1', 500, 300),
      zone('zone-1',   700, 270),
    ],
  })
  await expectSign(page, 'roadwork')
  await expectSign(page, 'onelane')
  await expectObjectTypes(page, 'taper', 'zone')

  // No flagger devices required for low volume
  const objs = await getObjects(page)
  expect(objs.filter(o => o.type === 'device').length).toBe(0)
})

// ─── TA-12: Lane Closure using Traffic Control Signals ────────────────────────

test('TA-12: Lane closure with signals — temp signal device at each end', async ({ page }) => {
  await seedAndLoad(page, {
    mapCenter: MAP_CENTER,
    objects: [
      sign('roadwork', 100, 300, 'W20-1'),
      sign('signal',   300, 300, 'W3-3'),
      taper('taper-1', 500, 300),
      zone('zone-1',   700, 270),
      device('sig-1', 'temp_signal', 690, 300),
      device('sig-2', 'temp_signal', 1100, 300),
    ],
  })
  await expectSign(page, 'signal')
  await expectDevice(page, 'temp_signal')
  await expectObjectTypes(page, 'taper', 'zone')

  // Must have at least 2 signal devices
  const objs = await getObjects(page)
  const sigCount = objs.filter(o => o.type === 'device' && o.deviceData?.id === 'temp_signal').length
  expect(sigCount).toBeGreaterThanOrEqual(2)
})

// ─── TA-21: Lane Closure Near Side of Intersection ────────────────────────────

test('TA-21: Near-side intersection lane closure — taper before intersection', async ({ page }) => {
  await seedAndLoad(page, {
    mapCenter: MAP_CENTER,
    objects: [
      sign('roadwork', 100, 300, 'W20-1'),
      sign('merge',    300, 300, 'W4-2'),
      taper('taper-1', 500, 300),
      zone('zone-1',   700, 270),
    ],
  })
  await expectSign(page, 'roadwork')
  await expectObjectTypes(page, 'taper', 'zone')
})

// ─── TA-22: Right Lane Closure Far Side of Intersection ───────────────────────

test('TA-22: Far-side right lane closure — taper past intersection', async ({ page }) => {
  await seedAndLoad(page, {
    mapCenter: MAP_CENTER,
    objects: [
      sign('roadwork',    100, 300, 'W20-1'),
      sign('rightlaneends', 300, 300, 'W9-1'),
      taper('taper-1', 600, 300),
      zone('zone-1',   800, 270),
    ],
  })
  await expectSign(page, 'roadwork')
  await expectSign(page, 'rightlaneends')
  await expectObjectTypes(page, 'taper', 'zone')
})

// ─── TA-33: Stationary Lane Closure on Divided Highway ────────────────────────

test('TA-33: Divided highway lane closure — long taper (L=W×S) + arrow board', async ({ page }) => {
  // At 65 mph, lane 12ft wide: L = 12 × 65 = 780 ft
  const speed = 65
  const laneWidth = 12
  const expectedTaperLength = laneWidth * speed

  await seedAndLoad(page, {
    mapCenter: MAP_CENTER,
    objects: [
      sign('roadwork',    100, 300, 'W20-1'),
      sign('merge',       400, 300, 'W4-2'),
      { ...taper('taper-1', 700, 300, speed, laneWidth), taperLength: expectedTaperLength },
      zone('zone-1', 1000, 270),
      device('ab-1', 'arrow_board', 980, 300),
    ],
  })

  await expectSign(page, 'roadwork')
  await expectDevice(page, 'arrow_board')
  await expectObjectTypes(page, 'taper', 'zone')

  // Verify taper length matches formula L = W × S
  const objs = await getObjects(page)
  const t = objs.find(o => o.type === 'taper')
  expect(t?.taperLength, `Expected taper length ${expectedTaperLength} ft`).toBe(expectedTaperLength)

  // TODO #324: assert arrow_board.mode === 'right' once Arrow Board modes are implemented
})

// ─── TA-37: Double Lane Closure on a Freeway ──────────────────────────────────

test('TA-37: Double lane freeway closure — two tapers, two arrow boards', async ({ page }) => {
  await seedAndLoad(page, {
    mapCenter: MAP_CENTER,
    objects: [
      sign('roadwork', 100, 300, 'W20-1'),
      sign('merge',    400, 300, 'W4-2'),
      taper('taper-1', 700, 300, 65, 12, 2),
      taper('taper-2', 900, 300, 65, 12, 1),
      zone('zone-1',  1100, 270),
      device('ab-1', 'arrow_board', 680, 300),
      device('ab-2', 'arrow_board', 880, 300),
    ],
  })

  await expectObjectTypes(page, 'taper', 'zone')
  await expectDevice(page, 'arrow_board')

  // Must have at least 2 tapers and 2 arrow boards
  const allObjs = await getObjects(page)
  expect(allObjs.filter(o => o.type === 'taper').length).toBeGreaterThanOrEqual(2)
  expect(allObjs.filter(o => o.type === 'device' && o.deviceData?.id === 'arrow_board').length).toBeGreaterThanOrEqual(2)
})

// ─── TA-101(CA): Right Lane + Bike Lane Closure ───────────────────────────────

test('TA-101(CA): Right lane + bike lane closure — bike lane closed sign', async ({ page }) => {
  await seedAndLoad(page, {
    mapCenter: MAP_CENTER,
    objects: [
      sign('roadwork',     100, 300, 'W20-1'),
      sign('bikelaneclosed', 300, 300, 'R9-10a'),
      sign('rightlaneends',  500, 300, 'W9-1'),
      taper('taper-1', 700, 300),
      zone('zone-1',   900, 270),
    ],
  })

  await expectSign(page, 'bikelaneclosed')
  await expectSign(page, 'rightlaneends')
  await expectObjectTypes(page, 'taper', 'zone')

  // TODO #325: assert a bike_lane road type object exists once bike lane drawing is implemented
})
