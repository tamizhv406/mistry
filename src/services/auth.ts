import { db } from '../db/db';
import type { User, UserRole } from '../db/types';
import { normalizeIndianPhone, validatePasswordStrength } from './otpService';

const SESSION_KEY = 'building_mistry_auth_user';

// Configurable initial admin settings (overridable via secure environment variables)
export const INITIAL_ADMIN_EMAIL = (
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_INITIAL_ADMIN_EMAIL) ||
  'tamilthilagan82@gmail.com'
).toLowerCase();

export const INITIAL_ADMIN_USERNAME = (
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_INITIAL_ADMIN_USERNAME) ||
  'tamilthilagan'
).toLowerCase();

// Precomputed one-way cryptographic SHA-256 hashes for initial bootstrapping
// (NEVER stores or exposes plaintext passwords in source code)
const BOOTSTRAP_ADMIN_HASH =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_INITIAL_ADMIN_HASH) ||
  '36cecdf471b373885a397270477a1fddb78792d58b1c34eecf648524cf44e26d';

const BOOTSTRAP_DEMO_HASH =
  '93f2452221b58a02a6f126c60c1527de0a956bfa5ea042396372b5c688bc9707';

/**
 * Deterministic SHA-256 password hashing via Web Crypto API
 */
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export function isSuperAdmin(user?: User | null): boolean {
  if (!user) return false;
  return (
    user.role === 'SUPER_ADMIN' ||
    (user.email || '').toLowerCase() === INITIAL_ADMIN_EMAIL
  );
}

export function isAdmin(user?: User | null): boolean {
  if (!user) return false;
  return (
    user.role === 'SUPER_ADMIN' ||
    user.role === 'SUB_ADMIN' ||
    user.role === 'ADMIN' ||
    (user.email || '').toLowerCase() === INITIAL_ADMIN_EMAIL
  );
}

/**
 * Initializes default accounts securely into IndexedDB
 * Passwords are NEVER written in plain text in source code.
 */
export async function initDefaultUser(): Promise<void> {
  // 1. Provision / Update SUPER ADMIN
  const existingRealAdmin = await db.users
    .filter(
      u =>
        u.email.toLowerCase() === INITIAL_ADMIN_EMAIL ||
        u.username.toLowerCase() === INITIAL_ADMIN_USERNAME
    )
    .first();

  if (!existingRealAdmin) {
    const realAdmin: User = {
      id: 'user-super-admin-tamil',
      username: INITIAL_ADMIN_USERNAME,
      fullName: 'Tamil Thilagan (Real Admin)',
      mobile: '98401 99887',
      phoneNormalized: '9840199887',
      email: INITIAL_ADMIN_EMAIL,
      passwordHash: BOOTSTRAP_ADMIN_HASH,
      role: 'SUPER_ADMIN',
      isActive: true,
      mustChangePassword: true,
      createdAt: '2026-01-01T00:00:00.000Z',
    };
    await db.users.put(realAdmin);
  } else {
    // Ensure email and role remain locked to SUPER_ADMIN without resetting the user's password
    await db.users.update(existingRealAdmin.id, {
      email: INITIAL_ADMIN_EMAIL,
      role: 'SUPER_ADMIN',
      isActive: true,
      phoneNormalized: normalizeIndianPhone(existingRealAdmin.mobile || '9840199887'),
      updatedAt: new Date().toISOString(),
    });
  }

  // 2. Default Mistry Velu account (Contractor demo profile)
  const mistryExists = await db.users.get('user-mistry-velu');
  if (!mistryExists) {
    const defaultMistry: User = {
      id: 'user-mistry-velu',
      username: 'mistry_velu',
      fullName: 'R. Velu (Head Mistry)',
      mobile: '98402 11223',
      phoneNormalized: '9840211223',
      email: 'velu@buildingmistry.com',
      passwordHash: BOOTSTRAP_DEMO_HASH,
      role: 'MISTRY',
      isActive: true,
      createdAt: '2026-01-01T00:00:00.000Z',
    };
    await db.users.put(defaultMistry);
  }

  // 3. Demo Admin Supervisor account (Supervisor testing & backward compatibility)
  const adminExists = await db.users.get('user-admin-default');
  if (!adminExists) {
    const defaultAdmin: User = {
      id: 'user-admin-default',
      username: 'admin',
      fullName: 'Site Supervisor (Demo)',
      mobile: '98401 00001',
      phoneNormalized: '9840100001',
      email: 'admin@buildingmistry.com',
      passwordHash: BOOTSTRAP_DEMO_HASH,
      role: 'ADMIN',
      isActive: true,
      createdAt: '2026-01-01T00:00:00.000Z',
    };
    await db.users.put(defaultAdmin);
  }
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
  await initDefaultUser();

  const trimmedId = identifier.trim().toLowerCase();
  const normalizedPhone = normalizeIndianPhone(identifier);
  const users = await db.users.toArray();

  const user = users.find(
    u =>
      u.username.toLowerCase() === trimmedId ||
      u.email.toLowerCase() === trimmedId ||
      u.mobile.replace(/[\s\-\(\)]/g, '') === trimmedId.replace(/[\s\-\(\)]/g, '') ||
      (trimmedId === 'tamil406' && u.email.toLowerCase() === INITIAL_ADMIN_EMAIL) ||
      (normalizedPhone && u.phoneNormalized === normalizedPhone)
  );

  if (!user) {
    return { success: false, error: 'User not found. Check username, email, or mobile number.' };
  }

  if (user.isActive === false) {
    return { success: false, error: 'Your account is deactivated. Please contact administrator.' };
  }

  const inputHash = await hashPassword(password);
  if (user.passwordHash !== inputHash) {
    return { success: false, error: 'Incorrect password. Please try again.' };
  }

  // Update lastLogin timestamp
  const now = new Date().toISOString();
  await db.users.update(user.id, {
    lastLoginAt: now,
    updatedAt: now,
  });
  user.lastLoginAt = now;

  // Save session (stripping passwordHash to guarantee zero storage exposure)
  setCurrentUser(user, remember);

  // Security audit log (NEVER logs passwords)
  await db.logSecurityAudit(
    'USER_LOGIN',
    user,
    user.id,
    'users',
    'SUCCESS',
    `${user.fullName} (${user.role}) logged in`
  );

  return { success: true, user };
}

/**
 * Registers new user
 */
export async function registerUser(
  username: string,
  fullName: string,
  mobile: string,
  email: string,
  password: string,
  role: UserRole = 'MISTRY'
): Promise<{ success: boolean; user?: User; error?: string }> {
  await initDefaultUser();

  const trimmedUser = username.trim().toLowerCase();
  const trimmedEmail = email.trim().toLowerCase();

  // Strict Protection: Super Admin email & reserved names cannot be registered
  if (
    trimmedEmail === INITIAL_ADMIN_EMAIL ||
    trimmedUser === INITIAL_ADMIN_USERNAME ||
    trimmedUser === 'admin'
  ) {
    return {
      success: false,
      error: 'Access Denied: This Admin ID is reserved exclusively for the Real Admin. Nobody else can use or register this ID.',
    };
  }

  if (!trimmedUser || trimmedUser.length < 3) {
    return { success: false, error: 'Username must be at least 3 characters.' };
  }

  if (!password || password.length < 6) {
    return { success: false, error: 'Password must be at least 6 characters.' };
  }

  const existing = await db.users
    .filter(
      u =>
        u.username.toLowerCase() === trimmedUser ||
        Boolean(trimmedEmail && u.email.toLowerCase() === trimmedEmail)
    )
    .first();

  if (existing) {
    return { success: false, error: 'Username or Email already registered. Please login instead.' };
  }

  // Public self-registration is strictly MISTRY role.
  const assignedRole: UserRole = 'MISTRY';
  const passwordHash = await hashPassword(password);
  const phoneNormalized = normalizeIndianPhone(mobile);

  const newUser: User = {
    id: `user-${Date.now()}`,
    username: trimmedUser,
    fullName: fullName.trim() || username.trim(),
    mobile: mobile.trim(),
    phoneNormalized,
    email: email.trim(),
    passwordHash,
    role: assignedRole,
    isActive: true,
    mustChangePassword: false,
    createdAt: new Date().toISOString(),
  };

  await db.users.put(newUser);
  setCurrentUser(newUser, true);

  await db.logSecurityAudit(
    'USER_REGISTERED',
    newUser,
    newUser.id,
    'users',
    'SUCCESS',
    `New contractor ${newUser.fullName} registered with role ${newUser.role}`
  );

  return { success: true, user: newUser };
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

  const user = await db.users.get(userId);
  if (!user) return { success: false, error: 'User not found.' };

  const currentHash = await hashPassword(currentPassword);
  if (user.passwordHash !== currentHash) {
    return { success: false, error: 'Current password is incorrect.' };
  }

  const newHash = await hashPassword(newPassword);
  await db.users.update(userId, {
    passwordHash: newHash,
    mustChangePassword: false,
    updatedAt: new Date().toISOString(),
  });

  // Update current session
  const current = getCurrentUser();
  if (current && current.id === userId) {
    current.mustChangePassword = false;
    setCurrentUser(current);
  }

  await db.logSecurityAudit(
    'PASSWORD_CHANGED',
    user,
    userId,
    'users',
    'SUCCESS',
    `User ${user.fullName} changed their password.`
  );

  return { success: true };
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

  const user = await db.users.get(userId);
  if (!user) return { success: false, error: 'User not found.' };

  const newHash = await hashPassword(newPassword);
  await db.users.update(userId, {
    passwordHash: newHash,
    mustChangePassword: false,
    updatedAt: new Date().toISOString(),
  });

  const current = getCurrentUser();
  if (current && current.id === userId) {
    current.mustChangePassword = false;
    setCurrentUser(current);
  }

  await db.logSecurityAudit(
    'INITIAL_PASSWORD_CONFIGURED',
    user,
    userId,
    'users',
    'SUCCESS',
    `User ${user.fullName} configured initial private password.`
  );

  return { success: true };
}

/**
 * Super Admin resets user password and requires change on next login
 */
export async function adminResetUserPassword(
  adminUser: User,
  targetUserId: string,
  newTemporaryPassword: string
): Promise<{ success: boolean; error?: string }> {
  if (!isSuperAdmin(adminUser) && adminUser.role !== 'SUB_ADMIN') {
    return { success: false, error: 'Unauthorized: Only administrators can reset user passwords.' };
  }

  const target = await db.users.get(targetUserId);
  if (!target) return { success: false, error: 'Target user not found.' };

  if (target.email.toLowerCase() === INITIAL_ADMIN_EMAIL && adminUser.id !== targetUserId) {
    return { success: false, error: 'Cannot reset Real Admin password through this function.' };
  }

  const strength = validatePasswordStrength(newTemporaryPassword);
  if (!strength.valid) {
    return { success: false, error: strength.error };
  }

  const newHash = await hashPassword(newTemporaryPassword);
  await db.users.update(targetUserId, {
    passwordHash: newHash,
    mustChangePassword: true,
    updatedAt: new Date().toISOString(),
  });

  await db.logSecurityAudit(
    'ADMIN_RESET_USER_PASSWORD',
    adminUser,
    targetUserId,
    'users',
    'SUCCESS',
    `Admin ${adminUser.fullName} reset password for ${target.fullName} (mustChangePassword set to true).`
  );

  return { success: true };
}

export async function createSubAdmin(
  creatorUser: User,
  data: {
    username: string;
    fullName: string;
    mobile: string;
    email: string;
    password: string;
  }
): Promise<{ success: boolean; user?: User; error?: string }> {
  if (!isSuperAdmin(creatorUser)) {
    return {
      success: false,
      error: `Permission Denied: Only the Real Admin (${INITIAL_ADMIN_EMAIL}) can create Sub-Admins.`,
    };
  }

  const trimmedUser = data.username.trim().toLowerCase();
  if (!trimmedUser || trimmedUser.length < 3) {
    return { success: false, error: 'Username must be at least 3 characters.' };
  }
  if (!data.password || data.password.length < 6) {
    return { success: false, error: 'Password must be at least 6 characters.' };
  }

  const existing = await db.users
    .filter(
      u =>
        u.username.toLowerCase() === trimmedUser ||
        Boolean(data.email && u.email.toLowerCase() === data.email.trim().toLowerCase())
    )
    .first();
  if (existing) {
    return { success: false, error: 'Username or Email already registered.' };
  }

  const passwordHash = await hashPassword(data.password);
  const newSubAdmin: User = {
    id: `user-subadmin-${Date.now()}`,
    username: trimmedUser,
    fullName: data.fullName.trim() || trimmedUser,
    mobile: data.mobile.trim(),
    phoneNormalized: normalizeIndianPhone(data.mobile),
    email: data.email.trim(),
    passwordHash,
    role: 'SUB_ADMIN',
    isActive: true,
    mustChangePassword: false,
    createdAt: new Date().toISOString(),
  };

  await db.users.put(newSubAdmin);
  await db.logSecurityAudit(
    'SUB_ADMIN_CREATED',
    creatorUser,
    newSubAdmin.id,
    'users',
    'SUCCESS',
    `Real Admin ${creatorUser.fullName} created Sub-Admin ${newSubAdmin.fullName} (@${newSubAdmin.username})`
  );

  return { success: true, user: newSubAdmin };
}

export async function changeUserRole(
  actorUser: User,
  targetUserId: string,
  newRole: UserRole
): Promise<{ success: boolean; error?: string }> {
  if (!isSuperAdmin(actorUser)) {
    return {
      success: false,
      error: `Permission Denied: Only the Real Admin (${INITIAL_ADMIN_EMAIL}) can modify user roles.`,
    };
  }

  const target = await db.users.get(targetUserId);
  if (!target) return { success: false, error: 'Target user not found.' };

  if (target.email.toLowerCase() === INITIAL_ADMIN_EMAIL) {
    return { success: false, error: 'Cannot modify the role of the Real Admin.' };
  }

  await db.users.update(targetUserId, {
    role: newRole,
    updatedAt: new Date().toISOString(),
  });

  await db.logSecurityAudit(
    'USER_ROLE_CHANGED',
    actorUser,
    targetUserId,
    'users',
    'SUCCESS',
    `Real Admin changed ${target.fullName}'s role from ${target.role} to ${newRole}`
  );

  return { success: true };
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
  const current = getCurrentUser();
  if (current) {
    await db.logSecurityAudit(
      'USER_LOGOUT',
      current,
      current.id,
      'users',
      'SUCCESS',
      `${current.fullName} logged out`
    );
  }
  setCurrentUser(null);
}

export interface AdminUserListItem extends Omit<User, 'passwordHash'> {
  sitesCount: number;
  totalExpenses: number;
}

/**
 * Returns users with calculated site counts and project expenses
 * (Password hash is strictly omitted)
 */
export async function getAllUsers(adminUser: User): Promise<AdminUserListItem[]> {
  if (!isAdmin(adminUser)) {
    throw new Error('Unauthorized: Only administrators can view user records.');
  }

  const [allUsers, allSites, allMaterials, allWorkers, allSalaries, allTools, allExpenses, allBills, allWater, allTea, allPooja] =
    await Promise.all([
      db.users.toArray(),
      db.sites.toArray(),
      db.materials.toArray(),
      db.workers.toArray(),
      db.salaryPayments.toArray(),
      db.tools.toArray(),
      db.otherExpenses.toArray(),
      db.electricityBills.toArray(),
      db.waterBills.toArray(),
      db.teaSnacksExpenses.toArray(),
      db.poojaExpenses.toArray(),
    ]);

  return allUsers.map(user => {
    const userSites = allSites.filter(s => !s.isDeleted && s.userId === user.id);
    const userSiteIds = new Set(userSites.map(s => s.id));

    const totalExpense =
      allMaterials.filter(m => !m.isDeleted && userSiteIds.has(m.siteId)).reduce((sum, m) => sum + (m.totalAmount || 0), 0) +
      allSalaries.filter(sp => !sp.isDeleted && userSiteIds.has(sp.siteId)).reduce((sum, sp) => sum + (sp.paidAmount || 0), 0) +
      allTools.filter(t => !t.isDeleted && userSiteIds.has(t.siteId)).reduce((sum, t) => sum + (t.cost || 0), 0) +
      allExpenses.filter(e => !e.isDeleted && userSiteIds.has(e.siteId)).reduce((sum, e) => sum + (e.amount || 0), 0) +
      allBills.filter(b => !b.isDeleted && userSiteIds.has(b.siteId)).reduce((sum, b) => sum + (b.billAmount || 0), 0) +
      allWater.filter(w => !w.isDeleted && userSiteIds.has(w.siteId)).reduce((sum, w) => sum + (w.billAmount || 0), 0) +
      allTea.filter(ts => !ts.isDeleted && userSiteIds.has(ts.siteId)).reduce((sum, ts) => sum + (ts.totalAmount || 0), 0) +
      allPooja.filter(p => !p.isDeleted && userSiteIds.has(p.siteId)).reduce((sum, p) => sum + (p.totalAmount || 0), 0);

    const { passwordHash: _, ...rest } = user;
    return {
      ...rest,
      sitesCount: userSites.length,
      totalExpenses: totalExpense,
    };
  });
}

export async function toggleUserActive(
  adminUser: User,
  targetUserId: string,
  isActive: boolean
): Promise<{ success: boolean; error?: string }> {
  if (!isAdmin(adminUser)) {
    return { success: false, error: 'Unauthorized: Only administrators can modify user status.' };
  }

  const target = await db.users.get(targetUserId);
  if (!target) {
    return { success: false, error: 'Target user not found.' };
  }

  // Security Rule: Super Admin account can NEVER be deactivated
  if (target.role === 'SUPER_ADMIN' || target.email.toLowerCase() === INITIAL_ADMIN_EMAIL) {
    return { success: false, error: 'Real Admin account cannot be deactivated.' };
  }

  if (adminUser.id === targetUserId && !isActive) {
    return { success: false, error: 'You cannot deactivate your own account.' };
  }

  if (!isSuperAdmin(adminUser) && target.role === 'SUB_ADMIN') {
    return {
      success: false,
      error: 'Permission Denied: Sub-admins cannot deactivate other administrators.',
    };
  }

  await db.users.update(targetUserId, {
    isActive,
    updatedAt: new Date().toISOString(),
  });

  await db.logSecurityAudit(
    isActive ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
    adminUser,
    targetUserId,
    'users',
    'SUCCESS',
    `User ${target.fullName} (${target.username}) was ${isActive ? 'activated' : 'deactivated'} by Admin ${adminUser.fullName}`
  );

  return { success: true };
}
