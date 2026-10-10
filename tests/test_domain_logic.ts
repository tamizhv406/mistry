/**
 * Business-critical logic: dates, salary ledger, stock ledger, tool issue/return.
 * Pure functions only — no database needed.
 */
import {
  dayKeyOf, todayKey, addDays, addMonths, daysInMonth, isDayKey, formatDay, formatDateTime, inDayRange, monthDayKeys,
} from '../src/utils/datetime';
import { formatINR, parseAmount, roundMoney } from '../src/utils/money';
import {
  buildWorkerLedger, buildSiteLabourSummary, summariseMonth, dayValue, dedupeAttendance,
  findDuplicateMoneyEntry, countByStatus,
} from '../src/domain/salary';
import { buildStock, validateMovement, stockItemKey, normaliseUnit } from '../src/domain/stock';
import { buildToolStatus, validateIssue, validateReturn, outstandingQuantity, isOverdue, minimumTotal } from '../src/domain/toolTracking';
import type { AttendanceRecord, AttendanceStatus, LabourAdvance, SalaryPayment, Material, StockMovement, ToolAsset, ToolIssue } from '../src/db/types';

let passed = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (!cond) throw new Error(`FAILED: ${name}${detail !== undefined ? ' — got ' + JSON.stringify(detail) : ''}`);
  passed += 1;
  console.log(`  ✓ ${name}`);
}
const eq = (name: string, actual: unknown, expected: unknown) =>
  check(`${name} (${JSON.stringify(expected)})`, JSON.stringify(actual) === JSON.stringify(expected), actual);

const stamp = '2026-10-01T04:00:00.000Z';
const att = (workerId: string, date: string, status: AttendanceStatus, extra: Partial<AttendanceRecord> = {}): AttendanceRecord => ({
  id: `att-${workerId}-${date}`, siteId: 's1', workerId, date, status,
  dayMultiplier: status === 'present' ? 1 : status === 'half_day' ? 0.5 : status === 'overtime' ? 1.5 : 0,
  isDeleted: false, createdAt: stamp, updatedAt: stamp, ...extra,
});
const adv = (id: string, workerId: string, date: string, amount: number, type?: 'Recoverable' | 'Non-Recoverable'): LabourAdvance => ({
  id, siteId: 's1', workerId, date, amount, advanceType: type as any, isDeleted: false, createdAt: stamp, updatedAt: stamp,
});
const pay = (id: string, workerId: string, date: string, paidAmount: number): SalaryPayment => ({
  id, siteId: 's1', workerId, date, daysWorked: 0, grossSalary: 0, advanceDeducted: 0, paidAmount, balance: 0, extraPaid: 0,
  isDeleted: false, createdAt: stamp, updatedAt: stamp,
});

console.log('\n--- 1. Dates: Asia/Kolkata calendar days ---');
// 20:00 UTC on 10 Oct is 01:30 on 11 Oct in India.
eq('Late-evening UTC instant belongs to the next Indian day', dayKeyOf('2026-10-10T20:00:00.000Z'), '2026-10-11');
eq('UTC date would have been wrong', '2026-10-10T20:00:00.000Z'.slice(0, 10), '2026-10-10');
eq('18:29 UTC is still the same Indian day', dayKeyOf('2026-10-10T18:29:59.000Z'), '2026-10-10');
eq('18:30 UTC is Indian midnight', dayKeyOf('2026-10-10T18:30:00.000Z'), '2026-10-11');
eq('todayKey uses the supplied clock', todayKey('Asia/Kolkata', new Date('2026-12-31T19:00:00.000Z')), '2027-01-01');
eq('Other zones are honoured', dayKeyOf('2026-10-10T20:00:00.000Z', 'UTC'), '2026-10-10');
eq('addDays crosses a month', addDays('2026-01-31', 1), '2026-02-01');
eq('addDays crosses a leap day', addDays('2028-02-28', 1), '2028-02-29');
eq('addMonths wraps the year', addMonths('2026-12', 1), '2027-01');
eq('addMonths backwards', addMonths('2026-01', -1), '2025-12');
eq('February 2028 has 29 days', daysInMonth('2028-02'), 29);
eq('monthDayKeys length', monthDayKeys('2026-10').length, 31);
check('isDayKey rejects impossible dates', !isDayKey('2026-02-30') && !isDayKey('11-10-2026') && isDayKey('2026-10-11'));
eq('formatDay', formatDay('2026-10-11'), '11 Oct 2026');
check('formatDateTime shows Indian local time', /11 Oct 2026, 1:30\s?am/i.test(formatDateTime('2026-10-10T20:00:00.000Z')), formatDateTime('2026-10-10T20:00:00.000Z'));
check('inDayRange is inclusive', inDayRange('2026-10-01', '2026-10-01', '2026-10-31') && inDayRange('2026-10-31', '2026-10-01', '2026-10-31') && !inDayRange('2026-11-01', '2026-10-01', '2026-10-31'));

console.log('\n--- 2. Money formatting ---');
eq('Indian digit grouping', formatINR(125000), '₹1,25,000');
eq('Paise kept when present', formatINR(1250.5), '₹1,250.50');
eq('Zero', formatINR(0), '₹0');
eq('parseAmount strips commas', parseAmount('1,25,000'), 125000);
check('parseAmount rejects junk and negatives', Number.isNaN(parseAmount('12abc')) && Number.isNaN(parseAmount('-5')) && Number.isNaN(parseAmount('')));
eq('roundMoney removes float drift', roundMoney(0.1 + 0.2), 0.3);

console.log('\n--- 3. Salary ledger ---');
const worker = { id: 'w1', dailyWage: 800 };
const days = [
  att('w1', '2026-10-01', 'present'),
  att('w1', '2026-10-02', 'present'),
  att('w1', '2026-10-03', 'half_day'),
  att('w1', '2026-10-04', 'leave'),
  att('w1', '2026-10-05', 'absent'),
  att('w1', '2026-10-06', 'overtime'),
  att('w1', '2026-09-30', 'present'),
];
const advances = [adv('a1', 'w1', '2026-10-02', 500, 'Recoverable'), adv('a2', 'w1', '2026-10-03', 200, 'Non-Recoverable')];
const payments = [pay('p1', 'w1', '2026-10-05', 1000), pay('p2', 'w1', '2026-10-06', 700)];

const unpaidLeave = buildWorkerLedger(worker, days, advances, payments, { leavePaid: false });
// 3 present (3) + half (0.5) + overtime (1.5) = 5 day equivalents
eq('Worked-day equivalents', unpaidLeave.workedDayEquivalents, 5);
eq('Earned = 5 × 800', unpaidLeave.earned, 4000);
eq('Salary paid sums both payments', unpaidLeave.salaryPaid, 1700);
eq('Only recoverable advance is deducted', unpaidLeave.recoverableAdvances, 500);
eq('Grant is listed separately', unpaidLeave.nonRecoverableAdvances, 200);
eq('Pending = 4000 − 1700 − 500', unpaidLeave.pending, 1800);
eq('Not overpaid', unpaidLeave.overpaid, 0);
eq('Exact Present dates, newest first', unpaidLeave.datesByStatus.present, ['2026-10-02', '2026-10-01', '2026-09-30']);
eq('Exact Half Day dates', unpaidLeave.datesByStatus.half_day, ['2026-10-03']);
eq('Exact Leave dates', unpaidLeave.datesByStatus.leave, ['2026-10-04']);
eq('Exact Absent dates', unpaidLeave.datesByStatus.absent, ['2026-10-05']);
check('Leave policy is set, so no warning', unpaidLeave.leavePolicyMissing === false);

const paidLeave = buildWorkerLedger(worker, days, advances, payments, { leavePaid: true });
eq('Paid leave adds one day', paidLeave.workedDayEquivalents, 6);
eq('Paid leave adds one wage', paidLeave.earned, 4800);
eq('Pending with paid leave', paidLeave.pending, 2600);

const undecided = buildWorkerLedger(worker, days, advances, payments, {});
eq('Undecided leave is not paid', undecided.earned, 4000);
check('Undecided leave is flagged, not assumed', undecided.leavePolicyMissing === true);

const month = summariseMonth(unpaidLeave, '2026-10');
eq('October present count excludes September', month.counts.present, 2);
eq('October earned', month.earned, 3200);
eq('October salary paid', month.salaryPaid, 1700);
eq('October counts', [month.counts.half_day, month.counts.leave, month.counts.absent, month.counts.overtime], [1, 1, 1, 1]);

console.log('\n--- 4. Salary edge cases ---');
const over = buildWorkerLedger(worker, [att('w1', '2026-10-01', 'present')], [adv('a', 'w1', '2026-10-01', 300, 'Recoverable')], [pay('p', 'w1', '2026-10-01', 900)]);
eq('Overpaid is reported, pending stays at zero', [over.pending, over.overpaid], [0, 400]);

const noType = buildWorkerLedger(worker, [att('w1', '2026-10-01', 'present')], [adv('a', 'w1', '2026-10-01', 300, undefined)], []);
eq('Advance with no type counts as recoverable', noType.recoverableAdvances, 300);

const dup = [att('w1', '2026-10-01', 'present'), att('w1', '2026-10-01', 'half_day', { id: 'other-id', updatedAt: '2026-10-02T00:00:00.000Z' })];
const dupLedger = buildWorkerLedger(worker, dup, [], []);
eq('A day recorded twice is paid once (latest edit wins)', dupLedger.earned, 400);
eq('Duplicate is reported', dupLedger.duplicateAttendanceIgnored, 1);
eq('dedupeAttendance keeps one', dedupeAttendance(dup).records.length, 1);

const deleted = buildWorkerLedger(worker, [att('w1', '2026-10-01', 'present', { isDeleted: true })], [], [{ ...pay('p', 'w1', '2026-10-01', 500), isDeleted: true }]);
eq('Deleted attendance and payments are ignored', [deleted.earned, deleted.salaryPaid], [0, 0]);

const wageChange = buildWorkerLedger({ id: 'w1', dailyWage: 1000 }, [
  att('w1', '2026-10-01', 'present', { dailyWageSnapshot: 800 }),
  att('w1', '2026-10-02', 'present'),
], [], []);
eq('A wage rise does not rewrite days already marked', wageChange.earned, 1800);

eq('Stored multiplier is honoured for old records', dayValue({ status: 'overtime', dayMultiplier: 2 }), 2);
eq('Leave ignores a stale stored multiplier', dayValue({ status: 'leave', dayMultiplier: 1 }, { leavePaid: false }), 0);
eq('Half paise wages stay exact', buildWorkerLedger({ id: 'w1', dailyWage: 733 }, [att('w1', '2026-10-01', 'half_day')], [], []).earned, 366.5);

const site = buildSiteLabourSummary(
  [{ id: 'w1', dailyWage: 800 }, { id: 'w2', dailyWage: 600 }],
  [att('w1', '2026-10-01', 'present'), att('w2', '2026-10-01', 'present')],
  [],
  [pay('p1', 'w1', '2026-10-01', 1000)]
);
eq('Site pending and overpaid are not netted against each other', [site.pending, site.overpaid, site.earned], [600, 200, 1400]);

const dupPay = findDuplicateMoneyEntry(payments, { workerId: 'w1', date: '2026-10-05', amount: 1000 }, p => p.paidAmount);
check('Repeated payment is detected', dupPay?.id === 'p1');
check('Editing a payment does not flag itself', findDuplicateMoneyEntry(payments, { workerId: 'w1', date: '2026-10-05', amount: 1000, ignoreId: 'p1' }, p => p.paidAmount) === undefined);
check('Different amount is not a duplicate', findDuplicateMoneyEntry(payments, { workerId: 'w1', date: '2026-10-05', amount: 999 }, p => p.paidAmount) === undefined);
eq('countByStatus', countByStatus(days).present, 3);

console.log('\n--- 5. Stock ledger ---');
const mat = (id: string, name: string, qty: number, date: string, extra: Partial<Material> = {}): Material => ({
  id, siteId: 's1', category: 'cement', materialName: name, supplier: 'Shop', quantity: qty, unit: 'Bags', rate: 400,
  totalAmount: qty * 400, paidAmount: 0, balance: qty * 400, extraPaid: 0, purchaseDate: date, isDeleted: false,
  createdAt: `${date}T05:00:00.000Z`, updatedAt: stamp, ...extra,
});
const key = stockItemKey({ category: 'cement', name: 'Ramco PPC Cement', unit: 'Bags' });
const mv = (id: string, type: StockMovement['movementType'], qty: number, date: string, extra: Partial<StockMovement> = {}): StockMovement => ({
  id, siteId: 's1', itemKey: key, itemName: 'Ramco PPC Cement', category: 'cement', unit: 'Bags', movementType: type,
  quantity: qty, eventDate: date, isDeleted: false, createdAt: `${date}T08:00:00.000Z`, updatedAt: stamp, ...extra,
});
eq('Unit plural folds', [normaliseUnit('Bags'), normaliseUnit('bag'), normaliseUnit('kg'), normaliseUnit('CFT')], ['bag', 'bag', 'kg', 'cft']);
eq('Key ignores case and plural', stockItemKey({ category: 'Cement', name: ' ramco  PPC cement ', unit: 'bag' }), key);

const stock = buildStock(
  [mat('m1', 'Ramco PPC Cement', 100, '2026-10-01'), mat('m2', 'Ramco PPC Cement', 50, '2026-10-05'), mat('m3', 'Ramco PPC Cement', 999, '2026-10-02', { isDeleted: true })],
  [],
  [mv('v1', 'usage', 30, '2026-10-02'), mv('v2', 'return', 10, '2026-10-06'), mv('v3', 'adjust_out', 2, '2026-10-07'), mv('v4', 'adjust_in', 1, '2026-10-08'), mv('v5', 'usage', 500, '2026-10-03', { isDeleted: true })]
);
eq('One stock item', stock.length, 1);
const item = stock[0];
eq('Purchased', item.purchased, 150);
eq('Used', item.used, 30);
eq('Returned', item.returned, 10);
eq('On hand = 150 − 30 − 10 − 2 + 1', item.onHand, 109);
eq('Purchase cost', item.purchaseCost, 60000);
eq('Running balance is chronological', item.lines.filter(l => !l.voided).map(l => l.balanceAfter), [100, 70, 120, 110, 108, 109]);
check('Voided movement stays in history but not in the balance', item.lines.some(l => l.id === 'v5' && l.voided && l.signed === 0));
check('Stock never went negative', item.isNegative === false);

const negative = buildStock([], [], [mv('x', 'usage', 5, '2026-10-01')]);
check('Usage without stock is flagged negative', negative[0].isNegative && negative[0].onHand === -5);

check('Outgoing more than stock is refused', validateMovement(109, 'usage', 110).ok === false);
eq('Shortfall is reported', validateMovement(109, 'usage', 110).shortBy, 1);
check('Outgoing exactly the stock is allowed', validateMovement(109, 'usage', 109).ok);
check('Incoming is always allowed', validateMovement(0, 'opening', 20).ok && validateMovement(0, 'adjust_in', 1).ok);
check('Zero and negative quantities are refused', !validateMovement(10, 'usage', 0).ok && !validateMovement(10, 'usage', -1).ok && !validateMovement(10, 'usage', NaN).ok);

console.log('\n--- 6. Tool issue and return ---');
const tool: ToolAsset = { id: 't1', siteId: 's1', name: 'Angle Grinder', category: 'Power tools', totalQuantity: 5, condition: 'Good', isDeleted: false, createdAt: stamp, updatedAt: stamp };
const issue = (id: string, qty: number, to: string, returns: ToolIssue['returns'] = [], extra: Partial<ToolIssue> = {}): ToolIssue => ({
  id, siteId: 's1', toolAssetId: 't1', quantity: qty, issuedTo: to, issuedAt: '2026-10-01T04:00:00.000Z', returns, isDeleted: false, createdAt: stamp, updatedAt: stamp, ...extra,
});
const ret = (qty: number, condition: ToolIssue['returns'][number]['condition'] = 'Good') => ({ id: `r${qty}${condition}`, quantity: qty, returnedAt: '2026-10-03T10:00:00.000Z', condition });

const i1 = issue('i1', 3, 'Senthil', [ret(1)], { expectedReturnDate: '2026-10-02' });
const i2 = issue('i2', 1, 'Lakshmi', [ret(1, 'Lost')]);
const st = buildToolStatus(tool, [i1, i2, issue('i3', 4, 'Ghost', [], { isDeleted: true })]);
eq('Outstanding on a partly returned issue', outstandingQuantity(i1), 2);
eq('Issued counts only what is still out', st.issued, 2);
eq('Lost tools are tracked', st.lost, 1);
eq('Available = 5 − 2 issued − 1 lost', st.available, 2);
eq('Open issues exclude fully returned ones', st.openIssues.map(i => i.id), ['i1']);
eq('History keeps every issue', st.history.length, 2);
check('Overdue when past the expected date', isOverdue(i1, '2026-10-03') && !isOverdue(i1, '2026-10-02') && !isOverdue(i2, '2026-10-30'));
check('Cannot issue more than available', !validateIssue(st, 3, 'Velu').ok && validateIssue(st, 2, 'Velu').ok);
check('Receiver name is required', !validateIssue(st, 1, '  ').ok);
check('Fractional quantity refused', !validateIssue(st, 1.5, 'Velu').ok);
check('Cannot return more than is out', !validateReturn(i1, 3).ok && validateReturn(i1, 2).ok);
eq('Total cannot drop below issued + lost', minimumTotal(st), 3);

console.log(`\n✅ Domain logic: all ${passed} checks passed.`);

// ---------------------------------------------------------------------------
// 7. Reports and CSV
// ---------------------------------------------------------------------------
import { buildProjectReport, toCsv } from '../src/domain/reports';
import { flattenExpenses } from '../src/domain/expenses';
import type { OtherExpense, PaymentTransaction, ElectricityBill } from '../src/db/types';

{
  console.log('\n--- 7. Reports and CSV ---');
  const other = (id: string, date: string, amount: number, paid: number, category: OtherExpense['category'] = 'Fuel'): OtherExpense => ({
    id, siteId: 's1', date, category, description: 'x', amount, paidAmount: paid, balance: amount - paid, extraPaid: 0, isDeleted: false, createdAt: `${date}T05:00:00.000Z`, updatedAt: stamp,
  });
  const paymentRow = (id: string, date: string, amount: number, module: string): PaymentTransaction => ({
    id, siteId: 's1', relatedRecordId: id, module, date, amount, paymentType: 'Cash', isDeleted: false, createdAt: stamp, updatedAt: stamp,
  });
  const src = {
    workers: [{ id: 'w1', siteId: 's1', name: 'Senthil', phone: '', category: 'PERIYAAL', dailyWage: 800, joiningDate: '2026-09-01', isDeleted: false, createdAt: stamp, updatedAt: stamp }],
    attendance: [att('w1', '2026-09-30', 'present'), att('w1', '2026-10-01', 'present'), att('w1', '2026-10-02', 'half_day')],
    advances: [adv('a1', 'w1', '2026-10-02', 300, 'Recoverable')],
    salaryPayments: [pay('p1', 'w1', '2026-10-03', 500)],
    materials: [mat('m1', 'Ramco PPC Cement', 100, '2026-10-01', { paidAmount: 10000, balance: 30000 }), mat('m0', 'Ramco PPC Cement', 10, '2026-09-15')],
    rodEntries: [],
    stockMovements: [mv('v1', 'usage', 30, '2026-10-02'), mv('v0', 'usage', 5, '2026-09-20')],
    toolAssets: [tool],
    toolIssues: [issue('i1', 2, 'Senthil', [], { expectedReturnDate: '2026-10-02' })],
    toolCosts: [],
    teaSnacks: [], poojas: [], water: [],
    electricity: [{ id: 'e1', siteId: 's1', month: 'January 2026', billAmount: 900, paidAmount: 0, balance: 900, extraPaid: 0, isDeleted: false, createdAt: '2026-10-04T20:00:00.000Z', updatedAt: stamp } as ElectricityBill],
    otherExpenses: [other('o1', '2026-10-05', 1200, 1200), other('o2', '2026-09-10', 700, 0), { ...other('o3', '2026-10-06', 9999, 0), isDeleted: true }],
    payments: [paymentRow('x1', '2026-10-01', 10000, 'Material'), paymentRow('x2', '2026-10-03', 500, 'Salary'), paymentRow('x3', '2026-10-02', 300, 'Advance'), paymentRow('x4', '2026-10-05', 1200, 'Expense'), paymentRow('x5', '2026-09-10', 50, 'Expense')],
  };

  const oct = buildProjectReport(src, { from: '2026-10-01', to: '2026-10-31' }, { leavePaid: false }, '2026-10-11');
  eq('October materials spend excludes September purchase', oct.spend.materials, 40000);
  eq('October labour = 1.5 days × 800', oct.spend.labour, 1200);
  // Electricity bill has no date: it is dated to the Indian day it was entered (5 Oct, not 4 Oct UTC).
  eq('October site expenses = fuel 1200 + electricity 900', oct.spend.expenses, 2100);
  eq('Total recorded expenditure adds the four heads', oct.spend.total, 43300);
  eq('Paid out counts only payments dated in October', oct.paidOut.total, 12000);
  eq('Advance is part of money paid out', oct.paidOut.byType.find(t => t.key === 'Labour advances')?.total, 300);
  eq('Supplier dues are as of now, all periods', oct.outstanding.suppliers, 34000);
  // Earned all time 2.5 × 800 = 2000; paid 500; advance 300 → pending 1200
  eq('Pending salary is all-time', oct.outstanding.salary, 1200);
  eq('Unpaid expenses as of now', oct.outstanding.expenses, 1600);
  eq('Deleted expense is ignored', oct.expenseRows.some(e => e.id === 'o3'), false);
  eq('Materials: bought and used in period, stock now', [oct.materials[0].purchasedQty, oct.materials[0].usedQty, oct.materials[0].onHand], [100, 30, 75]);
  eq('Labour row counts for the period', [oct.labour[0].counts.present, oct.labour[0].counts.half_day, oct.labour[0].days], [1, 1, 1.5]);
  eq('Tool inventory row', [oct.tools[0].total, oct.tools[0].issued, oct.tools[0].available], [5, 2, 3]);
  check('Overdue tool issue is flagged', oct.openToolIssues[0].overdue === true);
  eq('One month row for October', oct.monthly.map(m => [m.month, m.total]), [['2026-10', 43300]]);

  const allTime = buildProjectReport(src, {}, { leavePaid: false }, '2026-10-11');
  eq('All-time spend includes September', allTime.spend.total, 4000 + 40000 + 2000 + 2800);
  eq('All-time months are newest first', allTime.monthly.map(m => m.month), ['2026-10', '2026-09']);

  const undated = flattenExpenses({ teaSnacks: [], poojas: [], water: [], otherExpenses: [], electricity: src.electricity });
  eq('Undated bill uses the Indian entry day, not the UTC day', undated[0].date, '2026-10-05');

  const csv = toCsv(['Name', 'Amount'], [['Sri Murugan, Traders', 1200], ['He said "ok"', 5], ['=SUM(A1:A9)', 1]]);
  eq('CSV quotes commas and doubles quotes', csv.split('\r\n').slice(1, 3), ['"Sri Murugan, Traders",1200', '"He said ""ok""",5']);
  check('CSV neutralises formula cells', csv.includes("'=SUM(A1:A9)"));
  check('CSV ends each row with CRLF', csv.endsWith('\r\n'));
  console.log(`\n✅ Domain logic incl. reports: all ${passed} checks passed.`);
}
