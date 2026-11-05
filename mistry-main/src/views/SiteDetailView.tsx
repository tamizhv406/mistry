import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
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
  ShieldCheck,
  PenTool,
  Settings,
  Copy,
  Archive,
  ArrowRight,
  CheckCircle2,
  FolderOpen,
  Check,
} from 'lucide-react';
import { useSiteData } from '../hooks/useSiteData';
import { getCurrentUser, isHouseOwner } from '../services/auth';
import { MaterialsTab } from './site-tabs/MaterialsTab';
import { LabourTab } from './site-tabs/LabourTab';
import { ToolsTab } from './site-tabs/ToolsTab';
import { DailyExpensesTab } from './site-tabs/DailyExpensesTab';
import { PaymentsLedgerTab } from './site-tabs/PaymentsLedgerTab';
import { CommentsTab } from './site-tabs/CommentsTab';
import { ReportsTab } from './site-tabs/ReportsTab';
import { EstimateVarianceTab } from './site-tabs/EstimateVarianceTab';
import { TasksTab } from './site-tabs/TasksTab';
import { DocumentsTab } from './site-tabs/DocumentsTab';

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
  onOpenFloorPlans?: (siteId: string) => void;
  onNotify?: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onReturnToAdmin?: () => void;
  initialTab?:
    | 'overview'
    | 'materials'
    | 'labour'
    | 'tools'
    | 'expenses'
    | 'payments'
    | 'comments'
    | 'reports'
    | 'variance'
    | 'tasks'
    | 'documents'
    | 'floor-plans'
    | 'settings';
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
  onOpenFloorPlans,
  onNotify,
  onReturnToAdmin,
  initialTab,
  initialExpenseSubSection,
  onTabChange,
}) => {
  const data = useSiteData(siteId);
  const currentUser = getCurrentUser();
  const isClientMode = isHouseOwner(currentUser);
  const [activeTab, setActiveTab] = useState<
    | 'overview'
    | 'materials'
    | 'labour'
    | 'tools'
    | 'expenses'
    | 'payments'
    | 'comments'
    | 'reports'
    | 'variance'
    | 'tasks'
    | 'documents'
    | 'floor-plans'
    | 'settings'
  >(initialTab || 'overview');
  const [labourSubTab, setLabourSubTab] = useState<'salary' | 'roster' | 'attendance' | 'advances'>('salary');
  const [expenseSubSection, setExpenseSubSection] = useState<'tea' | 'pooja' | 'electricity' | 'water' | 'other'>(
    initialExpenseSubSection || 'tea'
  );

  // Live floor plans for this site
  const siteFloorPlans = useLiveQuery(async () => {
    return await db.floorPlans.filter(f => !f.isDeleted && f.siteId === siteId).toArray();
  }, [siteId]) || [];

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
      {/* Prominent Super Admin Inspection Banner */}
      {onReturnToAdmin && (
        <div
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 100,
            backgroundColor: '#eef2ff',
            border: '1px solid #c7d2fe',
            borderRadius: '12px',
            color: '#312e81',
            padding: '12px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            boxShadow: '0 1px 3px rgba(15, 23, 42, 0.06)',
            marginBottom: '18px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: '#4f46e5',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                flexShrink: 0,
              }}
            >
              <ShieldCheck size={20} />
            </div>
            <div>
              <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#312e81', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span>Inspecting Site: <strong>{site.name}</strong></span>
                <span style={{ backgroundColor: '#e0e7ff', color: '#3730a3', padding: '2px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600 }}>
                  Admin view
                </span>
              </div>
              <div style={{ fontSize: '0.78rem', color: '#475569' }}>
                Super Admin Active Inspection — All project modifications are audit-logged
              </div>
            </div>
          </div>

          <button
            type="button"
            className="btn btn-sm"
            onClick={onReturnToAdmin}
            style={{
              background: '#4f46e5',
              color: '#ffffff',
              fontWeight: 700,
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '10px',
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(79, 70, 229, 0.25)',
              minHeight: '44px',
            }}
          >
            <ArrowLeft size={16} />
            <span>Return to Admin dashboard</span>
          </button>
        </div>
      )}

      {/* Back Button and Quick Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="btn btn-outline btn-sm" onClick={onBack}>
            <ArrowLeft size={16} />
            <span>All Sites Dashboard</span>
          </button>
          {onReturnToAdmin && (
            <button
              className="btn btn-sm"
              style={{
                background: '#4f46e5',
                color: '#fff',
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                border: 'none',
                padding: '6px 12px',
                borderRadius: '8px',
                cursor: 'pointer',
              }}
              onClick={onReturnToAdmin}
            >
              <ShieldCheck size={16} />
              <span>Admin dashboard</span>
            </button>
          )}
        </div>

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
                  <a href={`tel:${site.ownerPhone}`} style={{ color: 'var(--primary-hover)', fontWeight: 600, textDecoration: 'none' }}>
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
            <span>Back to Site Overview</span>
          </button>
          <div className="section-breadcrumb-title">
            {activeTab === 'floor-plans' && 'Floor Planner & CAD Models'}
            {(activeTab === 'tasks' || activeTab === 'variance') && 'Tasks, Milestones & Progress Variance'}
            {activeTab === 'materials' && 'Materials & Steel Rods'}
            {activeTab === 'labour' && `Workers & Attendance (${labourSubTab.toUpperCase()})`}
            {activeTab === 'expenses' && `Expenses & Utilities (${expenseSubSection.toUpperCase()})`}
            {activeTab === 'tools' && 'Tools, Machinery & Rentals'}
            {activeTab === 'payments' && 'Universal Payment Ledger & Audit Trail'}
            {(activeTab === 'comments' || activeTab === 'documents') && 'Documents, Site Diary & Notes'}
            {activeTab === 'reports' && 'Cost Reports & Financial Statements'}
            {activeTab === 'settings' && 'Project Configuration & Settings'}
          </div>
        </div>
      )}

      {/* Client View Notice Banner */}
      {isClientMode && (
        <div style={{
          padding: '12px 18px',
          backgroundColor: '#eff6ff',
          border: '1.5px solid #bfdbfe',
          borderRadius: '10px',
          color: '#1e40af',
          fontSize: '0.86rem',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '16px',
        }}>
          <ShieldCheck size={20} className="text-blue-600 flex-shrink-0" />
          <span>
            <strong>Client Portal Access:</strong> Viewing project overview, progress tasks, CAD floor plans, materials, and approved documents. (Workforce wages and contractor expenses are protected.)
          </span>
        </div>
      )}

      {/* Main Tab Navigation Bar */}
      <div className="tab-navigation">
        <button
          className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => { setActiveTab('overview'); onTabChange?.('overview'); }}
        >
          <TrendingUp size={17} />
          <span>1. Overview</span>
        </button>

        <button
          className={`tab-btn ${activeTab === 'tasks' || activeTab === 'variance' ? 'active' : ''}`}
          onClick={() => { setActiveTab('tasks'); onTabChange?.('tasks'); }}
        >
          <Scale size={17} />
          <span>2. Tasks & Progress</span>
        </button>

        <button
          className={`tab-btn ${activeTab === 'floor-plans' ? 'active' : ''}`}
          onClick={() => { setActiveTab('floor-plans'); onTabChange?.('floor-plans'); }}
        >
          <PenTool size={17} />
          <span>3. Floor Planner {siteFloorPlans.length > 0 ? `(${siteFloorPlans.length})` : ''}</span>
        </button>

        {!isClientMode && (
          <button
            className={`tab-btn ${activeTab === 'labour' ? 'active' : ''}`}
            onClick={() => { setActiveTab('labour'); setLabourSubTab('salary'); onTabChange?.('labour'); }}
          >
            <Users size={17} />
            <span>4. Workers & Attendance ({workers.length})</span>
          </button>
        )}

        <button
          className={`tab-btn ${activeTab === 'materials' ? 'active' : ''}`}
          onClick={() => { setActiveTab('materials'); onTabChange?.('materials'); }}
        >
          <Layers size={17} />
          <span>{isClientMode ? '4. Materials' : '5. Materials'} ({materials.length + rodEntries.length})</span>
        </button>

        {!isClientMode && (
          <button
            className={`tab-btn ${activeTab === 'expenses' || activeTab === 'tools' || activeTab === 'payments' ? 'active' : ''}`}
            onClick={() => { setActiveTab('expenses'); onTabChange?.('expenses'); }}
          >
            <Coffee size={17} />
            <span>6. Expenses</span>
          </button>
        )}

        <button
          className={`tab-btn ${activeTab === 'comments' || activeTab === 'documents' ? 'active' : ''}`}
          onClick={() => { setActiveTab('documents'); onTabChange?.('documents'); }}
        >
          <MessageSquare size={17} />
          <span>{isClientMode ? '5. Documents & Diary' : '7. Documents & Diary'}</span>
        </button>

        <button
          className={`tab-btn ${activeTab === 'reports' ? 'active' : ''}`}
          onClick={() => { setActiveTab('reports'); onTabChange?.('reports'); }}
        >
          <FileText size={17} />
          <span>{isClientMode ? '6. Reports' : '8. Reports'}</span>
        </button>

        {!isClientMode && (
          <button
            className={`tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => { setActiveTab('settings'); onTabChange?.('settings'); }}
          >
            <Settings size={17} />
            <span>9. Settings</span>
          </button>
        )}
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
              Quick Entry Shortcuts:
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
                Site Modules & Records
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

              {/* 16. Floor Plan Creator */}
              {onOpenFloorPlans && (
                <div
                  className="site-grid-card site-grid-card-featured"
                  onClick={() => onOpenFloorPlans(site.id)}
                  role="button"
                  tabIndex={0}
                  id="site-card-floor-plans"
                  style={{ border: '1.5px solid rgba(217, 119, 6, 0.35)' }}
                >
                  <div className="site-grid-card-icon" style={{ background: 'rgba(217, 119, 6, 0.15)', color: '#d97706' }}>
                    <PenTool size={24} />
                  </div>
                  <div className="site-grid-card-content">
                    <div className="site-grid-card-title">Floor Plan Creator</div>
                    <div className="site-grid-card-badge" style={{ background: '#fffbeb', color: '#b45309' }}>2D / 3D Layouts</div>
                    <div className="site-grid-card-sub">Design & Edit Floor Plans</div>
                  </div>
                  <ChevronRight size={18} className="site-grid-card-arrow" />
                </div>
              )}
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
        isClientMode ? (
          <div style={{ padding: '48px 20px', textAlign: 'center', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', margin: '20px 0' }}>
            <ShieldCheck size={40} color="#3b82f6" style={{ margin: '0 auto 12px' }} />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>Internal Workforce Information</h3>
            <p style={{ color: '#64748b', fontSize: '0.88rem', maxWidth: '440px', margin: '0 auto 16px' }}>
              Worker attendance rosters, wage formulas, and disbursement records are private to site engineers and project managers.
            </p>
            <button className="btn btn-primary btn-sm" onClick={() => setActiveTab('overview')}>Back to Overview</button>
          </div>
        ) : (
          <LabourTab
            siteId={site.id}
            workers={workers}
            attendance={attendance}
            advances={advances}
            salaryPayments={salaryPayments}
            initialSubTab={labourSubTab}
            leavePaid={site.leavePaid}
            onOpenWorkerModal={onOpenWorkerModal}
            onOpenAttendanceModal={onOpenAttendanceModal}
            onOpenAdvanceModal={onOpenAdvanceModal}
            onOpenSalaryModal={onOpenSalaryModal}
            onDeleteWorker={w => onTrashRecord('workers', w.id, w.name)}
            onDeleteAttendance={a => onTrashRecord('attendance', a.id, `Attendance (${a.date})`)}
            onDeleteAdvance={adv => onTrashRecord('labourAdvances', adv.id, `Advance ₹${adv.amount}`)}
            onDeleteSalaryPayment={s => onTrashRecord('salaryPayments', s.id, `Salary ₹${s.paidAmount}`)}
          />
        )
      )}

      {/* TAB 4: TOOLS */}
      {activeTab === 'tools' && (
        isClientMode ? (
          <div style={{ padding: '48px 20px', textAlign: 'center', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', margin: '20px 0' }}>
            <ShieldCheck size={40} color="#3b82f6" style={{ margin: '0 auto 12px' }} />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>Contractor Assets & Machinery</h3>
            <button className="btn btn-primary btn-sm" onClick={() => setActiveTab('overview')}>Back to Overview</button>
          </div>
        ) : (
          <ToolsTab
            siteId={site.id}
            tools={tools}
            onOpenToolModal={onOpenToolModal}
            onDeleteTool={t => onTrashRecord('tools', t.id, t.toolName)}
          />
        )
      )}

      {/* TAB 5: DAILY EXPENSES */}
      {activeTab === 'expenses' && (
        isClientMode ? (
          <div style={{ padding: '48px 20px', textAlign: 'center', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', margin: '20px 0' }}>
            <ShieldCheck size={40} color="#3b82f6" style={{ margin: '0 auto 12px' }} />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>Internal Operational Expenses</h3>
            <p style={{ color: '#64748b', fontSize: '0.88rem', maxWidth: '440px', margin: '0 auto 16px' }}>
              Daily petty cash, contractor utilities, and internal expense receipts are protected in client mode.
            </p>
            <button className="btn btn-primary btn-sm" onClick={() => setActiveTab('overview')}>Back to Overview</button>
          </div>
        ) : (
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
        )
      )}

      {/* TAB: PAYMENT LEDGER */}
      {activeTab === 'payments' && (
        <PaymentsLedgerTab
          siteId={site.id}
          payments={payments || []}
          onNotify={onNotify}
        />
      )}

      {/* TAB: DOCUMENTS & SITE DIARY */}
      {(activeTab === 'comments' || activeTab === 'documents') && (
        <DocumentsTab
          site={site}
          comments={comments}
          onOpenCommentModal={onOpenCommentModal}
          onDeleteComment={c => onTrashRecord('siteComments', c.id, `Site Note`)}
          onNotify={onNotify}
        />
      )}

      {/* TAB: REPORTS */}
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

      {/* TAB: TASKS, MILESTONES & WORK PROGRESS */}
      {activeTab === 'tasks' && (
        <TasksTab
          siteId={site.id}
          workers={workers}
          onNotify={onNotify}
        />
      )}

      {/* TAB: ESTIMATE VARIANCE */}
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

      {/* TAB: FLOOR PLANNER */}
      {activeTab === 'floor-plans' && (
        <div style={{ background: '#FFFFFF', border: '1px solid var(--border-light)', borderRadius: '16px', padding: '24px', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px', borderBottom: '1px solid var(--border-light)', paddingBottom: '16px' }}>
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <PenTool size={20} color="var(--primary)" />
                <span>Floor Plans for {site.name}</span>
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
                Architectural CAD models, 2D floor plans, wall dimensions, and 3D preview.
              </p>
            </div>

            {onOpenFloorPlans && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => onOpenFloorPlans(site.id)}
              >
                <PlusCircle size={16} />
                <span>Open Floor Planner Studio</span>
              </button>
            )}
          </div>

          {siteFloorPlans.length === 0 ? (
            <div style={{ padding: '48px 20px', textAlign: 'center', background: '#F8FAFC', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
              <PenTool size={40} style={{ color: '#94A3B8', margin: '0 auto 12px' }} />
              <h4 style={{ fontSize: '1rem', fontWeight: 700, color: '#111827', margin: '0 0 6px' }}>
                No Floor Plans Created for this Site
              </h4>
              <p style={{ fontSize: '0.85rem', color: '#64748B', maxWidth: '440px', margin: '0 auto 16px' }}>
                Draw architectural walls, define rooms, place doors and windows, and inspect building dimensions in 2D and 3D.
              </p>
              {onOpenFloorPlans && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => onOpenFloorPlans(site.id)}
                >
                  <PenTool size={16} />
                  <span>Launch Floor Plan Studio</span>
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
              {siteFloorPlans.map(plan => (
                <div
                  key={plan.id}
                  style={{
                    background: '#FFFFFF',
                    border: '1px solid #E2E8F0',
                    borderRadius: '12px',
                    padding: '16px',
                    boxShadow: 'var(--shadow-sm)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <span className="badge badge-planning" style={{ fontSize: '0.7rem' }}>
                        {plan.floorName || 'Ground Floor'}
                      </span>
                      <span style={{ fontSize: '0.7rem', color: '#94A3B8' }}>
                        {plan.unit || 'feet'}
                      </span>
                    </div>

                    <h4 style={{ fontSize: '1rem', fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>
                      {plan.buildingName || site.name}
                    </h4>
                    <p style={{ fontSize: '0.78rem', color: '#64748B', margin: '0 0 12px' }}>
                      {plan.rooms?.length || 0} Rooms • {plan.walls?.length || 0} Walls • Plot: {plan.plotLength} x {plan.plotWidth} {plan.unit}
                    </p>
                  </div>

                  {onOpenFloorPlans && (
                    <button
                      type="button"
                      className="btn btn-sm btn-outline"
                      onClick={() => onOpenFloorPlans(site.id)}
                      style={{ width: '100%', justifyContent: 'center', marginTop: '8px', color: '#2563EB', borderColor: '#BFDBFE' }}
                    >
                      <span>Open in CAD Studio</span>
                      <ArrowRight size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB: PROJECT SETTINGS */}
      {activeTab === 'settings' && (
        <div style={{ background: '#FFFFFF', border: '1px solid var(--border-light)', borderRadius: '16px', padding: '24px', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px', borderBottom: '1px solid var(--border-light)', paddingBottom: '16px' }}>
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Settings size={20} color="var(--primary)" />
                <span>Project Settings & Lifecycle</span>
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
                Manage project status, workforce policies, client contacts, and safety archival.
              </p>
            </div>

            <button
              type="button"
              className="btn btn-primary"
              onClick={() => onEditSite(site)}
            >
              <Edit2 size={16} />
              <span>Edit Project Details</span>
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
            {/* Status Configuration */}
            <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '18px' }}>
              <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#111827', margin: '0 0 6px' }}>
                Project Lifecycle Status
              </h4>
              <p style={{ fontSize: '0.78rem', color: '#64748B', margin: '0 0 14px' }}>
                Switch lifecycle state between planning, active construction, hold, or completion.
              </p>

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {(['Active', 'Planning', 'On Hold', 'Completed'] as const).map(st => (
                  <button
                    key={st}
                    type="button"
                    onClick={async () => {
                      if (site.status === st) return;
                      await db.sites.update(site.id, { status: st, updatedAt: new Date().toISOString() });
                      onNotify?.(`Project status updated to "${st}"`, 'success');
                    }}
                    style={{
                      padding: '8px 14px',
                      borderRadius: '8px',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      border: site.status === st ? '2px solid #2563EB' : '1px solid #CBD5E1',
                      background: site.status === st ? '#EFF6FF' : '#FFFFFF',
                      color: site.status === st ? '#1D4ED8' : '#475569',
                      cursor: 'pointer',
                    }}
                  >
                    {st === site.status && <Check size={14} style={{ display: 'inline', marginRight: '4px' }} />}
                    {st}
                  </button>
                ))}
              </div>
            </div>

            {/* Leave Policy */}
            <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '18px' }}>
              <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#111827', margin: '0 0 6px' }}>
                Workforce Leave Pay Policy
              </h4>
              <p style={{ fontSize: '0.78rem', color: '#64748B', margin: '0 0 14px' }}>
                Determine whether approved Leave days are paid to registered workers on this site.
              </p>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={async () => {
                    await db.sites.update(site.id, { leavePaid: true, updatedAt: new Date().toISOString() });
                    onNotify?.('Leave policy set: Paid Leave (1 full day wage per approved leave)', 'info');
                  }}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '8px',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    border: site.leavePaid === true ? '2px solid #16A34A' : '1px solid #CBD5E1',
                    background: site.leavePaid === true ? '#DCFCE7' : '#FFFFFF',
                    color: site.leavePaid === true ? '#15803D' : '#475569',
                    cursor: 'pointer',
                  }}
                >
                  {site.leavePaid === true && <Check size={14} style={{ display: 'inline', marginRight: '4px' }} />}
                  Paid Leave
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await db.sites.update(site.id, { leavePaid: false, updatedAt: new Date().toISOString() });
                    onNotify?.('Leave policy set: Unpaid Leave (0 wages for leave days)', 'info');
                  }}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '8px',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    border: site.leavePaid === false ? '2px solid #D97706' : '1px solid #CBD5E1',
                    background: site.leavePaid === false ? '#FEF3C7' : '#FFFFFF',
                    color: site.leavePaid === false ? '#B45309' : '#475569',
                    cursor: 'pointer',
                  }}
                >
                  {site.leavePaid === false && <Check size={14} style={{ display: 'inline', marginRight: '4px' }} />}
                  Unpaid Leave
                </button>
              </div>
            </div>

            {/* Project Actions: Duplicate & Archive */}
            <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '18px' }}>
              <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#111827', margin: '0 0 6px' }}>
                Safe Duplication & Archival
              </h4>
              <p style={{ fontSize: '0.78rem', color: '#64748B', margin: '0 0 14px' }}>
                Clone project setup or move records safely to the Recycle Bin.
              </p>

              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={async () => {
                    const newId = `site_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
                    const now = new Date().toISOString();
                    const cloned: Site = {
                      ...site,
                      id: newId,
                      name: `${site.name} (Copy)`,
                      createdAt: now,
                      updatedAt: now,
                      isDeleted: false,
                      deletedAt: undefined,
                    };
                    await db.sites.add(cloned);
                    onNotify?.(`Project successfully cloned as "${cloned.name}"!`, 'success');
                    onBack();
                  }}
                  style={{ color: '#2563EB', borderColor: '#BFDBFE', background: '#FFFFFF' }}
                >
                  <Copy size={16} />
                  <span>Duplicate Project</span>
                </button>

                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => onDeleteSite(site)}
                  style={{ color: '#DC2626', borderColor: '#FECACA', background: '#FEF2F2' }}
                >
                  <Trash2 size={16} />
                  <span>Move to Recycle Bin</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
