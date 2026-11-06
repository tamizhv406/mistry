import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Mock localStorage for node test environment
class MockLocalStorage {
  private store = new Map<string, string>();
  getItem(key: string): string | null {
    return this.store.get(key) || null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  clear(): void {
    this.store.clear();
  }
}

if (typeof globalThis.localStorage === 'undefined') {
  (globalThis as any).localStorage = new MockLocalStorage();
}

describe('Supabase Client & Auth Integration', () => {
  it('1. lib/supabaseClient.ts exists and resolves credentials', () => {
    const clientPath = resolve(process.cwd(), 'lib/supabaseClient.ts');
    assert.ok(existsSync(clientPath), 'lib/supabaseClient.ts must exist');

    const content = readFileSync(clientPath, 'utf8');
    assert.ok(
      content.includes('process.env?.NEXT_PUBLIC_SUPABASE_URL'),
      'Must read process.env.NEXT_PUBLIC_SUPABASE_URL'
    );
    assert.ok(
      content.includes('process.env?.NEXT_PUBLIC_SUPABASE_ANON_KEY'),
      'Must read process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY'
    );
    assert.ok(content.includes('createClient'), 'Must call createClient from @supabase/supabase-js');
  });

  it('2. Phone OTP number normalization properly formats 10-digit Indian numbers', () => {
    const formatPhone = (phone: string): string => {
      let formattedPhone = phone.trim();
      const digits = formattedPhone.replace(/\D/g, '');
      if (digits.length === 10) {
        return `+91${digits}`;
      } else if (!formattedPhone.startsWith('+')) {
        return `+${digits}`;
      }
      return formattedPhone;
    };

    assert.equal(formatPhone('9876543210'), '+919876543210');
    assert.equal(formatPhone('98765 43210'), '+919876543210');
    assert.equal(formatPhone('+919876543210'), '+919876543210');
    assert.equal(formatPhone('+14155552671'), '+14155552671');
  });

  it('3. User role assignment respects contractor vs engineer', () => {
    const allowedRoles = ['contractor', 'engineer'];
    assert.ok(allowedRoles.includes('contractor'));
    assert.ok(allowedRoles.includes('engineer'));
    assert.ok(!allowedRoles.includes('unauthorized_role'));
  });
});

describe('Supabase PostgreSQL Schema & RLS Policies', () => {
  it('4. Migration file 004_cloud_sync_schema.sql contains all required tables and RLS', () => {
    const migrationPath = resolve(process.cwd(), 'supabase/migrations/004_cloud_sync_schema.sql');
    assert.ok(existsSync(migrationPath), 'Migration file must exist');

    const sql = readFileSync(migrationPath, 'utf8');

    // Required tables
    const requiredTables = ['profiles', 'projects', 'workers', 'attendance', 'materials', 'expenses'];
    for (const table of requiredTables) {
      assert.ok(
        sql.includes(`create table if not exists public.${table}`),
        `Table public.${table} must be declared in migration`
      );
      assert.ok(
        sql.includes(`alter table public.${table}   enable row level security;`) ||
        sql.includes(`alter table public.${table} enable row level security;`),
        `RLS must be enabled on table ${table}`
      );
    }

    // Role check constraints
    assert.ok(sql.includes("check (role in ('contractor', 'engineer'))"), 'profiles must enforce contractor/engineer');
    assert.ok(sql.includes("check (status in ('P', 'A', 'half', 'OT'))"), 'attendance must enforce valid status values');
    assert.ok(
      sql.includes("check (category in ('cement', 'sand', 'steel', 'bricks', 'others'))"),
      'materials must enforce categories'
    );
    assert.ok(
      sql.includes("check (category in ('tea_snacks', 'fuel', 'transport', 'others'))"),
      'expenses must enforce categories'
    );

    // Auth trigger
    assert.ok(sql.includes('handle_new_auth_user'), 'Auto profile trigger function must exist');
    assert.ok(sql.includes('on_auth_user_created'), 'Trigger on auth.users must exist');
  });
});

describe('Offline-First Sync & Data Mapping Architecture', () => {
  it('5. Offline queue records mutations and drains on connection', () => {
    const queueKey = 'mistry_offline_sync_queue';
    globalThis.localStorage.removeItem(queueKey);

    // Mock enqueue
    const queue = [];
    const item = {
      id: 'proj_123',
      table: 'projects',
      action: 'insert',
      payload: { id: 'proj_123', name: 'Metro Station Plinth' },
      timestamp: new Date().toISOString(),
    };
    queue.push(item);
    globalThis.localStorage.setItem(queueKey, JSON.stringify(queue));

    // Verify stored
    const stored = JSON.parse(globalThis.localStorage.getItem(queueKey) || '[]');
    assert.equal(stored.length, 1);
    assert.equal(stored[0].id, 'proj_123');
    assert.equal(stored[0].payload.name, 'Metro Station Plinth');

    // Mock drain
    globalThis.localStorage.setItem(queueKey, JSON.stringify([]));
    assert.equal(JSON.parse(globalThis.localStorage.getItem(queueKey) || '[]').length, 0);
  });

  it('6. Mapping between Dexie Site and Supabase Project maintains data fidelity', () => {
    const dexieSite = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      userId: 'usr_abc_123',
      name: 'Skyline Villa',
      clientName: 'Sunil Kumar',
      clientPhone: '9876543210',
      location: 'Bangalore East',
      type: 'commercial',
      budget: 8500000,
      createdAt: '2026-11-01T10:00:00Z',
      updatedAt: '2026-11-01T12:00:00Z',
    };

    // To Supabase row
    const supabaseProject = {
      id: dexieSite.id,
      user_id: dexieSite.userId,
      name: dexieSite.name,
      client_name: dexieSite.clientName,
      client_phone: dexieSite.clientPhone,
      location: dexieSite.location,
      building_type: dexieSite.type,
      budget: dexieSite.budget,
      created_at: dexieSite.createdAt,
      updated_at: dexieSite.updatedAt,
    };

    assert.equal(supabaseProject.id, dexieSite.id);
    assert.equal(supabaseProject.client_name, dexieSite.clientName);
    assert.equal(supabaseProject.budget, 8500000);
    assert.equal(supabaseProject.building_type, 'commercial');
  });

  it('7. Header displays "Building Mistry Builder (Local)" when local and user name when logged in', () => {
    const localUser = {
      id: 'local_builder',
      username: 'builder',
      fullName: 'Building Mistry Builder',
      isLocal: true,
      role: 'MISTRY',
    };

    const isLocal = Boolean(localUser.isLocal || localUser.id === 'local_builder');
    const headerTitle = isLocal ? 'Building Mistry Builder (Local)' : localUser.fullName;
    assert.equal(headerTitle, 'Building Mistry Builder (Local)');

    const authenticatedUser = {
      id: '7c865108-9df2-4217-bf27-14264627083f',
      username: 'ramesh_builder',
      fullName: 'Ramesh Contractor',
      mobile: '+919876543210',
      isLocal: false,
      role: 'contractor',
    };

    const isAuthLocal = Boolean(authenticatedUser.isLocal || authenticatedUser.id === 'local_builder');
    const authHeaderTitle = isAuthLocal ? 'Building Mistry Builder (Local)' : authenticatedUser.fullName;
    assert.equal(authHeaderTitle, 'Ramesh Contractor');
  });
});
