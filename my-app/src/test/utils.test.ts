import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  dist,
  angleBetween,
  distToSegment,
  distToPolyline,
  sampleBezier,
  snapToEndpoint,
  geoRoadWidthPx,
  formatSearchPrimary,
  geocodeAddress,
  calcTaperLength,
} from '../utils'
import type { CanvasObject, GeocodeResult } from '../types'

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
    const mockData = {
      candidates: [
        { address: '123 Main St', location: { x: -74, y: 40 } },
      ],
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockData),
    }))
    const results = await geocodeAddress('123 Main St')
    expect(results).toHaveLength(1)
    expect(results[0].lat).toBe('40')
    expect(results[0].lon).toBe('-74')
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
})

// ─── calcTaperLength ──────────────────────────────────────────────────────────
describe('calcTaperLength', () => {
  it('uses L = WS²/60 for speed ≤ 45 (45 mph, 12 ft lane = 405 ft)', () => {
    expect(calcTaperLength(45, 12)).toBeCloseTo(405)
  })

  it('uses L = WS for speed > 45 (55 mph, 12 ft lane = 660 ft)', () => {
    expect(calcTaperLength(55, 12)).toBeCloseTo(660)
  })

  it('handles minimum inputs (25 mph, 10 ft lane ≈ 104.2 ft)', () => {
    expect(calcTaperLength(25, 10)).toBeCloseTo(104.2, 0)
  })

  it('boundary: 45 mph result is less than 46 mph result', () => {
    expect(calcTaperLength(45, 12)).toBeLessThan(calcTaperLength(46, 12))
  })
})
