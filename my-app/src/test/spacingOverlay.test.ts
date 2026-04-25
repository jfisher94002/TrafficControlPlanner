import { describe, expect, it } from 'vitest'
import { getSpacingGuideGeometry } from '../components/tcp/canvas/SpacingOverlay'
import { SIGN_LATERAL_CLEARANCE_PX, TAPER_SCALE } from '../features/tcp/constants'
import type { TaperObject } from '../types'

function makeTaper(overrides: Partial<TaperObject> = {}): TaperObject {
  return {
    id: 'spacing-test-taper',
    type: 'taper',
    x: 0,
    y: 0,
    rotation: 0,
    speed: 45,
    laneWidth: 12,
    taperLength: 100,
    manualLength: false,
    numLanes: 1,
    ...overrides,
  }
}

describe('getSpacingGuideGeometry', () => {
  it('places the three advance warning markers upstream at 1x, 2x, and 3x MUTCD spacing', () => {
    const geometry = getSpacingGuideGeometry(makeTaper({ speed: 45 }))

    expect(geometry.spacingFt).toBe(200)
    expect(geometry.spacingPx).toBe(200 * TAPER_SCALE)
    expect(geometry.markers).toEqual([
      { label: 'ONE LANE RD', mutcd: 'W20-4a', x: -200 * TAPER_SCALE, distanceFt: 200 },
      { label: 'ROAD WORK', mutcd: 'W20-1', x: -400 * TAPER_SCALE, distanceFt: 400 },
      { label: 'WORK AHEAD', mutcd: 'W20-1', x: -600 * TAPER_SCALE, distanceFt: 600 },
    ])
  })

  it('uses the high-speed MUTCD spacing bucket for roads over 65 mph', () => {
    const geometry = getSpacingGuideGeometry(makeTaper({ speed: 70 }))

    expect(geometry.spacingFt).toBe(600)
    expect(geometry.markers.map((marker) => marker.distanceFt)).toEqual([600, 1200, 1800])
    expect(geometry.markers.map((marker) => marker.x)).toEqual([
      -600 * TAPER_SCALE,
      -1200 * TAPER_SCALE,
      -1800 * TAPER_SCALE,
    ])
  })

  it('scales road-width guide lines and sign dot lateral offset with lane width and lane count', () => {
    const geometry = getSpacingGuideGeometry(makeTaper({ laneWidth: 14, numLanes: 2 }))
    const expectedHalfRoadWidth = (14 * 2 * TAPER_SCALE) / 2

    expect(geometry.hw).toBe(expectedHalfRoadWidth)
    expect(geometry.lineHalfLen).toBe(expectedHalfRoadWidth + 90)
    expect(geometry.signDotY).toBe(expectedHalfRoadWidth + SIGN_LATERAL_CLEARANCE_PX)
  })
})
