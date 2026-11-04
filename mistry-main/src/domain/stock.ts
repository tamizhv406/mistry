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
import type { CatalogItem, Material, RodEntry, StockMovement, StockMovementType } from '../db/types';
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

export function buildStock(
  materials: Material[],
  rodEntries: RodEntry[],
  movements: StockMovement[],
  catalog: CatalogItem[] = []
): StockItem[] {
  const items = new Map<string, StockItem>();

  const ensure = (key: string, name: string, category: string, unit: string, lowStockThreshold?: number): StockItem => {
    let it = items.get(key);
    if (!it) {
      it = {
        key, name, category, unit, lowStockThreshold, isLowStock: false,
        purchased: 0, opening: 0, used: 0, returned: 0, adjusted: 0, onHand: 0,
        purchaseCost: 0, lastActivityDate: '', lines: [], isNegative: false,
      };
      items.set(key, it);
    } else if (lowStockThreshold !== undefined) {
      it.lowStockThreshold = lowStockThreshold;
    }
    return it;
  };

  for (const m of materials) {
    if (m.isDeleted) continue;
    const name = (m.materialName || m.category).trim();
    const sourceUnit = (m.unit || 'Unit').trim();
    const normalized = convertStockQuantity(m.category, sourceUnit, 1);
    const itemCatalog = catalog.find(c =>
      c.kind === 'material' && !c.isDeleted &&
      (c.id === m.catalogItemId || (c.category === m.category && norm(c.name) === norm(name)))
    );
    const thresholdUnit = itemCatalog?.lowStockThresholdUnit || itemCatalog?.unit || sourceUnit;
    const threshold = itemCatalog?.lowStockThreshold;
    const normalizedThreshold = typeof threshold !== 'number'
      ? undefined
      : convertStockQuantity(m.category, thresholdUnit, threshold);
    const safeThreshold = normalizedThreshold?.family === normalized.family ? normalizedThreshold.quantity : undefined;
    const it = ensure(stockItemKey({ category: m.category, name, unit: sourceUnit }), name, m.category, normalized.unit, safeThreshold);
    const quantity = convertStockQuantity(m.category, sourceUnit, Number(m.quantity) || 0).quantity;
    it.lines.push({
      id: m.id, type: 'purchase', source: 'purchase', date: purchaseDay(m.purchaseDate, m.createdAt),
      createdAt: m.createdAt || '', quantity, signed: quantity,
      voided: false, balanceAfter: 0, supplier: m.supplier, cost: Number(m.totalAmount) || 0,
      reference: m.invoiceNumber, notes: m.notes,
    });
  }

  for (const r of rodEntries) {
    if (r.isDeleted) continue;
    const name = rodItemName(r);
    const it = ensure(stockItemKey({ category: 'rod', name, unit: 'kg' }), name, 'rod', 'kg');
    it.lines.push({
      id: r.id, type: 'purchase', source: 'purchase', date: purchaseDay(r.purchaseDate, r.createdAt),
      createdAt: r.createdAt || '', quantity: Number(r.weightKg) || 0, signed: Number(r.weightKg) || 0,
      voided: false, balanceAfter: 0, supplier: r.supplier, cost: Number(r.totalAmount) || 0,
      reference: r.invoiceNumber, notes: r.notes,
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
  quantity: number
): MovementCheck {
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return { ok: false, error: 'Enter a quantity greater than zero.' };
  }
  if (movementDirection(type) === -1 && quantity > onHand + 1e-9) {
    const shortBy = round3(quantity - onHand);
    return {
      ok: false,
      shortBy,
      error: `Only ${round3(Math.max(0, onHand))} in stock. Reduce the quantity, or record the missing purchase or opening stock first.`,
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
  const today = validateMovement(item?.onHand || 0, type, quantity);
  if (!today.ok || movementDirection(type) === 1) return today;
  const available = availableOn(item, eventDate);
  if (quantity > available + 1e-9) {
    return {
      ok: false,
      shortBy: round3(quantity - Math.max(0, available)),
      error: `Only ${round3(Math.max(0, available))} can be taken out on ${formatDay(eventDate)}: the rest arrived later or is already used in later entries. Reduce the quantity or change the date.`,
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
