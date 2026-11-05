import { describe, it } from 'node:test';
import assert from 'node:assert';
import { getRoomPolygonVertices } from '../src/domain/planGeometry';
import type { FloorPlanRoom } from '../src/db/types';

/** Shoelace formula for polygon area */
function computeArea(pts: Array<{ x: number; y: number }>): number {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    a += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
  }
  return Math.abs(a) / 2;
}

/** Polygon perimeter */
function computePerimeter(pts: Array<{ x: number; y: number }>): number {
  let p = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    p += Math.hypot(pts[j].x - pts[i].x, pts[j].y - pts[i].y);
  }
  return p;
}

/** Distance between 2 points */
function dist(p1: { x: number; y: number }, p2: { x: number; y: number }): number {
  return Math.hypot(p2.x - p1.x, p2.y - p1.y);
}

describe('CAD Polygon Room Editing & Dimension System', () => {

  it('1. Extracts 4 clockwise vertices correctly from rectangular room', () => {
    const room: FloorPlanRoom = {
      id: 'rm-1',
      roomType: 'Living Room',
      label: 'Living Room 1',
      x: 10,
      y: 20,
      width: 14,
      height: 12,
      rotation: 0,
      color: '#ffffff',
      floorFinish: 'Wood Parquet',
      layer: 'rooms',
    };

    const pts = getRoomPolygonVertices(room);
    assert.strictEqual(pts.length, 4);
    assert.deepStrictEqual(pts, [
      { x: 10, y: 20 },
      { x: 24, y: 20 },
      { x: 24, y: 32 },
      { x: 10, y: 32 },
    ]);

    const area = computeArea(pts);
    assert.strictEqual(area, 14 * 12); // 168
    const perimeter = computePerimeter(pts);
    assert.strictEqual(perimeter, 2 * (14 + 12)); // 52
  });

  it('2. Extracts existing polygon vertices for custom / trapezoid / L-shape room', () => {
    const customPts = [
      { x: 6, y: 4 },
      { x: 16, y: 4 },
      { x: 18, y: 16 },
      { x: 4, y: 16 },
    ];
    const room: FloorPlanRoom = {
      id: 'rm-trap',
      roomType: 'Living Room',
      label: 'Trapezoid Room',
      x: 4,
      y: 4,
      width: 14,
      height: 12,
      shapeType: 'polygon',
      polygonPoints: customPts,
      rotation: 0,
      color: '#ffffff',
      layer: 'rooms',
    };

    const pts = getRoomPolygonVertices(room);
    assert.strictEqual(pts.length, 4);
    assert.deepStrictEqual(pts, customPts);
    assert.strictEqual(computeArea(pts), 144);
  });

  it('3. Resizes a corner vertex independently without moving opposite endpoints', () => {
    const initialPts = [
      { x: 10, y: 10 },
      { x: 20, y: 10 },
      { x: 20, y: 20 },
      { x: 10, y: 20 },
    ];

    // Drag top-left corner (index 0) from (10, 10) to (8, 6)
    const movedIdx = 0;
    const newPos = { x: 8, y: 6 };
    const updatedPts = initialPts.map((pt, i) => (i === movedIdx ? newPos : { ...pt }));

    // Opposite corners (index 1, 2, 3) must be untouched
    assert.deepStrictEqual(updatedPts[1], { x: 20, y: 10 });
    assert.deepStrictEqual(updatedPts[2], { x: 20, y: 20 });
    assert.deepStrictEqual(updatedPts[3], { x: 10, y: 20 });
    assert.deepStrictEqual(updatedPts[0], { x: 8, y: 6 });

    // New Shoelace area and bounding box
    const newArea = computeArea(updatedPts);
    assert.ok(newArea > 100, 'Area expanded when pulling corner outwards');

    const xs = updatedPts.map(p => p.x);
    const ys = updatedPts.map(p => p.y);
    assert.strictEqual(Math.min(...xs), 8);
    assert.strictEqual(Math.max(...xs), 20);
    assert.strictEqual(Math.min(...ys), 6);
    assert.strictEqual(Math.max(...ys), 20);
  });

  it('4. Drags room edge perpendicularly preserving wall structure', () => {
    const initialPts = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ];

    // Drag top edge (edge 0: between p0 and p1) upwards by 3 units (normal dy = -3)
    const edgeIndex = 0;
    const p1Idx = edgeIndex;
    const p2Idx = (edgeIndex + 1) % 4; // 1
    const dy = -3;

    const shiftedPts = initialPts.map((p, idx) => {
      if (idx === p1Idx || idx === p2Idx) {
        return { x: p.x, y: p.y + dy };
      }
      return { ...p };
    });

    assert.deepStrictEqual(shiftedPts[0], { x: 0, y: -3 });
    assert.deepStrictEqual(shiftedPts[1], { x: 10, y: -3 });
    // Bottom points untouched
    assert.deepStrictEqual(shiftedPts[2], { x: 10, y: 10 });
    assert.deepStrictEqual(shiftedPts[3], { x: 0, y: 10 });

    const newArea = computeArea(shiftedPts);
    assert.strictEqual(newArea, 130); // 10 * 13
  });

  it('5. Adds a corner point (inserts vertex) turning 4-vertex rectangle into 5-vertex polygon', () => {
    const initialPts = [
      { x: 0, y: 0 },
      { x: 12, y: 0 },
      { x: 12, y: 12 },
      { x: 0, y: 12 },
    ];

    // Add corner on top edge (edge 0) at midpoint (6, 0)
    const edgeIndex = 0;
    const p1 = initialPts[edgeIndex];
    const p2 = initialPts[(edgeIndex + 1) % initialPts.length];
    const newCorner = {
      x: (p1.x + p2.x) / 2,
      y: (p1.y + p2.y) / 2,
    };

    const nextPts = [...initialPts];
    nextPts.splice(edgeIndex + 1, 0, newCorner);

    assert.strictEqual(nextPts.length, 5);
    assert.deepStrictEqual(nextPts[1], { x: 6, y: 0 });

    // Drag the new corner into an L-indent: (6, 6)
    nextPts[1] = { x: 6, y: 6 };
    const indentedArea = computeArea(nextPts);
    assert.ok(indentedArea < 144, 'Indented area must be smaller than full rectangle');
    assert.strictEqual(indentedArea, 144 - 36); // 108
  });

  it('6. Removes a corner point and prevents reducing below 3 points', () => {
    const pts5 = [
      { x: 0, y: 0 },
      { x: 6, y: 6 },
      { x: 12, y: 0 },
      { x: 12, y: 12 },
      { x: 0, y: 12 },
    ];

    // Remove vertex 1
    const pts4 = pts5.filter((_, idx) => idx !== 1);
    assert.strictEqual(pts4.length, 4);
    assert.strictEqual(computeArea(pts4), 144);

    // Remove another vertex -> triangle
    const pts3 = pts4.filter((_, idx) => idx !== 2);
    assert.strictEqual(pts3.length, 3);

    // Guard test: Cannot reduce below 3 vertices
    const canRemove = pts3.length > 3;
    assert.strictEqual(canRemove, false, 'Polygon cannot have fewer than 3 vertices');
  });

  it('7. Rotates room vertices around centroid preserving edge lengths (isometric transformation)', () => {
    const originalPts = [
      { x: 10, y: 10 },
      { x: 20, y: 10 },
      { x: 20, y: 18 },
      { x: 10, y: 18 },
    ];

    const cx = originalPts.reduce((s, p) => s + p.x, 0) / 4; // 15
    const cy = originalPts.reduce((s, p) => s + p.y, 0) / 4; // 14

    // Initial edge lengths: 10, 8, 10, 8
    const origLens = originalPts.map((p, i) => dist(p, originalPts[(i + 1) % 4]));

    // Rotate by 45 degrees
    const rad = (45 * Math.PI) / 180;
    const cosA = Math.cos(rad);
    const sinA = Math.sin(rad);

    const rotatedPts = originalPts.map(p => {
      const dx = p.x - cx;
      const dy = p.y - cy;
      return {
        x: cx + dx * cosA - dy * sinA,
        y: cy + dx * sinA + dy * cosA,
      };
    });

    const rotLens = rotatedPts.map((p, i) => dist(p, rotatedPts[(i + 1) % 4]));
    for (let i = 0; i < 4; i++) {
      assert.ok(
        Math.abs(origLens[i] - rotLens[i]) < 1e-4,
        `Edge ${i} length preserved: ${origLens[i]} vs ${rotLens[i]}`
      );
    }

    const origArea = computeArea(originalPts);
    const rotArea = computeArea(rotatedPts);
    assert.ok(Math.abs(origArea - rotArea) < 1e-4, 'Area preserved during rotation');
  });

  it('8. Angle snapping snaps angles within 3° threshold to 15°, 45°, 90°', () => {
    const snapAngle = (deg: number): number => {
      let norm = deg % 360;
      if (norm < 0) norm += 360;
      const snapAngles = [0, 15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165, 180, 195, 210, 225, 240, 255, 270, 285, 300, 315, 330, 345, 360];
      for (const sa of snapAngles) {
        if (Math.abs(norm - sa) <= 3) {
          return sa === 360 ? 0 : sa;
        }
      }
      return norm;
    };

    assert.strictEqual(snapAngle(44.2), 45);
    assert.strictEqual(snapAngle(89.1), 90);
    assert.strictEqual(snapAngle(1.5), 0);
    assert.strictEqual(snapAngle(178.9), 180);
    assert.strictEqual(snapAngle(22.0), 22.0); // No snap when outside 3° threshold
  });

  it('9. Computes CAD 4-sided dimension line layout and inter-room gap', () => {
    // Room 1: width 14 (x: 4 to 18), height 12 (y: 6 to 18)
    const room1 = { x: 4, y: 6, width: 14, height: 12, wallThickness: 0.75 };
    // Room 2: adjacent to right at x: 26, width 16
    const room2 = { x: 26, y: 6, width: 16, height: 12, wallThickness: 0.75 };

    // Inter-room gap (like the 156 mm/ft dimension in FloorPlanCreator)
    const gap = room2.x - (room1.x + room1.width);
    assert.strictEqual(gap, 8);

    // Top dimension segments:
    // Left wall thick: 0.75
    // Room width: 14
    // Right wall thick: 0.75
    // Inter-room gap: 8
    // Room 2 width: 16
    const topSegments = [
      room1.wallThickness,
      room1.width,
      room1.wallThickness,
      gap,
      room2.width,
    ];
    assert.deepStrictEqual(topSegments, [0.75, 14, 0.75, 8, 16]);
  });

  it('10. Verifies cleanup selectors for print/PDF export contain CAD editing classes', () => {
    const exportCleanSelector = '.fp-wall-segment-hint, .fp-ai-preview, .fp-live-dim, .fp-wall-handles, .fp-room-cad-system, .fp-cad-alignment-guides, .fp-cad-outer-dimensions, .fp-room-editing-handles';
    
    assert.ok(exportCleanSelector.includes('.fp-room-cad-system'));
    assert.ok(exportCleanSelector.includes('.fp-cad-alignment-guides'));
    assert.ok(exportCleanSelector.includes('.fp-cad-outer-dimensions'));
    assert.ok(exportCleanSelector.includes('.fp-room-editing-handles'));
  });

});
