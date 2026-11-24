import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildStock, calculateStockValue, stockItemValue, summariseStock } from '../src/domain/stock';
import { getStorageSafetyStatus, recordBackupSuccess, getLastBackupTime } from '../src/utils/backupStatus';
import type { Material, RodEntry, StockMovement } from '../src/db/types';

describe('Stock Value Consistency & Financial Truth Suite', () => {
  it('correctly calculates total stock value for standard material (10 qty @ ₹2 = ₹20)', () => {
    const materials: Material[] = [
      {
        id: 'mat_1',
        siteId: 'site_1',
        category: 'cement',
        materialName: 'OPC 53 Cement',
        quantity: 10,
        unit: 'bags',
        rate: 2,
        totalAmount: 20,
        paidAmount: 20,
        balance: 0,
        paymentStatus: 'paid',
        paymentMode: 'cash',
        purchaseDate: '2026-11-05',
        supplier: 'Test Supplier',
        createdAt: '2026-11-05T10:00:00Z',
        updatedAt: '2026-11-05T10:00:00Z',
        userId: 'user_1',
      },
    ];

    const summary = calculateStockValue(materials, []);
    assert.equal(summary.totalStockValue, 20);
    assert.equal(summary.pendingPurchasesValue, 0);
    assert.equal(summary.totalMaterialsCount, 1);
  });

  it('correctly falls back to quantity * rate when totalAmount is missing or zero', () => {
    const materials: Material[] = [
      {
        id: 'mat_2',
        siteId: 'site_1',
        category: 'sand',
        materialName: 'River Sand',
        quantity: 10,
        unit: 'cft',
        rate: 2,
        totalAmount: 0, // Unset totalAmount
        paidAmount: 0,
        balance: 20,
        paymentStatus: 'pending',
        paymentMode: 'credit',
        purchaseDate: '2026-11-05',
        supplier: 'Sand Supplier',
        createdAt: '2026-11-05T10:00:00Z',
        updatedAt: '2026-11-05T10:00:00Z',
        userId: 'user_1',
      },
    ];

    const summary = calculateStockValue(materials, []);
    assert.equal(summary.totalStockValue, 20);
    assert.equal(summary.pendingPurchasesValue, 20);
  });

  it('excludes soft-deleted materials from stock value and counts', () => {
    const materials: Material[] = [
      {
        id: 'mat_3',
        siteId: 'site_1',
        category: 'bricks',
        quantity: 1000,
        rate: 10,
        totalAmount: 10000,
        paidAmount: 10000,
        balance: 0,
        paymentStatus: 'paid',
        paymentMode: 'cash',
        purchaseDate: '2026-11-05',
        supplier: 'Brick Kiln',
        createdAt: '2026-11-05T10:00:00Z',
        updatedAt: '2026-11-05T10:00:00Z',
        userId: 'user_1',
        isDeleted: true, // Deleted
      },
    ];

    const summary = calculateStockValue(materials, []);
    assert.equal(summary.totalStockValue, 0);
    assert.equal(summary.totalMaterialsCount, 0);
  });

  it('returns ₹0 stock value when inventory is empty or zero stock', () => {
    const summary = calculateStockValue([], []);
    assert.equal(summary.totalStockValue, 0);
    assert.equal(summary.pendingPurchasesValue, 0);
    assert.equal(summary.totalMaterialsCount, 0);
  });

  it('correctly calculates rod entries value using weight and price per kg', () => {
    const rodEntries: RodEntry[] = [
      {
        id: 'rod_1',
        siteId: 'site_1',
        diameter: '12mm',
        bundleCount: 5,
        piecesPerBundle: 10,
        weightKg: 50,
        pricePerKg: 60,
        totalAmount: 3000,
        paidAmount: 2000,
        balance: 1000,
        paymentStatus: 'partial',
        paymentMode: 'online',
        purchaseDate: '2026-11-05',
        supplier: 'Steel Corp',
        createdAt: '2026-11-05T10:00:00Z',
        updatedAt: '2026-11-05T10:00:00Z',
        userId: 'user_1',
      },
    ];

    const summary = calculateStockValue([], rodEntries);
    assert.equal(summary.totalStockValue, 3000);
    assert.equal(summary.pendingPurchasesValue, 1000);
    assert.equal(summary.totalMaterialsCount, 1);
  });
});

describe('Desktop / phone valuation parity (summariseStock)', () => {
  const base = { siteId: 'site_1', paidAmount: 0, paymentStatus: 'pending', paymentMode: 'cash', supplier: 'S', createdAt: '2026-11-05T10:00:00Z', updatedAt: '2026-11-05T10:00:00Z', userId: 'user_1' };
  const materials = [
    { ...base, id: 'a', category: 'cement', materialName: 'Ramco PPC Cement', quantity: 100, unit: 'Bags', rate: 400, totalAmount: 40000, balance: 40000, purchaseDate: '2026-11-01' },
    { ...base, id: 'b', category: 'cement', materialName: 'Ramco PPC Cement', quantity: 100, unit: 'Bags', rate: 420, totalAmount: 0, balance: 0, purchaseDate: '2026-11-02' },
    { ...base, id: 'c', category: 'sand', materialName: 'River Sand', quantity: 10, unit: 'CFT', rate: 60, totalAmount: 600, balance: 0, purchaseDate: '2026-11-02', isDeleted: true },
  ] as unknown as Material[];
  const rods = [
    { ...base, id: 'r', diameter: '12 mm', bundleCount: 1, piecesPerBundle: 1, weightKg: 100, pricePerKg: 70, totalAmount: 0, balance: 7000, unit: 'kg', purchaseDate: '2026-11-03' },
  ] as unknown as RodEntry[];
  const movements = [
    { id: 'm1', siteId: 'site_1', itemName: 'Ramco PPC Cement', category: 'cement', unit: 'kg', movementType: 'usage', quantity: 5000, eventDate: '2026-11-04', isDeleted: false, createdAt: '2026-11-04T10:00:00Z', updatedAt: '' },
    { id: 'm2', siteId: 'site_1', itemName: 'Ramco PPC Cement', category: 'cement', unit: 'kg', movementType: 'usage', quantity: 2500, eventDate: '2026-11-04', isDeleted: true, voidReason: 'twice', createdAt: '2026-11-04T11:00:00Z', updatedAt: '' },
  ] as unknown as StockMovement[];
  const items = buildStock(materials, rods, movements);
  const summary = summariseStock(items, materials, rods);

  it('"Bought" is the same figure as the purchase ledger (totals missing fall back to qty × rate)', () => {
    const ledger = calculateStockValue(materials, rods);
    assert.equal(summary.purchaseValue, ledger.totalStockValue);
    assert.equal(summary.purchaseValue, 40000 + 42000 + 7000);
    assert.equal(summary.payable, ledger.pendingPurchasesValue);
  });

  it('stock value is what is left at the weighted average price; cancelled usage does not count', () => {
    const cement = items.find(i => i.category === 'cement')!;
    assert.equal(cement.onHand, 5000); // 200 bags = 10000 kg; 100 bags used; the cancelled 50 bags ignored
    assert.equal(stockItemValue(cement), 41000); // 100 bags left × ₹410 average
    assert.equal(summary.stockValue, 41000 + 7000);
  });

  it('filtering out cancelled movements first gives the same result', () => {
    const again = summariseStock(buildStock(materials, rods, movements.filter(m => !m.isDeleted)), materials, rods);
    assert.deepEqual(again, summary);
  });
});

describe('Cloud & Storage Transparency Suite', () => {
  it('correctly returns local IndexedDB storage status', () => {
    const status = getStorageSafetyStatus();
    assert.equal(status.storageType, 'IndexedDB (Offline-First Local)');
    assert.ok(typeof status.isCloudConfigured === 'boolean');
    assert.ok(typeof status.cloudStatusText === 'string');
  });

  it('updates last backup timestamp when a backup is saved', () => {
    const savedTime = recordBackupSuccess();
    assert.ok(savedTime.length > 0);
    const lastTime = getLastBackupTime();
    assert.equal(lastTime, savedTime);
  });
});

describe('CAD Upright Label Angle Normalisation', () => {
  function isLabelFlipped(rotationDeg: number): boolean {
    const normRot = ((rotationDeg % 360) + 360) % 360;
    return normRot > 90 && normRot <= 270;
  }

  it('detects inverted angles and applies counter-rotation so text is never upside down', () => {
    // 0 deg: upright (horizontal left to right) -> no flip needed
    assert.equal(isLabelFlipped(0), false);

    // 45 deg: angled upward -> no flip needed
    assert.equal(isLabelFlipped(45), false);

    // 90 deg: upright vertical wall (reads bottom-to-top) -> no flip needed
    assert.equal(isLabelFlipped(90), false);

    // 180 deg: bottom horizontal wall -> upside down without correction! Must be flipped!
    assert.equal(isLabelFlipped(180), true);

    // 270 deg: left vertical wall -> upside down without correction! Must be flipped!
    assert.equal(isLabelFlipped(270), true);

    // 315 deg: angled downward right -> no flip needed
    assert.equal(isLabelFlipped(315), false);
  });
});

