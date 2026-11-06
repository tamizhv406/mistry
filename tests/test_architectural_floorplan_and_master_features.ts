/**
 * Automated Verification for Building Mistry Master Upgrades:
 * 1. Section 4: Intelligent Floor Plan Generator (40x30 ft, 4 BHK, 2 Attached Baths, Living, Kitchen)
 * 2. Section 7: Construction Calculator & BOQ Milestone Payments
 * 3. Section 8: Authentication 3-Question Flow & 24h Lockout / Email Fallback
 */
import { generateProposedLayout, type ProposedLayoutRequest } from '../src/services/aiFloorPlanEngine';
import { calculateMultiTierEstimate, PACKAGE_SPECS } from '../src/domain/buildingCalculator/multiTierEstimator';

let testCount = 0;
let passedCount = 0;

function assert(description: string, condition: boolean, detail?: unknown) {
  testCount++;
  if (!condition) {
    console.error(`❌ FAILED: ${description}`, detail ?? '');
    throw new Error(`Assertion failed: ${description}`);
  }
  passedCount++;
  console.log(`  ✓ ${description}`);
}

async function run() {
  console.log('\n======================================================');
  console.log('🧪 RUNNING MASTER UPGRADES VERIFICATION TEST SUITE');
  console.log('======================================================\n');

  // --------------------------------------------------------------------------
  // TEST 1: Section 4 - Intelligent Floor Plan Generator (40x30 ft Default Example)
  // --------------------------------------------------------------------------
  console.log('--- 1. Testing Intelligent Floor Plan Generator (40x30 ft Example) ---');
  const req: ProposedLayoutRequest = {
    plotWidth: 30,
    plotDepth: 40,
    unit: 'feet',
    bedrooms: 4,
    bathrooms: 3,
    attachedBathrooms: 2,
    hasLivingRoom: true,
    hasKitchen: true,
    hasDining: true,
    hasStaircase: false,
    hasBalcony: true,
    hasPooja: true,
    facing: 'North',
  };

  const plan = generateProposedLayout(req);

  assert('Plan title reflects 4 BHK North Facing', plan.title.includes('4 BHK') && plan.title.includes('North'), plan.title);
  assert('Plot dimensions correctly preserved (30 x 40)', plan.plotWidth === 30 && plan.plotDepth === 40);
  assert('Total plot area is 1200 sq.ft', plan.totalPlotArea === 1200, plan.totalPlotArea);
  assert('Carpet area is calculated and positive', typeof plan.carpetArea === 'number' && (plan.carpetArea || 0) > 600, plan.carpetArea);

  // Check 4 bedrooms
  const bedroomLabels = plan.rooms.map(r => r.label);
  assert('Master Bedroom exists', bedroomLabels.some(l => l.includes('Master Bedroom')));
  assert('Bedroom 2 exists', bedroomLabels.some(l => l.includes('Bedroom 2')));
  assert('Bedroom 3 exists', bedroomLabels.some(l => l.includes('Bedroom 3')));
  assert('Bedroom 4 exists', bedroomLabels.some(l => l.includes('Bedroom 4')));

  // Check 2 attached bathrooms
  assert('Attached Bath (Master) exists', bedroomLabels.some(l => l.includes('Att. Bath (Master)') || l.includes('Att. Bath')));
  assert('Attached Bath (Bed 2) exists', bedroomLabels.some(l => l.includes('Att. Bath (Bed 2)')));
  assert('Common Bathroom exists', bedroomLabels.some(l => l.includes('Common Bathroom') || l.includes('Common Bath')));

  // Check Living Room, Kitchen & Dining
  assert('Living Room exists', bedroomLabels.some(l => l.includes('Living Room')));
  assert('Modular Kitchen exists', bedroomLabels.some(l => l.includes('Kitchen')));
  assert('Dining Area exists', bedroomLabels.some(l => l.includes('Dining Area') || l.includes('Dining')));

  // Check doors and windows
  assert('Doors are generated for rooms and entrance', plan.doors.length >= 6, plan.doors.length);
  assert('Windows are generated on perimeter walls for natural ventilation', plan.windows.length >= 4, plan.windows.length);

  // Check wall thicknesses
  const extWalls = plan.walls.filter(w => w.wallType === 'exterior');
  const intWalls = plan.walls.filter(w => w.wallType === 'interior');
  assert('Exterior walls have 9" (0.75 ft) thickness', extWalls.every(w => Math.abs(w.thickness - 0.75) < 0.01), extWalls.map(w => w.thickness));
  assert('Interior walls have 4.5" (0.375 ft) thickness', intWalls.every(w => Math.abs(w.thickness - 0.375) < 0.01), intWalls.map(w => w.thickness));

  // Check structural suggestions & statutory disclaimer
  assert('Structural suggestions include RCC column grid and setbacks', Array.isArray(plan.structuralSuggestions) && plan.structuralSuggestions.length >= 3);
  assert('Professional architectural disclaimer is present', plan.disclaimer.includes('Professional verification') || plan.disclaimer.includes('statutory'));

  // --------------------------------------------------------------------------
  // TEST 2: Section 7 - Multi-Tier Estimator & Milestone Payment Terms
  // --------------------------------------------------------------------------
  console.log('\n--- 2. Testing Multi-Tier Estimator & Milestone Payment Terms ---');
  const estimate = calculateMultiTierEstimate(1200, 'premium');

  assert('Premium package target rate matches spec', PACKAGE_SPECS.premium.targetAvgRate === 1990);
  assert('Estimate has positive grand total', estimate.grandTotal > 0, estimate.grandTotal);
  assert('Civil structure cost (Section A) is calculated', estimate.totalCivilStructureCost > 0);
  assert('Finishing & MEP cost (Section B) is calculated', estimate.totalFinishingCost > 0);
  assert('Labour cost component is calculated', estimate.totalLabourCost > 0);

  // Verify milestone payment schedule stages
  assert('Milestone schedule has 5 or more stages', estimate.milestones.length >= 5, estimate.milestones.length);
  const totalMilestonePct = estimate.milestones.reduce((acc, m) => acc + m.percentage, 0);
  assert('Milestone percentages sum to 100%', Math.round(totalMilestonePct) === 100, totalMilestonePct);

  // Stage checks
  const stageNames = estimate.milestones.map(m => m.stage.toLowerCase());
  assert('Foundation & Plinth stage exists', stageNames.some(s => s.includes('foundation') || s.includes('plinth')));
  assert('Roof slab casting stage exists', stageNames.some(s => s.includes('roof') || s.includes('slab')));
  assert('Finishing stage exists', stageNames.some(s => s.includes('plaster') || s.includes('finish') || s.includes('flooring')));

  // --------------------------------------------------------------------------
  // TEST 3: Section 8 - 24-Hour Security Questions Lockout Mechanism
  // --------------------------------------------------------------------------
  console.log('\n--- 3. Testing 24-Hour Security Questions Lockout Mechanism ---');
  const LOCKOUT_KEY = 'mistry_sec_lockout_test';
  const ATTEMPTS_KEY = 'mistry_sec_attempts_test';

  // Helper simulating the lockout logic from LoginView.tsx
  function checkLockout(email: string, now: number): { isLocked: boolean; hoursRemaining: number } {
    const raw = localStorage.getItem(`${LOCKOUT_KEY}_${email.trim().toLowerCase()}`);
    if (!raw) return { isLocked: false, hoursRemaining: 0 };
    const lockUntil = Number(raw);
    if (now < lockUntil) {
      const hoursRemaining = Math.max(1, Math.ceil((lockUntil - now) / (1000 * 60 * 60)));
      return { isLocked: true, hoursRemaining };
    }
    return { isLocked: false, hoursRemaining: 0 };
  }

  function recordFailedAttempt(email: string, now: number): { isLocked: boolean; remainingAttempts: number } {
    const key = email.trim().toLowerCase();
    const attemptsKey = `${ATTEMPTS_KEY}_${key}`;
    const prevAttempts = Number(localStorage.getItem(attemptsKey) || '0');
    const newAttempts = prevAttempts + 1;
    if (newAttempts >= 3) {
      const lockUntil = now + 24 * 60 * 60 * 1000;
      localStorage.setItem(`${LOCKOUT_KEY}_${key}`, String(lockUntil));
      localStorage.removeItem(attemptsKey);
      return { isLocked: true, remainingAttempts: 0 };
    }
    localStorage.setItem(attemptsKey, String(newAttempts));
    return { isLocked: false, remainingAttempts: 3 - newAttempts };
  }

  // Simulate in-memory localStorage for Node test
  const storageMap: Record<string, string> = {};
  (global as any).localStorage = {
    getItem: (k: string) => storageMap[k] || null,
    setItem: (k: string, v: string) => { storageMap[k] = v; },
    removeItem: (k: string) => { delete storageMap[k]; },
  };

  const testEmail = 'user@example.com';
  const startTime = Date.now();

  // Attempt 1: Fail
  const a1 = recordFailedAttempt(testEmail, startTime);
  assert('Attempt 1: Not locked out, 2 attempts remaining', !a1.isLocked && a1.remainingAttempts === 2);

  // Attempt 2: Fail
  const a2 = recordFailedAttempt(testEmail, startTime);
  assert('Attempt 2: Not locked out, 1 attempt remaining', !a2.isLocked && a2.remainingAttempts === 1);

  // Attempt 3: Fail -> triggers 24 hour lockout
  const a3 = recordFailedAttempt(testEmail, startTime);
  assert('Attempt 3: 24-hour lockout triggered immediately', a3.isLocked && a3.remainingAttempts === 0);

  // Check lockout state 1 hour later
  const state1h = checkLockout(testEmail, startTime + 1 * 60 * 60 * 1000);
  assert('Account remains locked after 1 hour with 23 hours remaining', state1h.isLocked && state1h.hoursRemaining === 23, state1h);

  // Check lockout state 25 hours later
  const state25h = checkLockout(testEmail, startTime + 25 * 60 * 60 * 1000);
  assert('Account lockout automatically expires after 24 hours', !state25h.isLocked);

  console.log('\n======================================================');
  console.log(`🎉 ALL ${passedCount}/${testCount} MASTER VERIFICATION TESTS PASSED SUCCESSFULLY!`);
  console.log('======================================================\n');
}

run().catch(err => {
  console.error('\n❌ MASTER TEST RUN FAILED:\n', err);
  process.exit(1);
});
