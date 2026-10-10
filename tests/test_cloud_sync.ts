/**
 * Cloud sync engine against an in-memory stand-in for the Supabase table.
 * The stand-in applies the same rule as the database trigger in
 * supabase/migrations/002_mistry_records_sync.sql: the newer copy of a record is kept.
 * (This does not exercise a real Supabase project; that needs the migration applied.)
 */
import 'fake-indexeddb/auto';
import type { RemoteRow, RemoteStore, SyncState, Tombstone } from '../src/services/cloudSync';
import type { User } from '../src/db/types';

let passed = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (!cond) throw new Error(`FAILED: ${name}${detail !== undefined ? ' — got ' + JSON.stringify(detail) : ''}`);
  passed += 1;
  console.log(`  ✓ ${name}`);
}

class FakeRemote implements RemoteStore {
  rows = new Map<string, RemoteRow>();
  clock = Date.parse('2026-10-11T00:00:00.000Z');
  pushes = 0;
  failNext = false;
  async push(rows: RemoteRow[]) {
    if (this.failNext) { this.failNext = false; throw new Error('network down'); }
    this.pushes += 1;
    for (const r of rows) {
      const key = `${r.table_name}|${r.record_id}`;
      const old = this.rows.get(key);
      if (old && Date.parse(r.client_updated_at) < Date.parse(old.client_updated_at)) continue; // keep the newer copy
      this.clock += 1000;
      this.rows.set(key, { ...JSON.parse(JSON.stringify(r)), server_updated_at: new Date(this.clock).toISOString() });
    }
  }
  async pull(since: string | null, limit: number, offset: number) {
    return Array.from(this.rows.values())
      .filter(r => !since || Date.parse(r.server_updated_at!) > Date.parse(since))
      .sort((a, b) => a.server_updated_at!.localeCompare(b.server_updated_at!))
      .slice(offset, offset + limit);
  }
}

const at = (minute: number) => new Date(Date.parse('2026-10-10T06:00:00.000Z') + minute * 60000).toISOString();
const userA: User = { id: 'local-A', username: 'velu', fullName: 'Velu', mobile: '', email: 'v@x.in', passwordHash: 'SECRET-HASH', role: 'MISTRY', isActive: true, createdAt: at(0) };
const userB: User = { ...userA, id: 'local-B-on-new-phone' };
const stranger: User = { ...userA, id: 'local-other', username: 'other', email: 'o@x.in' };
const fresh: SyncState = { lastPulledAt: null, lastPushedAt: null };

async function run() {
  const { db } = await import('../src/db/db');
  const { syncOnce, SYNC_TABLES } = await import('../src/services/cloudSync');
  await db.open();
  const remote = new FakeRemote();
  let tick = 100;
  const now = () => at(tick++);
  const wipe = async () => { for (const t of db.tables) await t.clear(); };

  const site = (id: string, userId: string, extra = {}) => ({ id, userId, name: `Site ${id}`, ownerName: 'x', ownerPhone: '', address: '', area: '', buildingType: 'House', startDate: '2026-09-01', expectedCompletionDate: '2027-01-01', status: 'Active' as const, isDeleted: false, createdAt: at(1), updatedAt: at(1), ...extra });
  const worker = (id: string, siteId: string, wage: number, updatedAt: string) => ({ id, siteId, name: `Worker ${id}`, phone: '', category: 'PERIYAAL', dailyWage: wage, joiningDate: '2026-09-01', isDeleted: false, createdAt: at(1), updatedAt });

  console.log('\n--- 1. First upload from phone A ---');
  await db.users.put(userA);
  await db.sites.bulkPut([site('s1', userA.id), site('s-other', stranger.id)]);
  await db.workers.bulkPut([worker('w1', 's1', 900, at(2)), worker('w-other', 's-other', 700, at(2))]);
  await db.attendance.put({ id: 'att-w1-2026-10-10', siteId: 's1', workerId: 'w1', date: '2026-10-10', status: 'present', dayMultiplier: 1, isDeleted: false, createdAt: at(3), updatedAt: at(3) });
  await db.floorPlans.put({ id: 'fp1', userId: userA.id, siteId: 's1', buildingName: 'House', floorName: 'Ground Floor', plotLength: 30, plotWidth: 20, unit: 'feet', walls: [{ id: 'a', x1: 0, y1: 0, x2: 30, y2: 0, thickness: 0.75, wallType: 'exterior' }], rooms: [], doors: [], windows: [], floors: [], isDeleted: false, createdAt: at(4), updatedAt: at(4) });
  await db.activityLogs.put({ id: 'act1', action: 'X', description: 'x', timestamp: at(5) });

  let a = await syncOnce(remote, userA, fresh, [], now);
  check('Own records are uploaded', a.result.pushed === 4 && remote.rows.size === 4, { pushed: a.result.pushed, keys: [...remote.rows.keys()] });
  check('Another contractor\'s site and workers are not uploaded', ![...remote.rows.keys()].some(k => k.includes('other')));
  check('User accounts, logs and password hashes are never uploaded', !SYNC_TABLES.includes('users') && !SYNC_TABLES.includes('activityLogs') && !SYNC_TABLES.includes('otpSessions') && !JSON.stringify([...remote.rows.values()]).includes('SECRET-HASH'));
  check('The floor plan is stored whole, as JSON', (remote.rows.get('floorPlans|fp1')!.data as any).walls[0].x2 === 30);
  check('Rows carry their project id', remote.rows.get('workers|w1')!.site_id === 's1' && remote.rows.get('sites|s1')!.site_id === 's1');

  console.log('\n--- 2. Nothing to do means no writes ---');
  const pushesBefore = remote.pushes;
  const idle = await syncOnce(remote, userA, a.state, [], now);
  check('A second sync sends and receives nothing', idle.result.pushed === 0 && idle.result.pulled === 0 && remote.pushes === pushesBefore, idle.result);

  console.log('\n--- 3. Restore on a new phone ---');
  await wipe();
  const b = await syncOnce(remote, userB, fresh, [], now);
  check('Everything comes back', b.result.pulled === 4 && (await db.workers.count()) === 1 && (await db.attendance.count()) === 1 && (await db.floorPlans.count()) === 1, b.result);
  check('The project belongs to the person signed in on this phone', (await db.sites.get('s1'))!.userId === userB.id && (await db.floorPlans.get('fp1'))!.userId === userB.id);
  check('Floor plan geometry is identical', (await db.floorPlans.get('fp1'))!.walls[0].x2 === 30);
  check('What was just downloaded is not sent straight back', b.result.pushed === 0, b.result);

  console.log('\n--- 4. Newer copy wins, in both directions ---');
  // Phone B edits the wage at minute 30 and syncs.
  await db.workers.put(worker('w1', 's1', 1000, now()));
  let bState = (await syncOnce(remote, userB, b.state, [], now)).state;
  check('A local edit reaches the cloud', (remote.rows.get('workers|w1')!.data as any).dailyWage === 1000);

  // Phone A (still holding the old copy edited at minute 20) syncs with a stale push.
  await wipe();
  await db.sites.put(site('s1', userA.id));
  await db.workers.put(worker('w1', 's1', 950, at(20)));
  a = await syncOnce(remote, userA, fresh, [], now);
  check('An older copy does not overwrite the newer one in the cloud', (remote.rows.get('workers|w1')!.data as any).dailyWage === 1000);
  check('The older phone receives the newer copy', (await db.workers.get('w1'))!.dailyWage === 1000);

  // Phone A now makes the newest edit.
  await db.workers.put(worker('w1', 's1', 1100, now()));
  a = await syncOnce(remote, userA, a.state, [], now);
  check('The newest edit wins', (remote.rows.get('workers|w1')!.data as any).dailyWage === 1100);

  console.log('\n--- 5. Deletes travel too ---');
  { const d = now(); await db.workers.update('w1', { isDeleted: true, deletedAt: d, updatedAt: d }); }
  a = await syncOnce(remote, userA, a.state, [], now);
  check('A Recycle Bin delete is marked in the cloud', remote.rows.get('workers|w1')!.is_deleted === true);

  await db.attendance.put({ id: 'att-x', siteId: 's1', workerId: 'w1', date: '2026-10-09', status: 'absent', dayMultiplier: 0, isDeleted: false, createdAt: now(), updatedAt: now() });
  a = await syncOnce(remote, userA, a.state, [], now);
  await db.attendance.delete('att-x');
  const tomb: Tombstone[] = [{ table: 'attendance', id: 'att-x', at: now() }, { table: 'users', id: 'never', at: now() }];
  a = await syncOnce(remote, userA, a.state, tomb, now);
  check('A permanent delete is sent as a purge', (remote.rows.get('attendance|att-x')!.data as any).purged === true && a.sentTombstones.length === 1);
  check('A purge for a table that is not synced is ignored', !remote.rows.has('users|never'));

  // Another phone that still has the record drops it on its next sync.
  await wipe();
  await db.sites.put(site('s1', userB.id));
  await db.attendance.put({ id: 'att-x', siteId: 's1', workerId: 'w1', date: '2026-10-09', status: 'absent', dayMultiplier: 0, isDeleted: false, createdAt: at(51), updatedAt: at(51) });
  const afterPurge = await syncOnce(remote, userB, bState, [], now);
  check('The other phone removes the purged record and does not re-upload it', (await db.attendance.get('att-x')) === undefined && afterPurge.result.removed === 1 && (remote.rows.get('attendance|att-x')!.data as any).purged === true);
  check('The soft-deleted worker arrives as deleted', (await db.workers.get('w1'))!.isDeleted === true);

  console.log('\n--- 6. A failed sync loses nothing ---');
  await db.workers.put(worker('w2', 's1', 800, now()));
  remote.failNext = true;
  let failed = '';
  try { await syncOnce(remote, userB, afterPurge.state, [], now); } catch (e) { failed = (e as Error).message; }
  check('The failure is reported', failed === 'network down');
  check('Nothing reached the cloud', !remote.rows.has('workers|w2'));
  const retry = await syncOnce(remote, userB, afterPurge.state, [], now);
  check('Retrying from the last good state sends the change', remote.rows.has('workers|w2') && retry.result.pushed >= 1);
  check('The local record was untouched by the failure', (await db.workers.get('w2'))!.dailyWage === 800);

  console.log('\n--- 7. Device clock moved backwards ---');
  // The phone's clock is set back to before the last push. An edit made now carries an
  // "old" time; it must still be uploaded.
  const early = () => at(5);
  await db.workers.put(worker('w3', 's1', 650, at(6)));
  const back = await syncOnce(remote, userB, retry.state, [], early);
  check('An edit made after the clock was set back is still uploaded', remote.rows.has('workers|w3'), back.result);
  check('Sending everything again did not replace newer cloud copies', (remote.rows.get('workers|w2')!.data as any).dailyWage === 800);

  console.log(`\n✅ Cloud sync engine: all ${passed} checks passed.`);
}

run().catch(err => {
  console.error('\n❌', err.message);
  process.exit(1);
});
