import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useMapTiles } from './useMapTiles'

class FakeImage {
  public onload: (() => void) | null = null
  public onerror: (() => void) | null = null
  public crossOrigin: string | null = null
  private _src = ''

  set src(value: string) {
    this._src = value
  }

  get src() {
    return this._src
  }
}

describe('useMapTiles', () => {
  const realImage = globalThis.Image

  beforeEach(() => {
    globalThis.Image = FakeImage as unknown as typeof Image
  })

  afterEach(() => {
    globalThis.Image = realImage
  })

  it('evicts tile cache entries that are outside the new viewport', async () => {
    const { result, rerender } = renderHook(
      ({ mapCenter }) => useMapTiles(mapCenter, { w: 256, h: 256 }),
      { initialProps: { mapCenter: { lat: 37.7749, lon: -122.4194, zoom: 15 } } },
    )

    await waitFor(() => {
      expect(Object.keys(result.current.mapTileCacheRef.current).length).toBe(result.current.mapTiles.length)
      expect(result.current.mapTiles.length).toBeGreaterThan(0)
    })
    const initialUrls = new Set(Object.keys(result.current.mapTileCacheRef.current))

    rerender({ mapCenter: { lat: 37.7749, lon: -121.4194, zoom: 15 } })

    await waitFor(() => {
      expect(Object.keys(result.current.mapTileCacheRef.current).length).toBe(result.current.mapTiles.length)
    })

    const nextUrls = Object.keys(result.current.mapTileCacheRef.current)
    expect(nextUrls.every((url) => result.current.mapTiles.some((tile) => tile.url === url))).toBe(true)
    expect([...initialUrls].some((url) => !nextUrls.includes(url))).toBe(true)
  })

  it('clears cached tiles when mapCenter is unset', async () => {
    const { result, rerender } = renderHook(
      ({ mapCenter }) => useMapTiles(mapCenter, { w: 256, h: 256 }),
      { initialProps: { mapCenter: { lat: 37.7749, lon: -122.4194, zoom: 15 } } },
    )

    await waitFor(() => {
      expect(Object.keys(result.current.mapTileCacheRef.current).length).toBeGreaterThan(0)
    })

    rerender({ mapCenter: null })

    await waitFor(() => {
      expect(result.current.mapTiles).toHaveLength(0)
      expect(Object.keys(result.current.mapTileCacheRef.current)).toHaveLength(0)
    })
  })
})
