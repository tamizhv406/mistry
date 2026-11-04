import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  findParallelWallGuide,
  adjustWallToExactParallelDistance,
  areAnglesParallel,
  COMMON_PARALLEL_OFFSETS_MM,
} from '../src/services/cadParallelGuide';
import { mmToPlanUnits, planUnitsToMm } from '../src/services/geometryEngine';
import type { FloorPlanWall } from '../src/db/types';

describe('[CAD Parallel Wall Guide] Parallel Detection & 19 mm Distance Guide', () => {
  it('detects parallel angles correctly', () => {
    assert.strictEqual(areAnglesParallel(90, 90), true, 'Same vertical angle should be parallel');
    assert.strictEqual(areAnglesParallel(90, 270), true, 'Opposite vertical angle should be parallel');
    assert.strictEqual(areAnglesParallel(0, 180), true, 'Horizontal angles should be parallel');
    assert.strictEqual(areAnglesParallel(45, 225), true, '45 deg angles should be parallel');
    assert.strictEqual(areAnglesParallel(90, 0), false, 'Perpendicular angles should not be parallel');
    assert.strictEqual(areAnglesParallel(90, 45), false, '45 and 90 should not be parallel');
    assert.ok(COMMON_PARALLEL_OFFSETS_MM.includes(19), 'Should include 19mm standard architectural preset');
  });

  it('detects parallel vertical wall and measures exact 19 mm distance in feet-based plan', () => {
    // 19 mm in feet: 19 / 304.8 ft = 0.062335958 ft
    const existingWall: FloorPlanWall = {
      id: 'w-existing-1',
      x1: 10,
      y1: 5,
      x2: 10,
      y2: 25,
      thickness: 0.75,
      wallType: 'exterior',
      layer: 'walls',
    };

    // User draws second vertical wall at exactly 19 mm offset
    const offset19mm = mmToPlanUnits(19, 'feet');
    const start = { x: 10 + offset19mm, y: 5 };
    const end = { x: 10 + offset19mm, y: 25 };

    const guide = findParallelWallGuide(start, end, [existingWall], 'feet');
    assert.ok(guide !== null, 'Parallel guide should be found');
    assert.strictEqual(guide.isVertical, true, 'Should be detected as vertical parallel');
    assert.strictEqual(Math.round(guide.distanceMm), 19, 'Distance should be 19 mm');
    assert.strictEqual(guide.formattedDistance, '19 mm', 'Formatted distance should be 19 mm');
    assert.strictEqual(guide.isSnapped, true, 'Should be snapped to 19 mm preset');
    assert.strictEqual(guide.snappedMm, 19, 'Snapped mm should be 19');
    assert.strictEqual(guide.guideStart.x, 10, 'Guide start X should be on existing wall (10)');
    assert.strictEqual(guide.guideEnd.x, 10 + offset19mm, 'Guide end X should be on new wall');
  });

  it('detects parallel vertical wall in metric (meters) plan at 19 mm', () => {
    // 19 mm in meters: 0.019 m
    const existingWall: FloorPlanWall = {
      id: 'w-metric-1',
      x1: 3.0,
      y1: 1.0,
      x2: 3.0,
      y2: 7.0,
      thickness: 0.23,
      wallType: 'exterior',
      layer: 'walls',
    };

    const offset19mm = mmToPlanUnits(19, 'meters'); // 0.019
    const start = { x: 3.0 + offset19mm, y: 1.0 };
    const end = { x: 3.0 + offset19mm, y: 7.0 };

    const guide = findParallelWallGuide(start, end, [existingWall], 'meters');
    assert.ok(guide !== null, 'Parallel guide should be found in meters');
    assert.strictEqual(guide.distanceMm, 19, 'Distance should be 19 mm');
    assert.strictEqual(guide.formattedDistance, '19 mm');
    assert.strictEqual(guide.isSnapped, true);
  });

  it('snaps to 19 mm within configurable tolerance', () => {
    const existingWall: FloorPlanWall = {
      id: 'w-snap-1',
      x1: 10,
      y1: 0,
      x2: 10,
      y2: 15,
      thickness: 0.75,
      wallType: 'exterior',
      layer: 'walls',
    };

    // User is slightly off: 21 mm (within 6 mm tolerance of 19 mm)
    const offset21mm = mmToPlanUnits(21, 'feet');
    const start = { x: 10 + offset21mm, y: 0 };
    const end = { x: 10 + offset21mm, y: 15 };

    const guide = findParallelWallGuide(start, end, [existingWall], 'feet', { snapToleranceMm: 6.0 });
    assert.ok(guide !== null);
    assert.strictEqual(guide.isSnapped, true, 'Should snap to 19 mm');
    assert.strictEqual(guide.snappedMm, 19);
    assert.ok(guide.snappedWallEnd !== undefined, 'Should provide snapped wall position');
    assert.strictEqual(
      Math.abs(guide.snappedWallEnd!.x - (10 + mmToPlanUnits(19, 'feet'))) < 1e-6,
      true,
      'Snapped coordinate should equal exactly 19 mm offset'
    );
  });

  it('adjustWallToExactParallelDistance accurately sets wall position without changing wall length', () => {
    const existingWall: FloorPlanWall = {
      id: 'w-adjust-1',
      x1: 20,
      y1: 0,
      x2: 20,
      y2: 10,
      thickness: 0.75,
      wallType: 'exterior',
      layer: 'walls',
    };

    // New wall at an arbitrary initial distance
    const start = { x: 20.8, y: 0 };
    const end = { x: 20.8, y: 10 };
    const originalLength = Math.hypot(end.x - start.x, end.y - start.y);

    // Explicitly adjust to exact 19 mm
    const adjusted = adjustWallToExactParallelDistance(start, end, existingWall, 19, 'feet');
    const adjustedLength = Math.hypot(adjusted.end.x - adjusted.start.x, adjusted.end.y - adjusted.start.y);

    assert.strictEqual(
      Math.abs(adjustedLength - originalLength) < 1e-6,
      true,
      'Wall length must never be altered when adjusting parallel distance'
    );

    const actualDistPlan = Math.abs(adjusted.start.x - 20);
    const actualDistMm = planUnitsToMm(actualDistPlan, 'feet');
    assert.strictEqual(
      Math.abs(actualDistMm - 19) < 0.01,
      true,
      'Adjusted distance must be exactly 19 mm'
    );
  });

  it('supports horizontal parallel walls with accurate mm distance', () => {
    const existingWall: FloorPlanWall = {
      id: 'w-horiz-1',
      x1: 0,
      y1: 15,
      x2: 30,
      y2: 15,
      thickness: 0.75,
      wallType: 'exterior',
      layer: 'walls',
    };

    // Second wall 100 mm below
    const offset100mm = mmToPlanUnits(100, 'feet');
    const start = { x: 5, y: 15 + offset100mm };
    const end = { x: 25, y: 15 + offset100mm };

    const guide = findParallelWallGuide(start, end, [existingWall], 'feet');
    assert.ok(guide !== null);
    assert.strictEqual(guide.isHorizontal, true, 'Should be detected as horizontal parallel');
    assert.strictEqual(guide.distanceMm, 100, 'Distance should be 100 mm');
    assert.strictEqual(guide.formattedDistance, '100 mm');
    assert.strictEqual(guide.isSnapped, true);
    assert.strictEqual(guide.snappedMm, 100);
  });
});
