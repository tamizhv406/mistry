import React, { useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { AlertCircle, ChevronDown, Package, X } from 'lucide-react';
import type { CatalogItem, Material, MaterialCategory, RodEntry, Site } from '../db/types';
import { db } from '../db/db';
import { getCurrentUser } from '../services/auth';
import { newId, recordPurchase } from '../services/records';
import { recordPaymentTransaction, calculateFinancialBalance } from '../utils/financial';
import { todayKey } from '../utils/datetime';
import { formatINR, parseAmount, roundMoney } from '../utils/money';
import { CEMENT_TYPES, cementItemName, materialUnitsForCategory } from '../domain/catalog';
import { compatibleUnits, latestPurchaseByItem, rodItemName, stockItemKey, type StockItem } from '../domain/stock';
import { useLanguage } from '../services/i18n';
import '../styles/materials-mobile.css';

/**
 * Record a purchase. The first screen has only what every delivery needs: the item, how much,
 * the price and the supplier. Price and supplier start from the last purchase of the same item,
 * so a repeat delivery is: open, type the quantity, Save. Date, payment, bill number and notes
 * are under "More details".
 */
export interface RecordPurchaseModalProps {
  isOpen: boolean;
  siteId: string;
  sites: Site[];
  /** The project is fixed (a single project is open); otherwise it can be chosen. */
  lockSite?: boolean;
  /** Buying more of an item already in stock: the item is chosen already. */
  preset?: Pick<StockItem, 'key' | 'name' | 'category' | 'unit'> | null;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

const CATEGORIES: { id: MaterialCategory; label: string }[] = [
  { id: 'cement', label: 'Cement' },
  { id: 'sand', label: 'Sand' },
  { id: 'msand', label: 'M-Sand' },
  { id: 'bricks', label: 'Bricks & blocks' },
  { id: 'rod', label: 'Steel rods' },
  { id: 'aggregate', label: 'Aggregate (jelly)' },
  { id: 'other', label: 'Other' },
];

const STEEL_DIAMETERS = ['6 mm', '8 mm', '10 mm', '12 mm', '16 mm', '20 mm', '25 mm', '32 mm'];
const PAYMENT_MODES = ['Cash', 'UPI', 'Bank Transfer', 'Cheque'];

/** The form is mounted only while open, so every opening starts from a clean form. */
export const RecordPurchaseModal: React.FC<RecordPurchaseModalProps> = props =>
  props.isOpen ? <PurchaseForm key={`${props.siteId}-${props.preset?.key || ''}`} {...props} /> : null;

const PurchaseForm: React.FC<RecordPurchaseModalProps> = ({
  siteId, sites, lockSite, preset, onClose, onSuccess,
}) => {
  const { t } = useLanguage();
  const [targetSiteId, setTargetSiteId] = useState(siteId);
  const [category, setCategory] = useState<MaterialCategory>((preset?.category as MaterialCategory) || 'cement');
  const [name, setName] = useState(preset && preset.category !== 'cement' && preset.category !== 'rod' ? preset.name : '');
  const [brand, setBrand] = useState('');
  const [cementTypeId, setCementTypeId] = useState('');
  const [diameter, setDiameter] = useState('12 mm');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState(preset?.category === 'rod' ? 'kg' : preset ? preset.unit : 'Bags');
  const [rate, setRate] = useState('');
  const [supplier, setSupplier] = useState('');
  const [showMore, setShowMore] = useState(false);
  const [purchaseDate, setPurchaseDate] = useState(todayKey());
  const [paid, setPaid] = useState('');
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [duplicate, setDuplicate] = useState(false);
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const [prefilledFor, setPrefilledFor] = useState('');

  const catalogRows = useLiveQuery(
    () => db.catalogItems.filter(c => !c.isDeleted && !c.stockOnly && c.kind !== 'tool').toArray(),
    []
  );
  const materialRows = useLiveQuery(
    () => (targetSiteId ? db.materials.where('siteId').equals(targetSiteId).filter(m => !m.isDeleted).toArray() : Promise.resolve([] as Material[])),
    [targetSiteId]
  );
  const rodRows = useLiveQuery(
    () => (targetSiteId ? db.rodEntries.where('siteId').equals(targetSiteId).filter(r => !r.isDeleted).toArray() : Promise.resolve([] as RodEntry[])),
    [targetSiteId]
  );
  const catalog = useMemo(() => catalogRows || [], [catalogRows]);
  const siteMaterials = useMemo(() => materialRows || [], [materialRows]);
  const siteRods = useMemo(() => rodRows || [], [rodRows]);

  const brands = catalog.filter(c => c.kind === 'brand' && c.category === 'cement').sort((a, b) => a.name.localeCompare(b.name));
  const savedTypes = catalog.filter(c => c.kind === 'cement_type');
  const cementTypes: Pick<CatalogItem, 'id' | 'name' | 'materialType' | 'grade'>[] = savedTypes.length
    ? savedTypes
    : CEMENT_TYPES.map(c => ({ id: c.id, name: c.label, materialType: c.type, grade: c.grade }));
  const cementType = cementTypes.find(c => c.id === cementTypeId) || cementTypes.find(c => c.materialType === 'PPC') || cementTypes[0];
  const namesInCategory = catalog.filter(c => c.kind === 'material' && c.category === category).map(c => c.name);
  const suppliers = useMemo(
    () => Array.from(new Set([...siteMaterials.map(m => m.supplier), ...siteRods.map(r => r.supplier)].map(s => (s || '').trim()).filter(Boolean))).slice(0, 40),
    [siteMaterials, siteRods]
  );

  const isCement = category === 'cement' && !(preset && preset.category === 'cement');
  const isSteel = category === 'rod';
  const finalName = preset && category === preset.category && !isSteel
    ? preset.name
    : isCement
    ? (brand ? cementItemName(brand, cementType?.name || '') : '')
    : isSteel
    ? rodItemName({ diameter, brand })
    : name.trim();
  const itemKey = isSteel
    ? stockItemKey({ category: 'rod', name: preset?.category === 'rod' ? preset.name : finalName, unit: 'kg' })
    : finalName ? stockItemKey({ category, name: finalName, unit }) : '';

  // The last purchase of this item on this project (a handful of rows; no need to memoise).
  const lastMaterial = itemKey && !isSteel ? latestPurchaseByItem(siteMaterials).get(itemKey) : undefined;
  const rodTarget = preset?.category === 'rod' ? preset.name : finalName;
  const lastRod = isSteel
    ? [...siteRods]
        .filter(r => rodItemName(r) === rodTarget)
        .sort((a, b) => (a.purchaseDate || '').localeCompare(b.purchaseDate || '') || (a.createdAt || '').localeCompare(b.createdAt || ''))
        .pop()
    : undefined;

  // Price and supplier start from the last purchase of this item (once per item, never over typing).
  const last = lastMaterial || lastRod;
  if (itemKey && last && prefilledFor !== itemKey) {
    setPrefilledFor(itemKey);
    if (lastMaterial) {
      setUnit(lastMaterial.unit);
      if (!rate) setRate(String(lastMaterial.rate));
      if (preset?.category === 'cement' && lastMaterial.brand) setBrand(lastMaterial.brand);
    } else if (lastRod) {
      if (!rate) setRate(String(lastRod.ratePerKg));
      setDiameter(lastRod.diameter);
      setBrand(lastRod.brand || '');
    }
    if (!supplier && last.supplier) setSupplier(last.supplier);
  }

  const unitOptions = useMemo(() => {
    if (isSteel) return ['kg', 'Tonne'];
    const offered = [...materialUnitsForCategory(category)];
    if (preset && preset.category === category) {
      return compatibleUnits(category, preset.unit, [...offered, preset.unit, lastMaterial?.unit || ''].filter(Boolean));
    }
    return offered.includes(unit) ? offered : [unit, ...offered];
  }, [isSteel, category, preset, unit, lastMaterial]);

  const qty = parseAmount(quantity);
  const price = parseAmount(rate);
  const total = !Number.isNaN(qty) && !Number.isNaN(price) ? roundMoney(qty * price) : 0;

  const pickCategory = (id: MaterialCategory) => {
    setCategory(id);
    setName('');
    setRate('');
    setSupplier('');
    setPrefilledFor('');
    setUnit(id === 'rod' ? 'kg' : materialUnitsForCategory(id)[0] || 'Nos');
    if (id === 'cement' && !brand) setBrand(brands[0]?.name || '');
  };

  const keepFocusedFieldVisible = (e: React.FocusEvent<HTMLElement>) => {
    const el = e.target;
    if (!(el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement)) return;
    // The phone keyboard covers the lower half: bring the field above it once it is up.
    window.setTimeout(() => el.scrollIntoView({ block: 'center', behavior: 'smooth' }), 300);
  };

  const submit = async (allowDuplicate = false) => {
    if (saving.current) return;
    const user = getCurrentUser();
    setError('');
    if (!user) return setError('Sign in to record a purchase.');
    if (!targetSiteId) return setError('Choose the project.');
    if (!finalName) return setError(isCement ? 'Choose the cement brand.' : 'Enter the material name.');
    if (Number.isNaN(qty) || qty <= 0) return setError('Enter a quantity greater than zero.');
    if (Number.isNaN(price) || price < 0) return setError('Enter the price per unit. Use 0 only if it was free.');
    const paidNum = paid.trim() ? parseAmount(paid) : 0;
    if (Number.isNaN(paidNum) || paidNum < 0) return setError('Enter a valid paid amount.');
    if (purchaseDate > todayKey()) return setError('The date cannot be in the future.');

    saving.current = true;
    setBusy(true);
    try {
      if (isSteel) {
        const tonnes = unit.toLowerCase() === 'tonne';
        const fin = calculateFinancialBalance(total, paidNum);
        const now = new Date().toISOString();
        const id = newId('rod');
        const rod: RodEntry = {
          id, siteId: targetSiteId, diameter, brand: brand.trim() || undefined, quantityPieces: 0, unit,
          weightKg: tonnes ? qty * 1000 : qty,
          ratePerKg: tonnes ? price / 1000 : price,
          totalAmount: total, paidAmount: fin.paidAmount, balance: fin.balanceDue, extraPaid: fin.extraPaid,
          supplier: supplier.trim(), purchaseDate,
          invoiceNumber: invoiceNumber.trim() || undefined, notes: notes.trim() || undefined,
          isDeleted: false, createdAt: now, updatedAt: now,
        };
        await db.rodEntries.put(rod);
        if (fin.paidAmount > 0) {
          await recordPaymentTransaction({
            siteId: targetSiteId, relatedRecordId: id, tableName: 'rodEntries', amount: fin.paidAmount,
            paymentType: paymentMode, date: purchaseDate, module: 'Rod', userId: user.id,
            notes: invoiceNumber ? `Invoice ${invoiceNumber} payment` : `Payment for ${diameter} steel`,
          });
        }
        onSuccess(`Purchase recorded: ${qty} ${unit} ${finalName}`);
        onClose();
        return;
      }
      const res = await recordPurchase(user, targetSiteId, {
        category,
        materialName: finalName,
        brand: isCement ? brand : lastMaterial?.brand,
        materialType: isCement ? cementType?.materialType : lastMaterial?.materialType,
        grade: isCement ? cementType?.grade : lastMaterial?.grade,
        catalogItemId: isCement ? 'mat-cement' : lastMaterial?.catalogItemId,
        quantity: qty, unit, rate: price, paidAmount: paidNum, paymentMode,
        supplier: supplier.trim(), purchaseDate,
        invoiceNumber: invoiceNumber.trim(), notes: notes.trim(), allowDuplicate,
      });
      if (!res.ok) {
        if (res.duplicateOf) setDuplicate(true);
        else setError(res.error);
        return;
      }
      onSuccess(`Purchase recorded: ${qty} ${unit} ${finalName}`);
      onClose();
    } catch (err) {
      setError((err as Error)?.message || 'Could not save. Nothing was changed.');
    } finally {
      saving.current = false;
      setBusy(false);
    }
  };

  const perUnit = unit.replace(/s$/i, '');

  return (
    <div className="rpm-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="rpm-dialog" role="dialog" aria-modal="true" aria-labelledby="rpm-title">
        <div className="rpm-head">
          <span className="rpm-head-icon" aria-hidden="true"><Package size={20} /></span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h2 id="rpm-title">Record purchase</h2>
            {preset && <p className="rpm-sub">{preset.name}</p>}
          </div>
          <button type="button" className="rpm-icon-btn" onClick={onClose} aria-label="Close"><X size={22} /></button>
        </div>

        <form
          className="rpm-body"
          onFocus={keepFocusedFieldVisible}
          onSubmit={e => { e.preventDefault(); submit(); }}
          id="rpm-form"
        >
          {error && <div className="rpm-error" role="alert"><AlertCircle size={18} aria-hidden="true" /><span>{error}</span></div>}
          {duplicate && (
            <div className="rpm-error is-warn" role="alert">
              <AlertCircle size={18} aria-hidden="true" />
              <span>
                The same purchase (item, quantity, price, supplier) is already saved for this date. Save again only if it is a separate delivery.
                <button type="button" className="rpm-btn is-small" style={{ marginTop: 8 }} onClick={() => { setDuplicate(false); submit(true); }} disabled={busy}>Save again</button>
              </span>
            </div>
          )}

          {!lockSite && sites.length > 1 && (
            <label className="rpm-field">
              <span>Project</span>
              <select value={targetSiteId} onChange={e => setTargetSiteId(e.target.value)}>
                {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
          )}

          {/* 1. Item */}
          {preset ? (
            <div className="rpm-item">
              <span className="rpm-label">Item</span>
              <strong>{preset.name}</strong>
            </div>
          ) : (
            <>
              <label className="rpm-field">
                <span>Item</span>
                <select value={category} onChange={e => pickCategory(e.target.value as MaterialCategory)} aria-label="Material category">
                  {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </label>
              {isCement && (
                <div className="rpm-row2">
                  <label className="rpm-field">
                    <span>Brand</span>
                    <select value={brand} onChange={e => { setBrand(e.target.value); setPrefilledFor(''); }}>
                      {!brand && <option value="">Choose</option>}
                      {brands.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
                    </select>
                  </label>
                  <label className="rpm-field">
                    <span>Type</span>
                    <select value={cementType?.id || ''} onChange={e => { setCementTypeId(e.target.value); setPrefilledFor(''); }}>
                      {cementTypes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </label>
                </div>
              )}
              {isSteel && (
                <div className="rpm-row2">
                  <label className="rpm-field">
                    <span>Diameter</span>
                    <select value={diameter} onChange={e => { setDiameter(e.target.value); setPrefilledFor(''); }}>
                      {STEEL_DIAMETERS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </label>
                  <label className="rpm-field">
                    <span>Brand (optional)</span>
                    <input type="text" value={brand} maxLength={60} onChange={e => { setBrand(e.target.value); setPrefilledFor(''); }} placeholder="Tata Tiscon" />
                  </label>
                </div>
              )}
              {!isCement && !isSteel && (
                <label className="rpm-field">
                  <span>Material name</span>
                  <input type="text" list="rpm-names" value={name} maxLength={80} onChange={e => { setName(e.target.value); setPrefilledFor(''); }} placeholder="River Sand, Red Clay Bricks…" />
                  <datalist id="rpm-names">{namesInCategory.map(n => <option key={n} value={n} />)}</datalist>
                </label>
              )}
            </>
          )}

          {/* 2. Quantity */}
          <div className="rpm-row2">
            <label className="rpm-field">
              <span>Quantity</span>
              <input type="text" inputMode="decimal" autoComplete="off" value={quantity} onChange={e => setQuantity(e.target.value)} placeholder="0" autoFocus={!!preset} />
            </label>
            <label className="rpm-field">
              <span>Unit</span>
              <select value={unit} onChange={e => setUnit(e.target.value)}>
                {unitOptions.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </label>
          </div>

          {/* 3. Rate */}
          <label className="rpm-field">
            <span>Rate (₹ per {perUnit})</span>
            <input type="text" inputMode="decimal" autoComplete="off" value={rate} onChange={e => setRate(e.target.value)} placeholder="0" />
            {(lastMaterial || lastRod) && <small className="rpm-hint">Filled from the last purchase. Change it if the price is different.</small>}
          </label>

          {/* 4. Supplier */}
          <label className="rpm-field">
            <span>Supplier</span>
            <input type="text" list="rpm-suppliers" value={supplier} maxLength={80} onChange={e => setSupplier(e.target.value)} placeholder="Shop or dealer name" />
            <datalist id="rpm-suppliers">{suppliers.map(s => <option key={s} value={s} />)}</datalist>
          </label>

          <div className="rpm-total"><span>Total</span><strong>{formatINR(total)}</strong></div>

          <button type="button" className="rpm-more-toggle" aria-expanded={showMore} onClick={() => setShowMore(v => !v)}>
            <span>{t('stk_more', 'More details')}</span>
            <ChevronDown size={18} aria-hidden="true" style={{ transform: showMore ? 'rotate(180deg)' : undefined }} />
          </button>
          {showMore && (
            <div className="rpm-more">
              <label className="rpm-field">
                <span>Purchase date</span>
                <input type="date" value={purchaseDate} max={todayKey()} onChange={e => setPurchaseDate(e.target.value)} />
              </label>
              <div className="rpm-row2">
                <label className="rpm-field">
                  <span>Paid now (₹)</span>
                  <input type="text" inputMode="decimal" autoComplete="off" value={paid} onChange={e => setPaid(e.target.value)} placeholder="0" />
                </label>
                <label className="rpm-field">
                  <span>Paid by</span>
                  <select value={paymentMode} onChange={e => setPaymentMode(e.target.value)}>
                    {PAYMENT_MODES.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </label>
              </div>
              <label className="rpm-field">
                <span>Bill / invoice no.</span>
                <input type="text" value={invoiceNumber} maxLength={40} onChange={e => setInvoiceNumber(e.target.value)} />
              </label>
              <label className="rpm-field">
                <span>Notes (vehicle no., transport, GST…)</span>
                <input type="text" value={notes} maxLength={160} onChange={e => setNotes(e.target.value)} />
              </label>
            </div>
          )}
        </form>

        <div className="rpm-foot">
          <button type="button" className="rpm-btn" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" form="rpm-form" className="rpm-btn is-primary" disabled={busy}>{busy ? 'Saving…' : 'Save purchase'}</button>
        </div>
      </div>
    </div>
  );
};
