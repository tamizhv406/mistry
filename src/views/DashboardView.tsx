import React, { useState } from 'react';
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
} from 'lucide-react';
import { useOverallStats } from '../hooks/useOverallStats';
import { loadDemoData } from '../db/seedData';
import { db } from '../db/db';
import { isAdmin, isSuperAdmin } from '../services/auth';
import type { Site, SiteStatus, User } from '../db/types';
import { motion } from 'motion/react';
import { SITE_VISUAL } from '../utils/constructionVisuals';
import { calculateFinancialBalance } from '../utils/financial';
import { SafeImage } from '../components/ui/SafeImage';

interface DashboardViewProps {
  onOpenSite: (siteId: string) => void;
  onOpenNewSiteModal: () => void;
  onEditSite: (site: Site) => void;
  onDeleteSiteToTrash: (site: Site) => void;
  onNotify: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onlySites?: boolean;
  user?: User | null;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onOpenSite,
  onOpenNewSiteModal,
  onEditSite,
  onDeleteSiteToTrash,
  onNotify,
  onlySites = false,
  user,
}) => {
  const stats = useOverallStats(user);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [selectedContractor, setSelectedContractor] = useState<string>('All');
  const [usersList, setUsersList] = useState<User[]>([]);
  const [loadingDemo, setLoadingDemo] = useState(false);

  React.useEffect(() => {
    if (isAdmin(user)) {
      db.users.toArray().then(setUsersList);
    }
  }, [user]);

  const userMap = new Map<string, string>();
  usersList.forEach(u => userMap.set(u.id, `${u.fullName || u.username}`));

  if (!stats) {
    return (
      <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
        Loading Building Mistry Dashboard...
      </div>
    );
  }

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

  // Filter site cards
  const filteredSummaries = stats.siteSummaries.filter(item => {
    const s = item.site;
    const matchesQuery =
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.ownerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.area.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.address.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'All' || s.status === statusFilter;
    const matchesContractor =
      selectedContractor === 'All' || s.userId === selectedContractor;

    return matchesQuery && matchesStatus && matchesContractor;
  });

  return (
    <div className="main-wrapper">
      {/* Real Admin Master Banner */}
      {isAdmin(user) && (
        <div
          style={{
            background: 'linear-gradient(135deg, #fffbeb 0%, #f8fafc 100%)',
            border: '1px solid #fcd34d',
            borderRadius: '18px',
            padding: '16px 20px',
            marginBottom: '20px',
            boxShadow: '0 1px 3px rgba(15, 23, 42, 0.06)',
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
                backgroundColor: '#fef3c7',
                border: '1px solid #fcd34d',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#b45309',
              }}
            >
              <Crown size={24} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <strong style={{ color: '#92400e', fontSize: '1rem', fontWeight: 800 }}>
                  Real Admin Master Access Active
                </strong>
                <span
                  style={{
                    backgroundColor: '#fef3c7',
                    color: '#92400e',
                    fontSize: '0.7rem',
                    padding: '2px 8px',
                    borderRadius: '10px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                  }}
                >
                  Full Cross-Contractor Oversight
                </span>
              </div>
              <p style={{ color: '#475569', fontSize: '0.82rem', margin: '2px 0 0 0' }}>
                You have unrestricted administrative authority across all registered mistries, sites, materials, labour ledgers, and audit trails.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                color: '#1d4ed8',
                fontSize: '0.8rem',
                backgroundColor: '#dbeafe',
                padding: '4px 12px',
                borderRadius: '20px',
                fontWeight: 600,
              }}
            >
              Total Sites Monitored: <strong>{stats.totalSites}</strong>
            </span>
          </div>
        </div>
      )}

      {/* Top Welcome & Quick Actions */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div>
          <h2 style={{ fontSize: '1.8rem', color: 'var(--text-main)' }}>
            {onlySites ? '🏢 My Construction Sites' : 'Construction Dashboard'}
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem' }}>
            {onlySites
              ? 'Browse, search, and manage all your building projects and site accounts'
              : 'Live status of your active construction sites, workers, materials and cash balances'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          {stats.totalSites === 0 && (
            <button
              className="btn btn-outline"
              onClick={handleLoadDemo}
              disabled={loadingDemo}
              style={{ borderColor: 'var(--accent-amber)', color: 'var(--primary)' }}
            >
              <Database size={16} />
              {loadingDemo ? 'Loading Sample...' : 'Load Sample Site (DEMO)'}
            </button>
          )}

          <button className="btn btn-primary" onClick={onOpenNewSiteModal}>
            <PlusCircle size={18} />
            <span>Add New Site</span>
          </button>
        </div>
      </div>

      {/* Top 6 KPI Metric Cards & Category Pills (Shown on general dashboard) */}
      {!onlySites && (
        <>
          <div className="metrics-grid">
            <div className="metric-card card-primary">
              <div className="metric-info">
                <h3>My Sites</h3>
                <div className="metric-value">{stats.totalSites}</div>
                <div className="metric-sub">
                  {stats.activeSites} Active • {stats.completedSites} Completed
                </div>
              </div>
              <div className="metric-icon" style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary)' }}>
                <Building2 size={24} />
              </div>
            </div>

            <div className="metric-card card-info">
              <div className="metric-info">
                <h3>Overall Expenses</h3>
                <div className="metric-value">₹{stats.overallExpense.toLocaleString('en-IN')}</div>
                <div className="metric-sub">Across all construction sites</div>
              </div>
              <div className="metric-icon" style={{ backgroundColor: 'var(--info-bg)', color: 'var(--info)' }}>
                <TrendingUp size={24} />
              </div>
            </div>

            <div className="metric-card card-success">
              <div className="metric-info">
                <h3>Total Paid Amount</h3>
                <div className="metric-value" style={{ color: 'var(--success)' }}>
                  ₹{stats.overallPaid.toLocaleString('en-IN')}
                </div>
                <div className="metric-sub">Settled materials & wages</div>
              </div>
              <div className="metric-icon" style={{ backgroundColor: 'var(--success-bg)', color: 'var(--success)' }}>
                <HardHat size={24} />
              </div>
            </div>

            <div className="metric-card card-danger">
              <div className="metric-info">
                <h3>Pending Balance</h3>
                <div className="metric-value" style={{ color: stats.overallBalance > 0 ? 'var(--danger)' : 'var(--success)' }}>
                  ₹{stats.overallBalance.toLocaleString('en-IN')}
                </div>
                <div className="metric-sub">Payable to suppliers & mistries</div>
              </div>
              <div className="metric-icon" style={{ backgroundColor: 'var(--danger-bg)', color: 'var(--danger)' }}>
                <TrendingUp size={24} style={{ transform: 'rotate(180deg)' }} />
              </div>
            </div>
          </div>

          {/* Category Expense Pills */}
          <div className="expense-pills">
            <div className="expense-pill">
              <div className="pill-dot" style={{ backgroundColor: '#f59e0b' }} />
              <span className="pill-title">Materials:</span>
              <span className="pill-amount">₹{stats.totalMaterialExpense.toLocaleString('en-IN')}</span>
            </div>

            <div className="expense-pill">
              <div className="pill-dot" style={{ backgroundColor: '#10b981' }} />
              <span className="pill-title">Labour Wages:</span>
              <span className="pill-amount">₹{stats.totalLabourExpense.toLocaleString('en-IN')}</span>
            </div>

            <div className="expense-pill">
              <div className="pill-dot" style={{ backgroundColor: '#3b82f6' }} />
              <span className="pill-title">Tools & Rent:</span>
              <span className="pill-amount">₹{stats.totalToolsExpense.toLocaleString('en-IN')}</span>
            </div>

            <div className="expense-pill">
              <div className="pill-dot" style={{ backgroundColor: '#eab308' }} />
              <span className="pill-title">Tea & Snacks:</span>
              <span className="pill-amount">₹{stats.totalTeaSnacksExpense.toLocaleString('en-IN')}</span>
            </div>

            <div className="expense-pill">
              <div className="pill-dot" style={{ backgroundColor: '#8b5cf6' }} />
              <span className="pill-title">Pooja:</span>
              <span className="pill-amount">₹{stats.totalPoojaExpense.toLocaleString('en-IN')}</span>
            </div>

            <div className="expense-pill">
              <div className="pill-dot" style={{ backgroundColor: '#334155' }} />
              <span className="pill-title">Electricity:</span>
              <span className="pill-amount">₹{stats.totalElectricityExpense.toLocaleString('en-IN')}</span>
            </div>

            <div className="expense-pill">
              <div className="pill-dot" style={{ backgroundColor: '#06b6d4' }} />
              <span className="pill-title">Water:</span>
              <span className="pill-amount">₹{stats.totalWaterExpense.toLocaleString('en-IN')}</span>
            </div>

            <div className="expense-pill">
              <div className="pill-dot" style={{ backgroundColor: '#6366f1' }} />
              <span className="pill-title">Other:</span>
              <span className="pill-amount">₹{stats.totalOtherExpense.toLocaleString('en-IN')}</span>
            </div>
          </div>
        </>
      )}

      {/* Search and Filter */}
      <div className="search-filter-bar">
        <div className="search-input-wrapper">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            placeholder="Search site name, owner, area, address..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>

        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          style={{ width: 'auto', minWidth: '160px' }}
        >
          <option value="All">All Statuses ({stats.totalSites})</option>
          <option value="Active">Active ({stats.activeSites})</option>
          <option value="Planning">Planning ({stats.planningSites})</option>
          <option value="On Hold">On Hold ({stats.onHoldSites})</option>
          <option value="Completed">Completed ({stats.completedSites})</option>
        </select>

        {isAdmin(user) && usersList.length > 0 && (
          <select
            value={selectedContractor}
            onChange={e => setSelectedContractor(e.target.value)}
            style={{
              width: 'auto',
              minWidth: '200px',
              backgroundColor: '#1e1b4b',
              color: '#e0e7ff',
              border: '1px solid #6366f1',
              fontWeight: 600,
            }}
          >
            <option value="All">All Contractors & Mistries</option>
            {usersList.map(u => (
              <option key={u.id} value={u.id}>
                👷 {u.fullName} ({u.role})
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Sites Grid or Empty State */}
      {filteredSummaries.length === 0 ? (
        <div className="table-container">
          <div className="empty-state">
            <div className="empty-icon-box">
              <Building2 size={36} />
            </div>
            <h3 className="empty-title">
              {searchQuery || statusFilter !== 'All'
                ? 'No matching construction sites found'
                : 'No Construction Sites Added Yet'}
            </h3>
            <p className="empty-desc">
              {searchQuery || statusFilter !== 'All'
                ? 'Try adjusting your search keywords or status filter.'
                : 'Start tracking materials, labour attendance, salaries and expenses by adding your first site.'}
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn btn-primary" onClick={onOpenNewSiteModal}>
                <PlusCircle size={18} />
                <span>Add Construction Site</span>
              </button>
              {stats.totalSites === 0 && (
                <button
                  className="btn btn-outline"
                  onClick={handleLoadDemo}
                  disabled={loadingDemo}
                >
                  <Database size={16} />
                  <span>Load Sample Site (DEMO)</span>
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="sites-grid">
          {filteredSummaries.map(({ site, totalExpense, totalPaid }) => {
            const fin = calculateFinancialBalance(totalExpense, totalPaid);
            const statusClass =
              site.status === 'Active'
                ? 'badge-active'
                : site.status === 'Planning'
                ? 'badge-planning'
                : site.status === 'On Hold'
                ? 'badge-onhold'
                : 'badge-completed';

            return (
              <motion.div
                key={site.id}
                className="site-card group cursor-pointer"
                onClick={() => onOpenSite(site.id)}
                whileHover={{ y: -4, transition: { duration: 0.2 } }}
                style={{ overflow: 'hidden', padding: 0 }}
              >
                {/* Header: the site photo when it has one, then status, actions and the name */}
                {site.imageUrl && (
                  <div style={{ width: '100%', height: '120px', overflow: 'hidden', backgroundColor: '#f1f5f9' }}>
                    <SafeImage
                      src={site.imageUrl}
                      alt={site.name}
                      fallbackCategory="site"
                      fallbackSrc={SITE_VISUAL}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  </div>
                )}
                <div style={{ padding: '14px 16px 0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      <span className={`badge ${statusClass}`}>
                        {site.status}
                      </span>
                      {site.isDemo && (
                        <span className="badge badge-demo">DEMO</span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }} onClick={e => e.stopPropagation()}>
                      <button
                        className="btn btn-sm"
                        title="Edit Site Details"
                        aria-label="Edit site details"
                        onClick={() => onEditSite(site)}
                        style={{
                          width: '38px',
                          height: '38px',
                          padding: 0,
                          borderRadius: '10px',
                          backgroundColor: '#ffffff',
                          color: '#334155',
                          border: '1px solid var(--border-light)',
                        }}
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        className="btn btn-sm"
                        title="Move to Recycle Bin"
                        aria-label="Move site to recycle bin"
                        onClick={() => onDeleteSiteToTrash(site)}
                        style={{
                          width: '38px',
                          height: '38px',
                          padding: 0,
                          borderRadius: '10px',
                          backgroundColor: '#fef2f2',
                          color: '#b91c1c',
                          border: '1px solid #fecaca',
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  <h3 className="site-card-title" style={{ margin: '10px 0 0' }}>
                    {site.name}
                  </h3>
                </div>

                {/* Body */}
                <div className="site-card-body" style={{ padding: '16px' }}>
                  {isAdmin(user) && site.userId && (
                    <div style={{ marginBottom: '8px' }}>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          backgroundColor: '#eef2ff',
                          color: '#4338ca',
                          fontWeight: 700,
                          border: '1px solid #c7d2fe',
                        }}
                      >
                        👷 {userMap.get(site.userId) || site.userId}
                      </span>
                    </div>
                  )}

                  <div className="site-meta-item">
                    <Users size={16} color="var(--primary)" />
                    <span>
                      Owner: <strong>{site.ownerName}</strong>
                      {site.ownerPhone ? ` • ${site.ownerPhone}` : ''}
                    </span>
                  </div>

                  <div className="site-meta-item">
                    <MapPin size={16} color="var(--primary)" />
                    <span>{site.area || site.address || 'Address not specified'}</span>
                  </div>

                  <div className="site-meta-item">
                    <Building2 size={16} color="var(--text-muted)" />
                    <span>{site.buildingType}</span>
                  </div>

                  {/* 4-Box Financial Ribbon (Total, Paid, Balance Due, Extra Paid) */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: fin.extraPaid > 0 ? 'repeat(4, 1fr)' : 'repeat(3, 1fr)',
                    gap: '6px',
                    marginTop: '12px',
                    padding: '10px',
                    backgroundColor: 'var(--bg-subtle)',
                    borderRadius: '10px',
                    border: '1px solid var(--border-light)',
                  }}>
                    <div style={{ textAlign: 'center' }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>Total</span>
                      <strong style={{ fontSize: '0.85rem', color: 'var(--text-main)' }}>
                        ₹{fin.totalAmount.toLocaleString('en-IN')}
                      </strong>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>Paid</span>
                      <strong style={{ fontSize: '0.85rem', color: 'var(--success)' }}>
                        ₹{fin.paidAmount.toLocaleString('en-IN')}
                      </strong>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>Due</span>
                      <strong style={{ fontSize: '0.85rem', color: fin.balanceDue > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>
                        ₹{fin.balanceDue.toLocaleString('en-IN')}
                      </strong>
                    </div>
                    {fin.extraPaid > 0 && (
                      <div style={{ textAlign: 'center' }}>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>Extra</span>
                        <strong style={{ fontSize: '0.85rem', color: 'var(--primary)' }}>
                          ₹{fin.extraPaid.toLocaleString('en-IN')}
                        </strong>
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer with animated arrow */}
                <div
                  className="site-card-footer"
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '10px 16px',
                    backgroundColor: 'var(--bg-subtle)',
                    borderTop: '1px solid var(--border-light)',
                  }}
                >
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Manage Site
                  </span>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    color: 'var(--primary)',
                    fontWeight: 600,
                    fontSize: '0.82rem',
                  }}>
                    <span>Open</span>
                    <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Recent Activities Section */}
      {stats.recentActivities.length > 0 && (
        <div style={{ marginTop: '36px' }}>
          <div className="table-container">
            <div className="table-header-bar">
              <h3 className="table-header-title">
                <TrendingUp size={20} color="var(--primary)" />
                Recent Construction Activity & Transactions
              </h3>
            </div>
            <div className="data-table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Activity Title</th>
                    <th>Details</th>
                    <th>Site Name</th>
                    <th>Date</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recentActivities.map(act => (
                    <tr
                      key={act.id}
                      onClick={() => onOpenSite(act.siteId)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td>
                        <span className="badge badge-planning" style={{ fontSize: '0.72rem' }}>
                          {act.type.toUpperCase()}
                        </span>
                      </td>
                      <td><strong>{act.title}</strong></td>
                      <td style={{ color: 'var(--text-muted)' }}>{act.description}</td>
                      <td>
                        <span style={{ color: 'var(--primary)', fontWeight: 600 }}>
                          {act.siteName}
                        </span>
                      </td>
                      <td style={{ color: 'var(--text-muted)' }}>{act.date}</td>
                      <td>
                        {act.amount !== undefined ? (
                          <strong style={{ fontFamily: 'var(--font-heading)' }}>
                            ₹{act.amount.toLocaleString('en-IN')}
                          </strong>
                        ) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
