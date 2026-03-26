/**
 * Lightweight MUTCD-style rule checks (issue #114).
 *
 * All rules operate on the CanvasObject[] array and return QCIssue[].
 * No side effects — safe to call in useMemo.
 */

import type { CanvasObject } from './types'
import { calcTaperLength } from './utils'

export type QCSeverity = 'error' | 'warning' | 'info'

export interface QCIssue {
  id: string           // stable key for React lists
  severity: QCSeverity
  message: string
  objectId?: string    // canvas object this issue relates to (for future highlighting)
}

// ─── Type aliases ─────────────────────────────────────────────────────────────

type SignObj   = Extract<CanvasObject, { type: 'sign' }>
type DeviceObj = Extract<CanvasObject, { type: 'device' }>
type TaperObj  = Extract<CanvasObject, { type: 'taper' }>
type ZoneObj   = Extract<CanvasObject, { type: 'zone' }>

interface ObjectCollections {
  signs:   SignObj[]
  devices: DeviceObj[]
  tapers:  TaperObj[]
  zones:   ZoneObj[]
}

// ─── Sign ID sets ─────────────────────────────────────────────────────────────

const WARNING_SIGN_IDS = new Set([
  'roadwork','flagahead','merge','curve','narrow','bump','pedestrian','signal',
  'schoolzone','schoolxing','bikexing','deerxing','slippery','loosegravel',
  'dividedroad','endsdivided','lowclearance','rightcurve','leftcurve','winding',
  'hillgrade','workers','trafficcontrols','workahead','surveyors','preparestop',
  'flaggerahead','reducespeed',
])

const WORKZONE_SIGN_IDS = new Set([
  'roadwork','laneclosed','roadclosed','workzone','workahead','preparestop',
  'flaggerahead','reducespeed','slowtraffic','onelane','rightlane','leftlane',
  'centerlane','endwork','endworkahead',
])

const END_SIGN_IDS = new Set(['endwork', 'endworkahead'])

// Combined set for advance-warning check: warning signs + work-zone signs (excluding end signs)
const ADVANCE_WARNING_SIGN_IDS = new Set(
  [...WARNING_SIGN_IDS, ...WORKZONE_SIGN_IDS].filter(id => !END_SIGN_IDS.has(id))
)

// ─── Rule 1: Taper length too short ──────────────────────────────────────────
function checkTaperLength({ tapers }: ObjectCollections): QCIssue[] {
  return tapers.flatMap(t => {
    if (!t.manualLength) return []
    const required = calcTaperLength(t.speed, t.laneWidth, t.numLanes)
    if (t.taperLength < required) {
      return [{
        id: `taper-short-${t.id}`,
        severity: 'error' as QCSeverity,
        message: `Taper is ${t.taperLength}ft but MUTCD requires ${required}ft at ${t.speed}mph (${t.laneWidth}ft × ${t.numLanes} lane${t.numLanes > 1 ? 's' : ''}).`,
        objectId: t.id,
      }]
    }
    return []
  })
}

// ─── Rule 2: No advance warning signs when work zone present ─────────────────
function checkAdvanceWarning({ signs, tapers, zones }: ObjectCollections): QCIssue[] {
  const hasWorkZone = tapers.length > 0 || zones.length > 0
  if (!hasWorkZone) return []
  const hasWarnSign = signs.some(s => ADVANCE_WARNING_SIGN_IDS.has(s.signData.id))
  if (!hasWarnSign) {
    return [{
      id: 'no-advance-warning',
      severity: 'warning',
      message: 'Work zone has no advance warning signs. MUTCD requires warning signs before the activity area.',
    }]
  }
  return []
}

// ─── Rule 3: Flagger sign without flagger device ──────────────────────────────
function checkFlaggerDevice({ signs, devices }: ObjectCollections): QCIssue[] {
  const hasFlaggerSign = signs.some(s => s.signData.id === 'flaggerahead' || s.signData.id === 'flagahead')
  if (!hasFlaggerSign) return []
  const hasFlaggerDevice = devices.some(d => d.deviceData.id === 'flagman')
  if (!hasFlaggerDevice) {
    return [{
      id: 'flagger-sign-no-device',
      severity: 'warning',
      message: 'Flagger sign present but no Flagger device placed on the plan.',
    }]
  }
  return []
}

// ─── Rule 4: Taper with no arrow board ───────────────────────────────────────
function checkArrowBoard({ tapers, devices }: ObjectCollections): QCIssue[] {
  if (tapers.length === 0) return []
  const hasArrowBoard = devices.some(d => d.deviceData.id === 'arrow_board')
  if (!hasArrowBoard) {
    return [{
      id: 'taper-no-arrow-board',
      severity: 'info',
      message: 'Lane closure taper present but no Arrow Board device. MUTCD recommends an arrow board for lane closures.',
    }]
  }
  return []
}

// ─── Rule 5: Work zone with no perimeter devices ──────────────────────────────
function checkPerimeterDevices({ zones, devices }: ObjectCollections): QCIssue[] {
  if (zones.length === 0) return []
  const PERIMETER_IDS = new Set(['cone','barrel','barrier','delineator','water_barrel'])
  const hasPerimeter = devices.some(d => PERIMETER_IDS.has(d.deviceData.id))
  if (!hasPerimeter) {
    return [{
      id: 'zone-no-perimeter',
      severity: 'warning',
      message: 'Work zone drawn but no perimeter devices (cones, barrels, barriers) placed.',
    }]
  }
  return []
}

// ─── Rule 6: Missing END ROAD WORK sign ──────────────────────────────────────
function checkEndSign({ signs }: ObjectCollections): QCIssue[] {
  const hasWorkSign = signs.some(s => WORKZONE_SIGN_IDS.has(s.signData.id))
  if (!hasWorkSign) return []
  const hasEndSign = signs.some(s => END_SIGN_IDS.has(s.signData.id))
  if (!hasEndSign) {
    return [{
      id: 'no-end-sign',
      severity: 'info',
      message: 'Work zone signs present but no END ROAD WORK sign at the terminus.',
    }]
  }
  return []
}

// ─── Rule 7: Empty plan ───────────────────────────────────────────────────────
function checkEmptyPlan(objects: CanvasObject[]): QCIssue[] {
  if (objects.length === 0) {
    return [{ id: 'empty-plan', severity: 'info', message: 'Plan is empty. Add roads, signs, and devices to get started.' }]
  }
  return []
}

// ─── Main entry point ─────────────────────────────────────────────────────────
export function runQCChecks(objects: CanvasObject[]): QCIssue[] {
  const collections: ObjectCollections = {
    signs:   objects.filter(o => o.type === 'sign')   as SignObj[],
    devices: objects.filter(o => o.type === 'device') as DeviceObj[],
    tapers:  objects.filter(o => o.type === 'taper')  as TaperObj[],
    zones:   objects.filter(o => o.type === 'zone')   as ZoneObj[],
  }
  return [
    ...checkEmptyPlan(objects),
    ...checkTaperLength(collections),
    ...checkAdvanceWarning(collections),
    ...checkFlaggerDevice(collections),
    ...checkArrowBoard(collections),
    ...checkPerimeterDevices(collections),
    ...checkEndSign(collections),
  ]
}
