/**
 * Building Mistry — Advanced Building Calculator: Sand Logistics & Bulking Calculator
 * Evaluates sand volume, vehicle loads (tippers/lorries), moisture bulking, and civil suitability.
 */

import type {
  SandCalculationResult,
  MaterialRateItem,
  SandSpecification,
  VolumeUnit,
} from './types';
import {
  m3ToCft,
  cftToM3,
  cftToBrass,
  brassToCft,
  round,
} from './conversions';
import { calculateItemCost, summarizeCalculationCosts, findMaterialRate } from './materialRates';
import { evaluateSandSuitability, calculateBulkingFactor } from './sandClassification';

export interface SandCalculatorInputs {
  calculationName?: string;
  volume: number;
  inputUnit: VolumeUnit;
  sandSpec: SandSpecification;
  moisturePercent?: number;    // e.g. 4% - 8%
  rates?: MaterialRateItem[];
  transportPerVehicleLoad?: number; // per tipper/lorry
  selectedVehicleCapacityCFT?: number; // default 200 CFT or 400 CFT
}

export function calculateSandProcurement(inputs: SandCalculatorInputs): SandCalculationResult {
  const assumptions: string[] = [];
  const warnings: string[] = [];

  let volumeCFT = 0;
  if (inputs.inputUnit === 'cft') {
    volumeCFT = inputs.volume;
  } else if (inputs.inputUnit === 'm3') {
    volumeCFT = m3ToCft(inputs.volume);
  } else if (inputs.inputUnit === 'brass') {
    volumeCFT = brassToCft(inputs.volume);
  }

  volumeCFT = Math.max(0, volumeCFT);
  const volumeM3 = round(cftToM3(volumeCFT), 4);
  const volumeBrass = round(cftToBrass(volumeCFT), 3);

  // Moisture bulking factor
  const moisturePct = inputs.moisturePercent ?? inputs.sandSpec.moisturePercent ?? 0;
  const bulkingFactor = calculateBulkingFactor(moisturePct);
  const bulkingIncreasePct = round((bulkingFactor - 1) * 100, 1);

  if (bulkingIncreasePct > 0) {
    assumptions.push(`Moisture content: ${moisturePct}% creates ${bulkingIncreasePct}% volumetric bulking. Nominal volume must be compensated.`);
  }

  // Weight estimation
  const density = inputs.sandSpec.densityKgPerM3 || 1600;
  const weightKg = volumeM3 * density;
  const estimatedWeightTonnes = round(weightKg / 1000, 2);

  // Vehicle Load Dispatch
  const tipperLoads200Cft = round(volumeCFT / 200, 1);
  const lorryLoads400Cft = round(volumeCFT / 400, 1);
  const heavyTruckLoads600Cft = round(volumeCFT / 600, 1);

  assumptions.push(`Logistics breakdown: ${tipperLoads200Cft} Mini-Tippers (200 CFT), or ${lorryLoads400Cft} Standard Lorries (400 CFT), or ${heavyTruckLoads600Cft} 10-Wheeler Trucks (600 CFT).`);

  // Sand Suitability & Trade Descriptors Check
  const suitability = evaluateSandSuitability(inputs.sandSpec, 'sand');
  suitability.warnings.forEach(w => warnings.push(w));
  suitability.alerts.forEach(a => warnings.push(`[MANDATORY SAND ALERT]: ${a}`));

  // Costing
  const rateCatalog = inputs.rates || [];
  const sandRate = findMaterialRate(rateCatalog, 'sand') || {
    id: 'default-sand',
    name: 'Fine / Coarse Sand',
    category: 'sand',
    unit: 'cft',
    ratePerUnit: 50,
    transportPerUnit: 6,
    taxPercent: 5,
    effectiveDate: new Date().toISOString(),
  };

  const sandCost = calculateItemCost(sandRate, volumeCFT, 'CFT');
  const costs = summarizeCalculationCosts([sandCost], 0);

  return {
    module: 'sand',
    calculationName: inputs.calculationName || 'Sand Logistics Calculation',
    timestamp: new Date().toISOString(),
    grossVolumeM3: volumeM3,
    grossVolumeCFT: round(volumeCFT, 2),
    deductionVolumeM3: 0,
    deductionVolumeCFT: 0,
    netVolumeM3: volumeM3,
    netVolumeCFT: round(volumeCFT, 2),
    netVolumeBrass: volumeBrass,
    wastagePercent: 0,
    totalVolumeWithWastageM3: volumeM3,
    totalVolumeWithWastageCFT: round(volumeCFT, 2),
    bulkVolumeCFT: round(volumeCFT, 2),
    bulkVolumeM3: volumeM3,
    bulkVolumeBrass: volumeBrass,
    tipperLoads200Cft,
    lorryLoads400Cft,
    heavyTruckLoads600Cft,
    estimatedWeightTonnes,
    moistureAdjustmentAppliedPercent: bulkingIncreasePct,
    costs,
    assumptions,
    warnings,
    engineerApprovalRequired: suitability.unsuitable,
  };
}

