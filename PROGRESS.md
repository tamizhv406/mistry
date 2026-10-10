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

## Not done yet

See the "Next steps" section at the end of this file. It is rewritten at the end of every work session.

## Next steps

1. Floor Planner (flagship): make the existing editor fully usable on a phone, verify drawing, snapping, rooms,
   doors/windows, floors, undo/redo, autosave and reload, 3D preview and export; add tests for anything not covered.
2. Supabase: decide whether cloud sync is wanted (see README "Data and Supabase"). Nothing is synced today.
3. README rewrite for the new structure.
