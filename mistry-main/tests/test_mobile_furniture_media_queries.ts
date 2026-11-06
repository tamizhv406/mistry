import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

console.log('📱 Testing Mobile Furniture Menu Media Queries & Floating Toggle...\n');

// 1. Verify FloorPlanEditorView.tsx component markup
const editorPath = path.join(process.cwd(), 'src', 'views', 'FloorPlanEditorView.tsx');
const editorContent = fs.readFileSync(editorPath, 'utf8');

console.log('[Test 1] Floating Furniture Button Markup in FloorPlanEditorView...');
assert.ok(editorContent.includes('fp-fab-furniture'), 'Floating furniture button (fp-fab-furniture) must be present in editor');
assert.ok(editorContent.includes('fp-mobile-furniture-toggle'), 'Dedicated mobile furniture toggle class must be present');
assert.ok(editorContent.includes('id="fp-mobile-furniture-toggle"'), 'Mobile furniture toggle ID must be present');
console.log('✓ Floating Furniture Action Button markup present on mobile canvas.');

console.log('\n[Test 2] Dedicated Furniture Toggle in Mobile Tool Pill...');
assert.ok(editorContent.includes('fp-mobile-tool-furniture'), 'Dedicated mobile tool pill button (fp-mobile-tool-furniture) must exist');
assert.ok(editorContent.includes('id="fp-mobile-tool-furniture"'), 'id="fp-mobile-tool-furniture" must exist');
console.log('✓ Dedicated Furniture toolbar toggle present in mobile bottom navigation.');

// 2. Verify CSS Media Queries in mobile.css
const mobileCssPath = path.join(process.cwd(), 'src', 'styles', 'mobile.css');
const mobileCss = fs.readFileSync(mobileCssPath, 'utf8');

console.log('\n[Test 3] CSS Media Queries in mobile.css...');
assert.ok(mobileCss.includes('@media (max-width: 768px)'), 'Media query @media (max-width: 768px) must be defined');
assert.ok(mobileCss.includes('@media (max-width: 480px)'), 'Media query @media (max-width: 480px) must be defined');
assert.ok(mobileCss.includes('@media (min-width: 769px)'), 'Desktop media query @media (min-width: 769px) must be defined');

// Verify floating button styling in mobile.css
assert.ok(mobileCss.includes('.fp-fab-furniture'), '.fp-fab-furniture rule must exist in mobile.css');
assert.ok(mobileCss.includes('.fp-mobile-furniture-toggle'), '.fp-mobile-furniture-toggle rule must exist in mobile.css');
assert.ok(mobileCss.includes('.fp-mobile-tool-btn.fp-mobile-tool-furniture'), 'Dedicated mobile tool button styling must exist in mobile.css');
assert.ok(mobileCss.includes('.fp-furniture-modal'), 'Mobile modal styling must exist in mobile.css');
assert.ok(mobileCss.includes('.fp-furniture-dialog'), 'Mobile dialog bottom-sheet styling must exist in mobile.css');
console.log('✓ Media queries and floating button/dedicated toggle styles verified in mobile.css.');

// 3. Verify CSS Media Queries in planner-tools.css
const plannerCssPath = path.join(process.cwd(), 'src', 'styles', 'planner-tools.css');
const plannerCss = fs.readFileSync(plannerCssPath, 'utf8');

console.log('\n[Test 4] CSS Media Queries in planner-tools.css...');
assert.ok(plannerCss.includes('.fp-fab-furniture'), '.fp-fab-furniture rule must exist in planner-tools.css');
assert.ok(plannerCss.includes('.fp-mobile-furniture-toggle'), '.fp-mobile-furniture-toggle rule must exist in planner-tools.css');
assert.ok(plannerCss.includes('@media (max-width: 768px)'), 'Media query @media (max-width: 768px) must exist in planner-tools.css');
console.log('✓ Media queries for furniture toggle verified in planner-tools.css.');

// 4. Verify CSS Media Queries in index.css
const indexCssPath = path.join(process.cwd(), 'src', 'index.css');
const indexCss = fs.readFileSync(indexCssPath, 'utf8');

console.log('\n[Test 5] CSS Media Queries in index.css...');
assert.ok(indexCss.includes('.fp-fab-furniture'), '.fp-fab-furniture rule must exist in index.css');
assert.ok(indexCss.includes('.fp-mobile-furniture-toggle'), '.fp-mobile-furniture-toggle rule must exist in index.css');
assert.ok(indexCss.includes('@media (max-width: 768px)'), 'Media query @media (max-width: 768px) must exist in index.css');
console.log('✓ Media queries for furniture toggle verified in index.css.');

console.log('\n🎉 ALL MOBILE FURNITURE MEDIA QUERY AND TOGGLE TESTS PASSED PERFECTLY!\n');
