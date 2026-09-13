# BUILDING MISTRY 🏗️
### Complete Construction Site, Materials, Labour & Financial Management Web Application

Building Mistry is a complete, production-ready, mobile-friendly, offline-capable construction site management application crafted for building mistries, civil contractors, site supervisors, and builders. It provides an intuitive, high-contrast visual interface designed to be effortlessly operated even by someone without a formal technical background.

---

## 🔑 Login & Access Credentials

Building Mistry includes an authentication and role-based session system with SHA-256 cryptographic password hashing:

- **Default Supervisor Username**: `admin`
- **Default Password**: `mistry123`
- **1-Click Demo Login**: Available directly on the login screen
- **New Registration**: Users can register with custom username, mobile number, email, and supervisor/mistry/contractor role.

---

## 🚀 Key Features

1. **Authentication & Session Security**:
   - Secure login via Username, Mobile Number, or Email.
   - Show/hide password toggle.
   - "Remember Me" persistent local session.
   - User profile badge with role display and quick Logout button in header and mobile navigation.

2. **Dashboard & Site Multi-Tenancy**:
   - Live dashboard metrics: Total Sites, Active Sites, Completed Sites, Overall Site Expenses, Amount Paid, and Pending Cash Balance.
   - Categorized expense pills (Material, Labour Wages, Tools, Tea & Snacks, Pooja, Electricity, Water, Other Expenses).
   - Dedicated **"My Sites"** management screen with real-time keyword search and status filter pills.
   - Interactive site cards with financial gauges, owner contact details, location, and building type.

3. **Site Dashboard Visual Card Grid (13 Modules)**:
   A visual card & icon grid on the Site Overview allows 1-tap navigation to every section with breadcrumb back-navigation:
   1. 🧱 **Materials**: Sand, M-Sand, Cement, Rods & Bricks with live item counts and total invoice cost.
   2. 👷 **Labour Roster**: Sithaal, Periyaal, Mistry worker directory and wage configuration.
   3. 📅 **Attendance**: Daily shift log with Present (1.0), Half Day (0.5), Overtime (1.5), and Absent (0).
   4. 💰 **Salary & Wages**: Real-time worker salary cards grouped by trade with gross earnings, advances deducted, and net balance due.
   5. 💵 **Labour Advances**: Loan and advance tracking with deduction logs.
   6. 🔨 **Tools & Machinery**: Equipment inventory, rental balances, and supplier logs.
   7. ☕ **Tea & Snacks**: Daily food and beverage expenses with daily/weekly/monthly filters.
   8. 🙏 **Pooja Ceremonies**: Bhoomi Pooja, Column Pooja, Roof Slab, Vasthu, Housewarming ceremony expense breakdown.
   9. 💡 **Electricity Bills**: EB monthly bills, meter consumer numbers, and payments.
   10. 💧 **Water Supplies**: Tanker deliveries (liters/loads) and borewell charges.
   11. 📦 **Other Expenses**: Transport, repairs, fuel, equipment hire, and miscellaneous site expenses.
   12. 📝 **Site Notes & Diary**: Timestamped supervisor notes with category tags.
   13. 📊 **Cost Reports & Statements**: Comprehensive site financial statement with A4 printable layout and 1-click CSV export.

4. **Dedicated Worker Salary Cards (Grouped by Trade)**:
   - Workers are grouped into dedicated cards by category: **MISTRY**, **PERIYAAL**, and **SITHAAL**.
   - Each card displays: Days worked, daily wage, gross salary earned, advance taken, amount disbursed, and pending balance.
   - Highlighted dues clearly signal who is owed money on pay day.

5. **Steel Rods Managed Separately by Diameter**:
   - Steel rods tracked strictly by diameter (`6 mm`, `8 mm`, `10 mm`, `12 mm`, `16 mm`, `20 mm`, `25 mm`, custom).
   - Automatic **Steel Rod Diameter Summary Table** calculating total kilograms per rod size across deliveries.

6. **Delete + Recovery (Trash / Recycle Bin)**:
   - Safe deletion: Standard delete buttons move items to the **Recycle Bin** without destroying data.
   - Dedicated Recycle Bin screen to view, filter, and **Restore** items back to active site ledgers.
   - **Permanent Delete** requires explicit confirmation with clear hazard warnings.

7. **Mobile-First Experience**:
   - Fixed **Mobile Bottom Navigation Bar** on smartphones for one-thumb switching between Dashboard, My Sites, Recycle Bin, Backup, and Logout.
   - Quick Add shortcuts for mistry on site.

8. **Data Safety & Offline Persistence**:
   - Industrial browser database powered by **IndexedDB (via Dexie.js)**.
   - Data persists across browser refreshes, tab closures, and computer restarts.
   - **1-Click JSON Backup & Restore**: Export full database snapshots or transfer data across devices.
   - **DEMO Data Loader & Purger**: Test the application with sample data without polluting real records.
   - **Activity Audit Logging**: Tracks create, delete, restore, and auth events.

---

## 💻 Technology Stack

- **Frontend Framework**: React 19 + TypeScript (Strict Type Safety)
- **Bundler & Dev Server**: Vite 8
- **Database / Persistence**: Dexie.js (Relational IndexedDB client database with reactive live queries)
- **Styling**: Modern Vanilla CSS Design System with construction color tokens (`--accent-amber`, `--primary`, slate/charcoal contrast, mobile touch targets)
- **Iconography**: Lucide React
- **Test Runner**: tsx + fake-indexeddb

---

## 📦 Installation & Setup

1. **Navigate to Project Root**:
   ```bash
   cd c:\Users\tamiz\OneDrive\project\mistry
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Run Development Server**:
   ```bash
   npm run dev
   ```
   Open your browser at: `http://localhost:5173`

4. **Run Business Logic & Database Tests**:
   ```bash
   npm run test
   ```

5. **Build for Production**:
   ```bash
   npm run build
   ```
   The optimized production bundle is generated in the `dist/` directory.

---

## 🔒 Data Persistence & Schema

1. **IndexedDB Engine**:
   - User data is written directly to the client computer's IndexedDB storage using `Dexie.js`.
   - IndexedDB is not constrained by `localStorage` size limits and handles thousands of transactions effortlessly.
   - Data persists permanently across closing the application, refreshing the page, or restarting the computer.

2. **15 Relational Tables**:
   - `sites` (Project metadata, owner details, address, status, budget)
   - `materials` (Sand, M-Sand, Cement, Bricks)
   - `rodEntries` (Steel rods strictly separated by diameter)
   - `workers` (Sithaal, Periyaal, Mistry roster and daily wages)
   - `attendance` (Daily shift multipliers)
   - `labourAdvances` (Worker loans and advance deductions)
   - `salaryPayments` (Disbursed salary payments)
   - `tools` (Owned & rented tools and machinery)
   - `teaSnacksExpenses` (Daily refreshments)
   - `poojaExpenses` (Ceremony expenses)
   - `electricityBills` (Monthly EB charges)
   - `waterBills` (Water tanker deliveries)
   - `otherExpenses` (Transport, repair, fuel, equipment hire, misc)
   - `siteComments` (Supervisor progress diary)
   - `users` (Hashed credentials and supervisor profile)
   - `activityLogs` (Audit trail of site operations)

---

## 🧪 Testing Verification Summary

The project includes an automated test suite in `tests/test_mistry_core.ts` covering 12 core suites:
1. Clean empty initial database state
2. Demo data loading with real construction items
3. Material calculations (`Quantity × Rate = Total`, `Total - Paid = Balance`)
4. Steel rod diameter grouping and aggregate tables
5. Attendance-based gross wage calculations (`Days × Daily Wage`)
6. Advance deductions and net salary settlements
7. Soft-delete moving records to the Recycle Bin
8. Full restoration of deleted items back to active ledgers
9. Permanent deletion erasing raw records
10. Other expenses CRUD, category badges, and balance calculations
11. Activity audit logging
12. Authentication system, SHA-256 password hashing, valid credentials login, invalid credentials rejection, user registration, and demo purging

Run anytime via:
```bash
npm run test
```
