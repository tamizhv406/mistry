/**
 * Building Mistry — Advanced Building Calculator: Plastering Calculations
 * Implements IS 1200 deduction rules, P-Sand validation, dry volume factor 1.33, and mix ratios.
 */

import type {
  PlasterCalculationResult,
  OpeningDeduction,
  MaterialRateItem,
  LengthUnit,
  SandSpecification,
} from './types';
import {
  toMetres,
  sqMToSqFt,
  m3ToCft,
  cftToBrass,
  round,
  ceilPurchase,
} from './conversions';
import {
  CEMENT_BAG_KG,
  CEMENT_DENSITY_KG_PER_M3,
  DRY_MORTAR_FACTOR,
} from './units';
import {
  validatePositiveDimension,
  validateWastagePercentage,
} from './validation';
import { calculateItemCost, summarizeCalculationCosts, findMaterialRate } from './materialRates';
import { evaluateSandSuitability } from './sandClassification';

export type PlasterSurfaceType = 'internal_wall' | 'external_wall' | 'ceiling';

export interface PlasterCalculatorInputs {
  calculationName?: string;
  surfaceType: PlasterSurfaceType;
  length: number;              // length of wall or room
  heightOrWidth: number;       // wall height or ceiling width
  unit: LengthUnit;
  surfaceCount: number;        // e.g. 4 internal walls or 1 ceiling
  facesCount: number;          // 1 for single side, 2 for both sides (e.g. partition wall)

  thicknessMm: number;         // 6mm (ceiling), 12mm (internal), 15mm/20mm (external)
  mortarRatio: { cementParts: number; sandParts: number }; // e.g. 1:4, 1:6

  openings: OpeningDeduction[];
  applyIS1200Rules: boolean;   // apply IS 1200 Part XII deduction rules

  wastagePercent: number;      // e.g. 10% to 15% (scaffolding drop & rebound)
  sandSpec?: SandSpecification;
  rates?: MaterialRateItem[];
  labourCost?: number;
}

export function calculatePlastering(inputs: PlasterCalculatorInputs): PlasterCalculationResult {
  const assumptions: string[] = [];
  const warnings: string[] = [];

  const count = Math.max(1, Math.floor(inputs.surfaceCount || 1));
  const faces = Math.max(1, Math.floor(inputs.facesCount || 1));
  const lengthM = toMetres(inputs.length, inputs.unit);
  const heightM = toMetres(inputs.heightOrWidth, inputs.unit);
  const thicknessM = (inputs.thicknessMm || 12) / 1000;

  const lCheck = validatePositiveDimension('Surface length', lengthM);
  if (lCheck.error) warnings.push(lCheck.error);
  const hCheck = validatePositiveDimension('Surface height/width', heightM);
  if (hCheck.error) warnings.push(hCheck.error);
  const tCheck = validatePositiveDimension('Plaster thickness', thicknessM);
  if (tCheck.error) warnings.push(tCheck.error);

  const wasteCheck = validateWastagePercentage(inputs.wastagePercent);
  if (wasteCheck.error) warnings.push(wasteCheck.error);
  if (wasteCheck.warning) warnings.push(wasteCheck.warning);

  // Surface description
  if (inputs.surfaceType === 'ceiling') {
    assumptions.push(`Ceiling plastering with ${inputs.thicknessMm} mm neat cement/sand plaster.`);
    if (inputs.thicknessMm > 10) {
      warnings.push('Ceiling plaster thickness exceeds 10mm. Thick ceiling plaster risks debonding; standard RCC ceiling plaster is 6mm to 8mm.');
    }
  } else if (inputs.surfaceType === 'external_wall') {
    assumptions.push(`External wall plastering (${inputs.thicknessMm} mm thick, weather-resistant finish).`);
  } else {
    assumptions.push(`Internal wall plastering (${inputs.thicknessMm} mm thick single coat).`);
  }

  // Gross Surface Area
  const singleFaceAreaSqM = lengthM * heightM * count;
  const grossPlasterAreaSqM = round(singleFaceAreaSqM * faces, 4);
  const grossPlasterAreaSqFt = round(sqMToSqFt(grossPlasterAreaSqM), 2);

  // Openings & Deductions (IS 1200 Part XII Plastering Rules)
  let totalDeductionAreaSqM = 0;
  if (inputs.openings && inputs.openings.length > 0) {
    for (const op of inputs.openings) {
      const opWM = toMetres(op.width, op.unit);
      const opHM = toMetres(op.height, op.unit);
      const singleOpArea = opWM * opHM;
      const opCount = Math.max(1, op.count || 1);
      const combinedOpArea = singleOpArea * opCount;

      if (!inputs.applyIS1200Rules) {
        // Direct geometric deduction per face
        totalDeductionAreaSqM += combinedOpArea * faces;
      } else {
        // IS 1200: Part XII rules
        if (singleOpArea <= 0.5) {
          // Rule 1: <= 0.5 sq.m -> No deduction, no addition for jambs/soffits
          assumptions.push(`Opening '${op.label}' (${round(singleOpArea, 2)} sq.m <= 0.5 sq.m): Under IS 1200, no deduction is made.`);
        } else if (singleOpArea <= 3.0) {
          // Rule 2: 0.5 to 3.0 sq.m -> Deduction for one face only (50% deduction if both faces plastered)
          if (faces >= 2) {
            totalDeductionAreaSqM += combinedOpArea; // Deduct 1 face only out of 2
            assumptions.push(`Opening '${op.label}' (${round(singleOpArea, 2)} sq.m): Under IS 1200, deducted for 1 face only out of 2.`);
          } else {
            totalDeductionAreaSqM += combinedOpArea * 0.5; // 50% deducted
            assumptions.push(`Opening '${op.label}' (${round(singleOpArea, 2)} sq.m): Under IS 1200 single-face plaster, 50% opening area deducted.`);
          }
        } else {
          // Rule 3: > 3.0 sq.m -> Full deduction for both faces, jambs added
          totalDeductionAreaSqM += combinedOpArea * faces;
          assumptions.push(`Opening '${op.label}' (${round(singleOpArea, 2)} sq.m > 3.0 sq.m): Under IS 1200, full opening area deducted.`);
        }
      }
    }
  }

  totalDeductionAreaSqM = round(Math.min(totalDeductionAreaSqM, grossPlasterAreaSqM), 4);
  const netPlasterAreaSqM = round(grossPlasterAreaSqM - totalDeductionAreaSqM, 4);
  const netPlasterAreaSqFt = round(sqMToSqFt(netPlasterAreaSqM), 2);

  // Wet Mortar Volume
  const wetMortarVolumeM3 = round(netPlasterAreaSqM * thicknessM, 4);
  const grossVolumeM3 = round(grossPlasterAreaSqM * thicknessM, 4);
  const grossVolumeCFT = round(m3ToCft(grossVolumeM3), 2);
  const deductionVolumeM3 = round(totalDeductionAreaSqM * thicknessM, 4);
  const deductionVolumeCFT = round(m3ToCft(deductionVolumeM3), 2);
  const netVolumeM3 = wetMortarVolumeM3;
  const netVolumeCFT = round(m3ToCft(netVolumeM3), 2);
  const netVolumeBrass = round(cftToBrass(netVolumeCFT), 3);

  // Dry Mortar Factor (1.33) + Rebound / Wastage
  const wastagePct = Math.max(0, inputs.wastagePercent ?? 12);
  const dryMortarFactor = DRY_MORTAR_FACTOR; // 1.33
  const dryMortarVolumeM3 = round(wetMortarVolumeM3 * dryMortarFactor * (1 + wastagePct / 100), 4);
  const dryMortarVolumeCFT = round(m3ToCft(dryMortarVolumeM3), 2);
  const totalVolumeWithWastageM3 = dryMortarVolumeM3;
  const totalVolumeWithWastageCFT = dryMortarVolumeCFT;

  assumptions.push(`Dry mortar expansion factor: 1.33 applied. Wastage & rebound factor: ${wastagePct}%.`);

  // Sand Suitability Check
  if (inputs.sandSpec) {
    const sandCheck = evaluateSandSuitability(inputs.sandSpec, 'plaster');
    sandCheck.warnings.forEach(w => warnings.push(w));
    sandCheck.alerts.forEach(a => warnings.push(`[MANDATORY SAND ALERT]: ${a}`));
  }

  // Mix Ratio & Material Quantities
  const ratio = inputs.mortarRatio || { cementParts: 1, sandParts: 4 };
  const totalParts = ratio.cementParts + ratio.sandParts;
  assumptions.push(`Mortar mix ratio: 1 : ${ratio.sandParts} (Cement : Sand).`);

  const cementDryVolM3 = (dryMortarVolumeM3 * ratio.cementParts) / totalParts;
  const cementKg = round(cementDryVolM3 * CEMENT_DENSITY_KG_PER_M3, 1);
  const cementBags50kg = ceilPurchase(cementKg / CEMENT_BAG_KG);

  const sandDryVolM3 = (dryMortarVolumeM3 * ratio.sandParts) / totalParts;
  const sandVolumeM3 = round(sandDryVolM3, 4);
  const sandVolumeCFT = round(m3ToCft(sandDryVolM3), 2);
  const sandVolumeBrass = round(cftToBrass(sandVolumeCFT), 3);

  // Costing
  const rateCatalog = inputs.rates || [];
  const cementRate = findMaterialRate(rateCatalog, 'cement') || {
    id: 'default-cement',
    name: 'PPC Plastering Cement 50kg',
    category: 'cement',
    unit: 'bag',
    ratePerUnit: 370,
    transportPerUnit: 15,
    taxPercent: 18,
    effectiveDate: new Date().toISOString(),
  };

  const sandRate = findMaterialRate(rateCatalog, 'sand') || {
    id: 'default-psand',
    name: 'Plastering P-Sand (Zone IV)',
    category: 'sand',
    unit: 'cft',
    ratePerUnit: 52,
    transportPerUnit: 6,
    taxPercent: 5,
    effectiveDate: new Date().toISOString(),
  };

  const cementCost = calculateItemCost(cementRate, cementBags50kg, 'bags');
  const sandCost = calculateItemCost(sandRate, sandVolumeCFT, 'CFT');

  const costs = summarizeCalculationCosts([cementCost, sandCost], inputs.labourCost || 0);

  return {
    module: 'plaster',
    calculationName: inputs.calculationName || 'Plastering Calculation',
    timestamp: new Date().toISOString(),
    grossVolumeM3,
    grossVolumeCFT,
    deductionVolumeM3,
    deductionVolumeCFT,
    netVolumeM3,
    netVolumeCFT,
    netVolumeBrass,
    wastagePercent: wastagePct,
    totalVolumeWithWastageM3,
    totalVolumeWithWastageCFT,
    grossPlasterAreaSqM,
    grossPlasterAreaSqFt,
    netPlasterAreaSqM,
    netPlasterAreaSqFt,
    wetMortarVolumeM3,
    dryMortarVolumeM3,
    dryMortarVolumeCFT,
    cementBags50kg,
    cementKg,
    sandVolumeCFT,
    sandVolumeM3,
    sandVolumeBrass,
    costs,
    assumptions,
    warnings,
    engineerApprovalRequired: false,
  };
}

