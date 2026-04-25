/**
 * Sign catalog integrity tests.
 *
 * 1. ID uniqueness — no sign id appears more than once across all categories.
 * 2. Label length — no label exceeds 12 characters (drawSign.ts truncates at 13+).
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

  it('has exactly 206 signs total', () => {
    expect(allSigns).toHaveLength(206)
  })
})

// ─── Label length ─────────────────────────────────────────────────────────────

describe('SIGN_CATEGORIES — label length', () => {
  it('has no label longer than 12 characters', () => {
    const violations = allSigns
      .filter((s) => s.label.length > 12)
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
