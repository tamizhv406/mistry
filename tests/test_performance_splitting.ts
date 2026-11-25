/**
 * Test Suite: Speed, Code Splitting, Lazy Loading & Virtualization (Task 9)
 *
 * Verifies:
 * 1. computeVirtualRange deterministic windowing across empty, small, large, scrolled & filtered lists
 * 2. vite.config.ts keeps default 500 kB warning limit, enables minification, and configures chunk groups
 * 3. src/App.tsx uses React.lazy + Suspense for secondary/heavy views
 * 4. jsPDF & jspdf-autotable are dynamically imported (never top-level) in pdfGenerator & pdfBlueprint
 * 5. Floor Planner lazy-loads 3D view (Three.js) and Map view (MapLibre)
 * 6. Lazy image decoding attributes + compressed Floor Planner textures in public/
 * 7. Built JS chunks (dist/assets/*.js) stay within <= 500 kB when dist/ exists
 */

import fs from 'node:fs';
import path from 'node:path';
import { computeVirtualRange } from '../src/hooks/useVirtualWindow';

let passed = 0;
let failed = 0;

function check(condition: boolean, msg: string, detail?: unknown) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${msg}`);
  } else {
    failed++;
    console.error(`  ✗ ${msg}`, detail !== undefined ? detail : '');
  }
}

const rootDir = path.resolve(import.meta.dirname, '..');

function readRel(relPath: string): string {
  return fs.readFileSync(path.join(rootDir, relPath), 'utf8');
}

function collectFiles(dir: string, ext: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectFiles(full, ext));
    } else if (entry.isFile() && entry.name.endsWith(ext)) {
      results.push(full);
    }
  }
  return results;
}

console.log('\n[1/7] Virtual window math & bounded DOM slices');
{
  const empty = computeVirtualRange({
    itemCount: 0,
    estimateSize: 72,
    scrollTop: 0,
    viewportHeight: 844,
  });
  check(
    !empty.isVirtualized && empty.startIndex === 0 && empty.endIndex === 0 && empty.topSpacerPx === 0 && empty.bottomSpacerPx === 0,
    'Empty list produces zero range and zero spacers',
    empty,
  );

  const small = computeVirtualRange({
    itemCount: 20,
    estimateSize: 72,
    scrollTop: 0,
    viewportHeight: 844,
  });
  check(
    !small.isVirtualized && small.startIndex === 0 && small.endIndex === 20 && small.topSpacerPx === 0 && small.bottomSpacerPx === 0,
    'Small list (20 <= threshold 30) disables virtual spacers and renders all items',
    small,
  );

  const topLarge = computeVirtualRange({
    itemCount: 250,
    estimateSize: 72,
    scrollTop: 0,
    viewportHeight: 844,
  });
  check(
    topLarge.isVirtualized &&
      topLarge.startIndex === 0 &&
      topLarge.endIndex - topLarge.startIndex < 40 &&
      topLarge.topSpacerPx === 0 &&
      topLarge.bottomSpacerPx === (250 - topLarge.endIndex) * 72,
    'Large list (250 items) at scrollTop=0 bounds DOM slice (< 40 items) and computes bottom spacer',
    topLarge,
  );

  const midLarge = computeVirtualRange({
    itemCount: 250,
    estimateSize: 72,
    scrollTop: 5000,
    viewportHeight: 844,
  });
  check(
    midLarge.isVirtualized &&
      midLarge.startIndex > 50 &&
      midLarge.endIndex - midLarge.startIndex < 40 &&
      midLarge.topSpacerPx === midLarge.startIndex * 72 &&
      midLarge.bottomSpacerPx === (250 - midLarge.endIndex) * 72,
    'Large list mid-scroll shifts window with exact top/bottom spacers',
    midLarge,
  );

  const filteredDown = computeVirtualRange({
    itemCount: 8,
    estimateSize: 72,
    scrollTop: 0,
    viewportHeight: 844,
  });
  check(
    !filteredDown.isVirtualized && filteredDown.endIndex === 8 && filteredDown.topSpacerPx === 0,
    'Search-filtered slice drops cleanly out of virtual mode',
    filteredDown,
  );
}

console.log('\n[2/7] vite.config.ts chunk limits, minification & modular aliases');
{
  const viteCfg = readRel('vite.config.ts');
  check(!/chunkSizeWarningLimit\s*:/.test(viteCfg), 'vite.config.ts does not raise chunkSizeWarningLimit');
  check(!/minify\s*:\s*false/.test(viteCfg), 'vite.config.ts keeps minification enabled');
  check(viteCfg.includes('codeSplitting'), 'vite.config.ts configures manual codeSplitting groups');
  check(viteCfg.includes('three/src/Three.js') && viteCfg.includes('maplibre-gl'), 'vite.config.ts aliases three and maplibre-gl to modular sources');
}

console.log('\n[3/7] React.lazy + Suspense route/view splitting in src/App.tsx');
{
  const appSrc = readRel('src/App.tsx');
  const lazyViews = [
    'HomeView',
    'LabourView',
    'WorkerProfileView',
    'StockView',
    'ToolRoomView',
    'ExpensesView',
    'ReportsView',
    'DashboardView',
    'ProjectsView',
    'SiteDetailView',
    'TrashView',
    'BackupView',
    'SettingsView',
    'EstimatorView',
    'AdminDashboardView',
    'FloorPlanListView',
    'FloorPlannerHostView',
    'MaterialsView',
    'AttendanceSalaryView',
  ];
  for (const name of lazyViews) {
    check(
      new RegExp(`const\\s+${name}\\s*=\\s*lazy\\(`).test(appSrc),
      `${name} is lazy-loaded via React.lazy`,
    );
  }
  check(appSrc.includes('<Suspense') && appSrc.includes('ViewLoadingFallback'), 'App.tsx wraps lazy workspace views in <Suspense>');
}

console.log('\n[4/7] Dynamic jsPDF / jspdf-autotable imports');
{
  const pdfGen = readRel('src/utils/pdfGenerator.ts');
  const pdfBp = readRel('src/floorPlanner/utils/pdfBlueprint.ts');
  check(!/^\s*import\s+[\w*{][^\n]*['"]jspdf['"]/m.test(pdfGen), 'pdfGenerator.ts has no static top-level jspdf import');
  check(!/^\s*import\s+[\w*{][^\n]*['"]jspdf-autotable['"]/m.test(pdfGen), 'pdfGenerator.ts has no static top-level jspdf-autotable import');
  check(pdfGen.includes("import('jspdf')") && pdfGen.includes("import('jspdf-autotable')"), 'pdfGenerator.ts dynamically imports jspdf + jspdf-autotable');
  check(!/^\s*import\s+[\w*{][^\n]*['"]jspdf['"]/m.test(pdfBp), 'pdfBlueprint.ts has no static top-level jspdf import');
  check(pdfBp.includes("import('jspdf')"), 'pdfBlueprint.ts dynamically imports jspdf');
}

console.log('\n[5/7] Floor Planner lazy-loads Three.js 3D view & MapLibre');
{
  const fpApp = readRel('src/floorPlanner/App.tsx');
  check(/lazy\(\(\)\s*=>\s*import\(['"]\.\/view3d['"]\)\)/.test(fpApp), 'Floor Planner lazy-loads View3D (Three.js)');
  check(/lazy\(\(\)\s*=>\s*import\(['"]\.\/map['"]\)\)/.test(fpApp), 'Floor Planner lazy-loads MapView (MapLibre)');
}

console.log('\n[6/7] Lazy image loading attributes, virtualization wiring & compressed textures');
{
  const imgFiles = [
    'src/components/ui/SafeImage.tsx',
    'src/components/ui/CategoryIcon.tsx',
    'src/components/BillPhotoComponents.tsx',
    'src/views/mobile/ToolRoomView.tsx',
    'src/views/AdminDashboardView.tsx',
  ];
  for (const rel of imgFiles) {
    const src = readRel(rel);
    const hasLazy = /loading=(?:"lazy"|\{[^}]*['"]lazy['"][^}]*\})/.test(src);
    const hasAsync = /decoding=(?:"async"|\{[^}]*['"]async['"][^}]*\})/.test(src);
    check(hasLazy && hasAsync, `${rel} uses loading="lazy" and decoding="async"`);
  }

  const virtualizedViews = [
    'src/views/mobile/LabourView.tsx',
    'src/views/mobile/StockView.tsx',
    'src/views/AttendanceSalaryView.tsx',
    'src/views/MaterialsView.tsx',
    'src/views/site-tabs/DailyExpensesTab.tsx',
  ];
  for (const rel of virtualizedViews) {
    check(readRel(rel).includes('useVirtualWindow'), `${rel} integrates useVirtualWindow`);
  }

  const textures = collectFiles(path.join(rootDir, 'public/floor-planner/textures'), '.jpg');
  const totalBytes = textures.reduce((sum, f) => sum + fs.statSync(f).size, 0);
  check(
    textures.length > 0 && totalBytes < 700 * 1024,
    `Compressed floor-planner textures total ${(totalBytes / 1024).toFixed(1)} KB (< 700 KB across ${textures.length} files)`,
  );
}

console.log('\n[7/7] Built dist/assets/*.js chunk sizes (<= 500 kB)');
{
  const assetsDir = path.join(rootDir, 'dist', 'assets');
  if (!fs.existsSync(assetsDir)) {
    console.log('  (dist/assets not present yet; skipping disk chunk check until build)');
  } else {
    const jsFiles = fs.readdirSync(assetsDir).filter(f => f.endsWith('.js'));
    check(jsFiles.length > 0, `Found ${jsFiles.length} built JS bundles in dist/assets`);

    const mainBundle = jsFiles.find(f => /^main-[^/\\]+\.js$/.test(f));
    check(Boolean(mainBundle), `Initial entry chunk present: ${mainBundle || 'missing'}`);
    if (mainBundle) {
      const mainBytes = fs.statSync(path.join(assetsDir, mainBundle)).size;
      check(mainBytes <= 400 * 1024, `Entry chunk ${mainBundle} is ${(mainBytes / 1024).toFixed(2)} kB (<= 400 kB)`);
    }

    const oversizedAppChunks = jsFiles
      .filter(f => !f.includes('-worker-'))
      .map(f => ({ file: f, bytes: fs.statSync(path.join(assetsDir, f)).size }))
      .filter(item => item.bytes > 500 * 1024);

    check(
      oversizedAppChunks.length === 0,
      'Zero client JS chunks in dist/assets exceed 500 kB',
      oversizedAppChunks,
    );
  }
}

console.log(`\nDone: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
