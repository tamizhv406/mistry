import React from 'react';
import { AlertTriangle, Info, CheckCircle2 } from 'lucide-react';
import type { SandSpecification, SandCategory, SandTradeDescriptor, CalculatorModule } from '../../domain/buildingCalculator/types';
import { evaluateSandSuitability, SAND_CATEGORIES_REGISTRY } from '../../domain/buildingCalculator/sandClassification';

interface SandSelectorProps {
  value: SandSpecification;
  onChange: (spec: SandSpecification) => void;
  targetModule: CalculatorModule;
}

export const SandSelector: React.FC<SandSelectorProps> = ({ value, onChange, targetModule }) => {
  const evaluation = evaluateSandSuitability(value, targetModule);

  const categories: { key: SandCategory; label: string; desc: string }[] = [
    { key: 'm_sand_concrete', label: 'Concrete M-Sand', desc: 'IS 383 Zone II crushed sand for RCC' },
    { key: 'p_sand_plaster', label: 'Plastering P-Sand', desc: 'Zone IV fine sand <= 2.36mm' },
    { key: 'masonry_sand', label: 'Masonry Sand', desc: 'Zone III for brick & blockwork mortar' },
    { key: 'river_sand', label: 'River Sand', desc: 'Natural sand where legally permitted' },
    { key: 'custom_sand', label: 'Custom Sand', desc: 'User specified source & grading' },
  ];

  const descriptors: { key: SandTradeDescriptor; label: string }[] = [
    { key: 'fine', label: 'Fine' },
    { key: 'coarse', label: 'Coarse' },
    { key: 'soft', label: 'Soft (Trade)' },
    { key: 'hard', label: 'Hard (Trade)' },
  ];

  return (
    <div className="bg-slate-50 dark:bg-slate-900/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
          Sand Classification & Grade (IS 383)
        </label>
        {evaluation.isSuitable ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 size={12} /> Suitable for {targetModule.toUpperCase()}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800">
            <AlertTriangle size={12} /> Quality Attention
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <div>
          <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">Engineering Category</label>
          <select
            value={value.category}
            onChange={(e) => {
              const cat = e.target.value as SandCategory;
              const def = SAND_CATEGORIES_REGISTRY[cat];
              onChange({
                ...value,
                category: cat,
                tradeDescriptor: cat === 'p_sand_plaster' ? 'fine' : 'coarse',
                zoneGrading:
                  cat === 'm_sand_concrete'
                    ? 'Zone II'
                    : cat === 'p_sand_plaster'
                    ? 'Zone IV'
                    : cat === 'masonry_sand'
                    ? 'Zone III'
                    : 'Unspecified',
                densityKgPerM3: def.nominalBulkDensityKgPerM3,
              });
            }}
            className="w-full text-xs py-1.5 px-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {categories.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label} ({c.desc})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">Trade Descriptor</label>
          <select
            value={value.tradeDescriptor}
            onChange={(e) => onChange({ ...value, tradeDescriptor: e.target.value as SandTradeDescriptor })}
            className="w-full text-xs py-1.5 px-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {descriptors.map((d) => (
              <option key={d.key} value={d.key}>
                {d.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="text-[11px] text-slate-500 dark:text-slate-400 mb-0.5 block">Zone Grading</label>
          <select
            value={value.zoneGrading || 'Unspecified'}
            onChange={(e) => onChange({ ...value, zoneGrading: e.target.value as any })}
            className="w-full text-xs py-1 px-2 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
          >
            <option value="Zone I">Zone I (Coarse)</option>
            <option value="Zone II">Zone II (RCC Standard)</option>
            <option value="Zone III">Zone III (Masonry)</option>
            <option value="Zone IV">Zone IV (Plastering)</option>
            <option value="Unspecified">Unspecified</option>
          </select>
        </div>

        <div>
          <label className="text-[11px] text-slate-500 dark:text-slate-400 mb-0.5 block">Silt Content %</label>
          <input
            type="number"
            min={0}
            max={20}
            step={0.5}
            value={value.siltContentPercent ?? ''}
            placeholder="e.g. 3%"
            onChange={(e) => onChange({ ...value, siltContentPercent: e.target.value === '' ? undefined : parseFloat(e.target.value) })}
            className="w-full text-xs py-1 px-2 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
          />
        </div>

        <div>
          <label className="text-[11px] text-slate-500 dark:text-slate-400 mb-0.5 block">Moisture Bulking %</label>
          <input
            type="number"
            min={0}
            max={20}
            step={0.5}
            value={value.moisturePercent ?? ''}
            placeholder="e.g. 4%"
            onChange={(e) => onChange({ ...value, moisturePercent: e.target.value === '' ? undefined : parseFloat(e.target.value) })}
            className="w-full text-xs py-1 px-2 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
          />
        </div>
      </div>

      {/* Structured Alerts & Warnings */}
      {evaluation.alerts.length > 0 && (
        <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-lg p-2.5 text-xs text-rose-700 dark:text-rose-300 space-y-1">
          {evaluation.alerts.map((alert, idx) => (
            <div key={idx} className="flex items-start gap-1.5 font-medium">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              <span>{alert}</span>
            </div>
          ))}
        </div>
      )}

      {evaluation.warnings.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-lg p-2.5 text-xs text-amber-800 dark:text-amber-300 space-y-1">
          {evaluation.warnings.map((warn, idx) => (
            <div key={idx} className="flex items-start gap-1.5">
              <Info size={14} className="shrink-0 mt-0.5" />
              <span>{warn}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

