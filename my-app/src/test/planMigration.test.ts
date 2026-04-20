import { describe, it, expect, vi } from 'vitest'
import { detectSchemaVersion, v2ToWorldCoords } from '../planMigration'
import { buildGeoContext, worldToPlan, type ViewportState } from '../coordinate-bridge'

// Shared test parameters
const MAP_CENTER = { lat: 37.7749, lng: -122.4194 }
const MAP_ZOOM = 17
const CANVAS_SIZE = { w: 800, h: 600 }
const VIEWPORT: ViewportState = { offsetX: 0, offsetY: 0, zoom: 1 }

const GEO = buildGeoContext(MAP_CENTER, MAP_ZOOM, CANVAS_SIZE)

function makeV2Plan(objects: Record<string, unknown>[], viewport = VIEWPORT) {
  return {
    _schemaVersion: 2,
    geoContext: GEO,
    canvasOffset: { x: viewport.offsetX, y: viewport.offsetY },
    canvasZoom: viewport.zoom,
    canvasState: { objects },
  }
}

function makeV1Plan(objects: Record<string, unknown>[]) {
  return {
    _schemaVersion: 1,
    canvasState: { objects },
  }
}

// ─── detectSchemaVersion ──────────────────────────────────────────────────────

describe('detectSchemaVersion', () => {
  it('returns 2 for a plan with _schemaVersion=2 and geoContext', () => {
    expect(detectSchemaVersion(makeV2Plan([]))).toBe(2)
  })

  it('returns 1 for a plan with _schemaVersion=1', () => {
    expect(detectSchemaVersion(makeV1Plan([]))).toBe(1)
  })

  it('returns 1 for a plan with no _schemaVersion', () => {
    expect(detectSchemaVersion({ canvasState: { objects: [] } })).toBe(1)
  })

  it('returns 1 for a plan with _schemaVersion=2 but no geoContext, and warns', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(detectSchemaVersion({ _schemaVersion: 2, canvasState: { objects: [] } })).toBe(1)
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('invalid or missing geoContext'), undefined)
    warnSpy.mockRestore()
  })

  it('returns 1 for a plan with _schemaVersion=2 but geoContext missing mapCenter, and warns', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(detectSchemaVersion({ _schemaVersion: 2, geoContext: { mapZoom: 17 } })).toBe(1)
    expect(warnSpy).toHaveBeenCalled()
    warnSpy.mockRestore()
  })

  it('returns 1 for a plan with _schemaVersion=2 but NaN in geoContext, and warns', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(detectSchemaVersion({
      _schemaVersion: 2,
      geoContext: { mapCenter: { lat: NaN, lng: -122 }, mapZoom: 17 },
    })).toBe(1)
    expect(warnSpy).toHaveBeenCalled()
    warnSpy.mockRestore()
  })
})

// ─── Fixture 1: v2 load → world coords (sign with x/y) ───────────────────────

describe('v2ToWorldCoords — Fixture 1: sign (x/y point)', () => {
  it('converts a known plan-space sign position to expected world coords within 1 px', () => {
    // Place a sign at world (200, 150) and record its plan-space coords
    const worldPt = { x: 200, y: 150 }
    const planPt = worldToPlan(worldPt, VIEWPORT, GEO)

    const plan = makeV2Plan([{ type: 'sign', id: '1', x: planPt.x, y: planPt.y }])
    const { plan: out, stats } = v2ToWorldCoords(plan, CANVAS_SIZE)

    const objs = (out.canvasState as { objects: Record<string, unknown>[] }).objects
    expect(objs[0].x as number).toBeCloseTo(worldPt.x, 0)
    expect(objs[0].y as number).toBeCloseTo(worldPt.y, 0)
    expect(stats.convertedCount).toBe(1)
    expect(stats.skippedCount).toBe(0)
  })
})

// ─── Fixture 2: v2 load → world coords (road with points array) ──────────────

describe('v2ToWorldCoords — Fixture 2: road with polyline points', () => {
  it('converts all polyline points correctly (Point[] format)', () => {
    const worldPts = [{ x: 100, y: 200 }, { x: 300, y: 400 }, { x: 500, y: 600 }]
    const planPts = worldPts.map(p => worldToPlan(p, VIEWPORT, GEO))  // Array<{x,y}>

    const plan = makeV2Plan([{ type: 'polyline_road', id: '2', points: planPts }])
    const { plan: out, stats } = v2ToWorldCoords(plan, CANVAS_SIZE)

    const objs = (out.canvasState as { objects: Record<string, unknown>[] }).objects
    const outPts = objs[0].points as { x: number; y: number }[]
    for (let i = 0; i < worldPts.length; i++) {
      expect(outPts[i].x).toBeCloseTo(worldPts[i].x, 0)
      expect(outPts[i].y).toBeCloseTo(worldPts[i].y, 0)
    }
    expect(stats.convertedCount).toBe(1)
    expect(stats.skippedCount).toBe(0)
  })

  it('converts x1/y1/x2/y2 straight road correctly', () => {
    const w1 = { x: 50, y: 100 }
    const w2 = { x: 400, y: 300 }
    const p1 = worldToPlan(w1, VIEWPORT, GEO)
    const p2 = worldToPlan(w2, VIEWPORT, GEO)

    const plan = makeV2Plan([{ type: 'road', id: '3', x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y }])
    const { plan: out, stats } = v2ToWorldCoords(plan, CANVAS_SIZE)

    const objs = (out.canvasState as { objects: Record<string, unknown>[] }).objects
    expect(objs[0].x1 as number).toBeCloseTo(w1.x, 0)
    expect(objs[0].y1 as number).toBeCloseTo(w1.y, 0)
    expect(objs[0].x2 as number).toBeCloseTo(w2.x, 0)
    expect(objs[0].y2 as number).toBeCloseTo(w2.y, 0)
    expect(stats.convertedCount).toBe(1)
    expect(stats.skippedCount).toBe(0)
  })
})

// ─── Fixture 3: v1 pass-through ───────────────────────────────────────────────

describe('v2ToWorldCoords — Fixture 3: v1 plan pass-through', () => {
  it('returns v1 plan unchanged', () => {
    const objects = [{ type: 'sign', id: '3', x: 100, y: 200 }]
    const plan = makeV1Plan(objects)
    const { plan: out, stats } = v2ToWorldCoords(plan, CANVAS_SIZE)

    const objs = (out.canvasState as { objects: Record<string, unknown>[] }).objects
    expect(objs[0].x).toBe(100)
    expect(objs[0].y).toBe(200)
    expect(stats.convertedCount).toBe(0)
    expect(stats.skippedCount).toBe(0)
    expect(stats.objectCount).toBe(1)
  })
})

// ─── Fixture 4: round-trip world → save v2 plan → load v2 → world ────────────

describe('v2ToWorldCoords — Fixture 4: full round-trip', () => {
  it('world → buildGeoContext + plan coords → v2ToWorldCoords → world within 1 px', () => {
    const worldPt = { x: 350, y: 275 }
    const planPt = worldToPlan(worldPt, VIEWPORT, GEO)

    // Simulate what handleCloudSave writes: plan-space coords + geoContext
    const saved = makeV2Plan([{ type: 'device', id: '4', x: planPt.x, y: planPt.y }])

    // Simulate load path
    const { plan: loaded } = v2ToWorldCoords(saved, CANVAS_SIZE)

    const objs = (loaded.canvasState as { objects: Record<string, unknown>[] }).objects
    expect(objs[0].x as number).toBeCloseTo(worldPt.x, 0)
    expect(objs[0].y as number).toBeCloseTo(worldPt.y, 0)
  })

  it('round-trips cubic bezier road (points array format) within 1 px', () => {
    // CubicBezierRoadObject uses points: [p0, cp1, cp2, p3] — same Point[] serialization
    const worldPts = [
      { x: 100, y: 100 },  // p0 start
      { x: 200, y: 50 },   // cp1
      { x: 400, y: 350 },  // cp2
      { x: 500, y: 300 },  // p3 end
    ]
    const planPts = worldPts.map(p => worldToPlan(p, VIEWPORT, GEO))

    const saved = makeV2Plan([{
      type: 'cubic_bezier_road',
      id: '5',
      points: planPts,
    }])

    const { plan: loaded } = v2ToWorldCoords(saved, CANVAS_SIZE)
    const obj = (loaded.canvasState as { objects: Record<string, unknown>[] }).objects[0]
    const outPts = obj.points as { x: number; y: number }[]

    for (let i = 0; i < worldPts.length; i++) {
      expect(outPts[i].x).toBeCloseTo(worldPts[i].x, 0)
      expect(outPts[i].y).toBeCloseTo(worldPts[i].y, 0)
    }
  })
})

// ─── Skipped objects ──────────────────────────────────────────────────────────

describe('v2ToWorldCoords — skipped objects', () => {
  it('counts objects with unrecognised coord shape in skippedCount and emits one aggregated warn', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const plan = makeV2Plan([
      { type: 'sign', id: 'a', x: 0, y: 0 },            // converted
      { type: 'unknown', id: 'b', someField: 'value' },   // skipped
      { type: 'unknown', id: 'c', otherField: 123 },      // skipped
    ])
    const { stats } = v2ToWorldCoords(plan, CANVAS_SIZE)
    expect(stats.convertedCount).toBe(1)
    expect(stats.skippedCount).toBe(2)
    // Only one aggregated warning, not one per object
    expect(warnSpy).toHaveBeenCalledTimes(1)
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('2 object(s)'),
      expect.arrayContaining(['b', 'c']),
    )
    warnSpy.mockRestore()
  })
})

// ─── resolveViewport defaults ─────────────────────────────────────────────────

describe('v2ToWorldCoords — resolveViewport defaults', () => {
  it('uses offset={0,0} and zoom=1 when canvasOffset and canvasZoom are absent', () => {
    const worldPt = { x: 200, y: 150 }
    const planPt = worldToPlan(worldPt, VIEWPORT, GEO)  // VIEWPORT is identity

    // Build a v2 plan with no canvasOffset / canvasZoom fields
    const plan: Record<string, unknown> = {
      _schemaVersion: 2,
      geoContext: GEO,
      // canvasOffset omitted
      // canvasZoom omitted
      canvasState: { objects: [{ type: 'sign', id: 'x', x: planPt.x, y: planPt.y }] },
    }

    const { plan: out, stats } = v2ToWorldCoords(plan, CANVAS_SIZE)
    const objs = (out.canvasState as { objects: Record<string, unknown>[] }).objects
    // With default offset=(0,0) zoom=1, should round-trip to original world coords
    expect(objs[0].x as number).toBeCloseTo(worldPt.x, 0)
    expect(objs[0].y as number).toBeCloseTo(worldPt.y, 0)
    expect(stats.convertedCount).toBe(1)
  })
})
