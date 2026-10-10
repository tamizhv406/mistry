import React, { useEffect, useState } from 'react';
import type { LabourAdvance, LabourWorker, SalaryPayment, User } from '../../db/types';
import { saveAdvance, saveSalaryPayment } from '../../services/records';
import { formatDay, todayKey } from '../../utils/datetime';
import { formatINR, parseAmount } from '../../utils/money';
import { Chips, ConfirmSheet, Field, Note, Sheet } from './kit';

export type MoneySheetMode =
  | { kind: 'salary'; payment?: SalaryPayment }
  | { kind: 'advance'; advance?: LabourAdvance };

const PAYMENT_MODES = [
  { value: 'Cash', label: 'Cash' },
  { value: 'UPI', label: 'UPI' },
  { value: 'Bank Transfer', label: 'Bank' },
  { value: 'Cheque', label: 'Cheque' },
];

/**
 * Pay salary / give advance / correct either. The save button is disabled while saving and
 * an identical entry on the same day needs an explicit second confirmation.
 */
export const MoneySheet: React.FC<{
  open: boolean;
  mode: MoneySheetMode;
  user: User;
  siteId: string;
  worker: LabourWorker;
  pending: number;
  onClose: () => void;
  onSaved: (message: string) => void;
}> = ({ open, mode, user, siteId, worker, pending, onClose, onSaved }) => {
  const editing = mode.kind === 'salary' ? mode.payment : mode.advance;
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayKey());
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [advanceType, setAdvanceType] = useState<'Recoverable' | 'Non-Recoverable'>('Recoverable');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmDuplicate, setConfirmDuplicate] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError('');
    setBusy(false);
    setConfirmDuplicate(false);
    if (mode.kind === 'salary' && mode.payment) {
      setAmount(String(mode.payment.paidAmount));
      setDate(mode.payment.date);
      setPaymentMode(mode.payment.paymentMode || 'Cash');
      setNotes(mode.payment.notes || '');
    } else if (mode.kind === 'advance' && mode.advance) {
      setAmount(String(mode.advance.amount));
      setDate(mode.advance.date);
      setAdvanceType(mode.advance.advanceType === 'Non-Recoverable' ? 'Non-Recoverable' : 'Recoverable');
      setNotes(mode.advance.reason || mode.advance.notes || '');
      setPaymentMode('Cash');
    } else {
      setAmount('');
      setDate(todayKey());
      setPaymentMode('Cash');
      setAdvanceType('Recoverable');
      setNotes('');
    }
    // Reset only when the sheet opens or switches to a different entry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode.kind, editing?.id]);

  const isSalary = mode.kind === 'salary';
  const title = editing ? (isSalary ? 'Correct salary payment' : 'Correct advance') : isSalary ? 'Pay salary' : 'Give advance';
  const value = parseAmount(amount);

  const submit = async (allowDuplicate: boolean) => {
    if (busy) return;
    if (Number.isNaN(value) || value <= 0) {
      setError('Enter an amount greater than ₹0.');
      return;
    }
    setBusy(true);
    setError('');
    const res = isSalary
      ? await saveSalaryPayment(user, siteId, { id: editing?.id, workerId: worker.id, date, amount: value, paymentMode, notes, allowDuplicate })
      : await saveAdvance(user, siteId, { id: editing?.id, workerId: worker.id, date, amount: value, paymentMode, notes, reason: notes, advanceType, allowDuplicate });
    setBusy(false);
    if (res.ok) {
      setConfirmDuplicate(false);
      onSaved(
        editing
          ? `${isSalary ? 'Salary payment' : 'Advance'} corrected`
          : `${isSalary ? 'Salary' : 'Advance'} of ${formatINR(value)} recorded for ${worker.name}`
      );
      onClose();
    } else if (res.duplicateOf) {
      setConfirmDuplicate(true);
    } else {
      setConfirmDuplicate(false);
      setError(res.error);
    }
  };

  return (
    <>
      <Sheet
        open={open && !confirmDuplicate}
        title={title}
        subtitle={`${worker.name} · ${formatINR(worker.dailyWage)}/day`}
        onClose={onClose}
        footer={
          <>
            <button type="button" className="m-btn" onClick={onClose} disabled={busy}>Cancel</button>
            <button type="button" className="m-btn is-primary" onClick={() => submit(false)} disabled={busy}>
              {busy ? 'Saving…' : editing ? 'Save correction' : isSalary ? 'Record payment' : 'Record advance'}
            </button>
          </>
        }
      >
        {error && <div style={{ marginBottom: 12 }}><Note tone="bad" role="alert">{error}</Note></div>}

        <Field
          label="Amount (₹)"
          hint={isSalary && !editing ? (pending > 0 ? `Pending salary is ${formatINR(pending)}.` : 'Nothing is pending. A payment now will show as paid ahead.') : undefined}
        >
          <input type="text" inputMode="decimal" autoComplete="off" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" aria-label="Amount in rupees" />
        </Field>
        {isSalary && !editing && pending > 0 && (
          <button type="button" className="m-btn is-small" style={{ marginTop: -6, marginBottom: 14 }} onClick={() => setAmount(String(pending))}>
            Pay full pending {formatINR(pending)}
          </button>
        )}

        {!isSalary && (
          <Field
            label="Advance type"
            hint={advanceType === 'Recoverable' ? 'Will be deducted from the salary still to be paid.' : 'A gift or grant. It is recorded but never deducted from salary.'}
          >
            <Chips
              label="Advance type"
              value={advanceType}
              onChange={setAdvanceType}
              options={[{ value: 'Recoverable', label: 'Deduct from salary' }, { value: 'Non-Recoverable', label: 'Gift (not deducted)' }]}
            />
          </Field>
        )}

        <Field label="Date" hint={date !== todayKey() ? 'Past date selected. The entry time is still saved as now.' : undefined}>
          <input type="date" value={date} max={todayKey()} onChange={e => setDate(e.target.value)} />
        </Field>

        <Field label="Paid by">
          <Chips label="Payment mode" value={paymentMode} onChange={setPaymentMode} options={PAYMENT_MODES} />
        </Field>

        <Field label={isSalary ? 'Note (optional)' : 'Reason (optional)'}>
          <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder={isSalary ? 'e.g. Week 2 settlement' : 'e.g. Festival advance'} maxLength={120} />
        </Field>
      </Sheet>

      <ConfirmSheet
        open={open && confirmDuplicate}
        title="Record this again?"
        message={
          <>
            {isSalary ? 'A salary payment' : 'An advance'} of <strong>{formatINR(value || 0)}</strong> to <strong>{worker.name}</strong> on{' '}
            <strong>{formatDay(date)}</strong> is already recorded. Only continue if this is a second, separate payment.
          </>
        }
        confirmLabel="Yes, record again"
        busy={busy}
        onConfirm={() => submit(true)}
        onCancel={() => setConfirmDuplicate(false)}
      />
    </>
  );
};
