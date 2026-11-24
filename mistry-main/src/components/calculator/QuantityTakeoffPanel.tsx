import React, { useState } from 'react';
import {
  Save,
  Package,
  Layers,
  IndianRupee,
  ShieldCheck,
  Check,
  ChevronDown,
  ChevronUp,
  Download,
  Info,
  TrendingUp,
  Printer,
  FileSpreadsheet,
  PieChart,
} from 'lucide-react';
import type { CalculationCostSummary } from '../../domain/buildingCalculator/types';

export interface TakeoffMaterialItem {
  id: string;
  name: string;
  category: 'cement' | 'sand' | 'aggregate' | 'brick' | 'steel' | 'labour' | 'tile' | 'other';
  quantity: number | string;
  unit: string;
  secondaryUnit?: string;
  rate: number;
  subtotal: number;
  transport?: number;
  tax?: number;
}

interface QuantityTakeoffPanelProps {
  title: string;
  calculationName: string;
  volumeOrAreaMetric: {
    primaryValue: string | number;
    primaryLabel: string;
    secondaryValue?: string | number;
    secondaryLabel?: string;
  };
  costs: CalculationCostSummary;
  materials: TakeoffMaterialItem[];
  onLabourChange?: (amount: number) => void;
  onSave: () => void;
  isSaved?: boolean;
  assumptions?: string[];
  warnings?: string[];
  dryFactorNote?: string;
  className?: string;
}

export const QuantityTakeoffPanel: React.FC<QuantityTakeoffPanelProps> = ({
  title,
  calculationName,
  volumeOrAreaMetric,
  costs,
  materials,
  onLabourChange,
  onSave,
  isSaved = false,
  assumptions = [],
  warnings = [],
  dryFactorNote,
  className = '',
}) => {
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);
  const [labourInput, setLabourInput] = useState(String(costs.labourCost));

  const formatINR = (val: number) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 1,
    }).format(val);

  // Compute cost percentages for visual distribution bar
  const totalCost = Math.max(1, costs.overallTotalCost);
  const materialTotalCost = costs.totalMaterialBaseCost + costs.totalTransportCost + costs.totalTaxCost;

  // Colors for donut chart & table
  const categoryColors: Record<TakeoffMaterialItem['category'], { fill: string; dot: string }> = {
    cement: { fill: '#f59e0b', dot: '#f59e0b' },
    sand: { fill: '#14b8a6', dot: '#14b8a6' },
    aggregate: { fill: '#a855f7', dot: '#a855f7' },
    brick: { fill: '#f43f5e', dot: '#f43f5e' },
    steel: { fill: '#3b82f6', dot: '#3b82f6' },
    tile: { fill: '#06b6d4', dot: '#06b6d4' },
    labour: { fill: '#10b981', dot: '#10b981' },
    other: { fill: '#64748b', dot: '#64748b' },
  };

  // Build segments for the circular Donut Chart matching Image 4 (MYDESIGNERPLUS)
  const chartItems = [
    ...materials.map((m) => ({
      id: m.id,
      name: m.name,
      amount: m.subtotal,
      color: categoryColors[m.category]?.fill || '#64748b',
    })),
    ...(costs.labourCost > 0
      ? [
          {
            id: 'site_labour',
            name: 'Site Labour Allowance',
            amount: costs.labourCost,
            color: '#10b981',
          },
        ]
      : []),
  ].filter((item) => item.amount > 0);

  const radius = 38;
  const circumference = 2 * Math.PI * radius; // ~238.76
  let currentOffset = 0;
  const donutSegments = chartItems.map((item) => {
    const percentage = (item.amount / totalCost) * 100;
    const strokeLength = (percentage / 100) * circumference;
    const strokeGap = circumference - strokeLength;
    const strokeDashoffset = -currentOffset;
    currentOffset += strokeLength;

    return {
      ...item,
      percentage: Math.round(percentage * 10) / 10,
      strokeDasharray: `${strokeLength} ${strokeGap}`,
      strokeDashoffset,
    };
  });

  const handleExportCSV = () => {
    const headers = ['Component / Material', 'Category', 'Quantity', 'Unit', 'Unit Rate (INR)', 'Total Amount (INR)'];
    const rows = materials.map((m) => [
      `"${m.name}"`,
      m.category,
      typeof m.quantity === 'number' ? m.quantity : `"${m.quantity}"`,
      m.unit,
      m.rate,
      m.subtotal,
    ]);
    if (costs.labourCost > 0) {
      rows.push(['"Site Labour Allowance"', 'labour', '1', 'Job', String(costs.labourCost), String(costs.labourCost)]);
    }
    rows.push(['"GRAND TOTAL ESTIMATE"', '', '', '', '', String(costs.overallTotalCost)]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${calculationName.replace(/\s+/g, '_')}_takeoff.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className={`space-y-4 ${className}`} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* ── 1. Top 3 Executive KPI Metric Cards (Image 4 Auto-Estimator Style) ── */}
      <div className="bm-kpi-grid">
        {/* Card 1: Total Quantity / Volume (Dark Card) */}
        <div className="bm-kpi-card bm-kpi-card-dark">
          <div className="bm-kpi-lbl">{volumeOrAreaMetric.primaryLabel}</div>
          <div>
            <div className="bm-kpi-val">{volumeOrAreaMetric.primaryValue}</div>
            {volumeOrAreaMetric.secondaryValue && (
              <div className="bm-kpi-sub">
                {volumeOrAreaMetric.secondaryValue} {volumeOrAreaMetric.secondaryLabel}
              </div>
            )}
          </div>
          <div style={{ fontSize: 10, opacity: 0.7, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
            {calculationName}
          </div>
        </div>

        {/* Card 2: Material Subtotal (Emerald Green Card) */}
        <div className="bm-kpi-card bm-kpi-card-green">
          <div className="bm-kpi-lbl">Subtotal (Materials)</div>
          <div>
            <div className="bm-kpi-val">{formatINR(materialTotalCost)}</div>
            <div className="bm-kpi-sub">Landed with GST &amp; Transport</div>
          </div>
          <div style={{ fontSize: 10, opacity: 0.85 }}>
            {materials.filter((m) => m.category !== 'labour').length} Bill items
          </div>
        </div>

        {/* Card 3: Final Total (Royal Violet / Indigo Card) */}
        <div className="bm-kpi-card bm-kpi-card-indigo">
          <div className="bm-kpi-lbl">Final Total</div>
          <div>
            <div className="bm-kpi-val">{formatINR(costs.overallTotalCost)}</div>
            <div className="bm-kpi-sub">Labour: {formatINR(costs.labourCost)}</div>
          </div>
          <div style={{ fontSize: 10, opacity: 0.85 }}>
            All-inclusive Takeoff
          </div>
        </div>
      </div>

      {/* ── 2. Cost Breakdown Card with Real SVG Donut Chart (Image 4 Style) ── */}
      <div className="bm-donut-card">
        <div className="bm-card-title-row">
          <span className="bm-card-title">
            <PieChart size={15} style={{ color: '#4f46e5' }} />
            Cost Breakdown
          </span>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#059669' }}>
            {formatINR(costs.overallTotalCost)}
          </span>
        </div>

        {/* Centered Donut SVG */}
        <div className="bm-donut-container">
          <svg className="bm-donut-svg" viewBox="0 0 100 100">
            {/* Background Track */}
            <circle
              cx="50"
              cy="50"
              r={radius}
              stroke="#f1f5f9"
              strokeWidth="11"
              fill="transparent"
            />
            {/* Color Segments */}
            {donutSegments.map((seg) => (
              <circle
                key={seg.id}
                cx="50"
                cy="50"
                r={radius}
                stroke={seg.color}
                strokeWidth="11"
                fill="transparent"
                strokeDasharray={seg.strokeDasharray}
                strokeDashoffset={seg.strokeDashoffset}
                style={{ transition: 'stroke-dasharray 0.5s ease' }}
              />
            ))}
          </svg>
          <div className="bm-donut-center">
            <div className="bm-donut-center-lbl">Total</div>
            <div className="bm-donut-center-val">
              {new Intl.NumberFormat('en-IN', { notation: 'compact', compactDisplay: 'short' }).format(costs.overallTotalCost)}
            </div>
          </div>
        </div>

        {/* Colored Legend List with Name, Amount and % */}
        <div className="bm-legend-list">
          {donutSegments.map((seg) => (
            <div key={seg.id} className="bm-legend-item">
              <div className="bm-legend-left">
                <span className="bm-legend-dot" style={{ backgroundColor: seg.color }} />
                <span className="bm-legend-name">{seg.name}</span>
              </div>
              <div className="bm-legend-right">
                <span className="bm-legend-amount">{formatINR(seg.amount)}</span>
                <span className="bm-legend-pct">({seg.percentage}%)</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── 3. Selected Quantities Metrics Card (Image 3 Style) ── */}
      <div className="bm-quantities-card">
        <div className="bm-card-title">
          <Layers size={14} style={{ color: '#4f46e5' }} />
          Selected Quantities
        </div>
        <div className="bm-quantities-grid">
          {materials.map((m) => (
            <div key={m.id} className="bm-quantity-stat">
              <span className="bm-quantity-num">
                {typeof m.quantity === 'number' ? m.quantity.toLocaleString('en-IN') : m.quantity}{' '}
                <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b' }}>{m.unit}</span>
              </span>
              <span className="bm-quantity-lbl">{m.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── 4. Materials & Costs Schedule Table (Image 4 Style) ── */}
      <div className="bm-table-card">
        <div className="bm-table-header">
          <div>
            <h3 style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', margin: 0, color: '#0f172a' }}>
              Materials &amp; Costs
            </h3>
          </div>
          <div className="bm-table-actions">
            <button
              type="button"
              onClick={() => window.print()}
              className="bm-btn-secondary"
              title="Print or Save as PDF"
            >
              <Printer size={13} />
              <span>PDF</span>
            </button>
            <button
              type="button"
              onClick={handleExportCSV}
              className="bm-btn-secondary"
              title="Download CSV"
            >
              <FileSpreadsheet size={13} />
              <span>CSV</span>
            </button>
            <button
              type="button"
              onClick={onSave}
              className="bm-btn-primary"
            >
              <Save size={13} />
              <span>{isSaved ? 'Saved' : 'Save'}</span>
            </button>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="bm-table">
            <thead>
              <tr>
                <th>Component</th>
                <th className="text-right">Qty</th>
                <th className="text-center">Unit</th>
                <th className="text-right">Price</th>
                <th className="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {materials.map((m) => (
                <tr key={m.id}>
                  <td>
                    <div className="bm-component-name">{m.name}</div>
                    {m.secondaryUnit && <div className="bm-component-sub">{m.secondaryUnit}</div>}
                  </td>
                  <td className="text-right" style={{ fontWeight: 700, fontFamily: 'monospace' }}>
                    {typeof m.quantity === 'number' ? m.quantity.toLocaleString('en-IN') : m.quantity}
                  </td>
                  <td className="text-center" style={{ fontSize: 11, color: '#64748b' }}>
                    {m.unit}
                  </td>
                  <td className="text-right" style={{ fontFamily: 'monospace', color: '#475569' }}>
                    ₹{m.rate.toLocaleString('en-IN')}
                  </td>
                  <td className="text-right bm-price-val">
                    {formatINR(m.subtotal)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Labour Allowance & Summary Footer */}
        <div className="bm-table-footer">
          {onLabourChange && (
            <div className="bm-summary-line">
              <span style={{ fontWeight: 600, color: '#475569' }}>Site Labour Allowance</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 700 }}>₹</span>
                <input
                  type="number"
                  value={labourInput}
                  onChange={(e) => {
                    setLabourInput(e.target.value);
                    const val = parseFloat(e.target.value) || 0;
                    onLabourChange(val);
                  }}
                  style={{
                    width: 90,
                    height: 28,
                    padding: '2px 8px',
                    fontSize: 12,
                    fontWeight: 700,
                    border: '1px solid #cbd5e1',
                    borderRadius: 6,
                    textAlign: 'right',
                  }}
                />
              </div>
            </div>
          )}

          <div className="bm-summary-line">
            <span style={{ color: '#64748b' }}>Materials Subtotal</span>
            <span style={{ fontWeight: 700, fontFamily: 'monospace' }}>{formatINR(materialTotalCost)}</span>
          </div>

          <div className="bm-summary-line total">
            <span>FINAL TOTAL</span>
            <span style={{ color: '#4f46e5' }}>{formatINR(costs.overallTotalCost)}</span>
          </div>
        </div>
      </div>

      {/* ── 5. Technical Details & IS Standard Rules (Collapsible Drawer) ── */}
      <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 14, overflow: 'hidden' }}>
        <button
          type="button"
          onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
          style={{
            width: '100%',
            padding: '10px 14px',
            background: '#ffffff',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            fontSize: 11,
            fontWeight: 700,
            color: '#64748b',
            textTransform: 'uppercase',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <ShieldCheck size={14} style={{ color: '#059669' }} />
            IS Standards &amp; Calculation Notes
          </span>
          {showTechnicalDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        {showTechnicalDetails && (
          <div style={{ padding: '12px 14px', borderTop: '1px solid #f1f5f9', fontSize: 11, color: '#475569', lineHeight: 1.6 }}>
            {dryFactorNote && <p style={{ marginBottom: 6 }}>{dryFactorNote}</p>}
            {assumptions.length > 0 && (
              <ul style={{ paddingLeft: 18, margin: 0 }}>
                {assumptions.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
