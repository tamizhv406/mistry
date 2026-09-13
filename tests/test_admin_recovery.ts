import 'fake-indexeddb/auto';
import { db } from '../src/db/db';
import {
  initAuth,
  loginUser,
  getCurrentUser,
  logoutUser,
  completeInitialPasswordSetup,
  changePassword,
  adminResetUserPassword,
  getAllUsers,
  toggleUserActive,
  createSubAdmin,
  isSuperAdmin,
  validatePasswordStrength,
  hashPassword,
} from '../src/services/auth';
import {
  isValidIndianPhone,
  normalizeIndianPhone,
  requestPasswordRecoveryOtp,
  verifyRecoveryOtp,
  resetPasswordWithToken,
} from '../src/services/otpService';
import type { User, Site } from '../src/db/types';

async function runAdminRecoveryTests() {
  console.log('🛡️ Starting Building Mistry Super Admin & Password Recovery Security Tests...\n');

  // -------------------------------------------------------------
  // Test 1: Super Admin & Demo User Initialization (Zero Plaintext Passwords)
  // -------------------------------------------------------------
  console.log('[Test 1] Testing Auth Initialization & Hash-backed bootstrap...');
  await initAuth();

  const superAdminInDb = await db.users.where('email').equalsIgnoreCase('tamilthilagan82@gmail.com').first();
  if (!superAdminInDb) throw new Error('Super Admin was not bootstrapped in database');
  if (superAdminInDb.role !== 'SUPER_ADMIN') throw new Error('Super Admin role must be SUPER_ADMIN');
  if (superAdminInDb.mustChangePassword !== true) throw new Error('Super Admin must be required to set initial password');
  if (superAdminInDb.passwordHash.length !== 64) throw new Error('Password hash must be 64 hex characters (SHA-256)');

  console.log(`✓ Super Admin bootstrapped securely: ${superAdminInDb.fullName} (${superAdminInDb.email})`);
  console.log(`  - Role: ${superAdminInDb.role}`);
  console.log(`  - Password Hash: ${superAdminInDb.passwordHash.slice(0, 16)}... (Never Plaintext)`);
  console.log(`  - mustChangePassword: ${superAdminInDb.mustChangePassword}`);

  // -------------------------------------------------------------
  // Test 2: Login & Storage Security (Never store password in localStorage)
  // -------------------------------------------------------------
  console.log('\n[Test 2] Testing Login & Storage Security...');
  const loginRes = await loginUser('tamil406', 'tamil406@##');
  if (!loginRes.success || !loginRes.user) throw new Error('Super admin login failed');

  const currentSessionUser = getCurrentUser();
  if (!currentSessionUser) throw new Error('Current user session not found');
  if ((currentSessionUser as any).passwordHash) {
    throw new Error('SECURITY VIOLATION: passwordHash leaked into session storage!');
  }
  if (currentSessionUser.mustChangePassword !== true) {
    throw new Error('mustChangePassword flag not preserved in session');
  }
  console.log('✓ Super Admin logged in successfully.');
  console.log('✓ Verified: passwordHash is STRICTLY EXCLUDED from localStorage/session storage.');

  // -------------------------------------------------------------
  // Test 3: Mandatory First-Login Password Change
  // -------------------------------------------------------------
  console.log('\n[Test 3] Testing Mandatory Initial Password Setup...');
  const weakChange = await completeInitialPasswordSetup(loginRes.user.id, 'short', 'short');
  if (weakChange.success) throw new Error('Weak password should have been rejected');

  const strongChange = await completeInitialPasswordSetup(loginRes.user.id, 'TamilAdmin@2026', 'TamilAdmin@2026');
  if (!strongChange.success) throw new Error('Valid initial password setup failed: ' + strongChange.error);

  const updatedAdmin = await db.users.get(loginRes.user.id);
  if (updatedAdmin?.mustChangePassword !== false) {
    throw new Error('mustChangePassword must be false after initial setup');
  }

  // Verify can now login with new password
  await logoutUser();
  const reloginNew = await loginUser('tamil406', 'TamilAdmin@2026');
  if (!reloginNew.success) throw new Error('Failed to login with newly set private admin password');
  const reloginOld = await loginUser('tamil406', 'tamil406@##');
  if (reloginOld.success) throw new Error('Old bootstrap password must not work after password change');
  console.log('✓ Initial password changed securely. Old bootstrap password invalidated.');

  // -------------------------------------------------------------
  // Test 4: Indian Mobile Number Formatting & Validation
  // -------------------------------------------------------------
  console.log('\n[Test 4] Testing Indian Mobile Number Validation & Normalization...');
  if (!isValidIndianPhone('98401 23456')) throw new Error('Failed to validate spaced mobile');
  if (!isValidIndianPhone('+91 98401-23456')) throw new Error('Failed to validate +91 mobile');
  if (!isValidIndianPhone('09840123456')) throw new Error('Failed to validate 0-prefixed mobile');
  if (isValidIndianPhone('1234567890')) throw new Error('Invalid Indian mobile should start with 6, 7, 8, or 9');
  if (isValidIndianPhone('98401')) throw new Error('Short phone should fail');

  const normalized = normalizeIndianPhone('+91 98401-23456');
  if (normalized !== '9840123456') throw new Error(`Normalization error: expected 9840123456, got ${normalized}`);
  console.log('✓ Validated and normalized Indian numbers correctly (all formats map to 10 digits).');

  // -------------------------------------------------------------
  // Test 5: Forgot Password OTP Flow with Privacy-Preserving Generic Messages
  // -------------------------------------------------------------
  console.log('\n[Test 5] Testing Forgot Password OTP & Privacy Rules...');
  
  // Register a test contractor
  const testContractorMobile = '9840199999';
  const testContractor: User = {
    id: `user-contractor-${Date.now()}`,
    username: 'selvam_builder',
    fullName: 'Selvam Builders',
    mobile: testContractorMobile,
    phoneNormalized: normalizeIndianPhone(testContractorMobile),
    email: 'selvam@mistry.com',
    passwordHash: await hashPassword('OldPass@1234'),
    role: 'MISTRY',
    isActive: true,
    createdAt: new Date().toISOString(),
  };
  await db.users.put(testContractor);

  // Request OTP for non-existent number -> MUST return generic success
  const nonExistentOtpRes = await requestPasswordRecoveryOtp('9876543210');
  if (!nonExistentOtpRes.success || !nonExistentOtpRes.message.includes('If an account exists')) {
    throw new Error('Privacy violation: revealed that number is not registered!');
  }
  console.log('✓ Privacy rule verified: Non-registered number receives identical generic message.');

  // Request OTP for registered contractor
  const contractorOtpRes = await requestPasswordRecoveryOtp(testContractorMobile);
  if (!contractorOtpRes.success) throw new Error('Failed to request OTP for registered user: ' + contractorOtpRes.error);

  // Rate Limiting Check: Immediate second request must be rejected
  const rapidOtpRes = await requestPasswordRecoveryOtp(testContractorMobile);
  if (rapidOtpRes.success) throw new Error('Rate limit failed: Rapid OTP request should be cooled down');
  console.log(`✓ Rate limiting verified: Rapid OTP request cooled down (${rapidOtpRes.cooldownSeconds}s wait).`);

  // Verify OTP record in DB is securely salted & hashed (NEVER plaintext)
  const sessionInDb = await db.otpSessions.where('phoneNormalized').equals('9840199999').last();
  if (!sessionInDb) throw new Error('OTP session not found in database');
  if (sessionInDb.hashedOtp.length !== 64) throw new Error('OTP in database must be a 64-char SHA-256 hash');
  if (!sessionInDb.salt) throw new Error('OTP must be salted');
  console.log('✓ OTP stored with cryptographic salt + SHA-256 hash (never plaintext in database).');

  // Test Verification: Invalid OTP must fail
  const badVerify = await verifyRecoveryOtp(testContractorMobile, '000000');
  if (badVerify.success) throw new Error('Bad OTP should fail');
  console.log('✓ Incorrect OTP rejected.');

  // Let's test a brute force lockout check (max attempts)
  for (let i = 0; i < 3; i++) {
    await verifyRecoveryOtp(testContractorMobile, `11111${i}`);
  }
  const lockedVerify = await verifyRecoveryOtp(testContractorMobile, '999999');
  const errLower = (lockedVerify.error || '').toLowerCase();
  if (!errLower.includes('locked') && !errLower.includes('too many') && !errLower.includes('maximum') && !errLower.includes('attempts')) {
    throw new Error('Lockout mechanism failed after max invalid attempts: ' + lockedVerify.error);
  }
  console.log('✓ OTP session lockout verified after max invalid attempts.');

  // Create fresh session for successful reset token test
  const freshSessionId = `otp-test-${Date.now()}`;
  const validToken = `test-reset-token-${Date.now()}`;
  await db.otpSessions.put({
    id: freshSessionId,
    phoneNormalized: '9840199999',
    hashedOtp: 'test_hash',
    salt: 'test_salt',
    token: validToken,
    expiresAt: Date.now() + 15 * 60 * 1000,
    attempts: 0,
    verified: true,
    createdAt: new Date().toISOString(),
  });

  // Reset password using token
  const weakPasswordReset = await resetPasswordWithToken(testContractorMobile, validToken, 'weak', 'weak');
  if (weakPasswordReset.success) throw new Error('Weak password should be rejected during reset');

  const successfulReset = await resetPasswordWithToken(testContractorMobile, validToken, 'NewSecurePass@2026', 'NewSecurePass@2026');
  if (!successfulReset.success) throw new Error('Password reset failed: ' + successfulReset.error);

  // Single-use token check: Reusing token must fail
  const reuseToken = await resetPasswordWithToken(testContractorMobile, validToken, 'AnotherPass@2026', 'AnotherPass@2026');
  if (reuseToken.success) throw new Error('Single-use token reuse must be rejected');
  console.log('✓ Single-use token enforcement verified: Token cannot be reused.');

  // Verify contractor can now login with new password
  const contractorLogin = await loginUser('selvam_builder', 'NewSecurePass@2026');
  if (!contractorLogin.success) throw new Error('Contractor failed to login with new password');
  console.log('✓ Contractor logged in with newly recovered password.');

  // -------------------------------------------------------------
  // Test 6: Super Admin User Governance & Reset Assist
  // -------------------------------------------------------------
  console.log('\n[Test 6] Testing Super Admin User Governance & Reset Assist...');
  const superAdminUser = (await db.users.where('role').equals('SUPER_ADMIN').first())!;
  const allUsersList = await getAllUsers(superAdminUser);
  if (allUsersList.length < 2) throw new Error('User listing incomplete');

  // Verify never displaying password
  allUsersList.forEach(u => {
    if ((u as any).passwordHash) throw new Error(`Password hash leaked in user list for ${u.username}`);
    if (typeof u.sitesCount !== 'number') throw new Error(`sitesCount missing for ${u.username}`);
    if (typeof u.totalExpenses !== 'number') throw new Error(`totalExpenses missing for ${u.username}`);
  });
  console.log(`✓ Super Admin fetched ${allUsersList.length} users with computed site counts and project expenses.`);

  // Super Admin Password Reset Assist
  const assistRes = await adminResetUserPassword(superAdminUser, testContractor.id, 'TempMistry@8899');
  if (!assistRes.success) throw new Error('Reset assist failed: ' + assistRes.error);

  const assistedUser = await db.users.get(testContractor.id);
  if (assistedUser?.mustChangePassword !== true) {
    throw new Error('Reset assist must set mustChangePassword to true');
  }
  console.log('✓ Password reset assist verified: Temporary password assigned and mustChangePassword set.');

  // -------------------------------------------------------------
  // Test 7: Multi-Tenant Database Row Level Security (RLS)
  // -------------------------------------------------------------
  console.log('\n[Test 7] Testing Multi-Tenant Row Level Security (RLS)...');
  
  // Contractor A creates a site
  const contractorASite: Site = {
    id: `site-contractor-a-${Date.now()}`,
    userId: testContractor.id,
    name: 'Selvam Luxury Villa',
    ownerName: 'Mr. Raman',
    ownerPhone: '9840111222',
    address: '12 Anna Nagar',
    area: 'Anna Nagar, Chennai',
    buildingType: 'Individual Villa',
    startDate: '2026-09-01',
    expectedCompletionDate: '2027-06-01',
    status: 'Active',
    isDeleted: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await db.sites.put(contractorASite);

  // Contractor B user
  const contractorB: User = {
    id: `user-contractor-b-${Date.now()}`,
    username: 'muthu_contractor',
    fullName: 'Muthu Contractors',
    mobile: '9840133445',
    phoneNormalized: '9840133445',
    email: 'muthu@mistry.com',
    passwordHash: await hashPassword('Muthu@12345'),
    role: 'MISTRY',
    isActive: true,
    createdAt: new Date().toISOString(),
  };
  await db.users.put(contractorB);

  // Contractor B queries sites: MUST NOT see Contractor A's site
  const contractorBSites = await db.getSitesForUser(contractorB);
  if (contractorBSites.some(s => s.id === contractorASite.id)) {
    throw new Error('RLS VIOLATION: Contractor B can see Contractor A’s private site!');
  }
  console.log('✓ RLS Data Isolation: Contractor B cannot view Contractor A’s site.');

  // Contractor B attempts to delete Contractor A's site -> MUST FAIL
  let crossDeleteFailed = false;
  try {
    await db.softDeleteForUser(contractorB, 'sites', contractorASite.id, contractorASite.name);
  } catch (err: any) {
    crossDeleteFailed = true;
    console.log(`✓ RLS Mutation Guard: Contractor B delete blocked (${err.message}).`);
  }
  if (!crossDeleteFailed) throw new Error('RLS VIOLATION: Contractor B was allowed to mutate Contractor A’s site!');

  // Super Admin queries sites: CAN see all sites
  const superAdminSites = await db.getSitesForUser(superAdminUser);
  if (!superAdminSites.some(s => s.id === contractorASite.id)) {
    throw new Error('Super Admin must have global visibility of all sites');
  }
  console.log('✓ Super Admin Global Visibility: Super Admin can supervise all construction sites.');

  // -------------------------------------------------------------
  // Test 8: Security Audit Logging Verification
  // -------------------------------------------------------------
  console.log('\n[Test 8] Testing Security Audit Log Trail...');
  const auditLogs = await db.getAllAdminAuditLogs(superAdminUser);
  if (auditLogs.length === 0) throw new Error('Audit logs are empty');

  const actionsRecorded = new Set(auditLogs.map(l => l.action));
  console.log(`✓ Total security audit events recorded: ${auditLogs.length}`);
  console.log(`  - Actions captured: ${Array.from(actionsRecorded).join(', ')}`);

  console.log('\n🎉 ALL SUPER ADMIN & PASSWORD RECOVERY TESTS PASSED SUCCESSFULLY!\n');
}

runAdminRecoveryTests().catch(err => {
  console.error('\n❌ TEST SUITE FAILED:', err);
  process.exit(1);
});
