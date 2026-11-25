/**
 * Sign-up and sign-in steps (Welcome → Create Account / Log In), kept apart from the screens so
 * they can be tested with a stand-in for Supabase Auth.
 *
 * Every failure comes back as a dictionary key (auth_err_*), which the screen shows in English
 * or Tamil. Nothing here stores a password: Supabase Auth is the only place one is kept.
 */
import type { AuthUser, SupabaseClient } from '@supabase/supabase-js';
import type { User } from '../db/types';

/** The parts of Supabase Auth the sign-in screens use. */
export type AuthClient = Pick<
  SupabaseClient['auth'],
  'signInWithOtp' | 'verifyOtp' | 'signUp' | 'signInWithPassword' | 'updateUser' | 'signOut' | 'getSession' | 'resend'
>;

export interface FlowDeps {
  auth: AuthClient;
  /** Supabase URL and key are set for this build. */
  configured: boolean;
  /** Loads (and caches on the device) the app profile for a signed-in account. */
  resolveUser: (authUser: AuthUser) => Promise<User>;
  isOnline?: () => boolean;
}

export type FlowResult<T extends object = object> = ({ ok: true } & T) | { ok: false; errorKey: string; detail?: string };

const fail = (errorKey: string, detail?: string): { ok: false; errorKey: string; detail?: string } => ({ ok: false, errorKey, detail });

// ── Input checks ─────────────────────────────────────────────────────────────

export const DEFAULT_COUNTRY_CODE = '+91';

/**
 * A phone number in the form Supabase sends SMS to (+<country><number>), or null when it is not
 * a valid number. India (+91, the default) needs 10 digits starting 6–9; a leading 0, +91 or 91
 * typed into the number box is accepted. Other country codes take 6–14 digits.
 */
export function normalizePhone(input: string, countryCode: string = DEFAULT_COUNTRY_CODE): string | null {
  const raw = (input || '').replace(/[\s\-().]/g, '');
  if (!raw) return null;
  let cc = (countryCode || DEFAULT_COUNTRY_CODE).replace(/[^\d]/g, '');
  let digits: string;
  if (raw.startsWith('+')) {
    // A full international number typed into the box wins over the country picker.
    const all = raw.slice(1);
    if (!/^\d+$/.test(all)) return null;
    if (all.startsWith('91') && all.length === 12) { cc = '91'; digits = all.slice(2); }
    else return /^\d{8,15}$/.test(all) ? `+${all}` : null;
  } else {
    if (!/^\d+$/.test(raw)) return null;
    digits = raw;
    if (cc === '91') {
      if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
      else if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
    }
  }
  if (!cc) return null;
  if (cc === '91') return /^[6-9]\d{9}$/.test(digits) ? `+91${digits}` : null;
  return /^\d{6,14}$/.test(digits) ? `+${cc}${digits}` : null;
}

/** "+91 98765 43210" for showing a normalized number back to the user. */
export function formatPhoneForDisplay(e164: string): string {
  const m = /^\+91(\d{5})(\d{5})$/.exec(e164);
  return m ? `+91 ${m[1]} ${m[2]}` : e164;
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((email || '').trim());
}

const COMMON_PASSWORDS = ['password', 'password123', '12345678', '123456789', 'admin123', 'mistry123', 'buildingmistry', 'sitemistry'];

/** The key of the first problem with a new password, or null when it is fine. */
export function passwordProblem(password: string): string | null {
  if (!password || password.length < 8) return 'auth_err_password_short';
  if (!/[a-zA-Z]/.test(password) || !/\d/.test(password)) return 'auth_err_password_mix';
  if (COMMON_PASSWORDS.includes(password.toLowerCase())) return 'auth_err_password_common';
  return null;
}

export function nameProblem(name: string): string | null {
  return (name || '').trim().length >= 2 ? null : 'auth_err_name';
}

export interface EmailSignUpInput {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
}

/** The key of the first problem with the Create Account (email) form, or null. */
export function validateEmailSignUp(input: EmailSignUpInput): string | null {
  return nameProblem(input.fullName)
    ?? (isValidEmail(input.email) ? null : 'auth_err_email')
    ?? passwordProblem(input.password)
    ?? (input.password === input.confirmPassword ? null : 'auth_err_password_match');
}

export function isSixDigitCode(code: string): boolean {
  return /^\d{6}$/.test((code || '').trim());
}

// ── Error messages ───────────────────────────────────────────────────────────

/** Turns a Supabase / network error into a message key the user can act on. */
export function friendlyAuthError(error: unknown): string {
  const raw = error instanceof Error ? error.message
    : typeof error === 'string' ? error
    : (error as { message?: string; code?: string; status?: number } | null)?.message || '';
  const code = String((error as { code?: string } | null)?.code || '').toLowerCase();
  const status = Number((error as { status?: number } | null)?.status || 0);
  const m = `${raw} ${code}`.toLowerCase();

  if (/failed to fetch|fetch failed|networkerror|network request failed|load failed|network error|timed? ?out|err_internet/.test(m)) return 'auth_err_network';
  if (status === 429 || /rate limit|too many|security purposes|over_(email|sms)_send_rate_limit|over_request_rate_limit/.test(m)) return 'auth_err_rate_limit';
  if (/not configured/.test(m)) return 'auth_err_not_configured';
  if (/invalid login credentials|invalid_credentials/.test(m)) return 'auth_err_wrong_password';
  if (/email not confirmed|email_not_confirmed/.test(m)) return 'auth_err_email_unconfirmed';
  if (/already registered|already been registered|already exists|user_already_exists|email_exists|phone_exists/.test(m)) return 'auth_err_already_registered';
  if (/phone provider|sms provider|unsupported phone|phone signups are disabled|phone_provider_disabled|sms_send_failed|error sending (confirmation|sms)/.test(m)) return 'auth_err_phone_unavailable';
  if (/signups not allowed|otp_disabled|user not found|user_not_found/.test(m)) return 'auth_err_no_account';
  if (/token has expired|otp_expired|invalid otp|token.*invalid|invalid.*token|otp.*(expired|invalid)/.test(m)) return 'auth_err_wrong_otp';
  if (/account is disabled|user is banned|user_banned/.test(m)) return 'auth_err_account_disabled';
  if (/weak password|weak_password|password should/.test(m)) return 'auth_err_password_weak';
  if (/invalid phone|phone number|validation_failed.*phone/.test(m)) return 'auth_err_phone';
  if (/invalid email|unable to validate email|email_address_invalid/.test(m)) return 'auth_err_email';
  return 'auth_err_generic';
}

/** Checks that apply before any request: settings present and a connection. */
function precheck(deps: FlowDeps): { ok: false; errorKey: string } | null {
  if (!deps.configured) return fail('auth_err_not_configured');
  if (deps.isOnline && !deps.isOnline()) return fail('auth_err_offline');
  return null;
}

async function call<T>(fn: () => Promise<T>): Promise<{ value?: T; thrown?: unknown }> {
  try {
    return { value: await fn() };
  } catch (thrown) {
    return { thrown };
  }
}

// ── Phone OTP ────────────────────────────────────────────────────────────────

/** Sends the SMS code. Create Account may make a new account; Log In only signs in an existing one. */
export async function requestPhoneOtp(
  deps: FlowDeps, phoneInput: string, purpose: 'signup' | 'login', countryCode = DEFAULT_COUNTRY_CODE,
): Promise<FlowResult<{ phone: string }>> {
  const phone = normalizePhone(phoneInput, countryCode);
  if (!phone) return fail('auth_err_phone');
  const blocked = precheck(deps);
  if (blocked) return blocked;
  const { value, thrown } = await call(() => deps.auth.signInWithOtp({ phone, options: { shouldCreateUser: purpose === 'signup' } }));
  const error = thrown ?? value?.error;
  if (error) return fail(friendlyAuthError(error), String((error as Error).message || error));
  return { ok: true, phone };
}

/** Checks the 6-digit code. `needsName` is true when the account has no name yet (new sign-up). */
export async function verifyPhoneCode(
  deps: FlowDeps, phone: string, code: string,
): Promise<FlowResult<{ user: User; needsName: boolean }>> {
  if (!isSixDigitCode(code)) return fail('auth_err_otp_format');
  const blocked = precheck(deps);
  if (blocked) return blocked;
  const { value, thrown } = await call(() => deps.auth.verifyOtp({ phone, token: code.trim(), type: 'sms' }));
  const error = thrown ?? value?.error;
  if (error) return fail(friendlyAuthError(error), String((error as Error).message || error));
  const authUser = value?.data?.user;
  if (!authUser || !value?.data?.session) return fail('auth_err_wrong_otp');
  const resolved = await call(() => deps.resolveUser(authUser));
  if (resolved.thrown || !resolved.value) {
    await call(() => deps.auth.signOut({ scope: 'local' }));
    return fail(friendlyAuthError(resolved.thrown), String((resolved.thrown as Error)?.message || ''));
  }
  const needsName = !String(authUser.user_metadata?.full_name || '').trim();
  return { ok: true, user: resolved.value, needsName };
}

/** Saves the name of a new account (the profile step after a phone sign-up). */
export async function saveProfileName(deps: FlowDeps, user: User, fullName: string): Promise<FlowResult<{ user: User }>> {
  const problem = nameProblem(fullName);
  if (problem) return fail(problem);
  const name = fullName.trim();
  const blocked = precheck(deps);
  if (blocked) return blocked;
  const { value, thrown } = await call(() => deps.auth.updateUser({ data: { full_name: name } }));
  const error = thrown ?? value?.error;
  if (error) return fail(friendlyAuthError(error), String((error as Error).message || error));
  return { ok: true, user: { ...user, fullName: name, username: user.username && !/^\+?\d+$/.test(user.username) ? user.username : name, updatedAt: new Date().toISOString() } };
}

// ── Email ────────────────────────────────────────────────────────────────────

/** A username for a new email account: the part before @, letters and digits only. */
export function usernameFromEmail(email: string): string {
  const base = email.trim().toLowerCase().split('@')[0].replace(/[^a-z0-9._-]/g, '');
  return base.length >= 3 ? base : `${base}user`.slice(0, 12);
}

/**
 * Creates an email account. When the project asks new users to confirm their email, there is no
 * session yet: `needsConfirmation` tells the screen to say "check your email".
 */
export async function signUpWithEmail(
  deps: FlowDeps, input: EmailSignUpInput, emailRedirectTo?: string,
): Promise<FlowResult<{ user?: User; needsConfirmation: boolean; email: string }>> {
  const problem = validateEmailSignUp(input);
  if (problem) return fail(problem);
  const blocked = precheck(deps);
  if (blocked) return blocked;
  const email = input.email.trim().toLowerCase();
  const fullName = input.fullName.trim();
  const { value, thrown } = await call(() => deps.auth.signUp({
    email,
    password: input.password,
    options: { data: { full_name: fullName, username: usernameFromEmail(email) }, ...(emailRedirectTo ? { emailRedirectTo } : {}) },
  }));
  const error = thrown ?? value?.error;
  if (error) return fail(friendlyAuthError(error), String((error as Error).message || error));
  const authUser = value?.data?.user;
  if (!authUser) return fail('auth_err_generic');
  // With email confirmation on, Supabase answers an existing address with an account that has no identities.
  if (Array.isArray(authUser.identities) && authUser.identities.length === 0) return fail('auth_err_already_registered');
  if (!value?.data?.session) return { ok: true, needsConfirmation: true, email };
  const resolved = await call(() => deps.resolveUser(authUser));
  if (resolved.thrown || !resolved.value) {
    await call(() => deps.auth.signOut({ scope: 'local' }));
    return fail(friendlyAuthError(resolved.thrown));
  }
  return { ok: true, user: resolved.value, needsConfirmation: false, email };
}

export async function signInWithEmail(deps: FlowDeps, emailInput: string, password: string): Promise<FlowResult<{ user: User }>> {
  if (!isValidEmail(emailInput)) return fail('auth_err_email');
  if (!password) return fail('auth_err_password_missing');
  const blocked = precheck(deps);
  if (blocked) return blocked;
  const email = emailInput.trim().toLowerCase();
  const { value, thrown } = await call(() => deps.auth.signInWithPassword({ email, password }));
  const error = thrown ?? value?.error;
  if (error) return fail(friendlyAuthError(error), String((error as Error).message || error));
  const authUser = value?.data?.user;
  if (!authUser) return fail('auth_err_generic');
  const resolved = await call(() => deps.resolveUser(authUser));
  if (resolved.thrown || !resolved.value) {
    await call(() => deps.auth.signOut({ scope: 'local' }));
    return fail(friendlyAuthError(resolved.thrown), String((resolved.thrown as Error)?.message || ''));
  }
  return { ok: true, user: resolved.value };
}

export async function resendSignUpEmail(deps: FlowDeps, email: string): Promise<FlowResult> {
  if (!isValidEmail(email)) return fail('auth_err_email');
  const blocked = precheck(deps);
  if (blocked) return blocked;
  const { value, thrown } = await call(() => deps.auth.resend({ type: 'signup', email: email.trim().toLowerCase() }));
  const error = thrown ?? value?.error;
  return error ? fail(friendlyAuthError(error)) : { ok: true };
}

// ── Phone OTP screen state ───────────────────────────────────────────────────

export const OTP_RESEND_SECONDS = 30;

export interface PhoneOtpState {
  step: 'phone' | 'code' | 'name';
  /** The normalized number the code went to. */
  phone: string;
  /** A request is running: buttons are disabled so a double tap cannot send twice. */
  busy: boolean;
  errorKey: string;
  infoKey: string;
  /** When "Resend code" becomes available (ms since epoch). */
  resendAt: number;
  /** The signed-in user waiting for their name (step 'name'). */
  pendingUser: User | null;
}

export type PhoneOtpAction =
  | { type: 'START' }
  | { type: 'FAIL'; errorKey: string }
  | { type: 'CODE_SENT'; phone: string; now: number }
  | { type: 'VERIFIED'; user: User; needsName: boolean }
  | { type: 'NAME_SAVED'; user: User }
  | { type: 'EDIT_PHONE' }
  | { type: 'CLEAR_MESSAGES' };

export const initialPhoneOtpState: PhoneOtpState = {
  step: 'phone', phone: '', busy: false, errorKey: '', infoKey: '', resendAt: 0, pendingUser: null,
};

export function phoneOtpReducer(state: PhoneOtpState, action: PhoneOtpAction): PhoneOtpState {
  switch (action.type) {
    case 'START':
      // A second tap while a request is running changes nothing.
      return state.busy ? state : { ...state, busy: true, errorKey: '', infoKey: '' };
    case 'FAIL':
      return { ...state, busy: false, errorKey: action.errorKey, infoKey: '' };
    case 'CODE_SENT':
      return { ...state, step: 'code', phone: action.phone, busy: false, errorKey: '', infoKey: 'auth_otp_sent', resendAt: action.now + OTP_RESEND_SECONDS * 1000 };
    case 'VERIFIED':
      return action.needsName
        ? { ...state, step: 'name', busy: false, errorKey: '', infoKey: 'auth_phone_verified', pendingUser: action.user }
        : { ...state, busy: false, errorKey: '', infoKey: '', pendingUser: action.user };
    case 'NAME_SAVED':
      return { ...state, busy: false, errorKey: '', infoKey: '', pendingUser: action.user };
    case 'EDIT_PHONE':
      return state.busy || state.step !== 'code' ? state : { ...initialPhoneOtpState, phone: state.phone };
    case 'CLEAR_MESSAGES':
      return { ...state, errorKey: '', infoKey: '' };
    default:
      return state;
  }
}

// ── App gate ─────────────────────────────────────────────────────────────────

/**
 * Whether the app shows the splash, the Welcome screens or the workspace. The workspace opens
 * only for a signed-in account (never for the old on-device "local builder").
 */
export interface AuthGateState {
  status: 'checking' | 'signed-out' | 'signed-in';
  user: User | null;
  /** Signed in during this visit (not restored): offer to move on-device projects into the account. */
  justSignedIn: boolean;
}

export type AuthGateEvent =
  | { type: 'RESTORED'; user: User | null }
  | { type: 'SIGNED_IN'; user: User }
  | { type: 'PROFILE_UPDATED'; user: User }
  | { type: 'SIGNED_OUT' };

export const initialAuthGateState: AuthGateState = { status: 'checking', user: null, justSignedIn: false };

const isSignedInAccount = (user: User | null | undefined): user is User =>
  !!user && !!user.id && !user.isLocal && user.id !== 'local_builder' && user.id !== 'local-builder-user';

export function authGateReducer(state: AuthGateState, event: AuthGateEvent): AuthGateState {
  switch (event.type) {
    case 'RESTORED':
      if (state.status !== 'checking') return state;
      return isSignedInAccount(event.user)
        ? { status: 'signed-in', user: event.user, justSignedIn: false }
        : { status: 'signed-out', user: null, justSignedIn: false };
    case 'SIGNED_IN':
      return isSignedInAccount(event.user) ? { status: 'signed-in', user: event.user, justSignedIn: true } : state;
    case 'PROFILE_UPDATED':
      return state.status === 'signed-in' && state.user?.id === event.user.id ? { ...state, user: event.user } : state;
    case 'SIGNED_OUT':
      return { status: 'signed-out', user: null, justSignedIn: false };
    default:
      return state;
  }
}
