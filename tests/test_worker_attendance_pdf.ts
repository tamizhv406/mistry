/**
 * Test Suite: Worker Attendance PDF (Task 6)
 *
 * Verifies:
 * 1. Day-by-day calendar generation for 28-, 29-, 30-, and 31-day months
 * 2. Attendance multipliers & leave policy rules match src/domain/salary.ts 100%
 * 3. Wages, advances, salary payments, prior balance, and net pay match buildWorkerLedger/summariseMonth
 * 4. Real PDF Blob generation (%PDF header, valid size, %%EOF) for populated & zero-attendance months
 * 5. Printable HTML escaping, signature blocks, and >= 44px mobile-first UI wiring
 */

import fs from 'node:fs';
import path from 'node:path';
import type { AttendanceRecord, LabourAdvance, LabourWorker, SalaryPayment } from '../src/db/types';
import { buildWorkerLedger, buildWorkerMonthlyStatement, summariseMonth } from '../src/domain/salary';
import {
  buildWorkerMonthlyPrintHtml,
  generateWorkerMonthlyAttendancePdfBlob,
  workerMonthlyPdfFilename,
} from '../src/utils/pdfGenerator';

let passed = 0;
let failed = 0;

function check(condition: boolean, msg: string, detail?: unknown) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${msg}`);
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${msg}${detail !== undefined ? ` — got ${JSON.stringify(detail)}` : ''}`);
  }
}

const root = process.cwd();
const read = (relPath: string) => fs.readFileSync(path.join(root, relPath), 'utf8');

async function run() {
  console.log('\n--- TASK 6: WORKER ATTENDANCE PDF TEST SUITE ---\n');

  const stamp = '2026-11-25T06:00:00.000Z';
  const worker: LabourWorker = {
    id: 'worker-murugan-01',
    siteId: 'site-alpha',
    name: 'Murugan S',
    phone: '9876543210',
    category: 'MISTRY',
    dailyWage: 900,
    joiningDate: '2026-09-01',
    isDeleted: false,
    createdAt: stamp,
    updatedAt: stamp,
  };

  // 1. Month lengths: 28, 29, 30, 31 days
  console.log('1. Calendar month lengths (28, 29, 30, 31 days)');
  const febNonLeap = buildWorkerMonthlyStatement({
    projectId: 'site-alpha',
    projectName: 'Villa Alpha',
    worker,
    month: '2026-02',
    attendance: [],
    advances: [],
    payments: [],
  });
  const febLeap = buildWorkerMonthlyStatement({
    projectId: 'site-alpha',
    projectName: 'Villa Alpha',
    worker,
    month: '2024-02',
    attendance: [],
    advances: [],
    payments: [],
  });
  const nov30 = buildWorkerMonthlyStatement({
    projectId: 'site-alpha',
    projectName: 'Villa Alpha',
    worker,
    month: '2026-11',
    attendance: [],
    advances: [],
    payments: [],
  });
  const dec31 = buildWorkerMonthlyStatement({
    projectId: 'site-alpha',
    projectName: 'Villa Alpha',
    worker,
    month: '2026-12',
    attendance: [],
    advances: [],
    payments: [],
  });

  check(febNonLeap.daysInMonth === 28 && febNonLeap.days[27]?.date === '2026-02-28', 'Generates 28 calendar days for Feb 2026');
  check(febLeap.daysInMonth === 29 && febLeap.days[28]?.date === '2024-02-29', 'Generates 29 calendar days for leap Feb 2024');
  check(nov30.daysInMonth === 30 && nov30.days[29]?.date === '2026-11-30', 'Generates 30 calendar days for Nov 2026');
  check(dec31.daysInMonth === 31 && dec31.days[30]?.date === '2026-12-31', 'Generates 31 calendar days for Dec 2026');

  // 2. Exact parity with buildWorkerLedger & summariseMonth
  console.log('\n2. Attendance multipliers, leave policy & wage parity with salary.ts');
  const attendance: AttendanceRecord[] = [
    // Prior month (Oct 2026) -> 1 present = 900 earned
    {
      id: 'att-oct-1',
      siteId: 'site-alpha',
      workerId: worker.id,
      date: '2026-10-30',
      status: 'present',
      dayMultiplier: 1,
      isDeleted: false,
      createdAt: stamp,
      updatedAt: stamp,
    },
    // Nov 2026 statuses:
    {
      id: 'att-nov-1',
      siteId: 'site-alpha',
      workerId: worker.id,
      date: '2026-11-01',
      status: 'present',
      dayMultiplier: 1,
      notes: 'Slab concrete work',
      isDeleted: false,
      createdAt: stamp,
      updatedAt: stamp,
    },
    {
      id: 'att-nov-2',
      siteId: 'site-alpha',
      workerId: worker.id,
      date: '2026-11-02',
      status: 'half_day',
      dayMultiplier: 0.5,
      notes: 'Left afternoon',
      editHistory: [{ at: stamp, from: 'present', to: 'half_day', reason: 'Half day' }],
      isDeleted: false,
      createdAt: stamp,
      updatedAt: stamp,
    },
    {
      id: 'att-nov-3',
      siteId: 'site-alpha',
      workerId: worker.id,
      date: '2026-11-03',
      status: 'overtime',
      dayMultiplier: 1.5,
      notes: 'Evening shuttering',
      isDeleted: false,
      createdAt: stamp,
      updatedAt: stamp,
    },
    {
      id: 'att-nov-4',
      siteId: 'site-alpha',
      workerId: worker.id,
      date: '2026-11-04',
      status: 'absent',
      dayMultiplier: 0,
      isDeleted: false,
      createdAt: stamp,
      updatedAt: stamp,
    },
    {
      id: 'att-nov-5',
      siteId: 'site-alpha',
      workerId: worker.id,
      date: '2026-11-05',
      status: 'leave',
      dayMultiplier: 0,
      isDeleted: false,
      createdAt: stamp,
      updatedAt: stamp,
    },
    // Day with wage snapshot (1000 instead of 900)
    {
      id: 'att-nov-6',
      siteId: 'site-alpha',
      workerId: worker.id,
      date: '2026-11-06',
      status: 'present',
      dayMultiplier: 1,
      dailyWageSnapshot: 1000,
      isDeleted: false,
      createdAt: stamp,
      updatedAt: stamp,
    },
    // Soft-deleted attendance should be ignored
    {
      id: 'att-nov-deleted',
      siteId: 'site-alpha',
      workerId: worker.id,
      date: '2026-11-07',
      status: 'present',
      dayMultiplier: 1,
      isDeleted: true,
      createdAt: stamp,
      updatedAt: stamp,
    },
  ];

  const advances: LabourAdvance[] = [
    {
      id: 'adv-1',
      siteId: 'site-alpha',
      workerId: worker.id,
      date: '2026-11-04',
      amount: 1000,
      advanceType: 'Recoverable',
      reason: 'Medical need',
      isDeleted: false,
      createdAt: stamp,
      updatedAt: stamp,
    },
    {
      id: 'adv-2',
      siteId: 'site-alpha',
      workerId: worker.id,
      date: '2026-11-05',
      amount: 500,
      advanceType: 'Non-Recoverable',
      reason: 'Festival gift',
      isDeleted: false,
      createdAt: stamp,
      updatedAt: stamp,
    },
  ];

  const payments: SalaryPayment[] = [
    {
      id: 'pay-oct',
      siteId: 'site-alpha',
      workerId: worker.id,
      date: '2026-10-31',
      daysWorked: 1,
      grossSalary: 900,
      advanceDeducted: 0,
      netPaid: 500,
      paidAmount: 500,
      paymentMode: 'Cash',
      isDeleted: false,
      createdAt: stamp,
      updatedAt: stamp,
    },
    {
      id: 'pay-nov',
      siteId: 'site-alpha',
      workerId: worker.id,
      date: '2026-11-10',
      daysWorked: 4,
      grossSalary: 3700,
      advanceDeducted: 1000,
      netPaid: 1200,
      paidAmount: 1200,
      paymentMode: 'UPI',
      isDeleted: false,
      createdAt: stamp,
      updatedAt: stamp,
    },
  ];

  // Unpaid leave case:
  // Nov worked days: 1 (P) + 0.5 (½) + 1.5 (OT) + 0 (A) + 0 (Unpaid L) + 1 (P@1000) = 4.0 days
  // Nov gross = 900 + 450 + 1350 + 0 + 0 + 1000 = 3700
  const unpaidLedger = buildWorkerLedger(worker, attendance, advances, payments, { leavePaid: false });
  const unpaidSummary = summariseMonth(unpaidLedger, '2026-11');
  const unpaidStatement = buildWorkerMonthlyStatement({
    projectId: 'site-alpha',
    projectName: 'Villa Alpha',
    worker,
    month: '2026-11',
    attendance,
    advances,
    payments,
    policy: { leavePaid: false },
  });

  check(unpaidStatement.counts.present === 2, 'Counts Present days accurately (2)', unpaidStatement.counts);
  check(unpaidStatement.counts.half_day === 1, 'Counts Half Day accurately (1)');
  check(unpaidStatement.counts.overtime === 1, 'Counts Overtime accurately (1)');
  check(unpaidStatement.counts.absent === 1, 'Counts Absent days accurately (1)');
  check(unpaidStatement.counts.leave === 1 && unpaidStatement.counts.unpaid_leave === 1, 'Counts Unpaid Leave accurately');
  check(unpaidStatement.counts.unmarked === 24, 'Remaining 24 days marked Unmarked (ignored deleted day)', unpaidStatement.counts.unmarked);
  check(
    unpaidStatement.workedDayEquivalents === unpaidSummary.workedDayEquivalents && unpaidStatement.workedDayEquivalents === 4,
    'Payable days match summariseMonth (4 days)',
  );
  check(
    unpaidStatement.grossEarned === unpaidSummary.earned && unpaidStatement.grossEarned === 3700,
    'Gross earned wages match summariseMonth including dailyWageSnapshot (₹3,700)',
  );
  check(
    unpaidStatement.totalAdvancesDeducted === unpaidSummary.recoverableAdvances && unpaidStatement.totalAdvancesDeducted === 1000,
    'Only recoverable advances deducted (₹1,000); non-recoverable excluded',
  );
  check(unpaidStatement.totalNonRecoverableAdvances === 500, 'Non-recoverable gift tracked separately (₹500)');
  check(
    unpaidStatement.totalSalaryPaid === unpaidSummary.salaryPaid && unpaidStatement.totalSalaryPaid === 1200,
    'Monthly salary paid matches summariseMonth (₹1,200)',
  );
  check(unpaidStatement.monthNetPay === 1500, 'Month net pay = 3700 - 1000 - 1200 = ₹1,500', unpaidStatement.monthNetPay);
  check(unpaidStatement.priorNetBalance === 400, 'Prior Oct balance carried in = 900 - 500 = ₹400', unpaidStatement.priorNetBalance);
  check(
    unpaidStatement.overallPending === unpaidLedger.pending && unpaidStatement.overallPending === 1900,
    'Overall pending matches buildWorkerLedger.pending (₹1,900)',
    { stmt: unpaidStatement.overallPending, ledger: unpaidLedger.pending },
  );

  // Paid leave case (leavePaid: true adds +1 day = +₹900):
  const paidLedger = buildWorkerLedger(worker, attendance, advances, payments, { leavePaid: true });
  const paidSummary = summariseMonth(paidLedger, '2026-11');
  const paidStatement = buildWorkerMonthlyStatement({
    projectId: 'site-alpha',
    projectName: 'Villa Alpha',
    worker,
    month: '2026-11',
    attendance,
    advances,
    payments,
    policy: { leavePaid: true },
  });
  check(paidStatement.counts.paid_leave === 1 && paidStatement.days[4].statusLabel === 'Paid Leave', 'Paid leave labels day as Paid Leave');
  check(
    paidStatement.workedDayEquivalents === paidSummary.workedDayEquivalents && paidStatement.workedDayEquivalents === 5,
    'Paid leave adds 1 worked day (5 days)',
  );
  check(
    paidStatement.grossEarned === paidSummary.earned && paidStatement.grossEarned === 4600,
    'Paid leave increases gross wage to match summariseMonth (₹4,600)',
  );
  check(
    paidStatement.overallPending === paidLedger.pending && paidStatement.overallPending === 2800,
    'Paid leave overall balance matches buildWorkerLedger.pending (₹2,800)',
  );

  // 3. Real PDF Blob output for populated & empty months
  console.log('\n3. Real PDF Blob generation (%PDF header, valid size, %%EOF)');
  const populatedPdf = generateWorkerMonthlyAttendancePdfBlob(unpaidStatement);
  const populatedBytes = new Uint8Array(await populatedPdf.arrayBuffer());
  const populatedText = new TextDecoder('latin1').decode(populatedBytes);
  check(populatedPdf.type === 'application/pdf', 'Populated PDF Blob has application/pdf MIME type');
  check(populatedBytes.length > 2500, 'Populated PDF Blob has substantial size', populatedBytes.length);
  check(populatedText.startsWith('%PDF-'), 'Populated PDF starts with %PDF- signature');
  check(populatedText.trimEnd().endsWith('%%EOF'), 'Populated PDF ends with %%EOF trailer');

  const emptyPdf = generateWorkerMonthlyAttendancePdfBlob(nov30);
  const emptyBytes = new Uint8Array(await emptyPdf.arrayBuffer());
  const emptyText = new TextDecoder('latin1').decode(emptyBytes);
  check(emptyPdf.type === 'application/pdf', 'Zero-attendance PDF Blob has application/pdf MIME type');
  check(emptyBytes.length > 1500 && emptyText.startsWith('%PDF-') && emptyText.trimEnd().endsWith('%%EOF'), 'Zero-attendance PDF builds cleanly without errors');

  const filename = workerMonthlyPdfFilename(unpaidStatement);
  check(filename === 'SiteMistry_Attendance_Murugan_S_2026-11.pdf', 'Formats clean download filename', filename);

  // 4. Print HTML & XSS escaping + UI integration
  console.log('\n4. Print HTML structure & mobile/desktop UI integration');
  const html = buildWorkerMonthlyPrintHtml({
    ...unpaidStatement,
    workerName: '<script>alert(1)</script>Raju',
  });
  check(!html.includes('<script>alert(1)</script>'), 'Escapes untrusted text inside printable HTML');
  check(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;Raju'), 'Preserves escaped worker name in print output');
  check(html.includes('Worker Signature') && html.includes('Site Manager Signature'), 'Includes signature lines for print');
  check(html.includes('#F97316') && html.includes('#1F2937') && html.includes('#16A34A') && html.includes('#DC2626'), 'Uses SiteMistry colour palette in print layout');

  const modalSrc = read('src/components/WorkerAttendancePdfModal.tsx');
  const erpCss = read('src/styles/erp-views.css');
  const labourView = read('src/views/mobile/LabourView.tsx');
  const profileView = read('src/views/mobile/WorkerProfileView.tsx');
  const attendanceView = read('src/views/AttendanceSalaryView.tsx');
  const wageSlip = read('src/components/WageSlipModal.tsx');
  const reportsTab = read('src/views/site-tabs/ReportsTab.tsx');

  check(
    modalSrc.includes('Download PDF') && modalSrc.includes('Print') && modalSrc.includes('type="month"') && modalSrc.includes('<select'),
    'WorkerAttendancePdfModal exposes worker selector, month selector, Download PDF, and Print controls',
  );
  check(labourView.includes('<WorkerAttendancePdfModal'), 'Mobile LabourView integrates WorkerAttendancePdfModal');
  check(profileView.includes('<WorkerAttendancePdfModal') && profileView.includes('Attendance PDF'), 'Mobile WorkerProfileView integrates WorkerAttendancePdfModal');
  check(attendanceView.includes('<WorkerAttendancePdfModal') && wageSlip.includes('generateWorkerMonthlyAttendancePdfBlob'), 'Desktop AttendanceSalaryView and WageSlipModal integrate monthly PDF & print');
  check(reportsTab.includes('<WorkerAttendancePdfModal'), 'Project ReportsTab integrates WorkerAttendancePdfModal');

  for (const cls of ['.wpdf-close-btn', '.wpdf-step-btn', '.wpdf-btn']) {
    const start = erpCss.indexOf(cls);
    const block = start >= 0 ? erpCss.slice(start, erpCss.indexOf('}', start)) : '';
    check(block.includes('min-height: 44px'), `${cls} enforces >= 44px touch target height`);
  }

  console.log(`\nSummary: ${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
