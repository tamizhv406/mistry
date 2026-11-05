import React, { useState, useMemo } from 'react';
import { Mountain, Truck, Save, Droplet, ShieldCheck, Scale, Check } from 'lucide-react';
import type { VolumeUnit, MaterialRateItem, SavedBuildingCalculation } from '../../domain/buildingCalculator/types';
import { calculateSandProcurement } from '../../domain/buildingCalculator/sandCalculations';
import { getSandSpecByCategory } from '../../domain/buildingCalculator/sandClassification';
import { SandSelector } from './SandSelector';
import { CalculatorSection, InputField } from './CalculatorUIComponents';
import { QuantityTakeoffPanel, type TakeoffMaterialItem } from './QuantityTakeoffPanel';

interface SandCalculatorPanelProps {
  rates: MaterialRateItem[];
  onSaveCalculation: (calc: SavedBuildingCalculation) => void;
  siteId?: string;
  siteName?: string;
}

export const SandCalculatorPanel: React.FC<SandCalculatorPanelProps> = ({
  rates,
  onSaveCalculation,
  siteId,
  siteName,
}) => {
  const [name, setName] = useState('Sand Procurement & Dispatch');
  const [volume, setVolume] = useState(400); // 400 CFT = 1 full standard lorry
  const [unit, setUnit] = useState<VolumeUnit>('cft');
  const [moisturePercent, setMoisturePercent] = useState(4.0);
  const [isSaved, setIsSaved] = useState(false);

  const [sandSpec, setSandSpec] = useState(getSandSpecByCategory('m_sand_concrete'));

  const result = useMemo(() => {
    return calculateSandProcurement({
      calculationName: name,
      volume,
      inputUnit: unit,
      sandSpec,
      moisturePercent,
      rates,
    });
  }, [name, volume, unit, sandSpec, moisturePercent, rates]);

  const takeoffMaterials: TakeoffMaterialItem[] = useMemo(() => {
    return (result.costs.materialItems || []).map((item, idx) => ({
      id: `sand_${idx}`,
      name: item.materialName,
      category: 'sand' as const,
      quantity: item.quantity,
      unit: item.unit,
      rate: item.unitRate,
      subtotal: item.totalCost,
      transport: item.transportCost,
      tax: item.taxCost,
    }));
  }, [result.costs.materialItems]);

  const handleSave = () => {
    const item: SavedBuildingCalculation = {
      id: `calc_sand_${Date.now()}`,
      userId: 'current_user',
      siteId,
      siteName,
      name: name || 'Sand Logistics Calculation',
      module: 'sand',
      date: new Date().toISOString().slice(0, 10),
      inputs: { volume, unit, moisturePercent, sandCategory: sandSpec.category },
      result,
      ratesUsedSnapshot: rates,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    onSaveCalculation(item);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* ── Left Input Column (7 cols) ── */}
      <div className="lg:col-span-7 space-y-4">
        {/* Section 1: Volume & Moisture Bulking */}
        <CalculatorSection
          title="1. Sand Volume & Moisture Bulking (IS 2386)"
          subtitle="Procurement volume in CFT, Brass, or m³ with surface tension bulking compensation"
          icon={<Mountain size={16} className="text-amber-600" />}
          badge={`${result.bulkVolumeCFT} CFT`}
          badgeTone="amber"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium">Measurement Unit</span>
              <div className="inline-flex bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
                {(['cft', 'brass', 'm3'] as VolumeUnit[]).map((u) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => setUnit(u)}
                    className={`text-xs px-3 py-1 rounded-md font-semibold transition ${
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

            <InputField
              label={`Procurement Volume (${unit.toUpperCase()})`}
              type="number"
              min={1}
              step={10}
              unitAddon={unit.toUpperCase()}
              value={volume}
              onChange={(e) => setVolume(parseFloat(e.target.value) || 0)}
              helpText="Typical truck loads: 200 CFT (tipper), 400 CFT (lorry), 600 CFT (10-wheeler)"
            />

            {/* Moisture Slider */}
            <div className="p-3.5 rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/50 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Droplet size={14} className="text-amber-600" />
                  Moisture Content Bulking: <span className="font-bold text-amber-700 dark:text-amber-300">{moisturePercent}%</span>
                </span>
                <span className="font-mono font-bold text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/60 px-2 py-0.5 rounded-md text-[11px]">
                  +{result.moistureAdjustmentAppliedPercent}% Vol Expansion
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={12}
                step={0.5}
                value={moisturePercent}
                onChange={(e) => setMoisturePercent(parseFloat(e.target.value))}
                className="w-full accent-amber-600 cursor-pointer h-2 bg-slate-200 dark:bg-slate-700 rounded-lg"
              />
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Per IS 2386 Part III: Surface tension pushes moist sand grains apart (peaks around 4%–6% moisture). Dry volume requirement is adjusted accordingly.
              </p>
            </div>
          </div>
        </CalculatorSection>

        {/* Section 2: Sand Specification */}
        <CalculatorSection
          title="2. Sand Classification & Source (IS 383)"
          subtitle="Select manufactured (M-Sand/P-Sand) or natural river sand zone"
          icon={<ShieldCheck size={16} className="text-teal-600" />}
        >
          <SandSelector value={sandSpec} onChange={setSandSpec} targetModule="sand" />
        </CalculatorSection>
      </div>

      {/* ── Right Column: Logistics & Quantity Takeoff (5 cols) ── */}
      <div className="lg:col-span-5 space-y-4 lg:sticky lg:top-4">
        {/* Logistics & Vehicle Dispatch Card */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <Truck size={14} className="text-indigo-600" /> Site Dispatch Vehicles
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Bulk volume: {result.bulkVolumeCFT} CFT (~{result.bulkVolumeBrass} Brass / {result.estimatedWeightTonnes} Tonnes)
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700">
              <span className="text-[10px] text-slate-500 uppercase font-bold block">Mini-Tipper</span>
              <div className="text-lg font-bold font-mono text-slate-900 dark:text-slate-100 mt-0.5">
                {result.tipperLoads200Cft}
              </div>
              <span className="text-[10px] text-slate-400">200 CFT</span>
            </div>

            <div className="p-2.5 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900">
              <span className="text-[10px] text-indigo-700 dark:text-indigo-300 uppercase font-bold block">Std Lorry</span>
              <div className="text-lg font-bold font-mono text-indigo-950 dark:text-indigo-100 mt-0.5">
                {result.lorryLoads400Cft}
              </div>
              <span className="text-[10px] text-indigo-500">400 CFT</span>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700">
              <span className="text-[10px] text-slate-500 uppercase font-bold block">10-Wheeler</span>
              <div className="text-lg font-bold font-mono text-slate-900 dark:text-slate-100 mt-0.5">
                {result.heavyTruckLoads600Cft}
              </div>
              <span className="text-[10px] text-slate-400">600 CFT</span>
            </div>
          </div>
        </div>

        {/* Quantity Takeoff Schedule Panel */}
        <QuantityTakeoffPanel
          title="Sand Procurement Schedule"
          calculationName={name}
          volumeOrAreaMetric={{
            primaryValue: result.bulkVolumeCFT,
            primaryLabel: 'Procurement Volume (CFT)',
            secondaryValue: `${result.bulkVolumeBrass} Brass (${result.bulkVolumeM3} m³)`,
            secondaryLabel: 'Mass: ~' + result.estimatedWeightTonnes + ' Tonnes',
          }}
          costs={result.costs}
          materials={takeoffMaterials}
          onSave={handleSave}
          isSaved={isSaved}
          assumptions={result.assumptions}
          dryFactorNote={`IS 2386 Part III bulking expansion factor of +${result.moistureAdjustmentAppliedPercent}% accounted for bulk density.`}
        />
      </div>
    </div>
  );
};
