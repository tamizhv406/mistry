import { db } from '../db/db';
import type { User, UserRole } from '../db/types';
import { normalizeIndianPhone, validatePasswordStrength } from './otpService';
import { isSupabaseConfigured, supabase } from './supabase';
import { InactiveAccountError, resolveAuthenticatedUser, resolveOfflineWorkspaceUser } from './cloudAuth';
import { getAuthorizedRecords, getMemberProfiles } from './adminData';

const SESSION_KEY = 'building_mistry_auth_user';

export function demoAccountsEnabled(): boolean {
  return false;
}

export function isSuperAdmin(user?: User | null): boolean {
  return user?.role === 'SUPER_ADMIN';
}

export function isAdmin(user?: User | null): boolean {
  return user?.role === 'SUPER_ADMIN' || user?.role === 'SUB_ADMIN';
}

export async function initDefaultUser(): Promise<void> {
  if (!supabase) {
    setCurrentUser(null);
    return;
  }
  const { data, error } = await supabase.auth.getSession();
  if (error) throw new Error(`Could not read the Supabase session: ${error.message}`);
  if (!data.session?.user) {
    setCurrentUser(null);
    return;
  }
  let user: User;
  try {
    user = await resolveAuthenticatedUser(data.session.user);
  } catch (error) {
    if (error instanceof InactiveAccountError) throw error;
    user = await resolveOfflineWorkspaceUser(data.session.user.id);
  }
  setCurrentUser(user);
}

export const initAuth = initDefaultUser;

/**
 * Authenticates user credentials
 */
export async function loginUser(
  identifier: string,
  password: string,
  remember: boolean = true
): Promise<{ success: boolean; user?: User; error?: string }> {
  if (!supabase || !isSupabaseConfigured()) {
    return { success: false, error: 'Secure sign-in is unavailable until Supabase is configured.' };
  }
  const trimmedId = identifier.trim().toLowerCase();
  const localProfile = await db.users
    .filter(user =>
      user.username.toLowerCase() === trimmedId ||
      user.email.toLowerCase() === trimmedId ||
      user.mobile.replace(/[\s\-\(\)]/g, '') === trimmedId.replace(/[\s\-\(\)]/g, '') ||
      user.phoneNormalized === normalizeIndianPhone(identifier)
    )
    .first();
  const email = trimmedId.includes('@') ? trimmedId : localProfile?.email.toLowerCase();
  if (!email) {
    return { success: false, error: 'Enter the email address for your secure account.' };
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) return { success: false, error: error?.message || 'Sign-in failed.' };
  try {
    const user = await resolveAuthenticatedUser(data.user, remember);
    setCurrentUser(user, remember);
    return { success: true, user };
  } catch (profileError) {
    await supabase.auth.signOut();
    return { success: false, error: (profileError as Error).message };
  }
}

/** Demo accounts are not available in any build. */
export async function loginDemoContractor(): Promise<{ success: boolean; user?: User; error?: string }> {
  return { success: false, error: 'Demo accounts are disabled. Sign in with your secure account.' };
}

/**
 * Registers new user
 */
export async function registerUser(
  username: string,
  fullName: string,
  mobile: string,
  email: string,
  password: string
): Promise<{ success: boolean; user?: User; error?: string; needsConfirmation?: boolean }> {
  const trimmedUser = username.trim().toLowerCase();
  const trimmedEmail = email.trim().toLowerCase();

  if (!trimmedUser || trimmedUser.length < 3) {
    return { success: false, error: 'Username must be at least 3 characters.' };
  }

  const strength = validatePasswordStrength(password);
  if (!strength.valid) {
    return { success: false, error: strength.error };
  }
  if (!trimmedEmail || !trimmedEmail.includes('@')) {
    return { success: false, error: 'Enter a valid email address for your secure account.' };
  }

  if (!supabase || !isSupabaseConfigured()) {
    return { success: false, error: 'Secure registration is unavailable until Supabase is configured.' };
  }
  const { data, error } = await supabase.auth.signUp({
    email: trimmedEmail,
    password,
    options: {
      data: { username: trimmedUser, full_name: fullName.trim() || username.trim(), mobile: mobile.trim() },
    },
  });
  if (error) return { success: false, error: error.message };
  if (!data.user) return { success: false, error: 'Registration did not return an account.' };
  if (!data.session) {
    return { success: false, error: 'Check your email to confirm the account, then sign in.', needsConfirmation: true } as {
      success: boolean; user?: User; error?: string; needsConfirmation?: boolean;
    };
  }
  const user = await resolveAuthenticatedUser(data.user);
  setCurrentUser(user);
  return { success: true, user };
}

/**
 * Changes a user's password (verifying current password)
 */
export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
  confirmPassword: string
): Promise<{ success: boolean; error?: string }> {
  if (newPassword !== confirmPassword) {
    return { success: false, error: 'New password and confirmation do not match.' };
  }

  const strength = validatePasswordStrength(newPassword);
  if (!strength.valid) {
    return { success: false, error: strength.error };
  }

  const user = getCurrentUser();
  if (!user || user.id !== userId || !supabase) return { success: false, error: 'Sign in to the account before changing its password.' };
  if (!currentPassword) return { success: false, error: 'Enter your current password.' };
  const { data: reauthenticated, error: reauthError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });
  if (reauthError || reauthenticated.user?.id !== userId) {
    return { success: false, error: reauthError?.message || 'Current password could not be verified.' };
  }
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  return error ? { success: false, error: error.message } : { success: true };
}

/**
 * Sets initial password on first login
 */
export async function completeInitialPasswordSetup(
  userId: string,
  newPassword: string,
  confirmPassword: string
): Promise<{ success: boolean; error?: string }> {
  if (newPassword !== confirmPassword) {
    return { success: false, error: 'Passwords do not match.' };
  }

  const strength = validatePasswordStrength(newPassword);
  if (!strength.valid) {
    return { success: false, error: strength.error };
  }

  const user = getCurrentUser();
  if (!user || user.id !== userId || !supabase) return { success: false, error: 'Sign in to the account before changing its password.' };
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  return error ? { success: false, error: error.message } : { success: true };
}

/**
 * Super Admin resets user password and requires change on next login
 */
export async function adminResetUserPassword(
  adminUser: User,
  targetUserId: string
): Promise<{ success: boolean; error?: string }> {
  if (!isSuperAdmin(adminUser) || !supabase) {
    return { success: false, error: 'Only the Super Admin can send account recovery links.' };
  }
  const { data, error } = await supabase.functions.invoke('mistry-admin', {
    body: { action: 'send_password_recovery', targetUserId },
  });
  if (error) return { success: false, error: error.message };
  if (data?.error) return { success: false, error: String(data.error) };
  return { success: true };
}

export async function createSubAdmin(
  creatorUser: User,
  data: {
    username: string;
    fullName: string;
    mobile: string;
    email: string;
    permissions?: Record<string, { read: boolean; write: boolean }>;
  }
): Promise<{ success: boolean; user?: User; error?: string }> {
  void creatorUser;
  if (!isSuperAdmin(creatorUser) || !supabase) return { success: false, error: 'Only the Super Admin can invite Sub-admins.' };
  if (!data.email.trim() || !data.email.includes('@')) return { success: false, error: 'Enter a valid email address.' };
  const { data: invited, error } = await supabase.functions.invoke('mistry-admin', {
    body: {
      action: 'invite_sub_admin',
      email: data.email.trim().toLowerCase(),
      fullName: data.fullName.trim(),
      username: data.username.trim().toLowerCase(),
      mobile: data.mobile.trim(),
      permissions: data.permissions || {},
    },
  });
  if (error) return { success: false, error: error.message };
  if (!invited?.userId) return { success: false, error: 'The invite service did not return an account id.' };
  return {
    success: true,
    user: {
      id: invited.userId, username: data.username.trim(), fullName: data.fullName.trim(),
      mobile: data.mobile.trim(), email: data.email.trim().toLowerCase(), passwordHash: '',
      role: 'SUB_ADMIN', isActive: true, createdAt: new Date().toISOString(),
    },
  };
}

export async function changeUserRole(
  actorUser: User,
  targetUserId: string,
  newRole: UserRole,
  permissions?: Record<string, { read: boolean; write: boolean }>
): Promise<{ success: boolean; error?: string }> {
  if (!isSuperAdmin(actorUser)) {
    return { success: false, error: 'Only the Super Admin can change account roles.' };
  }

  if (!supabase) return { success: false, error: 'Supabase Auth is not configured.' };
  const { data: member, error: lookupError } = await supabase
    .from('mistry_members').select('role,is_active,permissions').eq('user_id', targetUserId).single();
  if (lookupError || !member) return { success: false, error: lookupError?.message || 'Account not found.' };
  const role = newRole === 'SUB_ADMIN' ? 'SUB_ADMIN' : 'USER';
  const { error } = await supabase.rpc('mistry_set_member_access', {
    target_user_id: targetUserId,
    target_role: role,
    target_active: member.is_active,
    target_permissions: permissions || member.permissions,
  });
  return error ? { success: false, error: error.message } : { success: true };
}

let memorySession: string | null = null;

export function getCurrentUser(): User | null {
  try {
    if (typeof localStorage === 'undefined' && typeof sessionStorage === 'undefined') {
      return memorySession ? (JSON.parse(memorySession) as User) : null;
    }
    const raw =
      (typeof localStorage !== 'undefined' ? localStorage.getItem(SESSION_KEY) : null) ||
      (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(SESSION_KEY) : null) ||
      memorySession;
    if (!raw) return null;
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

/**
 * Saves current user session (STRICTLY stripping passwordHash from storage)
 */
export function setCurrentUser(user: User | null, remember: boolean = true): void {
  try {
    if (!user) {
      memorySession = null;
      if (typeof localStorage !== 'undefined') localStorage.removeItem(SESSION_KEY);
      if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(SESSION_KEY);
      return;
    }

    // Security Rule: NEVER expose passwordHash in localStorage
    const { passwordHash: _, ...safeUser } = user;
    const serialized = JSON.stringify(safeUser);
    memorySession = serialized;

    if (remember && typeof localStorage !== 'undefined') {
      localStorage.setItem(SESSION_KEY, serialized);
    } else if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(SESSION_KEY, serialized);
    }
  } catch {
    // Ignore storage quota errors
  }
}

export async function logoutUser(): Promise<void> {
  if (supabase) {
    const { error } = await supabase.auth.signOut();
    if (error) throw new Error(`Could not sign out of Supabase Auth: ${error.message}`);
  }
  setCurrentUser(null);
}

export interface AdminUserListItem extends Omit<User, 'passwordHash'> {
  sitesCount: number;
  totalExpenses: number;
  permissions: Record<string, { read: boolean; write: boolean }>;
}

/**
 * Returns users with calculated site counts and project expenses
 * (Password hash is strictly omitted)
 */
export async function getAllUsers(adminUser: User): Promise<AdminUserListItem[]> {
  if (!isAdmin(adminUser) || !supabase) {
    throw new Error('Unauthorized: Only administrators can view user records.');
  }
  const [members, records] = await Promise.all([getMemberProfiles(), getAuthorizedRecords()]);
  return members.map(member => {
    const sites = records.filter(record =>
      record.owner_id === member.user_id && record.table_name === 'sites' && !record.data.isDeleted
    );
    const siteIds = new Set(sites.map(site => site.record_id));
    const expenseFields: Record<string, string> = {
      materials: 'totalAmount',
      salaryPayments: 'paidAmount',
      tools: 'cost',
      otherExpenses: 'amount',
      electricityBills: 'billAmount',
      waterBills: 'billAmount',
      teaSnacksExpenses: 'totalAmount',
      poojaExpenses: 'totalAmount',
    };
    const totalExpenses = records.reduce((sum, record) => {
      const field = expenseFields[record.table_name];
      if (!field || record.owner_id !== member.user_id || !siteIds.has(record.site_id || '') || record.data.isDeleted) {
        return sum;
      }
      const amount = Number(record.data[field]);
      return sum + (Number.isFinite(amount) ? amount : 0);
    }, 0);
    return {
      id: member.user_id,
      username: member.username || member.email.split('@')[0],
      fullName: member.full_name || member.email,
      mobile: member.mobile || '',
      email: member.email,
      role: member.role === 'SUPER_ADMIN' || member.role === 'SUB_ADMIN' ? member.role : 'MISTRY',
      isActive: member.is_active,
      createdAt: member.created_at,
      updatedAt: member.created_at,
      sitesCount: sites.length,
      totalExpenses,
      permissions: member.permissions || {},
    };
  });
}

export async function toggleUserActive(
  adminUser: User,
  targetUserId: string,
  isActive: boolean
): Promise<{ success: boolean; error?: string }> {
  if (!isSuperAdmin(adminUser) || !supabase) {
    return { success: false, error: 'Only the Super Admin can change account status.' };
  }
  const { data: member, error: lookupError } = await supabase
    .from('mistry_members').select('role,permissions').eq('user_id', targetUserId).single();
  if (lookupError || !member) return { success: false, error: lookupError?.message || 'Account not found.' };
  const { error } = await supabase.rpc('mistry_set_member_access', {
    target_user_id: targetUserId,
    target_role: member.role,
    target_active: isActive,
    target_permissions: member.permissions,
  });
  return error ? { success: false, error: error.message } : { success: true };
}
