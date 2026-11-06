import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import type { Site, User, BuildingEstimate, StockMovement, CatalogItem, FloorPlan } from '../db/types';
import { getCurrentUser } from '../services/auth';
import { calculateFinancialBalance } from '../utils/financial';
import { buildStock, calculateStockValue, type StockItem } from '../domain/stock';
import { todayKey, monthKeyOf, addMonths, DEFAULT_TIME_ZONE } from '../utils/datetime';

export interface SiteCardSummary {
  site: Site;
  totalExpense: number;
  totalPaid: number;
  balance: number;
  extraPaid: number;
  budget?: number;
  progressPercentage: number;
  workerCount: number;
  materialCount: number;
}

export interface RecentActivity {
  id: string;
  type: string;
  title: string;
  description: string;
  amount?: number;
  siteName: string;
  siteId: string;
  date: string;
}

export interface AttendanceTodayStats {
  totalWorkers: number;
  present: number;
  halfDay: number;
  leave: number;
  absent: number;
  overtime: number;
  totalMarked: number;
  unmarked: number;
  attendanceRate: number;
}

export interface MaterialStockStats {
  totalMaterialsCount: number;
  totalStockValue: number;
  pendingPurchasesValue: number;
  inStockCount: number;
  lowStockCount: number;
  negativeCount: number;
  lowStockItems: StockItem[];
}

export interface MonthlyTrendItem {
  monthKey: string;
  label: string;
  expense: number;
  paid: number;
}

export interface CategoryExpenseItem {
  key: string;
  label: string;
  amount: number;
  percentage: number;
  color: string;
}

export function useOverallStats(user?: User | null, selectedSiteId?: string | null) {
  return useLiveQuery(async () => {
    const effectiveUser = user || getCurrentUser();
    const rawSites = effectiveUser
      ? await db.getSitesForUser(effectiveUser)
      : await db.sites.filter(s => !s.isDeleted).toArray();
    const sites = rawSites.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const siteIds = sites.map(s => s.id);
    const siteIdSet = new Set(siteIds);
    const shouldIncludeAll = siteIds.length === 0;
    const siteMap = new Map(sites.map(s => [s.id, s.name]));

    const [
      allMaterials,
      allRodEntries,
      allWorkers,
      allAttendance,
      allAdvances,
      allSalaryPayments,
      allTools,
      allTeaSnacks,
      allPooja,
      allElectricity,
      allWater,
      allOtherExpenses,
      allStockMovements,
      catalogItems,
      allEstimates,
      allFloorPlans,
    ] = await Promise.all([
      db.materials.filter(m => !m.isDeleted && (shouldIncludeAll || !m.siteId || siteIdSet.has(m.siteId))).toArray(),
      db.rodEntries.filter(r => !r.isDeleted && (shouldIncludeAll || !r.siteId || siteIdSet.has(r.siteId))).toArray(),
      db.workers.filter(w => !w.isDeleted && (shouldIncludeAll || !w.siteId || siteIdSet.has(w.siteId))).toArray(),
      db.attendance.filter(a => !a.isDeleted && (shouldIncludeAll || !a.siteId || siteIdSet.has(a.siteId))).toArray(),
      db.labourAdvances.filter(a => !a.isDeleted && (shouldIncludeAll || !a.siteId || siteIdSet.has(a.siteId))).toArray(),
      db.salaryPayments.filter(s => !s.isDeleted && (shouldIncludeAll || !s.siteId || siteIdSet.has(s.siteId))).toArray(),
      db.tools.filter(t => !t.isDeleted && (shouldIncludeAll || !t.siteId || siteIdSet.has(t.siteId))).toArray(),
      db.teaSnacksExpenses.filter(t => !t.isDeleted && (shouldIncludeAll || !t.siteId || siteIdSet.has(t.siteId))).toArray(),
      db.poojaExpenses.filter(p => !p.isDeleted && (shouldIncludeAll || !p.siteId || siteIdSet.has(p.siteId))).toArray(),
      db.electricityBills.filter(e => !e.isDeleted && (shouldIncludeAll || !e.siteId || siteIdSet.has(e.siteId))).toArray(),
      db.waterBills.filter(w => !w.isDeleted && (shouldIncludeAll || !w.siteId || siteIdSet.has(w.siteId))).toArray(),
      db.otherExpenses.filter(o => !o.isDeleted && (shouldIncludeAll || !o.siteId || siteIdSet.has(o.siteId))).toArray(),
      db.stockMovements.filter(s => !s.isDeleted && (shouldIncludeAll || !s.siteId || siteIdSet.has(s.siteId))).toArray(),
      db.catalogItems.filter(c => !c.isDeleted).toArray(),
      db.estimates.filter(e => !e.isDeleted).toArray(),
      db.floorPlans.filter(f => !f.isDeleted).toArray(),
    ]);

    const isSiteFiltered = !!selectedSiteId && selectedSiteId !== 'all';
    const siteMatches = (recordSiteId?: string) => !isSiteFiltered || recordSiteId === selectedSiteId;

    const materials = isSiteFiltered ? allMaterials.filter(m => siteMatches(m.siteId)) : allMaterials;
    const rodEntries = isSiteFiltered ? allRodEntries.filter(r => siteMatches(r.siteId)) : allRodEntries;
    const workers = isSiteFiltered ? allWorkers.filter(w => siteMatches(w.siteId)) : allWorkers;
    const attendance = isSiteFiltered ? allAttendance.filter(a => siteMatches(a.siteId)) : allAttendance;
    const advances = isSiteFiltered ? allAdvances.filter(a => siteMatches(a.siteId)) : allAdvances;
    const salaryPayments = isSiteFiltered ? allSalaryPayments.filter(s => siteMatches(s.siteId)) : allSalaryPayments;
    const tools = isSiteFiltered ? allTools.filter(t => siteMatches(t.siteId)) : allTools;
    const teaSnacks = isSiteFiltered ? allTeaSnacks.filter(t => siteMatches(t.siteId)) : allTeaSnacks;
    const pooja = isSiteFiltered ? allPooja.filter(p => siteMatches(p.siteId)) : allPooja;
    const electricity = isSiteFiltered ? allElectricity.filter(e => siteMatches(e.siteId)) : allElectricity;
    const water = isSiteFiltered ? allWater.filter(w => siteMatches(w.siteId)) : allWater;
    const otherExpenses = isSiteFiltered ? allOtherExpenses.filter(o => siteMatches(o.siteId)) : allOtherExpenses;
    const stockMovements = isSiteFiltered ? allStockMovements.filter(s => siteMatches(s.siteId)) : allStockMovements;
    const estimates = isSiteFiltered ? allEstimates.filter(e => siteMatches(e.siteId)) : allEstimates;
    const floorPlans = isSiteFiltered ? allFloorPlans.filter(f => siteMatches(f.siteId)) : allFloorPlans;

    // Worker wage mapping
    const workerWageMap = new Map(workers.map(w => [w.id, Number(w.dailyWage) || 0]));

    // Aggregates across all sites
    const totalMaterialExpense =
      materials.reduce((acc, m) => acc + (Number(m.totalAmount) || 0), 0) +
      rodEntries.reduce((acc, r) => acc + (Number(r.totalAmount) || 0), 0);
    const materialPaid =
      materials.reduce((acc, m) => acc + (Number(m.paidAmount) || 0), 0) +
      rodEntries.reduce((acc, r) => acc + (Number(r.paidAmount) || 0), 0);

    let totalLabourGross = 0;
    attendance.forEach(att => {
      const wage = workerWageMap.get(att.workerId) || 0;
      totalLabourGross += wage * (Number(att.dayMultiplier) || 0);
    });

    const totalAdvances = advances.reduce((acc, a) => acc + (Number(a.amount) || 0), 0);
    const labourPaid = salaryPayments.reduce((acc, s) => acc + (Number(s.paidAmount) || 0), 0);

    const totalToolsExpense = tools.reduce((acc, t) => acc + (Number(t.cost) || 0), 0);
    const toolsPaid = tools.reduce((acc, t) => acc + (Number(t.paidAmount) || 0), 0);

    const totalTeaSnacksExpense = teaSnacks.reduce((acc, t) => acc + (Number(t.totalAmount) || 0), 0);
    const teaSnacksPaid = teaSnacks.reduce((acc, t) => acc + (Number(t.paidAmount) || 0), 0);

    const totalPoojaExpense = pooja.reduce((acc, p) => acc + (Number(p.totalAmount) || 0), 0);
    const poojaPaid = pooja.reduce((acc, p) => acc + (Number(p.paidAmount) || 0), 0);

    const totalElectricityExpense = electricity.reduce((acc, e) => acc + (Number(e.billAmount) || 0), 0);
    const electricityPaid = electricity.reduce((acc, e) => acc + (Number(e.paidAmount) || 0), 0);

    const totalWaterExpense = water.reduce((acc, w) => acc + (Number(w.billAmount) || 0), 0);
    const waterPaid = water.reduce((acc, w) => acc + (Number(w.paidAmount) || 0), 0);

    const totalOtherExpense = otherExpenses.reduce((acc, o) => acc + (Number(o.amount) || 0), 0);
    const otherPaid = otherExpenses.reduce((acc, o) => acc + (Number(o.paidAmount) || 0), 0);

    const overallExpense =
      totalMaterialExpense +
      totalLabourGross +
      totalToolsExpense +
      totalTeaSnacksExpense +
      totalPoojaExpense +
      totalElectricityExpense +
      totalWaterExpense +
      totalOtherExpense;

    const overallPaid =
      materialPaid +
      totalAdvances +
      labourPaid +
      toolsPaid +
      teaSnacksPaid +
      poojaPaid +
      electricityPaid +
      waterPaid +
      otherPaid;

    const overallFin = calculateFinancialBalance(overallExpense, overallPaid);
    const overallBalance = overallFin.balanceDue;
    const overallExtraPaid = overallFin.extraPaid;

    // Estimates mapping by siteId
    const siteEstimateMap = new Map<string, BuildingEstimate>();
    estimates.forEach(est => {
      if (est.siteId) {
        const existing = siteEstimateMap.get(est.siteId);
        if (!existing || new Date(est.updatedAt || est.createdAt) > new Date(existing.updatedAt || existing.createdAt)) {
          siteEstimateMap.set(est.siteId, est);
        }
      }
    });

    const totalBudget = Array.from(siteEstimateMap.values()).reduce(
      (sum, est) => sum + (Number(est.totalEstimatedCost) || 0),
      0
    );
    const remainingBudget = totalBudget > 0 ? Math.max(0, totalBudget - overallExpense) : undefined;

    // Stock building and alerts
    const stockItems = buildStock(materials, rodEntries, stockMovements, catalogItems);
    const lowStockItems = stockItems.filter(s => s.isLowStock || s.isNegative);
    const inStockCount = stockItems.filter(s => s.onHand > 0).length;
    const negativeCount = stockItems.filter(s => s.isNegative).length;
    const stockValueSummary = calculateStockValue(materials, rodEntries);

    const materialStock: MaterialStockStats = {
      totalMaterialsCount: stockValueSummary.totalMaterialsCount,
      totalStockValue: stockValueSummary.totalStockValue,
      pendingPurchasesValue: stockValueSummary.pendingPurchasesValue,
      inStockCount,
      lowStockCount: lowStockItems.length,
      negativeCount,
      lowStockItems,
    };

    // Attendance Today calculations (Asia/Kolkata timezone)
    const today = todayKey(DEFAULT_TIME_ZONE);
    const todaysAttendance = attendance.filter(a => a.date === today);
    const present = todaysAttendance.filter(a => a.status === 'present').length;
    const halfDay = todaysAttendance.filter(a => a.status === 'half_day').length;
    const leave = todaysAttendance.filter(a => a.status === 'leave').length;
    const absent = todaysAttendance.filter(a => a.status === 'absent').length;
    const overtime = todaysAttendance.filter(a => a.status === 'overtime').length;

    const markedWorkerIds = new Set(todaysAttendance.map(a => a.workerId));
    const totalWorkers = workers.length;
    const totalMarked = markedWorkerIds.size;
    const unmarked = Math.max(0, totalWorkers - totalMarked);
    const attendanceEffective = present + overtime + halfDay * 0.5;
    const attendanceRate = totalWorkers > 0 ? Math.round((attendanceEffective / totalWorkers) * 100) : 0;

    const attendanceToday: AttendanceTodayStats = {
      totalWorkers,
      present,
      halfDay,
      leave,
      absent,
      overtime,
      totalMarked,
      unmarked,
      attendanceRate,
    };

    // Category Expense Breakdown with percentages
    const categoryExpenses: CategoryExpenseItem[] = [
      { key: 'materials', label: 'Materials', amount: totalMaterialExpense, percentage: 0, color: '#f59e0b' },
      { key: 'labour', label: 'Labour Wages', amount: totalLabourGross, percentage: 0, color: '#10b981' },
      { key: 'tools', label: 'Tools & Rentals', amount: totalToolsExpense, percentage: 0, color: '#3b82f6' },
      { key: 'teaSnacks', label: 'Tea & Snacks', amount: totalTeaSnacksExpense, percentage: 0, color: '#eab308' },
      { key: 'pooja', label: 'Pooja', amount: totalPoojaExpense, percentage: 0, color: '#8b5cf6' },
      { key: 'electricity', label: 'Electricity', amount: totalElectricityExpense, percentage: 0, color: '#475569' },
      { key: 'water', label: 'Water', amount: totalWaterExpense, percentage: 0, color: '#06b6d4' },
      { key: 'other', label: 'Other', amount: totalOtherExpense, percentage: 0, color: '#6366f1' },
    ];
    if (overallExpense > 0) {
      categoryExpenses.forEach(c => {
        c.percentage = Math.round((c.amount / overallExpense) * 100);
      });
    }

    // Monthly Expense Trends (past 6 months)
    const currentMonthKey = monthKeyOf(today);
    const monthKeys: string[] = [];
    for (let i = 5; i >= 0; i--) {
      monthKeys.push(addMonths(currentMonthKey, -i));
    }

    const monthMap = new Map<string, { expense: number; paid: number }>();
    monthKeys.forEach(k => monthMap.set(k, { expense: 0, paid: 0 }));

    const recordExpenseMonth = (dateStr: string | undefined, exp: number, pd: number) => {
      if (!dateStr) return;
      const mKey = dateStr.slice(0, 7);
      if (monthMap.has(mKey)) {
        const item = monthMap.get(mKey)!;
        item.expense += exp;
        item.paid += pd;
      }
    };

    materials.forEach(m => recordExpenseMonth(m.purchaseDate || m.createdAt, Number(m.totalAmount) || 0, Number(m.paidAmount) || 0));
    rodEntries.forEach(r => recordExpenseMonth(r.purchaseDate || r.createdAt, Number(r.totalAmount) || 0, Number(r.paidAmount) || 0));
    tools.forEach(t => recordExpenseMonth(t.purchaseDate || t.createdAt, Number(t.cost) || 0, Number(t.paidAmount) || 0));
    teaSnacks.forEach(t => recordExpenseMonth(t.date || t.createdAt, Number(t.totalAmount) || 0, Number(t.paidAmount) || 0));
    pooja.forEach(p => recordExpenseMonth(p.date || p.createdAt, Number(p.totalAmount) || 0, Number(p.paidAmount) || 0));
    electricity.forEach(e => recordExpenseMonth(e.dueDate || e.month || e.createdAt, Number(e.billAmount) || 0, Number(e.paidAmount) || 0));
    water.forEach(w => recordExpenseMonth(w.date || w.createdAt, Number(w.billAmount) || 0, Number(w.paidAmount) || 0));
    otherExpenses.forEach(o => recordExpenseMonth(o.date || o.createdAt, Number(o.amount) || 0, Number(o.paidAmount) || 0));
    salaryPayments.forEach(s => recordExpenseMonth(s.date || s.createdAt, 0, Number(s.paidAmount) || 0));
    advances.forEach(a => recordExpenseMonth(a.date || a.createdAt, 0, Number(a.amount) || 0));
    attendance.forEach(a => {
      const wage = workerWageMap.get(a.workerId) || 0;
      const earned = wage * (Number(a.dayMultiplier) || 0);
      recordExpenseMonth(a.date || a.createdAt, earned, 0);
    });

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthlyTrends: MonthlyTrendItem[] = monthKeys.map(k => {
      const [y, m] = k.split('-').map(Number);
      const label = `${monthNames[m - 1]} '${String(y).slice(2)}`;
      const val = monthMap.get(k) || { expense: 0, paid: 0 };
      return {
        monthKey: k,
        label,
        expense: Math.round(val.expense),
        paid: Math.round(val.paid),
      };
    });

    // Per-site calculations
    const siteSummaries: SiteCardSummary[] = sites.map(site => {
      const sMat = allMaterials.filter(m => m.siteId === site.id);
      const sRods = allRodEntries.filter(r => r.siteId === site.id);
      const matExp =
        sMat.reduce((acc, m) => acc + (Number(m.totalAmount) || 0), 0) +
        sRods.reduce((acc, r) => acc + (Number(r.totalAmount) || 0), 0);
      const matPd =
        sMat.reduce((acc, m) => acc + (Number(m.paidAmount) || 0), 0) +
        sRods.reduce((acc, r) => acc + (Number(r.paidAmount) || 0), 0);

      const sAtt = allAttendance.filter(a => a.siteId === site.id);
      let labGross = 0;
      sAtt.forEach(att => {
        const wage = workerWageMap.get(att.workerId) || 0;
        labGross += wage * (Number(att.dayMultiplier) || 0);
      });
      const sAdv = allAdvances.filter(a => a.siteId === site.id).reduce((acc, a) => acc + (Number(a.amount) || 0), 0);
      const sSal = allSalaryPayments.filter(s => s.siteId === site.id).reduce((acc, s) => acc + (Number(s.paidAmount) || 0), 0);

      const sTools = allTools.filter(t => t.siteId === site.id);
      const toolsExp = sTools.reduce((acc, t) => acc + (Number(t.cost) || 0), 0);
      const toolsPd = sTools.reduce((acc, t) => acc + (Number(t.paidAmount) || 0), 0);

      const sTea = allTeaSnacks.filter(t => t.siteId === site.id);
      const teaExp = sTea.reduce((acc, t) => acc + (Number(t.totalAmount) || 0), 0);
      const teaPd = sTea.reduce((acc, t) => acc + (Number(t.paidAmount) || 0), 0);

      const sPooja = allPooja.filter(p => p.siteId === site.id);
      const poojaExp = sPooja.reduce((acc, p) => acc + (Number(p.totalAmount) || 0), 0);
      const poojaPd = sPooja.reduce((acc, p) => acc + (Number(p.paidAmount) || 0), 0);

      const sElec = allElectricity.filter(e => e.siteId === site.id);
      const elecExp = sElec.reduce((acc, e) => acc + (Number(e.billAmount) || 0), 0);
      const elecPd = sElec.reduce((acc, e) => acc + (Number(e.paidAmount) || 0), 0);

      const sWater = allWater.filter(w => w.siteId === site.id);
      const waterExp = sWater.reduce((acc, w) => acc + (Number(w.billAmount) || 0), 0);
      const waterPd = sWater.reduce((acc, w) => acc + (Number(w.paidAmount) || 0), 0);

      const sOther = allOtherExpenses.filter(o => o.siteId === site.id);
      const otherExp = sOther.reduce((acc, o) => acc + (Number(o.amount) || 0), 0);
      const otherPd = sOther.reduce((acc, o) => acc + (Number(o.paidAmount) || 0), 0);

      const totalExpense = matExp + labGross + toolsExp + teaExp + poojaExp + elecExp + waterExp + otherExp;
      const totalPaid = matPd + sAdv + sSal + toolsPd + teaPd + poojaPd + elecPd + waterPd + otherPd;
      const siteFin = calculateFinancialBalance(totalExpense, totalPaid);

      const siteEstimate = siteEstimateMap.get(site.id);
      const budget = siteEstimate ? Number(siteEstimate.totalEstimatedCost) : undefined;

      // Progress percentage
      let progressPercentage = 0;
      if (site.status === 'Completed') {
        progressPercentage = 100;
      } else if (site.status === 'Planning') {
        progressPercentage = 10;
      } else if (budget && budget > 0) {
        progressPercentage = Math.min(95, Math.round((totalExpense / budget) * 100));
      } else if (site.status === 'Active') {
        // Calculate based on start and expected completion dates if available
        if (site.startDate && site.expectedCompletionDate) {
          const start = new Date(site.startDate).getTime();
          const end = new Date(site.expectedCompletionDate).getTime();
          const now = Date.now();
          if (end > start) {
            const elapsed = Math.max(0, Math.min(1, (now - start) / (end - start)));
            progressPercentage = Math.round(elapsed * 90);
          } else {
            progressPercentage = 45;
          }
        } else {
          progressPercentage = 40;
        }
      } else if (site.status === 'On Hold') {
        progressPercentage = 25;
      }

      const sWorkers = allWorkers.filter(w => w.siteId === site.id);

      return {
        site,
        totalExpense,
        totalPaid,
        balance: siteFin.balanceDue,
        extraPaid: siteFin.extraPaid,
        budget,
        progressPercentage,
        workerCount: sWorkers.length,
        materialCount: sMat.length + sRods.length,
      };
    });

    // Recent Activities
    const activities: RecentActivity[] = [];

    materials.forEach(m => {
      activities.push({
        id: m.id,
        type: 'material',
        title: `Material: ${m.materialName || m.category.toUpperCase()}`,
        description: `${m.quantity} ${m.unit} from ${m.supplier}`,
        amount: m.totalAmount,
        siteName: siteMap.get(m.siteId) || 'Site',
        siteId: m.siteId,
        date: m.purchaseDate || m.createdAt,
      });
    });

    rodEntries.forEach(r => {
      activities.push({
        id: r.id,
        type: 'rod',
        title: `Steel Rod: ${r.diameter}`,
        description: `${r.weightKg} kg from ${r.supplier}`,
        amount: r.totalAmount,
        siteName: siteMap.get(r.siteId) || 'Site',
        siteId: r.siteId,
        date: r.purchaseDate || r.createdAt,
      });
    });

    advances.forEach(a => {
      activities.push({
        id: a.id,
        type: 'advance',
        title: `Labour Advance Given`,
        description: a.reason ? `Reason: ${a.reason}` : 'Advance paid',
        amount: a.amount,
        siteName: siteMap.get(a.siteId) || 'Site',
        siteId: a.siteId,
        date: a.date || a.createdAt,
      });
    });

    tools.forEach(t => {
      activities.push({
        id: t.id,
        type: 'tool',
        title: `Tool: ${t.toolName}`,
        description: `${t.type} (Qty: ${t.quantity})`,
        amount: t.cost,
        siteName: siteMap.get(t.siteId) || 'Site',
        siteId: t.siteId,
        date: t.purchaseDate || t.createdAt,
      });
    });

    pooja.forEach(p => {
      activities.push({
        id: p.id,
        type: 'pooja',
        title: `Pooja: ${p.poojaName}`,
        description: `Materials: ₹${p.materialsExpense} | Priest: ₹${p.priestExpense}`,
        amount: p.totalAmount,
        siteName: siteMap.get(p.siteId) || 'Site',
        siteId: p.siteId,
        date: p.date || p.createdAt,
      });
    });

    otherExpenses.forEach(o => {
      activities.push({
        id: o.id,
        type: 'other',
        title: `${o.category}: ${o.description.slice(0, 30)}`,
        description: `Paid: ₹${o.paidAmount} | Bal: ₹${o.balance}`,
        amount: o.amount,
        siteName: siteMap.get(o.siteId) || 'Site',
        siteId: o.siteId,
        date: o.date || o.createdAt,
      });
    });

    const activitySites = isSiteFiltered ? sites.filter(s => s.id === selectedSiteId) : sites;
    activitySites.forEach(s => {
      activities.push({
        id: `site-create-${s.id}`,
        type: 'project',
        title: `Project: ${s.name}`,
        description: `${s.status} • ${s.area || s.address || 'Address'} • Owner: ${s.ownerName}`,
        siteName: s.name,
        siteId: s.id,
        date: s.createdAt,
      });
    });

    floorPlans.forEach(fp => {
      if (fp.siteId && siteMap.has(fp.siteId)) {
        activities.push({
          id: `fp-${fp.id}`,
          type: 'floorplan',
          title: `Floor Plan: ${fp.buildingName || 'Building'} (${fp.floorName || 'Plan'})`,
          description: `Rooms: ${fp.rooms?.length || 0} • Walls: ${fp.walls?.length || 0}`,
          siteName: siteMap.get(fp.siteId) || 'Site',
          siteId: fp.siteId,
          date: fp.updatedAt || fp.createdAt,
        });
      }
    });

    activities.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const recentActivities = activities.slice(0, 15);

    return {
      totalSites: sites.length,
      activeSites: sites.filter(s => s.status === 'Active').length,
      completedSites: sites.filter(s => s.status === 'Completed').length,
      onHoldSites: sites.filter(s => s.status === 'On Hold').length,
      planningSites: sites.filter(s => s.status === 'Planning').length,

      totalWorkers,
      attendanceToday,
      materialStock,

      totalMaterialExpense,
      totalLabourExpense: totalLabourGross,
      totalToolsExpense,
      totalTeaSnacksExpense,
      totalPoojaExpense,
      totalElectricityExpense,
      totalWaterExpense,
      totalOtherExpense,

      overallExpense,
      overallPaid,
      overallBalance,
      overallExtraPaid,
      totalBudget,
      remainingBudget,

      categoryExpenses,
      monthlyTrends,

      siteSummaries,
      recentActivities,
      allSites: sites,
      filteredSiteId: isSiteFiltered ? (selectedSiteId || null) : null,
      filteredSiteName: isSiteFiltered && selectedSiteId ? (siteMap.get(selectedSiteId) || 'Selected Site') : null,
    };
  });
}
