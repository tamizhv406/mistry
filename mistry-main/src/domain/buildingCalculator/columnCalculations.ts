/**
 * Building Mistry — Advanced Building Calculator: Column Calculations
 * Strict structural column concrete estimation with height conventions and engineering safety advisories.
 */

import type {
  ColumnCalculationResult,
  MaterialRateItem,
  LengthUnit,
  ConcreteDesignMode,
  ApprovedMixDesign,
  NominalMixProportions,
  SandSpecification,
  StructuralIntersectionConvention,
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
  DEFAULT_DRY_CONCRETE_FACTOR,
} from './units';
import {
  validatePositiveDimension,
  validateWastagePercentage,
} from './validation';
import { calculateItemCost, summarizeCalculationCosts, findMaterialRate } from './materialRates';
import { evaluateSandSuitability } from './sandClassification';

export interface ColumnCalculatorInputs {
  calculationName?: string;
  shape: 'rectangular' | 'circular';
  width: number;              // column width / breadth b (or diameter for circular)
  depth: number;              // column depth D (equal to width for square / circular)
  height: number;             // column height
  unit: LengthUnit;
  columnCount: number;

  heightConvention: 'clear_height_under_beam' | 'floor_to_floor_inclusive';
  beamDepthOverlap?: number;  // if floor-to-floor is specified, deduct beam junction

  wastagePercent: number;     // e.g. 2% to 5%
  concreteDesignMode: ConcreteDesignMode;
  approvedMixDesign?: ApprovedMixDesign;
  nominalMix?: NominalMixProportions;
  concreteGradeName?: string;

  sandSpec?: SandSpecification;
  rates?: MaterialRateItem[];
  labourCost?: number;
}

export function calculateColumnConcrete(inputs: ColumnCalculatorInputs): ColumnCalculationResult {
  const assumptions: string[] = [];
  const warnings: string[] = [];

  const count = Math.max(1, Math.floor(inputs.columnCount || 1));
  const rawHeightM = toMetres(inputs.height, inputs.unit);
  const widthM = toMetres(inputs.width, inputs.unit);
  const depthM = inputs.shape === 'circular' ? widthM : toMetres(inputs.depth, inputs.unit);

  const hCheck = validatePositiveDimension('Column height', rawHeightM);
  if (hCheck.error) warnings.push(hCheck.error);
  const wCheck = validatePositiveDimension('Column width/diameter', widthM);
  if (wCheck.error) warnings.push(wCheck.error);
  if (inputs.shape !== 'circular') {
    const dCheck = validatePositiveDimension('Column depth', depthM);
    if (dCheck.error) warnings.push(dCheck.error);
  }

  const wasteCheck = validateWastagePercentage(inputs.wastagePercent);
  if (wasteCheck.error) warnings.push(wasteCheck.error);
  if (wasteCheck.warning) warnings.push(wasteCheck.warning);

  let effectiveHeightM = rawHeightM;
  let convention: StructuralIntersectionConvention = 'clear_span_exclusive';

  if (inputs.heightConvention === 'clear_height_under_beam') {
    convention = 'clear_span_exclusive';
    assumptions.push('Column height is clear height under beam soffit (prevents double-counting beam junction).');
  } else {
    convention = 'center_to_center_inclusive';
    const beamOverlapM = inputs.beamDepthOverlap ? toMetres(inputs.beamDepthOverlap, inputs.unit) : 0;
    if (beamOverlapM > 0 && beamOverlapM < rawHeightM) {
      effectiveHeightM = rawHeightM - beamOverlapM;
      assumptions.push(`Floor-to-floor height ${round(rawHeightM, 3)} m reduced by beam junction depth ${round(beamOverlapM, 3)} m to effective clear column height ${round(effectiveHeightM, 3)} m.`);
    } else {
      warnings.push('Floor-to-floor column height used without deducting beam depth. Beam calculations must deduct column junction concrete.');
    }
  }

  // Cross-sectional Area
  let csaSqM = 0;
  if (inputs.shape === 'circular') {
    const radiusM = widthM / 2;
    csaSqM = Math.PI * radiusM * radiusM;
    assumptions.push(`Circular column diameter: ${round(widthM * 1000, 0)} mm.`);
  } else {
    csaSqM = widthM * depthM;
    assumptions.push(`Rectangular column cross section: ${round(widthM * 1000, 0)} mm x ${round(depthM * 1000, 0)} mm.`);
  }

  // Volume
  const singleColVolM3 = csaSqM * effectiveHeightM;
  const grossVolumeM3 = round(singleColVolM3 * count, 4);
  const grossVolumeCFT = round(m3ToCft(grossVolumeM3), 2);

  const netVolumeM3 = grossVolumeM3;
  const netVolumeCFT = grossVolumeCFT;
  const netVolumeBrass = round(cftToBrass(netVolumeCFT), 3);

  const wastagePct = Math.max(0, inputs.wastagePercent || 0);
  const totalVolumeWithWastageM3 = round(netVolumeM3 * (1 + wastagePct / 100), 4);
  const totalVolumeWithWastageCFT = round(m3ToCft(totalVolumeWithWastageM3), 2);

  // Critical Safety Disclaimer on Column Steel
  warnings.push('CRITICAL STRUCTURAL SAFETY: Columns are primary load-bearing compression members. Longitudinal main bars and lateral ties/stirrups must strictly follow structural drawings. Never estimate rebar solely by volumetric percentage.');

  // Sand Suitability Check
  if (inputs.sandSpec) {
    const sandCheck = evaluateSandSuitability(inputs.sandSpec, 'column');
    sandCheck.warnings.forEach(w => warnings.push(w));
    sandCheck.alerts.forEach(a => warnings.push(`[MANDATORY SAND ALERT]: ${a}`));
  }

  // Material quantities
  let cementKg = 0;
  let cementBags50kg = 0;
  let fineAggregateKg = 0;
  let fineAggregateCFT = 0;
  let coarseAggregateKg = 0;
  let coarseAggregateCFT = 0;
  let waterLitres: number | undefined;

  let engineerApprovalRequired = false;

  if (inputs.concreteDesignMode === 'approved_mix_design' && inputs.approvedMixDesign) {
    const mix = inputs.approvedMixDesign;
    assumptions.push(`Approved Mix Design applied: Cement ${mix.cementKgPerM3} kg/m³, Sand ${mix.fineAggregateKgPerM3} kg/m³, 20mm Agg ${mix.coarseAggregateKgPerM3} kg/m³.`);
    if (mix.designDocRef) assumptions.push(`Mix Design Ref: ${mix.designDocRef}`);

    cementKg = round(mix.cementKgPerM3 * totalVolumeWithWastageM3, 1);
    cementBags50kg = cementKgToBags(cementKg);

    fineAggregateKg = round(mix.fineAggregateKgPerM3 * totalVolumeWithWastageM3, 1);
    const sandDensity = inputs.sandSpec?.densityKgPerM3 || 1600;
    fineAggregateCFT = round(m3ToCft(fineAggregateKg / sandDensity), 2);

    coarseAggregateKg = round(mix.coarseAggregateKgPerM3 * totalVolumeWithWastageM3, 1);
    const aggDensity = 1500;
    coarseAggregateCFT = round(m3ToCft(coarseAggregateKg / aggDensity), 2);

    if (mix.waterLitresPerM3) {
      waterLitres = round(mix.waterLitresPerM3 * totalVolumeWithWastageM3, 0);
    }
  } else {
    engineerApprovalRequired = true;
    const nominal = inputs.nominalMix || { cementParts: 1, fineAggregateParts: 1.5, coarseAggregateParts: 3 };
    const gradeName = inputs.concreteGradeName || 'M20 (Nominal)';

    warnings.push(`DISCLAIMER: ${gradeName} volumetric ratio (1 : ${nominal.fineAggregateParts} : ${nominal.coarseAggregateParts}) is an educational estimate. IS 456 requires structural mix designs for RCC columns, beams and slabs.`);

    const dryFactor = DEFAULT_DRY_CONCRETE_FACTOR; // 1.54
    const totalDryVolumeM3 = totalVolumeWithWastageM3 * dryFactor;
    const totalParts = nominal.cementParts + nominal.fineAggregateParts + nominal.coarseAggregateParts;

    const cementVolM3 = (totalDryVolumeM3 * nominal.cementParts) / totalParts;
    cementKg = round(cementVolM3 * CEMENT_DENSITY_KG_PER_M3, 1);
    cementBags50kg = ceilPurchase(cementKg / CEMENT_BAG_KG);

    const sandVolM3 = (totalDryVolumeM3 * nominal.fineAggregateParts) / totalParts;
    fineAggregateCFT = round(m3ToCft(sandVolM3), 2);
    fineAggregateKg = round(sandVolM3 * (inputs.sandSpec?.densityKgPerM3 || 1600), 1);

    const aggVolM3 = (totalDryVolumeM3 * nominal.coarseAggregateParts) / totalParts;
    coarseAggregateCFT = round(m3ToCft(aggVolM3), 2);
    coarseAggregateKg = round(aggVolM3 * 1500, 1);

    if (nominal.waterCementRatio) {
      waterLitres = round(cementKg * nominal.waterCementRatio, 0);
    }
  }

  // Costing
  const rateCatalog = inputs.rates || [];
  const cementRate = findMaterialRate(rateCatalog, 'cement') || {
    id: 'default-cement',
    name: 'OPC / PPC Cement 50kg',
    category: 'cement',
    unit: 'bag',
    ratePerUnit: 380,
    transportPerUnit: 15,
    taxPercent: 18,
    effectiveDate: new Date().toISOString(),
  };

  const sandRate = findMaterialRate(rateCatalog, 'sand') || {
    id: 'default-sand',
    name: 'Concrete M-Sand (Zone II)',
    category: 'sand',
    unit: 'cft',
    ratePerUnit: 48,
    transportPerUnit: 6,
    taxPercent: 5,
    effectiveDate: new Date().toISOString(),
  };

  const aggRate = findMaterialRate(rateCatalog, 'aggregate') || {
    id: 'default-agg',
    name: '20mm Coarse Aggregate',
    category: 'aggregate',
    unit: 'cft',
    ratePerUnit: 42,
    transportPerUnit: 6,
    taxPercent: 5,
    effectiveDate: new Date().toISOString(),
  };

  const cementCost = calculateItemCost(cementRate, cementBags50kg, 'bags');
  const sandCost = calculateItemCost(sandRate, fineAggregateCFT, 'CFT');
  const aggCost = calculateItemCost(aggRate, coarseAggregateCFT, 'CFT');

  const costs = summarizeCalculationCosts([cementCost, sandCost, aggCost], inputs.labourCost || 0);

  return {
    module: 'column',
    calculationName: inputs.calculationName || 'RCC Column Calculation',
    timestamp: new Date().toISOString(),
    totalColumnCount: count,
    totalHeightM: round(effectiveHeightM * count, 2),
    grossVolumeM3,
    grossVolumeCFT,
    deductionVolumeM3: 0,
    deductionVolumeCFT: 0,
    netVolumeM3,
    netVolumeCFT,
    netVolumeBrass,
    wastagePercent: wastagePct,
    totalVolumeWithWastageM3,
    totalVolumeWithWastageCFT,
    concreteDesignMode: inputs.concreteDesignMode,
    cementBags50kg,
    cementKg,
    fineAggregateCFT,
    fineAggregateKg,
    coarseAggregateCFT,
    coarseAggregateKg,
    waterLitres,
    intersectionConvention: convention,
    costs,
    assumptions,
    warnings,
    engineerApprovalRequired,
  };
}

