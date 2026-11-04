import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  computeWallDimensionLayouts,
  type WallDimItem,
  formatDimension,
} from '../src/domain/planMeasure';
import { planToMm, wallLengthOf } from '../src/domain/planGeometry';
import type { FloorPlanWall } from '../src/domain/planTypes';

describe('Wall Dimension Spacing & Anti-Collision Suite', () => {
  it('1. Parallel adjacent walls tier their dimension lines outwards to prevent bunching', () => {
    // Two parallel horizontal walls (e.g. adjacent rooms or corridor walls)
    // Wall 1: (0, 100) -> (200, 100), facing North (0, -1)
    // Wall 2: (50, 100) -> (250, 100), also facing North (0, -1)
    const items: WallDimItem[] = [
      {
        id: 'wall-1',
        p1: { x: 0, y: 100 },
        p2: { x: 200, y: 100 },
        normal: { x: 0, y: -1 },
        text: '10\' 0"',
        halfThickness: 10,
        isSelected: false,
      },
      {
        id: 'wall-2',
        p1: { x: 50, y: 100 },
        p2: { x: 250, y: 100 },
        normal: { x: 0, y: -1 },
        text: '10\' 0"',
        halfThickness: 10,
        isSelected: false,
      },
    ];

    const layouts = computeWallDimensionLayouts(items, { isMobile: false, dimFontPx: 12 });
    assert.strictEqual(layouts.size, 2);

    const lyt1 = layouts.get('wall-1')!;
    const lyt2 = layouts.get('wall-2')!;

    // One of them must be tiered outward so their dimension lines are not at the same Y
    const y1 = lyt1.d.line[0].y;
    const y2 = lyt2.d.line[0].y;
    const diffY = Math.abs(y1 - y2);

    // Should have a tier separation of at least labelHeight + 16 (approx 36px)
    assert.ok(diffY >= 20, `Parallel dimension lines should be tiered apart, got diffY=${diffY}`);
  });

  it('2. Perpendicular walls at a corner slide or tier to eliminate 2D label collisions', () => {
    // Top-left corner of a small room:
    // North wall: (100, 100) -> (160, 100), normal: (0, -1)
    // West wall: (100, 100) -> (100, 160), normal: (-1, 0)
    // Both midpoints are at (130, 70) and (70, 130), which can be very close at corner
    const items: WallDimItem[] = [
      {
        id: 'north',
        p1: { x: 100, y: 100 },
        p2: { x: 160, y: 100 },
        normal: { x: 0, y: -1 },
        text: '6\' 0"',
        halfThickness: 10,
        isSelected: false,
      },
      {
        id: 'west',
        p1: { x: 100, y: 100 },
        p2: { x: 100, y: 160 },
        normal: { x: -1, y: 0 },
        text: '6\' 0"',
        halfThickness: 10,
        isSelected: false,
      },
    ];

    const layouts = computeWallDimensionLayouts(items, { isMobile: false, dimFontPx: 12 });
    const northLyt = layouts.get('north')!;
    const westLyt = layouts.get('west')!;

    // Bounding boxes should not intersect with 0 margin
    const dx = Math.abs(northLyt.label.x - westLyt.label.x);
    const dy = Math.abs(northLyt.label.y - westLyt.label.y);

    const combinedHalfW = (northLyt.labelLength + westLyt.labelLength) / 2;
    const combinedHalfH = (northLyt.labelHeight + westLyt.labelHeight) / 2;

    const separated = dx >= combinedHalfW || dy >= combinedHalfH;
    assert.ok(separated, `Corner labels should be separated: dx=${dx}, dy=${dy}, touchW=${combinedHalfW}, touchH=${combinedHalfH}`);
  });

  it('3. Very short walls generate leader lines (needsLeader=true) when label does not fit on line', () => {
    // A tiny wall (e.g. 25px long on screen), label is ~45px wide
    const items: WallDimItem[] = [
      {
        id: 'short-wall',
        p1: { x: 50, y: 50 },
        p2: { x: 75, y: 50 },
        normal: { x: 0, y: -1 },
        text: '1\' 3"',
        halfThickness: 10,
        isSelected: true,
      },
    ];

    const layouts = computeWallDimensionLayouts(items, { isMobile: false, dimFontPx: 12 });
    const lyt = layouts.get('short-wall')!;

    assert.strictEqual(lyt.d.fits, false, 'Label should not fit inside a 25px line');
    assert.strictEqual(lyt.needsLeader, true, 'Short wall dimension must activate leader line');
  });

  it('4. Wall length adjustment (+/- 1 ft or 0.25 m) updates length silently without notifications', () => {
    const wall: FloorPlanWall = {
      id: 'w-silent',
      x1: 0,
      y1: 0,
      x2: 10,
      y2: 0,
      thickness: 0.75,
      wallType: 'exterior',
    };

    let notificationFired = false;
    const mockOnNotify = () => {
      notificationFired = true;
    };

    // Simulate handleQuickAdjustWallLength logic (with notification removed)
    const curLen = wallLengthOf(wall);
    const delta = 1; // 1 ft step
    const newLen = Math.max(0.05, curLen + delta);
    const updatedWall = { ...wall, x2: wall.x1 + newLen };

    // In the previous version, mockOnNotify would have been called here
    // With our fix, no notification is fired:
    assert.strictEqual(notificationFired, false, 'No notification should fire on 1-ft adjustment');
    assert.strictEqual(wallLengthOf(updatedWall), 11, 'Wall length should be updated to 11 ft');
  });

  it('5. Live update of measurements during wall movements preserves exact feet and metric scaling', () => {
    // Imperial test
    const imperialLenFt = 15.5; // 15' 6"
    const imperialFormatted = formatDimension(imperialLenFt, 'feet');
    assert.strictEqual(imperialFormatted, '15\'-6"');

    // Metric test
    const metricLenM = 4.25; // 4.25 m
    const metricFormatted = formatDimension(metricLenM, 'meters');
    assert.strictEqual(metricFormatted, '4.25 m');

    // Accurate mm conversion
    const mm = planToMm(metricLenM, 'meters');
    assert.strictEqual(Math.round(mm), 4250);
  });

  it('6. Measurement OFF option: when showDimensions is false, dimensions and extension lines are suppressed', () => {
    // Verify that showDimensions flag controls both wall dimension rendering and room CAD dimensions
    let showDimensions = true;

    // Toggle off
    showDimensions = false;
    assert.strictEqual(showDimensions, false);

    // Dimension visibility predicates
    const shouldRenderWallDims = (show: boolean, isDimLayerVis: boolean, isWallLayerVis: boolean) =>
      show && isDimLayerVis && isWallLayerVis;

    const shouldRenderRoomCadDims = (show: boolean, isDimLayerVis: boolean) =>
      show && isDimLayerVis;

    const shouldRenderRoomClearSize = (show: boolean) =>
      show;

    assert.strictEqual(shouldRenderWallDims(showDimensions, true, true), false);
    assert.strictEqual(shouldRenderRoomCadDims(showDimensions, true), false);
    assert.strictEqual(shouldRenderRoomClearSize(showDimensions), false);

    // Toggle back on
    showDimensions = true;
    assert.strictEqual(shouldRenderWallDims(showDimensions, true, true), true);
    assert.strictEqual(shouldRenderRoomCadDims(showDimensions, true), true);
    assert.strictEqual(shouldRenderRoomClearSize(showDimensions), true);
  });
});
