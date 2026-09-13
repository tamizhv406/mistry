import React, { useState, useRef } from 'react';
import {
  Database,
  Download,
  Upload,
  ArrowLeft,
  ShieldCheck,
  HardDrive,
  Trash2,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { exportDatabaseBackup, importDatabaseBackup } from '../db/backup';
import { loadDemoData } from '../db/seedData';
import { db } from '../db/db';

interface BackupViewProps {
  onBack: () => void;
  onNotify: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const BackupView: React.FC<BackupViewProps> = ({ onBack, onNotify }) => {
  const [loadingExport, setLoadingExport] = useState(false);
  const [loadingImport, setLoadingImport] = useState(false);
  const [loadingDemo, setLoadingDemo] = useState(false);
  const [clearingDemo, setClearingDemo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    setLoadingExport(true);
    try {
      await exportDatabaseBackup();
      onNotify('Full database backup file (.json) downloaded to your computer!', 'success');
    } catch (err: any) {
      onNotify('Backup export failed: ' + err.message, 'error');
    } finally {
      setLoadingExport(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoadingImport(true);
    try {
      const res = await importDatabaseBackup(file);
      if (res.success) {
        onNotify(res.message, 'success');
      } else {
        onNotify(res.message, 'error');
      }
    } catch (err: any) {
      onNotify('Import failed: ' + err.message, 'error');
    } finally {
      setLoadingImport(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleLoadDemo = async () => {
    setLoadingDemo(true);
    try {
      await loadDemoData();
      onNotify('Sample Site "Sri Murugan Illam" and demo records created!', 'success');
    } catch (err: any) {
      onNotify('Failed to load demo: ' + err.message, 'error');
    } finally {
      setLoadingDemo(false);
    }
  };

  const handleClearDemo = async () => {
    setClearingDemo(true);
    try {
      const count = await db.clearDemoData();
      onNotify(`Cleared ${count} demo records. Your real user records were untouched!`, 'info');
    } catch (err: any) {
      onNotify('Failed to clear demo data: ' + err.message, 'error');
    } finally {
      setClearingDemo(false);
    }
  };

  return (
    <div className="main-wrapper">
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <button className="btn btn-outline btn-sm" onClick={onBack} style={{ marginBottom: '8px' }}>
          <ArrowLeft size={16} />
          <span>Back to Dashboard</span>
        </button>
        <h2 style={{ fontSize: '1.8rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Database size={26} color="var(--primary)" />
          Database Backup & Safety Center
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem' }}>
          Manage local IndexedDB storage, download offline backups, and restore your construction business records.
        </p>
      </div>

      {/* Safety Info Card */}
      <div style={{
        backgroundColor: '#ffffff',
        border: '1.5px solid var(--border-medium)',
        borderRadius: '12px',
        padding: '20px 24px',
        marginBottom: '24px',
        boxShadow: 'var(--shadow-sm)',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '16px',
      }}>
        <div style={{
          backgroundColor: '#d1fae5',
          color: '#065f46',
          width: '48px',
          height: '48px',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          <ShieldCheck size={28} />
        </div>
        <div>
          <h3 style={{ fontSize: '1.15rem', color: '#0f172a', marginBottom: '4px' }}>
            Guaranteed Permanent Local Storage
          </h3>
          <p style={{ fontSize: '0.9rem', color: '#475569', lineHeight: '1.5' }}>
            Building Mistry uses an industrial-strength browser database (<strong>IndexedDB via Dexie.js</strong>).
            Your data is stored directly on your computer and <strong>never automatically resets</strong>. It remains intact even after closing the browser, refreshing, or restarting your computer.
          </p>
        </div>
      </div>

      {/* 2-Column Action Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginBottom: '24px' }}>
        {/* Card 1: Export Backup */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          border: '1px solid var(--border-light)',
          padding: '24px',
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
              <Download size={22} color="var(--primary)" />
              <h3 style={{ fontSize: '1.2rem', color: 'var(--text-main)' }}>Download Backup (.json)</h3>
            </div>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '18px', lineHeight: '1.5' }}>
              Save a full backup copy of all your construction sites, materials, steel rods, workers, attendance records, advances, tools, and expense bills to your computer.
            </p>
          </div>

          <button
            className="btn btn-primary"
            onClick={handleExport}
            disabled={loadingExport}
            style={{ width: '100%' }}
          >
            <Download size={18} />
            <span>{loadingExport ? 'Generating Backup...' : 'Export Complete Backup File'}</span>
          </button>
        </div>

        {/* Card 2: Restore from Backup */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          border: '1px solid var(--border-light)',
          padding: '24px',
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
              <Upload size={22} color="var(--info)" />
              <h3 style={{ fontSize: '1.2rem', color: 'var(--text-main)' }}>Restore from Backup File</h3>
            </div>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '18px', lineHeight: '1.5' }}>
              Restore previous records onto this computer or transfer your complete database from another laptop or phone using a saved <code>.json</code> file.
            </p>
          </div>

          <div>
            <input
              type="file"
              accept=".json"
              ref={fileInputRef}
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
            <button
              className="btn btn-outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={loadingImport}
              style={{ width: '100%', borderColor: 'var(--info)', color: 'var(--info)' }}
            >
              <Upload size={18} />
              <span>{loadingImport ? 'Restoring Database...' : 'Select .json File to Restore'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Demo Data Management */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '12px',
        border: '1px solid var(--border-light)',
        padding: '24px',
        boxShadow: 'var(--shadow-sm)',
      }}>
        <h3 style={{ fontSize: '1.2rem', color: 'var(--text-main)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <HardDrive size={20} color="var(--primary)" />
          Sample / Demo Construction Data
        </h3>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '18px' }}>
          Test the entire application with pre-filled sample site records ("Sri Murugan Illam"). All sample records are strictly marked as <code>DEMO</code> and can be completely removed at any time without touching your real sites.
        </p>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button
            className="btn btn-outline"
            onClick={handleLoadDemo}
            disabled={loadingDemo}
          >
            <Database size={16} />
            <span>{loadingDemo ? 'Loading...' : 'Load Sample Site (DEMO)'}</span>
          </button>

          <button
            className="btn btn-danger"
            onClick={handleClearDemo}
            disabled={clearingDemo}
          >
            <Trash2 size={16} />
            <span>{clearingDemo ? 'Clearing...' : 'Clear All Demo Data'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
