import React, { useState, useMemo } from 'react';
import { PaintRoller, Plus, Trash2, Save, Info, ShieldCheck, Sparkles } from 'lucide-react';
import type { LengthUnit, OpeningDeduction, MaterialRateItem, SavedBuildingCalculation } from '../../domain/buildingCalculator/types';
import { calculatePlastering, type PlasterSurfaceType } from '../../domain/buildingCalculator/plasterCalculations';
import { getSandSpecByCategory } from '../../domain/buildingCalculator/sandClassification';
import { SandSelector } from './SandSelector';
import { CalculatorSection, InputField, SelectField } from './CalculatorUIComponents';
import { QuantityTakeoffPanel, type TakeoffMaterialItem } from './QuantityTakeoffPanel';

interface PlasterCalculatorPanelProps {
  rates: MaterialRateItem[];
  onSaveCalculation: (calc: SavedBuildingCalculation) => void;
  siteId?: string;
  siteName?: string;
}

export const PlasterCalculatorPanel: React.FC<PlasterCalculatorPanelProps> = ({
  rates,
  onSaveCalculation,
  siteId,
  siteName,
}) => {
  const [name, setName] = useState('Interior Room Plastering');
  const [surfaceType, setSurfaceType] = useState<PlasterSurfaceType>('internal_wall');
  const [length, setLength] = useState(5.0);
  const [heightOrWidth, setHeightOrWidth] = useState(3.0);
  const [unit, setUnit] = useState<LengthUnit>('m');
  const [surfaceCount, setSurfaceCount] = useState(4); // 4 walls
  const [facesCount, setFacesCount] = useState(1);

  const [thicknessMm, setThicknessMm] = useState(12);
  const [mortarRatio, setMortarRatio] = useState({ cementParts: 1, sandParts: 4 });
  const [applyIS1200, setApplyIS1200] = useState(true);
  const [wastagePercent, setWastagePercent] = useState(12);
  const [labourCost, setLabourCost] = useState(4200);

  const [openings, setOpenings] = useState<OpeningDeduction[]>([
    { id: 'p_op_1', label: 'Room Door', type: 'door', width: 1.0, height: 2.1, unit: 'm', count: 1 },
    { id: 'p_op_2', label: 'Window', type: 'window', width: 1.2, height: 1.2, unit: 'm', count: 1 },
    { id: 'p_op_3', label: 'Small Ventilator', type: 'window', width: 0.6, height: 0.6, unit: 'm', count: 1 },
  ]);

  const [sandSpec, setSandSpec] = useState(getSandSpecByCategory('p_sand_plaster'));

  const result = useMemo(() => {
    return calculatePlastering({
      calculationName: name,
      surfaceType,
      length,
      heightOrWidth,
      unit,
      surfaceCount,
      facesCount,
      thicknessMm,
      mortarRatio,
      openings,
      applyIS1200Rules: applyIS1200,
      wastagePercent,
      sandSpec,
      rates,
      labourCost,
    });
  }, [name, surfaceType, length, heightOrWidth, unit, surfaceCount, facesCount, thicknessMm, mortarRatio, openings, applyIS1200, wastagePercent, sandSpec, rates, labourCost]);

  const addOpening = (type: 'door' | 'window') => {
    const newOp: OpeningDeduction = {
      id: `p_op_${Date.now()}`,
      label: type === 'door' ? 'Door' : 'Window',
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
      id: `calc_plaster_${Date.now()}`,
      userId: 'current_user',
      siteId,
      siteName,
      name: name || 'Plastering Calculation',
      module: 'plaster',
      date: new Date().toISOString().slice(0, 10),
      inputs: { surfaceType, length, heightOrWidth, unit, surfaceCount, thicknessMm, mortarRatio },
      result,
      ratesUsedSnapshot: rates,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    onSaveCalculation(item);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left Input Column */}
      <div className="lg:col-span-7 space-y-4">
        {/* Section 1: Surface Type & Dimensions */}
        <CalculatorSection
          title="1. Plastering Surface & Geometry"
          subtitle="Internal wall, external weather coat, or ceiling plaster dimensions"
          icon={<PaintRoller size={16} className="text-emerald-600" />}
          badge={`${result.grossPlasterAreaSqM} m² Gross`}
          badgeTone="green"
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium">Measurement Unit</span>
              <div className="inline-flex bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
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

            <InputField
              label="Calculation Reference Name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />

            <div className="grid grid-cols-3 gap-2">
              {[
                { type: 'internal_wall', label: 'Internal Wall', defaultThick: 12 },
                { type: 'external_wall', label: 'External Wall', defaultThick: 15 },
                { type: 'ceiling', label: 'Ceiling (RCC)', defaultThick: 6 },
              ].map((s) => (
                <button
                  key={s.type}
                  type="button"
                  onClick={() => {
                    setSurfaceType(s.type as PlasterSurfaceType);
                    setThicknessMm(s.defaultThick);
                  }}
                  className={`py-2 px-2.5 rounded-xl border text-xs font-semibold text-center transition-all ${
                    surfaceType === s.type
                      ? 'border-emerald-600 bg-emerald-50/70 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 ring-1 ring-emerald-600'
                      : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                  }`}
                >
                  {s.label} ({s.defaultThick}mm)
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <InputField
                label="Length"
                type="number"
                step={0.1}
                unitAddon={unit}
                value={length}
                onChange={(e) => setLength(parseFloat(e.target.value) || 0)}
              />

              <InputField
                label={surfaceType === 'ceiling' ? 'Width' : 'Height'}
                type="number"
                step={0.1}
                unitAddon={unit}
                value={heightOrWidth}
                onChange={(e) => setHeightOrWidth(parseFloat(e.target.value) || 0)}
              />

              <InputField
                label="Thickness"
                type="number"
                min={4}
                max={30}
                unitAddon="mm"
                value={thicknessMm}
                onChange={(e) => setThicknessMm(parseInt(e.target.value) || 12)}
              />

              <InputField
                label="Surface Count"
                type="number"
                min={1}
                unitAddon="surfaces"
                value={surfaceCount}
                onChange={(e) => setSurfaceCount(Math.max(1, parseInt(e.target.value) || 1))}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <SelectField
                label="Mortar Ratio"
                value={mortarRatio.sandParts}
                onChange={(e) => setMortarRatio({ cementParts: 1, sandParts: parseInt(e.target.value) })}
              >
                <option value="3">1 : 3 (Ceiling Plaster / Water Tanks)</option>
                <option value="4">1 : 4 (External Weather Resistant Plaster)</option>
                <option value="5">1 : 5 (Standard Internal Wall Plaster)</option>
                <option value="6">1 : 6 (Economical Internal Wall Plaster)</option>
              </SelectField>

              <InputField
                label="Rebound & Wastage Allowance"
                type="number"
                min={5}
                max={25}
                unitAddon="%"
                value={wastagePercent}
                onChange={(e) => setWastagePercent(parseInt(e.target.value) || 10)}
                helpText="Scaffolding rebound and drop allowance (typically 10% to 15%)"
              />
            </div>
          </div>
        </CalculatorSection>

        {/* Section 2: IS 1200 Deduction Rules */}
        <CalculatorSection
          title="2. IS 1200 Part XII Deduction Rules"
          subtitle="Standard civil deductions: ≤0.5m² (none), 0.5–3m² (50%), >3m² (full)"
          icon={<ShieldCheck size={16} className="text-emerald-600" />}
          badge={applyIS1200 ? 'IS 1200 Active' : 'Geometric Deduction'}
          badgeTone={applyIS1200 ? 'green' : 'slate'}
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
              <div>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">Apply IS 1200 Part XII Deduction Standard</span>
                <span className="text-[11px] text-slate-500">Exempts small openings ≤0.5m² from deduction to cover jamb plastering</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={applyIS1200}
                  onChange={(e) => setApplyIS1200(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-slate-500">Openings List</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => addOpening('door')}
                  className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1 hover:underline"
                >
                  <Plus size={12} /> Add Door
                </button>
                <button
                  type="button"
                  onClick={() => addOpening('window')}
                  className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1 hover:underline"
                >
                  <Plus size={12} /> Add Window
                </button>
              </div>
            </div>

            {openings.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-2">No openings in this surface.</p>
            ) : (
              <div className="space-y-2">
                {openings.map((op) => {
                  const area = op.width * op.height;
                  return (
                    <div
                      key={op.id}
                      className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-xs"
                    >
                      <span className="font-semibold text-slate-800 dark:text-slate-200 w-28 truncate">{op.label}</span>
                      <div className="flex items-center gap-2 flex-1">
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
                          className="w-16"
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
                          className="w-16"
                        />
                        <span className="text-slate-400 font-mono text-[11px]">
                          ({area.toFixed(2)} m² — {area <= 0.5 ? '0% deduct' : area <= 3.0 ? '50% deduct' : '100% deduct'})
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeOpening(op.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-md transition-colors"
                        title="Remove opening"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </CalculatorSection>

        {/* Section 3: Sand Specification */}
        <CalculatorSection
          title="3. Plastering Sand (P-Sand Zone IV)"
          subtitle="Sieved below 2.36mm, low silt content (< 7%)"
          icon={<ShieldCheck size={16} className="text-teal-600" />}
        >
          <SandSelector value={sandSpec} onChange={setSandSpec} targetModule="plaster" />
        </CalculatorSection>
      </div>

      {/* Right Output & Summary Column */}
      <div className="lg:col-span-5 space-y-4 lg:sticky lg:top-4">
        {(() => {
          const takeoffMaterials: TakeoffMaterialItem[] = [
            {
              id: 'cement',
              name: `Cement (1:${mortarRatio.sandParts} Plaster Mortar)`,
              category: 'cement',
              quantity: result.cementBags50kg,
              unit: 'bags',
              secondaryUnit: `${result.cementKg} kg OPC/PPC`,
              rate: rates.find((r) => r.category === 'cement')?.ratePerUnit || 380,
              subtotal: (result.costs.materialItems.find((i) => i.materialName.toLowerCase().includes('cement'))?.totalCost) || 0,
            },
            {
              id: 'sand',
              name: 'Plaster Sand (P-Sand Zone IV Fine)',
              category: 'sand',
              quantity: result.sandVolumeCFT,
              unit: 'CFT',
              secondaryUnit: `${result.sandVolumeM3} m³ (${result.sandVolumeBrass} Brass)`,
              rate: rates.find((r) => r.category === 'sand')?.ratePerUnit || 52,
              subtotal: (result.costs.materialItems.find((i) => i.materialName.toLowerCase().includes('sand'))?.totalCost) || 0,
            },
          ];

          return (
            <QuantityTakeoffPanel
              title="Plastering Quantity Takeoff"
              calculationName={name || 'Plastering'}
              volumeOrAreaMetric={{
                primaryValue: `${result.netPlasterAreaSqM} m²`,
                primaryLabel: 'Net Plaster Area',
                secondaryValue: `${result.netPlasterAreaSqFt} sq.ft`,
                secondaryLabel: `(${thicknessMm}mm thick mortar bed)`,
              }}
              costs={result.costs}
              materials={takeoffMaterials}
              onLabourChange={setLabourCost}
              onSave={handleSave}
              dryFactorNote="IS 1200 Part XII Deduction Rules: Openings ≤ 0.5 m² (no deduction); 0.5 to 3.0 m² (deduct 50% for one face); > 3.0 m² (deduct 100% both faces with jambs added). Dry volume factor: 1.33."
              assumptions={result.assumptions}
              warnings={result.warnings}
            />
          );
        })()}
      </div>
    </div>
  );
};
