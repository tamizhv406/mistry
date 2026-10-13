/**
 * Materials: stock arithmetic on a given day, repeat-entry protection, double taps,
 * and the catalog (shelves, cement types, bundled photos and their credits).
 */
import 'fake-indexeddb/auto';
import fs from 'node:fs';
import path from 'node:path';
import type { Material, RodEntry, Site, StockMovement, User } from '../src/db/types';

let passed = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (!cond) throw new Error(`FAILED: ${name}${detail !== undefined ? ' — got ' + JSON.stringify(detail) : ''}`);
  passed += 1;
  console.log(`  ✓ ${name}`);
}

const stamp = '2026-10-01T04:00:00.000Z';
const owner: User = { id: 'u-owner', username: 'owner', fullName: 'Owner', mobile: '', email: 'o@x.in', passwordHash: 'x', role: 'MISTRY', isActive: true, createdAt: stamp };
const stranger: User = { ...owner, id: 'u-other', username: 'other', email: 'other@x.in' };

async function run() {
  const { db } = await import('../src/db/db');
  const svc = await import('../src/services/records');
  const stock = await import('../src/domain/stock');
  const catalog = await import('../src/domain/catalog');
  const { MATERIAL_IMAGES } = await import('../src/domain/materialImages');
  const { todayKey, addDays } = await import('../src/utils/datetime');
  await db.open();

  console.log('\n--- 0. Compatible stock units ---');
  const bags = stock.convertStockQuantity('cement', 'bags', 2);
  check('Two cement bags convert to 100 kg', bags.quantity === 100 && bags.unit === 'kg');
  const cubicMetres = stock.convertStockQuantity('sand', 'm³', 1);
  check('One cubic metre converts to cubic feet', Math.abs(cubicMetres.quantity - 35.315) < 0.001 && cubicMetres.unit === 'cft', cubicMetres);
  check('Cubic feet and cubic metres share stock identity',
    stock.stockItemKey({ category: 'sand', name: 'River Sand', unit: 'cft' }) ===
    stock.stockItemKey({ category: 'sand', name: 'River Sand', unit: 'm³' }));
  check('Sand mass and volume remain separate',
    stock.stockItemKey({ category: 'sand', name: 'River Sand', unit: 'tonnes' }) !==
    stock.stockItemKey({ category: 'sand', name: 'River Sand', unit: 'cft' }));
  check('A thousand bricks converts to 1,000 pieces',
    stock.convertStockQuantity('bricks', 'thousand', 1).quantity === 1000);
  check('Steel tonnes convert to kilograms',
    stock.convertStockQuantity('rod', 'tonne', 1).quantity === 1000);
  check('Steel weight and length remain separate',
    stock.stockItemKey({ category: 'rod', name: 'Steel Rod 12mm', unit: 'kg' }) !==
    stock.stockItemKey({ category: 'rod', name: 'Steel Rod 12mm', unit: 'metres' }));
  check('Steel kilograms and tonnes share stock identity',
    stock.stockItemKey({ category: 'rod', name: 'Steel Rod 12mm', unit: 'kg' }) ===
    stock.stockItemKey({ category: 'rod', name: 'Steel Rod 12mm', unit: 'tonnes' }));
  check('Material categories ignore case when converting units',
    stock.convertStockQuantity('Cement', 'Bags', 1).quantity === 50);
  check('Five primary material categories are exposed',
    catalog.MATERIAL_MAIN_GROUPS.map(group => group.label).join('|') === 'Cement|Sand|M-Sand|Bricks|Steel Rods');
  check('Legacy aggregate and custom materials remain in the legacy shelf',
    catalog.materialGroupId('aggregate') === 'legacy' && catalog.materialGroupId('other') === 'legacy');
  check('Core categories offer only suitable units',
    catalog.materialUnitsForCategory('cement').join('|') === 'Bags|kg' &&
    catalog.materialUnitsForCategory('sand').join('|') === 'CFT|m³|Tonne|Unit (100 CFT)' &&
    catalog.materialUnitsForCategory('bricks').join('|') === 'Pieces' &&
    catalog.materialUnitsForCategory('rod').join('|') === 'kg|Tonne|Metre');
  const measuredRod: RodEntry = {
    id: 'rod-measured', siteId: 's1', diameter: '12 mm', brand: 'Tata', quantityPieces: 10,
    lengthMetres: 120, unit: 'kg', weightKg: 500, ratePerKg: 68, totalAmount: 34000,
    paidAmount: 0, balance: 34000, extraPaid: 0, supplier: 'Steel Yard', purchaseDate: '2026-10-01',
    isDeleted: false, createdAt: stamp, updatedAt: stamp,
  };
  const measuredRodStock = stock.buildStock([], [measuredRod], []);
  const rodWeightStock = measuredRodStock.find(item => item.unit === 'kg');
  const rodLengthStock = measuredRodStock.find(item => item.unit === 'metre');
  check('Recorded rod length stays a separate stock quantity',
    rodWeightStock?.onHand === 500 && rodLengthStock?.onHand === 120 &&
    rodWeightStock.key !== rodLengthStock.key);

  const site: Site = {
    id: 's1', userId: owner.id, name: 'Test Site', ownerName: 'A', ownerPhone: '', address: '', area: '', buildingType: 'House',
    startDate: '2026-09-01', expectedCompletionDate: '2027-03-01', status: 'Active', isDeleted: false, createdAt: stamp, updatedAt: stamp,
  };
  await db.sites.put(site);
  const today = todayKey();
  const d = (n: number) => addDays(today, n);
  const items = async () => stock.buildStock(
    await db.materials.where('siteId').equals('s1').toArray(),
    await db.rodEntries.where('siteId').equals('s1').toArray(),
    await db.stockMovements.where('siteId').equals('s1').toArray(),
  );
  const cementKey = stock.stockItemKey({ category: 'cement', name: 'Ramco PPC Cement', unit: 'Bags' });
  const cement = async () => (await items()).find(i => i.key === cementKey);
  const buy = (quantity: number, purchaseDate: string, extra: Record<string, unknown> = {}) => svc.recordPurchase(owner, 's1', {
    category: 'cement', materialName: 'Ramco PPC Cement', brand: 'Ramco', materialType: 'PPC', supplier: 'Sri Traders',
    quantity, unit: 'Bags', rate: 420, paidAmount: 0, purchaseDate, ...extra,
  });
  const move = (movementType: StockMovement['movementType'], quantity: number, eventDate: string, extra: Record<string, unknown> = {}) =>
    svc.recordStockMovement(owner, 's1', { itemKey: cementKey, itemName: 'Ramco PPC Cement', category: 'cement', unit: 'Bags', movementType, quantity, eventDate, ...extra });

  console.log('\n--- 1. Purchases: fields kept apart, totals right ---');
  const p1 = await buy(100, d(-5), { grade: undefined, invoiceNumber: 'INV-1', paidAmount: 10000 });
  check('Purchase saved', p1.ok);
  const saved = p1.ok ? (await db.materials.get(p1.value.id)) as Material : undefined;
  check('Brand, type, quantity, unit, price, supplier and date are separate fields',
    saved?.brand === 'Ramco' && saved?.materialType === 'PPC' && saved?.quantity === 100 && saved?.unit === 'Bags' &&
    saved?.rate === 420 && saved?.supplier === 'Sri Traders' && saved?.purchaseDate === d(-5), saved);
  check('Total = quantity × price', saved?.totalAmount === 42000, saved?.totalAmount);
  check('Balance to supplier = total − paid', saved?.balance === 32000, saved?.balance);
  check('Cement bags are converted to the common kilogram stock unit', (await cement())?.onHand === 5000 && (await cement())?.unit === 'kg');
  check('A stranger can not record a purchase here', !(await svc.recordPurchase(stranger, 's1', { category: 'cement', materialName: 'X', quantity: 1, unit: 'Bags', rate: 1, paidAmount: 0, purchaseDate: today })).ok);
  check('Zero quantity is refused', !(await buy(0, today)).ok);
  check('A future date is refused', !(await buy(5, d(1))).ok);

  console.log('\n--- 2. The same purchase twice ---');
  const again = await buy(100, d(-5));
  check('Identical purchase on the same day is stopped', !again.ok && !!(again as { duplicateOf?: string }).duplicateOf);
  check('Nothing was added by the stopped attempt', (await db.materials.count()) === 1 && (await cement())?.onHand === 5000);
  check('A different quantity is not a repeat', (await buy(40, d(-5))).ok);
  check('A different supplier is not a repeat', (await buy(100, d(-5), { supplier: 'Other Shop' })).ok);
  check('A different day is not a repeat', (await buy(100, d(-4))).ok);
  check('A real second delivery goes through once confirmed', (await buy(100, d(-5), { allowDuplicate: true })).ok);
  check('Stock is the sum of every saved purchase', (await cement())?.onHand === 22000, (await cement())?.onHand);

  console.log('\n--- 3. A double tap saves once ---');
  const before = await db.materials.count();
  const [a, b] = await Promise.all([buy(7, d(-1)), buy(7, d(-1))]);
  check('Exactly one of two simultaneous saves succeeds', [a, b].filter(r => r.ok).length === 1, [a.ok, b.ok]);
  check('Exactly one record was added', (await db.materials.count()) === before + 1);
  const [u1, u2] = await Promise.all([move('usage', 3, d(-1)), move('usage', 3, d(-1))]);
  check('Two simultaneous identical usage entries save once', [u1, u2].filter(r => r.ok).length === 1, [u1.ok, u2.ok]);
  const savedUsage = (await db.stockMovements.toArray()).find(movement => movement.movementType === 'usage');
  check('Saved movement quantities use the canonical kilogram unit',
    savedUsage?.unit === 'kg' && savedUsage.quantity === 150, savedUsage && [savedUsage.quantity, savedUsage.unit]);
  check('Stock went down once after converting bags to kilograms', (await cement())?.onHand === 22200, (await cement())?.onHand);

  console.log('\n--- 4. Usage, returns, adjustments ---');
  const usage = await move('usage', 44, today);
  check('Usage reduces stock', usage.ok && (await cement())?.onHand === 20000, usage);
  const returned = await move('return', 50, today);
  check('Return to supplier reduces stock', returned.ok && (await cement())?.onHand === 17500, returned);
  check('Adjustment out reduces stock', (await move('adjust_out', 10, today, { reason: 'Hardened' })).ok && (await cement())?.onHand === 17000);
  check('Adjustment in adds stock', (await move('adjust_in', 5, today, { reason: 'Recount' })).ok && (await cement())?.onHand === 17250);
  const c = await cement();
  check('Balance = purchases + opening + adjustments − used − returned',
    !!c && c.onHand === c.purchased + c.opening + c.adjusted - c.used - c.returned, c && [c.purchased, c.opening, c.adjusted, c.used, c.returned]);
  const overdraw = await move('usage', 446, today);
  check('Using more than is in stock is refused', !overdraw.ok && (await cement())?.onHand === 17250, overdraw);
  check('The same usage entry twice is stopped', !(await move('usage', 44, today)).ok);
  check('…and saved when confirmed', (await move('usage', 44, today, { allowDuplicate: true })).ok && (await cement())?.onHand === 15050);
  const history = (await cement())?.lines || [];
  check('History lists every entry, oldest first, with a running balance',
    history.length === 12 && history[0].balanceAfter === history[0].quantity && history[history.length - 1].balanceAfter === 15050,
    history.map(l => [l.type, l.quantity, l.balanceAfter]));

  console.log('\n--- 5. An entry dated in the past ---');
  // Sand: 10 units bought five days ago, 20 more today.
  const sandKey = stock.stockItemKey({ category: 'sand', name: 'River Sand', unit: 'Unit (100 CFT)' });
  const buySand = (quantity: number, purchaseDate: string) => svc.recordPurchase(owner, 's1', { category: 'sand', materialName: 'River Sand', quantity, unit: 'Unit (100 CFT)', rate: 5000, paidAmount: 0, purchaseDate });
  const takeSand = (quantity: number, eventDate: string) => svc.recordStockMovement(owner, 's1', { itemKey: sandKey, itemName: 'River Sand', category: 'sand', unit: 'Unit (100 CFT)', movementType: 'usage', quantity, eventDate });
  await buySand(10, d(-5));
  await buySand(20, today);
  const sand = async () => (await items()).find(i => i.key === sandKey);
  check('100 cubic feet is the canonical volume unit', (await sand())?.onHand === 3000 && (await sand())?.unit === 'cft');
  check('Only 1,000 cft could have left three days ago', stock.availableOn(await sand(), d(-3)) === 1000);
  check('Nothing could have left before the first purchase', stock.availableOn(await sand(), d(-6)) === 0);
  const early = await takeSand(15, d(-3));
  check('Using 15 units three days ago is refused: 20 units arrived today', !early.ok && /can be taken out/.test((early as { error: string }).error), early);
  check('Using 10 three days ago is allowed', (await takeSand(10, d(-3))).ok);
  check('That used up everything there was before today', stock.availableOn(await sand(), d(-4)) === 0 && stock.availableOn(await sand(), today) === 2000);
  check('The history never goes below zero', (await sand())?.isNegative === false);

  console.log('\n--- 6. Cancelling an entry ---');
  const opening = await svc.recordStockMovement(owner, 's1', { itemName: 'Nails', category: 'other', unit: 'kg', movementType: 'opening', quantity: 8, eventDate: d(-2) });
  const nailsKey = stock.stockItemKey({ category: 'other', name: 'Nails', unit: 'kg' });
  await svc.recordStockMovement(owner, 's1', { itemKey: nailsKey, itemName: 'Nails', category: 'other', unit: 'kg', movementType: 'usage', quantity: 6, eventDate: d(-1) });
  const cancel = opening.ok ? await svc.voidStockMovement(owner, 's1', opening.value.id, 'Wrong') : { ok: true };
  check('Cancelling stock that later entries depend on is refused', !cancel.ok);
  check('A reason is needed to cancel', opening.ok && !(await svc.voidStockMovement(owner, 's1', opening.value.id, ' ')).ok);
  const nails = (await items()).find(i => i.key === nailsKey);
  check('Nothing changed: 2 kg left', nails?.onHand === 2);

  console.log('\n--- 7. Catalog: shelves, cement types, photos ---');
  await svc.ensureCatalogSeeded();
  const rows = await db.catalogItems.toArray();
  const types = rows.filter(r => r.kind === 'cement_type');
  check('The four documented cement types are in the catalog', types.length === 4 && types.every(t => t.category === 'cement' && !!t.standard), types.map(t => t.name));
  check('OPC grades are kept apart from the type', types.some(t => t.materialType === 'OPC' && t.grade === '53') && types.some(t => t.materialType === 'PPC' && !t.grade));
  check('Cement brands are separate catalog entries', rows.filter(r => r.kind === 'brand' && r.category === 'cement').length >= 7);
  const customType = await svc.saveCatalogItem(owner, { kind: 'cement_type', name: 'PCC (Composite)', category: 'cement', description: 'IS 16415' });
  check('A cement type can be added', customType.ok && (await db.catalogItems.where('kind').equals('cement_type').count()) === 5);
  check('The same type name twice is refused', !(await svc.saveCatalogItem(owner, { kind: 'cement_type', name: 'pcc (composite)', category: 'cement' })).ok);
  const customBrand = await svc.saveCatalogItem(owner, { kind: 'brand', name: 'Penna', category: 'cement' });
  check('A cement brand can be added', customBrand.ok);
  check('Brand + type make the item name', catalog.cementItemName('Penna', 'PCC (Composite)') === 'Penna PCC (Composite) Cement' && catalog.cementItemName('Ramco', 'ppc') === 'Ramco PPC Cement');
  const custom = await svc.saveCatalogItem(owner, {
    kind: 'material', name: 'Kota Stone', category: 'other', group: 'tiles', unit: 'sq.ft', lowStockThreshold: 4,
  });
  check('A custom material can be added to a shelf', custom.ok && custom.value.group === 'tiles');
  check('A finite non-negative reorder threshold can be saved', custom.ok && custom.value.lowStockThreshold === 4);
  if (custom.ok) {
    check('A negative reorder threshold is refused',
      !(await svc.saveCatalogItem(owner, {
        id: custom.value.id, kind: 'material', name: custom.value.name, category: custom.value.category,
        unit: custom.value.unit, lowStockThreshold: -1,
      })).ok);
    const clearedThreshold = await svc.saveCatalogItem(owner, {
      id: custom.value.id, kind: 'material', name: custom.value.name, category: custom.value.category,
      unit: custom.value.unit, lowStockThreshold: null,
    });
    check('A saved reorder threshold can be cleared', clearedThreshold.ok && clearedThreshold.value.lowStockThreshold === null);
  }
  const all = await db.catalogItems.toArray();
  check('A material bought under an old group remains in the legacy shelf', catalog.materialGroupId('other') === 'legacy');
  check('Cement, sand and steel have their own shelves', catalog.materialGroupId('cement') === 'cement' && catalog.materialGroupId('rod') === 'rod');
  check('Every legacy shelf remains available without adding a main category',
    catalog.MATERIAL_GROUPS.length === catalog.MATERIAL_MAIN_GROUPS.length + 1 &&
    catalog.MATERIAL_GROUPS.at(-1)?.id === 'legacy');
  if (customBrand.ok) await svc.removeCatalogItem(owner, customBrand.value.id);
  check('A removed brand is no longer offered', (await db.catalogItems.get(customBrand.ok ? customBrand.value.id : ''))?.isDeleted === true);

  const root = process.cwd();
  const credits = fs.readFileSync(path.join(root, 'public/material-images/CREDITS.md'), 'utf8');
  const allowed = /^(CC0|CC BY(-SA)? [1-4]\.0|Public domain)$/;
  for (const [key, img] of Object.entries(MATERIAL_IMAGES)) {
    const file = path.join(root, 'public', img.file);
    if (!fs.existsSync(file) || fs.statSync(file).size < 5000) throw new Error(`Photo missing or empty: ${img.file}`);
    if (!allowed.test(img.license)) throw new Error(`Photo ${key} has an unexpected licence: ${img.license}`);
    if (!img.author || !img.source.startsWith('https://commons.wikimedia.org/wiki/File:')) throw new Error(`Photo ${key} has no author or source`);
    if (!credits.includes(`${key}.jpg`) || !credits.includes(img.source)) throw new Error(`Photo ${key} is not in CREDITS.md`);
  }
  check('Every bundled photo exists, has a free licence, an author, a source, and a credit line', Object.keys(MATERIAL_IMAGES).length >= 12);
  check('Every shelf photo is one of the bundled photos', catalog.MATERIAL_GROUPS.every(g => !g.image || !!MATERIAL_IMAGES[g.image]));
  const withPhotos = (await db.catalogItems.toArray()).filter(r => r.kind === 'material' && r.imageUrl);
  check('Catalog materials point at files that exist', withPhotos.length >= 10 && withPhotos.every(r => fs.existsSync(path.join(root, 'public', r.imageUrl as string))));

  console.log(`\n✅ Materials stock rules: all ${passed} checks passed.\n`);
}

run().catch(err => {
  console.error('\n❌', err.message);
  process.exit(1);
});
