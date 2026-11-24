/**
 * Building Mistry — Advanced Building Calculator: Conversion Functions
 * Pure, deterministic unit conversions with strict precision.
 */

import type { LengthUnit, AreaUnit, VolumeUnit } from './types';
import {
  CFT_PER_M3,
  M3_PER_CFT,
  CFT_PER_BRASS,
  M3_PER_BRASS,
  SQFT_PER_SQM,
  SQM_PER_SQFT,
  CEMENT_BAG_KG,
} from './units';

// ── Length Conversions ───────────────────────────────────────────

export function toMetres(value: number, unit: LengthUnit): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  switch (unit) {
    case 'm': return value;
    case 'mm': return value / 1000.0;
    case 'cm': return value / 100.0;
    case 'ft': return value * 0.3048;
    case 'in': return value * 0.0254;
    default: return value;
  }
}

export function fromMetres(metres: number, unit: LengthUnit): number {
  if (!Number.isFinite(metres) || metres < 0) return 0;
  switch (unit) {
    case 'm': return metres;
    case 'mm': return metres * 1000.0;
    case 'cm': return metres * 100.0;
    case 'ft': return metres / 0.3048;
    case 'in': return metres / 0.0254;
    default: return metres;
  }
}

// ── Area Conversions ─────────────────────────────────────────────

export function toSqMetres(value: number, unit: AreaUnit): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  switch (unit) {
    case 'sq.m': return value;
    case 'sq.ft': return value * SQM_PER_SQFT;
    case 'brass': return (value * 100.0) * SQM_PER_SQFT; // 100 sq ft
    default: return value;
  }
}

export function sqMToSqFt(sqm: number): number {
  if (!Number.isFinite(sqm) || sqm < 0) return 0;
  return sqm * SQFT_PER_SQM;
}

export function sqFtToSqM(sqft: number): number {
  if (!Number.isFinite(sqft) || sqft < 0) return 0;
  return sqft * SQM_PER_SQFT;
}

export function fromSqMetres(sqm: number, unit: AreaUnit): number {
  if (!Number.isFinite(sqm) || sqm < 0) return 0;
  switch (unit) {
    case 'sq.m': return sqm;
    case 'sq.ft': return sqm * SQFT_PER_SQM;
    case 'brass': return (sqm * SQFT_PER_SQM) / 100.0;
    default: return sqm;
  }
}

// ── Volume Conversions ───────────────────────────────────────────

export function m3ToCft(m3: number): number {
  if (!Number.isFinite(m3) || m3 < 0) return 0;
  return m3 * CFT_PER_M3;
}

export function cftToM3(cft: number): number {
  if (!Number.isFinite(cft) || cft < 0) return 0;
  return cft * M3_PER_CFT;
}

export function cftToBrass(cft: number): number {
  if (!Number.isFinite(cft) || cft < 0) return 0;
  return cft / CFT_PER_BRASS;
}

export function brassToCft(brass: number): number {
  if (!Number.isFinite(brass) || brass < 0) return 0;
  return brass * CFT_PER_BRASS;
}

export function m3ToBrass(m3: number): number {
  if (!Number.isFinite(m3) || m3 < 0) return 0;
  return m3 / M3_PER_BRASS;
}

export function toCubicMetres(value: number, unit: VolumeUnit): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  switch (unit) {
    case 'm3': return value;
    case 'cft': return cftToM3(value);
    case 'brass': return value * M3_PER_BRASS;
    default: return value;
  }
}

export function fromCubicMetres(m3: number, unit: VolumeUnit): number {
  if (!Number.isFinite(m3) || m3 < 0) return 0;
  switch (unit) {
    case 'm3': return m3;
    case 'cft': return m3ToCft(m3);
    case 'brass': return m3ToBrass(m3);
    default: return m3;
  }
}

// ── Cement Mass & Bags ───────────────────────────────────────────

export function cementKgToBags(kg: number, bagWeightKg: number = CEMENT_BAG_KG): number {
  if (!Number.isFinite(kg) || kg <= 0) return 0;
  const bagSize = bagWeightKg > 0 ? bagWeightKg : CEMENT_BAG_KG;
  return kg / bagSize;
}

export function cementBagsToKg(bags: number, bagWeightKg: number = CEMENT_BAG_KG): number {
  if (!Number.isFinite(bags) || bags <= 0) return 0;
  const bagSize = bagWeightKg > 0 ? bagWeightKg : CEMENT_BAG_KG;
  return bags * bagSize;
}

// ── Rounding & Formatting Helpers ────────────────────────────────

export function round(value: number, decimals: number = 2): number {
  if (!Number.isFinite(value)) return 0;
  const factor = Math.pow(10, decimals);
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

/** Round up to the next integer for purchase quantities (e.g. brick pieces, whole bags, tile boxes) */
export function ceilPurchase(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.ceil(value);
}
