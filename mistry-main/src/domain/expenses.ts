/**
 * One flat view over the five expense tables, so lists, filters and reports agree.
 * Material purchases, tool costs and labour are separate cost heads and are not included here.
 */
import type { ElectricityBill, OtherExpense, PoojaExpense, TeaSnacksExpense, WaterBill, EntityTable } from '../db/types';
import { dayKeyOf, isDayKey } from '../utils/datetime';

export interface ExpenseRow {
  id: string;
  table: EntityTable;
  category: string;
  date: string;          // YYYY-MM-DD event date
  title: string;
  payee: string;
  amount: number;
  paid: number;
  due: number;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export function flattenExpenses(src: {
  teaSnacks: TeaSnacksExpense[];
  poojas: PoojaExpense[];
  electricity: (ElectricityBill & { date?: string })[];
  water: WaterBill[];
  otherExpenses: OtherExpense[];
}): ExpenseRow[] {
  const rows: ExpenseRow[] = [];
  const num = (v: unknown) => Number(v) || 0;
  const due = (total: number, paid: number) => Math.max(0, total - paid);

  for (const t of src.teaSnacks) {
    if (t.isDeleted) continue;
    rows.push({ id: t.id, table: 'teaSnacksExpenses', category: 'Tea & Snacks', date: t.date, title: 'Tea & Snacks', payee: t.payee || '', amount: num(t.totalAmount), paid: num(t.paidAmount), due: due(num(t.totalAmount), num(t.paidAmount)), notes: t.notes || '', createdAt: t.createdAt, updatedAt: t.updatedAt });
  }
  for (const p of src.poojas) {
    if (p.isDeleted) continue;
    rows.push({ id: p.id, table: 'poojaExpenses', category: 'Pooja', date: p.date, title: p.poojaName || 'Pooja', payee: p.payee || '', amount: num(p.totalAmount), paid: num(p.paidAmount), due: due(num(p.totalAmount), num(p.paidAmount)), notes: p.notes || '', createdAt: p.createdAt, updatedAt: p.updatedAt });
  }
  for (const e of src.electricity) {
    if (e.isDeleted) continue;
    // Older bills only have a billing month; they are dated to the day they were entered.
    const date = e.date || (e.createdAt ? dayKeyOf(e.createdAt) : isDayKey(`${e.month}-01`) ? `${e.month}-01` : '');
    rows.push({ id: e.id, table: 'electricityBills', category: 'Electricity', date, title: `Electricity bill${e.month ? ' · ' + e.month : ''}`, payee: e.payee || '', amount: num(e.billAmount), paid: num(e.paidAmount), due: due(num(e.billAmount), num(e.paidAmount)), notes: e.notes || '', createdAt: e.createdAt, updatedAt: e.updatedAt });
  }
  for (const w of src.water) {
    if (w.isDeleted) continue;
    rows.push({ id: w.id, table: 'waterBills', category: 'Water', date: w.date, title: 'Water', payee: w.payee || w.supplier || '', amount: num(w.billAmount), paid: num(w.paidAmount), due: due(num(w.billAmount), num(w.paidAmount)), notes: w.notes || '', createdAt: w.createdAt, updatedAt: w.updatedAt });
  }
  for (const o of src.otherExpenses) {
    if (o.isDeleted) continue;
    rows.push({ id: o.id, table: 'otherExpenses', category: o.category === 'Equipment' ? 'Equipment Hire' : o.category, date: o.date, title: o.description || o.category, payee: o.payee || '', amount: num(o.amount), paid: num(o.paidAmount), due: due(num(o.amount), num(o.paidAmount)), notes: o.notes || '', createdAt: o.createdAt, updatedAt: o.updatedAt });
  }

  return rows.sort((a, b) => (a.date === b.date ? b.createdAt.localeCompare(a.createdAt) : b.date.localeCompare(a.date)));
}

export function sumBy<T>(rows: T[], pick: (row: T) => number): number {
  return Math.round(rows.reduce((s, r) => s + (pick(r) || 0), 0) * 100) / 100;
}

export function groupTotals<T>(rows: T[], keyOf: (row: T) => string, amountOf: (row: T) => number): { key: string; total: number; count: number }[] {
  const map = new Map<string, { key: string; total: number; count: number }>();
  for (const r of rows) {
    const key = keyOf(r);
    const g = map.get(key) || { key, total: 0, count: 0 };
    g.total += amountOf(r) || 0;
    g.count += 1;
    map.set(key, g);
  }
  return Array.from(map.values())
    .map(g => ({ ...g, total: Math.round(g.total * 100) / 100 }))
    .sort((a, b) => b.total - a.total);
}
