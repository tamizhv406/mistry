import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import type { SiteFinancialSummary } from '../db/types';
import { calculateFinancialBalance } from '../utils/financial';

export type { SiteFinancialSummary };

export function useSiteData(siteId: string | null | undefined) {
  return useLiveQuery(async () => {
    if (!siteId) return null;

    const site = await db.sites.get(siteId);
    if (!site || site.isDeleted) return null;

    // 1. Materials & Rods
    const materials = await db.materials.where('siteId').equals(siteId).filter(m => !m.isDeleted).toArray();
    const rodEntries = await db.rodEntries.where('siteId').equals(siteId).filter(r => !r.isDeleted).toArray();

    const matTotal = materials.reduce((acc, m) => acc + (Number(m.totalAmount) || 0), 0) +
      rodEntries.reduce((acc, r) => acc + (Number(r.totalAmount) || 0), 0);
    const matPaid = materials.reduce((acc, m) => acc + (Number(m.paidAmount) || 0), 0) +
      rodEntries.reduce((acc, r) => acc + (Number(r.paidAmount) || 0), 0);
    const matFin = calculateFinancialBalance(matTotal, matPaid);

    // 2. Labour (Workers, Attendance, Advances, Salary Payments)
    const workers = await db.workers.where('siteId').equals(siteId).filter(w => !w.isDeleted).toArray();
    const attendance = await db.attendance.where('siteId').equals(siteId).filter(a => !a.isDeleted).toArray();
    const advances = await db.labourAdvances.where('siteId').equals(siteId).filter(a => !a.isDeleted).toArray();
    const salaryPayments = await db.salaryPayments.where('siteId').equals(siteId).filter(s => !s.isDeleted).toArray();

    // Calculate labour gross earnings based on attendance
    const workerWageMap = new Map(workers.map(w => [w.id, Number(w.dailyWage) || 0]));
    
    let calculatedGrossWage = 0;
    attendance.forEach(att => {
      const wage = workerWageMap.get(att.workerId) || 0;
      calculatedGrossWage += wage * (Number(att.dayMultiplier) || 0);
    });

    // Separate Recoverable vs Non-Recoverable Advances
    // Recoverable advance: Include it in salary deduction/balance calculations.
    // No Return / Non-Recoverable: Never deduct it from salary!
    const recoverableAdvances = advances
      .filter(a => a.advanceType === 'Recoverable')
      .reduce((acc, a) => acc + (Number(a.amount) || 0), 0);

    const nonRecoverableAdvances = advances
      .filter(a => a.advanceType !== 'Recoverable')
      .reduce((acc, a) => acc + (Number(a.amount) || 0), 0);

    const totalAdvances = recoverableAdvances + nonRecoverableAdvances;
    const labourPaid = salaryPayments.reduce((acc, s) => acc + (Number(s.paidAmount) || 0), 0);

    // Net payable wages = Gross Wage - Recoverable Advances
    const netSalaryPayable = Math.max(0, calculatedGrossWage - recoverableAdvances);
    const labourFin = calculateFinancialBalance(netSalaryPayable, labourPaid);

    // 3. Tools
    const tools = await db.tools.where('siteId').equals(siteId).filter(t => !t.isDeleted).toArray();
    const toolsCost = tools.reduce((acc, t) => acc + (Number(t.cost) || 0), 0);
    const toolsPaid = tools.reduce((acc, t) => acc + (Number(t.paidAmount) || 0), 0);
    const toolsFin = calculateFinancialBalance(toolsCost, toolsPaid);

    // 4. Tea & Snacks
    const teaSnacks = await db.teaSnacksExpenses.where('siteId').equals(siteId).filter(t => !t.isDeleted).toArray();
    const teaSnacksCost = teaSnacks.reduce((acc, t) => acc + (Number(t.totalAmount) || 0), 0);
    const teaSnacksPaid = teaSnacks.reduce((acc, t) => acc + (Number(t.paidAmount) || 0), 0);
    const teaSnacksFin = calculateFinancialBalance(teaSnacksCost, teaSnacksPaid);

    // 5. Pooja
    const poojas = await db.poojaExpenses.where('siteId').equals(siteId).filter(p => !p.isDeleted).toArray();
    const poojaCost = poojas.reduce((acc, p) => acc + (Number(p.totalAmount) || 0), 0);
    const poojaPaid = poojas.reduce((acc, p) => acc + (Number(p.paidAmount) || 0), 0);
    const poojaFin = calculateFinancialBalance(poojaCost, poojaPaid);

    // 6. Electricity
    const electricity = await db.electricityBills.where('siteId').equals(siteId).filter(e => !e.isDeleted).toArray();
    const electricityCost = electricity.reduce((acc, e) => acc + (Number(e.billAmount) || 0), 0);
    const electricityPaid = electricity.reduce((acc, e) => acc + (Number(e.paidAmount) || 0), 0);
    const electricityFin = calculateFinancialBalance(electricityCost, electricityPaid);

    // 7. Water
    const water = await db.waterBills.where('siteId').equals(siteId).filter(w => !w.isDeleted).toArray();
    const waterCost = water.reduce((acc, w) => acc + (Number(w.billAmount) || 0), 0);
    const waterPaid = water.reduce((acc, w) => acc + (Number(w.paidAmount) || 0), 0);
    const waterFin = calculateFinancialBalance(waterCost, waterPaid);

    // 8. Other Expenses
    const otherExpenses = await db.otherExpenses.where('siteId').equals(siteId).filter(o => !o.isDeleted).toArray();
    const otherCost = otherExpenses.reduce((acc, o) => acc + (Number(o.amount) || 0), 0);
    const otherPaid = otherExpenses.reduce((acc, o) => acc + (Number(o.paidAmount) || 0), 0);
    const otherFin = calculateFinancialBalance(otherCost, otherPaid);

    // 9. Site Comments
    const comments = await db.siteComments.where('siteId').equals(siteId).filter(c => !c.isDeleted).toArray();

    // 10. Payment Transactions History
    const payments = await db.payments.where('siteId').equals(siteId).filter(p => !p.isDeleted).toArray();

    // Overall Totals
    const totalCost = matTotal + calculatedGrossWage + toolsCost + teaSnacksCost + poojaCost + electricityCost + waterCost + otherCost;
    // Total cash out = matPaid + totalAdvances + labourPaid + toolsPaid + teaSnacksPaid + poojaPaid + electricityPaid + waterPaid + otherPaid
    const totalPaid = matPaid + totalAdvances + labourPaid + toolsPaid + teaSnacksPaid + poojaPaid + electricityPaid + waterPaid + otherPaid;
    const overallFin = calculateFinancialBalance(totalCost, totalPaid);

    const summary: SiteFinancialSummary = {
      materialCost: matTotal,
      materialPaid: matPaid,
      materialBalance: matFin.balanceDue,
      materialExtraPaid: matFin.extraPaid,

      labourGrossSalary: calculatedGrossWage,
      labourPaid: labourPaid,
      labourAdvances: totalAdvances,
      labourBalance: labourFin.balanceDue,
      labourExtraPaid: labourFin.extraPaid,

      toolsCost,
      toolsPaid,
      toolsBalance: toolsFin.balanceDue,
      toolsExtraPaid: toolsFin.extraPaid,

      teaSnacksCost,
      teaSnacksPaid,
      teaSnacksBalance: teaSnacksFin.balanceDue,
      teaSnacksExtraPaid: teaSnacksFin.extraPaid,

      poojaCost,
      poojaPaid,
      poojaBalance: poojaFin.balanceDue,
      poojaExtraPaid: poojaFin.extraPaid,

      electricityCost,
      electricityPaid,
      electricityBalance: electricityFin.balanceDue,
      electricityExtraPaid: electricityFin.extraPaid,

      waterCost,
      waterPaid,
      waterBalance: waterFin.balanceDue,
      waterExtraPaid: waterFin.extraPaid,

      otherCost,
      otherPaid,
      otherBalance: otherFin.balanceDue,
      otherExtraPaid: otherFin.extraPaid,

      totalCost,
      totalPaid,
      totalBalance: overallFin.balanceDue,
      totalExtraPaid: overallFin.extraPaid,
    };

    return {
      site,
      materials,
      rodEntries,
      workers,
      attendance,
      advances,
      salaryPayments,
      tools,
      teaSnacks,
      poojas,
      electricity,
      water,
      comments,
      otherExpenses,
      payments,
      summary,
    };
  }, [siteId]);
}
