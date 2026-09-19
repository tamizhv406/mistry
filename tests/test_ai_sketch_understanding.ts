import { readFileSync } from 'fs';
import { resolve } from 'path';
import type { FloorPlanWall, FloorPlanRoom } from '../src/db/types';
import {
  regularizeRoughWall,
  recognizeRoomPerimeter,
  classifySketchStroke,
} from '../src/services/aiSketchRecognition';
import { getWallAngleDeg } from '../src/services/geometryEngine';

console.log('🤖 Starting AI Real-Time Sketch Understanding & Smart Draw Tests...\n');

let passCount = 0;
function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ Assertion Failed: ${message}`);
    process.exit(1);
  }
  console.log(`✓ ${message}`);
  passCount++;
}

// ─────────────────────────────────────────────────────────
// Test 1: Rough Line Regularization & Angle Snapping
// ─────────────────────────────────────────────────────────
console.log('[Test 1] Rough Line Regularization (regularizeRoughWall)...');

// User loosely drew a line from (0, 0) to (0.35, 10) - tilted by ~2° off 90°
const reg1 = regularizeRoughWall({ x: 0, y: 0 }, { x: 0.35, y: 10 }, [], { unit: 'feet', angleToleranceDeg: 14 });
assert(reg1.wasStraightened, 'AI recognized rough wobbly line and straightened it');
assert(reg1.straightenedAngle === 90, `AI snapped angle to exact 90° (got ${reg1.straightenedAngle}°)`);
assert(reg1.x2 === 0, `End coordinate aligned to exact 90° X=0 (got ${reg1.x2})`);

// User loosely drew a line from (0, 0) to (10, 0.4) - tilted by ~2.3° off 0° (horizontal)
const reg2 = regularizeRoughWall({ x: 0, y: 0 }, { x: 10, y: 0.4 }, [], { unit: 'feet', angleToleranceDeg: 14 });
assert(reg2.wasStraightened, 'AI recognized rough horizontal line and straightened it');
assert(reg2.straightenedAngle === 0, `AI snapped angle to exact 0° (got ${reg2.straightenedAngle}°)`);
assert(reg2.y2 === 0, `End coordinate aligned to exact 0° Y=0 (got ${reg2.y2})`);

// ─────────────────────────────────────────────────────────
// Test 2: Magnetic Corner Auto-Weld During Drawing
// ─────────────────────────────────────────────────────────
console.log('\n[Test 2] Magnetic Corner Auto-Weld (No Gaps)...');

const existingWall: FloorPlanWall = {
  id: 'w-base',
  floorPlanId: 'p1',
  x1: 0,
  y1: 0,
  x2: 12,
  y2: 0,
  thickness: 0.75,
  wallType: 'exterior',
  layer: 'walls',
};

// User starts drawing a second wall loosely near (12.3, 0.2) - within magnetic radius of (12, 0)
const regWeld = regularizeRoughWall(
  { x: 12.3, y: 0.2 },
  { x: 12.3, y: 10 },
  [existingWall],
  { unit: 'feet', snapRadius: 1.5 }
);
assert(regWeld.wasWelded, 'AI recognized intention to connect corner and welded it');
assert(regWeld.x1 === 12 && regWeld.y1 === 0, `Start point snapped to exact joint (12, 0) (got ${regWeld.x1}, ${regWeld.y1})`);

// ─────────────────────────────────────────────────────────
// Test 3: Real-Time Enclosed Room Loop Recognition
// ─────────────────────────────────────────────────────────
console.log('\n[Test 3] Real-Time Room Loop Recognition (recognizeRoomPerimeter)...');

// 4 walls forming a 15×12 ft enclosed room
const fourWalls: FloorPlanWall[] = [
  { id: 'w1', x1: 0, y1: 0, x2: 15, y2: 0, thickness: 0.75, wallType: 'exterior', layer: 'walls' },
  { id: 'w2', x1: 15, y1: 0, x2: 15, y2: 12, thickness: 0.75, wallType: 'exterior', layer: 'walls' },
  { id: 'w3', x1: 15, y1: 12, x2: 0, y2: 12, thickness: 0.75, wallType: 'exterior', layer: 'walls' },
  { id: 'w4', x1: 0, y1: 12, x2: 0, y2: 0, thickness: 0.75, wallType: 'exterior', layer: 'walls' },
];

const roomRec = recognizeRoomPerimeter(fourWalls, [], 'feet');
assert(roomRec.detected, 'AI recognized 4-wall boundary as an enclosed room');
assert(roomRec.room !== undefined, 'AI created a FloorPlanRoom candidate');
assert(roomRec.room?.floorFinish === 'Wood Parquet', 'Room automatically assigned Planner 5D Wood Parquet flooring');
assert(Math.round(roomRec.room?.area || 0) === 180, `Room area calculated accurately as 180 sq.ft (got ${roomRec.room?.area})`);

// ─────────────────────────────────────────────────────────
// Test 4: Freehand CAD Gesture Classification (Smart Sketch)
// ─────────────────────────────────────────────────────────
console.log('\n[Test 4] Freehand CAD Gesture Classification (classifySketchStroke)...');

// Simulate a rough circular/box gesture for a room
const boxPoints = [
  { x: 2, y: 2 },
  { x: 16, y: 2.2 },
  { x: 16.1, y: 14 },
  { x: 1.9, y: 13.9 },
  { x: 2.1, y: 2.1 },
  { x: 2, y: 2 },
  { x: 2, y: 2 },
  { x: 2, y: 2 },
];
const sketchRes = classifySketchStroke(boxPoints, 'feet');
assert(sketchRes.type === 'enclosed_box_room', 'AI classified rough box sketch as enclosed_box_room');
assert(sketchRes.walls.length === 4, `AI synthesized 4 clean perimeter walls (got ${sketchRes.walls.length})`);
assert(sketchRes.room !== undefined, 'AI synthesized room entity with wood floor');

// Simulate a rough single wall stroke
const linePoints = [
  { x: 0, y: 0 },
  { x: 5, y: 0.1 },
  { x: 10, y: 0.2 },
  { x: 15, y: 0.25 },
];
const lineRes = classifySketchStroke(linePoints, 'feet');
assert(lineRes.type === 'straight_wall', 'AI classified stroke as straight_wall');
assert(lineRes.walls.length === 1, 'AI generated single regularized wall');

// ─────────────────────────────────────────────────────────
// Test 5: UI & Component Integration Verification
// ─────────────────────────────────────────────────────────
console.log('\n[Test 5] Verifying UI & Component Integration...');

const editorSrc = readFileSync(resolve('src/views/FloorPlanEditorView.tsx'), 'utf8');
const cssSrc = readFileSync(resolve('src/index.css'), 'utf8');

// AI Live HUD & Toggle
assert(editorSrc.includes('id="fp-ai-live-hud"'), 'Canvas contains AI Live Assist HUD');
assert(editorSrc.includes('isAiLiveAssistActive'), 'State tracks isAiLiveAssistActive toggle');
assert(editorSrc.includes('fp-ai-feedback-toast'), 'Canvas renders real-time AI understanding toast');

// AI Smart Draw Tool
assert(editorSrc.includes('id="fp-tool-smart-draw"'), 'Left toolbar contains Smart Draw tool');
assert(editorSrc.includes('activeTool === \'ai_draw\''), 'Editor handles ai_draw mode');
assert(editorSrc.includes('classifySketchStroke'), 'MouseUp handles freehand stroke classification');

// Live glowing sketch stroke in SVG
assert(editorSrc.includes('isFreehandDrawing && freehandPoints.length > 1'), 'SVG renders live glowing freehand sketch stroke');

// CSS Styles
assert(cssSrc.includes('.fp-ai-live-hud {'), 'CSS defines .fp-ai-live-hud');
assert(cssSrc.includes('.fp-ai-feedback-toast {'), 'CSS defines .fp-ai-feedback-toast');
assert(cssSrc.includes('.fp-tool-smart-pen'), 'CSS defines .fp-tool-smart-pen');

console.log(`\n🎉 All ${passCount} AI Real-Time Sketch Understanding Tests Passed Successfully!`);
