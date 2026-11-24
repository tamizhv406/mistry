# Floor Planner

The floor planner inside Mistry: true-scale 2D plan (walls, doors, windows, furniture, zones),
3D view, plan on a satellite map, electrical / water / drainage / floor-heating layers, and a
bill of materials with prices in ₹.

Based on House Planner by egmalt (MIT licence, see [LICENSE](LICENSE)), brought in from
`github.com/tamizhv406/floor-planer` on 2026-11-24 and adapted to Mistry.

## How it runs

- It is its own page, `floor-planner.html` (entry: `entry.tsx`). Mistry shows it full screen in a
  frame from `src/views/FloorPlannerHostView.tsx`, with `?plan=<floor plan record id>`. Its own
  page keeps its global styles, keyboard shortcuts and stores apart from the app.
- The plan list is `src/views/FloorPlanListView.tsx`; record helpers are in
  `src/services/floorPlannerRecords.ts`.
- The frame talks to Mistry with `postMessage` (same origin only), see `host.ts`:
  `back` (close), `estimate-area` (send built-up sq.ft to the Building Estimator) and, from the
  host, `close-request` (phone back button: finish saving, then close).
- Vercel must allow same-origin framing (`X-Frame-Options: SAMEORIGIN` in `vercel.json`).
  The service worker keeps a separate offline copy of `floor-planner.html`.

## Storage

`storage/mistry.ts` saves into the app's `floorPlans` table (IndexedDB), so Mistry's cloud sync
uploads plans with everything else. A planner record has `engine: 'house-planner'` and:

| Field | What it holds |
|---|---|
| `plannerPlan` | The plan, in the planner's format (millimetres) |
| `revision` | Save counter. A save from an older revision is a conflict and is merged (`storage/sync.ts`) |
| `plannerVersions` | The last 15 saves, for "Versions → All" |
| `plannerSnapshots` | Up to 20 versions saved by name |
| `buildingName`, `plotWidth`, `plotLength` (feet) | Copied from the plan for lists and search |

Records without `engine` were made by the planner Mistry had before 2026-11-24. They are kept
and listed as "Old planner", but cannot be opened here.

## Units

Plans are stored in millimetres. `i18n/lengthUnit.ts` decides how they are shown: feet-inches
by default (12'-6", areas in sq.ft, site area in cents, 3" drawing snap, 1' grid), or metres,
switched from the ⋯ menu and remembered per device. Typed lengths accept `12'6"`, `12'-6"`,
`12 6`, `12ft 6in`, `6 1/2"`, `3.5m`, `350cm`, `3500mm`; a plain number is feet in feet mode.
Engineering figures in the network layers (pipe coils, screed, heat output) stay metric.

## Changes from the original

- No PHP server, login, demo banner or info page: Mistry handles accounts and storage.
- Money in ₹ with Indian digit grouping; the price catalog (`public/floor-planner/data/catalog.json`)
  starts empty; the Russian petrovich.ru cart is removed.
- The map starts over India; the original's sample neighbouring parcels are not loaded.
- Assets live under `public/floor-planner/` (3D furniture models, textures, the sample plan).

Tests: `tests/test_floor_planner_integration.ts`.
