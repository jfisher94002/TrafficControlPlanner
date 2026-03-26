import type { CanvasObject } from './types'

export interface TemplateDef {
  id: string
  name: string
  description: string
  objects: CanvasObject[]
}

// ─── Lane Closure ────────────────────────────────────────────────────────────
const LANE_CLOSURE: CanvasObject[] = [
  { id: 'tpl_lc_road', type: 'road', x1: 100, y1: 400, x2: 1100, y2: 400, width: 80, realWidth: 22, lanes: 2, roadType: '2lane' },
  { id: 'tpl_lc_zone', type: 'zone', x: 480, y: 362, w: 320, h: 78 },
  { id: 'tpl_lc_taper', type: 'taper', x: 350, y: 400, rotation: 0, laneWidth: 12, speed: 25, taperLength: 150, manualLength: true, numLanes: 1 },
  { id: 'tpl_lc_arrowboard', type: 'device', x: 300, y: 365, deviceData: { id: 'arrow_board', label: 'Arrow Board', icon: '⟹', color: '#fbbf24' }, rotation: 0 },
  { id: 'tpl_lc_cone1', type: 'device', x: 490, y: 365, deviceData: { id: 'cone', label: 'Traffic Cone', icon: '▲', color: '#f97316' }, rotation: 0 },
  { id: 'tpl_lc_cone2', type: 'device', x: 580, y: 365, deviceData: { id: 'cone', label: 'Traffic Cone', icon: '▲', color: '#f97316' }, rotation: 0 },
  { id: 'tpl_lc_cone3', type: 'device', x: 680, y: 365, deviceData: { id: 'cone', label: 'Traffic Cone', icon: '▲', color: '#f97316' }, rotation: 0 },
  { id: 'tpl_lc_cone4', type: 'device', x: 790, y: 365, deviceData: { id: 'cone', label: 'Traffic Cone', icon: '▲', color: '#f97316' }, rotation: 0 },
  { id: 'tpl_lc_cone5', type: 'device', x: 810, y: 400, deviceData: { id: 'cone', label: 'Traffic Cone', icon: '▲', color: '#f97316' }, rotation: 0 },
  { id: 'tpl_lc_sign_rw', type: 'sign', x: 180, y: 350, signData: { id: 'roadwork', label: 'ROAD WORK', shape: 'diamond', color: '#f97316', textColor: '#111' }, rotation: 0, scale: 1 },
  { id: 'tpl_lc_sign_lc', type: 'sign', x: 240, y: 350, signData: { id: 'laneclosed', label: 'LANE CLOSED', shape: 'rect', color: '#f97316', textColor: '#111' }, rotation: 0, scale: 1 },
  { id: 'tpl_lc_sign_ew', type: 'sign', x: 950, y: 350, signData: { id: 'endwork', label: 'END ROAD WORK', shape: 'rect', color: '#f97316', textColor: '#111' }, rotation: 0, scale: 1 },
  { id: 'tpl_lc_label', type: 'text', x: 580, y: 320, text: 'LANE CLOSURE — 1 LANE ROAD WORK', fontSize: 13, bold: true, color: '#f59e0b' },
]

// ─── Shoulder Work ────────────────────────────────────────────────────────────
const SHOULDER_WORK: CanvasObject[] = [
  { id: 'tpl_sw_road', type: 'road', x1: 100, y1: 400, x2: 1100, y2: 400, width: 80, realWidth: 22, lanes: 2, roadType: '2lane' },
  { id: 'tpl_sw_zone', type: 'zone', x: 350, y: 442, w: 500, h: 50 },
  { id: 'tpl_sw_cone1', type: 'device', x: 360, y: 445, deviceData: { id: 'cone', label: 'Traffic Cone', icon: '▲', color: '#f97316' }, rotation: 0 },
  { id: 'tpl_sw_cone2', type: 'device', x: 450, y: 445, deviceData: { id: 'cone', label: 'Traffic Cone', icon: '▲', color: '#f97316' }, rotation: 0 },
  { id: 'tpl_sw_cone3', type: 'device', x: 550, y: 445, deviceData: { id: 'cone', label: 'Traffic Cone', icon: '▲', color: '#f97316' }, rotation: 0 },
  { id: 'tpl_sw_cone4', type: 'device', x: 650, y: 445, deviceData: { id: 'cone', label: 'Traffic Cone', icon: '▲', color: '#f97316' }, rotation: 0 },
  { id: 'tpl_sw_cone5', type: 'device', x: 750, y: 445, deviceData: { id: 'cone', label: 'Traffic Cone', icon: '▲', color: '#f97316' }, rotation: 0 },
  { id: 'tpl_sw_cone6', type: 'device', x: 840, y: 445, deviceData: { id: 'cone', label: 'Traffic Cone', icon: '▲', color: '#f97316' }, rotation: 0 },
  { id: 'tpl_sw_sign_rw', type: 'sign', x: 210, y: 350, signData: { id: 'roadwork', label: 'ROAD WORK', shape: 'diamond', color: '#f97316', textColor: '#111' }, rotation: 0, scale: 1 },
  { id: 'tpl_sw_sign_spd', type: 'sign', x: 270, y: 350, signData: { id: 'speed25', label: '25 MPH', shape: 'rect', color: '#fff', textColor: '#111', border: '#111' }, rotation: 0, scale: 1 },
  { id: 'tpl_sw_label', type: 'text', x: 560, y: 510, text: 'SHOULDER WORK ZONE', fontSize: 12, bold: true, color: '#f59e0b' },
]

// ─── Flagger Operation ────────────────────────────────────────────────────────
const FLAGGER_OPERATION: CanvasObject[] = [
  { id: 'tpl_fl_road', type: 'road', x1: 80, y1: 400, x2: 1120, y2: 400, width: 80, realWidth: 22, lanes: 2, roadType: '2lane' },
  { id: 'tpl_fl_zone', type: 'zone', x: 400, y: 362, w: 400, h: 78 },
  { id: 'tpl_fl_flag_w', type: 'device', x: 390, y: 390, deviceData: { id: 'flagman', label: 'Flagger', icon: '🚦', color: '#22c55e' }, rotation: 0 },
  { id: 'tpl_fl_flag_e', type: 'device', x: 810, y: 390, deviceData: { id: 'flagman', label: 'Flagger', icon: '🚦', color: '#22c55e' }, rotation: 0 },
  { id: 'tpl_fl_cone1', type: 'device', x: 420, y: 365, deviceData: { id: 'cone', label: 'Traffic Cone', icon: '▲', color: '#f97316' }, rotation: 0 },
  { id: 'tpl_fl_cone2', type: 'device', x: 510, y: 365, deviceData: { id: 'cone', label: 'Traffic Cone', icon: '▲', color: '#f97316' }, rotation: 0 },
  { id: 'tpl_fl_cone3', type: 'device', x: 600, y: 365, deviceData: { id: 'cone', label: 'Traffic Cone', icon: '▲', color: '#f97316' }, rotation: 0 },
  { id: 'tpl_fl_cone4', type: 'device', x: 690, y: 365, deviceData: { id: 'cone', label: 'Traffic Cone', icon: '▲', color: '#f97316' }, rotation: 0 },
  { id: 'tpl_fl_cone5', type: 'device', x: 790, y: 365, deviceData: { id: 'cone', label: 'Traffic Cone', icon: '▲', color: '#f97316' }, rotation: 0 },
  { id: 'tpl_fl_sign_fa_w', type: 'sign', x: 180, y: 355, signData: { id: 'flaggerahead', label: 'FLAGGER AHD', shape: 'diamond', color: '#f97316', textColor: '#111' }, rotation: 0, scale: 1 },
  { id: 'tpl_fl_sign_ol_w', type: 'sign', x: 240, y: 355, signData: { id: 'onelane', label: 'ONE LANE RD', shape: 'rect', color: '#f97316', textColor: '#111' }, rotation: 0, scale: 1 },
  { id: 'tpl_fl_sign_fa_e', type: 'sign', x: 960, y: 355, signData: { id: 'flaggerahead', label: 'FLAGGER AHD', shape: 'diamond', color: '#f97316', textColor: '#111' }, rotation: 0, scale: 1 },
  { id: 'tpl_fl_sign_ol_e', type: 'sign', x: 1020, y: 355, signData: { id: 'onelane', label: 'ONE LANE RD', shape: 'rect', color: '#f97316', textColor: '#111' }, rotation: 0, scale: 1 },
  { id: 'tpl_fl_arr_w', type: 'arrow', x1: 290, y1: 390, x2: 370, y2: 390, color: '#22c55e' },
  { id: 'tpl_fl_arr_e', type: 'arrow', x1: 900, y1: 410, x2: 820, y2: 410, color: '#22c55e' },
  { id: 'tpl_fl_label', type: 'text', x: 555, y: 325, text: 'FLAGGER OPERATION — ALTERNATING ONE-WAY', fontSize: 13, bold: true, color: '#f59e0b' },
]

// ─── Detour ───────────────────────────────────────────────────────────────────
const DETOUR: CanvasObject[] = [
  { id: 'tpl_dt_main', type: 'road', x1: 100, y1: 400, x2: 680, y2: 400, width: 80, realWidth: 22, lanes: 2, roadType: '2lane' },
  { id: 'tpl_dt_stub', type: 'road', x1: 840, y1: 400, x2: 1100, y2: 400, width: 80, realWidth: 22, lanes: 2, roadType: '2lane' },
  { id: 'tpl_dt_bar1', type: 'device', x: 695, y: 395, deviceData: { id: 'barrier', label: 'Barrier', icon: '▬', color: '#fbbf24' }, rotation: 90 },
  { id: 'tpl_dt_bar2', type: 'device', x: 720, y: 405, deviceData: { id: 'barrier', label: 'Barrier', icon: '▬', color: '#fbbf24' }, rotation: 90 },
  { id: 'tpl_dt_bar3', type: 'device', x: 830, y: 400, deviceData: { id: 'barrier', label: 'Barrier', icon: '▬', color: '#fbbf24' }, rotation: 90 },
  {
    id: 'tpl_dt_bypass', type: 'polyline_road',
    points: [{ x: 680, y: 400 }, { x: 680, y: 230 }, { x: 760, y: 180 }, { x: 840, y: 180 }, { x: 920, y: 230 }, { x: 920, y: 400 }],
    width: 60, realWidth: 16, lanes: 2, roadType: '2lane', smooth: true,
  },
  { id: 'tpl_dt_sign_rc', type: 'sign', x: 590, y: 355, signData: { id: 'roadclosed', label: 'ROAD CLOSED', shape: 'rect', color: '#f97316', textColor: '#111' }, rotation: 0, scale: 1 },
  { id: 'tpl_dt_sign_d1', type: 'sign', x: 645, y: 280, signData: { id: 'detour', label: 'DETOUR', shape: 'rect', color: '#f97316', textColor: '#111' }, rotation: 0, scale: 1 },
  { id: 'tpl_dt_sign_d2', type: 'sign', x: 960, y: 280, signData: { id: 'detour', label: 'DETOUR', shape: 'rect', color: '#f97316', textColor: '#111' }, rotation: 0, scale: 1 },
  { id: 'tpl_dt_arr1', type: 'arrow', x1: 685, y1: 340, x2: 685, y2: 240, color: '#f97316' },
  { id: 'tpl_dt_arr2', type: 'arrow', x1: 700, y1: 185, x2: 860, y2: 185, color: '#f97316' },
  { id: 'tpl_dt_arr3', type: 'arrow', x1: 915, y1: 240, x2: 915, y2: 350, color: '#f97316' },
  { id: 'tpl_dt_label', type: 'text', x: 530, y: 490, text: 'ROAD CLOSED — DETOUR ROUTE', fontSize: 13, bold: true, color: '#f59e0b' },
]

// ─── Intersection Control ─────────────────────────────────────────────────────
const INTERSECTION_CONTROL: CanvasObject[] = [
  { id: 'tpl_ic_ew', type: 'road', x1: 100, y1: 400, x2: 1100, y2: 400, width: 80, realWidth: 22, lanes: 2, roadType: '2lane' },
  { id: 'tpl_ic_ns', type: 'road', x1: 600, y1: 80, x2: 600, y2: 720, width: 80, realWidth: 22, lanes: 2, roadType: '2lane' },
  { id: 'tpl_ic_zone', type: 'zone', x: 640, y: 220, w: 200, h: 140 },
  { id: 'tpl_ic_c1', type: 'device', x: 645, y: 225, deviceData: { id: 'cone', label: 'Traffic Cone', icon: '▲', color: '#f97316' }, rotation: 0 },
  { id: 'tpl_ic_c2', type: 'device', x: 730, y: 225, deviceData: { id: 'cone', label: 'Traffic Cone', icon: '▲', color: '#f97316' }, rotation: 0 },
  { id: 'tpl_ic_c3', type: 'device', x: 835, y: 225, deviceData: { id: 'cone', label: 'Traffic Cone', icon: '▲', color: '#f97316' }, rotation: 0 },
  { id: 'tpl_ic_c4', type: 'device', x: 835, y: 305, deviceData: { id: 'cone', label: 'Traffic Cone', icon: '▲', color: '#f97316' }, rotation: 0 },
  { id: 'tpl_ic_c5', type: 'device', x: 835, y: 355, deviceData: { id: 'cone', label: 'Traffic Cone', icon: '▲', color: '#f97316' }, rotation: 0 },
  { id: 'tpl_ic_stop_w', type: 'sign', x: 510, y: 380, signData: { id: 'stop', label: 'STOP', shape: 'octagon', color: '#ef4444', textColor: '#fff' }, rotation: 0, scale: 1 },
  { id: 'tpl_ic_stop_e', type: 'sign', x: 690, y: 420, signData: { id: 'stop', label: 'STOP', shape: 'octagon', color: '#ef4444', textColor: '#fff' }, rotation: 180, scale: 1 },
  { id: 'tpl_ic_stop_n', type: 'sign', x: 580, y: 450, signData: { id: 'stop', label: 'STOP', shape: 'octagon', color: '#ef4444', textColor: '#fff' }, rotation: 270, scale: 1 },
  { id: 'tpl_ic_stop_s', type: 'sign', x: 620, y: 360, signData: { id: 'stop', label: 'STOP', shape: 'octagon', color: '#ef4444', textColor: '#fff' }, rotation: 90, scale: 1 },
  { id: 'tpl_ic_flag', type: 'device', x: 600, y: 400, deviceData: { id: 'flagman', label: 'Flagger', icon: '🚦', color: '#22c55e' }, rotation: 0 },
  { id: 'tpl_ic_sign_rw_w', type: 'sign', x: 200, y: 355, signData: { id: 'roadwork', label: 'ROAD WORK', shape: 'diamond', color: '#f97316', textColor: '#111' }, rotation: 0, scale: 1 },
  { id: 'tpl_ic_sign_rw_n', type: 'sign', x: 555, y: 140, signData: { id: 'roadwork', label: 'ROAD WORK', shape: 'diamond', color: '#f97316', textColor: '#111' }, rotation: 0, scale: 1 },
  { id: 'tpl_ic_label', type: 'text', x: 490, y: 590, text: 'INTERSECTION CONTROL — ALL-WAY STOP', fontSize: 13, bold: true, color: '#f59e0b' },
]

export const TEMPLATES: TemplateDef[] = [
  { id: 'lane_closure',        name: 'Lane Closure',        description: '1-lane road work with taper, cones, and warning signs', objects: LANE_CLOSURE },
  { id: 'shoulder_work',       name: 'Shoulder Work',       description: 'Shoulder-only closure with cones and reduced speed signs', objects: SHOULDER_WORK },
  { id: 'flagger_operation',   name: 'Flagger Operation',   description: 'Alternating one-way traffic with flaggers at each end', objects: FLAGGER_OPERATION },
  { id: 'detour',              name: 'Detour',              description: 'Full road closure with detour bypass route', objects: DETOUR },
  { id: 'intersection_control',name: 'Intersection Control',description: 'All-way stop at intersection with work zone in one quadrant', objects: INTERSECTION_CONTROL },
]
