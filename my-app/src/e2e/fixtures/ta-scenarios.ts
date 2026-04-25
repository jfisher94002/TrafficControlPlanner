/**
 * MUTCD Chapter 6P — Typical Application (TA) scenario fixtures.
 *
 * All 54 federal scenarios plus CA supplement TA-101.
 * Numbering and content follows MUTCD 11th Edition (2023) Chapter 6P.
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

// ─── Scenario list ────────────────────────────────────────────────────────────

export const TA_SCENARIOS: TAScenario[] = [

  // ── TA-1: Work Beyond the Shoulder ────────────────────────────────────────
  // No taper required; shoulder work sign + road work sign only.
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

  // ── TA-2: Work on Shoulder — No Taper ─────────────────────────────────────
  // Shoulder work with no encroachment; no taper needed. Signs only.
  {
    id: 'TA-2',
    title: 'Work on Shoulder — No Taper',
    seed: {
      mapCenter: MAP_CENTER,
      objects: [
        sign('shoulderwork', 100, 200, 'W21-5a'),
        sign('roadwork',     250, 200, 'W20-1'),
        zone('zone-1', 400, 185),
      ],
    },
    assert: {
      signs: ['shoulderwork', 'roadwork'],
      objectTypes: ['zone'],
      noDevices: true,
    },
  },

  // ── TA-3: Work on the Shoulder ─────────────────────────────────────────────
  // Shoulder encroaches slightly; taper required.
  {
    id: 'TA-3',
    title: 'Work on the Shoulder',
    seed: {
      mapCenter: MAP_CENTER,
      objects: [
        sign('shoulderwork', 100, 200, 'W21-5a'),
        sign('roadwork',     250, 200, 'W20-1'),
        taper('taper-1', 400, 300),
        zone('zone-1', 550, 270),
      ],
    },
    assert: {
      signs: ['shoulderwork', 'roadwork'],
      objectTypes: ['taper', 'zone'],
    },
  },

  // ── TA-4: Sidewalk Closure ─────────────────────────────────────────────────
  // Pedestrian path closed; requires sidewalk closed sign + detour path.
  {
    id: 'TA-4',
    title: 'Sidewalk Closure',
    seed: {
      mapCenter: MAP_CENTER,
      objects: [
        sign('sidewalkclosed',   100, 200, 'R9-9'),
        sign('pedestriandetour', 200, 200, 'M4-9b'),
        zone('zone-1', 350, 185),
      ],
    },
    assert: {
      signs: ['sidewalkclosed', 'pedestriandetour'],
      objectTypes: ['zone'],
    },
  },

  // ── TA-5: Moving Work Zone on Two-Lane Road ────────────────────────────────
  // Slow-moving operation; arrow board in caution/flashing mode replaces taper.
  {
    id: 'TA-5',
    title: 'Moving Work Zone on Two-Lane Road',
    seed: {
      mapCenter: MAP_CENTER,
      objects: [
        sign('roadwork',       100, 300, 'W20-1'),
        sign('movingoperation', 250, 300, 'W20-4'),
        device('ab-1', 'arrow_board', 450, 300),
      ],
    },
    assert: {
      signs: ['roadwork', 'movingoperation'],
      devices: ['arrow_board'],
    },
  },

  // ── TA-6: Shoulder Work with Minor Encroachment ───────────────────────────
  {
    id: 'TA-6',
    title: 'Shoulder Work with Minor Encroachment',
    seed: {
      mapCenter: MAP_CENTER,
      objects: [
        sign('shoulderwork', 100, 200, 'W21-5a'),
        sign('roadwork',     200, 200, 'W20-1'),
        sign('merge',        350, 200, 'W4-2'),
        taper('taper-1', 500, 300),
        zone('zone-1', 650, 270),
      ],
    },
    assert: {
      signs: ['shoulderwork', 'merge'],
      objectTypes: ['taper'],
    },
  },

  // ── TA-7: Work Beyond Shoulder — Limited Access Highway ───────────────────
  // Freeway context; work off paved shoulder, no lane or shoulder taper needed.
  {
    id: 'TA-7',
    title: 'Work Beyond Shoulder — Limited Access Highway',
    seed: {
      mapCenter: MAP_CENTER,
      objects: [
        sign('roadwork',     100, 200, 'W20-1'),
        sign('shoulderwork', 250, 200, 'W21-5a'),
        device('ab-1', 'arrow_board', 450, 200),
        zone('zone-1', 600, 185),
      ],
    },
    assert: {
      signs: ['roadwork', 'shoulderwork'],
      devices: ['arrow_board'],
      objectTypes: ['zone'],
    },
  },

  // ── TA-8: Two-Lane Road — One Lane Alternating (Flaggers) ─────────────────
  // Short section of two-lane road reduced to one lane; flaggers control each end.
  {
    id: 'TA-8',
    title: 'Two-Lane Road — One Lane Alternating with Flaggers',
    seed: {
      mapCenter: MAP_CENTER,
      objects: [
        sign('roadwork',     100, 300, 'W20-1'),
        sign('flaggerahead', 280, 300, 'W20-7a'),
        sign('onelane',      460, 300, 'W20-4a'),
        taper('taper-1', 640, 300),
        zone('zone-1',   800, 270),
        device('flagger-1', 'flagger', 780, 300),
        device('flagger-2', 'flagger', 1080, 300),
      ],
    },
    assert: {
      signs: ['roadwork', 'flaggerahead', 'onelane'],
      devices: ['flagger'],
      objectTypes: ['taper', 'zone'],
      minDevices: { flagger: 2 },
    },
  },

  // ── TA-9: Two-Lane Road — Pilot Car Operations ────────────────────────────
  // Long section; pilot car escorts traffic through one direction at a time.
  {
    id: 'TA-9',
    title: 'Two-Lane Road — Pilot Car Operations',
    seed: {
      mapCenter: MAP_CENTER,
      objects: [
        sign('roadwork',      100, 300, 'W20-1'),
        sign('pilotcar',      280, 300, 'W20-8'),
        sign('preparetostop', 460, 300, 'W3-4'),
        zone('zone-1', 640, 270),
        device('flagger-1', 'flagger', 620, 300),
        device('flagger-2', 'flagger', 920, 300),
      ],
    },
    assert: {
      signs: ['roadwork', 'pilotcar', 'preparetostop'],
      devices: ['flagger'],
      objectTypes: ['zone'],
      minDevices: { flagger: 2 },
    },
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

  // ── TA-13: Right Lane Closure — Urban Near-Side Intersection ──────────────
  // Right lane closed before an urban intersection; merge left.
  {
    id: 'TA-13',
    title: 'Right Lane Closure — Urban Near-Side Intersection',
    seed: {
      mapCenter: MAP_CENTER,
      objects: [
        sign('roadwork',      100, 300, 'W20-1'),
        sign('rightlaneends', 300, 300, 'W9-1'),
        sign('merge',         480, 300, 'W4-2'),
        taper('taper-1', 660, 300),
        zone('zone-1',   850, 270),
        device('ab-1', 'arrow_board', 830, 300),
      ],
    },
    assert: {
      signs: ['roadwork', 'rightlaneends', 'merge'],
      devices: ['arrow_board'],
      objectTypes: ['taper', 'zone'],
    },
  },

  // ── TA-14: Right Lane Closure — Urban Far-Side Intersection ───────────────
  // Taper begins after intersection clears; right lane closed on far side.
  {
    id: 'TA-14',
    title: 'Right Lane Closure — Urban Far-Side Intersection',
    seed: {
      mapCenter: MAP_CENTER,
      objects: [
        sign('roadwork',      100, 300, 'W20-1'),
        sign('rightlaneends', 300, 300, 'W9-1'),
        taper('taper-1', 600, 300),
        zone('zone-1',   800, 270),
        device('ab-1', 'arrow_board', 780, 300),
      ],
    },
    assert: {
      signs: ['roadwork', 'rightlaneends'],
      devices: ['arrow_board'],
      objectTypes: ['taper', 'zone'],
    },
  },

  // ── TA-15: Left Lane Closure — Urban Intersection ─────────────────────────
  // Left lane closed near/through urban intersection; merge right.
  {
    id: 'TA-15',
    title: 'Left Lane Closure — Urban Intersection',
    seed: {
      mapCenter: MAP_CENTER,
      objects: [
        sign('roadwork',     100, 300, 'W20-1'),
        sign('leftlaneends', 300, 300, 'W9-2'),
        sign('merge',        480, 300, 'W4-2'),
        taper('taper-1', 660, 300),
        zone('zone-1',   850, 270),
        device('ab-1', 'arrow_board', 830, 300),
      ],
    },
    assert: {
      signs: ['roadwork', 'leftlaneends', 'merge'],
      devices: ['arrow_board'],
      objectTypes: ['taper', 'zone'],
    },
  },

  // ── TA-16: Right Lane Closure — Multilane Undivided Highway ───────────────
  // Right lane closed on multilane undivided; merge left; 45 mph.
  {
    id: 'TA-16',
    title: 'Right Lane Closure — Multilane Undivided Highway',
    seed: {
      mapCenter: MAP_CENTER,
      objects: [
        sign('roadwork',      100, 300, 'W20-1'),
        sign('rightlaneends', 300, 300, 'W9-1'),
        sign('merge',         500, 300, 'W4-2'),
        taper('taper-1', 700, 300, 45),
        zone('zone-1',   880, 270),
        device('ab-1', 'arrow_board', 860, 300),
      ],
    },
    assert: {
      signs: ['roadwork', 'rightlaneends', 'merge'],
      devices: ['arrow_board'],
      objectTypes: ['taper', 'zone'],
    },
  },

  // ── TA-17: Left Lane Closure — Multilane Undivided Highway ────────────────
  // Left lane closed on multilane undivided; merge right; 45 mph.
  {
    id: 'TA-17',
    title: 'Left Lane Closure — Multilane Undivided Highway',
    seed: {
      mapCenter: MAP_CENTER,
      objects: [
        sign('roadwork',     100, 300, 'W20-1'),
        sign('leftlaneends', 300, 300, 'W9-2'),
        sign('merge',        500, 300, 'W4-2'),
        taper('taper-1', 700, 300, 45),
        zone('zone-1',   880, 270),
        device('ab-1', 'arrow_board', 860, 300),
      ],
    },
    assert: {
      signs: ['roadwork', 'leftlaneends', 'merge'],
      devices: ['arrow_board'],
      objectTypes: ['taper', 'zone'],
    },
  },

  // ── TA-18: Two Adjacent Lanes Closed — Multilane Highway ──────────────────
  // Two right lanes closed; nested tapers; two arrow boards.
  {
    id: 'TA-18',
    title: 'Two Adjacent Lanes Closed — Multilane Highway',
    seed: {
      mapCenter: MAP_CENTER,
      objects: [
        sign('roadwork',    100, 300, 'W20-1'),
        sign('twolaneends', 320, 300, 'W9-3'),
        sign('merge',       520, 300, 'W4-2'),
        taper('taper-1', 720, 300, 45, 12, 2),
        taper('taper-2', 900, 300, 45, 12, 1),
        zone('zone-1',  1080, 270),
        device('ab-1', 'arrow_board', 700, 300),
        device('ab-2', 'arrow_board', 880, 300),
      ],
    },
    assert: {
      signs: ['roadwork', 'merge'],
      devices: ['arrow_board'],
      objectTypes: ['taper', 'zone'],
      minTapers: 2,
      minDevices: { arrow_board: 2 },
    },
  },

  // ── TA-19: Lane Shift — Multilane Highway ─────────────────────────────────
  // Traffic shifted laterally (not a lane elimination); tangent taper geometry.
  {
    id: 'TA-19',
    title: 'Lane Shift — Multilane Highway',
    seed: {
      mapCenter: MAP_CENTER,
      objects: [
        sign('roadwork',  100, 300, 'W20-1'),
        sign('shiftleft', 300, 300, 'W4-9L'),
        taper('taper-1', 500, 300, 45),
        zone('zone-1',   680, 270),
        taper('taper-2', 900, 300, 45),
        device('ab-1', 'arrow_board', 660, 300),
      ],
    },
    assert: {
      signs: ['roadwork', 'shiftleft'],
      devices: ['arrow_board'],
      objectTypes: ['taper', 'zone'],
    },
  },

  // ── TA-20: Ramp Closure on Surface Street ─────────────────────────────────
  // Entrance ramp closed; detour to next ramp; no main-lane taper.
  {
    id: 'TA-20',
    title: 'Ramp Closure on Surface Street',
    seed: {
      mapCenter: MAP_CENTER,
      objects: [
        sign('roadwork',   100, 300, 'W20-1'),
        sign('rampclosed', 300, 300, 'R4-11a'),
        sign('detour',     480, 300, 'M4-9b'),
        zone('zone-1', 650, 270),
      ],
    },
    assert: {
      signs: ['rampclosed', 'detour'],
      objectTypes: ['zone'],
    },
  },

  // ── TA-21: Lane Closure on Near Side of Intersection ─────────────────────
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

  // ── TA-22: Right Lane Closure on Far Side of Intersection ─────────────────
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
  // Left lane closed approaching an urban intersection; merge right.
  {
    id: 'TA-23',
    title: 'Left Lane Closure Near Intersection',
    seed: {
      mapCenter: MAP_CENTER,
      objects: [
        sign('roadwork',     100, 300, 'W20-1'),
        sign('leftlaneends', 300, 300, 'W9-2'),
        sign('merge',        480, 300, 'W4-2'),
        taper('taper-1', 660, 300),
        zone('zone-1',   850, 270),
        device('ab-1', 'arrow_board', 830, 300),
      ],
    },
    assert: {
      signs: ['roadwork', 'leftlaneends'],
      devices: ['arrow_board'],
      objectTypes: ['taper', 'zone'],
    },
  },

  // ── TA-24: Contraflow — Multilane Undivided Highway ───────────────────────
  // One direction borrows a lane from the other; temp signals at each end.
  {
    id: 'TA-24',
    title: 'Contraflow — Multilane Undivided Highway',
    seed: {
      mapCenter: MAP_CENTER,
      objects: [
        sign('roadwork',      100, 300, 'W20-1'),
        sign('onelane',       300, 300, 'W20-4a'),
        sign('preparetostop', 480, 300, 'W3-4'),
        zone('zone-1',  700, 270),
        device('sig-1', 'temp_signal', 690, 300),
        device('sig-2', 'temp_signal', 1000, 300),
      ],
    },
    assert: {
      signs: ['roadwork', 'onelane'],
      devices: ['temp_signal'],
      objectTypes: ['zone'],
      minDevices: { temp_signal: 2 },
    },
  },

  // ── TA-25: Short Duration / Moving Operation — Urban ──────────────────────
  // Urban moving work zone; no fixed taper; arrow board on vehicle.
  {
    id: 'TA-25',
    title: 'Short Duration / Moving Operation — Urban',
    seed: {
      mapCenter: MAP_CENTER,
      objects: [
        sign('roadwork',        100, 300, 'W20-1'),
        sign('movingoperation', 280, 300, 'W20-4'),
        device('ab-1', 'arrow_board', 480, 300),
      ],
    },
    assert: {
      signs: ['roadwork', 'movingoperation'],
      devices: ['arrow_board'],
    },
  },

  // ── TA-26: Divided Highway — Shoulder Work ────────────────────────────────
  // Work on shoulder of divided highway; no lane taper; signs + arrow board.
  {
    id: 'TA-26',
    title: 'Divided Highway — Shoulder Work',
    seed: {
      mapCenter: MAP_CENTER,
      objects: [
        sign('roadwork',     100, 200, 'W20-1'),
        sign('shoulderwork', 250, 200, 'W21-5a'),
        device('ab-1', 'arrow_board', 450, 200),
        zone('zone-1', 600, 185),
      ],
    },
    assert: {
      signs: ['roadwork', 'shoulderwork'],
      devices: ['arrow_board'],
      objectTypes: ['zone'],
    },
  },

  // ── TA-27: Divided Highway — Right Lane Closure ───────────────────────────
  // Right lane closed on divided highway; 55 mph; taper + arrow board.
  {
    id: 'TA-27',
    title: 'Divided Highway — Right Lane Closure',
    seed: {
      mapCenter: MAP_CENTER,
      objects: [
        sign('roadwork',      100, 300, 'W20-1'),
        sign('rightlaneends', 350, 300, 'W9-1'),
        sign('merge',         580, 300, 'W4-2'),
        taper('taper-1', 780, 300, 55, 12),
        zone('zone-1',   1000, 270),
        device('ab-1', 'arrow_board', 980, 300),
      ],
    },
    assert: {
      signs: ['roadwork', 'rightlaneends'],
      devices: ['arrow_board'],
      objectTypes: ['taper', 'zone'],
    },
  },

  // ── TA-28: Divided Highway — Left Lane Closure ────────────────────────────
  // Left lane closed on divided highway; 55 mph; taper + arrow board.
  {
    id: 'TA-28',
    title: 'Divided Highway — Left Lane Closure',
    seed: {
      mapCenter: MAP_CENTER,
      objects: [
        sign('roadwork',     100, 300, 'W20-1'),
        sign('leftlaneends', 350, 300, 'W9-2'),
        sign('merge',        580, 300, 'W4-2'),
        taper('taper-1', 780, 300, 55, 12),
        zone('zone-1',   1000, 270),
        device('ab-1', 'arrow_board', 980, 300),
      ],
    },
    assert: {
      signs: ['roadwork', 'leftlaneends'],
      devices: ['arrow_board'],
      objectTypes: ['taper', 'zone'],
    },
  },

  // ── TA-29: Divided Highway — Two Adjacent Lanes Closed ────────────────────
  // Two lanes closed on divided highway; nested tapers; two arrow boards.
  {
    id: 'TA-29',
    title: 'Divided Highway — Two Adjacent Lanes Closed',
    seed: {
      mapCenter: MAP_CENTER,
      objects: [
        sign('roadwork',    100, 300, 'W20-1'),
        sign('twolaneends', 360, 300, 'W9-3'),
        sign('merge',       580, 300, 'W4-2'),
        taper('taper-1', 780, 300, 55, 12, 2),
        taper('taper-2', 980, 300, 55, 12, 1),
        zone('zone-1',  1160, 270),
        device('ab-1', 'arrow_board', 760, 300),
        device('ab-2', 'arrow_board', 960, 300),
      ],
    },
    assert: {
      signs: ['roadwork'],
      devices: ['arrow_board'],
      objectTypes: ['taper', 'zone'],
      minTapers: 2,
      minDevices: { arrow_board: 2 },
    },
  },

  // ── TA-30: Divided Highway — Ramp Closure ─────────────────────────────────
  // On-ramp or off-ramp closed; detour signed; no main-lane taper.
  {
    id: 'TA-30',
    title: 'Divided Highway — Ramp Closure',
    seed: {
      mapCenter: MAP_CENTER,
      objects: [
        sign('roadwork',   100, 300, 'W20-1'),
        sign('rampclosed', 300, 300, 'R4-11a'),
        sign('detour',     480, 300, 'M4-9b'),
        zone('zone-1', 650, 270),
      ],
    },
    assert: {
      signs: ['rampclosed', 'detour'],
      objectTypes: ['zone'],
    },
  },

  // ── TA-31: Divided Highway — Crossover ────────────────────────────────────
  // Traffic redirected to opposite roadway; temp signals + channelization.
  {
    id: 'TA-31',
    title: 'Divided Highway — Crossover',
    seed: {
      mapCenter: MAP_CENTER,
      objects: [
        sign('roadwork',      100, 300, 'W20-1'),
        sign('onelane',       320, 300, 'W20-4a'),
        sign('preparetostop', 520, 300, 'W3-4'),
        taper('taper-1', 720, 300, 55, 12),
        zone('zone-1',   920, 270),
        device('sig-1', 'temp_signal', 900, 300),
        device('sig-2', 'temp_signal', 1200, 300),
      ],
    },
    assert: {
      signs: ['roadwork', 'onelane'],
      devices: ['temp_signal'],
      objectTypes: ['taper', 'zone'],
      minDevices: { temp_signal: 2 },
    },
  },

  // ── TA-32: Divided Highway — Contraflow ───────────────────────────────────
  // One direction uses lanes from opposite roadway; temp signals at each end.
  {
    id: 'TA-32',
    title: 'Divided Highway — Contraflow Operation',
    seed: {
      mapCenter: MAP_CENTER,
      objects: [
        sign('roadwork',    100, 300, 'W20-1'),
        sign('onelane',     320, 300, 'W20-4a'),
        sign('contraflow',  520, 300, 'W4-7'),
        zone('zone-1',  720, 270),
        device('sig-1', 'temp_signal', 700, 300),
        device('sig-2', 'temp_signal', 1020, 300),
      ],
    },
    assert: {
      signs: ['roadwork', 'onelane'],
      devices: ['temp_signal'],
      objectTypes: ['zone'],
      minDevices: { temp_signal: 2 },
    },
  },

  // ── TA-33: Stationary Lane Closure on a Divided Highway ───────────────────
  // L = W × S formula; 65 mph; arrow board required.
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
  // Slow-moving operation; arrow board on shadow vehicle; no fixed taper.
  {
    id: 'TA-34',
    title: 'Moving Operations on Divided Highway',
    seed: {
      mapCenter: MAP_CENTER,
      objects: [
        sign('roadwork',        100, 300, 'W20-1'),
        sign('movingoperation', 300, 300, 'W20-4'),
        device('ab-1', 'arrow_board', 500, 300),
      ],
    },
    assert: {
      signs: ['roadwork', 'movingoperation'],
      devices: ['arrow_board'],
    },
  },

  // ── TA-35: Divided Highway — Double Lane Closure ──────────────────────────
  {
    id: 'TA-35',
    title: 'Divided Highway — Double Lane Closure',
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
      signs: ['roadwork'],
      devices: ['arrow_board'],
      objectTypes: ['taper', 'zone'],
      minTapers: 2,
      minDevices: { arrow_board: 2 },
    },
  },

  // ── TA-36: Freeway — Shoulder Work ────────────────────────────────────────
  // Work on freeway shoulder; no lane closure; arrow board faces traffic.
  {
    id: 'TA-36',
    title: 'Freeway — Shoulder Work',
    seed: {
      mapCenter: MAP_CENTER,
      objects: [
        sign('roadwork',     100, 200, 'W20-1'),
        sign('shoulderwork', 300, 200, 'W21-5a'),
        device('ab-1', 'arrow_board', 500, 200),
        zone('zone-1', 660, 185),
      ],
    },
    assert: {
      signs: ['roadwork', 'shoulderwork'],
      devices: ['arrow_board'],
      objectTypes: ['zone'],
    },
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

  // ── TA-38: Freeway — Right Lane Closure ───────────────────────────────────
  // Single right lane closed; 65 mph; L = 780 ft.
  {
    id: 'TA-38',
    title: 'Freeway — Right Lane Closure',
    seed: {
      mapCenter: MAP_CENTER,
      objects: [
        sign('roadwork',      100, 300, 'W20-1'),
        sign('rightlaneends', 380, 300, 'W9-1'),
        sign('merge',         620, 300, 'W4-2'),
        taper('taper-1', 820, 300, 65, 12, 1, 780),
        zone('zone-1',   1060, 270),
        device('ab-1', 'arrow_board', 1040, 300),
      ],
    },
    assert: {
      signs: ['roadwork', 'rightlaneends'],
      devices: ['arrow_board'],
      objectTypes: ['taper', 'zone'],
      taperFormula: { speed: 65, laneWidth: 12, expectedFt: 780 },
    },
  },

  // ── TA-39: Freeway — Left Lane Closure ────────────────────────────────────
  // Single left lane closed on freeway; 65 mph; arrow board.
  {
    id: 'TA-39',
    title: 'Freeway — Left Lane Closure',
    seed: {
      mapCenter: MAP_CENTER,
      objects: [
        sign('roadwork',     100, 300, 'W20-1'),
        sign('leftlaneends', 380, 300, 'W9-2'),
        sign('merge',        620, 300, 'W4-2'),
        taper('taper-1', 820, 300, 65, 12, 1, 780),
        zone('zone-1',   1060, 270),
        device('ab-1', 'arrow_board', 1040, 300),
      ],
    },
    assert: {
      signs: ['roadwork', 'leftlaneends'],
      devices: ['arrow_board'],
      objectTypes: ['taper', 'zone'],
      taperFormula: { speed: 65, laneWidth: 12, expectedFt: 780 },
    },
  },

  // ── TA-40: Freeway — On-Ramp Closure ──────────────────────────────────────
  // On-ramp closed at gore; detour to next on-ramp; no main-lane closure.
  {
    id: 'TA-40',
    title: 'Freeway — On-Ramp Closure',
    seed: {
      mapCenter: MAP_CENTER,
      objects: [
        sign('rampclosed', 100, 300, 'R4-11a'),
        sign('detour',     280, 300, 'M4-9b'),
        zone('zone-1', 460, 270),
      ],
    },
    assert: {
      signs: ['rampclosed', 'detour'],
      objectTypes: ['zone'],
    },
  },

  // ── TA-41: Freeway — Off-Ramp Closure ─────────────────────────────────────
  // Off-ramp closed; exit detoured; no main-lane closure.
  {
    id: 'TA-41',
    title: 'Freeway — Off-Ramp Closure',
    seed: {
      mapCenter: MAP_CENTER,
      objects: [
        sign('exitclosed', 100, 300, 'R4-11a'),
        sign('detour',     280, 300, 'M4-9b'),
        zone('zone-1', 460, 270),
      ],
    },
    assert: {
      signs: ['exitclosed', 'detour'],
      objectTypes: ['zone'],
    },
  },

  // ── TA-42: Freeway — Median Work (No Lane Closure) ────────────────────────
  // Work confined to median; no lane impact; signs + arrow board.
  {
    id: 'TA-42',
    title: 'Freeway — Median Work (No Lane Closure)',
    seed: {
      mapCenter: MAP_CENTER,
      objects: [
        sign('roadwork',     100, 300, 'W20-1'),
        sign('shoulderwork', 300, 300, 'W21-5a'),
        device('ab-1', 'arrow_board', 500, 300),
        zone('zone-1', 660, 270),
      ],
    },
    assert: {
      signs: ['roadwork'],
      devices: ['arrow_board'],
      objectTypes: ['zone'],
    },
  },

  // ── TA-43: Freeway — Lane Closure with Median Crossover ───────────────────
  // Traffic routed to opposite roadway via crossover; temp signals required.
  {
    id: 'TA-43',
    title: 'Freeway — Lane Closure with Median Crossover',
    seed: {
      mapCenter: MAP_CENTER,
      objects: [
        sign('roadwork',      100, 300, 'W20-1'),
        sign('onelane',       340, 300, 'W20-4a'),
        sign('preparetostop', 560, 300, 'W3-4'),
        taper('taper-1', 760, 300, 65, 12),
        zone('zone-1',   960, 270),
        device('sig-1', 'temp_signal', 940, 300),
        device('sig-2', 'temp_signal', 1260, 300),
      ],
    },
    assert: {
      signs: ['roadwork', 'onelane'],
      devices: ['temp_signal'],
      objectTypes: ['taper', 'zone'],
      minDevices: { temp_signal: 2 },
    },
  },

  // ── TA-44: Freeway — Contraflow Operation ─────────────────────────────────
  // Both directions share one side; temp signals + barrier at each end.
  {
    id: 'TA-44',
    title: 'Freeway — Contraflow Operation',
    seed: {
      mapCenter: MAP_CENTER,
      objects: [
        sign('roadwork',    100, 300, 'W20-1'),
        sign('onelane',     340, 300, 'W20-4a'),
        sign('contraflow',  560, 300, 'W4-7'),
        zone('zone-1',  760, 270),
        device('sig-1', 'temp_signal', 740, 300),
        device('sig-2', 'temp_signal', 1060, 300),
      ],
    },
    assert: {
      signs: ['roadwork', 'onelane'],
      devices: ['temp_signal'],
      objectTypes: ['zone'],
      minDevices: { temp_signal: 2 },
    },
  },

  // ── TA-45: Freeway — Moving Operations (Short Duration) ───────────────────
  // Moving work zone; arrow board on shadow vehicle; no fixed taper.
  {
    id: 'TA-45',
    title: 'Freeway — Moving Operations (Short Duration)',
    seed: {
      mapCenter: MAP_CENTER,
      objects: [
        sign('roadwork',        100, 300, 'W20-1'),
        sign('movingoperation', 300, 300, 'W20-4'),
        device('ab-1', 'arrow_board', 500, 300),
        device('ab-2', 'arrow_board', 680, 300),
      ],
    },
    assert: {
      signs: ['roadwork', 'movingoperation'],
      devices: ['arrow_board'],
      minDevices: { arrow_board: 2 },
    },
  },

  // ── TA-46: Urban Intersection — Right Turn Lane / Approach Closure ─────────
  // One approach lane closed at urban intersection; pedestrian impacts signed.
  {
    id: 'TA-46',
    title: 'Urban Intersection — Approach Lane Closure',
    seed: {
      mapCenter: MAP_CENTER,
      objects: [
        sign('roadwork',         100, 300, 'W20-1'),
        sign('rightlaneends',    300, 300, 'W9-1'),
        sign('sidewalkclosed',   480, 300, 'R9-9'),
        sign('pedestriandetour', 660, 300, 'M4-9b'),
        taper('taper-1', 860, 300),
        zone('zone-1',  1040, 270),
      ],
    },
    assert: {
      signs: ['roadwork', 'rightlaneends', 'sidewalkclosed'],
      objectTypes: ['taper', 'zone'],
    },
  },

  // ── TA-47: Urban Intersection — Partial Closure ───────────────────────────
  // Part of intersection closed; traffic detoured around work area.
  {
    id: 'TA-47',
    title: 'Urban Intersection — Partial Closure',
    seed: {
      mapCenter: MAP_CENTER,
      objects: [
        sign('roadwork',  100, 300, 'W20-1'),
        sign('detour',    280, 300, 'M4-9b'),
        zone('zone-1', 460, 270),
        device('ab-1', 'arrow_board', 440, 300),
      ],
    },
    assert: {
      signs: ['roadwork', 'detour'],
      devices: ['arrow_board'],
      objectTypes: ['zone'],
    },
  },

  // ── TA-48: Sidewalk Closure and Pedestrian Detour (Standard) ─────────────
  // Sidewalk closed with marked alternate pedestrian route.
  {
    id: 'TA-48',
    title: 'Sidewalk Closure and Pedestrian Detour',
    seed: {
      mapCenter: MAP_CENTER,
      objects: [
        sign('sidewalkclosed',   100, 200, 'R9-9'),
        sign('pedestriandetour', 250, 200, 'M4-9b'),
        sign('crosswalkclosed',  400, 200, 'R9-8'),
        zone('zone-1', 560, 185),
      ],
    },
    assert: {
      signs: ['sidewalkclosed', 'pedestriandetour', 'crosswalkclosed'],
      objectTypes: ['zone'],
    },
  },

  // ── TA-49: Urban Pedestrian Detour — Mid-Block ────────────────────────────
  // Mid-block crosswalk closed; pedestrians directed to adjacent crossing.
  {
    id: 'TA-49',
    title: 'Urban Pedestrian Detour — Mid-Block',
    seed: {
      mapCenter: MAP_CENTER,
      objects: [
        sign('crosswalkclosed',  100, 200, 'R9-8'),
        sign('pedestriandetour', 260, 200, 'M4-9b'),
        zone('zone-1', 430, 185),
      ],
    },
    assert: {
      signs: ['crosswalkclosed', 'pedestriandetour'],
      objectTypes: ['zone'],
    },
  },

  // ── TA-50: High-Speed Two-Lane Road — Flagger-Controlled Closure ──────────
  // High-speed rural two-lane; extended advance warning; flaggers required.
  {
    id: 'TA-50',
    title: 'High-Speed Two-Lane Road — Flagger-Controlled Closure',
    seed: {
      mapCenter: MAP_CENTER,
      objects: [
        sign('roadwork',     100, 300, 'W20-1'),
        sign('flaggerahead', 350, 300, 'W20-7a'),
        sign('onelane',      600, 300, 'W20-4a'),
        taper('taper-1', 860, 300, 65, 12),
        zone('zone-1',  1060, 270),
        device('flagger-1', 'flagger', 1040, 300),
        device('flagger-2', 'flagger', 1360, 300),
      ],
    },
    assert: {
      signs: ['roadwork', 'flaggerahead', 'onelane'],
      devices: ['flagger'],
      objectTypes: ['taper', 'zone'],
      minDevices: { flagger: 2 },
    },
  },

  // ── TA-51: Work at Complex Multi-Leg Intersection ─────────────────────────
  // Work zone affects multiple approaches; signing on every approach.
  {
    id: 'TA-51',
    title: 'Work at Complex Multi-Leg Intersection',
    seed: {
      mapCenter: MAP_CENTER,
      objects: [
        sign('roadwork',  100, 300, 'W20-1'),
        sign('roadwork2', 100, 150, 'W20-1'),
        sign('detour',    280, 300, 'M4-9b'),
        sign('detour2',   280, 150, 'M4-9b'),
        zone('zone-1', 460, 225),
        device('ab-1', 'arrow_board', 440, 300),
        device('ab-2', 'arrow_board', 440, 150),
      ],
    },
    assert: {
      signs: ['roadwork', 'detour'],
      devices: ['arrow_board'],
      objectTypes: ['zone'],
      minDevices: { arrow_board: 2 },
    },
  },

  // ── TA-52: Work in Roundabout ─────────────────────────────────────────────
  // Lane or splitter island work in roundabout; signs at each entry.
  {
    id: 'TA-52',
    title: 'Work in Roundabout',
    seed: {
      mapCenter: MAP_CENTER,
      objects: [
        sign('roadwork', 100, 300, 'W20-1'),
        sign('detour',   280, 300, 'M4-9b'),
        zone('zone-1', 460, 270),
        device('ab-1', 'arrow_board', 440, 300),
      ],
    },
    assert: {
      signs: ['roadwork', 'detour'],
      devices: ['arrow_board'],
      objectTypes: ['zone'],
    },
  },

  // ── TA-53: Work on Bridge or Structure ────────────────────────────────────
  // Lane closure on bridge deck; same geometry as standard lane closure.
  {
    id: 'TA-53',
    title: 'Work on Bridge or Structure',
    seed: {
      mapCenter: MAP_CENTER,
      objects: [
        sign('roadwork',      100, 300, 'W20-1'),
        sign('rightlaneends', 350, 300, 'W9-1'),
        sign('merge',         570, 300, 'W4-2'),
        taper('taper-1', 770, 300, 45, 12),
        zone('zone-1',   950, 270),
        device('ab-1', 'arrow_board', 930, 300),
      ],
    },
    assert: {
      signs: ['roadwork', 'rightlaneends'],
      devices: ['arrow_board'],
      objectTypes: ['taper', 'zone'],
    },
  },

  // ── TA-54: High-Speed Moving Operation on Freeway ─────────────────────────
  // Multi-vehicle moving work zone at freeway speeds; two shadow vehicles.
  {
    id: 'TA-54',
    title: 'High-Speed Moving Operation on Freeway',
    seed: {
      mapCenter: MAP_CENTER,
      objects: [
        sign('roadwork',        100, 300, 'W20-1'),
        sign('movingoperation', 340, 300, 'W20-4'),
        device('ab-1', 'arrow_board', 560, 300),
        device('ab-2', 'arrow_board', 760, 300),
      ],
    },
    assert: {
      signs: ['roadwork', 'movingoperation'],
      devices: ['arrow_board'],
      minDevices: { arrow_board: 2 },
    },
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
