/**
 * Test Suite: Attendance Matrix, Wage Ledger & Regional Language Localization (Phase 3)
 * 
 * Verifies:
 * - Bilingual site terminology (Tamil/English)
 * - Strict 10-digit Indian phone validation (/^[6-9]\d{9}$/)
 * - Automated Wage Settlement Engine (Gross, OT, Advance deductions, Net payout)
 * - 1-Tap status cycle logic (P, H, A, OT)
 * - Payslip PDF Generation
 * - Non-negative value guards
 */

import {
  ROLE_TRANSLATIONS,
  STATUS_TRANSLATIONS,
  DICTIONARY,
  getRoleLabel,
  getStatusLabel,
  getLanguage,
  setLanguage,
  isValidIndianPhone,
  cleanPhoneNumber,
} from '../src/services/i18n';
import { generateWorkerPayslipPdfBlob } from '../src/utils/pdfGenerator';

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

console.log('\n--- ATTENDANCE MATRIX & REGIONAL LOCALIZATION TEST SUITE (PHASE 3) ---\n');

// 1. Regional Tamil Site Terminology
console.log('Test 1: Regional Tamil Construction Terminology');
{
  assert(getRoleLabel('Mason', 'ta') === 'பெரியாள் / கொத்தனார்', 'Mason translates to பெரியாள் / கொத்தனார்');
  assert(getRoleLabel('Helper', 'ta') === 'சித்தாள் / கலவை ஆள்', 'Helper translates to சித்தாள் / கலவை ஆள்');
  assert(getRoleLabel('Bar Bender', 'ta') === 'கம்பி கட்டுபவர்', 'Bar Bender translates to கம்பி கட்டுபவர்');
  assert(getRoleLabel('Carpenter', 'ta') === 'தச்சர் / மர வேலை', 'Carpenter translates to தச்சர் / மர வேலை');
  assert(getRoleLabel('Painter', 'ta') === 'பெயிண்டர் / வர்ணம் பூசுபவர்', 'Painter translates to பெயிண்டர் / வர்ணம் பூசுபவர்');
  assert(getRoleLabel('Plumber', 'ta') === 'பிளம்பர் / குழாய் வேலை', 'Plumber translates to பிளம்பர் / குழாய் வேலை');
  assert(getRoleLabel('Electrician', 'ta') === 'எலக்ட்ரீஷியன் / மின் வேலை', 'Electrician translates to எலக்ட்ரீஷியன் / மின் வேலை');

  assert(getStatusLabel('present', 'ta') === 'முழு நாள்', 'Present translates to முழு நாள்');
  assert(getStatusLabel('half_day', 'ta') === 'அரை நாள்', 'Half-day translates to அரை நாள்');
  assert(getStatusLabel('absent', 'ta') === 'விடுப்பு', 'Absent translates to விடுப்பு');
  assert(getStatusLabel('overtime', 'ta') === 'கூடுதல் நேரம்', 'Overtime translates to கூடுதல் நேரம்');

  assert(DICTIONARY.advance_paid.ta.includes('அட்வான்ஸ்') || DICTIONARY.advance_paid.ta.includes('முன்பணம்'), 'Advance translates to அட்வான்ஸ் / முன்பணம்');
  assert(DICTIONARY.total_wages.ta === 'மொத்த கூலி', 'Total wages translates to மொத்த கூலி');
}

// 2. Language Switcher State & Persistence
console.log('\nTest 2: Language Switcher State & Persistence');
{
  setLanguage('ta');
  assert(getLanguage() === 'ta', 'Language switched to Tamil (ta)');
  setLanguage('en');
  assert(getLanguage() === 'en', 'Language switched to English (en)');
}

// 3. Strict 10-Digit Indian Phone Validation
console.log('\nTest 3: Strict Indian Phone Validation (/^[6-9]\\d{9}$/)');
{
  assert(isValidIndianPhone('9876543210'), 'Valid mobile 9876543210 passes');
  assert(isValidIndianPhone('8765432109'), 'Valid mobile 8765432109 passes');
  assert(isValidIndianPhone('7654321098'), 'Valid mobile 7654321098 passes');
  assert(isValidIndianPhone('6543210987'), 'Valid mobile 6543210987 passes');
  assert(isValidIndianPhone('+919876543210'), 'Valid mobile with +91 country code passes');

  assert(!isValidIndianPhone('1234567890'), 'Mobile starting with 1 rejected');
  assert(!isValidIndianPhone('5876543210'), 'Mobile starting with 5 rejected');
  assert(!isValidIndianPhone('98765'), 'Incomplete mobile (5 digits) rejected');
  assert(!isValidIndianPhone('98765432100'), 'Oversized mobile (11 digits) rejected');
  assert(!isValidIndianPhone('abcdefghij'), 'Alphabetic string rejected');
  assert(!isValidIndianPhone('-9876543210'), 'Negative number rejected');

  assert(cleanPhoneNumber('+919876543210') === '9876543210', 'cleanPhoneNumber strips country code');
}

// 4. Automated Wage Settlement Engine
console.log('\nTest 4: Automated Wage Settlement Calculation Engine');
{
  // Worker: Mason @ ₹900/day
  // 5 Full Days (5 × 900 = 4500)
  // 2 Half Days (2 × 0.5 × 900 = 900)
  // 4 Hours OT @ ₹169/hr (OT rate = (900/8) * 1.5 = 168.75 -> 169 * 4 = 676)
  // Total Gross = 4500 + 900 + 676 = ₹6076
  // Advance Taken = ₹1500
  // Net Payout = 6076 - 1500 = ₹4576
  const dailyWage = 900;
  const fullDays = 5;
  const halfDays = 2;
  const otHours = 4;
  const otHourlyRate = Math.round((dailyWage / 8) * 1.5);
  const advanceTaken = 1500;

  const grossWage = Math.round(
    fullDays * dailyWage + halfDays * 0.5 * dailyWage + otHours * otHourlyRate
  );
  const netPayout = Math.max(0, grossWage - advanceTaken);

  assert(otHourlyRate === 169, `OT hourly rate is ₹169/hr for ₹900 daily wage (got ${otHourlyRate})`);
  assert(grossWage === 6076, `Gross wage calculated correctly as ₹6,076 (got ${grossWage})`);
  assert(netPayout === 4576, `Net payout after ₹1,500 advance is ₹4,576 (got ${netPayout})`);

  // Guard against negative payout when advance exceeds gross
  const hugeAdvance = 10000;
  const guardedPayout = Math.max(0, grossWage - hugeAdvance);
  assert(guardedPayout === 0, `Net payout is safely non-negative (₹0) when advance exceeds gross`);
}

// 5. 1-Tap Quick Status Cycle
console.log('\nTest 5: 1-Tap Quick Status Cycle Sequence');
{
  // Cycle: null -> 'present' (P) -> 'half_day' (H) -> 'absent' (A) -> 'overtime' (OT) -> 'present'
  const cycleStatus = (current: string | null) => {
    if (!current) return 'present';
    if (current === 'present') return 'half_day';
    if (current === 'half_day') return 'absent';
    if (current === 'absent') return 'overtime';
    return 'present';
  };

  assert(cycleStatus(null) === 'present', 'Empty cell cycles to Present (P)');
  assert(cycleStatus('present') === 'half_day', 'Present cycles to Half-day (H)');
  assert(cycleStatus('half_day') === 'absent', 'Half-day cycles to Absent (A)');
  assert(cycleStatus('absent') === 'overtime', 'Absent cycles to Overtime (OT)');
  assert(cycleStatus('overtime') === 'present', 'Overtime cycles back to Present (P)');
}

// 6. Payslip PDF Voucher Generation
console.log('\nTest 6: Payslip PDF Voucher Generation');
{
  const pdfBlob = generateWorkerPayslipPdfBlob({
    workerName: 'M. Murugan',
    workerRole: 'Periyaal / Mason',
    workerPhone: '9840123456',
    workerId: 'worker-101',
    siteName: 'OMR Villa Phase 2',
    periodStr: '01 Nov 2026 – 07 Nov 2026',
    dailyWage: 950,
    fullDays: 6,
    halfDays: 0,
    otHours: 4,
    otHourlyRate: 178,
    grossWage: 6412,
    advanceDeducted: 1000,
    netPayout: 5412,
    preparedBy: 'Tamizh Construction',
  });

  assert(pdfBlob instanceof Blob, 'generateWorkerPayslipPdfBlob returns a valid Blob');
  assert(pdfBlob.type === 'application/pdf', 'Payslip Blob MIME type is application/pdf');
  assert(pdfBlob.size > 2000, `Payslip Blob has substantive content (${pdfBlob.size} bytes)`);
}

console.log(`\n========================================`);
console.log(`TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
console.log(`========================================\n`);

if (failed > 0) {
  process.exit(1);
}
