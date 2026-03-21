# Copilot Instructions — Traffic Control Planner

## Project Overview

**Traffic Control Planner (TCP)** is a browser-based traffic control plan (TCP) diagramming tool. It lets users draw roads over a live OpenStreetMap tile background, place MUTCD signs and traffic control devices, and export the resulting plan as a PNG.

The goal is to compete with Invarion RapidPlan and AutoCAD at a significantly lower price point, with a modern web-first UX and future AI-assisted placement features. (Competitor pricing details are documented in `TCP_App_Architecture_Handoff.md` and may change over time.)

---

## Repository Structure

```
TrafficControlPlanner/           # repo root
├── .github/
│   ├── copilot-instructions.md  # this file
│   └── workflows/
│       └── code-review.yml      # CI: build + lint on push/PR to main or dev
├── my-app/                      # Vite + React + TypeScript application (all active code lives here)
│   ├── src/
│   │   ├── traffic-control-planner.tsx  # Main component (~2,300 lines) — ALL features
│   │   ├── types.ts                     # Shared TypeScript types (CanvasObject union, PlanMeta, etc.)
│   │   ├── utils.ts                     # Pure helper functions (uid, dist, geocodeAddress, etc.)
│   │   ├── App.tsx                      # Thin wrapper that mounts TrafficControlPlanner
│   │   ├── main.tsx                     # React entry point
│   │   ├── App.css
│   │   └── index.css
│   ├── src/test/
│   │   ├── planner.test.tsx             # UI integration tests (Vitest + React Testing Library)
│   │   ├── utils.test.ts                # Unit tests for utils.ts
│   │   └── setup.ts                     # Vitest global setup (mocks react-konva, localStorage)
│   ├── public/
│   ├── eslint.config.js         # ESLint flat-config (eslint 9)
│   ├── vite.config.ts           # Vite config with react-konva alias fixes
│   ├── vitest.config.ts         # Vitest configuration
│   ├── tsconfig.json            # TypeScript config
│   ├── index.html
│   └── package.json
├── amplify.yml                  # AWS Amplify build config (frontend hosting)
├── TCP_App_Architecture_Handoff.md  # Full product/architecture vision doc
├── README.md                    # User-facing feature overview
└── package-lock.json            # Root lock file (unused — app lock is in my-app/)
```

> **Important:** All development commands must be run from the `my-app/` subdirectory. There is no root-level build system.

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend framework | React | 19 |
| Language | TypeScript | 5 |
| Bundler / dev server | Vite | 7 |
| Canvas rendering | react-konva + konva | 19 / 10 |
| Map tiles | OpenStreetMap (no API key needed) | — |
| Testing | Vitest + React Testing Library | — |
| Linter | ESLint | 9 (flat config) |
| CI | GitHub Actions | — |
| Hosting | AWS Amplify (auto-deploy from GitHub) | — |

No backend, database, or authentication is implemented yet (see roadmap below).

---

## Development Commands

All commands run from the **`my-app/` directory**:

```bash
cd my-app

# Install dependencies
npm install          # or: npm ci  (used in CI)

# Start dev server (hot reload at http://localhost:5173)
npm run dev

# Production build (output: my-app/dist/)
npm run build

# Type-check only (no emit)
npm run typecheck

# Lint
npm run lint

# Run tests (single pass)
npm test

# Run tests in watch mode
npm run test:watch

# Preview production build locally
npm run preview
```

---

## Key Files

### `my-app/src/traffic-control-planner.tsx`
The entire application in one large React component (~2,300 lines). It contains:
- **Constants & data** at the top: `COLORS`, `SIGN_SHAPES`, `SIGN_CATEGORIES`, `DEVICES`, `ROAD_TYPES`, `TOOLS`
- **Sub-components**: `NorthArrow`, `ManifestPanel`, `PropertyPanel`, `SignEditorPanel`, tool-bar shapes
- **The main `TrafficControlPlanner` component** with all canvas interaction, tool state, and rendering

### `my-app/src/types.ts`
All shared TypeScript interfaces and type aliases: `CanvasObject` (discriminated union), `PlanMeta`, `MapCenter`, `RoadType`, `SignData`, `DeviceData`, `ToolDef`, and more.

### `my-app/src/utils.ts`
Pure helper functions extracted from the main component: `uid()`, `dist()`, `angleBetween()`, `geoRoadWidthPx()`, `snapToEndpoint()`, `sampleBezier()`, `distToPolyline()`, `geocodeAddress()`, `calcTaperLength()`, `cloneObject()`, and type-guard helpers.

### `my-app/vite.config.ts`
Contains React module aliases required to prevent duplicate React instances with react-konva. Do not remove these aliases:
```ts
resolve: {
  alias: {
    react: path.resolve(__dirname, 'node_modules/react'),
    'react/jsx-runtime': path.resolve(__dirname, 'node_modules/react/jsx-runtime.js'),
    'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
  },
},
```

Also sets `server.fs.allow: ['..']` so Vite can serve files from parent directories (needed for konva).

---

## Canvas Architecture

The canvas is rendered with **react-konva** (`Stage`, `Layer`, and shape primitives). The canvas coordinate system has an **origin offset** and **zoom** applied via a `<Group>` transform — all world-coordinate math must account for this.

Object types stored in state:

| Type | Description |
|------|-------------|
| `road` | Straight road segment (`x1, y1, x2, y2`, `roadType`) |
| `polyline_road` | Multi-point road (`points[]`, `roadType`, `smooth`) |
| `curve_road` | Quadratic Bézier road (`points[3]`, `roadType`) |
| `sign` | Sign placed on canvas (`x, y, rotation, scale, signData`) |
| `device` | Traffic control device (`x, y, rotation, deviceData`) |
| `zone` | Work zone rectangle (`x, y, w, h`) |
| `arrow` | Directional arrow (`x1, y1, x2, y2, color`) |
| `text` | Text label (`x, y, text, fontSize, bold, color`) |
| `measure` | Distance measurement line (`x1, y1, x2, y2`) |
| `taper` | Lane-closure taper (`x, y, rotation, laneWidth, speed, taperLength, numLanes`) |

---

## Tools & Keyboard Shortcuts

| Tool | Key | Description |
|------|-----|-------------|
| Select | V | Move / edit objects |
| Pan | H | Pan canvas |
| Road | R | Draw road segments |
| Sign | S | Place signs |
| Device | D | Place traffic control devices |
| Zone | Z | Draw work zone rectangles |
| Text | T | Add text labels |
| Measure | M | Measure distances |
| Arrow | A | Draw directional arrows |
| Taper | P | Draw lane-closure tapers (MUTCD-compliant length) |
| Erase | X | Delete objects |

Global shortcuts: `Ctrl+Z` undo, `Ctrl+Shift+Z` redo, `Escape` cancel current operation.

---

## ESLint Rules

The project uses ESLint 9 flat config (`eslint.config.js`). Key rule:

```js
'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }]
```

This means **SCREAMING_SNAKE_CASE constants are allowed to be declared unused** (they are treated as a library/data layer). However, camelCase variables that are unused will cause lint errors that will fail the CI build.

---

## CI / CD

### GitHub Actions (`code-review.yml`)
Runs on push or pull request to `main` or `dev`:
1. Checks out the code
2. Sets up Node 20
3. Runs `npm ci` in `my-app/`
4. Runs `npm run build` in `my-app/`

There is no separate lint step in CI — lint errors only fail the build if they also break compilation.

### AWS Amplify (`amplify.yml`)
Auto-deploys from GitHub on push:
1. `cd my-app && npm ci`
2. `npm run build`
3. Serves `my-app/dist/`

---

## Development Roadmap

### Phase 1 — Core Save/Load + Auth ✅ (local save/load complete)
- ✅ Plan naming UI
- ✅ Canvas serialization to JSON (`.tcp.json` format)
- ✅ Local save/load (browser download / file open)
- ✅ Autosave to `localStorage`
- ☐ Cloud save/load via AWS S3
- ☐ User auth via AWS Cognito (Amplify)
- ☐ Plan list / dashboard

### Phase 2 — Export + Polish
- PDF export (server-side via ReportLab on AWS Lambda)
- Undo/redo improvements
- Live Amplify deployment

### Phase 3 — Monetization
- Stripe integration (freemium: 3 plans/month free; Pro $25–35/mo; Team $50–75/mo)
- DXF/CAD export

### Phase 4 — Differentiation
- AI-assisted sign placement
- MUTCD compliance checking
- Mobile/tablet optimization
- Template marketplace

---

## Planned Backend Stack (not yet implemented)

| Layer | Technology |
|-------|-----------|
| Backend API | FastAPI + Mangum on AWS Lambda |
| Database | Aurora Serverless PostgreSQL + PostGIS |
| Auth | AWS Cognito via Amplify |
| File storage | AWS S3 via Amplify |
| PDF export | ReportLab on Lambda |
| Payments | Stripe |
| Infrastructure | AWS Amplify (frontend) + AWS SAM (Python Lambda API) |

---

## Known Issues / Workarounds

- **react-konva peer dependency:** react-konva requires exact React version alignment. The `vite.config.ts` aliases (`react`, `react/jsx-runtime`, `react-dom`) resolve duplicate React instance errors that would otherwise cause runtime failures. Do not remove or simplify these aliases.
- **Single large component:** `traffic-control-planner.tsx` intentionally contains all features in one file. Do not split it into sub-components without careful consideration of the shared state model.
- **`no-unused-vars` pattern:** The ESLint config suppresses warnings for uppercase-named variables (`varsIgnorePattern: '^[A-Z_]'`). When adding new data constants, follow the `SCREAMING_SNAKE_CASE` convention to avoid lint errors.
- **`void mapRenderTick`:** The `void` expression at the end of the render function is an intentional lint suppression to consume the `mapRenderTick` state variable (used only as a render trigger).
# GitHub Copilot Code Review Instructions

## Project Overview
TCP Planner is a browser-based traffic control plan drawing tool. Users place roads, signs,
devices, and annotations on a zoomable/pannable canvas backed by real map tiles (OpenStreetMap).
Plans are saved/loaded as `.tcp.json` files. The app is deployed via AWS Amplify.

## Stack
- **React 19** with hooks (no Redux, no class components)
- **TypeScript 5** — all source files are `.tsx` / `.ts`
- **react-konva / Konva** for all canvas rendering — do not suggest switching back to raw Canvas 2D
- **Vite** build tool
- **Vitest + React Testing Library** — tests live in `my-app/src/test/`
- **No backend yet** — auth and cloud storage are planned (Phase 3), not present

## Architecture
All application code lives in a single file: `my-app/src/traffic-control-planner.tsx`.
This is intentional for the current prototype phase. Do not suggest splitting into many files
unless the file exceeds ~3,000 lines.

Shared types live in `my-app/src/types.ts` and pure helpers in `my-app/src/utils.ts`.

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
- TypeScript type errors or unsafe `as` casts that bypass runtime safety

### Don't flag these:
- The single-file architecture — intentional for prototype stage
- Inline styles — used throughout intentionally for this project
- Bundle size warning from Vite — known, acceptable for now
- `localStorage` usage for autosave and custom signs — intentional, documented behavior
- The `void mapRenderTick` line — intentional lint suppression

## Data Model
Canvas objects are TypeScript-typed values stored in the `objects: CanvasObject[]` array
(see `my-app/src/types.ts` for the full discriminated union):
```ts
// Road (straight)
{ id, type: "road", x1, y1, x2, y2, width, realWidth, lanes, roadType }

// Polyline / smooth road
{ id, type: "polyline_road", points: [{x,y}...], width, realWidth, lanes, roadType, smooth }

// Bezier curve road
{ id, type: "curve_road", points: [{x,y}, controlPt, {x,y}], width, realWidth, lanes, roadType }

// Sign
{ id, type: "sign", x, y, signData: { label, shape, color, textColor }, rotation, scale }

// Device (cone, barrel, etc.)
{ id, type: "device", x, y, deviceData: { id, label, icon, color }, rotation }

// Work zone
{ id, type: "zone", x, y, w, h }

// Directional arrow
{ id, type: "arrow", x1, y1, x2, y2, color }

// Text label
{ id, type: "text", x, y, text, fontSize, bold, color }

// Distance measurement
{ id, type: "measure", x1, y1, x2, y2 }

// Lane-closure taper
{ id, type: "taper", x, y, rotation, laneWidth, speed, taperLength, manualLength, numLanes }
```

## Plan File Format (.tcp.json)
```json
{
  "id": "<uuid>",
  "name": "<plan title>",
  "createdAt": "<ISO date>",
  "updatedAt": "<ISO date>",
  "userId": null,
  "mapCenter": { "lat": 0, "lng": 0, "zoom": 16 },
  "canvasOffset": { "x": 0, "y": 0 },
  "canvasZoom": 1,
  "canvasState": { "objects": [] },
  "metadata": { "projectNumber": "", "client": "", "location": "", "notes": "" }
}
```

> **Note:** `mapCenter.lng` is used in the file format; the internal `MapCenter` type uses `lon`.
> The `loadPlan` / `savePlan` functions map between the two.
