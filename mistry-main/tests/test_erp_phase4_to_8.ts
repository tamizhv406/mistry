import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MinimalPdfDocument, generateLabourSalaryReportPdfBlob } from '../src/utils/pdfGenerator';
import { buildWorkerLedger } from '../src/domain/salary';
import { isHouseOwner, isSuperAdmin, isAdmin } from '../src/services/auth';
import type { LabourWorker, AttendanceRecord, LabourAdvance, SalaryPayment, User } from '../src/db/types';

describe('[ERP Phase 4 - 8] Payroll PDF, Overtime Ledger & Role Security', () => {
  it('generates standard A4 PDF for Labour Muster Roll & Salary Statement', async () => {
    const blob = generateLabourSalaryReportPdfBlob({
      projectName: 'Green Villa Residency',
      projectAddress: '42 Gandhi Road, Chennai',
      monthName: 'October 2026',
      generatedDate: '05 Nov 2026',
      totalWorkers: 3,
      totalDaysWorked: 45,
      totalEarned: 45000,
      totalAdvance: 6000,
      totalPaid: 30000,
      totalBalanceDue: 9000,
      items: [
        {
          workerName: 'Murugan K',
          category: 'MISTRY',
          dailyRate: 1000,
          workedDays: 20,
          earnedAmount: 20000,
          advanceDeducted: 3000,
          salaryPaid: 12000,
          balanceDue: 5000,
        },
        {
          workerName: 'Senthil Kumar',
          category: 'PERIYAAL',
          dailyRate: 800,
          workedDays: 15,
          earnedAmount: 12000,
          advanceDeducted: 2000,
          salaryPaid: 8000,
          balanceDue: 2000,
        },
        {
          workerName: 'Priya R',
          category: 'CHITHAAL',
          dailyRate: 650,
          workedDays: 20,
          earnedAmount: 13000,
          advanceDeducted: 1000,
          salaryPaid: 10000,
          balanceDue: 2000,
        },
      ],
    });

    assert.ok(blob instanceof Blob, 'Output must be an instance of Blob');
    assert.equal(blob.type, 'application/pdf', 'MIME type must be application/pdf');

    const arrayBuffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    const text = new TextDecoder().decode(bytes);

    assert.ok(text.startsWith('%PDF-1.4'), 'Must start with PDF 1.4 header');
    assert.ok(text.includes('%%EOF'), 'Must end with PDF EOF marker');
    assert.ok(text.includes('WORKFORCE MUSTER ROLL'), 'Must contain header');
    assert.ok(text.includes('Green Villa Residency'), 'Must contain project name');
    assert.ok(text.includes('Murugan K'), 'Must contain worker name');
  });

  it('correctly calculates overtime shifts with 1.5x wage multiplier in Worker Ledger', () => {
    const worker: LabourWorker = {
      id: 'w-test-1',
      siteId: 'site-1',
      name: 'Ramesh',
      category: 'MISTRY',
      dailyWage: 1000,
      phone: '9876543210',
      isDeleted: false,
      createdAt: '2026-10-01',
      updatedAt: '2026-10-01',
    };

    const attendance: AttendanceRecord[] = [
      {
        id: 'att-1',
        siteId: 'site-1',
        workerId: 'w-test-1',
        date: '2026-10-01',
        status: 'present',
        dayMultiplier: 1,
        wageRateOnDay: 1000,
        isDeleted: false,
        createdAt: '2026-10-01',
        updatedAt: '2026-10-01',
      },
      {
        id: 'att-2',
        siteId: 'site-1',
        workerId: 'w-test-1',
        date: '2026-10-02',
        status: 'overtime',
        dayMultiplier: 1.5,
        wageRateOnDay: 1000,
        isDeleted: false,
        createdAt: '2026-10-02',
        updatedAt: '2026-10-02',
      },
      {
        id: 'att-3',
        siteId: 'site-1',
        workerId: 'w-test-1',
        date: '2026-10-03',
        status: 'half_day',
        dayMultiplier: 0.5,
        wageRateOnDay: 1000,
        isDeleted: false,
        createdAt: '2026-10-03',
        updatedAt: '2026-10-03',
      },
    ];

    const advances: LabourAdvance[] = [
      {
        id: 'adv-1',
        siteId: 'site-1',
        workerId: 'w-test-1',
        date: '2026-10-02',
        amount: 500,
        repaymentType: 'recoverable',
        isDeleted: false,
        createdAt: '2026-10-02',
        updatedAt: '2026-10-02',
      },
    ];

    const payments: SalaryPayment[] = [
      {
        id: 'pay-1',
        siteId: 'site-1',
        workerId: 'w-test-1',
        date: '2026-10-04',
        paidAmount: 1500,
        isDeleted: false,
        createdAt: '2026-10-04',
        updatedAt: '2026-10-04',
      },
    ];

    const ledger = buildWorkerLedger(worker, attendance, advances, payments, {});

    // 1 present (1.0) + 1 overtime (1.5) + 1 half day (0.5) = 3.0 equivalent days
    assert.equal(ledger.workedDayEquivalents, 3, 'Worked days should sum to 3.0');
    // Earned = 3 * 1000 = 3000
    assert.equal(ledger.earned, 3000, 'Earned should be 3000');
    assert.equal(ledger.recoverableAdvances, 500, 'Recoverable advances should be 500');
    assert.equal(ledger.salaryPaid, 1500, 'Salary paid should be 1500');
    // Pending = 3000 - 1500 - 500 = 1000
    assert.equal(ledger.pending, 1000, 'Pending wage balance should be 1000');
  });

  it('validates client mode role detection and access controls', () => {
    const clientUser: User = {
      id: 'client-1',
      username: 'client_owner',
      fullName: 'S. Rajendran',
      role: 'CLIENT',
      assignedSiteIds: ['site-1'],
    };

    const houseOwnerUser: User = {
      id: 'owner-1',
      username: 'house_owner',
      fullName: 'K. Balaji',
      role: 'HOUSE_OWNER',
      assignedSiteIds: ['site-1'],
    };

    const contractorUser: User = {
      id: 'mistry-1',
      username: 'contractor_mani',
      fullName: 'Manickam Mistry',
      role: 'MISTRY',
      assignedSiteIds: ['site-1'],
    };

    assert.equal(isHouseOwner(clientUser), true, 'CLIENT role must be classified under client mode');
    assert.equal(isHouseOwner(houseOwnerUser), true, 'HOUSE_OWNER role must be classified under client mode');
    assert.equal(isHouseOwner(contractorUser), false, 'Contractor/Mistry must not be classified under client mode');
    assert.equal(isAdmin(clientUser), false, 'Client must not have admin privileges');
    assert.equal(isSuperAdmin(clientUser), false, 'Client must not have super admin privileges');
  });
});
