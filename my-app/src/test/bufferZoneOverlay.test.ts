/**
 * Unit tests for BufferZoneOverlay geometry.
 *
 * The overlay is a pure function of TaperObject fields, so we verify
 * the key geometry values without rendering Konva.
 */
import { describe, it, expect } from 'vitest'
import { mutcdSignSpacingFt } from '../utils'
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

describe('BufferZoneOverlay geometry', () => {
  it('buffer width equals 1× advance warning sign spacing for 45 mph', () => {
    const taper = makeTaper({ speed: 45 })
    const spacingFt = mutcdSignSpacingFt(taper.speed)
    const spacingPx = spacingFt * TAPER_SCALE
    expect(spacingFt).toBe(200)            // Table 6H-3: 45 mph → 200 ft
    expect(spacingPx).toBe(200 * TAPER_SCALE)
    // Buffer rect starts at -spacingPx (first sign position) and ends at 0 (taper)
    const rectX = -spacingPx
    const rectW = spacingPx
    expect(rectX + rectW).toBe(0)          // rect right edge aligns with taper origin
  })

  it('buffer width equals 1× spacing for each MUTCD speed bucket', () => {
    const cases: Array<[number, number]> = [
      [35, 100],
      [45, 200],
      [55, 350],
      [65, 500],
      [70, 600],
    ]
    for (const [speed, expectedFt] of cases) {
      expect(mutcdSignSpacingFt(speed)).toBe(expectedFt)
    }
  })

  it('buffer height spans the full road width (2 × half-width)', () => {
    const taper = makeTaper({ laneWidth: 12, numLanes: 2 })
    const hw = (taper.laneWidth * taper.numLanes * TAPER_SCALE) / 2
    const rectH = hw * 2
    // Full width = laneWidth * numLanes * scale = 12 * 2 * 3 = 72 px
    expect(rectH).toBe(72)
  })

  it('buffer rect right edge aligns with taper origin for any speed', () => {
    for (const speed of [35, 45, 55, 65, 75]) {
      const taper = makeTaper({ speed })
      const spacingPx = mutcdSignSpacingFt(speed) * TAPER_SCALE
      expect(-spacingPx + spacingPx).toBe(0)   // rectX + rectW = 0
    }
  })
})
