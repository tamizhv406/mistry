import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, FileText, Printer, X } from 'lucide-react';
import type { AttendanceRecord, LabourAdvance, LabourWorker, SalaryPayment } from '../db/types';
import { buildWorkerMonthlyStatement, type WorkerMonthlyStatement } from '../domain/salary';
import { addMonths, monthKeyOf, todayKey } from '../utils/datetime';
import { formatINR } from '../utils/money';
import {
  downloadFile,
  generateWorkerMonthlyAttendancePdfBlob,
  printWorkerMonthlyStatement,
  workerMonthlyPdfFilename,
} from '../utils/pdfGenerator';

export interface WorkerAttendancePdfModalProps {
  isOpen: boolean;
  onClose: () => void;
  siteId: string;
  siteName: string;
  leavePaid?: boolean;
  workers: LabourWorker[];
  attendance: AttendanceRecord[];
  advances: LabourAdvance[];
  salaryPayments: SalaryPayment[];
  initialWorkerId?: string | null;
  initialMonth?: string;
  onNotify?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

/**
 * Mobile-friendly (390px) & desktop modal for previewing, printing, and downloading a
 * worker's monthly day-by-day attendance and wage settlement PDF.
 */
export const WorkerAttendancePdfModal: React.FC<WorkerAttendancePdfModalProps> = ({
  isOpen,
  onClose,
  siteId,
  siteName,
  leavePaid,
  workers,
  attendance,
  advances,
  salaryPayments,
  initialWorkerId,
  initialMonth,
  onNotify,
}) => {
  const currentMonth = monthKeyOf(todayKey());
  const sortedWorkers = useMemo(
    () => [...workers].sort((a, b) => a.name.localeCompare(b.name)),
    [workers],
  );

  const [workerId, setWorkerId] = useState<string>(initialWorkerId || sortedWorkers[0]?.id || '');
  const [month, setMonth] = useState<string>(initialMonth || currentMonth);
  const [busyAction, setBusyAction] = useState<'download' | 'print' | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    if (initialWorkerId && sortedWorkers.some(w => w.id === initialWorkerId)) {
      setWorkerId(initialWorkerId);
    } else if (!sortedWorkers.some(w => w.id === workerId)) {
      setWorkerId(sortedWorkers[0]?.id || '');
    }
    if (initialMonth) {
      setMonth(initialMonth);
    }
  }, [isOpen, initialWorkerId, initialMonth, sortedWorkers, workerId]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  const selectedWorker = useMemo(
    () => sortedWorkers.find(w => w.id === workerId) || sortedWorkers[0] || null,
    [sortedWorkers, workerId],
  );

  const statement: WorkerMonthlyStatement | null = useMemo(() => {
    if (!selectedWorker) return null;
    return buildWorkerMonthlyStatement({
      projectId: siteId,
      projectName: siteName,
      worker: selectedWorker,
      month,
      attendance,
      advances,
      payments: salaryPayments,
      policy: { leavePaid },
    });
  }, [selectedWorker, siteId, siteName, month, attendance, advances, salaryPayments, leavePaid]);

  if (!isOpen) return null;

  const handleDownloadPdf = () => {
    if (!statement) return;
    setBusyAction('download');
    try {
      const blob = generateWorkerMonthlyAttendancePdfBlob(statement);
      const filename = workerMonthlyPdfFilename(statement);
      downloadFile(blob, filename);
      onNotify?.(`Downloaded ${filename}`, 'success');
    } catch {
      onNotify?.('Could not create the attendance PDF.', 'error');
    } finally {
      setBusyAction(null);
    }
  };

  const handlePrint = () => {
    if (!statement) return;
    setBusyAction('print');
    try {
      printWorkerMonthlyStatement(statement);
      onNotify?.(`Prepared printable statement for ${statement.workerName} (${statement.monthLabel}).`, 'info');
    } catch {
      onNotify?.('Print is unavailable on this device. Try Download PDF instead.', 'error');
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <div
      className="wpdf-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Worker Monthly Attendance PDF"
      onClick={onClose}
    >
      <div className="wpdf-dialog" onClick={e => e.stopPropagation()}>
        <div className="wpdf-header">
          <div className="wpdf-header-title">
            <FileText size={20} color="var(--color-primary)" aria-hidden="true" />
            <div>
              <h2>Worker Attendance PDF</h2>
              <p>{siteName}</p>
            </div>
          </div>
          <button
            type="button"
            className="wpdf-close-btn"
            aria-label="Close Worker Attendance PDF"
            onClick={onClose}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <div className="wpdf-body">
          {sortedWorkers.length === 0 ? (
            <div className="wpdf-empty">
              Add at least one worker to this project before generating a monthly attendance PDF.
            </div>
          ) : (
            <>
              {/* Worker + Month Controls */}
              <div className="wpdf-controls">
                <label className="wpdf-field">
                  <span>Worker</span>
                  <select
                    aria-label="Select worker"
                    value={selectedWorker?.id || ''}
                    onChange={e => setWorkerId(e.target.value)}
                  >
                    {sortedWorkers.map(w => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({w.category} · {formatINR(w.dailyWage)}/day)
                      </option>
                    ))}
                  </select>
                </label>

                <div className="wpdf-field">
                  <span>Month</span>
                  <div className="wpdf-month-row">
                    <button
                      type="button"
                      className="wpdf-step-btn"
                      aria-label="Previous month"
                      onClick={() => setMonth(prev => addMonths(prev, -1))}
                    >
                      <ChevronLeft size={18} aria-hidden="true" />
                    </button>
                    <input
                      type="month"
                      aria-label="Select month"
                      value={month}
                      max={currentMonth}
                      onChange={e => e.target.value && setMonth(e.target.value)}
                    />
                    <button
                      type="button"
                      className="wpdf-step-btn"
                      aria-label="Next month"
                      disabled={month >= currentMonth}
                      onClick={() => setMonth(prev => addMonths(prev, 1))}
                    >
                      <ChevronRight size={18} aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </div>

              {statement && (
                <>
                  {/* Attendance Count Pills */}
                  <div className="wpdf-kpi-grid" aria-label="Monthly attendance counts">
                    <div className="wpdf-kpi is-success">
                      <span>Present</span>
                      <strong>{statement.counts.present}</strong>
                    </div>
                    <div className="wpdf-kpi is-warning">
                      <span>Half Day</span>
                      <strong>{statement.counts.half_day}</strong>
                    </div>
                    <div className="wpdf-kpi is-warning">
                      <span>Overtime</span>
                      <strong>{statement.counts.overtime}</strong>
                    </div>
                    <div className="wpdf-kpi is-charcoal">
                      <span>Leave</span>
                      <strong>{statement.counts.leave}</strong>
                    </div>
                    <div className="wpdf-kpi is-danger">
                      <span>Absent</span>
                      <strong>{statement.counts.absent}</strong>
                    </div>
                    <div className="wpdf-kpi is-primary">
                      <span>Payable Days</span>
                      <strong>{statement.workedDayEquivalents}</strong>
                    </div>
                  </div>

                  {/* Financial Breakdown Card */}
                  <div className="wpdf-finance-card">
                    <div className="wpdf-finance-head">
                      <span>{statement.monthLabel} Wage Settlement</span>
                      <strong>{formatINR(statement.dailyWage)}/day</strong>
                    </div>
                    <div className="wpdf-finance-row">
                      <span>Gross Earned ({statement.workedDayEquivalents} days)</span>
                      <strong>{formatINR(statement.grossEarned)}</strong>
                    </div>
                    <div className="wpdf-finance-row is-warn">
                      <span>Advances Deducted ({statement.advancesTaken.length})</span>
                      <strong>− {formatINR(statement.totalAdvancesDeducted)}</strong>
                    </div>
                    <div className="wpdf-finance-row is-ok">
                      <span>Salary Already Paid ({statement.salaryPayments.length})</span>
                      <strong>− {formatINR(statement.totalSalaryPaid)}</strong>
                    </div>
                    {statement.priorNetBalance !== 0 && (
                      <div className="wpdf-finance-row">
                        <span>
                          {statement.priorNetBalance > 0 ? 'Prior Pending Carried In' : 'Prior Paid Ahead Carried In'}
                        </span>
                        <strong>
                          {statement.priorNetBalance > 0
                            ? formatINR(statement.priorNetBalance)
                            : `− ${formatINR(Math.abs(statement.priorNetBalance))}`}
                        </strong>
                      </div>
                    )}
                    <div className="wpdf-finance-row is-total">
                      <span>{statement.monthOverpaid > 0 ? 'Paid Ahead (Month)' : 'Net Pay Due (Month)'}</span>
                      <strong>
                        {statement.monthOverpaid > 0
                          ? `${formatINR(statement.monthOverpaid)} ahead`
                          : formatINR(statement.monthNetPay)}
                      </strong>
                    </div>
                    {(statement.overallPending !== statement.monthNetPay ||
                      statement.overallOverpaid !== statement.monthOverpaid) && (
                      <div className="wpdf-finance-row is-total">
                        <span>{statement.overallOverpaid > 0 ? 'Overall Paid Ahead' : 'Overall Balance Due'}</span>
                        <strong>
                          {statement.overallOverpaid > 0
                            ? `${formatINR(statement.overallOverpaid)} ahead`
                            : formatINR(statement.overallPending)}
                        </strong>
                      </div>
                    )}
                  </div>

                  {/* Day-by-Day Attendance Preview List */}
                  <div className="wpdf-days-wrap">
                    <div className="wpdf-days-title">
                      Day-by-Day Attendance Log ({statement.daysInMonth} days)
                    </div>
                    <div className="wpdf-days-list">
                      {statement.days.map(row => (
                        <div key={row.date} className="wpdf-day-row" data-status={row.status}>
                          <div className="wpdf-day-date">
                            <strong>{String(row.dayNumber).padStart(2, '0')}</strong>
                            <span>{row.weekdayShort}</span>
                          </div>
                          <div className="wpdf-day-mid">
                            <span
                              className={`wpdf-status-pill is-${row.status}`}
                            >
                              {row.statusLabel}
                            </span>
                            {(row.notes || row.correctionCount > 0) && (
                              <span className="wpdf-day-note">
                                {row.notes || `${row.correctionCount} correction(s)`}
                              </span>
                            )}
                          </div>
                          <div className="wpdf-day-amt">
                            {row.status === 'unmarked' ? (
                              <span className="is-muted">—</span>
                            ) : (
                              <>
                                <strong>{formatINR(row.earnedAmount)}</strong>
                                <span>×{row.dayValue}</span>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>

        <div className="wpdf-footer">
          <button
            type="button"
            className="wpdf-btn wpdf-btn-secondary"
            onClick={handlePrint}
            disabled={!statement || busyAction !== null}
          >
            <Printer size={18} aria-hidden="true" />
            <span>{busyAction === 'print' ? 'Preparing…' : 'Print'}</span>
          </button>
          <button
            type="button"
            className="wpdf-btn wpdf-btn-primary"
            onClick={handleDownloadPdf}
            disabled={!statement || busyAction !== null}
          >
            <Download size={18} aria-hidden="true" />
            <span>{busyAction === 'download' ? 'Building…' : 'Download PDF'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
