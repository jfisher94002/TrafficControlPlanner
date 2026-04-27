import { describe, it, expect } from 'vitest'
import { TA_SCENARIOS, SIGN_DATA, getSignIdsFromSeed } from './ta-scenarios'
import { MUTCD_6P1_TA_TITLES, MUTCD_6P1_TA_TITLES_LEN } from './mutcd-6p-1-titles'

/**
 * MUTCD minimum sign *ids* a scenario must place (beyond seed/assert sync).
 * Prevents a too-small seed (e.g. 2 signs) from passing if the figure needs 3+.
 * Extend as each TA is vetted against the manual.
 */
const MUTCD_MIN_SIGN_IDS: Partial<Record<string, string[]>> = {
  // ── Two-lane rural / shoulder ──────────────────────────────────────────────
  'TA-1':  ['roadwork'],
  'TA-2':  ['blastingzoneahead', 'turnoffradio', 'endblastingzone'],
  'TA-3':  ['roadworknextmi', 'shoulderwork', 'roadwork', 'endwork'],
  'TA-4':  ['roadworknextmi', 'shoulderwork', 'roadwork'],
  'TA-5':  ['roadwork', 'shoulderwork'],
  'TA-6':  ['shoulderwork', 'roadwork', 'merge'],
  'TA-7':  ['roadclosed', 'diversionrte'],
  'TA-8':  ['roadclosed', 'detour'],
  'TA-9':  ['roadclosed', 'detour'],
  // ── Two-lane alternating / flagging ───────────────────────────────────────
  'TA-10': ['roadwork', 'flaggerahead', 'onelane'],
  'TA-11': ['roadwork', 'onelane'],
  'TA-12': ['roadwork', 'signal'],
  'TA-13': ['roadclosed', 'detour'],
  'TA-14': ['roadwork', 'trucksentering'],
  'TA-15': ['roadwork', 'onelane'],
  'TA-16': ['surveyors'],
  'TA-17': ['roadwork', 'workers'],
  // ── Multi-lane streets / intersections ────────────────────────────────────
  'TA-18': ['roadwork', 'rightlaneends'],
  'TA-19': ['roadclosed', 'detour'],
  'TA-20': ['roadclosed', 'detour'],
  'TA-21': ['roadwork', 'merge'],
  'TA-22': ['roadwork', 'rightlaneends'],
  'TA-23': ['roadwork', 'leftlaneends', 'merge'],
  'TA-24': ['roadwork', 'onelane', 'prepstop'],
  'TA-25': ['roadwork', 'twolaneends', 'merge'],
  'TA-26': ['roadwork'],
  'TA-27': ['roadwork', 'rightlaneends'],
  // ── Pedestrian / bicycle ──────────────────────────────────────────────────
  'TA-28': ['roadwork', 'sidewalkclosed', 'peddetour'],
  'TA-29': ['xwalkclosed', 'peddetour'],
  // ── Multi-lane high-speed ─────────────────────────────────────────────────
  'TA-30': ['roadwork', 'centerlane', 'merge'],
  'TA-31': ['roadwork', 'flaggerahead', 'onelane'],
  'TA-32': ['roadwork', 'onelane', 'prepstop'],
  'TA-33': ['roadwork', 'merge'],
  'TA-34': ['roadwork', 'merge'],
  'TA-35': ['roadwork', 'workers'],
  // ── Freeway ───────────────────────────────────────────────────────────────
  'TA-36': ['roadwork', 'shiftleft'],
  'TA-37': ['roadwork', 'merge'],
  'TA-38': ['roadwork', 'centerlane', 'merge'],
  'TA-39': ['roadwork', 'onelane', 'prepstop'],
  'TA-40': ['rampclosed', 'detour'],
  'TA-41': ['exitclosed', 'detour'],
  'TA-42': ['roadwork', 'shoulderwork'],
  'TA-43': ['exitclosed', 'detour'],
  'TA-44': ['roadwork', 'shoulderwork'],
  'TA-45': ['roadwork', 'centerlane', 'onelane'],
  // ── Special situations ────────────────────────────────────────────────────
  'TA-46': ['roadwork', 'gradecrossing'],
  'TA-47': ['bikelaneclosed'],
  'TA-48': ['bikelaneclosed', 'detour'],
  'TA-49': ['sharedusepath', 'diversionrte'],
  'TA-50': ['sharedusepath', 'detour'],
  'TA-51': ['shoulderwork', 'bikelaneclosed'],
  'TA-52': ['roadwork', 'detour'],
  'TA-53': ['roadwork', 'circularint', 'flaggerahead'],
  'TA-54': ['roadwork', 'centerlane'],
  // ── CA supplement ─────────────────────────────────────────────────────────
  'TA-101': ['roadwork', 'bikelaneclosed', 'rightlaneends'],
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
    expect(union.size).toBe(32)
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
})
