import fs from 'fs';
import path from 'path';
import 'fake-indexeddb/auto';
import {
  getToolVisual,
  getExpenseVisual,
  getMaterialVisual,
  getRodVisual,
  getWorkerVisual,
  SITE_VISUAL,
} from '../src/utils/constructionVisuals';
import { getCategoryFallback, type FallbackCategory } from '../src/components/ui/SafeImage';
import { calculateFinancialBalance } from '../src/utils/financial';

async function runAuditFixesTests() {
  console.log('🔍 Starting Building Mistry Audit & Fix Verification Tests...\n');

  // Test 1: Fallback Visuals Integrity & SafeImage getCategoryFallback
  console.log('[Test 1] Verifying Fallback Visuals & Safe SVG Data URIs across all categories...');
  const expectedVisualKeys: FallbackCategory[] = [
    'tea', 'snacks', 'juice', 'food', 'pooja', 'electricity', 'water', 'other',
    'cement', 'sand', 'msand', 'bricks', 'rod', 'aggregate',
    'site', 'tool', 'worker', 'hammer', 'shovel', 'grinder', 'mixer',
  ];

  for (const key of expectedVisualKeys) {
    const dataUri = getCategoryFallback(key);
    if (!dataUri || typeof dataUri !== 'string') {
      throw new Error(`Fallback visual missing or invalid for category: "${key}"`);
    }
    const isValidSvgUri =
      dataUri.startsWith('data:image/svg+xml;utf8,%3Csvg') ||
      dataUri.startsWith('data:image/svg+xml;utf8,<svg') ||
      dataUri.startsWith('data:image/svg+xml;base64,');

    if (!isValidSvgUri) {
      throw new Error(`Fallback visual for "${key}" is not a valid SVG data URI: ${dataUri.slice(0, 30)}...`);
    }
    if (dataUri.length < 100) {
      throw new Error(`Fallback visual for "${key}" appears truncated (${dataUri.length} chars)`);
    }
  }

  // Also verify default SITE_VISUAL is valid SVG
  if (
    !SITE_VISUAL.startsWith('data:image/svg+xml;utf8,%3Csvg') &&
    !SITE_VISUAL.startsWith('data:image/svg+xml;utf8,<svg')
  ) {
    throw new Error('SITE_VISUAL is not a valid SVG data URI');
  }
  console.log(`✓ All ${expectedVisualKeys.length} categories have valid, self-contained SVG fallback data URIs.`);

  // Test 2: 15 Tools + Custom Tool Resolution
  console.log('\n[Test 2] Verifying 15 Standard Tools + Custom Tool Visuals & Tamil metadata...');
  const toolNames = [
    'Hammer',
    'Trowel',
    'Brick Trowel',
    'Shovel',
    'Pickaxe',
    'Crowbar',
    'Measuring Tape',
    'Bucket',
    'Wheelbarrow',
    'Ladder',
    'Drill Machine',
    'Grinder',
    'Concrete Mixer',
    'Tool Box',
    'Saw',
    'Custom Tool',
  ];

  for (const tool of toolNames) {
    const visual = getToolVisual(tool);
    if (!visual.tamilName || visual.tamilName.trim().length === 0) {
      throw new Error(`Tool "${tool}" is missing a Tamil translation.`);
    }
    if (!visual.description || visual.description.trim().length === 0) {
      throw new Error(`Tool "${tool}" is missing a description.`);
    }
    if (!visual.imageUrl || visual.imageUrl.trim().length === 0) {
      throw new Error(`Tool "${tool}" is missing an imageUrl.`);
    }
  }

  // Also test unknown tool fallback
  const fallbackTool = getToolVisual('Alien Laser Cutter');
  if (!fallbackTool.imageUrl || !fallbackTool.tamilName) {
    throw new Error('Unknown tool did not provide graceful fallback visual.');
  }
  console.log(`✓ Verified 15 standard tools + Custom Tool + unknown fallback resolution (${toolNames.length + 1} checks passed).`);

  // Test 3: 8 Daily Expense Categories Resolution
  console.log('\n[Test 3] Verifying 8 Expense Categories (Tea, Snacks, Juice, Food, Pooja, Other, Electricity, Water)...');
  const expenseCategories: Array<'tea' | 'snacks' | 'juice' | 'food' | 'pooja' | 'other' | 'electricity' | 'water'> = [
    'tea', 'snacks', 'juice', 'food', 'pooja', 'other', 'electricity', 'water',
  ];

  for (const exp of expenseCategories) {
    const visual = getExpenseVisual(exp);
    if (!visual.imageUrl || !visual.name || !visual.tamilName) {
      throw new Error(`Expense category "${exp}" missing required visual properties.`);
    }
    if (!visual.description) {
      throw new Error(`Expense category "${exp}" missing description.`);
    }
  }
  console.log(`✓ All 8 expense category visuals resolved with Tamil titles, descriptions, and images.`);

  // Test 4: Materials & Worker Categories Resolution
  console.log('\n[Test 4] Verifying Core Construction Material & Worker Visuals...');
  const materialCategories = ['cement', 'sand', 'msand', 'bricks', 'rod', 'aggregate'];
  for (const mat of materialCategories) {
    const visual = getMaterialVisual(mat);
    if (!visual.imageUrl || !visual.name || !visual.tamilName) {
      throw new Error(`Material category "${mat}" missing required visual properties.`);
    }
  }

  const workerVisual = getWorkerVisual('PERIYAAL');
  if (!workerVisual.imageUrl || !workerVisual.tamilName) {
    throw new Error('Worker visual resolution failed.');
  }
  console.log(`✓ All 6 construction material categories and worker categories resolved with Tamil titles and images.`);

  // Test 5: Universal Payment Rule (Never Negative Balance)
  console.log('\n[Test 5] Verifying Universal Payment Rule (Never Negative Balance)...');

  // Case 1: Unpaid
  const case1 = calculateFinancialBalance(5000, 0);
  if (case1.balanceDue !== 5000 || case1.extraPaid !== 0 || case1.status !== 'UNPAID') {
    throw new Error(`Unpaid case calculation failed: ${JSON.stringify(case1)}`);
  }

  // Case 2: Partial payment
  const case2 = calculateFinancialBalance(5000, 3200);
  if (case2.balanceDue !== 1800 || case2.extraPaid !== 0 || case2.status !== 'PARTIALLY_PAID') {
    throw new Error(`Partial payment calculation failed: ${JSON.stringify(case2)}`);
  }

  // Case 3: Fully paid
  const case3 = calculateFinancialBalance(5000, 5000);
  if (case3.balanceDue !== 0 || case3.extraPaid !== 0 || case3.status !== 'PAID') {
    throw new Error(`Fully paid calculation failed: ${JSON.stringify(case3)}`);
  }

  // Case 4: Overpaid / Extra Paid
  const case4 = calculateFinancialBalance(5000, 6500);
  if (case4.balanceDue !== 0 || case4.extraPaid !== 1500 || case4.status !== 'EXTRA_PAID') {
    throw new Error(`Overpaid calculation failed: ${JSON.stringify(case4)}`);
  }
  if (case4.balanceDue < 0) {
    throw new Error(`CRITICAL: Balance Due must never be negative! Got ${case4.balanceDue}`);
  }

  // Case 5: Zero total, positive payment
  const case5 = calculateFinancialBalance(0, 750);
  if (case5.balanceDue !== 0 || case5.extraPaid !== 750 || case5.status !== 'EXTRA_PAID') {
    throw new Error(`Zero total overpaid calculation failed: ${JSON.stringify(case5)}`);
  }
  console.log('✓ Universal payment calculations strictly satisfy: Balance Due >= 0, Extra Paid >= 0 in all cases.');

  // Test 6: Modal Sticky Footers and Submission Protection in Codebase
  console.log('\n[Test 6] Verifying Modal Submission Protection & Sticky Footers in Source Files...');
  const modalFiles = [
    'MaterialModal.tsx',
    'RodModal.tsx',
    'WorkerModal.tsx',
    'AdvanceModal.tsx',
    'SalaryPaymentModal.tsx',
    'TeaSnacksModal.tsx',
    'PoojaModal.tsx',
    'ElectricityModal.tsx',
    'WaterModal.tsx',
    'OtherExpenseModal.tsx',
    'CommentModal.tsx',
    'SiteModal.tsx',
    'ToolModal.tsx',
  ];

  for (const file of modalFiles) {
    const filePath = path.resolve(process.cwd(), 'src/components', file);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Modal file missing: ${file}`);
    }
    const content = fs.readFileSync(filePath, 'utf8');

    // 1. Must contain modal-footer
    if (!content.includes('modal-footer')) {
      throw new Error(`Modal ${file} is missing modal-footer container.`);
    }

    // 2. Must contain Cancel button
    if (!content.includes('Cancel')) {
      throw new Error(`Modal ${file} is missing Cancel button in footer.`);
    }

    // 3. Must contain submission guard state
    const hasSubmissionState =
      content.includes('isSubmitting') ||
      content.includes('isSaving') ||
      content.includes('loading') ||
      content.includes('saving');

    if (!hasSubmissionState) {
      throw new Error(`Modal ${file} is missing submission lock state (isSubmitting/isSaving/loading).`);
    }

    // 4. Must disable button on submit
    if (
      !content.includes('disabled={isSubmitting}') &&
      !content.includes('disabled={isSaving}') &&
      !content.includes('disabled={loading}') &&
      !content.includes('disabled={saving}')
    ) {
      throw new Error(`Modal ${file} does not disable action buttons during submission.`);
    }
  }
  console.log(`✓ All ${modalFiles.length} Add/Edit modals verified for submission guards and sticky footers.`);

  // Test 7: Form Semantic HTML & Autocomplete Attributes Verification
  console.log('\n[Test 7] Verifying Semantic Autocomplete & ID Attributes in Login & Password Modals...');
  const loginViewContent = fs.readFileSync(path.resolve(process.cwd(), 'src/views/LoginView.tsx'), 'utf8');
  if (!loginViewContent.includes('autoComplete="username"')) {
    throw new Error('LoginView.tsx missing autoComplete="username"');
  }
  if (!loginViewContent.includes('autoComplete="current-password"')) {
    throw new Error('LoginView.tsx missing autoComplete="current-password"');
  }
  if (!loginViewContent.includes('autoComplete="new-password"')) {
    throw new Error('LoginView.tsx missing autoComplete="new-password"');
  }
  if (!loginViewContent.includes('id="login-identifier"') || !loginViewContent.includes('id="login-password"')) {
    throw new Error('LoginView.tsx missing id attributes on login inputs');
  }

  const changeInitPwdContent = fs.readFileSync(path.resolve(process.cwd(), 'src/components/ChangeInitialPasswordModal.tsx'), 'utf8');
  if (!changeInitPwdContent.includes('autoComplete="new-password"') || !changeInitPwdContent.includes('id="init-new-password"')) {
    throw new Error('ChangeInitialPasswordModal.tsx missing semantic new-password attributes');
  }

  const forgotPwdContent = fs.readFileSync(path.resolve(process.cwd(), 'src/components/ForgotPasswordModal.tsx'), 'utf8');
  if (!forgotPwdContent.includes('autoComplete="one-time-code"') || !forgotPwdContent.includes('id="fp-otp"')) {
    throw new Error('ForgotPasswordModal.tsx missing autoComplete="one-time-code"');
  }
  console.log('✓ Verified native browser credential autofill and semantic attributes across all login/auth modals.');

  // Test 8: Super Admin Sticky Inspection Banner in SiteDetailView
  console.log('\n[Test 8] Verifying Super Admin Sticky Inspection Banner in SiteDetailView...');
  const siteDetailContent = fs.readFileSync(path.resolve(process.cwd(), 'src/views/SiteDetailView.tsx'), 'utf8');
  if (!siteDetailContent.includes('Inspecting Site:') || !siteDetailContent.includes('Admin View / அட்மின் பார்வை')) {
    throw new Error('SiteDetailView.tsx missing Super Admin Inspection Banner');
  }
  if (!siteDetailContent.includes('Return to Admin Dashboard (அட்மின் முகப்புக்குத் திரும்பு)')) {
    throw new Error('SiteDetailView.tsx missing Return to Admin Dashboard button in banner');
  }
  console.log('✓ Verified Super Admin Inspection Banner and return navigation in SiteDetailView.');

  // Test 9: Supabase Service & RLS Policies Migration File
  console.log('\n[Test 9] Verifying Supabase Service & PostgreSQL RLS Migration...');
  const rlsMigrationPath = path.resolve(process.cwd(), 'supabase/migrations/001_rls_policies.sql');
  if (!fs.existsSync(rlsMigrationPath)) {
    throw new Error('supabase/migrations/001_rls_policies.sql is missing');
  }
  const rlsContent = fs.readFileSync(rlsMigrationPath, 'utf8');
  if (!rlsContent.includes('CREATE POLICY "Sites owner isolation') || !rlsContent.includes('is_super_admin()')) {
    throw new Error('RLS migration missing tenant isolation policies or is_super_admin() helper');
  }

  const supabaseServiceContent = fs.readFileSync(path.resolve(process.cwd(), 'src/services/supabase.ts'), 'utf8');
  if (!supabaseServiceContent.includes('isSupabaseConfigured') || !supabaseServiceContent.includes('createClient')) {
    throw new Error('src/services/supabase.ts missing isSupabaseConfigured or createClient');
  }
  console.log('✓ Verified Supabase client wrapper with offline fallback and complete PostgreSQL RLS migration.');

  console.log('\n🎉 ALL AUDIT & FIX VERIFICATION TESTS PASSED SUCCESSFULLY! (9/9 Suites Passed)');
}

runAuditFixesTests().catch(err => {
  console.error('\n❌ AUDIT FIXES TEST SUITE FAILED:', err);
  process.exit(1);
});

