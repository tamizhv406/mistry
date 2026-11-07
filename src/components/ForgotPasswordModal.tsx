import React, { useEffect, useState } from 'react';
import {
  KeyRound,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  X,
  User,
  ArrowRight,
  Lock,
  Eye,
  EyeOff,
  HelpCircle,
  Mail,
} from 'lucide-react';
import { db } from '../db/db';
import type { User as UserType } from '../db/types';
import { requestEmailPasswordReset } from '../services/emailRecoveryService';

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
  onLoginRequest?: () => void;
}

type Step = 'lookup' | 'questions' | 'new_password' | 'done';

export const ForgotPasswordModal: React.FC<ForgotPasswordModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  onLoginRequest,
}) => {
  const [step, setStep] = useState<Step>('lookup');
  const [identifier, setIdentifier] = useState('');
  const [matchedUser, setMatchedUser] = useState<UserType | null>(null);

  // Security questions & answers
  const [q1Text, setQ1Text] = useState('உங்களின் முதல் பள்ளி எது? (What is your first school?)');
  const [q2Text, setQ2Text] = useState('உங்களுக்கு பிடித்த ஊர் எது? (What is your favorite town?)');
  const [q3Text, setQ3Text] = useState('உங்கள் தாயாரின் பெயர் என்ன? (What is your mother\'s name?)');

  const [ans1, setAns1] = useState('');
  const [ans2, setAns2] = useState('');
  const [ans3, setAns3] = useState('');

  // Password reset
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    if (isOpen) {
      setStep('lookup');
      setIdentifier('');
      setMatchedUser(null);
      setAns1('');
      setAns2('');
      setAns3('');
      setNewPassword('');
      setConfirmPassword('');
      setError('');
      setSuccessMessage('');
      setLoading(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const close = () => {
    setError('');
    setSuccessMessage('');
    onClose();
  };

  // STEP 1: Lookup User by Username, Mobile Number or Email (Zero SMS cost)
  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = identifier.trim().toLowerCase();
    const cleanDigits = identifier.replace(/\D/g, '');

    if (!cleanId && !cleanDigits) {
      setError('பயனர் பெயர், அலைபேசி எண் அல்லது மின்னஞ்சலை உள்ளிடவும். (Please enter username, mobile number or email.)');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const user = await db.users
        .filter(u => {
          const uEmail = (u.email || '').toLowerCase();
          const uName = (u.username || '').toLowerCase();
          const uMob = (u.mobile || '').replace(/\D/g, '');
          return (
            (cleanId && (uEmail === cleanId || uName === cleanId)) ||
            (cleanDigits.length >= 10 && uMob.includes(cleanDigits.slice(-10)))
          );
        })
        .first();

      if (!user) {
        setError('இந்த விவரங்களுடன் கணக்கு ஏதும் கண்டறியப்படவில்லை. (No account found with these details.)');
        setLoading(false);
        return;
      }

      setMatchedUser(user);

      // Check stored security questions in user object or localStorage
      const localStored = localStorage.getItem('mistry_security_questions_' + user.email?.toLowerCase());
      const parsedStored = localStored ? JSON.parse(localStored) : null;
      const sec = user.securityQuestions || parsedStored;

      if (sec) {
        if (sec.q1) setQ1Text(sec.q1);
        if (sec.q2) setQ2Text(sec.q2);
        if (sec.q3) setQ3Text(sec.q3);
      }

      setStep('questions');
    } catch (err: any) {
      setError('பிழை ஏற்பட்டது: ' + (err.message || 'Error looking up account'));
    } finally {
      setLoading(false);
    }
  };

  // STEP 2: Verify Security Questions Answers
  const handleVerifyQuestions = (e: React.FormEvent) => {
    e.preventDefault();
    if (!matchedUser) return;

    const a1 = ans1.trim().toLowerCase();
    const a2 = ans2.trim().toLowerCase();
    const a3 = ans3.trim().toLowerCase();

    if (!a1 || !a2 || !a3) {
      setError('அனைத்து 3 பாதுகாப்பு கேள்விகளுக்கும் பதிலளிக்கவும். (Please answer all 3 security questions.)');
      return;
    }

    const localStored = localStorage.getItem('mistry_security_questions_' + matchedUser.email?.toLowerCase());
    const parsedStored = localStored ? JSON.parse(localStored) : null;
    const sec = matchedUser.securityQuestions || parsedStored || {};

    const expected1 = (sec.nameAnswer || sec.a1 || '').trim().toLowerCase();
    const expected2 = (sec.cityAnswer || sec.a2 || '').trim().toLowerCase();
    const expected3 = (sec.friendAnswer || sec.a3 || '').trim().toLowerCase();

    // Verify answers (if answers weren't set on initial demo account, accept reasonably valid answers)
    const match1 = !expected1 || a1 === expected1;
    const match2 = !expected2 || a2 === expected2;
    const match3 = !expected3 || a3 === expected3;

    if (!match1 || !match2 || !match3) {
      setError('தவறான பதில்கள். மீண்டும் முயற்சிக்கவும். (Incorrect answers. Please try again.)');
      return;
    }

    setError('');
    setStep('new_password');
  };

  // STEP 3: Reset Password Directly (Zero cost)
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!matchedUser) return;

    if (newPassword.length < 6) {
      setError('புதிய கடவுச்சொல் குறைந்தது 6 எழுத்துகள் இருக்க வேண்டும். (Password must be at least 6 characters.)');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('கடவுச்சொற்கள் பொருந்தவில்லை. (Passwords do not match.)');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await db.users.update(matchedUser.id, {
        passwordHash: newPassword,
        updatedAt: new Date().toISOString(),
      });

      setStep('done');
      setSuccessMessage('கடவுச்சொல் வெற்றிகரமாக மாற்றப்பட்டது! (Password updated successfully!)');
      onSuccess('கடவுச்சொல் வெற்றிகரமாக மாற்றப்பட்டது! (Password updated successfully!)');
    } catch (err: any) {
      setError('கடவுச்சொல் மாற்ற முடியவில்லை: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={close} style={{ zIndex: 1250 }}>
      <div
        className="modal-dialog"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: '480px', width: '100%', borderRadius: '16px', overflow: 'hidden' }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="forgot-pwd-title"
      >
        {/* Header */}
        <div className="modal-header" style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#f8fafc' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#fef3c7', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <KeyRound size={20} />
            </div>
            <div>
              <h3 id="forgot-pwd-title" style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
                கடவுச்சொல் மீட்டெடுப்பு (Password Reset)
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '0.74rem', color: '#64748b' }}>
                பாதுகாப்பு கேள்விகள் மூலம் உடனடி மீட்டெடுப்பு (Zero SMS Cost)
              </p>
            </div>
          </div>
          <button type="button" className="modal-close" onClick={close} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="modal-body" style={{ padding: '20px' }}>
          {error && (
            <div role="alert" style={{ backgroundColor: '#fee2e2', color: '#991b1b', padding: '10px 14px', borderRadius: 10, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.82rem', fontWeight: 600 }}>
              <AlertCircle size={18} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          {/* STEP 1: LOOKUP */}
          {step === 'lookup' && (
            <form onSubmit={handleLookup} style={{ display: 'grid', gap: '14px' }}>
              <p style={{ fontSize: '0.84rem', color: '#475569', margin: 0 }}>
                உங்கள் பயனர் பெயர், பதிவு செய்த அலைபேசி எண் அல்லது மின்னஞ்சலை உள்ளிடவும்:
              </p>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#1e293b', marginBottom: '6px' }}>
                  பயனர் பெயர் / அலைபேசி எண் (Username or Mobile)
                </label>
                <div style={{ position: 'relative' }}>
                  <User size={18} color="#94a3b8" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="email"
                    id="fp-email-recovery"
                    value={identifier.includes('@') ? identifier : ''}
                    onChange={e => setIdentifier(e.target.value)}
                    style={{ display: 'none' }}
                    tabIndex={-1}
                    aria-hidden="true"
                    autoComplete="email"
                  />
                  <input
                    type="text"
                    id="fp-identifier"
                    value={identifier}
                    onChange={e => setIdentifier(e.target.value)}
                    placeholder="எ.கா. 9876543210 அல்லது user@example.com"
                    required
                    style={{
                      width: '100%',
                      padding: '10px 12px 10px 38px',
                      borderRadius: 10,
                      border: '1.5px solid #cbd5e1',
                      fontSize: '0.9rem',
                      outline: 'none',
                    }}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  padding: '12px',
                  borderRadius: 10,
                  backgroundColor: '#0284c7',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  border: 'none',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  marginTop: 6,
                }}
              >
                <span>அடுத்து (Next)</span>
                <ArrowRight size={16} />
              </button>
            </form>
          )}

          {/* STEP 2: SECURITY QUESTIONS */}
          {step === 'questions' && (
            <form onSubmit={handleVerifyQuestions} style={{ display: 'grid', gap: '14px' }}>
              <div style={{ backgroundColor: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 10, padding: '10px 14px', display: 'flex', gap: 8, alignItems: 'center' }}>
                <HelpCircle size={18} color="#0284c7" />
                <span style={{ fontSize: '0.8rem', color: '#0369a1', fontWeight: 600 }}>
                  கணக்கு உறுதிசெய்யப்பட்டது: <strong>{matchedUser?.fullName || matchedUser?.username}</strong>. கீழே உள்ள பாதுகாப்பு கேள்விகளுக்கு பதிலளிக்கவும்.
                </span>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                  கேள்வி 1: {q1Text}
                </label>
                <input
                  type="text"
                  value={ans1}
                  onChange={e => setAns1(e.target.value)}
                  placeholder="பதில் 1 (Answer 1)"
                  required
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid #cbd5e1', fontSize: '0.88rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                  கேள்வி 2: {q2Text}
                </label>
                <input
                  type="text"
                  value={ans2}
                  onChange={e => setAns2(e.target.value)}
                  placeholder="பதில் 2 (Answer 2)"
                  required
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid #cbd5e1', fontSize: '0.88rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                  கேள்வி 3: {q3Text}
                </label>
                <input
                  type="text"
                  value={ans3}
                  onChange={e => setAns3(e.target.value)}
                  placeholder="பதில் 3 (Answer 3)"
                  required
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid #cbd5e1', fontSize: '0.88rem' }}
                />
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                <button
                  type="button"
                  onClick={() => setStep('lookup')}
                  style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1px solid #cbd5e1', background: '#f8fafc', color: '#475569', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer' }}
                >
                  பின்செல்ல (Back)
                </button>
                <button
                  type="submit"
                  style={{ flex: 2, padding: '10px', borderRadius: 10, border: 'none', background: '#0284c7', color: '#ffffff', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}
                >
                  சரிபார்க்கவும் (Verify Answers)
                </button>
              </div>
            </form>
          )}

          {/* STEP 3: NEW PASSWORD */}
          {step === 'new_password' && (
            <form onSubmit={handleResetPassword} style={{ display: 'grid', gap: '14px' }}>
              <div style={{ backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 10, padding: '10px 14px', display: 'flex', gap: 8, alignItems: 'center' }}>
                <ShieldCheck size={18} color="#059669" />
                <span style={{ fontSize: '0.8rem', color: '#065f46', fontWeight: 600 }}>
                  பதில்கள் சரிபார்க்கப்பட்டன! இப்போது புதிய கடவுச்சொல்லை அமைக்கவும்.
                </span>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#1e293b', marginBottom: 6 }}>
                  புதிய கடவுச்சொல் (New Password)
                </label>
                <div style={{ position: 'relative' }}>
                  <Lock size={18} color="#94a3b8" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="குறைந்தது 6 எழுத்துகள்"
                    required
                    style={{ width: '100%', padding: '10px 38px 10px 38px', borderRadius: 10, border: '1.5px solid #cbd5e1', fontSize: '0.9rem' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(p => !p)}
                    style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#1e293b', marginBottom: 6 }}>
                  கடவுச்சொல்லை மீண்டும் உள்ளிடவும் (Confirm Password)
                </label>
                <div style={{ position: 'relative' }}>
                  <Lock size={18} color="#94a3b8" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="கடவுச்சொல் உறுதிப்படுத்தல்"
                    required
                    style={{ width: '100%', padding: '10px 12px 10px 38px', borderRadius: 10, border: '1.5px solid #cbd5e1', fontSize: '0.9rem' }}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  padding: '12px',
                  borderRadius: 10,
                  backgroundColor: '#16a34a',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  border: 'none',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  marginTop: 6,
                }}
              >
                {loading ? 'மாற்றப்படுகிறது...' : 'கடவுச்சொல்லை மாற்று (Save New Password)'}
              </button>
            </form>
          )}

          {/* STEP 4: DONE */}
          {step === 'done' && (
            <div style={{ display: 'grid', gap: '16px', textAlign: 'center', padding: '10px 0' }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', backgroundColor: '#dcfce7', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
                <CheckCircle2 size={28} />
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a', fontWeight: 800 }}>
                  வெற்றிகரமாக மாற்றப்பட்டது!
                </h4>
                <p style={{ margin: '6px 0 0', fontSize: '0.84rem', color: '#64748b' }}>
                  உங்கள் புதிய கடவுச்சொல் சேமிக்கப்பட்டது. இப்போது உள்நுழையலாம்.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  close();
                  if (onLoginRequest) onLoginRequest();
                }}
                style={{
                  padding: '12px',
                  borderRadius: 10,
                  backgroundColor: '#0284c7',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                உள்நுழைக (Sign In Now)
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
