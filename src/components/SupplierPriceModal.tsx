import React, { useState, useEffect } from 'react';
import { X, Tag, IndianRupee, MapPin, Building, Calendar, Check, AlertCircle } from 'lucide-react';
import { db } from '../db/db';
import type { MaterialPriceQuote, EstimateMaterial } from '../db/types';

interface SupplierPriceModalProps {
  isOpen: boolean;
  onClose: () => void;
  priceToEdit?: MaterialPriceQuote | null;
  defaultMaterial?: EstimateMaterial;
  onSaved: () => void;
}

export const SupplierPriceModal: React.FC<SupplierPriceModalProps> = ({
  isOpen,
  onClose,
  priceToEdit,
  defaultMaterial = 'Cement',
  onSaved,
}) => {
  const [material, setMaterial] = useState<EstimateMaterial>(defaultMaterial);
  const [brand, setBrand] = useState('');
  const [product, setProduct] = useState('');
  const [grade, setGrade] = useState('');
  const [unit, setUnit] = useState('Bag');
  const [price, setPrice] = useState<string>('');
  const [supplier, setSupplier] = useState('');
  const [district, setDistrict] = useState('Coimbatore');
  const [area, setArea] = useState('');
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().slice(0, 10));
  const [source, setSource] = useState('Retail Shop');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (priceToEdit) {
      setMaterial(priceToEdit.material);
      setBrand(priceToEdit.brand || '');
      setProduct(priceToEdit.product || '');
      setGrade(priceToEdit.grade || '');
      setUnit(priceToEdit.unit || 'Bag');
      setPrice(priceToEdit.price.toString());
      setSupplier(priceToEdit.supplier || '');
      setDistrict(priceToEdit.district || 'Coimbatore');
      setArea(priceToEdit.area || '');
      setEffectiveDate(priceToEdit.effectiveDate || new Date().toISOString().slice(0, 10));
      setSource(priceToEdit.source || 'Retail Shop');
    } else {
      setMaterial(defaultMaterial);
      setBrand('');
      setProduct('');
      setGrade('');
      setUnit(defaultMaterial === 'Cement' ? 'Bag' : defaultMaterial === 'Bricks' ? 'Piece' : defaultMaterial === 'Steel' ? 'Kg' : 'CFT');
      setPrice('');
      setSupplier('');
      setDistrict('Coimbatore');
      setArea('');
      setEffectiveDate(new Date().toISOString().slice(0, 10));
      setSource('Retail Shop');
    }
    setError(null);
  }, [priceToEdit, defaultMaterial, isOpen]);

  if (!isOpen) return null;

  const handleMaterialChange = (newMat: EstimateMaterial) => {
    setMaterial(newMat);
    if (newMat === 'Cement') setUnit('Bag');
    else if (newMat === 'Bricks') setUnit('Piece');
    else if (newMat === 'Steel') setUnit('Kg');
    else setUnit('CFT');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const numPrice = parseFloat(price);
    if (isNaN(numPrice) || numPrice <= 0) {
      setError('Please enter a valid price greater than 0.');
      return;
    }
    if (!supplier.trim()) {
      setError('Supplier or dealer name is required.');
      return;
    }

    try {
      setSaving(true);
      const id = priceToEdit ? priceToEdit.id : `price-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const now = new Date().toISOString().slice(0, 10);

      const quote: MaterialPriceQuote = {
        id,
        material,
        brand: brand.trim() || material,
        product: product.trim() || `${brand || material} Standard`,
        grade: grade.trim() || undefined,
        unit,
        price: numPrice,
        supplier: supplier.trim(),
        district: district.trim() || 'Coimbatore',
        area: area.trim() || undefined,
        effectiveDate,
        updatedAt: now,
        source,
        isDeleted: false,
      };

      await db.materialPrices.put(quote);
      await db.logActivity(
        undefined,
        undefined,
        priceToEdit ? 'EDIT' : 'CREATE',
        `${priceToEdit ? 'Updated' : 'Added'} ${material} quote from ${supplier} at ₹${numPrice}/${unit}`,
        numPrice
      );

      onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save price quote.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose} style={{ zIndex: 1100 }}>
      <div
        className="modal-content"
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: '560px',
          width: '95%',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '90vh',
        }}
      >
        {/* Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Tag size={22} color="var(--primary)" />
            <h3 style={{ margin: 0, fontSize: '1.25rem' }}>
              {priceToEdit ? 'Edit Supplier Price Quote' : 'Add Local Supplier Price Quote'}
            </h3>
          </div>
          <button className="btn btn-icon btn-outline" onClick={onClose} aria-label="Close modal">
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <form id="supplier-price-form" onSubmit={handleSave} style={{ overflowY: 'auto', padding: '1.25rem' }}>
          {error && (
            <div
              style={{
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid var(--danger)',
                color: '#f87171',
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                marginBottom: '1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.9rem',
              }}
            >
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          {/* Material Category */}
          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label className="form-label" style={{ fontWeight: 600 }}>Material Category *</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
              {(['Cement', 'Sand', 'M-Sand', 'Aggregate', 'Bricks', 'Steel'] as EstimateMaterial[]).map(mat => (
                <button
                  key={mat}
                  type="button"
                  onClick={() => handleMaterialChange(mat)}
                  style={{
                    padding: '0.55rem 0.5rem',
                    borderRadius: '8px',
                    border: `1.5px solid ${material === mat ? 'var(--primary)' : 'var(--border)'}`,
                    background: material === mat ? 'rgba(255, 184, 0, 0.12)' : 'var(--bg-secondary)',
                    color: material === mat ? 'var(--primary)' : 'var(--text-main)',
                    fontWeight: material === mat ? 700 : 500,
                    fontSize: '0.88rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  {mat === 'Cement' ? '🧱 ' : mat === 'Sand' ? '🏖️ ' : mat === 'M-Sand' ? '⛰️ ' : mat === 'Aggregate' ? '🪨 ' : mat === 'Bricks' ? '🧱 ' : '🏗️ '}
                  {mat}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            {/* Brand */}
            <div className="form-group">
              <label className="form-label">Brand / Manufacturer</label>
              <input
                type="text"
                className="form-input"
                placeholder={material === 'Cement' ? 'e.g. UltraTech, Ramco' : material === 'Steel' ? 'e.g. Tata Tiscon, JSW' : 'e.g. Crusher / River'}
                value={brand}
                onChange={e => setBrand(e.target.value)}
              />
            </div>

            {/* Product / Grade */}
            <div className="form-group">
              <label className="form-label">Product / Grade</label>
              <input
                type="text"
                className="form-input"
                placeholder={material === 'Cement' ? 'e.g. PPC 50kg, 53 Grade' : material === 'Aggregate' ? 'e.g. 20mm Blue Metal' : 'e.g. Fe550D'}
                value={product}
                onChange={e => setProduct(e.target.value)}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            {/* Price */}
            <div className="form-group">
              <label className="form-label" style={{ fontWeight: 600 }}>Rate / Price (₹) *</label>
              <div style={{ position: 'relative' }}>
                <IndianRupee size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="form-input"
                  style={{ paddingLeft: '32px', fontWeight: 700, fontSize: '1.05rem', color: 'var(--primary)' }}
                  placeholder="0.00"
                  value={price}
                  onChange={e => setPrice(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Unit */}
            <div className="form-group">
              <label className="form-label" style={{ fontWeight: 600 }}>Unit of Measure *</label>
              <select className="form-input" value={unit} onChange={e => setUnit(e.target.value)}>
                <option value="Bag">Bag (50 kg)</option>
                <option value="CFT">CFT (Cubic Feet)</option>
                <option value="Kg">Kg (Kilogram)</option>
                <option value="Ton">Ton (1000 kg)</option>
                <option value="Piece">Piece / Block</option>
                <option value="Unit">Unit (100 CFT)</option>
                <option value="Load">Lorry / Tractor Load</option>
              </select>
            </div>
          </div>

          {/* Supplier Name */}
          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label className="form-label" style={{ fontWeight: 600 }}>Supplier / Dealer / Shop Name *</label>
            <div style={{ position: 'relative' }}>
              <Building size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                className="form-input"
                style={{ paddingLeft: '32px' }}
                placeholder="e.g. Sri Murugan Blue Metal & Cements"
                value={supplier}
                onChange={e => setSupplier(e.target.value)}
                required
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            {/* District */}
            <div className="form-group">
              <label className="form-label">District / City</label>
              <div style={{ position: 'relative' }}>
                <MapPin size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  className="form-input"
                  style={{ paddingLeft: '32px' }}
                  placeholder="e.g. Coimbatore, Trichy"
                  value={district}
                  onChange={e => setDistrict(e.target.value)}
                />
              </div>
            </div>

            {/* Area */}
            <div className="form-group">
              <label className="form-label">Area / Landmark</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Gandhipuram, Saravanampatti"
                value={area}
                onChange={e => setArea(e.target.value)}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '0.5rem' }}>
            {/* Effective Date */}
            <div className="form-group">
              <label className="form-label">Quote Date</label>
              <div style={{ position: 'relative' }}>
                <Calendar size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="date"
                  className="form-input"
                  style={{ paddingLeft: '32px' }}
                  value={effectiveDate}
                  onChange={e => setEffectiveDate(e.target.value)}
                />
              </div>
            </div>

            {/* Price Source */}
            <div className="form-group">
              <label className="form-label">Source / Channel</label>
              <select className="form-input" value={source} onChange={e => setSource(e.target.value)}>
                <option value="Retail Shop">Retail Shop</option>
                <option value="Authorised Dealer">Authorised Dealer</option>
                <option value="Wholesale Depot">Wholesale Depot</option>
                <option value="Quarry Direct">Quarry Direct</option>
                <option value="Market Reference">Market Reference</option>
                <option value="Phone Quotation">Phone Quotation</option>
              </select>
            </div>
          </div>
        </form>

        {/* Modal Footer with fixed cancel and save buttons */}
        <div className="modal-footer" style={{ borderTop: '1px solid var(--border)', padding: '1rem 1.25rem' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button
            type="submit"
            form="supplier-price-form"
            className="btn btn-primary"
            disabled={saving}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <Check size={18} />
            <span>{saving ? 'Saving...' : priceToEdit ? 'Update Price Quote' : 'Save Price Quote'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
