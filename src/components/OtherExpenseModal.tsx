import React, { useState, useEffect } from 'react';
import { X, Save, Wallet, ArrowUpRight } from 'lucide-react';
import { db } from '../db/db';
import type { OtherExpense, OtherExpenseCategory } from '../db/types';
import { calculateFinancialBalance, recordPaymentTransaction } from '../utils/financial';
import { getCurrentUser } from '../services/auth';

interface OtherExpenseModalProps {
  isOpen: boolean;
  siteId: string;
  expenseToEdit?: OtherExpense | null;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

const CATEGORIES: OtherExpenseCategory[] = [
  'Transport',
  'Fuel',
  'Repair',
  'Equipment',
  'Miscellaneous',
  'Other',
];

export const OtherExpenseModal: React.FC<OtherExpenseModalProps> = ({
  isOpen,
  siteId,
  expenseToEdit,
  onClose,
  onSuccess,
}) => {
  const [date, setDate] = useState('');
  const [category, setCategory] = useState<OtherExpenseCategory>('Transport');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('0');
  const [paidAmount, setPaidAmount] = useState('0'); // Default: Paid Amount = 0
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  const currentUser = getCurrentUser();

  useEffect(() => {
    if (expenseToEdit) {
      setDate(expenseToEdit.date);
      setCategory(expenseToEdit.category);
      setDescription(expenseToEdit.description);
      setAmount(expenseToEdit.amount.toString());
      setPaidAmount(expenseToEdit.paidAmount.toString());
      setNotes(expenseToEdit.notes || '');
    } else {
      const today = new Date().toISOString().slice(0, 10);
      setDate(today);
      setCategory('Transport');
      setDescription('Scaffolding pipe transport lorry');
      setAmount('1200');
      setPaidAmount('0'); // Default: Paid Amount = 0
      setPaymentMode('Cash');
      setNotes('');
      setError('');
    }
  }, [expenseToEdit, isOpen]);

  if (!isOpen) return null;

  const numAmount = Math.max(0, parseFloat(amount) || 0);
  const numPaid = Math.max(0, parseFloat(paidAmount) || 0);
  const fin = calculateFinancialBalance(numAmount, numPaid);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!description.trim()) {
      setError('Please describe this expense.');
      return;
    }
    if (numAmount <= 0) {
      setError('Expense amount must be greater than ₹0.');
      return;
    }

    const now = new Date().toISOString();
    const id = expenseToEdit ? expenseToEdit.id : `oth-${Date.now()}`;

    const record: OtherExpense = {
      id,
      siteId,
      date: date || now.slice(0, 10),
      category,
      description: description.trim(),
      amount: numAmount,
      paidAmount: fin.paidAmount,
      balance: fin.balanceDue,
      extraPaid: fin.extraPaid,
      notes: notes.trim(),
      isDeleted: false,
      createdAt: expenseToEdit ? expenseToEdit.createdAt : now,
      updatedAt: now,
    };

    try {
      await db.otherExpenses.put(record);

      // Record individual payment transaction if initial payment made
      if (!expenseToEdit && fin.paidAmount > 0) {
        await recordPaymentTransaction({
          siteId,
          relatedRecordId: id,
          tableName: 'otherExpenses',
          amount: fin.paidAmount,
          paymentType: paymentMode,
          date: date || now.slice(0, 10),
          notes: `${category}: ${description.trim()}`,
          module: 'OtherExpense',
          userId: currentUser?.id,
        });
      }

      await db.logActivity(siteId, undefined, 'Expense Logged', `${category}: ${description.trim()} (₹${numAmount})`, numAmount);
      onSuccess(expenseToEdit ? 'Expense record updated' : `Expense for "${category}" recorded`);
      onClose();
    } catch (err: any) {
      setError('Failed to save expense: ' + err.message);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-dialog" onClick={e => e.stopPropagation()} style={{ maxWidth: '640px' }}>
        <div className="modal-header">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Wallet size={22} color="#f59e0b" />
            {expenseToEdit ? 'Edit Site Expense' : 'Add Miscellaneous / Other Expense'}
          </h3>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && (
              <div style={{
                backgroundColor: '#fee2e2',
                color: '#991b1b',
                padding: '10px 14px',
                borderRadius: '8px',
                fontSize: '0.88rem',
                fontWeight: 600,
                marginBottom: '12px',
              }}>
                {error}
              </div>
            )}

            <div className="form-grid-2">
              <div className="form-group">
                <label>Category <span className="required">*</span></label>
                <select value={category} onChange={e => setCategory(e.target.value as any)}>
                  {CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Date <span className="required">*</span></label>
                <input
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label>Description / Vendor / Item <span className="required">*</span></label>
              <input
                type="text"
                placeholder="e.g. Scaffolding transport lorry, diesel for mixer"
                value={description}
                onChange={e => setDescription(e.target.value)}
                autoFocus
                required
              />
            </div>

            <div className="form-group">
              <label>Total Expense Amount (₹) <span className="required">*</span></label>
              <input
                type="number"
                step="any"
                min="1"
                placeholder="e.g. 1500"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                required
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
                <span style={{ fontSize: '0.7rem', color: '#1d4ed8', fontWeight: 600, display: 'block' }}>TOTAL EXPENSE</span>
                <strong style={{ fontSize: '1rem', color: '#1e3a8a' }}>₹{fin.totalAmount.toLocaleString('en-IN')}</strong>
              </div>
              <div style={{ background: '#ecfdf5', padding: '8px 10px', borderRadius: '8px', border: '1px solid #a7f3d0' }}>
                <span style={{ fontSize: '0.7rem', color: '#047857', fontWeight: 600, display: 'block' }}>PAID AMOUNT</span>
                <strong style={{ fontSize: '1rem', color: '#065f46' }}>₹{fin.paidAmount.toLocaleString('en-IN')}</strong>
              </div>
              <div style={{ background: fin.balanceDue > 0 ? '#fef2f2' : '#f8fafc', padding: '8px 10px', borderRadius: '8px', border: fin.balanceDue > 0 ? '1px solid #fecaca' : '1px solid var(--border-light)' }}>
                <span style={{ fontSize: '0.7rem', color: fin.balanceDue > 0 ? '#b91c1c' : '#64748b', fontWeight: 600, display: 'block' }}>BALANCE DUE</span>
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
                <span>Extra Paid: ₹{fin.extraPaid.toLocaleString('en-IN')} recorded above expense. Balance Due is ₹0.</span>
              </div>
            )}

            <div className="form-grid-2">
              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label>Amount Paid Now (₹)</label>
                  {numAmount > 0 && (
                    <button
                      type="button"
                      onClick={() => setPaidAmount(numAmount.toString())}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--primary)',
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
                />
                <span className="form-hint">Default: 0</span>
              </div>

              <div className="form-group">
                <label>Payment Mode</label>
                <select value={paymentMode} onChange={e => setPaymentMode(e.target.value)}>
                  <option value="Cash">💵 Cash</option>
                  <option value="UPI">📱 UPI / GPay</option>
                  <option value="Bank Transfer">🏦 Bank Transfer</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label>Notes / Bill Reference</label>
              <input
                type="text"
                placeholder="e.g. Petrol bunk receipt #9910, handed cash to driver"
                value={notes}
                onChange={e => setNotes(e.target.value)}
              />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              <Save size={18} />
              {expenseToEdit ? 'Save Changes' : 'Save Expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
