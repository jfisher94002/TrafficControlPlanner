import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useAutosave } from './useAutosave'
import { AUTOSAVE_KEY } from '../features/tcp/planUtils'
import type { CanvasObject, PlanMeta } from '../types'

function makeObjects(ids: string[]): CanvasObject[] {
  return ids.map((id, idx) => ({
    id,
    type: 'sign',
    x: idx * 10,
    y: 0,
    rotation: 0,
    scale: 1,
    signData: {
      id: `sign-${id}`,
      label: 'STOP',
      shape: 'octagon',
      color: '#ff0000',
      textColor: '#ffffff',
    },
  }))
}

function makeParams(objects: CanvasObject[]): Parameters<typeof useAutosave>[0] {
  const planMeta: PlanMeta = {
    projectNumber: 'TCP-123',
    client: 'City DOT',
    location: 'Main St',
    notes: 'Night work',
  }

  return {
    objects,
    planId: 'plan-1',
    planTitle: 'Plan A',
    planCreatedAt: '2026-01-01T00:00:00.000Z',
    planMeta,
    zoom: 1.25,
    offset: { x: 12, y: 34 },
    mapCenter: { lat: 37.77, lon: -122.41, zoom: 14 },
    userId: 'user-42',
  }
}

describe('useAutosave', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('writes plan state to localStorage with expected fields', async () => {
    renderHook(() => useAutosave(makeParams(makeObjects(['a', 'b']))))

    await waitFor(() => {
      const raw = localStorage.getItem(AUTOSAVE_KEY)
      expect(raw).not.toBeNull()
    })

    const saved = JSON.parse(localStorage.getItem(AUTOSAVE_KEY) ?? '{}')
    expect(saved).toMatchObject({
      id: 'plan-1',
      name: 'Plan A',
      createdAt: '2026-01-01T00:00:00.000Z',
      userId: 'user-42',
      canvasZoom: 1.25,
      canvasOffset: { x: 12, y: 34 },
      metadata: { projectNumber: 'TCP-123', client: 'City DOT' },
      mapCenter: { lat: 37.77, lon: -122.41, zoom: 14 },
    })
    expect(saved.canvasState.objects).toHaveLength(2)
    expect(typeof saved.updatedAt).toBe('string')
  })

  it('reports storage failures and clears the error after a later successful write', async () => {
    const setItemSpy = vi.spyOn(window.localStorage, 'setItem')
    setItemSpy.mockImplementationOnce(() => {
      throw new Error('quota exceeded')
    })
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const { result, rerender } = renderHook(
      ({ objects }) => useAutosave(makeParams(objects)),
      { initialProps: { objects: makeObjects(['a']) } },
    )

    await waitFor(() => {
      expect(warnSpy).toHaveBeenCalledWith('[TCP] Auto-save failed:', 'quota exceeded')
    })

    rerender({ objects: makeObjects(['a', 'b']) })

    await waitFor(() => {
      expect(result.current.autosaveError).toBeNull()
    })

    const saved = JSON.parse(localStorage.getItem(AUTOSAVE_KEY) ?? '{}')
    expect(saved.canvasState.objects).toHaveLength(2)
  })
})
