#!/usr/bin/env bash
# Run ON YOUR MACHINE (where `gh auth status` works):
#   bash scripts/apply-milestones.sh
#
# Creates milestones M1–M5 (if missing) and assigns canonical issues per
# docs/milestone plan (TCP_Architecture-aligned). Safe to re-run: skips
# duplicate milestone creation errors.
#
# After assigning M1 issues, normalize labels:
#   bash scripts/clean-foundations-labels.sh

set -uo pipefail

REPO="${GITHUB_REPO:-jfisher94002/TrafficControlPlanner}"

echo "Using repo: $REPO"
gh auth status

create_milestone() {
  local title="$1"
  local desc="$2"
  if gh api "repos/$REPO/milestones" -f title="$title" -f state=open -f description="$desc" 2>/dev/null; then
    echo "Created milestone: $title"
  else
    echo "Milestone already exists or create failed (check GitHub): $title"
  fi
}

echo "=== Creating milestones ==="
create_milestone "M1 — Foundations" "TCP §15 / foundation threads: modularize canvas, save conflicts, v1→v2 coords + coordinate bridge"
create_milestone "M2 — Beta" "TCP §8 Beta: shoulders/signs/taper/sign-spacing (#195–#198)"
create_milestone "M3 — Launch: blockers" "Stripe, freemium, RDS+PostGIS, Lambda split, WAF (#199–201, #209–210)"
create_milestone "M4 — Launch: ship-with" "Share links, teams, comment pins, DXF, secrets, observability, GDPR (#202–205, #211–213)"
create_milestone "M5 — Post-launch" "Offline, AI placement, realtime collab (#206–208)"

echo ""
echo "=== Assigning issues ==="

assign() {
  local milestone="$1"
  shift
  local num
  for num in "$@"; do
    echo "  #$num -> $milestone"
    gh issue edit "$num" --repo "$REPO" --milestone "$milestone" || echo "    (failed #$num — wrong number or no access)"
  done
}

assign "M1 — Foundations" 192 193 194
assign "M2 — Beta" 195 196 197 198
assign "M3 — Launch: blockers" 199 200 201 209 210
assign "M4 — Launch: ship-with" 202 203 204 205 211 212 213
assign "M5 — Post-launch" 206 207 208

# Coordinate bridge #214 duplicates #194 — assign to M1 for visibility; close manually or:
echo ""
echo "=== Optional: close #214 as duplicate of #194 ==="
echo "Run:"
echo "  gh issue close 214 --repo $REPO --comment 'Duplicate of #194 — coordinate bridge / v1→v2 (TCP_Architecture §5.2, §15).'"
echo "(Not executed automatically.)"

echo ""
echo "Done. List open issues by milestone:"
echo "  gh issue list --repo $REPO --state open -m \"M1 — Foundations\""
