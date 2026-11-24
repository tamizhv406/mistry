# Mistry mobile-first overhaul — progress

Branch: `feature/mobile-first-overhaul` (local only, nothing pushed). `main` is untouched.

The first commit on the branch (`chore: checkpoint existing uncommitted work…`) is a snapshot of the
uncommitted changes that were in the working tree when this work started. Everything after it is new.

## How to run

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # all suites
npm run build
npm run lint
```

Git is not on this machine's PATH. GitHub Desktop's bundled copy works:
`%LOCALAPPDATA%\GitHubDesktop\app-<version>\resources\app\git\cmd\git.exe`.

## Done and verified

Each item was exercised in a 390 px phone viewport (Edge, touch emulation) as well as by automated tests.

| Area | State |
| --- | --- |
| Baseline | Lint, build and all 14 original test suites passed before any change and still pass. |
| Dates | Calendar days use Asia/Kolkata everywhere (was UTC: "today" was yesterday before 5:30 am). |
| Data | Dexie schema v8, additive only. v7 → v8 upgrade tested to keep existing sites, attendance and floor plans. |
| Backup | Backup/restore now includes floor plans and the new tables (floor plans were previously left out). |
| Shell | One mobile top bar with project switcher; bottom nav Home, Projects, Floor Plan, Reports, More. |
| Home | Per-project dashboard: labour today, money, materials, quick actions, recent activity with date and time. |
| Attendance | One-tap Present / Half Day / Leave / Absent / Overtime, past-date correction, search, daily + monthly + salary views. |
| Worker profile | Calendar, exact clickable date lists per status, salary breakdown, payments, advances, correction log. |
| Salary | Single ledger in `src/domain/salary.ts`. Leave pay is an explicit per-project choice. No double deduction. |
| Materials | Stock list, purchases with cement brand/type catalog, usage, returns, adjustments, void-with-reason history. |
| Tools | Catalog with 27 licensed photographs, add custom tools with own photo, issue / return / condition / history. |
| Expenses | Quick add, date and category filters, search, in-place correction, duplicate guard. |
| Reports | Recorded expenditure, paid out, still to pay, monthly, materials, labour, tools. CSV export and print. |

Bugs found in the existing code and fixed along the way:

- Editing a salary payment or advance added a second ledger row, doubling the paid amount.
- Three screens used three different rules for which advances are deducted.
- Labour cards printed `₹{l.worker.dailyWage}` literally (11 template strings).
- Two overlapping mobile headers; dialog buttons hidden under the bottom navigation.
- Toast messages never closed while the app was busy (timer restarted on every render).

## Formula reference

- Salary: `pending = wages earned − salary paid − recoverable advances`. Day values: Present 1, Half Day 0.5,
  Overtime 1.5, Absent 0, Leave 1 if the project pays leave, otherwise 0. See `src/domain/salary.ts`.
- Stock: `on hand = purchases + opening + adjustments in − usage − returns − adjustments out`. See `src/domain/stock.ts`.
- Tools: `available = total − issued − lost`. See `src/domain/toolTracking.ts`.
- Reports: "recorded expenditure" (by event date) and "paid out" (payments ledger) are separate. See `src/domain/reports.ts`.

## Floor Planner (done and verified on a phone viewport)

- Full-screen editor on phones; create dialog button no longer hidden behind the navigation.
- One pointer-based input path: two fingers pinch-zoom (anchored between the fingers) and never draw;
  placing tools act on a tap; walls can be drawn by dragging or by tapping both ends; elements and wall
  corners can be dragged with a finger; follow-up "ghost clicks" after a tap are ignored.
- Rooms are derived from connected walls of any shape (shared and T-junction walls included), with exact
  area; they follow wall edits and keep their names. No guessed room types.
- Joined walls stay joined when a wall or corner is moved; doors/windows follow or go with their wall.
- Doors and windows must be on a wall, fit it, and not overlap; refusals are explained in plain words.
- Floors: add, rename, duplicate, delete through tested functions; per-floor undo history.
- Saving: all floors together, autosave after 1.5 s, save on Back / background / close, real thumbnail.
- Export: picture (whole plan, with units and disclaimer), print/PDF, plan file that Import reads back.
- Units: feet or metres only for new plans; fixed wrong areas for legacy inches/centimetre plans.

Bugs fixed here: deleting a floor could overwrite another floor's walls; undo after switching floors loaded
the other floor; edits made within 3.5 s of leaving were lost; the saved thumbnail was a dead `blob:` link;
autosave showed a toast every time; pinch zoom ran away; importing the app's own export failed.

## Stabilization and Android pass

Checkpoint before this pass: git tag `checkpoint/pre-stabilization`.

Done and verified (automated tests plus a 390 px touch-emulated run on the production build):

- Floor Planner performance, measured on a 262-wall / 120-room plan with 4x CPU throttling:
  pan p95 frame time 167 ms -> 18 ms, pinch 333 ms -> 17 ms. Pan and pinch now move the drawing with a
  CSS transform and write pan/zoom to state once, at the end; pointer moves are handled once per frame.
- Touch safety: a drag only moves an element that is already selected (first tap selects); rooms that come
  from walls are not dragged on their own.
- Saves are one-at-a-time and revision-checked. If another tab or device saved the plan first, the save is
  refused and the user chooses "Keep my version" or "Load the other version" (22 persistence checks).
- Offline: the service worker now refreshes its cached app shell.
- Release hygiene: demo accounts (public password) are not created and demo login is hidden in production
  builds; in-app "Delete my account" removes the person's data only (tested).
- Cloud backup: `mistry_records` migration, sync engine, sign-in UI and background sync
  (25 checks against an in-memory stand-in). See docs/SUPABASE_SETUP.md.
- Android: Capacitor project in `android/`; a debug APK builds (`android/app/build/outputs/apk/debug/app-debug.apk`).
  See docs/ANDROID_RELEASE.md.
- 3D preview opens and renders walls, rooms and doors from the same floor data (checked once, on the large plan).

## Not verified / known limits

- **Supabase has not been exercised for real.** The only project on the connected account is paused; its
  schema could not be read and the migration has not been applied. Cloud backup is off until
  docs/SUPABASE_SETUP.md is followed.
- **No real-device test.** The APK was built but not installed on a phone. All interaction testing used
  Edge with touch emulation.
- No release (signed) build was made; there is no keystore, privacy policy or Play listing yet.
- Drawing a wall on a very large plan still re-renders every frame (about 130 ms p95 at 4x throttle with
  260 walls); ordinary house plans are far smaller. Fixing it properly means splitting the 9,700-line editor
  component so static layers do not re-render.
- DXF export was not re-tested. The classic "All ledgers" screens work but keep their older look.
- Android's WebView has no speech recognition, so voice input is unavailable in the packaged app.

## Next steps

1. Install `app-debug.apk` on a real phone and walk through docs/ANDROID_RELEASE.md "Still open".
2. Supabase: restore/choose the project, run migration 002, add the two env values, test with two devices.
3. Decide the application ID, the initial-administrator question and Android auto-backup (all in the checklist).
4. Create the upload keystore, privacy policy and Play listing; build the signed bundle.
5. Merge: review the branch, then `git checkout main && git merge feature/mobile-first-overhaul`.