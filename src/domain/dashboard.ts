/**
 * The dashboard's "today at a glance" numbers, computed in one place so the phone Home screen
 * and the desktop Dashboard always show the same values:
 *
 *   present today    workers marked Present, Overtime or Half day today (site time zone), each once
 *   today's expenses tea / pooja / electricity / water / other expenses dated today (as on Expenses)
 *   low stock        items at or below their low-stock level, or below zero; worst first
 *   pending salary   earned − paid − recoverable advances, per project (its own leave rule), summed
 *   recent activity  the latest entries of the activity log, newest first
 *
 * Input is plain records, so it works for one project (phone) or several (desktop "All projects").
 * Records of different projects are never mixed: stock and salary are worked out per project.
 */
import type {
  ActivityLog, AttendanceRecord, CatalogItem, ElectricityBill, LabourAdvance, LabourWorker, Material, OtherExpense,
  PoojaExpense, RodEntry, SalaryPayment, Site, StockMovement, TeaSnacksExpense, ToolAsset, ToolIssue, WaterBill,
} from '../db/types';
import { buildSiteLabourSummary, dedupeAttendance } from './salary';
import { buildStock, type StockItem } from './stock';
import { flattenExpenses } from './expenses';
import { buildToolStatus } from './toolTracking';
import type { ProjectData } from '../hooks/useProject';

export const LOW_STOCK_PREVIEW = 3;
export const RECENT_ACTIVITY_LIMIT = 5;

export interface DashboardInput {
  sites: Pick<Site, 'id' | 'leavePaid'>[];
  workers: LabourWorker[];
  attendance: AttendanceRecord[];
  advances: LabourAdvance[];
  salaryPayments: SalaryPayment[];
  materials: Material[];
  rodEntries: RodEntry[];
  stockMovements: StockMovement[];
  catalog: CatalogItem[];
  teaSnacks: TeaSnacksExpense[];
  poojas: PoojaExpense[];
  electricity: ElectricityBill[];
  water: WaterBill[];
  otherExpenses: OtherExpense[];
  activity: ActivityLog[];
  /** Optional: only the phone shows tools out. */
  toolAssets?: ToolAsset[];
  toolIssues?: ToolIssue[];
}

export type LowStockItem = StockItem & { siteId: string };

export interface DashboardSummary {
  today: string;
  presentToday: number;
  workerCount: number;
  /** Workers with no attendance marked today. */
  notMarkedToday: number;
  todaysExpenses: number;
  todaysExpenseCount: number;
  lowStockCount: number;
  /** Every low item, worst first (`lowStockTop` is the first three). */
  lowStockItems: LowStockItem[];
  lowStockTop: LowStockItem[];
  pendingSalary: number;
  recentActivity: ActivityLog[];
  toolsOut: number;
  toolsLate: number;
}

const ON_SITE = new Set(['present', 'overtime', 'half_day']);
const live = <T extends { isDeleted?: boolean }>(rows: T[]) => rows.filter(r => !r.isDeleted);

function groupBySite<T extends { siteId?: string }>(rows: T[]): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const r of rows) {
    const key = r.siteId || '';
    const list = out.get(key);
    if (list) list.push(r); else out.set(key, [r]);
  }
  return out;
}

/** Worst first: below zero, then out, then the smallest share of its low-stock level left. */
function lowStockOrder(a: StockItem, b: StockItem): number {
  const rank = (s: StockItem) => (s.onHand < 0 ? 0 : s.onHand === 0 ? 1 : 2);
  const share = (s: StockItem) => (s.lowStockThreshold ? s.onHand / s.lowStockThreshold : 1);
  return rank(a) - rank(b) || share(a) - share(b) || a.name.localeCompare(b.name);
}

export function buildDashboardSummary(input: DashboardInput, today: string): DashboardSummary {
  const workers = live(input.workers);
  const workerIds = new Set(workers.map(w => w.id));
  const attendance = live(input.attendance);

  // Today: one record per worker (duplicates removed), only workers still on the books.
  const todays = dedupeAttendance(attendance.filter(a => a.date === today && workerIds.has(a.workerId))).records;
  const presentToday = new Set(todays.filter(a => ON_SITE.has(a.status)).map(a => a.workerId)).size;
  const marked = new Set(todays.map(a => a.workerId)).size;

  const todaysRows = flattenExpenses({
    teaSnacks: input.teaSnacks, poojas: input.poojas, electricity: input.electricity, water: input.water, otherExpenses: input.otherExpenses,
  }).filter(e => e.date === today);
  const todaysExpenses = Math.round(todaysRows.reduce((s, e) => s + e.amount, 0) * 100) / 100;

  // Stock and salary are per project.
  const siteIds = new Set<string>([...input.sites.map(s => s.id)]);
  const bySite = {
    materials: groupBySite(live(input.materials)), rods: groupBySite(live(input.rodEntries)), moves: groupBySite(input.stockMovements),
    workers: groupBySite(workers), attendance: groupBySite(attendance), advances: groupBySite(live(input.advances)),
    payments: groupBySite(live(input.salaryPayments)),
  };
  for (const m of Object.values(bySite)) for (const k of m.keys()) siteIds.add(k);
  const catalog = live(input.catalog);
  const leavePaid = new Map(input.sites.map(s => [s.id, s.leavePaid]));

  const lowStockItems: LowStockItem[] = [];
  let pendingSalary = 0;
  for (const siteId of [...siteIds].sort()) {
    const stock = buildStock(bySite.materials.get(siteId) || [], bySite.rods.get(siteId) || [], bySite.moves.get(siteId) || [], catalog);
    for (const item of stock) if (item.isLowStock || item.onHand < 0) lowStockItems.push({ ...item, siteId });
    const siteWorkers = bySite.workers.get(siteId) || [];
    if (siteWorkers.length) {
      pendingSalary += buildSiteLabourSummary(
        siteWorkers, bySite.attendance.get(siteId) || [], bySite.advances.get(siteId) || [], bySite.payments.get(siteId) || [],
        { leavePaid: leavePaid.get(siteId) },
      ).pending;
    }
  }
  lowStockItems.sort(lowStockOrder);

  const recentActivity = [...input.activity]
    .sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || '') || b.id.localeCompare(a.id))
    .slice(0, RECENT_ACTIVITY_LIMIT);

  let toolsOut = 0;
  let toolsLate = 0;
  const issues = live(input.toolIssues || []);
  for (const tool of live(input.toolAssets || [])) {
    const st = buildToolStatus(tool, issues, today);
    toolsOut += st.issued;
    toolsLate += st.holders.filter(h => h.late).length;
  }

  return {
    today,
    presentToday,
    workerCount: workers.length,
    notMarkedToday: Math.max(0, workers.length - marked),
    todaysExpenses,
    todaysExpenseCount: todaysRows.length,
    lowStockCount: lowStockItems.length,
    lowStockItems,
    lowStockTop: lowStockItems.slice(0, LOW_STOCK_PREVIEW),
    pendingSalary: Math.round(pendingSalary * 100) / 100,
    recentActivity,
    toolsOut,
    toolsLate,
  };
}

/** The dashboard input for one open project (the phone Home screen). */
export function projectDashboardInput(project: ProjectData, catalog: CatalogItem[]): DashboardInput {
  return {
    sites: [project.site],
    workers: project.workers, attendance: project.attendance, advances: project.advances, salaryPayments: project.salaryPayments,
    materials: project.materials, rodEntries: project.rodEntries, stockMovements: project.stockMovements, catalog,
    teaSnacks: project.teaSnacks, poojas: project.poojas, electricity: project.electricity, water: project.water,
    otherExpenses: project.otherExpenses, activity: project.activity, toolAssets: project.toolAssets, toolIssues: project.toolIssues,
  };
}

// ---------------------------------------------------------------------------
// Which project the app opens on

/** Saved on this device: the project the user last had open. */
export const LAST_PROJECT_KEY = 'mistry_current_site';

type KeyStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function readLastProject(store: KeyStore | null | undefined): string | null {
  try { return store?.getItem(LAST_PROJECT_KEY) || null; } catch { return null; }
}

export function rememberLastProject(store: KeyStore | null | undefined, siteId: string | null): void {
  try {
    if (!store) return;
    if (siteId) store.setItem(LAST_PROJECT_KEY, siteId);
    else store.removeItem(LAST_PROJECT_KEY);
  } catch { /* storage unavailable: the app still opens on the first project */ }
}

/**
 * The project to open: the one last viewed if it still exists for this account, otherwise the
 * first Active project, otherwise the first project; null only when there are no projects.
 */
export function pickStartProject(sites: Pick<Site, 'id' | 'status'>[], savedId: string | null | undefined): string | null {
  if (savedId && sites.some(s => s.id === savedId)) return savedId;
  return (sites.find(s => s.status === 'Active') || sites[0])?.id || null;
}
