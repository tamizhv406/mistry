import React, { useState, useMemo } from 'react';
import {
  Tag,
  Plus,
  RotateCcw,
  Trash2,
  Edit2,
  Check,
  Search,
  IndianRupee,
  ShieldCheck,
  X,
} from 'lucide-react';
import type { MaterialRateItem } from '../../domain/buildingCalculator/types';
import { DEFAULT_MATERIAL_RATES } from '../../domain/buildingCalculator/materialRates';

interface MaterialRatesPanelProps {
  rates: MaterialRateItem[];
  onUpdateRates: (rates: MaterialRateItem[]) => void;
}

export const MaterialRatesPanel: React.FC<MaterialRatesPanelProps> = ({ rates, onUpdateRates }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [newItem, setNewItem] = useState<Partial<MaterialRateItem>>({
    name: '',
    category: 'custom',
    unit: 'cft',
    ratePerUnit: 0,
    transportPerUnit: 0,
    taxPercent: 18,
    effectiveDate: new Date().toISOString().slice(0, 10),
  });
  const [showAddForm, setShowAddForm] = useState(false);

  const formatINR = (val: number) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 1,
    }).format(val);

  const handleRateChange = (id: string, field: keyof MaterialRateItem, val: any) => {
    const updated = rates.map((r) => (r.id === id ? { ...r, [field]: val } : r));
    onUpdateRates(updated);
  };

  const handleResetDefaults = () => {
    if (window.confirm('Reset all material rates to engineering market standard defaults?')) {
      onUpdateRates(DEFAULT_MATERIAL_RATES);
    }
  };

  const handleAddNewItem = () => {
    if (!newItem.name) return;
    const item: MaterialRateItem = {
      id: `rate_${Date.now()}`,
      name: newItem.name,
      category: (newItem.category as any) || 'custom',
      unit: newItem.unit || 'unit',
      ratePerUnit: newItem.ratePerUnit || 0,
      transportPerUnit: newItem.transportPerUnit || 0,
      taxPercent: newItem.taxPercent ?? 18,
      effectiveDate: newItem.effectiveDate || new Date().toISOString().slice(0, 10),
    };
    onUpdateRates([...rates, item]);
    setShowAddForm(false);
    setNewItem({
      name: '',
      category: 'custom',
      unit: 'cft',
      ratePerUnit: 0,
      transportPerUnit: 0,
      taxPercent: 18,
      effectiveDate: new Date().toISOString().slice(0, 10),
    });
  };

  const handleDeleteItem = (id: string) => {
    onUpdateRates(rates.filter((r) => r.id !== id));
  };

  const filteredRates = useMemo(() => {
    return rates.filter((r) => {
      const matchesCategory = filterCategory === 'all' || r.category === filterCategory;
      const matchesSearch =
        !searchQuery ||
        r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.category.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [rates, filterCategory, searchQuery]);

  const categories = [
    { id: 'all', label: 'All Items', count: rates.length },
    { id: 'cement', label: 'Cement', count: rates.filter((r) => r.category === 'cement').length },
    { id: 'sand', label: 'Sand & Aggregates', count: rates.filter((r) => r.category === 'sand' || r.category === 'aggregate').length },
    { id: 'brick', label: 'Bricks & Blocks', count: rates.filter((r) => r.category === 'brick').length },
    { id: 'tile', label: 'Tiles & Screed', count: rates.filter((r) => r.category === 'tile').length },
    { id: 'adhesive', label: 'Adhesives & Grout', count: rates.filter((r) => r.category === 'adhesive').length },
    { id: 'custom', label: 'Custom', count: rates.filter((r) => r.category === 'custom').length },
  ];

  return (
    <div className="space-y-4">
      {/* ── Top Header / Action Bar ── */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Tag size={18} className="text-indigo-600" />
            Material Rate Master Database
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Single source of truth for base material prices, site transport logistics, and GST percentages.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="text-xs py-1.5 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold flex items-center gap-1.5 transition shadow-2xs"
          >
            <RotateCcw size={13} /> Reset Defaults
          </button>

          <button
            type="button"
            onClick={() => setShowAddForm(!showAddForm)}
            className="text-xs py-1.5 px-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold flex items-center gap-1.5 transition shadow-2xs"
          >
            {showAddForm ? <X size={14} /> : <Plus size={14} />}
            {showAddForm ? 'Cancel' : 'Add Rate Item'}
          </button>
        </div>
      </div>

      {/* ── Add New Rate Form Modal / Expansion ── */}
      {showAddForm && (
        <div className="p-4 sm:p-5 bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900 rounded-2xl space-y-4 shadow-xs">
          <h4 className="text-xs font-bold text-indigo-900 dark:text-indigo-200 uppercase tracking-wider">
            Add New Material Specification
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                Material Name
              </label>
              <input
                type="text"
                placeholder="e.g. M-Sand (Zone II)"
                value={newItem.name}
                onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                className="w-full py-2 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-medium text-slate-800 dark:text-slate-200"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                Category
              </label>
              <select
                value={newItem.category}
                onChange={(e) => setNewItem({ ...newItem, category: e.target.value as any })}
                className="w-full py-2 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-medium text-slate-800 dark:text-slate-200"
              >
                <option value="cement">Cement</option>
                <option value="sand">Sand</option>
                <option value="aggregate">Aggregate</option>
                <option value="brick">Brick / Block</option>
                <option value="tile">Tile</option>
                <option value="adhesive">Adhesive / Grout</option>
                <option value="custom">Custom / Other</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                Unit
              </label>
              <input
                type="text"
                placeholder="e.g. bag, cft, sqft"
                value={newItem.unit}
                onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })}
                className="w-full py-2 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-medium text-slate-800 dark:text-slate-200"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                Base Rate (₹ / unit)
              </label>
              <input
                type="number"
                value={newItem.ratePerUnit || ''}
                onChange={(e) => setNewItem({ ...newItem, ratePerUnit: parseFloat(e.target.value) || 0 })}
                className="w-full py-2 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono font-medium"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                Transport (₹ / unit)
              </label>
              <input
                type="number"
                value={newItem.transportPerUnit || ''}
                onChange={(e) => setNewItem({ ...newItem, transportPerUnit: parseFloat(e.target.value) || 0 })}
                className="w-full py-2 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono font-medium"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                Tax (GST %)
              </label>
              <input
                type="number"
                value={newItem.taxPercent ?? 18}
                onChange={(e) => setNewItem({ ...newItem, taxPercent: parseFloat(e.target.value) || 0 })}
                className="w-full py-2 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono font-medium"
              />
            </div>

            <div className="flex items-end">
              <button
                type="button"
                onClick={handleAddNewItem}
                className="w-full py-2 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition shadow-2xs"
              >
                Save Rate Item
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Filters & Search Bar ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
        <div className="flex flex-wrap items-center gap-1.5">
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setFilterCategory(c.id)}
              className={`text-xs px-3 py-1 rounded-lg font-medium transition flex items-center gap-1.5 ${
                filterCategory === c.id
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              <span>{c.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  filterCategory === c.id ? 'bg-indigo-700 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
                }`}
              >
                {c.count}
              </span>
            </button>
          ))}
        </div>

        <div className="relative min-w-[200px] flex-1 sm:flex-initial">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search material..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* ── Rates Master Table ── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 bg-slate-50/60 dark:bg-slate-800/50">
                <th className="py-3 px-4 font-bold uppercase tracking-wider text-[10px]">Material Description</th>
                <th className="py-3 px-3 font-bold uppercase tracking-wider text-[10px]">Category</th>
                <th className="py-3 px-2 font-bold uppercase tracking-wider text-[10px] text-center">Unit</th>
                <th className="py-3 px-3 font-bold uppercase tracking-wider text-[10px] text-right">Base (₹)</th>
                <th className="py-3 px-3 font-bold uppercase tracking-wider text-[10px] text-right">Transport (₹)</th>
                <th className="py-3 px-2 font-bold uppercase tracking-wider text-[10px] text-center">GST</th>
                <th className="py-3 px-4 font-bold uppercase tracking-wider text-[10px] text-right">Landed Cost</th>
                <th className="py-3 px-3 font-bold uppercase tracking-wider text-[10px] text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredRates.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400 italic">
                    No rate items match your filter criteria.
                  </td>
                </tr>
              ) : (
                filteredRates.map((r) => {
                  const landedUnitCost =
                    r.ratePerUnit * (1 + (r.taxPercent || 0) / 100) + (r.transportPerUnit || 0);
                  const isEditing = editingId === r.id;

                  return (
                    <tr
                      key={r.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-3 px-4 font-bold text-slate-900 dark:text-slate-100">
                        {isEditing ? (
                          <input
                            type="text"
                            value={r.name}
                            onChange={(e) => handleRateChange(r.id, 'name', e.target.value)}
                            className="py-1 px-2 rounded-lg border border-indigo-400 bg-white dark:bg-slate-800 text-xs w-full"
                          />
                        ) : (
                          r.name
                        )}
                      </td>

                      <td className="py-3 px-3">
                        <span className="capitalize text-[10px] uppercase font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                          {r.category}
                        </span>
                      </td>

                      <td className="py-3 px-2 text-center font-mono text-slate-500 uppercase text-[11px]">
                        {r.unit}
                      </td>

                      <td className="py-3 px-3 text-right font-mono">
                        {isEditing ? (
                          <input
                            type="number"
                            value={r.ratePerUnit}
                            onChange={(e) => handleRateChange(r.id, 'ratePerUnit', parseFloat(e.target.value) || 0)}
                            className="py-1 px-2 rounded-lg border border-indigo-400 bg-white dark:bg-slate-800 text-xs w-20 text-right font-mono"
                          />
                        ) : (
                          <span className="font-semibold text-slate-800 dark:text-slate-200">{formatINR(r.ratePerUnit)}</span>
                        )}
                      </td>

                      <td className="py-3 px-3 text-right font-mono">
                        {isEditing ? (
                          <input
                            type="number"
                            value={r.transportPerUnit}
                            onChange={(e) => handleRateChange(r.id, 'transportPerUnit', parseFloat(e.target.value) || 0)}
                            className="py-1 px-2 rounded-lg border border-indigo-400 bg-white dark:bg-slate-800 text-xs w-16 text-right font-mono"
                          />
                        ) : (
                          <span className="text-slate-500">{formatINR(r.transportPerUnit || 0)}</span>
                        )}
                      </td>

                      <td className="py-3 px-2 text-center font-mono text-slate-500">
                        {isEditing ? (
                          <input
                            type="number"
                            value={r.taxPercent}
                            onChange={(e) => handleRateChange(r.id, 'taxPercent', parseFloat(e.target.value) || 0)}
                            className="py-1 px-2 rounded-lg border border-indigo-400 bg-white dark:bg-slate-800 text-xs w-12 text-center font-mono"
                          />
                        ) : (
                          <span>{r.taxPercent}%</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 dark:text-slate-100 text-sm">
                        {formatINR(landedUnitCost)}
                      </td>

                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {isEditing ? (
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              className="p-1 rounded-md text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                              title="Done Editing"
                            >
                              <Check size={14} />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setEditingId(r.id)}
                              className="p-1 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                              title="Edit Rate"
                            >
                              <Edit2 size={13} />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDeleteItem(r.id)}
                            className="p-1 rounded-md text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                            title="Delete"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
