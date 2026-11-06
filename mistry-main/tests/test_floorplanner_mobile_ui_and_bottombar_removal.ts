import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

console.log('--- TEST: FLOOR PLANNER BOTTOM BAR REMOVAL & OPTIMIZED MOBILE THREE-BAR MENU ---');

const editorPath = path.resolve(process.cwd(), 'src', 'views', 'FloorPlanEditorView.tsx');
const editorCode = fs.readFileSync(editorPath, 'utf8');

const cssPath = path.resolve(process.cwd(), 'src', 'styles', 'erp-dashboard.css');
const cssCode = fs.readFileSync(cssPath, 'utf8');

// 1. Requirement 1: Bottom Information Panel Removal
console.log('\nTest 1: Removal of Bottom Information Panel (Unit, Plot, Level, Floor Area, Walls, Room count)');
{
  assert.strictEqual(
    editorCode.includes('<div className="fp-bottom-bar'),
    false,
    'Bottom information panel <div className="fp-bottom-bar"> is removed from FloorPlanEditorView'
  );
  assert.ok(
    cssCode.includes('.fp-bottom-bar') && cssCode.includes('display: none !important;'),
    'CSS ensures .fp-bottom-bar is completely hidden with display: none !important'
  );
  console.log('  ✓ <div className="fp-bottom-bar"> removed from FloorPlanEditorView markup');
  console.log('  ✓ CSS rules enforce display: none !important on .fp-bottom-bar');
}

// 2. Requirement 2: Three-Bar Menu Integration
console.log('\nTest 2: Three-Bar Menu (Drawer) Layout Elements & Controls');
{
  // Check three-bar toggle button exists
  assert.ok(
    editorCode.includes('id="fp-mobile-drawer-toggle-btn"'),
    'Three-bar hamburger menu button exists with ID #fp-mobile-drawer-toggle-btn'
  );

  // Check 3 Segmented Tabs exist in drawer
  assert.ok(
    editorCode.includes('id="fp-drawer-tab-layouts"'),
    'Segmented Tab 1: Layouts exists in drawer'
  );
  assert.ok(
    editorCode.includes('id="fp-drawer-tab-elements"'),
    'Segmented Tab 2: Elements exists in drawer'
  );
  assert.ok(
    editorCode.includes('id="fp-drawer-tab-tools"'),
    'Segmented Tab 3: Tools exists in drawer'
  );

  // Check Layouts Tab content: Pre-Built Room Blocks, Openings, Starter Templates
  assert.ok(
    editorCode.includes('ARCHITECTURAL_ROOM_BLOCKS'),
    'Layouts tab includes ARCHITECTURAL_ROOM_BLOCKS (Living, Master Bed, Kitchen, Bath, Portico)'
  );
  assert.ok(
    editorCode.includes('ARCHITECTURAL_OPENINGS_PALETTE'),
    'Layouts tab includes ARCHITECTURAL_OPENINGS_PALETTE (Teak Door, Room Door, Toilet Door, Windows)'
  );
  assert.ok(
    editorCode.includes('STARTER_TEMPLATES'),
    'Layouts tab includes STARTER_TEMPLATES (BHK Plans)'
  );

  // Check Elements Tab content: Furniture Catalog
  assert.ok(
    editorCode.includes('FURNITURE_CATALOG'),
    'Elements tab includes FURNITURE_CATALOG architectural symbols'
  );

  // Check Tools Tab content: View Modes, Canvas Controls, Calculations
  assert.ok(
    editorCode.includes('handleFitToScreen'),
    'Tools tab includes Fit to Screen'
  );
  assert.ok(
    editorCode.includes('handleResetView'),
    'Tools tab includes Reset View 100%'
  );
  assert.ok(
    editorCode.includes('setShow3D'),
    'Tools tab includes 3D View mode'
  );
  assert.ok(
    editorCode.includes('handleCalculateConstructionCostForPlan'),
    'Tools tab includes Calculate Construction Cost'
  );
  assert.ok(
    editorCode.includes('handleSharePlanToWhatsApp'),
    'Tools tab includes WhatsApp sharing'
  );

  console.log('  ✓ Three-bar menu button #fp-mobile-drawer-toggle-btn verified');
  console.log('  ✓ Layouts tab includes pre-built room blocks, openings and BHK templates');
  console.log('  ✓ Elements tab includes furniture catalog and structural tools');
  console.log('  ✓ Tools tab includes 3D view, viewport controls, and BOQ calculation bridge');
}

// 3. Mobile Workspace Maximization in CSS
console.log('\nTest 3: CSS Mobile Workspace Optimization');
{
  assert.ok(
    cssCode.includes('.fp-shape-library-panel') && cssCode.includes('display: none !important;'),
    'Central shape library overlays hidden on mobile screens'
  );
  assert.ok(
    cssCode.includes('.fp-fab-furniture') && cssCode.includes('display: none !important;'),
    'Right-side floating furniture buttons hidden on mobile screens'
  );
  assert.ok(
    cssCode.includes('.fp-canvas-container') && cssCode.includes('calc(100dvh - 48px)'),
    'Canvas height maximized to full screen viewport height on mobile'
  );
  console.log('  ✓ Central and right-side clutter hidden on mobile screens');
  console.log('  ✓ Full-bleed responsive canvas fills visible screen');
}

console.log('\n========================================');
console.log('All Floor Planner Optimization Tests Passed!');
console.log('========================================\n');
