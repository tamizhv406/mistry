/**
 * Deleting a user's own account and everything they recorded (Google Play requires that an
 * app which lets people create an account also lets them delete it).
 */
import { db } from '../db/db';
import type { User } from '../db/types';
import { isSuperAdmin, setCurrentUser } from './auth';
import { SITE_TABLES, recordTombstone } from './syncTombstones';

export type DeleteAccountResult = { ok: true; records: number } | { ok: false; error: string };

/**
 * Permanently removes the user's projects and every record under them, their floor plans,
 * estimates and custom catalog entries, and the account itself, from this device.
 * Each removed record is also queued so its cloud copy is erased on the next sync.
 * This can not be undone; the caller must have confirmed with the user.
 */
export async function deleteAccountAndData(user: User): Promise<DeleteAccountResult> {
  if (isSuperAdmin(user)) {
    return { ok: false, error: 'The main administrator account can not be deleted from inside the app.' };
  }
  const stored = await db.users.get(user.id);
  if (!stored) return { ok: false, error: 'Account not found on this device.' };

  const siteIds = new Set((await db.sites.toArray()).filter(s => s.userId === user.id).map(s => s.id));
  let records = 0;
  const purged: [string, string][] = [];

  await db.transaction('rw', db.tables, async () => {
    for (const name of SITE_TABLES) {
      const table = db.table(name);
      const ids = (await table.toArray()).filter((r: any) => siteIds.has(r.siteId)).map((r: any) => r.id as string);
      await table.bulkDelete(ids);
      ids.forEach(id => purged.push([name, id]));
      records += ids.length;
    }
    for (const name of ['floorPlans', 'estimates', 'materialPrices', 'catalogItems'] as const) {
      const table = db.table(name);
      const ids = (await table.toArray())
        .filter((r: any) => r.userId === user.id && !(name === 'catalogItems' && r.isBuiltIn))
        .map((r: any) => r.id as string);
      await table.bulkDelete(ids);
      ids.forEach(id => purged.push([name, id]));
      records += ids.length;
    }
    await db.sites.bulkDelete([...siteIds]);
    siteIds.forEach(id => purged.push(['sites', id]));
    records += siteIds.size;

    const logIds = (await db.activityLogs.toArray()).filter(l => l.userId === user.id || (l.siteId && siteIds.has(l.siteId))).map(l => l.id);
    await db.activityLogs.bulkDelete(logIds);
    await db.users.delete(user.id);
  });

  purged.forEach(([table, id]) => recordTombstone(table, id, user.id));
  setCurrentUser(null);
  return { ok: true, records };
}
