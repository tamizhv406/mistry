import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { db } from '../db/db';
import type { Site, LabourWorker, AttendanceRecord, Material, OtherExpense } from '../db/types';

export interface SyncStatus {
  status: 'synced' | 'syncing' | 'offline' | 'error' | 'idle';
  lastSyncedAt: string | null;
  pendingCount: number;
  message?: string;
}

export interface OfflineQueueItem {
  id: string;
  table: 'projects' | 'workers' | 'attendance' | 'materials' | 'expenses';
  action: 'insert' | 'update' | 'delete';
  payload: any;
  timestamp: string;
}

const OFFLINE_QUEUE_KEY = 'mistry_offline_sync_queue';
const SYNC_META_KEY = 'mistry_cloud_sync_meta';

// In-memory status listener callbacks
type StatusListener = (status: SyncStatus) => void;
const listeners = new Set<StatusListener>();

let currentStatus: SyncStatus = {
  status: 'idle',
  lastSyncedAt: null,
  pendingCount: 0,
};

// Initialize lastSyncedAt from storage
if (typeof localStorage !== 'undefined') {
  try {
    const meta = JSON.parse(localStorage.getItem(SYNC_META_KEY) || '{}');
    if (meta.lastSyncedAt) currentStatus.lastSyncedAt = meta.lastSyncedAt;
    const queue: OfflineQueueItem[] = JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]');
    currentStatus.pendingCount = queue.length;
  } catch {
    // Ignore storage parse error
  }
}

function updateStatus(updates: Partial<SyncStatus>) {
  currentStatus = { ...currentStatus, ...updates };
  listeners.forEach(fn => fn(currentStatus));
}

export function subscribeSyncStatus(listener: StatusListener): () => void {
  listeners.add(listener);
  listener(currentStatus);
  return () => {
    listeners.delete(listener);
  };
}

export function getSyncStatus(): SyncStatus {
  return currentStatus;
}

// ── Offline Queue Helpers ───────────────────────────────────────────────────

export function getOfflineQueue(): OfflineQueueItem[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]');
  } catch {
    return [];
  }
}

export function saveOfflineQueue(queue: OfflineQueueItem[]) {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
  updateStatus({ pendingCount: queue.length });
}

export function queueOfflineRecord(
  table: OfflineQueueItem['table'],
  action: OfflineQueueItem['action'],
  payload: any
) {
  const queue = getOfflineQueue();
  queue.push({
    id: payload.id || `pending_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    table,
    action,
    payload,
    timestamp: new Date().toISOString(),
  });
  saveOfflineQueue(queue);
}

// ── Pulling from Supabase Cloud ─────────────────────────────────────────────

export async function pullProjectsFromCloud(userId: string): Promise<number> {
  if (!isSupabaseConfigured() || !supabase) return 0;
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('user_id', userId);

  if (error) throw error;
  if (!data || data.length === 0) return 0;

  let count = 0;
  for (const p of data) {
    const localSite: Site = {
      id: p.id,
      userId: p.user_id,
      name: p.name,
      ownerName: p.client_name || 'Client',
      ownerPhone: p.client_phone || '',
      clientName: p.client_name || '',
      clientPhone: p.client_phone || '',
      address: p.location || '',
      location: p.location || '',
      area: '',
      buildingType: p.building_type || 'residential',
      budget: Number(p.budget) || 0,
      startDate: p.created_at ? p.created_at.split('T')[0] : new Date().toISOString().split('T')[0],
      expectedCompletionDate: '',
      status: 'Active',
      createdAt: p.created_at || new Date().toISOString(),
      updatedAt: p.updated_at || new Date().toISOString(),
      isDeleted: false,
    };
    await db.sites.put(localSite);
    count++;
  }
  return count;
}

export async function pullWorkersFromCloud(userId: string): Promise<number> {
  if (!isSupabaseConfigured() || !supabase) return 0;
  const { data, error } = await supabase
    .from('workers')
    .select('*')
    .eq('user_id', userId);

  if (error) throw error;
  if (!data || data.length === 0) return 0;

  let count = 0;
  for (const w of data) {
    const localWorker: LabourWorker = {
      id: w.id,
      siteId: w.project_id,
      name: w.name,
      phone: w.phone || '',
      category: w.trade || 'mason',
      dailyWage: Number(w.daily_wage) || 0,
      joiningDate: w.created_at ? w.created_at.split('T')[0] : new Date().toISOString().split('T')[0],
      createdAt: w.created_at || new Date().toISOString(),
      updatedAt: w.updated_at || new Date().toISOString(),
      isDeleted: false,
    };
    await db.workers.put(localWorker);
    count++;
  }
  return count;
}

export async function pullAttendanceFromCloud(userId: string): Promise<number> {
  if (!isSupabaseConfigured() || !supabase) return 0;
  const { data, error } = await supabase
    .from('attendance')
    .select('*')
    .eq('user_id', userId);

  if (error) throw error;
  if (!data || data.length === 0) return 0;

  let count = 0;
  for (const a of data) {
    const localAtt: AttendanceRecord = {
      id: a.id,
      siteId: a.project_id,
      workerId: a.worker_id,
      date: a.date,
      status: (a.status === 'P' ? 'present' : a.status === 'half' ? 'half_day' : a.status === 'OT' ? 'overtime' : 'absent') as any,
      dayMultiplier: a.status === 'P' ? 1 : a.status === 'half' ? 0.5 : a.status === 'OT' ? 1.5 : 0,
      wageEarned: Number(a.wage_earned) || 0,
      createdAt: a.created_at || new Date().toISOString(),
      updatedAt: a.updated_at || new Date().toISOString(),
      isDeleted: false,
    };
    await db.attendance.put(localAtt);
    count++;
  }
  return count;
}

export async function pullMaterialsFromCloud(userId: string): Promise<number> {
  if (!isSupabaseConfigured() || !supabase) return 0;
  const { data, error } = await supabase
    .from('materials')
    .select('*')
    .eq('user_id', userId);

  if (error) throw error;
  if (!data || data.length === 0) return 0;

  let count = 0;
  for (const m of data) {
    const localMat: Material = {
      id: m.id,
      siteId: m.project_id,
      category: m.category,
      materialName: m.brand || m.category,
      supplier: m.brand || 'Supplier',
      brand: m.brand || '',
      quantity: Number(m.quantity) || 0,
      unit: m.unit || 'bags',
      rate: Number(m.price_per_unit) || 0,
      pricePerUnit: Number(m.price_per_unit) || 0,
      totalAmount: Number(m.total_amount) || 0,
      paidAmount: Number(m.total_amount) || 0,
      balance: 0,
      extraPaid: 0,
      purchaseDate: m.purchase_date || new Date().toISOString().split('T')[0],
      createdAt: m.created_at || new Date().toISOString(),
      updatedAt: m.updated_at || new Date().toISOString(),
      isDeleted: false,
    };
    await db.materials.put(localMat);
    count++;
  }
  return count;
}

export async function pullExpensesFromCloud(userId: string): Promise<number> {
  if (!isSupabaseConfigured() || !supabase) return 0;
  const { data, error } = await supabase
    .from('expenses')
    .select('*')
    .eq('user_id', userId);

  if (error) throw error;
  if (!data || data.length === 0) return 0;

  let count = 0;
  for (const e of data) {
    const localExp: OtherExpense = {
      id: e.id,
      siteId: e.project_id,
      category: (e.category === 'fuel' ? 'Fuel' : e.category === 'transport' ? 'Transport' : 'Other') as any,
      description: e.note || e.category || 'Site Expense',
      amount: Number(e.amount) || 0,
      paidAmount: Number(e.amount) || 0,
      balance: 0,
      extraPaid: 0,
      notes: e.note || '',
      date: e.date || new Date().toISOString().split('T')[0],
      createdAt: e.created_at || new Date().toISOString(),
      updatedAt: e.updated_at || new Date().toISOString(),
      isDeleted: false,
    };
    await db.otherExpenses.put(localExp);
    count++;
  }
  return count;
}

// ── Pushing to Supabase Cloud ─────────────────────────────────────────────

export async function pushProjectsToCloud(userId: string): Promise<number> {
  if (!isSupabaseConfigured() || !supabase) return 0;
  const sites = await db.sites.filter(s => !s.isDeleted).toArray();
  if (sites.length === 0) return 0;

  const rows = sites.map(s => ({
    id: s.id,
    user_id: userId,
    name: s.name,
    client_name: s.clientName || s.ownerName || '',
    client_phone: s.clientPhone || s.ownerPhone || '',
    location: s.location || s.address || '',
    building_type: s.buildingType || 'residential',
    budget: s.budget || 0,
    created_at: s.createdAt || new Date().toISOString(),
    updated_at: s.updatedAt || new Date().toISOString(),
  }));

  const { error } = await supabase.from('projects').upsert(rows, { onConflict: 'id' });
  if (error) throw error;
  return rows.length;
}

export async function pushWorkersToCloud(userId: string): Promise<number> {
  if (!isSupabaseConfigured() || !supabase) return 0;
  const workers = await db.workers.filter(w => !w.isDeleted).toArray();
  if (workers.length === 0) return 0;

  const rows = workers.map(w => ({
    id: w.id,
    project_id: w.siteId,
    user_id: userId,
    name: w.name,
    phone: w.phone || '',
    trade: w.category || 'mason',
    daily_wage: w.dailyWage || 0,
    created_at: w.createdAt || new Date().toISOString(),
    updated_at: w.updatedAt || new Date().toISOString(),
  }));

  const { error } = await supabase.from('workers').upsert(rows, { onConflict: 'id' });
  if (error) throw error;
  return rows.length;
}

export async function pushAttendanceToCloud(userId: string): Promise<number> {
  if (!isSupabaseConfigured() || !supabase) return 0;
  const attendance = await db.attendance.filter(a => !a.isDeleted).toArray();
  if (attendance.length === 0) return 0;

  const mapStatus = (st: string) => {
    if (st === 'present') return 'P';
    if (st === 'absent') return 'A';
    if (st === 'half_day') return 'half';
    if (st === 'overtime') return 'OT';
    return ['P', 'A', 'half', 'OT'].includes(st) ? st : 'P';
  };

  const rows = attendance.map(a => ({
    id: a.id,
    project_id: a.siteId,
    worker_id: a.workerId,
    user_id: userId,
    date: a.date,
    status: mapStatus(a.status),
    wage_earned: a.wageEarned || ((a.dailyWageSnapshot || 0) * (a.dayMultiplier || 1)),
    created_at: a.createdAt || new Date().toISOString(),
    updated_at: a.updatedAt || new Date().toISOString(),
  }));

  const { error } = await supabase.from('attendance').upsert(rows, { onConflict: 'id' });
  if (error) throw error;
  return rows.length;
}

export async function pushMaterialsToCloud(userId: string): Promise<number> {
  if (!isSupabaseConfigured() || !supabase) return 0;
  const materials = await db.materials.filter(m => !m.isDeleted).toArray();
  if (materials.length === 0) return 0;

  const validCats = ['cement', 'sand', 'steel', 'bricks', 'others'];
  const rows = materials.map(m => ({
    id: m.id,
    project_id: m.siteId,
    user_id: userId,
    category: validCats.includes(m.category) ? m.category : 'others',
    brand: m.brand || '',
    quantity: m.quantity || 0,
    unit: m.unit || 'bags',
    price_per_unit: m.pricePerUnit || m.rate || 0,
    total_amount: m.totalAmount || 0,
    purchase_date: m.purchaseDate || new Date().toISOString().split('T')[0],
    created_at: m.createdAt || new Date().toISOString(),
    updated_at: m.updatedAt || new Date().toISOString(),
  }));

  const { error } = await supabase.from('materials').upsert(rows, { onConflict: 'id' });
  if (error) throw error;
  return rows.length;
}

export async function pushExpensesToCloud(userId: string): Promise<number> {
  if (!isSupabaseConfigured() || !supabase) return 0;
  const expenses = await db.otherExpenses.filter(e => !e.isDeleted).toArray();
  if (expenses.length === 0) return 0;

  const validCats = ['tea_snacks', 'fuel', 'transport', 'others'];
  const rows = expenses.map(e => ({
    id: e.id,
    project_id: e.siteId,
    user_id: userId,
    category: validCats.includes(e.category) ? e.category : 'others',
    amount: e.amount || 0,
    note: e.notes || '',
    date: e.date || new Date().toISOString().split('T')[0],
    created_at: e.createdAt || new Date().toISOString(),
    updated_at: e.updatedAt || new Date().toISOString(),
  }));

  const { error } = await supabase.from('expenses').upsert(rows, { onConflict: 'id' });
  if (error) throw error;
  return rows.length;
}

// ── Drain Offline Pending Queue ─────────────────────────────────────────────

export async function drainOfflineQueue(): Promise<number> {
  if (!isSupabaseConfigured() || !supabase) return 0;
  const queue = getOfflineQueue();
  if (queue.length === 0) return 0;

  let processedCount = 0;
  const remainingQueue: OfflineQueueItem[] = [];

  for (const item of queue) {
    try {
      if (item.action === 'insert' || item.action === 'update') {
        const { error } = await supabase.from(item.table).upsert(item.payload, { onConflict: 'id' });
        if (error) throw error;
      } else if (item.action === 'delete') {
        const { error } = await supabase.from(item.table).delete().eq('id', item.payload.id);
        if (error) throw error;
      }
      processedCount++;
    } catch {
      remainingQueue.push(item);
    }
  }

  saveOfflineQueue(remainingQueue);
  return processedCount;
}

// ── Master Full Sync Orchestrator ───────────────────────────────────────────

let activeSyncPromise: Promise<{ success: boolean; error?: string }> | null = null;

export async function performFullSync(userId?: string): Promise<{ success: boolean; error?: string }> {
  if (activeSyncPromise) return activeSyncPromise;

  activeSyncPromise = (async () => {
    if (!isSupabaseConfigured() || !supabase) {
      updateStatus({ status: 'offline', message: 'Supabase is not configured' });
      return { success: false, error: 'Supabase is not configured' };
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      updateStatus({ status: 'offline', message: 'Device is offline. Local changes queued.' });
      return { success: false, error: 'Offline' };
    }

    let targetUserId = userId;
    if (!targetUserId) {
      const { data } = await supabase.auth.getSession();
      targetUserId = data.session?.user?.id;
    }

    if (!targetUserId) {
      updateStatus({ status: 'idle', message: 'Not logged into cloud account' });
      return { success: false, error: 'Not logged in' };
    }

    updateStatus({ status: 'syncing', message: 'Syncing projects and records...' });

    try {
      // 1. Drain any pending offline queue items
      await drainOfflineQueue();

      // 2. Pull latest from cloud into Dexie local cache
      await pullProjectsFromCloud(targetUserId);
      await pullWorkersFromCloud(targetUserId);
      await pullAttendanceFromCloud(targetUserId);
      await pullMaterialsFromCloud(targetUserId);
      await pullExpensesFromCloud(targetUserId);

      // 3. Push local changes to cloud
      await pushProjectsToCloud(targetUserId);
      await pushWorkersToCloud(targetUserId);
      await pushAttendanceToCloud(targetUserId);
      await pushMaterialsToCloud(targetUserId);
      await pushExpensesToCloud(targetUserId);

      const finishedAt = new Date().toISOString();
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(SYNC_META_KEY, JSON.stringify({ lastSyncedAt: finishedAt }));
      }

      updateStatus({
        status: 'synced',
        lastSyncedAt: finishedAt,
        pendingCount: getOfflineQueue().length,
        message: 'All records synced with Supabase cloud',
      });

      return { success: true };
    } catch (err: any) {
      const msg = err.message || 'Sync failed';
      updateStatus({ status: 'error', message: msg });
      return { success: false, error: msg };
    }
  })().finally(() => {
    activeSyncPromise = null;
  });

  return activeSyncPromise;
}

// ── Auto-Sync on Network Connection Restoration & Local Database Changes ───

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    updateStatus({ status: 'syncing', message: 'Network restored, syncing...' });
    performFullSync();
  });

  window.addEventListener('offline', () => {
    updateStatus({ status: 'offline', message: 'Offline mode active. All records safe in IndexedDB.' });
  });

  // Debounced trigger to sync local edits to Supabase in the background
  let changeDebounceTimer: any = null;
  const triggerDebouncedSync = () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    clearTimeout(changeDebounceTimer);
    changeDebounceTimer = setTimeout(() => {
      performFullSync().catch(() => {});
    }, 2000);
  };

  ['sites', 'workers', 'attendance', 'materials', 'otherExpenses'].forEach(tableName => {
    try {
      const table = (db as any)[tableName];
      if (table && typeof table.hook === 'function') {
        table.hook('creating', () => { triggerDebouncedSync(); });
        table.hook('updating', () => { triggerDebouncedSync(); });
        table.hook('deleting', () => { triggerDebouncedSync(); });
      }
    } catch {
      // Table hook unavailable or unsupported
    }
  });
}
