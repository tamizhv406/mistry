import { todayKey } from '../../utils/datetime';
import React, { useState } from 'react';
import {
  Layers,
  PlusCircle,
  Edit2,
  Trash2,
  Disc,
  Receipt,
  LayoutGrid,
  Table as TableIcon,
  Tag,
  Calendar,
  Building,
  Hash,
} from 'lucide-react';
import type { Material, RodEntry, MaterialCategory } from '../../db/types';
import { PaymentHistoryModal } from '../../components/PaymentHistoryModal';
import {
  InteractiveHoverCard,
  type InteractiveHoverItem,
} from '../../components/ui/interactive-hover-links';
import { ItemDetailsModal, type DetailField } from '../../components/ui/ItemDetailsModal';
import {
  getMaterialVisual,
  getRodVisual,
} from '../../utils/constructionVisuals';
import { SafeImage } from '../../components/ui/SafeImage';

interface MaterialsTabProps {
  siteId: string;
  materials: Material[];
  rodEntries: RodEntry[];
  onOpenMaterialModal: (category: MaterialCategory, material?: Material) => void;
  onOpenRodModal: (rod?: RodEntry) => void;
  onDeleteMaterial: (material: Material) => void;
  onDeleteRod: (rod: RodEntry) => void;
}

const ROD_STANDARD_DIAMETERS = [
  '6 mm',
  '8 mm',
  '10 mm',
  '12 mm',
  '16 mm',
  '20 mm',
  '25 mm',
  'Custom',
];

export const MaterialsTab: React.FC<MaterialsTabProps> = ({
  siteId,
  materials,
  rodEntries,
  onOpenMaterialModal,
  onOpenRodModal,
  onDeleteMaterial,
  onDeleteRod,
}) => {
  const [activeCategory, setActiveCategory] = useState<
    'sand' | 'msand' | 'cement' | 'rod' | 'bricks' | 'legacy'
  >('sand');

  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  // Modal inspection states
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
  const [selectedRod, setSelectedRod] = useState<RodEntry | null>(null);
  const [selectedDiameterCatalog, setSelectedDiameterCatalog] = useState<string | null>(null);

  // Payment History Modal state
  const [paymentModalData, setPaymentModalData] = useState<{
    isOpen: boolean;
    relatedRecordId: string;
    tableName: 'materials' | 'rodEntries';
    title: string;
    subtitle?: string;
    module: string;
    totalAmount: number;
  }>({
    isOpen: false,
    relatedRecordId: '',
    tableName: 'materials',
    title: '',
    module: 'Material',
    totalAmount: 0,
  });

  // Category subsets
  const sandItems = materials.filter(m => m.category === 'sand');
  const msandItems = materials.filter(m => m.category === 'msand');
  const cementItems = materials.filter(m => m.category === 'cement');
  const brickItems = materials.filter(m => m.category === 'bricks');
  const legacyItems = materials.filter(m => m.category === 'aggregate' || m.category === 'other');

  const sandTotal = sandItems.reduce((acc, m) => acc + m.totalAmount, 0);
  const msandTotal = msandItems.reduce((acc, m) => acc + m.totalAmount, 0);
  const cementTotal = cementItems.reduce((acc, m) => acc + m.totalAmount, 0);
  const rodTotal = rodEntries.reduce((acc, r) => acc + r.totalAmount, 0);
  const brickTotal = brickItems.reduce((acc, m) => acc + m.totalAmount, 0);

  // Separate rod summary by diameter (Never combine different diameters!)
  const rodSummaryByDiameter = rodEntries.reduce((acc, r) => {
    const d = r.diameter;
    if (!acc[d]) {
      acc[d] = {
        weightKg: 0,
        totalAmount: 0,
        paidAmount: 0,
        balance: 0,
        extraPaid: 0,
        count: 0,
        supplier: r.supplier,
        brand: r.brand || 'TMT Steel',
      };
    }
    acc[d].weightKg += r.weightKg;
    acc[d].totalAmount += r.totalAmount;
    acc[d].paidAmount += r.paidAmount;
    acc[d].balance += r.balance;
    acc[d].extraPaid += r.extraPaid || 0;
    acc[d].count += 1;
    return acc;
  }, {} as Record<string, { weightKg: number; totalAmount: number; paidAmount: number; balance: number; extraPaid: number; count: number; supplier: string; brand: string }>);

  const totalSteelWeightKg = rodEntries.reduce((acc, r) => acc + r.weightKg, 0);

  const handleOpenPaymentHistory = (
    item: Material | RodEntry,
    tableName: 'materials' | 'rodEntries'
  ) => {
    const title =
      'materialName' in item
        ? item.materialName
        : `Rod ${item.diameter} (${item.brand || 'Steel'})`;
    setPaymentModalData({
      isOpen: true,
      relatedRecordId: item.id,
      tableName,
      title,
      subtitle: `Supplier: ${item.supplier}`,
      module: tableName === 'materials' ? 'Material' : 'Steel Rod',
      totalAmount: item.totalAmount,
    });
  };

  // Convert current filtered materials to InteractiveHoverItems
  const currentFilteredMaterials = activeCategory === 'legacy'
    ? legacyItems
    : materials.filter(m => m.category === activeCategory);

  const materialCards: InteractiveHoverItem[] = currentFilteredMaterials.map(mat => {
    const vis = getMaterialVisual(mat.category, mat.brand, mat.imageUrl);
    return {
      id: mat.id,
      title: mat.materialName,
      description: mat.supplier || 'Site Store',
      imageUrl: mat.imageUrl || vis.imageUrl,
      imageAlt: mat.materialName,
      fallbackCategory: (mat.category as any) || 'material',
      badge: mat.category.toUpperCase(),
      badgeVariant:
        mat.category === 'cement'
          ? 'danger'
          : mat.category === 'bricks'
          ? 'warning'
          : 'primary',
      stats: [
        { label: 'Quantity', value: `${mat.quantity.toLocaleString('en-IN')} ${mat.unit}` },
        { label: 'Unit price', value: `₹${mat.rate.toLocaleString('en-IN')} / ${mat.unit}` },
        { label: 'Total amount', value: `₹${mat.totalAmount.toLocaleString('en-IN')}` },
        {
          label: 'Paid Amount',
          value: `₹${mat.paidAmount.toLocaleString('en-IN')}`,
          color: 'var(--color-success-text)',
        },
        {
          label: 'Balance Due',
          value: `₹${mat.balance.toLocaleString('en-IN')}`,
          color: mat.balance > 0 ? 'var(--color-danger-text)' : 'var(--color-text-muted)',
        },
        {
          label: 'Extra Paid',
          value: `₹${(mat.extraPaid || 0).toLocaleString('en-IN')}`,
          color: (mat.extraPaid || 0) > 0 ? 'var(--color-primary-text)' : 'var(--color-text-muted)',
        },
      ],
      onClick: () => setSelectedMaterial(mat),
    };
  });

  // Convert rod entries to individual diameter cards
  const rodCards: InteractiveHoverItem[] = rodEntries.map(rod => {
    const vis = getRodVisual(rod.diameter, rod.imageUrl);
    return {
      id: rod.id,
      title: `Rod ${rod.diameter}`,
      description: `${rod.brand || 'Fe550D TMT'} • ${rod.weightKg.toLocaleString('en-IN')} kg • ${rod.supplier}`,
      imageUrl: rod.imageUrl || vis.imageUrl,
      imageAlt: `TMT Rod ${rod.diameter}`,
      fallbackCategory: 'rod',
      badge: `${rod.diameter} • ${rod.weightKg} kg`,
      badgeVariant: 'info',
      stats: [
        { label: 'Total Cost', value: `₹${rod.totalAmount.toLocaleString('en-IN')}` },
        {
          label: 'Paid Amount',
          value: `₹${rod.paidAmount.toLocaleString('en-IN')}`,
          color: '#34d399',
        },
        {
          label: 'Balance Due',
          value: `₹${rod.balance.toLocaleString('en-IN')}`,
          color: rod.balance > 0 ? '#f87171' : '#94a3b8',
        },
        {
          label: 'Rate / kg',
          value: `₹${rod.ratePerKg}`,
          color: '#fbbf24',
        },
      ],
      onClick: () => setSelectedRod(rod),
    };
  });

  // Material Detail Fields preparation
  const materialDetailFields: DetailField[] = selectedMaterial
    ? [
        {
          label: 'Material Name',
          value: selectedMaterial.materialName,
          highlight: true,
        },
        {
          label: 'Brand / Quality',
          value: selectedMaterial.brand || 'Standard Quality',
        },
        {
          label: 'Type / Category',
          value: selectedMaterial.category.toUpperCase(),
        },
        {
          label: 'Quantity & Unit',
          value: `${selectedMaterial.quantity} ${selectedMaterial.unit}`,
          icon: <Hash size={14} className="text-emerald-400" />,
        },
        {
          label: 'Rate per Unit',
          value: `₹${selectedMaterial.rate.toLocaleString('en-IN')} / ${selectedMaterial.unit}`,
        },
        {
          label: 'Supplier / Quarry / Agency',
          value: selectedMaterial.supplier || 'Site Store',
          icon: <Building size={14} style={{ color: 'var(--color-charcoal)' }} />,
        },
        {
          label: 'Purchase Date',
          value: selectedMaterial.purchaseDate || 'N/A',
          icon: <Calendar size={14} style={{ color: 'var(--color-primary)' }} />,
        },
        {
          label: 'Invoice / DC Number',
          value: selectedMaterial.invoiceNumber || 'No invoice number attached',
          icon: <Tag size={14} style={{ color: 'var(--color-warning)' }} />,
        },
        {
          label: 'Delivery Notes',
          value: selectedMaterial.notes || 'No special notes recorded.',
        },
      ]
    : [];

  // Rod Detail Fields preparation
  const rodDetailFields: DetailField[] = selectedRod
    ? [
        {
          label: 'Rebar Diameter',
          value: selectedRod.diameter,
          highlight: true,
        },
        {
          label: 'Weight (KG)',
          value: `${selectedRod.weightKg.toLocaleString('en-IN')} kg (${(selectedRod.weightKg / 1000).toFixed(2)} Tons)`,
          icon: <Hash size={14} style={{ color: 'var(--color-success)' }} />,
        },
        {
          label: 'Rate per KG',
          value: `₹${selectedRod.ratePerKg} / kg`,
        },
        {
          label: 'Brand & Grade',
          value: `${selectedRod.brand || 'TMT Rebar'} (Fe550D High Tensile)`,
        },
        {
          label: 'Supplier / Steel Depot',
          value: selectedRod.supplier || 'Steel Stockist',
          icon: <Building size={14} style={{ color: 'var(--color-charcoal)' }} />,
        },
        {
          label: 'Quantity (Pieces/Bundles)',
          value: selectedRod.quantityPieces ? `${selectedRod.quantityPieces} Pieces` : selectedRod.unit,
        },
        {
          label: 'Purchase Date',
          value: selectedRod.purchaseDate || 'N/A',
          icon: <Calendar size={14} style={{ color: 'var(--color-primary)' }} />,
        },
        {
          label: 'Invoice Number',
          value: selectedRod.invoiceNumber || 'N/A',
          icon: <Tag size={14} style={{ color: 'var(--color-warning)' }} />,
        },
        {
          label: 'Notes & Structural Usage',
          value: selectedRod.notes || 'Reinforcement rebar logged for site.',
        },
      ]
    : [];

  return (
    <div className="space-y-6">
      {/* Top Interactive Material Category Navigation Cards */}
      <div className="material-category-cards">
        <div
          className={`mat-cat-card ${activeCategory === 'sand' ? 'active' : ''}`}
          onClick={() => setActiveCategory('sand')}
        >
          <div className="mat-cat-icon-wrapper">
            <span style={{ fontSize: '1.6rem' }}>⏳</span>
          </div>
          <span className="mat-cat-title">Sand</span>
          <span className="mat-cat-stat">
            {sandItems.length} Entries • ₹{sandTotal.toLocaleString('en-IN')}
          </span>
        </div>

        <div
          className={`mat-cat-card ${activeCategory === 'msand' ? 'active' : ''}`}
          onClick={() => setActiveCategory('msand')}
        >
          <div className="mat-cat-icon-wrapper">
            <span style={{ fontSize: '1.6rem' }}>🏗️</span>
          </div>
          <span className="mat-cat-title">M-Sand</span>
          <span className="mat-cat-stat">
            {msandItems.length} Entries • ₹{msandTotal.toLocaleString('en-IN')}
          </span>
        </div>

        <div
          className={`mat-cat-card ${activeCategory === 'cement' ? 'active' : ''}`}
          onClick={() => setActiveCategory('cement')}
        >
          <div className="mat-cat-icon-wrapper">
            <span style={{ fontSize: '1.6rem' }}>📦</span>
          </div>
          <span className="mat-cat-title">Cement</span>
          <span className="mat-cat-stat">
            {cementItems.length} Entries • ₹{cementTotal.toLocaleString('en-IN')}
          </span>
        </div>

        <div
          className={`mat-cat-card ${activeCategory === 'rod' ? 'active' : ''}`}
          onClick={() => setActiveCategory('rod')}
        >
          <div className="mat-cat-icon-wrapper">
            <span style={{ fontSize: '1.6rem' }}>📏</span>
          </div>
          <span className="mat-cat-title">Steel Rods</span>
          <span className="mat-cat-stat">
            {rodEntries.length} Entries • {totalSteelWeightKg.toLocaleString('en-IN')} kg
          </span>
        </div>

        <div
          className={`mat-cat-card ${activeCategory === 'bricks' ? 'active' : ''}`}
          onClick={() => setActiveCategory('bricks')}
        >
          <div className="mat-cat-icon-wrapper">
            <span style={{ fontSize: '1.6rem' }}>🧱</span>
          </div>
          <span className="mat-cat-title">Bricks</span>
          <span className="mat-cat-stat">
            {brickItems.length} Entries • ₹{brickTotal.toLocaleString('en-IN')}
          </span>
        </div>

      </div>
      {legacyItems.length > 0 && (
        <button
          type="button"
          className="btn btn-sm btn-outline"
          aria-pressed={activeCategory === 'legacy'}
          onClick={() => setActiveCategory(activeCategory === 'legacy' ? 'sand' : 'legacy')}
        >
          View legacy materials ({legacyItems.length})
        </button>
      )}

      {/* ROD INDIVIDUAL DIAMETERS GALLERY (Do NOT combine diameters!) */}
      {activeCategory === 'rod' && (
        <div
          style={{
            borderRadius: '16px',
            background: 'var(--color-surface)',
            padding: '20px',
            border: '1px solid var(--color-border)',
            boxShadow: 'var(--shadow-sm)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
            <div>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-charcoal)', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                <Disc size={18} style={{ color: 'var(--color-primary)' }} />
                TMT Steel Rod Individual Diameters (6mm – 25mm)
              </h4>
              <p style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', margin: '4px 0 0' }}>
                Each diameter maintains its dedicated rebar visual, weight, rate, and separate payment ledger.
              </p>
            </div>
            <span
              style={{
                padding: '4px 12px',
                borderRadius: '999px',
                fontSize: '0.82rem',
                fontWeight: 700,
                background: 'var(--color-primary-soft)',
                color: 'var(--color-primary-text)',
                border: '1px solid var(--color-primary-border)',
              }}
            >
              Total Steel: {totalSteelWeightKg.toLocaleString('en-IN')} kg (≈ {(totalSteelWeightKg / 1000).toFixed(2)} Tons)
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: '10px' }}>
            {ROD_STANDARD_DIAMETERS.map(diam => {
              const vis = getRodVisual(diam);
              const hasEntry = rodSummaryByDiameter[diam];

              return (
                <button
                  key={diam}
                  type="button"
                  onClick={() => {
                    const found = rodEntries.find(r => r.diameter === diam);
                    if (found) {
                      setSelectedRod(found);
                    } else {
                      setSelectedDiameterCatalog(diam);
                    }
                  }}
                  style={{
                    position: 'relative',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: '44px',
                    padding: '12px',
                    borderRadius: '12px',
                    background: hasEntry ? 'var(--color-primary-soft)' : 'var(--color-bg)',
                    border: hasEntry ? '1.5px solid var(--color-primary-border)' : '1px solid var(--color-border)',
                    transition: 'all 0.2s ease',
                    textAlign: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <SafeImage
                    src={vis.imageUrl}
                    alt={diam}
                    fallbackCategory="rod"
                    style={{ width: '48px', height: '40px', objectFit: 'contain' }}
                  />
                  <span style={{ fontSize: '0.84rem', fontWeight: 800, color: 'var(--color-charcoal)', marginTop: '6px' }}>
                    {diam}
                  </span>
                  {hasEntry ? (
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-success-text)', marginTop: '2px' }}>
                      {hasEntry.weightKg} kg
                    </span>
                  ) : (
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>Click to view</span>
                  )}
                  {hasEntry && (
                    <span
                      style={{
                        position: 'absolute',
                        top: '6px',
                        right: '6px',
                        width: '8px',
                        height: '8px',
                        borderRadius: '999px',
                        background: 'var(--color-primary)',
                      }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Action and View Toggle Header */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          background: 'var(--color-surface)',
          padding: '12px 16px',
          borderRadius: '14px',
          border: '1px solid var(--color-border)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--color-charcoal)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
            {activeCategory === 'legacy' ? 'Legacy Material Records' : `${activeCategory.toUpperCase()} Purchases`}
          </span>
          <span className="text-xs text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full">
            {activeCategory === 'rod'
              ? `${rodEntries.length} entries`
              : `${currentFilteredMaterials.length} entries`}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="flex rounded-xl bg-slate-950 p-1 border border-slate-800">
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                viewMode === 'cards'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <LayoutGrid size={14} />
              Visual Cards
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                viewMode === 'table'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <TableIcon size={14} />
              Data Table
            </button>
          </div>

          {activeCategory === 'rod' ? (
            <button className="btn btn-sm btn-primary" onClick={() => onOpenRodModal()}>
              <PlusCircle size={15} />
              <span>Add Steel / Rod Entry</span>
            </button>
          ) : activeCategory === 'legacy' ? (
            <span className="text-xs text-slate-400">
              Existing records are preserved. Add new purchases in one of the five categories.
            </span>
          ) : (
            <button
              className="btn btn-sm btn-primary"
              onClick={() => onOpenMaterialModal(activeCategory as MaterialCategory)}
            >
              <PlusCircle size={15} />
              <span>Add {activeCategory.toUpperCase()}</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area: Cards vs Table */}
      {viewMode === 'cards' ? (
        activeCategory === 'rod' ? (
          rodCards.length === 0 ? (
            <div className="table-container p-8 text-center text-slate-400 space-y-3">
              <p>No steel rod purchases recorded yet. Click "Add Steel / Rod Entry" to log TMT reinforcement.</p>
              <button className="btn btn-sm btn-primary" onClick={() => onOpenRodModal()}>
                <PlusCircle size={15} />
                <span>Add Steel Rebar</span>
              </button>
            </div>
          ) : (
            <div className="interactive-card-grid">
              {rodCards.map(item => (
                <InteractiveHoverCard key={item.id} item={item} />
              ))}
            </div>
          )
        ) : materialCards.length === 0 ? (
          <div className="table-container p-8 text-center text-slate-400 space-y-3">
            <p>No {activeCategory} purchases recorded yet.</p>
            <button
              className="btn btn-sm btn-primary"
              onClick={() => onOpenMaterialModal(activeCategory === 'legacy' ? 'other' : activeCategory as MaterialCategory)}
            >
              <PlusCircle size={15} />
              <span>{activeCategory === 'legacy' ? 'Add material' : `Add ${activeCategory.toUpperCase()}`}</span>
            </button>
          </div>
        ) : (
          <div className="interactive-card-grid">
            {materialCards.map(item => (
              <InteractiveHoverCard key={item.id} item={item} />
            ))}
          </div>
        )
      ) : (
        /* Table View */
        <div className="space-y-6">
          {activeCategory !== 'rod' && (
            <div className="table-container">
              <div className="data-table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Visual</th>
                      <th>Date</th>
                      <th>Category</th>
                      <th>Material / Brand</th>
                      <th>Supplier</th>
                      <th>Quantity & Unit</th>
                      <th>Rate</th>
                      <th>Total Amount</th>
                      <th>Paid Amount</th>
                      <th>Balance Due</th>
                      <th>Extra Paid</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentFilteredMaterials.map(mat => {
                      const vis = getMaterialVisual(mat.category, mat.brand, mat.imageUrl);
                      return (
                        <tr
                          key={mat.id}
                          onClick={() => setSelectedMaterial(mat)}
                          className="cursor-pointer hover:bg-slate-800/40 transition-colors"
                        >
                          <td style={{ width: '45px' }}>
                            <SafeImage
                              src={mat.imageUrl || vis.imageUrl}
                              alt={mat.materialName}
                              fallbackCategory={(mat.category as any) || 'material'}
                              style={{
                                width: '36px',
                                height: '36px',
                                objectFit: 'cover',
                                borderRadius: '6px',
                              }}
                            />
                          </td>
                          <td style={{ whiteSpace: 'nowrap' }}>{mat.purchaseDate}</td>
                          <td>
                            <span className="badge badge-planning" style={{ fontSize: '0.72rem' }}>
                              {mat.category.toUpperCase()}
                            </span>
                          </td>
                          <td>
                            <strong>{mat.materialName}</strong>
                            {mat.invoiceNumber && (
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                Inv: {mat.invoiceNumber}
                              </div>
                            )}
                          </td>
                          <td>{mat.supplier}</td>
                          <td>
                            <strong>{mat.quantity}</strong> {mat.unit}
                          </td>
                          <td>₹{mat.rate.toLocaleString('en-IN')}</td>
                          <td>
                            <strong style={{ fontFamily: 'var(--font-heading)' }}>
                              ₹{mat.totalAmount.toLocaleString('en-IN')}
                            </strong>
                          </td>
                          <td style={{ color: 'var(--success)', fontWeight: 600 }}>
                            ₹{mat.paidAmount.toLocaleString('en-IN')}
                          </td>
                          <td>
                            <span
                              style={{
                                fontWeight: 700,
                                color: mat.balance > 0 ? 'var(--danger)' : 'var(--success)',
                              }}
                            >
                              ₹{mat.balance.toLocaleString('en-IN')}
                            </span>
                          </td>
                          <td>
                            {mat.extraPaid > 0 ? (
                              <span
                                className="badge"
                                style={{
                                  backgroundColor: 'var(--color-primary-soft)',
                                  color: 'var(--color-primary-text)',
                                  border: '1px solid var(--color-primary-border)',
                                  fontWeight: 700,
                                }}
                              >
                                +₹{mat.extraPaid.toLocaleString('en-IN')}
                              </span>
                            ) : (
                              <span style={{ color: 'var(--text-muted)' }}>₹0</span>
                            )}
                          </td>
                          <td onClick={e => e.stopPropagation()}>
                            <div style={{ display: 'flex', gap: '4px' }}>
                              <button
                                className="btn btn-sm btn-outline"
                                title="Payment History"
                                onClick={() => handleOpenPaymentHistory(mat, 'materials')}
                                style={{ padding: '4px 8px', color: 'var(--primary)' }}
                              >
                                <Receipt size={14} />
                                <span style={{ fontSize: '0.75rem', marginLeft: '4px' }}>Payments</span>
                              </button>
                              <button
                                className="btn btn-sm btn-outline"
                                title="Edit Record"
                                onClick={() => onOpenMaterialModal(mat.category, mat)}
                              >
                                <Edit2 size={14} />
                              </button>
                              <button
                                className="btn btn-sm btn-danger"
                                title="Move to Recycle Bin"
                                onClick={() => onDeleteMaterial(mat)}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Rod Entries Table */}
          {activeCategory === 'rod' && (
            <div className="table-container">
              <div className="table-header-bar">
                <span
                  style={{
                    fontWeight: 700,
                    fontSize: '0.95rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <Disc size={18} color="var(--primary)" />
                  Steel / Rod Log ({rodEntries.length} records)
                </span>
              </div>
              <div className="data-table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Visual</th>
                      <th>Date</th>
                      <th>Diameter</th>
                      <th>Brand</th>
                      <th>Supplier</th>
                      <th>Weight (kg)</th>
                      <th>Rate / kg</th>
                      <th>Total Amount</th>
                      <th>Paid Amount</th>
                      <th>Balance Due</th>
                      <th>Extra Paid</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rodEntries.map(rod => {
                      const vis = getRodVisual(rod.diameter, rod.imageUrl);
                      return (
                        <tr
                          key={rod.id}
                          onClick={() => setSelectedRod(rod)}
                          className="cursor-pointer hover:bg-slate-800/40 transition-colors"
                        >
                          <td style={{ width: '45px' }}>
                            <SafeImage
                              src={rod.imageUrl || vis.imageUrl}
                              alt={rod.diameter}
                              fallbackCategory="rod"
                              style={{
                                width: '36px',
                                height: '36px',
                                objectFit: 'cover',
                                borderRadius: '6px',
                              }}
                            />
                          </td>
                          <td style={{ whiteSpace: 'nowrap' }}>{rod.purchaseDate}</td>
                          <td>
                            <span
                              className="badge badge-demo"
                              style={{ fontSize: '0.8rem', fontWeight: 800 }}
                            >
                              {rod.diameter}
                            </span>
                          </td>
                          <td>{rod.brand || 'TMT Steel'}</td>
                          <td>{rod.supplier}</td>
                          <td>
                            <strong style={{ fontSize: '1rem' }}>
                              {rod.weightKg.toLocaleString('en-IN')}
                            </strong>{' '}
                            kg
                          </td>
                          <td>₹{rod.ratePerKg}/kg</td>
                          <td>
                            <strong style={{ fontFamily: 'var(--font-heading)' }}>
                              ₹{rod.totalAmount.toLocaleString('en-IN')}
                            </strong>
                          </td>
                          <td style={{ color: 'var(--success)', fontWeight: 600 }}>
                            ₹{rod.paidAmount.toLocaleString('en-IN')}
                          </td>
                          <td>
                            <span
                              style={{
                                fontWeight: 700,
                                color: rod.balance > 0 ? 'var(--danger)' : 'var(--success)',
                              }}
                            >
                              ₹{rod.balance.toLocaleString('en-IN')}
                            </span>
                          </td>
                          <td>
                            {rod.extraPaid > 0 ? (
                              <span
                                className="badge"
                                style={{
                                  backgroundColor: 'var(--color-primary-soft)',
                                  color: 'var(--color-primary-text)',
                                  border: '1px solid var(--color-primary-border)',
                                  fontWeight: 700,
                                }}
                              >
                                +₹{rod.extraPaid.toLocaleString('en-IN')}
                              </span>
                            ) : (
                              <span style={{ color: 'var(--text-muted)' }}>₹0</span>
                            )}
                          </td>
                          <td onClick={e => e.stopPropagation()}>
                            <div style={{ display: 'flex', gap: '4px' }}>
                              <button
                                className="btn btn-sm btn-outline"
                                title="Payment History"
                                onClick={() => handleOpenPaymentHistory(rod, 'rodEntries')}
                                style={{ padding: '4px 8px', color: 'var(--primary)' }}
                              >
                                <Receipt size={14} />
                                <span style={{ fontSize: '0.75rem', marginLeft: '4px' }}>Payments</span>
                              </button>
                              <button
                                className="btn btn-sm btn-outline"
                                title="Edit Record"
                                onClick={() => onOpenRodModal(rod)}
                              >
                                <Edit2 size={14} />
                              </button>
                              <button
                                className="btn btn-sm btn-danger"
                                title="Move to Recycle Bin"
                                onClick={() => onDeleteRod(rod)}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Material Details Modal (Sand, M-Sand, Cement, Bricks, Aggregate, Other) */}
      {selectedMaterial && (() => {
        const vis = getMaterialVisual(
          selectedMaterial.category,
          selectedMaterial.brand,
          selectedMaterial.imageUrl
        );
        return (
          <ItemDetailsModal
            isOpen={!!selectedMaterial}
            onClose={() => setSelectedMaterial(null)}
            title={selectedMaterial.materialName}
            subtitle={selectedMaterial.category.toUpperCase()}
            categoryBadge={`${selectedMaterial.quantity} ${selectedMaterial.unit}`}
            badgeVariant={
              selectedMaterial.category === 'cement'
                ? 'danger'
                : selectedMaterial.category === 'bricks'
                ? 'warning'
                : 'primary'
            }
            imageUrl={selectedMaterial.imageUrl || vis.imageUrl}
            imageAlt={selectedMaterial.materialName}
            details={materialDetailFields}
            financials={{
              totalAmount: selectedMaterial.totalAmount,
              paidAmount: selectedMaterial.paidAmount,
            }}
            onEdit={() => {
              const mat = selectedMaterial;
              setSelectedMaterial(null);
              onOpenMaterialModal(mat.category, mat);
            }}
            actions={[
              {
                label: 'Payment Ledger',
                icon: <Receipt size={14} />,
                onClick: () => {
                  const mat = selectedMaterial;
                  setSelectedMaterial(null);
                  handleOpenPaymentHistory(mat, 'materials');
                },
              },
            ]}
          />
        );
      })()}

      {/* Rod Details Modal (Individual Diameter View) */}
      {selectedRod && (() => {
        const vis = getRodVisual(selectedRod.diameter, selectedRod.imageUrl);
        return (
          <ItemDetailsModal
            isOpen={!!selectedRod}
            onClose={() => setSelectedRod(null)}
            title={`TMT Steel Rebar (${selectedRod.diameter})`}
            subtitle={`${selectedRod.brand || 'Fe550D TMT'} • ${selectedRod.diameter}`}
            categoryBadge={`DIA ${selectedRod.diameter} • ${selectedRod.weightKg.toLocaleString('en-IN')} kg`}
            badgeVariant="info"
            imageUrl={selectedRod.imageUrl || vis.imageUrl}
            imageAlt={`Rod ${selectedRod.diameter}`}
            details={rodDetailFields}
            financials={{
              totalAmount: selectedRod.totalAmount,
              paidAmount: selectedRod.paidAmount,
            }}
            onEdit={() => {
              const rod = selectedRod;
              setSelectedRod(null);
              onOpenRodModal(rod);
            }}
            actions={[
              {
                label: 'Payment Ledger',
                icon: <Receipt size={14} />,
                onClick: () => {
                  const rod = selectedRod;
                  setSelectedRod(null);
                  handleOpenPaymentHistory(rod, 'rodEntries');
                },
              },
            ]}
          />
        );
      })()}

      {/* Catalog Diameter Details Modal (when user clicks an unlogged diameter) */}
      {selectedDiameterCatalog && (() => {
        const vis = getRodVisual(selectedDiameterCatalog);
        return (
          <ItemDetailsModal
            isOpen={!!selectedDiameterCatalog}
            onClose={() => setSelectedDiameterCatalog(null)}
            title={`TMT Steel ${selectedDiameterCatalog}`}
            subtitle={vis.description}
            categoryBadge={`Standard Diameter: ${selectedDiameterCatalog}`}
            badgeVariant="info"
            imageUrl={vis.imageUrl}
            imageAlt={`Steel ${selectedDiameterCatalog}`}
            details={[
              {
                label: 'Diameter Size',
                value: selectedDiameterCatalog,
                highlight: true,
              },
              {
                label: 'Structural Application',
                value: vis.description,
              },
              {
                label: 'Standard Grade',
                value: 'Fe500D / Fe550D High Ductility Rebar',
              },
              {
                label: 'Unit of Measurement',
                value: 'KG / Tons / Bundles',
              },
            ]}
            actions={[
              {
                label: `Add ${selectedDiameterCatalog} Entry`,
                icon: <PlusCircle size={14} />,
                variant: 'amber',
                onClick: () => {
                  const dia = selectedDiameterCatalog;
                  setSelectedDiameterCatalog(null);
                  onOpenRodModal({
                    id: '',
                    siteId,
                    diameter: dia,
                    weightKg: 500,
                    ratePerKg: 72,
                    totalAmount: 36000,
                    paidAmount: 0,
                    balance: 36000,
                    extraPaid: 0,
                    supplier: 'Steel Depot',
                    unit: 'kg',
                    purchaseDate: todayKey(),
                    isDeleted: false,
                    createdAt: '',
                    updatedAt: '',
                  });
                },
              },
            ]}
          />
        );
      })()}

      {/* Universal Payment History & Installment Modal */}
      <PaymentHistoryModal
        isOpen={paymentModalData.isOpen}
        onClose={() => setPaymentModalData(prev => ({ ...prev, isOpen: false }))}
        siteId={siteId}
        relatedRecordId={paymentModalData.relatedRecordId}
        tableName={paymentModalData.tableName}
        title={paymentModalData.title}
        subtitle={paymentModalData.subtitle}
        module={paymentModalData.module}
        totalAmount={paymentModalData.totalAmount}
      />
    </div>
  );
};
