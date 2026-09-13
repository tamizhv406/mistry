import React, { useState } from 'react';
import {
  Home,
  Building2,
  Layers,
  Users,
  Menu,
  Wrench,
  Wallet,
  Coffee,
  Sparkles,
  Zap,
  Droplets,
  MessageSquare,
  FileText,
  Trash2,
  Settings,
  X,
  ShieldCheck,
  Database,
  LogOut,
  Download,
} from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import type { User } from '../db/types';
import { isAdmin } from '../services/auth';

interface MobileBottomNavProps {
  currentView: string;
  selectedSiteId?: string | null;
  activeSiteTab?: string;
  activeExpenseSubSection?: string;
  onNavigate: (view: string, siteId?: string, tab?: string, subTab?: string) => void;
  onOpenSiteTab: (tab: string, subTab?: string) => void;
  onLogout: () => void;
  user?: User | null;
  installPromptEvent?: any;
  onInstallPwa?: () => void;
  isPwaInstalled?: boolean;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  currentView,
  selectedSiteId,
  activeSiteTab,
  activeExpenseSubSection,
  onNavigate,
  onOpenSiteTab,
  onLogout,
  user,
  installPromptEvent,
  onInstallPwa,
  isPwaInstalled = false,
}) => {
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const trashCount =
    useLiveQuery(async () => {
      if (!user) return 0;
      const trash = await db.getAllTrash(user);
      return trash.length;
    }, [user]) || 0;

  // Active state calculations
  const isHomeActive = currentView === 'dashboard';
  const isSitesActive = currentView === 'my-sites';
  const isMaterialsActive = currentView === 'site-detail' && activeSiteTab === 'materials';
  const isLabourActive = currentView === 'site-detail' && activeSiteTab === 'labour';
  const isMoreActive =
    isMoreOpen ||
    currentView === 'trash' ||
    currentView === 'backup' ||
    currentView === 'admin' ||
    (currentView === 'site-detail' &&
      ['tools', 'expenses', 'comments', 'reports'].includes(activeSiteTab || ''));

  const handleMoreItemClick = (action: () => void) => {
    setIsMoreOpen(false);
    action();
  };

  return (
    <>
      {/* 5-Item Mobile Bottom Navigation Bar */}
      <nav className="mobile-bottom-bar no-print" aria-label="Mobile Navigation">
        {/* 1. Home */}
        <button
          type="button"
          className={`mobile-nav-btn ${isHomeActive ? 'active' : ''}`}
          onClick={() => {
            setIsMoreOpen(false);
            onNavigate('dashboard');
          }}
          aria-label="Home Dashboard"
        >
          <Home size={22} />
          <span>Home</span>
        </button>

        {/* 2. Sites */}
        <button
          type="button"
          className={`mobile-nav-btn ${isSitesActive ? 'active' : ''}`}
          onClick={() => {
            setIsMoreOpen(false);
            onNavigate('my-sites');
          }}
          aria-label="Sites List"
        >
          <Building2 size={22} />
          <span>Sites</span>
        </button>

        {/* 3. Materials */}
        <button
          type="button"
          className={`mobile-nav-btn ${isMaterialsActive ? 'active' : ''}`}
          onClick={() => {
            setIsMoreOpen(false);
            onOpenSiteTab('materials');
          }}
          aria-label="Materials Ledger"
        >
          <Layers size={22} />
          <span>Materials</span>
        </button>

        {/* 4. Labour */}
        <button
          type="button"
          className={`mobile-nav-btn ${isLabourActive ? 'active' : ''}`}
          onClick={() => {
            setIsMoreOpen(false);
            onOpenSiteTab('labour');
          }}
          aria-label="Labour Management"
        >
          <Users size={22} />
          <span>Labour</span>
        </button>

        {/* 5. More */}
        <button
          type="button"
          className={`mobile-nav-btn ${isMoreActive ? 'active' : ''}`}
          onClick={() => setIsMoreOpen(prev => !prev)}
          aria-label="More Features"
          aria-expanded={isMoreOpen}
        >
          <div style={{ position: 'relative' }}>
            <Menu size={22} />
            {trashCount > 0 && !isMoreOpen && (
              <span className="mobile-nav-badge">{trashCount}</span>
            )}
          </div>
          <span>More</span>
        </button>
      </nav>

      {/* More Slide-Up Bottom Sheet Drawer */}
      {isMoreOpen && (
        <div className="mobile-drawer-overlay" onClick={() => setIsMoreOpen(false)}>
          <div
            className="mobile-drawer-content"
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="More Menu"
          >
            {/* Drawer Header & Handle */}
            <div className="mobile-drawer-handle-bar">
              <div className="mobile-drawer-drag-pill" />
            </div>

            <div className="mobile-drawer-header">
              <div>
                <h3 className="mobile-drawer-title">More Menu (விருப்பங்கள்)</h3>
                <p className="mobile-drawer-sub">Quick access to all site ledgers & tools</p>
              </div>
              <button
                type="button"
                className="mobile-drawer-close"
                onClick={() => setIsMoreOpen(false)}
                aria-label="Close drawer"
              >
                <X size={20} />
              </button>
            </div>

            {/* PWA Install Banner inside More (if available and not installed) */}
            {installPromptEvent && !isPwaInstalled && (
              <div className="mobile-drawer-install-banner">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-amber-500 text-slate-950">
                    <Download size={18} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-100">Install Building Mistry</h4>
                    <p className="text-[11px] text-slate-400">Install app on Android phone for quick access</p>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  onClick={() => {
                    setIsMoreOpen(false);
                    onInstallPwa?.();
                  }}
                >
                  Install Now
                </button>
              </div>
            )}

            {/* Grid of Requested Options */}
            <div className="mobile-drawer-grid">
              {/* 1. Tools */}
              <button
                type="button"
                className={`mobile-drawer-item ${
                  currentView === 'site-detail' && activeSiteTab === 'tools' ? 'active' : ''
                }`}
                onClick={() => handleMoreItemClick(() => onOpenSiteTab('tools'))}
              >
                <div className="mobile-drawer-icon" style={{ color: '#f59e0b', background: 'rgba(245, 158, 11, 0.15)' }}>
                  <Wrench size={20} />
                </div>
                <span className="mobile-drawer-label">Tools</span>
                <span className="mobile-drawer-tamil">கருவிகள்</span>
              </button>

              {/* 2. Expenses */}
              <button
                type="button"
                className={`mobile-drawer-item ${
                  currentView === 'site-detail' && activeSiteTab === 'expenses' ? 'active' : ''
                }`}
                onClick={() => handleMoreItemClick(() => onOpenSiteTab('expenses', 'other'))}
              >
                <div className="mobile-drawer-icon" style={{ color: '#10b981', background: 'rgba(16, 185, 129, 0.15)' }}>
                  <Wallet size={20} />
                </div>
                <span className="mobile-drawer-label">Expenses</span>
                <span className="mobile-drawer-tamil">செலவுகள்</span>
              </button>

              {/* 3. Tea/Snacks */}
              <button
                type="button"
                className={`mobile-drawer-item ${
                  currentView === 'site-detail' && activeSiteTab === 'expenses' && activeExpenseSubSection === 'tea' ? 'active' : ''
                }`}
                onClick={() => handleMoreItemClick(() => onOpenSiteTab('expenses', 'tea'))}
              >
                <div className="mobile-drawer-icon" style={{ color: '#d97706', background: 'rgba(217, 119, 6, 0.15)' }}>
                  <Coffee size={20} />
                </div>
                <span className="mobile-drawer-label">Tea / Snacks</span>
                <span className="mobile-drawer-tamil">டீ, ஸ்நாக்ஸ்</span>
              </button>

              {/* 4. Pooja */}
              <button
                type="button"
                className={`mobile-drawer-item ${
                  currentView === 'site-detail' && activeSiteTab === 'expenses' && activeExpenseSubSection === 'pooja' ? 'active' : ''
                }`}
                onClick={() => handleMoreItemClick(() => onOpenSiteTab('expenses', 'pooja'))}
              >
                <div className="mobile-drawer-icon" style={{ color: '#ec4899', background: 'rgba(236, 72, 153, 0.15)' }}>
                  <Sparkles size={20} />
                </div>
                <span className="mobile-drawer-label">Pooja</span>
                <span className="mobile-drawer-tamil">பூஜை செலவு</span>
              </button>

              {/* 5. Electricity */}
              <button
                type="button"
                className={`mobile-drawer-item ${
                  currentView === 'site-detail' && activeSiteTab === 'expenses' && activeExpenseSubSection === 'electricity' ? 'active' : ''
                }`}
                onClick={() => handleMoreItemClick(() => onOpenSiteTab('expenses', 'electricity'))}
              >
                <div className="mobile-drawer-icon" style={{ color: '#eab308', background: 'rgba(234, 179, 8, 0.15)' }}>
                  <Zap size={20} />
                </div>
                <span className="mobile-drawer-label">Electricity</span>
                <span className="mobile-drawer-tamil">மின்சார கட்டணம்</span>
              </button>

              {/* 6. Water */}
              <button
                type="button"
                className={`mobile-drawer-item ${
                  currentView === 'site-detail' && activeSiteTab === 'expenses' && activeExpenseSubSection === 'water' ? 'active' : ''
                }`}
                onClick={() => handleMoreItemClick(() => onOpenSiteTab('expenses', 'water'))}
              >
                <div className="mobile-drawer-icon" style={{ color: '#06b6d4', background: 'rgba(6, 182, 212, 0.15)' }}>
                  <Droplets size={20} />
                </div>
                <span className="mobile-drawer-label">Water</span>
                <span className="mobile-drawer-tamil">தண்ணீர் டேங்கர்</span>
              </button>

              {/* 7. Comments */}
              <button
                type="button"
                className={`mobile-drawer-item ${
                  currentView === 'site-detail' && activeSiteTab === 'comments' ? 'active' : ''
                }`}
                onClick={() => handleMoreItemClick(() => onOpenSiteTab('comments'))}
              >
                <div className="mobile-drawer-icon" style={{ color: '#8b5cf6', background: 'rgba(139, 92, 246, 0.15)' }}>
                  <MessageSquare size={20} />
                </div>
                <span className="mobile-drawer-label">Comments</span>
                <span className="mobile-drawer-tamil">தள குறிப்புகள்</span>
              </button>

              {/* 8. Reports */}
              <button
                type="button"
                className={`mobile-drawer-item ${
                  currentView === 'site-detail' && activeSiteTab === 'reports' ? 'active' : ''
                }`}
                onClick={() => handleMoreItemClick(() => onOpenSiteTab('reports'))}
              >
                <div className="mobile-drawer-icon" style={{ color: '#3b82f6', background: 'rgba(59, 130, 246, 0.15)' }}>
                  <FileText size={20} />
                </div>
                <span className="mobile-drawer-label">Reports</span>
                <span className="mobile-drawer-tamil">அறிக்கைகள்</span>
              </button>

              {/* 9. Trash */}
              <button
                type="button"
                className={`mobile-drawer-item relative ${currentView === 'trash' ? 'active' : ''}`}
                onClick={() => handleMoreItemClick(() => onNavigate('trash'))}
              >
                <div className="mobile-drawer-icon" style={{ color: '#ef4444', background: 'rgba(239, 68, 68, 0.15)' }}>
                  <Trash2 size={20} />
                </div>
                <span className="mobile-drawer-label">Trash</span>
                <span className="mobile-drawer-tamil">குப்பைத் தொட்டி</span>
                {trashCount > 0 && (
                  <span className="mobile-drawer-badge">{trashCount}</span>
                )}
              </button>

              {/* 10. Settings */}
              <button
                type="button"
                className={`mobile-drawer-item ${
                  currentView === 'backup' || isSettingsOpen ? 'active' : ''
                }`}
                onClick={() => setIsSettingsOpen(true)}
              >
                <div className="mobile-drawer-icon" style={{ color: '#94a3b8', background: 'rgba(148, 163, 184, 0.15)' }}>
                  <Settings size={20} />
                </div>
                <span className="mobile-drawer-label">Settings</span>
                <span className="mobile-drawer-tamil">அமைப்புகள்</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Sub-Drawer / Modal */}
      {isSettingsOpen && (
        <div className="mobile-drawer-overlay" onClick={() => setIsSettingsOpen(false)}>
          <div
            className="mobile-drawer-content"
            onClick={e => e.stopPropagation()}
            style={{ maxHeight: '70vh' }}
          >
            <div className="mobile-drawer-handle-bar">
              <div className="mobile-drawer-drag-pill" />
            </div>

            <div className="mobile-drawer-header">
              <div>
                <h3 className="mobile-drawer-title">App Settings & Profile</h3>
                <p className="mobile-drawer-sub">
                  {user?.fullName || 'User'} ({user?.role || 'MISTRY'})
                </p>
              </div>
              <button
                type="button"
                className="mobile-drawer-close"
                onClick={() => setIsSettingsOpen(false)}
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-2 p-3">
              {/* Backup & Export */}
              <button
                type="button"
                className="w-full flex items-center justify-between p-3.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-amber-500/50 text-slate-100 transition-all text-left"
                onClick={() => {
                  setIsSettingsOpen(false);
                  setIsMoreOpen(false);
                  onNavigate('backup');
                }}
              >
                <div className="flex items-center gap-3">
                  <Database className="w-5 h-5 text-amber-400" />
                  <div>
                    <div className="text-sm font-bold">Data Backup & Export</div>
                    <div className="text-xs text-slate-400">Save complete offline database backup</div>
                  </div>
                </div>
              </button>

              {/* Admin Dashboard if Admin */}
              {isAdmin(user) && (
                <button
                  type="button"
                  className="w-full flex items-center justify-between p-3.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-indigo-500/50 text-slate-100 transition-all text-left"
                  onClick={() => {
                    setIsSettingsOpen(false);
                    setIsMoreOpen(false);
                    onNavigate('admin');
                  }}
                >
                  <div className="flex items-center gap-3">
                    <ShieldCheck className="w-5 h-5 text-indigo-400" />
                    <div>
                      <div className="text-sm font-bold">Admin Portal</div>
                      <div className="text-xs text-slate-400">Manage contractors & sub-admins</div>
                    </div>
                  </div>
                </button>
              )}

              {/* Install PWA Option */}
              {installPromptEvent && !isPwaInstalled && (
                <button
                  type="button"
                  className="w-full flex items-center justify-between p-3.5 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-300 transition-all text-left"
                  onClick={() => {
                    setIsSettingsOpen(false);
                    setIsMoreOpen(false);
                    onInstallPwa?.();
                  }}
                >
                  <div className="flex items-center gap-3">
                    <Download className="w-5 h-5 text-amber-400" />
                    <div>
                      <div className="text-sm font-bold">Install to Home Screen</div>
                      <div className="text-xs text-amber-200/70">Runs full-screen like a mobile app</div>
                    </div>
                  </div>
                </button>
              )}

              {/* Logout */}
              <button
                type="button"
                className="w-full flex items-center justify-between p-3.5 rounded-xl bg-rose-950/30 border border-rose-900/50 hover:border-rose-500/50 text-rose-400 transition-all text-left mt-4"
                onClick={() => {
                  setIsSettingsOpen(false);
                  setIsMoreOpen(false);
                  onLogout();
                }}
              >
                <div className="flex items-center gap-3">
                  <LogOut className="w-5 h-5 text-rose-400" />
                  <div>
                    <div className="text-sm font-bold">Logout</div>
                    <div className="text-xs text-rose-300/70">Sign out of this device</div>
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
