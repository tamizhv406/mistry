import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  ArrowDownCircle, ArrowLeft, ArrowUpCircle, BookOpen, ChevronRight, MoreHorizontal, Package, Plus, RotateCcw, SlidersHorizontal, Trash2,
} from 'lucide-react';
import { db } from '../../db/db';
import type { CatalogItem, Material, MaterialCategory, StockMovementType, User } from '../../db/types';
import { useProject } from '../../hooks/useProject';
import { buildStock, stockItemKey, STOCK_MOVEMENT_LABEL, type StockItem, type StockLine } from '../../domain/stock';
import {
  CEMENT_TYPES, cementItemName, MATERIAL_GROUPS, MATERIAL_MAIN_GROUPS,
  materialGroup, materialGroupId, materialGroupImage, materialUnitsForCategory,
} from '../../domain/catalog';
import { MATERIAL_IMAGES } from '../../domain/materialImages';
import {
  ensureCatalogSeeded, recordPurchase, recordStockMovement, removeCatalogItem, saveCatalogItem, voidStockMovement,
} from '../../services/records';
import { formatDateTime, formatDay, todayKey } from '../../utils/datetime';
import { formatINR, formatQty, parseAmount, roundMoney } from '../../utils/money';
import { Badge, CalcLine, Chips, ConfirmSheet, Empty, Field, Loading, Note, Page, SearchBox, Section, Sheet, Stat } from '../../components/mobile/kit';

type EntryMode = 'purchase' | 'usage' | 'return' | 'adjust' | 'opening';

/** "Bags" -> "bag", "Nos" -> "piece"; other units are already singular. */
const perUnit = (unit: string) => ({ Bags: 'bag', Nos: 'piece', Pieces: 'piece', Units: 'unit' } as Record<string, string>)[unit] || unit;
const isOut = (type: StockLine['type']) => type === 'usage' || type === 'return' || type === 'adjust_out';

/** Shelves where every item is the same kind of material, so the shelf photo fits each of them. */
const ONE_MATERIAL_SHELVES = new Set(['cement', 'sand', 'msand', 'aggregate', 'rod']);

/** Bundled photos are stored relative to the app base; user photos are data URLs. */
const photoSrc = (url?: string) => (url ? (url.startsWith('data:') || url.startsWith('http') ? url : `./${url}`) : undefined);

const MaterialPhoto: React.FC<{ url?: string; alt: string; className: string }> = ({ url, alt, className }) => {
  const [failed, setFailed] = useState(false);
  const src = photoSrc(url);
  if (!src || failed) {
    return <div className={`${className} ${className === 'm-thumb' ? 'm-thumb-empty' : 'm-tool-photo-empty'}`} role="img" aria-label={`${alt} (no photo)`}><Package size={className === 'm-thumb' ? 22 : 34} /></div>;
  }
  return <img className={className} src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} />;
};

/** The photo for a stock item: its catalog entry's, or the shelf photo when the shelf holds one kind of material. */
function stockPhoto(item: Pick<StockItem, 'name' | 'category'>, groupId: string, catalog: CatalogItem[]): string | undefined {
  const wanted = item.name.trim().toLowerCase();
  const entry = catalog.find(c => c.kind === 'material' && c.name.trim().toLowerCase() === wanted);
  return entry?.imageUrl || (ONE_MATERIAL_SHELVES.has(groupId) ? materialGroupImage(groupId) : undefined);
}

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
  const [shelf, setShelf] = useState<string>('all');
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
    () => (project ? buildStock(project.materials, project.rodEntries, project.stockMovements, catalog || []) : []),
    [project, catalog]
  );
  const shelfOf = useMemo(() => {
    return new Map(stock.map(s => [s.key, materialGroupId(s.category)]));
  }, [stock]);
  // The latest purchase of each stock item: its price and supplier are offered again, and a
  // repeat cement purchase keeps the brand, type and grade it was first recorded with.
  const lastPurchase = useMemo(() => {
    const latest = new Map<string, Material>();
    const rows = (project?.materials || []).filter(m => !m.isDeleted)
      .sort((a, b) => (a.purchaseDate || '').localeCompare(b.purchaseDate || '') || (a.createdAt || '').localeCompare(b.createdAt || ''));
    for (const m of rows) {
      latest.set(stockItemKey({ category: m.category, name: (m.materialName || m.category).trim(), unit: (m.unit || 'Unit').trim() }), m);
    }
    return latest;
  }, [project]);

  if (project === undefined) return <Page title="Materials" onBack={onBack}><Loading rows={5} /></Page>;
  if (project === null) {
    return <Page title="Materials" onBack={onBack}><div className="m-card"><Empty icon={<Package size={26} />} title="Project not found" /></div></Page>;
  }

  const q = query.trim().toLowerCase();
  const matches = (s: StockItem) => {
    if (!q) return true;
    const g = materialGroup(shelfOf.get(s.key) || 'other');
    return s.name.toLowerCase().includes(q) || g.label.toLowerCase().includes(q) || g.keywords.includes(q);
  };
  const shown = stock.filter(s => (shelf === 'all' || shelfOf.get(s.key) === shelf) && matches(s));
  const usedShelves = MATERIAL_GROUPS.filter(g => stock.some(s => shelfOf.get(s.key) === g.id));
  const purchaseValue = roundMoney(stock.reduce((s, i) => s + i.purchaseCost, 0));
  const payable = roundMoney(
    project.materials.reduce((s, m) => s + (Number(m.balance) || 0), 0) + project.rodEntries.reduce((s, r) => s + (Number(r.balance) || 0), 0)
  );
  const openItem = openKey ? stock.find(s => s.key === openKey) : undefined;
  const suppliers = Array.from(new Set(project.materials.map(m => (m.supplier || '').trim()).filter(Boolean))).slice(0, 30);
  const hasStock = stock.some(s => s.onHand > 0);

  const quick: [EntryMode | 'more', string, React.ReactNode, boolean][] = [
    ['purchase', 'Purchase', <ArrowDownCircle size={22} key="i" />, false],
    ['usage', 'Use', <ArrowUpCircle size={22} key="i" />, !hasStock],
    ['return', 'Return', <RotateCcw size={22} key="i" />, !hasStock],
    ['more', 'More', <MoreHorizontal size={22} key="i" />, false],
  ];

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
      <div className="m-action-grid" role="group" aria-label="Add an entry">
        {quick.map(([mode, label, icon, disabled]) => (
          <button
            key={mode}
            type="button"
            className="m-action"
            disabled={disabled}
            style={disabled ? { opacity: 0.45 } : undefined}
            onClick={() => (mode === 'more' ? setChooser(true) : setEntry({ mode }))}
          >
            <span className="m-action-icon">{icon}</span>
            {label}
          </button>
        ))}
      </div>

      <div className="m-stats is-3" style={{ marginTop: 10 }}>
        <Stat label="In stock" value={stock.filter(s => s.onHand > 0).length} hint="items" />
        <Stat label="Bought" value={formatINR(purchaseValue)} hint="all purchases" />
        <Stat label="To pay" value={formatINR(payable)} tone={payable > 0 ? 'bad' : 'ok'} hint="suppliers" />
      </div>

      {stock.some(s => s.isNegative) && (
        <div style={{ marginTop: 10 }}>
          <Note tone="warn">Some items show less than zero. A purchase or opening stock entry is probably missing. Open the item to check its history.</Note>
        </div>
      )}
      {stock.some(s => s.isLowStock) && (
        <div style={{ marginTop: 10 }}>
          <Note tone="warn">
            {stock.filter(s => s.isLowStock).length} item{stock.filter(s => s.isLowStock).length === 1 ? '' : 's'} at or below the reorder threshold.
          </Note>
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
          <div style={{ marginTop: 12 }}><SearchBox value={query} onChange={setQuery} placeholder="Search materials or categories" /></div>
          {usedShelves.length > 1 && (
            <div style={{ marginTop: 10 }}>
              <Chips
                label="Category"
                value={shelf}
                onChange={setShelf}
                options={[
                  { value: 'all', label: `All (${stock.length})` },
                  ...usedShelves.map(g => ({ value: g.id, label: `${g.label} (${stock.filter(s => shelfOf.get(s.key) === g.id).length})` })),
                ]}
              />
            </div>
          )}

          <div className="m-card m-list" style={{ marginTop: 10 }}>
            {shown.map(item => {
              const groupId = shelfOf.get(item.key) || 'other';
              return (
                <button key={item.key} type="button" className="m-row" onClick={() => setOpenKey(item.key)}>
                  <MaterialPhoto url={stockPhoto(item, groupId, catalog || [])} alt={item.name} className="m-thumb" />
                  <span className="m-row-main">
                    <span className="m-row-title" style={{ display: 'block' }}>{item.name}</span>
                    <span className="m-row-sub">
                      {materialGroup(groupId).label !== item.name
                        ? materialGroup(groupId).label
                        : item.lastActivityDate ? `Last entry ${formatDay(item.lastActivityDate)}` : ''}
                    </span>
                  </span>
                  <span className="m-row-end">
                    <span className={`m-qty ${item.onHand < 0 ? 'is-bad' : item.onHand === 0 ? 'is-muted' : ''}`} style={{ display: 'block' }}>
                      {formatQty(item.onHand)}<small>{item.unit}</small>
                    </span>
                    <span className="m-row-sub">in stock</span>
                    {item.isLowStock && <span className="m-row-sub" style={{ color: 'var(--bad, #dc2626)' }}>Low stock</span>}
                  </span>
                </button>
              );
            })}
            {shown.length === 0 && <div className="m-row is-muted">No material matches your search.</div>}
          </div>
        </>
      )}

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
          shelfOf={shelfOf}
          lastPurchase={lastPurchase}
          catalog={catalog || []}
          suppliers={suppliers}
          onClose={() => setEntry(null)}
          onSaved={msg => onNotify(msg, 'success')}
          onNotify={onNotify}
          onOpenSteelPurchase={() => { setEntry(null); onOpenSteelPurchase(); }}
        />
      )}

      {openItem && !entry && (
        <ItemSheet
          item={openItem}
          shelfLabel={materialGroup(shelfOf.get(openItem.key) || 'other').label}
          user={user}
          siteId={siteId}
          onClose={() => setOpenKey(null)}
          onEntry={mode => (mode === 'purchase' && openItem.category === 'rod' ? onOpenSteelPurchase() : setEntry({ mode, itemKey: openItem.key }))}
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
  /** A material typed in here for the first time: it is added to the catalog once the entry is saved. */
  newInShelf?: string;
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
  shelfOf: Map<string, string>;
  lastPurchase: Map<string, Material>;
  catalog: CatalogItem[];
  suppliers: string[];
  onClose: () => void;
  onSaved: (msg: string) => void;
  onNotify: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onOpenSteelPurchase: () => void;
}> = ({ mode, presetKey, user, siteId, stock, shelfOf, lastPurchase, catalog, suppliers, onClose, onSaved, onNotify, onOpenSteelPurchase }) => {
  const incoming = mode === 'purchase' || mode === 'opening';
  const preset = presetKey ? stock.find(s => s.key === presetKey) : undefined;
  const [chosen, setChosen] = useState<Chosen | null>(
    preset ? { key: preset.key, name: preset.name, category: preset.category, unit: preset.unit } : null
  );
  const [search, setSearch] = useState('');
  const [shelf, setShelf] = useState<string | null>(null);
  const [customShelf, setCustomShelf] = useState('legacy');
  const [brand, setBrand] = useState('');
  const [addingBrand, setAddingBrand] = useState(false);
  const [newBrand, setNewBrand] = useState('');
  const [cementTypeId, setCementTypeId] = useState('');
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
  const [duplicate, setDuplicate] = useState(false);
  // State updates are not immediate, so a second tap could start a second save before `busy` shows.
  const saving = useRef(false);
  const availableEntryUnits = materialUnitsForCategory(chosen?.category || 'other');

  const brands = catalog.filter(c => c.kind === 'brand' && c.category === 'cement').sort((a, b) => a.name.localeCompare(b.name));
  const materials = catalog.filter(c => c.kind === 'material');
  const savedTypes = catalog.filter(c => c.kind === 'cement_type');
  // The four documented types stand in until the catalog has been seeded.
  const cementTypes: Pick<CatalogItem, 'id' | 'name' | 'description' | 'standard' | 'materialType' | 'grade'>[] = savedTypes.length
    ? savedTypes
    : CEMENT_TYPES.map(c => ({ id: c.id, name: c.label, description: c.note, standard: c.standard, materialType: c.type, grade: c.grade }));
  const cementType = cementTypes.find(c => c.id === cementTypeId) || cementTypes.find(c => c.materialType === 'PPC') || cementTypes[0];
  const existing = chosen?.key ? stock.find(s => s.key === chosen.key) : undefined;

  const qty = parseAmount(quantity);
  const price = parseAmount(rate);
  const total = !Number.isNaN(qty) && !Number.isNaN(price) ? roundMoney(qty * price) : 0;
  const paidNow = payment === 'full' ? total : payment === 'part' ? parseAmount(paidPart) : 0;

  const finalName = chosen?.isCement ? cementItemName(brand, cementType?.name || '') : chosen?.name || '';
  const shelfIdOf = (m: CatalogItem) => (m.category === 'other' ? materialGroup(m.group || 'other').id : m.category);

  const choose = (m: CatalogItem) => {
    // Brand and type are asked for plain "Cement"; a cement product added by name keeps its name.
    const isCement = m.category === 'cement' && (m.id === 'mat-cement' || m.name.trim().toLowerCase() === 'cement');
    setChosen({ name: m.name, category: m.category, unit: m.unit || 'Nos', catalogItemId: m.id, isCement });
    setUnit(m.unit || 'Nos');
    if (isCement) {
      // Start from the brand and type bought last on this project, if they are still in the catalog.
      const lastCement = [...lastPurchase.values()]
        .filter(p => p.category === 'cement' && p.brand)
        .sort((a, b) => (a.purchaseDate || '').localeCompare(b.purchaseDate || '') || (a.createdAt || '').localeCompare(b.createdAt || ''))
        .pop();
      const knownBrand = brands.find(b => b.name === lastCement?.brand);
      setBrand(b => b || knownBrand?.name || brands[0]?.name || '');
      const knownType = lastCement && cementTypes.find(t => t.materialType === lastCement.materialType && (t.grade || '') === (lastCement.grade || ''));
      if (knownType) setCementTypeId(id => id || knownType.id);
    }
  };

  // ---- Step 1: choose the material -------------------------------------
  if (!chosen) {
    const q = search.trim().toLowerCase();
    if (incoming) {
      const steelShelf = mode === 'purchase';
      const shelves = MATERIAL_GROUPS.filter(g => (g.id === 'rod' ? steelShelf : true));
      const inShelf = (id: string) => materials.filter(m => shelfIdOf(m) === id).sort((a, b) => a.name.localeCompare(b.name));
      const found = materials
        .filter(m => {
          const g = materialGroup(shelfIdOf(m));
          return m.name.toLowerCase().includes(q) || g.label.toLowerCase().includes(q) || g.keywords.includes(q);
        })
        .sort((a, b) => a.name.localeCompare(b.name));
      const exact = materials.some(m => m.name.toLowerCase() === q);
      const list = q ? found : shelf ? inShelf(shelf) : [];
      const steelMatches = steelShelf && q && 'steel rods tmt rebar kambi'.includes(q);

      const openShelf = (id: string) => {
        if (id === 'rod') return onOpenSteelPurchase();
        const items = inShelf(id);
        if (items.length === 1) return choose(items[0]);
        setShelf(id);
        setCustomShelf(id);
      };

      return (
        <Sheet open title={ENTRY_TITLE[mode]} subtitle={shelf && !q ? materialGroup(shelf).label : 'Choose the material'} onClose={onClose}>
          <SearchBox value={search} onChange={setSearch} placeholder="Search material or category" />

          {!q && !shelf && (
            <div className="m-tool-grid" style={{ marginTop: 12 }}>
              {shelves.map(g => {
                const count = g.id === 'rod' ? 0 : inShelf(g.id).length;
                return (
                  <button key={g.id} type="button" className="m-card m-tool-card" onClick={() => openShelf(g.id)}>
                    <MaterialPhoto url={materialGroupImage(g.id)} alt={g.label} className="m-tool-photo" />
                    <div className="m-tool-body">
                      <div className="m-tool-name">{g.label}</div>
                      <div className="m-row-sub">{g.id === 'rod' ? 'By diameter and weight' : count === 1 ? inShelf(g.id)[0].unit : `${count} items`}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {!q && shelf && (
            <button type="button" className="m-btn is-quiet is-small" style={{ marginTop: 8, paddingLeft: 0 }} onClick={() => setShelf(null)}>
              <ArrowLeft size={18} /> All categories
            </button>
          )}

          {(q || shelf) && (
            <div className="m-card m-list" style={{ marginTop: 8 }}>
              {list.map(m => (
                <button key={m.id} type="button" className="m-row" onClick={() => choose(m)}>
                  <MaterialPhoto url={m.imageUrl} alt={m.name} className="m-thumb" />
                  <span className="m-row-main">
                    <span className="m-row-title" style={{ display: 'block' }}>{m.name}</span>
                    <span className="m-row-sub">{materialGroup(shelfIdOf(m)).label} · {m.unit}</span>
                  </span>
                  <ChevronRight size={18} className="is-muted" />
                </button>
              ))}
              {steelMatches && (
                <button type="button" className="m-row" onClick={onOpenSteelPurchase}>
                  <MaterialPhoto url={materialGroupImage('rod')} alt="Steel rods" className="m-thumb" />
                  <span className="m-row-main">
                    <span className="m-row-title" style={{ display: 'block' }}>Steel Rods (TMT)</span>
                    <span className="m-row-sub">Recorded by diameter and weight</span>
                  </span>
                  <ChevronRight size={18} className="is-muted" />
                </button>
              )}
              {list.length === 0 && !steelMatches && <div className="m-row is-muted">{q ? 'Nothing in the catalog matches.' : 'Nothing on this shelf yet.'}</div>}
            </div>
          )}

          {((q && !exact) || (!q && shelf)) && (
            <div className="m-card m-card-pad" style={{ marginTop: 10 }}>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>{q ? `Add "${search.trim()}" as a new material` : 'Not in the list?'}</div>
              {q ? (
                <>
                  <Field label="Category">
                    <select value={customShelf} onChange={e => setCustomShelf(e.target.value)}>
                      {MATERIAL_GROUPS.filter(g => g.id !== 'rod' && g.id !== 'cement').map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
                    </select>
                  </Field>
                  <button
                    type="button"
                    className="m-btn is-primary is-block"
                    onClick={() => {
                      const g = materialGroup(customShelf);
                      setChosen({ name: search.trim(), category: g.category, unit: 'Nos', newInShelf: g.id });
                    }}
                  >
                    Use this name
                  </button>
                </>
              ) : (
                <p className="m-calc-note" style={{ marginTop: 0 }}>Type its name in the search box above to add it.</p>
              )}
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
                  <MaterialPhoto url={stockPhoto(s, shelfOf.get(s.key) || 'other', catalog)} alt={s.name} className="m-thumb" />
                  <span className="m-row-main">
                    <span className="m-row-title" style={{ display: 'block' }}>{s.name}</span>
                    <span className="m-row-sub">{materialGroup(shelfOf.get(s.key) || 'other').label}</span>
                  </span>
                  <span className="m-row-end"><span className={`m-qty ${s.onHand <= 0 ? 'is-muted' : ''}`}>{formatQty(s.onHand)}<small>{s.unit}</small></span></span>
                </button>
              ))}
              {options.length === 0 && <div className="m-row is-muted">No material matches your search.</div>}
            </div>
          </>
        )}
      </Sheet>
    );
  }

  // ---- Step 2: details --------------------------------------------------
  // The item this entry will land on: the one picked, or the one a purchase of this name and unit joins.
  const current = existing || stock.find(s => s.key === stockItemKey({ category: chosen.category, name: finalName, unit }));
  const recent = current ? [...current.lines].filter(l => !l.voided).reverse().slice(0, 3) : [];
  const previous = current ? lastPurchase.get(current.key) : undefined;

  const submit = async (allowDuplicate = false) => {
    if (saving.current) return;
    setError('');
    if (Number.isNaN(qty) || qty <= 0) return setError('Enter a quantity greater than zero.');
    if (chosen.isCement && !brand.trim()) return setError('Choose the cement brand.');
    if (mode === 'purchase' && Number.isNaN(price)) return setError('Enter the unit price. Use 0 only if the material was free.');
    if (mode === 'purchase' && payment === 'part' && (Number.isNaN(paidNow) || paidNow <= 0 || paidNow > total)) {
      return setError(`Enter the amount paid, between ₹1 and ${formatINR(total)}.`);
    }
    const type: StockMovementType = mode === 'adjust' ? direction : mode === 'opening' ? 'opening' : mode === 'return' ? 'return' : 'usage';
    if (mode === 'adjust' && !reason.trim()) return setError('Say why the stock is being adjusted.');

    saving.current = true;
    setBusy(true);
    try {
      const res = mode === 'purchase'
        ? await recordPurchase(user, siteId, {
            category: chosen.category as MaterialCategory,
            materialName: finalName,
            brand: chosen.isCement ? brand.trim() : previous?.brand,
            materialType: chosen.isCement ? cementType?.materialType : previous?.materialType,
            grade: chosen.isCement ? cementType?.grade : previous?.grade,
            catalogItemId: chosen.catalogItemId || previous?.catalogItemId,
            supplier, quantity: qty, unit, rate: price, paidAmount: paidNow, paymentMode,
            purchaseDate: date, invoiceNumber: invoice, notes, allowDuplicate,
          })
        : await recordStockMovement(user, siteId, {
            itemKey: chosen.key, itemName: finalName, category: chosen.category, unit: existing?.unit || unit,
            movementType: type, quantity: qty, eventDate: date, reason, notes, allowDuplicate,
          });
      if (!res.ok) {
        if (res.duplicateOf) setDuplicate(true);
        else setError(res.error);
        return;
      }
      if (chosen.newInShelf) {
        // Keep the new material for next time. A name that is already there is fine.
        await saveCatalogItem(user, { kind: 'material', name: chosen.name, category: chosen.category, group: chosen.newInShelf, unit });
      }
      onSaved(mode === 'purchase'
        ? `Purchase recorded: ${formatQty(qty)} ${unit} ${finalName}`
        : `${STOCK_MOVEMENT_LABEL[type]}: ${formatQty(qty)} ${existing?.unit || unit} ${finalName}`);
      onClose();
    } catch {
      setError('Could not save. Nothing was changed. Please try again.');
    } finally {
      saving.current = false;
      setBusy(false);
    }
  };

  const addBrand = async () => {
    const res = await saveCatalogItem(user, { kind: 'brand', name: newBrand, category: 'cement' });
    if (!res.ok) return onNotify(res.error, 'error');
    setBrand(res.value.name);
    setNewBrand('');
    setAddingBrand(false);
  };

  return (
    <>
      <Sheet
        open={!duplicate}
        title={ENTRY_TITLE[mode]}
        subtitle={chosen.isCement ? 'Cement' : chosen.name}
        onClose={onClose}
        footer={
          <>
            <button type="button" className="m-btn" onClick={onClose} disabled={busy}>Cancel</button>
            <button type="button" className="m-btn is-primary" onClick={() => submit()} disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
          </>
        }
      >
        {error && <div style={{ marginBottom: 12 }}><Note tone="bad" role="alert">{error}</Note></div>}

        {chosen.isCement && (
          <>
            <Field label="Brand" hint="Availability differs by dealer and area.">
              <select value={brand} onChange={e => setBrand(e.target.value)} aria-label="Cement brand">
                {!brand && <option value="">Choose a brand</option>}
                {brands.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
              </select>
            </Field>
            {addingBrand ? (
              <div className="m-card m-card-pad" style={{ marginBottom: 14, background: 'var(--m-surface-2)' }}>
                <Field label="New brand name">
                  <input type="text" value={newBrand} onChange={e => setNewBrand(e.target.value)} maxLength={60} placeholder="Brand name" />
                </Field>
                <div className="m-btn-row">
                  <button type="button" className="m-btn is-small" onClick={() => { setAddingBrand(false); setNewBrand(''); }}>Cancel</button>
                  <button type="button" className="m-btn is-primary is-small" onClick={addBrand} disabled={!newBrand.trim()}>Add brand</button>
                </div>
              </div>
            ) : (
              <button type="button" className="m-btn is-quiet is-small" style={{ margin: '-8px 0 10px', paddingLeft: 0 }} onClick={() => setAddingBrand(true)}>
                <Plus size={18} /> Add another brand
              </button>
            )}
            <Field label="Cement type" hint={cementType ? [cementType.description, cementType.standard && `(${cementType.standard})`].filter(Boolean).join(' ') : undefined}>
              <Chips label="Cement type" value={cementType?.id || ''} onChange={setCementTypeId} options={cementTypes.map(c => ({ value: c.id, label: c.name }))} />
            </Field>
          </>
        )}

        <div className="m-card m-card-pad" style={{ marginBottom: 14, background: 'var(--m-surface-2)' }}>
          <div className="m-stat-label">IN STOCK NOW</div>
          {current ? (
            <>
              <div className={`m-qty ${current.onHand < 0 ? 'is-bad' : ''}`} style={{ fontSize: '1.35rem' }}>
                {formatQty(current.onHand)}<small>{current.unit}</small>
              </div>
              {recent.map(l => (
                <div key={l.id} className="m-row-sub" style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 4 }}>
                  <span>{STOCK_MOVEMENT_LABEL[l.type]} · {formatDay(l.date)}</span>
                  <strong className={isOut(l.type) ? 'is-bad' : 'is-ok'}>{isOut(l.type) ? '−' : '+'}{formatQty(l.quantity)}</strong>
                </div>
              ))}
            </>
          ) : (
            <div className="m-row-sub" style={{ marginTop: 2 }}>
              {chosen.isCement && !brand ? 'Choose the brand to see its stock.' : `None yet${finalName ? ` of ${finalName}` : ''}. This will be the first entry.`}
            </div>
          )}
        </div>

        <div className="m-field-2">
          <Field label="Quantity">
            <input type="text" inputMode="decimal" autoComplete="off" value={quantity} onChange={e => setQuantity(e.target.value)} placeholder="0" aria-label="Quantity" />
          </Field>
          <Field label="Unit">
            {existing ? (
              <input type="text" value={existing.unit} readOnly aria-label="Unit" />
            ) : (
              <select value={unit} onChange={e => setUnit(e.target.value)} aria-label="Unit">
                {availableEntryUnits.includes(unit) ? null : <option value={unit}>{unit}</option>}
                {availableEntryUnits.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            )}
          </Field>
        </div>

        {mode === 'purchase' && (
          <>
            <Field label={`Unit price (₹ per ${perUnit(unit)})`}>
              <input type="text" inputMode="decimal" autoComplete="off" value={rate} onChange={e => setRate(e.target.value)} placeholder="0" aria-label="Unit price in rupees" />
            </Field>
            {previous && !rate && (
              <button
                type="button"
                className="m-btn is-quiet is-small"
                style={{ margin: '-8px 0 10px', paddingLeft: 0, whiteSpace: 'normal', textAlign: 'left' }}
                onClick={() => { setRate(String(previous.rate)); if (!supplier && previous.supplier) setSupplier(previous.supplier); }}
              >
                Last time: {formatINR(previous.rate)} per {perUnit(unit)}{previous.supplier ? ` from ${previous.supplier}` : ''} on {formatDay(previous.purchaseDate)}. Use it
              </button>
            )}
            <div className="m-card m-card-pad" style={{ marginBottom: 14, background: 'var(--m-surface-2)' }}>
              <CalcLine label={`${quantity || 0} × ${formatINR(Number.isNaN(price) ? 0 : price)}`} value={formatINR(total)} />
            </div>
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

        {mode === 'purchase' && (
          <>
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
          </>
        )}

        {mode !== 'purchase' && (
          <Field label={mode === 'usage' ? 'Used for (optional)' : mode === 'adjust' ? 'Reason' : 'Reason (optional)'}>
            <input
              type="text"
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder={mode === 'usage' ? 'Roof slab, plastering' : mode === 'adjust' ? 'Bags damaged / rain' : ''}
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

      <ConfirmSheet
        open={duplicate}
        title="Already recorded today?"
        message={
          <>
            An entry with the same material, quantity{mode === 'purchase' ? ', price and supplier' : ''} is already saved for {formatDay(date)}.
            Save this one as well only if it is a separate {mode === 'purchase' ? 'delivery' : 'entry'}.
          </>
        }
        confirmLabel="Save again"
        busy={busy}
        onConfirm={async () => { await submit(true); setDuplicate(false); }}
        onCancel={() => setDuplicate(false)}
      />
    </>
  );
};

/* ------------------------------------------------------------------ Item history */

const ItemSheet: React.FC<{
  item: StockItem;
  shelfLabel: string;
  user: User;
  siteId: string;
  onClose: () => void;
  onEntry: (mode: EntryMode) => void;
  onOpenLedger: () => void;
  onNotify: (msg: string, type?: 'success' | 'error' | 'info') => void;
}> = ({ item, shelfLabel, user, siteId, onClose, onEntry, onOpenLedger, onNotify }) => {
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
      <Sheet open={!line} title={item.name} subtitle={shelfLabel} onClose={onClose}>
        <div className="m-stat-label">IN STOCK</div>
        <div className={`m-stat-value ${item.onHand < 0 ? 'is-bad' : ''}`} style={{ fontSize: '1.9rem' }}>
          {formatQty(item.onHand)} <span style={{ fontSize: '1rem', fontWeight: 600 }} className="is-muted">{item.unit}</span>
        </div>

        <div className="m-btn-row" style={{ marginTop: 12 }}>
          <button type="button" className="m-btn is-small" onClick={() => onEntry('purchase')}>Buy</button>
          <button type="button" className="m-btn is-primary is-small" onClick={() => onEntry('usage')} disabled={item.onHand <= 0}>Use</button>
          <button type="button" className="m-btn is-small" onClick={() => onEntry('return')} disabled={item.onHand <= 0}>Return</button>
          <button type="button" className="m-btn is-small" onClick={() => onEntry('adjust')}>Adjust</button>
        </div>

        <div className="m-calc" style={{ marginTop: 12 }}>
          <CalcLine label="Purchased" value={`+ ${formatQty(item.purchased)}`} />
          {item.opening > 0 && <CalcLine label="Already on site" value={`+ ${formatQty(item.opening)}`} />}
          <CalcLine label="Used on site" value={`− ${formatQty(item.used)}`} />
          {item.returned > 0 && <CalcLine label="Returned to supplier" value={`− ${formatQty(item.returned)}`} />}
          {item.adjusted !== 0 && <CalcLine label="Adjustments" value={`${item.adjusted > 0 ? '+' : '−'} ${formatQty(Math.abs(item.adjusted))}`} />}
          <CalcLine total label="In stock" value={`${formatQty(item.onHand)} ${item.unit}`} tone={item.onHand < 0 ? 'bad' : undefined} />
        </div>
        {item.purchaseCost > 0 && <p className="m-calc-note">Total purchase cost: {formatINR(item.purchaseCost)}.</p>}

        <Section title={`History (${history.length})`}>
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
                    {isOut(l.type) ? '−' : '+'}{formatQty(l.quantity)}
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
          <input type="text" value={voidReason} onChange={e => setVoidReason(e.target.value)} placeholder="Reason for cancellation" maxLength={120} />
        </Field>
      </Sheet>
    </>
  );
};

/* ------------------------------------------------------------------ Catalog */

type CatalogTab = 'brand' | 'cement_type' | 'material';

const CatalogSheet: React.FC<{
  open: boolean;
  user: User;
  catalog: CatalogItem[];
  onClose: () => void;
  onNotify: (msg: string, type?: 'success' | 'error' | 'info') => void;
}> = ({ open, user, catalog, onClose, onNotify }) => {
  const [tab, setTab] = useState<CatalogTab>('brand');
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [shelf, setShelf] = useState('sand');
  const [unit, setUnit] = useState('CFT');
  const [lowStockThreshold, setLowStockThreshold] = useState('');
  const [editing, setEditing] = useState<CatalogItem | null>(null);
  const [removing, setRemoving] = useState<CatalogItem | null>(null);
  const [credits, setCredits] = useState(false);
  const [busy, setBusy] = useState(false);
  const catalogCategory = editing?.category || materialGroup(shelf).category;
  const availableUnits = materialUnitsForCategory(catalogCategory);
  const unitOptions = editing?.unit && !availableUnits.includes(editing.unit)
    ? [editing.unit, ...availableUnits]
    : availableUnits;

  const rows = catalog
    .filter(c => (tab === 'material' ? c.kind === 'material' : c.kind === tab && c.category === 'cement'))
    .sort((a, b) => a.name.localeCompare(b.name));
  const shelfLabel = (c: CatalogItem) => materialGroup(c.category === 'other' ? c.group || 'other' : c.category).label;

  const reset = () => { setName(''); setNote(''); setEditing(null); setUnit('CFT'); setShelf('sand'); setLowStockThreshold(''); };

  const save = async () => {
    if (busy) return;
    setBusy(true);
    const group = materialGroup(shelf);
    const res = await saveCatalogItem(user, {
      id: editing?.id,
      kind: tab,
      name,
      category: tab !== 'material' ? 'cement' : editing ? editing.category : group.category,
      group: tab === 'material' && !editing && group.category === 'other' ? group.id : undefined,
      unit: tab === 'material' ? unit : undefined,
      lowStockThreshold: tab === 'material'
        ? (lowStockThreshold.trim() ? Number(lowStockThreshold) : null)
        : undefined,
      lowStockThresholdUnit: tab === 'material' ? unit : undefined,
      description: tab === 'cement_type' && !editing ? note.trim() || undefined : undefined,
    });
    setBusy(false);
    if (res.ok) {
      onNotify(editing ? 'Catalog entry updated' : `"${res.value.name}" added to the catalog`, 'success');
      reset();
    } else onNotify(res.error, 'error');
  };

  const addTitle = editing ? `Rename "${editing.name}"` : tab === 'brand' ? 'Add a cement brand' : tab === 'cement_type' ? 'Add a cement type' : 'Add a material';

  return (
    <>
      <Sheet open={open && !removing} title="Material catalog" subtitle="Used when recording purchases" onClose={() => { reset(); onClose(); }}>
        <Chips
          label="Catalog section"
          value={tab}
          onChange={v => { setTab(v); reset(); }}
          options={[{ value: 'brand', label: 'Cement brands' }, { value: 'cement_type', label: 'Cement types' }, { value: 'material', label: 'Materials' }]}
        />

        {tab === 'brand' && (
          <p className="m-calc-note">
            A starting list for Tamil Nadu and South India. It is not a statement that every brand is sold in your area. Add, rename or remove brands to match your dealers.
          </p>
        )}
        {tab === 'cement_type' && (
          <p className="m-calc-note">
            Type is the composition (OPC, PPC, PSC). Grade (43, 53) is strength and applies to OPC only. Brand is the maker and is chosen separately. Add any other type your dealer sells.
          </p>
        )}

        <div className="m-card m-card-pad" style={{ marginTop: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>{addTitle}</div>
          <Field label="Name">
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              maxLength={60}
              placeholder={tab === 'brand' ? 'Brand name' : tab === 'cement_type' ? 'PCC (Composite)' : 'Material name'}
            />
          </Field>
          {tab === 'cement_type' && !editing && (
            <Field label="Note (optional)">
              <input type="text" value={note} onChange={e => setNote(e.target.value)} maxLength={120} placeholder="Usage note" />
            </Field>
          )}
          {tab === 'material' && (
            <div className="m-field-2">
              {!editing && (
                <Field label="Category">
                  <select value={shelf} onChange={e => {
                    const nextShelf = e.target.value;
                    const nextUnits = materialUnitsForCategory(materialGroup(nextShelf).category);
                    setShelf(nextShelf);
                    setUnit(current => nextUnits.includes(current) ? current : nextUnits[0]);
                  }}>
                    {MATERIAL_MAIN_GROUPS.filter(g => g.id !== 'rod').map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
                  </select>
                </Field>
              )}
              <Field label="Usual unit">
                <select value={unit} onChange={e => setUnit(e.target.value)}>
                  {unitOptions.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </Field>
              <Field label={`Low-stock warning (${unit})`}>
                <input
                  type="number"
                  min="0"
                  step="any"
                  inputMode="decimal"
                  value={lowStockThreshold}
                  onChange={e => setLowStockThreshold(e.target.value)}
                  placeholder="Optional"
                />
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
              {tab === 'material' && <MaterialPhoto url={c.imageUrl} alt={c.name} className="m-thumb" />}
              <span className="m-row-main">
                <span className="m-row-title" style={{ display: 'block' }}>
                  {c.name} {tab === 'cement_type' && c.standard && <Badge>{c.standard}</Badge>}
                </span>
                <span className="m-row-sub" style={{ whiteSpace: 'normal' }}>
                  {tab === 'material'
                    ? `${shelfLabel(c)} · ${c.unit || ''}${typeof c.lowStockThreshold === 'number' ? ` · Warn at ${c.lowStockThreshold} ${c.lowStockThresholdUnit || c.unit}` : ''}`
                    : c.description || (tab === 'brand' ? 'Cement brand' : 'Cement type')}
                  {c.isBuiltIn ? '' : ' · added by you'}
                </span>
              </span>
              <button
                type="button"
                className="m-btn is-small"
                onClick={() => {
                  setEditing(c);
                  setName(c.name);
                  setUnit(c.unit || 'Nos');
                  setLowStockThreshold(typeof c.lowStockThreshold === 'number' ? String(c.lowStockThreshold) : '');
                }}
              >
                {tab === 'material' ? 'Edit' : 'Rename'}
              </button>
              <button type="button" className="m-icon-btn" onClick={() => setRemoving(c)} aria-label={`Remove ${c.name}`}><Trash2 size={18} /></button>
            </div>
          ))}
          {rows.length === 0 && <div className="m-row is-muted">Nothing here yet.</div>}
        </div>

        {tab === 'material' && (
          <div style={{ marginTop: 12 }}>
            <button type="button" className="m-btn is-quiet is-small" style={{ paddingLeft: 0 }} onClick={() => setCredits(v => !v)} aria-expanded={credits}>
              {credits ? 'Hide photo credits' : 'Photo credits'}
            </button>
            {credits && (
              <div className="m-calc-note" style={{ marginTop: 0 }}>
                Photographs are from Wikimedia Commons and show the kind of material, not a brand or product on sale.
                <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                  {Object.entries(MATERIAL_IMAGES).map(([key, img]) => (
                    <li key={key}>
                      <a href={img.source} target="_blank" rel="noopener noreferrer">
                        {MATERIAL_GROUPS.find(g => g.image === key)?.label || catalog.find(c => c.imageUrl === img.file)?.name || key}
                      </a>: {img.author}, {img.license}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Sheet>

      <ConfirmSheet
        open={!!removing}
        title={`Remove "${removing?.name}"?`}
        message="It will no longer be offered when recording purchases. Records already saved keep their name."
        confirmLabel="Remove"
        danger
        onConfirm={async () => {
          if (removing) {
            const result = await removeCatalogItem(user, removing.id);
            onNotify(result.ok ? `"${removing.name}" removed from the catalog` : result.error, result.ok ? 'info' : 'error');
          }
          setRemoving(null);
        }}
        onCancel={() => setRemoving(null)}
      />
    </>
  );
};
