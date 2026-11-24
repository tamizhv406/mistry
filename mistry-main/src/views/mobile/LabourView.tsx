import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, UserPlus, Users } from 'lucide-react';
import type { AttendanceStatus, LabourWorker, User } from '../../db/types';
import { useProject } from '../../hooks/useProject';
import {
  ATTENDANCE_STATUS_META, ATTENDANCE_STATUS_ORDER, buildSiteLabourSummary, countByStatus, dedupeAttendance, summariseMonth,
} from '../../domain/salary';
import { markAttendance, setLeavePolicy } from '../../services/records';
import { addMonths, formatDay, formatMonth, monthKeyOf, todayKey } from '../../utils/datetime';
import { formatINR, formatQty } from '../../utils/money';
import { Badge, DayBar, Empty, Loading, Note, Page, SearchBox, Section, Segmented, Stat } from '../../components/mobile/kit';

type Tab = 'day' | 'month' | 'salary';

const BUTTON_LABEL: Record<AttendanceStatus, string> = {
  present: 'Present',
  half_day: 'Half Day',
  leave: 'Leave',
  absent: 'Absent',
  overtime: 'Over-time',
};

interface LabourViewProps {
  user: User;
  siteId: string;
  onBack: () => void;
  onOpenWorker: (workerId: string) => void;
  onAddWorker: () => void;
  onNotify: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const LabourView: React.FC<LabourViewProps> = ({ user, siteId, onBack, onOpenWorker, onAddWorker, onNotify }) => {
  const project = useProject(siteId);
  const [tab, setTab] = useState<Tab>('day');
  const [date, setDate] = useState(todayKey());
  const [month, setMonth] = useState(monthKeyOf(todayKey()));
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  const policy = useMemo(() => ({ leavePaid: project?.site.leavePaid }), [project?.site.leavePaid]);

  const summary = useMemo(
    () => (project ? buildSiteLabourSummary(project.workers, project.attendance, project.advances, project.salaryPayments, policy) : null),
    [project, policy]
  );

  const dayMarks = useMemo(() => {
    const map = new Map<string, AttendanceStatus>();
    if (!project) return map;
    for (const r of dedupeAttendance(project.attendance.filter(a => a.date === date)).records) map.set(r.workerId, r.status);
    return map;
  }, [project, date]);

  if (project === undefined) return <Page title="Attendance" onBack={onBack}><Loading rows={5} /></Page>;
  if (project === null || !summary) {
    return (
      <Page title="Attendance" onBack={onBack}>
        <div className="m-card"><Empty icon={<Users size={26} />} title="Project not found">It may have been moved to the Recycle Bin.</Empty></div>
      </Page>
    );
  }

  const { workers, site } = project;
  const q = query.trim().toLowerCase();
  const shown = q ? workers.filter(w => `${w.name} ${w.category} ${w.phone}`.toLowerCase().includes(q)) : workers;
  const counts = countByStatus(project.attendance.filter(a => a.date === date));
  const unmarked = workers.filter(w => !dayMarks.has(w.id));
  const hasLeave = project.attendance.some(a => a.status === 'leave');

  const mark = async (worker: LabourWorker, status: AttendanceStatus) => {
    if (saving || dayMarks.get(worker.id) === status) return;
    setSaving(worker.id);
    const res = await markAttendance(user, siteId, worker, date, status);
    setSaving(null);
    if (!res.ok) onNotify(res.error, 'error');
  };

  const markAllUnmarkedPresent = async () => {
    if (bulkBusy || unmarked.length === 0) return;
    setBulkBusy(true);
    let failed = 0;
    for (const w of unmarked) {
      const res = await markAttendance(user, siteId, w, date, 'present');
      if (!res.ok) failed += 1;
    }
    setBulkBusy(false);
    if (failed) onNotify(`${failed} worker(s) could not be marked.`, 'error');
    else onNotify(`${unmarked.length} worker${unmarked.length === 1 ? '' : 's'} marked Present for ${formatDay(date)}`, 'success');
  };

  const choosePolicy = async (leavePaid: boolean) => {
    const res = await setLeavePolicy(user, siteId, leavePaid);
    if (res.ok) onNotify(`Leave days are now ${leavePaid ? 'paid' : 'unpaid'} for this project`, 'success');
    else onNotify(res.error, 'error');
  };

  const policyCard = (
    <div className="m-card m-card-pad" style={{ marginTop: 12 }}>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>Leave pay rule</div>
      <p className="is-muted" style={{ fontSize: '0.86rem', marginBottom: 10 }}>
        {site.leavePaid === undefined
          ? 'Not chosen yet. Until you choose, Leave days are counted as unpaid.'
          : site.leavePaid
          ? 'Leave days are paid as a full day.'
          : 'Leave days are not paid.'}
        {' '}Absent days are never paid.
      </p>
      <Segmented
        label="Leave pay rule"
        value={site.leavePaid === undefined ? 'unset' : site.leavePaid ? 'paid' : 'unpaid'}
        onChange={v => v !== 'unset' && choosePolicy(v === 'paid')}
        options={[
          ...(site.leavePaid === undefined ? [{ value: 'unset' as const, label: 'Not set' }] : []),
          { value: 'unpaid' as const, label: 'Leave unpaid' },
          { value: 'paid' as const, label: 'Leave paid' },
        ]}
      />
    </div>
  );

  return (
    <Page
      title="Attendance & Salary"
      subtitle={site.name}
      onBack={onBack}
      right={
        <button type="button" className="m-icon-btn is-bordered" onClick={onAddWorker} aria-label="Add worker">
          <UserPlus size={22} />
        </button>
      }
    >
      <Segmented
        label="View"
        value={tab}
        onChange={setTab}
        options={[{ value: 'day', label: 'Daily' }, { value: 'month', label: 'Monthly' }, { value: 'salary', label: 'Salary' }]}
      />

      {workers.length === 0 ? (
        <div className="m-card" style={{ marginTop: 14 }}>
          <Empty
            icon={<Users size={26} />}
            title="No workers yet"
            action={<button type="button" className="m-btn is-primary" onClick={onAddWorker}><UserPlus size={20} /> Add worker</button>}
          >
            Add each worker with their daily wage. Then mark attendance with one tap.
          </Empty>
        </div>
      ) : tab === 'day' ? (
        <>
          <div style={{ marginTop: 12 }}><DayBar value={date} onChange={setDate} /></div>

          <div className="m-stats is-4" style={{ marginTop: 10 }}>
            <Stat label="Present" value={counts.present + counts.overtime} tone="ok" hint={counts.overtime ? `${counts.overtime} OT` : undefined} />
            <Stat label="Half day" value={counts.half_day} tone="warn" />
            <Stat label="Leave" value={counts.leave} tone="info" />
            <Stat label="Absent" value={counts.absent} tone="bad" />
          </div>

          {unmarked.length > 0 && (
            <button type="button" className="m-btn is-block" style={{ marginTop: 10 }} onClick={markAllUnmarkedPresent} disabled={bulkBusy}>
              {bulkBusy ? 'Marking…' : `Mark ${unmarked.length} unmarked as Present`}
            </button>
          )}

          {workers.length > 5 && <div style={{ marginTop: 10 }}><SearchBox value={query} onChange={setQuery} placeholder="Search worker name" /></div>}

          <div className="m-card m-list" style={{ marginTop: 10 }}>
            {shown.map(w => {
              const current = dayMarks.get(w.id);
              return (
                <div key={w.id} className="m-att-row">
                  <button type="button" className="m-att-top" onClick={() => onOpenWorker(w.id)} aria-label={`Open ${w.name}'s profile`}>
                    <span className="m-dot" data-status={current || ''} aria-hidden="true" />
                    <span className="m-att-name">{w.name}</span>
                    <span className="m-att-meta">{w.category} · {formatINR(w.dailyWage)}</span>
                    <ChevronRight size={18} className="is-muted" />
                  </button>
                  <div className="m-att-btns" role="group" aria-label={`Attendance for ${w.name} on ${formatDay(date)}`}>
                    {ATTENDANCE_STATUS_ORDER.map(s => (
                      <button
                        key={s}
                        type="button"
                        className="m-att-btn"
                        data-status={s}
                        aria-pressed={current === s}
                        disabled={saving === w.id}
                        onClick={() => mark(w, s)}
                      >
                        {BUTTON_LABEL[s]}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
            {shown.length === 0 && <div className="m-row is-muted">No worker matches "{query}".</div>}
          </div>
          <p className="m-calc-note">
            Each tap saves straight away. Tap a different status to correct it; the change is logged on the worker's profile.
          </p>
        </>
      ) : tab === 'month' ? (
        <>
          <div className="m-daybar" style={{ marginTop: 12 }}>
            <button type="button" className="m-icon-btn" onClick={() => setMonth(addMonths(month, -1))} aria-label="Previous month"><ChevronLeft size={24} /></button>
            <div className="m-daybar-main"><span className="m-daybar-date">{formatMonth(month)}</span></div>
            <button
              type="button"
              className="m-icon-btn"
              onClick={() => setMonth(addMonths(month, 1))}
              disabled={month >= monthKeyOf(todayKey())}
              style={{ opacity: month >= monthKeyOf(todayKey()) ? 0.3 : 1 }}
              aria-label="Next month"
            >
              <ChevronRight size={24} />
            </button>
          </div>

          {(() => {
            const rows = workers.map(w => ({ w, m: summariseMonth(summary.ledgers.get(w.id)!, month) }));
            const total = rows.reduce((s, r) => s + r.m.earned, 0);
            const days = rows.reduce((s, r) => s + r.m.workedDayEquivalents, 0);
            return (
              <>
                <div className="m-stats" style={{ marginTop: 10 }}>
                  <Stat label="Worked days" value={formatQty(days)} hint="Day equivalents, all workers" />
                  <Stat label="Wages earned" value={formatINR(total)} hint={formatMonth(month)} />
                </div>
                <div className="m-card m-list" style={{ marginTop: 10 }}>
                  {rows.map(({ w, m }) => (
                    <button key={w.id} type="button" className="m-row" onClick={() => onOpenWorker(w.id)}>
                      <span className="m-row-main">
                        <span className="m-row-title" style={{ display: 'block' }}>{w.name}</span>
                        <span style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 5 }}>
                          <Badge tone="ok">P {m.counts.present}</Badge>
                          <Badge tone="warn">½ {m.counts.half_day}</Badge>
                          <Badge tone="info">L {m.counts.leave}</Badge>
                          <Badge tone="bad">A {m.counts.absent}</Badge>
                          {m.counts.overtime > 0 && <Badge tone="violet">OT {m.counts.overtime}</Badge>}
                        </span>
                      </span>
                      <span className="m-row-end">
                        <span className="m-row-amount" style={{ display: 'block' }}>{formatINR(m.earned)}</span>
                        <span className="m-row-sub">{formatQty(m.workedDayEquivalents)} days</span>
                      </span>
                    </button>
                  ))}
                </div>
              </>
            );
          })()}
        </>
      ) : (
        <>
          <div className="m-stats" style={{ marginTop: 12 }}>
            <Stat label="Salary pending" value={formatINR(summary.pending)} tone={summary.pending > 0 ? 'bad' : 'ok'} hint="Owed to workers now" />
            <Stat label="Wages earned" value={formatINR(summary.earned)} hint="From attendance, all time" />
            <Stat label="Salary paid" value={formatINR(summary.salaryPaid)} tone="ok" />
            <Stat label="Advances" value={formatINR(summary.recoverableAdvances)} hint="Deducted from salary" />
          </div>
          {summary.overpaid > 0 && (
            <div style={{ marginTop: 10 }}>
              <Note>{formatINR(summary.overpaid)} has been paid ahead to workers who have received more than they have earned so far. It is not subtracted from what other workers are owed.</Note>
            </div>
          )}

          <Section title="Workers">
            <div className="m-card m-list">
              {workers.map(w => {
                const l = summary.ledgers.get(w.id)!;
                return (
                  <button key={w.id} type="button" className="m-row" onClick={() => onOpenWorker(w.id)}>
                    <span className="m-row-main">
                      <span className="m-row-title" style={{ display: 'block' }}>{w.name}</span>
                      <span className="m-row-sub">
                        {formatQty(l.workedDayEquivalents)} days · earned {formatINR(l.earned)} · paid {formatINR(l.salaryPaid)}
                      </span>
                    </span>
                    <span className="m-row-end">
                      {l.pending > 0 ? (
                        <><span className="m-row-amount is-bad" style={{ display: 'block' }}>{formatINR(l.pending)}</span><span className="m-row-sub">pending</span></>
                      ) : l.overpaid > 0 ? (
                        <><span className="m-row-amount is-info" style={{ display: 'block' }}>{formatINR(l.overpaid)}</span><span className="m-row-sub">paid ahead</span></>
                      ) : (
                        <Badge tone="ok">Settled</Badge>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          </Section>

          {policyCard}
          {hasLeave && site.leavePaid === undefined && (
            <div style={{ marginTop: 10 }}><Note tone="warn">Some workers have Leave days. Choose the leave pay rule above so salary is calculated the way you intend.</Note></div>
          )}
          <p className="m-calc-note">
            Pending = wages earned − salary paid − advances to be deducted. Day values: {ATTENDANCE_STATUS_ORDER.map(s => `${ATTENDANCE_STATUS_META[s].label} ${s === 'leave' ? (site.leavePaid ? 1 : 0) : ATTENDANCE_STATUS_META[s].multiplier}`).join(' · ')}.
          </p>
        </>
      )}
    </Page>
  );
};
