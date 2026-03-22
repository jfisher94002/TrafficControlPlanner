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
├── my-app/                      # Vite + React application (all active code lives here)
│   ├── src/
│   │   ├── traffic-control-planner.jsx  # Main component (~1,956 lines) — ALL features
│   │   ├── App.jsx                      # Thin wrapper that mounts TrafficControlPlanner
│   │   ├── main.jsx                     # React entry point
│   │   ├── App.css
│   │   └── index.css
│   ├── public/
│   ├── eslint.config.js         # ESLint flat-config (eslint 9)
│   ├── vite.config.js           # Vite config with react-konva alias fixes
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
| Bundler / dev server | Vite | 7 |
| Canvas rendering | react-konva + konva | 19 / 10 |
| Map tiles | OpenStreetMap (no API key needed) | — |
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

# Lint
npm run lint

# Preview production build locally
npm run preview
```

---

## Key Files

### `my-app/src/traffic-control-planner.jsx`
The entire application in one large React component (~1,956 lines). It contains:
- **Constants & data** at the top: `COLORS`, `SIGN_SHAPES`, `SIGN_CATEGORIES`, `DEVICES`, `ROAD_TYPES`, `TOOLS`
- **Helper functions**: `uid()`, `dist()`, `angleBetween()`, `snapToEndpoint()`, `sampleBezier()`, `distToSegment()`, `distToPolyline()`
- **The main `TrafficControlPlanner` component** with all canvas interaction, tool state, and rendering

### `my-app/vite.config.js`
Contains React module aliases required to prevent duplicate React instances with react-konva. Do not remove these aliases:
```js
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
| `polyline_road` | Multi-point road (`points[]`, `roadType`) |
| `curve_road` | Quadratic Bézier road (`points[3]`, `roadType`) |
| `sign` | Sign placed on canvas (`x, y, rotation, scale, signData`) |
| `device` | Traffic control device (`x, y, rotation, scale, deviceData`) |
| `zone` | Work zone rectangle (`x, y, width, height, rotation`) |
| `arrow` | Directional arrow (`x1, y1, x2, y2`) |
| `text` | Text label (`x, y, text, fontSize`) |

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
| Arrow | A | Draw directional arrows |
| Text | T | Add text labels |
| Measure | M | Measure distances |
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

### Phase 1 — Core Save/Load + Auth (next priority)
- Plan naming UI
- Canvas serialization to JSON (see schema in `TCP_App_Architecture_Handoff.md`)
- Save/load via AWS S3
- User auth via AWS Cognito (Amplify)
- Plan list / dashboard

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

- **react-konva peer dependency:** react-konva requires exact React version alignment. The `vite.config.js` aliases (`react`, `react/jsx-runtime`, `react-dom`) resolve duplicate React instance errors that would otherwise cause runtime failures. Do not remove or simplify these aliases.
- **No test suite:** There are currently no unit or integration tests. Do not add a testing framework unless explicitly requested. Validate changes manually with `npm run dev`.
- **Single large component:** `traffic-control-planner.jsx` intentionally contains all features in one file. Do not split it into sub-components without careful consideration of the shared state model.
- **`no-unused-vars` pattern:** The ESLint config suppresses warnings for uppercase-named variables (`varsIgnorePattern: '^[A-Z_]'`). When adding new data constants, follow the `SCREAMING_SNAKE_CASE` convention to avoid lint errors.
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
