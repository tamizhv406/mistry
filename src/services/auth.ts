import { db } from '../db/db';
import type { User, UserRole } from '../db/types';

const SESSION_KEY = 'building_mistry_auth_user';

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
    (user.email || '').toLowerCase() === 'tamilthilagan82@gmail.com'
  );
}

export function isAdmin(user?: User | null): boolean {
  if (!user) return false;
  return (
    user.role === 'SUPER_ADMIN' ||
    user.role === 'SUB_ADMIN' ||
    user.role === 'ADMIN' ||
    (user.email || '').toLowerCase() === 'tamilthilagan82@gmail.com'
  );
}

export async function initDefaultUser(): Promise<void> {
  // 1. Provision REAL ADMIN (tamilthilagan82@gmail.com / tamil406@##)
  const realAdminHash = await hashPassword('tamil406@##');
  const existingRealAdmin = await db.users
    .filter(u => u.email.toLowerCase() === 'tamilthilagan82@gmail.com' || u.username.toLowerCase() === 'tamilthilagan')
    .first();

  if (!existingRealAdmin) {
    const realAdmin: User = {
      id: 'user-super-admin-tamil',
      username: 'tamilthilagan',
      fullName: 'Tamil Thilagan (Real Admin)',
      mobile: '98401 99887',
      email: 'tamilthilagan82@gmail.com',
      passwordHash: realAdminHash,
      role: 'SUPER_ADMIN',
      isActive: true,
      createdAt: '2026-01-01T00:00:00.000Z',
    };
    await db.users.put(realAdmin);
  } else {
    // Ensure password hash and SUPER_ADMIN role are up-to-date
    await db.users.update(existingRealAdmin.id, {
      email: 'tamilthilagan82@gmail.com',
      passwordHash: realAdminHash,
      role: 'SUPER_ADMIN',
      isActive: true,
      updatedAt: new Date().toISOString(),
    });
  }

  // 2. Default Mistry Velu account
  const defaultPasswordHash = await hashPassword('mistry123');
  const mistryExists = await db.users.get('user-mistry-velu');
  if (!mistryExists) {
    const defaultMistry: User = {
      id: 'user-mistry-velu',
      username: 'mistry_velu',
      fullName: 'R. Velu (Head Mistry)',
      mobile: '98402 11223',
      email: 'velu@buildingmistry.com',
      passwordHash: defaultPasswordHash,
      role: 'MISTRY',
      isActive: true,
      createdAt: '2026-01-01T00:00:00.000Z',
    };
    await db.users.put(defaultMistry);
  }

  // 3. Demo Admin Supervisor account (for supervisor testing & backward compatibility)
  const adminExists = await db.users.get('user-admin-default');
  if (!adminExists) {
    const defaultAdmin: User = {
      id: 'user-admin-default',
      username: 'admin',
      fullName: 'Site Supervisor (Demo)',
      mobile: '98401 00001',
      email: 'admin@buildingmistry.com',
      passwordHash: defaultPasswordHash,
      role: 'ADMIN',
      isActive: true,
      createdAt: '2026-01-01T00:00:00.000Z',
    };
    await db.users.put(defaultAdmin);
  }
}

export const initAuth = initDefaultUser;

export async function loginUser(
  identifier: string,
  password: string,
  remember: boolean = true
): Promise<{ success: boolean; user?: User; error?: string }> {
  await initDefaultUser();

  const trimmedId = identifier.trim().toLowerCase();
  const users = await db.users.toArray();
  const user = users.find(
    u =>
      u.username.toLowerCase() === trimmedId ||
      u.mobile.replace(/\s+/g, '') === trimmedId.replace(/\s+/g, '') ||
      u.email.toLowerCase() === trimmedId
  );

  if (!user) {
    return { success: false, error: 'User not found. Check username, email, or mobile number.' };
  }

  // Check if account is active
  if (user.isActive === false) {
    return { success: false, error: 'Your account is deactivated. Please contact administrator.' };
  }

  const inputHash = await hashPassword(password);
  if (user.passwordHash !== inputHash) {
    return { success: false, error: 'Incorrect password. Please try again.' };
  }

  // Save session
  setCurrentUser(user, remember);
  await db.logActivity(
    user.id,
    user.fullName,
    user.role,
    undefined,
    undefined,
    'User Login',
    `${user.fullName} (${user.role}) logged in successfully`
  );

  return { success: true, user };
}

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

  // Strict Protection: Admin ID and reserved usernames cannot be registered by anyone
  if (
    trimmedEmail === 'tamilthilagan82@gmail.com' ||
    trimmedUser === 'tamilthilagan' ||
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
  // Elevated permissions (Sub-Admin / Admin) can only be granted by the Real Admin.
  const assignedRole: UserRole = 'MISTRY';

  const passwordHash = await hashPassword(password);
  const newUser: User = {
    id: `user-${Date.now()}`,
    username: trimmedUser,
    fullName: fullName.trim() || username.trim(),
    mobile: mobile.trim(),
    email: email.trim(),
    passwordHash,
    role: assignedRole,
    isActive: true,
    createdAt: new Date().toISOString(),
  };

  await db.users.put(newUser);
  setCurrentUser(newUser, true);
  await db.logActivity(
    newUser.id,
    newUser.fullName,
    newUser.role,
    undefined,
    undefined,
    'User Registered',
    `${newUser.fullName} registered as a new ${newUser.role}`
  );

  return { success: true, user: newUser };
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
      error: 'Permission Denied: Only the Real Admin (tamilthilagan82@gmail.com) can create Sub-Admins.',
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
    email: data.email.trim(),
    passwordHash,
    role: 'SUB_ADMIN',
    isActive: true,
    createdAt: new Date().toISOString(),
  };

  await db.users.put(newSubAdmin);
  await db.logAdminAudit(
    creatorUser,
    'Create Sub-Admin',
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
      error: 'Permission Denied: Only the Real Admin (tamilthilagan82@gmail.com) can modify user roles.',
    };
  }

  const target = await db.users.get(targetUserId);
  if (!target) return { success: false, error: 'Target user not found.' };

  if (target.email.toLowerCase() === 'tamilthilagan82@gmail.com') {
    return { success: false, error: 'Cannot modify the role of the Real Admin.' };
  }

  await db.users.update(targetUserId, {
    role: newRole,
    updatedAt: new Date().toISOString(),
  });

  await db.logAdminAudit(
    actorUser,
    'Change User Role',
    `Real Admin changed ${target.fullName}'s role from ${target.role} to ${newRole}`
  );

  return { success: true };
}

export function getCurrentUser(): User | null {
  try {
    if (typeof localStorage === 'undefined' && typeof sessionStorage === 'undefined') {
      return null;
    }
    const raw =
      (typeof localStorage !== 'undefined' ? localStorage.getItem(SESSION_KEY) : null) ||
      (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(SESSION_KEY) : null);
    if (!raw) return null;
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

export function setCurrentUser(user: User | null, remember: boolean = true): void {
  try {
    if (typeof localStorage === 'undefined' && typeof sessionStorage === 'undefined') {
      return;
    }
    if (!user) {
      if (typeof localStorage !== 'undefined') localStorage.removeItem(SESSION_KEY);
      if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(SESSION_KEY);
    } else {
      const serialized = JSON.stringify(user);
      if (remember && typeof localStorage !== 'undefined') {
        localStorage.setItem(SESSION_KEY, serialized);
      } else if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem(SESSION_KEY, serialized);
      }
    }
  } catch {
    // Ignore storage quota or access errors
  }
}

export async function logoutUser(): Promise<void> {
  const current = getCurrentUser();
  if (current) {
    await db.logActivity(
      current.id,
      current.fullName,
      current.role,
      undefined,
      undefined,
      'User Logout',
      `${current.fullName} logged out`
    );
  }
  setCurrentUser(null);
}

export async function getAllUsers(adminUser: User): Promise<Omit<User, 'passwordHash'>[]> {
  if (!isAdmin(adminUser)) {
    throw new Error('Unauthorized: Only administrators can view all users');
  }
  const users = await db.users.toArray();
  // Strip password hash for security
  return users.map(({ passwordHash: _, ...rest }) => rest);
}

export async function toggleUserActive(
  adminUser: User,
  targetUserId: string,
  isActive: boolean
): Promise<{ success: boolean; error?: string }> {
  if (!isAdmin(adminUser)) {
    return { success: false, error: 'Unauthorized: Only administrators can modify user status' };
  }

  const target = await db.users.get(targetUserId);
  if (!target) {
    return { success: false, error: 'Target user not found' };
  }

  if (target.email.toLowerCase() === 'tamilthilagan82@gmail.com') {
    return { success: false, error: 'Real Admin account cannot be deactivated' };
  }

  if (adminUser.id === targetUserId && !isActive) {
    return { success: false, error: 'You cannot deactivate your own account' };
  }

  if (!isSuperAdmin(adminUser) && (target.role === 'SUPER_ADMIN' || target.role === 'SUB_ADMIN')) {
    return {
      success: false,
      error: 'Permission Denied: Sub-admins cannot deactivate other administrators.',
    };
  }

  await db.users.update(targetUserId, {
    isActive,
    updatedAt: new Date().toISOString(),
  });

  await db.logAdminAudit(
    adminUser,
    isActive ? 'Activate User' : 'Deactivate User',
    `User ${target.fullName} (${target.username}) was ${isActive ? 'activated' : 'deactivated'} by Admin ${adminUser.fullName}`
  );

  return { success: true };
}
