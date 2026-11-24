/**
 * Building Mistry — Advanced Building Calculator Domain Types
 * Strict, pure TypeScript definitions for civil engineering and quantity estimation.
 */

export type CalculatorModule =
  | 'wall'
  | 'slab'
  | 'beam'
  | 'column'
  | 'plaster'
  | 'flooring'
  | 'sand'
  | 'rates'
  | 'boq'
  | 'saved';

export type LengthUnit = 'm' | 'mm' | 'cm' | 'ft' | 'in';
export type AreaUnit = 'sq.m' | 'sq.ft' | 'brass';
export type VolumeUnit = 'm3' | 'cft' | 'brass';
export type MassUnit = 'kg' | 'tonne' | 'bag_50kg';

// ── Sand Classification & Material Specs ─────────────────────────

export type SandCategory =
  | 'm_sand_concrete'  // Concrete-grade M-Sand (Zone II, approved mix design)
  | 'p_sand_plaster'   // Plastering P-Sand (Zone IV, fine, silt-free)
  | 'masonry_sand'     // Masonry Sand (Zone III, brick/block mortar)
  | 'river_sand'       // River Sand (where legally permitted)
  | 'custom_sand';     // Custom user-defined sand

export type SandTradeDescriptor = 'soft' | 'hard' | 'fine' | 'coarse' | 'custom';

export interface SandSpecification {
  category: SandCategory;
  tradeDescriptor: SandTradeDescriptor;
  customDescriptor?: string;
  supplier?: string;
  sourceLocation?: string;
  zoneGrading?: 'Zone I' | 'Zone II' | 'Zone III' | 'Zone IV' | 'Unspecified';
  siltContentPercent?: number;       // e.g. <= 3% for concrete, <= 7% for plaster
  moisturePercent?: number;          // Moisture for bulking adjustment
  densityKgPerM3?: number;           // Standard ~1450 to 1750 kg/m3
  labReportVerified: boolean;
  labReportRef?: string;
  notes?: string;
}

// ── Concrete Mix Design Specification ────────────────────────────

export type ConcreteDesignMode = 'approved_mix_design' | 'nominal_estimate';

export interface ApprovedMixDesign {
  cementKgPerM3: number;             // e.g. 380 kg/m3 for M25
  fineAggregateKgPerM3: number;      // e.g. 680 kg/m3
  coarseAggregateKgPerM3: number;    // e.g. 1150 kg/m3
  waterLitresPerM3?: number;         // e.g. 175 L/m3 (W/C ~ 0.45)
  admixtureKgPerM3?: number;         // e.g. 3.5 kg/m3
  designDocRef?: string;
  targetStrengthMpa?: number;        // e.g. 25 MPa at 28 days
}

export interface NominalMixProportions {
  cementParts: number;               // 1
  fineAggregateParts: number;        // 1.5 for M20, 1 for M25
  coarseAggregateParts: number;      // 3 for M20, 2 for M25
  waterCementRatio?: number;         // nominal e.g. 0.50
}

export type StructuralIntersectionConvention =
  | 'clear_span_exclusive'           // Beam measured clear of column faces (recommended, zero overlap)
  | 'center_to_center_inclusive'     // Beam measured between column centerlines
  | 'full_span_continuous';          // Continuous beam measured full length

export type SlabBeamIntersectionConvention =
  | 'beam_below_slab'                // Beam height excludes slab depth (recommended for zero slab overlap)
  | 'beam_monolithic_full_depth';    // Beam height includes slab depth (slab concrete must deduce beam rib)

// ── Unit Dimensions & Openings ───────────────────────────────────

export interface Dimension3D {
  length: number;
  width: number;
  height: number;
  unit: LengthUnit;
}

export interface OpeningDeduction {
  id: string;
  label: string;
  type: 'door' | 'window' | 'cutout' | 'custom';
  width: number;
  height: number;
  unit: LengthUnit;
  count: number;
  depth?: number;                     // Optional wall/slab depth
  is1200DeductionRule?: 'none' | 'half' | 'full'; // Plastering IS 1200 rule
}

// ── Material Rates & Cost Breakdown ──────────────────────────────

export interface MaterialRateItem {
  id: string;
  name: string;
  category: 'cement' | 'sand' | 'aggregate' | 'brick' | 'block' | 'tile' | 'adhesive' | 'grout' | 'labour' | 'custom';
  unit: string;                       // e.g. 'bag', 'cft', 'm3', 'brass', 'piece', 'sq.ft', 'kg'
  ratePerUnit: number;               // in INR
  transportPerUnit: number;          // in INR
  taxPercent: number;                // e.g. 18% or 5%
  supplier?: string;
  effectiveDate: string;             // ISO date e.g. '2026-11-05'
  qualityInfo?: string;
  notes?: string;
}

export interface ItemCostBreakdown {
  materialName: string;
  quantity: number;
  unit: string;
  unitRate: number;
  baseCost: number;
  transportCost: number;
  taxCost: number;
  totalCost: number;
}

export interface CalculationCostSummary {
  materialItems: ItemCostBreakdown[];
  totalMaterialBaseCost: number;
  totalTransportCost: number;
  totalTaxCost: number;
  labourCost: number;
  overallTotalCost: number;
}

// ── Module Calculation Results ───────────────────────────────────

export interface BaseCalculationResult {
  module: CalculatorModule;
  calculationName: string;
  timestamp: string;
  grossVolumeM3: number;
  grossVolumeCFT: number;
  deductionVolumeM3: number;
  deductionVolumeCFT: number;
  netVolumeM3: number;
  netVolumeCFT: number;
  netVolumeBrass: number;
  wastagePercent: number;
  totalVolumeWithWastageM3: number;
  totalVolumeWithWastageCFT: number;
  costs: CalculationCostSummary;
  assumptions: string[];
  warnings: string[];
  engineerApprovalRequired: boolean;
}

// Wall / Masonry
export interface WallCalculationResult extends BaseCalculationResult {
  module: 'wall';
  grossWallAreaSqM: number;
  grossWallAreaSqFt: number;
  netWallAreaSqM: number;
  netWallAreaSqFt: number;
  brickCountEstimated: number;
  brickCountWithWastage: number;
  wetMortarVolumeM3: number;
  dryMortarVolumeM3: number;
  dryMortarVolumeCFT: number;
  cementBags50kg: number;
  cementKg: number;
  sandVolumeCFT: number;
  sandVolumeM3: number;
  sandVolumeBrass: number;
}

// Roof / RCC Slab
export interface SlabCalculationResult extends BaseCalculationResult {
  module: 'slab';
  slabAreaSqM: number;
  slabAreaSqFt: number;
  concreteDesignMode: ConcreteDesignMode;
  cementBags50kg: number;
  cementKg: number;
  fineAggregateCFT: number;
  fineAggregateKg: number;
  coarseAggregateCFT: number;
  coarseAggregateKg: number;
  waterLitres?: number;
  admixtureKg?: number;
}

// Beam
export interface BeamCalculationResult extends BaseCalculationResult {
  module: 'beam';
  totalBeamCount: number;
  totalLinearLengthM: number;
  concreteDesignMode: ConcreteDesignMode;
  cementBags50kg: number;
  cementKg: number;
  fineAggregateCFT: number;
  fineAggregateKg: number;
  coarseAggregateCFT: number;
  coarseAggregateKg: number;
  waterLitres?: number;
  intersectionConvention: StructuralIntersectionConvention;
}

// Column
export interface ColumnCalculationResult extends BaseCalculationResult {
  module: 'column';
  totalColumnCount: number;
  totalHeightM: number;
  concreteDesignMode: ConcreteDesignMode;
  cementBags50kg: number;
  cementKg: number;
  fineAggregateCFT: number;
  fineAggregateKg: number;
  coarseAggregateCFT: number;
  coarseAggregateKg: number;
  waterLitres?: number;
  intersectionConvention: StructuralIntersectionConvention;
}

// Plastering
export interface PlasterCalculationResult extends BaseCalculationResult {
  module: 'plaster';
  grossPlasterAreaSqM: number;
  grossPlasterAreaSqFt: number;
  netPlasterAreaSqM: number;
  netPlasterAreaSqFt: number;
  wetMortarVolumeM3: number;
  dryMortarVolumeM3: number;
  dryMortarVolumeCFT: number;
  cementBags50kg: number;
  cementKg: number;
  sandVolumeCFT: number;
  sandVolumeM3: number;
  sandVolumeBrass: number;
}

// Flooring
export interface FlooringCalculationResult extends BaseCalculationResult {
  module: 'flooring';
  floorAreaSqM: number;
  floorAreaSqFt: number;
  tileCountExact: number;
  tileCountWithWastage: number;
  tileBoxesNeeded?: number;
  screedVolumeM3: number;
  screedVolumeCFT: number;
  cementBagsForScreed: number;
  sandCFTForScreed: number;
  adhesiveKg: number;
  adhesiveBags20kg: number;
  groutKg: number;
}

// Sand module
export interface SandCalculationResult extends BaseCalculationResult {
  module: 'sand';
  bulkVolumeCFT: number;
  bulkVolumeM3: number;
  bulkVolumeBrass: number;
  tipperLoads200Cft: number;
  lorryLoads400Cft: number;
  heavyTruckLoads600Cft: number;
  estimatedWeightTonnes: number;
  moistureAdjustmentAppliedPercent: number;
}

// Saved advanced calculation item
export interface SavedBuildingCalculation {
  id: string;
  userId: string;
  siteId?: string;
  siteName?: string;
  name: string;
  module: CalculatorModule;
  date: string;
  inputs: unknown;
  result: BaseCalculationResult;
  ratesUsedSnapshot: MaterialRateItem[];
  notes?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

// Consolidated BOQ Project Estimate
export interface ProjectBOQEstimate {
  id: string;
  userId: string;
  siteId?: string;
  siteName?: string;
  projectName: string;
  createdDate: string;
  updatedDate: string;
  calculationIds: string[];
  consolidatedMaterials: {
    materialName: string;
    totalQuantity: number;
    unit: string;
    totalBaseCost: number;
    totalTransportCost: number;
    totalTaxCost: number;
    totalCost: number;
  }[];
  totalEstimateCost: number;
  totalLabourCost: number;
  grandTotal: number;
  actualConsumptionComparison?: {
    materialName: string;
    estimatedQty: number;
    actualUsedQty: number;
    varianceQty: number;
    variancePercent: number;
    status: 'under' | 'on_track' | 'exceeded';
  }[];
  notes?: string;
}

