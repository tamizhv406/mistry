import React, { useState, useMemo } from 'react';
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
import { markAttendance, setLeavePolicy } from '../services/records';
import { AttendanceModal } from '../components/AttendanceModal';
import { WorkerModal } from '../components/WorkerModal';
import { AdvanceModal } from '../components/AdvanceModal';
import { SalaryPaymentModal } from '../components/SalaryPaymentModal';
import { generateLabourSalaryReportPdfBlob, downloadFile } from '../utils/pdfGenerator';

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
  // Current Site Selection
  const [selectedSiteId, setSelectedSiteId] = useState<string>(initialSiteId || (sites[0]?.id || ''));

  // View state
  const [activeTab, setActiveTab] = useState<'attendance' | 'salary' | 'roster' | 'advances'>('attendance');
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
    let failed = 0;
    for (const w of unmarkedWorkers) {
      const res = await markAttendance(user, selectedSiteId, w, selectedDate, 'present');
      if (!res.ok) failed++;
    }
    setBulkBusy(false);
    if (failed > 0) {
      onNotify(`${failed} worker(s) could not be marked.`, 'error');
    } else {
      onNotify(`${unmarkedWorkers.length} worker(s) marked Present for ${formatDay(selectedDate)}.`, 'success');
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
    try {
      const items = (workers || []).map(w => {
        const workerAttendance = (attendance || []).filter(a => a.workerId === w.id);
        const workerAdvances = (advances || []).filter(a => a.workerId === w.id);
        const workerPayments = (salaryPayments || []).filter(s => s.workerId === w.id);
        const ledger = buildWorkerLedger(w, workerAttendance, workerAdvances, workerPayments, policy);
        return {
          workerName: w.name,
          category: w.category,
          dailyRate: w.dailyWage,
          workedDays: ledger.workedDayEquivalents,
          earnedAmount: ledger.earned,
          advanceDeducted: ledger.recoverableAdvances,
          salaryPaid: ledger.salaryPaid,
          balanceDue: ledger.pending,
        };
      });

      const totalWorkers = items.length;
      const totalDaysWorked = items.reduce((sum, i) => sum + i.workedDays, 0);
      const totalEarned = items.reduce((sum, i) => sum + i.earnedAmount, 0);
      const totalAdvance = items.reduce((sum, i) => sum + i.advanceDeducted, 0);
      const totalPaid = items.reduce((sum, i) => sum + i.salaryPaid, 0);
      const totalBalanceDue = items.reduce((sum, i) => sum + i.balanceDue, 0);

      const blob = generateLabourSalaryReportPdfBlob({
        projectName: activeSite?.name || 'Project Workforce',
        projectAddress: activeSite?.address || activeSite?.area,
        monthName: formatMonth(selectedMonth),
        generatedDate: formatDay(todayKey()),
        totalWorkers,
        totalDaysWorked,
        totalEarned,
        totalAdvance,
        totalPaid,
        totalBalanceDue,
        items,
      });

      const cleanProjName = (activeSite?.name || 'Project').replace(/[^a-zA-Z0-9_-]/g, '_');
      downloadFile(blob, `Muster_Roll_${cleanProjName}_${selectedMonth}.pdf`);
      onNotify('Workforce Muster Roll & Salary Statement PDF downloaded successfully', 'success');
    } catch (err: any) {
      console.error('Failed to export Muster PDF:', err);
      window.print();
    }
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1440px', margin: '0 auto', color: '#0F172A' }}>
      {/* Top Header & Actions */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          marginBottom: '24px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              backgroundColor: '#EFF6FF',
              color: '#2563EB',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Users size={22} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.02em' }}>
              Attendance & Salary Management
            </h1>
            <p style={{ margin: 0, fontSize: '0.875rem', color: '#64748B' }}>
              Real-time worker roster, daily muster roll, wages, recoverable advances and salary disbursement.
            </p>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <button
            onClick={handleExportPDF}
            style={{
              padding: '9px 16px',
              borderRadius: '8px',
              border: '1px solid #CBD5E1',
              backgroundColor: '#FFFFFF',
              color: '#334155',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
            }}
          >
            <Download size={16} />
            <span>Export Muster PDF</span>
          </button>

          <button
            onClick={() => {
              setAdvanceToEdit(null);
              setIsAdvanceModalOpen(true);
            }}
            style={{
              padding: '9px 16px',
              borderRadius: '8px',
              border: '1px solid #CBD5E1',
              backgroundColor: '#FFFFFF',
              color: '#334155',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
            }}
          >
            <DollarSign size={16} color="#F59E0B" />
            <span>Pay Advance</span>
          </button>

          <button
            onClick={() => {
              setSalaryToEdit(null);
              setIsSalaryModalOpen(true);
            }}
            style={{
              padding: '9px 16px',
              borderRadius: '8px',
              border: '1px solid #CBD5E1',
              backgroundColor: '#FFFFFF',
              color: '#334155',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
            }}
          >
            <IndianRupee size={16} color="#16A34A" />
            <span>Disburse Salary</span>
          </button>

          <button
            onClick={() => {
              setWorkerToEdit(null);
              setIsWorkerModalOpen(true);
            }}
            style={{
              padding: '9px 18px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: '#2563EB',
              color: '#FFFFFF',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.25)',
            }}
          >
            <PlusCircle size={18} />
            <span>+ Add Worker</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
          marginBottom: '24px',
        }}
      >
        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            border: '1px solid #E2E8F0',
            padding: '18px 20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748B' }}>TOTAL WORKERS</span>
            <Users size={18} color="#2563EB" />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0F172A' }}>{workers.length}</div>
          <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '4px' }}>Active site personnel</div>
        </div>

        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            border: '1px solid #E2E8F0',
            padding: '18px 20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748B' }}>PRESENT TODAY</span>
            <CheckCircle2 size={18} color="#16A34A" />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#16A34A' }}>
            {dayCounts.present + dayCounts.overtime}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '4px' }}>
            {dayCounts.overtime > 0 ? `Includes ${dayCounts.overtime} overtime shifts` : 'Full day attendance'}
          </div>
        </div>

        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            border: '1px solid #E2E8F0',
            padding: '18px 20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748B' }}>ABSENT / HALF-DAY</span>
            <XCircle size={18} color="#DC2626" />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: dayCounts.absent > 0 ? '#DC2626' : '#0F172A' }}>
            {dayCounts.absent} <span style={{ fontSize: '1rem', color: '#64748B', fontWeight: 500 }}>({dayCounts.half_day} half)</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '4px' }}>Non-productive attendance</div>
        </div>

        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            border: '1px solid #E2E8F0',
            padding: '18px 20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748B' }}>ON LEAVE</span>
            <Clock size={18} color="#F59E0B" />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: dayCounts.leave > 0 ? '#D97706' : '#0F172A' }}>
            {dayCounts.leave}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '4px' }}>
            Policy: {activeSite?.leavePaid ? 'Paid Leave' : 'Unpaid Leave'}
          </div>
        </div>

        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            border: '1px solid #E2E8F0',
            padding: '18px 20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748B' }}>PENDING WAGES</span>
            <IndianRupee size={18} color="#7C3AED" />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#7C3AED' }}>
            {formatINR(siteLabourSummary?.pending || 0)}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '4px' }}>
            Earned: {formatINR(siteLabourSummary?.earned || 0)}
          </div>
        </div>
      </div>

      {/* Control Bar: Project Selector, Date Picker, Search & View Tabs */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '12px',
          border: '1px solid #E2E8F0',
          padding: '16px 20px',
          marginBottom: '20px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', flex: 1 }}>
          {/* Site Selector */}
          <div style={{ minWidth: '180px' }}>
            <select
              value={selectedSiteId}
              onChange={e => setSelectedSiteId(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                fontSize: '0.875rem',
                backgroundColor: '#F8FAFC',
                fontWeight: 600,
                color: '#1E293B',
                outline: 'none',
              }}
            >
              {sites.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Date Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                fontSize: '0.875rem',
                outline: 'none',
                fontWeight: 600,
                color: '#334155',
              }}
            />
            {selectedDate !== todayKey() && (
              <button
                onClick={() => setSelectedDate(todayKey())}
                style={{
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  backgroundColor: '#FFFFFF',
                  color: '#2563EB',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Today
              </button>
            )}
          </div>

          {/* Search */}
          <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
            <Search
              size={16}
              style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }}
            />
            <input
              type="text"
              placeholder="Search worker by name, role or phone..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px 9px 36px',
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                fontSize: '0.875rem',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Status Filter */}
          <div style={{ minWidth: '130px' }}>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                fontSize: '0.875rem',
                backgroundColor: '#FFFFFF',
                color: '#334155',
                outline: 'none',
              }}
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
        <div style={{ display: 'flex', backgroundColor: '#F1F5F9', borderRadius: '8px', padding: '3px' }}>
          {[
            { id: 'attendance', label: 'Daily Attendance' },
            { id: 'salary', label: 'Salary Ledger' },
            { id: 'advances', label: 'Advances History' },
            { id: 'roster', label: 'Worker Roster' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                padding: '7px 14px',
                borderRadius: '6px',
                border: 'none',
                fontSize: '0.825rem',
                fontWeight: 600,
                cursor: 'pointer',
                backgroundColor: activeTab === tab.id ? '#FFFFFF' : 'transparent',
                color: activeTab === tab.id ? '#0F172A' : '#64748B',
                boxShadow: activeTab === tab.id ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Leave Pay Policy Banner */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '10px',
          border: '1px solid #E2E8F0',
          padding: '12px 20px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Sparkles size={18} color="#2563EB" />
          <div>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0F172A' }}>
              Project Leave Pay Policy: {activeSite?.leavePaid ? 'Leaves are Paid' : 'Leaves are Unpaid (Standard)'}
            </span>
            <div style={{ fontSize: '0.75rem', color: '#64748B' }}>
              Configurable per site. If paid, 1 full day wage is earned on approved leave days.
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={() => handleToggleLeavePolicy(!activeSite?.leavePaid)}
            style={{
              padding: '6px 14px',
              borderRadius: '6px',
              border: '1px solid #CBD5E1',
              backgroundColor: '#F8FAFC',
              color: '#334155',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Switch to {activeSite?.leavePaid ? 'Unpaid Leaves' : 'Paid Leaves'}
          </button>

          {unmarkedWorkers.length > 0 && activeTab === 'attendance' && (
            <button
              onClick={handleBulkMarkPresent}
              disabled={bulkBusy}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: '#16A34A',
                color: '#FFFFFF',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <CheckCircle2 size={15} />
              <span>{bulkBusy ? 'Marking...' : `Mark All ${unmarkedWorkers.length} Unmarked Present`}</span>
            </button>
          )}
        </div>
      </div>

      {/* Tab 1: Daily Attendance Table */}
      {activeTab === 'attendance' && (
        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            border: '1px solid #E2E8F0',
            overflow: 'hidden',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}
        >
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  <th style={{ padding: '14px 18px', fontWeight: 700 }}>Worker Name & ID</th>
                  <th style={{ padding: '14px 18px', fontWeight: 700 }}>Role</th>
                  <th style={{ padding: '14px 18px', fontWeight: 700 }}>Daily Wage</th>
                  <th style={{ padding: '14px 18px', fontWeight: 700 }}>Status for {formatDay(selectedDate)}</th>
                  <th style={{ padding: '14px 18px', fontWeight: 700, textAlign: 'right' }}>Quick Mark Attendance</th>
                </tr>
              </thead>
              <tbody>
                {filteredWorkers.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: '48px 24px', textAlign: 'center', color: '#94A3B8' }}>
                      <Users size={36} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
                      <div style={{ fontSize: '1rem', fontWeight: 600, color: '#475569' }}>No personnel found for this site</div>
                      <div style={{ fontSize: '0.825rem', marginTop: '4px' }}>Click "+ Add Worker" to enroll personnel.</div>
                    </td>
                  </tr>
                ) : (
                  filteredWorkers.map(w => {
                    const mark = dayMarks.get(w.id);
                    const status = mark?.status;
                    const isSaving = savingWorkerId === w.id;

                    return (
                      <tr
                        key={w.id}
                        style={{
                          borderBottom: '1px solid #F1F5F9',
                          transition: 'background-color 0.15s ease',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#F8FAFC')}
                        onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                      >
                        <td style={{ padding: '14px 18px', fontWeight: 600, color: '#0F172A' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div
                              style={{
                                width: '36px',
                                height: '36px',
                                borderRadius: '50%',
                                backgroundColor: '#E2E8F0',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 700,
                                color: '#475569',
                                fontSize: '0.85rem',
                              }}
                            >
                              {w.name.slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <div>{w.name}</div>
                              <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 400 }}>
                                ID: #{w.id.slice(-6).toUpperCase()} · {w.phone || 'No phone'}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '14px 18px' }}>
                          <span
                            style={{
                              padding: '4px 8px',
                              borderRadius: '6px',
                              backgroundColor: '#EFF6FF',
                              color: '#1D4ED8',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                            }}
                          >
                            {w.category}
                          </span>
                        </td>
                        <td style={{ padding: '14px 18px', fontWeight: 600, color: '#334155' }}>
                          {formatINR(w.dailyWage)} / day
                        </td>
                        <td style={{ padding: '14px 18px' }}>
                          {status ? (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '4px 10px',
                                borderRadius: '999px',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                backgroundColor:
                                  status === 'present'
                                    ? '#DCFCE7'
                                    : status === 'overtime'
                                    ? '#EDE9FE'
                                    : status === 'half_day'
                                    ? '#FEF3C7'
                                    : status === 'leave'
                                    ? '#EFF6FF'
                                    : '#FEE2E2',
                                color:
                                  status === 'present'
                                    ? '#166534'
                                    : status === 'overtime'
                                    ? '#6D28D9'
                                    : status === 'half_day'
                                    ? '#92400E'
                                    : status === 'leave'
                                    ? '#1E40AF'
                                    : '#991B1B',
                              }}
                            >
                              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'currentColor' }} />
                              {ATTENDANCE_STATUS_META[status]?.label || status}
                            </span>
                          ) : (
                            <span style={{ fontSize: '0.75rem', color: '#94A3B8', fontWeight: 500 }}>
                              Not Marked Yet
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
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
                                  style={{
                                    padding: '5px 9px',
                                    borderRadius: '6px',
                                    fontSize: '0.72rem',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    border: isCurrent ? '2px solid #2563EB' : '1px solid #CBD5E1',
                                    backgroundColor: isCurrent ? '#EFF6FF' : '#FFFFFF',
                                    color: isCurrent ? '#1D4ED8' : '#475569',
                                    transition: 'all 0.12s ease',
                                  }}
                                >
                                  {meta.short}
                                </button>
                              );
                            })}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Salary Ledger */}
      {activeTab === 'salary' && (
        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            border: '1px solid #E2E8F0',
            overflow: 'hidden',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}
        >
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  <th style={{ padding: '14px 18px', fontWeight: 700 }}>Worker Name</th>
                  <th style={{ padding: '14px 18px', fontWeight: 700 }}>Days Worked</th>
                  <th style={{ padding: '14px 18px', fontWeight: 700, textAlign: 'right' }}>Total Earned</th>
                  <th style={{ padding: '14px 18px', fontWeight: 700, textAlign: 'right' }}>Advances (Recov.)</th>
                  <th style={{ padding: '14px 18px', fontWeight: 700, textAlign: 'right' }}>Salary Paid</th>
                  <th style={{ padding: '14px 18px', fontWeight: 700, textAlign: 'right' }}>Pending Wage</th>
                  <th style={{ padding: '14px 18px', fontWeight: 700, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {workers.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: '48px 24px', textAlign: 'center', color: '#94A3B8' }}>
                      <IndianRupee size={36} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
                      <div style={{ fontSize: '1rem', fontWeight: 600, color: '#475569' }}>No salary records available</div>
                    </td>
                  </tr>
                ) : (
                  workers.map(w => {
                    const workerAttendance = attendance.filter(a => a.workerId === w.id);
                    const workerAdvances = advances.filter(a => a.workerId === w.id);
                    const workerPayments = salaryPayments.filter(s => s.workerId === w.id);
                    const ledger = buildWorkerLedger(w, workerAttendance, workerAdvances, workerPayments, policy);

                    return (
                      <tr key={w.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '14px 18px', fontWeight: 600, color: '#0F172A' }}>
                          <div>{w.name}</div>
                          <div style={{ fontSize: '0.75rem', color: '#64748B' }}>
                            {w.category} · {formatINR(w.dailyWage)}/day
                          </div>
                        </td>
                        <td style={{ padding: '14px 18px', color: '#334155' }}>
                          {ledger.workedDayEquivalents} days
                        </td>
                        <td style={{ padding: '14px 18px', textAlign: 'right', fontWeight: 600, color: '#0F172A' }}>
                          {formatINR(ledger.earned)}
                        </td>
                        <td style={{ padding: '14px 18px', textAlign: 'right', color: '#D97706', fontWeight: 600 }}>
                          {formatINR(ledger.recoverableAdvances)}
                        </td>
                        <td style={{ padding: '14px 18px', textAlign: 'right', color: '#16A34A', fontWeight: 600 }}>
                          {formatINR(ledger.salaryPaid)}
                        </td>
                        <td style={{ padding: '14px 18px', textAlign: 'right', fontWeight: 700, fontSize: '0.95rem' }}>
                          <span style={{ color: ledger.pending > 0 ? '#DC2626' : '#16A34A' }}>
                            {formatINR(ledger.pending)}
                          </span>
                        </td>
                        <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                            <button
                              onClick={() => {
                                setSalaryToEdit(null);
                                setIsSalaryModalOpen(true);
                              }}
                              style={{
                                padding: '6px 10px',
                                borderRadius: '6px',
                                border: '1px solid #CBD5E1',
                                backgroundColor: '#FFFFFF',
                                color: '#16A34A',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              Pay Wage
                            </button>
                            <button
                              onClick={() => {
                                setAdvanceToEdit(null);
                                setIsAdvanceModalOpen(true);
                              }}
                              style={{
                                padding: '6px 10px',
                                borderRadius: '6px',
                                border: '1px solid #CBD5E1',
                                backgroundColor: '#FFFFFF',
                                color: '#D97706',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              Advance
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Advances History */}
      {activeTab === 'advances' && (
        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            border: '1px solid #E2E8F0',
            overflow: 'hidden',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}
        >
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  <th style={{ padding: '14px 18px', fontWeight: 700 }}>Date</th>
                  <th style={{ padding: '14px 18px', fontWeight: 700 }}>Worker Name</th>
                  <th style={{ padding: '14px 18px', fontWeight: 700 }}>Advance Type</th>
                  <th style={{ padding: '14px 18px', fontWeight: 700 }}>Reason / Purpose</th>
                  <th style={{ padding: '14px 18px', fontWeight: 700, textAlign: 'right' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {advances.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: '48px 24px', textAlign: 'center', color: '#94A3B8' }}>
                      <DollarSign size={36} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
                      <div style={{ fontSize: '1rem', fontWeight: 600, color: '#475569' }}>No advances logged for this site</div>
                    </td>
                  </tr>
                ) : (
                  advances.map(a => {
                    const w = workers.find(work => work.id === a.workerId);
                    return (
                      <tr key={a.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '14px 18px', color: '#64748B' }}>{formatDay(a.date)}</td>
                        <td style={{ padding: '14px 18px', fontWeight: 600, color: '#0F172A' }}>{w?.name || 'Worker'}</td>
                        <td style={{ padding: '14px 18px' }}>
                          <span
                            style={{
                              padding: '4px 8px',
                              borderRadius: '6px',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              backgroundColor: a.advanceType === 'Non-Recoverable' ? '#EFF6FF' : '#FEF3C7',
                              color: a.advanceType === 'Non-Recoverable' ? '#1D4ED8' : '#92400E',
                            }}
                          >
                            {a.advanceType || 'Recoverable'}
                          </span>
                        </td>
                        <td style={{ padding: '14px 18px', color: '#334155' }}>{a.reason || 'Weekly advance'}</td>
                        <td style={{ padding: '14px 18px', textAlign: 'right', fontWeight: 700, color: '#DC2626' }}>
                          {formatINR(a.amount)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: Worker Roster */}
      {activeTab === 'roster' && (
        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            border: '1px solid #E2E8F0',
            overflow: 'hidden',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}
        >
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  <th style={{ padding: '14px 18px', fontWeight: 700 }}>Personnel Name</th>
                  <th style={{ padding: '14px 18px', fontWeight: 700 }}>Designation / Skill</th>
                  <th style={{ padding: '14px 18px', fontWeight: 700 }}>Phone</th>
                  <th style={{ padding: '14px 18px', fontWeight: 700 }}>Joining Date</th>
                  <th style={{ padding: '14px 18px', fontWeight: 700, textAlign: 'right' }}>Daily Wage</th>
                  <th style={{ padding: '14px 18px', fontWeight: 700, textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {workers.map(w => (
                  <tr key={w.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td style={{ padding: '14px 18px', fontWeight: 600, color: '#0F172A' }}>{w.name}</td>
                    <td style={{ padding: '14px 18px', color: '#334155' }}>{w.category}</td>
                    <td style={{ padding: '14px 18px', color: '#64748B' }}>{w.phone || '—'}</td>
                    <td style={{ padding: '14px 18px', color: '#64748B' }}>{w.joiningDate ? formatDay(w.joiningDate) : '—'}</td>
                    <td style={{ padding: '14px 18px', textAlign: 'right', fontWeight: 700, color: '#0F172A' }}>
                      {formatINR(w.dailyWage)}
                    </td>
                    <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                      <button
                        onClick={() => {
                          setWorkerToEdit(w);
                          setIsWorkerModalOpen(true);
                        }}
                        style={{
                          padding: '6px 10px',
                          borderRadius: '6px',
                          border: '1px solid #CBD5E1',
                          backgroundColor: '#FFFFFF',
                          color: '#475569',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Edit Profile
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
        onClose={() => setIsAdvanceModalOpen(false)}
        onSuccess={msg => onNotify(msg, 'success')}
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
        onClose={() => setIsSalaryModalOpen(false)}
        onSuccess={msg => onNotify(msg, 'success')}
      />
    </div>
  );
};
