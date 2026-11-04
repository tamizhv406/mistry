import React, { useMemo, useState } from 'react';
import { BarChart3, Download, Printer } from 'lucide-react';
import { useProject } from '../../hooks/useProject';
import { buildProjectReport, toCsv, type ReportRange } from '../../domain/reports';
import { MATERIAL_CATEGORY_LABEL } from '../../domain/catalog';
import type { MaterialCategory } from '../../db/types';
import { addDays, addMonths, daysInMonth, formatDateTime, formatDay, formatMonth, monthKeyOf, todayKey } from '../../utils/datetime';
import { formatINR, formatQty } from '../../utils/money';
import { CalcLine, Chips, Empty, Field, Loading, Page, Stat } from '../../components/mobile/kit';

type RangeKey = 'month' | 'last' | 'all' | 'custom';

/** Creates the CSV file in the browser. Returns false if the browser could not build it. */
function downloadCsv(filename: string, csv: string): boolean {
  try {
    // The byte-order mark makes Excel read ₹ and other non-ASCII text correctly.
    const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return blob.size > 3;
  } catch {
    return false;
  }
}

const ReportCard: React.FC<{
  title: string;
  note?: React.ReactNode;
  onExport?: () => void;
  children: React.ReactNode;
}> = ({ title, note, onExport, children }) => (
  <section className="m-section">
    <div className="m-section-head">
      <h2>{title}</h2>
      {onExport && (
        <button type="button" className="m-link no-print" onClick={onExport}><Download size={16} /> CSV</button>
      )}
    </div>
    <div className="m-card m-card-pad">
      {children}
      {note && <p className="m-calc-note">{note}</p>}
    </div>
  </section>
);

interface ReportsViewProps {
  siteId: string;
  onBack: () => void;
  onNotify: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const ReportsView: React.FC<ReportsViewProps> = ({ siteId, onBack, onNotify }) => {
  const project = useProject(siteId);
  const today = todayKey();
  const [rangeKey, setRangeKey] = useState<RangeKey>('month');
  const [from, setFrom] = useState(addDays(today, -30));
  const [to, setTo] = useState(today);

  const range: ReportRange = useMemo(() => {
    const thisMonth = monthKeyOf(today);
    if (rangeKey === 'month') return { from: `${thisMonth}-01`, to: today };
    if (rangeKey === 'last') {
      const last = addMonths(thisMonth, -1);
      return { from: `${last}-01`, to: `${last}-${String(daysInMonth(last)).padStart(2, '0')}` };
    }
    if (rangeKey === 'custom') return { from: from || undefined, to: to || undefined };
    return {};
  }, [rangeKey, from, to, today]);

  const report = useMemo(
    () => (project ? buildProjectReport(project, range, { leavePaid: project.site.leavePaid }, today) : null),
    [project, range, today]
  );

  if (project === undefined) return <Page title="Reports" onBack={onBack}><Loading rows={5} /></Page>;
  if (project === null || !report) {
    return <Page title="Reports" onBack={onBack}><div className="m-card"><Empty icon={<BarChart3 size={26} />} title="Project not found" /></div></Page>;
  }

  const rangeLabel =
    rangeKey === 'all' ? 'All time'
    : rangeKey === 'month' ? formatMonth(monthKeyOf(today))
    : rangeKey === 'last' ? formatMonth(addMonths(monthKeyOf(today), -1))
    : `${range.from ? formatDay(range.from) : 'Start'} to ${range.to ? formatDay(range.to) : 'today'}`;

  const slug = project.site.name.replace(/[^\w]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'project';
  const exportCsv = (name: string, headers: string[], rows: (string | number | undefined | null)[][]) => {
    if (rows.length === 0) return onNotify('There is nothing to export for this period.', 'info');
    const file = `${slug}_${name}_${range.from || 'start'}_${range.to || today}.csv`;
    if (downloadCsv(file, toCsv(headers, rows))) onNotify(`CSV file created: ${file}`, 'success');
    else onNotify('The CSV file could not be created on this device.', 'error');
  };

  const { spend, paidOut, outstanding } = report;
  const hasAnything = spend.total > 0 || paidOut.total > 0 || report.labour.length > 0 || report.tools.length > 0 || report.materials.length > 0;

  return (
    <Page
      title="Reports"
      subtitle={<>{project.site.name} · {rangeLabel}</>}
      onBack={onBack}
      right={
        <button type="button" className="m-icon-btn is-bordered no-print" onClick={() => window.print()} aria-label="Print or save as PDF">
          <Printer size={20} />
        </button>
      }
    >
      <div className="no-print">
        <Chips
          label="Report period"
          value={rangeKey}
          onChange={setRangeKey}
          options={[{ value: 'month', label: 'This month' }, { value: 'last', label: 'Last month' }, { value: 'all', label: 'All time' }, { value: 'custom', label: 'Custom dates' }]}
        />
        {rangeKey === 'custom' && (
          <div className="m-field-2" style={{ marginTop: 10 }}>
            <Field label="From"><input type="date" value={from} max={to || today} onChange={e => setFrom(e.target.value)} /></Field>
            <Field label="To"><input type="date" value={to} min={from} max={today} onChange={e => setTo(e.target.value)} /></Field>
          </div>
        )}
      </div>

      {!hasAnything ? (
        <div className="m-card" style={{ marginTop: 14 }}>
          <Empty icon={<BarChart3 size={26} />} title="Nothing recorded yet">Reports fill in as you record attendance, purchases and expenses.</Empty>
        </div>
      ) : (
        <>
          <div className="m-stats" style={{ marginTop: 12 }}>
            <Stat label="Recorded expenditure" value={formatINR(spend.total)} hint={rangeLabel} />
            <Stat label="Paid out" value={formatINR(paidOut.total)} tone="ok" hint={rangeLabel} />
          </div>

          <ReportCard
            title="Total recorded expenditure"
            note="Counts the value of materials and tools bought, expenses recorded and wages earned in this period, whether or not they have been paid yet. Dated by purchase, expense or attendance date."
            onExport={() => exportCsv('expenditure', ['Cost head', 'Amount (INR)'], [
              ['Materials and steel', spend.materials], ['Labour wages earned', spend.labour], ['Tools (purchase, rent, repair)', spend.tools],
              ['Site expenses', spend.expenses], ['Total recorded expenditure', spend.total],
            ])}
          >
            <div className="m-calc">
              <CalcLine label="Materials and steel" value={formatINR(spend.materials)} />
              <CalcLine label="Labour wages earned" value={formatINR(spend.labour)} />
              <CalcLine label="Tools (purchase, rent, repair)" value={formatINR(spend.tools)} />
              <CalcLine label="Site expenses" value={formatINR(spend.expenses)} />
              <CalcLine total label="Total" value={formatINR(spend.total)} />
            </div>
          </ReportCard>

          <ReportCard
            title="Paid out"
            note="Cash that actually left in this period, from the payments ledger, by payment date. Labour advances are money paid out and are included here."
            onExport={() => exportCsv('paid_out', ['Paid for', 'Payments', 'Amount (INR)'], [...paidOut.byType.map(t => [t.key, t.count, t.total]), ['Total', paidOut.byType.reduce((s, t) => s + t.count, 0), paidOut.total]])}
          >
            {paidOut.byType.length === 0 ? <span className="is-muted">No payments in this period.</span> : (
              <div className="m-calc">
                {paidOut.byType.map(t => <CalcLine key={t.key} label={`${t.key} (${t.count})`} value={formatINR(t.total)} />)}
                <CalcLine total label="Total paid out" value={formatINR(paidOut.total)} tone="ok" />
              </div>
            )}
          </ReportCard>

          <ReportCard title="Still to pay (as of today)" note="The position right now, not limited to the period above.">
            <div className="m-calc">
              <CalcLine label="Material suppliers" value={formatINR(outstanding.suppliers)} />
              <CalcLine label="Pending salary" value={formatINR(outstanding.salary)} />
              <CalcLine label="Unpaid site expenses" value={formatINR(outstanding.expenses)} />
              <CalcLine label="Tool bills" value={formatINR(outstanding.tools)} />
              <CalcLine total label="Total still to pay" value={formatINR(outstanding.total)} tone={outstanding.total > 0 ? 'bad' : 'ok'} />
            </div>
          </ReportCard>

          <ReportCard
            title="Month by month"
            note="Recorded expenditure for each month in the selected period."
            onExport={() => exportCsv('monthly', ['Month', 'Materials', 'Labour', 'Tools', 'Site expenses', 'Total'], report.monthly.map(m => [m.month, m.materials, m.labour, m.tools, m.expenses, m.total]))}
          >
            {report.monthly.length === 0 ? <span className="is-muted">Nothing recorded in this period.</span> : (
              <div className="m-table-wrap">
                <table className="m-table">
                  <thead><tr><th>Month</th><th className="num">Materials</th><th className="num">Labour</th><th className="num">Tools</th><th className="num">Expenses</th><th className="num">Total</th></tr></thead>
                  <tbody>
                    {report.monthly.map(m => (
                      <tr key={m.month}>
                        <td>{formatMonth(m.month)}</td><td className="num">{formatINR(m.materials)}</td><td className="num">{formatINR(m.labour)}</td>
                        <td className="num">{formatINR(m.tools)}</td><td className="num">{formatINR(m.expenses)}</td><td className="num"><strong>{formatINR(m.total)}</strong></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </ReportCard>

          <ReportCard
            title="Site expenses by category"
            note="Tea, transport, fuel, bills and similar spending. Materials, tools and labour are separate cost heads above."
            onExport={() => exportCsv('expenses', ['Date', 'Category', 'Description', 'Paid to', 'Amount', 'Paid', 'Due', 'Entered at'], report.expenseRows.map(e => [e.date, e.category, e.title, e.payee, e.amount, e.paid, e.due, formatDateTime(e.createdAt)]))}
          >
            {report.expensesByCategory.length === 0 ? <span className="is-muted">No expenses in this period.</span> : (
              <div className="m-calc">
                {report.expensesByCategory.map(c => <CalcLine key={c.key} label={`${c.key} (${c.count})`} value={formatINR(c.total)} />)}
                <CalcLine total label="Total site expenses" value={formatINR(spend.expenses)} />
              </div>
            )}
          </ReportCard>

          <ReportCard
            title="Materials: bought, used, in stock"
            note="Bought and Used are for the selected period. In stock is the balance right now."
            onExport={() => exportCsv('materials', ['Material', 'Category', 'Unit', 'Bought qty', 'Bought cost', 'Used qty', 'In stock now'], report.materials.map(m => [m.name, MATERIAL_CATEGORY_LABEL[m.category as MaterialCategory] || m.category, m.unit, m.purchasedQty, m.purchasedCost, m.usedQty, m.onHand]))}
          >
            {report.materials.length === 0 ? <span className="is-muted">No materials recorded.</span> : (
              <div className="m-table-wrap">
                <table className="m-table">
                  <thead><tr><th>Material</th><th className="num">Bought</th><th className="num">Cost</th><th className="num">Used</th><th className="num">In stock</th></tr></thead>
                  <tbody>
                    {report.materials.map(m => (
                      <tr key={`${m.name}-${m.unit}`}>
                        <td style={{ whiteSpace: 'normal', minWidth: 130 }}>{m.name}</td>
                        <td className="num">{formatQty(m.purchasedQty)} {m.unit}</td><td className="num">{formatINR(m.purchasedCost)}</td>
                        <td className="num">{formatQty(m.usedQty)}</td><td className="num"><strong>{formatQty(m.onHand)}</strong></td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot><tr><td>Total</td><td /><td className="num">{formatINR(spend.materials)}</td><td /><td /></tr></tfoot>
                </table>
              </div>
            )}
          </ReportCard>

          <ReportCard
            title="Labour attendance and wages"
            note={`Days and wages are for the selected period. P Present, ½ Half Day, L Leave (${project.site.leavePaid === undefined ? 'pay rule not set, counted unpaid' : project.site.leavePaid ? 'paid' : 'unpaid'}), A Absent, OT Overtime.`}
            onExport={() => exportCsv('labour', ['Worker', 'Category', 'Daily wage', 'Present', 'Half day', 'Leave', 'Absent', 'Overtime', 'Worked days', 'Wages earned', 'Salary paid (period)', 'Advances (period)', 'Pending now', 'Paid ahead now'],
              report.labour.map(l => [l.name, l.category, l.dailyWage, l.counts.present, l.counts.half_day, l.counts.leave, l.counts.absent, l.counts.overtime, l.days, l.earned, l.paidInRange, l.advancesInRange, l.pending, l.overpaid]))}
          >
            {report.labour.length === 0 ? <span className="is-muted">No workers in this project.</span> : (
              <div className="m-table-wrap">
                <table className="m-table">
                  <thead><tr><th>Worker</th><th className="num">P</th><th className="num">½</th><th className="num">L</th><th className="num">A</th><th className="num">OT</th><th className="num">Days</th><th className="num">Earned</th></tr></thead>
                  <tbody>
                    {report.labour.map(l => (
                      <tr key={l.workerId}>
                        <td>{l.name}</td><td className="num">{l.counts.present}</td><td className="num">{l.counts.half_day}</td><td className="num">{l.counts.leave}</td>
                        <td className="num">{l.counts.absent}</td><td className="num">{l.counts.overtime}</td><td className="num">{formatQty(l.days)}</td><td className="num"><strong>{formatINR(l.earned)}</strong></td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot><tr><td>Total</td><td colSpan={5} /><td className="num">{formatQty(report.labour.reduce((s, l) => s + l.days, 0))}</td><td className="num">{formatINR(report.labourTotals.earned)}</td></tr></tfoot>
                </table>
              </div>
            )}
          </ReportCard>

          <ReportCard
            title="Advances and pending salary (as of today)"
            note="Pending = all wages earned − all salary paid − advances to be deducted. Paid ahead is shown separately and is not subtracted from what other workers are owed."
            onExport={() => exportCsv('salary_position', ['Worker', 'Wages earned (all time)', 'Salary paid (all time)', 'Advances to deduct', 'Pending', 'Paid ahead'], report.labour.map(l => [l.name, l.earnedAllTime, l.paidAllTime, l.advancesAllTime, l.pending, l.overpaid]))}
          >
            {report.labour.length === 0 ? <span className="is-muted">No workers in this project.</span> : (
              <div className="m-table-wrap">
                <table className="m-table">
                  <thead><tr><th>Worker</th><th className="num">Earned</th><th className="num">Paid</th><th className="num">Advances</th><th className="num">Pending</th></tr></thead>
                  <tbody>
                    {report.labour.map(l => (
                      <tr key={l.workerId}>
                        <td>{l.name}</td><td className="num">{formatINR(l.earnedAllTime)}</td><td className="num">{formatINR(l.paidAllTime)}</td><td className="num">{formatINR(l.advancesAllTime)}</td>
                        <td className="num"><strong className={l.pending > 0 ? 'is-bad' : ''}>{l.pending > 0 ? formatINR(l.pending) : l.overpaid > 0 ? `${formatINR(l.overpaid)} ahead` : '₹0'}</strong></td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot><tr><td>Total pending</td><td colSpan={3} /><td className="num">{formatINR(report.labourTotals.pending)}</td></tr></tfoot>
                </table>
              </div>
            )}
            {report.labourTotals.nonRecoverable > 0 && <p className="m-calc-note">Gifts (not deducted from salary): {formatINR(report.labourTotals.nonRecoverable)}.</p>}
          </ReportCard>

          <ReportCard
            title="Tool inventory (as of today)"
            onExport={() => exportCsv('tools', ['Tool', 'Category', 'Total', 'Available', 'Issued', 'Lost', 'Condition'], report.tools.map(t => [t.name, t.category, t.total, t.available, t.issued, t.lost, t.condition]))}
          >
            {report.tools.length === 0 ? <span className="is-muted">No tools added to this project.</span> : (
              <div className="m-table-wrap">
                <table className="m-table">
                  <thead><tr><th>Tool</th><th className="num">Total</th><th className="num">Available</th><th className="num">Issued</th><th className="num">Lost</th></tr></thead>
                  <tbody>
                    {report.tools.map(t => (
                      <tr key={t.name}><td>{t.name}</td><td className="num">{t.total}</td><td className="num">{t.available}</td><td className="num">{t.issued}</td><td className="num">{t.lost}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {report.openToolIssues.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <strong style={{ fontSize: '0.9rem' }}>Out now</strong>
                {report.openToolIssues.map((i, idx) => (
                  <div key={idx} style={{ fontSize: '0.88rem', padding: '4px 0', color: 'var(--m-ink-2)' }}>
                    {i.quantity} × {i.tool} with {i.issuedTo}, since {formatDateTime(i.issuedAt)}
                    {i.expectedReturnDate ? `, due ${formatDay(i.expectedReturnDate)}` : ''}{i.overdue ? ' (overdue)' : ''}
                  </div>
                ))}
              </div>
            )}
          </ReportCard>

          <p className="m-calc-note" style={{ marginTop: 16 }}>
            Report for {project.site.name}, {rangeLabel}. Prepared {formatDateTime(new Date())} (India time). Figures come from the records entered in this app.
          </p>
          <button type="button" className="m-btn is-block no-print" style={{ marginTop: 10 }} onClick={() => window.print()}>
            <Printer size={20} /> Print or save as PDF
          </button>
        </>
      )}
    </Page>
  );
};
