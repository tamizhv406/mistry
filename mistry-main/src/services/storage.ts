/**
 * Phase 1 — Unified Storage Service & Persistence Engine
 * Centralized Storage Service using IndexedDB with localStorage fallback,
 * strict schemas, UUID generation, ISO timestamps, debounced auto-save,
 * schema versioning & migration (DB_VERSION = 2), and JSON/CSV export & import.
 */

import { db } from '../db/db';
import type { User } from '../db/types';

export const DB_VERSION = 2;

// ── Types & Strict Schemas ──────────────────────────────────────────

export type SiteStatus = 'active' | 'completed' | 'on_hold';
export type AttendanceStatus = 'P' | 'H' | 'A' | 'OT';
export type PackageType = 'standard' | 'premium' | 'luxury';

export interface StorageSite {
  id: string;
  siteName: string;
  ownerName: string;
  phone: string;
  location: string;
  buildingType: string;
  totalBudget: number;
  status: SiteStatus;
  createdAt: string; // ISO
  updatedAt?: string;
  userId?: string;
  // Legacy alias compatibility
  name?: string;
}

export interface StorageWorker {
  id: string;
  name: string;
  role: string;
  phone: string;
  dailyWage: number;
  overtimeRate: number;
  siteId?: string;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
  userId?: string;
  // Legacy alias
  category?: string;
}

export interface StorageAttendance {
  id: string;
  date: string; // YYYY-MM-DD
  workerId: string;
  siteId: string;
  status: AttendanceStatus;
  otHours: number;
  notes?: string;
  createdAt?: string;
  userId?: string;
}

export interface StoragePlan {
  id: string;
  siteId: string;
  name: string;
  dimensions: {
    length: number;
    width: number;
  };
  rooms: any[];
  walls: any[];
  openings: any[];
  updatedAt: string; // ISO
  createdAt?: string;
  userId?: string;
}

export interface StorageEstimate {
  id: string;
  siteId: string;
  builtUpArea: number;
  packageType: PackageType;
  materialRates: Record<string, number>;
  totals: Record<string, number>;
  createdAt?: string;
  updatedAt?: string;
  userId?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface BackupPayload {
  version: number;
  appName: string;
  exportedAt: string;
  data: {
    sites: StorageSite[];
    workers: StorageWorker[];
    attendance: StorageAttendance[];
    plans: StoragePlan[];
    estimates: StorageEstimate[];
    [key: string]: any;
  };
}

// ── UUID & Timestamp Utilities ─────────────────────────────────────

export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function currentISOTime(): string {
  return new Date().toISOString();
}

// ── Schema Validators ──────────────────────────────────────────────

export function validateSite(site: Partial<StorageSite>): ValidationResult {
  const errors: string[] = [];
  const name = site.siteName || site.name;
  if (!name || typeof name !== 'string' || !name.trim()) {
    errors.push('Site name is required and must be non-empty.');
  }
  if (site.totalBudget !== undefined && (typeof site.totalBudget !== 'number' || site.totalBudget < 0)) {
    errors.push('Total budget must be a positive number or zero.');
  }
  if (site.status && !['active', 'completed', 'on_hold'].includes(site.status)) {
    errors.push('Status must be one of: active, completed, on_hold.');
  }
  return { valid: errors.length === 0, errors };
}

export function validateWorker(worker: Partial<StorageWorker>): ValidationResult {
  const errors: string[] = [];
  if (!worker.name || typeof worker.name !== 'string' || !worker.name.trim()) {
    errors.push('Worker name is required and must be non-empty.');
  }
  if (worker.dailyWage !== undefined && (typeof worker.dailyWage !== 'number' || worker.dailyWage < 0)) {
    errors.push('Daily wage must be a non-negative number.');
  }
  if (worker.overtimeRate !== undefined && (typeof worker.overtimeRate !== 'number' || worker.overtimeRate < 0)) {
    errors.push('Overtime rate must be a non-negative number.');
  }
  return { valid: errors.length === 0, errors };
}

export function validateAttendance(att: Partial<StorageAttendance>): ValidationResult {
  const errors: string[] = [];
  if (!att.date || !/^\d{4}-\d{2}-\d{2}$/.test(att.date)) {
    errors.push('Attendance date must be in YYYY-MM-DD format.');
  }
  if (!att.workerId) {
    errors.push('Worker ID is required.');
  }
  if (!att.siteId) {
    errors.push('Site ID is required.');
  }
  if (!att.status || !['P', 'H', 'A', 'OT'].includes(att.status)) {
    errors.push("Status must be one of: 'P', 'H', 'A', 'OT'.");
  }
  if (att.otHours !== undefined && (typeof att.otHours !== 'number' || att.otHours < 0)) {
    errors.push('Overtime hours must be a non-negative number.');
  }
  return { valid: errors.length === 0, errors };
}

export function validatePlan(plan: Partial<StoragePlan>): ValidationResult {
  const errors: string[] = [];
  if (!plan.name || typeof plan.name !== 'string' || !plan.name.trim()) {
    errors.push('Plan name is required.');
  }
  if (!plan.dimensions || typeof plan.dimensions.length !== 'number' || typeof plan.dimensions.width !== 'number') {
    errors.push('Plan dimensions must contain valid length and width.');
  } else if (plan.dimensions.length <= 0 || plan.dimensions.width <= 0) {
    errors.push('Plan dimensions must be greater than zero.');
  }
  return { valid: errors.length === 0, errors };
}

export function validateEstimate(est: Partial<StorageEstimate>): ValidationResult {
  const errors: string[] = [];
  if (est.builtUpArea !== undefined && (typeof est.builtUpArea !== 'number' || est.builtUpArea <= 0)) {
    errors.push('Built up area must be a positive number.');
  }
  if (est.packageType && !['standard', 'premium', 'luxury'].includes(est.packageType)) {
    errors.push("Package type must be one of: 'standard', 'premium', 'luxury'.");
  }
  return { valid: errors.length === 0, errors };
}

// ── LocalStorage / In-Memory Fallback Layer ─────────────────────────

class LocalStorageStore {
  private prefix = 'bm_storage_v2_';
  private memoryStore = new Map<string, string>();

  get<T>(key: string): T[] {
    try {
      if (typeof localStorage !== 'undefined' && typeof localStorage.getItem === 'function') {
        const raw = localStorage.getItem(this.prefix + key);
        if (raw) return JSON.parse(raw);
      }
    } catch {
      // ignore
    }
    const mem = this.memoryStore.get(this.prefix + key);
    return mem ? JSON.parse(mem) : [];
  }

  set<T>(key: string, items: T[]): void {
    const json = JSON.stringify(items);
    this.memoryStore.set(this.prefix + key, json);
    try {
      if (typeof localStorage !== 'undefined' && typeof localStorage.setItem === 'function') {
        localStorage.setItem(this.prefix + key, json);
      }
    } catch {
      // ignore
    }
  }

  put<T extends { id: string }>(key: string, item: T): void {
    const list = this.get<T>(key);
    const index = list.findIndex((x) => x.id === item.id);
    if (index >= 0) {
      list[index] = item;
    } else {
      list.push(item);
    }
    this.set(key, list);
  }

  remove(key: string, id: string): void {
    const list = this.get<{ id: string }>(key);
    const filtered = list.filter((x) => x.id !== id);
    this.set(key, filtered);
  }

  clear(key: string): void {
    this.memoryStore.delete(this.prefix + key);
    try {
      if (typeof localStorage !== 'undefined' && typeof localStorage.removeItem === 'function') {
        localStorage.removeItem(this.prefix + key);
      }
    } catch {
      // ignore
    }
  }
}

const localStore = new LocalStorageStore();

// ── Unified Storage Service Implementation ──────────────────────────

export class UnifiedStorageService {
  private isIndexedDBAvailable: boolean = true;

  constructor() {
    this.checkIndexedDB();
  }

  private checkIndexedDB(): boolean {
    try {
      const hasIDB = typeof indexedDB !== 'undefined' || (typeof window !== 'undefined' && Boolean(window.indexedDB));
      this.isIndexedDBAvailable = Boolean(hasIDB && db);
      return this.isIndexedDBAvailable;
    } catch {
      this.isIndexedDBAvailable = false;
      return false;
    }
  }

  // ── Auto-Migration (DB_VERSION = 2) ──
  async autoMigrate(): Promise<{ migrated: boolean; version: number }> {
    try {
      let storedVersionStr: string | null = null;
      try {
        if (typeof localStorage !== 'undefined') {
          storedVersionStr = localStorage.getItem('bm_storage_schema_version');
        }
      } catch {
        // ignore
      }
      const currentVer = storedVersionStr ? parseInt(storedVersionStr, 10) : 1;

      if (currentVer < DB_VERSION) {
        // Run migration: read existing Dexie sites, workers, attendance and normalize
        if (this.checkIndexedDB() && db) {
          const rawSites = await db.sites.toArray().catch(() => []);
          for (const s of rawSites) {
            const normalized: StorageSite = {
              id: s.id || generateUUID(),
              siteName: (s as any).siteName || s.name || 'Untitled Site',
              name: s.name || (s as any).siteName || 'Untitled Site',
              ownerName: (s as any).ownerName || (s as any).clientName || '',
              phone: (s as any).phone || (s as any).ownerPhone || '',
              location: (s as any).location || (s as any).area || (s as any).address || '',
              buildingType: (s as any).buildingType || 'Residential',
              totalBudget: Number((s as any).totalBudget || (s as any).budget || 0),
              status: ((s as any).status as SiteStatus) || 'active',
              createdAt: s.createdAt || currentISOTime(),
              updatedAt: currentISOTime(),
              userId: s.userId || 'current_user',
            };
            localStore.put('sites', normalized);
          }

          const rawWorkers = await db.workers.toArray().catch(() => []);
          for (const w of rawWorkers) {
            const normalized: StorageWorker = {
              id: w.id || generateUUID(),
              name: w.name || 'Worker',
              role: (w as any).role || w.category || 'Mason',
              phone: (w as any).phone || '',
              dailyWage: Number(w.dailyWage || 0),
              overtimeRate: Number((w as any).overtimeRate || (w.dailyWage ? Math.round(w.dailyWage / 8) : 0)),
              siteId: w.siteId,
              active: (w as any).active !== undefined ? (w as any).active : !(w as any).isDeleted,
              createdAt: currentISOTime(),
              updatedAt: currentISOTime(),
              userId: w.userId,
            };
            localStore.put('workers', normalized);
          }
        }

        try {
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem('bm_storage_schema_version', String(DB_VERSION));
          }
        } catch {
          // ignore
        }
        return { migrated: true, version: DB_VERSION };
      }

      return { migrated: false, version: currentVer };
    } catch (e) {
      console.warn('Auto migration warning (continuing safely):', e);
      return { migrated: false, version: 1 };
    }
  }

  // ── SITES ──
  async getSites(): Promise<StorageSite[]> {
    if (this.checkIndexedDB() && db) {
      try {
        const sites = await db.sites.toArray();
        if (sites && sites.length > 0) {
          return sites
            .filter((s) => !s.isDeleted)
            .map((s) => ({
              id: s.id,
              siteName: (s as any).siteName || s.name || 'Untitled Site',
              name: s.name || (s as any).siteName,
              ownerName: (s as any).ownerName || (s as any).clientName || '',
              phone: (s as any).phone || (s as any).ownerPhone || '',
              location: (s as any).location || (s as any).area || (s as any).address || '',
              buildingType: (s as any).buildingType || 'Residential',
              totalBudget: Number((s as any).totalBudget || (s as any).budget || 0),
              status: ((s as any).status as SiteStatus) || 'active',
              createdAt: s.createdAt || currentISOTime(),
              updatedAt: (s as any).updatedAt || s.createdAt || currentISOTime(),
              userId: s.userId,
            }));
        }
      } catch (e) {
        console.warn('IndexedDB getSites error, falling back to localStorage:', e);
      }
    }
    return localStore.get<StorageSite>('sites');
  }

  async saveSite(data: Partial<StorageSite>): Promise<StorageSite> {
    const val = validateSite(data);
    if (!val.valid) {
      throw new Error(`Validation Error: ${val.errors.join(' ')}`);
    }

    const siteName = data.siteName || data.name || 'Untitled Site';
    const site: StorageSite = {
      id: data.id || generateUUID(),
      siteName,
      name: siteName,
      ownerName: data.ownerName || '',
      phone: data.phone || '',
      location: data.location || '',
      buildingType: data.buildingType || 'Residential',
      totalBudget: Number(data.totalBudget || 0),
      status: data.status || 'active',
      createdAt: data.createdAt || currentISOTime(),
      updatedAt: currentISOTime(),
      userId: data.userId || 'current_user',
    };

    // 1. Save to LocalStore fallback
    localStore.put('sites', site);

    // 2. Save to Dexie IndexedDB
    if (this.checkIndexedDB() && db) {
      try {
        await db.sites.put({
          id: site.id,
          name: site.siteName,
          status: site.status,
          createdAt: site.createdAt,
          userId: site.userId,
          area: site.location,
          budget: site.totalBudget,
          isDeleted: false,
          ...(site as any),
        });
      } catch (e) {
        console.warn('IndexedDB saveSite failed, kept in localStorage fallback:', e);
      }
    }

    return site;
  }

  async deleteSite(id: string): Promise<void> {
    localStore.remove('sites', id);
    if (this.checkIndexedDB() && db) {
      try {
        await db.sites.update(id, { isDeleted: true });
      } catch (e) {
        console.warn('IndexedDB deleteSite error:', e);
      }
    }
  }

  // ── WORKERS ──
  async getWorkers(siteId?: string): Promise<StorageWorker[]> {
    if (this.checkIndexedDB() && db) {
      try {
        let workers = await db.workers.toArray();
        if (workers && workers.length > 0) {
          if (siteId) {
            workers = workers.filter((w) => w.siteId === siteId);
          }
          return workers
            .filter((w) => !(w as any).isDeleted)
            .map((w) => ({
              id: w.id,
              name: w.name,
              role: (w as any).role || w.category || 'Worker',
              phone: (w as any).phone || '',
              dailyWage: Number(w.dailyWage || 0),
              overtimeRate: Number((w as any).overtimeRate || (w.dailyWage ? Math.round(w.dailyWage / 8) : 0)),
              siteId: w.siteId,
              active: (w as any).active !== undefined ? (w as any).active : true,
              createdAt: (w as any).createdAt || currentISOTime(),
              updatedAt: (w as any).updatedAt || currentISOTime(),
              userId: w.userId,
            }));
        }
      } catch (e) {
        console.warn('IndexedDB getWorkers error, falling back to localStorage:', e);
      }
    }
    const all = localStore.get<StorageWorker>('workers');
    return siteId ? all.filter((w) => w.siteId === siteId) : all;
  }

  async saveWorker(data: Partial<StorageWorker>): Promise<StorageWorker> {
    const val = validateWorker(data);
    if (!val.valid) {
      throw new Error(`Validation Error: ${val.errors.join(' ')}`);
    }

    const worker: StorageWorker = {
      id: data.id || generateUUID(),
      name: data.name!,
      role: data.role || (data as any).category || 'Worker',
      phone: data.phone || '',
      dailyWage: Number(data.dailyWage || 0),
      overtimeRate: Number(data.overtimeRate || (data.dailyWage ? Math.round(data.dailyWage / 8) : 0)),
      siteId: data.siteId,
      active: data.active !== undefined ? data.active : true,
      createdAt: data.createdAt || currentISOTime(),
      updatedAt: currentISOTime(),
      userId: data.userId || 'current_user',
    };

    localStore.put('workers', worker);

    if (this.checkIndexedDB() && db) {
      try {
        await db.workers.put({
          id: worker.id,
          name: worker.name,
          category: worker.role as any,
          dailyWage: worker.dailyWage,
          siteId: worker.siteId || '',
          userId: worker.userId || 'current_user',
          isDeleted: !worker.active,
          ...(worker as any),
        });
      } catch (e) {
        console.warn('IndexedDB saveWorker failed, kept in localStorage fallback:', e);
      }
    }

    return worker;
  }

  // ── ATTENDANCE ──
  async getAttendance(siteId?: string, date?: string): Promise<StorageAttendance[]> {
    if (this.checkIndexedDB() && db) {
      try {
        let att = await db.attendance.toArray();
        if (att && att.length > 0) {
          if (siteId) att = att.filter((a) => a.siteId === siteId);
          if (date) att = att.filter((a) => a.date === date);
          return att
            .filter((a) => !(a as any).isDeleted)
            .map((a) => ({
              id: a.id,
              date: a.date,
              workerId: a.workerId,
              siteId: a.siteId,
              status: normalizeAttendanceStatus((a as any).status),
              otHours: Number((a as any).otHours || 0),
              notes: (a as any).notes || '',
              createdAt: (a as any).createdAt || currentISOTime(),
              userId: a.userId,
            }));
        }
      } catch (e) {
        console.warn('IndexedDB getAttendance error, falling back to localStorage:', e);
      }
    }
    let all = localStore.get<StorageAttendance>('attendance');
    if (siteId) all = all.filter((a) => a.siteId === siteId);
    if (date) all = all.filter((a) => a.date === date);
    return all;
  }

  async saveAttendance(data: Partial<StorageAttendance>): Promise<StorageAttendance> {
    const val = validateAttendance(data);
    if (!val.valid) {
      throw new Error(`Validation Error: ${val.errors.join(' ')}`);
    }

    const att: StorageAttendance = {
      id: data.id || generateUUID(),
      date: data.date!,
      workerId: data.workerId!,
      siteId: data.siteId!,
      status: normalizeAttendanceStatus(data.status),
      otHours: Number(data.otHours || 0),
      notes: data.notes || '',
      createdAt: data.createdAt || currentISOTime(),
      userId: data.userId || 'current_user',
    };

    localStore.put('attendance', att);

    if (this.checkIndexedDB() && db) {
      try {
        await db.attendance.put({
          id: att.id,
          date: att.date,
          workerId: att.workerId,
          siteId: att.siteId,
          status: att.status as any,
          userId: att.userId,
          isDeleted: false,
          ...(att as any),
        });
      } catch (e) {
        console.warn('IndexedDB saveAttendance failed, kept in localStorage fallback:', e);
      }
    }

    return att;
  }

  // ── PLANS ──
  async getPlans(siteId?: string): Promise<StoragePlan[]> {
    if (this.checkIndexedDB() && db) {
      try {
        let plans = await db.floorPlans.toArray();
        if (plans && plans.length > 0) {
          if (siteId) plans = plans.filter((p) => p.siteId === siteId);
          return plans
            .filter((p) => !(p as any).isDeleted)
            .map((p) => ({
              id: p.id,
              siteId: p.siteId,
              name: p.name,
              dimensions: (p as any).dimensions || {
                length: (p as any).gridWidth || 40,
                width: (p as any).gridHeight || 30,
              },
              rooms: (p as any).rooms || [],
              walls: (p as any).walls || [],
              openings: (p as any).openings || [],
              updatedAt: (p as any).updatedAt || (p as any).createdAt || currentISOTime(),
              createdAt: p.createdAt || currentISOTime(),
              userId: p.userId,
            }));
        }
      } catch (e) {
        console.warn('IndexedDB getPlans error, falling back to localStorage:', e);
      }
    }
    const all = localStore.get<StoragePlan>('plans');
    return siteId ? all.filter((p) => p.siteId === siteId) : all;
  }

  async savePlan(data: Partial<StoragePlan>): Promise<StoragePlan> {
    const val = validatePlan(data);
    if (!val.valid) {
      throw new Error(`Validation Error: ${val.errors.join(' ')}`);
    }

    const plan: StoragePlan = {
      id: data.id || generateUUID(),
      siteId: data.siteId || '',
      name: data.name!,
      dimensions: data.dimensions!,
      rooms: data.rooms || [],
      walls: data.walls || [],
      openings: data.openings || [],
      updatedAt: currentISOTime(),
      createdAt: data.createdAt || currentISOTime(),
      userId: data.userId || 'current_user',
    };

    localStore.put('plans', plan);

    if (this.checkIndexedDB() && db) {
      try {
        await db.floorPlans.put({
          id: plan.id,
          siteId: plan.siteId,
          name: plan.name,
          createdAt: plan.createdAt || currentISOTime(),
          userId: plan.userId,
          isDeleted: false,
          ...(plan as any),
        });
      } catch (e) {
        console.warn('IndexedDB savePlan failed, kept in localStorage fallback:', e);
      }
    }

    return plan;
  }

  // ── ESTIMATES ──
  async getEstimates(siteId?: string): Promise<StorageEstimate[]> {
    if (this.checkIndexedDB() && db) {
      try {
        let ests = await db.estimates.toArray();
        if (ests && ests.length > 0) {
          if (siteId) ests = ests.filter((e) => e.siteId === siteId);
          return ests
            .filter((e) => !(e as any).isDeleted)
            .map((e) => ({
              id: e.id,
              siteId: e.siteId,
              builtUpArea: Number((e as any).builtUpArea || (e as any).plotSize || 1000),
              packageType: ((e as any).packageType as PackageType) || 'standard',
              materialRates: (e as any).materialRates || {},
              totals: (e as any).totals || {},
              createdAt: e.createdAt || currentISOTime(),
              updatedAt: (e as any).updatedAt || currentISOTime(),
              userId: e.userId,
            }));
        }
      } catch (e) {
        console.warn('IndexedDB getEstimates error, falling back to localStorage:', e);
      }
    }
    const all = localStore.get<StorageEstimate>('estimates');
    return siteId ? all.filter((e) => e.siteId === siteId) : all;
  }

  async saveEstimate(data: Partial<StorageEstimate>): Promise<StorageEstimate> {
    const val = validateEstimate(data);
    if (!val.valid) {
      throw new Error(`Validation Error: ${val.errors.join(' ')}`);
    }

    const est: StorageEstimate = {
      id: data.id || generateUUID(),
      siteId: data.siteId || '',
      builtUpArea: Number(data.builtUpArea || 1000),
      packageType: data.packageType || 'standard',
      materialRates: data.materialRates || {},
      totals: data.totals || {},
      createdAt: data.createdAt || currentISOTime(),
      updatedAt: currentISOTime(),
      userId: data.userId || 'current_user',
    };

    localStore.put('estimates', est);

    if (this.checkIndexedDB() && db) {
      try {
        await db.estimates.put({
          id: est.id,
          siteId: est.siteId,
          estimateName: `Estimate ${est.builtUpArea} sq.ft (${est.packageType})`,
          createdAt: est.createdAt || currentISOTime(),
          userId: est.userId || 'current_user',
          isDeleted: false,
          ...(est as any),
        });
      } catch (e) {
        console.warn('IndexedDB saveEstimate failed, kept in localStorage fallback:', e);
      }
    }

    return est;
  }

  // ── EXPORT ENGINE (JSON & CSV) ──
  async exportJSON(user?: User | null): Promise<{ filename: string; blob: Blob; content: string }> {
    const [sites, workers, attendance, plans, estimates] = await Promise.all([
      this.getSites(),
      this.getWorkers(),
      this.getAttendance(),
      this.getPlans(),
      this.getEstimates(),
    ]);

    const backupPayload: BackupPayload = {
      version: DB_VERSION,
      appName: 'Building Mistry',
      exportedAt: currentISOTime(),
      data: {
        sites,
        workers,
        attendance,
        plans,
        estimates,
      },
    };

    const content = JSON.stringify(backupPayload, null, 2);
    let blob: Blob;
    try {
      blob = new Blob([content], { type: 'application/json' });
    } catch {
      blob = { size: content.length, type: 'application/json' } as any;
    }
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `mistry_backup_${dateStr}.json`;

    return { filename, blob, content };
  }

  async downloadJSON(user?: User | null): Promise<string> {
    const { filename, blob } = await this.exportJSON(user);
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
    return filename;
  }

  async exportSummaryCSV(): Promise<{ filename: string; blob: Blob; content: string }> {
    const [sites, workers, attendance, estimates] = await Promise.all([
      this.getSites(),
      this.getWorkers(),
      this.getAttendance(),
      this.getEstimates(),
    ]);

    const rows: string[] = [];
    rows.push('--- BUILDING MISTRY EXECUTIVE SUMMARY ---');
    rows.push(`Exported At,${new Date().toISOString()}`);
    rows.push('');

    // Sites Section
    rows.push('--- SITES & PROJECTS ---');
    rows.push('ID,Site Name,Owner Name,Phone,Location,Building Type,Total Budget,Status,Created At');
    for (const s of sites) {
      rows.push(`"${s.id}","${escapeCsv(s.siteName)}","${escapeCsv(s.ownerName)}","${escapeCsv(s.phone)}","${escapeCsv(s.location)}","${escapeCsv(s.buildingType)}",${s.totalBudget},"${s.status}","${s.createdAt}"`);
    }
    rows.push('');

    // Workers Section
    rows.push('--- WORKERS & LABOUR ---');
    rows.push('ID,Worker Name,Role,Phone,Daily Wage,Overtime Rate,Site ID,Active');
    for (const w of workers) {
      rows.push(`"${w.id}","${escapeCsv(w.name)}","${escapeCsv(w.role)}","${escapeCsv(w.phone)}",${w.dailyWage},${w.overtimeRate},"${w.siteId || ''}",${w.active}`);
    }
    rows.push('');

    // Attendance Section
    rows.push('--- ATTENDANCE LOGS ---');
    rows.push('ID,Date,Worker ID,Site ID,Status,OT Hours,Notes');
    for (const a of attendance) {
      rows.push(`"${a.id}","${a.date}","${a.workerId}","${a.siteId}","${a.status}",${a.otHours},"${escapeCsv(a.notes || '')}"`);
    }
    rows.push('');

    // Estimates Section
    rows.push('--- ESTIMATES ---');
    rows.push('ID,Site ID,Built Up Area,Package Type,Grand Total');
    for (const e of estimates) {
      const grandTotal = e.totals?.grandTotal || e.totals?.total || 0;
      rows.push(`"${e.id}","${e.siteId}",${e.builtUpArea},"${e.packageType}",${grandTotal}`);
    }

    const content = rows.join('\n');
    let blob: Blob;
    try {
      blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    } catch {
      blob = { size: content.length, type: 'text/csv' } as any;
    }
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `mistry_summary_${dateStr}.csv`;

    return { filename, blob, content };
  }

  async downloadSummaryCSV(): Promise<string> {
    const { filename, blob } = await this.exportSummaryCSV();
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
    return filename;
  }

  // ── IMPORT ENGINE WITH CONFLICT RESOLUTION (Overwrite / Merge) ──
  async importJSON(
    jsonTextOrObj: string | object,
    conflictMode: 'overwrite' | 'merge' = 'merge'
  ): Promise<{ success: boolean; message: string; recordCount: number; errors: string[] }> {
    try {
      let payload: any = jsonTextOrObj;
      if (typeof jsonTextOrObj === 'string') {
        payload = JSON.parse(jsonTextOrObj);
      }

      if (!payload || typeof payload !== 'object' || !payload.data) {
        throw new Error('Invalid JSON format: missing root "data" object.');
      }

      const { data } = payload;
      const errors: string[] = [];
      let importedCount = 0;

      // Validate & Collect entities
      const validSites: StorageSite[] = [];
      if (Array.isArray(data.sites)) {
        for (const s of data.sites) {
          const val = validateSite(s);
          if (val.valid) {
            validSites.push({
              id: s.id || generateUUID(),
              siteName: s.siteName || s.name || 'Untitled Site',
              name: s.name || s.siteName || 'Untitled Site',
              ownerName: s.ownerName || '',
              phone: s.phone || '',
              location: s.location || '',
              buildingType: s.buildingType || 'Residential',
              totalBudget: Number(s.totalBudget || 0),
              status: s.status || 'active',
              createdAt: s.createdAt || currentISOTime(),
              updatedAt: currentISOTime(),
            });
          } else {
            errors.push(`Site [${s.id || 'new'}]: ${val.errors.join(', ')}`);
          }
        }
      }

      const validWorkers: StorageWorker[] = [];
      if (Array.isArray(data.workers)) {
        for (const w of data.workers) {
          const val = validateWorker(w);
          if (val.valid) {
            validWorkers.push({
              id: w.id || generateUUID(),
              name: w.name,
              role: w.role || w.category || 'Worker',
              phone: w.phone || '',
              dailyWage: Number(w.dailyWage || 0),
              overtimeRate: Number(w.overtimeRate || (w.dailyWage ? Math.round(w.dailyWage / 8) : 0)),
              siteId: w.siteId,
              active: w.active !== undefined ? w.active : true,
              createdAt: w.createdAt || currentISOTime(),
              updatedAt: currentISOTime(),
            });
          } else {
            errors.push(`Worker [${w.id || 'new'}]: ${val.errors.join(', ')}`);
          }
        }
      }

      const validAttendance: StorageAttendance[] = [];
      if (Array.isArray(data.attendance)) {
        for (const a of data.attendance) {
          const val = validateAttendance(a);
          if (val.valid) {
            validAttendance.push({
              id: a.id || generateUUID(),
              date: a.date,
              workerId: a.workerId,
              siteId: a.siteId,
              status: normalizeAttendanceStatus(a.status),
              otHours: Number(a.otHours || 0),
              notes: a.notes || '',
              createdAt: a.createdAt || currentISOTime(),
            });
          } else {
            errors.push(`Attendance [${a.id || 'new'}]: ${val.errors.join(', ')}`);
          }
        }
      }

      const validPlans: StoragePlan[] = [];
      if (Array.isArray(data.plans)) {
        for (const p of data.plans) {
          const val = validatePlan(p);
          if (val.valid) {
            validPlans.push({
              id: p.id || generateUUID(),
              siteId: p.siteId,
              name: p.name,
              dimensions: p.dimensions,
              rooms: p.rooms || [],
              walls: p.walls || [],
              openings: p.openings || [],
              updatedAt: p.updatedAt || currentISOTime(),
            });
          } else {
            errors.push(`Plan [${p.id || 'new'}]: ${val.errors.join(', ')}`);
          }
        }
      }

      const validEstimates: StorageEstimate[] = [];
      if (Array.isArray(data.estimates)) {
        for (const e of data.estimates) {
          const val = validateEstimate(e);
          if (val.valid) {
            validEstimates.push({
              id: e.id || generateUUID(),
              siteId: e.siteId,
              builtUpArea: Number(e.builtUpArea || 1000),
              packageType: e.packageType || 'standard',
              materialRates: e.materialRates || {},
              totals: e.totals || {},
              createdAt: e.createdAt || currentISOTime(),
              updatedAt: currentISOTime(),
            });
          } else {
            errors.push(`Estimate [${e.id || 'new'}]: ${val.errors.join(', ')}`);
          }
        }
      }

      // Perform Overwrite or Merge
      if (conflictMode === 'overwrite') {
        localStore.clear('sites');
        localStore.clear('workers');
        localStore.clear('attendance');
        localStore.clear('plans');
        localStore.clear('estimates');

        localStore.set('sites', validSites);
        localStore.set('workers', validWorkers);
        localStore.set('attendance', validAttendance);
        localStore.set('plans', validPlans);
        localStore.set('estimates', validEstimates);

        importedCount = validSites.length + validWorkers.length + validAttendance.length + validPlans.length + validEstimates.length;

        // Sync to Dexie if available
        if (this.checkIndexedDB() && db) {
          try {
            await db.transaction('rw', [db.sites, db.workers, db.attendance, db.floorPlans, db.estimates], async () => {
              if (validSites.length) {
                await db.sites.clear();
                await db.sites.bulkAdd(validSites.map((s) => ({ id: s.id, name: s.siteName, status: s.status, createdAt: s.createdAt, isDeleted: false, ...(s as any) })));
              }
              if (validWorkers.length) {
                await db.workers.clear();
                await db.workers.bulkAdd(validWorkers.map((w) => ({ id: w.id, name: w.name, category: w.role as any, dailyWage: w.dailyWage, isDeleted: !w.active, ...(w as any) })));
              }
              if (validAttendance.length) {
                await db.attendance.clear();
                await db.attendance.bulkAdd(validAttendance.map((a) => ({ id: a.id, date: a.date, workerId: a.workerId, siteId: a.siteId, status: a.status as any, isDeleted: false, ...(a as any) })));
              }
              if (validPlans.length) {
                await db.floorPlans.clear();
                await db.floorPlans.bulkAdd(validPlans.map((p) => ({ id: p.id, siteId: p.siteId, name: p.name, createdAt: p.updatedAt, isDeleted: false, ...(p as any) })));
              }
              if (validEstimates.length) {
                await db.estimates.clear();
                await db.estimates.bulkAdd(validEstimates.map((e) => ({ id: e.id, siteId: e.siteId, estimateName: `Estimate ${e.builtUpArea}`, createdAt: e.createdAt || currentISOTime(), isDeleted: false, ...(e as any) })));
              }
            });
          } catch (err) {
            console.warn('Dexie overwrite sync error:', err);
          }
        }
      } else {
        // Merge Mode: update or append without deleting existing records
        const mergeTable = <T extends { id: string }>(key: string, incoming: T[]): number => {
          let count = 0;
          for (const item of incoming) {
            localStore.put(key, item);
            count++;
          }
          return count;
        };

        importedCount += mergeTable('sites', validSites);
        importedCount += mergeTable('workers', validWorkers);
        importedCount += mergeTable('attendance', validAttendance);
        importedCount += mergeTable('plans', validPlans);
        importedCount += mergeTable('estimates', validEstimates);

        // Sync merged to Dexie
        if (this.checkIndexedDB() && db) {
          for (const s of validSites) {
            await db.sites.put({ id: s.id, name: s.siteName, status: s.status, createdAt: s.createdAt, isDeleted: false, ...(s as any) }).catch(() => {});
          }
          for (const w of validWorkers) {
            await db.workers.put({ id: w.id, name: w.name, category: w.role as any, dailyWage: w.dailyWage, isDeleted: !w.active, ...(w as any) }).catch(() => {});
          }
          for (const a of validAttendance) {
            await db.attendance.put({ id: a.id, date: a.date, workerId: a.workerId, siteId: a.siteId, status: a.status as any, isDeleted: false, ...(a as any) }).catch(() => {});
          }
          for (const p of validPlans) {
            await db.floorPlans.put({ id: p.id, siteId: p.siteId, name: p.name, createdAt: p.updatedAt, isDeleted: false, ...(p as any) }).catch(() => {});
          }
          for (const e of validEstimates) {
            await db.estimates.put({ id: e.id, siteId: e.siteId, estimateName: `Estimate ${e.builtUpArea}`, createdAt: e.createdAt || currentISOTime(), isDeleted: false, ...(e as any) }).catch(() => {});
          }
        }
      }

      return {
        success: true,
        message: `Successfully ${conflictMode === 'overwrite' ? 'restored' : 'merged'} ${importedCount} records.`,
        recordCount: importedCount,
        errors,
      };
    } catch (e: any) {
      return {
        success: false,
        message: e.message || 'Failed to import JSON file.',
        recordCount: 0,
        errors: [e.message || 'Unknown error'],
      };
    }
  }
}

// Helper: Normalize attendance status
function normalizeAttendanceStatus(val: any): AttendanceStatus {
  if (!val) return 'P';
  const upper = String(val).toUpperCase();
  if (upper === 'P' || upper === 'PRESENT') return 'P';
  if (upper === 'H' || upper === 'HALF' || upper === 'HALF_DAY') return 'H';
  if (upper === 'A' || upper === 'ABSENT') return 'A';
  if (upper === 'OT' || upper === 'OVERTIME') return 'OT';
  return 'P';
}

function escapeCsv(val: any): string {
  if (val === undefined || val === null) return '';
  return String(val).replace(/"/g, '""');
}

// Singleton Export
export const storageService = new UnifiedStorageService();

// ── Debounce & Auto-Save Helper ─────────────────────────────────────

export function debounce<F extends (...args: any[]) => any>(func: F, wait = 500): (...args: Parameters<F>) => void {
  let timeout: any = null;
  return function (...args: Parameters<F>) {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => {
      func(...args);
    }, wait);
  };
}

export interface AutoSaveOptions<T> {
  data: T;
  onSave: (data: T) => Promise<void> | void;
  delay?: number;
  enabled?: boolean;
}

export function createDebouncedAutoSave<T>(
  onSave: (data: T) => Promise<void> | void,
  delay = 500
): {
  trigger: (data: T) => void;
  cancel: () => void;
} {
  let timer: any = null;
  return {
    trigger: (data: T) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        onSave(data);
      }, delay);
    },
    cancel: () => {
      if (timer) clearTimeout(timer);
    },
  };
}
