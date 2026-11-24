import type { FloorPlanUnit, FloorPlanWall, FloorPlanRoom } from '../../db/types';
import { roomArea, roomPerimeter, baseUnitOf } from '../../domain/planGeometry';

export function uid(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

export function roundToStep(val: number, step: number): number {
  return step > 0 ? Math.round(val / step) * step : val;
}

/** Removes floating-point fuzz (11.999999999998 -> 12) without rounding any real measurement. */
export const tidy = (v: number): number => Math.round(v * 1e9) / 1e9;

export function readSetting(key: string, fallback: string): string {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

export function writeSetting(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode: the setting lasts for this visit only */
  }
}

export function formatDim(val: number, unit: FloorPlanUnit): string {
  if (unit === 'feet') {
    const totalInches = Math.round(val * 12);
    const feet = Math.floor(totalInches / 12);
    const inches = totalInches % 12;
    if (inches === 0) return `${feet} ft`;
    return `${feet} ft ${inches} in`;
  } else if (unit === 'inches') {
    return `${Math.round(val * 12)} in`;
  } else if (unit === 'centimeters') {
    return `${Math.round(val * 100)} cm`;
  }
  return `${val.toFixed(2)} m`;
}

export function wallLength(w: FloorPlanWall): number {
  return Math.sqrt((w.x2 - w.x1) ** 2 + (w.y2 - w.y1) ** 2);
}

// Coordinates are in feet (feet/inches plans) or metres (metre/centimetre plans), so the
// outline area is already in sq.ft or sq.m. It is the area of the outline as drawn.
export function computeRoomArea(r: FloorPlanRoom, unit: FloorPlanUnit): string {
  const area = roomArea(r);
  return baseUnitOf(unit) === 'feet' ? `${area.toFixed(1)} sq.ft` : `${area.toFixed(2)} sq.m`;
}

export function computeRoomPerimeter(r: FloorPlanRoom, unit: FloorPlanUnit): string {
  const perimeter = roomPerimeter(r);
  if (unit === 'feet') return `${perimeter.toFixed(1)} ft`;
  if (unit === 'inches') return `${(perimeter * 12).toFixed(1)} in`;
  if (unit === 'centimeters') return `${(perimeter * 100).toFixed(0)} cm`;
  return `${perimeter.toFixed(2)} m`;
}
