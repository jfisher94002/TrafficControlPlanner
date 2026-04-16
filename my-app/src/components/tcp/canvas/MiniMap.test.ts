import { describe, expect, it } from 'vitest'
import { latLonToPixel, pixelToLatLon } from './MiniMap'

describe('MiniMap coordinate helpers', () => {
  it('round-trips lat/lon through pixel conversion at multiple zooms', () => {
    const lat = 37.7749
    const lon = -122.4194

    for (const zoom of [3, 8, 12, 16]) {
      const pixel = latLonToPixel(lat, lon, zoom)
      const restored = pixelToLatLon(pixel.x, pixel.y, zoom)
      expect(restored.lat).toBeCloseTo(lat, 6)
      expect(restored.lon).toBeCloseTo(lon, 6)
    }
  })

  it('maps equator/prime-meridian to map center for zoom 0', () => {
    const pixel = latLonToPixel(0, 0, 0)
    expect(pixel.x).toBeCloseTo(128)
    expect(pixel.y).toBeCloseTo(128)
  })

  it('keeps longitude wrapping consistent across the antimeridian', () => {
    const zoom = 6
    const west = latLonToPixel(0, -179.9, zoom).x
    const east = latLonToPixel(0, 179.9, zoom).x
    const worldWidth = 256 * Math.pow(2, zoom)

    expect(east).toBeGreaterThan(west)
    expect(east - west).toBeCloseTo(worldWidth * (359.8 / 360), 3)
  })
})
