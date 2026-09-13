import React, { useState, useEffect } from 'react';
import {
  Phone,
  KeyRound,
  Lock,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  X,
  RefreshCw,
  Eye,
  EyeOff,
  ShieldCheck,
} from 'lucide-react';
import {
  isValidIndianPhone,
  requestPasswordRecoveryOtp,
  verifyRecoveryOtp,
  resetPasswordWithToken,
  validatePasswordStrength,
} from '../services/otpService';

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
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [recoveryToken, setRecoveryToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [cooldown, setCooldown] = useState(0);

  // Cooldown countdown timer for OTP resend
  useEffect(() => {
    let timer: any;
    if (cooldown > 0) {
      timer = setInterval(() => {
        setCooldown(prev => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [cooldown]);

  if (!isOpen) return null;

  const handleResetState = () => {
    setStep(1);
    setMobile('');
    setOtp('');
    setRecoveryToken('');
    setNewPassword('');
    setConfirmPassword('');
    setError('');
    setInfoMessage('');
    setCooldown(0);
    onClose();
  };

  // Step 1: Request OTP
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mobile.trim()) {
      setError('Please enter your registered 10-digit mobile number.');
      return;
    }
    if (!isValidIndianPhone(mobile)) {
      setError('Please enter a valid 10-digit Indian mobile number (e.g. 98401 23456).');
      return;
    }

    setLoading(true);
    setError('');
    setInfoMessage('');

    try {
      const res = await requestPasswordRecoveryOtp(mobile);
      if (res.success) {
        setInfoMessage(res.message);
        setCooldown(res.cooldownSeconds || 60);
        setStep(2);
      } else {
        setError(res.error || 'Failed to request OTP. Please try again.');
        if (res.cooldownSeconds) setCooldown(res.cooldownSeconds);
      }
    } catch (err: any) {
      setError(err.message || 'Error communicating with recovery service.');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify OTP
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp || otp.trim().length !== 6) {
      setError('Please enter the complete 6-digit verification code.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await verifyRecoveryOtp(mobile, otp);
      if (res.success && res.token) {
        setRecoveryToken(res.token);
        setStep(3);
      } else {
        setError(res.error || 'Invalid or expired OTP code.');
      }
    } catch (err: any) {
      setError(err.message || 'Verification failed.');
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP in Step 2
  const handleResendOtp = async () => {
    if (cooldown > 0) return;
    setLoading(true);
    setError('');
    try {
      const res = await requestPasswordRecoveryOtp(mobile);
      if (res.success) {
        setInfoMessage('A new verification code has been generated and dispatched.');
        setCooldown(res.cooldownSeconds || 60);
      } else {
        setError(res.error || 'Failed to resend OTP.');
      }
    } catch (err: any) {
      setError(err.message || 'Resend error.');
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Create & Confirm New Password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.');
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
      const res = await resetPasswordWithToken(mobile, recoveryToken, newPassword, confirmPassword);
      if (res.success) {
        setStep(4);
        onSuccess('Password changed successfully! You can now log in with your new password.');
      } else {
        setError(res.error || 'Password reset failed. Please request a new OTP.');
      }
    } catch (err: any) {
      setError(err.message || 'Error updating password.');
    } finally {
      setLoading(false);
    }
  };

  const pwdStrength = validatePasswordStrength(newPassword);

  return (
    <div className="modal-overlay" onClick={handleResetState}>
      <div
        className="modal-dialog"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: '460px', width: '100%' }}
        role="dialog"
        aria-labelledby="forgot-pwd-title"
      >
        {/* Header */}
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
              <KeyRound size={20} />
            </div>
            <div>
              <h3 id="forgot-pwd-title" style={{ fontSize: '1.15rem', color: '#0f172a' }}>
                {step === 4 ? 'Password Reset Complete' : 'Forgot Password?'}
              </h3>
              <p style={{ fontSize: '0.78rem', color: '#64748b' }}>
                {step === 1 && 'Step 1: Enter your registered mobile number'}
                {step === 2 && 'Step 2: Enter 6-digit OTP verification code'}
                {step === 3 && 'Step 3: Create your new strong password'}
                {step === 4 && 'Step 4: Account security updated'}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="modal-close"
            onClick={handleResetState}
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
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

          {infoMessage && (
            <div
              style={{
                backgroundColor: '#dbeafe',
                color: '#1e40af',
                padding: '10px 14px',
                borderRadius: '10px',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '16px',
              }}
            >
              <ShieldCheck size={16} style={{ flexShrink: 0 }} />
              <span>{infoMessage}</span>
            </div>
          )}

          {/* STEP 1: MOBILE NUMBER ENTRY */}
          {step === 1 && (
            <form onSubmit={handleRequestOtp} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <p style={{ fontSize: '0.88rem', color: '#475569' }}>
                Enter the mobile phone number associated with your Building Mistry account. A 6-digit OTP will be dispatched for verification.
              </p>

              <div className="form-group">
                <label style={{ fontWeight: 600 }}>Mobile Number (கைபேசி எண்)</label>
                <div style={{ position: 'relative' }}>
                  <span
                    style={{
                      position: 'absolute',
                      left: '14px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: '#64748b',
                      fontSize: '0.9rem',
                      fontWeight: 700,
                    }}
                  >
                    +91
                  </span>
                  <input
                    type="tel"
                    placeholder="98401 23456"
                    value={mobile}
                    onChange={e => setMobile(e.target.value)}
                    style={{ paddingLeft: '48px', fontSize: '1rem', letterSpacing: '0.5px' }}
                    autoFocus
                  />
                </div>
                <span style={{ fontSize: '0.74rem', color: '#94a3b8', marginTop: '4px', display: 'block' }}>
                  10-digit Indian phone number starting with 6, 7, 8, or 9
                </span>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={handleResetState}
                  style={{ flex: 1 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={loading}
                  style={{ flex: 1 }}
                >
                  {loading ? 'Sending Code...' : 'Request OTP'}
                  <ArrowRight size={16} />
                </button>
              </div>
            </form>
          )}

          {/* STEP 2: OTP VERIFICATION */}
          {step === 2 && (
            <form onSubmit={handleVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <p style={{ fontSize: '0.88rem', color: '#475569' }}>
                Enter the 6-digit verification code sent to <strong>+91 {mobile}</strong>.
              </p>

              <div className="form-group">
                <label style={{ fontWeight: 600 }}>6-Digit OTP Code</label>
                <input
                  type="text"
                  maxLength={6}
                  placeholder="• • • • • •"
                  value={otp}
                  onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                  style={{
                    textAlign: 'center',
                    fontSize: '1.4rem',
                    letterSpacing: '8px',
                    fontWeight: 800,
                    color: '#0f172a',
                  }}
                  autoFocus
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem' }}>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  style={{ color: '#64748b', textDecoration: 'underline' }}
                >
                  Change phone number
                </button>

                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={cooldown > 0 || loading}
                  style={{
                    color: cooldown > 0 ? '#94a3b8' : 'var(--primary)',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    cursor: cooldown > 0 ? 'not-allowed' : 'pointer',
                  }}
                >
                  <RefreshCw size={14} className={loading ? 'spin' : ''} />
                  <span>{cooldown > 0 ? `Resend OTP in ${cooldown}s` : 'Resend Code'}</span>
                </button>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setStep(1)}
                  style={{ flex: 1 }}
                >
                  Back
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={loading || otp.length !== 6}
                  style={{ flex: 1 }}
                >
                  {loading ? 'Verifying...' : 'Verify OTP'}
                  <ArrowRight size={16} />
                </button>
              </div>
            </form>
          )}

          {/* STEP 3: NEW PASSWORD & CONFIRMATION */}
          {step === 3 && (
            <form onSubmit={handleResetPassword} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <p style={{ fontSize: '0.88rem', color: '#475569' }}>
                Create a secure new password for your account.
              </p>

              <div className="form-group">
                <label style={{ fontWeight: 600 }}>New Password (புதிய கடவுச்சொல்)</label>
                <div style={{ position: 'relative' }}>
                  <Lock size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="At least 8 chars with letters & numbers"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
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
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>

                {/* Password strength tips */}
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
                <label style={{ fontWeight: 600 }}>Confirm New Password (மீண்டும் உறுதி செய்க)</label>
                <div style={{ position: 'relative' }}>
                  <Lock size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Repeat new password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
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
                disabled={loading || !newPassword || !confirmPassword || newPassword !== confirmPassword || !pwdStrength.valid}
                style={{ width: '100%', marginTop: '6px' }}
              >
                {loading ? 'Updating Password...' : 'Save New Password & Continue'}
              </button>
            </form>
          )}

          {/* STEP 4: SUCCESS CONFIRMATION */}
          {step === 4 && (
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
                Your account credentials have been securely updated. You can now sign in with your new password.
              </p>
              <button
                type="button"
                className="btn btn-primary btn-lg"
                onClick={handleResetState}
                style={{ width: '100%' }}
              >
                Return to Sign In
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
