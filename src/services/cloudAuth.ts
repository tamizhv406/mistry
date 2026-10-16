import type { AuthUser } from '@supabase/supabase-js';
import { db } from '../db/db';
import type { User, UserRole } from '../db/types';
import { supabase } from './supabase';

interface MemberProfile {
  user_id: string;
  email: string;
  username: string;
  full_name: string;
  mobile: string;
  role: 'USER' | 'SUB_ADMIN' | 'SUPER_ADMIN';
  is_active: boolean;
  permissions: Record<string, { read: boolean; write: boolean }>;
}

export class InactiveAccountError extends Error {}

function appRole(role: MemberProfile['role']): UserRole {
  if (role === 'SUPER_ADMIN' || role === 'SUB_ADMIN') return role;
  return 'MISTRY';
}

async function cacheAuthenticatedProfile(authUser: AuthUser, member: MemberProfile, remember: boolean): Promise<User> {
  const email = (authUser.email || member.email).toLowerCase();
  const local = await db.users.get(authUser.id);
  const profile: User = {
    id: authUser.id,
    username: member.username || String(authUser.user_metadata?.username || local?.username || email.split('@')[0]),
    fullName: member.full_name || String(authUser.user_metadata?.full_name || local?.fullName || ''),
    mobile: member.mobile || String(authUser.user_metadata?.mobile || local?.mobile || ''),
    phoneNormalized: local?.phoneNormalized,
    email,
    passwordHash: '',
    role: appRole(member.role),
    permissions: member.permissions || {},
    isActive: member.is_active,
    createdAt: local?.createdAt || authUser.created_at || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await db.users.put(profile);

  const { passwordHash: _passwordHash, ...safeProfile } = profile;
  try {
    localStorage.setItem('building_mistry_auth_user', JSON.stringify(safeProfile));
  } catch {
    // Supabase Auth remains the session authority if browser storage is unavailable.
  }
  if (!remember) {
    try {
      sessionStorage.setItem('building_mistry_auth_user', JSON.stringify(safeProfile));
      localStorage.removeItem('building_mistry_auth_user');
    } catch {
      // Supabase Auth remains the session authority if browser storage is unavailable.
    }
  }
  return profile;
}

export async function resolveAuthenticatedUser(authUser: AuthUser, remember = true): Promise<User> {
  if (!supabase) throw new Error('Supabase Auth is not configured.');
  try {
    const { data, error } = await supabase
      .from('mistry_members')
      .select('user_id,email,username,full_name,mobile,role,is_active,permissions')
      .eq('user_id', authUser.id)
      .single();
    if (!error && data) {
      const member = data as MemberProfile;
      if (!member.is_active) {
        await supabase.auth.signOut();
        throw new InactiveAccountError('This account is disabled. Contact the Super Admin.');
      }
      return cacheAuthenticatedProfile(authUser, member, remember);
    }
  } catch (err) {
    if (err instanceof InactiveAccountError) throw err;
  }

  // Graceful fallback for standard user if mistry_members table is not yet migrated:
  const fallbackMember: MemberProfile = {
    user_id: authUser.id,
    email: authUser.email || '',
    username: String(authUser.user_metadata?.username || authUser.email?.split('@')[0] || 'User'),
    full_name: String(authUser.user_metadata?.full_name || ''),
    mobile: String(authUser.user_metadata?.mobile || ''),
    role: 'USER',
    is_active: true,
    permissions: {},
  };
  return cacheAuthenticatedProfile(authUser, fallbackMember, remember);
}

export async function resolveOfflineWorkspaceUser(authUserId: string): Promise<User> {
  const cached = await db.users.get(authUserId);
  if (!cached) {
    throw new Error('This account has no previously verified local profile. Reconnect and sign in online first.');
  }
  return {
    ...cached,
    passwordHash: '',
    role: 'MISTRY',
    permissions: {},
    isActive: true,
    offlineLimited: true,
  };
}
