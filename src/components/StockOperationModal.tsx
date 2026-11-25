import React, { useState } from 'react';
import {
  X,
  ArrowDownCircle,
  ArrowUpCircle,
  Save,
  AlertCircle,
  ArrowRightLeft,
} from 'lucide-react';
import type { Site, StockMovementType } from '../db/types';
import { todayKey } from '../utils/datetime';
import { getCurrentUser } from '../services/auth';
import { recordStockMovement, voidStockMovement } from '../services/records';
import { compatibleUnits, convertStockQuantity, displayStock, formatStock, validateMovementOn, type StockItem } from '../domain/stock';
import { materialUnitsForCategory } from '../domain/catalog';

export interface StockOperationModalProps {
  isOpen: boolean;
  siteId: string;
  sites: Site[];
  stockItems: StockItem[];
  preselectedItem?: StockItem | null;
  initialMode?: 'usage' | 'opening' | 'return' | 'adjust_in' | 'adjust_out' | 'transfer';
  onClose: () => void;
  onSuccess: (message: string) => void;
}

/** The form is mounted only while open, so every opening starts from a clean form. */
export const StockOperationModal: React.FC<StockOperationModalProps> = props =>
  props.isOpen ? <StockOperationForm key={`${props.preselectedItem?.key || ''}-${props.initialMode || 'usage'}`} {...props} /> : null;

const StockOperationForm: React.FC<StockOperationModalProps> = ({
  siteId,
  sites,
  stockItems,
  preselectedItem,
  initialMode = 'usage',
  onClose,
  onSuccess,
}) => {
  const currentUser = getCurrentUser();

  const [mode, setMode] = useState<StockMovementType | 'transfer'>(initialMode);
  const [selectedItemKey, setSelectedItemKey] = useState<string>(() => preselectedItem?.key || (stockItems[0]?.key || ''));
  const [quantity, setQuantity] = useState<string>('');
  const [unit, setUnit] = useState<string>('');
  const [date, setDate] = useState<string>(todayKey());
  const [destinationSiteId, setDestinationSiteId] = useState<string>(() => sites.find(s => s.id !== siteId)?.id || '');
  const [reason, setReason] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const activeItem = stockItems.find(s => s.key === selectedItemKey) || stockItems[0];
  // Cement is kept in kg but counted in bags: offer every unit that lands on the same item.
  const unitChoices = activeItem ? compatibleUnits(activeItem.category, activeItem.unit, [...materialUnitsForCategory(activeItem.category), activeItem.unit]) : [];
  const entryUnit = unitChoices.includes(unit) ? unit : (unitChoices.find(u => /bag/i.test(u)) || activeItem?.unit || '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      setError('You must be signed in to perform inventory updates.');
      return;
    }
    if (!activeItem) {
      setError('Please choose a valid material from the inventory.');
      return;
    }

    const qNum = Number(quantity.replace(/,/g, '').trim());
    if (!Number.isFinite(qNum) || qNum <= 0) {
      setError('Enter a quantity greater than zero.');
      return;
    }

    // The same check the save makes, so the message is the same on every screen. It counts the
    // date too: stock that arrived after the chosen day can not be used on it.
    const outType: StockMovementType = mode === 'transfer' ? 'adjust_out' : mode;
    const check = validateMovementOn(activeItem, outType, convertStockQuantity(activeItem.category, entryUnit, qNum).quantity, date);
    if (!check.ok) {
      setError(check.error || 'Check the quantity.');
      return;
    }
    if ((mode === 'adjust_in' || mode === 'adjust_out') && !reason.trim()) {
      setError('Say why the stock is being adjusted.');
      return;
    }

    if (mode === 'transfer' && (!destinationSiteId || destinationSiteId === siteId)) {
      setError('Please select a different destination project for transfer.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      if (mode === 'transfer') {
        // Step 1: Outward movement from source site
        const outRes = await recordStockMovement(currentUser, siteId, {
          itemKey: activeItem.key,
          itemName: activeItem.name,
          category: activeItem.category,
          unit: entryUnit,
          movementType: 'adjust_out',
          quantity: qNum,
          eventDate: date,
          reason: `Transferred to ${sites.find(s => s.id === destinationSiteId)?.name || 'other site'}`,
          notes: notes.trim(),
        });

        if (!outRes.ok) {
          setError(outRes.error);
          setIsSubmitting(false);
          return;
        }

        // Step 2: Inward movement to destination site
        const inRes = await recordStockMovement(currentUser, destinationSiteId, {
          itemKey: activeItem.key,
          itemName: activeItem.name,
          category: activeItem.category,
          unit: entryUnit,
          movementType: 'adjust_in',
          quantity: qNum,
          eventDate: date,
          reason: `Transferred from ${sites.find(s => s.id === siteId)?.name || 'other site'}`,
          notes: notes.trim(),
          // The outgoing half already passed the repeat check; a matching entry at the
          // receiving site must not leave the stock taken out here and never added there.
          allowDuplicate: true,
        });

        if (!inRes.ok) {
          // Undo the outgoing half so the stock is not lost between sites.
          await voidStockMovement(currentUser, siteId, outRes.value.id, 'Transfer could not be completed');
          setError(`${inRes.error} Nothing was moved.`);
          setIsSubmitting(false);
          return;
        }

        onSuccess(`Transferred ${qNum} ${entryUnit} ${activeItem.name}.`);
        onClose();
      } else {
        const res = await recordStockMovement(currentUser, siteId, {
          itemKey: activeItem.key,
          itemName: activeItem.name,
          category: activeItem.category,
          unit: entryUnit,
          movementType: mode as StockMovementType,
          quantity: qNum,
          eventDate: date,
          reason: reason.trim(),
          notes: notes.trim(),
        });

        if (!res.ok) {
          setError(res.error);
          setIsSubmitting(false);
          return;
        }

        const actionText =
          mode === 'usage'
            ? 'Stock Out (Used on Site)'
            : mode === 'return'
            ? 'Returned to Supplier'
            : mode === 'adjust_in'
            ? 'Adjusted (+ Stock In)'
            : mode === 'adjust_out'
            ? 'Adjusted (− Stock Out)'
            : 'Recorded Opening Stock';

        onSuccess(`${actionText}: ${qNum} ${entryUnit} ${activeItem.name} logged.`);
        onClose();
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to record stock movement.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        overflowY: 'auto',
      }}
    >
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '580px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.25)',
          border: '1px solid #E2E8F0',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid #E2E8F0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#F8FAFC',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                backgroundColor:
                  mode === 'usage'
                    ? 'var(--color-danger-soft)'
                    : mode === 'transfer'
                    ? 'var(--color-warning-soft)'
                    : 'var(--color-primary-soft)',
                color:
                  mode === 'usage'
                    ? 'var(--color-danger)'
                    : mode === 'transfer'
                    ? 'var(--color-warning-text)'
                    : 'var(--color-primary-text)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {mode === 'usage' ? (
                <ArrowDownCircle size={22} />
              ) : mode === 'transfer' ? (
                <ArrowRightLeft size={22} />
              ) : (
                <ArrowUpCircle size={22} />
              )}
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: '#0F172A' }}>
                Inventory Movement
              </h2>
              <p style={{ margin: 0, fontSize: '0.875rem', color: '#64748B' }}>
                Record consumption, return, physical adjustment or site-to-site transfer
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              border: 'none',
              background: 'transparent',
              color: '#94A3B8',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '8px',
              minWidth: '44px',
              minHeight: '44px',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' }}>
          {error && (
            <div
              style={{
                padding: '12px 14px',
                borderRadius: '8px',
                backgroundColor: '#FEF2F2',
                border: '1px solid #FCA5A5',
                color: '#991B1B',
                fontSize: '0.875rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          {/* Operation Mode Selector */}
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: '8px' }}>
              Action Type
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '8px' }}>
              {[
                { id: 'usage', label: 'Stock Out (Used)' },
                { id: 'transfer', label: 'Transfer' },
                { id: 'return', label: 'Return' },
                { id: 'adjust_in', label: 'Adjust (+)' },
                { id: 'adjust_out', label: 'Adjust (−)' },
              ].map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setMode(opt.id as any)}
                  style={{
                    padding: '8px 6px',
                    minHeight: '44px',
                    borderRadius: '8px',
                    fontSize: '0.875rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    border: mode === opt.id ? '2px solid var(--color-primary)' : '1px solid var(--color-border-strong)',
                    backgroundColor: mode === opt.id ? 'var(--color-primary-soft)' : 'var(--color-surface)',
                    color: mode === opt.id ? 'var(--color-primary-text)' : 'var(--color-text-secondary)',
                    textAlign: 'center',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Select Material */}
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
              Material <span style={{ color: '#EF4444' }}>*</span>
            </label>
            <select
              value={selectedItemKey}
              onChange={e => setSelectedItemKey(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                  minHeight: '44px',
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                fontSize: '0.9rem',
                backgroundColor: '#FFFFFF',
                outline: 'none',
              }}
              required
            >
              {stockItems.map(item => (
                <option key={item.key} value={item.key}>
                  {item.name} — in stock: {formatStock(item.category, item.unit, item.onHand)}
                </option>
              ))}
            </select>
          </div>

          {/* Active Material On-Hand Summary Badge */}
          {activeItem && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: '8px',
                backgroundColor: '#F1F5F9',
                border: '1px solid #E2E8F0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <span style={{ fontSize: '0.875rem', color: '#64748B', fontWeight: 600 }}>Current Available Stock</span>
                <div style={{ fontSize: '1rem', fontWeight: 700, color: '#0F172A' }}>
                  {formatStock(activeItem.category, activeItem.unit, activeItem.onHand)}
                </div>
              </div>
              <span
                style={{
                  fontSize: '0.875rem',
                  padding: '4px 8px',
                  borderRadius: '6px',
                  fontWeight: 600,
                  backgroundColor: activeItem.onHand <= 0 ? '#FEE2E2' : '#DCFCE7',
                  color: activeItem.onHand <= 0 ? '#991B1B' : '#166534',
                }}
              >
                {activeItem.onHand <= 0 ? 'Out of Stock' : 'In Stock'}
              </span>
            </div>
          )}

          {/* Transfer Target Site */}
          {mode === 'transfer' && (
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                Destination Project / Site <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <select
                value={destinationSiteId}
                onChange={e => setDestinationSiteId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  minHeight: '44px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  fontSize: '0.9rem',
                  backgroundColor: '#FFFFFF',
                  outline: 'none',
                }}
                required
              >
                <option value="">Choose receiving project...</option>
                {sites
                  .filter(s => s.id !== siteId)
                  .map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.address || 'Site'})
                    </option>
                  ))}
              </select>
            </div>
          )}

          {/* Quantity & Date */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                Quantity <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <div style={{ display: 'flex', gap: '6px' }}>
              <input
                type="text"
                inputMode="decimal"
                autoComplete="off"
                placeholder={activeItem ? `${displayStock(activeItem.category, activeItem.unit, activeItem.onHand).quantity} max` : '0'}
                aria-label="Quantity"
                value={quantity}
                onChange={e => setQuantity(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  minHeight: '44px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  fontSize: '0.9rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
                required
              />
              {unitChoices.length > 1 ? (
                <select value={entryUnit} onChange={e => setUnit(e.target.value)} aria-label="Unit" style={{ minHeight: '44px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.9rem', padding: '0 8px', backgroundColor: '#FFFFFF' }}>
                  {unitChoices.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              ) : (
                <span style={{ alignSelf: 'center', fontSize: '0.9rem', color: '#475569' }}>{entryUnit}</span>
              )}
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                Transaction Date <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <input
                type="date"
                max={todayKey()}
                value={date}
                onChange={e => setDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  minHeight: '44px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  fontSize: '0.9rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
                required
              />
            </div>
          </div>

          {/* Work / Usage Location / Reason */}
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
              {mode === 'usage'
                ? 'Used For / Work Stage (optional)'
                : mode === 'transfer'
                ? 'Transfer Reason (optional)'
                : mode === 'adjust_in' || mode === 'adjust_out'
                ? 'Reason'
                : 'Reason (optional)'}
            </label>
            <input
              type="text"
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder={
                mode === 'usage'
                  ? 'e.g. First floor slab casting, West wall brickwork'
                  : 'e.g. Surplus bags moved to Site B'
              }
              style={{
                width: '100%',
                padding: '10px 12px',
                  minHeight: '44px',
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                fontSize: '0.9rem',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Remarks */}
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
              Notes / Remarks
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Additional logs or supervisor remarks"
              style={{
                width: '100%',
                padding: '10px 12px',
                  minHeight: '44px',
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                fontSize: '0.9rem',
                outline: 'none',
                boxSizing: 'border-box',
                fontFamily: 'inherit',
              }}
            />
          </div>

          {/* Actions */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '12px',
              borderTop: '1px solid #E2E8F0',
              paddingTop: '16px',
            }}
          >
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              style={{
                padding: '10px 18px',
                minHeight: '44px',
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                backgroundColor: '#FFFFFF',
                color: '#475569',
                fontSize: '0.9rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                padding: '10px 22px',
                minHeight: '44px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor:
                  mode === 'usage'
                    ? 'var(--color-danger)'
                    : mode === 'transfer'
                    ? 'var(--color-warning)'
                    : 'var(--color-primary)',
                color:
                  mode === 'usage'
                    ? '#FFFFFF'
                    : 'var(--color-on-primary)',
                fontSize: '0.9rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <Save size={18} />
              <span>{isSubmitting ? 'Recording...' : 'Confirm Movement'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
