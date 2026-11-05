/**
 * Building Calculator: areas, input checks, and the assumptions behind an estimate.
 *
 * Exact here: unit conversion and area arithmetic.
 *   built-up area = building size on one floor × number of floors
 * A plot is the land; the building usually covers only part of it. The estimate is always
 * made from the built-up area, never from the plot area.
 *
 * Rule of thumb: how much material one sq.ft of built-up area needs. Those rates, their
 * published ranges and sources are in utils/estimator.ts (THUMB_RULES). Every rate used is
 * listed with the result and can be changed by the user.
 */
import type {
  AreaUnit, ConcreteGrade, ConstructionQuality, EstimatedMaterialItem, SteelGrade, StructureType,
} from '../db/types';
import {
  calculateBuildingEstimate, getQualityFactors, PRELIMINARY_ESTIMATE_DISCLAIMER, RIVER_SAND_SHARE, SQFT_PER_SQM, THUMB_RULES, toSqFt,
  type EstimationFactors,
} from '../utils/estimator';

export type LengthUnit = 'ft' | 'm';

// ---------------------------------------------------------------------------
// The calculator's plain-language choices
// ---------------------------------------------------------------------------

/**
 * The two house types the calculator offers, in the words people use on site. The rule-of-
 * thumb rates are for pillar & beam (RCC-framed) houses; a pillar-free (load-bearing) house is
 * calculated with the same rates and the result says which two rates differ in practice.
 */
export const HOUSE_TYPES: { value: StructureType; label: string; detail: string }[] = [
  {
    value: 'Framed Structure (RCC)',
    label: 'Pillar & Beam House',
    detail: 'Concrete pillars and beams carry the house. Suitable for planning upper floors, with professional structural design.',
  },
  {
    value: 'Load Bearing',
    label: 'Pillar-Free Traditional House',
    detail: 'Thick walls carry the house. Only when it suits your design and an engineer has checked it.',
  },
];

export const houseTypeLabel = (s: StructureType) => HOUSE_TYPES.find(h => h.value === s)?.label
  ?? (s === 'Steel Frame' ? 'Steel frame building' : s === 'Composite' ? 'Steel and concrete building' : s);

/**
 * Engineering defaults used for every estimate and kept off the calculator screens.
 *
 * The quantities come from rule-of-thumb rates per sq.ft of built-up area, which do not depend
 * on the concrete or steel grade, so nobody needs to choose one to get an estimate. The grades
 * below are what those rates assume for an ordinary house (M20 concrete, Fe500 TMT steel).
 * They are stored with a saved estimate and written in the exported file under "For your
 * engineer", never presented as a design: the engineer sets the real grades.
 */
export const ENGINEERING_DEFAULTS: { concreteGrade: ConcreteGrade; steelGrade: SteelGrade } = { concreteGrade: 'M20', steelGrade: 'Fe500' };

/** Finishes and services the material quantities do not cover, one per line. */
export const FINISHES_NOT_COUNTED = ['Tiles', 'Paint', 'Doors', 'Windows', 'Electrical work', 'Plumbing'];

/** One foot is exactly 0.3048 m. */
export const FT_PER_M = 1 / 0.3048;

/**
 * A size as the user gave it: length × width, a direct area, or (for the building only) a
 * share of the plot. Blank fields are NaN.
 */
export interface SizeInput {
  mode: 'dimensions' | 'area' | 'percent';
  length: number;
  width: number;
  lengthUnit: LengthUnit;
  area: number;
  areaUnit: AreaUnit;
  percent: number;
}

export const emptySize = (mode: SizeInput['mode'] = 'dimensions'): SizeInput => ({
  mode, length: NaN, width: NaN, lengthUnit: 'ft', area: NaN, areaUnit: 'sq.ft', percent: NaN,
});

const positive = (n: number) => Number.isFinite(n) && n > 0;
const round2 = (n: number) => Math.round(n * 100) / 100;

/** Area in sq.ft, or NaN when the size is incomplete. `plotSqFt` is needed for a percent size. */
export function sizeSqFt(size: SizeInput, plotSqFt?: number | null): number {
  if (size.mode === 'dimensions') {
    if (!positive(size.length) || !positive(size.width)) return NaN;
    const raw = size.length * size.width;
    return round2(size.lengthUnit === 'm' ? raw * SQFT_PER_SQM : raw);
  }
  if (size.mode === 'area') return positive(size.area) ? round2(toSqFt(size.area, size.areaUnit)) : NaN;
  if (!positive(size.percent) || !positive(plotSqFt ?? NaN)) return NaN;
  return round2(((plotSqFt as number) * size.percent) / 100);
}

/** True when nothing has been typed into the size yet. */
export const isBlankSize = (size: SizeInput) =>
  size.mode === 'dimensions' ? Number.isNaN(size.length) && Number.isNaN(size.width)
    : size.mode === 'area' ? Number.isNaN(size.area) : Number.isNaN(size.percent);

export const MAX_FLOORS = 5;
/** Below this a "building" is almost certainly a typing or unit mistake. */
export const MIN_FOOTPRINT_SQFT = 50;
/** Above this the house rates are a rough guide at best. */
export const LARGE_BUILDING_SQFT = 10000;

export interface AreaPlan {
  plotSqFt: number | null;      // null: not given
  footprintSqFt: number;        // building size on one floor
  floors: number;
  builtUpSqFt: number;          // footprint × floors
  coveragePct: number | null;   // footprint as a share of the plot
  openSqFt: number | null;      // plot left open around the building
}

export interface AreaCheck {
  plan: AreaPlan | null;
  errors: { plot?: string; footprint?: string; floors?: string };
  warnings: string[];
}

/**
 * Checks the sizes and works out the built-up area.
 * The plot is optional; when it is given the building must fit on it.
 */
export function planAreas(input: { plot: SizeInput | null; footprint: SizeInput; floors: number }): AreaCheck {
  const errors: AreaCheck['errors'] = {};
  const warnings: string[] = [];

  let plotSqFt: number | null = null;
  if (input.plot && !isBlankSize(input.plot)) {
    const p = sizeSqFt(input.plot);
    if (Number.isNaN(p)) errors.plot = 'Enter the full plot size, or clear it if you do not know it.';
    else plotSqFt = p;
  }

  let footprintSqFt = NaN;
  if (input.footprint.mode === 'percent' && plotSqFt === null) {
    errors.footprint = 'Enter the plot size first, or give the building size directly.';
  } else {
    footprintSqFt = sizeSqFt(input.footprint, plotSqFt);
    if (Number.isNaN(footprintSqFt)) {
      errors.footprint = input.footprint.mode === 'percent'
        ? 'Choose how much of the plot the building covers.'
        : 'Enter the size of the building on one floor.';
    } else if (input.footprint.mode === 'percent' && input.footprint.percent > 100) {
      errors.footprint = 'The building can not cover more than 100% of the plot.';
    } else if (footprintSqFt < MIN_FOOTPRINT_SQFT) {
      errors.footprint = `That is only ${footprintSqFt} sq.ft. Check the numbers and the unit.`;
    } else if (plotSqFt !== null && footprintSqFt > plotSqFt + 0.5) {
      errors.footprint = `The building (${footprintSqFt} sq.ft) is larger than the plot (${plotSqFt} sq.ft).`;
    }
  }

  if (!Number.isInteger(input.floors) || input.floors < 1 || input.floors > MAX_FLOORS) {
    errors.floors = `Choose 1 to ${MAX_FLOORS} floors.`;
  }

  if (errors.plot || errors.footprint || errors.floors) return { plan: null, errors, warnings };

  const builtUpSqFt = round2(footprintSqFt * input.floors);
  const coveragePct = plotSqFt ? Math.round((footprintSqFt / plotSqFt) * 1000) / 10 : null;
  if (coveragePct !== null && coveragePct > 90) {
    warnings.push(`The building covers ${coveragePct}% of the plot. Local rules normally ask for open space around a building, so check that this size is allowed.`);
  }
  if (builtUpSqFt > LARGE_BUILDING_SQFT) {
    warnings.push('The rates used here are planning figures for houses. For a building this large, treat the result as a rough guide only.');
  }

  return {
    plan: {
      plotSqFt,
      footprintSqFt,
      floors: input.floors,
      builtUpSqFt,
      coveragePct,
      openSqFt: plotSqFt === null ? null : round2(Math.max(0, plotSqFt - footprintSqFt)),
    },
    errors,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// Rates and prices
// ---------------------------------------------------------------------------

export type RateField = Exclude<keyof EstimationFactors, 'labourRatePerSqFt'>;

/** The material rates the user can see and change, with the range the sources give. */
export const RATE_FIELDS: { field: RateField; label: string; unit: string; range: string; note?: string }[] = [
  { field: 'cementBagsPerSqFt', label: 'Cement', unit: 'bags', range: `${THUMB_RULES.cement.low}–${THUMB_RULES.cement.high}` },
  { field: 'steelKgPerSqFt', label: 'Steel', unit: 'kg', range: `${THUMB_RULES.steel.low}–${THUMB_RULES.steel.high}` },
  { field: 'msandCftPerSqFt', label: 'M-Sand', unit: 'cft', range: `sand in all ${THUMB_RULES.sand.low}–${THUMB_RULES.sand.high}` },
  { field: 'sandCftPerSqFt', label: 'River sand', unit: 'cft', range: `sand in all ${THUMB_RULES.sand.low}–${THUMB_RULES.sand.high}` },
  { field: 'aggregateCftPerSqFt', label: 'Aggregate (jelly)', unit: 'cft', range: `${THUMB_RULES.aggregate.low}–${THUMB_RULES.aggregate.high}` },
  {
    field: 'bricksPiecesPerSqFt', label: 'Bricks', unit: 'pieces', range: `${THUMB_RULES.bricks.low}–${THUMB_RULES.bricks.high}`,
    note: 'Depends most on the walls: 9-inch walls take about twice the bricks of 4.5-inch walls.',
  },
];

export interface EstimatePrices {
  cementPerBag: number;
  sandPerCft: number;
  msandPerCft: number;
  aggregatePerCft: number;
  brickPerPiece: number;
  steelPerKg: number;
  labourPerSqFt: number;
}

export const PRICE_FIELDS: { field: keyof EstimatePrices; label: string; per: string }[] = [
  { field: 'cementPerBag', label: 'Cement', per: 'bag' },
  { field: 'steelPerKg', label: 'Steel', per: 'kg' },
  { field: 'msandPerCft', label: 'M-Sand', per: 'cft' },
  { field: 'sandPerCft', label: 'River sand', per: 'cft' },
  { field: 'aggregatePerCft', label: 'Aggregate (jelly)', per: 'cft' },
  { field: 'brickPerPiece', label: 'Bricks', per: 'piece' },
  { field: 'labourPerSqFt', label: 'Labour', per: 'sq.ft' },
];

/**
 * Prices the calculator opens with. They are examples so that a total can be shown at once,
 * not current market prices: the result says how many are still the example value.
 */
export const EXAMPLE_PRICES: EstimatePrices = {
  cementPerBag: 420, sandPerCft: 135, msandPerCft: 45, aggregatePerCft: 42, brickPerPiece: 10.5, steelPerKg: 74, labourPerSqFt: 320,
};

export interface EstimateInput {
  buildingType: string;
  plot: SizeInput | null;
  footprint: SizeInput;
  floors: number;
  structureType: StructureType;
  quality: ConstructionQuality;
  concreteGrade: ConcreteGrade;
  steelGrade: SteelGrade;
  includeRiverSand: boolean;
  prices: EstimatePrices;
  /** Rates the user changed. Anything not listed uses the published rate for the level. */
  rateOverrides: Partial<Record<RateField, number>>;
  /** Tiles, paint, doors, windows, electrical and plumbing, as one rate. 0 = not included. */
  finishingPerSqFt: number;
}

export interface EstimateLine extends EstimatedMaterialItem {
  /** "2,000 sq.ft × 0.45 bags" */
  working: string;
  rateChanged: boolean;
}

export interface EstimateOutcome {
  areas: AreaPlan;
  lines: EstimateLine[];
  rates: EstimationFactors;
  ratesChanged: RateField[];
  materialCost: number;
  labourCost: number;
  finishingCost: number;
  total: number;
  costPerSqFt: number;
  examplePricesLeft: number;
  /** Shown on the result screen, in plain words. */
  assumptions: string[];
  /** Defaults behind the rates (concrete and steel grade). Kept off the screens: saved estimate and file only. */
  engineerNotes: string[];
  notIncluded: string[];
  warnings: string[];
  disclaimer: string;
}

export type EstimateErrors = AreaCheck['errors'] & { prices?: string; rates?: string; finishing?: string };

const LEVEL_WORD: Record<ConstructionQuality, string> = {
  Economy: 'the low end', Standard: 'the middle', Premium: 'the high end', Custom: 'the middle',
};

const fmt = (n: number) => n.toLocaleString('en-IN', { maximumFractionDigits: 2 });

/** Buildings the house rates were not written for. */
const NON_HOUSE = /commercial|industrial|shed|warehouse|shop/i;

/**
 * The whole estimate from the wizard's inputs, or the reasons it can not be made.
 * Pure: the same inputs always give the same result.
 */
export function buildEstimate(input: EstimateInput): { ok: true; value: EstimateOutcome } | { ok: false; errors: EstimateErrors } {
  const areaCheck = planAreas(input);
  const errors: EstimateErrors = { ...areaCheck.errors };

  const badPrice = PRICE_FIELDS.find(p => !Number.isFinite(input.prices[p.field]) || input.prices[p.field] < 0);
  if (badPrice) errors.prices = `Enter a price for ${badPrice.label.toLowerCase()} (0 if it should not be counted).`;

  const overrides = Object.entries(input.rateOverrides) as [RateField, number][];
  const badRate = overrides.find(([, v]) => !Number.isFinite(v) || v < 0);
  if (badRate) errors.rates = `Enter a rate for ${RATE_FIELDS.find(r => r.field === badRate[0])?.label.toLowerCase() || 'the material'} (0 if none is used).`;

  if (!Number.isFinite(input.finishingPerSqFt) || input.finishingPerSqFt < 0) {
    errors.finishing = 'Enter the finishing allowance per sq.ft, or leave it empty to leave finishes out.';
  }

  if (!areaCheck.plan || Object.values(errors).some(Boolean)) return { ok: false, errors };
  const areas = areaCheck.plan;

  const calc = calculateBuildingEstimate({
    builtUpSqFt: areas.builtUpSqFt,
    floors: areas.floors,
    buildingType: input.buildingType,
    quality: input.quality,
    structureType: input.structureType,
    concreteGrade: input.concreteGrade,
    steelGrade: input.steelGrade,
    includeRiverSand: input.includeRiverSand,
    rates: input.prices,
    customFactors: input.rateOverrides,
  });

  const published = getQualityFactors(input.quality, input.includeRiverSand);
  const ratesChanged = overrides.filter(([f, v]) => v !== published[f]).map(([f]) => f);
  const fieldOf: Record<string, RateField> = {
    Cement: 'cementBagsPerSqFt', Sand: 'sandCftPerSqFt', 'M-Sand': 'msandCftPerSqFt',
    Aggregate: 'aggregateCftPerSqFt', Bricks: 'bricksPiecesPerSqFt', Steel: 'steelKgPerSqFt',
  };
  const lines: EstimateLine[] = calc.materials.map(m => {
    const field = fieldOf[m.material];
    const guide = RATE_FIELDS.find(r => r.field === field);
    return {
      ...m,
      working: `${fmt(areas.builtUpSqFt)} sq.ft × ${fmt(calc.factorsUsed[field])} ${guide?.unit || m.unit}`,
      rateChanged: ratesChanged.includes(field),
    };
  });

  const finishingCost = Math.round(areas.builtUpSqFt * input.finishingPerSqFt);
  const total = calc.totalEstimatedCost + finishingCost;
  const examplePricesLeft = PRICE_FIELDS.filter(p => {
    if (p.field === 'sandPerCft' && calc.factorsUsed.sandCftPerSqFt === 0) return false;   // not used in this estimate
    return input.prices[p.field] === EXAMPLE_PRICES[p.field];
  }).length;

  const warnings = [...areaCheck.warnings];
  if (input.structureType === 'Load Bearing') {
    warnings.push('These rates are for a pillar & beam house. A pillar-free traditional house usually needs less steel and more bricks: ask your engineer for those two figures.');
    if (input.floors > 2) {
      warnings.push('For more than two floors, a pillar & beam house with professional structural design is the usual choice. Check with an engineer before planning a pillar-free house this tall.');
    }
  } else if (input.structureType !== 'Framed Structure (RCC)') {
    warnings.push(`These rates are for a pillar & beam house and are not reliable for a ${houseTypeLabel(input.structureType).toLowerCase()}. Use your engineer's figures.`);
  }
  if (NON_HOUSE.test(input.buildingType)) {
    warnings.push('The rates are planning figures for houses. For this kind of building treat the result as a rough guide only.');
  }
  for (const [field, value] of overrides) {
    const guide = RATE_FIELDS.find(r => r.field === field);
    const base = published[field];
    if (guide && ratesChanged.includes(field) && base > 0 && (value > base * 2.5 || value < base / 2.5)) {
      warnings.push(`${guide.label}: ${fmt(value)} ${guide.unit} per sq.ft is far from the usual ${guide.range}. Check it.`);
    }
  }
  if (examplePricesLeft > 0) {
    warnings.push(`${examplePricesLeft} of the prices are still the example values. Replace them with your dealer's and contractor's rates.`);
  }

  const assumptions = [
    `Built-up area = building size on one floor (${fmt(areas.footprintSqFt)} sq.ft) × ${areas.floors} floor${areas.floors > 1 ? 's' : ''} = ${fmt(areas.builtUpSqFt)} sq.ft. Every floor is taken to be the same size.`,
    areas.plotSqFt === null
      ? 'The plot size was not given, so it could not be checked against the building.'
      : `The plot is ${fmt(areas.plotSqFt)} sq.ft; the building covers ${areas.coveragePct}% of it. The plot area is not used in the quantities.`,
    `Each quantity = built-up area × a rate per sq.ft. The rates are published planning figures for pillar & beam houses; ${input.quality === 'Custom' ? 'Standard' : input.quality} takes ${LEVEL_WORD[input.quality]} of each published range.`,
    ratesChanged.length
      ? `You changed ${ratesChanged.length === 1 ? 'this rate' : 'these rates'}: ${ratesChanged.map(f => RATE_FIELDS.find(r => r.field === f)?.label).join(', ')}.`
      : 'No rate was changed from the published figure.',
    calc.factorsUsed.sandCftPerSqFt > 0
      ? `Sand: ${Math.round(RIVER_SAND_SHARE * 100)}% is taken as river sand for plastering and the rest as M-sand (crusher sand), unless you changed the two rates. This split is the app's own assumption.`
      : 'All sand is taken as M-sand (crusher sand).',
    `House type: ${houseTypeLabel(input.structureType)}. It does not change the quantities.`,
    'No wastage is added. When ordering, sources suggest about 5–10% extra, more for bricks and tiles.',
    `Labour = built-up area × ₹${fmt(input.prices.labourPerSqFt)} per sq.ft.`,
  ];

  const notIncluded = [
    ...(finishingCost > 0 ? [] : FINISHES_NOT_COUNTED),
    'Compound wall, water tank, sump and septic tank',
    'Earth filling, deep or special foundations',
    'Approvals, design fees, taxes and price changes',
  ];

  return {
    ok: true,
    value: {
      areas,
      lines,
      rates: calc.factorsUsed,
      ratesChanged,
      materialCost: calc.totalMaterialCost,
      labourCost: calc.estimatedLabourCost,
      finishingCost,
      total,
      costPerSqFt: Math.round(total / areas.builtUpSqFt),
      examplePricesLeft,
      assumptions,
      engineerNotes: [
        `Concrete grade ${input.concreteGrade} and steel grade ${input.steelGrade} are assumed. They do not change these quantities; the engineer sets the real grades.`,
        `Construction type: ${input.structureType}.`,
      ],
      notIncluded,
      warnings,
      disclaimer: PRELIMINARY_ESTIMATE_DISCLAIMER,
    },
  };
}

/** Rows for a spreadsheet export of an estimate. */
export function estimateReportRows(
  input: EstimateInput,
  result: EstimateOutcome,
  meta: { name?: string; project?: string; date: string }
): string[][] {
  const a = result.areas;
  const rows: string[][] = [
    ['MISTRY: APPROXIMATE BUILDING ESTIMATE'],
    ['Approximate. Made from rule-of-thumb rates, not from drawings.'],
    ['Date', meta.date],
    ...(meta.name ? [['Estimate', meta.name]] : []),
    ...(meta.project ? [['Project', meta.project]] : []),
    [],
    ['Building type', input.buildingType],
    ['House type', houseTypeLabel(input.structureType)],
    ['Sand', input.includeRiverSand ? 'River sand for plastering only, M-sand for the rest' : 'Full M-sand (crusher sand)'],
    ['Level', input.quality],
    [],
    ['Plot area (sq.ft)', a.plotSqFt === null ? 'not given' : String(a.plotSqFt)],
    ['Building on one floor (sq.ft)', String(a.footprintSqFt)],
    ['Floors', String(a.floors)],
    ['Built-up area (sq.ft)', String(a.builtUpSqFt)],
    ...(a.coveragePct === null ? [] : [['Plot covered (%)', String(a.coveragePct)]]),
    [],
    ['Material', 'Quantity', 'Unit', 'Rate per sq.ft', 'Price (INR)', 'Cost (INR)', 'Rate changed by you'],
    ...result.lines.map(l => [
      l.material, String(l.quantity), l.unit, String(l.factorUsed ?? ''), String(l.rate), String(l.estimatedCost), l.rateChanged ? 'yes' : '',
    ]),
    [],
    ['Materials', '', '', '', '', String(result.materialCost)],
    ['Labour', String(a.builtUpSqFt), 'sq.ft', '', String(input.prices.labourPerSqFt), String(result.labourCost)],
    ...(result.finishingCost > 0
      ? [['Finishes and services (allowance)', String(a.builtUpSqFt), 'sq.ft', '', String(input.finishingPerSqFt), String(result.finishingCost)]]
      : []),
    ['TOTAL (approximate)', '', '', '', '', String(result.total)],
    ['Cost per sq.ft of built-up area', '', '', '', '', String(result.costPerSqFt)],
    [],
    ['ASSUMPTIONS'],
    ...result.assumptions.map(t => [t]),
    [],
    ['NOT INCLUDED'],
    ...result.notIncluded.map(t => [t]),
    [],
    ['FOR YOUR ENGINEER (assumed for the rates, not a design)'],
    ...result.engineerNotes.map(t => [t]),
    ...(result.warnings.length ? [[], ['CHECK'], ...result.warnings.map(t => [t])] : []),
    [],
    ['LIMITS', result.disclaimer],
  ];
  return rows;
}

export const toCsv = (rows: string[][]): string =>
  rows.map(r => r.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
