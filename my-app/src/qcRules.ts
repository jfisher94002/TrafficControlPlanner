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

// ─── Helpers ─────────────────────────────────────────────────────────────────

const signs   = (objects: CanvasObject[]) => objects.filter(o => o.type === 'sign')   as Extract<CanvasObject, { type: 'sign' }>[]
const devices = (objects: CanvasObject[]) => objects.filter(o => o.type === 'device') as Extract<CanvasObject, { type: 'device' }>[]
const tapers  = (objects: CanvasObject[]) => objects.filter(o => o.type === 'taper')  as Extract<CanvasObject, { type: 'taper' }>[]
const zones   = (objects: CanvasObject[]) => objects.filter(o => o.type === 'zone')   as Extract<CanvasObject, { type: 'zone' }>[]

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

// ─── Rule 1: Taper length too short ──────────────────────────────────────────
function checkTaperLength(objects: CanvasObject[]): QCIssue[] {
  return tapers(objects).flatMap(t => {
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
function checkAdvanceWarning(objects: CanvasObject[]): QCIssue[] {
  const hasWorkZone = tapers(objects).length > 0 || zones(objects).length > 0
  if (!hasWorkZone) return []
  const hasWarnSign = signs(objects).some(s => WARNING_SIGN_IDS.has(s.signData.id))
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
function checkFlaggerDevice(objects: CanvasObject[]): QCIssue[] {
  const hasFlaggerSign = signs(objects).some(s => s.signData.id === 'flaggerahead' || s.signData.id === 'flagahead')
  if (!hasFlaggerSign) return []
  const hasFlaggerDevice = devices(objects).some(d => d.deviceData.id === 'flagman')
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
function checkArrowBoard(objects: CanvasObject[]): QCIssue[] {
  if (tapers(objects).length === 0) return []
  const hasArrowBoard = devices(objects).some(d => d.deviceData.id === 'arrow_board')
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
function checkPerimeterDevices(objects: CanvasObject[]): QCIssue[] {
  if (zones(objects).length === 0) return []
  const PERIMETER_IDS = new Set(['cone','barrel','barrier','delineator','water_barrel'])
  const hasPerimeter = devices(objects).some(d => PERIMETER_IDS.has(d.deviceData.id))
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
function checkEndSign(objects: CanvasObject[]): QCIssue[] {
  const hasWorkSign = signs(objects).some(s => WORKZONE_SIGN_IDS.has(s.signData.id))
  if (!hasWorkSign) return []
  const hasEndSign = signs(objects).some(s => END_SIGN_IDS.has(s.signData.id))
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
  return [
    ...checkEmptyPlan(objects),
    ...checkTaperLength(objects),
    ...checkAdvanceWarning(objects),
    ...checkFlaggerDevice(objects),
    ...checkArrowBoard(objects),
    ...checkPerimeterDevices(objects),
    ...checkEndSign(objects),
  ]
}
