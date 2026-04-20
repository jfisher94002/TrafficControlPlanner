# Save Conflict Detection & Resolution — Spec

**Issue:** #193  
**Status:** As implemented in `feat/save-conflict-193` (see PR #254; update this line if behavior changes)  
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

`updatedAt` is always generated client-side (`new Date().toISOString()`) immediately before each save — it is never copied from a previously loaded plan. Locally generated `updatedAt` is always fresh; remote metadata still reflects whichever client last wrote the object. The conflict check compares the two, not two local clocks.

On every successful `savePlanToCloud` call, both locations are written atomically (same `uploadData` call).

If `getProperties` throws (network error, object not found), `fetchRemoteUpdatedAt` returns `null` and the conflict check is skipped — preferring availability over false conflict warnings.

### Version token lifecycle

```
Open plan from dashboard
  └─► loadPlanFromCloud returns { updatedAt: "T1", ... }
  └─► handleDashboardOpen sets lastKnownUpdatedAt = "T1"

User edits plan locally...

User clicks ☁ Save
  └─► fetchRemoteUpdatedAt(path) → HEAD request → reads x-amz-meta-updatedAt
      ├─ Returns null (new plan, legacy object, or network error) → skip check, save normally
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
2. Plan is saved immediately; the conflict check is bypassed for this one save only
3. `lastKnownUpdatedAt` is updated to the new `updatedAt`
4. Subsequent normal saves resume conflict detection against the new token (no permanent "force" mode)
5. Button shows "Saved ✓"

### Flow D — User chooses "Load remote version"

1. Conflict modal is dismissed
2. `handleDashboardOpen` is called with the already-fetched `conflictData`
3. Canvas, title, and metadata are replaced with the remote plan's content
4. `lastKnownUpdatedAt` is set to the remote plan's `updatedAt`
5. User's local unsaved changes are discarded

### Flow E — User chooses "Keep unsaved"

1. Conflict modal is dismissed (`conflictData = null`)
2. No save occurs; local edits are preserved in the browser
3. `lastKnownUpdatedAt` is unchanged — the next save attempt will detect the same conflict again
4. The user must eventually choose Overwrite or Load Remote to unblock saving

### Flow F — First save of a new plan

1. `lastKnownUpdatedAt` is `null` (plan was never loaded from cloud)
2. Conflict check is skipped entirely — there is no prior token to compare against
3. Plan is saved normally; `lastKnownUpdatedAt` is set to the new `updatedAt`

---

## Migration Path

Plans saved before this feature was deployed have no `updatedAt` in S3 metadata. `fetchRemoteUpdatedAt` returns `null` for these, following the same null path as Flow F. The first save after upgrade is intentionally a "trust first save" — no cross-tab protection yet, because there is no baseline token to compare against. After that first save, metadata is written and all subsequent saves have full conflict detection.

**Implication:** Two tabs with a legacy plan open at the same time could still race on the very first post-upgrade save. This is an acceptable trade-off; it matches the behavior before this feature and resolves automatically after one save.

---

## UI

A modal overlay (`data-testid="save-conflict-modal"`) is shown when a conflict is detected. Button labels in the modal and in this document use the same copy as the rendered UI:

```
┌─────────────────────────────────────────────┐
│ Save Conflict                               │
│                                             │
│ This plan was modified elsewhere since you  │
│ last loaded it. Choose how to proceed:      │
│                                             │
│ [Overwrite remote] [Load remote version] [Keep unsaved] │
└─────────────────────────────────────────────┘
```

| Button | `data-testid` | Action |
|---|---|---|
| Overwrite remote | `conflict-overwrite-btn` | Force-saves local version (conflict check bypassed for this save only) |
| Load remote version | `conflict-load-remote-btn` | Replaces canvas with remote plan; local changes are lost |
| Keep unsaved | `conflict-dismiss-btn` | Dismisses modal without saving; local edits are preserved but conflict will reappear on next save attempt |

---

## Concurrency Edge Cases

**Two tabs both choose "Overwrite remote" after seeing the same conflict.** This is a last-writer-wins race — the second overwrite clobbers the first. No additional protection is provided. Users who need true multi-user editing should wait for the Aurora + team collaboration phase (planned post-public launch).

**Network error during conflict check.** If `getProperties` throws, `fetchRemoteUpdatedAt` returns `null`, the conflict check is skipped, and the save proceeds as if no conflict exists. This matches the behavior for new and legacy plans and avoids blocking saves due to transient network issues.

**Offline / queued save.** Conflict detection runs only at save time and requires a live network call to `getProperties`. There is currently no offline queue; if the network is unavailable the save call itself will fail before the conflict check is reached.

---

## API Changes

### `planStorage.ts`

#### Modified: `savePlanToCloud`

```ts
// Before
savePlanToCloud(userId: string, planId: string, data: object): Promise<void>

// After — caller must supply updatedAt; it is written to both the JSON body and S3 metadata
savePlanToCloud(userId: string, planId: string, data: object & { updatedAt: string }): Promise<void>
```

`updatedAt` must be generated by the caller immediately before the save call (`new Date().toISOString()`). It is not inferred inside `savePlanToCloud`.

#### New: `fetchRemoteUpdatedAt`

```ts
fetchRemoteUpdatedAt(path: string): Promise<string | null>
```

Performs a HEAD-only `getProperties` call (no body download). Returns the `updatedAt` string from S3 user metadata, or `null` if the field is absent, the object does not exist, or the call throws.

The `path` argument must be the full S3 object key in the same form used by `savePlanToCloud` and the dashboard: `plans/{userId}/{planId}.tcp.json`. Only one call site exists today (`handleCloudSave`), but callers must not pass a partial or relative key.

### `traffic-control-planner.tsx`

New state:

```ts
const [lastKnownUpdatedAt, setLastKnownUpdatedAt] = useState<string | null>(null);
const [conflictData, setConflictData] = useState<Record<string, unknown> | null>(null);
```

`lastKnownUpdatedAt` is set by:
- `handleDashboardOpen` — when a plan is opened from the cloud dashboard; set to `data.updatedAt` if present, or `null` if the loaded plan pre-dates this feature (legacy JSON with no `updatedAt` field). A `null` here means the first save will follow Flow F (trust first save) rather than Flow A.
- `handleCloudSave` — updated to the new `updatedAt` after every successful save
- `handleConflictOverwrite` — updated after a force-save
- `newPlan` — reset to `null`

---

## Testing

| Test file | Coverage |
|---|---|
| `src/test/planStorage.test.ts` | `savePlanToCloud` writes correct path and metadata; `fetchRemoteUpdatedAt` returns token / null (no metadata) / null (throws) |
| `src/test/planner.test.tsx` | Modal absent on initial render; conflict detected when tokens differ; Overwrite saves and closes modal; Load Remote switches plan title; Keep Unsaved closes modal without saving; no modal when tokens match |
