import React, { useState, useMemo } from 'react';
import { BrickWall, Plus, Trash2, Save, Info, Settings2, ShieldCheck } from 'lucide-react';
import type { LengthUnit, OpeningDeduction, MaterialRateItem, SavedBuildingCalculation } from '../../domain/buildingCalculator/types';
import { calculateWallMasonry, type WallCalculatorInputs } from '../../domain/buildingCalculator/wallCalculations';
import { getSandSpecByCategory } from '../../domain/buildingCalculator/sandClassification';
import { SandSelector } from './SandSelector';
import { CalculatorSection, InputField, SelectField } from './CalculatorUIComponents';
import { QuantityTakeoffPanel, type TakeoffMaterialItem } from './QuantityTakeoffPanel';

interface WallCalculatorPanelProps {
  rates: MaterialRateItem[];
  onSaveCalculation: (calc: SavedBuildingCalculation) => void;
  siteId?: string;
  siteName?: string;
}

export const WallCalculatorPanel: React.FC<WallCalculatorPanelProps> = ({
  rates,
  onSaveCalculation,
  siteId,
  siteName,
}) => {
  const [name, setName] = useState('Ground Floor Brick Wall');
  const [length, setLength] = useState(5.0);
  const [height, setHeight] = useState(3.0);
  const [thickness, setThickness] = useState(0.20);
  const [unit, setUnit] = useState<LengthUnit>('m');
  const [wallCount, setWallCount] = useState(1);
  const [unitType, setUnitType] = useState<WallCalculatorInputs['unitType']>('modular_brick');

  const [mortarJointMm, setMortarJointMm] = useState(10);
  const [mortarRatio, setMortarRatio] = useState({ cementParts: 1, sandParts: 6 });
  const [wastagePercent, setWastagePercent] = useState(5);
  const [labourCost, setLabourCost] = useState(3500);

  const [openings, setOpenings] = useState<OpeningDeduction[]>([
    { id: 'op_1', label: 'Main Door', type: 'door', width: 1.0, height: 2.1, unit: 'm', count: 1 },
    { id: 'op_2', label: 'Window', type: 'window', width: 1.2, height: 1.2, unit: 'm', count: 1 },
  ]);

  const [sandSpec, setSandSpec] = useState(getSandSpecByCategory('masonry_sand'));

  const result = useMemo(() => {
    return calculateWallMasonry({
      calculationName: name,
      length,
      height,
      thickness,
      unit,
      wallCount,
      unitType,
      mortarJointThicknessMm: mortarJointMm,
      openings,
      mortarRatio,
      wastagePercent,
      sandSpec,
      rates,
      labourCost,
    });
  }, [name, length, height, thickness, unit, wallCount, unitType, mortarJointMm, openings, mortarRatio, wastagePercent, sandSpec, rates, labourCost]);

  const addOpening = (type: 'door' | 'window') => {
    const newOp: OpeningDeduction = {
      id: `op_${Date.now()}`,
      label: type === 'door' ? 'Door Opening' : 'Window Opening',
      type,
      width: type === 'door' ? (unit === 'ft' ? 3.0 : 0.9) : (unit === 'ft' ? 4.0 : 1.2),
      height: type === 'door' ? (unit === 'ft' ? 7.0 : 2.1) : (unit === 'ft' ? 4.0 : 1.2),
      unit,
      count: 1,
    };
    setOpenings([...openings, newOp]);
  };

  const removeOpening = (id: string) => {
    setOpenings(openings.filter((o) => o.id !== id));
  };

  const handleSave = () => {
    const item: SavedBuildingCalculation = {
      id: `calc_wall_${Date.now()}`,
      userId: 'current_user',
      siteId,
      siteName,
      name: name || 'Wall Masonry Calculation',
      module: 'wall',
      date: new Date().toISOString().slice(0, 10),
      inputs: { length, height, thickness, unit, wallCount, unitType, mortarRatio, wastagePercent },
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
          title="1. Wall Dimensions & Geometry"
          subtitle="Overall wall length, height, thickness and unit toggle"
          icon={<BrickWall size={16} className="text-amber-600" />}
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
              placeholder="e.g. Ground Floor Exterior Wall"
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
                label="Height"
                type="number"
                step={0.1}
                min={0.1}
                unitAddon={unit}
                value={height}
                onChange={(e) => setHeight(parseFloat(e.target.value) || 0)}
              />

              <InputField
                label="Thickness"
                type="number"
                step={0.01}
                min={0.01}
                unitAddon={unit}
                value={thickness}
                onChange={(e) => setThickness(parseFloat(e.target.value) || 0)}
              />

              <InputField
                label="Wall Count"
                type="number"
                step={1}
                min={1}
                unitAddon="walls"
                value={wallCount}
                onChange={(e) => setWallCount(Math.max(1, parseInt(e.target.value) || 1))}
              />
            </div>
          </div>
        </CalculatorSection>

        {/* Section 2: Masonry Unit & Mortar */}
        <CalculatorSection
          title="2. Masonry Unit & Mortar Specification"
          subtitle="Brick type, mortar thickness, and mix proportions (IS standards)"
          icon={<Settings2 size={16} className="text-indigo-600" />}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <SelectField
              label="Masonry Unit Type"
              value={unitType}
              onChange={(e) => setUnitType(e.target.value as any)}
            >
              <option value="modular_brick">IS Standard Modular Brick (190 × 90 × 90 mm)</option>
              <option value="country_brick">Traditional Country Clay Brick (230 × 110 × 75 mm)</option>
              <option value="fly_ash_brick">Fly Ash Brick (230 × 110 × 75 mm)</option>
              <option value="aac_block_200">AAC Block 200mm (600 × 200 × 200 mm)</option>
              <option value="aac_block_150">AAC Block 150mm (600 × 200 × 150 mm)</option>
              <option value="aac_block_100">AAC Block 100mm (600 × 200 × 100 mm)</option>
            </SelectField>

            <SelectField
              label="Mortar Mix Proportions"
              value={mortarRatio.sandParts}
              onChange={(e) => setMortarRatio({ cementParts: 1, sandParts: parseInt(e.target.value) })}
            >
              <option value="3">1 : 3 (High Strength / Basement / Foundation)</option>
              <option value="4">1 : 4 (Load-bearing External Walls)</option>
              <option value="5">1 : 5 (Standard Superstructure)</option>
              <option value="6">1 : 6 (Non-load Bearing Partitions)</option>
            </SelectField>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="font-semibold text-slate-700 dark:text-slate-300">Mortar Bed Joint</span>
                <span className="font-mono font-bold text-indigo-600">{mortarJointMm} mm</span>
              </div>
              <input
                type="range"
                min={6}
                max={15}
                value={mortarJointMm}
                onChange={(e) => setMortarJointMm(parseInt(e.target.value))}
                className="w-full accent-indigo-600 cursor-pointer"
              />
              <span className="text-[10px] text-slate-400 block">Standard: 10 mm (3 mm for thin-bed AAC adhesive)</span>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="font-semibold text-slate-700 dark:text-slate-300">Brick Cutting Wastage</span>
                <span className="font-mono font-bold text-indigo-600">{wastagePercent}%</span>
              </div>
              <input
                type="range"
                min={2}
                max={12}
                value={wastagePercent}
                onChange={(e) => setWastagePercent(parseInt(e.target.value))}
                className="w-full accent-indigo-600 cursor-pointer"
              />
              <span className="text-[10px] text-slate-400 block">Includes corner bats, Queen closers, and transit handling</span>
            </div>
          </div>
        </CalculatorSection>

        {/* Section 3: Openings */}
        <CalculatorSection
          title="3. Openings & Deductions"
          subtitle="Deduct doors, windows, and lintel openings from wall volume"
          icon={<Plus size={16} className="text-emerald-600" />}
          badge={`${openings.length} Deductions`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">Openings List</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => addOpening('door')}
                className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold flex items-center gap-1 hover:underline"
              >
                <Plus size={12} /> Add Door
              </button>
              <button
                type="button"
                onClick={() => addOpening('window')}
                className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold flex items-center gap-1 hover:underline"
              >
                <Plus size={12} /> Add Window
              </button>
            </div>
          </div>

          {openings.length === 0 ? (
            <p className="text-xs text-slate-400 italic py-2">No openings entered. Wall is calculated as solid masonry.</p>
          ) : (
            <div className="space-y-2">
              {openings.map((op) => (
                <div
                  key={op.id}
                  className="bm-opening-row"
                >
                  <span className="bm-opening-name">{op.label}</span>
                  <div className="bm-opening-inputs">
                    <InputField
                      label=""
                      unitAddon="W"
                      type="number"
                      step={0.1}
                      value={op.width}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setOpenings(openings.map((o) => (o.id === op.id ? { ...o, width: val } : o)));
                      }}
                      containerStyle={{ width: 88, minWidth: 88 }}
                    />
                    <InputField
                      label=""
                      unitAddon="H"
                      type="number"
                      step={0.1}
                      value={op.height}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setOpenings(openings.map((o) => (o.id === op.id ? { ...o, height: val } : o)));
                      }}
                      containerStyle={{ width: 88, minWidth: 88 }}
                    />
                    <InputField
                      label=""
                      unitAddon="Qty"
                      type="number"
                      min={1}
                      value={op.count}
                      onChange={(e) => {
                        const val = Math.max(1, parseInt(e.target.value) || 1);
                        setOpenings(openings.map((o) => (o.id === op.id ? { ...o, count: val } : o)));
                      }}
                      containerStyle={{ width: 80, minWidth: 80 }}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeOpening(op.id)}
                    style={{ border: 'none', background: 'transparent', padding: '6px', color: '#94a3b8', cursor: 'pointer' }}
                    title="Remove opening"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </CalculatorSection>

        {/* Section 4: Sand Classification */}
        <CalculatorSection
          title="4. Sand Classification & Silt Grading"
          subtitle="IS 383 Zone III masonry sand specifications and moisture check"
          icon={<ShieldCheck size={16} className="text-teal-600" />}
        >
          <SandSelector value={sandSpec} onChange={setSandSpec} targetModule="wall" />
        </CalculatorSection>
      </div>

      {/* Right Column: Commercial Quantity Takeoff & Schedule (Image 4 style) */}
      <div className="bm-takeoff-column">
        {(() => {
          const takeoffMaterials: TakeoffMaterialItem[] = [
            {
              id: 'brick',
              name: unitType === 'modular_brick' ? 'Modular Red Bricks' : unitType === 'aac_block' ? 'AAC Blocks' : 'Concrete Blocks',
              category: 'brick',
              quantity: result.brickCountWithWastage,
              unit: 'nos',
              secondaryUnit: `Net: ${result.brickCountEstimated.toLocaleString()} nos (+${wastagePercent}% waste)`,
              rate: rates.find((r) => r.category === 'brick')?.ratePerUnit || 10.5,
              subtotal: (result.costs.materialItems.find((i) => i.materialName.toLowerCase().includes('brick') || i.materialName.toLowerCase().includes('block'))?.totalCost) || 0,
            },
            {
              id: 'cement',
              name: 'Cement (PPC / OPC 43)',
              category: 'cement',
              quantity: result.cementBags50kg,
              unit: 'bags',
              secondaryUnit: `${result.cementKg} kg (1:6 mortar bed)`,
              rate: rates.find((r) => r.category === 'cement')?.ratePerUnit || 380,
              subtotal: (result.costs.materialItems.find((i) => i.materialName.toLowerCase().includes('cement'))?.totalCost) || 0,
            },
            {
              id: 'sand',
              name: `${sandSpec.category === 'masonry_sand' ? 'Masonry Sand' : 'M-Sand'} (Zone III)`,
              category: 'sand',
              quantity: result.sandVolumeCFT,
              unit: 'CFT',
              secondaryUnit: `${result.sandVolumeM3} m³ (${result.sandVolumeBrass} Brass)`,
              rate: rates.find((r) => r.category === 'sand')?.ratePerUnit || 45,
              subtotal: (result.costs.materialItems.find((i) => i.materialName.toLowerCase().includes('sand'))?.totalCost) || 0,
            },
          ];

          return (
            <QuantityTakeoffPanel
              title="Wall Masonry Takeoff"
              calculationName={name || 'Wall Masonry'}
              volumeOrAreaMetric={{
                primaryValue: `${result.netWallAreaSqM} m²`,
                primaryLabel: 'Net Wall Area',
                secondaryValue: `${result.netVolumeCFT} CFT`,
                secondaryLabel: `(${result.netVolumeM3} m³ net volume)`,
              }}
              costs={result.costs}
              materials={takeoffMaterials}
              onLabourChange={setLabourCost}
              onSave={handleSave}
              dryFactorNote="IS 1200 & IS 2212 Mortar Factor 1.33 applied to convert wet mortar to dry ingredient volumes. Deduction threshold: Openings ≤ 0.1 m² not deducted; 0.1 to 3 m² deducted one face."
              assumptions={result.assumptions}
              warnings={result.warnings}
            />
          );
        })()}
      </div>
    </div>
  );
};
