import React, { useState, useEffect } from 'react';
import { Menu, X, HardHat } from 'lucide-react';
import { AppSidebar } from './AppSidebar';
import type { User } from '../db/types';

interface AppShellProps {
  user: User | null;
  currentView: string;
  onNavigate: (view: string, siteId?: string) => void;
  onLogout: () => void;
  onOpenNewSiteModal: () => void;
  onOpenSiteTab?: (tab: string, subTab?: string) => void;
  children: React.ReactNode;
  isOnline?: boolean;
  showOnlineRestored?: boolean;
  installPromptEvent?: any;
  onInstallPwa?: () => void;
  isPwaInstalled?: boolean;
}

export const AppShell: React.FC<AppShellProps> = ({
  user,
  currentView,
  onNavigate,
  onLogout,
  onOpenNewSiteModal,
  onOpenSiteTab,
  children,
  isOnline = true,
  showOnlineRestored = false,
}) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('mistry_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  const handleToggleCollapse = () => {
    setSidebarCollapsed(prev => {
      const next = !prev;
      try {
        localStorage.setItem('mistry_sidebar_collapsed', String(next));
      } catch { /* ignore */ }
      return next;
    });
  };

  const handleNavigate = (view: string, siteId?: string) => {
    setMobileDrawerOpen(false);
    onNavigate(view, siteId);
  };

  // Close drawer on ESC key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mobileDrawerOpen) {
        setMobileDrawerOpen(false);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [mobileDrawerOpen]);

  // Prevent body scroll when mobile drawer is open
  useEffect(() => {
    if (mobileDrawerOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [mobileDrawerOpen]);

  return (
    <div className={`app-shell ${sidebarCollapsed ? 'shell-sidebar-collapsed' : ''}`}>
      {/* Desktop Sidebar */}
      <div className="app-shell-sidebar desktop-only">
        <AppSidebar
          currentView={currentView}
          user={user}
          collapsed={sidebarCollapsed}
          onToggleCollapse={handleToggleCollapse}
          onNavigate={handleNavigate}
          onLogout={onLogout}
          onOpenNewSiteModal={onOpenNewSiteModal}
          onOpenSiteTab={onOpenSiteTab}
        />
      </div>

      {/* Mobile Header Bar */}
      <header className="app-shell-mobile-header mobile-only">
        <button
          type="button"
          className="shell-hamburger-btn"
          onClick={() => setMobileDrawerOpen(true)}
          aria-label="Open navigation menu"
          aria-expanded={mobileDrawerOpen}
        >
          <Menu size={24} />
        </button>

        <div
          className="shell-mobile-brand"
          onClick={() => handleNavigate('dashboard')}
          role="button"
          tabIndex={0}
          onKeyDown={e => e.key === 'Enter' && handleNavigate('dashboard')}
        >
          <div className="shell-mobile-brand-icon">
            <HardHat size={20} strokeWidth={2.5} />
          </div>
          <span className="shell-mobile-brand-name">Building Mistry</span>
        </div>

        <div className="shell-mobile-header-right">
          {user && (
            <div
              className="shell-mobile-avatar"
              style={{
                backgroundColor:
                  user.role === 'SUPER_ADMIN'
                    ? '#f59e0b'
                    : user.role === 'ADMIN' || user.role === 'SUB_ADMIN'
                    ? '#6366f1'
                    : '#0ea5e9',
              }}
              title={user.fullName || user.username}
            >
              {user.fullName ? user.fullName[0].toUpperCase() : 'U'}
            </div>
          )}
        </div>
      </header>

      {/* Mobile Drawer Overlay */}
      {mobileDrawerOpen && (
        <div
          className="mobile-drawer-overlay"
          onClick={() => setMobileDrawerOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Mobile Sidebar Drawer */}
      <div
        className={`app-shell-mobile-drawer ${mobileDrawerOpen ? 'mobile-drawer-open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation Menu"
      >
        <button
          type="button"
          className="mobile-drawer-close-btn"
          onClick={() => setMobileDrawerOpen(false)}
          aria-label="Close navigation menu"
        >
          <X size={22} />
        </button>

        <AppSidebar
          currentView={currentView}
          user={user}
          collapsed={false}
          onToggleCollapse={() => {}}
          onNavigate={handleNavigate}
          onLogout={() => {
            setMobileDrawerOpen(false);
            onLogout();
          }}
          onOpenNewSiteModal={() => {
            setMobileDrawerOpen(false);
            onOpenNewSiteModal();
          }}
          onOpenSiteTab={(tab, subTab) => {
            setMobileDrawerOpen(false);
            onOpenSiteTab?.(tab, subTab);
          }}
        />
      </div>

      {/* Main Content Area */}
      <div className="app-shell-main">
        {/* Network Status Banners */}
        {!isOnline && (
          <div className="offline-status-banner no-print" role="status">
            <span className="offline-dot">⚡</span>
            <span>
              <strong>Offline Mode:</strong> Database working locally. All changes are safe and persistent.
            </span>
          </div>
        )}
        {showOnlineRestored && (
          <div className="online-status-banner no-print" role="status">
            <span>🟢</span>
            <span>
              <strong>Back Online:</strong> Internet connection restored.
            </span>
          </div>
        )}

        {/* Page Content */}
        <div className="app-shell-content">
          {children}
        </div>
      </div>
    </div>
  );
};
