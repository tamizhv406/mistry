/**
 * Test Suite: Phase 1 — State Management, Data Persistence & Export/Import Engine
 * Tests Unified Storage Service, Schema Validation, IndexedDB/LocalStorage fallback,
 * Debounced Auto-Save (500ms), Schema Versioning (DB_VERSION = 2) & Migration,
 * and JSON/CSV Export & Import with Overwrite/Merge Conflict Resolution.
 */

import 'fake-indexeddb/auto';
import {
  storageService,
  DB_VERSION,
  validateSite,
  validateWorker,
  validateAttendance,
  validatePlan,
  validateEstimate,
  generateUUID,
  debounce,
  createDebouncedAutoSave,
  type StorageSite,
  type StorageWorker,
  type StorageAttendance,
  type StoragePlan,
  type StorageEstimate,
} from '../src/services/storage';

let passed = 0;
let failed = 0;

function assert(condition: boolean, desc: string) {
  if (condition) {
    console.log(`  ✓ ${desc}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${desc}`);
    failed++;
  }
}

async function runTestSuite() {
  console.log('\n======================================================');
  console.log('--- PHASE 1: UNIFIED STORAGE & PERSISTENCE TEST SUITE ---');
  console.log('======================================================\n');

  // ── TEST 1: UUID Generation & ISO Timestamps ──────────────────────
  console.log('Test 1: UUID Generation & ISO Timestamps');
  const uuid1 = generateUUID();
  const uuid2 = generateUUID();
  assert(typeof uuid1 === 'string' && uuid1.length >= 16, 'UUID 1 generated successfully');
  assert(uuid1 !== uuid2, 'UUIDs are unique');
  const nowISO = new Date().toISOString();
  assert(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(nowISO), 'ISO timestamp conforms to standard');

  // ── TEST 2: Schema Validation (Sites, Workers, Attendance, Plans, Estimates) ──
  console.log('\nTest 2: Schema Validation');
  const validSiteRes = validateSite({
    siteName: 'Royal Villa Phase 2',
    ownerName: 'Karthik',
    phone: '9876543210',
    location: 'Chennai',
    buildingType: 'Duplex',
    totalBudget: 4500000,
    status: 'active',
  });
  assert(validSiteRes.valid, 'Valid site passes validation');

  const invalidSiteRes = validateSite({
    siteName: '', // empty name
    totalBudget: -500, // negative budget
    status: 'unknown_status' as any,
  });
  assert(!invalidSiteRes.valid && invalidSiteRes.errors.length >= 3, 'Invalid site caught with multiple errors');

  const validWorkerRes = validateWorker({
    name: 'Murugan',
    role: 'Head Mason',
    dailyWage: 950,
    overtimeRate: 150,
    active: true,
  });
  assert(validWorkerRes.valid, 'Valid worker passes validation');

  const invalidWorkerRes = validateWorker({
    name: '',
    dailyWage: -100,
  });
  assert(!invalidWorkerRes.valid, 'Invalid worker (negative wage, empty name) rejected');

  const validAttendanceRes = validateAttendance({
    date: '2026-11-06',
    workerId: 'worker_1',
    siteId: 'site_1',
    status: 'P',
    otHours: 2,
  });
  assert(validAttendanceRes.valid, 'Valid attendance record passes validation');

  const invalidAttendanceRes = validateAttendance({
    date: 'invalid-date',
    workerId: '',
    siteId: '',
    status: 'INVALID' as any,
  });
  assert(!invalidAttendanceRes.valid, 'Invalid attendance record caught');

  const validPlanRes = validatePlan({
    name: 'Ground Floor CAD Plan',
    dimensions: { length: 40, width: 30 },
  });
  assert(validPlanRes.valid, 'Valid plan dimensions pass validation');

  const validEstimateRes = validateEstimate({
    builtUpArea: 1800,
    packageType: 'premium',
  });
  assert(validEstimateRes.valid, 'Valid estimate parameters pass validation');

  // ── TEST 3: CRUD Operations via StorageService ────────────────────
  console.log('\nTest 3: CRUD Operations via Unified Storage Service');
  const savedSite = await storageService.saveSite({
    siteName: 'Greenfield Heights',
    ownerName: 'Sundar',
    phone: '9443322110',
    location: 'Coimbatore',
    totalBudget: 3500000,
    status: 'active',
  });
  assert(Boolean(savedSite.id), 'Site saved with generated UUID');
  assert(savedSite.siteName === 'Greenfield Heights', 'Site name preserved correctly');

  const allSites = await storageService.getSites();
  assert(allSites.some((s) => s.id === savedSite.id), 'Saved site retrievable from storage');

  const savedWorker = await storageService.saveWorker({
    name: 'Senthil',
    role: 'Electrician',
    dailyWage: 850,
    siteId: savedSite.id,
    active: true,
  });
  assert(savedWorker.name === 'Senthil', 'Worker saved successfully');
  const siteWorkers = await storageService.getWorkers(savedSite.id);
  assert(siteWorkers.some((w) => w.id === savedWorker.id), 'Worker retrievable by siteId');

  const savedAtt = await storageService.saveAttendance({
    date: '2026-11-06',
    workerId: savedWorker.id,
    siteId: savedSite.id,
    status: 'P',
    otHours: 1.5,
  });
  assert(savedAtt.status === 'P' && savedAtt.otHours === 1.5, 'Attendance logged with overtime');

  const savedPlan = await storageService.savePlan({
    siteId: savedSite.id,
    name: 'G+1 Elevation & Framing',
    dimensions: { length: 50, width: 35 },
    rooms: [{ name: 'Hall', area: 240 }],
    walls: [{ id: 'w1', length: 20 }],
    openings: [{ id: 'd1', type: 'door' }],
  });
  assert(savedPlan.name === 'G+1 Elevation & Framing', 'Plan saved with rooms and walls');

  const savedEst = await storageService.saveEstimate({
    siteId: savedSite.id,
    builtUpArea: 2200,
    packageType: 'luxury',
    totals: { grandTotal: 5200000 },
  });
  assert(savedEst.packageType === 'luxury', 'Estimate saved successfully');

  // ── TEST 4: Auto-Save Debouncing (500ms) ──────────────────────────
  console.log('\nTest 4: Debounced Auto-Save Engine (500ms)');
  let autoSaveCallCount = 0;
  let lastAutoSavedPayload: any = null;

  const autoSaveEngine = createDebouncedAutoSave<any>((payload) => {
    autoSaveCallCount++;
    lastAutoSavedPayload = payload;
  }, 500);

  // Trigger rapid mutations (simulating keystrokes / canvas drags)
  autoSaveEngine.trigger({ text: 'Draft 1' });
  autoSaveEngine.trigger({ text: 'Draft 2' });
  autoSaveEngine.trigger({ text: 'Draft 3' });
  assert(autoSaveCallCount === 0, 'Auto-save does not execute immediately synchronously');

  await new Promise((resolve) => setTimeout(resolve, 600));
  assert(autoSaveCallCount === 1, 'Auto-save executed exactly once after 500ms debounce quiet period');
  assert(lastAutoSavedPayload?.text === 'Draft 3', 'Auto-save captured final state correctly');

  // ── TEST 5: Schema Versioning & Auto-Migration (DB_VERSION = 2) ──
  console.log('\nTest 5: Schema Versioning & Auto-Migration (DB_VERSION = 2)');
  assert(DB_VERSION === 2, 'Storage service schema version is strictly 2');
  const migrationResult = await storageService.autoMigrate();
  assert(migrationResult.version === 2, 'Migration reports current version 2 without data wiping');

  // ── TEST 6: JSON & CSV Export Engine ─────────────────────────────
  console.log('\nTest 6: JSON & CSV Export Engine');
  const jsonExport = await storageService.exportJSON();
  assert(jsonExport.filename.startsWith('mistry_backup_') && jsonExport.filename.endsWith('.json'), 'JSON backup filename formatted correctly');
  const parsedBackup = JSON.parse(jsonExport.content);
  assert(parsedBackup.appName === 'Building Mistry', 'Backup payload includes appName');
  assert(parsedBackup.version === 2, 'Backup payload includes schema version 2');
  assert(Array.isArray(parsedBackup.data.sites) && parsedBackup.data.sites.length > 0, 'Backup data contains sites array');
  assert(Array.isArray(parsedBackup.data.workers) && parsedBackup.data.workers.length > 0, 'Backup data contains workers array');

  const csvExport = await storageService.exportSummaryCSV();
  assert(csvExport.filename.startsWith('mistry_summary_') && csvExport.filename.endsWith('.csv'), 'CSV summary filename formatted correctly');
  assert(csvExport.content.includes('--- SITES & PROJECTS ---'), 'CSV includes Sites header section');
  assert(csvExport.content.includes('--- WORKERS & LABOUR ---'), 'CSV includes Workers header section');
  assert(csvExport.content.includes('--- ATTENDANCE LOGS ---'), 'CSV includes Attendance header section');
  assert(csvExport.content.includes('Greenfield Heights'), 'CSV includes saved site content');

  // ── TEST 7: JSON Import Engine (Merge & Overwrite) ────────────────
  console.log('\nTest 7: JSON Import Engine (Merge & Overwrite Modes)');

  // Merge Mode
  const importPayload = {
    version: 2,
    appName: 'Building Mistry',
    exportedAt: new Date().toISOString(),
    data: {
      sites: [
        {
          id: 'imported_site_1',
          siteName: 'Sunrise Enclave',
          ownerName: 'Venkatesh',
          phone: '9888877777',
          location: 'Madurai',
          buildingType: 'Commercial',
          totalBudget: 8000000,
          status: 'active',
          createdAt: new Date().toISOString(),
        },
      ],
      workers: [
        {
          id: 'imported_worker_1',
          name: 'Palanisamy',
          role: 'Bar Bender',
          phone: '9888811111',
          dailyWage: 900,
          overtimeRate: 140,
          siteId: 'imported_site_1',
          active: true,
        },
      ],
      attendance: [
        {
          id: 'imported_att_1',
          date: '2026-11-06',
          workerId: 'imported_worker_1',
          siteId: 'imported_site_1',
          status: 'OT',
          otHours: 3,
        },
      ],
      plans: [],
      estimates: [],
    },
  };

  const mergeRes = await storageService.importJSON(importPayload, 'merge');
  assert(mergeRes.success, 'Merge import succeeded');
  assert(mergeRes.recordCount >= 3, 'Imported at least 3 records');

  const sitesAfterMerge = await storageService.getSites();
  assert(sitesAfterMerge.some((s) => s.id === 'imported_site_1'), 'Imported site present after merge');
  assert(sitesAfterMerge.some((s) => s.id === savedSite.id), 'Pre-existing site preserved after merge');

  // Overwrite Mode
  const overwriteRes = await storageService.importJSON(importPayload, 'overwrite');
  assert(overwriteRes.success, 'Overwrite import succeeded');
  const sitesAfterOverwrite = await storageService.getSites();
  assert(sitesAfterOverwrite.some((s) => s.id === 'imported_site_1'), 'Imported site present after overwrite');

  // Invalid Import schema rejection test
  const invalidImportRes = await storageService.importJSON({ invalid: 'no data' }, 'merge');
  assert(!invalidImportRes.success, 'Invalid backup format rejected without crashing');

  console.log('\n======================================================');
  console.log(`TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});

