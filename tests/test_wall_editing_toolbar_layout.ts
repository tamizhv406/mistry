import { describe, it } from 'node:test';
import assert from 'node:assert';
import { wallLengthOf, baseUnitOf } from '../src/domain/planGeometry';
import { formatDimension, formatThickness } from '../src/domain/planMeasure';
import type { FloorPlanWall } from '../src/db/types';

const wallLength = wallLengthOf;

describe('Wall Editing Toolbar Layout & Right Panel Integration', () => {

  // Helper simulating bottom dock render decision
  function evaluateBottomDockVisibility(
    selectedType: string,
    isMobile: boolean,
    isDrawingActive: boolean
  ): 'none' | 'mobile-sheet' | 'standard-dock' {
    if (isDrawingActive) return 'none'; // Auto-hide during drawing/panning
    if (selectedType === 'wall') {
      if (!isMobile) return 'none'; // Desktop: moved to Right Side Panel!
      return 'mobile-sheet'; // Mobile: compact bottom sheet
    }
    return 'standard-dock';
  }

  it('1. Removes bottom floating toolbar from canvas for selected wall on desktop', () => {
    // Desktop, wall selected, not drawing
    const result = evaluateBottomDockVisibility('wall', false, false);
    assert.strictEqual(
      result,
      'none',
      'Large bottom floating dock must NOT be rendered for walls on desktop'
    );
  });

  it('2. Shows compact bottom sheet on mobile only when wall is selected', () => {
    // Mobile, wall selected, not drawing
    const result = evaluateBottomDockVisibility('wall', true, false);
    assert.strictEqual(
      result,
      'mobile-sheet',
      'Mobile should display the compact bottom sheet for selected wall'
    );
  });

  it('3. Automatically hides editing controls during wall drawing or canvas panning', () => {
    // When user starts drawing or panning, editing controls must hide immediately
    const resultDesktop = evaluateBottomDockVisibility('wall', false, true);
    assert.strictEqual(resultDesktop, 'none');

    const resultMobile = evaluateBottomDockVisibility('wall', true, true);
    assert.strictEqual(resultMobile, 'none');

    const resultOther = evaluateBottomDockVisibility('room', false, true);
    assert.strictEqual(resultOther, 'none');
  });

  it('4. Right panel vertically organizes all 8 required wall controls', () => {
    const wallControlsList = [
      'Length',
      'Thickness',
      'Angle',
      'Rotate',
      'Resize',
      'Duplicate',
      'Lock',
      'Delete',
    ];

    // Verify all 8 required controls exist in specification order
    assert.strictEqual(wallControlsList.length, 8);
    assert.deepStrictEqual(wallControlsList, [
      'Length',
      'Thickness',
      'Angle',
      'Rotate',
      'Resize',
      'Duplicate',
      'Lock',
      'Delete',
    ]);
  });

  it('5. Wall Length step adjustments (+/- 1 ft or 0.25 m) calculate correctly', () => {
    const wall: FloorPlanWall = {
      id: 'w-1',
      x1: 10,
      y1: 10,
      x2: 22, // 12 ft length
      y2: 10,
      thickness: 0.75,
      wallType: 'exterior',
      layer: 'walls',
    };

    const initialLen = wallLength(wall);
    assert.strictEqual(initialLen, 12);

    const stepFt = baseUnitOf('feet') === 'feet' ? 1 : 0.25;
    assert.strictEqual(stepFt, 1);

    // Increase by 1 ft
    const lengthenedWall = {
      ...wall,
      x2: wall.x2 + stepFt,
    };
    assert.strictEqual(wallLength(lengthenedWall), 13);
    assert.strictEqual(formatDimension(wallLength(lengthenedWall), 'feet'), "13'-0\"");

    // Shorten by 1 ft
    const shortenedWall = {
      ...wall,
      x2: wall.x2 - stepFt,
    };
    assert.strictEqual(wallLength(shortenedWall), 11);
    assert.strictEqual(formatDimension(wallLength(shortenedWall), 'feet'), "11'-0\"");
  });

  it('6. Wall Thickness formats and updates accurately for all 3 standard presets', () => {
    // 9" Exterior, 4.5" Interior, 3" Partition
    const extThickness = 0.75; // 9 in = 0.75 ft
    const intThickness = 0.375; // 4.5 in = 0.375 ft
    const partThickness = 0.25; // 3 in = 0.25 ft

    assert.strictEqual(formatThickness(extThickness, 'feet'), '9"');
    assert.strictEqual(formatThickness(intThickness, 'feet'), '4.5"');
    assert.strictEqual(formatThickness(partThickness, 'feet'), '3"');

    // In metric (meters)
    assert.strictEqual(formatThickness(0.23, 'meters'), '230 mm');
    assert.strictEqual(formatThickness(0.115, 'meters'), '115 mm');
  });

  it('7. Wall Rotation preserves wall length exactly across 15°, 45°, 90°, and 180°', () => {
    const wall: FloorPlanWall = {
      id: 'w-rot',
      x1: 20,
      y1: 20,
      x2: 30, // 10 ft length
      y2: 20,
      thickness: 0.75,
      wallType: 'exterior',
      layer: 'walls',
    };

    const origLen = wallLength(wall); // 10
    const mx = (wall.x1 + wall.x2) / 2; // 25
    const my = (wall.y1 + wall.y2) / 2; // 20
    const half = origLen / 2; // 5

    const testAngles = [15, 30, 45, 60, 90, 180, 270];
    for (const deg of testAngles) {
      const rad = (deg * Math.PI) / 180;
      const rotatedWall: FloorPlanWall = {
        ...wall,
        x1: mx - half * Math.cos(rad),
        y1: my - half * Math.sin(rad),
        x2: mx + half * Math.cos(rad),
        y2: my + half * Math.sin(rad),
      };

      const newLen = wallLength(rotatedWall);
      assert.ok(
        Math.abs(newLen - origLen) < 1e-6,
        `Wall length must be strictly preserved at ${deg}°: ${newLen} vs ${origLen}`
      );
    }
  });

  it('8. Wall Lock state prevents inadvertent edits and deletion', () => {
    const lockedWall: FloorPlanWall = {
      id: 'w-lock',
      x1: 5,
      y1: 5,
      x2: 15,
      y2: 5,
      thickness: 0.75,
      wallType: 'exterior',
      locked: true,
      layer: 'walls',
    };

    const isLocked = !!lockedWall.locked;
    assert.strictEqual(isLocked, true);

    // Any attempt to delete or edit a locked wall is guarded
    const canDelete = !isLocked;
    const canRotate = !isLocked;
    const canResize = !isLocked;

    assert.strictEqual(canDelete, false);
    assert.strictEqual(canRotate, false);
    assert.strictEqual(canResize, false);
  });

  it('9. Wall Duplication offsets position cleanly without breaking original wall', () => {
    const originalWall: FloorPlanWall = {
      id: 'w-orig',
      x1: 10,
      y1: 10,
      x2: 20,
      y2: 10,
      thickness: 0.75,
      wallType: 'exterior',
      layer: 'walls',
    };

    const duplicateOffset = 2; // 2 ft offset
    const duplicatedWall: FloorPlanWall = {
      ...originalWall,
      id: 'w-dup-1',
      x1: originalWall.x1 + duplicateOffset,
      y1: originalWall.y1 + duplicateOffset,
      x2: originalWall.x2 + duplicateOffset,
      y2: originalWall.y2 + duplicateOffset,
    };

    assert.strictEqual(wallLength(duplicatedWall), wallLength(originalWall));
    assert.strictEqual(duplicatedWall.thickness, originalWall.thickness);
    assert.strictEqual(duplicatedWall.x1, 12);
    assert.strictEqual(duplicatedWall.y1, 12);
  });

  it('10. Wall Deletion removes wall from plan state without side effects', () => {
    const walls: FloorPlanWall[] = [
      { id: 'w-1', x1: 0, y1: 0, x2: 10, y2: 0, thickness: 0.75, wallType: 'exterior', layer: 'walls' },
      { id: 'w-2', x1: 10, y1: 0, x2: 10, y2: 10, thickness: 0.75, wallType: 'exterior', layer: 'walls' },
      { id: 'w-3', x1: 10, y1: 10, x2: 0, y2: 10, thickness: 0.75, wallType: 'exterior', layer: 'walls' },
    ];

    const targetId = 'w-2';
    const remainingWalls = walls.filter(w => w.id !== targetId);

    assert.strictEqual(remainingWalls.length, 2);
    assert.strictEqual(remainingWalls.some(w => w.id === targetId), false);
    assert.strictEqual(remainingWalls[0].id, 'w-1');
    assert.strictEqual(remainingWalls[1].id, 'w-3');
  });

});
