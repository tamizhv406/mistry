import React, { useState, useEffect } from 'react';
import { X, Save, Wrench, ArrowUpRight } from 'lucide-react';
import { db } from '../db/db';
import type { ToolItem } from '../db/types';
import { calculateFinancialBalance, recordPaymentTransaction } from '../utils/financial';
import { getCurrentUser } from '../services/auth';
import { compressImageFile } from '../utils/constructionVisuals';

interface ToolModalProps {
  isOpen: boolean;
  siteId: string;
  toolToEdit?: ToolItem | null;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

const COMMON_TOOLS = [
  'Hammer (சுத்தியல்)',
  'Trowel (கரண்டி)',
  'Brick Trowel (செங்கல் கரண்டி)',
  'Shovel (மண்வெட்டி)',
  'Pickaxe (பிக்காஸ் / கோடாரி)',
  'Crowbar (கடப்பாரை)',
  'Measuring Tape (டேப்)',
  'Bucket (வாளி)',
  'Wheelbarrow (தள்ளுவண்டி)',
  'Ladder (ஏணி / சாரம்)',
  'Drill Machine (துளையிடும் இயந்திரம்)',
  'Grinder (கட்டிங் மெஷின்)',
  'Concrete Mixer (கலவை இயந்திரம்)',
  'Tool Box (டூல் பாக்ஸ்)',
  'Saw (மரம் அறுக்கும் வாள்)',
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

  const currentUser = getCurrentUser();

  useEffect(() => {
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
      const today = new Date().toISOString().slice(0, 10);
      setToolName(COMMON_TOOLS[0]);
      setCustomName('');
      setQuantity('1');
      setType('Purchase');
      setCost('500');
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

    const now = new Date().toISOString();
    const id = toolToEdit ? toolToEdit.id : `tool-${Date.now()}`;

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
      purchaseDate: purchaseDate || now.slice(0, 10),
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
          date: purchaseDate || now.slice(0, 10),
          notes: `Initial payment for Tool ${type}: ${finalName}`,
          module: 'Tool',
          userId: currentUser?.id,
        });
      }

      onSuccess(toolToEdit ? `Tool "${finalName}" updated` : `Tool "${finalName}" added to site`);
      onClose();
    } catch (err: any) {
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
                  placeholder="e.g. Earth Rammer / Plate Compactor"
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
                    <img
                      src={imageUrl}
                      alt="Tool preview"
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
              <div style={{ background: '#eff6ff', padding: '8px 10px', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
                <span style={{ fontSize: '0.7rem', color: '#1d4ed8', fontWeight: 600, display: 'block' }}>TOTAL COST</span>
                <strong style={{ fontSize: '1rem', color: '#1e3a8a' }}>₹{fin.totalAmount.toLocaleString('en-IN')}</strong>
              </div>
              <div style={{ background: '#ecfdf5', padding: '8px 10px', borderRadius: '8px', border: '1px solid #a7f3d0' }}>
                <span style={{ fontSize: '0.7rem', color: '#047857', fontWeight: 600, display: 'block' }}>PAID AMOUNT</span>
                <strong style={{ fontSize: '1rem', color: '#065f46' }}>₹{fin.paidAmount.toLocaleString('en-IN')}</strong>
              </div>
              <div style={{ background: fin.balanceDue > 0 ? '#fef2f2' : '#f8fafc', padding: '8px 10px', borderRadius: '8px', border: fin.balanceDue > 0 ? '1px solid #fecaca' : '1px solid var(--border-light)' }}>
                <span style={{ fontSize: '0.7rem', color: fin.balanceDue > 0 ? '#b91c1c' : '#64748b', fontWeight: 600, display: 'block' }}>BALANCE DUE</span>
                <strong style={{ fontSize: '1rem', color: fin.balanceDue > 0 ? '#b91c1c' : '#64748b' }}>₹{fin.balanceDue.toLocaleString('en-IN')}</strong>
              </div>
              <div style={{ background: fin.extraPaid > 0 ? '#f5f3ff' : '#f8fafc', padding: '8px 10px', borderRadius: '8px', border: fin.extraPaid > 0 ? '1.5px solid #ddd6fe' : '1px solid var(--border-light)' }}>
                <span style={{ fontSize: '0.7rem', color: fin.extraPaid > 0 ? '#6d28d9' : '#64748b', fontWeight: 600, display: 'block' }}>EXTRA PAID</span>
                <strong style={{ fontSize: '1rem', color: fin.extraPaid > 0 ? '#6d28d9' : '#64748b' }}>₹{fin.extraPaid.toLocaleString('en-IN')}</strong>
              </div>
            </div>

            {fin.extraPaid > 0 && (
              <div style={{
                backgroundColor: '#f5f3ff',
                color: '#6d28d9',
                padding: '8px 12px',
                borderRadius: '8px',
                fontSize: '0.82rem',
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
                  placeholder="e.g. Sri Balaji Machinery, Annai Rentals"
                  value={supplier}
                  onChange={e => setSupplier(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Notes (e.g. Return date, Repair parts)</label>
                <input
                  type="text"
                  placeholder="e.g. Bearing replacement & oil servicing"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              <Save size={18} />
              {toolToEdit ? 'Save Changes' : 'Add Tool'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
