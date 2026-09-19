import {
  computeWallSegmentsWithOpenings,
  calculatePlanBoundingBox,
  findHostWallForOpening,
  ARCHITECTURAL_WINDOW_TYPES,
} from '../src/services/geometryEngine';
import type { FloorPlanWall, FloorPlanDoor, FloorPlanWindow, FloorPlanRoom } from '../src/db/types';

function runCADWallOpeningsAndCanvasTests() {
  console.log('📐 Running CAD Wall Openings, True Thickness & Canvas Engine Tests...\n');

  // Test 1: computeWallSegmentsWithOpenings without openings
  console.log('[Test 1] computeWallSegmentsWithOpenings on solid wall...');
  const solidWall: FloorPlanWall = {
    id: 'w-solid',
    x1: 0,
    y1: 0,
    x2: 200,
    y2: 0,
    thickness: 0.75,
    wallType: 'exterior',
  };
  const resNoOpenings = computeWallSegmentsWithOpenings(solidWall, [], []);
  if (resNoOpenings.solidSegments.length !== 1) {
    throw new Error(`Expected 1 solid segment, got ${resNoOpenings.solidSegments.length}`);
  }
  if (resNoOpenings.solidSegments[0].tStart !== 0 || resNoOpenings.solidSegments[0].tEnd !== 200) {
    throw new Error(`Expected segment [0, 200], got [${resNoOpenings.solidSegments[0].tStart}, ${resNoOpenings.solidSegments[0].tEnd}]`);
  }
  if (resNoOpenings.openings.length !== 0) {
    throw new Error(`Expected 0 openings, got ${resNoOpenings.openings.length}`);
  }
  console.log('✓ Solid wall produces a single continuous [0, 200] segment.');

  // Test 2: computeWallSegmentsWithOpenings with Door Cutout
  console.log('\n[Test 2] computeWallSegmentsWithOpenings with physical door opening cutout...');
  const door: FloorPlanDoor = {
    id: 'd-1',
    x: 100, // Midpoint of 200px wall
    y: 0,
    width: 30, // 30px width on 200px wall => spans 85 to 115
    swingDirection: 'inside-left',
    doorType: 'single',
    rotation: 0,
  };
  const resWithDoor = computeWallSegmentsWithOpenings(solidWall, [door], []);
  if (resWithDoor.openings.length !== 1) {
    throw new Error(`Expected 1 opening, got ${resWithDoor.openings.length}`);
  }
  if (resWithDoor.solidSegments.length !== 2) {
    throw new Error(`Expected 2 solid segments (left and right of door), got ${resWithDoor.solidSegments.length}`);
  }
  const seg1 = resWithDoor.solidSegments[0];
  const seg2 = resWithDoor.solidSegments[1];
  if (seg1.tStart !== 0 || Math.abs(seg1.tEnd - 85) > 0.01) {
    throw new Error(`Expected seg1 [0, 85], got [${seg1.tStart}, ${seg1.tEnd}]`);
  }
  if (Math.abs(seg2.tStart - 115) > 0.01 || seg2.tEnd !== 200) {
    throw new Error(`Expected seg2 [115, 200], got [${seg2.tStart}, ${seg2.tEnd}]`);
  }
  console.log(`✓ Wall physically cuts open: seg1=[0, ${seg1.tEnd}], seg2=[${seg2.tStart}, ${seg2.tEnd}], opening width=${resWithDoor.openings[0].width}px`);

  // Test 3: findHostWallForOpening snapping and host wall inheritance
  console.log('\n[Test 3] findHostWallForOpening snapping & host thickness inheritance...');
  const walls: FloorPlanWall[] = [
    { id: 'w-ext', x1: 50, y1: 50, x2: 250, y2: 50, thickness: 0.75, wallType: 'exterior' },
    { id: 'w-int', x1: 50, y1: 50, x2: 50, y2: 200, thickness: 0.5, wallType: 'interior' },
  ];

  // Point at (120, 55) is 5px away from w-ext (threshold 20px)
  const host = findHostWallForOpening(120, 55, walls, 20);
  if (!host) {
    throw new Error('Expected host wall to be found for (120, 55)');
  }
  if (host.wall.id !== 'w-ext') {
    throw new Error(`Expected host wall 'w-ext', got '${host.wall.id}'`);
  }
  if (host.wallThickness !== 0.75) {
    throw new Error(`Expected host wallThickness 0.75, got ${host.wallThickness}`);
  }
  if (Math.abs(host.projectedY - 50) > 0.001) {
    throw new Error(`Expected projected Y=50, got ${host.projectedY}`);
  }

  // Point at (500, 500) is far from all walls
  const noHost = findHostWallForOpening(500, 500, walls, 20);
  if (noHost !== null) {
    throw new Error('Expected null host wall for distant point (500, 500)');
  }
  console.log('✓ Opening snaps to host wall and inherits wallThickness (0.75 ft / 9").');

  // Test 4: calculatePlanBoundingBox with geometry & plot fallback
  console.log('\n[Test 4] calculatePlanBoundingBox geometry & plot calculation...');
  const testWalls: FloorPlanWall[] = [
    { id: 'w1', x1: 100, y1: 100, x2: 400, y2: 100, thickness: 0.75, wallType: 'exterior' },
    { id: 'w2', x1: 400, y1: 100, x2: 400, y2: 350, thickness: 0.75, wallType: 'exterior' },
  ];
  const testRooms: FloorPlanRoom[] = [
    { id: 'r1', name: 'Master Bed', roomType: 'Bedroom', x: 100, y: 100, width: 300, height: 250 },
  ];

  const bbox = calculatePlanBoundingBox(testWalls, testRooms, [], [], [], [], [], 50, 40);
  if (bbox.minX !== 100 || bbox.maxX !== 400 || bbox.minY !== 100 || bbox.maxY !== 350) {
    throw new Error(`Bbox bounds incorrect: expected [100, 100] to [400, 350], got [${bbox.minX}, ${bbox.minY}] to [${bbox.maxX}, ${bbox.maxY}]`);
  }
  if (bbox.width !== 300 || bbox.height !== 250) {
    throw new Error(`Bbox dimension mismatch: expected 300x250, got ${bbox.width}x${bbox.height}`);
  }
  if (bbox.centerX !== 250 || bbox.centerY !== 225) {
    throw new Error(`Bbox center mismatch: expected (250, 225), got (${bbox.centerX}, ${bbox.centerY})`);
  }

  // Fallback when no geometry: uses plot dimensions
  const fallbackBbox = calculatePlanBoundingBox([], [], [], [], [], [], [], 50, 40);
  if (fallbackBbox.width !== 50 || fallbackBbox.height !== 40) {
    throw new Error(`Expected plot fallback dimensions 50x40, got ${fallbackBbox.width}x${fallbackBbox.height}`);
  }
  console.log(`✓ Bounding box correctly measures geometry (300x250) and plot fallback (50x40).`);

  // Test 5: ARCHITECTURAL_WINDOW_TYPES specs
  console.log('\n[Test 5] ARCHITECTURAL_WINDOW_TYPES specs verification...');
  const expectedTypes = [
    'Single Window',
    'Double Window',
    'Sliding Window',
    'Large Window',
    'Bay Window',
    'Corner Window',
    'Fixed Window',
    'Ventilator',
  ];
  for (const type of expectedTypes) {
    const spec = ARCHITECTURAL_WINDOW_TYPES.find(w => w.type === type);
    if (!spec) {
      throw new Error(`Missing spec for architectural window type: ${type}`);
    }
    if (spec.defaultWidth <= 0 || spec.defaultHeight <= 0) {
      throw new Error(`Invalid dimensions for ${type}: ${spec.defaultWidth}x${spec.defaultHeight}`);
    }
    if (spec.defaultSillHeight < 0) {
      throw new Error(`Invalid sill height for ${type}: ${spec.defaultSillHeight}`);
    }
    if (spec.frameThickness <= 0) {
      throw new Error(`Invalid frame thickness for ${type}: ${spec.frameThickness}`);
    }
  }
  console.log(`✓ All 8 architectural window types have verified CAD dimensions, sills, and glazing.`);

  console.log('\n🎉 ALL CAD Wall Openings, True Thickness & Canvas Tests PASSED SUCCESSFULLY!\n');
}

runCADWallOpeningsAndCanvasTests();
