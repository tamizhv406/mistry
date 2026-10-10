/**
 * Write operations for site records (attendance, salary, advances, stock, tools, expenses).
 *
 * Every write:
 *  - checks the acting user may write to the site,
 *  - stamps createdAt / updatedAt as UTC instants and keeps the event date as a calendar day,
 *  - records who created or edited the record,
 *  - keeps the shared `payments` ledger in step without ever counting a payment twice.
 */
import { db } from '../db/db';
import type {
  AttendanceRecord, AttendanceStatus, CatalogItem, ElectricityBill, LabourAdvance, LabourWorker, Material,
  MaterialCategory, OtherExpense, OtherExpenseCategory, PoojaExpense, SalaryPayment, Site, StockMovement,
  StockMovementType, TeaSnacksExpense, ToolAsset, ToolCondition, ToolIssue, User, WaterBill, EntityTable,
} from '../db/types';
import { storedMultiplier, findDuplicateMoneyEntry } from '../domain/salary';
import { buildStock, stockItemKey, validateMovement } from '../domain/stock';
import { buildToolStatus, minimumTotal, validateIssue, validateReturn } from '../domain/toolTracking';
import { calculateFinancialBalance, generatePaymentId, syncParentRecordFinances } from '../utils/financial';
import { isDayKey, nowIso, todayKey } from '../utils/datetime';
import { roundMoney } from '../utils/money';
import { isAdmin } from './auth';
import { builtInCatalog } from '../domain/catalog';

export type Result<T = void> = { ok: true; value: T } | { ok: false; error: string; duplicateOf?: string };

const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

export function newId(prefix: string): string {
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 12)
      : Math.random().toString(36).slice(2, 14);
  return `${prefix}-${Date.now().toString(36)}-${rand}`;
}

/** The site, if this user may write to it. */
export async function writableSite(user: User | null | undefined, siteId: string): Promise<Site | null> {
  if (!user) return null;
  const site = await db.sites.get(siteId);
  if (!site || site.isDeleted) return null;
  if (isAdmin(user)) return site;
  // Sites created before ownership was recorded have no userId; they stay usable.
  if (site.userId && site.userId !== user.id) return null;
  return site;
}

const NO_ACCESS = 'You do not have access to this project.';

function checkEventDate(date: string): string | null {
  if (!isDayKey(date)) return 'Choose a valid date.';
  if (date > todayKey()) return 'The date cannot be in the future.';
  return null;
}

async function log(user: User, site: Site, action: string, description: string): Promise<void> {
  await db.logActivity(user.id, user.fullName || user.username, user.role, site.id, site.name, action, description);
}

// ---------------------------------------------------------------------------
// Attendance
// ---------------------------------------------------------------------------

export function attendanceId(workerId: string, date: string): string {
  return `att-${workerId}-${date}`;
}

/**
 * Marks (or corrects) one worker's attendance for one day. Idempotent: marking the same
 * status twice changes nothing, so a double tap cannot create a second record.
 */
export async function markAttendance(
  user: User,
  siteId: string,
  worker: Pick<LabourWorker, 'id' | 'dailyWage' | 'name'>,
  date: string,
  status: AttendanceStatus,
  notes?: string
): Promise<Result<AttendanceRecord>> {
  const site = await writableSite(user, siteId);
  if (!site) return fail(NO_ACCESS);
  const dateError = checkEventDate(date);
  if (dateError) return fail(dateError);

  const now = nowIso();
  return db.transaction('rw', db.attendance, async () => {
    const sameDay = await db.attendance
      .where('workerId').equals(worker.id)
      .filter(a => !a.isDeleted && a.date === date && a.siteId === siteId)
      .toArray();
    const existing = sameDay.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))[0];

    if (existing) {
      const noteChanged = notes !== undefined && notes.trim() !== (existing.notes || '');
      if (existing.status === status && !noteChanged) return { ok: true as const, value: existing };
      const updated: AttendanceRecord = {
        ...existing,
        status,
        dayMultiplier: storedMultiplier(status),
        notes: notes !== undefined ? notes.trim() : existing.notes,
        updatedBy: user.id,
        updatedAt: now,
        editHistory:
          existing.status === status
            ? existing.editHistory
            : [...(existing.editHistory || []), { at: now, by: user.id, byName: user.fullName || user.username, from: existing.status, to: status }],
      };
      await db.attendance.put(updated);
      return { ok: true as const, value: updated };
    }

    const record: AttendanceRecord = {
      id: attendanceId(worker.id, date),
      userId: site.userId || user.id,
      siteId,
      workerId: worker.id,
      date,
      status,
      dayMultiplier: storedMultiplier(status),
      dailyWageSnapshot: Math.max(0, Number(worker.dailyWage) || 0),
      notes: notes?.trim() || '',
      createdBy: user.id,
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
    };
    await db.attendance.put(record);
    return { ok: true as const, value: record };
  });
}

/** Removes a mark (moves it to the Recycle Bin) so the day shows as "not marked". */
export async function clearAttendance(user: User, siteId: string, workerId: string, date: string): Promise<Result> {
  const site = await writableSite(user, siteId);
  if (!site) return fail(NO_ACCESS);
  const rows = await db.attendance.where('workerId').equals(workerId).filter(a => !a.isDeleted && a.date === date && a.siteId === siteId).toArray();
  const now = nowIso();
  for (const r of rows) await db.attendance.update(r.id, { isDeleted: true, deletedAt: now, updatedAt: now, updatedBy: user.id });
  return { ok: true, value: undefined };
}

export async function setLeavePolicy(user: User, siteId: string, leavePaid: boolean): Promise<Result> {
  const site = await writableSite(user, siteId);
  if (!site) return fail(NO_ACCESS);
  await db.sites.update(siteId, { leavePaid, updatedAt: nowIso() });
  await log(user, site, 'PAY_POLICY', `Leave days set to ${leavePaid ? 'paid' : 'unpaid'}`);
  return { ok: true, value: undefined };
}

// ---------------------------------------------------------------------------
// Payments ledger helper
// ---------------------------------------------------------------------------

/**
 * Keeps exactly one `payments` row for a record that represents a single payout.
 * Creating adds the row; editing changes that same row instead of adding another,
 * which is what previously doubled the paid amount.
 */
async function upsertSinglePayment(params: {
  siteId: string; recordId: string; table: EntityTable; amount: number; date: string;
  paymentType: string; notes: string; module: string; userId?: string;
}): Promise<Result> {
  const linked = await db.payments.where('relatedRecordId').equals(params.recordId).filter(p => !p.isDeleted).toArray();
  const now = nowIso();
  if (linked.length > 1) {
    return fail('This entry has several instalments. Open Payment Ledger to change them one by one.');
  }
  if (linked.length === 1) {
    await db.payments.update(linked[0].id, {
      amount: params.amount, date: params.date, paymentType: params.paymentType, notes: params.notes, updatedAt: now,
    });
  } else if (params.amount > 0) {
    await db.payments.put({
      id: generatePaymentId(), userId: params.userId, siteId: params.siteId, relatedRecordId: params.recordId,
      module: params.module, date: params.date, amount: params.amount, paymentType: params.paymentType,
      notes: params.notes, isDeleted: false, createdAt: now, updatedAt: now,
    });
  }
  await syncParentRecordFinances(params.table, params.recordId);
  return { ok: true, value: undefined };
}

// ---------------------------------------------------------------------------
// Salary payments and advances
// ---------------------------------------------------------------------------

export interface MoneyEntryInput {
  id?: string;                 // present when correcting an existing entry
  workerId: string;
  date: string;
  amount: number;
  paymentMode?: string;
  notes?: string;
  /** Set after the user has confirmed an entry that looks like a repeat. */
  allowDuplicate?: boolean;
}

function checkAmount(amount: number): string | null {
  if (!Number.isFinite(amount) || amount <= 0) return 'Enter an amount greater than ₹0.';
  if (amount > 1_00_00_000) return 'That amount looks too large. Please check it.';
  return null;
}

export async function saveSalaryPayment(user: User, siteId: string, input: MoneyEntryInput): Promise<Result<SalaryPayment>> {
  const site = await writableSite(user, siteId);
  if (!site) return fail(NO_ACCESS);
  const amount = roundMoney(input.amount);
  const err = checkAmount(amount) || checkEventDate(input.date);
  if (err) return fail(err);
  const worker = await db.workers.get(input.workerId);
  if (!worker || worker.isDeleted || worker.siteId !== siteId) return fail('Worker not found in this project.');

  const existing = await db.salaryPayments.where('workerId').equals(input.workerId).toArray();
  if (!input.allowDuplicate) {
    const dup = findDuplicateMoneyEntry(existing, { workerId: input.workerId, date: input.date, amount, ignoreId: input.id }, p => Number(p.paidAmount) || 0);
    if (dup) return { ok: false, error: 'The same payment is already recorded for this worker on this date.', duplicateOf: dup.id };
  }

  const now = nowIso();
  const previous = input.id ? await db.salaryPayments.get(input.id) : undefined;
  if (input.id && !previous) return fail('Payment not found.');

  const record: SalaryPayment = {
    ...(previous || { daysWorked: 0, grossSalary: 0, advanceDeducted: 0, balance: 0, extraPaid: 0 }),
    id: previous?.id || newId('sal'),
    userId: previous?.userId || site.userId || user.id,
    siteId,
    workerId: input.workerId,
    date: input.date,
    paidAmount: amount,
    // A salary payout is a completed payment, so its own total equals what was paid.
    grossSalary: amount,
    balance: 0,
    extraPaid: 0,
    paymentMode: input.paymentMode || 'Cash',
    notes: (input.notes || '').trim(),
    createdBy: previous?.createdBy || user.id,
    updatedBy: previous ? user.id : undefined,
    isDeleted: false,
    createdAt: previous?.createdAt || now,
    updatedAt: now,
  };

  return db.transaction('rw', db.salaryPayments, db.payments, db.activityLogs, async () => {
    await db.salaryPayments.put(record);
    const linked = await upsertSinglePayment({
      siteId, recordId: record.id, table: 'salaryPayments', amount, date: input.date,
      paymentType: record.paymentMode || 'Cash', notes: `Salary to ${worker.name}${record.notes ? ': ' + record.notes : ''}`,
      module: 'Salary', userId: user.id,
    });
    if (!linked.ok) throw new Error(linked.error);
    // syncParentRecordFinances rewrites paid/balance from the ledger; keep the payout whole.
    await db.salaryPayments.update(record.id, { paidAmount: amount, balance: 0, extraPaid: 0 });
    await log(user, site, previous ? 'SALARY_CORRECTED' : 'SALARY_PAID',
      previous
        ? `Salary payment to ${worker.name} corrected from ₹${previous.paidAmount} to ₹${amount}`
        : `Salary ₹${amount} paid to ${worker.name}`);
    return { ok: true as const, value: record };
  }).catch((e: Error) => fail(e.message));
}

export interface AdvanceInput extends MoneyEntryInput {
  advanceType: 'Recoverable' | 'Non-Recoverable';
  reason?: string;
}

export async function saveAdvance(user: User, siteId: string, input: AdvanceInput): Promise<Result<LabourAdvance>> {
  const site = await writableSite(user, siteId);
  if (!site) return fail(NO_ACCESS);
  const amount = roundMoney(input.amount);
  const err = checkAmount(amount) || checkEventDate(input.date);
  if (err) return fail(err);
  const worker = await db.workers.get(input.workerId);
  if (!worker || worker.isDeleted || worker.siteId !== siteId) return fail('Worker not found in this project.');

  const existing = await db.labourAdvances.where('workerId').equals(input.workerId).toArray();
  if (!input.allowDuplicate) {
    const dup = findDuplicateMoneyEntry(existing, { workerId: input.workerId, date: input.date, amount, ignoreId: input.id }, a => Number(a.amount) || 0);
    if (dup) return { ok: false, error: 'The same advance is already recorded for this worker on this date.', duplicateOf: dup.id };
  }

  const now = nowIso();
  const previous = input.id ? await db.labourAdvances.get(input.id) : undefined;
  if (input.id && !previous) return fail('Advance not found.');

  const record: LabourAdvance = {
    ...(previous || {}),
    id: previous?.id || newId('adv'),
    userId: previous?.userId || site.userId || user.id,
    siteId,
    workerId: input.workerId,
    date: input.date,
    amount,
    advanceType: input.advanceType,
    reason: (input.reason || '').trim(),
    notes: (input.notes || '').trim(),
    createdBy: previous?.createdBy || user.id,
    updatedBy: previous ? user.id : undefined,
    isDeleted: false,
    createdAt: previous?.createdAt || now,
    updatedAt: now,
  };

  return db.transaction('rw', db.labourAdvances, db.payments, db.activityLogs, async () => {
    await db.labourAdvances.put(record);
    const linked = await upsertSinglePayment({
      siteId, recordId: record.id, table: 'labourAdvances', amount, date: input.date,
      paymentType: input.paymentMode || 'Cash',
      notes: `Advance to ${worker.name} (${input.advanceType})${record.reason ? ': ' + record.reason : ''}`,
      module: 'Advance', userId: user.id,
    });
    if (!linked.ok) throw new Error(linked.error);
    await log(user, site, previous ? 'ADVANCE_CORRECTED' : 'ADVANCE_GIVEN',
      previous
        ? `Advance to ${worker.name} corrected from ₹${previous.amount} to ₹${amount}`
        : `${input.advanceType} advance ₹${amount} given to ${worker.name}`);
    return { ok: true as const, value: record };
  }).catch((e: Error) => fail(e.message));
}

/** Moves a salary payment or advance to the Recycle Bin together with its ledger row. */
export async function removeMoneyEntry(user: User, siteId: string, table: 'salaryPayments' | 'labourAdvances', id: string): Promise<Result> {
  const site = await writableSite(user, siteId);
  if (!site) return fail(NO_ACCESS);
  const now = nowIso();
  await db.transaction('rw', db.table(table), db.payments, db.activityLogs, async () => {
    await db.table(table).update(id, { isDeleted: true, deletedAt: now, updatedAt: now, updatedBy: user.id });
    const linked = await db.payments.where('relatedRecordId').equals(id).filter(p => !p.isDeleted).toArray();
    for (const p of linked) await db.payments.update(p.id, { isDeleted: true, deletedAt: now, updatedAt: now });
    await log(user, site, 'SOFT_DELETE', `Moved ${table === 'salaryPayments' ? 'salary payment' : 'advance'} to Recycle Bin`);
  });
  return { ok: true, value: undefined };
}

// ---------------------------------------------------------------------------
// Materials: purchases and stock movements
// ---------------------------------------------------------------------------

export interface PurchaseInput {
  category: MaterialCategory;
  materialName: string;
  brand?: string;
  materialType?: string;
  grade?: string;
  catalogItemId?: string;
  supplier?: string;
  quantity: number;
  unit: string;
  rate: number;
  paidAmount: number;
  paymentMode?: string;
  purchaseDate: string;
  invoiceNumber?: string;
  notes?: string;
}

export async function recordPurchase(user: User, siteId: string, input: PurchaseInput): Promise<Result<Material>> {
  const site = await writableSite(user, siteId);
  if (!site) return fail(NO_ACCESS);
  const name = input.materialName.trim();
  if (!name) return fail('Enter the material name.');
  if (!input.unit.trim()) return fail('Choose a unit.');
  if (!Number.isFinite(input.quantity) || input.quantity <= 0) return fail('Enter a quantity greater than zero.');
  if (!Number.isFinite(input.rate) || input.rate < 0) return fail('Enter a valid unit price.');
  if (!Number.isFinite(input.paidAmount) || input.paidAmount < 0) return fail('Enter a valid paid amount.');
  const dateError = checkEventDate(input.purchaseDate);
  if (dateError) return fail(dateError);

  const total = roundMoney(input.quantity * input.rate);
  const fin = calculateFinancialBalance(total, input.paidAmount);
  const now = nowIso();
  const record: Material = {
    id: newId('mat'),
    userId: site.userId || user.id,
    siteId,
    category: input.category,
    materialName: name,
    brand: input.brand?.trim() || undefined,
    materialType: input.materialType || undefined,
    grade: input.grade || undefined,
    catalogItemId: input.catalogItemId,
    supplier: (input.supplier || '').trim(),
    quantity: input.quantity,
    unit: input.unit.trim(),
    rate: input.rate,
    totalAmount: fin.totalAmount,
    paidAmount: fin.paidAmount,
    balance: fin.balanceDue,
    extraPaid: fin.extraPaid,
    purchaseDate: input.purchaseDate,
    invoiceNumber: (input.invoiceNumber || '').trim(),
    notes: (input.notes || '').trim(),
    createdBy: user.id,
    isDeleted: false,
    createdAt: now,
    updatedAt: now,
  };

  return db.transaction('rw', db.materials, db.payments, db.activityLogs, async () => {
    await db.materials.put(record);
    if (fin.paidAmount > 0) {
      const linked = await upsertSinglePayment({
        siteId, recordId: record.id, table: 'materials', amount: fin.paidAmount, date: input.purchaseDate,
        paymentType: input.paymentMode || 'Cash',
        notes: record.invoiceNumber ? `Invoice ${record.invoiceNumber} payment` : `Payment for ${name}`,
        module: 'Material', userId: user.id,
      });
      if (!linked.ok) throw new Error(linked.error);
    }
    await log(user, site, 'MATERIAL_PURCHASE', `${input.quantity} ${record.unit} ${name} purchased (₹${fin.totalAmount})`);
    return { ok: true as const, value: record };
  }).catch((e: Error) => fail(e.message));
}

export interface MovementInput {
  itemKey?: string;
  itemName: string;
  category: string;
  unit: string;
  movementType: StockMovementType;
  quantity: number;
  eventDate: string;
  reason?: string;
  notes?: string;
}

export async function recordStockMovement(user: User, siteId: string, input: MovementInput): Promise<Result<StockMovement>> {
  const site = await writableSite(user, siteId);
  if (!site) return fail(NO_ACCESS);
  const name = input.itemName.trim();
  if (!name) return fail('Choose a material.');
  const dateError = checkEventDate(input.eventDate);
  if (dateError) return fail(dateError);
  const itemKey = input.itemKey || stockItemKey({ category: input.category, name, unit: input.unit });

  return db.transaction('rw', db.materials, db.rodEntries, db.stockMovements, db.activityLogs, async () => {
    // Balance is re-read inside the transaction so two quick entries cannot both spend the same stock.
    const [materials, rods, movements] = await Promise.all([
      db.materials.where('siteId').equals(siteId).toArray(),
      db.rodEntries.where('siteId').equals(siteId).toArray(),
      db.stockMovements.where('siteId').equals(siteId).toArray(),
    ]);
    const item = buildStock(materials, rods, movements).find(i => i.key === itemKey);
    const check = validateMovement(item?.onHand || 0, input.movementType, input.quantity);
    if (!check.ok) return fail(check.error || 'Invalid quantity.');

    const now = nowIso();
    const record: StockMovement = {
      id: newId('stk'),
      userId: site.userId || user.id,
      siteId,
      itemKey,
      itemName: item?.name || name,
      category: item?.category || input.category,
      unit: item?.unit || input.unit,
      movementType: input.movementType,
      quantity: input.quantity,
      eventDate: input.eventDate,
      reason: (input.reason || '').trim(),
      notes: (input.notes || '').trim(),
      createdBy: user.id,
      createdByName: user.fullName || user.username,
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
    };
    await db.stockMovements.put(record);
    await log(user, site, 'STOCK_MOVEMENT', `${record.movementType}: ${record.quantity} ${record.unit} ${record.itemName}`);
    return { ok: true as const, value: record };
  });
}

/** Voids a movement: it stays in the history, marked void, and no longer affects the balance. */
export async function voidStockMovement(user: User, siteId: string, movementId: string, reason: string): Promise<Result> {
  const site = await writableSite(user, siteId);
  if (!site) return fail(NO_ACCESS);
  if (!reason.trim()) return fail('Say why this entry is being cancelled.');
  return db.transaction('rw', db.materials, db.rodEntries, db.stockMovements, db.activityLogs, async () => {
    const mv = await db.stockMovements.get(movementId);
    if (!mv || mv.siteId !== siteId) return fail('Entry not found.');
    if (mv.isDeleted) return { ok: true as const, value: undefined };
    const [materials, rods, movements] = await Promise.all([
      db.materials.where('siteId').equals(siteId).toArray(),
      db.rodEntries.where('siteId').equals(siteId).toArray(),
      db.stockMovements.where('siteId').equals(siteId).toArray(),
    ]);
    const after = buildStock(materials, rods, movements.map(m => (m.id === movementId ? { ...m, isDeleted: true } : m)))
      .find(i => i.key === mv.itemKey);
    if (after && after.onHand < 0) {
      return fail('Cancelling this entry would leave stock below zero. Cancel the later usage entries first.');
    }
    const now = nowIso();
    await db.stockMovements.update(movementId, { isDeleted: true, deletedAt: now, updatedAt: now, voidReason: reason.trim() });
    await log(user, site, 'STOCK_VOID', `Cancelled stock entry for ${mv.itemName}: ${reason.trim()}`);
    return { ok: true as const, value: undefined };
  });
}

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

export interface ToolAssetInput {
  id?: string;
  name: string;
  category: string;
  totalQuantity: number;
  condition: ToolCondition;
  catalogItemId?: string;
  imageUrl?: string;
  imageCredit?: string;
  notes?: string;
}

export async function saveToolAsset(user: User, siteId: string, input: ToolAssetInput): Promise<Result<ToolAsset>> {
  const site = await writableSite(user, siteId);
  if (!site) return fail(NO_ACCESS);
  if (!input.name.trim()) return fail('Enter the tool name.');
  if (!Number.isInteger(input.totalQuantity) || input.totalQuantity < 1) return fail('Enter a whole quantity of 1 or more.');

  const now = nowIso();
  const previous = input.id ? await db.toolAssets.get(input.id) : undefined;
  if (input.id && !previous) return fail('Tool not found.');
  if (previous) {
    const issues = await db.toolIssues.where('toolAssetId').equals(previous.id).toArray();
    const min = minimumTotal(buildToolStatus(previous, issues));
    if (input.totalQuantity < min) return fail(`${min} are already issued or lost, so the total cannot be less than ${min}.`);
  }
  const record: ToolAsset = {
    ...(previous || {}),
    id: previous?.id || newId('tool'),
    userId: previous?.userId || site.userId || user.id,
    siteId,
    catalogItemId: input.catalogItemId ?? previous?.catalogItemId,
    name: input.name.trim(),
    category: input.category.trim() || 'Other',
    imageUrl: input.imageUrl ?? previous?.imageUrl,
    imageCredit: input.imageCredit ?? previous?.imageCredit,
    totalQuantity: input.totalQuantity,
    condition: input.condition,
    notes: (input.notes || '').trim(),
    createdBy: previous?.createdBy || user.id,
    isDeleted: false,
    createdAt: previous?.createdAt || now,
    updatedAt: now,
  };
  await db.toolAssets.put(record);
  await log(user, site, previous ? 'TOOL_UPDATED' : 'TOOL_ADDED', `${record.name} × ${record.totalQuantity}`);
  return { ok: true, value: record };
}

export async function issueTool(
  user: User,
  siteId: string,
  input: { toolAssetId: string; quantity: number; issuedTo: string; workerId?: string; expectedReturnDate?: string; notes?: string }
): Promise<Result<ToolIssue>> {
  const site = await writableSite(user, siteId);
  if (!site) return fail(NO_ACCESS);
  if (input.expectedReturnDate && !isDayKey(input.expectedReturnDate)) return fail('Choose a valid expected return date.');
  if (input.expectedReturnDate && input.expectedReturnDate < todayKey()) return fail('Expected return date cannot be in the past.');

  return db.transaction('rw', db.toolAssets, db.toolIssues, db.activityLogs, async () => {
    const tool = await db.toolAssets.get(input.toolAssetId);
    if (!tool || tool.isDeleted || tool.siteId !== siteId) return fail('Tool not found.');
    const issues = await db.toolIssues.where('toolAssetId').equals(tool.id).toArray();
    const check = validateIssue(buildToolStatus(tool, issues), input.quantity, input.issuedTo);
    if (!check.ok) return fail(check.error || 'Cannot issue.');
    const now = nowIso();
    const record: ToolIssue = {
      id: newId('iss'),
      userId: site.userId || user.id,
      siteId,
      toolAssetId: tool.id,
      quantity: input.quantity,
      issuedTo: input.issuedTo.trim(),
      workerId: input.workerId,
      issuedAt: now,
      expectedReturnDate: input.expectedReturnDate || undefined,
      returns: [],
      notes: (input.notes || '').trim(),
      createdBy: user.id,
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
    };
    await db.toolIssues.put(record);
    await log(user, site, 'TOOL_ISSUED', `${record.quantity} × ${tool.name} issued to ${record.issuedTo}`);
    return { ok: true as const, value: record };
  });
}

export async function returnTool(
  user: User,
  siteId: string,
  input: { issueId: string; quantity: number; condition: ToolCondition; notes?: string }
): Promise<Result<ToolIssue>> {
  const site = await writableSite(user, siteId);
  if (!site) return fail(NO_ACCESS);
  return db.transaction('rw', db.toolAssets, db.toolIssues, db.activityLogs, async () => {
    const issue = await db.toolIssues.get(input.issueId);
    if (!issue || issue.isDeleted || issue.siteId !== siteId) return fail('Issue record not found.');
    const check = validateReturn(issue, input.quantity);
    if (!check.ok) return fail(check.error || 'Cannot return.');
    const now = nowIso();
    const updated: ToolIssue = {
      ...issue,
      returns: [
        ...(issue.returns || []),
        { id: newId('ret'), quantity: input.quantity, returnedAt: now, condition: input.condition, notes: (input.notes || '').trim(), recordedBy: user.id },
      ],
      updatedAt: now,
    };
    await db.toolIssues.put(updated);
    const tool = await db.toolAssets.get(issue.toolAssetId);
    await log(user, site, 'TOOL_RETURNED', `${input.quantity} × ${tool?.name || 'tool'} returned by ${issue.issuedTo} (${input.condition})`);
    return { ok: true as const, value: updated };
  });
}

// ---------------------------------------------------------------------------
// Expenses (quick add) — routed to the existing per-category tables
// ---------------------------------------------------------------------------

export type ExpenseKind = 'tea' | 'pooja' | 'electricity' | 'water' | OtherExpenseCategory;

export const EXPENSE_KINDS: { kind: ExpenseKind; label: string }[] = [
  { kind: 'tea', label: 'Tea & Snacks' },
  { kind: 'Transport', label: 'Transport' },
  { kind: 'Fuel', label: 'Fuel' },
  { kind: 'Repair', label: 'Repair' },
  { kind: 'Equipment', label: 'Equipment Hire' },
  { kind: 'electricity', label: 'Electricity' },
  { kind: 'water', label: 'Water' },
  { kind: 'pooja', label: 'Pooja' },
  { kind: 'Miscellaneous', label: 'Miscellaneous' },
];

export interface ExpenseInput {
  kind: ExpenseKind;
  amount: number;
  date: string;
  payee?: string;
  description?: string;
  notes?: string;
  paymentMode?: string;
  /** False records the bill as unpaid (amount still owed). */
  paid: boolean;
  allowDuplicate?: boolean;
}

export async function recordExpense(user: User, siteId: string, input: ExpenseInput): Promise<Result<{ table: EntityTable; id: string }>> {
  const site = await writableSite(user, siteId);
  if (!site) return fail(NO_ACCESS);
  const amount = roundMoney(input.amount);
  const err = checkAmount(amount) || checkEventDate(input.date);
  if (err) return fail(err);

  const label = EXPENSE_KINDS.find(k => k.kind === input.kind)?.label || String(input.kind);
  const payee = (input.payee || '').trim();
  const description = (input.description || '').trim();
  const notes = (input.notes || '').trim();
  const paidAmount = input.paid ? amount : 0;
  const fin = calculateFinancialBalance(amount, paidAmount);
  const now = nowIso();
  const base = {
    userId: site.userId || user.id, siteId, payee, notes, createdBy: user.id,
    paidAmount: fin.paidAmount, balance: fin.balanceDue, extraPaid: fin.extraPaid,
    isDeleted: false, createdAt: now, updatedAt: now,
  };

  let table: EntityTable;
  let id: string;
  let put: () => Promise<unknown>;
  let isDuplicate: () => Promise<boolean>;

  if (input.kind === 'tea') {
    table = 'teaSnacksExpenses'; id = newId('tea');
    const row: TeaSnacksExpense = { ...base, id, date: input.date, teaExpense: amount, snacksExpense: 0, juiceExpense: 0, otherFoodExpense: 0, totalAmount: amount, notes: [description, notes].filter(Boolean).join(' — ') };
    put = () => db.teaSnacksExpenses.put(row);
    isDuplicate = async () => (await db.teaSnacksExpenses.where('siteId').equals(siteId).filter(r => !r.isDeleted && r.date === input.date && r.totalAmount === amount).count()) > 0;
  } else if (input.kind === 'pooja') {
    table = 'poojaExpenses'; id = newId('pooja');
    const row: PoojaExpense = { ...base, id, date: input.date, poojaName: description || 'Pooja', materialsExpense: 0, priestExpense: 0, otherExpense: amount, totalAmount: amount };
    put = () => db.poojaExpenses.put(row);
    isDuplicate = async () => (await db.poojaExpenses.where('siteId').equals(siteId).filter(r => !r.isDeleted && r.date === input.date && r.totalAmount === amount).count()) > 0;
  } else if (input.kind === 'electricity') {
    table = 'electricityBills'; id = newId('eb');
    const row: ElectricityBill & { date: string } = { ...base, id, month: input.date.slice(0, 7), date: input.date, billAmount: amount, notes: [description, notes].filter(Boolean).join(' — ') };
    put = () => db.electricityBills.put(row);
    isDuplicate = async () => (await db.electricityBills.where('siteId').equals(siteId).filter(r => !r.isDeleted && r.month === row.month && r.billAmount === amount).count()) > 0;
  } else if (input.kind === 'water') {
    table = 'waterBills'; id = newId('water');
    const row: WaterBill = { ...base, id, date: input.date, supplier: payee, billAmount: amount, notes: [description, notes].filter(Boolean).join(' — ') };
    put = () => db.waterBills.put(row);
    isDuplicate = async () => (await db.waterBills.where('siteId').equals(siteId).filter(r => !r.isDeleted && r.date === input.date && r.billAmount === amount).count()) > 0;
  } else {
    table = 'otherExpenses'; id = newId('oth');
    const category = input.kind;
    const row: OtherExpense = { ...base, id, date: input.date, category, description: description || label, amount };
    put = () => db.otherExpenses.put(row);
    isDuplicate = async () => (await db.otherExpenses.where('siteId').equals(siteId).filter(r => !r.isDeleted && r.date === input.date && r.amount === amount && r.category === category).count()) > 0;
  }

  if (!input.allowDuplicate && (await isDuplicate())) {
    return { ok: false, error: `A ${label} expense of ₹${amount} is already recorded for this date.`, duplicateOf: table };
  }

  return db.transaction('rw', db.table(table), db.payments, db.activityLogs, async () => {
    await put();
    if (fin.paidAmount > 0) {
      const linked = await upsertSinglePayment({
        siteId, recordId: id, table, amount: fin.paidAmount, date: input.date,
        paymentType: input.paymentMode || 'Cash', notes: `${label}${description ? ': ' + description : ''}${payee ? ' — ' + payee : ''}`,
        module: 'Expense', userId: user.id,
      });
      if (!linked.ok) throw new Error(linked.error);
    }
    await log(user, site, 'EXPENSE', `${label} ₹${amount}${payee ? ' to ' + payee : ''}`);
    return { ok: true as const, value: { table, id } };
  }).catch((e: Error) => fail(e.message));
}

// ---------------------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------------------

export async function saveCatalogItem(
  user: User,
  input: Pick<CatalogItem, 'kind' | 'name' | 'category'> & Partial<Pick<CatalogItem, 'id' | 'unit' | 'description' | 'imageUrl' | 'imageCredit'>>
): Promise<Result<CatalogItem>> {
  const name = input.name.trim();
  if (!name) return fail('Enter a name.');
  const now = nowIso();
  const previous = input.id ? await db.catalogItems.get(input.id) : undefined;
  const clash = await db.catalogItems
    .where('kind').equals(input.kind)
    .filter(c => !c.isDeleted && c.id !== input.id && c.category === input.category && c.name.toLowerCase() === name.toLowerCase())
    .first();
  if (clash) return fail(`"${name}" is already in the catalog.`);
  const record: CatalogItem = {
    ...(previous || {}),
    id: previous?.id || newId('cat'),
    kind: input.kind,
    name,
    category: input.category,
    unit: input.unit ?? previous?.unit,
    description: input.description ?? previous?.description,
    imageUrl: input.imageUrl ?? previous?.imageUrl,
    imageCredit: input.imageCredit ?? previous?.imageCredit,
    isBuiltIn: previous?.isBuiltIn || false,
    userId: previous?.userId || user.id,
    isDeleted: false,
    createdAt: previous?.createdAt || now,
    updatedAt: now,
  };
  await db.catalogItems.put(record);
  return { ok: true, value: record };
}

export async function removeCatalogItem(id: string): Promise<void> {
  const now = nowIso();
  // Soft delete, so a removed built-in entry is not re-seeded on the next start.
  await db.catalogItems.update(id, { isDeleted: true, deletedAt: now, updatedAt: now });
}

let catalogSeeded: Promise<void> | null = null;

/**
 * Copies built-in catalog entries into the editable table. Only missing ids are added, so
 * renamed, edited or removed entries are left exactly as the user set them.
 */
export function ensureCatalogSeeded(): Promise<void> {
  if (!catalogSeeded) {
    catalogSeeded = (async () => {
      const existing = new Map((await db.catalogItems.toArray()).map(c => [c.id, c]));
      const missing: CatalogItem[] = [];
      for (const seed of builtInCatalog()) {
        const current = existing.get(seed.id);
        if (!current) {
          missing.push(seed);
        } else if (current.isBuiltIn && !current.imageUrl && seed.imageUrl) {
          // A photo was bundled after this entry was first seeded.
          await db.catalogItems.update(seed.id, { imageUrl: seed.imageUrl, imageCredit: seed.imageCredit });
        }
      }
      if (missing.length) await db.catalogItems.bulkPut(missing);
    })().catch(err => {
      catalogSeeded = null;
      throw err;
    });
  }
  return catalogSeeded;
}