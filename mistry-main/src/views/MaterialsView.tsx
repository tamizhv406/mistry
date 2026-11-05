import React, { useState, useMemo } from 'react';
import {
  Layers,
  Search,
  PlusCircle,
  ArrowDownCircle,
  ArrowUpCircle,
  ArrowRightLeft,
  Filter,
  FileText,
  Building2,
  Calendar,
  AlertTriangle,
  Package,
  TrendingDown,
  TrendingUp,
  Receipt,
  RotateCcw,
  SlidersHorizontal,
  ChevronDown,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  CheckCircle,
} from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import type { Material, MaterialCategory, RodEntry, Site, StockMovement, User } from '../db/types';
import { buildStock, calculateStockValue, stockItemKey, type StockItem, type StockLine } from '../domain/stock';
import { MATERIAL_GROUPS, materialGroupId } from '../domain/catalog';
import { formatDay, todayKey } from '../utils/datetime';
import { formatINR, formatQty, roundMoney } from '../utils/money';
import { RecordPurchaseModal } from '../components/RecordPurchaseModal';
import { StockOperationModal } from '../components/StockOperationModal';

export interface MaterialsViewProps {
  user: User;
  sites: Site[];
  initialSiteId?: string | null;
  onNavigateSiteDetail?: (siteId: string, tab: string) => void;
  onNotify: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const MaterialsView: React.FC<MaterialsViewProps> = ({
  user,
  sites,
  initialSiteId,
  onNavigateSiteDetail,
  onNotify,
}) => {
  // Active Project Selection (All Sites vs Specific Site)
  const [selectedSiteId, setSelectedSiteId] = useState<string>(initialSiteId || (sites[0]?.id || 'all'));

  // Filtering & View state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedShelf, setSelectedShelf] = useState<string>('all');
  const [stockStatusFilter, setStockStatusFilter] = useState<'all' | 'low' | 'out' | 'in'>('all');
  const [activeTab, setActiveTab] = useState<'inventory' | 'purchases' | 'movements'>('inventory');

  // Modals state
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
  const [materialToEdit, setMaterialToEdit] = useState<Material | null>(null);
  const [rodToEdit, setRodToEdit] = useState<RodEntry | null>(null);

  const [isStockOpModalOpen, setIsStockOpModalOpen] = useState(false);
  const [stockOpItem, setStockOpItem] = useState<StockItem | null>(null);
  const [stockOpMode, setStockOpMode] = useState<'usage' | 'opening' | 'return' | 'adjust_in' | 'adjust_out' | 'transfer'>('usage');

  // Live queries for active data
  const materialsQuery = useLiveQuery(async () => {
    if (selectedSiteId === 'all') {
      return await db.materials.filter(m => !m.isDeleted).toArray();
    }
    return await db.materials.where('siteId').equals(selectedSiteId).filter(m => !m.isDeleted).toArray();
  }, [selectedSiteId]);

  const rodEntriesQuery = useLiveQuery(async () => {
    if (selectedSiteId === 'all') {
      return await db.rodEntries.filter(r => !r.isDeleted).toArray();
    }
    return await db.rodEntries.where('siteId').equals(selectedSiteId).filter(r => !r.isDeleted).toArray();
  }, [selectedSiteId]);

  const stockMovementsQuery = useLiveQuery(async () => {
    if (selectedSiteId === 'all') {
      return await db.stockMovements.filter(m => !m.isDeleted).toArray();
    }
    return await db.stockMovements.where('siteId').equals(selectedSiteId).filter(m => !m.isDeleted).toArray();
  }, [selectedSiteId]);

  const catalogQuery = useLiveQuery(async () => {
    return await db.catalogItems.filter(c => !c.isDeleted && c.kind !== 'tool').toArray();
  }, []);

  const materials = materialsQuery || [];
  const rodEntries = rodEntriesQuery || [];
  const movements = stockMovementsQuery || [];
  const catalog = catalogQuery || [];

  // Compute live multi-site or single-site Stock Items
  const stockItems: StockItem[] = useMemo(() => {
    return buildStock(materials, rodEntries, movements, catalog);
  }, [materials, rodEntries, movements, catalog]);

  // Compute Analytics Metrics
  const metrics = useMemo(() => {
    const stockVal = calculateStockValue(materials, rodEntries);
    let lowStockCount = 0;
    let outOfStockCount = 0;

    stockItems.forEach(s => {
      if (s.onHand <= 0) {
        outOfStockCount++;
      } else if (s.onHand < 20) {
        // Threshold check for standard inventory
        lowStockCount++;
      }
    });

    return {
      totalMaterialsCount: stockItems.length,
      totalStockValue: stockVal.totalStockValue,
      pendingPurchasesValue: stockVal.pendingPurchasesValue,
      lowStockCount,
      outOfStockCount,
    };
  }, [materials, rodEntries, stockItems]);

  // Filtered Stock Items
  const filteredStock = useMemo(() => {
    return stockItems.filter(item => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = item.name.toLowerCase().includes(q);
        const matchesCat = item.category.toLowerCase().includes(q);
        if (!matchesName && !matchesCat) return false;
      }
      // Shelf
      if (selectedShelf !== 'all') {
        const itemShelf = materialGroupId(item.category);
        if (itemShelf !== selectedShelf) return false;
      }
      // Stock Status
      if (stockStatusFilter === 'out' && item.onHand > 0) return false;
      if (stockStatusFilter === 'low' && (item.onHand <= 0 || item.onHand >= 20)) return false;
      if (stockStatusFilter === 'in' && item.onHand <= 0) return false;

      return true;
    });
  }, [stockItems, searchQuery, selectedShelf, stockStatusFilter]);

  // Filtered Purchases list
  const combinedPurchases = useMemo(() => {
    const list: Array<{
      id: string;
      kind: 'material' | 'rod';
      date: string;
      name: string;
      category: string;
      siteId: string;
      supplier: string;
      quantity: string;
      totalAmount: number;
      paidAmount: number;
      balance: number;
      invoiceNumber?: string;
    }> = [];

    materials.forEach(m => {
      list.push({
        id: m.id,
        kind: 'material',
        date: m.purchaseDate || m.createdAt.slice(0, 10),
        name: m.materialName,
        category: m.category,
        siteId: m.siteId,
        supplier: m.supplier || 'Vendor',
        quantity: `${m.quantity} ${m.unit}`,
        totalAmount: m.totalAmount,
        paidAmount: m.paidAmount,
        balance: m.balance,
        invoiceNumber: m.invoiceNumber,
      });
    });

    rodEntries.forEach(r => {
      list.push({
        id: r.id,
        kind: 'rod',
        date: r.purchaseDate || r.createdAt.slice(0, 10),
        name: `${r.brand || 'TMT'} Steel (${r.diameter})`,
        category: 'rod',
        siteId: r.siteId,
        supplier: r.supplier || 'Steel Mill',
        quantity: `${r.weightKg} kg`,
        totalAmount: r.totalAmount,
        paidAmount: r.paidAmount,
        balance: r.balance,
        invoiceNumber: r.invoiceNumber,
      });
    });

    return list.sort((a, b) => b.date.localeCompare(a.date));
  }, [materials, rodEntries]);

  // Quick Action Handlers
  const handleOpenStockOut = (item?: StockItem) => {
    setStockOpItem(item || null);
    setStockOpMode('usage');
    setIsStockOpModalOpen(true);
  };

  const handleOpenTransfer = (item?: StockItem) => {
    setStockOpItem(item || null);
    setStockOpMode('transfer');
    setIsStockOpModalOpen(true);
  };

  const handleExportPDF = () => {
    window.print();
  };

  const activeSiteObj = sites.find(s => s.id === selectedSiteId);

  return (
    <div style={{ padding: '24px', maxWidth: '1440px', margin: '0 auto', color: '#0F172A' }}>
      {/* Top Header & Actions */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          marginBottom: '24px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                backgroundColor: '#EFF6FF',
                color: '#2563EB',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Layers size={22} />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.02em' }}>
                Materials & Inventory Management
              </h1>
              <p style={{ margin: 0, fontSize: '0.875rem', color: '#64748B' }}>
                Track live construction material stock, purchases, usage consumption and site-to-site transfers.
              </p>
            </div>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <button
            onClick={handleExportPDF}
            style={{
              padding: '9px 16px',
              borderRadius: '8px',
              border: '1px solid #CBD5E1',
              backgroundColor: '#FFFFFF',
              color: '#334155',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
            }}
          >
            <FileText size={16} />
            <span>Export Stock PDF</span>
          </button>

          <button
            onClick={() => handleOpenStockOut()}
            style={{
              padding: '9px 16px',
              borderRadius: '8px',
              border: '1px solid #CBD5E1',
              backgroundColor: '#FFFFFF',
              color: '#334155',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
            }}
          >
            <ArrowDownCircle size={16} color="#DC2626" />
            <span>Record Usage</span>
          </button>

          <button
            onClick={() => {
              setMaterialToEdit(null);
              setRodToEdit(null);
              setIsPurchaseModalOpen(true);
            }}
            style={{
              padding: '9px 20px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: '#2563EB',
              color: '#FFFFFF',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.25)',
            }}
          >
            <PlusCircle size={18} />
            <span>+ Record Purchase</span>
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: '16px',
          marginBottom: '24px',
        }}
      >
        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            border: '1px solid #E2E8F0',
            padding: '18px 20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748B' }}>TOTAL MATERIALS</span>
            <Package size={18} color="#2563EB" />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0F172A' }}>{metrics.totalMaterialsCount}</div>
          <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '4px' }}>Active item catalog entries</div>
        </div>

        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            border: '1px solid #E2E8F0',
            padding: '18px 20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748B' }}>TOTAL STOCK VALUE</span>
            <TrendingUp size={18} color="#16A34A" />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#16A34A' }}>{formatINR(metrics.totalStockValue)}</div>
          <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '4px' }}>Cumulative purchase ledger</div>
        </div>

        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            border: '1px solid #E2E8F0',
            padding: '18px 20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748B' }}>LOW STOCK ALERT</span>
            <AlertTriangle size={18} color="#F59E0B" />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: metrics.lowStockCount > 0 ? '#D97706' : '#0F172A' }}>
            {metrics.lowStockCount}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '4px' }}>Items approaching minimum buffer</div>
        </div>

        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            border: '1px solid #E2E8F0',
            padding: '18px 20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748B' }}>OUT OF STOCK</span>
            <TrendingDown size={18} color="#DC2626" />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: metrics.outOfStockCount > 0 ? '#DC2626' : '#0F172A' }}>
            {metrics.outOfStockCount}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '4px' }}>0 quantity on hand</div>
        </div>

        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            border: '1px solid #E2E8F0',
            padding: '18px 20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748B' }}>PENDING PURCHASES</span>
            <Receipt size={18} color="#7C3AED" />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#7C3AED' }}>
            {formatINR(metrics.pendingPurchasesValue)}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '4px' }}>Unpaid supplier balance</div>
        </div>
      </div>

      {/* Control Bar: Project Filter, Search, Shelf Filter, and Tabs */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '12px',
          border: '1px solid #E2E8F0',
          padding: '16px 20px',
          marginBottom: '20px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
        }}
      >
        {/* Project & Search Inputs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', flex: 1 }}>
          <div style={{ minWidth: '180px' }}>
            <select
              value={selectedSiteId}
              onChange={e => setSelectedSiteId(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                fontSize: '0.875rem',
                backgroundColor: '#F8FAFC',
                fontWeight: 600,
                color: '#1E293B',
                outline: 'none',
              }}
            >
              <option value="all">All Projects (Combined)</option>
              {sites.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
            <Search
              size={16}
              style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }}
            />
            <input
              type="text"
              placeholder="Search materials by name or category..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px 9px 36px',
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                fontSize: '0.875rem',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ minWidth: '140px' }}>
            <select
              value={selectedShelf}
              onChange={e => setSelectedShelf(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                fontSize: '0.875rem',
                backgroundColor: '#FFFFFF',
                color: '#334155',
                outline: 'none',
              }}
            >
              <option value="all">All Categories</option>
              {MATERIAL_GROUPS.map(g => (
                <option key={g.id} value={g.id}>
                  {g.label}
                </option>
              ))}
            </select>
          </div>

          <div style={{ minWidth: '130px' }}>
            <select
              value={stockStatusFilter}
              onChange={e => setStockStatusFilter(e.target.value as any)}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                fontSize: '0.875rem',
                backgroundColor: '#FFFFFF',
                color: '#334155',
                outline: 'none',
              }}
            >
              <option value="all">All Status</option>
              <option value="in">In Stock Only</option>
              <option value="low">Low Stock Alert</option>
              <option value="out">Out of Stock</option>
            </select>
          </div>
        </div>

        {/* View Switcher Tabs */}
        <div style={{ display: 'flex', backgroundColor: '#F1F5F9', borderRadius: '8px', padding: '3px' }}>
          {[
            { id: 'inventory', label: 'Inventory Stock' },
            { id: 'purchases', label: 'Purchases History' },
            { id: 'movements', label: 'Movement Logs' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                padding: '7px 14px',
                borderRadius: '6px',
                border: 'none',
                fontSize: '0.825rem',
                fontWeight: 600,
                cursor: 'pointer',
                backgroundColor: activeTab === tab.id ? '#FFFFFF' : 'transparent',
                color: activeTab === tab.id ? '#0F172A' : '#64748B',
                boxShadow: activeTab === tab.id ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab 1: Live Inventory Stock Grid / Table */}
      {activeTab === 'inventory' && (
        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            border: '1px solid #E2E8F0',
            overflow: 'hidden',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}
        >
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  <th style={{ padding: '14px 18px', fontWeight: 700 }}>Material Name</th>
                  <th style={{ padding: '14px 18px', fontWeight: 700 }}>Category</th>
                  <th style={{ padding: '14px 18px', fontWeight: 700, textAlign: 'right' }}>Purchased</th>
                  <th style={{ padding: '14px 18px', fontWeight: 700, textAlign: 'right' }}>Consumed / Out</th>
                  <th style={{ padding: '14px 18px', fontWeight: 700, textAlign: 'right' }}>On Hand Stock</th>
                  <th style={{ padding: '14px 18px', fontWeight: 700, textAlign: 'center' }}>Status</th>
                  <th style={{ padding: '14px 18px', fontWeight: 700, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredStock.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: '48px 24px', textAlign: 'center', color: '#94A3B8' }}>
                      <Package size={36} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
                      <div style={{ fontSize: '1rem', fontWeight: 600, color: '#475569' }}>No material inventory records found</div>
                      <div style={{ fontSize: '0.825rem', marginTop: '4px' }}>
                        Click "+ Record Purchase" to enter stock purchases for this site.
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredStock.map(item => {
                    const isOut = item.onHand <= 0;
                    const isLow = !isOut && item.onHand < 20;

                    return (
                      <tr
                        key={item.key}
                        style={{
                          borderBottom: '1px solid #F1F5F9',
                          transition: 'background-color 0.15s ease',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#F8FAFC')}
                        onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                      >
                        <td style={{ padding: '14px 18px', fontWeight: 600, color: '#0F172A' }}>
                          <div>{item.name}</div>
                          <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 400 }}>Unit: {item.unit}</div>
                        </td>
                        <td style={{ padding: '14px 18px' }}>
                          <span
                            style={{
                              padding: '4px 8px',
                              borderRadius: '6px',
                              backgroundColor: '#EFF6FF',
                              color: '#1D4ED8',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              textTransform: 'capitalize',
                            }}
                          >
                            {item.category}
                          </span>
                        </td>
                        <td style={{ padding: '14px 18px', textAlign: 'right', color: '#334155' }}>
                          {formatQty(item.purchased)} {item.unit}
                        </td>
                        <td style={{ padding: '14px 18px', textAlign: 'right', color: '#DC2626' }}>
                          {formatQty(item.used + item.returned)} {item.unit}
                        </td>
                        <td style={{ padding: '14px 18px', textAlign: 'right', fontWeight: 700, fontSize: '0.95rem' }}>
                          <span style={{ color: isOut ? '#DC2626' : isLow ? '#D97706' : '#16A34A' }}>
                            {formatQty(item.onHand)} {item.unit}
                          </span>
                        </td>
                        <td style={{ padding: '14px 18px', textAlign: 'center' }}>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '4px 10px',
                              borderRadius: '999px',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              backgroundColor: isOut ? '#FEE2E2' : isLow ? '#FEF3C7' : '#DCFCE7',
                              color: isOut ? '#991B1B' : isLow ? '#92400E' : '#166534',
                            }}
                          >
                            {isOut ? 'Out of Stock' : isLow ? 'Low Stock' : 'Available'}
                          </span>
                        </td>
                        <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                            <button
                              onClick={() => handleOpenStockOut(item)}
                              title="Stock Out / Use on site"
                              style={{
                                padding: '6px 10px',
                                borderRadius: '6px',
                                border: '1px solid #CBD5E1',
                                backgroundColor: '#FFFFFF',
                                color: '#DC2626',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              Stock Out
                            </button>
                            <button
                              onClick={() => handleOpenTransfer(item)}
                              title="Transfer stock to another site"
                              style={{
                                padding: '6px 10px',
                                borderRadius: '6px',
                                border: '1px solid #CBD5E1',
                                backgroundColor: '#FFFFFF',
                                color: '#7C3AED',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              Transfer
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Purchases History */}
      {activeTab === 'purchases' && (
        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            border: '1px solid #E2E8F0',
            overflow: 'hidden',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}
        >
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  <th style={{ padding: '14px 18px', fontWeight: 700 }}>Date</th>
                  <th style={{ padding: '14px 18px', fontWeight: 700 }}>Item Description</th>
                  <th style={{ padding: '14px 18px', fontWeight: 700 }}>Project</th>
                  <th style={{ padding: '14px 18px', fontWeight: 700 }}>Supplier</th>
                  <th style={{ padding: '14px 18px', fontWeight: 700, textAlign: 'right' }}>Qty</th>
                  <th style={{ padding: '14px 18px', fontWeight: 700, textAlign: 'right' }}>Total Amount</th>
                  <th style={{ padding: '14px 18px', fontWeight: 700, textAlign: 'right' }}>Paid</th>
                  <th style={{ padding: '14px 18px', fontWeight: 700, textAlign: 'right' }}>Balance</th>
                </tr>
              </thead>
              <tbody>
                {combinedPurchases.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: '48px 24px', textAlign: 'center', color: '#94A3B8' }}>
                      <Receipt size={36} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
                      <div style={{ fontSize: '1rem', fontWeight: 600, color: '#475569' }}>No purchase records yet</div>
                    </td>
                  </tr>
                ) : (
                  combinedPurchases.map(p => {
                    const siteObj = sites.find(s => s.id === p.siteId);
                    return (
                      <tr key={p.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '14px 18px', color: '#64748B' }}>{formatDay(p.date)}</td>
                        <td style={{ padding: '14px 18px', fontWeight: 600, color: '#0F172A' }}>
                          <div>{p.name}</div>
                          {p.invoiceNumber && <div style={{ fontSize: '0.72rem', color: '#64748B' }}>Invoice: {p.invoiceNumber}</div>}
                        </td>
                        <td style={{ padding: '14px 18px', color: '#334155' }}>{siteObj?.name || 'Project'}</td>
                        <td style={{ padding: '14px 18px', color: '#64748B' }}>{p.supplier}</td>
                        <td style={{ padding: '14px 18px', textAlign: 'right', fontWeight: 600 }}>{p.quantity}</td>
                        <td style={{ padding: '14px 18px', textAlign: 'right', fontWeight: 700, color: '#0F172A' }}>
                          {formatINR(p.totalAmount)}
                        </td>
                        <td style={{ padding: '14px 18px', textAlign: 'right', color: '#16A34A', fontWeight: 600 }}>
                          {formatINR(p.paidAmount)}
                        </td>
                        <td style={{ padding: '14px 18px', textAlign: 'right', fontWeight: 600, color: p.balance > 0 ? '#DC2626' : '#64748B' }}>
                          {formatINR(p.balance)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Movements Log */}
      {activeTab === 'movements' && (
        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            border: '1px solid #E2E8F0',
            overflow: 'hidden',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}
        >
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  <th style={{ padding: '14px 18px', fontWeight: 700 }}>Date</th>
                  <th style={{ padding: '14px 18px', fontWeight: 700 }}>Material</th>
                  <th style={{ padding: '14px 18px', fontWeight: 700 }}>Type</th>
                  <th style={{ padding: '14px 18px', fontWeight: 700, textAlign: 'right' }}>Quantity</th>
                  <th style={{ padding: '14px 18px', fontWeight: 700 }}>Reason / Notes</th>
                </tr>
              </thead>
              <tbody>
                {movements.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: '48px 24px', textAlign: 'center', color: '#94A3B8' }}>
                      <RotateCcw size={36} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
                      <div style={{ fontSize: '1rem', fontWeight: 600, color: '#475569' }}>No stock movements recorded</div>
                    </td>
                  </tr>
                ) : (
                  movements.map(m => (
                    <tr key={m.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '14px 18px', color: '#64748B' }}>{formatDay(m.eventDate)}</td>
                      <td style={{ padding: '14px 18px', fontWeight: 600, color: '#0F172A' }}>{m.itemName}</td>
                      <td style={{ padding: '14px 18px' }}>
                        <span
                          style={{
                            padding: '4px 8px',
                            borderRadius: '6px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            backgroundColor:
                              m.movementType === 'usage'
                                ? '#FEE2E2'
                                : m.movementType === 'adjust_in'
                                ? '#DCFCE7'
                                : '#F1F5F9',
                            color:
                              m.movementType === 'usage'
                                ? '#991B1B'
                                : m.movementType === 'adjust_in'
                                ? '#166534'
                                : '#334155',
                          }}
                        >
                          {m.movementType === 'usage'
                            ? 'Stock Out (Used)'
                            : m.movementType === 'adjust_in'
                            ? 'Stock In (Adjust)'
                            : m.movementType === 'adjust_out'
                            ? 'Stock Out (Adjust)'
                            : m.movementType}
                        </span>
                      </td>
                      <td style={{ padding: '14px 18px', textAlign: 'right', fontWeight: 700 }}>
                        {formatQty(m.quantity)} {m.unit}
                      </td>
                      <td style={{ padding: '14px 18px', color: '#64748B', fontSize: '0.825rem' }}>
                        {m.reason ? (m.notes ? `${m.reason} · ${m.notes}` : m.reason) : (m.notes || '—')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Record Purchase Modal */}
      <RecordPurchaseModal
        isOpen={isPurchaseModalOpen}
        siteId={selectedSiteId === 'all' ? (sites[0]?.id || '') : selectedSiteId}
        sites={sites}
        materialToEdit={materialToEdit}
        rodToEdit={rodToEdit}
        onClose={() => setIsPurchaseModalOpen(false)}
        onSuccess={msg => {
          onNotify(msg, 'success');
        }}
      />

      {/* Stock Operation Modal */}
      <StockOperationModal
        isOpen={isStockOpModalOpen}
        siteId={selectedSiteId === 'all' ? (sites[0]?.id || '') : selectedSiteId}
        sites={sites}
        stockItems={stockItems}
        preselectedItem={stockOpItem}
        initialMode={stockOpMode}
        onClose={() => setIsStockOpModalOpen(false)}
        onSuccess={msg => {
          onNotify(msg, 'success');
        }}
      />
    </div>
  );
};
