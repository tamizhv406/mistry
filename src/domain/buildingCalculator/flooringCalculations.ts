/**
 * Building Mistry — Advanced Building Calculator: Flooring Calculations
 * Floor tiles, screed mortar underbed, tile adhesive, and epoxy/cementitious grout.
 */

import type {
  FlooringCalculationResult,
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

export interface FlooringCalculatorInputs {
  calculationName?: string;
  roomLength: number;
  roomWidth: number;
  unit: LengthUnit;
  roomCount: number;

  tileWidthMm: number;        // e.g. 600 mm
  tileLengthMm: number;       // e.g. 600 mm or 1200 mm
  tilesPerBox: number;        // e.g. 4 for 600x600, 2 for 1200x600
  tileWastagePercent: number; // e.g. 5% to 10%

  screedMethod: 'sand_cement_bed' | 'thin_set_adhesive' | 'bed_plus_adhesive';
  screedThicknessMm: number;  // e.g. 40mm for mortar bed
  screedMortarRatio: { cementParts: number; sandParts: number }; // e.g. 1:4 to 1:6

  groutJointMm?: number;      // e.g. 2mm or 3mm spacer joint

  sandSpec?: SandSpecification;
  rates?: MaterialRateItem[];
  labourCost?: number;
}

export function calculateFlooring(inputs: FlooringCalculatorInputs): FlooringCalculationResult {
  const assumptions: string[] = [];
  const warnings: string[] = [];

  const count = Math.max(1, Math.floor(inputs.roomCount || 1));
  const lengthM = toMetres(inputs.roomLength, inputs.unit);
  const widthM = toMetres(inputs.roomWidth, inputs.unit);

  const lCheck = validatePositiveDimension('Room length', lengthM);
  if (lCheck.error) warnings.push(lCheck.error);
  const wCheck = validatePositiveDimension('Room width', widthM);
  if (wCheck.error) warnings.push(wCheck.error);

  const tWastageCheck = validateWastagePercentage(inputs.tileWastagePercent);
  if (tWastageCheck.error) warnings.push(tWastageCheck.error);
  if (tWastageCheck.warning) warnings.push(tWastageCheck.warning);

  // Floor Area
  const singleRoomAreaSqM = lengthM * widthM;
  const floorAreaSqM = round(singleRoomAreaSqM * count, 4);
  const floorAreaSqFt = round(sqMToSqFt(floorAreaSqM), 2);

  // Tile Calculations
  const tileWM = Math.max(50, inputs.tileWidthMm || 600) / 1000;
  const tileLM = Math.max(50, inputs.tileLengthMm || 600) / 1000;
  const singleTileAreaSqM = tileWM * tileLM;

  const tileCountExact = round(floorAreaSqM / singleTileAreaSqM, 1);
  const wastagePct = Math.max(0, inputs.tileWastagePercent ?? 7);
  const tileCountWithWastage = Math.ceil(tileCountExact * (1 + wastagePct / 100));

  const tilesPerBox = Math.max(1, Math.floor(inputs.tilesPerBox || 4));
  const tileBoxesNeeded = Math.ceil(tileCountWithWastage / tilesPerBox);

  assumptions.push(`Tile size: ${inputs.tileWidthMm} mm x ${inputs.tileLengthMm} mm (${round(singleTileAreaSqM, 3)} sq.m/tile).`);
  assumptions.push(`Packaging: ${tilesPerBox} tiles/box -> ${tileBoxesNeeded} boxes required (includes ${wastagePct}% cutting allowance).`);

  // Screed Underbed Calculations
  let screedVolumeM3 = 0;
  let screedVolumeCFT = 0;
  let cementBagsForScreed = 0;
  let sandCFTForScreed = 0;

  if (inputs.screedMethod === 'sand_cement_bed' || inputs.screedMethod === 'bed_plus_adhesive') {
    const thickM = Math.max(10, inputs.screedThicknessMm || 40) / 1000;
    screedVolumeM3 = round(floorAreaSqM * thickM, 4);
    screedVolumeCFT = round(m3ToCft(screedVolumeM3), 2);

    const dryScreedM3 = screedVolumeM3 * DRY_MORTAR_FACTOR * 1.05; // 1.33 dry factor + 5% compaction
    const ratio = inputs.screedMortarRatio || { cementParts: 1, sandParts: 5 };
    const totalParts = ratio.cementParts + ratio.sandParts;

    const cementVolM3 = (dryScreedM3 * ratio.cementParts) / totalParts;
    const cementKg = cementVolM3 * CEMENT_DENSITY_KG_PER_M3;
    cementBagsForScreed = ceilPurchase(cementKg / CEMENT_BAG_KG);

    const sandVolM3 = (dryScreedM3 * ratio.sandParts) / totalParts;
    sandCFTForScreed = round(m3ToCft(sandVolM3), 2);

    assumptions.push(`Mortar screed underbed: ${inputs.screedThicknessMm} mm thickness at 1:${ratio.sandParts} mix.`);
  }

  // Tile Adhesive
  let adhesiveKg = 0;
  let adhesiveBags20kg = 0;
  if (inputs.screedMethod === 'thin_set_adhesive' || inputs.screedMethod === 'bed_plus_adhesive') {
    const kgPerSqM = inputs.screedMethod === 'bed_plus_adhesive' ? 3.0 : 5.0; // bed slurry or thin-set
    adhesiveKg = round(floorAreaSqM * kgPerSqM, 1);
    adhesiveBags20kg = Math.ceil(adhesiveKg / 20);
    assumptions.push(`Polymer-modified tile adhesive: ${kgPerSqM} kg/sq.m (${adhesiveBags20kg} bags of 20kg).`);
  }

  // Tile Grout
  const jointMm = inputs.groutJointMm || 2;
  // Grout consumption formula: (L + W) / (L * W) * Joint Width * Tile Thickness * Joint Density (~1.7) * 1.1 wastage
  const approxGroutKgPerSqM = jointMm <= 2 ? 0.30 : 0.50;
  const groutKg = round(floorAreaSqM * approxGroutKgPerSqM, 1);
  assumptions.push(`Tile joint grout (${jointMm} mm spacer): ${approxGroutKgPerSqM} kg/sq.m -> ${groutKg} kg total.`);

  // Sand Suitability Check
  if (inputs.sandSpec && sandCFTForScreed > 0) {
    const sandCheck = evaluateSandSuitability(inputs.sandSpec, 'flooring');
    sandCheck.warnings.forEach(w => warnings.push(w));
    sandCheck.alerts.forEach(a => warnings.push(`[MANDATORY SAND ALERT]: ${a}`));
  }

  // Costing
  const rateCatalog = inputs.rates || [];
  const tileRate = findMaterialRate(rateCatalog, 'tile') || {
    id: 'default-tile',
    name: 'Vitrified Floor Tiles',
    category: 'tile',
    unit: 'sq.ft',
    ratePerUnit: 55,
    transportPerUnit: 2,
    taxPercent: 18,
    effectiveDate: new Date().toISOString(),
  };

  const cementRate = findMaterialRate(rateCatalog, 'cement') || {
    id: 'default-cement',
    name: 'OPC / PPC Cement 50kg',
    category: 'cement',
    unit: 'bag',
    ratePerUnit: 375,
    transportPerUnit: 15,
    taxPercent: 18,
    effectiveDate: new Date().toISOString(),
  };

  const sandRate = findMaterialRate(rateCatalog, 'sand') || {
    id: 'default-sand',
    name: 'Masonry / Screed Sand',
    category: 'sand',
    unit: 'cft',
    ratePerUnit: 48,
    transportPerUnit: 6,
    taxPercent: 5,
    effectiveDate: new Date().toISOString(),
  };

  const adhesiveRate = findMaterialRate(rateCatalog, 'adhesive') || {
    id: 'default-adhesive',
    name: 'Tile Adhesive (20kg Bag)',
    category: 'adhesive',
    unit: 'bag',
    ratePerUnit: 360,
    transportPerUnit: 10,
    taxPercent: 18,
    effectiveDate: new Date().toISOString(),
  };

  const groutRate = findMaterialRate(rateCatalog, 'grout') || {
    id: 'default-grout',
    name: 'Tile Joint Grout (kg)',
    category: 'grout',
    unit: 'kg',
    ratePerUnit: 70,
    transportPerUnit: 0,
    taxPercent: 18,
    effectiveDate: new Date().toISOString(),
  };

  const items = [
    calculateItemCost(tileRate, floorAreaSqFt, 'sq.ft'),
  ];

  if (cementBagsForScreed > 0) {
    items.push(calculateItemCost(cementRate, cementBagsForScreed, 'bags'));
  }
  if (sandCFTForScreed > 0) {
    items.push(calculateItemCost(sandRate, sandCFTForScreed, 'CFT'));
  }
  if (adhesiveBags20kg > 0) {
    items.push(calculateItemCost(adhesiveRate, adhesiveBags20kg, 'bags'));
  }
  if (groutKg > 0) {
    items.push(calculateItemCost(groutRate, groutKg, 'kg'));
  }

  const costs = summarizeCalculationCosts(items, inputs.labourCost || 0);

  return {
    module: 'flooring',
    calculationName: inputs.calculationName || 'Flooring Calculation',
    timestamp: new Date().toISOString(),
    grossVolumeM3: screedVolumeM3,
    grossVolumeCFT: screedVolumeCFT,
    deductionVolumeM3: 0,
    deductionVolumeCFT: 0,
    netVolumeM3: screedVolumeM3,
    netVolumeCFT: screedVolumeCFT,
    netVolumeBrass: round(cftToBrass(screedVolumeCFT), 3),
    wastagePercent: wastagePct,
    totalVolumeWithWastageM3: screedVolumeM3,
    totalVolumeWithWastageCFT: screedVolumeCFT,
    floorAreaSqM,
    floorAreaSqFt,
    tileCountExact,
    tileCountWithWastage,
    tileBoxesNeeded,
    screedVolumeM3,
    screedVolumeCFT,
    cementBagsForScreed,
    sandCFTForScreed,
    adhesiveKg,
    adhesiveBags20kg,
    groutKg,
    costs,
    assumptions,
    warnings,
    engineerApprovalRequired: false,
  };
}

