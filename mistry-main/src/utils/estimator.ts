import { todayKey } from './datetime';
import type {
  AreaUnit,
  ConstructionQuality,
  StructureType,
  ConcreteGrade,
  SteelGrade,
  EstimatedMaterialItem,
  BOQSteelItem,
} from '../db/types';

// Area conversion constants (Standard Indian Real Estate Conversions)
export const SQFT_PER_CENT = 435.6;
export const SQFT_PER_SQM = 10.76391;
export const SQFT_PER_GROUND = 2400.0;

/**
 * Converts any area measurement to square feet
 */
export function toSqFt(value: number, unit: AreaUnit): number {
  if (!value || isNaN(value) || value <= 0) return 0;
  switch (unit) {
    case 'sq.ft':
      return value;
    case 'cent':
      return value * SQFT_PER_CENT;
    case 'sq.m':
      return value * SQFT_PER_SQM;
    case 'ground':
      return value * SQFT_PER_GROUND;
    default:
      return value;
  }
}

/**
 * Converts square feet to a target area unit
 */
export function fromSqFt(sqFt: number, targetUnit: AreaUnit): number {
  if (!sqFt || isNaN(sqFt) || sqFt <= 0) return 0;
  switch (targetUnit) {
    case 'sq.ft':
      return Math.round(sqFt * 100) / 100;
    case 'cent':
      return Math.round((sqFt / SQFT_PER_CENT) * 1000) / 1000;
    case 'sq.m':
      return Math.round((sqFt / SQFT_PER_SQM) * 100) / 100;
    case 'ground':
      return Math.round((sqFt / SQFT_PER_GROUND) * 1000) / 1000;
    default:
      return sqFt;
  }
}

/**
 * Direct conversion between any two area units
 */
export function convertArea(value: number, fromUnit: AreaUnit, toUnit: AreaUnit): number {
  if (fromUnit === toUnit) return value;
  const sqFt = toSqFt(value, fromUnit);
  return fromSqFt(sqFt, toUnit);
}

/**
 * Multi-unit conversion summary object for live unit display ribbon
 */
export interface UnitConversionBreakdown {
  sqFt: number;
  cent: number;
  sqM: number;
  ground: number;
}

export function getAllUnitConversions(value: number, fromUnit: AreaUnit): UnitConversionBreakdown {
  const sqFt = toSqFt(value, fromUnit);
  return {
    sqFt: Math.round(sqFt * 100) / 100,
    cent: Math.round((sqFt / SQFT_PER_CENT) * 1000) / 1000,
    sqM: Math.round((sqFt / SQFT_PER_SQM) * 100) / 100,
    ground: Math.round((sqFt / SQFT_PER_GROUND) * 1000) / 1000,
  };
}

// Material needed per sq.ft of built-up area
export interface EstimationFactors {
  cementBagsPerSqFt: number;
  sandCftPerSqFt: number;
  msandCftPerSqFt: number;
  aggregateCftPerSqFt: number;
  bricksPiecesPerSqFt: number;
  steelKgPerSqFt: number;
  labourRatePerSqFt: number;
}

/**
 * Published planning figures ("thumb rules") for an RCC-framed house in India, per sq.ft of
 * built-up area. `low` and `high` are the range the sources below give; `typical` is the middle.
 *
 * They are for a first budget only. A real quantity comes from the drawings: the two sources
 * do not agree with each other on bricks, which depend on wall thickness (a 9-inch wall takes
 * about twice the bricks of a 4.5-inch wall) and on how many inside walls the plan has.
 */
export const THUMB_RULES = {
  cement: { low: 0.4, typical: 0.45, high: 0.5, unit: 'bags' },
  steel: { low: 3.5, typical: 4, high: 4.5, unit: 'kg' },
  sand: { low: 0.8, typical: 0.9, high: 1, unit: 'cft' },
  aggregate: { low: 1, typical: 1.1, high: 1.2, unit: 'cft' },
  bricks: { low: 5, typical: 8, high: 10, unit: 'pieces' },
} as const;

export const THUMB_RULE_SOURCES = [
  {
    title: 'HouseYog: How to estimate materials for house construction in India',
    url: 'https://www.houseyog.com/blog/construction-material-estimation-india-beginner-boq-guide/',
    gives: 'cement 0.40–0.50 bags, steel 3.5–4.5 kg, sand 0.8–1.0 cft, aggregate 1.0–1.2 cft, bricks 5–5.5 per sq.ft',
  },
  {
    title: 'InfraLens: Cement, sand and steel for a 1000 sq ft house',
    url: 'https://infralens.in/knowledge/cement-sand-steel-for-1000-sqft-house',
    gives: 'cement 0.4 bags, steel 3.5–4.0 kg, sand 0.8 cft, aggregate 1.0 cft per sq.ft; 8,000–10,000 bricks for 1,000 sq.ft',
  },
] as const;

/**
 * When river sand is used for plastering, this share of the sand is taken as river sand and
 * the rest as M-sand. This split is the app's own assumption; it is not from the sources.
 */
export const RIVER_SAND_SHARE = 0.3;

/** Labour rate the calculator starts from (₹ per sq.ft). A starting value to replace with a real quote. */
export const STARTING_LABOUR_RATE: Record<ConstructionQuality, number> = { Economy: 280, Standard: 320, Premium: 360, Custom: 320 };

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * The rates an estimate starts from. The level picks where in each published range the rate
 * is taken: Economy the low end, Standard the middle, Premium the high end.
 */
export function getQualityFactors(quality: ConstructionQuality, includeRiverSand: boolean): EstimationFactors {
  const pick = (r: { low: number; typical: number; high: number }) =>
    quality === 'Economy' ? r.low : quality === 'Premium' ? r.high : r.typical;

  const sand = pick(THUMB_RULES.sand);
  const riverSand = includeRiverSand ? round2(sand * RIVER_SAND_SHARE) : 0;

  return {
    cementBagsPerSqFt: pick(THUMB_RULES.cement),
    sandCftPerSqFt: riverSand,
    msandCftPerSqFt: round2(sand - riverSand),
    aggregateCftPerSqFt: pick(THUMB_RULES.aggregate),
    bricksPiecesPerSqFt: pick(THUMB_RULES.bricks),
    steelKgPerSqFt: pick(THUMB_RULES.steel),
    labourRatePerSqFt: STARTING_LABOUR_RATE[quality] ?? STARTING_LABOUR_RATE.Standard,
  };
}

export interface EstimationParams {
  builtUpSqFt: number;
  floors: number;
  buildingType: string;
  quality: ConstructionQuality;
  structureType: StructureType;
  concreteGrade: ConcreteGrade;
  steelGrade: SteelGrade;
  includeRiverSand: boolean;
  rates: {
    cementPerBag: number;
    sandPerCft: number;
    msandPerCft: number;
    aggregatePerCft: number;
    brickPerPiece: number;
    steelPerKg: number;
    labourPerSqFt?: number;
  };
  supplierInfo?: {
    cementSupplier?: string;
    sandSupplier?: string;
    msandSupplier?: string;
    aggregateSupplier?: string;
    brickSupplier?: string;
    steelSupplier?: string;
    priceDate?: string;
  };
  customFactors?: Partial<EstimationFactors>;
}

export interface EstimationCalculationResult {
  builtUpSqFt: number;
  materials: EstimatedMaterialItem[];
  totalMaterialCost: number;
  estimatedLabourCost: number;
  totalEstimatedCost: number;
  boqSteelSchedule: BOQSteelItem[];
  factorsUsed: EstimationFactors;
  disclaimer: string;
}

export const PRELIMINARY_ESTIMATE_DISCLAIMER =
  'Approximate estimate only. Actual cost may vary. It is worked out from published rule-of-thumb rates, not from drawings. It is not a structural design, an engineer\'s approval or a guaranteed quote, and it must not be used to size foundations, pillars, beams, slabs or steel. Get the real quantities from your engineer\'s drawings before ordering.';

/**
 * Approximate material quantities and cost for a building.
 *
 *   quantity = built-up area (sq.ft) × rate per sq.ft          (rounded to a whole unit)
 *   cost     = quantity × your price
 *   labour   = built-up area × your labour rate per sq.ft
 *
 * The rates come from getQualityFactors (published thumb rules) unless `customFactors`
 * replaces them. Nothing else changes a quantity: the structure type, concrete grade and
 * steel grade are recorded with the estimate but are not multipliers, because the sources
 * give rates for RCC-framed houses only.
 */
export function calculateBuildingEstimate(params: EstimationParams): EstimationCalculationResult {
  const {
    builtUpSqFt,
    quality,
    includeRiverSand,
    rates,
    supplierInfo = {},
    customFactors = {},
  } = params;

  const baseFactors = getQualityFactors(quality, includeRiverSand);
  const factors: EstimationFactors = {
    ...baseFactors,
    ...customFactors,
  };

  const cementQty = Math.round(builtUpSqFt * factors.cementBagsPerSqFt);
  const sandQty = Math.round(builtUpSqFt * factors.sandCftPerSqFt);
  const msandQty = Math.round(builtUpSqFt * factors.msandCftPerSqFt);
  const aggQty = Math.round(builtUpSqFt * factors.aggregateCftPerSqFt);
  const bricksQty = Math.round(builtUpSqFt * factors.bricksPiecesPerSqFt);
  const steelKg = Math.round(builtUpSqFt * factors.steelKgPerSqFt);

  // Materials Array
  const materials: EstimatedMaterialItem[] = [];

  // 1. Cement
  const cementCost = Math.round(cementQty * (rates.cementPerBag || 0));
  materials.push({
    material: 'Cement',
    quantity: cementQty,
    unit: 'Bags',
    rate: rates.cementPerBag,
    estimatedCost: cementCost,
    supplierName: supplierInfo.cementSupplier || 'Market Rate',
    priceDate: supplierInfo.priceDate || todayKey(),
    factorUsed: factors.cementBagsPerSqFt,
    factorUnit: 'bags/sq.ft',
  });

  // 2. River sand (only when some is used)
  if (sandQty > 0) {
    const sandCost = Math.round(sandQty * (rates.sandPerCft || 0));
    materials.push({
      material: 'Sand',
      quantity: sandQty,
      unit: 'CFT',
      rate: rates.sandPerCft,
      estimatedCost: sandCost,
      supplierName: supplierInfo.sandSupplier || 'Govt Depot / Market',
      priceDate: supplierInfo.priceDate || todayKey(),
      factorUsed: factors.sandCftPerSqFt,
      factorUnit: 'cft/sq.ft',
    });
  }

  // 3. M-Sand
  const msandCost = Math.round(msandQty * (rates.msandPerCft || 0));
  materials.push({
    material: 'M-Sand',
    quantity: msandQty,
    unit: 'CFT',
    rate: rates.msandPerCft,
    estimatedCost: msandCost,
    supplierName: supplierInfo.msandSupplier || 'Crusher Quarry',
    priceDate: supplierInfo.priceDate || todayKey(),
    factorUsed: factors.msandCftPerSqFt,
    factorUnit: 'cft/sq.ft',
  });

  // 4. Coarse Aggregate
  const aggCost = Math.round(aggQty * (rates.aggregatePerCft || 0));
  materials.push({
    material: 'Aggregate',
    quantity: aggQty,
    unit: 'CFT',
    rate: rates.aggregatePerCft,
    estimatedCost: aggCost,
    supplierName: supplierInfo.aggregateSupplier || 'Crusher Quarry',
    priceDate: supplierInfo.priceDate || todayKey(),
    factorUsed: factors.aggregateCftPerSqFt,
    factorUnit: 'cft/sq.ft',
  });

  // 5. Bricks / Blocks
  const brickCost = Math.round(bricksQty * (rates.brickPerPiece || 0));
  materials.push({
    material: 'Bricks',
    quantity: bricksQty,
    unit: 'Pieces',
    rate: rates.brickPerPiece,
    estimatedCost: brickCost,
    supplierName: supplierInfo.brickSupplier || 'Brick Works Kiln',
    priceDate: supplierInfo.priceDate || todayKey(),
    factorUsed: factors.bricksPiecesPerSqFt,
    factorUnit: 'pieces/sq.ft',
  });

  // 6. TMT Steel
  const steelCost = Math.round(steelKg * (rates.steelPerKg || 0));
  materials.push({
    material: 'Steel',
    quantity: steelKg,
    unit: 'Kg',
    rate: rates.steelPerKg,
    estimatedCost: steelCost,
    supplierName: supplierInfo.steelSupplier || 'Steel Depot',
    priceDate: supplierInfo.priceDate || todayKey(),
    factorUsed: factors.steelKgPerSqFt,
    factorUnit: 'kg/sq.ft',
  });

  const totalMaterialCost = materials.reduce((acc, m) => acc + m.estimatedCost, 0);

  // Labour: the rate given, including 0 when labour is priced elsewhere.
  const effectiveLabourRate = rates.labourPerSqFt ?? factors.labourRatePerSqFt;
  const estimatedLabourCost = Math.round(builtUpSqFt * effectiveLabourRate);
  const totalEstimatedCost = totalMaterialCost + estimatedLabourCost;

  // A fixed split of the steel total by bar size, kept because estimates saved earlier carry it.
  // It is not a bar bending schedule and not derived from any design: the calculator screen
  // no longer shows it, and new estimates do not store it.
  const boqSteelSchedule: BOQSteelItem[] = [
    {
      diameter: '8 mm (Stirrups / Column ties)',
      weightKg: Math.round(steelKg * 0.15),
      ratePerKg: rates.steelPerKg,
      totalCost: Math.round(steelKg * 0.15 * rates.steelPerKg),
    },
    {
      diameter: '10 mm (Slab top & bottom distribution)',
      weightKg: Math.round(steelKg * 0.25),
      ratePerKg: rates.steelPerKg,
      totalCost: Math.round(steelKg * 0.25 * rates.steelPerKg),
    },
    {
      diameter: '12 mm (Plinth beams & roof beams)',
      weightKg: Math.round(steelKg * 0.30),
      ratePerKg: rates.steelPerKg,
      totalCost: Math.round(steelKg * 0.30 * rates.steelPerKg),
    },
    {
      diameter: '16 mm (Main column longitudinal rebars)',
      weightKg: Math.round(steelKg * 0.20),
      ratePerKg: rates.steelPerKg,
      totalCost: Math.round(steelKg * 0.20 * rates.steelPerKg),
    },
    {
      diameter: '20 mm (Heavy footing / column starter bars)',
      weightKg: Math.round(steelKg * 0.10),
      ratePerKg: rates.steelPerKg,
      totalCost: Math.round(steelKg * 0.10 * rates.steelPerKg),
    },
  ];

  return {
    builtUpSqFt,
    materials,
    totalMaterialCost,
    estimatedLabourCost,
    totalEstimatedCost,
    boqSteelSchedule,
    factorsUsed: factors,
    disclaimer: PRELIMINARY_ESTIMATE_DISCLAIMER,
  };
}
