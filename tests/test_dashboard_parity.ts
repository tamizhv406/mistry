/**
 * Dashboard (Task 5): the phone Home screen and the desktop Dashboard compute today's numbers
 * with one function, so they always agree; the app opens on the last viewed project; the low
 * stock preview shows at most 3 items and recent activity at most 5; a signed-in user stays
 * signed in when the app opens offline.
 */
import 'fake-indexeddb/auto';
import fs from 'node:fs';
import path from 'node:path';
import type { ActivityLog, AttendanceRecord, LabourWorker, Site, StockMovement, User } from '../src/db/types';

let passed = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (!cond) throw new Error(`FAILED: ${name}${detail !== undefined ? ' — got ' + JSON.stringify(detail) : ''}`);
  passed += 1;
  console.log(`  ✓ ${name}`);
}

const stamp = '2026-10-01T04:00:00.000Z';
const owner: User = { id: 'u-dash', username: 'dash', fullName: 'Dash Owner', mobile: '', email: 'd@x.in', passwordHash: 'x', role: 'MISTRY', isActive: true, createdAt: stamp };

async function run() {
  const { db } = await import('../src/db/db');
  const svc = await import('../src/services/records');
  const dash = await import('../src/domain/dashboard');
  const { loadProject } = await import('../src/hooks/useProject');
  const { loadOverallStats } = await import('../src/hooks/useOverallStats');
  const { keepSignedInOffline } = await import('../src/services/auth');
  const { todayKey, addDays } = await import('../src/utils/datetime');
  await db.open();
  await svc.ensureCatalogSeeded();

  const today = todayKey();
  const yesterday = addDays(today, -1);
  const site = (id: string, name: string, status: Site['status'] = 'Active', createdAt = stamp): Site => ({
    id, userId: owner.id, name, ownerName: 'A', ownerPhone: '', address: '', area: '', buildingType: 'House',
    startDate: '2026-09-01', expectedCompletionDate: '2027-03-01', status, isDeleted: false, createdAt, updatedAt: createdAt,
  });
  await db.sites.bulkPut([site('pa', 'Anna Nagar House'), site('pb', 'Tambaram Villa')]);

  const worker = (id: string, siteId: string, name: string, dailyWage: number): LabourWorker => ({
    id, siteId, userId: owner.id, name, phone: '', category: 'MISTRY', dailyWage, joiningDate: '2026-09-01', isDeleted: false, createdAt: stamp, updatedAt: stamp,
  });
  await db.workers.bulkPut([
    worker('wa1', 'pa', 'Murugan', 1000), worker('wa2', 'pa', 'Selvam', 800), worker('wa3', 'pa', 'Arun', 700),
    worker('wa4', 'pa', 'Ravi', 700), worker('wa5', 'pa', 'Kumar', 600), { ...worker('wa6', 'pa', 'Gone', 600), isDeleted: true },
    worker('wb1', 'pb', 'Babu', 1000),
  ]);
  const mult = { present: 1, half_day: 0.5, overtime: 1.5, absent: 0, leave: 0 } as const;
  let n = 0;
  const att = (siteId: string, workerId: string, date: string, status: AttendanceRecord['status']): AttendanceRecord => ({
    id: `at-${++n}`, siteId, workerId, userId: owner.id, date, status, dayMultiplier: mult[status], isDeleted: false, createdAt: stamp, updatedAt: stamp,
  });
  await db.attendance.bulkPut([
    att('pa', 'wa1', today, 'present'), att('pa', 'wa1', today, 'present'),   // marked twice: counted once
    att('pa', 'wa2', today, 'overtime'), att('pa', 'wa3', today, 'half_day'), att('pa', 'wa4', today, 'absent'),
    att('pa', 'wa6', today, 'present'),                                       // a removed worker: not counted
    att('pa', 'wa1', yesterday, 'present'), att('pa', 'wa5', yesterday, 'present'), // yesterday: not today
    att('pb', 'wb1', today, 'present'),
  ]);
  await db.labourAdvances.put({ id: 'adv-b', siteId: 'pb', workerId: 'wb1', userId: owner.id, date: today, amount: 300, advanceType: 'Recoverable', isDeleted: false, createdAt: stamp, updatedAt: stamp });
  await db.salaryPayments.put({
    id: 'pay-a', siteId: 'pa', workerId: 'wa1', userId: owner.id, date: today, daysWorked: 1, grossSalary: 1000, advanceDeducted: 0,
    paidAmount: 500, balance: 0, extraPaid: 0, isDeleted: false, createdAt: stamp, updatedAt: stamp,
  });

  // Expenses: today and another day, on both projects.
  const tea = (id: string, siteId: string, date: string, total: number) => ({
    id, siteId, userId: owner.id, date, teaExpense: total, snacksExpense: 0, juiceExpense: 0, otherFoodExpense: 0, totalAmount: total,
    paidAmount: total, balance: 0, extraPaid: 0, isDeleted: false, createdAt: stamp, updatedAt: stamp,
  });
  await db.teaSnacksExpenses.bulkPut([tea('t1', 'pa', today, 240), tea('t2', 'pa', yesterday, 999), tea('t3', 'pb', today, 150), { ...tea('t4', 'pa', today, 5000), isDeleted: true }]);
  await db.otherExpenses.put({
    id: 'o1', siteId: 'pa', userId: owner.id, date: today, category: 'Transport' as never, description: 'Lorry', amount: 1200, paidAmount: 0,
    balance: 1200, extraPaid: 0, isDeleted: false, createdAt: stamp, updatedAt: stamp,
  });

  // Stock: five low items on project A, plenty of the same cement on project B.
  const buy = async (siteId: string, category: string, materialName: string, quantity: number, unit: string, rate = 100) => {
    const r = await svc.recordPurchase(owner, siteId, { category: category as never, materialName, quantity, unit, rate, paidAmount: 0, purchaseDate: yesterday, supplier: 'S' });
    if (!r.ok) throw new Error(r.error);
  };
  await buy('pa', 'cement', 'Ramco PPC Cement', 8, 'Bags', 395);
  await buy('pb', 'cement', 'Ramco PPC Cement', 200, 'Bags', 395);
  await buy('pa', 'sand', 'River Sand', 1, 'CFT', 50);
  await buy('pa', 'bricks', 'Red Clay Bricks', 500, 'Nos', 9);
  await buy('pa', 'other', 'PVC Pipe', 2, 'Length', 300);
  await buy('pa', 'other', 'Electrical Wire', 40, 'Bundle', 1400);
  for (const [name, category, level, unit] of [
    ['Ramco PPC Cement', 'cement', 10, 'Bags'], ['River Sand', 'sand', 100, 'CFT'], ['Red Clay Bricks', 'bricks', 1000, 'Nos'], ['PVC Pipe', 'other', 10, 'Length'],
  ] as const) {
    const r = await svc.setLowStockLevel(owner, { name, category }, level, unit);
    if (!r.ok) throw new Error(r.error);
  }
  // An old record that took stock below zero (data from before usage was checked).
  const neg: StockMovement = {
    id: 'mv-neg', siteId: 'pa', userId: owner.id, itemName: 'M-Sand (Concrete)', itemKey: 'msand|m-sand (concrete)', category: 'msand', unit: 'CFT',
    movementType: 'usage', quantity: 30, eventDate: today, isDeleted: false, createdAt: stamp, updatedAt: stamp,
  } as unknown as StockMovement;
  await db.stockMovements.put(neg);

  // Activity: 8 entries on project A (plus what the services logged), 2 on project B.
  const logs: ActivityLog[] = [];
  for (let i = 0; i < 8; i++) logs.push({ id: `log-a${i}`, siteId: 'pa', siteName: 'Anna Nagar House', action: 'TEST', description: `A entry ${i}`, timestamp: `2030-01-0${i + 1}T10:00:00.000Z` });
  logs.push({ id: 'log-b1', siteId: 'pb', siteName: 'Tambaram Villa', action: 'TEST', description: 'B entry', timestamp: '2030-02-01T10:00:00.000Z' });
  await db.activityLogs.bulkPut(logs);

  console.log('\n--- 1. Phone and desktop show the same numbers for one project ---');
  const catalog = await db.catalogItems.toArray();
  const projectA = await loadProject('pa');
  if (!projectA) throw new Error('project A missing');
  const phone = dash.buildDashboardSummary(dash.projectDashboardInput(projectA, catalog), today);
  const desk = await loadOverallStats(owner, 'pa');
  const d = desk.dashboard;
  const pick = (s: typeof phone) => ({
    present: s.presentToday, workers: s.workerCount, notMarked: s.notMarkedToday, expenses: s.todaysExpenses, expenseCount: s.todaysExpenseCount,
    lowCount: s.lowStockCount, lowTop: s.lowStockTop.map(i => `${i.name}=${i.onHand}`), pending: s.pendingSalary, recent: s.recentActivity.map(a => a.id),
  });
  check('Every dashboard number is identical on phone and desktop', JSON.stringify(pick(phone)) === JSON.stringify(pick(d)), { phone: pick(phone), desk: pick(d) });
  check('The desktop cards read the same values (present, low stock)',
    desk.attendanceToday.present === phone.presentToday && desk.materialStock.lowStockCount === phone.lowStockCount && desk.attendanceToday.unmarked === phone.notMarkedToday);

  console.log('\n--- 2. The numbers themselves ---');
  check('Present today: present, overtime and half day, each worker once (3)', phone.presentToday === 3, phone.presentToday);
  check('…not yesterday, not absent, not a removed worker; 5 workers, 1 not marked', phone.workerCount === 5 && phone.notMarkedToday === 1, pick(phone));
  check("Today's expenses: ₹240 tea + ₹1,200 other = ₹1,440 (not yesterday's, not deleted)", phone.todaysExpenses === 1440 && phone.todaysExpenseCount === 2, phone.todaysExpenses);
  check('Low stock: cement, sand, bricks, PVC pipe and the item below zero (5)', phone.lowStockCount === 5, phone.lowStockItems.map(i => i.name));
  check('Worst first: below zero first, then the smallest share of its level', phone.lowStockItems[0].onHand < 0 && phone.lowStockItems[1].name === 'River Sand', phone.lowStockItems.map(i => i.name));
  const { buildSiteLabourSummary } = await import('../src/domain/salary');
  const expectedPending = buildSiteLabourSummary(projectA.workers, projectA.attendance, projectA.advances, projectA.salaryPayments, { leavePaid: projectA.site.leavePaid }).pending;
  check('Salary pending is the labour ledger figure', phone.pendingSalary === expectedPending && phone.pendingSalary > 0, { phone: phone.pendingSalary, expectedPending });

  console.log('\n--- 3. Caps: 3 low stock items, 5 activities ---');
  check('Low stock preview shows only the top 3', phone.lowStockTop.length === dash.LOW_STOCK_PREVIEW && dash.LOW_STOCK_PREVIEW === 3 && phone.lowStockItems.length === 5);
  check('Recent activity shows only 5, newest first', phone.recentActivity.length === 5 && dash.RECENT_ACTIVITY_LIMIT === 5 &&
    phone.recentActivity.every((a, i, arr) => i === 0 || (arr[i - 1].timestamp || '') >= (a.timestamp || '')), phone.recentActivity.map(a => a.id));
  check('…and they are the 5 latest of the project', phone.recentActivity.map(a => a.id).join() === 'log-a7,log-a6,log-a5,log-a4,log-a3');
  check('Fewer than the cap shows them all', dash.buildDashboardSummary({ ...dash.projectDashboardInput(projectA, catalog), activity: logs.slice(0, 2) }, today).recentActivity.length === 2);

  console.log('\n--- 4. Projects are kept apart ---');
  const projectB = await loadProject('pb');
  const phoneB = dash.buildDashboardSummary(dash.projectDashboardInput(projectB!, catalog), today);
  const deskB = (await loadOverallStats(owner, 'pb')).dashboard;
  check('Project B: phone and desktop agree too', JSON.stringify(pick(phoneB)) === JSON.stringify(pick(deskB)), { phoneB: pick(phoneB), deskB: pick(deskB) });
  check("Project B's 200 bags of the same cement are not low, and don't hide A's 8 bags (400 kg)", !phoneB.lowStockItems.some(i => i.name === 'Ramco PPC Cement') && phone.lowStockItems.some(i => i.name === 'Ramco PPC Cement' && i.onHand === 400 && i.unit === 'kg'));
  check('Project B: 1 present, ₹150 today, ₹1,000 − ₹300 advance = ₹700 pending', phoneB.presentToday === 1 && phoneB.todaysExpenses === 150 && phoneB.pendingSalary === 700, pick(phoneB));
  const all = (await loadOverallStats(owner, null)).dashboard;
  check('All projects = A + B, worked out per project', all.presentToday === 4 && all.todaysExpenses === 1590 && all.lowStockCount === 5 && all.pendingSalary === phone.pendingSalary + 700, pick(all));
  check("All projects' recent activity is the 5 newest across both", all.recentActivity[0].id === 'log-b1' && all.recentActivity.length === 5);

  console.log('\n--- 5. The app opens on the last viewed project ---');
  const sites = [{ id: 'p1', status: 'Completed' as const }, { id: 'p2', status: 'Active' as const }, { id: 'p3', status: 'Active' as const }];
  check('The last viewed project, while it exists', dash.pickStartProject(sites, 'p3') === 'p3');
  check('If it was deleted or belongs to another account: the first Active project', dash.pickStartProject(sites, 'gone') === 'p2' && dash.pickStartProject(sites, null) === 'p2');
  check('No Active project: the first project', dash.pickStartProject([{ id: 'p1', status: 'Completed' }], null) === 'p1');
  check('No projects: none (the create-project screen)', dash.pickStartProject([], 'p3') === null);
  const mem = new Map<string, string>();
  const store = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) };
  dash.rememberLastProject(store, 'pb');
  check('The open project is remembered on the device', dash.readLastProject(store) === 'pb' && mem.get(dash.LAST_PROJECT_KEY) === 'pb');
  dash.rememberLastProject(store, null);
  check('…and forgotten when there is none', dash.readLastProject(store) === null);
  const broken = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); }, removeItem: () => { throw new Error('blocked'); } };
  check('Blocked storage does not stop the app opening', dash.readLastProject(broken) === null && (dash.rememberLastProject(broken, 'x'), true));
  const app = fs.readFileSync(path.join(process.cwd(), 'src/App.tsx'), 'utf8');
  check('App.tsx opens the remembered project with this rule (no project list first)', app.includes('pickStartProject(userSitesQuery, selectedSiteId)') && app.includes('readLastProject(') && app.includes('rememberLastProject(') && !app.includes("'Choose a project'"));
  const home = fs.readFileSync(path.join(process.cwd(), 'src/views/mobile/HomeView.tsx'), 'utf8');
  check('Home has no "Choose a project" list; it shows a skeleton while loading', !home.includes('Choose a project') && home.includes('HomeSkeleton'));

  console.log('\n--- 6. Signed in, offline, loading ---');
  const cloudUser = { id: 'cloud-1', isLocal: false };
  check('Offline: a signed-in account stays signed in', keepSignedInOffline(cloudUser, { online: false, cloudUnreachable: false }));
  check('Cloud unreachable: stays signed in', keepSignedInOffline(cloudUser, { online: true, cloudUnreachable: true }));
  check('Online and the cloud says signed out: not kept', !keepSignedInOffline(cloudUser, { online: true, cloudUnreachable: false }));
  check('The local workspace and no user need nothing kept', !keepSignedInOffline({ id: 'local_builder', isLocal: true }, { online: false, cloudUnreachable: true }) && !keepSignedInOffline(null, { online: false, cloudUnreachable: true }));
  const html = fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf8');
  check('index.html shows the splash (logo, name, loading) inside #root until the app starts (never blank)', /<div id="root"><div class="boot-shell"/.test(html) && html.includes('%APP_LOGO_SVG%') && html.includes('boot-spinner'));
  const sw = fs.readFileSync(path.join(process.cwd(), 'public/sw.js'), 'utf8');
  check('The service worker keeps the app page and its scripts/styles for offline starts', sw.includes('cacheShellAssets') && sw.includes("caches.match('./')") && /building-mistry-v\d+/.test(sw));

  console.log('\n--- 7. Five tabs ---');
  const chrome = fs.readFileSync(path.join(process.cwd(), 'src/components/mobile/MobileChrome.tsx'), 'utf8');
  const ids = [...chrome.matchAll(/id(?:=|: )['"](mobile-nav-[a-z]+)['"]/g)].map(m => m[1]);
  check('Bottom bar: Home, Labour, Stock, Tools, More', ids.join() === 'mobile-nav-home,mobile-nav-labour,mobile-nav-stock,mobile-nav-tools,mobile-nav-more', ids);

  console.log(`\n✅ Dashboard parity: all ${passed} checks passed.\n`);
}

run().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
