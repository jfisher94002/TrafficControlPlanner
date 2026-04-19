/**
 * Coordinate bridge — pure math module for converting between coordinate spaces.
 *
 * Spaces:
 *   WorldSpace  (px)  — Konva layer-local coords; stored in v1 objects
 *   ScreenSpace (px)  — Konva stage pixels; ephemeral
 *   PlanSpace   (m)   — meters from mapCenter; stable; stored in v2
 *   GeoSpace          — WGS84 lat/lng
 *
 * No React, no S3, no side effects.
 */

export interface GeoContext {
  mapCenter: { lat: number; lng: number }
  mapZoom: number
  groundResolutionMetersPerPx: number
  /** Screen pixel of mapCenter = { x: canvasSize.w/2, y: canvasSize.h/2 } at save time */
  originScreenPx: { x: number; y: number }
  crs: 'EPSG:3857'
}

export interface ViewportState {
  /** Konva layer translation (pan) — where world (0,0) lands on the stage */
  offsetX: number
  offsetY: number
  /** Konva layer scale */
  zoom: number
}

/** Konva layer-local pixels (world space) */
export interface WorldPt { x: number; y: number }
/** Meters from mapCenter (plan space) */
export interface PlanPt  { x: number; y: number }
/** Konva stage pixels (screen space) */
export interface ScreenPt { x: number; y: number }
export interface LatLng   { lat: number; lng: number }

/**
 * Ground resolution in meters per pixel at the given map zoom level and latitude.
 * Formula: (2π × 6_378_137) / (256 × 2^zoom) × cos(lat × π / 180)
 * Zoom is clamped to [1, 20].
 */
export function groundResolution(zoom: number, lat: number): number {
  const clampedZoom = Math.max(1, Math.min(20, zoom))
  return (2 * Math.PI * 6_378_137) / (256 * Math.pow(2, clampedZoom)) * Math.cos(lat * Math.PI / 180)
}

/**
 * Build a GeoContext from live canvas state. Call at save time when canvasSize is available.
 * mapCenter is always anchored at (canvasSize.w/2, canvasSize.h/2) per useMapTiles invariant.
 */
export function buildGeoContext(
  mapCenter: { lat: number; lng: number },
  mapZoom: number,
  canvasSize: { w: number; h: number },
): GeoContext {
  return {
    mapCenter,
    mapZoom,
    groundResolutionMetersPerPx: groundResolution(mapZoom, mapCenter.lat),
    originScreenPx: { x: canvasSize.w / 2, y: canvasSize.h / 2 },
    crs: 'EPSG:3857',
  }
}

// ─── PlanSpace ↔ ScreenSpace ──────────────────────────────────────────────────

/**
 * Convert a plan-space point (meters from mapCenter) to screen pixels.
 * Canvas +Y is down; plan space +Y is north — Y axis is flipped.
 * Note: viewport is not used for plan↔screen conversion (mapCenter is always
 * anchored at originScreenPx regardless of pan/zoom). It is kept in the signature
 * to mirror worldToPlan/planToWorld so callers can pass a uniform ViewportState.
 */
export function planToScreen(pt: PlanPt, _viewport: ViewportState, geo: GeoContext): ScreenPt {
  return {
    x: geo.originScreenPx.x + pt.x / geo.groundResolutionMetersPerPx,
    y: geo.originScreenPx.y - pt.y / geo.groundResolutionMetersPerPx,
  }
}

/**
 * Convert a screen-pixel point to plan space (meters from mapCenter).
 * viewport is intentionally unused — see planToScreen for rationale.
 */
export function screenToPlan(pt: ScreenPt, _viewport: ViewportState, geo: GeoContext): PlanPt {
  return {
    x:  (pt.x - geo.originScreenPx.x) * geo.groundResolutionMetersPerPx,
    y: -(pt.y - geo.originScreenPx.y) * geo.groundResolutionMetersPerPx,
  }
}

// ─── WorldSpace ↔ PlanSpace ───────────────────────────────────────────────────

/**
 * Convert a world-space point (Konva layer-local pixels) to plan space (meters).
 * Combines world→screen→plan using the live viewport.
 */
export function worldToPlan(pt: WorldPt, viewport: ViewportState, geo: GeoContext): PlanPt {
  const screen: ScreenPt = {
    x: pt.x * viewport.zoom + viewport.offsetX,
    y: pt.y * viewport.zoom + viewport.offsetY,
  }
  return screenToPlan(screen, viewport, geo)
}

/**
 * Convert a plan-space point (meters) back to world-space pixels.
 * Uses the stored viewport (canvasZoom + canvasOffset) from the plan.
 */
export function planToWorld(pt: PlanPt, viewport: ViewportState, geo: GeoContext): WorldPt {
  const screen = planToScreen(pt, viewport, geo)
  return {
    x: (screen.x - viewport.offsetX) / viewport.zoom,
    y: (screen.y - viewport.offsetY) / viewport.zoom,
  }
}

// ─── PlanSpace ↔ GeoSpace ─────────────────────────────────────────────────────

/**
 * Convert a plan-space point (meters from mapCenter) to WGS84 lat/lng.
 * Stable — no viewport needed.
 *
 * Uses a local spherical approximation (small-angle degrees-per-meter), which is
 * accurate to well under 1 m for TCP plan extents (< 5 km). This is NOT a full
 * EPSG:3857 Mercator projection; crs is declared for downstream consumers
 * (DXF, PostGIS) and reflects the intended projected space, not this conversion.
 */
export function planToGeo(pt: PlanPt, geo: GeoContext): LatLng {
  const metersPerDegreeLat = (2 * Math.PI * 6_378_137) / 360
  const cosLat = Math.cos(geo.mapCenter.lat * Math.PI / 180)
  // Guard: cos approaches 0 above ~89.9° lat — TCP plans never operate there,
  // but clamp to avoid infinities from malformed data.
  const metersPerDegreeLng = metersPerDegreeLat * Math.max(cosLat, 1e-10)

  return {
    lat: geo.mapCenter.lat + pt.y / metersPerDegreeLat,
    lng: geo.mapCenter.lng + pt.x / metersPerDegreeLng,
  }
}

/**
 * Convert WGS84 lat/lng to plan-space meters from mapCenter.
 * Uses the same local spherical approximation as planToGeo.
 */
export function geoToPlan(ll: LatLng, geo: GeoContext): PlanPt {
  const metersPerDegreeLat = (2 * Math.PI * 6_378_137) / 360
  const cosLat = Math.cos(geo.mapCenter.lat * Math.PI / 180)
  const metersPerDegreeLng = metersPerDegreeLat * Math.max(cosLat, 1e-10)

  return {
    x: (ll.lng - geo.mapCenter.lng) * metersPerDegreeLng,
    y: (ll.lat - geo.mapCenter.lat) * metersPerDegreeLat,
  }
}
