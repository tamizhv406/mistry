import React, { useState } from 'react';
import { Lock, Eye, EyeOff, ShieldCheck, CheckCircle2, AlertCircle } from 'lucide-react';
import { updateSupabasePassword } from '../services/supabase';
import { validatePasswordStrength } from '../services/otpService';

interface ResetPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

export const ResetPasswordModal: React.FC<ResetPasswordModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isDone, setIsDone] = useState(false);

  if (!isOpen) return null;

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }

    const check = validatePasswordStrength(newPassword);
    if (!check.valid) {
      setError(check.error || 'Password does not meet minimum strength requirements.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const updateRes = await updateSupabasePassword(newPassword);
      if (!updateRes.success) {
        setError(updateRes.error || 'Failed to update password with the authentication service.');
        return;
      }

      if (typeof window !== 'undefined') {
        window.history.replaceState({}, document.title, window.location.pathname);
      }

      setIsDone(true);
      onSuccess('Password updated successfully. You can now sign in with your new password.');
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred while resetting password.');
    } finally {
      setLoading(false);
    }
  };

  const handleFinish = () => {
    setIsDone(false);
    setNewPassword('');
    setConfirmPassword('');
    onClose();
  };

  const strength = validatePasswordStrength(newPassword);

  return (
    <div className="modal-overlay">
      <div
        className="modal-dialog"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: '440px', width: '100%' }}
        role="dialog"
        aria-labelledby="reset-pwd-modal-title"
      >
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                backgroundColor: 'rgba(245, 158, 11, 0.15)',
                color: '#f59e0b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ShieldCheck size={20} />
            </div>
            <div>
              <h3 id="reset-pwd-modal-title" style={{ fontSize: '1.15rem', color: '#0f172a' }}>
                {isDone ? 'Password Reset Complete' : 'Set New Password'}
              </h3>
              <p style={{ fontSize: '0.78rem', color: '#64748b' }}>
                {isDone ? 'Your account credentials have been updated.' : 'Enter your new password below'}
              </p>
            </div>
          </div>
        </div>

        <div className="modal-body" style={{ padding: '20px' }}>
          {error && (
            <div
              style={{
                backgroundColor: '#fee2e2',
                color: '#991b1b',
                padding: '10px 14px',
                borderRadius: '10px',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '16px',
              }}
            >
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          {!isDone ? (
            <form onSubmit={handleReset} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <p style={{ fontSize: '0.88rem', color: '#475569' }}>
                Your recovery verification was confirmed. Please choose a strong new password for your account.
              </p>

              <div className="form-group">
                <label htmlFor="rp-new-password" style={{ fontWeight: 600 }}>New Password</label>
                <div style={{ position: 'relative' }}>
                  <Lock size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                  <input
                    id="rp-new-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="At least 8 chars with letters & numbers"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    autoComplete="new-password"
                    style={{ paddingLeft: '42px', paddingRight: '42px' }}
                    autoFocus
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
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>

                <div style={{ marginTop: '6px', fontSize: '0.74rem' }}>
                  <span style={{ color: newPassword.length >= 8 ? '#10b981' : '#94a3b8' }}>
                    {newPassword.length >= 8 ? '✓' : '•'} Min 8 characters
                  </span>
                  {' • '}
                  <span style={{ color: /[0-9]/.test(newPassword) && /[a-zA-Z]/.test(newPassword) ? '#10b981' : '#94a3b8' }}>
                    {/[0-9]/.test(newPassword) && /[a-zA-Z]/.test(newPassword) ? '✓' : '•'} Letters & numbers
                  </span>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="rp-confirm-password" style={{ fontWeight: 600 }}>Confirm New Password</label>
                <div style={{ position: 'relative' }}>
                  <Lock size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                  <input
                    id="rp-confirm-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Repeat new password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                    style={{ paddingLeft: '42px' }}
                  />
                </div>
                {confirmPassword && newPassword !== confirmPassword && (
                  <span style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: '4px', display: 'block' }}>
                    Passwords do not match
                  </span>
                )}
              </div>

              <button
                type="submit"
                className="btn btn-primary btn-lg"
                disabled={loading || !newPassword || !confirmPassword || newPassword !== confirmPassword || !strength.valid}
                style={{ width: '100%', marginTop: '8px' }}
                id="rp-submit-btn"
              >
                {loading ? 'Saving New Password...' : 'Save New Password & Continue'}
              </button>
            </form>
          ) : (
            <div style={{ textAlign: 'center', padding: '16px 8px' }}>
              <div
                style={{
                  width: '60px',
                  height: '60px',
                  borderRadius: '50%',
                  backgroundColor: '#d1fae5',
                  color: '#10b981',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '16px',
                }}
              >
                <CheckCircle2 size={36} />
              </div>
              <h4 style={{ fontSize: '1.2rem', color: '#0f172a', marginBottom: '8px' }}>
                Password Changed Successfully!
              </h4>
              <p style={{ fontSize: '0.88rem', color: '#64748b', marginBottom: '20px' }}>
                Your account password has been securely updated. You can now use your new password to sign in.
              </p>
              <button
                type="button"
                className="btn btn-primary btn-lg"
                onClick={handleFinish}
                style={{ width: '100%' }}
                id="rp-finish-btn"
              >
                Continue to App
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
