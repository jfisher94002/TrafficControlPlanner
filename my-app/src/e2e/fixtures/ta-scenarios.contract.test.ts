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
    expect(union.size).toBe(35)
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
