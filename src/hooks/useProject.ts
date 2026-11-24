import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import type {
  ActivityLog, AttendanceRecord, ElectricityBill, LabourAdvance, LabourWorker, Material, OtherExpense,
  PaymentTransaction, PoojaExpense, RodEntry, SalaryPayment, Site, StockMovement, TeaSnacksExpense, ToolAsset, ToolIssue, ToolItem, WaterBill,
} from '../db/types';

export interface ProjectData {
  site: Site;
  workers: LabourWorker[];
  attendance: AttendanceRecord[];
  advances: LabourAdvance[];
  salaryPayments: SalaryPayment[];
  materials: Material[];
  rodEntries: RodEntry[];
  stockMovements: StockMovement[];   // includes voided rows, for history
  toolAssets: ToolAsset[];
  toolIssues: ToolIssue[];
  toolCosts: ToolItem[];
  teaSnacks: TeaSnacksExpense[];
  poojas: PoojaExpense[];
  electricity: ElectricityBill[];
  water: WaterBill[];
  otherExpenses: OtherExpense[];
  payments: PaymentTransaction[];    // every rupee actually paid out, by date
  activity: ActivityLog[];
}

/**
 * Live, non-deleted records of one project. `undefined` while loading, `null` when the
 * project does not exist (or was moved to the Recycle Bin).
 */
export function useProject(siteId: string | null | undefined): ProjectData | null | undefined {
  return useLiveQuery(async () => {
    if (!siteId) return null;
    const site = await db.sites.get(siteId);
    if (!site || site.isDeleted) return null;

    const live = <T extends { isDeleted: boolean }>(rows: T[]) => rows.filter(r => !r.isDeleted);
    const bySite = <T,>(table: { where(index: string): { equals(v: string): { toArray(): Promise<T[]> } } }) =>
      table.where('siteId').equals(siteId).toArray();

    const [
      workers, attendance, advances, salaryPayments, materials, rodEntries, stockMovements, toolAssets, toolIssues,
      toolCosts, teaSnacks, poojas, electricity, water, otherExpenses, activity, payments,
    ] = await Promise.all([
      bySite<LabourWorker>(db.workers), bySite<AttendanceRecord>(db.attendance), bySite<LabourAdvance>(db.labourAdvances),
      bySite<SalaryPayment>(db.salaryPayments), bySite<Material>(db.materials), bySite<RodEntry>(db.rodEntries),
      bySite<StockMovement>(db.stockMovements), bySite<ToolAsset>(db.toolAssets), bySite<ToolIssue>(db.toolIssues),
      bySite<ToolItem>(db.tools), bySite<TeaSnacksExpense>(db.teaSnacksExpenses), bySite<PoojaExpense>(db.poojaExpenses),
      bySite<ElectricityBill>(db.electricityBills), bySite<WaterBill>(db.waterBills), bySite<OtherExpense>(db.otherExpenses),
      bySite<ActivityLog>(db.activityLogs), bySite<PaymentTransaction>(db.payments),
    ]);

    return {
      site,
      workers: live(workers).sort((a, b) => a.name.localeCompare(b.name)),
      attendance: live(attendance),
      advances: live(advances),
      salaryPayments: live(salaryPayments),
      materials: live(materials),
      rodEntries: live(rodEntries),
      stockMovements,
      toolAssets: live(toolAssets).sort((a, b) => a.name.localeCompare(b.name)),
      toolIssues: live(toolIssues),
      toolCosts: live(toolCosts),
      teaSnacks: live(teaSnacks),
      poojas: live(poojas),
      electricity: live(electricity),
      water: live(water),
      otherExpenses: live(otherExpenses),
      payments: live(payments),
      activity: activity.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || '')).slice(0, 40),
    };
  }, [siteId]);
}
