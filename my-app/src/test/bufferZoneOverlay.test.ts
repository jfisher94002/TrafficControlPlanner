/**
 * Unit tests for BufferZoneOverlay geometry via the exported
 * getBufferZoneGeometry() helper. Tests assert against the actual
 * return values so any regression in the overlay's geometry is caught.
 */
import { describe, it, expect } from 'vitest'
import { getBufferZoneGeometry } from '../components/tcp/canvas/BufferZoneOverlay'
import { TAPER_SCALE } from '../features/tcp/constants'
import type { TaperObject } from '../types'

function makeTaper(overrides: Partial<TaperObject> = {}): TaperObject {
  return {
    id: 'test-taper',
    type: 'taper',
    x: 0, y: 0,
    rotation: 0,
    speed: 45,
    laneWidth: 12,
    taperLength: 100,
    manualLength: false,
    numLanes: 1,
    ...overrides,
  }
}

describe('getBufferZoneGeometry', () => {
  it('buffer width equals 1× sign spacing distance for 45 mph', () => {
    const { rectW, spacingFt } = getBufferZoneGeometry(makeTaper({ speed: 45 }))
    expect(spacingFt).toBe(200)                        // Table 6H-3: 45 mph → 200 ft
    expect(rectW).toBe(200 * TAPER_SCALE)              // px = ft × scale
  })

  it('buffer rect left edge is at -spacingPx and right edge aligns with taper origin', () => {
    const { rectX, rectW } = getBufferZoneGeometry(makeTaper({ speed: 45 }))
    expect(rectX).toBe(-200 * TAPER_SCALE)             // upstream of taper
    expect(rectX + rectW).toBe(0)                      // right edge = taper origin
  })

  it('buffer height spans the full road width', () => {
    const { rectH, hw } = getBufferZoneGeometry(makeTaper({ laneWidth: 12, numLanes: 2 }))
    // laneWidth * numLanes * scale = 12 * 2 * 3 = 72 px total
    expect(hw).toBe(36)
    expect(rectH).toBe(72)
  })

  it('returns correct geometry for each MUTCD speed bucket', () => {
    const cases: Array<[number, number]> = [
      [35, 100],
      [45, 200],
      [55, 350],
      [65, 500],
      [70, 600],
    ]
    for (const [speed, expectedFt] of cases) {
      const { spacingFt, rectW, rectX } = getBufferZoneGeometry(makeTaper({ speed }))
      expect(spacingFt).toBe(expectedFt)
      expect(rectW).toBe(expectedFt * TAPER_SCALE)
      expect(rectX + rectW).toBe(0)                    // always aligns with taper origin
    }
  })

  it('hw scales correctly with laneWidth and numLanes', () => {
    const { hw } = getBufferZoneGeometry(makeTaper({ laneWidth: 14, numLanes: 3 }))
    expect(hw).toBe((14 * 3 * TAPER_SCALE) / 2)
  })
})
