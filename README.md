# Mistry

A simple, mobile-first construction site manager for contractors, site engineers and building owners in India.
It runs in the browser, installs to a phone's home screen, and works offline.

Each **project** keeps its own floor plans, workers and attendance, materials and stock, tools, expenses and reports.

## What it does

| Area | What you can do |
| --- | --- |
| **Home** | Pick a project. See today's attendance, today's expenses, pending salary, advances, stock and recent activity. |
| **Floor Planner** | Draw walls by tapping or dragging, with live lengths and snapping. Rooms appear automatically when walls close, with exact area. Doors and windows sit on walls. Several floors per plan. Undo/redo, autosave, 3D preview, picture / print / plan-file export. |
| **Attendance & Salary** | One tap per worker: Present, Half Day, Leave, Absent, Overtime. Correct any past day. Each worker has a calendar, exact date lists per status, and a salary breakdown with every payment and advance. |
| **Materials** | Record purchases (cement by brand and type), usage, returns and adjustments. Stock balance and full movement history per item. |
| **Tools** | Tool catalog with photographs. Issue tools to people and record returns with date, time and condition. |
| **Expenses** | Quick entry for tea, fuel, transport, bills and more. Search and filter by date and category. |
| **Reports** | Recorded expenditure, cash paid out, what is still to pay, month by month, materials, labour and tools. CSV export and print / save as PDF. |

Dates and times are shown in India time (Asia/Kolkata). Money is shown in rupees with Indian digit grouping.

## Run it

Requires Node.js 20 or newer.

```bash
npm install
npm run dev      # http://localhost:5173
```

```bash
npm test         # all automated tests
npm run build    # production build in dist/
npm run lint
```

Register an account on the sign-in screen, then use **Try a sample project** on the home screen to explore with demo data. In development builds a one-tap demo login is also shown; production builds do not create the demo accounts.

## How the numbers are worked out

**Salary** (`src/domain/salary.ts`)

```
day value   Present 1 · Half Day 0.5 · Overtime 1.5 · Absent 0
            Leave 1 if the project pays leave, otherwise 0
earned      sum of (day value × daily wage on that day)
pending     earned − salary paid − advances to be deducted
```

- Whether Leave is paid is chosen per project (Attendance & Salary → Salary). Until it is chosen, leave counts as unpaid and the app says so.
- A day's wage is fixed when the day is marked, so a later wage change does not rewrite past days.
- Advances marked "gift" are recorded but never deducted.
- A worker who has been paid more than earned is shown as "paid ahead"; that is never subtracted from what other workers are owed.
- Saving the same payment twice on one day asks for confirmation first.

**Stock** (`src/domain/stock.ts`): `in stock = purchases + stock already on site + adjustments in − used − returned − adjustments out`.
Usage can not exceed stock. A wrong entry is cancelled with a reason and stays visible in the history.

**Tools** (`src/domain/toolTracking.ts`): `available = total − issued − lost`.

**Reports** (`src/domain/reports.ts`): "Recorded expenditure" counts what was bought and the wages earned in the period, paid or not. "Paid out" counts cash that actually left, from the payments ledger. They are different questions and are shown separately.

## Floor Planner notes

- Plan coordinates are stored in **feet** or **metres** (1 ft = 0.3048 m exactly). Feet plans show feet and inches.
- A room made from walls follows those walls: move a wall or corner and the room's outline and area are recalculated. Its name is kept.
- Moving a corner moves every wall that meets there, so joined walls stay joined.
- A door or window must be on a wall, fit within it, and not overlap another opening.
- Each floor has its own undo history. All floors are saved together; changes are saved automatically, and again when you leave the editor or the app goes to the background.
- Touch: two fingers always zoom and pan; a placing tool acts on a tap, never on a drag.
- A plan drawn here is a **conceptual layout**. It is not a certified structural or architectural drawing; verify all dimensions on site.

## Data and privacy

All records are stored **on the device**, in the browser's IndexedDB (via Dexie). Nothing is sent to a server.

- **Backup & Data** (More menu) saves everything to a file and restores it. Keep a backup: clearing browser data or uninstalling removes the records.
- Deleted records go to the **Recycle Bin** and can be restored.
- Passwords are stored as SHA-256 hashes on the device. This protects against casual access on a shared phone; it is not a substitute for a server-side account system.

### Cloud backup (Supabase)

Optional. When it is set up, a user can sign in under More → Backup & Data → Cloud backup and their records are copied to their own Supabase account and restored on another phone. Each record is stored as one JSON document protected by row-level security; the newer copy of a record always wins.

The code and migration are written and tested against a stand-in, but **have not yet been run against a real Supabase project**. Setup steps, security model and limits: [docs/SUPABASE_SETUP.md](docs/SUPABASE_SETUP.md).

## Android app

The app is packaged for Android with Capacitor (`android/`). Build steps, signing, and the Play Store checklist with what is still open: [docs/ANDROID_RELEASE.md](docs/ANDROID_RELEASE.md).

Optional environment variables (create `.env.local`; never commit it):

```
VITE_SUPABASE_URL=            # project URL
VITE_SUPABASE_ANON_KEY=       # public anon key only. Never put a service-role key in the frontend.
VITE_INITIAL_ADMIN_EMAIL=     # optional
VITE_INITIAL_ADMIN_USERNAME=  # optional
VITE_INITIAL_ADMIN_HASH=      # optional, SHA-256 of the initial admin password
VITE_ENABLE_DEMO_LOGIN=       # optional; `true` keeps the demo accounts in a production build (public password)
```

Without these the app runs fully offline, which is the tested configuration.

## Project layout

```
src/
  domain/        Pure, tested business rules (salary, stock, tools, reports, floor-plan geometry and document)
  services/      Database writes with access checks (records.ts), auth, floor plan storage
  db/            Dexie schema (v8) and types
  utils/         India-time date helpers, rupee formatting
  views/mobile/  Home, Attendance, Worker profile, Materials, Tools, Expenses, Reports
  views/         Floor planner, project list, classic ledgers, admin
  components/mobile/  Shared phone UI: bottom sheet, day picker, navigation
  styles/mobile.css   Design system for the phone screens
public/tool-images/   Tool photographs and CREDITS.md
tests/           Run with `npm test`
```

## Credits

Tool photographs are from Wikimedia Commons under CC0, public domain, CC BY and CC BY-SA licences.
Authors, licences and source links are listed in [public/tool-images/CREDITS.md](public/tool-images/CREDITS.md).
