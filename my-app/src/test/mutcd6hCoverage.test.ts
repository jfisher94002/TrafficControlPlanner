import { describe, it, expect } from 'vitest'
import { SIGN_CATEGORIES } from '../features/tcp/tcpCatalog'
import {
  MUTCD_2E1_GUIDE_LEN,
  MUTCD_6H_TYPICAL_APPLICATIONS_LEN,
  MUTCD_6H_TYPICAL_APPLICATIONS_SIGN_DESIGNATIONS,
} from '../features/tcp/mutcd-6h-typical-applications'
import { MUTCD_TABLE_6F1_LEN } from '../features/tcp/mutcd-6f1-designations'

/**
 * MUTCD 2009 Chapter 6H Typical Applications: the practical TCP inventory is
 * Table 6F-1 (TTC) plus atomic guide / route / exit gore / detour designations from
 * FHWA Table 2E-1 (and shared 2D entries). Every merged designation is placeable
 * in the app (≥1 catalog entry with that `mutcd` string).
 * @see https://mutcd.fhwa.dot.gov/htm/2009r1r2/part6/part6h.htm
 */
describe('MUTCD 6H Typical Applications catalog coverage (6F-1 ∪ 2E-1/2D guide)', () => {
  it('has the expected merged designation list length (149 + 84)', () => {
    expect(MUTCD_6H_TYPICAL_APPLICATIONS_LEN).toBe(MUTCD_TABLE_6F1_LEN + MUTCD_2E1_GUIDE_LEN)
    expect(MUTCD_6H_TYPICAL_APPLICATIONS_SIGN_DESIGNATIONS).toHaveLength(MUTCD_6H_TYPICAL_APPLICATIONS_LEN)
  })

  it('each merged designation appears in SIGN_CATEGORIES', () => {
    const have = new Set(
      Object.values(SIGN_CATEGORIES)
        .flatMap((c) => c.signs)
        .map((s) => s.mutcd)
        .filter((m): m is string => Boolean(m)),
    )
    const missing = MUTCD_6H_TYPICAL_APPLICATIONS_SIGN_DESIGNATIONS.filter((d) => !have.has(d))
    expect(missing, `Add catalog sign(s) for: ${missing.join(', ')}`).toEqual([])
  })
})
