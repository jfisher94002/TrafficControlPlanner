# Sign Library Expansion — Spec

**Issue:** #196  
**Status:** Implemented — merged in PR #263  
**Branch:** `feat/sign-library-196`

---

## Baseline

The issue stated "180 signs" but the actual pre-expansion count was **82 signs** in both `my-app/src/features/tcp/tcpCatalog.ts` and `backend/generate_signs.py`'s `ALL_SIGNS`, backed by 82 SVG files in `backend/signs/`. PR #263 expanded this to **200 signs**.

| Category | Before | After |
|---|---|---|
| Regulatory | 20 | 47 |
| Warning | 23 | 57 |
| Temp Traffic Control | 16 | 46 |
| Guide & Info | 10 | 21 |
| School Zone | 7 | 12 |
| Bicycle & Pedestrian | 6 | 17 |
| **Total** | **82** | **200** |

**Known drift to fix at the same time:** `trafficcontrols` exists in `tcpCatalog.ts` and has an SVG on disk but is **missing from `ALL_SIGNS`** in `generate_signs.py`. Running the generator against a clean directory would lose this SVG. Fix it during this PR. After adding the missing tuple, `len(ALL_SIGNS)` must equal the catalog sign count (82 + 1 = 83) **before** adding the 118 new signs — do not count `trafficcontrols` again as one of the 118.

**Pre-existing bug to fix while in the catalog:** `schoolzone` has `mutcd: "W5-2"` in `tcpCatalog.ts`. W5-2 is NARROW BRIDGE; the correct school-zone warning is S4-3. Fix the code while adding new school signs.

---

## Approach

Signs have **two sources of truth that must stay in sync**:

1. `backend/generate_signs.py` — `ALL_SIGNS` list of tuples `(id, label, shape, fill, text_color, border)` — drives SVG generation and S3 upload
2. `my-app/src/features/tcp/tcpCatalog.ts` — `SIGN_CATEGORIES` — drives the sign picker UI and canvas rendering via `my-app/src/shapes/drawSign.ts`

**Implementation order for each new sign:**
1. Add the tuple to `ALL_SIGNS` in `generate_signs.py`
2. Run `python backend/generate_signs.py` to regenerate all SVGs in `backend/signs/`
3. Add the matching `SignData` entry to the correct category in `tcpCatalog.ts`
4. Commit both files + the generated SVGs together

**S3 upload:** Run `python backend/generate_signs.py --upload` (requires `$ASSETS_BUCKET` env var) as a deploy step after merge, or wire it into the release CI job. This is **not** committed in the PR — it's a runtime deploy action.

> **Categories are UX groupings, not MUTCD chapter assignments.** Some signs (e.g. W14 Dead End placed in Guide & Info, R-series work-zone regulatory signs placed in Temp Traffic Control) intentionally deviate from strict MUTCD series order to improve discoverability in the sign picker.

### Label length constraint

`drawSign.ts` silently truncates labels longer than 12 characters with "…". **All new labels must be ≤ 12 characters.** The generator's `_text_size()` also uses length to pick font size, so shorter is better visually.

### White-fill rect signs

White rect signs (`color: "#fff"`) must always specify `textColor: "#111"` and `border: "#111"` in `tcpCatalog.ts` — otherwise the renderer falls back to white-on-white text. In `generate_signs.py`, the `border` column handles this. See existing `speed*`, `nopassing`, `noparkingnorth` entries as reference.

---

## New Signs by Category

All labels are ≤ 12 characters. White-fill entries include `border: "#111"` in both the generator tuple and the catalog.

### Regulatory (+27 → 47 total)

| id | label | shape | fill | text | border | mutcd |
|---|---|---|---|---|---|---|
| speed5 | 5 MPH | rect | #fff | #111 | #111 | R2-1 |
| speed60 | 60 MPH | rect | #fff | #111 | #111 | R2-1 |
| speed70 | 70 MPH | rect | #fff | #111 | #111 | R2-1 |
| speed80 | 80 MPH | rect | #fff | #111 | #111 | R2-1 |
| speedwz | WZ SPEED LMT | rect | #f97316 | #111 | — | R2-1 |
| nouturn | NO U-TURN | circle | #ef4444 | #fff | — | R3-4 |
| noturnred | NO TURN RED | rect | #ef4444 | #fff | — | R10-11 |
| keepright | KEEP RIGHT | rect | #111 | #fff | — | R4-7 |
| keepleft | KEEP LEFT | rect | #111 | #fff | — | R4-8 |
| passleft | PASS ON LEFT | rect | #fff | #111 | #111 | R4-10 |
| notrucks | NO TRUCKS | circle | #ef4444 | #fff | — | R5-2 |
| nobicycles | NO BICYCLES | circle | #ef4444 | #fff | — | R5-6 |
| nopedestrians | NO PEDS | circle | #ef4444 | #fff | — | R5-10a |
| nothroughtraf | NO THRU TRAF | rect | #ef4444 | #fff | — | R11-4 |
| localonly | LOCAL ONLY | rect | #ef4444 | #fff | — | R11-4a |
| allwaystop | ALL WAY | rect | #ef4444 | #fff | — | R1-3 |
| 4waystop | 4 WAY | rect | #ef4444 | #fff | — | R1-3 |
| 3waystop | 3 WAY | rect | #ef4444 | #fff | — | R1-3a |
| weightlimit | WEIGHT LIMIT | rect | #fff | #111 | #111 | R12-1 |
| truckroute | TRUCK ROUTE | rect | #22c55e | #fff | — | M4-6 |
| noparking2 | NO PRKG TOW | rect | #fff | #111 | #111 | R7-2 |
| beginnopass | BEGIN NO PAS | rect | #fff | #111 | #111 | R4-1a |
| endnopass | END NO PASS | rect | #fff | #111 | #111 | R4-1b |
| rtlanemust | RT LANE MUST | rect | #fff | #111 | #111 | R3-7R |
| ltlanemust | LT LANE MUST | rect | #fff | #111 | #111 | R3-7L |
| yieldtopeds | YIELD TO PED | rect | #fff | #111 | #111 | R1-6 |
| sharedlane | SHARED LANE | rect | #fff | #111 | #111 | R4-11 |

> `sharedlane` (R4-11 "Bicycles May Use Full Lane") is regulatory — white on black border, placed here rather than Guide or Bicycle.

### Warning (+34 → 57 total)

| id | label | shape | fill | text | border | mutcd |
|---|---|---|---|---|---|---|
| stopahead | STOP AHEAD | diamond | #f97316 | #111 | — | W3-1 |
| yieldahead | YIELD AHEAD | diamond | #f97316 | #111 | — | W3-2 |
| speedredahead | SPEED REDUCE | diamond | #f97316 | #111 | — | W3-5 |
| crosstraffic | CROSS TRAFF | diamond | #f97316 | #111 | — | W2-1 |
| sideroad | SIDE ROAD | diamond | #f97316 | #111 | — | W2-2 |
| troad | T-ROAD | diamond | #f97316 | #111 | — | W2-4 |
| yroad | Y-ROAD | diamond | #f97316 | #111 | — | W2-5 |
| circularint | CIRCULAR INT | diamond | #f97316 | #111 | — | W2-6 |
| rightturn | RIGHT TURN | diamond | #f97316 | #111 | — | W1-1R |
| leftturn | LEFT TURN | diamond | #f97316 | #111 | — | W1-1L |
| sharpright | SHARP RIGHT | diamond | #f97316 | #111 | — | W1-3R |
| sharpleft | SHARP LEFT | diamond | #f97316 | #111 | — | W1-3L |
| reverseturn | REVERSE TURN | diamond | #f97316 | #111 | — | W1-4 |
| reversecurve | REVERSE CURV | diamond | #f97316 | #111 | — | W1-6 |
| mergeleft | MERGE LEFT | diamond | #f97316 | #111 | — | W4-1 |
| rightlaneends | RT LANE ENDS | diamond | #f97316 | #111 | — | W9-1 |
| leftlaneends | LT LANE ENDS | diamond | #f97316 | #111 | — | W9-2 |
| addedlane | ADDED LANE | diamond | #f97316 | #111 | — | W4-3 |
| lowshoulder | LOW SHOULDER | diamond | #f97316 | #111 | — | W8-9 |
| softshoulder | SOFT SHLDER | diamond | #f97316 | #111 | — | W8-4 |
| pavementends | PAVEMENT END | diamond | #f97316 | #111 | — | W8-3 |
| roughroad | ROUGH ROAD | diamond | #f97316 | #111 | — | W8-8 |
| icyroads | ICY ROADS | diamond | #f97316 | #111 | — | W8-5a |
| highwater | HIGH WATER | diamond | #f97316 | #111 | — | W8-17 |
| fallingrocks | FALLING ROCK | diamond | #f97316 | #111 | — | W8-14 |
| narrowbridge | NARR BRIDGE | diamond | #f97316 | #111 | — | W5-2 |
| onewaybridge | 1-WAY BRIDGE | diamond | #f97316 | #111 | — | W5-3 |
| truckrollover | TRK ROLLOVER | diamond | #f97316 | #111 | — | W1-11 |
| horsexing | HORSE XING | diamond | #f97316 | #111 | — | W11-7 |
| cattlexing | CATTLE XING | diamond | #f97316 | #111 | — | W11-4 |
| truckxing | TRUCK XING | diamond | #f97316 | #111 | — | W8-6 |
| bridgefreezes | BRDG MAY ICE | diamond | #f97316 | #111 | — | W8-13 |
| fogahead | FOG AHEAD | diamond | #f97316 | #111 | — | W8-5b |
| gradecrossing | GRADE CROSS | diamond | #f97316 | #111 | — | W10-1 |

> `signalahead` / SIGNAL AHEAD / W3-3 was dropped — duplicates the existing `signal` entry.
> `rightlaneends` and `leftlaneends` corrected to W9-1/W9-2 (Lane Ends); W4-2 is Merge, already covered by the existing `merge` entry.

### Temp Traffic Control (+30 → 46 total)

| id | label | shape | fill | text | border | mutcd |
|---|---|---|---|---|---|---|
| alt1way | ALT 1-WAY | rect | #f97316 | #111 | — | W20-4 |
| donotpassequip | DO NOT PASS | rect | #f97316 | #111 | — | W21-2 |
| roadsideequip | RDSIDE EQUIP | diamond | #f97316 | #111 | — | W21-6 |
| trucksentering | TRUCKS ENTER | diamond | #f97316 | #111 | — | W21-7 |
| utilitywork | UTILITY WORK | diamond | #f97316 | #111 | — | W21-8 |
| treework | TREE WORK | diamond | #f97316 | #111 | — | W21-9 |
| roadsidefire | RDSIDE FIRE | diamond | #f97316 | #111 | — | W21-10 |
| pilotcar | PILOT CAR | rect | #f97316 | #111 | — | W20-8 |
| nolanecross | NO LN CROSS | rect | #f97316 | #111 | — | W20-5 |
| sidewalkclosed | SDWLK CLOSED | rect | #f97316 | #111 | — | R9-10 |
| xwalkclosed | XWALK CLOSED | diamond | #f97316 | #111 | — | W11-2a |
| sharetheroadbk | SHARE RD BK | diamond | #f97316 | #111 | — | W11-15a |
| bikelaneahead | BIKE LN AHD | rect | #f97316 | #111 | — | R3-17 |
| rtlaneendsmile | RT LN ENDS | rect | #f97316 | #111 | — | W9-1a |
| ltlaneendsmile | LT LN ENDS | rect | #f97316 | #111 | — | W9-2a |
| reducedspdzn | REDCD SPD ZN | rect | #f97316 | #111 | — | W20-4a |
| truckspeed | TRUCK SPEED | rect | #f97316 | #111 | — | R2-4 |
| finesdoubled | FINES 2X | rect | #f97316 | #111 | — | R2-6 |
| flaggerstop | FLGR: STOP | rect | #f97316 | #111 | — | W20-7b |
| noparkingwz | NO PRKG WZ | rect | #f97316 | #111 | — | R7-9a |
| localdetour | LOCAL DETOUR | rect | #f97316 | #111 | — | M4-9 |
| detourarrow | DETOUR ARROW | rect | #f97316 | #111 | — | M4-10 |
| roadclsdahead | RD CLSD AHD | rect | #f97316 | #111 | — | R11-2b |
| singlelaneflag | 1-LN FLAG | rect | #f97316 | #111 | — | W20-4b |
| prepstoplite | PREP STOP LT | rect | #f97316 | #111 | — | W20-4c |
| roadnarrowed | RD NARROWED | diamond | #f97316 | #111 | — | W5-1a |
| workhours | WORK HOURS | rect | #f97316 | #111 | — | R2-7 |
| twowaytraf | TWO-WAY TRAF | diamond | #f97316 | #111 | — | W6-3 |
| shoulderwork | SHLDER WORK | diamond | #f97316 | #111 | — | W21-5a |
| emergdetour | EMERG DETOUR | rect | #f97316 | #111 | — | M4-8b |

### Guide & Info (+11 → 21 total)

Dropped from earlier draft: `hwyinfo` (I-2 — duplicates existing `info` at same code), `noparkingnorth2` (R7-1 — same code as existing `noparkingnorth`), `gasonly`/`lodging`/`telephone` (I-2a/b/c non-standard suffixes, low TCP value), `hwywork` (G20-3 doesn't exist in MUTCD).

| id | label | shape | fill | text | border | mutcd |
|---|---|---|---|---|---|---|
| deadend | DEAD END | rect | #fff | #111 | #111 | W14-1 |
| nooutlet | NO OUTLET | rect | #fff | #111 | #111 | W14-2 |
| trailhead | TRAILHEAD | rect | #22c55e | #fff | — | D1-2 |
| camping | CAMPING | rect | #22c55e | #fff | — | D9-3 |
| airport | AIRPORT | rect | #3b82f6 | #fff | — | D9-1 |
| biketrail | BIKE TRAIL | rect | #22c55e | #fff | — | D11-1a |
| diversionrte | DIVERSION RT | rect | #f97316 | #111 | — | M4-11 |
| evacroute | EVAC ROUTE | rect | #22c55e | #fff | — | EM-1 |
| speedadvtab | SPD ADV TAB | rect | #f59e0b | #111 | — | R2-3a |
| milesahead | 2 MILES | rect | #22c55e | #fff | — | W16-2a |
| restareadist | REST AREA MI | rect | #3b82f6 | #fff | — | D5-1a |

> `speedadvtab` (R2-3a) and `restareadist` (D5-1a) have distinct MUTCD codes from the existing `speedadvisory` (R2-3) and `restarea` (D5-1). Labels clarify the distinction. `camping` corrected from D6-1 → D9-3.

### School Zone (+5 → 12 total)

| id | label | shape | fill | text | border | mutcd |
|---|---|---|---|---|---|---|
| schoolspeed20 | 20 MPH SCH | rect | #f59e0b | #111 | — | S5-1a |
| schoolspeed25 | 25 MPH SCH | rect | #f59e0b | #111 | — | S5-1b |
| schopen | WHEN SCH OPN | rect | #f59e0b | #111 | — | S5-2 |
| schpedxing | SCH PED XING | diamond | #f59e0b | #111 | — | S1-1 |
| schoolbusstop | BUS STOP AHD | diamond | #f59e0b | #111 | — | S3-2 |

> `schpedxing` (S1-1, yellow diamond, School Zone) differs from existing `schoolxing` (S1-1, orange diamond, Warning) in color and category. Same MUTCD code — product should confirm if both are needed or if one should be removed.

### Bicycle & Pedestrian (+11 → 17 total)

Dropped `bikefulllane` — R4-11 is the same sign as `sharedlane` already added to Regulatory. Do not duplicate.

| id | label | shape | fill | text | border | mutcd |
|---|---|---|---|---|---|---|
| sharedusepath | SHARED USE | rect | #22c55e | #fff | — | R9-7a |
| pedsprohibited | PEDS PROHIB | rect | #ef4444 | #fff | — | R9-3a |
| crosshere | CROSS HERE | rect | #22c55e | #fff | — | R10-15 |
| bikelaneclosed | BIKE LN CLSD | rect | #f97316 | #111 | — | R9-10a |
| walkbike | WALK BIKE | rect | #22c55e | #fff | — | R9-6 |
| bikesexcept | BIKES EXCEPT | rect | #22c55e | #fff | — | R9-8 |
| nobikelane | NO BIKE LANE | rect | #f97316 | #111 | — | R3-17a |
| peddetour | PED DETOUR | rect | #f97316 | #111 | — | M4-8a |
| wchairxing | WCHAIR XING | diamond | #22c55e | #111 | — | W11-2b |
| hikingtrail | HIKING TRAIL | rect | #22c55e | #fff | — | D11-2 |
| horsetrail | HORSE TRAIL | rect | #22c55e | #fff | — | D11-3 |

> `sharedusepath` (R9-7a) and existing `sharedpath` (R9-7) have distinct MUTCD codes — both are valid.

---

## Summary

| Category | Before | Added | After |
|---|---|---|---|
| Regulatory | 20 | 27 | 47 |
| Warning | 23 | 34 | 57 |
| Temp Traffic Control | 16 | 30 | 46 |
| Guide & Info | 10 | 11 | 21 |
| School Zone | 7 | 5 | 12 |
| Bicycle & Pedestrian | 6 | 11 | 17 |
| **Total** | **82** | **118** | **200** |

---

## Files changed

| File | Change |
|---|---|
| `backend/generate_signs.py` | Add 118 tuples to `ALL_SIGNS`; also add missing `trafficcontrols` tuple to fix pre-existing drift |
| `backend/signs/*.svg` | Regenerate all SVGs by running `python backend/generate_signs.py` — do not hand-author |
| `my-app/src/features/tcp/tcpCatalog.ts` | Add 118 `SignData` entries across 6 categories; fix `schoolzone` mutcd W5-2 → S4-3 |

**S3 upload** (`python backend/generate_signs.py --upload`) is a deploy step, not a PR file. Run after merge.

---

## MUTCD audit note

These codes should be verified against the 2009 MUTCD before merge:

- `R4-11` (`sharedlane`) is the single authoritative entry for "Bicycles May Use Full Lane" — placed in Regulatory. `bikefulllane` (R4-11a) was dropped as a near-duplicate; do not re-add an R4-11 variant in the Bicycle & Pedestrian category.
- `W11-2b` (`wchairxing`) — W11-2 series is pedestrian warning; accessibility crossings may be R7-8
- `W20-4b/c` (`singlelaneflag`, `prepstoplite`) — confirm these suffixes exist
- `W9-1a/W9-2a` (`rtlaneendsmile`, `ltlaneendsmile`) — confirm suffix convention
- `EM-1` (`evacroute`) — verify; evacuation route signs vary by jurisdiction
- `S5-1a/b` school speed variants — confirm suffix conventions
- `W4-2` in the existing `merge` entry — W4-2 is Merge; `rightlaneends`/`leftlaneends` corrected to W9-1/W9-2
- W9-1 used by both new `rightlaneends` (Warning, "RT LANE ENDS") and the existing `rightlane` (TTC, "RIGHT LANE" / R3-7R — check actual code). Same MUTCD series, different signs and labels — not a duplicate.

---

## Acceptance criteria

- [ ] `ALL_SIGNS` in `generate_signs.py` and `SIGN_CATEGORIES` in `tcpCatalog.ts` have matching IDs (new parity test)
- [ ] `trafficcontrols` added to `generate_signs.py` `ALL_SIGNS` (fixes pre-existing drift)
- [ ] `schoolzone` mutcd corrected from W5-2 → S4-3 in `tcpCatalog.ts` (fixes pre-existing bug)
- [ ] Sign library has exactly 200 signs (82 existing + 118 new)
- [ ] All new signs have MUTCD codes; flagged codes audited before merge
- [ ] All new sign labels are ≤ 12 characters (new label-length test)
- [ ] All white-fill rect signs have `textColor: "#111"` and `border: "#111"`
- [ ] `backend/signs/` regenerated by running the script (no hand-authored SVGs)
- [ ] New test: sign IDs are unique across all categories
- [ ] New test: every catalog ID has a corresponding `.svg` in `backend/signs/`
- [ ] New test: no label exceeds 12 characters
- [ ] No unintended changes to the other 81 signs; `schoolzone` updated only as specified above (W5-2 → S4-3)
- [ ] All existing tests pass
