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
  // PDF Figure 6P-3: G20-1 (roadworknextmi) → W21-5 (shoulderwork) → G20-2 (endwork).
  // W20-1 (roadwork) does NOT appear in this figure.
  {
    id: 'TA-3',
    title: mutcdTitle(3),
    seed: {
      objects: [
        road2(),
        sign('roadworknextmi', SR, 150),
        sign('shoulderwork',   SR, 300),
        sign('endwork',        SR, 470),
        zone('zone-1', CX + 55, WY - 30, 100, 80),
      ],
    },
    assert: {
      signs: ['roadworknextmi', 'shoulderwork', 'endwork'],
      objectTypes: ['road', 'zone'],
    },
  },

  // ── TA-4: Short Duration or Mobile Operation on a Shoulder (Figure 6P-4) ─
  // PDF Figure 6P-4: W21-5 (shoulderwork) → W20-1 (roadwork) → W7-3aP (nextmiles).
  // No G20-1 (roadworknextmi) in this figure.
  {
    id: 'TA-4',
    title: mutcdTitle(4),
    seed: {
      objects: [
        road2(),
        sign('shoulderwork', SR, 190),
        sign('roadwork',     SR, 310),
        sign('nextmiles',    SR, 430),
        zone('zone-1', CX + 40, WY - 30, 90, 80),
      ],
    },
    assert: {
      signs: ['shoulderwork', 'roadwork', 'nextmiles'],
      objectTypes: ['road', 'zone'],
    },
  },

  // ── TA-5: Shoulder Closure on a Freeway (MUTCD Figure 6P-5) ─────────────
  // Divided freeway — right roadway has right shoulder closed (no lane impact).
  // Sign sequence farthest→nearest (per Figure 6P-5):
  //   W20-1 (roadwork) → W16-2aP (xxft) → W21-5aR (rightshoulderClosed)
  //   → W7-3aP (nextmiles) → W21-5aR (rightshoulderClosed) [second group, closest]
  // Taper head has crash cushion (barrier). No arrow board shown.
  {
    id: 'TA-5',
    title: mutcdTitle(5),
    seed: {
      objects: [
        roadDivR(), roadDivL(),
        sign('roadwork',            SR, 530),  // W20-1 — farthest advance
        sign('xxft',                SR, 430),  // W16-2aP — distance plaque
        sign('rightshoulderClosed', SR, 340),  // W21-5aR — second sign group
        sign('nextmiles',           SR, 250),  // W7-3aP — next-XX-miles plaque
        sign('rightshoulderClosed', SR, 160),  // W21-5aR — first sign group (nearest)
        taper('taper-1', CX + 55, TY, 65),
        device('barrier-1', 'barrier', CX + 55, TY + 25),  // crash cushion
        zone('zone-1', CX + 75, WY - 30, 80, 120),
      ],
    },
    assert: {
      signs: ['roadwork', 'xxft', 'rightshoulderClosed', 'nextmiles'],
      devices: ['barrier'],
      objectTypes: ['road', 'taper', 'zone'],
      minTapers: 1,
    },
  },

  // ── TA-6: Shoulder Work with Minor Encroachment (MUTCD Figure 6P-6) ──────
  // PDF Figure 6P-6: W20-1 (roadwork) + G20-2 (endwork) on both approaches.
  // W21-5 (shoulderwork) and W4-2 (merge) do NOT appear in this figure.
  {
    id: 'TA-6',
    title: mutcdTitle(6),
    seed: {
      objects: [
        road2(),
        sign('roadwork', SR, 190),
        sign('endwork',  SR, 430),
        taper('taper-1', CX + 20, TY),
        zone('zone-1', CX + 50, WY - 30, 100, 80),
      ],
    },
    assert: {
      signs: ['roadwork', 'endwork'],
      objectTypes: ['road', 'taper', 'zone'],
    },
  },

  // ── TA-7: Road Closed with a Diversion (MUTCD Figure 6P-7) ──────────────
  // PDF Figure 6P-7: W20-1 (roadwork), G20-2 (endwork), W1-6R/L (reversecurve),
  // W24-1L (diversion arrow — not in catalog), W13-1P (distance plaque).
  // R11-2 (roadclosed) and M4-11 (diversionrte) do NOT appear in this figure.
  {
    id: 'TA-7',
    title: mutcdTitle(7),
    seed: {
      objects: [
        road2(),
        sign('roadwork',    SR, 150),
        sign('reversecurve',SR, 270),
        sign('endwork',     SR, 430),
        zone('zone-1', CX, WY - 30, 80, 150),
      ],
    },
    assert: {
      signs: ['roadwork', 'reversecurve', 'endwork'],
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
        // PDF Figure 6P-13: W20-1 (roadwork), W3-4 (prepstop), W20-7 (trafficcontrols/flagger)
        // R11-2 (roadclosed) and M4-8 (detour) do NOT appear in this figure.
        sign('roadwork',     SR, 150),
        sign('prepstop',     SR, 270),
        sign('flaggerahead', SR, 390),
        zone('zone-1', CX, WY - 30, 80, 200),
        device('flagger-1', 'flagger', CX, TY),
        device('flagger-2', 'flagger', CX, WY + 100),
      ],
    },
    assert: {
      signs: ['roadwork', 'prepstop', 'flaggerahead'],
      devices: ['flagger'],
      objectTypes: ['road', 'zone'],
      minDevices: { flagger: 2 },
    },
  },

  // ── TA-14: Haul Road Crossing (MUTCD Figure 6P-14) ───────────────────────
  // PDF Figure 6P-14: W20-1 (roadwork), W20-7 (trafficcontrols), W3-3 (signal),
  // R10-6, W14-3 (not in catalog). W21-7 (trucksentering) does NOT appear.
  {
    id: 'TA-14',
    title: mutcdTitle(14),
    seed: {
      objects: [
        road2(),
        sign('roadwork',       SR, 190),
        sign('trafficcontrols',SR, 340),
        zone('zone-1', WX, WY - 30, 100, 80),
        device('flagger-1', 'flagger', CX, TY),
      ],
    },
    assert: {
      signs: ['roadwork', 'trafficcontrols'],
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
  // PDF Figure 6P-16: W21-6 (surveycrew), W20-7 (trafficcontrols/flagger).
  // W21-5 (surveyors/shoulderwork) does NOT appear — figure uses W21-6 specifically.
  {
    id: 'TA-16',
    title: mutcdTitle(16),
    seed: {
      objects: [
        road2(),
        sign('surveycrew',     SR, 190),
        sign('trafficcontrols',SR, 340),
        sign('surveycrew',     SL, 190),
        sign('trafficcontrols',SL, 340),
        zone('zone-1', CX, WY - 30, 80, 120),
      ],
    },
    assert: {
      signs: ['surveycrew', 'trafficcontrols'],
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
  // PDF Figure 6P-18: W21-1 (workers symbol) only.
  // W20-1 (roadwork) and W9-1 (rightlaneends) do NOT appear in this figure.
  {
    id: 'TA-18',
    title: mutcdTitle(18),
    seed: {
      objects: [
        road4(),
        sign('workers', SR, 280),
        sign('workers', SL, 280),
        taper('taper-1', CX + 40, TY, 35),
        zone('zone-1',   CX + 40, WY - 30, 80, 150),
        device('ab-1', 'arrow_board', CX + 40, TY - 10),
      ],
    },
    assert: {
      signs: ['workers'],
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
  // PDF Figure 6P-21: W20-1 (roadwork), W12-1 (laneends), W9-3L (leftlaneclosed).
  // W4-2 (merge) does NOT appear in this figure.
  {
    id: 'TA-21',
    title: mutcdTitle(21),
    seed: {
      objects: [
        road4(),
        sign('roadwork',      SR, 150),
        sign('laneends',      SR, 270),
        sign('leftlaneclosed',SR, 390),
        taper('taper-1', CX + 40, TY, 45),
        zone('zone-1',   CX + 40, WY - 30, 80, 150),
      ],
    },
    assert: {
      signs: ['roadwork', 'laneends', 'leftlaneclosed'],
      objectTypes: ['road', 'taper', 'zone'],
    },
  },

  // ── TA-22: Right-Hand Lane Closure on the Far Side of an Intersection ─────
  // PDF Figure 6P-22: W20-1 (roadwork), G20-2 (endwork), W20-5R (rightlaneclosed),
  // W4-2R (merge). W9-1 (rightlaneends) does NOT appear in this figure.
  {
    id: 'TA-22',
    title: mutcdTitle(22),
    seed: {
      objects: [
        road4(),
        sign('roadwork',        SR, 150),
        sign('rightlaneclosed', SR, 270),
        sign('merge',           SR, 390),
        sign('endwork',         SR, 520),
        taper('taper-1', CX + 40, TY, 45),
        zone('zone-1',   CX + 40, WY - 30, 80, 150),
        device('ab-1', 'arrow_board', CX + 40, TY - 10),
      ],
    },
    assert: {
      signs: ['roadwork', 'rightlaneclosed', 'merge', 'endwork'],
      devices: ['arrow_board'],
      objectTypes: ['road', 'taper', 'zone'],
    },
  },

  // ── TA-23: Left-Hand Lane Closure on the Far Side of an Intersection ──────
  // PDF Figure 6P-23: W20-1 (roadwork), G20-2 (endwork), W20-5L (leftlaneclosed),
  // W4-2L (merge). W9-2 (leftlaneends) does NOT appear in this figure.
  {
    id: 'TA-23',
    title: mutcdTitle(23),
    seed: {
      objects: [
        road4(),
        sign('roadwork',       SR, 150),
        sign('leftlaneclosed', SR, 270),
        sign('merge',          SR, 390),
        sign('endwork',        SR, 520),
        taper('taper-1', CX - 40, TY, 45),
        zone('zone-1',   CX - 40, WY - 30, 80, 150),
        device('ab-1', 'arrow_board', CX - 40, TY - 10),
      ],
    },
    assert: {
      signs: ['roadwork', 'leftlaneclosed', 'merge', 'endwork'],
      devices: ['arrow_board'],
      objectTypes: ['road', 'taper', 'zone'],
    },
  },

  // ── TA-24: Half Road Closure on the Far Side of an Intersection ───────────
  // PDF Figure 6P-24: W20-1 (roadwork), W20-5L (leftlaneclosed), W4-2L (merge),
  // G20-2 (endwork), W20-5R (rightlaneclosed), W4-2R (merge again), R3-2, R3-1.
  // W20-4a (onelane) and W3-4 (prepstop) do NOT appear in this figure.
  {
    id: 'TA-24',
    title: mutcdTitle(24),
    seed: {
      objects: [
        road4(),
        sign('roadwork',        SR, 150),
        sign('leftlaneclosed',  SR, 270),
        sign('merge',           SR, 390),
        sign('endwork',         SL, 150),
        sign('rightlaneclosed', SL, 270),
        zone('zone-1', CX, WY - 30, 80, 200),
        taper('taper-1', CX + 40, TY, 45),
        taper('taper-2', CX - 40, TY, 45),
        device('ab-1', 'arrow_board', CX + 40, TY - 10),
        device('ab-2', 'arrow_board', CX - 40, TY - 10),
      ],
    },
    assert: {
      signs: ['roadwork', 'leftlaneclosed', 'merge', 'endwork', 'rightlaneclosed'],
      devices: ['arrow_board'],
      objectTypes: ['road', 'taper', 'zone'],
      minTapers: 2,
      minDevices: { arrow_board: 2 },
    },
  },

  // ── TA-25: Multiple Lane Closures at an Intersection (Figure 6P-25) ───────
  // PDF Figure 6P-25: W20-1 (roadwork), G20-2 (endwork), W20-5L (leftlaneclosed),
  // W4-2L (merge), R4-7 (keepright). W9-1 (twolaneends) does NOT appear.
  {
    id: 'TA-25',
    title: mutcdTitle(25),
    seed: {
      objects: [
        road4(),
        sign('roadwork',       SR, 150),
        sign('leftlaneclosed', SR, 270),
        sign('merge',          SR, 390),
        sign('endwork',        SR, 520),
        taper('taper-1', CX + 50, TY - 40, 35, 12, 2),
        taper('taper-2', CX + 25, TY,      35, 12, 1),
        zone('zone-1',   CX + 25, WY - 30, 80, 150),
        device('ab-1', 'arrow_board', CX + 55, TY - 50),
        device('ab-2', 'arrow_board', CX + 30, TY - 10),
      ],
    },
    assert: {
      signs: ['roadwork', 'leftlaneclosed', 'merge', 'endwork'],
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
  // PDF Figure 6P-27: W20-1 (roadwork), G20-2 (endwork), W20-4 (onelane/slowtraffic),
  // W20-7 (trafficcontrols). W9-1 (rightlaneends) does NOT appear in this figure.
  {
    id: 'TA-27',
    title: mutcdTitle(27),
    seed: {
      objects: [
        road4(),
        sign('roadwork',       SR, 150),
        sign('onelane',        SR, 270),
        sign('trafficcontrols',SR, 390),
        sign('endwork',        SR, 520),
        taper('taper-1', CX + 40, TY, 35),
        zone('zone-1',   CX + 40, WY - 30, 80, 80),
        device('ab-1', 'arrow_board', CX + 40, TY - 10),
      ],
    },
    assert: {
      signs: ['roadwork', 'onelane', 'trafficcontrols', 'endwork'],
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
  // PDF Figure 6P-30: W20-1 (roadwork), W20-5L (leftlaneclosed), W4-2L (merge).
  // W9-3 (centerlane) does NOT appear in this figure.
  {
    id: 'TA-30',
    title: mutcdTitle(30),
    seed: {
      objects: [
        road4(),
        sign('roadwork',      SR, 150),
        sign('leftlaneclosed',SR, 270),
        sign('merge',         SR, 390),
        taper('taper-1', CX, TY, 45),
        zone('zone-1',   CX, WY - 30, 80, 150),
        device('ab-1', 'arrow_board', CX, TY - 10),
      ],
    },
    assert: {
      signs: ['roadwork', 'leftlaneclosed', 'merge'],
      devices: ['arrow_board'],
      objectTypes: ['road', 'taper', 'zone'],
    },
  },

  // ── TA-31: Lane Closure on a Street with Uneven Directional Volumes ────────
  // PDF Figure 6P-31: W20-1 (roadwork), W4-2L (merge), W1-4bR/L (not in catalog),
  // W13-1P (distance plaque). W20-7a (flaggerahead) and W20-4a (onelane) NOT in fig.
  {
    id: 'TA-31',
    title: mutcdTitle(31),
    seed: {
      objects: [
        road4(),
        sign('roadwork', SR, 190),
        sign('merge',    SR, 340),
        taper('taper-1', CX + 40, TY, 35),
        zone('zone-1',   CX + 40, WY - 30, 80, 150),
        device('ab-1', 'arrow_board', CX + 40, TY - 10),
      ],
    },
    assert: {
      signs: ['roadwork', 'merge'],
      devices: ['arrow_board'],
      objectTypes: ['road', 'taper', 'zone'],
    },
  },

  // ── TA-32: Half Road Closure on a Multi-Lane, High-Speed Highway ───────────
  // PDF Figure 6P-32: W20-1 (roadwork), W20-5L (leftlaneclosed), W20-5R (rightlaneclosed),
  // W4-2L/R (merge), G20-2 (endwork). W20-4a (onelane) and W3-4 (prepstop) NOT in fig.
  {
    id: 'TA-32',
    title: mutcdTitle(32),
    seed: {
      objects: [
        road4(),
        sign('roadwork',        SR, 150),
        sign('leftlaneclosed',  SR, 270),
        sign('rightlaneclosed', SR, 390),
        sign('merge',           SR, 510),
        sign('endwork',         SL, 150),
        taper('taper-1', CX + 40, TY, 55),
        taper('taper-2', CX - 40, TY, 55),
        zone('zone-1', CX + 40, WY - 30, 80, 150),
        device('ab-1', 'arrow_board', CX + 40, TY - 10),
        device('ab-2', 'arrow_board', CX - 40, TY - 10),
      ],
    },
    assert: {
      signs: ['roadwork', 'leftlaneclosed', 'rightlaneclosed', 'merge', 'endwork'],
      devices: ['arrow_board'],
      objectTypes: ['road', 'taper', 'zone'],
      minTapers: 2,
      minDevices: { arrow_board: 2 },
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
        // PDF Figure 6P-35: W20-5L (leftlaneclosed) only — mobile op, no advance signs.
        // W20-1 (roadwork) and W21-1 (workers) do NOT appear.
        sign('leftlaneclosed', SR, 280),
        device('ab-1', 'arrow_board', CX + 40, TY),
      ],
    },
    assert: {
      signs: ['leftlaneclosed'],
      devices: ['arrow_board'],
      objectTypes: ['road'],
    },
  },

  // ── TA-36: Lane Shift on a Freeway (MUTCD Figure 6P-36) ─────────────────
  // PDF Figure 6P-36: W20-1 (roadwork), G20-2 (endwork), W1-4cL/R (lane shift
  // turn signs — not in catalog), W13-1P (distance plaques). W4-2L (shiftleft) NOT in fig.
  {
    id: 'TA-36',
    title: mutcdTitle(36),
    seed: {
      objects: [
        roadFwy(),
        sign('roadwork', SR, 190),
        sign('endwork',  SR, 430),
        taper('taper-1', CX + 50, TY,       65),
        zone('zone-1',   CX - 25, WY - 30, 80, 150),
        taper('taper-2', CX - 25, WY + 80,  65),
        device('ab-1', 'arrow_board', CX + 50, TY - 10),
      ],
    },
    assert: {
      signs: ['roadwork', 'endwork'],
      devices: ['arrow_board'],
      objectTypes: ['road', 'taper', 'zone'],
      minTapers: 2,
    },
  },

  // ── TA-37: Double Lane Closure on a Freeway (MUTCD Figure 6P-37) ─────────
  // PDF Figure 6P-37: G20-2 (endwork), W20-5aR (rightlaneclosed), W4-2R (merge),
  // W20-1 (roadwork). Verified correct — signs all present.
  {
    id: 'TA-37',
    title: mutcdTitle(37),
    seed: {
      objects: [
        roadFwy(),
        sign('roadwork',        SR, 150),
        sign('rightlaneclosed', SR, 270),
        sign('merge',           SR, 390),
        sign('endwork',         SR, 530),
        taper('taper-1', CX + 50, TY - 40, 65, 12, 2),
        taper('taper-2', CX + 25, TY,      65, 12, 1),
        zone('zone-1',   CX + 25, WY - 30, 80, 150),
        device('ab-1', 'arrow_board', CX + 60, TY - 50),
        device('ab-2', 'arrow_board', CX + 30, TY - 10),
      ],
    },
    assert: {
      signs: ['roadwork', 'rightlaneclosed', 'merge', 'endwork'],
      devices: ['arrow_board'],
      objectTypes: ['road', 'taper', 'zone'],
      minTapers: 2,
      minDevices: { arrow_board: 2 },
    },
  },

  // ── TA-38: Interior Lane Closure on a Freeway (MUTCD Figure 6P-38) ────────
  // PDF Figure 6P-38: G20-2 optional (endwork), W12-1 (laneends), W9-3L (leftlaneclosed),
  // W4-2L (merge), W20-5L (leftlaneclosed again), W20-1 (roadwork).
  // W9-3 (centerlane) does NOT appear — W9-3L is the left-specific variant.
  {
    id: 'TA-38',
    title: mutcdTitle(38),
    seed: {
      objects: [
        roadFwy(),
        sign('roadwork',       SR, 150),
        sign('laneends',       SR, 270),
        sign('leftlaneclosed', SR, 390),
        sign('merge',          SR, 510),
        sign('endwork',        SR, 600),
        taper('taper-1', CX, TY, 65, 12, 1, 780),
        zone('zone-1',   CX, WY - 30, 80, 150),
        device('ab-1', 'arrow_board', CX, TY - 10),
      ],
    },
    assert: {
      signs: ['roadwork', 'laneends', 'leftlaneclosed', 'merge', 'endwork'],
      devices: ['arrow_board'],
      objectTypes: ['road', 'taper', 'zone'],
      taperFormula: { speed: 65, laneWidth: 12, expectedFt: 780 },
    },
  },

  // ── TA-39: Median Crossover on a Freeway (MUTCD Figure 6P-39) ────────────
  // PDF Figure 6P-39: G20-2 (endwork), W1-6R (reversecurve), W1-4R (reverseturn),
  // R5-1 (donotenter), R4-7 (keepright), W13-1P (plaque), W6-3 (twowaytraf), W20-1 (roadwork).
  // W20-4a (onelane) and W3-4 (prepstop) do NOT appear in this figure.
  {
    id: 'TA-39',
    title: mutcdTitle(39),
    seed: {
      objects: [
        roadFwy(),
        sign('roadwork',     SR, 150),
        sign('twowaytraf',   SR, 270),
        sign('donotenter',   SR, 390),
        sign('keepright',    SR, 510),
        sign('endwork',      SR, 600),
        taper('taper-1', CX + 25, TY, 65),
        zone('zone-1', CX, WY - 30, 150, 200),
        device('barrier-1', 'barrier', CX, TY + 20),
      ],
    },
    assert: {
      signs: ['roadwork', 'twowaytraf', 'donotenter', 'keepright', 'endwork'],
      devices: ['barrier'],
      objectTypes: ['road', 'taper', 'zone'],
    },
  },

  // ── TA-40: Median Crossover for an Entrance Ramp (Figure 6P-40) ──────────
  // PDF Figure 6P-40: W20-1 (roadwork), W3-2 (yieldahead), W4-1L (mergeleft),
  // R5-1 (donotenter), R1-2 (yield), R6-1L (oneway), W1-6L (reversecurve),
  // R11-2 (roadclosed), W6-3 (twowaytraf). Barrier optional.
  {
    id: 'TA-40',
    title: mutcdTitle(40),
    seed: {
      objects: [
        roadFwy(),
        sign('roadwork',     SR, 150),
        sign('yieldahead',   SR, 270),
        sign('mergeleft',    SR, 390),
        sign('twowaytraf',   SR, 510),
        sign('roadclosed',   SR, 600),
        sign('reversecurve', SR, 700),
        sign('oneway',       SR, 800),
        sign('yield',        SR, 900),
        sign('donotenter',   SR, 1000),
        zone('zone-1', CX + 130, WY - 30, 100, 80),
        device('barrier-1', 'barrier', CX, TY + 20),
      ],
    },
    assert: {
      signs: ['roadwork', 'yieldahead', 'mergeleft', 'twowaytraf', 'roadclosed', 'reversecurve', 'oneway', 'yield', 'donotenter'],
      devices: ['barrier'],
      objectTypes: ['road', 'zone'],
    },
  },

  // ── TA-41: Median Crossover for an Exit Ramp (Figure 6P-41) ─────────────
  // PDF Figure 6P-41: W6-3 (twowaytraf), E5-1 (exitramp).
  // R11-2 (exitclosed) and M4-8 (detour) do NOT appear in this figure.
  {
    id: 'TA-41',
    title: mutcdTitle(41),
    seed: {
      objects: [
        roadFwy(),
        sign('twowaytraf', SR, 190),
        sign('exitramp',   SR, 340),
        zone('zone-1', CX + 130, WY - 30, 100, 80),
      ],
    },
    assert: {
      signs: ['twowaytraf', 'exitramp'],
      objectTypes: ['road', 'zone'],
    },
  },

  // ── TA-42: Work in the Vicinity of an Exit Ramp (Figure 6P-42) ───────────
  // PDF Figure 6P-42: E5-1 (exitramp), E5-2 (exitramp2), W4-2R (merge),
  // W20-5R (rightlaneclosed), W20-1 (roadwork). W21-5a (shoulderwork) NOT in fig.
  {
    id: 'TA-42',
    title: mutcdTitle(42),
    seed: {
      objects: [
        roadFwy(),
        sign('roadwork',        SR, 150),
        sign('rightlaneclosed', SR, 270),
        sign('merge',           SR, 390),
        sign('exitramp',        SR, 510),
        sign('exitramp2',       SR, 600),
        taper('taper-1', CX + 50, TY, 65),
        zone('zone-1', CX + 130, WY - 30, 80, 80),
        device('ab-1', 'arrow_board', CX + 50, TY - 10),
      ],
    },
    assert: {
      signs: ['roadwork', 'rightlaneclosed', 'merge', 'exitramp', 'exitramp2'],
      devices: ['arrow_board'],
      objectTypes: ['road', 'taper', 'zone'],
    },
  },

  // ── TA-43: Partial Exit Ramp Closure (MUTCD Figure 6P-43) ────────────────
  // PDF Figure 6P-43: W20-1 (roadwork), G20-2 optional (endwork).
  // W5-4 (road narrows) and W13-1P/W13-4P (plaques) not in catalog.
  // exitclosed (R11-2) and detour (M4-8) do NOT appear in this figure.
  {
    id: 'TA-43',
    title: mutcdTitle(43),
    seed: {
      objects: [
        roadFwy(),
        sign('roadwork', SR, 230),
        sign('endwork',  SR, 430),
        taper('taper-1', CX + 120, TY, 65),
        zone('zone-1', CX + 130, WY - 30, 80, 80),
      ],
    },
    assert: {
      signs: ['roadwork', 'endwork'],
      objectTypes: ['road', 'taper', 'zone'],
    },
  },

  // ── TA-44: Work in the Vicinity of an Entrance Ramp (Figure 6P-44) ────────
  // PDF Figure 6P-44 (merge-required variant): W20-1 (roadwork), W20-5R (rightlaneclosed),
  // W4-2R (merge), G20-2 optional (endwork). shoulderwork (W21-5a) NOT in this figure.
  {
    id: 'TA-44',
    title: mutcdTitle(44),
    seed: {
      objects: [
        roadFwy(),
        sign('roadwork',        SR, 150),
        sign('rightlaneclosed', SR, 270),
        sign('merge',           SR, 390),
        sign('endwork',         SR, 530),
        taper('taper-1', CX + 50, TY, 65),
        zone('zone-1', CX + 130, WY - 30, 80, 80),
        device('ab-1', 'arrow_board', CX + 50, TY - 10),
      ],
    },
    assert: {
      signs: ['roadwork', 'rightlaneclosed', 'merge', 'endwork'],
      devices: ['arrow_board'],
      objectTypes: ['road', 'taper', 'zone'],
    },
  },

  // ── TA-45: Temporary Reversible Lane Using Movable Barriers ──────────────
  // PDF Figure 6P-45: W20-1 (roadwork), W20-5aL (leftlaneclosed), W4-2L (merge),
  // G20-2 optional (endwork). centerlane (W9-3) and onelane (W20-4a) NOT in this figure.
  {
    id: 'TA-45',
    title: mutcdTitle(45),
    seed: {
      objects: [
        roadFwy(),
        sign('roadwork',       SR, 150),
        sign('leftlaneclosed', SR, 270),
        sign('merge',          SR, 390),
        sign('endwork',        SR, 530),
        taper('taper-1', CX, TY, 65),
        zone('zone-1', CX, WY - 30, 80, 200),
        device('barrier-1', 'barrier',     CX, TY + 20),
        device('ab-1',      'arrow_board', CX, TY - 10),
        device('ab-2',      'arrow_board', CX - 25, TY - 10),
      ],
    },
    assert: {
      signs: ['roadwork', 'leftlaneclosed', 'merge', 'endwork'],
      devices: ['barrier', 'arrow_board'],
      objectTypes: ['road', 'taper', 'zone'],
      minDevices: { arrow_board: 2 },
    },
  },

  // ── TA-46: Work in the Vicinity of a Grade Crossing (Figure 6P-46) ────────
  // PDF Figure 6P-46: W20-1 (roadwork), W20-4 (onelane), W20-7 (trafficcontrols),
  // R8-8 (railroadxing), R15-1 (railcrossing), G20-2 optional (endwork).
  // W10-1 (gradecrossing) does NOT appear in this figure.
  {
    id: 'TA-46',
    title: mutcdTitle(46),
    seed: {
      objects: [
        road2(),
        sign('roadwork',      SR, 150),
        sign('onelane',       SR, 270),
        sign('trafficcontrols', SR, 390),
        sign('railroadxing',  SR, 510),
        sign('railcrossing',  SR, 600),
        sign('endwork',       SL, 150),
        zone('zone-1', WX, WY - 30, 100, 80),
        device('flagger-1', 'flagger', WX, TY),
      ],
    },
    assert: {
      signs: ['roadwork', 'onelane', 'trafficcontrols', 'railroadxing', 'railcrossing', 'endwork'],
      devices: ['flagger'],
      objectTypes: ['road', 'zone'],
    },
  },

  // ── TA-47: Bicycle Lane Closure without a Detour (Figure 6P-47) ──────────
  // PDF Figure 6P-47: W20-1 (roadwork), R9-12 (bicyclelaneclosed), W20-5b (bikelaneclosedahead),
  // R9-20 optional (yieldtobikes), G20-2 optional (endwork).
  // R9-10a (bikelaneclosed) does NOT appear — figure uses R9-12 (BICYCLE LANE CLOSED).
  {
    id: 'TA-47',
    title: mutcdTitle(47),
    seed: {
      objects: [
        road4(),
        sign('roadwork',           SR, 150),
        sign('bicyclelaneclosed',  SR, 270),
        sign('bikelaneclosedahead', SR, 390),
        sign('yieldtobikes',       SR, 510),
        sign('endwork',            SR, 600),
        taper('taper-1', CX + 40, TY, 35),
        zone('zone-1', CX + 100, WY - 30, 80, 120),
      ],
    },
    assert: {
      signs: ['roadwork', 'bicyclelaneclosed', 'bikelaneclosedahead', 'yieldtobikes', 'endwork'],
      objectTypes: ['road', 'taper', 'zone'],
    },
  },

  // ── TA-48: Bicycle Lane Closure with an On-Road Detour (Figure 6P-48) ─────
  // PDF Figure 6P-48: W20-1 (roadwork), R9-12 (bicyclelaneclosed), W20-5b (bikelaneclosedahead),
  // R9-20 optional (yieldtobikes). M4-8b/M4-9c are bike-detour signs not in catalog.
  {
    id: 'TA-48',
    title: mutcdTitle(48),
    seed: {
      objects: [
        road4(),
        sign('roadwork',            SR, 150),
        sign('bicyclelaneclosed',   SR, 270),
        sign('bikelaneclosedahead', SR, 390),
        sign('yieldtobikes',        SR, 510),
        taper('taper-1', CX + 40, TY, 35),
        zone('zone-1', CX + 100, WY - 30, 80, 120),
      ],
    },
    assert: {
      signs: ['roadwork', 'bicyclelaneclosed', 'bikelaneclosedahead', 'yieldtobikes'],
      objectTypes: ['road', 'taper', 'zone'],
    },
  },

  // ── TA-49: Shared-Use Path Closure with a Diversion (Figure 6P-49) ────────
  // PDF Figure 6P-49: W20-1b (pathworkahead), R11-2c (pathclosed).
  // W24-1L/R and M4-10L/R are path-diversion signs not in catalog.
  // sharedusepath (R9-7a) and diversionrte (M4-11) NOT in this figure.
  {
    id: 'TA-49',
    title: mutcdTitle(49),
    seed: {
      objects: [
        road2(),
        sign('pathworkahead', SR, 190),
        sign('pathclosed',    SR, 340),
        zone('zone-1', CX + 80, WY - 30, 100, 80),
      ],
    },
    assert: {
      signs: ['pathworkahead', 'pathclosed'],
      objectTypes: ['road', 'zone'],
    },
  },

  // ── TA-50: On-Road Detour for a Shared-Use Path (Figure 6P-50) ───────────
  // PDF Figure 6P-50: W20-1 (roadwork), W20-3a (roadworkpath), R11-2c (pathclosed),
  // R9-20 optional (yieldtobikes). M4-9c/M6-3P are bike-detour signs not in catalog.
  // sharedusepath (R9-7a) and detour (M4-8) NOT in this figure.
  {
    id: 'TA-50',
    title: mutcdTitle(50),
    seed: {
      objects: [
        road2(),
        sign('roadwork',     SR, 150),
        sign('roadworkpath', SR, 270),
        sign('pathclosed',   SR, 390),
        sign('yieldtobikes', SR, 510),
        zone('zone-1', CX + 80, WY - 30, 100, 80),
      ],
    },
    assert: {
      signs: ['roadwork', 'roadworkpath', 'pathclosed', 'yieldtobikes'],
      objectTypes: ['road', 'zone'],
    },
  },

  // ── TA-51: Paved Shoulder Closure with a Bicycle Diversion (Figure 6P-51) ─
  // PDF Figure 6P-51: W20-1 (roadwork), W21-5a (shoulderwork), W16-2aP optional (xxft),
  // G20-2 optional (endwork). M4-9cL/R are bike-diversion signs not in catalog.
  // bikelaneclosed (R9-10a) does NOT appear in this figure.
  {
    id: 'TA-51',
    title: mutcdTitle(51),
    seed: {
      objects: [
        road2(),
        sign('roadwork',     SR, 150),
        sign('shoulderwork', SR, 270),
        sign('xxft',         SR, 390),
        sign('endwork',      SR, 510),
        taper('taper-1', CX + 55, TY, 35),
        zone('zone-1', CX + 55, WY - 30, 100, 80),
      ],
    },
    assert: {
      signs: ['roadwork', 'shoulderwork', 'xxft', 'endwork'],
      objectTypes: ['road', 'taper', 'zone'],
    },
  },

  // ── TA-52: Short-Term Work in a Circular Intersection (Figure 6P-52) ───────
  // PDF Figure 6P-52: W20-1 (roadwork), W20-4 (onelane), W20-7 (trafficcontrols)
  // on all approaches; flaggers at intersection. detour (M4-8) NOT in this figure.
  {
    id: 'TA-52',
    title: mutcdTitle(52),
    seed: {
      objects: [
        road4(),
        sign('roadwork',       SR, 150),
        sign('onelane',        SR, 270),
        sign('trafficcontrols', SR, 390),
        zone('zone-1', CX, WY - 30, 80, 80),
        device('flagger-1', 'flagger', CX, TY),
      ],
    },
    assert: {
      signs: ['roadwork', 'onelane', 'trafficcontrols'],
      devices: ['flagger'],
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
  // PDF Figure 6P-54: W20-1 (roadwork), W20-5R (rightlaneclosed), W4-2R (merge),
  // G20-2 optional (endwork). centerlane (W9-3) does NOT appear in this figure.
  {
    id: 'TA-54',
    title: mutcdTitle(54),
    seed: {
      objects: [
        road4(),
        sign('roadwork',        SR, 150),
        sign('rightlaneclosed', SR, 270),
        sign('merge',           SR, 390),
        sign('endwork',         SR, 530),
        taper('taper-1', CX, TY, 35, 12, 1),
        zone('zone-1',   CX, WY - 30, 80, 80),
        device('ab-1', 'arrow_board', CX, TY - 10),
      ],
    },
    assert: {
      signs: ['roadwork', 'rightlaneclosed', 'merge', 'endwork'],
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
