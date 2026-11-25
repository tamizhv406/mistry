import { todayKey } from '../utils/datetime';
import React, { useState, useEffect } from 'react';
import { X, Save, Wrench, ArrowUpRight } from 'lucide-react';
import { db } from '../db/db';
import type { ToolItem } from '../db/types';
import { calculateFinancialBalance, recordPaymentTransaction } from '../utils/financial';
import { getCurrentUser } from '../services/auth';
import { newId } from '../services/records';
import { compressImageFile } from '../utils/constructionVisuals';
import { SafeImage } from './ui/SafeImage';

interface ToolModalProps {
  isOpen: boolean;
  siteId: string;
  toolToEdit?: ToolItem | null;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

const COMMON_TOOLS = [
  'Hammer',
  'Trowel',
  'Brick Trowel',
  'Shovel',
  'Pickaxe',
  'Crowbar',
  'Measuring Tape',
  'Bucket',
  'Wheelbarrow',
  'Ladder',
  'Drill Machine',
  'Grinder',
  'Concrete Mixer',
  'Tool Box',
  'Saw',
  'Other (Custom Tool)',
];

export const ToolModal: React.FC<ToolModalProps> = ({
  isOpen,
  siteId,
  toolToEdit,
  onClose,
  onSuccess,
}) => {
  const [toolName, setToolName] = useState(COMMON_TOOLS[0]);
  const [customName, setCustomName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [type, setType] = useState<'Purchase' | 'Rental' | 'Repair'>('Purchase');
  const [cost, setCost] = useState('0');
  const [paidAmount, setPaidAmount] = useState('0'); // Default: Paid Amount = 0
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [supplier, setSupplier] = useState('');
  const [notes, setNotes] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentUser = getCurrentUser();

  useEffect(() => {
    setIsSubmitting(false);
    if (toolToEdit) {
      const match = COMMON_TOOLS.find(
        t => t === toolToEdit.toolName || t.toLowerCase().startsWith(toolToEdit.toolName.toLowerCase().split(' ')[0])
      );
      if (match) {
        setToolName(match);
        setCustomName('');
      } else {
        setToolName('Other (Custom Tool)');
        setCustomName(toolToEdit.toolName);
      }
      setQuantity(toolToEdit.quantity.toString());
      setType(toolToEdit.type);
      setCost(toolToEdit.cost.toString());
      setPaidAmount(toolToEdit.paidAmount.toString());
      setPurchaseDate(toolToEdit.purchaseDate || '');
      setSupplier(toolToEdit.supplier || '');
      setNotes(toolToEdit.notes || '');
      setImageUrl(toolToEdit.imageUrl || '');
    } else {
      const today = todayKey();
      setToolName(COMMON_TOOLS[0]);
      setCustomName('');
      setQuantity('1');
      setType('Purchase');
      setCost(''); // no made-up amount: a forgotten cost must not save as ₹500
      setPaidAmount('0'); // Default: Paid Amount = 0
      setPaymentMode('Cash');
      setPurchaseDate(today);
      setSupplier('');
      setNotes('');
      setImageUrl('');
      setError('');
    }
  }, [toolToEdit, isOpen]);

  if (!isOpen) return null;

  const numQty = Math.max(1, parseInt(quantity) || 1);
  const numCost = Math.max(0, parseFloat(cost) || 0);
  const numPaid = Math.max(0, parseFloat(paidAmount) || 0);
  const fin = calculateFinancialBalance(numCost, numPaid);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanToolName = toolName.split(' (')[0];
    const finalName = toolName.includes('Other') ? customName.trim() : cleanToolName;

    if (!finalName) {
      setError('Please enter or select a tool name.');
      return;
    }
    if (numCost <= 0) {
      setError('Cost must be greater than ₹0.');
      return;
    }
    if (purchaseDate && purchaseDate > todayKey()) {
      setError('The date cannot be in the future.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    const now = new Date().toISOString();
    const id = toolToEdit ? toolToEdit.id : newId('tool');

    const record: ToolItem = {
      id,
      siteId,
      toolName: finalName,
      quantity: numQty,
      type,
      cost: numCost,
      paidAmount: fin.paidAmount,
      balance: fin.balanceDue,
      extraPaid: fin.extraPaid,
      purchaseDate: purchaseDate || todayKey(),
      supplier: supplier.trim(),
      notes: notes.trim(),
      imageUrl: imageUrl || undefined,
      isDeleted: false,
      createdAt: toolToEdit ? toolToEdit.createdAt : now,
      updatedAt: now,
    };

    try {
      await db.tools.put(record);

      // Record individual payment transaction if initial payment made
      if (!toolToEdit && fin.paidAmount > 0) {
        await recordPaymentTransaction({
          siteId,
          relatedRecordId: id,
          tableName: 'tools',
          amount: fin.paidAmount,
          paymentType: paymentMode,
          date: purchaseDate || todayKey(),
          notes: `Initial payment for Tool ${type}: ${finalName}`,
          module: 'Tool',
          userId: currentUser?.id,
        });
      }

      onSuccess(toolToEdit ? `Tool "${finalName}" updated` : `Tool "${finalName}" added to site`);
      onClose();
    } catch (err: any) {
      setIsSubmitting(false);
      setError('Failed to save tool: ' + err.message);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-dialog" onClick={e => e.stopPropagation()} style={{ maxWidth: '640px' }}>
        <div className="modal-header">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Wrench size={22} color="#f59e0b" />
            {toolToEdit ? 'Edit Tool / Equipment' : 'Add Tool / Equipment'}
          </h3>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && (
              <div style={{
                backgroundColor: '#fee2e2',
                color: '#991b1b',
                padding: '10px 14px',
                borderRadius: '8px',
                fontSize: '0.88rem',
                fontWeight: 600,
                marginBottom: '12px',
              }}>
                {error}
              </div>
            )}

            <div className="form-group">
              <label>Tool / Machinery Category</label>
              <select value={toolName} onChange={e => setToolName(e.target.value)}>
                {COMMON_TOOLS.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            {toolName.includes('Other') && (
              <div className="form-group">
                <label>Custom Tool / Machine Name <span className="required">*</span></label>
                <input
                  type="text"
                  placeholder="Tool / Machine Name"
                  value={customName}
                  onChange={e => setCustomName(e.target.value)}
                  autoFocus
                />
              </div>
            )}

            {/* Custom / Tool Image Upload */}
            <div className="form-group">
              <label>Tool Image / Photo {toolName.includes('Other') ? '(Recommended for Custom Tools)' : '(Optional override)'}</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <input
                  type="file"
                  accept="image/*"
                  onChange={async e => {
                    const file = e.target.files?.[0];
                    if (file) {
                      try {
                        const compressed = await compressImageFile(file);
                        setImageUrl(compressed);
                      } catch (err) {
                        console.error('Failed to compress tool image:', err);
                      }
                    }
                  }}
                  style={{ flex: 1, minWidth: '200px' }}
                />
                {imageUrl && (
                  <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
                    <SafeImage
                      src={imageUrl}
                      alt="Tool preview"
                      fallbackCategory="tool"
                      style={{
                        width: '44px',
                        height: '44px',
                        objectFit: 'cover',
                        borderRadius: '8px',
                        border: '2px solid #f59e0b',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setImageUrl('')}
                      style={{
                        position: 'absolute',
                        top: '-6px',
                        right: '-6px',
                        background: '#ef4444',
                        color: '#fff',
                        borderRadius: '50%',
                        width: '18px',
                        height: '18px',
                        fontSize: '11px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: 'none',
                        cursor: 'pointer',
                      }}
                      title="Remove image"
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="form-grid-3">
              <div className="form-group">
                <label>Transaction Type <span className="required">*</span></label>
                <select value={type} onChange={e => setType(e.target.value as any)}>
                  <option value="Purchase">🛒 Tool Purchase</option>
                  <option value="Rental">⏳ Tool Rental</option>
                  <option value="Repair">🔧 Tool Repair</option>
                </select>
              </div>

              <div className="form-group">
                <label>Quantity (Nos)</label>
                <input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={e => setQuantity(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Total Cost / Rent / Repair (₹) <span className="required">*</span></label>
                <input
                  type="number"
                  step="any"
                  min="1"
                  value={cost}
                  onChange={e => setCost(e.target.value)}
                  placeholder="Enter the amount"
                  required
                />
              </div>
            </div>

            {/* Universal 4-Box Financial Status Ribbon */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(115px, 1fr))',
              gap: '8px',
              marginBottom: '16px',
            }}>
              <div style={{ background: 'var(--color-bg)', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', fontWeight: 600, display: 'block' }}>TOTAL COST</span>
                <strong style={{ fontSize: '1rem', color: 'var(--color-charcoal)' }}>₹{fin.totalAmount.toLocaleString('en-IN')}</strong>
              </div>
              <div style={{ background: 'var(--color-success-soft)', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--color-success-border)' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--color-success-text)', fontWeight: 600, display: 'block' }}>PAID AMOUNT</span>
                <strong style={{ fontSize: '1rem', color: 'var(--color-success-text)' }}>₹{fin.paidAmount.toLocaleString('en-IN')}</strong>
              </div>
              <div style={{ background: fin.balanceDue > 0 ? 'var(--color-danger-soft)' : 'var(--color-bg)', padding: '8px 10px', borderRadius: '8px', border: fin.balanceDue > 0 ? '1px solid var(--color-danger-border)' : '1px solid var(--color-border)' }}>
                <span style={{ fontSize: '0.72rem', color: fin.balanceDue > 0 ? 'var(--color-danger-text)' : 'var(--color-text-muted)', fontWeight: 600, display: 'block' }}>BALANCE DUE</span>
                <strong style={{ fontSize: '1rem', color: fin.balanceDue > 0 ? 'var(--color-danger-text)' : 'var(--color-text-muted)' }}>₹{fin.balanceDue.toLocaleString('en-IN')}</strong>
              </div>
              <div style={{ background: fin.extraPaid > 0 ? 'var(--color-primary-soft)' : 'var(--color-bg)', padding: '8px 10px', borderRadius: '8px', border: fin.extraPaid > 0 ? '1.5px solid var(--color-primary-border)' : '1px solid var(--color-border)' }}>
                <span style={{ fontSize: '0.72rem', color: fin.extraPaid > 0 ? 'var(--color-primary-text)' : 'var(--color-text-muted)', fontWeight: 600, display: 'block' }}>EXTRA PAID</span>
                <strong style={{ fontSize: '1rem', color: fin.extraPaid > 0 ? 'var(--color-primary-text)' : 'var(--color-text-muted)' }}>₹{fin.extraPaid.toLocaleString('en-IN')}</strong>
              </div>
            </div>

            {fin.extraPaid > 0 && (
              <div style={{
                backgroundColor: 'var(--color-primary-soft)',
                color: 'var(--color-primary-text)',
                border: '1px solid var(--color-primary-border)',
                padding: '8px 12px',
                borderRadius: '8px',
                fontSize: '0.84rem',
                fontWeight: 600,
                marginBottom: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}>
                <ArrowUpRight size={16} />
                <span>Extra Paid: ₹{fin.extraPaid.toLocaleString('en-IN')} recorded above total cost. Balance Due is ₹0.</span>
              </div>
            )}

            <div className="form-grid-3">
              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label>Amount Paid Now (₹)</label>
                  {numCost > 0 && (
                    <button
                      type="button"
                      onClick={() => setPaidAmount(numCost.toString())}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--primary)',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        padding: 0,
                      }}
                    >
                      Pay Full
                    </button>
                  )}
                </div>
                <input
                  type="number"
                  step="any"
                  min="0"
                  placeholder="0"
                  value={paidAmount}
                  onChange={e => setPaidAmount(e.target.value)}
                />
                <span className="form-hint">Default: 0</span>
              </div>

              <div className="form-group">
                <label>Payment Mode</label>
                <select value={paymentMode} onChange={e => setPaymentMode(e.target.value)}>
                  <option value="Cash">💵 Cash</option>
                  <option value="UPI">📱 UPI / GPay / PhonePe</option>
                  <option value="Bank Transfer">🏦 Bank Transfer</option>
                </select>
              </div>

              <div className="form-group">
                <label>Date</label>
                <input
                  type="date"
                  max={todayKey()}
                  value={purchaseDate}
                  onChange={e => setPurchaseDate(e.target.value)}
                />
              </div>
            </div>

            <div className="form-grid-2">
              <div className="form-group">
                <label>Supplier / Workshop / Rental Shop</label>
                <input
                  type="text"
                  placeholder="Rental Agency / Vendor"
                  value={supplier}
                  onChange={e => setSupplier(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Notes (Return date, Repair parts)</label>
                <input
                  type="text"
                  placeholder="Repair notes / service details"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting}
            >
              <Save size={18} />
              <span>{isSubmitting ? 'Saving...' : toolToEdit ? 'Save Changes' : 'Add Tool'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
