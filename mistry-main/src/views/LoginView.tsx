import React, { useState } from 'react';
import {
  HardHat,
  Eye,
  EyeOff,
  Lock,
  User,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  KeyRound,
  Mail,
  AlertCircle,
  HelpCircle,
  ArrowLeft,
  Sparkles,
  Smartphone,
  Phone,
} from 'lucide-react';
import {
  loginUser,
  registerUser,
  resendConfirmationEmail,
  setCurrentUser,
  sendPhoneOtp,
  verifyPhoneOtp,
  signInWithGoogle,
} from '../services/auth';
import { performFullSync } from '../services/cloudSyncService';
import { requestEmailPasswordReset } from '../services/emailRecoveryService';
import { db } from '../db/db';
import type { User as UserType } from '../db/types';

interface LoginViewProps {
  onLoginSuccess: (user: UserType) => void;
}

type AuthMode = 'login' | 'register' | 'forget_password' | 'reset_password';

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess }) => {
  const [mode, setMode] = useState<AuthMode>('login');

  // Login credentials
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);

  // Phone OTP login states
  const [loginMethod, setLoginMethod] = useState<'phone' | 'email'>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpRole, setOtpRole] = useState<'contractor' | 'engineer'>('contractor');
  const [otpFullName, setOtpFullName] = useState('');

  // Registration fields
  const [regFullName, setRegFullName] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regMobile, setRegMobile] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');

  // 3 Pre-set Security Questions for Account Creation
  // 1. "What is your name?"
  // 2. "Which city are you in?"
  // 3. "Who is your friend?"
  const [regSecName, setRegSecName] = useState('');
  const [regSecCity, setRegSecCity] = useState('');
  const [regSecFriend, setRegSecFriend] = useState('');

  // Forget Password Verification fields
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSecName, setForgotSecName] = useState('');
  const [forgotSecCity, setForgotSecCity] = useState('');
  const [forgotSecFriend, setForgotSecFriend] = useState('');
  const [verifiedEmail, setVerifiedEmail] = useState('');

  // Reset Password fields (post-verification)
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);

  // Feedback states
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [loading, setLoading] = useState(false);

  // Helper to switch modes cleanly
  const switchMode = (newMode: AuthMode) => {
    setMode(newMode);
    setError('');
    setSuccessMessage('');
  };

  // Direct Super Admin shortcut for development/admin portal
  const handleSuperAdminDirectLogin = async () => {
    setLoading(true);
    setError('');
    try {
      const superUser: UserType = {
        id: 'super-admin-tamizh',
        username: 'tamizh',
        fullName: 'Tamizh (Super Admin)',
        email: 'tamilthilagan82@gmail.com',
        mobile: '9876543210',
        passwordHash: 'tamizh406@##',
        securityQuestions: {
          nameAnswer: 'Tamizh',
          cityAnswer: 'Chennai',
          friendAnswer: 'Mistry',
        },
        role: 'SUPER_ADMIN',
        permissions: {
          projects: { read: true, write: true },
          labour: { read: true, write: true },
          payroll: { read: true, write: true },
          materials: { read: true, write: true },
          expenses: { read: true, write: true },
          floor_plans: { read: true, write: true },
          estimates: { read: true, write: true },
          admin: { read: true, write: true },
        },
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await db.users.put(superUser);
      localStorage.setItem('mistry_security_questions_' + superUser.email.toLowerCase(), JSON.stringify(superUser.securityQuestions));
      setCurrentUser(superUser, true);
      onLoginSuccess(superUser);
    } catch (err: any) {
      setError('Super Admin login error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Google OAuth Sign In
  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError('');
    const res = await signInWithGoogle();
    if (!res.success) {
      setError(res.error || 'Failed to initialize Google Sign In');
      setLoading(false);
    }
  };

  // Send Phone OTP
  const handleSendPhoneOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanDigits = phone.replace(/\D/g, '');
    if (cleanDigits.length < 10) {
      setError('Please enter a valid 10-digit mobile number.');
      return;
    }
    setLoading(true);
    setError('');
    setSuccessMessage('');

    const res = await sendPhoneOtp(phone);
    setLoading(false);
    if (res.success) {
      setOtpSent(true);
      setSuccessMessage(`OTP sent to +91 ${cleanDigits.slice(-10)}. Please enter the 6-digit code below.`);
    } else {
      setError(res.error || 'Failed to send OTP to mobile. Please check number or continue with Google.');
    }
  };

  // Verify Phone OTP
  const handleVerifyPhoneOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanOtp = otp.trim();
    if (!cleanOtp || cleanOtp.length < 6) {
      setError('Please enter the 6-digit verification code.');
      return;
    }
    setLoading(true);
    setError('');
    setSuccessMessage('');

    const res = await verifyPhoneOtp(phone, cleanOtp, otpRole, otpFullName);
    setLoading(false);
    if (res.success && res.user) {
      onLoginSuccess(res.user);
    } else {
      setError(res.error || 'Invalid OTP code. Please try again or request a new code.');
    }
  };

  // 1. LOGIN HANDLER
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = identifier.trim();
    if (!cleanId) {
      setError('Please enter your email ID.');
      return;
    }
    if (!password) {
      setError('Please enter your password.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      // Super Admin direct login shortcut
      if (
        cleanId.toLowerCase() === 'tamilthilagan82@gmail.com' &&
        password === 'tamizh406@##'
      ) {
        await handleSuperAdminDirectLogin();
        return;
      }

      // Check local user database first (for users created with security questions)
      const localMatch = await db.users
        .filter(u => u.email.toLowerCase() === cleanId.toLowerCase() || u.username.toLowerCase() === cleanId.toLowerCase())
        .first();

      if (localMatch && localMatch.passwordHash === password) {
        setCurrentUser(localMatch, remember);
        onLoginSuccess(localMatch);
        return;
      }

      // Supabase cloud login
      const res = await loginUser(cleanId, password, remember);
      if (res.success && res.user) {
        onLoginSuccess(res.user);
      } else {
        const rawErr = res.error || 'Login failed.';
        if (rawErr.toLowerCase().includes('email not confirmed')) {
          setError('Email not confirmed. Check your inbox/spam or click Resend below.');
        } else if (rawErr.toLowerCase().includes('invalid login credentials')) {
          setError('Invalid email ID or password. Please verify your credentials or click "Forget Password".');
        } else {
          setError(rawErr);
        }
      }
    } catch (err: any) {
      setError('Authentication error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // 2. CREATE NEW ACCOUNT HANDLER
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = regEmail.trim().toLowerCase();
    const cleanUser = regUsername.trim().toLowerCase();
    const cleanName = regFullName.trim();

    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError('Please enter a valid email ID.');
      return;
    }
    if (!cleanUser || cleanUser.length < 3) {
      setError('Username must be at least 3 characters.');
      return;
    }
    if (!regPassword || regPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (regPassword !== regConfirmPassword) {
      setError('Passwords do not match. Please verify both password fields.');
      return;
    }

    // Security Questions Validation
    const nameAns = regSecName.trim();
    const cityAns = regSecCity.trim();
    const friendAns = regSecFriend.trim();

    if (!nameAns || !cityAns || !friendAns) {
      setError('Please answer all 3 security questions. They are required to recover your password if forgotten.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      // Check if email already exists locally
      const existing = await db.users.filter(u => u.email.toLowerCase() === cleanEmail).first();
      if (existing) {
        setError('An account with this email ID already exists. Please sign in or use "Forget Password".');
        setLoading(false);
        return;
      }

      const securityQuestions = {
        nameAnswer: nameAns,
        cityAnswer: cityAns,
        friendAnswer: friendAns,
      };

      const newUser: UserType = {
        id: 'usr_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        username: cleanUser,
        fullName: cleanName || cleanUser,
        email: cleanEmail,
        mobile: regMobile.trim() || '9876543210',
        passwordHash: regPassword,
        securityQuestions,
        role: 'MISTRY_USER',
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Save to local IndexedDB and localStorage
      await db.users.put(newUser);
      localStorage.setItem('mistry_security_questions_' + cleanEmail, JSON.stringify(securityQuestions));

      // Attempt Supabase cloud registration as well
      try {
        await registerUser(cleanUser, cleanName, regMobile.trim(), cleanEmail, regPassword);
      } catch {
        // Cloud registration optional; local account ready
      }

      setSuccessMessage('Account created successfully with your 3 security questions! Please sign in with your email ID.');
      setIdentifier(cleanEmail);
      setMode('login');
    } catch (err: any) {
      setError('Registration error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // 3. FORGET PASSWORD VERIFICATION HANDLER
  const handleVerifySecurityQuestions = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = forgotEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError('Please enter your registered email ID.');
      return;
    }

    // Check 24-hour lockout status after 3 failed attempts
    const lockoutKey = 'mistry_recovery_lockout_' + cleanEmail;
    const storedLockout = localStorage.getItem(lockoutKey);
    if (storedLockout) {
      try {
        const { attempts, lockedUntil } = JSON.parse(storedLockout);
        if (lockedUntil && Date.now() < lockedUntil) {
          const remainingHours = Math.ceil((lockedUntil - Date.now()) / (1000 * 60 * 60));
          setError(`Account recovery is temporarily locked due to 3 consecutive failed verification attempts. Please try again after ${remainingHours} hour(s) or use verified email recovery.`);
          return;
        }
      } catch {}
    }

    const nameAns = forgotSecName.trim().toLowerCase();
    const cityAns = forgotSecCity.trim().toLowerCase();
    const friendAns = forgotSecFriend.trim().toLowerCase();

    if (!nameAns || !cityAns || !friendAns) {
      setError('Please answer all three security questions to verify your identity.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      // Lookup user in local database
      let user = await db.users.filter(u => u.email.toLowerCase() === cleanEmail).first();

      // Fallback for super-admin or cached questions
      let storedSec = user?.securityQuestions;
      if (!storedSec) {
        const storedJson = localStorage.getItem('mistry_security_questions_' + cleanEmail);
        if (storedJson) {
          try { storedSec = JSON.parse(storedJson); } catch {}
        }
      }

      if (!storedSec && cleanEmail === 'tamilthilagan82@gmail.com') {
        storedSec = {
          nameAnswer: 'Tamizh',
          cityAnswer: 'Chennai',
          friendAnswer: 'Mistry',
        };
      }

      if (!storedSec) {
        setError('No security questions registered for this email ID. Please contact support or use email reset.');
        setLoading(false);
        return;
      }

      // Exact check for all 3 questions
      const matchesQ1 = nameAns === storedSec.nameAnswer.trim().toLowerCase();
      const matchesQ2 = cityAns === storedSec.cityAnswer.trim().toLowerCase();
      const matchesQ3 = friendAns === storedSec.friendAnswer.trim().toLowerCase();

      if (matchesQ1 && matchesQ2 && matchesQ3) {
        // Verification succeeded! Allow password reset.
        localStorage.removeItem(lockoutKey);
        setVerifiedEmail(cleanEmail);
        setSuccessMessage('Security verification passed! Please set your new password below.');
        setMode('reset_password');
      } else {
        // Verification failed! Enforce temporary lockout after 3 consecutive failures
        let currentAttempts = 0;
        if (storedLockout) {
          try {
            const parsed = JSON.parse(storedLockout);
            currentAttempts = parsed.attempts || 0;
          } catch {}
        }
        currentAttempts += 1;
        if (currentAttempts >= 3) {
          const lockedUntil = Date.now() + 24 * 60 * 60 * 1000; // 24-hour lockout
          localStorage.setItem(lockoutKey, JSON.stringify({ attempts: currentAttempts, lockedUntil }));
          setError('Security verification failed: 3 consecutive incorrect attempts. Account recovery has been locked for 24 hours to protect your account.');
        } else {
          localStorage.setItem(lockoutKey, JSON.stringify({ attempts: currentAttempts, lockedUntil: 0 }));
          setError(`Security verification failed: Incorrect answers to security questions (Attempt ${currentAttempts} of 3). After 3 failed attempts, account recovery will be locked for 24 hours.`);
        }
      }
    } catch (err: any) {
      setError('Verification error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // 3B. EMAIL PASSWORD RESET LINK HANDLER (Alternative secure recovery)
  const handleSendEmailReset = async () => {
    const cleanEmail = forgotEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError('Please enter your email ID above first to receive the reset link.');
      return;
    }
    setLoading(true);
    setError('');
    setSuccessMessage('');
    try {
      const res = await requestEmailPasswordReset(cleanEmail);
      if (res.success) {
        setSuccessMessage(res.message);
      } else {
        setError(res.error || res.message);
      }
    } catch (err: any) {
      setError('Could not send reset email: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // 4. RESET PASSWORD HANDLER
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetNewPassword || resetNewPassword.length < 8) {
      setError('New password must be at least 8 characters.');
      return;
    }
    if (resetNewPassword !== resetConfirmPassword) {
      setError('Passwords do not match. Please re-enter both password fields.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const cleanEmail = verifiedEmail.toLowerCase();
      const user = await db.users.filter(u => u.email.toLowerCase() === cleanEmail).first();

      if (user) {
        user.passwordHash = resetNewPassword;
        user.updatedAt = new Date().toISOString();
        await db.users.put(user);
      }

      setSuccessMessage('Password reset successfully! You can now log in with your new password.');
      setIdentifier(cleanEmail);
      setPassword('');
      setMode('login');
    } catch (err: any) {
      setError('Failed to update password: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f8fafc',
        padding: '24px 16px',
        position: 'relative',
        overflow: 'hidden',
        fontFamily: "'Outfit', system-ui, -apple-system, sans-serif",
      }}
    >
      {/* Background Ambience / Subtle Architectural Glow */}
      <div
        style={{
          position: 'absolute',
          top: '-15%',
          right: '-10%',
          width: '500px',
          height: '500px',
          background: 'radial-gradient(circle, rgba(245, 158, 11, 0.08) 0%, rgba(245, 158, 11, 0) 70%)',
          borderRadius: '50%',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: '-15%',
          left: '-10%',
          width: '450px',
          height: '450px',
          background: 'radial-gradient(circle, rgba(15, 23, 42, 0.06) 0%, rgba(15, 23, 42, 0) 70%)',
          borderRadius: '50%',
          pointerEvents: 'none',
        }}
      />

      {/* Main Auth Card */}
      <div
        style={{
          width: '100%',
          maxWidth: mode === 'register' ? '540px' : '440px',
          backgroundColor: '#ffffff',
          borderRadius: '20px',
          padding: '36px 32px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 20px 45px -15px rgba(15, 23, 42, 0.12), 0 0 1px 1px rgba(15, 23, 42, 0.02)',
          position: 'relative',
          zIndex: 10,
          transition: 'max-width 0.25s ease',
        }}
      >
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div
            style={{
              width: '60px',
              height: '60px',
              borderRadius: '16px',
              background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
              border: '2px solid #f59e0b',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#f59e0b',
              boxShadow: '0 8px 20px rgba(15, 23, 42, 0.18)',
              marginBottom: '14px',
            }}
          >
            <HardHat size={32} strokeWidth={2.4} />
          </div>

          <h2
            style={{
              fontSize: '1.65rem',
              fontWeight: 800,
              color: '#0f172a',
              letterSpacing: '-0.02em',
              margin: '0 0 4px',
            }}
          >
            Building Mistry
          </h2>
          <p style={{ fontSize: '0.86rem', color: '#64748b', margin: 0, fontWeight: 500 }}>
            {mode === 'login'
              ? 'Plan Better. Build Smarter. • Architectural Planning & Construction Platform'
              : mode === 'register'
              ? 'Create New Account with Security Verification'
              : mode === 'forget_password'
              ? 'Security Question Verification & Account Recovery'
              : 'Set New Password'}
          </p>
        </div>

        {/* Error Notification Alert */}
        {error && (
          <div
            role="alert"
            style={{
              backgroundColor: '#fee2e2',
              color: '#991b1b',
              border: '1px solid #fecaca',
              padding: '12px 14px',
              borderRadius: '10px',
              fontSize: '0.85rem',
              fontWeight: 600,
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
              lineHeight: 1.4,
            }}
          >
            <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>{error}</div>
          </div>
        )}

        {/* Success Notification Alert */}
        {successMessage && (
          <div
            role="status"
            style={{
              backgroundColor: '#ecfdf5',
              color: '#065f46',
              border: '1px solid #a7f3d0',
              padding: '12px 14px',
              borderRadius: '10px',
              fontSize: '0.85rem',
              fontWeight: 600,
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
              lineHeight: 1.4,
            }}
          >
            <CheckCircle2 size={18} style={{ flexShrink: 0, marginTop: '2px', color: '#10b981' }} />
            <div>{successMessage}</div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* 1. LOGIN FORM                                                */}
        {/* ══════════════════════════════════════════════════════════════ */}
        {mode === 'login' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Continue with Google Button */}
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              id="btn-google-signin"
              style={{
                width: '100%',
                padding: '11px 16px',
                borderRadius: '10px',
                border: '1.5px solid #cbd5e1',
                backgroundColor: '#ffffff',
                color: '#1e293b',
                fontSize: '0.92rem',
                fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                transition: 'all 0.15s ease',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Continue with Google</span>
            </button>

            {/* Divider */}
            <div style={{ display: 'flex', alignItems: 'center', margin: '2px 0', gap: '12px' }}>
              <div style={{ flex: 1, height: '1px', backgroundColor: '#e2e8f0' }} />
              <span style={{ fontSize: '0.74rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>
                or choose sign in method
              </span>
              <div style={{ flex: 1, height: '1px', backgroundColor: '#e2e8f0' }} />
            </div>

            {/* Login Method Tabs */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', backgroundColor: '#f1f5f9', padding: '4px', borderRadius: '10px' }}>
              <button
                type="button"
                onClick={() => setLoginMethod('phone')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: 'none',
                  fontSize: '0.84rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  backgroundColor: loginMethod === 'phone' ? '#ffffff' : 'transparent',
                  color: loginMethod === 'phone' ? '#0f172a' : '#64748b',
                  boxShadow: loginMethod === 'phone' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                }}
              >
                <Smartphone size={16} />
                <span>Phone OTP</span>
              </button>
              <button
                type="button"
                onClick={() => setLoginMethod('email')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: 'none',
                  fontSize: '0.84rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  backgroundColor: loginMethod === 'email' ? '#ffffff' : 'transparent',
                  color: loginMethod === 'email' ? '#0f172a' : '#64748b',
                  boxShadow: loginMethod === 'email' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                }}
              >
                <Mail size={16} />
                <span>Email ID</span>
              </button>
            </div>

            {loginMethod === 'phone' ? (
              !otpSent ? (
                <form onSubmit={handleSendPhoneOtp} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label htmlFor="login-phone" style={{ fontWeight: 700, fontSize: '0.84rem', color: '#334155', marginBottom: '6px', display: 'block' }}>
                      Mobile Phone Number
                    </label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '0 12px',
                          backgroundColor: '#f8fafc',
                          border: '1px solid #cbd5e1',
                          borderRadius: '10px',
                          fontWeight: 700,
                          fontSize: '0.9rem',
                          color: '#334155',
                        }}
                      >
                        <span>🇮🇳 +91</span>
                      </div>
                      <input
                        id="login-phone"
                        type="tel"
                        inputMode="numeric"
                        placeholder="10-digit mobile number"
                        value={phone}
                        onChange={e => setPhone(e.target.value)}
                        maxLength={15}
                        style={{
                          flex: 1,
                          padding: '11px 14px',
                          borderRadius: '10px',
                          border: '1px solid #cbd5e1',
                          fontSize: '0.92rem',
                          color: '#0f172a',
                          outline: 'none',
                        }}
                        autoFocus
                      />
                    </div>
                    <span style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '4px', display: 'block' }}>
                      We will send a 6-digit verification code via SMS.
                    </span>
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label style={{ fontWeight: 700, fontSize: '0.84rem', color: '#334155', marginBottom: '6px', display: 'block' }}>
                      Select Your Role
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => setOtpRole('contractor')}
                        style={{
                          padding: '8px 12px',
                          borderRadius: '8px',
                          border: otpRole === 'contractor' ? '2px solid #0284c7' : '1px solid #cbd5e1',
                          backgroundColor: otpRole === 'contractor' ? '#f0f9ff' : '#ffffff',
                          color: otpRole === 'contractor' ? '#0284c7' : '#475569',
                          fontWeight: 700,
                          fontSize: '0.82rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                        }}
                      >
                        <span>🔨 Contractor / Mastri</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setOtpRole('engineer')}
                        style={{
                          padding: '8px 12px',
                          borderRadius: '8px',
                          border: otpRole === 'engineer' ? '2px solid #0284c7' : '1px solid #cbd5e1',
                          backgroundColor: otpRole === 'engineer' ? '#f0f9ff' : '#ffffff',
                          color: otpRole === 'engineer' ? '#0284c7' : '#475569',
                          fontWeight: 700,
                          fontSize: '0.82rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                        }}
                      >
                        <span>📐 Engineer / Architect</span>
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    id="btn-send-otp"
                    style={{
                      width: '100%',
                      padding: '12px 18px',
                      borderRadius: '10px',
                      border: 'none',
                      background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                      color: '#ffffff',
                      fontSize: '0.94rem',
                      fontWeight: 700,
                      cursor: loading ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      boxShadow: '0 4px 12px rgba(2, 132, 199, 0.25)',
                      marginTop: '4px',
                    }}
                  >
                    <span>{loading ? 'Sending OTP...' : 'Send Verification OTP'}</span>
                    <ArrowRight size={18} />
                  </button>
                </form>
              ) : (
                <form onSubmit={handleVerifyPhoneOtp} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div
                    style={{
                      backgroundColor: '#f0f9ff',
                      border: '1px solid #bae6fd',
                      borderRadius: '8px',
                      padding: '10px 12px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: '0.82rem',
                    }}
                  >
                    <span style={{ color: '#0369a1', fontWeight: 600 }}>
                      Code sent to +91 {phone.replace(/\D/g, '').slice(-10)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setOtpSent(false)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#0284c7',
                        fontWeight: 700,
                        cursor: 'pointer',
                        padding: 0,
                        textDecoration: 'underline',
                      }}
                    >
                      Change
                    </button>
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label htmlFor="login-otp-code" style={{ fontWeight: 700, fontSize: '0.84rem', color: '#334155', marginBottom: '6px', display: 'block' }}>
                      Enter 6-Digit OTP Code
                    </label>
                    <input
                      id="login-otp-code"
                      type="text"
                      inputMode="numeric"
                      placeholder="• • • • • •"
                      value={otp}
                      onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      maxLength={6}
                      style={{
                        width: '100%',
                        padding: '12px 14px',
                        borderRadius: '10px',
                        border: '2px solid #0284c7',
                        fontSize: '1.25rem',
                        fontWeight: 800,
                        letterSpacing: '8px',
                        textAlign: 'center',
                        color: '#0f172a',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                      autoFocus
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label htmlFor="login-otp-name" style={{ fontWeight: 700, fontSize: '0.8rem', color: '#64748b', marginBottom: '4px', display: 'block' }}>
                      Your Full Name (Optional)
                    </label>
                    <input
                      id="login-otp-name"
                      type="text"
                      placeholder="e.g. Ramesh Kumar"
                      value={otpFullName}
                      onChange={e => setOtpFullName(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        fontSize: '0.88rem',
                        color: '#0f172a',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    id="btn-verify-otp"
                    style={{
                      width: '100%',
                      padding: '12px 18px',
                      borderRadius: '10px',
                      border: 'none',
                      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                      color: '#ffffff',
                      fontSize: '0.94rem',
                      fontWeight: 700,
                      cursor: loading ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)',
                      marginTop: '4px',
                    }}
                  >
                    <span>{loading ? 'Verifying OTP...' : 'Verify OTP & Open Dashboard'}</span>
                    <CheckCircle2 size={18} />
                  </button>

                  <div style={{ textAlign: 'center', marginTop: '4px' }}>
                    <button
                      type="button"
                      onClick={handleSendPhoneOtp}
                      disabled={loading}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#64748b',
                        fontSize: '0.82rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        textDecoration: 'underline',
                      }}
                    >
                      Didn't receive code? Resend OTP
                    </button>
                  </div>
                </form>
              )
            ) : (
              <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label htmlFor="login-identifier" style={{ fontWeight: 700, fontSize: '0.84rem', color: '#334155', marginBottom: '6px', display: 'block' }}>
                    Email ID
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Mail
                      size={18}
                      style={{
                        position: 'absolute',
                        left: '14px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: '#94a3b8',
                      }}
                    />
                    <input
                      id="login-identifier"
                      name="email"
                      type="email"
                      placeholder="Enter your email ID (e.g. user@example.com)"
                      value={identifier}
                      onChange={e => setIdentifier(e.target.value)}
                      autoComplete="username"
                      style={{
                        width: '100%',
                        padding: '11px 14px 11px 42px',
                        borderRadius: '10px',
                        border: '1px solid #cbd5e1',
                        fontSize: '0.9rem',
                        color: '#0f172a',
                        outline: 'none',
                        boxSizing: 'border-box',
                        transition: 'border-color 0.15s ease',
                      }}
                      autoFocus
                    />
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label htmlFor="login-password" style={{ fontWeight: 700, fontSize: '0.84rem', color: '#334155', marginBottom: '6px', display: 'block' }}>
                    Password
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Lock
                      size={18}
                      style={{
                        position: 'absolute',
                        left: '14px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: '#94a3b8',
                      }}
                    />
                    <input
                      id="login-password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter your password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      autoComplete="current-password"
                      style={{
                        width: '100%',
                        padding: '11px 42px 11px 42px',
                        borderRadius: '10px',
                        border: '1px solid #cbd5e1',
                        fontSize: '0.9rem',
                        color: '#0f172a',
                        outline: 'none',
                        boxSizing: 'border-box',
                        transition: 'border-color 0.15s ease',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{
                        position: 'absolute',
                        right: '12px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        color: '#64748b',
                        cursor: 'pointer',
                        padding: '4px',
                      }}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                {/* Remember Me & Forget Password Link */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '8px',
                    fontSize: '0.84rem',
                    marginTop: '2px',
                  }}
                >
                  <label
                    htmlFor="login-remember"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      cursor: 'pointer',
                      color: '#475569',
                      userSelect: 'none',
                      fontWeight: 500,
                    }}
                  >
                    <input
                      id="login-remember"
                      name="remember"
                      type="checkbox"
                      checked={remember}
                      onChange={e => setRemember(e.target.checked)}
                      style={{ width: '16px', height: '16px', accentColor: '#f59e0b', cursor: 'pointer' }}
                    />
                    <span>Remember me</span>
                  </label>

                  <button
                    type="button"
                    id="link-forget-password"
                    onClick={() => {
                      setForgotEmail(identifier);
                      switchMode('forget_password');
                    }}
                    style={{
                      color: '#d97706',
                      fontWeight: 700,
                      fontSize: '0.84rem',
                      border: 'none',
                      background: 'none',
                      cursor: 'pointer',
                      padding: '2px 0',
                      textDecoration: 'underline',
                      textUnderlineOffset: '3px',
                    }}
                  >
                    Forget Password
                  </button>
                </div>

                {/* Sign In Submit Button */}
                <button
                  type="submit"
                  disabled={loading}
                  id="btn-login-submit"
                  style={{
                    width: '100%',
                    padding: '12px 18px',
                    borderRadius: '10px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                    color: '#ffffff',
                    fontSize: '0.94rem',
                    fontWeight: 700,
                    cursor: loading ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 12px rgba(15, 23, 42, 0.18)',
                    marginTop: '4px',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <span>{loading ? 'Signing in...' : 'Sign In'}</span>
                  <ArrowRight size={18} />
                </button>
              </form>
            )}

            {/* Create New Account Link */}
            <div style={{ textAlign: 'center', marginTop: '4px' }}>
              <span style={{ fontSize: '0.86rem', color: '#64748b', marginRight: '6px' }}>Don't have an account?</span>
              <button
                type="button"
                id="link-create-account"
                onClick={() => switchMode('register')}
                style={{
                  color: '#2563eb',
                  fontWeight: 700,
                  fontSize: '0.86rem',
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  padding: 0,
                  textDecoration: 'underline',
                  textUnderlineOffset: '3px',
                }}
              >
                Create New Account
              </button>
            </div>

            {/* Super Admin Quick Credentials Hint */}
            <div
              style={{
                borderTop: '1px solid #f1f5f9',
                paddingTop: '14px',
                marginTop: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                fontSize: '0.76rem',
                color: '#64748b',
              }}
            >
              <ShieldCheck size={14} color="#6366f1" />
              <span>Super Admin Portal: Sign in with registered administrator credentials above</span>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* 2. CREATE NEW ACCOUNT FORM (WITH 3 SECURITY QUESTIONS)         */}
        {/* ══════════════════════════════════════════════════════════════ */}
        {mode === 'register' && (
          <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label htmlFor="reg-fullname" style={{ fontWeight: 700, fontSize: '0.8rem', color: '#334155', marginBottom: '4px', display: 'block' }}>
                  Full Name
                </label>
                <input
                  id="reg-fullname"
                  name="name"
                  type="text"
                  placeholder="Your full name"
                  value={regFullName}
                  onChange={e => setRegFullName(e.target.value)}
                  autoComplete="name"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.86rem',
                    boxSizing: 'border-box',
                  }}
                  autoFocus
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label htmlFor="reg-username" style={{ fontWeight: 700, fontSize: '0.8rem', color: '#334155', marginBottom: '4px', display: 'block' }}>
                  Username <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  id="reg-username"
                  name="username"
                  type="text"
                  placeholder="Choose username"
                  value={regUsername}
                  onChange={e => setRegUsername(e.target.value)}
                  autoComplete="username"
                  required
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.86rem',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '12px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label htmlFor="reg-email" style={{ fontWeight: 700, fontSize: '0.8rem', color: '#334155', marginBottom: '4px', display: 'block' }}>
                  Email ID <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  id="reg-email"
                  name="email"
                  type="email"
                  required
                  placeholder="you@example.com"
                  value={regEmail}
                  onChange={e => setRegEmail(e.target.value)}
                  autoComplete="email"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.86rem',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label htmlFor="reg-mobile" style={{ fontWeight: 700, fontSize: '0.8rem', color: '#334155', marginBottom: '4px', display: 'block' }}>
                  Mobile Number
                </label>
                <input
                  id="reg-mobile"
                  name="tel"
                  type="tel"
                  placeholder="10-digit mobile"
                  value={regMobile}
                  onChange={e => setRegMobile(e.target.value)}
                  autoComplete="tel"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.86rem',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label htmlFor="reg-password" style={{ fontWeight: 700, fontSize: '0.8rem', color: '#334155', marginBottom: '4px', display: 'block' }}>
                  Password <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  id="reg-password"
                  name="new-password"
                  type="password"
                  required
                  placeholder="Min 8 characters"
                  value={regPassword}
                  onChange={e => setRegPassword(e.target.value)}
                  autoComplete="new-password"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.86rem',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label htmlFor="reg-confirm-password" style={{ fontWeight: 700, fontSize: '0.8rem', color: '#334155', marginBottom: '4px', display: 'block' }}>
                  Confirm Password <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  id="reg-confirm-password"
                  type="password"
                  required
                  placeholder="Re-enter password"
                  value={regConfirmPassword}
                  onChange={e => setRegConfirmPassword(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.86rem',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            {/* 3 PRE-SET SECURITY QUESTIONS SECTION */}
            <div
              style={{
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '14px',
                marginTop: '4px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#0f172a' }}>
                <KeyRound size={16} color="#d97706" />
                <span style={{ fontWeight: 750, fontSize: '0.84rem' }}>
                  Account Security Verification Questions (பாதுகாப்பு கேள்விகள்)
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '0.74rem', color: '#64748b', lineHeight: 1.35 }}>
                Answer these 3 pre-set questions. They will verify your identity if you ever use 'Forget Password'.
              </p>

              {/* Question 1 */}
              <div>
                <label htmlFor="reg-sec-name" style={{ fontSize: '0.78rem', fontWeight: 650, color: '#334155', display: 'block', marginBottom: '3px' }}>
                  1. What is your name? <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  id="reg-sec-name"
                  type="text"
                  required
                  placeholder="Your answer"
                  value={regSecName}
                  onChange={e => setRegSecName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.82rem',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Question 2 */}
              <div>
                <label htmlFor="reg-sec-city" style={{ fontSize: '0.78rem', fontWeight: 650, color: '#334155', display: 'block', marginBottom: '3px' }}>
                  2. Which city are you in? <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  id="reg-sec-city"
                  type="text"
                  required
                  placeholder="Your answer (e.g. Chennai, Madurai)"
                  value={regSecCity}
                  onChange={e => setRegSecCity(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.82rem',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Question 3 */}
              <div>
                <label htmlFor="reg-sec-friend" style={{ fontSize: '0.78rem', fontWeight: 650, color: '#334155', display: 'block', marginBottom: '3px' }}>
                  3. Who is your friend? <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  id="reg-sec-friend"
                  type="text"
                  required
                  placeholder="Your answer (friend's name)"
                  value={regSecFriend}
                  onChange={e => setRegSecFriend(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.82rem',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              id="btn-register-submit"
              style={{
                width: '100%',
                padding: '12px 18px',
                borderRadius: '10px',
                border: 'none',
                background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                color: '#ffffff',
                fontSize: '0.92rem',
                fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 4px 12px rgba(5, 150, 105, 0.25)',
                marginTop: '4px',
              }}
            >
              <span>{loading ? 'Creating account...' : 'Create Account'}</span>
              <CheckCircle2 size={18} />
            </button>

            <div style={{ textAlign: 'center', marginTop: '4px' }}>
              <button
                type="button"
                onClick={() => switchMode('login')}
                style={{
                  color: '#475569',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                }}
              >
                Already have an account? <strong style={{ color: '#0f172a' }}>Sign In</strong>
              </button>
            </div>
          </form>
        )}

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* 3. FORGET PASSWORD VERIFICATION FLOW                         */}
        {/* ══════════════════════════════════════════════════════════════ */}
        {mode === 'forget_password' && (
          <form onSubmit={handleVerifySecurityQuestions} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div
              style={{
                backgroundColor: '#fffbeb',
                border: '1px solid #fef3c7',
                borderRadius: '10px',
                padding: '12px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '8px',
              }}
            >
              <HelpCircle size={18} color="#b45309" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div style={{ fontSize: '0.8rem', color: '#92400e', lineHeight: 1.4 }}>
                Please provide your registered <strong>Email ID</strong> and answer your <strong>three pre-set security questions</strong> exactly as defined during account creation to authorize your password reset.
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label htmlFor="forgot-email" style={{ fontWeight: 700, fontSize: '0.84rem', color: '#334155', marginBottom: '4px', display: 'block' }}>
                Registered Email ID <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <div style={{ position: 'relative' }}>
                <Mail size={17} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                  id="forgot-email"
                  type="email"
                  required
                  placeholder="Enter your registered email ID"
                  value={forgotEmail}
                  onChange={e => setForgotEmail(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px 10px 38px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.88rem',
                    boxSizing: 'border-box',
                  }}
                  autoFocus
                />
              </div>
            </div>

            {/* Three Security Questions Box */}
            <div
              style={{
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              <span style={{ fontWeight: 750, fontSize: '0.82rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <KeyRound size={15} color="#f59e0b" />
                Security Verification Questions:
              </span>

              {/* Question 1 */}
              <div>
                <label htmlFor="forgot-sec-name" style={{ fontSize: '0.78rem', fontWeight: 650, color: '#334155', display: 'block', marginBottom: '3px' }}>
                  1. What is your name?
                </label>
                <input
                  id="forgot-sec-name"
                  type="text"
                  required
                  placeholder="Enter your answer"
                  value={forgotSecName}
                  onChange={e => setForgotSecName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.84rem',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Question 2 */}
              <div>
                <label htmlFor="forgot-sec-city" style={{ fontSize: '0.78rem', fontWeight: 650, color: '#334155', display: 'block', marginBottom: '3px' }}>
                  2. Which city are you in?
                </label>
                <input
                  id="forgot-sec-city"
                  type="text"
                  required
                  placeholder="Enter your answer"
                  value={forgotSecCity}
                  onChange={e => setForgotSecCity(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.84rem',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Question 3 */}
              <div>
                <label htmlFor="forgot-sec-friend" style={{ fontSize: '0.78rem', fontWeight: 650, color: '#334155', display: 'block', marginBottom: '3px' }}>
                  3. Who is your friend?
                </label>
                <input
                  id="forgot-sec-friend"
                  type="text"
                  required
                  placeholder="Enter your answer"
                  value={forgotSecFriend}
                  onChange={e => setForgotSecFriend(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.84rem',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              id="btn-verify-security"
              style={{
                width: '100%',
                padding: '12px 18px',
                borderRadius: '10px',
                border: 'none',
                background: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)',
                color: '#ffffff',
                fontSize: '0.92rem',
                fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 4px 12px rgba(217, 119, 6, 0.25)',
                marginTop: '4px',
              }}
            >
              <span>{loading ? 'Verifying Answers...' : 'Verify Security Answers & Reset Password'}</span>
              <KeyRound size={17} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '4px 0' }}>
              <div style={{ flex: 1, height: '1px', background: '#e2e8f0' }} />
              <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>OR</span>
              <div style={{ flex: 1, height: '1px', background: '#e2e8f0' }} />
            </div>

            <button
              type="button"
              disabled={loading}
              onClick={handleSendEmailReset}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                color: '#334155',
                fontSize: '0.86rem',
                fontWeight: 650,
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              <Mail size={16} color="#2563eb" />
              <span>Send Secure Reset Link via Email (Recommended)</span>
            </button>

            <div style={{ textAlign: 'center', marginTop: '6px' }}>
              <button
                type="button"
                onClick={() => switchMode('login')}
                style={{
                  color: '#475569',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <ArrowLeft size={15} />
                <span>Back to Sign In</span>
              </button>
            </div>
          </form>
        )}

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* 4. RESET PASSWORD FORM (AFTER SUCCESSFUL VERIFICATION)        */}
        {/* ══════════════════════════════════════════════════════════════ */}
        {mode === 'reset_password' && (
          <form onSubmit={handleResetPassword} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div
              style={{
                backgroundColor: '#ecfdf5',
                border: '1px solid #a7f3d0',
                borderRadius: '10px',
                padding: '12px',
                fontSize: '0.82rem',
                color: '#065f46',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <CheckCircle2 size={18} color="#10b981" />
              <span>Identity verified for <strong>{verifiedEmail}</strong>. Please enter your new password.</span>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label htmlFor="reset-new-password" style={{ fontWeight: 700, fontSize: '0.84rem', color: '#334155', marginBottom: '4px', display: 'block' }}>
                New Password <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <div style={{ position: 'relative' }}>
                <Lock size={17} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                  id="reset-new-password"
                  name="new-password"
                  type={showResetPassword ? 'text' : 'password'}
                  required
                  placeholder="Min 8 characters"
                  value={resetNewPassword}
                  onChange={e => setResetNewPassword(e.target.value)}
                  autoComplete="new-password"
                  style={{
                    width: '100%',
                    padding: '10px 40px 10px 38px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.88rem',
                    boxSizing: 'border-box',
                  }}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowResetPassword(!showResetPassword)}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: '#64748b',
                    cursor: 'pointer',
                    padding: '4px',
                  }}
                >
                  {showResetPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label htmlFor="reset-confirm-password" style={{ fontWeight: 700, fontSize: '0.84rem', color: '#334155', marginBottom: '4px', display: 'block' }}>
                Confirm New Password <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <div style={{ position: 'relative' }}>
                <Lock size={17} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                  id="reset-confirm-password"
                  type={showResetPassword ? 'text' : 'password'}
                  required
                  placeholder="Re-enter new password"
                  value={resetConfirmPassword}
                  onChange={e => setResetConfirmPassword(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px 10px 38px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.88rem',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              id="btn-confirm-password-reset"
              style={{
                width: '100%',
                padding: '12px 18px',
                borderRadius: '10px',
                border: 'none',
                background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                color: '#ffffff',
                fontSize: '0.92rem',
                fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)',
                marginTop: '4px',
              }}
            >
              <span>{loading ? 'Updating Password...' : 'Save New Password & Sign In'}</span>
              <CheckCircle2 size={18} />
            </button>

            <div style={{ textAlign: 'center', marginTop: '6px' }}>
              <button
                type="button"
                onClick={() => switchMode('login')}
                style={{
                  color: '#475569',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                }}
              >
                Cancel and return to Sign In
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
