import React, { useState, useMemo } from 'react';
import {
  Building2,
  HardHat,
  Search,
  PlusCircle,
  Phone,
  MapPin,
  Calendar,
  Layers,
  Users,
  Wrench,
  Coffee,
  Sparkles,
  Zap,
  Droplets,
  Edit2,
  Trash2,
  TrendingUp,
  ArrowRight,
  Database,
  Crown,
  ShieldCheck,
  Wallet,
  PenTool,
  BarChart3,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ExternalLink,
  ChevronRight,
  Filter,
  LayoutGrid,
  Table as TableIcon,
  Package,
  Calculator,
} from 'lucide-react';
import { useOverallStats, type DashboardExpenseItem } from '../hooks/useOverallStats';
import { DashboardToday } from '../components/DashboardToday';
import { markAllPresent } from '../services/records';
import { loadDemoData } from '../db/seedData';
import { db } from '../db/db';
import { isAdmin, isSuperAdmin } from '../services/auth';
import type { Site, User, MaterialCategory } from '../db/types';
import { motion } from 'motion/react';
import { SITE_VISUAL } from '../utils/constructionVisuals';
import { calculateFinancialBalance } from '../utils/financial';
import { SafeImage } from '../components/ui/SafeImage';
import { formatDay, todayKey, DEFAULT_TIME_ZONE } from '../utils/datetime';
import { APP_NAME } from '../config/brand';

const formatTargetDate = (dateVal?: string | null): string => {
  if (!dateVal) return 'Target unset';
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return 'Target unset';
    const month = d.toLocaleDateString('en-US', { month: 'short' });
    const year = d.getFullYear();
    return `Target: ${month} ${year}`;
  } catch {
    return 'Target unset';
  }
};

interface DashboardViewProps {
  onOpenSite: (siteId: string) => void;
  onOpenNewSiteModal: () => void;
  onEditSite: (site: Site) => void;
  onDeleteSiteToTrash: (site: Site) => void;
  onNotify: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onlySites?: boolean;
  user?: User | null;
  onNavigate?: (view: string, siteId?: string, tab?: string, subTab?: string) => void;
  onOpenMaterialModal?: (category?: MaterialCategory) => void;
  onOpenExpenseModal?: (type?: string) => void;
  selectedSiteId?: string | null;
  onSelectSite?: (siteId: string | null) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onOpenSite,
  onOpenNewSiteModal,
  onEditSite,
  onDeleteSiteToTrash,
  onNotify,
  onlySites = false,
  user,
  onNavigate,
  onOpenMaterialModal,
  onOpenExpenseModal,
  selectedSiteId,
  onSelectSite,
}) => {
  const [selectedSiteFilterId, setSelectedSiteFilterId] = useState<string | null>(() => selectedSiteId || null);

  const stats = useOverallStats(user, selectedSiteFilterId);
  const sites = stats?.allSites || [];

  // Active site ID for site-wise expense isolation (default to first site if available)
  const [activeSiteId, setActiveSiteId] = useState<string | null>(() => selectedSiteId || null);

  React.useEffect(() => {
    if (selectedSiteId !== undefined) {
      setSelectedSiteFilterId(selectedSiteId);
      if (selectedSiteId) {
        setActiveSiteId(selectedSiteId);
      }
    }
  }, [selectedSiteId]);

  React.useEffect(() => {
    if (selectedSiteFilterId) {
      setActiveSiteId(selectedSiteFilterId);
    } else if (!activeSiteId && sites.length > 0) {
      setActiveSiteId(sites[0].id);
    }
  }, [selectedSiteFilterId, sites, activeSiteId]);

  // Handler for clicking any site card or row
  const handleSiteClick = (siteId: string) => {
    setActiveSiteId(siteId);
    setSelectedSiteFilterId(siteId);
    if (onSelectSite) onSelectSite(siteId);
  };

  const handleClearSiteFilter = () => {
    setSelectedSiteFilterId(null);
    if (onSelectSite) onSelectSite(null);
  };

  // 4. GET THE ACTIVE SITE OBJECT
  const activeSite = useMemo(() => {
    if (!sites || sites.length === 0) return null;
    return sites.find(s => s.id === activeSiteId) || sites.find(s => s.id === selectedSiteFilterId) || sites[0];
  }, [sites, activeSiteId, selectedSiteFilterId]);

  // 5. STRICT FILTER: Only expenses belonging to the CLICKED site
  const filteredSiteExpenses = useMemo<DashboardExpenseItem[]>(() => {
    const targetSiteId = activeSiteId || selectedSiteFilterId || activeSite?.id;
    if (!targetSiteId || !stats?.allExpenses) return [];
    return stats.allExpenses.filter(e => String(e.siteId) === String(targetSiteId));
  }, [stats?.allExpenses, activeSiteId, selectedSiteFilterId, activeSite]);

  // 6. TOTAL AMOUNT FOR THE CLICKED SITE ONLY
  const siteTotalCost = useMemo(() => {
    return filteredSiteExpenses.reduce((sum: number, item: DashboardExpenseItem) => sum + Number(item.amount || 0), 0);
  }, [filteredSiteExpenses]);

  // Pre-calculated individual totals per site for the selector cards badge
  const siteExpenseSums = useMemo(() => {
    const map: Record<string, number> = {};
    (stats?.allExpenses || []).forEach(e => {
      map[e.siteId] = (map[e.siteId] || 0) + Number(e.amount || 0);
    });
    (stats?.siteSummaries || []).forEach(s => {
      if (!map[s.site.id] && s.totalExpense > 0) {
        map[s.site.id] = s.totalExpense;
      }
    });
    return map;
  }, [stats?.allExpenses, stats?.siteSummaries]);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [selectedContractor, setSelectedContractor] = useState<string>('All');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('table');
  const [usersList, setUsersList] = useState<User[]>([]);
  const [loadingDemo, setLoadingDemo] = useState(false);
  const [dashboardMode, setDashboardMode] = useState<'mastri' | 'engineer'>(() => {
    if (user?.role === 'MISTRY' || (user?.role as string) === 'contractor') return 'mastri';
    return 'engineer';
  });
  const [tnArea, setTnArea] = useState<number>(1000);

  // Same service as the attendance screens: marks only workers not marked yet today, per project.
  const handleMarkAllPresent = async () => {
    try {
      if (!user) throw new Error('Sign in is required to mark attendance.');
      const today = todayKey();
      const siteIds = selectedSiteFilterId ? [selectedSiteFilterId] : sites.map(s => s.id);
      let marked = 0;
      let kept = 0;
      let workerCount = 0;
      for (const siteId of siteIds) {
        const workers = await db.workers.where('siteId').equals(siteId).filter(w => !w.isDeleted).toArray();
        if (!workers.length) continue;
        workerCount += workers.length;
        const res = await markAllPresent(user, siteId, workers, today);
        if (!res.ok) throw new Error(res.error);
        marked += res.value.marked;
        kept += res.value.kept;
      }
      if (workerCount === 0) {
        onNotify('ஆஜர் பதிவு செய்ய தொழிலாளர்கள் இல்லை. (No workers found)', 'info');
        return;
      }
      onNotify(`${marked} marked Present today${kept ? ` · ${kept} already marked, kept` : ''}`, 'success');
    } catch (err: any) {
      onNotify('ஆஜர் பதிவு தோல்வி: ' + err.message, 'error');
    }
  };

  React.useEffect(() => {
    if (isAdmin(user)) {
      db.users.toArray().then(setUsersList);
    }
  }, [user]);

  const userMap = new Map<string, string>();
  usersList.forEach(u => userMap.set(u.id, `${u.fullName || u.username}`));

  // Time-based greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  // Indian Locale Formatted Date
  const formattedDate = new Intl.DateTimeFormat('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  const userName = user?.fullName || user?.username || 'Builder';

  const handleLoadDemo = async () => {
    setLoadingDemo(true);
    try {
      await loadDemoData(user?.id);
      onNotify('Sample site "Sri Murugan Illam" loaded successfully! (Marked as DEMO)', 'success');
    } catch (err: any) {
      onNotify('Failed to load demo data: ' + err.message, 'error');
    } finally {
      setLoadingDemo(false);
    }
  };

  if (!stats) {
    return (
      <div className="erp-dashboard-container">
        <div style={{ padding: '80px 20px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
          <div className="spinner" style={{ margin: '0 auto 16px', width: '32px', height: '32px', border: '3px solid var(--color-border)', borderTopColor: 'var(--color-primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-charcoal)' }}>Loading {APP_NAME}...</h3>
          <p style={{ fontSize: '0.88rem' }}>Aggregating live projects, workforce ledgers, and inventory balances...</p>
        </div>
      </div>
    );
  }

  // Filter site cards/rows
  const filteredSummaries = stats.siteSummaries.filter(item => {
    const s = item.site;
    const matchesQuery =
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.ownerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.area.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.address.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'All' || s.status === statusFilter;
    const matchesContractor = selectedContractor === 'All' || s.userId === selectedContractor;

    return matchesQuery && matchesStatus && matchesContractor;
  });

  // Monthly trends max calculation for SVG chart scaling
  const maxMonthlyExpense = Math.max(1, ...stats.monthlyTrends.map(m => m.expense));

  return (
    <div className="erp-dashboard-container">
      {/* Real Admin Master Banner */}
      {isAdmin(user) && (
        <div
          style={{
            background: 'linear-gradient(135deg, var(--color-warning-soft) 0%, var(--color-surface) 100%)',
            border: '1px solid var(--color-warning-border)',
            borderRadius: '16px',
            padding: '16px 20px',
            boxShadow: 'var(--shadow-sm)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                backgroundColor: 'var(--color-warning-soft)',
                border: '1px solid var(--color-warning-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-warning-text)',
                flexShrink: 0,
              }}
            >
              <Crown size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <strong style={{ color: 'var(--color-warning-text)', fontSize: '0.95rem', fontWeight: 800 }}>
                  Real Admin Master Access Active
                </strong>
                <span
                  style={{
                    backgroundColor: 'var(--color-warning-soft)',
                    color: 'var(--color-warning-text)',
                    fontSize: '0.72rem',
                    padding: '2px 8px',
                    borderRadius: '10px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                  }}
                >
                  Full Cross-Contractor Oversight
                </span>
              </div>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.84rem', margin: '2px 0 0 0' }}>
                Unrestricted oversight across all registered mistries, construction sites, material inventories, and financial ledgers.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                color: 'var(--color-charcoal)',
                fontSize: '0.82rem',
                backgroundColor: 'var(--color-bg)',
                border: '1px solid var(--color-border)',
                padding: '4px 12px',
                borderRadius: '20px',
                fontWeight: 600,
              }}
            >
              Total Projects Monitored: <strong>{stats.totalSites}</strong>
            </span>
          </div>
        </div>
      )}

      {/* Today at a glance: the same numbers as the phone Home screen. */}
      <DashboardToday
        summary={stats.dashboard}
        activity={stats.activityLog}
        scopeName={stats.filteredSiteName || 'All projects'}
        onNavigate={view => onNavigate?.(view)}
      />

      {/* 4.5 Mode Toggle: Mastri Field Mode vs Engineer Mode */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
        <div style={{ display: 'flex', gap: 6, backgroundColor: 'var(--color-bg)', padding: 4, borderRadius: 12, border: '1px solid var(--color-border)' }}>
          <button
            type="button"
            onClick={() => setDashboardMode('mastri')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              minHeight: 44,
              padding: '8px 14px',
              borderRadius: 8,
              border: dashboardMode === 'mastri' ? '1px solid var(--color-primary)' : '1px solid transparent',
              backgroundColor: dashboardMode === 'mastri' ? 'var(--color-primary)' : 'transparent',
              color: dashboardMode === 'mastri' ? 'var(--color-on-primary)' : 'var(--color-text-muted)',
              fontWeight: 700,
              fontSize: '0.84rem',
              cursor: 'pointer',
            }}
          >
            <HardHat size={16} />
            <span>👷 மேஸ்திரி ஃபீல்டு மோட் (Mastri Field Mode)</span>
          </button>
          <button
            type="button"
            onClick={() => setDashboardMode('engineer')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              minHeight: 44,
              padding: '8px 14px',
              borderRadius: 8,
              border: dashboardMode === 'engineer' ? '1px solid var(--color-charcoal)' : '1px solid transparent',
              backgroundColor: dashboardMode === 'engineer' ? 'var(--color-charcoal)' : 'transparent',
              color: dashboardMode === 'engineer' ? '#ffffff' : 'var(--color-text-muted)',
              fontWeight: 700,
              fontSize: '0.84rem',
              cursor: 'pointer',
            }}
          >
            <span>📐 பொறியாளர் மோட் (Engineer Mode)</span>
          </button>
        </div>

        <span style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>
          {dashboardMode === 'mastri' ? '⚡ அதிவேக ஆன்-சைட் மேலாண்மை வசதிகள்' : '📊 முழு CAD வரைபடம், திட்ட மதிப்பீடு & பகுப்பாய்வு'}
        </span>
      </div>

      {/* 4.6 Mastri Field Mode Active Card */}
      {dashboardMode === 'mastri' && (
        <div
          style={{
            backgroundColor: '#fffbeb',
            border: '1.5px solid #fde68a',
            borderRadius: 14,
            padding: '16px 20px',
            marginBottom: 16,
            boxShadow: '0 2px 8px rgba(217, 119, 6, 0.08)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#fef3c7', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <HardHat size={20} />
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: '#92400e' }}>
                  மேஸ்திரி ஆன்-சைட் விரைவு கட்டுப்பாடுகள் (Mastri Quick Site Controls)
                </h4>
                <p style={{ margin: '2px 0 0', fontSize: '0.76rem', color: '#78350f' }}>
                  தொழிலாளர் ஆஜர், டீ/ஸ்நாக்ஸ் சில்லறை செலவு, மற்றும் மெட்டீரியல் வரவு 1-கிளிக்கில் பதிவு செய்யவும்
                </p>
              </div>
            </div>

            <span style={{ backgroundColor: '#fef3c7', border: '1px solid #fcd34d', color: '#b45309', padding: '3px 10px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 700 }}>
              {stats.attendanceToday.present} Present / {stats.totalWorkers} Workers
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
            {/* 1-Click Mark All Present */}
            <button
              type="button"
              onClick={handleMarkAllPresent}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '12px 14px',
                borderRadius: 10,
                border: 'none',
                backgroundColor: '#16a34a',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '0.85rem',
                cursor: 'pointer',
                boxShadow: '0 2px 6px rgba(22, 163, 74, 0.25)',
              }}
            >
              <CheckCircle2 size={18} />
              <span>1-Click Mark All Present (அனைவரும் ஆஜர்)</span>
            </button>

            {/* Quick Tea & Snacks Petty Cash */}
            <button
              type="button"
              onClick={() => {
                if (onOpenExpenseModal) onOpenExpenseModal('tea_snacks');
                else if (onNavigate) onNavigate('expenses');
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                minHeight: 44,
                padding: '12px 14px',
                borderRadius: 10,
                border: '1px solid var(--color-warning-border)',
                backgroundColor: 'var(--color-surface)',
                color: 'var(--color-warning-text)',
                fontWeight: 700,
                fontSize: '0.86rem',
                cursor: 'pointer',
              }}
            >
              <Coffee size={18} color="var(--color-warning)" />
              <span>டீ / ஸ்நாக்ஸ் செலவு (Tea / Snacks ₹)</span>
            </button>

            {/* Quick Material Inward */}
            <button
              type="button"
              onClick={() => {
                if (onOpenMaterialModal) onOpenMaterialModal('cement');
                else if (onNavigate) onNavigate('stock');
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                minHeight: 44,
                padding: '12px 14px',
                borderRadius: 10,
                border: '1px solid var(--color-primary-border)',
                backgroundColor: 'var(--color-surface)',
                color: 'var(--color-primary-text)',
                fontWeight: 700,
                fontSize: '0.86rem',
                cursor: 'pointer',
              }}
            >
              <Layers size={18} color="var(--color-primary)" />
              <span>மெட்டீரியல் வரவு (Material Inward)</span>
            </button>

            {/* Attendance & Wage Settlement */}
            <button
              type="button"
              onClick={() => onNavigate ? onNavigate('labour') : undefined}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                minHeight: 44,
                padding: '12px 14px',
                borderRadius: 10,
                border: '1px solid var(--color-border-strong)',
                backgroundColor: 'var(--color-surface)',
                color: 'var(--color-charcoal)',
                fontWeight: 700,
                fontSize: '0.86rem',
                cursor: 'pointer',
              }}
            >
              <Users size={18} color="var(--color-charcoal)" />
              <span>சம்பள பட்டுவாடா & ரசீது (Wage Slips)</span>
            </button>
          </div>
        </div>
      )}

      {/* 5. Welcome Section & Quick Action Buttons */}
      <div className="erp-welcome-card">
        <div className="erp-welcome-left">
          <div className="erp-welcome-badge">
            <Clock size={13} />
            <span>{formattedDate}</span>
          </div>
          <h2 className="erp-welcome-title">
            {getGreeting()}, {userName}
          </h2>
          <p className="erp-welcome-desc">
            {onlySites
              ? `Manage and monitor ${stats.totalSites} active and planned construction projects.`
              : `Overview of ${stats.totalSites} projects, ${stats.totalWorkers} active workers, and ₹${stats.overallExpense.toLocaleString('en-IN')} in total recorded expenditures.`}
          </p>
        </div>

        {/* 5 Quick Action Buttons */}
        <div className="erp-quick-actions-bar">
          <button
            type="button"
            className="erp-action-btn erp-action-primary"
            onClick={onOpenNewSiteModal}
            title="Create a new construction project"
          >
            <PlusCircle size={16} />
            <span>Create Project</span>
          </button>

          <button
            type="button"
            className="erp-action-btn erp-action-secondary"
            onClick={() => onNavigate ? onNavigate('floor-plans') : undefined}
            title="Open Architectural Floor Planner"
          >
            <PenTool size={16} />
            <span>Open Floor Planner</span>
          </button>

          <button
            type="button"
            className="erp-action-btn erp-action-secondary"
            onClick={() => {
              if (onOpenExpenseModal) onOpenExpenseModal();
              else if (onNavigate) onNavigate('expenses');
            }}
            title="Log project expense"
          >
            <Wallet size={16} />
            <span>Add Expense</span>
          </button>

          <button
            type="button"
            className="erp-action-btn erp-action-secondary"
            onClick={() => {
              if (onOpenMaterialModal) onOpenMaterialModal('sand');
              else if (onNavigate) onNavigate('stock');
            }}
            title="Record material purchase or stock entry"
          >
            <Layers size={16} />
            <span>Add Material</span>
          </button>

          <button
            type="button"
            className="erp-action-btn erp-action-secondary"
            onClick={() => onNavigate ? onNavigate('reports') : undefined}
            title="View financial and labour reports"
          >
            <BarChart3 size={16} />
            <span>View Reports</span>
          </button>
        </div>
      </div>

      {/* 6. Analytics Cards (Shown on main dashboard) */}
      {!onlySites && (
        <div className="erp-kpi-grid">
          {/* 1. Total Projects */}
          <div className="erp-kpi-card">
            <div className="erp-kpi-header">
              <span className="erp-kpi-title">Total Projects</span>
              <div className="erp-kpi-icon-box" style={{ background: 'var(--color-primary-soft)', color: 'var(--color-primary-text)' }}>
                <Building2 size={18} />
              </div>
            </div>
            <div className="erp-kpi-value">{stats.totalSites}</div>
            <div className="erp-kpi-footer">
              <span className="erp-badge-pill" style={{ background: 'var(--color-primary-soft)', color: 'var(--color-primary-text)' }}>
                {stats.activeSites} Active
              </span>
              <span>• {stats.completedSites} Completed</span>
            </div>
          </div>

          {/* 2. Active Projects */}
          <div className="erp-kpi-card">
            <div className="erp-kpi-header">
              <span className="erp-kpi-title">Active Sites</span>
              <div className="erp-kpi-icon-box" style={{ background: 'var(--color-success-soft)', color: 'var(--color-success)' }}>
                <CheckCircle2 size={18} />
              </div>
            </div>
            <div className="erp-kpi-value" style={{ color: 'var(--color-success)' }}>{stats.activeSites}</div>
            <div className="erp-kpi-footer">
              <span>{stats.totalSites > 0 ? Math.round((stats.activeSites / stats.totalSites) * 100) : 0}% of portfolio</span>
            </div>
          </div>

          {/* 3. Completed Projects */}
          <div className="erp-kpi-card">
            <div className="erp-kpi-header">
              <span className="erp-kpi-title">Completed</span>
              <div className="erp-kpi-icon-box" style={{ background: 'var(--color-charcoal-soft)', color: 'var(--color-charcoal)' }}>
                <Building2 size={18} />
              </div>
            </div>
            <div className="erp-kpi-value" style={{ color: 'var(--color-charcoal)' }}>{stats.completedSites}</div>
            <div className="erp-kpi-footer">
              <span>{stats.planningSites} in planning • {stats.onHoldSites} on hold</span>
            </div>
          </div>

          {/* 4. Total Workers */}
          <div
            className="erp-kpi-card cursor-pointer"
            onClick={() => onNavigate ? onNavigate('labour') : undefined}
            title="Click to view Attendance & Salary"
          >
            <div className="erp-kpi-header">
              <span className="erp-kpi-title">Total Workers</span>
              <div className="erp-kpi-icon-box" style={{ background: 'var(--color-warning-soft)', color: 'var(--color-warning-text)' }}>
                <Users size={18} />
              </div>
            </div>
            <div className="erp-kpi-value">{stats.totalWorkers}</div>
            <div className="erp-kpi-footer">
              <span className="erp-badge-pill" style={{ background: 'var(--color-success-soft)', color: 'var(--color-success-text)' }}>
                {stats.attendanceToday.present} Present Today
              </span>
            </div>
          </div>

          {/* 5. Total Expenses */}
          <div className="erp-kpi-card">
            <div className="erp-kpi-header">
              <span className="erp-kpi-title">Total Expenses</span>
              <div className="erp-kpi-icon-box" style={{ background: 'var(--color-primary-soft)', color: 'var(--color-primary-text)' }}>
                <TrendingUp size={18} />
              </div>
            </div>
            <div className="erp-kpi-value">₹{stats.overallExpense.toLocaleString('en-IN')}</div>
            <div className="erp-kpi-footer">
              <span style={{ color: 'var(--color-success)', fontWeight: 600 }}>₹{stats.overallPaid.toLocaleString('en-IN')}</span> paid
            </div>
          </div>

          {/* 6. Material Stock Value & Alerts */}
          <div
            className="erp-kpi-card cursor-pointer"
            onClick={() => onNavigate ? onNavigate('stock') : undefined}
            title="Click to view Material Stock"
          >
            <div className="erp-kpi-header">
              <span className="erp-kpi-title">Total Stock Value</span>
              <div
                className="erp-kpi-icon-box"
                style={{
                  background: stats.materialStock.lowStockCount > 0 ? '#FEF3C7' : '#DCFCE7',
                  color: stats.materialStock.lowStockCount > 0 ? '#D97706' : '#16A34A',
                }}
              >
                <Package size={18} />
              </div>
            </div>
            <div
              className="erp-kpi-value"
              style={{ color: '#16A34A' }}
            >
              ₹{stats.materialStock.totalStockValue.toLocaleString('en-IN')}
            </div>
            <div className="erp-kpi-footer">
              {stats.materialStock.lowStockCount > 0 ? (
                <span className="text-amber-600 font-bold">{stats.materialStock.lowStockCount} low-stock alerts</span>
              ) : (
                <span className="text-emerald-600 font-medium">All levels optimal ({stats.materialStock.inStockCount} items)</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Module 6: Real Tamil Nadu Material Costing & Quick Estimation */}
      <div
        style={{
          backgroundColor: '#ffffff',
          border: '1.5px solid #e2e8f0',
          borderRadius: 16,
          padding: '18px 20px',
          marginBottom: 20,
          boxShadow: '0 4px 12px rgba(15, 23, 42, 0.04)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: 12, marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: 'var(--color-primary-soft)', color: 'var(--color-primary-text)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Calculator size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--color-charcoal)' }}>
                தமிழ்நாடு கட்டுமானப் பொருட்கள் விலை நிலவரம் & மதிப்பீடு (Tamil Nadu Costing)
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>
                சந்தையின் தற்போதைய நேரடி விலை நிலவரம் மற்றும் சதுர அடி அடிப்படையிலான உத்தேச மதிப்பீடு
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569' }}>கட்டிட பரப்பு (Area):</span>
            <input
              type="number"
              min={100}
              step={50}
              value={tnArea}
              onChange={e => setTnArea(Math.max(100, Number(e.target.value) || 0))}
              style={{
                width: '100px',
                padding: '6px 10px',
                borderRadius: 8,
                border: '1.5px solid #cbd5e1',
                fontSize: '0.85rem',
                fontWeight: 700,
                textAlign: 'right',
              }}
            />
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b' }}>sq.ft</span>
          </div>
        </div>

        {/* 5 Real TN Material Benchmarks */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10, marginBottom: 14 }}>
          <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 12px' }}>
            <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'block', fontWeight: 600 }}>சிமெண்ட் (Cement)</span>
            <strong style={{ fontSize: '1rem', color: '#0f172a' }}>₹400</strong>
            <span style={{ fontSize: '0.72rem', color: '#64748b' }}> / 50kg bag</span>
          </div>
          <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 12px' }}>
            <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'block', fontWeight: 600 }}>எம்-சாண்ட் (M-Sand)</span>
            <strong style={{ fontSize: '1rem', color: '#0f172a' }}>₹55</strong>
            <span style={{ fontSize: '0.72rem', color: '#64748b' }}> / cft</span>
          </div>
          <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 12px' }}>
            <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'block', fontWeight: 600 }}>ஆற்று மணல் (River Sand)</span>
            <strong style={{ fontSize: '1rem', color: '#0f172a' }}>₹95</strong>
            <span style={{ fontSize: '0.72rem', color: '#64748b' }}> / cft</span>
          </div>
          <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 12px' }}>
            <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'block', fontWeight: 600 }}>செங்கல் (Red Bricks)</span>
            <strong style={{ fontSize: '1rem', color: '#0f172a' }}>₹11</strong>
            <span style={{ fontSize: '0.72rem', color: '#64748b' }}> / piece</span>
          </div>
          <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 12px' }}>
            <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'block', fontWeight: 600 }}>TMT கம்பிகள் (Fe 550D Steel)</span>
            <strong style={{ fontSize: '1rem', color: '#0f172a' }}>₹65</strong>
            <span style={{ fontSize: '0.72rem', color: '#64748b' }}> / kg</span>
          </div>
        </div>

        {/* Total Cost Formula & Material Quantities for given sq.ft */}
        {(() => {
          const ratePerSqFt = 1850;
          const totalCost = tnArea * ratePerSqFt;
          const cementBags = Math.round(tnArea * 0.4);
          const steelKg = Math.round(tnArea * 4);
          const sandCft = Math.round(tnArea * 1.8);
          const bricksCount = Math.round(tnArea * 19);

          return (
            <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <span style={{ fontSize: '0.78rem', color: '#166534', fontWeight: 700, display: 'block' }}>
                    {tnArea} sq.ft க்கான உத்தேச கட்டுமான செலவு (Standard G+1 Residential @ ₹1,850/sq.ft):
                  </span>
                  <strong style={{ fontSize: '1.35rem', color: '#15803d', fontWeight: 900 }}>
                    ₹{totalCost.toLocaleString('en-IN')}
                  </strong>
                </div>

                <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: '0.8rem', color: '#166534' }}>
                  <div>📦 சிமெண்ட்: <strong>{cementBags} மூட்டைகள்</strong> (~₹{(cementBags * 400).toLocaleString('en-IN')})</div>
                  <div>🔩 ஸ்டீல்: <strong>{steelKg.toLocaleString('en-IN')} kg</strong> (~₹{(steelKg * 65).toLocaleString('en-IN')})</div>
                  <div>⏳ மணல்: <strong>{sandCft.toLocaleString('en-IN')} cft</strong> (~₹{(sandCft * 55).toLocaleString('en-IN')})</div>
                  <div>🧱 செங்கல்: <strong>{bricksCount.toLocaleString('en-IN')} கல்</strong> (~₹{(bricksCount * 11).toLocaleString('en-IN')})</div>
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      {/* 7 & 8. Main 2-Column Section: Project Portfolio & Financials */}
      {/* Site Selection Filter Bar (Requirement 6) */}
      <div
        className="erp-site-selection-bar"
        id="dashboard-site-selection-bar"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          background: selectedSiteFilterId ? 'var(--color-primary-soft)' : 'var(--color-surface)',
          padding: '14px 18px',
          borderRadius: '12px',
          border: selectedSiteFilterId ? '1.5px solid var(--color-primary)' : '1px solid var(--color-border)',
          marginBottom: '16px',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Building2 size={18} color="var(--color-primary)" />
            <span style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--color-charcoal)' }}>
              Select Site to Filter Dashboard:
            </span>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              id="dashboard-site-pill-all"
              onClick={handleClearSiteFilter}
              style={{
                borderRadius: '20px',
                fontSize: '0.84rem',
                minHeight: '44px',
                padding: '8px 16px',
                fontWeight: 700,
                cursor: 'pointer',
                backgroundColor: !selectedSiteFilterId ? 'var(--color-primary)' : 'var(--color-surface)',
                color: !selectedSiteFilterId ? 'var(--color-on-primary)' : 'var(--color-charcoal)',
                border: !selectedSiteFilterId ? '1px solid var(--color-primary)' : '1px solid var(--color-border-strong)',
                boxShadow: !selectedSiteFilterId ? 'var(--shadow-sm)' : 'none',
              }}
            >
              All Projects ({stats.totalSites})
            </button>

            {stats.siteSummaries.map(({ site }) => {
              const isSelected = selectedSiteFilterId === site.id;
              return (
                <button
                  key={site.id}
                  type="button"
                  id={`dashboard-site-pill-${site.id}`}
                  onClick={() => handleSiteClick(site.id)}
                  style={{
                    borderRadius: '20px',
                    fontSize: '0.84rem',
                    minHeight: '44px',
                    padding: '8px 16px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    backgroundColor: isSelected ? 'var(--color-primary)' : 'var(--color-surface)',
                    color: isSelected ? 'var(--color-on-primary)' : 'var(--color-charcoal)',
                    border: isSelected ? '1px solid var(--color-primary)' : '1px solid var(--color-border-strong)',
                    boxShadow: isSelected ? 'var(--shadow-sm)' : 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <span>{site.name}</span>
                  {isSelected && <span style={{ fontSize: '0.78rem' }}>✓</span>}
                </button>
              );
            })}
          </div>
        </div>

        {selectedSiteFilterId && stats.filteredSiteName && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '0.84rem', color: 'var(--color-primary-text)', fontWeight: 700 }}>
              Showing Site Data: <strong>{stats.filteredSiteName}</strong>
            </span>
            <button
              type="button"
              onClick={handleClearSiteFilter}
              style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border-strong)',
                borderRadius: '8px',
                minHeight: '44px',
                padding: '6px 12px',
                fontSize: '0.82rem',
                color: 'var(--color-charcoal)',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Clear Filter
            </button>
          </div>
        )}
      </div>

      {/* 10 SITES HORIZONTAL SELECTOR BAR */}
      <div className="mb-6" id="dashboard-site-horizontal-selector" style={{ marginBottom: '20px' }}>
        <h2
          className="text-sm font-bold text-slate-600 uppercase tracking-wider mb-3"
          style={{
            fontSize: '0.82rem',
            fontWeight: 800,
            color: '#475569',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Building2 size={16} color="var(--color-primary)" />
          Select Site to View Expenses (தளத்தை தேர்வு செய்க):
        </h2>

        <div
          className="flex gap-3 overflow-x-auto pb-3"
          style={{
            display: 'flex',
            gap: '12px',
            overflowX: 'auto',
            paddingBottom: '12px',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {sites.map(site => {
            const isSelected = site.id === activeSiteId;
            // Site individual total badge: strictly calculated for this site
            const siteSum = siteExpenseSums[site.id] || 0;

            return (
              <button
                key={site.id}
                id={`dashboard-site-card-select-${site.id}`}
                type="button"
                onClick={() => handleSiteClick(site.id)}
                className="flex-shrink-0 text-left p-4 rounded-xl border-2 transition-all min-w-[210px]"
                style={{
                  flexShrink: 0,
                  textAlign: 'left',
                  padding: '14px',
                  borderRadius: '12px',
                  borderWidth: '2px',
                  borderStyle: 'solid',
                  borderColor: isSelected ? 'var(--color-primary)' : 'var(--color-border)',
                  backgroundColor: isSelected ? 'var(--color-primary-soft)' : 'var(--color-surface)',
                  boxShadow: isSelected ? '0 4px 12px rgba(249, 115, 22, 0.16)' : 'var(--shadow-sm)',
                  minWidth: '210px',
                  minHeight: '44px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                <div
                  className="flex justify-between items-center mb-1"
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}
                >
                  <span
                    style={{
                      fontSize: '12px',
                      fontWeight: 700,
                      padding: '3px 9px',
                      borderRadius: '9999px',
                      backgroundColor: isSelected ? 'var(--color-primary)' : 'var(--color-bg)',
                      color: isSelected ? 'var(--color-on-primary)' : 'var(--color-text-muted)',
                      border: isSelected ? 'none' : '1px solid var(--color-border)',
                    }}
                  >
                    {isSelected ? '✓ Selected' : 'Click to View'}
                  </span>
                </div>
                <h3
                  className="font-bold text-slate-900 text-sm truncate"
                  style={{
                    fontWeight: 800,
                    color: '#0F172A',
                    fontSize: '0.88rem',
                    margin: '0 0 4px 0',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {site.name}
                </h3>
                <p
                  className="text-xs text-slate-500 mb-2"
                  style={{ fontSize: '0.75rem', color: '#64748B', margin: '0 0 8px 0' }}
                >
                  {site.ownerName || (site as any).client || 'Client'} • {site.area || (site as any).sqft || '—'} sq.ft
                </p>
                <div
                  className="text-xs font-semibold text-slate-700"
                  style={{ fontSize: '0.75rem', fontWeight: 600, color: '#334155' }}
                >
                  Total: <span style={{ color: 'var(--color-charcoal)', fontWeight: 800 }}>₹{siteSum.toLocaleString('en-IN')}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* SELECTED SITE EXPENSE BREAKDOWN */}
      {activeSite && (
        <div
          className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm mb-6"
          id="dashboard-active-site-breakdown"
          style={{
            backgroundColor: 'var(--color-surface)',
            borderRadius: '16px',
            border: '1px solid var(--color-border)',
            padding: '22px',
            boxShadow: 'var(--shadow-sm)',
            marginBottom: '24px',
          }}
        >
          <div
            className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4 mb-4"
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px',
              borderBottom: '1px solid var(--color-border-subtle)',
              paddingBottom: '16px',
              marginBottom: '16px',
            }}
          >
            <div>
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  color: 'var(--color-primary-text)',
                  backgroundColor: 'var(--color-primary-soft)',
                  border: '1px solid var(--color-primary-border)',
                  padding: '3px 8px',
                  borderRadius: '4px',
                  display: 'inline-block',
                }}
              >
                Active Site Expenses
              </span>
              <h1
                className="text-2xl font-black text-slate-900 mt-1"
                style={{ fontSize: '1.45rem', fontWeight: 900, color: '#0F172A', margin: '4px 0 2px 0' }}
              >
                {activeSite.name}
              </h1>
              <p
                className="text-sm text-slate-500"
                style={{ fontSize: '0.82rem', color: '#64748B', margin: 0 }}
              >
                Client: {activeSite.ownerName || (activeSite as any).client || 'Client'} | Area: {activeSite.area || (activeSite as any).sqft || '—'} sq.ft
              </p>
            </div>

            {/* SINGLE SITE EXPENSE TOTAL */}
            <div
              className="bg-slate-900 text-white px-5 py-3 rounded-xl text-right"
              style={{
                backgroundColor: '#0F172A',
                color: '#FFFFFF',
                padding: '12px 22px',
                borderRadius: '12px',
                textAlign: 'right',
                minWidth: '220px',
              }}
            >
              <span
                className="text-xs text-slate-400 block"
                style={{ fontSize: '0.75rem', color: '#94A3B8', display: 'block', marginBottom: '2px' }}
              >
                Intha Site-oda Mattum Selavu:
              </span>
              <span
                className="text-2xl font-black text-amber-400"
                style={{ fontSize: '1.55rem', fontWeight: 900, color: '#FBBF24' }}
              >
                ₹{siteTotalCost.toLocaleString('en-IN')}
              </span>
            </div>
          </div>

          {/* TABLE SHOWING ONLY THIS SITE'S EXPENSES */}
          <div className="overflow-x-auto" style={{ overflowX: 'auto' }}>
            <h4
              className="text-sm font-bold text-slate-800 mb-3"
              style={{ fontSize: '0.88rem', fontWeight: 800, color: '#1E293B', marginBottom: '12px' }}
            >
              Expenses List ({activeSite.name}):
            </h4>

            {filteredSiteExpenses.length === 0 ? (
              <div
                className="text-center py-8 text-slate-400 text-sm"
                style={{ textAlign: 'center', padding: '32px 16px', color: '#94A3B8', fontSize: '0.88rem' }}
              >
                Intha site-la innum expenses ethuvum add pannala.
              </div>
            ) : (
              <table
                className="w-full text-left text-sm border-collapse"
                style={{ width: '100%', textAlign: 'left', fontSize: '0.84rem', borderCollapse: 'collapse' }}
              >
                <thead>
                  <tr
                    className="border-b border-slate-200 text-slate-500 text-xs"
                    style={{ borderBottom: '1px solid #E2E8F0', color: '#64748B', fontSize: '0.75rem', textTransform: 'uppercase' }}
                  >
                    <th className="pb-3 font-semibold" style={{ paddingBottom: '10px', fontWeight: 700 }}>Date</th>
                    <th className="pb-3 font-semibold" style={{ paddingBottom: '10px', fontWeight: 700 }}>Title / Description</th>
                    <th className="pb-3 font-semibold" style={{ paddingBottom: '10px', fontWeight: 700 }}>Category</th>
                    <th className="pb-3 font-semibold text-right" style={{ paddingBottom: '10px', fontWeight: 700, textAlign: 'right' }}>Amount (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredSiteExpenses.map((item: DashboardExpenseItem) => (
                    <tr key={item.id} className="hover:bg-slate-50/80" style={{ borderBottom: '1px solid #F8FAFC' }}>
                      <td className="py-3 text-slate-600" style={{ padding: '10px 0', color: '#475569' }}>{item.date}</td>
                      <td className="py-3 font-medium text-slate-900" style={{ padding: '10px 0', fontWeight: 600, color: '#0F172A' }}>{item.title}</td>
                      <td className="py-3" style={{ padding: '10px 0' }}>
                        <span
                          className="px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700"
                          style={{
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            backgroundColor: '#F1F5F9',
                            color: '#334155',
                          }}
                        >
                          {item.category}
                        </span>
                      </td>
                      <td className="py-3 text-right font-bold text-slate-900" style={{ padding: '10px 0', textAlign: 'right', fontWeight: 800, color: '#0F172A' }}>
                        ₹{Number(item.amount).toLocaleString('en-IN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      <div className="erp-main-grid">
        {/* Left Column: Project Overview (Section 7) */}
        <div className="erp-section-card">
          <div className="erp-section-header">
            <div className="erp-section-title-wrap">
              <Building2 size={20} className="erp-section-icon" />
              <div>
                <h3 className="erp-section-title">Project Portfolio Overview</h3>
                <p className="erp-section-subtitle">Real-time status, timeline milestones, and financial progress</p>
              </div>
            </div>

            <div className="erp-filter-controls">
              {/* Status Filter Tabs */}
              <button
                type="button"
                className={`erp-tab-pill ${statusFilter === 'All' ? 'active' : ''}`}
                onClick={() => setStatusFilter('All')}
              >
                All ({stats.totalSites})
              </button>
              <button
                type="button"
                className={`erp-tab-pill ${statusFilter === 'Active' ? 'active' : ''}`}
                onClick={() => setStatusFilter('Active')}
              >
                Active ({stats.activeSites})
              </button>
              <button
                type="button"
                className={`erp-tab-pill ${statusFilter === 'Planning' ? 'active' : ''}`}
                onClick={() => setStatusFilter('Planning')}
              >
                Planning ({stats.planningSites})
              </button>
              <button
                type="button"
                className={`erp-tab-pill ${statusFilter === 'Completed' ? 'active' : ''}`}
                onClick={() => setStatusFilter('Completed')}
              >
                Completed ({stats.completedSites})
              </button>

              {/* View Mode Switcher */}
              <div style={{ display: 'flex', gap: '4px', background: 'var(--color-bg)', padding: '3px', borderRadius: '10px', border: '1px solid var(--color-border)' }}>
                <button
                  type="button"
                  onClick={() => setViewMode('table')}
                  style={{
                    border: 'none',
                    background: viewMode === 'table' ? 'var(--color-primary)' : 'transparent',
                    color: viewMode === 'table' ? 'var(--color-on-primary)' : 'var(--color-text-muted)',
                    minWidth: '44px',
                    minHeight: '44px',
                    padding: '6px 10px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    boxShadow: viewMode === 'table' ? 'var(--shadow-sm)' : 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  title="Table view"
                  aria-label="Table view"
                >
                  <TableIcon size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('cards')}
                  style={{
                    border: 'none',
                    background: viewMode === 'cards' ? 'var(--color-primary)' : 'transparent',
                    color: viewMode === 'cards' ? 'var(--color-on-primary)' : 'var(--color-text-muted)',
                    minWidth: '44px',
                    minHeight: '44px',
                    padding: '6px 10px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    boxShadow: viewMode === 'cards' ? 'var(--shadow-sm)' : 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  title="Card view"
                  aria-label="Card view"
                >
                  <LayoutGrid size={16} />
                </button>
              </div>
            </div>
          </div>

          {/* Search bar & Contractor selector */}
          <div style={{ padding: '12px 22px', borderBottom: '1px solid var(--erp-border)', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', background: '#F8FAFC' }}>
            <div style={{ flex: '1 1 240px', position: 'relative' }}>
              <Search size={15} style={{ position: 'absolute', left: '10px', top: '10px', color: '#94A3B8' }} />
              <input
                type="text"
                placeholder="Search projects by name, location, owner..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '7px 12px 7px 32px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  background: '#FFFFFF',
                  fontSize: '0.82rem',
                  outline: 'none',
                }}
              />
            </div>

            {isAdmin(user) && usersList.length > 0 && (
              <select
                value={selectedContractor}
                onChange={e => setSelectedContractor(e.target.value)}
                style={{
                  padding: '7px 12px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  background: '#FFFFFF',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  color: '#1E293B',
                }}
              >
                <option value="All">All Contractors</option>
                {usersList.map(u => (
                  <option key={u.id} value={u.id}>
                    👷 {u.fullName || u.username} ({u.role})
                  </option>
                ))}
              </select>
            )}

            <span style={{ fontSize: '0.78rem', color: '#64748B', marginLeft: 'auto' }}>
              Showing {filteredSummaries.length} of {stats.totalSites}
            </span>
          </div>

          {/* Project List / Table */}
          {filteredSummaries.length === 0 ? (
            <div style={{ padding: '48px 20px', textAlign: 'center' }}>
              <Building2 size={36} style={{ color: '#94A3B8', margin: '0 auto 12px' }} />
              <h4 style={{ fontSize: '1rem', fontWeight: 700, color: '#111827', margin: '0 0 6px' }}>
                {searchQuery || statusFilter !== 'All' ? 'No matching projects found' : 'No Construction Projects Added Yet'}
              </h4>
              <p style={{ fontSize: '0.85rem', color: '#64748B', margin: '0 0 16px' }}>
                {searchQuery || statusFilter !== 'All'
                  ? 'Try modifying your search keywords or clear the status filter.'
                  : 'Start tracking materials, labour attendance, floor plans, and expenses by creating your first project.'}
              </p>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                <button type="button" className="erp-action-btn erp-action-primary" onClick={onOpenNewSiteModal}>
                  <PlusCircle size={16} />
                  <span>Create Project</span>
                </button>
                {stats.totalSites === 0 && (
                  <button type="button" className="erp-action-btn erp-action-secondary" onClick={handleLoadDemo} disabled={loadingDemo}>
                    <Database size={16} />
                    <span>{loadingDemo ? 'Loading Sample...' : 'Try Demo Project'}</span>
                  </button>
                )}
              </div>
            </div>
          ) : viewMode === 'table' ? (
            <div className="erp-table-responsive">
              <table className="erp-table">
                <thead>
                  <tr>
                    <th>Project</th>
                    <th>Status</th>
                    <th>Timeline</th>
                    <th>Progress</th>
                    <th>Budget / Expenses</th>
                    <th>Balance Due</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSummaries.map(({ site, totalExpense, totalPaid, balance, budget, progressPercentage }) => {
                    const statusClass = `status-${site.status.toLowerCase().replace(/\s+/g, '')}`;
                    const isSelected = selectedSiteFilterId === site.id;
                    return (
                      <tr
                        key={site.id}
                        id={`dashboard-project-row-${site.id}`}
                        onClick={() => {
                          const next = isSelected ? null : site.id;
                          setSelectedSiteFilterId(next);
                          setActiveSiteId(next || (sites[0]?.id || null));
                          if (onSelectSite) onSelectSite(next);
                        }}
                        style={{
                          cursor: 'pointer',
                          backgroundColor: isSelected ? 'var(--color-primary-soft)' : undefined,
                          borderLeft: isSelected ? '4px solid var(--color-primary)' : undefined,
                        }}
                      >
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div
                              style={{
                                width: '36px',
                                height: '36px',
                                borderRadius: '8px',
                                background: isSelected ? 'var(--color-primary)' : 'var(--color-primary-soft)',
                                color: isSelected ? 'var(--color-on-primary)' : 'var(--color-primary-text)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                                fontWeight: 800,
                                fontSize: '0.9rem',
                              }}
                            >
                              {site.name[0].toUpperCase()}
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <strong style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.88rem', color: 'var(--color-charcoal)' }}>
                                {site.name}
                                {isSelected && (
                                  <span style={{ fontSize: '0.72rem', backgroundColor: 'var(--color-primary)', color: 'var(--color-on-primary)', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }}>
                                    Active Filter
                                  </span>
                                )}
                              </strong>
                              <span style={{ fontSize: '0.74rem', color: '#64748B' }}>
                                {site.area || site.address || site.buildingType} • Owner: {site.ownerName}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className={`status-badge ${statusClass}`}>
                            {site.status}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontSize: '0.78rem', color: '#475569', display: 'block' }}>
                            {site.startDate ? formatDay(site.startDate) : 'Start date unset'}
                          </span>
                          <span style={{ fontSize: '0.72rem', color: '#94A3B8' }}>
                            {formatTargetDate(site.expectedCompletionDate || site.expectedCompletion || site.targetDate)}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#111827', minWidth: '32px' }}>
                              {progressPercentage}%
                            </span>
                            <div className="erp-progress-track">
                              <div className="erp-progress-fill" style={{ width: `${progressPercentage}%` }} />
                            </div>
                          </div>
                        </td>
                        <td>
                          <strong style={{ fontSize: '0.85rem', color: '#111827', display: 'block' }}>
                            ₹{totalExpense.toLocaleString('en-IN')}
                          </strong>
                          <span style={{ fontSize: '0.72rem', color: '#64748B' }}>
                            {budget ? `Budget: ₹${budget.toLocaleString('en-IN')}` : 'Budget unset'}
                          </span>
                        </td>
                        <td>
                          <span
                            style={{
                              fontSize: '0.85rem',
                              fontWeight: 700,
                              color: balance > 0 ? '#DC2626' : '#16A34A',
                            }}
                          >
                            ₹{balance.toLocaleString('en-IN')}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }} onClick={e => e.stopPropagation()}>
                            <button
                              type="button"
                              className="btn btn-sm"
                              title="Edit Project"
                              onClick={() => onEditSite(site)}
                              style={{ width: '32px', height: '32px', padding: 0, borderRadius: '8px', background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#475569' }}
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm"
                              title="Move to Recycle Bin"
                              onClick={() => onDeleteSiteToTrash(site)}
                              style={{ width: '32px', height: '32px', padding: 0, borderRadius: '8px', background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626' }}
                            >
                              <Trash2 size={14} />
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm"
                              title="Open Project Operations"
                              onClick={() => onOpenSite(site.id)}
                              style={{ minHeight: '44px', padding: '0 12px', borderRadius: '8px', background: 'var(--color-primary-soft)', border: '1px solid var(--color-primary-border)', color: 'var(--color-primary-text)', fontWeight: 700, fontSize: '0.82rem' }}
                            >
                              Open
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ padding: '16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px' }}>
              {filteredSummaries.map(({ site, totalExpense, totalPaid, balance, budget, progressPercentage }) => {
                const statusClass = `status-${site.status.toLowerCase().replace(/\s+/g, '')}`;
                const isSelected = selectedSiteFilterId === site.id;
                return (
                  <div
                    key={site.id}
                    id={`dashboard-project-card-${site.id}`}
                    onClick={() => {
                      const next = isSelected ? null : site.id;
                      setSelectedSiteFilterId(next);
                      setActiveSiteId(next || (sites[0]?.id || null));
                      if (onSelectSite) onSelectSite(next);
                    }}
                    style={{
                      background: isSelected ? 'var(--color-primary-soft)' : 'var(--color-surface)',
                      border: isSelected ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                      borderRadius: '12px',
                      padding: '16px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      boxShadow: isSelected ? '0 4px 12px rgba(249, 115, 22, 0.16)' : 'var(--shadow-sm)',
                    }}
                    onMouseEnter={e => e.currentTarget.style.boxShadow = isSelected ? '0 6px 16px rgba(249, 115, 22, 0.22)' : 'var(--shadow-md)'}
                    onMouseLeave={e => e.currentTarget.style.boxShadow = isSelected ? '0 4px 12px rgba(249, 115, 22, 0.16)' : 'var(--shadow-sm)'}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span className={`status-badge ${statusClass}`}>{site.status}</span>
                        {isSelected && (
                          <span style={{ fontSize: '0.72rem', backgroundColor: 'var(--color-primary)', color: 'var(--color-on-primary)', padding: '2px 8px', borderRadius: '4px', fontWeight: 700 }}>
                            Active Filter
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }} onClick={e => e.stopPropagation()}>
                        <button
                          type="button"
                          className="btn btn-sm"
                          title="Open Project Page"
                          onClick={() => onOpenSite(site.id)}
                          style={{ minHeight: '44px', padding: '0 12px', borderRadius: '8px', background: 'var(--color-primary-soft)', border: '1px solid var(--color-primary-border)', color: 'var(--color-primary-text)', fontWeight: 700, fontSize: '0.8rem' }}
                        >
                          Open
                        </button>
                        <button type="button" onClick={() => onEditSite(site)} aria-label="Edit project" style={{ border: 'none', background: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', minWidth: '44px', minHeight: '44px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px' }}>
                          <Edit2 size={15} />
                        </button>
                        <button type="button" onClick={() => onDeleteSiteToTrash(site)} aria-label="Delete project" style={{ border: 'none', background: 'none', color: 'var(--color-danger)', cursor: 'pointer', minWidth: '44px', minHeight: '44px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px' }}>
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>

                    <h4 style={{ fontSize: '0.98rem', fontWeight: 800, color: 'var(--color-charcoal)', margin: '0 0 4px' }}>
                      {site.name}
                    </h4>
                    <p style={{ fontSize: '0.84rem', color: 'var(--color-text-muted)', margin: '0 0 4px' }}>
                      {site.area || site.address || site.buildingType} • {site.ownerName}
                    </p>
                    <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', margin: '0 0 10px' }}>
                      {formatTargetDate(site.expectedCompletionDate || site.expectedCompletion || site.targetDate)}
                    </p>

                    <div style={{ marginBottom: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
                        <span>Progress</span>
                        <strong>{progressPercentage}%</strong>
                      </div>
                      <div style={{ width: '100%', height: '6px', background: 'var(--color-border-subtle)', borderRadius: '999px', overflow: 'hidden' }}>
                        <div style={{ width: `${progressPercentage}%`, height: '100%', background: 'var(--color-primary)' }} />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', background: isSelected ? 'var(--color-surface)' : 'var(--color-bg)', border: '1px solid var(--color-border)', padding: '8px', borderRadius: '8px', textAlign: 'center' }}>
                      <div>
                        <span style={{ fontSize: '0.65rem', color: '#64748B', display: 'block' }}>Spent</span>
                        <strong style={{ fontSize: '0.78rem', color: '#111827' }}>₹{totalExpense.toLocaleString('en-IN')}</strong>
                      </div>
                      <div>
                        <span style={{ fontSize: '0.65rem', color: '#64748B', display: 'block' }}>Paid</span>
                        <strong style={{ fontSize: '0.78rem', color: '#16A34A' }}>₹{totalPaid.toLocaleString('en-IN')}</strong>
                      </div>
                      <div>
                        <span style={{ fontSize: '0.65rem', color: '#64748B', display: 'block' }}>Due</span>
                        <strong style={{ fontSize: '0.78rem', color: balance > 0 ? '#DC2626' : '#64748B' }}>₹{balance.toLocaleString('en-IN')}</strong>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Financial Analytics (Section 8 & 12) */}
        <div className="erp-section-card" id="dashboard-financial-analytics-card">
          <div className="erp-section-header">
            <div className="erp-section-title-wrap">
              <Wallet size={20} className="erp-section-icon" />
              <div>
                <h3 className="erp-section-title">
                  Financial Analytics {selectedSiteFilterId && stats.filteredSiteName ? `• ${stats.filteredSiteName}` : ''}
                </h3>
                <p className="erp-section-subtitle">
                  {selectedSiteFilterId && stats.filteredSiteName
                    ? `Expenditures, settled cash, and budget metrics for ${stats.filteredSiteName}`
                    : 'Real project expenditures, settled cash, and budget metrics'}
                </p>
              </div>
            </div>
          </div>

          {/* 4 Financial Metric Boxes */}
          <div className="erp-financial-summary-grid">
            <div className="erp-fin-box">
              <span className="erp-fin-label">Total Spent</span>
              <span className="erp-fin-amount">₹{stats.overallExpense.toLocaleString('en-IN')}</span>
              <span style={{ fontSize: '0.72rem', color: '#64748B', marginTop: '4px' }}>
                {selectedSiteFilterId && stats.filteredSiteName ? `Site: ${stats.filteredSiteName}` : `Across ${stats.totalSites} projects`}
              </span>
            </div>

            <div className="erp-fin-box">
              <span className="erp-fin-label">Total Settled</span>
              <span className="erp-fin-amount" style={{ color: '#16A34A' }}>₹{stats.overallPaid.toLocaleString('en-IN')}</span>
              <span style={{ fontSize: '0.72rem', color: '#16A34A', marginTop: '4px' }}>Paid to mistries & suppliers</span>
            </div>

            <div className="erp-fin-box">
              <span className="erp-fin-label">Outstanding Due</span>
              <span className="erp-fin-amount" style={{ color: stats.overallBalance > 0 ? '#DC2626' : '#16A34A' }}>
                ₹{stats.overallBalance.toLocaleString('en-IN')}
              </span>
              <span style={{ fontSize: '0.72rem', color: '#64748B', marginTop: '4px' }}>Payable balances</span>
            </div>

            <div className="erp-fin-box">
              <span className="erp-fin-label">Estimated Budget</span>
              <span className="erp-fin-amount" style={{ color: stats.totalBudget > 0 ? 'var(--color-charcoal)' : 'var(--color-text-muted)' }}>
                {stats.totalBudget > 0 ? `₹${stats.totalBudget.toLocaleString('en-IN')}` : 'Unset'}
              </span>
              <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                {stats.remainingBudget !== undefined ? `Rem: ₹${stats.remainingBudget.toLocaleString('en-IN')}` : 'From Building Calculator'}
              </span>
            </div>
          </div>

          {/* Monthly Expense Trend Chart (SVG) */}
          <div className="erp-chart-box">
            <div className="erp-chart-header">
              <span className="erp-chart-title">Monthly Expenditure Trends (Past 6 Months)</span>
              <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>Indian Rupees (₹)</span>
            </div>

            <div style={{ height: '140px', position: 'relative', display: 'flex', alignItems: 'flex-end', gap: '10px', paddingTop: '20px' }}>
              {stats.monthlyTrends.map((m, idx) => {
                const heightPct = maxMonthlyExpense > 0 ? Math.max(8, Math.round((m.expense / maxMonthlyExpense) * 100)) : 8;
                return (
                  <div key={m.monthKey} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
                      {m.expense > 0 ? `₹${(m.expense / 1000).toFixed(0)}k` : '₹0'}
                    </span>
                    <div
                      style={{
                        width: '100%',
                        maxWidth: '38px',
                        height: `${heightPct}%`,
                        background: idx === stats.monthlyTrends.length - 1 ? 'linear-gradient(180deg, var(--color-primary) 0%, var(--color-primary-hover) 100%)' : 'var(--color-border)',
                        borderRadius: '6px 6px 2px 2px',
                        transition: 'height 0.3s ease',
                      }}
                      title={`${m.label}: ₹${m.expense.toLocaleString('en-IN')} (Paid: ₹${m.paid.toLocaleString('en-IN')})`}
                    />
                    <span style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)', marginTop: '6px', whiteSpace: 'nowrap' }}>
                      {m.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Category Expense Breakdown */}
          <div className="erp-chart-box">
            <div className="erp-chart-header">
              <span className="erp-chart-title">Expenditure by Category</span>
              <span style={{ fontSize: '0.72rem', color: '#64748B' }}>Percentage of total</span>
            </div>

            <div className="erp-categories-list">
              {stats.categoryExpenses.map(cat => (
                <div key={cat.key} className="erp-cat-row">
                  <div className="erp-cat-labels">
                    <span style={{ color: '#334155' }}>{cat.label}</span>
                    <span style={{ color: '#111827' }}>
                      ₹{cat.amount.toLocaleString('en-IN')} ({cat.percentage}%)
                    </span>
                  </div>
                  <div className="erp-cat-bar-bg">
                    <div
                      className="erp-cat-bar-fill"
                      style={{ width: `${cat.percentage}%`, background: cat.color }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 9 & 10. Attendance Overview & Material Inventory Dual Grid */}
      <div className="erp-dual-grid">
        {/* Section 9: Attendance Overview */}
        <div className="erp-section-card" id="dashboard-workforce-attendance-card">
          <div className="erp-section-header">
            <div className="erp-section-title-wrap">
              <Users size={20} className="erp-section-icon" />
              <div>
                <h3 className="erp-section-title">
                  Workforce & Daily Attendance {selectedSiteFilterId && stats.filteredSiteName ? `• ${stats.filteredSiteName}` : ''}
                </h3>
                <p className="erp-section-subtitle">
                  {selectedSiteFilterId && stats.filteredSiteName
                    ? `Real-time attendance tracking for ${stats.filteredSiteName} (${stats.attendanceToday.totalWorkers} workers)`
                    : `Real-time attendance tracking for ${formattedDate}`}
                </p>
              </div>
            </div>

            <button
              type="button"
              className="erp-action-btn erp-action-secondary"
              onClick={() => onNavigate ? onNavigate('labour') : undefined}
              style={{ fontSize: '0.78rem', padding: '6px 12px' }}
            >
              <span>Manage Attendance</span>
              <ChevronRight size={14} />
            </button>
          </div>

          <div className="erp-attendance-stats-grid">
            <div className="erp-att-box">
              <div className="erp-att-num" style={{ color: '#111827' }}>{stats.attendanceToday.totalWorkers}</div>
              <div className="erp-att-label">Total Workers</div>
            </div>
            <div className="erp-att-box">
              <div className="erp-att-num" style={{ color: '#16A34A' }}>{stats.attendanceToday.present}</div>
              <div className="erp-att-label">Present Today</div>
            </div>
            <div className="erp-att-box">
              <div className="erp-att-num" style={{ color: '#F59E0B' }}>{stats.attendanceToday.halfDay}</div>
              <div className="erp-att-label">Half Day</div>
            </div>
            <div className="erp-att-box">
              <div className="erp-att-num" style={{ color: '#DC2626' }}>{stats.attendanceToday.absent}</div>
              <div className="erp-att-label">Absent</div>
            </div>
          </div>

          <div style={{ padding: '0 22px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#475569', marginBottom: '6px' }}>
              <span>Today's Attendance Rate</span>
              <strong>{stats.attendanceToday.attendanceRate}%</strong>
            </div>
            <div style={{ width: '100%', height: '8px', background: '#F1F5F9', borderRadius: '999px', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${stats.attendanceToday.attendanceRate}%`,
                  height: '100%',
                  background: stats.attendanceToday.attendanceRate >= 70 ? '#16A34A' : stats.attendanceToday.attendanceRate >= 40 ? '#F59E0B' : '#DC2626',
                  borderRadius: '999px',
                }}
              />
            </div>
            {stats.attendanceToday.unmarked > 0 && stats.attendanceToday.totalWorkers > 0 && (
              <p style={{ fontSize: '0.75rem', color: '#B45309', margin: '8px 0 0', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <AlertTriangle size={13} />
                <span>{stats.attendanceToday.unmarked} workers have not been marked yet today.</span>
              </p>
            )}
          </div>
        </div>

        {/* Section 10: Material Management Overview */}
        <div className="erp-section-card" id="dashboard-materials-inventory-card">
          <div className="erp-section-header">
            <div className="erp-section-title-wrap">
              <Layers size={20} className="erp-section-icon" />
              <div>
                <h3 className="erp-section-title">
                  Materials & Inventory Alerts {selectedSiteFilterId && stats.filteredSiteName ? `• ${stats.filteredSiteName}` : ''}
                </h3>
                <p className="erp-section-subtitle">
                  {selectedSiteFilterId && stats.filteredSiteName
                    ? `Real-time stock balances and threshold notifications for ${stats.filteredSiteName}`
                    : 'Real-time stock balances and threshold notifications'}
                </p>
              </div>
            </div>

            <button
              type="button"
              className="erp-action-btn erp-action-secondary"
              onClick={() => onNavigate ? onNavigate('stock') : undefined}
              style={{ fontSize: '0.78rem', padding: '6px 12px' }}
            >
              <span>Stock Ledger</span>
              <ChevronRight size={14} />
            </button>
          </div>

          <div style={{ padding: '14px 22px', borderBottom: '1px solid var(--erp-border)', display: 'flex', gap: '16px', background: '#F8FAFC', flexWrap: 'wrap' }}>
            <div>
              <span style={{ fontSize: '0.72rem', color: '#64748B', display: 'block', textTransform: 'uppercase', fontWeight: 700 }}>Total Stock Value</span>
              <strong style={{ fontSize: '1.2rem', color: '#16A34A' }}>₹{stats.materialStock.totalStockValue.toLocaleString('en-IN')}</strong>
            </div>
            <div style={{ width: '1px', height: '36px', background: 'var(--erp-border)' }} />
            <div>
              <span style={{ fontSize: '0.72rem', color: '#64748B', display: 'block', textTransform: 'uppercase', fontWeight: 700 }}>Total Materials</span>
              <strong style={{ fontSize: '1.2rem', color: '#111827' }}>{stats.materialStock.totalMaterialsCount} items</strong>
            </div>
            <div style={{ width: '1px', height: '36px', background: 'var(--erp-border)' }} />
            <div>
              <span style={{ fontSize: '0.72rem', color: '#64748B', display: 'block', textTransform: 'uppercase', fontWeight: 700 }}>In-Stock Types</span>
              <strong style={{ fontSize: '1.2rem', color: '#16A34A' }}>{stats.materialStock.inStockCount} active</strong>
            </div>
            <div style={{ width: '1px', height: '36px', background: 'var(--erp-border)' }} />
            <div>
              <span style={{ fontSize: '0.72rem', color: '#64748B', display: 'block', textTransform: 'uppercase', fontWeight: 700 }}>Low Stock Alerts</span>
              <strong style={{ fontSize: '1.2rem', color: stats.materialStock.lowStockCount > 0 ? '#DC2626' : '#16A34A' }}>
                {stats.materialStock.lowStockCount} alerts
              </strong>
            </div>
          </div>

          {/* Low Stock Items List */}
          <div style={{ padding: '12px 22px 20px', flex: 1 }}>
            <h4 style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 10px' }}>
              Stock Alerts & Threshold Monitor
            </h4>

            {stats.materialStock.lowStockItems.length === 0 ? (
              <div style={{ padding: '24px 16px', textAlign: 'center', background: '#F8FAFC', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                <CheckCircle2 size={24} style={{ color: '#16A34A', margin: '0 auto 6px' }} />
                <strong style={{ fontSize: '0.85rem', color: '#111827', display: 'block' }}>All Material Levels Optimal</strong>
                <span style={{ fontSize: '0.75rem', color: '#64748B' }}>No materials are currently running below their configured minimum threshold.</span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {stats.dashboard.lowStockTop.map(item => (
                  <div
                    key={item.key}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      background: item.isNegative ? '#FEF2F2' : '#FFFBEB',
                      border: `1px solid ${item.isNegative ? '#FECACA' : '#FDE68A'}`,
                      borderRadius: '8px',
                    }}
                  >
                    <div>
                      <strong style={{ fontSize: '0.84rem', color: item.isNegative ? '#991B1B' : '#92400E', display: 'block' }}>
                        {item.name}
                      </strong>
                      <span style={{ fontSize: '0.72rem', color: item.isNegative ? '#B91C1C' : '#B45309' }}>
                        Category: {item.category.toUpperCase()} • Threshold: {item.lowStockThreshold || 0} {item.unit}
                      </span>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <span
                        style={{
                          fontSize: '0.88rem',
                          fontWeight: 800,
                          color: item.isNegative ? '#DC2626' : '#D97706',
                        }}
                      >
                        {item.onHand} {item.unit}
                      </span>
                      <span style={{ fontSize: '0.68rem', display: 'block', color: item.isNegative ? '#DC2626' : '#D97706', fontWeight: 700 }}>
                        {item.isNegative ? 'Negative Balance' : 'Low Stock'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  );
};
