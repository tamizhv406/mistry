import React, { useState, useMemo, useEffect } from 'react';
import {
  Building2,
  ShieldCheck,
  Sparkles,
  Crown,
  Download,
  Share2,
  Copy,
  Check,
  SlidersHorizontal,
  ArrowRight,
  RefreshCw,
  X,
  ChevronDown,
  ChevronUp,
  Layers,
  CheckCircle2,
  FileText,
  Phone,
  User as UserIcon,
  MapPin,
  Calendar,
  Save,
  HelpCircle,
  Eye,
} from 'lucide-react';
import type { User, Site } from '../../db/types';
import {
  type PackageType,
  PACKAGE_SPECS,
  MULTI_TIER_RATE_ITEMS,
  calculateMultiTierEstimate,
  getDefaultPackageRates,
  generateWhatsAppQuoteText,
  type MultiTierEstimateResult,
} from '../../domain/buildingCalculator/multiTierEstimator';
import { generateTurnkeyQuotationPdfBlob, downloadFile } from '../../utils/pdfGenerator';
import { storageService } from '../../services/storage';

interface MultiTierEstimatorPanelProps {
  user?: User;
  sites?: Site[];
  currentSiteId?: string;
  onNotify?: (msg: string, type?: 'success' | 'error' | 'info') => void;
  initialArea?: number;
}

export const MultiTierEstimatorPanel: React.FC<MultiTierEstimatorPanelProps> = ({
  user,
  sites = [],
  currentSiteId,
  onNotify = () => {},
  initialArea = 1000,
}) => {
  // State
  const [builtUpArea, setBuiltUpArea] = useState<number>(initialArea > 0 ? initialArea : 1000);
  const [packageType, setPackageType] = useState<PackageType>('premium'); // Default to Premium as requested
  const [selectedSiteId, setSelectedSiteId] = useState<string>(currentSiteId || (sites[0]?.id || ''));
  const [clientName, setClientName] = useState<string>('');
  const [isRateDrawerOpen, setIsRateDrawerOpen] = useState<boolean>(false);
  const [customRates, setCustomRates] = useState<Record<string, number>>({});
  const [activeTab, setActiveTab] = useState<'sectionA' | 'sectionB' | 'all'>('all');
  const [showMilestones, setShowMilestones] = useState<boolean>(true);
  const [copiedQuote, setCopiedQuote] = useState<boolean>(false);
  const [savingEstimate, setSavingEstimate] = useState<boolean>(false);

  // Sync site client details when selected site changes
  const activeSite = useMemo(() => sites.find((s) => s.id === selectedSiteId), [sites, selectedSiteId]);
  useEffect(() => {
    if (activeSite) {
      const siteOwner = activeSite.ownerName || (activeSite as any).clientName;
      if (siteOwner && !clientName) {
        setClientName(siteOwner);
      }
    }
  }, [activeSite]);

  // Load custom rates from storage if saved for this site or session
  useEffect(() => {
    const defaultRates = getDefaultPackageRates(packageType);
    const storageKey = `mistry_custom_rates_${packageType}_${selectedSiteId || 'global'}`;
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        setCustomRates(JSON.parse(saved));
      } else {
        setCustomRates(defaultRates);
      }
    } catch {
      setCustomRates(defaultRates);
    }
  }, [packageType, selectedSiteId]);

  // Reset rates to package defaults
  const handleResetRates = () => {
    const defaultRates = getDefaultPackageRates(packageType);
    setCustomRates(defaultRates);
    const storageKey = `mistry_custom_rates_${packageType}_${selectedSiteId || 'global'}`;
    localStorage.removeItem(storageKey);
    onNotify(`Reset rates to ${PACKAGE_SPECS[packageType].name} defaults`, 'info');
  };

  // Update a single unit rate in real time
  const handleRateChange = (key: string, value: number) => {
    const updated = { ...customRates, [key]: Math.max(0, value) };
    setCustomRates(updated);
    const storageKey = `mistry_custom_rates_${packageType}_${selectedSiteId || 'global'}`;
    try {
      localStorage.setItem(storageKey, JSON.stringify(updated));
    } catch {
      // ignore
    }
  };

  // Run multi-tier estimation calculation engine
  const estimate: MultiTierEstimateResult = useMemo(() => {
    return calculateMultiTierEstimate(builtUpArea, packageType, customRates);
  }, [builtUpArea, packageType, customRates]);

  const formatINR = (val: number) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(val);

  // PDF Export
  const handleExportPdf = () => {
    try {
      const siteOwner = activeSite?.ownerName || (activeSite as any)?.clientName;
      const userName = user?.fullName || user?.username;
      const pdfBlob = generateTurnkeyQuotationPdfBlob({
        estimate,
        siteName: activeSite?.name || 'Turnkey Construction Project',
        clientName: clientName || siteOwner || 'Valued Client',
        location: activeSite?.address || activeSite?.area || 'Tamil Nadu',
        preparedBy: userName ? `${userName} (Building Mistry)` : 'Building Mistry Construction ERP',
      });
      const filename = `Building_Mistry_Quotation_${(activeSite?.name || 'Project').replace(/\s+/g, '_')}_${packageType}.pdf`;
      downloadFile(pdfBlob, filename);
      onNotify('Quotation PDF generated and downloaded successfully', 'success');
    } catch (err) {
      console.error('PDF export failed:', err);
      onNotify('Failed to generate PDF quotation', 'error');
    }
  };

  // WhatsApp Share
  const handleWhatsAppShare = () => {
    const siteOwner = activeSite?.ownerName || (activeSite as any)?.clientName;
    const text = generateWhatsAppQuoteText(
      estimate,
      clientName || siteOwner || 'Valued Client',
      activeSite?.name || 'Turnkey Residential Villa'
    );
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  // Copy Quotation Text to Clipboard
  const handleCopyQuote = async () => {
    const siteOwner = activeSite?.ownerName || (activeSite as any)?.clientName;
    const text = generateWhatsAppQuoteText(
      estimate,
      clientName || siteOwner || 'Valued Client',
      activeSite?.name || 'Turnkey Residential Villa'
    );
    try {
      await navigator.clipboard.writeText(text);
      setCopiedQuote(true);
      onNotify('Quotation copied to clipboard', 'success');
      setTimeout(() => setCopiedQuote(false), 2500);
    } catch {
      onNotify('Could not copy to clipboard', 'error');
    }
  };

  // Save Estimate to storageService
  const handleSaveToStorage = async () => {
    setSavingEstimate(true);
    try {
      await storageService.saveEstimate({
        siteId: selectedSiteId,
        builtUpArea,
        packageType,
        materialRates: customRates,
        totals: {
          structure: estimate.totalCivilStructureCost,
          finishing: estimate.totalFinishingCost,
          labour: estimate.totalLabourCost,
          mep: estimate.totalMepCost,
          materialSubtotal: estimate.materialSubtotal,
          labourSubtotal: estimate.labourSubtotal,
          grandTotal: estimate.grandTotal,
          costPerSqFt: estimate.costPerSqFt,
        },
      });
      onNotify(`Estimate saved to project records (${formatINR(estimate.grandTotal)})`, 'success');
    } catch (err: any) {
      onNotify(`Failed to save estimate: ${err.message || 'Storage error'}`, 'error');
    } finally {
      setSavingEstimate(false);
    }
  };

  // Quick Area Pills
  const areaPresets = [600, 800, 1000, 1200, 1500, 1800, 2400];

  // Donut Chart SVG Parameters
  const chartRadius = 40;
  const chartCircumference = 2 * Math.PI * chartRadius; // ~251.32
  const shares = estimate.categoryPercentages;
  const strokeOffsetStructure = 0;
  const strokeDashStructure = (shares.structure / 100) * chartCircumference;

  const strokeOffsetFinishing = strokeDashStructure;
  const strokeDashFinishing = (shares.finishing / 100) * chartCircumference;

  const strokeOffsetLabour = strokeDashStructure + strokeDashFinishing;
  const strokeDashLabour = (shares.labour / 100) * chartCircumference;

  const strokeOffsetMep = strokeDashStructure + strokeDashFinishing + strokeDashLabour;
  const strokeDashMep = (shares.mep / 100) * chartCircumference;

  return (
    <div className="space-y-6">
      {/* ── 1. Quality Package Selector (Segmented Ribbon Tabs) ── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                1. Select Quality Tier
              </span>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold">
                Tamil Nadu Benchmark
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-slate-100 tracking-tight mt-0.5">
              Turnkey Construction Packages
            </h2>
          </div>

          {/* Quick Rate Drawer Trigger Button */}
          <button
            type="button"
            onClick={() => setIsRateDrawerOpen(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300/80 dark:border-slate-700 transition"
          >
            <SlidersHorizontal size={14} className="text-indigo-600 dark:text-indigo-400" />
            <span>Customize Unit Rates</span>
            {Object.keys(customRates).length > 0 && (
              <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
            )}
          </button>
        </div>

        {/* 3 Package Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          {/* STANDARD PACKAGE */}
          <div
            onClick={() => setPackageType('standard')}
            className={`cursor-pointer rounded-xl p-4 transition-all relative border-2 ${
              packageType === 'standard'
                ? 'border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/20 shadow-md ring-2 ring-emerald-500/20'
                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200">
                {PACKAGE_SPECS.standard.badge}
              </span>
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center border ${
                  packageType === 'standard'
                    ? 'border-emerald-500 bg-emerald-500 text-white'
                    : 'border-slate-300 dark:border-slate-600'
                }`}
              >
                {packageType === 'standard' && <Check size={12} strokeWidth={3} />}
              </div>
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Standard / Economy</h3>
            <div className="text-base font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">
              {PACKAGE_SPECS.standard.rangePerSqFt}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
              {PACKAGE_SPECS.standard.description}
            </p>
            <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap gap-1">
              <span className="text-[10px] bg-slate-100 dark:bg-slate-700/60 px-1.5 py-0.5 rounded text-slate-600 dark:text-slate-300">
                OPC/PPC Cement
              </span>
              <span className="text-[10px] bg-slate-100 dark:bg-slate-700/60 px-1.5 py-0.5 rounded text-slate-600 dark:text-slate-300">
                Fe-500 Steel
              </span>
              <span className="text-[10px] bg-slate-100 dark:bg-slate-700/60 px-1.5 py-0.5 rounded text-slate-600 dark:text-slate-300">
                2×2 Tiles
              </span>
            </div>
          </div>

          {/* PREMIUM PACKAGE [DEFAULT] */}
          <div
            onClick={() => setPackageType('premium')}
            className={`cursor-pointer rounded-xl p-4 transition-all relative border-2 ${
              packageType === 'premium'
                ? 'border-indigo-600 bg-indigo-50/40 dark:bg-indigo-950/30 shadow-md ring-2 ring-indigo-500/20'
                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-200">
                {PACKAGE_SPECS.premium.badge}
              </span>
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center border ${
                  packageType === 'premium'
                    ? 'border-indigo-600 bg-indigo-600 text-white'
                    : 'border-slate-300 dark:border-slate-600'
                }`}
              >
                {packageType === 'premium' && <Check size={12} strokeWidth={3} />}
              </div>
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Premium Package</h3>
            <div className="text-base font-extrabold text-indigo-600 dark:text-indigo-400 mt-1">
              {PACKAGE_SPECS.premium.rangePerSqFt}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
              {PACKAGE_SPECS.premium.description}
            </p>
            <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap gap-1">
              <span className="text-[10px] bg-indigo-100/70 dark:bg-indigo-900/40 px-1.5 py-0.5 rounded text-indigo-700 dark:text-indigo-300 font-semibold">
                OPC 53 + Fe-550D
              </span>
              <span className="text-[10px] bg-slate-100 dark:bg-slate-700/60 px-1.5 py-0.5 rounded text-slate-600 dark:text-slate-300">
                Teak Door
              </span>
              <span className="text-[10px] bg-slate-100 dark:bg-slate-700/60 px-1.5 py-0.5 rounded text-slate-600 dark:text-slate-300">
                4×2 GVT Tiles
              </span>
              <span className="text-[10px] bg-slate-100 dark:bg-slate-700/60 px-1.5 py-0.5 rounded text-slate-600 dark:text-slate-300">
                Jaquar CP
              </span>
            </div>
          </div>

          {/* LUXURY PACKAGE */}
          <div
            onClick={() => setPackageType('luxury')}
            className={`cursor-pointer rounded-xl p-4 transition-all relative border-2 ${
              packageType === 'luxury'
                ? 'border-amber-500 bg-amber-50/40 dark:bg-amber-950/20 shadow-md ring-2 ring-amber-500/20'
                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200">
                {PACKAGE_SPECS.luxury.badge}
              </span>
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center border ${
                  packageType === 'luxury'
                    ? 'border-amber-500 bg-amber-500 text-white'
                    : 'border-slate-300 dark:border-slate-600'
                }`}
              >
                {packageType === 'luxury' && <Check size={12} strokeWidth={3} />}
              </div>
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Luxury / Villa</h3>
            <div className="text-base font-extrabold text-amber-600 dark:text-amber-400 mt-1">
              {PACKAGE_SPECS.luxury.rangePerSqFt}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
              {PACKAGE_SPECS.luxury.description}
            </p>
            <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap gap-1">
              <span className="text-[10px] bg-slate-100 dark:bg-slate-700/60 px-1.5 py-0.5 rounded text-slate-600 dark:text-slate-300">
                Italian Marble
              </span>
              <span className="text-[10px] bg-slate-100 dark:bg-slate-700/60 px-1.5 py-0.5 rounded text-slate-600 dark:text-slate-300">
                Burma Teak + Lock
              </span>
              <span className="text-[10px] bg-slate-100 dark:bg-slate-700/60 px-1.5 py-0.5 rounded text-slate-600 dark:text-slate-300">
                Grohe Smart
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── 2. Built-Up Area & Project Metadata Bar ── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 shadow-xs">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-center">
          {/* Built up area input & pills */}
          <div className="lg:col-span-2 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                Built-Up Construction Area (sq.ft)
              </label>
              <span className="text-xs font-semibold text-slate-500">
                {builtUpArea.toLocaleString('en-IN')} sq.ft (~{(builtUpArea * 0.0929).toFixed(1)} m²)
              </span>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="number"
                  min={100}
                  max={50000}
                  step={50}
                  value={builtUpArea}
                  onChange={(e) => setBuiltUpArea(Number(e.target.value) || 0)}
                  className="w-full text-base font-extrabold text-slate-900 dark:text-slate-100 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <span className="absolute right-3.5 top-3 text-xs font-bold text-slate-400">sq.ft</span>
              </div>

              {/* Area Quick Presets */}
              <div className="hidden sm:flex items-center gap-1.5">
                {areaPresets.map((sqft) => (
                  <button
                    key={sqft}
                    type="button"
                    onClick={() => setBuiltUpArea(sqft)}
                    className={`px-2.5 py-2 text-xs font-bold rounded-lg border transition ${
                      builtUpArea === sqft
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {sqft}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Client & Site Link */}
          <div className="space-y-2.5 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200/80 dark:border-slate-700">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Project &amp; Client Info
              </span>
              <span className="text-[10px] text-emerald-600 font-bold">Auto-linked</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-semibold text-slate-500 block mb-0.5">Site / Project</label>
                <select
                  value={selectedSiteId}
                  onChange={(e) => setSelectedSiteId(e.target.value)}
                  className="w-full text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg p-1.5 text-slate-800 dark:text-slate-200 focus:outline-none"
                >
                  <option value="">(Standalone Estimate)</option>
                  {sites.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-semibold text-slate-500 block mb-0.5">Client Name</label>
                <input
                  type="text"
                  placeholder="e.g. Mr. Rajesh"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  className="w-full text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg p-1.5 text-slate-800 dark:text-slate-200 focus:outline-none"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── 3. 5 Summary KPI Cards (Executive Overview) ── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
        {/* Card 1: Total Built-up Area */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400 mb-1.5">
            <span className="text-[11px] uppercase font-bold tracking-wider">Built-up Area</span>
            <Building2 size={15} className="text-slate-400" />
          </div>
          <div className="text-lg font-extrabold text-slate-900 dark:text-slate-100">
            {estimate.builtUpArea.toLocaleString('en-IN')}{' '}
            <span className="text-xs font-normal text-slate-500">sq.ft</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Ground Floor Footprint</div>
        </div>

        {/* Card 2: Estimated Rate / sq.ft */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400 mb-1.5">
            <span className="text-[11px] uppercase font-bold tracking-wider">Rate / sq.ft</span>
            <Sparkles size={15} className="text-indigo-500" />
          </div>
          <div className="text-lg font-extrabold text-indigo-600 dark:text-indigo-400">
            {formatINR(estimate.costPerSqFt)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Turnkey all-inclusive</div>
        </div>

        {/* Card 3: Material Subtotal */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400 mb-1.5">
            <span className="text-[11px] uppercase font-bold tracking-wider">Materials</span>
            <Layers size={15} className="text-blue-500" />
          </div>
          <div className="text-lg font-extrabold text-slate-900 dark:text-slate-100">
            {formatINR(estimate.materialSubtotal)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Civil + Finishing items</div>
        </div>

        {/* Card 4: Labour Subtotal */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400 mb-1.5">
            <span className="text-[11px] uppercase font-bold tracking-wider">Labour</span>
            <ShieldCheck size={15} className="text-amber-500" />
          </div>
          <div className="text-lg font-extrabold text-slate-900 dark:text-slate-100">
            {formatINR(estimate.labourSubtotal)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Masonry + Finishing</div>
        </div>

        {/* Card 5: Grand Estimated Total (Highlighted) */}
        <div className="col-span-2 md:col-span-1 bg-gradient-to-br from-indigo-900 to-slate-900 text-white p-4 rounded-2xl border border-indigo-700/50 shadow-md">
          <div className="flex items-center justify-between text-indigo-200 mb-1.5">
            <span className="text-[11px] uppercase font-extrabold tracking-wider">Grand Total</span>
            <Crown size={15} className="text-amber-400" />
          </div>
          <div className="text-xl font-extrabold text-white tracking-tight">
            {formatINR(estimate.grandTotal)}
          </div>
          <div className="text-[11px] text-indigo-300 mt-1">Ready-to-occupy</div>
        </div>
      </div>

      {/* ── 4. Main Work Area: Itemized BOQ Table (Left) + Visualizations & Actions (Right) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Dual-Tab Itemized BOQ Breakdown (2 Cols) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 shadow-xs">
            {/* Table Header and Tab Switcher */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                  Itemized Bill of Quantities (BOQ)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Detailed civil quantities &amp; architectural specifications
                </p>
              </div>

              {/* Segmented Filter */}
              <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setActiveTab('all')}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
                    activeTab === 'all'
                      ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  All Items
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('sectionA')}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
                    activeTab === 'sectionA'
                      ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  Civil Structure
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('sectionB')}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
                    activeTab === 'sectionB'
                      ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  Finishing &amp; MEP
                </button>
              </div>
            </div>

            {/* SECTION A: Core Civil Structure (Grey Structure) */}
            {(activeTab === 'all' || activeTab === 'sectionA') && (
              <div className="mt-4">
                <div className="flex items-center justify-between bg-slate-100 dark:bg-slate-800/80 px-3.5 py-2 rounded-xl mb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-700 dark:bg-slate-400" />
                    <span className="text-xs font-extrabold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                      Section A: Core Civil Structure (Grey Structure)
                    </span>
                  </div>
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    Subtotal: {formatINR(estimate.totalCivilStructureCost + estimate.totalLabourCost)}
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="text-slate-400 border-b border-slate-100 dark:border-slate-800 pb-2">
                        <th className="py-2 font-bold uppercase text-[10px]">Item Description &amp; Spec</th>
                        <th className="py-2 text-right font-bold uppercase text-[10px]">Qty</th>
                        <th className="py-2 text-center font-bold uppercase text-[10px]">Unit</th>
                        <th className="py-2 text-right font-bold uppercase text-[10px]">Rate</th>
                        <th className="py-2 text-right font-bold uppercase text-[10px]">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                      {estimate.sectionAItems.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                          <td className="py-2.5 pr-2">
                            <div className="font-bold text-slate-900 dark:text-slate-100">{item.name}</div>
                            <div className="text-[11px] text-slate-500 line-clamp-1">{item.specification}</div>
                          </td>
                          <td className="py-2.5 text-right font-bold text-slate-700 dark:text-slate-300">
                            {item.quantity.toLocaleString('en-IN')}
                          </td>
                          <td className="py-2.5 text-center text-slate-400 text-[11px]">{item.unit}</td>
                          <td className="py-2.5 text-right text-slate-600 dark:text-slate-400">
                            ₹{item.unitRate}
                          </td>
                          <td className="py-2.5 text-right font-extrabold text-slate-900 dark:text-slate-100">
                            {formatINR(item.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* SECTION B: Turnkey Finishing & MEP (Architectural Package) */}
            {(activeTab === 'all' || activeTab === 'sectionB') && (
              <div className="mt-6">
                <div className="flex items-center justify-between bg-indigo-50/80 dark:bg-indigo-950/40 px-3.5 py-2 rounded-xl mb-2.5 border border-indigo-100 dark:border-indigo-900/50">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 dark:bg-indigo-400" />
                    <span className="text-xs font-extrabold uppercase tracking-wider text-indigo-900 dark:text-indigo-200">
                      Section B: Turnkey Finishing &amp; MEP (Architectural Package)
                    </span>
                  </div>
                  <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300">
                    Subtotal: {formatINR(estimate.totalFinishingCost + estimate.totalMepCost)}
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="text-slate-400 border-b border-slate-100 dark:border-slate-800 pb-2">
                        <th className="py-2 font-bold uppercase text-[10px]">Item Description &amp; Spec</th>
                        <th className="py-2 text-right font-bold uppercase text-[10px]">Qty</th>
                        <th className="py-2 text-center font-bold uppercase text-[10px]">Unit</th>
                        <th className="py-2 text-right font-bold uppercase text-[10px]">Rate</th>
                        <th className="py-2 text-right font-bold uppercase text-[10px]">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                      {estimate.sectionBItems.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                          <td className="py-2.5 pr-2">
                            <div className="font-bold text-slate-900 dark:text-slate-100">{item.name}</div>
                            <div className="text-[11px] text-slate-500 line-clamp-1">{item.specification}</div>
                          </td>
                          <td className="py-2.5 text-right font-bold text-slate-700 dark:text-slate-300">
                            {item.quantity.toLocaleString('en-IN')}
                          </td>
                          <td className="py-2.5 text-center text-slate-400 text-[11px]">{item.unit}</td>
                          <td className="py-2.5 text-right text-slate-600 dark:text-slate-400">
                            {formatINR(item.unitRate)}
                          </td>
                          <td className="py-2.5 text-right font-extrabold text-slate-900 dark:text-slate-100">
                            {formatINR(item.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Milestone Payment Schedule Terms */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 shadow-xs">
            <div
              onClick={() => setShowMilestones(!showMilestones)}
              className="flex items-center justify-between cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Calendar size={17} className="text-emerald-600" />
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                  Contract Milestone Payment Terms (Stage-Wise)
                </h3>
              </div>
              <button type="button" className="text-slate-400 hover:text-slate-600">
                {showMilestones ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </button>
            </div>

            {showMilestones && (
              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {estimate.milestones.map((m, idx) => (
                    <div
                      key={m.stage}
                      className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-bold text-slate-400 uppercase">
                            Stage 0{idx + 1}
                          </span>
                          <span className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400">
                            {m.percentage}%
                          </span>
                        </div>
                        <div className="text-xs font-bold text-slate-900 dark:text-slate-100 leading-snug">
                          {m.stage}
                        </div>
                        <div className="text-[10px] text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                          {m.deliverables}
                        </div>
                      </div>
                      <div className="mt-2.5 pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between">
                        <span className="text-[10px] text-slate-400">Due Amount:</span>
                        <span className="text-xs font-extrabold text-slate-900 dark:text-slate-100">
                          {formatINR(m.amount)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Visual Donut Chart, Cost Breakdown & Client Quotation Exports (1 Col) */}
        <div className="space-y-4">
          {/* Visual SVG Donut Chart (MyDesignerPlus Style) */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
              Cost Distribution Share
            </h3>

            <div className="flex flex-col items-center">
              <div className="relative w-44 h-44 flex items-center justify-center">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                  {/* Background Track */}
                  <circle
                    cx="50"
                    cy="50"
                    r={chartRadius}
                    className="stroke-slate-100 dark:stroke-slate-800"
                    strokeWidth="12"
                    fill="transparent"
                  />
                  {/* Structure Segment (Blue) */}
                  <circle
                    cx="50"
                    cy="50"
                    r={chartRadius}
                    className="stroke-blue-600 transition-all duration-500"
                    strokeWidth="12"
                    strokeDasharray={`${strokeDashStructure} ${chartCircumference}`}
                    strokeDashoffset={-strokeOffsetStructure}
                    fill="transparent"
                  />
                  {/* Finishing Segment (Indigo) */}
                  <circle
                    cx="50"
                    cy="50"
                    r={chartRadius}
                    className="stroke-indigo-600 transition-all duration-500"
                    strokeWidth="12"
                    strokeDasharray={`${strokeDashFinishing} ${chartCircumference}`}
                    strokeDashoffset={-strokeOffsetFinishing}
                    fill="transparent"
                  />
                  {/* Labour Segment (Amber) */}
                  <circle
                    cx="50"
                    cy="50"
                    r={chartRadius}
                    className="stroke-amber-500 transition-all duration-500"
                    strokeWidth="12"
                    strokeDasharray={`${strokeDashLabour} ${chartCircumference}`}
                    strokeDashoffset={-strokeOffsetLabour}
                    fill="transparent"
                  />
                  {/* MEP Segment (Emerald) */}
                  <circle
                    cx="50"
                    cy="50"
                    r={chartRadius}
                    className="stroke-emerald-500 transition-all duration-500"
                    strokeWidth="12"
                    strokeDasharray={`${strokeDashMep} ${chartCircumference}`}
                    strokeDashoffset={-strokeOffsetMep}
                    fill="transparent"
                  />
                </svg>

                {/* Donut Center Label */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total</span>
                  <span className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                    {formatINR(estimate.grandTotal)}
                  </span>
                  <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold">
                    ₹{estimate.costPerSqFt}/sq.ft
                  </span>
                </div>
              </div>

              {/* Chart Legend with Percentage Share */}
              <div className="w-full mt-4 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                    <span className="text-slate-600 dark:text-slate-300">Core Civil Structure</span>
                  </div>
                  <div className="font-extrabold text-slate-900 dark:text-slate-100">
                    {formatINR(estimate.totalCivilStructureCost)} ({estimate.categoryPercentages.structure}%)
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" />
                    <span className="text-slate-600 dark:text-slate-300">Finishing &amp; Joinery</span>
                  </div>
                  <div className="font-extrabold text-slate-900 dark:text-slate-100">
                    {formatINR(estimate.totalFinishingCost)} ({estimate.categoryPercentages.finishing}%)
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                    <span className="text-slate-600 dark:text-slate-300">Civil Labour Package</span>
                  </div>
                  <div className="font-extrabold text-slate-900 dark:text-slate-100">
                    {formatINR(estimate.totalLabourCost)} ({estimate.categoryPercentages.labour}%)
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <span className="text-slate-600 dark:text-slate-300">Plumbing &amp; Electrical</span>
                  </div>
                  <div className="font-extrabold text-slate-900 dark:text-slate-100">
                    {formatINR(estimate.totalMepCost)} ({estimate.categoryPercentages.mep}%)
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Client Quotation Actions Card */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-3">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Quotation Exports &amp; Persistence
            </h3>

            {/* Export PDF Button */}
            <button
              type="button"
              onClick={handleExportPdf}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition"
            >
              <FileText size={15} />
              <span>Export Client Quotation PDF</span>
            </button>

            {/* WhatsApp Share Button */}
            <button
              type="button"
              onClick={handleWhatsAppShare}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition"
            >
              <Share2 size={15} />
              <span>Share Quote on WhatsApp</span>
            </button>

            {/* Copy Quote Text Button */}
            <button
              type="button"
              onClick={handleCopyQuote}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs transition border border-slate-300/80 dark:border-slate-700"
            >
              {copiedQuote ? <Check size={15} className="text-emerald-500" /> : <Copy size={15} />}
              <span>{copiedQuote ? 'Copied to Clipboard!' : 'Copy Summary Text'}</span>
            </button>

            {/* Save to ERP Storage Service */}
            <button
              type="button"
              onClick={handleSaveToStorage}
              disabled={savingEstimate}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 text-slate-600 dark:text-slate-300 font-semibold text-xs transition border border-dashed border-slate-300 dark:border-slate-700"
            >
              <Save size={14} className="text-indigo-500" />
              <span>{savingEstimate ? 'Saving...' : 'Save Estimate to Database'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── 5. Reactive Unit Rate Drawer (Modal / Sliding Drawer) ── */}
      {isRateDrawerOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden flex justify-end bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 h-full shadow-2xl flex flex-col border-l border-slate-200 dark:border-slate-800">
            {/* Drawer Header */}
            <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <SlidersHorizontal size={16} className="text-indigo-600" />
                  <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-slate-100">
                    Customize Material Unit Rates
                  </h3>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Live adjustments for local supplier prices in {PACKAGE_SPECS[packageType].name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsRateDrawerOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X size={18} />
              </button>
            </div>

            {/* Drawer Body: Input Fields with live recalculations */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
              {/* Reset to defaults prompt */}
              <div className="flex items-center justify-between bg-indigo-50 dark:bg-indigo-950/40 p-3 rounded-xl border border-indigo-200/80 dark:border-indigo-900/60 text-xs">
                <span className="text-indigo-900 dark:text-indigo-200 font-medium">
                  Modifying rates recalculates estimates immediately.
                </span>
                <button
                  type="button"
                  onClick={handleResetRates}
                  className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-300 shadow-2xs hover:bg-slate-50"
                >
                  Reset Defaults
                </button>
              </div>

              {/* Civil Structure Items */}
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-2">
                  Section A: Core Civil Structure
                </span>
                <div className="space-y-2.5">
                  {MULTI_TIER_RATE_ITEMS.filter((i) => i.section === 'A').map((item) => (
                    <div
                      key={item.key}
                      className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700"
                    >
                      <div className="pr-2">
                        <div className="text-xs font-bold text-slate-800 dark:text-slate-200">{item.label}</div>
                        <div className="text-[10px] text-slate-400">{item.specNotes}</div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-xs font-bold text-slate-500">₹</span>
                        <input
                          type="number"
                          step={item.unit === 'nos' ? 0.25 : 1}
                          value={customRates[item.key] ?? item.premiumRate}
                          onChange={(e) => handleRateChange(item.key, Number(e.target.value))}
                          className="w-24 text-right text-xs font-bold bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg p-1 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                        <span className="text-[10px] text-slate-400 w-10">/{item.unit}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Finishing & MEP Items */}
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-2">
                  Section B: Turnkey Finishing &amp; MEP
                </span>
                <div className="space-y-2.5">
                  {MULTI_TIER_RATE_ITEMS.filter((i) => i.section === 'B').map((item) => (
                    <div
                      key={item.key}
                      className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700"
                    >
                      <div className="pr-2">
                        <div className="text-xs font-bold text-slate-800 dark:text-slate-200">{item.label}</div>
                        <div className="text-[10px] text-slate-400">{item.specNotes}</div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-xs font-bold text-slate-500">₹</span>
                        <input
                          type="number"
                          step={item.unit === 'sq.ft' ? 5 : 1000}
                          value={customRates[item.key] ?? item.premiumRate}
                          onChange={(e) => handleRateChange(item.key, Number(e.target.value))}
                          className="w-24 text-right text-xs font-bold bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg p-1 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                        <span className="text-[10px] text-slate-400 w-10">/{item.unit}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Drawer Footer with Live Total preview */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between">
              <div>
                <div className="text-[10px] uppercase font-bold text-slate-400">Recalculated Rate</div>
                <div className="text-sm font-extrabold text-indigo-600 dark:text-indigo-400">
                  {formatINR(estimate.costPerSqFt)} / sq.ft
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsRateDrawerOpen(false)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition"
              >
                Apply &amp; Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
