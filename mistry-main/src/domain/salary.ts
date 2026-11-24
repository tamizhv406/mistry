/**
 * Labour attendance and salary ledger — the single source of truth for wage maths.
 *
 * FORMULA (per worker)
 *   day value         Present 1 · Half Day 0.5 · Overtime 1.5 · Absent 0
 *                     Leave 1 if the site pays leave, otherwise 0
 *   earned            Σ over attendance days of (day value × daily wage on that day)
 *   salary paid       Σ salary payments
 *   advances          Σ recoverable advances (recovered from salary)
 *   settled           salary paid + recoverable advances
 *   pending           earned − settled, when positive
 *   overpaid          settled − earned, when positive (carried against future earnings)
 *
 * Non-recoverable advances are gifts/grants: listed, never deducted.
 * A salary payment and an advance are different records, so nothing is deducted twice.
 */
import type {
  AttendanceRecord,
  AttendanceStatus,
  LabourAdvance,
  LabourWorker,
  SalaryPayment,
} from '../db/types';
import { monthKeyOf } from '../utils/datetime';
import { roundMoney } from '../utils/money';

export interface PayPolicy {
  /** undefined = the owner has not chosen yet; leave is then counted as unpaid and flagged. */
  leavePaid?: boolean;
}

export interface AttendanceStatusMeta {
  status: AttendanceStatus;
  label: string;
  short: string;
  /** Day value stored on the record. Leave is stored as 0; paid leave is applied by policy. */
  multiplier: number;
}

export const ATTENDANCE_STATUS_META: Record<AttendanceStatus, AttendanceStatusMeta> = {
  present: { status: 'present', label: 'Present', short: 'P', multiplier: 1 },
  half_day: { status: 'half_day', label: 'Half Day', short: '½', multiplier: 0.5 },
  leave: { status: 'leave', label: 'Leave', short: 'L', multiplier: 0 },
  absent: { status: 'absent', label: 'Absent', short: 'A', multiplier: 0 },
  overtime: { status: 'overtime', label: 'Overtime', short: 'OT', multiplier: 1.5 },
};

export const ATTENDANCE_STATUS_ORDER: AttendanceStatus[] = ['present', 'half_day', 'leave', 'absent', 'overtime'];

export function storedMultiplier(status: AttendanceStatus): number {
  return ATTENDANCE_STATUS_META[status]?.multiplier ?? 0;
}

/** Worked-day equivalent of one attendance record under the site's pay policy. */
export function dayValue(record: Pick<AttendanceRecord, 'status' | 'dayMultiplier'>, policy: PayPolicy = {}): number {
  if (record.status === 'leave') return policy.leavePaid === true ? 1 : 0;
  const stored = Number(record.dayMultiplier);
  // Honour the stored value so existing records keep the value they were saved with.
  return Number.isFinite(stored) && stored >= 0 ? stored : storedMultiplier(record.status);
}

export function isRecoverableAdvance(advance: Pick<LabourAdvance, 'advanceType'>): boolean {
  // Older records may have no type; an advance with no type is an ordinary salary advance.
  return advance.advanceType !== 'Non-Recoverable';
}

/**
 * One record per worker per day. If duplicates exist (e.g. from an old import) the most
 * recently updated one wins, so a day is never paid twice.
 */
export function dedupeAttendance(records: AttendanceRecord[]): { records: AttendanceRecord[]; duplicates: number } {
  const byKey = new Map<string, AttendanceRecord>();
  let duplicates = 0;
  for (const r of records) {
    if (r.isDeleted) continue;
    const key = `${r.workerId}|${r.date}`;
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, r);
    } else {
      duplicates += 1;
      if ((r.updatedAt || '') > (prev.updatedAt || '')) byKey.set(key, r);
    }
  }
  return { records: Array.from(byKey.values()), duplicates };
}

export interface EarnedLine {
  date: string;
  status: AttendanceStatus;
  dayValue: number;
  wage: number;
  amount: number;
  recordId: string;
  notes?: string;
}

export interface WorkerLedger {
  workerId: string;
  currentDailyWage: number;
  lines: EarnedLine[];               // newest first
  datesByStatus: Record<AttendanceStatus, string[]>; // each newest first
  workedDayEquivalents: number;
  earned: number;
  salaryPaid: number;
  payments: SalaryPayment[];         // newest first
  recoverableAdvances: number;
  nonRecoverableAdvances: number;
  advances: LabourAdvance[];         // newest first
  settled: number;
  pending: number;
  overpaid: number;
  leaveDays: number;
  /** True when there are leave days but the site has no leave pay rule yet. */
  leavePolicyMissing: boolean;
  duplicateAttendanceIgnored: number;
}

const byDateDesc = <T extends { date: string; createdAt?: string }>(a: T, b: T) =>
  a.date === b.date ? (b.createdAt || '').localeCompare(a.createdAt || '') : b.date.localeCompare(a.date);

export function buildWorkerLedger(
  worker: Pick<LabourWorker, 'id' | 'dailyWage'>,
  attendance: AttendanceRecord[],
  advances: LabourAdvance[],
  payments: SalaryPayment[],
  policy: PayPolicy = {}
): WorkerLedger {
  const currentDailyWage = Math.max(0, Number(worker.dailyWage) || 0);
  const mine = attendance.filter(a => a.workerId === worker.id);
  const { records, duplicates } = dedupeAttendance(mine);

  const datesByStatus: Record<AttendanceStatus, string[]> = {
    present: [], half_day: [], leave: [], absent: [], overtime: [],
  };
  const lines: EarnedLine[] = [];
  let workedDayEquivalents = 0;
  let earned = 0;

  for (const r of records.sort(byDateDesc)) {
    const status: AttendanceStatus = ATTENDANCE_STATUS_META[r.status] ? r.status : 'absent';
    const value = dayValue({ status, dayMultiplier: r.dayMultiplier }, policy);
    const snapshot = Number(r.dailyWageSnapshot);
    const wage = Number.isFinite(snapshot) && snapshot > 0 ? snapshot : currentDailyWage;
    const amount = roundMoney(value * wage);
    datesByStatus[status].push(r.date);
    lines.push({ date: r.date, status, dayValue: value, wage, amount, recordId: r.id, notes: r.notes });
    workedDayEquivalents += value;
    earned += amount;
  }

  const myPayments = payments.filter(p => p.workerId === worker.id && !p.isDeleted).sort(byDateDesc);
  const myAdvances = advances.filter(a => a.workerId === worker.id && !a.isDeleted).sort(byDateDesc);

  const salaryPaid = roundMoney(myPayments.reduce((s, p) => s + (Number(p.paidAmount) || 0), 0));
  const recoverableAdvances = roundMoney(
    myAdvances.filter(isRecoverableAdvance).reduce((s, a) => s + (Number(a.amount) || 0), 0)
  );
  const nonRecoverableAdvances = roundMoney(
    myAdvances.filter(a => !isRecoverableAdvance(a)).reduce((s, a) => s + (Number(a.amount) || 0), 0)
  );

  earned = roundMoney(earned);
  const settled = roundMoney(salaryPaid + recoverableAdvances);
  const leaveDays = datesByStatus.leave.length;

  return {
    workerId: worker.id,
    currentDailyWage,
    lines,
    datesByStatus,
    workedDayEquivalents: roundMoney(workedDayEquivalents),
    earned,
    salaryPaid,
    payments: myPayments,
    recoverableAdvances,
    nonRecoverableAdvances,
    advances: myAdvances,
    settled,
    pending: roundMoney(Math.max(0, earned - settled)),
    overpaid: roundMoney(Math.max(0, settled - earned)),
    leaveDays,
    leavePolicyMissing: leaveDays > 0 && policy.leavePaid === undefined,
    duplicateAttendanceIgnored: duplicates,
  };
}

export interface MonthSummary {
  monthKey: string;
  counts: Record<AttendanceStatus, number>;
  workedDayEquivalents: number;
  earned: number;
  salaryPaid: number;
  recoverableAdvances: number;
}

/** Attendance and money for one calendar month (by event date). */
export function summariseMonth(ledger: WorkerLedger, monthKey: string): MonthSummary {
  const counts: Record<AttendanceStatus, number> = { present: 0, half_day: 0, leave: 0, absent: 0, overtime: 0 };
  let workedDayEquivalents = 0;
  let earned = 0;
  for (const l of ledger.lines) {
    if (monthKeyOf(l.date) !== monthKey) continue;
    counts[l.status] += 1;
    workedDayEquivalents += l.dayValue;
    earned += l.amount;
  }
  const inMonth = (d: string) => monthKeyOf(d) === monthKey;
  return {
    monthKey,
    counts,
    workedDayEquivalents: roundMoney(workedDayEquivalents),
    earned: roundMoney(earned),
    salaryPaid: roundMoney(ledger.payments.filter(p => inMonth(p.date)).reduce((s, p) => s + (Number(p.paidAmount) || 0), 0)),
    recoverableAdvances: roundMoney(
      ledger.advances.filter(a => inMonth(a.date) && isRecoverableAdvance(a)).reduce((s, a) => s + (Number(a.amount) || 0), 0)
    ),
  };
}

export interface SiteLabourSummary {
  earned: number;
  salaryPaid: number;
  recoverableAdvances: number;
  nonRecoverableAdvances: number;
  /** Sum of what is still owed to workers who are owed money. */
  pending: number;
  /** Sum of amounts paid ahead to workers who have received more than they earned. */
  overpaid: number;
  ledgers: Map<string, WorkerLedger>;
}

export function buildSiteLabourSummary(
  workers: Pick<LabourWorker, 'id' | 'dailyWage'>[],
  attendance: AttendanceRecord[],
  advances: LabourAdvance[],
  payments: SalaryPayment[],
  policy: PayPolicy = {}
): SiteLabourSummary {
  const ledgers = new Map<string, WorkerLedger>();
  const total = { earned: 0, salaryPaid: 0, recoverableAdvances: 0, nonRecoverableAdvances: 0, pending: 0, overpaid: 0 };
  for (const w of workers) {
    const l = buildWorkerLedger(w, attendance, advances, payments, policy);
    ledgers.set(w.id, l);
    total.earned += l.earned;
    total.salaryPaid += l.salaryPaid;
    total.recoverableAdvances += l.recoverableAdvances;
    total.nonRecoverableAdvances += l.nonRecoverableAdvances;
    total.pending += l.pending;
    total.overpaid += l.overpaid;
  }
  return {
    earned: roundMoney(total.earned),
    salaryPaid: roundMoney(total.salaryPaid),
    recoverableAdvances: roundMoney(total.recoverableAdvances),
    nonRecoverableAdvances: roundMoney(total.nonRecoverableAdvances),
    pending: roundMoney(total.pending),
    overpaid: roundMoney(total.overpaid),
    ledgers,
  };
}

export function countByStatus(records: AttendanceRecord[]): Record<AttendanceStatus, number> {
  const counts: Record<AttendanceStatus, number> = { present: 0, half_day: 0, leave: 0, absent: 0, overtime: 0 };
  for (const r of dedupeAttendance(records).records) {
    if (counts[r.status] !== undefined) counts[r.status] += 1;
  }
  return counts;
}

/**
 * A payment or advance that looks like an accidental repeat: same worker, same day, same amount.
 * The caller should ask the user before saving a second one.
 */
export function findDuplicateMoneyEntry<T extends { id: string; workerId: string; date: string; isDeleted: boolean }>(
  existing: T[],
  candidate: { workerId: string; date: string; amount: number; ignoreId?: string },
  amountOf: (row: T) => number
): T | undefined {
  return existing.find(
    row =>
      !row.isDeleted &&
      row.id !== candidate.ignoreId &&
      row.workerId === candidate.workerId &&
      row.date === candidate.date &&
      Math.abs(amountOf(row) - candidate.amount) < 0.005
  );
}
