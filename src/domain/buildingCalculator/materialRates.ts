/**
 * Building Mistry — Advanced Building Calculator: Material Rate Engine
 * Reusable material rates database with transport charges, tax, and historical rate snapshotting.
 */

import type { MaterialRateItem, ItemCostBreakdown, CalculationCostSummary } from './types';

export const DEFAULT_MATERIAL_RATES: MaterialRateItem[] = [
  {
    id: 'mat-cement-50kg',
    name: 'OPC / PPC 53 Grade Cement',
    category: 'cement',
    unit: 'bag',
    ratePerUnit: 380, // INR per 50kg bag
    transportPerUnit: 10,
    taxPercent: 18,
    effectiveDate: '2026-11-01',
    qualityInfo: 'IS 12269 / IS 1489 certified',
    notes: 'Standard 50kg bag with moisture-proof packaging',
  },
  {
    id: 'mat-msand-concrete',
    name: 'Concrete-Grade M-Sand (Zone II)',
    category: 'sand',
    unit: 'cft',
    ratePerUnit: 55, // INR per CFT
    transportPerUnit: 5,
    taxPercent: 5,
    effectiveDate: '2026-11-01',
    qualityInfo: 'IS 383 Zone II washed crushed sand',
    notes: 'High compressive strength concrete fine aggregate',
  },
  {
    id: 'mat-psand-plaster',
    name: 'Plastering P-Sand (Zone IV)',
    category: 'sand',
    unit: 'cft',
    ratePerUnit: 60, // INR per CFT
    transportPerUnit: 5,
    taxPercent: 5,
    effectiveDate: '2026-11-01',
    qualityInfo: 'Double washed sieved below 2.36mm',
    notes: 'Smooth, crack-free plaster finish',
  },
  {
    id: 'mat-masonry-sand',
    name: 'Masonry Sand (Zone III)',
    category: 'sand',
    unit: 'cft',
    ratePerUnit: 50,
    transportPerUnit: 5,
    taxPercent: 5,
    effectiveDate: '2026-11-01',
    qualityInfo: 'Medium crushed sand for brickwork',
    notes: 'Strong bed joint mortar interlock',
  },
  {
    id: 'mat-river-sand',
    name: 'Natural River Sand',
    category: 'sand',
    unit: 'cft',
    ratePerUnit: 110,
    transportPerUnit: 15,
    taxPercent: 5,
    effectiveDate: '2026-11-01',
    qualityInfo: 'Legally permitted natural river bed sand',
    notes: 'Subject to regional quarry availability and environmental transit pass',
  },
  {
    id: 'mat-coarse-agg-20mm',
    name: 'Coarse Aggregate (20mm Blue Metal)',
    category: 'aggregate',
    unit: 'cft',
    ratePerUnit: 48,
    transportPerUnit: 6,
    taxPercent: 5,
    effectiveDate: '2026-11-01',
    qualityInfo: 'Angular crushed granite (IS 383)',
    notes: 'Standard RCC graded stone chips',
  },
  {
    id: 'mat-brick-red-clay',
    name: 'Red Clay Brick (Traditional Country)',
    category: 'brick',
    unit: 'piece',
    ratePerUnit: 9.5, // INR per piece
    transportPerUnit: 1.0,
    taxPercent: 5,
    effectiveDate: '2026-11-01',
    qualityInfo: 'Class I kiln-burnt clay brick, 9" x 4.25" x 2.75"',
    notes: 'Minimum compressive strength 3.5 N/mm2',
  },
  {
    id: 'mat-block-aac-6in',
    name: 'AAC Lightweight Block (6" - 600x200x150mm)',
    category: 'block',
    unit: 'piece',
    ratePerUnit: 65.0,
    transportPerUnit: 3.0,
    taxPercent: 5,
    effectiveDate: '2026-11-01',
    qualityInfo: 'Autoclaved Aerated Concrete Block (IS 2185 Part 3)',
    notes: 'Dry density 550-650 kg/m3',
  },
  {
    id: 'mat-tile-floor-vitrified',
    name: 'Vitrified Floor Tiles (600x600mm / 2x2 ft)',
    category: 'tile',
    unit: 'sq.ft',
    ratePerUnit: 45.0,
    transportPerUnit: 2.0,
    taxPercent: 18,
    effectiveDate: '2026-11-01',
    qualityInfo: 'Double charge / Glazed vitrified tile',
    notes: 'Water absorption < 0.05%',
  },
  {
    id: 'mat-tile-adhesive-20kg',
    name: 'Tile Adhesive (Polymer-Modified C1TE)',
    category: 'adhesive',
    unit: 'bag',
    ratePerUnit: 320.0,
    transportPerUnit: 10.0,
    taxPercent: 18,
    effectiveDate: '2026-11-01',
    qualityInfo: 'IS 15477 Type 1/2 tile adhesive',
    notes: '20kg bag covers approx 40-50 sq.ft at 3mm notch',
  },
  {
    id: 'mat-tile-grout-1kg',
    name: 'Epoxy / Cementitious Tile Grout (1kg)',
    category: 'grout',
    unit: 'kg',
    ratePerUnit: 80.0,
    transportPerUnit: 0.0,
    taxPercent: 18,
    effectiveDate: '2026-11-01',
    qualityInfo: 'Stain resistant antibacterial joint filler',
    notes: 'Covers 30-40 sq.ft depending on joint width (2-3mm)',
  },
];

/**
 * Calculates itemized costs: base material, transport, tax, and total.
 * Flexible overload to accept either (name, qty, rateItem) or (rateItem, qty, unit).
 */
export function calculateItemCost(
  first: string | MaterialRateItem,
  quantity: number,
  third?: MaterialRateItem | string
): ItemCostBreakdown {
  let materialName = 'Material';
  let rateItem: MaterialRateItem;

  if (typeof first === 'string') {
    materialName = first;
    rateItem = (third as MaterialRateItem) || {
      id: 'default',
      name: materialName,
      category: 'custom',
      unit: 'unit',
      ratePerUnit: 0,
      transportPerUnit: 0,
      taxPercent: 0,
      effectiveDate: new Date().toISOString(),
    };
  } else {
    rateItem = first;
    materialName = rateItem.name || 'Material';
  }

  const safeQty = Math.max(0, Number.isFinite(quantity) ? quantity : 0);
  const baseCost = safeQty * rateItem.ratePerUnit;
  const transportCost = safeQty * rateItem.transportPerUnit;
  const taxableAmount = baseCost + transportCost;
  const taxCost = (taxableAmount * rateItem.taxPercent) / 100.0;
  const totalCost = taxableAmount + taxCost;

  return {
    materialName,
    quantity: safeQty,
    unit: rateItem.unit || (typeof third === 'string' ? third : 'unit'),
    unitRate: rateItem.ratePerUnit,
    baseCost,
    transportCost,
    taxCost,
    totalCost,
  };
}

/**
 * Consolidates multiple material line costs into a single summary.
 */
export function summarizeCalculationCosts(
  items: ItemCostBreakdown[],
  labourCost: number = 0
): CalculationCostSummary {
  const safeLabour = Math.max(0, Number.isFinite(labourCost) ? labourCost : 0);
  let totalBase = 0;
  let totalTransport = 0;
  let totalTax = 0;

  for (const it of items) {
    totalBase += it.baseCost;
    totalTransport += it.transportCost;
    totalTax += it.taxCost;
  }

  const overall = totalBase + totalTransport + totalTax + safeLabour;

  return {
    materialItems: items,
    totalMaterialBaseCost: totalBase,
    totalTransportCost: totalTransport,
    totalTaxCost: totalTax,
    labourCost: safeLabour,
    overallTotalCost: overall,
  };
}

/**
 * Helper to look up a rate from a list of rate items with a fallback.
 */
export function findMaterialRate(
  rates: MaterialRateItem[],
  categoryOrId: string,
  fallbackRate: number = 0
): MaterialRateItem {
  const found =
    rates.find(r => r.id === categoryOrId) ||
    rates.find(r => r.category === categoryOrId) ||
    rates.find(r => r.name.toLowerCase().includes(categoryOrId.toLowerCase()));

  if (found) return found;

  // Synthesize fallback
  return {
    id: `custom-${categoryOrId}`,
    name: categoryOrId,
    category: 'custom',
    unit: 'unit',
    ratePerUnit: fallbackRate,
    transportPerUnit: 0,
    taxPercent: 0,
    effectiveDate: new Date().toISOString().slice(0, 10),
  };
}
