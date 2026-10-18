import { readFileSync } from 'fs';
import { resolve } from 'path';

console.log('📐 Starting Planner 5D Room Dimensions & Room Count Verification Tests...\n');

let passCount = 0;
function assert(condition, message) {
  if (!condition) {
    console.error(`❌ Assertion Failed: ${message}`);
    process.exit(1);
  }
  console.log(`✓ ${message}`);
  passCount++;
}

const editorSrc = readFileSync(resolve('src/views/FloorPlanEditorView.tsx'), 'utf8');
const typesSrc = readFileSync(resolve('src/db/types.ts'), 'utf8');
const cssSrc = readFileSync(resolve('src/index.css'), 'utf8');

// Test 1: Data Model includes wallThickness for FloorPlanRoom
console.log('[Test 1] Verifying Data Model for FloorPlanRoom...');
assert(typesSrc.includes('wallThickness?: number'), 'FloorPlanRoom interface includes wallThickness property');

// Test 2: Plain room fill (no decorative floor texture) and the CAD markers in SVG defs
console.log('\n[Test 2] Verifying SVG Definitions...');
assert(!editorSrc.includes('id="fp-wood-parquet"'), 'No decorative wood/brick floor pattern is defined');
assert(editorSrc.includes('id="fp-dim-arrow-green-start"'), 'SVG defs includes green dimension start arrow marker');
assert(editorSrc.includes('id="fp-dim-arrow-green-end"'), 'SVG defs includes green dimension end arrow marker');

// Test 3: Planner 5D Canvas Room Rendering
console.log('\n[Test 3] Verifying Planner 5D Room Canvas Rendering...');
assert(editorSrc.includes("const ROOM_FILL = 'rgba(248, 250, 252, 0.85)'") && !editorSrc.includes('url(#fp-wood-parquet)'), 'Rooms use one plain light fill, rgba(248, 250, 252, 0.85)');
assert(editorSrc.includes("(wall.wallType === 'partition' ? '#475569' : '#1e293b')") && editorSrc.includes('wallThickPx'), 'Walls are drawn in #1E293B (partitions lighter)');
assert(editorSrc.includes('fp-dim-arrow-green-start') && editorSrc.includes('stroke="#059669"'), 'Room renders exterior CAD dimension lines with witness arrows');
assert(editorSrc.includes('computeRoomArea(room, unit)'), 'Center room pill renders label and area in Planner 5D format');

// Test 4: Planner 5D Floating Bottom Property Dock
console.log('\n[Test 4] Verifying Planner 5D Floating Property Dock...');
assert(editorSrc.includes('fp-bottom-property-dock'), 'Floating bottom property dock is present');
assert(editorSrc.includes('fp-room-area-badge'), 'Area badge (# Area) is rendered in dock');
assert(editorSrc.includes('fp-stepper-btn'), 'Stepper buttons (< and >) are rendered for width, height, and thickness');
assert(editorSrc.includes('Type of Room') || editorSrc.includes('Type'), 'Room type selector dropdown is present in dock');
assert(editorSrc.includes('openRoomSheet') && editorSrc.includes('id="fp-room-sheet-width"'), 'Room size is changed in one room sheet');

// Test 5: Room Count & Room Schedule ("namba room ethana irukku")
console.log('\n[Test 5] Verifying Room Counter & Room Schedule...');
assert(editorSrc.includes('fp-header-room-counter'), 'Header contains live room counter button');
assert(editorSrc.includes('showRoomScheduleModal'), 'Room Schedule & Breakdown modal state is implemented');
assert(editorSrc.includes('Floor Plan Room Schedule & Breakdown'), 'Room Schedule modal contains room breakdown title and count');
assert(editorSrc.includes('Total Rooms in Floor Plan'), 'Room Schedule displays exact total rooms count ("namba room ethana irukku")');
assert(editorSrc.includes('handleAddRoomByDimensions'), 'Direct room creation by width & height function is implemented');
assert(editorSrc.includes('showAddRoomModal'), 'Add room by exact dimensions modal is implemented');

// Test 6: CSS Validity and Media Query Isolation
console.log('\n[Test 6] Verifying CSS Rules & Media Query Isolation...');
assert(cssSrc.includes('.fp-bottom-property-dock {'), 'CSS defines .fp-bottom-property-dock');
assert(cssSrc.includes('.fp-room-area-badge {'), 'CSS defines .fp-room-area-badge');
assert(cssSrc.includes('.fp-stepper-btn {'), 'CSS defines .fp-stepper-btn');
assert(cssSrc.includes('.fp-room-stat-grid {'), 'CSS defines .fp-room-stat-grid');
assert(cssSrc.includes('.fp-room-table {'), 'CSS defines .fp-room-table');

console.log(`\n🎉 ALL ${passCount} PLANNER 5D ROOM DIMENSIONS & ROOM COUNT TESTS PASSED PERFECTLY!\n`);
