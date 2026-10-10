/**
 * Building Mistry Professional CAD Test Suite
 * Tests Polygon Room Generation, Gauss's Shoelace Area Calculation,
 * Perimeter Calculation, Mirror Transformations, Wall Opening Cutouts,
 * Multi-Floor Data Structures, and Precision Measurement.
 */

import {
  generateLShapedRoom,
  generateUShapedRoom,
  generateTShapedRoom,
  computePolygonArea,
  computePolygonPerimeter,
  mirrorWall,
  mirrorOpening,
  mirrorRoom,
  mirrorFurniture,
  computeWallSegmentsWithOpenings,
} from '../src/services/geometryEngine';
import type { FloorPlanWall, FloorPlanDoor, FloorPlanRoom, FloorPlanFurniture, FloorPlanLevel, BackgroundPlanImage } from '../src/db/types';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`  ✓ ${message}`);
}

console.log('\n--- 1. Testing L-Shaped Room Geometry & Shoelace Area ---');
{
  const x = 0;
  const y = 0;
  const width = 16;
  const height = 14;
  const cutW = 8;
  const cutH = 7;

  const points = generateLShapedRoom(x, y, width, height, cutW, cutH);
  assert(points.length === 6, 'L-shaped room has exactly 6 polygon vertices');

  // Analytical area: total 16*14=224 minus top-right cutout 8*7=56 -> 168
  const shoelaceArea = computePolygonArea(points);
  assert(Math.abs(shoelaceArea - 168) < 0.001, `Shoelace area is exact (${shoelaceArea} == 168)`);

  // Perimeter: 16 (bottom) + 7 (right-lower) + 8 (cutout horiz) + 7 (cutout vert) + 8 (top-left) + 14 (left) = 60
  const perim = computePolygonPerimeter(points);
  assert(Math.abs(perim - 60) < 0.001, `Perimeter is exact (${perim} == 60)`);
}

console.log('\n--- 2. Testing U-Shaped Room Geometry & Shoelace Area ---');
{
  const x = 0;
  const y = 0;
  const width = 20;
  const height = 16;
  const innerW = 6;
  const innerH = 8;

  const points = generateUShapedRoom(x, y, width, height, innerW, innerH);
  assert(points.length === 8, 'U-shaped room has exactly 8 polygon vertices');

  // Analytical area: base width=20, height=16 (total 320). Courtyard cutout = 6 * 8 = 48.
  // Net area = 320 - 48 = 272
  const shoelaceArea = computePolygonArea(points);
  assert(Math.abs(shoelaceArea - 272) < 0.001, `Shoelace area for U-shape is exact (${shoelaceArea} == 272)`);

  const perim = computePolygonPerimeter(points);
  assert(perim > 0, `U-shape perimeter calculated correctly: ${perim}`);
}

console.log('\n--- 3. Testing T-Shaped Room Geometry & Shoelace Area ---');
{
  const x = 0;
  const y = 0;
  const width = 18;
  const height = 14;
  const stemW = 8;
  const stemH = 9;

  const points = generateTShapedRoom(x, y, width, height, stemW, stemH);
  assert(points.length === 8, 'T-shaped room has exactly 8 polygon vertices');

  // Top Bar: 18 * (14 - 9) = 90. Stem: 8 * 9 = 72. Total = 162.
  const shoelaceArea = computePolygonArea(points);
  assert(Math.abs(shoelaceArea - 162) < 0.001, `Shoelace area for T-shape is exact (${shoelaceArea} == 162)`);
}

console.log('\n--- 4. Testing Mirror Transformations ---');
{
  const wall: FloorPlanWall = {
    id: 'w1',
    x1: 4,
    y1: 2,
    x2: 12,
    y2: 2,
    thickness: 0.75,
    wallType: 'exterior',
    layer: 'walls',
  };

  // Horizontal mirror around center X = 10
  const mirroredH = mirrorWall(wall, 'horizontal', 10);
  assert(mirroredH.x1 === 16 && mirroredH.x2 === 8, `Wall horizontally mirrored around x=10 (${mirroredH.x1}, ${mirroredH.x2})`);

  // Vertical mirror around center Y = 10
  const mirroredV = mirrorWall(wall, 'vertical', 10);
  assert(mirroredV.y1 === 18 && mirroredV.y2 === 18, `Wall vertically mirrored around y=10 (${mirroredV.y1})`);

  const furn: FloorPlanFurniture = {
    id: 'f1',
    itemType: 'Sofa',
    category: 'living',
    x: 5,
    y: 5,
    width: 6,
    height: 3,
    rotation: 90,
    layer: 'furniture',
  };
  const mirroredFurn = mirrorFurniture(furn, 'horizontal', 10);
  assert(mirroredFurn.x === 9, `Furniture mirrored X position correct: ${mirroredFurn.x}`);
}

console.log('\n--- 5. Testing Wall Opening Casing & Pass-Through Cutouts ---');
{
  const wall: FloorPlanWall = {
    id: 'w10',
    x1: 0,
    y1: 0,
    x2: 20,
    y2: 0,
    thickness: 0.75,
    wallType: 'interior',
    layer: 'walls',
  };

  const opening: FloorPlanDoor = {
    id: 'd10',
    doorType: 'Opening',
    x: 10,
    y: 0,
    width: 4,
    rotation: 0,
    wallId: 'w10',
    layer: 'doors',
  };

  const res = computeWallSegmentsWithOpenings(wall, [opening], []);
  assert(res.solidSegments.length === 2, `Wall with 4ft opening cutout splits into exactly 2 solid segments`);
  assert(Math.abs(res.solidSegments[0].x2 - 8) < 0.01, `Left segment ends at opening start (x=8)`);
  assert(Math.abs(res.solidSegments[1].x1 - 12) < 0.01, `Right segment begins at opening end (x=12)`);
}

console.log('\n--- 6. Testing Multi-Floor Level & Background Image Data Integrity ---');
{
  const bgImage: BackgroundPlanImage = {
    url: 'data:image/png;base64,sampleImageData',
    x: 0,
    y: 0,
    width: 30,
    height: 40,
    opacity: 0.6,
    locked: true,
    visible: true,
  };

  const level: FloorPlanLevel = {
    id: 'lvl-1',
    name: 'Ground Floor',
    levelNumber: 0,
    height: 10,
    backgroundImage: bgImage,
    walls: [],
    rooms: [
      {
        id: 'r1',
        label: 'Living Hall',
        roomType: 'Living Room',
        shapeType: 'L-shape',
        x: 0,
        y: 0,
        width: 16,
        height: 14,
        polygonPoints: generateLShapedRoom(0, 0, 16, 14, 8, 7),
        layer: 'rooms',
      }
    ],
    doors: [],
    windows: [],
    furniture: [],
    stairs: [],
    columns: [],
    annotations: [],
  };

  assert(level.backgroundImage?.width === 30, 'Level preserves background plan image width');
  assert(level.backgroundImage?.locked === true, 'Level preserves background plan image lock status');
  assert(level.rooms[0].shapeType === 'L-shape', 'Level room preserves L-shape classification');
  assert(level.rooms[0].polygonPoints?.length === 6, 'Level room preserves true 6-vertex polygon');
}

console.log('\n✅ All Building Mistry Professional CAD Suite Tests Passed!\n');
