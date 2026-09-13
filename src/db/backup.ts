import { db } from './db';

export interface BackupData {
  version: number;
  appName: string;
  exportedAt: string;
  data: {
    sites: any[];
    materials: any[];
    rodEntries: any[];
    workers: any[];
    attendance: any[];
    labourAdvances: any[];
    salaryPayments: any[];
    tools: any[];
    teaSnacksExpenses: any[];
    poojaExpenses: any[];
    electricityBills: any[];
    waterBills: any[];
    siteComments: any[];
    otherExpenses: any[];
    activityLogs: any[];
    materialPrices?: any[];
    estimates?: any[];
    payments?: any[];
  };
}

export async function exportDatabaseBackup(): Promise<void> {
  const [
    sites,
    materials,
    rodEntries,
    workers,
    attendance,
    labourAdvances,
    salaryPayments,
    tools,
    teaSnacksExpenses,
    poojaExpenses,
    electricityBills,
    waterBills,
    siteComments,
    otherExpenses,
    activityLogs,
    materialPrices,
    estimates,
    payments,
  ] = await Promise.all([
    db.sites.toArray(),
    db.materials.toArray(),
    db.rodEntries.toArray(),
    db.workers.toArray(),
    db.attendance.toArray(),
    db.labourAdvances.toArray(),
    db.salaryPayments.toArray(),
    db.tools.toArray(),
    db.teaSnacksExpenses.toArray(),
    db.poojaExpenses.toArray(),
    db.electricityBills.toArray(),
    db.waterBills.toArray(),
    db.siteComments.toArray(),
    db.otherExpenses.toArray(),
    db.activityLogs.toArray(),
    db.materialPrices.toArray(),
    db.estimates.toArray(),
    db.payments.toArray(),
  ]);

  const backup: BackupData = {
    version: 4,
    appName: 'Building Mistry',
    exportedAt: new Date().toISOString(),
    data: {
      sites,
      materials,
      rodEntries,
      workers,
      attendance,
      labourAdvances,
      salaryPayments,
      tools,
      teaSnacksExpenses,
      poojaExpenses,
      electricityBills,
      waterBills,
      siteComments,
      otherExpenses,
      activityLogs,
      materialPrices,
      estimates,
      payments,
    },
  };

  const jsonStr = JSON.stringify(backup, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const dateStr = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `building_mistry_backup_${dateStr}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function importDatabaseBackup(file: File): Promise<{ success: boolean; message: string; recordCount: number }> {
  try {
    const text = await file.text();
    const backup: BackupData = JSON.parse(text);

    if (!backup.appName || backup.appName !== 'Building Mistry' || !backup.data) {
      throw new Error('Invalid backup file format. Must be an official Building Mistry backup.');
    }

    const { data } = backup;
    let totalRestored = 0;

    // Use transaction to ensure atomic replacement
    await db.transaction('rw', [
      db.sites,
      db.materials,
      db.rodEntries,
      db.workers,
      db.attendance,
      db.labourAdvances,
      db.salaryPayments,
      db.tools,
      db.teaSnacksExpenses,
      db.poojaExpenses,
      db.electricityBills,
      db.waterBills,
      db.siteComments,
      db.otherExpenses,
      db.activityLogs,
      db.materialPrices,
      db.estimates,
      db.payments,
    ], async () => {
      // Clear existing records
      await Promise.all([
        db.sites.clear(),
        db.materials.clear(),
        db.rodEntries.clear(),
        db.workers.clear(),
        db.attendance.clear(),
        db.labourAdvances.clear(),
        db.salaryPayments.clear(),
        db.tools.clear(),
        db.teaSnacksExpenses.clear(),
        db.poojaExpenses.clear(),
        db.electricityBills.clear(),
        db.waterBills.clear(),
        db.siteComments.clear(),
        db.otherExpenses.clear(),
        db.activityLogs.clear(),
        db.materialPrices.clear(),
        db.estimates.clear(),
        db.payments.clear(),
      ]);

      // Bulk add
      if (data.sites?.length) { await db.sites.bulkAdd(data.sites); totalRestored += data.sites.length; }
      if (data.materials?.length) { await db.materials.bulkAdd(data.materials); totalRestored += data.materials.length; }
      if (data.rodEntries?.length) { await db.rodEntries.bulkAdd(data.rodEntries); totalRestored += data.rodEntries.length; }
      if (data.workers?.length) { await db.workers.bulkAdd(data.workers); totalRestored += data.workers.length; }
      if (data.attendance?.length) { await db.attendance.bulkAdd(data.attendance); totalRestored += data.attendance.length; }
      if (data.labourAdvances?.length) { await db.labourAdvances.bulkAdd(data.labourAdvances); totalRestored += data.labourAdvances.length; }
      if (data.salaryPayments?.length) { await db.salaryPayments.bulkAdd(data.salaryPayments); totalRestored += data.salaryPayments.length; }
      if (data.tools?.length) { await db.tools.bulkAdd(data.tools); totalRestored += data.tools.length; }
      if (data.teaSnacksExpenses?.length) { await db.teaSnacksExpenses.bulkAdd(data.teaSnacksExpenses); totalRestored += data.teaSnacksExpenses.length; }
      if (data.poojaExpenses?.length) { await db.poojaExpenses.bulkAdd(data.poojaExpenses); totalRestored += data.poojaExpenses.length; }
      if (data.electricityBills?.length) { await db.electricityBills.bulkAdd(data.electricityBills); totalRestored += data.electricityBills.length; }
      if (data.waterBills?.length) { await db.waterBills.bulkAdd(data.waterBills); totalRestored += data.waterBills.length; }
      if (data.siteComments?.length) { await db.siteComments.bulkAdd(data.siteComments); totalRestored += data.siteComments.length; }
      if (data.otherExpenses?.length) { await db.otherExpenses.bulkAdd(data.otherExpenses); totalRestored += data.otherExpenses.length; }
      if (data.activityLogs?.length) { await db.activityLogs.bulkAdd(data.activityLogs); totalRestored += data.activityLogs.length; }
      if (data.materialPrices?.length) { await db.materialPrices.bulkAdd(data.materialPrices); totalRestored += data.materialPrices.length; }
      if (data.estimates?.length) { await db.estimates.bulkAdd(data.estimates); totalRestored += data.estimates.length; }
      if (data.payments?.length) { await db.payments.bulkAdd(data.payments); totalRestored += data.payments.length; }
    });

    return {
      success: true,
      message: `Database successfully restored with ${totalRestored} records from ${new Date(backup.exportedAt).toLocaleString()}`,
      recordCount: totalRestored,
    };
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || 'Failed to import backup file.',
      recordCount: 0,
    };
  }
}
