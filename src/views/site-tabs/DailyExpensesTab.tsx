import React, { useState, useEffect } from 'react';
import {
  Coffee,
  Sparkles,
  Zap,
  Droplets,
  PlusCircle,
  Edit2,
  Trash2,
  Wallet,
  Receipt,
  Tag,
  Calendar as CalendarIcon,
  Building,
  Hash,
} from 'lucide-react';
import type {
  TeaSnacksExpense,
  PoojaExpense,
  ElectricityBill,
  WaterBill,
  OtherExpense,
} from '../../db/types';
import { PaymentHistoryModal } from '../../components/PaymentHistoryModal';
import {
  InteractiveHoverCard,
  type InteractiveHoverItem,
} from '../../components/ui/interactive-hover-links';
import { ItemDetailsModal, type DetailField } from '../../components/ui/ItemDetailsModal';
import { getExpenseVisual } from '../../utils/constructionVisuals';

interface DailyExpensesTabProps {
  siteId: string;
  teaSnacks: TeaSnacksExpense[];
  poojas: PoojaExpense[];
  electricity: ElectricityBill[];
  water: WaterBill[];
  otherExpenses: OtherExpense[];
  initialSection?: 'tea' | 'pooja' | 'electricity' | 'water' | 'other';
  onOpenTeaModal: (expense?: TeaSnacksExpense) => void;
  onOpenPoojaModal: (pooja?: PoojaExpense) => void;
  onOpenElectricityModal: (bill?: ElectricityBill) => void;
  onOpenWaterModal: (bill?: WaterBill) => void;
  onOpenOtherModal: (expense?: OtherExpense) => void;
  onDeleteTea: (expense: TeaSnacksExpense) => void;
  onDeletePooja: (pooja: PoojaExpense) => void;
  onDeleteElectricity: (bill: ElectricityBill) => void;
  onDeleteWater: (bill: WaterBill) => void;
  onDeleteOther: (expense: OtherExpense) => void;
}

export const DailyExpensesTab: React.FC<DailyExpensesTabProps> = ({
  siteId,
  teaSnacks,
  poojas,
  electricity,
  water,
  otherExpenses,
  initialSection = 'tea',
  onOpenTeaModal,
  onOpenPoojaModal,
  onOpenElectricityModal,
  onOpenWaterModal,
  onOpenOtherModal,
  onDeleteTea,
  onDeletePooja,
  onDeleteElectricity,
  onDeleteWater,
  onDeleteOther,
}) => {
  const [subSection, setSubSection] = useState<'tea' | 'pooja' | 'electricity' | 'water' | 'other'>(initialSection);
  const [teaFilter, setTeaFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');

  // Unified Item Details Modal state for expenses
  const [expenseModalData, setExpenseModalData] = useState<{
    title: string;
    subtitle?: string;
    categoryBadge?: string;
    badgeVariant?: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';
    imageUrl: string;
    imageAlt?: string;
    details: DetailField[];
    financials?: {
      totalAmount: number;
      paidAmount: number;
    };
    onEdit?: () => void;
    onPaymentLedger?: () => void;
  } | null>(null);

  // Universal Payment History modal state
  const [paymentModalData, setPaymentModalData] = useState<{
    isOpen: boolean;
    relatedRecordId: string;
    tableName: 'teaSnacksExpenses' | 'poojaExpenses' | 'electricityBills' | 'waterBills' | 'otherExpenses';
    title: string;
    subtitle?: string;
    module: string;
    totalAmount: number;
  }>({
    isOpen: false,
    relatedRecordId: '',
    tableName: 'teaSnacksExpenses',
    title: '',
    module: 'Tea & Snacks',
    totalAmount: 0,
  });

  useEffect(() => {
    if (initialSection) {
      setSubSection(initialSection);
    }
  }, [initialSection]);

  // Filter Tea & Snacks by time window
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const currentMonthStr = todayStr.slice(0, 7);

  const filteredTea = teaSnacks.filter(t => {
    if (teaFilter === 'today') return t.date === todayStr;
    if (teaFilter === 'week') return t.date >= sevenDaysAgo;
    if (teaFilter === 'month') return t.date.startsWith(currentMonthStr);
    return true;
  });

  const totalFilteredTeaCost = filteredTea.reduce((acc, t) => acc + t.totalAmount, 0);
  const totalFilteredTeaPaid = filteredTea.reduce((acc, t) => acc + t.paidAmount, 0);
  const totalFilteredTeaBal = filteredTea.reduce((acc, t) => acc + t.balance, 0);
  const totalFilteredTeaExtra = filteredTea.reduce((acc, t) => acc + (t.extraPaid || 0), 0);

  const totalFilteredTeaOnly = filteredTea.reduce((acc, t) => acc + (t.teaExpense || 0), 0);
  const totalFilteredSnacksOnly = filteredTea.reduce((acc, t) => acc + (t.snacksExpense || 0), 0);
  const totalFilteredJuiceOnly = filteredTea.reduce((acc, t) => acc + (t.juiceExpense || 0), 0);
  const totalFilteredOtherOnly = filteredTea.reduce((acc, t) => acc + (t.otherFoodExpense || 0), 0);

  const totalPoojaCost = poojas.reduce((acc, p) => acc + p.totalAmount, 0);
  const totalElecCost = electricity.reduce((acc, e) => acc + e.billAmount, 0);
  const totalWaterCost = water.reduce((acc, w) => acc + w.billAmount, 0);
  const totalOtherCost = otherExpenses.reduce((acc, o) => acc + o.amount, 0);

  // Helper detail openers for each expense type
  const openTeaDetail = (item: TeaSnacksExpense) => {
    const defaultVisual = getExpenseVisual(
      item.imageType === 'snacks' ? 'snacks' :
      item.imageType === 'juice' ? 'juice' :
      item.imageType === 'food' ? 'food' : 'tea'
    ).imageUrl;

    setExpenseModalData({
      title: `Tea & Snacks (${item.date})`,
      subtitle: item.notes || 'Daily Tea Stall Expense',
      categoryBadge: 'Daily Refreshment',
      badgeVariant: 'warning',
      imageUrl: item.imageUrl || defaultVisual,
      imageAlt: item.imageAlt || 'Tea & Snacks',
      details: [
        { label: 'Date', value: item.date, highlight: true },
        { label: '☕ Tea & Coffee', value: `₹${(item.teaExpense || 0).toLocaleString('en-IN')}` },
        { label: '🍪 Snacks & Vada', value: `₹${(item.snacksExpense || 0).toLocaleString('en-IN')}` },
        { label: '🧃 Fresh Juice', value: `₹${(item.juiceExpense || 0).toLocaleString('en-IN')}` },
        { label: '🍱 Other Food / Meals', value: `₹${(item.otherFoodExpense || 0).toLocaleString('en-IN')}` },
        { label: 'Stall / Notes', value: item.notes || 'None' },
      ],
      financials: {
        totalAmount: item.totalAmount,
        paidAmount: item.paidAmount,
      },
      onEdit: () => {
        setExpenseModalData(null);
        onOpenTeaModal(item);
      },
      onPaymentLedger: () => {
        setExpenseModalData(null);
        setPaymentModalData({
          isOpen: true,
          relatedRecordId: item.id,
          tableName: 'teaSnacksExpenses',
          title: `Tea/Snacks - ${item.date}`,
          subtitle: item.notes || 'Daily Tea Stall Expense',
          module: 'Tea & Snacks',
          totalAmount: item.totalAmount,
        });
      },
    });
  };

  const openPoojaDetail = (p: PoojaExpense) => {
    setExpenseModalData({
      title: p.poojaName,
      subtitle: `Auspicious Site Ritual - ${p.date}`,
      categoryBadge: 'Pooja Ceremony',
      badgeVariant: 'warning',
      imageUrl: p.imageUrl || getExpenseVisual('pooja').imageUrl,
      imageAlt: p.imageAlt || p.poojaName,
      details: [
        { label: 'Ceremony Name', value: p.poojaName, highlight: true },
        { label: 'Date', value: p.date },
        { label: 'Flowers, Fruits & Items', value: `₹${p.materialsExpense.toLocaleString('en-IN')}` },
        { label: 'Priest Sambhavana / Dakshina', value: `₹${p.priestExpense.toLocaleString('en-IN')}` },
        { label: 'Other Expenses / Prasad', value: `₹${p.otherExpense.toLocaleString('en-IN')}` },
        { label: 'Notes', value: p.notes || 'None' },
      ],
      financials: {
        totalAmount: p.totalAmount,
        paidAmount: p.paidAmount,
      },
      onEdit: () => {
        setExpenseModalData(null);
        onOpenPoojaModal(p);
      },
      onPaymentLedger: () => {
        setExpenseModalData(null);
        setPaymentModalData({
          isOpen: true,
          relatedRecordId: p.id,
          tableName: 'poojaExpenses',
          title: p.poojaName,
          subtitle: `Site Ceremony Expense - ${p.date}`,
          module: 'Pooja',
          totalAmount: p.totalAmount,
        });
      },
    });
  };

  const openOtherDetail = (oth: OtherExpense) => {
    setExpenseModalData({
      title: oth.description,
      subtitle: `${oth.category} - ${oth.date}`,
      categoryBadge: oth.category,
      badgeVariant: 'primary',
      imageUrl: oth.imageUrl || getExpenseVisual('other').imageUrl,
      imageAlt: oth.imageAlt || oth.description,
      details: [
        { label: 'Description', value: oth.description, highlight: true },
        { label: 'Date', value: oth.date },
        { label: 'Category', value: oth.category },
        { label: 'Notes / Vendor', value: oth.notes || 'None' },
      ],
      financials: {
        totalAmount: oth.amount,
        paidAmount: oth.paidAmount,
      },
      onEdit: () => {
        setExpenseModalData(null);
        onOpenOtherModal(oth);
      },
      onPaymentLedger: () => {
        setExpenseModalData(null);
        setPaymentModalData({
          isOpen: true,
          relatedRecordId: oth.id,
          tableName: 'otherExpenses',
          title: oth.description,
          subtitle: `${oth.category} - ${oth.date}`,
          module: 'Other Expense',
          totalAmount: oth.amount,
        });
      },
    });
  };

  const openElectricityDetail = (elec: ElectricityBill) => {
    setExpenseModalData({
      title: `Electricity Bill (${elec.month})`,
      subtitle: elec.meterNumber ? `Meter No: ${elec.meterNumber}` : 'Site Electricity Bill',
      categoryBadge: 'EB Bill',
      badgeVariant: 'warning',
      imageUrl: elec.imageUrl || getExpenseVisual('electricity').imageUrl,
      imageAlt: elec.imageAlt || `EB Bill ${elec.month}`,
      details: [
        { label: 'Billing Month', value: elec.month, highlight: true },
        { label: 'Meter / Consumer No', value: elec.meterNumber || 'Not specified' },
        { label: 'Due Date', value: elec.dueDate || 'N/A' },
        { label: 'Notes', value: elec.notes || 'None' },
      ],
      financials: {
        totalAmount: elec.billAmount,
        paidAmount: elec.paidAmount,
      },
      onEdit: () => {
        setExpenseModalData(null);
        onOpenElectricityModal(elec);
      },
      onPaymentLedger: () => {
        setExpenseModalData(null);
        setPaymentModalData({
          isOpen: true,
          relatedRecordId: elec.id,
          tableName: 'electricityBills',
          title: `Electricity Bill (${elec.month})`,
          subtitle: elec.meterNumber ? `Meter: ${elec.meterNumber}` : undefined,
          module: 'Electricity',
          totalAmount: elec.billAmount,
        });
      },
    });
  };

  const openWaterDetail = (w: WaterBill) => {
    setExpenseModalData({
      title: `Water Supply - ${w.supplier}`,
      subtitle: `${w.quantityLoads || '1'} Tankers - ${w.date}`,
      categoryBadge: 'Water Tanker',
      badgeVariant: 'info',
      imageUrl: w.imageUrl || getExpenseVisual('water').imageUrl,
      imageAlt: w.imageAlt || `Water - ${w.supplier}`,
      details: [
        { label: 'Delivery Date', value: w.date, highlight: true },
        { label: 'Supplier', value: w.supplier },
        { label: 'Quantity / Tankers', value: String(w.quantityLoads || '1') },
        { label: 'Notes', value: w.notes || 'None' },
      ],
      financials: {
        totalAmount: w.billAmount,
        paidAmount: w.paidAmount,
      },
      onEdit: () => {
        setExpenseModalData(null);
        onOpenWaterModal(w);
      },
      onPaymentLedger: () => {
        setExpenseModalData(null);
        setPaymentModalData({
          isOpen: true,
          relatedRecordId: w.id,
          tableName: 'waterBills',
          title: `Water Supply - ${w.supplier}`,
          subtitle: `${w.quantityLoads || ''} Tankers - ${w.date}`,
          module: 'Water',
          totalAmount: w.billAmount,
        });
      },
    });
  };

  return (
    <div>
      {/* Category Sub-Tabs */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '10px' }}>
        <div className="sub-tabs" style={{ marginBottom: 0 }}>
          <button
            className={`sub-tab-btn ${subSection === 'tea' ? 'active' : ''}`}
            onClick={() => setSubSection('tea')}
          >
            <Coffee size={16} />
            <span>Tea, Snacks & Juice (₹{teaSnacks.reduce((a, t) => a + t.totalAmount, 0).toLocaleString('en-IN')})</span>
          </button>
          <button
            className={`sub-tab-btn ${subSection === 'pooja' ? 'active' : ''}`}
            onClick={() => setSubSection('pooja')}
          >
            <Sparkles size={16} />
            <span>Pooja (₹{totalPoojaCost.toLocaleString('en-IN')})</span>
          </button>
          <button
            className={`sub-tab-btn ${subSection === 'other' ? 'active' : ''}`}
            onClick={() => setSubSection('other')}
          >
            <Wallet size={16} />
            <span>Other Expenses (₹{totalOtherCost.toLocaleString('en-IN')})</span>
          </button>
          <button
            className={`sub-tab-btn ${subSection === 'electricity' ? 'active' : ''}`}
            onClick={() => setSubSection('electricity')}
          >
            <Zap size={16} />
            <span>EB Current (₹{totalElecCost.toLocaleString('en-IN')})</span>
          </button>
          <button
            className={`sub-tab-btn ${subSection === 'water' ? 'active' : ''}`}
            onClick={() => setSubSection('water')}
          >
            <Droplets size={16} />
            <span>Water (₹{totalWaterCost.toLocaleString('en-IN')})</span>
          </button>
        </div>

        <div>
          {subSection === 'tea' && (
            <button className="btn btn-primary btn-sm" onClick={() => onOpenTeaModal()}>
              <PlusCircle size={16} />
              <span>Add Tea, Snacks & Juice</span>
            </button>
          )}
          {subSection === 'pooja' && (
            <button className="btn btn-primary btn-sm" onClick={() => onOpenPoojaModal()}>
              <PlusCircle size={16} />
              <span>Record Site Pooja</span>
            </button>
          )}
          {subSection === 'other' && (
            <button className="btn btn-primary btn-sm" onClick={() => onOpenOtherModal()}>
              <PlusCircle size={16} />
              <span>Record Expense</span>
            </button>
          )}
          {subSection === 'electricity' && (
            <button className="btn btn-primary btn-sm" onClick={() => onOpenElectricityModal()}>
              <PlusCircle size={16} />
              <span>Record EB Bill</span>
            </button>
          )}
          {subSection === 'water' && (
            <button className="btn btn-primary btn-sm" onClick={() => onOpenWaterModal()}>
              <PlusCircle size={16} />
              <span>Record Water Load</span>
            </button>
          )}
        </div>
      </div>

      {/* 1. TEA & SNACKS SUBSECTION */}
      {subSection === 'tea' && (
        <div>
          {/* Refreshment Visual Interactive Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '18px' }}>
            <InteractiveHoverCard
              item={{
                id: 'exp-tea',
                title: 'Tea & Coffee',
                description: `Daily hot tea, filter coffee & milk for site workers. Filtered spend: ₹${totalFilteredTeaOnly.toLocaleString('en-IN')}`,
                imageUrl: getExpenseVisual('tea').imageUrl,
                imageAlt: 'Tea & Coffee',
                icon: <Coffee size={18} />,
                badge: 'Hot Drink',
                stats: [{ label: 'Filtered', value: `₹${totalFilteredTeaOnly.toLocaleString('en-IN')}` }],
                onClick: () => {
                  setExpenseModalData({
                    title: 'Tea & Filter Coffee',
                    subtitle: 'Daily site hot beverages supply for masons and helpers',
                    categoryBadge: 'Refreshments',
                    badgeVariant: 'warning',
                    imageUrl: getExpenseVisual('tea').imageUrl,
                    imageAlt: 'Tea & Coffee',
                    details: [
                      { label: 'Total Tea Spend', value: `₹${totalFilteredTeaOnly.toLocaleString('en-IN')}`, highlight: true },
                      { label: 'Timeframe', value: teaFilter === 'all' ? 'All Time' : teaFilter === 'today' ? 'Today' : teaFilter === 'week' ? 'Last 7 Days' : 'This Month' },
                      { label: 'Filtered Records', value: `${filteredTea.length} days logged` },
                      { label: 'Category', value: 'Hot Refreshments' },
                    ],
                    financials: {
                      totalAmount: totalFilteredTeaCost,
                      paidAmount: totalFilteredTeaPaid,
                    },
                  });
                },
              }}
            />
            <InteractiveHoverCard
              item={{
                id: 'exp-snacks',
                title: 'Snacks & Vada',
                description: `Morning & evening snacks, medu vada, bajji, biscuits. Filtered spend: ₹${totalFilteredSnacksOnly.toLocaleString('en-IN')}`,
                imageUrl: getExpenseVisual('snacks').imageUrl,
                imageAlt: 'Snacks & Vada',
                icon: <Tag size={18} />,
                badge: 'Snacks',
                stats: [{ label: 'Filtered', value: `₹${totalFilteredSnacksOnly.toLocaleString('en-IN')}` }],
                onClick: () => {
                  setExpenseModalData({
                    title: 'Snacks, Vada & Biscuits',
                    subtitle: 'Morning & evening tea time snacks for labour team',
                    categoryBadge: 'Snacks',
                    badgeVariant: 'warning',
                    imageUrl: getExpenseVisual('snacks').imageUrl,
                    imageAlt: 'Snacks & Vada',
                    details: [
                      { label: 'Total Snacks Spend', value: `₹${totalFilteredSnacksOnly.toLocaleString('en-IN')}`, highlight: true },
                      { label: 'Timeframe', value: teaFilter === 'all' ? 'All Time' : teaFilter === 'today' ? 'Today' : teaFilter === 'week' ? 'Last 7 Days' : 'This Month' },
                      { label: 'Filtered Records', value: `${filteredTea.length} days logged` },
                      { label: 'Items', value: 'Vada, Bajji, Samosa, Bun Butter, Biscuits' },
                    ],
                    financials: {
                      totalAmount: totalFilteredTeaCost,
                      paidAmount: totalFilteredTeaPaid,
                    },
                  });
                },
              }}
            />
            <InteractiveHoverCard
              item={{
                id: 'exp-juice',
                title: 'Fresh Juice & Cooling',
                description: `Fresh fruit juices, lemon juice, tender coconut. Filtered spend: ₹${totalFilteredJuiceOnly.toLocaleString('en-IN')}`,
                imageUrl: getExpenseVisual('juice').imageUrl,
                imageAlt: 'Fresh Juice',
                icon: <Sparkles size={18} />,
                badge: 'Cold Drinks',
                stats: [{ label: 'Filtered', value: `₹${totalFilteredJuiceOnly.toLocaleString('en-IN')}` }],
                onClick: () => {
                  setExpenseModalData({
                    title: 'Fresh Juice & Cold Drinks',
                    subtitle: 'Summer cooling juices, buttermilk & tender coconut for workers',
                    categoryBadge: 'Beverages',
                    badgeVariant: 'success',
                    imageUrl: getExpenseVisual('juice').imageUrl,
                    imageAlt: 'Fresh Juice',
                    details: [
                      { label: 'Total Juice Spend', value: `₹${totalFilteredJuiceOnly.toLocaleString('en-IN')}`, highlight: true },
                      { label: 'Timeframe', value: teaFilter === 'all' ? 'All Time' : teaFilter === 'today' ? 'Today' : teaFilter === 'week' ? 'Last 7 Days' : 'This Month' },
                      { label: 'Filtered Records', value: `${filteredTea.length} days logged` },
                      { label: 'Category', value: 'Hydration & Fruit Juices' },
                    ],
                    financials: {
                      totalAmount: totalFilteredTeaCost,
                      paidAmount: totalFilteredTeaPaid,
                    },
                  });
                },
              }}
            />
            <InteractiveHoverCard
              item={{
                id: 'exp-food',
                title: 'Meals & Food',
                description: `Lunch meals, tiffin, special food for overtime work. Filtered spend: ₹${totalFilteredOtherOnly.toLocaleString('en-IN')}`,
                imageUrl: getExpenseVisual('food').imageUrl,
                imageAlt: 'Meals & Food',
                icon: <Building size={18} />,
                badge: 'Meals / Tiffin',
                stats: [{ label: 'Filtered', value: `₹${totalFilteredOtherOnly.toLocaleString('en-IN')}` }],
                onClick: () => {
                  setExpenseModalData({
                    title: 'Food, Lunch & Meals',
                    subtitle: 'Overtime food parcel, tiffin, and noon meal expenses',
                    categoryBadge: 'Food',
                    badgeVariant: 'info',
                    imageUrl: getExpenseVisual('food').imageUrl,
                    imageAlt: 'Meals & Food',
                    details: [
                      { label: 'Total Food Spend', value: `₹${totalFilteredOtherOnly.toLocaleString('en-IN')}`, highlight: true },
                      { label: 'Timeframe', value: teaFilter === 'all' ? 'All Time' : teaFilter === 'today' ? 'Today' : teaFilter === 'week' ? 'Last 7 Days' : 'This Month' },
                      { label: 'Filtered Records', value: `${filteredTea.length} days logged` },
                      { label: 'Category', value: 'Meals & Heavy Tiffin' },
                    ],
                    financials: {
                      totalAmount: totalFilteredTeaCost,
                      paidAmount: totalFilteredTeaPaid,
                    },
                  });
                },
              }}
            />
          </div>

          {/* Timeframe Filter Buttons: Daily, Weekly, Monthly, All */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: '#ffffff',
            padding: '12px 18px',
            borderRadius: '10px',
            marginBottom: '16px',
            border: '1px solid var(--border-light)',
            flexWrap: 'wrap',
            gap: '10px'
          }}>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                className={`btn btn-sm ${teaFilter === 'today' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setTeaFilter('today')}
              >
                Today
              </button>
              <button
                className={`btn btn-sm ${teaFilter === 'week' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setTeaFilter('week')}
              >
                Last 7 Days
              </button>
              <button
                className={`btn btn-sm ${teaFilter === 'month' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setTeaFilter('month')}
              >
                This Month
              </button>
              <button
                className={`btn btn-sm ${teaFilter === 'all' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setTeaFilter('all')}
              >
                All Time ({teaSnacks.length})
              </button>
            </div>

            <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
              Filtered Total: <strong style={{ color: 'var(--text-main)', fontSize: '1.05rem' }}>₹{totalFilteredTeaCost.toLocaleString('en-IN')}</strong>
              {' '}(Paid: ₹{totalFilteredTeaPaid.toLocaleString('en-IN')} | Due: ₹{totalFilteredTeaBal.toLocaleString('en-IN')}
              {totalFilteredTeaExtra > 0 ? ` | Extra: ₹${totalFilteredTeaExtra.toLocaleString('en-IN')}` : ''})
            </div>
          </div>

          <div className="table-container">
            <div className="data-table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>☕ Tea</th>
                    <th>🍪 Snacks</th>
                    <th>🧃 Juice</th>
                    <th>🍱 Other</th>
                    <th>Total Daily</th>
                    <th>Paid</th>
                    <th>Balance Due</th>
                    <th>Extra Paid</th>
                    <th>Notes / Stall</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTea
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    .map(item => (
                      <tr
                        key={item.id}
                        onClick={() => openTeaDetail(item)}
                        style={{ cursor: 'pointer' }}
                        className="hover:bg-slate-800/40 transition-colors"
                      >
                        <td style={{ whiteSpace: 'nowrap' }}><strong>{item.date}</strong></td>
                        <td>₹{(item.teaExpense || 0).toLocaleString('en-IN')}</td>
                        <td>₹{(item.snacksExpense || 0).toLocaleString('en-IN')}</td>
                        <td style={{ color: '#10b981', fontWeight: 600 }}>
                          ₹{(item.juiceExpense || 0).toLocaleString('en-IN')}
                        </td>
                        <td>₹{(item.otherFoodExpense || 0).toLocaleString('en-IN')}</td>
                        <td>
                          <strong style={{ fontFamily: 'var(--font-heading)', fontSize: '1rem' }}>
                            ₹{item.totalAmount.toLocaleString('en-IN')}
                          </strong>
                        </td>
                        <td style={{ color: 'var(--success)', fontWeight: 600 }}>
                          ₹{item.paidAmount.toLocaleString('en-IN')}
                        </td>
                        <td>
                          <span style={{ fontWeight: 700, color: item.balance > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>
                            ₹{item.balance.toLocaleString('en-IN')}
                          </span>
                        </td>
                        <td>
                          {(item.extraPaid || 0) > 0 ? (
                            <span style={{ fontWeight: 700, color: 'var(--primary)' }}>
                              ₹{(item.extraPaid || 0).toLocaleString('en-IN')}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>₹0</span>
                          )}
                        </td>
                        <td style={{ color: 'var(--text-muted)' }}>{item.notes || '-'}</td>
                        <td>
                          <div style={{ display: 'flex', gap: '4px' }} onClick={e => e.stopPropagation()}>
                            <button
                              className="btn btn-sm btn-outline"
                              title="Payment Transactions"
                              style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px' }}
                              onClick={(e) => {
                                e.stopPropagation();
                                setPaymentModalData({
                                  isOpen: true,
                                  relatedRecordId: item.id,
                                  tableName: 'teaSnacksExpenses',
                                  title: `Tea/Snacks - ${item.date}`,
                                  subtitle: item.notes || 'Daily Tea Stall Expense',
                                  module: 'Tea & Snacks',
                                  totalAmount: item.totalAmount,
                                });
                              }}
                            >
                              <Receipt size={13} />
                              <span style={{ fontSize: '0.75rem' }}>Payments</span>
                            </button>
                            <button
                              className="btn btn-sm btn-outline"
                              title="Edit"
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpenTeaModal(item);
                              }}
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              className="btn btn-sm btn-danger"
                              title="Move to Recycle Bin"
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteTea(item);
                              }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}

                  {filteredTea.length === 0 && (
                    <tr>
                      <td colSpan={11} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                        No tea and snacks recorded for this timeframe.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 2. POOJA SUBSECTION */}
      {subSection === 'pooja' && (
        <div>
          <div style={{ marginBottom: '16px' }}>
            <InteractiveHoverCard
              item={{
                id: 'exp-pooja',
                title: 'Site Pooja & Auspicious Ceremonies',
                description: `Bhoomi Pooja, Pillar/Vasthu Pooja, Roof Concrete Pooja rituals. Total: ₹${totalPoojaCost.toLocaleString('en-IN')} across ${poojas.length} ceremonies.`,
                imageUrl: getExpenseVisual('pooja').imageUrl,
                imageAlt: 'Pooja Ceremony',
                icon: <Sparkles size={18} />,
                badge: `${poojas.length} Ceremonies`,
                stats: [{ label: 'Total', value: `₹${totalPoojaCost.toLocaleString('en-IN')}` }],
                onClick: () => {
                  setExpenseModalData({
                    title: 'Site Ceremonies & Poojas',
                    subtitle: 'Bhoomi Pooja, Vasthu, and Roof Concreting auspicious rituals',
                    categoryBadge: 'Pooja',
                    badgeVariant: 'warning',
                    imageUrl: getExpenseVisual('pooja').imageUrl,
                    imageAlt: 'Pooja Ceremony',
                    details: [
                      { label: 'Total Ceremonies', value: `${poojas.length} recorded`, highlight: true },
                      { label: 'Total Ritual Spend', value: `₹${totalPoojaCost.toLocaleString('en-IN')}`, highlight: true },
                      { label: 'Flowers & Items', value: `₹${poojas.reduce((a, p) => a + p.materialsExpense, 0).toLocaleString('en-IN')}` },
                      { label: 'Priest Sambhavana', value: `₹${poojas.reduce((a, p) => a + p.priestExpense, 0).toLocaleString('en-IN')}` },
                    ],
                    financials: {
                      totalAmount: totalPoojaCost,
                      paidAmount: poojas.reduce((a, p) => a + p.paidAmount, 0),
                    },
                  });
                },
              }}
            />
          </div>

          <div className="table-container">
            <div className="table-header-bar">
              <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                Site Pooja & Ceremony Expenses ({poojas.length} records)
              </span>
              <button className="btn btn-sm btn-primary" onClick={() => onOpenPoojaModal()}>
                <PlusCircle size={15} />
                <span>Add Pooja</span>
              </button>
            </div>

            <div className="data-table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Pooja Name</th>
                    <th>Materials & Flowers</th>
                    <th>Priest Sambhavana</th>
                    <th>Other Expenses</th>
                    <th>Total Cost</th>
                    <th>Paid</th>
                    <th>Balance Due</th>
                    <th>Extra Paid</th>
                    <th>Notes</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {poojas
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    .map(p => (
                      <tr
                        key={p.id}
                        onClick={() => openPoojaDetail(p)}
                        style={{ cursor: 'pointer' }}
                        className="hover:bg-slate-800/40 transition-colors"
                      >
                        <td style={{ whiteSpace: 'nowrap' }}>{p.date}</td>
                        <td><strong>{p.poojaName}</strong></td>
                        <td>₹{p.materialsExpense.toLocaleString('en-IN')}</td>
                        <td>₹{p.priestExpense.toLocaleString('en-IN')}</td>
                        <td>₹{p.otherExpense.toLocaleString('en-IN')}</td>
                        <td>
                          <strong style={{ fontFamily: 'var(--font-heading)', fontSize: '1rem', color: 'var(--purple-text)' }}>
                            ₹{p.totalAmount.toLocaleString('en-IN')}
                          </strong>
                        </td>
                        <td style={{ color: 'var(--success)', fontWeight: 600 }}>
                          ₹{p.paidAmount.toLocaleString('en-IN')}
                        </td>
                        <td>
                          <span style={{ fontWeight: 700, color: p.balance > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>
                            ₹{p.balance.toLocaleString('en-IN')}
                          </span>
                        </td>
                        <td>
                          {(p.extraPaid || 0) > 0 ? (
                            <span style={{ fontWeight: 700, color: 'var(--primary)' }}>
                              ₹{(p.extraPaid || 0).toLocaleString('en-IN')}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>₹0</span>
                          )}
                        </td>
                        <td style={{ color: 'var(--text-muted)' }}>{p.notes || '-'}</td>
                        <td>
                          <div style={{ display: 'flex', gap: '4px' }} onClick={e => e.stopPropagation()}>
                            <button
                              className="btn btn-sm btn-outline"
                              title="Payment Transactions"
                              style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px' }}
                              onClick={(e) => {
                                e.stopPropagation();
                                setPaymentModalData({
                                  isOpen: true,
                                  relatedRecordId: p.id,
                                  tableName: 'poojaExpenses',
                                  title: p.poojaName,
                                  subtitle: `Site Ceremony Expense - ${p.date}`,
                                  module: 'Pooja',
                                  totalAmount: p.totalAmount,
                                });
                              }}
                            >
                              <Receipt size={13} />
                              <span style={{ fontSize: '0.75rem' }}>Payments</span>
                            </button>
                            <button
                              className="btn btn-sm btn-outline"
                              title="Edit Pooja"
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpenPoojaModal(p);
                              }}
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              className="btn btn-sm btn-danger"
                              title="Move to Recycle Bin"
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeletePooja(p);
                              }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}

                {poojas.length === 0 && (
                  <tr>
                    <td colSpan={11} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                      No pooja ceremony expenses recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      )}

      {/* 3. OTHER EXPENSES SUBSECTION */}
      {subSection === 'other' && (
        <div>
          <div style={{ marginBottom: '16px' }}>
            <InteractiveHoverCard
              item={{
                id: 'exp-other',
                title: 'Transport, Fuel & Miscellaneous',
                description: `Vehicle transport, machine fuel, scaffold rental, and ad-hoc operations. Total: ₹${totalOtherCost.toLocaleString('en-IN')} across ${otherExpenses.length} entries.`,
                imageUrl: getExpenseVisual('other').imageUrl,
                imageAlt: 'Site Operations',
                icon: <Wallet size={18} />,
                badge: `${otherExpenses.length} Entries`,
                stats: [{ label: 'Total', value: `₹${totalOtherCost.toLocaleString('en-IN')}` }],
                onClick: () => {
                  setExpenseModalData({
                    title: 'Miscellaneous Site Operations',
                    subtitle: 'Transport, fuel, machinery maintenance, and site logistics',
                    categoryBadge: 'Operations',
                    badgeVariant: 'primary',
                    imageUrl: getExpenseVisual('other').imageUrl,
                    imageAlt: 'Site Operations',
                    details: [
                      { label: 'Total Recorded', value: `${otherExpenses.length} items`, highlight: true },
                      { label: 'Total Amount', value: `₹${totalOtherCost.toLocaleString('en-IN')}`, highlight: true },
                      { label: 'Categories', value: 'Transport, Fuel, Repairs, Site Safety, Permit' },
                    ],
                    financials: {
                      totalAmount: totalOtherCost,
                      paidAmount: otherExpenses.reduce((a, o) => a + o.paidAmount, 0),
                    },
                  });
                },
              }}
            />
          </div>

          <div className="table-container">
            <div className="table-header-bar">
              <span style={{ fontWeight: 700, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Wallet size={18} color="var(--primary)" />
                Transport, Fuel, Repairs & Miscellaneous Expenses ({otherExpenses.length} records)
              </span>
              <button className="btn btn-sm btn-primary" onClick={() => onOpenOtherModal()}>
                <PlusCircle size={15} />
                <span>Add Expense</span>
              </button>
            </div>

            <div className="data-table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Category</th>
                    <th>Description / Vendor</th>
                    <th>Total Amount</th>
                    <th>Paid Amount</th>
                    <th>Balance Due</th>
                    <th>Extra Paid</th>
                    <th>Notes</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {otherExpenses
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    .map(oth => (
                      <tr
                        key={oth.id}
                        onClick={() => openOtherDetail(oth)}
                        style={{ cursor: 'pointer' }}
                        className="hover:bg-slate-800/40 transition-colors"
                      >
                        <td style={{ whiteSpace: 'nowrap' }}><strong>{oth.date}</strong></td>
                        <td>
                          <span className="badge badge-demo" style={{ fontSize: '0.75rem' }}>
                            {oth.category}
                          </span>
                        </td>
                        <td><strong>{oth.description}</strong></td>
                        <td>
                          <strong style={{ fontFamily: 'var(--font-heading)', fontSize: '1rem' }}>
                            ₹{oth.amount.toLocaleString('en-IN')}
                          </strong>
                        </td>
                        <td style={{ color: 'var(--success)', fontWeight: 600 }}>
                          ₹{oth.paidAmount.toLocaleString('en-IN')}
                        </td>
                        <td>
                          <span style={{ fontWeight: 700, color: oth.balance > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>
                            ₹{oth.balance.toLocaleString('en-IN')}
                          </span>
                        </td>
                        <td>
                          {(oth.extraPaid || 0) > 0 ? (
                            <span style={{ fontWeight: 700, color: 'var(--primary)' }}>
                              ₹{(oth.extraPaid || 0).toLocaleString('en-IN')}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>₹0</span>
                          )}
                        </td>
                        <td style={{ color: 'var(--text-muted)' }}>{oth.notes || '-'}</td>
                        <td>
                          <div style={{ display: 'flex', gap: '4px' }} onClick={e => e.stopPropagation()}>
                            <button
                              className="btn btn-sm btn-outline"
                              title="Payment Transactions"
                              style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px' }}
                              onClick={(e) => {
                                e.stopPropagation();
                                setPaymentModalData({
                                  isOpen: true,
                                  relatedRecordId: oth.id,
                                  tableName: 'otherExpenses',
                                  title: oth.description,
                                  subtitle: `${oth.category} - ${oth.date}`,
                                  module: 'Other Expense',
                                  totalAmount: oth.amount,
                                });
                              }}
                            >
                              <Receipt size={13} />
                              <span style={{ fontSize: '0.75rem' }}>Payments</span>
                            </button>
                            <button
                              className="btn btn-sm btn-outline"
                              title="Edit Expense"
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpenOtherModal(oth);
                              }}
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              className="btn btn-sm btn-danger"
                              title="Move to Recycle Bin"
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteOther(oth);
                              }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}

                  {otherExpenses.length === 0 && (
                    <tr>
                      <td colSpan={9} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                        No other expenses logged yet. Track scaffolding transport, generator fuel, machine repairs, etc.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 4. ELECTRICITY SUBSECTION */}
      {subSection === 'electricity' && (
        <div>
          <div style={{ marginBottom: '16px' }}>
            <InteractiveHoverCard
              item={{
                id: 'exp-electricity',
                title: 'Site Electricity & EB Power',
                description: `Site EB service bills, temporary connection charges, meter maintenance. Total: ₹${totalElecCost.toLocaleString('en-IN')} (${electricity.length} bills).`,
                imageUrl: getExpenseVisual('electricity').imageUrl,
                imageAlt: 'Electricity Bill',
                icon: <Zap size={18} />,
                badge: `${electricity.length} EB Bills`,
                stats: [{ label: 'Total', value: `₹${totalElecCost.toLocaleString('en-IN')}` }],
                onClick: () => {
                  setExpenseModalData({
                    title: 'Site Electricity (TNEB / EB)',
                    subtitle: 'Temporary and permanent electrical utility bills',
                    categoryBadge: 'EB Current',
                    badgeVariant: 'warning',
                    imageUrl: getExpenseVisual('electricity').imageUrl,
                    imageAlt: 'Electricity Bill',
                    details: [
                      { label: 'Total EB Bills', value: `${electricity.length} logged`, highlight: true },
                      { label: 'Total Power Spend', value: `₹${totalElecCost.toLocaleString('en-IN')}`, highlight: true },
                      { label: 'Service Type', value: 'Temporary Commercial / Domestic Construction Supply' },
                    ],
                    financials: {
                      totalAmount: totalElecCost,
                      paidAmount: electricity.reduce((a, e) => a + e.paidAmount, 0),
                    },
                  });
                },
              }}
            />
          </div>

          <div className="table-container">
            <div className="table-header-bar">
              <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                Site Electricity Bills ({electricity.length} bills)
              </span>
              <button className="btn btn-sm btn-primary" onClick={() => onOpenElectricityModal()}>
                <PlusCircle size={15} />
                <span>Record Electricity Bill</span>
              </button>
            </div>

            <div className="data-table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Month / Period</th>
                    <th>Meter / Consumer No</th>
                    <th>Bill Amount</th>
                    <th>Paid Amount</th>
                    <th>Balance Due</th>
                    <th>Extra Paid</th>
                    <th>Due Date</th>
                    <th>Notes</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {electricity.map(elec => (
                    <tr
                      key={elec.id}
                      onClick={() => openElectricityDetail(elec)}
                      style={{ cursor: 'pointer' }}
                      className="hover:bg-slate-800/40 transition-colors"
                    >
                      <td><strong>{elec.month}</strong></td>
                      <td>{elec.meterNumber || '-'}</td>
                      <td>
                        <strong style={{ fontFamily: 'var(--font-heading)', fontSize: '1rem' }}>
                          ₹{elec.billAmount.toLocaleString('en-IN')}
                        </strong>
                      </td>
                      <td style={{ color: 'var(--success)', fontWeight: 600 }}>
                        ₹{elec.paidAmount.toLocaleString('en-IN')}
                      </td>
                      <td>
                        <span style={{ fontWeight: 700, color: elec.balance > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>
                          ₹{elec.balance.toLocaleString('en-IN')}
                        </span>
                      </td>
                      <td>
                        {(elec.extraPaid || 0) > 0 ? (
                          <span style={{ fontWeight: 700, color: 'var(--primary)' }}>
                            ₹{(elec.extraPaid || 0).toLocaleString('en-IN')}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>₹0</span>
                        )}
                      </td>
                      <td>{elec.dueDate || '-'}</td>
                      <td style={{ color: 'var(--text-muted)' }}>{elec.notes || '-'}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '4px' }} onClick={e => e.stopPropagation()}>
                          <button
                            className="btn btn-sm btn-outline"
                            title="Payment Transactions"
                            style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setPaymentModalData({
                                isOpen: true,
                                relatedRecordId: elec.id,
                                tableName: 'electricityBills',
                                title: `Electricity Bill (${elec.month})`,
                                subtitle: elec.meterNumber ? `Meter: ${elec.meterNumber}` : undefined,
                                module: 'Electricity',
                                totalAmount: elec.billAmount,
                              });
                            }}
                          >
                            <Receipt size={13} />
                            <span style={{ fontSize: '0.75rem' }}>Payments</span>
                          </button>
                          <button
                            className="btn btn-sm btn-outline"
                            title="Edit Bill"
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenElectricityModal(elec);
                            }}
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            className="btn btn-sm btn-danger"
                            title="Move to Recycle Bin"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteElectricity(elec);
                            }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}

                  {electricity.length === 0 && (
                    <tr>
                      <td colSpan={9} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                        No electricity bills logged. Track temporary power and EB bills by clicking above.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 5. WATER SUBSECTION */}
      {subSection === 'water' && (
        <div>
          <div style={{ marginBottom: '16px' }}>
            <InteractiveHoverCard
              item={{
                id: 'exp-water',
                title: 'Water Supply & Tankers',
                description: `Curing water, concrete mixing water tankers, borewell supply. Total: ₹${totalWaterCost.toLocaleString('en-IN')} (${water.length} deliveries).`,
                imageUrl: getExpenseVisual('water').imageUrl,
                imageAlt: 'Water Tanker',
                icon: <Droplets size={18} />,
                badge: `${water.length} Loads`,
                stats: [{ label: 'Total', value: `₹${totalWaterCost.toLocaleString('en-IN')}` }],
                onClick: () => {
                  setExpenseModalData({
                    title: 'Construction Water Tankers',
                    subtitle: 'Water supplies for brick curing, slab curing and plastering',
                    categoryBadge: 'Water Supply',
                    badgeVariant: 'info',
                    imageUrl: getExpenseVisual('water').imageUrl,
                    imageAlt: 'Water Tanker',
                    details: [
                      { label: 'Total Water Loads', value: `${water.length} records`, highlight: true },
                      { label: 'Total Water Cost', value: `₹${totalWaterCost.toLocaleString('en-IN')}`, highlight: true },
                      { label: 'Total Tanker Volume', value: `${water.reduce((a, w) => a + (Number(w.quantityLoads) || 1), 0)} tanker loads approx` },
                    ],
                    financials: {
                      totalAmount: totalWaterCost,
                      paidAmount: water.reduce((a, w) => a + w.paidAmount, 0),
                    },
                  });
                },
              }}
            />
          </div>

          <div className="table-container">
            <div className="table-header-bar">
              <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                Water Tankers & Supply Expenses ({water.length} records)
              </span>
              <button className="btn btn-sm btn-primary" onClick={() => onOpenWaterModal()}>
                <PlusCircle size={15} />
                <span>Record Water Supply</span>
              </button>
            </div>

            <div className="data-table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Delivery Date</th>
                    <th>Water Supplier</th>
                    <th>Quantity / Tankers</th>
                    <th>Bill Amount</th>
                    <th>Paid Amount</th>
                    <th>Balance Due</th>
                    <th>Extra Paid</th>
                    <th>Notes</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {water.map(w => (
                    <tr
                      key={w.id}
                      onClick={() => openWaterDetail(w)}
                      style={{ cursor: 'pointer' }}
                      className="hover:bg-slate-800/40 transition-colors"
                    >
                      <td style={{ whiteSpace: 'nowrap' }}><strong>{w.date}</strong></td>
                      <td>{w.supplier}</td>
                      <td><strong>{w.quantityLoads || '-'}</strong></td>
                      <td>
                        <strong style={{ fontFamily: 'var(--font-heading)', fontSize: '1rem' }}>
                          ₹{w.billAmount.toLocaleString('en-IN')}
                        </strong>
                      </td>
                      <td style={{ color: 'var(--success)', fontWeight: 600 }}>
                        ₹{w.paidAmount.toLocaleString('en-IN')}
                      </td>
                      <td>
                        <span style={{ fontWeight: 700, color: w.balance > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>
                          ₹{w.balance.toLocaleString('en-IN')}
                        </span>
                      </td>
                      <td>
                        {(w.extraPaid || 0) > 0 ? (
                          <span style={{ fontWeight: 700, color: 'var(--primary)' }}>
                            ₹{(w.extraPaid || 0).toLocaleString('en-IN')}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>₹0</span>
                        )}
                      </td>
                      <td style={{ color: 'var(--text-muted)' }}>{w.notes || '-'}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '4px' }} onClick={e => e.stopPropagation()}>
                          <button
                            className="btn btn-sm btn-outline"
                            title="Payment Transactions"
                            style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setPaymentModalData({
                                isOpen: true,
                                relatedRecordId: w.id,
                                tableName: 'waterBills',
                                title: `Water Supply - ${w.supplier}`,
                                subtitle: `${w.quantityLoads || ''} Tankers - ${w.date}`,
                                module: 'Water',
                                totalAmount: w.billAmount,
                              });
                            }}
                          >
                            <Receipt size={13} />
                            <span style={{ fontSize: '0.75rem' }}>Payments</span>
                          </button>
                          <button
                            className="btn btn-sm btn-outline"
                            title="Edit Water Record"
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenWaterModal(w);
                            }}
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            className="btn btn-sm btn-danger"
                            title="Move to Recycle Bin"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteWater(w);
                            }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}

                  {water.length === 0 && (
                    <tr>
                      <td colSpan={9} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                        No water supply records logged yet. Track water tanker deliveries and borewell expenses here.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

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

      {/* Universal Item Details Modal for Expenses */}
      {expenseModalData && (
        <ItemDetailsModal
          isOpen={!!expenseModalData}
          onClose={() => setExpenseModalData(null)}
          title={expenseModalData.title}
          subtitle={expenseModalData.subtitle}
          categoryBadge={expenseModalData.categoryBadge}
          badgeVariant={expenseModalData.badgeVariant}
          imageUrl={expenseModalData.imageUrl}
          imageAlt={expenseModalData.imageAlt}
          details={expenseModalData.details}
          financials={expenseModalData.financials}
          onEdit={expenseModalData.onEdit}
          actions={[
            ...(expenseModalData.onPaymentLedger ? [{
              label: 'Payment Ledger',
              icon: <Receipt size={14} />,
              onClick: expenseModalData.onPaymentLedger,
              variant: 'outline' as const,
            }] : []),
          ]}
        />
      )}
    </div>
  );
};
