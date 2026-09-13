import React, { useState } from 'react';
import {
  Wrench,
  PlusCircle,
  Edit2,
  Trash2,
  Receipt,
  LayoutGrid,
  Table as TableIcon,
  Calendar,
  Building,
  Tag,
  Hash,
} from 'lucide-react';
import type { ToolItem } from '../../db/types';
import { PaymentHistoryModal } from '../../components/PaymentHistoryModal';
import { InteractiveHoverCard, type InteractiveHoverItem } from '../../components/ui/interactive-hover-links';
import { ItemDetailsModal, type DetailField } from '../../components/ui/ItemDetailsModal';
import { getToolVisual } from '../../utils/constructionVisuals';
import { SafeImage } from '../../components/ui/SafeImage';

interface ToolsTabProps {
  siteId: string;
  tools: ToolItem[];
  onOpenToolModal: (tool?: ToolItem) => void;
  onDeleteTool: (tool: ToolItem) => void;
}

// 15 Standard Core Tools + Custom Tool catalog
const STANDARD_15_TOOLS = [
  { name: 'Hammer', tamil: 'சுத்தியல்', desc: 'Steel claw hammer for masonry and carpentry' },
  { name: 'Trowel', tamil: 'கரண்டி', desc: 'Masonry plastering and finishing trowel' },
  { name: 'Brick Trowel', tamil: 'செங்கல் கரண்டி', desc: 'Pointed bricklaying and masonry trowel' },
  { name: 'Shovel', tamil: 'மண்வெட்டி', desc: 'Heavy gauge steel spade for mortar & earthwork' },
  { name: 'Pickaxe', tamil: 'பிக்காஸ் / கோடாரி', desc: 'Drop forged steel trenching and excavation pickaxe' },
  { name: 'Crowbar', tamil: 'கடப்பாரை', desc: 'Hexagonal tempered steel demolition pry bar' },
  { name: 'Measuring Tape', tamil: 'டேப்', desc: '5M/30M heavy duty steel layout measuring tape' },
  { name: 'Bucket', tamil: 'வாளி', desc: 'Reinforced mortar and concrete handling bucket' },
  { name: 'Wheelbarrow', tamil: 'தள்ளுவண்டி', desc: 'Dual-handle heavy duty site mortar wheelbarrow' },
  { name: 'Ladder', tamil: 'ஏணி / சாரம்', desc: 'Aluminium extension staging and scaffolding ladder' },
  { name: 'Drill Machine', tamil: 'துளையிடும் இயந்திரம்', desc: 'Heavy SDS hammer drill for masonry core holes' },
  { name: 'Grinder', tamil: 'கட்டிங் மெஷின்', desc: 'High-speed angle grinder with diamond cutting disc' },
  { name: 'Concrete Mixer', tamil: 'கலவை இயந்திரம்', desc: '10/7 CFT rotating drum site concrete mixer' },
  { name: 'Tool Box', tamil: 'டூல் பாக்ஸ்', desc: 'Heavy duty steel cantilever site toolbox' },
  { name: 'Saw', tamil: 'மரம் அறுக்கும் வாள்', desc: 'Hand carpentry saw for centering and formwork' },
  { name: 'Custom Tool', tamil: 'தனிப்பயன் உபகரணம்', desc: 'Custom construction machinery, vibrator & power tools' },
];

export const ToolsTab: React.FC<ToolsTabProps> = ({
  siteId,
  tools,
  onOpenToolModal,
  onDeleteTool,
}) => {
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [selectedToolForDetails, setSelectedToolForDetails] = useState<ToolItem | null>(null);
  const [catalogDetailTool, setCatalogDetailTool] = useState<{
    name: string;
    tamil: string;
    desc: string;
  } | null>(null);

  const [paymentModalData, setPaymentModalData] = useState<{
    isOpen: boolean;
    relatedRecordId: string;
    title: string;
    subtitle?: string;
    totalAmount: number;
  }>({
    isOpen: false,
    relatedRecordId: '',
    title: '',
    totalAmount: 0,
  });

  const totalCost = tools.reduce((acc, t) => acc + t.cost, 0);
  const totalPaid = tools.reduce((acc, t) => acc + t.paidAmount, 0);
  const totalBalance = tools.reduce((acc, t) => acc + t.balance, 0);
  const totalExtraPaid = tools.reduce((acc, t) => acc + (t.extraPaid || 0), 0);

  // Map site tools to InteractiveHoverItems
  const siteToolCards: InteractiveHoverItem[] = tools.map(tool => {
    const visual = getToolVisual(tool.toolName, tool.imageUrl);
    return {
      id: tool.id,
      title: tool.toolName,
      tamilTitle: visual.tamilName,
      description: tool.notes || visual.description,
      imageUrl: tool.imageUrl || visual.imageUrl,
      imageAlt: visual.imageAlt,
      fallbackCategory: 'tool',
      badge: `${tool.type} • ${tool.quantity} Nos`,
      badgeVariant:
        tool.type === 'Rental' ? 'warning' : tool.type === 'Repair' ? 'info' : 'primary',
      stats: [
        { label: 'Total Cost', value: `₹${tool.cost.toLocaleString('en-IN')}` },
        {
          label: 'Paid Amount',
          value: `₹${tool.paidAmount.toLocaleString('en-IN')}`,
          color: '#34d399',
        },
        {
          label: 'Balance Due',
          value: `₹${tool.balance.toLocaleString('en-IN')}`,
          color: tool.balance > 0 ? '#f87171' : '#94a3b8',
        },
        {
          label: 'Extra Paid',
          value: `₹${(tool.extraPaid || 0).toLocaleString('en-IN')}`,
          color: (tool.extraPaid || 0) > 0 ? '#38bdf8' : '#94a3b8',
        },
      ],
      onClick: () => setSelectedToolForDetails(tool),
    };
  });

  // Active Tool Details Modal preparation
  const activeToolVisual = selectedToolForDetails
    ? getToolVisual(selectedToolForDetails.toolName, selectedToolForDetails.imageUrl)
    : null;

  const toolDetailFields: DetailField[] = selectedToolForDetails
    ? [
        {
          label: 'Tool Name',
          value: selectedToolForDetails.toolName,
          icon: <Wrench size={14} className="text-amber-400" />,
          highlight: true,
        },
        {
          label: 'Tool Type',
          value: selectedToolForDetails.type,
          icon: <Tag size={14} className="text-sky-400" />,
        },
        {
          label: 'Quantity',
          value: `${selectedToolForDetails.quantity} Nos`,
          icon: <Hash size={14} className="text-emerald-400" />,
        },
        {
          label: 'Supplier / Rental Shop',
          value: selectedToolForDetails.supplier || 'Not Specified',
          icon: <Building size={14} className="text-purple-400" />,
        },
        {
          label: 'Purchase / Entry Date',
          value: selectedToolForDetails.purchaseDate || 'N/A',
          icon: <Calendar size={14} className="text-orange-400" />,
        },
        {
          label: 'Site Notes & Specs',
          value: selectedToolForDetails.notes || 'No special notes recorded.',
          highlight: false,
        },
      ]
    : [];

  return (
    <div className="space-y-6">
      {/* Summary KPI Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '12px',
        }}
      >
        <div className="metric-card card-primary" style={{ padding: '14px 18px' }}>
          <div className="metric-info">
            <h3>Total Tools Cost</h3>
            <div className="metric-value" style={{ fontSize: '1.4rem' }}>
              ₹{totalCost.toLocaleString('en-IN')}
            </div>
            <div className="metric-sub">{tools.length} Tools & Equipments</div>
          </div>
        </div>

        <div className="metric-card card-success" style={{ padding: '14px 18px' }}>
          <div className="metric-info">
            <h3>Paid Amount</h3>
            <div className="metric-value" style={{ fontSize: '1.4rem', color: 'var(--success)' }}>
              ₹{totalPaid.toLocaleString('en-IN')}
            </div>
            <div className="metric-sub">Purchases, Rents & Repairs Settled</div>
          </div>
        </div>

        <div className="metric-card card-danger" style={{ padding: '14px 18px' }}>
          <div className="metric-info">
            <h3>Balance Due</h3>
            <div
              className="metric-value"
              style={{
                fontSize: '1.4rem',
                color: totalBalance > 0 ? 'var(--danger)' : 'var(--success)',
              }}
            >
              ₹{totalBalance.toLocaleString('en-IN')}
            </div>
            <div className="metric-sub">Payable to rental/tool shops</div>
          </div>
        </div>

        {totalExtraPaid > 0 && (
          <div className="metric-card card-info" style={{ padding: '14px 18px' }}>
            <div className="metric-info">
              <h3>Extra Paid (Advance)</h3>
              <div className="metric-value" style={{ fontSize: '1.4rem', color: 'var(--primary)' }}>
                ₹{totalExtraPaid.toLocaleString('en-IN')}
              </div>
              <div className="metric-sub">Overpaid to suppliers</div>
            </div>
          </div>
        )}
      </div>

      {/* Action and View Toggle Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-2xl border border-slate-800">
        <div className="flex items-center gap-2">
          <span className="font-bold text-sm text-slate-100 flex items-center gap-2">
            <Wrench size={18} className="text-amber-400" />
            Tools & Machinery Visual Cards
          </span>
          <span className="text-xs text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full">
            {tools.length} on site
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

          <button className="btn btn-sm btn-primary" onClick={() => onOpenToolModal()}>
            <PlusCircle size={15} />
            <span>Add Tool / Machinery</span>
          </button>
        </div>
      </div>

      {/* 15 Standard Core Tools Navigation Quick-Strip */}
      <div className="rounded-2xl bg-slate-900/40 p-4 border border-slate-800/80 space-y-3">
        <div className="flex items-baseline justify-between">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
            <span>🛠️</span> 15 Essential Construction Tools Catalog
          </h4>
          <span className="text-[11px] text-slate-500">Click any tool to preview visual specs & image popup</span>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-8 gap-2">
          {STANDARD_15_TOOLS.map(st => {
            const vis = getToolVisual(st.name);
            const siteTool = tools.find(t => t.toolName.toLowerCase().includes(st.name.toLowerCase()));

            return (
              <button
                key={st.name}
                type="button"
                onClick={() => {
                  if (siteTool) {
                    setSelectedToolForDetails(siteTool);
                  } else {
                    setCatalogDetailTool(st);
                  }
                }}
                className="group relative flex flex-col items-center justify-center p-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-800 hover:border-amber-500/60 transition-all text-center"
              >
                <SafeImage
                  src={vis.imageUrl}
                  alt={st.name}
                  fallbackCategory="tool"
                  className="w-10 h-10 object-contain drop-shadow-sm group-hover:scale-110 transition-transform"
                />
                <span className="text-[11px] font-bold text-slate-200 group-hover:text-amber-400 mt-1 line-clamp-1">
                  {st.name}
                </span>
                <span className="text-[9px] text-slate-400 line-clamp-1">{st.tamil}</span>
                {siteTool && (
                  <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-emerald-400 shadow-sm" title="Active on site" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* View Mode: Interactive Hover Cards Grid */}
      {viewMode === 'cards' ? (
        siteToolCards.length === 0 ? (
          <div className="table-container p-8 text-center text-slate-400 space-y-3">
            <p>No tools or equipment registered yet for this construction site.</p>
            <button className="btn btn-sm btn-primary" onClick={() => onOpenToolModal()}>
              <PlusCircle size={15} />
              <span>Add Your First Tool</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {siteToolCards.map(item => (
              <InteractiveHoverCard key={item.id} item={item} />
            ))}
          </div>
        )
      ) : (
        /* View Mode: Data Table */
        <div className="table-container">
          <div className="data-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Visual</th>
                  <th>Date</th>
                  <th>Tool / Equipment Name</th>
                  <th>Type</th>
                  <th>Quantity</th>
                  <th>Supplier / Shop</th>
                  <th>Total Cost</th>
                  <th>Paid</th>
                  <th>Balance Due</th>
                  <th>Extra Paid</th>
                  <th>Notes</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {tools.map(tool => {
                  const vis = getToolVisual(tool.toolName, tool.imageUrl);
                  return (
                    <tr
                      key={tool.id}
                      onClick={() => setSelectedToolForDetails(tool)}
                      className="cursor-pointer hover:bg-slate-800/40 transition-colors"
                    >
                      <td style={{ width: '50px' }}>
                        <SafeImage
                          src={tool.imageUrl || vis.imageUrl}
                          alt={tool.toolName}
                          fallbackCategory="tool"
                          style={{
                            width: '36px',
                            height: '36px',
                            objectFit: 'cover',
                            borderRadius: '6px',
                          }}
                        />
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>{tool.purchaseDate}</td>
                      <td>
                        <strong>{tool.toolName}</strong>
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            tool.type === 'Rental'
                              ? 'badge-onhold'
                              : tool.type === 'Repair'
                              ? 'badge-warning'
                              : 'badge-active'
                          }`}
                        >
                          {tool.type}
                        </span>
                      </td>
                      <td>
                        <strong>{tool.quantity}</strong> Nos
                      </td>
                      <td>{tool.supplier || '-'}</td>
                      <td>
                        <strong style={{ fontFamily: 'var(--font-heading)' }}>
                          ₹{tool.cost.toLocaleString('en-IN')}
                        </strong>
                      </td>
                      <td style={{ color: 'var(--success)', fontWeight: 600 }}>
                        ₹{tool.paidAmount.toLocaleString('en-IN')}
                      </td>
                      <td>
                        <span
                          style={{
                            fontWeight: 700,
                            color: tool.balance > 0 ? 'var(--danger)' : 'var(--text-muted)',
                          }}
                        >
                          ₹{tool.balance.toLocaleString('en-IN')}
                        </span>
                      </td>
                      <td>
                        {(tool.extraPaid || 0) > 0 ? (
                          <span style={{ fontWeight: 700, color: 'var(--primary)' }}>
                            ₹{(tool.extraPaid || 0).toLocaleString('en-IN')}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>₹0</span>
                        )}
                      </td>
                      <td style={{ color: 'var(--text-muted)' }}>{tool.notes || '-'}</td>
                      <td onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button
                            className="btn btn-sm btn-outline"
                            title="Payment History & Ledger"
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '4px 8px',
                            }}
                            onClick={() =>
                              setPaymentModalData({
                                isOpen: true,
                                relatedRecordId: tool.id,
                                title: tool.toolName,
                                subtitle: `${tool.type} - ${tool.supplier || 'Shop'} (${tool.quantity} Nos)`,
                                totalAmount: tool.cost,
                              })
                            }
                          >
                            <Receipt size={13} />
                            <span style={{ fontSize: '0.75rem' }}>Payments</span>
                          </button>
                          <button
                            className="btn btn-sm btn-outline"
                            title="Edit Tool"
                            onClick={() => onOpenToolModal(tool)}
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            className="btn btn-sm btn-danger"
                            title="Move to Recycle Bin"
                            onClick={() => onDeleteTool(tool)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {tools.length === 0 && (
                  <tr>
                    <td
                      colSpan={12}
                      style={{
                        textAlign: 'center',
                        padding: '36px',
                        color: 'var(--text-muted)',
                      }}
                    >
                      No tools or equipment registered yet. Click "Add Tool / Machinery" to track
                      trowels, shovels, mixers, rentals, repairs, etc.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Selected Registered Tool Details Modal (Pop-up upon clicking card) */}
      {selectedToolForDetails && activeToolVisual && (
        <ItemDetailsModal
          isOpen={!!selectedToolForDetails}
          onClose={() => setSelectedToolForDetails(null)}
          title={selectedToolForDetails.toolName}
          subtitle={`${activeToolVisual.tamilName} • ${selectedToolForDetails.type}`}
          categoryBadge={`${selectedToolForDetails.type} • ${selectedToolForDetails.quantity} Nos`}
          badgeVariant={selectedToolForDetails.type === 'Rental' ? 'warning' : 'primary'}
          imageUrl={selectedToolForDetails.imageUrl || activeToolVisual.imageUrl}
          imageAlt={selectedToolForDetails.toolName}
          details={toolDetailFields}
          financials={{
            totalAmount: selectedToolForDetails.cost,
            paidAmount: selectedToolForDetails.paidAmount,
          }}
          onEdit={() => {
            const tool = selectedToolForDetails;
            setSelectedToolForDetails(null);
            onOpenToolModal(tool);
          }}
          actions={[
            {
              label: 'Payment Ledger',
              icon: <Receipt size={14} />,
              onClick: () => {
                const tool = selectedToolForDetails;
                setSelectedToolForDetails(null);
                setPaymentModalData({
                  isOpen: true,
                  relatedRecordId: tool.id,
                  title: tool.toolName,
                  subtitle: `${tool.type} - ${tool.supplier || 'Shop'} (${tool.quantity} Nos)`,
                  totalAmount: tool.cost,
                });
              },
            },
          ]}
        />
      )}

      {/* Catalog Tool Details Modal (Previewing unadded tool from standard 15 catalog) */}
      {catalogDetailTool && (() => {
        const catVisual = getToolVisual(catalogDetailTool.name);
        return (
          <ItemDetailsModal
            isOpen={!!catalogDetailTool}
            onClose={() => setCatalogDetailTool(null)}
            title={catalogDetailTool.name}
            subtitle={catalogDetailTool.tamil}
            categoryBadge="Standard Tool Catalog"
            badgeVariant="info"
            imageUrl={catVisual.imageUrl}
            imageAlt={catalogDetailTool.name}
            details={[
              {
                label: 'Standard Name',
                value: catalogDetailTool.name,
                icon: <Wrench size={14} className="text-amber-400" />,
                highlight: true,
              },
              {
                label: 'Tamil Term',
                value: catalogDetailTool.tamil,
                icon: <Tag size={14} className="text-sky-400" />,
              },
              {
                label: 'Usage & Description',
                value: catalogDetailTool.desc,
              },
            ]}
            actions={[
              {
                label: 'Add to Site Inventory',
                icon: <PlusCircle size={14} />,
                variant: 'amber',
                onClick: () => {
                  const name = catalogDetailTool.name;
                  setCatalogDetailTool(null);
                  onOpenToolModal({
                    id: '',
                    siteId,
                    toolName: name,
                    quantity: 1,
                    type: 'Purchase',
                    cost: 500,
                    paidAmount: 0,
                    balance: 500,
                    extraPaid: 0,
                    purchaseDate: new Date().toISOString().slice(0, 10),
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
        tableName="tools"
        title={paymentModalData.title}
        subtitle={paymentModalData.subtitle}
        module="Tools"
        totalAmount={paymentModalData.totalAmount}
      />
    </div>
  );
};
