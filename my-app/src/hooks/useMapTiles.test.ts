import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useMapTiles } from './useMapTiles'
import type { MapCenter } from '../types'

class MockImage {
  onload: null | (() => void) = null
  onerror: null | (() => void) = null
  crossOrigin: string | null = null
  src = ''
}

function makeCenter(lon = 0): MapCenter {
  return { lat: 0, lon, zoom: 1 }
}

describe('useMapTiles', () => {
  const imageCtor = vi.fn(() => new MockImage() as unknown as HTMLImageElement)

  beforeEach(() => {
    vi.stubGlobal('Image', imageCtor as unknown as typeof Image)
    imageCtor.mockClear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns no tiles when mapCenter is null', () => {
    const { result } = renderHook(() =>
      useMapTiles(null, { w: 256, h: 256 }),
    )

    expect(result.current.mapTiles).toEqual([])
    expect(result.current.mapTileCacheRef.current).toEqual({})
    expect(imageCtor).not.toHaveBeenCalled()
  })

  it('loads tiles once, marks loaded on onload, and reuses cache on rerender', async () => {
    const { result, rerender } = renderHook(
      ({ center }) => useMapTiles(center, { w: 256, h: 256 }),
      { initialProps: { center: makeCenter() } },
    )

    expect(result.current.mapTiles.length).toBeGreaterThan(0)
    expect(imageCtor.mock.calls.length).toBe(result.current.mapTiles.length)

    const firstTileUrl = result.current.mapTiles[0].url
    const firstEntry = result.current.mapTileCacheRef.current[firstTileUrl]
    expect(firstEntry).toBeDefined()
    expect(firstEntry.loaded).toBe(false)
    expect((firstEntry.image as unknown as MockImage).crossOrigin).toBe('anonymous')

    act(() => {
      (firstEntry.image as unknown as MockImage).onload?.()
    })

    await waitFor(() => {
      expect(result.current.mapTileCacheRef.current[firstTileUrl].loaded).toBe(true)
    })

    rerender({ center: makeCenter() })
    expect(imageCtor.mock.calls.length).toBe(result.current.mapTiles.length)
  })

  it('removes failed tile from cache and retries it on next recalculation', async () => {
    const { result, rerender } = renderHook(
      ({ center }) => useMapTiles(center, { w: 256, h: 256 }),
      { initialProps: { center: makeCenter() } },
    )

    const initialCreated = imageCtor.mock.calls.length
    const retryUrl = result.current.mapTiles[0].url
    const retryEntry = result.current.mapTileCacheRef.current[retryUrl]
    expect(retryEntry).toBeDefined()

    act(() => {
      (retryEntry.image as unknown as MockImage).onerror?.()
    })

    await waitFor(() => {
      expect(result.current.mapTileCacheRef.current[retryUrl]).toBeUndefined()
    })

    rerender({ center: makeCenter(0) })

    await waitFor(() => {
      expect(result.current.mapTileCacheRef.current[retryUrl]).toBeDefined()
    })
    expect(imageCtor.mock.calls.length).toBe(initialCreated + 1)
  })
})
