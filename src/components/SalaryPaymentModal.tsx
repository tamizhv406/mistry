import React, { useState, useEffect } from 'react';
import { X, Save, Coins, ArrowUpRight, CheckCircle, ShieldCheck } from 'lucide-react';
import { db } from '../db/db';
import type { LabourWorker, SalaryPayment, AttendanceRecord, LabourAdvance } from '../db/types';
import { calculateFinancialBalance, recordPaymentTransaction } from '../utils/financial';
import { getCurrentUser } from '../services/auth';

interface SalaryPaymentModalProps {
  isOpen: boolean;
  siteId: string;
  workers: LabourWorker[];
  attendance: AttendanceRecord[];
  advances: LabourAdvance[];
  pastPayments: SalaryPayment[];
  paymentToEdit?: SalaryPayment | null;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export const SalaryPaymentModal: React.FC<SalaryPaymentModalProps> = ({
  isOpen,
  siteId,
  workers,
  attendance,
  advances,
  pastPayments,
  paymentToEdit,
  onClose,
  onSuccess,
}) => {
  const [workerId, setWorkerId] = useState('');
  const [date, setDate] = useState('');
  const [paidAmount, setPaidAmount] = useState('0'); // Default: Paid Amount = 0
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [periodNotes, setPeriodNotes] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentUser = getCurrentUser();

  useEffect(() => {
    if (paymentToEdit) {
      setWorkerId(paymentToEdit.workerId);
      setDate(paymentToEdit.date);
      setPaidAmount(paymentToEdit.paidAmount.toString());
      setPaymentMode(paymentToEdit.paymentMode || 'Cash');
      setPeriodNotes(paymentToEdit.notes || '');
    } else {
      setWorkerId(workers[0]?.id || '');
      setDate(new Date().toISOString().slice(0, 10));
      setPaidAmount('0'); // Default: Paid Amount = 0
      setPaymentMode('Cash');
      setPeriodNotes('');
      setError('');
      setIsSubmitting(false);
    }
  }, [paymentToEdit, isOpen, workers]);

  // Compute stats for selected worker
  const selectedWorker = workers.find(w => w.id === workerId);
  const workerAttendance = attendance.filter(a => a.workerId === workerId);
  const workerAdvances = advances.filter(a => a.workerId === workerId);
  const workerPayments = pastPayments.filter(p => p.workerId === workerId && (!paymentToEdit || p.id !== paymentToEdit.id));

  const totalDaysWorked = workerAttendance.reduce((acc, a) => acc + (a.dayMultiplier || 0), 0);
  const dailyWage = selectedWorker?.dailyWage || 0;
  const grossSalary = Math.round(totalDaysWorked * dailyWage);

  // LABOUR ADVANCE RULE:
  // Recoverable advance: Include it in salary deduction/balance calculations.
  // No Return / Non-Recoverable: Never deduct it from salary!
  const recoverableAdvances = workerAdvances
    .filter(a => a.advanceType === 'Recoverable')
    .reduce((acc, a) => acc + (a.amount || 0), 0);

  const nonRecoverableAdvances = workerAdvances
    .filter(a => a.advanceType !== 'Recoverable')
    .reduce((acc, a) => acc + (a.amount || 0), 0);

  const totalAlreadyPaid = workerPayments.reduce((acc, p) => acc + (p.paidAmount || 0), 0);
  const netPayableWage = Math.max(0, grossSalary - recoverableAdvances - totalAlreadyPaid);

  const numPaid = Math.max(0, parseFloat(paidAmount) || 0);
  const fin = calculateFinancialBalance(netPayableWage, numPaid);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!workerId) {
      setError('Please select a worker.');
      return;
    }
    if (numPaid < 0) {
      setError('Payment amount cannot be negative.');
      return;
    }

    const now = new Date().toISOString();
    const id = paymentToEdit ? paymentToEdit.id : `sal-${Date.now()}`;

    const paymentRecord: SalaryPayment = {
      id,
      siteId,
      workerId,
      date: date || now.slice(0, 10),
      daysWorked: totalDaysWorked,
      grossSalary,
      advanceDeducted: recoverableAdvances,
      paidAmount: numPaid,
      balance: fin.balanceDue,
      extraPaid: fin.extraPaid,
      paymentMode,
      notes: periodNotes.trim(),
      isDeleted: false,
      createdAt: paymentToEdit ? paymentToEdit.createdAt : now,
      updatedAt: now,
    };

    setIsSubmitting(true);
    try {
      await db.salaryPayments.put(paymentRecord);

      // Record individual payment transaction if payment amount > 0
      if (numPaid > 0) {
        await recordPaymentTransaction({
          siteId,
          relatedRecordId: id,
          tableName: 'salaryPayments',
          amount: numPaid,
          paymentType: paymentMode,
          date: date || now.slice(0, 10),
          notes: `Salary payment to ${selectedWorker?.name}: ${periodNotes.trim() || 'Wage disbursement'}`,
          module: 'Salary',
          userId: currentUser?.id,
        });
      }

      onSuccess(
        paymentToEdit
          ? 'Salary payment record updated'
          : `Salary of ₹${numPaid.toLocaleString('en-IN')} recorded for ${selectedWorker?.name}`
      );
      onClose();
    } catch (err: any) {
      setError('Failed to record salary payment: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-dialog" onClick={e => e.stopPropagation()} style={{ maxWidth: '620px' }}>
        <div className="modal-header">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Coins size={22} color="#f59e0b" />
            {paymentToEdit ? 'Edit Salary Settlement' : 'Disburse Salary Payment'}
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

            {/* Worker Earnings & Deductions Audit Box */}
            <div style={{
              backgroundColor: '#f8fafc',
              border: '1px solid var(--border-light)',
              borderRadius: '10px',
              padding: '14px',
              marginBottom: '16px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Total Days Worked ({totalDaysWorked} shifts × ₹{dailyWage}):
                </span>
                <strong style={{ fontSize: '0.95rem' }}>₹{grossSalary.toLocaleString('en-IN')}</strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.85rem', color: '#dc2626' }}>
                  (-) Recoverable Advances (Deducted):
                </span>
                <strong style={{ color: '#dc2626', fontSize: '0.95rem' }}>
                  -₹{recoverableAdvances.toLocaleString('en-IN')}
                </strong>
              </div>

              {nonRecoverableAdvances > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', padding: '4px 8px', background: '#f5f3ff', borderRadius: '6px' }}>
                  <span style={{ fontSize: '0.82rem', color: '#7c3aed', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <ShieldCheck size={14} />
                    <span>No Return / Non-Recoverable Grant (Never deducted):</span>
                  </span>
                  <span style={{ color: '#7c3aed', fontSize: '0.85rem', fontWeight: 600 }}>
                    ₹{nonRecoverableAdvances.toLocaleString('en-IN')}
                  </span>
                </div>
              )}

              {totalAlreadyPaid > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    (-) Past Salary Disbursed:
                  </span>
                  <strong style={{ fontSize: '0.95rem' }}>-₹{totalAlreadyPaid.toLocaleString('en-IN')}</strong>
                </div>
              )}

              <div style={{ borderTop: '1.5px dashed var(--border-medium)', paddingTop: '8px', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 700 }}>Net Wage Payable:</span>
                <strong style={{ fontSize: '1.1rem', color: '#2563eb' }}>₹{netPayableWage.toLocaleString('en-IN')}</strong>
              </div>
            </div>

            {/* Universal 4-Box Financial Status Indicator */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(115px, 1fr))',
              gap: '8px',
              marginBottom: '16px',
            }}>
              <div style={{ background: '#eff6ff', padding: '8px 10px', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
                <span style={{ fontSize: '0.7rem', color: '#1d4ed8', fontWeight: 600, display: 'block' }}>TOTAL PAYABLE</span>
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
                <span>Extra Paid: ₹{fin.extraPaid.toLocaleString('en-IN')} recorded above net wages. Balance Due is strictly ₹0.</span>
              </div>
            )}

            <div className="form-grid-2">
              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label>Paid Amount (₹) <span className="required">*</span></label>
                  {netPayableWage > 0 && (
                    <button
                      type="button"
                      onClick={() => setPaidAmount(netPayableWage.toString())}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--primary)',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        padding: 0,
                      }}
                    >
                      Fill Due (₹{netPayableWage.toLocaleString('en-IN')})
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
                  required
                />
              </div>

              <div className="form-group">
                <label>Disbursement Date</label>
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
                  <option value="Cheque">📜 Cheque</option>
                </select>
              </div>

              <div className="form-group">
                <label>Notes / Period</label>
                <input
                  type="text"
                  placeholder="e.g. Week 1 settlement, Roof slab bonus"
                  value={periodNotes}
                  onChange={e => setPeriodNotes(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              <Save size={16} />
              <span>{isSubmitting ? 'Saving...' : 'Record Salary Payment'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
