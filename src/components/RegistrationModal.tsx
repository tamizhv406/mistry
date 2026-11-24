import React, { useState } from 'react';
import {
  UserPlus,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  X,
  User,
  Phone,
  Mail,
  Lock,
  Eye,
  EyeOff,
  HelpCircle,
  HardHat,
} from 'lucide-react';
import { db } from '../db/db';
import { setCurrentUser } from '../services/auth';
import type { User as UserType } from '../db/types';

interface RegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRegisterSuccess: (user: UserType) => void;
  onSwitchToLogin?: () => void;
}

const SECURITY_QUESTIONS_1 = [
  'உங்களின் முதல் பள்ளி எது? (What is your first school?)',
  'உங்கள் பிறந்த ஊர் எது? (What is your birthplace?)',
  'உங்கள் முதல் செல்லப்பிராணியின் பெயர் என்ன? (What was your first pet\'s name?)',
];

const SECURITY_QUESTIONS_2 = [
  'உங்களுக்கு பிடித்த ஊர் எது? (What is your favorite town?)',
  'உங்களுக்கு பிடித்த உணவு எது? (What is your favorite food?)',
  'உங்களின் விருப்பமான நிறம் எது? (What is your favorite color?)',
];

const SECURITY_QUESTIONS_3 = [
  'உங்கள் தாயாரின் பெயர் என்ன? (What is your mother\'s name?)',
  'உங்கள் தந்தை பிறந்த ஊர் எது? (What is your father\'s birthplace?)',
  'உங்கள் பால்ய கால நண்பர் யார்? (Who is your childhood friend?)',
];

export const RegistrationModal: React.FC<RegistrationModalProps> = ({
  isOpen,
  onClose,
  onRegisterSuccess,
  onSwitchToLogin,
}) => {
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'contractor' | 'engineer'>('contractor');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Security questions dropdown selection & answers
  const [selectedQ1, setSelectedQ1] = useState(SECURITY_QUESTIONS_1[0]);
  const [selectedQ2, setSelectedQ2] = useState(SECURITY_QUESTIONS_2[0]);
  const [selectedQ3, setSelectedQ3] = useState(SECURITY_QUESTIONS_3[0]);

  const [ans1, setAns1] = useState('');
  const [ans2, setAns2] = useState('');
  const [ans3, setAns3] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = fullName.trim();
    const cleanUser = username.trim().toLowerCase();
    const cleanMobile = mobile.replace(/\D/g, '');
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanName) {
      setError('முழு பெயரை உள்ளிடவும். (Please enter full name.)');
      return;
    }
    if (!cleanUser || cleanUser.length < 3) {
      setError('பயனர் பெயர் குறைந்தது 3 எழுத்துகள் இருக்க வேண்டும். (Username must be at least 3 characters.)');
      return;
    }
    if (cleanMobile.length < 10) {
      setError('சரியான 10 இலக்க அலைபேசி எண்ணை உள்ளிடவும். (Please enter a valid 10-digit mobile number.)');
      return;
    }
    if (password.length < 6) {
      setError('கடவுச்சொல் குறைந்தது 6 எழுத்துகள் இருக்க வேண்டும். (Password must be at least 6 characters.)');
      return;
    }
    if (password !== confirmPassword) {
      setError('கடவுச்சொற்கள் பொருந்தவில்லை. (Passwords do not match.)');
      return;
    }

    const a1 = ans1.trim();
    const a2 = ans2.trim();
    const a3 = ans3.trim();

    if (!a1 || !a2 || !a3) {
      setError('அனைத்து 3 பாதுகாப்பு கேள்விகளுக்கும் பதிலளிக்கவும். (Please answer all 3 security questions.)');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Check existing users
      const existing = await db.users
        .filter(u => Boolean((u.username && u.username.toLowerCase() === cleanUser) || (cleanEmail && u.email && u.email.toLowerCase() === cleanEmail)))
        .first();

      if (existing) {
        setError('இந்த பயனர் பெயர் அல்லது மின்னஞ்சலில் ஏற்கனவே கணக்கு உள்ளது. (An account with this username/email already exists.)');
        setLoading(false);
        return;
      }

      const userId = 'usr_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      const securityQuestions = {
        q1: selectedQ1,
        a1: a1,
        nameAnswer: a1,
        q2: selectedQ2,
        a2: a2,
        cityAnswer: a2,
        q3: selectedQ3,
        a3: a3,
        friendAnswer: a3,
      };

      const newUser: UserType = {
        id: userId,
        username: cleanUser,
        fullName: cleanName,
        email: cleanEmail || `${cleanUser}@mistry.local`,
        mobile: cleanMobile,
        passwordHash: password,
        role: role === 'engineer' ? 'ADMIN' : 'MISTRY',
        securityQuestions,
        permissions: {
          projects: { read: true, write: true },
          labour: { read: true, write: true },
          payroll: { read: true, write: true },
          materials: { read: true, write: true },
          expenses: { read: true, write: true },
          floor_plans: { read: true, write: true },
          estimates: { read: true, write: true },
          admin: { read: role === 'engineer', write: role === 'engineer' },
        },
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await db.users.put(newUser);

      // Store security questions in localStorage for zero-cost offline recovery
      localStorage.setItem('mistry_security_questions_' + newUser.username.toLowerCase(), JSON.stringify(securityQuestions));
      if (cleanEmail) {
        localStorage.setItem('mistry_security_questions_' + cleanEmail.toLowerCase(), JSON.stringify(securityQuestions));
      }
      localStorage.setItem('mistry_security_questions_' + cleanMobile, JSON.stringify(securityQuestions));

      setCurrentUser(newUser, true);
      onRegisterSuccess(newUser);
      onClose();
    } catch (err: any) {
      setError('பதிவு செய்வதில் பிழை ஏற்பட்டது: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1250 }}>
      <div
        className="modal-dialog"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: '520px', width: '100%', borderRadius: '16px', overflow: 'hidden', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="register-title"
      >
        {/* Header */}
        <div className="modal-header" style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#f8fafc', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#e0f2fe', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <UserPlus size={20} />
            </div>
            <div>
              <h3 id="register-title" style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
                புதிய கணக்கு பதிவு (Create Account)
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '0.74rem', color: '#64748b' }}>
                பாதுகாப்பு கேள்விகளுடன் இலவச கணக்கு (Zero SMS Cost)
              </p>
            </div>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="modal-body" style={{ padding: '20px', overflowY: 'auto' }}>
          {error && (
            <div role="alert" style={{ backgroundColor: '#fee2e2', color: '#991b1b', padding: '10px 14px', borderRadius: 10, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.82rem', fontWeight: 600 }}>
              <AlertCircle size={18} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '14px' }}>
            {/* Role Selector: Mastri vs Engineer */}
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                உங்கள் தொழில் பங்கு (Select Role)
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setRole('contractor')}
                  style={{
                    padding: '10px',
                    borderRadius: 10,
                    border: role === 'contractor' ? '2px solid #0284c7' : '1px solid #cbd5e1',
                    background: role === 'contractor' ? '#f0f9ff' : '#ffffff',
                    color: role === 'contractor' ? '#0369a1' : '#475569',
                    fontWeight: 700,
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                  }}
                >
                  <HardHat size={16} />
                  <span>மேஸ்திரி (Mastri / Builder)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRole('engineer')}
                  style={{
                    padding: '10px',
                    borderRadius: 10,
                    border: role === 'engineer' ? '2px solid #0284c7' : '1px solid #cbd5e1',
                    background: role === 'engineer' ? '#f0f9ff' : '#ffffff',
                    color: role === 'engineer' ? '#0369a1' : '#475569',
                    fontWeight: 700,
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                  }}
                >
                  <span>📐 பொறியாளர் (Engineer / Arch)</span>
                </button>
              </div>
            </div>

            {/* Full Name */}
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                முழு பெயர் (Full Name) *
              </label>
              <input
                type="text"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder="எ.கா. மு. தமிழ் மாறன்"
                required
                style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid #cbd5e1', fontSize: '0.88rem' }}
              />
            </div>

            {/* Username & Mobile */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                  பயனர் பெயர் (Username) *
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="எ.கா. tamizh82"
                  required
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid #cbd5e1', fontSize: '0.88rem' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                  அலைபேசி எண் (Mobile) *
                </label>
                <input
                  type="tel"
                  value={mobile}
                  onChange={e => setMobile(e.target.value)}
                  placeholder="10 இலக்கம்"
                  required
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid #cbd5e1', fontSize: '0.88rem' }}
                />
              </div>
            </div>

            {/* Email (Optional) */}
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                மின்னஞ்சல் (Email - Optional)
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="name@example.com (விருப்பத்தேர்வு)"
                style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid #cbd5e1', fontSize: '0.88rem' }}
              />
            </div>

            {/* Password & Confirm */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                  கடவுச்சொல் (Password) *
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="குறைந்தது 6 எழுத்து"
                    required
                    style={{ width: '100%', padding: '9px 32px 9px 12px', borderRadius: 8, border: '1.5px solid #cbd5e1', fontSize: '0.88rem' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(p => !p)}
                    style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
                  >
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                  உறுதிப்படுத்து (Confirm) *
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="மீண்டும் உள்ளிடவும்"
                  required
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid #cbd5e1', fontSize: '0.88rem' }}
                />
              </div>
            </div>

            {/* 3 SECURITY QUESTIONS SECTION */}
            <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: '12px 14px', display: 'grid', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <ShieldCheck size={16} color="#0284c7" />
                <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#0f172a' }}>
                  கடவுச்சொல் மீட்பு பாதுகாப்பு கேள்விகள் (Zero SMS Cost)
                </span>
              </div>

              {/* Q1 */}
              <div>
                <select
                  value={selectedQ1}
                  onChange={e => setSelectedQ1(e.target.value)}
                  style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.78rem', marginBottom: 4, background: '#ffffff' }}
                >
                  {SECURITY_QUESTIONS_1.map(q => <option key={q} value={q}>{q}</option>)}
                </select>
                <input
                  type="text"
                  value={ans1}
                  onChange={e => setAns1(e.target.value)}
                  placeholder="உங்கள் பதில் (Answer 1) *"
                  required
                  style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
                />
              </div>

              {/* Q2 */}
              <div>
                <select
                  value={selectedQ2}
                  onChange={e => setSelectedQ2(e.target.value)}
                  style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.78rem', marginBottom: 4, background: '#ffffff' }}
                >
                  {SECURITY_QUESTIONS_2.map(q => <option key={q} value={q}>{q}</option>)}
                </select>
                <input
                  type="text"
                  value={ans2}
                  onChange={e => setAns2(e.target.value)}
                  placeholder="உங்கள் பதில் (Answer 2) *"
                  required
                  style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
                />
              </div>

              {/* Q3 */}
              <div>
                <select
                  value={selectedQ3}
                  onChange={e => setSelectedQ3(e.target.value)}
                  style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.78rem', marginBottom: 4, background: '#ffffff' }}
                >
                  {SECURITY_QUESTIONS_3.map(q => <option key={q} value={q}>{q}</option>)}
                </select>
                <input
                  type="text"
                  value={ans3}
                  onChange={e => setAns3(e.target.value)}
                  placeholder="உங்கள் பதில் (Answer 3) *"
                  required
                  style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '12px',
                borderRadius: 10,
                backgroundColor: '#0284c7',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '0.9rem',
                border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer',
                marginTop: 4,
              }}
            >
              {loading ? 'பதிவு செய்யப்படுகிறது...' : 'கணக்கை உருவாக்கு (Create Account)'}
            </button>

            {onSwitchToLogin && (
              <p style={{ textAlign: 'center', fontSize: '0.8rem', color: '#64748b', margin: '4px 0 0' }}>
                ஏற்கனவே கணக்கு உள்ளதா?{' '}
                <button
                  type="button"
                  onClick={onSwitchToLogin}
                  style={{ background: 'none', border: 'none', color: '#0284c7', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}
                >
                  உள்நுழைக (Sign In)
                </button>
              </p>
            )}
          </form>
        </div>
      </div>
    </div>
  );
};
