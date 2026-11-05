/**
 * Building Mistry — Advanced Building Calculator: Roof / RCC Slab Calculations
 * Strict concrete quantity surveying supporting Approved Mix Design & Nominal Mix modes.
 */

import type {
  SlabCalculationResult,
  OpeningDeduction,
  MaterialRateItem,
  LengthUnit,
  ConcreteDesignMode,
  ApprovedMixDesign,
  NominalMixProportions,
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
  DEFAULT_DRY_CONCRETE_FACTOR,
} from './units';
import {
  validatePositiveDimension,
  validateOpeningDeductions,
  validateWastagePercentage,
} from './validation';
import { calculateItemCost, summarizeCalculationCosts, findMaterialRate } from './materialRates';
import { evaluateSandSuitability } from './sandClassification';

export interface SlabCalculatorInputs {
  calculationName?: string;
  length: number;
  width: number;
  thickness: number;
  unit: LengthUnit;
  slabCount: number;

  cutouts: OpeningDeduction[]; // e.g. Staircase cutouts, plumbing shafts
  wastagePercent: number;     // e.g. 2% to 5%

  concreteDesignMode: ConcreteDesignMode;
  approvedMixDesign?: ApprovedMixDesign;
  nominalMix?: NominalMixProportions;
  concreteGradeName?: string; // e.g. 'M20', 'M25', 'M30'

  sandSpec?: SandSpecification;
  rates?: MaterialRateItem[];
  labourCost?: number;
}

export function calculateRccSlab(inputs: SlabCalculatorInputs): SlabCalculationResult {
  const assumptions: string[] = [];
  const warnings: string[] = [];

  // 1. Validation
  const count = Math.max(1, Math.floor(inputs.slabCount || 1));
  const lM = toMetres(inputs.length, inputs.unit);
  const wM = toMetres(inputs.width, inputs.unit);
  const tM = toMetres(inputs.thickness, inputs.unit);

  const lCheck = validatePositiveDimension('Slab length', lM);
  if (lCheck.error) warnings.push(lCheck.error);
  const wCheck = validatePositiveDimension('Slab width', wM);
  if (wCheck.error) warnings.push(wCheck.error);
  const tCheck = validatePositiveDimension('Slab thickness', tM);
  if (tCheck.error) warnings.push(tCheck.error);

  const wasteCheck = validateWastagePercentage(inputs.wastagePercent);
  if (wasteCheck.error) warnings.push(wasteCheck.error);
  if (wasteCheck.warning) warnings.push(wasteCheck.warning);

  // 2. Gross Geometry
  const grossAreaSqM = lM * wM * count;
  const grossAreaSqFt = grossAreaSqM * 10.7639;
  const grossVolumeM3 = grossAreaSqM * tM;

  // 3. Cutout Deductions (Stairwells, light shafts)
  let totalCutoutAreaSqM = 0;
  let totalCutoutVolumeM3 = 0;

  for (const c of inputs.cutouts || []) {
    const cWM = toMetres(c.width, c.unit);
    const cLM = toMetres(c.height, c.unit); // Length
    const cCount = Math.max(1, c.count || 1);
    const cArea = cWM * cLM * cCount;
    totalCutoutAreaSqM += cArea;

    const cDepthM = c.depth ? toMetres(c.depth, c.unit) : tM;
    totalCutoutVolumeM3 += cArea * cDepthM;
  }

  const cutCheck = validateOpeningDeductions(grossAreaSqM, totalCutoutAreaSqM);
  if (!cutCheck.isValid) warnings.push(...cutCheck.errors);

  // 4. Net Concrete Volume
  const netAreaSqM = Math.max(0, grossAreaSqM - totalCutoutAreaSqM);
  const netAreaSqFt = netAreaSqM * 10.7639;
  const netVolumeM3 = Math.max(0, grossVolumeM3 - totalCutoutVolumeM3);

  const wastage = Math.max(0, inputs.wastagePercent || 0);
  const totalVolumeWithWastageM3 = netVolumeM3 * (1 + wastage / 100.0);
  const totalVolumeWithWastageCFT = m3ToCft(totalVolumeWithWastageM3);

  // 5. Quantities Calculation by Mode
  let cementKg = 0;
  let fineAggKg = 0;
  let coarseAggKg = 0;
  let waterL: number | undefined = undefined;
  let admixtureKg: number | undefined = undefined;
  let engineerApprovalRequired = false;

  if (inputs.concreteDesignMode === 'approved_mix_design') {
    const mix = inputs.approvedMixDesign;
    if (!mix || mix.cementKgPerM3 <= 0) {
      warnings.push(
        'Missing Approved Mix Design data: Please enter the site-approved mix proportions per cubic metre (kg/m3).'
      );
    } else {
      cementKg = totalVolumeWithWastageM3 * mix.cementKgPerM3;
      fineAggKg = totalVolumeWithWastageM3 * mix.fineAggregateKgPerM3;
      coarseAggKg = totalVolumeWithWastageM3 * mix.coarseAggregateKgPerM3;
      if (mix.waterLitresPerM3 && mix.waterLitresPerM3 > 0) {
        waterL = totalVolumeWithWastageM3 * mix.waterLitresPerM3;
      }
      if (mix.admixtureKgPerM3 && mix.admixtureKgPerM3 > 0) {
        admixtureKg = totalVolumeWithWastageM3 * mix.admixtureKgPerM3;
      }
      assumptions.push(
        `Calculated from Approved Mix Design: Cement ${mix.cementKgPerM3} kg/m³, FA ${mix.fineAggregateKgPerM3} kg/m³, CA ${mix.coarseAggregateKgPerM3} kg/m³${mix.designDocRef ? ` (Ref: ${mix.designDocRef})` : ''}.`
      );
    }
  } else {
    // Mode B: Educational Nominal Mix Estimate
    engineerApprovalRequired = true;
    const nominal = inputs.nominalMix || {
      cementParts: 1,
      fineAggregateParts: 1.5,
      coarseAggregateParts: 3,
      waterCementRatio: 0.5,
    };

    warnings.push(
      'CIVIL ENGINEERING DISCLAIMER: INDICATIVE EDUCATIONAL ESTIMATE — NOT AN APPROVED STRUCTURAL MIX DESIGN. Structural concrete must strictly follow the engineer-approved mix design and project specifications (IS 456).'
    );

    // Using standard IS 456 dry concrete shrinkage factor (1.54)
    const dryConcreteVolumeM3 = totalVolumeWithWastageM3 * DEFAULT_DRY_CONCRETE_FACTOR;
    const sumParts = nominal.cementParts + nominal.fineAggregateParts + nominal.coarseAggregateParts;

    if (sumParts > 0) {
      const cementVolM3 = (dryConcreteVolumeM3 * nominal.cementParts) / sumParts;
      cementKg = cementVolM3 * CEMENT_DENSITY_KG_PER_M3;

      const faVolM3 = (dryConcreteVolumeM3 * nominal.fineAggregateParts) / sumParts;
      // Convert FA volume to mass using standard nominal 1650 kg/m3 bulk density
      fineAggKg = faVolM3 * 1650;

      const caVolM3 = (dryConcreteVolumeM3 * nominal.coarseAggregateParts) / sumParts;
      // Convert CA volume to mass using nominal 1500 kg/m3 bulk density
      coarseAggKg = caVolM3 * 1500;

      if (nominal.waterCementRatio) {
        waterL = cementKg * nominal.waterCementRatio;
        assumptions.push(
          `Nominal W/C ratio of ${nominal.waterCementRatio} yields approx ${round(waterL, 0)} L water. Actual batching water must account for aggregate surface moisture and absorption.`
        );
      }
    }

    assumptions.push(
      `Nominal proportion ${nominal.cementParts}:${nominal.fineAggregateParts}:${nominal.coarseAggregateParts} applied to dry volume factor of ${DEFAULT_DRY_CONCRETE_FACTOR}.`
    );
  }

  // 6. Bags and Aggregate CFT Conversions
  const cementBags50kg = cementKgToBags(cementKg, CEMENT_BAG_KG);
  // Convert aggregates to CFT for local procurement
  const fineAggCFT = m3ToCft(fineAggKg / 1650.0);
  const coarseAggCFT = m3ToCft(coarseAggKg / 1500.0);

  // 7. Sand Suitability Check
  if (inputs.sandSpec) {
    const sandEval = evaluateSandSuitability(inputs.sandSpec, 'slab');
    warnings.push(...sandEval.warnings);
    assumptions.push(...sandEval.recommendations);
  }

  // 8. Costing
  const rates = inputs.rates || [];
  const cementRateItem = findMaterialRate(rates, 'cement', 380);
  const sandRateItem = findMaterialRate(rates, 'sand', 55);
  const aggRateItem = findMaterialRate(rates, 'aggregate', 48);

  const cementCost = calculateItemCost('Cement (50kg bags)', ceilPurchase(cementBags50kg), cementRateItem);
  const sandCost = calculateItemCost('Fine Aggregate / M-Sand (CFT)', round(fineAggCFT, 1), sandRateItem);
  const aggCost = calculateItemCost('Coarse Aggregate 20mm (CFT)', round(coarseAggCFT, 1), aggRateItem);

  const costSummary = summarizeCalculationCosts([cementCost, sandCost, aggCost], inputs.labourCost || 0);

  return {
    module: 'slab',
    calculationName: inputs.calculationName || 'Roof / RCC Slab Concrete Estimate',
    timestamp: new Date().toISOString(),
    grossVolumeM3: round(grossVolumeM3, 3),
    grossVolumeCFT: round(m3ToCft(grossVolumeM3), 1),
    deductionVolumeM3: round(totalCutoutVolumeM3, 3),
    deductionVolumeCFT: round(m3ToCft(totalCutoutVolumeM3), 1),
    netVolumeM3: round(netVolumeM3, 3),
    netVolumeCFT: round(m3ToCft(netVolumeM3), 1),
    netVolumeBrass: round(cftToBrass(m3ToCft(netVolumeM3)), 2),
    wastagePercent: wastage,
    totalVolumeWithWastageM3: round(totalVolumeWithWastageM3, 3),
    totalVolumeWithWastageCFT: round(totalVolumeWithWastageCFT, 1),
    slabAreaSqM: round(netAreaSqM, 2),
    slabAreaSqFt: round(netAreaSqFt, 1),
    concreteDesignMode: inputs.concreteDesignMode,
    cementBags50kg: round(cementBags50kg, 2),
    cementKg: round(cementKg, 1),
    fineAggregateCFT: round(fineAggCFT, 1),
    fineAggregateKg: round(fineAggKg, 1),
    coarseAggregateCFT: round(coarseAggCFT, 1),
    coarseAggregateKg: round(coarseAggKg, 1),
    waterLitres: waterL !== undefined ? round(waterL, 1) : undefined,
    admixtureKg: admixtureKg !== undefined ? round(admixtureKg, 2) : undefined,
    costs: costSummary,
    assumptions,
    warnings,
    engineerApprovalRequired,
  };
}
