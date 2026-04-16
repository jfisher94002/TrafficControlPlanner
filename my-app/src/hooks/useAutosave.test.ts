import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useAutosave } from './useAutosave'
import { AUTOSAVE_KEY } from '../features/tcp/planUtils'
import type { CanvasObject, MapCenter, PlanMeta, Point } from '../types'

interface AutosaveProps {
  objects: CanvasObject[]
  planId: string
  planTitle: string
  planCreatedAt: string
  planMeta: PlanMeta
  zoom: number
  offset: Point
  mapCenter: MapCenter | null
  userId: string | null
}

function textObject(id: string, x = 0): CanvasObject {
  return { id, type: 'text', x, y: 0, text: id, fontSize: 14, bold: false, color: '#fff' }
}

function makeProps(overrides: Partial<AutosaveProps> = {}): AutosaveProps {
  return {
    objects: [textObject('obj-1')],
    planId: 'plan-1',
    planTitle: 'Plan One',
    planCreatedAt: '2026-01-01T00:00:00.000Z',
    planMeta: { projectNumber: 'TCP-1', client: 'City', location: 'Main St', notes: 'note' },
    zoom: 1.25,
    offset: { x: 10, y: 20 },
    mapCenter: { lat: 37.77, lon: -122.42, zoom: 14 },
    userId: 'user-123',
    ...overrides,
  }
}

describe('useAutosave', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('writes autosave payload with expected fields', async () => {
    const props = makeProps()
    renderHook(() => useAutosave(props))

    await waitFor(() => {
      const raw = localStorage.getItem(AUTOSAVE_KEY)
      expect(raw).not.toBeNull()
    })

    const payload = JSON.parse(localStorage.getItem(AUTOSAVE_KEY) ?? '{}')
    expect(payload).toMatchObject({
      id: props.planId,
      name: props.planTitle,
      createdAt: props.planCreatedAt,
      userId: props.userId,
      canvasOffset: props.offset,
      canvasZoom: props.zoom,
      canvasState: { objects: props.objects },
      metadata: props.planMeta,
      mapCenter: props.mapCenter,
    })
    expect(typeof payload.updatedAt).toBe('string')
  })

  it('surfaces autosaveError when localStorage write fails', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded')
    })

    const { result } = renderHook(() => useAutosave(makeProps()))

    await waitFor(() => {
      expect(result.current.autosaveError).toBe('quota exceeded')
    })
    expect(warnSpy).toHaveBeenCalledWith('[TCP] Auto-save failed:', 'quota exceeded')
  })

  it('clears a previous autosaveError after a successful rerender write', async () => {
    const setItemSpy = vi.spyOn(window.localStorage, 'setItem')
    setItemSpy.mockImplementationOnce(() => {
      throw new Error('quota exceeded')
    })

    const initialProps = makeProps()
    const { result, rerender } = renderHook((props: AutosaveProps) => useAutosave(props), { initialProps })

    await waitFor(() => {
      expect(result.current.autosaveError).toBe('quota exceeded')
    })

    rerender(makeProps({ planTitle: 'Plan One Updated' }))

    await waitFor(() => {
      expect(result.current.autosaveError).toBeNull()
    })
  })
})
