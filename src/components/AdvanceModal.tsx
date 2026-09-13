import React, { useState, useEffect } from 'react';
import { X, Save, IndianRupee, AlertCircle, ShieldAlert, ShieldCheck } from 'lucide-react';
import { db } from '../db/db';
import type { LabourWorker, LabourAdvance } from '../db/types';
import { recordPaymentTransaction } from '../utils/financial';
import { getCurrentUser } from '../services/auth';

interface AdvanceModalProps {
  isOpen: boolean;
  siteId: string;
  workers: LabourWorker[];
  advanceToEdit?: LabourAdvance | null;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export const AdvanceModal: React.FC<AdvanceModalProps> = ({
  isOpen,
  siteId,
  workers,
  advanceToEdit,
  onClose,
  onSuccess,
}) => {
  const [workerId, setWorkerId] = useState('');
  const [date, setDate] = useState('');
  const [amount, setAmount] = useState('500');
  const [advanceType, setAdvanceType] = useState<'Recoverable' | 'Non-Recoverable' | ''>('');
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [reason, setReason] = useState('Weekly advance');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  const currentUser = getCurrentUser();

  useEffect(() => {
    if (advanceToEdit) {
      setWorkerId(advanceToEdit.workerId);
      setDate(advanceToEdit.date);
      setAmount(advanceToEdit.amount.toString());
      setAdvanceType(advanceToEdit.advanceType || 'Recoverable');
      setReason(advanceToEdit.reason || '');
      setNotes(advanceToEdit.notes || '');
    } else {
      setWorkerId(workers[0]?.id || '');
      setDate(new Date().toISOString().slice(0, 10));
      setAmount('');
      // As required: "Never automatically assume an advance is recoverable" -> Require explicit selection
      setAdvanceType('');
      setPaymentMode('Cash');
      setReason('Weekly advance');
      setNotes('');
      setError('');
    }
  }, [advanceToEdit, isOpen, workers]);

  if (!isOpen) return null;

  const numAmount = Math.max(0, parseFloat(amount) || 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!workerId) {
      setError('Please select a worker.');
      return;
    }
    if (numAmount <= 0) {
      setError('Advance amount must be greater than ₹0.');
      return;
    }
    if (!advanceType) {
      setError('Please explicitly select whether this advance is Recoverable or No Return / Non-Recoverable.');
      return;
    }

    const now = new Date().toISOString();
    const id = advanceToEdit ? advanceToEdit.id : `adv-${Date.now()}`;
    const selectedWorker = workers.find(w => w.id === workerId);

    const record: LabourAdvance = {
      id,
      siteId,
      workerId,
      date: date || now.slice(0, 10),
      amount: numAmount,
      advanceType,
      reason: reason.trim(),
      notes: notes.trim(),
      isDeleted: false,
      createdAt: advanceToEdit ? advanceToEdit.createdAt : now,
      updatedAt: now,
    };

    try {
      await db.labourAdvances.put(record);

      // Record individual payment transaction
      await recordPaymentTransaction({
        siteId,
        relatedRecordId: id,
        tableName: 'labourAdvances',
        amount: numAmount,
        paymentType: paymentMode,
        date: date || now.slice(0, 10),
        notes: `Advance to ${selectedWorker?.name} (${advanceType}): ${reason.trim()}`,
        module: 'Advance',
        userId: currentUser?.id,
      });

      onSuccess(
        advanceToEdit
          ? `Advance record updated (${advanceType})`
          : `${advanceType} Advance of ₹${numAmount.toLocaleString('en-IN')} paid to ${selectedWorker?.name || 'worker'}`
      );
      onClose();
    } catch (err: any) {
      setError('Failed to save advance: ' + err.message);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-dialog" onClick={e => e.stopPropagation()} style={{ maxWidth: '580px' }}>
        <div className="modal-header">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <IndianRupee size={22} color="#f59e0b" />
            {advanceToEdit ? 'Edit Labour Advance' : 'Give Labour Advance'}
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
                ⚠️ {error}
              </div>
            )}

            <div className="form-group">
              <label>Select Worker <span className="required">*</span></label>
              <select value={workerId} onChange={e => setWorkerId(e.target.value)}>
                {workers.map(w => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({w.category} - ₹{w.dailyWage}/day)
                  </option>
                ))}
              </select>
            </div>

            {/* CRITICAL REQUIREMENT: Explicit Advance Classification */}
            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', fontWeight: 700 }}>
                <span>Advance Recovery Type</span>
                <span className="required">*</span>
                <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-muted)' }}>
                  (Must choose explicitly — Never assumed)
                </span>
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                {/* 1. Recoverable */}
                <div
                  onClick={() => setAdvanceType('Recoverable')}
                  style={{
                    border: advanceType === 'Recoverable' ? '2px solid #2563eb' : '1.5px solid var(--border-light)',
                    backgroundColor: advanceType === 'Recoverable' ? 'rgba(37, 99, 235, 0.08)' : '#ffffff',
                    borderRadius: '10px',
                    padding: '12px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <input
                      type="radio"
                      name="advanceType"
                      checked={advanceType === 'Recoverable'}
                      onChange={() => setAdvanceType('Recoverable')}
                      style={{ cursor: 'pointer' }}
                    />
                    <strong style={{ color: '#1e40af', fontSize: '0.92rem' }}>Recoverable</strong>
                  </div>
                  <p style={{ fontSize: '0.78rem', color: '#475569', margin: 0, lineHeight: 1.3 }}>
                    Include in salary deduction. Deducted from future wage settlements.
                  </p>
                </div>

                {/* 2. No Return / Non-Recoverable */}
                <div
                  onClick={() => setAdvanceType('Non-Recoverable')}
                  style={{
                    border: advanceType === 'Non-Recoverable' ? '2px solid #7c3aed' : '1.5px solid var(--border-light)',
                    backgroundColor: advanceType === 'Non-Recoverable' ? 'rgba(124, 58, 237, 0.08)' : '#ffffff',
                    borderRadius: '10px',
                    padding: '12px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <input
                      type="radio"
                      name="advanceType"
                      checked={advanceType === 'Non-Recoverable'}
                      onChange={() => setAdvanceType('Non-Recoverable')}
                      style={{ cursor: 'pointer' }}
                    />
                    <strong style={{ color: '#6d28d9', fontSize: '0.92rem' }}>No Return</strong>
                  </div>
                  <p style={{ fontSize: '0.78rem', color: '#475569', margin: 0, lineHeight: 1.3 }}>
                    Non-recoverable grant / bonus / medical aid. <strong>Never deducted</strong> from salary.
                  </p>
                </div>
              </div>
            </div>

            <div className="form-grid-2">
              <div className="form-group">
                <label>Advance Amount (₹) <span className="required">*</span></label>
                <input
                  type="number"
                  step="any"
                  min="1"
                  placeholder="e.g. 1000"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  autoFocus
                  required
                />
              </div>

              <div className="form-group">
                <label>Date Given</label>
                <input
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                />
              </div>
            </div>

            <div className="form-grid-2">
              <div className="form-group">
                <label>Payment Mode</label>
                <select value={paymentMode} onChange={e => setPaymentMode(e.target.value)}>
                  <option value="Cash">💵 Cash</option>
                  <option value="UPI">📱 UPI / GPay / PhonePe</option>
                  <option value="Bank Transfer">🏦 Bank Transfer</option>
                </select>
              </div>

              <div className="form-group">
                <label>Reason / Purpose</label>
                <input
                  type="text"
                  placeholder="e.g. Festival advance, Emergency, Travel"
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group">
              <label>Notes (Optional)</label>
              <input
                type="text"
                placeholder="e.g. Handed cash on site after shift"
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
              <Save size={16} />
              <span>Save Advance</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
