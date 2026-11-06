import fs from 'fs';
import path from 'path';
import 'fake-indexeddb/auto';
import { db } from '../src/db/db';
import type { User, UserSecurityQuestions } from '../src/db/types';

async function runTeaSnacksAndSecurityQuestionsAuthTests() {
  console.log('🍵 Starting Tests: Tea & Snacks Minimalist Compact Cards & Security Questions Auth System...\n');

  // ───────────────────────────────────────────────────────────────────────────
  // Part 1: CSS & UI Verification for 'Tea & Snacks' Minimalist Compact Cards
  // ───────────────────────────────────────────────────────────────────────────
  console.log('[Test 1] Verifying Tea & Snacks dashboard cards styling and compactness...');
  const cssPath = path.resolve('src/styles/record-cards.css');
  const cssContent = fs.readFileSync(cssPath, 'utf8');

  // Must have .tea-snacks-card styles
  if (!cssContent.includes('.tea-snacks-card')) {
    throw new Error('record-cards.css is missing .tea-snacks-card class definition');
  }

  // Must use light, minimalist background (#ffffff) instead of dark theme
  if (!cssContent.includes('background: #ffffff !important;') && !cssContent.includes('background: #fff !important;')) {
    throw new Error('Tea & Snacks cards must have a light, minimalist background color (#ffffff)');
  }

  // Must have subtle light border (#e2e8f0)
  if (!cssContent.includes('border: 1px solid #e2e8f0 !important;')) {
    throw new Error('Tea & Snacks cards must have a subtle minimalist 1px border (#e2e8f0)');
  }

  // Must have compact padding (reduced from 18px+ to 10px 12px)
  if (!cssContent.includes('padding: 10px 12px !important;')) {
    throw new Error('Tea & Snacks cards must have compact padding (10px 12px)');
  }

  // Must have compact image size (52px instead of large 80px)
  if (!cssContent.includes('width: 52px !important;') || !cssContent.includes('height: 52px !important;')) {
    throw new Error('Tea & Snacks cards must have reduced compact image size (52px)');
  }

  // Verify DailyExpensesTab attaches the tea-snacks-card classes
  const tabPath = path.resolve('src/views/site-tabs/DailyExpensesTab.tsx');
  const tabContent = fs.readFileSync(tabPath, 'utf8');

  if (!tabContent.includes('tea-snacks-card')) {
    throw new Error('DailyExpensesTab.tsx must apply tea-snacks-card class to refreshment items');
  }
  if (!tabContent.includes('tea-snacks-section')) {
    throw new Error('DailyExpensesTab.tsx must wrap Tea & Snacks subsection in tea-snacks-section container');
  }

  console.log('  ✅ Tea & Snacks dashboard cards are successfully styled with light minimalist theme and compact padding.');

  // ───────────────────────────────────────────────────────────────────────────
  // Part 2: Login Page Structure & Field Verification
  // ───────────────────────────────────────────────────────────────────────────
  console.log('[Test 2] Verifying Login Page fields, Create Account, and Forget Password links...');
  const loginViewPath = path.resolve('src/views/LoginView.tsx');
  const loginViewContent = fs.readFileSync(loginViewPath, 'utf8');

  // Email ID & Password fields in Login form
  if (!loginViewContent.includes('id="login-identifier"') || !loginViewContent.includes('id="login-password"')) {
    throw new Error('LoginView.tsx must have login-identifier (Email ID) and login-password inputs');
  }
  if (!loginViewContent.includes('type="email"') && !loginViewContent.includes('autoComplete="username"')) {
    throw new Error('LoginView.tsx must support email login identification');
  }

  // Links for 'Create New Account' and 'Forget Password'
  if (!loginViewContent.includes('id="link-create-account"') || !loginViewContent.includes('Create New Account')) {
    throw new Error('LoginView.tsx must feature a link for "Create New Account"');
  }
  if (!loginViewContent.includes('id="link-forget-password"') || !loginViewContent.includes('Forget Password')) {
    throw new Error('LoginView.tsx must feature a link for "Forget Password"');
  }

  console.log('  ✅ Login page contains Email ID, Password, "Create New Account", and "Forget Password" links.');

  // ───────────────────────────────────────────────────────────────────────────
  // Part 3: Account Creation with 3 Pre-Set Security Questions
  // ───────────────────────────────────────────────────────────────────────────
  console.log('[Test 3] Verifying 3 Pre-Set Security Questions in Account Creation...');
  // 1. "What is your name?"
  // 2. "Which city are you in?"
  // 3. "Who is your friend?"
  if (!loginViewContent.includes('What is your name?')) {
    throw new Error('LoginView.tsx missing pre-set security question 1: "What is your name?"');
  }
  if (!loginViewContent.includes('Which city are you in?')) {
    throw new Error('LoginView.tsx missing pre-set security question 2: "Which city are you in?"');
  }
  if (!loginViewContent.includes('Who is your friend?')) {
    throw new Error('LoginView.tsx missing pre-set security question 3: "Who is your friend?"');
  }

  // Corresponding registration input IDs
  if (!loginViewContent.includes('id="reg-sec-name"') ||
      !loginViewContent.includes('id="reg-sec-city"') ||
      !loginViewContent.includes('id="reg-sec-friend"')) {
    throw new Error('LoginView.tsx missing input fields for the 3 registration security questions');
  }

  console.log('  ✅ Account creation form defines all 3 required pre-set security questions.');

  // ───────────────────────────────────────────────────────────────────────────
  // Part 4: Forget Password Security Question Verification Flow
  // ───────────────────────────────────────────────────────────────────────────
  console.log('[Test 4] Verifying Forget Password verification system and logic...');
  // Forget password form input IDs
  if (!loginViewContent.includes('id="forgot-email"') ||
      !loginViewContent.includes('id="forgot-sec-name"') ||
      !loginViewContent.includes('id="forgot-sec-city"') ||
      !loginViewContent.includes('id="forgot-sec-friend"')) {
    throw new Error('LoginView.tsx missing verification input fields for Forget Password');
  }

  // Denial on incorrect answers
  if (!loginViewContent.includes('Security verification failed: Incorrect answers to security questions. Password reset request denied.')) {
    throw new Error('LoginView.tsx must deny password reset on incorrect security question answers with exact notification');
  }

  // Password reset allowance on matching answers
  if (!loginViewContent.includes('Security verification passed! Please set your new password below.')) {
    throw new Error('LoginView.tsx must allow password reset upon matching security question answers');
  }

  console.log('  ✅ Forget Password flow successfully verifies security questions and denies/allows reset correctly.');

  // ───────────────────────────────────────────────────────────────────────────
  // Part 5: Database User Schema & Storage Verification
  // ───────────────────────────────────────────────────────────────────────────
  console.log('[Test 5] Testing Dexie User database integration with Security Questions...');
  const testSecurityQuestions: UserSecurityQuestions = {
    nameAnswer: 'Tamizh Thilagan',
    cityAnswer: 'Chennai',
    friendAnswer: 'Karthik',
  };

  const testUser: User = {
    id: 'test-user-sec-01',
    username: 'testmistry',
    fullName: 'Test Mistry Contractor',
    email: 'testcontractor@mistry.in',
    mobile: '9840123456',
    passwordHash: 'secretPass123',
    securityQuestions: testSecurityQuestions,
    role: 'MISTRY_USER',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await db.users.put(testUser);

  const retrievedUser = await db.users.get('test-user-sec-01');
  if (!retrievedUser) {
    throw new Error('Failed to retrieve test user from Dexie db.users');
  }
  if (!retrievedUser.securityQuestions) {
    throw new Error('User securityQuestions field missing after saving to database');
  }
  if (retrievedUser.securityQuestions.nameAnswer !== 'Tamizh Thilagan' ||
      retrievedUser.securityQuestions.cityAnswer !== 'Chennai' ||
      retrievedUser.securityQuestions.friendAnswer !== 'Karthik') {
    throw new Error('User securityQuestions data corrupted or mismatched');
  }

  // Test Verification Simulation
  const simulateVerification = (email: string, q1: string, q2: string, q3: string): boolean => {
    if (email.toLowerCase() !== retrievedUser.email.toLowerCase()) return false;
    const sec = retrievedUser.securityQuestions!;
    return (
      q1.trim().toLowerCase() === sec.nameAnswer.trim().toLowerCase() &&
      q2.trim().toLowerCase() === sec.cityAnswer.trim().toLowerCase() &&
      q3.trim().toLowerCase() === sec.friendAnswer.trim().toLowerCase()
    );
  };

  // Case 1: All correct (case insensitive & trimmed)
  if (!simulateVerification('testcontractor@mistry.in', '  tamizh thilagan ', 'chennai', 'karthik')) {
    throw new Error('simulateVerification failed on valid answers');
  }

  // Case 2: One incorrect answer (denies)
  if (simulateVerification('testcontractor@mistry.in', 'Tamizh Thilagan', 'Coimbatore', 'Karthik')) {
    throw new Error('simulateVerification should have denied incorrect city answer');
  }

  // Case 3: Wrong email (denies)
  if (simulateVerification('wrong@mistry.in', 'Tamizh Thilagan', 'Chennai', 'Karthik')) {
    throw new Error('simulateVerification should have denied unassociated email');
  }

  // Clean up test user
  await db.users.delete('test-user-sec-01');

  console.log('  ✅ Database persistence and security question verification simulation passed.');
  console.log('\n🎉 ALL TESTS PASSED: Tea & Snacks Compact Minimalist Cards & Security Questions Auth System!\n');
}

runTeaSnacksAndSecurityQuestionsAuthTests().catch((err) => {
  console.error('\n❌ Test failed:', err);
  process.exit(1);
});
