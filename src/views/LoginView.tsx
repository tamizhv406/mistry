/**
 * Welcome → Create Account (Phone OTP or Email) / Log In, plus Forget Password.
 *
 * The app shows this whenever nobody is signed in (see AuthGate in App.tsx); the workspace never
 * opens without an account. Sign-in is checked by Supabase Auth only (no local password check,
 * no built-in accounts); the steps themselves live in services/authFlow.ts.
 */
import React, { useEffect, useReducer, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  HardHat,
  Info,
  Mail,
  MailCheck,
  Package,
  ReceiptIndianRupee,
  Smartphone,
  WifiOff,
} from 'lucide-react';
import BrandLogo from '../components/BrandLogo';
import { useLanguage } from '../services/i18n';
import { defaultAuthDeps, rememberSignedInUser } from '../services/auth';
import {
  DEFAULT_COUNTRY_CODE,
  formatPhoneForDisplay,
  initialPhoneOtpState,
  isValidEmail,
  passwordProblem,
  phoneOtpReducer,
  requestPhoneOtp,
  resendSignUpEmail,
  saveProfileName,
  signInWithEmail,
  signUpWithEmail,
  verifyPhoneCode,
} from '../services/authFlow';
import { requestEmailPasswordReset } from '../services/emailRecoveryService';
import { isSupabaseConfigured, supabase, updateSupabasePassword } from '../services/supabase';
import { db } from '../db/db';
import type { User } from '../db/types';
import '../styles/auth.css';

export type AuthScreen = 'welcome' | 'signup' | 'login' | 'forgot' | 'reset' | 'check-email';
export interface AuthNotice {
  kind: 'info' | 'success' | 'error';
  key: string;
}

interface LoginViewProps {
  /** Called once an account is signed in (and, for a new phone account, has a name). */
  onSignedIn: (user: User, info: { isNewAccount: boolean }) => void;
  /** A message to show on the Welcome screen (e.g. "You have signed out"). */
  notice?: AuthNotice | null;
  initialScreen?: AuthScreen;
}

type T = (key: string, fallback?: string) => string;
const fill = (text: string, values: Record<string, string | number>) =>
  Object.entries(values).reduce((out, [k, v]) => out.replaceAll(`{${k}}`, String(v)), text);

function useOnline(): boolean {
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine !== false);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}

/** Runs one request at a time: a second tap while one is running is ignored. */
function useSingleFlight() {
  const running = useRef(false);
  return async (work: () => Promise<void>) => {
    if (running.current) return;
    running.current = true;
    try {
      await work();
    } finally {
      running.current = false;
    }
  };
}

// ── Small building blocks ────────────────────────────────────────────────────

function Banner({ kind, children }: { kind: 'error' | 'success' | 'warning' | 'info'; children: React.ReactNode }) {
  const Icon = kind === 'error' ? AlertCircle : kind === 'success' ? CheckCircle2 : kind === 'warning' ? WifiOff : Info;
  return (
    <div className={`auth-banner auth-banner-${kind}`} role={kind === 'error' ? 'alert' : 'status'} aria-live={kind === 'error' ? 'assertive' : 'polite'}>
      <Icon size={18} aria-hidden="true" />
      <div className="auth-banner-body">{children}</div>
    </div>
  );
}

function SubmitButton({ busy, label, busyLabel, variant = 'primary', disabled, id, type = 'submit', onClick }: {
  busy: boolean; label: string; busyLabel: string; variant?: 'primary' | 'secondary'; disabled?: boolean; id?: string;
  type?: 'submit' | 'button'; onClick?: () => void;
}) {
  return (
    <button id={id} type={type} onClick={onClick} className={`auth-btn auth-btn-${variant}`} disabled={busy || disabled} aria-busy={busy}>
      {busy && <span className="auth-spinner" aria-hidden="true" />}
      <span>{busy ? busyLabel : label}</span>
    </button>
  );
}

function PasswordField({ id, label, value, onChange, autoComplete, t, invalid, hint }: {
  id: string; label: string; value: string; onChange: (v: string) => void; autoComplete: string; t: T; invalid?: boolean; hint?: string;
}) {
  const [shown, setShown] = useState(false);
  return (
    <div className="auth-field">
      <label className="auth-label" htmlFor={id}>{label}</label>
      <div className="auth-pass">
        <input
          id={id}
          className="auth-input"
          type={shown ? 'text' : 'password'}
          value={value}
          onChange={e => onChange(e.target.value)}
          autoComplete={autoComplete}
          aria-invalid={invalid || undefined}
          aria-describedby={hint ? `${id}-hint` : undefined}
        />
        <button type="button" className="auth-pass-toggle" onClick={() => setShown(s => !s)}
          aria-label={shown ? t('auth_hide_password') : t('auth_show_password')} aria-pressed={shown}>
          {shown ? <EyeOff size={20} /> : <Eye size={20} />}
        </button>
      </div>
      {hint && <p className="auth-hint" id={`${id}-hint`}>{hint}</p>}
    </div>
  );
}

function MethodTabs({ method, onChange, t, idPrefix }: { method: 'phone' | 'email'; onChange: (m: 'phone' | 'email') => void; t: T; idPrefix: string }) {
  return (
    <div className="auth-tabs" role="tablist" aria-label={t('auth_method')}>
      {(['phone', 'email'] as const).map(m => (
        <button
          key={m}
          id={`${idPrefix}-tab-${m}`}
          type="button"
          role="tab"
          className="auth-tab"
          aria-selected={method === m}
          aria-controls={`${idPrefix}-panel`}
          onClick={() => onChange(m)}
        >
          {m === 'phone' ? <Smartphone size={18} aria-hidden="true" /> : <Mail size={18} aria-hidden="true" />}
          {m === 'phone' ? t('auth_with_phone') : t('auth_with_email')}
        </button>
      ))}
    </div>
  );
}

// ── Phone OTP (Create Account and Log In) ────────────────────────────────────

function PhoneOtpForm({ purpose, t, onSignedIn }: { purpose: 'signup' | 'login'; t: T; onSignedIn: LoginViewProps['onSignedIn'] }) {
  const [state, dispatch] = useReducer(phoneOtpReducer, initialPhoneOtpState);
  const [countryCode, setCountryCode] = useState(DEFAULT_COUNTRY_CODE);
  const [number, setNumber] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const once = useSingleFlight();
  const codeRef = useRef<HTMLInputElement>(null);
  const prefix = purpose === 'signup' ? 'signup' : 'login';

  // Countdown for "Resend code".
  useEffect(() => {
    if (state.step !== 'code' || state.resendAt <= Date.now()) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [state.step, state.resendAt]);
  useEffect(() => {
    if (state.step === 'code') codeRef.current?.focus();
  }, [state.step]);

  const finish = async (user: User) => {
    await rememberSignedInUser(user);
    onSignedIn(user, { isNewAccount: purpose === 'signup' });
  };

  const send = () => once(async () => {
    dispatch({ type: 'START' });
    const res = await requestPhoneOtp(defaultAuthDeps(), number, purpose, countryCode);
    if (res.ok) {
      setCode('');
      setNow(Date.now());
      dispatch({ type: 'CODE_SENT', phone: res.phone, now: Date.now() });
    } else dispatch({ type: 'FAIL', errorKey: res.errorKey });
  });

  const verify = () => once(async () => {
    dispatch({ type: 'START' });
    const res = await verifyPhoneCode(defaultAuthDeps(), state.phone, code);
    if (!res.ok) {
      dispatch({ type: 'FAIL', errorKey: res.errorKey });
      return;
    }
    dispatch({ type: 'VERIFIED', user: res.user, needsName: res.needsName });
    if (!res.needsName) await finish(res.user);
  });

  const saveName = () => once(async () => {
    if (!state.pendingUser) return;
    dispatch({ type: 'START' });
    const res = await saveProfileName(defaultAuthDeps(), state.pendingUser, name);
    if (!res.ok) {
      dispatch({ type: 'FAIL', errorKey: res.errorKey });
      return;
    }
    dispatch({ type: 'NAME_SAVED', user: res.user });
    await finish(res.user);
  });

  const secondsLeft = Math.max(0, Math.ceil((state.resendAt - now) / 1000));
  const error = state.errorKey ? <Banner kind="error">{t(state.errorKey)}</Banner> : null;

  if (state.step === 'name') {
    return (
      <form id={`${prefix}-panel`} onSubmit={e => { e.preventDefault(); void saveName(); }} noValidate>
        {state.infoKey && <Banner kind="success">{t(state.infoKey)}</Banner>}
        {error}
        <h2 className="auth-title" style={{ fontSize: 20 }}>{t('auth_name_title')}</h2>
        <div className="auth-field">
          <label className="auth-label" htmlFor={`${prefix}-otp-name`}>{t('auth_name_label')}</label>
          <input id={`${prefix}-otp-name`} className="auth-input" value={name} onChange={e => setName(e.target.value)}
            autoComplete="name" autoFocus aria-invalid={state.errorKey === 'auth_err_name' || undefined} />
        </div>
        <SubmitButton busy={state.busy} label={t('auth_continue')} busyLabel={t('auth_saving')} id={`${prefix}-otp-save-name`} />
      </form>
    );
  }

  if (state.step === 'code') {
    return (
      <form id={`${prefix}-panel`} onSubmit={e => { e.preventDefault(); void verify(); }} noValidate>
        {state.infoKey && <Banner kind="success">{fill(t(state.infoKey), { phone: formatPhoneForDisplay(state.phone) })}</Banner>}
        {error}
        <div className="auth-field">
          <label className="auth-label" htmlFor={`${prefix}-otp-code`}>{t('auth_otp_label')}</label>
          <input
            ref={codeRef}
            id={`${prefix}-otp-code`}
            className="auth-input auth-otp"
            value={code}
            onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            aria-invalid={state.errorKey === 'auth_err_otp_format' || state.errorKey === 'auth_err_wrong_otp' || undefined}
          />
        </div>
        <SubmitButton busy={state.busy} label={t('auth_verify')} busyLabel={t('auth_verifying')} id={`${prefix}-otp-verify`} />
        <div className="auth-row">
          <button type="button" className="auth-link" onClick={() => dispatch({ type: 'EDIT_PHONE' })} disabled={state.busy}>
            {t('auth_change_number')}
          </button>
          <button type="button" className="auth-link" id={`${prefix}-otp-resend`} onClick={() => void send()} disabled={state.busy || secondsLeft > 0}>
            {secondsLeft > 0 ? fill(t('auth_resend_in'), { s: secondsLeft }) : t('auth_resend')}
          </button>
        </div>
      </form>
    );
  }

  return (
    <form id={`${prefix}-panel`} onSubmit={e => { e.preventDefault(); void send(); }} noValidate>
      {error}
      <div className="auth-field">
        <label className="auth-label" htmlFor={`${prefix}-phone`}>{t('auth_phone_label')}</label>
        <div className="auth-phone-row">
          <input
            id={`${prefix}-country-code`}
            className="auth-input"
            value={countryCode}
            onChange={e => setCountryCode(('+' + e.target.value.replace(/[^\d]/g, '')).slice(0, 5))}
            inputMode="tel"
            autoComplete="tel-country-code"
            aria-label={t('auth_country_code')}
          />
          <input
            id={`${prefix}-phone`}
            className="auth-input"
            type="tel"
            value={number}
            onChange={e => setNumber(e.target.value.replace(/[^\d\s+-]/g, ''))}
            inputMode="tel"
            autoComplete="tel-national"
            placeholder="98765 43210"
            aria-invalid={state.errorKey === 'auth_err_phone' || undefined}
            aria-describedby={`${prefix}-phone-hint`}
          />
        </div>
        <p className="auth-hint" id={`${prefix}-phone-hint`}>{t('auth_phone_hint')}</p>
      </div>
      <SubmitButton busy={state.busy} label={t('auth_send_otp')} busyLabel={t('auth_sending_otp')} id={`${prefix}-send-otp`} />
    </form>
  );
}

// ── Email: Create Account ────────────────────────────────────────────────────

function EmailSignUpForm({ t, onSignedIn, onNeedsConfirmation }: {
  t: T; onSignedIn: LoginViewProps['onSignedIn']; onNeedsConfirmation: (email: string) => void;
}) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  // Optional recovery questions, kept on this device only (never the password).
  const [secName, setSecName] = useState('');
  const [secCity, setSecCity] = useState('');
  const [secFriend, setSecFriend] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorKey, setErrorKey] = useState('');
  const once = useSingleFlight();

  const submit = () => once(async () => {
    const answers = [secName.trim(), secCity.trim(), secFriend.trim()];
    if (answers.some(Boolean) && !answers.every(Boolean)) {
      setErrorKey('auth_sec_all_or_none');
      return;
    }
    setBusy(true);
    setErrorKey('');
    const redirect = typeof window !== 'undefined' ? window.location.origin + window.location.pathname : undefined;
    const res = await signUpWithEmail(defaultAuthDeps(), { fullName, email, password, confirmPassword }, redirect);
    if (!res.ok) {
      setBusy(false);
      setErrorKey(res.errorKey);
      return;
    }
    if (answers.every(Boolean)) {
      try {
        localStorage.setItem('mistry_security_questions_' + res.email,
          JSON.stringify({ nameAnswer: answers[0], cityAnswer: answers[1], friendAnswer: answers[2] }));
      } catch { /* storage blocked: the email reset link still works */ }
    }
    if (res.needsConfirmation || !res.user) {
      setBusy(false);
      onNeedsConfirmation(res.email);
      return;
    }
    await rememberSignedInUser(res.user);
    onSignedIn(res.user, { isNewAccount: true });
  });

  const bad = (...keys: string[]) => keys.includes(errorKey) || undefined;
  return (
    <form id="signup-panel" onSubmit={e => { e.preventDefault(); void submit(); }} noValidate>
      {errorKey && <Banner kind="error">{t(errorKey)}</Banner>}
      <div className="auth-field">
        <label className="auth-label" htmlFor="reg-full-name">{t('auth_name_label')}</label>
        <input id="reg-full-name" className="auth-input" value={fullName} onChange={e => setFullName(e.target.value)} autoComplete="name" aria-invalid={bad('auth_err_name')} />
      </div>
      <div className="auth-field">
        <label className="auth-label" htmlFor="reg-email">{t('auth_email_label')}</label>
        <input id="reg-email" className="auth-input" type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" inputMode="email" aria-invalid={bad('auth_err_email', 'auth_err_already_registered')} />
      </div>
      <PasswordField id="reg-password" label={t('auth_password_label')} value={password} onChange={setPassword} autoComplete="new-password" t={t}
        invalid={bad('auth_err_password_short', 'auth_err_password_mix', 'auth_err_password_common', 'auth_err_password_weak')}
        hint={password && passwordProblem(password) ? t(passwordProblem(password) as string) : t('auth_password_rule')} />
      <PasswordField id="reg-confirm-password" label={t('auth_confirm_password_label')} value={confirmPassword} onChange={setConfirmPassword} autoComplete="new-password" t={t}
        invalid={bad('auth_err_password_match')} />
      <details className="auth-details">
        <summary>{t('auth_recovery_optional')}</summary>
        <p className="auth-hint">{t('auth_recovery_hint')}</p>
        <div className="auth-field">
          <label className="auth-label" htmlFor="reg-sec-name">{t('auth_sec_q1')}</label>
          <input id="reg-sec-name" className="auth-input" value={secName} onChange={e => setSecName(e.target.value)} autoComplete="off" />
        </div>
        <div className="auth-field">
          <label className="auth-label" htmlFor="reg-sec-city">{t('auth_sec_q2')}</label>
          <input id="reg-sec-city" className="auth-input" value={secCity} onChange={e => setSecCity(e.target.value)} autoComplete="off" />
        </div>
        <div className="auth-field">
          <label className="auth-label" htmlFor="reg-sec-friend">{t('auth_sec_q3')}</label>
          <input id="reg-sec-friend" className="auth-input" value={secFriend} onChange={e => setSecFriend(e.target.value)} autoComplete="off" />
        </div>
      </details>
      <SubmitButton busy={busy} label={t('auth_create_account')} busyLabel={t('auth_creating')} id="signup-email-submit" />
    </form>
  );
}

// ── Email: Log In ────────────────────────────────────────────────────────────

function EmailLoginForm({ t, onSignedIn, onForgot, initialEmail }: {
  t: T; onSignedIn: LoginViewProps['onSignedIn']; onForgot: (email: string) => void; initialEmail: string;
}) {
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorKey, setErrorKey] = useState('');
  const [resent, setResent] = useState(false);
  const once = useSingleFlight();

  const submit = () => once(async () => {
    setBusy(true);
    setErrorKey('');
    setResent(false);
    const res = await signInWithEmail(defaultAuthDeps(), email, password);
    if (!res.ok) {
      setBusy(false);
      setErrorKey(res.errorKey);
      return;
    }
    await rememberSignedInUser(res.user);
    onSignedIn(res.user, { isNewAccount: false });
  });

  const resend = () => once(async () => {
    setBusy(true);
    const res = await resendSignUpEmail(defaultAuthDeps(), email);
    setBusy(false);
    if (res.ok) {
      setErrorKey('');
      setResent(true);
    } else setErrorKey(res.errorKey);
  });

  return (
    <form id="login-panel" onSubmit={e => { e.preventDefault(); void submit(); }} noValidate>
      {errorKey && (
        <Banner kind="error">
          {t(errorKey)}
          {errorKey === 'auth_err_email_unconfirmed' && (
            <> <button type="button" className="auth-link" onClick={() => void resend()} disabled={busy}>{t('auth_resend_email')}</button></>
          )}
        </Banner>
      )}
      {resent && <Banner kind="success">{t('auth_resent')}</Banner>}
      <div className="auth-field">
        <label className="auth-label" htmlFor="login-identifier">{t('auth_email_label')}</label>
        <input id="login-identifier" className="auth-input" type="email" value={email} onChange={e => setEmail(e.target.value)}
          autoComplete="username" inputMode="email" aria-invalid={errorKey === 'auth_err_email' || undefined} />
      </div>
      <PasswordField id="login-password" label={t('auth_password_label')} value={password} onChange={setPassword} autoComplete="current-password" t={t}
        invalid={errorKey === 'auth_err_password_missing' || errorKey === 'auth_err_wrong_password'} />
      <SubmitButton busy={busy} label={t('auth_log_in')} busyLabel={t('auth_logging_in')} id="login-email-submit" />
      <div className="auth-row" style={{ justifyContent: 'center' }}>
        <button type="button" id="link-forget-password" className="auth-link" onClick={() => onForgot(email)}>{t('auth_forgot')}</button>
      </div>
    </form>
  );
}

// ── Forget Password (email link, or this device's recovery questions) ───────

function ForgotPassword({ t, initialEmail, onVerified, onSent }: {
  t: T; initialEmail: string; onVerified: (email: string) => void; onSent: (email: string) => void;
}) {
  const [email, setEmail] = useState(initialEmail);
  const [secName, setSecName] = useState('');
  const [secCity, setSecCity] = useState('');
  const [secFriend, setSecFriend] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const once = useSingleFlight();

  const sendLink = () => once(async () => {
    if (!isValidEmail(email)) {
      setError(t('auth_err_email'));
      return;
    }
    setBusy(true);
    setError('');
    const res = await requestEmailPasswordReset(email.trim().toLowerCase());
    setBusy(false);
    if (res.success) onSent(email.trim().toLowerCase());
    else setError(res.error || res.message || t('auth_err_generic'));
  });

  const checkAnswers = () => once(async () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!isValidEmail(cleanEmail)) {
      setError(t('auth_err_email'));
      return;
    }
    // Three wrong tries lock the questions for 24 hours on this device.
    const lockoutKey = 'mistry_recovery_lockout_' + cleanEmail;
    let attempts = 0;
    try {
      const stored = JSON.parse(localStorage.getItem(lockoutKey) || 'null') as { attempts?: number; lockedUntil?: number } | null;
      if (stored?.lockedUntil && Date.now() < stored.lockedUntil) {
        setError(t('auth_sec_locked'));
        return;
      }
      attempts = stored?.attempts || 0;
    } catch { /* no lockout recorded */ }

    let saved: { nameAnswer: string; cityAnswer: string; friendAnswer: string } | undefined;
    try {
      const user = await db.users.filter(u => (u.email || '').toLowerCase() === cleanEmail).first();
      saved = user?.securityQuestions;
      if (!saved) saved = JSON.parse(localStorage.getItem('mistry_security_questions_' + cleanEmail) || 'null') || undefined;
    } catch { /* nothing saved */ }
    if (!saved) {
      setError(t('auth_sec_none'));
      return;
    }
    const same = (a: string, b: string) => a.trim().toLowerCase() === (b || '').trim().toLowerCase();
    if (same(secName, saved.nameAnswer) && same(secCity, saved.cityAnswer) && same(secFriend, saved.friendAnswer)) {
      try { localStorage.removeItem(lockoutKey); } catch { /* ignore */ }
      onVerified(cleanEmail);
      return;
    }
    attempts += 1;
    try {
      localStorage.setItem(lockoutKey, JSON.stringify({ attempts, lockedUntil: attempts >= 3 ? Date.now() + 24 * 60 * 60 * 1000 : 0 }));
    } catch { /* ignore */ }
    setError(attempts >= 3 ? t('auth_sec_locked') : `${t('auth_sec_failed')} (${attempts}/3)`);
  });

  return (
    <div id="forgot-panel">
      {error && <Banner kind="error">{error}</Banner>}
      <div className="auth-field">
        <label className="auth-label" htmlFor="forgot-email">{t('auth_email_label')}</label>
        <input id="forgot-email" className="auth-input" type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" inputMode="email" />
      </div>
      <SubmitButton type="button" onClick={() => void sendLink()} busy={busy} label={t('auth_send_reset')} busyLabel={t('auth_sending')} id="forgot-send-link" />
      <details className="auth-details" style={{ marginTop: 16 }}>
        <summary>{t('auth_use_questions')}</summary>
        <form onSubmit={e => { e.preventDefault(); void checkAnswers(); }} noValidate>
          <div className="auth-field">
            <label className="auth-label" htmlFor="forgot-sec-name">{t('auth_sec_q1')}</label>
            <input id="forgot-sec-name" className="auth-input" value={secName} onChange={e => setSecName(e.target.value)} autoComplete="off" />
          </div>
          <div className="auth-field">
            <label className="auth-label" htmlFor="forgot-sec-city">{t('auth_sec_q2')}</label>
            <input id="forgot-sec-city" className="auth-input" value={secCity} onChange={e => setSecCity(e.target.value)} autoComplete="off" />
          </div>
          <div className="auth-field">
            <label className="auth-label" htmlFor="forgot-sec-friend">{t('auth_sec_q3')}</label>
            <input id="forgot-sec-friend" className="auth-input" value={secFriend} onChange={e => setSecFriend(e.target.value)} autoComplete="off" />
          </div>
          <SubmitButton busy={busy} label={t('auth_check_answers')} busyLabel={t('auth_verifying')} variant="secondary" />
        </form>
      </details>
    </div>
  );
}

function ResetPassword({ t, email, onDone }: { t: T; email: string; onDone: (notice: AuthNotice) => void }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorKey, setErrorKey] = useState('');
  const [error, setError] = useState('');
  const once = useSingleFlight();

  const submit = () => once(async () => {
    const problem = passwordProblem(password) ?? (password === confirm ? null : 'auth_err_password_match');
    if (problem) {
      setErrorKey(problem);
      return;
    }
    setBusy(true);
    setErrorKey('');
    setError('');
    try {
      // The password lives in Supabase Auth. It can be changed here only in a recovery session for
      // this email (opened from the reset link); otherwise the reset link is emailed.
      const { data } = isSupabaseConfigured() ? await supabase.auth.getSession() : { data: { session: null } };
      if (data.session?.user?.email?.toLowerCase() === email) {
        const res = await updateSupabasePassword(password);
        if (!res.success) throw new Error(res.error || t('auth_err_generic'));
        onDone({ kind: 'success', key: 'auth_password_updated' });
      } else {
        const res = await requestEmailPasswordReset(email);
        if (!res.success) throw new Error(res.error || res.message);
        onDone({ kind: 'success', key: 'auth_reset_link_sent' });
      }
    } catch (err) {
      setError((err as Error).message || t('auth_err_generic'));
    } finally {
      setBusy(false);
    }
  });

  return (
    <form id="reset-panel" onSubmit={e => { e.preventDefault(); void submit(); }} noValidate>
      <Banner kind="success">{t('auth_sec_passed')}</Banner>
      {(errorKey || error) && <Banner kind="error">{errorKey ? t(errorKey) : error}</Banner>}
      <PasswordField id="reset-new-password" label={t('auth_new_password')} value={password} onChange={setPassword} autoComplete="new-password" t={t} hint={t('auth_password_rule')} />
      <PasswordField id="reset-confirm-password" label={t('auth_confirm_password_label')} value={confirm} onChange={setConfirm} autoComplete="new-password" t={t} />
      <SubmitButton busy={busy} label={t('auth_update_password')} busyLabel={t('auth_updating')} />
    </form>
  );
}

function CheckEmail({ t, email, onLogin }: { t: T; email: string; onLogin: () => void }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; key: string } | null>(null);
  const once = useSingleFlight();
  const resend = () => once(async () => {
    setBusy(true);
    const res = await resendSignUpEmail(defaultAuthDeps(), email);
    setBusy(false);
    setMessage(res.ok ? { kind: 'success', key: 'auth_resent' } : { kind: 'error', key: res.errorKey });
  });
  return (
    <div id="check-email-panel" style={{ textAlign: 'center' }}>
      <MailCheck size={44} color="#16A34A" aria-hidden="true" style={{ margin: '0 auto 10px' }} />
      <h1 className="auth-title">{t('auth_check_email_title')}</h1>
      <p className="auth-sub">{fill(t('auth_check_email_body'), { email })}</p>
      {message && <Banner kind={message.kind}>{t(message.key)}</Banner>}
      <button type="button" className="auth-btn auth-btn-primary" id="check-email-login" onClick={onLogin}>{t('auth_go_login')}</button>
      <SubmitButton type="button" variant="secondary" onClick={() => void resend()} busy={busy} label={t('auth_resend_email')} busyLabel={t('auth_sending')} />
    </div>
  );
}

// ── The screen ───────────────────────────────────────────────────────────────

export const LoginView: React.FC<LoginViewProps> = ({ onSignedIn, notice, initialScreen = 'welcome' }) => {
  const { t, lang, setLang } = useLanguage();
  const online = useOnline();
  const [screen, setScreen] = useState<AuthScreen>(initialScreen);
  const [method, setMethod] = useState<'phone' | 'email'>('phone');
  const [email, setEmail] = useState('');
  const [screenNotice, setScreenNotice] = useState<AuthNotice | null>(notice ?? null);
  const configured = isSupabaseConfigured();

  const go = (next: AuthScreen) => {
    setScreen(next);
    setScreenNotice(null);
    if (typeof window !== 'undefined') window.scrollTo?.(0, 0);
  };
  const back = () => go(screen === 'forgot' || screen === 'reset' ? 'login' : 'welcome');

  const topBar = (
    <div className="auth-topbar">
      {screen !== 'welcome' && (
        <button type="button" className="auth-icon-btn" onClick={back} id="auth-back">
          <ArrowLeft size={20} aria-hidden="true" /> {t('auth_back')}
        </button>
      )}
      <div className="auth-lang" role="group" aria-label={t('auth_language')}>
        <button type="button" aria-pressed={lang === 'en'} onClick={() => setLang('en')} lang="en">EN</button>
        <button type="button" aria-pressed={lang === 'ta'} onClick={() => setLang('ta')} lang="ta">தமிழ்</button>
      </div>
    </div>
  );

  const statusBanners = (
    <>
      {!online && <Banner kind="warning">{t('auth_offline_note')}</Banner>}
      {online && !configured && <Banner kind="warning">{t('auth_err_not_configured')}</Banner>}
      {screenNotice && <Banner kind={screenNotice.kind}>{t(screenNotice.key)}</Banner>}
    </>
  );

  let body: React.ReactNode;
  if (screen === 'welcome') {
    body = (
      <>
        <div className="auth-hero">
          <BrandLogo size={72} stacked />
          <p className="auth-tagline">{t('auth_tagline')}</p>
        </div>
        {statusBanners}
        <ul className="auth-points">
          <li><HardHat size={20} aria-hidden="true" />{t('auth_point_labour')}</li>
          <li><Package size={20} aria-hidden="true" />{t('auth_point_stock')}</li>
          <li><ReceiptIndianRupee size={20} aria-hidden="true" />{t('auth_point_money')}</li>
        </ul>
        <div className="auth-actions">
          <button type="button" id="welcome-create-account" className="auth-btn auth-btn-primary" onClick={() => go('signup')}>
            {t('auth_create_account')}
          </button>
          <button type="button" id="welcome-log-in" className="auth-btn auth-btn-secondary" onClick={() => go('login')}>
            {t('auth_log_in')}
          </button>
        </div>
      </>
    );
  } else if (screen === 'signup' || screen === 'login') {
    const isSignup = screen === 'signup';
    body = (
      <div className="auth-card">
        <h1 className="auth-title">{t(isSignup ? 'auth_create_title' : 'auth_login_title')}</h1>
        <p className="auth-sub">{t(isSignup ? 'auth_create_sub' : 'auth_login_sub')}</p>
        {statusBanners}
        <MethodTabs method={method} onChange={setMethod} t={t} idPrefix={isSignup ? 'signup' : 'login'} />
        {method === 'phone'
          ? <PhoneOtpForm key={screen} purpose={isSignup ? 'signup' : 'login'} t={t} onSignedIn={onSignedIn} />
          : isSignup
            ? <EmailSignUpForm t={t} onSignedIn={onSignedIn} onNeedsConfirmation={addr => { setEmail(addr); go('check-email'); }} />
            : <EmailLoginForm t={t} onSignedIn={onSignedIn} initialEmail={email} onForgot={addr => { setEmail(addr); go('forgot'); }} />}
        <p className="auth-foot">
          {t(isSignup ? 'auth_have_account' : 'auth_new_here')}{' '}
          {isSignup
            ? <button type="button" id="link-log-in" className="auth-link" onClick={() => go('login')}>{t('auth_log_in')}</button>
            : <button type="button" id="link-create-account" className="auth-link" onClick={() => go('signup')}>{t('auth_create_new_account')}</button>}
        </p>
      </div>
    );
  } else if (screen === 'forgot') {
    body = (
      <div className="auth-card">
        <h1 className="auth-title">{t('auth_forgot_title')}</h1>
        <p className="auth-sub">{t('auth_forgot_sub')}</p>
        {statusBanners}
        <ForgotPassword
          t={t}
          initialEmail={email}
          onVerified={addr => { setEmail(addr); go('reset'); }}
          onSent={addr => { setEmail(addr); setMethod('email'); setScreen('login'); setScreenNotice({ kind: 'success', key: 'auth_reset_link_sent' }); }}
        />
      </div>
    );
  } else if (screen === 'reset') {
    body = (
      <div className="auth-card">
        <h1 className="auth-title">{t('auth_reset_title')}</h1>
        {statusBanners}
        <ResetPassword t={t} email={email} onDone={n => { setMethod('email'); setScreen('login'); setScreenNotice(n); }} />
      </div>
    );
  } else {
    body = (
      <div className="auth-card">
        <CheckEmail t={t} email={email} onLogin={() => { setMethod('email'); go('login'); }} />
      </div>
    );
  }

  return (
    <div className="auth-screen" lang={lang === 'ta' ? 'ta' : 'en'}>
      {topBar}
      <main className="auth-main">{body}</main>
    </div>
  );
};

export default LoginView;
