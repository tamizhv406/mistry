import React, { useState } from 'react';
import { Lightbulb, X, Compass, ShieldAlert, Sparkles, Check, ArrowRight } from 'lucide-react';
import { generateProposedLayout, type ProposedLayoutResult, type ProposedLayoutRequest } from '../services/aiFloorPlanEngine';
import type { FloorPlanUnit } from '../db/types';

export interface HelpMeDesignModalProps {
  isOpen: boolean;
  onClose: () => void;
  unit: FloorPlanUnit;
  onApplyLayout: (proposal: ProposedLayoutResult) => void;
}

export const HelpMeDesignModal: React.FC<HelpMeDesignModalProps> = ({
  isOpen,
  onClose,
  unit,
  onApplyLayout,
}) => {
  const [plotWidth, setPlotWidth] = useState(unit === 'feet' ? 30 : 9);
  const [plotDepth, setPlotDepth] = useState(unit === 'feet' ? 40 : 12);
  const [bedrooms, setBedrooms] = useState(2);
  const [bathrooms, setBathrooms] = useState(2);
  const [facing, setFacing] = useState<'North' | 'East' | 'South' | 'West'>('North');
  const [hasParking, setHasParking] = useState(true);
  const [hasPooja, setHasPooja] = useState(true);
  const [proposal, setProposal] = useState<ProposedLayoutResult | null>(null);

  if (!isOpen) return null;

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    const req: ProposedLayoutRequest = {
      plotWidth: Number(plotWidth),
      plotDepth: Number(plotDepth),
      unit,
      bedrooms,
      bathrooms,
      facing,
      hasParking,
      hasPooja,
    };
    const res = generateProposedLayout(req);
    setProposal(res);
  };

  const handleApply = () => {
    if (proposal) {
      onApplyLayout(proposal);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-800/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Lightbulb className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                Help Me Design
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Specify your plot and needs — AI proposes a structured floor plan.
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
        <div className="flex-1 overflow-y-auto p-6">
          {!proposal ? (
            <form onSubmit={handleGenerate} className="space-y-4">
              {/* Plot Dimensions */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Plot Width ({unit === 'feet' ? 'ft' : 'm'})
                  </label>
                  <input
                    type="number"
                    min={10}
                    max={200}
                    value={plotWidth}
                    onChange={e => setPlotWidth(Number(e.target.value))}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-1 focus:ring-emerald-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Plot Depth ({unit === 'feet' ? 'ft' : 'm'})
                  </label>
                  <input
                    type="number"
                    min={10}
                    max={300}
                    value={plotDepth}
                    onChange={e => setPlotDepth(Number(e.target.value))}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-1 focus:ring-emerald-500"
                    required
                  />
                </div>
              </div>

              {/* Bedrooms & Bathrooms */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Bedrooms (BHK)
                  </label>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4].map(b => (
                      <button
                        type="button"
                        key={b}
                        onClick={() => setBedrooms(b)}
                        className={`flex-1 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                          bedrooms === b
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        {b} BHK
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Bathrooms
                  </label>
                  <div className="flex gap-1">
                    {[1, 2, 3].map(bath => (
                      <button
                        type="button"
                        key={bath}
                        onClick={() => setBathrooms(bath)}
                        className={`flex-1 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                          bathrooms === bath
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        {bath}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Facing Orientation */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Main Facing Direction (Vastu / Sunlight)
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {(['North', 'East', 'South', 'West'] as const).map(dir => (
                    <button
                      type="button"
                      key={dir}
                      onClick={() => setFacing(dir)}
                      className={`py-2 text-xs font-medium rounded-lg border flex items-center justify-center gap-1 transition-colors ${
                        facing === dir
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <Compass className="w-3 h-3" />
                      {dir}
                    </button>
                  ))}
                </div>
              </div>

              {/* Extras: Parking, Pooja */}
              <div className="flex items-center gap-4 pt-2">
                <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasParking}
                    onChange={e => setHasParking(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>Include Car Parking Porch</span>
                </label>

                <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasPooja}
                    onChange={e => setHasPooja(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>Include Pooja Space</span>
                </label>
              </div>

              <div className="pt-3">
                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-md transition-colors flex items-center justify-center gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  Generate AI Architectural Proposal
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="p-4 rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/30">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-emerald-600" />
                  {proposal.title}
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                  {proposal.summary}
                </p>

                <div className="mt-3 pt-3 border-t border-emerald-200 dark:border-emerald-800/60 grid grid-cols-3 gap-2 text-center text-xs">
                  <div>
                    <span className="text-[10px] text-slate-500 block uppercase">Rooms</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">{proposal.rooms.length}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block uppercase">Walls</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">{proposal.walls.length}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block uppercase">Openings</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {proposal.doors.length + proposal.windows.length}
                    </span>
                  </div>
                </div>
              </div>

              {/* Room Schedule in Proposal */}
              <div className="space-y-1.5">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider block">
                  Proposed Zones
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {proposal.rooms.map(r => (
                    <div
                      key={r.id}
                      className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 text-xs"
                    >
                      <span className="font-semibold text-slate-800 dark:text-slate-200 block">{r.label || r.roomType}</span>
                      <span className="text-[11px] text-slate-500 font-mono">
                        {r.width.toFixed(1)} × {r.height.toFixed(1)} {unit === 'feet' ? 'ft' : 'm'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Mandatory Professional Disclaimer */}
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-[11px] text-amber-800 dark:text-amber-300 flex items-start gap-2 leading-tight">
                <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>{proposal.disclaimer}</span>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setProposal(null)}
                  className="flex-1 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                >
                  Adjust Requirements
                </button>
                <button
                  type="button"
                  onClick={handleApply}
                  className="flex-1 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-sm flex items-center justify-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  Apply Proposed Layout
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
