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

// Engineering thumb-rule factors per sq.ft of built-up area
export interface EstimationFactors {
  cementBagsPerSqFt: number;
  sandCftPerSqFt: number;
  msandCftPerSqFt: number;
  aggregateCftPerSqFt: number;
  bricksPiecesPerSqFt: number;
  steelKgPerSqFt: number;
  labourRatePerSqFt: number;
}

export function getQualityFactors(quality: ConstructionQuality, includeRiverSand: boolean): EstimationFactors {
  let cement = 0.42;
  let steel = 3.8;
  let labour = 320;

  switch (quality) {
    case 'Economy':
      cement = 0.38;
      steel = 3.2;
      labour = 280;
      break;
    case 'Standard':
      cement = 0.42;
      steel = 3.8;
      labour = 320;
      break;
    case 'Premium':
      cement = 0.45;
      steel = 4.4;
      labour = 360;
      break;
    case 'Custom':
      cement = 0.42;
      steel = 4.0;
      labour = 320;
      break;
  }

  // If river sand is included, split sand requirement; otherwise 100% M-Sand
  const sandCft = includeRiverSand ? 0.55 : 0.0;
  const msandCft = includeRiverSand ? 1.30 : 1.75;
  const aggregateCft = 0.65;
  const bricks = 20.0;

  return {
    cementBagsPerSqFt: cement,
    sandCftPerSqFt: sandCft,
    msandCftPerSqFt: msandCft,
    aggregateCftPerSqFt: aggregateCft,
    bricksPiecesPerSqFt: bricks,
    steelKgPerSqFt: steel,
    labourRatePerSqFt: labour,
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
  'This calculator provides preliminary material and cost estimates based on standard Indian civil thumb-rules. It is not a substitute for structural design, engineer-approved drawings or a detailed BOQ. Never use this calculator to automatically design structural members (footings, columns, beams, slab thickness, reinforcement diameter/spacing).';

/**
 * Calculates preliminary construction material quantities, itemized costs,
 * steel rebar BOQ distribution, and total preliminary project budget.
 */
export function calculateBuildingEstimate(params: EstimationParams): EstimationCalculationResult {
  const {
    builtUpSqFt,
    quality,
    structureType,
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

  // Adjust for structure type
  let steelMultiplier = 1.0;
  let brickMultiplier = 1.0;
  let cementMultiplier = 1.0;
  let aggMultiplier = 1.0;

  switch (structureType) {
    case 'Load Bearing':
      steelMultiplier = 0.65;
      brickMultiplier = 1.15;
      cementMultiplier = 0.92;
      aggMultiplier = 0.85;
      break;
    case 'Steel Frame':
      steelMultiplier = 1.35;
      brickMultiplier = 0.90;
      cementMultiplier = 0.78;
      aggMultiplier = 0.70;
      break;
    case 'Composite':
      steelMultiplier = 1.10;
      brickMultiplier = 1.0;
      cementMultiplier = 1.0;
      aggMultiplier = 1.0;
      break;
    case 'Framed Structure (RCC)':
    default:
      steelMultiplier = 1.0;
      brickMultiplier = 1.0;
      cementMultiplier = 1.0;
      aggMultiplier = 1.0;
      break;
  }

  // Calculate preliminary quantities
  const cementQty = Math.round(builtUpSqFt * factors.cementBagsPerSqFt * cementMultiplier);
  const sandQty = Math.round(builtUpSqFt * factors.sandCftPerSqFt);
  const msandQty = Math.round(builtUpSqFt * factors.msandCftPerSqFt);
  const aggQty = Math.round(builtUpSqFt * factors.aggregateCftPerSqFt * aggMultiplier);
  const bricksQty = Math.round(builtUpSqFt * factors.bricksPiecesPerSqFt * brickMultiplier);
  const steelKg = Math.round(builtUpSqFt * factors.steelKgPerSqFt * steelMultiplier);

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
    priceDate: supplierInfo.priceDate || new Date().toISOString().slice(0, 10),
    factorUsed: factors.cementBagsPerSqFt,
    factorUnit: 'bags/sq.ft',
  });

  // 2. Sand (if enabled)
  if (includeRiverSand && sandQty > 0) {
    const sandCost = Math.round(sandQty * (rates.sandPerCft || 0));
    materials.push({
      material: 'Sand',
      quantity: sandQty,
      unit: 'CFT',
      rate: rates.sandPerCft,
      estimatedCost: sandCost,
      supplierName: supplierInfo.sandSupplier || 'Govt Depot / Market',
      priceDate: supplierInfo.priceDate || new Date().toISOString().slice(0, 10),
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
    priceDate: supplierInfo.priceDate || new Date().toISOString().slice(0, 10),
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
    priceDate: supplierInfo.priceDate || new Date().toISOString().slice(0, 10),
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
    priceDate: supplierInfo.priceDate || new Date().toISOString().slice(0, 10),
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
    priceDate: supplierInfo.priceDate || new Date().toISOString().slice(0, 10),
    factorUsed: factors.steelKgPerSqFt,
    factorUnit: 'kg/sq.ft',
  });

  const totalMaterialCost = materials.reduce((acc, m) => acc + m.estimatedCost, 0);

  // Labour estimation
  const effectiveLabourRate = rates.labourPerSqFt || factors.labourRatePerSqFt;
  const estimatedLabourCost = Math.round(builtUpSqFt * effectiveLabourRate);
  const totalEstimatedCost = totalMaterialCost + estimatedLabourCost;

  // Engineer-Approved BOQ Steel Schedule distribution
  // Standard Indian Residential RCC distribution
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
