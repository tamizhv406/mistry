import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  ArrowLeft, ArrowRight, Building2, Check, ChevronRight, Download, ExternalLink, Factory, Home, Mic, MicOff, Minus, Plus, Printer, Save, Store, Tag, Trash2,
} from 'lucide-react';
import { db } from '../db/db';
import type {
  AreaUnit, BuildingEstimate, ConcreteGrade, ConstructionQuality, EstimateMaterial, MaterialPriceQuote, SteelGrade, StructureType, User,
} from '../db/types';
import {
  buildEstimate, emptySize, estimateReportRows, EXAMPLE_PRICES, MAX_FLOORS, PRICE_FIELDS, RATE_FIELDS, sizeSqFt, toCsv,
  type EstimateInput, type EstimatePrices, type LengthUnit, type RateField, type SizeInput,
} from '../domain/estimate';
import { fromSqFt, getQualityFactors, STARTING_LABOUR_RATE, THUMB_RULE_SOURCES } from '../utils/estimator';
import { estimatesFor, removeBuildingEstimate, saveBuildingEstimate } from '../services/estimates';
import { isSpeechRecognitionSupported, parseVoiceInput, startVoiceRecognition, type ParsedVoiceEstimate } from '../utils/voiceParser';
import { formatDay, todayKey } from '../utils/datetime';
import { formatINR, formatQty, parseAmount } from '../utils/money';
import { SupplierPriceModal } from '../components/SupplierPriceModal';
import { PriceComparisonCard } from '../components/PriceComparisonCard';
import { Badge, CalcLine, Chips, ConfirmSheet, Empty, Field, Note, Page, Section, Segmented, Sheet } from '../components/mobile/kit';

interface EstimatorViewProps {
  user: User;
  /** A floor area handed over from the Floor Planner: it becomes the building size on one floor. */
  initialBuildingSqFt?: number | null;
  onBack?: () => void;
  onOpenSite?: (siteId: string) => void;
  onNotify: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

/** A size as typed. Blank and half-typed fields stay text until they are read as numbers. */
interface SizeText {
  mode: SizeInput['mode'];
  length: string;
  width: string;
  lengthUnit: LengthUnit;
  area: string;
  areaUnit: AreaUnit;
  percent: string;
}

const blankSize = (mode: SizeText['mode'] = 'dimensions'): SizeText => ({ mode, length: '', width: '', lengthUnit: 'ft', area: '', areaUnit: 'sq.ft', percent: '' });
const num = (text: string) => (text.trim() === '' ? NaN : parseAmount(text));
const toSize = (s: SizeText): SizeInput => ({ ...emptySize(s.mode), length: num(s.length), width: num(s.width), lengthUnit: s.lengthUnit, area: num(s.area), areaUnit: s.areaUnit, percent: num(s.percent) });
const fromSize = (s: SizeInput): SizeText => {
  const t = (n: number) => (Number.isFinite(n) ? String(n) : '');
  return { mode: s.mode, length: t(s.length), width: t(s.width), lengthUnit: s.lengthUnit, area: t(s.area), areaUnit: s.areaUnit, percent: t(s.percent) };
};

const BUILDING_TYPES: { value: string; label: string; sub: string; icon: React.ReactNode }[] = [
  { value: 'Residential Villa', label: 'Independent house', sub: 'A single house or villa', icon: <Home size={22} /> },
  { value: 'Duplex House', label: 'Duplex house', sub: 'One home on two floors', icon: <Home size={22} /> },
  { value: 'Residential Apartment', label: 'Apartment building', sub: 'Several homes, shared structure', icon: <Building2 size={22} /> },
  { value: 'Commercial Complex', label: 'Shop or commercial', sub: 'Shops, offices, showroom', icon: <Store size={22} /> },
  { value: 'Industrial Shed', label: 'Shed or warehouse', sub: 'Godown, workshop, factory shed', icon: <Factory size={22} /> },
];

const STRUCTURES: { value: StructureType; label: string }[] = [
  { value: 'Framed Structure (RCC)', label: 'RCC frame (columns and beams)' },
  { value: 'Load Bearing', label: 'Load-bearing walls' },
  { value: 'Steel Frame', label: 'Steel frame' },
  { value: 'Composite', label: 'Steel and concrete' },
];

const LEVELS: { value: ConstructionQuality; label: string; hint: string }[] = [
  { value: 'Economy', label: 'Basic', hint: 'Lean specification. Uses the low end of each published range.' },
  { value: 'Standard', label: 'Standard', hint: 'Uses the middle of each published range.' },
  { value: 'Premium', label: 'Premium', hint: 'Heavier, richer specification. Uses the high end of each published range.' },
];

const AREA_UNITS: { value: AreaUnit; label: string }[] = [
  { value: 'sq.ft', label: 'sq.ft' }, { value: 'sq.m', label: 'sq.m' }, { value: 'cent', label: 'cent' }, { value: 'ground', label: 'ground' },
];

const STEPS = ['Type', 'Size', 'Build', 'Estimate'];
const QUOTE_FIELD: Record<EstimateMaterial, { field: keyof EstimatePrices; unit: RegExp; per: string }> = {
  Cement: { field: 'cementPerBag', unit: /^bags?$/i, per: 'bag' },
  Sand: { field: 'sandPerCft', unit: /^cft$/i, per: 'cft' },
  'M-Sand': { field: 'msandPerCft', unit: /^cft$/i, per: 'cft' },
  Aggregate: { field: 'aggregatePerCft', unit: /^cft$/i, per: 'cft' },
  Bricks: { field: 'brickPerPiece', unit: /^(piece|pieces|nos)$/i, per: 'piece' },
  Steel: { field: 'steelPerKg', unit: /^kg$/i, per: 'kg' },
};

const floorsLabel = (n: number) => (n === 1 ? 'Ground floor only' : `Ground + ${n - 1} (${n} floors)`);
const priceText = (p: EstimatePrices) => Object.fromEntries(PRICE_FIELDS.map(f => [f.field, String(p[f.field])])) as Record<keyof EstimatePrices, string>;

export const EstimatorView: React.FC<EstimatorViewProps> = ({ user, initialBuildingSqFt, onBack, onOpenSite, onNotify }) => {
  const [step, setStep] = useState(0);
  const [tried, setTried] = useState(false);   // show field errors once Next has been pressed on a step

  const [buildingType, setBuildingType] = useState('Residential Villa');
  const [plot, setPlot] = useState<SizeText>(blankSize());
  const [footprint, setFootprint] = useState<SizeText>(() =>
    initialBuildingSqFt && initialBuildingSqFt > 0 ? { ...blankSize('area'), area: String(Math.round(initialBuildingSqFt)) } : blankSize()
  );
  const [floors, setFloors] = useState(1);
  const [structureType, setStructureType] = useState<StructureType>('Framed Structure (RCC)');
  const [quality, setQuality] = useState<ConstructionQuality>('Standard');
  const [concreteGrade, setConcreteGrade] = useState<ConcreteGrade>('M20');
  const [steelGrade, setSteelGrade] = useState<SteelGrade>('Fe500');
  const [includeRiverSand, setIncludeRiverSand] = useState(false);
  const [finishing, setFinishing] = useState('');
  const [prices, setPrices] = useState(() => priceText(EXAMPLE_PRICES));
  const [rateText, setRateText] = useState<Partial<Record<RateField, string>>>({});

  const [showRates, setShowRates] = useState(false);
  const [quotesOpen, setQuotesOpen] = useState(false);
  const [quoteModal, setQuoteModal] = useState<EstimateMaterial | null>(null);
  const [selectedQuoteIds, setSelectedQuoteIds] = useState<Record<string, string>>({});
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saveSiteId, setSaveSiteId] = useState('');
  const [saveNotes, setSaveNotes] = useState('');
  const [saveError, setSaveError] = useState('');
  const [saveDuplicate, setSaveDuplicate] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [removing, setRemoving] = useState<BuildingEstimate | null>(null);

  const [listening, setListening] = useState(false);
  const [voice, setVoice] = useState<ParsedVoiceEstimate | null>(null);
  const recognition = useRef<{ stop: () => void } | null>(null);

  const sites = useLiveQuery(() => db.getSitesForUser(user), [user.id]) || [];
  const quotes = useLiveQuery(() => db.materialPrices.filter(p => !p.isDeleted).toArray(), []) || [];
  const saved = useLiveQuery(() => estimatesFor(user), [user.id]) || [];

  useEffect(() => () => { try { recognition.current?.stop(); } catch { /* already stopped */ } }, []);

  // A price or rate box that is empty or half-typed must not make the whole estimate vanish
  // while it is being edited: it is named in a message, and until it is filled an empty price
  // counts as ₹0 and an empty rate falls back to the published one.
  const unreadPrices = PRICE_FIELDS.filter(f => Number.isNaN(num(prices[f.field]))).map(f => f.label);
  const unreadRates = RATE_FIELDS.filter(r => rateText[r.field] !== undefined && Number.isNaN(num(rateText[r.field] || ''))).map(r => r.label);

  const input: EstimateInput = useMemo(() => ({
    buildingType,
    plot: toSize(plot),
    footprint: toSize(footprint),
    floors,
    structureType,
    quality,
    concreteGrade,
    steelGrade,
    includeRiverSand,
    prices: Object.fromEntries(PRICE_FIELDS.map(f => [f.field, Number.isNaN(num(prices[f.field])) ? 0 : num(prices[f.field])])) as unknown as EstimatePrices,
    rateOverrides: Object.fromEntries(
      Object.entries(rateText).map(([k, v]) => [k, num(v || '')] as const).filter(([, v]) => !Number.isNaN(v))
    ) as Partial<Record<RateField, number>>,
    finishingPerSqFt: finishing.trim() === '' ? 0 : parseAmount(finishing),
  }), [buildingType, plot, footprint, floors, structureType, quality, concreteGrade, steelGrade, includeRiverSand, prices, rateText, finishing]);

  // Recalculated on every change to a size, a choice, a price or a rate.
  const outcome = useMemo(() => buildEstimate(input), [input]);
  const errors = outcome.ok ? {} : outcome.errors;
  const result = outcome.ok ? outcome.value : null;

  const plotSqFt = sizeSqFt(input.plot as SizeInput);
  const footprintSqFt = sizeSqFt(input.footprint, Number.isNaN(plotSqFt) ? null : plotSqFt);
  const published = getQualityFactors(quality, includeRiverSand);

  const goTo = (next: number) => { setTried(false); setStep(next); window.scrollTo(0, 0); };
  const next = () => {
    const blocked = step === 1 ? !!(errors.plot || errors.footprint || errors.floors) : step === 2 ? !!errors.finishing : false;
    if (blocked) return setTried(true);
    goTo(step + 1);
  };

  const changeLevel = (level: ConstructionQuality) => {
    // The labour price follows the level only while it is still the starting value.
    if (num(prices.labourPerSqFt) === STARTING_LABOUR_RATE[quality]) {
      setPrices(p => ({ ...p, labourPerSqFt: String(STARTING_LABOUR_RATE[level]) }));
    }
    setQuality(level);
  };

  const applyQuote = (quote: MaterialPriceQuote) => {
    const target = QUOTE_FIELD[quote.material];
    if (!target.unit.test((quote.unit || '').trim())) {
      return onNotify(`That quote is per ${quote.unit}. The calculator needs a price per ${target.per}, so it was not applied.`, 'error');
    }
    setSelectedQuoteIds(prev => ({ ...prev, [quote.material]: quote.id }));
    setPrices(p => ({ ...p, [target.field]: String(quote.price) }));
    onNotify(`${quote.material}: ${formatINR(quote.price)} per ${target.per} from ${quote.supplier}`, 'info');
  };

  const toggleVoice = () => {
    if (listening) {
      try { recognition.current?.stop(); } catch { /* already stopped */ }
      return setListening(false);
    }
    setListening(true);
    recognition.current = startVoiceRecognition({
      onResult: transcript => { setListening(false); setVoice(parseVoiceInput(transcript)); },
      onError: err => { setListening(false); onNotify(`Voice input did not work: ${err}`, 'error'); },
      onEnd: () => setListening(false),
    });
  };

  const applyVoice = () => {
    if (!voice) return;
    // What is spoken is the plot ("3 cent", "40 by 30"). The building size is still asked for.
    if (voice.lengthFt && voice.widthFt) setPlot({ ...blankSize('dimensions'), length: String(voice.lengthFt), width: String(voice.widthFt) });
    else if (voice.plotArea && voice.plotAreaUnit) setPlot({ ...blankSize('area'), area: String(voice.plotArea), areaUnit: voice.plotAreaUnit });
    if (voice.floors) setFloors(Math.min(MAX_FLOORS, Math.max(1, voice.floors)));
    if (voice.buildingType && BUILDING_TYPES.some(b => b.value === voice.buildingType)) setBuildingType(voice.buildingType);
    if (voice.quality && voice.quality !== 'Custom') changeLevel(voice.quality);
    if (voice.structureType) setStructureType(voice.structureType);
    if (voice.concreteGrade && voice.concreteGrade !== 'Custom') setConcreteGrade(voice.concreteGrade);
    if (voice.steelGrade && voice.steelGrade !== 'Custom') setSteelGrade(voice.steelGrade);
    if (voice.includeRiverSand !== undefined) setIncludeRiverSand(voice.includeRiverSand);
    setVoice(null);
    goTo(1);
    onNotify('Filled in what was heard. Check the plot and enter the building size.', 'info');
  };

  const openSave = () => {
    if (!result) return;
    setSaveName(`${BUILDING_TYPES.find(b => b.value === buildingType)?.label || buildingType}, ${formatQty(result.areas.builtUpSqFt)} sq.ft`);
    setSaveError('');
    setSaveOpen(true);
  };

  const save = async (allowDuplicate = false) => {
    if (!result || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setSaveError('');
    try {
      const res = await saveBuildingEstimate(user, { name: saveName, siteId: saveSiteId || undefined, notes: saveNotes, input, result, allowDuplicate });
      if (!res.ok) {
        if (res.duplicateOf) setSaveDuplicate(true);
        else setSaveError(res.error);
        return;
      }
      setSaveOpen(false);
      setSaveDuplicate(false);
      setSaveNotes('');
      onNotify(res.value.siteName ? `Estimate saved to ${res.value.siteName}` : 'Estimate saved', 'success');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const load = (est: BuildingEstimate) => {
    const kept = est.inputs as EstimateInput | undefined;
    if (kept && kept.footprint && kept.prices) {
      setBuildingType(kept.buildingType);
      setPlot(kept.plot ? fromSize(kept.plot) : blankSize());
      setFootprint(fromSize(kept.footprint));
      setFloors(kept.floors);
      setStructureType(kept.structureType);
      setQuality(kept.quality);
      setConcreteGrade(kept.concreteGrade);
      setSteelGrade(kept.steelGrade);
      setIncludeRiverSand(kept.includeRiverSand);
      setPrices(priceText(kept.prices));
      setRateText(Object.fromEntries(Object.entries(kept.rateOverrides || {}).map(([k, v]) => [k, String(v)])));
      setFinishing(kept.finishingPerSqFt ? String(kept.finishingPerSqFt) : '');
    } else {
      // Saved by the earlier calculator: its "plot area" was the size of one floor.
      setBuildingType(est.buildingType);
      setPlot(blankSize());
      setFootprint({ ...blankSize('area'), area: String(est.plotArea), areaUnit: est.plotAreaUnit });
      setFloors(Math.min(MAX_FLOORS, Math.max(1, est.floors || 1)));
      setStructureType(est.structureType);
      setQuality(est.quality === 'Custom' ? 'Standard' : est.quality);
      setConcreteGrade(est.concreteGrade);
      setSteelGrade(est.steelGrade);
      setIncludeRiverSand(est.includeRiverSand);
      const p = { ...EXAMPLE_PRICES };
      for (const m of est.materialEstimates) p[QUOTE_FIELD[m.material].field] = m.rate;
      setPrices(priceText(p));
      setRateText({});
      setFinishing('');
    }
    goTo(3);
    onNotify(
      kept ? `Opened "${est.estimateName}"` : `Opened "${est.estimateName}". It was saved by the earlier calculator, so the quantities are worked out again with the current rates.`,
      'info'
    );
  };

  const exportCsv = () => {
    if (!result) return;
    const csv = toCsv(estimateReportRows(input, result, { date: formatDay(todayKey()) }));
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `mistry-estimate-${Math.round(result.areas.builtUpSqFt)}sqft-${todayKey()}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    onNotify('Estimate file downloaded', 'success');
  };

  const sizeFields = (value: SizeText, set: (v: SizeText) => void, what: 'plot' | 'building') => (
    <>
      <Segmented
        label={`${what === 'plot' ? 'Plot' : 'Building'} size entered as`}
        value={value.mode}
        onChange={mode => set({ ...value, mode })}
        options={[
          { value: 'dimensions', label: what === 'plot' ? 'Length × width' : 'L × W' },
          { value: 'area', label: 'Area' },
          ...(what === 'building' ? [{ value: 'percent' as const, label: '% of plot' }] : []),
        ]}
      />
      <div style={{ height: 12 }} />
      {value.mode === 'dimensions' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 88px', gap: 10 }}>
          <Field label="Length">
            <input type="text" inputMode="decimal" autoComplete="off" value={value.length} onChange={e => set({ ...value, length: e.target.value })} placeholder="0" aria-label={`${what} length`} />
          </Field>
          <Field label="Width">
            <input type="text" inputMode="decimal" autoComplete="off" value={value.width} onChange={e => set({ ...value, width: e.target.value })} placeholder="0" aria-label={`${what} width`} />
          </Field>
          <Field label="Unit">
            <select value={value.lengthUnit} onChange={e => set({ ...value, lengthUnit: e.target.value as LengthUnit })} aria-label={`${what} length unit`}>
              <option value="ft">ft</option>
              <option value="m">m</option>
            </select>
          </Field>
        </div>
      )}
      {value.mode === 'area' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 112px', gap: 10 }}>
          <Field label="Area">
            <input type="text" inputMode="decimal" autoComplete="off" value={value.area} onChange={e => set({ ...value, area: e.target.value })} placeholder="0" aria-label={`${what} area`} />
          </Field>
          <Field label="Unit">
            <select value={value.areaUnit} onChange={e => set({ ...value, areaUnit: e.target.value as AreaUnit })} aria-label={`${what} area unit`}>
              {AREA_UNITS.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
            </select>
          </Field>
        </div>
      )}
      {value.mode === 'percent' && (
        <>
          <Chips
            label="Share of the plot the building covers"
            value={['50', '60', '70', '80'].includes(value.percent) ? value.percent : 'other'}
            onChange={v => set({ ...value, percent: v === 'other' ? '' : v })}
            options={[{ value: '50', label: '50%' }, { value: '60', label: '60%' }, { value: '70', label: '70%' }, { value: '80', label: '80%' }, { value: 'other', label: 'Other' }]}
          />
          {!['50', '60', '70', '80'].includes(value.percent) && (
            <div style={{ marginTop: 10 }}>
              <Field label="Percent of the plot">
                <input type="text" inputMode="decimal" autoComplete="off" value={value.percent} onChange={e => set({ ...value, percent: e.target.value })} placeholder="65" aria-label="Percent of the plot" />
              </Field>
            </div>
          )}
        </>
      )}
    </>
  );

  const areaLine = (sqFt: number) =>
    Number.isNaN(sqFt) ? null : (
      <p className="m-calc-note" style={{ marginTop: 0 }}>
        = <strong>{formatQty(sqFt)} sq.ft</strong> ({formatQty(fromSqFt(sqFt, 'sq.m'))} sq.m, {formatQty(fromSqFt(sqFt, 'cent'), 3)} cent)
      </p>
    );

  const level = LEVELS.find(l => l.value === quality) || LEVELS[1];

  return (
    <Page
      title="Building Calculator"
      subtitle="Approximate materials and cost"
      onBack={onBack}
      right={
        isSpeechRecognitionSupported() ? (
          <button type="button" className={`m-icon-btn is-bordered no-print ${listening ? 'is-bad' : ''}`} onClick={toggleVoice} aria-label={listening ? 'Stop listening' : 'Fill by voice'} aria-pressed={listening}>
            {listening ? <MicOff size={20} /> : <Mic size={20} />}
          </button>
        ) : undefined
      }
    >
      <ol className="m-steps no-print" aria-label="Steps">
        {STEPS.map((label, i) => (
          <li key={label} className={i === step ? 'is-current' : i < step ? 'is-done' : ''} aria-current={i === step ? 'step' : undefined}>
            <button type="button" onClick={() => (i < step ? goTo(i) : undefined)} disabled={i > step} aria-label={`Step ${i + 1}: ${label}`}>
              <span className="m-step-dot">{i < step ? <Check size={14} /> : i + 1}</span>
              <span className="m-step-label">{label}</span>
            </button>
          </li>
        ))}
      </ol>

      {listening && <div style={{ marginBottom: 10 }}><Note>Listening. Say the plot size, floors and type, for example “3 cent, ground plus one, standard”.</Note></div>}

      {/* ---------------------------------------------------------------- Step 1 */}
      {step === 0 && (
        <>
          <h2 className="m-step-title">What are you building?</h2>
          <div className="m-card m-list">
            {BUILDING_TYPES.map(b => (
              <button key={b.value} type="button" className={`m-row ${buildingType === b.value ? 'is-picked' : ''}`} aria-pressed={buildingType === b.value} onClick={() => setBuildingType(b.value)}>
                <span className="m-row-icon">{b.icon}</span>
                <span className="m-row-main">
                  <span className="m-row-title" style={{ display: 'block' }}>{b.label}</span>
                  <span className="m-row-sub">{b.sub}</span>
                </span>
                {buildingType === b.value && <Check size={20} className="is-ok" />}
              </button>
            ))}
          </div>
          {/commercial|industrial/i.test(buildingType) && (
            <div style={{ marginTop: 10 }}>
              <Note tone="warn">The rates in this calculator are planning figures for houses. For this kind of building the result is a rough guide only.</Note>
            </div>
          )}
        </>
      )}

      {/* ---------------------------------------------------------------- Step 2 */}
      {step === 1 && (
        <>
          <h2 className="m-step-title">How big is it?</h2>
          <div className="m-card m-card-pad">
            <div className="m-step-card-title">Plot <span className="is-muted">(the land, optional)</span></div>
            {sizeFields(plot, setPlot, 'plot')}
            {areaLine(plotSqFt)}
            {tried && errors.plot && <Note tone="bad" role="alert">{errors.plot}</Note>}
          </div>

          <div className="m-card m-card-pad" style={{ marginTop: 10 }}>
            <div className="m-step-card-title">Building on one floor</div>
            <p className="m-calc-note" style={{ marginTop: 0, marginBottom: 10 }}>The part of the plot the building stands on. It is usually smaller than the plot.</p>
            {sizeFields(footprint, setFootprint, 'building')}
            {areaLine(footprintSqFt)}
            {tried && errors.footprint && <Note tone="bad" role="alert">{errors.footprint}</Note>}
          </div>

          <div className="m-card m-card-pad" style={{ marginTop: 10 }}>
            <div className="m-step-card-title">Floors</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }} role="group" aria-label="Number of floors">
              <button type="button" className="m-icon-btn is-bordered" onClick={() => setFloors(f => Math.max(1, f - 1))} disabled={floors <= 1} aria-label="One floor fewer"><Minus size={20} /></button>
              <div style={{ flex: 1, textAlign: 'center' }}>
                <div className="m-qty" style={{ fontSize: '1.4rem' }}>{floors}</div>
                <div className="m-row-sub">{floorsLabel(floors)}</div>
              </div>
              <button type="button" className="m-icon-btn is-bordered" onClick={() => setFloors(f => Math.min(MAX_FLOORS, f + 1))} disabled={floors >= MAX_FLOORS} aria-label="One floor more"><Plus size={20} /></button>
            </div>
          </div>

          {result ? (
            <div className="m-card m-card-pad" style={{ marginTop: 10, background: 'var(--m-surface-2)' }}>
              <div className="m-calc">
                <CalcLine label="Plot area" value={result.areas.plotSqFt === null ? 'not given' : `${formatQty(result.areas.plotSqFt)} sq.ft`} />
                <CalcLine label={`Building on one floor${result.areas.coveragePct !== null ? ` (${result.areas.coveragePct}% of plot)` : ''}`} value={`${formatQty(result.areas.footprintSqFt)} sq.ft`} />
                <CalcLine label="Floors" value={`× ${result.areas.floors}`} />
                <CalcLine total label="Built-up area" value={`${formatQty(result.areas.builtUpSqFt)} sq.ft`} />
              </div>
              <p className="m-calc-note">The estimate is made from the built-up area, not the plot area.</p>
            </div>
          ) : null}
        </>
      )}

      {/* ---------------------------------------------------------------- Step 3 */}
      {step === 2 && (
        <>
          <h2 className="m-step-title">How will it be built?</h2>

          <div className="m-card m-card-pad">
            <div className="m-step-card-title">Construction type</div>
            <div className="m-option-list" role="group" aria-label="Construction type">
              {STRUCTURES.map(s => (
                <button key={s.value} type="button" className="m-option" aria-pressed={structureType === s.value} onClick={() => setStructureType(s.value)}>
                  {s.label}
                </button>
              ))}
            </div>
            {structureType !== 'Framed Structure (RCC)' && (
              <p className="m-calc-note">The quantities use rates for RCC-framed houses. They are not changed for this construction type, so check the steel and brick rates in the last step.</p>
            )}
          </div>

          <div className="m-card m-card-pad" style={{ marginTop: 10 }}>
            <div className="m-step-card-title">Finish and specification</div>
            <Segmented label="Finish and specification level" value={level.value} onChange={changeLevel} options={LEVELS.map(l => ({ value: l.value, label: l.label }))} />
            <p className="m-calc-note">{level.hint}</p>
            <div style={{ height: 6 }} />
            <Field
              label="Finishes and services (₹ per sq.ft, optional)"
              hint="One rate for tiles, paint, doors and windows, electrical and plumbing. Leave empty to leave them out of the estimate."
            >
              <input type="text" inputMode="decimal" autoComplete="off" value={finishing} onChange={e => setFinishing(e.target.value)} placeholder="Not included" aria-label="Finishes and services rate per square foot" />
            </Field>
            {tried && errors.finishing && <Note tone="bad" role="alert">{errors.finishing}</Note>}
          </div>

          <div className="m-card m-card-pad" style={{ marginTop: 10 }}>
            <div className="m-step-card-title">Materials</div>
            <Field label="Sand">
              <Chips
                label="Sand"
                value={includeRiverSand ? 'river' : 'msand'}
                onChange={v => setIncludeRiverSand(v === 'river')}
                options={[{ value: 'msand', label: 'M-sand for everything' }, { value: 'river', label: 'River sand for plastering' }]}
              />
            </Field>
            <Field label="Concrete grade">
              <Chips label="Concrete grade" value={concreteGrade} onChange={setConcreteGrade} options={(['M15', 'M20', 'M25', 'M30'] as ConcreteGrade[]).map(g => ({ value: g, label: g }))} />
            </Field>
            <Field label="Steel grade">
              <Chips label="Steel grade" value={steelGrade} onChange={setSteelGrade} options={(['Fe415', 'Fe500', 'Fe550'] as SteelGrade[]).map(g => ({ value: g, label: g.replace('Fe', 'Fe ') }))} />
            </Field>
            <p className="m-calc-note" style={{ marginTop: 0 }}>The two grades are written on the estimate. They do not change the quantities.</p>
          </div>
        </>
      )}

      {/* ---------------------------------------------------------------- Step 4 */}
      {step === 3 && !result && (
        <div className="m-card">
          <Empty icon={<Building2 size={26} />} title="The estimate can not be shown yet">
            {errors.prices || errors.rates || errors.finishing || errors.footprint || errors.plot || errors.floors}
          </Empty>
        </div>
      )}

      {step === 3 && result && (
        <>
          <div className="m-estimate-hero">
            <Badge tone="warn">Approximate</Badge>
            <div className="m-estimate-total">{formatINR(result.total)}</div>
            <div className="m-row-sub">
              about {formatINR(result.costPerSqFt)} per sq.ft · {formatQty(result.areas.builtUpSqFt)} sq.ft built-up
            </div>
          </div>

          <div className="m-card m-card-pad" style={{ marginTop: 10 }}>
            <div className="m-calc">
              <CalcLine label="Plot area" value={result.areas.plotSqFt === null ? 'not given' : `${formatQty(result.areas.plotSqFt)} sq.ft`} />
              <CalcLine label={`Building on one floor${result.areas.coveragePct !== null ? ` (${result.areas.coveragePct}% of plot)` : ''}`} value={`${formatQty(result.areas.footprintSqFt)} sq.ft`} />
              <CalcLine label={floorsLabel(result.areas.floors)} value={`× ${result.areas.floors}`} />
              <CalcLine total label="Built-up area" value={`${formatQty(result.areas.builtUpSqFt)} sq.ft`} />
            </div>
          </div>

          {result.warnings.length > 0 && (
            <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
              {result.warnings.map(w => <Note key={w} tone="warn">{w}</Note>)}
            </div>
          )}

          <Section title="Materials">
            <div className="m-card m-list">
              {result.lines.map(l => (
                <div key={l.material} className="m-row" style={{ alignItems: 'flex-start' }}>
                  <span className="m-row-main">
                    <span className="m-row-title" style={{ display: 'block' }}>
                      {l.material === 'Sand' ? 'River sand' : l.material === 'Aggregate' ? 'Aggregate (jelly)' : l.material}
                    </span>
                    <span className="m-row-sub" style={{ whiteSpace: 'normal' }}>
                      {l.working}{l.rateChanged ? ' (your rate)' : ''} · {formatINR(l.rate)} per {l.unit === 'Bags' ? 'bag' : l.unit === 'Pieces' ? 'piece' : l.unit.toLowerCase()}
                    </span>
                  </span>
                  <span className="m-row-end">
                    <span className="m-qty" style={{ display: 'block' }}>
                      {formatQty(l.quantity)}<small>{l.unit === 'Kg' ? 'kg' : l.unit === 'CFT' ? 'cft' : l.unit.toLowerCase()}</small>
                    </span>
                    <span className="m-row-sub">{formatINR(l.estimatedCost)}</span>
                  </span>
                </div>
              ))}
            </div>
            <p className="m-calc-note">
              Steel {formatQty((result.lines.find(l => l.material === 'Steel')?.quantity || 0) / 1000)} tonnes. Sand and aggregate are in cubic feet: 100 cft is one unit.
            </p>
          </Section>

          <Section title="Cost">
            <div className="m-card m-card-pad">
              <div className="m-calc">
                <CalcLine label={`Materials (${Math.round((result.materialCost / (result.total || 1)) * 100)}%)`} value={formatINR(result.materialCost)} />
                <CalcLine
                  label={`Labour: ${formatQty(result.areas.builtUpSqFt)} sq.ft × ${formatINR(input.prices.labourPerSqFt)} (${Math.round((result.labourCost / (result.total || 1)) * 100)}%)`}
                  value={formatINR(result.labourCost)}
                />
                <CalcLine
                  label={result.finishingCost > 0 ? `Finishes and services: ${formatQty(result.areas.builtUpSqFt)} sq.ft × ${formatINR(input.finishingPerSqFt)}` : 'Finishes and services'}
                  value={result.finishingCost > 0 ? formatINR(result.finishingCost) : 'not included'}
                  tone={result.finishingCost > 0 ? undefined : 'muted'}
                />
                <CalcLine total label="Total (approximate)" value={formatINR(result.total)} />
              </div>
            </div>
          </Section>

          <Section
            title="Prices"
            action={<button type="button" className="m-btn is-small no-print" onClick={() => setQuotesOpen(true)}><Tag size={16} /> Supplier quotes</button>}
          >
            <div className="m-card m-card-pad">
              <div className="m-field-2">
                {PRICE_FIELDS.filter(p => p.field !== 'sandPerCft' || result.rates.sandCftPerSqFt > 0).map(p => (
                  <Field key={p.field} label={`${p.label} (₹ per ${p.per})`}>
                    <input
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      value={prices[p.field]}
                      onChange={e => setPrices(prev => ({ ...prev, [p.field]: e.target.value }))}
                      aria-label={`${p.label} price per ${p.per}`}
                    />
                  </Field>
                ))}
              </div>
              {unreadPrices.length > 0 && (
                <div style={{ marginBottom: 10 }}>
                  <Note tone="bad" role="alert">Enter a price for {unreadPrices.join(', ').toLowerCase()}. Until then it is counted as ₹0 and the estimate can not be saved.</Note>
                </div>
              )}
              <p className="m-calc-note" style={{ marginTop: 0 }}>These open with example prices, not today's market prices. Change them to your dealer's and contractor's rates; the estimate updates as you type.</p>
            </div>
          </Section>

          <Section
            title="How it is worked out"
            action={<button type="button" className="m-btn is-small no-print" onClick={() => setShowRates(v => !v)} aria-expanded={showRates}>{showRates ? 'Hide rates' : 'Change rates'}</button>}
          >
            <div className="m-card m-card-pad">
              {showRates && (
                <>
                  <p className="m-calc-note" style={{ marginTop: 0, marginBottom: 10 }}>Material needed for each sq.ft of built-up area. The usual range from the sources is shown under each one.</p>
                  <div className="m-field-2">
                    {RATE_FIELDS.filter(r => r.field !== 'sandCftPerSqFt' || includeRiverSand || rateText.sandCftPerSqFt !== undefined).map(r => (
                      <Field key={r.field} label={`${r.label} (${r.unit})`} hint={`Usual: ${r.range}`}>
                        <input
                          type="text"
                          inputMode="decimal"
                          autoComplete="off"
                          value={rateText[r.field] ?? String(published[r.field])}
                          onChange={e => setRateText(prev => ({ ...prev, [r.field]: e.target.value }))}
                          aria-label={`${r.label} per square foot`}
                        />
                      </Field>
                    ))}
                  </div>
                  {unreadRates.length > 0 && (
                    <div style={{ marginBottom: 10 }}>
                      <Note tone="bad" role="alert">Enter a rate for {unreadRates.join(', ').toLowerCase()}. Until then the published rate is used.</Note>
                    </div>
                  )}
                  <p className="m-calc-note" style={{ marginTop: 0 }}>{RATE_FIELDS.find(r => r.field === 'bricksPiecesPerSqFt')?.note}</p>
                  {Object.keys(rateText).length > 0 && (
                    <button type="button" className="m-btn is-small" style={{ marginBottom: 12 }} onClick={() => setRateText({})}>Back to the published rates</button>
                  )}
                </>
              )}
              <ul className="m-plain-list">
                {result.assumptions.map(a => <li key={a}>{a}</li>)}
              </ul>
              <p className="m-calc-note">
                Rates are from:{' '}
                {THUMB_RULE_SOURCES.map((s, i) => (
                  <React.Fragment key={s.url}>
                    {i > 0 && '; '}
                    <a href={s.url} target="_blank" rel="noopener noreferrer">{s.title}</a>
                  </React.Fragment>
                ))}
                . The sources do not agree exactly, which is why each rate is a range.
              </p>
            </div>
          </Section>

          <Section title="Not included">
            <div className="m-card m-card-pad">
              <ul className="m-plain-list">
                {result.notIncluded.map(n => <li key={n}>{n}</li>)}
              </ul>
              <p className="m-calc-note">{result.disclaimer}</p>
            </div>
          </Section>

          <div className="m-btn-row no-print" style={{ marginTop: 14 }}>
            <button type="button" className="m-btn is-primary" onClick={openSave} disabled={unreadPrices.length > 0}><Save size={18} /> Save</button>
            <button type="button" className="m-btn" onClick={exportCsv} disabled={unreadPrices.length > 0}><Download size={18} /> File</button>
            <button type="button" className="m-btn" onClick={() => window.print()}><Printer size={18} /> Print</button>
          </div>
        </>
      )}

      {/* ---------------------------------------------------------------- Step buttons */}
      <div className="m-btn-row no-print" style={{ marginTop: 14 }}>
        {step > 0 && <button type="button" className="m-btn" onClick={() => goTo(step - 1)}><ArrowLeft size={18} /> Back</button>}
        {step < 3 && <button type="button" className="m-btn is-primary" onClick={next}>{step === 2 ? 'Show estimate' : 'Next'} <ArrowRight size={18} /></button>}
      </div>

      {/* ---------------------------------------------------------------- Saved estimates */}
      {(step === 0 || step === 3) && (
        <div className="no-print">
          <Section title={`Saved estimates (${saved.length})`}>
            {saved.length === 0 ? (
              <div className="m-card"><Empty icon={<Save size={24} />} title="None saved yet">Finish the four steps, then save the estimate to a project.</Empty></div>
            ) : (
              <div className="m-card m-list">
                {saved.map(est => (
                  <div key={est.id} className="m-row">
                    <button type="button" className="m-row-main" style={{ textAlign: 'left' }} onClick={() => load(est)}>
                      <span className="m-row-title" style={{ display: 'block' }}>{est.estimateName}</span>
                      <span className="m-row-sub" style={{ whiteSpace: 'normal' }}>
                        {formatQty(est.convertedBuiltUpSqFt)} sq.ft · {formatINR(est.totalEstimatedCost)} · {formatDay((est.createdAt || '').slice(0, 10))}
                        {est.siteName ? ` · ${est.siteName}` : ''}
                      </span>
                    </button>
                    {est.siteId && onOpenSite && (
                      <button type="button" className="m-icon-btn" onClick={() => onOpenSite(est.siteId!)} aria-label={`Open project ${est.siteName || ''}`}><ExternalLink size={18} /></button>
                    )}
                    <button type="button" className="m-icon-btn" onClick={() => setRemoving(est)} aria-label={`Delete ${est.estimateName}`}><Trash2 size={18} /></button>
                    <ChevronRight size={18} className="is-muted" aria-hidden="true" />
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>
      )}

      {/* ---------------------------------------------------------------- Save */}
      <Sheet
        open={saveOpen && !saveDuplicate}
        title="Save estimate"
        subtitle={result ? `${formatINR(result.total)} approximate` : undefined}
        onClose={() => setSaveOpen(false)}
        footer={
          <>
            <button type="button" className="m-btn" onClick={() => setSaveOpen(false)} disabled={saving}>Cancel</button>
            <button type="button" className="m-btn is-primary" onClick={() => save()} disabled={saving || !saveName.trim()}>{saving ? 'Saving…' : 'Save'}</button>
          </>
        }
      >
        {saveError && <div style={{ marginBottom: 12 }}><Note tone="bad" role="alert">{saveError}</Note></div>}
        <Field label="Name">
          <input type="text" value={saveName} onChange={e => setSaveName(e.target.value)} maxLength={80} />
        </Field>
        <Field label="Project" hint="Saved to a project, the estimate can be compared with what is actually bought there.">
          <select value={saveSiteId} onChange={e => setSaveSiteId(e.target.value)}>
            <option value="">No project</option>
            {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
        <Field label="Notes (optional)">
          <input type="text" value={saveNotes} onChange={e => setSaveNotes(e.target.value)} maxLength={200} placeholder="Notes / comments" />
        </Field>
      </Sheet>

      <ConfirmSheet
        open={saveDuplicate}
        title="Already saved?"
        message="An estimate with this name and the same total is already saved. Save a second copy only if you mean to."
        confirmLabel="Save a copy"
        busy={saving}
        onConfirm={() => save(true)}
        onCancel={() => setSaveDuplicate(false)}
      />

      <ConfirmSheet
        open={!!removing}
        title={`Delete "${removing?.estimateName}"?`}
        message="It moves to the Recycle Bin and can be restored from there."
        confirmLabel="Delete"
        danger
        onConfirm={async () => {
          if (removing) {
            const res = await removeBuildingEstimate(user, removing.id);
            onNotify(res.ok ? 'Estimate moved to the Recycle Bin' : res.error, res.ok ? 'info' : 'error');
          }
          setRemoving(null);
        }}
        onCancel={() => setRemoving(null)}
      />

      {/* ---------------------------------------------------------------- Supplier quotes */}
      <Sheet open={quotesOpen && !quoteModal} title="Supplier quotes" subtitle="Tap a quote to use its price" onClose={() => setQuotesOpen(false)}>
        <div style={{ display: 'grid', gap: 12 }}>
          {(['Cement', 'Steel', 'M-Sand', 'Sand', 'Aggregate', 'Bricks'] as EstimateMaterial[]).map(material => (
            <PriceComparisonCard
              key={material}
              material={material}
              quotes={quotes}
              selectedQuoteId={selectedQuoteIds[material]}
              onSelectQuote={applyQuote}
              onAddNewQuote={m => setQuoteModal(m)}
            />
          ))}
        </div>
      </Sheet>

      <SupplierPriceModal
        isOpen={!!quoteModal}
        onClose={() => setQuoteModal(null)}
        defaultMaterial={quoteModal || 'Cement'}
        onSaved={() => onNotify('Supplier quote saved', 'success')}
      />

      {/* ---------------------------------------------------------------- Voice */}
      <Sheet
        open={!!voice}
        title="What was heard"
        onClose={() => setVoice(null)}
        footer={
          <>
            <button type="button" className="m-btn" onClick={() => setVoice(null)}>Cancel</button>
            <button type="button" className="m-btn is-primary" onClick={applyVoice} disabled={!voice?.confidenceNotes.length}>Use it</button>
          </>
        }
      >
        {voice && (
          <>
            <Note>“{voice.transcript}”</Note>
            {voice.confidenceNotes.length ? (
              <ul className="m-plain-list" style={{ marginTop: 12 }}>
                {voice.confidenceNotes.map(n => <li key={n}>{n}</li>)}
              </ul>
            ) : (
              <p className="m-calc-note">Nothing usable was found. Try: “3 cent, ground plus one, standard quality”.</p>
            )}
            <p className="m-calc-note">A spoken size is taken as the plot. The building size is entered in step 2.</p>
          </>
        )}
      </Sheet>
    </Page>
  );
};
