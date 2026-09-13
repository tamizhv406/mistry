import React, { useState } from 'react';
import { HardHat, Eye, EyeOff, Lock, User, Phone, Mail, ArrowRight, ShieldCheck, Crown } from 'lucide-react';
import { loginUser, registerUser } from '../services/auth';
import type { User as UserType } from '../db/types';

interface LoginViewProps {
  onLoginSuccess: (user: UserType) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);

  // Registration fields
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'Mistry' | 'Supervisor' | 'Contractor'>('Mistry');

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) {
      setError('Please enter your username, mobile number, or email.');
      return;
    }
    if (!password) {
      setError('Please enter your password.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await loginUser(identifier, password, remember);
      if (res.success && res.user) {
        onLoginSuccess(res.user);
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
    if (!password || password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      const res = await registerUser(username, fullName, mobile, email, password, 'MISTRY');
      if (res.success && res.user) {
        onLoginSuccess(res.user);
      } else {
        setError(res.error || 'Registration failed.');
      }
    } catch (err: any) {
      setError('Registration error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleMistryLogin = async () => {
    setIdentifier('mistry_velu');
    setPassword('mistry123');
    setLoading(true);
    setError('');
    try {
      const res = await loginUser('mistry_velu', 'mistry123', true);
      if (res.success && res.user) {
        onLoginSuccess(res.user);
      } else {
        setError(res.error || 'Mistry login failed.');
      }
    } catch (err: any) {
      setError('Mistry login error: ' + err.message);
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
      backgroundColor: '#0f172a',
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
        background: 'radial-gradient(circle, rgba(245, 158, 11, 0.18) 0%, rgba(245, 158, 11, 0) 70%)',
        borderRadius: '50%',
        pointerEvents: 'none',
      }} />

      <div style={{
        position: 'absolute',
        bottom: '-10%',
        left: '-10%',
        width: '400px',
        height: '400px',
        background: 'radial-gradient(circle, rgba(59, 130, 246, 0.12) 0%, rgba(59, 130, 246, 0) 70%)',
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
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
        position: 'relative',
        zIndex: 10,
      }}>
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            boxShadow: '0 8px 16px rgba(245, 158, 11, 0.35)',
            marginBottom: '12px',
          }}>
            <HardHat size={36} strokeWidth={2.4} />
          </div>

          <h2 style={{
            fontSize: '1.75rem',
            color: '#0f172a',
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

        {/* LOGIN FORM */}
        {!isRegister ? (
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="form-group">
              <label>Username / Mobile Number</label>
              <div style={{ position: 'relative' }}>
                <User size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                  type="text"
                  placeholder="e.g. admin or 98401 23456"
                  value={identifier}
                  onChange={e => setIdentifier(e.target.value)}
                  style={{ paddingLeft: '42px' }}
                  autoFocus
                />
              </div>
            </div>

            <div className="form-group">
              <label>Password</label>
              <div style={{ position: 'relative' }}>
                <Lock size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
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
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', color: '#475569' }}>
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={e => setRemember(e.target.checked)}
                  style={{ width: 'auto' }}
                />
                <span>Keep me logged in</span>
              </label>

              <span style={{ color: 'var(--primary)', fontWeight: 600, cursor: 'pointer' }} onClick={() => setIsRegister(true)}>
                New user? Register
              </span>
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-lg"
              disabled={loading}
              style={{ width: '100%', marginTop: '6px' }}
            >
              {loading ? 'Verifying...' : 'Sign In to Site Portal'}
              <ArrowRight size={18} />
            </button>

            {/* Quick Demo Login Option for Mistry testing */}
            <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '16px', marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '0.78rem', color: '#64748b' }}>
                <ShieldCheck size={14} color="#6366f1" />
                <span>Real Admin Portal: Sign in with master ID & password above</span>
              </div>

              {/* Demo Mistry Login Button */}
              <button
                type="button"
                className="btn btn-outline"
                onClick={handleMistryLogin}
                disabled={loading}
                style={{
                  width: '100%',
                  borderColor: '#cbd5e1',
                  color: '#334155',
                  backgroundColor: '#f8fafc',
                  fontSize: '0.85rem',
                  padding: '8px 14px',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                }}
              >
                <HardHat size={16} color="#d97706" />
                <span>👷 Quick Demo Mistry Login (Sample Sites)</span>
              </button>
              <div style={{ fontSize: '0.72rem', color: '#94a3b8', textAlign: 'center' }}>
                Demo Contractor: <code>mistry_velu</code> / <code>mistry123</code>
              </div>
            </div>
          </form>
        ) : (
          /* REGISTRATION FORM */
          <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div className="form-group">
              <label>Full Name</label>
              <input
                type="text"
                placeholder="e.g. R. Velu Mistry"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                autoFocus
              />
            </div>

            <div className="form-group">
              <label>Username <span className="required">*</span></label>
              <input
                type="text"
                placeholder="e.g. velumistry"
                value={username}
                onChange={e => setUsername(e.target.value)}
              />
            </div>

            <div className="form-grid-2">
              <div className="form-group">
                <label>Mobile Number</label>
                <input
                  type="tel"
                  placeholder="e.g. 98401 23456"
                  value={mobile}
                  onChange={e => setMobile(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Trade / Specialization</label>
                <select value={role} onChange={e => setRole(e.target.value as any)}>
                  <option value="Mistry">Head Mistry (தலைமை மேஸ்திரி)</option>
                  <option value="Contractor">Civil Contractor (ஒப்பந்ததாரர்)</option>
                  <option value="Mason">Mason (கொத்தனார்)</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label>Password (Min 6 chars) <span className="required">*</span></label>
              <input
                type="password"
                placeholder="Choose a safe password"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-lg"
              disabled={loading}
              style={{ width: '100%', marginTop: '8px' }}
            >
              {loading ? 'Creating Profile...' : 'Create Account & Log In'}
            </button>

            <div style={{ textAlign: 'center', marginTop: '8px' }}>
              <span
                style={{ color: 'var(--primary)', fontWeight: 600, fontSize: '0.88rem', cursor: 'pointer' }}
                onClick={() => setIsRegister(false)}
              >
                Already registered? Back to Login
              </span>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
