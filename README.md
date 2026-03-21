# Traffic Control Planner

A browser-based traffic control plan (TCP) diagramming tool built with React and TypeScript. Draw roads over a live map background, place MUTCD signs and traffic control devices, and export your plan.

---

## Features

### Map Background
- Search for any address or intersection to load an OpenStreetMap tile background
- Roads drawn on the canvas are geo-referenced — they scale proportionally to the map at any zoom level

### Road Drawing
- **Straight roads** — click and drag to place a road segment
- **Polyline roads** — click to add points, double-click or press Enter to finish, Esc to cancel
- **Smooth roads** — polyline with Catmull-Rom spline smoothing
- **Curved roads** — 3-click quadratic Bézier (start → control point → end)
- **Snap to endpoints** — new roads snap to the endpoints of existing roads for clean connections
- Road types: 2-Lane, 4-Lane, 6-Lane Divided, Highway

### Sign Editor
- **Library tab** — pre-built regulatory, warning, and informational signs
- **Editor tab** — create custom signs: choose shape (diamond, rectangle, octagon, circle, triangle, shield), enter text, pick background and text colors, live preview before placing

### Traffic Control Devices
- Cones, barrels, barriers, arrow boards, message boards, flaggers, and more
- Place and rotate any device on the canvas

### Canvas Tools
| Tool | Shortcut | Description |
|------|----------|-------------|
| Select | V | Move and edit placed objects |
| Pan | H | Pan the canvas |
| Road | R | Draw road segments |
| Sign | S | Place signs |
| Device | D | Place traffic control devices |
| Zone | Z | Draw work zone rectangles |
| Text | T | Add text labels |
| Measure | M | Measure distances |
| Arrow | A | Draw directional arrows |
| Taper | P | Draw lane-closure tapers (MUTCD-compliant length) |
| Erase | X | Delete objects |

### Plan Management
- **Save** — download the current plan as a `.tcp.json` file
- **Load** — open a previously saved `.tcp.json` file
- **New** — start a fresh plan (with unsaved-change confirmation)
- **Autosave** — plan state is automatically saved to `localStorage` between sessions
- **Plan metadata** — record project number, client, location, and notes in the Properties panel

### Other
- Undo/Redo (Ctrl+Z / Ctrl+Shift+Z)
- North Arrow compass overlay (togglable)
- Manifest panel — live count of all objects on the canvas broken down by type
- Property panel for editing selected objects (rotation, scale, colors, taper parameters)
- Export to PNG (2× resolution)
- Zoom in/out with scroll wheel or toolbar buttons
- Address/intersection search powered by OpenStreetMap Nominatim

---

## Getting Started

### Prerequisites
- Node.js 18+

### Install & Run

```bash
cd my-app
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Build for Production

```bash
cd my-app
npm run build
```

### Run Tests

```bash
cd my-app
npm test
```

---

## Project Structure

```
TrafficControlPlanner/
└── my-app/                       # Vite + React + TypeScript app
    ├── src/
    │   ├── traffic-control-planner.tsx  # Main component (all features)
    │   ├── types.ts                     # Shared TypeScript types
    │   ├── utils.ts                     # Pure helper functions
    │   ├── App.tsx                      # Mounts TrafficControlPlanner
    │   ├── main.tsx                     # React entry point
    │   └── test/
    │       ├── planner.test.tsx         # UI integration tests
    │       ├── utils.test.ts            # Unit tests for utils
    │       └── setup.ts                 # Vitest/Testing Library setup
    ├── vite.config.ts
    ├── vitest.config.ts
    └── package.json
```

---

## Stack
- [React 19](https://react.dev/) — UI and state management
- [TypeScript 5](https://www.typescriptlang.org/) — static typing
- [Vite 7](https://vite.dev/) — dev server and bundler
- [react-konva](https://konvajs.org/docs/react/) — declarative canvas rendering
- [OpenStreetMap](https://www.openstreetmap.org/) tile server — map background
- [Vitest](https://vitest.dev/) + [React Testing Library](https://testing-library.com/) — unit and integration tests
