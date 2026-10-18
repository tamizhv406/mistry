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
