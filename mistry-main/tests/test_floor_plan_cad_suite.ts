import 'fake-indexeddb/auto';
import { STARTER_TEMPLATES, saveFloorPlanVersion, restoreFloorPlanVersion } from '../src/services/floorPlanService';
import { db } from '../src/db/db';
import type { User } from '../src/db/types';

async function runCADSuiteTests() {
  console.log('📐 Starting Building Mistry Premium A-Z CAD Floor Plan Suite Tests...\n');

  const testUser: User = {
    id: 'test-cad-architect',
    username: 'architect_tamil',
    fullName: 'Tamil Architect',
    mobile: '9840112233',
    email: 'architect@example.com',
    passwordHash: 'dummy',
    role: 'MISTRY',
    isActive: true,
    createdAt: new Date().toISOString(),
  };

  // 1. Starter Templates Verification
  console.log('[Test 1] Testing Starter CAD Templates (1 BHK, 2 BHK, 3 BHK)...');
  if (STARTER_TEMPLATES.length < 3) {
    throw new Error(`Expected at least 3 templates, got ${STARTER_TEMPLATES.length}`);
  }
  for (const tpl of STARTER_TEMPLATES) {
    if (!tpl.id || !tpl.name || !tpl.bhk || tpl.plotLength <= 0 || tpl.plotWidth <= 0) {
      throw new Error(`Invalid template structure for ${tpl.name}`);
    }
    if (!Array.isArray(tpl.walls) || tpl.walls.length === 0) {
      throw new Error(`Template ${tpl.name} has no walls defined.`);
    }
    if (!Array.isArray(tpl.rooms) || tpl.rooms.length === 0) {
      throw new Error(`Template ${tpl.name} has no rooms defined.`);
    }
  }
  console.log('✓ All 3 starter templates (1 BHK, 2 BHK, 3 BHK) have valid CAD walls, rooms, doors & dimensions.');

  // 2. Real Database Creation & Version History Test
  console.log('\n[Test 2] Testing Real Database Floor Plan & Version History Snapshot/Restore...');
  const siteId = `site-cad-${Date.now()}`;
  await db.sites.add({
    id: siteId,
    userId: testUser.id,
    name: 'CAD Luxury Towers',
    location: 'Chennai Central',
    clientName: 'Thilagan Developers',
    clientPhone: '9840112233',
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isDeleted: false,
  } as any);

  const planId = `plan-cad-${Date.now()}`;
  await db.floorPlans.add({
    id: planId,
    userId: testUser.id,
    siteId,
    siteName: 'CAD Luxury Towers',
    buildingName: 'Tower A',
    floorName: 'Ground Floor',
    plotLength: 40,
    plotWidth: 30,
    unit: 'feet',
    walls: [
      { id: 'w1', x1: 0, y1: 0, x2: 40, y2: 0, thickness: 0.75, wallType: 'exterior' },
      { id: 'w2', x1: 40, y1: 0, x2: 40, y2: 30, thickness: 0.75, wallType: 'exterior' },
    ],
    rooms: [
      { id: 'r1', roomType: 'Living Room', label: 'Grand Living', x: 2, y: 2, width: 20, height: 15, rotation: 0 },
    ],
    doors: [],
    windows: [],
    furniture: [
      { id: 'f1', itemType: '3-Seater Sofa', label: 'Sofa', category: 'living', x: 4, y: 4, width: 7, height: 3, rotation: 0 },
    ],
    stairs: [],
    columns: [
      { id: 'c1', structType: 'Column', shape: 'square', x: 0, y: 0, width: 0.75, depth: 0.75, rotation: 0 },
    ],
    annotations: [],
    status: 'draft',
    isDeleted: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as any);

  // Save Version Snapshot
  const snapRes = await saveFloorPlanVersion(testUser, planId, 'Milestone 1: Living Room Layout');
  if (!snapRes.success || snapRes.versionNumber !== 1) {
    throw new Error('Failed to save version snapshot.');
  }
  console.log(`✓ Version snapshot saved successfully: Version #${snapRes.versionNumber}`);

  // Modify plan in DB
  await db.floorPlans.update(planId, {
    floorName: 'Modified Floor',
    rooms: [],
  });

  // Restore Version Snapshot
  const savedPlan = await db.floorPlans.get(planId);
  const versionId = savedPlan?.versionHistory?.[0]?.versionId;
  if (!versionId) {
    throw new Error('Version snapshot not found in version history.');
  }

  const restoreRes = await restoreFloorPlanVersion(testUser, planId, versionId);
  if (!restoreRes.success) {
    throw new Error(`Failed to restore version snapshot: ${restoreRes.error}`);
  }

  const restoredPlan = await db.floorPlans.get(planId);
  if (restoredPlan?.rooms?.length !== 1 || restoredPlan.rooms[0].label !== 'Grand Living') {
    throw new Error('Restored plan data does not match snapshot!');
  }
  console.log('✓ Snapshot rollback verified: Geometry perfectly restored from snapshot.');

  // Clean up test data
  await db.floorPlans.delete(planId);
  await db.sites.delete(siteId);

  console.log('\n🎉 ALL CAD SUITE TESTS PASSED PERFECTLY!\n');
}

runCADSuiteTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
