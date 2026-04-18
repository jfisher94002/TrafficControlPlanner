# Save Conflict Detection & Resolution — Spec

**Issue:** #193  
**Status:** Implemented in PR #254  
**Branch:** `feat/save-conflict-193`

---

## Problem

`savePlanToCloud` previously did a blind overwrite on every save. If a user had the same plan open in two browser tabs (or on two devices), the second save would silently clobber the first. There was no warning and no way to recover the lost version.

---

## Goals

1. Detect when a cloud plan has been modified by another session since the user last loaded it.
2. Present a clear, non-destructive resolution UI.
3. Never lose data silently — always give the user a choice.
4. Add no noticeable latency to the happy path (first save of a new plan, or save when no conflict exists).

---

## Version Token Design

Each plan stored in S3 carries an `updatedAt` ISO 8601 timestamp in two places:

| Location | Purpose |
|---|---|
| JSON body (`data.updatedAt`) | Canonical record; read when the plan is loaded |
| S3 object user metadata (`x-amz-meta-updatedAt`) | Cheap HEAD-only check; avoids downloading the full JSON |

On every successful `savePlanToCloud` call, both are written atomically (same `uploadData` call).

### Version token lifecycle

```
Open plan from dashboard
  └─► loadPlanFromCloud returns { updatedAt: "T1", ... }
  └─► handleDashboardOpen sets lastKnownUpdatedAt = "T1"

User edits plan locally...

User clicks ☁ Save
  └─► fetchRemoteUpdatedAt(path) → HEAD request → reads x-amz-meta-updatedAt
      ├─ Returns null (plan never saved, or no metadata) → skip check, save normally
      ├─ Returns "T1" (matches lastKnownUpdatedAt) → no conflict, save normally
      └─ Returns "T2" (differs) → conflict! load full remote JSON → show modal
```

---

## Flows

### Flow A — Happy path (no conflict)

1. User opens plan → `lastKnownUpdatedAt = T1`
2. User saves → remote HEAD returns `T1` → tokens match → save proceeds
3. S3 updated with new body + metadata `updatedAt = T2`
4. `lastKnownUpdatedAt` updated to `T2` in React state
5. Button shows "Saved ✓"

### Flow B — Conflict detected

1. User opens plan → `lastKnownUpdatedAt = T1`
2. Another session saves the plan → remote now has `updatedAt = T2`
3. User saves → remote HEAD returns `T2` ≠ `T1` → conflict
4. Full remote plan JSON is fetched and stored in `conflictData` state
5. Save is aborted; conflict modal is shown

### Flow C — User chooses "Overwrite remote"

1. Conflict modal is dismissed (`conflictData = null`)
2. Plan is saved immediately, bypassing the conflict check
3. `lastKnownUpdatedAt` is updated to the new `updatedAt`
4. Button shows "Saved ✓"

### Flow D — User chooses "Load remote version"

1. Conflict modal is dismissed
2. `handleDashboardOpen` is called with the already-fetched `conflictData`
3. Canvas, title, and metadata are replaced with the remote plan's content
4. `lastKnownUpdatedAt` is set to the remote plan's `updatedAt`
5. User's local unsaved changes are discarded

### Flow E — User chooses "Keep unsaved"

1. Conflict modal is dismissed (`conflictData = null`)
2. No save occurs; local edits are preserved
3. `lastKnownUpdatedAt` is unchanged — the next save attempt will detect the conflict again

### Flow F — First save of a new plan

1. `lastKnownUpdatedAt` is `null` (never loaded from cloud)
2. Conflict check is skipped entirely
3. Plan is saved normally

---

## UI

A modal overlay (`data-testid="save-conflict-modal"`) is shown when a conflict is detected:

```
┌─────────────────────────────────────────────┐
│ Save Conflict                               │
│                                             │
│ This plan was modified elsewhere since you  │
│ last loaded it. Choose how to proceed:      │
│                                             │
│ [Overwrite remote] [Load remote] [Keep local]│
└─────────────────────────────────────────────┘
```

| Button | `data-testid` | Action |
|---|---|---|
| Overwrite remote | `conflict-overwrite-btn` | Force-saves local version |
| Load remote version | `conflict-load-remote-btn` | Replaces canvas with remote plan |
| Keep unsaved | `conflict-dismiss-btn` | Closes modal, no action |

---

## API Changes

### `planStorage.ts`

#### Modified: `savePlanToCloud`

```ts
// Before
savePlanToCloud(userId: string, planId: string, data: object): Promise<void>

// After — data must include updatedAt; it is written to S3 metadata
savePlanToCloud(userId: string, planId: string, data: object & { updatedAt: string }): Promise<void>
```

#### New: `fetchRemoteUpdatedAt`

```ts
fetchRemoteUpdatedAt(path: string): Promise<string | null>
```

Performs a HEAD-only `getProperties` call (no body download). Returns the `updatedAt` string from S3 user metadata, or `null` if absent or if the object doesn't exist.

### `traffic-control-planner.tsx`

New state:

```ts
const [lastKnownUpdatedAt, setLastKnownUpdatedAt] = useState<string | null>(null);
const [conflictData, setConflictData] = useState<Record<string, unknown> | null>(null);
```

`lastKnownUpdatedAt` is set by:
- `handleDashboardOpen` — when a plan is opened from the cloud dashboard
- `handleCloudSave` — updated to the new `updatedAt` after every successful save
- `handleConflictOverwrite` — updated after a force-save
- `newPlan` — reset to `null`

---

## Migration Path

Plans saved before this feature was deployed have no `updatedAt` in S3 metadata. `fetchRemoteUpdatedAt` returns `null` for these, which causes the conflict check to be skipped (Flow F). On first save after the upgrade, metadata is written and future saves will have conflict detection.

---

## Testing

| Test file | Coverage |
|---|---|
| `src/test/planStorage.test.ts` | `savePlanToCloud` writes metadata; `fetchRemoteUpdatedAt` returns value / null / null-on-error |
| `src/test/planner.test.tsx` | Modal not shown initially; conflict detected; Overwrite; Load Remote; Keep Local; no conflict when tokens match |
