/**
 * Test Suite: Advanced Building Calculator
 * Verifies accuracy, civil engineering constraints, sand classification, mix design,
 * junction conventions, IS 1200 plaster rules, flooring, and BOQ consolidation.
 */

import {
  calculateWallMasonry,
  calculateRccSlab,
  calculateBeamConcrete,
  calculateColumnConcrete,
  calculatePlastering,
  calculateFlooring,
  calculateSandProcurement,
  consolidateBOQ,
  getSandSpecByCategory,
  evaluateSandSuitability,
  calculateBulkingFactor,
  m3ToCft,
  cftToBrass,
  toMetres,
} from '../src/domain/buildingCalculator';

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${msg}`);
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${msg}`);
  }
}

console.log('\n--- ADVANCED BUILDING CALCULATOR TEST SUITE ---\n');

// 1. Unit & Conversions Check
console.log('Test 1: Conversions & Physical Constants');
{
  const oneM3InCft = m3ToCft(1);
  assert(Math.abs(oneM3InCft - 35.3147) < 0.01, `1 m3 = ~35.3147 CFT (got ${oneM3InCft})`);
  const hundredCftInBrass = cftToBrass(100);
  assert(hundredCftInBrass === 1, `100 CFT = 1 Brass (got ${hundredCftInBrass})`);
  const ftToM = toMetres(10, 'ft');
  assert(Math.abs(ftToM - 3.048) < 0.001, `10 ft = 3.048 m (got ${ftToM})`);
}

// 2. Sand Classification & Alerts
console.log('\nTest 2: Sand Classification & Mandatory Suitability Alerts');
{
  const pSand = getSandSpecByCategory('p_sand_plaster');
  assert(pSand.zoneGrading === 'Zone IV', 'P-Sand is Zone IV fine sand');
  assert(pSand.siltContentPercent === 5, 'P-Sand silt content <= 7% (default 5%)');

  // Concrete check with soft sand
  const softSandCheck = evaluateSandSuitability({
    category: 'custom_sand',
    tradeDescriptor: 'soft',
    labReportVerified: false,
  }, 'slab');
  assert(softSandCheck.unsuitable === true, 'Soft unwashed sand flagged as unsuitable for structural slab');
  assert(softSandCheck.alerts.length > 0, 'Mandatory alert generated for soft sand in structural concrete');

  // Moisture bulking
  const bulkingAt5Pct = calculateBulkingFactor(5);
  assert(bulkingAt5Pct > 1.20, `5% moisture produces significant bulking (~${Math.round((bulkingAt5Pct - 1) * 100)}%)`);
}

// 3. Wall / Masonry Calculator
console.log('\nTest 3: Wall / Masonry Calculator (IS Modular Brick)');
{
  const wallResult = calculateWallMasonry({
    length: 5, // 5m
    height: 3, // 3m
    thickness: 0.2, // 200mm (single brick modular)
    unit: 'm',
    wallCount: 1,
    unitType: 'modular_brick',
    mortarJointThicknessMm: 10,
    openings: [
      {
        id: 'door-1',
        label: 'Main Door',
        type: 'door',
        width: 1.0,
        height: 2.1,
        unit: 'm',
        count: 1,
      },
    ],
    mortarRatio: { cementParts: 1, sandParts: 6 },
    wastagePercent: 5,
    sandSpec: getSandSpecByCategory('masonry_sand'),
  });

  assert(wallResult.grossWallAreaSqM === 15, `Gross wall area is 15 sq.m (got ${wallResult.grossWallAreaSqM})`);
  assert(wallResult.deductionVolumeM3 > 0.4, `Opening deduction applied (~0.42 m3, got ${wallResult.deductionVolumeM3})`);
  assert(wallResult.brickCountWithWastage > 1100 && wallResult.brickCountWithWastage < 1500, `Brick count realistic (got ${wallResult.brickCountWithWastage})`);
  assert(wallResult.cementBags50kg >= 1, `Cement bags calculated (got ${wallResult.cementBags50kg})`);
  assert(wallResult.sandVolumeCFT > 0, `Sand volume CFT calculated (got ${wallResult.sandVolumeCFT})`);
  assert(wallResult.costs.overallTotalCost > 0, `Wall cost calculated (got Rs ${wallResult.costs.overallTotalCost})`);
}

// 4. Roof / RCC Slab Calculator (Approved Mix vs Nominal Mix)
console.log('\nTest 4: RCC Slab Calculator');
{
  // Mode A: Approved Mix
  const slabApproved = calculateRccSlab({
    length: 6,
    width: 4,
    thickness: 0.125, // 125mm
    unit: 'm',
    slabCount: 1,
    cutouts: [],
    wastagePercent: 3,
    concreteDesignMode: 'approved_mix_design',
    approvedMixDesign: {
      cementKgPerM3: 380,
      fineAggregateKgPerM3: 680,
      coarseAggregateKgPerM3: 1150,
      waterLitresPerM3: 170,
      designDocRef: 'STR-MIX-M25-01',
    },
    sandSpec: getSandSpecByCategory('m_sand_concrete'),
  });

  assert(slabApproved.slabAreaSqM === 24, `Slab area 24 sq.m (got ${slabApproved.slabAreaSqM})`);
  assert(slabApproved.engineerApprovalRequired === false, 'Approved mix requires no extra approval flag');
  assert(slabApproved.cementBags50kg >= 23, `Cement bags for approved M25 slab (got ${slabApproved.cementBags50kg})`);
  assert(slabApproved.fineAggregateCFT > 0, 'Sand CFT computed');
  assert(slabApproved.coarseAggregateCFT > 0, 'Coarse aggregate CFT computed');

  // Mode B: Nominal Mix (requires disclaimer & flag)
  const slabNominal = calculateRccSlab({
    length: 6,
    width: 4,
    thickness: 0.125,
    unit: 'm',
    slabCount: 1,
    cutouts: [],
    wastagePercent: 3,
    concreteDesignMode: 'nominal_estimate',
    concreteGradeName: 'M20',
    nominalMix: { cementParts: 1, fineAggregateParts: 1.5, coarseAggregateParts: 3 },
  });

  assert(slabNominal.engineerApprovalRequired === true, 'Nominal mix flags engineerApprovalRequired');
  assert(slabNominal.warnings.some(w => w.includes('DISCLAIMER')), 'Nominal mix outputs explicit civil disclaimer');
}

// 5. Beam & Column Calculations (Junctions & Structural Disclaimer)
console.log('\nTest 5: Beam & Column Calculations & Rebar Disclaimers');
{
  const beamResult = calculateBeamConcrete({
    length: 4.5,
    width: 0.23,
    depth: 0.45,
    unit: 'm',
    beamCount: 4,
    intersectionConvention: 'clear_span_exclusive',
    slabJunctionConvention: 'beam_below_slab',
    wastagePercent: 2.5,
    concreteDesignMode: 'nominal_estimate',
    concreteGradeName: 'M20',
    nominalMix: { cementParts: 1, fineAggregateParts: 1.5, coarseAggregateParts: 3 },
    sandSpec: getSandSpecByCategory('m_sand_concrete'),
  });

  assert(beamResult.totalBeamCount === 4, 'Beam count 4');
  assert(beamResult.netVolumeM3 > 1.8 && beamResult.netVolumeM3 < 2.0, `Beam net volume ~1.86 m3 (got ${beamResult.netVolumeM3})`);
  assert(beamResult.warnings.some(w => w.includes('BBS') || w.includes('Steel reinforcement')), 'Beam contains structural rebar BBS advisory');

  const colResult = calculateColumnConcrete({
    shape: 'rectangular',
    width: 0.23,
    depth: 0.38,
    height: 3.0,
    unit: 'm',
    columnCount: 6,
    heightConvention: 'clear_height_under_beam',
    wastagePercent: 3,
    concreteDesignMode: 'nominal_estimate',
    nominalMix: { cementParts: 1, fineAggregateParts: 1.5, coarseAggregateParts: 3 },
    sandSpec: getSandSpecByCategory('m_sand_concrete'),
  });

  assert(colResult.totalColumnCount === 6, 'Column count 6');
  assert(colResult.warnings.some(w => w.includes('CRITICAL STRUCTURAL SAFETY')), 'Column contains mandatory structural safety advisory');
}

// 6. Plastering Calculator & IS 1200 Rules
console.log('\nTest 6: Plastering Calculator & IS 1200 Deduction Rules');
{
  const plasterResult = calculatePlastering({
    surfaceType: 'internal_wall',
    length: 5,
    heightOrWidth: 3,
    unit: 'm',
    surfaceCount: 2,
    facesCount: 1,
    thicknessMm: 12,
    mortarRatio: { cementParts: 1, sandParts: 4 },
    applyIS1200Rules: true,
    openings: [
      { id: 'op1', label: 'Small vent', type: 'window', width: 0.5, height: 0.5, unit: 'm', count: 1 }, // 0.25 sq.m -> <= 0.5 sq.m: 0 deduction
      { id: 'op2', label: 'Window', type: 'window', width: 1.2, height: 1.2, unit: 'm', count: 1 }, // 1.44 sq.m -> 0.5 to 3.0 sq.m: 50% deduction
    ],
    wastagePercent: 10,
    sandSpec: getSandSpecByCategory('p_sand_plaster'),
  });

  assert(plasterResult.grossPlasterAreaSqM === 30, `Gross area 30 sq.m (got ${plasterResult.grossPlasterAreaSqM})`);
  // Deduction for small vent is 0, deduction for window is 1.44 * 0.5 = 0.72 sq.m
  assert(Math.abs(plasterResult.netPlasterAreaSqM - 29.28) < 0.05, `IS 1200 deduction calculated (got ${plasterResult.netPlasterAreaSqM} sq.m)`);
  assert(plasterResult.cementBags50kg >= 2, `Cement bags calculated (got ${plasterResult.cementBags50kg})`);
}

// 7. Flooring Calculator
console.log('\nTest 7: Flooring Calculator');
{
  const floorResult = calculateFlooring({
    roomLength: 4,
    roomWidth: 3,
    unit: 'm',
    roomCount: 2,
    tileWidthMm: 600,
    tileLengthMm: 600,
    tilesPerBox: 4,
    tileWastagePercent: 8,
    screedMethod: 'sand_cement_bed',
    screedThicknessMm: 40,
    screedMortarRatio: { cementParts: 1, sandParts: 5 },
  });

  assert(floorResult.floorAreaSqM === 24, `Floor area 24 sq.m (got ${floorResult.floorAreaSqM})`);
  assert(floorResult.tileBoxesNeeded !== undefined && floorResult.tileBoxesNeeded > 0, `Tile boxes calculated (got ${floorResult.tileBoxesNeeded})`);
  assert(floorResult.cementBagsForScreed >= 4, `Cement for screed calculated (got ${floorResult.cementBagsForScreed})`);
}

// 8. Sand Logistics Calculator
console.log('\nTest 8: Sand Logistics Calculator');
{
  const sandResult = calculateSandProcurement({
    volume: 400,
    inputUnit: 'cft',
    sandSpec: getSandSpecByCategory('m_sand_concrete'),
    moisturePercent: 4,
  });

  assert(sandResult.tipperLoads200Cft === 2, `400 CFT = 2 tippers (got ${sandResult.tipperLoads200Cft})`);
  assert(sandResult.lorryLoads400Cft === 1, `400 CFT = 1 lorry (got ${sandResult.lorryLoads400Cft})`);
  assert(sandResult.estimatedWeightTonnes > 15, `Estimated weight > 15 tonnes (got ${sandResult.estimatedWeightTonnes})`);
}

// 9. BOQ Consolidation & Variance Engine
console.log('\nTest 9: BOQ Consolidation & Actual Variance Engine');
{
  const wall = calculateWallMasonry({
    length: 10,
    height: 3,
    thickness: 0.2,
    unit: 'm',
    wallCount: 1,
    unitType: 'modular_brick',
    mortarJointThicknessMm: 10,
    openings: [],
    mortarRatio: { cementParts: 1, sandParts: 5 },
    wastagePercent: 5,
  });

  const slab = calculateRccSlab({
    length: 10,
    width: 6,
    thickness: 0.125,
    unit: 'm',
    slabCount: 1,
    cutouts: [],
    wastagePercent: 3,
    concreteDesignMode: 'nominal_estimate',
    nominalMix: { cementParts: 1, fineAggregateParts: 1.5, coarseAggregateParts: 3 },
  });

  const boq = consolidateBOQ(
    'Dream Villa Ground Floor',
    [
      { id: 'calc_wall_1', result: wall },
      { id: 'calc_slab_1', result: slab },
    ],
    'site_01',
    'Greenfields Site',
    [
      { name: 'OPC / PPC Cement 50kg', quantityUsed: 40, unit: 'bags' },
    ]
  );

  assert(boq.consolidatedMaterials.length >= 3, `Consolidated items >= 3 (got ${boq.consolidatedMaterials.length})`);
  assert(boq.grandTotal > 0, `Grand total cost > 0 (got Rs ${boq.grandTotal})`);
  assert(boq.actualConsumptionComparison !== undefined, 'Actual consumption comparison generated');
  const cementComp = boq.actualConsumptionComparison?.find(c => c.materialName.includes('Cement'));
  assert(cementComp !== undefined, 'Cement comparison present');
}

console.log(`\n========================================`);
console.log(`TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
console.log(`========================================\n`);

if (failed > 0) {
  process.exit(1);
}

