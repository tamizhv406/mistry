import React, { useState } from 'react';
import { Lightbulb, X, Compass, ShieldAlert, Sparkles, Check, Building2, CheckSquare, Layers, HelpCircle } from 'lucide-react';
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
  const [selectedUnit, setSelectedUnit] = useState<FloorPlanUnit>(unit);
  const [plotWidth, setPlotWidth] = useState(selectedUnit === 'feet' ? 30 : 9);
  const [plotDepth, setPlotDepth] = useState(selectedUnit === 'feet' ? 40 : 12);
  const [bedrooms, setBedrooms] = useState(4); // Default to prompt's 4 BHK example
  const [bathrooms, setBathrooms] = useState(3);
  const [attachedBathrooms, setAttachedBathrooms] = useState(2); // 2 attached as in prompt
  const [hasLivingRoom, setHasLivingRoom] = useState(true);
  const [hasDining, setHasDining] = useState(true);
  const [hasKitchen, setHasKitchen] = useState(true);
  const [hasStaircase, setHasStaircase] = useState(false);
  const [hasBalcony, setHasBalcony] = useState(true);
  const [facing, setFacing] = useState<'North' | 'East' | 'South' | 'West'>('North');
  const [hasParking, setHasParking] = useState(false);
  const [hasPooja, setHasPooja] = useState(true);
  const [proposal, setProposal] = useState<ProposedLayoutResult | null>(null);

  if (!isOpen) return null;

  // 1-Click Load Prompt Default Example (40 x 30 ft, 4 BHK, 2 Attached Baths)
  const handleLoadDefaultExample = () => {
    setSelectedUnit('feet');
    setPlotWidth(30);
    setPlotDepth(40);
    setBedrooms(4);
    setBathrooms(3);
    setAttachedBathrooms(2);
    setHasLivingRoom(true);
    setHasDining(true);
    setHasKitchen(true);
    setHasStaircase(false);
    setHasBalcony(true);
    setHasPooja(true);
    setHasParking(false);
    setFacing('North');
  };

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    const req: ProposedLayoutRequest = {
      plotWidth: Number(plotWidth),
      plotDepth: Number(plotDepth),
      unit: selectedUnit,
      bedrooms,
      bathrooms,
      attachedBathrooms,
      hasLivingRoom,
      hasDining,
      hasKitchen,
      hasStaircase,
      hasBalcony,
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
    <div className="fp-ai-dialog fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-800/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Lightbulb className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                Intelligent Architectural Floor Plan Generator
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Rule-based parametric space planning following standard architectural zoning principles.
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
              {/* Quick Preset Example Button */}
              <div className="p-3 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 flex items-center justify-between gap-3">
                <div className="text-xs text-emerald-800 dark:text-emerald-300">
                  <span className="font-semibold block">Quick Standard Example:</span>
                  <span>40 × 30 ft • 4 Bedrooms • 2 Attached Bathrooms • Living & Kitchen</span>
                </div>
                <button
                  type="button"
                  onClick={handleLoadDefaultExample}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold whitespace-nowrap shadow-sm transition-colors"
                >
                  Load 40×30 Example
                </button>
              </div>

              {/* Plot Dimensions & Unit */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Plot Width ({selectedUnit === 'feet' ? 'ft' : 'm'})
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
                    Plot Depth / Length ({selectedUnit === 'feet' ? 'ft' : 'm'})
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
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Measurement Unit
                  </label>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedUnit !== 'feet') {
                          setSelectedUnit('feet');
                          setPlotWidth(30);
                          setPlotDepth(40);
                        }
                      }}
                      className={`flex-1 py-2 text-xs font-semibold rounded-lg border transition-colors ${
                        selectedUnit === 'feet'
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      Feet (ft)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedUnit !== 'meters') {
                          setSelectedUnit('meters');
                          setPlotWidth(9);
                          setPlotDepth(12);
                        }
                      }}
                      className={`flex-1 py-2 text-xs font-semibold rounded-lg border transition-colors ${
                        selectedUnit === 'meters'
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      Meters (m)
                    </button>
                  </div>
                </div>
              </div>

              {/* Bedrooms & Bathrooms */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Bedrooms (BHK)
                  </label>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map(b => (
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
                        {b}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Total Bathrooms
                  </label>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4].map(bath => (
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

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Attached Bathrooms
                  </label>
                  <div className="flex gap-1">
                    {[0, 1, 2, 3].map(att => (
                      <button
                        type="button"
                        key={att}
                        onClick={() => setAttachedBathrooms(att)}
                        className={`flex-1 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                          attachedBathrooms === att
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        {att}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Room Inclusions & Requirements */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Room Requirements & Inclusions
                </label>
                <div className="grid grid-cols-3 gap-2.5 text-xs text-slate-700 dark:text-slate-300">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hasLivingRoom}
                      onChange={e => setHasLivingRoom(e.target.checked)}
                      className="rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>Living Room</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hasKitchen}
                      onChange={e => setHasKitchen(e.target.checked)}
                      className="rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>Modular Kitchen</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hasDining}
                      onChange={e => setHasDining(e.target.checked)}
                      className="rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>Dining Area (Adj. to Kitchen)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hasStaircase}
                      onChange={e => setHasStaircase(e.target.checked)}
                      className="rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>Duplex Staircase</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hasBalcony}
                      onChange={e => setHasBalcony(e.target.checked)}
                      className="rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>Front Sit-out Balcony</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hasPooja}
                      onChange={e => setHasPooja(e.target.checked)}
                      className="rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>Pooja Space (Ishanya)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hasParking}
                      onChange={e => setHasParking(e.target.checked)}
                      className="rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>Car Parking Porch</span>
                  </label>
                </div>
              </div>

              {/* Facing Orientation */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Main Facing Direction (Vastu / Sunlight Orientation)
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
                      <Compass className="w-3.5 h-3.5" />
                      {dir}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-md transition-colors flex items-center justify-center gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  Generate AI Architectural Layout
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-4 animate-in fade-in duration-200">
              {/* Proposal Header Card */}
              <div className="p-4 rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/30">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-emerald-600" />
                  {proposal.title}
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                  {proposal.summary}
                </p>

                <div className="mt-3 pt-3 border-t border-emerald-200 dark:border-emerald-800/60 grid grid-cols-4 gap-2 text-center text-xs">
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
                  <div>
                    <span className="text-[10px] text-slate-500 block uppercase">Carpet Area</span>
                    <span className="font-bold text-emerald-700 dark:text-emerald-400">
                      {proposal.carpetArea || proposal.rooms.reduce((s, r) => s + (r.area || 0), 0).toFixed(0)} sq.{selectedUnit === 'feet' ? 'ft' : 'm'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Room Schedule in Proposal */}
              <div className="space-y-1.5">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider block">
                  Proposed Zones & Dimension Schedule
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {proposal.rooms.map(r => (
                    <div
                      key={r.id}
                      className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 text-xs flex justify-between items-center"
                    >
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{r.label || r.roomType}</span>
                      <span className="text-[11px] text-slate-500 font-mono">
                        {r.width.toFixed(1)} × {r.height.toFixed(1)} {selectedUnit === 'feet' ? 'ft' : 'm'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Structural & Regulatory Suggestions */}
              {proposal.structuralSuggestions && proposal.structuralSuggestions.length > 0 && (
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs space-y-1.5">
                  <span className="font-semibold text-slate-700 dark:text-slate-300 block text-[11px] uppercase tracking-wider">
                    Structural Layout & Setback Guidelines
                  </span>
                  <ul className="list-disc list-inside space-y-1 text-slate-600 dark:text-slate-400 text-[11px]">
                    {proposal.structuralSuggestions.map((s, idx) => (
                      <li key={idx}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}

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
                  Apply Proposed Layout to Canvas
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
