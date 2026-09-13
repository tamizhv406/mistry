import React, { useState } from 'react';
import {
  ArrowLeft,
  Building2,
  Users,
  Phone,
  MapPin,
  Calendar,
  Layers,
  Wrench,
  Coffee,
  Sparkles,
  Zap,
  Droplets,
  MessageSquare,
  FileText,
  PlusCircle,
  Edit2,
  Trash2,
  TrendingUp,
  IndianRupee,
  Coins,
  Wallet,
  Receipt,
  ChevronRight,
  Scale,
  Calculator,
} from 'lucide-react';
import { useSiteData } from '../hooks/useSiteData';
import { MaterialsTab } from './site-tabs/MaterialsTab';
import { LabourTab } from './site-tabs/LabourTab';
import { ToolsTab } from './site-tabs/ToolsTab';
import { DailyExpensesTab } from './site-tabs/DailyExpensesTab';
import { PaymentsLedgerTab } from './site-tabs/PaymentsLedgerTab';
import { CommentsTab } from './site-tabs/CommentsTab';
import { ReportsTab } from './site-tabs/ReportsTab';
import { EstimateVarianceTab } from './site-tabs/EstimateVarianceTab';

import type {
  Site,
  Material,
  RodEntry,
  LabourWorker,
  AttendanceRecord,
  LabourAdvance,
  SalaryPayment,
  ToolItem,
  TeaSnacksExpense,
  PoojaExpense,
  ElectricityBill,
  WaterBill,
  OtherExpense,
  SiteComment,
  MaterialCategory,
} from '../db/types';

interface SiteDetailViewProps {
  siteId: string;
  onBack: () => void;
  onEditSite: (site: Site) => void;
  onDeleteSite: (site: Site) => void;

  // Modals openers
  onOpenMaterialModal: (category: MaterialCategory, material?: Material) => void;
  onOpenRodModal: (rod?: RodEntry) => void;
  onOpenWorkerModal: (worker?: LabourWorker) => void;
  onOpenAttendanceModal: () => void;
  onOpenAdvanceModal: (advance?: LabourAdvance) => void;
  onOpenSalaryModal: (payment?: SalaryPayment) => void;
  onOpenToolModal: (tool?: ToolItem) => void;
  onOpenTeaModal: (expense?: TeaSnacksExpense) => void;
  onOpenPoojaModal: (pooja?: PoojaExpense) => void;
  onOpenElectricityModal: (bill?: ElectricityBill) => void;
  onOpenWaterModal: (bill?: WaterBill) => void;
  onOpenOtherModal: (expense?: OtherExpense) => void;
  onOpenCommentModal: (comment?: SiteComment) => void;

  // Trash actions
  onTrashRecord: (table: any, id: string, name: string) => void;

  // Navigation
  onOpenEstimator?: () => void;
  onNotify?: (msg: string, type?: 'success' | 'error' | 'info') => void;
  initialTab?: 'overview' | 'materials' | 'labour' | 'tools' | 'expenses' | 'payments' | 'comments' | 'reports' | 'variance';
  initialExpenseSubSection?: 'tea' | 'pooja' | 'electricity' | 'water' | 'other';
  onTabChange?: (tab: string, sub?: string) => void;
}

export const SiteDetailView: React.FC<SiteDetailViewProps> = ({
  siteId,
  onBack,
  onEditSite,
  onDeleteSite,
  onOpenMaterialModal,
  onOpenRodModal,
  onOpenWorkerModal,
  onOpenAttendanceModal,
  onOpenAdvanceModal,
  onOpenSalaryModal,
  onOpenToolModal,
  onOpenTeaModal,
  onOpenPoojaModal,
  onOpenElectricityModal,
  onOpenWaterModal,
  onOpenOtherModal,
  onOpenCommentModal,
  onTrashRecord,
  onOpenEstimator,
  onNotify,
  initialTab,
  initialExpenseSubSection,
  onTabChange,
}) => {
  const data = useSiteData(siteId);
  const [activeTab, setActiveTab] = useState<
    'overview' | 'materials' | 'labour' | 'tools' | 'expenses' | 'payments' | 'comments' | 'reports' | 'variance'
  >(initialTab || 'overview');
  const [labourSubTab, setLabourSubTab] = useState<'salary' | 'roster' | 'attendance' | 'advances'>('salary');
  const [expenseSubSection, setExpenseSubSection] = useState<'tea' | 'pooja' | 'electricity' | 'water' | 'other'>(
    initialExpenseSubSection || 'tea'
  );

  React.useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
    if (initialExpenseSubSection) {
      setExpenseSubSection(initialExpenseSubSection);
    }
  }, [initialTab, initialExpenseSubSection]);

  if (!data || !data.site) {
    return (
      <div className="main-wrapper" style={{ textAlign: 'center', padding: '60px' }}>
        <p style={{ color: 'var(--text-muted)' }}>Loading Site Details...</p>
        <button className="btn btn-outline" style={{ marginTop: '16px' }} onClick={onBack}>
          <ArrowLeft size={16} />
          Back to Dashboard
        </button>
      </div>
    );
  }

  const {
    site,
    materials,
    rodEntries,
    workers,
    attendance,
    advances,
    salaryPayments,
    tools,
    teaSnacks,
    poojas,
    electricity,
    water,
    otherExpenses,
    comments,
    summary,
    payments,
  } = data;

  const statusClass =
    site.status === 'Active'
      ? 'badge-active'
      : site.status === 'Planning'
      ? 'badge-planning'
      : site.status === 'On Hold'
      ? 'badge-onhold'
      : 'badge-completed';

  const navigateToSection = (
    tab: 'overview' | 'materials' | 'labour' | 'tools' | 'expenses' | 'payments' | 'comments' | 'reports',
    sub?: string
  ) => {
    if (tab === 'labour' && sub) {
      setLabourSubTab(sub as any);
    }
    if (tab === 'expenses' && sub) {
      setExpenseSubSection(sub as any);
    }
    setActiveTab(tab);
    onTabChange?.(tab, sub);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="main-wrapper">
      {/* Back Button and Quick Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
        <button className="btn btn-outline btn-sm" onClick={onBack}>
          <ArrowLeft size={16} />
          <span>All Sites Dashboard</span>
        </button>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-sm btn-outline" onClick={() => onEditSite(site)}>
            <Edit2 size={15} />
            <span>Edit Site Info</span>
          </button>
          <button className="btn btn-sm btn-danger" onClick={() => onDeleteSite(site)}>
            <Trash2 size={15} />
            <span>Move Site to Trash</span>
          </button>
        </div>
      </div>

      {/* Hero Site Banner */}
      <div className="site-header-banner">
        <div className="banner-top">
          <div className="banner-title-area">
            <h2>
              {site.name}
              <span className={`badge ${statusClass}`} style={{ fontSize: '0.82rem' }}>
                {site.status}
              </span>
              {site.isDemo && (
                <span className="badge badge-demo" style={{ fontSize: '0.82rem' }}>
                  DEMO SITE
                </span>
              )}
            </h2>

            <div className="banner-details-row">
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Users size={16} color="#f59e0b" />
                Owner: <strong>{site.ownerName}</strong>
              </span>

              {site.ownerPhone && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Phone size={16} color="#f59e0b" />
                  <a href={`tel:${site.ownerPhone}`} style={{ color: '#cbd5e1', textDecoration: 'none' }}>
                    {site.ownerPhone}
                  </a>
                </span>
              )}

              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <MapPin size={16} color="#f59e0b" />
                {site.area || site.address || 'Location not set'}
              </span>

              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Building2 size={16} color="#94a3b8" />
                {site.buildingType}
              </span>
            </div>
          </div>
        </div>

        {/* Financial KPI summary ribbon */}
        <div className="banner-financial-bar">
          <div className="banner-fin-stat">
            <span>Total Site Expense</span>
            <strong>₹{summary.totalCost.toLocaleString('en-IN')}</strong>
          </div>
          <div className="banner-fin-stat">
            <span>Total Paid Out</span>
            <strong className="text-success">₹{summary.totalPaid.toLocaleString('en-IN')}</strong>
          </div>
          <div className="banner-fin-stat">
            <span>Pending Balance</span>
            <strong className="text-danger">₹{summary.totalBalance.toLocaleString('en-IN')}</strong>
          </div>
          {(summary.totalExtraPaid || 0) > 0 && (
            <div className="banner-fin-stat">
              <span>Extra Paid (Advance)</span>
              <strong style={{ color: '#38bdf8' }}>₹{(summary.totalExtraPaid || 0).toLocaleString('en-IN')}</strong>
            </div>
          )}
          <div className="banner-fin-stat">
            <span>Workers Enrolled</span>
            <strong className="text-amber">{workers.length} Personnel</strong>
          </div>
        </div>
      </div>

      {/* Breadcrumb Bar when inside a specific section */}
      {activeTab !== 'overview' && (
        <div className="section-breadcrumb-bar">
          <button className="btn btn-outline btn-sm" onClick={() => setActiveTab('overview')}>
            <ArrowLeft size={16} />
            <span>← Back to Site Dashboard</span>
          </button>
          <div className="section-breadcrumb-title">
            {activeTab === 'materials' && '🧱 Materials & Steel Rods'}
            {activeTab === 'labour' && `👷 Labour & Wages (${labourSubTab.toUpperCase()})`}
            {activeTab === 'tools' && '🔨 Tools, Machinery & Rentals'}
            {activeTab === 'expenses' && `☕ Daily Expenses & Bills (${expenseSubSection.toUpperCase()})`}
            {activeTab === 'payments' && '💳 Universal Payment Ledger & Audit Trail'}
            {activeTab === 'comments' && '📝 Site Notes & Supervisor Diary'}
            {activeTab === 'reports' && '📊 Cost Reports & PDF Statements'}
            {activeTab === 'variance' && '📐 Estimate vs Actual Variance Analysis'}
          </div>
        </div>
      )}

      {/* Main Tab Navigation Bar */}
      <div className="tab-navigation">
        <button
          className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          <TrendingUp size={17} />
          <span>Overview</span>
        </button>

        <button
          className={`tab-btn ${activeTab === 'materials' ? 'active' : ''}`}
          onClick={() => setActiveTab('materials')}
        >
          <Layers size={17} />
          <span>Materials ({materials.length + rodEntries.length})</span>
        </button>

        <button
          className={`tab-btn ${activeTab === 'labour' ? 'active' : ''}`}
          onClick={() => { setActiveTab('labour'); setLabourSubTab('salary'); }}
        >
          <Users size={17} />
          <span>Labour & Wages ({workers.length})</span>
        </button>

        <button
          className={`tab-btn ${activeTab === 'tools' ? 'active' : ''}`}
          onClick={() => setActiveTab('tools')}
        >
          <Wrench size={17} />
          <span>Tools & Rents ({tools.length})</span>
        </button>

        <button
          className={`tab-btn ${activeTab === 'expenses' ? 'active' : ''}`}
          onClick={() => setActiveTab('expenses')}
        >
          <Coffee size={17} />
          <span>Daily Expenses & Bills</span>
        </button>

        <button
          className={`tab-btn ${activeTab === 'payments' ? 'active' : ''}`}
          onClick={() => setActiveTab('payments')}
        >
          <Receipt size={17} />
          <span>Payment Ledger ({payments?.length || 0})</span>
        </button>

        <button
          className={`tab-btn ${activeTab === 'comments' ? 'active' : ''}`}
          onClick={() => setActiveTab('comments')}
        >
          <MessageSquare size={17} />
          <span>Site Notes ({comments.length})</span>
        </button>

        <button
          className={`tab-btn ${activeTab === 'reports' ? 'active' : ''}`}
          onClick={() => setActiveTab('reports')}
        >
          <FileText size={17} />
          <span>Cost Reports</span>
        </button>

        <button
          className={`tab-btn ${activeTab === 'variance' ? 'active' : ''}`}
          onClick={() => setActiveTab('variance')}
        >
          <Scale size={17} />
          <span>Estimator & Variance</span>
        </button>
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div>
          {/* Quick Add Action Shortcuts */}
          <div style={{
            backgroundColor: '#ffffff',
            border: '1px solid var(--border-light)',
            borderRadius: '12px',
            padding: '16px 20px',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            boxShadow: 'var(--shadow-sm)',
          }}>
            <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              ⚡ Quick Entry Shortcuts for Mistry:
            </span>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button className="btn btn-sm btn-outline" onClick={() => onOpenMaterialModal('sand')}>
                + Sand
              </button>
              <button className="btn btn-sm btn-outline" onClick={() => onOpenMaterialModal('cement')}>
                + Cement
              </button>
              <button className="btn btn-sm btn-outline" onClick={() => onOpenRodModal()}>
                + Steel Rod
              </button>
              <button className="btn btn-sm btn-outline" onClick={() => onOpenAttendanceModal()}>
                + Attendance
              </button>
              <button className="btn btn-sm btn-outline" onClick={() => onOpenAdvanceModal()}>
                + Advance
              </button>
              <button className="btn btn-sm btn-outline" onClick={() => onOpenTeaModal()}>
                + Tea & Snacks
              </button>
              <button className="btn btn-sm btn-outline" onClick={() => onOpenOtherModal()}>
                + Other Expense
              </button>
            </div>
          </div>

          {/* Section 10: Site Dashboard Visual Card/Icon Grid (13 Items) */}
          <div style={{ marginBottom: '28px' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '14px',
            }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>📋</span> Site Modules & Records
              </h3>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                Tap any module to view details or add entries
              </span>
            </div>

            <div className="site-dashboard-grid">
              {/* 1. Materials */}
              <div
                className="site-grid-card"
                onClick={() => navigateToSection('materials')}
                role="button"
                tabIndex={0}
              >
                <div className="site-grid-card-icon" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#d97706' }}>
                  <Layers size={24} />
                </div>
                <div className="site-grid-card-content">
                  <div className="site-grid-card-title">Materials</div>
                  <div className="site-grid-card-badge">{materials.length + rodEntries.length} Invoices</div>
                  <div className="site-grid-card-amount">₹{summary.materialCost.toLocaleString('en-IN')}</div>
                </div>
                <ChevronRight size={18} className="site-grid-card-arrow" />
              </div>

              {/* 2. Labour */}
              <div
                className="site-grid-card"
                onClick={() => navigateToSection('labour', 'roster')}
                role="button"
                tabIndex={0}
              >
                <div className="site-grid-card-icon" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#059669' }}>
                  <Users size={24} />
                </div>
                <div className="site-grid-card-content">
                  <div className="site-grid-card-title">Labour Workers</div>
                  <div className="site-grid-card-badge">{workers.length} Personnel</div>
                  <div className="site-grid-card-amount">₹{summary.labourGrossSalary.toLocaleString('en-IN')}</div>
                </div>
                <ChevronRight size={18} className="site-grid-card-arrow" />
              </div>

              {/* 3. Attendance */}
              <div
                className="site-grid-card"
                onClick={() => navigateToSection('labour', 'attendance')}
                role="button"
                tabIndex={0}
              >
                <div className="site-grid-card-icon" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#2563eb' }}>
                  <Calendar size={24} />
                </div>
                <div className="site-grid-card-content">
                  <div className="site-grid-card-title">Attendance</div>
                  <div className="site-grid-card-badge">{attendance.length} Shifts Logged</div>
                  <div className="site-grid-card-sub">Daily Shift Register</div>
                </div>
                <ChevronRight size={18} className="site-grid-card-arrow" />
              </div>

              {/* 4. Salary & Wages */}
              <div
                className="site-grid-card"
                onClick={() => navigateToSection('labour', 'salary')}
                role="button"
                tabIndex={0}
              >
                <div className="site-grid-card-icon" style={{ background: 'rgba(139, 92, 246, 0.15)', color: '#7c3aed' }}>
                  <IndianRupee size={24} />
                </div>
                <div className="site-grid-card-content">
                  <div className="site-grid-card-title">Salary & Wages</div>
                  <div className="site-grid-card-badge" style={{ background: summary.labourBalance > 0 ? '#fef2f2' : '#ecfdf5', color: summary.labourBalance > 0 ? '#dc2626' : '#059669' }}>
                    {summary.labourBalance > 0 ? `Due: ₹${summary.labourBalance.toLocaleString('en-IN')}` : 'Settled'}
                  </div>
                  <div className="site-grid-card-amount">Paid: ₹{(summary.labourAdvances + summary.labourPaid).toLocaleString('en-IN')}</div>
                </div>
                <ChevronRight size={18} className="site-grid-card-arrow" />
              </div>

              {/* 5. Advances */}
              <div
                className="site-grid-card"
                onClick={() => navigateToSection('labour', 'advances')}
                role="button"
                tabIndex={0}
              >
                <div className="site-grid-card-icon" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#dc2626' }}>
                  <Wallet size={24} />
                </div>
                <div className="site-grid-card-content">
                  <div className="site-grid-card-title">Labour Advances</div>
                  <div className="site-grid-card-badge">{advances.length} Loans/Adv</div>
                  <div className="site-grid-card-amount">₹{summary.labourAdvances.toLocaleString('en-IN')}</div>
                </div>
                <ChevronRight size={18} className="site-grid-card-arrow" />
              </div>

              {/* 6. Tools */}
              <div
                className="site-grid-card"
                onClick={() => navigateToSection('tools')}
                role="button"
                tabIndex={0}
              >
                <div className="site-grid-card-icon" style={{ background: 'rgba(14, 165, 233, 0.15)', color: '#0284c7' }}>
                  <Wrench size={24} />
                </div>
                <div className="site-grid-card-content">
                  <div className="site-grid-card-title">Tools & Machinery</div>
                  <div className="site-grid-card-badge">{tools.length} Items</div>
                  <div className="site-grid-card-amount">₹{summary.toolsCost.toLocaleString('en-IN')}</div>
                </div>
                <ChevronRight size={18} className="site-grid-card-arrow" />
              </div>

              {/* 7. Tea & Snacks */}
              <div
                className="site-grid-card"
                onClick={() => navigateToSection('expenses', 'tea')}
                role="button"
                tabIndex={0}
              >
                <div className="site-grid-card-icon" style={{ background: 'rgba(217, 119, 6, 0.15)', color: '#b45309' }}>
                  <Coffee size={24} />
                </div>
                <div className="site-grid-card-content">
                  <div className="site-grid-card-title">Tea & Snacks</div>
                  <div className="site-grid-card-badge">{teaSnacks.length} Entries</div>
                  <div className="site-grid-card-amount">₹{summary.teaSnacksCost.toLocaleString('en-IN')}</div>
                </div>
                <ChevronRight size={18} className="site-grid-card-arrow" />
              </div>

              {/* 8. Pooja */}
              <div
                className="site-grid-card"
                onClick={() => navigateToSection('expenses', 'pooja')}
                role="button"
                tabIndex={0}
              >
                <div className="site-grid-card-icon" style={{ background: 'rgba(236, 72, 153, 0.15)', color: '#db2777' }}>
                  <Sparkles size={24} />
                </div>
                <div className="site-grid-card-content">
                  <div className="site-grid-card-title">Pooja Ceremonies</div>
                  <div className="site-grid-card-badge">{poojas.length} Ceremonies</div>
                  <div className="site-grid-card-amount">₹{summary.poojaCost.toLocaleString('en-IN')}</div>
                </div>
                <ChevronRight size={18} className="site-grid-card-arrow" />
              </div>

              {/* 9. Electricity */}
              <div
                className="site-grid-card"
                onClick={() => navigateToSection('expenses', 'electricity')}
                role="button"
                tabIndex={0}
              >
                <div className="site-grid-card-icon" style={{ background: 'rgba(234, 179, 8, 0.15)', color: '#ca8a04' }}>
                  <Zap size={24} />
                </div>
                <div className="site-grid-card-content">
                  <div className="site-grid-card-title">Electricity Bills</div>
                  <div className="site-grid-card-badge">{electricity.length} Monthly Bills</div>
                  <div className="site-grid-card-amount">₹{summary.electricityCost.toLocaleString('en-IN')}</div>
                </div>
                <ChevronRight size={18} className="site-grid-card-arrow" />
              </div>

              {/* 10. Water */}
              <div
                className="site-grid-card"
                onClick={() => navigateToSection('expenses', 'water')}
                role="button"
                tabIndex={0}
              >
                <div className="site-grid-card-icon" style={{ background: 'rgba(6, 182, 212, 0.15)', color: '#0891b2' }}>
                  <Droplets size={24} />
                </div>
                <div className="site-grid-card-content">
                  <div className="site-grid-card-title">Water Supplies</div>
                  <div className="site-grid-card-badge">{water.length} Deliveries</div>
                  <div className="site-grid-card-amount">₹{summary.waterCost.toLocaleString('en-IN')}</div>
                </div>
                <ChevronRight size={18} className="site-grid-card-arrow" />
              </div>

              {/* 11. Other Expenses */}
              <div
                className="site-grid-card"
                onClick={() => navigateToSection('expenses', 'other')}
                role="button"
                tabIndex={0}
              >
                <div className="site-grid-card-icon" style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#4f46e5' }}>
                  <Receipt size={24} />
                </div>
                <div className="site-grid-card-content">
                  <div className="site-grid-card-title">Other Expenses</div>
                  <div className="site-grid-card-badge">{otherExpenses.length} Records</div>
                  <div className="site-grid-card-amount">₹{summary.otherCost.toLocaleString('en-IN')}</div>
                </div>
                <ChevronRight size={18} className="site-grid-card-arrow" />
              </div>

              {/* 12. Comments & Notes */}
              <div
                className="site-grid-card"
                onClick={() => navigateToSection('comments')}
                role="button"
                tabIndex={0}
              >
                <div className="site-grid-card-icon" style={{ background: 'rgba(100, 116, 139, 0.15)', color: '#475569' }}>
                  <MessageSquare size={24} />
                </div>
                <div className="site-grid-card-content">
                  <div className="site-grid-card-title">Site Notes & Diary</div>
                  <div className="site-grid-card-badge">{comments.length} Entries</div>
                  <div className="site-grid-card-sub">Supervisor Daily Log</div>
                </div>
                <ChevronRight size={18} className="site-grid-card-arrow" />
              </div>

              {/* 13. Payment Ledger */}
              <div
                className="site-grid-card"
                onClick={() => setActiveTab('payments')}
                role="button"
                tabIndex={0}
              >
                <div className="site-grid-card-icon" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#059669' }}>
                  <Receipt size={24} />
                </div>
                <div className="site-grid-card-content">
                  <div className="site-grid-card-title">Payment Ledger</div>
                  <div className="site-grid-card-badge">{payments?.length || 0} Transactions</div>
                  <div className="site-grid-card-amount">₹{summary.totalPaid.toLocaleString('en-IN')}</div>
                </div>
                <ChevronRight size={18} className="site-grid-card-arrow" />
              </div>

              {/* 14. Reports */}
              <div
                className="site-grid-card"
                onClick={() => navigateToSection('reports')}
                role="button"
                tabIndex={0}
              >
                <div className="site-grid-card-icon" style={{ background: 'rgba(245, 158, 11, 0.2)', color: '#b45309' }}>
                  <FileText size={24} />
                </div>
                <div className="site-grid-card-content">
                  <div className="site-grid-card-title">Cost Reports</div>
                  <div className="site-grid-card-badge" style={{ background: '#fef3c7', color: '#92400e' }}>PDF / Print / CSV</div>
                  <div className="site-grid-card-sub">Complete Site Statement</div>
                </div>
                <ChevronRight size={18} className="site-grid-card-arrow" />
              </div>

              {/* 15. Estimator & Variance */}
              <div
                className="site-grid-card site-grid-card-featured"
                onClick={() => setActiveTab('variance')}
                role="button"
                tabIndex={0}
              >
                <div className="site-grid-card-icon" style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#059669' }}>
                  <Scale size={24} />
                </div>
                <div className="site-grid-card-content">
                  <div className="site-grid-card-title">Estimator & Variance</div>
                  <div className="site-grid-card-badge" style={{ background: '#ecfdf5', color: '#047857' }}>Estimate vs Actual</div>
                  <div className="site-grid-card-sub">Preliminary vs Actual Bills</div>
                </div>
                <ChevronRight size={18} className="site-grid-card-arrow" />
              </div>
            </div>
          </div>

          {/* Detailed Financial Breakdown Cards */}
          <div className="metrics-grid">
            <div className="metric-card card-primary" onClick={() => navigateToSection('materials')} style={{ cursor: 'pointer' }}>
              <div className="metric-info">
                <h3>Material Expense</h3>
                <div className="metric-value">₹{summary.materialCost.toLocaleString('en-IN')}</div>
                <div className="metric-sub">
                  Paid: ₹{summary.materialPaid.toLocaleString('en-IN')} • Due: ₹{summary.materialBalance.toLocaleString('en-IN')}
                </div>
              </div>
              <div className="metric-icon" style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary)' }}>
                <Layers size={22} />
              </div>
            </div>

            <div className="metric-card card-success" onClick={() => navigateToSection('labour', 'salary')} style={{ cursor: 'pointer' }}>
              <div className="metric-info">
                <h3>Labour Wages</h3>
                <div className="metric-value">₹{summary.labourGrossSalary.toLocaleString('en-IN')}</div>
                <div className="metric-sub">
                  Paid: ₹{(summary.labourAdvances + summary.labourPaid).toLocaleString('en-IN')} • Due: ₹{summary.labourBalance.toLocaleString('en-IN')}
                </div>
              </div>
              <div className="metric-icon" style={{ backgroundColor: 'var(--success-bg)', color: 'var(--success)' }}>
                <Users size={22} />
              </div>
            </div>

            <div className="metric-card card-info" onClick={() => navigateToSection('tools')} style={{ cursor: 'pointer' }}>
              <div className="metric-info">
                <h3>Tools & Machinery</h3>
                <div className="metric-value">₹{summary.toolsCost.toLocaleString('en-IN')}</div>
                <div className="metric-sub">
                  Paid: ₹{summary.toolsPaid.toLocaleString('en-IN')} • Due: ₹{summary.toolsBalance.toLocaleString('en-IN')}
                </div>
              </div>
              <div className="metric-icon" style={{ backgroundColor: 'var(--info-bg)', color: 'var(--info)' }}>
                <Wrench size={22} />
              </div>
            </div>

            <div className="metric-card card-primary" onClick={() => navigateToSection('expenses', 'tea')} style={{ cursor: 'pointer' }}>
              <div className="metric-info">
                <h3>Tea & Snacks</h3>
                <div className="metric-value">₹{summary.teaSnacksCost.toLocaleString('en-IN')}</div>
                <div className="metric-sub">
                  Daily food & refreshments
                </div>
              </div>
              <div className="metric-icon" style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary)' }}>
                <Coffee size={22} />
              </div>
            </div>

            <div className="metric-card card-purple" onClick={() => navigateToSection('expenses', 'pooja')} style={{ cursor: 'pointer' }}>
              <div className="metric-info">
                <h3>Pooja Ceremonies</h3>
                <div className="metric-value">₹{summary.poojaCost.toLocaleString('en-IN')}</div>
                <div className="metric-sub">
                  {poojas.length} ceremonies conducted
                </div>
              </div>
              <div className="metric-icon" style={{ backgroundColor: 'var(--purple-bg)', color: 'var(--purple)' }}>
                <Sparkles size={22} />
              </div>
            </div>

            <div className="metric-card card-info" onClick={() => navigateToSection('expenses', 'electricity')} style={{ cursor: 'pointer' }}>
              <div className="metric-info">
                <h3>Electricity & Water</h3>
                <div className="metric-value">₹{(summary.electricityCost + summary.waterCost).toLocaleString('en-IN')}</div>
                <div className="metric-sub">
                  EB: ₹{summary.electricityCost} • Water: ₹{summary.waterCost}
                </div>
              </div>
              <div className="metric-icon" style={{ backgroundColor: 'var(--info-bg)', color: 'var(--info)' }}>
                <Droplets size={22} />
              </div>
            </div>

            <div className="metric-card card-primary" onClick={() => navigateToSection('expenses', 'other')} style={{ cursor: 'pointer' }}>
              <div className="metric-info">
                <h3>Other Expenses</h3>
                <div className="metric-value">₹{summary.otherCost.toLocaleString('en-IN')}</div>
                <div className="metric-sub">
                  Transport, Fuel, Repair & Misc
                </div>
              </div>
              <div className="metric-icon" style={{ backgroundColor: '#e0e7ff', color: '#4338ca' }}>
                <Receipt size={22} />
              </div>
            </div>
          </div>

          {/* Site Notes Preview */}
          {comments.length > 0 && (
            <div className="table-container" style={{ marginTop: '20px' }}>
              <div className="table-header-bar">
                <span style={{ fontWeight: 700, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <MessageSquare size={18} color="var(--primary)" />
                  Latest Site Progress Notes
                </span>
                <button className="btn btn-sm btn-outline" onClick={() => navigateToSection('comments')}>
                  View All ({comments.length})
                </button>
              </div>
              <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {comments.slice(0, 3).map(c => (
                  <div key={c.id} style={{ borderBottom: '1px solid var(--border-light)', paddingBottom: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span className="badge badge-planning">{c.category}</span>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        {new Date(c.dateTime).toLocaleDateString()}
                      </span>
                    </div>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-main)' }}>{c.commentText}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: MATERIALS */}
      {activeTab === 'materials' && (
        <MaterialsTab
          siteId={site.id}
          materials={materials}
          rodEntries={rodEntries}
          onOpenMaterialModal={onOpenMaterialModal}
          onOpenRodModal={onOpenRodModal}
          onDeleteMaterial={mat => onTrashRecord('materials', mat.id, mat.materialName)}
          onDeleteRod={rod => onTrashRecord('rodEntries', rod.id, `Rod ${rod.diameter} (${rod.weightKg} kg)`)}
        />
      )}

      {/* TAB 3: LABOUR */}
      {activeTab === 'labour' && (
        <LabourTab
          siteId={site.id}
          workers={workers}
          attendance={attendance}
          advances={advances}
          salaryPayments={salaryPayments}
          initialSubTab={labourSubTab}
          onOpenWorkerModal={onOpenWorkerModal}
          onOpenAttendanceModal={onOpenAttendanceModal}
          onOpenAdvanceModal={onOpenAdvanceModal}
          onOpenSalaryModal={onOpenSalaryModal}
          onDeleteWorker={w => onTrashRecord('workers', w.id, w.name)}
          onDeleteAttendance={a => onTrashRecord('attendance', a.id, `Attendance (${a.date})`)}
          onDeleteAdvance={adv => onTrashRecord('labourAdvances', adv.id, `Advance ₹${adv.amount}`)}
          onDeleteSalaryPayment={s => onTrashRecord('salaryPayments', s.id, `Salary ₹${s.paidAmount}`)}
        />
      )}

      {/* TAB 4: TOOLS */}
      {activeTab === 'tools' && (
        <ToolsTab
          siteId={site.id}
          tools={tools}
          onOpenToolModal={onOpenToolModal}
          onDeleteTool={t => onTrashRecord('tools', t.id, t.toolName)}
        />
      )}

      {/* TAB 5: DAILY EXPENSES */}
      {activeTab === 'expenses' && (
        <DailyExpensesTab
          siteId={site.id}
          teaSnacks={teaSnacks}
          poojas={poojas}
          electricity={electricity}
          water={water}
          otherExpenses={otherExpenses}
          initialSection={expenseSubSection}
          onOpenTeaModal={onOpenTeaModal}
          onOpenPoojaModal={onOpenPoojaModal}
          onOpenElectricityModal={onOpenElectricityModal}
          onOpenWaterModal={onOpenWaterModal}
          onOpenOtherModal={onOpenOtherModal}
          onDeleteTea={t => onTrashRecord('teaSnacksExpenses', t.id, `Tea on ${t.date}`)}
          onDeletePooja={p => onTrashRecord('poojaExpenses', p.id, p.poojaName)}
          onDeleteElectricity={e => onTrashRecord('electricityBills', e.id, `EB Bill ${e.month}`)}
          onDeleteWater={w => onTrashRecord('waterBills', w.id, `Water ${w.supplier}`)}
          onDeleteOther={o => onTrashRecord('otherExpenses', o.id, `Other: ${o.category} - ${o.description}`)}
        />
      )}

      {/* TAB: PAYMENT LEDGER */}
      {activeTab === 'payments' && (
        <PaymentsLedgerTab
          siteId={site.id}
          payments={payments || []}
          onNotify={onNotify}
        />
      )}

      {/* TAB 6: COMMENTS */}
      {activeTab === 'comments' && (
        <CommentsTab
          comments={comments}
          onOpenCommentModal={onOpenCommentModal}
          onDeleteComment={c => onTrashRecord('siteComments', c.id, `Site Note`)}
        />
      )}

      {/* TAB 7: REPORTS */}
      {activeTab === 'reports' && (
        <ReportsTab
          site={site}
          summary={summary}
          materials={materials}
          rodEntries={rodEntries}
          workers={workers}
          attendance={attendance}
          advances={advances}
          salaryPayments={salaryPayments}
          tools={tools}
          teaSnacks={teaSnacks}
          poojas={poojas}
          electricity={electricity}
          water={water}
          otherExpenses={otherExpenses}
        />
      )}

      {/* TAB 8: ESTIMATE VS ACTUAL VARIANCE */}
      {activeTab === 'variance' && (
        <EstimateVarianceTab
          site={site}
          summary={summary}
          materials={materials}
          rodEntries={rodEntries}
          onOpenEstimator={onOpenEstimator}
          onNotify={onNotify || (() => {})}
        />
      )}
    </div>
  );
};
