import React, { useState } from 'react';
import { HardHat, Eye, EyeOff, Lock, User, ArrowRight, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { loginUser, registerUser } from '../services/auth';
import type { User as UserType } from '../db/types';
import { ForgotPasswordModal } from '../components/ForgotPasswordModal';
import { ChangeInitialPasswordModal } from '../components/ChangeInitialPasswordModal';

interface LoginViewProps {
  onLoginSuccess: (user: UserType) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);

  // Forgot Password & Initial Password Modals State
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);
  const [pendingInitialPasswordUser, setPendingInitialPasswordUser] = useState<UserType | null>(null);
  const [successMessage, setSuccessMessage] = useState('');

  // Registration fields
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) {
      setError('Enter your email address.');
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
      const res = await loginUser(identifier, password, remember);
      if (res.success && res.user) {
        if (res.user.mustChangePassword) {
          setPendingInitialPasswordUser(res.user);
        } else {
          onLoginSuccess(res.user);
        }
      } else {
        setError(res.error || 'Login failed. Please verify credentials.');
      }
    } catch (err: any) {
      setError('Authentication error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || username.length < 3) {
      setError('Username must be at least 3 characters.');
      return;
    }
    if (!password || password.length < 8) {
      setError('Password must be at least 8 characters with letters & numbers.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      const res = await registerUser(username, fullName, mobile, email, password);
      if (res.success && res.user) {
        onLoginSuccess(res.user);
      } else if (res.needsConfirmation) {
        setSuccessMessage(res.error || 'Check your email to confirm your account, then sign in.');
      } else {
        setError(res.error || 'Registration failed.');
      }
    } catch (err: any) {
      setError('Registration error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'var(--bg-main)',
      padding: '20px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Background Ambience / Glow */}
      <div style={{
        position: 'absolute',
        top: '-10%',
        right: '-10%',
        width: '450px',
        height: '450px',
        background: 'radial-gradient(circle, rgba(234, 88, 12, 0.14) 0%, rgba(234, 88, 12, 0) 70%)',
        borderRadius: '50%',
        pointerEvents: 'none',
      }} />

      <div style={{
        position: 'absolute',
        bottom: '-10%',
        left: '-10%',
        width: '400px',
        height: '400px',
        background: 'radial-gradient(circle, rgba(245, 158, 11, 0.12) 0%, rgba(245, 158, 11, 0) 70%)',
        borderRadius: '50%',
        pointerEvents: 'none',
      }} />

      {/* Login Card */}
      <div style={{
        width: '100%',
        maxWidth: '440px',
        backgroundColor: '#ffffff',
        borderRadius: '24px',
        padding: '36px 30px',
        border: '1px solid var(--border-light)',
        boxShadow: '0 18px 40px -16px rgba(28, 25, 23, 0.22)',
        position: 'relative',
        zIndex: 10,
      }}>
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '16px',
            background: 'var(--primary)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            boxShadow: '0 8px 16px rgba(234, 88, 12, 0.28)',
            marginBottom: '12px',
          }}>
            <HardHat size={36} strokeWidth={2.4} />
          </div>

          <h2 style={{
            fontSize: '1.75rem',
            color: 'var(--text-main)',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            marginBottom: '4px',
          }}>
            Building Mistry
          </h2>
          <p style={{ fontSize: '0.88rem', color: '#64748b' }}>
            Construction Site & Expense Manager
          </p>
        </div>

        {error && (
          <div style={{
            backgroundColor: '#fee2e2',
            color: '#991b1b',
            padding: '10px 14px',
            borderRadius: '10px',
            fontSize: '0.88rem',
            fontWeight: 600,
            marginBottom: '18px',
          }}>
            {error}
          </div>
        )}

        {successMessage && (
          <div style={{
            backgroundColor: '#d1fae5',
            color: '#065f46',
            padding: '10px 14px',
            borderRadius: '10px',
            fontSize: '0.88rem',
            fontWeight: 600,
            marginBottom: '18px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            <CheckCircle2 size={18} />
            <span>{successMessage}</span>
          </div>
        )}

        {/* LOGIN FORM */}
        {!isRegister ? (
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="form-group">
              <label htmlFor="login-identifier">Email address</label>
              <div style={{ position: 'relative' }}>
                <User size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                  id="login-identifier"
                  name="email"
                  type="email"
                  placeholder="you@example.com"
                  value={identifier}
                  onChange={e => setIdentifier(e.target.value)}
                  autoComplete="email"
                  style={{ paddingLeft: '42px' }}
                  autoFocus
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="login-password">Password</label>
              <div style={{ position: 'relative' }}>
                <Lock size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                  id="login-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="current-password"
                  style={{ paddingLeft: '42px', paddingRight: '42px' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#64748b',
                    padding: '4px',
                  }}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Remember & Forgot Password Option */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px 12px', fontSize: '0.85rem' }}>
              <label htmlFor="login-remember" style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', color: '#475569' }}>
                <input
                  id="login-remember"
                  name="remember"
                  type="checkbox"
                  checked={remember}
                  onChange={e => setRemember(e.target.checked)}
                  style={{ width: 'auto' }}
                />
                <span>Keep me logged in</span>
              </label>

              <button
                type="button"
                onClick={() => setIsForgotPasswordOpen(true)}
                style={{
                  color: 'var(--primary-hover)',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  padding: '2px 0',
                }}
              >
                Forgot password?
              </button>
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-lg"
              disabled={loading}
              style={{ width: '100%', marginTop: '6px', whiteSpace: 'normal', lineHeight: 1.3 }}
            >
              {loading ? 'Signing in...' : 'Sign in'}
              <ArrowRight size={18} />
            </button>

            <div style={{ textAlign: 'center', marginTop: '6px' }}>
              <span
                style={{ color: 'var(--primary-hover)', fontWeight: 600, cursor: 'pointer', fontSize: '0.88rem' }}
                onClick={() => setIsRegister(true)}
              >
                New user? Create an account
              </span>
            </div>

            <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '16px', marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '0.78rem', color: '#64748b' }}>
                <ShieldCheck size={14} color="#6366f1" />
                <span>Super Admin Portal: Sign in with registered administrator credentials above</span>
              </div>

            </div>
          </form>
        ) : (
          /* REGISTRATION FORM */
          <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div className="form-group">
              <label htmlFor="reg-fullname">Full name</label>
              <input
                id="reg-fullname"
                name="name"
                type="text"
                placeholder="Enter your full name"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                autoComplete="name"
                autoFocus
              />
            </div>

            <div className="form-group">
              <label htmlFor="reg-username">Username <span className="required">*</span></label>
              <input
                id="reg-username"
                name="username"
                type="text"
                placeholder="Choose a username"
                value={username}
                onChange={e => setUsername(e.target.value)}
                autoComplete="username"
              />
            </div>

            <div className="form-grid-2">
              <div className="form-group">
                <label htmlFor="reg-email">Email address <span className="required">*</span></label>
                <input
                  id="reg-email"
                  name="email"
                  type="email"
                  required
                  placeholder="Enter your email address"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>
              <div className="form-group">
                <label htmlFor="reg-mobile">Mobile number</label>
                <input
                  id="reg-mobile"
                  name="tel"
                  type="tel"
                  placeholder="Mobile number (optional)"
                  value={mobile}
                  onChange={e => setMobile(e.target.value)}
                  autoComplete="tel"
                />
              </div>

            </div>

            <div className="form-group">
              <label htmlFor="reg-password">Password (at least 8 characters) <span className="required">*</span></label>
              <input
                id="reg-password"
                name="new-password"
                type="password"
                placeholder="Choose a safe password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-lg"
              disabled={loading}
              style={{ width: '100%', marginTop: '8px' }}
            >
              {loading ? 'Creating account...' : 'Create account'}
            </button>

            <div style={{ textAlign: 'center', marginTop: '8px' }}>
              <span
                style={{ color: 'var(--primary)', fontWeight: 600, fontSize: '0.88rem', cursor: 'pointer' }}
                onClick={() => setIsRegister(false)}
              >
                Already registered? Sign in
              </span>
            </div>
          </form>
        )}
      </div>

      {/* Forgot Password OTP Modal */}
      <ForgotPasswordModal
        isOpen={isForgotPasswordOpen}
        onClose={() => setIsForgotPasswordOpen(false)}
        onSuccess={msg => {
          setIsForgotPasswordOpen(false);
          setError('');
          setSuccessMessage(msg);
        }}
      />

      {/* Mandatory Initial Password Setup Modal */}
      {pendingInitialPasswordUser && (
        <ChangeInitialPasswordModal
          isOpen={Boolean(pendingInitialPasswordUser)}
          user={pendingInitialPasswordUser}
          onSuccess={() => {
            const userToLogin = { ...pendingInitialPasswordUser, mustChangePassword: false };
            setPendingInitialPasswordUser(null);
            onLoginSuccess(userToLogin);
          }}
        />
      )}
    </div>
  );
};
