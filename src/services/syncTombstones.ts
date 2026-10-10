/**
 * Permanent deletes that still have to reach the cloud copy.
 * Kept in its own small module (no database import) so the database layer can record a
 * delete without depending on the sync engine.
 */

/** Records that belong to a project (found through their siteId). */
export const SITE_TABLES = [
  'materials', 'rodEntries', 'workers', 'attendance', 'labourAdvances', 'salaryPayments', 'tools', 'teaSnacksExpenses',
  'poojaExpenses', 'electricityBills', 'waterBills', 'siteComments', 'otherExpenses', 'payments', 'stockMovements',
  'toolAssets', 'toolIssues',
] as const;
/** Records that belong to the user directly (found through their userId). */
export const USER_TABLES = ['sites', 'floorPlans', 'estimates', 'materialPrices', 'catalogItems'] as const;

export const SYNC_TABLES: readonly string[] = [...USER_TABLES, ...SITE_TABLES];

export interface Tombstone {
  table: string;
  id: string;
  at: string;
}

const TOMBSTONE_KEY = 'mistry_sync_tombstones';
const hasStorage = () => typeof localStorage !== 'undefined';

export function readTombstones(): Tombstone[] {
  if (!hasStorage()) return [];
  try {
    const list = JSON.parse(localStorage.getItem(TOMBSTONE_KEY) || '[]');
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

/** Remembers a permanent delete so the cloud copy (and other devices) drop the record too. */
export function recordTombstone(table: string, id: string): void {
  if (!hasStorage() || !SYNC_TABLES.includes(table)) return;
  try {
    const list = readTombstones().filter(t => !(t.table === table && t.id === id));
    list.push({ table, id, at: new Date().toISOString() });
    localStorage.setItem(TOMBSTONE_KEY, JSON.stringify(list.slice(-2000)));
  } catch { /* storage full or unavailable: the delete still happened locally */ }
}

export function forgetTombstones(sent: Tombstone[]): void {
  if (!hasStorage() || sent.length === 0) return;
  const done = new Set(sent.map(t => `${t.table}|${t.id}|${t.at}`));
  try {
    localStorage.setItem(TOMBSTONE_KEY, JSON.stringify(readTombstones().filter(t => !done.has(`${t.table}|${t.id}|${t.at}`))));
  } catch { /* ignore */ }
}
