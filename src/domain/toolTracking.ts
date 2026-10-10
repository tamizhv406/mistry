/**
 * Tool issue / return tracking.
 *
 *   outstanding (per issue) = issued quantity − Σ returned quantity
 *   issued (per tool)       = Σ outstanding over its open issues
 *   available               = total quantity − issued − lost
 *
 * A return records the quantity, time and condition. Tools returned as "Lost" come off the
 * usable total; "Damaged" / "Needs Repair" stay counted but are flagged.
 */
import type { ToolAsset, ToolIssue, ToolCondition } from '../db/types';

export const TOOL_CONDITIONS: ToolCondition[] = ['Good', 'Needs Repair', 'Damaged', 'Lost'];

export function returnedQuantity(issue: Pick<ToolIssue, 'returns'>): number {
  return (issue.returns || []).reduce((s, r) => s + (Number(r.quantity) || 0), 0);
}

export function outstandingQuantity(issue: Pick<ToolIssue, 'quantity' | 'returns'>): number {
  return Math.max(0, (Number(issue.quantity) || 0) - returnedQuantity(issue));
}

export function isIssueOpen(issue: ToolIssue): boolean {
  return !issue.isDeleted && outstandingQuantity(issue) > 0;
}

export function isOverdue(issue: ToolIssue, todayKey: string): boolean {
  return isIssueOpen(issue) && !!issue.expectedReturnDate && issue.expectedReturnDate < todayKey;
}

export interface ToolStatus {
  toolId: string;
  total: number;
  issued: number;
  lost: number;
  needsAttention: number;   // returned damaged / needing repair
  available: number;
  openIssues: ToolIssue[];  // newest first
  history: ToolIssue[];     // every issue, newest first
}

export function buildToolStatus(tool: ToolAsset, issues: ToolIssue[]): ToolStatus {
  const mine = issues
    .filter(i => i.toolAssetId === tool.id && !i.isDeleted)
    .sort((a, b) => (b.issuedAt || '').localeCompare(a.issuedAt || ''));

  let issued = 0;
  let lost = 0;
  let needsAttention = 0;
  for (const i of mine) {
    issued += outstandingQuantity(i);
    for (const r of i.returns || []) {
      if (r.condition === 'Lost') lost += Number(r.quantity) || 0;
      else if (r.condition === 'Damaged' || r.condition === 'Needs Repair') needsAttention += Number(r.quantity) || 0;
    }
  }
  const total = Math.max(0, Number(tool.totalQuantity) || 0);
  return {
    toolId: tool.id,
    total,
    issued,
    lost,
    needsAttention,
    available: Math.max(0, total - issued - lost),
    openIssues: mine.filter(isIssueOpen),
    history: mine,
  };
}

export interface ToolCheck {
  ok: boolean;
  error?: string;
}

export function validateIssue(status: ToolStatus, quantity: number, issuedTo: string): ToolCheck {
  if (!issuedTo.trim()) return { ok: false, error: 'Enter who is receiving the tool.' };
  if (!Number.isInteger(quantity) || quantity <= 0) return { ok: false, error: 'Enter a whole quantity of 1 or more.' };
  if (quantity > status.available) {
    return { ok: false, error: `Only ${status.available} available to issue right now.` };
  }
  return { ok: true };
}

export function validateReturn(issue: ToolIssue, quantity: number): ToolCheck {
  const out = outstandingQuantity(issue);
  if (!Number.isInteger(quantity) || quantity <= 0) return { ok: false, error: 'Enter a whole quantity of 1 or more.' };
  if (quantity > out) return { ok: false, error: `Only ${out} still out with ${issue.issuedTo}.` };
  return { ok: true };
}

/** Lowest total a tool can be reduced to without contradicting what is already issued or lost. */
export function minimumTotal(status: ToolStatus): number {
  return status.issued + status.lost;
}
