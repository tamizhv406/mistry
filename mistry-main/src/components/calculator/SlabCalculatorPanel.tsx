import React, { useState, useMemo } from 'react';
import { Layers, Plus, Trash2, Save, Info, FileCheck, ShieldAlert, AlertTriangle } from 'lucide-react';
import type { LengthUnit, OpeningDeduction, MaterialRateItem, ConcreteDesignMode, ApprovedMixDesign, SavedBuildingCalculation } from '../../domain/buildingCalculator/types';
import { calculateRccSlab } from '../../domain/buildingCalculator/slabCalculations';
import { getSandSpecByCategory } from '../../domain/buildingCalculator/sandClassification';
import { SandSelector } from './SandSelector';
import { CalculatorSection, InputField, SelectField } from './CalculatorUIComponents';
import { QuantityTakeoffPanel, type TakeoffMaterialItem } from './QuantityTakeoffPanel';

interface SlabCalculatorPanelProps {
  rates: MaterialRateItem[];
  onSaveCalculation: (calc: SavedBuildingCalculation) => void;
  siteId?: string;
  siteName?: string;
  defaultName?: string;
}

export const SlabCalculatorPanel: React.FC<SlabCalculatorPanelProps> = ({
  rates,
  onSaveCalculation,
  siteId,
  siteName,
  defaultName = 'Ground Floor RCC Slab',
}) => {
  const [name, setName] = useState(defaultName);
  const [length, setLength] = useState(10.0);
  const [width, setWidth] = useState(6.0);
  const [thickness, setThickness] = useState(0.125); // 125mm
  const [unit, setUnit] = useState<LengthUnit>('m');
  const [slabCount, setSlabCount] = useState(1);
  const [wastagePercent, setWastagePercent] = useState(3);
  const [labourCost, setLabourCost] = useState(6000);

  // Concrete Design Mode
  const [concreteDesignMode, setConcreteDesignMode] = useState<ConcreteDesignMode>('nominal_estimate');
  const [concreteGradeName, setConcreteGradeName] = useState('M20');
  const [nominalRatio, setNominalRatio] = useState({ cementParts: 1, fineAggregateParts: 1.5, coarseAggregateParts: 3 });

  // Mode A: Approved Mix Design Proportions per m3
  const [approvedMix, setApprovedMix] = useState<ApprovedMixDesign>({
    cementKgPerM3: 380,
    fineAggregateKgPerM3: 680,
    coarseAggregateKgPerM3: 1150,
    waterLitresPerM3: 170,
    admixtureKgPerM3: 3.8,
    designDocRef: 'STR-RCC-M25-01',
    targetStrengthMpa: 25,
  });

  const [cutouts, setCutouts] = useState<OpeningDeduction[]>([
    { id: 'cutout_1', label: 'Staircase Opening', type: 'cutout', width: 2.0, height: 3.0, unit: 'm', count: 1 },
  ]);

  const [sandSpec, setSandSpec] = useState(getSandSpecByCategory('m_sand_concrete'));

  const result = useMemo(() => {
    return calculateRccSlab({
      calculationName: name,
      length,
      width,
      thickness,
      unit,
      slabCount,
      cutouts,
      wastagePercent,
      concreteDesignMode,
      approvedMixDesign: concreteDesignMode === 'approved_mix_design' ? approvedMix : undefined,
      nominalMix: concreteDesignMode === 'nominal_estimate' ? nominalRatio : undefined,
      concreteGradeName,
      sandSpec,
      rates,
      labourCost,
    });
  }, [name, length, width, thickness, unit, slabCount, cutouts, wastagePercent, concreteDesignMode, approvedMix, nominalRatio, concreteGradeName, sandSpec, rates, labourCost]);

  const addCutout = () => {
    const newCutout: OpeningDeduction = {
      id: `cut_${Date.now()}`,
      label: 'Duct / Cutout',
      type: 'cutout',
      width: unit === 'ft' ? 2.0 : 0.6,
      height: unit === 'ft' ? 2.0 : 0.6,
      unit,
      count: 1,
    };
    setCutouts([...cutouts, newCutout]);
  };

  const removeCutout = (id: string) => {
    setCutouts(cutouts.filter((c) => c.id !== id));
  };

  const handleSave = () => {
    const item: SavedBuildingCalculation = {
      id: `calc_slab_${Date.now()}`,
      userId: 'current_user',
      siteId,
      siteName,
      name: name || 'RCC Slab Calculation',
      module: 'slab',
      date: new Date().toISOString().slice(0, 10),
      inputs: { length, width, thickness, unit, slabCount, concreteDesignMode, concreteGradeName },
      result,
      ratesUsedSnapshot: rates,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    onSaveCalculation(item);
  };

  return (
    <div className="bm-calc-workspace-grid">
      {/* Left Input Forms */}
      <div className="bm-input-column">
        {/* Section 1: Dimensions */}
        <CalculatorSection
          title="1. RCC Slab & Roof Geometry"
          subtitle="Slab length, breadth, thickness and floor count"
          icon={<Layers size={16} className="text-indigo-600" />}
          badge={`${unit.toUpperCase()} Mode`}
          badgeTone="blue"
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium">Measurement Unit</span>
              <div className="bm-unit-toggle">
                {(['m', 'ft', 'mm', 'in'] as LengthUnit[]).map((u) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => setUnit(u)}
                    className={`bm-unit-btn ${unit === u ? 'active' : ''}`}
                  >
                    {u.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <InputField
              label="Calculation Reference Name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Roof Terrace RCC Slab"
            />

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <InputField
                label="Length"
                type="number"
                step={0.1}
                min={0.1}
                unitAddon={unit}
                value={length}
                onChange={(e) => setLength(parseFloat(e.target.value) || 0)}
              />

              <InputField
                label="Width"
                type="number"
                step={0.1}
                min={0.1}
                unitAddon={unit}
                value={width}
                onChange={(e) => setWidth(parseFloat(e.target.value) || 0)}
              />

              <InputField
                label="Thickness"
                type="number"
                step={0.005}
                min={0.05}
                unitAddon={unit}
                value={thickness}
                onChange={(e) => setThickness(parseFloat(e.target.value) || 0)}
                helpText="Standard residential slab thickness: 125 mm to 150 mm (5 to 6 inches)"
              />

              <InputField
                label="Slab Count"
                type="number"
                step={1}
                min={1}
                unitAddon="slabs"
                value={slabCount}
                onChange={(e) => setSlabCount(Math.max(1, parseInt(e.target.value) || 1))}
              />
            </div>
          </div>
        </CalculatorSection>

        {/* Section 2: Concrete Mix Specification */}
        <CalculatorSection
          title="2. Concrete Design Specification (IS 456 / IS 10262)"
          subtitle="Choose between approved structural mix design or educational nominal ratio"
          icon={<FileCheck size={16} className="text-indigo-600" />}
          badge={concreteDesignMode === 'approved_mix_design' ? 'Mode A: Approved Mix' : 'Mode B: Nominal'}
          badgeTone={concreteDesignMode === 'approved_mix_design' ? 'green' : 'amber'}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => setConcreteDesignMode('approved_mix_design')}
              className={`p-3 rounded-xl border text-left transition-all ${
                concreteDesignMode === 'approved_mix_design'
                  ? 'border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/30 ring-1 ring-indigo-600'
                  : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center gap-1.5 font-bold text-xs text-indigo-950 dark:text-indigo-200">
                <FileCheck size={15} className="text-indigo-600" /> Mode A: Approved Mix Design
              </div>
              <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                Lab-certified proportions per m³ (kg/m³) for licensed structural approval.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setConcreteDesignMode('nominal_estimate')}
              className={`p-3 rounded-xl border text-left transition-all ${
                concreteDesignMode === 'nominal_estimate'
                  ? 'border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/30 ring-1 ring-indigo-600'
                  : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center gap-1.5 font-bold text-xs text-indigo-950 dark:text-indigo-200">
                <AlertTriangle size={15} className="text-amber-600" /> Mode B: Nominal Estimate
              </div>
              <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                Indicative educational volumetric ratio (1:1.5:3). Explicit disclaimer attached.
              </p>
            </button>
          </div>

          {concreteDesignMode === 'approved_mix_design' ? (
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/80 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <InputField
                  label="Cement"
                  type="number"
                  unitAddon="kg/m³"
                  value={approvedMix.cementKgPerM3}
                  onChange={(e) => setApprovedMix({ ...approvedMix, cementKgPerM3: parseFloat(e.target.value) || 0 })}
                />
                <InputField
                  label="Fine Agg (M-Sand)"
                  type="number"
                  unitAddon="kg/m³"
                  value={approvedMix.fineAggregateKgPerM3}
                  onChange={(e) => setApprovedMix({ ...approvedMix, fineAggregateKgPerM3: parseFloat(e.target.value) || 0 })}
                />
                <InputField
                  label="20mm Coarse Agg"
                  type="number"
                  unitAddon="kg/m³"
                  value={approvedMix.coarseAggregateKgPerM3}
                  onChange={(e) => setApprovedMix({ ...approvedMix, coarseAggregateKgPerM3: parseFloat(e.target.value) || 0 })}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <InputField
                  label="Mix Design Doc Reference"
                  type="text"
                  value={approvedMix.designDocRef || ''}
                  placeholder="e.g. LAB-MIX-2026-M25"
                  onChange={(e) => setApprovedMix({ ...approvedMix, designDocRef: e.target.value })}
                />
                <InputField
                  label="Water"
                  type="number"
                  unitAddon="L/m³"
                  value={approvedMix.waterLitresPerM3 || 170}
                  onChange={(e) => setApprovedMix({ ...approvedMix, waterLitresPerM3: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>
          ) : (
            <div className="p-3.5 bg-amber-50/70 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-900/60 space-y-2.5">
              <div className="flex items-start gap-2 text-xs text-amber-900 dark:text-amber-200">
                <AlertTriangle size={15} className="shrink-0 mt-0.5 text-amber-600" />
                <p className="leading-relaxed">
                  <b>CIVIL ENGINEERING NOTICE:</b> Volumetric nominal ratios (1:1.5:3 for M20) are indicative educational estimates. IS 456 mandates site-approved design mix for structural concrete.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <SelectField
                  label="Indicative Concrete Grade"
                  value={concreteGradeName}
                  onChange={(e) => {
                    const g = e.target.value;
                    setConcreteGradeName(g);
                    if (g === 'M15') setNominalRatio({ cementParts: 1, fineAggregateParts: 2, coarseAggregateParts: 4 });
                    if (g === 'M20') setNominalRatio({ cementParts: 1, fineAggregateParts: 1.5, coarseAggregateParts: 3 });
                    if (g === 'M25') setNominalRatio({ cementParts: 1, fineAggregateParts: 1, coarseAggregateParts: 2 });
                  }}
                >
                  <option value="M15">M15 (1 : 2 : 4) — Non-structural</option>
                  <option value="M20">M20 (1 : 1.5 : 3) — Standard Residential Slab</option>
                  <option value="M25">M25 (1 : 1 : 2) — Heavy RCC Slab</option>
                </SelectField>

                <div className="space-y-1">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">Dry Concrete Shrinkage Factor</span>
                  <div className="py-2 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-mono text-xs flex justify-between">
                    <span>IS 456 Factor:</span>
                    <b>1.54 (54% extra dry vol)</b>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CalculatorSection>

        {/* Section 3: Cutouts & Duct Deductions */}
        <CalculatorSection
          title="3. Staircase & Duct Cutouts"
          subtitle="Deduct staircase openings and service duct voids"
          icon={<Plus size={16} className="text-emerald-600" />}
          badge={`${cutouts.length} Cutouts`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">Slab Cutouts List</span>
            <button
              type="button"
              onClick={addCutout}
              className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold flex items-center gap-1 hover:underline"
            >
              <Plus size={12} /> Add Cutout
            </button>
          </div>

          {cutouts.length === 0 ? (
            <p className="text-xs text-slate-400 italic py-2">No slab cutouts. Slab is calculated as solid concrete area.</p>
          ) : (
            <div className="space-y-2">
              {cutouts.map((co) => (
                <div
                  key={co.id}
                  className="bm-opening-row"
                >
                  <span className="bm-opening-name">{co.label}</span>
                  <div className="bm-opening-inputs">
                    <InputField
                      label=""
                      unitAddon="W"
                      type="number"
                      step={0.1}
                      value={co.width}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setCutouts(cutouts.map((c) => (c.id === co.id ? { ...c, width: val } : c)));
                      }}
                      containerStyle={{ width: 88, minWidth: 88 }}
                    />
                    <InputField
                      label=""
                      unitAddon="L"
                      type="number"
                      step={0.1}
                      value={co.height}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setCutouts(cutouts.map((c) => (c.id === co.id ? { ...c, height: val } : c)));
                      }}
                      containerStyle={{ width: 88, minWidth: 88 }}
                    />
                    <InputField
                      label=""
                      unitAddon="Qty"
                      type="number"
                      min={1}
                      value={co.count}
                      onChange={(e) => {
                        const val = Math.max(1, parseInt(e.target.value) || 1);
                        setCutouts(cutouts.map((c) => (c.id === co.id ? { ...c, count: val } : c)));
                      }}
                      containerStyle={{ width: 80, minWidth: 80 }}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeCutout(co.id)}
                    style={{ border: 'none', background: 'transparent', padding: '6px', color: '#94a3b8', cursor: 'pointer' }}
                    title="Remove cutout"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </CalculatorSection>

        {/* Section 4: Sand Specification */}
        <CalculatorSection
          title="4. Concrete Sand Specification (IS 383)"
          subtitle="Concrete-Grade M-Sand (Zone II) certification and moisture evaluation"
          icon={<ShieldAlert size={16} className="text-teal-600" />}
        >
          <SandSelector value={sandSpec} onChange={setSandSpec} targetModule="slab" />
        </CalculatorSection>
      </div>

      {/* Right Column: Material Summaries & Costing Takeoff Schedule */}
      <div className="bm-takeoff-column">
        {(() => {
          const takeoffMaterials: TakeoffMaterialItem[] = [
            {
              id: 'cement',
              name: `Cement (${concreteGradeName} Mix Design)`,
              category: 'cement',
              quantity: result.cementBags50kg,
              unit: 'bags',
              secondaryUnit: `${result.cementKg} kg OPC 53/43`,
              rate: rates.find((r) => r.category === 'cement')?.ratePerUnit || 380,
              subtotal: (result.costs.materialItems.find((i) => i.materialName.toLowerCase().includes('cement'))?.totalCost) || 0,
            },
            {
              id: 'sand',
              name: 'M-Sand (Zone II Concrete Grade)',
              category: 'sand',
              quantity: result.fineAggregateCFT,
              unit: 'CFT',
              secondaryUnit: `${result.fineAggregateKg} kg`,
              rate: rates.find((r) => r.category === 'sand')?.ratePerUnit || 45,
              subtotal: (result.costs.materialItems.find((i) => i.materialName.toLowerCase().includes('sand'))?.totalCost) || 0,
            },
            {
              id: 'aggregate',
              name: 'Coarse Aggregate (20mm Graded)',
              category: 'aggregate',
              quantity: result.coarseAggregateCFT,
              unit: 'CFT',
              secondaryUnit: `${result.coarseAggregateKg} kg`,
              rate: rates.find((r) => r.category === 'aggregate')?.ratePerUnit || 42,
              subtotal: (result.costs.materialItems.find((i) => i.materialName.toLowerCase().includes('aggregate'))?.totalCost) || 0,
            },
          ];

          return (
            <QuantityTakeoffPanel
              title="RCC Slab Quantity Takeoff"
              calculationName={name || 'RCC Slab'}
              volumeOrAreaMetric={{
                primaryValue: `${result.slabAreaSqM} m²`,
                primaryLabel: 'Slab Casting Area',
                secondaryValue: `${result.totalVolumeWithWastageCFT} CFT`,
                secondaryLabel: `(${result.totalVolumeWithWastageM3} m³ wet concrete)`,
              }}
              costs={result.costs}
              materials={takeoffMaterials}
              onLabourChange={setLabourCost}
              onSave={handleSave}
              dryFactorNote="IS 456 Concrete Dry Mix Factor 1.54 applied for void ratio and dry bulk volume conversion. Cutouts deducted for staircases/ducts. Structural rebar (BBS) to be ordered per engineering drawings."
              assumptions={result.assumptions}
              warnings={result.warnings}
            />
          );
        })()}
      </div>
    </div>
  );
};
