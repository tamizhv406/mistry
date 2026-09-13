import React, { useState } from 'react';
import {
  Receipt,
  Search,
  Trash2,
  Download,
  CreditCard,
  Building2,
  Calendar,
} from 'lucide-react';
import type { PaymentTransaction } from '../../db/types';
import { db } from '../../db/db';
import { syncParentRecordFinances } from '../../utils/financial';

interface PaymentsLedgerTabProps {
  siteId: string;
  payments: PaymentTransaction[];
  onNotify?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const PaymentsLedgerTab: React.FC<PaymentsLedgerTabProps> = ({
  siteId,
  payments,
  onNotify,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedModule, setSelectedModule] = useState<string>('all');
  const [selectedMethod, setSelectedMethod] = useState<string>('all');

  const filteredPayments = payments.filter(p => {
    if (selectedModule !== 'all' && (p.module || '').toLowerCase() !== selectedModule.toLowerCase()) {
      return false;
    }
    if (selectedMethod !== 'all' && p.paymentType !== selectedMethod) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchId = p.id.toLowerCase().includes(q);
      const matchNotes = (p.notes || '').toLowerCase().includes(q);
      const matchModule = (p.module || '').toLowerCase().includes(q);
      const matchMethod = p.paymentType.toLowerCase().includes(q);
      if (!matchId && !matchNotes && !matchModule && !matchMethod) return false;
    }
    return true;
  }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const totalAmount = filteredPayments.reduce((acc, p) => acc + p.amount, 0);
  const totalCash = filteredPayments.filter(p => p.paymentType === 'Cash').reduce((acc, p) => acc + p.amount, 0);
  const totalDigital = filteredPayments.filter(p => p.paymentType !== 'Cash').reduce((acc, p) => acc + p.amount, 0);

  const handleDeletePayment = async (payment: PaymentTransaction) => {
    if (!window.confirm(`Are you sure you want to delete payment transaction ${payment.id} for ₹${payment.amount.toLocaleString('en-IN')}?`)) {
      return;
    }
    try {
      await db.payments.delete(payment.id);
      await syncParentRecordFinances(payment.relatedRecordId);
      if (onNotify) {
        onNotify(`Payment ${payment.id} was deleted and parent record balances synced.`, 'info');
      }
    } catch (err) {
      console.error('Failed to delete payment transaction:', err);
      if (onNotify) {
        onNotify('Failed to delete payment record.', 'error');
      }
    }
  };

  const handleExportCSV = () => {
    if (filteredPayments.length === 0) return;
    const headers = ['Payment ID', 'Site ID', 'Related Record ID', 'Date', 'Module', 'Amount', 'Payment Type', 'Notes'];
    const rows = filteredPayments.map(p => [
      `"${p.id}"`,
      `"${p.siteId}"`,
      `"${p.relatedRecordId}"`,
      `"${p.date}"`,
      `"${p.module}"`,
      p.amount,
      `"${p.paymentType}"`,
      `"${(p.notes || '').replace(/"/g, '""')}"`,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Site_Payments_Ledger_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getModuleBadgeClass = (module: string) => {
    const m = module.toLowerCase();
    if (m.includes('material') || m.includes('rod')) return 'badge-active';
    if (m.includes('tool')) return 'badge-demo';
    if (m.includes('labour') || m.includes('advance') || m.includes('salary')) return 'badge-planning';
    if (m.includes('tea') || m.includes('food')) return 'badge-warning';
    return 'badge-completed';
  };

  return (
    <div>
      {/* KPI Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '12px',
        marginBottom: '20px',
      }}>
        <div className="metric-card card-primary" style={{ padding: '14px 18px' }}>
          <div className="metric-info">
            <h3>Total Paid Out (Ledger)</h3>
            <div className="metric-value" style={{ fontSize: '1.4rem' }}>
              ₹{totalAmount.toLocaleString('en-IN')}
            </div>
            <div className="metric-sub">{filteredPayments.length} Recorded Transactions</div>
          </div>
        </div>

        <div className="metric-card card-success" style={{ padding: '14px 18px' }}>
          <div className="metric-info">
            <h3>Cash Payments</h3>
            <div className="metric-value" style={{ fontSize: '1.4rem', color: 'var(--success)' }}>
              ₹{totalCash.toLocaleString('en-IN')}
            </div>
            <div className="metric-sub">Hand Cash Disbursements</div>
          </div>
        </div>

        <div className="metric-card card-info" style={{ padding: '14px 18px' }}>
          <div className="metric-info">
            <h3>UPI / Bank / Cheque</h3>
            <div className="metric-value" style={{ fontSize: '1.4rem', color: 'var(--primary)' }}>
              ₹{totalDigital.toLocaleString('en-IN')}
            </div>
            <div className="metric-sub">Digital & Account Transfers</div>
          </div>
        </div>
      </div>

      <div className="table-container">
        {/* Header & Controls Bar */}
        <div className="table-header-bar" style={{ flexWrap: 'wrap', gap: '12px' }}>
          <span style={{ fontWeight: 700, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Receipt size={18} color="var(--primary)" />
            Universal Site Payment Ledger (Audit Trail)
          </span>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <button className="btn btn-sm btn-outline" onClick={handleExportCSV} disabled={filteredPayments.length === 0}>
              <Download size={14} />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Filters Bar */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px',
          padding: '12px 18px',
          backgroundColor: '#ffffff',
          borderBottom: '1px solid var(--border-light)',
          alignItems: 'center',
        }}>
          {/* Search */}
          <div style={{ position: 'relative', minWidth: '220px', flex: 1 }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search Payment ID, module, notes..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '32px', width: '100%' }}
            />
          </div>

          {/* Module Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>Module:</label>
            <select
              value={selectedModule}
              onChange={e => setSelectedModule(e.target.value)}
              style={{ width: 'auto' }}
            >
              <option value="all">All Modules</option>
              <option value="Material">Materials</option>
              <option value="Tools">Tools</option>
              <option value="Labour Advance">Labour Advance</option>
              <option value="Labour Salary">Labour Salary</option>
              <option value="Tea & Snacks">Tea & Snacks</option>
              <option value="Pooja">Pooja</option>
              <option value="Electricity">Electricity (EB)</option>
              <option value="Water">Water</option>
              <option value="Other Expense">Other Expenses</option>
            </select>
          </div>

          {/* Method Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>Type:</label>
            <select
              value={selectedMethod}
              onChange={e => setSelectedMethod(e.target.value)}
              style={{ width: 'auto' }}
            >
              <option value="all">All Types</option>
              <option value="Cash">Cash</option>
              <option value="UPI">UPI / GPay / PhonePe</option>
              <option value="Bank Transfer">Bank Transfer (NEFT/IMPS)</option>
              <option value="Cheque">Cheque</option>
            </select>
          </div>
        </div>

        {/* Ledger Table */}
        <div className="data-table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Payment ID</th>
                <th>Date</th>
                <th>Module</th>
                <th>Amount</th>
                <th>Payment Type</th>
                <th>Notes</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredPayments.map(p => (
                <tr key={p.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <code style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 600, backgroundColor: 'rgba(59, 130, 246, 0.08)', padding: '2px 6px', borderRadius: '4px' }}>
                      {p.id}
                    </code>
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Calendar size={13} color="var(--text-muted)" />
                      <span>{p.date}</span>
                    </div>
                  </td>
                  <td>
                    <span className={`badge ${getModuleBadgeClass(p.module || '')}`}>
                      {p.module || 'General'}
                    </span>
                  </td>
                  <td>
                    <strong style={{ fontFamily: 'var(--font-heading)', color: 'var(--success)', fontSize: '1rem' }}>
                      ₹{p.amount.toLocaleString('en-IN')}
                    </strong>
                  </td>
                  <td>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem' }}>
                      <CreditCard size={13} color="var(--text-muted)" />
                      {p.paymentType}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-muted)', maxWidth: '260px' }}>
                    {p.notes || '-'}
                  </td>
                  <td>
                    <button
                      className="btn btn-sm btn-danger"
                      title="Delete Transaction"
                      onClick={() => handleDeletePayment(p)}
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}

              {filteredPayments.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    No payment transactions match the filter criteria. All payments made across Materials, Labour, Tools, and Daily Expenses appear here automatically.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
