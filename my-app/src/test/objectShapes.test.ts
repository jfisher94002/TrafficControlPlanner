/**
 * Tests for shoulder/sidewalk rendering helpers and ObjectShapes components.
 *
 * We test the pure utility (buildOffsetSpine) directly, and verify the rendered
 * element counts for each road component via React Testing Library.
 */
import { describe, it, expect, vi } from 'vitest'
import { buildOffsetSpine } from '../utils'
import type { Point } from '../types'

// ─── buildOffsetSpine ─────────────────────────────────────────────────────────

// buildOffsetSpine uses the same normal convention as StraightRoad: (nx,ny) = (-dy/len, dx/len).
// For a rightward segment (dx>0, dy=0): nx=0, ny=1 → positive d shifts Y downward (south).
// This matches how StraightRoad's positive-normal side maps to sidewalkSide='left'.

describe('buildOffsetSpine', () => {
  it('offsets a horizontal segment with positive d (ny=+1 direction)', () => {
    // Segment going right: (0,0) → (10,0). Normal is (0,+1) — downward in Y-down canvas.
    const pts: Point[] = [{ x: 0, y: 0 }, { x: 10, y: 0 }]
    const result = buildOffsetSpine(pts, 5)
    // Both points shifted by (nx=0, ny=+1)*5 → y increases by 5
    expect(result).toHaveLength(4)
    expect(result[0]).toBeCloseTo(0)   // x0 unchanged
    expect(result[1]).toBeCloseTo(5)   // y0 + 5
    expect(result[2]).toBeCloseTo(10)  // x1 unchanged
    expect(result[3]).toBeCloseTo(5)   // y1 + 5
  })

  it('offsets a horizontal segment with negative d (opposite side)', () => {
    const pts: Point[] = [{ x: 0, y: 0 }, { x: 10, y: 0 }]
    const result = buildOffsetSpine(pts, -5)
    expect(result[1]).toBeCloseTo(-5)
    expect(result[3]).toBeCloseTo(-5)
  })

  it('offsets a vertical segment correctly', () => {
    // Segment going down: (0,0) → (0,10). Normal is (-1,0) — leftward.
    const pts: Point[] = [{ x: 0, y: 0 }, { x: 0, y: 10 }]
    const result = buildOffsetSpine(pts, 5)
    expect(result[0]).toBeCloseTo(-5)  // x0 - 5
    expect(result[1]).toBeCloseTo(0)   // y0 unchanged
    expect(result[2]).toBeCloseTo(-5)  // x1 - 5
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
    // Two-point segment going right; final point uses same segment's normal
    const pts: Point[] = [{ x: 0, y: 0 }, { x: 10, y: 0 }]
    const withD = buildOffsetSpine(pts, 10)
    // Both y values should be +10 (ny=+1 for rightward segment)
    expect(withD[1]).toBeCloseTo(10)
    expect(withD[3]).toBeCloseTo(10)
  })

  it('returns a flat array suitable for Konva Line points', () => {
    const pts: Point[] = [{ x: 1, y: 2 }, { x: 3, y: 4 }, { x: 5, y: 6 }]
    const result = buildOffsetSpine(pts, 0)
    // With d=0, output should match the flat input exactly
    expect(result).toEqual([1, 2, 3, 4, 5, 6])
  })

  it('handles a single point gracefully (no crash, returns point unchanged)', () => {
    const pts: Point[] = [{ x: 5, y: 5 }]
    expect(() => buildOffsetSpine(pts, 10)).not.toThrow()
    expect(buildOffsetSpine(pts, 10)).toEqual([5, 5])
  })

  it('produces symmetric offsets of equal magnitude on opposite sides', () => {
    const pts: Point[] = [{ x: 0, y: 0 }, { x: 100, y: 0 }]
    const pos  = buildOffsetSpine(pts, 20)
    const neg = buildOffsetSpine(pts, -20)
    // y values should be equal in magnitude, opposite in sign
    for (let i = 1; i < pos.length; i += 2) {
      expect(pos[i]).toBeCloseTo(-neg[i])
    }
  })

  it('offset magnitude equals d for a straight horizontal spine', () => {
    const pts: Point[] = [{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 100, y: 0 }]
    const d = 7
    const result = buildOffsetSpine(pts, d)
    // ny=+1 for rightward travel → all y values = +d
    for (let i = 1; i < result.length; i += 2) {
      expect(result[i]).toBeCloseTo(d, 6)
    }
  })
})

// ─── Component smoke tests ────────────────────────────────────────────────────
// react-konva primitives are mocked to render null in the jsdom test env, so
// these tests only verify that each road component renders without throwing for
// various shoulder/sidewalk configurations.

import React from 'react'
import { render } from '@testing-library/react'
import { PolylineRoad, CurveRoad, CubicBezierRoad, WorkZone, DeviceShape } from '../components/tcp/canvas/ObjectShapes'
import type { PolylineRoadObject, CurveRoadObject, CubicBezierRoadObject, ZoneObject, DeviceObject, ArrowBoardMode } from '../types'

// ─── WorkZone ─────────────────────────────────────────────────────────────────

describe('WorkZone rendering contract', () => {
  const zone: ZoneObject = { id: 'zone1', type: 'zone', x: 10, y: 20, w: 100, h: 60 }

  const getWorkZoneChildren = (isSelected = false) => {
    const element = WorkZone({ obj: zone, isSelected })
    if (!React.isValidElement(element)) throw new Error('WorkZone did not return a React element')
    const children = React.Children.toArray((element.props as { children?: React.ReactNode }).children) as React.ReactElement<Record<string, unknown>>[]
    const [rect, ...rest] = children
    const label = rest[rest.length - 1]
    const hatches = rest.slice(0, -1)
    return {
      rect,
      hatches,
      label,
    }
  }

  it('uses high-visibility fill, stroke, and hatch styling', () => {
    const { rect, hatches } = getWorkZoneChildren()

    expect(rect.props).toMatchObject({
      x: 10,
      y: 20,
      width: 100,
      height: 60,
      fill: 'rgba(245,158,11,0.22)',
      stroke: 'rgba(245,158,11,0.85)',
      strokeWidth: 2,
      dash: [8, 6],
    })
    expect(hatches).toHaveLength(15)
    expect(hatches[0].props).toMatchObject({
      stroke: 'rgba(245,158,11,0.35)',
      strokeWidth: 1.5,
      listening: false,
    })
  })

  it('preserves the selected stroke while keeping the stronger fill', () => {
    const { rect } = getWorkZoneChildren(true)

    expect(rect.props.fill).toBe('rgba(245,158,11,0.22)')
    expect(rect.props.stroke).not.toBe('rgba(245,158,11,0.85)')
  })

  it('keeps the centered WORK ZONE label aligned with the zone bounds', () => {
    const { label } = getWorkZoneChildren()

    expect(label.props).toMatchObject({
      x: 10,
      y: 20,
      width: 100,
      height: 60,
      text: 'WORK ZONE',
      align: 'center',
      verticalAlign: 'middle',
    })
  })
})

// ─── Arrow board device display modes ─────────────────────────────────────────

describe('DeviceShape arrow board display modes', () => {
  const arrowBoard = (arrowBoardMode?: ArrowBoardMode): DeviceObject => ({
    id: `arrow-board-${arrowBoardMode ?? 'default'}`,
    type: 'device',
    x: 10,
    y: 20,
    deviceData: { id: 'arrow_board', label: 'Arrow Board', icon: '⟹', color: '#fbbf24' },
    rotation: 0,
    ...(arrowBoardMode ? { arrowBoardMode } : {}),
  })

  const renderToCanvasCalls = (obj: DeviceObject) => {
    const element = DeviceShape({ obj, isSelected: false })
    if (!React.isValidElement(element)) throw new Error('DeviceShape did not return a React element')

    const ctx = {
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 0,
      globalAlpha: 1,
      font: '',
      textAlign: '',
      textBaseline: '',
      beginPath: vi.fn(),
      rect: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      closePath: vi.fn(),
      fillRect: vi.fn(),
      fillText: vi.fn(),
    }

    ;(element.props as { sceneFunc: (ctx: unknown) => void }).sceneFunc(ctx)
    return ctx
  }

  it('defaults legacy arrow boards with no mode to the right-arrow display', () => {
    const ctx = renderToCanvasCalls(arrowBoard())

    expect(ctx.moveTo).toHaveBeenCalledWith(-10, -6)
    expect(ctx.lineTo).toHaveBeenCalledWith(10, 0)
    expect(ctx.fillText).toHaveBeenCalledWith('RIGHT', 0, 11)
  })

  it.each([
    ['right', -10, 10, 'RIGHT'],
    ['left', 10, -10, 'LEFT'],
  ] as const)('draws the %s arrow chevron geometry and label', (mode, startX, tipX, label) => {
    const ctx = renderToCanvasCalls(arrowBoard(mode))

    expect(ctx.moveTo).toHaveBeenCalledWith(startX, -6)
    expect(ctx.lineTo).toHaveBeenCalledWith(tipX, 0)
    expect(ctx.fillText).toHaveBeenCalledWith(label, 0, 11)
  })

  it('draws caution mode as a diamond pattern with the caution label', () => {
    const ctx = renderToCanvasCalls(arrowBoard('caution'))

    expect(ctx.moveTo).toHaveBeenCalledWith(0, -7)
    expect(ctx.lineTo).toHaveBeenCalledWith(9, 0)
    expect(ctx.lineTo).toHaveBeenCalledWith(0, 7)
    expect(ctx.lineTo).toHaveBeenCalledWith(-9, 0)
    expect(ctx.fillText).toHaveBeenCalledWith('CAUTION', 0, 11)
  })

  it('draws flashing mode as a full-board amber fill with restored opacity', () => {
    const ctx = renderToCanvasCalls(arrowBoard('flashing'))

    expect(ctx.fillRect).toHaveBeenCalledWith(-12, -7, 24, 14)
    expect(ctx.fillText).toHaveBeenCalledWith('FLASHING', 0, 11)
    expect(ctx.globalAlpha).toBe(1)
  })
})

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
