/**
 * Building Mistry — Advanced Building Calculator: Units & Physical Constants
 * Standard SI & Indian Civil Engineering Quantity Surveying Standards.
 */

import type { LengthUnit, AreaUnit, VolumeUnit } from './types';

// ── Physical Conversion Multipliers ──────────────────────────────

/** 1 cubic metre in cubic feet (Exact IEEE floating precision standard) */
export const CFT_PER_M3 = 35.3146667215;

/** 1 cubic foot in cubic metres */
export const M3_PER_CFT = 0.028316846592;

/** 1 brass is a regional civil trade unit equal to exactly 100 CFT */
export const CFT_PER_BRASS = 100.0;

/** 1 brass in cubic metres (100 * 0.0283168...) */
export const M3_PER_BRASS = 2.8316846592;

/** 1 square metre in square feet */
export const SQFT_PER_SQM = 10.7639104167;

/** 1 square foot in square metres */
export const SQM_PER_SQFT = 0.09290304;

/** Standard cement bag mass in kilograms (Indian standard IS 269 / IS 8112) */
export const CEMENT_BAG_KG = 50.0;

/** Standard loose bulk density of Ordinary Portland Cement (OPC/PPC) */
export const CEMENT_DENSITY_KG_PER_M3 = 1440.0;

/** Volume of one 50kg bag of cement in m3 (50 / 1440) */
export const CEMENT_BAG_VOLUME_M3 = CEMENT_BAG_KG / CEMENT_DENSITY_KG_PER_M3; // ~0.03472 m3

/** Volume of one 50kg bag of cement in CFT */
export const CEMENT_BAG_VOLUME_CFT = CEMENT_BAG_VOLUME_M3 * CFT_PER_M3; // ~1.226 CFT

/**
 * Standard Dry Mortar Volume Factor: 1.33.
 * Voids between dry sand grains absorb cement particles; ~33% extra dry material
 * is required to produce 1.0 m3 of finished wet compacted mortar.
 */
export const DEFAULT_DRY_MORTAR_FACTOR = 1.33;
export const DRY_MORTAR_FACTOR = DEFAULT_DRY_MORTAR_FACTOR;

/**
 * Standard Dry Concrete Volume Factor: 1.54.
 * Entrained voids between dry coarse & fine aggregates require ~54% extra dry volume
 * to produce 1.0 m3 of compacted fresh wet concrete (IS 456 practice).
 */
export const DEFAULT_DRY_CONCRETE_FACTOR = 1.54;
export const DRY_CONCRETE_FACTOR = DEFAULT_DRY_CONCRETE_FACTOR;

/**
 * Nominal Brick Dimensions (Standard Indian Red Clay / Modular):
 * - Standard Modular Brick: 190 mm × 90 mm × 90 mm (without mortar)
 * - Standard Nominal Size: 200 mm × 100 mm × 100 mm (with 10 mm mortar joint)
 */
export const STANDARD_MODULAR_BRICK = {
  lengthMm: 190,
  widthMm: 90,
  heightMm: 90,
  mortarJointMm: 10,
};

/**
 * Traditional Indian Country Clay Brick:
 * - 9" × 4.25" × 2.75" (approx 228.6 mm × 108 mm × 70 mm)
 * - With mortar: 230 mm × 115 mm × 75 mm
 */
export const TRADITIONAL_COUNTRY_BRICK = {
  lengthMm: 228.6,
  widthMm: 108.0,
  heightMm: 70.0,
  mortarJointMm: 10,
};

/**
 * Standard Fly Ash Brick:
 * - 230 mm × 110 mm × 75 mm (with 10 mm mortar joint)
 */
export const FLY_ASH_BRICK = {
  lengthMm: 230,
  widthMm: 110,
  heightMm: 75,
  mortarJointMm: 10,
};

/**
 * Standard Concrete Block / AAC Block:
 * - 400 mm × 200 mm × 150 mm (6" block)
 * - Mortar / Thinbed adhesive joint: 3 mm for AAC, 10 mm for cement mortar
 */
export const STANDARD_AAC_BLOCK_6INCH = {
  lengthMm: 400,
  widthMm: 150,
  heightMm: 200,
  mortarJointMm: 3,
};
