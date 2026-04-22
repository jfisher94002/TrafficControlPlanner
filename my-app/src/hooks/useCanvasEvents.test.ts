import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type React from 'react'
import type Konva from 'konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import { useCanvasEvents } from './useCanvasEvents'
import { track } from '../analytics'
import type {
  CanvasObject,
  DeviceData,
  DrawStart,
  MapCenter,
  PanStart,
  Point,
  RoadType,
  SignData,
} from '../types'

vi.mock('../analytics', () => ({
  track: vi.fn(),
}))

type CanvasEventsProps = Parameters<typeof useCanvasEvents>[0]

const ROAD_TYPE: RoadType = {
  id: 'local',
  label: 'Local',
  lanes: 2,
  width: 28,
  realWidth: 24,
}

const SIGN: SignData = {
  id: 'r1-1',
  label: 'STOP',
  shape: 'octagon',
  color: '#ff0000',
  textColor: '#ffffff',
}

const DEVICE: DeviceData = {
  id: 'cone',
  label: 'Traffic Cone',
  icon: '🟧',
  color: '#ff8a00',
}

function makeRef<T>(value: T): React.RefObject<T> {
  return { current: value } as React.RefObject<T>
}

function makeProps(overrides: Partial<CanvasEventsProps> = {}) {
  const setObjects = vi.fn()
  const setSelectedIds = vi.fn()
  const setMarquee = vi.fn()
  const setZoom = vi.fn()
  const setOffset = vi.fn()
  const setMapCenter = vi.fn()
  const setIsPanning = vi.fn()
  const setPanStart = vi.fn()
  const setDrawStart = vi.fn()
  const setPolyPoints = vi.fn()
  const setCurvePoints = vi.fn()
  const setCubicPoints = vi.fn()
  const setSnapIndicator = vi.fn()
  const setCursorPos = vi.fn()
  const pushHistory = vi.fn()

  const props: CanvasEventsProps = {
    tool: 'select',
    roadDrawMode: 'straight',
    intersectionType: '4way',
    snapEnabled: false,
    objects: [],
    selectedIds: [],
    zoom: 1,
    offset: { x: 0, y: 0 },
    mapCenter: null,
    selectedSign: SIGN,
    selectedDevice: DEVICE,
    selectedRoadType: ROAD_TYPE,
    polyPoints: [],
    curvePoints: [],
    cubicPoints: [],
    drawStart: null,
    isPanning: false,
    panStart: null,
    stageRef: makeRef({
      getPointerPosition: () => ({ x: 24, y: 36 }),
    } as unknown as Konva.Stage | null),
    lastClickTimeRef: makeRef(0),
    lastClickPosRef: makeRef<Point | null>(null),
    setObjects: setObjects as unknown as React.Dispatch<React.SetStateAction<CanvasObject[]>>,
    setSelectedIds: setSelectedIds as unknown as React.Dispatch<React.SetStateAction<string[]>>,
    setMarquee: setMarquee as unknown as React.Dispatch<React.SetStateAction<{ x: number; y: number; w: number; h: number } | null>>,
    setZoom: setZoom as unknown as React.Dispatch<React.SetStateAction<number>>,
    setOffset: setOffset as unknown as React.Dispatch<React.SetStateAction<Point>>,
    setMapCenter: setMapCenter as unknown as React.Dispatch<React.SetStateAction<MapCenter | null>>,
    setIsPanning: setIsPanning as unknown as React.Dispatch<React.SetStateAction<boolean>>,
    setPanStart: setPanStart as unknown as React.Dispatch<React.SetStateAction<PanStart | null>>,
    setDrawStart: setDrawStart as unknown as React.Dispatch<React.SetStateAction<DrawStart | null>>,
    setPolyPoints: setPolyPoints as unknown as React.Dispatch<React.SetStateAction<Point[]>>,
    setCurvePoints: setCurvePoints as unknown as React.Dispatch<React.SetStateAction<Point[]>>,
    setCubicPoints: setCubicPoints as unknown as React.Dispatch<React.SetStateAction<Point[]>>,
    setSnapIndicator: setSnapIndicator as unknown as React.Dispatch<React.SetStateAction<Point | null>>,
    setCursorPos: setCursorPos as unknown as React.Dispatch<React.SetStateAction<Point>>,
    pushHistory,
    ...overrides,
  }

  return {
    props,
    mocks: {
      setObjects,
      setSelectedIds,
      setMarquee,
      setDrawStart,
      setSnapIndicator,
      setCursorPos,
      pushHistory,
    },
  }
}

describe('useCanvasEvents null tool selections', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does not place a sign when sign tool is active but selectedSign is null', () => {
    const { props, mocks } = makeProps({
      tool: 'sign',
      selectedSign: null,
      objects: [{ id: 'existing', type: 'zone', x: 0, y: 0, w: 10, h: 10 }],
    })

    const { result } = renderHook(() => useCanvasEvents(props))

    act(() => {
      result.current.handleMouseDown({ evt: { button: 0 } } as KonvaEventObject<MouseEvent>)
    })

    expect(mocks.setCursorPos).toHaveBeenCalledWith({ x: 24, y: 36 })
    expect(mocks.setSnapIndicator).toHaveBeenCalledWith(null)
    expect(mocks.setObjects).not.toHaveBeenCalled()
    expect(mocks.pushHistory).not.toHaveBeenCalled()
    expect(mocks.setSelectedIds).not.toHaveBeenCalled()
    expect(track).not.toHaveBeenCalled()
  })

  it('does not place a device when device tool is active but selectedDevice is null', () => {
    const { props, mocks } = makeProps({
      tool: 'device',
      selectedDevice: null,
      objects: [{ id: 'existing', type: 'zone', x: 0, y: 0, w: 10, h: 10 }],
    })

    const { result } = renderHook(() => useCanvasEvents(props))

    act(() => {
      result.current.handleMouseDown({ evt: { button: 0 } } as KonvaEventObject<MouseEvent>)
    })

    expect(mocks.setCursorPos).toHaveBeenCalledWith({ x: 24, y: 36 })
    expect(mocks.setSnapIndicator).toHaveBeenCalledWith(null)
    expect(mocks.setObjects).not.toHaveBeenCalled()
    expect(mocks.pushHistory).not.toHaveBeenCalled()
    expect(mocks.setSelectedIds).not.toHaveBeenCalled()
    expect(track).not.toHaveBeenCalled()
  })

  it('creates a straight road on mouse up when drag distance is sufficient', () => {
    const { props, mocks } = makeProps({
      tool: 'road',
      roadDrawMode: 'straight',
      drawStart: { x: 10, y: 12 },
      objects: [],
      stageRef: makeRef({
        getPointerPosition: () => ({ x: 24, y: 36 }),
      } as unknown as Konva.Stage | null),
    })

    const { result } = renderHook(() => useCanvasEvents(props))

    act(() => {
      result.current.handleMouseUp({ evt: {} } as KonvaEventObject<MouseEvent>)
    })

    expect(mocks.pushHistory).toHaveBeenCalledTimes(1)
    const nextObjects = mocks.pushHistory.mock.calls[0][0] as CanvasObject[]
    expect(nextObjects).toHaveLength(1)
    expect(nextObjects[0]).toMatchObject({
      type: 'road',
      x1: 10,
      y1: 12,
      x2: 24,
      y2: 36,
      width: ROAD_TYPE.width,
      realWidth: ROAD_TYPE.realWidth,
      lanes: ROAD_TYPE.lanes,
      roadType: ROAD_TYPE.id,
    })
    expect(nextObjects[0].id).toEqual(expect.any(String))
    expect(mocks.setObjects).not.toHaveBeenCalled()
    expect(mocks.setSelectedIds).toHaveBeenCalledWith([nextObjects[0].id])
    expect(mocks.setDrawStart).toHaveBeenCalledWith(null)
    expect(track).toHaveBeenCalledWith('road_drawn', {
      road_type: ROAD_TYPE.id,
      draw_mode: 'straight',
    })
  })

  it('skips straight road creation for tiny drags and clears drawStart', () => {
    const { props, mocks } = makeProps({
      tool: 'road',
      roadDrawMode: 'straight',
      drawStart: { x: 10, y: 10 },
      objects: [],
      stageRef: makeRef({
        getPointerPosition: () => ({ x: 12, y: 13 }),
      } as unknown as Konva.Stage | null),
    })

    const { result } = renderHook(() => useCanvasEvents(props))

    act(() => {
      result.current.handleMouseUp({ evt: {} } as KonvaEventObject<MouseEvent>)
    })

    expect(mocks.setObjects).not.toHaveBeenCalled()
    expect(mocks.pushHistory).not.toHaveBeenCalled()
    expect(mocks.setSelectedIds).not.toHaveBeenCalled()
    expect(mocks.setDrawStart).toHaveBeenCalledWith(null)
    expect(track).not.toHaveBeenCalled()
  })
})

describe('useCanvasEvents multi-select', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('clicking empty canvas clears selectedIds and starts a marquee drawStart', () => {
    const { props, mocks } = makeProps({
      tool: 'select',
      objects: [],
      selectedIds: ['existing-id'],
    })

    const { result } = renderHook(() => useCanvasEvents(props))

    act(() => {
      result.current.handleMouseDown({ evt: { button: 0, shiftKey: false } } as KonvaEventObject<MouseEvent>)
    })

    expect(mocks.setSelectedIds).toHaveBeenCalledWith([])
    expect(mocks.setMarquee).toHaveBeenCalledWith(null)
    expect(mocks.setDrawStart).toHaveBeenCalledWith(
      expect.objectContaining({ isMarquee: true })
    )
  })

  it('shift-click adds a hit object to the selection without clearing others', () => {
    const sign: CanvasObject = { id: 'sign-1', type: 'sign', x: 24, y: 36, rotation: 0, scale: 1, signData: { id: 'r1-1', label: 'STOP', shape: 'octagon', color: '#f00', textColor: '#fff' } }
    const { props, mocks } = makeProps({
      tool: 'select',
      objects: [sign],
      selectedIds: ['other-id'],
      stageRef: makeRef({
        getPointerPosition: () => ({ x: 24, y: 36 }),
      } as unknown as Konva.Stage | null),
    })

    const { result } = renderHook(() => useCanvasEvents(props))

    act(() => {
      result.current.handleMouseDown({ evt: { button: 0, shiftKey: true } } as KonvaEventObject<MouseEvent>)
    })

    // Should have called setSelectedIds with a function (updater) that adds sign-1
    expect(mocks.setSelectedIds).toHaveBeenCalledTimes(1)
    const updater = mocks.setSelectedIds.mock.calls[0][0]
    const result2 = typeof updater === 'function' ? updater(['other-id']) : updater
    expect(result2).toContain('sign-1')
    expect(result2).toContain('other-id')
  })

  it('shift-click removes an already-selected object from the selection', () => {
    const sign: CanvasObject = { id: 'sign-1', type: 'sign', x: 24, y: 36, rotation: 0, scale: 1, signData: { id: 'r1-1', label: 'STOP', shape: 'octagon', color: '#f00', textColor: '#fff' } }
    const { props, mocks } = makeProps({
      tool: 'select',
      objects: [sign],
      selectedIds: ['sign-1', 'other-id'],
      stageRef: makeRef({
        getPointerPosition: () => ({ x: 24, y: 36 }),
      } as unknown as Konva.Stage | null),
    })

    const { result } = renderHook(() => useCanvasEvents(props))

    act(() => {
      result.current.handleMouseDown({ evt: { button: 0, shiftKey: true } } as KonvaEventObject<MouseEvent>)
    })

    const updater = mocks.setSelectedIds.mock.calls[0][0]
    const result2 = typeof updater === 'function' ? updater(['sign-1', 'other-id']) : updater
    expect(result2).not.toContain('sign-1')
    expect(result2).toContain('other-id')
  })

  it('marquee mouseup selects objects whose center is inside the rect', () => {
    const inSign: CanvasObject = { id: 'in-sign', type: 'sign', x: 50, y: 50, rotation: 0, scale: 1, signData: { id: 'r1-1', label: 'STOP', shape: 'octagon', color: '#f00', textColor: '#fff' } }
    const outSign: CanvasObject = { id: 'out-sign', type: 'sign', x: 200, y: 200, rotation: 0, scale: 1, signData: { id: 'r1-1', label: 'STOP', shape: 'octagon', color: '#f00', textColor: '#fff' } }
    const { props, mocks } = makeProps({
      tool: 'select',
      objects: [inSign, outSign],
      drawStart: { x: 0, y: 0, isMarquee: true },
      stageRef: makeRef({
        // mouseup at world (100, 100) — marquee covers (0,0)→(100,100)
        getPointerPosition: () => ({ x: 100, y: 100 }),
      } as unknown as Konva.Stage | null),
    })

    const { result } = renderHook(() => useCanvasEvents(props))

    act(() => {
      result.current.handleMouseUp({ evt: {} } as KonvaEventObject<MouseEvent>)
    })

    expect(mocks.setSelectedIds).toHaveBeenCalledWith(['in-sign'])
    expect(mocks.setMarquee).toHaveBeenCalledWith(null)
    expect(mocks.setDrawStart).toHaveBeenCalledWith(null)
  })

  it('non-shift click on a new object replaces the selection', () => {
    const sign: CanvasObject = { id: 'new-sign', type: 'sign', x: 24, y: 36, rotation: 0, scale: 1, signData: { id: 'r1-1', label: 'STOP', shape: 'octagon', color: '#f00', textColor: '#fff' } }
    const { props, mocks } = makeProps({
      tool: 'select',
      objects: [sign],
      selectedIds: ['old-id'],
      stageRef: makeRef({
        getPointerPosition: () => ({ x: 24, y: 36 }),
      } as unknown as Konva.Stage | null),
    })

    const { result } = renderHook(() => useCanvasEvents(props))

    act(() => {
      result.current.handleMouseDown({ evt: { button: 0, shiftKey: false } } as KonvaEventObject<MouseEvent>)
    })

    expect(mocks.setSelectedIds).toHaveBeenCalledWith(['new-sign'])
  })

  it('group drag moves all selected objects together', () => {
    const sign1: CanvasObject = { id: 'sign-1', type: 'sign', x: 10, y: 20, rotation: 0, scale: 1, signData: { id: 'r1-1', label: 'STOP', shape: 'octagon', color: '#f00', textColor: '#fff' } }
    const sign2: CanvasObject = { id: 'sign-2', type: 'sign', x: 50, y: 60, rotation: 0, scale: 1, signData: { id: 'r1-1', label: 'STOP', shape: 'octagon', color: '#f00', textColor: '#fff' } }
    // drawStart is at pointer (24,36) with groupOrigPositionsById for both signs
    const { props, mocks } = makeProps({
      tool: 'select',
      objects: [sign1, sign2],
      selectedIds: ['sign-1', 'sign-2'],
      drawStart: {
        x: 0, y: 0, id: 'sign-1',
        groupOrigPositionsById: {
          'sign-1': { id: 'sign-1', ox: 10, oy: 20 },
          'sign-2': { id: 'sign-2', ox: 50, oy: 60 },
        },
      },
      // mousemove pointer is at canvas (24, 36) → world (24, 36) → dx=24, dy=36
      stageRef: makeRef({
        getPointerPosition: () => ({ x: 24, y: 36 }),
      } as unknown as Konva.Stage | null),
    })

    const { result } = renderHook(() => useCanvasEvents(props))

    act(() => {
      result.current.handleMouseMove({ evt: {} } as KonvaEventObject<MouseEvent>)
    })

    expect(mocks.setObjects).toHaveBeenCalledTimes(1)
    const updater = mocks.setObjects.mock.calls[0][0]
    const updated = updater([sign1, sign2]) as CanvasObject[]
    const s1 = updated.find((o) => o.id === 'sign-1') as typeof sign1
    const s2 = updated.find((o) => o.id === 'sign-2') as typeof sign2
    // Both signs should have moved by dx=24, dy=36
    expect(s1.x).toBe(10 + 24)
    expect(s1.y).toBe(20 + 36)
    expect(s2.x).toBe(50 + 24)
    expect(s2.y).toBe(60 + 36)
  })

  it('click without move does not push history', () => {
    const sign: CanvasObject = { id: 'sign-1', type: 'sign', x: 24, y: 36, rotation: 0, scale: 1, signData: { id: 'r1-1', label: 'STOP', shape: 'octagon', color: '#f00', textColor: '#fff' } }
    const { props, mocks } = makeProps({
      tool: 'select',
      objects: [sign],
      drawStart: { x: 24, y: 36, id: 'sign-1', ox: 24, oy: 36 },
      // mouseup pointer at same position — no movement
      stageRef: makeRef({
        getPointerPosition: () => ({ x: 24, y: 36 }),
      } as unknown as Konva.Stage | null),
    })

    const { result } = renderHook(() => useCanvasEvents(props))

    act(() => {
      result.current.handleMouseUp({ evt: {} } as KonvaEventObject<MouseEvent>)
    })

    expect(mocks.pushHistory).not.toHaveBeenCalled()
    expect(mocks.setDrawStart).toHaveBeenCalledWith(null)
  })
})
