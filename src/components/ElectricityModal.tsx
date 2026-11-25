import { todayKey } from '../utils/datetime';
import React, { useState, useEffect } from 'react';
import { X, Save, Zap, ArrowUpRight } from 'lucide-react';
import { db } from '../db/db';
import type { ElectricityBill } from '../db/types';
import { calculateFinancialBalance, recordPaymentTransaction } from '../utils/financial';
import { getCurrentUser } from '../services/auth';

interface ElectricityModalProps {
  isOpen: boolean;
  siteId: string;
  billToEdit?: ElectricityBill | null;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export const ElectricityModal: React.FC<ElectricityModalProps> = ({
  isOpen,
  siteId,
  billToEdit,
  onClose,
  onSuccess,
}) => {
  const [month, setMonth] = useState('');
  const [meterNumber, setMeterNumber] = useState('');
  const [billAmount, setBillAmount] = useState('1500');
  const [paidAmount, setPaidAmount] = useState('0'); // Default: Paid Amount = 0
  const [paymentMode, setPaymentMode] = useState('UPI');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentUser = getCurrentUser();

  useEffect(() => {
    if (billToEdit) {
      setMonth(billToEdit.month);
      setMeterNumber(billToEdit.meterNumber || '');
      setBillAmount(billToEdit.billAmount.toString());
      setPaidAmount(billToEdit.paidAmount.toString());
      setDueDate(billToEdit.dueDate || '');
      setNotes(billToEdit.notes || '');
    } else {
      const now = new Date();
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      setMonth(`${monthNames[now.getMonth()]} ${now.getFullYear()}`);
      setMeterNumber('');
      setBillAmount('1500');
      setPaidAmount('0'); // Default: Paid Amount = 0
      setPaymentMode('UPI');
      setDueDate('');
      setNotes('');
      setError('');
      setIsSubmitting(false);
    }
  }, [billToEdit, isOpen]);

  if (!isOpen) return null;

  const numBill = Math.max(0, parseFloat(billAmount) || 0);
  const numPaid = Math.max(0, parseFloat(paidAmount) || 0);
  const fin = calculateFinancialBalance(numBill, numPaid);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!month.trim()) {
      setError('Please specify the billing month.');
      return;
    }
    if (numBill <= 0) {
      setError('Bill amount must be greater than ₹0.');
      return;
    }

    const now = new Date().toISOString();
    const id = billToEdit ? billToEdit.id : `elec-${Date.now()}`;

    const record: ElectricityBill = {
      id,
      siteId,
      month: month.trim(),
      meterNumber: meterNumber.trim(),
      billAmount: numBill,
      paidAmount: fin.paidAmount,
      balance: fin.balanceDue,
      extraPaid: fin.extraPaid,
      dueDate,
      notes: notes.trim(),
      isDeleted: false,
      createdAt: billToEdit ? billToEdit.createdAt : now,
      updatedAt: now,
    };

    setIsSubmitting(true);
    try {
      await db.electricityBills.put(record);

      // Record individual payment transaction if initial payment made
      if (!billToEdit && fin.paidAmount > 0) {
        await recordPaymentTransaction({
          siteId,
          relatedRecordId: id,
          tableName: 'electricityBills',
          amount: fin.paidAmount,
          paymentType: paymentMode,
          date: todayKey(),
          notes: `Electricity bill payment for ${month.trim()}`,
          module: 'Electricity',
          userId: currentUser?.id,
        });
      }

      onSuccess(billToEdit ? 'Electricity bill updated' : `Electricity bill for ${month} saved`);
      onClose();
    } catch (err: any) {
      setError('Failed to save electricity bill: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-dialog" onClick={e => e.stopPropagation()} style={{ maxWidth: '640px' }}>
        <div className="modal-header">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Zap size={22} color="#eab308" />
            {billToEdit ? 'Edit Electricity Bill' : 'Record Electricity Bill'}
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
                <label>Billing Month <span className="required">*</span></label>
                <input
                  type="text"
                  placeholder="Billing month and year"
                  value={month}
                  onChange={e => setMonth(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label>Meter / Connection Consumer No</label>
                <input
                  type="text"
                  placeholder="Meter or consumer number"
                  value={meterNumber}
                  onChange={e => setMeterNumber(e.target.value)}
                />
              </div>
            </div>

            <div className="form-grid-2">
              <div className="form-group">
                <label>Bill Amount (₹) <span className="required">*</span></label>
                <input
                  type="number"
                  step="any"
                  min="1"
                  value={billAmount}
                  onChange={e => setBillAmount(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>Payment Due Date</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={e => setDueDate(e.target.value)}
                />
              </div>
            </div>

            {/* Universal 4-Box Financial Status Ribbon */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(115px, 1fr))',
              gap: '8px',
              marginBottom: '16px',
            }}>
              <div style={{ background: 'var(--color-bg)', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', fontWeight: 600, display: 'block' }}>BILL AMOUNT</span>
                <strong style={{ fontSize: '1rem', color: 'var(--color-charcoal)' }}>₹{fin.totalAmount.toLocaleString('en-IN')}</strong>
              </div>
              <div style={{ background: 'var(--color-success-soft)', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--color-success-border)' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--color-success-text)', fontWeight: 600, display: 'block' }}>PAID AMOUNT</span>
                <strong style={{ fontSize: '1rem', color: 'var(--color-success-text)' }}>₹{fin.paidAmount.toLocaleString('en-IN')}</strong>
              </div>
              <div style={{ background: fin.balanceDue > 0 ? 'var(--color-danger-soft)' : 'var(--color-bg)', padding: '8px 10px', borderRadius: '8px', border: fin.balanceDue > 0 ? '1px solid var(--color-danger-border)' : '1px solid var(--color-border)' }}>
                <span style={{ fontSize: '0.72rem', color: fin.balanceDue > 0 ? 'var(--color-danger-text)' : 'var(--color-text-muted)', fontWeight: 600, display: 'block' }}>BALANCE DUE</span>
                <strong style={{ fontSize: '1rem', color: fin.balanceDue > 0 ? 'var(--color-danger-text)' : 'var(--color-text-muted)' }}>₹{fin.balanceDue.toLocaleString('en-IN')}</strong>
              </div>
              <div style={{ background: fin.extraPaid > 0 ? 'var(--color-primary-soft)' : 'var(--color-bg)', padding: '8px 10px', borderRadius: '8px', border: fin.extraPaid > 0 ? '1.5px solid var(--color-primary-border)' : '1px solid var(--color-border)' }}>
                <span style={{ fontSize: '0.72rem', color: fin.extraPaid > 0 ? 'var(--color-primary-text)' : 'var(--color-text-muted)', fontWeight: 600, display: 'block' }}>EXTRA PAID</span>
                <strong style={{ fontSize: '1rem', color: fin.extraPaid > 0 ? 'var(--color-primary-text)' : 'var(--color-text-muted)' }}>₹{fin.extraPaid.toLocaleString('en-IN')}</strong>
              </div>
            </div>

            {fin.extraPaid > 0 && (
              <div style={{
                backgroundColor: 'var(--color-primary-soft)',
                color: 'var(--color-primary-text)',
                border: '1px solid var(--color-primary-border)',
                padding: '8px 12px',
                borderRadius: '8px',
                fontSize: '0.84rem',
                fontWeight: 600,
                marginBottom: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}>
                <ArrowUpRight size={16} />
                <span>Extra Paid: ₹{fin.extraPaid.toLocaleString('en-IN')} advance bill deposit recorded. Balance Due is ₹0.</span>
              </div>
            )}

            <div className="form-grid-2">
              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label>Amount Paid (₹)</label>
                  {numBill > 0 && (
                    <button
                      type="button"
                      onClick={() => setPaidAmount(numBill.toString())}
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
                  <option value="UPI">📱 UPI / Online TNEB portal</option>
                  <option value="Cash">💵 Cash</option>
                  <option value="Bank Transfer">🏦 Bank Transfer</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label>Notes / EB Receipt Reference</label>
              <input
                type="text"
                placeholder="Receipt reference or notes"
                value={notes}
                onChange={e => setNotes(e.target.value)}
              />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              <Save size={18} />
              <span>{isSubmitting ? 'Saving...' : (billToEdit ? 'Save Changes' : 'Save Bill')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
