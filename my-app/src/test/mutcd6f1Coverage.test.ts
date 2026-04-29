import { describe, it, expect } from 'vitest'
import { SIGN_CATEGORIES } from '../features/tcp/tcpCatalog'
import { MUTCD_TABLE_6F1_LEN, MUTCD_TABLE_6F1_SIGN_DESIGNATIONS } from '../features/tcp/mutcd-6f1-designations'

/**
 * MUTCD 2009 Table 6F-1: every TTC sign designation used in the FHWA size table
 * must be placeable in the app (≥1 catalog entry with that `mutcd` string).
 * This is the work-zone / TCP-relevant “MUTCD” inventory for compliance tooling.
 * @see https://mutcd.fhwa.dot.gov/htm/2009r1r2/part6/part6f.htm
 */
describe('MUTCD Table 6F-1 (TTC) catalog coverage', () => {
  it('has the expected designation list length (atomic Table 6F-1 rows expanded)', () => {
    expect(MUTCD_TABLE_6F1_SIGN_DESIGNATIONS).toHaveLength(MUTCD_TABLE_6F1_LEN)
  })

  it('each Table 6F-1 atomic designation appears in SIGN_CATEGORIES', () => {
    const have = new Set(
      Object.values(SIGN_CATEGORIES)
        .flatMap((c) => c.signs)
        .map((s) => s.mutcd)
        .filter((m): m is string => Boolean(m)),
    )
    const missing = MUTCD_TABLE_6F1_SIGN_DESIGNATIONS.filter((d) => !have.has(d))
    expect(missing, `Add catalog sign(s) for: ${missing.join(', ')}`).toEqual([])
  })
})
