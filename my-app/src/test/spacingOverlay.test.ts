import { describe, expect, it } from 'vitest'
import { getSpacingGuideGeometry } from '../components/tcp/canvas/SpacingOverlay'
import { SIGN_LATERAL_CLEARANCE_PX, TAPER_SCALE } from '../features/tcp/constants'
import type { TaperObject } from '../types'

function makeTaper(overrides: Partial<TaperObject> = {}): TaperObject {
  return {
    id: 'test-taper',
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
  it('places the three advance warning guide markers upstream at MUTCD spacing', () => {
    const { spacingFt, markers } = getSpacingGuideGeometry(makeTaper({ speed: 45 }))

    expect(spacingFt).toBe(200)
    expect(markers).toEqual([
      { label: 'ONE LANE RD', mutcd: 'W20-4a', x: -200 * TAPER_SCALE, distanceFt: 200 },
      { label: 'ROAD WORK', mutcd: 'W20-1', x: -400 * TAPER_SCALE, distanceFt: 400 },
      { label: 'WORK AHEAD', mutcd: 'W20-1', x: -600 * TAPER_SCALE, distanceFt: 600 },
    ])
  })

  it('uses the same MUTCD speed buckets as auto-channelization', () => {
    const cases: Array<[number, number]> = [
      [35, 100],
      [45, 200],
      [55, 350],
      [65, 500],
      [70, 600],
    ]

    for (const [speed, expectedFt] of cases) {
      const { spacingFt, markers } = getSpacingGuideGeometry(makeTaper({ speed }))

      expect(spacingFt).toBe(expectedFt)
      expect(markers.map((marker) => marker.x)).toEqual([
        -expectedFt * TAPER_SCALE,
        -expectedFt * 2 * TAPER_SCALE,
        -expectedFt * 3 * TAPER_SCALE,
      ])
    }
  })

  it('scales guide line height and sign dot lateral offset with road width', () => {
    const { hw, lineHalfLen, signDotY } = getSpacingGuideGeometry(
      makeTaper({ laneWidth: 14, numLanes: 3 }),
    )

    expect(hw).toBe((14 * 3 * TAPER_SCALE) / 2)
    expect(lineHalfLen).toBe(hw + 90)
    expect(signDotY).toBe(hw + SIGN_LATERAL_CLEARANCE_PX)
  })
})
