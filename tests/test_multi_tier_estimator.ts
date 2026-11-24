/**
 * Test Suite: Multi-Tier Construction Cost Estimator Engine (Phase 2)
 * 
 * Verifies:
 * - 3 Quality Packages: Standard, Premium, Luxury
 * - Rate per sq.ft benchmarks
 * - Section A (Civil Structure) & Section B (Finishing & MEP) BOQ items
 * - Custom rate override reactivity
 * - Percentage share calculations (Structure, Finishing, Labour, MEP)
 * - Milestone payment schedule (20%, 20%, 25%, 15%, 15%, 5%)
 * - WhatsApp quotation generation
 * - PDF quotation generation
 */

import {
  PACKAGE_SPECS,
  getDefaultPackageRates,
  calculateMultiTierEstimate,
  generateWhatsAppQuoteText,
  type PackageType,
} from '../src/domain/buildingCalculator/multiTierEstimator';
import { generateTurnkeyQuotationPdfBlob } from '../src/utils/pdfGenerator';

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

console.log('\n--- MULTI-TIER ESTIMATOR & QUOTATION TEST SUITE (PHASE 2) ---\n');

// 1. Package Specifications & Rates Verification
console.log('Test 1: Quality Packages & Default Rates');
{
  assert(PACKAGE_SPECS.standard !== undefined, 'Standard package specification exists');
  assert(PACKAGE_SPECS.premium !== undefined, 'Premium package specification exists');
  assert(PACKAGE_SPECS.luxury !== undefined, 'Luxury package specification exists');

  const standardRates = getDefaultPackageRates('standard');
  const premiumRates = getDefaultPackageRates('premium');
  const luxuryRates = getDefaultPackageRates('luxury');

  assert(standardRates.cement === 395, `Standard cement rate is 395 (got ${standardRates.cement})`);
  assert(premiumRates.cement === 420, `Premium cement rate is 420 (got ${premiumRates.cement})`);
  assert(luxuryRates.cement === 445, `Luxury cement rate is 445 (got ${luxuryRates.cement})`);

  assert(premiumRates.steel === 74, `Premium steel rate is 74/kg (got ${premiumRates.steel})`);
  assert(premiumRates.msand === 45, `Premium M-Sand rate is 45/cft (got ${premiumRates.msand})`);
  assert(premiumRates.aggregates === 42, `Premium aggregate rate is 42/cft (got ${premiumRates.aggregates})`);
  assert(premiumRates.bricks === 10.5, `Premium brick rate is 10.50/nos (got ${premiumRates.bricks})`);
  assert(premiumRates.structural_labour === 320, `Premium civil labour is 320/sq.ft (got ${premiumRates.structural_labour})`);
}

// 2. 1,000 sq.ft Benchmark Estimates
console.log('\nTest 2: Tamil Nadu Cost / Sq.Ft Benchmarks for 1,000 sq.ft');
{
  const estStandard = calculateMultiTierEstimate(1000, 'standard');
  const estPremium = calculateMultiTierEstimate(1000, 'premium');
  const estLuxury = calculateMultiTierEstimate(1000, 'luxury');

  console.log(`    Standard: ₹${estStandard.costPerSqFt}/sq.ft (Grand Total: ₹${estStandard.grandTotal.toLocaleString('en-IN')})`);
  console.log(`    Premium:  ₹${estPremium.costPerSqFt}/sq.ft (Grand Total: ₹${estPremium.grandTotal.toLocaleString('en-IN')})`);
  console.log(`    Luxury:   ₹${estLuxury.costPerSqFt}/sq.ft (Grand Total: ₹${estLuxury.grandTotal.toLocaleString('en-IN')})`);

  assert(
    estStandard.costPerSqFt >= 1550 && estStandard.costPerSqFt <= 1650,
    `Standard rate is within ₹1,550 – ₹1,650/sq.ft (got ₹${estStandard.costPerSqFt})`
  );
  assert(
    estPremium.costPerSqFt >= 1950 && estPremium.costPerSqFt <= 2100,
    `Premium rate is within ₹1,950 – ₹2,100/sq.ft (got ₹${estPremium.costPerSqFt})`
  );
  assert(
    estLuxury.costPerSqFt >= 2450 && estLuxury.costPerSqFt <= 2800,
    `Luxury rate is within ₹2,450 – ₹2,800/sq.ft (got ₹${estLuxury.costPerSqFt})`
  );
}

// 3. Dual-Tab BOQ Itemized Breakdown Structure
console.log('\nTest 3: Dual-Tab BOQ Itemized Items');
{
  const est = calculateMultiTierEstimate(1000, 'premium');

  assert(est.sectionAItems.length === 6, `Section A has 6 core civil structure items (got ${est.sectionAItems.length})`);
  const itemKeysA = est.sectionAItems.map((i) => i.id);
  assert(itemKeysA.includes('cement'), 'Section A includes cement');
  assert(itemKeysA.includes('steel'), 'Section A includes steel');
  assert(itemKeysA.includes('msand'), 'Section A includes msand');
  assert(itemKeysA.includes('aggregates'), 'Section A includes aggregates');
  assert(itemKeysA.includes('bricks'), 'Section A includes bricks');
  assert(itemKeysA.includes('structural_labour'), 'Section A includes structural_labour');

  assert(est.sectionBItems.length === 7, `Section B has 7 turnkey finishing & MEP items (got ${est.sectionBItems.length})`);
  const itemKeysB = est.sectionBItems.map((i) => i.id);
  assert(itemKeysB.includes('flooring'), 'Section B includes flooring');
  assert(itemKeysB.includes('painting'), 'Section B includes painting');
  assert(itemKeysB.includes('doors'), 'Section B includes doors');
  assert(itemKeysB.includes('windows'), 'Section B includes windows');
  assert(itemKeysB.includes('plumbing_sanitary'), 'Section B includes plumbing_sanitary');
  assert(itemKeysB.includes('electrical'), 'Section B includes electrical');
  assert(itemKeysB.includes('water_infra'), 'Section B includes water_infra');
}

// 4. Reactive Custom Unit Rate Recalculation
console.log('\nTest 4: Reactive Custom Unit Rate Recalculation');
{
  const base = calculateMultiTierEstimate(1000, 'premium');
  // Raise cement by ₹40 (from 420 to 460) -> 480 bags * 40 = ₹19,200 increase
  const overridden = calculateMultiTierEstimate(1000, 'premium', { cement: 460 });

  const diff = overridden.grandTotal - base.grandTotal;
  assert(diff === 19200, `Changing cement rate by ₹40 raises grand total by exactly ₹19,200 (got ₹${diff})`);
  assert(overridden.costPerSqFt > base.costPerSqFt, 'Cost per sq.ft increases with material price rise');
}

// 5. Category Distribution Shares & SVG Donut Chart Slices
console.log('\nTest 5: Category Shares (Structure, Finishing, Labour, MEP)');
{
  const est = calculateMultiTierEstimate(1000, 'premium');
  const pct = est.categoryPercentages;

  console.log(`    Shares: Structure=${pct.structure}%, Finishing=${pct.finishing}%, Labour=${pct.labour}%, MEP=${pct.mep}%`);

  assert(pct.structure >= 45 && pct.structure <= 60, `Structure share is ~50–55% (got ${pct.structure}%)`);
  assert(pct.finishing >= 20 && pct.finishing <= 35, `Finishing share is ~25–30% (got ${pct.finishing}%)`);
  assert(pct.labour >= 12 && pct.labour <= 22, `Labour share is ~15–20% (got ${pct.labour}%)`);
  assert(pct.mep >= 6 && pct.mep <= 15, `MEP share is ~8–12% (got ${pct.mep}%)`);
}

// 6. Contract Milestone Payment Schedule (20%, 20%, 25%, 15%, 15%, 5%)
console.log('\nTest 6: Milestone Payment Terms');
{
  const est = calculateMultiTierEstimate(1000, 'premium');
  assert(est.milestones.length === 6, `Has 6 milestone payment stages (got ${est.milestones.length})`);

  const pctSum = est.milestones.reduce((acc, m) => acc + m.percentage, 0);
  assert(pctSum === 100, `Milestone percentages sum to exactly 100% (got ${pctSum}%)`);

  assert(est.milestones[0].percentage === 20, 'Stage 1 Foundation is 20%');
  assert(est.milestones[1].percentage === 20, 'Stage 2 Lintel is 20%');
  assert(est.milestones[2].percentage === 25, 'Stage 3 Roof Slab is 25%');
  assert(est.milestones[3].percentage === 15, 'Stage 4 Plastering is 15%');
  assert(est.milestones[4].percentage === 15, 'Stage 5 Flooring/MEP/Painting is 15%');
  assert(est.milestones[5].percentage === 5, 'Stage 6 Handover is 5%');

  const amountSum = est.milestones.reduce((acc, m) => acc + m.amount, 0);
  assert(Math.abs(amountSum - est.grandTotal) <= 6, `Milestone amounts sum to Grand Total (diff <= ₹6 rounding)`);
}

// 7. Client Quotation Exports (WhatsApp & PDF)
console.log('\nTest 7: Client Quotation Exports (WhatsApp & PDF)');
{
  const est = calculateMultiTierEstimate(1200, 'premium');
  const waText = generateWhatsAppQuoteText(est, 'Mr. Shanmugam', 'Villa Greenwoods');

  assert(waText.includes('BUILDING MISTRY'), 'WhatsApp text has header');
  assert(waText.includes('Villa Greenwoods'), 'WhatsApp text includes project name');
  assert(waText.includes('Mr. Shanmugam'), 'WhatsApp text includes client name');
  assert(waText.includes('1,200 sq.ft'), 'WhatsApp text includes area');
  assert(waText.includes('MILESTONE PAYMENT SCHEDULE'), 'WhatsApp text includes milestones');

  const pdfBlob = generateTurnkeyQuotationPdfBlob({
    estimate: est,
    siteName: 'Villa Greenwoods',
    clientName: 'Mr. Shanmugam',
    preparedBy: 'Building Mistry Construction Co.',
  });

  assert(pdfBlob instanceof Blob, 'PDF generator returns a valid Blob');
  assert(pdfBlob.type === 'application/pdf', 'Blob type is application/pdf');
  assert(pdfBlob.size > 1000, `PDF Blob has non-trivial size (${pdfBlob.size} bytes)`);
}

console.log(`\n========================================`);
console.log(`TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
console.log(`========================================\n`);

if (failed > 0) {
  process.exit(1);
}
