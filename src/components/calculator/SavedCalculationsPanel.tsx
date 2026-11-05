import React, { useState, useMemo } from 'react';
import {
  Bookmark,
  Trash2,
  Copy,
  Eye,
  Download,
  Calendar,
  Building2,
  Search,
  BrickWall,
  Layers,
  GitCommit,
  Columns,
  PaintRoller,
  Grid3X3,
  Mountain,
  Home,
  Check,
  X,
} from 'lucide-react';
import type { SavedBuildingCalculation, CalculatorModule } from '../../domain/buildingCalculator/types';

interface SavedCalculationsPanelProps {
  savedCalculations: SavedBuildingCalculation[];
  onDeleteCalculation: (id: string) => void;
  onDuplicateCalculation: (calc: SavedBuildingCalculation) => void;
  onSelectCalculation?: (calc: SavedBuildingCalculation) => void;
}

export const SavedCalculationsPanel: React.FC<SavedCalculationsPanelProps> = ({
  savedCalculations,
  onDeleteCalculation,
  onDuplicateCalculation,
  onSelectCalculation,
}) => {
  const [filterModule, setFilterModule] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeItem, setActiveItem] = useState<SavedBuildingCalculation | null>(null);

  const formatINR = (val: number) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(val);

  const getModuleMeta = (mod: CalculatorModule) => {
    switch (mod) {
      case 'wall':
        return {
          icon: <BrickWall size={14} className="text-amber-600" />,
          label: 'Wall & Masonry',
          bg: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900',
        };
      case 'slab':
        return {
          icon: <Layers size={14} className="text-indigo-600" />,
          label: 'RCC Slab',
          bg: 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-900',
        };
      case 'beam':
        return {
          icon: <GitCommit size={14} className="text-blue-600" />,
          label: 'Beam',
          bg: 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-900',
        };
      case 'column':
        return {
          icon: <Columns size={14} className="text-purple-600" />,
          label: 'Column',
          bg: 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-900',
        };
      case 'plaster':
        return {
          icon: <PaintRoller size={14} className="text-emerald-600" />,
          label: 'Plastering',
          bg: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
        };
      case 'flooring':
        return {
          icon: <Grid3X3 size={14} className="text-teal-600" />,
          label: 'Flooring',
          bg: 'bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800',
        };
      case 'sand':
        return {
          icon: <Mountain size={14} className="text-orange-600" />,
          label: 'Sand Logistics',
          bg: 'bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-900',
        };
      default:
        return {
          icon: <Bookmark size={14} className="text-slate-600" />,
          label: mod,
          bg: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700',
        };
    }
  };

  const filtered = useMemo(() => {
    return savedCalculations.filter((c) => {
      const matchesModule = filterModule === 'all' || c.module === filterModule;
      const matchesSearch =
        !searchQuery ||
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.siteName && c.siteName.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesModule && matchesSearch;
    });
  }, [savedCalculations, filterModule, searchQuery]);

  const exportAllJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(savedCalculations, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute('href', dataStr);
    dlAnchor.setAttribute('download', `BuildingMistry_Calculations_${new Date().toISOString().slice(0, 10)}.json`);
    dlAnchor.click();
  };

  const moduleTabs = [
    { id: 'all', label: 'All Items', count: savedCalculations.length },
    { id: 'wall', label: 'Wall', count: savedCalculations.filter((c) => c.module === 'wall').length },
    { id: 'slab', label: 'RCC Slab', count: savedCalculations.filter((c) => c.module === 'slab').length },
    { id: 'beam', label: 'Beams', count: savedCalculations.filter((c) => c.module === 'beam').length },
    { id: 'column', label: 'Columns', count: savedCalculations.filter((c) => c.module === 'column').length },
    { id: 'plaster', label: 'Plaster', count: savedCalculations.filter((c) => c.module === 'plaster').length },
    { id: 'flooring', label: 'Flooring', count: savedCalculations.filter((c) => c.module === 'flooring').length },
    { id: 'sand', label: 'Sand', count: savedCalculations.filter((c) => c.module === 'sand').length },
  ];

  return (
    <div className="space-y-4">
      {/* ── Top Header / Action Bar ── */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Bookmark size={18} className="text-indigo-600" />
            Consolidated Calculation Records ({savedCalculations.length})
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Audit trail of structural concrete, masonry, finishing, and procurement takeoffs.
          </p>
        </div>

        {savedCalculations.length > 0 && (
          <button
            type="button"
            onClick={exportAllJSON}
            className="text-xs py-1.5 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold flex items-center gap-1.5 transition shadow-2xs"
          >
            <Download size={13} /> Export Backup (JSON)
          </button>
        )}
      </div>

      {/* ── Filter Tabs & Search Bar ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
        <div className="flex flex-wrap items-center gap-1.5">
          {moduleTabs.map((mod) => (
            <button
              key={mod.id}
              type="button"
              onClick={() => setFilterModule(mod.id)}
              className={`text-xs px-3 py-1 rounded-lg font-medium transition flex items-center gap-1.5 ${
                filterModule === mod.id
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              <span>{mod.label}</span>
              {mod.count > 0 && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    filterModule === mod.id ? 'bg-indigo-700 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
                  }`}
                >
                  {mod.count}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="relative min-w-[200px] flex-1 sm:flex-initial">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search records..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* ── Saved Cards Grid (Matching Image 2 / Card UX) ── */}
      {filtered.length === 0 ? (
        <div className="p-10 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
          <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
            <Bookmark size={22} />
          </div>
          <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">No calculation records found</h4>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Calculations saved in any module (Wall, Slab, Beam, Column, Plaster, Flooring, Sand) will appear here for audit, project consolidation, and BOQ export.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((c) => {
            const meta = getModuleMeta(c.module);
            return (
              <div
                key={c.id}
                className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-3"
              >
                <div>
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full border ${meta.bg}`}>
                      {meta.icon} {meta.label}
                    </span>
                    <span className="text-slate-400 text-[11px] flex items-center gap-1 font-mono">
                      <Calendar size={11} /> {c.date}
                    </span>
                  </div>

                  <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 line-clamp-1">
                    {c.name}
                  </h4>
                  {c.siteName && (
                    <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold flex items-center gap-1 mt-0.5">
                      <Building2 size={11} /> {c.siteName}
                    </span>
                  )}
                </div>

                {/* Key Metrics */}
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800/80 space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-600 dark:text-slate-400">
                    <span>Net Volume:</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                      {c.result.netVolumeCFT} CFT
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600 dark:text-slate-400">
                    <span>Landed Estimate:</span>
                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {formatINR(c.result.costs?.overallTotalCost || 0)}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                  <button
                    type="button"
                    onClick={() => setActiveItem(c)}
                    className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 font-bold flex items-center gap-1"
                  >
                    <Eye size={13} /> View Takeoff
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onDuplicateCalculation(c)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                      title="Duplicate"
                    >
                      <Copy size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(`Delete calculation '${c.name}'?`)) {
                          onDeleteCalculation(c.id);
                        }
                      }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                      title="Delete"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Details Modal ── */}
      {activeItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-xl border border-slate-200 dark:border-slate-800 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <span className="text-[10px] uppercase font-bold text-indigo-600 tracking-wider block">
                  {activeItem.module.toUpperCase()} TAKEOFF SPECIFICATION
                </span>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                  {activeItem.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveItem(null)}
                className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-500"
              >
                <X size={15} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl space-y-2 border border-slate-100 dark:border-slate-800">
                <div className="flex justify-between">
                  <span className="text-slate-500">Gross Volume:</span>
                  <span className="font-mono font-medium">{activeItem.result.grossVolumeCFT} CFT ({activeItem.result.grossVolumeM3} m³)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Net Volume:</span>
                  <span className="font-mono font-medium">{activeItem.result.netVolumeCFT} CFT ({activeItem.result.netVolumeBrass} Brass)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Wastage Applied:</span>
                  <span className="font-mono font-medium">{activeItem.result.wastagePercent}%</span>
                </div>
                <div className="flex justify-between border-t border-slate-200 dark:border-slate-700 pt-2 font-bold text-sm">
                  <span>Total Landed Cost:</span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400">
                    {formatINR(activeItem.result.costs?.overallTotalCost || 0)}
                  </span>
                </div>
              </div>

              {activeItem.result.assumptions && activeItem.result.assumptions.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <span className="font-bold text-slate-800 dark:text-slate-200 block text-xs">
                    Engineering Assumptions &amp; Standards:
                  </span>
                  <ul className="list-disc list-inside text-slate-500 space-y-1 text-[11px] leading-relaxed">
                    {activeItem.result.assumptions.map((a, i) => (
                      <li key={i}>{a}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
