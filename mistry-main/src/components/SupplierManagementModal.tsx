import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import {
  Users,
  Phone,
  Mail,
  MapPin,
  Tag,
  PlusCircle,
  Search,
  Edit2,
  Trash2,
  Receipt,
  FileText,
  X,
  ExternalLink,
  Building2,
} from 'lucide-react';
import type { SupplierRecord, User } from '../db/types';

interface SupplierManagementModalProps {
  user?: User | null;
  onClose: () => void;
  onNotify?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const SupplierManagementModal: React.FC<SupplierManagementModalProps> = ({
  user,
  onClose,
  onNotify,
}) => {
  const [search, setSearch] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<SupplierRecord | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [gstin, setGstin] = useState('');
  const [materials, setMaterials] = useState('');
  const [notes, setNotes] = useState('');

  // Live queries
  const suppliers = useLiveQuery(
    () => db.suppliers.filter(s => !s.isDeleted).toArray(),
    []
  ) || [];

  const allMaterials = useLiveQuery(
    () => db.materials.filter(m => !m.isDeleted).toArray(),
    []
  ) || [];

  const allRods = useLiveQuery(
    () => db.rodEntries.filter(r => !r.isDeleted).toArray(),
    []
  ) || [];

  // Open Edit
  const openEdit = (sup: SupplierRecord) => {
    setEditingSupplier(sup);
    setName(sup.name);
    setContactPerson(sup.contactPerson || '');
    setPhone(sup.phone);
    setEmail(sup.email || '');
    setAddress(sup.address || '');
    setGstin(sup.gstin || '');
    setMaterials(sup.materialsSupplied?.join(', ') || '');
    setNotes(sup.notes || '');
    setShowAddForm(true);
  };

  const openNew = () => {
    setEditingSupplier(null);
    setName('');
    setContactPerson('');
    setPhone('');
    setEmail('');
    setAddress('');
    setGstin('');
    setMaterials('Cement, Sand, Steel');
    setNotes('');
    setShowAddForm(true);
  };

  // Save Supplier
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) {
      onNotify?.('Supplier name and phone are required', 'error');
      return;
    }

    const now = new Date().toISOString();
    const materialsList = materials
      .split(',')
      .map(m => m.trim())
      .filter(Boolean);

    const data: SupplierRecord = {
      id: editingSupplier ? editingSupplier.id : `sup-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      userId: user?.id || 'usr-default',
      name: name.trim(),
      contactPerson: contactPerson.trim() || undefined,
      phone: phone.trim(),
      email: email.trim() || undefined,
      address: address.trim() || undefined,
      gstin: gstin.trim() || undefined,
      materialsSupplied: materialsList,
      notes: notes.trim() || undefined,
      isDeleted: false,
      createdAt: editingSupplier ? editingSupplier.createdAt : now,
      updatedAt: now,
    };

    await db.suppliers.put(data);
    setShowAddForm(false);
    onNotify?.(editingSupplier ? 'Supplier updated' : 'Supplier added successfully', 'success');
  };

  // Delete Supplier
  const handleDelete = async (id: string) => {
    if (window.confirm('Delete this supplier profile?')) {
      const now = new Date().toISOString();
      await db.suppliers.update(id, { isDeleted: true, deletedAt: now, updatedAt: now });
      onNotify?.('Supplier deleted', 'info');
    }
  };

  // Calculate purchase history for each supplier
  const getSupplierStats = (supplierName: string) => {
    const sName = supplierName.toLowerCase().trim();
    const supMaterials = allMaterials.filter(m => m.supplier?.toLowerCase().trim() === sName);
    const supRods = allRods.filter(r => r.supplier?.toLowerCase().trim() === sName);

    const totalOrders = supMaterials.length + supRods.length;
    const totalPurchases =
      supMaterials.reduce((sum, m) => sum + (Number(m.totalAmount) || 0), 0) +
      supRods.reduce((sum, r) => sum + (Number(r.totalAmount) || 0), 0);
    const totalPaid =
      supMaterials.reduce((sum, m) => sum + (Number(m.paidAmount) || 0), 0) +
      supRods.reduce((sum, r) => sum + (Number(r.paidAmount) || 0), 0);
    const balance = Math.max(0, totalPurchases - totalPaid);

    return { totalOrders, totalPurchases, totalPaid, balance };
  };

  const filteredSuppliers = suppliers.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    (s.contactPerson && s.contactPerson.toLowerCase().includes(search.toLowerCase())) ||
    (s.phone && s.phone.includes(search))
  );

  return (
    <div className="modal-backdrop">
      <div className="modal-card" style={{ maxWidth: '850px', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', borderBottom: '1px solid #E2E8F0', paddingBottom: '14px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Building2 size={20} color="#2563EB" />
              <span>Supplier & Vendor Directory</span>
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#64748B' }}>
              Vendor profiles, material categories, purchase history, and outstanding payables.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={openNew}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}
            >
              <PlusCircle size={16} />
              <span>Add Supplier</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748B' }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Add / Edit Form */}
        {showAddForm && (
          <form onSubmit={handleSave} style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '18px', marginBottom: '20px' }}>
            <h4 style={{ margin: '0 0 12px', fontSize: '0.95rem', fontWeight: 700, color: '#1E293B' }}>
              {editingSupplier ? 'Edit Supplier Profile' : 'New Supplier Profile'}
            </h4>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '12px' }}>
              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Vendor / Business Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sri Murugan Blue Metal & Cements"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #CBD5E1' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Contact Person</label>
                <input
                  type="text"
                  placeholder="e.g. S. Murugesan"
                  value={contactPerson}
                  onChange={e => setContactPerson(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #CBD5E1' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Phone Number *</label>
                <input
                  type="tel"
                  required
                  placeholder="e.g. 9840112233"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #CBD5E1' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Email</label>
                <input
                  type="email"
                  placeholder="e.g. info@murugancement.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #CBD5E1' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '12px' }}>
              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>GSTIN Number</label>
                <input
                  type="text"
                  placeholder="33AAAAA0000A1Z5"
                  value={gstin}
                  onChange={e => setGstin(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #CBD5E1' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Materials Supplied (Comma-separated)</label>
                <input
                  type="text"
                  placeholder="Cement, M-Sand, TMT Steel, Red Bricks"
                  value={materials}
                  onChange={e => setMaterials(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #CBD5E1' }}
                />
              </div>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Office / Yard Address</label>
              <input
                type="text"
                placeholder="Yard address, landmark, town..."
                value={address}
                onChange={e => setAddress(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #CBD5E1' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setShowAddForm(false)}
              >
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                {editingSupplier ? 'Update Supplier' : 'Save Supplier'}
              </button>
            </div>
          </form>
        )}

        {/* Search */}
        <div className="search-input-wrapper" style={{ marginBottom: '16px' }}>
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Search suppliers by business name, contact person, phone..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Suppliers List */}
        {filteredSuppliers.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: '#64748B' }}>
            <Building2 size={36} style={{ color: '#94A3B8', margin: '0 auto 10px' }} />
            <h4 style={{ margin: '0 0 4px', color: '#1E293B', fontSize: '1rem' }}>No suppliers in directory</h4>
            <p style={{ margin: 0, fontSize: '0.85rem' }}>
              Add your cement dealers, steel traders, quarry suppliers, and brick manufacturers.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {filteredSuppliers.map(sup => {
              const stats = getSupplierStats(sup.name);
              return (
                <div
                  key={sup.id}
                  style={{
                    border: '1px solid #E2E8F0',
                    borderRadius: '12px',
                    padding: '16px 20px',
                    background: '#FFFFFF',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '14px',
                  }}
                >
                  <div style={{ flex: 1, minWidth: '260px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <strong style={{ fontSize: '1rem', color: '#0F172A' }}>{sup.name}</strong>
                      {sup.gstin && (
                        <span style={{ fontSize: '0.68rem', padding: '2px 6px', background: '#F1F5F9', color: '#475569', borderRadius: '4px' }}>
                          GST: {sup.gstin}
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', fontSize: '0.78rem', color: '#64748B', marginTop: '6px' }}>
                      {sup.contactPerson && (
                        <span>Contact: <strong style={{ color: '#334155' }}>{sup.contactPerson}</strong></span>
                      )}
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Phone size={12} />
                        <strong style={{ color: '#0F172A' }}>{sup.phone}</strong>
                      </span>
                      {sup.address && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <MapPin size={12} />
                          {sup.address}
                        </span>
                      )}
                    </div>

                    {sup.materialsSupplied && sup.materialsSupplied.length > 0 && (
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}>
                        {sup.materialsSupplied.map((m, i) => (
                          <span
                            key={i}
                            style={{
                              fontSize: '0.68rem',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              background: '#EFF6FF',
                              color: '#2563EB',
                              fontWeight: 600,
                            }}
                          >
                            {m}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Financial & Order Ledger with this Supplier */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '0.7rem', color: '#64748B', display: 'block' }}>Total Purchases</span>
                      <strong style={{ fontSize: '0.9rem', color: '#0F172A' }}>₹{stats.totalPurchases.toLocaleString('en-IN')}</strong>
                      <span style={{ fontSize: '0.7rem', display: 'block', color: stats.balance > 0 ? '#DC2626' : '#16A34A', fontWeight: 600 }}>
                        {stats.balance > 0 ? `Due: ₹${stats.balance.toLocaleString('en-IN')}` : 'Settled'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        type="button"
                        className="btn-icon"
                        onClick={() => openEdit(sup)}
                        style={{ padding: '6px', borderRadius: '6px', border: '1px solid #CBD5E1', background: '#FFFFFF', cursor: 'pointer', color: '#475569' }}
                        title="Edit supplier"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        type="button"
                        className="btn-icon"
                        onClick={() => handleDelete(sup.id)}
                        style={{ padding: '6px', borderRadius: '6px', border: '1px solid #FCA5A5', background: '#FEF2F2', cursor: 'pointer', color: '#DC2626' }}
                        title="Delete supplier"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
