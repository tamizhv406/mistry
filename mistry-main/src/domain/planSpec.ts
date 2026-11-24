/**
 * AI Design: the structured "plan spec" that an assistant proposes, the checks it must pass,
 * and how it becomes real editor geometry.
 *
 * A spec is a list of rectangular rooms on a plot, plus the doors and windows between them.
 * It can come from two places: the AI model (through the server function) or the built-in
 * layout rules in this file. Either way nothing reaches the drawing until the spec has been
 * validated here and the user has previewed and applied it.
 *
 * Coordinates: x runs east (right), y runs south (down), the origin is the plot's north-west
 * corner, and the road / entrance side is taken to be the south edge unless stated.
 *
 * Everything here is a conceptual layout aid. It checks geometry (fits the plot, no overlaps,
 * rooms reachable), not building rules, structure or setbacks.
 */
import type { FloorPlanDoor, FloorPlanUnit, FloorPlanWall, FloorPlanWindow, FloorPlanRoom, RoomType } from '../db/types';
import { emptyFloorState, normaliseFloor, type FloorState } from './planDocument';
import { baseUnitOf, fitOpeningOnWall, openingOverlaps, type BaseUnit } from './planGeometry';

// ---------------------------------------------------------------------------
// The spec
// ---------------------------------------------------------------------------

/** 'user' = the person gave this size; 'proposed' = the assistant chose it. */
export type SizeSource = 'user' | 'proposed';
export type Side = 'north' | 'south' | 'east' | 'west';

export interface SpecRoom {
  id: string;
  type: RoomType;
  label: string;
  x: number;
  y: number;
  width: number;   // along x
  depth: number;   // along y
  sizeSource: SizeSource;
}

export interface SpecDoor {
  from: string;                 // room id
  to: string;                   // room id, or 'outside'
  kind?: 'main' | 'internal' | 'bathroom' | 'opening';
  width?: number;
}

export interface SpecWindow {
  room: string;
  side: Side;
  width?: number;
}

export interface PlanSpec {
  unit: BaseUnit;
  plot: { width: number; depth: number };
  rooms: SpecRoom[];
  doors: SpecDoor[];
  windows: SpecWindow[];
}

export const PLAN_SPEC_DISCLAIMER =
  'Conceptual layout only. Sizes marked "proposed" were chosen by the assistant. Not checked against building rules, setbacks or structure.';

interface UnitRules {
  grid: number; tol: number; extWall: number; intWall: number;
  door: number; mainDoor: number; bathDoor: number; window: number; vent: number;
  margin: number; minRoomArea: number; minHabitable: number; minService: number; maxPlot: number;
  len: string; area: string;
}

export function unitRules(unit: BaseUnit): UnitRules {
  return unit === 'feet'
    ? { grid: 0.25, tol: 0.15, extWall: 0.75, intWall: 0.375, door: 3, mainDoor: 3.5, bathDoor: 2.5, window: 4, vent: 2,
        margin: 0.5, minRoomArea: 12, minHabitable: 7, minService: 3.5, maxPlot: 1000, len: 'ft', area: 'sq.ft' }
    : { grid: 0.05, tol: 0.05, extWall: 0.23, intWall: 0.115, door: 0.9, mainDoor: 1.05, bathDoor: 0.75, window: 1.2, vent: 0.6,
        margin: 0.15, minRoomArea: 1.2, minHabitable: 2.1, minService: 1.05, maxPlot: 300, len: 'm', area: 'sq.m' };
}

const ROOM_TYPES: RoomType[] = [
  'Living Room', 'Master Bedroom', 'Bedroom', 'Guest Room', 'Kids Room', 'Kitchen', 'Dining', 'Bathroom', 'Toilet',
  'Utility', 'Store', 'Store Room', 'Study', 'Pooja', 'Prayer Room', 'Balcony', 'Corridor', 'Staircase', 'Parking',
  'Garage', 'Office', 'Terrace', 'Custom',
];

/** Maps whatever a person or model called a room to one of the editor's room types. */
export function normaliseRoomType(raw: string): RoomType {
  const t = String(raw || '').trim().toLowerCase();
  const exact = ROOM_TYPES.find(r => r.toLowerCase() === t);
  if (exact) return exact;
  if (/master|main bed/.test(t)) return 'Master Bedroom';
  if (/kid|child/.test(t)) return 'Kids Room';
  if (/guest/.test(t)) return 'Guest Room';
  if (/bed/.test(t)) return 'Bedroom';
  if (/toilet|\bwc\b|latrine/.test(t)) return 'Toilet';
  if (/bath|wash ?room|rest ?room/.test(t)) return 'Bathroom';
  if (/kitchen|samayal/.test(t)) return 'Kitchen';
  if (/dining/.test(t)) return 'Dining';
  if (/living|hall|drawing|lounge/.test(t)) return 'Living Room';
  if (/pooja|puja|prayer|mandir/.test(t)) return 'Pooja';
  if (/park|car|porch|garage/.test(t)) return 'Parking';
  if (/balcon|sit.?out|verand/.test(t)) return 'Balcony';
  if (/stair/.test(t)) return 'Staircase';
  if (/corridor|passage|lobby|foyer/.test(t)) return 'Corridor';
  if (/store|storage/.test(t)) return 'Store';
  if (/utility|wash|laundry/.test(t)) return 'Utility';
  if (/study|library/.test(t)) return 'Study';
  if (/office|shop/.test(t)) return 'Office';
  if (/terrace/.test(t)) return 'Terrace';
  return 'Custom';
}

const isBath = (t: RoomType) => t === 'Bathroom' || t === 'Toilet';
const isBed = (t: RoomType) => t === 'Master Bedroom' || t === 'Bedroom' || t === 'Guest Room' || t === 'Kids Room';
const isOpenSpace = (t: RoomType) => t === 'Parking' || t === 'Garage' || t === 'Balcony' || t === 'Terrace';
const isSmallService = (t: RoomType) => isBath(t) || t === 'Pooja' || t === 'Prayer Room' || t === 'Store' || t === 'Store Room' || t === 'Utility';

const near = (a: number, b: number) => Math.abs(a - b) < 1e-6;
const roundTo = (v: number, grid: number) => Math.round(v / grid) * grid;
const clean = (v: number) => Math.round(v * 10000) / 10000;

// ---------------------------------------------------------------------------
// Tidying and unit conversion
// ---------------------------------------------------------------------------

/**
 * Puts every coordinate on the drawing grid and pulls edges that are almost on the same line
 * onto one line, so rooms meant to share a wall really do. Small arithmetic slips in a
 * proposed layout disappear here; real errors (overlaps, out of plot) remain for validation.
 */
export function snapSpec(spec: PlanSpec): PlanSpec {
  const c = unitRules(spec.unit);
  const snapAxis = (values: number[]): Map<number, number> => {
    const sorted = [...new Set(values)].sort((a, b) => a - b);
    const map = new Map<number, number>();
    let group: number[] = [];
    const flush = () => {
      if (!group.length) return;
      const target = roundTo(group.reduce((s, v) => s + v, 0) / group.length, c.grid);
      group.forEach(v => map.set(v, clean(target)));
      group = [];
    };
    for (const v of sorted) {
      if (group.length && v - group[group.length - 1] > c.tol) flush();
      group.push(v);
    }
    flush();
    return map;
  };
  const xs = snapAxis([0, spec.plot.width, ...spec.rooms.flatMap(r => [r.x, r.x + r.width])]);
  const ys = snapAxis([0, spec.plot.depth, ...spec.rooms.flatMap(r => [r.y, r.y + r.depth])]);
  const rooms = spec.rooms.map(r => {
    const x1 = xs.get(r.x) ?? r.x;
    const x2 = xs.get(r.x + r.width) ?? r.x + r.width;
    const y1 = ys.get(r.y) ?? r.y;
    const y2 = ys.get(r.y + r.depth) ?? r.y + r.depth;
    return { ...r, x: x1, y: y1, width: clean(x2 - x1), depth: clean(y2 - y1) };
  });
  return {
    ...spec,
    plot: { width: clean(roundTo(spec.plot.width, c.grid)), depth: clean(roundTo(spec.plot.depth, c.grid)) },
    rooms,
  };
}

const FEET_PER_METER = 3.280839895;

/** The same layout expressed in the plan's own unit. */
export function convertSpecUnit(spec: PlanSpec, to: BaseUnit): PlanSpec {
  if (spec.unit === to) return spec;
  const k = to === 'feet' ? FEET_PER_METER : 1 / FEET_PER_METER;
  const m = (v: number) => clean(v * k);
  return {
    unit: to,
    plot: { width: m(spec.plot.width), depth: m(spec.plot.depth) },
    rooms: spec.rooms.map(r => ({ ...r, x: m(r.x), y: m(r.y), width: m(r.width), depth: m(r.depth) })),
    doors: spec.doors.map(d => ({ ...d, width: d.width === undefined ? undefined : m(d.width) })),
    windows: spec.windows.map(w => ({ ...w, width: w.width === undefined ? undefined : m(w.width) })),
  };
}

// ---------------------------------------------------------------------------
// Reading untrusted input (a model's reply) into a spec
// ---------------------------------------------------------------------------

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : NaN);

/**
 * Turns unknown data into a PlanSpec, or says why it can not be one. This is the only door a
 * model's output comes through: wrong shapes, missing numbers and unknown ids stop here.
 */
export function parsePlanSpec(input: unknown): { spec: PlanSpec | null; problems: string[] } {
  const problems: string[] = [];
  const o = input as Record<string, unknown> | null;
  if (!o || typeof o !== 'object') return { spec: null, problems: ['The plan is not an object.'] };
  const unit = o.unit === 'meters' || o.unit === 'metres' || o.unit === 'm' ? 'meters' : o.unit === 'feet' || o.unit === 'ft' ? 'feet' : null;
  if (!unit) problems.push('The plan does not say whether it is in feet or meters.');
  const plot = o.plot as Record<string, unknown> | undefined;
  const pw = num(plot?.width);
  const pd = num(plot?.depth);
  if (!(pw > 0) || !(pd > 0)) problems.push('The plot width and depth are missing or not numbers.');
  if (!Array.isArray(o.rooms) || o.rooms.length === 0) problems.push('The plan has no rooms.');
  if (problems.length) return { spec: null, problems };

  const seen = new Set<string>();
  const rooms: SpecRoom[] = [];
  (o.rooms as unknown[]).forEach((raw, i) => {
    const r = raw as Record<string, unknown>;
    const x = num(r?.x), y = num(r?.y), width = num(r?.width), depth = num(r?.depth);
    const label = typeof r?.label === 'string' && r.label.trim() ? r.label.trim().slice(0, 40) : '';
    if ([x, y, width, depth].some(Number.isNaN)) { problems.push(`Room ${i + 1}${label ? ` (${label})` : ''} has a missing or non-numeric size or position.`); return; }
    let id = typeof r.id === 'string' && r.id.trim() ? r.id.trim() : `room-${i + 1}`;
    if (seen.has(id)) { problems.push(`Two rooms share the id "${id}".`); id = `${id}-${i + 1}`; }
    seen.add(id);
    const type = normaliseRoomType(typeof r.type === 'string' ? r.type : label);
    rooms.push({ id, type, label: label || type, x, y, width, depth, sizeSource: r.sizeSource === 'user' ? 'user' : 'proposed' });
  });

  const doors: SpecDoor[] = [];
  if (Array.isArray(o.doors)) for (const raw of o.doors as unknown[]) {
    const d = raw as Record<string, unknown>;
    if (typeof d?.from !== 'string' || typeof d?.to !== 'string') continue;
    const kind = d.kind === 'main' || d.kind === 'internal' || d.kind === 'bathroom' || d.kind === 'opening' ? d.kind : undefined;
    const width = num(d.width);
    doors.push({ from: d.from, to: d.to, kind, width: width > 0 ? width : undefined });
  }
  const windows: SpecWindow[] = [];
  if (Array.isArray(o.windows)) for (const raw of o.windows as unknown[]) {
    const w = raw as Record<string, unknown>;
    const side = w?.side === 'north' || w?.side === 'south' || w?.side === 'east' || w?.side === 'west' ? w.side : null;
    if (typeof w?.room !== 'string' || !side) continue;
    const width = num(w.width);
    windows.push({ room: w.room, side, width: width > 0 ? width : undefined });
  }
  if (!rooms.length) return { spec: null, problems };
  return { spec: { unit: unit as BaseUnit, plot: { width: pw, depth: pd }, rooms, doors, windows }, problems };
}

// ---------------------------------------------------------------------------
// Geometry between rooms
// ---------------------------------------------------------------------------

interface Edge { vertical: boolean; at: number; from: number; to: number }

const overlapArea = (a: SpecRoom, b: SpecRoom) =>
  Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) *
  Math.max(0, Math.min(a.y + a.depth, b.y + b.depth) - Math.max(a.y, b.y));

/** The stretch of wall two rooms share, if they touch along a side. */
export function sharedEdge(a: SpecRoom, b: SpecRoom): Edge | null {
  const yFrom = Math.max(a.y, b.y), yTo = Math.min(a.y + a.depth, b.y + b.depth);
  const xFrom = Math.max(a.x, b.x), xTo = Math.min(a.x + a.width, b.x + b.width);
  if ((near(a.x + a.width, b.x) || near(b.x + b.width, a.x)) && yTo - yFrom > 1e-6) {
    return { vertical: true, at: near(a.x + a.width, b.x) ? b.x : a.x, from: yFrom, to: yTo };
  }
  if ((near(a.y + a.depth, b.y) || near(b.y + b.depth, a.y)) && xTo - xFrom > 1e-6) {
    return { vertical: false, at: near(a.y + a.depth, b.y) ? b.y : a.y, from: xFrom, to: xTo };
  }
  return null;
}

/** The parts of one side of a room that face outdoors (no other room against them). */
export function exteriorStretches(room: SpecRoom, side: Side, rooms: SpecRoom[]): Edge[] {
  const vertical = side === 'east' || side === 'west';
  const at = side === 'west' ? room.x : side === 'east' ? room.x + room.width : side === 'north' ? room.y : room.y + room.depth;
  const from = vertical ? room.y : room.x;
  const to = vertical ? room.y + room.depth : room.x + room.width;
  const blocked: [number, number][] = [];
  for (const o of rooms) {
    if (o.id === room.id) continue;
    const e = sharedEdge(room, o);
    if (e && e.vertical === vertical && near(e.at, at)) blocked.push([e.from, e.to]);
  }
  blocked.sort((p, q) => p[0] - q[0]);
  const out: Edge[] = [];
  let cursor = from;
  for (const [f, t] of blocked) {
    if (f - cursor > 1e-6) out.push({ vertical, at, from: cursor, to: f });
    cursor = Math.max(cursor, t);
  }
  if (to - cursor > 1e-6) out.push({ vertical, at, from: cursor, to });
  return out;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export interface SpecCheck {
  ok: boolean;          // false = must not be applied
  errors: string[];
  warnings: string[];
}

const fmt = (v: number) => (Math.abs(v - Math.round(v)) < 0.01 ? String(Math.round(v)) : v.toFixed(2).replace(/0$/, ''));
export const sizeText = (r: Pick<SpecRoom, 'width' | 'depth'>, unit: BaseUnit) => `${fmt(r.width)} × ${fmt(r.depth)} ${unitRules(unit).len}`;

/**
 * Checks a (snapped) spec before it may be drawn: sizes are real numbers, every room is inside
 * the plot, no two rooms overlap, and doors and windows refer to walls that exist. Warnings
 * are shown to the user but do not block the draft.
 */
export function validatePlanSpec(spec: PlanSpec): SpecCheck {
  const c = unitRules(spec.unit);
  const errors: string[] = [];
  const warnings: string[] = [];
  const { width: W, depth: D } = spec.plot;

  if (!(W > 0) || !(D > 0)) errors.push('The plot size must be greater than zero.');
  if (W > c.maxPlot || D > c.maxPlot) errors.push(`The plot is larger than this planner supports (${c.maxPlot} ${c.len} per side).`);
  if (!spec.rooms.length) errors.push('There are no rooms in the plan.');
  if (spec.rooms.length > 40) errors.push('The plan has more than 40 rooms.');

  const byId = new Map(spec.rooms.map(r => [r.id, r]));
  if (byId.size !== spec.rooms.length) errors.push('Two rooms share the same id.');

  for (const r of spec.rooms) {
    if (![r.x, r.y, r.width, r.depth].every(Number.isFinite) || r.width <= 0 || r.depth <= 0) {
      errors.push(`${r.label} has an invalid size.`);
      continue;
    }
    if (r.x < -c.tol || r.y < -c.tol || r.x + r.width > W + c.tol || r.y + r.depth > D + c.tol) {
      errors.push(`${r.label} (${sizeText(r, spec.unit)}) goes outside the ${fmt(W)} × ${fmt(D)} ${c.len} plot.`);
    }
    if (r.width * r.depth < c.minRoomArea) errors.push(`${r.label} is too small to be a room (${sizeText(r, spec.unit)}).`);
    else {
      const least = Math.min(r.width, r.depth);
      const need = isSmallService(r.type) || r.type === 'Corridor' || r.type === 'Staircase' ? c.minService : c.minHabitable;
      if (!isOpenSpace(r.type) && least < need - 1e-6) warnings.push(`${r.label} is only ${fmt(least)} ${c.len} on its short side.`);
    }
  }
  for (let i = 0; i < spec.rooms.length; i++) {
    for (let j = i + 1; j < spec.rooms.length; j++) {
      const a = spec.rooms[i], b = spec.rooms[j];
      if (overlapArea(a, b) > c.tol * c.tol) errors.push(`${a.label} and ${b.label} overlap.`);
    }
  }
  const used = spec.rooms.reduce((s, r) => s + r.width * r.depth, 0);
  if (W > 0 && D > 0 && used > W * D + c.tol) errors.push('The rooms add up to more area than the plot has.');

  const doorCount = new Map<string, number>();
  for (const d of spec.doors) {
    const a = byId.get(d.from);
    const b = d.to === 'outside' ? null : byId.get(d.to);
    if (!a || (d.to !== 'outside' && !b)) { warnings.push('A door refers to a room that is not in the plan; it was left out.'); continue; }
    if (b && !sharedEdge(a, b)) { warnings.push(`${a.label} and ${b.label} do not share a wall, so the door between them was left out.`); continue; }
    doorCount.set(a.id, (doorCount.get(a.id) || 0) + 1);
    if (b) doorCount.set(b.id, (doorCount.get(b.id) || 0) + 1);
  }
  for (const r of spec.rooms) {
    if (!isOpenSpace(r.type) && !doorCount.get(r.id)) warnings.push(`${r.label} has no door yet.`);
  }
  if (!spec.doors.some(d => d.to === 'outside')) warnings.push('There is no entrance door from outside yet.');
  for (const w of spec.windows) {
    const r = byId.get(w.room);
    if (!r) continue;
    if (!exteriorStretches(r, w.side, spec.rooms).length) warnings.push(`${r.label} has no outside wall on its ${w.side} side for a window; it was left out.`);
  }
  return { ok: errors.length === 0, errors, warnings };
}

// ---------------------------------------------------------------------------
// Doors and windows chosen by rule
// ---------------------------------------------------------------------------

const DOOR_COST = (room: SpecRoom, via: SpecRoom): number => {
  if (isBath(via.type)) return 99;                                   // never walk through a bathroom
  if (isBath(room.type)) return isBed(via.type) ? 0 : via.type === 'Kitchen' ? 6 : 1;
  if (via.type === 'Living Room' || via.type === 'Dining' || via.type === 'Corridor') return 0;
  if (isOpenSpace(via.type)) return 5;
  if (via.type === 'Kitchen') return 3;
  if (isBed(via.type)) return 4;
  return 2;
};

/**
 * Doors that make every room reachable from the entrance, and one window per room that has an
 * outside wall. Rooms are joined through the living room, dining or a passage where possible;
 * a bedroom reached only through the kitchen or another bedroom is reported in `notes`.
 */
export function autoOpenings(spec: PlanSpec): { doors: SpecDoor[]; windows: SpecWindow[]; notes: string[] } {
  const c = unitRules(spec.unit);
  const notes: string[] = [];
  const rooms = spec.rooms;
  const doors: SpecDoor[] = [];
  const root = rooms.find(r => r.type === 'Living Room') || rooms.find(r => r.type === 'Dining' || r.type === 'Corridor')
    || rooms.find(r => !isBath(r.type) && !isOpenSpace(r.type)) || rooms[0];
  if (!root) return { doors, windows: [], notes };

  const sides: Side[] = ['south', 'east', 'west', 'north'];
  const entranceSide = sides.find(s => exteriorStretches(root, s, rooms).some(e => e.to - e.from >= c.mainDoor + 2 * c.margin));
  if (entranceSide) doors.push({ from: root.id, to: 'outside', kind: 'main' });
  else notes.push(`${root.label} has no outside wall wide enough for the entrance door.`);

  const reached = new Set<string>([root.id]);
  const pending = rooms.filter(r => r.id !== root.id && !isOpenSpace(r.type));
  while (pending.length) {
    let best: { room: SpecRoom; via: SpecRoom; cost: number } | null = null;
    for (const room of pending) {
      for (const via of rooms) {
        if (!reached.has(via.id)) continue;
        const e = sharedEdge(room, via);
        const need = (isBath(room.type) ? c.bathDoor : c.door) + 2 * c.margin;
        if (!e || e.to - e.from < need) continue;
        const cost = DOOR_COST(room, via);
        if (cost < 99 && (!best || cost < best.cost)) best = { room, via, cost };
      }
    }
    if (!best) break;
    doors.push({ from: best.via.id, to: best.room.id, kind: isBath(best.room.type) ? 'bathroom' : 'internal' });
    if (best.cost >= 3 && !isBath(best.room.type)) notes.push(`${best.room.label} is entered through ${best.via.label}. A passage would be better.`);
    reached.add(best.room.id);
    pending.splice(pending.indexOf(best.room), 1);
  }
  for (const r of pending) notes.push(`${r.label} could not be given a door: it does not share a long enough wall with a reachable room.`);

  const windows: SpecWindow[] = [];
  for (const r of rooms) {
    if (isOpenSpace(r.type) || r.type === 'Corridor') continue;
    const want = isBath(r.type) || r.type === 'Store' || r.type === 'Store Room' ? c.vent : c.window;
    let pick: { side: Side; length: number } | null = null;
    for (const side of sides) {
      for (const e of exteriorStretches(r, side, rooms)) {
        const usable = e.to - e.from - (r.id === root.id && side === entranceSide ? c.mainDoor + c.margin : 0);
        if (usable >= want + 2 * c.margin && (!pick || usable > pick.length)) pick = { side, length: usable };
      }
    }
    if (pick) windows.push({ room: r.id, side: pick.side });
  }
  return { doors, windows, notes };
}

// ---------------------------------------------------------------------------
// From spec to editor geometry
// ---------------------------------------------------------------------------

export interface BuiltFloor {
  state: FloorState;
  /** Things the spec asked for that could not be drawn (a door with no shared wall, ...). */
  dropped: string[];
}

const uniqueSorted = (vals: number[]) => {
  const out: number[] = [];
  for (const v of [...vals].sort((a, b) => a - b)) if (!out.length || !near(out[out.length - 1], v)) out.push(v);
  return out;
};

function buildWalls(rooms: SpecRoom[], c: UnitRules, newId: (prefix: string) => string): FloorPlanWall[] {
  const xs = uniqueSorted(rooms.flatMap(r => [r.x, r.x + r.width]));
  const ys = uniqueSorted(rooms.flatMap(r => [r.y, r.y + r.depth]));
  const eps = c.grid / 8;
  const inside = (px: number, py: number) => rooms.some(r => px > r.x && px < r.x + r.width && py > r.y && py < r.y + r.depth);
  const walls: FloorPlanWall[] = [];
  const push = (vertical: boolean, at: number, from: number, to: number, exterior: boolean) => {
    walls.push({
      id: newId('wall'),
      x1: vertical ? at : from, y1: vertical ? from : at,
      x2: vertical ? at : to, y2: vertical ? to : at,
      thickness: exterior ? c.extWall : c.intWall,
      wallType: exterior ? 'exterior' : 'interior',
      layer: 'walls',
    });
  };
  const sweep = (vertical: boolean, lines: number[], steps: number[]) => {
    for (const at of lines) {
      let run: { from: number; to: number; exterior: boolean } | null = null;
      for (let i = 0; i < steps.length - 1; i++) {
        const mid = (steps[i] + steps[i + 1]) / 2;
        const onBoundary = rooms.some(r => vertical
          ? (near(r.x, at) || near(r.x + r.width, at)) && mid > r.y && mid < r.y + r.depth
          : (near(r.y, at) || near(r.y + r.depth, at)) && mid > r.x && mid < r.x + r.width);
        const a = vertical ? inside(at - eps, mid) : inside(mid, at - eps);
        const b = vertical ? inside(at + eps, mid) : inside(mid, at + eps);
        const exterior = !(a && b);
        if (onBoundary && run && run.exterior === exterior && near(run.to, steps[i])) run.to = steps[i + 1];
        else {
          if (run) push(vertical, at, run.from, run.to, run.exterior);
          run = onBoundary ? { from: steps[i], to: steps[i + 1], exterior } : null;
        }
      }
      if (run) push(vertical, at, run.from, run.to, run.exterior);
    }
  };
  sweep(true, xs, ys);
  sweep(false, ys, xs);
  return walls;
}

/**
 * Draws a validated spec as walls, rooms, doors and windows in the editor's own model: shared
 * walls are single walls, rooms follow their walls (so they stay editable one by one), and
 * every opening is hosted on a wall. The result is passed through the same consistency step
 * the editor uses after any wall edit.
 */
export function buildFloorFromSpec(spec: PlanSpec, planUnit: FloorPlanUnit, newId: (prefix: string) => string): BuiltFloor {
  const c = unitRules(spec.unit);
  const dropped: string[] = [];
  const byId = new Map(spec.rooms.map(r => [r.id, r]));
  const walls = buildWalls(spec.rooms, c, newId);

  const rooms: FloorPlanRoom[] = spec.rooms.map(r => ({
    id: newId('room'),
    roomType: r.type,
    label: r.label,
    x: r.x, y: r.y, width: r.width, height: r.depth,
    area: clean(r.width * r.depth),
    perimeter: clean(2 * (r.width + r.depth)),
    shapeType: 'rectangle',
    polygonPoints: [{ x: r.x, y: r.y }, { x: r.x + r.width, y: r.y }, { x: r.x + r.width, y: r.y + r.depth }, { x: r.x, y: r.y + r.depth }],
    fromWalls: true,
    rotation: 0,
    layer: 'rooms',
  }));

  const wallOn = (e: Edge, mid: number) => walls.find(w => e.vertical
    ? near(w.x1, e.at) && near(w.x2, e.at) && Math.min(w.y1, w.y2) <= mid + 1e-6 && Math.max(w.y1, w.y2) >= mid - 1e-6
    : near(w.y1, e.at) && near(w.y2, e.at) && Math.min(w.x1, w.x2) <= mid + 1e-6 && Math.max(w.x1, w.x2) >= mid - 1e-6);

  const doors: FloorPlanDoor[] = [];
  const windows: FloorPlanWindow[] = [];
  /** Finds a free spot for an opening of `width` on the stretch `e`; null when none fits. */
  const place = (e: Edge, width: number, fractions: number[]) => {
    const lo = e.from + c.margin + width / 2;
    const hi = e.to - c.margin - width / 2;
    if (hi < lo - 1e-6) return null;
    for (const f of fractions) {
      const pos = lo + (hi - lo) * f;
      const wall = wallOn(e, pos);
      if (!wall) continue;
      const fit = fitOpeningOnWall(wall, width, e.vertical ? e.at : pos, e.vertical ? pos : e.at);
      if (!fit || openingOverlaps(wall.id, fit.wallOffset, width + c.margin, [...doors, ...windows])) continue;
      return { wall, fit };
    }
    return null;
  };

  for (const d of spec.doors) {
    const a = byId.get(d.from);
    const b = d.to === 'outside' ? null : byId.get(d.to);
    if (!a || (d.to !== 'outside' && !b)) { dropped.push('A door to a room that is not in the plan.'); continue; }
    const bath = d.kind === 'bathroom' || isBath(a.type) || (!!b && isBath(b.type));
    const kind = d.kind || (b ? (bath ? 'bathroom' : 'internal') : 'main');
    const width = d.width || (kind === 'main' ? c.mainDoor : kind === 'bathroom' ? c.bathDoor : c.door);
    const stretches: Edge[] = b
      ? [sharedEdge(a, b)].filter((e): e is Edge => !!e)
      : (['south', 'east', 'west', 'north'] as Side[]).flatMap(s => exteriorStretches(a, s, spec.rooms)).sort((p, q) => {
          // Prefer the road side (south), then the longest stretch.
          const south = (e: Edge) => (!e.vertical && near(e.at, a.y + a.depth) ? 1 : 0);
          return south(q) - south(p) || (q.to - q.from) - (p.to - p.from);
        });
    let done = false;
    for (const e of stretches) {
      const spot = place(e, width, b ? [0.2, 0.8, 0.5] : [0.5, 0.25, 0.75]);
      if (!spot) continue;
      doors.push({
        id: newId('door'),
        doorType: kind === 'main' ? 'Main Entrance' : kind === 'bathroom' ? 'Bathroom' : kind === 'opening' ? 'Opening' : 'Single',
        x: spot.fit.x, y: spot.fit.y, width, rotation: spot.fit.rotation,
        wallId: spot.wall.id, wallOffset: spot.fit.wallOffset, hostWallThickness: spot.wall.thickness,
        layer: 'doors',
      });
      done = true;
      break;
    }
    if (!done) dropped.push(b ? `The door between ${a.label} and ${b.label} (no wall long enough).` : `The entrance door of ${a.label} (no outside wall long enough).`);
  }

  for (const w of spec.windows) {
    const r = byId.get(w.room);
    if (!r) continue;
    const vent = isBath(r.type) || r.type === 'Store' || r.type === 'Store Room';
    const width = w.width || (vent ? c.vent : c.window);
    const stretches = exteriorStretches(r, w.side, spec.rooms).sort((p, q) => (q.to - q.from) - (p.to - p.from));
    let done = false;
    for (const e of stretches) {
      const spot = place(e, width, [0.5, 0.25, 0.75]);
      if (!spot) continue;
      windows.push({
        id: newId('window'),
        windowType: vent ? 'Ventilator' : 'Standard',
        x: spot.fit.x, y: spot.fit.y, width, rotation: spot.fit.rotation,
        wallId: spot.wall.id, wallOffset: spot.fit.wallOffset, hostWallThickness: spot.wall.thickness,
        layer: 'windows',
      });
      done = true;
      break;
    }
    if (!done) dropped.push(`A window on the ${w.side} side of ${r.label} (no outside wall long enough).`);
  }

  const state = normaliseFloor({ ...emptyFloorState(), walls, rooms, doors, windows }, planUnit, () => newId('room')).state;
  return { state, dropped };
}

// ---------------------------------------------------------------------------
// Built-in layout rules (work without any AI model)
// ---------------------------------------------------------------------------

export interface ProgramRoom {
  type: RoomType;
  label: string;
  /** Present only when the person asked for this size. */
  width?: number;
  depth?: number;
}

export interface RoomProgram {
  unit: BaseUnit;
  plotWidth: number;
  plotDepth: number;
  rooms: ProgramRoom[];
}

/** Typical floor areas in sq.ft, used only to share the plot out between rooms. */
const TYPICAL_AREA: Partial<Record<RoomType, number>> = {
  'Living Room': 190, 'Master Bedroom': 150, 'Bedroom': 125, 'Guest Room': 115, 'Kids Room': 110, 'Kitchen': 95,
  'Dining': 100, 'Bathroom': 40, 'Toilet': 30, 'Utility': 35, 'Store': 35, 'Store Room': 35, 'Study': 85, 'Pooja': 28,
  'Prayer Room': 28, 'Balcony': 45, 'Corridor': 40, 'Staircase': 70, 'Parking': 150, 'Garage': 170, 'Office': 110,
  'Terrace': 100, 'Custom': 90,
};
const SQFT_PER_SQM = 10.7639;

interface Cell { room: ProgramRoom; area: number }
type Row = { cells: Cell[]; small: boolean };

/** Lays two stacks of rows out as a west ("day") and an east ("night") column that fill the plot. */
function tileColumns(day: Row[], night: Row[], W: number, D: number, unit: BaseUnit): SpecRoom[] {
  const c = unitRules(unit);
  const rowArea = (r: Row) => r.cells.reduce((t, x) => t + x.area, 0);
  const colArea = (col: Row[]) => col.reduce((s, r) => s + rowArea(r), 0);
  const columns = [day, night].filter(col => col.length);
  const rooms: SpecRoom[] = [];
  if (!columns.length) return rooms;
  let dayW = W;
  if (columns.length === 2) {
    const share = Math.min(0.64, Math.max(0.36, colArea(day) / (colArea(day) + colArea(night))));
    dayW = clean(roundTo(W * share, c.grid));
  }
  let n = 0;
  const placeColumn = (col: Row[], x0: number, width: number, outerOnRight: boolean) => {
    // Small rows (two bathrooms, pooja + store) get a comfortable fixed depth; the rest share what is left.
    const smallMin = unit === 'feet' ? 5.5 : 1.65;
    const smallMax = unit === 'feet' ? 8 : 2.4;
    const natural = col.map(r => rowArea(r) / width);
    const scale = D / natural.reduce((s, v) => s + v, 0);
    const depths = col.map((r, i) => (r.small ? Math.min(smallMax, Math.max(smallMin, natural[i] * scale)) : 0));
    const fixed = depths.reduce((s, v) => s + v, 0);
    const bigArea = col.filter(r => !r.small).reduce((s, r) => s + rowArea(r), 0);
    col.forEach((r, i) => {
      if (!r.small) depths[i] = bigArea > 0 ? ((D - fixed) * rowArea(r)) / bigArea : 0;
      else if (bigArea === 0) depths[i] = (D * rowArea(r)) / colArea(col);
    });
    let y = 0;
    col.forEach((row, i) => {
      const depth = i === col.length - 1 ? clean(D - y) : clean(roundTo(depths[i], c.grid));
      // Small rooms in a row are sized first (never thinner than a usable bathroom), the main room takes the rest.
      const minW = unit === 'feet' ? 4.5 : 1.35;
      const total = rowArea(row);
      const smalls = row.cells.filter(cl => isSmallService(cl.room.type));
      const mains = row.cells.filter(cl => !isSmallService(cl.room.type));
      const widths = new Map<Cell, number>();
      if (mains.length) {
        let used = 0;
        for (const cl of smalls) {
          const w = Math.min(width * 0.4, Math.max(minW, cl.area / Math.max(depth, 0.01)));
          widths.set(cl, w);
          used += w;
        }
        const mainArea = mains.reduce((t, x) => t + x.area, 0);
        for (const cl of mains) widths.set(cl, ((width - used) * cl.area) / mainArea);
      } else {
        for (const cl of row.cells) widths.set(cl, (width * cl.area) / total);
      }
      // The main room sits against the other column; small rooms go to the outer wall (for ventilation).
      const ordered = [...mains, ...smalls];
      if (!outerOnRight) ordered.reverse();
      let x = x0;
      ordered.forEach((cl, j) => {
        const w = j === ordered.length - 1 ? clean(x0 + width - x) : clean(roundTo(widths.get(cl) || 0, c.grid));
        n += 1;
        rooms.push({ id: `r${n}`, type: cl.room.type, label: cl.room.label, x, y, width: w, depth, sizeSource: 'proposed' });
        x = clean(x + w);
      });
      y = clean(y + depth);
    });
  };
  if (columns.length === 2) {
    placeColumn(day, 0, dayW, false);
    placeColumn(night, dayW, clean(W - dayW), true);
  } else {
    placeColumn(columns[0], 0, W, true);
  }
  return rooms;
}

/** How awkward a set of rooms is: long thin rooms and rooms below a usable width cost points. */
function awkwardness(rooms: SpecRoom[], unit: BaseUnit): number {
  const c = unitRules(unit);
  let score = 0;
  for (const r of rooms) {
    const short = Math.min(r.width, r.depth);
    const ratio = Math.max(r.width, r.depth) / Math.max(short, 0.01);
    const allowed = isOpenSpace(r.type) || r.type === 'Corridor' ? 3.2 : isSmallService(r.type) ? 2.2 : 1.8;
    if (ratio > allowed) score += (ratio - allowed) * (ratio - allowed) * 10 + (ratio - allowed) * 2;
    const need = isSmallService(r.type) || r.type === 'Staircase' || r.type === 'Corridor' ? c.minService : c.minHabitable;
    if (!isOpenSpace(r.type) && short < need) score += (40 * (need - short)) / need + 20;
  }
  return score;
}

/**
 * Arranges a list of rooms on a plot with simple, predictable rules:
 *  - a "day" side with the living room at the road, then dining and kitchen behind it;
 *  - a "night" side with the bedrooms, and the bathrooms between or beside them;
 *  - small rooms (pooja, store, utility, extra bathrooms) share a row so none is a sliver.
 * A handful of such arrangements are tried (side by side or front and back, kitchen on either
 * side) and the one with the best-proportioned, best-connected rooms is kept. Every room is a
 * rectangle, the rooms tile the plot exactly, and all sizes are proposals.
 */
export function layoutProgram(program: RoomProgram): { spec: PlanSpec; notes: string[] } {
  const c = unitRules(program.unit);
  const notes: string[] = [];
  const W = program.plotWidth, D = program.plotDepth;
  const areaOf = (r: ProgramRoom) => {
    if (r.width && r.depth) return r.width * r.depth;
    const sqft = TYPICAL_AREA[r.type] ?? 90;
    return program.unit === 'feet' ? sqft : sqft / SQFT_PER_SQM;
  };
  const cell = (room: ProgramRoom): Cell => ({ room, area: areaOf(room) });
  const all = program.rooms;
  const beds = all.filter(r => isBed(r.type)).sort((a, b) => (b.type === 'Master Bedroom' ? 1 : 0) - (a.type === 'Master Bedroom' ? 1 : 0));
  const baths = all.filter(r => isBath(r.type));
  const parking = all.filter(r => r.type === 'Parking' || r.type === 'Garage');
  const bedLike = all.filter(r => r.type === 'Study' || r.type === 'Office');
  const smalls = all.filter(r => isSmallService(r.type) && !isBath(r.type));
  const dayBig = all.filter(r => !isBed(r.type) && !isBath(r.type) && !parking.includes(r) && !bedLike.includes(r) && !smalls.includes(r));
  const order: RoomType[] = ['Kitchen', 'Staircase', 'Dining', 'Corridor', 'Custom', 'Balcony', 'Terrace', 'Living Room'];
  dayBig.sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type));     // back → front: kitchen at the back, living at the road
  const sleepers = [...beds, ...bedLike];

  /** One way of sharing the rooms between the two sides. Rows run from the back of the plot to the road. */
  const arrange = (opt: { kitchenAtNight: boolean; loneBathToDay: boolean; parkingAtDay: boolean; bedAtDay: boolean; loneSmallOwnRow: boolean }): { day: Row[]; night: Row[] } => {
    const night: Row[] = [];
    const bathQueue = [...baths];
    const lone = opt.loneBathToDay && bathQueue.length === 1 ? bathQueue.splice(0, 1) : [];
    // With three or more bedrooms one of them may sit on the day side, next to the living room.
    const movedBed = opt.bedAtDay && sleepers.length >= 3 ? sleepers[sleepers.length - 1] : null;
    const nightSleepers = movedBed ? sleepers.slice(0, -1) : sleepers;
    if (nightSleepers.length === 1) {
      const row = bathQueue.splice(0, 2);
      if (row.length === 2) night.push({ cells: row.map(cell), small: true });
      night.push({ cells: [cell(nightSleepers[0]), ...(row.length === 1 ? row.map(cell) : [])], small: false });
    } else {
      nightSleepers.forEach((bed, i) => {
        const row: Row = { cells: [cell(bed)], small: false };
        night.push(row);
        if (i < nightSleepers.length - 1 && bathQueue.length) {
          const pair = bathQueue.splice(0, 2);
          if (pair.length === 2) night.push({ cells: pair.map(cell), small: true });
          else row.cells.push(cell(pair[0]));       // a single bathroom sits beside the bedroom, on the outer wall
        }
      });
    }
    if (!opt.parkingAtDay) parking.forEach(p => night.push({ cells: [cell(p)], small: false }));

    const dayRooms = dayBig.filter(r => !(opt.kitchenAtNight && r.type === 'Kitchen'));
    const day: Row[] = dayRooms.map(r => ({ cells: [cell(r)], small: false }));
    const kitchenRow: Row[] = opt.kitchenAtNight ? dayBig.filter(r => r.type === 'Kitchen').map(r => ({ cells: [cell(r)], small: false })) : [];
    // Bathrooms that are left over are common ones and join the other small rooms.
    const pool = [...smalls, ...bathQueue, ...lone];
    const smallRows: Row[] = [];
    while (pool.length >= 2) smallRows.push({ cells: pool.splice(0, pool.length === 3 ? 3 : 2).map(cell), small: true });
    if (pool.length === 1) {
      const host = kitchenRow[0] || day.find(r => r.cells[0].room.type === 'Kitchen') || day[0] || night[0];
      if (host && !opt.loneSmallOwnRow) host.cells.push(cell(pool[0]));
      else smallRows.push({ cells: [cell(pool[0])], small: true });
    }
    if (opt.kitchenAtNight) night.unshift(...kitchenRow, ...smallRows);
    else {
      const kitchenAt = day.findIndex(r => r.cells[0].room.type === 'Kitchen');
      day.splice(kitchenAt >= 0 ? kitchenAt + 1 : 0, 0, ...smallRows);
    }
    // The moved bedroom goes just behind the living room; parking on the day side stands at the road.
    if (movedBed) day.splice(Math.max(0, day.length - 1), 0, { cells: [cell(movedBed)], small: false });
    if (opt.parkingAtDay) parking.forEach(p => day.push({ cells: [cell(p)], small: false }));
    return { day, night };
  };

  let best: { spec: PlanSpec; notes: string[]; score: number } | null = null;
  const yesNo = [false, true];
  const options = yesNo.flatMap(kitchenAtNight => yesNo.flatMap(loneBathToDay => yesNo.flatMap(parkingAtDay => yesNo.flatMap(bedAtDay =>
    yesNo.map(loneSmallOwnRow => ({ kitchenAtNight, loneBathToDay, parkingAtDay, bedAtDay, loneSmallOwnRow }))))));
  for (const opt of options) {
    {
      const { day, night } = arrange(opt);
      for (const frontBack of yesNo) {
        // Side by side: day column on the west. Front and back: the same stacks turned a quarter turn,
        // so the day rooms line the road (south) and the night rooms sit behind them.
        const rooms: SpecRoom[] = !frontBack
          ? tileColumns(day, night, W, D, program.unit)
          : tileColumns(day, night, D, W, program.unit).map(r => ({
              ...r, x: r.y, y: clean(D - (r.x + r.width)), width: r.depth, depth: r.width,
            }));
        const snapped = snapSpec({ unit: program.unit, plot: { width: W, depth: D }, rooms, doors: [], windows: [] });
        const openings = autoOpenings(snapped);
        const candidate: PlanSpec = { ...snapped, doors: openings.doors, windows: openings.windows };
        const score = awkwardness(snapped.rooms, program.unit) + openings.notes.length * 6
          + (validatePlanSpec(candidate).errors.length ? 1000 : 0);
        if (!best || score < best.score - 1e-9) best = { spec: candidate, notes: openings.notes, score };
      }
    }
  }
  const spec: PlanSpec = best ? best.spec : { unit: program.unit, plot: { width: W, depth: D }, rooms: [], doors: [], windows: [] };

  // A size the person asked for is kept as "theirs" only if the layout really gave it.
  for (const r of spec.rooms) {
    const asked = all.find(p => p.label === r.label && p.width && p.depth);
    if (!asked?.width || !asked.depth) continue;
    const fits = (Math.abs(r.width - asked.width) <= c.tol && Math.abs(r.depth - asked.depth) <= c.tol)
      || (Math.abs(r.width - asked.depth) <= c.tol && Math.abs(r.depth - asked.width) <= c.tol);
    if (fits) r.sizeSource = 'user';
    else notes.push(`${r.label}: you asked for ${fmt(asked.width)} × ${fmt(asked.depth)} ${c.len}; it is drawn as ${sizeText(r, program.unit)} so the rooms fill the plot. Resize it after applying.`);
  }
  return { spec, notes: [...notes, ...(best ? best.notes : [])] };
}

// ---------------------------------------------------------------------------
// Reading a typed request without a model (English, Tanglish, some Tamil)
// ---------------------------------------------------------------------------

const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, single: 1, double: 2,
  oru: 1, onnu: 1, ondru: 1, rendu: 2, irandu: 2, moonu: 3, moondru: 3, naalu: 4, naangu: 4, anju: 5, aindhu: 5,
  'ஒரு': 1, 'ஒன்று': 1, 'இரண்டு': 2, 'ரெண்டு': 2, 'மூன்று': 3, 'மூணு': 3, 'நான்கு': 4, 'நாலு': 4, 'ஐந்து': 5,
};

const ROOM_WORDS: { type: RoomType; label: string; re: RegExp }[] = [
  { type: 'Master Bedroom', label: 'Master Bedroom', re: /master\s*bed(?:room)?s?/ },
  { type: 'Bedroom', label: 'Bedroom', re: /bed\s*rooms?|\bbeds?\b|படுக்கையறை|படுக்கை\s*அறை/ },
  { type: 'Bathroom', label: 'Bathroom', re: /bath\s*rooms?|\bbaths?\b|wash\s*rooms?|குளியலறை|குளியல்\s*அறை/ },
  { type: 'Toilet', label: 'Toilet', re: /toilets?|கழிப்பறை/ },
  { type: 'Kitchen', label: 'Kitchen', re: /kitchens?|samayal\s*arai|சமையலறை|சமையல்\s*அறை/ },
  { type: 'Living Room', label: 'Living Room', re: /living\s*rooms?|\bhalls?\b|\bliving\b|ஹால்|வரவேற்பறை/ },
  { type: 'Dining', label: 'Dining', re: /dining(?:\s*(?:room|hall|area))?|சாப்பாட்டு\s*அறை/ },
  { type: 'Pooja', label: 'Pooja', re: /pooja(?:\s*room)?|puja(?:\s*room)?|prayer(?:\s*room)?|பூஜை(?:\s*அறை)?/ },
  { type: 'Parking', label: 'Parking', re: /car\s*park(?:ing)?|parking|car\s*porch|\bporch\b|பார்க்கிங்/ },
  { type: 'Store', label: 'Store', re: /store(?:\s*room)?|storage/ },
  { type: 'Utility', label: 'Utility', re: /utility|wash\s*area|laundry/ },
  { type: 'Study', label: 'Study', re: /study(?:\s*room)?/ },
  { type: 'Office', label: 'Office', re: /office(?:\s*room)?/ },
  { type: 'Balcony', label: 'Balcony', re: /balcon(?:y|ies)|sit\s*-?out|verandah?/ },
  { type: 'Staircase', label: 'Staircase', re: /stair\s*cases?|stairs/ },
];

export interface PromptReading {
  /** Null when no room at all could be read. */
  program: RoomProgram | null;
  /** True when the message gave a plot size (otherwise the plan's own plot is used). */
  plotStated: boolean;
  /** Short statements of what was assumed, to show the user. */
  assumptions: string[];
  /** What must be asked before a layout can be made. */
  questions: string[];
}

const countBefore = (text: string, re: RegExp): number | null => {
  const m = text.match(new RegExp(`(\\d+|${Object.keys(NUMBER_WORDS).join('|')})\\s*(?:nos?\\.?\\s*)?(?:${re.source})`, 'i'));
  if (!m) return null;
  const raw = m[1].toLowerCase();
  return /^\d+$/.test(raw) ? parseInt(raw, 10) : NUMBER_WORDS[raw] ?? null;
};

/**
 * Reads the common ways of asking for a house ("30x40 2BHK with pooja and car parking",
 * "30 by 40 plot, rendu bedroom, oru kitchen") without any AI model. It only understands
 * plot size, BHK, room names and counts, and sizes written right after a room name. Anything
 * it did not understand is simply not used, and what it assumed is listed for the user.
 */
export function readPlanPrompt(message: string, fallback: { unit: BaseUnit; plotWidth: number; plotDepth: number }): PromptReading {
  const text = ` ${message.toLowerCase().replace(/[×✕*]/g, 'x').replace(/\s+/g, ' ')} `;
  const assumptions: string[] = [];
  const questions: string[] = [];

  let unit = fallback.unit;
  const saysFeet = /\b(ft|feet|foot|adi)\b|அடி|\d\s*['′]/.test(text);
  if (/\d\s*m\b|\b(meters?|metres?|mtrs?)\b|மீட்டர்/.test(text) && !saysFeet) unit = 'meters';
  else if (saysFeet) unit = 'feet';

  // Plot size: the first "A x B" that is not attached to a room name.
  const dim = /(\d+(?:\.\d+)?)\s*(?:ft|feet|m|adi|')?\s*(?:x|by|into)\s*(\d+(?:\.\d+)?)/g;
  const roomDims: { index: number; w: number; d: number }[] = [];
  let plot: { w: number; d: number } | null = null;
  for (let m = dim.exec(text); m; m = dim.exec(text)) {
    const before = text.slice(Math.max(0, m.index - 28), m.index);
    const attached = ROOM_WORDS.some(r => new RegExp(`(?:${r.re.source})\\s*(?:of|size|is|:|-|\\()?\\s*$`, 'i').test(before));
    if (attached) roomDims.push({ index: m.index, w: parseFloat(m[1]), d: parseFloat(m[2]) });
    else if (!plot) plot = { w: parseFloat(m[1]), d: parseFloat(m[2]) };
  }
  const plotStated = !!plot;
  const plotWidth = plot ? plot.w : fallback.plotWidth;
  const plotDepth = plot ? plot.d : fallback.plotDepth;
  if (!plot) assumptions.push(`Using this plan's plot: ${fmt(plotWidth)} × ${fmt(plotDepth)} ${unitRules(unit).len}.`);

  const bhk = text.match(/(\d+)\s*-?\s*bhk/);
  const rooms: ProgramRoom[] = [];
  const add = (type: RoomType, label: string, count: number) => {
    for (let i = 0; i < count; i++) rooms.push({ type, label: count > 1 || rooms.some(r => r.type === type) ? `${label} ${rooms.filter(r => r.type === type).length + 1}` : label });
  };
  const has = (re: RegExp) => re.test(text);

  let bedrooms = bhk ? parseInt(bhk[1], 10) : (countBefore(text, ROOM_WORDS[1].re) ?? (has(ROOM_WORDS[1].re) ? 1 : 0));
  bedrooms = Math.min(6, Math.max(0, bedrooms));
  const master = has(ROOM_WORDS[0].re) || bedrooms >= 2;
  if (bedrooms > 0) {
    if (master) {
      // The master bedroom is bedroom 1, so the others are numbered from 2.
      rooms.push({ type: 'Master Bedroom', label: 'Master Bedroom' });
      for (let i = 2; i <= bedrooms; i++) rooms.push({ type: 'Bedroom', label: `Bedroom ${i}` });
    }
    else add('Bedroom', 'Bedroom', bedrooms);
  }
  if (bhk || has(ROOM_WORDS[5].re)) add('Living Room', 'Living Room', 1);
  if (bhk || has(ROOM_WORDS[4].re)) add('Kitchen', 'Kitchen', 1);
  let bathrooms = countBefore(text, ROOM_WORDS[2].re) ?? (has(ROOM_WORDS[2].re) ? 1 : 0);
  const toilets = countBefore(text, ROOM_WORDS[3].re) ?? (has(ROOM_WORDS[3].re) ? 1 : 0);
  if (bhk && bathrooms + toilets === 0) {
    bathrooms = Math.min(2, Math.max(1, bedrooms));
    assumptions.push(`${bathrooms} bathroom${bathrooms > 1 ? 's' : ''} assumed for a ${bedrooms} BHK (you did not say how many).`);
  }
  add('Bathroom', 'Bathroom', Math.min(6, bathrooms));
  add('Toilet', 'Toilet', Math.min(4, toilets));
  for (const w of ROOM_WORDS.slice(6)) {
    if (has(w.re)) add(w.type, w.label, Math.min(3, countBefore(text, w.re) ?? 1));
  }

  // Sizes written right after a room name belong to the first room of that type.
  for (const rd of roomDims) {
    const before = text.slice(Math.max(0, rd.index - 28), rd.index);
    const word = ROOM_WORDS.find(r => new RegExp(`(?:${r.re.source})\\s*(?:of|size|is|:|-|\\()?\\s*$`, 'i').test(before));
    const target = word && rooms.find(r => r.type === word.type && !r.width);
    if (target) { target.width = rd.w; target.depth = rd.d; }
  }

  if (!rooms.length) {
    questions.push('Which rooms do you want? For example: "2 BHK with pooja room and car parking".');
    return { program: null, plotStated, assumptions, questions };
  }
  if (!(plotWidth > 0) || !(plotDepth > 0)) {
    questions.push('What is the plot size? For example: "30 × 40 ft".');
    return { program: null, plotStated, assumptions, questions };
  }
  if (!rooms.some(r => r.type === 'Living Room') && rooms.some(r => isBed(r.type))) {
    rooms.push({ type: 'Living Room', label: 'Living Room' });
    assumptions.push('A living room was added so the bedrooms have somewhere to open into.');
  }
  return { program: { unit, plotWidth, plotDepth, rooms }, plotStated, assumptions, questions };
}

// ---------------------------------------------------------------------------
// Summaries
// ---------------------------------------------------------------------------

/** The rooms of an existing floor as a spec, when they are all plain rectangles. */
export function specFromFloor(state: Pick<FloorState, 'rooms'>, unit: FloorPlanUnit, plot: { width: number; depth: number }): PlanSpec | null {
  if (!state.rooms.length) return null;
  const rect = state.rooms.every(r => !r.polygonPoints || r.polygonPoints.length === 4);
  if (!rect) return null;
  return {
    unit: baseUnitOf(unit),
    plot,
    rooms: state.rooms.map((r, i) => ({
      id: `r${i + 1}`, type: r.roomType, label: r.label || r.roomType, x: clean(r.x), y: clean(r.y),
      width: clean(r.width), depth: clean(r.height), sizeSource: 'user' as SizeSource,
    })),
    doors: [],
    windows: [],
  };
}

export function specTotals(spec: PlanSpec): { builtArea: number; plotArea: number; coverage: number } {
  const builtArea = spec.rooms.reduce((s, r) => s + r.width * r.depth, 0);
  const plotArea = spec.plot.width * spec.plot.depth;
  return { builtArea, plotArea, coverage: plotArea > 0 ? builtArea / plotArea : 0 };
}
