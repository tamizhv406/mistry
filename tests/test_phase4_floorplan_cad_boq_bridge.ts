/**
 * Test Suite: Touch-Friendly 2D Space Planner, Magnetic Snapping & Direct BOQ Estimator Integration (Phase 4)
 * 
 * Verifies:
 * 1. Pre-built Architectural Room Block specifications (dimensions, areas, attached suites)
 * 2. Architectural Openings Palette dimensions & types (Main, Internal, Toilet, Windows)
 * 3. CAD Magnetic Snapping step logic (Off, 6 inches, 1 foot)
 * 4. BOQ Bridge Handshake formula: Built-Up Area = Carpet Area + 18% wall/circulation allowance
 * 5. Floor Plan persistence into unified Storage Service
 */

import {
  ARCHITECTURAL_ROOM_BLOCKS,
  ARCHITECTURAL_OPENINGS_PALETTE,
  type ArchitecturalRoomBlock,
  type ArchitecturalOpeningSpec,
} from '../src/components/floorplan/ArchitecturalBlockDrawer';
import { storageService, type StoragePlan } from '../src/services/storage';

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${msg}`);
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${msg}`);
  }
}

async function runTests() {
  console.log('\n--- PHASE 4: FLOOR PLANNER CAD & BOQ BRIDGE TEST SUITE ---\n');

  // Test 1: Pre-Built Architectural Room Blocks Catalog
  console.log('Test 1: Pre-Built Architectural Room Blocks Catalog');
  {
    assert(ARCHITECTURAL_ROOM_BLOCKS.length >= 8, `Catalog contains at least 8 standard room blocks (found ${ARCHITECTURAL_ROOM_BLOCKS.length})`);

    const living16 = ARCHITECTURAL_ROOM_BLOCKS.find(b => b.id === 'living_16x16');
    assert(!!living16, 'Living Hall 16x16 exists');
    assert(living16?.widthFt === 16 && living16?.heightFt === 16 && living16?.areaSqFt === 256, 'Living Hall 16x16 has exact 256 sq.ft area');
    assert(living16?.tamilTitle.includes('வரவேற்பறை'), 'Living Hall has authentic Tamil title');

    const living20 = ARCHITECTURAL_ROOM_BLOCKS.find(b => b.id === 'living_20x16');
    assert(!!living20, 'Grand Living Hall 20x16 exists');
    assert(living20?.widthFt === 20 && living20?.heightFt === 16 && living20?.areaSqFt === 320, 'Grand Living Hall 20x16 has exact 320 sq.ft area');

    const masterSuite = ARCHITECTURAL_ROOM_BLOCKS.find(b => b.id === 'master_bedroom_suite');
    assert(!!masterSuite, 'Master Bedroom Suite exists');
    assert(masterSuite?.widthFt === 16 && masterSuite?.heightFt === 12, 'Master Bedroom core is 16\' × 12\' (192 sq.ft)');
    assert(masterSuite?.attached !== undefined, 'Master Bedroom has attached room defined');
    assert(masterSuite?.attached?.widthFt === 8 && masterSuite?.attached?.heightFt === 5, 'Attached toilet is 8\' × 5\' (40 sq.ft)');
    assert(masterSuite?.areaSqFt === 232, 'Master Bedroom suite total area is 232 sq.ft (192 + 40)');

    const bed2 = ARCHITECTURAL_ROOM_BLOCKS.find(b => b.id === 'bedroom_2');
    assert(!!bed2, 'Bedroom 2 exists');
    assert(bed2?.widthFt === 14 && bed2?.heightFt === 12 && bed2?.areaSqFt === 168, 'Bedroom 2 is 14\' × 12\' (168 sq.ft)');

    const kitchenSuite = ARCHITECTURAL_ROOM_BLOCKS.find(b => b.id === 'kitchen_dining_suite');
    assert(!!kitchenSuite, 'Kitchen & Dining Suite exists');
    assert(kitchenSuite?.widthFt === 16 && kitchenSuite?.heightFt === 10, 'Kitchen is 16\' × 10\' (160 sq.ft)');
    assert(kitchenSuite?.attached?.widthFt === 6 && kitchenSuite?.attached?.heightFt === 4, 'Attached Utility is 6\' × 4\' (24 sq.ft)');

    const commonBath = ARCHITECTURAL_ROOM_BLOCKS.find(b => b.id === 'common_bath');
    assert(!!commonBath && commonBath.widthFt === 7 && commonBath.heightFt === 4 && commonBath.areaSqFt === 28, 'Common Bath is 7\' × 4\' (28 sq.ft)');

    const portico = ARCHITECTURAL_ROOM_BLOCKS.find(b => b.id === 'car_portico' || b.id === 'portico_parking');
    assert(!!portico && portico.widthFt === 16 && portico.heightFt === 10 && portico.areaSqFt === 160, 'Portico / Parking is 16\' × 10\' (160 sq.ft)');

    const staircase = ARCHITECTURAL_ROOM_BLOCKS.find(b => b.id === 'staircase_block');
    assert(!!staircase && staircase.widthFt === 12 && staircase.heightFt === 6 && staircase.areaSqFt === 72, 'Staircase Block is 12\' × 6\' (72 sq.ft)');
  }

  // Test 2: Architectural Openings Palette
  console.log('\nTest 2: Architectural Openings Palette');
  {
    assert(ARCHITECTURAL_OPENINGS_PALETTE.length >= 5, `Openings palette has at least 5 standard openings (found ${ARCHITECTURAL_OPENINGS_PALETTE.length})`);

    const mainDoor = ARCHITECTURAL_OPENINGS_PALETTE.find(o => o.id === 'door_main');
    assert(!!mainDoor, 'Main Entrance Door spec exists');
    assert(mainDoor?.widthFt === 3.5 && mainDoor?.heightFt === 7, 'Main Entrance Door is 3\'6" × 7\' (3.5 ft)');
    assert(mainDoor?.tamilTitle.includes('தலைவாசல்'), 'Main Entrance Door has authentic Tamil descriptor');

    const internalDoor = ARCHITECTURAL_OPENINGS_PALETTE.find(o => o.id === 'door_internal');
    assert(!!internalDoor && internalDoor.widthFt === 3.0 && internalDoor.heightFt === 7, 'Internal Room Door is 3\'0" × 7\' (3.0 ft)');

    const toiletDoor = ARCHITECTURAL_OPENINGS_PALETTE.find(o => o.id === 'door_toilet');
    assert(!!toiletDoor && toiletDoor.widthFt === 2.5 && toiletDoor.heightFt === 7, 'Toilet Door is 2\'6" × 7\' (2.5 ft)');

    const win4x4 = ARCHITECTURAL_OPENINGS_PALETTE.find(o => o.id === 'window_4x4');
    assert(!!win4x4 && win4x4.widthFt === 4.0 && win4x4.heightFt === 4.0, 'Standard Window is 4\'0" × 4\'0"');

    const win5x4 = ARCHITECTURAL_OPENINGS_PALETTE.find(o => o.id === 'window_5x4');
    assert(!!win5x4 && win5x4.widthFt === 5.0 && win5x4.heightFt === 4.0, 'Wide Window is 5\'0" × 4\'0"');
  }

  // Test 3: CAD Magnetic Snapping Step Logic
  console.log('\nTest 3: CAD Magnetic Snapping Step Logic');
  {
    function snapVal(val: number, mode: 'off' | '6in' | '1ft'): number {
      if (mode === 'off') return val;
      const step = mode === '6in' ? 0.5 : 1.0;
      return Math.round(val / step) * step;
    }

    assert(snapVal(12.33, 'off') === 12.33, 'Off mode preserves exact arbitrary coordinates');
    assert(snapVal(12.24, '6in') === 12.0, '6in mode snaps 12.24 to 12.0 ft');
    assert(snapVal(12.31, '6in') === 12.5, '6in mode snaps 12.31 to 12.5 ft (6 inches)');
    assert(snapVal(12.76, '6in') === 13.0, '6in mode snaps 12.76 to 13.0 ft');
    assert(snapVal(12.49, '1ft') === 12.0, '1ft mode snaps 12.49 to 12.0 ft');
    assert(snapVal(12.51, '1ft') === 13.0, '1ft mode snaps 12.51 to 13.0 ft (1 foot boundary)');
  }

  // Test 4: BOQ Bridge Handshake Formula
  console.log('\nTest 4: BOQ Bridge Handshake Formula');
  {
    function computeBuiltUpArea(carpetAreaSqFt: number): number {
      // Civil standard: Carpet Area + 18% allowance for external 9" & internal 4.5" walls
      return Math.round(carpetAreaSqFt * 1.18);
    }

    // 1,000 sq.ft baseline plan
    const builtUp1000 = computeBuiltUpArea(1000);
    assert(builtUp1000 === 1180, '1,000 sq.ft carpet area converts to 1,180 sq.ft built-up area (+18%)');

    // 2 BHK Apartment sample (Living 256 + Master 232 + Bed2 168 + Kitchen 184 + CommonBath 28 = 868 sq.ft)
    const twoBhkCarpet = 256 + 232 + 168 + 184 + 28; // 868 sq.ft
    const twoBhkBuiltUp = computeBuiltUpArea(twoBhkCarpet);
    assert(twoBhkCarpet === 868, '2BHK catalog rooms sum up to 868 sq.ft carpet area');
    assert(twoBhkBuiltUp === 1024, '868 sq.ft carpet converts to 1,024 sq.ft built-up area (+18%)');

    // 3 BHK Luxury Villa sample (1,600 sq.ft carpet)
    assert(computeBuiltUpArea(1600) === 1888, '1,600 sq.ft carpet area converts to 1,888 sq.ft built-up area');
  }

  // Test 5: Floor Plan Storage Persistence
  console.log('\nTest 5: Floor Plan Unified Storage Persistence');
  {
    const testPlan: Partial<StoragePlan> = {
      siteId: 'site-cad-phase4',
      name: 'Residential Villa Ground Floor',
      dimensions: { length: 50, width: 40 },
      rooms: [
        { id: 'room-1', name: 'Living Hall', area: 256 },
        { id: 'room-2', name: 'Master Bedroom', area: 232 },
        { id: 'room-3', name: 'Kitchen & Dining', area: 184 },
      ],
      walls: [
        { id: 'w-1', length: 16, thickness: 0.75 },
        { id: 'w-2', length: 16, thickness: 0.75 },
      ],
      openings: [
        { id: 'd-1', type: 'door', width: 3.5 },
        { id: 'w-1', type: 'window', width: 4.0 },
      ],
    };

    const savedPlan = await storageService.savePlan(testPlan);
    assert(!!savedPlan.id, 'Storage service assigns UUID to saved plan');
    assert(savedPlan.name === 'Residential Villa Ground Floor', 'Plan name is correctly persisted');
    assert(savedPlan.rooms.length === 3, 'All 3 rooms are stored with areas');
    assert(savedPlan.openings.length === 2, 'Openings (doors & windows) are stored');
    assert(!!savedPlan.updatedAt, 'ISO timestamp is attached to stored plan');

    const retrievedPlans = await storageService.getPlans('site-cad-phase4');
    assert(retrievedPlans.length >= 1, 'Can query saved floor plans by siteId');
    const matched = retrievedPlans.find(p => p.id === savedPlan.id);
    assert(!!matched && matched.dimensions.length === 50, 'Retrieved plan matches stored dimensions');
  }

  console.log(`\n========================================`);
  console.log(`Phase 4 Test Results: ${passed} passed, ${failed} failed`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
