import React from 'react';
import {
  HardHat,
  Home,
  Building2,
  PenTool,
  Layers,
  Users,
  Wallet,
  Calculator,
  BarChart3,
  Bell,
  Settings,
  ShieldCheck,
  Trash2,
  Database,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Crown,
} from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { isAdmin, isSuperAdmin } from '../services/auth';
import type { User } from '../db/types';

interface SidebarItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  view: string;
  adminOnly?: boolean;
  badge?: number;
}

interface AppSidebarProps {
  currentView: string;
  user: User | null;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onNavigate: (view: string, siteId?: string) => void;
  onLogout: () => void;
  onOpenNewSiteModal: () => void;
  onOpenSiteTab?: (tab: string, subTab?: string) => void;
}

export const AppSidebar: React.FC<AppSidebarProps> = ({
  currentView,
  user,
  collapsed,
  onToggleCollapse,
  onNavigate,
  onLogout,
  onOpenSiteTab,
}) => {
  const trashCount =
    useLiveQuery(async () => {
      if (!user) return 0;
      const trash = await db.getAllTrash(user);
      return trash.length;
    }, [user]) || 0;

  const navItems: SidebarItem[] = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: <Home size={20} />,
      view: 'dashboard',
    },
    {
      id: 'my-sites',
      label: 'My Sites',
      icon: <Building2 size={20} />,
      view: 'my-sites',
    },
    {
      id: 'floor-plans',
      label: 'Floor Plan Creator',
      icon: <PenTool size={20} />,
      view: 'floor-plans',
    },
    {
      id: 'materials',
      label: 'Materials',
      icon: <Layers size={20} />,
      view: 'site-tab-materials',
    },
    {
      id: 'labour',
      label: 'Labour',
      icon: <Users size={20} />,
      view: 'site-tab-labour',
    },
    {
      id: 'expenses',
      label: 'Expenses',
      icon: <Wallet size={20} />,
      view: 'site-tab-expenses',
    },
    {
      id: 'estimator',
      label: 'Building Calculator',
      icon: <Calculator size={20} />,
      view: 'estimator',
    },
    {
      id: 'reports',
      label: 'Reports',
      icon: <BarChart3 size={20} />,
      view: 'site-tab-reports',
    },
    {
      id: 'notifications',
      label: 'Notifications',
      icon: <Bell size={20} />,
      view: 'notifications',
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: <Settings size={20} />,
      view: 'backup',
    },
  ];

  const bottomItems: SidebarItem[] = [
    ...(isAdmin(user)
      ? [
          {
            id: 'admin',
            label: isSuperAdmin(user) ? 'Super Admin' : 'Admin Portal',
            icon: <ShieldCheck size={20} />,
            view: 'admin',
            adminOnly: true,
          },
        ]
      : []),
    {
      id: 'trash',
      label: 'Recycle Bin',
      icon: <Trash2 size={20} />,
      view: 'trash',
      badge: trashCount > 0 ? trashCount : undefined,
    },
    {
      id: 'backup',
      label: 'Backup & Data',
      icon: <Database size={20} />,
      view: 'backup',
    },
  ];

  const isItemActive = (item: SidebarItem): boolean => {
    if (item.view === currentView) return true;
    if (item.view === 'dashboard' && currentView === 'dashboard') return true;
    if (item.view === 'my-sites' && currentView === 'my-sites') return true;
    if (item.view === 'floor-plans' && (currentView === 'floor-plans' || currentView === 'floor-plan-editor')) return true;
    if (item.view === 'backup' && item.id === 'settings' && currentView === 'backup') return true;
    return false;
  };

  const handleItemClick = (item: SidebarItem) => {
    if (item.view.startsWith('site-tab-')) {
      const tab = item.view.replace('site-tab-', '');
      if (onOpenSiteTab) {
        onOpenSiteTab(tab);
      } else {
        onNavigate('my-sites');
      }
    } else {
      onNavigate(item.view);
    }
  };

  return (
    <aside
      className={`app-sidebar ${collapsed ? 'sidebar-collapsed' : ''}`}
      role="navigation"
      aria-label="Main Navigation"
    >
      {/* Brand */}
      <div className="sidebar-brand" onClick={() => onNavigate('dashboard')}>
        <div className="sidebar-brand-icon">
          <HardHat size={22} strokeWidth={2.5} />
        </div>
        {!collapsed && (
          <div className="sidebar-brand-text">
            <span className="sidebar-brand-name">Building Mistry</span>
            <span className="sidebar-brand-sub">Construction Manager</span>
          </div>
        )}
      </div>

      {/* Collapse Toggle */}
      <button
        className="sidebar-collapse-btn"
        onClick={onToggleCollapse}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>

      {/* Main Navigation */}
      <nav className="sidebar-nav">
        <ul className="sidebar-nav-list" role="list">
          {navItems.map(item => (
            <li key={item.id}>
              <button
                type="button"
                className={`sidebar-nav-item ${isItemActive(item) ? 'sidebar-nav-item--active' : ''}`}
                onClick={() => handleItemClick(item)}
                title={collapsed ? item.label : undefined}
                aria-current={isItemActive(item) ? 'page' : undefined}
              >
                <span className="sidebar-nav-icon">{item.icon}</span>
                {!collapsed && <span className="sidebar-nav-label">{item.label}</span>}
                {item.badge && !collapsed && (
                  <span className="sidebar-nav-badge">{item.badge}</span>
                )}
                {item.badge && collapsed && (
                  <span className="sidebar-nav-badge-dot" />
                )}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {/* Divider */}
      <div className="sidebar-divider" />

      {/* Bottom Items */}
      <nav className="sidebar-bottom-nav">
        <ul className="sidebar-nav-list" role="list">
          {bottomItems.map(item => (
            <li key={item.id}>
              <button
                type="button"
                className={`sidebar-nav-item ${
                  item.id === 'admin'
                    ? isSuperAdmin(user)
                      ? 'sidebar-nav-item--admin-super'
                      : 'sidebar-nav-item--admin'
                    : ''
                } ${isItemActive(item) ? 'sidebar-nav-item--active' : ''}`}
                onClick={() => onNavigate(item.view)}
                title={collapsed ? item.label : undefined}
              >
                <span className="sidebar-nav-icon">
                  {item.id === 'admin' && isSuperAdmin(user) ? (
                    <Crown size={20} />
                  ) : (
                    item.icon
                  )}
                </span>
                {!collapsed && <span className="sidebar-nav-label">{item.label}</span>}
                {item.badge && !collapsed && (
                  <span className="sidebar-nav-badge">{item.badge}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {/* User Profile Section */}
      {user && (
        <div className="sidebar-user">
          <div className="sidebar-user-inner">
            <div
              className="sidebar-user-avatar"
              style={{
                backgroundColor: isSuperAdmin(user)
                  ? '#f59e0b'
                  : user.role === 'ADMIN' || user.role === 'SUB_ADMIN'
                  ? '#6366f1'
                  : '#0ea5e9',
              }}
            >
              {isSuperAdmin(user)
                ? '👑'
                : user.fullName
                ? user.fullName[0].toUpperCase()
                : 'U'}
            </div>
            {!collapsed && (
              <div className="sidebar-user-info">
                <span className="sidebar-user-name">
                  {user.fullName || user.username}
                </span>
                <span
                  className="sidebar-user-role"
                  style={{
                    color: isSuperAdmin(user)
                      ? '#fbbf24'
                      : user.role === 'SUB_ADMIN'
                      ? '#a78bfa'
                      : '#94a3b8',
                  }}
                >
                  {isSuperAdmin(user)
                    ? 'Real Admin'
                    : user.role === 'SUB_ADMIN'
                    ? 'Sub-Admin'
                    : user.role}
                </span>
              </div>
            )}
            {!collapsed && (
              <button
                type="button"
                className="sidebar-logout-btn"
                onClick={onLogout}
                title="Sign out"
                aria-label="Sign out of Building Mistry"
              >
                <LogOut size={16} />
              </button>
            )}
          </div>
          {collapsed && (
            <button
              type="button"
              className="sidebar-logout-btn sidebar-logout-btn--collapsed"
              onClick={onLogout}
              title="Sign out"
              aria-label="Sign out"
            >
              <LogOut size={16} />
            </button>
          )}
        </div>
      )}
    </aside>
  );
};
