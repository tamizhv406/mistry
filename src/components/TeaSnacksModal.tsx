import React, { useState, useEffect } from 'react';
import { X, Save, Coffee, ArrowUpRight } from 'lucide-react';
import { db } from '../db/db';
import type { TeaSnacksExpense } from '../db/types';
import { VoiceInputField } from './VoiceInputField';
import { getCurrentUser } from '../services/auth';
import { calculateFinancialBalance, recordPaymentTransaction } from '../utils/financial';

interface TeaSnacksModalProps {
  isOpen: boolean;
  siteId: string;
  expenseToEdit?: TeaSnacksExpense | null;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export const TeaSnacksModal: React.FC<TeaSnacksModalProps> = ({
  isOpen,
  siteId,
  expenseToEdit,
  onClose,
  onSuccess,
}) => {
  const [date, setDate] = useState('');
  const [teaExpense, setTeaExpense] = useState('120');
  const [snacksExpense, setSnacksExpense] = useState('180');
  const [juiceExpense, setJuiceExpense] = useState('100');
  const [otherFoodExpense, setOtherFoodExpense] = useState('0');
  const [paidAmount, setPaidAmount] = useState('0'); // Default: Paid Amount = 0
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  const currentUser = getCurrentUser();

  useEffect(() => {
    if (expenseToEdit) {
      setDate(expenseToEdit.date);
      setTeaExpense(expenseToEdit.teaExpense.toString());
      setSnacksExpense(expenseToEdit.snacksExpense.toString());
      setJuiceExpense((expenseToEdit.juiceExpense || 0).toString());
      setOtherFoodExpense(expenseToEdit.otherFoodExpense?.toString() || '0');
      setPaidAmount(expenseToEdit.paidAmount?.toString() || '0');
      setNotes(expenseToEdit.notes || '');
    } else {
      const today = new Date().toISOString().slice(0, 10);
      setDate(today);
      setTeaExpense('120');
      setSnacksExpense('180');
      setJuiceExpense('100');
      setOtherFoodExpense('0');
      setPaidAmount('0'); // Default: Paid Amount = 0
      setPaymentMode('Cash');
      setNotes('');
      setError('');
    }
  }, [expenseToEdit, isOpen]);

  if (!isOpen) return null;

  const numTea = Math.max(0, parseFloat(teaExpense) || 0);
  const numSnacks = Math.max(0, parseFloat(snacksExpense) || 0);
  const numJuice = Math.max(0, parseFloat(juiceExpense) || 0);
  const numOther = Math.max(0, parseFloat(otherFoodExpense) || 0);
  const calculatedTotal = Math.round(numTea + numSnacks + numJuice + numOther);

  const numPaid = Math.max(0, parseFloat(paidAmount) || 0);
  const fin = calculateFinancialBalance(calculatedTotal, numPaid);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (calculatedTotal <= 0) {
      setError('Please enter at least one expense amount.');
      return;
    }

    const now = new Date().toISOString();
    const id = expenseToEdit ? expenseToEdit.id : `tea-${Date.now()}`;
    const targetUserId = expenseToEdit?.userId || currentUser?.id || 'user-admin-default';

    const record: TeaSnacksExpense = {
      id,
      userId: targetUserId,
      siteId,
      date: date || now.slice(0, 10),
      teaExpense: numTea,
      snacksExpense: numSnacks,
      juiceExpense: numJuice,
      otherFoodExpense: numOther,
      totalAmount: calculatedTotal,
      paidAmount: fin.paidAmount,
      balance: fin.balanceDue,
      extraPaid: fin.extraPaid,
      notes: notes.trim(),
      isDeleted: false,
      createdAt: expenseToEdit ? expenseToEdit.createdAt : now,
      updatedAt: now,
    };

    try {
      await db.teaSnacksExpenses.put(record);

      // Record individual payment transaction if initial payment made
      if (!expenseToEdit && fin.paidAmount > 0) {
        await recordPaymentTransaction({
          siteId,
          relatedRecordId: id,
          tableName: 'teaSnacksExpenses',
          amount: fin.paidAmount,
          paymentType: paymentMode,
          date: date || now.slice(0, 10),
          notes: notes ? `Tea Stall payment: ${notes}` : `Tea & Refreshments settlement`,
          module: 'TeaSnacks',
          userId: targetUserId,
        });
      }

      onSuccess(
        expenseToEdit
          ? 'Tea, snacks & juice record updated'
          : `Daily refreshments (₹${calculatedTotal}) recorded`
      );
      onClose();
    } catch (err: any) {
      setError('Failed to save tea expense: ' + err.message);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-dialog" onClick={e => e.stopPropagation()} style={{ maxWidth: '640px' }}>
        <div className="modal-header">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
            <Coffee size={22} color="#f59e0b" />
            <span>{expenseToEdit ? 'Edit Tea & Refreshments' : 'Add Daily Tea, Snacks & Juice'}</span>
          </h3>
          <button className="modal-close-btn" onClick={onClose} type="button" aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form-container">
          <div className="modal-body space-y-4">
            {error && (
              <div
                style={{
                  backgroundColor: '#fee2e2',
                  border: '1px solid #ef4444',
                  color: '#991b1b',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  fontSize: '0.88rem',
                  fontWeight: 600,
                }}
              >
                ⚠️ {error}
              </div>
            )}

            <div className="form-group space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Date (தேதி)</label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="form-group space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  ☕ Tea Expense (டீ செலவு) (₹)
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={teaExpense}
                  onChange={e => setTeaExpense(e.target.value)}
                  className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                  autoFocus
                />
              </div>

              <div className="form-group space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  🍪 Snacks Expense (வடை / பிஸ்கட்) (₹)
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={snacksExpense}
                  onChange={e => setSnacksExpense(e.target.value)}
                  className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                />
              </div>

              <div className="form-group space-y-1.5">
                <label className="text-xs font-semibold text-emerald-400">
                  🧃 Fresh Juice (பழச்சாறு) (₹)
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={juiceExpense}
                  onChange={e => setJuiceExpense(e.target.value)}
                  className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl px-3 py-2 text-sm text-slate-100 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                />
              </div>
            </div>

            <div className="form-group space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                🍱 Other Food / Meals (உணவு / சாப்பாடு) (₹)
              </label>
              <input
                type="number"
                step="any"
                min="0"
                value={otherFoodExpense}
                onChange={e => setOtherFoodExpense(e.target.value)}
                className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              />
            </div>

            {/* Universal 4-Box Financial Status Ribbon */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(115px, 1fr))',
              gap: '8px',
              marginBottom: '16px',
            }}>
              <div style={{ background: '#eff6ff', padding: '8px 10px', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
                <span style={{ fontSize: '0.7rem', color: '#1d4ed8', fontWeight: 600, display: 'block' }}>TOTAL REFRESHMENT</span>
                <strong style={{ fontSize: '1rem', color: '#1e3a8a' }}>₹{fin.totalAmount.toLocaleString('en-IN')}</strong>
              </div>
              <div style={{ background: '#ecfdf5', padding: '8px 10px', borderRadius: '8px', border: '1px solid #a7f3d0' }}>
                <span style={{ fontSize: '0.7rem', color: '#047857', fontWeight: 600, display: 'block' }}>PAID TODAY</span>
                <strong style={{ fontSize: '1rem', color: '#065f46' }}>₹{fin.paidAmount.toLocaleString('en-IN')}</strong>
              </div>
              <div style={{ background: fin.balanceDue > 0 ? '#fef2f2' : '#f8fafc', padding: '8px 10px', borderRadius: '8px', border: fin.balanceDue > 0 ? '1px solid #fecaca' : '1px solid var(--border-light)' }}>
                <span style={{ fontSize: '0.7rem', color: fin.balanceDue > 0 ? '#b91c1c' : '#64748b', fontWeight: 600, display: 'block' }}>STALL DUE</span>
                <strong style={{ fontSize: '1rem', color: fin.balanceDue > 0 ? '#b91c1c' : '#64748b' }}>₹{fin.balanceDue.toLocaleString('en-IN')}</strong>
              </div>
              <div style={{ background: fin.extraPaid > 0 ? '#f5f3ff' : '#f8fafc', padding: '8px 10px', borderRadius: '8px', border: fin.extraPaid > 0 ? '1.5px solid #ddd6fe' : '1px solid var(--border-light)' }}>
                <span style={{ fontSize: '0.7rem', color: fin.extraPaid > 0 ? '#6d28d9' : '#64748b', fontWeight: 600, display: 'block' }}>EXTRA PAID</span>
                <strong style={{ fontSize: '1rem', color: fin.extraPaid > 0 ? '#6d28d9' : '#64748b' }}>₹{fin.extraPaid.toLocaleString('en-IN')}</strong>
              </div>
            </div>

            {fin.extraPaid > 0 && (
              <div style={{
                backgroundColor: '#f5f3ff',
                color: '#6d28d9',
                padding: '8px 12px',
                borderRadius: '8px',
                fontSize: '0.82rem',
                fontWeight: 600,
                marginBottom: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}>
                <ArrowUpRight size={16} />
                <span>Extra Paid: ₹{fin.extraPaid.toLocaleString('en-IN')} advance paid to stall. Balance Due is ₹0.</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="form-group space-y-1.5">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="text-xs font-semibold text-slate-300">
                    Amount Paid (₹)
                  </label>
                  {calculatedTotal > 0 && (
                    <button
                      type="button"
                      onClick={() => setPaidAmount(calculatedTotal.toString())}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#f59e0b',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        padding: 0,
                      }}
                    >
                      Pay Full
                    </button>
                  )}
                </div>
                <input
                  type="number"
                  step="any"
                  min="0"
                  placeholder="0"
                  value={paidAmount}
                  onChange={e => setPaidAmount(e.target.value)}
                  className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                />
                <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Default: 0</span>
              </div>

              <div className="form-group space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Payment Mode</label>
                <select
                  value={paymentMode}
                  onChange={e => setPaymentMode(e.target.value)}
                  className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                >
                  <option value="Cash">💵 Cash</option>
                  <option value="UPI">📱 UPI / GPay / PhonePe</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="form-group space-y-1.5">
                <VoiceInputField
                  label="Notes / Tea Stall Name"
                  tamilLabel="கடை பெயர் / குறிப்பு"
                  value={notes}
                  onChange={setNotes}
                  placeholder="e.g. Balaji Tea Stall, afternoon lemon juice"
                />
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" style={{ minWidth: '150px' }}>
              <Save size={18} />
              <span>{expenseToEdit ? 'Save Changes' : 'Save Refreshments'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
