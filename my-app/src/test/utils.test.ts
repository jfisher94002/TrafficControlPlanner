import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  dist,
  angleBetween,
  distToSegment,
  distToPolyline,
  sampleBezier,
  sampleCubicBezier,
  snapToEndpoint,
  geoRoadWidthPx,
  formatSearchPrimary,
  geocodeAddress,
  calcTaperLength,
  cloneObject,
  autoChannelize,
} from '../utils'
import type { CanvasObject, GeocodeResult, TaperObject, SignObject } from '../types'

// ─── dist ─────────────────────────────────────────────────────────────────────
describe('dist', () => {
  it('returns 5 for a 3-4-5 triangle', () => {
    expect(dist(0, 0, 3, 4)).toBe(5)
  })

  it('returns 0 for identical points', () => {
    expect(dist(7, 7, 7, 7)).toBe(0)
  })

  it('works with offset origin', () => {
    expect(dist(1, 1, 4, 5)).toBeCloseTo(5)
  })
})

// ─── angleBetween ─────────────────────────────────────────────────────────────
describe('angleBetween', () => {
  it('returns 0 for rightward direction', () => {
    expect(angleBetween(0, 0, 1, 0)).toBe(0)
  })

  it('returns π/2 for downward direction', () => {
    expect(angleBetween(0, 0, 0, 1)).toBeCloseTo(Math.PI / 2)
  })
})

// ─── distToSegment ────────────────────────────────────────────────────────────
describe('distToSegment', () => {
  it('returns 0 when point is on the midpoint of the segment', () => {
    expect(distToSegment(5, 0, 0, 0, 10, 0)).toBeCloseTo(0)
  })

  it('returns distance to nearest endpoint when point is beyond the segment', () => {
    // Point at (15,0), segment (0,0)-(10,0) → nearest endpoint is (10,0), dist=5
    expect(distToSegment(15, 0, 0, 0, 10, 0)).toBeCloseTo(5)
  })

  it('returns perpendicular distance for a point off the segment', () => {
    // Point at (5,3), segment (0,0)-(10,0) → perp dist = 3
    expect(distToSegment(5, 3, 0, 0, 10, 0)).toBeCloseTo(3)
  })

  it('handles zero-length segment (returns dist to endpoint)', () => {
    expect(distToSegment(3, 4, 0, 0, 0, 0)).toBeCloseTo(5)
  })
})

// ─── distToPolyline ───────────────────────────────────────────────────────────
describe('distToPolyline', () => {
  it('returns minimum distance across two segments', () => {
    const points = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }]
    // Point at (10, 5) — lies exactly on the second segment
    expect(distToPolyline(10, 5, points)).toBeCloseTo(0)
  })

  it('single segment behaves identically to distToSegment', () => {
    const points = [{ x: 0, y: 0 }, { x: 10, y: 0 }]
    expect(distToPolyline(5, 3, points)).toBeCloseTo(distToSegment(5, 3, 0, 0, 10, 0))
  })
})

// ─── sampleBezier ─────────────────────────────────────────────────────────────
describe('sampleBezier', () => {
  const p0 = { x: 0, y: 0 }
  const p1 = { x: 5, y: 10 }
  const p2 = { x: 10, y: 0 }
  const n = 4

  it('returns n+1 points', () => {
    expect(sampleBezier(p0, p1, p2, n)).toHaveLength(n + 1)
  })

  it('first point equals p0', () => {
    const pts = sampleBezier(p0, p1, p2, n)
    expect(pts[0]).toEqual(p0)
  })

  it('last point equals p2', () => {
    const pts = sampleBezier(p0, p1, p2, n)
    expect(pts[n]).toEqual(p2)
  })

  it('midpoint matches quadratic bezier formula at t=0.5', () => {
    // t=0.5, mt=0.5: x = 0.25*0 + 2*0.25*5 + 0.25*10 = 0 + 2.5 + 2.5 = 5
    const pts = sampleBezier(p0, p1, p2, 2)
    expect(pts[1].x).toBeCloseTo(5)
    expect(pts[1].y).toBeCloseTo(5)
  })
})

// ─── snapToEndpoint ───────────────────────────────────────────────────────────
describe('snapToEndpoint', () => {
  const roadObj: CanvasObject = {
    id: 'r1', type: 'road',
    x1: 0, y1: 0, x2: 100, y2: 0,
    width: 40, realWidth: 12, lanes: 2, roadType: '2lane',
  }
  const polyObj: CanvasObject = {
    id: 'p1', type: 'polyline_road',
    points: [{ x: 200, y: 200 }, { x: 300, y: 200 }],
    width: 40, realWidth: 12, lanes: 2, roadType: '2lane', smooth: false,
  }

  it('snaps to road endpoint within threshold', () => {
    const result = snapToEndpoint(5, 5, [roadObj], 14, 1)
    expect(result.snapped).toBe(true)
    expect(result.x).toBe(0)
    expect(result.y).toBe(0)
  })

  it('does not snap when outside threshold', () => {
    const result = snapToEndpoint(50, 50, [roadObj], 14, 1)
    expect(result.snapped).toBe(false)
    expect(result.x).toBe(50)
    expect(result.y).toBe(50)
  })

  it('snaps to polyline endpoint within threshold', () => {
    const result = snapToEndpoint(203, 203, [polyObj], 14, 1)
    expect(result.snapped).toBe(true)
    expect(result.x).toBe(200)
    expect(result.y).toBe(200)
  })

  it('snaps to cubic_bezier_road endpoint within threshold', () => {
    const cubicObj: CanvasObject = {
      id: 'cb1', type: 'cubic_bezier_road',
      points: [{ x: 400, y: 400 }, { x: 420, y: 380 }, { x: 480, y: 380 }, { x: 500, y: 400 }],
      width: 40, realWidth: 12, lanes: 2, roadType: '2lane',
    }
    const result = snapToEndpoint(503, 403, [cubicObj], 14, 1)
    expect(result.snapped).toBe(true)
    expect(result.x).toBe(500)
    expect(result.y).toBe(400)
  })
})

// ─── geoRoadWidthPx ──────────────────────────────────────────────────────────
describe('geoRoadWidthPx', () => {
  it('returns road.width when mapCenter is null', () => {
    expect(geoRoadWidthPx({ width: 80, realWidth: 22 }, null)).toBe(80)
  })

  it('returns road.width when realWidth is absent', () => {
    const center = { lat: 40, lon: -74, zoom: 15 }
    expect(geoRoadWidthPx({ width: 80 }, center)).toBe(80)
  })

  it('returns a value > 10 for a valid center and realWidth', () => {
    // zoom 18 → small meters-per-pixel → road renders wider than 10px
    const center = { lat: 40, lon: -74, zoom: 18 }
    const result = geoRoadWidthPx({ width: 80, realWidth: 22 }, center)
    expect(result).toBeGreaterThan(10)
  })
})

// ─── formatSearchPrimary ─────────────────────────────────────────────────────
describe('formatSearchPrimary', () => {
  it('formats full address with street and locality/state', () => {
    const result: GeocodeResult = {
      lat: '40', lon: '-74', display_name: 'Full Name',
      address: { house_number: '123', road: 'Main St', city: 'Springfield', state: 'IL' },
    }
    expect(formatSearchPrimary(result)).toBe('123 Main St, Springfield, IL')
  })

  it('falls back to display_name when address has no street', () => {
    const result: GeocodeResult = {
      lat: '40', lon: '-74', display_name: 'Some Place',
      address: {},
    }
    expect(formatSearchPrimary(result)).toBe('Some Place')
  })

  it('returns street alone when no locality or state', () => {
    const result: GeocodeResult = {
      lat: '40', lon: '-74', display_name: 'Ignored',
      address: { road: 'Oak Ave' },
    }
    expect(formatSearchPrimary(result)).toBe('Oak Ave')
  })
})

// ─── geocodeAddress ──────────────────────────────────────────────────────────
describe('geocodeAddress', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('returns mapped results on success', async () => {
    const mockData = [
      {
        lat: '40.7128',
        lon: '-74.0060',
        display_name: '123 Main St, New York, NY, USA',
        address: { house_number: '123', road: 'Main St', city: 'New York', state: 'NY' },
      },
    ]
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockData),
    }))
    const results = await geocodeAddress('123 Main St')
    expect(results).toHaveLength(1)
    expect(results[0].lat).toBe('40.7128')
    expect(results[0].lon).toBe('-74.0060')
    expect(results[0].address.road).toBe('Main St')
  })

  it('returns empty array when fetch throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')))
    const results = await geocodeAddress('anything')
    expect(results).toEqual([])
  })

  it('returns empty array when response is not ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))
    const results = await geocodeAddress('anything')
    expect(results).toEqual([])
  })

  it('returns empty array when response is not an array', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ error: 'Unable to geocode' }),
    }))
    const results = await geocodeAddress('anything')
    expect(results).toEqual([])
  })
})

// ─── calcTaperLength ──────────────────────────────────────────────────────────
describe('calcTaperLength', () => {
  it('uses L = WS²/60 for speed ≤ 45 (45 mph, 12 ft lane, 1 lane = 405 ft)', () => {
    expect(calcTaperLength(45, 12)).toBeCloseTo(405)
  })

  it('uses L = WS for speed > 45 (55 mph, 12 ft lane, 1 lane = 660 ft)', () => {
    expect(calcTaperLength(55, 12)).toBeCloseTo(660)
  })

  it('handles minimum inputs (25 mph, 10 ft lane, 1 lane ≈ 104.2 ft)', () => {
    expect(calcTaperLength(25, 10)).toBeCloseTo(104.2, 0)
  })

  it('boundary: 45 mph result is less than 46 mph result', () => {
    expect(calcTaperLength(45, 12)).toBeLessThan(calcTaperLength(46, 12))
  })

  it('uses total width W = laneWidth × numLanes for multi-lane closure (45 mph, 12 ft, 2 lanes = 810 ft)', () => {
    expect(calcTaperLength(45, 12, 2)).toBeCloseTo(810)
  })

  it('multi-lane > single-lane for same speed and lane width', () => {
    expect(calcTaperLength(55, 12, 2)).toBeGreaterThan(calcTaperLength(55, 12, 1))
  })
})

// ─── cloneObject ─────────────────────────────────────────────────────────────
describe('cloneObject', () => {
  it('assigns a new id', () => {
    const sign: CanvasObject = { id: 'orig', type: 'sign', x: 0, y: 0, signData: { id: 'stop', label: 'STOP', shape: 'octagon', color: '#f00', textColor: '#fff' }, rotation: 0, scale: 1 }
    const clone = cloneObject(sign)
    expect(clone.id).not.toBe('orig')
  })

  it('offsets x/y by 20 for a point object (sign)', () => {
    const sign: CanvasObject = { id: 'a', type: 'sign', x: 100, y: 200, signData: { id: 'stop', label: 'STOP', shape: 'octagon', color: '#f00', textColor: '#fff' }, rotation: 0, scale: 1 }
    const clone = cloneObject(sign) as typeof sign
    expect(clone.x).toBe(120)
    expect(clone.y).toBe(220)
  })

  it('respects custom dx/dy', () => {
    const sign: CanvasObject = { id: 'a', type: 'sign', x: 0, y: 0, signData: { id: 'stop', label: 'STOP', shape: 'octagon', color: '#f00', textColor: '#fff' }, rotation: 0, scale: 1 }
    const clone = cloneObject(sign, 5, 10) as typeof sign
    expect(clone.x).toBe(5)
    expect(clone.y).toBe(10)
  })

  it('offsets x1/y1/x2/y2 for a line object (road)', () => {
    const road: CanvasObject = { id: 'r', type: 'road', x1: 0, y1: 0, x2: 100, y2: 0, width: 80, realWidth: 22, lanes: 2, roadType: '2lane' }
    const clone = cloneObject(road) as typeof road
    expect(clone.x1).toBe(20); expect(clone.y1).toBe(20)
    expect(clone.x2).toBe(120); expect(clone.y2).toBe(20)
  })

  it('offsets all points for a polyline_road', () => {
    const poly: CanvasObject = { id: 'p', type: 'polyline_road', points: [{ x: 0, y: 0 }, { x: 10, y: 10 }], width: 80, realWidth: 22, lanes: 2, roadType: '2lane', smooth: false }
    const clone = cloneObject(poly) as typeof poly
    expect(clone.points[0]).toEqual({ x: 20, y: 20 })
    expect(clone.points[1]).toEqual({ x: 30, y: 30 })
  })

  it('does not mutate the original object', () => {
    const sign: CanvasObject = { id: 'a', type: 'sign', x: 10, y: 10, signData: { id: 'stop', label: 'STOP', shape: 'octagon', color: '#f00', textColor: '#fff' }, rotation: 0, scale: 1 }
    cloneObject(sign)
    expect((sign as typeof sign).x).toBe(10)
  })

  it('offsets all three control points for a curve_road', () => {
    const curve: CanvasObject = {
      id: 'c', type: 'curve_road',
      points: [{ x: 0, y: 0 }, { x: 50, y: -50 }, { x: 100, y: 0 }],
      width: 80, realWidth: 22, lanes: 2, roadType: '2lane',
    }
    const clone = cloneObject(curve) as typeof curve
    expect(clone.id).not.toBe('c')
    expect(clone.points[0]).toEqual({ x: 20, y: 20 })
    expect(clone.points[1]).toEqual({ x: 70, y: -30 })
    expect(clone.points[2]).toEqual({ x: 120, y: 20 })
  })

  it('deep-clones nested structures so signData is not shared', () => {
    const sign: CanvasObject = { id: 'a', type: 'sign', x: 0, y: 0, signData: { id: 'stop', label: 'STOP', shape: 'octagon', color: '#f00', textColor: '#fff' }, rotation: 0, scale: 1 }
    const clone = cloneObject(sign) as typeof sign
    clone.signData.label = 'MUTATED'
    expect((sign as typeof sign).signData.label).toBe('STOP')
  })

  it('offsets all four control points for a cubic_bezier_road', () => {
    const cubic: CanvasObject = {
      id: 'cb', type: 'cubic_bezier_road',
      points: [{ x: 0, y: 0 }, { x: 10, y: -20 }, { x: 90, y: -20 }, { x: 100, y: 0 }],
      width: 80, realWidth: 22, lanes: 2, roadType: '2lane',
    }
    const clone = cloneObject(cubic) as typeof cubic
    expect(clone.id).not.toBe('cb')
    expect(clone.points[0]).toEqual({ x: 20, y: 20 })
    expect(clone.points[1]).toEqual({ x: 30, y: 0 })
    expect(clone.points[2]).toEqual({ x: 110, y: 0 })
    expect(clone.points[3]).toEqual({ x: 120, y: 20 })
  })
})

// ─── sampleCubicBezier ────────────────────────────────────────────────────────
describe('sampleCubicBezier', () => {
  const p0 = { x: 0, y: 0 }
  const p1 = { x: 0, y: 100 }
  const p2 = { x: 100, y: 100 }
  const p3 = { x: 100, y: 0 }
  const n = 4

  it('returns n+1 points', () => {
    expect(sampleCubicBezier(p0, p1, p2, p3, n)).toHaveLength(n + 1)
  })

  it('first point equals p0', () => {
    const pts = sampleCubicBezier(p0, p1, p2, p3, n)
    expect(pts[0]).toEqual(p0)
  })

  it('last point equals p3', () => {
    const pts = sampleCubicBezier(p0, p1, p2, p3, n)
    expect(pts[n]).toEqual(p3)
  })

  it('midpoint matches cubic bezier formula at t=0.5', () => {
    // t=0.5, mt=0.5: x = 0.125*0 + 3*0.25*0.5*0 + 3*0.5*0.25*100 + 0.125*100
    //             x = 0 + 0 + 37.5 + 12.5 = 50
    // y = 0.125*0 + 3*0.25*0.5*100 + 3*0.5*0.25*100 + 0.125*0
    //             y = 0 + 37.5 + 37.5 + 0 = 75
    const pts = sampleCubicBezier(p0, p1, p2, p3, 2)
    expect(pts[1].x).toBeCloseTo(50)
    expect(pts[1].y).toBeCloseTo(75)
  })

  it('collinear control points yield a straight line at t=0.5', () => {
    // All four points on x-axis
    const a = { x: 0, y: 0 }, b = { x: 33, y: 0 }, c = { x: 67, y: 0 }, d = { x: 100, y: 0 }
    const pts = sampleCubicBezier(a, b, c, d, 2)
    expect(pts[1].y).toBeCloseTo(0)
    expect(pts[1].x).toBeCloseTo(50)
  })
})

// ─── autoChannelize ───────────────────────────────────────────────────────────
describe('autoChannelize', () => {
  function makeTaper(overrides: Partial<TaperObject> = {}): TaperObject {
    return {
      id: 'taper-1',
      type: 'taper',
      x: 500,
      y: 300,
      rotation: 0,
      laneWidth: 12,
      speed: 45,
      taperLength: 405,
      manualLength: false,
      numLanes: 1,
      ...overrides,
    }
  }

  it('returns 4 objects: 3 advance warning signs + 1 downstream taper', () => {
    const result = autoChannelize(makeTaper(), 500)
    expect(result).toHaveLength(4)
    expect(result.filter((o) => o.type === 'sign')).toHaveLength(3)
    expect(result.filter((o) => o.type === 'taper')).toHaveLength(1)
  })

  it('places signs with unique ids', () => {
    const result = autoChannelize(makeTaper(), 500)
    const ids = result.map((o) => o.id)
    expect(new Set(ids).size).toBe(4)
  })

  it('places advance signs upstream (lower x) of the taper for rotation=0', () => {
    const taper = makeTaper({ x: 500, y: 300, rotation: 0 })
    const signs = autoChannelize(taper, 500).filter((o) => o.type === 'sign') as SignObject[]
    for (const sign of signs) {
      expect(sign.x).toBeLessThan(taper.x)
    }
  })

  it('spaces signs at 200 ft apart (3 px/ft) for 45 mph', () => {
    // 45 mph → 200 ft spacing → 600 px
    const taper = makeTaper({ x: 1000, y: 0, rotation: 0, speed: 45 })
    const signs = autoChannelize(taper, 500)
      .filter((o) => o.type === 'sign') as SignObject[]
    // sorted nearest to farthest
    const xs = signs.map((s) => s.x).sort((a, b) => b - a)
    expect(xs[0]).toBeCloseTo(1000 - 600)
    expect(xs[1]).toBeCloseTo(1000 - 1200)
    expect(xs[2]).toBeCloseTo(1000 - 1800)
  })

  it('places downstream taper to the right of the work zone for rotation=0', () => {
    const taper = makeTaper({ x: 500, y: 300, rotation: 0, taperLength: 405 })
    const ds = autoChannelize(taper, 500).find((o) => o.type === 'taper') as TaperObject
    // Downstream taper should be to the right of the merge taper
    expect(ds.x).toBeGreaterThan(taper.x)
  })

  it('downstream taper rotation is 180° offset from merge taper', () => {
    const taper = makeTaper({ rotation: 45 })
    const ds = autoChannelize(taper, 500).find((o) => o.type === 'taper') as TaperObject
    expect(ds.rotation).toBe(225)
  })

  it('uses 100 ft spacing for speed ≤ 35 mph', () => {
    const taper = makeTaper({ x: 1000, y: 0, rotation: 0, speed: 30 })
    const signs = autoChannelize(taper, 500)
      .filter((o) => o.type === 'sign') as SignObject[]
    // 100 ft × 3 px/ft = 300 px
    const xs = signs.map((s) => s.x).sort((a, b) => b - a)
    expect(xs[0]).toBeCloseTo(1000 - 300)
  })

  it('uses 600 ft spacing for speed > 65 mph', () => {
    const taper = makeTaper({ x: 1000, y: 0, rotation: 0, speed: 70 })
    const signs = autoChannelize(taper, 500)
      .filter((o) => o.type === 'sign') as SignObject[]
    // 600 ft × 3 px/ft = 1800 px
    const xs = signs.map((s) => s.x).sort((a, b) => b - a)
    expect(xs[0]).toBeCloseTo(1000 - 1800)
  })

  it("accounts for rotation when placing upstream signs on driver's right", () => {
    const taper = makeTaper({ x: 400, y: 300, rotation: 90, speed: 45, laneWidth: 12, numLanes: 1 })
    const firstSign = autoChannelize(taper, 500).find((o) => o.type === 'sign') as SignObject
    // rotation=90°: x offset comes from lateral placement, y offset comes from upstream spacing
    expect(firstSign.x).toBeCloseTo(400 - (12 * 1 * 3) / 2 - 30)
    expect(firstSign.y).toBeCloseTo(300 - 600)
  })

  it('increases lateral sign offset when more lanes are closed', () => {
    const oneLane = makeTaper({ x: 800, y: 100, rotation: 0, laneWidth: 12, numLanes: 1 })
    const twoLanes = makeTaper({ x: 800, y: 100, rotation: 0, laneWidth: 12, numLanes: 2 })
    const oneLaneSign = autoChannelize(oneLane, 500).find((o) => o.type === 'sign') as SignObject
    const twoLaneSign = autoChannelize(twoLanes, 500).find((o) => o.type === 'sign') as SignObject
    // extra lane adds half-lane-width in lateral offset (12 ft * 3 px/ft / 2 = 18 px)
    expect(twoLaneSign.y - oneLaneSign.y).toBeCloseTo(18)
  })

  it('places downstream taper at exact merge+work+termination distance and copies key fields', () => {
    const taper = makeTaper({ x: 250, y: 75, rotation: 0, speed: 55, laneWidth: 12, taperLength: 660, numLanes: 2 })
    const workZoneLengthFt = 500
    const ds = autoChannelize(taper, workZoneLengthFt).find((o) => o.type === 'taper') as TaperObject
    const expectedTerminationLength = calcTaperLength(55, 12, 2)
    const expectedDx = (660 + workZoneLengthFt + expectedTerminationLength) * 3
    expect(ds.x).toBeCloseTo(250 + expectedDx)
    expect(ds.y).toBeCloseTo(75)
    expect(ds.speed).toBe(55)
    expect(ds.laneWidth).toBe(12)
    expect(ds.numLanes).toBe(2)
    expect(ds.manualLength).toBe(false)
    expect(ds.taperLength).toBe(expectedTerminationLength)
  })
})
