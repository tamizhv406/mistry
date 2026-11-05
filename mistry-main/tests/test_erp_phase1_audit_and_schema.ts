import { describe, it } from 'node:test';
import assert from 'node:assert';
import 'fake-indexeddb/auto';
import { BuildingMistryDB } from '../src/db/db';
import { userCanAccessRecord } from '../src/db/types';
import type {
  User,
  TaskRecord,
  MilestoneRecord,
  SiteDiaryRecord,
  SupplierRecord,
  ProjectDocument,
  AppNotification,
} from '../src/db/types';

describe('[ERP Phase 1] Database Version 9 Schema & Access Control Audit', () => {
  it('instantiates BuildingMistryDB and verifies version 9 schema with all new ERP tables', async () => {
    const testDb = new BuildingMistryDB();
    await testDb.open();

    assert.strictEqual(testDb.verno, 9, 'Database schema must be version 9');

    // Verify all 6 new tables exist
    assert.ok(testDb.tasks, 'tasks table must exist');
    assert.ok(testDb.milestones, 'milestones table must exist');
    assert.ok(testDb.siteDiaries, 'siteDiaries table must exist');
    assert.ok(testDb.suppliers, 'suppliers table must exist');
    assert.ok(testDb.documents, 'documents table must exist');
    assert.ok(testDb.notifications, 'notifications table must exist');

    testDb.close();
  });

  it('performs CRUD, soft delete, and trash inspection on new ERP entities', async () => {
    const testDb = new BuildingMistryDB();
    await testDb.open();

    const contractorUser: User = {
      id: 'usr-contractor-01',
      username: 'mistry_pro',
      fullName: 'K. Rajendran',
      mobile: '9876543210',
      email: 'rajendran@example.com',
      passwordHash: 'hash',
      role: 'SUPER_ADMIN',
      isActive: true,
      createdAt: new Date().toISOString(),
    };

    // 1. Create a Project Site
    await testDb.sites.put({
      id: 'site-erp-101',
      userId: contractorUser.id,
      name: 'Skyline Penthouse',
      ownerName: 'Mr. Arvind Nathan',
      ownerPhone: '9840112233',
      address: '7th Avenue, Anna Nagar',
      area: 'Anna Nagar West',
      buildingType: 'Residential Villa',
      startDate: '2026-11-01',
      expectedCompletionDate: '2027-08-31',
      status: 'Active',
      isDeleted: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // 2. Add Task & Milestone
    const milestone: MilestoneRecord = {
      id: 'ms-1',
      userId: contractorUser.id,
      siteId: 'site-erp-101',
      title: 'Foundation & Basement Footings',
      targetDate: '2026-12-15',
      status: 'In Progress',
      orderIndex: 1,
      isDeleted: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await testDb.milestones.put(milestone);

    const task: TaskRecord = {
      id: 'task-1',
      userId: contractorUser.id,
      siteId: 'site-erp-101',
      title: 'Earthwork excavation & PCC Bedding',
      priority: 'High',
      status: 'In Progress',
      dueDate: '2026-11-20',
      progressPercent: 45,
      milestoneId: 'ms-1',
      isDeleted: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await testDb.tasks.put(task);

    // 3. Add Site Diary
    const diary: SiteDiaryRecord = {
      id: 'diary-1',
      userId: contractorUser.id,
      siteId: 'site-erp-101',
      date: '2026-11-05',
      workCompleted: 'Excavation of Column Footing Pits C1 to C8 completed. Soil compacted.',
      workersPresentCount: 12,
      materialsUsed: 'PCC Cement: 25 bags, M-Sand: 120 CFT, 40mm Aggregate: 150 CFT',
      equipmentUsed: '1x JCB Excavator, 1x Plate Compactor',
      dailyProgressPercent: 5,
      isDeleted: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await testDb.siteDiaries.put(diary);

    // 4. Add Supplier
    const supplier: SupplierRecord = {
      id: 'sup-1',
      userId: contractorUser.id,
      name: 'Vigneshwara Steel & Cement Traders',
      phone: '9443322110',
      materialsSupplied: ['Cement', 'TMT Steel', 'River Sand'],
      address: 'Poonamallee High Road, Chennai',
      isDeleted: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await testDb.suppliers.put(supplier);

    // 5. Add Document
    const document: ProjectDocument = {
      id: 'doc-1',
      userId: contractorUser.id,
      siteId: 'site-erp-101',
      title: 'Structural Column Layout Plan Rev-2',
      category: 'Structural Drawing',
      fileName: 'Structural_Column_Layout_R2.pdf',
      fileType: 'application/pdf',
      fileSize: 245000,
      version: 2,
      isSharedWithClient: true,
      isDeleted: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await testDb.documents.put(document);

    // 6. Add Notification
    const notif: AppNotification = {
      id: 'notif-1',
      userId: contractorUser.id,
      siteId: 'site-erp-101',
      title: 'Critical Task Due Soon',
      message: 'Earthwork excavation is due on 2026-11-20',
      type: 'overdue_task',
      isRead: false,
      createdAt: new Date().toISOString(),
    };
    await testDb.notifications.put(notif);

    // Assert counts
    assert.strictEqual(await testDb.tasks.count(), 1);
    assert.strictEqual(await testDb.milestones.count(), 1);
    assert.strictEqual(await testDb.siteDiaries.count(), 1);
    assert.strictEqual(await testDb.suppliers.count(), 1);
    assert.strictEqual(await testDb.documents.count(), 1);
    assert.strictEqual(await testDb.notifications.count(), 1);

    // Test Soft Delete and Trash Inspection
    await testDb.softDelete('tasks', 'task-1', contractorUser);
    const deletedTask = await testDb.tasks.get('task-1');
    assert.strictEqual(deletedTask?.isDeleted, true, 'Task must be soft deleted');

    const trashItems = await testDb.getAllTrash(contractorUser);
    const trashedTask = trashItems.find(t => t.id === 'task-1');
    assert.ok(trashedTask, 'Trashed task must appear in getAllTrash');
    assert.strictEqual(trashedTask?.tableName, 'tasks');

    // Test Restore
    await testDb.restoreRecord('tasks', 'task-1', contractorUser);
    const restoredTask = await testDb.tasks.get('task-1');
    assert.strictEqual(restoredTask?.isDeleted, false, 'Task must be restored');

    testDb.close();
  });

  it('enforces role-based permissions and protects private internal salary data from clients', () => {
    const clientUser: User = {
      id: 'usr-client-99',
      username: 'house_owner',
      fullName: 'Arvind Nathan',
      mobile: '9840112233',
      email: 'arvind@example.com',
      passwordHash: 'hash',
      role: 'HOUSE_OWNER',
      isActive: true,
      createdAt: new Date().toISOString(),
    };

    // Client can read shared project data
    assert.strictEqual(userCanAccessRecord(clientUser, 'sites', 'read', 'site-owner-id'), true);
    assert.strictEqual(userCanAccessRecord(clientUser, 'tasks', 'read', 'site-owner-id'), true);
    assert.strictEqual(userCanAccessRecord(clientUser, 'milestones', 'read', 'site-owner-id'), true);
    assert.strictEqual(userCanAccessRecord(clientUser, 'documents', 'read', 'site-owner-id'), true);

    // Client CANNOT read internal labour wage and payroll records
    assert.strictEqual(userCanAccessRecord(clientUser, 'salaryPayments', 'read', 'contractor-id'), false, 'Clients must never see contractor salary payments');
    assert.strictEqual(userCanAccessRecord(clientUser, 'labourAdvances', 'read', 'contractor-id'), false, 'Clients must never see worker advances');
    assert.strictEqual(userCanAccessRecord(clientUser, 'workers', 'read', 'contractor-id'), false, 'Clients must never see internal worker records');

    // Client CANNOT write or delete contractor site records
    assert.strictEqual(userCanAccessRecord(clientUser, 'sites', 'write', 'contractor-id'), false);
    assert.strictEqual(userCanAccessRecord(clientUser, 'tasks', 'write', 'contractor-id'), false);
  });
});
