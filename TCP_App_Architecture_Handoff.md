# Traffic Control Plan (TCP) Web App — Claude Code Handoff

## Project Summary

Building a web-based traffic control plan designer that competes with Invarion RapidPlan ($540-799/year) and AutoCAD ($2,000+/year). The goal is a more accessible, affordable, modern web-first tool targeting small-to-mid contractors, traffic engineers, and municipalities.

---

## Current Prototype Status

- **Framework:** Vite + React
- **Map layer:** OpenMap API (aerial/street imagery)
- **Drawing layer:** Raw HTML Canvas
- **Working features:**
  - Drag-and-drop objects on map
  - Road/lane drawing tools
  - MUTCD sign library

---

## Agreed Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Frontend | React + TypeScript (Vite) | Already in place |
| Drawing engine | Raw HTML Canvas | Currently working; consider migrating to Fabric.js/Konva.js later for undo/redo, grouping, multi-select |
| Map layer | OpenMap API | Already in place |
| Backend API | FastAPI + Mangum on AWS Lambda | Python backend |
| Database | Aurora Serverless PostgreSQL + PostGIS | Geospatial plan data |
| Auth | AWS Cognito (via Amplify) | User pools, JWT |
| File storage | AWS S3 (via Amplify) | Plan JSON, exported PDFs, sign SVGs |
| PDF export | ReportLab on Lambda | Server-side PDF generation |
| Payments | Stripe (webhook → Lambda) | Subscription management |
| Infrastructure | AWS Amplify (frontend, auth, storage) + AWS SAM (Python Lambda API) | Hybrid approach |
| CI/CD | Amplify auto-deploy from GitHub | |

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
  "userId": "cognito-user-id",
  "mapCenter": { "lat": 37.7749, "lng": -122.4194 },
  "mapZoom": 17,
  "canvasState": {
    "objects": [
      {
        "type": "sign",
        "mutcdCode": "W20-1",
        "label": "Road Work Ahead",
        "x": 450,
        "y": 320,
        "rotation": 0,
        "scale": 1.0
      },
      {
        "type": "road",
        "points": [[100, 200], [300, 200], [500, 250]],
        "laneCount": 2,
        "width": 24
      }
    ]
  },
  "metadata": {
    "projectNumber": "",
    "client": "",
    "location": "",
    "notes": ""
  }
}
```

---

## Development Roadmap (Priority Order)

### Phase 1 — Core Save/Load + Auth
1. **Plan naming** — UI for naming/renaming plans
2. **Canvas serialization** — Serialize full canvas state to JSON
3. **Save/load plans** — S3 storage for plan JSON files
4. **User auth** — Cognito via Amplify (sign up, login, plan ownership)
5. **Plan list/dashboard** — Browse, open, delete saved plans

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

