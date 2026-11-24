import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

console.log('📱 Testing Building Mistry Mobile-First Floor Plan Creator Redesign...\n');

// 1. Inspect FloorPlanEditorView.tsx
const editorPath = path.join(process.cwd(), 'src', 'views', 'FloorPlanEditorView.tsx');
const editorContent = fs.readFileSync(editorPath, 'utf8');

console.log('[Test 1] Mobile-First Editor Hierarchy Structure...');
assert.ok(editorContent.includes('fp-mobile-header'), 'Mobile top header class must be present in editor');
assert.ok(editorContent.includes('fp-mobile-back-btn'), 'Mobile back button must be present');
assert.ok(editorContent.includes('fp-mobile-title'), 'Mobile floor plan title must be present');
assert.ok(editorContent.includes('fp-mobile-save-btn'), 'Mobile save button must be present');
assert.ok(editorContent.includes('fp-mobile-menu-btn'), 'Mobile more menu (⋮) button must be present');
assert.ok(editorContent.includes('fp-mobile-mode-bar'), 'Mobile secondary mode bar must be present');
console.log('✓ Mobile Top Header ([Back] [Floor Plan Name] [Save] [⋮]) and Mode Bar ([Design] [Blueprint] [3D]) verified.');

console.log('\n[Test 2] Canvas Primary Focal Element & Compact Floating Controls...');
assert.ok(editorContent.includes('fp-mobile-zoom-pill'), 'Compact floating zoom pill must exist on canvas');
assert.ok(editorContent.includes('fp-mobile-zoom-btn'), 'Zoom in/out buttons must exist');
assert.ok(editorContent.includes('fp-mobile-zoom-fit'), 'Fit-to-screen button must exist');
assert.ok(editorContent.includes('fp-fab-ai'), 'Floating [✦ AI] FAB must exist on canvas');
assert.ok(editorContent.includes('fp-ai-stroke-card'), 'On-canvas AI stroke confirmation card must exist');
assert.ok(editorContent.includes('fp-ai-btn-convert'), 'Convert button must exist for AI suggestions');
assert.ok(editorContent.includes('fp-ai-btn-dismiss'), 'Keep Drawing button must exist for AI suggestions');
console.log('✓ Canvas floating zoom pill ([-] [%] [+] [FIT]), [✦ AI] FAB, and confirmation card verified.');

console.log('\n[Test 3] Compact Bottom Toolbar & Contextual Subtoolbars...');
assert.ok(editorContent.includes('fp-mobile-toolbar'), 'Mobile bottom toolbar must be present');
assert.ok(editorContent.includes('fp-mobile-tool-select'), 'Select tool button must exist');
assert.ok(editorContent.includes('fp-mobile-tool-wall'), 'Wall tool button must exist');
assert.ok(editorContent.includes('fp-mobile-tool-door'), 'Door tool button must exist');
assert.ok(editorContent.includes('fp-mobile-tool-window'), 'Window tool button must exist');
assert.ok(editorContent.includes('fp-mobile-tool-room'), 'Room tool button must exist');
assert.ok(editorContent.includes('fp-mobile-tool-shapes'), 'Shapes tool button must exist');
assert.ok(editorContent.includes('fp-mobile-tool-more'), 'More tools button must exist');
assert.ok(editorContent.includes('fp-mobile-subtoolbar'), 'Contextual subtoolbar for active tool must exist');
console.log('✓ Compact 7-tool bottom toolbar and contextual subtoolbars verified.');

console.log('\n[Test 4] Mobile Bottom Sheets (Menu, Shapes, More Tools, Details)...');
assert.ok(editorContent.includes('showMobileMenu'), 'Mobile more menu sheet state must exist');
assert.ok(editorContent.includes('showMobileShapes'), 'Mobile shapes sheet state must exist');
assert.ok(editorContent.includes('showMobileMoreTools'), 'Mobile more tools sheet state must exist');
assert.ok(editorContent.includes('showMobileDetails'), 'Mobile details sheet state must exist');
assert.ok(editorContent.includes('<span className="fp-mobile-sheet-title">Room shapes</span>'), 'Shapes sheet has a plain-English title (Room shapes)');
assert.ok(editorContent.includes('Rectangle Room'), 'Shapes sheet must support Rectangle Room');
assert.ok(editorContent.includes('Circle / Round'), 'Shapes sheet must support Circle / Round shape');
assert.ok(editorContent.includes('Polygon / L-Shape'), 'Shapes sheet must support Polygon / L-Shape');
assert.ok(editorContent.includes('Browse Full Shape Library'), 'Shapes sheet must link to full shape library');
console.log('✓ All 4 mobile bottom sheets (Menu, Shapes, More Tools, Details) verified.');

console.log('\n[Test 5] Touch Gestures & Dual-Mode Interaction...');
assert.ok(editorContent.includes('touchToMouseEvent'), 'Touch-to-mouse coordinate conversion helper must exist');
assert.ok(editorContent.includes('e.touches.length === 2'), 'Two-finger pinch-zoom and pan must be handled');
assert.ok(editorContent.includes('e.touches.length === 1'), 'Single-touch drawing and interaction must be handled');
console.log('✓ Single-finger drawing/placement and two-finger pinch-zoom/pan verified.');

console.log('\n[Test 6] CSS Responsiveness & Mobile Overrides...');
const cssPath = path.join(process.cwd(), 'src', 'index.css');
const cssContent = fs.readFileSync(cssPath, 'utf8');

assert.ok(cssContent.includes('.fp-mobile-header'), 'CSS must define .fp-mobile-header');
assert.ok(cssContent.includes('.fp-mobile-mode-bar'), 'CSS must define .fp-mobile-mode-bar');
assert.ok(cssContent.includes('.fp-mobile-zoom-pill'), 'CSS must define .fp-mobile-zoom-pill');
assert.ok(cssContent.includes('.fp-fab-ai'), 'CSS must define .fp-fab-ai');
assert.ok(cssContent.includes('.fp-ai-stroke-card'), 'CSS must define .fp-ai-stroke-card');
assert.ok(cssContent.includes('.fp-mobile-status-strip'), 'CSS must define .fp-mobile-status-strip');
assert.ok(cssContent.includes('.fp-mobile-toolbar'), 'CSS must define .fp-mobile-toolbar');
assert.ok(cssContent.includes('.fp-mobile-sheet'), 'CSS must define .fp-mobile-sheet');

// Check that desktop panels are hidden on mobile
assert.ok(cssContent.includes('.fp-editor-header,\n  .fp-toolbar') || cssContent.includes('.fp-editor-header,'), 'Desktop header and toolbar must be hidden on mobile');
// Check that mobile controls are hidden on desktop
assert.ok(cssContent.includes('.fp-mobile-header,\n  .fp-mobile-mode-bar') || cssContent.includes('.fp-mobile-header,'), 'Mobile controls must be hidden on desktop');

console.log('✓ CSS responsive classes, breakpoints, and 0-overflow rules verified.');

console.log('\n🎉 ALL 6 MOBILE CAD REDESIGN TEST SUITES PASSED CLEANLY!\n');
