import React from 'react'
import { describe, it, expect } from 'vitest'
import { DrawingOverlays } from '../components/tcp/canvas/DrawingOverlays'
import { COLORS } from '../features/tcp/constants'
import type { Point } from '../types'

const baseProps = {
  tool: 'select',
  roadDrawMode: 'straight',
  drawStart: null,
  cursorPos: { x: 0, y: 0 },
  snapIndicator: null,
  polyPoints: [],
  curvePoints: [],
  cubicPoints: [],
}

function getOverlays(overrides: Partial<typeof baseProps> = {}) {
  const node = DrawingOverlays({ ...baseProps, ...overrides }) as React.ReactElement<{ children: React.ReactNode }>
  return React.Children.toArray(node.props.children) as Array<React.ReactElement<Record<string, unknown>>>
}

function keyIncludes(el: React.ReactElement, key: string) {
  return String(el.key).includes(key)
}

describe('DrawingOverlays', () => {
  it('uses snap target for straight road preview when snapping', () => {
    const overlays = getOverlays({
      tool: 'road',
      roadDrawMode: 'straight',
      drawStart: { x: 10, y: 15 },
      cursorPos: { x: 100, y: 120 },
      snapIndicator: { x: 20, y: 25 },
    })
    const preview = overlays.find((el) => keyIncludes(el, 'road-preview'))
    expect(preview).toBeDefined()
    expect(preview?.props.points).toEqual([10, 15, 20, 25])
  })

  it('normalizes zone rectangle dimensions regardless of drag direction', () => {
    const overlays = getOverlays({
      tool: 'zone',
      drawStart: { x: 30, y: 40 },
      cursorPos: { x: 10, y: 70 },
    })
    const preview = overlays.find((el) => keyIncludes(el, 'zone-preview'))
    expect(preview).toBeDefined()
    expect(preview?.props).toMatchObject({
      x: 10,
      y: 40,
      width: 20,
      height: 30,
    })
  })

  it('builds lane mask preview object with expected defaults', () => {
    const overlays = getOverlays({
      tool: 'lane_mask',
      drawStart: { x: 1, y: 2 },
      cursorPos: { x: 11, y: 12 },
    })
    const preview = overlays.find((el) => keyIncludes(el, 'lane-mask-preview'))
    expect(preview).toBeDefined()
    expect(preview?.props.obj).toMatchObject({
      id: '__preview__',
      type: 'lane_mask',
      x1: 1,
      y1: 2,
      x2: 11,
      y2: 12,
      laneWidth: 20,
      style: 'hatch',
    })
  })

  it('uses smooth tension and preview target for polyline road preview', () => {
    const polyPoints: Point[] = [{ x: 0, y: 0 }, { x: 8, y: 6 }]
    const overlays = getOverlays({
      tool: 'road',
      roadDrawMode: 'smooth',
      polyPoints,
      cursorPos: { x: 50, y: 60 },
      snapIndicator: { x: 20, y: 22 },
    })
    const preview = overlays.find((el) => keyIncludes(el, 'poly-preview'))
    expect(preview).toBeDefined()
    expect(preview?.props.points).toEqual([0, 0, 8, 6, 20, 22])
    expect(preview?.props.tension).toBe(0.5)

    const startPoint = overlays.find((el) => keyIncludes(el, 'poly-pt-0'))
    expect(startPoint?.props.fill).toBe(COLORS.success)
  })

  it('draws cubic preview with both tangents once three control points exist', () => {
    const overlays = getOverlays({
      tool: 'road',
      roadDrawMode: 'cubic',
      cubicPoints: [{ x: 2, y: 3 }, { x: 6, y: 7 }, { x: 10, y: 11 }],
      cursorPos: { x: 20, y: 21 },
    })
    const preview = overlays.find((el) => keyIncludes(el, 'cubic-preview-3'))
    const tangent2 = overlays.find((el) => keyIncludes(el, 'cubic-tangent-2'))
    const cubicMarkers = overlays.filter((el) => keyIncludes(el, 'cubic-pt-'))

    expect(preview).toBeDefined()
    expect(tangent2?.props.points).toEqual([10, 11, 20, 21])
    expect(cubicMarkers).toHaveLength(3)
  })

  it('renders both snap indicator rings when snapping is active', () => {
    const overlays = getOverlays({
      snapIndicator: { x: 14, y: 15 },
    })
    const outer = overlays.find((el) => keyIncludes(el, 'snap-outer'))
    const inner = overlays.find((el) => keyIncludes(el, 'snap-inner'))

    expect(outer?.props).toMatchObject({ x: 14, y: 15, radius: 9 })
    expect(inner?.props).toMatchObject({ x: 14, y: 15, radius: 3 })
  })
})
