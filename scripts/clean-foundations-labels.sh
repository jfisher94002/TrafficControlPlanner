#!/usr/bin/env bash
# Normalize labels on M1 foundation issues (#192–#194).
# Run locally: bash scripts/clean-foundations-labels.sh
#
# - Removes legacy phase:beta / phase:launch (they disagreed across issues; milestone is canonical).
# - Adds phase:m1-foundations for filtering alongside the GitHub milestone.

set -uo pipefail

REPO="${GITHUB_REPO:-jfisher94002/TrafficControlPlanner}"

gh auth status

gh label create "phase:m1-foundations" \
  --color "6F42C1" \
  --description "Issues for milestone M1 — Foundations (see TCP_Architecture)" \
  --repo "$REPO" 2>/dev/null || true

for issue in 192 193 194; do
  echo "=== Issue #$issue ==="
  gh issue edit "$issue" --repo "$REPO" --remove-label "phase:beta" 2>/dev/null || true
  gh issue edit "$issue" --repo "$REPO" --remove-label "phase:launch" 2>/dev/null || true
  gh issue edit "$issue" --repo "$REPO" --add-label "phase:m1-foundations"
done

echo ""
echo "Done. Verify:"
echo "  gh issue view 192 -R $REPO --json labels -q '.labels[].name'"
