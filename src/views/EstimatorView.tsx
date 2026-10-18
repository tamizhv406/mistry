import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  ArrowLeft, ArrowRight, BrickWall, Building2, Check, ChevronDown, ChevronRight, Download, ExternalLink, Hammer, House, Layers, Mic, MicOff,
  Mountain, Package, PaintRoller, Printer, Ruler, Save, SlidersHorizontal, Tag, Trash2, Users,
} from 'lucide-react';
import { db } from '../db/db';
import type {
  AreaUnit, BuildingEstimate, ConcreteGrade, ConstructionQuality, EstimateMaterial, MaterialPriceQuote, SteelGrade, StructureType, User,
} from '../db/types';
import {
  buildEstimate, emptySize, ENGINEERING_DEFAULTS, estimateReportRows, EXAMPLE_PRICES, HOUSE_TYPES, houseTypeLabel, MAX_FLOORS, PRICE_FIELDS, RATE_FIELDS,
  sizeSqFt, toCsv, type EstimateInput, type EstimatePrices, type LengthUnit, type RateField, type SizeInput,
} from '../domain/estimate';
import { fromSqFt, getQualityFactors, STARTING_LABOUR_RATE, THUMB_RULE_SOURCES } from '../utils/estimator';
import { estimatesFor, removeBuildingEstimate, saveBuildingEstimate } from '../services/estimates';
import { isSpeechRecognitionSupported, parseVoiceInput, startVoiceRecognition, type ParsedVoiceEstimate } from '../utils/voiceParser';
import { formatDay, todayKey } from '../utils/datetime';
import { formatINR, formatQty, parseAmount } from '../utils/money';
import { SupplierPriceModal } from '../components/SupplierPriceModal';
import { PriceComparisonCard } from '../components/PriceComparisonCard';
import { Badge, CalcLine, ConfirmSheet, Empty, Field, Note, Page, Section, Segmented, Sheet } from '../components/mobile/kit';

/**
 * Building Calculator: four plain questions, then an approximate estimate.
 *
 *   1. How many square feet are you planning to build?   (one floor)
 *   2. How many floors do you need?
 *   3. What type of house do you prefer?                  (pillar & beam, or pillar-free)
 *   4. Which materials will you use?                      (full M-sand, or river sand for plastering)
 *
 * The arithmetic and every assumption live in domain/estimate.ts. Concrete and steel grades are
 * not asked for: the rates do not depend on them, so ENGINEERING_DEFAULTS are used and written
 * only into the saved estimate and the exported file.
 */

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

const LEVELS: { value: ConstructionQuality; label: string; hint: string }[] = [
  { value: 'Economy', label: 'Basic', hint: 'Lean specification: the low end of each published range.' },
  { value: 'Standard', label: 'Standard', hint: 'The middle of each published range.' },
  { value: 'Premium', label: 'Premium', hint: 'Heavier specification: the high end of each published range.' },
];

const AREA_UNITS: { value: AreaUnit; label: string }[] = [
  { value: 'sq.ft', label: 'sq.ft' }, { value: 'sq.m', label: 'sq.m' }, { value: 'cent', label: 'cent' }, { value: 'ground', label: 'ground' },
];

const SIZE_PRESETS = ['600', '800', '1000', '1200', '1500', '2000'];

const STEPS = ['Size', 'Floors', 'House', 'Materials', 'Estimate'];
const RESULT = STEPS.length - 1;

const QUOTE_FIELD: Record<EstimateMaterial, { field: keyof EstimatePrices; unit: RegExp; per: string }> = {
  Cement: { field: 'cementPerBag', unit: /^bags?$/i, per: 'bag' },
  Sand: { field: 'sandPerCft', unit: /^cft$/i, per: 'cft' },
  'M-Sand': { field: 'msandPerCft', unit: /^cft$/i, per: 'cft' },
  Aggregate: { field: 'aggregatePerCft', unit: /^cft$/i, per: 'cft' },
  Bricks: { field: 'brickPerPiece', unit: /^(piece|pieces|nos)$/i, per: 'piece' },
  Steel: { field: 'steelPerKg', unit: /^kg$/i, per: 'kg' },
};

const MATERIAL_SHOW: Record<string, { name: string; icon: React.ReactNode }> = {
  Cement: { name: 'Cement', icon: <Package size={20} /> },
  Steel: { name: 'Steel (TMT bars)', icon: <Hammer size={20} /> },
  'M-Sand': { name: 'M-Sand (crusher sand)', icon: <Mountain size={20} /> },
  Sand: { name: 'River sand (plastering)', icon: <PaintRoller size={20} /> },
  Aggregate: { name: 'Jelly (aggregate)', icon: <Mountain size={20} /> },
  Bricks: { name: 'Bricks', icon: <BrickWall size={20} /> },
};

const floorsLabel = (n: number) => (n === 1 ? 'Ground floor only' : `Ground + ${n - 1}`);
const priceText = (p: EstimatePrices) => Object.fromEntries(PRICE_FIELDS.map(f => [f.field, String(p[f.field])])) as Record<keyof EstimatePrices, string>;

export const EstimatorView: React.FC<EstimatorViewProps> = ({ user, initialBuildingSqFt, onBack, onOpenSite, onNotify }) => {
  const [step, setStep] = useState(0);
  const [tried, setTried] = useState(false);   // show field errors once Next has been pressed on a step

  // Not asked any more (the rates are for houses); kept for estimates saved earlier and the file.
  const [buildingType, setBuildingType] = useState('Residential Villa');
  const [plot, setPlot] = useState<SizeText>(blankSize());
  const [showPlot, setShowPlot] = useState(false);
  const [footprint, setFootprint] = useState<SizeText>(() =>
    initialBuildingSqFt && initialBuildingSqFt > 0 ? { ...blankSize('area'), area: String(Math.round(initialBuildingSqFt)) } : blankSize('area')
  );
  const [floors, setFloors] = useState(1);
  const [structureType, setStructureType] = useState<StructureType>('Framed Structure (RCC)');
  const [quality, setQuality] = useState<ConstructionQuality>('Standard');
  // Engineering defaults: used for every estimate, never asked for on these screens.
  const [concreteGrade, setConcreteGrade] = useState<ConcreteGrade>(ENGINEERING_DEFAULTS.concreteGrade);
  const [steelGrade, setSteelGrade] = useState<SteelGrade>(ENGINEERING_DEFAULTS.steelGrade);
  const [includeRiverSand, setIncludeRiverSand] = useState(false);
  const [finishing, setFinishing] = useState('');
  const [prices, setPrices] = useState(() => priceText(EXAMPLE_PRICES));
  const [rateText, setRateText] = useState<Partial<Record<RateField, string>>>({});

  const [showAdjust, setShowAdjust] = useState(false);
  const [showHow, setShowHow] = useState(false);
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
    plot: showPlot ? toSize(plot) : null,
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
  }), [buildingType, showPlot, plot, footprint, floors, structureType, quality, concreteGrade, steelGrade, includeRiverSand, prices, rateText, finishing]);

  // Recalculated on every change to a size, a choice, a price or a rate.
  const outcome = useMemo(() => buildEstimate(input), [input]);
  const errors = outcome.ok ? {} : outcome.errors;
  const result = outcome.ok ? outcome.value : null;

  const plotSqFt = input.plot ? sizeSqFt(input.plot) : NaN;
  const footprintSqFt = sizeSqFt(input.footprint, Number.isNaN(plotSqFt) ? null : plotSqFt);
  const published = getQualityFactors(quality, includeRiverSand);

  const goTo = (next: number) => { setTried(false); setStep(next); window.scrollTo(0, 0); };
  const next = () => {
    const blocked = step === 0 ? !!(errors.plot || errors.footprint) : step === 1 ? !!errors.floors : false;
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
    if (voice.lengthFt && voice.widthFt) { setShowPlot(true); setPlot({ ...blankSize('dimensions'), length: String(voice.lengthFt), width: String(voice.widthFt) }); }
    else if (voice.plotArea && voice.plotAreaUnit) { setShowPlot(true); setPlot({ ...blankSize('area'), area: String(voice.plotArea), areaUnit: voice.plotAreaUnit }); }
    if (voice.floors) setFloors(Math.min(MAX_FLOORS, Math.max(1, voice.floors)));
    if (voice.quality && voice.quality !== 'Custom') changeLevel(voice.quality);
    if (voice.structureType === 'Framed Structure (RCC)' || voice.structureType === 'Load Bearing') setStructureType(voice.structureType);
    if (voice.concreteGrade && voice.concreteGrade !== 'Custom') setConcreteGrade(voice.concreteGrade);
    if (voice.steelGrade && voice.steelGrade !== 'Custom') setSteelGrade(voice.steelGrade);
    if (voice.includeRiverSand !== undefined) setIncludeRiverSand(voice.includeRiverSand);
    setVoice(null);
    goTo(0);
    onNotify('Filled in what was heard. Check the plot and enter the building size.', 'info');
  };

  const openSave = () => {
    if (!result) return;
    setSaveName(`${houseTypeLabel(structureType)}, ${formatQty(result.areas.builtUpSqFt)} sq.ft`);
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
      setShowPlot(!!kept.plot);
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
      setShowPlot(false);
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
    goTo(RESULT);
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

  const areaLine = (sqFt: number) =>
    Number.isNaN(sqFt) ? null : (
      <p className="m-calc-note" style={{ marginTop: 6 }}>
        = <strong>{formatQty(sqFt)} sq.ft</strong> ({formatQty(fromSqFt(sqFt, 'sq.m'))} sq.m)
      </p>
    );

  /** A large tappable choice: icon, title and a short explanation. */
  const choice = (key: string, picked: boolean, onPick: () => void, icon: React.ReactNode, title: string, detail: string) => (
    <button key={key} type="button" className={`calc-choice ${picked ? 'is-picked' : ''}`} aria-pressed={picked} onClick={onPick}>
      <span className="calc-choice-icon" aria-hidden="true">{icon}</span>
      <span className="calc-choice-text">
        <span className="calc-choice-title">{title}</span>
        <span className="calc-choice-detail">{detail}</span>
      </span>
      <span className="calc-choice-mark" aria-hidden="true">{picked ? <Check size={18} /> : null}</span>
    </button>
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
      <ol className="m-steps calc-steps no-print" aria-label="Steps">
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

      {/* ---------------------------------------------------------------- 1. Size */}
      {step === 0 && (
        <>
          <h2 className="m-step-title calc-question"><Ruler size={22} aria-hidden="true" /> How many square feet are you planning to build?</h2>
          <p className="calc-help">The size of one floor of the house. Floors are added in the next step.</p>
          <div className="m-card m-card-pad">
            <Segmented
              label="Enter the size as"
              value={footprint.mode === 'dimensions' ? 'dimensions' : 'area'}
              onChange={mode => setFootprint({ ...footprint, mode })}
              options={[{ value: 'area', label: 'Square feet' }, { value: 'dimensions', label: 'Length × width' }]}
            />
            <div style={{ height: 12 }} />
            {footprint.mode !== 'dimensions' ? (
              <>
                <Field label="Square feet of one floor">
                  <input
                    type="text" inputMode="decimal" autoComplete="off" className="calc-big-input" placeholder="e.g. 1000"
                    value={footprint.area}
                    onChange={e => setFootprint({ ...footprint, mode: 'area', areaUnit: 'sq.ft', area: e.target.value })}
                    aria-label="Square feet of one floor" id="calc-sqft"
                  />
                </Field>
                <div className="m-chips calc-presets" role="group" aria-label="Common sizes">
                  {SIZE_PRESETS.map(v => (
                    <button key={v} type="button" className="m-chip" aria-pressed={footprint.area === v && footprint.areaUnit === 'sq.ft'}
                      onClick={() => setFootprint({ ...footprint, mode: 'area', areaUnit: 'sq.ft', area: v })}>
                      {Number(v).toLocaleString('en-IN')} sq.ft
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 84px', gap: 10 }}>
                <Field label="Length">
                  <input type="text" inputMode="decimal" autoComplete="off" value={footprint.length} onChange={e => setFootprint({ ...footprint, length: e.target.value })} placeholder="40" aria-label="Building length" />
                </Field>
                <Field label="Width">
                  <input type="text" inputMode="decimal" autoComplete="off" value={footprint.width} onChange={e => setFootprint({ ...footprint, width: e.target.value })} placeholder="25" aria-label="Building width" />
                </Field>
                <Field label="Unit">
                  <select value={footprint.lengthUnit} onChange={e => setFootprint({ ...footprint, lengthUnit: e.target.value as LengthUnit })} aria-label="Length unit">
                    <option value="ft">ft</option>
                    <option value="m">m</option>
                  </select>
                </Field>
              </div>
            )}
            {areaLine(footprintSqFt)}
            {tried && errors.footprint && <Note tone="bad" role="alert">{errors.footprint}</Note>}
          </div>

          <div className="m-card m-card-pad" style={{ marginTop: 10 }}>
            <button type="button" className="calc-toggle" aria-expanded={showPlot} onClick={() => setShowPlot(v => !v)}>
              <span>I know my plot size <span className="is-muted">(optional)</span></span>
              <ChevronDown size={18} className={showPlot ? 'is-open' : ''} aria-hidden="true" />
            </button>
            {showPlot && (
              <div style={{ marginTop: 12 }}>
                <p className="m-calc-note" style={{ marginTop: 0 }}>The land. Used only to check the house fits on it; it does not change the estimate.</p>
                <Segmented label="Plot size entered as" value={plot.mode === 'area' ? 'area' : 'dimensions'} onChange={mode => setPlot({ ...plot, mode })}
                  options={[{ value: 'dimensions', label: 'Length × width' }, { value: 'area', label: 'Area' }]} />
                <div style={{ height: 10 }} />
                {plot.mode !== 'area' ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 84px', gap: 10 }}>
                    <Field label="Length"><input type="text" inputMode="decimal" autoComplete="off" value={plot.length} onChange={e => setPlot({ ...plot, length: e.target.value })} placeholder="60" aria-label="Plot length" /></Field>
                    <Field label="Width"><input type="text" inputMode="decimal" autoComplete="off" value={plot.width} onChange={e => setPlot({ ...plot, width: e.target.value })} placeholder="40" aria-label="Plot width" /></Field>
                    <Field label="Unit">
                      <select value={plot.lengthUnit} onChange={e => setPlot({ ...plot, lengthUnit: e.target.value as LengthUnit })} aria-label="Plot length unit">
                        <option value="ft">ft</option><option value="m">m</option>
                      </select>
                    </Field>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 112px', gap: 10 }}>
                    <Field label="Area"><input type="text" inputMode="decimal" autoComplete="off" value={plot.area} onChange={e => setPlot({ ...plot, area: e.target.value })} placeholder="2400" aria-label="Plot area" /></Field>
                    <Field label="Unit">
                      <select value={plot.areaUnit} onChange={e => setPlot({ ...plot, areaUnit: e.target.value as AreaUnit })} aria-label="Plot area unit">
                        {AREA_UNITS.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
                      </select>
                    </Field>
                  </div>
                )}
                {areaLine(plotSqFt)}
                {tried && errors.plot && <Note tone="bad" role="alert">{errors.plot}</Note>}
              </div>
            )}
          </div>
        </>
      )}

      {/* ---------------------------------------------------------------- 2. Floors */}
      {step === 1 && (
        <>
          <h2 className="m-step-title calc-question"><Layers size={22} aria-hidden="true" /> How many floors do you need?</h2>
          <p className="calc-help">Every floor is taken to be the same size as the first.</p>
          <div className="calc-floor-grid" role="group" aria-label="Number of floors">
            {Array.from({ length: MAX_FLOORS }, (_, i) => i + 1).map(n => (
              <button key={n} type="button" className={`calc-floor ${floors === n ? 'is-picked' : ''}`} aria-pressed={floors === n} onClick={() => setFloors(n)}>
                <span className="calc-floor-num">{n}</span>
                <span className="calc-floor-label">{floorsLabel(n)}</span>
              </button>
            ))}
          </div>
          {result && (
            <div className="m-card m-card-pad" style={{ marginTop: 12 }}>
              <div className="m-calc">
                <CalcLine label="One floor" value={`${formatQty(result.areas.footprintSqFt)} sq.ft`} />
                <CalcLine label="Floors" value={`× ${result.areas.floors}`} />
                <CalcLine total label="Total built-up area" value={`${formatQty(result.areas.builtUpSqFt)} sq.ft`} />
              </div>
            </div>
          )}
          {tried && errors.floors && <Note tone="bad" role="alert">{errors.floors}</Note>}
        </>
      )}

      {/* ---------------------------------------------------------------- 3. House type */}
      {step === 2 && (
        <>
          <h2 className="m-step-title calc-question"><House size={22} aria-hidden="true" /> What type of house do you prefer?</h2>
          <div className="calc-choices">
            {HOUSE_TYPES.map((h, i) => choice(h.value, structureType === h.value, () => setStructureType(h.value), i === 0 ? <Building2 size={26} /> : <House size={26} />, h.label, h.detail))}
          </div>
          {structureType === 'Load Bearing' && floors > 2 && (
            <div style={{ marginTop: 10 }}>
              <Note tone="warn">For {floors} floors, a pillar & beam house with professional structural design is the usual choice. Check with an engineer before planning a pillar-free house this tall.</Note>
            </div>
          )}
          {structureType !== 'Framed Structure (RCC)' && structureType !== 'Load Bearing' && (
            <div style={{ marginTop: 10 }}>
              <Note tone="warn">This estimate was saved as a {houseTypeLabel(structureType).toLowerCase()}. Pick one of the two house types above to work it out again.</Note>
            </div>
          )}
          <p className="m-calc-note">Either way, the house must be designed and checked by a qualified engineer. This calculator does not do that.</p>
        </>
      )}

      {/* ---------------------------------------------------------------- 4. Materials */}
      {step === 3 && (
        <>
          <h2 className="m-step-title calc-question"><Mountain size={22} aria-hidden="true" /> Which materials will you use?</h2>
          <div className="calc-choices">
            {choice('msand', !includeRiverSand, () => setIncludeRiverSand(false), <Mountain size={26} />, 'Full M-Sand (Crusher Sand)', 'M-sand for concrete, brickwork and plastering.')}
            {choice('river', includeRiverSand, () => setIncludeRiverSand(true), <PaintRoller size={26} />, 'River Sand for Plastering Only', 'M-sand for concrete and brickwork; river sand only for plastering.')}
          </div>
        </>
      )}

      {/* ---------------------------------------------------------------- 5. Estimate */}
      {step === RESULT && !result && (
        <div className="m-card">
          <Empty icon={<Building2 size={26} />} title="The estimate can not be shown yet">
            {errors.prices || errors.rates || errors.finishing || errors.footprint || errors.plot || errors.floors}
          </Empty>
          <div className="m-btn-row" style={{ padding: '0 16px 16px' }}>
            <button type="button" className="m-btn is-primary" onClick={() => goTo(0)}>Go to the size</button>
          </div>
        </div>
      )}

      {step === RESULT && result && (
        <>
          <div className="m-estimate-hero calc-hero">
            <Badge tone="warn">Approximate</Badge>
            <div className="m-estimate-total" id="calc-total">{formatINR(result.total)}</div>
            <div className="m-row-sub">
              about {formatINR(result.costPerSqFt)} per sq.ft · {formatQty(result.areas.builtUpSqFt)} sq.ft built-up · {floorsLabel(result.areas.floors)}
            </div>
            <div className="calc-hero-note" role="note">Approximate estimate only. Actual cost may vary.</div>
          </div>

          <div className="calc-summary">
            <span><House size={15} aria-hidden="true" /> {houseTypeLabel(structureType)}</span>
            <span><Mountain size={15} aria-hidden="true" /> {includeRiverSand ? 'River sand for plastering only' : 'Full M-Sand'}</span>
          </div>

          {result.warnings.length > 0 && (
            <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
              {result.warnings.map(w => <Note key={w} tone="warn">{w}</Note>)}
            </div>
          )}

          <Section title="Estimated quantities">
            <div className="m-card m-list">
              {result.lines.map(l => {
                const show = MATERIAL_SHOW[l.material] || { name: l.material, icon: <Package size={20} /> };
                const unit = l.unit === 'Kg' ? 'kg' : l.unit === 'CFT' ? 'cft' : l.unit === 'Bags' ? 'bags' : l.unit.toLowerCase();
                return (
                  <div key={l.material} className="m-row" style={{ alignItems: 'center' }}>
                    <span className="m-row-icon">{show.icon}</span>
                    <span className="m-row-main">
                      <span className="m-row-title" style={{ display: 'block' }}>{show.name}</span>
                      <span className="m-row-sub" style={{ whiteSpace: 'normal' }}>
                        {formatINR(l.rate)} per {l.unit === 'Bags' ? 'bag' : l.unit === 'Pieces' ? 'piece' : l.unit.toLowerCase()}{l.rateChanged ? ' · your rate' : ''}
                      </span>
                    </span>
                    <span className="m-row-end">
                      <span className="m-qty" style={{ display: 'block' }}>{formatQty(l.quantity)}<small>{unit}</small></span>
                      <span className="m-row-sub">{formatINR(l.estimatedCost)}</span>
                    </span>
                  </div>
                );
              })}
            </div>
            <p className="m-calc-note">
              Steel is about {formatQty((result.lines.find(l => l.material === 'Steel')?.quantity || 0) / 1000)} tonnes. Sand and jelly are in cubic feet (100 cft is one unit).
            </p>
          </Section>

          <Section title="Cost">
            <div className="m-card m-card-pad">
              <div className="m-calc">
                <CalcLine label="Materials" value={formatINR(result.materialCost)} />
                <CalcLine label={<><Users size={14} aria-hidden="true" /> Labour ({formatQty(result.areas.builtUpSqFt)} sq.ft × {formatINR(input.prices.labourPerSqFt)})</>} value={formatINR(result.labourCost)} />
                {result.finishingCost > 0 && (
                  <CalcLine label={`Finishes allowance (${formatQty(result.areas.builtUpSqFt)} sq.ft × ${formatINR(input.finishingPerSqFt)})`} value={formatINR(result.finishingCost)} />
                )}
                <CalcLine total label="Total (approximate)" value={formatINR(result.total)} />
              </div>
            </div>
          </Section>

          <Section title="Not included">
            <div className="m-card m-card-pad" id="calc-not-included">
              <ul className="calc-excluded">
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

          {/* Everything a first-time user does not need, folded away: prices, level, rates. */}
          <div className="m-card m-card-pad no-print" style={{ marginTop: 14 }}>
            <button type="button" className="calc-toggle" aria-expanded={showAdjust} onClick={() => setShowAdjust(v => !v)} id="calc-adjust">
              <span><SlidersHorizontal size={16} aria-hidden="true" /> Change prices and details</span>
              <ChevronDown size={18} className={showAdjust ? 'is-open' : ''} aria-hidden="true" />
            </button>
            {showAdjust && (
              <div style={{ marginTop: 12 }}>
                <p className="m-calc-note" style={{ marginTop: 0 }}>The prices start as examples, not today's market prices. Put in your dealer's and contractor's rates; the estimate updates as you type.</p>
                <div className="m-field-2">
                  {PRICE_FIELDS.filter(p => p.field !== 'sandPerCft' || result.rates.sandCftPerSqFt > 0).map(p => (
                    <Field key={p.field} label={`${p.label} (₹ per ${p.per})`}>
                      <input type="text" inputMode="decimal" autoComplete="off" value={prices[p.field]}
                        onChange={e => setPrices(prev => ({ ...prev, [p.field]: e.target.value }))} aria-label={`${p.label} price per ${p.per}`} />
                    </Field>
                  ))}
                </div>
                {unreadPrices.length > 0 && (
                  <div style={{ marginBottom: 10 }}>
                    <Note tone="bad" role="alert">Enter a price for {unreadPrices.join(', ').toLowerCase()}. Until then it is counted as ₹0 and the estimate can not be saved.</Note>
                  </div>
                )}
                <button type="button" className="m-btn is-small" onClick={() => setQuotesOpen(true)} style={{ marginBottom: 12 }}><Tag size={16} /> Use a supplier quote</button>

                <Segmented label="Finish level" value={level.value} onChange={changeLevel} options={LEVELS.map(l => ({ value: l.value, label: l.label }))} />
                <p className="m-calc-note">{level.hint}</p>

                <Field label="Finishes allowance (₹ per sq.ft, optional)" hint="One rate for tiles, paint, doors, windows, electrical work and plumbing. Leave empty to keep them out of the estimate.">
                  <input type="text" inputMode="decimal" autoComplete="off" value={finishing} onChange={e => setFinishing(e.target.value)} placeholder="Not included" aria-label="Finishes allowance per square foot" />
                </Field>
                {errors.finishing && <Note tone="bad" role="alert">{errors.finishing}</Note>}

                <div className="m-step-card-title" style={{ marginTop: 14 }}>Material per sq.ft</div>
                <p className="m-calc-note" style={{ marginTop: 0 }}>How much of each material one sq.ft of built-up area needs. The usual range is under each.</p>
                <div className="m-field-2">
                  {RATE_FIELDS.filter(r => r.field !== 'sandCftPerSqFt' || includeRiverSand || rateText.sandCftPerSqFt !== undefined).map(r => (
                    <Field key={r.field} label={`${r.label} (${r.unit})`} hint={`Usual: ${r.range}`}>
                      <input type="text" inputMode="decimal" autoComplete="off" value={rateText[r.field] ?? String(published[r.field])}
                        onChange={e => setRateText(prev => ({ ...prev, [r.field]: e.target.value }))} aria-label={`${r.label} per square foot`} />
                    </Field>
                  ))}
                </div>
                {unreadRates.length > 0 && (
                  <div style={{ marginBottom: 10 }}>
                    <Note tone="bad" role="alert">Enter a rate for {unreadRates.join(', ').toLowerCase()}. Until then the published rate is used.</Note>
                  </div>
                )}
                {Object.keys(rateText).length > 0 && (
                  <button type="button" className="m-btn is-small" onClick={() => setRateText({})}>Back to the published rates</button>
                )}
              </div>
            )}
          </div>

          <div className="m-card m-card-pad" style={{ marginTop: 10 }}>
            <button type="button" className="calc-toggle" aria-expanded={showHow} onClick={() => setShowHow(v => !v)}>
              <span>How this is worked out</span>
              <ChevronDown size={18} className={showHow ? 'is-open' : ''} aria-hidden="true" />
            </button>
            {showHow && (
              <div style={{ marginTop: 10 }}>
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
            )}
          </div>
        </>
      )}

      {/* ---------------------------------------------------------------- Step buttons */}
      <div className="m-btn-row no-print calc-nav" style={{ marginTop: 16 }}>
        {step > 0 && <button type="button" className="m-btn" onClick={() => goTo(step - 1)}><ArrowLeft size={18} /> Back</button>}
        {step < RESULT && (
          <button type="button" className="m-btn is-primary" onClick={next} id="calc-next">
            {step === RESULT - 1 ? 'Show estimate' : 'Next'} <ArrowRight size={18} />
          </button>
        )}
      </div>

      {/* ---------------------------------------------------------------- Saved estimates */}
      {(step === 0 || step === RESULT) && (
        <div className="no-print">
          <Section title={`Saved estimates (${saved.length})`}>
            {saved.length === 0 ? (
              <div className="m-card"><Empty icon={<Save size={24} />} title="None saved yet">Answer the four questions, then save the estimate to a project.</Empty></div>
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
                {voice.confidenceNotes.filter(n => !/\b(M\d\d|Fe\s?\d{3})\b/i.test(n)).map(n => <li key={n}>{n}</li>)}
              </ul>
            ) : (
              <p className="m-calc-note">Nothing usable was found. Try: “3 cent, ground plus one, standard quality”.</p>
            )}
            <p className="m-calc-note">A spoken size is taken as the plot. The size of the house is entered in step 1.</p>
          </>
        )}
      </Sheet>
    </Page>
  );
};
