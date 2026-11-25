import React, { useState, useMemo, useEffect } from 'react';
import {
  Users,
  Search,
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
  PlusCircle,
  FileText,
  Building2,
  ChevronLeft,
  ChevronRight,
  Filter,
  DollarSign,
  UserCheck,
  UserX,
  AlertCircle,
  Download,
  IndianRupee,
  Layers,
  Edit2,
  Check,
  Sparkles,
  Printer,
} from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import type { AttendanceRecord, AttendanceStatus, LabourAdvance, LabourWorker, SalaryPayment, Site, User } from '../db/types';
import {
  ATTENDANCE_STATUS_META,
  ATTENDANCE_STATUS_ORDER,
  buildSiteLabourSummary,
  buildWorkerLedger,
  countByStatus,
  dedupeAttendance,
  summariseMonth,
} from '../domain/salary';
import { formatDay, formatMonth, monthKeyOf, todayKey, addMonths } from '../utils/datetime';
import { formatINR, formatQty } from '../utils/money';
import { markAllPresent, markAttendance, setLeavePolicy } from '../services/records';
import { CorrectionLog } from '../components/attendance/CorrectionLog';
import { AttendanceModal } from '../components/AttendanceModal';
import { WorkerModal } from '../components/WorkerModal';
import { AdvanceModal } from '../components/AdvanceModal';
import { SalaryPaymentModal } from '../components/SalaryPaymentModal';
import { WageSlipModal } from '../components/WageSlipModal';
import { WorkerAttendancePdfModal } from '../components/WorkerAttendancePdfModal';
import { useLanguage } from '../services/i18n';
import { AttendanceMatrix } from '../components/attendance/AttendanceMatrix';
import { VirtualListSpacer, VirtualTableSpacer } from '../components/ui/VirtualSpacers';
import { APP_NAME } from '../config/brand';
import { useVirtualWindow } from '../hooks/useVirtualWindow';

export interface AttendanceSalaryViewProps {
  user: User;
  sites: Site[];
  initialSiteId?: string | null;
  onNavigateSiteDetail?: (siteId: string, tab: string) => void;
  onNotify: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const AttendanceSalaryView: React.FC<AttendanceSalaryViewProps> = ({
  user,
  sites,
  initialSiteId,
  onNavigateSiteDetail,
  onNotify,
}) => {
  const { lang, t, roleLabel, statusLabel } = useLanguage();

  // Current Site Selection
  const [selectedSiteId, setSelectedSiteId] = useState<string>(initialSiteId || (sites[0]?.id || ''));

  // View state
  const [activeTab, setActiveTab] = useState<'matrix' | 'attendance' | 'salary' | 'roster' | 'advances' | 'corrections'>('matrix');
  const [selectedDate, setSelectedDate] = useState<string>(todayKey());
  const [selectedMonth, setSelectedMonth] = useState<string>(monthKeyOf(todayKey()));
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [bulkBusy, setBulkBusy] = useState<boolean>(false);
  const [savingWorkerId, setSavingWorkerId] = useState<string | null>(null);

  // Modals state
  const [isAttendanceModalOpen, setIsAttendanceModalOpen] = useState<boolean>(false);
  const [isWorkerModalOpen, setIsWorkerModalOpen] = useState<boolean>(false);
  const [workerToEdit, setWorkerToEdit] = useState<LabourWorker | null>(null);
  const [isAdvanceModalOpen, setIsAdvanceModalOpen] = useState<boolean>(false);
  const [advanceToEdit, setAdvanceToEdit] = useState<LabourAdvance | null>(null);
  const [isSalaryModalOpen, setIsSalaryModalOpen] = useState<boolean>(false);
  const [salaryToEdit, setSalaryToEdit] = useState<SalaryPayment | null>(null);
  const [selectedWorkerForAction, setSelectedWorkerForAction] = useState<string | null>(null);
  const [lastPaidWorkerId, setLastPaidWorkerId] = useState<string | null>(null);
  const [isWageSlipModalOpen, setIsWageSlipModalOpen] = useState<boolean>(false);
  const [selectedWorkerForSlip, setSelectedWorkerForSlip] = useState<LabourWorker | null>(null);
  const [isAttendancePdfModalOpen, setIsAttendancePdfModalOpen] = useState<boolean>(false);
  const [pdfWorkerId, setPdfWorkerId] = useState<string | null>(null);

  const handlePaymentSuccess = (msg: string, workerId?: string) => {
    onNotify(msg, 'success');
    if (workerId) {
      setLastPaidWorkerId(workerId);
      setSelectedWorkerForAction(workerId); // Preserves selection without requiring manual re-selection!
    }
  };

  // Custom Back Navigation Listener for Mobile App
  useEffect(() => {
    const handleBackEvent = (e: Event) => {
      if (isSalaryModalOpen) {
        e.preventDefault();
        setIsSalaryModalOpen(false);
        setSalaryToEdit(null);
        return;
      }
      if (isAdvanceModalOpen) {
        e.preventDefault();
        setIsAdvanceModalOpen(false);
        setAdvanceToEdit(null);
        return;
      }
      if (isAttendanceModalOpen) {
        e.preventDefault();
        setIsAttendanceModalOpen(false);
        return;
      }
      if (isWorkerModalOpen) {
        e.preventDefault();
        setIsWorkerModalOpen(false);
        setWorkerToEdit(null);
        return;
      }
      if (selectedWorkerForAction) {
        e.preventDefault();
        setSelectedWorkerForAction(null);
        return;
      }
    };
    window.addEventListener('mistry:back', handleBackEvent);
    return () => window.removeEventListener('mistry:back', handleBackEvent);
  }, [isSalaryModalOpen, isAdvanceModalOpen, isAttendanceModalOpen, isWorkerModalOpen, selectedWorkerForAction]);

  // Query project and active workers
  const activeSite = sites.find(s => s.id === selectedSiteId) || sites[0];

  const workersQuery = useLiveQuery(async () => {
    if (!selectedSiteId) return [];
    return await db.workers.where('siteId').equals(selectedSiteId).filter(w => !w.isDeleted).toArray();
  }, [selectedSiteId]);

  const attendanceQuery = useLiveQuery(async () => {
    if (!selectedSiteId) return [];
    return await db.attendance.where('siteId').equals(selectedSiteId).filter(a => !a.isDeleted).toArray();
  }, [selectedSiteId]);

  const advancesQuery = useLiveQuery(async () => {
    if (!selectedSiteId) return [];
    return await db.labourAdvances.where('siteId').equals(selectedSiteId).filter(a => !a.isDeleted).toArray();
  }, [selectedSiteId]);

  const salaryPaymentsQuery = useLiveQuery(async () => {
    if (!selectedSiteId) return [];
    return await db.salaryPayments.where('siteId').equals(selectedSiteId).filter(s => !s.isDeleted).toArray();
  }, [selectedSiteId]);

  const workers = workersQuery || [];
  const attendance = attendanceQuery || [];
  const advances = advancesQuery || [];
  const salaryPayments = salaryPaymentsQuery || [];

  // Pay policy for leave days
  const policy = useMemo(() => ({ leavePaid: activeSite?.leavePaid }), [activeSite?.leavePaid]);

  // Overall Labour Financial & Attendance Summary
  const siteLabourSummary = useMemo(() => {
    if (!workers.length && !attendance.length) return null;
    return buildSiteLabourSummary(workers, attendance, advances, salaryPayments, policy);
  }, [workers, attendance, advances, salaryPayments, policy]);

  // Day marks map for selected date
  const dayMarks = useMemo(() => {
    const map = new Map<string, { status: AttendanceStatus; notes?: string }>();
    const dateRecords = dedupeAttendance(attendance.filter(a => a.date === selectedDate)).records;
    dateRecords.forEach(r => {
      map.set(r.workerId, { status: r.status, notes: r.notes });
    });
    return map;
  }, [attendance, selectedDate]);

  // Attendance counts for selected date
  const dayCounts = useMemo(() => {
    return countByStatus(attendance.filter(a => a.date === selectedDate));
  }, [attendance, selectedDate]);

  const unmarkedWorkers = useMemo(() => {
    return workers.filter(w => !dayMarks.has(w.id));
  }, [workers, dayMarks]);

  // Filtered workers list
  const filteredWorkers = useMemo(() => {
    return workers.filter(w => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches = w.name.toLowerCase().includes(q) || (w.category || '').toLowerCase().includes(q) || (w.phone || '').includes(q);
        if (!matches) return false;
      }
      if (statusFilter !== 'all') {
        const currentMark = dayMarks.get(w.id)?.status;
        if (statusFilter === 'unmarked' && currentMark) return false;
        if (statusFilter !== 'unmarked' && currentMark !== statusFilter) return false;
      }
      return true;
    });
  }, [workers, searchQuery, statusFilter, dayMarks]);

  const dailyWorkerWindow = useVirtualWindow<HTMLTableSectionElement>({
    itemCount: filteredWorkers.length,
    estimateSize: 64,
    threshold: 25,
  });
  const dailyMobileWindow = useVirtualWindow<HTMLDivElement>({
    itemCount: filteredWorkers.length,
    estimateSize: 132,
    threshold: 25,
  });
  const salaryWorkerWindow = useVirtualWindow<HTMLTableSectionElement>({
    itemCount: workers.length,
    estimateSize: 64,
    threshold: 25,
  });
  const salaryMobileWindow = useVirtualWindow<HTMLDivElement>({
    itemCount: workers.length,
    estimateSize: 190,
    threshold: 25,
  });

  // Single Worker Mark Attendance
  const handleMarkStatus = async (worker: LabourWorker, status: AttendanceStatus) => {
    if (!selectedSiteId || savingWorkerId) return;
    setSavingWorkerId(worker.id);
    const res = await markAttendance(user, selectedSiteId, worker, selectedDate, status);
    setSavingWorkerId(null);
    if (!res.ok) {
      onNotify(res.error, 'error');
    }
  };

  // Bulk Mark All Unmarked as Present
  const handleBulkMarkPresent = async () => {
    if (bulkBusy || unmarkedWorkers.length === 0 || !selectedSiteId) return;
    setBulkBusy(true);
    // Same service as the phone screen: only unmarked workers; existing marks are kept.
    const res = await markAllPresent(user, selectedSiteId, workers, selectedDate);
    setBulkBusy(false);
    if (!res.ok) {
      onNotify(res.error, 'error');
    } else if (res.value.failed > 0) {
      onNotify(`${res.value.failed} worker(s) could not be marked.`, 'error');
    } else {
      onNotify(`${res.value.marked} worker(s) marked Present for ${formatDay(selectedDate)}${res.value.kept ? ` · ${res.value.kept} already marked, kept` : ''}.`, 'success');
    }
  };

  // Toggle Leave Pay Rule
  const handleToggleLeavePolicy = async (paid: boolean) => {
    if (!selectedSiteId) return;
    const res = await setLeavePolicy(user, selectedSiteId, paid);
    if (res.ok) {
      onNotify(`Leave pay policy updated: Leaves are now ${paid ? 'Paid' : 'Unpaid'}.`, 'success');
    } else {
      onNotify(res.error, 'error');
    }
  };

  const handleExportPDF = () => {
    window.print();
  };

  return (
    <div className="attendance-page-container">
      {/* Top Header & Actions */}
      <div className="erp-view-header">
        <div className="erp-view-title-wrap">
          <div className="erp-view-title-icon">
            <Users size={22} />
          </div>
          <div>
            <h1 className="erp-view-title">
              Attendance & Salary Management
            </h1>
            <p className="erp-view-subtitle">
              Real-time worker roster, daily muster roll, wages, recoverable advances and salary disbursement.
            </p>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="erp-view-actions">
          <button
            onClick={() => {
              setPdfWorkerId(selectedWorkerForAction);
              setIsAttendancePdfModalOpen(true);
            }}
            className="erp-btn-secondary"
          >
            <FileText size={16} color="var(--color-primary)" />
            <span>Attendance PDF</span>
          </button>

          <button
            onClick={handleExportPDF}
            className="erp-btn-secondary"
          >
            <Download size={16} />
            <span>Export Muster PDF</span>
          </button>

          <button
            onClick={() => {
              setAdvanceToEdit(null);
              setIsAdvanceModalOpen(true);
            }}
            className="erp-btn-secondary"
          >
            <DollarSign size={16} color="var(--color-warning)" />
            <span>Pay Advance</span>
          </button>

          <button
            onClick={() => {
              setSalaryToEdit(null);
              setIsSalaryModalOpen(true);
            }}
            className="erp-btn-secondary"
          >
            <IndianRupee size={16} color="var(--color-success)" />
            <span>Disburse Salary</span>
          </button>

          <button
            onClick={() => {
              setWorkerToEdit(null);
              setIsWorkerModalOpen(true);
            }}
            className="erp-btn-primary"
          >
            <PlusCircle size={18} />
            <span>+ Add Worker</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="attendance-kpi-grid">
        <div className="erp-stat-card">
          <div className="erp-stat-card-top">
            <span className="erp-stat-label">TOTAL WORKERS</span>
            <Users size={18} color="var(--color-charcoal)" />
          </div>
          <div className="erp-stat-value erp-stat-value--lg">{workers.length}</div>
          <div className="erp-stat-sub">Active site personnel</div>
        </div>

        <div className="erp-stat-card">
          <div className="erp-stat-card-top">
            <span className="erp-stat-label">PRESENT TODAY</span>
            <CheckCircle2 size={18} color="var(--color-success)" />
          </div>
          <div className="erp-stat-value erp-stat-value--lg erp-stat-value--success">
            {dayCounts.present + dayCounts.overtime}
          </div>
          <div className="erp-stat-sub">
            {dayCounts.overtime > 0 ? `Includes ${dayCounts.overtime} overtime shifts` : 'Full day attendance'}
          </div>
        </div>

        <div className="erp-stat-card">
          <div className="erp-stat-card-top">
            <span className="erp-stat-label">ABSENT / HALF-DAY</span>
            <XCircle size={18} color="var(--color-danger)" />
          </div>
          <div className={`erp-stat-value erp-stat-value--lg ${dayCounts.absent > 0 ? 'erp-stat-value--danger' : ''}`.trim()}>
            {dayCounts.absent} <span className="erp-cell-sub">({dayCounts.half_day} half)</span>
          </div>
          <div className="erp-stat-sub">Non-productive attendance</div>
        </div>

        <div className="erp-stat-card">
          <div className="erp-stat-card-top">
            <span className="erp-stat-label">ON LEAVE</span>
            <Clock size={18} color="var(--color-warning)" />
          </div>
          <div className={`erp-stat-value erp-stat-value--lg ${dayCounts.leave > 0 ? 'erp-stat-value--warning' : ''}`.trim()}>
            {dayCounts.leave}
          </div>
          <div className="erp-stat-sub">
            Policy: {activeSite?.leavePaid ? 'Paid Leave' : 'Unpaid Leave'}
          </div>
        </div>

        <div className="erp-stat-card">
          <div className="erp-stat-card-top">
            <span className="erp-stat-label">PENDING WAGES</span>
            <IndianRupee size={18} color="var(--color-primary-text)" />
          </div>
          <div className="erp-stat-value erp-stat-value--lg erp-stat-value--primary">
            {formatINR(siteLabourSummary?.pending || 0)}
          </div>
          <div className="erp-stat-sub">
            Earned: {formatINR(siteLabourSummary?.earned || 0)}
          </div>
        </div>
      </div>

      {/* Control Bar: Project Selector, Date Picker, Search & View Tabs */}
      <div className="erp-control-card">
        <div className="erp-filter-group">
          {/* Site Selector */}
          <div>
            <select
              value={selectedSiteId}
              onChange={e => setSelectedSiteId(e.target.value)}
              className="erp-select-pill erp-select-pill--wide"
            >
              {sites.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Date Selector */}
          <div className="att-controls-left">
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="att-date-picker"
            />
            {selectedDate !== todayKey() && (
              <button
                onClick={() => setSelectedDate(todayKey())}
                className="erp-btn-secondary"
              >
                Today
              </button>
            )}
          </div>

          {/* Search */}
          <div className="erp-search-box">
            <Search size={16} className="erp-search-icon" />
            <input
              type="text"
              placeholder="Search worker by name, role or phone..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="erp-search-input"
            />
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="erp-select-pill"
            >
              <option value="all">All Workers</option>
              <option value="present">Present</option>
              <option value="half_day">Half Day</option>
              <option value="overtime">Overtime</option>
              <option value="absent">Absent</option>
              <option value="leave">Leave</option>
              <option value="unmarked">Unmarked Today</option>
            </select>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="erp-segmented-bar">
          {[
            { id: 'matrix', label: lang === 'ta' ? 'வருகை மேட்ரிக்ஸ் (Weekly)' : 'Attendance Matrix (Weekly)' },
            { id: 'attendance', label: lang === 'ta' ? 'தினசரி பதிவு' : 'Daily Mark' },
            { id: 'salary', label: lang === 'ta' ? 'கூலி கணக்கு ஏடு' : 'Salary Ledger' },
            { id: 'advances', label: lang === 'ta' ? 'அட்வான்ஸ்' : 'Advances' },
            { id: 'roster', label: lang === 'ta' ? 'பணியாளர்கள்' : 'Worker Roster' },
            { id: 'corrections', label: lang === 'ta' ? 'திருத்த பதிவு' : 'Correction Log' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`erp-segmented-tab ${activeTab === tab.id ? 'is-active' : ''}`.trim()}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Leave Pay Policy Banner */}
      <div className="attendance-policy-bar">
        <div className="att-controls-left">
          <Sparkles size={18} color="var(--color-primary)" />
          <div>
            <span className="attendance-policy-title">
              Project Leave Pay Policy: {activeSite?.leavePaid ? 'Leaves are Paid' : 'Leaves are Unpaid (Standard)'}
            </span>
            <div className="attendance-policy-sub">
              Configurable per site. If paid, 1 full day wage is earned on approved leave days.
            </div>
          </div>
        </div>

        <div className="att-controls-left">
          <button
            onClick={() => handleToggleLeavePolicy(!activeSite?.leavePaid)}
            className="erp-btn-secondary"
          >
            Switch to {activeSite?.leavePaid ? 'Unpaid Leaves' : 'Paid Leaves'}
          </button>

          {unmarkedWorkers.length > 0 && activeTab === 'attendance' && (
            <button
              onClick={handleBulkMarkPresent}
              disabled={bulkBusy}
              className="erp-btn-success"
            >
              <CheckCircle2 size={15} />
              <span>{bulkBusy ? 'Marking...' : `Mark All ${unmarkedWorkers.length} Unmarked Present`}</span>
            </button>
          )}
        </div>
      </div>

      {/* Tab 0: Mobile-First Attendance Matrix (Spreadsheet View) */}
      {activeTab === 'matrix' && activeSite && (
        <AttendanceMatrix
          user={user}
          activeSite={activeSite}
          workers={workers}
          attendance={attendance}
          advances={advances}
          salaryPayments={salaryPayments}
          onNotify={onNotify}
          onOpenWorkerModal={w => {
            setWorkerToEdit(w || null);
            setIsWorkerModalOpen(true);
          }}
        />
      )}

      {/* Tab 1: Daily Attendance Table & Optimized Mobile Roster */}
      {activeTab === 'attendance' && (
        <div className="erp-card-panel">
          {/* Desktop Table View (> 768px) */}
          <div className="attendance-desktop-table">
            <table className="erp-data-table">
              <thead>
                <tr>
                  <th>Worker Name & ID</th>
                  <th>Role</th>
                  <th>Daily Wage</th>
                  <th className="is-right">Daily Status ({formatDay(selectedDate)})</th>
                </tr>
              </thead>
              <tbody ref={dailyWorkerWindow.containerRef}>
                {filteredWorkers.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="erp-empty-cell">
                      <Users size={36} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
                      <div className="erp-cell-primary">No personnel found for this site</div>
                      <div className="erp-cell-sub">Click "+ Add Worker" to enroll personnel.</div>
                    </td>
                  </tr>
                ) : (
                  <>
                  <VirtualTableSpacer colSpan={4} height={dailyWorkerWindow.topSpacerPx} />
                  {filteredWorkers.slice(dailyWorkerWindow.startIndex, dailyWorkerWindow.endIndex).map(w => {
                    const mark = dayMarks.get(w.id);
                    const status = mark?.status;
                    const isSaving = savingWorkerId === w.id;
                    const statusMeta = status ? ATTENDANCE_STATUS_META[status] : null;

                    return (
                      <tr key={w.id}>
                        <td>
                          <div className="att-controls-left">
                            <div className="attendance-worker-avatar-circle">
                              {w.name.slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <div className="erp-cell-primary">{w.name}</div>
                              <div className="erp-cell-sub">
                                ID: #{w.id.slice(-6).toUpperCase()} · {w.phone || 'No phone'}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className="attendance-role-pill">
                            {w.category}
                          </span>
                        </td>
                        <td className="erp-cell-primary">
                          {formatINR(w.dailyWage)} / day
                        </td>
                        <td className="is-right">
                          <div className="erp-table-actions">
                            {/* Primary 1-Tap Cycling Status Pill */}
                            <button
                              type="button"
                              disabled={isSaving}
                              onClick={() => {
                                const nextOrder: AttendanceStatus[] = ['present', 'half_day', 'overtime', 'leave', 'absent'];
                                const curIdx = status ? nextOrder.indexOf(status) : -1;
                                const nextSt = nextOrder[(curIdx + 1) % nextOrder.length];
                                handleMarkStatus(w, nextSt);
                              }}
                              data-status={status || 'unmarked'}
                              className="attendance-status-pill-btn"
                              title={`Click to cycle status (Current: ${statusMeta?.label || 'Not Marked'})`}
                            >
                              <span className="attendance-status-dot" />
                              <span>{statusMeta?.label || 'Not Marked'}</span>
                            </button>

                            {/* Streamlined 1-Tap Status Selector Cluster */}
                            <div className="attendance-quick-cycle-cluster">
                              {(['present', 'half_day', 'overtime', 'leave', 'absent'] as AttendanceStatus[]).map(st => {
                                const isCurrent = status === st;
                                const meta = ATTENDANCE_STATUS_META[st];
                                return (
                                  <button
                                    key={st}
                                    type="button"
                                    disabled={isSaving}
                                    onClick={() => handleMarkStatus(w, st)}
                                    title={`Mark as ${meta.label}`}
                                    className={`attendance-mini-status-btn ${isCurrent ? `active-${st}` : ''}`}
                                  >
                                    {meta.short}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  <VirtualTableSpacer colSpan={4} height={dailyWorkerWindow.bottomSpacerPx} />
                  </>
                )}
              </tbody>
            </table>
          </div>

          {/* Simplified Mobile Worker Roster Cards (< 768px) */}
          <div ref={dailyMobileWindow.containerRef} className="attendance-mobile-roster">
            {filteredWorkers.length === 0 ? (
              <div className="erp-empty-cell">
                <Users size={32} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
                <div className="erp-cell-primary">No personnel enrolled</div>
              </div>
            ) : (
              <>
              <VirtualListSpacer height={dailyMobileWindow.topSpacerPx} />
              {filteredWorkers.slice(dailyMobileWindow.startIndex, dailyMobileWindow.endIndex).map(w => {
                const mark = dayMarks.get(w.id);
                const status = mark?.status;
                const isSaving = savingWorkerId === w.id;
                const statusMeta = status ? ATTENDANCE_STATUS_META[status] : null;

                return (
                  <div key={w.id} className="attendance-worker-card">
                    <div className="attendance-worker-card-header">
                      <div className="attendance-worker-card-info">
                        <div className="attendance-worker-avatar-circle">
                          {w.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="attendance-worker-card-meta">
                          <span className="attendance-worker-card-name">{w.name}</span>
                          <span className="attendance-worker-card-sub">
                            <span className="attendance-role-pill">
                              {w.category}
                            </span>
                            <span>{formatINR(w.dailyWage)}/day</span>
                          </span>
                        </div>
                      </div>

                      {/* Prominent Mobile Cycling Status Pill */}
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={() => {
                          const nextOrder: AttendanceStatus[] = ['present', 'half_day', 'overtime', 'leave', 'absent'];
                          const curIdx = status ? nextOrder.indexOf(status) : -1;
                          const nextSt = nextOrder[(curIdx + 1) % nextOrder.length];
                          handleMarkStatus(w, nextSt);
                        }}
                        data-status={status || 'unmarked'}
                        className="attendance-status-pill-btn"
                        title="Tap to cycle status"
                      >
                        <span className="attendance-status-dot" />
                        <span>{statusMeta?.label || 'Tap to Mark'}</span>
                      </button>
                    </div>

                    {/* Quick 1-Tap Status Options for Mobile */}
                    <div className="attendance-worker-card-actions">
                      <span className="erp-cell-sub">Quick Mark:</span>
                      <div className="attendance-quick-cycle-cluster">
                        {(['present', 'half_day', 'overtime', 'leave', 'absent'] as AttendanceStatus[]).map(st => {
                          const isCurrent = status === st;
                          const meta = ATTENDANCE_STATUS_META[st];
                          return (
                            <button
                              key={st}
                              type="button"
                              disabled={isSaving}
                              onClick={() => handleMarkStatus(w, st)}
                              title={`Mark ${meta.label}`}
                              className={`attendance-mini-status-btn ${isCurrent ? `active-${st}` : ''}`}
                            >
                              {meta.short}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
              <VirtualListSpacer height={dailyMobileWindow.bottomSpacerPx} />
              </>
            )}
          </div>
        </div>
      )}

      {activeTab === 'corrections' && selectedSiteId && <CorrectionLog siteId={selectedSiteId} workers={workers} />}

      {/* Tab 2: Salary Ledger */}
      {activeTab === 'salary' && (
        <div className="erp-card-panel">
          <div className="attendance-desktop-table">
            <table className="erp-data-table">
              <thead>
                <tr>
                  <th>Worker Name</th>
                  <th>Days Worked</th>
                  <th className="is-right">Total Earned</th>
                  <th className="is-right">Advances (Recov.)</th>
                  <th className="is-right">Salary Paid</th>
                  <th className="is-right">Pending Wage</th>
                  <th className="is-right">Actions</th>
                </tr>
              </thead>
              <tbody ref={salaryWorkerWindow.containerRef}>
                {workers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="erp-empty-cell">
                      <IndianRupee size={36} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
                      <div className="erp-cell-primary">No salary records available</div>
                    </td>
                  </tr>
                ) : (
                  <>
                  <VirtualTableSpacer colSpan={7} height={salaryWorkerWindow.topSpacerPx} />
                  {workers.slice(salaryWorkerWindow.startIndex, salaryWorkerWindow.endIndex).map(w => {
                    const workerAttendance = attendance.filter(a => a.workerId === w.id);
                    const workerAdvances = advances.filter(a => a.workerId === w.id);
                    const workerPayments = salaryPayments.filter(s => s.workerId === w.id);
                    const ledger = buildWorkerLedger(w, workerAttendance, workerAdvances, workerPayments, policy);
                    const isSelected = selectedWorkerForAction === w.id;
                    const isRecentlyUpdated = lastPaidWorkerId === w.id;

                    return (
                      <tr
                        key={w.id}
                        id={`salary-table-row-${w.id}`}
                        className={isRecentlyUpdated ? 'salary-table-row-updated' : isSelected ? 'salary-table-row-selected' : undefined}
                      >
                        <td>
                          <div className="att-controls-left">
                            <span className="erp-cell-primary">{w.name}</span>
                            {isRecentlyUpdated && (
                              <span className="att-wage-badge att-wage-badge--paid">
                                ✓ Payment Updated
                              </span>
                            )}
                          </div>
                          <div className="erp-cell-sub">
                            {w.category} · {formatINR(w.dailyWage)}/day
                          </div>
                        </td>
                        <td>
                          {ledger.workedDayEquivalents} days
                        </td>
                        <td className="is-right erp-cell-primary">
                          {formatINR(ledger.earned)}
                        </td>
                        <td className="is-right erp-cell-warning">
                          {formatINR(ledger.recoverableAdvances)}
                        </td>
                        <td className="is-right erp-cell-success">
                          {formatINR(ledger.salaryPaid)}
                        </td>
                        <td className="is-right">
                          <span className={ledger.pending > 0 ? 'erp-cell-danger' : 'erp-cell-success'}>
                            {formatINR(ledger.pending)}
                          </span>
                        </td>
                        <td className="is-right">
                          <div className="erp-table-actions">
                            <button
                              id={`salary-pay-btn-${w.id}`}
                              onClick={() => {
                                setSelectedWorkerForAction(w.id);
                                setSalaryToEdit(null);
                                setIsSalaryModalOpen(true);
                              }}
                              className="erp-btn-table-action erp-btn-table-action--success-outline"
                            >
                              Pay Wage
                            </button>
                            <button
                              id={`salary-advance-btn-${w.id}`}
                              onClick={() => {
                                setSelectedWorkerForAction(w.id);
                                setAdvanceToEdit(null);
                                setIsAdvanceModalOpen(true);
                              }}
                              className="erp-btn-table-action erp-btn-table-action--warning"
                            >
                              Advance
                            </button>
                            <button
                              id={`salary-slip-btn-${w.id}`}
                              onClick={() => {
                                setSelectedWorkerForSlip(w);
                                setIsWageSlipModalOpen(true);
                              }}
                              className="erp-btn-table-action erp-btn-table-action--charcoal-outline"
                              title="1-Click Printable Wage Slip"
                            >
                              <Printer size={14} />
                              <span>Slip</span>
                            </button>
                            <button
                              id={`salary-pdf-btn-${w.id}`}
                              onClick={() => {
                                setPdfWorkerId(w.id);
                                setIsAttendancePdfModalOpen(true);
                              }}
                              className="erp-btn-table-action erp-btn-table-action--charcoal-outline"
                              title="Monthly Attendance & Wage PDF"
                            >
                              <FileText size={14} />
                              <span>PDF</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  <VirtualTableSpacer colSpan={7} height={salaryWorkerWindow.bottomSpacerPx} />
                  </>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View (<= 768px - Requirement 4) */}
          <div ref={salaryMobileWindow.containerRef} className="attendance-mobile-cards">
            {workers.length === 0 ? (
              <div className="erp-empty-cell">
                No worker salary records available
              </div>
            ) : (
              <>
              <VirtualListSpacer height={salaryMobileWindow.topSpacerPx} />
              {workers.slice(salaryMobileWindow.startIndex, salaryMobileWindow.endIndex).map(w => {
                const workerAttendance = attendance.filter(a => a.workerId === w.id);
                const workerAdvances = advances.filter(a => a.workerId === w.id);
                const workerPayments = salaryPayments.filter(s => s.workerId === w.id);
                const ledger = buildWorkerLedger(w, workerAttendance, workerAdvances, workerPayments, policy);
                const isSelected = selectedWorkerForAction === w.id;
                const isRecentlyUpdated = lastPaidWorkerId === w.id;

                return (
                  <div
                    key={w.id}
                    id={`salary-mobile-card-${w.id}`}
                    className={`salary-mobile-card ${isSelected ? 'selected is-selected' : ''} ${isRecentlyUpdated ? 'is-updated' : ''}`.trim()}
                  >
                    <div className="erp-view-header">
                      <div>
                        <strong className="erp-cell-primary">
                          {w.name}
                          {isRecentlyUpdated && (
                            <span className="att-wage-badge att-wage-badge--paid">
                              ✓ Payment Updated
                            </span>
                          )}
                        </strong>
                        <span className="erp-cell-sub" style={{ display: 'block' }}>
                          {w.category} · {formatINR(w.dailyWage)}/day · {ledger.workedDayEquivalents} days
                        </span>
                      </div>
                      <div className="is-right">
                        <span className="erp-stat-label" style={{ display: 'block' }}>
                          Pending Due
                        </span>
                        <strong className={ledger.pending > 0 ? 'erp-cell-danger' : 'erp-cell-success'}>
                          {formatINR(ledger.pending)}
                        </strong>
                      </div>
                    </div>

                    <div className="salary-mobile-grid">
                      <div>
                        <span className="erp-cell-sub" style={{ display: 'block' }}>Earned</span>
                        <strong className="erp-cell-primary">{formatINR(ledger.earned)}</strong>
                      </div>
                      <div>
                        <span className="erp-cell-sub" style={{ display: 'block' }}>Advances</span>
                        <strong className="erp-cell-warning">{formatINR(ledger.recoverableAdvances)}</strong>
                      </div>
                      <div>
                        <span className="erp-cell-sub" style={{ display: 'block' }}>Paid</span>
                        <strong className="erp-cell-success">{formatINR(ledger.salaryPaid)}</strong>
                      </div>
                    </div>

                    <div className="m-btn-row">
                      <button
                        type="button"
                        id={`mobile-pay-wage-${w.id}`}
                        onClick={() => {
                          setSelectedWorkerForAction(w.id);
                          setSalaryToEdit(null);
                          setIsSalaryModalOpen(true);
                        }}
                        className="erp-btn-table-action erp-btn-table-action--success-outline"
                      >
                        Pay Wage
                      </button>
                      <button
                        type="button"
                        id={`mobile-pay-advance-${w.id}`}
                        onClick={() => {
                          setSelectedWorkerForAction(w.id);
                          setAdvanceToEdit(null);
                          setIsAdvanceModalOpen(true);
                        }}
                        className="erp-btn-table-action erp-btn-table-action--warning"
                      >
                        Advance
                      </button>
                      <button
                        type="button"
                        id={`mobile-wage-slip-${w.id}`}
                        onClick={() => {
                          setSelectedWorkerForSlip(w);
                          setIsWageSlipModalOpen(true);
                        }}
                        className="erp-btn-table-action erp-btn-table-action--charcoal-outline"
                      >
                        <Printer size={14} />
                        <span>Slip</span>
                      </button>
                      <button
                        type="button"
                        id={`mobile-attendance-pdf-${w.id}`}
                        onClick={() => {
                          setPdfWorkerId(w.id);
                          setIsAttendancePdfModalOpen(true);
                        }}
                        className="erp-btn-table-action erp-btn-table-action--charcoal-outline"
                      >
                        <FileText size={14} />
                        <span>PDF</span>
                      </button>
                    </div>
                  </div>
                );
              })}
              <VirtualListSpacer height={salaryMobileWindow.bottomSpacerPx} />
              </>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Advances History */}
      {activeTab === 'advances' && (
        <div className="erp-card-panel">
          <div className="attendance-desktop-table">
            <table className="erp-data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Worker Name</th>
                  <th>Advance Type</th>
                  <th>Reason / Purpose</th>
                  <th className="is-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {advances.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="erp-empty-cell">
                      <DollarSign size={36} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
                      <div className="erp-cell-primary">No advances logged for this site</div>
                    </td>
                  </tr>
                ) : (
                  advances.map(a => {
                    const w = workers.find(work => work.id === a.workerId);
                    return (
                      <tr key={a.id}>
                        <td className="erp-cell-muted">{formatDay(a.date)}</td>
                        <td className="erp-cell-primary">{w?.name || 'Worker'}</td>
                        <td>
                          <span
                            className={`erp-badge ${a.advanceType === 'Non-Recoverable' ? 'erp-badge--primary' : 'erp-badge--warning'}`}
                          >
                            {a.advanceType || 'Recoverable'}
                          </span>
                        </td>
                        <td>{a.reason || 'Weekly advance'}</td>
                        <td className="is-right erp-cell-danger">
                          {formatINR(a.amount)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Advances Cards (<= 768px - Requirement 4) */}
          <div className="attendance-mobile-cards">
            {advances.length === 0 ? (
              <div className="erp-empty-cell">
                No advances logged for this site
              </div>
            ) : (
              advances.map(a => {
                const w = workers.find(work => work.id === a.workerId);
                return (
                  <div key={a.id} className="att-advance-card">
                    <div>
                      <strong className="erp-cell-primary" style={{ display: 'block' }}>{w?.name || 'Worker'}</strong>
                      <span className="erp-cell-sub">{formatDay(a.date)} · {a.reason || 'Weekly advance'}</span>
                    </div>
                    <div className="att-controls-left">
                      <span
                        className={`erp-badge ${a.advanceType === 'Non-Recoverable' ? 'erp-badge--primary' : 'erp-badge--warning'}`}
                      >
                        {a.advanceType || 'Recoverable'}
                      </span>
                      <span className="erp-cell-danger">
                        {formatINR(a.amount)}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Tab 4: Worker Roster */}
      {activeTab === 'roster' && (
        <div className="erp-card-panel">
          <div className="attendance-desktop-table">
            <table className="erp-data-table">
              <thead>
                <tr>
                  <th>Personnel Name</th>
                  <th>Designation / Skill</th>
                  <th>Phone</th>
                  <th>Joining Date</th>
                  <th className="is-right">Daily Wage</th>
                  <th className="is-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {workers.map(w => (
                  <tr key={w.id}>
                    <td className="erp-cell-primary">{w.name}</td>
                    <td>{w.category}</td>
                    <td className="erp-cell-muted">{w.phone || '—'}</td>
                    <td className="erp-cell-muted">{w.joiningDate ? formatDay(w.joiningDate) : '—'}</td>
                    <td className="is-right erp-cell-primary">
                      {formatINR(w.dailyWage)}
                    </td>
                    <td className="is-right">
                      <button
                        onClick={() => {
                          setWorkerToEdit(w);
                          setIsWorkerModalOpen(true);
                        }}
                        className="erp-btn-table-action erp-btn-table-action--charcoal-outline"
                      >
                        Edit Profile
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Roster Cards (<= 768px - Requirement 4) */}
          <div className="attendance-mobile-cards">
            {workers.map(w => (
              <div key={w.id} className="salary-mobile-card">
                <div className="erp-view-header">
                  <div>
                    <strong className="erp-cell-primary" style={{ display: 'block' }}>{w.name}</strong>
                    <span className="erp-cell-sub" style={{ display: 'block' }}>
                      {w.category} · Phone: {w.phone || '—'}
                    </span>
                    <span className="erp-cell-primary" style={{ display: 'block', marginTop: '2px' }}>
                      {formatINR(w.dailyWage)} / day
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setWorkerToEdit(w);
                      setIsWorkerModalOpen(true);
                    }}
                    className="erp-btn-table-action erp-btn-table-action--charcoal-outline"
                  >
                    Edit Profile
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Attendance Modal */}
      <AttendanceModal
        isOpen={isAttendanceModalOpen}
        siteId={selectedSiteId}
        workers={workers}
        onClose={() => setIsAttendanceModalOpen(false)}
        onSuccess={msg => onNotify(msg, 'success')}
      />

      {/* Worker Modal */}
      <WorkerModal
        isOpen={isWorkerModalOpen}
        siteId={selectedSiteId}
        workerToEdit={workerToEdit}
        onClose={() => setIsWorkerModalOpen(false)}
        onSuccess={msg => onNotify(msg, 'success')}
      />

      {/* Advance Modal */}
      <AdvanceModal
        isOpen={isAdvanceModalOpen}
        siteId={selectedSiteId}
        workers={workers}
        advanceToEdit={advanceToEdit}
        initialWorkerId={selectedWorkerForAction}
        onClose={() => setIsAdvanceModalOpen(false)}
        onSuccess={handlePaymentSuccess}
      />

      {/* Salary Modal */}
      <SalaryPaymentModal
        isOpen={isSalaryModalOpen}
        siteId={selectedSiteId}
        workers={workers}
        attendance={attendance}
        advances={advances}
        pastPayments={salaryPayments}
        paymentToEdit={salaryToEdit}
        initialWorkerId={selectedWorkerForAction}
        onClose={() => setIsSalaryModalOpen(false)}
        onSuccess={handlePaymentSuccess}
      />

      {/* 1-Click Printable Wage Slip Modal */}
      <WageSlipModal
        isOpen={isWageSlipModalOpen}
        onClose={() => {
          setIsWageSlipModalOpen(false);
          setSelectedWorkerForSlip(null);
        }}
        worker={selectedWorkerForSlip}
        projectId={selectedSiteId}
        siteName={sites.find(s => s.id === selectedSiteId)?.name || `${APP_NAME} Project`}
        month={selectedMonth}
        leavePaid={activeSite?.leavePaid}
        attendance={attendance}
        advances={advances}
        salaryPayments={salaryPayments}
      />

      {/* Monthly Worker Attendance & Wage PDF Modal */}
      <WorkerAttendancePdfModal
        isOpen={isAttendancePdfModalOpen}
        onClose={() => {
          setIsAttendancePdfModalOpen(false);
          setPdfWorkerId(null);
        }}
        siteId={selectedSiteId}
        siteName={activeSite?.name || `${APP_NAME} Project`}
        leavePaid={activeSite?.leavePaid}
        workers={workers}
        attendance={attendance}
        advances={advances}
        salaryPayments={salaryPayments}
        initialWorkerId={pdfWorkerId || selectedWorkerForAction}
        initialMonth={selectedMonth}
        onNotify={onNotify}
      />
    </div>
  );
};
