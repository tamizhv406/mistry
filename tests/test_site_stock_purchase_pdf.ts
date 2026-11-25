/**
 * Test Suite: Site-Wise Stock Purchase PDF (Task 7)
 *
 * Verifies:
 * 1. Site filtering + inclusive startDate / endDate date range filtering
 * 2. Inclusion of standard Material and Steel Rod entries, excluding voided/deleted entries
 * 3. Bill Photo Reference formatting (Cloud path, filename, offline pending, and None)
 * 4. Exact totalCost, paid, balanceDue, and purchase count parity with stock.ts ledger
 * 5. Real PDF Blob output (%PDF- / %%EOF) for populated & empty ranges + print HTML XSS safety
 * 6. Mobile-first >= 44px controls and integration across StockView, MaterialsView, ReportsTab
 */

import fs from 'node:fs';
import path from 'node:path';
import type { Material, RodEntry } from '../src/db/types';
import {
  buildSiteStockPurchaseStatement,
  buildStock,
  formatBillPhotoReference,
  summariseStock,
} from '../src/domain/stock';
import {
  buildSiteStockPurchasePrintHtml,
  generateSiteStockPurchasePdfBlob,
  siteStockPurchasePdfFilename,
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
  console.log('\n--- TASK 7: SITE-WISE STOCK PURCHASE PDF TEST SUITE ---\n');

  const stamp = '2026-11-25T07:00:00.000Z';

  // 1. Bill photo reference formatting
  console.log('1. Bill Photo Reference formatting');
  check(formatBillPhotoReference({}).billPhotoReference === 'None', 'Formats missing photo as None');
  check(
    formatBillPhotoReference({
      billPhotoPath: 'uid-1/site-1/mat-1.jpg',
      billPhotoName: 'ultratech_bill.jpg',
    }).billPhotoReference === 'ultratech_bill.jpg (mat-1.jpg)',
    'Formats synced cloud bill photo with filename and storage object ID',
  );
  check(
    formatBillPhotoReference({
      billPhotoPath: 'uid-1/site-1/rod-9.jpg',
    }).billPhotoReference === 'Cloud: rod-9.jpg',
    'Formats cloud bill photo when original filename is absent',
  );
  check(
    formatBillPhotoReference({
      billPhotoLocalDataUrl: 'data:image/jpeg;base64,/9j/4AAQ',
      billPhotoSyncStatus: 'pending',
      billPhotoName: 'sand_slip.jpg',
    }).billPhotoReference === 'sand_slip.jpg (Pending sync)',
    'Formats offline pending local bill photo cleanly',
  );

  // 2. Site & date-range filtering + materials & rod inclusion + deleted/voided exclusion
  console.log('\n2. Site & date filtering, materials + rods, and stock ledger parity');
  const materials: Array<Material & { voided?: boolean }> = [
    {
      id: 'mat-before',
      siteId: 'site-1',
      category: 'sand',
      materialName: 'River Sand',
      supplier: 'Kaveri Sand',
      quantity: 2,
      unit: 'Unit',
      rate: 12000,
      totalAmount: 24000,
      paidAmount: 24000,
      balance: 0,
      extraPaid: 0,
      purchaseDate: '2026-10-31',
      invoiceNumber: 'INV-OCT',
      isDeleted: false,
      createdAt: stamp,
      updatedAt: stamp,
    },
    {
      id: 'mat-in-1',
      siteId: 'site-1',
      category: 'cement',
      materialName: 'PPC (43 Grade)',
      brand: 'UltraTech',
      supplier: 'Sri Murugan Agencies',
      quantity: 50,
      unit: 'Bags',
      rate: 380,
      totalAmount: 19000,
      paidAmount: 15000,
      balance: 4000,
      extraPaid: 0,
      purchaseDate: '2026-11-01',
      invoiceNumber: 'INV-101',
      billPhotoPath: 'user-1/site-1/mat-in-1.jpg',
      billPhotoName: 'cement_inv.jpg',
      billPhotoSyncStatus: 'synced',
      isDeleted: false,
      createdAt: stamp,
      updatedAt: stamp,
    },
    {
      id: 'mat-deleted',
      siteId: 'site-1',
      category: 'bricks',
      materialName: 'Chamber Bricks',
      supplier: 'Deleted Brick Kiln',
      quantity: 1000,
      unit: 'Pieces',
      rate: 10,
      totalAmount: 10000,
      paidAmount: 0,
      balance: 10000,
      extraPaid: 0,
      purchaseDate: '2026-11-10',
      isDeleted: true,
      createdAt: stamp,
      updatedAt: stamp,
    },
    {
      id: 'mat-voided',
      siteId: 'site-1',
      category: 'bricks',
      materialName: 'Voided Flyash Bricks',
      supplier: 'Void Kiln',
      quantity: 500,
      unit: 'Pieces',
      rate: 8,
      totalAmount: 4000,
      paidAmount: 0,
      balance: 4000,
      extraPaid: 0,
      purchaseDate: '2026-11-12',
      isDeleted: false,
      voided: true,
      createdAt: stamp,
      updatedAt: stamp,
    },
    {
      id: 'mat-other-site',
      siteId: 'site-2',
      category: 'cement',
      materialName: 'Dalmia OPC',
      supplier: 'Other Depot',
      quantity: 20,
      unit: 'Bags',
      rate: 400,
      totalAmount: 8000,
      paidAmount: 8000,
      balance: 0,
      extraPaid: 0,
      purchaseDate: '2026-11-15',
      isDeleted: false,
      createdAt: stamp,
      updatedAt: stamp,
    },
  ];

  const rods: RodEntry[] = [
    {
      id: 'rod-in-2',
      siteId: 'site-1',
      diameter: '12 mm',
      brand: 'Tata Tiscon',
      weightKg: 500,
      ratePerKg: 72,
      totalAmount: 36000,
      paidAmount: 36000,
      balance: 0,
      extraPaid: 0,
      supplier: 'Chennai Steels',
      unit: 'kg',
      purchaseDate: '2026-11-25',
      invoiceNumber: 'WB-205',
      billPhotoLocalDataUrl: 'data:image/jpeg;base64,/9j/4AAQ',
      billPhotoSyncStatus: 'pending',
      billPhotoName: 'rod_wb.jpg',
      isDeleted: false,
      createdAt: stamp,
      updatedAt: stamp,
    },
    {
      id: 'rod-after',
      siteId: 'site-1',
      diameter: '16 mm',
      brand: 'JSW',
      weightKg: 200,
      ratePerKg: 70,
      totalAmount: 14000,
      paidAmount: 14000,
      balance: 0,
      extraPaid: 0,
      supplier: 'Late Steels',
      unit: 'kg',
      purchaseDate: '2026-11-26',
      isDeleted: false,
      createdAt: stamp,
      updatedAt: stamp,
    },
  ];

  const novStatement = buildSiteStockPurchaseStatement({
    projectId: 'site-1',
    projectName: 'Green Villa Phase 1',
    startDate: '2026-11-01',
    endDate: '2026-11-25',
    materials,
    rods,
  });

  check(novStatement.totalPurchases === 2, 'Includes exact boundary purchases [2026-11-01 .. 2026-11-25]', novStatement.totalPurchases);
  check(novStatement.excludedVoidedCount === 2, 'Counts & excludes deleted and voided purchases in range', novStatement.excludedVoidedCount);
  check(novStatement.rows[0]?.id === 'mat-in-1' && novStatement.rows[1]?.id === 'rod-in-2', 'Sorts rows chronologically by date');
  check(novStatement.rows[0]?.itemName === 'UltraTech PPC (43 Grade)', 'Prepends brand cleanly on Material itemName', novStatement.rows[0]?.itemName);
  check(novStatement.rows[0]?.quantityDisplay === '50 Bags' && novStatement.rows[0]?.rate === 380, 'Formats quantity & unit rate for Material row');
  check(novStatement.rows[1]?.itemName === 'Tata Tiscon Steel Rod 12 mm', 'Includes RodEntry with formatted steel itemName', novStatement.rows[1]?.itemName);
  check(novStatement.rows[1]?.quantityDisplay === '500 kg' && novStatement.rows[1]?.invoiceNumber === 'WB-205', 'Formats RodEntry weight & weighbridge invoice');
  check(novStatement.purchasesWithBillPhoto === 2, 'Counts purchases with attached bill photos');
  check(novStatement.totalCost === 55000, 'Computes total purchase cost = ₹55,000', novStatement.totalCost);
  check(novStatement.totalPaid === 51000 && novStatement.totalBalanceDue === 4000, 'Computes paid (₹51,000) & balance due (₹4,000)');

  // Parity with stock.ts summariseStock for active site-1 rows (excluding deleted & optional voided test row)
  const site1ActiveMats = materials.filter(m => m.siteId === 'site-1' && !m.isDeleted && !m.voided);
  const site1ActiveRods = rods.filter(r => r.siteId === 'site-1' && !r.isDeleted);
  const stockSummary = summariseStock(buildStock(site1ActiveMats, site1ActiveRods, []), site1ActiveMats, site1ActiveRods);
  const fullSite1Statement = buildSiteStockPurchaseStatement({
    projectId: 'site-1',
    projectName: 'Green Villa Phase 1',
    materials: site1ActiveMats,
    rods: site1ActiveRods,
  });
  check(
    fullSite1Statement.totalCost === stockSummary.purchaseValue,
    'Full-range site purchase total matches summariseStock().purchaseValue 100%',
    { stmt: fullSite1Statement.totalCost, stock: stockSummary.purchaseValue },
  );
  check(
    fullSite1Statement.totalBalanceDue === stockSummary.payable,
    'Full-range site balance due matches summariseStock().payable 100%',
    { stmt: fullSite1Statement.totalBalanceDue, stock: stockSummary.payable },
  );

  // 3. Real PDF Blob generation (populated + empty range)
  console.log('\n3. Real PDF Blob generation (%PDF-, size, %%EOF)');
  const populatedPdf = await generateSiteStockPurchasePdfBlob(novStatement);
  const popBytes = new Uint8Array(await populatedPdf.arrayBuffer());
  const popText = new TextDecoder('latin1').decode(popBytes);
  check(populatedPdf.type === 'application/pdf', 'Populated PDF Blob has application/pdf MIME type');
  check(popBytes.length > 2000 && popText.startsWith('%PDF-') && popText.trimEnd().endsWith('%%EOF'), 'Populated purchase PDF is valid %PDF- ... %%EOF binary');

  const emptyStatement = buildSiteStockPurchaseStatement({
    projectId: 'site-1',
    projectName: 'Green Villa Phase 1',
    startDate: '2025-01-01',
    endDate: '2025-01-31',
    materials,
    rods,
  });
  check(emptyStatement.totalPurchases === 0 && emptyStatement.totalCost === 0, 'Empty date range yields zero purchases and ₹0');
  const emptyPdf = await generateSiteStockPurchasePdfBlob(emptyStatement);
  const emptyBytes = new Uint8Array(await emptyPdf.arrayBuffer());
  const emptyText = new TextDecoder('latin1').decode(emptyBytes);
  check(emptyBytes.length > 1500 && emptyText.startsWith('%PDF-') && emptyText.trimEnd().endsWith('%%EOF'), 'Empty-range purchase PDF builds cleanly without errors');

  const fileName = siteStockPurchasePdfFilename(novStatement);
  check(fileName === 'SiteMistry_Stock_Purchases_Green_Villa_Phase_1_2026-11-01_2026-11-25.pdf', 'Formats clean site PDF download filename', fileName);

  // 4. Print HTML escaping & Mobile/Desktop UI integration
  console.log('\n4. Print HTML escaping & >= 44px mobile/desktop UI integration');
  const printHtml = buildSiteStockPurchasePrintHtml({
    ...novStatement,
    projectName: '<script>evil()</script>Villa',
  });
  check(!printHtml.includes('<script>evil()</script>'), 'Escapes untrusted project name in print HTML');
  check(printHtml.includes('&lt;script&gt;evil()&lt;/script&gt;Villa'), 'Includes escaped project name in print HTML');
  check(printHtml.includes('cement_inv.jpg') && printHtml.includes('rod_wb.jpg (Pending sync)'), 'Print HTML includes Bill Photo Reference values');

  const modalSrc = read('src/components/SiteStockPurchasePdfModal.tsx');
  const erpCss = read('src/styles/erp-views.css');
  const stockView = read('src/views/mobile/StockView.tsx');
  const matView = read('src/views/MaterialsView.tsx');
  const reportsTab = read('src/views/site-tabs/ReportsTab.tsx');

  check(
    modalSrc.includes('From Date') && modalSrc.includes('To Date') && modalSrc.includes('Download PDF') && modalSrc.includes('Print'),
    'SiteStockPurchasePdfModal includes site selector, From/To dates, Download PDF, and Print controls',
  );
  check(stockView.includes('<SiteStockPurchasePdfModal') && stockView.includes('Stock Purchase PDF'), 'Mobile StockView integrates SiteStockPurchasePdfModal');
  check(matView.includes('<SiteStockPurchasePdfModal') && matView.includes('Purchase PDF'), 'Desktop MaterialsView integrates SiteStockPurchasePdfModal');
  check(reportsTab.includes('<SiteStockPurchasePdfModal') && reportsTab.includes('Stock Purchase PDF'), 'Project ReportsTab integrates SiteStockPurchasePdfModal');

  const presetStart = erpCss.indexOf('.spdf-preset-btn');
  const presetBlock = presetStart >= 0 ? erpCss.slice(presetStart, erpCss.indexOf('}', presetStart)) : '';
  check(presetBlock.includes('min-height: 44px'), '.spdf-preset-btn enforces >= 44px touch height');

  const dateStart = erpCss.indexOf(".spdf-dates input[type='date']");
  const dateBlock = dateStart >= 0 ? erpCss.slice(dateStart, erpCss.indexOf('}', dateStart)) : '';
  check(dateBlock.includes('min-height: 44px') && dateBlock.includes('font-size: 14px'), '.spdf-dates input enforces >= 44px height and >= 14px font');

  console.log(`\nSummary: ${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
