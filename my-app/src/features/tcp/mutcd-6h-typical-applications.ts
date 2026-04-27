/**
 * MUTCD 2009 — Chapter 6H Typical Applications (and matching Table 6P-1 TAs) draw on:
 * - Table 6F-1 (TTC) — see `mutcd-6f1-designations.ts`
 * - Freeway / expressway guide and route assembly signs in Table 2E-1 (and shared 2D guide rows)
 *   for detours, exit gore, route shields, and cardinal/auxiliary assemblies cited in 6H notes.
 * Every atomic designation in the merge must have ≥1 `SignData` with that `mutcd` in `tcpCatalog`.
 * @see https://mutcd.fhwa.dot.gov/htm/2009r1r2/part6/part6h.htm
 * @see https://mutcd.fhwa.dot.gov/htm/2009r1r2/part2/part2e.htm
 */
import { MUTCD_TABLE_6F1_SIGN_DESIGNATIONS } from './mutcd-6f1-designations'

/**
 * Atomic sign designations from MUTCD 2009 Table 2E-1 (and matching 2D guide rows),
 * expanded from combined rows (e.g. M1-2,3 → M1-2, M1-3). Disjoint from Table 6F-1.
 */
export const MUTCD_TABLE_2E1_ATOMIC_GUIDE_FOR_6H: readonly string[] = [
  'D1-1', 'D1-1a', 'D1-2', 'D1-2a', 'D1-3', 'D1-3a', 'D2-1', 'D2-2', 'D2-3', 'D3-1', 'D3-1a', 'D3-2', 'D4-2', 'D6-4', 'D6-4a', 'D8-1', 'D8-2', 'D8-3', 'D13-1', 'D13-2', 'D13-3', 'D13-3a', 'D15-1', 'D17-1', 'D17-2', 'D17-7', 'E1-5P', 'E1-5aP', 'E1-5bP', 'E5-1', 'E5-1a', 'E5-1bP', 'E5-1c', 'E6-2', 'E6-2a', 'E11-1', 'E11-1a', 'E11-1b', 'E11-1c', 'E11-1d', 'E11-1e', 'E11-1f', 'E11-2', 'E13-1P', 'E13-2', 'M1-1', 'M1-2', 'M1-3', 'M1-4', 'M1-5', 'M1-6', 'M1-7', 'M1-10', 'M1-10a', 'M2-1', 'M2-2', 'M3-1', 'M3-2', 'M3-3', 'M3-4', 'M4-1', 'M4-1a', 'M4-2', 'M4-3', 'M4-4', 'M4-5', 'M4-6', 'M4-7', 'M4-7a', 'M4-14', 'M5-1', 'M5-2', 'M5-3', 'M5-4', 'M5-5', 'M5-6', 'M6-1', 'M6-2', 'M6-2a', 'M6-3', 'M6-4', 'M6-5', 'M6-6', 'M6-7',
]

const sortedUnique = (xs: readonly string[]) => [...new Set(xs)].sort((a, b) => a.localeCompare(b, 'en'))

function assertDisjoint(a: readonly string[], b: readonly string[], ctx: string) {
  const sb = new Set(b)
  const overlap = a.filter((x) => sb.has(x))
  if (overlap.length) throw new Error(`${ctx}: overlap ${overlap.join(', ')}`)
}

assertDisjoint(MUTCD_TABLE_6F1_SIGN_DESIGNATIONS, MUTCD_TABLE_2E1_ATOMIC_GUIDE_FOR_6H, '6F-1 vs 2E-1/2D guide supplement')

export const MUTCD_6H_TYPICAL_APPLICATIONS_SIGN_DESIGNATIONS: readonly string[] = sortedUnique([
  ...MUTCD_TABLE_6F1_SIGN_DESIGNATIONS,
  ...MUTCD_TABLE_2E1_ATOMIC_GUIDE_FOR_6H,
])

export const MUTCD_6H_TYPICAL_APPLICATIONS_LEN = 233
export const MUTCD_2E1_GUIDE_LEN = 84

if (MUTCD_TABLE_2E1_ATOMIC_GUIDE_FOR_6H.length !== MUTCD_2E1_GUIDE_LEN) {
  throw new Error('MUTCD_2E1_GUIDE_LEN out of sync with MUTCD_TABLE_2E1_ATOMIC_GUIDE_FOR_6H')
}
if (MUTCD_6H_TYPICAL_APPLICATIONS_LEN !== MUTCD_TABLE_6F1_SIGN_DESIGNATIONS.length + MUTCD_2E1_GUIDE_LEN) {
  throw new Error('MUTCD_6H_TYPICAL_APPLICATIONS_LEN should equal 6F-1 + 2E-1/2D guide count')
}
if (MUTCD_6H_TYPICAL_APPLICATIONS_SIGN_DESIGNATIONS.length !== MUTCD_6H_TYPICAL_APPLICATIONS_LEN) {
  throw new Error('6H merge produced unexpected length (duplicate?)')
}
