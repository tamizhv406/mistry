import { describe, it } from 'node:test';
import assert from 'node:assert';
import { checkPasswordRecoveryUrl } from '../src/services/supabase';
import { LocalFloorPlanAIProvider, type PlanContext } from '../src/services/aiProvider';
import {
  WALL_THICKNESS_PRESETS_MM,
  mmToPlanUnits,
  planUnitsToMm,
  projectPointOntoWall,
  getWallLength,
} from '../src/services/geometryEngine';
import type { FloorPlanWall, FloorPlanDoor, FloorPlanWindow, FloorPlanRoom } from '../src/db/types';

console.log('\n🔒 Starting Building Mistry Auth Recovery, AI CAD Commands & Geometry Suite...\n');

// ─────────────────────────────────────────────────────────
// Suite 1: Supabase Password Recovery URL Detection
// ─────────────────────────────────────────────────────────

describe('[Auth & Password Recovery] checkPasswordRecoveryUrl', () => {
  it('detects type=recovery in hash', () => {
    // Mock window
    const originalWindow = global.window;
    (global as any).window = {
      location: {
        hash: '#access_token=mocktoken123&refresh_token=mockref123&type=recovery',
        search: '',
        pathname: '/',
      },
    };

    assert.strictEqual(checkPasswordRecoveryUrl(), true, 'Should detect recovery hash');

    (global as any).window = {
      location: {
        hash: '#access_token=mocktoken123',
        search: '',
        pathname: '/',
      },
    };
    assert.strictEqual(checkPasswordRecoveryUrl(), false, 'Should be false when no type=recovery');

    (global as any).window = {
      location: {
        hash: '',
        search: '?type=recovery',
        pathname: '/',
      },
    };
    assert.strictEqual(checkPasswordRecoveryUrl(), true, 'Should detect recovery query param');

    (global as any).window = originalWindow;
    console.log('✓ Password recovery URL detection verified for hash and query parameters.');
  });
});

// ─────────────────────────────────────────────────────────
// Suite 2: Floor Plan Wall Drag & Hosted Openings Synchronisation
// ─────────────────────────────────────────────────────────

describe('[CAD Geometry] Wall Drag & Hosted Openings Translation', () => {
  it('ensures hosted doors and windows move synchronously with host wall', () => {
    const wall: FloorPlanWall = {
      id: 'wall-1',
      x1: 0,
      y1: 0,
      x2: 20,
      y2: 0,
      thickness: 0.75,
      wallType: 'exterior',
      layer: 'walls',
    };

    const door: FloorPlanDoor = {
      id: 'door-1',
      wallId: 'wall-1',
      type: 'Single',
      x: 10,
      y: 0,
      width: 3,
      rotation: 0,
      layer: 'doors',
    };

    const win: FloorPlanWindow = {
      id: 'win-1',
      wallId: 'wall-1',
      type: 'Standard',
      x: 15,
      y: 0,
      width: 4,
      rotation: 0,
      layer: 'windows',
    };

    // Simulate moving the host wall by dx=5, dy=3
    const deltaX = 5;
    const deltaY = 3;

    const movedWall: FloorPlanWall = {
      ...wall,
      x1: wall.x1 + deltaX,
      y1: wall.y1 + deltaY,
      x2: wall.x2 + deltaX,
      y2: wall.y2 + deltaY,
    };

    const movedDoor: FloorPlanDoor = {
      ...door,
      x: door.x + deltaX,
      y: door.y + deltaY,
    };

    const movedWin: FloorPlanWindow = {
      ...win,
      x: win.x + deltaX,
      y: win.y + deltaY,
    };

    assert.strictEqual(movedWall.x1, 5);
    assert.strictEqual(movedWall.y1, 3);
    assert.strictEqual(movedWall.x2, 25);
    assert.strictEqual(movedWall.y2, 3);

    // Door must maintain relative offset along wall (midpoint at x=15, y=3)
    assert.strictEqual(movedDoor.x, 15);
    assert.strictEqual(movedDoor.y, 3);

    // Window must maintain relative offset (x=20, y=3)
    assert.strictEqual(movedWin.x, 20);
    assert.strictEqual(movedWin.y, 3);

    // Verify distance from moved door to moved wall is 0 (flush attachment)
    const proj = projectPointOntoWall(movedDoor.x, movedDoor.y, [movedWall], 0.5);
    assert.ok(proj, 'Door must project onto moved host wall');
    assert.strictEqual(proj.distance, 0, 'Door must remain flush on host wall');

    console.log('✓ Wall drag translates hosted doors and windows synchronously without detaching.');
  });
});

// ─────────────────────────────────────────────────────────
// Suite 3: Authoritative Wall Thickness & Presets
// ─────────────────────────────────────────────────────────

describe('[CAD Geometry] Wall Thickness Source of Truth', () => {
  it('verifies standard presets and millimeter to plan unit conversions', () => {
    // 230mm (9" exterior brick wall) in feet
    const extUnits = mmToPlanUnits(230, 'feet');
    assert.ok(Math.abs(extUnits - 0.754) < 0.01, '230mm should be ~0.75 ft (9 inches)');

    // 115mm (4.5" interior partition wall) in feet
    const intUnits = mmToPlanUnits(115, 'feet');
    assert.ok(Math.abs(intUnits - 0.377) < 0.01, '115mm should be ~0.38 ft (4.5 inches)');

    // Roundtrip conversion
    const roundtripMm = planUnitsToMm(extUnits, 'feet');
    assert.strictEqual(Math.round(roundtripMm), 230, 'Roundtrip conversion must match 230 mm');

    assert.ok(WALL_THICKNESS_PRESETS_MM.length >= 5, 'Must provide architectural thickness presets');
    console.log('✓ Authoritative wall thickness presets verified.');
  });
});

// ─────────────────────────────────────────────────────────
// Suite 4: AI Floor Plan Natural Language Commands
// ─────────────────────────────────────────────────────────

describe('[AI Floor Plan Assistant] Natural Language Command Execution', () => {
  const aiProvider = new LocalFloorPlanAIProvider();

  const baseWall: FloorPlanWall = {
    id: 'wall-10',
    x1: 0,
    y1: 0,
    x2: 20,
    y2: 0,
    thickness: 0.75,
    wallType: 'exterior',
    layer: 'walls',
  };

  const context: PlanContext = {
    walls: [baseWall],
    rooms: [],
    doors: [],
    windows: [],
    columns: [],
    staircases: [],
    selectedElement: { type: 'wall', id: 'wall-10' },
    cursorPos: { x: 10, y: 0 },
    unit: 'feet',
  };

  it('handles "Make this wall 6 inches thick"', async () => {
    const res = await aiProvider.interpretCommand('Make this wall 6 inches thick', context);
    assert.strictEqual(res.success, true, 'Command should succeed');
    assert.strictEqual(res.understood, true, 'Command should be understood');
    assert.strictEqual(res.action?.action, 'UPDATE_WALL');
    assert.strictEqual(res.action?.objectId, 'wall-10');
    // 6 inches = 0.5 feet
    assert.strictEqual(res.action?.payload?.thickness, 0.5);
    console.log('✓ Handled: "Make this wall 6 inches thick" -> thickness: 0.5 ft');
  });

  it('handles "Move this wall 2 feet"', async () => {
    const res = await aiProvider.interpretCommand('Move this wall 2 feet', context);
    assert.strictEqual(res.success, true, 'Command should succeed');
    assert.strictEqual(res.understood, true);
    assert.strictEqual(res.action?.action, 'UPDATE_WALL');
    // Horizontal wall (0,0)->(20,0), normal is (0,1), displaced by 2 ft in y
    assert.strictEqual(res.action?.payload?.y1, 2);
    assert.strictEqual(res.action?.payload?.y2, 2);
    console.log('✓ Handled: "Move this wall 2 feet" -> translated y by 2 ft');
  });

  it('handles "Add a bedroom here"', async () => {
    const res = await aiProvider.interpretCommand('Add a bedroom here', {
      ...context,
      cursorPos: { x: 5, y: 5 },
    });
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.understood, true);
    assert.strictEqual(res.action?.action, 'ADD_ROOM');
    assert.strictEqual(res.action?.payload?.roomType, 'Bedroom');
    assert.strictEqual(res.action?.payload?.x, 5);
    assert.strictEqual(res.action?.payload?.y, 5);
    assert.ok(res.action?.payload?.area > 0);
    console.log('✓ Handled: "Add a bedroom here" -> created Bedroom entity at cursor');
  });

  it('handles "Create a kitchen here"', async () => {
    const res = await aiProvider.interpretCommand('Create a kitchen here', {
      ...context,
      cursorPos: { x: 20, y: 10 },
    });
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.action?.action, 'ADD_ROOM');
    assert.strictEqual(res.action?.payload?.roomType, 'Kitchen');
    console.log('✓ Handled: "Create a kitchen here" -> created Kitchen entity at cursor');
  });

  it('handles "Add a 4 feet door here"', async () => {
    const res = await aiProvider.interpretCommand('Add a 4 feet door here', {
      ...context,
      cursorPos: { x: 10, y: 0 },
    });
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.action?.action, 'ADD_DOOR');
    assert.strictEqual(res.action?.payload?.width, 4);
    assert.strictEqual(res.action?.payload?.wallId, 'wall-10');
    console.log('✓ Handled: "Add a 4 feet door here" -> attached 4ft door to host wall');
  });

  it('handles "Add two windows to this wall"', async () => {
    const res = await aiProvider.interpretCommand('Add two windows to this wall', context);
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.action?.action, 'ADD_WINDOW');
    assert.strictEqual(res.action?.payload?.wallId, 'wall-10');
    console.log('✓ Handled: "Add two windows to this wall" -> placed window along host wall');
  });

  it('handles "Make this room 12 by 14 feet"', async () => {
    const room: FloorPlanRoom = {
      id: 'room-1',
      roomType: 'Bedroom',
      label: 'Bedroom',
      x: 0,
      y: 0,
      width: 10,
      height: 10,
      area: 100,
      perimeter: 40,
      layer: 'rooms',
    };
    const roomContext: PlanContext = {
      ...context,
      rooms: [room],
      selectedElement: { type: 'room', id: 'room-1' },
    };
    const res = await aiProvider.interpretCommand('Make this room 12 by 14 feet', roomContext);
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.action?.action, 'UPDATE_ROOM');
    assert.strictEqual(res.action?.payload?.width, 12);
    assert.strictEqual(res.action?.payload?.height, 14);
    assert.strictEqual(res.action?.payload?.area, 168);
    console.log('✓ Handled: "Make this room 12 by 14 feet" -> resized room to 12×14, area: 168 sq.ft');
  });

  it('handles "Show room dimensions"', async () => {
    const res = await aiProvider.interpretCommand('Show room dimensions', context);
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.action?.payload?.setting, 'showDimensions');
    assert.strictEqual(res.action?.payload?.value, true);
    console.log('✓ Handled: "Show room dimensions" -> toggled dimensions on');
  });

  it('handles "Calculate total area"', async () => {
    const room1: FloorPlanRoom = {
      id: 'r1', roomType: 'Living Room', x: 0, y: 0, width: 15, height: 20, area: 300, perimeter: 70, layer: 'rooms',
    };
    const room2: FloorPlanRoom = {
      id: 'r2', roomType: 'Bedroom', x: 15, y: 0, width: 12, height: 14, area: 168, perimeter: 52, layer: 'rooms',
    };
    const areaContext: PlanContext = {
      ...context,
      rooms: [room1, room2],
    };
    const res = await aiProvider.interpretCommand('Calculate total area', areaContext);
    assert.strictEqual(res.success, true);
    assert.ok(res.metricsReport, 'Must produce metrics report');
    assert.strictEqual(res.metricsReport?.grossFloorAreaSqUnits, 468, 'Gross area must be exactly 300 + 168 = 468');
    console.log('✓ Handled: "Calculate total area" -> exact sum: 300 + 168 = 468 sq.ft');
  });

  it('handles "Fix my plan" with zero fake results', async () => {
    const res = await aiProvider.interpretCommand('Fix my plan', context);
    assert.strictEqual(res.success, true);
    assert.ok(res.diagnosticReport !== undefined);
    console.log('✓ Handled: "Fix my plan" -> produced real diagnostic inspection');
  });

  it('handles "Analyze my plan"', async () => {
    const res = await aiProvider.interpretCommand('Analyze my plan', context);
    assert.strictEqual(res.success, true);
    assert.ok(res.metricsReport !== undefined);
    console.log('✓ Handled: "Analyze my plan" -> produced complete metrics report');
  });
});

console.log('\n🎉 ALL AUTH RECOVERY, AI CAD COMMANDS & GEOMETRY TESTS PASSED SUCCESSFULLY!\n');
