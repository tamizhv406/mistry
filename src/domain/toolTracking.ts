/**
 * Tool issue / return tracking.
 *
 *   outstanding (per issue) = issued quantity − Σ returned quantity
 *   issued (per tool)       = Σ outstanding over its open issues
 *   available               = total quantity − issued − lost − damaged
 *
 * A return records the quantity, day, time and condition. Tools returned as "Lost" come off the
 * usable total. Tools returned "Damaged" / "Needs Repair" are kept aside (the tool's
 * `damagedQuantity`) and can not be issued until they are marked repaired. A whole tool marked
 * Damaged / Needs Repair can not be issued at all.
 */
import type { ToolAsset, ToolIssue, ToolCondition } from '../db/types';
import { dayKeyOf, formatDay, isDayKey } from '../utils/datetime';

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

/** Past the return date the person who issued it set. */
export function isOverdue(issue: ToolIssue, todayKey: string): boolean {
  return isIssueOpen(issue) && !!issue.expectedReturnDate && issue.expectedReturnDate < todayKey;
}

/** The calendar day (site time zone) a tool went out. */
export function issueDay(issue: Pick<ToolIssue, 'issuedAt'>): string {
  return issue.issuedAt ? dayKeyOf(issue.issuedAt) : '';
}

/**
 * Late: still out after the day it was taken. Tools go back to the store at the end of the day,
 * so anything issued before today and not returned is late. When a return date was agreed, the
 * tool is late only after that date.
 */
export function isLate(issue: ToolIssue, todayKey: string): boolean {
  if (!isIssueOpen(issue)) return false;
  if (issue.expectedReturnDate) return issue.expectedReturnDate < todayKey;
  const day = issueDay(issue);
  return !!day && day < todayKey;
}

/** Whole days a tool has been out (0 on the day it was issued). */
export function daysOut(issue: ToolIssue, todayKey: string): number {
  const day = issueDay(issue);
  if (!day) return 0;
  return Math.max(0, Math.round((Date.parse(`${todayKey}T00:00:00Z`) - Date.parse(`${day}T00:00:00Z`)) / 86_400_000));
}

export interface ToolHolder {
  issue: ToolIssue;
  name: string;
  quantity: number;
  late: boolean;
}

export interface ToolStatus {
  toolId: string;
  total: number;
  issued: number;
  lost: number;
  /** Returned damaged / needing repair and not yet repaired: kept aside, not issuable. */
  damaged: number;
  /** Ever returned damaged / needing repair (history). */
  needsAttention: number;
  available: number;
  /** The whole tool is marked Damaged / Needs Repair. */
  unusable: boolean;
  openIssues: ToolIssue[];  // newest first
  holders: ToolHolder[];    // who has it now, longest out first
  late: boolean;            // any holder is late
  history: ToolIssue[];     // every issue, newest first
}

export function buildToolStatus(tool: ToolAsset, issues: ToolIssue[], todayKey = ''): ToolStatus {
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
  const damaged = Math.min(Math.max(0, Math.floor(Number(tool.damagedQuantity) || 0)), Math.max(0, total - issued - lost));
  const openIssues = mine.filter(isIssueOpen);
  const holders = [...openIssues]
    .sort((a, b) => (a.issuedAt || '').localeCompare(b.issuedAt || ''))
    .map(issue => ({ issue, name: issue.issuedTo, quantity: outstandingQuantity(issue), late: todayKey ? isLate(issue, todayKey) : false }));
  return {
    toolId: tool.id,
    total,
    issued,
    lost,
    damaged,
    needsAttention,
    available: Math.max(0, total - issued - lost - damaged),
    unusable: tool.condition === 'Damaged' || tool.condition === 'Needs Repair',
    openIssues,
    holders,
    late: holders.some(h => h.late),
    history: mine,
  };
}

/** What the list shows for a tool, and which one action its button offers. */
export type ToolState = 'out' | 'available' | 'damaged';

export function toolState(status: ToolStatus): ToolState {
  if (status.issued > 0) return 'out';
  if (!status.unusable && status.available > 0) return 'available';
  return 'damaged';
}

/** The row button: issue when one can be given out, otherwise return the one that is out. */
export function toolAction(status: ToolStatus): 'issue' | 'return' | 'none' {
  if (!status.unusable && status.available > 0) return 'issue';
  if (status.issued > 0) return 'return';
  return 'none';
}

export const TOOL_FILTERS = ['all', 'out', 'available', 'damaged'] as const;
export type ToolFilter = typeof TOOL_FILTERS[number];

export function matchesToolFilter(status: ToolStatus, filter: ToolFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'out') return status.issued > 0;
  if (filter === 'available') return !status.unusable && status.available > 0;
  return status.unusable || status.damaged > 0;
}

/** Search by tool name, category, or who has it ("Murugan" finds what Murugan is holding). */
export function toolMatches(tool: Pick<ToolAsset, 'name' | 'category'>, status: Pick<ToolStatus, 'holders'>, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return tool.name.toLowerCase().includes(q) || tool.category.toLowerCase().includes(q) || status.holders.some(h => h.name.toLowerCase().includes(q));
}

export interface ToolCheck {
  ok: boolean;
  error?: string;
}

export function validateIssue(status: ToolStatus, quantity: number, issuedTo: string, tool?: Pick<ToolAsset, 'name' | 'condition'>): ToolCheck {
  if (!issuedTo.trim()) return { ok: false, error: 'Enter who is receiving the tool.' };
  if (!Number.isInteger(quantity) || quantity <= 0) return { ok: false, error: 'Enter a whole quantity of 1 or more.' };
  if (status.unusable) {
    return { ok: false, error: `${tool?.name || 'This tool'} is marked ${tool?.condition || 'damaged'}. Mark it Good once repaired, then issue it.` };
  }
  if (quantity > status.available) {
    if (status.available === 0 && status.issued > 0) {
      const who = status.holders.map(h => h.name).join(', ');
      return { ok: false, error: `Already issued to ${who}. Record the return before issuing it again.` };
    }
    if (status.available === 0 && status.damaged > 0) {
      return { ok: false, error: `None can be issued: ${status.damaged} returned damaged. Mark them repaired first.` };
    }
    return { ok: false, error: `Only ${status.available} available to issue right now.` };
  }
  return { ok: true };
}

export function validateReturn(issue: ToolIssue, quantity: number): ToolCheck {
  const out = outstandingQuantity(issue);
  if (out === 0) return { ok: false, error: 'This tool has already been returned.' };
  if (!Number.isInteger(quantity) || quantity <= 0) return { ok: false, error: 'Enter a whole quantity of 1 or more.' };
  if (quantity > out) return { ok: false, error: `Only ${out} still out with ${issue.issuedTo}.` };
  return { ok: true };
}

/** The day a tool was issued or returned: not in the future; a return not before its issue. */
export function checkToolDay(day: string, todayKey: string, notBefore?: string): string | null {
  if (!isDayKey(day)) return 'Choose a valid date.';
  if (day > todayKey) return 'The date cannot be in the future.';
  if (notBefore && day < notBefore) return `The return date cannot be before the issue date (${formatDay(notBefore)}).`;
  return null;
}

/**
 * The timestamp saved for an entry dated `day`: the actual time when it is today, otherwise
 * midday of that day in India (so it sorts and displays on the right day everywhere).
 */
export function timestampForDay(day: string, todayKey: string, now: string): string {
  return day === todayKey ? now : `${day}T06:30:00.000Z`;
}

/** Lowest total a tool can be reduced to without contradicting what is already issued, lost or kept aside. */
export function minimumTotal(status: ToolStatus): number {
  return status.issued + status.lost + status.damaged;
}
