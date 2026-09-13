import React, { useState, useEffect } from 'react';
import { X, Save, Sparkles, ArrowUpRight } from 'lucide-react';
import { db } from '../db/db';
import type { PoojaExpense } from '../db/types';
import { calculateFinancialBalance, recordPaymentTransaction } from '../utils/financial';
import { getCurrentUser } from '../services/auth';

interface PoojaModalProps {
  isOpen: boolean;
  siteId: string;
  poojaToEdit?: PoojaExpense | null;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

const COMMON_POOJAS = [
  'Bhoomi Pooja (Foundation Stone Laying)',
  'Vastukkal / First Pillar Column Pooja',
  'Main Entrance Door Frame (Nilavu) Pooja',
  'Ground Floor Roof Slab Pouring Pooja',
  'First Floor Roof Slab Pouring Pooja',
  'Ayudha Pooja / Saraswathi Pooja at Site',
  'Deepavali / Pongal Celebration with Mistries',
  'Graha Pravesham / House Warming',
  'Other Ceremony',
];

export const PoojaModal: React.FC<PoojaModalProps> = ({
  isOpen,
  siteId,
  poojaToEdit,
  onClose,
  onSuccess,
}) => {
  const [poojaName, setPoojaName] = useState(COMMON_POOJAS[0]);
  const [customPoojaName, setCustomPoojaName] = useState('');
  const [date, setDate] = useState('');
  const [materialsExpense, setMaterialsExpense] = useState('2500');
  const [priestExpense, setPriestExpense] = useState('2000');
  const [otherExpense, setOtherExpense] = useState('500');
  const [paidAmount, setPaidAmount] = useState('0'); // Default: Paid Amount = 0
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  const currentUser = getCurrentUser();

  useEffect(() => {
    if (poojaToEdit) {
      if (COMMON_POOJAS.includes(poojaToEdit.poojaName)) {
        setPoojaName(poojaToEdit.poojaName);
        setCustomPoojaName('');
      } else {
        setPoojaName('Other Ceremony');
        setCustomPoojaName(poojaToEdit.poojaName);
      }
      setDate(poojaToEdit.date);
      setMaterialsExpense(poojaToEdit.materialsExpense.toString());
      setPriestExpense(poojaToEdit.priestExpense.toString());
      setOtherExpense(poojaToEdit.otherExpense.toString());
      setPaidAmount(poojaToEdit.paidAmount.toString());
      setNotes(poojaToEdit.notes || '');
    } else {
      const today = new Date().toISOString().slice(0, 10);
      setDate(today);
      setPoojaName(COMMON_POOJAS[0]);
      setCustomPoojaName('');
      setMaterialsExpense('2500');
      setPriestExpense('2000');
      setOtherExpense('500');
      setPaidAmount('0'); // Default: Paid Amount = 0
      setPaymentMode('Cash');
      setNotes('');
      setError('');
    }
  }, [poojaToEdit, isOpen]);

  if (!isOpen) return null;

  const numMat = Math.max(0, parseFloat(materialsExpense) || 0);
  const numPriest = Math.max(0, parseFloat(priestExpense) || 0);
  const numOther = Math.max(0, parseFloat(otherExpense) || 0);
  const calculatedTotal = Math.round(numMat + numPriest + numOther);

  const numPaid = Math.max(0, parseFloat(paidAmount) || 0);
  const fin = calculateFinancialBalance(calculatedTotal, numPaid);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const finalName = poojaName === 'Other Ceremony' ? customPoojaName.trim() : poojaName;

    if (!finalName) {
      setError('Please specify the pooja or ceremony name.');
      return;
    }
    if (calculatedTotal <= 0) {
      setError('Total expense must be greater than ₹0.');
      return;
    }

    const now = new Date().toISOString();
    const id = poojaToEdit ? poojaToEdit.id : `pooja-${Date.now()}`;

    const record: PoojaExpense = {
      id,
      siteId,
      poojaName: finalName,
      date: date || now.slice(0, 10),
      materialsExpense: numMat,
      priestExpense: numPriest,
      otherExpense: numOther,
      totalAmount: calculatedTotal,
      paidAmount: fin.paidAmount,
      balance: fin.balanceDue,
      extraPaid: fin.extraPaid,
      notes: notes.trim(),
      isDeleted: false,
      createdAt: poojaToEdit ? poojaToEdit.createdAt : now,
      updatedAt: now,
    };

    try {
      await db.poojaExpenses.put(record);

      // Record individual payment transaction if initial payment made
      if (!poojaToEdit && fin.paidAmount > 0) {
        await recordPaymentTransaction({
          siteId,
          relatedRecordId: id,
          tableName: 'poojaExpenses',
          amount: fin.paidAmount,
          paymentType: paymentMode,
          date: date || now.slice(0, 10),
          notes: `Pooja payment for ${finalName}`,
          module: 'Pooja',
          userId: currentUser?.id,
        });
      }

      onSuccess(poojaToEdit ? 'Pooja expense updated' : `Pooja expense "${finalName}" recorded`);
      onClose();
    } catch (err: any) {
      setError('Failed to save pooja expense: ' + err.message);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-dialog" onClick={e => e.stopPropagation()} style={{ maxWidth: '640px' }}>
        <div className="modal-header">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={22} color="#8b5cf6" />
            {poojaToEdit ? 'Edit Pooja Expense' : 'Add Pooja Expense'}
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
                <label>Ceremony / Pooja Event <span className="required">*</span></label>
                <select value={poojaName} onChange={e => setPoojaName(e.target.value)}>
                  {COMMON_POOJAS.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Date Conducted</label>
                <input
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                />
              </div>
            </div>

            {poojaName === 'Other Ceremony' && (
              <div className="form-group">
                <label>Custom Ceremony Name <span className="required">*</span></label>
                <input
                  type="text"
                  placeholder="e.g. Sump pit opening pooja"
                  value={customPoojaName}
                  onChange={e => setCustomPoojaName(e.target.value)}
                  autoFocus
                />
              </div>
            )}

            <div className="form-grid-3">
              <div className="form-group">
                <label>Pooja Materials & Flowers (₹)</label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={materialsExpense}
                  onChange={e => setMaterialsExpense(e.target.value)}
                />
                <span className="form-hint">Coconuts, fruits, garland, sweets</span>
              </div>

              <div className="form-group">
                <label>Priest Dakshina / Sambhavana (₹)</label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={priestExpense}
                  onChange={e => setPriestExpense(e.target.value)}
                />
                <span className="form-hint">Vadhyar / Gurukkal fee</span>
              </div>

              <div className="form-group">
                <label>Prasadam / Other Expense (₹)</label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={otherExpense}
                  onChange={e => setOtherExpense(e.target.value)}
                />
                <span className="form-hint">Food, sundal, tea packet</span>
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
                <span style={{ fontSize: '0.7rem', color: '#1d4ed8', fontWeight: 600, display: 'block' }}>TOTAL CEREMONY</span>
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
                <span>Extra Paid: ₹{fin.extraPaid.toLocaleString('en-IN')} recorded. Balance Due is ₹0.</span>
              </div>
            )}

            <div className="form-grid-3">
              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label>Amount Paid Now (₹)</label>
                  {calculatedTotal > 0 && (
                    <button
                      type="button"
                      onClick={() => setPaidAmount(calculatedTotal.toString())}
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
                  <option value="UPI">📱 UPI / GPay / PhonePe</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="form-group">
                <label>Notes / Details</label>
                <input
                  type="text"
                  placeholder="e.g. Conducted auspiciously at 9:15 AM with family"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              <Save size={18} />
              {poojaToEdit ? 'Save Changes' : 'Save Pooja Expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
