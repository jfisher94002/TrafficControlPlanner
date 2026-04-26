/**
 * MUTCD Chapter 6P — Typical Application (TA) scenario fixtures.
 * 2023 MUTCD 11th Edition, all 54 federal diagrams + CA supplement TA-101.
 *
 * ─── Layout convention ────────────────────────────────────────────────────────
 * All scenarios use a vertical road running north (top) → south (bottom).
 * Traffic approaches the work zone from the north (top of canvas).
 *
 *   CX  = 400   road horizontal centre
 *   RY1 =  50   road top
 *   RY2 = 650   road bottom
 *   SR  = 540   advance sign X, right (east) shoulder — works for all road types
 *   SL  = 260   advance sign X, left (west) shoulder  — opposing traffic
 *   WY  = 500   work-zone centre Y
 *   TY  = 430   taper / end-device Y (upstream of work zone)
 *
 * Three-sign advance sequence (top → bottom, farthest first): y = 150, 270, 390
 * Two-sign sequence:                                           y = 190, 340
 * One-sign:                                                    y = 280
 * ──────────────────────────────────────────────────────────────────────────────
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MapCenter {
  lat: number
  lon: number
  zoom: number
}

export interface TAAssert {
  signs?: string[]
  devices?: string[]
  objectTypes?: string[]
  minTapers?: number
  minDevices?: Record<string, number>
  taperFormula?: { speed: number; laneWidth: number; expectedFt: number }
  noDevices?: boolean
}

export interface TAScenario {
  id: string
  title: string
  seed: { mapCenter: MapCenter; objects: unknown[] }
  assert: TAAssert
  skip?: string
}

// ─── Layout constants ─────────────────────────────────────────────────────────

const CX  = 400   // road horizontal centre
const RY1 =  50   // road top
const RY2 = 650   // road bottom
const SR  = 540   // sign x, right shoulder
const SL  = 260   // sign x, left shoulder (opposing traffic)
const WY  = 500   // work-zone centre Y
const TY  = 430   // taper / end-device Y
// Work zone anchor X: just past the right shoulder edge of a 2-lane road
// (road right edge = CX+40, shoulder = +20, +5 gap → 465)
const WX  = 465   // work-zone left edge X for right-shoulder / beyond-shoulder TAs

// ─── Road builders ────────────────────────────────────────────────────────────

/** Straight two-lane, two-way rural road with shoulders. */
const road2 = (id = 'road-1') => ({
  id, type: 'road',
  x1: CX, y1: RY1, x2: CX, y2: RY2,
  width: 80, realWidth: 22, lanes: 2, roadType: '2lane', shoulderWidth: 20,
})

/** Four-lane undivided urban/suburban road with shoulders. */
const road4 = (id = 'road-1') => ({
  id, type: 'road',
  x1: CX, y1: RY1, x2: CX, y2: RY2,
  width: 150, realWidth: 44, lanes: 4, roadType: '4lane', shoulderWidth: 20,
})

/** Freeway / limited-access highway with wide shoulders. */
const roadFwy = (id = 'road-1') => ({
  id, type: 'road',
  x1: CX, y1: RY1, x2: CX, y2: RY2,
  width: 180, realWidth: 58, lanes: 4, roadType: 'highway', shoulderWidth: 30,
})

/** Divided highway — right (primary) roadway. */
const roadDivR = () => ({
  id: 'road-1', type: 'road',
  x1: CX + 55, y1: RY1, x2: CX + 55, y2: RY2,
  width: 80, realWidth: 22, lanes: 2, roadType: '2lane', shoulderWidth: 20,
})

/** Divided highway — left (opposing) roadway. */
const roadDivL = () => ({
  id: 'road-2', type: 'road',
  x1: CX - 55, y1: RY1, x2: CX - 55, y2: RY2,
  width: 80, realWidth: 22, lanes: 2, roadType: '2lane', shoulderWidth: 20,
})

// ─── Seed object builders ─────────────────────────────────────────────────────

const MAP_CENTER: MapCenter = { lat: 37.7749, lon: -122.4194, zoom: 16 }

// ─── Sign catalog — keys MUST match sign IDs used in scenarios below.
// Labels mirror tcpCatalog.ts exactly so the rendered sign matches production.
const SIGN_DATA: Record<string, { label: string; shape: string; color: string; textColor: string; mutcd?: string }> = {
  // ── Road-work warning signs (diamonds) ───────────────────────────────────────
  roadwork:         { label: 'ROAD WORK',    shape: 'diamond', color: '#f97316', textColor: '#111', mutcd: 'W20-1'   },
  roadwork2:        { label: 'ROAD WORK',    shape: 'diamond', color: '#f97316', textColor: '#111', mutcd: 'W20-1'   },
  shoulderwork:     { label: 'SHLDER WORK',  shape: 'diamond', color: '#f97316', textColor: '#111', mutcd: 'W21-5a'  },
  merge:            { label: 'MERGE',         shape: 'diamond', color: '#f97316', textColor: '#111', mutcd: 'W4-2'    },
  rightlaneends:    { label: 'RT LANE ENDS', shape: 'diamond', color: '#f97316', textColor: '#111', mutcd: 'W9-1'    },
  leftlaneends:     { label: 'LT LANE ENDS', shape: 'diamond', color: '#f97316', textColor: '#111', mutcd: 'W9-2'    },
  twolaneends:      { label: '2 LANES END',  shape: 'diamond', color: '#f97316', textColor: '#111', mutcd: 'W9-3'    },
  flaggerahead:     { label: 'FLAGGER AHD',  shape: 'diamond', color: '#f97316', textColor: '#111', mutcd: 'W20-7a'  },
  preparetostop:    { label: 'PREP TO STOP', shape: 'diamond', color: '#f97316', textColor: '#111', mutcd: 'W3-4'    },
  signal:           { label: 'SIGNAL AHEAD', shape: 'diamond', color: '#f97316', textColor: '#111', mutcd: 'W3-3'    },
  movingoperation:  { label: 'SLOW / STOP',  shape: 'diamond', color: '#f97316', textColor: '#111', mutcd: 'W20-6'   },
  contraflow:       { label: 'CONTRAFLOW',   shape: 'diamond', color: '#f97316', textColor: '#111', mutcd: 'W4-10'   },
  shiftleft:        { label: 'SHIFT LEFT',   shape: 'diamond', color: '#f97316', textColor: '#111', mutcd: 'W4-2L'   },
  // ── Rectangular signs ────────────────────────────────────────────────────────
  onelane:          { label: 'ONE LANE RD',  shape: 'rect',    color: '#f97316', textColor: '#111', mutcd: 'W20-4a'  },
  pilotcar:         { label: 'PILOT CAR',    shape: 'rect',    color: '#f97316', textColor: '#111', mutcd: 'W20-8'   },
  sidewalkclosed:   { label: 'SDWLK CLOSED', shape: 'rect',    color: '#f97316', textColor: '#111', mutcd: 'R9-10'   },
  crosswalkclosed:  { label: 'XWLK CLOSED',  shape: 'rect',    color: '#f97316', textColor: '#111', mutcd: 'R9-10'   },
  pedestriandetour: { label: 'PED DETOUR',   shape: 'rect',    color: '#f97316', textColor: '#111', mutcd: 'M4-8a'   },
  bikelaneclosed:   { label: 'BIKE LN CLSD', shape: 'rect',    color: '#f97316', textColor: '#111', mutcd: 'R9-10a'  },
  detour:           { label: 'DETOUR',        shape: 'rect',    color: '#f97316', textColor: '#111', mutcd: 'M4-8'    },
  detour2:          { label: 'DETOUR',        shape: 'rect',    color: '#f97316', textColor: '#111', mutcd: 'M4-8'    },
  rampclosed:       { label: 'RAMP CLOSED',  shape: 'rect',    color: '#f97316', textColor: '#111', mutcd: 'R11-2'   },
  exitclosed:       { label: 'EXIT CLOSED',  shape: 'rect',    color: '#f97316', textColor: '#111', mutcd: 'R11-2'   },
}

const sign = (id: string, x: number, y: number) => {
  const data = SIGN_DATA[id] ?? { label: id.replace(/_/g, ' ').toUpperCase(), shape: 'diamond', color: '#f97316', textColor: '#111' }
  return {
    id: `sign-${id}-${x}-${y}`,
    type: 'sign',
    x, y, rotation: 0, scale: 2,
    signData: {
      id,
      label: data.label,
      shape: data.shape,
      color: data.color,
      textColor: data.textColor,
      ...(data.mutcd ? { mutcd: data.mutcd } : {}),
    },
  }
}

// rotation: 90 = taper points south (down) — correct for our vertical north→south road layout.
// The wide (upstream) end is at (x, y); the narrow end extends downward to y + taperLength*TAPER_SCALE.
// Full MUTCD lengths (e.g. 540 ft at 45 mph) extend beyond the 600 px canvas — that is expected;
// the visible top portion still shows the taper correctly positioned on the road.
const taper = (
  id: string, x: number, y: number,
  speed = 45, laneWidth = 12, numLanes = 1,
  overrideLength?: number,
) => ({
  id, type: 'taper', x, y, rotation: 90,
  speed, laneWidth,
  taperLength: overrideLength ?? laneWidth * speed,
  manualLength: overrideLength !== undefined,
  numLanes,
})

const device = (id: string, deviceId: string, x: number, y: number) => ({
  id, type: 'device', x, y, rotation: 0, scale: 1,
  deviceData: { id: deviceId, label: deviceId, icon: '▣', color: '#fbbf24' },
})

const zone = (id: string, x: number, y: number, w = 120, h = 80) => ({
  id, type: 'zone', x, y, w, h,
})

// ─── Scenario list ────────────────────────────────────────────────────────────

export const TA_SCENARIOS: TAScenario[] = [

  // ── TA-1: Work Beyond the Shoulder ────────────────────────────────────────
  // Two-lane road. Work is completely off the right shoulder — no taper.
  // One advance warning sign only (W20-1). Work zone beyond shoulder.
  {
    id: 'TA-1',
    title: 'Work Beyond the Shoulder',
    seed: {
      mapCenter: MAP_CENTER,
      objects: [
        road2(),
        sign('roadwork', SR, 280),
        zone('zone-1', WX, WY - 50, 90, 100),
      ],
    },
    assert: {
      signs: ['roadwork'],
      objectTypes: ['road', 'zone'],
    },
  },

  // ── TA-2: Work on Shoulder — No Taper ─────────────────────────────────────
  // Work on shoulder, no encroachment into travel lane — no taper needed.
  {
    id: 'TA-2',
    title: 'Work on Shoulder — No Taper',
    seed: {
      mapCenter: MAP_CENTER,
      objects: [
        road2(),
        sign('shoulderwork', SR, 200),
        sign('roadwork',     SR, 340),
        zone('zone-1', CX + 60, WY - 30, 100, 80),
      ],
    },
    assert: {
      signs: ['shoulderwork', 'roadwork'],
      objectTypes: ['road', 'zone'],
      noDevices: true,
    },
  },

  // ── TA-3: Work on the Shoulder (minor encroachment) ───────────────────────
  // Shoulder work with slight encroachment into the travel lane; taper required.
  {
    id: 'TA-3',
    title: 'Work on the Shoulder',
    seed: {
      mapCenter: MAP_CENTER,
      objects: [
        road2(),
        sign('shoulderwork', SR, 190),
        sign('roadwork',     SR, 340),
        taper('taper-1', CX + 25, TY),
        zone('zone-1', CX + 55, WY - 30, 100, 80),
      ],
    },
    assert: {
      signs: ['shoulderwork', 'roadwork'],
      objectTypes: ['road', 'taper', 'zone'],
    },
  },

  // ── TA-4: Sidewalk Closure ─────────────────────────────────────────────────
  // Urban street. Sidewalk closed; pedestrian detour required.
  {
    id: 'TA-4',
    title: 'Sidewalk Closure',
    seed: {
      mapCenter: MAP_CENTER,
      objects: [
        road4(),
        sign('sidewalkclosed',   SR, 200),
        sign('pedestriandetour', SR, 340),
        zone('zone-1', CX + 100, WY - 30, 80, 120),
      ],
    },
    assert: {
      signs: ['sidewalkclosed', 'pedestriandetour'],
      objectTypes: ['road', 'zone'],
    },
  },

  // ── TA-5: Moving Work Zone on Two-Lane Road ────────────────────────────────
  // Slow-moving operation; arrow board replaces fixed taper.
  {
    id: 'TA-5',
    title: 'Moving Work Zone on Two-Lane Road',
    seed: {
      mapCenter: MAP_CENTER,
      objects: [
        road2(),
        sign('roadwork',        SR, 190),
        sign('movingoperation', SR, 340),
        device('ab-1', 'arrow_board', CX + 20, TY),
      ],
    },
    assert: {
      signs: ['roadwork', 'movingoperation'],
      devices: ['arrow_board'],
      objectTypes: ['road'],
    },
  },

  // ── TA-6: Shoulder Work with Minor Encroachment ───────────────────────────
  // Encroaches into travel lane; merge warning + taper required.
  {
    id: 'TA-6',
    title: 'Shoulder Work with Minor Encroachment',
    seed: {
      mapCenter: MAP_CENTER,
      objects: [
        road2(),
        sign('shoulderwork', SR, 150),
        sign('roadwork',     SR, 270),
        sign('merge',        SR, 390),
        taper('taper-1', CX + 20, TY),
        zone('zone-1', CX + 50, WY - 30, 100, 80),
      ],
    },
    assert: {
      signs: ['shoulderwork', 'merge'],
      objectTypes: ['road', 'taper'],
    },
  },

  // ── TA-7: Work Beyond Shoulder — Limited Access Highway ───────────────────
  // Freeway context; work is off the paved shoulder — no lane impact.
  // Arrow board on shoulder faces approaching traffic.
  {
    id: 'TA-7',
    title: 'Work Beyond Shoulder — Limited Access Highway',
    seed: {
      mapCenter: MAP_CENTER,
      objects: [
        roadFwy(),
        sign('roadwork',     SR, 190),
        sign('shoulderwork', SR, 340),
        device('ab-1', 'arrow_board', CX + 110, TY),
        zone('zone-1', CX + 120, WY - 30, 100, 80),
      ],
    },
    assert: {
      signs: ['roadwork', 'shoulderwork'],
      devices: ['arrow_board'],
      objectTypes: ['road', 'zone'],
    },
  },

  // ── TA-8: Two-Lane Road — One Lane Alternating with Flaggers ──────────────
  // Full one-lane alternating section; flaggers at each end.
  {
    id: 'TA-8',
    title: 'Two-Lane Road — One Lane Alternating with Flaggers',
    seed: {
      mapCenter: MAP_CENTER,
      objects: [
        road2(),
        sign('roadwork',     SR, 150),
        sign('flaggerahead', SR, 270),
        sign('onelane',      SR, 390),
        taper('taper-1', CX, TY),
        zone('zone-1', CX, WY - 30, 80, 150),
        device('flagger-1', 'flagger', CX, TY - 10),
        device('flagger-2', 'flagger', CX, WY + 90),
      ],
    },
    assert: {
      signs: ['roadwork', 'flaggerahead', 'onelane'],
      devices: ['flagger'],
      objectTypes: ['road', 'taper', 'zone'],
      minDevices: { flagger: 2 },
    },
  },

  // ── TA-9: Two-Lane Road — Pilot Car Operations ────────────────────────────
  // Long section; pilot car escorts traffic through.
  // Flaggers at each end signal when pilot car arrives.
  {
    id: 'TA-9',
    title: 'Two-Lane Road — Pilot Car Operations',
    seed: {
      mapCenter: MAP_CENTER,
      objects: [
        road2(),
        sign('roadwork',      SR, 150),
        sign('pilotcar',      SR, 270),
        sign('preparetostop', SR, 390),
        zone('zone-1', CX, WY - 30, 80, 200),
        device('flagger-1', 'flagger', CX, TY),
        device('flagger-2', 'flagger', CX, WY + 120),
      ],
    },
    assert: {
      signs: ['roadwork', 'pilotcar', 'preparetostop'],
      devices: ['flagger'],
      objectTypes: ['road', 'zone'],
      minDevices: { flagger: 2 },
    },
  },

  // ── TA-10: Lane Closure using Flaggers ────────────────────────────────────
  // Two-lane road; one lane closed; flaggers control alternating traffic.
  {
    id: 'TA-10',
    title: 'Lane Closure using Flaggers',
    seed: {
      mapCenter: MAP_CENTER,
      objects: [
        road2(),
        sign('roadwork',     SR, 150),
        sign('flaggerahead', SR, 270),
        sign('onelane',      SR, 390),
        taper('taper-1', CX, TY),
        zone('zone-1', CX, WY - 30, 80, 150),
        device('flagger-1', 'flagger', CX, TY - 10),
        device('flagger-2', 'flagger', CX, WY + 90),
      ],
    },
    assert: {
      signs: ['roadwork', 'flaggerahead', 'onelane'],
      devices: ['flagger'],
      objectTypes: ['road', 'taper', 'zone'],
    },
  },

  // ── TA-11: Lane Closure with Low Traffic Volumes ──────────────────────────
  // Low-volume road; signs + taper only; no flaggers or devices required.
  {
    id: 'TA-11',
    title: 'Lane Closure with Low Traffic Volumes',
    seed: {
      mapCenter: MAP_CENTER,
      objects: [
        road2(),
        sign('roadwork', SR, 190),
        sign('onelane',  SR, 340),
        taper('taper-1', CX, TY),
        zone('zone-1', CX, WY - 30, 80, 150),
      ],
    },
    assert: {
      signs: ['roadwork', 'onelane'],
      objectTypes: ['road', 'taper', 'zone'],
      noDevices: true,
    },
  },

  // ── TA-12: Lane Closure using Traffic Control Signals ─────────────────────
  // Temp signals at each end alternate traffic through one lane.
  {
    id: 'TA-12',
    title: 'Lane Closure using Traffic Control Signals',
    seed: {
      mapCenter: MAP_CENTER,
      objects: [
        road2(),
        sign('roadwork', SR, 190),
        sign('signal',   SR, 340),
        taper('taper-1', CX, TY),
        zone('zone-1', CX, WY - 30, 80, 150),
        device('sig-1', 'temp_signal', CX, TY - 5),
        device('sig-2', 'temp_signal', CX, WY + 90),
      ],
    },
    assert: {
      signs: ['signal'],
      devices: ['temp_signal'],
      objectTypes: ['road', 'taper', 'zone'],
      minDevices: { temp_signal: 2 },
    },
  },

  // ── TA-13: Right Lane Closure — Urban Near-Side Intersection ──────────────
  // Four-lane urban road. Right lane closed before the intersection.
  {
    id: 'TA-13',
    title: 'Right Lane Closure — Urban Near-Side Intersection',
    seed: {
      mapCenter: MAP_CENTER,
      objects: [
        road4(),
        sign('roadwork',      SR, 150),
        sign('rightlaneends', SR, 270),
        sign('merge',         SR, 390),
        taper('taper-1', CX + 40, TY, 45),
        zone('zone-1', CX + 40, WY - 30, 80, 150),
        device('ab-1', 'arrow_board', CX + 40, TY - 10),
      ],
    },
    assert: {
      signs: ['roadwork', 'rightlaneends', 'merge'],
      devices: ['arrow_board'],
      objectTypes: ['road', 'taper', 'zone'],
    },
  },

  // ── TA-14: Right Lane Closure — Urban Far-Side Intersection ───────────────
  // Taper begins after the intersection; right lane closed on far side.
  {
    id: 'TA-14',
    title: 'Right Lane Closure — Urban Far-Side Intersection',
    seed: {
      mapCenter: MAP_CENTER,
      objects: [
        road4(),
        sign('roadwork',      SR, 190),
        sign('rightlaneends', SR, 340),
        taper('taper-1', CX + 40, TY, 45),
        zone('zone-1', CX + 40, WY - 30, 80, 150),
        device('ab-1', 'arrow_board', CX + 40, TY - 10),
      ],
    },
    assert: {
      signs: ['roadwork', 'rightlaneends'],
      devices: ['arrow_board'],
      objectTypes: ['road', 'taper', 'zone'],
    },
  },

  // ── TA-15: Left Lane Closure — Urban Intersection ─────────────────────────
  // Left lane closed near urban intersection; merge right.
  {
    id: 'TA-15',
    title: 'Left Lane Closure — Urban Intersection',
    seed: {
      mapCenter: MAP_CENTER,
      objects: [
        road4(),
        sign('roadwork',     SR, 150),
        sign('leftlaneends', SR, 270),
        sign('merge',        SR, 390),
        taper('taper-1', CX - 40, TY, 45),
        zone('zone-1', CX - 40, WY - 30, 80, 150),
        device('ab-1', 'arrow_board', CX - 40, TY - 10),
      ],
    },
    assert: {
      signs: ['roadwork', 'leftlaneends', 'merge'],
      devices: ['arrow_board'],
      objectTypes: ['road', 'taper', 'zone'],
    },
  },

  // ── TA-16: Right Lane Closure — Multilane Undivided Highway ───────────────
  // Right lane closed; 45 mph; merge left.
  {
    id: 'TA-16',
    title: 'Right Lane Closure — Multilane Undivided Highway',
    seed: {
      mapCenter: MAP_CENTER,
      objects: [
        road4(),
        sign('roadwork',      SR, 150),
        sign('rightlaneends', SR, 270),
        sign('merge',         SR, 390),
        taper('taper-1', CX + 40, TY, 45),
        zone('zone-1', CX + 40, WY - 30, 80, 150),
        device('ab-1', 'arrow_board', CX + 40, TY - 10),
      ],
    },
    assert: {
      signs: ['roadwork', 'rightlaneends', 'merge'],
      devices: ['arrow_board'],
      objectTypes: ['road', 'taper', 'zone'],
    },
  },

  // ── TA-17: Left Lane Closure — Multilane Undivided Highway ────────────────
  // Left lane closed; 45 mph; merge right.
  {
    id: 'TA-17',
    title: 'Left Lane Closure — Multilane Undivided Highway',
    seed: {
      mapCenter: MAP_CENTER,
      objects: [
        road4(),
        sign('roadwork',     SR, 150),
        sign('leftlaneends', SR, 270),
        sign('merge',        SR, 390),
        taper('taper-1', CX - 40, TY, 45),
        zone('zone-1', CX - 40, WY - 30, 80, 150),
        device('ab-1', 'arrow_board', CX - 40, TY - 10),
      ],
    },
    assert: {
      signs: ['roadwork', 'leftlaneends', 'merge'],
      devices: ['arrow_board'],
      objectTypes: ['road', 'taper', 'zone'],
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
        road4(),
        sign('roadwork',    SR, 150),
        sign('twolaneends', SR, 270),
        sign('merge',       SR, 390),
        taper('taper-1', CX + 40, TY - 40, 45, 12, 2),
        taper('taper-2', CX + 20, TY,      45, 12, 1),
        zone('zone-1', CX + 30, WY - 30, 80, 150),
        device('ab-1', 'arrow_board', CX + 55, TY - 50),
        device('ab-2', 'arrow_board', CX + 30, TY - 10),
      ],
    },
    assert: {
      signs: ['roadwork', 'merge'],
      devices: ['arrow_board'],
      objectTypes: ['road', 'taper', 'zone'],
      minTapers: 2,
      minDevices: { arrow_board: 2 },
    },
  },

  // ── TA-19: Lane Shift — Multilane Highway ─────────────────────────────────
  // Traffic shifted laterally around work area; in-taper + out-taper.
  {
    id: 'TA-19',
    title: 'Lane Shift — Multilane Highway',
    seed: {
      mapCenter: MAP_CENTER,
      objects: [
        road4(),
        sign('roadwork',  SR, 190),
        sign('shiftleft', SR, 340),
        taper('taper-1', CX + 20, TY,      45),
        zone('zone-1',   CX - 20, WY - 30, 80, 150),
        taper('taper-2', CX - 20, WY + 80, 45),
        device('ab-1', 'arrow_board', CX + 20, TY - 10),
      ],
    },
    assert: {
      signs: ['roadwork', 'shiftleft'],
      devices: ['arrow_board'],
      objectTypes: ['road', 'taper', 'zone'],
    },
  },

  // ── TA-20: Ramp Closure on Surface Street ─────────────────────────────────
  // Entrance ramp closed; no main-lane taper; detour to next ramp.
  {
    id: 'TA-20',
    title: 'Ramp Closure on Surface Street',
    seed: {
      mapCenter: MAP_CENTER,
      objects: [
        road4(),
        sign('roadwork',   SR, 190),
        sign('rampclosed', SR, 280),
        sign('detour',     SR, 370),
        zone('zone-1', CX + 100, WY - 30, 100, 80),
      ],
    },
    assert: {
      signs: ['rampclosed', 'detour'],
      objectTypes: ['road', 'zone'],
    },
  },

  // ── TA-21: Lane Closure on Near Side of Intersection ─────────────────────
  // Taper closes lane before intersection; work zone at intersection.
  {
    id: 'TA-21',
    title: 'Lane Closure on Near Side of Intersection',
    seed: {
      mapCenter: MAP_CENTER,
      objects: [
        road4(),
        sign('roadwork', SR, 190),
        sign('merge',    SR, 340),
        taper('taper-1', CX + 40, TY, 45),
        zone('zone-1',   CX + 40, WY - 30, 80, 150),
      ],
    },
    assert: {
      signs: ['roadwork'],
      objectTypes: ['road', 'taper', 'zone'],
    },
  },

  // ── TA-22: Right Lane Closure on Far Side of Intersection ─────────────────
  // Right lane closed after intersection; taper begins past intersection.
  {
    id: 'TA-22',
    title: 'Right Lane Closure on Far Side of Intersection',
    seed: {
      mapCenter: MAP_CENTER,
      objects: [
        road4(),
        sign('roadwork',      SR, 190),
        sign('rightlaneends', SR, 340),
        taper('taper-1', CX + 40, TY, 45),
        zone('zone-1',   CX + 40, WY - 30, 80, 150),
      ],
    },
    assert: {
      signs: ['roadwork', 'rightlaneends'],
      objectTypes: ['road', 'taper', 'zone'],
    },
  },

  // ── TA-23: Left Lane Closure Near Intersection ─────────────────────────────
  // Left lane closed near urban intersection; merge right.
  {
    id: 'TA-23',
    title: 'Left Lane Closure Near Intersection',
    seed: {
      mapCenter: MAP_CENTER,
      objects: [
        road4(),
        sign('roadwork',     SR, 150),
        sign('leftlaneends', SR, 270),
        sign('merge',        SR, 390),
        taper('taper-1', CX - 40, TY, 45),
        zone('zone-1',   CX - 40, WY - 30, 80, 150),
        device('ab-1', 'arrow_board', CX - 40, TY - 10),
      ],
    },
    assert: {
      signs: ['roadwork', 'leftlaneends'],
      devices: ['arrow_board'],
      objectTypes: ['road', 'taper', 'zone'],
    },
  },

  // ── TA-24: Contraflow — Multilane Undivided Highway ───────────────────────
  // One direction uses a lane from the other; temp signals at each end.
  {
    id: 'TA-24',
    title: 'Contraflow — Multilane Undivided Highway',
    seed: {
      mapCenter: MAP_CENTER,
      objects: [
        road4(),
        sign('roadwork',      SR, 150),
        sign('onelane',       SR, 270),
        sign('preparetostop', SR, 390),
        zone('zone-1', CX, WY - 30, 80, 200),
        device('sig-1', 'temp_signal', CX, TY),
        device('sig-2', 'temp_signal', CX, WY + 120),
      ],
    },
    assert: {
      signs: ['roadwork', 'onelane'],
      devices: ['temp_signal'],
      objectTypes: ['road', 'zone'],
      minDevices: { temp_signal: 2 },
    },
  },

  // ── TA-25: Short Duration / Moving Operation — Urban ──────────────────────
  // Urban moving work zone; arrow board on vehicle; no fixed taper.
  {
    id: 'TA-25',
    title: 'Short Duration / Moving Operation — Urban',
    seed: {
      mapCenter: MAP_CENTER,
      objects: [
        road4(),
        sign('roadwork',        SR, 190),
        sign('movingoperation', SR, 340),
        device('ab-1', 'arrow_board', CX + 40, TY),
      ],
    },
    assert: {
      signs: ['roadwork', 'movingoperation'],
      devices: ['arrow_board'],
      objectTypes: ['road'],
    },
  },

  // ── TA-26: Divided Highway — Shoulder Work ────────────────────────────────
  // Work on right shoulder; no lane closure; arrow board on shoulder.
  {
    id: 'TA-26',
    title: 'Divided Highway — Shoulder Work',
    seed: {
      mapCenter: MAP_CENTER,
      objects: [
        roadDivR(), roadDivL(),
        sign('roadwork',     SR, 190),
        sign('shoulderwork', SR, 340),
        device('ab-1', 'arrow_board', CX + 105, TY),
        zone('zone-1', CX + 110, WY - 30, 100, 80),
      ],
    },
    assert: {
      signs: ['roadwork', 'shoulderwork'],
      devices: ['arrow_board'],
      objectTypes: ['road', 'zone'],
    },
  },

  // ── TA-27: Divided Highway — Right Lane Closure ───────────────────────────
  // Right lane closed on divided highway; 55 mph taper; arrow board.
  {
    id: 'TA-27',
    title: 'Divided Highway — Right Lane Closure',
    seed: {
      mapCenter: MAP_CENTER,
      objects: [
        roadDivR(), roadDivL(),
        sign('roadwork',      SR, 150),
        sign('rightlaneends', SR, 270),
        sign('merge',         SR, 390),
        taper('taper-1', CX + 75, TY, 55),
        zone('zone-1',   CX + 75, WY - 30, 80, 150),
        device('ab-1', 'arrow_board', CX + 75, TY - 10),
      ],
    },
    assert: {
      signs: ['roadwork', 'rightlaneends'],
      devices: ['arrow_board'],
      objectTypes: ['road', 'taper', 'zone'],
    },
  },

  // ── TA-28: Divided Highway — Left Lane Closure ────────────────────────────
  // Left (median) lane closed on divided highway; 55 mph; arrow board.
  {
    id: 'TA-28',
    title: 'Divided Highway — Left Lane Closure',
    seed: {
      mapCenter: MAP_CENTER,
      objects: [
        roadDivR(), roadDivL(),
        sign('roadwork',     SR, 150),
        sign('leftlaneends', SR, 270),
        sign('merge',        SR, 390),
        taper('taper-1', CX + 35, TY, 55),
        zone('zone-1',   CX + 35, WY - 30, 80, 150),
        device('ab-1', 'arrow_board', CX + 35, TY - 10),
      ],
    },
    assert: {
      signs: ['roadwork', 'leftlaneends'],
      devices: ['arrow_board'],
      objectTypes: ['road', 'taper', 'zone'],
    },
  },

  // ── TA-29: Divided Highway — Two Adjacent Lanes Closed ────────────────────
  // Both lanes of right roadway closed; nested tapers; two arrow boards.
  {
    id: 'TA-29',
    title: 'Divided Highway — Two Adjacent Lanes Closed',
    seed: {
      mapCenter: MAP_CENTER,
      objects: [
        roadDivR(), roadDivL(),
        sign('roadwork',    SR, 150),
        sign('twolaneends', SR, 270),
        sign('merge',       SR, 390),
        taper('taper-1', CX + 75, TY - 40, 55, 12, 2),
        taper('taper-2', CX + 55, TY,      55, 12, 1),
        zone('zone-1',   CX + 55, WY - 30, 80, 150),
        device('ab-1', 'arrow_board', CX + 85, TY - 50),
        device('ab-2', 'arrow_board', CX + 60, TY - 10),
      ],
    },
    assert: {
      signs: ['roadwork'],
      devices: ['arrow_board'],
      objectTypes: ['road', 'taper', 'zone'],
      minTapers: 2,
      minDevices: { arrow_board: 2 },
    },
  },

  // ── TA-30: Divided Highway — Ramp Closure ─────────────────────────────────
  // Ramp closed; detour signed; no main-lane closure.
  {
    id: 'TA-30',
    title: 'Divided Highway — Ramp Closure',
    seed: {
      mapCenter: MAP_CENTER,
      objects: [
        roadDivR(), roadDivL(),
        sign('roadwork',   SR, 190),
        sign('rampclosed', SR, 280),
        sign('detour',     SR, 370),
        zone('zone-1', CX + 120, WY - 30, 100, 80),
      ],
    },
    assert: {
      signs: ['rampclosed', 'detour'],
      objectTypes: ['road', 'zone'],
    },
  },

  // ── TA-31: Divided Highway — Crossover ────────────────────────────────────
  // Traffic redirected across median; temp signals control flow.
  {
    id: 'TA-31',
    title: 'Divided Highway — Crossover',
    seed: {
      mapCenter: MAP_CENTER,
      objects: [
        roadDivR(), roadDivL(),
        sign('roadwork',      SR, 150),
        sign('onelane',       SR, 270),
        sign('preparetostop', SR, 390),
        taper('taper-1', CX + 55, TY, 55),
        zone('zone-1', CX, WY - 30, 110, 150),
        device('sig-1', 'temp_signal', CX + 55, TY - 5),
        device('sig-2', 'temp_signal', CX - 55, WY + 100),
      ],
    },
    assert: {
      signs: ['roadwork', 'onelane'],
      devices: ['temp_signal'],
      objectTypes: ['road', 'taper', 'zone'],
      minDevices: { temp_signal: 2 },
    },
  },

  // ── TA-32: Divided Highway — Contraflow Operation ─────────────────────────
  // One direction uses lanes from opposite roadway; temp signals at each end.
  {
    id: 'TA-32',
    title: 'Divided Highway — Contraflow Operation',
    seed: {
      mapCenter: MAP_CENTER,
      objects: [
        roadDivR(), roadDivL(),
        sign('roadwork',   SR, 150),
        sign('onelane',    SR, 270),
        sign('contraflow', SR, 390),
        zone('zone-1', CX, WY - 30, 110, 200),
        device('sig-1', 'temp_signal', CX + 55, TY),
        device('sig-2', 'temp_signal', CX + 55, WY + 120),
      ],
    },
    assert: {
      signs: ['roadwork', 'onelane'],
      devices: ['temp_signal'],
      objectTypes: ['road', 'zone'],
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
        roadDivR(), roadDivL(),
        sign('roadwork', SR, 190),
        sign('merge',    SR, 340),
        taper('taper-1', CX + 55, TY, 65, 12, 1, 780),
        zone('zone-1',   CX + 55, WY - 30, 80, 150),
        device('ab-1', 'arrow_board', CX + 55, TY - 10),
      ],
    },
    assert: {
      signs: ['roadwork'],
      devices: ['arrow_board'],
      objectTypes: ['road', 'taper', 'zone'],
      taperFormula: { speed: 65, laneWidth: 12, expectedFt: 780 },
    },
  },

  // ── TA-34: Moving Operations on Divided Highway ───────────────────────────
  // Slow-moving work zone; arrow board on shadow vehicle.
  {
    id: 'TA-34',
    title: 'Moving Operations on Divided Highway',
    seed: {
      mapCenter: MAP_CENTER,
      objects: [
        roadDivR(), roadDivL(),
        sign('roadwork',        SR, 190),
        sign('movingoperation', SR, 340),
        device('ab-1', 'arrow_board', CX + 55, TY),
      ],
    },
    assert: {
      signs: ['roadwork', 'movingoperation'],
      devices: ['arrow_board'],
      objectTypes: ['road'],
    },
  },

  // ── TA-35: Divided Highway — Double Lane Closure ──────────────────────────
  // Both lanes of right roadway closed; two tapers; two arrow boards.
  {
    id: 'TA-35',
    title: 'Divided Highway — Double Lane Closure',
    seed: {
      mapCenter: MAP_CENTER,
      objects: [
        roadDivR(), roadDivL(),
        sign('roadwork', SR, 190),
        sign('merge',    SR, 340),
        taper('taper-1', CX + 75, TY - 40, 65, 12, 2),
        taper('taper-2', CX + 55, TY,      65, 12, 1),
        zone('zone-1',   CX + 55, WY - 30, 80, 150),
        device('ab-1', 'arrow_board', CX + 85, TY - 50),
        device('ab-2', 'arrow_board', CX + 60, TY - 10),
      ],
    },
    assert: {
      signs: ['roadwork'],
      devices: ['arrow_board'],
      objectTypes: ['road', 'taper', 'zone'],
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
        roadFwy(),
        sign('roadwork',     SR, 190),
        sign('shoulderwork', SR, 340),
        device('ab-1', 'arrow_board', CX + 120, TY),
        zone('zone-1', CX + 130, WY - 30, 100, 80),
      ],
    },
    assert: {
      signs: ['roadwork', 'shoulderwork'],
      devices: ['arrow_board'],
      objectTypes: ['road', 'zone'],
    },
  },

  // ── TA-37: Double Lane Closure on a Freeway ───────────────────────────────
  // Two lanes closed on freeway; nested tapers; two arrow boards; 65 mph.
  {
    id: 'TA-37',
    title: 'Double Lane Closure on a Freeway',
    seed: {
      mapCenter: MAP_CENTER,
      objects: [
        roadFwy(),
        sign('roadwork', SR, 190),
        sign('merge',    SR, 340),
        taper('taper-1', CX + 50, TY - 40, 65, 12, 2),
        taper('taper-2', CX + 25, TY,      65, 12, 1),
        zone('zone-1',   CX + 25, WY - 30, 80, 150),
        device('ab-1', 'arrow_board', CX + 60, TY - 50),
        device('ab-2', 'arrow_board', CX + 30, TY - 10),
      ],
    },
    assert: {
      objectTypes: ['road', 'taper', 'zone'],
      devices: ['arrow_board'],
      minTapers: 2,
      minDevices: { arrow_board: 2 },
    },
  },

  // ── TA-38: Freeway — Right Lane Closure ───────────────────────────────────
  // Single right lane closed; 65 mph; L = 780 ft; arrow board.
  {
    id: 'TA-38',
    title: 'Freeway — Right Lane Closure',
    seed: {
      mapCenter: MAP_CENTER,
      objects: [
        roadFwy(),
        sign('roadwork',      SR, 150),
        sign('rightlaneends', SR, 270),
        sign('merge',         SR, 390),
        taper('taper-1', CX + 50, TY, 65, 12, 1, 780),
        zone('zone-1',   CX + 50, WY - 30, 80, 150),
        device('ab-1', 'arrow_board', CX + 50, TY - 10),
      ],
    },
    assert: {
      signs: ['roadwork', 'rightlaneends'],
      devices: ['arrow_board'],
      objectTypes: ['road', 'taper', 'zone'],
      taperFormula: { speed: 65, laneWidth: 12, expectedFt: 780 },
    },
  },

  // ── TA-39: Freeway — Left Lane Closure ────────────────────────────────────
  // Single left (median) lane closed; 65 mph; arrow board.
  {
    id: 'TA-39',
    title: 'Freeway — Left Lane Closure',
    seed: {
      mapCenter: MAP_CENTER,
      objects: [
        roadFwy(),
        sign('roadwork',     SR, 150),
        sign('leftlaneends', SR, 270),
        sign('merge',        SR, 390),
        taper('taper-1', CX - 50, TY, 65, 12, 1, 780),
        zone('zone-1',   CX - 50, WY - 30, 80, 150),
        device('ab-1', 'arrow_board', CX - 50, TY - 10),
      ],
    },
    assert: {
      signs: ['roadwork', 'leftlaneends'],
      devices: ['arrow_board'],
      objectTypes: ['road', 'taper', 'zone'],
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
        roadFwy(),
        sign('rampclosed', SR, 230),
        sign('detour',     SR, 360),
        zone('zone-1', CX + 130, WY - 30, 100, 80),
      ],
    },
    assert: {
      signs: ['rampclosed', 'detour'],
      objectTypes: ['road', 'zone'],
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
        roadFwy(),
        sign('exitclosed', SR, 230),
        sign('detour',     SR, 360),
        zone('zone-1', CX + 130, WY - 30, 100, 80),
      ],
    },
    assert: {
      signs: ['exitclosed', 'detour'],
      objectTypes: ['road', 'zone'],
    },
  },

  // ── TA-42: Freeway — Median Work (No Lane Closure) ────────────────────────
  // Work confined to median; travel lanes unaffected; arrow board in median.
  {
    id: 'TA-42',
    title: 'Freeway — Median Work (No Lane Closure)',
    seed: {
      mapCenter: MAP_CENTER,
      objects: [
        roadFwy(),
        sign('roadwork',     SR, 190),
        sign('shoulderwork', SR, 340),
        device('ab-1', 'arrow_board', CX, TY),
        zone('zone-1', CX, WY - 30, 80, 120),
      ],
    },
    assert: {
      signs: ['roadwork'],
      devices: ['arrow_board'],
      objectTypes: ['road', 'zone'],
    },
  },

  // ── TA-43: Freeway — Lane Closure with Median Crossover ───────────────────
  // Traffic routed to opposite roadway via median crossover; temp signals.
  {
    id: 'TA-43',
    title: 'Freeway — Lane Closure with Median Crossover',
    seed: {
      mapCenter: MAP_CENTER,
      objects: [
        roadFwy(),
        sign('roadwork',      SR, 150),
        sign('onelane',       SR, 270),
        sign('preparetostop', SR, 390),
        taper('taper-1', CX + 25, TY, 65),
        zone('zone-1', CX, WY - 30, 150, 200),
        device('sig-1', 'temp_signal', CX + 25, TY - 5),
        device('sig-2', 'temp_signal', CX - 25, WY + 130),
      ],
    },
    assert: {
      signs: ['roadwork', 'onelane'],
      devices: ['temp_signal'],
      objectTypes: ['road', 'taper', 'zone'],
      minDevices: { temp_signal: 2 },
    },
  },

  // ── TA-44: Freeway — Contraflow Operation ─────────────────────────────────
  // Both directions share one side; temp signals at each end of contraflow.
  {
    id: 'TA-44',
    title: 'Freeway — Contraflow Operation',
    seed: {
      mapCenter: MAP_CENTER,
      objects: [
        roadFwy(),
        sign('roadwork',   SR, 150),
        sign('onelane',    SR, 270),
        sign('contraflow', SR, 390),
        zone('zone-1', CX, WY - 30, 150, 200),
        device('sig-1', 'temp_signal', CX, TY),
        device('sig-2', 'temp_signal', CX, WY + 130),
      ],
    },
    assert: {
      signs: ['roadwork', 'onelane'],
      devices: ['temp_signal'],
      objectTypes: ['road', 'zone'],
      minDevices: { temp_signal: 2 },
    },
  },

  // ── TA-45: Freeway — Moving Operations ────────────────────────────────────
  // Moving work zone at freeway speeds; two shadow vehicles with arrow boards.
  {
    id: 'TA-45',
    title: 'Freeway — Moving Operations (Short Duration)',
    seed: {
      mapCenter: MAP_CENTER,
      objects: [
        roadFwy(),
        sign('roadwork',        SR, 190),
        sign('movingoperation', SR, 340),
        device('ab-1', 'arrow_board', CX + 25, TY),
        device('ab-2', 'arrow_board', CX + 25, TY + 60),
      ],
    },
    assert: {
      signs: ['roadwork', 'movingoperation'],
      devices: ['arrow_board'],
      objectTypes: ['road'],
      minDevices: { arrow_board: 2 },
    },
  },

  // ── TA-46: Urban Intersection — Approach Lane Closure ─────────────────────
  // Right approach lane and adjacent sidewalk closed; pedestrian detour.
  {
    id: 'TA-46',
    title: 'Urban Intersection — Approach Lane Closure',
    seed: {
      mapCenter: MAP_CENTER,
      objects: [
        road4(),
        sign('roadwork',         SR, 150),
        sign('rightlaneends',    SR, 270),
        sign('sidewalkclosed',   SR, 390),
        taper('taper-1', CX + 40, TY, 35),
        zone('zone-1', CX + 40, WY - 30, 80, 150),
      ],
    },
    assert: {
      signs: ['roadwork', 'rightlaneends', 'sidewalkclosed'],
      objectTypes: ['road', 'taper', 'zone'],
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
        road4(),
        sign('roadwork', SR, 190),
        sign('detour',   SR, 340),
        zone('zone-1', CX, WY - 30, 100, 100),
        device('ab-1', 'arrow_board', CX, TY),
      ],
    },
    assert: {
      signs: ['roadwork', 'detour'],
      devices: ['arrow_board'],
      objectTypes: ['road', 'zone'],
    },
  },

  // ── TA-48: Sidewalk Closure and Pedestrian Detour ─────────────────────────
  // Sidewalk and crosswalk closed; marked alternate pedestrian route.
  {
    id: 'TA-48',
    title: 'Sidewalk Closure and Pedestrian Detour',
    seed: {
      mapCenter: MAP_CENTER,
      objects: [
        road4(),
        sign('sidewalkclosed',   SR, 150),
        sign('pedestriandetour', SR, 270),
        sign('crosswalkclosed',  SR, 390),
        zone('zone-1', CX + 100, WY - 30, 80, 120),
      ],
    },
    assert: {
      signs: ['sidewalkclosed', 'pedestriandetour', 'crosswalkclosed'],
      objectTypes: ['road', 'zone'],
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
        road4(),
        sign('crosswalkclosed',  SR, 190),
        sign('pedestriandetour', SR, 340),
        zone('zone-1', CX + 100, WY - 30, 80, 80),
      ],
    },
    assert: {
      signs: ['crosswalkclosed', 'pedestriandetour'],
      objectTypes: ['road', 'zone'],
    },
  },

  // ── TA-50: High-Speed Two-Lane Road — Flagger-Controlled Closure ──────────
  // Rural road at 65 mph; extended advance warning distances; flaggers required.
  {
    id: 'TA-50',
    title: 'High-Speed Two-Lane Road — Flagger-Controlled Closure',
    seed: {
      mapCenter: MAP_CENTER,
      objects: [
        road2(),
        sign('roadwork',     SR, 150),
        sign('flaggerahead', SR, 270),
        sign('onelane',      SR, 390),
        taper('taper-1', CX, TY, 65),
        zone('zone-1', CX, WY - 30, 80, 150),
        device('flagger-1', 'flagger', CX, TY - 10),
        device('flagger-2', 'flagger', CX, WY + 90),
      ],
    },
    assert: {
      signs: ['roadwork', 'flaggerahead', 'onelane'],
      devices: ['flagger'],
      objectTypes: ['road', 'taper', 'zone'],
      minDevices: { flagger: 2 },
    },
  },

  // ── TA-51: Work at Complex Multi-Leg Intersection ─────────────────────────
  // Work zone affects multiple approaches; signing and arrow boards on each.
  {
    id: 'TA-51',
    title: 'Work at Complex Multi-Leg Intersection',
    seed: {
      mapCenter: MAP_CENTER,
      objects: [
        road4(),
        sign('roadwork',  SR,  190),
        sign('roadwork2', SL,  190),
        sign('detour',    SR,  340),
        sign('detour2',   SL,  340),
        zone('zone-1', CX, WY - 30, 100, 100),
        device('ab-1', 'arrow_board', CX + 40, TY),
        device('ab-2', 'arrow_board', CX - 40, TY),
      ],
    },
    assert: {
      signs: ['roadwork', 'detour'],
      devices: ['arrow_board'],
      objectTypes: ['road', 'zone'],
      minDevices: { arrow_board: 2 },
    },
  },

  // ── TA-52: Work in Roundabout ─────────────────────────────────────────────
  // Lane or splitter-island work in roundabout; signs at entries.
  {
    id: 'TA-52',
    title: 'Work in Roundabout',
    seed: {
      mapCenter: MAP_CENTER,
      objects: [
        road4(),
        sign('roadwork', SR, 190),
        sign('detour',   SR, 340),
        zone('zone-1', CX, WY - 30, 80, 80),
        device('ab-1', 'arrow_board', CX, TY),
      ],
    },
    assert: {
      signs: ['roadwork', 'detour'],
      devices: ['arrow_board'],
      objectTypes: ['road', 'zone'],
    },
  },

  // ── TA-53: Work on Bridge or Structure ────────────────────────────────────
  // Lane closure on bridge deck; same signing geometry as standard lane closure.
  {
    id: 'TA-53',
    title: 'Work on Bridge or Structure',
    seed: {
      mapCenter: MAP_CENTER,
      objects: [
        road4(),
        sign('roadwork',      SR, 150),
        sign('rightlaneends', SR, 270),
        sign('merge',         SR, 390),
        taper('taper-1', CX + 40, TY, 45),
        zone('zone-1',   CX + 40, WY - 30, 80, 150),
        device('ab-1', 'arrow_board', CX + 40, TY - 10),
      ],
    },
    assert: {
      signs: ['roadwork', 'rightlaneends'],
      devices: ['arrow_board'],
      objectTypes: ['road', 'taper', 'zone'],
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
        roadFwy(),
        sign('roadwork',        SR, 190),
        sign('movingoperation', SR, 340),
        device('ab-1', 'arrow_board', CX + 25, TY),
        device('ab-2', 'arrow_board', CX + 25, TY + 60),
      ],
    },
    assert: {
      signs: ['roadwork', 'movingoperation'],
      devices: ['arrow_board'],
      objectTypes: ['road'],
      minDevices: { arrow_board: 2 },
    },
  },

  // ── TA-101(CA): Right Lane + Bike Lane Closure (California supplement) ─────
  // CA-specific: right lane and adjacent bike lane both closed.
  {
    id: 'TA-101',
    title: 'Right Lane + Bike Lane Closure (CA)',
    seed: {
      mapCenter: MAP_CENTER,
      objects: [
        road4(),
        sign('roadwork',       SR, 150),
        sign('bikelaneclosed', SR, 270),
        sign('rightlaneends',  SR, 390),
        taper('taper-1', CX + 40, TY, 35),
        zone('zone-1',   CX + 40, WY - 30, 80, 150),
      ],
    },
    assert: {
      signs: ['bikelaneclosed', 'rightlaneends'],
      objectTypes: ['road', 'taper', 'zone'],
    },
  },

]
