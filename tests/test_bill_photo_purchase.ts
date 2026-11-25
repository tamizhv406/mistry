/**
 * Test Suite: Bill Photo on Stock Purchase (Task 5)
 *
 * Verifies:
 * 1. Client-side file validation, proportional downscaling, and compression options
 * 2. Private Supabase Storage bucket path isolation & signed URL resolution (never public URLs)
 * 3. Offline-first purchase photo capture -> cloud sync upload & offline delete queue
 * 4. Stock ledger projection (`buildStock`) & `cloudSync` stripping inline local base64 payloads
 * 5. Safe photo deletion preserves underlying Material / RodEntry purchase records
 * 6. Mobile-first UI wiring (`capture="environment"`, gallery input, `>= 44px` controls, lightbox)
 */

import 'fake-indexeddb/auto';
import fs from 'node:fs';
import path from 'node:path';
import type { RodEntry, Site, StockMovement, User } from '../src/db/types';

// Install an in-memory localStorage mock before importing billPhotoService / cloudSync
{
  const store = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    writable: true,
    value: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => { store.set(k, String(v)); },
      removeItem: (k: string) => { store.delete(k); },
      clear: () => { store.clear(); },
    },
  });
}

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

class MockStorageClient {
  public authUserId: string | null = 'auth-uuid-999';
  public uploaded = new Map<string, { body: Blob; contentType?: string }>();
  public removed: string[] = [];
  public signedUrlCalls = 0;

  auth = {
    getSession: async () => ({
      data: { session: this.authUserId ? { user: { id: this.authUserId } } : null },
    }),
  };

  storage = {
    from: (bucket: string) => {
      if (bucket !== 'purchase-bills') {
        throw new Error(`Unexpected bucket: ${bucket}`);
      }
      return {
        upload: async (storagePath: string, body: Blob, options?: { contentType?: string; upsert?: boolean }) => {
          this.uploaded.set(storagePath, { body, contentType: options?.contentType });
          return { data: { path: storagePath }, error: null };
        },
        createSignedUrl: async (storagePath: string, expiresIn: number) => {
          this.signedUrlCalls += 1;
          return {
            data: { signedUrl: `https://signed.supabase.local/${storagePath}?token=ttl-${expiresIn}` },
            error: null,
          };
        },
        remove: async (paths: string[]) => {
          for (const p of paths) {
            this.uploaded.delete(p);
            this.removed.push(p);
          }
          return { data: paths, error: null };
        },
      };
    },
  };
}

async function run() {
  console.log('\n--- TASK 5: BILL PHOTO ON STOCK PURCHASE TEST SUITE ---\n');

  const { db } = await import('../src/db/db');
  const { recordPurchase, newId } = await import('../src/services/records');
  const { buildStock } = await import('../src/domain/stock');
  const { syncOnce } = await import('../src/services/cloudSync');
  const photoSvc = await import('../src/services/billPhotoService');

  await db.open();

  // 1. Validation & compression scaling
  console.log('1. Image validation, scaling & compression');
  check(photoSvc.validateBillPhotoFile({ type: 'image/jpeg', size: 0 }).ok === false, 'Rejects 0-byte file');
  check(
    photoSvc.validateBillPhotoFile({ type: 'image/jpeg', size: photoSvc.MAX_BILL_PHOTO_INPUT_BYTES + 1 }).ok === false,
    'Rejects files exceeding 20 MB guard',
  );
  check(
    photoSvc.validateBillPhotoFile({ type: 'application/pdf', size: 1024, name: 'bill.pdf' }).ok === false,
    'Rejects non-image MIME types',
  );
  check(
    photoSvc.validateBillPhotoFile({ type: 'image/png', size: 2048, name: 'invoice.png' }).ok === true,
    'Accepts valid PNG image',
  );
  check(
    photoSvc.validateBillPhotoFile({ type: '', size: 2048, name: 'phone_photo.WEBP' }).ok === true,
    'Accepts extension fallback for empty MIME on mobile webviews',
  );

  const unchanged = photoSvc.computeScaledDimensions(800, 600, 1280);
  check(unchanged.width === 800 && unchanged.height === 600, 'Keeps images within 1280px unscaled');
  const landscape = photoSvc.computeScaledDimensions(2560, 1920, 1280);
  check(landscape.width === 1280 && landscape.height === 960, 'Scales landscape proportionally to maxDimension=1280');
  const portrait = photoSvc.computeScaledDimensions(1500, 3000, 1280);
  check(portrait.width === 640 && portrait.height === 1280, 'Scales portrait proportionally to maxDimension=1280');

  const largeRaw = new Blob([new Uint8Array(6000).fill(7)], { type: 'image/png' });
  const compressed = await photoSvc.compressBillPhoto(
    Object.assign(largeRaw, { name: 'Cement Invoice #12.png' }),
    {
      rasterizer: async (_blob, opts) => {
        check(opts.maxDimension === 1280 && Math.abs(opts.quality - 0.78) < 0.01, 'Passes maxDimension=1280 and quality=0.78');
        const outBytes = new Uint8Array([255, 216, 255, 224, 1, 2, 3, 4]);
        const outBlob = new Blob([outBytes], { type: opts.mimeType });
        return {
          blob: outBlob,
          dataUrl: await photoSvc.blobToDataUrl(outBlob),
          width: 960,
          height: 1280,
        };
      },
    },
  );
  check(compressed.fileName === 'Cement_Invoice__12.jpg', 'Normalizes output filename to sanitized .jpg');
  check(compressed.width <= 1280 && compressed.height <= 1280, 'Compressed dimensions respect 1280px cap');
  check(compressed.compressedSize < compressed.originalSize, 'Compressed payload is smaller than input payload');
  check(compressed.dataUrl.startsWith('data:image/jpeg;base64,'), 'Produces compact base64 JPEG data URL for offline view');

  // 2. Private storage path isolation & SQL migration checks
  console.log('\n2. Private Supabase bucket path & migration safety');
  const safePath = photoSvc.buildBillPhotoStoragePath({
    userId: 'user/../escape',
    projectId: 'site/42',
    purchaseId: 'mat-101',
  });
  check(safePath === 'user____escape/site_42/mat-101.jpg', 'Sanitizes segments so userId folder boundary cannot be escaped', safePath);

  const migrationSql = read('supabase/migrations/005_purchase_bills_storage.sql');
  const serviceSrc = read('src/services/billPhotoService.ts');
  check(migrationSql.includes("'purchase-bills'") && migrationSql.includes('false'), 'Migration 005 configures private purchase-bills bucket');
  check(migrationSql.includes("(storage.foldername(name))[1] = (select auth.uid())::text"), 'Migration 005 enforces owner folder RLS policies');
  check(!serviceSrc.includes('getPublicUrl'), 'billPhotoService never uses getPublicUrl');

  // 3. Offline attach -> StockLine projection -> online cloud sync -> signed URL
  console.log('\n3. Offline-first persistence, StockLine projection & cloud sync');
  const stamp = '2026-11-25T05:00:00.000Z';
  const owner: User = {
    id: 'owner-t5',
    username: 'owner5',
    fullName: 'Task Five Owner',
    mobile: '',
    email: 'owner5@example.in',
    passwordHash: 'hashed',
    role: 'MISTRY',
    isActive: true,
    createdAt: stamp,
  };
  const site: Site = {
    id: 'site-t5',
    userId: owner.id,
    name: 'Villa Plot 5',
    ownerName: 'Owner',
    ownerPhone: '',
    address: 'Chennai',
    area: '2000 sqft',
    buildingType: 'Residential',
    startDate: '2026-10-01',
    expectedCompletionDate: '2027-06-01',
    status: 'Active',
    isDeleted: false,
    createdAt: stamp,
    updatedAt: stamp,
  };
  await db.sites.put(site);

  const mockClient = new MockStorageClient();
  const purchaseRes = await recordPurchase(owner, site.id, {
    category: 'cement',
    materialName: 'UltraTech PPC (43 Grade)',
    brand: 'UltraTech',
    quantity: 50,
    unit: 'Bags',
    rate: 390,
    paidAmount: 19500,
    supplier: 'Sri Murugan Agencies',
    purchaseDate: '2026-11-25',
    invoiceNumber: 'INV-501',
  });
  check(purchaseRes.ok === true, 'Records base material purchase in Dexie');
  if (!purchaseRes.ok) throw new Error('Purchase setup failed');
  const matId = purchaseRes.value.id;

  const offlineAttach = await photoSvc.attachBillPhotoToPurchase({
    table: 'materials',
    purchaseId: matId,
    siteId: site.id,
    photo: compressed,
    client: mockClient,
    isOnline: false,
  });
  check(offlineAttach.status === 'pending', 'Queues compressed photo locally when offline');

  const matAfterOffline = await db.materials.get(matId);
  check(
    matAfterOffline?.billPhotoSyncStatus === 'pending' &&
      Boolean(matAfterOffline.billPhotoLocalDataUrl) &&
      !matAfterOffline.billPhotoPath,
    'Stores billPhotoLocalDataUrl and pending status locally without blocking save',
  );

  const offlineResolve = await photoSvc.resolveBillPhotoDisplayUrl(matAfterOffline, { isOnline: false, client: null });
  check(
    offlineResolve.url === compressed.dataUrl && !offlineResolve.offlineUnavailable,
    'Resolves local dataUrl immediately while offline',
  );

  // Also add a RodEntry with weight + length and offline photo
  const rodId = newId('rod');
  const rodEntry: RodEntry = {
    id: rodId,
    siteId: site.id,
    diameter: '12 mm',
    brand: 'Tata Tiscon 550D',
    quantityPieces: 40,
    lengthMetres: 480,
    weightKg: 420,
    ratePerKg: 72,
    totalAmount: 30240,
    paidAmount: 0,
    balance: 30240,
    extraPaid: 0,
    supplier: 'Kaveri Steels',
    unit: 'kg',
    purchaseDate: '2026-11-25',
    invoiceNumber: 'WB-12',
    isDeleted: false,
    createdAt: stamp,
    updatedAt: stamp,
  };
  await db.rodEntries.put(rodEntry);
  await photoSvc.attachBillPhotoToPurchase({
    table: 'rodEntries',
    purchaseId: rodId,
    siteId: site.id,
    photo: compressed,
    client: mockClient,
    isOnline: false,
  });

  const allMats = await db.materials.where('siteId').equals(site.id).toArray();
  const allRods = await db.rodEntries.where('siteId').equals(site.id).toArray();
  const stockItems = buildStock(allMats, allRods, [] as StockMovement[]);
  const cementLine = stockItems.find(i => i.category === 'cement')?.lines.find(l => l.id === matId);
  const rodLengthLine = stockItems.find(i => i.category === 'rod' && i.unit === 'metre')?.lines.find(l => l.id === `${rodId}-length`);
  check(
    cementLine?.billPhotoSyncStatus === 'pending' && cementLine?.purchaseRecordId === matId && cementLine?.recordTable === 'materials',
    'buildStock propagates billPhoto metadata & record ref to Material StockLine',
  );
  check(
    rodLengthLine?.billPhotoLocalDataUrl === compressed.dataUrl &&
      rodLengthLine?.purchaseRecordId === rodId &&
      rodLengthLine?.recordTable === 'rodEntries',
    'buildStock propagates billPhoto metadata & base rodId to Rod metre StockLine',
  );

  // Sync pending bill photos once online
  const syncRes = await photoSvc.syncPendingBillPhotos({ client: mockClient, isOnline: true });
  check(syncRes.uploaded === 2 && syncRes.failed === 0, 'syncPendingBillPhotos uploads both pending Material and Rod photos', syncRes);

  const expectedMatPath = `${mockClient.authUserId}/${site.id}/${matId}.jpg`;
  const matSynced = await db.materials.get(matId);
  check(
    matSynced?.billPhotoSyncStatus === 'synced' &&
      matSynced.billPhotoPath === expectedMatPath &&
      !matSynced.billPhotoLocalDataUrl,
    'Updates Dexie row to synced path and clears inline local data URL',
  );

  // Ensure signed URL fetch works when cache is cleared, and graceful offline unavailability when remote-only
  photoSvc.clearBillPhotoUrlCache();
  const signedRes = await photoSvc.resolveBillPhotoDisplayUrl(matSynced, { client: mockClient, isOnline: true });
  check(
    signedRes.url === `https://signed.supabase.local/${expectedMatPath}?token=ttl-3600` && mockClient.signedUrlCalls === 1,
    'Resolves private signed URL via createSignedUrl with 3600s TTL',
  );
  photoSvc.clearBillPhotoUrlCache();
  const offlineRemoteOnly = await photoSvc.resolveBillPhotoDisplayUrl(matSynced, { client: mockClient, isOnline: false });
  check(
    offlineRemoteOnly.url === null && offlineRemoteOnly.offlineUnavailable === true,
    'Flags offlineUnavailable when synced photo lacks local cache offline',
  );

  // Verify cloudSync strips billPhotoLocalDataUrl while retaining billPhotoPath metadata
  const pushedRows: any[] = [];
  const fakeRemote = {
    pull: async () => [],
    push: async (rows: any[]) => { pushedRows.push(...rows); },
  };
  await syncOnce(fakeRemote, owner, { lastPulledAt: null, lastPushedAt: null }, []);
  const syncedMatPayload = pushedRows.find(r => r.table_name === 'materials' && r.record_id === matId)?.data;
  check(
    syncedMatPayload && syncedMatPayload.billPhotoPath === expectedMatPath && !('billPhotoLocalDataUrl' in syncedMatPayload),
    'cloudSync preserves billPhotoPath metadata and strips inline local base64 image data',
  );

  // 4. Delete photo preserves purchase record & cleans up remote (online + offline queued)
  console.log('\n4. Deleting bill photo preserves purchase record');
  const onlineDelete = await photoSvc.deleteBillPhotoFromPurchase({
    table: 'materials',
    purchaseId: matId,
    client: mockClient,
    isOnline: true,
  });
  check(onlineDelete.ok === true, 'deleteBillPhotoFromPurchase succeeds online');
  const matAfterDelete = await db.materials.get(matId);
  check(
    Boolean(matAfterDelete) &&
      !matAfterDelete?.isDeleted &&
      matAfterDelete?.quantity === 50 &&
      !matAfterDelete?.billPhotoPath &&
      !matAfterDelete?.billPhotoLocalDataUrl,
    'Removes bill photo metadata while preserving underlying Material purchase',
  );
  check(mockClient.removed.includes(expectedMatPath), 'Deletes object from private Supabase Storage bucket');

  const expectedRodPath = `${mockClient.authUserId}/${site.id}/${rodId}.jpg`;
  const offlineDelete = await photoSvc.deleteBillPhotoFromPurchase({
    table: 'rodEntries',
    purchaseId: rodId,
    client: mockClient,
    isOnline: false,
  });
  check(offlineDelete.ok === true, 'Queues remote storage cleanup when deleting bill photo offline');
  const rodAfterDelete = await db.rodEntries.get(rodId);
  check(Boolean(rodAfterDelete) && !rodAfterDelete?.billPhotoPath, 'Clears local RodEntry photo immediately on offline delete');

  const drainRes = await photoSvc.syncPendingBillPhotos({ client: mockClient, isOnline: true });
  check(drainRes.deleted === 1 && mockClient.removed.includes(expectedRodPath), 'Drains queued bill photo delete once back online', drainRes);

  // 5. UI components, mobile touch targets & palette checks
  console.log('\n5. UI wiring, camera/gallery attributes & >= 44px touch targets');
  const billUi = read('src/components/BillPhotoComponents.tsx');
  const rpm = read('src/components/RecordPurchaseModal.tsx');
  const stockView = read('src/views/mobile/StockView.tsx');
  const matView = read('src/views/MaterialsView.tsx');
  const matTab = read('src/views/site-tabs/MaterialsTab.tsx');
  const matModal = read('src/components/MaterialModal.tsx');
  const rodModal = read('src/components/RodModal.tsx');
  const mobCss = read('src/styles/materials-mobile.css');

  check(billUi.includes('capture="environment"') && billUi.includes('accept="image/*"'), 'BillPhotoPicker provides camera capture and image gallery inputs');
  check(billUi.includes('BillPhotoThumbnail') && billUi.includes('BillPhotoViewerModal'), 'Exports thumbnail and lightbox viewer components');
  check(billUi.includes('ZoomIn') && billUi.includes('Delete photo') && billUi.includes('Confirm delete'), 'Lightbox supports zoom and two-step photo deletion');
  check(rpm.includes('<BillPhotoPicker') && matModal.includes('<BillPhotoPicker') && rodModal.includes('<BillPhotoPicker'), 'Purchase modals mount BillPhotoPicker');
  check(stockView.includes('<BillPhotoPicker') && stockView.includes('<BillPhotoThumbnail') && stockView.includes('<BillPhotoViewerModal'), 'Mobile StockView captures, thumbnails, and opens lightbox viewer');
  check(matView.includes('<BillPhotoThumbnail') && matView.includes('<BillPhotoViewerModal'), 'Desktop MaterialsView displays thumbnails and lightbox viewer');
  check(matTab.includes('<BillPhotoThumbnail') && matTab.includes('<BillPhotoViewerModal'), 'Project MaterialsTab displays thumbnails and lightbox viewer');

  for (const cls of ['.bph-pick-btn', '.bph-remove-btn', '.bph-thumb-btn', '.bph-icon-btn', '.bph-foot-btn']) {
    const start = mobCss.indexOf(cls);
    const block = start >= 0 ? mobCss.slice(start, mobCss.indexOf('}', start)) : '';
    check(block.includes('min-height: 44px'), `${cls} enforces >= 44px touch height`);
  }
  check(mobCss.includes('--color-danger, #DC2626') && mobCss.includes('--color-primary, #F97316'), 'Uses unified Task 4 theme palette variables');

  console.log(`\nSummary: ${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
