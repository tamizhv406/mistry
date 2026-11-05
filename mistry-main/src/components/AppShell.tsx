import React, { useState } from 'react';
import { WifiOff, Wifi } from 'lucide-react';
import { AppSidebar } from './AppSidebar';
import { TopNav } from './TopNav';
import type { User } from '../db/types';

interface AppShellProps {
  user: User | null;
  currentView: string;
  onNavigate: (view: string, siteId?: string, tab?: string, subTab?: string) => void;
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

/**
 * Enterprise ERP Shell:
 * - Collapsible dark sidebar on desktop / tablet
 * - Top navigation bar with global search, notifications, and profile
 * - Network status banners
 * - Mobile slide-out drawer
 */
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

  const handleMobileNav = (view: string, siteId?: string) => {
    setMobileDrawerOpen(false);
    onNavigate(view, siteId);
  };

  return (
    <div className={`app-shell ${sidebarCollapsed ? 'shell-sidebar-collapsed' : ''}`}>
      {/* Desktop & Tablet Sidebar */}
      <div className="app-shell-sidebar desktop-only">
        <AppSidebar
          currentView={currentView}
          user={user}
          collapsed={sidebarCollapsed}
          onToggleCollapse={handleToggleCollapse}
          onNavigate={onNavigate}
          onLogout={onLogout}
          onOpenNewSiteModal={onOpenNewSiteModal}
          onOpenSiteTab={onOpenSiteTab}
        />
      </div>

      {/* Mobile Sidebar Drawer Overlay */}
      {mobileDrawerOpen && (
        <div
          className="mobile-drawer-overlay no-print"
          onClick={() => setMobileDrawerOpen(false)}
        >
          <div
            className="mobile-drawer-content"
            onClick={e => e.stopPropagation()}
            style={{ width: '280px', height: '100%', background: 'var(--erp-sidebar-bg)' }}
          >
            <AppSidebar
              currentView={currentView}
              user={user}
              collapsed={false}
              onToggleCollapse={() => setMobileDrawerOpen(false)}
              onNavigate={handleMobileNav}
              onLogout={() => {
                setMobileDrawerOpen(false);
                onLogout();
              }}
              onOpenNewSiteModal={() => {
                setMobileDrawerOpen(false);
                onOpenNewSiteModal();
              }}
              onOpenSiteTab={onOpenSiteTab}
            />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className={`app-shell-main ${currentView === 'floor-plan-editor' ? 'app-shell-main-immersive' : ''}`}>
        {/* Top Navigation Bar - Hidden in Floor Plan Editor */}
        {currentView !== 'floor-plan-editor' && (
          <TopNav
          user={user}
          currentView={currentView}
          onNavigate={onNavigate}
          onLogout={onLogout}
          onToggleSidebarMobile={() => setMobileDrawerOpen(prev => !prev)}
          />
        )}

        {/* Network Status Banners */}
        {!isOnline && (
          <div className="offline-status-banner no-print" role="status">
            <WifiOff size={16} aria-hidden="true" />
            <span>
              <strong>Offline.</strong> Everything you enter is saved on this device and stays available.
            </span>
          </div>
        )}
        {showOnlineRestored && (
          <div className="online-status-banner no-print" role="status">
            <Wifi size={16} aria-hidden="true" />
            <span>
              <strong>Back online.</strong>
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
