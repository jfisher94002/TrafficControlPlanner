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

function parseBackendGeneratorSignIds(fileContents: string): string[] {
  const ids = new Set<string>()

  // Parse explicit ALL_SIGNS tuple rows: ("id", "LABEL", "shape", ...)
  const tupleIdPattern = /^\s*\("([a-z0-9]+)",\s*"[^"]*",\s*"(?:octagon|diamond|triangle|circle|shield|rect)"/gm
  let match: RegExpExecArray | null
  while ((match = tupleIdPattern.exec(fileContents)) !== null) {
    ids.add(match[1])
  }

  // Parse speed sign list-comprehension source: for mph in (15, 20, ...)
  const speedMphPattern = /for mph in\s*\(([^)]+)\)/
  const speedMphMatch = speedMphPattern.exec(fileContents)
  if (speedMphMatch) {
    speedMphMatch[1]
      .split(',')
      .map((token) => Number(token.trim()))
      .filter((mph) => Number.isFinite(mph))
      .forEach((mph) => ids.add(`speed${mph}`))
  }

  return [...ids]
}

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

  it('has exactly 200 signs total', () => {
    expect(allSigns).toHaveLength(200)
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

  it('keeps backend/generate_signs.py ALL_SIGNS ids in sync with frontend catalog ids', () => {
    const generatorPath = path.resolve(process.cwd(), '../backend/generate_signs.py')
    const generatorContents = fs.readFileSync(generatorPath, 'utf8')
    const backendIds = new Set(parseBackendGeneratorSignIds(generatorContents))
    const frontendIds = new Set(allSigns.map((s) => s.id))

    const missingInBackend = [...frontendIds].filter((id) => !backendIds.has(id))
    const extraInBackend = [...backendIds].filter((id) => !frontendIds.has(id))

    expect({ missingInBackend, extraInBackend }).toEqual({
      missingInBackend: [],
      extraInBackend: [],
    })
  })
})
