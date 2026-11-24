import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  ArrowLeft, ArrowRight, BrickWall, Building2, Calculator, ChevronDown, Download, ExternalLink, Hammer, House, Mic, MicOff,
  Mountain, Package, PaintRoller, Printer, RotateCcw, Save, SlidersHorizontal, Store, Tag, Trash2, Users,
} from 'lucide-react';
import { db } from '../db/db';
import type {
  AreaUnit, BuildingEstimate, ConcreteGrade, ConstructionQuality, EstimateMaterial, MaterialPriceQuote, SteelGrade, StructureType, User,
} from '../db/types';
import {
  BUILDING_TYPES, buildEstimate, emptySize, ENGINEERING_DEFAULTS, EXAMPLE_PRICES, FLOOR_CHOICES, floorsCode, HOUSE_TYPES, houseTypeLabel,
  MAX_FLOORS, PRICE_FIELDS, QUALITY_CHOICES, QUICK_DEFAULTS, RATE_FIELDS, sizeSqFt,
  type EstimateInput, type EstimatePrices, type LengthUnit, type RateField, type SizeInput,
} from '../domain/estimate';
import { fromSqFt, getQualityFactors, STARTING_LABOUR_RATE, THUMB_RULE_SOURCES } from '../utils/estimator';
import { estimatesFor, removeBuildingEstimate, saveBuildingEstimate } from '../services/estimates';
import { isSpeechRecognitionSupported, parseVoiceInput, startVoiceRecognition, type ParsedVoiceEstimate } from '../utils/voiceParser';
import { formatDay, todayKey } from '../utils/datetime';
import { formatINR, formatQty, parseAmount } from '../utils/money';
import { useLanguage } from '../services/i18n';
import { SupplierPriceModal } from '../components/SupplierPriceModal';
import { PriceComparisonCard } from '../components/PriceComparisonCard';
import { ConfirmSheet, Empty, Field, Note, Page, Section, Segmented, Sheet } from '../components/mobile/kit';
import { generateBuildingEstimatePdfBlob, downloadFile } from '../utils/pdfGenerator';
import { AdvancedCalculatorDashboard } from '../components/calculator/AdvancedCalculatorDashboard';
import '../styles/calculator-simple.css';

/**
 * Building Calculator.
 *
 * Simple mode (the default): four questions, one per screen, each already answered with a
 * sensible default so it can be tapped through, then the approximate cost.
 *   1. Size of one floor   2. Floors (G … G+3)   3. Building type   4. Construction quality
 * Prices, material rates, sand and structure type wait in "Edit rates" under the result.
 *
 * Detail mode: the engineering calculators (walls, slabs, beams, plaster, flooring, sand, BOQ),
 * opened only from "Detail estimate".
 *
 * The arithmetic and every assumption live in domain/estimate.ts.
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
const startSize = (sqFt?: number | null): SizeText => ({
  ...blankSize('area'),
  area: String(sqFt && sqFt > 0 ? Math.round(sqFt) : QUICK_DEFAULTS.footprintSqFt),
});

const SIZE_PRESETS = ['600', '800', '1000', '1200', '1500', '2000'];

/** Questions 1–4, then the result. */
const QUESTIONS = 4;
const RESULT = QUESTIONS;

const QUOTE_FIELD: Record<EstimateMaterial, { field: keyof EstimatePrices; unit: RegExp; per: string }> = {
  Cement: { field: 'cementPerBag', unit: /^bags?$/i, per: 'bag' },
  Sand: { field: 'sandPerCft', unit: /^cft$/i, per: 'cft' },
  'M-Sand': { field: 'msandPerCft', unit: /^cft$/i, per: 'cft' },
  Aggregate: { field: 'aggregatePerCft', unit: /^cft$/i, per: 'cft' },
  Bricks: { field: 'brickPerPiece', unit: /^(piece|pieces|nos)$/i, per: 'piece' },
  Steel: { field: 'steelPerKg', unit: /^kg$/i, per: 'kg' },
};

const MATERIAL_SHOW: Record<string, { name: string; icon: React.ReactNode }> = {
  Cement: { name: 'Cement', icon: <Package size={18} /> },
  Steel: { name: 'Steel (TMT)', icon: <Hammer size={18} /> },
  'M-Sand': { name: 'M-Sand', icon: <Mountain size={18} /> },
  Sand: { name: 'River sand', icon: <PaintRoller size={18} /> },
  Aggregate: { name: 'Jelly (aggregate)', icon: <Mountain size={18} /> },
  Bricks: { name: 'Bricks', icon: <BrickWall size={18} /> },
};

/**
 * On a phone the detail calculators' tables are shown one card per row (calculator-simple.css).
 * Each cell gets its column's name as `data-label`, so a value like "18%" still says what it is.
 */
function labelTableCells(root: HTMLElement) {
  for (const table of Array.from(root.querySelectorAll('table'))) {
    const heads = Array.from(table.querySelectorAll('thead th')).map(th => (th.textContent || '').trim());
    if (!heads.some(Boolean)) continue;
    for (const row of Array.from(table.querySelectorAll('tbody tr, tfoot tr'))) {
      Array.from(row.children).forEach((cell, i) => {
        const name = heads[i];
        if (name && (cell as HTMLElement).dataset.label !== name) (cell as HTMLElement).dataset.label = name;
      });
    }
  }
}

const unitWord = (unit: string) => (unit === 'Kg' ? 'kg' : unit === 'CFT' ? 'cft' : unit === 'Bags' ? 'bags' : unit === 'Pieces' ? 'nos' : unit.toLowerCase());
const priceText = (p: EstimatePrices) => Object.fromEntries(PRICE_FIELDS.map(f => [f.field, String(p[f.field])])) as Record<keyof EstimatePrices, string>;
const qualityLabel = (q: ConstructionQuality) => QUALITY_CHOICES.find(c => c.value === q)?.label ?? q;
const buildingLabel = (b: string) => BUILDING_TYPES.find(t => t.value === b)?.label ?? b;
const BUILDING_ICON: Record<string, React.ReactNode> = {
  'Residential House': <House size={22} />,
  'Duplex / Villa': <Building2 size={22} />,
  'Commercial Building': <Store size={22} />,
};

export const EstimatorView: React.FC<EstimatorViewProps> = ({ user, initialBuildingSqFt, onBack, onOpenSite, onNotify }) => {
  const { t } = useLanguage();
  const [mode, setMode] = useState<'simple' | 'detail'>('simple');
  const [step, setStep] = useState(0);
  const [tried, setTried] = useState(false);   // show field errors once Next has been pressed on a step

  const [buildingType, setBuildingType] = useState(QUICK_DEFAULTS.buildingType);
  const [plot, setPlot] = useState<SizeText>(blankSize());
  const [showPlot, setShowPlot] = useState(false);
  const [footprint, setFootprint] = useState<SizeText>(() => startSize(initialBuildingSqFt));
  const [floors, setFloors] = useState(QUICK_DEFAULTS.floors);
  const [structureType, setStructureType] = useState<StructureType>('Framed Structure (RCC)');
  const [quality, setQuality] = useState<ConstructionQuality>(QUICK_DEFAULTS.quality);
  // Engineering defaults: used for every estimate, never asked for on these screens.
  const [concreteGrade, setConcreteGrade] = useState<ConcreteGrade>(ENGINEERING_DEFAULTS.concreteGrade);
  const [steelGrade, setSteelGrade] = useState<SteelGrade>(ENGINEERING_DEFAULTS.steelGrade);
  const [includeRiverSand, setIncludeRiverSand] = useState(false);
  const [finishing, setFinishing] = useState('');
  const [prices, setPrices] = useState(() => priceText(EXAMPLE_PRICES));
  const [rateText, setRateText] = useState<Partial<Record<RateField, string>>>({});

  const [showRates, setShowRates] = useState(false);
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

  const detailRef = useRef<HTMLDivElement>(null);
  const [listening, setListening] = useState(false);
  const [voice, setVoice] = useState<ParsedVoiceEstimate | null>(null);
  const recognition = useRef<{ stop: () => void } | null>(null);

  const sites = useLiveQuery(() => db.getSitesForUser(user), [user.id]) || [];
  const quotes = useLiveQuery(() => db.materialPrices.filter(p => !p.isDeleted).toArray(), []) || [];
  const saved = useLiveQuery(() => estimatesFor(user), [user.id]) || [];

  useEffect(() => () => { try { recognition.current?.stop(); } catch { /* already stopped */ } }, []);

  // Detail mode: keep table cells labelled as the panels render and change.
  useEffect(() => {
    const root = detailRef.current;
    if (mode !== 'detail' || !root) return;
    labelTableCells(root);
    const watch = new MutationObserver(() => labelTableCells(root));
    watch.observe(root, { childList: true, subtree: true });
    return () => watch.disconnect();
  }, [mode]);

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

  const startAgain = () => {
    setBuildingType(QUICK_DEFAULTS.buildingType);
    setShowPlot(false);
    setPlot(blankSize());
    setFootprint(startSize());
    setFloors(QUICK_DEFAULTS.floors);
    setStructureType('Framed Structure (RCC)');
    changeLevel(QUICK_DEFAULTS.quality);
    setIncludeRiverSand(false);
    setShowRates(false);
    goTo(0);
  };

  const applyQuote = (quote: MaterialPriceQuote) => {
    const target = QUOTE_FIELD[quote.material];
    if (!target || !target.unit.test((quote.unit || '').trim())) {
      return onNotify(`That quote is per ${quote.unit}. The calculator needs a price per ${target?.per ?? 'unit'}, so it was not applied.`, 'error');
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
    onNotify('Filled in what was heard. Check the plot and the building size.', 'info');
  };

  const openSave = () => {
    if (!result) return;
    setSaveName(`${buildingLabel(buildingType)} ${floorsCode(result.areas.floors)}, ${formatQty(result.areas.builtUpSqFt)} sq.ft`);
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
      // An unknown material in an old estimate is skipped rather than crashing the screen.
      for (const m of est.materialEstimates) {
        const target = QUOTE_FIELD[m.material];
        if (target && Number.isFinite(m.rate)) p[target.field] = m.rate;
      }
      setPrices(priceText(p));
      setRateText({});
      setFinishing('');
    }
    setMode('simple');
    goTo(RESULT);
    onNotify(
      kept ? `Opened "${est.estimateName}"` : `Opened "${est.estimateName}". It was saved by the earlier calculator, so the quantities are worked out again with the current rates.`,
      'info'
    );
  };

  const downloadPdf = () => {
    if (!result) return;
    const siteObj = sites.find(s => s.id === saveSiteId);
    const pdfBlob = generateBuildingEstimatePdfBlob({
      projectName: siteObj?.name,
      estimateName: saveName || `${buildingLabel(buildingType)} ${floorsCode(result.areas.floors)}, ${formatQty(result.areas.builtUpSqFt)} sq.ft`,
      buildingType,
      structureType: houseTypeLabel(structureType) || structureType,
      quality,
      builtUpSqFt: result.areas.builtUpSqFt,
      footprintSqFt: result.areas.footprintSqFt,
      floors: result.areas.floors,
      plotSqFt: result.areas.plotSqFt,
      sandType: includeRiverSand ? 'River Sand (Plastering) + M-Sand' : 'Full M-Sand',
      materialLines: result.lines.map(l => ({
        material: l.material,
        quantity: l.quantity,
        unit: l.unit,
        rate: l.rate,
        estimatedCost: l.estimatedCost,
      })),
      materialCost: result.materialCost,
      labourCost: result.labourCost,
      finishingCost: result.finishingCost,
      totalCost: result.total,
      costPerSqFt: result.costPerSqFt,
      dateStr: formatDay(todayKey()),
    });

    const filename = `Building_Estimate_${Math.round(result.areas.builtUpSqFt)}sqft_${todayKey()}.pdf`;
    downloadFile(pdfBlob, filename);
    onNotify('Estimate PDF downloaded', 'success');
  };

  const areaLine = (sqFt: number) =>
    Number.isNaN(sqFt) ? null : (
      <p className="calc-area-line">
        = <strong>{formatQty(sqFt)} sq.ft</strong> ({formatQty(fromSqFt(sqFt, 'sq.m'))} sq.m)
      </p>
    );

  /** One compact, tappable answer: icon, label, one short line. */
  const option = (key: string, picked: boolean, onPick: () => void, icon: React.ReactNode, title: string, detail: string) => (
    <button key={key} type="button" className={`calc-opt ${picked ? 'is-picked' : ''}`} aria-pressed={picked} onClick={onPick}>
      <span className="calc-opt-icon" aria-hidden="true">{icon}</span>
      <span className="calc-opt-text">
        <span className="calc-opt-title">{title}</span>
        <span className="calc-opt-detail">{detail}</span>
      </span>
      <span className="calc-opt-mark" aria-hidden="true" />
    </button>
  );

  const floorOptions = floors > FLOOR_CHOICES.length
    ? [...FLOOR_CHOICES, ...Array.from({ length: floors - FLOOR_CHOICES.length }, (_, i) => ({ value: FLOOR_CHOICES.length + i + 1, label: floorsCode(FLOOR_CHOICES.length + i + 1) }))]
    : FLOOR_CHOICES;

  // ---------------------------------------------------------------------- Detail mode
  if (mode === 'detail') {
    return (
      <Page className="container calc-detail" title={t('calc_title')} subtitle={t('calc_view_details')} onBack={onBack}>
        <button type="button" className="m-btn is-block calc-detail-back no-print" onClick={() => setMode('simple')}>
          <ArrowLeft size={18} /> {t('calc_quick_estimate')}
        </button>
        <div ref={detailRef}>
          <AdvancedCalculatorDashboard
            user={user}
            onNotify={onNotify}
            onSelectSite={onOpenSite}
            initialBuildingSqFt={result?.areas.footprintSqFt ?? initialBuildingSqFt}
          />
        </div>
      </Page>
    );
  }

  // ---------------------------------------------------------------------- Simple mode
  return (
    <Page
      className="container calc-simple"
      title={t('calc_title')}
      subtitle={t('calc_subtitle')}
      onBack={onBack}
      right={
        isSpeechRecognitionSupported() && step < RESULT ? (
          <button type="button" className={`m-icon-btn is-bordered no-print ${listening ? 'is-bad' : ''}`} onClick={toggleVoice} aria-label={listening ? 'Stop listening' : 'Fill by voice'} aria-pressed={listening}>
            {listening ? <MicOff size={20} /> : <Mic size={20} />}
          </button>
        ) : undefined
      }
    >
      {step < RESULT && (
        <div className="calc-progress no-print" aria-label={`${t('calc_step')} ${step + 1} / ${QUESTIONS}`}>
          <span className="calc-progress-count">{step + 1}/{QUESTIONS}</span>
          <span className="calc-progress-bar" aria-hidden="true">
            <span style={{ width: `${((step + 1) / QUESTIONS) * 100}%` }} />
          </span>
        </div>
      )}

      {listening && <div style={{ marginBottom: 10 }}><Note>Listening. Say the plot size, floors and quality, for example “3 cent, ground plus one, standard”.</Note></div>}

      {/* ------------------------------------------------------------ 1. Size */}
      {step === 0 && (
        <div className="calc-q">
          <h2 className="calc-q-title">{t('calc_q_size')}</h2>
          <p className="calc-q-help">{t('calc_q_size_help')}</p>
          <Segmented
            label="Enter the size as"
            value={footprint.mode === 'dimensions' ? 'dimensions' : 'area'}
            onChange={m => setFootprint({ ...footprint, mode: m })}
            options={[{ value: 'area', label: 'Area' }, { value: 'dimensions', label: 'Length × Width' }]}
          />
          {footprint.mode !== 'dimensions' ? (
            <>
              <div className="calc-size-row">
                <input
                  type="text" inputMode="decimal" autoComplete="off" className="calc-big-input"
                  value={footprint.area}
                  onChange={e => setFootprint({ ...footprint, mode: 'area', area: e.target.value })}
                  aria-label="Area of one floor" id="calc-sqft"
                />
                <Segmented
                  label="Area unit"
                  value={footprint.areaUnit === 'sq.m' ? 'sq.m' : 'sq.ft'}
                  onChange={u => setFootprint({ ...footprint, mode: 'area', areaUnit: u })}
                  options={[{ value: 'sq.ft', label: 'sq.ft' }, { value: 'sq.m', label: 'sq.m' }]}
                />
              </div>
              {footprint.areaUnit === 'sq.ft' && (
                <div className="calc-presets" role="group" aria-label="Common sizes">
                  {SIZE_PRESETS.map(v => (
                    <button key={v} type="button" className="calc-chip" aria-pressed={footprint.area === v}
                      onClick={() => setFootprint({ ...footprint, mode: 'area', areaUnit: 'sq.ft', area: v })}>
                      {Number(v).toLocaleString('en-IN')}
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              <div className="calc-dims">
                <Field label="Length">
                  <input type="text" inputMode="decimal" autoComplete="off" value={footprint.length} onChange={e => setFootprint({ ...footprint, length: e.target.value })} placeholder="40" aria-label="Building length" />
                </Field>
                <Field label="Width">
                  <input type="text" inputMode="decimal" autoComplete="off" value={footprint.width} onChange={e => setFootprint({ ...footprint, width: e.target.value })} placeholder="25" aria-label="Building width" />
                </Field>
              </div>
              <Segmented
                label="Length unit"
                value={footprint.lengthUnit}
                onChange={u => setFootprint({ ...footprint, lengthUnit: u })}
                options={[{ value: 'ft', label: 'Feet' }, { value: 'm', label: 'Metres' }]}
              />
            </>
          )}
          {areaLine(footprintSqFt)}
          {tried && errors.footprint && <Note tone="bad" role="alert">{errors.footprint}</Note>}

          <div className="calc-fold">
            <button type="button" className="calc-toggle" aria-expanded={showPlot} onClick={() => setShowPlot(v => !v)}>
              <span>Plot size <span className="is-muted">(optional)</span></span>
              <ChevronDown size={18} className={showPlot ? 'is-open' : ''} aria-hidden="true" />
            </button>
            {showPlot && (
              <div className="calc-fold-body">
                <p className="calc-note">The land. Only used to check the building fits; it does not change the estimate.</p>
                <Segmented label="Plot size entered as" value={plot.mode === 'area' ? 'area' : 'dimensions'} onChange={m => setPlot({ ...plot, mode: m })}
                  options={[{ value: 'dimensions', label: 'Length × Width' }, { value: 'area', label: 'Area' }]} />
                {plot.mode !== 'area' ? (
                  <>
                    <div className="calc-dims">
                      <Field label="Length"><input type="text" inputMode="decimal" autoComplete="off" value={plot.length} onChange={e => setPlot({ ...plot, length: e.target.value })} placeholder="60" aria-label="Plot length" /></Field>
                      <Field label="Width"><input type="text" inputMode="decimal" autoComplete="off" value={plot.width} onChange={e => setPlot({ ...plot, width: e.target.value })} placeholder="40" aria-label="Plot width" /></Field>
                    </div>
                    <Segmented label="Plot length unit" value={plot.lengthUnit} onChange={u => setPlot({ ...plot, lengthUnit: u })}
                      options={[{ value: 'ft', label: 'Feet' }, { value: 'm', label: 'Metres' }]} />
                  </>
                ) : (
                  <div className="calc-dims">
                    <Field label="Area"><input type="text" inputMode="decimal" autoComplete="off" value={plot.area} onChange={e => setPlot({ ...plot, area: e.target.value })} placeholder="2400" aria-label="Plot area" /></Field>
                    <Field label="Unit">
                      <select value={plot.areaUnit} onChange={e => setPlot({ ...plot, areaUnit: e.target.value as AreaUnit })} aria-label="Plot area unit">
                        <option value="sq.ft">sq.ft</option><option value="sq.m">sq.m</option><option value="cent">cent</option><option value="ground">ground</option>
                      </select>
                    </Field>
                  </div>
                )}
                {areaLine(plotSqFt)}
                {tried && errors.plot && <Note tone="bad" role="alert">{errors.plot}</Note>}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------ 2. Floors */}
      {step === 1 && (
        <div className="calc-q">
          <h2 className="calc-q-title">{t('calc_q_floors')}</h2>
          <div className="calc-floors" role="group" aria-label="Number of floors">
            {floorOptions.map(f => (
              <button key={f.value} type="button" className={`calc-floor-btn ${floors === f.value ? 'is-picked' : ''}`} aria-pressed={floors === f.value} onClick={() => setFloors(f.value)}>
                <span className="calc-floor-code">{f.label}</span>
                <span className="calc-floor-sub">{f.value} floor{f.value > 1 ? 's' : ''}</span>
              </button>
            ))}
          </div>
          {result && (
            <p className="calc-area-line">
              {formatQty(result.areas.footprintSqFt)} sq.ft × {result.areas.floors} = <strong>{formatQty(result.areas.builtUpSqFt)} sq.ft</strong> built-up
            </p>
          )}
          {tried && errors.floors && <Note tone="bad" role="alert">{errors.floors}</Note>}
        </div>
      )}

      {/* ------------------------------------------------------------ 3. Building type */}
      {step === 2 && (
        <div className="calc-q">
          <h2 className="calc-q-title">{t('calc_q_type')}</h2>
          <div className="calc-opts">
            {BUILDING_TYPES.map(b => option(b.value, buildingType === b.value, () => setBuildingType(b.value), BUILDING_ICON[b.value] ?? <House size={22} />, b.label, b.detail))}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------ 4. Quality */}
      {step === 3 && (
        <div className="calc-q">
          <h2 className="calc-q-title">{t('calc_q_quality')}</h2>
          <div className="calc-opts">
            {QUALITY_CHOICES.map((q, i) => option(q.value, quality === q.value, () => changeLevel(q.value), <span className="calc-opt-stars">{'★'.repeat(i + 1)}</span>, q.label, q.detail))}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------ Result: not possible */}
      {step === RESULT && !result && (
        <div className="m-card">
          <Empty icon={<Building2 size={26} />} title="The estimate can not be shown yet">
            {errors.prices || errors.rates || errors.finishing || errors.footprint || errors.plot || errors.floors}
          </Empty>
          <div className="m-btn-row" style={{ padding: '0 16px 16px' }}>
            <button type="button" className="m-btn is-primary" onClick={() => (errors.footprint || errors.plot || errors.floors ? goTo(0) : setShowRates(true))}>
              {errors.footprint || errors.plot || errors.floors ? 'Go to the size' : t('calc_edit_rates')}
            </button>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------ Result */}
      {step === RESULT && result && (
        <>
          <div className="calc-hero">
            <div className="calc-hero-label">{t('calc_total')}</div>
            <div className="calc-hero-total" id="calc-total">{formatINR(result.total)}</div>
            <div className="calc-hero-sub">
              {formatINR(result.costPerSqFt)}/sq.ft · {formatQty(result.areas.builtUpSqFt)} sq.ft · {floorsCode(result.areas.floors)}
            </div>
          </div>

          <div className="calc-approx" role="note">{t('calc_approx_note')}</div>

          <div className="calc-tags">
            <span>{buildingLabel(buildingType)}</span>
            <span>{qualityLabel(quality)}</span>
            <span>{includeRiverSand ? 'River sand + M-sand' : 'M-sand'}</span>
          </div>

          {result.warnings.length > 0 && (
            <div className="calc-warnings">
              {result.warnings.map(w => <Note key={w} tone="warn">{w}</Note>)}
            </div>
          )}

          <Section title={t('calc_breakdown')}>
            <div className="m-card calc-lines">
              {result.lines.map(l => {
                const show = MATERIAL_SHOW[l.material] || { name: l.material, icon: <Package size={18} /> };
                return (
                  <div key={l.material} className="calc-line">
                    <span className="calc-line-icon" aria-hidden="true">{show.icon}</span>
                    <span className="calc-line-main">
                      <span className="calc-line-name">{show.name}</span>
                      <span className="calc-line-qty">{formatQty(l.quantity)} {unitWord(l.unit)}{l.rateChanged ? ' · your rate' : ''}</span>
                    </span>
                    <span className="calc-line-cost">{formatINR(l.estimatedCost)}</span>
                  </div>
                );
              })}
              <div className="calc-line is-sum">
                <span className="calc-line-main"><span className="calc-line-name">{t('calc_materials')}</span></span>
                <span className="calc-line-cost">{formatINR(result.materialCost)}</span>
              </div>
              <div className="calc-line">
                <span className="calc-line-icon" aria-hidden="true"><Users size={18} /></span>
                <span className="calc-line-main">
                  <span className="calc-line-name">{t('calc_labour')}</span>
                  <span className="calc-line-qty">{formatQty(result.areas.builtUpSqFt)} sq.ft × {formatINR(input.prices.labourPerSqFt)}</span>
                </span>
                <span className="calc-line-cost">{formatINR(result.labourCost)}</span>
              </div>
              {result.finishingCost > 0 && (
                <div className="calc-line">
                  <span className="calc-line-icon" aria-hidden="true"><PaintRoller size={18} /></span>
                  <span className="calc-line-main">
                    <span className="calc-line-name">Finishes allowance</span>
                    <span className="calc-line-qty">{formatQty(result.areas.builtUpSqFt)} sq.ft × {formatINR(input.finishingPerSqFt)}</span>
                  </span>
                  <span className="calc-line-cost">{formatINR(result.finishingCost)}</span>
                </div>
              )}
              <div className="calc-line is-total">
                <span className="calc-line-main"><span className="calc-line-name">Total</span></span>
                <span className="calc-line-cost">{formatINR(result.total)}</span>
              </div>
            </div>
          </Section>

          <div className="calc-excluded-note" id="calc-not-included">
            <strong>{t('calc_excluded_title')}:</strong>{' '}
            {result.finishingCost > 0 ? t('calc_excluded_list_finish') : t('calc_excluded_list')}
          </div>

          <div className="calc-actions no-print">
            <button type="button" className="m-btn is-primary" onClick={openSave} disabled={unreadPrices.length > 0}><Save size={18} /> Save</button>
            <button type="button" className="m-btn" onClick={downloadPdf} disabled={unreadPrices.length > 0} aria-label="Download PDF"><Download size={18} /> PDF</button>
            <button type="button" className="m-btn" onClick={() => window.print()} aria-label="Print"><Printer size={18} /></button>
          </div>

          {/* Edit rates: everything a first-time user does not need. */}
          <div className="calc-fold no-print">
            <button type="button" className="calc-toggle" aria-expanded={showRates} onClick={() => setShowRates(v => !v)} id="calc-adjust">
              <span><SlidersHorizontal size={18} aria-hidden="true" /> {t('calc_edit_rates')}</span>
              <ChevronDown size={18} className={showRates ? 'is-open' : ''} aria-hidden="true" />
            </button>
            {showRates && (
              <div className="calc-fold-body">
                <Field label="Sand">
                  <Segmented label="Sand" value={includeRiverSand ? 'river' : 'msand'} onChange={v => setIncludeRiverSand(v === 'river')}
                    options={[{ value: 'msand', label: 'M-Sand only' }, { value: 'river', label: 'River sand' }]} />
                </Field>
                <p className="calc-note">River sand: used for plastering only (30% of the sand); M-sand for the rest.</p>

                <Field label="Structure">
                  <Segmented label="Structure" value={structureType === 'Load Bearing' ? 'Load Bearing' : 'Framed Structure (RCC)'}
                    onChange={v => setStructureType(v as StructureType)}
                    options={HOUSE_TYPES.map(h => ({ value: h.value as string, label: h.value === 'Load Bearing' ? 'Pillar-free' : 'Pillar & beam' }))} />
                </Field>

                <div className="calc-sub-title">Prices (₹)</div>
                <p className="calc-note">They start as examples, not today's market prices. Put in your dealer's and contractor's rates.</p>
                <div className="calc-fields">
                  {PRICE_FIELDS.filter(p => p.field !== 'sandPerCft' || result.rates.sandCftPerSqFt > 0).map(p => (
                    <Field key={p.field} label={`${p.label} / ${p.per}`}>
                      <input type="text" inputMode="decimal" autoComplete="off" value={prices[p.field]}
                        onChange={e => setPrices(prev => ({ ...prev, [p.field]: e.target.value }))} aria-label={`${p.label} price per ${p.per}`} />
                    </Field>
                  ))}
                </div>
                {unreadPrices.length > 0 && (
                  <Note tone="bad" role="alert">Enter a price for {unreadPrices.join(', ').toLowerCase()}. Until then it is counted as ₹0 and the estimate can not be saved.</Note>
                )}
                <button type="button" className="m-btn is-block" onClick={() => setQuotesOpen(true)}><Tag size={18} /> Use a supplier quote</button>

                <Field label="Finishes allowance (₹ per sq.ft)" hint="Tiles, paint, doors, windows, electrical and plumbing as one rate. Leave empty to keep them out.">
                  <input type="text" inputMode="decimal" autoComplete="off" value={finishing} onChange={e => setFinishing(e.target.value)} placeholder="Not included" aria-label="Finishes allowance per square foot" />
                </Field>
                {errors.finishing && <Note tone="bad" role="alert">{errors.finishing}</Note>}

                <div className="calc-sub-title">Material per sq.ft</div>
                <div className="calc-fields">
                  {RATE_FIELDS.filter(r => r.field !== 'sandCftPerSqFt' || includeRiverSand || rateText.sandCftPerSqFt !== undefined).map(r => (
                    <Field key={r.field} label={`${r.label} (${r.unit})`} hint={`Usual ${r.range}`}>
                      <input type="text" inputMode="decimal" autoComplete="off" value={rateText[r.field] ?? String(published[r.field])}
                        onChange={e => setRateText(prev => ({ ...prev, [r.field]: e.target.value }))} aria-label={`${r.label} per square foot`} />
                    </Field>
                  ))}
                </div>
                {unreadRates.length > 0 && (
                  <Note tone="bad" role="alert">Enter a rate for {unreadRates.join(', ').toLowerCase()}. Until then the published rate is used.</Note>
                )}
                {(errors.prices || errors.rates) && <Note tone="bad" role="alert">{errors.prices || errors.rates}</Note>}
                {Object.keys(rateText).length > 0 && (
                  <button type="button" className="m-btn is-block" onClick={() => setRateText({})}><RotateCcw size={18} /> Back to the published rates</button>
                )}
              </div>
            )}
          </div>

          <div className="calc-fold">
            <button type="button" className="calc-toggle" aria-expanded={showHow} onClick={() => setShowHow(v => !v)}>
              <span>How this is worked out</span>
              <ChevronDown size={18} className={showHow ? 'is-open' : ''} aria-hidden="true" />
            </button>
            {showHow && (
              <div className="calc-fold-body">
                <ul className="calc-plain-list">
                  {result.assumptions.map(a => <li key={a}>{a}</li>)}
                </ul>
                <div className="calc-sub-title">{t('calc_excluded_title')}</div>
                <ul className="calc-plain-list">
                  {result.notIncluded.map(n => <li key={n}>{n}</li>)}
                </ul>
                <p className="calc-note">{result.disclaimer}</p>
                <p className="calc-note">
                  Rates are from:{' '}
                  {THUMB_RULE_SOURCES.map((s, i) => (
                    <React.Fragment key={s.url}>
                      {i > 0 && '; '}
                      <a href={s.url} target="_blank" rel="noopener noreferrer">{s.title}</a>
                    </React.Fragment>
                  ))}
                  .
                </p>
              </div>
            )}
          </div>

          <div className="calc-actions no-print">
            <button type="button" className="m-btn" onClick={() => setMode('detail')} id="calc-detail"><Calculator size={18} /> {t('calc_view_details')}</button>
            <button type="button" className="m-btn" onClick={startAgain}><RotateCcw size={18} /> {t('calc_start_again')}</button>
          </div>
        </>
      )}

      {/* ------------------------------------------------------------ Step buttons */}
      {step < RESULT ? (
        <div className="calc-nav no-print">
          {step > 0 && <button type="button" className="m-btn" onClick={() => goTo(step - 1)}><ArrowLeft size={18} /> {t('calc_back')}</button>}
          <button type="button" className="m-btn is-primary" onClick={next} id="calc-next">
            {step === QUESTIONS - 1 ? t('calc_calculate') : t('calc_next')} <ArrowRight size={18} />
          </button>
        </div>
      ) : (
        <div className="calc-nav no-print">
          <button type="button" className="m-btn" onClick={() => goTo(QUESTIONS - 1)}><ArrowLeft size={18} /> {t('calc_back')}</button>
        </div>
      )}

      {/* ------------------------------------------------------------ Saved estimates */}
      {(step === 0 || step === RESULT) && (
        <div className="no-print">
          <Section title={`${t('calc_saved')} (${saved.length})`}>
            {saved.length === 0 ? (
              <p className="calc-note">None saved yet. Answer the four questions, then save the estimate to a site.</p>
            ) : (
              <div className="m-card calc-saved">
                {saved.map(est => (
                  <div key={est.id} className="calc-saved-row">
                    <button type="button" className="calc-saved-main" onClick={() => load(est)}>
                      <span className="calc-saved-name">{est.estimateName}</span>
                      <span className="calc-saved-sub">
                        {formatINR(est.totalEstimatedCost)} · {formatQty(est.convertedBuiltUpSqFt)} sq.ft{est.siteName ? ` · ${est.siteName}` : ''}
                      </span>
                    </button>
                    {est.siteId && onOpenSite && (
                      <button type="button" className="m-icon-btn" onClick={() => onOpenSite(est.siteId!)} aria-label={`Open site ${est.siteName || ''}`}><ExternalLink size={18} /></button>
                    )}
                    <button type="button" className="m-icon-btn" onClick={() => setRemoving(est)} aria-label={`Delete ${est.estimateName}`}><Trash2 size={18} /></button>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>
      )}

      {/* ------------------------------------------------------------ Save */}
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
        <Field label="Site" hint="Saved to a site, the estimate can be compared with what is actually bought there.">
          <select value={saveSiteId} onChange={e => setSaveSiteId(e.target.value)}>
            <option value="">No site</option>
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

      {/* ------------------------------------------------------------ Supplier quotes */}
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

      {/* ------------------------------------------------------------ Voice */}
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
              <ul className="calc-plain-list" style={{ marginTop: 12 }}>
                {voice.confidenceNotes.filter(n => !/\b(M\d\d|Fe\s?\d{3})\b/i.test(n)).map(n => <li key={n}>{n}</li>)}
              </ul>
            ) : (
              <p className="calc-note">Nothing usable was found. Try: “3 cent, ground plus one, standard quality”.</p>
            )}
            <p className="calc-note">A spoken size is taken as the plot. The size of one floor is set in step 1.</p>
          </>
        )}
      </Sheet>
    </Page>
  );
};
