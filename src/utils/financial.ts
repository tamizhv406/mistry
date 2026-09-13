import { db } from '../db/db';
import type { PaymentTransaction, EntityTable } from '../db/types';

export interface FinancialBalanceResult {
  totalAmount: number;
  paidAmount: number;
  balanceDue: number;
  extraPaid: number;
  status: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'EXTRA_PAID';
}

/**
 * Universal Financial Calculation Engine
 * 
 * Rules:
 * Default: Paid Amount = 0
 * If Paid < Total:
 *   Balance Due = Total - Paid
 *   Extra Paid = 0
 * If Paid = Total:
 *   Balance Due = 0
 *   Extra Paid = 0
 * If Paid > Total:
 *   Balance Due = 0
 *   Extra Paid = Paid - Total
 * 
 * Never show negative balances (e.g. -₹1,000)!
 */
export function calculateFinancialBalance(total: number, paid: number): FinancialBalanceResult {
  const numTotal = Math.max(0, Math.round(Number(total) || 0));
  const numPaid = Math.max(0, Math.round(Number(paid) || 0));

  let balanceDue = 0;
  let extraPaid = 0;
  let status: FinancialBalanceResult['status'] = 'UNPAID';

  if (numPaid === 0 && numTotal > 0) {
    balanceDue = numTotal;
    extraPaid = 0;
    status = 'UNPAID';
  } else if (numPaid < numTotal) {
    balanceDue = numTotal - numPaid;
    extraPaid = 0;
    status = 'PARTIALLY_PAID';
  } else if (numPaid === numTotal) {
    balanceDue = 0;
    extraPaid = 0;
    status = 'PAID';
  } else {
    // numPaid > numTotal
    balanceDue = 0;
    extraPaid = numPaid - numTotal;
    status = 'EXTRA_PAID';
  }

  return {
    totalAmount: numTotal,
    paidAmount: numPaid,
    balanceDue,
    extraPaid,
    status,
  };
}

/**
 * Generates a unique, readable Payment Transaction ID
 * e.g. "PAY-1712345678-ABCD"
 */
export function generatePaymentId(): string {
  const ts = Date.now();
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `PAY-${ts}-${rand}`;
}

const ENTITY_TABLES: EntityTable[] = [
  'materials',
  'rodEntries',
  'tools',
  'labourAdvances',
  'salaryPayments',
  'teaSnacksExpenses',
  'poojaExpenses',
  'electricityBills',
  'waterBills',
  'otherExpenses',
];

/**
 * Records an individual payment transaction into the payments ledger
 * and synchronizes the parent entity's paidAmount, balance, and extraPaid.
 */
export async function recordPaymentTransaction(params: {
  siteId: string;
  relatedRecordId: string;
  tableName?: EntityTable;
  amount: number;
  paymentType?: string;
  date?: string;
  notes?: string;
  module?: string;
  userId?: string;
}): Promise<PaymentTransaction> {
  const now = new Date().toISOString();
  const paymentId = generatePaymentId();
  const numAmount = Math.max(0, Math.round(Number(params.amount) || 0));

  const payment: PaymentTransaction = {
    id: paymentId,
    userId: params.userId,
    siteId: params.siteId,
    relatedRecordId: params.relatedRecordId,
    module: params.module,
    date: params.date || now.slice(0, 10),
    amount: numAmount,
    paymentType: params.paymentType || 'Cash',
    notes: params.notes?.trim() || '',
    isDeleted: false,
    createdAt: now,
    updatedAt: now,
  };

  await db.payments.put(payment);

  // Synchronize parent record finances (auto-detect table if not provided)
  if (params.tableName && params.tableName !== 'payments') {
    await syncParentRecordFinances(params.tableName, params.relatedRecordId);
  } else {
    await syncParentRecordFinances(params.relatedRecordId);
  }

  return payment;
}

/**
 * Re-computes paidAmount, balance, and extraPaid for a parent record based on all active payments.
 * Supports both:
 *   syncParentRecordFinances(recordId) -> auto-discovers table
 *   syncParentRecordFinances(tableName, recordId)
 */
export async function syncParentRecordFinances(
  arg1: EntityTable | string,
  arg2?: string
): Promise<void> {
  let tableName: EntityTable | undefined;
  let recordId: string;

  if (arg2) {
    tableName = arg1 as EntityTable;
    recordId = arg2;
  } else {
    recordId = arg1;
    // Auto-detect which table contains this recordId
    for (const t of ENTITY_TABLES) {
      const exists = await db.table(t).get(recordId);
      if (exists) {
        tableName = t;
        break;
      }
    }
  }

  if (!tableName) return;

  const table = db.table(tableName);
  const record: any = await table.get(recordId);
  if (!record) return;

  // Retrieve all non-deleted payments for this record
  const payments = await db.payments
    .where('relatedRecordId')
    .equals(recordId)
    .filter(p => !p.isDeleted)
    .toArray();

  const totalPaid = payments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);

  // Determine total cost / amount field name on the record
  let totalCost = 0;
  if ('totalAmount' in record) totalCost = Number(record.totalAmount) || 0;
  else if ('cost' in record) totalCost = Number(record.cost) || 0;
  else if ('billAmount' in record) totalCost = Number(record.billAmount) || 0;
  else if ('amount' in record) totalCost = Number(record.amount) || 0;
  else if ('grossSalary' in record) totalCost = Number(record.grossSalary) || 0;

  const result = calculateFinancialBalance(totalCost, totalPaid);

  await table.update(recordId, {
    paidAmount: result.paidAmount,
    balance: result.balanceDue,
    extraPaid: result.extraPaid,
    updatedAt: new Date().toISOString(),
  });
}
