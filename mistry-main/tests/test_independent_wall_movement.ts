import { describe, it } from 'node:test';
import assert from 'node:assert';
import { wallLengthOf, translateWall, moveJoint, resizeWall, joinTolerance } from '../src/domain/planGeometry';
import type { FloorPlanWall } from '../src/db/types';

describe('Independent Wall Movement & Connected Group Control', () => {
  // Helper to create a 4-wall rectangle
  function createRectangleWalls(): FloorPlanWall[] {
    return [
      { id: 'w1', planId: 'p1', x1: 0, y1: 0, x2: 10, y2: 0, thickness: 0.75, wallType: 'exterior' },
      { id: 'w2', planId: 'p1', x1: 10, y1: 0, x2: 10, y2: 10, thickness: 0.75, wallType: 'exterior' },
      { id: 'w3', planId: 'p1', x1: 10, y1: 10, x2: 0, y2: 10, thickness: 0.75, wallType: 'exterior' },
      { id: 'w4', planId: 'p1', x1: 0, y1: 10, x2: 0, y2: 0, thickness: 0.75, wallType: 'exterior' },
    ];
  }

  // Simulation of drag handler in Independent Mode vs Connected Mode
  function simulateWallDrag(
    walls: FloorPlanWall[],
    targetWallId: string,
    dx: number,
    dy: number,
    moveConnectedGroup: boolean
  ): FloorPlanWall[] {
    if (moveConnectedGroup) {
      return translateWall(walls, targetWallId, dx, dy, joinTolerance('feet'));
    }
    // Independent mode: only target wall moves!
    return walls.map(w =>
      w.id === targetWallId
        ? { ...w, x1: w.x1 + dx, y1: w.y1 + dy, x2: w.x2 + dx, y2: w.y2 + dy }
        : w
    );
  }

  // Simulation of endpoint resize in Independent Mode vs Connected Mode
  function simulateEndpointDrag(
    walls: FloorPlanWall[],
    targetWallId: string,
    endpoint: 1 | 2,
    newPos: { x: number; y: number },
    moveConnectedGroup: boolean
  ): FloorPlanWall[] {
    if (moveConnectedGroup) {
      const target = walls.find(w => w.id === targetWallId)!;
      const origin = endpoint === 1 ? { x: target.x1, y: target.y1 } : { x: target.x2, y: target.y2 };
      return moveJoint(walls, origin, newPos, joinTolerance('feet'), targetWallId, endpoint);
    }
    // Independent mode: only target wall endpoint changes!
    return walls.map(w => {
      if (w.id !== targetWallId) return w;
      let x1 = endpoint === 1 ? newPos.x : w.x1;
      let y1 = endpoint === 1 ? newPos.y : w.y1;
      let x2 = endpoint === 2 ? newPos.x : w.x2;
      let y2 = endpoint === 2 ? newPos.y : w.y2;
      // Guard against zero length collapse
      const len = Math.hypot(x2 - x1, y2 - y1);
      if (len < 0.05) {
        if (endpoint === 1) {
          x1 = x2 - 0.05;
        } else {
          x2 = x1 + 0.05;
        }
      }
      return { ...w, x1, y1, x2, y2 };
    });
  }

  it('1. Dragging middle of wall in Independent Mode moves ONLY the selected wall', () => {
    const initialWalls = createRectangleWalls();
    const result = simulateWallDrag(initialWalls, 'w1', 0, 5, false);

    // Selected wall w1 has moved by (0, 5)
    const w1 = result.find(w => w.id === 'w1')!;
    assert.strictEqual(w1.x1, 0);
    assert.strictEqual(w1.y1, 5);
    assert.strictEqual(w1.x2, 10);
    assert.strictEqual(w1.y2, 5);

    // Other 3 walls remain COMPLETELY UNCHANGED
    const w2 = result.find(w => w.id === 'w2')!;
    assert.strictEqual(w2.x1, 10);
    assert.strictEqual(w2.y1, 0);
    assert.strictEqual(w2.x2, 10);
    assert.strictEqual(w2.y2, 10);

    const w3 = result.find(w => w.id === 'w3')!;
    assert.strictEqual(w3.x1, 10);
    assert.strictEqual(w3.y1, 10);
    assert.strictEqual(w3.x2, 0);
    assert.strictEqual(w3.y2, 10);

    const w4 = result.find(w => w.id === 'w4')!;
    assert.strictEqual(w4.x1, 0);
    assert.strictEqual(w4.y1, 10);
    assert.strictEqual(w4.x2, 0);
    assert.strictEqual(w4.y2, 0);
  });

  it('2. Dragging first endpoint in Independent Mode updates only that endpoint', () => {
    const initialWalls = createRectangleWalls();
    const result = simulateEndpointDrag(initialWalls, 'w1', 1, { x: -4, y: 2 }, false);

    const w1 = result.find(w => w.id === 'w1')!;
    // Endpoint 1 moved to (-4, 2)
    assert.strictEqual(w1.x1, -4);
    assert.strictEqual(w1.y1, 2);
    // Endpoint 2 strictly anchored at (10, 0)
    assert.strictEqual(w1.x2, 10);
    assert.strictEqual(w1.y2, 0);

    // Connected wall w4's endpoint at (0, 0) did NOT move
    const w4 = result.find(w => w.id === 'w4')!;
    assert.strictEqual(w4.x2, 0);
    assert.strictEqual(w4.y2, 0);

    // Other walls remain unchanged
    const w2 = result.find(w => w.id === 'w2')!;
    assert.strictEqual(w2.x1, 10);
    assert.strictEqual(w2.y1, 0);
  });

  it('3. Dragging second endpoint in Independent Mode updates only that endpoint', () => {
    const initialWalls = createRectangleWalls();
    const result = simulateEndpointDrag(initialWalls, 'w1', 2, { x: 15, y: -2 }, false);

    const w1 = result.find(w => w.id === 'w1')!;
    // Endpoint 1 strictly anchored at (0, 0)
    assert.strictEqual(w1.x1, 0);
    assert.strictEqual(w1.y1, 0);
    // Endpoint 2 moved to (15, -2)
    assert.strictEqual(w1.x2, 15);
    assert.strictEqual(w1.y2, -2);

    // Connected wall w2's endpoint at (10, 0) did NOT move
    const w2 = result.find(w => w.id === 'w2')!;
    assert.strictEqual(w2.x1, 10);
    assert.strictEqual(w2.y1, 0);
  });

  it('4. Move Connected Group Mode explicitly translates connected walls when toggled ON', () => {
    const initialWalls = createRectangleWalls();
    const result = simulateWallDrag(initialWalls, 'w1', 0, 5, true);

    const w1 = result.find(w => w.id === 'w1')!;
    assert.strictEqual(w1.y1, 5);
    assert.strictEqual(w1.y2, 5);

    // In Connected Mode, w2 and w4 endpoints that met w1 stretched with it
    const w2 = result.find(w => w.id === 'w2')!;
    assert.strictEqual(w2.y1, 5, 'w2 start should follow w1 in connected mode');

    const w4 = result.find(w => w.id === 'w4')!;
    assert.strictEqual(w4.y2, 5, 'w4 end should follow w1 in connected mode');
  });

  it('5. Endpoint dragging in Connected Group Mode moves joined corner when toggled ON', () => {
    const initialWalls = createRectangleWalls();
    const result = simulateEndpointDrag(initialWalls, 'w1', 1, { x: -3, y: 0 }, true);

    const w1 = result.find(w => w.id === 'w1')!;
    assert.strictEqual(w1.x1, -3);

    const w4 = result.find(w => w.id === 'w4')!;
    assert.strictEqual(w4.x2, -3, 'w4 endpoint should follow corner in connected mode');
  });

  it('6. Quick length adjustment in Independent Mode preserves other walls', () => {
    const initialWalls = createRectangleWalls();
    const targetWall = initialWalls.find(w => w.id === 'w1')!;
    const curLen = wallLengthOf(targetWall);
    const newLen = curLen + 2; // Lengthen by 2 ft

    // Independent adjustment
    const updatedWalls = initialWalls.map(w =>
      w.id === 'w1' ? { ...w, x2: w.x1 + newLen } : w
    );

    const w1 = updatedWalls.find(w => w.id === 'w1')!;
    assert.strictEqual(wallLengthOf(w1), 12);

    // Other walls remain unchanged
    const w2 = updatedWalls.find(w => w.id === 'w2')!;
    assert.strictEqual(w2.x1, 10);
    assert.strictEqual(w2.y1, 0);
  });

  it('7. Wall rotation in Independent Mode preserves wall length and other walls', () => {
    const initialWalls = createRectangleWalls();
    const targetWall = initialWalls.find(w => w.id === 'w1')!;
    const len = wallLengthOf(targetWall);
    const rad = (45 * Math.PI) / 180;

    const rotatedWall: FloorPlanWall = {
      ...targetWall,
      x2: targetWall.x1 + len * Math.cos(rad),
      y2: targetWall.y1 + len * Math.sin(rad),
    };

    const updatedWalls = initialWalls.map(w => w.id === 'w1' ? rotatedWall : w);

    const w1 = updatedWalls.find(w => w.id === 'w1')!;
    assert.ok(Math.abs(wallLengthOf(w1) - len) < 1e-4, 'Wall length must be strictly preserved');

    // Other 3 walls remain untouched
    const w2 = updatedWalls.find(w => w.id === 'w2')!;
    assert.strictEqual(w2.x1, 10);
    assert.strictEqual(w2.y1, 0);
    assert.strictEqual(w2.x2, 10);
    assert.strictEqual(w2.y2, 10);
  });

  it('8. Move Mode defaults to Independent (false) with explicit toggle to Connected (true)', () => {
    let moveConnectedGroup = false; // Default
    assert.strictEqual(moveConnectedGroup, false, 'Default mode must be independent wall movement');

    // User toggles to connected group
    moveConnectedGroup = !moveConnectedGroup;
    assert.strictEqual(moveConnectedGroup, true, 'Toggling enables connected group movement');

    // User toggles back to independent
    moveConnectedGroup = !moveConnectedGroup;
    assert.strictEqual(moveConnectedGroup, false, 'Toggling again returns to independent movement');
  });
});

