#!/usr/bin/env bash
# Creates exactly three GitHub issues for pre-scale foundation work (canvas modularization,
# shared-plan conflict model, v1→v2 coordinate migration). Run once from repo root:
#   bash scripts/create-priority-thread-issues.sh
#
# Re-running duplicates issues — only use on a clean milestone or new fork.
# Requires: gh CLI, authenticated with write access to the repo.
#
# Reference: TCP_Architecture.md §5.2, §15 (coordinate bridge); team/shared plans Phase 4.

set -euo pipefail

REPO="jfisher94002/TrafficControlPlanner"

echo "Creating 3 priority-thread issues on ${REPO}..."

# Labels (idempotent)
gh label create "foundations" --color "6F42C1" --description "Pre-scale foundation work; unblock roadmap re-eval" --repo "$REPO" 2>/dev/null || true
gh label create "phase:m1-foundations" --color "6F42C1" --description "Milestone M1 — Foundations (use with GitHub milestone)" --repo "$REPO" 2>/dev/null || true
gh label create "phase:beta" --color "FFA500" --description "Required for Beta release" --repo "$REPO" 2>/dev/null || true
gh label create "phase:launch" --color "00AA00" --description "Required for Public Launch" --repo "$REPO" 2>/dev/null || true
gh label create "area:drawing" --color "BFD4F2" --description "Canvas drawing engine" --repo "$REPO" 2>/dev/null || true
gh label create "area:collab" --color "E4E669" --description "Collaboration features" --repo "$REPO" 2>/dev/null || true
gh label create "area:backend" --color "D4C5F9" --description "FastAPI / Lambda backend" --repo "$REPO" 2>/dev/null || true
gh label create "area:db" --color "D4C5F9" --description "Postgres (RDS) / data model" --repo "$REPO" 2>/dev/null || true
gh label create "tech-debt" --color "CC0000" --description "Known technical debt" --repo "$REPO" 2>/dev/null || true
gh label create "p0" --color "CC0000" --description "Must have for next release" --repo "$REPO" 2>/dev/null || true

# ── Thread 1: Modularize the mega canvas component ───────────────────────────

gh issue create \
  --repo "$REPO" \
  --title "[Foundations] Modularize traffic-control-planner.tsx — reduce monolith risk" \
  --label "foundations,phase:m1-foundations,area:drawing,tech-debt,p0" \
  --body "## Why this ticket exists
\`traffic-control-planner.tsx\` is ~3,864 lines. That concentration drives regression risk, slows review, and makes it hard to test drawing behavior in isolation. **Cloud architecture is not the main sleep risk here — this surface is.**

## Goal
Establish clear boundaries so future features (QC, export, collab hooks) land without touching a single god file. **Incremental extraction** is OK; a big-bang rewrite is not required in one PR.

## Suggested approach (pick what fits; document decisions in PRs)
1. **Inventory** — List logical regions (toolbar, layer panel, canvas stage, history/undo, map sync, save/load, export triggers).
2. **Extract leaf UI** — Presentational components and hooks (\`usePlanState\`, \`useViewport\`, etc.) into colocated files under e.g. \`src/features/canvas/\` or \`my-app/src/components/tcp/\`.
3. **Isolate domain types** — Keep Konva-specific code at the edges; pure functions for geometry/QC stay testable without mounting React.
4. **Set a measurable target** — e.g. main file under **1,500 lines** within N iterations, or **≥5** focused modules each &lt; 400 lines with clear names.
5. **Regression safety** — Existing Playwright/Vitest coverage must stay green; add tests for any extracted pure logic.

## Acceptance criteria
- [ ] Written short **ARCHITECTURE.md** snippet or comment in repo pointing to new folder layout (1–2 paragraphs).
- [ ] **Meaningful chunk** of \`traffic-control-planner.tsx\` moved out (not just types); second PR can continue the trend.
- [ ] No loss of functionality; CI (lint, unit, e2e) passes.
- [ ] Line count of \`traffic-control-planner.tsx\` reduced vs baseline (record starting line count in PR description).

## Out of scope
- Full real-time collaboration (separate issue).
- Schema v2 coordinate migration (separate issue).

## Depends on
Nothing — can start immediately.

---
*Part of the three foundation threads to complete before roadmap re-evaluation.*"

# ── Thread 2: Conflict model for shared / team plans ─────────────────────────

gh issue create \
  --repo "$REPO" \
  --title "[Foundations] Define save conflict behavior for shared plans (before real-time collab)" \
  --label "foundations,phase:m1-foundations,area:collab,area:backend,tech-debt,p0" \
  --body "## Why this ticket exists
Team/shared plans will see **concurrent edits** even without WebSockets: two tabs, two users, or a slow save. Last-write-wins **silently destroys work** and generates support load. **Define behavior in product + API before shipping shared libraries.**

## Goal
Ship a **minimum viable** conflict story that is honest, testable, and upgradable to presence/CRDT later (see TCP_Architecture post-launch collab).

## Options (choose one primary + document rejected alternatives)

| Approach | Pros | Cons |
|----------|------|------|
| **Optimistic locking** — \`updated_at\` or version integer on plan metadata; save rejected if stale | Simple, no locks | User must merge or refresh |
| **ETag / If-Match** on S3 or API | HTTP-native | Requires API wrapper around S3 writes |
| **Lease / soft lock** — “User X is editing” TTL | Reduces collisions | Not strong without WS heartbeat |

## Deliverables
1. **Spec** (markdown in repo): user-visible flows — conflict detected → choices (overwrite with copy, reload, discard local).
2. **Server or client rule** — Reject save with **409 Conflict** (or equivalent) when storage version ≠ client version; client handles UI.
3. **Metadata** — Plan record must carry \`version\` or \`updated_at\` used for checks (S3 metadata + JSON field, or Postgres row when Phase 4 DB lands).
4. **Tests** — At least one automated test simulating two saves (unit or e2e stub).

## Acceptance criteria
- [ ] Spec merged (\`docs/\` or \`.github/\` or TCP_Architecture appendix — your choice).
- [ ] Save path implements version check end-to-end for **team-eligible** or **all** plans (team flag can be stubbed until tenants exist).
- [ ] User sees a **non-silent** outcome on conflict (toast/modal), not data loss.
- [ ] Linked from a comment in plan save code: \`See issue #NNN\` (update number after create).

## Depends on
- Nothing for the **spec**; implementation may align with Phase 4 Postgres \`plans.updated_at\` — call out in PR if split across DB milestone.

## Out of scope
- Full WebSocket presence (existing post-launch issue).

---
*Part of the three foundation threads to complete before roadmap re-evaluation.*"

# ── Thread 3: v1 → v2 coordinate migration ───────────────────────────────────

gh issue create \
  --repo "$REPO" \
  --title "[Foundations] Plan JSON v1 → v2: GeoContext, plan-space coords, migration + rollback story" \
  --label "foundations,phase:m1-foundations,area:drawing,area:backend,area:db,tech-debt,p0" \
  --body "## Why this ticket exists
v1 plans store **Konva pixel** coordinates — viewport-dependent. v2 stores **plan space (meters)** + \`geoContext\` per TCP_Architecture.md §5.2 and §15. A bad migration **breaks every saved plan** (signs drift from roads). Treat this like a **database migration**: fixtures, round-trip tests, dry-run, rollback path.

## Goal
1. Implement **coordinate-bridge** (\`planToScreen\`, \`screenToPlan\`, \`planToGeo\`, \`geoToPlan\`) with **\`crs: EPSG:3857\`** canonical; \`mapCenter\` WGS84.
2. Bump **\`PLAN_SCHEMA_VERSION\`** to **2** when writing new saves.
3. **Migration function**: load v1 JSON → compute GeoContext from stored \`mapCenter\` / \`mapZoom\` → transform object coords to plan space → emit v2 JSON.
4. **Safety**
   - Golden **fixtures** (2–3 real v1 blobs) with expected v2 output (within tolerance).
   - **Dry-run mode**: log diff stats without writing.
   - **Rollback**: keep v1 blob or backup key until user confirms (define policy: S3 version ID, \`.v1.bak\` sibling, or export-only migration).

## Acceptance criteria
- [ ] \`coordinate-bridge\` module + unit tests (round-trip screen↔plan within epsilon for fixtures).
- [ ] Migration runs on sample plans; visual sanity check documented (screenshots or checklist).
- [ ] Load path: **accept v1 and v2**; on load, optionally **auto-upgrade** v1→v2 with user consent or background job (document choice).
- [ ] DXF/export paths consume **plan space** only — no ad hoc zoom math in Lambdas.
- [ ] README or doc section: **Migration runbook** (order of operations, failure modes).

## Depends on
- Coordinate bridge design in TCP_Architecture §15 (already drafted).
- May parallel **modularize canvas** but should not block starting pure TS migration + tests in isolation.

## Out of scope
- Comment pins DB (can follow after plan JSON is stable in v2).

---
*Part of the three foundation threads to complete before roadmap re-evaluation.*"

echo ""
echo "Done. Created 3 issues on ${REPO}."
echo "Next: assign milestone, link PRs, and close this batch before roadmap re-eval."
