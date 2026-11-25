import React, { useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { CalendarDays, CheckCheck, FileText, History, MoreVertical, UserPlus, Users, Wallet } from 'lucide-react';
import { db } from '../../db/db';
import type { AttendanceStatus, LabourWorker, User } from '../../db/types';
import { useProject } from '../../hooks/useProject';
import {
  ATTENDANCE_STATUS_META, ATTENDANCE_STATUS_ORDER, buildCorrectionLog, buildSiteLabourSummary, correctionStatusLabel, countByStatus,
  dedupeAttendance, LONG_PRESS_MS, LONG_PRESS_SLOP, LONG_PRESS_STATUSES, nextTapStatus,
} from '../../domain/salary';
import { clearAttendance, markAllPresent, markAttendance, setLeavePolicy } from '../../services/records';
import { useLanguage } from '../../services/i18n';
import { addDays, formatDateTime, formatDay, formatDayLong, monthKeyOf, todayKey } from '../../utils/datetime';
import { formatINR, formatQty } from '../../utils/money';
import { Badge, Empty, Field, Loading, Note, Page, SearchBox, Segmented, Sheet } from '../../components/mobile/kit';
import { WorkerAttendancePdfModal } from '../../components/WorkerAttendancePdfModal';
import { VirtualListSpacer } from '../../components/ui/VirtualSpacers';
import { useVirtualWindow } from '../../hooks/useVirtualWindow';
import '../../styles/materials-mobile.css';

type Notify = (msg: string, type?: 'success' | 'error' | 'info') => void;

interface LabourViewProps {
  user: User;
  siteId: string;
  onBack: () => void;
  onOpenWorker: (workerId: string) => void;
  onAddWorker: () => void;
  onNotify: Notify;
}

/**
 * The status button of a row. A tap moves to the next status; holding it (LONG_PRESS_MS, without
 * moving more than LONG_PRESS_SLOP px, so scrolling never triggers it) or a right-click opens the
 * menu with Overtime and Leave. The ⋯ button beside it opens the same menu for keyboards and
 * screen readers.
 */
const StatusButton: React.FC<{
  status: AttendanceStatus | undefined;
  label: string;
  name: string;
  onTap: () => void;
  onHold: () => void;
}> = ({ status, label, name, onTap, onHold }) => {
  const timer = useRef<number | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const held = useRef(false);
  const cancel = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
    start.current = null;
  };
  return (
    <button
      type="button"
      className="att-status"
      data-status={status || 'unmarked'}
      aria-label={`${name}: ${label}. Tap to change; hold for more`}
      onPointerDown={e => {
        held.current = false;
        start.current = { x: e.clientX, y: e.clientY };
        timer.current = window.setTimeout(() => { held.current = true; timer.current = null; onHold(); }, LONG_PRESS_MS);
      }}
      onPointerMove={e => {
        if (start.current && Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > LONG_PRESS_SLOP) cancel();
      }}
      onPointerUp={cancel}
      onPointerCancel={cancel}
      onPointerLeave={cancel}
      onContextMenu={e => { e.preventDefault(); cancel(); if (!held.current) { held.current = true; onHold(); } }}
      onClick={() => {
        if (held.current) { held.current = false; return; } // the hold already opened the menu
        onTap();
      }}
    >
      {label}
    </button>
  );
};

export const LabourView: React.FC<LabourViewProps> = ({ user, siteId, onBack, onOpenWorker, onAddWorker, onNotify }) => {
  const { t, statusLabel } = useLanguage();
  const project = useProject(siteId);
  // Every mark on the project, removed ones too, for the correction log.
  const allMarks = useLiveQuery(() => db.attendance.where('siteId').equals(siteId).toArray(), [siteId]);
  const today = todayKey();
  const [date, setDateState] = useState(today);
  const [query, setQuery] = useState('');
  const [bulkBusy, setBulkBusy] = useState(false);
  // What the screen shows straight after a tap, before the database answers: taps stay instant.
  const [shown, setShown] = useState<Record<string, AttendanceStatus | null>>({});
  const queue = useRef(new Map<string, Promise<unknown>>());
  const [menuFor, setMenuFor] = useState<LabourWorker | null>(null);
  const [reason, setReason] = useState('');
  const [logOpen, setLogOpen] = useState(false);
  const [salaryOpen, setSalaryOpen] = useState(false);
  const [pdfOpen, setPdfOpen] = useState(false);

  const setDate = (d: string) => { setDateState(d); setShown({}); };
  const label = (s: AttendanceStatus | undefined | null) => (s ? statusLabel(s) : t('at_not_marked', 'Not marked'));

  const dayMarks = useMemo(() => {
    const map = new Map<string, AttendanceStatus>();
    if (!project) return map;
    for (const r of dedupeAttendance(project.attendance.filter(a => a.date === date)).records) map.set(r.workerId, r.status);
    return map;
  }, [project, date]);

  const corrections = useMemo(() => buildCorrectionLog(allMarks || [], project?.workers || []), [allMarks, project?.workers]);
  const q = query.trim().toLowerCase();
  const rows = useMemo(() => {
    const list = project?.workers || [];
    return q ? list.filter(w => `${w.name} ${w.category} ${w.phone}`.toLowerCase().includes(q)) : list;
  }, [project?.workers, q]);
  const workerWindow = useVirtualWindow<HTMLDivElement>({
    itemCount: rows.length,
    estimateSize: 64,
    threshold: 25,
  });

  if (project === undefined) return <Page title={t('at_title', 'Attendance')} onBack={onBack}><Loading rows={6} /></Page>;
  if (project === null) {
    return (
      <Page title={t('at_title', 'Attendance')} onBack={onBack}>
        <div className="m-card"><Empty icon={<Users size={26} />} title="Project not found">It may have been moved to the Recycle Bin.</Empty></div>
      </Page>
    );
  }

  const { workers, site } = project;
  const statusOf = (id: string): AttendanceStatus | undefined => {
    const key = `${date}:${id}`;
    return key in shown ? (shown[key] ?? undefined) : dayMarks.get(id);
  };
  const counts = countByStatus(project.attendance.filter(a => a.date === date));
  const unmarked = workers.filter(w => !statusOf(w.id));
  const isPast = date < today;

  /** Saves one change; changes to the same worker are saved in order. */
  const save = (worker: LabourWorker, status: AttendanceStatus | null, why?: string) => {
    const key = `${date}:${worker.id}`;
    const day = date;
    setShown(m => ({ ...m, [key]: status }));
    const prev = queue.current.get(worker.id) || Promise.resolve();
    const next = prev.then(async () => {
      const res = status ? await markAttendance(user, siteId, worker, day, status, undefined, why) : await clearAttendance(user, siteId, worker.id, day, why);
      if (!res.ok) {
        onNotify(res.error, 'error');
        setShown(m => { const c = { ...m }; delete c[key]; return c; });
      }
    });
    queue.current.set(worker.id, next);
  };

  const tap = (worker: LabourWorker) => save(worker, nextTapStatus(statusOf(worker.id)));

  const markAll = async () => {
    if (bulkBusy || unmarked.length === 0) return;
    setBulkBusy(true);
    await Promise.all([...queue.current.values()]); // let pending taps land first
    const res = await markAllPresent(user, siteId, workers, date);
    setBulkBusy(false);
    if (!res.ok) return onNotify(res.error, 'error');
    const { marked, kept, failed } = res.value;
    onNotify(`${marked} marked Present${kept ? ` · ${kept} already marked, kept` : ''}${failed ? ` · ${failed} could not be saved` : ''}`, failed ? 'error' : 'success');
  };

  const choose = (status: AttendanceStatus | null) => {
    if (!menuFor) return;
    save(menuFor, status, reason);
    setMenuFor(null);
    setReason('');
  };

  const summary = salaryOpen ? buildSiteLabourSummary(workers, project.attendance, project.advances, project.salaryPayments, { leavePaid: site.leavePaid }) : null;
  const menuCurrent = menuFor ? statusOf(menuFor.id) : undefined;

  return (
    <Page
      className="stk-screen att-screen"
      title={t('at_title', 'Attendance')}
      subtitle={site.name}
      onBack={onBack}
      right={
        <button type="button" className="m-icon-btn is-bordered" onClick={onAddWorker} aria-label="Add worker">
          <UserPlus size={22} />
        </button>
      }
    >
      {/* Day: today, yesterday, or any past date. */}
      <div className="att-dates" role="group" aria-label="Attendance date">
        <button type="button" className="att-date" aria-pressed={date === today} onClick={() => setDate(today)}>{t('at_today', 'Today')}</button>
        <button type="button" className="att-date" aria-pressed={date === addDays(today, -1)} onClick={() => setDate(addDays(today, -1))}>{t('at_yesterday', 'Yesterday')}</button>
        <label className="att-date att-date-pick" data-active={date < addDays(today, -1) ? 'true' : undefined}>
          <CalendarDays size={18} aria-hidden="true" />
          <span>{date < addDays(today, -1) ? formatDay(date) : t('at_pick_date', 'Pick date')}</span>
          <input type="date" value={date} max={today} onChange={e => e.target.value && e.target.value <= today && setDate(e.target.value)} aria-label="Choose any past date" />
        </label>
      </div>
      <p className="att-day">{formatDayLong(date)}</p>
      {isPast && <div style={{ marginBottom: 8 }}><Note>{t('at_past', 'Past date: every change is kept in the correction log.')}</Note></div>}

      {workers.length === 0 ? (
        <div className="m-card">
          <Empty
            icon={<Users size={26} />}
            title="No workers yet"
            action={<button type="button" className="m-btn is-primary" onClick={onAddWorker}><UserPlus size={20} /> Add worker</button>}
          >
            Add each worker with their daily wage. Then mark attendance with one tap.
          </Empty>
        </div>
      ) : (
        <>
          <button type="button" className="m-btn is-primary is-block att-all" onClick={markAll} disabled={bulkBusy || unmarked.length === 0}>
            <CheckCheck size={20} />
            {bulkBusy ? 'Marking…' : unmarked.length ? `${t('at_mark_all', 'Mark all present')} (${unmarked.length})` : t('at_all_marked', 'Everyone is marked')}
          </button>

          <p className="att-counts" aria-live="polite">
            <span className="is-ok">{statusLabel('present')} {counts.present + counts.overtime}</span> ·{' '}
            <span>{statusLabel('half_day')} {counts.half_day}</span> ·{' '}
            <span className="is-bad">{statusLabel('absent')} {counts.absent}</span>
            {counts.leave ? <> · <span>{statusLabel('leave')} {counts.leave}</span></> : null}
            {' '}· <span>{t('at_not_marked', 'Not marked')} {unmarked.length}</span>
          </p>

          <SearchBox value={query} onChange={setQuery} placeholder={t('at_search', 'Search worker')} />

          <div ref={workerWindow.containerRef} className="m-card m-list att-list">
            <VirtualListSpacer height={workerWindow.topSpacerPx} />
            {rows.slice(workerWindow.startIndex, workerWindow.endIndex).map(w => {
              const s = statusOf(w.id);
              return (
                <div key={w.id} className="att-row">
                  <button type="button" className="att-who" onClick={() => onOpenWorker(w.id)} aria-label={`Open ${w.name}'s profile`}>
                    <span className="att-avatar" aria-hidden="true">{(w.name || '?').trim().charAt(0).toUpperCase()}</span>
                    <span className="att-text">
                      <span className="att-name">{w.name}</span>
                      {w.category && <span className="att-role">{w.category}</span>}
                    </span>
                  </button>
                  <StatusButton status={s} label={label(s)} name={w.name} onTap={() => tap(w)} onHold={() => { setReason(''); setMenuFor(w); }} />
                  <button type="button" className="att-more" onClick={() => { setReason(''); setMenuFor(w); }} aria-label={`More statuses for ${w.name}`}>
                    <MoreVertical size={20} />
                  </button>
                </div>
              );
            })}
            <VirtualListSpacer height={workerWindow.bottomSpacerPx} />
            {rows.length === 0 && <div className="m-row is-muted">No worker matches "{query}".</div>}
          </div>
          <p className="m-calc-note">{t('at_hint', 'Tap a status to change it. Hold it (or tap ⋯) for Overtime and Leave.')}</p>

          <div className="m-card m-list" style={{ marginTop: 12 }}>
            <button type="button" className="m-row" onClick={() => setLogOpen(true)}>
              <span className="m-row-icon"><History size={20} /></span>
              <span className="m-row-main"><span className="m-row-title" style={{ display: 'block' }}>{t('at_corrections', 'Correction log')}</span></span>
              <Badge>{corrections.length}</Badge>
            </button>
            <button type="button" className="m-row" onClick={() => setSalaryOpen(true)}>
              <span className="m-row-icon"><Wallet size={20} /></span>
              <span className="m-row-main"><span className="m-row-title" style={{ display: 'block' }}>{t('at_salary', 'Salary & leave rule')}</span></span>
            </button>
            <button type="button" className="m-row" onClick={() => setPdfOpen(true)}>
              <span className="m-row-icon"><FileText size={20} /></span>
              <span className="m-row-main">
                <span className="m-row-title" style={{ display: 'block' }}>Worker Attendance PDF</span>
                <span className="m-row-sub">Day-by-day monthly report &amp; net pay</span>
              </span>
            </button>
          </div>
        </>
      )}

      {/* Long press / ⋯: Overtime, Leave, the others, or clear. */}
      <Sheet open={!!menuFor} title={menuFor?.name || ''} subtitle={`${formatDay(date)} · now ${label(menuCurrent)}`} onClose={() => setMenuFor(null)}>
        <div className="stk-screen">
          <div className="att-menu">
            {LONG_PRESS_STATUSES.map(s => (
              <button key={s} type="button" className="att-menu-btn" data-status={s} aria-pressed={menuCurrent === s} onClick={() => choose(s)}>
                <span>{statusLabel(s)}</span>
                <span className="att-menu-x">{s === 'leave' ? (site.leavePaid ? '× 1 (paid)' : '× 0 (unpaid)') : `× ${ATTENDANCE_STATUS_META[s].multiplier}`}</span>
              </button>
            ))}
            <button type="button" className="att-menu-btn" data-status="unmarked" onClick={() => choose(null)} disabled={!menuCurrent}>
              <span>{t('at_not_marked', 'Not marked')}</span><span className="att-menu-x">clear</span>
            </button>
          </div>
          {menuCurrent && (
            <Field label="Reason for the change (optional)">
              <input type="text" value={reason} onChange={e => setReason(e.target.value)} maxLength={120} placeholder="e.g. Came after lunch" />
            </Field>
          )}
        </div>
      </Sheet>

      <Sheet open={logOpen} title={t('at_corrections', 'Correction log')} subtitle={site.name} onClose={() => setLogOpen(false)}>
        <div className="stk-screen">
          {corrections.length === 0 ? (
            <p className="is-muted">No corrections yet. When a saved mark is changed, it shows here with who changed it and when.</p>
          ) : (
            <div className="m-card m-list">
              {corrections.slice(0, 200).map((c, i) => (
                <div key={`${c.at}-${c.workerId}-${i}`} className="m-row" style={{ alignItems: 'flex-start' }}>
                  <span className="m-row-main">
                    <span className="m-row-title" style={{ display: 'block' }}>{c.workerName} · {formatDay(c.date)}</span>
                    <span className="m-row-sub" style={{ display: 'block' }}>{correctionStatusLabel(c.from)} → {correctionStatusLabel(c.to)}{c.reason ? ` · ${c.reason}` : ''}</span>
                    <span className="m-row-sub" style={{ display: 'block' }}>{formatDateTime(c.at)}{c.byName ? ` · by ${c.byName}` : ''}</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </Sheet>

      <Sheet open={salaryOpen} title={t('at_salary', 'Salary & leave rule')} subtitle={site.name} onClose={() => setSalaryOpen(false)}>
        {summary && (
          <div className="stk-screen">
            <div className="stk-summary" style={{ marginTop: 0 }}>
              <div><span>Pending</span><strong className={summary.pending > 0 ? 'is-bad' : ''}>{formatINR(summary.pending)}</strong></div>
              <div><span>Earned</span><strong>{formatINR(summary.earned)}</strong></div>
              <div><span>Paid</span><strong>{formatINR(summary.salaryPaid)}</strong></div>
            </div>
            <div className="m-card m-list" style={{ marginTop: 10 }}>
              {workers.map(w => {
                const l = summary.ledgers.get(w.id)!;
                return (
                  <button key={w.id} type="button" className="m-row" onClick={() => { setSalaryOpen(false); onOpenWorker(w.id); }}>
                    <span className="m-row-main">
                      <span className="m-row-title" style={{ display: 'block' }}>{w.name}</span>
                      <span className="m-row-sub">{formatQty(l.workedDayEquivalents)} days · {formatINR(w.dailyWage)}/day</span>
                    </span>
                    <span className="m-row-end">
                      {l.pending > 0 ? <span className="m-row-amount is-bad">{formatINR(l.pending)}</span>
                        : l.overpaid > 0 ? <span className="m-row-amount">{formatINR(l.overpaid)} ahead</span> : <Badge tone="ok">Settled</Badge>}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="m-card m-card-pad" style={{ marginTop: 12 }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>Leave pay rule</div>
              <Segmented
                label="Leave pay rule"
                value={site.leavePaid === undefined ? 'unset' : site.leavePaid ? 'paid' : 'unpaid'}
                onChange={async v => {
                  if (v === 'unset') return;
                  const r = await setLeavePolicy(user, siteId, v === 'paid');
                  onNotify(r.ok ? `Leave days are now ${v === 'paid' ? 'paid' : 'unpaid'}` : r.error, r.ok ? 'success' : 'error');
                }}
                options={[
                  ...(site.leavePaid === undefined ? [{ value: 'unset' as const, label: 'Not set' }] : []),
                  { value: 'unpaid' as const, label: 'Unpaid' },
                  { value: 'paid' as const, label: 'Paid' },
                ]}
              />
              <p className="m-calc-note">
                Day values: {ATTENDANCE_STATUS_ORDER.map(s => `${ATTENDANCE_STATUS_META[s].label} ${s === 'leave' ? (site.leavePaid ? 1 : 0) : ATTENDANCE_STATUS_META[s].multiplier}`).join(' · ')}. Pending = earned − paid − advances.
              </p>
            </div>
          </div>
        )}
      </Sheet>

      <WorkerAttendancePdfModal
        isOpen={pdfOpen}
        onClose={() => setPdfOpen(false)}
        siteId={siteId}
        siteName={site.name}
        leavePaid={site.leavePaid}
        workers={workers}
        attendance={project.attendance}
        advances={project.advances}
        salaryPayments={project.salaryPayments}
        initialMonth={monthKeyOf(date)}
        onNotify={onNotify}
      />
    </Page>
  );
};
