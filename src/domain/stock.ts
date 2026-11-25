/**
 * Material stock ledger.
 *
 * Stock on hand = purchases + opening stock + adjustments in
 *                 − usage − returns to supplier − adjustments out
 *
 * Purchases live in the existing `materials` / `rodEntries` tables (they carry cost and
 * supplier payments). Every other change is a `StockMovement`. History is append-only:
 * a wrong movement is voided (kept, struck through, excluded from the balance), never edited.
 */
import type { BillPhotoSyncStatus, CatalogItem, Material, RodEntry, StockMovement, StockMovementType } from '../db/types';
import { dayKeyOf, formatDay } from '../utils/datetime';

/** Purchase date, or for old rows without one, the Indian calendar day the row was entered. */
const purchaseDay = (date: string | undefined, createdAt: string | undefined) => date || (createdAt ? dayKeyOf(createdAt) : '');

export const STOCK_MOVEMENT_LABEL: Record<StockMovementType | 'purchase', string> = {
  purchase: 'Purchase',
  opening: 'Opening stock',
  usage: 'Used on site',
  return: 'Returned to supplier',
  adjust_in: 'Adjustment (+)',
  adjust_out: 'Adjustment (−)',
};

export function movementDirection(type: StockMovementType | 'purchase'): 1 | -1 {
  return type === 'usage' || type === 'return' || type === 'adjust_out' ? -1 : 1;
}

function norm(text: string | undefined): string {
  return (text || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/** "Bags" and "bag" are the same unit. Only a plain trailing "s" is folded. */
export function normaliseUnit(unit: string | undefined): string {
  const u = norm(unit);
  return u.length > 3 && u.endsWith('s') && !u.endsWith('ss') ? u.slice(0, -1) : u;
}

interface UnitDefinition {
  family: string;
  unit: string;
  factor: number;
}

function unitDefinition(category: string, unit: string): UnitDefinition {
  const categoryKey = norm(category);
  const value = norm(unit).replace(/[³]/g, '3').replace(/\s+/g, ' ');
  if (categoryKey === 'cement') {
    if (['bag', 'bags'].includes(value)) return { family: 'mass-kg', unit: 'kg', factor: 50 };
    if (['kg', 'kilogram', 'kilograms'].includes(value)) return { family: 'mass-kg', unit: 'kg', factor: 1 };
  }
  if (['sand', 'msand', 'aggregate'].includes(categoryKey)) {
    if (['cft', 'cubic feet', 'cubic foot', 'cu ft', 'ft3'].includes(value)) {
      return { family: 'volume-cft', unit: 'cft', factor: 1 };
    }
    if (['m3', 'm³', 'cubic metre', 'cubic metres', 'cubic meter', 'cubic meters'].includes(value)) {
      return { family: 'volume-cft', unit: 'cft', factor: 35.3146667 };
    }
    if (['unit', 'unit (100 cft)', 'brass', 'brass (100 cft)'].includes(value)) {
      return { family: 'volume-cft', unit: 'cft', factor: 100 };
    }
    if (['kg', 'kilogram', 'kilograms'].includes(value)) return { family: 'mass-tonne', unit: 'tonne', factor: 0.001 };
    if (['ton', 'tons', 'tonne', 'tonnes', 't'].includes(value)) return { family: 'mass-tonne', unit: 'tonne', factor: 1 };
  }
  if (categoryKey === 'bricks') {
    if (['piece', 'pieces', 'nos', 'no', 'pcs', 'pc'].includes(value)) {
      return { family: 'count-piece', unit: 'piece', factor: 1 };
    }
    if (['thousand', 'thousands', '1000 pieces'].includes(value)) {
      return { family: 'count-piece', unit: 'piece', factor: 1000 };
    }
  }
  if (categoryKey === 'rod' || categoryKey === 'steel rods') {
    if (['kg', 'kilogram', 'kilograms'].includes(value)) return { family: 'mass-kg', unit: 'kg', factor: 1 };
    if (['ton', 'tons', 'tonne', 'tonnes', 't'].includes(value)) return { family: 'mass-kg', unit: 'kg', factor: 1000 };
    if (['m', 'metre', 'metres', 'meter', 'meters'].includes(value)) return { family: 'length-metre', unit: 'metre', factor: 1 };
  }
  const canonical = normaliseUnit(unit) || 'unit';
  return { family: `unit:${canonical}`, unit: canonical, factor: 1 };
}

export function convertStockQuantity(category: string, unit: string, quantity: number): { quantity: number; unit: string; family: string } {
  const definition = unitDefinition(category, unit);
  return {
    quantity: round3(quantity * definition.factor),
    unit: definition.unit,
    family: definition.family,
  };
}

/** Compatible units share a key; incompatible dimensions stay in separate stock items. */
export function stockItemKey(item: { category: string; name: string; unit: string }): string {
  const definition = unitDefinition(item.category, item.unit);
  return `${norm(item.category)}|${norm(item.name)}|${definition.family}`;
}

export function rodItemName(rod: Pick<RodEntry, 'diameter' | 'brand'>): string {
  const brand = (rod.brand || '').trim();
  return `${brand ? brand + ' ' : ''}Steel Rod ${rod.diameter}`.trim();
}

export interface StockLine {
  id: string;
  type: StockMovementType | 'purchase';
  date: string;
  createdAt: string;
  quantity: number;       // positive
  signed: number;         // + in / − out; 0 when voided
  voided: boolean;
  balanceAfter: number;
  supplier?: string;
  cost?: number;
  reference?: string;
  notes?: string;
  createdByName?: string;
  voidReason?: string;
  /** Bill / invoice photo attachment metadata copied from purchase records. */
  billPhotoPath?: string;
  billPhotoLocalDataUrl?: string;
  billPhotoSyncStatus?: BillPhotoSyncStatus;
  billPhotoName?: string;
  /** Original database record ID and table backing this purchase line (differs from id for `${r.id}-length`). */
  purchaseRecordId?: string;
  recordTable?: 'materials' | 'rodEntries';
  /** Movements can be voided from the stock screen; purchases are corrected in the purchase record. */
  source: 'purchase' | 'movement';
}

export interface StockItem {
  key: string;
  name: string;
  category: string;
  unit: string;
  lowStockThreshold?: number;
  isLowStock: boolean;
  purchased: number;
  opening: number;
  used: number;
  returned: number;
  adjusted: number;       // net of adjust_in − adjust_out
  onHand: number;
  purchaseCost: number;
  lastActivityDate: string;
  lines: StockLine[];     // oldest first, with running balance
  isNegative: boolean;
}

const round3 = (n: number) => Math.round(n * 1000) / 1000;
const round2 = (n: number) => Math.round(n * 100) / 100;

/** What a purchase cost: the saved total, or quantity × price for older rows saved without one. */
function purchaseAmount(totalAmount: unknown, quantity: unknown, rate: unknown): number {
  const total = Number(totalAmount);
  if (Number.isFinite(total) && total > 0) return total;
  const value = (Number(quantity) || 0) * (Number(rate) || 0);
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

/**
 * The catalog entry that sets an item's low-stock level. An entry with the item's own name
 * wins (so "Ramco PPC Cement" can have its own level); otherwise the entry its purchases were
 * picked from (plain "Cement" covers every brand). The level is converted to the item's unit
 * and ignored when the units do not match (a level in tonnes for sand bought by cft).
 */
function lowStockLevelFor(item: StockItem, catalog: CatalogItem[], ids: Set<string> | undefined): number | undefined {
  const usable = catalog.filter(c => c.kind === 'material' && !c.isDeleted && typeof c.lowStockThreshold === 'number');
  const entry =
    usable.find(c => norm(c.category) === norm(item.category) && norm(c.name) === norm(item.name)) ||
    (ids ? usable.find(c => ids.has(c.id)) : undefined);
  if (!entry || typeof entry.lowStockThreshold !== 'number') return undefined;
  const level = convertStockQuantity(item.category, entry.lowStockThresholdUnit || entry.unit || item.unit, entry.lowStockThreshold);
  return level.family === unitDefinition(item.category, item.unit).family ? level.quantity : undefined;
}

export function buildStock(
  materials: Material[],
  rodEntries: RodEntry[],
  movements: StockMovement[],
  catalog: CatalogItem[] = []
): StockItem[] {
  const items = new Map<string, StockItem>();

  // Catalog entries the purchases of each item were picked from (e.g. plain "Cement" for every brand).
  const catalogIds = new Map<string, Set<string>>();
  const catalogIdsOf = (key: string) => {
    let ids = catalogIds.get(key);
    if (!ids) catalogIds.set(key, (ids = new Set()));
    return ids;
  };

  const ensure = (key: string, name: string, category: string, unit: string): StockItem => {
    let it = items.get(key);
    if (!it) {
      it = {
        key, name, category, unit, isLowStock: false,
        purchased: 0, opening: 0, used: 0, returned: 0, adjusted: 0, onHand: 0,
        purchaseCost: 0, lastActivityDate: '', lines: [], isNegative: false,
      };
      items.set(key, it);
    }
    return it;
  };

  for (const m of materials) {
    if (m.isDeleted) continue;
    const name = (m.materialName || m.category).trim();
    const sourceUnit = (m.unit || 'Unit').trim();
    const normalized = convertStockQuantity(m.category, sourceUnit, 1);
    const it = ensure(stockItemKey({ category: m.category, name, unit: sourceUnit }), name, m.category, normalized.unit);
    const quantity = convertStockQuantity(m.category, sourceUnit, Number(m.quantity) || 0).quantity;
    it.lines.push({
      id: m.id, type: 'purchase', source: 'purchase', date: purchaseDay(m.purchaseDate, m.createdAt),
      createdAt: m.createdAt || '', quantity, signed: quantity,
      voided: false, balanceAfter: 0, supplier: m.supplier, cost: purchaseAmount(m.totalAmount, m.quantity, m.rate ?? (m as { unitPrice?: number }).unitPrice),
      reference: m.invoiceNumber, notes: m.notes,
      billPhotoPath: m.billPhotoPath,
      billPhotoLocalDataUrl: m.billPhotoLocalDataUrl,
      billPhotoSyncStatus: m.billPhotoSyncStatus,
      billPhotoName: m.billPhotoName,
      purchaseRecordId: m.id,
      recordTable: 'materials',
    });
    if (m.catalogItemId) catalogIdsOf(it.key).add(m.catalogItemId);
  }

  for (const r of rodEntries) {
    if (r.isDeleted) continue;
    const name = rodItemName(r);
    const it = ensure(stockItemKey({ category: 'rod', name, unit: 'kg' }), name, 'rod', 'kg');
    it.lines.push({
      id: r.id, type: 'purchase', source: 'purchase', date: purchaseDay(r.purchaseDate, r.createdAt),
      createdAt: r.createdAt || '', quantity: Number(r.weightKg) || 0, signed: Number(r.weightKg) || 0,
      voided: false, balanceAfter: 0, supplier: r.supplier,
      cost: purchaseAmount(r.totalAmount, r.weightKg, r.ratePerKg ?? (r as { pricePerKg?: number }).pricePerKg),
      reference: r.invoiceNumber, notes: r.notes,
      billPhotoPath: r.billPhotoPath,
      billPhotoLocalDataUrl: r.billPhotoLocalDataUrl,
      billPhotoSyncStatus: r.billPhotoSyncStatus,
      billPhotoName: r.billPhotoName,
      purchaseRecordId: r.id,
      recordTable: 'rodEntries',
    });

    const recordedLength = Number(r.lengthMetres);
    if (Number.isFinite(recordedLength) && recordedLength > 0) {
      const lengthItem = ensure(
        stockItemKey({ category: 'rod', name, unit: 'metre' }),
        name,
        'rod',
        'metre',
      );
      lengthItem.lines.push({
        id: `${r.id}-length`, type: 'purchase', source: 'purchase', date: purchaseDay(r.purchaseDate, r.createdAt),
        createdAt: r.createdAt || '', quantity: recordedLength, signed: recordedLength,
        voided: false, balanceAfter: 0, supplier: r.supplier,
        reference: r.invoiceNumber, notes: r.notes,
        billPhotoPath: r.billPhotoPath,
        billPhotoLocalDataUrl: r.billPhotoLocalDataUrl,
        billPhotoSyncStatus: r.billPhotoSyncStatus,
        billPhotoName: r.billPhotoName,
        purchaseRecordId: r.id,
        recordTable: 'rodEntries',
      });
    }
  }

  for (const mv of movements) {
    const normalized = convertStockQuantity(mv.category, mv.unit, Math.max(0, Number(mv.quantity) || 0));
    const itemKey = stockItemKey({ category: mv.category, name: mv.itemName, unit: mv.unit });
    const it = ensure(itemKey, mv.itemName, mv.category, normalized.unit);
    const qty = normalized.quantity;
    it.lines.push({
      id: mv.id, type: mv.movementType, source: 'movement', date: mv.eventDate, createdAt: mv.createdAt || '',
      quantity: qty, signed: mv.isDeleted ? 0 : movementDirection(mv.movementType) * qty,
      voided: !!mv.isDeleted, balanceAfter: 0, notes: mv.notes, reference: mv.reason,
      createdByName: mv.createdByName, voidReason: mv.voidReason,
    });
  }

  for (const it of items.values()) {
    it.lines.sort((a, b) => (a.date === b.date ? a.createdAt.localeCompare(b.createdAt) : a.date.localeCompare(b.date)));
    let balance = 0;
    for (const l of it.lines) {
      balance = round3(balance + l.signed);
      l.balanceAfter = balance;
      if (l.voided) continue;
      if (balance < 0) it.isNegative = true;
      if (l.date > it.lastActivityDate) it.lastActivityDate = l.date;
      switch (l.type) {
        case 'purchase': it.purchased += l.quantity; it.purchaseCost += l.cost || 0; break;
        case 'opening': it.opening += l.quantity; break;
        case 'usage': it.used += l.quantity; break;
        case 'return': it.returned += l.quantity; break;
        case 'adjust_in': it.adjusted += l.quantity; break;
        case 'adjust_out': it.adjusted -= l.quantity; break;
      }
    }
    it.onHand = balance;
    it.lowStockThreshold = lowStockLevelFor(it, catalog, catalogIds.get(it.key));
    it.isLowStock = it.lowStockThreshold !== undefined && it.onHand <= it.lowStockThreshold;
    it.purchased = round3(it.purchased);
    it.used = round3(it.used);
    it.returned = round3(it.returned);
    it.adjusted = round3(it.adjusted);
    it.opening = round3(it.opening);
  }

  return Array.from(items.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export interface MovementCheck {
  ok: boolean;
  error?: string;
  shortBy?: number;
}

/** Validates a new movement against the current balance. Outgoing stock can never exceed stock on hand. */
export function validateMovement(
  onHand: number,
  type: StockMovementType,
  quantity: number,
  item?: Pick<StockItem, 'category' | 'unit'>
): MovementCheck {
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return { ok: false, error: 'Enter a quantity greater than zero.' };
  }
  if (movementDirection(type) === -1 && quantity > onHand + 1e-9) {
    const shortBy = round3(quantity - onHand);
    const left = Math.max(0, onHand);
    return {
      ok: false,
      shortBy,
      error: `Only ${item ? formatStock(item.category, item.unit, left) : round3(left)} in stock. Reduce the quantity, or record the missing purchase or opening stock first.`,
    };
  }
  return { ok: true };
}

/**
 * How much of an item can leave stock on a given day.
 *
 * An entry dated in the past sits before the later entries in the history, so it lowers every
 * balance after it. It is therefore limited by the lowest balance from that day onward, not
 * only by what is in stock today: 10 bags bought on the 5th can not be "used" on the 3rd.
 */
export function availableOn(item: StockItem | undefined, eventDate: string): number {
  if (!item) return 0;
  let atDate = 0;
  let lowestLater = Infinity;
  for (const l of item.lines) {                 // oldest first
    if (l.date <= eventDate) atDate = l.balanceAfter;
    else lowestLater = Math.min(lowestLater, l.balanceAfter);
  }
  return round3(Math.min(atDate, lowestLater));
}

/** validateMovement, with the day the entry is dated taken into account. */
export function validateMovementOn(
  item: StockItem | undefined,
  type: StockMovementType,
  quantity: number,
  eventDate: string
): MovementCheck {
  const today = validateMovement(item?.onHand || 0, type, quantity, item);
  if (!today.ok || movementDirection(type) === 1) return today;
  const available = availableOn(item, eventDate);
  if (quantity > available + 1e-9) {
    const left = Math.max(0, available);
    return {
      ok: false,
      shortBy: round3(quantity - left),
      error: `Only ${item ? formatStock(item.category, item.unit, left) : round3(left)} can be taken out on ${formatDay(eventDate)}: the rest arrived later or is already used in later entries. Reduce the quantity or change the date.`,
    };
  }
  return { ok: true };
}

const sameQty = (a: number, b: number) => Math.abs((Number(a) || 0) - (Number(b) || 0)) < 1e-9;

/**
 * A purchase already saved with the same item, day, quantity and unit price. Two identical
 * deliveries on one day do happen, so the app asks before saving a second one; it does not refuse.
 */
export function findDuplicatePurchase(
  materials: Material[],
  candidate: { category: string; name: string; unit: string; quantity: number; rate: number; purchaseDate: string; supplier?: string }
): Material | undefined {
  const key = stockItemKey({ category: candidate.category, name: candidate.name, unit: candidate.unit });
  return materials.find(m =>
    !m.isDeleted &&
    m.purchaseDate === candidate.purchaseDate &&
    stockItemKey({ category: m.category, name: (m.materialName || m.category).trim(), unit: (m.unit || 'Unit').trim() }) === key &&
    sameQty(m.quantity, candidate.quantity) &&
    sameQty(m.rate, candidate.rate) &&
    norm(m.supplier) === norm(candidate.supplier)
  );
}

/** A stock entry already saved with the same item, kind, day and quantity (cancelled ones do not count). */
export function findDuplicateMovement(
  movements: StockMovement[],
  candidate: {
    itemName: string;
    category: string;
    unit: string;
    movementType: StockMovementType;
    quantity: number;
    eventDate: string;
  }
): StockMovement | undefined {
  const candidateKey = stockItemKey({
    category: candidate.category,
    name: candidate.itemName,
    unit: candidate.unit,
  });
  const candidateQuantity = convertStockQuantity(candidate.category, candidate.unit, candidate.quantity).quantity;
  return movements.find(m =>
    !m.isDeleted &&
    stockItemKey({ category: m.category, name: m.itemName, unit: m.unit }) === candidateKey &&
    m.movementType === candidate.movementType &&
    m.eventDate === candidate.eventDate &&
    sameQty(convertStockQuantity(m.category, m.unit, m.quantity).quantity, candidateQuantity)
  );
}

export interface StockValueSummary {
  totalStockValue: number;
  pendingPurchasesValue: number;
  totalMaterialsCount: number;
}

/**
 * Canonical single source of truth for total material stock value calculation.
 * Computes exact inventory value handling item quantity, rate/unitPrice, totalAmount fallback,
 * pending supplier balances, and filters out deleted records.
 */
export function calculateStockValue(
  materials: Material[] = [],
  rodEntries: RodEntry[] = []
): StockValueSummary {
  let totalStockValue = 0;
  let pendingPurchasesValue = 0;
  let count = 0;

  for (const m of materials) {
    if (m.isDeleted) continue;
    count++;
    const qty = Number(m.quantity) || 0;
    const rate = Number(m.rate ?? (m as any).unitPrice ?? 0);
    const amount = Number(m.totalAmount);
    const itemVal = !isNaN(amount) && amount > 0 ? amount : Math.max(0, qty * rate);
    totalStockValue += itemVal;

    const balance = Number(m.balance) || 0;
    if (balance > 0) {
      pendingPurchasesValue += balance;
    }
  }

  for (const r of rodEntries) {
    if (r.isDeleted) continue;
    count++;
    const weight = Number(r.weightKg) || 0;
    const price = Number(r.ratePerKg ?? (r as any).pricePerKg ?? 0);
    const amount = Number(r.totalAmount);
    const itemVal = !isNaN(amount) && amount > 0 ? amount : Math.max(0, weight * price);
    totalStockValue += itemVal;

    const balance = Number(r.balance) || 0;
    if (balance > 0) {
      pendingPurchasesValue += balance;
    }
  }

  return {
    totalStockValue: Math.round(totalStockValue * 100) / 100,
    pendingPurchasesValue: Math.round(pendingPurchasesValue * 100) / 100,
    totalMaterialsCount: count,
  };
}



// ---------------------------------------------------------------------------
// One set of numbers for every screen
// ---------------------------------------------------------------------------

/** Cement is kept in kilograms so bags and kg add up; people count it in 50 kg bags. */
export function displayStock(category: string, unit: string, quantity: number): { quantity: number; unit: string } {
  if (norm(category) === 'cement' && unit === 'kg') return { quantity: round3(quantity / 50), unit: 'bags' };
  if (unit === 'piece') return { quantity: round3(quantity), unit: 'pcs' };
  return { quantity: round3(quantity), unit };
}

/** "45 bags", "300 cft", "1,200 kg". */
export function formatStock(category: string, unit: string, quantity: number): string {
  const shown = displayStock(category, unit, quantity);
  return `${shown.quantity.toLocaleString('en-IN', { maximumFractionDigits: 3 })} ${shown.unit}`;
}

export type StockStatus = 'ok' | 'low' | 'out' | 'negative';

export function stockStatus(item: Pick<StockItem, 'onHand' | 'isLowStock'>): StockStatus {
  if (item.onHand < 0) return 'negative';
  if (item.onHand === 0) return 'out';
  return item.isLowStock ? 'low' : 'ok';
}

/**
 * Value of what is still on site: on-hand quantity × the weighted average purchase price.
 * Stock with no purchase price (opening stock only, steel counted by length) is valued at ₹0
 * rather than guessed. Less than zero is valued at ₹0, never negative.
 */
export function stockItemValue(item: Pick<StockItem, 'onHand' | 'purchased' | 'purchaseCost'>): number {
  if (item.onHand <= 0 || item.purchased <= 0 || item.purchaseCost <= 0) return 0;
  return round2((item.purchaseCost / item.purchased) * item.onHand);
}

export interface StockSummary {
  itemCount: number;
  inStockCount: number;
  lowCount: number;
  outCount: number;
  negativeCount: number;
  /** On-hand value at weighted average purchase price. */
  stockValue: number;
  /** Everything bought, used or not (same figure as calculateStockValue().totalStockValue). */
  purchaseValue: number;
  /** Still owed to suppliers. */
  payable: number;
}

/** The figures both the desktop and the phone Materials screens show. */
export function summariseStock(items: StockItem[], materials: Material[] = [], rodEntries: RodEntry[] = []): StockSummary {
  const statuses = items.map(stockStatus);
  const owed = calculateStockValue(materials, rodEntries).pendingPurchasesValue;
  return {
    itemCount: items.length,
    inStockCount: items.filter(i => i.onHand > 0).length,
    lowCount: statuses.filter(s => s === 'low').length,
    outCount: statuses.filter(s => s === 'out' || s === 'negative').length,
    negativeCount: statuses.filter(s => s === 'negative').length,
    stockValue: round2(items.reduce((sum, i) => sum + stockItemValue(i), 0)),
    purchaseValue: round2(items.reduce((sum, i) => sum + i.purchaseCost, 0)),
    payable: owed,
  };
}

/** The quick filter chips on the phone. */
export const STOCK_CHIPS = ['all', 'cement', 'sand', 'steel', 'bricks', 'other'] as const;
export type StockChip = typeof STOCK_CHIPS[number];

export function stockChipOf(category: string): Exclude<StockChip, 'all'> {
  const c = norm(category);
  if (c === 'cement') return 'cement';
  if (c === 'sand' || c === 'msand') return 'sand';
  if (c === 'rod' || c === 'steel rods' || c === 'steel') return 'steel';
  if (c === 'bricks') return 'bricks';
  return 'other';
}

/** The latest purchase of each stock item, so its price and supplier can be offered again. */
export function latestPurchaseByItem(materials: Material[]): Map<string, Material> {
  const latest = new Map<string, Material>();
  const rows = materials
    .filter(m => !m.isDeleted)
    .sort((a, b) => (a.purchaseDate || '').localeCompare(b.purchaseDate || '') || (a.createdAt || '').localeCompare(b.createdAt || ''));
  for (const m of rows) {
    latest.set(stockItemKey({ category: m.category, name: (m.materialName || m.category).trim(), unit: (m.unit || 'Unit').trim() }), m);
  }
  return latest;
}

/** Units a purchase or entry for this item may be typed in: those that land on the same stock item. */
export function compatibleUnits(category: string, itemUnit: string, offered: readonly string[]): string[] {
  const family = unitDefinition(category, itemUnit).family;
  const units = Array.from(new Set(offered.filter(u => unitDefinition(category, u).family === family)));
  return units.length ? units : [itemUnit];
}

export interface SiteStockPurchaseRow {
  id: string;
  recordTable: 'materials' | 'rodEntries';
  siteId: string;
  date: string;
  dateFormatted: string;
  createdAt: string;
  itemName: string;
  category: string;
  quantity: number;
  unit: string;
  quantityDisplay: string;
  rate: number;
  supplier: string;
  invoiceNumber: string;
  billPhotoReference: string;
  hasBillPhoto: boolean;
  billPhotoSyncStatus?: BillPhotoSyncStatus;
  billPhotoPath?: string;
  billPhotoLocalDataUrl?: string;
  billPhotoName?: string;
  totalCost: number;
  paidAmount: number;
  balanceDue: number;
  extraPaid: number;
}

export interface SiteStockPurchaseStatement {
  projectId: string;
  projectName: string;
  startDate: string;
  endDate: string;
  dateRangeLabel: string;
  rows: SiteStockPurchaseRow[];
  totalPurchases: number;
  purchasesWithBillPhoto: number;
  totalCost: number;
  totalPaid: number;
  totalBalanceDue: number;
  totalExtraPaid: number;
  excludedVoidedCount: number;
}

export function formatBillPhotoReference(record: {
  billPhotoPath?: string;
  billPhotoLocalDataUrl?: string;
  billPhotoSyncStatus?: BillPhotoSyncStatus;
  billPhotoName?: string;
}): { hasBillPhoto: boolean; billPhotoReference: string } {
  const path = (record.billPhotoPath || '').trim();
  const local = (record.billPhotoLocalDataUrl || '').trim();
  const name = (record.billPhotoName || '').trim();

  if (!path && !local) {
    return { hasBillPhoto: false, billPhotoReference: 'None' };
  }

  if (path) {
    const fileRef = path.split('/').pop() || path;
    if (name && name !== fileRef) {
      return { hasBillPhoto: true, billPhotoReference: `${name} (${fileRef})` };
    }
    return { hasBillPhoto: true, billPhotoReference: `Cloud: ${fileRef}` };
  }

  const syncLabel = record.billPhotoSyncStatus === 'failed' ? 'Retry needed' : 'Pending sync';
  return {
    hasBillPhoto: true,
    billPhotoReference: name ? `${name} (${syncLabel})` : `Attached (${syncLabel})`,
  };
}

/**
 * Builds a deterministic site-wise stock purchase statement for `[startDate, endDate]`.
 * Includes both standard materials and steel/rod entries, excluding soft-deleted / voided records
 * from active cost totals so figures match the Stock & Materials ledger 100%.
 */
export function buildSiteStockPurchaseStatement(params: {
  projectId: string;
  projectName: string;
  startDate?: string;
  endDate?: string;
  materials: Material[];
  rods: RodEntry[];
}): SiteStockPurchaseStatement {
  const { projectId, projectName } = params;
  const startDate = (params.startDate || '').trim().slice(0, 10);
  const endDate = (params.endDate || '').trim().slice(0, 10);

  const inSite = (siteId: string | undefined) =>
    !projectId || projectId === 'all' || siteId === projectId;
  const inDateRange = (date: string) => {
    if (startDate && (!date || date < startDate)) return false;
    if (endDate && (!date || date > endDate)) return false;
    return true;
  };
  const isVoidedOrDeleted = (row: { isDeleted?: boolean; voided?: boolean }) =>
    Boolean(row.isDeleted || row.voided);

  const rows: SiteStockPurchaseRow[] = [];
  let excludedVoidedCount = 0;

  for (const m of params.materials) {
    if (!inSite(m.siteId)) continue;
    const date = purchaseDay(m.purchaseDate, m.createdAt);
    if (!inDateRange(date)) continue;
    if (isVoidedOrDeleted(m as Material & { voided?: boolean })) {
      excludedVoidedCount += 1;
      continue;
    }

    const baseName = (m.materialName || m.category || 'Material').trim();
    const brand = (m.brand || '').trim();
    const itemName = brand && !baseName.toLowerCase().includes(brand.toLowerCase())
      ? `${brand} ${baseName}`
      : baseName;

    const quantity = round3(Number(m.quantity) || 0);
    const unit = (m.unit || 'Unit').trim();
    const rate = round2(Number(m.rate ?? (m as { unitPrice?: number }).unitPrice) || 0);
    const totalCost = round2(purchaseAmount(m.totalAmount, m.quantity, rate));
    const paidAmount = round2(Math.max(0, Number(m.paidAmount) || 0));
    const balanceDue = round2(
      Number.isFinite(Number(m.balance))
        ? Math.max(0, Number(m.balance))
        : Math.max(0, totalCost - paidAmount),
    );
    const extraPaid = round2(Math.max(0, Number(m.extraPaid) || 0));
    const photoRef = formatBillPhotoReference(m);

    rows.push({
      id: m.id,
      recordTable: 'materials',
      siteId: m.siteId,
      date,
      dateFormatted: date ? formatDay(date) : '—',
      createdAt: m.createdAt || '',
      itemName,
      category: m.category,
      quantity,
      unit,
      quantityDisplay: `${quantity.toLocaleString('en-IN', { maximumFractionDigits: 3 })} ${unit}`.trim(),
      rate,
      supplier: (m.supplier || '').trim() || '—',
      invoiceNumber: (m.invoiceNumber || '').trim() || '—',
      billPhotoReference: photoRef.billPhotoReference,
      hasBillPhoto: photoRef.hasBillPhoto,
      billPhotoSyncStatus: m.billPhotoSyncStatus,
      billPhotoPath: m.billPhotoPath,
      billPhotoLocalDataUrl: m.billPhotoLocalDataUrl,
      billPhotoName: m.billPhotoName,
      totalCost,
      paidAmount,
      balanceDue,
      extraPaid,
    });
  }

  for (const r of params.rods) {
    if (!inSite(r.siteId)) continue;
    const date = purchaseDay(r.purchaseDate, r.createdAt);
    if (!inDateRange(date)) continue;
    if (isVoidedOrDeleted(r as RodEntry & { voided?: boolean })) {
      excludedVoidedCount += 1;
      continue;
    }

    const quantity = round3(Number(r.weightKg) || 0);
    const unit = 'kg';
    const rate = round2(Number(r.ratePerKg ?? (r as { pricePerKg?: number }).pricePerKg) || 0);
    const totalCost = round2(purchaseAmount(r.totalAmount, r.weightKg, rate));
    const paidAmount = round2(Math.max(0, Number(r.paidAmount) || 0));
    const balanceDue = round2(
      Number.isFinite(Number(r.balance))
        ? Math.max(0, Number(r.balance))
        : Math.max(0, totalCost - paidAmount),
    );
    const extraPaid = round2(Math.max(0, Number(r.extraPaid) || 0));
    const photoRef = formatBillPhotoReference(r);

    rows.push({
      id: r.id,
      recordTable: 'rodEntries',
      siteId: r.siteId,
      date,
      dateFormatted: date ? formatDay(date) : '—',
      createdAt: r.createdAt || '',
      itemName: rodItemName(r),
      category: 'rod',
      quantity,
      unit,
      quantityDisplay: `${quantity.toLocaleString('en-IN', { maximumFractionDigits: 3 })} kg`,
      rate,
      supplier: (r.supplier || '').trim() || '—',
      invoiceNumber: (r.invoiceNumber || '').trim() || '—',
      billPhotoReference: photoRef.billPhotoReference,
      hasBillPhoto: photoRef.hasBillPhoto,
      billPhotoSyncStatus: r.billPhotoSyncStatus,
      billPhotoPath: r.billPhotoPath,
      billPhotoLocalDataUrl: r.billPhotoLocalDataUrl,
      billPhotoName: r.billPhotoName,
      totalCost,
      paidAmount,
      balanceDue,
      extraPaid,
    });
  }

  rows.sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));

  const dateRangeLabel =
    startDate && endDate
      ? `${formatDay(startDate)} to ${formatDay(endDate)}`
      : startDate
        ? `From ${formatDay(startDate)}`
        : endDate
          ? `Up to ${formatDay(endDate)}`
          : 'All Dates';

  return {
    projectId,
    projectName: projectName || (projectId === 'all' ? 'All Projects (Combined)' : 'Project'),
    startDate,
    endDate,
    dateRangeLabel,
    rows,
    totalPurchases: rows.length,
    purchasesWithBillPhoto: rows.filter(r => r.hasBillPhoto).length,
    totalCost: round2(rows.reduce((s, r) => s + r.totalCost, 0)),
    totalPaid: round2(rows.reduce((s, r) => s + r.paidAmount, 0)),
    totalBalanceDue: round2(rows.reduce((s, r) => s + r.balanceDue, 0)),
    totalExtraPaid: round2(rows.reduce((s, r) => s + r.extraPaid, 0)),
    excludedVoidedCount,
  };
}
