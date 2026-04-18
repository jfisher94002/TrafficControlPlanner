import React from 'react'
import { describe, expect, it } from 'vitest'
import { CubicBezierRoad, CurveRoad, PolylineRoad, RoadSegment } from './ObjectShapes'
import { DrawingOverlays } from './DrawingOverlays'
import type {
  CubicBezierRoadObject,
  CurveRoadObject,
  Point,
  PolylineRoadObject,
  StraightRoadObject,
} from '../../../types'

function normalizeReactKey(key: string): string {
  if (key.startsWith('.$')) return key.slice(2)
  if (key.startsWith('.')) return key.slice(1)
  return key
}

function getChildKeys(node: React.ReactNode): string[] {
  return React.Children.toArray(node)
    .filter((child): child is React.ReactElement => React.isValidElement(child))
    .map((child) => (child.key == null ? '' : normalizeReactKey(String(child.key))))
    .filter(Boolean)
}

function makePolylineRoad(id: string): PolylineRoadObject {
  return {
    id,
    type: 'polyline_road',
    points: [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 150, y: 50 },
    ],
    width: 48,
    realWidth: 44,
    lanes: 4,
    roadType: '4lane',
    smooth: false,
  }
}

function makeCurveRoad(id: string): CurveRoadObject {
  return {
    id,
    type: 'curve_road',
    points: [
      { x: 0, y: 0 },
      { x: 40, y: 60 },
      { x: 100, y: 0 },
    ],
    width: 48,
    realWidth: 44,
    lanes: 4,
    roadType: '4lane',
  }
}

function makeCubicRoad(id: string): CubicBezierRoadObject {
  return {
    id,
    type: 'cubic_bezier_road',
    points: [
      { x: 0, y: 0 },
      { x: 40, y: 80 },
      { x: 80, y: -40 },
      { x: 120, y: 0 },
    ],
    width: 48,
    realWidth: 44,
    lanes: 4,
    roadType: '4lane',
  }
}

describe('canvas render keys', () => {
  it('uses road id prefixes for straight-road shoulder and sidewalk children', () => {
    const road: StraightRoadObject = {
      id: 'road-a',
      type: 'road',
      x1: 0,
      y1: 0,
      x2: 100,
      y2: 0,
      width: 40,
      realWidth: 36,
      lanes: 2,
      roadType: '2lane',
      shoulderWidth: 8,
      sidewalkWidth: 10,
      sidewalkSide: 'both',
    }

    const element = RoadSegment({ obj: road, isSelected: false }) as React.ReactElement
    const keys = getChildKeys(element.props.children)

    expect(keys).toEqual(
      expect.arrayContaining(['road-a-sl', 'road-a-sr', 'road-a-swl-fill', 'road-a-swl-edge', 'road-a-swr-fill', 'road-a-swr-edge']),
    )
  })

  it('keeps polyline lane-marking keys unique across different object ids', () => {
    const a = PolylineRoad({ obj: makePolylineRoad('poly-a'), isSelected: false }) as React.ReactElement
    const b = PolylineRoad({ obj: makePolylineRoad('poly-b'), isSelected: false }) as React.ReactElement

    const keysA = getChildKeys(a.props.children).filter((k) => k.startsWith('poly-a-'))
    const keysB = getChildKeys(b.props.children).filter((k) => k.startsWith('poly-b-'))

    expect(keysA.length).toBeGreaterThan(0)
    expect(keysB.length).toBeGreaterThan(0)
    expect(keysA.some((k) => keysB.includes(k))).toBe(false)
  })

  it('keeps curve and cubic lane-marking keys unique across object ids', () => {
    const curveA = CurveRoad({ obj: makeCurveRoad('curve-a'), isSelected: false }) as React.ReactElement
    const curveB = CurveRoad({ obj: makeCurveRoad('curve-b'), isSelected: false }) as React.ReactElement
    const cubicA = CubicBezierRoad({ obj: makeCubicRoad('cubic-a'), isSelected: false }) as React.ReactElement
    const cubicB = CubicBezierRoad({ obj: makeCubicRoad('cubic-b'), isSelected: false }) as React.ReactElement

    const curveKeysA = getChildKeys(curveA.props.children).filter((k) => k.startsWith('curve-a-'))
    const curveKeysB = getChildKeys(curveB.props.children).filter((k) => k.startsWith('curve-b-'))
    const cubicKeysA = getChildKeys(cubicA.props.children).filter((k) => k.startsWith('cubic-a-'))
    const cubicKeysB = getChildKeys(cubicB.props.children).filter((k) => k.startsWith('cubic-b-'))

    expect(curveKeysA.length).toBeGreaterThan(0)
    expect(curveKeysB.length).toBeGreaterThan(0)
    expect(cubicKeysA.length).toBeGreaterThan(0)
    expect(cubicKeysB.length).toBeGreaterThan(0)
    expect(curveKeysA.some((k) => curveKeysB.includes(k))).toBe(false)
    expect(cubicKeysA.some((k) => cubicKeysB.includes(k))).toBe(false)
  })

  it('uses distinct cubic tangent preview keys for 2-point and 3-point drafts', () => {
    const baseProps = {
      tool: 'road',
      roadDrawMode: 'cubic',
      drawStart: null,
      cursorPos: { x: 90, y: 40 },
      snapIndicator: null,
      polyPoints: [] as Point[],
      curvePoints: [] as Point[],
    }

    const twoPointPreview = DrawingOverlays({
      ...baseProps,
      cubicPoints: [
        { x: 0, y: 0 },
        { x: 30, y: 20 },
      ],
    }) as React.ReactElement
    const twoPointKeys = getChildKeys(twoPointPreview.props.children)

    expect(twoPointKeys).toContain('cubic-tangent-1-2pt')
    expect(twoPointKeys).not.toContain('cubic-tangent-1-3pt')
    expect(twoPointKeys).not.toContain('cubic-tangent-2-3pt')

    const threePointPreview = DrawingOverlays({
      ...baseProps,
      cubicPoints: [
        { x: 0, y: 0 },
        { x: 30, y: 20 },
        { x: 60, y: -10 },
      ],
    }) as React.ReactElement
    const threePointKeys = getChildKeys(threePointPreview.props.children)

    expect(threePointKeys).toContain('cubic-tangent-1-3pt')
    expect(threePointKeys).toContain('cubic-tangent-2-3pt')
    expect(threePointKeys).not.toContain('cubic-tangent-1-2pt')
  })
})
