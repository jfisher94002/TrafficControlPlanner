# Milestone consolidation (TCP roadmap)

This document aligns open GitHub work with **`TCP_Architecture.md`** (§7–8, §13–14). Use it to decide **what to keep**, **what to close as duplicate**, and how **milestones** map to releases.

**Automation in this repo**

- `scripts/apply-milestones.sh` — creates milestones **M1–M5** and assigns canonical issue numbers.
- `scripts/clean-foundations-labels.sh` — normalizes labels on **#192–#194** (`phase:m1-foundations`, removes legacy `phase:beta` / `phase:launch`).

---

## Recommended GitHub milestones

| Milestone | Purpose | TCP reference |
|-----------|---------|----------------|
| **M1 — Foundations** | De-risk canvas size, coordinates, saves before large feature work | §15, foundation threads |
| **M2 — Beta** | Drawing + standards gaps for a credible beta | §8 Beta, §13 “To reach Beta” |
| **M3 — Launch: blockers** | Money + DB + infra you cannot launch without | §13 hard blockers, §14 |
| **M4 — Launch: ship-with** | Sharing, teams, comments, DXF, ops polish | §13 “Should ship with launch” |
| **M5 — Post-launch** | Offline, AI placement, realtime collab | §10 deferred / post-launch |

---

## M1 — Foundations (do first; re-evaluate after)

| Keep (canonical) | Action on duplicates / notes |
|------------------|-------------------------------|
| **#192** Modularize `traffic-control-planner.tsx` | None |
| **#193** Save conflict behavior for shared plans | **#208** (realtime) is *later*; keep **#193** for 409 + UX *before* websockets |
| **#194** Plan JSON v1→v2 + migration | **Close #214** as duplicate of **#194** (same coordinate-bridge scope). Optional: fold title wording into **#194** |

**Labels (normalized):** `foundations`, `phase:m1-foundations`, `p0`, `tech-debt`, plus `area:*` per issue.

---

## M2 — Beta (product quality before wide beta)

| Keep | Close / supersede |
|------|-------------------|
| **#195** Shoulders/sidewalks on non-straight roads | — |
| **#196** 180→200+ signs | **#21** → superseded by **#196** |
| **#197** Taper auto-channelization | **#22** → **#197** |
| **#198** Sign spacing overlay (6H-3) | **#24** → **#198** |
| **#66** Server DXF | **#205** (canonical DXF export) |
| **#78** Versioning strategy | Link to **#194** / schema v2 |

**Map / tiles (#187–#189):** Prefer one **strategy** epic (**#189**); treat implementation PRs as children. Avoid parallel “source of truth” issues.

---

## M3 — Launch: blockers

| Keep | Close / supersede |
|------|-------------------|
| **#199** Stripe | **#86** → **#199** |
| **#200** Freemium limits + watermark | **#87** → **#200** |
| **#201** RDS Postgres + PostGIS + tenant metadata | — |
| **#209** Lambda split (4 functions) | Ship with or before heavy export + webhooks |
| **#210** WAF + rate limits | §14 |

**Not launch blockers per TCP (defer):** **#88** admin, **#89** analytics page, **#90** update notifications, **#91** chatbot → **M4/M5** or icebox.

---

## M4 — Launch: ship-with

| Keep | Close / supersede |
|------|-------------------|
| **#202** Read-only share link | **#97, #98, #100, #123** → consolidate under **#202** |
| **#203** Team library + invite | **#121** → **#203** |
| **#204** Comment pins (plan space) | **#106, #107, #126** → **#204** |
| **#205** DXF export | Supersedes **#66** |
| **#211–#213** Secrets, observability, GDPR | §14 |

**QC / status / audit (#102–110, #115–120):** **#115** may be largely done — verify and close or narrow. Approval workflow issues: **M4** if promised for launch, else **M5**.

---

## M5 — Post-launch

| Issue | Notes |
|-------|--------|
| **#206** Offline | §10 deferred |
| **#207** AI sign placement | After coordinate bridge stable |
| **#208** Realtime collab | After **#193** + **#194** |

---

## Duplicate clusters (high priority to thin)

1. **#121–130** vs **#92–110** — Many overlap **#201–204**. Prefer the **Phase 4 / architecture** track; close or umbrella the rest with “superseded by #…”.

2. **Projects (#92–95)** vs **tenants (#201)** — TCP centers **tenants + plans**. Align product model, then close or rewrite mismatched issues.

3. **#214** vs **#194** — Close **#214** in favor of **#194** when ready.

---

## Standard comment when closing as duplicate

> Closing in favor of #**XXX** — aligns with `TCP_Architecture.md` (§13 / Phase 4). Reopen if scope differs.

---

## Document history

| Date | Notes |
|------|--------|
| 2026-04-12 | Initial version; paired with `scripts/apply-milestones.sh` and label cleanup. |
