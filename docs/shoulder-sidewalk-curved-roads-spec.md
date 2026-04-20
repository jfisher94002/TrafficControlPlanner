# Shoulder & Sidewalk Rendering on Curved Roads — Spec

**Issue:** #195  
**Status:** Implemented  
**Branch:** `feat/shoulder-sidewalk-195`

---

## Problem

`StraightRoadObject` renders shoulders and sidewalks correctly. `PolylineRoadObject`, `CurveRoadObject`, and `CubicBezierRoadObject` have the same data fields (`shoulderWidth`, `sidewalkWidth`, `sidewalkSide`) but their draw routines in `ObjectShapes.tsx` silently ignore them. Every polyline and bezier road with shoulders/sidewalks set renders with no shoulder or sidewalk visible.

---

## Scope

| In scope | Out of scope |
|---|---|
| `PolylineRoad`, `CurveRoad`, `CubicBezierRoad` in `ObjectShapes.tsx` | `StraightRoadObject` (already works) |
| New `buildOffsetSpine` utility in `utils.ts` | PropertyPanel UI (already exists) |
| Unit tests for each road type | New road types or future road shapes |

---

## How StraightRoad does it (reference)

`StraightRoadObject` renders shoulder and sidewalk as parallel `<Line>` elements computed from a single perpendicular normal vector `(nx, ny)`:

```
shoulder:   offset = hw + shoulderWidth / 2
                     strokeWidth = shoulderWidth
sidewalk:   swOff  = hw + shoulderWidth + sidewalkWidth / 2
                     strokeWidth = sidewalkWidth
```

Colors:
- Shoulder fill: `rgba(80,90,110,0.8)`
- Sidewalk fill: `rgba(200,195,185,0.6)`
- Sidewalk outer edge: `rgba(160,155,145,0.8)`, strokeWidth = 1

Side logic:
- `showLeft  = sidewalkSide === 'both' || sidewalkSide === 'left'`
- `showRight = sidewalkSide === 'both' || sidewalkSide === 'right'`

---

## Approach for curved roads

### Core idea: offset spine

Curved roads are already rendered by sampling a spine:
- `CurveRoadObject`: `spine = sampleBezier(p0, p1, p2, 32)` — 33 points
- `CubicBezierRoadObject`: `spine = sampleCubicBezier(p0, p1, p2, p3, 32)` — 33 points
- `PolylineRoadObject`: spine = the control points array (`pts`), same as used for lane markings

For each road type, shoulders and sidewalks are rendered by building an **offset spine**: each point of the original spine shifted by a perpendicular distance `d` in the normal direction.

The normal at each point is computed from adjacent segment directions:
- At interior points: use the outgoing segment direction
- At the final point: use the incoming segment direction

This produces a connected polyline that follows the road edge at a consistent offset, rendered as a single `<Line>` element.

### New utility: `buildOffsetSpine(pts, d)`

Add to `utils.ts`:

```typescript
/**
 * Build a flat Konva points array offset perpendicular to the polyline by `d` pixels.
 * Positive `d` is left of the direction of travel (canvas +Y down convention).
 * Uses per-segment forward normals; the last point uses the last segment's normal.
 */
export function buildOffsetSpine(pts: Point[], d: number): number[]
```

Implementation:
```typescript
export function buildOffsetSpine(pts: Point[], d: number): number[] {
  const result: number[] = []
  for (let i = 0; i < pts.length; i++) {
    // Use outgoing segment; fall back to incoming for the last point
    const a = i < pts.length - 1 ? pts[i] : pts[i - 1]
    const b = i < pts.length - 1 ? pts[i + 1] : pts[i]
    const dx = b.x - a.x, dy = b.y - a.y
    const len = Math.sqrt(dx * dx + dy * dy) || 1
    const nx = -dy / len, ny = dx / len
    result.push(pts[i].x + nx * d, pts[i].y + ny * d)
  }
  return result
}
```

### Rendering in each component

For each of `PolylineRoad`, `CurveRoad`, `CubicBezierRoad`:

1. Destructure the shoulder/sidewalk fields from `obj` (same as `StraightRoad`):
   ```tsx
   const { shoulderWidth = 0, sidewalkWidth = 0, sidewalkSide } = obj
   const showLeft  = sidewalkSide === 'both' || sidewalkSide === 'left'
   const showRight = sidewalkSide === 'both' || sidewalkSide === 'right'
   ```

2. Compute offsets (same formula as `StraightRoad`):
   ```tsx
   const shoulderOff = hw + shoulderWidth / 2
   const swOff = hw + (shoulderWidth > 0 ? shoulderWidth : 0) + sidewalkWidth / 2
   ```

3. Build shoulder lines (when `shoulderWidth > 0`):
   ```tsx
   const shoulderLines = shoulderWidth > 0 ? [
     <Line key={`${id}-sl`}
       points={buildOffsetSpine(spine, shoulderOff)}
       stroke="rgba(80,90,110,0.8)" strokeWidth={shoulderWidth}
       lineCap="round" lineJoin="round" listening={false} />,
     <Line key={`${id}-sr`}
       points={buildOffsetSpine(spine, -shoulderOff)}
       stroke="rgba(80,90,110,0.8)" strokeWidth={shoulderWidth}
       lineCap="round" lineJoin="round" listening={false} />,
   ] : []
   ```

4. Build sidewalk lines (when `sidewalkWidth > 0 && sidewalkSide`), same left/right logic as `StraightRoad`.

5. Render order (back to front, same as `StraightRoad`):
   ```tsx
   <Group listening={false}>
     {sidewalkLines}   {/* furthest back */}
     {shoulderLines}
     ... road body ...
   </Group>
   ```

### PolylineRoad spine note

For `PolylineRoad`, the spine used for shoulder/sidewalk is the de-duplicated control points array `pts` — the same sequence used for lane markings. When `smooth=true`, the Konva `tension` parameter curves the road body between control points; the shoulder offset from those same control points will approximate (but not exactly match) the true curved edge. This is acceptable: the approximation error is small for the control-point densities used in practice, and matching the exact Catmull-Rom offset would require a dedicated sampler.

---

## Files changed

| File | Change |
|---|---|
| `my-app/src/utils.ts` | Add `buildOffsetSpine(pts, d)` |
| `my-app/src/components/tcp/canvas/ObjectShapes.tsx` | Add shoulder/sidewalk to `PolylineRoad`, `CurveRoad`, `CubicBezierRoad` |
| `my-app/src/test/objectShapes.test.ts` | New test file: one test per road type verifying shoulder/sidewalk elements are rendered |

---

## Visual spec

The shoulder and sidewalk visuals must match `StraightRoad`:

| Layer | Color | Width |
|---|---|---|
| Shoulder | `rgba(80,90,110,0.8)` | `shoulderWidth` |
| Sidewalk fill | `rgba(200,195,185,0.6)` | `sidewalkWidth` |
| Sidewalk outer edge | `rgba(160,155,145,0.8)` | 1 px |

The `sidewalkSide` field controls which side(s) render:

| Value | Left | Right |
|---|---|---|
| `'both'` | ✓ | ✓ |
| `'left'` | ✓ | ✗ |
| `'right'` | ✗ | ✓ |
| `undefined` / unset | ✗ | ✗ |

---

## Acceptance checklist

- [ ] `buildOffsetSpine` unit-tested in isolation
- [ ] `PolylineRoad` with `shoulderWidth > 0` renders two shoulder `<Line>` elements
- [ ] `PolylineRoad` with `sidewalkWidth > 0` and `sidewalkSide='both'` renders four sidewalk `<Line>` elements (two fills + two edges)
- [ ] `CurveRoad` shoulder and sidewalk render correctly
- [ ] `CubicBezierRoad` shoulder and sidewalk render correctly
- [ ] When `shoulderWidth = 0` and `sidewalkWidth = 0`, no extra elements are rendered (no regression)
- [ ] `StraightRoadObject` rendering is unchanged (no regression)
- [ ] All existing tests pass
