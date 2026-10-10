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
import type { Material, RodEntry, StockMovement, StockMovementType } from '../db/types';

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

/** Identity of a stock item within a site: category + name + unit. */
export function stockItemKey(item: { category: string; name: string; unit: string }): string {
  return `${norm(item.category)}|${norm(item.name)}|${normaliseUnit(item.unit)}`;
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
  movements: StockMovement[]
): StockItem[] {
  const items = new Map<string, StockItem>();

  const ensure = (key: string, name: string, category: string, unit: string): StockItem => {
    let it = items.get(key);
    if (!it) {
      it = {
        key, name, category, unit,
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
    const unit = (m.unit || 'Unit').trim();
    const it = ensure(stockItemKey({ category: m.category, name, unit }), name, m.category, unit);
    it.lines.push({
      id: m.id, type: 'purchase', source: 'purchase', date: m.purchaseDate || (m.createdAt || '').slice(0, 10),
      createdAt: m.createdAt || '', quantity: Number(m.quantity) || 0, signed: Number(m.quantity) || 0,
      voided: false, balanceAfter: 0, supplier: m.supplier, cost: Number(m.totalAmount) || 0,
      reference: m.invoiceNumber, notes: m.notes,
    });
  }

  for (const r of rodEntries) {
    if (r.isDeleted) continue;
    const name = rodItemName(r);
    const it = ensure(stockItemKey({ category: 'rod', name, unit: 'kg' }), name, 'rod', 'kg');
    it.lines.push({
      id: r.id, type: 'purchase', source: 'purchase', date: r.purchaseDate || (r.createdAt || '').slice(0, 10),
      createdAt: r.createdAt || '', quantity: Number(r.weightKg) || 0, signed: Number(r.weightKg) || 0,
      voided: false, balanceAfter: 0, supplier: r.supplier, cost: Number(r.totalAmount) || 0,
      reference: r.invoiceNumber, notes: r.notes,
    });
  }

  for (const mv of movements) {
    const it = ensure(mv.itemKey, mv.itemName, mv.category, mv.unit);
    const qty = Math.max(0, Number(mv.quantity) || 0);
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
