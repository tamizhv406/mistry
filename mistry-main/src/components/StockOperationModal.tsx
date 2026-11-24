import React, { useState } from 'react';
import {
  X,
  ArrowDownCircle,
  ArrowUpCircle,
  RotateCcw,
  PlusCircle,
  Save,
  AlertCircle,
  Building2,
  Calendar,
  Layers,
  ArrowRightLeft,
} from 'lucide-react';
import type { MaterialCategory, Site, StockMovementType, User } from '../db/types';
import { todayKey } from '../utils/datetime';
import { formatQty } from '../utils/money';
import { getCurrentUser } from '../services/auth';
import { recordStockMovement } from '../services/records';
import { type StockItem } from '../domain/stock';

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

export const StockOperationModal: React.FC<StockOperationModalProps> = ({
  isOpen,
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
  const [selectedItemKey, setSelectedItemKey] = useState<string>(preselectedItem?.key || (stockItems[0]?.key || ''));
  const [quantity, setQuantity] = useState<string>('1');
  const [date, setDate] = useState<string>(todayKey());
  const [destinationSiteId, setDestinationSiteId] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  React.useEffect(() => {
    if (!isOpen) return;
    if (preselectedItem) {
      setSelectedItemKey(preselectedItem.key);
    } else if (stockItems.length > 0 && !selectedItemKey) {
      setSelectedItemKey(stockItems[0].key);
    }
    setMode(initialMode);
    setDate(todayKey());
    setQuantity('1');
    setReason('');
    setNotes('');
    setError('');

    // Preselect a destination site for transfer if available
    const otherSites = sites.filter(s => s.id !== siteId);
    if (otherSites.length > 0) {
      setDestinationSiteId(otherSites[0].id);
    }
  }, [isOpen, preselectedItem, initialMode, siteId, sites]);

  const activeItem = stockItems.find(s => s.key === selectedItemKey) || stockItems[0];

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

    const qNum = parseFloat(quantity);
    if (!qNum || qNum <= 0) {
      setError('Quantity must be greater than zero.');
      return;
    }

    // Check available balance for outgoing movements
    if ((mode === 'usage' || mode === 'return' || mode === 'adjust_out' || mode === 'transfer') && qNum > activeItem.onHand) {
      setError(`Quantity (${qNum} ${activeItem.unit}) exceeds current on-hand stock (${formatQty(activeItem.onHand)} ${activeItem.unit}).`);
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
          unit: activeItem.unit,
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
          unit: activeItem.unit,
          movementType: 'adjust_in',
          quantity: qNum,
          eventDate: date,
          reason: `Transferred from ${sites.find(s => s.id === siteId)?.name || 'other site'}`,
          notes: notes.trim(),
        });

        if (!inRes.ok) {
          setError(inRes.error);
          setIsSubmitting(false);
          return;
        }

        onSuccess(`Transferred ${qNum} ${activeItem.unit} ${activeItem.name} successfully.`);
        onClose();
      } else {
        const res = await recordStockMovement(currentUser, siteId, {
          itemKey: activeItem.key,
          itemName: activeItem.name,
          category: activeItem.category,
          unit: activeItem.unit,
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

        onSuccess(`${actionText}: ${qNum} ${activeItem.unit} ${activeItem.name} logged.`);
        onClose();
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to record stock movement.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

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
                    ? '#FEE2E2'
                    : mode === 'transfer'
                    ? '#EDE9FE'
                    : '#EFF6FF',
                color:
                  mode === 'usage'
                    ? '#DC2626'
                    : mode === 'transfer'
                    ? '#7C3AED'
                    : '#2563EB',
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
              <p style={{ margin: 0, fontSize: '0.825rem', color: '#64748B' }}>
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
            <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#334155', marginBottom: '8px' }}>
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
                    borderRadius: '8px',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    border: mode === opt.id ? '2px solid #2563EB' : '1px solid #CBD5E1',
                    backgroundColor: mode === opt.id ? '#EFF6FF' : '#FFFFFF',
                    color: mode === opt.id ? '#1D4ED8' : '#475569',
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
            <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
              Material <span style={{ color: '#EF4444' }}>*</span>
            </label>
            <select
              value={selectedItemKey}
              onChange={e => setSelectedItemKey(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
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
                  {item.name} — On Hand: {formatQty(item.onHand)} {item.unit}
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
                <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600 }}>Current Available Stock</span>
                <div style={{ fontSize: '1rem', fontWeight: 700, color: '#0F172A' }}>
                  {formatQty(activeItem.onHand)} {activeItem.unit}
                </div>
              </div>
              <span
                style={{
                  fontSize: '0.75rem',
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
              <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                Destination Project / Site <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <select
                value={destinationSiteId}
                onChange={e => setDestinationSiteId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
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
              <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                Quantity ({activeItem?.unit || 'Unit'}) <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <input
                type="number"
                step="any"
                value={quantity}
                onChange={e => setQuantity(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  fontSize: '0.9rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
                required
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                Transaction Date <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
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
            <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
              {mode === 'usage'
                ? 'Used For / Work Stage'
                : mode === 'transfer'
                ? 'Transfer Reason'
                : 'Reason / Purpose'}
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
            <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
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
                borderRadius: '8px',
                border: 'none',
                backgroundColor:
                  mode === 'usage'
                    ? '#DC2626'
                    : mode === 'transfer'
                    ? '#7C3AED'
                    : '#2563EB',
                color: '#FFFFFF',
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
