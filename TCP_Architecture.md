# Traffic Control Planner (TCP) — System Architecture

**Status:** Living document  
**Document version:** 1.0.1  
**Product release described:** v0.3.0 (deployed app and “current” architecture in §2–§3.1; Phase 4 is target, not shipped)  
**Last updated:** April 10, 2026  
**Author:** Jonathan Fisher  
**Repository:** https://github.com/jfisher94002/TrafficControlPlanner

This file uses **document versioning** (semver below), independent of **app / npm / git tag** versions. Bump **Document version** when this architecture changes; bump or note **Product release described** when §2’s “what is live” materially changes.

---

## 1. What This Is

TCP is a web-based traffic control plan designer targeting small-to-mid contractors, traffic engineers, and municipalities. It competes directly with Invarion RapidPlan ($540–799/yr) and AutoCAD ($2,000+/yr) by being web-first, significantly cheaper ($300–420/yr projected), and eventually AI-assisted.

Every US construction project on a public road legally requires an approved TCP before work begins. The addressable market is 50,000–100,000 software seats in the US ($50–100M TAM).

---

## 2. Current State (v0.3.0 — April 2026)

**The codebase is significantly more advanced than the February 2026 planning documents reflect.** As of v0.3.0, the following are fully functional and deployed: Konva-based canvas engine, 180+ MUTCD signs, AWS Cognito auth, S3 cloud save, PDF export via Lambda, plan dashboard, QC compliance rules, cubic Bezier roads, geo-referenced drawing, and PostHog analytics. The project is in production beta, not prototype.

Frontend source: ~556 KB. Backend source: ~704 KB. Main component (`traffic-control-planner.tsx`): ~3,698 lines (static sign/device/tool catalogs live under `my-app/src/features/tcp/`).

### What Is Built

**Drawing Engine (React-Konva)**

| Feature | Status | Notes |
|---------|--------|-------|
| Drag-and-drop canvas | Done | Layer-based Konva architecture |
| Straight roads | Done | Click-drag with shoulder/sidewalk rendering |
| Polyline roads | Done | Click to add points, double-click to finish |
| Curved roads (quadratic) | Done | 3-click mode |
| Cubic Bezier roads | Done | 4-point control with draggable handles |
| Intersection builder | Done | T and 4-way presets |
| Lane closure taper | Done | MUTCD formula: L = W×S²/60 (≤45mph), L = W×S (>45mph) |
| Lane mask / removal | Done | Hatch or solid overlay with rotation |
| Crosswalk | Done | Striped, configurable stripe count and depth |
| Turn lane | Done | Taper + run section with directional arrows |
| Work zone rectangle | Done | |
| Traffic arrows | Done | Directional arrow shapes |
| Text labels | Done | |
| Measurement tool | Done | Haversine distance calc |
| Snap-to-endpoints | Done | 14px screen-pixel radius |
| Undo / redo | Done | Full history stack |
| Pan and zoom | Done | 0.1× to 5×, scroll or toolbar |
| Mini-map | Done | Canvas overview |
| Object property panel | Done | Rotation, scale, colors |
| Road shoulders | Done (straight only) | Data model exists on all road types; rendering TODO for polyline/curve/cubic |
| Sidewalks | Done (straight only) | Same as above |

**Signs and Devices**

| Feature | Status | Notes |
|---------|--------|-------|
| MUTCD sign library | Done — 180+ signs | Regulatory, Warning, TTC, Guide, School Zone, Bike/Ped categories |
| 87 pre-rendered SVG sign assets | Done | Stored in backend/signs/ and S3 |
| Custom sign creator | Done | Pick shape, colors, text with live preview |
| Traffic control devices (10) | Done | Cones, barrels, barriers, arrow boards, message boards, flaggers, temp signals, crash cushions, water barrels |

**Map Layer**

| Feature | Status | Notes |
|---------|--------|-------|
| OpenStreetMap tile integration | Done | |
| Address geocoding | Done | Search address → auto-load map at 17× zoom |
| Geo-referenced roads | Done | Road width scales to actual meters based on map zoom |
| Map tile caching | Done | HTMLImageElement cache for performance |
| 5 map tile providers | Done | OSM, Esri, CartoDB, etc. |
| Map opacity control | Done | |

**Auth and Data**

| Feature | Status | Notes |
|---------|--------|-------|
| AWS Cognito auth (sign-up, login, sign-out) | Done | JWT with refresh token revocation (server-side) |
| Cloud save (S3) | Done | `plans/{userId}/{planId}.tcp.json` |
| Plan schema versioning | Done | `PLAN_SCHEMA_VERSION = 1` |
| Local autosave | Done | localStorage fallback (`tcp_autosave`) |
| Plan dashboard | Done | List, open, delete saved plans |
| Plan metadata | Done | Project number, client, location, notes, timestamps |

**Export**

| Feature | Status | Notes |
|---------|--------|-------|
| PNG export | Done | Canvas toBlob() via Konva |
| PDF export | Done | FastAPI Lambda + ReportLab; title block, canvas image, sign legend |
| Export preview modal | Done | Preview before downloading |
| DXF/CAD export | Not built | Planned Phase 4, Pro tier |

**Quality Control**

| Feature | Status | Notes |
|---------|--------|-------|
| Taper length validation | Done | Warns if shorter than MUTCD formula |
| Advance warning sign check | Done | Checks for warning signs near work zones |
| Flagger consistency check | Done | Warns if flagger sign placed without flagger device |
| QC panel | Done | Shows issues with severity (error/warning/info) |

**Other**

| Feature | Status | Notes |
|---------|--------|-------|
| Dark theme | Done | |
| Keyboard shortcuts (10) | Done | |
| Pre-built TCP templates | Done | v0.3.0 — sharing/selling not implemented |
| PostHog analytics | Done | Session, object placement, export, plan save events |
| E2E tests (Playwright) | Done | 10 spec files: auth, canvas, export, plan management, QC |
| Unit tests (Vitest) | Done | 20+ test files |
| Backend tests (pytest) | Done | PDF generation, API, sanitization, sign generation |

---

## 3. System Architecture

### 3.1 Current Architecture (v0.3.0 — Live)

```
┌────────────────────────────────────────────────────────────┐
│                     Browser (Client)                       │
│                                                            │
│  React 19 + TypeScript (Vite 7)                            │
│                                                            │
│  ┌──────────────┐  ┌─────────────────────────────────┐    │
│  │  Map Layer   │  │       Drawing Layer              │    │
│  │  OpenMap API │  │       React-Konva / Konva 10     │    │
│  │  (tile imgs, │  │  (roads, signs, devices, tapers, │    │
│  │   geocoding) │  │   crosswalks, turn lanes, masks) │    │
│  └──────────────┘  └─────────────────────────────────┘    │
│                                                            │
│  ┌───────────────────────────────────────────────────┐    │
│  │  AWS Amplify Auth (Cognito JWT)                   │    │
│  │  AWS Amplify Storage (S3 plan files)              │    │
│  │  PostHog Analytics                                │    │
│  └───────────────────────────────────────────────────┘    │
└────────────────────────────────────────────────────────────┘
         │ HTTPS
         ▼
┌────────────────────────────┐
│  API Gateway (HTTP API)    │
└────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────────────────────────┐
│             AWS Lambda (FastAPI + Mangum)                  │
│                                                            │
│  POST /export-pdf   →  ReportLab PDF generation            │
│  POST /create-issue →  GitHub issue creation (feedback)    │
│  GET  /health       →  Health check                        │
└────────────────────────────────────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────────────────────────┐
│               Data Layer                                   │
│                                                            │
│  ┌──────────────────────────┐  ┌────────────────────────┐ │
│  │  AWS Cognito             │  │  S3 Buckets             │ │
│  │  User Pools              │  │                         │ │
│  │  JWT + Refresh tokens    │  │  /plans/{userId}/       │ │
│  │  Server-side revocation  │  │  /signs/ (87 SVGs)      │ │
│  └──────────────────────────┘  │  /templates/            │ │
│                                └────────────────────────┘ │
│  ┌──────────────────────────┐                             │
│  │  Browser localStorage   │                              │
│  │  (autosave fallback)    │                              │
│  └──────────────────────────┘                             │
└────────────────────────────────────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────────────────────────┐
│            Static Hosting                                  │
│  Amplify → CloudFront CDN → S3 (static assets)             │
│  CI/CD: Amplify auto-deploy from GitHub                    │
└────────────────────────────────────────────────────────────┘
```

### 3.2 Target Architecture (Public Launch — Phase 4)

The Phase 4 additions are: managed **PostgreSQL + PostGIS** (default launch: **Amazon RDS** small instance; **Aurora Serverless v2** optional when scale/ops justify it), plan metadata, tenants/teams, comments in plan space, permissions, Stripe webhook → Postgres entitlements, separate export/webhook Lambdas, AWS WAF, and real-time collaboration (post-launch). Everything else is already live.

```
[Current v0.3.0 architecture — as above]
         +
┌────────────────────────────────────────────────────────────┐
│  New in Phase 4 (see §4, §6.2, §11)                        │
│                                                            │
│  AWS WAF → API Gateway (rate limits; payload caps)         │
│                                                            │
│  RDS PostgreSQL + PostGIS (launch default)                   │
│  Aurora Serverless v2 optional — not v1 scale-to-zero      │
│  - tenants, team_members, plans (metadata, geo index)      │
│  - comments: plan_space x/y (meters), not canvas pixels     │
│  - stripe_events (idempotency), plan_shares (link tokens)   │
│                                                            │
│  Stripe → Lambda (tcp-stripe-webhook)                      │
│  - subscription events → Postgres users.tier (authoritative) │
│  - Cognito = identity / JWT only (no tier in attributes)    │
│                                                            │
│  Lambdas: tcp-api, tcp-export-pdf, tcp-export-dxf,          │
│  tcp-stripe-webhook + shared lib (§6.2)                    │
└────────────────────────────────────────────────────────────┘
```

---

## 4. Tech Stack

| Layer | Technology | Status | Notes |
|-------|-----------|--------|-------|
| Frontend | React 19 + TypeScript (Vite 7) | Live | |
| Drawing engine | Konva 10 / React-Konva 19 | Live | Already migrated — not raw Canvas |
| Map layer | OpenMap API | Live | Google Maps as Pro add-on (future) |
| Backend API | FastAPI + Mangum on AWS Lambda | Live | Currently one function; target is 4 separate handlers (see §6.2, §10) |
| PDF generation | ReportLab on Lambda | Live | Title block, canvas image, sign legend |
| Sign asset storage | AWS S3 | Live | 87 SVG files, CORS-enabled |
| Infrastructure-as-Code | AWS SAM | Live | Lambda, HTTP API Gateway, S3, SES |
| Authentication | AWS Cognito (via Amplify) | Live | JWT for identity only — entitlement/tier lives in Postgres (Phase 4) |
| Cloud plan storage | AWS S3 tenant-prefix | Live | Current: `plans/{userId}/...` — Phase 4 target: `plans/{tenantId}/...` |
| Analytics | PostHog | Live | Env-gated via `VITE_POSTHOG_KEY` |
| CI/CD | Amplify auto-deploy from GitHub | Live | Frontend; backend via AWS SAM |
| WAF / rate limiting | AWS WAF | Phase 4 | Required before public launch; unauthenticated endpoints currently unprotected |
| Database | Amazon RDS for PostgreSQL + PostGIS | Phase 4 | **Default launch DB: RDS Postgres (small instance) + PostGIS; Aurora Serverless v2 when scale/ops justify it.** Do not use Aurora v1 scale-to-zero on the request path. |
| Payments | Stripe + Lambda webhook | Phase 4 | Tier authoritative in Postgres `users` table; Cognito is identity only |
| DXF export | ezdxf on Lambda | Phase 4 | Pro tier only; separate Lambda from API (different memory/timeout profile) |

---

## 5. Data Model

### 5.1 Plan JSON Schema (current — schema version 1)

```json
{
  "id": "uuid",
  "name": "Main St & 5th Ave - Lane Closure",
  "createdAt": "2026-02-16T10:30:00Z",
  "updatedAt": "2026-02-16T14:22:00Z",
  "userId": "cognito-user-id",
  "schemaVersion": 1,
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
        "subtype": "cubic",
        "points": [[100, 200], [200, 150], [350, 250], [500, 200]],
        "laneCount": 2,
        "width": 24,
        "shoulder": { "left": 6, "right": 6 },
        "sidewalk": false
      },
      {
        "type": "taper",
        "speed": 45,
        "laneWidth": 12,
        "direction": "left"
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

**On-disk today this is schema v1:** `canvasState.objects` use **Konva pixel coordinates** relative to the stage. **Schema v2** (Phase 4) adds `geoContext` (§5.2) and persists object geometry in **plan space (meters)**; migration and round-trip tests are defined in §15.

S3 path (current): `plans/{userId}/{planId}.tcp.json`
S3 path (Phase 4 target): `plans/{tenantId}/{planId}.tcp.json`

The key change from `userId` to `tenantId` is intentional. For solo users `tenantId == userId`. For team plans `tenantId == teamId`. This avoids duplicating objects on share and keeps IAM prefix policies clean. Sharing is a row in `plan_shares`, not a second S3 copy. The migration requires a one-time S3 key rename and a backfill of the Postgres metadata table.

### 5.2 Plan JSON — GeoContext field (add to schema version 2)

The `geoContext` block must be stored in every plan to support DXF export, AI sign placement, and collaboration. All canvas object coordinates are in plan space (meters from origin), not raw Konva pixels. The render layer converts plan space → screen pixels using `ViewportState` at display time.

**`crs` (canonical):** Store `"EPSG:3857"` (Web Mercator). TCP’s map stack matches typical slippy tiles; `planToGeo` / `geoToPlan` (§15) use this projection for stable meter-scale math. **`mapCenter`** remains **WGS84** lat/lng for map display and for PostGIS `GEOGRAPHY` fields — do not confuse geographic degrees with `crs`.

```json
{
  "geoContext": {
    "mapCenter": { "lat": 37.7749, "lng": -122.4194 },
    "mapZoom": 17,
    "groundResolutionMetersPerPx": 0.596,
    "originCanvasPx": { "x": 512, "y": 384 },
    "crs": "EPSG:3857"
  }
}
```

See §15 for the full coordinate bridge design.

### 5.3 PostgreSQL database schema (Phase 4)

```sql
-- Users: Cognito = identity. Postgres = entitlement/app data.
-- NEVER store tier in Cognito custom attributes for business logic.
CREATE TABLE users (
  id           UUID PRIMARY KEY,
  cognito_id   VARCHAR(255) UNIQUE NOT NULL,
  email        VARCHAR(255) NOT NULL,
  tier         VARCHAR(20) DEFAULT 'free',  -- free | pro | team — authoritative here
  stripe_customer_id VARCHAR(255),
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Stripe events log — idempotency, audit, replay
CREATE TABLE stripe_events (
  stripe_event_id  VARCHAR(255) PRIMARY KEY,
  event_type       VARCHAR(100) NOT NULL,
  processed_at     TIMESTAMPTZ DEFAULT NOW(),
  payload          JSONB
);

-- Tenants: either a solo user or a team
CREATE TABLE tenants (
  id         UUID PRIMARY KEY,
  type       VARCHAR(10) NOT NULL,  -- 'user' | 'team'
  name       VARCHAR(255) NOT NULL,
  owner_id   UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Plans metadata (plan JSON lives in S3; this is the index)
CREATE TABLE plans (
  id            UUID PRIMARY KEY,
  tenant_id     UUID REFERENCES tenants(id),  -- not user_id — tenant owns the plan
  name          VARCHAR(255) NOT NULL,
  s3_key        VARCHAR(512) NOT NULL,         -- plans/{tenantId}/{planId}.tcp.json
  thumbnail_key VARCHAR(512),
  location      GEOGRAPHY(POINT, 4326),        -- centroid for map display
  work_area     GEOGRAPHY(POLYGON, 4326),      -- bounding box for corridor queries
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Plan sharing (read-only links, no S3 duplication)
CREATE TABLE plan_shares (
  id         UUID PRIMARY KEY,
  plan_id    UUID REFERENCES plans(id),
  token      VARCHAR(64) UNIQUE NOT NULL,  -- random, URL-safe
  expires_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Team memberships
CREATE TABLE team_members (
  tenant_id UUID REFERENCES tenants(id),
  user_id   UUID REFERENCES users(id),
  role      VARCHAR(20) DEFAULT 'member',  -- owner | admin | member
  PRIMARY KEY (tenant_id, user_id)
);

-- Comments: stored in plan space (meters), NOT Konva pixel coords
-- Pixel coords break on zoom/pan/resize. Plan space is stable.
CREATE TABLE comments (
  id             UUID PRIMARY KEY,
  plan_id        UUID REFERENCES plans(id),
  user_id        UUID REFERENCES users(id),
  plan_space_x   FLOAT NOT NULL,  -- meters from plan origin
  plan_space_y   FLOAT NOT NULL,  -- meters from plan origin
  body           TEXT NOT NULL,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 6. Backend API Reference

### 6.1 Current (single Lambda — live)

| Method | Path | Purpose | Auth | Risk |
|--------|------|---------|------|------|
| POST | /export-pdf | PDF generation via ReportLab | None | **Unauthenticated CPU-heavy endpoint — abuse vector. Add WAF before public launch.** |
| POST | /create-issue | GitHub issue creation for feedback | None | Rate-limited by `submitter_id` |
| GET | /health | Health check | None | |

### 6.2 Target Lambda Split (Phase 4)

Running PDF export, plan CRUD, Stripe webhooks, and DXF export in one function creates conflicting memory/timeout/concurrency requirements. The target is four separate handlers sharing a common library:

| Lambda | Routes | Memory | Timeout | Notes |
|--------|--------|--------|---------|-------|
| `tcp-api` | `/plans`, `/teams`, `/users`, `/health` | 256 MB | 10s | CRUD operations; fast path |
| `tcp-export-pdf` | `POST /export-pdf` | 512 MB | 30s | CPU-heavy ReportLab; require Cognito JWT |
| `tcp-export-dxf` | `POST /export-dxf` | 512 MB | 60s | CPU-heavy ezdxf; Pro tier only |
| `tcp-stripe-webhook` | `POST /stripe/webhook` | 256 MB | 10s | Must return 200 quickly; idempotency via `stripe_events` table |

Shared library: domain types, auth helpers, Stripe idempotency store, DB connection pool. Each Lambda is a separate SAM function pointing to its own handler entrypoint.

---

## 7. Phased Completion Status

### Phase 0 — Prototype (Complete)
All originally planned prototype features are done, plus significant bonus work (Konva migration, cubic Bezier, geo-referencing, PostHog).

### Phase 1 — MVP (Substantially Complete)
PDF export with title block, 87+ SVG sign assets on S3, Lambda infrastructure, plan naming and metadata, copy/paste, north arrow, object properties panel — all done. The 80+ sign expansion target is met (180+ signs). Taper tool is done.

### Phase 2 — Realistic Roads (Complete)
Cubic Bezier roads with control handles, intersection builder (T and 4-way), turn lanes, road shoulders, sidewalks (straight roads only — rendering TODO for other road types), crosswalks, lane masking — all done.

**One open item:** Shoulder and sidewalk rendering on polyline, curve, and cubic Bezier road types. The data model is in place; the draw routines haven't been updated. This is the highest-priority drawing debt.

### Phase 3 — Standards Compliance (Partially Complete)
QC rules engine is live. 180+ MUTCD signs covers most of the 200+ target. Templates implemented.

**What remains:** Full 200+ sign library. MUTCD taper auto-channelization (full work zone auto-placement). Sign spacing calculator overlay (MUTCD Table 6H-3).

### Phase 4 — Collaboration and Monetization (Not started)
RDS PostgreSQL + PostGIS (Aurora v2 optional), Stripe integration, freemium gating, DXF export, plan sharing links, team collaboration, commenting on plans.

**Key note:** Cloud save is already live (S3 via Amplify), which clears the original hard gate before charging money.

---

## 8. Release Readiness

| Milestone | Gate | Current Status |
|-----------|------|----------------|
| **Alpha** | PDF export, 80+ signs, save/load, taper tool | All done. Alpha can release now. |
| **Beta** | 200+ signs, intersection editor, MUTCD templates, taper auto-calc | ~85% done. Remaining: shoulder/sidewalk rendering on non-straight roads, ~20 more signs, taper auto-channelization, sign spacing overlay. |
| **Public Launch** | Auth + cloud save + Stripe live, freemium limits, plan dashboard | Auth done, cloud save done, dashboard done. Only Stripe + freemium gating + managed Postgres (RDS + PostGIS) remain as hard blockers. |

---

## 9. Subscription Model

| Tier | Price | Limits | Key Features |
|------|-------|--------|--------------|
| Free | $0 | 2 plans/month, watermarked PDF | Core drawing tools, 180+ signs |
| Pro | $25–35/mo | Unlimited plans | Clean PDF/PNG export, DXF export, Google Maps, no watermark |
| Team | $50–75/mo/seat | Unlimited plans | Everything in Pro + shared plan library, team collaboration, commenting |

Annual equivalent: ~$300–420/yr vs Invarion at $540–799/yr.

---

## 10. Open Technical Decisions

### Shoulder/Sidewalk Rendering on Non-Straight Roads (Active Debt)
The data model is defined on all road types. Rendering for straight roads is complete. The same logic needs to be applied to `PolylineRoadObject`, `CurveRoadObject`, and `CubicBezierRoadObject`. Highest-priority drawing debt before Beta.

### Database: RDS PostgreSQL + PostGIS at launch (Aurora v2 optional later)
**Default launch DB:** RDS Postgres (**small instance**, e.g. `db.t4g.micro` in a region/engine where **PostGIS** is supported) + PostGIS — predictable cost, no cold start, straightforward ops. **Aurora Serverless v2** when elastic scale or team process justify the higher baseline versus a fixed small instance. **Do not** use **Aurora Serverless v1** with scale-to-zero on dashboard, plan list, team metadata, or any user-facing hot path — resume latency (often many seconds) is unacceptable; keep-warm pings are a band-aid.

At ~2,500 customers, a small RDS instance is often the best cost/stability tradeoff; Aurora v2’s minimum ACU bill can exceed what a solo/small team needs until load is proven.

DynamoDB is a different product — viable if access patterns simplify to pure key-value, but PostGIS for geo queries and relational ACL for teams/comments don't map cleanly to Dynamo without significant query model changes.

### Lambda Split: Four Functions, One Shared Library
**Decision:** Split into `tcp-api`, `tcp-export-pdf`, `tcp-export-dxf`, `tcp-stripe-webhook`.

One Lambda for everything is acceptable now (three lightweight endpoints). It becomes a problem once PDF/DXF exports are popular — they are CPU/memory-heavy and spiky, and sharing concurrency limits with CRUD and Stripe webhooks creates conflicts. Stripe webhooks in particular need fast 200 OK responses; mixing them with long export jobs risks timeout-induced Stripe retries and duplicate side effects.

Migration is incremental: split handlers in SAM template, extract shared library as a Lambda Layer or internal package, route by path/method in API Gateway. See §6.2 for target state.

### Tier Entitlement: Postgres is Authoritative — Cognito is Identity Only
**Decision:** `users.tier` in **Postgres** (RDS/Aurora — same schema) is the source of truth. Cognito custom attributes are not used for business logic.

The Cognito attribute pattern has known failure modes: propagation delay means a paid user can be gated as free for minutes; a cancelled user can retain Pro access until the attribute syncs; custom attribute quotas create schema rigidity. The Stripe webhook handler writes to `users.tier` in Postgres (with idempotency via `stripe_events` table). The API reads tier from Postgres (or a short-TTL cache keyed by `user_id`) on every gating check — never from the JWT claim. Use Cognito for authentication. Use the database for authorization.

### S3 Key Schema: Tenant-Centric, ACL in Database
**Decision:** `plans/{tenantId}/{planId}.tcp.json`, sharing via `plan_shares` table, not S3 duplication.

The current `plans/{userId}/...` prefix works for solo users and maps cleanly to IAM prefix policies. It breaks for teams — shared plans either require duplication under multiple prefixes or complex cross-prefix IAM. The fix is `tenantId` as the top-level prefix (where `tenantId == userId` for solo, `tenantId == teamId` for team plans), and a `plan_shares` table for read-only link sharing. No S3 object duplication. The one-time migration is a key rename + Postgres metadata backfill.

### Comment Coordinates: Plan Space, Not Pixels
**Decision:** Store comments at plan-space coordinates (meters from origin), not Konva canvas pixel coordinates.

Pixel coordinates are viewport-dependent — they break on zoom, pan, resize, and any future multi-page or export-cropped canvas. Plan-space coordinates are stable. The render layer converts plan space → screen pixels at display time using `ViewportState`. See §15 for the coordinate bridge design.

### Unauthenticated Endpoints: Add WAF Before Public Launch
**Decision:** `/export-pdf` and `/create-issue` must be protected by AWS WAF before public launch.

Both endpoints are currently unauthenticated. `/export-pdf` in particular is CPU-heavy — repeated large payload calls are a cost and availability attack. At minimum: WAF rate limiting by IP, payload size cap, and require a valid Cognito JWT on `/export-pdf` for authenticated users (free-tier watermarked, Pro clean). Anonymous export (for the pre-auth try-before-signup flow) needs a strict rate limit and payload cap.

### DXF Export Coordinate Transform
The canvas pixel → real-world unit transform for DXF is non-trivial. The `GeoContext` stored in the plan (§5.2) provides the ground resolution in meters/pixel at the reference zoom. Use the `coordinate-bridge` module (§15) — don't implement ad hoc "multiply by zoom" in the DXF Lambda. Budget extra time for this; verify output against known reference points in AutoCAD and LibreCAD before shipping.

### Offline / Field Mode (Deferred)
Service Worker + IndexedDB when ready. The localStorage autosave already in place is a partial proxy until then.

### Real-Time Collaboration (Post-Launch)
WebSocket via API Gateway. Postgres schema already supports teams/permissions. Collaboration operates in plan space (not pixel space) — see §15. Main addition needed: presence/locking model at the object level.

---

## 11. Infrastructure Topology

```
GitHub (source)
     │
     ├──► Amplify auto-deploy ──► CloudFront CDN ──► S3 (static assets)
     │    (frontend CI/CD)
     │
     └──► AWS SAM deploy ──► AWS WAF ──► API Gateway (HTTP API)
          (backend CI/CD)                     │
                           ┌──────────────────┼──────────────────────┐
                           ▼                  ▼                       ▼
                    Lambda               Lambda               Lambda
                    tcp-api              tcp-export-pdf       tcp-stripe-webhook
                    256MB/10s            512MB/30s            256MB/10s
                    plan CRUD            ReportLab            Stripe events
                    teams/users          (requires JWT)       idempotency
                           │                  │                       │
                           └──────────────────┼───────────────────────┘
                                              ▼
                               [Phase 4 — shared data layer]
                         ┌─────────────────────────────────────────────┐
                         │                                             │
                    RDS PostgreSQL + PostGIS         S3 Buckets
                    (Aurora v2 optional later)        /plans/{tenantId}/
                    users, tenants, plans             /signs/ (87 SVGs)
                    comments (plan space)             /templates/
                    stripe_events (idempotency)
                    plan_shares                         Stripe (external)
                         │                                 │ webhook → tcp-stripe-webhook
                         │                                 ▼
                    AWS Cognito                     Postgres users.tier updated
                    User Pools                      (NOT Cognito attributes)
                    Identity only
                    JWT issuance

                    [Phase 4 addition]
                    Lambda tcp-export-dxf
                    512MB/60s — Pro tier only
                    ezdxf + coordinate-bridge
```

---

## 12. Competitive Position

| | TCP (current) | TCP (post-launch) | Invarion RapidPlan | AutoCAD |
|--|--------------|-------------------|-------------------|---------|
| Price | Beta (free) | $300–420/yr | $540–799/yr | $2,000+/yr |
| Platform | Web (any device) | Web (any device) | Web + Windows desktop | Windows/Mac |
| TCP-specific tools | Yes | Yes | Yes | No |
| MUTCD sign library | 180+ | 200+ | Yes | No |
| QC compliance check | Basic (live) | Full MUTCD | Partial | No |
| AI-assisted placement | No | Phase 4+ | No | No |
| DXF/CAD export | No | Phase 4 | Yes | Native |
| Cloud collaboration | No | Phase 4 | Yes | Limited |
| Geo-referenced drawing | Yes | Yes | Yes | Manual |

---

## 13. Remaining Work to Launch

**To reach Beta:**
1. Shoulder/sidewalk rendering on polyline, curve, and cubic Bezier roads
2. ~20 more signs to reach 200+
3. Full MUTCD taper auto-channelization
4. Sign spacing calculator overlay (MUTCD Table 6H-3)

**Hard blockers for Public Launch:**
5. Stripe integration (pricing page, upgrade flow, webhook handler)
6. Freemium gating (2-plan limit, PDF watermark)
7. RDS PostgreSQL + PostGIS setup (schema, migrations, plan metadata indexing; Aurora v2 optional)

**Should ship with launch:**
8. Lambda split into 4 handlers (tcp-api, tcp-export-pdf, tcp-export-dxf, tcp-stripe-webhook)
9. AWS WAF on unauthenticated endpoints
10. S3 key migration to tenant-centric prefix
11. Plan sharing / read-only view link
12. Team collaboration (shared library, invite flow)
13. Comment pins on canvas (stored in plan space, not pixels)
14. DXF export (ezdxf Lambda, coordinate-bridge module)

---

## 14. Operability and Security Gaps

These are not feature gaps — they are production readiness gaps. None are currently addressed in the codebase. All should be resolved before or at public launch.

| Gap | Risk | Recommended approach |
|-----|------|----------------------|
| Secrets management | Stripe keys, GitHub PAT, DB credentials in env vars with no rotation policy | AWS Secrets Manager with Lambda environment injection; rotate on schedule |
| WAF / rate limiting | `/export-pdf` and `/create-issue` are unauthenticated; abuse = cost attack + Lambda concurrency exhaustion | AWS WAF with rate rules on unauthenticated paths; payload size cap on `/export-pdf` |
| Backup and PITR | No documented backup strategy for RDS/Postgres or S3 | RDS automated backups + PITR enabled; S3 versioning on plan bucket; quarterly restore drill |
| GDPR / data deletion | No user data export or deletion flow | "Delete my account" endpoint: purge S3 prefix, delete Postgres rows, deactivate Cognito user; document retention policy for analytics (PostHog) |
| Audit log | No record of who changed tier, who accessed a shared plan | Append-only `audit_events` table in Postgres for tier changes, plan access, admin actions |
| Structured observability | PostHog is product analytics, not ops monitoring | CloudWatch structured logs + X-Ray tracing on all Lambdas; alarms on error rate, Lambda duration P99, Stripe webhook failure rate |
| Dependency management | No documented pinning or update policy | Pin all dependencies; add Renovate or Dependabot for automated PRs; review SBOM periodically |
| Email deliverability | SES in sandbox mode by default; invites and billing notices will silently fail | Request SES production access; configure DKIM/SPF; set up bounce/complaint handling |
| Multi-region / DR | Single-region; no documented RTO/RPO | Accept single-region as a conscious decision at launch; document RTO/RPO targets; revisit at 1,000+ customers |

---

## 15. Coordinate Bridge Design

This is a cross-cutting concern that affects DXF export, AI sign placement, comment anchoring, and real-time collaboration. It must be designed as a single module — not implemented ad hoc in each feature.

### The Problem

The canvas currently works in Konva pixel space (px relative to viewport zoom and pan). Pixel coordinates are viewport-dependent: they change on zoom, pan, resize, and export crop. Storing or transmitting pixel coordinates in the database or DXF file is incorrect.

### Three Coordinate Spaces

```
ScreenSpace (px)     — Konva stage pixels; viewport-dependent; ephemeral
     ↕  ViewportState (pan, zoom, devicePixelRatio)
PlanSpace (m)        — meters from plan origin; stable; stored in DB and plan JSON
     ↕  GeoContext (groundResolution, WGS84 mapCenter, crs for projection math)
GeoSpace (lat/lng)   — WGS84 for map display, DXF tie-in, AI placement; bridge uses crs for projected meters
```

### GeoContext (stored in every plan)

```typescript
interface GeoContext {
  mapCenter: { lat: number; lng: number };  // WGS84 — display & PostGIS; not the projection crs
  mapZoom: number;                           // reference zoom level
  groundResolutionMetersPerPx: number;       // meters per pixel at reference zoom (Web Mercator)
  originCanvasPx: { x: number; y: number }; // canvas pixel that maps to mapCenter
  crs: "EPSG:3857";                         // Web Mercator — canonical for TCP; plan↔geo math uses this only
}
```

`groundResolutionMetersPerPx` at zoom Z = `(2π × EarthRadius) / (256 × 2^Z) × cos(lat)` (Web Mercator latitude φ of `mapCenter.lat`).

### The coordinate-bridge Module

```typescript
// src/coordinate-bridge.ts

// PlanSpace ↔ ScreenSpace (needs current ViewportState)
function planToScreen(pt: PlanPt, viewport: ViewportState, geo: GeoContext): ScreenPt
function screenToPlan(pt: ScreenPt, viewport: ViewportState, geo: GeoContext): PlanPt

// PlanSpace ↔ GeoSpace (stable, no viewport needed)
function planToGeo(pt: PlanPt, geo: GeoContext): LatLng
function geoToPlan(ll: LatLng, geo: GeoContext): PlanPt

// PlanSpace ↔ Meters (trivial — plan space IS meters)
// No conversion needed; planPt.x is already meters from origin.
```

### Rules for All Features

- **Canvas rendering:** Convert plan space → screen at render time. Never store screen coords.
- **Database (comments, collab):** Store in plan space. Render layer converts for display.
- **DXF export:** Use `planToGeo` then project to DWG units (feet or meters). No ad hoc zoom math in the Lambda.
- **AI sign placement:** Operate in plan space or geo space. Return plan space coordinates.
- **Real-time collaboration:** Broadcast deltas in plan space. Each client's render layer handles viewport independently. Send `ViewportState` separately for presence cursors.
- **Comment pins:** `plan_space_x` / `plan_space_y` in Postgres (see §5.3). Convert to screen at render using current viewport.

### Migration from Current Pixel Storage

Current plan JSON stores object coordinates as Konva pixel values. Schema version 2 will add `geoContext` and store all coordinates in plan space. A migration function reads v1 plans, applies the inverse Konva transform using the stored `mapCenter` + `mapZoom` as the reference GeoContext, and writes v2 coordinates. Round-trip tests with fixed fixtures are required before shipping schema version 2.

---

## Document revision history

**Semver for this document**

| Bump | When |
|------|------|
| **MAJOR** | Breaking changes to documented decisions (e.g. replacing Aurora with another store, abandoning plan-space coordinates) — readers should re-read affected sections. |
| **MINOR** | New sections, new Phase targets, or substantive additions (e.g. new Lambdas, new tables) that do not invalidate earlier content. |
| **PATCH** | Clarifications, cross-references, typos, diagram tweaks, “last updated” only. |

**Changelog**

| Document version | Last updated | Notes |
|------------------|--------------|--------|
| **1.0.1** | 2026-04-10 | **Default launch DB:** RDS Postgres (small instance) + PostGIS; Aurora Serverless v2 when scale/ops justify. Diagrams §3.2/§11, tech stack §4, decisions §10, launch checklist §13 updated. |
| **1.0.0** | 2026-04-10 | Introduced semver and this history. Aligns Phase 4 narrative across §3.2, §4–§6, §11, §14–§15 (managed Postgres, tenant S3 keys, DB entitlements, Lambda split, WAF, coordinate bridge, operability). Supersedes informal “v0.4.0” doc label. |
