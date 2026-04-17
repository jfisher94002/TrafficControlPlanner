import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useMapTiles } from './useMapTiles'
import type { MapCenter } from '../types'

class MockImage {
  static created: MockImage[] = []
  onload: null | (() => void) = null
  onerror: null | (() => void) = null
  crossOrigin = ''
  src = ''

  constructor() {
    MockImage.created.push(this)
  }
}

function makeCenter(lon = 0, zoom = 1): MapCenter {
  return { lat: 0, lon, zoom }
}

describe('useMapTiles', () => {
  beforeEach(() => {
    MockImage.created = []
    vi.stubGlobal('Image', MockImage as unknown as typeof Image)
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
    expect(MockImage.created).toHaveLength(0)
  })

  it('loads tiles once, marks loaded on onload, and reuses cache on rerender', async () => {
    const { result, rerender } = renderHook(
      ({ center }) => useMapTiles(center, { w: 256, h: 256 }),
      { initialProps: { center: makeCenter() } },
    )

    expect(result.current.mapTiles.length).toBeGreaterThan(0)
    expect(MockImage.created.length).toBe(result.current.mapTiles.length)

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
    expect(MockImage.created.length).toBe(result.current.mapTiles.length)
  })

  it('removes failed tile from cache and retries it on next recalculation', async () => {
    const { result, rerender } = renderHook(
      ({ center }) => useMapTiles(center, { w: 256, h: 256 }),
      { initialProps: { center: makeCenter() } },
    )

    const initialCreated = MockImage.created.length
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
    expect(MockImage.created.length).toBe(initialCreated + 1)
  })

  it('evicts stale cache entries when viewport tiles change', () => {
    const { result, rerender } = renderHook(
      ({ center }) => useMapTiles(center, { w: 256, h: 256 }),
      { initialProps: { center: makeCenter(-120, 5) } },
    )

    const initialUrls = Object.keys(result.current.mapTileCacheRef.current)
    expect(initialUrls.length).toBeGreaterThan(0)

    rerender({ center: makeCenter(120, 5) })

    const currentTileUrls = new Set(result.current.mapTiles.map((t) => t.url))
    const cachedUrls = Object.keys(result.current.mapTileCacheRef.current)

    // Ensure the scenario is meaningful: at least one previously cached URL is now out of view.
    expect(initialUrls.some((url) => !currentTileUrls.has(url))).toBe(true)
    // Cache should only contain currently visible tile URLs after eviction.
    expect(cachedUrls.every((url) => currentTileUrls.has(url))).toBe(true)
  })
})
