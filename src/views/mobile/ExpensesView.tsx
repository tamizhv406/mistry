import React, { useMemo, useState } from 'react';
import { Pencil, Plus, Trash2, Wallet } from 'lucide-react';
import type { User } from '../../db/types';
import { useProject } from '../../hooks/useProject';
import { flattenExpenses, groupTotals, sumBy, type ExpenseRow } from '../../domain/expenses';
import { correctExpense, EXPENSE_KINDS, recordExpense, removeExpense, type ExpenseKind, type ExpenseTable } from '../../services/records';
import { addDays, formatDateTime, formatDay, formatDayShort, inDayRange, monthKeyOf, todayKey } from '../../utils/datetime';
import { formatINR, parseAmount } from '../../utils/money';
import { Badge, CalcLine, Chips, ConfirmSheet, Empty, Field, Loading, Note, Page, SearchBox, Sheet, Stat } from '../../components/mobile/kit';

type RangeKey = 'today' | 'week' | 'month' | 'all' | 'custom';

interface ExpensesViewProps {
  user: User;
  siteId: string;
  onBack: () => void;
  onOpenLedger: () => void;
  onNotify: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const ExpensesView: React.FC<ExpensesViewProps> = ({ user, siteId, onBack, onOpenLedger, onNotify }) => {
  const project = useProject(siteId);
  const today = todayKey();
  const [range, setRange] = useState<RangeKey>('month');
  const [from, setFrom] = useState(addDays(today, -30));
  const [to, setTo] = useState(today);
  const [category, setCategory] = useState('all');
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState<ExpenseRow | null>(null);

  const all = useMemo(() => (project ? flattenExpenses(project) : []), [project]);

  if (project === undefined) return <Page title="Expenses" onBack={onBack}><Loading rows={5} /></Page>;
  if (project === null) return <Page title="Expenses" onBack={onBack}><div className="m-card"><Empty icon={<Wallet size={26} />} title="Project not found" /></div></Page>;

  const bounds: [string | undefined, string | undefined] =
    range === 'today' ? [today, today]
    : range === 'week' ? [addDays(today, -6), today]
    : range === 'month' ? [`${monthKeyOf(today)}-01`, today]
    : range === 'custom' ? [from || undefined, to || undefined]
    : [undefined, undefined];

  const inRange = all.filter(e => range === 'all' || inDayRange(e.date, bounds[0], bounds[1]));
  const categories = Array.from(new Set(inRange.map(e => e.category)));
  const q = query.trim().toLowerCase();
  const shown = inRange.filter(e =>
    (category === 'all' || e.category === category) &&
    (!q || `${e.title} ${e.payee} ${e.notes} ${e.category}`.toLowerCase().includes(q))
  );
  const byDay = groupTotals(shown, e => e.date, e => e.amount).sort((a, b) => b.key.localeCompare(a.key));
  const todayTotal = sumBy(all.filter(e => e.date === today), e => e.amount);
  const monthTotal = sumBy(all.filter(e => monthKeyOf(e.date) === monthKeyOf(today)), e => e.amount);
  const unpaid = sumBy(all, e => e.due);
  // Keep the open sheet in step with live data after a correction.
  const openRow = open ? all.find(e => e.id === open.id && e.table === open.table) : undefined;

  return (
    <Page title="Expenses" subtitle={project.site.name} onBack={onBack}>
      <div className="m-stats is-3">
        <Stat label="Today" value={formatINR(todayTotal)} />
        <Stat label="This month" value={formatINR(monthTotal)} />
        <Stat label="Unpaid" value={formatINR(unpaid)} tone={unpaid > 0 ? 'bad' : 'ok'} />
      </div>

      <div style={{ marginTop: 12 }}>
        <Chips
          label="Date range"
          value={range}
          onChange={setRange}
          options={[
            { value: 'today', label: 'Today' }, { value: 'week', label: 'Last 7 days' }, { value: 'month', label: 'This month' },
            { value: 'all', label: 'All' }, { value: 'custom', label: 'Custom' },
          ]}
        />
      </div>
      {range === 'custom' && (
        <div className="m-field-2" style={{ marginTop: 10 }}>
          <Field label="From"><input type="date" value={from} max={to || today} onChange={e => setFrom(e.target.value)} /></Field>
          <Field label="To"><input type="date" value={to} min={from} max={today} onChange={e => setTo(e.target.value)} /></Field>
        </div>
      )}

      {all.length === 0 ? (
        <div className="m-card" style={{ marginTop: 14 }}>
          <Empty
            icon={<Wallet size={26} />}
            title="No expenses yet"
            action={<button type="button" className="m-btn is-primary" onClick={() => setAdding(true)}><Plus size={20} /> Add expense</button>}
          >
            Record tea, fuel, transport, bills and other site spending in a few taps.
          </Empty>
        </div>
      ) : (
        <>
          <div style={{ marginTop: 10 }}><SearchBox value={query} onChange={setQuery} placeholder="Search description or payee" /></div>
          {categories.length > 1 && (
            <div style={{ marginTop: 10 }}>
              <Chips label="Category" value={category} onChange={setCategory} options={[{ value: 'all', label: 'All' }, ...categories.map(c => ({ value: c, label: c }))]} />
            </div>
          )}

          <div className="m-card m-card-pad" style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
            <span className="is-muted" style={{ fontSize: '0.88rem' }}>{shown.length} entr{shown.length === 1 ? 'y' : 'ies'} shown</span>
            <strong style={{ fontFamily: 'var(--font-heading)', fontSize: '1.15rem' }}>{formatINR(sumBy(shown, e => e.amount))}</strong>
          </div>

          {byDay.map(day => (
            <section key={day.key} className="m-section" style={{ marginTop: 14 }}>
              <div className="m-section-head">
                <h2 style={{ fontSize: '0.92rem' }}>{day.key === today ? 'Today · ' : ''}{formatDayShort(day.key)}</h2>
                <span className="is-muted" style={{ fontWeight: 700, fontSize: '0.9rem' }}>{formatINR(day.total)}</span>
              </div>
              <div className="m-card m-list">
                {shown.filter(e => e.date === day.key).map(e => (
                  <button key={`${e.table}-${e.id}`} type="button" className="m-row" onClick={() => setOpen(e)}>
                    <span className="m-row-main">
                      <span className="m-row-title" style={{ display: 'block' }}>{e.title}</span>
                      <span className="m-row-sub">{[e.category !== e.title ? e.category : '', e.payee, e.category === e.title ? e.notes : ''].filter(Boolean).join(' · ') || 'No details'}</span>
                    </span>
                    <span className="m-row-end">
                      <span className="m-row-amount" style={{ display: 'block' }}>{formatINR(e.amount)}</span>
                      {e.due > 0 && <Badge tone="bad">{e.paid > 0 ? `${formatINR(e.due)} due` : 'Unpaid'}</Badge>}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          ))}
          {shown.length === 0 && <p className="is-muted" style={{ padding: '18px 4px' }}>No expenses match these filters.</p>}
        </>
      )}

      <button type="button" className="m-fab no-print" onClick={() => setAdding(true)}><Plus size={22} /> Add expense</button>
      <div style={{ height: 72 }} aria-hidden="true" />

      {adding && <AddExpenseSheet user={user} siteId={siteId} onClose={() => setAdding(false)} onNotify={onNotify} />}
      {openRow && (
        <ExpenseDetailSheet
          row={openRow}
          user={user}
          siteId={siteId}
          onClose={() => setOpen(null)}
          onOpenLedger={onOpenLedger}
          onNotify={onNotify}
        />
      )}
    </Page>
  );
};

/* ------------------------------------------------------------------ Add */

const AddExpenseSheet: React.FC<{
  user: User;
  siteId: string;
  onClose: () => void;
  onNotify: (msg: string, type?: 'success' | 'error' | 'info') => void;
}> = ({ user, siteId, onClose, onNotify }) => {
  const [kind, setKind] = useState<ExpenseKind>('tea');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayKey());
  const [payee, setPayee] = useState('');
  const [description, setDescription] = useState('');
  const [paid, setPaid] = useState<'paid' | 'unpaid'>('paid');
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmDuplicate, setConfirmDuplicate] = useState('');

  const value = parseAmount(amount);
  const label = EXPENSE_KINDS.find(k => k.kind === kind)?.label || '';

  const submit = async (allowDuplicate: boolean) => {
    if (busy) return;
    if (Number.isNaN(value) || value <= 0) return setError('Enter an amount greater than ₹0.');
    setBusy(true);
    setError('');
    const res = await recordExpense(user, siteId, { kind, amount: value, date, payee, description, paid: paid === 'paid', paymentMode, allowDuplicate });
    setBusy(false);
    if (res.ok) {
      onNotify(`${label} expense of ${formatINR(value)} recorded`, 'success');
      onClose();
    } else if (res.duplicateOf) {
      setConfirmDuplicate(res.error);
    } else {
      setError(res.error);
    }
  };

  return (
    <>
      <Sheet
        open={!confirmDuplicate}
        title="Add expense"
        onClose={onClose}
        footer={
          <>
            <button type="button" className="m-btn" onClick={onClose} disabled={busy}>Cancel</button>
            <button type="button" className="m-btn is-primary" onClick={() => submit(false)} disabled={busy}>{busy ? 'Saving…' : 'Save expense'}</button>
          </>
        }
      >
        {error && <div style={{ marginBottom: 12 }}><Note tone="bad" role="alert">{error}</Note></div>}
        <Field label="Category">
          <Chips label="Category" value={kind} onChange={setKind} options={EXPENSE_KINDS.map(k => ({ value: k.kind, label: k.label }))} />
        </Field>
        <Field label="Amount (₹)">
          <input type="text" inputMode="decimal" autoComplete="off" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" aria-label="Amount in rupees" />
        </Field>
        <Field label="Date" hint={date !== todayKey() ? 'Past date selected. The entry time is still saved as now.' : undefined}>
          <input type="date" value={date} max={todayKey()} onChange={e => setDate(e.target.value)} />
        </Field>
        <Field label="Paid to (optional)">
          <input type="text" value={payee} onChange={e => setPayee(e.target.value)} maxLength={80} placeholder="Shop, driver or person" />
        </Field>
        <Field label="What for (optional)">
          <input type="text" value={description} onChange={e => setDescription(e.target.value)} maxLength={120} placeholder="e.g. Diesel for mixer" />
        </Field>
        <Field label="Payment">
          <Chips label="Payment status" value={paid} onChange={setPaid} options={[{ value: 'paid', label: 'Paid now' }, { value: 'unpaid', label: 'Not paid yet' }]} />
        </Field>
        {paid === 'paid' && (
          <Field label="Paid by">
            <Chips label="Payment mode" value={paymentMode} onChange={setPaymentMode} options={['Cash', 'UPI', 'Bank Transfer', 'Cheque'].map(v => ({ value: v, label: v === 'Bank Transfer' ? 'Bank' : v }))} />
          </Field>
        )}
      </Sheet>

      <ConfirmSheet
        open={!!confirmDuplicate}
        title="Record this again?"
        message={<>{confirmDuplicate} Only continue if this is a second, separate expense.</>}
        confirmLabel="Yes, record again"
        busy={busy}
        onConfirm={() => { setConfirmDuplicate(''); submit(true); }}
        onCancel={() => setConfirmDuplicate('')}
      />
    </>
  );
};

/* ------------------------------------------------------------------ Detail / correct */

const ExpenseDetailSheet: React.FC<{
  row: ExpenseRow;
  user: User;
  siteId: string;
  onClose: () => void;
  onOpenLedger: () => void;
  onNotify: (msg: string, type?: 'success' | 'error' | 'info') => void;
}> = ({ row, user, siteId, onClose, onOpenLedger, onNotify }) => {
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState(String(row.amount));
  const [date, setDate] = useState(row.date);
  const [payee, setPayee] = useState(row.payee);
  const [notes, setNotes] = useState(row.notes);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const table = row.table as ExpenseTable;

  const save = async () => {
    if (busy) return;
    const value = parseAmount(amount);
    if (Number.isNaN(value) || value <= 0) return setError('Enter an amount greater than ₹0.');
    setBusy(true);
    setError('');
    const res = await correctExpense(user, siteId, table, row.id, { amount: value, date, payee, notes });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    onNotify('Expense corrected', 'success');
    setEditing(false);
  };

  const remove = async () => {
    if (busy) return;
    setBusy(true);
    const res = await removeExpense(user, siteId, table, row.id);
    setBusy(false);
    setConfirmDelete(false);
    if (res.ok) {
      onNotify('Expense moved to Recycle Bin', 'info');
      onClose();
    } else onNotify(res.error, 'error');
  };

  return (
    <>
      <Sheet
        open={!confirmDelete}
        title={editing ? 'Correct expense' : row.title}
        subtitle={row.category}
        onClose={onClose}
        footer={
          editing ? (
            <>
              <button type="button" className="m-btn" onClick={() => { setEditing(false); setError(''); }} disabled={busy}>Cancel</button>
              <button type="button" className="m-btn is-primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save correction'}</button>
            </>
          ) : (
            <>
              <button type="button" className="m-btn" onClick={() => setConfirmDelete(true)}><Trash2 size={18} /> Delete</button>
              <button type="button" className="m-btn is-primary" onClick={() => setEditing(true)}><Pencil size={18} /> Correct</button>
            </>
          )
        }
      >
        {error && (
          <div style={{ marginBottom: 12 }}>
            <Note tone="bad" role="alert">{error}</Note>
            <button type="button" className="m-btn is-small" style={{ marginTop: 8 }} onClick={onOpenLedger}>Open the ledger</button>
          </div>
        )}
        {editing ? (
          <>
            <Field label="Amount (₹)">
              <input type="text" inputMode="decimal" autoComplete="off" value={amount} onChange={e => setAmount(e.target.value)} aria-label="Amount in rupees" />
            </Field>
            <Field label="Date"><input type="date" value={date} max={todayKey()} onChange={e => setDate(e.target.value)} /></Field>
            <Field label="Paid to"><input type="text" value={payee} onChange={e => setPayee(e.target.value)} maxLength={80} /></Field>
            <Field label="Notes"><input type="text" value={notes} onChange={e => setNotes(e.target.value)} maxLength={160} /></Field>
            <p className="m-calc-note">The original entry time is kept and this correction is added to the activity log.</p>
          </>
        ) : (
          <div className="m-calc">
            <CalcLine label="Amount" value={formatINR(row.amount)} />
            <CalcLine label="Paid" value={formatINR(row.paid)} tone={row.due > 0 ? undefined : 'ok'} />
            {row.due > 0 && <CalcLine label="Still to pay" value={formatINR(row.due)} tone="bad" />}
            <CalcLine label="Date" value={formatDay(row.date)} />
            {row.payee && <CalcLine label="Paid to" value={<span style={{ whiteSpace: 'normal' }}>{row.payee}</span>} />}
            {row.notes && <CalcLine label="Notes" value={<span style={{ whiteSpace: 'normal', fontFamily: 'var(--font-body)', fontWeight: 600 }}>{row.notes}</span>} />}
            <CalcLine label="Entered" value={formatDateTime(row.createdAt)} />
            {row.updatedAt !== row.createdAt && <CalcLine label="Last changed" value={formatDateTime(row.updatedAt)} />}
          </div>
        )}
      </Sheet>

      <ConfirmSheet
        open={confirmDelete}
        title="Delete this expense?"
        message="It will move to the Recycle Bin and leave the totals. You can restore it later."
        confirmLabel="Move to Recycle Bin"
        danger
        busy={busy}
        onConfirm={remove}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  );
};
