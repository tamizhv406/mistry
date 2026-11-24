import React, { useState, useMemo } from 'react';
import { Grid3X3, Box, Layers, Save, Settings2, ShieldCheck } from 'lucide-react';
import type { LengthUnit, MaterialRateItem, SavedBuildingCalculation } from '../../domain/buildingCalculator/types';
import { calculateFlooring, type FlooringCalculatorInputs } from '../../domain/buildingCalculator/flooringCalculations';
import { getSandSpecByCategory } from '../../domain/buildingCalculator/sandClassification';
import { SandSelector } from './SandSelector';
import { CalculatorSection, InputField, SelectField } from './CalculatorUIComponents';
import { QuantityTakeoffPanel, type TakeoffMaterialItem } from './QuantityTakeoffPanel';

interface FlooringCalculatorPanelProps {
  rates: MaterialRateItem[];
  onSaveCalculation: (calc: SavedBuildingCalculation) => void;
  siteId?: string;
  siteName?: string;
}

export const FlooringCalculatorPanel: React.FC<FlooringCalculatorPanelProps> = ({
  rates,
  onSaveCalculation,
  siteId,
  siteName,
}) => {
  const [name, setName] = useState('Living & Bedroom Flooring');
  const [roomLength, setRoomLength] = useState(5.0);
  const [roomWidth, setRoomWidth] = useState(4.0);
  const [unit, setUnit] = useState<LengthUnit>('m');
  const [roomCount, setRoomCount] = useState(2);

  // Preset Tile sizes
  const [tilePreset, setTilePreset] = useState<'600x600' | '1200x600' | '800x800' | '300x300' | 'custom'>('600x600');
  const [tileWidthMm, setTileWidthMm] = useState(600);
  const [tileLengthMm, setTileLengthMm] = useState(600);
  const [tilesPerBox, setTilesPerBox] = useState(4);
  const [tileWastagePercent, setTileWastagePercent] = useState(8);

  // Screed & Adhesive
  const [screedMethod, setScreedMethod] = useState<FlooringCalculatorInputs['screedMethod']>('sand_cement_bed');
  const [screedThicknessMm, setScreedThicknessMm] = useState(40);
  const [screedMortarRatio, setScreedMortarRatio] = useState({ cementParts: 1, sandParts: 5 });
  const [groutJointMm, setGroutJointMm] = useState(2);
  const [labourCost, setLabourCost] = useState(3800);

  const [sandSpec, setSandSpec] = useState(getSandSpecByCategory('masonry_sand'));

  const result = useMemo(() => {
    return calculateFlooring({
      calculationName: name,
      roomLength,
      roomWidth,
      unit,
      roomCount,
      tileWidthMm,
      tileLengthMm,
      tilesPerBox,
      tileWastagePercent,
      screedMethod,
      screedThicknessMm,
      screedMortarRatio,
      groutJointMm,
      sandSpec,
      rates,
      labourCost,
    });
  }, [name, roomLength, roomWidth, unit, roomCount, tileWidthMm, tileLengthMm, tilesPerBox, tileWastagePercent, screedMethod, screedThicknessMm, screedMortarRatio, groutJointMm, sandSpec, rates, labourCost]);

  const handleTilePresetChange = (preset: typeof tilePreset) => {
    setTilePreset(preset);
    if (preset === '600x600') {
      setTileWidthMm(600);
      setTileLengthMm(600);
      setTilesPerBox(4);
    } else if (preset === '1200x600') {
      setTileWidthMm(600);
      setTileLengthMm(1200);
      setTilesPerBox(2);
    } else if (preset === '800x800') {
      setTileWidthMm(800);
      setTileLengthMm(800);
      setTilesPerBox(3);
    } else if (preset === '300x300') {
      setTileWidthMm(300);
      setTileLengthMm(300);
      setTilesPerBox(10);
    }
  };

  const handleSave = () => {
    const item: SavedBuildingCalculation = {
      id: `calc_flooring_${Date.now()}`,
      userId: 'current_user',
      siteId,
      siteName,
      name: name || 'Flooring Calculation',
      module: 'flooring',
      date: new Date().toISOString().slice(0, 10),
      inputs: { roomLength, roomWidth, unit, roomCount, tileWidthMm, tileLengthMm, tilesPerBox, screedMethod },
      result,
      ratesUsedSnapshot: rates,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    onSaveCalculation(item);
  };

  return (
    <div className="bm-calc-workspace-grid">
      {/* Left Input Column */}
      <div className="bm-input-column">
        {/* Section 1: Room Dimensions */}
        <CalculatorSection
          title="1. Room & Floor Area"
          subtitle="Length, width, and number of identical rooms"
          icon={<Grid3X3 size={16} className="text-teal-600" />}
          badge={`${result.floorAreaSqM} m² Total`}
          badgeTone="green"
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
            />

            <div className="grid grid-cols-3 gap-3">
              <InputField
                label="Room Length"
                type="number"
                step={0.1}
                unitAddon={unit}
                value={roomLength}
                onChange={(e) => setRoomLength(parseFloat(e.target.value) || 0)}
              />

              <InputField
                label="Room Width"
                type="number"
                step={0.1}
                unitAddon={unit}
                value={roomWidth}
                onChange={(e) => setRoomWidth(parseFloat(e.target.value) || 0)}
              />

              <InputField
                label="Similar Rooms Count"
                type="number"
                min={1}
                unitAddon="rooms"
                value={roomCount}
                onChange={(e) => setRoomCount(Math.max(1, parseInt(e.target.value) || 1))}
              />
            </div>
          </div>
        </CalculatorSection>

        {/* Section 2: Tile Selection & Packaging */}
        <CalculatorSection
          title="2. Tile Sizing & Box Packaging"
          subtitle="Tile format presets, tiles per box packaging, and perimeter cut wastage"
          icon={<Box size={16} className="text-teal-600" />}
        >
          <div className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: '600x600', label: '600 × 600 mm (2×2 ft)' },
                { id: '1200x600', label: '1200 × 600 mm (4×2 ft)' },
                { id: '800x800', label: '800 × 800 mm' },
                { id: '300x300', label: '300 × 300 mm (Bath)' },
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleTilePresetChange(p.id as any)}
                  className={`py-2 px-2 rounded-xl border text-xs font-semibold text-center transition-all ${
                    tilePreset === p.id
                      ? 'border-teal-600 bg-teal-50/70 dark:bg-teal-950/40 text-teal-900 dark:text-teal-200 ring-1 ring-teal-600'
                      : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-3 pt-1">
              <div className="space-y-1">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">Dimensions</span>
                <div className="flex items-center gap-1.5">
                  <InputField
                    label=""
                    unitAddon="W"
                    type="number"
                    value={tileWidthMm}
                    onChange={(e) => setTileWidthMm(parseInt(e.target.value) || 600)}
                    className="w-16"
                  />
                  <span className="text-slate-400 text-xs font-mono">×</span>
                  <InputField
                    label=""
                    unitAddon="L"
                    type="number"
                    value={tileLengthMm}
                    onChange={(e) => setTileLengthMm(parseInt(e.target.value) || 600)}
                    className="w-16"
                  />
                </div>
              </div>

              <InputField
                label="Tiles / Box"
                type="number"
                min={1}
                unitAddon="pcs"
                value={tilesPerBox}
                onChange={(e) => setTilesPerBox(Math.max(1, parseInt(e.target.value) || 1))}
              />

              <InputField
                label="Cutting Wastage"
                type="number"
                min={3}
                max={15}
                unitAddon="%"
                value={tileWastagePercent}
                onChange={(e) => setTileWastagePercent(parseInt(e.target.value) || 7)}
                helpText="Includes corner cutting, edge cuts and breakage"
              />
            </div>
          </div>
        </CalculatorSection>

        {/* Section 3: Screed & Adhesive */}
        <CalculatorSection
          title="3. Screed Bedding & Tile Adhesive"
          subtitle="Mortar bed underbed thickness or polymer thin-set adhesive"
          icon={<Layers size={16} className="text-indigo-600" />}
        >
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'sand_cement_bed', label: 'Mortar Bed (Standard)' },
                { id: 'thin_set_adhesive', label: 'Thin-set Adhesive' },
                { id: 'bed_plus_adhesive', label: 'Bed + Adhesive Slurry' },
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setScreedMethod(m.id as any)}
                  className={`py-2 px-2.5 rounded-xl border text-xs font-semibold text-center transition-all ${
                    screedMethod === m.id
                      ? 'border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 ring-1 ring-indigo-600'
                      : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {screedMethod !== 'thin_set_adhesive' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <InputField
                  label="Underbed Thickness"
                  type="number"
                  min={20}
                  max={75}
                  unitAddon="mm"
                  value={screedThicknessMm}
                  onChange={(e) => setScreedThicknessMm(parseInt(e.target.value) || 40)}
                  helpText="Standard mortar bedding thickness is 40mm to 50mm"
                />

                <SelectField
                  label="Underbed Mortar Mix"
                  value={screedMortarRatio.sandParts}
                  onChange={(e) => setScreedMortarRatio({ cementParts: 1, sandParts: parseInt(e.target.value) })}
                >
                  <option value="4">1 : 4 (Rich Screed Bed)</option>
                  <option value="5">1 : 5 (Standard Flooring Bed)</option>
                  <option value="6">1 : 6 (Economical Bedding)</option>
                </SelectField>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">Tile Grout Spacer Joint</span>
                  <span className="font-mono font-bold text-teal-600">{groutJointMm} mm</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={5}
                  value={groutJointMm}
                  onChange={(e) => setGroutJointMm(parseInt(e.target.value))}
                  className="w-full accent-teal-600 cursor-pointer"
                />
              </div>
            </div>
          </div>
        </CalculatorSection>

        {/* Section 4: Sand Specification */}
        {screedMethod !== 'thin_set_adhesive' && (
          <CalculatorSection
            title="4. Screed Bedding Sand (Zone III)"
            subtitle="Sand classification and silt check"
            icon={<ShieldCheck size={16} className="text-teal-600" />}
          >
            <SandSelector value={sandSpec} onChange={setSandSpec} targetModule="flooring" />
          </CalculatorSection>
        )}
      </div>

      {/* Right Output & Summary Column */}
      <div className="bm-takeoff-column">
        {(() => {
          const takeoffMaterials: TakeoffMaterialItem[] = [
            {
              id: 'tiles',
              name: `Vitrified / Ceramic Tiles (${tileWidthMm}×${tileLengthMm}mm)`,
              category: 'tile',
              quantity: result.tileBoxesNeeded || Math.ceil(result.tileCountWithWastage / tilesPerBox),
              unit: 'boxes',
              secondaryUnit: `${result.tileCountWithWastage} tiles (${tilesPerBox} pcs/box)`,
              rate: rates.find((r) => r.category === 'tile')?.ratePerUnit || 850,
              subtotal: (result.costs.materialItems.find((i) => i.materialName.toLowerCase().includes('tile'))?.totalCost) || 0,
            },
            ...(result.cementBagsForScreed > 0 ? [{
              id: 'cement',
              name: 'Screed Bedding Cement',
              category: 'cement' as const,
              quantity: result.cementBagsForScreed,
              unit: 'bags',
              secondaryUnit: `${result.cementBagsForScreed * 50} kg OPC`,
              rate: rates.find((r) => r.category === 'cement')?.ratePerUnit || 380,
              subtotal: (result.costs.materialItems.find((i) => i.materialName.toLowerCase().includes('cement'))?.totalCost) || 0,
            }] : []),
            ...(result.sandCFTForScreed > 0 ? [{
              id: 'sand',
              name: 'Screed Bedding Sand (Zone III)',
              category: 'sand' as const,
              quantity: result.sandCFTForScreed,
              unit: 'CFT',
              secondaryUnit: `${(result.sandCFTForScreed / 35.3147).toFixed(2)} m³`,
              rate: rates.find((r) => r.category === 'sand')?.ratePerUnit || 45,
              subtotal: (result.costs.materialItems.find((i) => i.materialName.toLowerCase().includes('sand'))?.totalCost) || 0,
            }] : []),
            ...(result.adhesiveBags20kg > 0 ? [{
              id: 'adhesive',
              name: 'Polymer Tile Adhesive (Type 2)',
              category: 'other' as const,
              quantity: result.adhesiveBags20kg,
              unit: 'bags',
              secondaryUnit: `${result.adhesiveKg} kg (20kg bag)`,
              rate: rates.find((r) => r.category === 'adhesive')?.ratePerUnit || 450,
              subtotal: (result.costs.materialItems.find((i) => i.materialName.toLowerCase().includes('adhesive'))?.totalCost) || 0,
            }] : []),
            {
              id: 'grout',
              name: 'Epoxy / Cementitious Tile Grout',
              category: 'other',
              quantity: result.groutKg,
              unit: 'kg',
              secondaryUnit: `${groutJointMm}mm spacer joints`,
              rate: 120,
              subtotal: (result.costs.materialItems.find((i) => i.materialName.toLowerCase().includes('grout'))?.totalCost) || (result.groutKg * 120),
            },
          ];

          return (
            <QuantityTakeoffPanel
              title="Flooring Takeoff"
              calculationName={name || 'Flooring'}
              volumeOrAreaMetric={{
                primaryValue: `${result.floorAreaSqM} m²`,
                primaryLabel: 'Tiling Surface Area',
                secondaryValue: `${result.floorAreaSqFt} sq.ft`,
                secondaryLabel: screedMethod !== 'thin_set_adhesive' ? `With ${screedThicknessMm}mm bedding screed` : 'Thin-set adhesive fixing',
              }}
              costs={result.costs}
              materials={takeoffMaterials}
              onLabourChange={setLabourCost}
              onSave={handleSave}
              dryFactorNote={`Tile packaging computed at ${tilesPerBox} tiles/box with ${tileWastagePercent}% cutting wastage. Screed bed density: 1800 kg/m³.`}
              assumptions={result.assumptions}
              warnings={result.warnings}
            />
          );
        })()}
      </div>
    </div>
  );
};
