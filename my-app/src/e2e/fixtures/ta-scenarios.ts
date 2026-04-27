/**
 * MUTCD Chapter 6P — Typical Application (TA) scenario fixtures.
 * `id: 'TA-1'…'TA-54'` matches MUTCD Table 6P-1; `title` comes from
 * `mutcd-6p-1-titles.ts` (federal). Seeds reflect each published figure.
 * CA supplement stays `TA-101`.
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

import type { SignData } from '../../types'
import { SIGN_CATEGORIES } from '../../features/tcp/tcpCatalog'
import { MUTCD_6P1_TA_TITLES } from './mutcd-6p-1-titles'

/** MUTCD Table 6P-1 official title for federal TA-1…TA-54. */
const mutcdTitle = (n: number) => MUTCD_6P1_TA_TITLES[n - 1]!

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MapCenter {
  lat: number
  lon: number
  zoom: number
}

export interface TAAssert {
  /** Unique sign catalog ids in seed order; must list every `sign(` in the seed. */
  signs: string[]
  signLabels?: Record<string, string>   // sign id → expected label text
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
  seed: { objects: unknown[] }
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


// Single source of truth: `features/tcp/tcpCatalog.ts` (flattened by id).
// TA scenarios use catalog sign IDs so seeds match production labels and MUTCD tags.
const buildSignData = (): Record<string, SignData> => {
  const out: Record<string, SignData> = {}
  for (const cat of Object.values(SIGN_CATEGORIES)) {
    for (const s of cat.signs) {
      out[s.id] = s
    }
  }
  return out
}

export const SIGN_DATA: Record<string, SignData> = buildSignData()

const sign = (id: string, x: number, y: number) => {
  const data = SIGN_DATA[id] ?? { id, label: id.replace(/_/g, ' ').toUpperCase(), shape: 'diamond' as const, color: '#f97316', textColor: '#111' }
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
      ...(data.border ? { border: data.border } : {}),
    },
  }
}

/** Unique sign catalog ids in `seed.objects` order (first appearance only). */
export function getSignIdsFromSeed(seed: { objects: unknown[] }): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const obj of seed.objects as Array<{ type?: string; signData?: { id?: string } }>) {
    if (obj?.type === 'sign' && obj.signData?.id) {
      const id = obj.signData.id
      if (!seen.has(id)) {
        seen.add(id)
        out.push(id)
      }
    }
  }
  return out
}

// rotation: 90 = taper points south (down) — correct for our vertical north→south road layout.
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

  // ── TA-1: Work Beyond the Shoulder (MUTCD Figure 6P-1) ───────────────────
  // Two-lane road. Work is completely off the right shoulder — no taper.
  // One advance warning sign only (W20-1). Work zone beyond shoulder.
  {
    id: 'TA-1',
    title: mutcdTitle(1),
    seed: {
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

  // ── TA-2: Blasting Zone (MUTCD Figure 6P-2) ──────────────────────────────
  // Two-lane two-way road passing through a blasting zone.
  // W22-1 (BLASTING ZONE AHEAD) → R22-2 (TURN OFF RADIO) → W22-3 (END).
  {
    id: 'TA-2',
    title: mutcdTitle(2),
    seed: {
      objects: [
        road2(),
        sign('blastingzoneahead', SR, 150),
        sign('turnoffradio',      SR, 270),
        zone('zone-1', WX, 330, 100, 120),
        sign('endblastingzone',   SR, 490),
      ],
    },
    assert: {
      signs: ['blastingzoneahead', 'turnoffradio', 'endblastingzone'],
      objectTypes: ['road', 'zone'],
      noDevices: true,
    },
  },

  // ── TA-3: Work on the Shoulder (MUTCD Figure 6P-3) ───────────────────────
  // Pure shoulder work — no lane encroachment, no taper.
  // G20-1 (advance distance) → W21-5a (shoulder work) → W20-1 → G20-2 (end).
  {
    id: 'TA-3',
    title: mutcdTitle(3),
    seed: {
      objects: [
        road2(),
        sign('roadworknextmi', SR, 150),
        sign('shoulderwork',   SR, 250),
        sign('roadwork',       SR, 360),
        sign('endwork',        SR, 500),
        zone('zone-1', CX + 55, WY - 30, 100, 80),
      ],
    },
    assert: {
      signs: ['roadworknextmi', 'shoulderwork', 'roadwork', 'endwork'],
      objectTypes: ['road', 'zone'],
    },
  },

  // ── TA-4: Short Duration or Mobile Operation on a Shoulder (Figure 6P-4) ─
  // G20-1 → W21-5a → W20-1; no END sign (mobile/short-duration).
  {
    id: 'TA-4',
    title: mutcdTitle(4),
    seed: {
      objects: [
        road2(),
        sign('roadworknextmi', SR, 150),
        sign('shoulderwork',   SR, 250),
        sign('roadwork',       SR, 360),
        zone('zone-1', CX + 40, WY - 30, 90, 80),
      ],
    },
    assert: {
      signs: ['roadworknextmi', 'shoulderwork', 'roadwork'],
      objectTypes: ['road', 'zone'],
    },
  },

  // ── TA-5: Shoulder Closure on a Freeway (MUTCD Figure 6P-5) ─────────────
  // Freeway; shoulder closed — no lane impact. W20-1 → W21-5a.
  // Arrow board on closed shoulder faces traffic.
  {
    id: 'TA-5',
    title: mutcdTitle(5),
    seed: {
      objects: [
        roadFwy(),
        sign('roadwork',     SR, 190),
        sign('shoulderwork', SR, 340),
        device('ab-1', 'arrow_board', CX + 30, TY),
        zone('zone-1', CX + 60, WY - 30, 120, 60),
      ],
    },
    assert: {
      signs: ['roadwork', 'shoulderwork'],
      devices: ['arrow_board'],
      objectTypes: ['road', 'zone'],
    },
  },

  // ── TA-6: Shoulder Work with Minor Encroachment (MUTCD Figure 6P-6) ──────
  // Encroaches into travel lane; W4-2 (MERGE) + taper required.
  {
    id: 'TA-6',
    title: mutcdTitle(6),
    seed: {
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
      signs: ['shoulderwork', 'roadwork', 'merge'],
      objectTypes: ['road', 'taper', 'zone'],
    },
  },

  // ── TA-7: Road Closed with a Diversion (MUTCD Figure 6P-7) ──────────────
  // Entire two-lane road closed; traffic diverted via alternate route.
  // R11-2 (ROAD CLOSED) + M4-11 (DIVERSION ROUTE).
  {
    id: 'TA-7',
    title: mutcdTitle(7),
    seed: {
      objects: [
        road2(),
        sign('roadclosed',   SR, 190),
        sign('diversionrte', SR, 340),
        zone('zone-1', CX, WY - 30, 80, 150),
      ],
    },
    assert: {
      signs: ['roadclosed', 'diversionrte'],
      objectTypes: ['road', 'zone'],
    },
  },

  // ── TA-8: Roads Closed with an Off-Site Detour (MUTCD Figure 6P-8) ───────
  // Both directions of a two-lane road closed; off-site detour signs on
  // each approach (both shoulders). R11-2 + M4-8.
  {
    id: 'TA-8',
    title: mutcdTitle(8),
    seed: {
      objects: [
        road2(),
        sign('roadclosed', SR, 190),
        sign('detour',     SR, 340),
        sign('roadclosed', SL, 190),
        sign('detour',     SL, 340),
        zone('zone-1', CX, WY - 30, 80, 150),
      ],
    },
    assert: {
      signs: ['roadclosed', 'detour'],
      objectTypes: ['road', 'zone'],
    },
  },

  // ── TA-9: Overlapping Routes with a Detour (MUTCD Figure 6P-9) ───────────
  // Road shared by multiple numbered routes; one route's traffic is detoured
  // while overlapping routes continue. R11-2 + M4-8.
  {
    id: 'TA-9',
    title: mutcdTitle(9),
    seed: {
      objects: [
        road2(),
        sign('roadclosed', SR, 190),
        sign('detour',     SR, 340),
        zone('zone-1', CX, WY - 30, 80, 150),
      ],
    },
    assert: {
      signs: ['roadclosed', 'detour'],
      objectTypes: ['road', 'zone'],
    },
  },

  // ── TA-10: Lane Closure on a Two-Lane Road Using Flaggers (Figure 6P-10) ─
  // Full one-lane alternating section; flaggers at each end.
  {
    id: 'TA-10',
    title: mutcdTitle(10),
    seed: {
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

  // ── TA-11: Lane Closure on a Two-Lane Road with Low Traffic Volumes ───────
  // Low-volume road; signs + taper only; no flaggers or devices required.
  {
    id: 'TA-11',
    title: mutcdTitle(11),
    seed: {
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

  // ── TA-12: Lane Closure Using Traffic Control Signals (Figure 6P-12) ─────
  // Temp signals at each end alternate traffic through one lane.
  {
    id: 'TA-12',
    title: mutcdTitle(12),
    seed: {
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
      signs: ['roadwork', 'signal'],
      devices: ['temp_signal'],
      objectTypes: ['road', 'taper', 'zone'],
      minDevices: { temp_signal: 2 },
    },
  },

  // ── TA-13: Temporary Road Closure (MUTCD Figure 6P-13) ───────────────────
  // Entire road temporarily closed; R11-2 + M4-8 detour route signed.
  {
    id: 'TA-13',
    title: mutcdTitle(13),
    seed: {
      objects: [
        road2(),
        sign('roadclosed', SR, 190),
        sign('detour',     SR, 340),
        zone('zone-1', CX, WY - 30, 80, 200),
      ],
    },
    assert: {
      signs: ['roadclosed', 'detour'],
      objectTypes: ['road', 'zone'],
    },
  },

  // ── TA-14: Haul Road Crossing (MUTCD Figure 6P-14) ───────────────────────
  // Construction vehicles cross the public road. W21-7 (TRUCKS ENTERING)
  // warns drivers; flagger controls the crossing.
  {
    id: 'TA-14',
    title: mutcdTitle(14),
    seed: {
      objects: [
        road2(),
        sign('roadwork',       SR, 190),
        sign('trucksentering', SR, 340),
        zone('zone-1', WX, WY - 30, 100, 80),
        device('flagger-1', 'flagger', CX, TY),
      ],
    },
    assert: {
      signs: ['roadwork', 'trucksentering'],
      devices: ['flagger'],
      objectTypes: ['road', 'zone'],
    },
  },

  // ── TA-15: Work in the Center of a Road with Low Traffic Volumes ──────────
  // Work zone in center of low-volume road; flaggers at each end alternate traffic.
  {
    id: 'TA-15',
    title: mutcdTitle(15),
    seed: {
      objects: [
        road2(),
        sign('roadwork', SR, 190),
        sign('onelane',  SR, 340),
        taper('taper-1', CX, TY),
        zone('zone-1', CX, WY - 30, 80, 150),
        device('flagger-1', 'flagger', CX, TY - 10),
        device('flagger-2', 'flagger', CX, WY + 90),
      ],
    },
    assert: {
      signs: ['roadwork', 'onelane'],
      devices: ['flagger'],
      objectTypes: ['road', 'taper', 'zone'],
      minDevices: { flagger: 2 },
    },
  },

  // ── TA-16: Surveying Along the Center Line — Low Traffic Volumes ──────────
  // Survey crew along center line; W21-5 (SURVEYORS) on both approaches.
  {
    id: 'TA-16',
    title: mutcdTitle(16),
    seed: {
      objects: [
        road2(),
        sign('surveyors', SR, 190),
        sign('surveyors', SL, 190),
        zone('zone-1', CX, WY - 30, 80, 120),
      ],
    },
    assert: {
      signs: ['surveyors'],
      objectTypes: ['road', 'zone'],
    },
  },

  // ── TA-17: Mobile Operations on a Two-Lane Road (MUTCD Figure 6P-17) ──────
  // Slow-moving work zone on two-lane road. Arrow board on shadow vehicle; no taper.
  {
    id: 'TA-17',
    title: mutcdTitle(17),
    seed: {
      objects: [
        road2(),
        sign('roadwork', SR, 190),
        sign('workers',  SR, 340),
        device('ab-1', 'arrow_board', CX, TY),
      ],
    },
    assert: {
      signs: ['roadwork', 'workers'],
      devices: ['arrow_board'],
      objectTypes: ['road'],
    },
  },

  // ── TA-18: Lane Closure on a Minor Street (MUTCD Figure 6P-18) ───────────
  // Single lane closed on a minor/low-speed street; arrow board.
  {
    id: 'TA-18',
    title: mutcdTitle(18),
    seed: {
      objects: [
        road4(),
        sign('roadwork',      SR, 190),
        sign('rightlaneends', SR, 340),
        taper('taper-1', CX + 40, TY, 35),
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

  // ── TA-19: Detour for One Travel Direction (MUTCD Figure 6P-19) ──────────
  // One direction of traffic on a multilane road detoured; opposing continues.
  {
    id: 'TA-19',
    title: mutcdTitle(19),
    seed: {
      objects: [
        road4(),
        sign('roadclosed', SR, 190),
        sign('detour',     SR, 340),
        zone('zone-1', CX + 40, WY - 30, 80, 150),
      ],
    },
    assert: {
      signs: ['roadclosed', 'detour'],
      objectTypes: ['road', 'zone'],
    },
  },

  // ── TA-20: Detour for a Closed Street (MUTCD Figure 6P-20) ──────────────
  // Street fully closed; all traffic sent on off-site detour. R11-2 + M4-8.
  {
    id: 'TA-20',
    title: mutcdTitle(20),
    seed: {
      objects: [
        road4(),
        sign('roadclosed', SR, 190),
        sign('detour',     SR, 340),
        zone('zone-1', CX, WY - 30, 80, 150),
      ],
    },
    assert: {
      signs: ['roadclosed', 'detour'],
      objectTypes: ['road', 'zone'],
    },
  },

  // ── TA-21: Lane Closure on the Near Side of an Intersection ──────────────
  // Taper closes right lane before intersection; work zone at intersection.
  {
    id: 'TA-21',
    title: mutcdTitle(21),
    seed: {
      objects: [
        road4(),
        sign('roadwork', SR, 190),
        sign('merge',    SR, 340),
        taper('taper-1', CX + 40, TY, 45),
        zone('zone-1',   CX + 40, WY - 30, 80, 150),
      ],
    },
    assert: {
      signs: ['roadwork', 'merge'],
      objectTypes: ['road', 'taper', 'zone'],
    },
  },

  // ── TA-22: Right-Hand Lane Closure on the Far Side of an Intersection ─────
  // Right lane closed after intersection; taper begins past intersection.
  {
    id: 'TA-22',
    title: mutcdTitle(22),
    seed: {
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

  // ── TA-23: Left-Hand Lane Closure on the Far Side of an Intersection ──────
  // Left lane closed; merge right; arrow board.
  {
    id: 'TA-23',
    title: mutcdTitle(23),
    seed: {
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
      signs: ['roadwork', 'leftlaneends', 'merge'],
      devices: ['arrow_board'],
      objectTypes: ['road', 'taper', 'zone'],
    },
  },

  // ── TA-24: Half Road Closure on the Far Side of an Intersection ───────────
  // Half the road (one lane in each direction) closed beyond intersection;
  // temp signals control alternating traffic.
  {
    id: 'TA-24',
    title: mutcdTitle(24),
    seed: {
      objects: [
        road4(),
        sign('roadwork', SR, 150),
        sign('onelane',  SR, 270),
        sign('prepstop', SR, 390),
        zone('zone-1', CX, WY - 30, 80, 200),
        device('sig-1', 'temp_signal', CX, TY),
        device('sig-2', 'temp_signal', CX, WY + 120),
      ],
    },
    assert: {
      signs: ['roadwork', 'onelane', 'prepstop'],
      devices: ['temp_signal'],
      objectTypes: ['road', 'zone'],
      minDevices: { temp_signal: 2 },
    },
  },

  // ── TA-25: Multiple Lane Closures at an Intersection (Figure 6P-25) ───────
  // Two lanes closed at/near an intersection; nested tapers, multiple boards.
  {
    id: 'TA-25',
    title: mutcdTitle(25),
    seed: {
      objects: [
        road4(),
        sign('roadwork',    SR, 150),
        sign('twolaneends', SR, 270),
        sign('merge',       SR, 390),
        taper('taper-1', CX + 50, TY - 40, 35, 12, 2),
        taper('taper-2', CX + 25, TY,      35, 12, 1),
        zone('zone-1',   CX + 25, WY - 30, 80, 150),
        device('ab-1', 'arrow_board', CX + 55, TY - 50),
        device('ab-2', 'arrow_board', CX + 30, TY - 10),
      ],
    },
    assert: {
      signs: ['roadwork', 'twolaneends', 'merge'],
      devices: ['arrow_board'],
      objectTypes: ['road', 'taper', 'zone'],
      minTapers: 2,
      minDevices: { arrow_board: 2 },
    },
  },

  // ── TA-26: Closure in the Center of an Intersection (Figure 6P-26) ────────
  // Work zone occupies the center of the intersection; arrow boards on approaches.
  {
    id: 'TA-26',
    title: mutcdTitle(26),
    seed: {
      objects: [
        road4(),
        sign('roadwork', SR, 190),
        sign('roadwork', SL, 190),
        zone('zone-1', CX, WY - 30, 80, 80),
        device('ab-1', 'arrow_board', CX + 40, TY),
        device('ab-2', 'arrow_board', CX - 40, TY),
      ],
    },
    assert: {
      signs: ['roadwork'],
      devices: ['arrow_board'],
      objectTypes: ['road', 'zone'],
      minDevices: { arrow_board: 2 },
    },
  },

  // ── TA-27: Closure at the Side of an Intersection (Figure 6P-27) ──────────
  // Work at the side of an intersection; right lane closed; arrow board.
  {
    id: 'TA-27',
    title: mutcdTitle(27),
    seed: {
      objects: [
        road4(),
        sign('roadwork',      SR, 190),
        sign('rightlaneends', SR, 340),
        taper('taper-1', CX + 40, TY, 35),
        zone('zone-1',   CX + 40, WY - 30, 80, 80),
        device('ab-1', 'arrow_board', CX + 40, TY - 10),
      ],
    },
    assert: {
      signs: ['roadwork', 'rightlaneends'],
      devices: ['arrow_board'],
      objectTypes: ['road', 'taper', 'zone'],
    },
  },

  // ── TA-28: Sidewalk Detour or Diversion (MUTCD Figure 6P-28) ─────────────
  // Sidewalk closed; pedestrian detour provided. R9-10 + M4-8a.
  {
    id: 'TA-28',
    title: mutcdTitle(28),
    seed: {
      objects: [
        road4(),
        sign('roadwork',       SR, 150),
        sign('sidewalkclosed', SR, 250),
        sign('peddetour',      SR, 370),
        zone('zone-1', CX + 100, WY - 30, 80, 120),
      ],
    },
    assert: {
      signs: ['roadwork', 'sidewalkclosed', 'peddetour'],
      objectTypes: ['road', 'zone'],
    },
  },

  // ── TA-29: Crosswalk Closures and Pedestrian Detours (Figure 6P-29) ───────
  // Crosswalk closed; pedestrian detour signed. W11-2a + M4-8a.
  {
    id: 'TA-29',
    title: mutcdTitle(29),
    seed: {
      objects: [
        road4(),
        sign('xwalkclosed', SR, 190),
        sign('peddetour',   SR, 340),
        zone('zone-1', CX + 100, WY - 30, 80, 80),
      ],
    },
    assert: {
      signs: ['xwalkclosed', 'peddetour'],
      objectTypes: ['road', 'zone'],
    },
  },

  // ── TA-30: Interior Lane Closure on a Multi-Lane Street (Figure 6P-30) ────
  // Center/interior lane closed on a multi-lane street. W9-3 (CENTER LANE).
  {
    id: 'TA-30',
    title: mutcdTitle(30),
    seed: {
      objects: [
        road4(),
        sign('roadwork',   SR, 150),
        sign('centerlane', SR, 270),
        sign('merge',      SR, 390),
        taper('taper-1', CX, TY, 45),
        zone('zone-1',   CX, WY - 30, 80, 150),
        device('ab-1', 'arrow_board', CX, TY - 10),
      ],
    },
    assert: {
      signs: ['roadwork', 'centerlane', 'merge'],
      devices: ['arrow_board'],
      objectTypes: ['road', 'taper', 'zone'],
    },
  },

  // ── TA-31: Lane Closure on a Street with Uneven Directional Volumes ────────
  // One lane closed; volumes differ by direction; flagger alternates flow.
  {
    id: 'TA-31',
    title: mutcdTitle(31),
    seed: {
      objects: [
        road4(),
        sign('roadwork',     SR, 150),
        sign('flaggerahead', SR, 270),
        sign('onelane',      SR, 390),
        taper('taper-1', CX + 40, TY, 35),
        zone('zone-1',   CX + 40, WY - 30, 80, 150),
        device('flagger-1', 'flagger', CX + 40, TY - 10),
        device('flagger-2', 'flagger', CX + 40, WY + 90),
      ],
    },
    assert: {
      signs: ['roadwork', 'flaggerahead', 'onelane'],
      devices: ['flagger'],
      objectTypes: ['road', 'taper', 'zone'],
      minDevices: { flagger: 2 },
    },
  },

  // ── TA-32: Half Road Closure on a Multi-Lane, High-Speed Highway ───────────
  // Half the lanes closed on a high-speed multilane road; temp signals.
  {
    id: 'TA-32',
    title: mutcdTitle(32),
    seed: {
      objects: [
        road4(),
        sign('roadwork', SR, 150),
        sign('onelane',  SR, 270),
        sign('prepstop', SR, 390),
        taper('taper-1', CX + 40, TY, 55),
        zone('zone-1', CX + 40, WY - 30, 80, 150),
        device('sig-1', 'temp_signal', CX + 40, TY - 5),
        device('sig-2', 'temp_signal', CX + 40, WY + 100),
      ],
    },
    assert: {
      signs: ['roadwork', 'onelane', 'prepstop'],
      devices: ['temp_signal'],
      objectTypes: ['road', 'taper', 'zone'],
      minDevices: { temp_signal: 2 },
    },
  },

  // ── TA-33: Stationary Lane Closure on a Divided Highway (Figure 6P-33) ────
  // L = W × S formula; 65 mph; arrow board required.
  {
    id: 'TA-33',
    title: mutcdTitle(33),
    seed: {
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
      signs: ['roadwork', 'merge'],
      devices: ['arrow_board'],
      objectTypes: ['road', 'taper', 'zone'],
      taperFormula: { speed: 65, laneWidth: 12, expectedFt: 780 },
    },
  },

  // ── TA-34: Lane Closure with a Temporary Traffic Barrier (Figure 6P-34) ───
  // Lane closed using a temporary concrete/plastic barrier on divided highway;
  // TMA (truck-mounted attenuator) / barrier at upstream end.
  {
    id: 'TA-34',
    title: mutcdTitle(34),
    seed: {
      objects: [
        roadDivR(), roadDivL(),
        sign('roadwork', SR, 190),
        sign('merge',    SR, 340),
        taper('taper-1', CX + 55, TY, 55),
        zone('zone-1',   CX + 55, WY - 30, 80, 150),
        device('barrier-1', 'barrier',     CX + 55, TY + 20),
        device('ab-1',      'arrow_board', CX + 55, TY - 10),
      ],
    },
    assert: {
      signs: ['roadwork', 'merge'],
      devices: ['arrow_board', 'barrier'],
      objectTypes: ['road', 'taper', 'zone'],
    },
  },

  // ── TA-35: Mobile Operation on a Multi-Lane Road (MUTCD Figure 6P-35) ─────
  // Slow-moving work zone on multilane road; arrow board on shadow vehicle.
  {
    id: 'TA-35',
    title: mutcdTitle(35),
    seed: {
      objects: [
        road4(),
        sign('roadwork', SR, 190),
        sign('workers',  SR, 340),
        device('ab-1', 'arrow_board', CX + 40, TY),
      ],
    },
    assert: {
      signs: ['roadwork', 'workers'],
      devices: ['arrow_board'],
      objectTypes: ['road'],
    },
  },

  // ── TA-36: Lane Shift on a Freeway (MUTCD Figure 6P-36) ─────────────────
  // All freeway lanes shifted laterally; in-taper and out-taper; arrow board.
  {
    id: 'TA-36',
    title: mutcdTitle(36),
    seed: {
      objects: [
        roadFwy(),
        sign('roadwork',  SR, 190),
        sign('shiftleft', SR, 340),
        taper('taper-1', CX + 50, TY,       65),
        zone('zone-1',   CX - 25, WY - 30, 80, 150),
        taper('taper-2', CX - 25, WY + 80,  65),
        device('ab-1', 'arrow_board', CX + 50, TY - 10),
      ],
    },
    assert: {
      signs: ['roadwork', 'shiftleft'],
      devices: ['arrow_board'],
      objectTypes: ['road', 'taper', 'zone'],
      minTapers: 2,
    },
  },

  // ── TA-37: Double Lane Closure on a Freeway (MUTCD Figure 6P-37) ─────────
  // Two lanes closed on freeway; nested tapers; two arrow boards; 65 mph.
  {
    id: 'TA-37',
    title: mutcdTitle(37),
    seed: {
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
      signs: ['roadwork', 'merge'],
      devices: ['arrow_board'],
      objectTypes: ['road', 'taper', 'zone'],
      minTapers: 2,
      minDevices: { arrow_board: 2 },
    },
  },

  // ── TA-38: Interior Lane Closure on a Freeway (MUTCD Figure 6P-38) ────────
  // Interior (center/median) lane closed; W9-3 (CENTER LANE); 65 mph taper.
  {
    id: 'TA-38',
    title: mutcdTitle(38),
    seed: {
      objects: [
        roadFwy(),
        sign('roadwork',   SR, 150),
        sign('centerlane', SR, 270),
        sign('merge',      SR, 390),
        taper('taper-1', CX, TY, 65, 12, 1, 780),
        zone('zone-1',   CX, WY - 30, 80, 150),
        device('ab-1', 'arrow_board', CX, TY - 10),
      ],
    },
    assert: {
      signs: ['roadwork', 'centerlane', 'merge'],
      devices: ['arrow_board'],
      objectTypes: ['road', 'taper', 'zone'],
      taperFormula: { speed: 65, laneWidth: 12, expectedFt: 780 },
    },
  },

  // ── TA-39: Median Crossover on a Freeway (MUTCD Figure 6P-39) ────────────
  // Traffic from one side crosses median to use opposite roadway;
  // temp signals control both ends; prepare-to-stop signing.
  {
    id: 'TA-39',
    title: mutcdTitle(39),
    seed: {
      objects: [
        roadFwy(),
        sign('roadwork', SR, 150),
        sign('onelane',  SR, 270),
        sign('prepstop', SR, 390),
        taper('taper-1', CX + 25, TY, 65),
        zone('zone-1', CX, WY - 30, 150, 200),
        device('sig-1', 'temp_signal', CX + 25, TY - 5),
        device('sig-2', 'temp_signal', CX - 25, WY + 130),
      ],
    },
    assert: {
      signs: ['roadwork', 'onelane', 'prepstop'],
      devices: ['temp_signal'],
      objectTypes: ['road', 'taper', 'zone'],
      minDevices: { temp_signal: 2 },
    },
  },

  // ── TA-40: Median Crossover for an Entrance Ramp (Figure 6P-40) ──────────
  // Entrance ramp affected by median crossover; ramp closed + detour signed.
  {
    id: 'TA-40',
    title: mutcdTitle(40),
    seed: {
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

  // ── TA-41: Median Crossover for an Exit Ramp (Figure 6P-41) ─────────────
  // Exit ramp affected by median crossover; exit closed + detour signed.
  {
    id: 'TA-41',
    title: mutcdTitle(41),
    seed: {
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

  // ── TA-42: Work in the Vicinity of an Exit Ramp (Figure 6P-42) ───────────
  // Work near a freeway exit ramp; shoulder work + arrow board.
  {
    id: 'TA-42',
    title: mutcdTitle(42),
    seed: {
      objects: [
        roadFwy(),
        sign('roadwork',     SR, 190),
        sign('shoulderwork', SR, 340),
        device('ab-1', 'arrow_board', CX + 120, TY),
        zone('zone-1', CX + 130, WY - 30, 80, 80),
      ],
    },
    assert: {
      signs: ['roadwork', 'shoulderwork'],
      devices: ['arrow_board'],
      objectTypes: ['road', 'zone'],
    },
  },

  // ── TA-43: Partial Exit Ramp Closure (MUTCD Figure 6P-43) ────────────────
  // Exit ramp partially closed; traffic directed to remaining open portion
  // or detoured to next exit.
  {
    id: 'TA-43',
    title: mutcdTitle(43),
    seed: {
      objects: [
        roadFwy(),
        sign('exitclosed', SR, 230),
        sign('detour',     SR, 360),
        taper('taper-1', CX + 120, TY, 65),
        zone('zone-1', CX + 130, WY - 30, 80, 80),
      ],
    },
    assert: {
      signs: ['exitclosed', 'detour'],
      objectTypes: ['road', 'taper', 'zone'],
    },
  },

  // ── TA-44: Work in the Vicinity of an Entrance Ramp (Figure 6P-44) ────────
  // Work area near freeway entrance ramp; shoulder work + arrow board.
  {
    id: 'TA-44',
    title: mutcdTitle(44),
    seed: {
      objects: [
        roadFwy(),
        sign('roadwork',     SR, 190),
        sign('shoulderwork', SR, 340),
        device('ab-1', 'arrow_board', CX + 120, TY),
        zone('zone-1', CX + 130, WY - 30, 80, 80),
      ],
    },
    assert: {
      signs: ['roadwork', 'shoulderwork'],
      devices: ['arrow_board'],
      objectTypes: ['road', 'zone'],
    },
  },

  // ── TA-45: Temporary Reversible Lane Using Movable Barriers ──────────────
  // Center lane direction reversed using movable barriers; signals control entry.
  {
    id: 'TA-45',
    title: mutcdTitle(45),
    seed: {
      objects: [
        roadFwy(),
        sign('roadwork',   SR, 150),
        sign('centerlane', SR, 270),
        sign('onelane',    SR, 390),
        taper('taper-1', CX, TY, 65),
        zone('zone-1', CX, WY - 30, 80, 200),
        device('barrier-1', 'barrier',     CX, TY + 20),
        device('sig-1',     'temp_signal', CX, TY - 5),
      ],
    },
    assert: {
      signs: ['roadwork', 'centerlane', 'onelane'],
      devices: ['barrier', 'temp_signal'],
      objectTypes: ['road', 'taper', 'zone'],
    },
  },

  // ── TA-46: Work in the Vicinity of a Grade Crossing (Figure 6P-46) ────────
  // Work zone near a railroad grade crossing. W10-1 (GRADE CROSS) warns drivers.
  {
    id: 'TA-46',
    title: mutcdTitle(46),
    seed: {
      objects: [
        road2(),
        sign('roadwork',      SR, 190),
        sign('gradecrossing', SR, 340),
        zone('zone-1', WX, WY - 30, 100, 80),
      ],
    },
    assert: {
      signs: ['roadwork', 'gradecrossing'],
      objectTypes: ['road', 'zone'],
    },
  },

  // ── TA-47: Bicycle Lane Closure without a Detour (Figure 6P-47) ──────────
  // Bike lane closed; no alternate route provided. R9-10a sign only.
  {
    id: 'TA-47',
    title: mutcdTitle(47),
    seed: {
      objects: [
        road4(),
        sign('bikelaneclosed', SR, 280),
        zone('zone-1', CX + 100, WY - 30, 80, 120),
      ],
    },
    assert: {
      signs: ['bikelaneclosed'],
      objectTypes: ['road', 'zone'],
      noDevices: true,
    },
  },

  // ── TA-48: Bicycle Lane Closure with an On-Road Detour (Figure 6P-48) ─────
  // Bike lane closed; cyclists detoured onto roadway. R9-10a + M4-8.
  {
    id: 'TA-48',
    title: mutcdTitle(48),
    seed: {
      objects: [
        road4(),
        sign('bikelaneclosed', SR, 190),
        sign('detour',         SR, 340),
        zone('zone-1', CX + 100, WY - 30, 80, 120),
      ],
    },
    assert: {
      signs: ['bikelaneclosed', 'detour'],
      objectTypes: ['road', 'zone'],
    },
  },

  // ── TA-49: Shared-Use Path Closure with a Diversion (Figure 6P-49) ────────
  // Shared-use path closed; users diverted via alternate route. R9-7a + M4-11.
  {
    id: 'TA-49',
    title: mutcdTitle(49),
    seed: {
      objects: [
        road2(),
        sign('sharedusepath', SR, 190),
        sign('diversionrte',  SR, 340),
        zone('zone-1', CX + 80, WY - 30, 100, 80),
      ],
    },
    assert: {
      signs: ['sharedusepath', 'diversionrte'],
      objectTypes: ['road', 'zone'],
    },
  },

  // ── TA-50: On-Road Detour for a Shared-Use Path (Figure 6P-50) ───────────
  // Shared-use path closed; cyclists/pedestrians directed to share roadway.
  {
    id: 'TA-50',
    title: mutcdTitle(50),
    seed: {
      objects: [
        road2(),
        sign('sharedusepath', SR, 190),
        sign('detour',        SR, 340),
        zone('zone-1', CX + 80, WY - 30, 100, 80),
      ],
    },
    assert: {
      signs: ['sharedusepath', 'detour'],
      objectTypes: ['road', 'zone'],
    },
  },

  // ── TA-51: Paved Shoulder Closure with a Bicycle Diversion (Figure 6P-51) ─
  // Paved shoulder (used as bike facility) closed; cyclists diverted to temp path.
  {
    id: 'TA-51',
    title: mutcdTitle(51),
    seed: {
      objects: [
        road2(),
        sign('shoulderwork',   SR, 190),
        sign('bikelaneclosed', SR, 340),
        zone('zone-1', CX + 55, WY - 30, 100, 80),
      ],
    },
    assert: {
      signs: ['shoulderwork', 'bikelaneclosed'],
      objectTypes: ['road', 'zone'],
    },
  },

  // ── TA-52: Short-Term Work in a Circular Intersection (Figure 6P-52) ───────
  // Short-term or short-duration work in a roundabout; advance warning + detour.
  {
    id: 'TA-52',
    title: mutcdTitle(52),
    seed: {
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

  // ── TA-53: Flagging Operation on a Single-Lane Circular Intersection ────────
  // Flagger controls traffic through single-lane roundabout.
  // W2-6 (CIRCULAR INTERSECTION) advance + W20-7a (FLAGGER AHEAD).
  {
    id: 'TA-53',
    title: mutcdTitle(53),
    seed: {
      objects: [
        road4(),
        sign('roadwork',     SR, 150),
        sign('circularint',  SR, 270),
        sign('flaggerahead', SR, 390),
        zone('zone-1', CX, WY - 30, 80, 80),
        device('flagger-1', 'flagger', CX, TY),
      ],
    },
    assert: {
      signs: ['roadwork', 'circularint', 'flaggerahead'],
      devices: ['flagger'],
      objectTypes: ['road', 'zone'],
    },
  },

  // ── TA-54: Inside Lane Closure on a Multi-Lane Circular Intersection ────────
  // Inside lane of a multi-lane roundabout closed; W9-3 + taper + arrow board.
  {
    id: 'TA-54',
    title: mutcdTitle(54),
    seed: {
      objects: [
        road4(),
        sign('roadwork',    SR, 190),
        sign('centerlane',  SR, 340),
        taper('taper-1', CX, TY, 35),
        zone('zone-1',   CX, WY - 30, 80, 80),
        device('ab-1', 'arrow_board', CX, TY - 10),
      ],
    },
    assert: {
      signs: ['roadwork', 'centerlane'],
      devices: ['arrow_board'],
      objectTypes: ['road', 'taper', 'zone'],
    },
  },

  // ── TA-101(CA): Right Lane + Bike Lane Closure (California supplement) ─────
  // CA-specific: right lane and adjacent bike lane both closed.
  {
    id: 'TA-101',
    title: 'Right Lane + Bike Lane Closure (CA)',
    seed: {
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
      signs: ['roadwork', 'bikelaneclosed', 'rightlaneends'],
      objectTypes: ['road', 'taper', 'zone'],
    },
  },

]
