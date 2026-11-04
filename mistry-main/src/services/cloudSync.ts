/**
 * Cloud copy of the app's records in Supabase (table `mistry_records`, see
 * supabase/migrations/002_mistry_records_sync.sql).
 *
 * The phone's own database stays the working copy: the app keeps working offline, and
 * nothing here blocks or replaces a local save. Sync is "pull, then push":
 *   - pull: rows changed on the server since the last pull are written locally when they
 *           are newer than the local copy;
 *   - push: local records changed since the last push are sent up. The server keeps the
 *           newer copy of each record, so an old phone can not overwrite newer work.
 *
 * Conflict rule: per record, the copy with the later `updatedAt` wins (device clocks).
 * Never uploaded: user accounts and password hashes, OTP sessions, audit and activity logs.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { db } from '../db/db';
import { userCanAccessRecord, type User } from '../db/types';
import { SYNC_TABLES, USER_TABLES, forgetTombstones, readTombstones, type Tombstone } from './syncTombstones';

export { SYNC_TABLES, readTombstones, recordTombstone } from './syncTombstones';
export type { Tombstone } from './syncTombstones';

export interface RemoteRow {
  owner_id: string;
  table_name: string;
  record_id: string;
  site_id: string | null;
  data: Record<string, unknown>;
  is_deleted: boolean;
  client_updated_at: string;
  server_updated_at?: string;
}

/** The only two things sync needs from a server. Lets the engine be tested without a network. */
export interface RemoteStore {
  /** Insert or update. The server must keep the copy with the later client_updated_at. */
  push(rows: RemoteRow[]): Promise<void>;
  /** Rows with server_updated_at later than `since` (all rows when null), oldest first. */
  pull(since: string | null, limit: number, offset: number): Promise<RemoteRow[]>;
}

export interface SyncState {
  lastPulledAt: string | null;
  lastPushedAt: string | null;
}

export interface SyncResult {
  pushed: number;
  pulled: number;
  removed: number;
  finishedAt: string;
}

const PAGE = 500;
const CHUNK = 200;
const stampOf = (row: any): string => row?.updatedAt || row?.createdAt || '';
const time = (iso: string | undefined | null): number => {
  const t = iso ? Date.parse(iso) : NaN;
  return Number.isNaN(t) ? 0 : t;
};

function ownerForRecord(table: string, row: any, siteOwners: Map<string, string>): string | undefined {
  if ((USER_TABLES as readonly string[]).includes(table)) return row.userId;
  return row.siteId ? siteOwners.get(row.siteId) : undefined;
}

/**
 * One sync pass. Pure with respect to its inputs: the caller stores the returned state and
 * clears the returned tombstones only when this resolves. If anything throws, nothing is
 * marked as synced, so the next pass sends the same changes again.
 */
export async function syncOnce(
  remote: RemoteStore,
  user: User,
  state: SyncState,
  tombstones: Tombstone[] = [],
  now: () => string = () => new Date().toISOString()
): Promise<{ result: SyncResult; state: SyncState; sentTombstones: Tombstone[] }> {
  const startedAt = now();
  const justPulled = new Set<string>();
  let pulled = 0;
  let removed = 0;
  let newestServer = state.lastPulledAt;

  // ---- Pull -------------------------------------------------------------
  for (let offset = 0; ; offset += PAGE) {
    const rows = await remote.pull(state.lastPulledAt, PAGE, offset);
    for (const row of rows) {
      if (row.server_updated_at && time(row.server_updated_at) > time(newestServer)) newestServer = row.server_updated_at;
      if (!SYNC_TABLES.includes(row.table_name)) continue;
      const table = db.table(row.table_name);
      const local = await table.get(row.record_id);

      if (row.data && (row.data as any).purged === true) {
        // Permanently deleted on another device.
        if (local) { await table.delete(row.record_id); removed += 1; }
        justPulled.add(`${row.table_name}|${row.record_id}`);
        continue;
      }
      if (local && time(stampOf(local)) >= time(row.client_updated_at)) continue; // local copy is as new or newer

      const incoming: any = { ...row.data, id: row.record_id };
      if (row.owner_id && ('userId' in incoming || (USER_TABLES as readonly string[]).includes(row.table_name))) {
        incoming.userId = row.owner_id;
      }
      await table.put(incoming);
      justPulled.add(`${row.table_name}|${row.record_id}`);
      pulled += 1;
    }
    if (rows.length < PAGE) break;
  }

  // ---- Push -------------------------------------------------------------
  const sites = await db.sites.toArray();
  const siteOwners = new Map(sites.map(site => [site.id, site.userId]));
  // If this device's clock is now behind the last push time (clock was changed), a time
  // comparison could skip real edits. In that case everything owned is sent again; the server
  // keeps the newer copy of each record, so this is safe.
  const clockWentBack = !!state.lastPushedAt && time(startedAt) < time(state.lastPushedAt);
  const since = clockWentBack ? 0 : time(state.lastPushedAt);
  const outgoing: RemoteRow[] = [];

  for (const name of SYNC_TABLES) {
    const rows: any[] = await db.table(name).toArray();
    for (const row of rows) {
      const ownerId = row?.id ? ownerForRecord(name, row, siteOwners) : undefined;
      if (!row?.id || !ownerId || !userCanAccessRecord(user, name, 'write', ownerId)) continue;
      if (justPulled.has(`${name}|${row.id}`)) continue; // it just came from the server
      const stamp = stampOf(row);
      if (since > 0 && time(stamp) <= since) continue; // unchanged since the last push
      const { passwordHash: _never, ...data } = row; // defensive: no table here should carry one
      outgoing.push({
        owner_id: ownerId,
        table_name: name,
        record_id: String(row.id),
        site_id: name === 'sites' ? String(row.id) : row.siteId ? String(row.siteId) : null,
        data,
        is_deleted: !!row.isDeleted,
        client_updated_at: stamp || startedAt,
      });
    }
  }
  const sentTombstones = tombstones
    .filter(t => SYNC_TABLES.includes(t.table) && userCanAccessRecord(user, t.table, 'write', t.ownerId || user.id));
  for (const t of sentTombstones) {
    outgoing.push({ owner_id: t.ownerId || user.id, table_name: t.table, record_id: t.id, site_id: null, data: { id: t.id, purged: true }, is_deleted: true, client_updated_at: t.at });
  }

  for (let i = 0; i < outgoing.length; i += CHUNK) await remote.push(outgoing.slice(i, i + CHUNK));

  return {
    result: { pushed: outgoing.length, pulled, removed, finishedAt: now() },
    state: { lastPulledAt: newestServer, lastPushedAt: startedAt },
    sentTombstones,
  };
}

// ---------------------------------------------------------------------------
// Supabase adapter and device-side bookkeeping
// ---------------------------------------------------------------------------

export function supabaseRemote(client: SupabaseClient): RemoteStore {
  return {
    async push(rows) {
      // owner_id is filled in by the database from the signed-in user (column default).
      const { error } = await client.from('mistry_records').upsert(rows, { onConflict: 'owner_id,table_name,record_id' });
      if (error) throw new Error(error.message);
    },
    async pull(since, limit, offset) {
      let query = client
        .from('mistry_records')
        .select('owner_id,table_name,record_id,site_id,data,is_deleted,client_updated_at,server_updated_at')
        .order('server_updated_at', { ascending: true })
        .order('record_id', { ascending: true })
        .range(offset, offset + limit - 1);
      if (since) query = query.gt('server_updated_at', since);
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return (data || []) as RemoteRow[];
    },
  };
}

const hasStorage = () => typeof localStorage !== 'undefined';

const stateKey = (cloudUserId: string, localUserId: string) => `mistry_sync_state_${cloudUserId}_${localUserId}`;

export interface CloudStatus {
  lastSyncedAt: string | null;
  lastError: string | null;
}

export function readCloudStatus(cloudUserId: string, localUserId: string): CloudStatus & SyncState {
  const empty = { lastPulledAt: null, lastPushedAt: null, lastSyncedAt: null, lastError: null };
  if (!hasStorage()) return empty;
  try {
    return { ...empty, ...JSON.parse(localStorage.getItem(stateKey(cloudUserId, localUserId)) || '{}') };
  } catch {
    return empty;
  }
}

let running: Promise<{ ok: true; result: SyncResult } | { ok: false; error: string }> | null = null;

/**
 * Runs one sync for the signed-in cloud account. Calls made while a sync is running share
 * that run instead of starting a second one.
 */
export function runCloudSync(client: SupabaseClient, user: User) {
  if (running) return running;
  running = (async () => {
    const { data } = await client.auth.getSession();
    const cloudUserId = data.session?.user?.id;
    if (!cloudUserId) return { ok: false as const, error: 'Sign in to cloud backup first.' };
    const saved = readCloudStatus(cloudUserId, user.id);
    try {
      const { result, state, sentTombstones } = await syncOnce(supabaseRemote(client), user, saved, readTombstones());
      forgetTombstones(sentTombstones);
      if (hasStorage()) localStorage.setItem(stateKey(cloudUserId, user.id), JSON.stringify({ ...state, lastSyncedAt: result.finishedAt, lastError: null }));
      return { ok: true as const, result };
    } catch (err) {
      const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
      const error = offline ? 'No internet connection. Your records are safe on this phone and will sync when you are back online.' : (err as Error).message || 'Sync failed.';
      if (hasStorage()) localStorage.setItem(stateKey(cloudUserId, user.id), JSON.stringify({ ...saved, lastError: error }));
      return { ok: false as const, error };
    }
  })().finally(() => { running = null; });
  return running;
}
