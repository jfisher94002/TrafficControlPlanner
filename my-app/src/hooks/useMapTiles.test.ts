import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useMapTiles } from './useMapTiles'

interface MockImageLike {
  crossOrigin: string
  onload: (() => void) | null
  onerror: (() => void) | null
  src: string
}

const mockImages: MockImageLike[] = []
const OriginalImage = globalThis.Image

class MockImage implements MockImageLike {
  crossOrigin = ''
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  private _src = ''

  get src() {
    return this._src
  }

  set src(value: string) {
    this._src = value
  }

  constructor() {
    mockImages.push(this)
  }
}

describe('useMapTiles', () => {
  beforeEach(() => {
    mockImages.length = 0
    globalThis.Image = MockImage as unknown as typeof Image
  })

  afterEach(() => {
    globalThis.Image = OriginalImage
  })

  it('returns no tiles when mapCenter is null', () => {
    const { result } = renderHook(() => useMapTiles(null, { w: 256, h: 256 }))
    expect(result.current.mapTiles).toEqual([])
    expect(mockImages.length).toBe(0)
  })

  it('marks cached tile as loaded when image onload fires', async () => {
    const { result } = renderHook(() =>
      useMapTiles({ lat: 37.7749, lon: -122.4194, zoom: 14 }, { w: 256, h: 256 }),
    )

    await waitFor(() => {
      expect(result.current.mapTiles.length).toBeGreaterThan(0)
      expect(mockImages.length).toBeGreaterThan(0)
    })

    const firstTileUrl = result.current.mapTiles[0].url
    expect(result.current.mapTileCacheRef.current[firstTileUrl]?.loaded).toBe(false)

    act(() => {
      mockImages[0].onload?.()
    })

    expect(result.current.mapTileCacheRef.current[firstTileUrl]?.loaded).toBe(true)
  })

  it('removes failed tile from cache when image onerror fires', async () => {
    const { result } = renderHook(() =>
      useMapTiles({ lat: 37.7749, lon: -122.4194, zoom: 14 }, { w: 256, h: 256 }),
    )

    await waitFor(() => {
      expect(result.current.mapTiles.length).toBeGreaterThan(0)
      expect(mockImages.length).toBeGreaterThan(0)
    })

    const failedUrl = mockImages[0].src
    expect(result.current.mapTileCacheRef.current[failedUrl]).toBeDefined()

    act(() => {
      mockImages[0].onerror?.()
    })

    expect(result.current.mapTileCacheRef.current[failedUrl]).toBeUndefined()
  })

  it('reuses existing cache entries for same tile set', async () => {
    const initialProps = {
      center: { lat: 37.7749, lon: -122.4194, zoom: 14 },
      size: { w: 256, h: 256 },
    }
    const { rerender } = renderHook(
      ({ center, size }: { center: { lat: number; lon: number; zoom: number } | null; size: { w: number; h: number } }) =>
        useMapTiles(center, size),
      { initialProps },
    )

    await waitFor(() => {
      expect(mockImages.length).toBeGreaterThan(0)
    })
    const firstLoadCount = mockImages.length

    rerender({
      center: { ...initialProps.center },
      size: { ...initialProps.size },
    })

    await waitFor(() => {
      expect(mockImages.length).toBe(firstLoadCount)
    })
  })
})
