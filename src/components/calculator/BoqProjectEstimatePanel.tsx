import React, { useState, useMemo } from 'react';
import {
  FileSpreadsheet,
  Download,
  CheckSquare,
  Square,
  Building2,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Printer,
  PieChart as PieChartIcon,
  RefreshCw,
  Layers,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { SavedBuildingCalculation, ProjectBOQEstimate } from '../../domain/buildingCalculator/types';
import { consolidateBOQ, type SiteMaterialRecordSummary } from '../../domain/buildingCalculator/boq';

interface BoqProjectEstimatePanelProps {
  savedCalculations: SavedBuildingCalculation[];
  siteId?: string;
  siteName?: string;
  actualSiteMaterials?: SiteMaterialRecordSummary[];
}

export const BoqProjectEstimatePanel: React.FC<BoqProjectEstimatePanelProps> = ({
  savedCalculations,
  siteId,
  siteName,
  actualSiteMaterials,
}) => {
  const [selectedIds, setSelectedIds] = useState<string[]>(
    savedCalculations.map((c) => c.id)
  );
  const [projectName, setProjectName] = useState(siteName ? `${siteName} — Complete BOQ` : 'Project Master BOQ');
  const [showInclusionFilter, setShowInclusionFilter] = useState(false);
  const [activeTab, setActiveTab] = useState<'takeoff' | 'variance'>('takeoff');

  const selectedCalcs = useMemo(() => {
    return savedCalculations.filter((c) => selectedIds.includes(c.id));
  }, [savedCalculations, selectedIds]);

  const boq = useMemo(() => {
    return consolidateBOQ(
      projectName,
      selectedCalcs,
      siteId,
      siteName,
      actualSiteMaterials
    );
  }, [projectName, selectedCalcs, siteId, siteName, actualSiteMaterials]);

  const formatINR = (val: number) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(val);

  const toggleSelect = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((i) => i !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const toggleAll = () => {
    if (selectedIds.length === savedCalculations.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(savedCalculations.map((c) => c.id));
    }
  };

  // Group materials for Cost Breakdown & Donut Chart
  const costBreakdownData = useMemo(() => {
    const categories: Record<string, { label: string; amount: number; color: string }> = {
      cement: { label: 'Cement', amount: 0, color: '#3b82f6' }, // blue
      sand: { label: 'Sand & Aggregates', amount: 0, color: '#f59e0b' }, // amber
      brick: { label: 'Bricks & AAC Blocks', amount: 0, color: '#ef4444' }, // red
      steel: { label: 'Steel & Rebar', amount: 0, color: '#8b5cf6' }, // purple
      tile: { label: 'Tiles & Adhesives', amount: 0, color: '#10b981' }, // emerald
      labour: { label: 'Site Labour Allowance', amount: boq.totalLabourCost, color: '#ec4899' }, // pink
      other: { label: 'Other Materials', amount: 0, color: '#64748b' }, // slate
    };

    boq.consolidatedMaterials.forEach((m) => {
      const nameLower = m.materialName.toLowerCase();
      if (nameLower.includes('cement')) {
        categories.cement.amount += m.totalCost;
      } else if (nameLower.includes('sand') || nameLower.includes('aggregate') || nameLower.includes('coarse')) {
        categories.sand.amount += m.totalCost;
      } else if (nameLower.includes('brick') || nameLower.includes('block') || nameLower.includes('aac')) {
        categories.brick.amount += m.totalCost;
      } else if (nameLower.includes('steel') || nameLower.includes('rebar') || nameLower.includes('bar')) {
        categories.steel.amount += m.totalCost;
      } else if (nameLower.includes('tile') || nameLower.includes('grout') || nameLower.includes('adhesive')) {
        categories.tile.amount += m.totalCost;
      } else {
        categories.other.amount += m.totalCost;
      }
    });

    const total = boq.grandTotal > 0 ? boq.grandTotal : 1;
    return Object.entries(categories)
      .filter(([_, item]) => item.amount > 0)
      .map(([key, item]) => ({
        key,
        label: item.label,
        amount: item.amount,
        percentage: ((item.amount / total) * 100).toFixed(1),
        color: item.color,
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [boq]);

  // SVG Donut calculation
  const donutSlices = useMemo(() => {
    let cumulative = 0;
    const total = boq.grandTotal > 0 ? boq.grandTotal : 1;
    return costBreakdownData.map((item) => {
      const fraction = item.amount / total;
      const startAngle = cumulative * 2 * Math.PI;
      cumulative += fraction;
      const endAngle = cumulative * 2 * Math.PI;

      // Arc coordinates (center 50, 50, radius 40)
      const x1 = 50 + 38 * Math.cos(startAngle - Math.PI / 2);
      const y1 = 50 + 38 * Math.sin(startAngle - Math.PI / 2);
      const x2 = 50 + 38 * Math.cos(endAngle - Math.PI / 2);
      const y2 = 50 + 38 * Math.sin(endAngle - Math.PI / 2);
      const largeArcFlag = fraction > 0.5 ? 1 : 0;

      const pathData = fraction >= 0.999
        ? `M 50 12 A 38 38 0 1 1 49.99 12`
        : `M ${x1} ${y1} A 38 38 0 ${largeArcFlag} 1 ${x2} ${y2}`;

      return {
        ...item,
        pathData,
      };
    });
  }, [costBreakdownData, boq.grandTotal]);

  const exportCSV = () => {
    const rows = [
      ['Building Mistry — Bill of Quantities (BOQ)'],
      ['Project Name', projectName],
      ['Date', new Date().toLocaleDateString()],
      [''],
      ['Component / Material', 'Consolidated Qty', 'Unit', 'Base Cost (INR)', 'Transport (INR)', 'GST (INR)', 'Total Cost (INR)'],
      ...boq.consolidatedMaterials.map((m) => [
        `"${m.materialName}"`,
        m.totalQuantity,
        m.unit,
        m.totalBaseCost,
        m.totalTransportCost,
        m.totalTaxCost,
        m.totalCost,
      ]),
      [''],
      ['Material Subtotal', '', '', '', '', '', boq.totalEstimateCost],
      ['Labour Allowance', '', '', '', '', '', boq.totalLabourCost],
      ['FINAL GRAND TOTAL', '', '', '', '', '', boq.grandTotal],
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map((e) => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${projectName.replace(/\s+/g, '_')}_BOQ.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* ── AUTO ESTIMATOR HEADER (MyDesignerPlus Style) ── */}
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <FileSpreadsheet className="text-indigo-600 dark:text-indigo-400" size={22} />
              AUTO ESTIMATOR &amp; BOQ
            </h2>
            <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mt-0.5">
              Manage your civil pricing engine or run a multi-module takeoff
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="inline-flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setActiveTab('takeoff')}
                className={`text-xs px-3.5 py-1.5 rounded-lg font-bold transition ${
                  activeTab === 'takeoff'
                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                Takeoff Schedule
              </button>
              {boq.actualConsumptionComparison && boq.actualConsumptionComparison.length > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveTab('variance')}
                  className={`text-xs px-3.5 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 ${
                    activeTab === 'variance'
                      ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  <TrendingUp size={13} /> Site Variance
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Project Selector Bar & Inclusion Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2 flex-1 min-w-[280px]">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider shrink-0 flex items-center gap-1">
              <Building2 size={13} className="text-indigo-500" /> Select Project
            </span>
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="Project Name / Bill Reference"
              className="w-full text-xs font-semibold py-1.5 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <button
            type="button"
            onClick={() => setShowInclusionFilter(!showInclusionFilter)}
            className="text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-indigo-600 flex items-center gap-1 py-1.5 px-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
          >
            <span>Included Items ({selectedIds.length}/{savedCalculations.length})</span>
            {showInclusionFilter ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>

        {/* Collapsible Included Calculations Selector */}
        {showInclusionFilter && (
          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-700 dark:text-slate-300">
                Select Calculations to Consolidate into Master Bill
              </span>
              <button
                type="button"
                onClick={toggleAll}
                className="text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold hover:underline"
              >
                {selectedIds.length === savedCalculations.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>

            {savedCalculations.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-2">
                No saved calculations yet. Save calculations from Wall, Slab, Beam, Column, Plaster, or Flooring modules to aggregate them here.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto p-1">
                {savedCalculations.map((c) => {
                  const isChecked = selectedIds.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggleSelect(c.id)}
                      className={`text-xs px-2.5 py-1.5 rounded-lg border flex items-center gap-2 transition ${
                        isChecked
                          ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 font-semibold shadow-2xs'
                          : 'border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900'
                      }`}
                    >
                      {isChecked ? <CheckSquare size={13} className="text-indigo-600" /> : <Square size={13} />}
                      <span className="capitalize text-[10px] bg-slate-200 dark:bg-slate-700 px-1 rounded uppercase font-bold text-slate-700 dark:text-slate-300">
                        {c.module}
                      </span>
                      <span>{c.name}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── 3 EXECUTIVE KPI CARDS (Matching Image 4) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Card 1: TOTAL ITEMS (Dark Card) */}
        <div className="p-5 rounded-2xl bg-slate-900 text-white shadow-md border border-slate-800 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-slate-800/40 rounded-full blur-2xl -mr-6 -mt-6 pointer-events-none" />
          <span className="text-3xl sm:text-4xl font-extrabold font-mono tracking-tight text-white">
            {boq.consolidatedMaterials.length}
          </span>
          <div className="mt-3">
            <span className="text-[11px] uppercase tracking-wider text-slate-400 font-bold block">
              TOTAL ITEMS &amp; SPECS
            </span>
            <span className="text-[11px] text-slate-500 block mt-0.5">
              Across {selectedCalcs.length} consolidated sections
            </span>
          </div>
        </div>

        {/* Card 2: MATERIAL SUBTOTAL (Emerald Green Card) */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-700 text-white shadow-md flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full blur-2xl -mr-6 -mt-6 pointer-events-none" />
          <span className="text-3xl sm:text-4xl font-extrabold font-mono tracking-tight text-white">
            {formatINR(boq.totalEstimateCost)}
          </span>
          <div className="mt-3">
            <span className="text-[11px] uppercase tracking-wider text-emerald-100 font-bold block">
              MATERIAL SUBTOTAL
            </span>
            <span className="text-[11px] text-emerald-200/80 block mt-0.5">
              Landed cost including GST &amp; transport
            </span>
          </div>
        </div>

        {/* Card 3: FINAL TOTAL (Indigo / Purple Card) */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-800 text-white shadow-md flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-purple-400/20 rounded-full blur-2xl -mr-6 -mt-6 pointer-events-none" />
          <span className="text-3xl sm:text-4xl font-extrabold font-mono tracking-tight text-white">
            {formatINR(boq.grandTotal)}
          </span>
          <div className="mt-3">
            <span className="text-[11px] uppercase tracking-wider text-indigo-100 font-bold block">
              FINAL TOTAL ESTIMATE
            </span>
            <span className="text-[11px] text-indigo-200/80 block mt-0.5">
              Materials + Site Labour ({formatINR(boq.totalLabourCost)})
            </span>
          </div>
        </div>
      </div>

      {/* ── MAIN WORKSPACE: 2 COLUMNS (Matching Image 4 & 5) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 8 Cols: Materials & Costs Schedule Table */}
        <div className="lg:col-span-8 space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
            {/* Table Header Bar */}
            <div className="p-4 bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                  Materials &amp; Costs Takeoff
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Civil quantity schedule breakdown per IS specification standards
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrint}
                  className="text-xs py-1.5 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold flex items-center gap-1.5 transition shadow-2xs"
                >
                  <Printer size={13} /> PDF / Print
                </button>
                <button
                  type="button"
                  onClick={exportCSV}
                  className="text-xs py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center gap-1.5 transition shadow-2xs"
                >
                  <Download size={13} /> CSV / Excel
                </button>
              </div>
            </div>

            {/* Table Content */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 bg-slate-50/40 dark:bg-slate-900/40">
                    <th className="py-3 px-4 font-bold uppercase tracking-wider text-[10px]">Component</th>
                    <th className="py-3 px-3 font-bold uppercase tracking-wider text-[10px] text-right">Qty</th>
                    <th className="py-3 px-2 font-bold uppercase tracking-wider text-[10px] text-center">Unit</th>
                    <th className="py-3 px-3 font-bold uppercase tracking-wider text-[10px] text-right">Base Rate</th>
                    <th className="py-3 px-3 font-bold uppercase tracking-wider text-[10px] text-right">Landed Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {boq.consolidatedMaterials.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400 italic">
                        No materials selected. Check calculations above to generate the schedule.
                      </td>
                    </tr>
                  ) : (
                    boq.consolidatedMaterials.map((m, idx) => (
                      <tr
                        key={idx}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900 dark:text-slate-100">{m.materialName}</div>
                          <span className="text-[10px] text-slate-400">
                            Base: {formatINR(m.totalBaseCost)} • GST/Trans: {formatINR(m.totalTaxCost + m.totalTransportCost)}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-slate-800 dark:text-slate-200">
                          {m.totalQuantity.toLocaleString()}
                        </td>
                        <td className="py-3 px-2 text-center font-mono text-slate-500 uppercase text-[11px]">
                          {m.unit}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-slate-500">
                          {formatINR(m.totalQuantity > 0 ? m.totalBaseCost / m.totalQuantity : 0)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 dark:text-slate-100 text-sm">
                          {formatINR(m.totalCost)}
                        </td>
                      </tr>
                    ))
                  )}

                  {/* Labour Allowance Row */}
                  {boq.totalLabourCost > 0 && (
                    <tr className="bg-pink-50/40 dark:bg-pink-950/20 border-t border-pink-200 dark:border-pink-900/50">
                      <td className="py-3 px-4">
                        <div className="font-bold text-pink-900 dark:text-pink-200">Site Labour &amp; Masonry Execution</div>
                        <span className="text-[10px] text-pink-700/80 dark:text-pink-300/70">
                          Consolidated labour allowance from structural and finishing sections
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-medium text-pink-700 dark:text-pink-300">
                        1
                      </td>
                      <td className="py-3 px-2 text-center font-mono text-pink-700 dark:text-pink-300 uppercase text-[11px]">
                        LS
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-pink-700 dark:text-pink-300">
                        {formatINR(boq.totalLabourCost)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-pink-900 dark:text-pink-200 text-sm">
                        {formatINR(boq.totalLabourCost)}
                      </td>
                    </tr>
                  )}
                </tbody>

                {/* Subtotals & Final Totals */}
                <tfoot>
                  <tr className="border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 font-bold text-slate-800 dark:text-slate-200">
                    <td colSpan={4} className="py-3 px-4 text-right uppercase tracking-wider text-[11px]">
                      Material Subtotal (Landed)
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-sm text-emerald-600 dark:text-emerald-400">
                      {formatINR(boq.totalEstimateCost)}
                    </td>
                  </tr>
                  <tr className="bg-indigo-50/60 dark:bg-indigo-950/40 font-extrabold text-indigo-950 dark:text-indigo-100 border-t border-indigo-200 dark:border-indigo-900">
                    <td colSpan={4} className="py-3.5 px-4 text-right uppercase tracking-wider text-xs">
                      Final Grand Total Estimate
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-base text-indigo-700 dark:text-indigo-300">
                      {formatINR(boq.grandTotal)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Actual Site Material Variance (if available) */}
          {boq.actualConsumptionComparison && boq.actualConsumptionComparison.length > 0 && activeTab === 'variance' && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2">
                  <TrendingUp size={15} className="text-indigo-600" />
                  Site Material Variance (Estimate vs Actual Consumption)
                </h4>
                <span className="text-[11px] text-slate-500">Live Linked to Inventory</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                      <th className="py-2.5 px-4 font-medium">Material</th>
                      <th className="py-2.5 px-3 font-medium text-right">Estimated Qty</th>
                      <th className="py-2.5 px-3 font-medium text-right">Actual Site Qty</th>
                      <th className="py-2.5 px-3 font-medium text-right">Variance</th>
                      <th className="py-2.5 px-4 font-medium text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {boq.actualConsumptionComparison.map((v, idx) => (
                      <tr key={idx}>
                        <td className="py-2.5 px-4 font-medium text-slate-800 dark:text-slate-200">{v.materialName}</td>
                        <td className="py-2.5 px-3 text-right font-mono">{v.estimatedQty}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-semibold">{v.actualUsedQty}</td>
                        <td className="py-2.5 px-3 text-right font-mono">
                          <span className={v.varianceQty > 0 ? 'text-rose-600 font-semibold' : 'text-emerald-600'}>
                            {v.varianceQty > 0 ? `+${v.varianceQty}` : v.varianceQty} ({v.variancePercent}%)
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-center">
                          {v.status === 'on_track' && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                              <CheckCircle2 size={12} /> On Track
                            </span>
                          )}
                          {v.status === 'exceeded' && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                              <AlertCircle size={12} /> Exceeded Estimate
                            </span>
                          )}
                          {v.status === 'under' && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                              In Progress
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Right 4 Cols: Cost Breakdown Donut Chart (Matching Image 4) */}
        <div className="lg:col-span-4 space-y-4 lg:sticky lg:top-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                <PieChartIcon size={14} className="text-amber-500" /> Cost Breakdown
              </h3>
              <span className="text-[10px] text-slate-400 font-medium">Distribution</span>
            </div>

            {/* Donut Chart with Total in Center */}
            <div className="relative flex items-center justify-center py-2">
              <svg viewBox="0 0 100 100" className="w-44 h-44 -rotate-90">
                {/* Background Ring */}
                <circle
                  cx="50"
                  cy="50"
                  r="38"
                  fill="transparent"
                  stroke="currentColor"
                  strokeWidth="10"
                  className="text-slate-100 dark:text-slate-800"
                />

                {/* Slices */}
                {donutSlices.map((slice, i) => (
                  <path
                    key={i}
                    d={slice.pathData}
                    fill="none"
                    stroke={slice.color}
                    strokeWidth="10"
                    strokeLinecap="round"
                    className="transition-all duration-300"
                  />
                ))}
              </svg>

              {/* Center Total Text */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-4">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  Total
                </span>
                <span className="text-base font-extrabold font-mono text-slate-900 dark:text-slate-100 mt-0.5">
                  {formatINR(boq.grandTotal)}
                </span>
              </div>
            </div>

            {/* Legend List (Matching Image 4) */}
            <div className="space-y-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
              {costBreakdownData.map((item) => (
                <div key={item.key} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-slate-700 dark:text-slate-300 font-medium">{item.label}</span>
                  </div>
                  <div className="flex items-center gap-2 font-mono">
                    <span className="font-bold text-slate-900 dark:text-slate-100">{formatINR(item.amount)}</span>
                    <span className="text-[11px] text-slate-400 w-10 text-right">{item.percentage}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Info Box */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs space-y-1.5 text-slate-500 dark:text-slate-400">
            <span className="font-bold text-slate-700 dark:text-slate-200 block">
              Quantity Surveyor Note:
            </span>
            <p className="text-[11px] leading-relaxed">
              Consolidated estimates incorporate IS 1200 plaster deduction rules, IS 456 concrete dry volume expansion (1.54x), and IS 2386 moisture bulking.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
