import { describe, it } from 'node:test';
import assert from 'node:assert';
import 'fake-indexeddb/auto';
import { BuildingMistryDB } from '../src/db/db';
import { generateDailySiteReportPdfBlob } from '../src/utils/pdfGenerator';
import type { TaskRecord, MilestoneRecord, SiteDiaryRecord, SupplierRecord, ProjectDocument } from '../src/db/types';

describe('[ERP Phase 2 & 3] Project Management, Tasks, Site Diary & Supplier Engine', () => {
  it('generates standard genuine A4 PDF for Daily Site Diary with all required inspection details', async () => {
    const pdfBlob = generateDailySiteReportPdfBlob({
      projectName: 'Marina Bay Luxury Villas',
      clientName: 'Dr. K. Venkataraman',
      location: 'ECR, Chennai',
      date: '2026-11-05',
      workCompleted: 'Completed First Floor Slab Shuttering and Rebar Laying. Column casting C1 to C6 inspected.',
      workersPresentCount: 16,
      materialsUsed: 'PPC Cement 45 bags, 12mm TMT Steel 1.2 Tons, Binding Wire 25 kg',
      equipmentUsed: 'Concrete Vibrator, Bar Bender Machine',
      siteIssuesAndDelays: '30 min delay due to local power cut; switched to diesel backup generator.',
      engineerRemarks: 'Cover blocks placed accurately at 25mm spacing. Rebar lap lengths verified.',
      supervisorNotes: 'Ready for slab concrete pour tomorrow morning at 7:00 AM.',
      dailyProgressPercent: 8,
      weather: 'Sunny / 31°C',
    });

    assert.strictEqual(pdfBlob.type, 'application/pdf', 'MIME type must be application/pdf');
    assert.ok(pdfBlob.size > 1000, 'Blob size should be substantial for complete A4 PDF document');

    const arrayBuffer = await pdfBlob.arrayBuffer();
    const text = new TextDecoder('latin1').decode(new Uint8Array(arrayBuffer));

    // Verify PDF structure
    assert.ok(text.startsWith('%PDF-1.4'), 'Must start with standard %PDF-1.4 header');
    assert.ok(text.includes('/MediaBox [0 0 595.28 841.89]'), 'Must have A4 Portrait dimensions');
    assert.ok(text.includes('BUILDING MISTRY'), 'Must include title header');
    assert.ok(text.includes('DAILY SITE DIARY'), 'Must include diary report title');

    // Verify Contents
    assert.ok(text.includes('Marina Bay Luxury Villas'), 'Must include project name');
    assert.ok(text.includes('Dr. K. Venkataraman'), 'Must include client name');
    assert.ok(text.includes('16 Person'), 'Must include worker count');
    assert.ok(text.includes('First Floor Slab Shuttering'), 'Must include work completed');
    assert.ok(text.includes('PPC Cement 45 bags'), 'Must include materials used');
    assert.ok(text.includes('diesel backup generator'), 'Must include delay remarks');
    assert.ok(text.trimEnd().endsWith('%%EOF'), 'Must terminate with %%EOF');
  });

  it('manages task progress percentages and detects overdue tasks accurately', async () => {
    const testDb = new BuildingMistryDB();
    await testDb.open();

    const task1: TaskRecord = {
      id: 'task-test-1',
      userId: 'usr-1',
      siteId: 'site-test-1',
      title: 'Plinth Beam Concreting',
      dueDate: '2026-11-01', // past due
      priority: 'Urgent',
      status: 'In Progress',
      progressPercent: 60,
      isDeleted: false,
      createdAt: '2026-10-25',
      updatedAt: '2026-10-25',
    };

    const task2: TaskRecord = {
      id: 'task-test-2',
      userId: 'usr-1',
      siteId: 'site-test-1',
      title: 'Brick Masonry Ground Floor',
      dueDate: '2026-11-20', // future due
      priority: 'High',
      status: 'Pending',
      progressPercent: 0,
      isDeleted: false,
      createdAt: '2026-10-25',
      updatedAt: '2026-10-25',
    };

    await testDb.tasks.bulkPut([task1, task2]);

    const allSiteTasks = await testDb.tasks.where('siteId').equals('site-test-1').toArray();
    assert.strictEqual(allSiteTasks.length, 2);

    const nowTime = new Date('2026-11-05T09:00:00Z').getTime();
    const overdueTasks = allSiteTasks.filter(t => t.status !== 'Completed' && new Date(t.dueDate).getTime() < nowTime);
    assert.strictEqual(overdueTasks.length, 1);
    assert.strictEqual(overdueTasks[0].id, 'task-test-1');

    testDb.close();
  });

  it('aggregates supplier purchases and correctly computes outstanding payables', async () => {
    const testDb = new BuildingMistryDB();
    await testDb.open();

    const supplier: SupplierRecord = {
      id: 'sup-test-1',
      userId: 'usr-1',
      name: 'Sri Murugan Blue Metal',
      phone: '9840112233',
      materialsSupplied: ['M-Sand', 'P-Sand', 'Blue Metal'],
      isDeleted: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await testDb.suppliers.put(supplier);

    await testDb.materials.put({
      id: 'mat-test-1',
      siteId: 'site-test-1',
      category: 'sand',
      materialName: 'Concrete M-Sand',
      supplier: 'Sri Murugan Blue Metal',
      quantity: 500,
      unit: 'CFT',
      rate: 55,
      totalAmount: 27500,
      paidAmount: 20000,
      balance: 7500,
      extraPaid: 0,
      purchaseDate: '2026-11-02',
      isDeleted: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const supMaterials = await testDb.materials.filter(m => m.supplier === 'Sri Murugan Blue Metal').toArray();
    const totalPurchased = supMaterials.reduce((acc, m) => acc + m.totalAmount, 0);
    const totalPaid = supMaterials.reduce((acc, m) => acc + m.paidAmount, 0);
    const balance = totalPurchased - totalPaid;

    assert.strictEqual(totalPurchased, 27500);
    assert.strictEqual(totalPaid, 20000);
    assert.strictEqual(balance, 7500);

    testDb.close();
  });
});
