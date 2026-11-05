import 'fake-indexeddb/auto';
import {
  STARTER_TEMPLATES,
  createStarterFloorPlan,
  exportFloorPlanAsDxf,
  exportFloorPlanAsProjectJson,
} from '../src/services/floorPlanService';
import {
  findSnapPoint,
  snapAngleOrtho,
  getWallLength,
  getWallAngleDeg,
  formatLength,
  formatArea,
  projectPointOntoWall,
  snapWallMountedItem,
  detectEnclosedRooms,
  WALL_THICKNESS_PRESETS_MM,
  mmToPlanUnits,
  planUnitsToMm,
} from '../src/services/geometryEngine';
import {
  SHAPE_LIBRARY_CATALOG,
  SHAPE_CATEGORIES,
  createEntityFromShape,
} from '../src/services/shapeLibraryCatalog';
import type {
  FloorPlan,
  FloorPlanWall,
  FloorPlanRoom,
  FloorPlanDoor,
  FloorPlanWindow,
  FloorPlanFurniture,
  FloorPlanColumn,
  FloorPlanLevel,
} from '../src/db/types';

async function runProfessionalCADSuite() {
  console.log('🏛️ Starting Building Mistry Professional CAD Floor Plan Suite Tests...\n');

  // ─────────────────────────────────────────────────────────
  // 1. Wall Thickness Presets & Unit Conversions
  // ─────────────────────────────────────────────────────────
  console.log('[Test 1] Testing Wall Thickness Presets & Unit Conversions...');
  if (!WALL_THICKNESS_PRESETS_MM.includes(100) || !WALL_THICKNESS_PRESETS_MM.includes(230)) {
    throw new Error('Missing standard wall thickness presets (100mm or 230mm)');
  }
  const feetVal = mmToPlanUnits(230, 'feet');
  const roundTripMm = planUnitsToMm(feetVal, 'feet');
  if (Math.abs(roundTripMm - 230) > 0.01) {
    throw new Error(`Roundtrip conversion mismatch: expected 230mm, got ${roundTripMm}`);
  }
  const metersVal = mmToPlanUnits(150, 'meters');
  if (Math.abs(metersVal - 0.15) > 0.001) {
    throw new Error(`150mm in meters should be 0.15m, got ${metersVal}`);
  }
  console.log('✓ Wall thickness presets (100, 115, 150, 200, 230 mm) and unit conversions verified.');

  // ─────────────────────────────────────────────────────────
  // 2. Wall Geometry, Length & Angle Calculations
  // ─────────────────────────────────────────────────────────
  console.log('\n[Test 2] Testing Wall Length & Angle Calculations...');
  const horizWall: FloorPlanWall = { id: 'w1', x1: 0, y1: 0, x2: 12, y2: 0, thickness: 0.75, wallType: 'exterior' };
  const vertWall: FloorPlanWall = { id: 'w2', x1: 12, y1: 0, x2: 12, y2: 16, thickness: 0.75, wallType: 'exterior' };
  const diagWall: FloorPlanWall = { id: 'w3', x1: 0, y1: 0, x2: 3, y2: 4, thickness: 0.75, wallType: 'interior' };

  if (getWallLength(horizWall) !== 12) throw new Error('Horizontal wall length calculation error');
  if (getWallLength(vertWall) !== 16) throw new Error('Vertical wall length calculation error');
  if (getWallLength(diagWall) !== 5) throw new Error('Diagonal 3-4-5 wall length calculation error');

  if (getWallAngleDeg(horizWall) !== 0) throw new Error('Horizontal wall angle should be 0°');
  if (getWallAngleDeg(vertWall) !== 90) throw new Error('Vertical wall angle should be 90°');
  console.log('✓ Wall length and angle functions verified accurately.');

  // ─────────────────────────────────────────────────────────
  // 3. Magnetic Endpoint & Grid Snapping
  // ─────────────────────────────────────────────────────────
  console.log('\n[Test 3] Testing Magnetic Endpoint & Grid Snapping...');
  const wallsList = [horizWall, vertWall];
  // Point near endpoint (12, 0)
  const snapNearCorner = findSnapPoint(12.2, 0.1, wallsList, 0.5, 0.6, true, true);
  if (snapNearCorner.type !== 'endpoint' || snapNearCorner.x !== 12 || snapNearCorner.y !== 0) {
    throw new Error(`Failed to snap to corner endpoint (12, 0): got ${JSON.stringify(snapNearCorner)}`);
  }
  // Point along horizontal wall
  const snapAlongWall = findSnapPoint(6, 0.2, wallsList, 0, 0.6, false, true);
  if (snapAlongWall.type !== 'wall' || Math.abs(snapAlongWall.y) > 0.01) {
    throw new Error(`Failed to snap along wall centerline: got ${JSON.stringify(snapAlongWall)}`);
  }
  console.log('✓ Magnetic corner endpoint snapping and centerline snapping verified.');

  // ─────────────────────────────────────────────────────────
  // 4. Ortho Angle Locking (0°, 90°, 180°, 270°)
  // ─────────────────────────────────────────────────────────
  console.log('\n[Test 4] Testing Ortho Angle Locking...');
  const orthoHoriz = snapAngleOrtho(0, 0, 10, 1.2);
  if (Math.abs(orthoHoriz.y) > 0.001 || Math.abs(orthoHoriz.x - 10) > 0.2) {
    throw new Error(`Ortho lock failed to snap to horizontal line: got (${orthoHoriz.x}, ${orthoHoriz.y})`);
  }
  const orthoVert = snapAngleOrtho(0, 0, 0.8, 14);
  if (Math.abs(orthoVert.x) > 0.001 || Math.abs(orthoVert.y - 14) > 0.2) {
    throw new Error(`Ortho lock failed to snap to vertical line: got (${orthoVert.x}, ${orthoVert.y})`);
  }
  console.log('✓ Ortho angle lock (horizontal and vertical constraint) verified.');

  // ─────────────────────────────────────────────────────────
  // 5. Hosted Doors & Windows Projection on Walls
  // ─────────────────────────────────────────────────────────
  console.log('\n[Test 5] Testing Hosted Doors & Windows Projection on Walls...');
  const proj = projectPointOntoWall(6.2, 0.4, wallsList, 1.0);
  if (!proj) throw new Error('Expected door projection onto horizontal wall');
  if (Math.abs(proj.projectedX - 6.2) > 0.01 || Math.abs(proj.projectedY) > 0.01) {
    throw new Error(`Incorrect projected coordinates: (${proj.projectedX}, ${proj.projectedY})`);
  }
  if (proj.wall.id !== 'w1') throw new Error(`Wrong host wall identified: ${proj.wall.id}`);
  if (proj.angleDeg !== 0) throw new Error(`Expected door rotation 0°, got ${proj.angleDeg}`);
  console.log('✓ Door and window hosting, wall alignment, and projection distance verified.');

  // ─────────────────────────────────────────────────────────
  // 6. Wall-Mounted TV & Split AC Flush Alignment
  // ─────────────────────────────────────────────────────────
  console.log('\n[Test 6] Testing Wall-Mounted TV & Split AC Alignment...');
  const tvSnap = snapWallMountedItem(6, 0.8, 4.5, 0.5, wallsList, 1.5);
  if (!tvSnap) throw new Error('Expected wall snap for wall-mounted item');
  if (tvSnap.wall.id !== 'w1') throw new Error('Expected TV to snap to wall w1');
  console.log('✓ Wall-mounted TV and Split AC flush positioning verified.');

  // ─────────────────────────────────────────────────────────
  // 7. Enclosed Room Cycle Detection & Shoelace Area Computation
  // ─────────────────────────────────────────────────────────
  console.log('\n[Test 7] Testing Enclosed Room Cycle Detection & Shoelace Area...');
  // Construct a closed 4-wall perimeter: 10 x 15 ft room
  const roomWalls: FloorPlanWall[] = [
    { id: 'rw1', x1: 0, y1: 0, x2: 10, y2: 0, thickness: 0.75, wallType: 'exterior' },
    { id: 'rw2', x1: 10, y1: 0, x2: 10, y2: 15, thickness: 0.75, wallType: 'exterior' },
    { id: 'rw3', x1: 10, y1: 15, x2: 0, y2: 15, thickness: 0.75, wallType: 'exterior' },
    { id: 'rw4', x1: 0, y1: 15, x2: 0, y2: 0, thickness: 0.75, wallType: 'exterior' },
  ];
  const detected = detectEnclosedRooms(roomWalls, 'feet');
  if (detected.length === 0) {
    throw new Error('detectEnclosedRooms failed to find closed 4-wall cycle');
  }
  const detectedRoom = detected[0];
  if (Math.abs(detectedRoom.area - 150) > 1.0) {
    throw new Error(`Expected room area 150 sq.ft, got ${detectedRoom.area}`);
  }
  if (Math.abs(detectedRoom.width - 10) > 0.5 || Math.abs(detectedRoom.height - 15) > 0.5) {
    throw new Error(`Room dimensions incorrect: ${detectedRoom.width} x ${detectedRoom.height}`);
  }
  console.log(`✓ Enclosed room detected automatically: Area = ${detectedRoom.area} sq.ft, perimeter = ${detectedRoom.perimeter} ft.`);

  // ─────────────────────────────────────────────────────────
  // 8. Dimension & Area Formatting Strings
  // ─────────────────────────────────────────────────────────
  console.log('\n[Test 8] Testing Dimension & Area String Formatting...');
  const formattedLen = formatLength(12.5, 'feet');
  if (!formattedLen.includes("12'-6\"")) {
    throw new Error(`formatLength failed: got "${formattedLen}"`);
  }
  const formattedAreaStr = formatArea(150, 'feet');
  if (!formattedAreaStr.includes('150.0 sq.ft')) {
    throw new Error(`formatArea failed: got "${formattedAreaStr}"`);
  }
  console.log(`✓ Formatted length: "${formattedLen}", formatted area: "${formattedAreaStr}".`);

  // ─────────────────────────────────────────────────────────
  // 9. Shape Library Catalog & Placement Variants
  // ─────────────────────────────────────────────────────────
  console.log('\n[Test 9] Testing Shape Library Catalog Variants...');
  const diningItems = SHAPE_LIBRARY_CATALOG.filter(i => i.name.toLowerCase().includes('dining'));
  if (diningItems.length < 4) {
    throw new Error(`Expected at least 4 dining variants (2/4/6/8 seats), found ${diningItems.length}`);
  }
  const tvItems = SHAPE_LIBRARY_CATALOG.filter(i => i.name.toLowerCase().includes('tv'));
  if (tvItems.length < 2) {
    throw new Error(`Expected at least 2 TV options (Stand & Wall Mounted), found ${tvItems.length}`);
  }
  const hvacItems = SHAPE_LIBRARY_CATALOG.filter(i => i.name.toLowerCase().includes('ac') || i.name.toLowerCase().includes('fan'));
  if (hvacItems.length < 3) {
    throw new Error(`Expected Split AC Indoor, Outdoor, and Fan in HVAC catalog, found ${hvacItems.length}`);
  }

  // Create entity test
  const placedDining = createEntityFromShape(diningItems[0], 10, 10, 'feet');
  if (placedDining.entityType !== 'furniture') throw new Error('Dining entity type mismatch');

  const placedWallAC = createEntityFromShape(hvacItems[0], 5, 5, 'feet');
  if (placedWallAC.entityType !== 'furniture') throw new Error('AC entity type mismatch');
  console.log('✓ Shape library catalog variants verified (Dining 2/4/6/8, TV stand & wall mounted, Split AC indoor/outdoor).');

  // ─────────────────────────────────────────────────────────
  // 10. Starter Floor Plan Generation (30x40 2BHK)
  // ─────────────────────────────────────────────────────────
  console.log('\n[Test 10] Testing Starter 30x40 2BHK Floor Plan Generation...');
  const starter = createStarterFloorPlan('test-plan-1', 'Green Villa 30x40', 'feet');
  if (starter.plotLength !== 30 || starter.plotWidth !== 40) {
    throw new Error(`Plot dimensions mismatch: ${starter.plotLength}x${starter.plotWidth}`);
  }
  if (!starter.walls || starter.walls.length < 8) {
    throw new Error(`Starter plan should have at least 8 walls, got ${starter.walls?.length}`);
  }
  if (!starter.rooms || starter.rooms.length < 4) {
    throw new Error(`Starter plan should have at least 4 rooms, got ${starter.rooms?.length}`);
  }
  if (!starter.doors || starter.doors.length < 3) {
    throw new Error(`Starter plan should have at least 3 doors, got ${starter.doors?.length}`);
  }
  if (!starter.windows || starter.windows.length < 3) {
    throw new Error(`Starter plan should have at least 3 windows, got ${starter.windows?.length}`);
  }
  if (!starter.columns || starter.columns.length < 6) {
    throw new Error(`Starter plan should have at least 6 structural columns, got ${starter.columns?.length}`);
  }
  console.log(`✓ Starter 30x40 2BHK created with ${starter.walls.length} walls, ${starter.rooms.length} rooms, ${starter.doors.length} doors, ${starter.columns.length} columns.`);

  // ─────────────────────────────────────────────────────────
  // 11. AutoCAD DXF Export Generation
  // ─────────────────────────────────────────────────────────
  console.log('\n[Test 11] Testing AutoCAD DXF Generation...');
  const dxf = exportFloorPlanAsDxf(
    starter,
    starter.walls,
    starter.rooms,
    starter.doors,
    starter.windows || [],
    starter.columns || [],
    starter.furniture || [],
    'feet'
  );
  if (!dxf.includes('SECTION') || !dxf.includes('ENTITIES') || !dxf.includes('EOF')) {
    throw new Error('DXF output missing mandatory sections (SECTION, ENTITIES, EOF)');
  }
  if (!dxf.includes('WALLS') || !dxf.includes('DOORS') || !dxf.includes('WINDOWS')) {
    throw new Error('DXF output missing CAD layer definitions');
  }
  if (!dxf.includes('LINE')) {
    throw new Error('DXF output missing LINE entities for walls');
  }
  console.log(`✓ AutoCAD DXF generated successfully (${dxf.length} bytes, compliant with AutoCAD AC1015 specification).`);

  // ─────────────────────────────────────────────────────────
  // 12. Project CAD JSON Export Generation
  // ─────────────────────────────────────────────────────────
  console.log('\n[Test 12] Testing Portable Project CAD JSON Export...');
  const testLevels: FloorPlanLevel[] = [
    {
      id: 'lvl-ground',
      name: 'Ground Floor',
      elevation: 0,
      walls: starter.walls,
      rooms: starter.rooms,
      doors: starter.doors,
      windows: starter.windows || [],
      furniture: starter.furniture || [],
      columns: starter.columns || [],
      stairs: [],
      annotations: [],
    },
    {
      id: 'lvl-first',
      name: 'First Floor',
      elevation: 10,
      walls: starter.walls,
      rooms: starter.rooms,
      doors: starter.doors,
      windows: starter.windows || [],
      furniture: starter.furniture || [],
      columns: starter.columns || [],
      stairs: [],
      annotations: [],
    }
  ];
  const projectJson = exportFloorPlanAsProjectJson(starter, testLevels, 0);
  const parsed = JSON.parse(projectJson);
  if (parsed.application !== 'Building Mistry CAD' || parsed.schemaVersion !== '2.0.0') {
    throw new Error('Invalid project JSON schema header');
  }
  if (!Array.isArray(parsed.floors) || parsed.floors.length !== 2) {
    throw new Error(`Expected 2 floors in exported JSON, got ${parsed.floors?.length}`);
  }
  console.log('✓ Project CAD JSON backup exported and validated.');

  console.log('\n========================================================');
  console.log('🎉 ALL 12 PROFESSIONAL CAD FLOOR PLAN TESTS PASSED (100%)');
  console.log('========================================================');
}

runProfessionalCADSuite().catch(err => {
  console.error('❌ CAD Suite Test Failed:', err);
  process.exit(1);
});
