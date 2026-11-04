import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import type { Site, User } from '../db/types';
import { getCurrentUser } from '../services/auth';
import { calculateFinancialBalance } from '../utils/financial';

export interface SiteCardSummary {
  site: Site;
  totalExpense: number;
  totalPaid: number;
  balance: number;
  extraPaid: number;
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

export function useOverallStats(user?: User | null) {
  return useLiveQuery(async () => {
    const effectiveUser = user || getCurrentUser();
    const rawSites = effectiveUser
      ? await db.getSitesForUser(effectiveUser)
      : await db.sites.filter(s => !s.isDeleted).toArray();
    const sites = rawSites.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const siteIds = sites.map(s => s.id);
    const siteMap = new Map(sites.map(s => [s.id, s.name]));

    const [
      materials,
      rodEntries,
      workers,
      attendance,
      advances,
      salaryPayments,
      tools,
      teaSnacks,
      pooja,
      electricity,
      water,
      otherExpenses,
    ] = await Promise.all([
      db.materials.filter(m => !m.isDeleted && siteIds.includes(m.siteId)).toArray(),
      db.rodEntries.filter(r => !r.isDeleted && siteIds.includes(r.siteId)).toArray(),
      db.workers.filter(w => !w.isDeleted && siteIds.includes(w.siteId)).toArray(),
      db.attendance.filter(a => !a.isDeleted && siteIds.includes(a.siteId)).toArray(),
      db.labourAdvances.filter(a => !a.isDeleted && siteIds.includes(a.siteId)).toArray(),
      db.salaryPayments.filter(s => !s.isDeleted && siteIds.includes(s.siteId)).toArray(),
      db.tools.filter(t => !t.isDeleted && siteIds.includes(t.siteId)).toArray(),
      db.teaSnacksExpenses.filter(t => !t.isDeleted && siteIds.includes(t.siteId)).toArray(),
      db.poojaExpenses.filter(p => !p.isDeleted && siteIds.includes(p.siteId)).toArray(),
      db.electricityBills.filter(e => !e.isDeleted && siteIds.includes(e.siteId)).toArray(),
      db.waterBills.filter(w => !w.isDeleted && siteIds.includes(w.siteId)).toArray(),
      db.otherExpenses.filter(o => !o.isDeleted && siteIds.includes(o.siteId)).toArray(),
    ]);

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

    // Per-site calculations
    const siteSummaries: SiteCardSummary[] = sites.map(site => {
      const sMat = materials.filter(m => m.siteId === site.id);
      const sRods = rodEntries.filter(r => r.siteId === site.id);
      const matExp =
        sMat.reduce((acc, m) => acc + (Number(m.totalAmount) || 0), 0) +
        sRods.reduce((acc, r) => acc + (Number(r.totalAmount) || 0), 0);
      const matPd =
        sMat.reduce((acc, m) => acc + (Number(m.paidAmount) || 0), 0) +
        sRods.reduce((acc, r) => acc + (Number(r.paidAmount) || 0), 0);

      const sAtt = attendance.filter(a => a.siteId === site.id);
      let labGross = 0;
      sAtt.forEach(att => {
        const wage = workerWageMap.get(att.workerId) || 0;
        labGross += wage * (Number(att.dayMultiplier) || 0);
      });
      const sAdv = advances.filter(a => a.siteId === site.id).reduce((acc, a) => acc + (Number(a.amount) || 0), 0);
      const sSal = salaryPayments.filter(s => s.siteId === site.id).reduce((acc, s) => acc + (Number(s.paidAmount) || 0), 0);

      const sTools = tools.filter(t => t.siteId === site.id);
      const toolsExp = sTools.reduce((acc, t) => acc + (Number(t.cost) || 0), 0);
      const toolsPd = sTools.reduce((acc, t) => acc + (Number(t.paidAmount) || 0), 0);

      const sTea = teaSnacks.filter(t => t.siteId === site.id);
      const teaExp = sTea.reduce((acc, t) => acc + (Number(t.totalAmount) || 0), 0);
      const teaPd = sTea.reduce((acc, t) => acc + (Number(t.paidAmount) || 0), 0);

      const sPooja = pooja.filter(p => p.siteId === site.id);
      const poojaExp = sPooja.reduce((acc, p) => acc + (Number(p.totalAmount) || 0), 0);
      const poojaPd = sPooja.reduce((acc, p) => acc + (Number(p.paidAmount) || 0), 0);

      const sElec = electricity.filter(e => e.siteId === site.id);
      const elecExp = sElec.reduce((acc, e) => acc + (Number(e.billAmount) || 0), 0);
      const elecPd = sElec.reduce((acc, e) => acc + (Number(e.paidAmount) || 0), 0);

      const sWater = water.filter(w => w.siteId === site.id);
      const waterExp = sWater.reduce((acc, w) => acc + (Number(w.billAmount) || 0), 0);
      const waterPd = sWater.reduce((acc, w) => acc + (Number(w.paidAmount) || 0), 0);

      const sOther = otherExpenses.filter(o => o.siteId === site.id);
      const otherExp = sOther.reduce((acc, o) => acc + (Number(o.amount) || 0), 0);
      const otherPd = sOther.reduce((acc, o) => acc + (Number(o.paidAmount) || 0), 0);

      const totalExpense = matExp + labGross + toolsExp + teaExp + poojaExp + elecExp + waterExp + otherExp;
      const totalPaid = matPd + sAdv + sSal + toolsPd + teaPd + poojaPd + elecPd + waterPd + otherPd;
      const siteFin = calculateFinancialBalance(totalExpense, totalPaid);

      return {
        site,
        totalExpense,
        totalPaid,
        balance: siteFin.balanceDue,
        extraPaid: siteFin.extraPaid,
      };
    });

    // Recent Activities (compile from materials, rod, advances, tools, pooja, electricity, water)
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

    activities.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const recentActivities = activities.slice(0, 10);

    return {
      totalSites: sites.length,
      activeSites: sites.filter(s => s.status === 'Active').length,
      completedSites: sites.filter(s => s.status === 'Completed').length,
      onHoldSites: sites.filter(s => s.status === 'On Hold').length,
      planningSites: sites.filter(s => s.status === 'Planning').length,

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

      siteSummaries,
      recentActivities,
    };
  });
}
