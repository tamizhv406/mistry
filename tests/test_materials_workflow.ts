/**
 * Materials workflow (Task 2): cement brand and type kept apart, over-usage blocked with a clear
 * message, cancelling an entry needs a reason and reverses it, the phone and desktop screens
 * show the same quantities and value, and low-stock ("kammi") levels per item.
 */
import 'fake-indexeddb/auto';
import type { Material, RodEntry, Site, StockMovement, User } from '../src/db/types';

let passed = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (!cond) throw new Error(`FAILED: ${name}${detail !== undefined ? ' — got ' + JSON.stringify(detail) : ''}`);
  passed += 1;
  console.log(`  ✓ ${name}`);
}

const stamp = '2026-10-01T04:00:00.000Z';
const owner: User = { id: 'u-owner', username: 'owner', fullName: 'Owner', mobile: '', email: 'o@x.in', passwordHash: 'x', role: 'MISTRY', isActive: true, createdAt: stamp };

async function run() {
  const { db } = await import('../src/db/db');
  const svc = await import('../src/services/records');
  const stock = await import('../src/domain/stock');
  const catalog = await import('../src/domain/catalog');
  const { todayKey, addDays } = await import('../src/utils/datetime');
  await db.open();
  await svc.ensureCatalogSeeded();

  const site = (id: string): Site => ({
    id, userId: owner.id, name: `Site ${id}`, ownerName: 'A', ownerPhone: '', address: '', area: '', buildingType: 'House',
    startDate: '2026-09-01', expectedCompletionDate: '2027-03-01', status: 'Active', isDeleted: false, createdAt: stamp, updatedAt: stamp,
  });
  await db.sites.bulkPut([site('w1'), site('w2')]);
  const today = todayKey();
  const d = (n: number) => addDays(today, n);

  // What each screen loads. Phone (useProject): live purchases, every movement (voided kept for
  // history). Desktop (MaterialsView): purchases not deleted, every movement for one project.
  const phoneData = async (siteId: string) => {
    const cat = await db.catalogItems.filter(c => !c.isDeleted && c.kind !== 'tool').toArray();
    const materials = (await db.materials.where('siteId').equals(siteId).toArray()).filter(m => !m.isDeleted);
    const rods = (await db.rodEntries.where('siteId').equals(siteId).toArray()).filter(r => !r.isDeleted);
    const moves = await db.stockMovements.where('siteId').equals(siteId).toArray();
    return { items: stock.buildStock(materials, rods, moves, cat), materials, rods };
  };
  const desktopData = async (siteId: string) => {
    const cat = await db.catalogItems.filter(c => !c.isDeleted && c.kind !== 'tool').toArray();
    const materials = await db.materials.where('siteId').equals(siteId).filter(m => !m.isDeleted).toArray();
    const rods = await db.rodEntries.where('siteId').equals(siteId).filter(r => !r.isDeleted).toArray();
    const moves = await db.stockMovements.where('siteId').equals(siteId).toArray();
    return { items: stock.buildStock(materials, rods, moves, cat), materials, rods };
  };
  const item = async (name: string, siteId = 'w1') => (await phoneData(siteId)).items.find(i => i.name === name);

  // The name both purchase forms give cement: brand + type label (phone EntrySheet and desktop modal).
  const typeLabel = (id: string) => catalog.CEMENT_TYPES.find(t => t.id === id)!.label;
  const ramcoPpc = catalog.cementItemName('Ramco', typeLabel('ppc'));
  const ramcoOpc53 = catalog.cementItemName('Ramco', typeLabel('opc-53'));
  const ultraOpc53 = catalog.cementItemName('UltraTech', typeLabel('opc-53'));
  const ultraOpc43 = catalog.cementItemName('UltraTech', typeLabel('opc-43'));
  const buyCement = (name: string, brand: string, typeId: string, quantity: number, rate: number, date = d(-3), extra: Record<string, unknown> = {}) => {
    const t = catalog.CEMENT_TYPES.find(x => x.id === typeId)!;
    return svc.recordPurchase(owner, 'w1', {
      category: 'cement', materialName: name, brand, materialType: t.type, grade: t.grade, catalogItemId: 'mat-cement',
      supplier: 'Sri Traders', quantity, unit: 'Bags', rate, paidAmount: 0, purchaseDate: date, ...extra,
    });
  };
  const takeOut = (name: string, quantity: number, unit = 'Bags', date = today, extra: Record<string, unknown> = {}) =>
    svc.recordStockMovement(owner, 'w1', { itemName: name, category: 'cement', unit, movementType: 'usage', quantity, eventDate: date, ...extra });

  console.log('\n--- 1. Cement brand and type are separate stock items ---');
  check('Brand + type names are distinct', new Set([ramcoPpc, ramcoOpc53, ultraOpc53, ultraOpc43]).size === 4, [ramcoPpc, ramcoOpc53, ultraOpc53, ultraOpc43]);
  check('Ramco PPC bought (100 bags @ ₹400)', (await buyCement(ramcoPpc, 'Ramco', 'ppc', 100, 400)).ok);
  check('Ramco OPC 53 bought (50 bags @ ₹450)', (await buyCement(ramcoOpc53, 'Ramco', 'opc-53', 50, 450)).ok);
  check('UltraTech OPC 53 bought (40 bags @ ₹460)', (await buyCement(ultraOpc53, 'UltraTech', 'opc-53', 40, 460)).ok);
  check('UltraTech OPC 43 bought (30 bags @ ₹430)', (await buyCement(ultraOpc43, 'UltraTech', 'opc-43', 30, 430)).ok);
  const bags = async (name: string) => stock.displayStock('cement', 'kg', (await item(name))?.onHand ?? NaN).quantity;
  check('Each variant has its own balance', (await bags(ramcoPpc)) === 100 && (await bags(ramcoOpc53)) === 50 && (await bags(ultraOpc53)) === 40 && (await bags(ultraOpc43)) === 30,
    [await bags(ramcoPpc), await bags(ramcoOpc53), await bags(ultraOpc53), await bags(ultraOpc43)]);
  check('Same brand and type again joins the same item', (await buyCement(ramcoPpc, 'Ramco', 'ppc', 20, 410, d(-2))).ok && (await bags(ramcoPpc)) === 120);
  check('A purchase in kg joins the bag item (1000 kg = 20 bags)', (await svc.recordPurchase(owner, 'w1', {
    category: 'cement', materialName: ramcoPpc, quantity: 1000, unit: 'kg', rate: 8, paidAmount: 0, purchaseDate: d(-2),
  })).ok && (await bags(ramcoPpc)) === 140);
  check('Using Ramco OPC 53 reduces only Ramco OPC 53', (await takeOut(ramcoOpc53, 15)).ok &&
    (await bags(ramcoOpc53)) === 35 && (await bags(ramcoPpc)) === 140 && (await bags(ultraOpc53)) === 40);
  check('Usage can be entered in kg (250 kg = 5 bags)', (await takeOut(ultraOpc53, 250, 'kg')).ok && (await bags(ultraOpc53)) === 35);
  check('Stock shows in bags', stock.formatStock('cement', 'kg', 1750) === '35 bags');
  check('Non-cement stock keeps its unit', stock.formatStock('sand', 'cft', 300) === '300 cft');

  console.log('\n--- 2. Over-usage is blocked with a clear message ---');
  const over = await takeOut(ultraOpc43, 31);
  check('Using 31 bags when 30 are in stock is refused', !over.ok);
  check('The message says how much is left, in bags', !over.ok && /Only 30 bags in stock/.test(over.error), over);
  check('Nothing changed', (await bags(ultraOpc43)) === 30);
  const early = await takeOut(ramcoPpc, 130, 'Bags', d(-3));
  check('Using more than had arrived by that day is refused', !early.ok && /can be taken out/.test((early as { error: string }).error) && /100 bags/.test((early as { error: string }).error), early);
  check('Exactly what is in stock is allowed', (await takeOut(ultraOpc43, 30)).ok && (await bags(ultraOpc43)) === 0);
  check('Out of stock shows as out', stock.stockStatus((await item(ultraOpc43))!) === 'out');
  check('Zero and negative quantities are refused', !(await takeOut(ramcoPpc, 0)).ok && !(await takeOut(ramcoPpc, -5)).ok);
  const domainCheck = stock.validateMovementOn(await item(ramcoOpc53), 'usage', stock.convertStockQuantity('cement', 'Bags', 36).quantity, today);
  check('The forms run the same check before saving', !domainCheck.ok && /Only 35 bags/.test(domainCheck.error || ''), domainCheck);

  console.log('\n--- 3. Cancelling (voiding) an entry ---');
  const wrong = await takeOut(ramcoPpc, 40, 'Bags', today, { reason: 'Slab' });
  check('A usage of 40 bags is saved', wrong.ok && (await bags(ramcoPpc)) === 100);
  const wrongId = wrong.ok ? wrong.value.id : '';
  check('Cancelling without a reason is refused', !(await svc.voidStockMovement(owner, 'w1', wrongId, '   ')).ok);
  check('…and the stock is unchanged', (await bags(ramcoPpc)) === 100);
  check('Cancelling with a reason works', (await svc.voidStockMovement(owner, 'w1', wrongId, 'Entered twice')).ok);
  check('The 40 bags are back in stock', (await bags(ramcoPpc)) === 140);
  const voidedLine = (await item(ramcoPpc))!.lines.find(l => l.id === wrongId);
  check('The entry stays in the history, marked cancelled, with its reason', !!voidedLine && voidedLine.voided && voidedLine.voidReason === 'Entered twice' && voidedLine.signed === 0, voidedLine);
  check('Used total no longer counts it', (await item(ramcoPpc))!.used === 0);
  check('Cancelling twice changes nothing', (await svc.voidStockMovement(owner, 'w1', wrongId, 'again')).ok && (await bags(ramcoPpc)) === 140);
  const opening = await svc.recordStockMovement(owner, 'w1', { itemName: 'Nails', category: 'other', unit: 'kg', movementType: 'opening', quantity: 5, eventDate: d(-2) });
  await svc.recordStockMovement(owner, 'w1', { itemName: 'Nails', category: 'other', unit: 'kg', movementType: 'usage', quantity: 4, eventDate: today });
  check('Cancelling stock that later usage depends on is refused', opening.ok && !(await svc.voidStockMovement(owner, 'w1', opening.value.id, 'mistake')).ok);

  console.log('\n--- 4. Phone and desktop show the same numbers ---');
  // Older purchase rows: total missing but rate kept; a rod with pricePerKg only; a deleted row.
  const legacy: Material = {
    id: 'mat-legacy', siteId: 'w1', category: 'sand', materialName: 'River Sand', quantity: 100, unit: 'CFT', rate: 60, totalAmount: 0,
    paidAmount: 0, balance: 6000, extraPaid: 0, supplier: 'Old', purchaseDate: d(-10), isDeleted: false, createdAt: stamp, updatedAt: stamp,
  } as Material;
  const deleted: Material = { ...legacy, id: 'mat-deleted', materialName: 'Ghost', quantity: 999, rate: 999, totalAmount: 998001, isDeleted: true };
  const rod = {
    id: 'rod-legacy', siteId: 'w1', diameter: '12 mm', brand: 'Tata', unit: 'kg', weightKg: 500, pricePerKg: 70, totalAmount: 0,
    paidAmount: 10000, balance: 25000, extraPaid: 0, supplier: 'Steel Co', purchaseDate: d(-4), isDeleted: false, createdAt: stamp, updatedAt: stamp,
  } as unknown as RodEntry;
  await db.materials.bulkPut([legacy, deleted]);
  await db.rodEntries.put(rod);
  await svc.recordStockMovement(owner, 'w1', { itemName: 'River Sand', category: 'sand', unit: 'CFT', movementType: 'usage', quantity: 25, eventDate: today });

  const phone = await phoneData('w1');
  const desk = await desktopData('w1');
  const ps = stock.summariseStock(phone.items, phone.materials, phone.rods);
  const ds = stock.summariseStock(desk.items, desk.materials, desk.rods);
  check('Same summary on both screens', JSON.stringify(ps) === JSON.stringify(ds), { ps, ds });
  check('Same quantity for every item', phone.items.length === desk.items.length &&
    phone.items.every(i => desk.items.find(j => j.key === i.key)?.onHand === i.onHand));
  const ledger = stock.calculateStockValue(desk.materials, desk.rods);
  check('"Bought" equals the purchase ledger total', ps.purchaseValue === ledger.totalStockValue, { ps: ps.purchaseValue, ledger: ledger.totalStockValue });
  check('"To pay" equals unpaid supplier balances', ps.payable === ledger.pendingPurchasesValue, { ps: ps.payable, ledger: ledger.pendingPurchasesValue });
  check('A purchase saved without a total is valued at quantity × rate', phone.items.find(i => i.name === 'River Sand')!.purchaseCost === 6000);
  check('A rod saved with price per kg only is valued at weight × price', phone.items.find(i => i.category === 'rod' && i.unit === 'kg')!.purchaseCost === 35000);
  check('Deleted purchases count nowhere', !phone.items.some(i => i.name === 'Ghost'));
  const sand = phone.items.find(i => i.name === 'River Sand')!;
  check('Stock value = what is left × average price (75 cft × ₹60)', stock.stockItemValue(sand) === 4500, stock.stockItemValue(sand));
  const rp = phone.items.find(i => i.name === ramcoPpc)!;
  // 100 @ 400 + 20 @ 410 + 20 bags (1000 kg) @ 8/kg = 40000 + 8200 + 8000 = 56200 for 140 bags
  check('Weighted average across brands-and-units purchases', stock.stockItemValue(rp) === 56200 && rp.purchaseCost === 56200, { value: stock.stockItemValue(rp), cost: rp.purchaseCost });
  check('Out-of-stock items are valued at ₹0', stock.stockItemValue(phone.items.find(i => i.name === ultraOpc43)!) === 0);
  check('Opening stock with no price is valued at ₹0, not guessed', stock.stockItemValue(phone.items.find(i => i.name === 'Nails')!) === 0);
  const expected = phone.items.reduce((s, i) => s + stock.stockItemValue(i), 0);
  check('Total stock value is the sum of the items', Math.abs(ps.stockValue - expected) < 0.01);
  check('Stock value is below what was bought once some is used', ps.stockValue < ps.purchaseValue);
  const withoutVoided = stock.buildStock(desk.materials, desk.rods, (await db.stockMovements.where('siteId').equals('w1').toArray()).filter(m => !m.isDeleted));
  check('Hiding cancelled entries gives the same balances', withoutVoided.every(i => phone.items.find(j => j.key === i.key)?.onHand === i.onHand));

  console.log('\n--- 5. Low-stock ("kammi") level per item ---');
  check('No level set: 35 bags is not "low" (no fixed 20 rule)', stock.stockStatus(phone.items.find(i => i.name === ramcoOpc53)!) === 'ok');
  const generic = await db.catalogItems.get('mat-cement');
  await svc.saveCatalogItem(owner, { id: 'mat-cement', kind: 'material', name: generic!.name, category: 'cement', lowStockThreshold: 40, lowStockThresholdUnit: 'Bags' });
  const afterGeneric = (await phoneData('w1')).items;
  check('A level on plain "Cement" covers every brand bought through it (35 ≤ 40 bags)', stock.stockStatus(afterGeneric.find(i => i.name === ramcoOpc53)!) === 'low');
  check('…and is converted to kg (40 bags = 2000 kg)', afterGeneric.find(i => i.name === ramcoOpc53)!.lowStockThreshold === 2000);
  check('Ramco PPC with 140 bags is not low', stock.stockStatus(afterGeneric.find(i => i.name === ramcoPpc)!) === 'ok');
  const own = await svc.setLowStockLevel(owner, { name: ramcoOpc53, category: 'cement' }, 10, 'Bags');
  check('An item can have its own level', own.ok && own.value.stockOnly === true && own.value.lowStockThreshold === 10);
  const afterOwn = (await phoneData('w1')).items;
  check('The item\'s own level wins over the generic one', afterOwn.find(i => i.name === ramcoOpc53)!.lowStockThreshold === 500 && stock.stockStatus(afterOwn.find(i => i.name === ramcoOpc53)!) === 'ok');
  check('Other brands keep the generic level', afterOwn.find(i => i.name === ultraOpc53)!.lowStockThreshold === 2000);
  check('Setting it again updates the same entry', (await svc.setLowStockLevel(owner, { name: ramcoOpc53, category: 'cement' }, 36, 'Bags')).ok &&
    (await db.catalogItems.filter(c => c.stockOnly === true && c.name === ramcoOpc53).count()) === 1);
  check('At the level counts as low (35 ≤ 36)', stock.stockStatus((await phoneData('w1')).items.find(i => i.name === ramcoOpc53)!) === 'low');
  check('A negative level is refused', !(await svc.setLowStockLevel(owner, { name: ramcoOpc53, category: 'cement' }, -1, 'Bags')).ok);
  const steelName = stock.rodItemName({ diameter: '12 mm', brand: 'Tata' });
  check('Steel can have a level too (in kg)', (await svc.setLowStockLevel(owner, { name: steelName, category: 'rod' }, 600, 'kg')).ok &&
    stock.stockStatus((await phoneData('w1')).items.find(i => i.name === steelName && i.unit === 'kg')!) === 'low');
  check('A level in a unit that does not fit is ignored (tonnes for sand kept in cft)',
    (await svc.setLowStockLevel(owner, { name: 'River Sand', category: 'sand' }, 5, 'Tonne')).ok &&
    (await phoneData('w1')).items.find(i => i.name === 'River Sand')!.lowStockThreshold === undefined);
  check('Clearing the level removes the badge', (await svc.setLowStockLevel(owner, { name: ramcoOpc53, category: 'cement' }, null, 'Bags')).ok &&
    (await phoneData('w1')).items.find(i => i.name === ramcoOpc53)!.lowStockThreshold === 2000);
  check('Level-only entries are hidden from material pickers', (await db.catalogItems.filter(c => c.kind === 'material' && !c.stockOnly && c.name === ramcoOpc53).count()) === 0);
  const sum = stock.summariseStock((await phoneData('w1')).items);
  check('Low and out counts come from the item levels', sum.lowCount >= 2 && sum.outCount >= 1, sum);

  console.log('\n--- 6. Quick purchase helpers ---');
  const last = stock.latestPurchaseByItem((await phoneData('w1')).materials);
  const lastRamco = last.get(stock.stockItemKey({ category: 'cement', name: ramcoPpc, unit: 'Bags' }));
  check('Last purchase of an item is found (the kg one, latest)', lastRamco?.unit === 'kg' && lastRamco.rate === 8, lastRamco);
  check('Last supplier is offered', last.get(stock.stockItemKey({ category: 'cement', name: ultraOpc53, unit: 'Bags' }))?.supplier === 'Sri Traders');
  check('Cement can be entered in bags or kg', JSON.stringify(stock.compatibleUnits('cement', 'kg', ['Bags', 'kg'])) === '["Bags","kg"]');
  check('Sand in cft offers only volume units', JSON.stringify(stock.compatibleUnits('sand', 'cft', ['CFT', 'm³', 'Tonne', 'Unit (100 CFT)'])) === '["CFT","m³","Unit (100 CFT)"]');
  check('Category chips', stock.stockChipOf('cement') === 'cement' && stock.stockChipOf('msand') === 'sand' && stock.stockChipOf('rod') === 'steel' &&
    stock.stockChipOf('bricks') === 'bricks' && stock.stockChipOf('aggregate') === 'other' && stock.STOCK_CHIPS.length === 6);

  console.log('\n--- 7. Site transfer can not lose stock half way ---');
  await svc.recordPurchase(owner, 'w2', { category: 'bricks', materialName: 'Red Clay Bricks', quantity: 500, unit: 'Nos', rate: 9, paidAmount: 0, purchaseDate: d(-1) });
  await svc.recordStockMovement(owner, 'w2', { itemName: 'Red Clay Bricks', category: 'bricks', unit: 'Nos', movementType: 'adjust_in', quantity: 100, eventDate: today, reason: 'Recount' });
  const twin = await svc.recordStockMovement(owner, 'w2', { itemName: 'Red Clay Bricks', category: 'bricks', unit: 'Nos', movementType: 'adjust_in', quantity: 100, eventDate: today, reason: 'Transferred from Site w1' });
  check('Without the transfer flag a matching entry at the receiving site is held as a repeat', !twin.ok && !!(twin as { duplicateOf?: string }).duplicateOf);
  const inward = await svc.recordStockMovement(owner, 'w2', { itemName: 'Red Clay Bricks', category: 'bricks', unit: 'Nos', movementType: 'adjust_in', quantity: 100, eventDate: today, reason: 'Transferred from Site w1', allowDuplicate: true });
  check('The transfer\'s incoming half is always saved', inward.ok && (await item('Red Clay Bricks', 'w2'))?.onHand === 700);

  const types: StockMovement['movementType'][] = ['usage', 'return', 'adjust_out'];
  check('Every outgoing kind is guarded', types.every(t => !stock.validateMovement(1, t, 2).ok) && stock.validateMovement(1, 'adjust_in', 2).ok);

  console.log(`\n✅ Materials workflow: all ${passed} checks passed.\n`);
}

run().catch(err => {
  console.error('\n❌', err.message);
  process.exit(1);
});
