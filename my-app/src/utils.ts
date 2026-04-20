import type {
  CanvasObject, GeocodeResult, GeocodeAddress, MapCenter, Point, SnapResult,
  SignObject, DeviceObject, ZoneObject, TextObject, TaperObject, TurnLaneObject,
  StraightRoadObject, PolylineRoadObject, CurveRoadObject, CubicBezierRoadObject, ArrowObject, MeasureObject, LaneMaskObject, CrosswalkObject,
} from './types'

// ─── CLONE / DUPLICATE ────────────────────────────────────────────────────────

/**
 * Returns a clone of `obj` with a fresh id and each coordinate offset by
 * (dx, dy).  All nested structures (signData, deviceData, points arrays, etc.)
 * are deep-copied via JSON round-trip so the clone shares no object references
 * with the original.
 */
export function cloneObject(obj: CanvasObject, dx = 20, dy = 20): CanvasObject {
  // JSON round-trip gives a true deep clone of all nested structures.
  const clone = JSON.parse(JSON.stringify(obj)) as CanvasObject
  const newId = uid()
  if (isPointObject(clone)) return { ...clone, id: newId, x: clone.x + dx, y: clone.y + dy }
  if (isLineObject(clone))  return { ...clone, id: newId, x1: clone.x1 + dx, y1: clone.y1 + dy, x2: clone.x2 + dx, y2: clone.y2 + dy }
  if (clone.type === 'polyline_road') return { ...clone, id: newId, points: clone.points.map(p => ({ x: p.x + dx, y: p.y + dy })) }
  if (clone.type === 'curve_road')         return { ...clone, id: newId, points: clone.points.map(p => ({ x: p.x + dx, y: p.y + dy })) as [Point, Point, Point] }
  if (clone.type === 'cubic_bezier_road')  return { ...clone, id: newId, points: clone.points.map(p => ({ x: p.x + dx, y: p.y + dy })) as [Point, Point, Point, Point] }
  // Fallback: all current CanvasObject variants are handled above; this branch
  // exists only for forward-compatibility if new variants are added.
  return { ...(clone as Record<string, unknown>), id: newId } as CanvasObject
}

// ─── TYPE GUARDS ──────────────────────────────────────────────────────────────

/** Objects with a single x/y position (sign, device, zone, text, taper, turn_lane). */
export const isPointObject = (
  o: CanvasObject,
): o is SignObject | DeviceObject | ZoneObject | TextObject | TaperObject | TurnLaneObject =>
  o.type === 'sign' || o.type === 'device' || o.type === 'zone' || o.type === 'text' || o.type === 'taper' || o.type === 'turn_lane'

/** Objects with x1/y1–x2/y2 endpoints (straight road, arrow, measure, lane_mask, crosswalk). */
export const isLineObject = (
  o: CanvasObject,
): o is StraightRoadObject | ArrowObject | MeasureObject | LaneMaskObject | CrosswalkObject =>
  o.type === 'road' || o.type === 'arrow' || o.type === 'measure' || o.type === 'lane_mask' || o.type === 'crosswalk'

/** Any road type (straight, polyline, curve, cubic). */
export const isRoad = (
  o: CanvasObject,
): o is StraightRoadObject | PolylineRoadObject | CurveRoadObject | CubicBezierRoadObject =>
  o.type === 'road' || o.type === 'polyline_road' || o.type === 'curve_road' || o.type === 'cubic_bezier_road'

/** Roads defined by a points array (polyline, curve, cubic). */
export const isMultiPointRoad = (
  o: CanvasObject,
): o is PolylineRoadObject | CurveRoadObject | CubicBezierRoadObject =>
  o.type === 'polyline_road' || o.type === 'curve_road' || o.type === 'cubic_bezier_road'

/**
 * MUTCD taper length formula.
 *   Speed ≤ 45 mph:  L = W × S² / 60
 *   Speed > 45 mph:  L = W × S
 *
 * Where:
 *   S = posted speed in mph
 *   W = total lateral offset in feet (laneWidthFt × numLanes)
 *
 * @param speed     Posted speed in mph
 * @param laneWidth Lane width per lane in feet
 * @param numLanes  Number of lanes being closed (defaults to 1)
 * @returns Taper length in feet, rounded to 1 decimal
 */
export function calcTaperLength(speed: number, laneWidth: number, numLanes: number = 1): number {
  const W = laneWidth * numLanes
  const L = speed <= 45 ? (W * speed * speed) / 60 : W * speed
  return Math.round(L * 10) / 10
}

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

function distSq(ax: number, ay: number, bx: number, by: number): number {
  return (bx - ax) ** 2 + (by - ay) ** 2
}

function closestPointOnSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): Point {
  const dx = bx - ax, dy = by - ay
  const lenSq = dx * dx + dy * dy
  if (lenSq === 0) return { x: ax, y: ay }
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq))
  return { x: ax + t * dx, y: ay + t * dy }
}

export function snapToEndpoint(
  wx: number,
  wy: number,
  objects: CanvasObject[],
  thresholdScreenPx: number,
  zoom: number,
): SnapResult {
  const t = thresholdScreenPx / zoom
  const tSq = t * t
  // Pass 1: endpoints have priority — snap to them first (squared distance, no sqrt)
  for (const obj of objects) {
    if (obj.type === 'road') {
      for (const ep of [{ x: obj.x1, y: obj.y1 }, { x: obj.x2, y: obj.y2 }]) {
        if (distSq(wx, wy, ep.x, ep.y) < tSq) return { x: ep.x, y: ep.y, snapped: true }
      }
    }
    if (
      (obj.type === 'polyline_road' || obj.type === 'curve_road' || obj.type === 'cubic_bezier_road') &&
      obj.points?.length
    ) {
      for (const ep of [obj.points[0], obj.points[obj.points.length - 1]]) {
        if (distSq(wx, wy, ep.x, ep.y) < tSq) return { x: ep.x, y: ep.y, snapped: true }
      }
    }
  }
  // Pass 2: snap to closest point on any straight/polyline road segment
  let bestDistSq = tSq
  let bestPt: Point | null = null
  for (const obj of objects) {
    if (obj.type === 'road') {
      const cp = closestPointOnSegment(wx, wy, obj.x1, obj.y1, obj.x2, obj.y2)
      const d2 = distSq(wx, wy, cp.x, cp.y)
      if (d2 < bestDistSq) { bestDistSq = d2; bestPt = cp }
    }
    if (obj.type === 'polyline_road' && obj.points?.length >= 2) {
      for (let i = 0; i < obj.points.length - 1; i++) {
        const cp = closestPointOnSegment(wx, wy, obj.points[i].x, obj.points[i].y, obj.points[i+1].x, obj.points[i+1].y)
        const d2 = distSq(wx, wy, cp.x, cp.y)
        if (d2 < bestDistSq) { bestDistSq = d2; bestPt = cp }
      }
    }
  }
  if (bestPt) return { ...bestPt, snapped: true }
  return { x: wx, y: wy, snapped: false }
}

export function sampleCubicBezier(p0: Point, p1: Point, p2: Point, p3: Point, n: number): Point[] {
  if (n <= 0) return [{ ...p0 }, { ...p3 }]
  const pts: Point[] = []
  for (let i = 0; i <= n; i++) {
    const t = i / n, mt = 1 - t
    pts.push({
      x: mt**3 * p0.x + 3*mt**2*t * p1.x + 3*mt*t**2 * p2.x + t**3 * p3.x,
      y: mt**3 * p0.y + 3*mt**2*t * p1.y + 3*mt*t**2 * p2.y + t**3 * p3.y,
    })
  }
  return pts
}

/**
 * Build a flat Konva points array offset perpendicular to the polyline by `d` pixels.
 * Uses the same normal convention as StraightRoad: `(nx, ny) = (-dy/len, dx/len)`,
 * so positive `d` offsets in the same direction as StraightRoad's positive-normal side
 * (and `sidewalkSide = 'left'` corresponds to positive `d`).
 * Uses the outgoing-segment normal at each point; the final point uses the last
 * segment's normal. Works for both densely-sampled spines and raw control points.
 * Returns a flat array of [x0, y0, x1, y1, ...] suitable for Konva Line `points`.
 * If fewer than 2 points are provided, returns the original points unchanged (no offset).
 */
export function buildOffsetSpine(pts: Point[], d: number): number[] {
  if (pts.length < 2) return pts.flatMap((p) => [p.x, p.y])
  const result: number[] = []
  for (let i = 0; i < pts.length; i++) {
    const a = i < pts.length - 1 ? pts[i] : pts[i - 1]
    const b = i < pts.length - 1 ? pts[i + 1] : pts[i]
    const dx = b.x - a.x, dy = b.y - a.y
    const len = Math.sqrt(dx * dx + dy * dy) || 1
    const nx = -dy / len, ny = dx / len
    result.push(pts[i].x + nx * d, pts[i].y + ny * d)
  }
  return result
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

// ─── TILE URL ─────────────────────────────────────────────────────────────────

export const DEFAULT_TILE_URL = 'https://tiles.stadiamaps.com/tiles/osm_bright/{z}/{x}/{y}.png'

/**
 * Resolves the tile URL template from the env var, falling back to the Stadia
 * Maps default. Logs a warning and falls back if required placeholders are missing.
 */
export function resolveTileUrl(envValue: string | undefined): string {
  const candidate = envValue?.trim()
  if (!candidate) return DEFAULT_TILE_URL
  const missing = ['{z}', '{x}', '{y}'].filter(t => !candidate.includes(t))
  if (missing.length > 0) {
    const safe = candidate.split('?')[0]  // omit query params that may contain API keys
    console.warn(`[TCP] Invalid VITE_TILE_URL "${safe}": missing ${missing.join(', ')}. Falling back to default.`)
    return DEFAULT_TILE_URL
  }
  return candidate
}

/** Substitutes {z}, {x}, {y} placeholders in a tile URL template. */
export function buildTileUrl(template: string, z: number, x: number, y: number): string {
  return template.replace(/\{z\}/g, String(z)).replace(/\{x\}/g, String(x)).replace(/\{y\}/g, String(y))
}

// ─── GEOCODING ────────────────────────────────────────────────────────────────

export async function geocodeAddress(query: string): Promise<GeocodeResult[]> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&addressdetails=1`,
    )
    if (!response.ok) return []
    const data = await response.json()
    if (!Array.isArray(data)) return []
    return (data as Array<Record<string, unknown>>).map((item) => {
      const addr = (item.address ?? {}) as GeocodeAddress
      return {
        lat: String(item.lat ?? ''),
        lon: String(item.lon ?? ''),
        display_name: String(item.display_name ?? ''),
        address: addr,
      }
    })
  } catch {
    return []
  }
}
