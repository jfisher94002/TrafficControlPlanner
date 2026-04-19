# Plan JSON v1 → v2 Migration Runbook

**Issue:** #194  
**Status:** Spec — pending implementation  
**Branch:** TBD (`feat/coord-bridge-194`)

---

## Why this exists

v1 plans store object coordinates as **Konva world-space pixel values** (layer-local, before layer transform). These are viewport-dependent: they change meaning on zoom, pan, resize, and export crop — making them unsuitable for DXF export, AI sign placement, comment anchoring, and real-time collaboration.

v2 plans store object coordinates in **plan space (meters from the plan origin)**, with a `geoContext` block providing the ground resolution and map anchor needed to convert between plan space, screen pixels, and WGS84/EPSG:3857.

---

## Scope of this PR

| In scope | Out of scope |
|---|---|
| `coordinate-bridge` module (`groundResolution`, `buildGeoContext`, `planToScreen`, `screenToPlan`, `worldToPlan`, `planToWorld`, `planToGeo`, `geoToPlan`) | Canvas renderer switch to plan-space rendering (Phase 4) |
| Schema v2 writes for new saves with a `mapCenter` set | Batch migration of existing v1 plans on S3 |
| Load path: detect v1 (use as-is) and v2 (convert back to pixels for current renderer) | DXF Lambda coordinate wiring |
| Migration runbook (this doc) | S3 key rename (`userId` → `tenantId`) |

**Why no offline batch migration?**  
The migration formula requires `canvasSize` (the browser canvas dimensions at save time). This is not stored in v1 plans — it depends on the user's window at the moment of saving. Without it, coordinate transforms are inaccurate. The correct strategy is to upgrade plans **at save time**, when `canvasSize` is live in React state.

**Why not bump `PLAN_SCHEMA_VERSION` to 2 for plans without `mapCenter`?**  
Plans with no geo anchor cannot produce a valid `geoContext`. They stay at v1 indefinitely; a warning banner prompts the user to add a map location.

---

## Coordinate spaces

```
WorldSpace (px)      — Konva layer-local coords; stored in v1 objects; offset+zoom applied at render
     ↕  (offset, zoom, canvasSize) — all live in React state; NOT stored in v1 plans
ScreenSpace (px)     — Konva stage pixels; ephemeral; screen.x = world.x * zoom + offset.x
     ↕  canvasSize: mapCenter is anchored at (canvasSize.w/2, canvasSize.h/2) in screen space
                     (because useMapTiles always tiles around the viewport center)
MercatorPixels       — internal to useMapTiles; tile math at the map's zoom level
     ↕  groundResolution (meters/px at reference zoom + lat)
PlanSpace (m)        — meters from plan origin (= mapCenter); stable; stored in v2
     ↕  GeoContext
GeoSpace (lat/lng)   — WGS84 for map display, DXF, PostGIS
```

**Key constraint:** `canvasSize` is live state, not persisted in v1. Migration to plan space is therefore only accurate when the canvas is active.

---

## Coordinate transform derivation

### World → plan space (used at save time)

Given live React state `{ offset, zoom, canvasSize, mapCenter, mapZoom }`:

```
screenX = worldX * canvasZoom + canvasOffset.x
screenY = worldY * canvasZoom + canvasOffset.y

// mapCenter sits at screen center (useMapTiles invariant):
originScreenX = canvasSize.w / 2
originScreenY = canvasSize.h / 2

// Delta from mapCenter in screen pixels:
ΔscreenX = screenX − originScreenX  =  worldX * zoom + offset.x − canvasSize.w/2
ΔscreenY = screenY − originScreenY  =  worldY * zoom + offset.y − canvasSize.h/2

// Convert to meters (Y axis flipped: canvas +Y is down, plan space +Y is north):
planX =  ΔscreenX * groundRes
planY = −ΔscreenY * groundRes
```

### Plan space → world (used at load time for v2 plans)

v2 plans continue to store `canvasZoom` and `canvasOffset` (as v1 does) for viewport restoration. The load path uses those stored values together with the **current live `canvasSize`**:

```
ΔscreenX = planX / groundRes
ΔscreenY = −planY / groundRes

// mapCenter is always at screen center at the current canvasSize:
screenX = ΔscreenX + canvasSize_current.w / 2
screenY = ΔscreenY + canvasSize_current.h / 2

// Invert world→screen using the stored viewport:
worldX = (screenX − stored_canvasOffset.x) / stored_canvasZoom
worldY = (screenY − stored_canvasOffset.y) / stored_canvasZoom
```

`canvasSize_current` is the live React state at load time, not a stored value. If the user's browser window is a different size than at save time, objects shift by `Δ(canvasSize.w/2)` in screen pixels — acceptable for the current pixel-space renderer (see Failure modes).

**Two-zoom invariant:**  
- `groundRes` uses `mapZoom` (the map tile zoom level; drives ground resolution in m/px).  
- World→screen uses `canvasZoom` (the Konva layer scale; drives how big objects appear on screen).  
These are independent: panning/zooming the canvas changes `canvasZoom` and `canvasOffset`; changing the map base layer changes `mapZoom`. Plan-space meters are always in ground units at `mapZoom`; `canvasZoom` affects only how many screen pixels each world pixel occupies.

---

## GeoContext block (written to v2 plans)

```typescript
interface GeoContext {
  mapCenter: { lat: number; lng: number }; // WGS84 anchor; same as plan-level mapCenter
  mapZoom: number;                          // reference zoom (same as plan-level mapZoom)
  groundResolutionMetersPerPx: number;      // meters/px at reference zoom + lat
  originScreenPx: { x: number; y: number };// screen pixel of mapCenter at time of save
                                            // = { x: canvasSize.w/2, y: canvasSize.h/2 }
  crs: "EPSG:3857";                         // canonical projection for planToGeo / geoToPlan
}
```

`groundResolutionMetersPerPx` formula (Web Mercator):
```
(2π × 6_378_137) / (256 × 2^zoom) × cos(lat × π / 180)
```

> **Note:** The architecture doc (§15) uses `originCanvasPx`. This runbook renames the field to `originScreenPx` to prevent confusion with `canvasOffset` (the Konva layer translation / pan). The two are distinct:  
> - `canvasOffset` = where world (0,0) lands on the stage (pan offset, stored in v1).  
> - `originScreenPx` = screen pixel of mapCenter = always `(canvasSize.w/2, canvasSize.h/2)` regardless of pan.

---

## Files

### New: `my-app/src/coordinate-bridge.ts`

Pure math module — no React, no S3, no side effects.

```typescript
export interface GeoContext {
  mapCenter: { lat: number; lng: number };
  mapZoom: number;
  groundResolutionMetersPerPx: number;
  originScreenPx: { x: number; y: number };
  crs: 'EPSG:3857';
}
export interface ViewportState { offsetX: number; offsetY: number; zoom: number }
export interface WorldPt  { x: number; y: number }  // Konva layer-local pixels (world space)
export interface PlanPt   { x: number; y: number }  // meters from mapCenter (plan space)
export interface ScreenPt { x: number; y: number }  // Konva stage pixels (screen space)
export interface LatLng   { lat: number; lng: number }

/** meters/px at the given zoom level and latitude (Web Mercator) */
export function groundResolution(zoom: number, lat: number): number

/** Build a GeoContext from live canvas state (call at save time) */
export function buildGeoContext(
  mapCenter: { lat: number; lng: number },
  mapZoom: number,
  canvasSize: { w: number; h: number },
): GeoContext

/** PlanSpace ↔ ScreenSpace */
export function planToScreen(pt: PlanPt, viewport: ViewportState, geo: GeoContext): ScreenPt
export function screenToPlan(pt: ScreenPt, viewport: ViewportState, geo: GeoContext): PlanPt

/** WorldSpace ↔ PlanSpace (combines world→screen→plan) */
export function worldToPlan(pt: WorldPt, viewport: ViewportState, geo: GeoContext): PlanPt
export function planToWorld(pt: PlanPt, viewport: ViewportState, geo: GeoContext): WorldPt

/** PlanSpace ↔ GeoSpace (stable; no viewport needed) */
export function planToGeo(pt: PlanPt, geo: GeoContext): LatLng
export function geoToPlan(ll: LatLng, geo: GeoContext): PlanPt
```

### New: `my-app/src/coordinate-bridge.test.ts`

- `groundResolution(17, 37.7749)` ≈ 0.944 m/px (Web Mercator reference value at SF latitude)
- Round-trip: `screenToPlan(planToScreen(pt, vp, geo), vp, geo) ≈ pt` within 0.001 m
- Round-trip: `geoToPlan(planToGeo(pt, geo), geo) ≈ pt` within 0.001 m
- `planToScreen` with `offset={0,0}, zoom=1`: origin maps to `originScreenPx`
- Non-zero offset and zoom round-trip
- Edge cases: negative plan coords, zoom 1 and zoom 20

### New: `my-app/src/planMigration.ts`

```typescript
export type SchemaVersion = 1 | 2;

export function detectSchemaVersion(plan: Record<string, unknown>): SchemaVersion

/** Convert v2 plan-space object coords back to world pixels for the current renderer.
 *  canvasSize is live React state at load time.
 *  canvasOffset and canvasZoom are read from the plan's stored fields. */
export function v2ToWorldCoords(
  plan: Record<string, unknown>,
  canvasSize: { w: number; h: number },
): Record<string, unknown>
// internally uses plan.canvasOffset and plan.canvasZoom from the stored plan

export interface MigrationStats {
  objectCount: number;
  convertedCount: number;
  skippedCount: number;  // objects without recognised coord fields
}
```

Note: there is no `migrateV1ToV2` offline batch function. v1 → v2 upgrade happens at **save time** inside `handleCloudSave` / `savePlan`, using live canvas state.

### New: `my-app/src/planMigration.test.ts`

- **Fixture 1 (v2 load → world coords)**: known plan-space sign position → expected world coords within 1 px, with `canvasSize = {w:800, h:600}`, `offset={0,0}`, `zoom=1`
- **Fixture 2 (v2 load → world coords)**: road with polyline points — all points converted correctly
- **Fixture 3 (v1 pass-through)**: v1 plan detected, returned unchanged from `v2ToWorldCoords`
- **Fixture 4**: known world-space sign position → save as v2 → load v2 → world coords within 1 px (round-trip through `buildGeoContext` + `v2ToWorldCoords`)

### Modified: `my-app/src/planStorage.ts`

**`loadPlanFromCloud`**: after version check, if schema v2, call `v2ToWorldCoords` before returning. Callers (the planner) receive world-pixel coordinates as always and need no changes.

### Modified: `my-app/src/traffic-control-planner.tsx`

- **`loadPlan` (disk load)**: same v2 detection + `v2ToWorldCoords` using current `canvasSize`
- **`handleCloudSave` + `savePlan`**: if `mapCenter` is set, call `buildGeoContext` + convert all object world coords to plan space; write v2. If no `mapCenter`, write v1 as today
- **Warning banner**: if a loaded plan is v1 with no `mapCenter`, show a dismissible banner: _"This plan has no map location — geo-referenced export is unavailable. Use ⌖ to set a location."_
- **`PLAN_SCHEMA_VERSION`**: bump to 2 (plans with `mapCenter` will now write v2; plans without `mapCenter` continue writing v1 until a location is set)

---

## Decisions

| Question | Decision | Rationale |
|---|---|---|
| Auto-upgrade on load or prompt? | **Transparent at save**: user sees no prompt; v2 is written on next explicit ☁ Save | Upgrade happens at a natural moment; no disruptive dialog |
| Rollback policy | **Rely on S3 versioning** (must be enabled on the bucket) | Free, automatic; prior v1 always recoverable via S3 console |
| Plans without `mapCenter` | **Leave as v1; show warning banner** | No geo anchor → can't compute GeoContext; forced migration corrupts coords |
| Offline batch migration | **Not implemented** | `canvasSize` not stored in v1; offline transform is inaccurate without it |

---

## Rollback procedure

S3 versioning must be enabled before any v2 saves reach production (see setup below). Every save creates a new S3 object version; no manual backup step is needed.

**Restore a single plan to v1:**
1. S3 console → `plans/{userId}/{planId}.tcp.json` → Show versions
2. Select the version predating the first v2 save → Download or restore

**Bulk rollback (scripted):**
```bash
aws s3api list-object-versions --bucket $BUCKET --prefix plans/ \
  | jq '.Versions[] | select(.IsLatest == false and .LastModified < "2026-XX-XX")'
# Then restore each by copying the desired VersionId back as the latest
```

---

## S3 versioning setup

Must be enabled **before** v2 writes are deployed to production.

```bash
aws s3api put-bucket-versioning \
  --bucket YOUR_BUCKET_NAME \
  --versioning-configuration Status=Enabled

# Verify:
aws s3api get-bucket-versioning --bucket YOUR_BUCKET_NAME
# → { "Status": "Enabled" }
```

---

## Failure modes

| Failure | Behaviour | Recovery |
|---|---|---|
| v1 plan with no `mapCenter` | Loaded as v1; warning banner; saves as v1 | Set map location, re-save |
| v2 plan loaded with different `canvasSize` than at save | Objects shift by `Δ(canvasSize.w/2)` screen pixels — positions are anchored to viewport center, which moves with window size. This is not a coordinate corruption; re-save from the new window size to re-anchor. | Pan to re-center; re-save |
| `groundResolution` at extreme zoom (< 1 or > 22) | Clamp to zoom [1, 20] range | N/A — TCP maps are always in this range |
| Object with unrecognised coord shape | Logged to console, counted in `skippedCount`, object left in world pixels | Manual correction in editor |
| S3 versioning not enabled | v2 save proceeds; prior v1 unrecoverable | Enable versioning before deploying |

---

## Acceptance checklist

- [ ] S3 versioning enabled on production bucket before merging
- [ ] `groundResolution(17, 37.7749)` ≈ 0.944 m/px (Web Mercator reference)
- [ ] `coordinate-bridge` round-trip tests pass within 0.001 m epsilon
- [ ] `planMigration` fixture: world → save v2 → load v2 → world within 1 px
- [ ] v1 plan loads unchanged; objects render in correct positions
- [ ] v2 plan loads correctly with `v2ToWorldCoords`; objects render in correct positions
- [ ] Plans without `mapCenter` show warning banner; save as v1
- [ ] `PLAN_SCHEMA_VERSION = 2` written for saves with `mapCenter`
- [ ] Visual sanity check: open a real saved plan before and after PR; object positions match
