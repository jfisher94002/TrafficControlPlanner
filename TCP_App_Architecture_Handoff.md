# Traffic Control Plan (TCP) Web App — Claude Code Handoff

## Project Summary

Building a web-based traffic control plan designer that competes with Invarion RapidPlan ($540-799/year) and AutoCAD ($2,000+/year). The goal is a more accessible, affordable, modern web-first tool targeting small-to-mid contractors, traffic engineers, and municipalities.

---

## Current Prototype Status

- **Framework:** Vite + React + TypeScript
- **Map layer:** OpenStreetMap tile API (no API key required)
- **Drawing layer:** react-konva (Konva.js) — 3-layer Stage (map tiles / world objects / drawing overlays)
- **Working features:**
  - Drag-and-drop objects on map (select, move, rotate, scale, delete)
  - Road drawing: straight, polyline, smooth (Catmull-Rom), and Bézier curve
  - MUTCD sign library + custom sign editor
  - Traffic control devices (cones, barrels, barriers, flaggers, etc.)
  - Work zone rectangles
  - Lane-closure taper tool (MUTCD-compliant auto-calculated length)
  - Text labels, directional arrows, distance measurements
  - North Arrow compass overlay
  - Manifest panel (live object count by type)
  - Undo / redo (Ctrl+Z / Ctrl+Shift+Z)
  - Address / intersection search (OpenStreetMap Nominatim)
  - **Save plan** — downloads `.tcp.json` file locally
  - **Load plan** — opens `.tcp.json` from disk
  - **Autosave** — plan state persisted to `localStorage` between sessions
  - Export to PNG (2× resolution)
  - Plan metadata: project number, client name, location, notes

---

## Agreed Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Frontend | React + TypeScript (Vite) | Implemented — main component in `traffic-control-planner.tsx` |
| Drawing engine | react-konva / Konva.js | Implemented — 3-layer Stage with pan/zoom transforms |
| Map layer | OpenStreetMap Nominatim + tile API | Implemented — address search + tile rendering |
| Backend API | FastAPI + Mangum on AWS Lambda | Planned — Python backend |
| Database | Aurora Serverless PostgreSQL + PostGIS | Planned — geospatial plan data |
| Auth | AWS Cognito (via Amplify) | Planned — user pools, JWT |
| File storage | AWS S3 (via Amplify) | Planned — plan JSON, exported PDFs, sign SVGs |
| PDF export | ReportLab on Lambda | Planned — server-side PDF generation |
| Payments | Stripe (webhook → Lambda) | Planned — subscription management |
| Infrastructure | AWS Amplify (frontend, auth, storage) + AWS SAM (Python Lambda API) | Planned — hybrid approach |
| CI/CD | Amplify auto-deploy from GitHub | Implemented |

### Infrastructure Note

Amplify handles frontend hosting, Cognito auth, and S3 storage. The FastAPI backend is deployed separately via AWS SAM (`template.yaml`) since Amplify doesn't natively scaffold Python Lambda APIs. They connect via API Gateway.

---

## Plan JSON Schema

```json
{
  "id": "uuid",
  "name": "Main St & 5th Ave - Lane Closure",
  "createdAt": "2026-02-16T10:30:00Z",
  "updatedAt": "2026-02-16T14:22:00Z",
  "userId": null,
  "mapCenter": { "lat": 37.7749, "lng": -122.4194, "zoom": 16 },
  "canvasOffset": { "x": 0, "y": 0 },
  "canvasZoom": 1,
  "canvasState": {
    "objects": [
      {
        "id": "abc123",
        "type": "sign",
        "x": 450,
        "y": 320,
        "rotation": 0,
        "scale": 1.0,
        "signData": { "id": "roadwork", "label": "⚠ ROAD WORK", "shape": "diamond", "color": "#f97316", "textColor": "#111" }
      },
      {
        "id": "def456",
        "type": "road",
        "x1": 100, "y1": 200, "x2": 500, "y2": 250,
        "lanes": 2, "width": 80, "realWidth": 22, "roadType": "2lane"
      },
      {
        "id": "ghi789",
        "type": "taper",
        "x": 300, "y": 400,
        "rotation": 45,
        "laneWidth": 12,
        "speed": 45,
        "taperLength": 495,
        "manualLength": false,
        "numLanes": 1
      }
    ]
  },
  "metadata": {
    "projectNumber": "2026-001",
    "client": "City of Springfield",
    "location": "Main St & 5th Ave",
    "notes": ""
  }
}
```

---

## Development Roadmap (Priority Order)

### Phase 1 — Core Save/Load + Auth
1. ✅ **Plan naming** — UI for naming/renaming plans
2. ✅ **Canvas serialization** — Serialize full canvas state to JSON (`.tcp.json`)
3. ✅ **Local save/load plans** — Browser download and file-open for plan JSON
4. ✅ **Autosave** — Plan state persisted to `localStorage` between sessions
5. ☐ **Cloud save/load plans** — S3 storage for plan JSON files
6. ☐ **User auth** — Cognito via Amplify (sign up, login, plan ownership)
7. ☐ **Plan list/dashboard** — Browse, open, delete saved plans

### Phase 2 — Export + Polish
6. **PDF export** — Canvas → high-quality PDF with title block, legend, scale
7. **Undo/redo** — Canvas state stack (critical UX for drawing tools)
8. **Deploy to Amplify** — Live URL for beta testers

### Phase 3 — Monetization
9. **Stripe integration** — Freemium model
   - Free: 3 plans/month, watermarked PDF
   - Pro ($25-35/mo): Unlimited plans, clean PDF/DXF export, full sign library
   - Team ($50-75/mo/seat): Collaboration, templates, compliance checking
10. **DXF/CAD export** — For AutoCAD interoperability

### Phase 4 — Differentiation
11. **AI-assisted sign placement** — Auto-suggest based on road type, speed, work zone
12. **MUTCD compliance checking** — Automated validation against standards
13. **Mobile/tablet optimization** — Field workers adjusting plans on-site
14. **Template marketplace** — Users share/sell common configurations

---

## Competitive Intelligence

### Invarion RapidPlan
- Market leader, 10,000+ US customers
- Desktop ($799/yr) and web ($540/yr) versions
- Key features: intersection builder, state-specific sign libraries, aerial imagery, DXF/DWG import/export, cloud collaboration
- Weakness: expensive for small shops, desktop version is Windows-only

### AutoCAD
- General-purpose CAD, ~$2,000+/year
- People use it for TCPs because it's what they have
- Weakness: massive overkill, steep learning curve, no TCP-specific tools

### Our Advantages
- Web-first, works on any device
- Significantly cheaper ($300-420/yr vs $540-799)
- Modern UX, lower learning curve
- AI features nobody else has (future)
- No desktop install required

---

## Key Technical Decisions Still Open

- **Canvas library migration:** Raw Canvas works now but may need Fabric.js/Konva.js for advanced features (grouping, undo/redo, snap-to-grid, rotation handles). Evaluate during Phase 2.
- **Offline support:** Service worker + IndexedDB for field use? Defer to Phase 4.
- **Real-time collaboration:** WebSocket via API Gateway? Defer to Phase 4.

