# TrafficControlPlan — Claude Code Instructions

## Current time
When you need the current date or time (e.g., for wait message timestamps), run `date` in bash. Never guess or fabricate a time.

## Wait messages
Whenever you say we are waiting on something (CI run, Amplify deploy, E2E run, etc.), include:
- The current date and time from `date` (PDT)
- A time estimate for when it will complete
- A direct hyperlink to the run/page

Format: ⏳ Waiting on [thing] — started **Wed Apr 1 @ 6:59 PM PDT**, expect results in ~5 min (by ~7:04 PM PDT). [View run →](url)
