# Traffic Control Planner

A browser-based traffic control plan (TCP) diagramming tool built with React and HTML5 Canvas. Draw roads over a live map background, place signs and traffic control devices, and export your plan.

---

## Features

### Map Background
- Search for any address or intersection to load an OpenStreetMap tile background
- Roads drawn on the canvas are geo-referenced — they scale proportionally to the map at any zoom level

### Road Drawing
- **Straight roads** — click and drag to place a road segment
- **Polyline roads** — click to add points, double-click or press Enter to finish, Esc to cancel
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
| Arrow | A | Draw directional arrows |
| Text | T | Add text labels |
| Measure | M | Measure distances |
| Erase | E | Delete objects |

### Other
- Undo/Redo (Ctrl+Z / Ctrl+Shift+Z)
- Mini-map overview
- Property panel for editing selected objects (rotation, scale, colors)
- Export to PNG
- Zoom in/out with scroll wheel or toolbar buttons

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

---

## Project Structure

```
TrafficControlPlan/
└── my-app/                       # Vite + React app host
    ├── src/
    │   ├── traffic-control-planner.jsx   # Main component (all features)
    │   ├── App.jsx               # Mounts TrafficControlPlanner
    │   └── main.jsx
    └── package.json
```

---

## Stack
- [React 19](https://react.dev/) — UI and state management
- [Vite 7](https://vite.dev/) — dev server and bundler
- [react-konva](https://konvajs.org/docs/react/) — declarative canvas rendering
- [OpenStreetMap](https://www.openstreetmap.org/) tile server — map background
