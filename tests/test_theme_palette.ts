/**
 * Test Suite: Unified Theme Variables, Palette Recolouring & Inline Style Cleanup (Task 4)
 *
 * Verifies:
 * 1. Canonical CSS custom properties in src/index.css match the strict final colour palette
 * 2. Legacy blue/purple hardcoded accents are removed from stylesheets, views, components, and hooks
 * 3. Inline style counts in MaterialsView.tsx and AttendanceSalaryView.tsx are reduced via CSS classes
 * 4. Shared ERP view stylesheet and >= 44px touch target rules exist
 */

import fs from 'node:fs';
import path from 'node:path';

let passed = 0;
let failed = 0;

function check(condition: boolean, msg: string) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${msg}`);
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${msg}`);
  }
}

const root = process.cwd();
const read = (relPath: string) => fs.readFileSync(path.join(root, relPath), 'utf8');

function walkFiles(dir: string, exts: string[], excludeDirs: string[] = []): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (excludeDirs.includes(entry.name)) continue;
      results.push(...walkFiles(full, exts, excludeDirs));
    } else if (exts.some(ext => entry.name.endsWith(ext))) {
      results.push(full);
    }
  }
  return results;
}

console.log('\n--- TASK 4: UNIFIED THEME VARIABLES & COLOUR PALETTE TEST SUITE ---\n');

// 1. Central theme variables in src/index.css
console.log('1. Canonical theme custom properties in src/index.css');
const indexCss = read('src/index.css');
const erpViewsCss = read('src/styles/erp-views.css');
const mainTsx = read('src/main.tsx');

check(indexCss.includes('--color-primary: #F97316;'), 'Defines --color-primary: #F97316 (Orange)');
check(indexCss.includes('--color-on-primary: #1F2937;'), 'Defines --color-on-primary: #1F2937 for high-contrast CTA text');
check(indexCss.includes('--color-charcoal: #1F2937;'), 'Defines --color-charcoal: #1F2937');
check(indexCss.includes('--color-bg: #FAFAF9;'), 'Defines --color-bg: #FAFAF9');
check(indexCss.includes('--color-surface: #FFFFFF;'), 'Defines --color-surface: #FFFFFF');
check(indexCss.includes('--color-success: #16A34A;'), 'Defines --color-success: #16A34A');
check(indexCss.includes('--color-danger: #DC2626;'), 'Defines --color-danger: #DC2626');
check(indexCss.includes('--color-warning: #F59E0B;'), 'Defines --color-warning: #F59E0B');
check(indexCss.includes('--bg-main: var(--color-bg);'), 'Maps --bg-main to var(--color-bg)');
check(indexCss.includes('--text-main: var(--color-text);') && indexCss.includes('--color-text: var(--color-charcoal);'), 'Maps body text to var(--color-charcoal)');
check(/\.btn-primary\s*\{[^}]*var\(--color-primary\)[^}]*var\(--color-on-primary\)/s.test(indexCss), '.btn-primary uses var(--color-primary) and var(--color-on-primary)');

// 2. No legacy blue/purple hardcoded accents outside floorPlanner & semantic categoryIcons
console.log('\n2. Removal of legacy hardcoded blue/purple hex accents across stylesheets, views & components');
const legacyHexRegex = /#(0284c7|0369a1|0ea5e9|38bdf8|e0f2fe|f0f9ff|2563eb|1d4ed8|1e40af|3b82f6|60a5fa|dbeafe|eff6ff|bfdbfe|7c3aed|6d28d9|581c87|6b21a8|8b5cf6|a78bfa|c4b5fd|c084fc|d8b4fe|ede9fe|f3e8ff|faf5ff|4f46e5|6366f1|4338ca|e0e7ff|c7d2fe|818cf8|3730a3|9333ea|a855f7|1e3a8a|312e81)\b/i;

const cssFiles = [path.join(root, 'src/index.css'), ...walkFiles(path.join(root, 'src/styles'), ['.css'])];
const cssViolations = cssFiles.filter(f => legacyHexRegex.test(fs.readFileSync(f, 'utf8')));
check(cssViolations.length === 0, `Zero legacy blue/purple hex accents in CSS files (${cssViolations.length} files remaining)`);

const sourceFiles = walkFiles(path.join(root, 'src'), ['.ts', '.tsx'], ['floorPlanner']).filter(
  f => !f.endsWith(`${path.sep}domain${path.sep}categoryIcons.ts`),
);
const srcViolations = sourceFiles
  .filter(f => legacyHexRegex.test(fs.readFileSync(f, 'utf8')))
  .map(f => path.relative(root, f));
check(srcViolations.length === 0, `Zero legacy blue/purple hex accents in non-floorPlanner src TS/TSX (${srcViolations.join(', ') || 'clean'})`);

// 3. Inline style reduction & ERP shared classes
console.log('\n3. Inline style cleanup & shared CSS classes in MaterialsView & AttendanceSalaryView');
const materialsView = read('src/views/MaterialsView.tsx');
const attendanceView = read('src/views/AttendanceSalaryView.tsx');

const materialsInlineCount = (materialsView.match(/style=\{\{/g) || []).length;
const attendanceInlineCount = (attendanceView.match(/style=\{\{/g) || []).length;

check(materialsInlineCount <= 10, `MaterialsView.tsx inline style={{ count reduced to ${materialsInlineCount} (baseline 121)`);
check(attendanceInlineCount <= 15, `AttendanceSalaryView.tsx inline style={{ count reduced to ${attendanceInlineCount} (baseline 196)`);
check(!/<style[\s>]/i.test(attendanceView), 'Removed embedded <style> block from AttendanceSalaryView.tsx');
check(mainTsx.includes("./styles/erp-views.css"), 'src/main.tsx imports ./styles/erp-views.css');
check(materialsView.includes('erp-view-page') && materialsView.includes('erp-btn-primary'), 'MaterialsView.tsx uses shared erp-views.css classes');
check(attendanceView.includes('erp-view-header') && attendanceView.includes('attendance-page-container') && attendanceView.includes('attendance-kpi-grid'), 'AttendanceSalaryView.tsx uses shared erp-views.css classes');

// 4. Touch target & typography rules
console.log('\n4. Touch targets (>= 44px) and typography rules');
check(indexCss.includes('min-height: 44px;') && erpViewsCss.includes('min-height: 44px;'), 'Global buttons/inputs and ERP controls enforce >= 44px min-height');

console.log(`\nTheme Palette Tests: ${passed} passed, ${failed} failed.\n`);
if (failed > 0) {
  process.exit(1);
}
