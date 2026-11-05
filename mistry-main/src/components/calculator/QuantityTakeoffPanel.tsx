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

  const categoryColors: Record<TakeoffMaterialItem['category'], { bg: string; fill: string; dot: string; text: string }> = {
    cement: { bg: 'bg-amber-100', fill: '#f59e0b', dot: 'bg-amber-500', text: 'text-amber-800' },
    sand: { bg: 'bg-teal-100', fill: '#14b8a6', dot: 'bg-teal-500', text: 'text-teal-800' },
    aggregate: { bg: 'bg-purple-100', fill: '#a855f7', dot: 'bg-purple-500', text: 'text-purple-800' },
    brick: { bg: 'bg-rose-100', fill: '#f43f5e', dot: 'bg-rose-500', text: 'text-rose-800' },
    steel: { bg: 'bg-blue-100', fill: '#3b82f6', dot: 'bg-blue-500', text: 'text-blue-800' },
    tile: { bg: 'bg-cyan-100', fill: '#06b6d4', dot: 'bg-cyan-500', text: 'text-cyan-800' },
    labour: { bg: 'bg-emerald-100', fill: '#10b981', dot: 'bg-emerald-500', text: 'text-emerald-800' },
    other: { bg: 'bg-slate-100', fill: '#64748b', dot: 'bg-slate-500', text: 'text-slate-800' },
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* ── 1. Executive Top Metric Cards (Auto-Estimator Style) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Total Quantity / Volume Card (Dark Theme) */}
        <div className="bg-slate-900 text-white p-3.5 rounded-2xl border border-slate-800 shadow-xs flex flex-col justify-between">
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
            {volumeOrAreaMetric.primaryLabel}
          </span>
          <div className="my-1.5">
            <div className="text-xl font-bold font-mono text-white leading-tight">
              {volumeOrAreaMetric.primaryValue}
            </div>
            {volumeOrAreaMetric.secondaryValue && (
              <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                {volumeOrAreaMetric.secondaryValue} {volumeOrAreaMetric.secondaryLabel}
              </div>
            )}
          </div>
          <span className="text-[10px] text-slate-400 font-medium truncate">
            {calculationName}
          </span>
        </div>

        {/* Material Subtotal Card (Emerald Accent) */}
        <div className="bg-emerald-50/80 dark:bg-emerald-950/30 p-3.5 rounded-2xl border border-emerald-200/80 dark:border-emerald-800/60 shadow-xs flex flex-col justify-between">
          <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-800 dark:text-emerald-300">
            Material Subtotal
          </span>
          <div className="my-1.5">
            <div className="text-xl font-bold font-mono text-emerald-900 dark:text-emerald-100 leading-tight">
              {formatINR(materialTotalCost)}
            </div>
            <div className="text-[11px] text-emerald-700/80 dark:text-emerald-400 font-medium mt-0.5">
              Landed with GST &amp; Transport
            </div>
          </div>
          <span className="text-[10px] text-emerald-700/80 dark:text-emerald-400">
            {materials.filter((m) => m.category !== 'labour').length} Bill items
          </span>
        </div>

        {/* Project Total Card (Indigo Accent) */}
        <div className="bg-indigo-600 text-white p-3.5 rounded-2xl border border-indigo-700 shadow-xs flex flex-col justify-between">
          <span className="text-[10px] uppercase font-bold tracking-wider text-indigo-200">
            Total Estimated Cost
          </span>
          <div className="my-1.5">
            <div className="text-xl font-bold font-mono text-white leading-tight">
              {formatINR(costs.overallTotalCost)}
            </div>
            <div className="text-[11px] text-indigo-100 font-medium mt-0.5">
              Materials + Labour
            </div>
          </div>
          <span className="text-[10px] text-indigo-200 font-medium">
            Labour: {formatINR(costs.labourCost)}
          </span>
        </div>
      </div>

      {/* ── 2. Materials & Cost Schedule Table (Quantity Takeoff) ── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        {/* Table Title Bar */}
        <div className="px-4 py-3 bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-1.5">
              <Package size={14} className="text-indigo-600" />
              Materials &amp; Cost Breakdown
            </h3>
          </div>
          <button
            type="button"
            onClick={onSave}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
              isSaved
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs'
            }`}
          >
            {isSaved ? <Check size={14} /> : <Save size={14} />}
            <span>{isSaved ? 'Saved to Project' : 'Save Calculation'}</span>
          </button>
        </div>

        {/* Main Schedule Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-200/80 dark:border-slate-800 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-2.5 px-4 font-semibold">Component / Material</th>
                <th className="py-2.5 px-3 font-semibold text-right">Quantity</th>
                <th className="py-2.5 px-3 font-semibold text-right">Unit Rate</th>
                <th className="py-2.5 px-4 font-semibold text-right">Total Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {materials.map((item) => {
                const colorConfig = categoryColors[item.category] || categoryColors.other;
                const costShare = Math.round((item.subtotal / totalCost) * 100);

                return (
                  <tr
                    key={item.id}
                    className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    {/* Material Name & Tag */}
                    <td className="py-2.5 px-4">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${colorConfig.dot}`} />
                        <div>
                          <div className="font-bold text-slate-900 dark:text-slate-100 leading-tight">
                            {item.name}
                          </div>
                          <div className="text-[10px] text-slate-400 capitalize">
                            {item.category} • {costShare}% of cost
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Quantity & Units */}
                    <td className="py-2.5 px-3 text-right">
                      <div className="font-bold font-mono text-slate-800 dark:text-slate-200">
                        {typeof item.quantity === 'number' ? item.quantity.toLocaleString('en-IN') : item.quantity} {item.unit}
                      </div>
                      {item.secondaryUnit && (
                        <div className="text-[10px] text-slate-400 font-mono">
                          {item.secondaryUnit}
                        </div>
                      )}
                    </td>

                    {/* Unit Rate */}
                    <td className="py-2.5 px-3 text-right font-mono text-slate-600 dark:text-slate-400">
                      {item.rate > 0 ? formatINR(item.rate) : '—'}
                      {item.rate > 0 && <span className="text-[10px] text-slate-400"> / {item.unit}</span>}
                    </td>

                    {/* Subtotal */}
                    <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                      {formatINR(item.subtotal)}
                    </td>
                  </tr>
                );
              })}

              {/* Labour Row */}
              <tr className="bg-slate-50/40 dark:bg-slate-800/20 font-medium">
                <td className="py-2.5 px-4">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                    <div>
                      <div className="font-bold text-slate-900 dark:text-slate-100">Site Labour Allowance</div>
                      <div className="text-[10px] text-slate-400">Masonry / Casting / Curing labour</div>
                    </div>
                  </div>
                </td>
                <td className="py-2.5 px-3 text-right font-mono text-slate-500">1 Job</td>
                <td className="py-2.5 px-3 text-right font-mono text-slate-500">{formatINR(costs.labourCost)}</td>
                <td className="py-2.5 px-4 text-right font-mono font-bold text-emerald-700 dark:text-emerald-400">
                  {formatINR(costs.labourCost)}
                </td>
              </tr>
            </tbody>

            {/* Table Footer Totals */}
            <tfoot>
              <tr className="bg-slate-100/60 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-700">
                <td colSpan={3} className="py-3 px-4 font-extrabold text-slate-900 dark:text-slate-100 text-xs">
                  Grand Total Estimate
                </td>
                <td className="py-3 px-4 text-right font-mono font-extrabold text-indigo-700 dark:text-indigo-300 text-sm">
                  {formatINR(costs.overallTotalCost)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* ── 3. Visual Cost Distribution Bar ── */}
        <div className="p-3.5 bg-slate-50/60 dark:bg-slate-800/40 border-t border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 mb-2">
            <span>Cost Distribution</span>
            <span>Total: {formatINR(costs.overallTotalCost)}</span>
          </div>

          {/* Segmented bar */}
          <div className="w-full h-3 rounded-full overflow-hidden flex bg-slate-200 dark:bg-slate-700 gap-0.5">
            {materials.map((m) => {
              const color = categoryColors[m.category] || categoryColors.other;
              const pct = (m.subtotal / totalCost) * 100;
              if (pct < 0.5) return null;
              return (
                <div
                  key={m.id}
                  style={{ width: `${pct}%`, backgroundColor: color.fill }}
                  title={`${m.name}: ${formatINR(m.subtotal)} (${Math.round(pct)}%)`}
                />
              );
            })}
            {costs.labourCost > 0 && (
              <div
                style={{ width: `${(costs.labourCost / totalCost) * 100}%`, backgroundColor: '#10b981' }}
                title={`Labour: ${formatINR(costs.labourCost)} (${Math.round((costs.labourCost / totalCost) * 100)}%)`}
              />
            )}
          </div>

          {/* Legend Chips */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-2.5 text-[11px] text-slate-600 dark:text-slate-400">
            {materials.map((m) => {
              const color = categoryColors[m.category] || categoryColors.other;
              const pct = Math.round((m.subtotal / totalCost) * 100);
              return (
                <div key={m.id} className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${color.dot}`} />
                  <span className="font-medium text-slate-700 dark:text-slate-300">{m.name}</span>
                  <span className="text-slate-400 font-mono">({pct}%)</span>
                </div>
              );
            })}
            {costs.labourCost > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="font-medium text-slate-700 dark:text-slate-300">Labour</span>
                <span className="text-slate-400 font-mono">
                  ({Math.round((costs.labourCost / totalCost) * 100)}%)
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ── 4. Technical Specifications Toggle ── */}
        <div className="border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
            className="w-full px-4 py-2.5 flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
          >
            <span className="flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-indigo-600" />
              <span>IS Civil Engineering Standards &amp; Dry Factors</span>
            </span>
            {showTechnicalDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {showTechnicalDetails && (
            <div className="p-4 bg-slate-50/80 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 space-y-2.5 text-xs text-slate-600 dark:text-slate-400">
              {dryFactorNote && (
                <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 text-amber-900 dark:text-amber-200 flex items-start gap-2">
                  <Info size={15} className="text-amber-600 shrink-0 mt-0.5" />
                  <div className="text-[11px] leading-relaxed">{dryFactorNote}</div>
                </div>
              )}

              {assumptions.length > 0 && (
                <div>
                  <span className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Design Assumptions:
                  </span>
                  <ul className="list-disc pl-4 space-y-0.5 text-[11px]">
                    {assumptions.map((ass, i) => (
                      <li key={i}>{ass}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Editable Labour Allowance */}
              {onLabourChange && (
                <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3">
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                    Adjust Site Labour Cost:
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono">₹</span>
                    <input
                      type="number"
                      value={labourInput}
                      onChange={(e) => {
                        setLabourInput(e.target.value);
                        const num = parseFloat(e.target.value) || 0;
                        onLabourChange(num);
                      }}
                      className="w-28 py-1 px-2 border rounded-lg text-xs font-mono font-bold bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-right"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

