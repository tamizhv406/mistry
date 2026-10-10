/**
 * Date and time helpers.
 *
 * Storage rules:
 *  - Creation / edit timestamps are full ISO-8601 UTC instants (`new Date().toISOString()`).
 *  - Event dates (attendance day, purchase date, payment date) are calendar days stored as
 *    `YYYY-MM-DD` strings. A calendar day has no timezone, so it never shifts when the
 *    device clock or timezone changes.
 *
 * Display rule: everything is shown in the site timezone, Asia/Kolkata by default.
 */

export const DEFAULT_TIME_ZONE = 'Asia/Kolkata';

const dayPartsCache = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  let f = dayPartsCache.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    dayPartsCache.set(timeZone, f);
  }
  return f;
}

/** Calendar day (`YYYY-MM-DD`) of an instant, as seen in the given timezone. */
export function dayKeyOf(instant: Date | string | number, timeZone: string = DEFAULT_TIME_ZONE): string {
  const d = instant instanceof Date ? instant : new Date(instant);
  const parts = partsFormatter(timeZone).formatToParts(d);
  const get = (t: string) => parts.find(p => p.type === t)?.value || '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** Today's calendar day in the site timezone. Use this instead of `toISOString().slice(0, 10)`. */
export function todayKey(timeZone: string = DEFAULT_TIME_ZONE, now: Date = new Date()): string {
  return dayKeyOf(now, timeZone);
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function isDayKey(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** Parses a day key as UTC noon so formatting it in any Indian/nearby zone keeps the same day. */
function dayKeyToDate(dayKey: string): Date {
  const [y, m, d] = dayKey.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
}

export function addDays(dayKey: string, days: number): string {
  const dt = dayKeyToDate(dayKey);
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export function monthKeyOf(dayKey: string): string {
  return dayKey.slice(0, 7);
}

export function addMonths(monthKey: string, months: number): string {
  const [y, m] = monthKey.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1 + months, 1));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function daysInMonth(monthKey: string): number {
  const [y, m] = monthKey.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** 0 = Sunday … 6 = Saturday for the first day of the month. */
export function firstWeekdayOfMonth(monthKey: string): number {
  const [y, m] = monthKey.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
}

export function monthDayKeys(monthKey: string): string[] {
  const n = daysInMonth(monthKey);
  return Array.from({ length: n }, (_, i) => `${monthKey}-${String(i + 1).padStart(2, '0')}`);
}

/** "11 Oct 2026" */
export function formatDay(dayKey: string | undefined | null): string {
  if (!dayKey) return '—';
  const key = dayKey.slice(0, 10);
  if (!isDayKey(key)) return dayKey;
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(dayKeyToDate(key));
}

/** "Sun, 11 Oct" */
export function formatDayShort(dayKey: string): string {
  if (!isDayKey(dayKey)) return dayKey;
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'UTC',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(dayKeyToDate(dayKey));
}

/** "Sunday, 11 October 2026" */
export function formatDayLong(dayKey: string): string {
  if (!isDayKey(dayKey)) return dayKey;
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'UTC',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(dayKeyToDate(dayKey));
}

/** "October 2026" */
export function formatMonth(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number);
  if (!y || !m) return monthKey;
  return new Intl.DateTimeFormat('en-IN', { timeZone: 'UTC', month: 'long', year: 'numeric' }).format(
    new Date(Date.UTC(y, m - 1, 1, 12))
  );
}

/** "11 Oct 2026, 2:35 pm" in the site timezone. */
export function formatDateTime(instant: string | number | Date | undefined | null, timeZone: string = DEFAULT_TIME_ZONE): string {
  if (instant === undefined || instant === null || instant === '') return '—';
  const d = instant instanceof Date ? instant : new Date(instant);
  if (Number.isNaN(d.getTime())) return String(instant);
  return new Intl.DateTimeFormat('en-IN', {
    timeZone,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(d);
}

/** "2:35 pm" in the site timezone. */
export function formatTime(instant: string | number | Date, timeZone: string = DEFAULT_TIME_ZONE): string {
  const d = instant instanceof Date ? instant : new Date(instant);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-IN', { timeZone, hour: 'numeric', minute: '2-digit', hour12: true }).format(d);
}

/** Inclusive range check on day keys; empty bounds are open. */
export function inDayRange(dayKey: string | undefined, from?: string, to?: string): boolean {
  if (!dayKey) return false;
  const k = dayKey.slice(0, 10);
  if (from && k < from) return false;
  if (to && k > to) return false;
  return true;
}
