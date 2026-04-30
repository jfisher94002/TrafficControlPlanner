import { describe, it, expect } from 'vitest'
import { TA_SCENARIOS, SIGN_DATA, getSignIdsFromSeed } from './ta-scenarios'
import { MUTCD_6P1_TA_TITLES, MUTCD_6P1_TA_TITLES_LEN } from './mutcd-6p-1-titles'

/**
 * MUTCD minimum sign *ids* a scenario must place (beyond seed/assert sync).
 * Verified directly against MUTCD 11th Edition (Revision 1) PDF figures.
 * Only add entries here once the seed has been audited against the PDF —
 * see jfisher94002/TrafficControlPlanner#349 for the full fix backlog.
 */
const MUTCD_MIN_SIGN_IDS: Partial<Record<string, string[]>> = {
  // PDF-verified (docs/mutcd11theditionr1hl.pdf)
  'TA-1':  ['roadwork'],                                           // W20-1
  'TA-2':  ['blastingzoneahead', 'turnoffradio', 'endblastingzone'], // W22-1, R22-2, W22-3
  'TA-5':  ['roadwork', 'xxft', 'rightshoulderClosed', 'nextmiles'], // W20-1, W16-2aP, W21-5aR, W7-3aP
  'TA-21': ['roadwork', 'laneends', 'leftlaneclosed'],             // W20-1, W12-1, W20-5aL
  'TA-22': ['roadwork', 'rightlaneclosed', 'merge', 'endwork'],    // W20-1, W20-5aR, W4-2R, G20-2
  'TA-23': ['roadwork', 'leftlaneclosed', 'merge', 'endwork'],     // W20-1, W20-5aL, W4-2L, G20-2
  'TA-32': ['roadwork', 'leftlaneclosed', 'rightlaneclosed', 'merge', 'endwork'], // W20-1, W20-5aL, W20-5aR, W4-2R, G20-2
  'TA-37': ['roadwork', 'rightlaneclosed', 'merge', 'endwork'],    // W20-1, W20-5aR, W4-2R, G20-2
  'TA-38': ['roadwork', 'laneends', 'leftlaneclosed', 'merge', 'endwork'], // W20-1, W12-1, W9-3L, W4-2L, G20-2
  'TA-40': ['roadwork', 'twowaytraf', 'donotenter', 'yield'],      // W20-1, W6-3, R5-1, R1-2
  'TA-42': ['roadwork', 'rightlaneclosed', 'merge', 'exitramp', 'exitramp2'], // W20-1, W20-5R, W4-2R, E5-1, E5-2
  'TA-44': ['roadwork', 'rightlaneclosed', 'merge', 'endwork'],    // W20-1, W20-5R, W4-2R, G20-2
  'TA-45': ['roadwork', 'leftlaneclosed', 'merge', 'endwork'],     // W20-1, W20-5aL, W4-2L, G20-2
  'TA-46': ['roadwork', 'onelane', 'trafficcontrols', 'railroadxing', 'railcrossing'], // W20-1, W20-4, W20-7, R8-8, R15-1
  'TA-47': ['roadwork', 'bicyclelaneclosed', 'bikelaneclosedahead'], // W20-1, R9-12, W20-5b
  'TA-48': ['roadwork', 'bicyclelaneclosed', 'bikelaneclosedahead'], // W20-1, R9-12, W20-5b
  'TA-49': ['pathworkahead', 'pathclosed'],                         // W20-1b, R11-2c
  'TA-50': ['roadwork', 'roadworkpath', 'pathclosed'],              // W20-1, W20-3a, R11-2c
  'TA-54': ['roadwork', 'rightlaneclosed', 'merge', 'endwork'],     // W20-1, W20-5R, W4-2R, G20-2
}

const AUDITED_EXACT_SIGN_IDS: Partial<Record<string, string[]>> = {
  'TA-3':  ['roadworknextmi', 'shoulderwork', 'endwork'],
  'TA-4':  ['shoulderwork', 'roadwork', 'nextmiles'],
  'TA-6':  ['roadwork', 'endwork'],
  'TA-7':  ['roadwork', 'reversecurve', 'endwork'],
  'TA-13': ['roadwork', 'prepstop', 'flaggerahead'],
  'TA-14': ['roadwork', 'trafficcontrols'],
  'TA-16': ['surveycrew', 'trafficcontrols'],
  'TA-18': ['workers'],
  'TA-21': ['roadwork', 'laneends', 'leftlaneclosed'],
  'TA-22': ['roadwork', 'rightlaneclosed', 'merge', 'endwork'],
  'TA-23': ['roadwork', 'leftlaneclosed', 'merge', 'endwork'],
  'TA-24': ['roadwork', 'leftlaneclosed', 'merge', 'endwork', 'rightlaneclosed'],
  'TA-25': ['roadwork', 'leftlaneclosed', 'merge', 'endwork'],
  'TA-27': ['roadwork', 'onelane', 'trafficcontrols', 'endwork'],
  'TA-30': ['roadwork', 'leftlaneclosed', 'merge'],
  'TA-31': ['roadwork', 'merge'],
  'TA-32': ['roadwork', 'leftlaneclosed', 'rightlaneclosed', 'merge', 'endwork'],
  'TA-35': ['leftlaneclosed'],
  'TA-36': ['roadwork', 'endwork'],
  'TA-37': ['roadwork', 'rightlaneclosed', 'merge', 'endwork'],
  'TA-38': ['roadwork', 'laneends', 'leftlaneclosed', 'merge', 'endwork'],
  'TA-39': ['roadwork', 'twowaytraf', 'donotenter', 'keepright', 'endwork'],
  'TA-40': ['roadwork', 'yieldahead', 'mergeleft', 'twowaytraf', 'roadclosed', 'reversecurve', 'oneway', 'yield', 'donotenter'],
  'TA-41': ['twowaytraf', 'exitramp'],
  'TA-42': ['roadwork', 'rightlaneclosed', 'merge', 'exitramp', 'exitramp2'],
  'TA-43': ['roadwork', 'endwork'],
  'TA-44': ['roadwork', 'rightlaneclosed', 'merge', 'endwork'],
  'TA-45': ['roadwork', 'leftlaneclosed', 'merge', 'endwork'],
  'TA-46': ['roadwork', 'onelane', 'trafficcontrols', 'railroadxing', 'railcrossing', 'endwork'],
  'TA-47': ['roadwork', 'bicyclelaneclosed', 'bikelaneclosedahead', 'yieldtobikes', 'endwork'],
  'TA-48': ['roadwork', 'bicyclelaneclosed', 'bikelaneclosedahead', 'yieldtobikes'],
  'TA-49': ['pathworkahead', 'pathclosed'],
  'TA-50': ['roadwork', 'roadworkpath', 'pathclosed', 'yieldtobikes'],
  'TA-51': ['roadwork', 'shoulderwork', 'xxft', 'endwork'],
  'TA-52': ['roadwork', 'onelane', 'trafficcontrols'],
  'TA-54': ['roadwork', 'rightlaneclosed', 'merge', 'endwork'],
}

describe('TA_SCENARIOS contract (55 × 6P/CA)', () => {
  it('MUTCD title index is 54 federal TAs (Table 6P-1)', () => {
    expect(MUTCD_6P1_TA_TITLES).toHaveLength(MUTCD_6P1_TA_TITLES_LEN)
    expect(MUTCD_6P1_TA_TITLES_LEN).toBe(54)
  })

  it('federal scenarios TA-1…TA-54 use official Table 6P-1 titles (by id, not just display strings)', () => {
    for (const s of TA_SCENARIOS) {
      const m = s.id.match(/^TA-(\d+)$/)
      if (!m) continue
      const n = Number(m[1])
      if (n < 1 || n > 54) continue
      expect(s.title).toBe(MUTCD_6P1_TA_TITLES[n - 1]!)
    }
  })

  it('exports exactly 55 scenarios (TA-1…TA-54 + TA-101)', () => {
    expect(TA_SCENARIOS).toHaveLength(55)
    expect(new Set(TA_SCENARIOS.map((s) => s.id)).size).toBe(55)
  })

  it('every unique sign id used in any seed exists in SIGN_DATA (tcp catalog)', () => {
    const union = new Set<string>()
    for (const s of TA_SCENARIOS) {
      for (const id of getSignIdsFromSeed(s.seed)) {
        union.add(id)
        expect(SIGN_DATA[id], `Seed references unknown sign id "${id}"`).toBeDefined()
        expect(SIGN_DATA[id]!.label.length, id).toBeGreaterThan(0)
      }
    }
    expect(union.size).toBe(47)
  })

  for (const scenario of TA_SCENARIOS) {
    it(`${scenario.id}: assert.signs matches seed sign ids (order + uniqueness)`, () => {
      expect(scenario.assert.signs).toEqual(getSignIdsFromSeed(scenario.seed))
    })
  }

  for (const [taId, required] of Object.entries(MUTCD_MIN_SIGN_IDS) as [string, string[]][]) {
    it(`${taId} seed includes MUTCD-required sign ids (not just assert↔seed sync)`, () => {
      const sc = TA_SCENARIOS.find((s) => s.id === taId)
      expect(sc, `No scenario ${taId}`).toBeDefined()
      const have = new Set(getSignIdsFromSeed(sc!.seed))
      for (const id of required) {
        expect(have.has(id), `${taId} missing required sign "${id}"`).toBe(true)
      }
    })
  }

  for (const [taId, expected] of Object.entries(AUDITED_EXACT_SIGN_IDS) as [string, string[]][]) {
    it(`${taId} seed keeps the exact audited sign ids`, () => {
      const sc = TA_SCENARIOS.find((s) => s.id === taId)
      expect(sc, `No scenario ${taId}`).toBeDefined()
      expect(getSignIdsFromSeed(sc!.seed)).toEqual(expected)
    })
  }
})
