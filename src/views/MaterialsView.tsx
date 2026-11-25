import React, { useState, useMemo } from 'react';
import {
  Layers,
  Search,
  PlusCircle,
  ArrowDownCircle,
  FileText,
  AlertTriangle,
  Package,
  TrendingDown,
  TrendingUp,
  Receipt,
  RotateCcw,
} from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import type { BillPhotoSyncStatus, Site, StockMovement, User } from '../db/types';
import { buildStock, formatStock, STOCK_MOVEMENT_LABEL, stockStatus, summariseStock, type StockItem } from '../domain/stock';
import { voidStockMovement } from '../services/records';
import { MATERIAL_GROUPS, materialGroupId } from '../domain/catalog';
import { formatDay } from '../utils/datetime';
import { formatINR } from '../utils/money';
import { RecordPurchaseModal } from '../components/RecordPurchaseModal';
import { StockOperationModal } from '../components/StockOperationModal';
import { MaterialIcon } from '../components/ui/CategoryIcon';
import { BillPhotoThumbnail, BillPhotoViewerModal, type BillPhotoRecordRef } from '../components/BillPhotoComponents';

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
  const [purchasePreset, setPurchasePreset] = useState<StockItem | null>(null);
  const [voiding, setVoiding] = useState<StockMovement | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [voidError, setVoidError] = useState('');

  const [isStockOpModalOpen, setIsStockOpModalOpen] = useState(false);
  const [stockOpItem, setStockOpItem] = useState<StockItem | null>(null);
  const [stockOpMode, setStockOpMode] = useState<'usage' | 'opening' | 'return' | 'adjust_in' | 'adjust_out' | 'transfer'>('usage');
  const [selectedBillPhoto, setSelectedBillPhoto] = useState<BillPhotoRecordRef | null>(null);

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

  // Cancelled entries are kept: the stock ignores them, the history shows them with their reason.
  const stockMovementsQuery = useLiveQuery(async () => {
    if (selectedSiteId === 'all') {
      return await db.stockMovements.toArray();
    }
    return await db.stockMovements.where('siteId').equals(selectedSiteId).toArray();
  }, [selectedSiteId]);

  const catalogQuery = useLiveQuery(async () => {
    return await db.catalogItems.filter(c => !c.isDeleted && c.kind !== 'tool').toArray();
  }, []);

  const materials = useMemo(() => materialsQuery || [], [materialsQuery]);
  const rodEntries = useMemo(() => rodEntriesQuery || [], [rodEntriesQuery]);
  const movements = useMemo(() => stockMovementsQuery || [], [stockMovementsQuery]);
  const catalog = useMemo(() => catalogQuery || [], [catalogQuery]);

  // Compute live multi-site or single-site Stock Items
  const stockItems: StockItem[] = useMemo(() => {
    return buildStock(materials, rodEntries, movements, catalog);
  }, [materials, rodEntries, movements, catalog]);

  // The same figures the phone screen shows (domain/stock summariseStock).
  const metrics = useMemo(() => summariseStock(stockItems, materials, rodEntries), [materials, rodEntries, stockItems]);
  const isAllSites = selectedSiteId === 'all';
  const movementLog = useMemo(
    () => [...movements].sort((a, b) => b.eventDate.localeCompare(a.eventDate) || (b.createdAt || '').localeCompare(a.createdAt || '')),
    [movements]
  );

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
      // Stock Status (low = at or below the item's own low-stock level)
      const status = stockStatus(item);
      if (stockStatusFilter === 'out' && status !== 'out' && status !== 'negative') return false;
      if (stockStatusFilter === 'low' && status !== 'low') return false;
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
      billPhotoPath?: string;
      billPhotoLocalDataUrl?: string;
      billPhotoSyncStatus?: BillPhotoSyncStatus;
      billPhotoName?: string;
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
        billPhotoPath: m.billPhotoPath,
        billPhotoLocalDataUrl: m.billPhotoLocalDataUrl,
        billPhotoSyncStatus: m.billPhotoSyncStatus,
        billPhotoName: m.billPhotoName,
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
        billPhotoPath: r.billPhotoPath,
        billPhotoLocalDataUrl: r.billPhotoLocalDataUrl,
        billPhotoSyncStatus: r.billPhotoSyncStatus,
        billPhotoName: r.billPhotoName,
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

  const handleOpenPurchase = (item?: StockItem) => {
    setPurchasePreset(item || null);
    setIsPurchaseModalOpen(true);
  };

  const handleVoid = async () => {
    if (!voiding) return;
    if (!voidReason.trim()) {
      setVoidError('Say why this entry is being cancelled.');
      return;
    }
    const res = await voidStockMovement(user, voiding.siteId, voiding.id, voidReason);
    if (!res.ok) {
      setVoidError(res.error);
      return;
    }
    onNotify('Entry cancelled. It stays in the history, marked as cancelled.', 'info');
    setVoiding(null);
    setVoidReason('');
    setVoidError('');
  };

  const handleExportPDF = () => {
    window.print();
  };


  return (
    <div className="erp-view-page">
      {/* Top Header & Actions */}
      <div className="erp-view-header">
        <div className="erp-view-title-wrap">
          <div className="erp-view-title-icon">
            <Layers size={22} />
          </div>
          <div>
            <h1 className="erp-view-title">
              Materials & Inventory Management
            </h1>
            <p className="erp-view-subtitle">
              Track live construction material stock, purchases, usage consumption and site-to-site transfers.
            </p>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="erp-view-actions">
          <button
            onClick={handleExportPDF}
            className="erp-btn-secondary"
          >
            <FileText size={16} />
            <span>Export Stock PDF</span>
          </button>

          <button
            onClick={() => handleOpenStockOut()}
            disabled={isAllSites}
            title={isAllSites ? 'Choose a project first' : undefined}
            className="erp-btn-secondary"
            style={isAllSites ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
          >
            <ArrowDownCircle size={16} color="var(--color-danger)" />
            <span>Record Usage</span>
          </button>

          <button
            onClick={() => handleOpenPurchase()}
            className="erp-btn-primary"
          >
            <PlusCircle size={18} />
            <span>+ Record Purchase</span>
          </button>
        </div>
      </div>

      {/* KPI Summary Cards: same figures as the phone screen */}
      <div className="erp-summary-grid-4">
        {[
          { label: 'MATERIALS', value: String(metrics.itemCount), hint: `${metrics.inStockCount} in stock`, valueClass: '', icon: <Package size={18} color="var(--color-charcoal)" /> },
          { label: 'STOCK VALUE', value: formatINR(metrics.stockValue), hint: 'On hand, at average purchase price', valueClass: 'erp-stat-value--success', icon: <TrendingUp size={18} color="var(--color-success)" /> },
          { label: 'BOUGHT', value: formatINR(metrics.purchaseValue), hint: 'All purchases', valueClass: '', icon: <Receipt size={18} color="var(--color-charcoal)" /> },
          { label: 'LOW STOCK', value: String(metrics.lowCount), hint: 'At or below the low-stock level', valueClass: metrics.lowCount > 0 ? 'erp-stat-value--warning' : '', icon: <AlertTriangle size={18} color="var(--color-warning)" /> },
          { label: 'OUT OF STOCK', value: String(metrics.outCount), hint: 'Nothing left on site', valueClass: metrics.outCount > 0 ? 'erp-stat-value--danger' : '', icon: <TrendingDown size={18} color="var(--color-danger)" /> },
          { label: 'TO PAY', value: formatINR(metrics.payable), hint: 'Unpaid supplier balance', valueClass: metrics.payable > 0 ? 'erp-stat-value--primary' : '', icon: <Receipt size={18} color="var(--color-primary-text)" /> },
        ].map(card => (
          <div key={card.label} className="erp-stat-card">
            <div className="erp-stat-card-top">
              <span className="erp-stat-label">{card.label}</span>
              {card.icon}
            </div>
            <div className={`erp-stat-value ${card.valueClass}`.trim()}>{card.value}</div>
            <div className="erp-stat-sub">{card.hint}</div>
          </div>
        ))}
      </div>

      {/* Control Bar: Project Filter, Search, Shelf Filter, and Tabs */}
      <div className="erp-control-card">
        {/* Project & Search Inputs */}
        <div className="erp-filter-group">
          <div>
            <select
              value={selectedSiteId}
              onChange={e => setSelectedSiteId(e.target.value)}
              className="erp-select-pill erp-select-pill--wide"
            >
              <option value="all">All Projects (Combined)</option>
              {sites.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div className="erp-search-box">
            <Search size={16} className="erp-search-icon" />
            <input
              type="text"
              placeholder="Search materials by name or category..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="erp-search-input"
            />
          </div>

          <div>
            <select
              value={selectedShelf}
              onChange={e => setSelectedShelf(e.target.value)}
              className="erp-select-pill"
            >
              <option value="all">All Categories</option>
              {MATERIAL_GROUPS.map(g => (
                <option key={g.id} value={g.id}>
                  {g.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={stockStatusFilter}
              onChange={e => setStockStatusFilter(e.target.value as any)}
              className="erp-select-pill"
            >
              <option value="all">All Status</option>
              <option value="in">In Stock Only</option>
              <option value="low">Low Stock Alert</option>
              <option value="out">Out of Stock</option>
            </select>
          </div>
        </div>

        {/* View Switcher Tabs */}
        <div className="erp-segmented-bar">
          {[
            { id: 'inventory', label: 'Inventory Stock' },
            { id: 'purchases', label: 'Purchases History' },
            { id: 'movements', label: 'Movement Logs' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`erp-segmented-tab ${activeTab === tab.id ? 'is-active' : ''}`.trim()}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab 1: Live Inventory Stock Grid / Table */}
      {activeTab === 'inventory' && (
        <div className="erp-card-panel">
          <div className="erp-table-wrap">
            <table className="erp-data-table">
              <thead>
                <tr>
                  <th>Material Name</th>
                  <th>Category</th>
                  <th className="is-right">Purchased</th>
                  <th className="is-right">Consumed / Out</th>
                  <th className="is-right">On Hand Stock</th>
                  <th className="is-center">Status</th>
                  <th className="is-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredStock.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="erp-empty-cell">
                      <Package size={36} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
                      <div className="erp-cell-primary">No material inventory records found</div>
                      <div className="erp-cell-sub">
                        Click "+ Record Purchase" to enter stock purchases for this site.
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredStock.map(item => {
                    const status = stockStatus(item);
                    const isOut = status === 'out' || status === 'negative';
                    const isLow = status === 'low';

                    return (
                      <tr key={item.key}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <MaterialIcon size="md" category={item.category} name={item.name} />
                            <div style={{ minWidth: 0 }}>
                              <div className="erp-cell-primary">{item.name}</div>
                              <div className="erp-cell-sub">{item.lowStockThreshold !== undefined ? `Low-stock level: ${formatStock(item.category, item.unit, item.lowStockThreshold)}` : 'No low-stock level set'}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className="mat-cat-chip" style={{ textTransform: 'capitalize' }}>
                            {item.category}
                          </span>
                        </td>
                        <td className="is-right">
                          {formatStock(item.category, item.unit, item.purchased)}
                        </td>
                        <td className="is-right erp-cell-danger">
                          {formatStock(item.category, item.unit, item.used + item.returned)}
                        </td>
                        <td className="is-right">
                          <span className={isOut ? 'erp-cell-danger' : isLow ? 'erp-cell-warning' : 'erp-cell-success'}>
                            {formatStock(item.category, item.unit, item.onHand)}
                          </span>
                        </td>
                        <td className="is-center">
                          <span
                            className={`erp-badge ${isOut ? 'erp-badge--danger' : isLow ? 'erp-badge--warning' : 'erp-badge--success'}`}
                          >
                            {status === 'negative' ? 'Below zero' : isOut ? 'Out of Stock' : isLow ? 'Low Stock' : 'Available'}
                          </span>
                        </td>
                        <td className="is-right">
                          <div className="erp-table-actions">
                            <button
                              onClick={() => handleOpenPurchase(item)}
                              title="Record a purchase of this material"
                              className="erp-btn-table-action erp-btn-table-action--success-outline"
                            >
                              + Purchase
                            </button>
                            <button
                              onClick={() => handleOpenStockOut(item)}
                              disabled={isAllSites || item.onHand <= 0}
                              title={isAllSites ? 'Choose a project first' : 'Stock Out / Use on site'}
                              className="erp-btn-table-action erp-btn-table-action--danger-outline"
                            >
                              Stock Out
                            </button>
                            <button
                              onClick={() => handleOpenTransfer(item)}
                              disabled={isAllSites || item.onHand <= 0 || sites.length < 2}
                              title={isAllSites ? 'Choose a project first' : 'Transfer stock to another site'}
                              className="erp-btn-table-action erp-btn-table-action--charcoal-outline"
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
        <div className="erp-card-panel">
          <div className="erp-table-wrap">
            <table className="erp-data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Item Description</th>
                  <th>Project</th>
                  <th>Supplier</th>
                  <th className="is-right">Qty</th>
                  <th className="is-right">Total Amount</th>
                  <th className="is-right">Paid</th>
                  <th className="is-right">Balance</th>
                  <th>Bill</th>
                </tr>
              </thead>
              <tbody>
                {combinedPurchases.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="erp-empty-cell">
                      <Receipt size={36} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
                      <div className="erp-cell-primary">No purchase records yet</div>
                    </td>
                  </tr>
                ) : (
                  combinedPurchases.map(p => {
                    const siteObj = sites.find(s => s.id === p.siteId);
                    const hasPhoto = !!(p.billPhotoPath || p.billPhotoLocalDataUrl);
                    return (
                      <tr key={p.id}>
                        <td className="erp-cell-muted">{formatDay(p.date)}</td>
                        <td>
                          <div className="erp-cell-primary">{p.name}</div>
                          {p.invoiceNumber && <div className="erp-cell-sub">Invoice: {p.invoiceNumber}</div>}
                        </td>
                        <td>{siteObj?.name || 'Project'}</td>
                        <td className="erp-cell-muted">{p.supplier}</td>
                        <td className="is-right erp-cell-primary">{p.quantity}</td>
                        <td className="is-right erp-cell-primary">
                          {formatINR(p.totalAmount)}
                        </td>
                        <td className="is-right erp-cell-success">
                          {formatINR(p.paidAmount)}
                        </td>
                        <td className={`is-right ${p.balance > 0 ? 'erp-cell-danger' : 'erp-cell-muted'}`}>
                          {formatINR(p.balance)}
                        </td>
                        <td>
                          {hasPhoto ? (
                            <BillPhotoThumbnail
                              record={p}
                              label={`View bill photo for ${p.name}`}
                              onOpen={() => setSelectedBillPhoto({
                                purchaseRecordId: p.id,
                                recordTable: p.kind === 'rod' ? 'rodEntries' : 'materials',
                                siteId: p.siteId,
                                title: p.name,
                                subtitle: `${formatDay(p.date)} · ${p.supplier}`,
                                billPhotoPath: p.billPhotoPath,
                                billPhotoLocalDataUrl: p.billPhotoLocalDataUrl,
                                billPhotoSyncStatus: p.billPhotoSyncStatus,
                                billPhotoName: p.billPhotoName,
                              })}
                            />
                          ) : (
                            <span className="erp-cell-muted">—</span>
                          )}
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
        <div className="erp-card-panel">
          <div className="erp-table-wrap">
            <table className="erp-data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Material</th>
                  <th>Type</th>
                  <th className="is-right">Quantity</th>
                  <th>Reason / Notes</th>
                  <th className="is-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {movementLog.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="erp-empty-cell">
                      <RotateCcw size={36} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
                      <div className="erp-cell-primary">No stock movements recorded</div>
                    </td>
                  </tr>
                ) : (
                  movementLog.map(m => (
                    <tr key={m.id} className={m.isDeleted ? 'erp-row-voided' : undefined}>
                      <td className="erp-cell-muted">{formatDay(m.eventDate)}</td>
                      <td className="erp-cell-primary">{m.itemName}</td>
                      <td>
                        <span
                          className={`erp-badge ${
                            m.movementType === 'usage'
                              ? 'erp-badge--danger'
                              : m.movementType === 'adjust_in'
                              ? 'erp-badge--success'
                              : 'erp-badge--neutral'
                          }`}
                        >
                          {STOCK_MOVEMENT_LABEL[m.movementType] || m.movementType}
                        </span>
                      </td>
                      <td className="is-right erp-cell-primary">
                        <span className={m.isDeleted ? 'erp-text-strike' : undefined}>{formatStock(m.category, m.unit, m.quantity)}</span>
                      </td>
                      <td>
                        <div>{m.reason ? (m.notes ? `${m.reason} · ${m.notes}` : m.reason) : (m.notes || '—')}</div>
                        {m.isDeleted && (
                          <div className="erp-cell-danger">
                            Cancelled: {m.voidReason || 'no reason given'}
                          </div>
                        )}
                      </td>
                      <td className="is-right">
                        {!m.isDeleted && (
                          <button
                            onClick={() => { setVoiding(m); setVoidReason(''); setVoidError(''); }}
                            className="erp-btn-table-action erp-btn-table-action--danger-outline"
                          >
                            Cancel entry
                          </button>
                        )}
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
        lockSite={!isAllSites}
        preset={purchasePreset}
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

      {/* Cancel (void) a stock entry: a reason is required, the entry stays in the history */}
      {voiding && (
        <div role="dialog" aria-modal="true" aria-label="Cancel stock entry" className="erp-inline-modal-backdrop">
          <div className="erp-inline-modal-card">
            <h2 className="erp-modal-title">Cancel this entry?</h2>
            <p className="erp-modal-desc">
              {STOCK_MOVEMENT_LABEL[voiding.movementType]}: {formatStock(voiding.category, voiding.unit, voiding.quantity)} {voiding.itemName}, {formatDay(voiding.eventDate)}.
              It stays in the history marked as cancelled and stops changing the stock.
            </p>
            {voidError && <div role="alert" className="erp-inline-alert">{voidError}</div>}
            <label className="erp-modal-field-label">
              Why is it being cancelled?
              <input
                type="text"
                value={voidReason}
                maxLength={120}
                onChange={e => setVoidReason(e.target.value)}
                placeholder="Entered twice, wrong item"
                className="erp-modal-input"
              />
            </label>
            <div className="erp-modal-actions">
              <button onClick={() => setVoiding(null)} className="btn btn-outline">Keep it</button>
              <button onClick={handleVoid} disabled={!voidReason.trim()} className="btn btn-danger-solid" style={{ opacity: voidReason.trim() ? 1 : 0.5 }}>Cancel entry</button>
            </div>
          </div>
        </div>
      )}

      <BillPhotoViewerModal
        record={selectedBillPhoto}
        onClose={() => setSelectedBillPhoto(null)}
        onDeleted={() => onNotify('Bill photo removed.', 'info')}
      />
    </div>
  );
};
