import React, { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowDownCircle, ArrowUpCircle, BookOpen, ChevronRight, Package, Plus, RotateCcw, SlidersHorizontal, Trash2 } from 'lucide-react';
import { db } from '../../db/db';
import type { CatalogItem, MaterialCategory, StockMovementType, User } from '../../db/types';
import { useProject } from '../../hooks/useProject';
import { buildStock, STOCK_MOVEMENT_LABEL, type StockItem, type StockLine } from '../../domain/stock';
import { CEMENT_TYPES, cementItemName, MATERIAL_CATEGORY_LABEL, MATERIAL_UNITS } from '../../domain/catalog';
import {
  ensureCatalogSeeded, recordPurchase, recordStockMovement, removeCatalogItem, saveCatalogItem, voidStockMovement,
} from '../../services/records';
import { formatDateTime, formatDay, todayKey } from '../../utils/datetime';
import { formatINR, formatQty, parseAmount, roundMoney } from '../../utils/money';
import { Badge, CalcLine, Chips, ConfirmSheet, Empty, Field, Loading, Note, Page, SearchBox, Section, Sheet, Stat } from '../../components/mobile/kit';

type EntryMode = 'purchase' | 'usage' | 'return' | 'adjust' | 'opening';

const CATEGORY_ORDER: MaterialCategory[] = ['cement', 'sand', 'msand', 'aggregate', 'bricks', 'rod', 'other'];
const categoryLabel = (c: string) => MATERIAL_CATEGORY_LABEL[c as MaterialCategory] || c;
/** "Bags" -> "bag", "Nos" -> "piece"; other units are already singular. */
const perUnit = (unit: string) => ({ Bags: 'bag', Nos: 'piece', Pieces: 'piece', Units: 'unit' } as Record<string, string>)[unit] || unit;

interface StockViewProps {
  user: User;
  siteId: string;
  onBack: () => void;
  onOpenSteelPurchase: () => void;
  onOpenLedger: () => void;
  onNotify: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const StockView: React.FC<StockViewProps> = ({ user, siteId, onBack, onOpenSteelPurchase, onOpenLedger, onNotify }) => {
  const project = useProject(siteId);
  const catalog = useLiveQuery(() => db.catalogItems.filter(c => !c.isDeleted && c.kind !== 'tool').toArray(), []);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string>('all');
  const [entry, setEntry] = useState<{ mode: EntryMode; itemKey?: string } | null>(null);
  const [chooser, setChooser] = useState(false);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [catalogOpen, setCatalogOpen] = useState(false);

  useEffect(() => {
    ensureCatalogSeeded().catch(() => onNotify('Could not load the material catalog.', 'error'));
    // Seed once per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stock = useMemo(
    () => (project ? buildStock(project.materials, project.rodEntries, project.stockMovements) : []),
    [project]
  );

  if (project === undefined) return <Page title="Materials" onBack={onBack}><Loading rows={5} /></Page>;
  if (project === null) {
    return <Page title="Materials" onBack={onBack}><div className="m-card"><Empty icon={<Package size={26} />} title="Project not found" /></div></Page>;
  }

  const q = query.trim().toLowerCase();
  const shown = stock.filter(s => (category === 'all' || s.category === category) && (!q || s.name.toLowerCase().includes(q)));
  const usedCategories = CATEGORY_ORDER.filter(c => stock.some(s => s.category === c));
  const purchaseValue = roundMoney(stock.reduce((s, i) => s + i.purchaseCost, 0));
  const payable = roundMoney(
    project.materials.reduce((s, m) => s + (Number(m.balance) || 0), 0) + project.rodEntries.reduce((s, r) => s + (Number(r.balance) || 0), 0)
  );
  const openItem = openKey ? stock.find(s => s.key === openKey) : undefined;
  const suppliers = Array.from(new Set(project.materials.map(m => (m.supplier || '').trim()).filter(Boolean))).slice(0, 30);

  return (
    <Page
      title="Materials"
      subtitle={project.site.name}
      onBack={onBack}
      right={
        <button type="button" className="m-icon-btn is-bordered" onClick={() => setCatalogOpen(true)} aria-label="Material catalog">
          <BookOpen size={20} />
        </button>
      }
    >
      <div className="m-stats is-3">
        <Stat label="In stock" value={stock.filter(s => s.onHand > 0).length} hint="items" />
        <Stat label="Bought" value={formatINR(purchaseValue)} hint="all purchases" />
        <Stat label="To pay" value={formatINR(payable)} tone={payable > 0 ? 'bad' : 'ok'} hint="suppliers" />
      </div>

      {stock.some(s => s.isNegative) && (
        <div style={{ marginTop: 10 }}>
          <Note tone="warn">Some items show less than zero. A purchase or opening stock entry is probably missing. Open the item to check its history.</Note>
        </div>
      )}

      {stock.length === 0 ? (
        <div className="m-card" style={{ marginTop: 14 }}>
          <Empty
            icon={<Package size={26} />}
            title="No materials yet"
            action={
              <div style={{ display: 'grid', gap: 10 }}>
                <button type="button" className="m-btn is-primary is-block" onClick={() => setEntry({ mode: 'purchase' })}><Plus size={20} /> Record a purchase</button>
                <button type="button" className="m-btn is-block" onClick={() => setEntry({ mode: 'opening' })}>Add stock already on site</button>
              </div>
            }
          >
            Record what you buy and what you use. The app keeps the balance and the full history.
          </Empty>
        </div>
      ) : (
        <>
          <div style={{ marginTop: 12 }}><SearchBox value={query} onChange={setQuery} placeholder="Search materials" /></div>
          {usedCategories.length > 1 && (
            <div style={{ marginTop: 10 }}>
              <Chips
                label="Category"
                value={category}
                onChange={setCategory}
                options={[{ value: 'all', label: 'All' }, ...usedCategories.map(c => ({ value: c as string, label: categoryLabel(c) }))]}
              />
            </div>
          )}

          <div className="m-card m-list" style={{ marginTop: 10 }}>
            {shown.map(item => (
              <button key={item.key} type="button" className="m-row" onClick={() => setOpenKey(item.key)}>
                <span className="m-row-main">
                  <span className="m-row-title" style={{ display: 'block' }}>{item.name}</span>
                  <span className="m-row-sub">
                    {categoryLabel(item.category)} · in {formatQty(item.purchased + item.opening + Math.max(0, item.adjusted))} · out {formatQty(item.used + item.returned + Math.max(0, -item.adjusted))}
                  </span>
                </span>
                <span className="m-row-end">
                  <span className={`m-qty ${item.onHand < 0 ? 'is-bad' : item.onHand === 0 ? 'is-muted' : ''}`} style={{ display: 'block' }}>
                    {formatQty(item.onHand)}<small>{item.unit}</small>
                  </span>
                  <span className="m-row-sub">in stock</span>
                </span>
                <ChevronRight size={18} className="is-muted" />
              </button>
            ))}
            {shown.length === 0 && <div className="m-row is-muted">No material matches your search.</div>}
          </div>
        </>
      )}

      <button type="button" className="m-fab no-print" onClick={() => setChooser(true)}>
        <Plus size={22} /> Add entry
      </button>
      <div style={{ height: 72 }} aria-hidden="true" />

      {/* What kind of entry? */}
      <Sheet open={chooser} title="Add entry" onClose={() => setChooser(false)}>
        <div className="m-card m-list">
          {([
            ['purchase', 'Purchase', 'Bought from a supplier. Adds to stock and cost.', <ArrowDownCircle size={20} key="i" />],
            ['usage', 'Used on site', 'Material consumed in the work. Reduces stock.', <ArrowUpCircle size={20} key="i" />],
            ['return', 'Returned to supplier', 'Sent back. Reduces stock.', <RotateCcw size={20} key="i" />],
            ['adjust', 'Adjust stock', 'Correct the count after checking the site.', <SlidersHorizontal size={20} key="i" />],
            ['opening', 'Stock already on site', 'Material that was here before you started recording.', <Package size={20} key="i" />],
          ] as [EntryMode, string, string, React.ReactNode][]).map(([mode, label, sub, icon]) => (
            <button key={mode} type="button" className="m-row" onClick={() => { setChooser(false); setEntry({ mode }); }}>
              <span className="m-row-icon">{icon}</span>
              <span className="m-row-main">
                <span className="m-row-title" style={{ display: 'block' }}>{label}</span>
                <span className="m-row-sub" style={{ whiteSpace: 'normal' }}>{sub}</span>
              </span>
              <ChevronRight size={18} className="is-muted" />
            </button>
          ))}
        </div>
      </Sheet>

      {entry && (
        <EntrySheet
          key={`${entry.mode}-${entry.itemKey || ''}`}
          mode={entry.mode}
          presetKey={entry.itemKey}
          user={user}
          siteId={siteId}
          stock={stock}
          catalog={catalog || []}
          suppliers={suppliers}
          onClose={() => setEntry(null)}
          onSaved={msg => onNotify(msg, 'success')}
          onOpenSteelPurchase={() => { setEntry(null); onOpenSteelPurchase(); }}
        />
      )}

      {openItem && !entry && (
        <ItemSheet
          item={openItem}
          user={user}
          siteId={siteId}
          onClose={() => setOpenKey(null)}
          onEntry={mode => setEntry({ mode, itemKey: openItem.key })}
          onOpenLedger={onOpenLedger}
          onNotify={onNotify}
        />
      )}

      <CatalogSheet open={catalogOpen} user={user} catalog={catalog || []} onClose={() => setCatalogOpen(false)} onNotify={onNotify} />
    </Page>
  );
};

/* ------------------------------------------------------------------ Entry sheet */

interface Chosen {
  key?: string;            // existing stock item
  name: string;
  category: string;
  unit: string;
  catalogItemId?: string;
  isCement?: boolean;
}

const ENTRY_TITLE: Record<EntryMode, string> = {
  purchase: 'Record purchase',
  usage: 'Material used on site',
  return: 'Return to supplier',
  adjust: 'Adjust stock',
  opening: 'Stock already on site',
};

const EntrySheet: React.FC<{
  mode: EntryMode;
  presetKey?: string;
  user: User;
  siteId: string;
  stock: StockItem[];
  catalog: CatalogItem[];
  suppliers: string[];
  onClose: () => void;
  onSaved: (msg: string) => void;
  onOpenSteelPurchase: () => void;
}> = ({ mode, presetKey, user, siteId, stock, catalog, suppliers, onClose, onSaved, onOpenSteelPurchase }) => {
  const incoming = mode === 'purchase' || mode === 'opening';
  const preset = presetKey ? stock.find(s => s.key === presetKey) : undefined;
  const [chosen, setChosen] = useState<Chosen | null>(
    preset ? { key: preset.key, name: preset.name, category: preset.category, unit: preset.unit } : null
  );
  const [search, setSearch] = useState('');
  const [customCategory, setCustomCategory] = useState<MaterialCategory>('other');
  const [brand, setBrand] = useState('');
  const [cementType, setCementType] = useState('ppc');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState(preset?.unit || 'Nos');
  const [rate, setRate] = useState('');
  const [payment, setPayment] = useState<'none' | 'full' | 'part'>('none');
  const [paidPart, setPaidPart] = useState('');
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [supplier, setSupplier] = useState('');
  const [date, setDate] = useState(todayKey());
  const [invoice, setInvoice] = useState('');
  const [notes, setNotes] = useState('');
  const [reason, setReason] = useState('');
  const [direction, setDirection] = useState<'adjust_in' | 'adjust_out'>('adjust_out');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const brands = catalog.filter(c => c.kind === 'brand' && c.category === 'cement').sort((a, b) => a.name.localeCompare(b.name));
  const materials = catalog.filter(c => c.kind === 'material');
  const existing = chosen?.key ? stock.find(s => s.key === chosen.key) : undefined;

  const qty = parseAmount(quantity);
  const price = parseAmount(rate);
  const total = !Number.isNaN(qty) && !Number.isNaN(price) ? roundMoney(qty * price) : 0;
  const paidNow = payment === 'full' ? total : payment === 'part' ? parseAmount(paidPart) : 0;

  const finalName = chosen?.isCement ? cementItemName(brand, cementType) : chosen?.name || '';
  const cementMeta = CEMENT_TYPES.find(c => c.id === cementType);

  // ---- Step 1: choose the material -------------------------------------
  if (!chosen) {
    const q = search.trim().toLowerCase();
    if (incoming) {
      const options = materials.filter(m => !q || m.name.toLowerCase().includes(q) || categoryLabel(m.category).toLowerCase().includes(q));
      const exact = materials.some(m => m.name.toLowerCase() === q);
      return (
        <Sheet open title={ENTRY_TITLE[mode]} subtitle="Choose the material" onClose={onClose}>
          <SearchBox value={search} onChange={setSearch} placeholder="Search or type a new material" />
          <div className="m-card m-list" style={{ marginTop: 10 }}>
            {options.map(m => (
              <button
                key={m.id}
                type="button"
                className="m-row"
                onClick={() => {
                  setChosen({ name: m.name, category: m.category, unit: m.unit || 'Nos', catalogItemId: m.id, isCement: m.category === 'cement' });
                  setUnit(m.unit || 'Nos');
                  if (m.category === 'cement' && brands[0]) setBrand(brands[0].name);
                }}
              >
                <span className="m-row-main">
                  <span className="m-row-title" style={{ display: 'block' }}>{m.name}</span>
                  <span className="m-row-sub">{categoryLabel(m.category)} · {m.unit}</span>
                </span>
                <ChevronRight size={18} className="is-muted" />
              </button>
            ))}
            {mode === 'purchase' && (!q || 'steel rods tmt'.includes(q)) && (
              <button type="button" className="m-row" onClick={onOpenSteelPurchase}>
                <span className="m-row-main">
                  <span className="m-row-title" style={{ display: 'block' }}>Steel Rods (TMT)</span>
                  <span className="m-row-sub">Recorded by diameter and weight</span>
                </span>
                <ChevronRight size={18} className="is-muted" />
              </button>
            )}
          </div>
          {q && !exact && (
            <div className="m-card m-card-pad" style={{ marginTop: 10 }}>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Add "{search.trim()}" as a new material</div>
              <Field label="Category">
                <select value={customCategory} onChange={e => setCustomCategory(e.target.value as MaterialCategory)}>
                  {CATEGORY_ORDER.filter(c => c !== 'rod' && c !== 'cement').map(c => <option key={c} value={c}>{categoryLabel(c)}</option>)}
                </select>
              </Field>
              <button
                type="button"
                className="m-btn is-primary is-block"
                onClick={() => setChosen({ name: search.trim(), category: customCategory, unit: 'Nos' })}
              >
                Use this name
              </button>
            </div>
          )}
        </Sheet>
      );
    }

    const options = stock.filter(s => !q || s.name.toLowerCase().includes(q));
    return (
      <Sheet open title={ENTRY_TITLE[mode]} subtitle="Choose the material" onClose={onClose}>
        {stock.length === 0 ? (
          <Empty icon={<Package size={26} />} title="Nothing in stock yet">Record a purchase or the stock already on site first.</Empty>
        ) : (
          <>
            {stock.length > 6 && <SearchBox value={search} onChange={setSearch} placeholder="Search materials" />}
            <div className="m-card m-list" style={{ marginTop: 10 }}>
              {options.map(s => (
                <button key={s.key} type="button" className="m-row" onClick={() => { setChosen({ key: s.key, name: s.name, category: s.category, unit: s.unit }); setUnit(s.unit); }}>
                  <span className="m-row-main">
                    <span className="m-row-title" style={{ display: 'block' }}>{s.name}</span>
                    <span className="m-row-sub">{categoryLabel(s.category)}</span>
                  </span>
                  <span className="m-row-end"><span className="m-qty">{formatQty(s.onHand)}<small>{s.unit}</small></span></span>
                </button>
              ))}
            </div>
          </>
        )}
      </Sheet>
    );
  }

  // ---- Step 2: details --------------------------------------------------
  const submit = async () => {
    if (busy) return;
    setError('');
    if (Number.isNaN(qty) || qty <= 0) return setError('Enter a quantity greater than zero.');
    if (chosen.isCement && !brand.trim()) return setError('Choose the cement brand.');

    setBusy(true);
    if (mode === 'purchase') {
      if (Number.isNaN(price)) { setBusy(false); return setError('Enter the unit price. Use 0 only if the material was free.'); }
      if (payment === 'part' && (Number.isNaN(paidNow) || paidNow <= 0 || paidNow > total)) {
        setBusy(false);
        return setError(`Enter the amount paid, between ₹1 and ${formatINR(total)}.`);
      }
      const res = await recordPurchase(user, siteId, {
        category: chosen.category as MaterialCategory,
        materialName: finalName,
        brand: chosen.isCement ? brand.trim() : undefined,
        materialType: chosen.isCement ? cementMeta?.type : undefined,
        grade: chosen.isCement ? cementMeta?.grade : undefined,
        catalogItemId: chosen.catalogItemId,
        supplier, quantity: qty, unit, rate: price, paidAmount: paidNow, paymentMode,
        purchaseDate: date, invoiceNumber: invoice, notes,
      });
      setBusy(false);
      if (!res.ok) return setError(res.error);
      onSaved(`Purchase recorded: ${formatQty(qty)} ${unit} ${finalName}`);
      return onClose();
    }

    const type: StockMovementType = mode === 'adjust' ? direction : mode === 'opening' ? 'opening' : mode;
    if (mode === 'adjust' && !reason.trim()) { setBusy(false); return setError('Say why the stock is being adjusted.'); }
    const res = await recordStockMovement(user, siteId, {
      itemKey: chosen.key, itemName: finalName, category: chosen.category, unit: existing?.unit || unit,
      movementType: type, quantity: qty, eventDate: date, reason, notes,
    });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    onSaved(`${STOCK_MOVEMENT_LABEL[type]}: ${formatQty(qty)} ${existing?.unit || unit} ${finalName}`);
    onClose();
  };

  return (
    <Sheet
      open
      title={ENTRY_TITLE[mode]}
      subtitle={chosen.isCement ? 'Cement' : chosen.name}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="m-btn" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="button" className="m-btn is-primary" onClick={submit} disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
        </>
      }
    >
      {error && <div style={{ marginBottom: 12 }}><Note tone="bad" role="alert">{error}</Note></div>}

      {existing && !incoming && (
        <div style={{ marginBottom: 12 }}>
          <Note tone={existing.onHand > 0 ? undefined : 'warn'}>
            In stock now: <strong>{formatQty(existing.onHand)} {existing.unit}</strong>
          </Note>
        </div>
      )}

      {chosen.isCement && (
        <>
          <Field label="Brand" hint="Availability differs by dealer and area. Add your own brands from the catalog.">
            <select value={brand} onChange={e => setBrand(e.target.value)}>
              {brands.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
            </select>
          </Field>
          <Field label="Cement type" hint={cementMeta ? `${cementMeta.note} (${cementMeta.standard})` : undefined}>
            <Chips label="Cement type" value={cementType} onChange={setCementType} options={CEMENT_TYPES.map(c => ({ value: c.id, label: c.label }))} />
          </Field>
        </>
      )}

      <div className="m-field-2">
        <Field label="Quantity">
          <input type="text" inputMode="decimal" autoComplete="off" value={quantity} onChange={e => setQuantity(e.target.value)} placeholder="0" aria-label="Quantity" />
        </Field>
        <Field label="Unit">
          {existing ? (
            <input type="text" value={existing.unit} readOnly aria-label="Unit" />
          ) : (
            <select value={unit} onChange={e => setUnit(e.target.value)} aria-label="Unit">
              {(MATERIAL_UNITS as readonly string[]).includes(unit) ? null : <option value={unit}>{unit}</option>}
              {MATERIAL_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          )}
        </Field>
      </div>

      {mode === 'purchase' && (
        <>
          <Field label={`Unit price (₹ per ${perUnit(unit)})`}>
            <input type="text" inputMode="decimal" autoComplete="off" value={rate} onChange={e => setRate(e.target.value)} placeholder="0" aria-label="Unit price in rupees" />
          </Field>
          <div className="m-card m-card-pad" style={{ marginBottom: 14, background: 'var(--m-surface-2)' }}>
            <CalcLine label={`${quantity || 0} × ${formatINR(Number.isNaN(price) ? 0 : price)}`} value={formatINR(total)} />
          </div>
          <Field label="Payment">
            <Chips
              label="Payment"
              value={payment}
              onChange={setPayment}
              options={[{ value: 'none', label: 'Not paid yet' }, { value: 'full', label: 'Paid in full' }, { value: 'part', label: 'Part paid' }]}
            />
          </Field>
          {payment === 'part' && (
            <Field label="Amount paid now (₹)" hint={total > 0 ? `Balance to supplier: ${formatINR(Math.max(0, total - (Number.isNaN(paidNow) ? 0 : paidNow)))}` : undefined}>
              <input type="text" inputMode="decimal" autoComplete="off" value={paidPart} onChange={e => setPaidPart(e.target.value)} placeholder="0" />
            </Field>
          )}
          {payment !== 'none' && (
            <Field label="Paid by">
              <Chips label="Payment mode" value={paymentMode} onChange={setPaymentMode} options={['Cash', 'UPI', 'Bank Transfer', 'Cheque'].map(v => ({ value: v, label: v === 'Bank Transfer' ? 'Bank' : v }))} />
            </Field>
          )}
          <Field label="Supplier (optional)">
            <input type="text" list="m-suppliers" value={supplier} onChange={e => setSupplier(e.target.value)} placeholder="Shop or dealer name" maxLength={80} />
            <datalist id="m-suppliers">{suppliers.map(s => <option key={s} value={s} />)}</datalist>
          </Field>
        </>
      )}

      {mode === 'adjust' && (
        <Field label="Change">
          <Chips
            label="Adjustment direction"
            value={direction}
            onChange={setDirection}
            options={[{ value: 'adjust_out', label: 'Remove (damaged, lost)' }, { value: 'adjust_in', label: 'Add (found extra)' }]}
          />
        </Field>
      )}

      <Field label={mode === 'purchase' ? 'Purchase / receipt date' : 'Date'} hint={date !== todayKey() ? 'Past date selected. The entry time is still saved as now.' : undefined}>
        <input type="date" value={date} max={todayKey()} onChange={e => setDate(e.target.value)} />
      </Field>

      {mode !== 'purchase' && (
        <Field label={mode === 'usage' ? 'Used for (optional)' : mode === 'adjust' ? 'Reason' : 'Reason (optional)'}>
          <input
            type="text"
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder={mode === 'usage' ? 'e.g. Roof slab, plastering' : mode === 'adjust' ? 'e.g. 3 bags hardened in rain' : ''}
            maxLength={120}
          />
        </Field>
      )}

      {mode === 'purchase' && (
        <Field label="Invoice / bill no. (optional)">
          <input type="text" value={invoice} onChange={e => setInvoice(e.target.value)} maxLength={40} />
        </Field>
      )}

      <Field label="Notes (optional)">
        <input type="text" value={notes} onChange={e => setNotes(e.target.value)} maxLength={160} />
      </Field>
    </Sheet>
  );
};

/* ------------------------------------------------------------------ Item history */

const ItemSheet: React.FC<{
  item: StockItem;
  user: User;
  siteId: string;
  onClose: () => void;
  onEntry: (mode: EntryMode) => void;
  onOpenLedger: () => void;
  onNotify: (msg: string, type?: 'success' | 'error' | 'info') => void;
}> = ({ item, user, siteId, onClose, onEntry, onOpenLedger, onNotify }) => {
  const [line, setLine] = useState<StockLine | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [confirmVoid, setConfirmVoid] = useState(false);
  const [busy, setBusy] = useState(false);
  const history = [...item.lines].reverse();

  const doVoid = async () => {
    if (!line || busy) return;
    setBusy(true);
    const res = await voidStockMovement(user, siteId, line.id, voidReason);
    setBusy(false);
    if (res.ok) {
      onNotify('Entry cancelled. It stays in the history, marked as cancelled.', 'info');
      setConfirmVoid(false);
      setLine(null);
      setVoidReason('');
    } else {
      onNotify(res.error, 'error');
    }
  };

  return (
    <>
      <Sheet open={!line} title={item.name} subtitle={categoryLabel(item.category)} onClose={onClose}>
        <div className="m-stat-label">IN STOCK</div>
        <div className={`m-stat-value ${item.onHand < 0 ? 'is-bad' : ''}`} style={{ fontSize: '1.9rem' }}>
          {formatQty(item.onHand)} <span style={{ fontSize: '1rem', fontWeight: 600 }} className="is-muted">{item.unit}</span>
        </div>
        <div className="m-calc" style={{ marginTop: 8 }}>
          <CalcLine label="Purchased" value={`+ ${formatQty(item.purchased)}`} />
          {item.opening > 0 && <CalcLine label="Already on site" value={`+ ${formatQty(item.opening)}`} />}
          <CalcLine label="Used on site" value={`− ${formatQty(item.used)}`} />
          {item.returned > 0 && <CalcLine label="Returned to supplier" value={`− ${formatQty(item.returned)}`} />}
          {item.adjusted !== 0 && <CalcLine label="Adjustments" value={`${item.adjusted > 0 ? '+' : '−'} ${formatQty(Math.abs(item.adjusted))}`} />}
          <CalcLine total label="In stock" value={`${formatQty(item.onHand)} ${item.unit}`} tone={item.onHand < 0 ? 'bad' : undefined} />
        </div>
        {item.purchaseCost > 0 && <p className="m-calc-note">Total purchase cost: {formatINR(item.purchaseCost)}.</p>}

        <div className="m-btn-row" style={{ marginTop: 12 }}>
          <button type="button" className="m-btn is-primary" onClick={() => onEntry('usage')} disabled={item.onHand <= 0}>Use</button>
          <button type="button" className="m-btn" onClick={() => onEntry('return')} disabled={item.onHand <= 0}>Return</button>
          <button type="button" className="m-btn" onClick={() => onEntry('adjust')}>Adjust</button>
        </div>

        <Section title="History">
          <div className="m-card m-list">
            {history.map(l => (
              <button key={l.id} type="button" className="m-row" onClick={() => setLine(l)}>
                <span className="m-row-main">
                  <span className={`m-row-title ${l.voided ? 'is-void' : ''}`} style={{ display: 'block' }}>{STOCK_MOVEMENT_LABEL[l.type]}</span>
                  <span className="m-row-sub">
                    {formatDay(l.date)}{l.supplier ? ' · ' + l.supplier : ''}{l.reference && l.source === 'movement' ? ' · ' + l.reference : ''}
                    {l.voided ? ' · cancelled' : ''}
                  </span>
                </span>
                <span className="m-row-end">
                  <span className={`m-qty ${l.voided ? 'is-void is-muted' : l.signed < 0 ? 'is-bad' : 'is-ok'}`} style={{ display: 'block' }}>
                    {l.type === 'usage' || l.type === 'return' || l.type === 'adjust_out' ? '−' : '+'}{formatQty(l.quantity)}
                  </span>
                  {!l.voided && <span className="m-row-sub">bal {formatQty(l.balanceAfter)}</span>}
                </span>
              </button>
            ))}
          </div>
        </Section>
      </Sheet>

      <Sheet
        open={!!line && !confirmVoid}
        title={line ? STOCK_MOVEMENT_LABEL[line.type] : ''}
        subtitle={item.name}
        onClose={() => setLine(null)}
        footer={
          line && (
            line.source === 'movement' && !line.voided ? (
              <>
                <button type="button" className="m-btn" onClick={() => setLine(null)}>Close</button>
                <button type="button" className="m-btn is-danger" onClick={() => setConfirmVoid(true)}><Trash2 size={18} /> Cancel entry</button>
              </>
            ) : line.source === 'purchase' ? (
              <>
                <button type="button" className="m-btn" onClick={() => setLine(null)}>Close</button>
                <button type="button" className="m-btn" onClick={onOpenLedger}>Open in ledger</button>
              </>
            ) : (
              <button type="button" className="m-btn" onClick={() => setLine(null)}>Close</button>
            )
          )
        }
      >
        {line && (
          <div className="m-calc">
            <CalcLine label="Quantity" value={`${formatQty(line.quantity)} ${item.unit}`} />
            <CalcLine label="Date" value={formatDay(line.date)} />
            {line.supplier && <CalcLine label="Supplier" value={line.supplier} />}
            {line.cost !== undefined && line.source === 'purchase' && <CalcLine label="Cost" value={formatINR(line.cost)} />}
            {line.reference && <CalcLine label={line.source === 'purchase' ? 'Invoice' : 'Reason'} value={<span style={{ whiteSpace: 'normal' }}>{line.reference}</span>} />}
            {line.notes && <CalcLine label="Notes" value={<span style={{ whiteSpace: 'normal', fontFamily: 'var(--font-body)', fontWeight: 600 }}>{line.notes}</span>} />}
            <CalcLine label="Entered" value={formatDateTime(line.createdAt)} />
            {line.createdByName && <CalcLine label="Entered by" value={line.createdByName} />}
            {line.voided ? <CalcLine label="Cancelled" value={line.voidReason || 'Yes'} tone="bad" /> : <CalcLine label="Stock after this entry" value={`${formatQty(line.balanceAfter)} ${item.unit}`} />}
          </div>
        )}
        {line?.source === 'purchase' && <p className="m-calc-note">Purchases carry cost and supplier payments. Correct or delete them in the Materials ledger so the payment history stays right.</p>}
      </Sheet>

      <Sheet
        open={confirmVoid}
        title="Cancel this entry?"
        onClose={() => setConfirmVoid(false)}
        footer={
          <>
            <button type="button" className="m-btn" onClick={() => setConfirmVoid(false)} disabled={busy}>Keep it</button>
            <button type="button" className="m-btn is-danger" onClick={doVoid} disabled={busy || !voidReason.trim()}>{busy ? 'Please wait…' : 'Cancel entry'}</button>
          </>
        }
      >
        <p style={{ color: 'var(--m-ink-2)', marginBottom: 12, lineHeight: 1.5 }}>
          The entry will stay in the history marked as cancelled and will no longer change the stock balance.
        </p>
        <Field label="Why is it being cancelled?">
          <input type="text" value={voidReason} onChange={e => setVoidReason(e.target.value)} placeholder="e.g. Entered twice by mistake" maxLength={120} />
        </Field>
      </Sheet>
    </>
  );
};

/* ------------------------------------------------------------------ Catalog */

const CatalogSheet: React.FC<{
  open: boolean;
  user: User;
  catalog: CatalogItem[];
  onClose: () => void;
  onNotify: (msg: string, type?: 'success' | 'error' | 'info') => void;
}> = ({ open, user, catalog, onClose, onNotify }) => {
  const [tab, setTab] = useState<'brand' | 'material'>('brand');
  const [name, setName] = useState('');
  const [category, setCategory] = useState<MaterialCategory>('other');
  const [unit, setUnit] = useState('Nos');
  const [editing, setEditing] = useState<CatalogItem | null>(null);
  const [removing, setRemoving] = useState<CatalogItem | null>(null);
  const [busy, setBusy] = useState(false);

  const rows = catalog
    .filter(c => (tab === 'brand' ? c.kind === 'brand' && c.category === 'cement' : c.kind === 'material'))
    .sort((a, b) => a.name.localeCompare(b.name));

  const reset = () => { setName(''); setEditing(null); setUnit('Nos'); setCategory('other'); };

  const save = async () => {
    if (busy) return;
    setBusy(true);
    const res = await saveCatalogItem(user, {
      id: editing?.id,
      kind: tab,
      name,
      category: tab === 'brand' ? 'cement' : editing ? editing.category : category,
      unit: tab === 'material' ? unit : undefined,
    });
    setBusy(false);
    if (res.ok) {
      onNotify(editing ? 'Catalog entry updated' : `"${res.value.name}" added to the catalog`, 'success');
      reset();
    } else onNotify(res.error, 'error');
  };

  return (
    <>
      <Sheet open={open && !removing} title="Material catalog" subtitle="Used when recording purchases" onClose={() => { reset(); onClose(); }}>
        <Chips label="Catalog section" value={tab} onChange={v => { setTab(v); reset(); }} options={[{ value: 'brand', label: 'Cement brands' }, { value: 'material', label: 'Materials' }]} />

        {tab === 'brand' && (
          <>
            <p className="m-calc-note">
              A starting list for Tamil Nadu and South India. It is not a statement that every brand is sold in your area. Add, rename or remove brands to match your dealers.
            </p>
            <div className="m-card m-card-pad" style={{ marginTop: 10 }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>Cement types</div>
              {CEMENT_TYPES.map(c => (
                <div key={c.id} style={{ fontSize: '0.86rem', padding: '5px 0', color: 'var(--m-ink-2)' }}>
                  <strong style={{ color: 'var(--m-ink)' }}>{c.label}</strong> <Badge>{c.standard}</Badge>
                  <div>{c.note}</div>
                </div>
              ))}
              <p className="m-calc-note">Type is the composition (OPC, PPC, PSC). Grade (43, 53) is strength and applies to OPC only. Brand is the maker.</p>
            </div>
          </>
        )}

        <div className="m-card m-card-pad" style={{ marginTop: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>{editing ? `Rename "${editing.name}"` : tab === 'brand' ? 'Add a cement brand' : 'Add a material'}</div>
          <Field label="Name">
            <input type="text" value={name} onChange={e => setName(e.target.value)} maxLength={60} placeholder={tab === 'brand' ? 'e.g. Penna' : 'e.g. Granite slab'} />
          </Field>
          {tab === 'material' && (
            <div className="m-field-2">
              {!editing && (
                <Field label="Category">
                  <select value={category} onChange={e => setCategory(e.target.value as MaterialCategory)}>
                    {CATEGORY_ORDER.filter(c => c !== 'rod').map(c => <option key={c} value={c}>{categoryLabel(c)}</option>)}
                  </select>
                </Field>
              )}
              <Field label="Usual unit">
                <select value={unit} onChange={e => setUnit(e.target.value)}>
                  {MATERIAL_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </Field>
            </div>
          )}
          <div className="m-btn-row">
            {editing && <button type="button" className="m-btn" onClick={reset}>Cancel</button>}
            <button type="button" className="m-btn is-primary" onClick={save} disabled={busy || !name.trim()}>{editing ? 'Save name' : 'Add'}</button>
          </div>
        </div>

        <div className="m-card m-list" style={{ marginTop: 12 }}>
          {rows.map(c => (
            <div key={c.id} className="m-row">
              <span className="m-row-main">
                <span className="m-row-title" style={{ display: 'block' }}>{c.name}</span>
                <span className="m-row-sub">{tab === 'brand' ? c.description || 'Cement brand' : `${categoryLabel(c.category)} · ${c.unit || ''}`}{c.isBuiltIn ? '' : ' · added by you'}</span>
              </span>
              <button type="button" className="m-btn is-small" onClick={() => { setEditing(c); setName(c.name); setUnit(c.unit || 'Nos'); }}>Rename</button>
              <button type="button" className="m-icon-btn" onClick={() => setRemoving(c)} aria-label={`Remove ${c.name}`}><Trash2 size={18} /></button>
            </div>
          ))}
          {rows.length === 0 && <div className="m-row is-muted">Nothing here yet.</div>}
        </div>
      </Sheet>

      <ConfirmSheet
        open={!!removing}
        title={`Remove "${removing?.name}"?`}
        message="It will no longer be offered when recording purchases. Records already saved keep their name."
        confirmLabel="Remove"
        danger
        onConfirm={async () => { if (removing) { await removeCatalogItem(removing.id); onNotify(`"${removing.name}" removed from the catalog`, 'info'); } setRemoving(null); }}
        onCancel={() => setRemoving(null)}
      />
    </>
  );
};
