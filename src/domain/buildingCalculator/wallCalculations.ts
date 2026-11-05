/**
 * Building Mistry — Advanced Building Calculator: Wall & Masonry Calculations
 * Implements strict civil quantity surveying for brickwork, blockwork and mortar.
 */

import type {
  WallCalculationResult,
  OpeningDeduction,
  MaterialRateItem,
  LengthUnit,
  SandSpecification,
} from './types';
import {
  toMetres,
  m3ToCft,
  cftToBrass,
  round,
  ceilPurchase,
  cementKgToBags,
} from './conversions';
import {
  CEMENT_BAG_KG,
  CEMENT_DENSITY_KG_PER_M3,
  DEFAULT_DRY_MORTAR_FACTOR,
  STANDARD_MODULAR_BRICK,
  TRADITIONAL_COUNTRY_BRICK,
  FLY_ASH_BRICK,
  STANDARD_AAC_BLOCK_6INCH,
} from './units';
import {
  validatePositiveDimension,
  validateOpeningDeductions,
  validateWastagePercentage,
  validateMixProportions,
} from './validation';
import { calculateItemCost, summarizeCalculationCosts, findMaterialRate } from './materialRates';
import { evaluateSandSuitability } from './sandClassification';

export interface WallCalculatorInputs {
  calculationName?: string;
  length: number;
  height: number;
  thickness: number;
  unit: LengthUnit;
  wallCount: number;

  masonryType?: 'modular_brick' | 'traditional_brick' | 'fly_ash_brick' | 'aac_block' | 'custom';
  unitType?: 'modular_brick' | 'country_brick' | 'traditional_brick' | 'fly_ash_brick' | 'aac_block' | 'aac_block_200' | 'aac_block_150' | 'aac_block_100' | 'custom';
  customUnitDimensionsMm?: {
    lengthMm: number;
    widthMm: number;
    heightMm: number;
  };
  mortarJointThicknessMm: number; // typically 10 mm (or 3 mm for AAC adhesive)

  // Mortar mix: Cement:Sand (e.g. 1:4, 1:5, 1:6)
  cementParts?: number;
  sandParts?: number;
  mortarRatio?: { cementParts: number; sandParts: number };

  openings: OpeningDeduction[];
  wastagePercent: number; // e.g. 5%

  sandSpec?: SandSpecification;
  rates?: MaterialRateItem[];
  labourCost?: number;
}

export function calculateWallMasonry(inputs: WallCalculatorInputs): WallCalculationResult {
  const assumptions: string[] = [];
  const warnings: string[] = [];

  // 1. Validate inputs
  const count = Math.max(1, Math.floor(inputs.wallCount || 1));
  const lM = toMetres(inputs.length, inputs.unit);
  const hM = toMetres(inputs.height, inputs.unit);
  const tM = toMetres(inputs.thickness, inputs.unit);

  const lCheck = validatePositiveDimension('Wall length', lM);
  if (lCheck.error) warnings.push(lCheck.error);
  const hCheck = validatePositiveDimension('Wall height', hM);
  if (hCheck.error) warnings.push(hCheck.error);
  const tCheck = validatePositiveDimension('Wall thickness', tM);
  if (tCheck.error) warnings.push(tCheck.error);

  const cParts = inputs.cementParts ?? inputs.mortarRatio?.cementParts ?? 1;
  const sParts = inputs.sandParts ?? inputs.mortarRatio?.sandParts ?? 6;
  const mType = inputs.unitType || inputs.masonryType || 'modular_brick';

  const mixCheck = validateMixProportions(cParts, sParts);
  if (!mixCheck.isValid) warnings.push(...mixCheck.errors);

  const wasteCheck = validateWastagePercentage(inputs.wastagePercent);
  if (wasteCheck.error) warnings.push(wasteCheck.error);
  if (wasteCheck.warning) warnings.push(wasteCheck.warning);

  // 2. Gross Geometry
  const grossWallAreaSqM = lM * hM * count;
  const grossWallAreaSqFt = grossWallAreaSqM * 10.7639;
  const grossVolumeM3 = grossWallAreaSqM * tM;

  // 3. Opening Deductions (Doors, Windows, Cutouts)
  let totalOpeningAreaSqM = 0;
  let totalOpeningVolumeM3 = 0;

  for (const op of inputs.openings || []) {
    const opWM = toMetres(op.width, op.unit);
    const opHM = toMetres(op.height, op.unit);
    const opCount = Math.max(1, op.count || 1);
    const opArea = opWM * opHM * opCount;
    totalOpeningAreaSqM += opArea;

    // Use opening depth if specified, else wall thickness
    const opDepthM = op.depth ? toMetres(op.depth, op.unit) : tM;
    totalOpeningVolumeM3 += opArea * opDepthM;
  }

  const opCheck = validateOpeningDeductions(grossWallAreaSqM, totalOpeningAreaSqM);
  if (!opCheck.isValid) warnings.push(...opCheck.errors);
  if (opCheck.warnings.length) warnings.push(...opCheck.warnings);

  // 4. Net Masonry Geometry (Safe from negative values)
  const netWallAreaSqM = Math.max(0, grossWallAreaSqM - totalOpeningAreaSqM);
  const netWallAreaSqFt = netWallAreaSqM * 10.7639;
  const netVolumeM3 = Math.max(0, grossVolumeM3 - totalOpeningVolumeM3);

  // 5. Masonry Unit Geometry & Mortar Joint
  let unitLMm: number;
  let unitWMm: number;
  let unitHMm: number;
  let jointMm = Math.max(0, inputs.mortarJointThicknessMm ?? 10);

  switch (mType) {
    case 'modular_brick':
      unitLMm = STANDARD_MODULAR_BRICK.lengthMm;
      unitWMm = STANDARD_MODULAR_BRICK.widthMm;
      unitHMm = STANDARD_MODULAR_BRICK.heightMm;
      assumptions.push('Standard Modular Brick: 190 mm × 90 mm × 90 mm without mortar.');
      break;
    case 'country_brick':
    case 'traditional_brick':
      unitLMm = TRADITIONAL_COUNTRY_BRICK.lengthMm;
      unitWMm = TRADITIONAL_COUNTRY_BRICK.widthMm;
      unitHMm = TRADITIONAL_COUNTRY_BRICK.heightMm;
      assumptions.push('Traditional Country Clay Brick: 9" × 4.25" × 2.75" (approx 229 mm × 108 mm × 70 mm).');
      break;
    case 'fly_ash_brick':
      unitLMm = FLY_ASH_BRICK.lengthMm;
      unitWMm = FLY_ASH_BRICK.widthMm;
      unitHMm = FLY_ASH_BRICK.heightMm;
      assumptions.push('Standard Fly Ash Brick: 230 mm × 110 mm × 75 mm.');
      break;
    case 'aac_block':
    case 'aac_block_200':
    case 'aac_block_150':
    case 'aac_block_100':
      unitLMm = STANDARD_AAC_BLOCK_6INCH.lengthMm;
      unitWMm = STANDARD_AAC_BLOCK_6INCH.widthMm;
      unitHMm = STANDARD_AAC_BLOCK_6INCH.heightMm;
      if (inputs.mortarJointThicknessMm === undefined) jointMm = 3; // Thin-bed adhesive
      assumptions.push('Standard AAC Block: 400 mm × 150 mm × 200 mm (6" thickness).');
      break;
    case 'custom':
    default:
      unitLMm = inputs.customUnitDimensionsMm?.lengthMm || 228.6;
      unitWMm = inputs.customUnitDimensionsMm?.widthMm || 108.0;
      unitHMm = inputs.customUnitDimensionsMm?.heightMm || 70.0;
      assumptions.push(`Custom Masonry Unit: ${unitLMm} mm × ${unitWMm} mm × ${unitHMm} mm.`);
      break;
  }

  // Convert unit dimensions to metres
  const uLM = unitLMm / 1000.0;
  const uWM = unitWMm / 1000.0;
  const uHM = unitHMm / 1000.0;
  const jM = jointMm / 1000.0;

  // Single unit volumes
  const volUnitWithoutMortarM3 = uLM * uWM * uHM;
  const volUnitWithMortarM3 = (uLM + jM) * (uWM + jM) * (uHM + jM);

  // 6. Brick Quantity Calculation
  const brickCountExact = volUnitWithMortarM3 > 0 ? netVolumeM3 / volUnitWithMortarM3 : 0;
  const wastage = Math.max(0, inputs.wastagePercent || 0);
  const brickCountWithWastage = ceilPurchase(brickCountExact * (1 + wastage / 100.0));

  // 7. Mortar Volume Calculation
  // Total volume occupied by solid bricks alone (without mortar)
  const totalSolidBricksVolumeM3 = brickCountExact * volUnitWithoutMortarM3;
  // Net wet mortar is the actual difference between net masonry space and solid bricks
  const wetMortarVolumeM3 = Math.max(0, netVolumeM3 - totalSolidBricksVolumeM3);

  // Dry mortar volume with 1.33 expansion/shrinkage factor
  const dryMortarVolumeM3 = wetMortarVolumeM3 * DEFAULT_DRY_MORTAR_FACTOR;
  const dryMortarVolumeCFT = m3ToCft(dryMortarVolumeM3);

  assumptions.push(
    `Mortar volume calculated from net masonry volume minus solid brick volume. Dry volume factor applied: ${DEFAULT_DRY_MORTAR_FACTOR} (accounting for sand-cement void filling).`
  );

  // 8. Cement and Sand Separation from Dry Mortar Mix
  const totalParts = cParts + sParts;

  // Cement volume in m3
  const cementVolM3 = totalParts > 0 ? (dryMortarVolumeM3 * cParts) / totalParts : 0;
  // Cement mass in kg (density 1440 kg/m3)
  const cementKgRaw = cementVolM3 * CEMENT_DENSITY_KG_PER_M3;
  const cementKgWithWastage = cementKgRaw * (1 + wastage / 100.0);
  const cementBags50kg = cementKgToBags(cementKgWithWastage, CEMENT_BAG_KG);

  // Sand volume in m3 & CFT
  const sandVolM3Raw = totalParts > 0 ? (dryMortarVolumeM3 * sParts) / totalParts : 0;
  const sandVolM3WithWastage = sandVolM3Raw * (1 + wastage / 100.0);
  const sandVolumeCFT = m3ToCft(sandVolM3WithWastage);
  const sandVolumeBrass = cftToBrass(sandVolumeCFT);

  assumptions.push(
    `Mortar mix ratio 1:${sParts} (Cement:Sand). Wastage of ${wastage}% applied once to final material quantities.`
  );

  // 9. Sand Suitability Check
  if (inputs.sandSpec) {
    const sandEval = evaluateSandSuitability(inputs.sandSpec, 'wall');
    warnings.push(...sandEval.warnings);
    assumptions.push(...sandEval.recommendations);
  }

  // 10. Costing & Rates
  const rates = inputs.rates || [];
  const brickRateItem = findMaterialRate(rates, inputs.masonryType === 'aac_block' ? 'block' : 'brick', 9.5);
  const cementRateItem = findMaterialRate(rates, 'cement', 380);
  const sandRateItem = findMaterialRate(rates, 'sand', 55);

  const brickLineCost = calculateItemCost('Masonry Bricks / Blocks', brickCountWithWastage, brickRateItem);
  const cementLineCost = calculateItemCost('Cement (50kg bags)', ceilPurchase(cementBags50kg), cementRateItem);
  const sandLineCost = calculateItemCost('Masonry Sand (CFT)', round(sandVolumeCFT, 1), sandRateItem);

  const costSummary = summarizeCalculationCosts(
    [brickLineCost, cementLineCost, sandLineCost],
    inputs.labourCost || 0
  );

  return {
    module: 'wall',
    calculationName: inputs.calculationName || 'Wall / Masonry Estimate',
    timestamp: new Date().toISOString(),
    grossVolumeM3: round(grossVolumeM3, 3),
    grossVolumeCFT: round(m3ToCft(grossVolumeM3), 1),
    deductionVolumeM3: round(totalOpeningVolumeM3, 3),
    deductionVolumeCFT: round(m3ToCft(totalOpeningVolumeM3), 1),
    netVolumeM3: round(netVolumeM3, 3),
    netVolumeCFT: round(m3ToCft(netVolumeM3), 1),
    netVolumeBrass: round(cftToBrass(m3ToCft(netVolumeM3)), 2),
    wastagePercent: wastage,
    totalVolumeWithWastageM3: round(netVolumeM3 * (1 + wastage / 100.0), 3),
    totalVolumeWithWastageCFT: round(m3ToCft(netVolumeM3 * (1 + wastage / 100.0)), 1),
    grossWallAreaSqM: round(grossWallAreaSqM, 2),
    grossWallAreaSqFt: round(grossWallAreaSqFt, 1),
    netWallAreaSqM: round(netWallAreaSqM, 2),
    netWallAreaSqFt: round(netWallAreaSqFt, 1),
    brickCountEstimated: Math.round(brickCountExact),
    brickCountWithWastage,
    wetMortarVolumeM3: round(wetMortarVolumeM3, 3),
    dryMortarVolumeM3: round(dryMortarVolumeM3, 3),
    dryMortarVolumeCFT: round(dryMortarVolumeCFT, 1),
    cementBags50kg: round(cementBags50kg, 2),
    cementKg: round(cementKgWithWastage, 1),
    sandVolumeCFT: round(sandVolumeCFT, 1),
    sandVolumeM3: round(sandVolM3WithWastage, 3),
    sandVolumeBrass: round(sandVolumeBrass, 2),
    costs: costSummary,
    assumptions,
    warnings,
    engineerApprovalRequired: false,
  };
}
