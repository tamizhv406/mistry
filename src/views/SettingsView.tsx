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
} from 'lucide-react';
import type { User } from '../db/types';
import { storageService, DB_VERSION } from '../services/storage';

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

        {/* Card 4: Backup & Data Sync (Phase 1 Engine) */}
        <div style={{ background: '#ffffff', border: '1.5px solid #cbd5e1', borderRadius: '16px', padding: '24px', boxShadow: '0 2px 8px rgba(15, 23, 42, 0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <HardDrive size={22} className="text-indigo-600" />
              <div>
                <h3 style={{ fontSize: '1.15rem', margin: 0, color: '#0f172a', fontWeight: 700 }}>
                  Backup &amp; Sync Engine
                </h3>
                <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                  Zero data loss persistence with IndexedDB, localStorage fallback, and portable backups.
                </span>
              </div>
            </div>

            {/* Badges */}
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '3px 8px', borderRadius: '999px', background: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0' }}>
                Offline Ready
              </span>
              <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '3px 8px', borderRadius: '999px', background: '#eff6ff', color: '#1e40af', border: '1px solid #bfdbfe' }}>
                DB v{DB_VERSION}
              </span>
              <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '3px 8px', borderRadius: '999px', background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' }}>
                Auto-Save 500ms
              </span>
            </div>
          </div>

          {/* Quick Record Counter */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px', padding: '12px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0', marginBottom: '18px' }}>
            <div>
              <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600, display: 'block' }}>Active Sites</span>
              <strong style={{ fontSize: '1.1rem', color: '#0f172a' }}>{stats.sites}</strong>
            </div>
            <div>
              <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600, display: 'block' }}>Labour / Workers</span>
              <strong style={{ fontSize: '1.1rem', color: '#0f172a' }}>{stats.workers}</strong>
            </div>
            <div>
              <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600, display: 'block' }}>Floor Plans</span>
              <strong style={{ fontSize: '1.1rem', color: '#0f172a' }}>{stats.plans}</strong>
            </div>
          </div>

          {/* Export & Import Row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '18px' }}>
            {/* Export Column */}
            <div style={{ padding: '16px', background: '#faf5ff', borderRadius: '12px', border: '1px solid #f3e8ff' }}>
              <h4 style={{ fontSize: '0.88rem', fontWeight: 700, color: '#581c87', margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Download size={15} /> Export Portable Backups
              </h4>
              <p style={{ fontSize: '0.75rem', color: '#6b21a8', margin: '0 0 12px' }}>
                Download complete database or human-readable CSV summary.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button
                  type="button"
                  onClick={handleExportJSON}
                  disabled={exportingJSON}
                  className="btn btn-sm"
                  style={{ background: '#7c3aed', color: '#ffffff', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '8px 12px' }}
                >
                  <Download size={14} />
                  <span>{exportingJSON ? 'Exporting...' : 'Export JSON Backup (.json)'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleExportCSV}
                  disabled={exportingCSV}
                  className="btn btn-outline btn-sm"
                  style={{ background: '#ffffff', borderColor: '#d8b4fe', color: '#6b21a8', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '8px 12px' }}
                >
                  <FileSpreadsheet size={14} />
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
