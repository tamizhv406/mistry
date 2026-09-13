import React from 'react';
import { Home, Building2, Calculator, Trash2, Database, LogOut, ShieldCheck } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import type { User } from '../db/types';
import { isAdmin } from '../services/auth';

interface MobileBottomNavProps {
  currentView: string;
  onNavigate: (view: string) => void;
  onLogout: () => void;
  user?: User | null;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  currentView,
  onNavigate,
  onLogout,
  user,
}) => {
  const trashCount =
    useLiveQuery(async () => {
      if (!user) return 0;
      const trash = await db.getAllTrash(user);
      return trash.length;
    }, [user]) || 0;

  return (
    <div className="mobile-bottom-bar no-print">
      <button
        className={`mobile-nav-btn ${currentView === 'dashboard' ? 'active' : ''}`}
        onClick={() => onNavigate('dashboard')}
      >
        <Home size={20} />
        <span>Dashboard</span>
      </button>

      <button
        className={`mobile-nav-btn ${currentView === 'my-sites' ? 'active' : ''}`}
        onClick={() => onNavigate('my-sites')}
      >
        <Building2 size={20} />
        <span>Sites</span>
      </button>

      <button
        className={`mobile-nav-btn ${currentView === 'estimator' ? 'active' : ''}`}
        onClick={() => onNavigate('estimator')}
      >
        <Calculator size={20} />
        <span>Estimator</span>
      </button>

      {isAdmin(user) && (
        <button
          className={`mobile-nav-btn ${currentView === 'admin' ? 'active' : ''}`}
          onClick={() => onNavigate('admin')}
          style={{ color: currentView === 'admin' ? '#818cf8' : undefined }}
        >
          <ShieldCheck size={20} />
          <span>Admin</span>
        </button>
      )}

      <button
        className={`mobile-nav-btn ${currentView === 'trash' ? 'active' : ''}`}
        onClick={() => onNavigate('trash')}
      >
        <div style={{ position: 'relative' }}>
          <Trash2 size={20} />
          {trashCount > 0 && (
            <span
              style={{
                position: 'absolute',
                top: '-6px',
                right: '-8px',
                backgroundColor: '#ef4444',
                color: '#ffffff',
                fontSize: '0.65rem',
                fontWeight: 800,
                borderRadius: '999px',
                padding: '0 4px',
              }}
            >
              {trashCount}
            </span>
          )}
        </div>
        <span>Trash</span>
      </button>

      <button
        className={`mobile-nav-btn ${currentView === 'backup' ? 'active' : ''}`}
        onClick={() => onNavigate('backup')}
      >
        <Database size={20} />
        <span>Backup</span>
      </button>

      <button
        className="mobile-nav-btn"
        onClick={onLogout}
        style={{ color: '#ef4444' }}
      >
        <LogOut size={20} />
        <span>Logout</span>
      </button>
    </div>
  );
};
