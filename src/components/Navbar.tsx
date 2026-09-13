import React from 'react';
import {
  HardHat,
  Home,
  Trash2,
  Database,
  PlusCircle,
  Building2,
  LogOut,
  Calculator,
  ShieldCheck,
} from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import type { User } from '../db/types';
import { isAdmin, isSuperAdmin } from '../services/auth';

interface NavbarProps {
  currentView: string;
  onNavigate: (view: string, siteId?: string) => void;
  onOpenNewSiteModal: () => void;
  selectedSiteId?: string | null;
  user?: User | null;
  onLogout?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  onNavigate,
  onOpenNewSiteModal,
  selectedSiteId,
  user,
  onLogout,
}) => {
  // Live query for active sites list scoped to the current user (or all if admin)
  const activeSites =
    useLiveQuery(async () => {
      if (!user) return [];
      const sites = await db.getSitesForUser(user);
      return sites.filter(s => !s.isDeleted);
    }, [user]) || [];

  // Live query for trash count scoped to current user
  const trashCount =
    useLiveQuery(async () => {
      if (!user) return 0;
      const trash = await db.getAllTrash(user);
      return trash.length;
    }, [user]) || 0;

  return (
    <header className="app-header">
      <div className="header-inner">
        {/* Brand */}
        <div className="brand" onClick={() => onNavigate('dashboard')}>
          <div className="brand-icon-box">
            <HardHat size={24} strokeWidth={2.5} />
          </div>
          <div className="brand-text">
            <h1>Building Mistry</h1>
            <span className="brand-sub-text">Construction Site Manager</span>
          </div>
        </div>

        {/* Desktop-Only Navigation Group (Hidden on Mobile) */}
        <div className="desktop-nav-group">
          {/* Site Switcher (if sites exist) */}
          {activeSites.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Building2 size={18} color="#f59e0b" />
              <select
                value={selectedSiteId || ''}
                onChange={e => {
                  if (e.target.value) {
                    onNavigate('site-detail', e.target.value);
                  } else {
                    onNavigate('dashboard');
                  }
                }}
                style={{
                  backgroundColor: '#1e293b',
                  color: '#ffffff',
                  border: '1.5px solid #334155',
                  padding: '7px 12px',
                  borderRadius: '8px',
                  fontSize: '0.88rem',
                  cursor: 'pointer',
                  maxWidth: '220px',
                }}
              >
                <option value="">🏢 Switch Construction Site...</option>
                {activeSites.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.status})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Navigation Actions */}
          <div className="header-actions">
            <button
              className={`btn btn-sm ${currentView === 'dashboard' ? 'btn-secondary' : 'btn-outline'}`}
              style={{ color: '#ffffff', borderColor: '#334155' }}
              onClick={() => onNavigate('dashboard')}
            >
              <Home size={16} />
              <span>Dashboard</span>
            </button>

            <button
              className={`btn btn-sm ${currentView === 'my-sites' ? 'btn-secondary' : 'btn-outline'}`}
              style={{ color: '#ffffff', borderColor: '#334155' }}
              onClick={() => onNavigate('my-sites')}
            >
              <Building2 size={16} />
              <span>My Sites</span>
            </button>

            <button
              className={`btn btn-sm ${currentView === 'estimator' ? 'btn-secondary' : 'btn-outline'}`}
              style={{
                color: '#ffffff',
                borderColor: currentView === 'estimator' ? 'var(--primary)' : '#334155',
                background: currentView === 'estimator' ? 'rgba(255, 184, 0, 0.2)' : undefined,
              }}
              onClick={() => onNavigate('estimator')}
            >
              <Calculator size={16} color="var(--primary)" />
              <span>Estimator</span>
            </button>

            {/* Admin Portal Button - Accessible to Real Admin, Sub-Admins, and Admins */}
            {isAdmin(user) && (
              <button
                className={`btn btn-sm ${currentView === 'admin' ? 'btn-secondary' : 'btn-outline'}`}
                style={{
                  color: isSuperAdmin(user) ? '#fde047' : '#c7d2fe',
                  borderColor: isSuperAdmin(user) ? '#eab308' : '#6366f1',
                  background: currentView === 'admin'
                    ? isSuperAdmin(user)
                      ? 'rgba(234, 179, 8, 0.25)'
                      : 'rgba(99, 102, 241, 0.25)'
                    : isSuperAdmin(user)
                    ? 'rgba(234, 179, 8, 0.1)'
                    : 'rgba(99, 102, 241, 0.1)',
                  fontWeight: 700,
                }}
                onClick={() => onNavigate('admin')}
              >
                <ShieldCheck size={16} color={isSuperAdmin(user) ? '#facc15' : '#818cf8'} />
                <span>{isSuperAdmin(user) ? '👑 Super Admin' : 'Admin Portal'}</span>
              </button>
            )}

            <button
              className={`btn btn-sm ${currentView === 'trash' ? 'btn-secondary' : 'btn-outline'}`}
              style={{ color: '#ffffff', borderColor: '#334155', position: 'relative' }}
              onClick={() => onNavigate('trash')}
            >
              <Trash2 size={16} color={trashCount > 0 ? '#f59e0b' : '#ffffff'} />
              <span>Recycle Bin</span>
              {trashCount > 0 && (
                <span
                  style={{
                    backgroundColor: '#ef4444',
                    color: '#ffffff',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    borderRadius: '999px',
                    padding: '1px 6px',
                    marginLeft: '4px',
                  }}
                >
                  {trashCount}
                </span>
              )}
            </button>

            <button
              className={`btn btn-sm ${currentView === 'backup' ? 'btn-secondary' : 'btn-outline'}`}
              style={{ color: '#ffffff', borderColor: '#334155' }}
              onClick={() => onNavigate('backup')}
            >
              <Database size={16} />
              <span>Backup & Data</span>
            </button>

            <button className="btn btn-sm btn-primary" onClick={onOpenNewSiteModal}>
              <PlusCircle size={17} />
              <span>Add Site</span>
            </button>

            {/* User Profile Badge & Logout */}
            {user && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  paddingLeft: '8px',
                  borderLeft: '1px solid #334155',
                }}
              >
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    backgroundColor: user.role === 'ADMIN' ? '#6366f1' : '#f59e0b',
                    color: '#ffffff',
                    fontWeight: 800,
                    fontSize: '0.88rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                  title={user.fullName || user.username}
                >
                  {user.fullName ? user.fullName[0].toUpperCase() : 'U'}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}>
                  <span
                    style={{
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      color: '#f8fafc',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {user.fullName || user.username}
                  </span>
                  <span
                    style={{
                      fontSize: '0.7rem',
                      color: isSuperAdmin(user)
                        ? '#fde047'
                        : user.role === 'SUB_ADMIN'
                        ? '#c4b5fd'
                        : user.role === 'ADMIN'
                        ? '#a5b4fc'
                        : '#94a3b8',
                      fontWeight: isAdmin(user) ? 700 : 500,
                    }}
                  >
                    {isSuperAdmin(user)
                      ? '👑 Real Admin'
                      : user.role === 'SUB_ADMIN'
                      ? '🛡️ Sub-Admin'
                      : user.role}
                  </span>
                </div>
                {onLogout && (
                  <button
                    className="btn btn-sm btn-outline"
                    onClick={onLogout}
                    title="Sign out of Building Mistry"
                    style={{
                      color: '#ef4444',
                      borderColor: '#475569',
                      padding: '4px 8px',
                      marginLeft: '4px',
                    }}
                  >
                    <LogOut size={14} />
                    <span>Logout</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Mobile-Only Header Quick Bar (Sleek Phone App Header) */}
        <div className="mobile-header-actions">
          <button
            type="button"
            className="mobile-header-btn mobile-add-site-btn"
            onClick={onOpenNewSiteModal}
            aria-label="Add Construction Site"
          >
            <PlusCircle size={16} />
            <span>+ Site</span>
          </button>

          {user && (
            <div
              className="mobile-user-chip"
              title={`${user.fullName || user.username} (${user.role})`}
              onClick={() => onNavigate('dashboard')}
            >
              <div
                className="mobile-user-avatar"
                style={{
                  backgroundColor: isSuperAdmin(user)
                    ? '#f59e0b'
                    : user.role === 'ADMIN' || user.role === 'SUB_ADMIN'
                    ? '#6366f1'
                    : '#0ea5e9',
                }}
              >
                {isSuperAdmin(user) ? '👑' : user.fullName ? user.fullName[0].toUpperCase() : 'U'}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
