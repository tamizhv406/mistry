import 'fake-indexeddb/auto';
import { filterBackupDataForUser, type BackupData } from '../src/db/backup';
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
};

const offlineBackup = filterBackupDataForUser(data, user);
check('Offline-limited users can export their own site records', offlineBackup.sites.length === 1 && offlineBackup.materials.length === 1);
check('Records from another owner are excluded even when their row names the exporter', offlineBackup.materials[0].id === 'material-a');
check('Workers and activity logs are filtered by their site owner', offlineBackup.workers.length === 1 && offlineBackup.activityLogs.length === 1);
check('User-owned tables are filtered by userId', offlineBackup.estimates?.length === 1 && offlineBackup.estimates[0].id === 'estimate-a');

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

console.log(`\nBackup access checks: ${passed} passed.`);
