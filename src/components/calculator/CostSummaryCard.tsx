import React, { useState } from 'react';
import { IndianRupee, Truck, Receipt, ChevronDown, ChevronUp } from 'lucide-react';
import type { CalculationCostSummary } from '../../domain/buildingCalculator/types';

interface CostSummaryCardProps {
  costs: CalculationCostSummary;
  onLabourChange?: (amount: number) => void;
}

export const CostSummaryCard: React.FC<CostSummaryCardProps> = ({ costs, onLabourChange }) => {
  const [showBreakdown, setShowBreakdown] = useState(false);

  const formatINR = (val: number) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(val);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
      <div className="p-4 bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex items-center justify-between">
        <div>
          <span className="text-xs uppercase tracking-wider text-indigo-300 font-semibold block">Total Estimated Cost</span>
          <div className="text-2xl font-bold flex items-center gap-1 mt-0.5">
            {formatINR(costs.overallTotalCost)}
          </div>
        </div>
        <div className="text-right text-xs text-slate-300">
          <div>Materials: <span className="font-semibold text-white">{formatINR(costs.totalMaterialBaseCost + costs.totalTransportCost + costs.totalTaxCost)}</span></div>
          {costs.labourCost > 0 && (
            <div>Labour: <span className="font-semibold text-white">{formatINR(costs.labourCost)}</span></div>
          )}
        </div>
      </div>

      <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-4 text-slate-600 dark:text-slate-300">
          <div className="flex items-center gap-1">
            <span className="text-slate-400">Base:</span>
            <span className="font-medium text-slate-800 dark:text-slate-100">{formatINR(costs.totalMaterialBaseCost)}</span>
          </div>
          <div className="flex items-center gap-1">
            <Truck size={13} className="text-slate-400" />
            <span className="text-slate-400">Transport:</span>
            <span className="font-medium text-slate-800 dark:text-slate-100">{formatINR(costs.totalTransportCost)}</span>
          </div>
          <div className="flex items-center gap-1">
            <Receipt size={13} className="text-slate-400" />
            <span className="text-slate-400">GST:</span>
            <span className="font-medium text-slate-800 dark:text-slate-100">{formatINR(costs.totalTaxCost)}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowBreakdown(!showBreakdown)}
          className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 flex items-center gap-1"
        >
          {showBreakdown ? (
            <>Hide Itemized Rates <ChevronUp size={14} /></>
          ) : (
            <>View Itemized Rates <ChevronDown size={14} /></>
          )}
        </button>
      </div>

      {showBreakdown && (
        <div className="overflow-x-auto p-3">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                <th className="pb-1.5 font-medium">Material</th>
                <th className="pb-1.5 font-medium text-right">Qty</th>
                <th className="pb-1.5 font-medium text-right">Unit Rate</th>
                <th className="pb-1.5 font-medium text-right">Transport</th>
                <th className="pb-1.5 font-medium text-right">GST</th>
                <th className="pb-1.5 font-medium text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {costs.materialItems.map((it, idx) => (
                <tr key={idx} className="text-slate-700 dark:text-slate-300">
                  <td className="py-1.5 font-medium">{it.materialName}</td>
                  <td className="py-1.5 text-right font-mono">{it.quantity} {it.unit}</td>
                  <td className="py-1.5 text-right font-mono">{formatINR(it.unitRate)}</td>
                  <td className="py-1.5 text-right font-mono text-slate-500">{formatINR(it.transportCost)}</td>
                  <td className="py-1.5 text-right font-mono text-slate-500">{formatINR(it.taxCost)}</td>
                  <td className="py-1.5 text-right font-mono font-semibold text-slate-900 dark:text-slate-100">{formatINR(it.totalCost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {onLabourChange && (
        <div className="p-3 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
          <label className="text-slate-600 dark:text-slate-400 font-medium flex items-center gap-1.5">
            <IndianRupee size={13} /> Include Labour Cost (INR)
          </label>
          <input
            type="number"
            min={0}
            step={500}
            value={costs.labourCost || ''}
            placeholder="0"
            onChange={(e) => onLabourChange(parseFloat(e.target.value) || 0)}
            className="w-32 text-right py-1 px-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono font-semibold text-slate-800 dark:text-slate-200"
          />
        </div>
      )}
    </div>
  );
};

