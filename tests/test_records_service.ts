/**
 * Record-writing services against a real (in-memory) IndexedDB:
 * schema upgrade, access control, attendance, salary/advance double-entry protection,
 * stock movements, tool issue/return and quick expenses.
 */
import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import type { LabourWorker, Site, User } from '../src/db/types';

let passed = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (!cond) throw new Error(`FAILED: ${name}${detail !== undefined ? ' — got ' + JSON.stringify(detail) : ''}`);
  passed += 1;
  console.log(`  ✓ ${name}`);
}

const stamp = '2026-10-01T04:00:00.000Z';
const owner: User = { id: 'u-owner', username: 'owner', fullName: 'Owner', mobile: '', email: 'o@x.in', passwordHash: 'x', role: 'MISTRY', isActive: true, createdAt: stamp };
const stranger: User = { ...owner, id: 'u-other', username: 'other', fullName: 'Other', email: 'other@x.in' };
const admin: User = { ...owner, id: 'u-admin', username: 'boss', fullName: 'Boss', email: 'boss@x.in', role: 'ADMIN' };

async function run() {
  console.log('\n--- 1. Schema v7 → v8 keeps existing data ---');
  // Create the database exactly as the previous release did, with a record in it.
  const legacy = new Dexie('BuildingMistryDB');
  legacy.version(7).stores({
    sites: 'id, userId, name, status, isDeleted, createdAt',
    materials: 'id, userId, siteId, category, isDeleted, purchaseDate',
    rodEntries: 'id, userId, siteId, diameter, isDeleted, purchaseDate',
    workers: 'id, userId, siteId, category, isDeleted, name',
    attendance: 'id, userId, siteId, workerId, date, isDeleted, [siteId+date]',
    labourAdvances: 'id, userId, siteId, workerId, date, isDeleted',
    salaryPayments: 'id, userId, siteId, workerId, date, isDeleted',
    tools: 'id, userId, siteId, isDeleted',
    teaSnacksExpenses: 'id, userId, siteId, date, isDeleted',
    poojaExpenses: 'id, userId, siteId, date, isDeleted',
    electricityBills: 'id, userId, siteId, month, isDeleted',
    waterBills: 'id, userId, siteId, date, isDeleted',
    siteComments: 'id, userId, siteId, dateTime, isDeleted',
    otherExpenses: 'id, userId, siteId, category, isDeleted, date',
    users: 'id, username, mobile, phoneNormalized, email, role, isActive',
    activityLogs: 'id, userId, siteId, timestamp',
    materialPrices: 'id, userId, material, supplier, district, effectiveDate, isDeleted',
    estimates: 'id, userId, siteId, estimateName, isDeleted, createdAt',
    payments: 'id, userId, siteId, relatedRecordId, module, date, isDeleted, [siteId+date]',
    otpSessions: 'id, phoneNormalized, token, expiresAt',
    adminAuditLogs: 'id, action, actorId, timestamp',
    floorPlans: 'id, userId, siteId, isDeleted, createdAt',
  });
  const site: Site = {
    id: 's1', userId: owner.id, name: 'Test Site', ownerName: 'A', ownerPhone: '', address: '', area: '', buildingType: 'House',
    startDate: '2026-09-01', expectedCompletionDate: '2027-03-01', status: 'Active', isDeleted: false, createdAt: stamp, updatedAt: stamp,
  };
  const worker: LabourWorker = { id: 'w1', siteId: 's1', name: 'Senthil', phone: '', category: 'PERIYAAL', dailyWage: 900, joiningDate: '2026-09-01', isDeleted: false, createdAt: stamp, updatedAt: stamp };
  await legacy.table('sites').put(site);
  await legacy.table('workers').put(worker);
  await legacy.table('attendance').put({ id: 'old-att', siteId: 's1', workerId: 'w1', date: '2026-09-30', status: 'present', dayMultiplier: 1, isDeleted: false, createdAt: stamp, updatedAt: stamp });
  await legacy.table('floorPlans').put({ id: 'fp1', userId: owner.id, buildingName: 'B', floorName: 'G', plotLength: 40, plotWidth: 30, unit: 'feet', walls: [{ id: 'w', x1: 0, y1: 0, x2: 10, y2: 0, thickness: 0.75, wallType: 'exterior' }], rooms: [], doors: [], windows: [], isDeleted: false, createdAt: stamp, updatedAt: stamp });
  legacy.close();

  const { db } = await import('../src/db/db');
  const svc = await import('../src/services/records');
  const { buildWorkerLedger } = await import('../src/domain/salary');
  const { buildStock } = await import('../src/domain/stock');
  const { buildToolStatus } = await import('../src/domain/toolTracking');
  const { todayKey, addDays } = await import('../src/utils/datetime');

  await db.open();
  check('Database upgraded to v8', db.verno === 8, db.verno);
  check('Existing site survived the upgrade', (await db.sites.get('s1'))?.name === 'Test Site');
  check('Existing attendance survived', (await db.attendance.get('old-att'))?.status === 'present');
  check('Existing floor plan geometry survived', (await db.floorPlans.get('fp1'))?.walls[0].x2 === 10);
  check('New tables exist and are empty', (await db.stockMovements.count()) === 0 && (await db.toolAssets.count()) === 0);

  const today = todayKey();
  const yesterday = addDays(today, -1);
  const tomorrow = addDays(today, 1);

  console.log('\n--- 2. Access control ---');
  check('Owner can write', (await svc.writableSite(owner, 's1'))?.id === 's1');
  check('Another contractor cannot', (await svc.writableSite(stranger, 's1')) === null);
  check('Admin can', (await svc.writableSite(admin, 's1'))?.id === 's1');
  check('Signed-out user cannot', (await svc.writableSite(null, 's1')) === null);
  const denied = await svc.markAttendance(stranger, 's1', worker, today, 'present');
  check('Stranger attendance write is refused', !denied.ok && (await db.attendance.count()) === 1);
  const deniedPay = await svc.saveSalaryPayment(stranger, 's1', { workerId: 'w1', date: today, amount: 100 });
  check('Stranger salary write is refused', !deniedPay.ok && (await db.salaryPayments.count()) === 0);

  console.log('\n--- 3. Attendance ---');
  const a1 = await svc.markAttendance(owner, 's1', worker, today, 'present');
  check('Marked present', a1.ok && a1.value.status === 'present' && a1.value.dayMultiplier === 1);
  check('Creation time is a UTC instant', a1.ok && /^\d{4}-\d\d-\d\dT.*Z$/.test(a1.value.createdAt));
  check('Event date is a plain calendar day', a1.ok && a1.value.date === today);
  check('Creator recorded', a1.ok && a1.value.createdBy === owner.id);
  check('Wage snapshot stored', a1.ok && a1.value.dailyWageSnapshot === 900);
  await svc.markAttendance(owner, 's1', worker, today, 'present');
  const todays = await db.attendance.filter(a => a.date === today && !a.isDeleted).toArray();
  check('Double tap does not create a second record', todays.length === 1);
  check('Double tap does not add edit history', !todays[0].editHistory);

  const a2 = await svc.markAttendance(admin, 's1', worker, today, 'half_day');
  check('Correction updates the same record', a2.ok && a2.value.id === (a1.ok ? a1.value.id : '') && a2.value.dayMultiplier === 0.5);
  check('Correction keeps the original creation time', a2.ok && a1.ok && a2.value.createdAt === a1.value.createdAt);
  check('Correction is logged with who and what', a2.ok && a2.value.editHistory?.length === 1 && a2.value.editHistory[0].from === 'present' && a2.value.editHistory[0].to === 'half_day' && a2.value.editHistory[0].by === admin.id);
  check('Editor recorded', a2.ok && a2.value.updatedBy === admin.id);

  const past = await svc.markAttendance(owner, 's1', worker, yesterday, 'leave');
  check('Past dates can be corrected', past.ok && past.value.status === 'leave' && past.value.dayMultiplier === 0);
  check('Future dates are refused', !(await svc.markAttendance(owner, 's1', worker, tomorrow, 'present')).ok);
  check('Malformed dates are refused', !(await svc.markAttendance(owner, 's1', worker, '11-10-2026', 'present')).ok);

  await svc.markAttendance(owner, 's1', { ...worker, dailyWage: 1200 }, today, 'present');
  check('Later wage change does not alter a marked day', (await db.attendance.get(`att-w1-${today}`))?.dailyWageSnapshot === 900);

  check('Leave policy starts undecided', (await db.sites.get('s1'))?.leavePaid === undefined);
  await svc.setLeavePolicy(owner, 's1', true);
  check('Leave policy saved', (await db.sites.get('s1'))?.leavePaid === true);

  console.log('\n--- 4. Salary payments: no double counting ---');
  const p1 = await svc.saveSalaryPayment(owner, 's1', { workerId: 'w1', date: today, amount: 500, paymentMode: 'Cash' });
  check('Payment saved', p1.ok && p1.value.paidAmount === 500);
  const ledgerRows = async () => db.payments.filter(p => !p.isDeleted).toArray();
  check('One ledger row created', (await ledgerRows()).length === 1 && (await ledgerRows())[0].amount === 500);

  const dup = await svc.saveSalaryPayment(owner, 's1', { workerId: 'w1', date: today, amount: 500 });
  check('Identical repeat payment is stopped', !dup.ok && !!dup.duplicateOf && (await db.salaryPayments.count()) === 1);
  const confirmed = await svc.saveSalaryPayment(owner, 's1', { workerId: 'w1', date: today, amount: 500, allowDuplicate: true });
  check('Repeat goes through once confirmed', confirmed.ok && (await db.salaryPayments.count()) === 2);

  const edited = await svc.saveSalaryPayment(owner, 's1', { id: p1.ok ? p1.value.id : '', workerId: 'w1', date: today, amount: 650, allowDuplicate: true });
  check('Edit keeps the same record', edited.ok && p1.ok && edited.value.id === p1.value.id && edited.value.createdAt === p1.value.createdAt);
  const afterEdit = await db.salaryPayments.get(p1.ok ? p1.value.id : '');
  check('Edited amount is the new amount, not old + new', afterEdit?.paidAmount === 650, afterEdit?.paidAmount);
  const rowsForP1 = (await ledgerRows()).filter(r => r.relatedRecordId === (p1.ok ? p1.value.id : ''));
  check('Ledger still has exactly one row for it', rowsForP1.length === 1 && rowsForP1[0].amount === 650, rowsForP1.map(r => r.amount));

  check('Zero and negative amounts are refused', !(await svc.saveSalaryPayment(owner, 's1', { workerId: 'w1', date: today, amount: 0 })).ok && !(await svc.saveSalaryPayment(owner, 's1', { workerId: 'w1', date: today, amount: -5 })).ok);
  check('Future-dated payment is refused', !(await svc.saveSalaryPayment(owner, 's1', { workerId: 'w1', date: tomorrow, amount: 10 })).ok);
  check('Unknown worker is refused', !(await svc.saveSalaryPayment(owner, 's1', { workerId: 'nope', date: today, amount: 10 })).ok);

  const adv = await svc.saveAdvance(owner, 's1', { workerId: 'w1', date: yesterday, amount: 300, advanceType: 'Recoverable', reason: 'Festival' });
  check('Advance saved', adv.ok && adv.value.amount === 300);
  const advEdit = await svc.saveAdvance(owner, 's1', { id: adv.ok ? adv.value.id : '', workerId: 'w1', date: yesterday, amount: 400, advanceType: 'Recoverable' });
  const advRows = (await ledgerRows()).filter(r => r.relatedRecordId === (adv.ok ? adv.value.id : ''));
  check('Editing an advance does not add a ledger row', advEdit.ok && advRows.length === 1 && advRows[0].amount === 400);
  check('Repeat advance is stopped', !(await svc.saveAdvance(owner, 's1', { workerId: 'w1', date: yesterday, amount: 400, advanceType: 'Recoverable' })).ok);

  const ledger = buildWorkerLedger(worker, await db.attendance.toArray(), await db.labourAdvances.toArray(), await db.salaryPayments.toArray(), { leavePaid: true });
  // Sep 30 present (900, no snapshot) + yesterday paid leave (900) + today present (900) = 2700
  check('Ledger earned', ledger.earned === 2700, ledger.earned);
  check('Ledger salary paid = 650 + 500', ledger.salaryPaid === 1150, ledger.salaryPaid);
  check('Ledger advances', ledger.recoverableAdvances === 400);
  check('Ledger pending = 2700 − 1150 − 400', ledger.pending === 1150, ledger.pending);

  await svc.removeMoneyEntry(owner, 's1', 'salaryPayments', confirmed.ok ? confirmed.value.id : '');
  const afterRemove = buildWorkerLedger(worker, await db.attendance.toArray(), await db.labourAdvances.toArray(), await db.salaryPayments.toArray(), { leavePaid: true });
  check('Removing a payment restores the pending amount', afterRemove.salaryPaid === 650 && afterRemove.pending === 1650);
  check('Its ledger row is removed too', (await ledgerRows()).filter(r => r.relatedRecordId === (confirmed.ok ? confirmed.value.id : '')).length === 0);

  console.log('\n--- 5. Materials and stock ---');
  const buy = await svc.recordPurchase(owner, 's1', { category: 'cement', materialName: 'Ramco PPC Cement', brand: 'Ramco', materialType: 'PPC', quantity: 100, unit: 'Bags', rate: 410, paidAmount: 20000, purchaseDate: yesterday, supplier: 'Sri Murugan Traders', invoiceNumber: 'INV-7' });
  check('Purchase saved with total', buy.ok && buy.value.totalAmount === 41000 && buy.value.balance === 21000);
  check('Purchase keeps brand and type separately', buy.ok && buy.value.brand === 'Ramco' && buy.value.materialType === 'PPC' && buy.value.grade === undefined);
  check('Purchase has creation time and creator', buy.ok && !!buy.value.createdAt && buy.value.createdBy === owner.id);
  const stockNow = async () => buildStock(await db.materials.toArray(), await db.rodEntries.toArray(), await db.stockMovements.toArray());
  const itemKey = (await stockNow())[0].key;

  const use = await svc.recordStockMovement(owner, 's1', { itemKey, itemName: 'Ramco PPC Cement', category: 'cement', unit: 'Bags', movementType: 'usage', quantity: 30, eventDate: today, reason: 'Roof slab' });
  check('Usage recorded', use.ok && (await stockNow())[0].onHand === 70);
  const tooMuch = await svc.recordStockMovement(owner, 's1', { itemKey, itemName: 'Ramco PPC Cement', category: 'cement', unit: 'Bags', movementType: 'usage', quantity: 71, eventDate: today });
  check('Usage beyond stock is refused', !tooMuch.ok && (await stockNow())[0].onHand === 70);
  const back = await svc.recordStockMovement(owner, 's1', { itemKey, itemName: 'Ramco PPC Cement', category: 'cement', unit: 'Bags', movementType: 'return', quantity: 5, eventDate: today });
  check('Return to supplier recorded', back.ok && (await stockNow())[0].onHand === 65);
  check('Void needs a reason', !(await svc.voidStockMovement(owner, 's1', use.ok ? use.value.id : '', ' ')).ok);
  const voided = await svc.voidStockMovement(owner, 's1', use.ok ? use.value.id : '', 'Entered twice');
  const afterVoid = (await stockNow())[0];
  check('Voided usage returns to stock', voided.ok && afterVoid.onHand === 95);
  check('Voided entry is still in the history', afterVoid.lines.some(l => l.voided && l.voidReason === 'Entered twice'));
  check('Movement row was not deleted', (await db.stockMovements.count()) === 2);
  check('Stranger cannot move stock', !(await svc.recordStockMovement(stranger, 's1', { itemKey, itemName: 'x', category: 'cement', unit: 'Bags', movementType: 'usage', quantity: 1, eventDate: today })).ok);

  console.log('\n--- 6. Tools ---');
  const tool = await svc.saveToolAsset(owner, 's1', { name: 'Angle Grinder', category: 'Power tools', totalQuantity: 3, condition: 'Good' });
  check('Tool added', tool.ok && tool.value.totalQuantity === 3);
  const toolId = tool.ok ? tool.value.id : '';
  const iss = await svc.issueTool(owner, 's1', { toolAssetId: toolId, quantity: 2, issuedTo: 'Senthil', workerId: 'w1', expectedReturnDate: tomorrow });
  check('Tool issued with timestamp', iss.ok && /Z$/.test(iss.value.issuedAt) && iss.value.expectedReturnDate === tomorrow);
  check('Cannot issue more than available', !(await svc.issueTool(owner, 's1', { toolAssetId: toolId, quantity: 2, issuedTo: 'Velu' })).ok);
  check('Receiver is required', !(await svc.issueTool(owner, 's1', { toolAssetId: toolId, quantity: 1, issuedTo: '' })).ok);
  check('Past expected-return date is refused', !(await svc.issueTool(owner, 's1', { toolAssetId: toolId, quantity: 1, issuedTo: 'Velu', expectedReturnDate: yesterday })).ok);
  const r1 = await svc.returnTool(owner, 's1', { issueId: iss.ok ? iss.value.id : '', quantity: 1, condition: 'Good' });
  check('Partial return recorded with time', r1.ok && r1.value.returns.length === 1 && /Z$/.test(r1.value.returns[0].returnedAt));
  check('Cannot return more than is out', !(await svc.returnTool(owner, 's1', { issueId: iss.ok ? iss.value.id : '', quantity: 2, condition: 'Good' })).ok);
  const status = buildToolStatus((await db.toolAssets.get(toolId))!, await db.toolIssues.toArray());
  check('Available = 3 − 1 still out', status.available === 2 && status.issued === 1);
  check('Total cannot be cut below what is issued', !(await svc.saveToolAsset(owner, 's1', { id: toolId, name: 'Angle Grinder', category: 'Power tools', totalQuantity: 0, condition: 'Good' })).ok);
  check('Total can be raised', (await svc.saveToolAsset(owner, 's1', { id: toolId, name: 'Angle Grinder', category: 'Power tools', totalQuantity: 5, condition: 'Good' })).ok);

  console.log('\n--- 7. Quick expenses ---');
  const tea = await svc.recordExpense(owner, 's1', { kind: 'tea', amount: 180, date: today, payee: 'Tea stall', paid: true });
  check('Tea expense goes to the tea table', tea.ok && tea.value.table === 'teaSnacksExpenses' && (await db.teaSnacksExpenses.get(tea.value.id))?.totalAmount === 180);
  check('Paid expense has a ledger row', (await ledgerRows()).some(r => r.relatedRecordId === (tea.ok ? tea.value.id : '') && r.amount === 180));
  check('Same expense twice is stopped', !(await svc.recordExpense(owner, 's1', { kind: 'tea', amount: 180, date: today, paid: true })).ok);
  const fuel = await svc.recordExpense(owner, 's1', { kind: 'Fuel', amount: 1200, date: today, description: 'Diesel for mixer', payee: 'HP Bunk', paid: false });
  const fuelRow = fuel.ok ? await db.otherExpenses.get(fuel.value.id) : undefined;
  check('Unpaid expense records the amount owed', fuelRow?.balance === 1200 && fuelRow?.paidAmount === 0 && fuelRow?.payee === 'HP Bunk');
  check('Unpaid expense has no ledger row', !(await ledgerRows()).some(r => r.relatedRecordId === (fuel.ok ? fuel.value.id : '')));

  console.log('\n--- 8. Catalog ---');
  await svc.ensureCatalogSeeded();
  const all = await db.catalogItems.toArray();
  for (const brand of ['Ramco', 'UltraTech', 'India Cements', 'TANCEM']) {
    check(`Cement brand present: ${brand}`, all.some(c => c.kind === 'brand' && c.category === 'cement' && c.name === brand));
  }
  check('Tools seeded across five categories', new Set(all.filter(c => c.kind === 'tool').map(c => c.category)).size === 5);
  const custom = await svc.saveCatalogItem(owner, { kind: 'brand', category: 'cement', name: 'Penna' });
  check('Custom brand can be added without code changes', custom.ok && (await db.catalogItems.get(custom.value.id))?.isBuiltIn === false);
  check('Duplicate brand name is refused', !(await svc.saveCatalogItem(owner, { kind: 'brand', category: 'cement', name: 'penna' })).ok);
  await svc.removeCatalogItem('brand-cement-acc');
  await svc.ensureCatalogSeeded();
  check('A removed built-in entry is not re-added', (await db.catalogItems.get('brand-cement-acc'))?.isDeleted === true);

  console.log('\n--- 9. Correcting and removing expenses ---');
  const teaId = tea.ok ? tea.value.id : '';
  const teaBefore = await db.teaSnacksExpenses.get(teaId);
  const fixed = await svc.correctExpense(owner, 's1', 'teaSnacksExpenses', teaId, { amount: 220, payee: 'Anna Tea Stall' });
  const teaAfter = await db.teaSnacksExpenses.get(teaId);
  check('Paid expense corrected: total and paid move together', fixed.ok && teaAfter?.totalAmount === 220 && teaAfter?.paidAmount === 220 && teaAfter?.balance === 0);
  check('Correction keeps the original entry time', teaAfter?.createdAt === teaBefore?.createdAt && teaAfter?.updatedBy === owner.id);
  const teaRows = (await ledgerRows()).filter(r => r.relatedRecordId === teaId);
  check('Its single ledger row is updated, not duplicated', teaRows.length === 1 && teaRows[0].amount === 220, teaRows.map(r => r.amount));
  check('Payee corrected', teaAfter?.payee === 'Anna Tea Stall');

  const fuelId = fuel.ok ? fuel.value.id : '';
  const fuelFix = await svc.correctExpense(owner, 's1', 'otherExpenses', fuelId, { amount: 1500, date: yesterday });
  const fuelAfter = await db.otherExpenses.get(fuelId);
  check('Unpaid expense corrected: stays unpaid with new balance', fuelFix.ok && fuelAfter?.amount === 1500 && fuelAfter?.paidAmount === 0 && fuelAfter?.balance === 1500 && fuelAfter?.date === yesterday);
  check('Correction to a future date is refused', !(await svc.correctExpense(owner, 's1', 'otherExpenses', fuelId, { date: tomorrow })).ok);
  check('Stranger cannot correct', !(await svc.correctExpense(stranger, 's1', 'otherExpenses', fuelId, { amount: 1 })).ok);

  // A bill with a part payment cannot have its amount changed here.
  await db.otherExpenses.update(fuelId, { paidAmount: 400, balance: 1100 });
  await db.payments.put({ id: 'PAY-part', siteId: 's1', relatedRecordId: fuelId, module: 'Expense', date: today, amount: 400, paymentType: 'Cash', isDeleted: false, createdAt: stamp, updatedAt: stamp });
  const partFix = await svc.correctExpense(owner, 's1', 'otherExpenses', fuelId, { amount: 2000 });
  check('Part-paid bill amount change is refused with an explanation', !partFix.ok && /part payments/i.test(partFix.ok ? '' : partFix.error));
  check('Part-paid bill notes can still be corrected', (await svc.correctExpense(owner, 's1', 'otherExpenses', fuelId, { notes: 'Bill no. 42' })).ok && (await db.otherExpenses.get(fuelId))?.notes === 'Bill no. 42');

  // An itemised tea entry keeps its breakdown.
  await db.teaSnacksExpenses.put({ id: 'tea-split', siteId: 's1', date: yesterday, teaExpense: 100, snacksExpense: 50, juiceExpense: 0, otherFoodExpense: 0, totalAmount: 150, paidAmount: 0, balance: 150, extraPaid: 0, isDeleted: false, createdAt: stamp, updatedAt: stamp });
  check('Itemised entry amount change is refused', !(await svc.correctExpense(owner, 's1', 'teaSnacksExpenses', 'tea-split', { amount: 300 })).ok);

  const removed = await svc.removeExpense(owner, 's1', 'teaSnacksExpenses', teaId);
  check('Removed expense goes to the Recycle Bin', removed.ok && (await db.teaSnacksExpenses.get(teaId))?.isDeleted === true);
  check('Its payment leaves the paid-out ledger too', (await ledgerRows()).filter(r => r.relatedRecordId === teaId).length === 0);

  console.log('\n--- 10. Deleting an account removes only that person\'s data ---');
  const { deleteAccountAndData } = await import('../src/services/account');
  const leaver: User = { ...owner, id: 'u-leaver', username: 'leaver', fullName: 'Leaver', email: 'leaver@x.in' };
  await db.users.bulkPut([owner, leaver]);
  await db.sites.put({ ...site, id: 's-leaver', userId: leaver.id, name: 'Leaver Site' });
  await db.workers.put({ ...worker, id: 'w-leaver', siteId: 's-leaver' });
  await db.attendance.put({ id: 'att-leaver', siteId: 's-leaver', workerId: 'w-leaver', date: today, status: 'present', dayMultiplier: 1, isDeleted: false, createdAt: stamp, updatedAt: stamp });
  await db.floorPlans.put({ id: 'fp-leaver', userId: leaver.id, siteId: 's-leaver', buildingName: 'L', floorName: 'G', plotLength: 10, plotWidth: 10, unit: 'feet', walls: [], rooms: [], doors: [], windows: [], isDeleted: false, createdAt: stamp, updatedAt: stamp });
  const ownerSitesBefore = (await db.sites.toArray()).filter(s => s.userId === owner.id).length;
  const ownerAttendanceBefore = (await db.attendance.toArray()).filter(a => a.siteId === 's1').length;
  const gone = await deleteAccountAndData(leaver);
  check('Account deletion succeeds and reports what was removed', gone.ok && gone.records === 4, gone);
  check('The account is gone', (await db.users.get(leaver.id)) === undefined);
  check('Their project, workers, attendance and plans are gone', (await db.sites.get('s-leaver')) === undefined && (await db.workers.get('w-leaver')) === undefined && (await db.attendance.get('att-leaver')) === undefined && (await db.floorPlans.get('fp-leaver')) === undefined);
  check('Other people\'s data is untouched', (await db.sites.toArray()).filter(s => s.userId === owner.id).length === ownerSitesBefore && (await db.attendance.toArray()).filter(a => a.siteId === 's1').length === ownerAttendanceBefore && !!(await db.users.get(owner.id)));
  check('Built-in catalog entries are kept', (await db.catalogItems.get('brand-cement-ramco')) !== undefined);
  const superAdmin: User = { ...owner, id: 'u-super', username: 'root', role: 'SUPER_ADMIN' };
  await db.users.put(superAdmin);
  check('The main administrator account can not be deleted this way', !(await deleteAccountAndData(superAdmin)).ok && !!(await db.users.get('u-super')));

  console.log(`\n✅ Records service: all ${passed} checks passed.`);
}

run().catch(err => {
  console.error('\n❌', err.message);
  process.exit(1);
});
