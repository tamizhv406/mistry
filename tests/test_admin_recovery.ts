import 'fake-indexeddb/auto';
import { readFile } from 'node:fs/promises';
import { db } from '../src/db/db';
import {
  completeInitialPasswordSetup,
  demoAccountsEnabled,
  loginDemoContractor,
  loginUser,
  registerUser,
  setCurrentUser,
} from '../src/services/auth';
import { isValidIndianPhone, normalizeIndianPhone, validatePasswordStrength } from '../src/services/otpService';
import { isSupabaseConfigured } from '../src/services/supabase';
import type { User } from '../src/db/types';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function runAdminRecoveryTests(): Promise<void> {
  console.log('Starting Supabase account and authorization contract tests...\n');

  assert(!demoAccountsEnabled(), 'Local demo accounts must stay disabled.');
  const demoLogin = await loginDemoContractor();
  assert(!demoLogin.success, 'Demo login must not authenticate a local account.');
  assert(isValidIndianPhone('+91 98401-23456'), 'Valid Indian phone number should be accepted.');
  assert(normalizeIndianPhone('+91 98401-23456') === '9840123456', 'Phone number normalization should remove the country prefix.');
  assert(!validatePasswordStrength('12345678').valid, 'A weak password must be rejected before Supabase Auth.');

  const testUser: User = {
    id: 'auth-test-user',
    username: 'auth_test_user',
    fullName: 'Auth Test User',
    mobile: '9840012345',
    email: 'auth-test@example.test',
    passwordHash: '',
    role: 'MISTRY',
    isActive: true,
    createdAt: new Date().toISOString(),
  };
  setCurrentUser(null);
  const passwordSetup = await completeInitialPasswordSetup(testUser.id, 'ValidPassword!2026', 'ValidPassword!2026');
  assert(!passwordSetup.success, 'Password setup must require the authenticated account session.');

  if (!isSupabaseConfigured()) {
    const login = await loginUser(testUser.email, 'ValidPassword!2026');
    assert(!login.success, 'Offline sign-in must fail closed.');

    const usersBefore = await db.users.count();
    const registration = await registerUser(
      testUser.username,
      testUser.fullName,
      testUser.mobile,
      testUser.email,
      'ValidPassword!2026'
    );
    assert(!registration.success, 'Offline registration must fail closed.');
    assert((await db.users.count()) === usersBefore, 'Offline registration must not create a local account.');
  } else {
    console.log('Skipped auth-network cases because Supabase is configured in this test environment.');
  }

  const migration = await readFile(
    new URL('../supabase/migrations/003_admin_auth_permissions.sql', import.meta.url),
    'utf8'
  );
  assert(/check\s*\(role in \('USER', 'SUB_ADMIN', 'SUPER_ADMIN'\)\)/i.test(migration), 'The database must constrain membership roles.');
  assert(/where user_id = actor_id and role = 'SUPER_ADMIN' and is_active/i.test(migration), 'Role changes must require an active Super Admin.');
  assert(/target_role not in \('USER', 'SUB_ADMIN'\)/i.test(migration), 'The role-management RPC must not grant Super Admin.');
  assert(/on conflict \(user_id\) do nothing/i.test(migration), 'Auth backfill must preserve existing membership rows.');
  assert(/mistry_can_access_record\(owner_id, table_name, 'read'\)/i.test(migration), 'Record reads must use server-side ownership and permission checks.');
  assert(/mistry_can_access_record\(owner_id, table_name, 'write'\)/i.test(migration), 'Record writes must use server-side ownership and permission checks.');
  for (const scope of ['projects', 'labour', 'payroll', 'materials', 'expenses', 'floor_plans', 'estimates']) {
    assert(migration.includes(`'${scope}'`), `The server permission model must include the ${scope} scope.`);
  }
  assert(/mistry_admin_audit/i.test(migration) && /MEMBER_ACCESS_UPDATED/i.test(migration), 'Elevated account changes must be audited.');
  assert(!/tamilthilagan|@buildingmistry\.com/i.test(migration), 'Role assignment must not rely on hardcoded identities.');
  assert(!/\b(drop table|truncate|delete from)\b/i.test(migration), 'The additive authorization migration must not delete existing records.');

  const cloudAuth = await readFile(new URL('../src/services/cloudAuth.ts', import.meta.url), 'utf8');
  assert(!/email\.toLowerCase\(\).*\.first\(\)|db\.users\.delete|table\.update\(row\.id/i.test(cloudAuth), 'Sign-in must not silently reassign local data by matching email.');
  assert(/permissions:\s*member\.permissions/.test(cloudAuth), 'Authenticated profiles must carry permissions from the server membership record.');
  assert(/role:\s*'MISTRY'/.test(cloudAuth) && /permissions:\s*\{\}/.test(cloudAuth) && /offlineLimited:\s*true/.test(cloudAuth), 'Offline workspace access must downgrade cached accounts to a non-privileged role.');
  const adminFunction = await readFile(new URL('../supabase/functions/mistry-admin/index.ts', import.meta.url), 'utf8');
  assert(/auth\.getUser\(token\)/i.test(adminFunction) && /member\?\.role !== 'SUPER_ADMIN'/i.test(adminFunction), 'Admin actions must verify the caller and active server role.');
  assert(/send_password_recovery/i.test(adminFunction) && /PASSWORD_RECOVERY_SENT/i.test(adminFunction), 'Admin password recovery must run on the server and be audited.');

  const rlsMigration = await readFile(
    new URL('../supabase/migrations/001_rls_policies.sql', import.meta.url),
    'utf8'
  );
  assert(!/tamilthilagan|email\s*=\s*'[^']+'/i.test(rlsMigration), 'Legacy RLS policies must not include an email-based admin shortcut.');

  console.log('✓ Demo and local-auth bypasses are disabled; offline access is cached, local-only, and non-elevated.');
  console.log('✓ Migration role, scope, audit, and preservation contracts are present.');
  console.log('✓ These are source-level checks only; they do not execute live PostgreSQL RLS policies.');
}

runAdminRecoveryTests().catch(error => {
  console.error('\nTEST SUITE FAILED:', error);
  process.exit(1);
});
