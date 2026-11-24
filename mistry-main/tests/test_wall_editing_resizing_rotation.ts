import { describe, it } from 'node:test';
import assert from 'node:assert';
import { moveJoint, wallLengthOf, type Pt } from '../src/domain/planGeometry';
import { resizeWall } from '../src/domain/planMeasure';
import type { FloorPlanWall } from '../src/types/floorPlan';

describe('Wall Editing, Resizing & Rotation Suite', () => {
  const makeWall = (id: string, x1: number, y1: number, x2: number, y2: number): FloorPlanWall => ({
    id,
    x1,
    y1,
    x2,
    y2,
    thickness: 0.75, // 9 inches in feet
    type: 'brick',
    locked: false,
  });

  it('Resizing: Draw 10 ft wall, reduce to 2 ft, increase to 15 ft', () => {
    // 10 ft horizontal wall from (10, 10) to (20, 10)
    let walls = [makeWall('w1', 10, 10, 20, 10)];
    assert.strictEqual(wallLengthOf(walls[0]), 10);

    // Reduce it to 2 ft by resizing endpoint 2 (keep start)
    walls = resizeWall(walls, 'w1', 2, 'start', 0.3);
    assert.strictEqual(walls[0].x1, 10);
    assert.strictEqual(walls[0].y1, 10);
    assert.strictEqual(walls[0].x2, 12);
    assert.strictEqual(walls[0].y2, 10);
    assert.strictEqual(wallLengthOf(walls[0]), 2);

    // Increase it to 15 ft
    walls = resizeWall(walls, 'w1', 15, 'start', 0.3);
    assert.strictEqual(walls[0].x1, 10);
    assert.strictEqual(walls[0].y1, 10);
    assert.strictEqual(walls[0].x2, 25);
    assert.strictEqual(walls[0].y2, 10);
    assert.strictEqual(wallLengthOf(walls[0]), 15);
  });

  it('Independent Endpoint Dragging & Opposite Endpoint Preservation', () => {
    // 10 ft wall
    const initialWalls = [makeWall('w1', 0, 0, 10, 0)];

    // Drag endpoint 2 from (10, 0) to (10, 5)
    const afterDragEnd2 = moveJoint(
      initialWalls,
      { x: 10, y: 0 },
      { x: 10, y: 5 },
      0.3,
      'w1',
      2
    );
    // Endpoint 1 must NOT have moved at all:
    assert.strictEqual(afterDragEnd2[0].x1, 0);
    assert.strictEqual(afterDragEnd2[0].y1, 0);
    assert.strictEqual(afterDragEnd2[0].x2, 10);
    assert.strictEqual(afterDragEnd2[0].y2, 5);

    // Drag endpoint 1 from (0, 0) to (-3, 4)
    const afterDragEnd1 = moveJoint(
      afterDragEnd2,
      { x: 0, y: 0 },
      { x: -3, y: 4 },
      0.3,
      'w1',
      1
    );
    // Endpoint 2 must remain exactly at (10, 5):
    assert.strictEqual(afterDragEnd1[0].x1, -3);
    assert.strictEqual(afterDragEnd1[0].y1, 4);
    assert.strictEqual(afterDragEnd1[0].x2, 10);
    assert.strictEqual(afterDragEnd1[0].y2, 5);
  });

  it('Safety against 0-length collapse on very short walls (< tolerance)', () => {
    // Wall of length 0.2 ft (which is < default join tolerance 0.3 ft)
    const shortWall = [makeWall('w_short', 5, 5, 5.2, 5)];
    assert.strictEqual(Math.hypot(shortWall[0].x2 - shortWall[0].x1, shortWall[0].y2 - shortWall[0].y1) < 0.3, true);

    // Dragging endpoint 1 towards endpoint 2
    const moved = moveJoint(
      shortWall,
      { x: 5, y: 5 },
      { x: 5.18, y: 5 },
      0.3,
      'w_short',
      1
    );

    // Endpoint 2 MUST be preserved at 5.2
    assert.strictEqual(moved[0].x2, 5.2);
    assert.strictEqual(moved[0].y2, 5);
    // Length must be approximately minLen (0.05) and NOT collapsed to 0
    const len = wallLengthOf(moved[0]);
    assert.strictEqual(len >= 0.0499, true);
    assert.strictEqual(Math.abs(len - 0.05) < 1e-4, true);
    assert.notStrictEqual(len, 0);
  });

  it('Wall Rotation to 30°, 45°, and 90° strictly preserves wall length', () => {
    const originalLen = 10;
    const center: Pt = { x: 20, y: 20 };
    const halfL = originalLen / 2;

    const testAngles = [30, 45, 90, 180, 270];
    for (const deg of testAngles) {
      const rad = (deg * Math.PI) / 180;
      const x1 = center.x - halfL * Math.cos(rad);
      const y1 = center.y - halfL * Math.sin(rad);
      const x2 = center.x + halfL * Math.cos(rad);
      const y2 = center.y + halfL * Math.sin(rad);

      const rotatedWall = makeWall('rot', x1, y1, x2, y2);
      const len = wallLengthOf(rotatedWall);

      // Check length preservation to 1e-9 precision:
      assert.strictEqual(Math.abs(len - originalLen) < 1e-9, true);

      // Check angle accuracy:
      let calculatedAngle = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
      if (calculatedAngle < 0) calculatedAngle += 360;
      assert.strictEqual(Math.abs(calculatedAngle - deg) < 1e-6, true);
    }
  });

  it('Smart Snapping angle calculation (15° increments)', () => {
    // Test snap tolerance around 15°, 45°, 90°
    const SNAP_STEP = 15;
    const snapAngle = (angleDeg: number) => {
      const snapTarget = Math.round(angleDeg / SNAP_STEP) * SNAP_STEP;
      if (Math.abs(angleDeg - snapTarget) <= 4.5 || Math.abs(angleDeg - snapTarget) >= 355.5) {
        return (snapTarget + 360) % 360;
      }
      return angleDeg;
    };

    // 44° snaps to 45°
    assert.strictEqual(snapAngle(44), 45);
    // 46.5° snaps to 45°
    assert.strictEqual(snapAngle(46.5), 45);
    // 88° snaps to 90°
    assert.strictEqual(snapAngle(88), 90);
    // 29° snaps to 30°
    assert.strictEqual(snapAngle(29), 30);
    // 37° is outside snap window (remains free angle)
    assert.strictEqual(snapAngle(37), 37);
  });
});
