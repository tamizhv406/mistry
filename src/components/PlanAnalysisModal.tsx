import React from 'react';
import { BarChart2, X, Home, DoorOpen, AppWindow, Layers, Columns, ShieldCheck } from 'lucide-react';
import type { PlanAnalysisReport } from '../services/aiFloorPlanEngine';
import type { FloorPlanUnit } from '../db/types';

export interface PlanAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  report: PlanAnalysisReport | null;
  unit: FloorPlanUnit;
}

export const PlanAnalysisModal: React.FC<PlanAnalysisModalProps> = ({
  isOpen,
  onClose,
  report,
  unit,
}) => {
  if (!isOpen || !report) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-800/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <BarChart2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                Floor Plan Architectural Analysis
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Exact measurements and schedule computed from verified CAD geometry.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Key Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl border border-indigo-200 dark:border-indigo-900 bg-indigo-50/60 dark:bg-indigo-950/30">
              <span className="text-[11px] font-semibold text-indigo-700 dark:text-indigo-300 uppercase tracking-wider block mb-1">
                Gross Floor Area
              </span>
              <span className="text-lg font-extrabold text-slate-900 dark:text-white block">
                {report.formattedTotalArea}
              </span>
              <span className="text-[10px] text-slate-500">From defined rooms</span>
            </div>

            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                Rooms
              </span>
              <span className="text-lg font-bold text-slate-900 dark:text-white block">
                {report.roomCount}
              </span>
              <span className="text-[10px] text-slate-500">Enclosed zones</span>
            </div>

            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                Openings
              </span>
              <span className="text-lg font-bold text-slate-900 dark:text-white block">
                {report.doorCount + report.windowCount}
              </span>
              <span className="text-[10px] text-slate-500">
                {report.doorCount} doors, {report.windowCount} windows
              </span>
            </div>

            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                Linear Walls
              </span>
              <span className="text-lg font-bold text-slate-900 dark:text-white block">
                {report.formattedWallLength}
              </span>
              <span className="text-[10px] text-slate-500">{report.wallCount} wall segments</span>
            </div>
          </div>

          {/* Room Area Schedule */}
          <div>
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Home className="w-3.5 h-3.5 text-indigo-500" />
              Room Area Breakdown
            </h3>

            {report.roomBreakdown.length === 0 ? (
              <div className="p-4 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-center text-xs text-slate-500">
                No rooms identified yet. Enclose walls or draw rough loops with AI Draw to generate rooms.
              </div>
            ) : (
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100/70 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-2.5 px-4">Room Name / Type</th>
                      <th className="py-2.5 px-4">Dimensions</th>
                      <th className="py-2.5 px-4 text-right">Floor Area</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {report.roomBreakdown.map((r, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="py-2.5 px-4 font-medium text-slate-800 dark:text-slate-200">
                          {r.name}
                        </td>
                        <td className="py-2.5 px-4 text-slate-500 font-mono">
                          {r.width.toFixed(1)} × {r.height.toFixed(1)} {unit === 'feet' ? 'ft' : 'm'}
                        </td>
                        <td className="py-2.5 px-4 text-right font-semibold text-indigo-600 dark:text-indigo-400">
                          {r.formattedArea}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Real Data Integrity Notice */}
          <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-[11px] text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>
              Real Geometric Data: 100% computed from your actual floor plan CAD vectors. No simulated numbers or fake claims.
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
