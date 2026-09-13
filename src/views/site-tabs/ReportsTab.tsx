import React, { useState } from 'react';
import { Printer, Download, Calendar, Filter, FileText } from 'lucide-react';
import type {
  Site,
  Material,
  RodEntry,
  LabourWorker,
  AttendanceRecord,
  LabourAdvance,
  SalaryPayment,
  ToolItem,
  TeaSnacksExpense,
  PoojaExpense,
  ElectricityBill,
  WaterBill,
  OtherExpense,
  SiteFinancialSummary,
} from '../../db/types';

interface ReportsTabProps {
  site: Site;
  summary: SiteFinancialSummary;
  materials: Material[];
  rodEntries: RodEntry[];
  workers: LabourWorker[];
  attendance: AttendanceRecord[];
  advances: LabourAdvance[];
  salaryPayments: SalaryPayment[];
  tools: ToolItem[];
  teaSnacks: TeaSnacksExpense[];
  poojas: PoojaExpense[];
  electricity: ElectricityBill[];
  water: WaterBill[];
  otherExpenses?: OtherExpense[];
}

export const ReportsTab: React.FC<ReportsTabProps> = ({
  site,
  summary,
  materials,
  rodEntries,
  workers,
  attendance,
  advances,
  salaryPayments,
  tools,
  teaSnacks,
  poojas,
  electricity,
  water,
  otherExpenses = [],
}) => {
  const [reportType, setReportType] = useState<'cost-sheet' | 'materials' | 'labour' | 'expenses'>('cost-sheet');
  const [dateFilter, setDateFilter] = useState<'all' | 'month' | 'custom'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    // Generate CSV for materials & expenses
    const rows = [
      ['BUILDING MISTRY - SITE COST STATEMENT'],
      ['Site Name', site.name],
      ['Owner', `${site.ownerName} (${site.ownerPhone || ''})`],
      ['Address', `${site.address || ''}, ${site.area || ''}`],
      ['Generated On', new Date().toLocaleString('en-IN')],
      [],
      ['CATEGORY', 'ITEM NAME', 'SUPPLIER / WORKER', 'QUANTITY / DETAILS', 'RATE (INR)', 'TOTAL AMOUNT (INR)', 'PAID AMOUNT (INR)', 'BALANCE DUE (INR)', 'EXTRA PAID (INR)'],
    ];

    // Materials
    materials.forEach(m => {
      rows.push([
        'Material (' + m.category.toUpperCase() + ')',
        m.materialName,
        m.supplier,
        `${m.quantity} ${m.unit}`,
        m.rate.toString(),
        m.totalAmount.toString(),
        m.paidAmount.toString(),
        m.balance.toString(),
        (m.extraPaid || 0).toString(),
      ]);
    });

    // Rods
    rodEntries.forEach(r => {
      rows.push([
        'Steel Rod',
        `Rod ${r.diameter} (${r.brand || 'TMT'})`,
        r.supplier,
        `${r.weightKg} kg`,
        r.ratePerKg.toString(),
        r.totalAmount.toString(),
        r.paidAmount.toString(),
        r.balance.toString(),
        (r.extraPaid || 0).toString(),
      ]);
    });

    // Tools
    tools.forEach(t => {
      rows.push([
        'Tools & Machinery',
        t.toolName,
        t.supplier || '-',
        `${t.quantity} Nos (${t.type})`,
        '-',
        t.cost.toString(),
        t.paidAmount.toString(),
        t.balance.toString(),
        (t.extraPaid || 0).toString(),
      ]);
    });

    // Tea & Snacks
    teaSnacks.forEach(t => {
      rows.push([
        'Tea & Snacks',
        `Tea & Food on ${t.date}`,
        t.notes || 'Daily Refreshment',
        'Daily',
        '-',
        t.totalAmount.toString(),
        t.paidAmount.toString(),
        t.balance.toString(),
        (t.extraPaid || 0).toString(),
      ]);
    });

    // Pooja
    poojas.forEach(p => {
      rows.push([
        'Pooja Ceremony',
        p.poojaName,
        p.notes || 'Ceremony',
        p.date,
        '-',
        p.totalAmount.toString(),
        p.paidAmount.toString(),
        p.balance.toString(),
        (p.extraPaid || 0).toString(),
      ]);
    });

    // Electricity
    electricity.forEach(e => {
      rows.push([
        'Electricity Bill',
        `EB Bill (${e.month})`,
        e.meterNumber || '-',
        '-',
        '-',
        e.billAmount.toString(),
        e.paidAmount.toString(),
        e.balance.toString(),
        (e.extraPaid || 0).toString(),
      ]);
    });

    // Water
    water.forEach(w => {
      rows.push([
        'Water Supply',
        `Water Tanker (${w.date})`,
        w.supplier,
        w.quantityLoads || '-',
        '-',
        w.billAmount.toString(),
        w.paidAmount.toString(),
        w.balance.toString(),
        (w.extraPaid || 0).toString(),
      ]);
    });

    // Other Expenses
    otherExpenses.forEach(o => {
      rows.push([
        `Other (${o.category})`,
        o.description,
        o.notes || '-',
        o.date,
        '-',
        o.amount.toString(),
        o.paidAmount.toString(),
        o.balance.toString(),
        (o.extraPaid || 0).toString(),
      ]);
    });

    // Final Totals Row
    rows.push([]);
    rows.push([
      'GRAND TOTALS',
      '',
      '',
      '',
      '',
      summary.totalCost.toString(),
      summary.totalPaid.toString(),
      summary.totalBalance.toString(),
      (summary.totalExtraPaid || 0).toString(),
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(e => e.map(cell => `"${(cell || '').toString().replace(/"/g, '""')}"`).join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${site.name.replace(/\s+/g, '_')}_cost_report.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div>
      {/* Action Bar (Hidden during print) */}
      <div className="no-print" style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#ffffff',
        padding: '16px 20px',
        borderRadius: '12px',
        marginBottom: '24px',
        border: '1px solid var(--border-light)',
        boxShadow: 'var(--shadow-sm)',
        flexWrap: 'wrap',
        gap: '12px',
      }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            className={`btn btn-sm ${reportType === 'cost-sheet' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setReportType('cost-sheet')}
          >
            Overall Cost Sheet
          </button>
          <button
            className={`btn btn-sm ${reportType === 'materials' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setReportType('materials')}
          >
            Materials Statement
          </button>
          <button
            className={`btn btn-sm ${reportType === 'labour' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setReportType('labour')}
          >
            Labour Wage Sheet
          </button>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-outline btn-sm" onClick={handleExportCSV}>
            <Download size={16} />
            <span>Download CSV</span>
          </button>
          <button className="btn btn-primary btn-sm" onClick={handlePrint}>
            <Printer size={16} />
            <span>Print / Save as PDF</span>
          </button>
        </div>
      </div>

      {/* PRINTABLE STATEMENT / REPORT DOCUMENT */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '12px',
        border: '1.5px solid var(--border-medium)',
        padding: '36px',
        boxShadow: 'var(--shadow-md)',
        maxWidth: '1000px',
        margin: '0 auto',
      }}>
        {/* Printable Header */}
        <div style={{ borderBottom: '3px solid var(--accent-amber)', paddingBottom: '20px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <h2 style={{ fontSize: '1.8rem', color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                BUILDING MISTRY
              </h2>
              <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>
                Civil Engineering & Construction Management Statement
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <span className="badge badge-active" style={{ fontSize: '0.85rem' }}>
                Official Site Report
              </span>
              <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '6px' }}>
                Date: {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
              </div>
            </div>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '12px',
            backgroundColor: '#f8fafc',
            borderRadius: '8px',
            padding: '14px 18px',
            marginTop: '16px',
          }}>
            <div>
              <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#64748b', display: 'block' }}>
                Project / Site Name:
              </span>
              <strong style={{ fontSize: '1.1rem', color: '#0f172a' }}>{site.name}</strong>
            </div>

            <div>
              <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#64748b', display: 'block' }}>
                Client / Owner:
              </span>
              <strong style={{ fontSize: '1.05rem', color: '#0f172a' }}>
                {site.ownerName} {site.ownerPhone ? `(${site.ownerPhone})` : ''}
              </strong>
            </div>

            <div>
              <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#64748b', display: 'block' }}>
                Location:
              </span>
              <strong style={{ fontSize: '0.95rem', color: '#0f172a' }}>
                {site.area || site.address || 'Chennai'}
              </strong>
            </div>

            <div>
              <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#64748b', display: 'block' }}>
                Building Type:
              </span>
              <strong style={{ fontSize: '0.95rem', color: '#0f172a' }}>
                {site.buildingType}
              </strong>
            </div>
          </div>
        </div>

        {/* Financial Summary Strip */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: (summary.totalExtraPaid || 0) > 0 ? '1fr 1fr 1fr 1fr' : '1fr 1fr 1fr',
          gap: '16px',
          backgroundColor: '#0f172a',
          color: '#ffffff',
          borderRadius: '10px',
          padding: '16px 20px',
          marginBottom: '28px',
          textAlign: 'center',
        }}>
          <div>
            <span style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: '#94a3b8' }}>Total Project Cost</span>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: '1.5rem', fontWeight: 800, marginTop: '2px' }}>
              ₹{summary.totalCost.toLocaleString('en-IN')}
            </div>
          </div>
          <div>
            <span style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: '#94a3b8' }}>Total Settled / Paid</span>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: '1.5rem', fontWeight: 800, color: '#34d399', marginTop: '2px' }}>
              ₹{summary.totalPaid.toLocaleString('en-IN')}
            </div>
          </div>
          <div>
            <span style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: '#94a3b8' }}>Pending Balance</span>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: '1.5rem', fontWeight: 800, color: '#f87171', marginTop: '2px' }}>
              ₹{summary.totalBalance.toLocaleString('en-IN')}
            </div>
          </div>
          {(summary.totalExtraPaid || 0) > 0 && (
            <div>
              <span style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: '#94a3b8' }}>Extra Paid (Advance)</span>
              <div style={{ fontFamily: 'var(--font-heading)', fontSize: '1.5rem', fontWeight: 800, color: '#38bdf8', marginTop: '2px' }}>
                ₹{(summary.totalExtraPaid || 0).toLocaleString('en-IN')}
              </div>
            </div>
          )}
        </div>

        {/* 1. OVERALL COST BREAKDOWN TABLE */}
        {reportType === 'cost-sheet' && (
          <div>
            <h4 style={{ fontSize: '1.15rem', color: '#0f172a', marginBottom: '14px', borderBottom: '1.5px solid #cbd5e1', paddingBottom: '8px' }}>
              Expense Breakdown by Category
            </h4>

            <table className="data-table" style={{ border: '1px solid #cbd5e1', marginBottom: '24px' }}>
              <thead>
                <tr style={{ backgroundColor: '#f1f5f9' }}>
                  <th>Expense Category</th>
                  <th>Quantity / Details</th>
                  <th style={{ textAlign: 'right' }}>Total Cost (₹)</th>
                  <th style={{ textAlign: 'right' }}>Amount Paid (₹)</th>
                  <th style={{ textAlign: 'right' }}>Balance Due (₹)</th>
                  <th style={{ textAlign: 'right' }}>Extra Paid (₹)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>1. Construction Materials (Sand, Cement, Rod, Bricks)</strong></td>
                  <td>{materials.length + rodEntries.length} Invoices / Delivery Slips</td>
                  <td style={{ textAlign: 'right', fontWeight: 700 }}>₹{summary.materialCost.toLocaleString('en-IN')}</td>
                  <td style={{ textAlign: 'right', color: 'var(--success)' }}>₹{summary.materialPaid.toLocaleString('en-IN')}</td>
                  <td style={{ textAlign: 'right', color: summary.materialBalance > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>
                    ₹{summary.materialBalance.toLocaleString('en-IN')}
                  </td>
                  <td style={{ textAlign: 'right', color: (summary.materialExtraPaid || 0) > 0 ? 'var(--primary)' : 'var(--text-muted)' }}>
                    ₹{(summary.materialExtraPaid || 0).toLocaleString('en-IN')}
                  </td>
                </tr>
                <tr>
                  <td><strong>2. Labour Wages & Mistry Earnings</strong></td>
                  <td>{workers.length} Workers • Actual Attendance Log</td>
                  <td style={{ textAlign: 'right', fontWeight: 700 }}>₹{summary.labourGrossSalary.toLocaleString('en-IN')}</td>
                  <td style={{ textAlign: 'right', color: 'var(--success)' }}>₹{(summary.labourAdvances + summary.labourPaid).toLocaleString('en-IN')}</td>
                  <td style={{ textAlign: 'right', color: summary.labourBalance > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>
                    ₹{summary.labourBalance.toLocaleString('en-IN')}
                  </td>
                  <td style={{ textAlign: 'right', color: (summary.labourExtraPaid || 0) > 0 ? 'var(--primary)' : 'var(--text-muted)' }}>
                    ₹{(summary.labourExtraPaid || 0).toLocaleString('en-IN')}
                  </td>
                </tr>
                <tr>
                  <td><strong>3. Tools, Machinery & Equipment Rentals</strong></td>
                  <td>{tools.length} Tools & Machinery Items</td>
                  <td style={{ textAlign: 'right', fontWeight: 700 }}>₹{summary.toolsCost.toLocaleString('en-IN')}</td>
                  <td style={{ textAlign: 'right', color: 'var(--success)' }}>₹{summary.toolsPaid.toLocaleString('en-IN')}</td>
                  <td style={{ textAlign: 'right', color: summary.toolsBalance > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>
                    ₹{summary.toolsBalance.toLocaleString('en-IN')}
                  </td>
                  <td style={{ textAlign: 'right', color: (summary.toolsExtraPaid || 0) > 0 ? 'var(--primary)' : 'var(--text-muted)' }}>
                    ₹{(summary.toolsExtraPaid || 0).toLocaleString('en-IN')}
                  </td>
                </tr>
                <tr>
                  <td><strong>4. Daily Tea & Snacks Expenses</strong></td>
                  <td>{teaSnacks.length} Days of Refreshments</td>
                  <td style={{ textAlign: 'right', fontWeight: 700 }}>₹{summary.teaSnacksCost.toLocaleString('en-IN')}</td>
                  <td style={{ textAlign: 'right', color: 'var(--success)' }}>₹{summary.teaSnacksPaid.toLocaleString('en-IN')}</td>
                  <td style={{ textAlign: 'right', color: summary.teaSnacksBalance > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>
                    ₹{summary.teaSnacksBalance.toLocaleString('en-IN')}
                  </td>
                  <td style={{ textAlign: 'right', color: (summary.teaSnacksExtraPaid || 0) > 0 ? 'var(--primary)' : 'var(--text-muted)' }}>
                    ₹{(summary.teaSnacksExtraPaid || 0).toLocaleString('en-IN')}
                  </td>
                </tr>
                <tr>
                  <td><strong>5. Pooja Ceremonies & Worship</strong></td>
                  <td>{poojas.length} Ceremonies Conducted</td>
                  <td style={{ textAlign: 'right', fontWeight: 700 }}>₹{summary.poojaCost.toLocaleString('en-IN')}</td>
                  <td style={{ textAlign: 'right', color: 'var(--success)' }}>₹{summary.poojaPaid.toLocaleString('en-IN')}</td>
                  <td style={{ textAlign: 'right', color: summary.poojaBalance > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>
                    ₹{summary.poojaBalance.toLocaleString('en-IN')}
                  </td>
                  <td style={{ textAlign: 'right', color: (summary.poojaExtraPaid || 0) > 0 ? 'var(--primary)' : 'var(--text-muted)' }}>
                    ₹{(summary.poojaExtraPaid || 0).toLocaleString('en-IN')}
                  </td>
                </tr>
                <tr>
                  <td><strong>6. Site Electricity Bills</strong></td>
                  <td>{electricity.length} Monthly EB Bills</td>
                  <td style={{ textAlign: 'right', fontWeight: 700 }}>₹{summary.electricityCost.toLocaleString('en-IN')}</td>
                  <td style={{ textAlign: 'right', color: 'var(--success)' }}>₹{summary.electricityPaid.toLocaleString('en-IN')}</td>
                  <td style={{ textAlign: 'right', color: summary.electricityBalance > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>
                    ₹{summary.electricityBalance.toLocaleString('en-IN')}
                  </td>
                  <td style={{ textAlign: 'right', color: (summary.electricityExtraPaid || 0) > 0 ? 'var(--primary)' : 'var(--text-muted)' }}>
                    ₹{(summary.electricityExtraPaid || 0).toLocaleString('en-IN')}
                  </td>
                </tr>
                <tr>
                  <td><strong>7. Water Supply & Tanker Charges</strong></td>
                  <td>{water.length} Water Deliveries</td>
                  <td style={{ textAlign: 'right', fontWeight: 700 }}>₹{summary.waterCost.toLocaleString('en-IN')}</td>
                  <td style={{ textAlign: 'right', color: 'var(--success)' }}>₹{summary.waterPaid.toLocaleString('en-IN')}</td>
                  <td style={{ textAlign: 'right', color: summary.waterBalance > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>
                    ₹{summary.waterBalance.toLocaleString('en-IN')}
                  </td>
                  <td style={{ textAlign: 'right', color: (summary.waterExtraPaid || 0) > 0 ? 'var(--primary)' : 'var(--text-muted)' }}>
                    ₹{(summary.waterExtraPaid || 0).toLocaleString('en-IN')}
                  </td>
                </tr>
                <tr>
                  <td><strong>8. Other Site Expenses (Transport, Repair, Fuel, Misc)</strong></td>
                  <td>{otherExpenses.length} Miscellaneous Expenses</td>
                  <td style={{ textAlign: 'right', fontWeight: 700 }}>₹{summary.otherCost.toLocaleString('en-IN')}</td>
                  <td style={{ textAlign: 'right', color: 'var(--success)' }}>₹{summary.otherPaid.toLocaleString('en-IN')}</td>
                  <td style={{ textAlign: 'right', color: summary.otherBalance > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>
                    ₹{summary.otherBalance.toLocaleString('en-IN')}
                  </td>
                  <td style={{ textAlign: 'right', color: (summary.otherExtraPaid || 0) > 0 ? 'var(--primary)' : 'var(--text-muted)' }}>
                    ₹{(summary.otherExtraPaid || 0).toLocaleString('en-IN')}
                  </td>
                </tr>
              </tbody>
              <tfoot>
                <tr style={{ backgroundColor: '#f8fafc', fontWeight: 800, fontSize: '1.05rem' }}>
                  <td colSpan={2}>TOTAL EXPENSES (ACTUAL)</td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--font-heading)' }}>₹{summary.totalCost.toLocaleString('en-IN')}</td>
                  <td style={{ textAlign: 'right', color: 'var(--success)', fontFamily: 'var(--font-heading)' }}>₹{summary.totalPaid.toLocaleString('en-IN')}</td>
                  <td style={{ textAlign: 'right', color: summary.totalBalance > 0 ? 'var(--danger)' : 'var(--text-muted)', fontFamily: 'var(--font-heading)' }}>
                    ₹{summary.totalBalance.toLocaleString('en-IN')}
                  </td>
                  <td style={{ textAlign: 'right', color: (summary.totalExtraPaid || 0) > 0 ? 'var(--primary)' : 'var(--text-muted)', fontFamily: 'var(--font-heading)' }}>
                    ₹{(summary.totalExtraPaid || 0).toLocaleString('en-IN')}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* 2. MATERIALS STATEMENT */}
        {reportType === 'materials' && (
          <div>
            <h4 style={{ fontSize: '1.15rem', color: '#0f172a', marginBottom: '14px', borderBottom: '1.5px solid #cbd5e1', paddingBottom: '8px' }}>
              Materials Purchase Ledger
            </h4>
            <table className="data-table" style={{ border: '1px solid #cbd5e1', marginBottom: '24px' }}>
              <thead>
                <tr style={{ backgroundColor: '#f1f5f9' }}>
                  <th>Date</th>
                  <th>Category</th>
                  <th>Description</th>
                  <th>Supplier</th>
                  <th>Qty / Unit</th>
                  <th style={{ textAlign: 'right' }}>Total (₹)</th>
                  <th style={{ textAlign: 'right' }}>Paid (₹)</th>
                  <th style={{ textAlign: 'right' }}>Balance Due (₹)</th>
                  <th style={{ textAlign: 'right' }}>Extra Paid (₹)</th>
                </tr>
              </thead>
              <tbody>
                {materials.map(m => (
                  <tr key={m.id}>
                    <td>{m.purchaseDate}</td>
                    <td>{m.category.toUpperCase()}</td>
                    <td>{m.materialName}</td>
                    <td>{m.supplier}</td>
                    <td>{m.quantity} {m.unit}</td>
                    <td style={{ textAlign: 'right' }}>₹{m.totalAmount.toLocaleString('en-IN')}</td>
                    <td style={{ textAlign: 'right', color: 'var(--success)' }}>₹{m.paidAmount.toLocaleString('en-IN')}</td>
                    <td style={{ textAlign: 'right', color: m.balance > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>₹{m.balance.toLocaleString('en-IN')}</td>
                    <td style={{ textAlign: 'right', color: (m.extraPaid || 0) > 0 ? 'var(--primary)' : 'var(--text-muted)' }}>₹{(m.extraPaid || 0).toLocaleString('en-IN')}</td>
                  </tr>
                ))}
                {rodEntries.map(r => (
                  <tr key={r.id}>
                    <td>{r.purchaseDate}</td>
                    <td>STEEL</td>
                    <td>Rod {r.diameter} ({r.brand || 'TMT'})</td>
                    <td>{r.supplier}</td>
                    <td>{r.weightKg} kg</td>
                    <td style={{ textAlign: 'right' }}>₹{r.totalAmount.toLocaleString('en-IN')}</td>
                    <td style={{ textAlign: 'right', color: 'var(--success)' }}>₹{r.paidAmount.toLocaleString('en-IN')}</td>
                    <td style={{ textAlign: 'right', color: r.balance > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>₹{r.balance.toLocaleString('en-IN')}</td>
                    <td style={{ textAlign: 'right', color: (r.extraPaid || 0) > 0 ? 'var(--primary)' : 'var(--text-muted)' }}>₹{(r.extraPaid || 0).toLocaleString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 3. LABOUR WAGE STATEMENT */}
        {reportType === 'labour' && (
          <div>
            <h4 style={{ fontSize: '1.15rem', color: '#0f172a', marginBottom: '14px', borderBottom: '1.5px solid #cbd5e1', paddingBottom: '8px' }}>
              Labour Wages & Attendance Summary
            </h4>
            <table className="data-table" style={{ border: '1px solid #cbd5e1', marginBottom: '24px' }}>
              <thead>
                <tr style={{ backgroundColor: '#f1f5f9' }}>
                  <th>Worker Name</th>
                  <th>Category</th>
                  <th>Daily Wage</th>
                  <th>Days Worked</th>
                  <th style={{ textAlign: 'right' }}>Gross Wages (₹)</th>
                  <th style={{ textAlign: 'right' }}>Rec. Advances (₹)</th>
                  <th style={{ textAlign: 'right' }}>Paid (₹)</th>
                  <th style={{ textAlign: 'right' }}>Balance Due (₹)</th>
                  <th style={{ textAlign: 'right' }}>Extra Paid (₹)</th>
                </tr>
              </thead>
              <tbody>
                {workers.map(w => {
                  const wAtt = attendance.filter(a => a.workerId === w.id);
                  const daysWorked = wAtt.reduce((acc, a) => acc + (a.dayMultiplier || 0), 0);
                  const gross = Math.round(daysWorked * w.dailyWage);
                  const wAdv = advances
                    .filter(a => a.workerId === w.id && a.advanceType !== 'Non-Recoverable')
                    .reduce((acc, a) => acc + a.amount, 0);
                  const wSal = salaryPayments.filter(s => s.workerId === w.id).reduce((acc, s) => acc + s.paidAmount, 0);
                  const bal = Math.max(0, gross - wAdv - wSal);
                  const extra = Math.max(0, (wAdv + wSal) - gross);

                  return (
                    <tr key={w.id}>
                      <td><strong>{w.name}</strong></td>
                      <td>{w.category}</td>
                      <td>₹{w.dailyWage}/day</td>
                      <td>{daysWorked} Days</td>
                      <td style={{ textAlign: 'right' }}>₹{gross.toLocaleString('en-IN')}</td>
                      <td style={{ textAlign: 'right', color: '#dc2626' }}>- ₹{wAdv.toLocaleString('en-IN')}</td>
                      <td style={{ textAlign: 'right', color: 'var(--success)' }}>₹{wSal.toLocaleString('en-IN')}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: bal > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>₹{bal.toLocaleString('en-IN')}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: extra > 0 ? 'var(--primary)' : 'var(--text-muted)' }}>₹{extra.toLocaleString('en-IN')}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Signatures for Print */}
        <div style={{ marginTop: '48px', display: 'flex', justifyContent: 'space-between', paddingTop: '24px', borderTop: '1px dashed #94a3b8' }}>
          <div>
            <div style={{ borderTop: '1px solid #0f172a', width: '180px', marginTop: '30px', textAlign: 'center', fontSize: '0.85rem' }}>
              Building Mistry Signature
            </div>
          </div>
          <div>
            <div style={{ borderTop: '1px solid #0f172a', width: '180px', marginTop: '30px', textAlign: 'center', fontSize: '0.85rem' }}>
              Client / Owner Signature
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
