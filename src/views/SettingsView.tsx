import React, { useState, useRef, useEffect } from 'react';
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
  Download,
  Upload,
  FileSpreadsheet,
  HardDrive,
  RefreshCw,
  AlertCircle,
  Layers,
  LogOut,
} from 'lucide-react';
import type { User } from '../db/types';
import { storageService, DB_VERSION } from '../services/storage';
import { BRAND_COLORS } from '../config/brand';
import BrandLogo from '../components/BrandLogo';
import { useLanguage } from '../services/i18n';

interface SettingsViewProps {
  user: User | null;
  onBack: () => void;
  onNavigate: (view: string) => void;
  onNotify: (msg: string, type?: 'success' | 'error' | 'info') => void;
  /** Signs out and returns to the Welcome screen. */
  onSignOut?: () => void;
  signingOut?: boolean;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  user,
  onBack,
  onNavigate,
  onNotify,
  onSignOut,
  signingOut = false,
}) => {
  const { t } = useLanguage();
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

  // Backup & Sync State
  const [exportingJSON, setExportingJSON] = useState(false);
  const [exportingCSV, setExportingCSV] = useState(false);
  const [importing, setImporting] = useState(false);
  const [conflictMode, setConflictMode] = useState<'merge' | 'overwrite'>('merge');
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importSuccessMsg, setImportSuccessMsg] = useState<string | null>(null);
  const [stats, setStats] = useState<{ sites: number; workers: number; plans: number }>({ sites: 0, workers: 0, plans: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    storageService.autoMigrate().catch(() => {});
    Promise.all([
      storageService.getSites(),
      storageService.getWorkers(),
      storageService.getPlans(),
    ]).then(([s, w, p]) => {
      setStats({ sites: s.length, workers: w.length, plans: p.length });
    }).catch(() => {});
  }, []);

  const handleExportJSON = async () => {
    setExportingJSON(true);
    try {
      const filename = await storageService.downloadJSON(user);
      onNotify(`Backup exported successfully: ${filename}`, 'success');
    } catch (err: any) {
      onNotify(`Export failed: ${err.message}`, 'error');
    } finally {
      setExportingJSON(false);
    }
  };

  const handleExportCSV = async () => {
    setExportingCSV(true);
    try {
      const filename = await storageService.downloadSummaryCSV();
      onNotify(`CSV summary downloaded: ${filename}`, 'success');
    } catch (err: any) {
      onNotify(`CSV export failed: ${err.message}`, 'error');
    } finally {
      setExportingCSV(false);
    }
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportErrors([]);
    setImportSuccessMsg(null);

    try {
      const text = await file.text();
      const res = await storageService.importJSON(text, conflictMode);
      if (res.success) {
        setImportSuccessMsg(res.message);
        onNotify(res.message, 'success');
        // Refresh counts
        const [s, w, p] = await Promise.all([
          storageService.getSites(),
          storageService.getWorkers(),
          storageService.getPlans(),
        ]);
        setStats({ sites: s.length, workers: w.length, plans: p.length });
      } else {
        setImportErrors(res.errors || [res.message]);
        onNotify(res.message, 'error');
      }
    } catch (err: any) {
      setImportErrors([err.message || 'Failed to read backup file']);
      onNotify(`Import failed: ${err.message}`, 'error');
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

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
        {/* About: the app's name and logo (from src/config/brand.ts) */}
        <div className="settings-about" style={{ background: BRAND_COLORS.card, border: '1px solid #E7E5E4', borderRadius: '14px', padding: '18px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
          <BrandLogo size={48} showTagline />
          <span style={{ fontSize: '0.85rem', color: '#57534E' }}>Data version {DB_VERSION}</span>
        </div>

        {/* Card 1: User Profile */}
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '14px', padding: '22px', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
            <UserIcon size={20} style={{ color: 'var(--color-charcoal)' }} />
            <h3 style={{ fontSize: '1.1rem', margin: 0, color: 'var(--color-charcoal)' }}>Contractor / User Profile</h3>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
            <div>
              <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', fontWeight: 600, display: 'block' }}>User Name</span>
              <strong style={{ fontSize: '0.94rem', color: 'var(--color-charcoal)' }}>{user?.fullName || user?.username || 'Local Contractor'}</strong>
            </div>
            <div>
              <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', fontWeight: 600, display: 'block' }}>Role</span>
              <strong style={{ fontSize: '0.94rem', color: 'var(--color-charcoal)' }}>{user?.role || 'Admin / Builder'}</strong>
            </div>
            <div>
              <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', fontWeight: 600, display: 'block' }}>Contact / Mobile</span>
              <strong style={{ fontSize: '0.94rem', color: 'var(--color-charcoal)' }}>{user?.mobile || (user as any)?.phone || 'Not configured'}</strong>
            </div>
          </div>
          {onSignOut && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginTop: '16px', paddingTop: '14px', borderTop: '1px solid var(--color-border)' }}>
              <span style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)', minWidth: 0, overflowWrap: 'anywhere' }}>
                {t('auth_signed_in_as')} <strong style={{ color: 'var(--color-charcoal)' }}>{user?.email || user?.mobile || user?.fullName}</strong>
              </span>
              <button
                type="button"
                id="settings-sign-out"
                onClick={onSignOut}
                disabled={signingOut}
                aria-busy={signingOut}
                style={{ minHeight: 44, padding: '0 18px', borderRadius: 12, border: '2px solid var(--color-danger)', background: 'var(--color-surface)', color: 'var(--color-danger-text)', fontWeight: 700, fontSize: '0.95rem', display: 'inline-flex', alignItems: 'center', gap: 8, cursor: signingOut ? 'not-allowed' : 'pointer' }}
              >
                <LogOut size={18} aria-hidden="true" />
                {signingOut ? t('auth_signing_out') : t('auth_sign_out')}
              </button>
            </div>
          )}
        </div>

        {/* Card 2: Regional & Financial Conventions */}
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '14px', padding: '22px', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
            <Globe size={20} style={{ color: 'var(--color-success)' }} />
            <h3 style={{ fontSize: '1.1rem', margin: 0, color: 'var(--color-charcoal)' }}>Regional & Financial Conventions</h3>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
            <div>
              <label style={{ fontSize: '0.84rem', color: 'var(--color-text-secondary)', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                Primary Currency
              </label>
              <input
                type="text"
                value="Indian Rupee (₹ INR) — en-IN numbering"
                readOnly
                disabled
                style={{ width: '100%', minHeight: 44, padding: '9px 12px', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: '8px', fontSize: '0.88rem', color: 'var(--color-charcoal)' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.84rem', color: 'var(--color-text-secondary)', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                Default Measurement Standard
              </label>
              <select
                value={unitSystem}
                onChange={e => setUnitSystem(e.target.value as 'feet' | 'meter')}
                style={{ width: '100%', minHeight: 44, padding: '9px 12px', background: 'var(--color-surface)', border: '1.5px solid var(--color-border-strong)', borderRadius: '8px', fontSize: '0.88rem', color: 'var(--color-charcoal)' }}
              >
                <option value="feet">Imperial (Feet, Inches, Sq.ft) — Indian Construction Standard</option>
                <option value="meter">Metric (Metres, Millimetres, Sq.m)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Card 3: Drafting & Interface Options */}
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '14px', padding: '22px', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
            <Sliders size={20} style={{ color: 'var(--color-charcoal)' }} />
            <h3 style={{ fontSize: '1.1rem', margin: 0, color: 'var(--color-charcoal)' }}>CAD & Interface Preferences</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', minHeight: 44, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={voiceAssist}
                onChange={e => setVoiceAssist(e.target.checked)}
                style={{ width: '20px', height: '20px', accentColor: 'var(--color-primary)' }}
              />
              <div>
                <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--color-charcoal)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Volume2 size={16} /> Tamil Audio Guidance (குரல் வழிகாட்டுதல்)
                </span>
                <span style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>Announce CAD tool selection and drawing operations in Tamil.</span>
              </div>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', minHeight: 44, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={showTips}
                onChange={e => setShowTips(e.target.checked)}
                style={{ width: '20px', height: '20px', accentColor: 'var(--color-primary)' }}
              />
              <div>
                <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--color-charcoal)' }}>
                  Live Tool Hints & Snapping HUD
                </span>
                <span style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>Display dynamic drafting tips and alignment guidelines on the canvas.</span>
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

        {/* Card 4: Backup & Data Sync (Phase 1 Engine) */}
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '16px', padding: '24px', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <HardDrive size={22} style={{ color: 'var(--color-primary)' }} />
              <div>
                <h3 style={{ fontSize: '1.15rem', margin: 0, color: 'var(--color-charcoal)', fontWeight: 700 }}>
                  Backup &amp; Sync Engine
                </h3>
                <span style={{ fontSize: '0.84rem', color: 'var(--color-text-muted)' }}>
                  Zero data loss persistence with IndexedDB, localStorage fallback, and portable backups.
                </span>
              </div>
            </div>

            {/* Badges */}
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 700, padding: '3px 10px', borderRadius: '999px', background: 'var(--color-success-soft)', color: 'var(--color-success-text)', border: '1px solid var(--color-success-border)' }}>
                Offline Ready
              </span>
              <span style={{ fontSize: '0.78rem', fontWeight: 700, padding: '3px 10px', borderRadius: '999px', background: 'var(--color-primary-soft)', color: 'var(--color-primary-text)', border: '1px solid var(--color-primary-border)' }}>
                DB v{DB_VERSION}
              </span>
              <span style={{ fontSize: '0.78rem', fontWeight: 700, padding: '3px 10px', borderRadius: '999px', background: 'var(--color-warning-soft)', color: 'var(--color-warning-text)', border: '1px solid var(--color-warning-border)' }}>
                Auto-Save 500ms
              </span>
            </div>
          </div>

          {/* Quick Record Counter */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px', padding: '12px', background: 'var(--color-bg)', borderRadius: '10px', border: '1px solid var(--color-border)', marginBottom: '18px' }}>
            <div>
              <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', fontWeight: 600, display: 'block' }}>Active Sites</span>
              <strong style={{ fontSize: '1.1rem', color: 'var(--color-charcoal)' }}>{stats.sites}</strong>
            </div>
            <div>
              <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', fontWeight: 600, display: 'block' }}>Labour / Workers</span>
              <strong style={{ fontSize: '1.1rem', color: 'var(--color-charcoal)' }}>{stats.workers}</strong>
            </div>
            <div>
              <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', fontWeight: 600, display: 'block' }}>Floor Plans</span>
              <strong style={{ fontSize: '1.1rem', color: 'var(--color-charcoal)' }}>{stats.plans}</strong>
            </div>
          </div>

          {/* Export & Import Row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '18px' }}>
            {/* Export Column */}
            <div style={{ padding: '16px', background: 'var(--color-bg)', borderRadius: '12px', border: '1px solid var(--color-border)' }}>
              <h4 style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--color-charcoal)', margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Download size={15} style={{ color: 'var(--color-primary)' }} /> Export Portable Backups
              </h4>
              <p style={{ fontSize: '0.84rem', color: 'var(--color-text-muted)', margin: '0 0 12px' }}>
                Download complete database or human-readable CSV summary.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button
                  type="button"
                  onClick={handleExportJSON}
                  disabled={exportingJSON}
                  className="btn btn-primary btn-sm"
                  style={{ width: '100%' }}
                >
                  <Download size={15} />
                  <span>{exportingJSON ? 'Exporting...' : 'Export JSON Backup (.json)'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleExportCSV}
                  disabled={exportingCSV}
                  className="btn btn-outline btn-sm"
                  style={{ width: '100%' }}
                >
                  <FileSpreadsheet size={15} />
                  <span>{exportingCSV ? 'Preparing...' : 'Export Excel / CSV Summary (.csv)'}</span>
                </button>
              </div>
            </div>

            {/* Import Column */}
            <div style={{ padding: '16px', background: '#f0fdf4', borderRadius: '12px', border: '1px solid #dcfce7' }}>
              <h4 style={{ fontSize: '0.88rem', fontWeight: 700, color: '#14532d', margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Upload size={15} /> Restore / Import Backup
              </h4>
              <p style={{ fontSize: '0.75rem', color: '#166534', margin: '0 0 10px' }}>
                Select conflict resolution and upload a valid JSON backup.
              </p>

              {/* Conflict Mode Selector */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#166534' }}>Conflict Resolution:</span>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: '#1e293b', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="conflictMode"
                    value="merge"
                    checked={conflictMode === 'merge'}
                    onChange={() => setConflictMode('merge')}
                  />
                  <span>Merge (Safe)</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: '#1e293b', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="conflictMode"
                    value="overwrite"
                    checked={conflictMode === 'overwrite'}
                    onChange={() => setConflictMode('overwrite')}
                  />
                  <span>Overwrite</span>
                </label>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileImport}
                disabled={importing}
                style={{ fontSize: '0.78rem', width: '100%', padding: '6px', background: '#ffffff', borderRadius: '6px', border: '1px solid #bbf7d0' }}
              />

              {importing && (
                <span style={{ fontSize: '0.75rem', color: '#15803d', display: 'block', marginTop: '6px' }}>
                  Validating schema and restoring records...
                </span>
              )}
            </div>
          </div>

          {/* Inline Validation / Success Messages */}
          {importSuccessMsg && (
            <div style={{ marginTop: '14px', padding: '10px 14px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '8px', color: '#15803d', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle2 size={16} />
              <span>{importSuccessMsg}</span>
            </div>
          )}

          {importErrors.length > 0 && (
            <div style={{ marginTop: '14px', padding: '12px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#991b1b', fontSize: '0.78rem' }}>
              <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                <AlertCircle size={15} /> Validation Issues During Import:
              </div>
              <ul style={{ margin: '0 0 0 18px', padding: 0 }}>
                {importErrors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Card 5: Quick Navigation to Data Operations */}
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
