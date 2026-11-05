/**
 * Measurements on a floor plan: reading what the user types, showing lengths, exact wall
 * length edits, dimension lines and clear room sizes.
 *
 * UNITS
 *   Every length is stored in the plan's base unit (feet or metres, see planGeometry.ts) at
 *   full precision. Typed values are converted exactly (1 ft = 0.3048 m, 1 ft = 12 in) and
 *   rounding happens only when a length is shown, never when it is stored.
 *
 * WHAT IS MEASURED
 *   - Wall length: along the wall's centre-line, from joint to joint. Shown outside the wall.
 *   - Wall thickness: across the wall. It never changes a wall's length.
 *   - Clear room size: between the inner wall faces, i.e. the centre-line outline moved in by
 *     half the thickness of the wall on each side.
 *
 * These are planning figures. They are not a certified drawing.
 */
import type { FloorPlanRoom, FloorPlanUnit, FloorPlanWall } from '../db/types';
import {
  METERS_PER_FOOT, baseUnitOf, pointInPolygon, polygonArea, reattachTees, signedPolygonArea, wallLengthOf, type Pt,
} from './planGeometry';

// ---------------------------------------------------------------------------
// Plan <-> screen
// ---------------------------------------------------------------------------

/** Screen pixels per plan unit at 100% zoom. Only the view uses this; stored geometry never does. */
export const PX_PER_UNIT = 20;

export interface PlanView { zoom: number; panX: number; panY: number }

export const planToScreen = (p: Pt, view: PlanView): Pt => ({
  x: p.x * PX_PER_UNIT * view.zoom + view.panX,
  y: p.y * PX_PER_UNIT * view.zoom + view.panY,
});

export const screenToPlan = (p: Pt, view: PlanView): Pt => ({
  x: (p.x - view.panX) / (PX_PER_UNIT * view.zoom),
  y: (p.y - view.panY) / (PX_PER_UNIT * view.zoom),
});

/** A distance on screen (a finger-sized tolerance, say) as a distance on the plan at this zoom. */
export const pixelsToPlan = (pixels: number, zoom: number) => pixels / (PX_PER_UNIT * zoom);

// ---------------------------------------------------------------------------
// Limits and defaults, per unit system
// ---------------------------------------------------------------------------

const feetBased = (unit: FloorPlanUnit) => baseUnitOf(unit) === 'feet';

/** Shortest and longest wall that can be typed in, in plan units (3 in .. 1000 ft / 5 cm .. 300 m). */
export const lengthLimits = (unit: FloorPlanUnit) => (feetBased(unit) ? { min: 0.25, max: 1000 } : { min: 0.05, max: 300 });

/** Thinnest and thickest wall, in plan units (2 in .. 3 ft / 50 mm .. 900 mm). */
export const thicknessLimits = (unit: FloorPlanUnit) => (feetBased(unit) ? { min: 2 / 12, max: 3 } : { min: 0.05, max: 0.9 });

/** A 9 inch (230 mm) brick wall. */
export const defaultWallThickness = (unit: FloorPlanUnit) => (feetBased(unit) ? 0.75 : 0.23);

export const wallThicknessPresets = (unit: FloorPlanUnit): { label: string; value: number }[] =>
  feetBased(unit)
    ? [{ label: '9"', value: 0.75 }, { label: '4.5"', value: 0.375 }, { label: '3"', value: 0.25 }]
    : [{ label: '230 mm', value: 0.23 }, { label: '115 mm', value: 0.115 }, { label: '75 mm', value: 0.075 }];

export const gridStepOptions = (unit: FloorPlanUnit): { label: string; value: number }[] =>
  feetBased(unit)
    ? [{ label: '1 in', value: 1 / 12 }, { label: '3 in', value: 0.25 }, { label: '6 in', value: 0.5 }, { label: '1 ft', value: 1 }]
    : [{ label: '1 cm', value: 0.01 }, { label: '5 cm', value: 0.05 }, { label: '10 cm', value: 0.1 }, { label: '50 cm', value: 0.5 }];

/** Step that wall ends snap to: 6 inches, or 10 cm. */
export const defaultGridStep = (unit: FloorPlanUnit) => (feetBased(unit) ? 0.5 : 0.1);

// ---------------------------------------------------------------------------
// Reading typed measurements
// ---------------------------------------------------------------------------

export type MeasureParse = { ok: true; value: number } | { ok: false; error: string };

const NUM = String.raw`(\d+(?:\.\d+)?|\.\d+)`;
const FRACTION = String.raw`(?:\s+(\d+)\s*\/\s*(\d+))?`;
const INCH_MARK = String.raw`(?:"|in\.?|inch|inches)`;
const FOOT_MARK = String.raw`(?:'|ft\.?|feet|foot)`;

const RE_METRIC = new RegExp(`^${NUM}\\s*(mm|cm|m|meter|meters|metre|metres)$`);
const RE_FEET = new RegExp(`^${NUM}\\s*${FOOT_MARK}\\s*-?\\s*`);
const RE_INCHES_AFTER_FEET = new RegExp(`^${NUM}${FRACTION}\\s*${INCH_MARK}?$`);
const RE_INCHES = new RegExp(`^${NUM}${FRACTION}\\s*${INCH_MARK}$`);
const RE_FRACTION_INCHES = new RegExp(`^(\\d+)\\s*\\/\\s*(\\d+)\\s*${INCH_MARK}$`);
const RE_TWO_NUMBERS = new RegExp(`^${NUM}(?:\\s*-\\s*|\\s+)${NUM}$`);
const RE_BARE = new RegExp(`^${NUM}$`);

const normalise = (text: string) =>
  text.trim().toLowerCase()
    .replace(/[′’‘`´]/g, "'")
    .replace(/[″”“]/g, '"')
    .replace(/''/g, '"')
    .replace(/\s+/g, ' ');

const fraction = (num?: string, den?: string) => (num && den && Number(den) !== 0 ? Number(num) / Number(den) : 0);

/** The typed text as metres, or null when it can not be read. `bare` says what a plain number means. */
function readMeters(s: string, bare: 'ft' | 'in' | 'm' | 'cm' | 'mm', twoNumbersAreFeetInches: boolean): number | null {
  let m = s.match(RE_METRIC);
  if (m) {
    const v = Number(m[1]);
    return m[2] === 'mm' ? v / 1000 : m[2] === 'cm' ? v / 100 : v;
  }
  m = s.match(RE_FEET);
  if (m) {
    const rest = s.slice(m[0].length);
    let inches = 0;
    if (rest) {
      const i = rest.match(RE_INCHES_AFTER_FEET);
      if (!i) return null;
      inches = Number(i[1]) + fraction(i[2], i[3]);
    }
    return (Number(m[1]) + inches / 12) * METERS_PER_FOOT;
  }
  m = s.match(RE_INCHES);
  if (m) return ((Number(m[1]) + fraction(m[2], m[3])) / 12) * METERS_PER_FOOT;
  m = s.match(RE_FRACTION_INCHES);
  if (m) return (fraction(m[1], m[2]) / 12) * METERS_PER_FOOT;
  m = s.match(RE_TWO_NUMBERS);
  if (m) return twoNumbersAreFeetInches ? (Number(m[1]) + Number(m[2]) / 12) * METERS_PER_FOOT : null;
  m = s.match(RE_BARE);
  if (m) {
    const v = Number(m[1]);
    switch (bare) {
      case 'ft': return v * METERS_PER_FOOT;
      case 'in': return (v / 12) * METERS_PER_FOOT;
      case 'cm': return v / 100;
      case 'mm': return v / 1000;
      default: return v;
    }
  }
  return null;
}

const toPlan = (meters: number, unit: FloorPlanUnit) => (feetBased(unit) ? meters / METERS_PER_FOOT : meters);

/**
 * Reads a typed length and returns it in plan units.
 *
 * Accepted: 12' 6"  12'-6"  12ft 6in  12 6  12-6  6"  150in  12.5  3.5m  350cm  3500mm
 * A plain number is in the plan's own display unit (feet, inches, metres or centimetres).
 * Zero, negative, non-numeric and out-of-range values are refused with a plain message.
 */
export function parseLengthInput(text: string, unit: FloorPlanUnit, limits = lengthLimits(unit)): MeasureParse {
  const s = normalise(String(text ?? ''));
  if (!s) return { ok: false, error: 'Enter a length.' };
  if (s.startsWith('-')) return { ok: false, error: 'A length must be more than zero.' };
  const bare = unit === 'feet' ? 'ft' : unit === 'inches' ? 'in' : unit === 'centimeters' ? 'cm' : 'm';
  const meters = readMeters(s, bare, feetBased(unit));
  if (meters === null || !Number.isFinite(meters)) {
    return { ok: false, error: feetBased(unit) ? `Could not read "${text.trim()}". Try 12' 6" or 12.5.` : `Could not read "${text.trim()}". Try 3.5 or 350 cm.` };
  }
  if (!(meters > 0)) return { ok: false, error: 'A length must be more than zero.' };
  // Whole plan units when the text was typed in them, so 12.5 is stored as exactly 12.5.
  const typedInBase = RE_BARE.test(s) && ((unit === 'feet') || (unit === 'meters'));
  const value = typedInBase ? Number(s) : toPlan(meters, unit);
  if (value < limits.min - 1e-9) return { ok: false, error: `That is too short. The smallest is ${formatDimension(limits.min, unit)}.` };
  if (value > limits.max + 1e-9) return { ok: false, error: `That is too long. The largest is ${formatDimension(limits.max, unit)}.` };
  return { ok: true, value };
}

/**
 * Reads a typed wall thickness and returns it in plan units. A plain number is inches on a
 * feet plan and millimetres on a metric plan, the way wall thickness is normally quoted.
 */
export function parseThicknessInput(text: string, unit: FloorPlanUnit): MeasureParse {
  const s = normalise(String(text ?? ''));
  if (!s) return { ok: false, error: 'Enter a thickness.' };
  if (s.startsWith('-')) return { ok: false, error: 'A thickness must be more than zero.' };
  const meters = readMeters(s, feetBased(unit) ? 'in' : 'mm', false);
  if (meters === null || !Number.isFinite(meters)) {
    return { ok: false, error: feetBased(unit) ? `Could not read "${text.trim()}". Try 9 or 4.5 (inches).` : `Could not read "${text.trim()}". Try 230 (mm).` };
  }
  if (!(meters > 0)) return { ok: false, error: 'A thickness must be more than zero.' };
  const value = toPlan(meters, unit);
  const limits = thicknessLimits(unit);
  if (value < limits.min - 1e-9 || value > limits.max + 1e-9) {
    return { ok: false, error: `Wall thickness must be between ${formatThickness(limits.min, unit)} and ${formatThickness(limits.max, unit)}.` };
  }
  return { ok: true, value };
}

// ---------------------------------------------------------------------------
// Showing measurements (rounding happens here and nowhere else)
// ---------------------------------------------------------------------------

const trim = (n: number, digits: number) => String(Number(n.toFixed(digits)));
const QUARTERS = ['', '¼', '½', '¾'];

/** A length for a dimension label. Feet show feet and inches to the nearest quarter inch. */
export function formatDimension(value: number, unit: FloorPlanUnit): string {
  switch (unit) {
    case 'feet': {
      const quarters = Math.round(Math.abs(value) * 48);
      const inches = Math.floor((quarters % 48) / 4);
      return `${value < 0 ? '-' : ''}${Math.floor(quarters / 48)}'-${inches}${QUARTERS[quarters % 4]}"`;
    }
    case 'inches': return `${trim(value * 12, 1)}"`;
    case 'centimeters': return `${trim(value * 100, 1)} cm`;
    default: return `${value.toFixed(2)} m`;
  }
}

/**
 * The same length in the other units people use on site, for the live label while drawing:
 * a feet plan shows metres and millimetres, a metre plan shows millimetres and feet-inches.
 */
export function formatOtherUnits(value: number, unit: FloorPlanUnit): string {
  const metres = feetBased(unit) ? value * 0.3048 : value;
  const mm = Math.round(metres * 1000).toLocaleString('en-IN');
  return feetBased(unit) ? `${metres.toFixed(2)} m · ${mm} mm` : `${mm} mm · ${formatDimension(metres / 0.3048, 'feet')}`;
}

/** A length as editable text that `parseLengthInput` reads back to the same value. */
export function formatLengthForInput(value: number, unit: FloorPlanUnit): string {
  switch (unit) {
    case 'feet': {
      const totalInches = Number((Math.abs(value) * 12).toFixed(3));
      const feet = Math.floor(totalInches / 12 + 1e-9);
      return `${feet}' ${trim(totalInches - feet * 12, 3)}"`;
    }
    case 'inches': return `${trim(value * 12, 3)}"`;
    case 'centimeters': return `${trim(value * 100, 2)} cm`;
    default: return `${trim(value, 4)} m`;
  }
}

/** Wall thickness the way it is quoted on site: inches on a feet plan, millimetres on a metric one. */
export function formatThickness(value: number, unit: FloorPlanUnit): string {
  return feetBased(unit) ? `${trim(value * 12, 2)}"` : `${Math.round(value * 1000)} mm`;
}

/** Area with its unit, for labels: "120.0 sq.ft" or "11.15 m²". */
export function formatAreaShort(area: number, unit: FloorPlanUnit): string {
  return feetBased(unit) ? `${area.toFixed(1)} sq.ft` : `${area.toFixed(2)} m²`;
}

// ---------------------------------------------------------------------------
// Exact wall length
// ---------------------------------------------------------------------------

/**
 * Which end of a wall should stay put when its length is typed in: the end that other walls
 * are joined to. When both or neither are joined, the start stays.
 */
export function endToKeep(walls: FloorPlanWall[], wallId: string, tolerance: number): 'start' | 'end' {
  const target = walls.find(w => w.id === wallId);
  if (!target) return 'start';
  const joinedAt = (x: number, y: number) =>
    walls.some(w => w.id !== wallId && (Math.hypot(w.x1 - x, w.y1 - y) <= tolerance || Math.hypot(w.x2 - x, w.y2 - y) <= tolerance));
  return !joinedAt(target.x1, target.y1) && joinedAt(target.x2, target.y2) ? 'end' : 'start';
}

/**
 * Sets a wall to an exact length. The wall keeps its direction and the `keep` end stays where
 * it is; the other end moves along the wall's own line.
 *
 * Walls joined to the moving end stay joined: a wall that continues in the same line is
 * stretched or shortened, and a wall that turns off (a corner) is carried along whole, so a
 * rectangular room stays rectangular. Walls joined to the far end of a carried wall stretch to
 * follow it. Returns the same array when nothing needs to change.
 */
export function resizeWall(walls: FloorPlanWall[], wallId: string, newLength: number, keep: 'start' | 'end', tolerance: number): FloorPlanWall[] {
  const target = walls.find(w => w.id === wallId);
  if (!target || !Number.isFinite(newLength) || !(newLength > 0)) return walls;
  const length = wallLengthOf(target);
  if (!(length > 0)) return walls;
  const ux = (target.x2 - target.x1) / length, uy = (target.y2 - target.y1) / length;
  const moving: Pt = keep === 'start' ? { x: target.x2, y: target.y2 } : { x: target.x1, y: target.y1 };
  const dest: Pt = keep === 'start'
    ? { x: target.x1 + ux * newLength, y: target.y1 + uy * newLength }
    : { x: target.x2 - ux * newLength, y: target.y2 - uy * newLength };
  const dx = dest.x - moving.x, dy = dest.y - moving.y;
  if (Math.hypot(dx, dy) < 1e-12) return walls;

  const at = (p: Pt, x: number, y: number) => Math.hypot(p.x - x, p.y - y) <= tolerance;
  const carried = new Set<string>();
  const farJoints: Pt[] = [];
  for (const w of walls) {
    if (w.id === wallId) continue;
    const at1 = at(moving, w.x1, w.y1), at2 = at(moving, w.x2, w.y2);
    if (at1 === at2) continue;
    const len = wallLengthOf(w);
    if (!(len > 0)) continue;
    // Sine of the angle between the two walls: close to 0 means it continues in the same line.
    if (Math.abs(((w.x2 - w.x1) * uy - (w.y2 - w.y1) * ux) / len) < 0.05) continue;
    carried.add(w.id);
    farJoints.push(at1 ? { x: w.x2, y: w.y2 } : { x: w.x1, y: w.y1 });
  }

  const next = walls.map(w => {
    if (w.id === wallId) return keep === 'start' ? { ...w, x2: dest.x, y2: dest.y } : { ...w, x1: dest.x, y1: dest.y };
    if (carried.has(w.id)) return { ...w, x1: w.x1 + dx, y1: w.y1 + dy, x2: w.x2 + dx, y2: w.y2 + dy };
    const m1 = at(moving, w.x1, w.y1) || farJoints.some(j => at(j, w.x1, w.y1));
    const m2 = at(moving, w.x2, w.y2) || farJoints.some(j => at(j, w.x2, w.y2));
    if (!m1 && !m2) return w;
    return { ...w, x1: m1 ? w.x1 + dx : w.x1, y1: m1 ? w.y1 + dy : w.y1, x2: m2 ? w.x2 + dx : w.x2, y2: m2 ? w.y2 + dy : w.y2 };
  });
  return reattachTees(walls, next, tolerance);
}

// ---------------------------------------------------------------------------
// Dimension lines
// ---------------------------------------------------------------------------

type Outline = Pick<FloorPlanRoom, 'x' | 'y' | 'width' | 'height' | 'polygonPoints'>;

export const roomOutline = (room: Outline): Pt[] =>
  room.polygonPoints && room.polygonPoints.length >= 3
    ? room.polygonPoints
    : [{ x: room.x, y: room.y }, { x: room.x + room.width, y: room.y }, { x: room.x + room.width, y: room.y + room.height }, { x: room.x, y: room.y + room.height }];

/**
 * Unit vector pointing to the side of a wall its dimension line belongs on: away from the room
 * the wall encloses. A wall with a room on both sides, or on neither, uses the side facing
 * away from `centre` (the middle of the plan), so labels do not pile up in the middle.
 */
export function outsideNormal(wall: FloorPlanWall, rooms: Outline[], centre: Pt, probe: number): Pt {
  const length = wallLengthOf(wall);
  if (!(length > 0)) return { x: 0, y: -1 };
  const n: Pt = { x: -(wall.y2 - wall.y1) / length, y: (wall.x2 - wall.x1) / length };
  const mid: Pt = { x: (wall.x1 + wall.x2) / 2, y: (wall.y1 + wall.y2) / 2 };
  const reach = (wall.thickness || 0) / 2 + probe;
  const inside = (sign: number) => {
    const p = { x: mid.x + n.x * reach * sign, y: mid.y + n.y * reach * sign };
    return rooms.some(r => pointInPolygon(p, roomOutline(r)));
  };
  const plus = inside(1), minus = inside(-1);
  if (plus !== minus) return plus ? { x: -n.x, y: -n.y } : n;
  const away = (mid.x - centre.x) * n.x + (mid.y - centre.y) * n.y;
  if (Math.abs(away) > 1e-9) return away > 0 ? n : { x: -n.x, y: -n.y };
  return n.y < 0 || (n.y === 0 && n.x < 0) ? n : { x: -n.x, y: -n.y };
}

export interface DimensionLayout {
  /** The dimension line; an arrowhead sits at each end. */
  line: [Pt, Pt];
  /** Extension lines from just clear of the wall to just past the dimension line. */
  extensions: [[Pt, Pt], [Pt, Pt]];
  /** Centre of the label. */
  label: Pt;
  /** Rotation of the label in degrees, from -90 up to (not including) 90: never upside down. */
  rotation: number;
  /** False when the wall is too short for the label to sit on the line; the label is then moved further out. */
  fits: boolean;
}

/**
 * Geometry of one dimension line. Everything is in the same units as p1/p2 (the editor passes
 * screen pixels), and `normal` is the unit vector pointing to the outside of the wall.
 */
export function layoutDimension(
  p1: Pt, p2: Pt, normal: Pt,
  o: { offset: number; gap: number; overshoot: number; labelLength: number; labelHeight: number; arrow: number }
): DimensionLayout {
  const shift = (p: Pt, d: number): Pt => ({ x: p.x + normal.x * d, y: p.y + normal.y * d });
  const a = shift(p1, o.offset), b = shift(p2, o.offset);
  const length = Math.hypot(b.x - a.x, b.y - a.y);
  const fits = length >= o.labelLength + o.arrow * 2 + 6;
  const centre: Pt = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  // Kept within [-90, 90): level text reads left to right, and text along an upright wall reads
  // upwards, as on a drawing.
  let rotation = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
  if (rotation >= 90 - 1e-9) rotation -= 180;
  else if (rotation < -90 - 1e-9) rotation += 180;
  return {
    line: [a, b],
    extensions: [[shift(p1, o.gap), shift(p1, o.offset + o.overshoot)], [shift(p2, o.gap), shift(p2, o.offset + o.overshoot)]],
    label: fits ? centre : shift(centre, o.labelHeight / 2 + 5),
    rotation,
    fits,
  };
}

// ---------------------------------------------------------------------------
// Multi-wall Dimension Anti-Collision & Tiered Spacing
// ---------------------------------------------------------------------------

export interface WallDimItem {
  id: string;
  p1: Pt;
  p2: Pt;
  normal: Pt;
  text: string;
  halfThickness: number;
  userOffset?: number;
  userShift?: number;
  isSelected?: boolean;
}

export interface WallDimConfig {
  isMobile?: boolean;
  dimFontPx: number;
}

export interface WallDimLayout {
  id: string;
  d: DimensionLayout;
  label: Pt;
  lineMid: Pt;
  slide: number;
  tierOffset: number;
  labelLength: number;
  labelHeight: number;
  hitW: number;
  hitH: number;
  needsLeader: boolean;
}

/**
 * Computes dimension layouts for a collection of walls simultaneously.
 * Detects parallel nearby walls and clusters at corners/junctions,
 * automatically applying tiering (staggered perpendicular offsets)
 * and longitudinal sliding to eliminate label collisions and bunching.
 */
export function computeWallDimensionLayouts(
  items: WallDimItem[],
  cfg: WallDimConfig
): Map<string, WallDimLayout> {
  const layouts = new Map<string, WallDimLayout>();
  if (items.length === 0) return layouts;

  const isMobile = Boolean(cfg.isMobile);
  const dimFontPx = cfg.dimFontPx;
  const baseMargin = isMobile ? 26 : 20;

  // 1. Initialise candidates
  const list = items.map(item => {
    const onScreen = Math.hypot(item.p2.x - item.p1.x, item.p2.y - item.p1.y);
    const unitDir: Pt = onScreen > 1e-4
      ? { x: (item.p2.x - item.p1.x) / onScreen, y: (item.p2.y - item.p1.y) / onScreen }
      : { x: 1, y: 0 };
    const labelLength = item.text.length * dimFontPx * 0.6 + 14;
    const labelHeight = dimFontPx + 8;
    const baseOffset = item.halfThickness + baseMargin + labelHeight / 2 + (item.userOffset || 0);

    return {
      ...item,
      onScreen,
      unitDir,
      labelLength,
      labelHeight,
      baseOffset,
      tierOffset: 0,
      slide: item.userShift || 0,
      d: layoutDimension(item.p1, item.p2, item.normal, {
        offset: baseOffset,
        gap: item.halfThickness + 3,
        overshoot: 5,
        labelLength,
        labelHeight,
        arrow: 7,
      }),
      label: { x: 0, y: 0 },
      radW: 0,
      radH: 0,
    };
  });

  const updateItemGeom = (it: typeof list[0]) => {
    const d = layoutDimension(it.p1, it.p2, it.normal, {
      offset: it.baseOffset + it.tierOffset,
      gap: it.halfThickness + 3,
      overshoot: 5,
      labelLength: it.labelLength,
      labelHeight: it.labelHeight,
      arrow: 7,
    });
    it.d = d;
    it.label = {
      x: d.label.x + it.unitDir.x * it.slide,
      y: d.label.y + it.unitDir.y * it.slide,
    };
    const rad = (d.rotation * Math.PI) / 180;
    const c = Math.abs(Math.cos(rad));
    const s = Math.abs(Math.sin(rad));
    // Bounding half-extents plus 8px safety padding
    it.radW = (it.labelLength * c + it.labelHeight * s) / 2 + 8;
    it.radH = (it.labelLength * s + it.labelHeight * c) / 2 + 8;
  };

  list.forEach(updateItemGeom);

  // 2. Parallel Wall Tiering: separate dimension lines for parallel walls running close to each other
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i];
      const b = list[j];
      const dot = Math.abs(a.unitDir.x * b.unitDir.x + a.unitDir.y * b.unitDir.y);
      if (dot < 0.94) continue; // Not parallel

      // Project b onto a's longitudinal axis to check if they overlap along length
      const t1 = (b.p1.x - a.p1.x) * a.unitDir.x + (b.p1.y - a.p1.y) * a.unitDir.y;
      const t2 = (b.p2.x - a.p1.x) * a.unitDir.x + (b.p2.y - a.p1.y) * a.unitDir.y;
      const minB = Math.min(t1, t2);
      const maxB = Math.max(t1, t2);
      const overlap = Math.min(a.onScreen, maxB) - Math.max(0, minB);
      if (overlap < 15) continue; // Don't run alongside each other

      // Midpoints of dimension lines
      const midA = { x: (a.d.line[0].x + a.d.line[1].x) / 2, y: (a.d.line[0].y + a.d.line[1].y) / 2 };
      const midB = { x: (b.d.line[0].x + b.d.line[1].x) / 2, y: (b.d.line[0].y + b.d.line[1].y) / 2 };
      const dist = Math.hypot(midB.x - midA.x, midB.y - midA.y);
      const perpDist = Math.abs((midB.x - midA.x) * a.normal.x + (midB.y - midA.y) * a.normal.y);
      const normDot = a.normal.x * b.normal.x + a.normal.y * b.normal.y;

      // If dimension lines are close or run at the same perpendicular offset (within 22px)
      if (dist < a.labelHeight + 20 || (normDot > 0.5 && perpDist < a.labelHeight + 22)) {
        // Wall to tier: non-selected wall, or shorter wall
        const target = a.isSelected ? b : (b.isSelected ? a : (a.onScreen >= b.onScreen ? b : a));
        target.tierOffset += target.labelHeight + 16;
        updateItemGeom(target);
      }
    }
  }

  // 3. Iterative 2D Label Collision Avoidance (3 passes)
  for (let pass = 0; pass < 3; pass++) {
    let hadCollision = false;

    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];

        const dx = Math.abs(a.label.x - b.label.x);
        const dy = Math.abs(a.label.y - b.label.y);
        const touchX = a.radW + b.radW;
        const touchY = a.radH + b.radH;

        if (dx < touchX && dy < touchY) {
          hadCollision = true;
          // Determine which wall to adjust
          const movable = a.isSelected && !b.isSelected ? b : (b.isSelected && !a.isSelected ? a : (a.onScreen >= b.onScreen ? b : a));
          const stationary = movable === a ? b : a;

          // Attempt 1: Slide movable along its wall direction to clear stationary
          const toMov = { x: movable.label.x - stationary.label.x, y: movable.label.y - stationary.label.y };
          const proj = toMov.x * movable.unitDir.x + toMov.y * movable.unitDir.y;
          const slideDir = proj >= 0 ? 1 : -1;
          const shiftNeeded = (touchX + 12);
          const candidateSlide = movable.slide + slideDir * shiftNeeded;
          const maxSlide = Math.max(0, (movable.onScreen - movable.labelLength) / 2 + 20);

          let slideApplied = false;
          if (Math.abs(candidateSlide) <= maxSlide) {
            const oldSlide = movable.slide;
            movable.slide = candidateSlide;
            updateItemGeom(movable);

            // Verify if collision with stationary was resolved
            const newDx = Math.abs(movable.label.x - stationary.label.x);
            const newDy = Math.abs(movable.label.y - stationary.label.y);
            if (newDx >= touchX || newDy >= touchY) {
              slideApplied = true;
            } else {
              // Revert if it didn't clear
              movable.slide = oldSlide;
              updateItemGeom(movable);
            }
          }

          // Attempt 2: If slide didn't work, tier outward into next offset level
          if (!slideApplied) {
            movable.tierOffset += movable.labelHeight + 16;
            updateItemGeom(movable);
          }
        }
      }
    }

    if (!hadCollision) break;
  }

  // 4. Build output map
  for (const it of list) {
    const lineMid: Pt = { x: (it.d.line[0].x + it.d.line[1].x) / 2, y: (it.d.line[0].y + it.d.line[1].y) / 2 };
    const distToMid = Math.hypot(it.label.x - lineMid.x, it.label.y - lineMid.y);
    const hitW = Math.max(it.labelLength, isMobile ? 56 : 44);
    const hitH = Math.max(it.labelHeight, isMobile ? 40 : 28);
    const needsLeader = !it.d.fits || Math.abs(it.slide) > Math.max(0, it.onScreen / 2 - it.labelLength / 2) || (it.tierOffset > 0 && Math.abs(it.slide) > 5);

    layouts.set(it.id, {
      id: it.id,
      d: it.d,
      label: it.label,
      lineMid,
      slide: it.slide,
      tierOffset: it.tierOffset,
      labelLength: it.labelLength,
      labelHeight: it.labelHeight,
      hitW,
      hitH,
      needsLeader,
    });
  }

  return layouts;
}

// ---------------------------------------------------------------------------
// Clear (inside) room size
// ---------------------------------------------------------------------------

export interface RoomInterior {
  /** Outline along the inner wall faces. */
  polygon: Pt[];
  area: number;
  /** Bounding box of that outline. */
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * The clear space inside a room: its centre-line outline moved inward by half the thickness of
 * the wall along each side. Returns null when the outline has no walls on it or the walls are
 * too thick to leave any space.
 */
export function roomInterior(room: Outline, walls: FloorPlanWall[], tolerance: number): RoomInterior | null {
  const outline = roomOutline(room);
  const n = outline.length;
  const signed = signedPolygonArea(outline);
  if (n < 3 || Math.abs(signed) < 1e-9) return null;
  const turn = signed > 0 ? 1 : -1;

  let onWall = 0;
  const edges = outline.map((a, i) => {
    const b = outline[(i + 1) % n];
    const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const u: Pt = { x: (b.x - a.x) / length, y: (b.y - a.y) / length };
    const inward: Pt = { x: -u.y * turn, y: u.x * turn };
    const mid: Pt = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    let half = 0;
    for (const w of walls) {
      const len = wallLengthOf(w);
      if (!(len > 0)) continue;
      const wx = (w.x2 - w.x1) / len, wy = (w.y2 - w.y1) / len;
      const offA = Math.abs((a.x - w.x1) * wy - (a.y - w.y1) * wx);
      const offB = Math.abs((b.x - w.x1) * wy - (b.y - w.y1) * wx);
      const t = (mid.x - w.x1) * wx + (mid.y - w.y1) * wy;
      if (offA <= tolerance && offB <= tolerance && t >= -tolerance && t <= len + tolerance) half = Math.max(half, (w.thickness || 0) / 2);
    }
    if (half > 0) onWall += 1;
    return { p: { x: a.x + inward.x * half, y: a.y + inward.y * half }, u, inward, half };
  });
  if (onWall === 0) return null;

  const polygon: Pt[] = edges.map((edge, i) => {
    const prev = edges[(i - 1 + n) % n];
    const cross = prev.u.x * edge.u.y - prev.u.y * edge.u.x;
    if (Math.abs(cross) < 1e-9) {
      const half = Math.max(prev.half, edge.half);
      return { x: outline[i].x + edge.inward.x * half, y: outline[i].y + edge.inward.y * half };
    }
    const t = ((edge.p.x - prev.p.x) * edge.u.y - (edge.p.y - prev.p.y) * edge.u.x) / cross;
    return { x: prev.p.x + t * prev.u.x, y: prev.p.y + t * prev.u.y };
  });

  const innerSigned = signedPolygonArea(polygon);
  const area = polygonArea(polygon);
  if (!(area > 0) || innerSigned * signed <= 0 || area >= Math.abs(signed)) return null;
  const xs = polygon.map(p => p.x), ys = polygon.map(p => p.y);
  const x = Math.min(...xs), y = Math.min(...ys);
  return { polygon, area, x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}
