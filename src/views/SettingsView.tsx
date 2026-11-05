import React, { useState } from 'react';
import {
  Settings,
  ArrowLeft,
  User as UserIcon,
  Globe,
  Sliders,
  Database,
  Building2,
  CheckCircle2,
  Shield,
  Volume2,
  FileCode,
} from 'lucide-react';
import type { User } from '../db/types';

interface SettingsViewProps {
  user: User | null;
  onBack: () => void;
  onNavigate: (view: string) => void;
  onNotify: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  user,
  onBack,
  onNavigate,
  onNotify,
}) => {
  const [unitSystem, setUnitSystem] = useState<'feet' | 'meter'>(() => {
    try {
      return (localStorage.getItem('bm_unit_system') as 'feet' | 'meter') || 'feet';
    } catch {
      return 'feet';
    }
  });

  const [voiceAssist, setVoiceAssist] = useState<boolean>(() => {
    try {
      return localStorage.getItem('bm_voice_assist') !== 'false';
    } catch {
      return true;
    }
  });

  const [showTips, setShowTips] = useState<boolean>(() => {
    try {
      return localStorage.getItem('bm_show_tips') !== 'false';
    } catch {
      return true;
    }
  });

  const handleSavePreferences = () => {
    try {
      localStorage.setItem('bm_unit_system', unitSystem);
      localStorage.setItem('bm_voice_assist', String(voiceAssist));
      localStorage.setItem('bm_show_tips', String(showTips));
      onNotify('Settings saved successfully.', 'success');
    } catch {
      onNotify('Failed to save settings to localStorage.', 'error');
    }
  };

  return (
    <div className="main-wrapper">
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={onBack}
          style={{ marginBottom: '8px' }}
        >
          <ArrowLeft size={16} />
          <span>Back to Dashboard</span>
        </button>
        <h2 style={{ fontSize: '1.8rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Settings size={26} color="var(--primary)" />
          Application Settings & Preferences
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem' }}>
          Configure regional conventions, drafting units, interface preferences, and profile defaults.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '840px' }}>
        {/* Card 1: User Profile */}
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '22px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
            <UserIcon size={20} className="text-blue-600" />
            <h3 style={{ fontSize: '1.1rem', margin: 0, color: '#0f172a' }}>Contractor / User Profile</h3>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
            <div>
              <span style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 600, display: 'block' }}>User Name</span>
              <strong style={{ fontSize: '0.92rem', color: '#1e293b' }}>{user?.fullName || user?.username || 'Local Contractor'}</strong>
            </div>
            <div>
              <span style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 600, display: 'block' }}>Role</span>
              <strong style={{ fontSize: '0.92rem', color: '#1e293b' }}>{user?.role || 'Admin / Builder'}</strong>
            </div>
            <div>
              <span style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 600, display: 'block' }}>Contact / Mobile</span>
              <strong style={{ fontSize: '0.92rem', color: '#1e293b' }}>{user?.mobile || (user as any)?.phone || 'Not configured'}</strong>
            </div>
          </div>
        </div>

        {/* Card 2: Regional & Financial Conventions */}
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '22px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
            <Globe size={20} className="text-emerald-600" />
            <h3 style={{ fontSize: '1.1rem', margin: 0, color: '#0f172a' }}>Regional & Financial Conventions</h3>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
            <div>
              <label style={{ fontSize: '0.78rem', color: '#475569', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                Primary Currency
              </label>
              <input
                type="text"
                value="Indian Rupee (₹ INR) — en-IN numbering"
                readOnly
                disabled
                style={{ width: '100%', padding: '9px 12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.88rem', color: '#334155' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.78rem', color: '#475569', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                Default Measurement Standard
              </label>
              <select
                value={unitSystem}
                onChange={e => setUnitSystem(e.target.value as 'feet' | 'meter')}
                style={{ width: '100%', padding: '9px 12px', background: '#ffffff', border: '1.5px solid #cbd5e1', borderRadius: '8px', fontSize: '0.88rem', color: '#0f172a' }}
              >
                <option value="feet">Imperial (Feet, Inches, Sq.ft) — Indian Construction Standard</option>
                <option value="meter">Metric (Metres, Millimetres, Sq.m)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Card 3: Drafting & Interface Options */}
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '22px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
            <Sliders size={20} className="text-purple-600" />
            <h3 style={{ fontSize: '1.1rem', margin: 0, color: '#0f172a' }}>CAD & Interface Preferences</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={voiceAssist}
                onChange={e => setVoiceAssist(e.target.checked)}
                style={{ width: '18px', height: '18px', accentColor: '#2563eb' }}
              />
              <div>
                <span style={{ fontSize: '0.88rem', fontWeight: 600, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Volume2 size={16} /> Tamil Audio Guidance (குரல் வழிகாட்டுதல்)
                </span>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Announce CAD tool selection and drawing operations in Tamil.</span>
              </div>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={showTips}
                onChange={e => setShowTips(e.target.checked)}
                style={{ width: '18px', height: '18px', accentColor: '#2563eb' }}
              />
              <div>
                <span style={{ fontSize: '0.88rem', fontWeight: 600, color: '#1e293b' }}>
                  Live Tool Hints & Snapping HUD
                </span>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Display dynamic drafting tips and alignment guidelines on the canvas.</span>
              </div>
            </label>
          </div>

          <div style={{ marginTop: '18px', display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSavePreferences}
            >
              <CheckCircle2 size={16} />
              <span>Save Preferences</span>
            </button>
          </div>
        </div>

        {/* Card 4: Quick Navigation to Data Operations */}
        <div style={{ background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '14px', padding: '20px' }}>
          <h4 style={{ fontSize: '0.92rem', color: '#334155', margin: '0 0 10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Shield size={18} className="text-slate-600" />
            Looking for Database & Project Controls?
          </h4>
          <p style={{ fontSize: '0.82rem', color: '#64748b', margin: '0 0 14px' }}>
            To keep settings uncluttered, data export/restore operations and project management are organized in dedicated centers:
          </p>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => onNavigate('backup')}
            >
              <Database size={16} />
              <span>Go to Backup & Data Center</span>
            </button>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => onNavigate('my-sites')}
            >
              <Building2 size={16} />
              <span>Manage Projects Portfolio</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
