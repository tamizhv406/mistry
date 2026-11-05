import React, { useState, useEffect } from 'react';
import {
  BrickWall,
  Layers,
  GitCommit,
  PaintRoller,
  Grid3X3,
  Home,
  Mountain,
  Tag,
  FileSpreadsheet,
  Bookmark,
  Building2,
  Calculator,
} from 'lucide-react';
import type { User, Site } from '../../db/types';
import type { CalculatorModule, MaterialRateItem, SavedBuildingCalculation } from '../../domain/buildingCalculator/types';
import { DEFAULT_MATERIAL_RATES } from '../../domain/buildingCalculator/materialRates';
import { WallCalculatorPanel } from './WallCalculatorPanel';
import { SlabCalculatorPanel } from './SlabCalculatorPanel';
import { BeamColumnCalculatorPanel } from './BeamColumnCalculatorPanel';
import { PlasterCalculatorPanel } from './PlasterCalculatorPanel';
import { FlooringCalculatorPanel } from './FlooringCalculatorPanel';
import { SandCalculatorPanel } from './SandCalculatorPanel';
import { MaterialRatesPanel } from './MaterialRatesPanel';
import { BoqProjectEstimatePanel } from './BoqProjectEstimatePanel';
import { SavedCalculationsPanel } from './SavedCalculationsPanel';
import { db } from '../../db/db';

export type ExtendedCalculatorModule =
  | 'wall'
  | 'rcc'
  | 'beam_column'
  | 'plaster'
  | 'flooring'
  | 'roofing'
  | 'sand'
  | 'rates'
  | 'boq'
  | 'saved';

interface AdvancedCalculatorDashboardProps {
  user: User;
  onNotify: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onSelectSite?: (siteId: string) => void;
}

const RATES_STORAGE_KEY = 'mistry_building_calc_rates_v1';
const CALCS_STORAGE_KEY = 'mistry_building_calc_saved_v1';

export const AdvancedCalculatorDashboard: React.FC<AdvancedCalculatorDashboardProps> = ({
  user,
  onNotify,
  onSelectSite,
}) => {
  const [activeModule, setActiveModule] = useState<ExtendedCalculatorModule>('wall');
  const [sites, setSites] = useState<Site[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<string>('');

  // Material rates state
  const [rates, setRates] = useState<MaterialRateItem[]>(() => {
    try {
      const stored = localStorage.getItem(RATES_STORAGE_KEY);
      if (stored) return JSON.parse(stored);
    } catch {
      // ignore
    }
    return DEFAULT_MATERIAL_RATES;
  });

  // Saved calculations state
  const [savedCalculations, setSavedCalculations] = useState<SavedBuildingCalculation[]>(() => {
    try {
      const stored = localStorage.getItem(CALCS_STORAGE_KEY);
      if (stored) return JSON.parse(stored);
    } catch {
      // ignore
    }
    return [];
  });

  // Load sites from db
  useEffect(() => {
    db.sites.toArray().then((allSites) => {
      setSites(allSites.filter((s) => !s.isDeleted));
      if (!selectedSiteId && allSites.length > 0) {
        setSelectedSiteId(allSites[0].id);
      }
    });
  }, []);

  // Sync rates to localStorage
  const handleUpdateRates = (updatedRates: MaterialRateItem[]) => {
    setRates(updatedRates);
    try {
      localStorage.setItem(RATES_STORAGE_KEY, JSON.stringify(updatedRates));
      onNotify('Material rates updated successfully', 'success');
    } catch {
      // ignore
    }
  };

  // Save a calculation
  const handleSaveCalculation = (calc: SavedBuildingCalculation) => {
    const siteObj = sites.find((s) => s.id === selectedSiteId);
    const enrichedCalc: SavedBuildingCalculation = {
      ...calc,
      siteId: selectedSiteId || undefined,
      siteName: siteObj ? siteObj.name : undefined,
    };

    const updated = [enrichedCalc, ...savedCalculations];
    setSavedCalculations(updated);
    try {
      localStorage.setItem(CALCS_STORAGE_KEY, JSON.stringify(updated));
      onNotify(`Saved '${calc.name}' successfully`, 'success');
    } catch {
      // ignore
    }
  };

  // Delete a calculation
  const handleDeleteCalculation = (id: string) => {
    const updated = savedCalculations.filter((c) => c.id !== id);
    setSavedCalculations(updated);
    try {
      localStorage.setItem(CALCS_STORAGE_KEY, JSON.stringify(updated));
      onNotify('Calculation deleted', 'info');
    } catch {
      // ignore
    }
  };

  // Duplicate a calculation
  const handleDuplicateCalculation = (calc: SavedBuildingCalculation) => {
    const duplicated: SavedBuildingCalculation = {
      ...calc,
      id: `calc_${calc.module}_${Date.now()}`,
      name: `${calc.name} (Copy)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    handleSaveCalculation(duplicated);
  };

  const selectedSite = sites.find((s) => s.id === selectedSiteId);

  const modulesList: {
    id: ExtendedCalculatorModule;
    label: string;
    sublabel: string;
    icon: React.ReactNode;
    category: 'Structural' | 'Finishing' | 'Procurement';
    badge?: string;
  }[] = [
    { id: 'wall', label: 'Wall & Masonry', sublabel: 'Brick & AAC', icon: <BrickWall size={16} />, category: 'Structural' },
    { id: 'rcc', label: 'RCC', sublabel: 'Mix M20 / M25', icon: <Layers size={16} />, category: 'Structural' },
    { id: 'beam_column', label: 'Beams & Columns', sublabel: 'Concrete & BBS', icon: <GitCommit size={16} />, category: 'Structural' },
    { id: 'plaster', label: 'Plastering', sublabel: 'IS 1200 Rules', icon: <PaintRoller size={16} />, category: 'Finishing' },
    { id: 'flooring', label: 'Flooring', sublabel: 'Tiles & Screed', icon: <Grid3X3 size={16} />, category: 'Finishing' },
    { id: 'roofing', label: 'Roofing', sublabel: 'Slab & Parapet', icon: <Home size={16} />, category: 'Finishing' },
    { id: 'sand', label: 'Sand & Aggregates', sublabel: 'CFT & Bulking', icon: <Mountain size={16} />, category: 'Finishing' },
    { id: 'rates', label: 'Rates & Database', sublabel: 'Price Master', icon: <Tag size={16} />, category: 'Procurement' },
    { id: 'boq', label: 'Project BOQ', sublabel: 'Consolidated Bill', icon: <FileSpreadsheet size={16} />, category: 'Procurement', badge: 'Bill' },
    { id: 'saved', label: 'Consolidated Results', sublabel: 'Audit Trail', icon: <Bookmark size={16} />, category: 'Procurement', badge: String(savedCalculations.length) },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-2 sm:px-4 pb-16">
      {/* ── Top Header / Project Switcher Bar ── */}
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white flex items-center justify-center shadow-xs">
            <Calculator size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
                Building Estimation Workspace
              </h1>
              <span className="text-[10px] uppercase font-bold tracking-wider py-0.5 px-2.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                IS 456 &amp; IS 1200 Standards
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Civil quantity takeoff engine for structural masonry, concrete, finishing, and procurement.
            </p>
          </div>
        </div>

        {/* Project Selector & Status Pill */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {sites.length > 0 && (
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs">
              <Building2 size={15} className="text-indigo-600 dark:text-indigo-400" />
              <div className="flex flex-col">
                <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Linked Site</span>
                <select
                  value={selectedSiteId}
                  onChange={(e) => {
                    setSelectedSiteId(e.target.value);
                    if (onSelectSite) onSelectSite(e.target.value);
                  }}
                  className="text-xs font-bold bg-transparent text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer pr-2"
                >
                  <option value="">No Project Linked</option>
                  {sites.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.address || s.area || 'Site'})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Quick Stats Pill */}
          <div className="hidden md:flex items-center gap-3 bg-slate-50 dark:bg-slate-800/60 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
            <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
              <Bookmark size={13} className="text-indigo-500" />
              <span className="font-semibold">{savedCalculations.length}</span>
              <span className="text-[11px] text-slate-400">saved</span>
            </div>
            <div className="w-px h-3.5 bg-slate-200 dark:bg-slate-700" />
            <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
              <Tag size={13} className="text-emerald-500" />
              <span className="font-semibold">{rates.length}</span>
              <span className="text-[11px] text-slate-400">rates</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── CAD Ribbon Navigation Bar (Bond360 Style) ── */}
      <div className="bg-slate-50/80 dark:bg-slate-900/60 p-2 rounded-2xl border border-slate-200/80 dark:border-slate-800">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {modulesList.map((m) => {
            const isActive = activeModule === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setActiveModule(m.id)}
                className={`shrink-0 px-3.5 py-2.5 rounded-xl text-left transition-all relative flex items-center gap-2.5 ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-md ring-1 ring-indigo-600'
                    : 'bg-white dark:bg-slate-800/90 text-slate-700 dark:text-slate-300 border border-slate-200/90 dark:border-slate-700/80 hover:bg-slate-50 dark:hover:bg-slate-700/60 hover:border-slate-300'
                }`}
              >
                <div
                  className={`p-1.5 rounded-lg shrink-0 ${
                    isActive
                      ? 'bg-indigo-700/60 text-white'
                      : 'bg-slate-100 dark:bg-slate-700/60 text-indigo-600 dark:text-indigo-400'
                  }`}
                >
                  {m.icon}
                </div>
                <div className="flex flex-col min-w-0 pr-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold leading-tight whitespace-nowrap">{m.label}</span>
                    {m.badge && (
                      <span
                        className={`text-[9px] px-1.5 py-0.2 rounded-full font-mono font-bold leading-none ${
                          isActive
                            ? 'bg-indigo-500 text-white'
                            : 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800'
                        }`}
                      >
                        {m.badge}
                      </span>
                    )}
                  </div>
                  <span
                    className={`text-[10px] leading-tight font-medium ${
                      isActive ? 'text-indigo-100' : 'text-slate-400 dark:text-slate-500'
                    }`}
                  >
                    {m.sublabel}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Active Module Workspace ── */}
      <div>
        {activeModule === 'wall' && (
          <WallCalculatorPanel
            rates={rates}
            onSaveCalculation={handleSaveCalculation}
            siteId={selectedSiteId}
            siteName={selectedSite?.name}
          />
        )}

        {activeModule === 'rcc' && (
          <SlabCalculatorPanel
            rates={rates}
            onSaveCalculation={handleSaveCalculation}
            siteId={selectedSiteId}
            siteName={selectedSite?.name}
            defaultName="Ground Floor RCC Slab"
          />
        )}

        {activeModule === 'beam_column' && (
          <BeamColumnCalculatorPanel
            rates={rates}
            onSaveCalculation={handleSaveCalculation}
            siteId={selectedSiteId}
            siteName={selectedSite?.name}
            defaultSubTab="beam"
          />
        )}

        {activeModule === 'plaster' && (
          <PlasterCalculatorPanel
            rates={rates}
            onSaveCalculation={handleSaveCalculation}
            siteId={selectedSiteId}
            siteName={selectedSite?.name}
          />
        )}

        {activeModule === 'flooring' && (
          <FlooringCalculatorPanel
            rates={rates}
            onSaveCalculation={handleSaveCalculation}
            siteId={selectedSiteId}
            siteName={selectedSite?.name}
          />
        )}

        {activeModule === 'roofing' && (
          <SlabCalculatorPanel
            rates={rates}
            onSaveCalculation={handleSaveCalculation}
            siteId={selectedSiteId}
            siteName={selectedSite?.name}
            defaultName="Terrace Roof Slab & Parapet"
          />
        )}

        {activeModule === 'sand' && (
          <SandCalculatorPanel
            rates={rates}
            onSaveCalculation={handleSaveCalculation}
            siteId={selectedSiteId}
            siteName={selectedSite?.name}
          />
        )}

        {activeModule === 'rates' && (
          <MaterialRatesPanel rates={rates} onUpdateRates={handleUpdateRates} />
        )}

        {activeModule === 'boq' && (
          <BoqProjectEstimatePanel
            savedCalculations={savedCalculations}
            siteId={selectedSiteId}
            siteName={selectedSite?.name}
          />
        )}

        {activeModule === 'saved' && (
          <SavedCalculationsPanel
            savedCalculations={savedCalculations}
            onDeleteCalculation={handleDeleteCalculation}
            onDuplicateCalculation={handleDuplicateCalculation}
          />
        )}
      </div>
    </div>
  );
};
