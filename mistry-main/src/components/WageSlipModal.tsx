import React from 'react';
import { Printer, X, CheckCircle2, ShieldCheck, HardHat, Calendar, DollarSign } from 'lucide-react';
import type { LabourWorker, AttendanceRecord, LabourAdvance, SalaryPayment } from '../db/types';

interface WageSlipModalProps {
  isOpen: boolean;
  onClose: () => void;
  worker: LabourWorker | null;
  siteName?: string;
  attendance: AttendanceRecord[];
  advances: LabourAdvance[];
  salaryPayments?: SalaryPayment[];
}

export const WageSlipModal: React.FC<WageSlipModalProps> = ({
  isOpen,
  onClose,
  worker,
  siteName = 'Building Mistry Project',
  attendance,
  advances,
  salaryPayments = [],
}) => {
  if (!isOpen || !worker) return null;

  const workerAttendance = attendance.filter(a => a.workerId === worker.id);
  const workerAdvances = advances.filter(a => a.workerId === worker.id);
  const workerPayments = salaryPayments.filter(p => p.workerId === worker.id);

  const presentDays = workerAttendance.filter(a => a.status === 'present').length;
  const halfDays = workerAttendance.filter(a => a.status === 'half_day').length;
  const paidLeaveDays = workerAttendance.filter(a => a.status === 'leave').length;
  const overtimeDays = workerAttendance.filter(a => a.status === 'overtime').length;
  const absentDays = workerAttendance.filter(a => a.status === 'absent').length;

  const dailyWage = worker.dailyWage || 0;
  const grossWage =
    presentDays * dailyWage +
    halfDays * (dailyWage * 0.5) +
    paidLeaveDays * dailyWage +
    overtimeDays * (dailyWage * 1.5);

  const totalAdvances = workerAdvances.reduce((sum, a) => sum + (a.amount || 0), 0);
  const totalPaid = workerPayments.reduce((sum, p) => sum + (p.paidAmount || 0), 0);
  const netPayable = Math.max(0, grossWage - totalAdvances - totalPaid);

  const formatINR = (amt: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amt);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1250 }}>
      <div
        className="modal-dialog wage-slip-dialog"
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: '540px',
          width: '100%',
          borderRadius: '16px',
          overflow: 'hidden',
          backgroundColor: '#ffffff',
          boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
        }}
      >
        {/* Modal Bar (Screen Only) */}
        <div className="no-print" style={{ padding: '12px 18px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#f8fafc' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Printer size={18} color="#0284c7" />
            <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0f172a' }}>
              தொழிலாளர் சம்பள ரசீது (Worker Wage Slip)
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={handlePrint}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                borderRadius: 8,
                backgroundColor: '#0284c7',
                color: '#ffffff',
                border: 'none',
                fontWeight: 700,
                fontSize: '0.8rem',
                cursor: 'pointer',
              }}
            >
              <Printer size={14} />
              <span>Print Slip</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Printable Wage Slip Area */}
        <div
          id="printable-wage-slip"
          style={{
            padding: '24px 28px',
            fontFamily: "'Inter', 'Noto Sans Tamil', -apple-system, sans-serif",
            color: '#0f172a',
            lineHeight: 1.5,
          }}
        >
          {/* Company / Site Header */}
          <div style={{ borderBottom: '2px solid #0f172a', paddingBottom: '14px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 900, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                BUILDING MISTRY
              </h2>
              <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>
                தொழிலாளர் சம்பள பட்டுவாடா ரசீது • Worker Wage Settlement Slip
              </p>
              <p style={{ margin: '4px 0 0', fontSize: '0.82rem', fontWeight: 700, color: '#0284c7' }}>
                திட்டம் / தளம் (Site): {siteName}
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'block' }}>தேதி (Date):</span>
              <strong style={{ fontSize: '0.82rem' }}>{new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</strong>
            </div>
          </div>

          {/* Worker Info Card */}
          <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px 16px', marginBottom: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', fontSize: '0.82rem' }}>
            <div>
              <span style={{ color: '#64748b', display: 'block', fontSize: '0.72rem' }}>தொழிலாளர் பெயர் (Worker):</span>
              <strong style={{ fontSize: '0.92rem', color: '#0f172a' }}>{worker.name}</strong>
            </div>
            <div>
              <span style={{ color: '#64748b', display: 'block', fontSize: '0.72rem' }}>தொழில் பிரிவு (Trade / Role):</span>
              <strong style={{ fontSize: '0.88rem', color: '#0f172a' }}>{worker.category || 'Labour'}</strong>
            </div>
            <div>
              <span style={{ color: '#64748b', display: 'block', fontSize: '0.72rem' }}>அலைபேசி எண் (Mobile):</span>
              <span style={{ fontWeight: 600 }}>{worker.phone || 'N/A'}</span>
            </div>
            <div>
              <span style={{ color: '#64748b', display: 'block', fontSize: '0.72rem' }}>தினசரி கூலி (Daily Wage Rate):</span>
              <strong style={{ color: '#16a34a', fontSize: '0.88rem' }}>{formatINR(dailyWage)} / நாள்</strong>
            </div>
          </div>

          {/* Attendance & Wage Calculation Table */}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '16px', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1.5px solid #cbd5e1' }}>
                <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700 }}>விளக்கம் (Muster Roll Summary)</th>
                <th style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 700 }}>நாட்கள் (Days)</th>
                <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700 }}>தொகை (Amount)</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '7px 10px' }}>முழு ஆஜர் நாட்கள் (Full Days Present)</td>
                <td style={{ padding: '7px 10px', textAlign: 'center', fontWeight: 600 }}>{presentDays}</td>
                <td style={{ padding: '7px 10px', textAlign: 'right' }}>{formatINR(presentDays * dailyWage)}</td>
              </tr>
              {halfDays > 0 && (
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '7px 10px' }}>அரை நாள் ஆஜர் (Half-days @ 50%)</td>
                  <td style={{ padding: '7px 10px', textAlign: 'center', fontWeight: 600 }}>{halfDays}</td>
                  <td style={{ padding: '7px 10px', textAlign: 'right' }}>{formatINR(halfDays * dailyWage * 0.5)}</td>
                </tr>
              )}
              {paidLeaveDays > 0 && (
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '7px 10px' }}>அங்கீகரிக்கப்பட்ட விடுமுறை (Paid Leaves)</td>
                  <td style={{ padding: '7px 10px', textAlign: 'center', fontWeight: 600 }}>{paidLeaveDays}</td>
                  <td style={{ padding: '7px 10px', textAlign: 'right' }}>{formatINR(paidLeaveDays * dailyWage)}</td>
                </tr>
              )}
              {overtimeDays > 0 && (
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '7px 10px' }}>கூடுதல் பணி (Overtime Days @ 150%)</td>
                  <td style={{ padding: '7px 10px', textAlign: 'center', fontWeight: 600 }}>{overtimeDays}</td>
                  <td style={{ padding: '7px 10px', textAlign: 'right' }}>{formatINR(overtimeDays * dailyWage * 1.5)}</td>
                </tr>
              )}
              <tr style={{ backgroundColor: '#f8fafc', fontWeight: 700, borderTop: '1.5px solid #cbd5e1' }}>
                <td style={{ padding: '8px 10px' }}>மொத்த சம்பளம் (Gross Wage Earned)</td>
                <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                  {presentDays + halfDays + paidLeaveDays + overtimeDays}
                </td>
                <td style={{ padding: '8px 10px', textAlign: 'right', color: '#0f172a' }}>{formatINR(grossWage)}</td>
              </tr>
            </tbody>
          </table>

          {/* Deductions and Net Payout */}
          <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fef3c7', borderRadius: '10px', padding: '12px 16px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: '0.82rem', color: '#b45309' }}>
              <span>முன்பணம் பிடித்தம் (Advance Deductions):</span>
              <strong>- {formatINR(totalAdvances)}</strong>
            </div>
            {totalPaid > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: '0.82rem', color: '#475569' }}>
                <span>ஏற்கனவே வழங்கப்பட்ட சம்பளம் (Already Disbursed):</span>
                <strong>- {formatINR(totalPaid)}</strong>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1.5px solid #fde68a', marginTop: '8px', paddingTop: '8px' }}>
              <div>
                <span style={{ fontSize: '0.88rem', fontWeight: 800, color: '#92400e', display: 'block' }}>
                  நிகர வழங்கப்பட வேண்டிய தொகை
                </span>
                <span style={{ fontSize: '0.72rem', color: '#78350f' }}>Net Payout Payable</span>
              </div>
              <strong style={{ fontSize: '1.25rem', fontWeight: 900, color: '#15803d' }}>
                {formatINR(netPayable)}
              </strong>
            </div>
          </div>

          {/* Signature Block */}
          <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '36px', marginTop: '20px', borderTop: '1px dashed #cbd5e1', fontSize: '0.78rem' }}>
            <div style={{ textAlign: 'center', width: '180px' }}>
              <div style={{ borderBottom: '1px solid #94a3b8', height: '24px', marginBottom: '6px' }} />
              <span style={{ fontWeight: 600, color: '#334155' }}>தொழிலாளர் கையொப்பம் / கைரேகை</span>
              <span style={{ display: 'block', fontSize: '0.68rem', color: '#94a3b8' }}>(Worker Signature / Thumb)</span>
            </div>
            <div style={{ textAlign: 'center', width: '180px' }}>
              <div style={{ borderBottom: '1px solid #94a3b8', height: '24px', marginBottom: '6px' }} />
              <span style={{ fontWeight: 600, color: '#334155' }}>மேஸ்திரி / மேற்பார்வையாளர்</span>
              <span style={{ display: 'block', fontSize: '0.68rem', color: '#94a3b8' }}>(Mastri / Supervisor Signature)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
