import { todayKey } from '../utils/datetime';
import React, { useState, useEffect } from 'react';
import { X, Save, Droplets, ArrowUpRight } from 'lucide-react';
import { db } from '../db/db';
import type { WaterBill } from '../db/types';
import { calculateFinancialBalance, recordPaymentTransaction } from '../utils/financial';
import { getCurrentUser } from '../services/auth';

interface WaterModalProps {
  isOpen: boolean;
  siteId: string;
  billToEdit?: WaterBill | null;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export const WaterModal: React.FC<WaterModalProps> = ({
  isOpen,
  siteId,
  billToEdit,
  onClose,
  onSuccess,
}) => {
  const [supplier, setSupplier] = useState('');
  const [quantityLoads, setQuantityLoads] = useState('');
  const [billAmount, setBillAmount] = useState('2400');
  const [paidAmount, setPaidAmount] = useState('0'); // Default: Paid Amount = 0
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [date, setDate] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentUser = getCurrentUser();

  useEffect(() => {
    if (billToEdit) {
      setSupplier(billToEdit.supplier);
      setQuantityLoads(billToEdit.quantityLoads || '');
      setBillAmount(billToEdit.billAmount.toString());
      setPaidAmount(billToEdit.paidAmount.toString());
      setDate(billToEdit.date);
      setNotes(billToEdit.notes || '');
    } else {
      const today = todayKey();
      setSupplier('Cauvery Water Tanker Service');
      setQuantityLoads('2 Tankers (12,000 Litres)');
      setBillAmount('2400');
      setPaidAmount('0'); // Default: Paid Amount = 0
      setPaymentMode('Cash');
      setDate(today);
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

    if (!supplier.trim()) {
      setError('Please specify the water supplier / source name.');
      return;
    }
    if (numBill <= 0) {
      setError('Bill amount must be greater than ₹0.');
      return;
    }

    const now = new Date().toISOString();
    const id = billToEdit ? billToEdit.id : `water-${Date.now()}`;

    const record: WaterBill = {
      id,
      siteId,
      date: date || todayKey(),
      supplier: supplier.trim(),
      quantityLoads: quantityLoads.trim(),
      billAmount: numBill,
      paidAmount: fin.paidAmount,
      balance: fin.balanceDue,
      extraPaid: fin.extraPaid,
      notes: notes.trim(),
      isDeleted: false,
      createdAt: billToEdit ? billToEdit.createdAt : now,
      updatedAt: now,
    };

    setIsSubmitting(true);
    try {
      await db.waterBills.put(record);

      // Record individual payment transaction if initial payment made
      if (!billToEdit && fin.paidAmount > 0) {
        await recordPaymentTransaction({
          siteId,
          relatedRecordId: id,
          tableName: 'waterBills',
          amount: fin.paidAmount,
          paymentType: paymentMode,
          date: date || todayKey(),
          notes: `Water tanker delivery payment to ${supplier.trim()}`,
          module: 'Water',
          userId: currentUser?.id,
        });
      }

      onSuccess(billToEdit ? 'Water expense updated' : 'Water supply expense recorded');
      onClose();
    } catch (err: any) {
      setError('Failed to save water expense: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-dialog" onClick={e => e.stopPropagation()} style={{ maxWidth: '640px' }}>
        <div className="modal-header">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Droplets size={22} color="var(--color-primary)" />
            {billToEdit ? 'Edit Water Expense' : 'Record Water Supply Expense'}
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
                <label>Water Supplier / Tanker Agency <span className="required">*</span></label>
                <input
                  type="text"
                  placeholder="Water supplier / tanker agency"
                  value={supplier}
                  onChange={e => setSupplier(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label>Quantity / Loads (Litres / Tankers)</label>
                <input
                  type="text"
                  placeholder="2 Tankers (12,000 Litres)"
                  value={quantityLoads}
                  onChange={e => setQuantityLoads(e.target.value)}
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
                <label>Date of Delivery</label>
                <input
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
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
                <span>Extra Paid: ₹{fin.extraPaid.toLocaleString('en-IN')} advance recorded for tanker. Balance Due is ₹0.</span>
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
                  <option value="Cash">💵 Cash</option>
                  <option value="UPI">📱 UPI / GPay</option>
                  <option value="Bank Transfer">🏦 Bank Transfer</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label>Notes / Driver Details</label>
              <input
                type="text"
                placeholder="Driver details / vehicle number, purpose"
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
              <span>{isSubmitting ? 'Saving...' : (billToEdit ? 'Save Changes' : 'Save Water Expense')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
