# GitHub Copilot Code Review Instructions

## Project Overview
TCP Planner is a browser-based traffic control plan drawing tool. Users place roads, signs,
devices, and annotations on a zoomable/pannable canvas backed by real map tiles (OpenStreetMap).
Plans are saved/loaded as `.tcp.json` files. The app is deployed via AWS Amplify.

## Stack
- **React 19** with hooks (no Redux, no class components)
- **react-konva / Konva** for all canvas rendering — do not suggest switching back to raw Canvas 2D
- **Vite** build tool
- **No backend yet** — auth and cloud storage are planned (Phase 3), not present

## Architecture
All application code lives in a single file: `my-app/src/traffic-control-planner.jsx`.
This is intentional for the current prototype phase. Do not suggest splitting into many files
unless the file exceeds ~3,000 lines.

### Key patterns to understand before flagging issues:
- **3-layer Konva Stage**: Layer 1 = map tiles (screen-space), Layer 2 = world objects
  (pan+zoom transform), Layer 3 = drawing overlays (same transform as Layer 2)
- **`toWorld()`** converts screen coordinates to world coordinates using
  `stageRef.current.getPointerPosition()` — this is correct for Konva, not a bug
- **`e.evt.button` / `e.evt.deltaY`** — Konva wraps native events; `.evt` access is correct
- **Road overdraw**: roads are drawn as 3 stacked `<Line>` elements (border / white / surface)
  for a realistic road appearance — this is intentional, not redundant code
- **`tension={0.5}`** on smooth roads uses Konva's built-in Catmull-Rom spline — correct
- **`uid()`** generates IDs for canvas objects — simple enough for prototype scale

## Review Priorities

### Flag these:
- Security issues (XSS, unsafe `eval`, exposed secrets)
- Logic bugs in mouse event handlers (`handleMouseDown`, `handleMouseMove`, `handleMouseUp`)
- Incorrect zoom/pan math in `toWorld()` or `handleWheel()`
- Missing `useCallback`/`useMemo` dependencies that would cause stale closures
- State mutations (objects array must be treated as immutable)
- Accessibility regressions on panel UI controls
- Broken plan save/load JSON schema compatibility

### Don't flag these:
- The single-file architecture — intentional for prototype stage
- Inline styles — used throughout intentionally for this project
- Missing TypeScript — not planned for this phase
- Bundle size warning from Vite — known, acceptable for now
- `localStorage` usage for custom signs — intentional, documented behavior
- The `void mapRenderTick` line — intentional lint suppression

## Data Model
Canvas objects are plain JS objects stored in the `objects` array:
```js
// Road (straight)
{ id, type: "road", x1, y1, x2, y2, width, realWidth, lanes, roadType }

// Polyline / smooth road
{ id, type: "polyline_road", points: [{x,y}...], width, realWidth, lanes, roadType, smooth? }

// Bezier curve road
{ id, type: "curve_road", points: [{x,y}, controlPt, {x,y}], width, realWidth, lanes, roadType }

// Sign
{ id, type: "sign", x, y, signData: { label, shape, color, textColor }, rotation?, scale? }

// Device (cone, barrel, etc.)
{ id, type: "device", x, y, deviceId, rotation? }

// Work zone
{ id, type: "zone", x, y, w, h }

// Annotation
{ id, type: "arrow"|"measure"|"text", ... }
```

## Plan File Format (.tcp.json)
```json
{
  "id": "<uuid>",
  "name": "<plan title>",
  "createdAt": "<ISO date>",
  "updatedAt": "<ISO date>",
  "mapCenter": { "lat": 0, "lng": 0 },
  "canvasOffset": { "x": 0, "y": 0 },
  "canvasZoom": 1,
  "canvasState": { "objects": [] },
  "metadata": { "projectNumber": "", "client": "", "location": "", "notes": "" }
}
```
