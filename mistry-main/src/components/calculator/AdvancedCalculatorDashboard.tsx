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
import { MultiTierEstimatorPanel } from './MultiTierEstimatorPanel';
import { db } from '../../db/db';

export type ExtendedCalculatorModule =
  | 'turnkey'
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
  initialBuildingSqFt?: number | null;
}

const RATES_STORAGE_KEY = 'mistry_building_calc_rates_v1';
const CALCS_STORAGE_KEY = 'mistry_building_calc_saved_v1';

export const AdvancedCalculatorDashboard: React.FC<AdvancedCalculatorDashboardProps> = ({
  user,
  onNotify,
  onSelectSite,
  initialBuildingSqFt,
}) => {
  const [activeModule, setActiveModule] = useState<ExtendedCalculatorModule>('turnkey');

  // If handed over from floor planner, switch to turnkey multi-tier estimator
  useEffect(() => {
    if (initialBuildingSqFt && initialBuildingSqFt > 0) {
      setActiveModule('turnkey');
    }
  }, [initialBuildingSqFt]);
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
    { id: 'turnkey', label: 'Turnkey Estimator', sublabel: 'Multi-Tier BOQ', icon: <Building2 size={16} />, category: 'Structural', badge: 'Tier' },
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
    <div className="bm-calc-workspace">
      {/* ── Top Header / Project Switcher Bar (MyDesignerPlus Image 4 Style) ── */}
      <div className="bm-header-bar">
        <div className="bm-header-title-box">
          <div className="bm-header-icon-box">
            <Calculator size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="bm-header-title">
                Building Estimation Workspace
              </h1>
              <span className="bm-header-badge">
                IS 456 &amp; IS 1200 Standards
              </span>
            </div>
            <p className="bm-header-subtitle">
              Civil quantity takeoff engine for structural masonry, concrete, finishing, and procurement.
            </p>
          </div>
        </div>

        {/* Project Selector & Status Pill */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {sites.length > 0 && (
            <div className="bm-site-pill">
              <Building2 size={15} style={{ color: '#4f46e5' }} />
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '9px', textTransform: 'uppercase', fontWeight: 700, color: '#94a3b8' }}>Linked Site</span>
                <select
                  value={selectedSiteId}
                  onChange={(e) => {
                    setSelectedSiteId(e.target.value);
                    if (onSelectSite) onSelectSite(e.target.value);
                  }}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#f8fafc', padding: '6px 12px', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '11px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#475569' }}>
              <Bookmark size={13} style={{ color: '#6366f1' }} />
              <span style={{ fontWeight: 700 }}>{savedCalculations.length}</span>
              <span style={{ color: '#94a3b8' }}>saved</span>
            </div>
            <div style={{ width: '1px', height: '14px', background: '#cbd5e1' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#475569' }}>
              <Tag size={13} style={{ color: '#10b981' }} />
              <span style={{ fontWeight: 700 }}>{rates.length}</span>
              <span style={{ color: '#94a3b8' }}>rates</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── CAD Ribbon Navigation Bar (Bond360 Image 1 Style) ── */}
      <div className="bm-ribbon-bar">
        <div className="bm-ribbon-track">
          {modulesList.map((m) => {
            const isActive = activeModule === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setActiveModule(m.id)}
                className={`bm-ribbon-btn ${isActive ? 'active' : ''}`}
              >
                <div className="bm-ribbon-icon">
                  {m.icon}
                </div>
                <div className="bm-ribbon-texts">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span className="bm-ribbon-title">{m.label}</span>
                    {m.badge && (
                      <span
                        style={{
                          fontSize: '9px',
                          fontWeight: 700,
                          padding: '1px 5px',
                          borderRadius: '9999px',
                          background: isActive ? 'rgba(255,255,255,0.25)' : '#e0e7ff',
                          color: isActive ? '#ffffff' : '#3730a3',
                        }}
                      >
                        {m.badge}
                      </span>
                    )}
                  </div>
                  <span className="bm-ribbon-sub">
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
        {activeModule === 'turnkey' && (
          <MultiTierEstimatorPanel
            user={user}
            sites={sites}
            currentSiteId={selectedSiteId}
            onNotify={onNotify}
            initialArea={initialBuildingSqFt && initialBuildingSqFt > 0 ? Math.round(initialBuildingSqFt) : 1000}
          />
        )}

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
