import React, { useState, useEffect } from 'react';
import { X, Save, Layers, ArrowUpRight } from 'lucide-react';
import { db } from '../db/db';
import type { Material, MaterialCategory } from '../db/types';
import { calculateFinancialBalance, recordPaymentTransaction } from '../utils/financial';
import { getCurrentUser } from '../services/auth';
import { VoiceInputField } from './VoiceInputField';

interface MaterialModalProps {
  isOpen: boolean;
  siteId: string;
  category: MaterialCategory;
  materialToEdit?: Material | null;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

const CEMENT_BRANDS = [
  'UltraTech Cement',
  'Ramco Supergrade',
  'Chettinad Cement',
  'Dalmia DSP',
  'ACC Cement',
  'Ambuja Cement',
  'Coromandel King',
  'Zuari Cement',
  'Priya Cement',
];

export const MaterialModal: React.FC<MaterialModalProps> = ({
  isOpen,
  siteId,
  category,
  materialToEdit,
  onClose,
  onSuccess,
}) => {
  const [materialName, setMaterialName] = useState('');
  const [brand, setBrand] = useState('');
  const [customBrand, setCustomBrand] = useState('');
  const [supplier, setSupplier] = useState('');
  const [quantity, setQuantity] = useState<string>('1');
  const [unit, setUnit] = useState('Unit');
  const [rate, setRate] = useState<string>('0');
  const [paidAmount, setPaidAmount] = useState<string>('0'); // Default: Paid Amount = 0
  const [paymentMode, setPaymentMode] = useState<string>('Cash');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentUser = getCurrentUser();

  // Setup default units and naming based on category
  useEffect(() => {
    if (materialToEdit) {
      setMaterialName(materialToEdit.materialName || '');
      setBrand(materialToEdit.brand || '');
      setSupplier(materialToEdit.supplier || '');
      setQuantity(materialToEdit.quantity.toString());
      setUnit(materialToEdit.unit || 'Unit');
      setRate(materialToEdit.rate.toString());
      setPaidAmount(materialToEdit.paidAmount.toString());
      setPurchaseDate(materialToEdit.purchaseDate || '');
      setInvoiceNumber(materialToEdit.invoiceNumber || '');
      setNotes(materialToEdit.notes || '');
      if (category === 'cement' && materialToEdit.brand && !CEMENT_BRANDS.includes(materialToEdit.brand)) {
        setBrand('Other');
        setCustomBrand(materialToEdit.brand);
      }
    } else {
      const today = new Date().toISOString().slice(0, 10);
      setPurchaseDate(today);
      setPaidAmount('0'); // Default: Paid Amount = 0 as instructed
      setPaymentMode('Cash');
      setInvoiceNumber('');
      setNotes('');
      setSupplier('');
      setError('');
      setIsSubmitting(false);

      if (category === 'sand') {
        setMaterialName('River Sand (Plastering)');
        setUnit('Unit');
        setQuantity('1');
        setRate('14000');
      } else if (category === 'msand') {
        setMaterialName('Manufactured Sand (M-Sand)');
        setUnit('Unit');
        setQuantity('1');
        setRate('9500');
      } else if (category === 'cement') {
        setMaterialName('Cement Bags');
        setBrand('UltraTech Cement');
        setUnit('Bags');
        setQuantity('50');
        setRate('420');
      } else if (category === 'bricks') {
        setMaterialName('Red Clay Chamber Bricks');
        setUnit('Pieces');
        setQuantity('3000');
        setRate('10');
      } else if (category === 'aggregate') {
        setMaterialName('Blue Metal Jelly / Aggregate (20mm)');
        setUnit('CFT');
        setQuantity('100');
        setRate('42');
      } else {
        setMaterialName('');
        setUnit('Units');
        setQuantity('1');
        setRate('0');
      }
    }
  }, [category, materialToEdit, isOpen]);

  if (!isOpen) return null;

  // Real-time calculations with universal payment logic
  const numQuantity = Math.max(0, parseFloat(quantity) || 0);
  const numRate = Math.max(0, parseFloat(rate) || 0);
  const calculatedTotal = Math.round(numQuantity * numRate);
  const numPaid = Math.max(0, parseFloat(paidAmount) || 0);
  const fin = calculateFinancialBalance(calculatedTotal, numPaid);

  const getCategoryTitle = () => {
    switch (category) {
      case 'sand': return 'Sand Purchase';
      case 'msand': return 'M-Sand Purchase';
      case 'cement': return 'Cement Bags Purchase';
      case 'bricks': return 'Bricks Purchase';
      case 'aggregate': return 'Aggregate Purchase';
      default: return 'Material Purchase';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!supplier.trim()) {
      setError('Please enter the Supplier / Hardware shop name.');
      return;
    }
    if (numQuantity <= 0) {
      setError('Quantity must be greater than zero.');
      return;
    }
    if (numRate <= 0) {
      setError('Rate must be greater than zero.');
      return;
    }

    const effectiveBrand = category === 'cement'
      ? (brand === 'Other' ? customBrand.trim() : brand)
      : undefined;

    const finalName = category === 'cement' && effectiveBrand
      ? `${effectiveBrand} - ${materialName || 'Cement'}`
      : materialName.trim() || category.toUpperCase();

    const now = new Date().toISOString();
    const id = materialToEdit ? materialToEdit.id : `mat-${Date.now()}`;

    const record: Material = {
      id,
      siteId,
      category,
      materialName: finalName,
      brand: effectiveBrand,
      supplier: supplier.trim(),
      quantity: numQuantity,
      unit: unit.trim(),
      rate: numRate,
      totalAmount: calculatedTotal,
      paidAmount: fin.paidAmount,
      balance: fin.balanceDue,
      extraPaid: fin.extraPaid,
      purchaseDate: purchaseDate || now.slice(0, 10),
      invoiceNumber: invoiceNumber.trim(),
      notes: notes.trim(),
      isDeleted: false,
      createdAt: materialToEdit ? materialToEdit.createdAt : now,
      updatedAt: now,
    };

    setIsSubmitting(true);
    try {
      await db.materials.put(record);

      // Record individual payment transaction if initial payment made
      if (!materialToEdit && fin.paidAmount > 0) {
        await recordPaymentTransaction({
          siteId,
          relatedRecordId: id,
          tableName: 'materials',
          amount: fin.paidAmount,
          paymentType: paymentMode,
          date: purchaseDate || now.slice(0, 10),
          notes: invoiceNumber ? `Invoice ${invoiceNumber} payment` : `Initial payment for ${finalName}`,
          module: 'Material',
          userId: currentUser?.id,
        });
      }

      onSuccess(materialToEdit ? 'Material record updated successfully' : `${category.toUpperCase()} purchase recorded successfully`);
      onClose();
    } catch (err: any) {
      setError('Failed to save material record: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-dialog" onClick={e => e.stopPropagation()} style={{ maxWidth: '640px' }}>
        <div className="modal-header">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Layers size={22} color="#f59e0b" />
            {materialToEdit ? `Edit ${getCategoryTitle()}` : `Add ${getCategoryTitle()}`}
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

            {/* Cement Brand Selection */}
            {category === 'cement' && (
              <div className="form-grid-2">
                <div className="form-group">
                  <label>Cement Brand</label>
                  <select value={brand} onChange={e => setBrand(e.target.value)}>
                    {CEMENT_BRANDS.map(b => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                    <option value="Other">+ Add Custom Brand</option>
                  </select>
                </div>

                {brand === 'Other' && (
                  <div className="form-group">
                    <label>Enter Brand Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Nagarjuna Cement"
                      value={customBrand}
                      onChange={e => setCustomBrand(e.target.value)}
                    />
                  </div>
                )}
              </div>
            )}

            <div className="form-grid-2">
              <VoiceInputField
                label="Material Description / Type"
                tamilLabel="பொருள் விவரம்"
                placeholder="e.g. Plastering Sand / Wirecut Bricks"
                value={materialName}
                onChange={setMaterialName}
              />

              <VoiceInputField
                label="Supplier / Hardware Shop"
                tamilLabel="விற்பனையாளர்"
                placeholder="e.g. Cauvery Traders / Sri Ram Hardware"
                value={supplier}
                onChange={setSupplier}
                required
              />
            </div>

            <div className="form-grid-3">
              <div className="form-group">
                <label>Quantity <span className="required">*</span></label>
                <input
                  type="number"
                  step="any"
                  min="0.01"
                  value={quantity}
                  onChange={e => setQuantity(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Unit</label>
                <select value={unit} onChange={e => setUnit(e.target.value)}>
                  {category === 'sand' || category === 'msand' ? (
                    <>
                      <option value="Unit">Unit (1 Unit = 100 cft)</option>
                      <option value="Load">Load / Tipper Lorry</option>
                      <option value="Brass">Brass</option>
                      <option value="cft">cft (Cubic Feet)</option>
                      <option value="Tons">Tons</option>
                    </>
                  ) : category === 'cement' ? (
                    <>
                      <option value="Bags">Bags (50 kg)</option>
                      <option value="Tons">Tons</option>
                    </>
                  ) : category === 'bricks' ? (
                    <>
                      <option value="Pieces">Pieces / Bricks</option>
                      <option value="Load">Load</option>
                      <option value="Thousand">Thousand (1000 pcs)</option>
                    </>
                  ) : category === 'aggregate' ? (
                    <>
                      <option value="CFT">CFT (Cubic Feet)</option>
                      <option value="Unit">Unit (100 CFT)</option>
                      <option value="Tons">Tons</option>
                      <option value="Loads">Loads</option>
                    </>
                  ) : (
                    <>
                      <option value="Units">Units</option>
                      <option value="Pieces">Pieces</option>
                      <option value="Loads">Loads</option>
                      <option value="kg">kg</option>
                      <option value="Bags">Bags</option>
                    </>
                  )}
                </select>
              </div>

              <div className="form-group">
                <label>Rate (₹ per {unit}) <span className="required">*</span></label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={rate}
                  onChange={e => setRate(e.target.value)}
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
                <span style={{ fontSize: '0.7rem', color: '#1d4ed8', fontWeight: 600, display: 'block' }}>TOTAL AMOUNT</span>
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
                <span>Extra Paid: ₹{fin.extraPaid.toLocaleString('en-IN')} advance paid to supplier. Balance Due is ₹0.</span>
              </div>
            )}

            <div className="form-grid-3">
              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label>Paid Amount (₹)</label>
                  {calculatedTotal > 0 && (
                    <button
                      type="button"
                      onClick={() => setPaidAmount(calculatedTotal.toString())}
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
                  <option value="Cheque">📜 Cheque</option>
                </select>
              </div>

              <div className="form-group">
                <label>Purchase Date</label>
                <input
                  type="date"
                  value={purchaseDate}
                  onChange={e => setPurchaseDate(e.target.value)}
                />
              </div>
            </div>

            <div className="form-grid-2">
              <div className="form-group">
                <label>Invoice / Bill Number</label>
                <input
                  type="text"
                  placeholder="e.g. INV-2026-90"
                  value={invoiceNumber}
                  onChange={e => setInvoiceNumber(e.target.value)}
                />
              </div>

              <VoiceInputField
                label="Material Notes / Vehicle No"
                tamilLabel="குறிப்புகள்"
                placeholder="e.g. Lorry TN-22-AX-4433, unloaded at backyard"
                value={notes}
                onChange={setNotes}
              />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              <Save size={18} />
              <span>{isSubmitting ? 'Saving...' : (materialToEdit ? 'Save Changes' : 'Save Purchase')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
