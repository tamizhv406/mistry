import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Coins, HandCoins, Pencil, Phone, Trash2, UserX } from 'lucide-react';
import type { AttendanceRecord, AttendanceStatus, LabourAdvance, LabourWorker, SalaryPayment, User } from '../../db/types';
import { useProject } from '../../hooks/useProject';
import {
  ATTENDANCE_STATUS_META, ATTENDANCE_STATUS_ORDER, buildWorkerLedger, dedupeAttendance, isRecoverableAdvance, summariseMonth,
} from '../../domain/salary';
import { clearAttendance, markAttendance, removeMoneyEntry, setLeavePolicy } from '../../services/records';
import {
  addMonths, firstWeekdayOfMonth, formatDateTime, formatDay, formatDayLong, formatMonth, monthDayKeys, monthKeyOf, todayKey,
} from '../../utils/datetime';
import { formatINR, formatQty } from '../../utils/money';
import { Badge, CalcLine, ConfirmSheet, Empty, Loading, Note, Page, Section, Segmented, Sheet, Stat } from '../../components/mobile/kit';
import { MoneySheet, type MoneySheetMode } from '../../components/mobile/MoneySheet';

const STATUS_TONE: Record<AttendanceStatus, 'ok' | 'warn' | 'info' | 'bad' | 'violet'> = {
  present: 'ok', half_day: 'warn', leave: 'info', absent: 'bad', overtime: 'violet',
};

interface WorkerProfileViewProps {
  user: User;
  siteId: string;
  workerId: string;
  onBack: () => void;
  onEditWorker: (worker: LabourWorker) => void;
  onNotify: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const WorkerProfileView: React.FC<WorkerProfileViewProps> = ({ user, siteId, workerId, onBack, onEditWorker, onNotify }) => {
  const project = useProject(siteId);
  const today = todayKey();
  const [month, setMonth] = useState(monthKeyOf(today));
  const [scope, setScope] = useState<'month' | 'all'>('month');
  const [dayOpen, setDayOpen] = useState<string | null>(null);
  const [money, setMoney] = useState<MoneySheetMode | null>(null);
  const [entry, setEntry] = useState<{ kind: 'salary'; row: SalaryPayment } | { kind: 'advance'; row: LabourAdvance } | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [busy, setBusy] = useState(false);

  const worker = project?.workers.find(w => w.id === workerId);
  const policy = useMemo(() => ({ leavePaid: project?.site.leavePaid }), [project?.site.leavePaid]);

  const ledger = useMemo(
    () => (project && worker ? buildWorkerLedger(worker, project.attendance, project.advances, project.salaryPayments, policy) : null),
    [project, worker, policy]
  );

  const recordByDate = useMemo(() => {
    const map = new Map<string, AttendanceRecord>();
    if (!project) return map;
    for (const r of dedupeAttendance(project.attendance.filter(a => a.workerId === workerId)).records) map.set(r.date, r);
    return map;
  }, [project, workerId]);

  if (project === undefined) return <Page title="Worker" onBack={onBack}><Loading rows={5} /></Page>;
  if (!project || !worker || !ledger) {
    return (
      <Page title="Worker" onBack={onBack}>
        <div className="m-card"><Empty icon={<UserX size={26} />} title="Worker not found">This worker may have been moved to the Recycle Bin.</Empty></div>
      </Page>
    );
  }

  const monthSummary = summariseMonth(ledger, month);
  const days = monthDayKeys(month);
  const blanks = firstWeekdayOfMonth(month);
  const inScope = (d: string) => scope === 'all' || monthKeyOf(d) === month;
  const corrections = Array.from(recordByDate.values())
    .flatMap(r => (r.editHistory || []).map(e => ({ ...e, date: r.date })))
    .sort((a, b) => b.at.localeCompare(a.at));

  const openDay = (d: string) => {
    if (d > today) return;
    setMonth(monthKeyOf(d));
    setDayOpen(d);
  };

  const markDay = async (status: AttendanceStatus) => {
    if (!dayOpen || busy) return;
    setBusy(true);
    const res = await markAttendance(user, siteId, worker, dayOpen, status);
    setBusy(false);
    if (res.ok) {
      onNotify(`${formatDay(dayOpen)} marked ${ATTENDANCE_STATUS_META[status].label}`, 'success');
      setDayOpen(null);
    } else onNotify(res.error, 'error');
  };

  const clearDay = async () => {
    if (!dayOpen || busy) return;
    setBusy(true);
    const res = await clearAttendance(user, siteId, worker.id, dayOpen);
    setBusy(false);
    if (res.ok) {
      onNotify(`Mark removed for ${formatDay(dayOpen)}. It is in the Recycle Bin.`, 'info');
      setDayOpen(null);
    } else onNotify(res.error, 'error');
  };

  const removeEntry = async () => {
    if (!entry || busy) return;
    setBusy(true);
    const res = await removeMoneyEntry(user, siteId, entry.kind === 'salary' ? 'salaryPayments' : 'labourAdvances', entry.row.id);
    setBusy(false);
    setConfirmRemove(false);
    if (res.ok) {
      onNotify(`${entry.kind === 'salary' ? 'Salary payment' : 'Advance'} moved to Recycle Bin`, 'info');
      setEntry(null);
    } else onNotify(res.error, 'error');
  };

  const dayRecord = dayOpen ? recordByDate.get(dayOpen) : undefined;

  return (
    <Page
      title={worker.name}
      subtitle={<>{worker.category} · {formatINR(worker.dailyWage)} per day{worker.joiningDate ? ` · joined ${formatDay(worker.joiningDate)}` : ''}</>}
      onBack={onBack}
      right={
        <button type="button" className="m-icon-btn is-bordered" onClick={() => onEditWorker(worker)} aria-label="Edit worker details">
          <Pencil size={20} />
        </button>
      }
    >
      {worker.phone && (
        <a className="m-btn is-small" href={`tel:${worker.phone.replace(/[^\d+]/g, '')}`} style={{ marginBottom: 12, textDecoration: 'none' }}>
          <Phone size={16} /> {worker.phone}
        </a>
      )}

      {/* Salary position and how it is worked out */}
      <div className="m-card m-card-pad">
        <div className="m-stat-label">{ledger.overpaid > 0 ? 'PAID AHEAD' : 'SALARY PENDING'}</div>
        <div className={`m-stat-value ${ledger.pending > 0 ? 'is-bad' : ledger.overpaid > 0 ? 'is-info' : 'is-ok'}`} style={{ fontSize: '1.9rem' }}>
          {formatINR(ledger.overpaid > 0 ? ledger.overpaid : ledger.pending)}
        </div>
        <div className="m-calc" style={{ marginTop: 10 }}>
          <CalcLine label={`Wages earned (${formatQty(ledger.workedDayEquivalents)} day${ledger.workedDayEquivalents === 1 ? '' : 's'})`} value={formatINR(ledger.earned)} />
          <CalcLine label={`Salary paid (${ledger.payments.length})`} value={`− ${formatINR(ledger.salaryPaid)}`} />
          <CalcLine label="Advances to deduct" value={`− ${formatINR(ledger.recoverableAdvances)}`} />
          <CalcLine
            total
            label={ledger.overpaid > 0 ? 'Paid ahead' : 'Pending salary'}
            value={formatINR(ledger.overpaid > 0 ? ledger.overpaid : ledger.pending)}
            tone={ledger.pending > 0 ? 'bad' : ledger.overpaid > 0 ? 'info' : 'ok'}
          />
        </div>
        {ledger.nonRecoverableAdvances > 0 && (
          <p className="m-calc-note">Gifts not deducted from salary: {formatINR(ledger.nonRecoverableAdvances)}.</p>
        )}
        {ledger.overpaid > 0 && <p className="m-calc-note">This amount will be set against future wages as attendance is marked.</p>}
        {ledger.duplicateAttendanceIgnored > 0 && (
          <p className="m-calc-note">{ledger.duplicateAttendanceIgnored} duplicate attendance entr{ledger.duplicateAttendanceIgnored === 1 ? 'y was' : 'ies were'} ignored so no day is paid twice.</p>
        )}
        <div className="m-btn-row" style={{ marginTop: 14 }}>
          <button type="button" className="m-btn is-primary" onClick={() => setMoney({ kind: 'salary' })}><Coins size={20} /> Pay salary</button>
          <button type="button" className="m-btn" onClick={() => setMoney({ kind: 'advance' })}><HandCoins size={20} /> Advance</button>
        </div>
      </div>

      {ledger.leavePolicyMissing && (
        <div className="m-card m-card-pad" style={{ marginTop: 10 }}>
          <Note tone="warn">
            {worker.name} has {ledger.leaveDays} Leave day{ledger.leaveDays === 1 ? '' : 's'}. This project has no leave pay rule yet, so they are counted as unpaid for now.
          </Note>
          <div className="m-btn-row" style={{ marginTop: 10 }}>
            <button type="button" className="m-btn is-small" onClick={async () => { const r = await setLeavePolicy(user, siteId, false); if (!r.ok) onNotify(r.error, 'error'); }}>Leave is unpaid</button>
            <button type="button" className="m-btn is-small" onClick={async () => { const r = await setLeavePolicy(user, siteId, true); if (!r.ok) onNotify(r.error, 'error'); }}>Leave is paid</button>
          </div>
        </div>
      )}

      {/* Calendar */}
      <Section title="Attendance calendar">
        <div className="m-daybar">
          <button type="button" className="m-icon-btn" onClick={() => setMonth(addMonths(month, -1))} aria-label="Previous month"><ChevronLeft size={24} /></button>
          <div className="m-daybar-main"><span className="m-daybar-date">{formatMonth(month)}</span></div>
          <button
            type="button"
            className="m-icon-btn"
            onClick={() => setMonth(addMonths(month, 1))}
            disabled={month >= monthKeyOf(today)}
            style={{ opacity: month >= monthKeyOf(today) ? 0.3 : 1 }}
            aria-label="Next month"
          >
            <ChevronRight size={24} />
          </button>
        </div>

        <div className="m-card m-card-pad" style={{ marginTop: 10 }}>
          <div className="m-cal" role="grid" aria-label={`Attendance for ${formatMonth(month)}`}>
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <div key={i} className="m-cal-dow" aria-hidden="true">{d}</div>)}
            {Array.from({ length: blanks }, (_, i) => <div key={`b${i}`} className="m-cal-day is-blank" aria-hidden="true" />)}
            {days.map(d => {
              const rec = recordByDate.get(d);
              const future = d > today;
              const label = `${formatDay(d)}: ${rec ? ATTENDANCE_STATUS_META[rec.status].label : future ? 'future date' : 'not marked'}`;
              return (
                <button
                  key={d}
                  type="button"
                  className={`m-cal-day ${future ? 'is-future' : ''} ${d === today ? 'is-today' : ''}`}
                  data-status={rec?.status}
                  disabled={future}
                  onClick={() => openDay(d)}
                  aria-label={label}
                >
                  <span>{Number(d.slice(8))}</span>
                  {rec && <span className="m-cal-code">{ATTENDANCE_STATUS_META[rec.status].short}</span>}
                </button>
              );
            })}
          </div>
          <div className="m-legend">
            {ATTENDANCE_STATUS_ORDER.map(s => (
              <span key={s}><span className="m-dot" data-status={s} /> {ATTENDANCE_STATUS_META[s].short} {ATTENDANCE_STATUS_META[s].label}</span>
            ))}
          </div>
          <p className="m-calc-note">Tap any past day to mark or correct it.</p>
        </div>

        <div className="m-stats is-3" style={{ marginTop: 10 }}>
          <Stat label="Worked days" value={formatQty(monthSummary.workedDayEquivalents)} hint={formatMonth(month)} />
          <Stat label="Earned" value={formatINR(monthSummary.earned)} />
          <Stat label="Paid" value={formatINR(monthSummary.salaryPaid)} />
        </div>
      </Section>

      {/* Exact dates by status */}
      <Section title="Dates by status">
        <Segmented label="Date range" value={scope} onChange={setScope} options={[{ value: 'month', label: formatMonth(month) }, { value: 'all', label: 'All time' }]} />
        {ATTENDANCE_STATUS_ORDER.map(status => {
          const dates = ledger.datesByStatus[status].filter(inScope);
          if (dates.length === 0 && (status === 'overtime' || status === 'absent')) return null;
          return (
            <div key={status} className="m-card m-card-pad" style={{ marginTop: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: dates.length ? 10 : 0 }}>
                <span className="m-dot" data-status={status} aria-hidden="true" />
                <strong style={{ flex: 1 }}>{ATTENDANCE_STATUS_META[status].label} Dates</strong>
                <Badge tone={STATUS_TONE[status]}>{dates.length} day{dates.length === 1 ? '' : 's'}</Badge>
              </div>
              {dates.length === 0 ? (
                <span className="is-muted" style={{ fontSize: '0.88rem' }}>None {scope === 'month' ? 'this month' : 'recorded'}.</span>
              ) : (
                <div className="m-date-list">
                  {dates.map(d => (
                    <button key={d} type="button" className="m-date-pill" onClick={() => openDay(d)}>{formatDay(d)}</button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </Section>

      {/* Payments */}
      <Section title={`Salary paid (${ledger.payments.length})`}>
        {ledger.payments.length === 0 ? (
          <div className="m-card m-card-pad is-muted" style={{ fontSize: '0.92rem' }}>No salary payments yet.</div>
        ) : (
          <div className="m-card m-list">
            {ledger.payments.map(p => (
              <button key={p.id} type="button" className="m-row" onClick={() => setEntry({ kind: 'salary', row: p })}>
                <span className="m-row-main">
                  <span className="m-row-title" style={{ display: 'block' }}>{formatDay(p.date)}</span>
                  <span className="m-row-sub">{p.paymentMode || 'Cash'}{p.notes ? ' · ' + p.notes : ''}</span>
                </span>
                <span className="m-row-end"><span className="m-row-amount is-ok">{formatINR(p.paidAmount)}</span></span>
              </button>
            ))}
          </div>
        )}
      </Section>

      <Section title={`Advances (${ledger.advances.length})`}>
        {ledger.advances.length === 0 ? (
          <div className="m-card m-card-pad is-muted" style={{ fontSize: '0.92rem' }}>No advances given.</div>
        ) : (
          <div className="m-card m-list">
            {ledger.advances.map(a => (
              <button key={a.id} type="button" className="m-row" onClick={() => setEntry({ kind: 'advance', row: a })}>
                <span className="m-row-main">
                  <span className="m-row-title" style={{ display: 'block' }}>{formatDay(a.date)}</span>
                  <span className="m-row-sub">{isRecoverableAdvance(a) ? 'Deducted from salary' : 'Gift, not deducted'}{a.reason ? ' · ' + a.reason : ''}</span>
                </span>
                <span className="m-row-end"><span className={`m-row-amount ${isRecoverableAdvance(a) ? 'is-warn' : 'is-muted'}`}>{formatINR(a.amount)}</span></span>
              </button>
            ))}
          </div>
        )}
      </Section>

      {corrections.length > 0 && (
        <Section title="Attendance corrections">
          <div className="m-card m-list">
            {corrections.slice(0, 20).map((c, i) => (
              <div key={i} className="m-row" style={{ minHeight: 52 }}>
                <span className="m-row-main">
                  <span style={{ display: 'block', fontSize: '0.92rem', fontWeight: 600 }}>
                    {formatDay(c.date)}: {ATTENDANCE_STATUS_META[c.from].label} → {ATTENDANCE_STATUS_META[c.to].label}
                  </span>
                  <span className="m-row-sub">Changed {formatDateTime(c.at)}{c.byName ? ' by ' + c.byName : ''}</span>
                </span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Day sheet */}
      <Sheet
        open={!!dayOpen}
        title={dayOpen ? formatDayLong(dayOpen) : ''}
        subtitle={worker.name}
        onClose={() => setDayOpen(null)}
      >
        <div className="m-att-btns" style={{ gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }} role="group" aria-label="Attendance status">
          {ATTENDANCE_STATUS_ORDER.map(s => (
            <button key={s} type="button" className="m-att-btn" data-status={s} aria-pressed={dayRecord?.status === s} disabled={busy} onClick={() => markDay(s)} style={{ fontSize: '0.95rem' }}>
              {ATTENDANCE_STATUS_META[s].label}
            </button>
          ))}
        </div>
        {dayRecord ? (
          <div className="m-calc-note" style={{ marginTop: 14 }}>
            <div>Marked {ATTENDANCE_STATUS_META[dayRecord.status].label} · entered {formatDateTime(dayRecord.createdAt)}</div>
            {dayRecord.updatedAt !== dayRecord.createdAt && <div>Last changed {formatDateTime(dayRecord.updatedAt)}</div>}
            {dayRecord.dailyWageSnapshot ? <div>Wage for this day: {formatINR(dayRecord.dailyWageSnapshot)}</div> : null}
            <button type="button" className="m-btn is-quiet is-small" style={{ marginTop: 8, paddingLeft: 0 }} disabled={busy} onClick={clearDay}>
              <Trash2 size={16} /> Remove this mark
            </button>
          </div>
        ) : (
          <p className="m-calc-note" style={{ marginTop: 14 }}>Not marked yet. Choose a status to record it.</p>
        )}
      </Sheet>

      {/* Payment / advance detail */}
      <Sheet
        open={!!entry && !confirmRemove && !money}
        title={entry?.kind === 'salary' ? 'Salary payment' : 'Advance'}
        subtitle={worker.name}
        onClose={() => setEntry(null)}
        footer={
          entry && (
            <>
              <button type="button" className="m-btn" onClick={() => setConfirmRemove(true)}><Trash2 size={18} /> Delete</button>
              <button
                type="button"
                className="m-btn is-primary"
                onClick={() => setMoney(entry.kind === 'salary' ? { kind: 'salary', payment: entry.row } : { kind: 'advance', advance: entry.row })}
              >
                <Pencil size={18} /> Correct
              </button>
            </>
          )
        }
      >
        {entry && (
          <div className="m-calc">
            <CalcLine label="Amount" value={formatINR(entry.kind === 'salary' ? entry.row.paidAmount : entry.row.amount)} />
            <CalcLine label="Date" value={formatDay(entry.row.date)} />
            {entry.kind === 'salary' && <CalcLine label="Paid by" value={entry.row.paymentMode || 'Cash'} />}
            {entry.kind === 'advance' && <CalcLine label="Type" value={isRecoverableAdvance(entry.row) ? 'Deducted from salary' : 'Gift, not deducted'} />}
            {(entry.row.notes || (entry.kind === 'advance' && entry.row.reason)) && (
              <CalcLine label="Note" value={<span style={{ whiteSpace: 'normal', fontFamily: 'var(--font-body)', fontWeight: 600 }}>{(entry.kind === 'advance' && entry.row.reason) || entry.row.notes}</span>} />
            )}
            <CalcLine label="Entered" value={formatDateTime(entry.row.createdAt)} />
            {entry.row.updatedAt !== entry.row.createdAt && <CalcLine label="Last corrected" value={formatDateTime(entry.row.updatedAt)} />}
          </div>
        )}
      </Sheet>

      <ConfirmSheet
        open={confirmRemove}
        title={`Delete this ${entry?.kind === 'salary' ? 'payment' : 'advance'}?`}
        message={<>It will move to the Recycle Bin and stop counting in {worker.name}'s salary. You can restore it later.</>}
        confirmLabel="Move to Recycle Bin"
        danger
        busy={busy}
        onConfirm={removeEntry}
        onCancel={() => setConfirmRemove(false)}
      />

      {money && (
        <MoneySheet
          open
          mode={money}
          user={user}
          siteId={siteId}
          worker={worker}
          pending={ledger.pending}
          onClose={() => setMoney(null)}
          onSaved={msg => { onNotify(msg, 'success'); setEntry(null); }}
        />
      )}
    </Page>
  );
};
