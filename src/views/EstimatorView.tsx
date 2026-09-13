import React, { useState, useEffect } from 'react';
import {
  Calculator,
  Mic,
  MicOff,
  Save,
  Printer,
  FileSpreadsheet,
  Building2,
  Layers,
  ArrowRight,
  Sparkles,
  Info,
  CheckCircle,
  AlertTriangle,
  Plus,
  RefreshCw,
  Trash2,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Tag,
  IndianRupee,
} from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { getCurrentUser } from '../services/auth';
import type {
  AreaUnit,
  ConstructionQuality,
  StructureType,
  ConcreteGrade,
  SteelGrade,
  BuildingEstimate,
  MaterialPriceQuote,
  EstimateMaterial,
} from '../db/types';
import {
  toSqFt,
  fromSqFt,
  getAllUnitConversions,
  calculateBuildingEstimate,
  PRELIMINARY_ESTIMATE_DISCLAIMER,
} from '../utils/estimator';
import {
  parseVoiceInput,
  startVoiceRecognition,
  isSpeechRecognitionSupported,
  type ParsedVoiceEstimate,
} from '../utils/voiceParser';
import { SupplierPriceModal } from '../components/SupplierPriceModal';
import { PriceComparisonCard } from '../components/PriceComparisonCard';

interface EstimatorViewProps {
  onOpenSite?: (siteId: string) => void;
  onNotify: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const EstimatorView: React.FC<EstimatorViewProps> = ({ onOpenSite, onNotify }) => {
  // Input dimensions & area
  const [areaMode, setAreaMode] = useState<'area' | 'dimensions'>('area');
  const [inputArea, setInputArea] = useState<number>(1000);
  const [areaUnit, setAreaUnit] = useState<AreaUnit>('sq.ft');
  const [lengthFt, setLengthFt] = useState<number>(40);
  const [widthFt, setWidthFt] = useState<number>(25);

  // Specifications
  const [floors, setFloors] = useState<number>(1);
  const [buildingType, setBuildingType] = useState<string>('Residential Villa');
  const [quality, setQuality] = useState<ConstructionQuality>('Standard');
  const [structureType, setStructureType] = useState<StructureType>('Framed Structure (RCC)');
  const [concreteGrade, setConcreteGrade] = useState<ConcreteGrade>('M20');
  const [steelGrade, setSteelGrade] = useState<SteelGrade>('Fe500');
  const [includeRiverSand, setIncludeRiverSand] = useState<boolean>(true);

  // Material rates
  const [cementRate, setCementRate] = useState<number>(420);
  const [sandRate, setSandRate] = useState<number>(135);
  const [msandRate, setMsandRate] = useState<number>(45);
  const [aggregateRate, setAggregateRate] = useState<number>(42);
  const [brickRate, setBrickRate] = useState<number>(10.5);
  const [steelRate, setSteelRate] = useState<number>(74);
  const [labourRate, setLabourRate] = useState<number>(320);

  // Selected quotes tracking
  const [selectedQuoteIds, setSelectedQuoteIds] = useState<Record<string, string>>({});

  // Collapsible BOQ schedule
  const [showBoqSchedule, setShowBoqSchedule] = useState<boolean>(false);
  const [showMarketPrices, setShowMarketPrices] = useState<boolean>(false);

  // Modals
  const [isPriceModalOpen, setIsPriceModalOpen] = useState(false);
  const [modalDefaultMaterial, setModalDefaultMaterial] = useState<EstimateMaterial>('Cement');
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [saveEstimateName, setSaveEstimateName] = useState('New Project Preliminary Estimate');
  const [saveLinkedSiteId, setSaveLinkedSiteId] = useState<string>('');
  const [saveNotes, setSaveNotes] = useState('');

  // Voice Recognition
  const [isListening, setIsListening] = useState(false);
  const [voiceModalOpen, setVoiceModalOpen] = useState(false);
  const [voiceParsedData, setVoiceParsedData] = useState<ParsedVoiceEstimate | null>(null);
  const [activeSpeechInstance, setActiveSpeechInstance] = useState<any>(null);

  // Live queries
  const sites = useLiveQuery(() => db.sites.filter(s => !s.isDeleted).toArray()) || [];
  const materialQuotes = useLiveQuery(() => db.materialPrices.filter(p => !p.isDeleted).toArray()) || [];
  const savedEstimates = useLiveQuery(() => db.estimates.filter(e => !e.isDeleted).reverse().toArray()) || [];

  // Initialize market reference prices on first load
  useEffect(() => {
    db.seedDefaultMaterialPrices();
  }, []);

  // Sync length x width when dimensions change
  useEffect(() => {
    if (areaMode === 'dimensions') {
      const sqft = Math.max(0, lengthFt * widthFt);
      setInputArea(sqft);
      setAreaUnit('sq.ft');
    }
  }, [lengthFt, widthFt, areaMode]);

  // Calculate built-up area in Sq.Ft
  const plotAreaInSqFt = toSqFt(inputArea, areaUnit);
  const builtUpSqFt = Math.max(0, plotAreaInSqFt * Math.max(1, floors));

  // Multi-unit conversions for display
  const conversions = getAllUnitConversions(inputArea, areaUnit);

  // Auto-adjust default labour rate on quality switch
  useEffect(() => {
    if (quality === 'Economy') setLabourRate(280);
    else if (quality === 'Standard') setLabourRate(320);
    else if (quality === 'Premium') setLabourRate(360);
  }, [quality]);

  // Execute estimation calculation
  const estimateResult = calculateBuildingEstimate({
    builtUpSqFt,
    floors,
    buildingType,
    quality,
    structureType,
    concreteGrade,
    steelGrade,
    includeRiverSand,
    rates: {
      cementPerBag: cementRate,
      sandPerCft: sandRate,
      msandPerCft: msandRate,
      aggregatePerCft: aggregateRate,
      brickPerPiece: brickRate,
      steelPerKg: steelRate,
      labourPerSqFt: labourRate,
    },
  });

  // Handle supplier quote selection
  const handleSelectQuote = (quote: MaterialPriceQuote) => {
    setSelectedQuoteIds(prev => ({ ...prev, [quote.material]: quote.id }));
    switch (quote.material) {
      case 'Cement':
        setCementRate(quote.price);
        break;
      case 'Sand':
        setSandRate(quote.price);
        break;
      case 'M-Sand':
        setMsandRate(quote.price);
        break;
      case 'Aggregate':
        setAggregateRate(quote.price);
        break;
      case 'Bricks':
        setBrickRate(quote.price);
        break;
      case 'Steel':
        setSteelRate(quote.price);
        break;
    }
    onNotify(`Applied ${quote.supplier} quote for ${quote.material} (₹${quote.price}/${quote.unit})`, 'info');
  };

  // Voice button click handler
  const toggleVoiceRecognition = () => {
    if (isListening) {
      if (activeSpeechInstance) {
        try { activeSpeechInstance.stop(); } catch (e) {}
      }
      setIsListening(false);
      return;
    }

    if (!isSpeechRecognitionSupported()) {
      onNotify('Speech recognition is not supported in this browser. Please use Chrome or Edge.', 'error');
      return;
    }

    setIsListening(true);
    const recognition = startVoiceRecognition({
      onResult: (transcript) => {
        setIsListening(false);
        const parsed = parseVoiceInput(transcript);
        setVoiceParsedData(parsed);
        setVoiceModalOpen(true);
      },
      onError: (err) => {
        setIsListening(false);
        onNotify(`Voice error: ${err}`, 'error');
      },
      onEnd: () => {
        setIsListening(false);
      },
    });
    setActiveSpeechInstance(recognition);
  };

  // Apply voice parsed values to state
  const handleApplyVoiceData = () => {
    if (!voiceParsedData) return;
    if (voiceParsedData.lengthFt && voiceParsedData.widthFt) {
      setAreaMode('dimensions');
      setLengthFt(voiceParsedData.lengthFt);
      setWidthFt(voiceParsedData.widthFt);
    } else if (voiceParsedData.plotArea && voiceParsedData.plotAreaUnit) {
      setAreaMode('area');
      setInputArea(voiceParsedData.plotArea);
      setAreaUnit(voiceParsedData.plotAreaUnit);
    }
    if (voiceParsedData.floors) setFloors(voiceParsedData.floors);
    if (voiceParsedData.buildingType) setBuildingType(voiceParsedData.buildingType);
    if (voiceParsedData.quality) setQuality(voiceParsedData.quality);
    if (voiceParsedData.structureType) setStructureType(voiceParsedData.structureType);
    if (voiceParsedData.concreteGrade) setConcreteGrade(voiceParsedData.concreteGrade);
    if (voiceParsedData.steelGrade) setSteelGrade(voiceParsedData.steelGrade);
    if (voiceParsedData.includeRiverSand !== undefined) setIncludeRiverSand(voiceParsedData.includeRiverSand);

    setVoiceModalOpen(false);
    onNotify('Voice specifications applied to calculator successfully!', 'success');
  };

  // Save estimate to Dexie
  const handleSaveEstimate = async () => {
    if (!saveEstimateName.trim()) {
      onNotify('Please enter a name for the estimate.', 'error');
      return;
    }

    try {
      const id = `est-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const now = new Date().toISOString();
      const linkedSite = sites.find(s => s.id === saveLinkedSiteId);

      const estimateDoc: BuildingEstimate = {
        id,
        userId: getCurrentUser()?.id || 'user-admin-default',
        siteId: saveLinkedSiteId || undefined,
        siteName: linkedSite?.name || undefined,
        estimateName: saveEstimateName.trim(),
        plotArea: inputArea,
        plotAreaUnit: areaUnit,
        builtUpArea: builtUpSqFt,
        builtUpAreaUnit: 'sq.ft',
        convertedBuiltUpSqFt: builtUpSqFt,
        floors,
        buildingType,
        quality,
        structureType,
        concreteGrade,
        steelGrade,
        includeRiverSand,
        materialEstimates: estimateResult.materials,
        totalEstimatedMaterialCost: estimateResult.totalMaterialCost,
        estimatedLabourCost: estimateResult.estimatedLabourCost,
        totalEstimatedCost: estimateResult.totalEstimatedCost,
        boqSteelSchedule: estimateResult.boqSteelSchedule,
        notes: saveNotes.trim() || undefined,
        createdAt: now,
        updatedAt: now,
        isDeleted: false,
      };

      await db.estimates.put(estimateDoc);
      await db.logActivity(
        saveLinkedSiteId || undefined,
        linkedSite?.name,
        'CREATE',
        `Saved preliminary estimate "${saveEstimateName}" (Total: ₹${estimateResult.totalEstimatedCost.toLocaleString('en-IN')})`,
        estimateResult.totalEstimatedCost
      );

      setIsSaveModalOpen(false);
      onNotify('Building estimate saved successfully!', 'success');
    } catch (err: any) {
      onNotify(err?.message || 'Failed to save estimate.', 'error');
    }
  };

  // Reload a previously saved estimate
  const handleLoadEstimate = (est: BuildingEstimate) => {
    setInputArea(est.plotArea);
    setAreaUnit(est.plotAreaUnit);
    setFloors(est.floors);
    setBuildingType(est.buildingType);
    setQuality(est.quality);
    setStructureType(est.structureType);
    setConcreteGrade(est.concreteGrade);
    setSteelGrade(est.steelGrade);
    setIncludeRiverSand(est.includeRiverSand);

    // Map rates from materials
    est.materialEstimates.forEach(m => {
      if (m.material === 'Cement') setCementRate(m.rate);
      if (m.material === 'Sand') setSandRate(m.rate);
      if (m.material === 'M-Sand') setMsandRate(m.rate);
      if (m.material === 'Aggregate') setAggregateRate(m.rate);
      if (m.material === 'Bricks') setBrickRate(m.rate);
      if (m.material === 'Steel') setSteelRate(m.rate);
    });

    onNotify(`Loaded estimate "${est.estimateName}"`, 'info');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Delete estimate (soft delete)
  const handleDeleteEstimate = async (id: string, name: string) => {
    if (confirm(`Move estimate "${name}" to Recycle Bin?`)) {
      await db.softDelete('estimates', id);
      onNotify(`Estimate "${name}" moved to Recycle Bin`, 'info');
    }
  };

  // Export CSV BOQ
  const handleExportCSV = () => {
    const rows = [
      ['BUILDING MISTRY - PRELIMINARY MATERIAL & COST ESTIMATE'],
      ['Date', new Date().toLocaleDateString()],
      ['Project Built-up Area', `${builtUpSqFt} sq.ft (${floors} Floors)`],
      ['Building Type', buildingType],
      ['Construction Quality', quality],
      ['Structure Type', structureType],
      ['Concrete Grade', concreteGrade],
      ['Steel Grade', steelGrade],
      [],
      ['Material', 'Quantity', 'Unit', 'Rate (INR)', 'Estimated Amount (INR)', 'Standard Factor'],
    ];

    estimateResult.materials.forEach(m => {
      rows.push([
        m.material,
        m.quantity.toString(),
        m.unit,
        m.rate.toString(),
        m.estimatedCost.toString(),
        `${m.factorUsed || ''} ${m.factorUnit || ''}`,
      ]);
    });

    rows.push([]);
    rows.push(['Total Material Cost', '', '', '', estimateResult.totalMaterialCost.toString(), '']);
    rows.push(['Estimated Civil Labour Cost', '', '', '', estimateResult.estimatedLabourCost.toString(), `Rs.${labourRate}/sq.ft`]);
    rows.push(['GRAND TOTAL ESTIMATED COST', '', '', '', estimateResult.totalEstimatedCost.toString(), `Rs.${Math.round(estimateResult.totalEstimatedCost / (builtUpSqFt || 1))}/sq.ft`]);
    rows.push([]);
    rows.push(['BOQ STEEL REBAR SCHEDULE BREAKDOWN']);
    rows.push(['Diameter', 'Weight (kg)', 'Rate/kg', 'Total Cost (INR)']);
    estimateResult.boqSteelSchedule.forEach(b => {
      rows.push([b.diameter, b.weightKg.toString(), b.ratePerKg.toString(), b.totalCost.toString()]);
    });
    rows.push([]);
    rows.push(['DISCLAIMER', PRELIMINARY_ESTIMATE_DISCLAIMER]);

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(e => e.map(cell => `"${(cell || '').toString().replace(/"/g, '""')}"`).join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Building_Estimate_${builtUpSqFt}sqft_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    onNotify('Exported estimate CSV Bill of Quantities', 'success');
  };

  // Print estimate sheet
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="container" style={{ paddingBottom: '5rem' }}>
      {/* Top Banner */}
      <div
        className="dashboard-banner"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Calculator size={32} color="var(--primary)" />
            <h2 style={{ fontSize: '1.8rem', color: 'var(--text-main)', margin: 0 }}>
              Building Calculator & Material Estimator
            </h2>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', marginTop: '4px' }}>
            Preliminary thumb-rule civil engineering material estimation, local supplier quotes, and cost forecasting
          </p>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className={`btn ${isListening ? 'btn-danger' : 'btn-secondary'}`}
            onClick={toggleVoiceRecognition}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontWeight: 700,
              boxShadow: isListening ? '0 0 15px rgba(239, 68, 68, 0.6)' : undefined,
              animation: isListening ? 'pulse 1.5s infinite' : undefined,
            }}
          >
            {isListening ? <MicOff size={18} /> : <Mic size={18} color="var(--primary)" />}
            <span>{isListening ? 'Listening... Tap to Stop' : '🎤 Fill Calculator by Voice'}</span>
          </button>

          <button
            type="button"
            className="btn btn-outline"
            onClick={() => setShowMarketPrices(!showMarketPrices)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <Tag size={16} />
            <span>{showMarketPrices ? 'Hide Supplier Quotes' : 'Supplier Quotes'}</span>
          </button>
        </div>
      </div>

      {/* Supplier Quotes Comparison Drawer */}
      {showMarketPrices && (
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <h3 style={{ fontSize: '1.2rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Tag size={20} color="var(--primary)" /> Local Market Supplier Price Quotes
            </h3>
            <button
              className="btn btn-sm btn-primary"
              onClick={() => {
                setModalDefaultMaterial('Cement');
                setIsPriceModalOpen(true);
              }}
              style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}
            >
              <Plus size={16} /> Add Supplier Quote
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
            {(['Cement', 'M-Sand', 'Sand', 'Aggregate', 'Bricks', 'Steel'] as EstimateMaterial[]).map(mat => (
              <PriceComparisonCard
                key={mat}
                material={mat}
                quotes={materialQuotes}
                selectedQuoteId={selectedQuoteIds[mat]}
                onSelectQuote={handleSelectQuote}
                onAddNewQuote={m => {
                  setModalDefaultMaterial(m);
                  setIsPriceModalOpen(true);
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* SECTION 1: Dimensions & Area Inputs */}
      <div
        className="card"
        style={{
          background: 'var(--bg-secondary)',
          borderRadius: '14px',
          border: '1px solid var(--border)',
          padding: '1.5rem',
          marginBottom: '1.5rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1.25rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Building2 size={22} color="var(--primary)" /> 1. Project Dimensions & Area
          </h3>

          {/* Dimension Mode Toggle */}
          <div style={{ display: 'flex', background: 'var(--bg-main)', padding: '3px', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <button
              type="button"
              onClick={() => setAreaMode('area')}
              style={{
                padding: '0.4rem 0.8rem',
                borderRadius: '6px',
                border: 'none',
                background: areaMode === 'area' ? 'var(--primary)' : 'transparent',
                color: areaMode === 'area' ? '#000' : 'var(--text-muted)',
                fontWeight: areaMode === 'area' ? 700 : 500,
                fontSize: '0.85rem',
                cursor: 'pointer',
              }}
            >
              Direct Area
            </button>
            <button
              type="button"
              onClick={() => setAreaMode('dimensions')}
              style={{
                padding: '0.4rem 0.8rem',
                borderRadius: '6px',
                border: 'none',
                background: areaMode === 'dimensions' ? 'var(--primary)' : 'transparent',
                color: areaMode === 'dimensions' ? '#000' : 'var(--text-muted)',
                fontWeight: areaMode === 'dimensions' ? 700 : 500,
                fontSize: '0.85rem',
                cursor: 'pointer',
              }}
            >
              Length × Width
            </button>
          </div>
        </div>

        {/* Inputs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
          {areaMode === 'area' ? (
            <>
              {/* Area Value */}
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600 }}>Plot / Slab Area *</label>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  className="form-input"
                  style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--primary)' }}
                  value={inputArea}
                  onChange={e => setInputArea(parseFloat(e.target.value) || 0)}
                />
              </div>

              {/* Area Unit */}
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600 }}>Unit of Measure *</label>
                <select
                  className="form-input"
                  value={areaUnit}
                  onChange={e => setAreaUnit(e.target.value as AreaUnit)}
                  style={{ fontSize: '1.05rem', fontWeight: 600 }}
                >
                  <option value="sq.ft">Square Feet (Sq.Ft)</option>
                  <option value="cent">Cent (1 Cent = 435.6 sq.ft)</option>
                  <option value="sq.m">Square Metre (Sq.M)</option>
                  <option value="ground">Ground (1 Ground = 2,400 sq.ft)</option>
                </select>
              </div>
            </>
          ) : (
            <>
              {/* Length */}
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600 }}>Plot Length (Feet) *</label>
                <input
                  type="number"
                  min="1"
                  step="0.1"
                  className="form-input"
                  style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--primary)' }}
                  value={lengthFt}
                  onChange={e => setLengthFt(parseFloat(e.target.value) || 0)}
                />
              </div>

              {/* Width */}
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600 }}>Plot Width (Feet) *</label>
                <input
                  type="number"
                  min="1"
                  step="0.1"
                  className="form-input"
                  style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--primary)' }}
                  value={widthFt}
                  onChange={e => setWidthFt(parseFloat(e.target.value) || 0)}
                />
              </div>
            </>
          )}

          {/* Floors */}
          <div className="form-group">
            <label className="form-label" style={{ fontWeight: 600 }}>Number of Floors (G + N) *</label>
            <select
              className="form-input"
              value={floors}
              onChange={e => setFloors(parseInt(e.target.value, 10) || 1)}
              style={{ fontSize: '1.05rem', fontWeight: 600 }}
            >
              <option value="1">Ground Floor Only (1 Floor)</option>
              <option value="2">G + 1 Floor (2 Floors)</option>
              <option value="3">G + 2 Floors (3 Floors)</option>
              <option value="4">G + 3 Floors (4 Floors)</option>
              <option value="5">G + 4 Floors (5 Floors)</option>
            </select>
          </div>

          {/* Building Type */}
          <div className="form-group">
            <label className="form-label" style={{ fontWeight: 600 }}>Building Type</label>
            <select
              className="form-input"
              value={buildingType}
              onChange={e => setBuildingType(e.target.value)}
            >
              <option value="Residential Villa">Residential Villa / Independent House</option>
              <option value="Residential Apartment">Residential Apartment</option>
              <option value="Duplex House">Duplex House</option>
              <option value="Commercial Complex">Commercial Complex / Shop</option>
              <option value="Industrial Shed">Industrial Warehouse / Shed</option>
            </select>
          </div>
        </div>

        {/* Live Multi-Unit Conversion Ribbon */}
        <div
          style={{
            background: 'var(--bg-main)',
            borderRadius: '10px',
            padding: '0.85rem 1rem',
            border: '1px solid var(--border)',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            <Sparkles size={16} color="var(--primary)" />
            <strong style={{ color: 'var(--text-main)' }}>Live Conversion:</strong>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
            <span style={{ background: areaUnit === 'cent' ? 'rgba(255, 184, 0, 0.15)' : 'transparent', padding: '3px 8px', borderRadius: '6px', fontSize: '0.88rem' }}>
              <strong>{conversions.cent}</strong> <span style={{ color: 'var(--text-muted)' }}>Cent</span>
            </span>
            <span style={{ color: 'var(--text-muted)' }}>•</span>
            <span style={{ background: areaUnit === 'sq.ft' ? 'rgba(255, 184, 0, 0.15)' : 'transparent', padding: '3px 8px', borderRadius: '6px', fontSize: '0.88rem' }}>
              <strong>{conversions.sqFt.toLocaleString('en-IN')}</strong> <span style={{ color: 'var(--text-muted)' }}>Sq.Ft</span>
            </span>
            <span style={{ color: 'var(--text-muted)' }}>•</span>
            <span style={{ background: areaUnit === 'sq.m' ? 'rgba(255, 184, 0, 0.15)' : 'transparent', padding: '3px 8px', borderRadius: '6px', fontSize: '0.88rem' }}>
              <strong>{conversions.sqM.toLocaleString('en-IN')}</strong> <span style={{ color: 'var(--text-muted)' }}>Sq.M</span>
            </span>
            <span style={{ color: 'var(--text-muted)' }}>•</span>
            <span style={{ background: areaUnit === 'ground' ? 'rgba(255, 184, 0, 0.15)' : 'transparent', padding: '3px 8px', borderRadius: '6px', fontSize: '0.88rem' }}>
              <strong>{conversions.ground}</strong> <span style={{ color: 'var(--text-muted)' }}>Ground</span>
            </span>
          </div>

          <div style={{ background: 'rgba(34, 197, 94, 0.15)', border: '1px solid rgba(34, 197, 94, 0.4)', padding: '4px 12px', borderRadius: '20px', color: '#4ade80', fontSize: '0.88rem', fontWeight: 700 }}>
            Total Built-Up: {builtUpSqFt.toLocaleString('en-IN')} sq.ft
          </div>
        </div>

        {/* Structural Specifications */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginTop: '1.25rem' }}>
          {/* Quality */}
          <div className="form-group">
            <label className="form-label" style={{ fontWeight: 600 }}>Construction Quality</label>
            <select className="form-input" value={quality} onChange={e => setQuality(e.target.value as ConstructionQuality)}>
              <option value="Economy">Economy (Standard brickwork, basic fittings)</option>
              <option value="Standard">Standard (Medium quality, branded cement/steel)</option>
              <option value="Premium">Premium (Top tier branded materials, high spec)</option>
            </select>
          </div>

          {/* Structure Type */}
          <div className="form-group">
            <label className="form-label" style={{ fontWeight: 600 }}>Structure Type</label>
            <select className="form-input" value={structureType} onChange={e => setStructureType(e.target.value as StructureType)}>
              <option value="Framed Structure (RCC)">Framed Structure (RCC Columns & Beams)</option>
              <option value="Load Bearing">Load Bearing (Thick Brick Walls)</option>
              <option value="Steel Frame">Steel Frame (Pre-engineered Steel)</option>
              <option value="Composite">Composite (Steel + Concrete)</option>
            </select>
          </div>

          {/* Concrete Grade */}
          <div className="form-group">
            <label className="form-label" style={{ fontWeight: 600 }}>Concrete Grade</label>
            <select className="form-input" value={concreteGrade} onChange={e => setConcreteGrade(e.target.value as ConcreteGrade)}>
              <option value="M15">M15 (1:2:4 Levelling/PCC Base)</option>
              <option value="M20">M20 (1:1.5:3 Standard Slabs & Beams)</option>
              <option value="M25">M25 (1:1:2 Heavy Duty Columns/High Rise)</option>
              <option value="M30">M30 (Design Mix / Commercial)</option>
            </select>
          </div>

          {/* Steel Grade */}
          <div className="form-group">
            <label className="form-label" style={{ fontWeight: 600 }}>Steel Grade</label>
            <select className="form-input" value={steelGrade} onChange={e => setSteelGrade(e.target.value as SteelGrade)}>
              <option value="Fe500">Fe 500 (Standard TMT Rebars)</option>
              <option value="Fe550">Fe 550 / Fe 550D (High Ductility TMT)</option>
              <option value="Fe415">Fe 415 (Mild TMT Rebars)</option>
            </select>
          </div>
        </div>

        {/* Sand Option Toggle */}
        <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <input
            type="checkbox"
            id="sand-toggle"
            checked={includeRiverSand}
            onChange={e => setIncludeRiverSand(e.target.checked)}
            style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--primary)' }}
          />
          <label htmlFor="sand-toggle" style={{ cursor: 'pointer', fontSize: '0.9rem', color: 'var(--text-main)' }}>
            <strong>Include River Sand for Plastering</strong> (Uses M-Sand for concrete masonry + River Sand for internal/external plastering)
          </label>
        </div>
      </div>

      {/* SECTION 2: Material Rates & Supplier Pricing */}
      <div
        className="card"
        style={{
          background: 'var(--bg-secondary)',
          borderRadius: '14px',
          border: '1px solid var(--border)',
          padding: '1.5rem',
          marginBottom: '1.5rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <IndianRupee size={22} color="var(--primary)" /> 2. Material Rates & Labour Cost (₹)
          </h3>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Edit rates below or pick from Supplier Quotes
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
          {/* Cement */}
          <div className="form-group">
            <label className="form-label" style={{ fontSize: '0.85rem' }}>🧱 Cement (₹/Bag)</label>
            <input
              type="number"
              step="1"
              min="1"
              className="form-input"
              value={cementRate}
              onChange={e => setCementRate(parseFloat(e.target.value) || 0)}
            />
          </div>

          {/* River Sand */}
          {includeRiverSand && (
            <div className="form-group">
              <label className="form-label" style={{ fontSize: '0.85rem' }}>🏖️ River Sand (₹/CFT)</label>
              <input
                type="number"
                step="1"
                min="0"
                className="form-input"
                value={sandRate}
                onChange={e => setSandRate(parseFloat(e.target.value) || 0)}
              />
            </div>
          )}

          {/* M-Sand */}
          <div className="form-group">
            <label className="form-label" style={{ fontSize: '0.85rem' }}>⛰️ M-Sand (₹/CFT)</label>
            <input
              type="number"
              step="1"
              min="0"
              className="form-input"
              value={msandRate}
              onChange={e => setMsandRate(parseFloat(e.target.value) || 0)}
            />
          </div>

          {/* Aggregate */}
          <div className="form-group">
            <label className="form-label" style={{ fontSize: '0.85rem' }}>🪨 Aggregate 20mm (₹/CFT)</label>
            <input
              type="number"
              step="1"
              min="0"
              className="form-input"
              value={aggregateRate}
              onChange={e => setAggregateRate(parseFloat(e.target.value) || 0)}
            />
          </div>

          {/* Bricks */}
          <div className="form-group">
            <label className="form-label" style={{ fontSize: '0.85rem' }}>🧱 Bricks (₹/Piece)</label>
            <input
              type="number"
              step="0.1"
              min="0"
              className="form-input"
              value={brickRate}
              onChange={e => setBrickRate(parseFloat(e.target.value) || 0)}
            />
          </div>

          {/* Steel */}
          <div className="form-group">
            <label className="form-label" style={{ fontSize: '0.85rem' }}>🏗️ TMT Steel (₹/Kg)</label>
            <input
              type="number"
              step="0.5"
              min="0"
              className="form-input"
              value={steelRate}
              onChange={e => setSteelRate(parseFloat(e.target.value) || 0)}
            />
          </div>

          {/* Labour */}
          <div className="form-group">
            <label className="form-label" style={{ fontSize: '0.85rem' }}>👷 Labour (₹/Sq.Ft)</label>
            <input
              type="number"
              step="5"
              min="0"
              className="form-input"
              value={labourRate}
              onChange={e => setLabourRate(parseFloat(e.target.value) || 0)}
            />
          </div>
        </div>
      </div>

      {/* SECTION 3: Preliminary Results Dashboard */}
      <div
        className="card"
        style={{
          background: 'var(--bg-secondary)',
          borderRadius: '14px',
          border: '1px solid var(--border)',
          padding: '1.5rem',
          marginBottom: '1.5rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1.25rem' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.3rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Layers size={22} color="var(--primary)" /> 3. Preliminary Material Quantities & Estimated Cost
            </h3>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Computed for {builtUpSqFt.toLocaleString('en-IN')} sq.ft ({floors} Floor{floors > 1 ? 's' : ''})
            </span>
          </div>

          {/* Grand Total Highlight Badge */}
          <div
            style={{
              background: 'linear-gradient(135deg, rgba(255, 184, 0, 0.2), rgba(245, 158, 11, 0.1))',
              border: '1.5px solid var(--primary)',
              borderRadius: '12px',
              padding: '0.6rem 1.25rem',
              textAlign: 'right',
            }}
          >
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Grand Estimated Budget
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--primary)' }}>
              ₹{estimateResult.totalEstimatedCost.toLocaleString('en-IN')}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              ≈ ₹{Math.round(estimateResult.totalEstimatedCost / (builtUpSqFt || 1))} / sq.ft
            </div>
          </div>
        </div>

        {/* Construction Material Cards Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          {estimateResult.materials.map(m => (
            <div
              key={m.material}
              style={{
                background: 'var(--bg-main)',
                borderRadius: '10px',
                border: '1px solid var(--border)',
                padding: '1rem',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '1.4rem' }}>
                    {m.material === 'Cement' ? '🧱' : m.material === 'Sand' ? '🏖️' : m.material === 'M-Sand' ? '⛰️' : m.material === 'Aggregate' ? '🪨' : m.material === 'Bricks' ? '🧱' : '🏗️'}
                  </span>
                  <span style={{ fontSize: '0.75rem', background: 'rgba(255, 255, 255, 0.08)', padding: '2px 8px', borderRadius: '12px', color: 'var(--text-muted)' }}>
                    {m.factorUsed} {m.factorUnit}
                  </span>
                </div>

                <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)' }}>{m.material}</div>
                <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--primary)', margin: '4px 0' }}>
                  {m.quantity.toLocaleString('en-IN')} <span style={{ fontSize: '0.85rem', fontWeight: 400, color: 'var(--text-muted)' }}>{m.unit}</span>
                </div>
                {m.material === 'Steel' && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    ≈ {(m.quantity / 1000).toFixed(2)} Tons
                  </div>
                )}
              </div>

              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '0.6rem', marginTop: '0.6rem', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>@ ₹{m.rate}/{m.unit}</span>
                <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)' }}>
                  ₹{m.estimatedCost.toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Summary Table & Cost Breakdown */}
        <div style={{ background: 'var(--bg-main)', borderRadius: '10px', padding: '1rem', border: '1px solid var(--border)', marginBottom: '1.5rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <div>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Total Material Procurement Cost</span>
              <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-main)' }}>
                ₹{estimateResult.totalMaterialCost.toLocaleString('en-IN')}
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {Math.round((estimateResult.totalMaterialCost / (estimateResult.totalEstimatedCost || 1)) * 100)}% of total cost
              </span>
            </div>

            <div>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Estimated Civil Labour Cost</span>
              <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-main)' }}>
                ₹{estimateResult.estimatedLabourCost.toLocaleString('en-IN')}
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                @ ₹{labourRate}/sq.ft ({Math.round((estimateResult.estimatedLabourCost / (estimateResult.totalEstimatedCost || 1)) * 100)}% of total)
              </span>
            </div>

            <div>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Total Preliminary Budget</span>
              <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--primary)' }}>
                ₹{estimateResult.totalEstimatedCost.toLocaleString('en-IN')}
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Inclusive of preliminary materials & labour
              </span>
            </div>
          </div>
        </div>

        {/* Collapsible BOQ Steel Schedule Breakdown */}
        <div style={{ marginBottom: '1rem' }}>
          <button
            type="button"
            className="btn btn-sm btn-outline"
            onClick={() => setShowBoqSchedule(!showBoqSchedule)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <span>🏗️ Engineer-Approved BOQ Steel Diameter Breakdown</span>
            {showBoqSchedule ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>

          {showBoqSchedule && (
            <div style={{ marginTop: '0.75rem', overflowX: 'auto' }}>
              <table className="data-table" style={{ width: '100%', fontSize: '0.88rem' }}>
                <thead>
                  <tr>
                    <th>Rebar Diameter & Structural Usage</th>
                    <th>Weight (Kg)</th>
                    <th>Weight (Tons)</th>
                    <th>Rate (₹/Kg)</th>
                    <th style={{ textAlign: 'right' }}>Estimated Cost (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {estimateResult.boqSteelSchedule.map(item => (
                    <tr key={item.diameter}>
                      <td><strong>{item.diameter}</strong></td>
                      <td>{item.weightKg.toLocaleString('en-IN')} kg</td>
                      <td>{(item.weightKg / 1000).toFixed(2)} T</td>
                      <td>₹{item.ratePerKg}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>₹{item.totalCost.toLocaleString('en-IN')}</td>
                    </tr>
                  ))}
                  <tr style={{ background: 'rgba(255, 184, 0, 0.08)' }}>
                    <td><strong>Total TMT Steel</strong></td>
                    <td><strong>{estimateResult.materials.find(m => m.material === 'Steel')?.quantity.toLocaleString('en-IN')} kg</strong></td>
                    <td><strong>{((estimateResult.materials.find(m => m.material === 'Steel')?.quantity || 0) / 1000).toFixed(2)} T</strong></td>
                    <td>—</td>
                    <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--primary)' }}>
                      ₹{estimateResult.materials.find(m => m.material === 'Steel')?.estimatedCost.toLocaleString('en-IN')}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Preliminary Estimation Disclaimer Alert Box */}
        <div
          style={{
            background: 'rgba(245, 158, 11, 0.1)',
            border: '1px solid rgba(245, 158, 11, 0.4)',
            borderRadius: '8px',
            padding: '1rem',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.75rem',
          }}
        >
          <AlertTriangle size={22} color="var(--primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <strong style={{ color: 'var(--primary)', fontSize: '0.92rem' }}>Preliminary Engineering Disclaimer:</strong>
            <p style={{ margin: '4px 0 0', fontSize: '0.84rem', color: 'var(--text-main)', lineHeight: 1.5 }}>
              {PRELIMINARY_ESTIMATE_DISCLAIMER}
            </p>
          </div>
        </div>
      </div>

      {/* SECTION 4: Action Bar */}
      <div
        style={{
          display: 'flex',
          gap: '0.75rem',
          flexWrap: 'wrap',
          marginBottom: '2rem',
        }}
      >
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            setSaveEstimateName(`${buildingType} - ${builtUpSqFt} sq.ft Estimate`);
            setIsSaveModalOpen(true);
          }}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700 }}
        >
          <Save size={18} />
          <span>Save Estimate</span>
        </button>

        <button
          type="button"
          className="btn btn-secondary"
          onClick={handlePrint}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <Printer size={18} />
          <span>Print / PDF Sheet</span>
        </button>

        <button
          type="button"
          className="btn btn-outline"
          onClick={handleExportCSV}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <FileSpreadsheet size={18} />
          <span>Export CSV Bill of Quantities</span>
        </button>
      </div>

      {/* SECTION 5: Saved Estimates List */}
      <div
        className="card"
        style={{
          background: 'var(--bg-secondary)',
          borderRadius: '14px',
          border: '1px solid var(--border)',
          padding: '1.5rem',
        }}
      >
        <h3 style={{ margin: '0 0 1rem', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Save size={20} color="var(--primary)" /> Saved Estimates ({savedEstimates.length})
        </h3>

        {savedEstimates.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
            {savedEstimates.map(est => (
              <div
                key={est.id}
                style={{
                  background: 'var(--bg-main)',
                  borderRadius: '10px',
                  border: '1px solid var(--border)',
                  padding: '1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '0.75rem',
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <h4 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--text-main)' }}>{est.estimateName}</h4>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {new Date(est.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  {est.siteName && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--primary)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Building2 size={12} /> Linked to: {est.siteName}
                    </div>
                  )}

                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                    {est.convertedBuiltUpSqFt} sq.ft • {est.floors} Floor{est.floors > 1 ? 's' : ''} • {est.buildingType} ({est.quality})
                  </div>

                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--primary)', marginTop: '0.4rem' }}>
                    ₹{est.totalEstimatedCost.toLocaleString('en-IN')}
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: '0.6rem' }}>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline"
                    onClick={() => handleLoadEstimate(est)}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem' }}
                  >
                    <RefreshCw size={14} /> Load to Calculator
                  </button>

                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    {est.siteId && onOpenSite && (
                      <button
                        type="button"
                        className="btn btn-sm btn-secondary"
                        onClick={() => onOpenSite(est.siteId!)}
                        title="Open Site"
                        style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}
                      >
                        <ExternalLink size={14} /> Site
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn-sm btn-outline btn-danger-hover"
                      onClick={() => handleDeleteEstimate(est.id, est.estimateName)}
                      title="Move to Recycle Bin"
                      style={{ padding: '0.3rem 0.6rem', color: 'var(--danger)' }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
            No saved estimates yet. Configure your project specifications above and click "Save Estimate".
          </div>
        )}
      </div>

      {/* Save Estimate Modal */}
      {isSaveModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsSaveModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px', width: '95%' }}>
            <div className="modal-header">
              <h3 style={{ margin: 0 }}>Save Building Estimate</h3>
              <button className="btn btn-icon btn-outline" onClick={() => setIsSaveModalOpen(false)}>
                ×
              </button>
            </div>

            <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600 }}>Estimate Name *</label>
                <input
                  type="text"
                  className="form-input"
                  value={saveEstimateName}
                  onChange={e => setSaveEstimateName(e.target.value)}
                  placeholder="e.g. Ground + 1 Floor Villa Preliminary Estimate"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Link to Construction Site (Optional)</label>
                <select
                  className="form-input"
                  value={saveLinkedSiteId}
                  onChange={e => setSaveLinkedSiteId(e.target.value)}
                >
                  <option value="">-- Standalone Estimate (No Site Linked) --</option>
                  {sites.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.ownerName})
                    </option>
                  ))}
                </select>
                <small style={{ color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
                  Linking to a site allows comparing this estimate against actual site purchases.
                </small>
              </div>

              <div className="form-group">
                <label className="form-label">Notes / Remarks</label>
                <textarea
                  className="form-input"
                  rows={3}
                  value={saveNotes}
                  onChange={e => setSaveNotes(e.target.value)}
                  placeholder="e.g. Client requested Ramco cement and Tata Tiscon steel. Plastering with river sand."
                />
              </div>

              <div style={{ background: 'var(--bg-main)', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Estimated Grand Total</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--primary)' }}>
                  ₹{estimateResult.totalEstimatedCost.toLocaleString('en-IN')}
                </div>
              </div>
            </div>

            <div className="modal-footer" style={{ borderTop: '1px solid var(--border)', padding: '1rem 1.25rem' }}>
              <button className="btn btn-secondary" onClick={() => setIsSaveModalOpen(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleSaveEstimate}>
                Save Estimate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Voice Recognition Confirmation Modal */}
      {voiceModalOpen && voiceParsedData && (
        <div className="modal-backdrop" onClick={() => setVoiceModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '540px', width: '95%' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <Mic size={22} color="var(--primary)" />
                <h3 style={{ margin: 0 }}>Interpreted Voice Input</h3>
              </div>
              <button className="btn btn-icon btn-outline" onClick={() => setVoiceModalOpen(false)}>
                ×
              </button>
            </div>

            <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Spoken phrase quote */}
              <div style={{ background: 'var(--bg-main)', padding: '0.75rem 1rem', borderRadius: '8px', borderLeft: '4px solid var(--primary)' }}>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Spoken Words:</div>
                <div style={{ fontStyle: 'italic', color: 'var(--text-main)', marginTop: '2px', fontSize: '0.95rem' }}>
                  "{voiceParsedData.transcript}"
                </div>
              </div>

              {/* Detected items */}
              <div>
                <strong style={{ fontSize: '0.9rem', color: 'var(--text-main)', display: 'block', marginBottom: '0.5rem' }}>
                  Extracted Specifications:
                </strong>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {voiceParsedData.confidenceNotes.map((note, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        fontSize: '0.85rem',
                        background: 'rgba(34, 197, 94, 0.1)',
                        padding: '0.4rem 0.75rem',
                        borderRadius: '6px',
                        color: '#4ade80',
                      }}
                    >
                      <CheckCircle size={15} />
                      <span>{note}</span>
                    </div>
                  ))}
                  {voiceParsedData.confidenceNotes.length === 0 && (
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      Could not detect specific dimensions or building parameters. Try saying: "3 cent G plus one residential standard quality"
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="modal-footer" style={{ borderTop: '1px solid var(--border)', padding: '1rem 1.25rem' }}>
              <button className="btn btn-secondary" onClick={() => setVoiceModalOpen(false)}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleApplyVoiceData}
                disabled={voiceParsedData.confidenceNotes.length === 0}
              >
                Apply to Calculator
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Supplier Price Quote Modal */}
      <SupplierPriceModal
        isOpen={isPriceModalOpen}
        onClose={() => setIsPriceModalOpen(false)}
        defaultMaterial={modalDefaultMaterial}
        onSaved={() => onNotify('Supplier price quote saved successfully!', 'success')}
      />
    </div>
  );
};
