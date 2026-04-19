import { describe, it, expect } from 'vitest'
import {
  groundResolution,
  buildGeoContext,
  planToScreen,
  screenToPlan,
  worldToPlan,
  planToWorld,
  planToGeo,
  geoToPlan,
  type ViewportState,
  type PlanPt,
  type WorldPt,
} from '../coordinate-bridge'

const SF_LAT = 37.7749
const SF_LNG = -122.4194

const GEO = buildGeoContext(
  { lat: SF_LAT, lng: SF_LNG },
  17,
  { w: 800, h: 600 },
)

const VP_IDENTITY: ViewportState = { offsetX: 0, offsetY: 0, zoom: 1 }

// ─── groundResolution ─────────────────────────────────────────────────────────

describe('groundResolution', () => {
  it('returns ~0.944 m/px at zoom 17, lat 37.7749 (Web Mercator reference)', () => {
    // (2π × 6_378_137) / (256 × 2^17) × cos(37.7749° × π/180) ≈ 0.9440
    expect(groundResolution(17, SF_LAT)).toBeCloseTo(0.944, 2)
  })

  it('clamps zoom below 1 to 1', () => {
    expect(groundResolution(0, SF_LAT)).toBe(groundResolution(1, SF_LAT))
    expect(groundResolution(-5, SF_LAT)).toBe(groundResolution(1, SF_LAT))
  })

  it('clamps zoom above 20 to 20', () => {
    expect(groundResolution(21, SF_LAT)).toBe(groundResolution(20, SF_LAT))
    expect(groundResolution(100, SF_LAT)).toBe(groundResolution(20, SF_LAT))
  })

  it('increases at lower zoom levels (more meters per pixel)', () => {
    expect(groundResolution(10, SF_LAT)).toBeGreaterThan(groundResolution(17, SF_LAT))
  })
})

// ─── buildGeoContext ──────────────────────────────────────────────────────────

describe('buildGeoContext', () => {
  it('sets originScreenPx to canvas center', () => {
    const geo = buildGeoContext({ lat: SF_LAT, lng: SF_LNG }, 17, { w: 1024, h: 768 })
    expect(geo.originScreenPx).toEqual({ x: 512, y: 384 })
  })

  it('sets crs to EPSG:3857', () => {
    expect(GEO.crs).toBe('EPSG:3857')
  })

  it('stores mapCenter and mapZoom', () => {
    expect(GEO.mapCenter).toEqual({ lat: SF_LAT, lng: SF_LNG })
    expect(GEO.mapZoom).toBe(17)
  })
})

// ─── planToScreen / screenToPlan round-trip ───────────────────────────────────

describe('planToScreen / screenToPlan round-trip', () => {
  const pts: PlanPt[] = [
    { x: 0, y: 0 },
    { x: 100, y: 50 },
    { x: -200, y: -100 },
    { x: 0.001, y: -0.001 },
  ]

  for (const pt of pts) {
    it(`round-trips ${JSON.stringify(pt)} within 0.001 m`, () => {
      const screen = planToScreen(pt, VP_IDENTITY, GEO)
      const back = screenToPlan(screen, VP_IDENTITY, GEO)
      expect(back.x).toBeCloseTo(pt.x, 3)
      expect(back.y).toBeCloseTo(pt.y, 3)
    })
  }

  it('origin (0, 0) maps to originScreenPx with identity viewport', () => {
    const screen = planToScreen({ x: 0, y: 0 }, VP_IDENTITY, GEO)
    expect(screen.x).toBeCloseTo(GEO.originScreenPx.x, 3)
    expect(screen.y).toBeCloseTo(GEO.originScreenPx.y, 3)
  })

  it('positive planY maps to screen Y below originScreenPx (canvas +Y down)', () => {
    const above = planToScreen({ x: 0, y: 100 }, VP_IDENTITY, GEO)
    expect(above.y).toBeLessThan(GEO.originScreenPx.y)
  })
})

// ─── worldToPlan / planToWorld round-trip ─────────────────────────────────────

describe('worldToPlan / planToWorld round-trip', () => {
  const vp: ViewportState = { offsetX: 50, offsetY: -30, zoom: 1.5 }

  const pts: WorldPt[] = [
    { x: 0, y: 0 },
    { x: 100, y: 200 },
    { x: -50, y: -75 },
  ]

  for (const pt of pts) {
    it(`round-trips world pt ${JSON.stringify(pt)} within 0.001 m`, () => {
      const plan = worldToPlan(pt, vp, GEO)
      const back = planToWorld(plan, vp, GEO)
      expect(back.x).toBeCloseTo(pt.x, 3)
      expect(back.y).toBeCloseTo(pt.y, 3)
    })
  }

  it('identity viewport: world (0,0) maps to same plan coords as screen origin → plan', () => {
    const worldOriginPlan = worldToPlan({ x: 0, y: 0 }, VP_IDENTITY, GEO)
    const screenOriginPlan = screenToPlan({ x: 0, y: 0 }, VP_IDENTITY, GEO)
    expect(worldOriginPlan.x).toBeCloseTo(screenOriginPlan.x, 6)
    expect(worldOriginPlan.y).toBeCloseTo(screenOriginPlan.y, 6)
  })
})

// ─── planToGeo / geoToPlan round-trip ────────────────────────────────────────

describe('planToGeo / geoToPlan round-trip', () => {
  const pts: PlanPt[] = [
    { x: 0, y: 0 },
    { x: 500, y: 300 },
    { x: -1000, y: -800 },
    { x: 0.5, y: -0.5 },
  ]

  for (const pt of pts) {
    it(`round-trips ${JSON.stringify(pt)} within 0.001 m`, () => {
      const ll = planToGeo(pt, GEO)
      const back = geoToPlan(ll, GEO)
      expect(back.x).toBeCloseTo(pt.x, 3)
      expect(back.y).toBeCloseTo(pt.y, 3)
    })
  }

  it('plan origin (0,0) maps to mapCenter lat/lng', () => {
    const ll = planToGeo({ x: 0, y: 0 }, GEO)
    expect(ll.lat).toBeCloseTo(SF_LAT, 6)
    expect(ll.lng).toBeCloseTo(SF_LNG, 6)
  })

  it('positive x (east) increases longitude', () => {
    const ll = planToGeo({ x: 1000, y: 0 }, GEO)
    expect(ll.lng).toBeGreaterThan(SF_LNG)
  })

  it('positive y (north) increases latitude', () => {
    const ll = planToGeo({ x: 0, y: 1000 }, GEO)
    expect(ll.lat).toBeGreaterThan(SF_LAT)
  })
})

// ─── Edge cases ───────────────────────────────────────────────────────────────

describe('edge cases', () => {
  it('works at zoom 1', () => {
    const geo = buildGeoContext({ lat: SF_LAT, lng: SF_LNG }, 1, { w: 800, h: 600 })
    const pt: PlanPt = { x: 100, y: 50 }
    const back = screenToPlan(planToScreen(pt, VP_IDENTITY, geo), VP_IDENTITY, geo)
    expect(back.x).toBeCloseTo(pt.x, 3)
    expect(back.y).toBeCloseTo(pt.y, 3)
  })

  it('works at zoom 20', () => {
    const geo = buildGeoContext({ lat: SF_LAT, lng: SF_LNG }, 20, { w: 800, h: 600 })
    const pt: PlanPt = { x: 1, y: -1 }
    const back = screenToPlan(planToScreen(pt, VP_IDENTITY, geo), VP_IDENTITY, geo)
    expect(back.x).toBeCloseTo(pt.x, 3)
    expect(back.y).toBeCloseTo(pt.y, 3)
  })

  it('negative plan coords round-trip correctly', () => {
    const pt: PlanPt = { x: -500, y: -300 }
    const screen = planToScreen(pt, VP_IDENTITY, GEO)
    const back = screenToPlan(screen, VP_IDENTITY, GEO)
    expect(back.x).toBeCloseTo(pt.x, 3)
    expect(back.y).toBeCloseTo(pt.y, 3)
  })

  it('non-zero viewport zoom + offset round-trip', () => {
    const vp: ViewportState = { offsetX: -123, offsetY: 456, zoom: 2.5 }
    const pt: WorldPt = { x: 300, y: -150 }
    const plan = worldToPlan(pt, vp, GEO)
    const back = planToWorld(plan, vp, GEO)
    expect(back.x).toBeCloseTo(pt.x, 3)
    expect(back.y).toBeCloseTo(pt.y, 3)
  })
})
