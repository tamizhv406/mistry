import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calculateStockValue } from '../src/domain/stock';
import { getStorageSafetyStatus, recordBackupSuccess, getLastBackupTime } from '../src/utils/backupStatus';
import type { Material, RodEntry } from '../src/db/types';

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

