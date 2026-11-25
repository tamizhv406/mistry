import React, { useState, useMemo } from 'react';
import {
  Building2,
  PlusCircle,
  Search,
  Filter,
  Calendar,
  MapPin,
  Users,
  TrendingUp,
  Clock,
  ArrowRight,
  Edit2,
  Trash2,
  Copy,
  Archive,
  Eye,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Database,
  Table as TableIcon,
  LayoutGrid,
  Phone,
  Sparkles,
  ArrowUpDown,
  Tag,
  ShieldCheck,
  Check,
} from 'lucide-react';
import { useOverallStats, type SiteCardSummary } from '../hooks/useOverallStats';
import { db, getNextSiteId } from '../db/db';
import { isAdmin } from '../services/auth';
import type { Site, User, SiteStatus } from '../db/types';
import { formatDay, todayKey, monthKeyOf, DEFAULT_TIME_ZONE } from '../utils/datetime';
import { SafeImage } from '../components/ui/SafeImage';
import { SITE_VISUAL } from '../utils/constructionVisuals';
import { loadDemoData } from '../db/seedData';

interface ProjectsViewProps {
  user: User | null;
  onOpenSite: (siteId: string) => void;
  onOpenNewSiteModal: () => void;
  onEditSite: (site: Site) => void;
  onDeleteSiteToTrash: (site: Site) => void;
  onNotify: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onNavigate?: (view: string, siteId?: string, tab?: string, subTab?: string) => void;
}

type SortOption = 'newest' | 'oldest' | 'name-asc' | 'name-desc' | 'budget-desc' | 'progress-desc' | 'target-date';
type DateFilterOption = 'all' | 'starting-this-month' | 'ending-this-month' | 'overdue';

export const ProjectsView: React.FC<ProjectsViewProps> = ({
  user,
  onOpenSite,
  onOpenNewSiteModal,
  onEditSite,
  onDeleteSiteToTrash,
  onNotify,
  onNavigate,
}) => {
  const stats = useOverallStats(user);

  // Search and Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [dateFilter, setDateFilter] = useState<DateFilterOption>('all');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [isDuplicating, setIsDuplicating] = useState<string | null>(null);
  const [loadingDemo, setLoadingDemo] = useState(false);

  // Duplication Handler
  const handleDuplicateProject = async (siteSummary: SiteCardSummary, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!user) {
      onNotify('You must be signed in to duplicate a project.', 'error');
      return;
    }

    const { site } = siteSummary;
    setIsDuplicating(site.id);

    try {
      const newId = await getNextSiteId();
      const now = new Date().toISOString();

      const duplicatedSite: Site = {
        ...site,
        id: newId,
        name: `${site.name} (Copy)`,
        userId: user.id,
        createdAt: now,
        updatedAt: now,
        isDeleted: false,
        deletedAt: undefined,
        isDemo: false,
      };

      await db.sites.add(duplicatedSite);
      onNotify(`Project "${site.name}" safely duplicated as "${duplicatedSite.name}"!`, 'success');
    } catch (err: any) {
      onNotify(`Failed to duplicate project: ${err.message}`, 'error');
    } finally {
      setIsDuplicating(null);
    }
  };

  // Safe Archive Handler (toggles status to 'On Hold' or prompts trash)
  const handleArchiveProject = async (site: Site, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!user) return;

    if (site.status === 'On Hold') {
      // Toggle back to Active
      try {
        await db.sites.update(site.id, {
          status: 'Active',
          updatedAt: new Date().toISOString(),
        });
        onNotify(`Project "${site.name}" un-archived and reactivated!`, 'success');
      } catch (err: any) {
        onNotify(`Failed to activate project: ${err.message}`, 'error');
      }
    } else {
      // Archive to On Hold
      try {
        await db.sites.update(site.id, {
          status: 'On Hold',
          updatedAt: new Date().toISOString(),
        });
        onNotify(`Project "${site.name}" archived (Status changed to On Hold).`, 'info');
      } catch (err: any) {
        onNotify(`Failed to archive project: ${err.message}`, 'error');
      }
    }
  };

  // Demo Project Loader
  const handleLoadDemo = async () => {
    setLoadingDemo(true);
    try {
      await loadDemoData();
      onNotify('Sample site "Sri Murugan Illam" loaded successfully! (Marked as DEMO)', 'success');
    } catch (err: any) {
      onNotify('Failed to load demo data: ' + err.message, 'error');
    } finally {
      setLoadingDemo(false);
    }
  };

  const today = todayKey(DEFAULT_TIME_ZONE);
  const currentMonthKey = monthKeyOf(today);

  // Filter and Sort Pipeline
  const filteredAndSortedProjects = useMemo(() => {
    if (!stats) return [];

    let list = [...stats.siteSummaries];

    // 1. Text Search Filter (name, owner, phone, location, id)
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(({ site }) => {
        const text = `${site.name} ${site.ownerName} ${site.ownerPhone || ''} ${site.area || ''} ${site.address || ''} ${site.id} ${site.buildingType}`.toLowerCase();
        return text.includes(q);
      });
    }

    // 2. Status Filter
    if (statusFilter !== 'All') {
      list = list.filter(({ site }) => site.status === statusFilter);
    }

    // 3. Date Filter
    if (dateFilter !== 'all') {
      list = list.filter(({ site }) => {
        if (dateFilter === 'starting-this-month') {
          return site.startDate && monthKeyOf(site.startDate) === currentMonthKey;
        }
        if (dateFilter === 'ending-this-month') {
          return site.expectedCompletionDate && monthKeyOf(site.expectedCompletionDate) === currentMonthKey;
        }
        if (dateFilter === 'overdue') {
          return site.status !== 'Completed' && site.expectedCompletionDate && site.expectedCompletionDate < today;
        }
        return true;
      });
    }

    // 4. Sorting
    list.sort((a, b) => {
      if (sortBy === 'newest') {
        return new Date(b.site.createdAt).getTime() - new Date(a.site.createdAt).getTime();
      }
      if (sortBy === 'oldest') {
        return new Date(a.site.createdAt).getTime() - new Date(b.site.createdAt).getTime();
      }
      if (sortBy === 'name-asc') {
        return a.site.name.localeCompare(b.site.name);
      }
      if (sortBy === 'name-desc') {
        return b.site.name.localeCompare(a.site.name);
      }
      if (sortBy === 'budget-desc') {
        return (b.budget || 0) - (a.budget || 0);
      }
      if (sortBy === 'progress-desc') {
        return b.progressPercentage - a.progressPercentage;
      }
      if (sortBy === 'target-date') {
        return (a.site.expectedCompletionDate || '9999').localeCompare(b.site.expectedCompletionDate || '9999');
      }
      return 0;
    });

    return list;
  }, [stats, searchQuery, statusFilter, dateFilter, sortBy, currentMonthKey, today]);

  if (!stats) {
    return (
      <div className="erp-dashboard-container">
        <div style={{ padding: '80px 20px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
          <div className="spinner" style={{ margin: '0 auto 16px', width: '32px', height: '32px', border: '3px solid var(--color-border)', borderTopColor: 'var(--color-primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-charcoal)' }}>Loading Construction Projects...</h3>
          <p style={{ fontSize: '0.88rem' }}>Fetching live site records and budget analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="erp-dashboard-container">
      {/* 1. Projects Dashboard Header & Stats Cards */}
      <div className="erp-welcome-card" style={{ padding: '20px 24px' }}>
        <div className="erp-welcome-left">
          <div className="erp-welcome-badge">
            <Building2 size={13} />
            <span>Project Management SaaS</span>
          </div>
          <h2 className="erp-welcome-title" style={{ fontSize: '1.5rem' }}>
            Construction Projects Portfolio
          </h2>
          <p className="erp-welcome-desc">
            Monitor, plan, and track active construction sites, budgets, milestones, and client accounts in one place.
          </p>
        </div>

        <button
          type="button"
          className="erp-action-btn erp-action-primary"
          onClick={onOpenNewSiteModal}
          title="Create a new construction project"
        >
          <PlusCircle size={16} />
          <span>New Project</span>
        </button>
      </div>

      {/* 4 Real Data KPI Cards for Projects Dashboard */}
      <div className="erp-kpi-grid">
        {/* Total Projects */}
        <div className="erp-kpi-card">
          <div className="erp-kpi-header">
            <span className="erp-kpi-title">Total Projects</span>
            <div className="erp-kpi-icon-box" style={{ background: 'var(--color-primary-soft)', color: 'var(--color-primary-text)' }}>
              <Building2 size={18} />
            </div>
          </div>
          <div className="erp-kpi-value">{stats.totalSites}</div>
          <div className="erp-kpi-footer">
            <span style={{ color: 'var(--color-text-muted)' }}>All registered site ledgers</span>
          </div>
        </div>

        {/* Active Projects */}
        <div className="erp-kpi-card">
          <div className="erp-kpi-header">
            <span className="erp-kpi-title">Active Projects</span>
            <div className="erp-kpi-icon-box" style={{ background: 'var(--color-success-soft)', color: 'var(--color-success)' }}>
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div className="erp-kpi-value" style={{ color: 'var(--color-success)' }}>{stats.activeSites}</div>
          <div className="erp-kpi-footer">
            <span style={{ color: 'var(--color-success-text)', fontWeight: 600 }}>
              {stats.totalSites > 0 ? Math.round((stats.activeSites / stats.totalSites) * 100) : 0}% active operations
            </span>
          </div>
        </div>

        {/* Completed Projects */}
        <div className="erp-kpi-card">
          <div className="erp-kpi-header">
            <span className="erp-kpi-title">Completed</span>
            <div className="erp-kpi-icon-box" style={{ background: 'var(--color-charcoal-soft)', color: 'var(--color-charcoal)' }}>
              <Building2 size={18} />
            </div>
          </div>
          <div className="erp-kpi-value" style={{ color: 'var(--color-charcoal)' }}>{stats.completedSites}</div>
          <div className="erp-kpi-footer">
            <span style={{ color: 'var(--color-text-secondary)', fontWeight: 600 }}>Successfully delivered</span>
          </div>
        </div>

        {/* On Hold Projects */}
        <div className="erp-kpi-card">
          <div className="erp-kpi-header">
            <span className="erp-kpi-title">On Hold / Planning</span>
            <div className="erp-kpi-icon-box" style={{ background: 'var(--color-warning-soft)', color: 'var(--color-warning-text)' }}>
              <Clock size={18} />
            </div>
          </div>
          <div className="erp-kpi-value" style={{ color: 'var(--color-warning-text)' }}>
            {stats.onHoldSites + stats.planningSites}
          </div>
          <div className="erp-kpi-footer">
            <span>{stats.onHoldSites} on hold • {stats.planningSites} in planning</span>
          </div>
        </div>
      </div>

      {/* 2. Controls Bar: Search, Status Filters, Date Filters, Sort, View Toggle */}
      <div className="erp-section-card" style={{ padding: '16px 20px', gap: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          {/* Search Box */}
          <div style={{ flex: '1 1 300px', position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '11px', color: '#94A3B8' }} />
            <input
              type="text"
              placeholder="Search by project name, client, location, or ID..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px 9px 36px',
                borderRadius: '10px',
                border: '1px solid #CBD5E1',
                background: '#F8FAFC',
                fontSize: '0.86rem',
                outline: 'none',
                color: '#111827',
              }}
            />
          </div>

          {/* Quick Status Filter Pills */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
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
              className={`erp-tab-pill ${statusFilter === 'On Hold' ? 'active' : ''}`}
              onClick={() => setStatusFilter('On Hold')}
            >
              On Hold ({stats.onHoldSites})
            </button>
            <button
              type="button"
              className={`erp-tab-pill ${statusFilter === 'Completed' ? 'active' : ''}`}
              onClick={() => setStatusFilter('Completed')}
            >
              Completed ({stats.completedSites})
            </button>
          </div>

          {/* Date Filter & Sort By Dropdowns & View Mode */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {/* Date Filter */}
            <select
              value={dateFilter}
              onChange={e => setDateFilter(e.target.value as DateFilterOption)}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                background: '#FFFFFF',
                fontSize: '0.82rem',
                color: '#334155',
                fontWeight: 600,
              }}
              title="Filter by milestone dates"
            >
              <option value="all">📅 All Dates</option>
              <option value="starting-this-month">🚀 Starting This Month</option>
              <option value="ending-this-month">🎯 Target This Month</option>
              <option value="overdue">⚠️ Overdue Target</option>
            </select>

            {/* Sort Dropdown */}
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as SortOption)}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                background: '#FFFFFF',
                fontSize: '0.82rem',
                color: '#334155',
                fontWeight: 600,
              }}
              title="Sort projects"
            >
              <option value="newest">Sort: Newest First</option>
              <option value="oldest">Sort: Oldest First</option>
              <option value="name-asc">Sort: Name (A-Z)</option>
              <option value="name-desc">Sort: Name (Z-A)</option>
              <option value="budget-desc">Sort: Highest Budget</option>
              <option value="progress-desc">Sort: Highest Progress</option>
              <option value="target-date">Sort: Nearest Target Date</option>
            </select>

            {/* View Mode Toggle */}
            <div style={{ display: 'flex', gap: '2px', background: '#F1F5F9', padding: '2px', borderRadius: '8px' }}>
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                style={{
                  border: 'none',
                  background: viewMode === 'grid' ? 'var(--color-primary)' : 'transparent',
                  color: viewMode === 'grid' ? 'var(--color-on-primary)' : 'var(--color-text-muted)',
                  minWidth: '44px',
                  minHeight: '44px',
                  padding: '6px 10px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  boxShadow: viewMode === 'grid' ? 'var(--shadow-sm)' : 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                title="3-Column Cards Grid"
                aria-label="3-Column Cards Grid"
              >
                <LayoutGrid size={16} />
              </button>
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
                title="Data Table View"
                aria-label="Data Table View"
              >
                <TableIcon size={16} />
              </button>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.84rem', color: 'var(--color-text-muted)', paddingTop: '4px' }}>
          <span>
            Showing <strong>{filteredAndSortedProjects.length}</strong> of <strong>{stats.totalSites}</strong> projects
          </span>
          {(searchQuery || statusFilter !== 'All' || dateFilter !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('All');
                setDateFilter('all');
              }}
              style={{ background: 'none', border: 'none', color: 'var(--color-primary-text)', cursor: 'pointer', fontWeight: 700, minHeight: '44px', padding: '0 8px' }}
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* 3. Empty State */}
      {filteredAndSortedProjects.length === 0 ? (
        <div className="erp-section-card" style={{ padding: '60px 20px', textAlign: 'center' }}>
          <Building2 size={44} style={{ color: '#94A3B8', margin: '0 auto 14px' }} />
          <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#111827', margin: '0 0 8px' }}>
            {searchQuery || statusFilter !== 'All' || dateFilter !== 'all'
              ? 'No matching construction projects found'
              : 'No Construction Projects Added Yet'}
          </h3>
          <p style={{ fontSize: '0.88rem', color: '#64748B', maxWidth: '480px', margin: '0 auto 20px' }}>
            {searchQuery || statusFilter !== 'All' || dateFilter !== 'all'
              ? 'Try adjusting your search query, clearing date constraints, or resetting status filters.'
              : 'Begin organizing your construction operations, labour attendance, materials, and architectural floor plans by creating your first project.'}
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
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
      ) : viewMode === 'grid' ? (
        /* 4. Modern Responsive Project Cards: Desktop 3-col, Tablet 2-col, Mobile 1-col */
        <div className="projects-responsive-grid">
          {filteredAndSortedProjects.map(summary => {
            const { site, totalExpense, totalPaid, balance, budget, progressPercentage, workerCount, materialCount } = summary;
            const statusClass = `status-${site.status.toLowerCase().replace(/\s+/g, '')}`;
            const displayId = site.id.toUpperCase();

            return (
              <div
                key={site.id}
                className="project-saas-card"
                onClick={() => onOpenSite(site.id)}
                style={{
                  background: '#FFFFFF',
                  border: '1px solid #E2E8F0',
                  borderRadius: '16px',
                  boxShadow: '0 1px 3px rgba(15, 23, 42, 0.06)',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  position: 'relative',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-3px)';
                  e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                  e.currentTarget.style.borderColor = 'var(--color-primary-border)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                  e.currentTarget.style.borderColor = 'var(--color-border)';
                }}
              >
                {/* Project Image Banner */}
                <div style={{ width: '100%', height: '140px', position: 'relative', backgroundColor: 'var(--color-bg)', overflow: 'hidden' }}>
                  <SafeImage
                    src={site.imageUrl}
                    alt={site.name}
                    fallbackCategory="site"
                    fallbackSrc={SITE_VISUAL}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                  {/* Status Overlay Badge */}
                  <div style={{ position: 'absolute', top: '12px', left: '12px', display: 'flex', gap: '6px' }}>
                    <span className={`status-badge ${statusClass}`} style={{ boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                      {site.status}
                    </span>
                    {site.isDemo && (
                      <span className="badge badge-demo" style={{ boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                        DEMO
                      </span>
                    )}
                  </div>

                  {/* Project ID Tag */}
                  <div
                    style={{
                      position: 'absolute',
                      top: '12px',
                      right: '12px',
                      background: 'rgba(31, 41, 55, 0.85)',
                      backdropFilter: 'blur(4px)',
                      color: '#FFFFFF',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '6px',
                      letterSpacing: '0.04em',
                    }}
                  >
                    #{displayId}
                  </div>
                </div>

                {/* Card Body */}
                <div style={{ padding: '18px 20px', flex: 1, display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {/* Name and Client */}
                  <div>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--color-charcoal)', margin: '0 0 4px', lineHeight: 1.3 }}>
                      {site.name}
                    </h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.84rem', color: 'var(--color-text-muted)' }}>
                      <Users size={14} style={{ color: 'var(--color-text-muted)' }} />
                      <span>Client: <strong style={{ color: 'var(--color-charcoal)' }}>{site.ownerName}</strong></span>
                      {site.ownerPhone && <span>• {site.ownerPhone}</span>}
                    </div>
                  </div>

                  {/* Location & Type */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.84rem', color: 'var(--color-text-muted)' }}>
                    <MapPin size={14} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
                    <span className="truncate">{site.area || site.address || 'Location not specified'}</span>
                    <span style={{ color: 'var(--color-border-strong)' }}>•</span>
                    <span style={{ whiteSpace: 'nowrap' }}>{site.buildingType}</span>
                  </div>

                  {/* Dates Row */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', background: 'var(--color-bg)', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--color-border)' }}>
                    <div>
                      <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--color-text-muted)', fontWeight: 700, display: 'block' }}>Start Date</span>
                      <strong style={{ fontSize: '0.84rem', color: 'var(--color-charcoal)' }}>
                        {site.startDate ? formatDay(site.startDate) : 'Unset'}
                      </strong>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--color-text-muted)', fontWeight: 700, display: 'block' }}>Target Completion</span>
                      <strong style={{ fontSize: '0.84rem', color: site.expectedCompletionDate && site.expectedCompletionDate < today && site.status !== 'Completed' ? 'var(--color-danger)' : 'var(--color-charcoal)' }}>
                        {site.expectedCompletionDate ? formatDay(site.expectedCompletionDate) : 'Unset'}
                      </strong>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', fontSize: '0.8rem' }}>
                      <span style={{ color: 'var(--color-text-secondary)', fontWeight: 600 }}>Project Milestone Progress</span>
                      <strong style={{ color: 'var(--color-primary-text)', fontWeight: 800 }}>{progressPercentage}%</strong>
                    </div>
                    <div style={{ width: '100%', height: '7px', background: 'var(--color-border-subtle)', borderRadius: '999px', overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${progressPercentage}%`,
                          height: '100%',
                          background: site.status === 'Completed' ? 'var(--color-success)' : 'var(--color-primary)',
                          borderRadius: '999px',
                          transition: 'width 0.3s ease',
                        }}
                      />
                    </div>
                  </div>

                  {/* Financial Ribbon (Budget, Expenses, Balance Due) */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '6px', background: 'var(--color-bg)', padding: '10px', borderRadius: '10px', border: '1px solid var(--color-border)', textAlign: 'center' }}>
                    <div style={{ minWidth: 0, overflow: 'hidden' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', display: 'block', fontWeight: 600 }}>Budget</span>
                      <strong style={{ fontSize: '0.88rem', color: 'var(--color-charcoal)', fontFamily: 'var(--font-heading)', display: 'block', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {budget ? `₹${budget.toLocaleString('en-IN')}` : 'Unset'}
                      </strong>
                    </div>
                    <div style={{ minWidth: 0, overflow: 'hidden' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', display: 'block', fontWeight: 600 }}>Spent</span>
                      <strong style={{ fontSize: '0.88rem', color: 'var(--color-charcoal)', fontFamily: 'var(--font-heading)', display: 'block', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        ₹{totalExpense.toLocaleString('en-IN')}
                      </strong>
                    </div>
                    <div style={{ minWidth: 0, overflow: 'hidden' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', display: 'block', fontWeight: 600 }}>Balance Due</span>
                      <strong style={{ fontSize: '0.88rem', color: balance > 0 ? 'var(--color-danger)' : 'var(--color-success)', fontFamily: 'var(--font-heading)', display: 'block', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        ₹{balance.toLocaleString('en-IN')}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* 4 Standard Actions Footer: View, Edit, Duplicate, Archive */}
                <div
                  style={{
                    padding: '12px 18px',
                    background: '#F8FAFC',
                    borderTop: '1px solid #F1F5F9',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px',
                  }}
                  onClick={e => e.stopPropagation()}
                >
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {/* Edit Action */}
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() => onEditSite(site)}
                      title="Edit project details"
                      style={{
                        padding: '6px 10px',
                        borderRadius: '8px',
                        background: '#FFFFFF',
                        border: '1px solid #CBD5E1',
                        color: '#334155',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                      }}
                    >
                      <Edit2 size={13} />
                      <span>Edit</span>
                    </button>

                    {/* Duplicate Action */}
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={e => handleDuplicateProject(summary, e)}
                      disabled={isDuplicating === site.id}
                      title="Duplicate project safely"
                      style={{
                        padding: '6px 10px',
                        borderRadius: '8px',
                        background: '#FFFFFF',
                        border: '1px solid #CBD5E1',
                        color: '#334155',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                      }}
                    >
                      <Copy size={13} />
                      <span>{isDuplicating === site.id ? 'Copying…' : 'Duplicate'}</span>
                    </button>

                    {/* Archive Action */}
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={e => handleArchiveProject(site, e)}
                      title={site.status === 'On Hold' ? 'Un-archive project (Set Active)' : 'Archive project (Set On Hold)'}
                      style={{
                        padding: '6px 10px',
                        borderRadius: '8px',
                        background: site.status === 'On Hold' ? '#FEF3C7' : '#FFFFFF',
                        border: '1px solid #CBD5E1',
                        color: site.status === 'On Hold' ? '#B45309' : '#475569',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                      }}
                    >
                      <Archive size={13} />
                      <span>{site.status === 'On Hold' ? 'Unarchive' : 'Archive'}</span>
                    </button>
                  </div>

                  {/* Primary View / Open Action */}
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => onOpenSite(site.id)}
                    title="Open project operations"
                    style={{
                      minHeight: '44px',
                      padding: '8px 14px',
                      borderRadius: '8px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      fontSize: '0.84rem',
                      fontWeight: 700,
                    }}
                  >
                    <span>View</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Data Table View */
        <div className="erp-section-card">
          <div className="erp-table-responsive">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Project Name & Client</th>
                  <th>Location</th>
                  <th>Status</th>
                  <th>Start Date</th>
                  <th>Target Date</th>
                  <th>Progress</th>
                  <th>Budget</th>
                  <th>Expenses</th>
                  <th>Balance Due</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAndSortedProjects.map(summary => {
                  const { site, totalExpense, totalPaid, balance, budget, progressPercentage } = summary;
                  const statusClass = `status-${site.status.toLowerCase().replace(/\s+/g, '')}`;
                  const displayId = site.id.toUpperCase();

                  return (
                    <tr key={site.id} onClick={() => onOpenSite(site.id)} style={{ cursor: 'pointer' }}>
                      <td style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', fontWeight: 700 }}>
                        #{displayId}
                      </td>
                      <td>
                        <strong style={{ fontSize: '0.9rem', color: 'var(--color-charcoal)', display: 'block' }}>{site.name}</strong>
                        <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Client: {site.ownerName}</span>
                      </td>
                      <td style={{ fontSize: '0.84rem', color: 'var(--color-text-secondary)' }}>
                        {site.area || site.address || site.buildingType}
                      </td>
                      <td>
                        <span className={`status-badge ${statusClass}`}>
                          {site.status}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>
                        {site.startDate ? formatDay(site.startDate) : '—'}
                      </td>
                      <td style={{ fontSize: '0.82rem', color: site.expectedCompletionDate && site.expectedCompletionDate < today && site.status !== 'Completed' ? 'var(--color-danger)' : 'var(--color-text-muted)' }}>
                        {site.expectedCompletionDate ? formatDay(site.expectedCompletionDate) : '—'}
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-charcoal)', minWidth: '32px' }}>
                            {progressPercentage}%
                          </span>
                          <div className="erp-progress-track" style={{ width: '60px' }}>
                            <div className="erp-progress-fill" style={{ width: `${progressPercentage}%` }} />
                          </div>
                        </div>
                      </td>
                      <td style={{ fontSize: '0.86rem', fontWeight: 600, color: 'var(--color-charcoal)' }}>
                        {budget ? `₹${budget.toLocaleString('en-IN')}` : '—'}
                      </td>
                      <td style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--color-charcoal)' }}>
                        ₹{totalExpense.toLocaleString('en-IN')}
                      </td>
                      <td>
                        <span style={{ fontSize: '0.86rem', fontWeight: 700, color: balance > 0 ? 'var(--color-danger)' : 'var(--color-success)' }}>
                          ₹{balance.toLocaleString('en-IN')}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline"
                            title="Edit project"
                            aria-label="Edit project"
                            onClick={() => onEditSite(site)}
                            style={{ minWidth: '44px', minHeight: '44px', padding: '0 8px' }}
                          >
                            <Edit2 size={15} />
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline"
                            title="Duplicate project"
                            aria-label="Duplicate project"
                            onClick={e => handleDuplicateProject(summary, e)}
                            style={{ minWidth: '44px', minHeight: '44px', padding: '0 8px' }}
                          >
                            <Copy size={15} />
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline"
                            title="Archive / Un-archive project"
                            aria-label="Archive project"
                            onClick={e => handleArchiveProject(site, e)}
                            style={{ minWidth: '44px', minHeight: '44px', padding: '0 8px' }}
                          >
                            <Archive size={15} />
                          </button>
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            title="Open project"
                            onClick={() => onOpenSite(site.id)}
                            style={{ minHeight: '44px', padding: '0 14px', fontSize: '0.84rem' }}
                          >
                            View
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
