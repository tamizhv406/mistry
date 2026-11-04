import React, { useState } from 'react';
import { WifiOff, Wifi } from 'lucide-react';
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

/**
 * Page frame: sidebar on wide screens, content area with network status banners.
 * On phones the top bar and bottom navigation come from components/mobile/MobileChrome.
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

  const handleToggleCollapse = () => {
    setSidebarCollapsed(prev => {
      const next = !prev;
      try {
        localStorage.setItem('mistry_sidebar_collapsed', String(next));
      } catch { /* ignore */ }
      return next;
    });
  };

  return (
    <div className={`app-shell ${sidebarCollapsed ? 'shell-sidebar-collapsed' : ''}`}>
      {/* Desktop Sidebar */}
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

      {/* Main Content Area */}
      <div className="app-shell-main">
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
