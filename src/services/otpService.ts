import { db } from '../db/db';
import type { OtpSession, User } from '../db/types';
import { hashPassword } from './auth';

// Configuration
const OTP_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
const RESEND_COOLDOWN_MS = 60 * 1000; // 60 seconds
const MAX_ATTEMPTS = 3;
const MAX_REQUESTS_PER_WINDOW = 3;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Validates Indian Mobile Numbers
 * Accepts 10 digits starting with 6, 7, 8, or 9, with optional +91 or 0 prefix
 */
export function isValidIndianPhone(phone: string): boolean {
  if (!phone) return false;
  const cleaned = phone.replace(/[\s\-\(\)]/g, '');
  const indianPhoneRegex = /^(?:(?:\+|0{0,2})91(\s*[\-]\s*)?|[0]?)?[6789]\d{9}$/;
  return indianPhoneRegex.test(cleaned);
}

/**
 * Normalizes Indian phone number to canonical 10 digits
 */
export function normalizeIndianPhone(phone: string): string {
  const cleaned = phone.replace(/[\s\-\(\)\+]/g, '');
  if (cleaned.length === 10) return cleaned;
  if (cleaned.length === 11 && cleaned.startsWith('0')) return cleaned.slice(1);
  if (cleaned.length === 12 && cleaned.startsWith('91')) return cleaned.slice(2);
  return cleaned.slice(-10);
}

/**
 * Validates password security rules
 */
export function validatePasswordStrength(password: string): { valid: boolean; error?: string } {
  if (!password || password.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters long.' };
  }

  const hasLetters = /[a-zA-Z]/.test(password);
  const hasNumbers = /[0-9]/.test(password);
  if (!hasLetters || !hasNumbers) {
    return { valid: false, error: 'Password must contain both letters and numbers.' };
  }

  const weakPasswords = ['password', 'password123', '12345678', '123456789', 'admin123', 'mistry123', 'buildingmistry'];
  if (weakPasswords.includes(password.toLowerCase())) {
    return { valid: false, error: 'This password is too common. Please choose a stronger password.' };
  }

  return { valid: true };
}

/**
 * Request Password Recovery OTP
 * Security Rule: Never reveals whether the phone is registered. Always returns generic message.
 */
export async function requestPasswordRecoveryOtp(
  rawPhone: string
): Promise<{ success: boolean; message: string; cooldownSeconds?: number; error?: string }> {
  if (!isValidIndianPhone(rawPhone)) {
    const err = 'Please enter a valid 10-digit Indian mobile number (e.g. 98401 23456).';
    return {
      success: false,
      message: err,
      error: err,
    };
  }

  const phoneNormalized = normalizeIndianPhone(rawPhone);
  const now = Date.now();

  // Rate Limiting Check: Check recent requests in the last 15 minutes
  const recentSessions = await db.otpSessions
    .filter(
      s =>
        s.phoneNormalized === phoneNormalized &&
        new Date(s.createdAt).getTime() > now - RATE_LIMIT_WINDOW_MS
    )
    .toArray();

  if (recentSessions.length >= MAX_REQUESTS_PER_WINDOW) {
    const err = 'Too many OTP requests. Please wait 15 minutes before trying again.';
    return {
      success: false,
      message: err,
      error: err,
    };
  }

  // Check 60-second resend cooldown from the last request
  const latestSession = recentSessions.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )[0];

  if (latestSession && now - new Date(latestSession.createdAt).getTime() < RESEND_COOLDOWN_MS) {
    const remaining = Math.ceil(
      (RESEND_COOLDOWN_MS - (now - new Date(latestSession.createdAt).getTime())) / 1000
    );
    const err = `Please wait ${remaining} seconds before requesting a new OTP.`;
    return {
      success: false,
      message: err,
      cooldownSeconds: remaining,
      error: err,
    };
  }

  // Look up user silently (do NOT reveal result)
  const allUsers = await db.users.toArray();
  const matchedUser = allUsers.find(
    u => normalizeIndianPhone(u.mobile) === phoneNormalized || u.phoneNormalized === phoneNormalized
  );

  // If matched user exists, generate cryptographic OTP and store salted hash
  if (matchedUser && matchedUser.isActive !== false) {
    // Generate 6-digit random code using Web Crypto
    const randomArray = new Uint32Array(1);
    crypto.getRandomValues(randomArray);
    const otp = (100000 + (randomArray[0] % 900000)).toString();

    // Generate random cryptographic salt
    const saltArray = new Uint8Array(16);
    crypto.getRandomValues(saltArray);
    const salt = Array.from(saltArray)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    // Hash the OTP with salt using SHA-256
    const hashedOtp = await hashPassword(salt + otp);

    const session: OtpSession = {
      id: `otp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      phoneNormalized,
      hashedOtp,
      salt,
      expiresAt: now + OTP_EXPIRY_MS,
      attempts: 0,
      verified: false,
      createdAt: new Date(now).toISOString(),
    };

    await db.otpSessions.put(session);

    // Dispatches OTP via SMS Provider Gateway if configured
    await dispatchSmsProvider(phoneNormalized, otp);

    await db.logSecurityAudit(
      'OTP_REQUESTED',
      matchedUser,
      session.id,
      'otpSessions',
      'SUCCESS',
      `Password recovery OTP requested for phone ***${phoneNormalized.slice(-4)}`
    );
  } else {
    // Artificial random timing delay to prevent timing attacks/user enumeration
    await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 200));
  }

  // Return strictly generic success message
  return {
    success: true,
    message: 'If an account exists for this mobile number, an OTP has been sent.',
    cooldownSeconds: 60,
  };
}

/**
 * Verifies submitted OTP
 */
export async function verifyRecoveryOtp(
  rawPhone: string,
  inputOtp: string
): Promise<{ success: boolean; token?: string; error?: string }> {
  if (!rawPhone || !inputOtp || inputOtp.trim().length !== 6) {
    return { success: false, error: 'Please enter the complete 6-digit OTP code.' };
  }

  const phoneNormalized = normalizeIndianPhone(rawPhone);
  const now = Date.now();

  const activeSessions = await db.otpSessions
    .filter(
      s => s.phoneNormalized === phoneNormalized && s.expiresAt > now && s.verified === false
    )
    .toArray();

  if (activeSessions.length === 0) {
    return {
      success: false,
      error: 'OTP code has expired or is invalid. Please request a new code.',
    };
  }

  // Get most recent session
  const session = activeSessions.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )[0];

  if (session.attempts >= MAX_ATTEMPTS) {
    return {
      success: false,
      error: 'Maximum verification attempts exceeded. Please request a new OTP.',
    };
  }

  // Check OTP salted hash
  const inputHash = await hashPassword(session.salt + inputOtp.trim());
  if (inputHash !== session.hashedOtp) {
    await db.otpSessions.update(session.id, {
      attempts: session.attempts + 1,
    });
    const remainingAttempts = MAX_ATTEMPTS - (session.attempts + 1);
    return {
      success: false,
      error:
        remainingAttempts > 0
          ? `Incorrect OTP code. ${remainingAttempts} attempts remaining.`
          : 'Incorrect OTP code. Maximum attempts exceeded.',
    };
  }

  // OTP is verified! Generate cryptographically random recovery token
  const tokenArray = new Uint8Array(24);
  crypto.getRandomValues(tokenArray);
  const token = Array.from(tokenArray)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  await db.otpSessions.update(session.id, {
    verified: true,
    token,
  });

  return {
    success: true,
    token,
  };
}

/**
 * Resets user password after successful OTP verification
 */
export async function resetPasswordWithToken(
  rawPhone: string,
  recoveryToken: string,
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

  const phoneNormalized = normalizeIndianPhone(rawPhone);
  const now = Date.now();

  const session = await db.otpSessions
    .filter(
      s =>
        s.phoneNormalized === phoneNormalized &&
        s.token === recoveryToken &&
        s.verified === true &&
        s.expiresAt > now
    )
    .first();

  if (!session) {
    return {
      success: false,
      error: 'Recovery session is invalid or expired. Please start over.',
    };
  }

  // Find user
  const allUsers = await db.users.toArray();
  const matchedUser = allUsers.find(
    u => normalizeIndianPhone(u.mobile) === phoneNormalized || u.phoneNormalized === phoneNormalized
  );

  if (!matchedUser) {
    return { success: false, error: 'User account not found.' };
  }

  // Compute new salted password hash
  const newHash = await hashPassword(newPassword);

  // Update user record
  await db.users.update(matchedUser.id, {
    passwordHash: newHash,
    mustChangePassword: false,
    updatedAt: new Date().toISOString(),
  });

  // Invalidate OTP session so token cannot be reused
  await db.otpSessions.delete(session.id);

  // Log Security Audit event
  await db.logSecurityAudit(
    'PASSWORD_RESET_VIA_OTP',
    matchedUser,
    matchedUser.id,
    'users',
    'SUCCESS',
    `User ${matchedUser.fullName} successfully reset password using phone verification.`
  );

  return {
    success: true,
    message: 'Password changed successfully.',
  };
}

/**
 * Dispatches OTP via SMS Provider Gateway
 */
async function dispatchSmsProvider(phone: string, otp: string): Promise<void> {
  const gatewayUrl =
    typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SMS_GATEWAY_URL;

  if (gatewayUrl) {
    try {
      await fetch(gatewayUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: `+91${phone}`,
          message: `Your Building Mistry verification code is: ${otp}. Valid for 5 minutes. Do not share this with anyone.`,
        }),
      });
    } catch {
      // In case network provider is unavailable, non-blocking
    }
  }

  // Dispatches securely in background without displaying OTP in frontend UI
}
