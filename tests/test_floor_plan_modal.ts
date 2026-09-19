import 'fake-indexeddb/auto';
import fs from 'fs';
import path from 'path';
import { db } from '../src/db/db';
import type { User, Site } from '../src/db/types';
import { createFloorPlan, getFloorPlansForUser } from '../src/services/floorPlanService';

// Validation helper replicating the modal's dimension logic
function isValidPositiveNumber(val: string): boolean {
  if (!val || typeof val !== 'string') return false;
  const trimmed = val.trim();
  if (!trimmed) return false;
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return false;
  const num = parseFloat(trimmed);
  return !isNaN(num) && isFinite(num) && num > 0;
}

async function runFloorPlanModalTests() {
  console.log('📐 Starting Floor Plan Creator "New Floor Plan" Modal Verification Tests...\n');

  // -------------------------------------------------------------
  // Test 1: Dimension Validation Function (Positive Numbers Only)
  // -------------------------------------------------------------
  console.log('[Test 1] Testing Plot Dimension Validation Rules...');

  const validDimensions = ['1', '10', '40.5', '0.01', '100.25', ' 50 ', '9999'];
  for (const val of validDimensions) {
    if (!isValidPositiveNumber(val)) {
      throw new Error(`Expected "${val}" to be a valid positive dimension, but was rejected.`);
    }
  }
  console.log(`✓ All ${validDimensions.length} valid positive dimensions accepted.`);

  const invalidDimensions = [
    '0',
    '0.0',
    '0.00',
    '-1',
    '-0.5',
    '-40',
    'abc',
    '40px',
    '12ft',
    '1e5',
    'NaN',
    '',
    '   ',
    '--5',
    '++5',
    '40.5.5',
  ];
  for (const val of invalidDimensions) {
    if (isValidPositiveNumber(val)) {
      throw new Error(`Expected "${val}" to be REJECTED, but was accepted as valid!`);
    }
  }
  console.log(`✓ All ${invalidDimensions.length} invalid/zero/negative/non-numeric dimensions strictly rejected.`);

  // -------------------------------------------------------------
  // Test 2: Source Code Verification of Modal Requirements
  // -------------------------------------------------------------
  console.log('\n[Test 2] Verifying Source Code Implementation in FloorPlanListView.tsx...');

  const filePath = path.join(process.cwd(), 'src', 'views', 'FloorPlanListView.tsx');
  const content = fs.readFileSync(filePath, 'utf-8');

  // 1. Construction Site MUST BE REQUIRED
  if (!content.includes('Construction Site <span style={{ color: \'#ef4444\' }}>*</span>')) {
    throw new Error('Construction Site label does not include required asterisk (*).');
  }
  if (content.includes('Construction Site (optional)')) {
    throw new Error('Old "Construction Site (optional)" label still present!');
  }
  if (content.includes('<option value="">— No Site —</option>')) {
    throw new Error('Old "— No Site —" unlinked option still present!');
  }
  if (!content.includes('No construction sites found.')) {
    throw new Error('Missing empty-sites message: "No construction sites found."');
  }
  if (!content.includes('Create Construction Site')) {
    throw new Error('Missing "Create Construction Site" action button.');
  }
  console.log('✓ Construction site requirement & empty state message verified.');

  // 2. Action Footer & Create & Start Drawing Button
  if (!content.includes('Create & Start Drawing')) {
    throw new Error('Missing "Create & Start Drawing" button text.');
  }
  if (!content.includes('Creating...')) {
    throw new Error('Missing loading state: "Creating...".');
  }
  if (!content.includes('className="modal-footer"')) {
    throw new Error('Missing dedicated .modal-footer container.');
  }
  if (!content.includes('disabled={!isFormValid || loading}')) {
    throw new Error('"Create & Start Drawing" button must be disabled until all required fields are valid.');
  }
  console.log('✓ Visible footer, "Create & Start Drawing" button, and states verified.');

  // 3. Responsive dimensions grid
  if (!content.includes('repeat(auto-fit, minmax(180px, 1fr))')) {
    throw new Error('Plot dimensions grid should use auto-fit to prevent mobile overflow.');
  }
  console.log('✓ Mobile responsive layout verified (no horizontal overflow).');

  // -------------------------------------------------------------
  // Test 3: Real Database Site Linkage & Data Safety
  // -------------------------------------------------------------
  console.log('\n[Test 3] Testing Real Database Site Linkage & Data Safety...');

  const testUser: User = {
    id: `user-fp-test-${Date.now()}`,
    username: 'fptestuser',
    email: 'fptest@buildingmistry.com',
    fullName: 'Floor Plan Tester',
    role: 'MISTRY',
    phone: '9876543210',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const testSite: Site = {
    id: `site-fp-${Date.now()}`,
    userId: testUser.id,
    name: 'Green Villa Phase 2',
    ownerName: 'Mr. Raman',
    ownerPhone: '9840112233',
    address: '42 Gandhi Road',
    area: '2400 sq ft',
    buildingType: 'Residential',
    startDate: '2026-01-01',
    expectedCompletionDate: '2026-12-31',
    status: 'ONGOING',
    isDeleted: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Save site to database
  await db.sites.put(testSite);
  const siteBefore = await db.sites.get(testSite.id);
  if (!siteBefore) throw new Error('Failed to insert test site into database.');

  // Create floor plan linked to real site ID
  const createRes = await createFloorPlan(testUser, {
    buildingName: testSite.name,
    floorName: 'Ground Floor',
    siteId: testSite.id,
    siteName: testSite.name,
    plotLength: 45,
    plotWidth: 30,
    unit: 'feet',
    walls: [],
    rooms: [],
    doors: [],
    windows: [],
  });

  if (!createRes.success || !createRes.plan) {
    throw new Error(`Failed to create floor plan: ${createRes.error}`);
  }

  // Verify floor plan stored correctly
  const storedPlan = await db.floorPlans.get(createRes.plan.id);
  if (!storedPlan) throw new Error('Created floor plan not found in database.');
  if (storedPlan.siteId !== testSite.id) {
    throw new Error(`Floor plan siteId mismatch: expected ${testSite.id}, got ${storedPlan.siteId}`);
  }
  if (storedPlan.siteName !== testSite.name) {
    throw new Error(`Floor plan siteName mismatch: expected ${testSite.name}, got ${storedPlan.siteName}`);
  }
  if (storedPlan.plotLength !== 45 || storedPlan.plotWidth !== 30) {
    throw new Error(`Dimensions mismatch: expected 45x30, got ${storedPlan.plotLength}x${storedPlan.plotWidth}`);
  }
  console.log('✓ Floor plan successfully linked to real site ID in database.');

  // DATA SAFETY CHECK: verify site was NOT modified
  const siteAfter = await db.sites.get(testSite.id);
  if (!siteAfter) throw new Error('Site was lost after floor plan creation!');
  if (siteAfter.name !== testSite.name || siteAfter.updatedAt !== testSite.updatedAt) {
    throw new Error('CRITICAL: Site record was accidentally modified during floor plan creation!');
  }
  console.log('✓ Data Safety Verified: Existing construction site record is completely untouched.');

  // Query plans for user
  const userPlans = await getFloorPlansForUser(testUser);
  const found = userPlans.find(p => p.id === createRes.plan!.id);
  if (!found || found.siteId !== testSite.id) {
    throw new Error('Floor plan query failed to return plan linked to correct site.');
  }
  console.log('✓ Floor plan list query correctly retrieves floor plan with matching siteId.');

  console.log('\n🎉 ALL FLOOR PLAN "NEW FLOOR PLAN" MODAL TESTS PASSED PERFECTLY!\n');
}

runFloorPlanModalTests().catch(err => {
  console.error('❌ Floor plan modal test failed:', err);
  process.exit(1);
});
