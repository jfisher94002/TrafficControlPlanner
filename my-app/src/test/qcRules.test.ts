import { describe, it, expect } from 'vitest'
import { runQCChecks } from '../qcRules'
import type { CanvasObject } from '../types'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const road: CanvasObject = { id: 'r1', type: 'road', x1: 0, y1: 0, x2: 500, y2: 0, width: 80, realWidth: 22, lanes: 2, roadType: '2lane' }
const cone: CanvasObject = { id: 'c1', type: 'device', x: 100, y: 0, deviceData: { id: 'cone', label: 'Cone', icon: '▲', color: '#f97316' }, rotation: 0 }
const arrowBoard: CanvasObject = { id: 'ab1', type: 'device', x: 50, y: 0, deviceData: { id: 'arrow_board', label: 'Arrow Board', icon: '⟹', color: '#fbbf24' }, rotation: 0 }
const flagman: CanvasObject = { id: 'fm1', type: 'device', x: 200, y: 0, deviceData: { id: 'flagman', label: 'Flagger', icon: '🏴', color: '#22c55e' }, rotation: 0 }

const roadworkSign: CanvasObject = { id: 's1', type: 'sign', x: 0, y: -50, signData: { id: 'roadwork', label: 'ROAD WORK', shape: 'diamond', color: '#f97316', textColor: '#111' }, rotation: 0, scale: 1 }
const flaggerSign: CanvasObject  = { id: 's2', type: 'sign', x: 10, y: -50, signData: { id: 'flaggerahead', label: 'FLAGGER AHD', shape: 'diamond', color: '#f97316', textColor: '#111' }, rotation: 0, scale: 1 }
const endworkSign: CanvasObject  = { id: 's3', type: 'sign', x: 400, y: -50, signData: { id: 'endwork', label: 'END ROAD WORK', shape: 'rect', color: '#f97316', textColor: '#111' }, rotation: 0, scale: 1 }
const laneClosedSign: CanvasObject = { id: 's4', type: 'sign', x: 20, y: -50, signData: { id: 'laneclosed', label: 'LANE CLOSED', shape: 'rect', color: '#f97316', textColor: '#111' }, rotation: 0, scale: 1 }

const zone: CanvasObject = { id: 'z1', type: 'zone', x: 100, y: -20, w: 200, h: 40 }

const taper = (taperLength: number, manualLength = true, numLanes = 1): CanvasObject => ({
  id: 't1', type: 'taper', x: 80, y: 0, rotation: 0,
  laneWidth: 12, speed: 25, taperLength, manualLength, numLanes,
})

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('runQCChecks', () => {
  it('reports empty plan info when no objects', () => {
    const issues = runQCChecks([])
    expect(issues).toHaveLength(1)
    expect(issues[0].id).toBe('empty-plan')
  })

  it('no issues for a complete valid lane closure plan', () => {
    // road + auto-length taper + arrow board + cone + roadwork sign + end sign
    const objects: CanvasObject[] = [road, taper(125, false), arrowBoard, cone, roadworkSign, endworkSign]
    const issues = runQCChecks(objects)
    expect(issues).toHaveLength(0)
  })

  it('reports error when manual taper is shorter than MUTCD minimum', () => {
    // 25mph, 12ft lane, 1 lane → required = 12*25²/60 = 125ft
    const objects: CanvasObject[] = [road, taper(100, true), arrowBoard, cone, roadworkSign, endworkSign]
    const issues = runQCChecks(objects)
    expect(issues.some(i => i.id.startsWith('taper-short') && i.severity === 'error')).toBe(true)
  })

  it('does not flag auto-calculated taper length', () => {
    const objects: CanvasObject[] = [road, taper(50, false), arrowBoard, cone, roadworkSign, endworkSign]
    const issues = runQCChecks(objects)
    expect(issues.some(i => i.id.startsWith('taper-short'))).toBe(false)
  })

  it('accepts manual taper length equal to the calculated minimum (boundary)', () => {
    // 25mph, 12ft lane, 1 lane → required = 125ft; length === required should be valid (uses <, not <=)
    const objects: CanvasObject[] = [road, taper(125, true), arrowBoard, cone, roadworkSign, endworkSign]
    const issues = runQCChecks(objects)
    expect(issues).toHaveLength(0)
  })

  it('requires longer taper for multi-lane closure', () => {
    // 1-lane closure: 125ft manual is acceptable
    const single = runQCChecks([road, taper(125, true, 1), arrowBoard, cone, roadworkSign, endworkSign])
    expect(single.some(i => i.id.startsWith('taper-short'))).toBe(false)

    // 2-lane closure: same 125ft manual should now be too short (required = 2 × 125 = 250ft)
    const dual = runQCChecks([road, taper(125, true, 2), arrowBoard, cone, roadworkSign, endworkSign])
    expect(dual.some(i => i.id.startsWith('taper-short') && i.severity === 'error')).toBe(true)
  })

  it('warns when work zone has no advance warning signs', () => {
    const objects: CanvasObject[] = [road, zone, cone]
    const issues = runQCChecks(objects)
    expect(issues.some(i => i.id === 'no-advance-warning' && i.severity === 'warning')).toBe(true)
  })

  it('no advance warning issue when warning sign is present', () => {
    const objects: CanvasObject[] = [road, zone, cone, roadworkSign]
    const issues = runQCChecks(objects)
    expect(issues.some(i => i.id === 'no-advance-warning')).toBe(false)
  })

  it('no advance warning issue when work-zone sign (e.g. laneclosed) is present', () => {
    const objects: CanvasObject[] = [road, zone, cone, laneClosedSign]
    const issues = runQCChecks(objects)
    expect(issues.some(i => i.id === 'no-advance-warning')).toBe(false)
  })

  it('warns when flagger sign present but no flagger device', () => {
    const objects: CanvasObject[] = [road, flaggerSign]
    const issues = runQCChecks(objects)
    expect(issues.some(i => i.id === 'flagger-sign-no-device' && i.severity === 'warning')).toBe(true)
  })

  it('no flagger warning when flagman device is present', () => {
    const objects: CanvasObject[] = [road, flaggerSign, flagman]
    const issues = runQCChecks(objects)
    expect(issues.some(i => i.id === 'flagger-sign-no-device')).toBe(false)
  })

  it('info when taper has no arrow board', () => {
    const objects: CanvasObject[] = [road, taper(125, false), cone, roadworkSign, endworkSign]
    const issues = runQCChecks(objects)
    expect(issues.some(i => i.id === 'taper-no-arrow-board' && i.severity === 'info')).toBe(true)
  })

  it('warns when zone has no perimeter devices', () => {
    const objects: CanvasObject[] = [road, zone, roadworkSign]
    const issues = runQCChecks(objects)
    expect(issues.some(i => i.id === 'zone-no-perimeter' && i.severity === 'warning')).toBe(true)
  })

  it('does not warn when zone has perimeter devices', () => {
    const objects: CanvasObject[] = [road, zone, cone, roadworkSign]
    const issues = runQCChecks(objects)
    expect(issues.some(i => i.id === 'zone-no-perimeter')).toBe(false)
  })

  it('info when work zone signs but no END ROAD WORK sign', () => {
    const objects: CanvasObject[] = [road, zone, cone, roadworkSign]
    const issues = runQCChecks(objects)
    expect(issues.some(i => i.id === 'no-end-sign' && i.severity === 'info')).toBe(true)
  })

  it('no end-sign issue when endwork sign is present', () => {
    const objects: CanvasObject[] = [road, zone, cone, roadworkSign, endworkSign]
    const issues = runQCChecks(objects)
    expect(issues.some(i => i.id === 'no-end-sign')).toBe(false)
  })
})
