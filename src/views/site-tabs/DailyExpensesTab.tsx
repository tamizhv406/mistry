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
  LayoutGrid,
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
import { calculateFinancialBalance } from '../../utils/financial';
import type { FallbackCategory } from '../../components/ui/SafeImage';

interface DailyExpensesTabProps {
  siteId: string;
  teaSnacks: TeaSnacksExpense[];
  poojas: PoojaExpense[];
  electricity: ElectricityBill[];
  water: WaterBill[];
  otherExpenses: OtherExpense[];
  initialSection?: 'all' | 'tea' | 'pooja' | 'electricity' | 'water' | 'other';
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
  initialSection = 'all',
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
  const [subSection, setSubSection] = useState<'all' | 'tea' | 'pooja' | 'electricity' | 'water' | 'other'>(initialSection);
  const [teaFilter, setTeaFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');

  // Unified Item Details Modal state for expenses
  const [expenseModalData, setExpenseModalData] = useState<{
    title: string;
    subtitle?: string;
    categoryBadge?: string;
    badgeVariant?: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';
    imageUrl: string;
    imageAlt?: string;
    fallbackCategory?: FallbackCategory;
    fallbackSrc?: string;
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

  // Universal Financial Balances for each of the 8 expense categories
  const teaPaidRatio = (totalFilteredTeaCost > 0) ? (totalFilteredTeaPaid / totalFilteredTeaCost) : 1;
  const teaPaidEst = Math.round(totalFilteredTeaOnly * teaPaidRatio);
  const teaFin = calculateFinancialBalance(totalFilteredTeaOnly, teaPaidEst);

  const snacksPaidEst = Math.round(totalFilteredSnacksOnly * teaPaidRatio);
  const snacksFin = calculateFinancialBalance(totalFilteredSnacksOnly, snacksPaidEst);

  const juicePaidEst = Math.round(totalFilteredJuiceOnly * teaPaidRatio);
  const juiceFin = calculateFinancialBalance(totalFilteredJuiceOnly, juicePaidEst);

  const foodPaidEst = Math.round(totalFilteredOtherOnly * teaPaidRatio);
  const foodFin = calculateFinancialBalance(totalFilteredOtherOnly, foodPaidEst);

  const totalPoojaPaid = poojas.reduce((acc, p) => acc + p.paidAmount, 0);
  const poojaFin = calculateFinancialBalance(totalPoojaCost, totalPoojaPaid);

  const totalOtherPaid = otherExpenses.reduce((acc, o) => acc + o.paidAmount, 0);
  const otherFin = calculateFinancialBalance(totalOtherCost, totalOtherPaid);

  const totalElecPaid = electricity.reduce((acc, e) => acc + e.paidAmount, 0);
  const elecFin = calculateFinancialBalance(totalElecCost, totalElecPaid);

  const totalWaterPaid = water.reduce((acc, w) => acc + w.paidAmount, 0);
  const waterFin = calculateFinancialBalance(totalWaterCost, totalWaterPaid);

  const grandTotalExpenses = totalFilteredTeaCost + totalPoojaCost + totalOtherCost + totalElecCost + totalWaterCost;

  // Master 8 Daily Expense Categories Cards with Tamil descriptions and 4 financial metrics
  const expenseCategoryCards: InteractiveHoverItem[] = [
    {
      id: 'cat-tea',
      title: 'Tea & Coffee',
      tamilTitle: 'டீ & காபி',
      description: 'Morning & evening hot tea, filter coffee & milk for site workers • தொழிலாளர் காலை & மாலை தேநீர்',
      imageUrl: getExpenseVisual('tea').imageUrl,
      imageAlt: 'Tea & Coffee',
      fallbackCategory: 'tea',
      icon: <Coffee size={18} />,
      badge: 'Refreshment',
      badgeVariant: 'warning',
      stats: [
        { label: 'Total Amount', value: `₹${teaFin.totalAmount.toLocaleString('en-IN')}` },
        { label: 'Paid Amount', value: `₹${teaFin.paidAmount.toLocaleString('en-IN')}`, color: '#34d399' },
        { label: 'Balance Due', value: `₹${teaFin.balanceDue.toLocaleString('en-IN')}`, color: teaFin.balanceDue > 0 ? '#f87171' : '#94a3b8' },
        { label: 'Extra Paid', value: `₹${teaFin.extraPaid.toLocaleString('en-IN')}`, color: teaFin.extraPaid > 0 ? '#38bdf8' : '#94a3b8' },
      ],
      onClick: () => {
        setExpenseModalData({
          title: 'Tea & Coffee (தேநீர் & காபி)',
          subtitle: 'Daily site hot tea, filter coffee & milk for workforce',
          categoryBadge: 'Refreshments',
          badgeVariant: 'warning',
          imageUrl: getExpenseVisual('tea').imageUrl,
          imageAlt: 'Tea & Coffee',
          fallbackCategory: 'tea',
          details: [
            { label: 'Total Tea Spend', value: `₹${teaFin.totalAmount.toLocaleString('en-IN')}`, highlight: true },
            { label: 'Paid Amount', value: `₹${teaFin.paidAmount.toLocaleString('en-IN')}` },
            { label: 'Balance Due', value: `₹${teaFin.balanceDue.toLocaleString('en-IN')}` },
            { label: 'Extra Paid', value: `₹${teaFin.extraPaid.toLocaleString('en-IN')}` },
            { label: 'Filtered Days Logged', value: `${filteredTea.length} days` },
            { label: 'Tamil Translation', value: 'டீ மற்றும் காபி செலவுகள்' },
          ],
          financials: {
            totalAmount: teaFin.totalAmount,
            paidAmount: teaFin.paidAmount,
          },
        });
      },
    },
    {
      id: 'cat-snacks',
      title: 'Snacks & Vada',
      tamilTitle: 'ஸ்நாக்ஸ் & வடை',
      description: 'Medu vada, bajji, samosa, bun butter & biscuits for labour crew • மாலை சிற்றுண்டி மற்றும் வடை வகைகள்',
      imageUrl: getExpenseVisual('snacks').imageUrl,
      imageAlt: 'Snacks & Vada',
      fallbackCategory: 'snacks',
      icon: <Tag size={18} />,
      badge: 'Snacks',
      badgeVariant: 'warning',
      stats: [
        { label: 'Total Amount', value: `₹${snacksFin.totalAmount.toLocaleString('en-IN')}` },
        { label: 'Paid Amount', value: `₹${snacksFin.paidAmount.toLocaleString('en-IN')}`, color: '#34d399' },
        { label: 'Balance Due', value: `₹${snacksFin.balanceDue.toLocaleString('en-IN')}`, color: snacksFin.balanceDue > 0 ? '#f87171' : '#94a3b8' },
        { label: 'Extra Paid', value: `₹${snacksFin.extraPaid.toLocaleString('en-IN')}`, color: snacksFin.extraPaid > 0 ? '#38bdf8' : '#94a3b8' },
      ],
      onClick: () => {
        setExpenseModalData({
          title: 'Snacks & Vada (சிற்றுண்டி & வடை)',
          subtitle: 'Morning & evening tea-break snacks for labour crew',
          categoryBadge: 'Snacks',
          badgeVariant: 'warning',
          imageUrl: getExpenseVisual('snacks').imageUrl,
          imageAlt: 'Snacks & Vada',
          fallbackCategory: 'snacks',
          details: [
            { label: 'Total Snacks Spend', value: `₹${snacksFin.totalAmount.toLocaleString('en-IN')}`, highlight: true },
            { label: 'Paid Amount', value: `₹${snacksFin.paidAmount.toLocaleString('en-IN')}` },
            { label: 'Balance Due', value: `₹${snacksFin.balanceDue.toLocaleString('en-IN')}` },
            { label: 'Extra Paid', value: `₹${snacksFin.extraPaid.toLocaleString('en-IN')}` },
            { label: 'Snack Items', value: 'Medu Vada, Masala Vada, Bajji, Samosa, Biscuits' },
            { label: 'Tamil Translation', value: 'மாலை நேர சிற்றுண்டி' },
          ],
          financials: {
            totalAmount: snacksFin.totalAmount,
            paidAmount: snacksFin.paidAmount,
          },
        });
      },
    },
    {
      id: 'cat-juice',
      title: 'Juice & Cooling',
      tamilTitle: 'பழச்சாறு & குளிர்பானம்',
      description: 'Fresh lemon juice, tender coconut, buttermilk & summer cooling • கோடை தாகம் தணிக்கும் பழச்சாறு',
      imageUrl: getExpenseVisual('juice').imageUrl,
      imageAlt: 'Juice & Cooling',
      fallbackCategory: 'juice',
      icon: <Sparkles size={18} />,
      badge: 'Cool Drinks',
      badgeVariant: 'success',
      stats: [
        { label: 'Total Amount', value: `₹${juiceFin.totalAmount.toLocaleString('en-IN')}` },
        { label: 'Paid Amount', value: `₹${juiceFin.paidAmount.toLocaleString('en-IN')}`, color: '#34d399' },
        { label: 'Balance Due', value: `₹${juiceFin.balanceDue.toLocaleString('en-IN')}`, color: juiceFin.balanceDue > 0 ? '#f87171' : '#94a3b8' },
        { label: 'Extra Paid', value: `₹${juiceFin.extraPaid.toLocaleString('en-IN')}`, color: juiceFin.extraPaid > 0 ? '#38bdf8' : '#94a3b8' },
      ],
      onClick: () => {
        setExpenseModalData({
          title: 'Juice & Cooling (பழச்சாறு & குளிர்பானம்)',
          subtitle: 'Summer cooling juices, lemon hydration, and tender coconut for workers',
          categoryBadge: 'Beverages',
          badgeVariant: 'success',
          imageUrl: getExpenseVisual('juice').imageUrl,
          imageAlt: 'Fresh Juice',
          fallbackCategory: 'juice',
          details: [
            { label: 'Total Juice Spend', value: `₹${juiceFin.totalAmount.toLocaleString('en-IN')}`, highlight: true },
            { label: 'Paid Amount', value: `₹${juiceFin.paidAmount.toLocaleString('en-IN')}` },
            { label: 'Balance Due', value: `₹${juiceFin.balanceDue.toLocaleString('en-IN')}` },
            { label: 'Extra Paid', value: `₹${juiceFin.extraPaid.toLocaleString('en-IN')}` },
            { label: 'Beverage Types', value: 'Lemon Juice, Sugarcane, Buttermilk, Tender Coconut' },
            { label: 'Tamil Translation', value: 'கோடை குளிர்பானங்கள்' },
          ],
          financials: {
            totalAmount: juiceFin.totalAmount,
            paidAmount: juiceFin.paidAmount,
          },
        });
      },
    },
    {
      id: 'cat-food',
      title: 'Meals & Food',
      tamilTitle: 'உணவு & சாப்பாடு',
      description: 'Worker lunch meals, overtime tiffin & night concrete parcels • மதிய உணவு & இரவு உணவு பொட்டலங்கள்',
      imageUrl: getExpenseVisual('food').imageUrl,
      imageAlt: 'Meals & Food',
      fallbackCategory: 'food',
      icon: <Building size={18} />,
      badge: 'Meals / Tiffin',
      badgeVariant: 'info',
      stats: [
        { label: 'Total Amount', value: `₹${foodFin.totalAmount.toLocaleString('en-IN')}` },
        { label: 'Paid Amount', value: `₹${foodFin.paidAmount.toLocaleString('en-IN')}`, color: '#34d399' },
        { label: 'Balance Due', value: `₹${foodFin.balanceDue.toLocaleString('en-IN')}`, color: foodFin.balanceDue > 0 ? '#f87171' : '#94a3b8' },
        { label: 'Extra Paid', value: `₹${foodFin.extraPaid.toLocaleString('en-IN')}`, color: foodFin.extraPaid > 0 ? '#38bdf8' : '#94a3b8' },
      ],
      onClick: () => {
        setExpenseModalData({
          title: 'Meals & Food (உணவு & சாப்பாடு)',
          subtitle: 'Overtime food parcels and noon meal expenses for concreting crew',
          categoryBadge: 'Food',
          badgeVariant: 'info',
          imageUrl: getExpenseVisual('food').imageUrl,
          imageAlt: 'Meals & Food',
          fallbackCategory: 'food',
          details: [
            { label: 'Total Food Spend', value: `₹${foodFin.totalAmount.toLocaleString('en-IN')}`, highlight: true },
            { label: 'Paid Amount', value: `₹${foodFin.paidAmount.toLocaleString('en-IN')}` },
            { label: 'Balance Due', value: `₹${foodFin.balanceDue.toLocaleString('en-IN')}` },
            { label: 'Extra Paid', value: `₹${foodFin.extraPaid.toLocaleString('en-IN')}` },
            { label: 'Meal Types', value: 'Full Meals, Biryani parcels, Night shift tiffin' },
            { label: 'Tamil Translation', value: 'தொழிலாளர் சாப்பாடு மற்றும் சிற்றுண்டி' },
          ],
          financials: {
            totalAmount: foodFin.totalAmount,
            paidAmount: foodFin.paidAmount,
          },
        });
      },
    },
    {
      id: 'cat-pooja',
      title: 'Pooja',
      tamilTitle: 'பூஜை & சடங்கு',
      description: 'Bhoomi Pooja, Pillar/Vasthu Pooja, and Roof Slab ceremonies • பூமி பூஜை, வாஸ்து மற்றும் கூரை மங்கல சடங்குகள்',
      imageUrl: getExpenseVisual('pooja').imageUrl,
      imageAlt: 'Pooja Ceremony',
      fallbackCategory: 'pooja',
      icon: <Sparkles size={18} />,
      badge: `${poojas.length} Ceremonies`,
      badgeVariant: 'warning',
      stats: [
        { label: 'Total Amount', value: `₹${poojaFin.totalAmount.toLocaleString('en-IN')}` },
        { label: 'Paid Amount', value: `₹${poojaFin.paidAmount.toLocaleString('en-IN')}`, color: '#34d399' },
        { label: 'Balance Due', value: `₹${poojaFin.balanceDue.toLocaleString('en-IN')}`, color: poojaFin.balanceDue > 0 ? '#f87171' : '#94a3b8' },
        { label: 'Extra Paid', value: `₹${poojaFin.extraPaid.toLocaleString('en-IN')}`, color: poojaFin.extraPaid > 0 ? '#38bdf8' : '#94a3b8' },
      ],
      onClick: () => {
        setExpenseModalData({
          title: 'Site Pooja & Ceremonies (பூஜை செலவுகள்)',
          subtitle: 'Auspicious site rituals, flowers, fruits & priest sambhavana',
          categoryBadge: 'Pooja',
          badgeVariant: 'warning',
          imageUrl: getExpenseVisual('pooja').imageUrl,
          imageAlt: 'Pooja Ceremony',
          fallbackCategory: 'pooja',
          details: [
            { label: 'Total Ritual Spend', value: `₹${poojaFin.totalAmount.toLocaleString('en-IN')}`, highlight: true },
            { label: 'Paid Amount', value: `₹${poojaFin.paidAmount.toLocaleString('en-IN')}` },
            { label: 'Balance Due', value: `₹${poojaFin.balanceDue.toLocaleString('en-IN')}` },
            { label: 'Extra Paid', value: `₹${poojaFin.extraPaid.toLocaleString('en-IN')}` },
            { label: 'Total Ceremonies', value: `${poojas.length} rituals recorded` },
            { label: 'Tamil Translation', value: 'மங்களகரமான தள பூஜைகள்' },
          ],
          financials: {
            totalAmount: poojaFin.totalAmount,
            paidAmount: poojaFin.paidAmount,
          },
        });
      },
    },
    {
      id: 'cat-other',
      title: 'Other Expenses',
      tamilTitle: 'இதர தள செலவுகள்',
      description: 'Vehicle transport, diesel fuel, machinery repairs, safety gear • வாகன போக்குவரத்து, டீசல் மற்றும் பழுது செலவு',
      imageUrl: getExpenseVisual('other').imageUrl,
      imageAlt: 'Other Expenses',
      fallbackCategory: 'other',
      icon: <Wallet size={18} />,
      badge: `${otherExpenses.length} Entries`,
      badgeVariant: 'primary',
      stats: [
        { label: 'Total Amount', value: `₹${otherFin.totalAmount.toLocaleString('en-IN')}` },
        { label: 'Paid Amount', value: `₹${otherFin.paidAmount.toLocaleString('en-IN')}`, color: '#34d399' },
        { label: 'Balance Due', value: `₹${otherFin.balanceDue.toLocaleString('en-IN')}`, color: otherFin.balanceDue > 0 ? '#f87171' : '#94a3b8' },
        { label: 'Extra Paid', value: `₹${otherFin.extraPaid.toLocaleString('en-IN')}`, color: otherFin.extraPaid > 0 ? '#38bdf8' : '#94a3b8' },
      ],
      onClick: () => {
        setExpenseModalData({
          title: 'Other Expenses (இதர செலவுகள்)',
          subtitle: 'Site transport, fuel, machine servicing, scaffolding and ad-hoc operations',
          categoryBadge: 'Site Operations',
          badgeVariant: 'primary',
          imageUrl: getExpenseVisual('other').imageUrl,
          imageAlt: 'Other Expenses',
          fallbackCategory: 'other',
          details: [
            { label: 'Total Operations Spend', value: `₹${otherFin.totalAmount.toLocaleString('en-IN')}`, highlight: true },
            { label: 'Paid Amount', value: `₹${otherFin.paidAmount.toLocaleString('en-IN')}` },
            { label: 'Balance Due', value: `₹${otherFin.balanceDue.toLocaleString('en-IN')}` },
            { label: 'Extra Paid', value: `₹${otherFin.extraPaid.toLocaleString('en-IN')}` },
            { label: 'Total Entries', value: `${otherExpenses.length} records logged` },
            { label: 'Tamil Translation', value: 'இதர செயல்பாட்டு செலவுகள்' },
          ],
          financials: {
            totalAmount: otherFin.totalAmount,
            paidAmount: otherFin.paidAmount,
          },
        });
      },
    },
    {
      id: 'cat-electricity',
      title: 'Electricity',
      tamilTitle: 'மின்சாரம் (EB)',
      description: 'TANGEDCO temporary power connection charges and EB utility bills • தற்காலிக மின்சார வாரிய கட்டணங்கள்',
      imageUrl: getExpenseVisual('electricity').imageUrl,
      imageAlt: 'Electricity',
      fallbackCategory: 'electricity',
      icon: <Zap size={18} />,
      badge: `${electricity.length} EB Bills`,
      badgeVariant: 'warning',
      stats: [
        { label: 'Total Amount', value: `₹${elecFin.totalAmount.toLocaleString('en-IN')}` },
        { label: 'Paid Amount', value: `₹${elecFin.paidAmount.toLocaleString('en-IN')}`, color: '#34d399' },
        { label: 'Balance Due', value: `₹${elecFin.balanceDue.toLocaleString('en-IN')}`, color: elecFin.balanceDue > 0 ? '#f87171' : '#94a3b8' },
        { label: 'Extra Paid', value: `₹${elecFin.extraPaid.toLocaleString('en-IN')}`, color: elecFin.extraPaid > 0 ? '#38bdf8' : '#94a3b8' },
      ],
      onClick: () => {
        setExpenseModalData({
          title: 'Electricity Bills (மின்சார வாரிய கட்டணம்)',
          subtitle: 'Temporary commercial / construction electrical supply and bills',
          categoryBadge: 'EB Current',
          badgeVariant: 'warning',
          imageUrl: getExpenseVisual('electricity').imageUrl,
          imageAlt: 'Electricity',
          fallbackCategory: 'electricity',
          details: [
            { label: 'Total Power Spend', value: `₹${elecFin.totalAmount.toLocaleString('en-IN')}`, highlight: true },
            { label: 'Paid Amount', value: `₹${elecFin.paidAmount.toLocaleString('en-IN')}` },
            { label: 'Balance Due', value: `₹${elecFin.balanceDue.toLocaleString('en-IN')}` },
            { label: 'Extra Paid', value: `₹${elecFin.extraPaid.toLocaleString('en-IN')}` },
            { label: 'Total EB Bills', value: `${electricity.length} bills` },
            { label: 'Tamil Translation', value: 'மின்சார வாரிய (EB) பில்' },
          ],
          financials: {
            totalAmount: elecFin.totalAmount,
            paidAmount: elecFin.paidAmount,
          },
        });
      },
    },
    {
      id: 'cat-water',
      title: 'Water',
      tamilTitle: 'தண்ணீர் டேங்கர்',
      description: 'Tanker water loads for brickwork, slab curing & concrete mixing • கட்டுமான கான்கிரீட் மற்றும் நனைத்தல் தண்ணீர்',
      imageUrl: getExpenseVisual('water').imageUrl,
      imageAlt: 'Water Supply',
      fallbackCategory: 'water',
      icon: <Droplets size={18} />,
      badge: `${water.length} Water Loads`,
      badgeVariant: 'info',
      stats: [
        { label: 'Total Amount', value: `₹${waterFin.totalAmount.toLocaleString('en-IN')}` },
        { label: 'Paid Amount', value: `₹${waterFin.paidAmount.toLocaleString('en-IN')}`, color: '#34d399' },
        { label: 'Balance Due', value: `₹${waterFin.balanceDue.toLocaleString('en-IN')}`, color: waterFin.balanceDue > 0 ? '#f87171' : '#94a3b8' },
        { label: 'Extra Paid', value: `₹${waterFin.extraPaid.toLocaleString('en-IN')}`, color: waterFin.extraPaid > 0 ? '#38bdf8' : '#94a3b8' },
      ],
      onClick: () => {
        setExpenseModalData({
          title: 'Water Supply (தண்ணீர் விநியோகம்)',
          subtitle: 'Water tanker loads for column curing, brickwork, and plastering',
          categoryBadge: 'Water Supply',
          badgeVariant: 'info',
          imageUrl: getExpenseVisual('water').imageUrl,
          imageAlt: 'Water Supply',
          fallbackCategory: 'water',
          details: [
            { label: 'Total Water Spend', value: `₹${waterFin.totalAmount.toLocaleString('en-IN')}`, highlight: true },
            { label: 'Paid Amount', value: `₹${waterFin.paidAmount.toLocaleString('en-IN')}` },
            { label: 'Balance Due', value: `₹${waterFin.balanceDue.toLocaleString('en-IN')}` },
            { label: 'Extra Paid', value: `₹${waterFin.extraPaid.toLocaleString('en-IN')}` },
            { label: 'Total Deliveries', value: `${water.length} tanker loads` },
            { label: 'Tamil Translation', value: 'கட்டுமான தண்ணீர் லோடு' },
          ],
          financials: {
            totalAmount: waterFin.totalAmount,
            paidAmount: waterFin.paidAmount,
          },
        });
      },
    },
  ];

  return (
    <div>
      {/* Category Sub-Tabs */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '10px' }}>
        <div className="sub-tabs" style={{ marginBottom: 0 }}>
          <button
            className={`sub-tab-btn ${subSection === 'all' ? 'active' : ''}`}
            onClick={() => setSubSection('all')}
          >
            <LayoutGrid size={16} />
            <span>All 8 Categories (₹{grandTotalExpenses.toLocaleString('en-IN')})</span>
          </button>
          <button
            className={`sub-tab-btn ${subSection === 'tea' ? 'active' : ''}`}
            onClick={() => setSubSection('tea')}
          >
            <Coffee size={16} />
            <span>Tea & Snacks (₹{teaSnacks.reduce((a, t) => a + t.totalAmount, 0).toLocaleString('en-IN')})</span>
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
          {subSection === 'all' && (
            <button className="btn btn-primary btn-sm" onClick={() => onOpenTeaModal()}>
              <PlusCircle size={16} />
              <span>Record Site Expense</span>
            </button>
          )}
        </div>
      </div>

      {/* 0. ALL 8 CATEGORIES OVERVIEW */}
      {subSection === 'all' && (
        <div style={{ marginBottom: '24px' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '14px',
            flexWrap: 'wrap',
            gap: '8px',
          }}>
            <div>
              <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                8 Daily Site Expense Categories
              </h4>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                Tap or click any card to inspect full financial breakdown, balance due, and details
              </p>
            </div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              <button className="btn btn-sm btn-outline" onClick={() => onOpenTeaModal()}>
                <Coffee size={14} /> <span>+ Tea / Refreshment</span>
              </button>
              <button className="btn btn-sm btn-outline" onClick={() => onOpenPoojaModal()}>
                <Sparkles size={14} /> <span>+ Pooja</span>
              </button>
              <button className="btn btn-sm btn-outline" onClick={() => onOpenElectricityModal()}>
                <Zap size={14} /> <span>+ EB Bill</span>
              </button>
              <button className="btn btn-sm btn-outline" onClick={() => onOpenWaterModal()}>
                <Droplets size={14} /> <span>+ Water</span>
              </button>
              <button className="btn btn-sm btn-outline" onClick={() => onOpenOtherModal()}>
                <Wallet size={14} /> <span>+ Other Expense</span>
              </button>
            </div>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: '14px',
          }}>
            {expenseCategoryCards.map(item => (
              <InteractiveHoverCard key={item.id} item={item} />
            ))}
          </div>
        </div>
      )}

      {/* 1. TEA & SNACKS SUBSECTION */}
      {subSection === 'tea' && (
        <div>
          {/* Refreshment Visual Interactive Cards (4 Categories) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px', marginBottom: '18px' }}>
            {expenseCategoryCards.slice(0, 4).map(item => (
              <InteractiveHoverCard key={item.id} item={item} />
            ))}
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
            <InteractiveHoverCard item={expenseCategoryCards[4]} />
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
            <InteractiveHoverCard item={expenseCategoryCards[5]} />
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
            <InteractiveHoverCard item={expenseCategoryCards[6]} />
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
            <InteractiveHoverCard item={expenseCategoryCards[7]} />
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
          fallbackCategory={expenseModalData.fallbackCategory}
          fallbackSrc={expenseModalData.fallbackSrc}
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
