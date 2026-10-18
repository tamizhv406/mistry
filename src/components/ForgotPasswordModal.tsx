import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, KeyRound, Mail, ShieldCheck, X } from 'lucide-react';
import { requestEmailPasswordReset } from '../services/emailRecoveryService';

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export const ForgotPasswordModal: React.FC<ForgotPasswordModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [infoMessage, setInfoMessage] = useState('');

  useEffect(() => {
    if (isOpen) {
      setEmail('');
      setError('');
      setInfoMessage('');
      setLoading(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const close = () => {
    setError('');
    setInfoMessage('');
    onClose();
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email.trim() || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
      setError('Enter a valid account email address.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const result = await requestEmailPasswordReset(email.trim());
      if (!result.success) {
        setError(result.error || 'Could not send the password reset link.');
        return;
      }
      setInfoMessage(result.message);
      onSuccess(result.message);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not send the password reset link.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={close}>
      <div
        className="modal-dialog"
        onClick={event => event.stopPropagation()}
        style={{ maxWidth: '460px', width: '100%' }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="forgot-pwd-title"
      >
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <KeyRound size={20} color="#f59e0b" />
            <div>
              <h3 id="forgot-pwd-title">Reset your password</h3>
              <p style={{ fontSize: '0.78rem', color: '#64748b' }}>We will email a secure reset link.</p>
            </div>
          </div>
          <button type="button" className="modal-close" onClick={close} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className="modal-body" style={{ padding: 20 }}>
          {error && (
            <div role="alert" style={{ backgroundColor: '#fee2e2', color: '#991b1b', padding: '10px 14px', borderRadius: 10, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
              <AlertCircle size={16} /> <span>{error}</span>
            </div>
          )}
          {infoMessage ? (
            <div style={{ display: 'grid', gap: 14 }}>
              <div role="status" style={{ backgroundColor: '#d1fae5', color: '#065f46', padding: 14, borderRadius: 10, display: 'flex', gap: 8 }}>
                <CheckCircle2 size={18} /> <span>{infoMessage}</span>
              </div>
              <p style={{ fontSize: '0.82rem', color: '#64748b' }}>
                Check your inbox and spam folder. The reset link opens this app so you can choose a new password.
              </p>
              <button type="button" className="btn btn-outline" onClick={close}>Close</button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 14 }}>
              <p style={{ fontSize: '0.88rem', color: '#475569' }}>
                Enter the email address for your Supabase account. If it is registered, you will receive a reset link.
              </p>
              <label htmlFor="fp-email" style={{ fontWeight: 600 }}>Account email</label>
              <div style={{ position: 'relative' }}>
                <Mail size={17} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                <input
                  id="fp-email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={event => setEmail(event.target.value)}
                  autoComplete="email"
                  required
                  autoFocus
                  style={{ paddingLeft: 46, fontSize: '1rem' }}
                />
              </div>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Sending…' : <><ShieldCheck size={17} /> Send reset link</>}
              </button>
              <button type="button" className="btn btn-outline" onClick={close}>Cancel</button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
