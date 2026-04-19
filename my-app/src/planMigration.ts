/**
 * Plan schema version detection and coordinate migration helpers.
 *
 * v1 plans store object coordinates in Konva world-space pixels.
 * v2 plans store object coordinates in plan space (meters from mapCenter).
 *
 * v1 → v2 upgrade happens at save time (inside handleCloudSave) when live
 * canvas state is available. There is no offline batch migration because
 * canvasSize is not stored in v1 plans.
 *
 * v2 → world: done at load time using the stored viewport (canvasOffset,
 * canvasZoom) and the live canvasSize from React state.
 */

import { planToWorld, buildGeoContext, type ViewportState, type PlanPt, type GeoContext } from './coordinate-bridge'

export type SchemaVersion = 1 | 2

/**
 * Detect the schema version of a raw plan object.
 * A plan is v2 if it has `_schemaVersion === 2` and a valid `geoContext` block.
 */
export function detectSchemaVersion(plan: Record<string, unknown>): SchemaVersion {
  if (
    plan._schemaVersion === 2 &&
    plan.geoContext !== null &&
    typeof plan.geoContext === 'object'
  ) {
    return 2
  }
  return 1
}

export interface MigrationStats {
  objectCount: number
  convertedCount: number
  skippedCount: number
}

/**
 * Convert all plan-space object coordinates back to world pixels for the
 * current renderer. Called at load time for v2 plans.
 *
 * canvasSize is live React state at load time.
 * canvasOffset and canvasZoom are read from the stored plan fields.
 *
 * v1 plans are returned unchanged.
 */
export function v2ToWorldCoords(
  plan: Record<string, unknown>,
  canvasSize: { w: number; h: number },
): { plan: Record<string, unknown>; stats: MigrationStats } {
  if (detectSchemaVersion(plan) !== 2) {
    const objects = getObjects(plan)
    return { plan, stats: { objectCount: objects.length, convertedCount: 0, skippedCount: 0 } }
  }

  const geo = resolveGeoContext(plan, canvasSize)
  const viewport = resolveViewport(plan)
  const objects = getObjects(plan)

  let convertedCount = 0
  let skippedCount = 0

  const convertedObjects = objects.map((obj) => {
    const result = convertObjectToWorld(obj, viewport, geo)
    if (result.converted) {
      convertedCount++
    } else {
      skippedCount++
      console.warn('[planMigration] Skipped object with unrecognised coord shape:', obj)
    }
    return result.obj
  })

  return {
    plan: {
      ...plan,
      canvasState: { ...(plan.canvasState as Record<string, unknown>), objects: convertedObjects },
    },
    stats: { objectCount: objects.length, convertedCount, skippedCount },
  }
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function getObjects(plan: Record<string, unknown>): Record<string, unknown>[] {
  const cs = plan.canvasState
  if (cs && typeof cs === 'object' && Array.isArray((cs as Record<string, unknown>).objects)) {
    return (cs as Record<string, unknown>).objects as Record<string, unknown>[]
  }
  return []
}

/** Reconstruct a GeoContext from the stored geoContext block, overriding originScreenPx
 *  with the live canvasSize so the viewport center anchor is correct for the current window. */
function resolveGeoContext(plan: Record<string, unknown>, canvasSize: { w: number; h: number }): GeoContext {
  const stored = plan.geoContext as Record<string, unknown>
  const mapCenter = stored.mapCenter as { lat: number; lng: number }
  const mapZoom = stored.mapZoom as number
  // Rebuild from live canvasSize — the map anchor is always at the viewport center.
  return buildGeoContext(mapCenter, mapZoom, canvasSize)
}

function resolveViewport(plan: Record<string, unknown>): ViewportState {
  return {
    offsetX: typeof plan.canvasOffset === 'object' && plan.canvasOffset !== null
      ? ((plan.canvasOffset as Record<string, unknown>).x as number) ?? 0
      : 0,
    offsetY: typeof plan.canvasOffset === 'object' && plan.canvasOffset !== null
      ? ((plan.canvasOffset as Record<string, unknown>).y as number) ?? 0
      : 0,
    zoom: typeof plan.canvasZoom === 'number' ? plan.canvasZoom : 1,
  }
}

/** Convert a single canvas object's plan-space coords to world pixels. */
function convertObjectToWorld(
  obj: Record<string, unknown>,
  viewport: ViewportState,
  geo: GeoContext,
): { obj: Record<string, unknown>; converted: boolean } {
  // Sign / device / zone / text / taper / turn_lane: { x, y }
  if (typeof obj.x === 'number' && typeof obj.y === 'number') {
    const world = planToWorld({ x: obj.x, y: obj.y } as PlanPt, viewport, geo)
    return { obj: { ...obj, x: world.x, y: world.y }, converted: true }
  }

  // Straight road / arrow / measure / lane_mask / crosswalk: { x1, y1, x2, y2 }
  if (
    typeof obj.x1 === 'number' && typeof obj.y1 === 'number' &&
    typeof obj.x2 === 'number' && typeof obj.y2 === 'number'
  ) {
    const w1 = planToWorld({ x: obj.x1, y: obj.y1 } as PlanPt, viewport, geo)
    const w2 = planToWorld({ x: obj.x2, y: obj.y2 } as PlanPt, viewport, geo)
    return { obj: { ...obj, x1: w1.x, y1: w1.y, x2: w2.x, y2: w2.y }, converted: true }
  }

  // Polyline / curve / cubic_bezier road: { points: Array<{x,y}> }
  if (Array.isArray(obj.points) && obj.points.length > 0 && isPt(obj.points[0])) {
    const pts = obj.points as PlanPt[]
    const converted = pts.map((p) => planToWorld(p, viewport, geo))
    return { obj: { ...obj, points: converted }, converted: true }
  }

  return { obj, converted: false }
}

function isPt(v: unknown): v is PlanPt {
  return typeof v === 'object' && v !== null &&
    typeof (v as Record<string, unknown>).x === 'number' &&
    typeof (v as Record<string, unknown>).y === 'number'
}
