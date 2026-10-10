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

## Not verified / known limits

- The 3D preview opens from the editor and reads the same floor data, but it was not re-tested in this pass.
- DXF export is unchanged (wall centre-lines only) and was not re-tested.
- The classic "All ledgers" screens still work and now use the shared salary ledger, but keep their older look.
- Not tested on a physical phone; testing used Edge with touch emulation at 390 x 844.
- Supabase: nothing is synced. See README "Data and privacy".

## Next steps

1. Try the app on a real Android phone (install from the browser menu) and note anything awkward.
2. Decide whether cloud backup/sync is wanted. If yes: design tables to match `src/db/types.ts`, add RLS
   per project owner, and sync from IndexedDB. Do not put a service-role key in the frontend.
3. Re-test 3D preview and DXF export against multi-floor plans.
4. Restyle the classic ledger screens with `src/styles/mobile.css`, or retire the ones the new screens replace.
5. Merge: review the branch, then `git checkout main && git merge feature/mobile-first-overhaul`.