import React, { useState, useEffect } from 'react';
import {
  Users,
  PlusCircle,
  Calendar,
  IndianRupee,
  Coins,
  Edit2,
  Trash2,
  UserCheck,
  Receipt,
  LayoutGrid,
  Table as TableIcon,
  Phone,
  Tag,
  Hash,
} from 'lucide-react';
import type {
  LabourWorker,
  AttendanceRecord,
  LabourAdvance,
  SalaryPayment,
} from '../../db/types';
import { PaymentHistoryModal } from '../../components/PaymentHistoryModal';
import {
  InteractiveHoverCard,
  type InteractiveHoverItem,
} from '../../components/ui/interactive-hover-links';
import { ItemDetailsModal, type DetailField } from '../../components/ui/ItemDetailsModal';
import { getWorkerVisual } from '../../utils/constructionVisuals';

interface LabourTabProps {
  siteId: string;
  workers: LabourWorker[];
  attendance: AttendanceRecord[];
  advances: LabourAdvance[];
  salaryPayments: SalaryPayment[];
  initialSubTab?: 'salary' | 'roster' | 'attendance' | 'advances';
  onOpenWorkerModal: (worker?: LabourWorker) => void;
  onOpenAttendanceModal: () => void;
  onOpenAdvanceModal: (advance?: LabourAdvance) => void;
  onOpenSalaryModal: (payment?: SalaryPayment) => void;
  onDeleteWorker: (worker: LabourWorker) => void;
  onDeleteAttendance: (record: AttendanceRecord) => void;
  onDeleteAdvance: (advance: LabourAdvance) => void;
  onDeleteSalaryPayment: (payment: SalaryPayment) => void;
}

export const LabourTab: React.FC<LabourTabProps> = ({
  siteId,
  workers,
  attendance,
  advances,
  salaryPayments,
  initialSubTab = 'salary',
  onOpenWorkerModal,
  onOpenAttendanceModal,
  onOpenAdvanceModal,
  onOpenSalaryModal,
  onDeleteWorker,
  onDeleteAttendance,
  onDeleteAdvance,
  onDeleteSalaryPayment,
}) => {
  const [subTab, setSubTab] = useState<'salary' | 'roster' | 'attendance' | 'advances'>(initialSubTab);
  const [salaryViewMode, setSalaryViewMode] = useState<'cards' | 'table'>('cards');
  const [selectedWorkerForDetails, setSelectedWorkerForDetails] = useState<LabourWorker | null>(null);
  const [selectedWorkerFilter, setSelectedWorkerFilter] = useState<string>('all');

  // Payment History Modal state
  const [paymentModalData, setPaymentModalData] = useState<{
    isOpen: boolean;
    relatedRecordId: string;
    tableName: 'labourAdvances' | 'salaryPayments';
    title: string;
    subtitle?: string;
    module: string;
    totalAmount: number;
  }>({
    isOpen: false,
    relatedRecordId: '',
    tableName: 'labourAdvances',
    title: '',
    module: 'Labour',
    totalAmount: 0,
  });

  useEffect(() => {
    if (initialSubTab) {
      setSubTab(initialSubTab);
    }
  }, [initialSubTab]);

  // Compute live salary ledger for every worker based on ACTUAL attendance & RECOVERABLE advances!
  const workerLedgers = workers.map(w => {
    const wAtt = attendance.filter(a => a.workerId === w.id);
    const wAdv = advances.filter(a => a.workerId === w.id);
    const wSal = salaryPayments.filter(s => s.workerId === w.id);

    const daysWorked = wAtt.reduce((acc, a) => acc + (a.dayMultiplier || 0), 0);
    const grossSalary = Math.round(daysWorked * (Number(w.dailyWage) || 0));
    
    // STRICT RECOVERABLE LOGIC: Deduct ONLY Recoverable advances from salary balance
    const recoverableAdvances = wAdv.filter(a => a.advanceType !== 'Non-Recoverable');
    const nonRecoverableAdvances = wAdv.filter(a => a.advanceType === 'Non-Recoverable');
    const totalRecoverableAdvance = recoverableAdvances.reduce((acc, a) => acc + (Number(a.amount) || 0), 0);
    const totalNonRecoverableAdvance = nonRecoverableAdvances.reduce((acc, a) => acc + (Number(a.amount) || 0), 0);

    const totalPaid = wSal.reduce((acc, s) => acc + (Number(s.paidAmount) || 0), 0);
    const totalSettled = totalPaid + totalRecoverableAdvance;

    // Financial formulas: no negative balance
    const balanceDue = Math.max(0, grossSalary - totalSettled);
    const extraPaid = Math.max(0, totalSettled - grossSalary);

    return {
      worker: w,
      daysWorked,
      grossSalary,
      totalRecoverableAdvance,
      totalNonRecoverableAdvance,
      totalAdvance: totalRecoverableAdvance, // For legacy display
      totalPaid,
      balanceDue,
      extraPaid,
      pendingBalance: balanceDue,
    };
  });

  const totalGrossAcrossWorkers = workerLedgers.reduce((acc, l) => acc + l.grossSalary, 0);
  const totalRecoverableAcrossWorkers = workerLedgers.reduce((acc, l) => acc + l.totalRecoverableAdvance, 0);
  const totalNonRecoverableAcrossWorkers = workerLedgers.reduce((acc, l) => acc + l.totalNonRecoverableAdvance, 0);
  const totalPaidAcrossWorkers = workerLedgers.reduce((acc, l) => acc + l.totalPaid, 0);
  const totalBalanceDueAcrossWorkers = workerLedgers.reduce((acc, l) => acc + l.balanceDue, 0);
  const totalExtraPaidAcrossWorkers = workerLedgers.reduce((acc, l) => acc + l.extraPaid, 0);

  // Group attendance by date for date-wise view
  const attendanceByDate = attendance.reduce((acc, a) => {
    if (!acc[a.date]) acc[a.date] = [];
    acc[a.date].push(a);
    return acc;
  }, {} as Record<string, AttendanceRecord[]>);

  const sortedDates = Object.keys(attendanceByDate).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
  const workerMap = new Map(workers.map(w => [w.id, w]));

  return (
    <div>
      {/* Sub-tab Navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '10px' }}>
        <div className="sub-tabs" style={{ marginBottom: 0 }}>
          <button
            className={`sub-tab-btn ${subTab === 'salary' ? 'active' : ''}`}
            onClick={() => setSubTab('salary')}
          >
            <Coins size={16} />
            <span>Live Salary Sheet</span>
          </button>
          <button
            className={`sub-tab-btn ${subTab === 'attendance' ? 'active' : ''}`}
            onClick={() => setSubTab('attendance')}
          >
            <Calendar size={16} />
            <span>Attendance Log ({attendance.length})</span>
          </button>
          <button
            className={`sub-tab-btn ${subTab === 'advances' ? 'active' : ''}`}
            onClick={() => setSubTab('advances')}
          >
            <IndianRupee size={16} />
            <span>Labour Advances ({advances.length})</span>
          </button>
          <button
            className={`sub-tab-btn ${subTab === 'roster' ? 'active' : ''}`}
            onClick={() => setSubTab('roster')}
          >
            <Users size={16} />
            <span>Workers Roster ({workers.length})</span>
          </button>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button className="btn btn-outline btn-sm" onClick={() => onOpenAttendanceModal()} disabled={workers.length === 0}>
            <Calendar size={16} />
            <span>Mark Daily Attendance</span>
          </button>
          <button className="btn btn-outline btn-sm" onClick={() => onOpenAdvanceModal()} disabled={workers.length === 0}>
            <IndianRupee size={16} />
            <span>Give Advance</span>
          </button>
          <button className="btn btn-outline btn-sm" onClick={() => onOpenSalaryModal()} disabled={workers.length === 0}>
            <Coins size={16} />
            <span>Disburse Salary</span>
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => onOpenWorkerModal()}>
            <PlusCircle size={16} />
            <span>Add Worker</span>
          </button>
        </div>
      </div>

      {/* SUB-TAB 1: LIVE SALARY SHEET */}
      {subTab === 'salary' && (
        <div>
          {/* Top Summary Banner */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
            gap: '12px',
            marginBottom: '20px',
          }}>
            <div className="metric-card card-primary" style={{ padding: '14px 16px' }}>
              <div className="metric-info">
                <h3>Total Gross Earned</h3>
                <div className="metric-value" style={{ fontSize: '1.4rem' }}>
                  ₹{totalGrossAcrossWorkers.toLocaleString('en-IN')}
                </div>
                <div className="metric-sub">Based on attendance</div>
              </div>
            </div>

            <div className="metric-card card-danger" style={{ padding: '14px 16px' }}>
              <div className="metric-info">
                <h3>Recoverable Advances</h3>
                <div className="metric-value" style={{ fontSize: '1.4rem', color: '#dc2626' }}>
                  ₹{totalRecoverableAcrossWorkers.toLocaleString('en-IN')}
                </div>
                <div className="metric-sub">Deducted from wages</div>
              </div>
            </div>

            {totalNonRecoverableAcrossWorkers > 0 && (
              <div className="metric-card card-warning" style={{ padding: '14px 16px' }}>
                <div className="metric-info">
                  <h3>Non-Rec Grants</h3>
                  <div className="metric-value" style={{ fontSize: '1.4rem', color: '#d97706' }}>
                    ₹{totalNonRecoverableAcrossWorkers.toLocaleString('en-IN')}
                  </div>
                  <div className="metric-sub">Company grants (No return)</div>
                </div>
              </div>
            )}

            <div className="metric-card card-success" style={{ padding: '14px 16px' }}>
              <div className="metric-info">
                <h3>Total Salaries Paid</h3>
                <div className="metric-value" style={{ fontSize: '1.4rem', color: 'var(--success)' }}>
                  ₹{totalPaidAcrossWorkers.toLocaleString('en-IN')}
                </div>
                <div className="metric-sub">Disbursed cash/UPI</div>
              </div>
            </div>

            <div className="metric-card card-primary" style={{ padding: '14px 16px' }}>
              <div className="metric-info">
                <h3>Balance Due</h3>
                <div className="metric-value" style={{ fontSize: '1.4rem', color: totalBalanceDueAcrossWorkers > 0 ? 'var(--danger)' : 'var(--success)' }}>
                  ₹{totalBalanceDueAcrossWorkers.toLocaleString('en-IN')}
                </div>
                <div className="metric-sub">Pending to workers</div>
              </div>
            </div>

            {totalExtraPaidAcrossWorkers > 0 && (
              <div className="metric-card card-info" style={{ padding: '14px 16px' }}>
                <div className="metric-info">
                  <h3>Extra Paid (Advance)</h3>
                  <div className="metric-value" style={{ fontSize: '1.4rem', color: 'var(--primary)' }}>
                    ₹{totalExtraPaidAcrossWorkers.toLocaleString('en-IN')}
                  </div>
                  <div className="metric-sub">Overpaid to workers</div>
                </div>
              </div>
            )}
          </div>

          {/* View Mode Toggle Header */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-2xl border border-slate-800 mb-6">
            <div className="flex items-center gap-2">
              <UserCheck size={20} className="text-amber-400" />
              <span className="font-bold text-sm text-slate-100">
                Workforce Live Salary Ledger (Who is Owed Money)
              </span>
              <span className="text-xs text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full">
                {workers.length} Personnel
              </span>
            </div>

            <div className="flex rounded-xl bg-slate-950 p-1 border border-slate-800">
              <button
                type="button"
                onClick={() => setSalaryViewMode('cards')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                  salaryViewMode === 'cards'
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <LayoutGrid size={14} />
                Visual Worker Cards
              </button>
              <button
                type="button"
                onClick={() => setSalaryViewMode('table')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                  salaryViewMode === 'table'
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <TableIcon size={14} />
                Data Table
              </button>
            </div>
          </div>

          {/* Render Cards or Table based on view mode */}
          {salaryViewMode === 'cards' && (
            <div className="space-y-6 mb-8">
              {(['MISTRY', 'PERIYAAL', 'SITHAAL'] as const).map(catName => {
                const catLedgers = workerLedgers.filter(
                  l => l.worker.category.toUpperCase() === catName
                );
                if (catLedgers.length === 0) return null;

                const catColor =
                  catName === 'MISTRY' ? '#fbbf24' : catName === 'PERIYAAL' ? '#60a5fa' : '#34d399';
                const catIcon = catName === 'MISTRY' ? '👑' : catName === 'PERIYAAL' ? '🧱' : '🧤';

                return (
                  <div key={catName} className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{catIcon}</span>
                      <h5
                        className="text-sm font-bold uppercase tracking-wider"
                        style={{ color: catColor }}
                      >
                        {catName} Category ({catLedgers.length} Workers)
                      </h5>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {catLedgers.map(l => {
                        const vis = getWorkerVisual(l.worker.category, l.worker.imageUrl);
                        const hoverItem: InteractiveHoverItem = {
                          id: l.worker.id,
                          title: l.worker.name,
                          tamilTitle: vis.tamilName,
                          description: `${l.worker.category} • ₹{l.worker.dailyWage}/day • ${l.daysWorked} Days Worked`,
                          imageUrl: l.worker.imageUrl || vis.imageUrl,
                          imageAlt: l.worker.name,
                          badge: `${l.worker.category} • ₹{l.worker.dailyWage}/d`,
                          badgeVariant:
                            catName === 'MISTRY'
                              ? 'primary'
                              : catName === 'PERIYAAL'
                              ? 'info'
                              : 'success',
                          stats: [
                            {
                              label: 'Gross Salary',
                              value: `₹{l.grossSalary.toLocaleString('en-IN')}`,
                            },
                            {
                              label: 'Advance Taken',
                              value: `₹{l.totalRecoverableAdvance.toLocaleString('en-IN')}`,
                              color: l.totalRecoverableAdvance > 0 ? '#f87171' : '#94a3b8',
                            },
                            {
                              label: 'Paid Amount',
                              value: `₹{l.totalPaid.toLocaleString('en-IN')}`,
                              color: '#34d399',
                            },
                            {
                              label: 'Balance Due',
                              value: `₹{l.balanceDue.toLocaleString('en-IN')}`,
                              color: l.balanceDue > 0 ? '#f87171' : '#34d399',
                            },
                          ],
                          onClick: () => setSelectedWorkerForDetails(l.worker),
                        };

                        return <InteractiveHoverCard key={l.worker.id} item={hoverItem} />;
                      })}
                    </div>
                  </div>
                );
              })}

              {/* Other craftsman categories */}
              {workerLedgers.filter(
                l => !['MISTRY', 'PERIYAAL', 'SITHAAL'].includes(l.worker.category.toUpperCase())
              ).length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🛠️</span>
                    <h5 className="text-sm font-bold uppercase tracking-wider text-slate-400">
                      Other Crafts & Workers
                    </h5>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {workerLedgers
                      .filter(
                        l =>
                          !['MISTRY', 'PERIYAAL', 'SITHAAL'].includes(
                            l.worker.category.toUpperCase()
                          )
                      )
                      .map(l => {
                        const vis = getWorkerVisual(l.worker.category, l.worker.imageUrl);
                        const hoverItem: InteractiveHoverItem = {
                          id: l.worker.id,
                          title: l.worker.name,
                          tamilTitle: vis.tamilName,
                          description: `${l.worker.category} • ₹{l.worker.dailyWage}/day • ${l.daysWorked} Days Worked`,
                          imageUrl: l.worker.imageUrl || vis.imageUrl,
                          imageAlt: l.worker.name,
                          badge: l.worker.category,
                          badgeVariant: 'neutral',
                          stats: [
                            {
                              label: 'Gross Salary',
                              value: `₹{l.grossSalary.toLocaleString('en-IN')}`,
                            },
                            {
                              label: 'Advance Taken',
                              value: `₹{l.totalRecoverableAdvance.toLocaleString('en-IN')}`,
                              color: l.totalRecoverableAdvance > 0 ? '#f87171' : '#94a3b8',
                            },
                            {
                              label: 'Paid Amount',
                              value: `₹{l.totalPaid.toLocaleString('en-IN')}`,
                              color: '#34d399',
                            },
                            {
                              label: 'Balance Due',
                              value: `₹{l.balanceDue.toLocaleString('en-IN')}`,
                              color: l.balanceDue > 0 ? '#f87171' : '#34d399',
                            },
                          ],
                          onClick: () => setSelectedWorkerForDetails(l.worker),
                        };

                        return <InteractiveHoverCard key={l.worker.id} item={hoverItem} />;
                      })}
                  </div>
                </div>
              )}
            </div>
          )}

          {salaryViewMode === 'table' && (
            <div className="table-container">
              <div className="table-header-bar">
                <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                  Worker-Wise Live Salary Ledger (Actual Attendance & Advances)
                </span>
              </div>

              <div className="data-table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Worker Name</th>
                      <th>Category</th>
                      <th>Days</th>
                      <th>Daily Wage</th>
                      <th>Gross Salary</th>
                      <th>Rec. Advance</th>
                      <th>Non-Rec Grant</th>
                      <th>Paid Amount</th>
                      <th>Balance Due</th>
                      <th>Extra Paid</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {workerLedgers.map(l => (
                      <tr
                        key={l.worker.id}
                        onClick={() => setSelectedWorkerForDetails(l.worker)}
                        className="cursor-pointer hover:bg-slate-800/40 transition-colors"
                      >
                        <td>
                          <strong>{l.worker.name}</strong>
                          {l.worker.phone && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              {l.worker.phone}
                            </div>
                          )}
                        </td>
                        <td>
                          <span className={`badge ${l.worker.category === 'MISTRY' ? 'badge-demo' : l.worker.category === 'PERIYAAL' ? 'badge-active' : 'badge-planning'}`}>
                            {l.worker.category}
                          </span>
                        </td>
                        <td>
                          <strong style={{ fontSize: '1.05rem' }}>{l.daysWorked}</strong>
                        </td>
                        <td>₹{l.worker.dailyWage}/d</td>
                        <td>
                          <strong style={{ fontFamily: 'var(--font-heading)' }}>
                            ₹{l.grossSalary.toLocaleString('en-IN')}
                          </strong>
                        </td>
                        <td style={{ color: '#dc2626', fontWeight: 600 }}>
                          {l.totalRecoverableAdvance > 0 ? `- ₹${l.totalRecoverableAdvance.toLocaleString('en-IN')}` : '₹0'}
                        </td>
                        <td style={{ color: '#d97706', fontWeight: 600 }}>
                          {l.totalNonRecoverableAdvance > 0 ? `₹${l.totalNonRecoverableAdvance.toLocaleString('en-IN')}` : '-'}
                        </td>
                        <td style={{ color: 'var(--success)', fontWeight: 600 }}>
                          ₹{l.totalPaid.toLocaleString('en-IN')}
                        </td>
                        <td>
                          <span
                            style={{
                              fontWeight: 800,
                              fontSize: '1rem',
                              fontFamily: 'var(--font-heading)',
                              color: l.balanceDue > 0 ? 'var(--danger)' : 'var(--text-muted)',
                            }}
                          >
                            ₹{l.balanceDue.toLocaleString('en-IN')}
                          </span>
                        </td>
                        <td>
                          {l.extraPaid > 0 ? (
                            <span style={{ fontWeight: 700, color: 'var(--primary)' }}>
                              ₹{l.extraPaid.toLocaleString('en-IN')}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>₹0</span>
                          )}
                        </td>
                        <td>
                          <button
                            className="btn btn-sm btn-primary"
                            onClick={e => {
                              e.stopPropagation();
                              onOpenSalaryModal();
                            }}
                            title="Settle Salary"
                          >
                            Pay Salary
                          </button>
                        </td>
                      </tr>
                    ))}

                  {workers.length === 0 && (
                    <tr>
                      <td colSpan={11} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                        No workers added yet. Add workers using the "+ Add Worker" button to track wages.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    )}

      {/* SUB-TAB 2: WORKER ROSTER */}
      {subTab === 'roster' && (
        <div className="table-container">
          <div className="table-header-bar">
            <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>
              Construction Workers Roster ({workers.length} workers)
            </span>
            <button className="btn btn-sm btn-primary" onClick={() => onOpenWorkerModal()}>
              <PlusCircle size={15} />
              <span>Add New Worker</span>
            </button>
          </div>

          <div className="data-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Worker Name</th>
                  <th>Category</th>
                  <th>Daily Wage Rate</th>
                  <th>Phone Number</th>
                  <th>Joining Date</th>
                  <th>Notes</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {workers.map(w => (
                  <tr key={w.id}>
                    <td><strong>{w.name}</strong></td>
                    <td>
                      <span className={`badge ${w.category === 'MISTRY' ? 'badge-demo' : w.category === 'PERIYAAL' ? 'badge-active' : 'badge-planning'}`}>
                        {w.category}
                      </span>
                    </td>
                    <td>
                      <strong style={{ fontFamily: 'var(--font-heading)', fontSize: '1rem' }}>
                        ₹{w.dailyWage}/day
                      </strong>
                    </td>
                    <td>{w.phone || '-'}</td>
                    <td>{w.joiningDate || '-'}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{w.notes || '-'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button
                          className="btn btn-sm btn-outline"
                          title="Edit Worker"
                          onClick={() => onOpenWorkerModal(w)}
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          className="btn btn-sm btn-danger"
                          title="Move to Recycle Bin"
                          onClick={() => onDeleteWorker(w)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {workers.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                      No workers added yet. Click "+ Add New Worker" above.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-TAB 3: ATTENDANCE LOG */}
      {subTab === 'attendance' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <label style={{ fontSize: '0.9rem', fontWeight: 600 }}>Filter Worker:</label>
              <select
                value={selectedWorkerFilter}
                onChange={e => setSelectedWorkerFilter(e.target.value)}
                style={{ width: 'auto' }}
              >
                <option value="all">All Workers</option>
                {workers.map(w => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>

            <button className="btn btn-primary btn-sm" onClick={() => onOpenAttendanceModal()} disabled={workers.length === 0}>
              <Calendar size={16} />
              <span>Mark Date Attendance</span>
            </button>
          </div>

          <div className="table-container">
            <div className="data-table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Worker Name</th>
                    <th>Category</th>
                    <th>Status</th>
                    <th>Multiplier</th>
                    <th>Wage Rate</th>
                    <th>Earned Amount</th>
                    <th>Notes</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {attendance
                    .filter(a => selectedWorkerFilter === 'all' || a.workerId === selectedWorkerFilter)
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    .map(att => {
                      const worker = workerMap.get(att.workerId);
                      const wage = worker?.dailyWage || 0;
                      const earned = Math.round(wage * att.dayMultiplier);

                      return (
                        <tr key={att.id}>
                          <td style={{ whiteSpace: 'nowrap' }}><strong>{att.date}</strong></td>
                          <td>{worker?.name || 'Unknown Worker'}</td>
                          <td>
                            <span className="badge badge-planning" style={{ fontSize: '0.72rem' }}>
                              {worker?.category || '-'}
                            </span>
                          </td>
                          <td>
                            <span
                              className={`badge ${
                                att.status === 'present'
                                  ? 'badge-active'
                                  : att.status === 'half_day'
                                  ? 'badge-onhold'
                                  : att.status === 'overtime'
                                  ? 'badge-demo'
                                  : 'badge-completed'
                              }`}
                            >
                              {att.status.toUpperCase()}
                            </span>
                          </td>
                          <td>{att.dayMultiplier} Day</td>
                          <td>₹{wage}/day</td>
                          <td>
                            <strong style={{ color: 'var(--text-main)', fontFamily: 'var(--font-heading)' }}>
                              ₹{earned.toLocaleString('en-IN')}
                            </strong>
                          </td>
                          <td style={{ color: 'var(--text-muted)' }}>{att.notes || '-'}</td>
                          <td>
                            <button
                              className="btn btn-sm btn-danger"
                              title="Move to Recycle Bin"
                              onClick={() => onDeleteAttendance(att)}
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}

                  {attendance.length === 0 && (
                    <tr>
                      <td colSpan={9} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                        No attendance recorded yet. Click "Mark Date Attendance" to register workers' daily presence.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 4: ADVANCES LOG */}
      {subTab === 'advances' && (
        <div className="table-container">
          <div className="table-header-bar">
            <div>
              <span style={{ fontWeight: 700, fontSize: '0.95rem', display: 'block' }}>
                Labour Advances Given ({advances.length} records)
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Recoverable advances are deducted from salary. Non-Recoverable advances are company grants.
              </span>
            </div>
            <button className="btn btn-sm btn-primary" onClick={() => onOpenAdvanceModal()} disabled={workers.length === 0}>
              <IndianRupee size={15} />
              <span>Give Advance</span>
            </button>
          </div>

          <div className="data-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Worker Name</th>
                  <th>Type</th>
                  <th>Advance Amount</th>
                  <th>Reason</th>
                  <th>Notes</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {advances
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .map(adv => {
                    const worker = workerMap.get(adv.workerId);
                    const isRecoverable = adv.advanceType !== 'Non-Recoverable';
                    return (
                      <tr key={adv.id}>
                        <td style={{ whiteSpace: 'nowrap' }}>{adv.date}</td>
                        <td>
                          <strong>{worker?.name || 'Worker'}</strong> ({worker?.category})
                        </td>
                        <td>
                          <span className={`badge ${isRecoverable ? 'badge-active' : 'badge-warning'}`}>
                            {isRecoverable ? 'Recoverable' : 'No Return (Grant)'}
                          </span>
                        </td>
                        <td>
                          <strong style={{ color: isRecoverable ? '#dc2626' : '#d97706', fontFamily: 'var(--font-heading)', fontSize: '1.05rem' }}>
                            ₹{adv.amount.toLocaleString('en-IN')}
                          </strong>
                        </td>
                        <td>{adv.reason || '-'}</td>
                        <td style={{ color: 'var(--text-muted)' }}>{adv.notes || '-'}</td>
                        <td>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <button
                              className="btn btn-sm btn-outline"
                              title="Payment Transactions"
                              style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px' }}
                              onClick={() => setPaymentModalData({
                                isOpen: true,
                                relatedRecordId: adv.id,
                                tableName: 'labourAdvances',
                                title: `Advance: ${worker?.name || 'Worker'}`,
                                subtitle: `${isRecoverable ? 'Recoverable' : 'Non-Recoverable Grant'} - ₹${adv.amount}`,
                                module: 'Labour Advance',
                                totalAmount: adv.amount,
                              })}
                            >
                              <Receipt size={13} />
                              <span style={{ fontSize: '0.75rem' }}>Ledger</span>
                            </button>
                            <button
                              className="btn btn-sm btn-outline"
                              title="Edit Advance"
                              onClick={() => onOpenAdvanceModal(adv)}
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              className="btn btn-sm btn-danger"
                              title="Move to Recycle Bin"
                              onClick={() => onDeleteAdvance(adv)}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                {advances.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                      No advances recorded. Any advance recorded here can be marked as Recoverable or Non-Recoverable!
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Universal Payment History & Installment Modal */}
      <PaymentHistoryModal
        isOpen={paymentModalData.isOpen}
        onClose={() => setPaymentModalData(prev => ({ ...prev, isOpen: false }))}
        siteId={siteId}
        relatedRecordId={paymentModalData.relatedRecordId}
        tableName={paymentModalData.tableName}
        title={paymentModalData.title}
        subtitle={paymentModalData.subtitle}
        module={paymentModalData.module}
        totalAmount={paymentModalData.totalAmount}
      />

      {/* Selected Worker Details Modal */}
      {selectedWorkerForDetails && (() => {
        const l = workerLedgers.find(w => w.worker.id === selectedWorkerForDetails.id);
        const vis = getWorkerVisual(selectedWorkerForDetails.category, selectedWorkerForDetails.imageUrl);
        const gross = l?.grossSalary || 0;
        const paid = (l?.totalPaid || 0) + (l?.totalRecoverableAdvance || 0);

        return (
          <ItemDetailsModal
            isOpen={!!selectedWorkerForDetails}
            onClose={() => setSelectedWorkerForDetails(null)}
            title={selectedWorkerForDetails.name}
            subtitle={`${vis.tamilName} • ${selectedWorkerForDetails.category}`}
            categoryBadge={`${selectedWorkerForDetails.category} • ₹${selectedWorkerForDetails.dailyWage}/day`}
            badgeVariant={
              selectedWorkerForDetails.category === 'MISTRY'
                ? 'primary'
                : selectedWorkerForDetails.category === 'PERIYAAL'
                ? 'info'
                : 'success'
            }
            imageUrl={selectedWorkerForDetails.imageUrl || vis.imageUrl}
            imageAlt={selectedWorkerForDetails.name}
            details={[
              {
                label: 'Worker Name',
                value: selectedWorkerForDetails.name,
                highlight: true,
              },
              {
                label: 'Category / Role',
                value: selectedWorkerForDetails.category,
                icon: <Tag size={14} className="text-amber-400" />,
              },
              {
                label: 'Daily Wage Rate',
                value: `₹${selectedWorkerForDetails.dailyWage} / day`,
                icon: <IndianRupee size={14} className="text-emerald-400" />,
              },
              {
                label: 'Days Worked (Attendance)',
                value: `${l?.daysWorked || 0} Days`,
                icon: <Calendar size={14} className="text-sky-400" />,
              },
              {
                label: 'Gross Salary Earned',
                value: `₹${(l?.grossSalary || 0).toLocaleString('en-IN')}`,
                highlight: true,
                color: '#fbbf24',
              },
              {
                label: 'Recoverable Advance Deducted',
                value: `₹${(l?.totalRecoverableAdvance || 0).toLocaleString('en-IN')}`,
                color: '#f87171',
              },
              {
                label: 'Non-Recoverable Company Grant',
                value:
                  (l?.totalNonRecoverableAdvance || 0) > 0
                    ? `₹${(l?.totalNonRecoverableAdvance || 0).toLocaleString('en-IN')} (Not Deducted)`
                    : 'None',
                color: '#fb923c',
              },
              {
                label: 'Contact Phone',
                value: selectedWorkerForDetails.phone || 'No Phone Registered',
                icon: <Phone size={14} className="text-purple-400" />,
              },
              {
                label: 'Joining Date',
                value: selectedWorkerForDetails.joiningDate || 'N/A',
              },
              {
                label: 'Worker Notes',
                value: selectedWorkerForDetails.notes || 'Active site workforce member.',
              },
            ]}
            financials={{
              totalAmount: gross,
              paidAmount: paid,
            }}
            actions={[
              {
                label: 'Attendance',
                icon: <Calendar size={14} />,
                variant: 'outline',
                onClick: () => {
                  setSelectedWorkerForDetails(null);
                  onOpenAttendanceModal();
                },
              },
              {
                label: 'Pay Salary',
                icon: <Coins size={14} />,
                variant: 'amber',
                onClick: () => {
                  setSelectedWorkerForDetails(null);
                  onOpenSalaryModal();
                },
              },
              {
                label: 'Give Advance',
                icon: <IndianRupee size={14} />,
                variant: 'outline',
                onClick: () => {
                  setSelectedWorkerForDetails(null);
                  onOpenAdvanceModal();
                },
              },
              {
                label: 'Edit Worker',
                icon: <Edit2 size={14} />,
                variant: 'outline',
                onClick: () => {
                  const worker = selectedWorkerForDetails;
                  setSelectedWorkerForDetails(null);
                  onOpenWorkerModal(worker);
                },
              },
            ]}
          />
        );
      })()}
    </div>
  );
};
