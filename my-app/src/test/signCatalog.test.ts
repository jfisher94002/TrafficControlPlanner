/**
 * Sign catalog integrity tests.
 *
 * 1. ID uniqueness — no sign id appears more than once across all categories.
 * 2. Label length — keep legends readable on canvas; drawSign word-wraps (no hard 12-char cap).
 * 3. SVG parity — every catalog id has a corresponding .svg in backend/signs/.
 */
import { describe, it, expect } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { SIGN_CATEGORIES } from '../features/tcp/tcpCatalog'

// ─── Collect all signs from the catalog ──────────────────────────────────────

const allSigns = Object.values(SIGN_CATEGORIES).flatMap((cat) => cat.signs)

// ─── ID uniqueness ────────────────────────────────────────────────────────────

describe('SIGN_CATEGORIES — ID uniqueness', () => {
  it('has no duplicate sign ids across all categories', () => {
    const ids = allSigns.map((s) => s.id)
    const seen = new Set<string>()
    const dupes: string[] = []
    for (const id of ids) {
      if (seen.has(id)) dupes.push(id)
      seen.add(id)
    }
    expect(dupes).toEqual([])
  })

  it('has exactly 374 signs total', () => {
    expect(allSigns).toHaveLength(374)
  })
})

describe('SIGN_CATEGORIES — work-zone warning coverage', () => {
  it('includes the MUTCD work-zone warning signs added for activity areas', () => {
    const warningSigns = new Map(SIGN_CATEGORIES.warning.signs.map((sign) => [sign.id, sign]))

    expect(Object.fromEntries(
      [
        'endsroadwork',
        'prepstop',
        'surveycrew',
        'utilcrew',
        'nightwork',
        'roadworknextmi',
      ].map((id) => {
        const sign = warningSigns.get(id)
        return [id, sign && {
          label: sign.label,
          shape: sign.shape,
          color: sign.color,
          textColor: sign.textColor,
          mutcd: sign.mutcd,
        }]
      }),
    )).toEqual({
      endsroadwork: { label: 'ENDS RD WORK', shape: 'diamond', color: '#f97316', textColor: '#111', mutcd: 'G20-2' },
      prepstop: { label: 'PREP TO STOP', shape: 'diamond', color: '#f97316', textColor: '#111', mutcd: 'W3-4' },
      surveycrew: { label: 'SURVEY CREW', shape: 'diamond', color: '#f97316', textColor: '#111', mutcd: 'W21-6' },
      utilcrew: { label: 'UTIL CREW', shape: 'diamond', color: '#f97316', textColor: '#111', mutcd: 'W21-7' },
      nightwork: { label: 'NIGHT WORK', shape: 'diamond', color: '#f97316', textColor: '#111', mutcd: 'W20-14' },
      roadworknextmi: { label: 'ROAD WORK NEXT XX MILES', shape: 'rect', color: '#f97316', textColor: '#111', mutcd: 'G20-1' },
    })
  })
})

// ─── Label length ─────────────────────────────────────────────────────────────

describe('SIGN_CATEGORIES — label length', () => {
  it('has no label longer than 32 characters (longer MUTCD / multi-word temp signs use word-wrap)', () => {
    const violations = allSigns
      .filter((s) => s.label.length > 32)
      .map((s) => `${s.id}: "${s.label}" (${s.label.length})`)
    expect(violations).toEqual([])
  })
})

// ─── SVG parity ──────────────────────────────────────────────────────────────

describe('SIGN_CATEGORIES — SVG parity', () => {
  // process.cwd() is my-app/ when Vitest runs; backend/signs is one level up
  const signsDir = path.resolve(process.cwd(), '../backend/signs')

  it('backend/signs/ directory exists', () => {
    expect(fs.existsSync(signsDir)).toBe(true)
  })

  it('every catalog sign id has a matching .svg file', () => {
    const missing = allSigns
      .filter((s) => !fs.existsSync(path.join(signsDir, `${s.id}.svg`)))
      .map((s) => s.id)
    expect(missing).toEqual([])
  })
})
