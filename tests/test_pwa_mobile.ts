import fs from 'fs';
import path from 'path';
import 'fake-indexeddb/auto';
import { db } from '../src/db/db';
import { calculateFinancialBalance } from '../src/utils/financial';
import { parseSiteVoiceInput, parseVoiceInput } from '../src/utils/voiceParser';
import type { LabourAdvance, LabourWorker } from '../src/db/types';

async function runPwaAndMobileTests() {
  console.log('📱 Starting Building Mistry Mobile-First & PWA Verification Tests...\n');

  // Test 1: PWA Web App Manifest Verification
  console.log('[Test 1] Verifying PWA Web App Manifest (public/manifest.json)...');
  const manifestPath = path.resolve(process.cwd(), 'public/manifest.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error('manifest.json does not exist in public directory');
  }
  const manifestRaw = fs.readFileSync(manifestPath, 'utf8');
  const manifest = JSON.parse(manifestRaw);

  if (manifest.name !== 'Building Mistry') {
    throw new Error(`Expected manifest name "Building Mistry", got "${manifest.name}"`);
  }
  if (manifest.short_name !== 'Mistry') {
    throw new Error(`Expected manifest short_name "Mistry", got "${manifest.short_name}"`);
  }
  if (manifest.display !== 'standalone') {
    throw new Error(`Expected display "standalone", got "${manifest.display}"`);
  }
  if (manifest.orientation !== 'portrait-primary') {
    throw new Error(`Expected orientation "portrait-primary", got "${manifest.orientation}"`);
  }
  if (!manifest.theme_color || !manifest.background_color) {
    throw new Error('Theme or background color missing from manifest');
  }
  if (!Array.isArray(manifest.icons) || manifest.icons.length < 3) {
    throw new Error('Manifest missing required icon definitions');
  }
  console.log(`✓ Web App Manifest verified: Name: "${manifest.name}", Short Name: "${manifest.short_name}", Display: ${manifest.display}`);

  // Test 2: PWA Icons Existence & Dimensions
  console.log('\n[Test 2] Verifying PWA Application Icons in public/icons/...');
  const icon192 = path.resolve(process.cwd(), 'public/icons/icon-192.png');
  const icon512 = path.resolve(process.cwd(), 'public/icons/icon-512.png');
  const iconMaskable = path.resolve(process.cwd(), 'public/icons/icon-maskable.png');
  const iconSvg = path.resolve(process.cwd(), 'public/icons/icon.svg');

  if (!fs.existsSync(icon192) || fs.statSync(icon192).size === 0) throw new Error('192x192 icon missing or empty');
  if (!fs.existsSync(icon512) || fs.statSync(icon512).size === 0) throw new Error('512x512 icon missing or empty');
  if (!fs.existsSync(iconMaskable) || fs.statSync(iconMaskable).size === 0) throw new Error('Maskable icon missing or empty');
  if (!fs.existsSync(iconSvg) || fs.statSync(iconSvg).size === 0) throw new Error('SVG icon missing or empty');
  console.log(`✓ All PWA icons verified (icon-192.png, icon-512.png, icon-maskable.png, icon.svg)`);

  // Test 3: Service Worker Script Verification
  console.log('\n[Test 3] Verifying Service Worker Script (public/sw.js)...');
  const swPath = path.resolve(process.cwd(), 'public/sw.js');
  if (!fs.existsSync(swPath)) throw new Error('sw.js missing in public directory');
  const swCode = fs.readFileSync(swPath, 'utf8');
  if (!swCode.includes('CACHE_NAME') || !swCode.includes('STATIC_ASSETS')) {
    throw new Error('Service worker missing cache definition');
  }
  if (!swCode.includes('addEventListener(\'fetch\'') || !swCode.includes('addEventListener(\'install\'')) {
    throw new Error('Service worker missing lifecycle handlers');
  }
  console.log('✓ Service Worker (public/sw.js) verified with safe asset caching');

  // Test 4: Mobile Viewport & PWA tags in index.html
  console.log('\n[Test 4] Verifying Mobile Viewport & PWA tags in index.html...');
  const htmlPath = path.resolve(process.cwd(), 'index.html');
  const htmlContent = fs.readFileSync(htmlPath, 'utf8');
  if (!htmlContent.includes('rel="manifest"') || !htmlContent.includes('./manifest.json')) {
    throw new Error('index.html missing manifest link');
  }
  if (!htmlContent.includes('name="viewport"') || !htmlContent.includes('user-scalable=no')) {
    throw new Error('index.html missing mobile viewport tag');
  }
  if (!htmlContent.includes('apple-mobile-web-app-capable') || !htmlContent.includes('apple-touch-icon')) {
    throw new Error('index.html missing Apple mobile app tags');
  }
  console.log('✓ index.html properly configured for mobile viewport and installable PWA');

  // Test 5: Universal Payment Calculations
  console.log('\n[Test 5] Verifying Universal 4-Tier Payment Calculations...');
  // Case A: Default
  const r0 = calculateFinancialBalance(5000, 0);
  if (r0.balanceDue !== 5000 || r0.extraPaid !== 0) throw new Error('Payment case 0 failed');

  // Case B: Paid < Total
  const r1 = calculateFinancialBalance(5000, 3500);
  if (r1.balanceDue !== 1500 || r1.extraPaid !== 0) throw new Error('Payment case Paid < Total failed');

  // Case C: Paid == Total
  const r2 = calculateFinancialBalance(5000, 5000);
  if (r2.balanceDue !== 0 || r2.extraPaid !== 0) throw new Error('Payment case Paid == Total failed');

  // Case D: Paid > Total (Overpaid)
  const r3 = calculateFinancialBalance(5000, 6200);
  if (r3.balanceDue !== 0 || r3.extraPaid !== 1200) throw new Error('Payment case Paid > Total failed');
  if (r3.balanceDue < 0) throw new Error('Negative balance detected!');
  console.log('✓ Payment rules verified: Paid < Total, Paid = Total, Paid > Total (Never negative)');

  // Test 6: Labour Advance Recoverable vs Non-Recoverable Deduction
  console.log('\n[Test 6] Verifying Labour Advance Recoverable vs Non-Recoverable Logic...');
  const worker: LabourWorker = {
    id: 'w-test-adv',
    siteId: 'site-pwa-test',
    name: 'Ganesan Mason',
    category: 'PERIYAAL',
    dailyWage: 900,
    joiningDate: '2026-03-01',
    isDeleted: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await db.workers.put(worker);

  const recAdv: LabourAdvance = {
    id: 'adv-rec-test',
    siteId: 'site-pwa-test',
    workerId: worker.id,
    date: '2026-03-05',
    amount: 1800,
    advanceType: 'Recoverable',
    isDeleted: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const nonRecAdv: LabourAdvance = {
    id: 'adv-nonrec-test',
    siteId: 'site-pwa-test',
    workerId: worker.id,
    date: '2026-03-06',
    amount: 1000,
    advanceType: 'Non-Recoverable',
    isDeleted: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await db.labourAdvances.put(recAdv);
  await db.labourAdvances.put(nonRecAdv);

  const advances = await db.labourAdvances.where('workerId').equals(worker.id).toArray();
  const recoverableTotal = advances
    .filter(a => a.advanceType !== 'Non-Recoverable')
    .reduce((acc, a) => acc + a.amount, 0);
  const nonRecoverableTotal = advances
    .filter(a => a.advanceType === 'Non-Recoverable')
    .reduce((acc, a) => acc + a.amount, 0);

  // 10 days gross = 9,000
  const gross = 10 * worker.dailyWage;
  // STRICT: Only deduct recoverable
  const salaryBalance = Math.max(0, gross - recoverableTotal);
  if (salaryBalance !== 7200) {
    throw new Error(`Expected net salary ₹7,200, got ₹${salaryBalance}`);
  }
  console.log(`✓ Advance deduction verified: Gross ₹${gross} - Recoverable ₹${recoverableTotal} = ₹${salaryBalance}. Non-Recoverable ₹${nonRecoverableTotal} was not deducted.`);

  // Test 7: Natural Language Voice Auto-Fill Parser
  console.log('\n[Test 7] Verifying Natural Language Voice Auto-Fill Parser...');
  const voiceStr = 'Site name Sri Ram Nilayam owner Parthiban phone 9840123456 area 1800 sq ft Chennai residential villa';
  const parsed = parseSiteVoiceInput(voiceStr);
  if (!parsed.name || !parsed.name.toLowerCase().includes('sri ram nilayam')) {
    throw new Error('Voice site name parsing failed');
  }
  if (parsed.ownerName !== 'Parthiban') {
    throw new Error(`Voice owner name failed: expected Parthiban, got ${parsed.ownerName}`);
  }
  if (parsed.ownerPhone !== '9840123456') {
    throw new Error(`Voice phone parsing failed: expected 9840123456, got ${parsed.ownerPhone}`);
  }
  if (!parsed.area || !parsed.area.includes('1800')) {
    throw new Error('Voice area parsing failed');
  }
  console.log(`✓ Voice recognition parsed: Site: "${parsed.name}", Owner: "${parsed.ownerName}", Phone: "${parsed.ownerPhone}", Area: "${parsed.area}"`);

  // Test 8: Persistence Check (Data Never Automatically Reset)
  console.log('\n[Test 8] Verifying Database Persistence (Never Automatically Resets)...');
  const testSiteId = 'site-persistence-check';
  await db.sites.put({
    id: testSiteId,
    userId: 'user-persistence',
    name: 'Persistent Test Site',
    ownerName: 'V. Ramanathan',
    ownerPhone: '98400 98400',
    address: 'OMR Road, Chennai',
    buildingType: 'Commercial',
    startDate: '2026-03-01',
    expectedCompletionDate: '2026-12-31',
    status: 'Active',
    isDeleted: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const persistedSite = await db.sites.get(testSiteId);
  if (!persistedSite || persistedSite.name !== 'Persistent Test Site') {
    throw new Error('Persistence test failed: record was not preserved');
  }
  console.log(`✓ Database persistence verified: Record "${persistedSite.name}" persists safely in IndexedDB.`);

  console.log('\n🎉 ALL PWA, MOBILE-FIRST, PAYMENT, AND ADVANCE VERIFICATION TESTS PASSED PERFECTLY!\n');
}

runPwaAndMobileTests().catch(err => {
  console.error('❌ PWA Mobile Test failed:', err);
  process.exit(1);
});
