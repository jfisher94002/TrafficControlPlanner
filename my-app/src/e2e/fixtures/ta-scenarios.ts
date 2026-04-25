/**
 * MUTCD Chapter 6P — Typical Application (TA) scenario fixtures.
 *
 * 54 scenarios total: 11 fully defined, 43 stubs awaiting seed data.
 * Stubs have `skip` set so they are counted but skipped in CI until
 * their seed objects are defined.
 *
 * Scenario numbering follows MUTCD 11th Edition Chapter 6H/6P.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MapCenter {
  lat: number
  lon: number
  zoom: number
}

export interface TAAssert {
  /** signData.id values that must be present */
  signs?: string[]
  /** deviceData.id values that must be present */
  devices?: string[]
  /** object .type values that must be present (e.g. 'taper', 'zone') */
  objectTypes?: string[]
  /** canvas must have at least this many taper objects */
  minTapers?: number
  /** canvas must have at least this many of each device id */
  minDevices?: Record<string, number>
  /** Taper length formula check: L = laneWidth × speed */
  taperFormula?: { speed: number; laneWidth: number; expectedFt: number }
  /** Assert zero device objects on canvas */
  noDevices?: boolean
}

export interface TAScenario {
  id: string
  title: string
  seed: { mapCenter: MapCenter; objects: unknown[] }
  assert: TAAssert
  /** If set, the test is skipped with this reason string. */
  skip?: string
}

// ─── Seed object builders ─────────────────────────────────────────────────────

const MAP_CENTER: MapCenter = { lat: 37.7749, lon: -122.4194, zoom: 16 }

const sign = (id: string, x: number, y: number, mutcd?: string) => ({
  id: `sign-${id}-${x}`,
  type: 'sign',
  x, y, rotation: 0, scale: 1,
  signData: {
    id,
    label: id.toUpperCase(),
    shape: 'diamond',
    color: '#f97316',
    textColor: '#111',
    ...(mutcd ? { mutcd } : {}),
  },
})

const taper = (
  id: string, x: number, y: number,
  speed = 45, laneWidth = 12, numLanes = 1,
  overrideLength?: number,
) => ({
  id, type: 'taper', x, y, rotation: 0,
  speed, laneWidth,
  taperLength: overrideLength ?? laneWidth * speed,
  manualLength: false,
  numLanes,
})

const device = (id: string, deviceId: string, x: number, y: number) => ({
  id, type: 'device', x, y, rotation: 0, scale: 1,
  deviceData: { id: deviceId, label: deviceId, icon: '▣', color: '#fbbf24' },
})

const zone = (id: string, x: number, y: number, w = 300, h = 60) => ({
  id, type: 'zone', x, y, w, h,
})

const STUB_SEED = { mapCenter: MAP_CENTER, objects: [] }
const STUB_ASSERT: TAAssert = {}
const STUB = 'stub — seed objects not yet defined'

// ─── Scenario list ────────────────────────────────────────────────────────────

export const TA_SCENARIOS: TAScenario[] = [

  // ── TA-1: Work Beyond the Shoulder ────────────────────────────────────────
  {
    id: 'TA-1',
    title: 'Work Beyond the Shoulder',
    seed: {
      mapCenter: MAP_CENTER,
      objects: [
        sign('shoulderwork', 100, 200, 'W21-5a'),
        sign('roadwork', 200, 200, 'W20-1'),
      ],
    },
    assert: {
      signs: ['shoulderwork', 'roadwork'],
    },
  },

  // ── TA-2: Work on Shoulder with Parking Lane ───────────────────────────────
  {
    id: 'TA-2',
    title: 'Work on Shoulder with Parking Lane',
    seed: STUB_SEED,
    assert: STUB_ASSERT,
    skip: STUB,
  },

  // ── TA-3: Work on the Shoulder ─────────────────────────────────────────────
  {
    id: 'TA-3',
    title: 'Work on the Shoulder',
    seed: {
      mapCenter: MAP_CENTER,
      objects: [
        sign('shoulderwork', 100, 200, 'W21-5a'),
        sign('roadwork', 250, 200, 'W20-1'),
        taper('taper-1', 400, 300),
        zone('zone-1', 550, 270),
      ],
    },
    assert: {
      signs: ['shoulderwork', 'roadwork'],
      objectTypes: ['taper', 'zone'],
    },
  },

  // ── TA-4: Sidewalk Work ────────────────────────────────────────────────────
  {
    id: 'TA-4',
    title: 'Sidewalk Work',
    seed: STUB_SEED,
    assert: STUB_ASSERT,
    skip: STUB,
  },

  // ── TA-5: Moveable Operation (Moving Work Zone) ────────────────────────────
  {
    id: 'TA-5',
    title: 'Moveable Operation (Moving Work Zone)',
    seed: STUB_SEED,
    assert: STUB_ASSERT,
    skip: STUB,
  },

  // ── TA-6: Shoulder Work with Minor Encroachment ───────────────────────────
  {
    id: 'TA-6',
    title: 'Shoulder Work with Minor Encroachment',
    seed: {
      mapCenter: MAP_CENTER,
      objects: [
        sign('shoulderwork', 100, 200, 'W21-5a'),
        sign('roadwork', 200, 200, 'W20-1'),
        sign('merge', 350, 200, 'W4-2'),
        taper('taper-1', 500, 300),
        zone('zone-1', 650, 270),
      ],
    },
    assert: {
      signs: ['shoulderwork', 'merge'],
      objectTypes: ['taper'],
    },
  },

  // ── TA-7: Work Beyond Shoulder on Limited Access ───────────────────────────
  {
    id: 'TA-7',
    title: 'Work Beyond Shoulder on Limited Access',
    seed: STUB_SEED,
    assert: STUB_ASSERT,
    skip: STUB,
  },

  // ── TA-8: Two-Lane Road Lane Closure with Flaggers ────────────────────────
  {
    id: 'TA-8',
    title: 'Two-Lane Road Lane Closure with Flaggers',
    seed: STUB_SEED,
    assert: STUB_ASSERT,
    skip: STUB,
  },

  // ── TA-9: Two-Lane Road Short Duration Lane Closure ───────────────────────
  {
    id: 'TA-9',
    title: 'Two-Lane Road Short Duration Lane Closure',
    seed: STUB_SEED,
    assert: STUB_ASSERT,
    skip: STUB,
  },

  // ── TA-10: Lane Closure using Flaggers ────────────────────────────────────
  {
    id: 'TA-10',
    title: 'Lane Closure using Flaggers',
    seed: {
      mapCenter: MAP_CENTER,
      objects: [
        sign('roadwork',     100, 300, 'W20-1'),
        sign('flaggerahead', 300, 300, 'W20-7a'),
        sign('onelane',      500, 300, 'W20-4a'),
        taper('taper-1', 700, 300),
        zone('zone-1', 900, 270),
        device('flagger-1', 'flagger', 880, 300),
        device('flagger-2', 'flagger', 1200, 300),
      ],
    },
    assert: {
      signs: ['roadwork', 'flaggerahead', 'onelane'],
      devices: ['flagger'],
      objectTypes: ['taper', 'zone'],
    },
  },

  // ── TA-11: Lane Closure with Low Traffic Volumes ──────────────────────────
  {
    id: 'TA-11',
    title: 'Lane Closure with Low Traffic Volumes',
    seed: {
      mapCenter: MAP_CENTER,
      objects: [
        sign('roadwork', 100, 300, 'W20-1'),
        sign('onelane',  300, 300, 'W20-4a'),
        taper('taper-1', 500, 300),
        zone('zone-1',   700, 270),
      ],
    },
    assert: {
      signs: ['roadwork', 'onelane'],
      objectTypes: ['taper', 'zone'],
      noDevices: true,
    },
  },

  // ── TA-12: Lane Closure using Traffic Control Signals ─────────────────────
  {
    id: 'TA-12',
    title: 'Lane Closure using Traffic Control Signals',
    seed: {
      mapCenter: MAP_CENTER,
      objects: [
        sign('roadwork', 100, 300, 'W20-1'),
        sign('signal',   300, 300, 'W3-3'),
        taper('taper-1', 500, 300),
        zone('zone-1',   700, 270),
        device('sig-1', 'temp_signal', 690, 300),
        device('sig-2', 'temp_signal', 1100, 300),
      ],
    },
    assert: {
      signs: ['signal'],
      devices: ['temp_signal'],
      objectTypes: ['taper', 'zone'],
      minDevices: { temp_signal: 2 },
    },
  },

  // ── TA-13: Lane Closure Near Intersection (Two-Lane) ──────────────────────
  {
    id: 'TA-13',
    title: 'Lane Closure Near Side of Intersection (Two-Lane)',
    seed: STUB_SEED,
    assert: STUB_ASSERT,
    skip: STUB,
  },

  // ── TA-14: Lane Closure at Intersection with Turn Lane ────────────────────
  {
    id: 'TA-14',
    title: 'Lane Closure at Intersection with Turn Lane',
    seed: STUB_SEED,
    assert: STUB_ASSERT,
    skip: STUB,
  },

  // ── TA-15: Work on Both Shoulders (Two-Lane) ──────────────────────────────
  {
    id: 'TA-15',
    title: 'Work on Both Shoulders (Two-Lane)',
    seed: STUB_SEED,
    assert: STUB_ASSERT,
    skip: STUB,
  },

  // ── TA-16: Left Lane Closure on Multilane Highway ─────────────────────────
  {
    id: 'TA-16',
    title: 'Left Lane Closure on Multilane Highway',
    seed: STUB_SEED,
    assert: STUB_ASSERT,
    skip: STUB,
  },

  // ── TA-17: Right Lane Closure on Multilane Highway ────────────────────────
  {
    id: 'TA-17',
    title: 'Right Lane Closure on Multilane Highway',
    seed: STUB_SEED,
    assert: STUB_ASSERT,
    skip: STUB,
  },

  // ── TA-18: Two Adjacent Lanes Closed on Multilane Highway ─────────────────
  {
    id: 'TA-18',
    title: 'Two Adjacent Lanes Closed on Multilane Highway',
    seed: STUB_SEED,
    assert: STUB_ASSERT,
    skip: STUB,
  },

  // ── TA-19: Lane Closure on Curve ──────────────────────────────────────────
  {
    id: 'TA-19',
    title: 'Lane Closure on Curve',
    seed: STUB_SEED,
    assert: STUB_ASSERT,
    skip: STUB,
  },

  // ── TA-20: Ramp Closure ───────────────────────────────────────────────────
  {
    id: 'TA-20',
    title: 'Ramp Closure',
    seed: STUB_SEED,
    assert: STUB_ASSERT,
    skip: STUB,
  },

  // ── TA-21: Lane Closure Near Side of Intersection ─────────────────────────
  {
    id: 'TA-21',
    title: 'Lane Closure on Near Side of Intersection',
    seed: {
      mapCenter: MAP_CENTER,
      objects: [
        sign('roadwork', 100, 300, 'W20-1'),
        sign('merge',    300, 300, 'W4-2'),
        taper('taper-1', 500, 300),
        zone('zone-1',   700, 270),
      ],
    },
    assert: {
      signs: ['roadwork'],
      objectTypes: ['taper', 'zone'],
    },
  },

  // ── TA-22: Right Lane Closure Far Side of Intersection ────────────────────
  {
    id: 'TA-22',
    title: 'Right Lane Closure on Far Side of Intersection',
    seed: {
      mapCenter: MAP_CENTER,
      objects: [
        sign('roadwork',      100, 300, 'W20-1'),
        sign('rightlaneends', 300, 300, 'W9-1'),
        taper('taper-1', 600, 300),
        zone('zone-1',   800, 270),
      ],
    },
    assert: {
      signs: ['roadwork', 'rightlaneends'],
      objectTypes: ['taper', 'zone'],
    },
  },

  // ── TA-23: Left Lane Closure Near Intersection ─────────────────────────────
  {
    id: 'TA-23',
    title: 'Left Lane Closure Near Intersection',
    seed: STUB_SEED,
    assert: STUB_ASSERT,
    skip: STUB,
  },

  // ── TA-24: Median Crossover ────────────────────────────────────────────────
  {
    id: 'TA-24',
    title: 'Median Crossover',
    seed: STUB_SEED,
    assert: STUB_ASSERT,
    skip: STUB,
  },

  // ── TA-25: Contraflow Lane ─────────────────────────────────────────────────
  {
    id: 'TA-25',
    title: 'Contraflow Lane Operation',
    seed: STUB_SEED,
    assert: STUB_ASSERT,
    skip: STUB,
  },

  // ── TA-26: Divided Highway Shoulder Work ──────────────────────────────────
  {
    id: 'TA-26',
    title: 'Divided Highway Shoulder Work',
    seed: STUB_SEED,
    assert: STUB_ASSERT,
    skip: STUB,
  },

  // ── TA-27: Divided Highway Right Lane Closure ─────────────────────────────
  {
    id: 'TA-27',
    title: 'Divided Highway Right Lane Closure',
    seed: STUB_SEED,
    assert: STUB_ASSERT,
    skip: STUB,
  },

  // ── TA-28: Divided Highway Left Lane Closure ──────────────────────────────
  {
    id: 'TA-28',
    title: 'Divided Highway Left Lane Closure',
    seed: STUB_SEED,
    assert: STUB_ASSERT,
    skip: STUB,
  },

  // ── TA-29: Divided Highway Median Work ────────────────────────────────────
  {
    id: 'TA-29',
    title: 'Divided Highway Median Work',
    seed: STUB_SEED,
    assert: STUB_ASSERT,
    skip: STUB,
  },

  // ── TA-30: Divided Highway Ramp Closure ───────────────────────────────────
  {
    id: 'TA-30',
    title: 'Divided Highway Ramp Closure',
    seed: STUB_SEED,
    assert: STUB_ASSERT,
    skip: STUB,
  },

  // ── TA-31: Divided Highway Lane Closure with Crossover ────────────────────
  {
    id: 'TA-31',
    title: 'Divided Highway Lane Closure with Crossover',
    seed: STUB_SEED,
    assert: STUB_ASSERT,
    skip: STUB,
  },

  // ── TA-32: Contraflow on Divided Highway ──────────────────────────────────
  {
    id: 'TA-32',
    title: 'Contraflow Operation on Divided Highway',
    seed: STUB_SEED,
    assert: STUB_ASSERT,
    skip: STUB,
  },

  // ── TA-33: Stationary Lane Closure on Divided Highway ─────────────────────
  {
    id: 'TA-33',
    title: 'Stationary Lane Closure on a Divided Highway',
    seed: {
      mapCenter: MAP_CENTER,
      objects: [
        sign('roadwork', 100, 300, 'W20-1'),
        sign('merge',    400, 300, 'W4-2'),
        taper('taper-1', 700, 300, 65, 12, 1, 780),
        zone('zone-1', 1000, 270),
        device('ab-1', 'arrow_board', 980, 300),
      ],
    },
    assert: {
      signs: ['roadwork'],
      devices: ['arrow_board'],
      objectTypes: ['taper', 'zone'],
      taperFormula: { speed: 65, laneWidth: 12, expectedFt: 780 },
    },
  },

  // ── TA-34: Moving Operations on Divided Highway ───────────────────────────
  {
    id: 'TA-34',
    title: 'Moving Operations on Divided Highway',
    seed: STUB_SEED,
    assert: STUB_ASSERT,
    skip: STUB,
  },

  // ── TA-35: Divided Highway Double Lane Closure ────────────────────────────
  {
    id: 'TA-35',
    title: 'Divided Highway Double Lane Closure',
    seed: STUB_SEED,
    assert: STUB_ASSERT,
    skip: STUB,
  },

  // ── TA-36: Freeway Shoulder Work ──────────────────────────────────────────
  {
    id: 'TA-36',
    title: 'Freeway Shoulder Work',
    seed: STUB_SEED,
    assert: STUB_ASSERT,
    skip: STUB,
  },

  // ── TA-37: Double Lane Closure on a Freeway ───────────────────────────────
  {
    id: 'TA-37',
    title: 'Double Lane Closure on a Freeway',
    seed: {
      mapCenter: MAP_CENTER,
      objects: [
        sign('roadwork', 100, 300, 'W20-1'),
        sign('merge',    400, 300, 'W4-2'),
        taper('taper-1', 700, 300, 65, 12, 2),
        taper('taper-2', 900, 300, 65, 12, 1),
        zone('zone-1',  1100, 270),
        device('ab-1', 'arrow_board', 680, 300),
        device('ab-2', 'arrow_board', 880, 300),
      ],
    },
    assert: {
      objectTypes: ['taper', 'zone'],
      devices: ['arrow_board'],
      minTapers: 2,
      minDevices: { arrow_board: 2 },
    },
  },

  // ── TA-38: Freeway Single Lane Closure ────────────────────────────────────
  {
    id: 'TA-38',
    title: 'Freeway Single Lane Closure',
    seed: STUB_SEED,
    assert: STUB_ASSERT,
    skip: STUB,
  },

  // ── TA-39: Freeway Left Lane Closure ──────────────────────────────────────
  {
    id: 'TA-39',
    title: 'Freeway Left Lane Closure',
    seed: STUB_SEED,
    assert: STUB_ASSERT,
    skip: STUB,
  },

  // ── TA-40: Freeway On-Ramp Closure ────────────────────────────────────────
  {
    id: 'TA-40',
    title: 'Freeway On-Ramp Closure',
    seed: STUB_SEED,
    assert: STUB_ASSERT,
    skip: STUB,
  },

  // ── TA-41: Freeway Off-Ramp Closure ───────────────────────────────────────
  {
    id: 'TA-41',
    title: 'Freeway Off-Ramp Closure',
    seed: STUB_SEED,
    assert: STUB_ASSERT,
    skip: STUB,
  },

  // ── TA-42: Freeway Median Work ────────────────────────────────────────────
  {
    id: 'TA-42',
    title: 'Freeway Median Work',
    seed: STUB_SEED,
    assert: STUB_ASSERT,
    skip: STUB,
  },

  // ── TA-43: Freeway Crossover Operation ────────────────────────────────────
  {
    id: 'TA-43',
    title: 'Freeway Crossover Operation',
    seed: STUB_SEED,
    assert: STUB_ASSERT,
    skip: STUB,
  },

  // ── TA-44: Freeway Contraflow ─────────────────────────────────────────────
  {
    id: 'TA-44',
    title: 'Freeway Contraflow Operation',
    seed: STUB_SEED,
    assert: STUB_ASSERT,
    skip: STUB,
  },

  // ── TA-45: Freeway Moving Operations ──────────────────────────────────────
  {
    id: 'TA-45',
    title: 'Freeway Moving Operations',
    seed: STUB_SEED,
    assert: STUB_ASSERT,
    skip: STUB,
  },

  // ── TA-46: Intersection Closure ───────────────────────────────────────────
  {
    id: 'TA-46',
    title: 'Intersection Closure',
    seed: STUB_SEED,
    assert: STUB_ASSERT,
    skip: STUB,
  },

  // ── TA-47: Intersection Partial Closure ───────────────────────────────────
  {
    id: 'TA-47',
    title: 'Intersection Partial Closure',
    seed: STUB_SEED,
    assert: STUB_ASSERT,
    skip: STUB,
  },

  // ── TA-48: Sidewalk and Crosswalk Closure ─────────────────────────────────
  {
    id: 'TA-48',
    title: 'Sidewalk and Crosswalk Closure',
    seed: STUB_SEED,
    assert: STUB_ASSERT,
    skip: STUB,
  },

  // ── TA-49: Urban Pedestrian Detour ────────────────────────────────────────
  {
    id: 'TA-49',
    title: 'Urban Pedestrian Detour',
    seed: STUB_SEED,
    assert: STUB_ASSERT,
    skip: STUB,
  },

  // ── TA-50: Night Work Zone ────────────────────────────────────────────────
  {
    id: 'TA-50',
    title: 'Night Work Zone Lighting',
    seed: STUB_SEED,
    assert: STUB_ASSERT,
    skip: STUB,
  },

  // ── TA-51: Complex Urban Intersection Work ────────────────────────────────
  {
    id: 'TA-51',
    title: 'Complex Urban Intersection Work',
    seed: STUB_SEED,
    assert: STUB_ASSERT,
    skip: STUB,
  },

  // ── TA-52: Special Event Traffic Control ──────────────────────────────────
  {
    id: 'TA-52',
    title: 'Special Event Traffic Control',
    seed: STUB_SEED,
    assert: STUB_ASSERT,
    skip: STUB,
  },

  // ── TA-53: Work on Bridge or Structure ────────────────────────────────────
  {
    id: 'TA-53',
    title: 'Work on Bridge or Structure',
    seed: STUB_SEED,
    assert: STUB_ASSERT,
    skip: STUB,
  },

  // ── TA-54: High-Speed Road Moving Operations ──────────────────────────────
  {
    id: 'TA-54',
    title: 'High-Speed Road Moving Operations',
    seed: STUB_SEED,
    assert: STUB_ASSERT,
    skip: STUB,
  },

  // ── TA-101(CA): Right Lane + Bike Lane Closure (California supplement) ─────
  {
    id: 'TA-101',
    title: 'Right Lane + Bike Lane Closure (CA)',
    seed: {
      mapCenter: MAP_CENTER,
      objects: [
        sign('roadwork',       100, 300, 'W20-1'),
        sign('bikelaneclosed', 300, 300, 'R9-10a'),
        sign('rightlaneends',  500, 300, 'W9-1'),
        taper('taper-1', 700, 300),
        zone('zone-1',   900, 270),
      ],
    },
    assert: {
      signs: ['bikelaneclosed', 'rightlaneends'],
      objectTypes: ['taper', 'zone'],
    },
  },

]
