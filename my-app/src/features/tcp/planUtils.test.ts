import { beforeEach, describe, expect, it } from 'vitest'
import type { RoadType } from '../../types'
import {
  AUTOSAVE_KEY,
  createIntersectionRoads,
  normalizeForSearch,
  readAutosave,
} from './planUtils'

describe('planUtils', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('normalizes search text by lowercasing and stripping separators', () => {
    expect(normalizeForSearch('R1-1 / Main.St')).toBe('r11mainst')
    expect(normalizeForSearch('  KEEP-LEFT  ')).toBe('keepleft')
  })

  it('creates two perpendicular roads for a 4-way intersection', () => {
    const roadType: RoadType = {
      id: 'arterial',
      label: 'Arterial',
      lanes: 4,
      width: 80,
      realWidth: 48,
    }

    const roads = createIntersectionRoads(100, 200, '4way', roadType)

    expect(roads).toHaveLength(2)
    expect(roads[0]).toMatchObject({
      type: 'road',
      x1: -140,
      y1: 200,
      x2: 340,
      y2: 200,
      width: 80,
      realWidth: 48,
      lanes: 4,
      roadType: 'arterial',
    })
    expect(roads[1]).toMatchObject({
      type: 'road',
      x1: 100,
      y1: -40,
      x2: 100,
      y2: 440,
      width: 80,
      realWidth: 48,
      lanes: 4,
      roadType: 'arterial',
    })
    expect(roads[0].id).not.toBe(roads[1].id)
  })

  it('creates a T-junction with an upward branch only', () => {
    const roadType: RoadType = {
      id: '2lane',
      label: '2-Lane',
      lanes: 2,
      width: 60,
      realWidth: 24,
    }

    const roads = createIntersectionRoads(10, 20, 't', roadType)

    expect(roads).toHaveLength(2)
    expect(roads[0]).toMatchObject({ x1: -170, y1: 20, x2: 190, y2: 20 })
    expect(roads[1]).toMatchObject({ x1: 10, y1: 20, x2: 10, y2: -160 })
  })

  it('reads autosave payload from localStorage', () => {
    const payload = { name: 'Saved Plan', canvasState: { objects: [] } }
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(payload))

    expect(readAutosave()).toEqual(payload)
  })

  it('returns null when autosave JSON is malformed', () => {
    localStorage.setItem(AUTOSAVE_KEY, '{invalid json')
    expect(readAutosave()).toBeNull()
  })
})
