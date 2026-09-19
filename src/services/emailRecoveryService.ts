import { db } from '../db/db';
import { isSupabaseConfigured, supabase } from './supabase';
import { hashPassword } from './auth';
import { validatePasswordStrength } from './otpService';

const EMAIL_TOKEN_EXPIRY_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Request email-based password recovery.
 *
 * If Supabase is configured, triggers a real password reset email.
 * Otherwise, stores a short-lived local token linked to the email.
 *
 * Security: Always returns a GENERIC message to prevent email enumeration.
 */
export async function requestEmailPasswordReset(
  email: string
): Promise<{ success: boolean; message: string; usedSupabase?: boolean; error?: string }> {
  if (!email || !email.trim() || !email.includes('@')) {
    return {
      success: false,
      message: 'Please enter a valid email address.',
      error: 'Invalid email format.',
    };
  }

  const normalizedEmail = email.trim().toLowerCase();

  // --- Supabase path (if configured) ---
  if (isSupabaseConfigured() && supabase) {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo: `${window.location.origin}${window.location.pathname}`,
      });
      if (error) {
        console.warn('[EmailRecovery] Supabase reset error:', error.message);
        // Still show generic message to prevent enumeration
      }
    } catch (err) {
      console.warn('[EmailRecovery] Supabase call failed:', err);
    }

    // Always return generic message
    return {
      success: true,
      usedSupabase: true,
      message: 'If an account exists for this email address, a password reset link has been sent. Please check your inbox and spam folder.',
    };
  }

  // --- Local fallback path (Supabase not configured) ---
  // Look up user by email silently
  const users = await db.users.toArray();
  const matchedUser = users.find(u => u.email.toLowerCase() === normalizedEmail);

  if (matchedUser && matchedUser.isActive !== false) {
    // Generate a cryptographically random token
    const tokenArray = new Uint8Array(32);
    crypto.getRandomValues(tokenArray);
    const token = Array.from(tokenArray)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    const now = Date.now();
    // Reuse otpSessions table to store email-based recovery tokens
    // We store email hash as phoneNormalized field, and token in token field
    const emailHash = await hashPassword(normalizedEmail);
    await db.otpSessions.put({
      id: `emailrec-${now}-${Math.random().toString(36).slice(2, 7)}`,
      phoneNormalized: `email:${emailHash.slice(0, 16)}`, // namespaced to avoid collision with phone sessions
      hashedOtp: await hashPassword(token), // we store hashed token
      salt: normalizedEmail, // store email in salt field for lookup (not a secret)
      token,
      expiresAt: now + EMAIL_TOKEN_EXPIRY_MS,
      attempts: 0,
      verified: true, // Pre-verified — user just needs the token
      createdAt: new Date(now).toISOString(),
    });

    await db.logSecurityAudit(
      'EMAIL_RECOVERY_REQUESTED',
      matchedUser,
      matchedUser.id,
      'users',
      'SUCCESS',
      `Email recovery token generated for ${normalizedEmail.slice(0, 3)}***@***`
    );
  } else {
    // Artificial delay to prevent timing-based enumeration
    await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 200));
  }

  // Always return generic message regardless of whether email matched
  return {
    success: true,
    usedSupabase: false,
    message: 'If an account exists for this email address, a recovery token has been generated. Since email delivery is not configured on this installation, please use your registered mobile number to reset your password, or contact your administrator.',
  };
}

/**
 * Reset password using email + recovery token (local flow only)
 */
export async function resetPasswordWithEmailToken(
  email: string,
  token: string,
  newPassword: string,
  confirmPassword: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  if (newPassword !== confirmPassword) {
    return { success: false, error: 'New password and confirmation do not match.' };
  }

  const strength = validatePasswordStrength(newPassword);
  if (!strength.valid) {
    return { success: false, error: strength.error };
  }

  const normalizedEmail = email.trim().toLowerCase();
  const now = Date.now();

  // Find the session by email
  const emailHash = await hashPassword(normalizedEmail);
  const namespace = `email:${emailHash.slice(0, 16)}`;

  const session = await db.otpSessions
    .filter(
      s =>
        s.phoneNormalized === namespace &&
        s.token === token &&
        s.verified === true &&
        s.expiresAt > now
    )
    .first();

  if (!session) {
    return {
      success: false,
      error: 'Recovery token is invalid or has expired. Please request a new reset.',
    };
  }

  // Find user by email
  const users = await db.users.toArray();
  const user = users.find(u => u.email.toLowerCase() === normalizedEmail);
  if (!user) {
    return { success: false, error: 'Account not found.' };
  }

  // Update password
  const newHash = await hashPassword(newPassword);
  await db.users.update(user.id, {
    passwordHash: newHash,
    mustChangePassword: false,
    updatedAt: new Date().toISOString(),
  });

  // Invalidate the token (single-use)
  await db.otpSessions.delete(session.id);

  await db.logSecurityAudit(
    'PASSWORD_RESET_VIA_EMAIL',
    user,
    user.id,
    'users',
    'SUCCESS',
    `User ${user.fullName} reset password via email recovery.`
  );

  return { success: true, message: 'Password changed successfully. You can now sign in.' };
}
