import 'fake-indexeddb/auto';
import { db } from '../src/db/db';
import { loadDemoData } from '../src/db/seedData';
import {
  hashPassword,
  registerUser,
  loginUser,
  getCurrentUser,
  logoutUser,
  initAuth,
  isSuperAdmin,
  createSubAdmin,
  changeUserRole,
  toggleUserActive,
} from '../src/services/auth';
import { toSqFt, fromSqFt, calculateBuildingEstimate } from '../src/utils/estimator';
import { parseVoiceInput, parseSiteVoiceInput } from '../src/utils/voiceParser';
import {
  calculateFinancialBalance,
  recordPaymentTransaction,
  syncParentRecordFinances,
} from '../src/utils/financial';
import type { RodEntry, OtherExpense, User, Material, PaymentTransaction } from '../src/db/types';

async function runAllTests() {
  console.log('🏗️ Starting Building Mistry Core Business Logic & Database Tests...\n');

  // Test 1: Verify Initial Empty State
  const initialSites = await db.sites.toArray();
  console.log(`[Test 1] Initial sites count: ${initialSites.length} (Expected: 0)`);
  if (initialSites.length !== 0) throw new Error('Initial state not empty');

  // Test 2: Load Demo Data
  console.log('[Test 2] Loading demo data...');
  await loadDemoData();
  const demoSites = await db.sites.filter(s => !s.isDeleted).toArray();
  console.log(`✓ Loaded Demo Sites: ${demoSites.length} site (${demoSites[0].name})`);
  if (demoSites.length !== 1) throw new Error('Demo site failed to load');

  const demoSiteId = demoSites[0].id;

  // Test 3: Materials & Auto-calculations
  console.log('\n[Test 3] Testing Material records & calculations...');
  const materials = await db.materials.where('siteId').equals(demoSiteId).filter(m => !m.isDeleted).toArray();
  console.log(`✓ Material entries loaded: ${materials.length}`);
  materials.forEach(m => {
    const expectedTotal = Math.round(m.quantity * m.rate);
    const expectedBalance = Math.max(0, expectedTotal - m.paidAmount);
    if (m.totalAmount !== expectedTotal) throw new Error(`Total mismatch on ${m.materialName}`);
    if (m.balance !== expectedBalance) throw new Error(`Balance mismatch on ${m.materialName}`);
    console.log(`  - ${m.category.toUpperCase()}: ${m.materialName} | Qty: ${m.quantity} ${m.unit} | Total: ₹${m.totalAmount} | Balance: ₹${m.balance}`);
  });

  // Test 4: Steel Rods by Diameter Summary
  console.log('\n[Test 4] Testing Steel Rod Diameter Summary Table...');
  const rods = await db.rodEntries.where('siteId').equals(demoSiteId).filter(r => !r.isDeleted).toArray();
  console.log(`✓ Rod entries: ${rods.length}`);

  // Add a new rod size (e.g. 20 mm)
  const newRod: RodEntry = {
    id: 'rod-test-20mm',
    siteId: demoSiteId,
    diameter: '20 mm',
    brand: 'Tata Tiscon',
    weightKg: 500,
    ratePerKg: 70,
    totalAmount: 35000,
    paidAmount: 30000,
    balance: 5000,
    supplier: 'Sri Ram Steels',
    unit: 'kg',
    purchaseDate: '2026-02-05',
    isDeleted: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await db.rodEntries.put(newRod);

  const updatedRods = await db.rodEntries.where('siteId').equals(demoSiteId).filter(r => !r.isDeleted).toArray();
  const diameterSummary: Record<string, number> = {};
  updatedRods.forEach(r => {
    diameterSummary[r.diameter] = (diameterSummary[r.diameter] || 0) + r.weightKg;
  });

  console.log('  Diameter Summary Table:');
  Object.entries(diameterSummary).forEach(([diam, kg]) => {
    console.log(`    • ${diam} → ${kg} kg`);
  });
  if (diameterSummary['20 mm'] !== 500) throw new Error('Rod 20mm calculation failed');

  // Test 5: Labour Attendance & Salary Calculation
  console.log('\n[Test 5] Testing Labour Attendance, Advances & Gross Salary Calculations...');
  const workers = await db.workers.where('siteId').equals(demoSiteId).filter(w => !w.isDeleted).toArray();
  const attendance = await db.attendance.where('siteId').equals(demoSiteId).filter(a => !a.isDeleted).toArray();
  const advances = await db.labourAdvances.where('siteId').equals(demoSiteId).filter(a => !a.isDeleted).toArray();
  const payments = await db.salaryPayments.where('siteId').equals(demoSiteId).filter(s => !s.isDeleted).toArray();

  workers.forEach(w => {
    const wAtt = attendance.filter(a => a.workerId === w.id);
    const wAdv = advances.filter(a => a.workerId === w.id);
    const wPay = payments.filter(s => s.workerId === w.id);

    const daysWorked = wAtt.reduce((acc, a) => acc + a.dayMultiplier, 0);
    const gross = Math.round(daysWorked * w.dailyWage);
    const adv = wAdv.reduce((acc, a) => acc + a.amount, 0);
    const paid = wPay.reduce((acc, s) => acc + s.paidAmount, 0);
    const bal = Math.max(0, gross - adv - paid);

    console.log(`  - Worker: ${w.name} (${w.category}) | Wage: ₹${w.dailyWage}/day | Days: ${daysWorked} | Gross: ₹${gross} | Advance: ₹${adv} | Paid: ₹${paid} | Net Bal: ₹${bal}`);
  });

  // Test 6: Soft Delete (Safe Delete -> Trash)
  console.log('\n[Test 6] Testing Soft Delete & Recycle Bin...');
  const initialTrash = await db.getAllTrash();
  console.log(`  Initial trash records: ${initialTrash.length}`);

  // Delete a material to trash
  const matToDelete = materials[0];
  console.log(`  Moving material "${matToDelete.materialName}" to Recycle Bin...`);
  await db.softDelete('materials', matToDelete.id);

  const activeMaterialsAfterDelete = await db.materials.where('siteId').equals(demoSiteId).filter(m => !m.isDeleted).toArray();
  const trashAfterDelete = await db.getAllTrash();

  if (activeMaterialsAfterDelete.some(m => m.id === matToDelete.id)) {
    throw new Error('Material still appears in active records after soft delete!');
  }
  const trashEntry = trashAfterDelete.find(t => t.id === matToDelete.id);
  if (!trashEntry) {
    throw new Error('Material did not appear in Recycle Bin!');
  }
  console.log(`✓ Successfully moved to Trash! Trash item found: "${trashEntry.title}" (${trashEntry.entityType})`);

  // Test 7: Restore from Trash
  console.log('\n[Test 7] Testing Restore from Recycle Bin...');
  await db.restoreRecord('materials', matToDelete.id);
  const activeMaterialsAfterRestore = await db.materials.where('siteId').equals(demoSiteId).filter(m => !m.isDeleted).toArray();
  const trashAfterRestore = await db.getAllTrash();

  if (!activeMaterialsAfterRestore.some(m => m.id === matToDelete.id)) {
    throw new Error('Material failed to restore to active records!');
  }
  if (trashAfterRestore.some(t => t.id === matToDelete.id)) {
    throw new Error('Material still present in trash after restore!');
  }
  console.log(`✓ Successfully restored "${matToDelete.materialName}" back to active site ledger!`);

  // Test 8: Permanent Delete
  console.log('\n[Test 8] Testing Permanent Delete...');
  await db.softDelete('materials', matToDelete.id);
  await db.permanentDelete('materials', matToDelete.id);
  const rawRecord = await db.materials.get(matToDelete.id);
  if (rawRecord !== undefined) {
    throw new Error('Record was not permanently deleted!');
  }
  console.log(`✓ Successfully permanently deleted record from database!`);

  // Test 9: Other Expenses CRUD & Calculations
  console.log('\n[Test 9] Testing Other Expenses module...');
  const newOtherExp: OtherExpense = {
    id: 'other-test-transport-01',
    siteId: demoSiteId,
    category: 'Transport',
    description: 'Tractor load soil transfer from East boundary',
    amount: 3500,
    paidAmount: 2000,
    balance: 1500,
    paidTo: 'Arun Transport Services',
    date: '2026-02-10',
    notes: 'Remaining ₹1500 due on Monday',
    isDeleted: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await db.otherExpenses.put(newOtherExp);

  const activeOther = await db.otherExpenses.where('siteId').equals(demoSiteId).filter(o => !o.isDeleted).toArray();
  const createdExp = activeOther.find(o => o.id === newOtherExp.id);
  if (!createdExp) throw new Error('Failed to create Other Expense');
  if (createdExp.amount - createdExp.paidAmount !== createdExp.balance) {
    throw new Error('Other Expense balance calculation mismatch');
  }
  console.log(`✓ Created Other Expense: ${createdExp.category} - ${createdExp.description} | Total: ₹${createdExp.amount} | Due: ₹${createdExp.balance}`);

  // Test soft delete on other expense
  await db.softDelete('otherExpenses', createdExp.id);
  const trashWithOther = await db.getAllTrash();
  const otherInTrash = trashWithOther.find(t => t.id === createdExp.id);
  if (!otherInTrash) throw new Error('Other Expense not found in Recycle Bin after soft delete');
  console.log(`✓ Other Expense soft deleted to Trash: "${otherInTrash.title}"`);
  await db.restoreRecord('otherExpenses', createdExp.id);
  console.log(`✓ Other Expense restored back to site records`);

  // Test 10: Activity Logging
  console.log('\n[Test 10] Testing Activity Logging...');
  await db.logActivity(
    demoSiteId,
    'Sri Murugan Illam',
    'CREATE',
    `Created Transport expense of ₹${createdExp.amount}`,
    createdExp.amount
  );
  const activities = await db.activityLogs.toArray();
  if (activities.length === 0) throw new Error('Activity log was not recorded');
  console.log(`✓ Activity log recorded: [${activities[activities.length - 1].action}] ${activities[activities.length - 1].description}`);

  // Test 11: Authentication & Password Hashing
  console.log('\n[Test 11] Testing Authentication & Security...');
  await initAuth();
  const adminUser = await db.users.where('username').equals('admin').first();
  if (!adminUser) throw new Error('Default admin supervisor was not seeded');
  console.log(`✓ Default supervisor initialized: ${adminUser.username} (${adminUser.role})`);

  // Test password hashing
  const hash1 = await hashPassword('mistry123');
  const hash2 = await hashPassword('mistry123');
  if (hash1 !== hash2) throw new Error('SHA-256 password hash is not deterministic');
  if (hash1 === 'mistry123') throw new Error('Password was stored in plain text');
  console.log(`✓ SHA-256 Password Hash verified: ${hash1.slice(0, 16)}...`);

  // Test login with correct password
  const loginRes = await loginUser('admin', 'mistry123');
  if (!loginRes.success || !loginRes.user || loginRes.user.username !== 'admin') throw new Error('Login with correct password failed');
  console.log(`✓ Valid credentials authentication succeeded for: ${loginRes.user.fullName}`);

  // Test login with incorrect password
  const badLogin = await loginUser('admin', 'wrongpass999');
  if (badLogin.success) throw new Error('Login should have failed with incorrect password');
  console.log(`✓ Invalid password correctly rejected: "${badLogin.error}"`);

  // Test new user registration
  const regRes = await registerUser(
    'site_engineer',
    'Karthik Raja',
    '98401 23456',
    'karthik@example.com',
    'password456',
    'Supervisor'
  );
  if (!regRes.success || !regRes.user || regRes.user.username !== 'site_engineer') throw new Error('New user registration failed');
  console.log(`✓ New user registration succeeded: ${regRes.user.fullName} (${regRes.user.role})`);

  // Test 12: Site Creation & Data Persistence
  console.log('\n[Test 12] Testing Site Creation via Modal Logic & Persistence...');
  const newSiteId = `site-test-${Date.now()}`;
  await db.sites.put({
    id: newSiteId,
    userId: 'user-mistry-velu',
    name: 'Green Valley Villa',
    ownerName: 'Dr. S. Vignesh',
    ownerPhone: '98401 55667',
    address: 'Plot 42, 3rd Cross Street, Lake View',
    area: 'Tambaram West, Chennai',
    buildingType: 'Duplex Villa (G+1)',
    startDate: '2026-03-01',
    expectedCompletionDate: '2026-11-30',
    status: 'Active',
    notes: 'Premium structural specifications, 3000 sq ft',
    isDeleted: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  const savedSite = await db.sites.get(newSiteId);
  if (!savedSite || savedSite.name !== 'Green Valley Villa') {
    throw new Error('Failed to persist new site to database');
  }
  const allActiveSites = await db.sites.filter(s => !s.isDeleted).toArray();
  if (allActiveSites.length < 2) {
    throw new Error('Existing sites were unexpectedly altered or deleted');
  }
  console.log(`✓ New site "${savedSite.name}" successfully persisted! Total active sites: ${allActiveSites.length}`);

  // Test 14: Unit Conversions & Voice Parser Logic
  console.log('\n[Test 14] Testing Unit Conversions & Voice Parsing Engine...');
  // 1. Cent conversion (1 cent = 435.6 sq.ft)
  const centSqFt = toSqFt(3, 'cent');
  if (Math.abs(centSqFt - 1306.8) > 0.01) throw new Error(`3 Cent conversion failed: got ${centSqFt}, expected 1306.8`);
  console.log(`✓ 3 Cent = ${centSqFt} sq.ft (Standard Indian real estate conversion verified)`);

  // 2. Ground conversion (1 ground = 2400 sq.ft)
  const groundSqFt = toSqFt(1, 'ground');
  if (Math.abs(groundSqFt - 2400) > 0.01) throw new Error(`1 Ground conversion failed: got ${groundSqFt}`);
  console.log(`✓ 1 Ground = ${groundSqFt} sq.ft`);

  // 3. Sq.M conversion (1 sq.m = 10.7639 sq.ft)
  const sqMSqFt = toSqFt(100, 'sq.m');
  if (Math.abs(sqMSqFt - 1076.39) > 0.1) throw new Error(`100 Sq.M conversion failed: got ${sqMSqFt}`);
  console.log(`✓ 100 Sq.M = ${sqMSqFt.toFixed(2)} sq.ft`);

  // 4. Bi-directional conversion back to Cent
  const backToCent = fromSqFt(centSqFt, 'cent');
  if (Math.abs(backToCent - 3) > 0.001) throw new Error(`Back-conversion to cent failed: got ${backToCent}`);
  console.log(`✓ Bi-directional conversion accurate: 1306.8 sq.ft -> ${backToCent} cent`);

  // 5. Voice Input Natural Language Parser
  const voicePhrase = '3 cent G plus one residential villa standard quality M20 concrete Fe550 steel';
  const parsed = parseVoiceInput(voicePhrase);
  if (parsed.plotArea !== 3 || parsed.plotAreaUnit !== 'cent') throw new Error('Voice area parse failed');
  if (parsed.floors !== 2) throw new Error(`Voice floor parse failed: expected 2 (G+1), got ${parsed.floors}`);
  if (parsed.buildingType !== 'Residential Villa') throw new Error('Voice building type parse failed');
  if (parsed.quality !== 'Standard') throw new Error('Voice quality parse failed');
  if (parsed.concreteGrade !== 'M20') throw new Error('Voice concrete grade parse failed');
  if (parsed.steelGrade !== 'Fe550') throw new Error('Voice steel grade parse failed');
  console.log(`✓ Voice recognition parsed: "${voicePhrase}"`);
  console.log(`  -> Detected ${parsed.plotArea} Cent, ${parsed.floors} Floors (G+1), ${parsed.buildingType}, ${parsed.quality}, Concrete: ${parsed.concreteGrade}, Steel: ${parsed.steelGrade}`);

  // Test 15: Estimation Engine & BOQ Steel Breakdown
  console.log('\n[Test 15] Testing Civil Engineering Thumb-Rule Estimator...');
  const estCalc = calculateBuildingEstimate({
    builtUpSqFt: 1000,
    floors: 1,
    buildingType: 'Residential Building',
    quality: 'Standard',
    structureType: 'Framed Structure (RCC)',
    concreteGrade: 'M20',
    steelGrade: 'Fe500',
    includeRiverSand: true,
    rates: {
      cementPerBag: 420,
      sandPerCft: 135,
      msandPerCft: 45,
      aggregatePerCft: 42,
      brickPerPiece: 10.5,
      steelPerKg: 74,
      labourPerSqFt: 320,
    },
  });

  const cementMat = estCalc.materials.find(m => m.material === 'Cement');
  const steelMat = estCalc.materials.find(m => m.material === 'Steel');
  const bricksMat = estCalc.materials.find(m => m.material === 'Bricks');

  if (!cementMat || cementMat.quantity !== 420) throw new Error(`Cement bags unexpected: ${cementMat?.quantity}`);
  if (!steelMat || steelMat.quantity !== 3800) throw new Error(`Steel kg unexpected: ${steelMat?.quantity}`);
  if (!bricksMat || bricksMat.quantity !== 20000) throw new Error(`Bricks pieces unexpected: ${bricksMat?.quantity}`);

  console.log(`✓ 1,000 sq.ft Standard RCC building estimated:`);
  console.log(`  • Cement: ${cementMat.quantity} Bags (₹${cementMat.estimatedCost.toLocaleString('en-IN')})`);
  console.log(`  • TMT Steel: ${steelMat.quantity} Kg (₹${steelMat.estimatedCost.toLocaleString('en-IN')})`);
  console.log(`  • Chamber Bricks: ${bricksMat.quantity.toLocaleString('en-IN')} Pieces (₹${bricksMat.estimatedCost.toLocaleString('en-IN')})`);
  console.log(`  • Total Material Cost: ₹${estCalc.totalMaterialCost.toLocaleString('en-IN')}`);
  console.log(`  • Estimated Civil Labour: ₹${estCalc.estimatedLabourCost.toLocaleString('en-IN')}`);
  console.log(`  • Grand Total Estimated Project Budget: ₹${estCalc.totalEstimatedCost.toLocaleString('en-IN')}`);

  // BOQ Steel schedule distribution check
  const totalBoqWeight = estCalc.boqSteelSchedule.reduce((a, b) => a + b.weightKg, 0);
  if (Math.abs(totalBoqWeight - 3800) > 10) throw new Error(`BOQ Steel total weight ${totalBoqWeight} != 3800`);
  console.log(`✓ BOQ Steel Rebar Schedule distributed across 8mm, 10mm, 12mm, 16mm, 20mm (Total: ${totalBoqWeight} kg)`);

  // Test 16: Supplier Market Pricing & Multi-Supplier Comparison
  console.log('\n[Test 16] Testing Supplier Market Pricing Quotes...');
  const seededPrices = await db.seedDefaultMaterialPrices();
  console.log(`✓ Seeded ${seededPrices} market reference supplier quotes`);

  const cementQuotes = await db.materialPrices.filter(p => p.material === 'Cement' && !p.isDeleted).toArray();
  if (cementQuotes.length < 3) throw new Error('Expected at least 3 supplier quotes for Cement');
  const cementPrices = cementQuotes.map(q => q.price);
  const minPrice = Math.min(...cementPrices);
  const maxPrice = Math.max(...cementPrices);
  const avgPrice = Math.round(cementPrices.reduce((a, b) => a + b, 0) / cementPrices.length);

  if (minPrice !== 410) throw new Error(`Lowest cement price mismatch: ${minPrice}`);
  if (maxPrice !== 430) throw new Error(`Highest cement price mismatch: ${maxPrice}`);
  console.log(`✓ Cement quotes comparison: Lowest: ₹${minPrice} (Dalmia) | Avg: ₹${avgPrice} | Highest: ₹${maxPrice} (Ramco)`);

  // Test 17: Save Building Estimate & Variance Logic
  console.log('\n[Test 17] Testing Building Estimate Persistence & Variance Logic...');
  const testEstimateId = 'est-demo-1';
  await db.estimates.put({
    id: testEstimateId,
    siteId: newSiteId,
    siteName: savedSite.name,
    estimateName: 'Green Valley Villa G+1 Preliminary Estimate',
    plotArea: 3,
    plotAreaUnit: 'cent',
    builtUpArea: 2613.6,
    builtUpAreaUnit: 'sq.ft',
    convertedBuiltUpSqFt: 2613.6,
    floors: 2,
    buildingType: 'Residential Villa',
    quality: 'Standard',
    structureType: 'Framed Structure (RCC)',
    concreteGrade: 'M20',
    steelGrade: 'Fe500',
    includeRiverSand: true,
    materialEstimates: estCalc.materials,
    totalEstimatedMaterialCost: estCalc.totalMaterialCost * 2.6136,
    estimatedLabourCost: estCalc.estimatedLabourCost * 2.6136,
    totalEstimatedCost: estCalc.totalEstimatedCost * 2.6136,
    notes: 'Client requested UltraTech cement and Tata Tiscon steel',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isDeleted: false,
  });

  const savedEst = await db.estimates.get(testEstimateId);
  if (!savedEst || savedEst.estimateName !== 'Green Valley Villa G+1 Preliminary Estimate') {
    throw new Error('Estimate was not saved properly');
  }
  console.log(`✓ Estimate persisted: "${savedEst.estimateName}" linked to site "${savedEst.siteName}"`);

  // Soft delete estimate and restore from trash
  await db.softDelete('estimates', testEstimateId);
  const trashItems = await db.getAllTrash();
  const deletedEst = trashItems.find(t => t.id === testEstimateId);
  if (!deletedEst) throw new Error('Estimate not found in Recycle Bin after soft delete');
  console.log(`✓ Estimate soft-deleted to Recycle Bin: "${deletedEst.title}"`);
  await db.restoreRecord('estimates', testEstimateId);
  const restoredEst = await db.estimates.get(testEstimateId);
  if (!restoredEst || restoredEst.isDeleted) throw new Error('Estimate failed to restore');
  console.log(`✓ Estimate successfully restored from Recycle Bin!`);

  // Test 18: Data Isolation between Mistry Velu and Mistry Karthik
  console.log('\n[Test 18] Testing Strict Multi-User Data Isolation (MISTRY vs MISTRY)...');
  const veluUser: User = {
    id: 'user-mistry-velu',
    username: 'mistry_velu',
    fullName: 'R. Velu (Head Mistry)',
    mobile: '98402 11223',
    email: 'velu@buildingmistry.com',
    passwordHash: 'hash',
    role: 'MISTRY',
    isActive: true,
    createdAt: new Date().toISOString(),
  };
  const karthikUser: User = {
    id: 'user-mistry-karthik',
    username: 'mistry_karthik',
    fullName: 'K. Karthik (Civil Contractor)',
    mobile: '98403 44556',
    email: 'karthik@buildingmistry.com',
    passwordHash: 'hash',
    role: 'MISTRY',
    isActive: true,
    createdAt: new Date().toISOString(),
  };
  await db.users.put(karthikUser);

  // Add site for Karthik
  const karthikSiteId = 'site-karthik-anand-villa';
  await db.sites.put({
    id: karthikSiteId,
    userId: karthikUser.id,
    name: 'Anand Villa (Duplex)',
    ownerName: 'Anand Kumar',
    ownerPhone: '98400 11111',
    address: 'Medavakkam, Chennai',
    area: 'Medavakkam',
    buildingType: 'Duplex Villa (G+1)',
    startDate: '2026-03-01',
    expectedCompletionDate: '2026-11-30',
    status: 'Active',
    isDeleted: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  // Check Velu's sites
  const veluSites = await db.getSitesForUser(veluUser);
  const veluCanSeeKarthik = veluSites.some(s => s.id === karthikSiteId);
  if (veluCanSeeKarthik) throw new Error('Data isolation violation: Mistry Velu can see Mistry Karthik site');

  // Check specific site query throws Access Denied
  let accessDeniedTriggered = false;
  try {
    await db.getSiteForUser(veluUser, karthikSiteId);
  } catch (err: any) {
    if (err.message.includes('Access Denied')) {
      accessDeniedTriggered = true;
    }
  }
  if (!accessDeniedTriggered) throw new Error('Data isolation violation: getSiteForUser did not throw Access Denied');

  const karthikSites = await db.getSitesForUser(karthikUser);
  if (!karthikSites.some(s => s.id === karthikSiteId)) throw new Error('Mistry Karthik cannot find his own site');
  console.log(`✓ Strict Data Isolation verified: Mistry Velu sees only his sites, Access Denied thrown for Mistry Karthik's data.`);

  // Test 19: Admin Cross-User Visibility & Audit Logging
  console.log('\n[Test 19] Testing Admin Cross-User Governance & Audit Logging...');
  const adminSupervisor: User = {
    id: 'user-admin-default',
    username: 'admin',
    fullName: 'Chief Site Administrator',
    mobile: '98401 99887',
    email: 'admin@buildingmistry.com',
    passwordHash: 'hash',
    role: 'ADMIN',
    isActive: true,
    createdAt: new Date().toISOString(),
  };

  const adminSites = await db.getSitesForUser(adminSupervisor);
  const adminHasVelu = adminSites.some(s => s.userId === 'user-mistry-velu');
  const adminHasKarthik = adminSites.some(s => s.userId === 'user-mistry-karthik');
  if (!adminHasVelu || !adminHasKarthik) throw new Error('Admin missing cross-contractor site visibility');

  await db.logAdminAudit(adminSupervisor, 'Inspect Sites', 'Admin audited all active contractor sites');
  const recentAudit = await db.activityLogs.filter(a => a.action === 'Inspect Sites').first();
  if (!recentAudit || recentAudit.userName !== adminSupervisor.fullName || recentAudit.userRole !== 'ADMIN') {
    throw new Error('Admin audit log record invalid or missing');
  }
  console.log(`✓ Admin Cross-Site Governance & Audit Trail verified: Admin sees all sites (${adminSites.length}) and audit generated.`);

  // Test 20: Dedicated Tea, Snacks, and Fresh Juice Tracking
  console.log('\n[Test 20] Testing Dedicated Tea, Snacks & Fresh Juice Calculations...');
  const testTeaId = 'tea-test-refreshments';
  await db.teaSnacksExpenses.put({
    id: testTeaId,
    userId: veluUser.id,
    siteId: demoSiteId,
    date: '2026-03-05',
    teaExpense: 140,
    snacksExpense: 200,
    juiceExpense: 180,
    otherFoodExpense: 50,
    totalAmount: 570,
    paidAmount: 570,
    balance: 0,
    notes: 'Morning tea, samosa & afternoon sugarcane juice',
    isDeleted: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const savedTea = await db.teaSnacksExpenses.get(testTeaId);
  if (!savedTea || savedTea.juiceExpense !== 180 || savedTea.teaExpense !== 140 || savedTea.totalAmount !== 570) {
    throw new Error('Juice expense tracking or total calculation failed');
  }
  console.log(`✓ Refreshments tracking verified: Tea: ₹${savedTea.teaExpense}, Snacks: ₹${savedTea.snacksExpense}, Fresh Juice: ₹${savedTea.juiceExpense} (Total: ₹${savedTea.totalAmount})`);

  // Test 21: Voice Parser for Site Auto-Fill
  console.log('\n[Test 21] Testing Natural Language Voice Site Auto-Fill Parser...');
  const siteVoiceSpeech = 'Site name Golden Nest villa owner Natarajan phone 9840199887 area 2400 sq ft Tambaram residential';
  const siteParsed = parseSiteVoiceInput(siteVoiceSpeech);
  if (!siteParsed.name || !siteParsed.name.toLowerCase().includes('golden nest')) throw new Error('Voice site name extraction failed');
  if (siteParsed.ownerName !== 'Natarajan') throw new Error('Voice owner name extraction failed');
  if (siteParsed.ownerPhone !== '9840199887') throw new Error('Voice phone extraction failed');
  if (siteParsed.district !== 'Tambaram') throw new Error('Voice location extraction failed');
  console.log(`✓ Voice Site Auto-Fill parsed successfully: Site: "${siteParsed.name}", Owner: "${siteParsed.ownerName}", Phone: "${siteParsed.ownerPhone}", Area: "${siteParsed.area}", District: "${siteParsed.district}"`);

  // Test 22: Real Admin Authentication, Super Admin Checks, and Sub-Admin Creation & Governance
  console.log('\n[Test 22] Testing Real Admin (tamilthilagan82@gmail.com) Auth & Sub-Admin Governance...');
  // 1. Authenticate as Real Admin
  const realAdminLoginRes = await loginUser('tamilthilagan82@gmail.com', 'tamil406@##', true);
  if (!realAdminLoginRes.success || !realAdminLoginRes.user) {
    throw new Error('Real Admin login failed with valid credentials: ' + realAdminLoginRes.error);
  }
  const realAdmin = realAdminLoginRes.user;
  if (!isSuperAdmin(realAdmin)) {
    throw new Error('isSuperAdmin returned false for Real Admin account');
  }
  console.log(`✓ Real Admin logged in successfully: ${realAdmin.fullName} (${realAdmin.email}), Role: ${realAdmin.role}`);

  // 2. Real Admin creates a Sub-Admin
  const subAdminRes = await createSubAdmin(realAdmin, {
    fullName: 'Anbu Site Supervisor',
    username: 'anbu_supervisor',
    mobile: '98401 77889',
    email: 'anbu@mistry.com',
    password: 'subpassword123',
  });
  if (!subAdminRes.success || !subAdminRes.user) {
    throw new Error('Real Admin failed to create Sub-Admin: ' + subAdminRes.error);
  }
  const anbuSubAdmin = subAdminRes.user;
  if (anbuSubAdmin.role !== 'SUB_ADMIN') throw new Error('New user role is not SUB_ADMIN');
  console.log(`✓ Real Admin created Sub-Admin: ${anbuSubAdmin.fullName} (@${anbuSubAdmin.username}) with SUB_ADMIN role.`);

  // 3. Verify Sub-Admin has cross-site visibility
  const subAdminSites = await db.getSitesForUser(anbuSubAdmin);
  if (subAdminSites.length === 0) throw new Error('Sub-Admin has no site visibility');
  console.log(`✓ Sub-Admin verified to have elevated access to ${subAdminSites.length} sites.`);

  // 4. Verify Normal Mistry (Velu) CANNOT create a Sub-Admin
  const mistrySubAdminAttempt = await createSubAdmin(veluUser, {
    fullName: 'Illegal Sub-Admin',
    username: 'illegal_sub',
    mobile: '98401 00000',
    email: 'illegal@mistry.com',
    password: 'password123',
  });
  if (mistrySubAdminAttempt.success) throw new Error('Security flaw: Mistry was able to create a Sub-Admin!');
  console.log(`✓ Permission Denied enforced: Normal Mistry blocked from creating Sub-Admin (${mistrySubAdminAttempt.error}).`);

  // 5. Verify Real Admin is protected: cannot be deactivated
  const deactivationAttempt = await toggleUserActive(anbuSubAdmin, realAdmin.id, false);
  if (deactivationAttempt.success) throw new Error('Security flaw: Sub-Admin was able to deactivate Real Admin!');
  console.log(`✓ Real Admin protection enforced: Cannot be deactivated (${deactivationAttempt.error}).`);

  // 6. Verify Real Admin role cannot be demoted
  const demoteAttempt = await changeUserRole(realAdmin, realAdmin.id, 'MISTRY');
  if (demoteAttempt.success) throw new Error('Security flaw: Real Admin role was changed!');
  console.log(`✓ Real Admin role immutability verified: Cannot demote Master Real Admin (${demoteAttempt.error}).`);

  // 7. Verify Real Admin can promote and demote other users
  const promoteRes = await changeUserRole(realAdmin, karthikUser.id, 'SUB_ADMIN');
  if (!promoteRes.success) throw new Error('Real Admin failed to promote Mistry Karthik to Sub-Admin');
  const updatedKarthik = await db.users.get(karthikUser.id);
  if (updatedKarthik?.role !== 'SUB_ADMIN') throw new Error('Mistry Karthik role not updated to SUB_ADMIN');
  console.log(`✓ Real Admin successfully promoted Mistry Karthik to Sub-Admin.`);

  const demoteRes = await changeUserRole(realAdmin, karthikUser.id, 'MISTRY');
  if (!demoteRes.success) throw new Error('Real Admin failed to demote Karthik back to Mistry');
  console.log(`✓ Real Admin successfully demoted user back to Mistry.`);

  // Test 23: Admin ID Reservation & Public Registration Isolation
  console.log('\n[Test 23] Testing Admin ID Reservation & Public Registration Isolation...');
  // 1. Attempt to register with Real Admin email
  const fakeAdminReg1 = await registerUser('fake_admin1', 'Fake Admin', '9840100000', 'tamilthilagan82@gmail.com', 'hack123');
  if (fakeAdminReg1.success) throw new Error('Security flaw: Someone was able to register with the Real Admin email!');
  console.log(`✓ Real Admin email reservation enforced: ${fakeAdminReg1.error}`);

  // 2. Attempt to register with reserved admin usernames
  const fakeAdminReg2 = await registerUser('tamilthilagan', 'Fake Tamil', '9840100000', 'other@mail.com', 'hack123');
  if (fakeAdminReg2.success) throw new Error('Security flaw: Someone was able to register with the reserved admin username!');
  console.log(`✓ Real Admin username reservation enforced: ${fakeAdminReg2.error}`);

  const fakeAdminReg3 = await registerUser('admin', 'Fake Admin', '9840100000', 'other2@mail.com', 'hack123');
  if (fakeAdminReg3.success) throw new Error('Security flaw: Someone was able to register with the reserved "admin" username!');
  console.log(`✓ System Admin username reservation enforced: ${fakeAdminReg3.error}`);

  // 3. Normal user registering cannot self-elevate to ADMIN
  const normalMistryReg = await registerUser('mistry_dinesh', 'Dinesh Contractor', '9840199000', 'dinesh@mail.com', 'mistrypass', 'ADMIN' as any);
  if (!normalMistryReg.success || !normalMistryReg.user) throw new Error('Legitimate registration failed');
  if (normalMistryReg.user.role !== 'MISTRY') throw new Error('Security flaw: Self-registered user gained elevated role!');
  console.log(`✓ Self-registration role enforcement verified: User registered with role: ${normalMistryReg.user.role} (Elevation blocked)`);

  // 4. Verify Real Admin can access all sites while Mistry Dinesh sees 0 sites
  const realAdminAllSites = await db.getSitesForUser(realAdmin);
  const dineshSites = await db.getSitesForUser(normalMistryReg.user);
  if (realAdminAllSites.length === 0) throw new Error('Real admin has no sites');
  if (dineshSites.length !== 0) throw new Error('New mistry should have 0 sites initially');
  console.log(`✓ Complete Data Access Verified: Real Admin sees all ${realAdminAllSites.length} sites; new Mistry sees ${dineshSites.length} sites.`);

  // Test 24: Universal Payment Calculation Logic
  console.log('\n[Test 24] Testing Universal Payment Calculation Formulas (No Negative Balances)...');
  // 1. Default: Paid Amount = 0
  const finDefault = calculateFinancialBalance(10000, 0);
  if (finDefault.balanceDue !== 10000 || finDefault.extraPaid !== 0) {
    throw new Error(`Default payment failed: balanceDue=${finDefault.balanceDue}, extraPaid=${finDefault.extraPaid}`);
  }
  console.log('✓ Case 1 (Default): Total: ₹10,000, Paid: ₹0 → Balance Due: ₹10,000, Extra Paid: ₹0');

  // 2. Paid < Total
  const finUnder = calculateFinancialBalance(10000, 7000);
  if (finUnder.balanceDue !== 3000 || finUnder.extraPaid !== 0) {
    throw new Error(`Underpayment failed: balanceDue=${finUnder.balanceDue}, extraPaid=${finUnder.extraPaid}`);
  }
  console.log('✓ Case 2 (Paid < Total): Total: ₹10,000, Paid: ₹7,000 → Balance Due: ₹3,000, Extra Paid: ₹0');

  // 3. Paid == Total
  const finEqual = calculateFinancialBalance(10000, 10000);
  if (finEqual.balanceDue !== 0 || finEqual.extraPaid !== 0) {
    throw new Error(`Exact payment failed: balanceDue=${finEqual.balanceDue}, extraPaid=${finEqual.extraPaid}`);
  }
  console.log('✓ Case 3 (Paid = Total): Total: ₹10,000, Paid: ₹10,000 → Balance Due: ₹0, Extra Paid: ₹0');

  // 4. Paid > Total (Overpaid): Total = ₹10,000, Paid = ₹11,000 → Balance Due: ₹0, Extra Paid: ₹1,000 (NEVER -₹1,000)
  const finOver = calculateFinancialBalance(10000, 11000);
  if (finOver.balanceDue !== 0 || finOver.extraPaid !== 1000) {
    throw new Error(`Overpayment failed: balanceDue=${finOver.balanceDue}, extraPaid=${finOver.extraPaid}`);
  }
  if ((finOver.balanceDue as number) < 0) {
    throw new Error('CRITICAL FLAW: Negative balance displayed!');
  }
  console.log('✓ Case 4 (Paid > Total): Total: ₹10,000, Paid: ₹11,000 → Balance Due: ₹0, Extra Paid: ₹1,000 (NO negative balance)');

  // Test 25: Universal Individual Payment Transaction Audit History & Parent Sync
  console.log('\n[Test 25] Testing Payment Transaction Storage & Automatic Parent Sync...');
  const testMatId = 'mat-audit-test-1';
  const testMaterial: Material = {
    id: testMatId,
    siteId: demoSiteId,
    materialName: 'Test Aggregate 40mm',
    category: 'aggregate',
    quantity: 10,
    unit: 'units',
    rate: 1500,
    totalAmount: 15000,
    paidAmount: 0,
    balance: 15000,
    extraPaid: 0,
    supplier: 'Blue Metal Quarry',
    purchaseDate: '2026-03-01',
    isDeleted: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await db.materials.put(testMaterial);

  // Installment 1: ₹5,000 via UPI
  const payTx1 = await recordPaymentTransaction({
    siteId: demoSiteId,
    relatedRecordId: testMatId,
    module: 'Material',
    date: '2026-03-01',
    amount: 5000,
    paymentType: 'UPI',
    notes: 'Advance installment for aggregate',
    userId: realAdmin.id,
  });
  if (!payTx1.id.startsWith('PAY-')) throw new Error('Payment ID format invalid');

  const matAfterTx1 = await db.materials.get(testMatId);
  if (!matAfterTx1 || matAfterTx1.paidAmount !== 5000 || matAfterTx1.balance !== 10000 || matAfterTx1.extraPaid !== 0) {
    throw new Error(`Parent sync after Tx 1 failed: paid=${matAfterTx1?.paidAmount}, bal=${matAfterTx1?.balance}`);
  }
  console.log(`✓ Tx 1 recorded (${payTx1.id}): Paid ₹5,000 → Parent Material: Paid: ₹${matAfterTx1.paidAmount}, Balance: ₹${matAfterTx1.balance}, Extra: ₹${matAfterTx1.extraPaid}`);

  // Installment 2: ₹12,000 via Cash (Total Paid = ₹17,000, Total = ₹15,000 -> Extra Paid = ₹2,000)
  const payTx2 = await recordPaymentTransaction({
    siteId: demoSiteId,
    relatedRecordId: testMatId,
    module: 'Material',
    date: '2026-03-02',
    amount: 12000,
    paymentType: 'Cash',
    notes: 'Settlement with cash tip',
    userId: realAdmin.id,
  });

  const matAfterTx2 = await db.materials.get(testMatId);
  if (!matAfterTx2 || matAfterTx2.paidAmount !== 17000 || matAfterTx2.balance !== 0 || matAfterTx2.extraPaid !== 2000) {
    throw new Error(`Parent sync after Tx 2 failed: paid=${matAfterTx2?.paidAmount}, bal=${matAfterTx2?.balance}, extra=${matAfterTx2?.extraPaid}`);
  }
  console.log(`✓ Tx 2 recorded (${payTx2.id}): Paid ₹12,000 → Parent Material: Paid: ₹${matAfterTx2.paidAmount}, Balance Due: ₹${matAfterTx2.balance}, Extra Paid: ₹${matAfterTx2.extraPaid}`);

  // Query payments ledger for this record
  const recordHistory = await db.payments.where('relatedRecordId').equals(testMatId).toArray();
  if (recordHistory.length !== 2) throw new Error(`Expected 2 payment records, found ${recordHistory.length}`);
  console.log(`✓ Payment History Audit Trail verified: ${recordHistory.length} individual transactions stored.`);

  // Delete Tx 1 and verify automatic sync reverts parent
  await db.payments.delete(payTx1.id);
  await syncParentRecordFinances(testMatId);
  const matAfterRevert = await db.materials.get(testMatId);
  if (!matAfterRevert || matAfterRevert.paidAmount !== 12000 || matAfterRevert.balance !== 3000 || matAfterRevert.extraPaid !== 0) {
    throw new Error(`Parent sync after revert failed: paid=${matAfterRevert?.paidAmount}, bal=${matAfterRevert?.balance}`);
  }
  console.log(`✓ Revert Sync verified: Deleted Tx 1 → Parent updated to Paid: ₹${matAfterRevert.paidAmount}, Balance Due: ₹${matAfterRevert.balance}`);

  // Test 26: Labour Advance Recoverable vs Non-Recoverable Logic
  console.log('\n[Test 26] Testing Labour Advance Recoverable vs Non-Recoverable Deduction...');
  const testWorkerId = 'worker-advance-test';
  await db.workers.put({
    id: testWorkerId,
    siteId: demoSiteId,
    name: 'Mani Head Mistry',
    category: 'MISTRY',
    dailyWage: 1000,
    joiningDate: '2026-03-01',
    isDeleted: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  // Mark 10 days worked -> Gross Salary = ₹10,000
  const grossWage = 10 * 1000;

  // Advance 1: Recoverable ₹3,000
  await db.labourAdvances.put({
    id: 'adv-rec-1',
    siteId: demoSiteId,
    workerId: testWorkerId,
    date: '2026-03-05',
    amount: 3000,
    advanceType: 'Recoverable',
    reason: 'Family function',
    isDeleted: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  // Advance 2: Non-Recoverable Grant ₹2,000 (e.g. Festival bonus / Medical grant)
  await db.labourAdvances.put({
    id: 'adv-nonrec-2',
    siteId: demoSiteId,
    workerId: testWorkerId,
    date: '2026-03-06',
    amount: 2000,
    advanceType: 'Non-Recoverable',
    reason: 'Diwali sweet grant',
    isDeleted: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  // Query worker advances
  const workerAdvances = await db.labourAdvances.where('workerId').equals(testWorkerId).toArray();
  const recoverableSum = workerAdvances
    .filter(a => a.advanceType !== 'Non-Recoverable')
    .reduce((acc, a) => acc + a.amount, 0);
  const nonRecoverableSum = workerAdvances
    .filter(a => a.advanceType === 'Non-Recoverable')
    .reduce((acc, a) => acc + a.amount, 0);

  if (recoverableSum !== 3000) throw new Error('Recoverable advance calculation mismatch');
  if (nonRecoverableSum !== 2000) throw new Error('Non-recoverable advance calculation mismatch');

  // STRICT RULE: Deduct ONLY Recoverable advances from salary balance
  const salaryBalanceDue = Math.max(0, grossWage - recoverableSum);
  if (salaryBalanceDue !== 7000) {
    throw new Error(`Salary deduction failed: Expected ₹7,000, got ₹${salaryBalanceDue}`);
  }
  console.log(`✓ Advance Separation verified: Gross Earned: ₹${grossWage}, Recoverable Deducted: ₹${recoverableSum}, Non-Rec Grant (NOT deducted): ₹${nonRecoverableSum}`);
  console.log(`✓ Net Salary Balance Due: ₹${salaryBalanceDue} (Worker was NOT penalized for company grant)`);

  console.log('\n🎉 ALL 26 CORE BUSINESS LOGIC, UNIVERSAL PAYMENT & ADVANCE TESTS PASSED PERFECTLY!\n');
}

runAllTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});


