import React, { useState, useMemo } from 'react';
import { Columns, GitCommit, Save, ShieldAlert, Settings2, Info } from 'lucide-react';
import type {
  LengthUnit,
  MaterialRateItem,
  ConcreteDesignMode,
  ApprovedMixDesign,
  StructuralIntersectionConvention,
  SlabBeamIntersectionConvention,
  SavedBuildingCalculation,
} from '../../domain/buildingCalculator/types';
import { calculateBeamConcrete } from '../../domain/buildingCalculator/beamCalculations';
import { calculateColumnConcrete } from '../../domain/buildingCalculator/columnCalculations';
import { getSandSpecByCategory } from '../../domain/buildingCalculator/sandClassification';
import { SandSelector } from './SandSelector';
import { CalculatorSection, InputField, SelectField } from './CalculatorUIComponents';
import { QuantityTakeoffPanel, type TakeoffMaterialItem } from './QuantityTakeoffPanel';

interface BeamColumnCalculatorPanelProps {
  rates: MaterialRateItem[];
  onSaveCalculation: (calc: SavedBuildingCalculation) => void;
  siteId?: string;
  siteName?: string;
  defaultSubTab?: 'beam' | 'column';
}

export const BeamColumnCalculatorPanel: React.FC<BeamColumnCalculatorPanelProps> = ({
  rates,
  onSaveCalculation,
  siteId,
  siteName,
  defaultSubTab = 'beam',
}) => {
  const [subTab, setSubTab] = useState<'beam' | 'column'>(defaultSubTab);

  const [unit, setUnit] = useState<LengthUnit>('m');
  const [concreteDesignMode, setConcreteDesignMode] = useState<ConcreteDesignMode>('nominal_estimate');
  const [concreteGradeName, setConcreteGradeName] = useState('M20');
  const [nominalRatio, setNominalRatio] = useState({ cementParts: 1, fineAggregateParts: 1.5, coarseAggregateParts: 3 });

  const [approvedMix, setApprovedMix] = useState<ApprovedMixDesign>({
    cementKgPerM3: 380,
    fineAggregateKgPerM3: 680,
    coarseAggregateKgPerM3: 1150,
    waterLitresPerM3: 170,
    designDocRef: 'STR-BC-M25',
  });

  const [sandSpec, setSandSpec] = useState(getSandSpecByCategory('m_sand_concrete'));

  // Beam State
  const [beamName, setBeamName] = useState('Plinth / Floor Beams');
  const [beamSpan, setBeamSpan] = useState(4.5);
  const [beamWidth, setBeamWidth] = useState(0.23); // 230mm
  const [beamDepth, setBeamDepth] = useState(0.45); // 450mm
  const [beamCount, setBeamCount] = useState(4);
  const [beamIntersection, setBeamIntersection] = useState<StructuralIntersectionConvention>('clear_span_exclusive');
  const [slabJunction, setSlabJunction] = useState<SlabBeamIntersectionConvention>('beam_below_slab');
  const [beamWastage, setBeamWastage] = useState(2.5);
  const [beamLabour, setBeamLabour] = useState(4000);

  // Column State
  const [colName, setColName] = useState('Ground Floor RCC Columns');
  const [colShape, setColShape] = useState<'rectangular' | 'circular'>('rectangular');
  const [colWidth, setColWidth] = useState(0.23); // 230mm
  const [colDepth, setColDepth] = useState(0.38); // 380mm
  const [colHeight, setColHeight] = useState(3.0);
  const [colCount, setColCount] = useState(6);
  const [colHeightConv, setColHeightConv] = useState<'clear_height_under_beam' | 'floor_to_floor_inclusive'>('clear_height_under_beam');
  const [colWastage, setColWastage] = useState(3.0);
  const [colLabour, setColLabour] = useState(4500);

  // Beam Results
  const beamResult = useMemo(() => {
    return calculateBeamConcrete({
      calculationName: beamName,
      length: beamSpan,
      width: beamWidth,
      depth: beamDepth,
      unit,
      beamCount,
      intersectionConvention: beamIntersection,
      slabJunctionConvention: slabJunction,
      wastagePercent: beamWastage,
      concreteDesignMode,
      approvedMixDesign: concreteDesignMode === 'approved_mix_design' ? approvedMix : undefined,
      nominalMix: concreteDesignMode === 'nominal_estimate' ? nominalRatio : undefined,
      concreteGradeName,
      sandSpec,
      rates,
      labourCost: beamLabour,
    });
  }, [beamName, beamSpan, beamWidth, beamDepth, unit, beamCount, beamIntersection, slabJunction, beamWastage, concreteDesignMode, approvedMix, nominalRatio, concreteGradeName, sandSpec, rates, beamLabour]);

  // Column Results
  const colResult = useMemo(() => {
    return calculateColumnConcrete({
      calculationName: colName,
      shape: colShape,
      width: colWidth,
      depth: colDepth,
      height: colHeight,
      unit,
      columnCount: colCount,
      heightConvention: colHeightConv,
      wastagePercent: colWastage,
      concreteDesignMode,
      approvedMixDesign: concreteDesignMode === 'approved_mix_design' ? approvedMix : undefined,
      nominalMix: concreteDesignMode === 'nominal_estimate' ? nominalRatio : undefined,
      concreteGradeName,
      sandSpec,
      rates,
      labourCost: colLabour,
    });
  }, [colName, colShape, colWidth, colDepth, colHeight, unit, colCount, colHeightConv, colWastage, concreteDesignMode, approvedMix, nominalRatio, concreteGradeName, sandSpec, rates, colLabour]);

  const activeResult = subTab === 'beam' ? beamResult : colResult;

  const handleSave = () => {
    const item: SavedBuildingCalculation = {
      id: `calc_${subTab}_${Date.now()}`,
      userId: 'current_user',
      siteId,
      siteName,
      name: subTab === 'beam' ? (beamName || 'RCC Beam') : (colName || 'RCC Column'),
      module: subTab,
      date: new Date().toISOString().slice(0, 10),
      inputs: subTab === 'beam' ? { beamSpan, beamWidth, beamDepth, beamCount } : { colWidth, colDepth, colHeight, colCount },
      result: activeResult,
      ratesUsedSnapshot: rates,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    onSaveCalculation(item);
  };

  return (
    <div className="space-y-4">
      {/* Sub-tab navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
        <div className="inline-flex p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
          <button
            type="button"
            onClick={() => setSubTab('beam')}
            className={`px-4 py-1.5 rounded-md text-xs font-bold flex items-center gap-2 transition ${
              subTab === 'beam'
                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <GitCommit size={14} />
            RCC Beam Calculator
          </button>

          <button
            type="button"
            onClick={() => setSubTab('column')}
            className={`px-4 py-1.5 rounded-md text-xs font-bold flex items-center gap-2 transition ${
              subTab === 'column'
                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <Columns size={14} />
            RCC Column Calculator
          </button>
        </div>

        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
          {(['m', 'ft', 'mm', 'in'] as LengthUnit[]).map((u) => (
            <button
              key={u}
              type="button"
              onClick={() => setUnit(u)}
              className={`text-xs px-2.5 py-1 rounded-md font-semibold transition ${
                unit === u
                  ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              {u.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Inputs */}
        <div className="lg:col-span-7 space-y-4">
          {subTab === 'beam' ? (
            <CalculatorSection
              title="1. Beam Dimensions & Junction Conventions"
              subtitle="Clear span length, cross-sectional width & depth, and junction offsets"
              icon={<GitCommit size={16} className="text-indigo-600" />}
              badge={`${beamResult.totalLinearLengthM}m Total`}
              badgeTone="blue"
            >
              <div className="space-y-3">
                <InputField
                  label="Calculation Reference Name"
                  type="text"
                  value={beamName}
                  onChange={(e) => setBeamName(e.target.value)}
                />

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <InputField
                    label="Span Length"
                    type="number"
                    step={0.1}
                    unitAddon={unit}
                    value={beamSpan}
                    onChange={(e) => setBeamSpan(parseFloat(e.target.value) || 0)}
                  />
                  <InputField
                    label="Width b"
                    type="number"
                    step={0.01}
                    unitAddon={unit}
                    value={beamWidth}
                    onChange={(e) => setBeamWidth(parseFloat(e.target.value) || 0)}
                  />
                  <InputField
                    label="Depth D"
                    type="number"
                    step={0.01}
                    unitAddon={unit}
                    value={beamDepth}
                    onChange={(e) => setBeamDepth(parseFloat(e.target.value) || 0)}
                  />
                  <InputField
                    label="Beam Count"
                    type="number"
                    min={1}
                    unitAddon="beams"
                    value={beamCount}
                    onChange={(e) => setBeamCount(Math.max(1, parseInt(e.target.value) || 1))}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <SelectField
                    label="Column Junction Convention"
                    value={beamIntersection}
                    onChange={(e) => setBeamIntersection(e.target.value as any)}
                    helpText="Clear span measures between column faces to prevent double-counting column concrete."
                  >
                    <option value="clear_span_exclusive">Clear Span (Between column faces — Zero overlap)</option>
                    <option value="center_to_center_inclusive">Center-to-Center (Inclusive of junctions)</option>
                  </SelectField>

                  <SelectField
                    label="Slab Junction Convention"
                    value={slabJunction}
                    onChange={(e) => setSlabJunction(e.target.value as any)}
                    helpText="Web below slab ensures zero overlap with the RCC slab calculation."
                  >
                    <option value="beam_below_slab">Web Below Slab (Zero overlap with slab)</option>
                    <option value="beam_monolithic_full_depth">Full Monolithic Depth (Rib overlap)</option>
                  </SelectField>
                </div>
              </div>
            </CalculatorSection>
          ) : (
            <CalculatorSection
              title="1. Column Cross-Section & Height"
              subtitle="Square, rectangular or circular column dimensions and height under beam"
              icon={<Columns size={16} className="text-purple-600" />}
              badge={`${colResult.totalColumnCount} Columns`}
              badgeTone="purple"
            >
              <div className="space-y-3">
                <InputField
                  label="Calculation Reference Name"
                  type="text"
                  value={colName}
                  onChange={(e) => setColName(e.target.value)}
                />

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <SelectField
                    label="Shape"
                    value={colShape}
                    onChange={(e) => setColShape(e.target.value as any)}
                  >
                    <option value="rectangular">Rectangular / Square</option>
                    <option value="circular">Circular</option>
                  </SelectField>

                  <InputField
                    label={colShape === 'circular' ? 'Diameter' : 'Width b'}
                    type="number"
                    step={0.01}
                    unitAddon={unit}
                    value={colWidth}
                    onChange={(e) => setColWidth(parseFloat(e.target.value) || 0)}
                  />

                  {colShape === 'rectangular' && (
                    <InputField
                      label="Depth D"
                      type="number"
                      step={0.01}
                      unitAddon={unit}
                      value={colDepth}
                      onChange={(e) => setColDepth(parseFloat(e.target.value) || 0)}
                    />
                  )}

                  <InputField
                    label="Height"
                    type="number"
                    step={0.1}
                    unitAddon={unit}
                    value={colHeight}
                    onChange={(e) => setColHeight(parseFloat(e.target.value) || 0)}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <InputField
                    label="Column Count"
                    type="number"
                    min={1}
                    unitAddon="cols"
                    value={colCount}
                    onChange={(e) => setColCount(Math.max(1, parseInt(e.target.value) || 1))}
                  />

                  <SelectField
                    label="Height Convention"
                    value={colHeightConv}
                    onChange={(e) => setColHeightConv(e.target.value as any)}
                  >
                    <option value="clear_height_under_beam">Clear Height (Under Beam Soffit)</option>
                    <option value="floor_to_floor_inclusive">Floor-to-Floor (Full Height)</option>
                  </SelectField>
                </div>
              </div>
            </CalculatorSection>
          )}

          {/* Section 2: Sand Specification */}
          <CalculatorSection
            title="2. Structural Fine Aggregate (IS 383)"
            subtitle="Concrete-Grade M-Sand (Zone II) verification"
            icon={<Settings2 size={16} className="text-teal-600" />}
          >
            <SandSelector value={sandSpec} onChange={setSandSpec} targetModule={subTab} />
          </CalculatorSection>
        </div>

        {/* Right Output & Takeoff Summary Schedule */}
        <div className="lg:col-span-5 space-y-4 lg:sticky lg:top-4">
          {(() => {
            const takeoffMaterials: TakeoffMaterialItem[] = [
              {
                id: 'cement',
                name: `Cement (${concreteGradeName} Mix Design)`,
                category: 'cement',
                quantity: activeResult.cementBags50kg,
                unit: 'bags',
                secondaryUnit: `${activeResult.cementKg} kg OPC 53/43`,
                rate: rates.find((r) => r.category === 'cement')?.ratePerUnit || 380,
                subtotal: (activeResult.costs.materialItems.find((i) => i.materialName.toLowerCase().includes('cement'))?.totalCost) || 0,
              },
              {
                id: 'sand',
                name: 'M-Sand (Zone II Concrete Grade)',
                category: 'sand',
                quantity: activeResult.fineAggregateCFT,
                unit: 'CFT',
                secondaryUnit: `${activeResult.fineAggregateKg} kg`,
                rate: rates.find((r) => r.category === 'sand')?.ratePerUnit || 45,
                subtotal: (activeResult.costs.materialItems.find((i) => i.materialName.toLowerCase().includes('sand'))?.totalCost) || 0,
              },
              {
                id: 'aggregate',
                name: 'Coarse Aggregate (20mm Graded)',
                category: 'aggregate',
                quantity: activeResult.coarseAggregateCFT,
                unit: 'CFT',
                secondaryUnit: `${activeResult.coarseAggregateKg} kg`,
                rate: rates.find((r) => r.category === 'aggregate')?.ratePerUnit || 42,
                subtotal: (activeResult.costs.materialItems.find((i) => i.materialName.toLowerCase().includes('aggregate'))?.totalCost) || 0,
              },
            ];

            return (
              <QuantityTakeoffPanel
                title={subTab === 'beam' ? 'RCC Beam Takeoff' : 'RCC Column Takeoff'}
                calculationName={subTab === 'beam' ? beamName : colName}
                volumeOrAreaMetric={{
                  primaryValue: `${activeResult.totalVolumeWithWastageCFT} CFT`,
                  primaryLabel: subTab === 'beam' ? 'Beam Cast Volume' : 'Column Cast Volume',
                  secondaryValue: `${activeResult.totalVolumeWithWastageM3} m³`,
                  secondaryLabel: `(${activeResult.netVolumeBrass} Brass net)`,
                }}
                costs={activeResult.costs}
                materials={takeoffMaterials}
                onLabourChange={subTab === 'beam' ? setBeamLabour : setColLabour}
                onSave={handleSave}
                dryFactorNote="IS 456 / SP 34 Concrete Factor 1.54 applied for dry materials. Rebar BBS detailing (main bars, stirrups/ties, anchorage) must follow structural engineering drawings."
                assumptions={activeResult.assumptions}
                warnings={activeResult.warnings}
              />
            );
          })()}
        </div>
      </div>
    </div>
  );
};
