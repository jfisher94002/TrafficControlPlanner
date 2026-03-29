#!/bin/bash
# TCP Beta Issue Reprioritization
# Run from repo root: bash reprioritize-beta.sh
# Requires: gh CLI authenticated
#
# This script:
# 1. Creates new labels for Launch milestone and priority tiers
# 2. Reassigns issues to Beta or Launch milestone
# 3. Adjusts priorities to reflect actual importance

REPO="jfisher94002/TrafficControlPlanner"

echo "=== Step 1: Create missing labels ==="
gh label create "phase: 3 - Launch" --color "7B1FA2" --description "Ship after beta feedback. Auth, collab, payments, analytics" --repo "$REPO" 2>/dev/null || echo "Label already exists"
gh label create "priority: critical" --color "B60205" --description "Blocking a release. Drop everything." --repo "$REPO" 2>/dev/null || echo "Label already exists"

# Check if Launch milestone exists, create if not
gh api repos/$REPO/milestones --jq '.[].title' | grep -q "Launch" || \
  gh api repos/$REPO/milestones -f title="Launch" -f description="Public launch with auth, payments, collaboration" 2>/dev/null

echo ""
echo "=== Step 2: BETA issues — Core drawing + infrastructure ==="
echo "These stay in Beta milestone. Reprioritize as shown."
echo ""

# --- CRITICAL (do these first) ---
echo "--- Setting CRITICAL priority ---"

# Infrastructure already in progress
gh issue edit 69 --repo "$REPO" --remove-label "priority: high" --add-label "priority: critical" 2>/dev/null
echo "#69  Activate Cognito auth for production -> CRITICAL"

gh issue edit 61 --repo "$REPO" --remove-label "priority: high" --add-label "priority: critical" 2>/dev/null
echo "#61  Domain routing -> CRITICAL"

gh issue edit 76 --repo "$REPO" --remove-label "priority: high" --add-label "priority: critical" 2>/dev/null
echo "#76  Cognito Identity Pool -> CRITICAL"

# Core drawing features — the whole point of Beta
gh issue edit 16 --repo "$REPO" --remove-label "priority: high" --add-label "priority: critical" 2>/dev/null
echo "#16  Intersection editor -> CRITICAL"

gh issue edit 81 --repo "$REPO" --remove-label "priority: high" --add-label "priority: critical" 2>/dev/null
echo "#81  Sign up / sign in flows -> CRITICAL"

gh issue edit 82 --repo "$REPO" --remove-label "priority: high" --add-label "priority: critical" 2>/dev/null
echo "#82  Protected routes -> CRITICAL"

echo ""
echo "--- Keeping HIGH priority (Beta) ---"

# Road features
for ISSUE in 17 18 19 20; do
  gh issue edit $ISSUE --repo "$REPO" --remove-label "priority: medium" --add-label "priority: high" 2>/dev/null
  echo "#$ISSUE Road feature -> HIGH"
done

# Templates and compliance
for ISSUE in 111 114 67; do
  echo "#$ISSUE Template/compliance -> stays HIGH"
done

# Export and quality
for ISSUE in 119 78; do
  echo "#$ISSUE Export/versioning -> stays HIGH"
done

# Infrastructure
for ISSUE in 84 83; do
  echo "#$ISSUE Deploy/session -> stays HIGH"
done

echo ""
echo "--- Setting MEDIUM priority (Beta, do after critical+high) ---"
for ISSUE in 77 79 85 66; do
  gh issue edit $ISSUE --repo "$REPO" --remove-label "priority: high" --add-label "priority: medium" 2>/dev/null
  echo "#$ISSUE -> MEDIUM"
done

echo ""
echo "=== Step 3: LAUNCH issues — Move out of Beta milestone ==="
echo "These move to Launch milestone and get deprioritized."
echo ""

# Get Launch milestone number
LAUNCH_MS=$(gh api repos/$REPO/milestones --jq '.[] | select(.title=="Launch") | .number')

if [ -z "$LAUNCH_MS" ]; then
  echo "ERROR: Could not find Launch milestone number. Create it first."
  echo "Run: gh api repos/$REPO/milestones -f title='Launch' -f description='Public launch'"
  exit 1
fi

echo "Launch milestone number: $LAUNCH_MS"
echo ""

# Move these issues to Launch milestone and set appropriate priority
LAUNCH_HIGH=(92 93 94 95 96 97 98 99 100 102 103 112 113 118)
LAUNCH_MEDIUM=(104 105 106 107 115 116 120)
LAUNCH_LOW=(101 108 109 110 117)

echo "--- Launch: HIGH priority ---"
for ISSUE in "${LAUNCH_HIGH[@]}"; do
  gh issue edit $ISSUE --repo "$REPO" --milestone "Launch" --remove-label "phase: 2 - Beta" --add-label "phase: 3 - Launch" 2>/dev/null
  echo "#$ISSUE -> Launch milestone, HIGH"
done

echo ""
echo "--- Launch: MEDIUM priority ---"
for ISSUE in "${LAUNCH_MEDIUM[@]}"; do
  gh issue edit $ISSUE --repo "$REPO" --milestone "Launch" --remove-label "phase: 2 - Beta" --remove-label "priority: high" --add-label "phase: 3 - Launch" --add-label "priority: medium" 2>/dev/null
  echo "#$ISSUE -> Launch milestone, MEDIUM"
done

echo ""
echo "--- Launch: LOW priority ---"
for ISSUE in "${LAUNCH_LOW[@]}"; do
  gh issue edit $ISSUE --repo "$REPO" --milestone "Launch" --remove-label "phase: 2 - Beta" --remove-label "priority: high" --add-label "phase: 3 - Launch" --add-label "priority: low" 2>/dev/null
  echo "#$ISSUE -> Launch milestone, LOW"
done

echo ""
echo "=== Step 4: Add missing Beta issues from original Phase 3 ==="
echo "These were in the original dev summary but missing from the Beta list."
echo "They should already exist as open issues #21-#26. Moving to Beta milestone."
echo ""

BETA_MS=$(gh api repos/$REPO/milestones --jq '.[] | select(.title=="Beta") | .number')

for ISSUE in 21 22 24 25 26; do
  gh issue edit $ISSUE --repo "$REPO" --milestone "Beta" --remove-label "priority: low" --add-label "priority: high" 2>/dev/null
  echo "#$ISSUE -> Beta milestone, HIGH"
done

echo ""
echo "=== DONE ==="
echo ""
echo "BETA backlog (ship before inviting 50-200 users):"
echo "  CRITICAL: #69, #61, #76, #16, #81, #82"
echo "  HIGH:     #17, #18, #19, #20, #111, #114, #67, #119, #78, #84, #83, #21, #22, #24, #25, #26"
echo "  MEDIUM:   #77, #79, #85, #66"
echo "  Total:    ~28 issues"
echo ""
echo "LAUNCH backlog (ship after beta feedback):"
echo "  HIGH:     #92-#100, #102, #103, #112, #113, #118"
echo "  MEDIUM:   #104-#107, #115, #116, #120"
echo "  LOW:      #101, #108-#110, #117"
echo "  Total:    ~26 issues"
