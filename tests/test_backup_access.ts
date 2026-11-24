import 'fake-indexeddb/auto';
import { filterBackupDataForUser, importDatabaseBackup, type BackupData } from '../src/db/backup';
import { db } from '../src/db/db';
import type { User } from '../src/db/types';

let passed = 0;
function check(name: string, condition: boolean) {
  if (!condition) throw new Error(`FAILED: ${name}`);
  passed += 1;
  console.log(`  ✓ ${name}`);
}

const user: User = {
  id: 'user-a',
  username: 'user-a',
  fullName: 'User A',
  mobile: '',
  email: '',
  passwordHash: '',
  role: 'MISTRY',
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
};

const data: BackupData['data'] = {
  sites: [
    { id: 'site-a', userId: user.id },
    { id: 'site-b', userId: 'user-b' },
  ],
  materials: [
    { id: 'material-a', siteId: 'site-a', userId: user.id },
    { id: 'material-b', siteId: 'site-b', userId: user.id },
  ],
  rodEntries: [],
  workers: [
    { id: 'worker-a', siteId: 'site-a' },
    { id: 'worker-b', siteId: 'site-b' },
  ],
  attendance: [],
  labourAdvances: [],
  salaryPayments: [],
  tools: [],
  teaSnacksExpenses: [],
  poojaExpenses: [],
  electricityBills: [],
  waterBills: [],
  siteComments: [],
  otherExpenses: [],
  activityLogs: [
    { id: 'activity-a', siteId: 'site-a' },
    { id: 'activity-b', siteId: 'site-b' },
  ],
  estimates: [
    { id: 'estimate-a', userId: user.id },
    { id: 'estimate-b', userId: 'user-b' },
  ],
  tasks: [
    { id: 'task-a', siteId: 'site-a', title: 'Tile work' },
    { id: 'task-b', siteId: 'site-b', title: 'Other tile work' },
  ],
  milestones: [
    { id: 'ms-a', siteId: 'site-a', name: 'Foundation' },
    { id: 'ms-b', siteId: 'site-b', name: 'Other foundation' },
  ],
  siteDiaries: [
    { id: 'diary-a', siteId: 'site-a', date: '2026-10-01' },
    { id: 'diary-b', siteId: 'site-b', date: '2026-10-01' },
  ],
  suppliers: [
    { id: 'sup-a', userId: user.id, name: 'Ramco Agency' },
    { id: 'sup-b', userId: 'user-b', name: 'Other Agency' },
  ],
  documents: [
    { id: 'doc-a', siteId: 'site-a', name: 'Blueprint' },
    { id: 'doc-b', siteId: 'site-b', name: 'Other Blueprint' },
  ],
  notifications: [
    { id: 'notif-a', userId: user.id, title: 'Low Stock' },
    { id: 'notif-b', userId: 'user-b', title: 'Other Alert' },
  ],
};

const offlineBackup = filterBackupDataForUser(data, user);
check('Offline-limited users can export their own site records', offlineBackup.sites.length === 1 && offlineBackup.materials.length === 1);
check('Records from another owner are excluded even when their row names the exporter', offlineBackup.materials[0].id === 'material-a');
check('Workers and activity logs are filtered by their site owner', offlineBackup.workers.length === 1 && offlineBackup.activityLogs.length === 1);
check('User-owned tables are filtered by userId', offlineBackup.estimates?.length === 1 && offlineBackup.estimates[0].id === 'estimate-a');

// Check the 6 new v9 tables filtering
check('Tasks are filtered by site owner', offlineBackup.tasks?.length === 1 && offlineBackup.tasks[0].id === 'task-a');
check('Milestones are filtered by site owner', offlineBackup.milestones?.length === 1 && offlineBackup.milestones[0].id === 'ms-a');
check('Site diaries are filtered by site owner', offlineBackup.siteDiaries?.length === 1 && offlineBackup.siteDiaries[0].id === 'diary-a');
check('Suppliers are filtered by userId', offlineBackup.suppliers?.length === 1 && offlineBackup.suppliers[0].id === 'sup-a');
check('Documents are filtered by site owner', offlineBackup.documents?.length === 1 && offlineBackup.documents[0].id === 'doc-a');
check('Notifications are filtered by userId', offlineBackup.notifications?.length === 1 && offlineBackup.notifications[0].id === 'notif-a');

const subAdminOwner: User = { ...user, role: 'SUB_ADMIN', permissions: {} };
const subAdminOwnerBackup = filterBackupDataForUser(data, subAdminOwner);
check('Sub-admins retain access to their own data without scope grants', subAdminOwnerBackup.materials.length === 1);

const subAdmin: User = {
  ...user,
  role: 'SUB_ADMIN',
  permissions: { materials: { read: true, write: false } },
};
const scopedBackup = filterBackupDataForUser(data, subAdmin);
check('Sub-admin backup includes cross-owner records only for readable scopes', scopedBackup.materials.length === 2 && scopedBackup.workers.length === 1);

// Integration tests for importDatabaseBackup
async function testImportDatabase() {
  await db.open();

  // 1. Pre-populate a task
  await db.tasks.put({
    id: 'task-pre-existing',
    userId: user.id,
    siteId: 'site-a',
    title: 'Pre-existing Task',
    status: 'Pending',
    priority: 'medium',
    dueDate: '2026-12-01',
    progressPercent: 10,
    isDeleted: false,
    createdAt: '2026-10-01',
    updatedAt: '2026-10-01',
  });

  // 2. Import an older backup file (v5) without v9 tables
  const olderBackupObj: BackupData = {
    version: 5,
    appName: 'Building Mistry',
    exportedAt: '2026-10-15T00:00:00.000Z',
    data: {
      sites: [{ id: 'site-restored-1', userId: user.id, name: 'Restored Project', isDeleted: false }],
      materials: [],
      rodEntries: [],
      workers: [],
      attendance: [],
      labourAdvances: [],
      salaryPayments: [],
      tools: [],
      teaSnacksExpenses: [],
      poojaExpenses: [],
      electricityBills: [],
      waterBills: [],
      siteComments: [],
      otherExpenses: [],
      activityLogs: [],
    },
  };

  const oldFile = {
    text: async () => JSON.stringify(olderBackupObj),
  } as unknown as File;

  const resOld = await importDatabaseBackup(oldFile);
  check('Older backup file restores successfully', resOld.success && resOld.recordCount === 1);
  const preservedTask = await db.tasks.get('task-pre-existing');
  check('Older backup restore leaves optional v9 tables intact', preservedTask?.id === 'task-pre-existing');

  // 3. Import full v6 backup with all 6 tables
  const fullBackupObj: BackupData = {
    version: 6,
    appName: 'Building Mistry',
    exportedAt: '2026-11-01T00:00:00.000Z',
    data: {
      sites: [{ id: 'site-v6', userId: user.id, name: 'V6 Project', isDeleted: false }],
      materials: [],
      rodEntries: [],
      workers: [],
      attendance: [],
      labourAdvances: [],
      salaryPayments: [],
      tools: [],
      teaSnacksExpenses: [],
      poojaExpenses: [],
      electricityBills: [],
      waterBills: [],
      siteComments: [],
      otherExpenses: [],
      activityLogs: [],
      tasks: [
        {
          id: 'task-restored-1',
          userId: user.id,
          siteId: 'site-v6',
          title: 'Roof Slab Concreting',
          status: 'In Progress',
          priority: 'urgent',
          dueDate: '2026-11-20',
          progressPercent: 65,
          isDeleted: false,
          createdAt: '2026-11-01',
          updatedAt: '2026-11-01',
        },
      ],
      milestones: [
        {
          id: 'ms-restored-1',
          userId: user.id,
          siteId: 'site-v6',
          name: 'Structure Completion',
          targetDate: '2026-12-31',
          orderIndex: 2,
          isDeleted: false,
          createdAt: '2026-11-01',
          updatedAt: '2026-11-01',
        },
      ],
      siteDiaries: [
        {
          id: 'diary-restored-1',
          userId: user.id,
          siteId: 'site-v6',
          date: '2026-11-01',
          workCompleted: 'Column reinforcement check',
          labourCount: 12,
          weather: 'Sunny',
          isDeleted: false,
          createdAt: '2026-11-01',
          updatedAt: '2026-11-01',
        },
      ],
      suppliers: [
        {
          id: 'sup-restored-1',
          userId: user.id,
          name: 'Supreme Steel Traders',
          phone: '9840012345',
          isDeleted: false,
          createdAt: '2026-11-01',
          updatedAt: '2026-11-01',
        },
      ],
      documents: [
        {
          id: 'doc-restored-1',
          userId: user.id,
          siteId: 'site-v6',
          name: 'Structural Drawing Rev 2',
          category: 'structural',
          fileUrl: 'blob:doc1',
          isDeleted: false,
          clientVisible: true,
          createdAt: '2026-11-01',
          updatedAt: '2026-11-01',
        },
      ],
      notifications: [
        {
          id: 'notif-restored-1',
          userId: user.id,
          title: 'Cement Stock Low',
          message: 'Only 15 bags left',
          type: 'low_stock',
          isRead: false,
          createdAt: '2026-11-01',
        },
      ],
    },
  };

  const v6File = {
    text: async () => JSON.stringify(fullBackupObj),
  } as unknown as File;

  const resV6 = await importDatabaseBackup(v6File);
  check('Full v6 backup restores successfully', resV6.success);

  const restoredTask = await db.tasks.get('task-restored-1');
  const restoredMs = await db.milestones.get('ms-restored-1');
  const restoredDiary = await db.siteDiaries.get('diary-restored-1');
  const restoredSup = await db.suppliers.get('sup-restored-1');
  const restoredDoc = await db.documents.get('doc-restored-1');
  const restoredNotif = await db.notifications.get('notif-restored-1');

  check('Restored task preserves IDs, progress %, and fields', restoredTask?.title === 'Roof Slab Concreting' && restoredTask.progressPercent === 65);
  check('Restored milestone preserves order index and target date', restoredMs?.orderIndex === 2);
  check('Restored site diary preserves workCompleted and labourCount', restoredDiary?.labourCount === 12);
  check('Restored supplier preserves phone and name', restoredSup?.name === 'Supreme Steel Traders');
  check('Restored document preserves clientVisible flag', restoredDoc?.clientVisible === true);
  check('Restored notification preserves type and message', restoredNotif?.type === 'low_stock');

  // 4. Repeated restore idempotence (no duplicates)
  await importDatabaseBackup(v6File);
  const countTasks = await db.tasks.count();
  const countSuppliers = await db.suppliers.count();
  check('Repeated restore does not duplicate records', countTasks === 1 && countSuppliers === 1);

  // 5. Invalid backup format rejected safely
  const invalidFile = {
    text: async () => JSON.stringify({ appName: 'Wrong App', data: {} }),
  } as unknown as File;
  const resInvalid = await importDatabaseBackup(invalidFile);
  check('Invalid appName backup is rejected safely', !resInvalid.success);

  const corruptedFile = {
    text: async () => 'not json at all',
  } as unknown as File;
  const resCorrupted = await importDatabaseBackup(corruptedFile);
  check('Corrupted non-JSON backup is rejected safely', !resCorrupted.success);
}

testImportDatabase().then(() => {
  console.log(`\nBackup & Restore verification checks: ${passed} passed.`);
}).catch(err => {
  console.error('Test failed with error:', err);
  process.exit(1);
});

