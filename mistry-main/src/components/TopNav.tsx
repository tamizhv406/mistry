import React, { useState, useEffect, useRef } from 'react';
import {
  HardHat,
  Search,
  Bell,
  HelpCircle,
  User as UserIcon,
  Settings,
  Database,
  ShieldCheck,
  Crown,
  LogOut,
  LogIn,
  ChevronDown,
  Building2,
  Users,
  Layers,
  PenTool,
  AlertTriangle,
  X,
  CheckCircle2,
  Menu,
  Clock,
  ExternalLink,
  Wifi,
  WifiOff,
  FileCode,
} from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { isAdmin, isSuperAdmin } from '../services/auth';
import type { User, Site, LabourWorker, Material, FloorPlan } from '../db/types';
import { todayKey, DEFAULT_TIME_ZONE } from '../utils/datetime';
import { buildStock } from '../domain/stock';

interface TopNavProps {
  user: User | null;
  currentView: string;
  onNavigate: (view: string, siteId?: string, tab?: string) => void;
  onLogout: () => void;
  onToggleSidebarMobile?: () => void;
}

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: 'warning' | 'info' | 'danger' | 'success';
  targetView: string;
  siteId?: string;
  tab?: string;
  timestamp: string;
}

export const TopNav: React.FC<TopNavProps> = ({
  user,
  currentView,
  onNavigate,
  onLogout,
  onToggleSidebarMobile,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);

  const searchContainerRef = useRef<HTMLDivElement>(null);
  const mobileSearchInputRef = useRef<HTMLInputElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setIsSearchFocused(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setIsNotificationsOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setIsProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard shortcut '/' to focus search, 'Escape' to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && (e.target as HTMLElement)?.tagName !== 'INPUT' && (e.target as HTMLElement)?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        const input = searchContainerRef.current?.querySelector('input');
        input?.focus();
        setIsSearchFocused(true);
      } else if (e.key === 'Escape') {
        setIsSearchFocused(false);
        setIsNotificationsOpen(false);
        setIsProfileOpen(false);
        setIsHelpOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Live Query for Search & Notifications
  const data = useLiveQuery(async () => {
    if (!user) return null;
    const sites = await db.getSitesForUser(user);
    const siteIds = sites.map(s => s.id);

    const [workers, materials, rodEntries, movements, catalog, attendance, floorPlans] = await Promise.all([
      db.workers.filter(w => !w.isDeleted && siteIds.includes(w.siteId)).toArray(),
      db.materials.filter(m => !m.isDeleted && siteIds.includes(m.siteId)).toArray(),
      db.rodEntries.filter(r => !r.isDeleted && siteIds.includes(r.siteId)).toArray(),
      db.stockMovements.filter(sm => !sm.isDeleted && siteIds.includes(sm.siteId)).toArray(),
      db.catalogItems.filter(c => !c.isDeleted).toArray(),
      db.attendance.filter(a => !a.isDeleted && siteIds.includes(a.siteId)).toArray(),
      db.floorPlans.filter(f => !f.isDeleted).toArray(),
    ]);

    // Build notifications from real records
    const notifications: NotificationItem[] = [];

    // 1. Low stock alerts
    const stockItems = buildStock(materials, rodEntries, movements, catalog);
    const lowStock = stockItems.filter(s => s.isLowStock || s.isNegative);
    if (lowStock.length > 0) {
      notifications.push({
        id: 'low-stock-alert',
        title: 'Material Stock Alert',
        message: `${lowStock.length} items low or negative in stock (${lowStock.slice(0, 2).map(s => s.name).join(', ')}${lowStock.length > 2 ? '...' : ''})`,
        type: 'danger',
        targetView: 'stock',
        timestamp: 'Live',
      });
    }

    // 2. Attendance alert for today
    const today = todayKey(DEFAULT_TIME_ZONE);
    const todaysAtt = attendance.filter(a => a.date === today);
    const markedWorkers = new Set(todaysAtt.map(a => a.workerId));
    const unmarkedCount = Math.max(0, workers.length - markedWorkers.size);
    if (unmarkedCount > 0 && workers.length > 0) {
      notifications.push({
        id: 'unmarked-attendance-alert',
        title: 'Attendance Incomplete',
        message: `${unmarkedCount} of ${workers.length} workers not yet marked for today`,
        type: 'warning',
        targetView: 'labour',
        timestamp: 'Today',
      });
    }

    // 3. Unsettled balance alert
    const unpaidMaterials = materials.filter(m => (m.balance || 0) > 0);
    const totalSupplierDue = unpaidMaterials.reduce((sum, m) => sum + (Number(m.balance) || 0), 0);
    if (totalSupplierDue > 0) {
      notifications.push({
        id: 'supplier-due-alert',
        title: 'Supplier Payables Due',
        message: `₹${totalSupplierDue.toLocaleString('en-IN')} pending balance across ${unpaidMaterials.length} material orders`,
        type: 'info',
        targetView: 'expenses',
        timestamp: 'Pending',
      });
    }

    return {
      sites,
      workers,
      materials,
      floorPlans,
      notifications,
    };
  }, [user]);

  const viewTitles: Record<string, string> = {
    dashboard: 'ERP Dashboard',
    'my-sites': 'Projects Portfolio',
    'site-detail': 'Project Operations',
    'floor-plans': 'Architectural Floor Plans',
    'floor-plan-editor': 'Floor Plan CAD Studio',
    labour: 'Workforce Attendance & Salaries',
    worker: 'Worker Profile & Ledger',
    stock: 'Materials & Stock Management',
    toolroom: 'Tools & Asset Management',
    expenses: 'Daily Project Expenses',
    reports: 'Financial & Operational Reports',
    estimator: 'Building Cost Calculator',
    backup: 'Backup & Data Management',
    settings: 'Application Settings & Preferences',
    admin: 'Administrator Control Center',
    trash: 'Recycle Bin & Safe Recovery',
  };

  const currentTitle = viewTitles[currentView] || 'Building Mistry ERP';

  // Global search filtering
  const q = searchQuery.trim().toLowerCase();
  const matchingSites = q && data ? data.sites.filter(s => `${s.name} ${s.area} ${s.address} ${s.ownerName}`.toLowerCase().includes(q)).slice(0, 4) : [];
  const matchingWorkers = q && data ? data.workers.filter(w => `${w.name} ${w.category} ${w.phone || ''}`.toLowerCase().includes(q)).slice(0, 4) : [];
  const matchingMaterials = q && data ? data.materials.filter(m => `${m.materialName} ${m.category} ${m.supplier}`.toLowerCase().includes(q)).slice(0, 4) : [];
  const matchingPlans = q && data ? data.floorPlans.filter(f => `${f.buildingName} ${f.floorName}`.toLowerCase().includes(q)).slice(0, 3) : [];
  const hasSearchResults = matchingSites.length > 0 || matchingWorkers.length > 0 || matchingMaterials.length > 0 || matchingPlans.length > 0;

  const notifications = data?.notifications || [];

  return (
    <header className="erp-top-nav" role="banner">
      {/* Left: Mobile hamburger & Page Title */}
      <div className="erp-top-nav-left">
        {onToggleSidebarMobile && (
          <button
            type="button"
            className="erp-mobile-menu-btn"
            onClick={onToggleSidebarMobile}
            aria-label="Toggle navigation menu"
          >
            <Menu size={20} />
          </button>
        )}

        <div className="erp-brand-badge">
          <div className="erp-brand-icon">
            <HardHat size={18} strokeWidth={2.4} />
          </div>
          <span className="erp-brand-name">Building Mistry</span>
        </div>

        <div className="erp-nav-divider" />

        <div className="erp-page-breadcrumb">
          <span className="erp-breadcrumb-root">ERP</span>
          <span className="erp-breadcrumb-sep">/</span>
          <h1 className="erp-page-title">{currentTitle}</h1>
        </div>
      </div>

      {/* Center: Global Real-time Search */}
      <div className="erp-top-nav-center" ref={searchContainerRef}>
        <div className={`erp-search-box ${isSearchFocused ? 'erp-search-focused' : ''}`}>
          <Search size={16} className="erp-search-icon" />
          <input
            type="text"
            className="erp-search-input"
            placeholder="Search projects, workers, materials, plans... (Press /)"
            value={searchQuery}
            onChange={e => {
              setSearchQuery(e.target.value);
              setIsSearchFocused(true);
            }}
            onFocus={() => setIsSearchFocused(true)}
          />
          {searchQuery && (
            <button
              type="button"
              className="erp-search-clear"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
            >
              <X size={14} />
            </button>
          )}
          <kbd className="erp-search-kbd">/</kbd>
        </div>

        {/* Search Results Dropdown */}
        {isSearchFocused && searchQuery.trim() && (
          <div className="erp-search-dropdown shadow-lg">
            {!hasSearchResults ? (
              <div className="erp-search-empty">
                <Search size={22} className="text-slate-400 mb-2" />
                <p className="text-sm font-medium text-slate-700">No records found matching "{searchQuery}"</p>
                <span className="text-xs text-slate-400">Search projects by name, workers by role, or materials by supplier.</span>
              </div>
            ) : (
              <div className="erp-search-groups">
                {matchingSites.length > 0 && (
                  <div className="erp-search-group">
                    <span className="erp-group-title">
                      <Building2 size={13} /> Construction Sites ({matchingSites.length})
                    </span>
                    {matchingSites.map(s => (
                      <button
                        key={s.id}
                        type="button"
                        className="erp-search-item"
                        onClick={() => {
                          onNavigate('site-detail', s.id);
                          setIsSearchFocused(false);
                          setSearchQuery('');
                        }}
                      >
                        <div className="erp-item-main">
                          <strong className="erp-item-title">{s.name}</strong>
                          <span className="erp-item-sub">{s.area || s.address || s.buildingType} • Owner: {s.ownerName}</span>
                        </div>
                        <span className={`erp-badge-status status-${s.status.toLowerCase().replace(/\s+/g, '')}`}>
                          {s.status}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {matchingWorkers.length > 0 && (
                  <div className="erp-search-group">
                    <span className="erp-group-title">
                      <Users size={13} /> Workforce ({matchingWorkers.length})
                    </span>
                    {matchingWorkers.map(w => (
                      <button
                        key={w.id}
                        type="button"
                        className="erp-search-item"
                        onClick={() => {
                          onNavigate('labour', w.siteId);
                          setIsSearchFocused(false);
                          setSearchQuery('');
                        }}
                      >
                        <div className="erp-item-main">
                          <strong className="erp-item-title">{w.name}</strong>
                          <span className="erp-item-sub">{w.category} • ₹{w.dailyWage}/day {w.phone ? `• ${w.phone}` : ''}</span>
                        </div>
                        <span className="erp-item-action">View Labour</span>
                      </button>
                    ))}
                  </div>
                )}

                {matchingMaterials.length > 0 && (
                  <div className="erp-search-group">
                    <span className="erp-group-title">
                      <Layers size={13} /> Materials Inventory ({matchingMaterials.length})
                    </span>
                    {matchingMaterials.map(m => (
                      <button
                        key={m.id}
                        type="button"
                        className="erp-search-item"
                        onClick={() => {
                          onNavigate('stock', m.siteId);
                          setIsSearchFocused(false);
                          setSearchQuery('');
                        }}
                      >
                        <div className="erp-item-main">
                          <strong className="erp-item-title">{m.materialName || m.category.toUpperCase()}</strong>
                          <span className="erp-item-sub">{m.quantity} {m.unit} from {m.supplier}</span>
                        </div>
                        <span className="erp-item-price">₹{Number(m.totalAmount || 0).toLocaleString('en-IN')}</span>
                      </button>
                    ))}
                  </div>
                )}

                {matchingPlans.length > 0 && (
                  <div className="erp-search-group">
                    <span className="erp-group-title">
                      <PenTool size={13} /> Floor Plans ({matchingPlans.length})
                    </span>
                    {matchingPlans.map(f => (
                      <button
                        key={f.id}
                        type="button"
                        className="erp-search-item"
                        onClick={() => {
                          onNavigate('floor-plans');
                          setIsSearchFocused(false);
                          setSearchQuery('');
                        }}
                      >
                        <div className="erp-item-main">
                          <strong className="erp-item-title">{f.buildingName} - {f.floorName}</strong>
                          <span className="erp-item-sub">{f.rooms?.length || 0} rooms • {f.walls?.length || 0} walls</span>
                        </div>
                        <span className="erp-item-action">CAD Studio</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right: Notifications, Help, User Profile */}
      <div className="erp-top-nav-right">
        {/* Mobile Search Toggle (< 900px) */}
        <button
          type="button"
          className="erp-icon-btn erp-mobile-search-btn"
          onClick={() => {
            setIsMobileSearchOpen(true);
            setTimeout(() => mobileSearchInputRef.current?.focus(), 80);
          }}
          title="Search"
          aria-label="Search records"
        >
          <Search size={18} />
        </button>

        {/* Help Button */}
        <div className="relative">
          <button
            type="button"
            className="erp-icon-btn"
            onClick={() => setIsHelpOpen(!isHelpOpen)}
            title="Help & Shortcuts"
            aria-label="Help and documentation"
          >
            <HelpCircle size={18} />
          </button>

          {isHelpOpen && (
            <div className="erp-help-modal-overlay" onClick={() => setIsHelpOpen(false)}>
              <div className="erp-help-modal" onClick={e => e.stopPropagation()}>
                <div className="erp-help-header">
                  <div className="flex items-center gap-2">
                    <HelpCircle size={20} className="text-blue-600" />
                    <h3 className="font-bold text-slate-900 text-base">Building Mistry ERP Guide</h3>
                  </div>
                  <button type="button" onClick={() => setIsHelpOpen(false)} className="text-slate-400 hover:text-slate-600">
                    <X size={18} />
                  </button>
                </div>
                <div className="erp-help-body">
                  <div className="erp-help-section">
                    <h4>Navigation & Shortcuts</h4>
                    <div className="erp-help-shortcuts">
                      <div className="shortcut-row">
                        <kbd>/</kbd>
                        <span>Focus Global Search</span>
                      </div>
                      <div className="shortcut-row">
                        <kbd>Esc</kbd>
                        <span>Close search, popovers, or active modal</span>
                      </div>
                    </div>
                  </div>

                  <div className="erp-help-section">
                    <h4>ERP Modules</h4>
                    <ul className="text-xs text-slate-600 space-y-1.5 list-disc pl-4">
                      <li><strong>Projects:</strong> Central portfolio of all active, planning, and completed sites.</li>
                      <li><strong>Floor Planner:</strong> Real-time CAD drawing tool for walls, rooms, doors, and 3D preview.</li>
                      <li><strong>Attendance & Salary:</strong> Worker ledgers, wage formulas, recoverable advances, and settlements.</li>
                      <li><strong>Materials & Tools:</strong> Purchase entries, unit conversion, inventory balances, and low-stock alerts.</li>
                      <li><strong>Expenses:</strong> Daily tea/snacks, pooja, electricity, water, and miscellaneous costs.</li>
                      <li><strong>Backup & Data:</strong> Local IndexedDB database export, JSON backups, and Supabase cloud sync.</li>
                    </ul>
                  </div>

                  <div className="erp-help-section">
                    <h4>Data Safety & Offline-First Storage</h4>
                    <p className="text-xs text-slate-500">
                      All your projects, attendance ledgers, materials and expense records are stored securely on this device inside your browser's private database (IndexedDB). It works 100% offline without needing internet. When Supabase cloud backend is configured, records sync to the cloud. You can also export a complete JSON backup at any time from Backup & Data.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Notifications Popover */}
        <div className="relative" ref={notifRef}>
          <button
            type="button"
            className={`erp-icon-btn ${notifications.length > 0 ? 'has-badge' : ''}`}
            onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
            title="Real-time Notifications"
            aria-label="View notifications"
          >
            <Bell size={18} />
            {notifications.length > 0 && (
              <span className="erp-badge-count">{notifications.length}</span>
            )}
          </button>

          {isNotificationsOpen && (
            <div className="erp-notif-dropdown shadow-xl">
              <div className="erp-notif-header">
                <div className="flex items-center gap-2">
                  <Bell size={16} className="text-slate-700" />
                  <strong className="text-sm text-slate-900">Notifications</strong>
                </div>
                <span className="text-xs text-slate-500 font-medium">
                  {notifications.length} {notifications.length === 1 ? 'alert' : 'alerts'}
                </span>
              </div>

              <div className="erp-notif-list">
                {notifications.length === 0 ? (
                  <div className="erp-notif-empty">
                    <CheckCircle2 size={24} className="text-emerald-500 mb-1" />
                    <p className="text-xs font-semibold text-slate-700">All systems up to date</p>
                    <span className="text-xs text-slate-400">No low stock alerts or pending settlements.</span>
                  </div>
                ) : (
                  notifications.map(n => (
                    <div
                      key={n.id}
                      className={`erp-notif-item type-${n.type}`}
                      onClick={() => {
                        onNavigate(n.targetView, n.siteId, n.tab);
                        setIsNotificationsOpen(false);
                      }}
                    >
                      <div className="erp-notif-dot" />
                      <div className="erp-notif-content">
                        <div className="flex items-center justify-between">
                          <strong className="erp-notif-title">{n.title}</strong>
                          <span className="erp-notif-time">{n.timestamp}</span>
                        </div>
                        <p className="erp-notif-msg">{n.message}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Profile Menu */}
        <div className="relative" ref={profileRef}>
          <button
            type="button"
            className="erp-profile-btn"
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            aria-label="User account menu"
          >
            <div className="erp-avatar">
              {isSuperAdmin(user) ? (
                <Crown size={14} className="text-amber-500" />
              ) : (
                <span>{(user?.fullName || user?.username || 'U')[0].toUpperCase()}</span>
              )}
            </div>
            <div className="erp-profile-meta">
              <span className="erp-user-name">{user?.fullName || user?.username || 'Local Builder'}</span>
              <span className="erp-user-role">
                {isSuperAdmin(user) ? 'Master Admin' : isAdmin(user) ? 'Admin' : 'Contractor'}
              </span>
            </div>
            <ChevronDown size={14} className="text-slate-400" />
          </button>

          {isProfileOpen && (
            <div className="erp-profile-dropdown shadow-xl">
              <div className="erp-profile-header">
                <div className="erp-avatar-large">
                  {isSuperAdmin(user) ? '👑' : (user?.fullName || user?.username || 'U')[0].toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-sm text-slate-900 truncate">
                    {user?.fullName || user?.username || 'Local Workspace'}
                  </div>
                  <div className="text-xs text-slate-500 truncate">
                    {user?.id === 'local-builder-user' ? 'Standalone Local Mode' : `@${user?.username}`}
                  </div>
                  <span className="erp-role-pill">
                    {isSuperAdmin(user) ? 'Real Admin Master' : isAdmin(user) ? 'Administrator' : 'Contractor Mistry'}
                  </span>
                </div>
              </div>

              <div className="erp-menu-divider" />

              <div className="erp-profile-menu-items">
                <button
                  type="button"
                  className="erp-menu-item"
                  onClick={() => {
                    onNavigate('backup');
                    setIsProfileOpen(false);
                  }}
                >
                  <Database size={16} />
                  <span>Backup & Data Settings</span>
                </button>

                {isAdmin(user) && (
                  <button
                    type="button"
                    className="erp-menu-item"
                    onClick={() => {
                      onNavigate('admin');
                      setIsProfileOpen(false);
                    }}
                  >
                    <ShieldCheck size={16} />
                    <span>Admin Control Center</span>
                  </button>
                )}

                <button
                  type="button"
                  className="erp-menu-item"
                  onClick={() => {
                    onNavigate('trash');
                    setIsProfileOpen(false);
                  }}
                >
                  <ExternalLink size={16} />
                  <span>Recycle Bin (Trash)</span>
                </button>
              </div>

              <div className="erp-menu-divider" />

              <div className="erp-profile-footer">
                {user?.id === 'local-builder-user' ? (
                  <button
                    type="button"
                    className="erp-btn-cloud-connect"
                    onClick={() => {
                      onNavigate('login');
                      setIsProfileOpen(false);
                    }}
                  >
                    <LogIn size={15} />
                    <span>Connect Supabase Cloud</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    className="erp-btn-signout"
                    onClick={() => {
                      setIsProfileOpen(false);
                      onLogout();
                    }}
                  >
                    <LogOut size={15} />
                    <span>Sign Out</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Search Modal Dialog (< 900px) */}
      {isMobileSearchOpen && (
        <div className="erp-help-modal-overlay" onClick={() => setIsMobileSearchOpen(false)}>
          <div
            className="erp-mobile-search-dialog"
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Global search"
          >
            <div className="erp-mobile-search-header">
              <Search size={18} className="text-slate-400" />
              <input
                ref={mobileSearchInputRef}
                type="text"
                className="erp-mobile-search-input"
                placeholder="Search projects, workers, materials, plans..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
              <button
                type="button"
                className="erp-mobile-search-close"
                onClick={() => setIsMobileSearchOpen(false)}
                aria-label="Close search"
              >
                <X size={18} />
              </button>
            </div>

            <div className="erp-mobile-search-results">
              {!searchQuery.trim() ? (
                <div className="erp-search-empty">
                  <Search size={24} className="text-slate-400 mb-2" />
                  <p className="text-sm font-semibold text-slate-700">Type to search anything</p>
                  <span className="text-xs text-slate-400">Search projects, workers, inventory and floor plans in real time.</span>
                </div>
              ) : !hasSearchResults ? (
                <div className="erp-search-empty">
                  <p className="text-sm font-semibold text-slate-700">No matching records found for "{searchQuery}"</p>
                  <span className="text-xs text-slate-400">Check spelling or try a shorter name.</span>
                </div>
              ) : (
                <div className="erp-search-groups p-2">
                  {matchingSites.length > 0 && (
                    <div className="erp-search-group">
                      <span className="erp-group-title">
                        <Building2 size={13} /> Sites ({matchingSites.length})
                      </span>
                      {matchingSites.map(s => (
                        <button
                          key={s.id}
                          type="button"
                          className="erp-search-item"
                          onClick={() => {
                            onNavigate('site-detail', s.id);
                            setIsMobileSearchOpen(false);
                            setSearchQuery('');
                          }}
                        >
                          <div className="erp-item-main">
                            <strong className="erp-item-title">{s.name}</strong>
                            <span className="erp-item-sub">{s.area || s.address}</span>
                          </div>
                          <span className={`erp-badge-status status-${s.status.toLowerCase().replace(/\s+/g, '')}`}>
                            {s.status}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                  {matchingWorkers.length > 0 && (
                    <div className="erp-search-group">
                      <span className="erp-group-title">
                        <Users size={13} /> Workforce ({matchingWorkers.length})
                      </span>
                      {matchingWorkers.map(w => (
                        <button
                          key={w.id}
                          type="button"
                          className="erp-search-item"
                          onClick={() => {
                            onNavigate('labour', w.siteId);
                            setIsMobileSearchOpen(false);
                            setSearchQuery('');
                          }}
                        >
                          <div className="erp-item-main">
                            <strong className="erp-item-title">{w.name}</strong>
                            <span className="erp-item-sub">{w.category} • ₹{w.dailyWage}/day</span>
                          </div>
                          <span className="erp-item-action">View Labour</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {matchingMaterials.length > 0 && (
                    <div className="erp-search-group">
                      <span className="erp-group-title">
                        <Layers size={13} /> Inventory ({matchingMaterials.length})
                      </span>
                      {matchingMaterials.map(m => (
                        <button
                          key={m.id}
                          type="button"
                          className="erp-search-item"
                          onClick={() => {
                            onNavigate('stock', m.siteId);
                            setIsMobileSearchOpen(false);
                            setSearchQuery('');
                          }}
                        >
                          <div className="erp-item-main">
                            <strong className="erp-item-title">{m.materialName || m.category}</strong>
                            <span className="erp-item-sub">{m.quantity} {m.unit}</span>
                          </div>
                          <span className="erp-item-price">₹{Number(m.totalAmount || 0).toLocaleString('en-IN')}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {matchingPlans.length > 0 && (
                    <div className="erp-search-group">
                      <span className="erp-group-title">
                        <FileCode size={13} /> Plans ({matchingPlans.length})
                      </span>
                      {matchingPlans.map(p => (
                        <button
                          key={p.id}
                          type="button"
                          className="erp-search-item"
                          onClick={() => {
                            onNavigate('floor-plans', p.id);
                            setIsMobileSearchOpen(false);
                            setSearchQuery('');
                          }}
                        >
                          <div className="erp-item-main">
                            <strong className="erp-item-title">{p.buildingName || 'Floor Plan'}</strong>
                            <span className="erp-item-sub">{p.floors?.length || 1} floor(s)</span>
                          </div>
                          <span className="erp-item-action">Open Plan</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

