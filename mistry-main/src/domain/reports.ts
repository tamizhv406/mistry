/**
 * Project report figures. Pure functions over a project's records.
 *
 * Two different questions are answered separately and never mixed:
 *   "Recorded expenditure" — the value of what was bought and the wages earned in the period,
 *                            whether or not the money has been paid yet (by event date).
 *   "Paid out"             — cash that actually left, from the payments ledger (by payment date).
 * "Still to pay" is always the position as of now, not for the selected period.
 */
import type {
  AttendanceRecord, AttendanceStatus, ElectricityBill, LabourAdvance, LabourWorker, Material, OtherExpense, PaymentTransaction,
  PoojaExpense, RodEntry, SalaryPayment, StockMovement, TeaSnacksExpense, ToolAsset, ToolIssue, ToolItem, WaterBill,
} from '../db/types';
import { buildSiteLabourSummary, type PayPolicy } from './salary';
import { buildStock } from './stock';
import { buildToolStatus, isOverdue, outstandingQuantity } from './toolTracking';
import { flattenExpenses, groupTotals, type ExpenseRow } from './expenses';
import { inDayRange, monthKeyOf } from '../utils/datetime';
import { roundMoney } from '../utils/money';

export interface ReportRange {
  from?: string;
  to?: string;
}

export interface ReportSource {
  workers: LabourWorker[];
  attendance: AttendanceRecord[];
  advances: LabourAdvance[];
  salaryPayments: SalaryPayment[];
  materials: Material[];
  rodEntries: RodEntry[];
  stockMovements: StockMovement[];
  toolAssets: ToolAsset[];
  toolIssues: ToolIssue[];
  toolCosts: ToolItem[];
  teaSnacks: TeaSnacksExpense[];
  poojas: PoojaExpense[];
  electricity: ElectricityBill[];
  water: WaterBill[];
  otherExpenses: OtherExpense[];
  payments: PaymentTransaction[];
}

export interface LabourReportRow {
  workerId: string;
  name: string;
  category: string;
  dailyWage: number;
  counts: Record<AttendanceStatus, number>;   // in range
  days: number;                               // day equivalents in range
  earned: number;                             // in range
  paidInRange: number;
  advancesInRange: number;
  earnedAllTime: number;
  paidAllTime: number;
  advancesAllTime: number;
  pending: number;                            // as of now
  overpaid: number;                           // as of now
}

export interface MaterialReportRow {
  name: string;
  category: string;
  unit: string;
  purchasedQty: number;   // in range
  purchasedCost: number;  // in range
  usedQty: number;        // in range
  onHand: number;         // as of now
}

export interface ToolReportRow {
  name: string;
  category: string;
  total: number;
  available: number;
  issued: number;
  lost: number;
  condition: string;
}

export interface MonthRow {
  month: string;
  materials: number;
  labour: number;
  tools: number;
  expenses: number;
  total: number;
}

export interface ProjectReport {
  range: ReportRange;
  spend: { materials: number; labour: number; tools: number; expenses: number; total: number };
  paidOut: { total: number; byType: { key: string; total: number; count: number }[] };
  outstanding: { suppliers: number; salary: number; expenses: number; tools: number; total: number };
  monthly: MonthRow[];
  expensesByCategory: { key: string; total: number; count: number }[];
  expenseRows: ExpenseRow[];
  materials: MaterialReportRow[];
  labour: LabourReportRow[];
  labourTotals: { earned: number; paidInRange: number; advancesInRange: number; pending: number; overpaid: number; nonRecoverable: number };
  tools: ToolReportRow[];
  openToolIssues: { tool: string; issuedTo: string; quantity: number; issuedAt: string; expectedReturnDate?: string; overdue: boolean }[];
}

const PAYMENT_TYPE_LABEL: Record<string, string> = {
  Material: 'Material suppliers',
  Salary: 'Salary',
  Advance: 'Labour advances',
  Expense: 'Site expenses',
  OtherExpense: 'Site expenses',
  Tool: 'Tools',
};

const num = (v: unknown) => Number(v) || 0;

export function buildProjectReport(src: ReportSource, range: ReportRange, policy: PayPolicy, todayKey: string): ProjectReport {
  const within = (day?: string) => (!range.from && !range.to ? true : inDayRange(day, range.from, range.to));
  const live = <T extends { isDeleted: boolean }>(rows: T[]) => rows.filter(r => !r.isDeleted);

  const materials = live(src.materials);
  const rods = live(src.rodEntries);
  const toolCosts = live(src.toolCosts);
  const expenseRowsAll = flattenExpenses(src);
  const expenseRows = expenseRowsAll.filter(e => within(e.date));
  const labour = buildSiteLabourSummary(src.workers, src.attendance, src.advances, src.salaryPayments, policy);

  // ---- Recorded expenditure in range ------------------------------------
  const materialSpend = roundMoney(
    materials.filter(m => within(m.purchaseDate)).reduce((s, m) => s + num(m.totalAmount), 0) +
    rods.filter(r => within(r.purchaseDate)).reduce((s, r) => s + num(r.totalAmount), 0)
  );
  const toolSpend = roundMoney(toolCosts.filter(t => within(t.purchaseDate)).reduce((s, t) => s + num(t.cost), 0));
  const expenseSpend = roundMoney(expenseRows.reduce((s, e) => s + e.amount, 0));

  // ---- Labour ------------------------------------------------------------
  const labourRows: LabourReportRow[] = src.workers.filter(w => !w.isDeleted).map(w => {
    const l = labour.ledgers.get(w.id)!;
    const counts: Record<AttendanceStatus, number> = { present: 0, half_day: 0, leave: 0, absent: 0, overtime: 0 };
    let days = 0;
    let earned = 0;
    for (const line of l.lines) {
      if (!within(line.date)) continue;
      counts[line.status] += 1;
      days += line.dayValue;
      earned += line.amount;
    }
    return {
      workerId: w.id,
      name: w.name,
      category: String(w.category),
      dailyWage: num(w.dailyWage),
      counts,
      days: roundMoney(days),
      earned: roundMoney(earned),
      paidInRange: roundMoney(l.payments.filter(p => within(p.date)).reduce((s, p) => s + num(p.paidAmount), 0)),
      advancesInRange: roundMoney(l.advances.filter(a => within(a.date)).reduce((s, a) => s + num(a.amount), 0)),
      earnedAllTime: l.earned,
      paidAllTime: l.salaryPaid,
      advancesAllTime: l.recoverableAdvances,
      pending: l.pending,
      overpaid: l.overpaid,
    };
  });
  const labourSpend = roundMoney(labourRows.reduce((s, r) => s + r.earned, 0));

  // ---- Paid out in range -------------------------------------------------
  const paymentsInRange = live(src.payments).filter(p => within(p.date));
  const byType = groupTotals(paymentsInRange, p => PAYMENT_TYPE_LABEL[p.module || ''] || p.module || 'Other', p => num(p.amount));

  // ---- Outstanding now ---------------------------------------------------
  const suppliers = roundMoney(materials.reduce((s, m) => s + num(m.balance), 0) + rods.reduce((s, r) => s + num(r.balance), 0));
  const toolsDue = roundMoney(toolCosts.reduce((s, t) => s + num(t.balance), 0));
  const expensesDue = roundMoney(expenseRowsAll.reduce((s, e) => s + e.due, 0));

  // ---- Monthly -----------------------------------------------------------
  const months = new Map<string, MonthRow>();
  const month = (key: string) => {
    let m = months.get(key);
    if (!m) { m = { month: key, materials: 0, labour: 0, tools: 0, expenses: 0, total: 0 }; months.set(key, m); }
    return m;
  };
  for (const m of materials) if (m.purchaseDate && within(m.purchaseDate)) month(monthKeyOf(m.purchaseDate)).materials += num(m.totalAmount);
  for (const r of rods) if (r.purchaseDate && within(r.purchaseDate)) month(monthKeyOf(r.purchaseDate)).materials += num(r.totalAmount);
  for (const t of toolCosts) if (t.purchaseDate && within(t.purchaseDate)) month(monthKeyOf(t.purchaseDate)).tools += num(t.cost);
  for (const e of expenseRows) month(monthKeyOf(e.date)).expenses += e.amount;
  for (const l of labour.ledgers.values()) for (const line of l.lines) if (within(line.date)) month(monthKeyOf(line.date)).labour += line.amount;
  const monthly = Array.from(months.values())
    .map(m => ({
      month: m.month,
      materials: roundMoney(m.materials), labour: roundMoney(m.labour), tools: roundMoney(m.tools), expenses: roundMoney(m.expenses),
      total: roundMoney(m.materials + m.labour + m.tools + m.expenses),
    }))
    .sort((a, b) => b.month.localeCompare(a.month));

  // ---- Materials ---------------------------------------------------------
  const stock = buildStock(src.materials, src.rodEntries, src.stockMovements);
  const materialRows: MaterialReportRow[] = stock
    .map(item => {
      let purchasedQty = 0;
      let purchasedCost = 0;
      let usedQty = 0;
      for (const l of item.lines) {
        if (l.voided || !within(l.date)) continue;
        if (l.type === 'purchase') { purchasedQty += l.quantity; purchasedCost += l.cost || 0; }
        if (l.type === 'usage') usedQty += l.quantity;
      }
      return {
        name: item.name, category: item.category, unit: item.unit,
        purchasedQty: Math.round(purchasedQty * 1000) / 1000, purchasedCost: roundMoney(purchasedCost),
        usedQty: Math.round(usedQty * 1000) / 1000, onHand: item.onHand,
      };
    })
    .filter(r => r.purchasedQty > 0 || r.usedQty > 0 || r.onHand !== 0);

  // ---- Tools -------------------------------------------------------------
  const assets = live(src.toolAssets);
  const tools: ToolReportRow[] = assets.map(t => {
    const st = buildToolStatus(t, src.toolIssues);
    return { name: t.name, category: t.category, total: st.total, available: st.available, issued: st.issued, lost: st.lost, condition: t.condition };
  });
  const assetName = new Map(assets.map(t => [t.id, t.name]));
  const openToolIssues = live(src.toolIssues)
    .filter(i => outstandingQuantity(i) > 0 && assetName.has(i.toolAssetId))
    .map(i => ({
      tool: assetName.get(i.toolAssetId) || '', issuedTo: i.issuedTo, quantity: outstandingQuantity(i),
      issuedAt: i.issuedAt, expectedReturnDate: i.expectedReturnDate, overdue: isOverdue(i, todayKey),
    }));

  return {
    range,
    spend: { materials: materialSpend, labour: labourSpend, tools: toolSpend, expenses: expenseSpend, total: roundMoney(materialSpend + labourSpend + toolSpend + expenseSpend) },
    paidOut: { total: roundMoney(paymentsInRange.reduce((s, p) => s + num(p.amount), 0)), byType },
    outstanding: { suppliers, salary: labour.pending, expenses: expensesDue, tools: toolsDue, total: roundMoney(suppliers + labour.pending + expensesDue + toolsDue) },
    monthly,
    expensesByCategory: groupTotals(expenseRows, e => e.category, e => e.amount),
    expenseRows,
    materials: materialRows,
    labour: labourRows,
    labourTotals: {
      earned: labourSpend,
      paidInRange: roundMoney(labourRows.reduce((s, r) => s + r.paidInRange, 0)),
      advancesInRange: roundMoney(labourRows.reduce((s, r) => s + r.advancesInRange, 0)),
      pending: labour.pending,
      overpaid: labour.overpaid,
      nonRecoverable: labour.nonRecoverableAdvances,
    },
    tools,
    openToolIssues,
  };
}

/** RFC 4180 CSV. Values that could be read as formulas by a spreadsheet are neutralised. */
export function toCsv(headers: string[], rows: (string | number | undefined | null)[][]): string {
  const cell = (v: string | number | undefined | null) => {
    if (v === undefined || v === null) return '';
    if (typeof v === 'number') return String(v);
    let s = String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers, ...rows].map(r => r.map(cell).join(',')).join('\r\n') + '\r\n';
}
