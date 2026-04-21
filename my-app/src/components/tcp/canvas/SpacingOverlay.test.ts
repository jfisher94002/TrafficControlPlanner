import { describe, it, expect } from 'vitest'
import { mutcdSpacingFt } from './SpacingOverlay'

describe('mutcdSpacingFt', () => {
  it('maps MUTCD thresholds correctly across speed buckets', () => {
    expect(mutcdSpacingFt(25)).toBe(100)
    expect(mutcdSpacingFt(35)).toBe(100)

    expect(mutcdSpacingFt(40)).toBe(200)
    expect(mutcdSpacingFt(45)).toBe(200)

    expect(mutcdSpacingFt(50)).toBe(350)
    expect(mutcdSpacingFt(55)).toBe(350)

    expect(mutcdSpacingFt(60)).toBe(500)
    expect(mutcdSpacingFt(65)).toBe(500)

    expect(mutcdSpacingFt(70)).toBe(600)
  })

  it('handles exact boundary transitions without off-by-one errors', () => {
    expect(mutcdSpacingFt(36)).toBe(200)
    expect(mutcdSpacingFt(46)).toBe(350)
    expect(mutcdSpacingFt(56)).toBe(500)
    expect(mutcdSpacingFt(66)).toBe(600)
  })
})
