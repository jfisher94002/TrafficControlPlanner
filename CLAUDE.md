# TrafficControlPlan — Claude Code Instructions

## Current time
When you need the current date or time (e.g., for wait message timestamps), run `date` in bash. Never guess or fabricate a time.

## Wait messages
Whenever you say we are waiting on something (CI run, Amplify deploy, E2E run, etc.), include:
- The current date and time from `date` (PDT)
- A time estimate for when it will complete
- A direct hyperlink to the run/page

Format: ⏳ Waiting on [thing] — started **Wed Apr 1 @ 6:59 PM PDT**, expect results in ~5 min (by ~7:04 PM PDT). [View run →](url)

## PR merge requirements
**Do not ask Jonathan to merge a PR until ALL of the following are true:**

1. CI is green
2. All three automated reviewers have posted comments:
   - Gemini Code Assist (`gemini-code-assist[bot]`)
   - GitHub Copilot (`copilot-pull-request-reviewer[bot]`)
   - Sourcery (`sourcery-ai[bot]`)
3. Every individual reviewer comment has been read and given a status:
   - ✅ Fixed, ⏭ Skipped (with reason), or a note that it's already done
4. The full comment list (with statuses) has been shown to Jonathan

**Before proposing a merge**, run:
```
gh api repos/jfisher94002/TrafficControlPlanner/pulls/{PR}/reviews
gh api repos/jfisher94002/TrafficControlPlanner/pulls/{PR}/comments
```
and verify all three bots have reviewed. If any are missing, say so explicitly and wait.
