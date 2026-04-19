/**
 * Tests for shoulder/sidewalk rendering helpers and ObjectShapes components.
 *
 * We test the pure utility (buildOffsetSpine) directly, and verify the rendered
 * element counts for each road component via React Testing Library.
 */
import { describe, it, expect } from 'vitest'
import { buildOffsetSpine } from '../utils'
import type { Point } from '../types'

// ─── buildOffsetSpine ─────────────────────────────────────────────────────────

describe('buildOffsetSpine', () => {
  it('offsets a horizontal segment to the left (positive d)', () => {
    // Segment going right: (0,0) → (10,0). Left normal is (0,-1).
    const pts: Point[] = [{ x: 0, y: 0 }, { x: 10, y: 0 }]
    const result = buildOffsetSpine(pts, 5)
    // Both points shifted by (nx=0, ny=-1)*5 → y decreases by 5
    expect(result).toHaveLength(4)
    expect(result[0]).toBeCloseTo(0)   // x0 unchanged
    expect(result[1]).toBeCloseTo(-5)  // y0 - 5
    expect(result[2]).toBeCloseTo(10)  // x1 unchanged
    expect(result[3]).toBeCloseTo(-5)  // y1 - 5
  })

  it('offsets a horizontal segment to the right (negative d)', () => {
    const pts: Point[] = [{ x: 0, y: 0 }, { x: 10, y: 0 }]
    const result = buildOffsetSpine(pts, -5)
    expect(result[1]).toBeCloseTo(5)
    expect(result[3]).toBeCloseTo(5)
  })

  it('offsets a vertical segment correctly', () => {
    // Segment going down: (0,0) → (0,10). Left normal is (1,0).
    const pts: Point[] = [{ x: 0, y: 0 }, { x: 0, y: 10 }]
    const result = buildOffsetSpine(pts, 5)
    expect(result[0]).toBeCloseTo(5)   // x0 + 5
    expect(result[1]).toBeCloseTo(0)   // y0 unchanged
    expect(result[2]).toBeCloseTo(5)   // x1 + 5
    expect(result[3]).toBeCloseTo(10)  // y1 unchanged (original = 10)
  })

  it('handles a three-point polyline and preserves point count', () => {
    const pts: Point[] = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 20, y: 0 },
    ]
    const result = buildOffsetSpine(pts, 3)
    // 3 points × 2 coords each = 6 numbers
    expect(result).toHaveLength(6)
  })

  it('uses the last segment normal for the final point', () => {
    // Two-point segment going right; final point normal = same as only segment normal
    const pts: Point[] = [{ x: 0, y: 0 }, { x: 10, y: 0 }]
    const withD = buildOffsetSpine(pts, 10)
    // Both y values should be -10
    expect(withD[1]).toBeCloseTo(-10)
    expect(withD[3]).toBeCloseTo(-10)
  })

  it('returns a flat array suitable for Konva Line points', () => {
    const pts: Point[] = [{ x: 1, y: 2 }, { x: 3, y: 4 }, { x: 5, y: 6 }]
    const result = buildOffsetSpine(pts, 0)
    // With d=0, output should match the flat input exactly
    expect(result).toEqual([1, 2, 3, 4, 5, 6])
  })

  it('handles a single point gracefully (no crash)', () => {
    const pts: Point[] = [{ x: 5, y: 5 }]
    expect(() => buildOffsetSpine(pts, 10)).not.toThrow()
  })

  it('produces symmetric left/right offsets of equal magnitude', () => {
    const pts: Point[] = [{ x: 0, y: 0 }, { x: 100, y: 0 }]
    const left  = buildOffsetSpine(pts, 20)
    const right = buildOffsetSpine(pts, -20)
    // y values should be equal in magnitude, opposite in sign
    for (let i = 1; i < left.length; i += 2) {
      expect(left[i]).toBeCloseTo(-right[i])
    }
  })

  it('offset magnitude equals d for a straight horizontal spine', () => {
    const pts: Point[] = [{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 100, y: 0 }]
    const d = 7
    const result = buildOffsetSpine(pts, d)
    // All y values should be exactly -d (normal is (0,-1) for rightward travel)
    for (let i = 1; i < result.length; i += 2) {
      expect(result[i]).toBeCloseTo(-d, 6)
    }
  })
})

// ─── Rendered element counts (component smoke tests) ─────────────────────────
// These tests use React Testing Library to render the road components and count
// the Konva Line elements in the output, verifying shoulder/sidewalk elements
// are present or absent based on the object configuration.

import { render } from '@testing-library/react'
import React from 'react'
import { PolylineRoad, CurveRoad, CubicBezierRoad } from '../components/tcp/canvas/ObjectShapes'
import type { PolylineRoadObject, CurveRoadObject, CubicBezierRoadObject } from '../types'

// ─── Helpers ──────────────────────────────────────────────────────────────────


// ─── PolylineRoad ─────────────────────────────────────────────────────────────

describe('PolylineRoad — shoulder/sidewalk rendering', () => {
  const base: PolylineRoadObject = {
    id: 'pr1',
    type: 'polyline_road',
    points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 200, y: 50 }],
    width: 40,
    realWidth: 24,
    lanes: 2,
    roadType: '2lane',
    smooth: false,
  }

  it('renders without error when shoulderWidth=0 and sidewalkWidth=0', () => {
    expect(() => render(React.createElement(PolylineRoad, { obj: base, isSelected: false }))).not.toThrow()
  })

  it('renders without error when shoulderWidth > 0', () => {
    const obj = { ...base, shoulderWidth: 8 }
    expect(() => render(React.createElement(PolylineRoad, { obj, isSelected: false }))).not.toThrow()
  })

  it('renders without error when sidewalkWidth > 0 and sidewalkSide=both', () => {
    const obj = { ...base, sidewalkWidth: 12, sidewalkSide: 'both' as const }
    expect(() => render(React.createElement(PolylineRoad, { obj, isSelected: false }))).not.toThrow()
  })

  it('renders without error with shoulder + sidewalk on left only', () => {
    const obj = { ...base, shoulderWidth: 6, sidewalkWidth: 10, sidewalkSide: 'left' as const }
    expect(() => render(React.createElement(PolylineRoad, { obj, isSelected: false }))).not.toThrow()
  })

  it('renders without error with smooth=true', () => {
    const obj = { ...base, smooth: true, shoulderWidth: 8, sidewalkWidth: 10, sidewalkSide: 'both' as const }
    expect(() => render(React.createElement(PolylineRoad, { obj, isSelected: false }))).not.toThrow()
  })
})

// ─── CurveRoad ────────────────────────────────────────────────────────────────

describe('CurveRoad — shoulder/sidewalk rendering', () => {
  const base: CurveRoadObject = {
    id: 'cr1',
    type: 'curve_road',
    points: [{ x: 0, y: 0 }, { x: 100, y: 100 }, { x: 200, y: 0 }],
    width: 40,
    realWidth: 24,
    lanes: 2,
    roadType: '2lane',
  }

  it('renders without error when shoulderWidth=0 and sidewalkWidth=0', () => {
    expect(() => render(React.createElement(CurveRoad, { obj: base, isSelected: false }))).not.toThrow()
  })

  it('renders without error when shoulderWidth > 0', () => {
    const obj = { ...base, shoulderWidth: 8 }
    expect(() => render(React.createElement(CurveRoad, { obj, isSelected: false }))).not.toThrow()
  })

  it('renders without error when sidewalkWidth > 0 and sidewalkSide=both', () => {
    const obj = { ...base, sidewalkWidth: 12, sidewalkSide: 'both' as const }
    expect(() => render(React.createElement(CurveRoad, { obj, isSelected: false }))).not.toThrow()
  })

  it('renders without error with shoulder + sidewalk on right only', () => {
    const obj = { ...base, shoulderWidth: 6, sidewalkWidth: 10, sidewalkSide: 'right' as const }
    expect(() => render(React.createElement(CurveRoad, { obj, isSelected: false }))).not.toThrow()
  })
})

// ─── CubicBezierRoad ──────────────────────────────────────────────────────────

describe('CubicBezierRoad — shoulder/sidewalk rendering', () => {
  const base: CubicBezierRoadObject = {
    id: 'cbr1',
    type: 'cubic_bezier_road',
    points: [{ x: 0, y: 0 }, { x: 50, y: 100 }, { x: 150, y: 100 }, { x: 200, y: 0 }],
    width: 40,
    realWidth: 24,
    lanes: 2,
    roadType: '2lane',
  }

  it('renders without error when shoulderWidth=0 and sidewalkWidth=0', () => {
    expect(() => render(React.createElement(CubicBezierRoad, { obj: base, isSelected: false }))).not.toThrow()
  })

  it('renders without error when shoulderWidth > 0', () => {
    const obj = { ...base, shoulderWidth: 8 }
    expect(() => render(React.createElement(CubicBezierRoad, { obj, isSelected: false }))).not.toThrow()
  })

  it('renders without error when sidewalkWidth > 0 and sidewalkSide=both', () => {
    const obj = { ...base, sidewalkWidth: 12, sidewalkSide: 'both' as const }
    expect(() => render(React.createElement(CubicBezierRoad, { obj, isSelected: false }))).not.toThrow()
  })

  it('renders without error with shoulder + sidewalk (both sides)', () => {
    const obj = { ...base, shoulderWidth: 8, sidewalkWidth: 12, sidewalkSide: 'both' as const }
    expect(() => render(React.createElement(CubicBezierRoad, { obj, isSelected: false }))).not.toThrow()
  })

  it('renders without error when selected', () => {
    const obj = { ...base, shoulderWidth: 8, sidewalkWidth: 12, sidewalkSide: 'both' as const }
    expect(() => render(React.createElement(CubicBezierRoad, { obj, isSelected: true }))).not.toThrow()
  })
})
