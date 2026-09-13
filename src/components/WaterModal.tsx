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
      const today = new Date().toISOString().slice(0, 10);
      setSupplier('Cauvery Water Tanker Service');
      setQuantityLoads('2 Tankers (12,000 Litres)');
      setBillAmount('2400');
      setPaidAmount('0'); // Default: Paid Amount = 0
      setPaymentMode('Cash');
      setDate(today);
      setNotes('');
      setError('');
    }
  }, [billToEdit, isOpen]);

  if (!isOpen) return null;

  const numBill = Math.max(0, parseFloat(billAmount) || 0);
  const numPaid = Math.max(0, parseFloat(paidAmount) || 0);
  const fin = calculateFinancialBalance(numBill, numPaid);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

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
      date: date || now.slice(0, 10),
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
          date: date || now.slice(0, 10),
          notes: `Water tanker delivery payment to ${supplier.trim()}`,
          module: 'Water',
          userId: currentUser?.id,
        });
      }

      onSuccess(billToEdit ? 'Water expense updated' : 'Water supply expense recorded');
      onClose();
    } catch (err: any) {
      setError('Failed to save water expense: ' + err.message);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-dialog" onClick={e => e.stopPropagation()} style={{ maxWidth: '640px' }}>
        <div className="modal-header">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Droplets size={22} color="#0284c7" />
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
                  placeholder="e.g. Ganga Water Supply / Borewell tanker"
                  value={supplier}
                  onChange={e => setSupplier(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label>Quantity / Loads (Litres / Tankers)</label>
                <input
                  type="text"
                  placeholder="e.g. 2 Tankers (12,000 Litres)"
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
              <div style={{ background: '#eff6ff', padding: '8px 10px', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
                <span style={{ fontSize: '0.7rem', color: '#1d4ed8', fontWeight: 600, display: 'block' }}>BILL AMOUNT</span>
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
                placeholder="e.g. Tanker lorry TN-20-CZ-1992, unloaded for column curing"
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
              {billToEdit ? 'Save Changes' : 'Save Water Expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
