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
  const setSelected = vi.fn()
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
    selected: null,
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
    setSelected: setSelected as unknown as React.Dispatch<React.SetStateAction<string | null>>,
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
      setSelected,
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
    expect(mocks.setSelected).not.toHaveBeenCalled()
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
    expect(mocks.setSelected).not.toHaveBeenCalled()
  })
})
