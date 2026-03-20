import type { CanvasObject, GeocodeResult, MapCenter, Point, SnapResult } from './types'

export const uid = () => Math.random().toString(36).slice(2, 10)

export const dist = (x1: number, y1: number, x2: number, y2: number) =>
  Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)

export const angleBetween = (x1: number, y1: number, x2: number, y2: number) =>
  Math.atan2(y2 - y1, x2 - x1)

export function geoRoadWidthPx(
  road: { width: number; realWidth?: number },
  mapCenter: MapCenter | null,
): number {
  if (!mapCenter || !road.realWidth) return road.width
  const metersPerPixel =
    (40075016.686 * Math.cos((mapCenter.lat * Math.PI) / 180)) /
    (Math.pow(2, mapCenter.zoom) * 256)
  return Math.max(10, road.realWidth / metersPerPixel)
}

export function snapToEndpoint(
  wx: number,
  wy: number,
  objects: CanvasObject[],
  thresholdScreenPx: number,
  zoom: number,
): SnapResult {
  const t = thresholdScreenPx / zoom
  for (const obj of objects) {
    if (obj.type === 'road') {
      for (const ep of [
        { x: obj.x1, y: obj.y1 },
        { x: obj.x2, y: obj.y2 },
      ]) {
        if (dist(wx, wy, ep.x, ep.y) < t) return { x: ep.x, y: ep.y, snapped: true }
      }
    }
    if (
      (obj.type === 'polyline_road' || obj.type === 'curve_road') &&
      obj.points?.length
    ) {
      const eps = [obj.points[0], obj.points[obj.points.length - 1]]
      for (const ep of eps) {
        if (dist(wx, wy, ep.x, ep.y) < t) return { x: ep.x, y: ep.y, snapped: true }
      }
    }
  }
  return { x: wx, y: wy, snapped: false }
}

export function sampleBezier(p0: Point, p1: Point, p2: Point, n: number): Point[] {
  const pts: Point[] = []
  for (let i = 0; i <= n; i++) {
    const t = i / n,
      mt = 1 - t
    pts.push({
      x: mt * mt * p0.x + 2 * mt * t * p1.x + t * t * p2.x,
      y: mt * mt * p0.y + 2 * mt * t * p1.y + t * t * p2.y,
    })
  }
  return pts
}

export function distToSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const dx = bx - ax,
    dy = by - ay
  const lenSq = dx * dx + dy * dy
  if (lenSq === 0) return dist(px, py, ax, ay)
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq))
  return dist(px, py, ax + t * dx, ay + t * dy)
}

export function distToPolyline(px: number, py: number, points: Point[]): number {
  let minD = Infinity
  for (let i = 0; i < points.length - 1; i++)
    minD = Math.min(
      minD,
      distToSegment(px, py, points[i].x, points[i].y, points[i + 1].x, points[i + 1].y),
    )
  return minD
}

export function formatSearchPrimary(result: GeocodeResult): string {
  const address = result?.address
  if (address) {
    const street = [
      address.house_number,
      address.road || address.pedestrian || address.footway || address.cycleway,
    ]
      .filter(Boolean)
      .join(' ')
    const locality =
      address.city ||
      address.town ||
      address.village ||
      address.hamlet ||
      address.county
    const region = address.state || address.state_district
    const lr = [locality, region].filter(Boolean).join(', ')
    if (street && lr) return `${street}, ${lr}`
    if (street) return street
  }
  return result?.display_name || ''
}

export async function geocodeAddress(query: string): Promise<GeocodeResult[]> {
  try {
    const response = await fetch(
      `https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?f=json&singleLine=${encodeURIComponent(query)}&maxLocations=5`,
    )
    if (!response.ok) return []
    const data = await response.json()
    const candidates = Array.isArray(data?.candidates) ? data.candidates : []
    return candidates.map(
      (
        c: Record<string, unknown> & {
          location?: { x?: number; y?: number }
          address?: string
        },
      ) => ({
        lat: String(c?.location?.y ?? ''),
        lon: String(c?.location?.x ?? ''),
        display_name: c?.address || '',
        address: { road: c?.address || '' },
      }),
    )
  } catch {
    return []
  }
}
