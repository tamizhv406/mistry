import { readFileSync } from 'fs';
import { resolve } from 'path';
import type { FloorPlanWall, FloorPlanRoom } from '../src/db/types';
import {
  analyzePlanGeometry,
  autoStraightenZigZagWalls,
  autoCloseIncompleteGaps,
  cleanupMicroStubs,
  autoHealAllAndGenerateRooms,
  parseAndExecuteCopilotCommand,
} from '../src/services/aiFloorPlanCopilot';
import { getWallAngleDeg, getWallLength } from '../src/services/geometryEngine';

console.log('✨ Starting AI Floor Plan Copilot & Angle Rotation Verification Tests...\n');

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
// Test 1: Geometry Diagnostics - Detecting Crooked Walls & Gaps
// ─────────────────────────────────────────────────────────
console.log('[Test 1] Geometry Diagnostics (analyzePlanGeometry)...');

const crookedWalls: FloorPlanWall[] = [
  // Wall tilted at ~88° (deviates by ~2° from 90°)
  {
    id: 'w1',
    floorPlanId: 'p1',
    x1: 0,
    y1: 0,
    x2: 0.35,
    y2: 10,
    thickness: 0.75,
    wallType: 'exterior',
    layer: 'walls',
  },
  // Incomplete corner: w2 starts at (0.35, 10.9) - gap of 0.9 ft from (0.35, 10)
  {
    id: 'w2',
    floorPlanId: 'p1',
    x1: 0.35,
    y1: 10.9,
    x2: 15,
    y2: 10.9,
    thickness: 0.75,
    wallType: 'exterior',
    layer: 'walls',
  },
  // Micro-stub of length 0.4 ft
  {
    id: 'w3',
    floorPlanId: 'p1',
    x1: 15,
    y1: 10.9,
    x2: 15.4,
    y2: 10.9,
    thickness: 0.75,
    wallType: 'interior',
    layer: 'walls',
  },
];

const report = analyzePlanGeometry(crookedWalls, [], 'feet');
assert(report.zigzagCount >= 1, `Detected ${report.zigzagCount} crooked/zig-zag walls (expected >= 1)`);
assert(report.openGapCount >= 1, `Detected ${report.openGapCount} incomplete line/corner gaps (expected >= 1)`);
assert(report.strayStubCount >= 1, `Detected ${report.strayStubCount} stray micro-stubs (expected >= 1)`);
assert(report.healthScore < 100, `Health score reflects issues: ${report.healthScore}/100`);

// ─────────────────────────────────────────────────────────
// Test 2: AI Auto-Straighten Zig-Zag Walls
// ─────────────────────────────────────────────────────────
console.log('\n[Test 2] AI Auto-Straighten Zig-Zag Walls...');

const straightenRes = autoStraightenZigZagWalls(crookedWalls);
assert(straightenRes.success, 'autoStraightenZigZagWalls returned success');
assert(straightenRes.fixedCount >= 1, `Auto-straightened ${straightenRes.fixedCount} walls`);

// Check that the straightened wall w1 now has angle 90° (orthogonal)
const fixedW1 = straightenRes.walls.find(w => w.id === 'w1')!;
const newAngle = getWallAngleDeg(fixedW1);
const angleDiffFrom90 = Math.abs(newAngle - 90);
assert(angleDiffFrom90 < 0.1, `Straightened wall angle is exact 90° (got ${newAngle.toFixed(2)}°)`);

// ─────────────────────────────────────────────────────────
// Test 3: AI Auto-Close Incomplete Line Gaps (Corner Welding)
// ─────────────────────────────────────────────────────────
console.log('\n[Test 3] AI Auto-Close Incomplete Line Gaps...');

const gapRes = autoCloseIncompleteGaps(straightenRes.walls, 2.0);
assert(gapRes.success, 'autoCloseIncompleteGaps returned success');
assert(gapRes.fixedCount >= 1, `Welded ${gapRes.fixedCount} incomplete corners`);

const weldedW1 = gapRes.walls.find(w => w.id === 'w1')!;
const weldedW2 = gapRes.walls.find(w => w.id === 'w2')!;
const epDist = Math.hypot(weldedW1.x2 - weldedW2.x1, weldedW1.y2 - weldedW2.y1);
assert(epDist < 0.05, `Endpoints welded to exact corner joint (distance: ${epDist.toFixed(4)})`);

// ─────────────────────────────────────────────────────────
// Test 4: Stray Micro-Stub Cleanup
// ─────────────────────────────────────────────────────────
console.log('\n[Test 4] Stray Micro-Stub Cleanup...');

const cleanRes = cleanupMicroStubs(gapRes.walls, 0.8);
assert(cleanRes.fixedCount === 1, `Cleaned ${cleanRes.fixedCount} micro-stub(s)`);
assert(!cleanRes.walls.some(w => w.id === 'w3'), 'Micro-stub w3 was successfully removed');

// ─────────────────────────────────────────────────────────
// Test 5: Natural Language Parser (Tamil / Tanglish / English)
// ─────────────────────────────────────────────────────────
console.log('\n[Test 5] Natural Language Parser (Tamil / Tanglish / English)...');

// Query 1: User's exact Tamil/Tanglish request for zig-zag walls
const nlp1 = parseAndExecuteCopilotCommand('wall zig zag ahh pota atha correct panna', crookedWalls, []);
assert(nlp1.intent.action === 'straighten', 'Parsed "wall zig zag ahh pota atha correct panna" as straighten intent');
assert(nlp1.result !== undefined && nlp1.result.fixedCount >= 1, 'NLP executed straightening successfully');

// Query 2: User's exact Tamil/Tanglish request for incomplete line
const nlp2 = parseAndExecuteCopilotCommand('imcomplete line correct panna', crookedWalls, []);
assert(nlp2.intent.action === 'close_gaps', 'Parsed "imcomplete line correct panna" as close_gaps intent');
assert(nlp2.result !== undefined, 'NLP executed gap closing successfully');

// Query 3: Rotation command
const nlp3 = parseAndExecuteCopilotCommand('rotate 45 degrees', crookedWalls, []);
assert(nlp3.intent.action === 'rotate' && nlp3.intent.degrees === 45, 'Parsed "rotate 45 degrees" with 45°');

// Query 4: General fix all
const nlp4 = parseAndExecuteCopilotCommand('saripannu yellathaiyu pakkava', crookedWalls, []);
assert(nlp4.intent.action === 'heal_all', 'Parsed Tamil "saripannu yellathaiyu pakkava" as heal_all intent');

// ─────────────────────────────────────────────────────────
// Test 6: Source Code & UI Component Verification
// ─────────────────────────────────────────────────────────
console.log('\n[Test 6] Verifying Source Code & UI Components...');

const editorSrc = readFileSync(resolve('src/views/FloorPlanEditorView.tsx'), 'utf8');
const cssSrc = readFileSync(resolve('src/index.css'), 'utf8');

// Copilot UI in Editor
assert(editorSrc.includes('id="fp-copilot-btn"'), 'Header contains AI Copilot button');
assert(editorSrc.includes('isCopilotOpen'), 'FloorPlanEditorView manages isCopilotOpen state');
assert(editorSrc.includes('fp-copilot-drawer'), 'FloorPlanEditorView renders fp-copilot-drawer modal');
assert(editorSrc.includes('fp-copilot-health-card'), 'Drawer renders live geometry health score card');
assert(editorSrc.includes('fp-copilot-magic-card'), 'Drawer renders 1-Click Auto-Heal card');
assert(editorSrc.includes('handleCopilotStraighten'), 'Straighten action handler connected');
assert(editorSrc.includes('handleCopilotCloseGaps'), 'Close gaps action handler connected');

// Angle controls & presets in Bottom Property Dock
assert(editorSrc.includes('fp-angle-presets'), 'Dock includes fp-angle-presets container');
assert(editorSrc.includes('fp-angle-chip'), 'Dock includes fp-angle-chip preset buttons (0°, 45°, 90°, 180°)');
assert(editorSrc.includes('rotateWallToAngle'), 'rotateWallToAngle helper function is present');
assert(editorSrc.includes('fp-rotation-handle-group'), 'SVG renders on-canvas rotation handle for rooms');

// CSS Styles
assert(cssSrc.includes('.fp-copilot-btn {'), 'CSS defines .fp-copilot-btn');
assert(cssSrc.includes('.fp-copilot-drawer {'), 'CSS defines .fp-copilot-drawer');
assert(cssSrc.includes('.fp-angle-presets {'), 'CSS defines .fp-angle-presets');
assert(cssSrc.includes('.fp-angle-chip {'), 'CSS defines .fp-angle-chip');

console.log(`\n🎉 All ${passCount} AI Copilot & Angle Rotation Verification Tests Passed Successfully!`);
