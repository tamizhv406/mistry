import React, { useState, useEffect } from 'react';
import { X, Save, ArrowUpRight } from 'lucide-react';
import { db } from '../db/db';
import type { RodEntry } from '../db/types';
import { calculateFinancialBalance, recordPaymentTransaction } from '../utils/financial';
import { getCurrentUser } from '../services/auth';
import { VoiceInputField } from './VoiceInputField';

interface RodModalProps {
  isOpen: boolean;
  siteId: string;
  rodToEdit?: RodEntry | null;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

const COMMON_DIAMETERS = [
  '6 mm',
  '8 mm',
  '10 mm',
  '12 mm',
  '16 mm',
  '20 mm',
  '25 mm',
  '32 mm',
];

export const RodModal: React.FC<RodModalProps> = ({
  isOpen,
  siteId,
  rodToEdit,
  onClose,
  onSuccess,
}) => {
  const [diameter, setDiameter] = useState('12 mm');
  const [customDiameter, setCustomDiameter] = useState('');
  const [brand, setBrand] = useState('Tata Tiscon 550D');
  const [supplier, setSupplier] = useState('');
  const [weightKg, setWeightKg] = useState<string>('500');
  const [ratePerKg, setRatePerKg] = useState<string>('68');
  const [quantityPieces, setQuantityPieces] = useState<string>('0');
  const [unit, setUnit] = useState('kg');
  const [paidAmount, setPaidAmount] = useState<string>('0'); // Default: Paid Amount = 0
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  const currentUser = getCurrentUser();

  useEffect(() => {
    if (rodToEdit) {
      if (COMMON_DIAMETERS.includes(rodToEdit.diameter)) {
        setDiameter(rodToEdit.diameter);
        setCustomDiameter('');
      } else {
        setDiameter('Custom');
        setCustomDiameter(rodToEdit.diameter);
      }
      setBrand(rodToEdit.brand || '');
      setSupplier(rodToEdit.supplier || '');
      setWeightKg(rodToEdit.weightKg.toString());
      setRatePerKg(rodToEdit.ratePerKg.toString());
      setQuantityPieces(rodToEdit.quantityPieces ? rodToEdit.quantityPieces.toString() : '0');
      setUnit(rodToEdit.unit || 'kg');
      setPaidAmount(rodToEdit.paidAmount.toString());
      setPurchaseDate(rodToEdit.purchaseDate || '');
      setInvoiceNumber(rodToEdit.invoiceNumber || '');
      setNotes(rodToEdit.notes || '');
    } else {
      const today = new Date().toISOString().slice(0, 10);
      setDiameter('12 mm');
      setCustomDiameter('');
      setBrand('Tata Tiscon 550D');
      setSupplier('');
      setWeightKg('500');
      setRatePerKg('68');
      setQuantityPieces('0');
      setUnit('kg');
      setPaidAmount('0'); // Default: Paid Amount = 0
      setPaymentMode('Cash');
      setPurchaseDate(today);
      setInvoiceNumber('');
      setNotes('');
      setError('');
    }
  }, [rodToEdit, isOpen]);

  if (!isOpen) return null;

  const numWeight = Math.max(0, parseFloat(weightKg) || 0);
  const numRate = Math.max(0, parseFloat(ratePerKg) || 0);
  const calculatedTotal = Math.round(numWeight * numRate);
  const numPaid = Math.max(0, parseFloat(paidAmount) || 0);
  const fin = calculateFinancialBalance(calculatedTotal, numPaid);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const selectedDiameter = diameter === 'Custom' ? customDiameter.trim() : diameter;

    if (!selectedDiameter) {
      setError('Please specify the rod diameter (e.g. 12 mm).');
      return;
    }
    if (!supplier.trim()) {
      setError('Please enter the Steel supplier / dealer name.');
      return;
    }
    if (numWeight <= 0) {
      setError('Weight must be greater than 0 kg.');
      return;
    }
    if (numRate <= 0) {
      setError('Rate per kg must be greater than ₹0.');
      return;
    }

    const now = new Date().toISOString();
    const id = rodToEdit ? rodToEdit.id : `rod-${Date.now()}`;

    const rodData: RodEntry = {
      id,
      siteId,
      diameter: selectedDiameter,
      brand: brand.trim(),
      quantityPieces: parseInt(quantityPieces) || 0,
      unit,
      weightKg: numWeight,
      ratePerKg: numRate,
      totalAmount: calculatedTotal,
      paidAmount: fin.paidAmount,
      balance: fin.balanceDue,
      extraPaid: fin.extraPaid,
      supplier: supplier.trim(),
      purchaseDate: purchaseDate || now.slice(0, 10),
      invoiceNumber: invoiceNumber.trim(),
      notes: notes.trim(),
      isDeleted: false,
      createdAt: rodToEdit ? rodToEdit.createdAt : now,
      updatedAt: now,
    };

    try {
      await db.rodEntries.put(rodData);

      // Record individual payment transaction if initial payment made
      if (!rodToEdit && fin.paidAmount > 0) {
        await recordPaymentTransaction({
          siteId,
          relatedRecordId: id,
          tableName: 'rodEntries',
          amount: fin.paidAmount,
          paymentType: paymentMode,
          date: purchaseDate || now.slice(0, 10),
          notes: invoiceNumber ? `Weighbridge/Inv ${invoiceNumber}` : `Initial payment for Rod ${selectedDiameter}`,
          module: 'Rod',
          userId: currentUser?.id,
        });
      }

      onSuccess(rodToEdit ? `Steel rod entry (${selectedDiameter}) updated` : `Steel rod (${selectedDiameter}) recorded successfully`);
      onClose();
    } catch (err: any) {
      setError('Failed to save steel entry: ' + err.message);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-dialog" onClick={e => e.stopPropagation()} style={{ maxWidth: '640px' }}>
        <div className="modal-header">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.4rem' }}>📏</span>
            {rodToEdit ? 'Edit Steel Rod / Rebar Entry' : 'Add Steel Rod / Rebar Entry'}
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

            <div className="form-grid-2">
              <div className="form-group">
                <label>Diameter Size (mm) <span className="required">*</span></label>
                <select value={diameter} onChange={e => setDiameter(e.target.value)}>
                  {COMMON_DIAMETERS.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                  <option value="Custom">+ Custom Diameter</option>
                </select>
              </div>

              {diameter === 'Custom' ? (
                <div className="form-group">
                  <label>Custom Diameter</label>
                  <input
                    type="text"
                    placeholder="e.g. 28 mm"
                    value={customDiameter}
                    onChange={e => setCustomDiameter(e.target.value)}
                  />
                </div>
              ) : (
                <div className="form-group">
                  <label>Brand / Grade</label>
                  <input
                    type="text"
                    placeholder="e.g. Tata Tiscon / JSW Neosteel Fe550D"
                    value={brand}
                    onChange={e => setBrand(e.target.value)}
                  />
                </div>
              )}
            </div>

            <div className="form-grid-2">
              <VoiceInputField
                label="Supplier / Steel Yard"
                tamilLabel="கம்பி கடை"
                placeholder="e.g. Sri Ram Steel Traders, Annai Steels"
                value={supplier}
                onChange={setSupplier}
                required
              />

              <div className="form-group">
                <label>Number of Rod Pieces / Bundles (Optional)</label>
                <input
                  type="number"
                  placeholder="e.g. 50 rods or 5 bundles"
                  value={quantityPieces}
                  onChange={e => setQuantityPieces(e.target.value)}
                />
              </div>
            </div>

            <div className="form-grid-2">
              <div className="form-group">
                <label>Total Weight in Kilograms (kg) <span className="required">*</span></label>
                <input
                  type="number"
                  step="any"
                  min="0.1"
                  value={weightKg}
                  onChange={e => setWeightKg(e.target.value)}
                />
                <span className="form-hint">
                  {numWeight >= 1000 ? `≈ ${(numWeight / 1000).toFixed(2)} Metric Tons` : ''}
                </span>
              </div>

              <div className="form-group">
                <label>Rate per kg (₹) <span className="required">*</span></label>
                <input
                  type="number"
                  step="any"
                  min="0.1"
                  value={ratePerKg}
                  onChange={e => setRatePerKg(e.target.value)}
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
                <span>Extra Paid: ₹{fin.extraPaid.toLocaleString('en-IN')} advance paid to steel supplier. Balance Due is ₹0.</span>
              </div>
            )}

            <div className="form-grid-3">
              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label>Amount Paid Now (₹)</label>
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
                <label>Invoice / Weighbridge Slip No</label>
                <input
                  type="text"
                  placeholder="e.g. WB-8902 / INV-44"
                  value={invoiceNumber}
                  onChange={e => setInvoiceNumber(e.target.value)}
                />
              </div>

              <VoiceInputField
                label="Notes / Structural Usage"
                tamilLabel="குறிப்புகள்"
                placeholder="e.g. Stirrups for 1st floor beams"
                value={notes}
                onChange={setNotes}
              />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              <Save size={18} />
              {rodToEdit ? 'Save Changes' : 'Save Rod Entry'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
