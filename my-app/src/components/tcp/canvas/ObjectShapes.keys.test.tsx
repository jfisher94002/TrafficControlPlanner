import React from 'react'
import { describe, expect, it } from 'vitest'
import { DrawingOverlays } from './DrawingOverlays'
import { CubicBezierRoad, CurveRoad, PolylineRoad, RoadSegment } from './ObjectShapes'
import type {
  CubicBezierRoadObject,
  CurveRoadObject,
  Point,
  PolylineRoadObject,
  StraightRoadObject,
} from '../../../types'

function collectElementKeys(node: React.ReactNode): string[] {
  const keys: string[] = []

  const visit = (child: React.ReactNode) => {
    if (Array.isArray(child)) {
      child.forEach(visit)
      return
    }
    if (!React.isValidElement(child)) return
    if (child.key != null) keys.push(String(child.key))
    visit((child.props as { children?: React.ReactNode }).children)
  }

  visit(node)
  return keys
}

describe('DrawingOverlays cubic preview keys', () => {
  const cursorPos: Point = { x: 90, y: 40 }

  it('uses a distinct tangent key in the 2-point cubic preview branch', () => {
    const element = DrawingOverlays({
      tool: 'road',
      roadDrawMode: 'cubic',
      drawStart: null,
      cursorPos,
      snapIndicator: null,
      polyPoints: [],
      curvePoints: [],
      cubicPoints: [
        { x: 0, y: 0 },
        { x: 20, y: 10 },
      ],
    })

    const keys = collectElementKeys(element)
    expect(keys).toContain('cubic-tangent-1-2pt')
    expect(keys).not.toContain('cubic-tangent-1-3pt')
    expect(keys).not.toContain('cubic-tangent-2-3pt')
  })

  it('uses distinct tangent keys in the 3-point cubic preview branch', () => {
    const element = DrawingOverlays({
      tool: 'road',
      roadDrawMode: 'cubic',
      drawStart: null,
      cursorPos,
      snapIndicator: null,
      polyPoints: [],
      curvePoints: [],
      cubicPoints: [
        { x: 0, y: 0 },
        { x: 20, y: 10 },
        { x: 40, y: 20 },
      ],
    })

    const tangentKeys = collectElementKeys(element).filter((key) => key.startsWith('cubic-tangent-'))
    expect(tangentKeys).toEqual(['cubic-tangent-1-3pt', 'cubic-tangent-2-3pt'])
    expect(new Set(tangentKeys).size).toBe(tangentKeys.length)
  })
})

describe('ObjectShapes road child keys', () => {
  it('prefixes RoadSegment shoulder and sidewalk keys with the object id', () => {
    const obj: StraightRoadObject = {
      id: 'road-segment-1',
      type: 'road',
      x1: 0,
      y1: 0,
      x2: 120,
      y2: 0,
      width: 40,
      realWidth: 22,
      lanes: 2,
      roadType: '2lane',
      shoulderWidth: 10,
      sidewalkWidth: 8,
      sidewalkSide: 'both',
    }

    const keys = collectElementKeys(RoadSegment({ obj, isSelected: false }))
    expect(keys).toContain('road-segment-1-sl')
    expect(keys).toContain('road-segment-1-sr')
    expect(keys).toContain('road-segment-1-swl-fill')
    expect(keys).toContain('road-segment-1-swl-edge')
    expect(keys).toContain('road-segment-1-swr-fill')
    expect(keys).toContain('road-segment-1-swr-edge')
  })

  it('prefixes PolylineRoad lane-marking keys with the object id', () => {
    const obj: PolylineRoadObject = {
      id: 'poly-road-1',
      type: 'polyline_road',
      points: [
        { x: 0, y: 0 },
        { x: 60, y: 0 },
        { x: 120, y: 20 },
      ],
      width: 44,
      realWidth: 44,
      lanes: 4,
      roadType: '4lane',
      smooth: false,
    }

    const keys = collectElementKeys(PolylineRoad({ obj, isSelected: false }))
    const laneKeys = keys.filter((key) => key.includes('-l') || key.includes('-c'))
    expect(laneKeys.length).toBeGreaterThan(0)
    expect(laneKeys.every((key) => key.startsWith('poly-road-1-'))).toBe(true)
  })

  it('prefixes CurveRoad lane-marking keys with the object id', () => {
    const obj: CurveRoadObject = {
      id: 'curve-road-1',
      type: 'curve_road',
      points: [
        { x: 0, y: 0 },
        { x: 60, y: -30 },
        { x: 120, y: 0 },
      ],
      width: 44,
      realWidth: 44,
      lanes: 4,
      roadType: '4lane',
    }

    const keys = collectElementKeys(CurveRoad({ obj, isSelected: false }))
    const laneKeys = keys.filter((key) => key.includes('-l') || key.includes('-c'))
    expect(laneKeys.length).toBeGreaterThan(0)
    expect(laneKeys.every((key) => key.startsWith('curve-road-1-'))).toBe(true)
  })

  it('prefixes CubicBezierRoad lane-marking keys with the object id', () => {
    const obj: CubicBezierRoadObject = {
      id: 'cubic-road-1',
      type: 'cubic_bezier_road',
      points: [
        { x: 0, y: 0 },
        { x: 30, y: -30 },
        { x: 90, y: 30 },
        { x: 120, y: 0 },
      ],
      width: 44,
      realWidth: 44,
      lanes: 4,
      roadType: '4lane',
    }

    const keys = collectElementKeys(CubicBezierRoad({ obj, isSelected: false }))
    const laneKeys = keys.filter((key) => key.includes('-l') || key.includes('-c'))
    expect(laneKeys.length).toBeGreaterThan(0)
    expect(laneKeys.every((key) => key.startsWith('cubic-road-1-'))).toBe(true)
  })
})
