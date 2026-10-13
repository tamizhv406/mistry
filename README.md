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

Sign in or register using Supabase Auth when Supabase is configured. Local demo authentication and local administrator bootstrap are disabled. The sample project is available for exploring the interface and is not an authenticated account.

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

Business records are stored in the browser's IndexedDB (via Dexie) for offline use. When configured, Supabase Auth verifies account identity and the Supabase cloud sync stores records under row-level security. The client-side role cache is only for display; database policies are the authorization boundary.

- **Backup & Data** (More menu) downloads and restores records available to your account. Sub-admin exports follow the read scopes assigned to that account. Keep a backup: clearing browser data or uninstalling removes the records.
- Deleted records go to the **Recycle Bin** and can be restored.
- Passwords are handled by Supabase Auth; the app does not create local-password accounts or local OTP recovery credentials.

### Cloud backup (Supabase)

When configured, a signed-in user can enable cloud backup under More → Backup & Data. Each record is stored as one JSON document protected by row-level security; the newer copy of a record always wins. Admin scopes also depend on the reviewed and applied authorization migration.

The repository setup notes report migration 002 was previously applied, but that state has not been independently re-verified in this work. Migration 003 and live RLS behavior must be reviewed and verified before claiming production authorization is enabled. Setup steps and limits: [docs/SUPABASE_SETUP.md](docs/SUPABASE_SETUP.md).

## Android app

The app is packaged for Android with Capacitor (`android/`). Build steps, signing, and the Play Store checklist with what is still open: [docs/ANDROID_RELEASE.md](docs/ANDROID_RELEASE.md).

## Website (Vercel)

The website is built by Vercel from this repository: `npm run build`, output in `dist/` (`vercel.json`). A push to the production branch publishes a new version. Unknown paths are answered with the app itself.

Records are stored per website address. What was entered at `http://localhost:5173` or on another address does not appear on the website: move it with Backup & Data (save to a file, then restore), or with cloud backup once that is set up.

## Environment variables

All optional. For development create `.env.local` (never commit it); for the website set them in Vercel under Project → Settings → Environment Variables and redeploy. `.env.example` lists them with notes. Every `VITE_` value is compiled into the app and is public.

```
VITE_SUPABASE_URL=            # Supabase project URL
VITE_SUPABASE_ANON_KEY=       # public anon / publishable key only; never a service-role key
VITE_AI_DESIGN_FUNCTION=      # optional Edge Function name; the AI key stays server-side
```

No client-side environment variable grants an elevated role. Supabase Auth configuration is required for account sign-in; local demo/admin authentication is disabled.

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
