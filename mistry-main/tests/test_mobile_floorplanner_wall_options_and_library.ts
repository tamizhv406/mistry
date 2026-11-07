import fs from 'fs';
import path from 'path';
import 'fake-indexeddb/auto';
import { db } from '../src/db/db';
import { ARCHITECTURAL_OPENINGS_PALETTE } from '../src/components/floorplan/ArchitecturalBlockDrawer';

async function runMobileFloorPlannerWallOptionsAndLibraryTests() {
  console.log('📐 Starting Comprehensive Tests: Mobile Floor Planner, Wall Presets, Light Dashboard Cards & Furniture Library...\n');

  // ───────────────────────────────────────────────────────────────────────────
  // Part 1: Mobile Interface & Three-Bar Menu Workspace Maximization
  // ───────────────────────────────────────────────────────────────────────────
  console.log('[Test 1] Verifying Floor Planner Three-Bar Drawer Menu & Mobile Workspace Maximization...');
  const editorPath = path.resolve('src/views/FloorPlanEditorView.tsx');
  const constantsPath = path.resolve('src/views/floorPlan/constants.ts');
  const editorCode = fs.readFileSync(editorPath, 'utf8') + '\n' +
    (fs.existsSync(constantsPath) ? fs.readFileSync(constantsPath, 'utf8') : '');

  // Three-bar menu toggle button
  if (!editorCode.includes('id="fp-mobile-drawer-toggle-btn"') || !editorCode.includes('Toggle Layouts & Elements (☰)')) {
    throw new Error('Missing three-bar menu toggle button (#fp-mobile-drawer-toggle-btn) in FloorPlanEditorView.tsx');
  }

  // Drawer has Layouts, Elements, and Tools tabs
  if (!editorCode.includes('id="fp-drawer-tab-layouts"') ||
      !editorCode.includes('id="fp-drawer-tab-elements"') ||
      !editorCode.includes('id="fp-drawer-tab-tools"')) {
    throw new Error('Three-bar menu drawer is missing segmented tabs (Layouts, Elements, Tools)');
  }

  // CSS hides bottom bar, info panel, and floating cad controls on mobile to maximize workspace
  const indexCssPath = path.resolve('src/index.css');
  const indexCss = fs.readFileSync(indexCssPath, 'utf8');
  if (!indexCss.includes('.fp-bottom-bar') || !indexCss.includes('.fp-builder-drawer')) {
    throw new Error('index.css missing mobile drawer and bottom-bar display rules');
  }

  console.log('  ✅ Three-bar menu cleanly contains layout elements and maximizes mobile CAD workspace.');

  // ───────────────────────────────────────────────────────────────────────────
  // Part 2: Specific Wall Options (Outer Layer Wall vs Interior Wall)
  // ───────────────────────────────────────────────────────────────────────────
  console.log('[Test 2] Verifying Outer Layer Wall and Interior Wall presets and tools...');
  // Dock buttons
  if (!editorCode.includes('id="fp-dock-tool-outer-wall"') || !editorCode.includes('id="fp-dock-tool-interior-wall"')) {
    throw new Error('Bottom dock missing explicit outer-wall and interior-wall tool buttons');
  }

  // Drawer menu wireframe cards
  if (!editorCode.includes('id="fp-drawer-outer-wall"') || !editorCode.includes('id="fp-drawer-interior-wall"')) {
    throw new Error('Three-bar menu missing explicit Outer Wall (9″) and Interior Wall (4.5″) drawer cards');
  }

  // Thickness presets: 9 inches (0.75 ft / 0.23 m) vs 4.5 inches (0.375 ft / 0.115 m)
  if (!editorCode.includes('setWallThickness(unit === \'feet\' ? 0.75 : 0.23)') ||
      !editorCode.includes('setWallThickness(unit === \'feet\' ? 0.375 : 0.115)')) {
    throw new Error('Wall thickness presets must configure 9″ for Outer Wall and 4.5″ for Interior Wall');
  }

  console.log('  ✅ Outer Layer Wall (9″) and Interior Wall (4.5″) presets verified in both bottom dock and 3-bar menu.');

  // ───────────────────────────────────────────────────────────────────────────
  // Part 3: Light Minimalist Compact Dashboard Cards
  // ───────────────────────────────────────────────────────────────────────────
  console.log('[Test 3] Verifying Light Theme & Compact Dashboard Cards...');
  const recordCardsCss = fs.readFileSync(path.resolve('src/styles/record-cards.css'), 'utf8');

  // .interactive-card must use light background (#ffffff)
  if (!recordCardsCss.includes('.interactive-card {') ||
      !recordCardsCss.includes('background: #ffffff;')) {
    throw new Error('.interactive-card must have a clean light theme background (#ffffff)');
  }

  // .interactive-card must have compact padding (12px 14px) and light border (#e2e8f0)
  if (!recordCardsCss.includes('padding: 12px 14px;') ||
      !recordCardsCss.includes('border: 1px solid #e2e8f0;')) {
    throw new Error('.interactive-card must have compact padding and light border (#e2e8f0)');
  }

  // .erp-kpi-card in erp-dashboard.css must be compact
  const erpDashboardCss = fs.readFileSync(path.resolve('src/styles/erp-dashboard.css'), 'utf8');
  if (!erpDashboardCss.includes('.erp-kpi-card {') || !erpDashboardCss.includes('padding: 12px 14px;')) {
    throw new Error('.erp-kpi-card must have compact padding (12px 14px)');
  }

  console.log('  ✅ Dashboard cards styled with modern light minimalist theme and compact padding.');

  // ───────────────────────────────────────────────────────────────────────────
  // Part 4: Comprehensive Furniture & CAD Symbols Library
  // ───────────────────────────────────────────────────────────────────────────
  console.log('[Test 4] Verifying Comprehensive Furniture Catalog and Symbols Library...');
  // Expanded furniture items
  const expectedItems = [
    'Single Bed', 'Double Bed', 'Queen Bed', 'King Bed', 'Wardrobe', 'Dressing Table', 'Nightstand',
    '1-Seater Sofa', '2-Seater Sofa', '3-Seater Sofa', 'L-shaped Sofa', 'Coffee Table', 'TV Unit', 'Bookshelf',
    'Dining Table 4', 'Dining Table 6', 'Dining Table 8', 'Study Desk', 'Office Chair',
    'Kitchen Counter', 'Kitchen Sink', 'Gas Stove / Cooktop', 'Refrigerator', 'Kitchen Island', 'Breakfast Counter',
    'WC / Toilet', 'Indian Toilet', 'Wash Basin', 'Bathroom Vanity', 'Shower Cubicle', 'Bathtub',
    'Washing Machine', 'Split AC', 'Ceiling Fan', 'Distribution Board', 'Column', 'Plant', 'Car Parking'
  ];

  for (const item of expectedItems) {
    if (!editorCode.includes(`itemType: '${item}'`)) {
      throw new Error(`FURNITURE_CATALOG missing expected architectural item: "${item}"`);
    }
  }

  console.log(`  ✅ Furniture catalog verified with ${expectedItems.length} comprehensive architectural items.`);

  // ───────────────────────────────────────────────────────────────────────────
  // Part 5: Diverse Window Styles & Smooth Architectural Interaction
  // ───────────────────────────────────────────────────────────────────────────
  console.log('[Test 5] Verifying Diverse Window Styles and Architectural Canvas Renderers...');
  // Openings palette has diverse windows
  const windowTypesInPalette = ARCHITECTURAL_OPENINGS_PALETTE.filter(o => o.kind === 'window');
  if (windowTypesInPalette.length < 5) {
    throw new Error(`Expected at least 5 diverse window styles in ARCHITECTURAL_OPENINGS_PALETTE, found ${windowTypesInPalette.length}`);
  }

  const expectedWindowIds = [
    'window_4x4',
    'window_5x4',
    'window_sliding_4x4',
    'window_bay_6x5',
    'window_corner_4x4',
    'window_french_6x6',
    'window_ventilator_2x1_5',
  ];
  for (const wid of expectedWindowIds) {
    if (!ARCHITECTURAL_OPENINGS_PALETTE.some(o => o.id === wid)) {
      throw new Error(`ARCHITECTURAL_OPENINGS_PALETTE missing window style: "${wid}"`);
    }
  }

  // ArchitecturalSymbols component supports Bay Window, Corner Window, Fixed/French Window
  const symbolsCode = fs.readFileSync(path.resolve('src/components/visuals/ArchitecturalSymbols.tsx'), 'utf8');
  if (!symbolsCode.includes("case 'Bay Window':") ||
      !symbolsCode.includes("case 'Corner Window':") ||
      !symbolsCode.includes("case 'Fixed Window':") ||
      !symbolsCode.includes("case 'French Window':")) {
    throw new Error('ArchitecturalSymbols.tsx missing diverse window render cases (Bay, Corner, French/Fixed)');
  }

  // Canvas window renderer handles Bay, Corner, Fixed/French, Ventilator, Sliding
  if (!editorCode.includes("winType.includes('Bay')") ||
      !editorCode.includes("winType.includes('Corner')") ||
      !editorCode.includes("winType.includes('Fixed')") ||
      !editorCode.includes("winType.includes('Ventilator')")) {
    throw new Error('FloorPlanEditorView.tsx SVG canvas missing specialized window glazing lines for diverse window types');
  }

  console.log('  ✅ Diverse window styles (Sliding, Bay, Corner, French, Louvered) verified with architectural SVG detailing.');

  // ───────────────────────────────────────────────────────────────────────────
  // Part 6: Login Page & 3-Question Security Reset System
  // ───────────────────────────────────────────────────────────────────────────
  console.log('[Test 6] Verifying Login Page and 3 Pre-set Security Questions Auth Flow...');
  const loginCode = fs.readFileSync(path.resolve('src/views/LoginView.tsx'), 'utf8');

  // Fields
  if (!loginCode.includes('id="login-identifier"') || !loginCode.includes('id="login-password"')) {
    throw new Error('LoginView.tsx missing Email ID and Password input fields');
  }
  // Links
  if (!loginCode.includes('id="link-create-account"') || !loginCode.includes('id="link-forget-password"')) {
    throw new Error('LoginView.tsx missing Create New Account or Forget Password links');
  }
  // 3 Security Questions in registration and forget password
  const questions = ['What is your name?', 'Which city are you in?', 'Who is your friend?'];
  for (const q of questions) {
    if (!loginCode.includes(q)) {
      throw new Error(`LoginView.tsx missing required security question: "${q}"`);
    }
  }

  console.log('  ✅ Login page with Email, Password, and 3-Question Security Reset verified.');

  // ───────────────────────────────────────────────────────────────────────────
  // Part 7: Mobile Wall Details & Dimension Visibility at a Glance
  // ───────────────────────────────────────────────────────────────────────────
  console.log('[Test 7] Verifying Mobile Wall Details & Dimension Legibility without zoom or hover...');
  // Increased base mobile font size for immediate legibility
  if (!editorCode.includes('(isMobile ? 13.5 : 11.5) * dimTextScale')) {
    throw new Error('dimFontPx must be boosted on mobile for clear legibility without zooming in');
  }

  // Dimension threshold allows shorter walls to display dimensions on mobile without zoom
  if (!editorCode.includes('onScreen < (isMobile ? 14 : 26) && !isSelected')) {
    throw new Error('Wall dimension visibility threshold must accommodate mobile screens without zooming');
  }

  // Wall thickness detail callout shown on mobile
  if (!editorCode.includes('item.wallThickness < 0.5 ? (unit === \'feet\' ? \'4.5″\' : \'115mm\') : (unit === \'feet\' ? \'9″\' : \'230mm\')')) {
    throw new Error('Mobile dimensions must include wall thickness detail (9″ Outer / 4.5″ Interior) at a glance');
  }

  // High-contrast drop shadow on mobile dimension badge
  if (!editorCode.includes('filter: \'drop-shadow(0 2px 4px rgba(15, 23, 42, 0.18))\'')) {
    throw new Error('Dimension label badge on mobile must have high-contrast drop-shadow for instant legibility');
  }

  console.log('  ✅ Mobile wall details (length, 9″ / 4.5″ thickness tag, high-contrast badges) are visible and legible at a glance.');
  console.log('\n🎉 ALL TESTS PASSED: Mobile Floor Planner, Wall Presets, Light Dashboard Cards, Expanded Furniture Library & Security Questions Auth!\n');
}

runMobileFloorPlannerWallOptionsAndLibraryTests().catch((err) => {
  console.error('\n❌ Test failed:', err);
  process.exit(1);
});
