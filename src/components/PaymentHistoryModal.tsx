import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, IndianRupee, Receipt, CheckCircle, AlertCircle, ArrowUpRight } from 'lucide-react';
import { db } from '../db/db';
import type { PaymentTransaction, EntityTable } from '../db/types';
import { calculateFinancialBalance, recordPaymentTransaction, syncParentRecordFinances } from '../utils/financial';
import { getCurrentUser } from '../services/auth';

interface PaymentHistoryModalProps {
  isOpen: boolean;
  siteId: string;
  relatedRecordId: string;
  tableName: EntityTable;
  title: string;
  subtitle?: string;
  module?: string;
  totalAmount: number;
  onClose: () => void;
  onSuccess?: (message: string) => void;
}

export const PaymentHistoryModal: React.FC<PaymentHistoryModalProps> = ({
  isOpen,
  siteId,
  relatedRecordId,
  tableName,
  title,
  subtitle,
  module = 'Financial Module',
  totalAmount,
  onClose,
  onSuccess,
}) => {
  const [payments, setPayments] = useState<PaymentTransaction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // New Payment Form States
  const [amount, setAmount] = useState<string>('');
  const [date, setDate] = useState<string>('');
  const [paymentType, setPaymentType] = useState<string>('Cash');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const currentUser = getCurrentUser();

  const loadPayments = async () => {
    try {
      setLoading(true);
      const list = await db.payments
        .where('relatedRecordId')
        .equals(relatedRecordId)
        .filter(p => !p.isDeleted)
        .reverse()
        .sortBy('date');
      setPayments(list);
    } catch (err) {
      console.error('Failed to load payments:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && relatedRecordId) {
      loadPayments();
      setDate(new Date().toISOString().slice(0, 10));
      setAmount('');
      setNotes('');
      setError('');
    }
  }, [isOpen, relatedRecordId]);

  if (!isOpen) return null;

  // Calculate live financial summary from current payments
  const currentTotalPaid = payments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
  const fin = calculateFinancialBalance(totalAmount, currentTotalPaid);

  const handleQuickFillBalance = () => {
    if (fin.balanceDue > 0) {
      setAmount(fin.balanceDue.toString());
    }
  };

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = Math.max(0, Math.round(parseFloat(amount) || 0));

    if (numAmount <= 0) {
      setError('Payment amount must be greater than ₹0.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError('');

      await recordPaymentTransaction({
        siteId,
        relatedRecordId,
        tableName,
        amount: numAmount,
        paymentType,
        date: date || new Date().toISOString().slice(0, 10),
        notes: notes.trim(),
        module,
        userId: currentUser?.id,
      });

      setAmount('');
      setNotes('');
      await loadPayments();

      if (onSuccess) {
        onSuccess(`Payment transaction of ₹${numAmount.toLocaleString('en-IN')} recorded successfully`);
      }
    } catch (err: any) {
      setError('Failed to record payment: ' + (err.message || 'Unknown error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeletePayment = async (paymentId: string) => {
    if (!window.confirm('Are you sure you want to delete this payment transaction? The balance will be automatically recalculated.')) {
      return;
    }

    try {
      const now = new Date().toISOString();
      await db.payments.update(paymentId, {
        isDeleted: true,
        deletedAt: now,
        updatedAt: now,
      });

      await syncParentRecordFinances(tableName, relatedRecordId);
      await loadPayments();

      if (onSuccess) {
        onSuccess('Payment transaction removed and balance recalculated');
      }
    } catch (err: any) {
      alert('Failed to delete payment: ' + err.message);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="modal-dialog"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: '680px', width: '95%' }}
      >
        {/* Header */}
        <div className="modal-header">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span className="badge badge-active" style={{ fontSize: '0.75rem', textTransform: 'uppercase' }}>
                {module}
              </span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                ID: {relatedRecordId}
              </span>
            </div>
            <h3 style={{ margin: 0, fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Receipt size={22} color="var(--primary)" />
              <span>Payment History & Transactions</span>
            </h3>
            <p style={{ margin: '3px 0 0 0', fontSize: '0.88rem', color: 'var(--text-muted)' }}>
              {title} {subtitle ? `• ${subtitle}` : ''}
            </p>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className="modal-body" style={{ maxHeight: '75vh', overflowY: 'auto' }}>
          {/* Universal 4-Box Financial Status Ribbon */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
              gap: '10px',
              marginBottom: '20px',
            }}
          >
            {/* Total Amount */}
            <div
              style={{
                backgroundColor: 'rgba(59, 130, 246, 0.08)',
                border: '1px solid rgba(59, 130, 246, 0.25)',
                borderRadius: '10px',
                padding: '10px 14px',
              }}
            >
              <span style={{ fontSize: '0.75rem', color: '#2563eb', fontWeight: 600, display: 'block' }}>
                TOTAL AMOUNT
              </span>
              <strong style={{ fontSize: '1.2rem', color: '#1e293b' }}>
                ₹{fin.totalAmount.toLocaleString('en-IN')}
              </strong>
            </div>

            {/* Paid Amount */}
            <div
              style={{
                backgroundColor: 'rgba(16, 185, 129, 0.08)',
                border: '1px solid rgba(16, 185, 129, 0.25)',
                borderRadius: '10px',
                padding: '10px 14px',
              }}
            >
              <span style={{ fontSize: '0.75rem', color: '#059669', fontWeight: 600, display: 'block' }}>
                PAID AMOUNT
              </span>
              <strong style={{ fontSize: '1.2rem', color: '#059669' }}>
                ₹{fin.paidAmount.toLocaleString('en-IN')}
              </strong>
            </div>

            {/* Balance Due */}
            <div
              style={{
                backgroundColor: fin.balanceDue > 0 ? 'rgba(239, 68, 68, 0.08)' : 'rgba(241, 245, 249, 0.8)',
                border: fin.balanceDue > 0 ? '1px solid rgba(239, 68, 68, 0.25)' : '1px solid var(--border-light)',
                borderRadius: '10px',
                padding: '10px 14px',
              }}
            >
              <span
                style={{
                  fontSize: '0.75rem',
                  color: fin.balanceDue > 0 ? '#dc2626' : '#64748b',
                  fontWeight: 600,
                  display: 'block',
                }}
              >
                BALANCE DUE
              </span>
              <strong
                style={{
                  fontSize: '1.2rem',
                  color: fin.balanceDue > 0 ? '#dc2626' : '#64748b',
                }}
              >
                ₹{fin.balanceDue.toLocaleString('en-IN')}
              </strong>
            </div>

            {/* Extra Paid */}
            <div
              style={{
                backgroundColor: fin.extraPaid > 0 ? 'rgba(139, 92, 246, 0.08)' : 'rgba(241, 245, 249, 0.8)',
                border: fin.extraPaid > 0 ? '1.5px solid rgba(139, 92, 246, 0.35)' : '1px solid var(--border-light)',
                borderRadius: '10px',
                padding: '10px 14px',
              }}
            >
              <span
                style={{
                  fontSize: '0.75rem',
                  color: fin.extraPaid > 0 ? '#7c3aed' : '#64748b',
                  fontWeight: 600,
                  display: 'block',
                }}
              >
                EXTRA PAID
              </span>
              <strong
                style={{
                  fontSize: '1.2rem',
                  color: fin.extraPaid > 0 ? '#7c3aed' : '#64748b',
                }}
              >
                ₹{fin.extraPaid.toLocaleString('en-IN')}
              </strong>
            </div>
          </div>

          {/* Status Alert Banner */}
          {fin.status === 'EXTRA_PAID' && (
            <div
              style={{
                backgroundColor: '#f5f3ff',
                border: '1px solid #c4b5fd',
                borderRadius: '8px',
                padding: '10px 14px',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                color: '#6d28d9',
                fontSize: '0.88rem',
                fontWeight: 600,
              }}
            >
              <ArrowUpRight size={18} />
              <span>
                Advance / Extra Paid: ₹{fin.extraPaid.toLocaleString('en-IN')} paid above total invoice cost.
                Balance Due is strictly ₹0.
              </span>
            </div>
          )}

          {fin.status === 'PAID' && (
            <div
              style={{
                backgroundColor: '#ecfdf5',
                border: '1px solid #a7f3d0',
                borderRadius: '8px',
                padding: '10px 14px',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                color: '#065f46',
                fontSize: '0.88rem',
                fontWeight: 600,
              }}
            >
              <CheckCircle size={18} />
              <span>Full Payment Completed: Balance is fully settled (₹0 due).</span>
            </div>
          )}

          {/* Record New Payment Form */}
          <div
            style={{
              backgroundColor: '#f8fafc',
              border: '1px solid var(--border-light)',
              borderRadius: '12px',
              padding: '16px',
              marginBottom: '20px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Plus size={16} color="var(--primary)" />
                <span>Record New Payment / Installment</span>
              </h4>

              {fin.balanceDue > 0 && (
                <button
                  type="button"
                  onClick={handleQuickFillBalance}
                  style={{
                    backgroundColor: '#fee2e2',
                    border: '1px solid #fca5a5',
                    color: '#991b1b',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    padding: '4px 10px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                  }}
                >
                  Fill Full Due: ₹{fin.balanceDue.toLocaleString('en-IN')}
                </button>
              )}
            </div>

            {error && (
              <div
                style={{
                  backgroundColor: '#fee2e2',
                  color: '#991b1b',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  marginBottom: '10px',
                }}
              >
                {error}
              </div>
            )}

            <form onSubmit={handleAddPayment}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px', marginBottom: '10px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '0.8rem' }}>Amount (₹) *</label>
                  <input
                    type="number"
                    step="any"
                    min="1"
                    placeholder="Enter amount"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '0.8rem' }}>Payment Date *</label>
                  <input
                    type="date"
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '0.8rem' }}>Payment Type *</label>
                  <select
                    value={paymentType}
                    onChange={e => setPaymentType(e.target.value)}
                  >
                    <option value="Cash">💵 Cash</option>
                    <option value="UPI">📱 UPI / GPay / PhonePe</option>
                    <option value="Bank Transfer">🏦 Bank Transfer (NEFT/IMPS)</option>
                    <option value="Cheque">📜 Cheque</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <div className="form-group" style={{ flex: 1, margin: 0 }}>
                  <input
                    type="text"
                    placeholder="Payment notes (e.g. UTR number, bearer name, 2nd installment)"
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    style={{ fontSize: '0.85rem' }}
                  />
                </div>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSubmitting}
                  style={{ whiteSpace: 'nowrap', padding: '9px 16px', fontSize: '0.88rem' }}
                >
                  <IndianRupee size={15} />
                  <span>{isSubmitting ? 'Saving...' : 'Add Payment'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Payment Transactions Ledger Table */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)' }}>
                Recorded Transactions ({payments.length})
              </h4>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Complete audit trail
              </span>
            </div>

            <div className="table-container" style={{ margin: 0 }}>
              <div className="data-table-wrapper">
                <table className="data-table" style={{ fontSize: '0.85rem' }}>
                  <thead>
                    <tr>
                      <th>Payment ID</th>
                      <th>Date</th>
                      <th>Amount</th>
                      <th>Payment Type</th>
                      <th>Notes</th>
                      <th style={{ textAlign: 'center' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map(p => (
                      <tr key={p.id}>
                        <td>
                          <code style={{ fontSize: '0.78rem', color: '#475569', background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>
                            {p.id}
                          </code>
                        </td>
                        <td style={{ whiteSpace: 'nowrap' }}><strong>{p.date}</strong></td>
                        <td>
                          <strong style={{ color: 'var(--success)', fontFamily: 'var(--font-heading)' }}>
                            ₹{p.amount.toLocaleString('en-IN')}
                          </strong>
                        </td>
                        <td>
                          <span className="badge badge-active" style={{ fontSize: '0.75rem' }}>
                            {p.paymentType}
                          </span>
                        </td>
                        <td style={{ color: 'var(--text-muted)' }}>{p.notes || '-'}</td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            type="button"
                            className="btn btn-sm btn-danger"
                            title="Delete this payment"
                            onClick={() => handleDeletePayment(p.id)}
                            style={{ padding: '4px 8px' }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}

                    {payments.length === 0 && !loading && (
                      <tr>
                        <td colSpan={6} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                          No payment transactions recorded yet. (Default: Paid Amount = ₹0)
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn btn-outline" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
