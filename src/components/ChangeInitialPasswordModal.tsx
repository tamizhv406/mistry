import React, { useState } from 'react';
import { Lock, Eye, EyeOff, ShieldAlert, CheckCircle2 } from 'lucide-react';
import type { User } from '../db/types';
import { completeInitialPasswordSetup } from '../services/auth';
import { validatePasswordStrength } from '../services/otpService';

interface ChangeInitialPasswordModalProps {
  isOpen: boolean;
  user: User;
  onSuccess: () => void;
}

export const ChangeInitialPasswordModal: React.FC<ChangeInitialPasswordModalProps> = ({
  isOpen,
  user,
  onSuccess,
}) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    const check = validatePasswordStrength(newPassword);
    if (!check.valid) {
      setError(check.error || 'Password does not meet security requirements.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await completeInitialPasswordSetup(user.id, newPassword, confirmPassword);
      if (res.success) {
        onSuccess();
      } else {
        setError(res.error || 'Failed to update initial password.');
      }
    } catch (err: any) {
      setError(err.message || 'Error updating password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 1100 }}>
      <div
        className="modal-dialog"
        style={{ maxWidth: '440px', width: '100%' }}
        role="dialog"
        aria-modal="true"
      >
        <div className="modal-header" style={{ backgroundColor: '#1e1b4b', color: '#ffffff' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                backgroundColor: 'rgba(234, 179, 8, 0.2)',
                color: '#facc15',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ShieldAlert size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.1rem', color: '#f8fafc' }}>
                Change Initial Password Required
              </h3>
              <p style={{ fontSize: '0.75rem', color: '#c7d2fe' }}>
                Set your secure private password to activate your account
              </p>
            </div>
          </div>
        </div>

        <div className="modal-body" style={{ padding: '20px' }}>
          <p style={{ fontSize: '0.86rem', color: '#475569', marginBottom: '14px' }}>
            Hello <strong>{user.fullName || user.username}</strong>, for your security, you must set a new private password before accessing the Building Mistry system.
          </p>

          {error && (
            <div
              style={{
                backgroundColor: '#fee2e2',
                color: '#991b1b',
                padding: '10px 14px',
                borderRadius: '10px',
                fontSize: '0.85rem',
                marginBottom: '14px',
              }}
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div className="form-group">
              <label htmlFor="init-new-password" style={{ fontWeight: 600 }}>New Private Password (புதிய கடவுச்சொல்)</label>
              <div style={{ position: 'relative' }}>
                <Lock size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                  id="init-new-password"
                  name="new-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Min 8 characters (letters + numbers)"
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
                  }}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="init-confirm-password" style={{ fontWeight: 600 }}>Confirm New Password (கடவுச்சொல் உறுதிப்படுத்தல்)</label>
              <div style={{ position: 'relative' }}>
                <Lock size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                  id="init-confirm-password"
                  name="confirm-new-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Re-enter your password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  style={{ paddingLeft: '42px' }}
                />
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-lg"
              disabled={loading || !newPassword || !confirmPassword}
              style={{ width: '100%', marginTop: '6px' }}
            >
              {loading ? 'Securing Account...' : 'Set Password & Enter Dashboard / புதிய கடவுச்சொல் அமைத்து தொடரவும்'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
