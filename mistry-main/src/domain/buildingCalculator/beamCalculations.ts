/**
 * Building Mistry — Advanced Building Calculator: Beam Calculations
 * Structural beam concrete estimation with explicit junction conventions.
 */

import type {
  BeamCalculationResult,
  MaterialRateItem,
  LengthUnit,
  ConcreteDesignMode,
  ApprovedMixDesign,
  NominalMixProportions,
  SandSpecification,
  StructuralIntersectionConvention,
  SlabBeamIntersectionConvention,
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

export interface BeamCalculatorInputs {
  calculationName?: string;
  length: number;             // span length
  width: number;              // beam width / breadth (e.g. 230mm or 9")
  depth: number;              // beam depth / height (e.g. 450mm or 18")
  unit: LengthUnit;
  beamCount: number;

  intersectionConvention: StructuralIntersectionConvention;
  slabJunctionConvention: SlabBeamIntersectionConvention;
  slabThickness?: number;     // for deducting slab overlap if beam is monolithic full depth

  wastagePercent: number;     // e.g. 2% to 5%
  concreteDesignMode: ConcreteDesignMode;
  approvedMixDesign?: ApprovedMixDesign;
  nominalMix?: NominalMixProportions;
  concreteGradeName?: string;

  sandSpec?: SandSpecification;
  rates?: MaterialRateItem[];
  labourCost?: number;
}

export function calculateBeamConcrete(inputs: BeamCalculatorInputs): BeamCalculationResult {
  const assumptions: string[] = [];
  const warnings: string[] = [];

  const count = Math.max(1, Math.floor(inputs.beamCount || 1));
  const spanM = toMetres(inputs.length, inputs.unit);
  const widthM = toMetres(inputs.width, inputs.unit);
  let depthM = toMetres(inputs.depth, inputs.unit);

  const lCheck = validatePositiveDimension('Beam length', spanM);
  if (lCheck.error) warnings.push(lCheck.error);
  const wCheck = validatePositiveDimension('Beam width', widthM);
  if (wCheck.error) warnings.push(wCheck.error);
  const dCheck = validatePositiveDimension('Beam depth', depthM);
  if (dCheck.error) warnings.push(dCheck.error);

  const wasteCheck = validateWastagePercentage(inputs.wastagePercent);
  if (wasteCheck.error) warnings.push(wasteCheck.error);
  if (wasteCheck.warning) warnings.push(wasteCheck.warning);

  // Intersection & Junction handling
  if (inputs.intersectionConvention === 'clear_span_exclusive') {
    assumptions.push('Beam span measured clear between column faces (zero double-counting with columns).');
  } else if (inputs.intersectionConvention === 'center_to_center_inclusive') {
    assumptions.push('Beam length measured center-to-center of columns; ensure column face deductions are considered on site.');
    warnings.push('Center-to-center beam spans include column junction concrete; if columns are also calculated full height, double-counting will occur.');
  } else {
    assumptions.push('Continuous beam modeled full length.');
  }

  let effectiveDepthM = depthM;
  if (inputs.slabJunctionConvention === 'beam_below_slab') {
    assumptions.push('Beam depth is web rib below slab soffit (clean zero-overlap with RCC slab).');
  } else {
    const slabThickM = inputs.slabThickness ? toMetres(inputs.slabThickness, inputs.unit) : 0;
    if (slabThickM > 0 && slabThickM < depthM) {
      effectiveDepthM = depthM - slabThickM;
      assumptions.push(`Monolithic beam depth ${round(depthM * 1000, 0)} mm reduced by slab thickness ${round(slabThickM * 1000, 0)} mm to web depth ${round(effectiveDepthM * 1000, 0)} mm to prevent double-counting slab concrete.`);
    } else {
      warnings.push('Full depth beam specified without slab deduction. Ensure RCC slab calculation excludes beam rib footprint.');
    }
  }

  // Volume calculations
  const singleBeamGrossVolM3 = spanM * widthM * effectiveDepthM;
  const grossVolumeM3 = round(singleBeamGrossVolM3 * count, 4);
  const grossVolumeCFT = round(m3ToCft(grossVolumeM3), 2);

  const netVolumeM3 = grossVolumeM3;
  const netVolumeCFT = grossVolumeCFT;
  const netVolumeBrass = round(cftToBrass(netVolumeCFT), 3);

  const wastagePct = Math.max(0, inputs.wastagePercent || 0);
  const totalVolumeWithWastageM3 = round(netVolumeM3 * (1 + wastagePct / 100), 4);
  const totalVolumeWithWastageCFT = round(m3ToCft(totalVolumeWithWastageM3), 2);

  // Structural rebar safety advisory
  warnings.push('Steel reinforcement quantities are NOT inferred. Steel must strictly follow structural bar bending schedules (BBS) signed by a licensed structural engineer.');

  // Sand Suitability Check
  if (inputs.sandSpec) {
    const sandCheck = evaluateSandSuitability(inputs.sandSpec, 'beam');
    sandCheck.warnings.forEach(w => warnings.push(w));
    sandCheck.alerts.forEach(a => warnings.push(`[MANDATORY SAND ALERT]: ${a}`));
  }

  // Materials Breakdown
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
    module: 'beam',
    calculationName: inputs.calculationName || 'RCC Beam Calculation',
    timestamp: new Date().toISOString(),
    totalBeamCount: count,
    totalLinearLengthM: round(spanM * count, 2),
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
    intersectionConvention: inputs.intersectionConvention,
    costs,
    assumptions,
    warnings,
    engineerApprovalRequired,
  };
}

