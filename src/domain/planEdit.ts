/**
 * Editing walls piece by piece, lining walls up, and changing rooms through their walls.
 *
 * SEGMENTS
 *   A wall is one straight line between its two ends. Other walls can meet it partway along
 *   (a T-junction) or cross it; those points divide the wall into segments. The eraser removes
 *   only the segment under the finger, and Split cuts one wall into two walls that are then
 *   edited on their own. A wall with nothing meeting it is one segment.
 *
 * MEASUREMENTS ARE NEVER ROUNDED HERE
 *   A cut lands exactly on the wall's own line, and a wall end that is not cut keeps its
 *   coordinates unchanged. Lining-up fixes only move a wall when the user picks which of the
 *   two measurements is the right one (see findAlignmentIssues).
 *
 * Every function is pure: it returns a new, consistent floor (rooms re-derived, doors and
 * windows kept on their walls) or a refusal with a reason the user can read. Nothing that is
 * passed in is changed.
 */
import type { FloorPlanDoor, FloorPlanRoom, FloorPlanUnit, FloorPlanWall, FloorPlanWindow, RoomType } from '../db/types';
import { baseUnitOf, joinTolerance, moveJoint, planToMm, roomArea, wallLengthOf, type Pt } from './planGeometry';
import { normaliseFloor, prepareForWallEdit, type FloorState } from './planDocument';
import { defaultWallThickness, formatDimension, roomOutline } from './planMeasure';
import { pointSegmentDistance, trimNewWall } from './planSketch';

export type NewId = (prefix: 'wall' | 'room' | 'door') => string;

export type EditResult =
  | { ok: true; state: FloorState; summary: string; changes: string[]; warnings: string[]; focus?: Pt }
  | { ok: false; reason: string };

const fail = (reason: string): EditResult => ({ ok: false, reason });

/** Removes floating-point fuzz (11.999999999998 -> 12) without rounding a real measurement. */
const tidy = (v: number) => Math.round(v * 1e9) / 1e9;

const pointAt = (w: FloorPlanWall, t: number): Pt => {
  const len = wallLengthOf(w);
  if (len === 0) return { x: w.x1, y: w.y1 };
  return { x: tidy(w.x1 + ((w.x2 - w.x1) * t) / len), y: tidy(w.y1 + ((w.y2 - w.y1) * t) / len) };
};

/** Distance along the wall from its start to the foot of the perpendicular from p. */
const along = (w: FloorPlanWall, p: Pt): number => {
  const len = wallLengthOf(w);
  if (len === 0) return 0;
  return ((p.x - w.x1) * (w.x2 - w.x1) + (p.y - w.y1) * (w.y2 - w.y1)) / len;
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Where two walls cross, strictly inside both (not at an end of either). */
function crossing(a: FloorPlanWall, b: FloorPlanWall): Pt | null {
  const d1x = a.x2 - a.x1, d1y = a.y2 - a.y1;
  const d2x = b.x2 - b.x1, d2y = b.y2 - b.y1;
  const denom = d1x * d2y - d1y * d2x;
  if (Math.abs(denom) < 1e-12) return null;
  const t = ((b.x1 - a.x1) * d2y - (b.y1 - a.y1) * d2x) / denom;
  const u = ((b.x1 - a.x1) * d1y - (b.y1 - a.y1) * d1x) / denom;
  if (t <= 1e-9 || t >= 1 - 1e-9 || u <= 1e-9 || u >= 1 - 1e-9) return null;
  return { x: a.x1 + t * d1x, y: a.y1 + t * d1y };
}

// ---------------------------------------------------------------------------
// Segments
// ---------------------------------------------------------------------------

/**
 * Distances along a wall (from its start) where another wall meets it partway or crosses it.
 * Points within the join tolerance of the wall's own ends are not junctions: those are corners.
 */
export function wallJunctions(walls: FloorPlanWall[], wallId: string, tolerance: number): number[] {
  const w = walls.find(x => x.id === wallId);
  if (!w) return [];
  const len = wallLengthOf(w);
  if (len <= tolerance * 2) return [];
  const a = { x: w.x1, y: w.y1 }, b = { x: w.x2, y: w.y2 };
  const found: number[] = [];
  const consider = (t: number) => { if (t > tolerance && t < len - tolerance) found.push(t); };
  for (const o of walls) {
    if (o.id === w.id || wallLengthOf(o) === 0) continue;
    for (const p of [{ x: o.x1, y: o.y1 }, { x: o.x2, y: o.y2 }]) {
      if (pointSegmentDistance(p, a, b) <= tolerance) consider(along(w, p));
    }
    const x = crossing(w, o);
    if (x) consider(along(w, x));
  }
  found.sort((p, q) => p - q);
  const out: number[] = [];
  for (const t of found) if (!out.length || t - out[out.length - 1] > tolerance) out.push(t);
  return out;
}

export interface WallSegment {
  wallId: string;
  /** Start and end of the segment, as distances along the wall. */
  t0: number;
  t1: number;
  a: Pt;
  b: Pt;
  length: number;
  /** True when nothing meets the wall: the segment is the whole wall. */
  whole: boolean;
}

/** The segment of a wall under a point (the point is projected onto the wall). */
export function wallSegmentAt(walls: FloorPlanWall[], wallId: string, p: Pt, tolerance: number): WallSegment | null {
  const w = walls.find(x => x.id === wallId);
  if (!w) return null;
  const len = wallLengthOf(w);
  const t = clamp(along(w, p), 0, len);
  const breaks = [0, ...wallJunctions(walls, wallId, tolerance), len];
  for (let i = 0; i < breaks.length - 1; i++) {
    if (t <= breaks[i + 1] || i === breaks.length - 2) {
      const t0 = breaks[i], t1 = breaks[i + 1];
      return {
        wallId, t0, t1,
        a: t0 === 0 ? { x: w.x1, y: w.y1 } : pointAt(w, t0),
        b: t1 === len ? { x: w.x2, y: w.y2 } : pointAt(w, t1),
        length: t1 - t0,
        whole: breaks.length === 2,
      };
    }
  }
  return null;
}

interface Piece { wall: FloorPlanWall; t0: number; t1: number }

/** A part of a wall, from t0 to t1 along it. Ends that are not cut keep their exact values. */
function piece(w: FloorPlanWall, t0: number, t1: number, id: string): Piece {
  const len = wallLengthOf(w);
  const a = t0 <= 0 ? { x: w.x1, y: w.y1 } : pointAt(w, t0);
  const b = t1 >= len ? { x: w.x2, y: w.y2 } : pointAt(w, t1);
  const wall: FloorPlanWall = { ...w, id, x1: a.x, y1: a.y, x2: b.x, y2: b.y };
  if (t0 > 0) delete wall.startNodeId;
  if (t1 < len) delete wall.endNodeId;
  return { wall, t0, t1 };
}

type Opening = FloorPlanDoor | FloorPlanWindow;

/**
 * Moves doors and windows of a wall that was cut onto the piece they stand on. An opening
 * that is not wholly on one remaining piece (it was in the erased part, or a cut went through
 * it) is returned as removed. Positions are kept exactly; only the wall it belongs to and its
 * distance from that wall's start change.
 */
function rehost<T extends Opening>(list: T[], original: FloorPlanWall, pieces: Piece[]): { list: T[]; removed: T[] } {
  const removed: T[] = [];
  const out: T[] = [];
  for (const o of list) {
    if (o.wallId !== original.id) { out.push(o); continue; }
    const t = along(original, o);
    const half = (o.width || 0) / 2;
    const host = pieces.find(p => t - half >= p.t0 - 1e-6 && t + half <= p.t1 + 1e-6);
    if (!host) { removed.push(o); continue; }
    out.push({ ...o, wallId: host.wall.id, wallOffset: tidy(t - host.t0) });
  }
  return { list: out, removed };
}

function replaceWall(walls: FloorPlanWall[], id: string, pieces: Piece[]): FloorPlanWall[] {
  const i = walls.findIndex(w => w.id === id);
  if (i < 0) return walls;
  return [...walls.slice(0, i), ...pieces.map(p => p.wall), ...walls.slice(i + 1)];
}

const openingName = (o: Opening) => ('doorType' in o ? 'door' : 'window');

/** A floor whose rooms and openings follow its walls again. */
function finish(state: FloorState, unit: FloorPlanUnit, newId: NewId): FloorState {
  return normaliseFloor(state, unit, () => newId('room')).state;
}

/**
 * Erases the segment of a wall under `p`: only the part between the two nearest junctions
 * (or the wall's ends). The rest of the wall stays where it is, so connected walls are not
 * touched. A wall with nothing meeting it is erased whole. Doors and windows standing on the
 * erased part go with it; those on the remaining parts stay exactly where they are.
 */
export function eraseWallSegment(state: FloorState, wallId: string, p: Pt, unit: FloorPlanUnit, newId: NewId): EditResult {
  const start = prepareForWallEdit(state, unit);
  const w = start.walls.find(x => x.id === wallId);
  if (!w) return fail('That wall is no longer on the plan.');
  if (w.locked) return fail('This wall is locked. Unlock it before erasing.');
  const tol = joinTolerance(unit);
  const seg = wallSegmentAt(start.walls, wallId, p, tol);
  if (!seg) return fail('That wall is no longer on the plan.');
  const len = wallLengthOf(w);
  const pieces: Piece[] = [];
  if (!seg.whole) {
    if (seg.t0 > 0) pieces.push(piece(w, 0, seg.t0, w.id));
    if (seg.t1 < len) pieces.push(piece(w, seg.t1, len, pieces.length ? newId('wall') : w.id));
  }
  const doors = rehost(start.doors, w, pieces);
  const windows = rehost(start.windows, w, pieces);
  const next = finish({ ...start, walls: replaceWall(start.walls, w.id, pieces), doors: doors.list, windows: windows.list }, unit, newId);
  const gone = [...doors.removed, ...windows.removed];
  const warnings = gone.length ? [`${gone.length} ${gone.length === 1 ? openingName(gone[0]) : 'doors/windows'} on that part went with it.`] : [];
  return {
    ok: true,
    state: next,
    summary: seg.whole || pieces.length === 0
      ? `Wall erased (${formatDimension(len, unit)})`
      : `Erased ${formatDimension(seg.length, unit)} of the wall. The rest stays.`,
    changes: [],
    warnings,
    focus: { x: (seg.a.x + seg.b.x) / 2, y: (seg.a.y + seg.b.y) / 2 },
  };
}

/** Shortest piece a split may leave: a little more than the join tolerance. */
export const minSplitPiece = (unit: FloorPlanUnit) => joinTolerance(unit) * 1.5;

/**
 * Cuts a wall into two walls at the point on it nearest to `p`. A point within the join
 * tolerance of a junction is cut exactly at the junction. Both new walls keep the wall's
 * thickness, type and height, and its doors and windows stay where they are.
 * Refused near the ends of the wall and through a door or window.
 */
export function splitWall(
  state: FloorState, wallId: string, p: Pt, unit: FloorPlanUnit, newId: NewId
): EditResult & { ids?: [string, string]; at?: Pt } {
  const start = prepareForWallEdit(state, unit);
  const w = start.walls.find(x => x.id === wallId);
  if (!w) return fail('That wall is no longer on the plan.');
  if (w.locked) return fail('This wall is locked. Unlock it before splitting.');
  const tol = joinTolerance(unit);
  const len = wallLengthOf(w);
  let t = clamp(along(w, p), 0, len);
  const near = wallJunctions(start.walls, wallId, tol).find(j => Math.abs(j - t) <= tol);
  if (near !== undefined) t = near;
  const minPiece = minSplitPiece(unit);
  if (t < minPiece || t > len - minPiece) return fail('That is too close to the end of the wall. Tap further along it.');
  const blocking = [...start.doors, ...start.windows].find(o => {
    if (o.wallId !== w.id) return false;
    const c = along(w, o);
    return Math.abs(c - t) < (o.width || 0) / 2 - 1e-6;
  });
  if (blocking) return fail(`A ${openingName(blocking)} is at that point. Split the wall to one side of it.`);
  const first = piece(w, 0, t, w.id);
  const second = piece(w, t, len, newId('wall'));
  const doors = rehost(start.doors, w, [first, second]);
  const windows = rehost(start.windows, w, [first, second]);
  const next = finish({ ...start, walls: replaceWall(start.walls, w.id, [first, second]), doors: doors.list, windows: windows.list }, unit, newId);
  const at = { x: first.wall.x2, y: first.wall.y2 };
  return {
    ok: true,
    state: next,
    summary: `Split into ${formatDimension(t, unit)} and ${formatDimension(len - t, unit)}`,
    changes: [],
    warnings: [],
    focus: at,
    ids: [first.wall.id, second.wall.id],
    at,
  };
}

/**
 * Cuts a wall at every point where another wall meets or crosses it, so each segment becomes
 * its own wall. A junction that falls inside a door or window is skipped.
 */
export function splitWallAtJunctions(state: FloorState, wallId: string, unit: FloorPlanUnit, newId: NewId): EditResult & { ids?: string[] } {
  const start = prepareForWallEdit(state, unit);
  const w = start.walls.find(x => x.id === wallId);
  if (!w) return fail('That wall is no longer on the plan.');
  if (w.locked) return fail('This wall is locked. Unlock it before splitting.');
  const tol = joinTolerance(unit);
  const len = wallLengthOf(w);
  const openings = [...start.doors, ...start.windows].filter(o => o.wallId === w.id);
  const cuts = wallJunctions(start.walls, wallId, tol).filter(t =>
    !openings.some(o => Math.abs(along(w, o) - t) < (o.width || 0) / 2 - 1e-6));
  if (!cuts.length) return fail('No other wall meets this one partway, so there is nothing to split at. Use Split here to cut it at a point.');
  const breaks = [0, ...cuts, len];
  const pieces = breaks.slice(0, -1).map((t0, i) => piece(w, t0, breaks[i + 1], i === 0 ? w.id : newId('wall')));
  const doors = rehost(start.doors, w, pieces);
  const windows = rehost(start.windows, w, pieces);
  const next = finish({ ...start, walls: replaceWall(start.walls, w.id, pieces), doors: doors.list, windows: windows.list }, unit, newId);
  return { ok: true, state: next, summary: `Split into ${pieces.length} walls`, changes: [], warnings: [], ids: pieces.map(p => p.wall.id) };
}

// ---------------------------------------------------------------------------
// Lining walls up
// ---------------------------------------------------------------------------

export interface AlignmentMeasurement {
  /** "Left end", "Kitchen wall" … */
  label: string;
  /** Distance from the reference line, in plan units, exactly as drawn. */
  value: number;
  mm: number;
}

export interface AlignmentIssue {
  id: string;
  /**
   * out_of_line: the two ends of one wall are at different distances from the reference line,
   *              so the wall is slightly tilted.
   * step:        two walls that continue each other are at different distances from it, so
   *              there is a small step where they meet.
   */
  kind: 'out_of_line' | 'step';
  orientation: 'horizontal' | 'vertical';
  wallIds: string[];
  /** The line both measurements are taken from. */
  reference: string;
  measurements: [AlignmentMeasurement, AlignmentMeasurement];
  difference: number;
  differenceMm: number;
  focus: Pt;
}

export interface AlignmentOptions {
  /** Differences up to this are reported (a larger one is taken to be intended). */
  maxMm?: number;
  /** Differences below this are ignored. */
  minMm?: number;
}

const DEFAULT_MAX_MM = 100;
const DEFAULT_MIN_MM = 0.5;

/** A wall within 10° of horizontal or vertical. Diagonal walls are never "out of line". */
function orientationOf(w: FloorPlanWall): 'horizontal' | 'vertical' | null {
  const dx = Math.abs(w.x2 - w.x1), dy = Math.abs(w.y2 - w.y1);
  if (dx === 0 && dy === 0) return null;
  const deg = (Math.atan2(Math.min(dx, dy), Math.max(dx, dy)) * 180) / Math.PI;
  if (deg > 10) return null;
  return dx >= dy ? 'horizontal' : 'vertical';
}

const lineCoord = (w: FloorPlanWall, o: 'horizontal' | 'vertical') => (o === 'horizontal' ? (w.y1 + w.y2) / 2 : (w.x1 + w.x2) / 2);
const spanOf = (w: FloorPlanWall, o: 'horizontal' | 'vertical'): [number, number] =>
  o === 'horizontal' ? [Math.min(w.x1, w.x2), Math.max(w.x1, w.x2)] : [Math.min(w.y1, w.y2), Math.max(w.y1, w.y2)];

/**
 * Small differences in measurements that should probably be the same.
 *
 * Both measurements of an issue are taken from the same real line (the top or the left edge
 * of the plot) and are the drawing's own numbers. Nothing is changed here: the user is shown
 * the two measurements and the difference, and picks which one is right (applyAlignmentFix).
 *
 *   Example: the left end of a wall is 150 mm below the reference line and its right end is
 *   140 mm below it. The issue reports 150 mm, 140 mm and the 10 mm difference.
 */
export function findAlignmentIssues(walls: FloorPlanWall[], unit: FloorPlanUnit, opts: AlignmentOptions = {}): AlignmentIssue[] {
  const maxMm = opts.maxMm ?? DEFAULT_MAX_MM;
  const minMm = opts.minMm ?? DEFAULT_MIN_MM;
  const tol = joinTolerance(unit);
  const mm = (v: number) => planToMm(v, unit);
  const inRange = (d: number) => { const m = mm(Math.abs(d)); return m >= minMm && m <= maxMm; };
  const refName = (o: 'horizontal' | 'vertical') => (o === 'horizontal' ? 'the top edge of the plot' : 'the left edge of the plot');
  const issues: AlignmentIssue[] = [];

  for (const w of walls) {
    const o = orientationOf(w);
    if (!o) continue;
    const d = o === 'horizontal' ? w.y2 - w.y1 : w.x2 - w.x1;
    if (!inRange(d)) continue;
    // First measurement: the left end of a horizontal wall, the top end of a vertical one.
    const startFirst = o === 'horizontal' ? w.x1 <= w.x2 : w.y1 <= w.y2;
    const v1 = o === 'horizontal' ? w.y1 : w.x1;
    const v2 = o === 'horizontal' ? w.y2 : w.x2;
    const [first, second] = startFirst ? [v1, v2] : [v2, v1];
    const names = o === 'horizontal' ? ['Left end', 'Right end'] : ['Top end', 'Bottom end'];
    issues.push({
      id: `line-${w.id}`,
      kind: 'out_of_line',
      orientation: o,
      wallIds: [w.id],
      reference: refName(o),
      measurements: [
        { label: names[0], value: first, mm: mm(first) },
        { label: names[1], value: second, mm: mm(second) },
      ],
      difference: Math.abs(d),
      differenceMm: mm(Math.abs(d)),
      focus: { x: (w.x1 + w.x2) / 2, y: (w.y1 + w.y2) / 2 },
    });
  }

  // Two walls that continue each other end to end (or through a short jog) but sit on
  // slightly different lines.
  const straight = walls.filter(w => orientationOf(w) && !issues.some(i => i.wallIds.includes(w.id)));
  for (let i = 0; i < straight.length; i++) {
    for (let j = i + 1; j < straight.length; j++) {
      const a = straight[i], b = straight[j];
      const o = orientationOf(a);
      if (o !== orientationOf(b) || !o) continue;
      const ca = lineCoord(a, o), cb = lineCoord(b, o);
      if (!inRange(ca - cb)) continue;
      const [a0, a1] = spanOf(a, o), [b0, b1] = spanOf(b, o);
      const overlap = Math.min(a1, b1) - Math.max(a0, b0);
      // End to end: they meet (or nearly meet) and do not run alongside each other.
      if (overlap > tol || overlap < -tol * 2) continue;
      const [first, second] = a0 <= b0 ? [a, b] : [b, a];
      const cf = lineCoord(first, o), cs = lineCoord(second, o);
      const names = o === 'horizontal' ? ['Left wall', 'Right wall'] : ['Upper wall', 'Lower wall'];
      issues.push({
        id: `step-${first.id}-${second.id}`,
        kind: 'step',
        orientation: o,
        wallIds: [first.id, second.id],
        reference: refName(o),
        measurements: [
          { label: names[0], value: cf, mm: mm(cf) },
          { label: names[1], value: cs, mm: mm(cs) },
        ],
        difference: Math.abs(cf - cs),
        differenceMm: mm(Math.abs(cf - cs)),
        focus: o === 'horizontal' ? { x: (first.x1 + first.x2 + second.x1 + second.x2) / 4, y: (cf + cs) / 2 } : { x: (cf + cs) / 2, y: (first.y1 + first.y2 + second.y1 + second.y2) / 4 },
      });
    }
  }
  return issues.slice(0, 30);
}

/** A difference in millimetres as it is read on site: whole millimetres, at least "1 mm". */
export function formatMm(mm: number): string {
  const r = Math.round(mm);
  return `${r === 0 && mm > 0 ? '<1' : r.toLocaleString('en-IN')} mm`;
}

/**
 * Lines the walls of an issue up on the measurement the user chose (`keep` = 0 or 1). The
 * other measurement is moved to it; walls joined there move with it, so nothing comes apart.
 * A short jog that ends up with no length is removed.
 */
export function applyAlignmentFix(state: FloorState, issue: AlignmentIssue, keep: 0 | 1, unit: FloorPlanUnit, newId: NewId): EditResult {
  const start = prepareForWallEdit(state, unit);
  const tol = joinTolerance(unit);
  const target = issue.measurements[keep].value;
  const o = issue.orientation;
  const set = (p: Pt): Pt => (o === 'horizontal' ? { x: p.x, y: target } : { x: target, y: p.y });
  let walls = start.walls;
  const byId = (id: string) => walls.find(w => w.id === id);

  // Every wall end joined at the point moves with it (the same rule as dragging a corner), so
  // a step's two walls end up joined and a jog between them shrinks to nothing.
  const movePoint = (p: Pt) => {
    const to = set(p);
    if (to.x === p.x && to.y === p.y) return;
    walls = moveJoint(walls, p, to, tol);
  };

  if (issue.kind === 'out_of_line') {
    const w = byId(issue.wallIds[0]);
    if (!w) return fail('That wall is no longer on the plan.');
    if (w.locked) return fail('This wall is locked. Unlock it first.');
    const vStart = o === 'horizontal' ? w.y1 : w.x1;
    // Move the end whose measurement was not kept.
    const moveStart = Math.abs(vStart - target) > Math.abs((o === 'horizontal' ? w.y2 : w.x2) - target);
    movePoint(moveStart ? { x: w.x1, y: w.y1 } : { x: w.x2, y: w.y2 });
  } else {
    const other = byId(issue.wallIds[keep === 0 ? 1 : 0]);
    if (!other) return fail('That wall is no longer on the plan.');
    if (other.locked) return fail('This wall is locked. Unlock it first.');
    const a = { x: other.x1, y: other.y1 }, b = { x: other.x2, y: other.y2 };
    movePoint(a);
    movePoint(b);
  }
  walls = walls.filter(w => wallLengthOf(w) > 1e-6);
  const next = finish({ ...start, walls }, unit, newId);
  const kept = issue.measurements[keep];
  return {
    ok: true,
    state: next,
    summary: `Lined up at ${formatMm(kept.mm)} from ${issue.reference}`,
    changes: [`${issue.measurements[keep === 0 ? 1 : 0].label} moved ${formatMm(issue.differenceMm)} to match the ${kept.label.toLowerCase()}.`],
    warnings: [],
    focus: issue.focus,
  };
}

// ---------------------------------------------------------------------------
// Rooms changed through their walls
// ---------------------------------------------------------------------------

export interface RoomBox { minX: number; maxX: number; minY: number; maxY: number }

/** The room as an upright rectangle, or null when its outline is any other shape. */
export function roomBox(room: Pick<FloorPlanRoom, 'x' | 'y' | 'width' | 'height' | 'polygonPoints' | 'rotation'>): RoomBox | null {
  const pts = roomOutline(room);
  if (pts.length !== 4) return null;
  for (let i = 0; i < 4; i++) {
    const p = pts[i], q = pts[(i + 1) % 4];
    if (Math.abs(p.x - q.x) > 1e-6 && Math.abs(p.y - q.y) > 1e-6) return null;
  }
  const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}

export const roomName = (r: Pick<FloorPlanRoom, 'label' | 'roomType'>) => (r.label || r.roomType || 'Room').trim();

/** Smallest room side a resize may leave. */
const minRoomSide = (unit: FloorPlanUnit) => (baseUnitOf(unit) === 'feet' ? 3 : 0.9);
const maxRoomSide = (unit: FloorPlanUnit) => (baseUnitOf(unit) === 'feet' ? 200 : 60);

export type RoomSide = 'left' | 'right' | 'top' | 'bottom';

const sizeText = (b: RoomBox, unit: FloorPlanUnit) => `${formatDimension(b.maxX - b.minX, unit)} × ${formatDimension(b.maxY - b.minY, unit)}`;

/**
 * Moves the walls on one side of a room. Every wall end on that side moves, so walls joined to
 * it stretch and T-junctions stay on. Refused when a wall on that side runs on past the room
 * (moving it would change other rooms in ways that are not asked for).
 */
function moveRoomSide(walls: FloorPlanWall[], box: RoomBox, side: RoomSide, to: number, unit: FloorPlanUnit, name: string):
  { ok: true; walls: FloorPlanWall[] } | { ok: false; reason: string } {
  const tol = joinTolerance(unit);
  const vertical = side === 'left' || side === 'right';
  const at = side === 'left' ? box.minX : side === 'right' ? box.maxX : side === 'top' ? box.minY : box.maxY;
  const [lo, hi] = vertical ? [box.minY, box.maxY] : [box.minX, box.maxX];
  const onSide = walls.filter(w => {
    const c1 = vertical ? w.x1 : w.y1, c2 = vertical ? w.x2 : w.y2;
    if (Math.abs(c1 - at) > tol || Math.abs(c2 - at) > tol) return false;
    const s0 = Math.min(vertical ? w.y1 : w.x1, vertical ? w.y2 : w.x2);
    const s1 = Math.max(vertical ? w.y1 : w.x1, vertical ? w.y2 : w.x2);
    return Math.min(s1, hi) - Math.max(s0, lo) > tol;
  });
  const sideWord = side === 'left' ? 'left' : side === 'right' ? 'right' : side === 'top' ? 'top' : 'bottom';
  if (!onSide.length) return { ok: false, reason: `No wall was found on the ${sideWord} side of ${name}.` };
  if (onSide.some(w => w.locked)) return { ok: false, reason: `The ${sideWord} wall of ${name} is locked.` };
  const runsOn = onSide.some(w => {
    const s0 = Math.min(vertical ? w.y1 : w.x1, vertical ? w.y2 : w.x2);
    const s1 = Math.max(vertical ? w.y1 : w.x1, vertical ? w.y2 : w.x2);
    return s0 < lo - tol || s1 > hi + tol;
  });
  if (runsOn) return { ok: false, reason: `The ${sideWord} wall of ${name} runs on past the room, so moving it would also change the rooms next to it.` };
  const points: Pt[] = [];
  for (const w of onSide) {
    for (const p of [{ x: w.x1, y: w.y1 }, { x: w.x2, y: w.y2 }]) {
      if (!points.some(q => Math.hypot(q.x - p.x, q.y - p.y) <= tol)) points.push(p);
    }
  }
  let next = walls;
  for (const p of points) next = moveJoint(next, p, vertical ? { x: to, y: p.y } : { x: p.x, y: to }, tol);
  return { ok: true, walls: next };
}

/**
 * Changes a room's width (left to right) and/or length (top to bottom).
 *
 * A room made by its walls changes by moving the walls of one side; the side can be chosen,
 * otherwise the right (for width) and bottom (for length) sides are tried first. Neighbouring
 * rooms grow or shrink by the same amount, and the result lists every room that changes.
 * A hand-placed room (no walls) simply gets the new size.
 *
 * Sizes are centre-line sizes, the same as the room's area on the plan.
 */
export function resizeRoom(
  state: FloorState,
  roomId: string,
  size: { width?: number; length?: number },
  unit: FloorPlanUnit,
  newId: NewId,
  sides: { width?: 'left' | 'right'; length?: 'top' | 'bottom' } = {},
  plot?: { length: number; width: number }
): EditResult {
  const start = prepareForWallEdit(state, unit);
  const room = start.rooms.find(r => r.id === roomId);
  if (!room) return fail('That room is no longer on the plan.');
  const name = roomName(room);
  if (room.locked) return fail(`${name} is locked. Unlock it first.`);
  const lim = { min: minRoomSide(unit), max: maxRoomSide(unit) };
  for (const v of [size.width, size.length]) {
    if (v === undefined) continue;
    if (!Number.isFinite(v)) return fail('Give the new size as a number, for example 10 ft.');
    if (v < lim.min) return fail(`A room side must be at least ${formatDimension(lim.min, unit)}.`);
    if (v > lim.max) return fail(`That is larger than ${formatDimension(lim.max, unit)}. Check the number and the unit.`);
  }
  if (size.width === undefined && size.length === undefined) return fail('Say the new width or length.');

  if (!room.fromWalls) {
    const width = size.width ?? room.width, height = size.length ?? room.height;
    if (room.polygonPoints && room.polygonPoints.length >= 3) return fail(`${name} is not a rectangle, so it can not be resized by width and length.`);
    const rooms = start.rooms.map(r => (r.id === roomId ? { ...r, width, height, area: width * height, perimeter: 2 * (width + height) } : r));
    return {
      ok: true,
      state: { ...start, rooms },
      summary: `${name} is now ${formatDimension(width, unit)} × ${formatDimension(height, unit)}`,
      changes: [`${name}: ${formatDimension(room.width, unit)} × ${formatDimension(room.height, unit)} → ${formatDimension(width, unit)} × ${formatDimension(height, unit)}`],
      warnings: [],
      focus: { x: room.x + width / 2, y: room.y + height / 2 },
    };
  }

  const box = roomBox(room);
  if (!box) return fail(`${name} is not a rectangle, so its width and length can not be set. Move its walls instead.`);

  let walls = start.walls;
  let current = box;
  const tryAxis = (axis: 'width' | 'length', value: number): string | null => {
    const now = axis === 'width' ? current.maxX - current.minX : current.maxY - current.minY;
    if (Math.abs(now - value) < 1e-9) return null;
    const order: RoomSide[] = axis === 'width'
      ? (sides.width ? [sides.width] : ['right', 'left'])
      : (sides.length ? [sides.length] : ['bottom', 'top']);
    let reason = '';
    for (const side of order) {
      const to = side === 'right' ? current.minX + value : side === 'left' ? current.maxX - value : side === 'bottom' ? current.minY + value : current.maxY - value;
      const moved = moveRoomSide(walls, current, side, to, unit, name);
      if (moved.ok) {
        walls = moved.walls;
        current = side === 'right' ? { ...current, maxX: to } : side === 'left' ? { ...current, minX: to } : side === 'bottom' ? { ...current, maxY: to } : { ...current, minY: to };
        return null;
      }
      reason = reason ? `${reason} ${moved.reason}` : moved.reason;
    }
    return reason;
  };
  if (size.width !== undefined) { const r = tryAxis('width', size.width); if (r) return fail(r); }
  if (size.length !== undefined) { const r = tryAxis('length', size.length); if (r) return fail(r); }
  if (walls === start.walls) return fail(`${name} is already ${sizeText(box, unit)}.`);

  const norm = normaliseFloor({ ...start, walls }, unit, () => newId('room'));
  const after = norm.state;
  const resized = after.rooms.find(r => r.id === roomId);
  const newBox = resized && roomBox(resized);
  if (!resized || !newBox) return fail(`That change would not leave ${name} as a closed rectangle, so it was not made.`);
  const lost = start.rooms.filter(r => r.fromWalls && !after.rooms.some(n => n.id === r.id));
  if (lost.length) return fail(`That would close up ${lost.map(roomName).join(', ')}, so it was not made.`);

  const changes: string[] = [];
  for (const before of start.rooms) {
    const now = after.rooms.find(r => r.id === before.id);
    if (!now) continue;
    const b0 = roomBox(before), b1 = roomBox(now);
    if (b0 && b1) {
      if (Math.abs(b0.maxX - b0.minX - (b1.maxX - b1.minX)) > 1e-6 || Math.abs(b0.maxY - b0.minY - (b1.maxY - b1.minY)) > 1e-6) {
        changes.push(`${roomName(now)}: ${sizeText(b0, unit)} → ${sizeText(b1, unit)}`);
      }
    } else if (Math.abs(roomArea(before) - roomArea(now)) > 1e-6) {
      changes.push(`${roomName(now)}: area changes`);
    }
  }
  const warnings: string[] = [];
  if (norm.openingsRemoved > 0) warnings.push(`${norm.openingsRemoved} door/window no longer fits its wall and will be removed.`);
  if (plot && (newBox.minX < -1e-6 || newBox.minY < -1e-6 || newBox.maxX > plot.length + 1e-6 || newBox.maxY > plot.width + 1e-6)) {
    warnings.push(`${name} now goes outside the plot.`);
  }
  return {
    ok: true,
    state: after,
    summary: `${name} is now ${sizeText(newBox, unit)}`,
    changes,
    warnings,
    focus: { x: (newBox.minX + newBox.maxX) / 2, y: (newBox.minY + newBox.maxY) / 2 },
  };
}

/**
 * Deletes a room. A room made by its walls goes with the parts of its walls that only it
 * uses; a wall part it shares with another room stays, so the room next door is not opened
 * up. A hand-placed room is simply removed.
 */
export function deleteRoom(state: FloorState, roomId: string, unit: FloorPlanUnit, newId: NewId): EditResult {
  const start = prepareForWallEdit(state, unit);
  const room = start.rooms.find(r => r.id === roomId);
  if (!room) return fail('That room is no longer on the plan.');
  const name = roomName(room);
  if (room.locked) return fail(`${name} is locked. Unlock it first.`);
  if (!room.fromWalls) {
    return { ok: true, state: { ...start, rooms: start.rooms.filter(r => r.id !== roomId) }, summary: `${name} removed`, changes: [], warnings: [] };
  }
  const tol = joinTolerance(unit);
  const outline = roomOutline(room);
  const onOutline = (p: Pt) => outline.some((a, i) => pointSegmentDistance(p, a, outline[(i + 1) % outline.length]) <= tol);
  const others = start.rooms.filter(r => r.id !== roomId);
  const inOther = (p: Pt) => others.some(r => pointInsideOutline(p, roomOutline(r)));
  const targets: Pt[] = [];
  for (const w of start.walls) {
    const len = wallLengthOf(w);
    if (len === 0) continue;
    const breaks = [0, ...wallJunctions(start.walls, w.id, tol), len];
    const n = { x: -(w.y2 - w.y1) / len, y: (w.x2 - w.x1) / len };
    const probe = (w.thickness || 0) / 2 + tol;
    for (let i = 0; i < breaks.length - 1; i++) {
      const m = pointAt(w, (breaks[i] + breaks[i + 1]) / 2);
      if (!onOutline(m)) continue;
      if (w.locked) return fail(`A wall of ${name} is locked. Unlock it first.`);
      const shared = inOther({ x: m.x + n.x * probe, y: m.y + n.y * probe }) || inOther({ x: m.x - n.x * probe, y: m.y - n.y * probe });
      if (!shared) targets.push(m);
    }
  }
  if (!targets.length) {
    return fail(`Every wall of ${name} is shared with another room, so deleting it would open up the rooms around it. Erase one wall to join it to the room next door.`);
  }
  let next = start;
  let removedOpenings = 0;
  for (const p of targets) {
    const host = next.walls
      .map(w => ({ w, d: pointSegmentDistance(p, { x: w.x1, y: w.y1 }, { x: w.x2, y: w.y2 }) }))
      .filter(c => c.d <= tol)
      .sort((a, b) => a.d - b.d)[0]?.w;
    if (!host) continue;
    const before = next.doors.length + next.windows.length;
    const r = eraseWallSegment(next, host.id, p, unit, newId);
    if (!r.ok) return fail(r.reason);
    next = r.state;
    removedOpenings += before - (next.doors.length + next.windows.length);
  }
  next = { ...next, rooms: next.rooms.filter(r => r.id !== roomId) };
  return {
    ok: true,
    state: next,
    summary: `${name} deleted`,
    changes: [`${targets.length} wall part${targets.length === 1 ? '' : 's'} that only ${name} used`],
    warnings: removedOpenings ? [`${removedOpenings} door/window on those walls went with them.`] : [],
  };
}

function pointInsideOutline(p: Pt, pts: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i], b = pts[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

// ---------------------------------------------------------------------------
// Adding a room
// ---------------------------------------------------------------------------

/** Sizes a new room starts with when none is given (width × length, feet). */
const ROOM_START_FT: Partial<Record<RoomType, [number, number]>> = {
  Bathroom: [5, 7], Toilet: [4, 5], Bedroom: [10, 11], 'Master Bedroom': [12, 12], 'Guest Room': [10, 10], 'Kids Room': [10, 10],
  Kitchen: [8, 10], Dining: [8, 10], 'Living Room': [12, 14], Pooja: [4, 4], 'Prayer Room': [4, 4], Store: [5, 6], 'Store Room': [5, 6],
  Utility: [4, 6], Balcony: [4, 10], Study: [8, 10], Office: [8, 10], Corridor: [4, 10], Staircase: [4, 10], Parking: [10, 16], Garage: [10, 16],
};

export function defaultRoomSize(type: RoomType, unit: FloorPlanUnit): { width: number; length: number } {
  const [w, l] = ROOM_START_FT[type] || [10, 10];
  if (baseUnitOf(unit) === 'feet') return { width: w, length: l };
  const m = (ft: number) => Math.round((ft * 0.3048) / 0.05) * 0.05;
  return { width: tidy(m(w)), length: tidy(m(l)) };
}

const ROOM_TINT = 'rgba(248, 250, 252, 0.85)';

function rectWalls(x0: number, y0: number, x1: number, y1: number, thickness: number, wallType: FloorPlanWall['wallType'], newId: NewId): FloorPlanWall[] {
  const mk = (ax: number, ay: number, bx: number, by: number): FloorPlanWall => ({ id: newId('wall'), x1: ax, y1: ay, x2: bx, y2: by, thickness, wallType });
  return [mk(x0, y0, x1, y0), mk(x1, y0, x1, y1), mk(x1, y1, x0, y1), mk(x0, y1, x0, y0)];
}

/** Does any existing wall pass through the inside of this rectangle? */
function rectBlocked(walls: FloorPlanWall[], x0: number, y0: number, x1: number, y1: number, tol: number): boolean {
  const ix0 = x0 + tol, iy0 = y0 + tol, ix1 = x1 - tol, iy1 = y1 - tol;
  if (ix0 >= ix1 || iy0 >= iy1) return true;
  const inside = (p: Pt) => p.x > ix0 && p.x < ix1 && p.y > iy0 && p.y < iy1;
  for (const w of walls) {
    if (inside({ x: w.x1, y: w.y1 }) || inside({ x: w.x2, y: w.y2 })) return true;
    const edges: [Pt, Pt][] = [
      [{ x: ix0, y: iy0 }, { x: ix1, y: iy0 }], [{ x: ix1, y: iy0 }, { x: ix1, y: iy1 }],
      [{ x: ix1, y: iy1 }, { x: ix0, y: iy1 }], [{ x: ix0, y: iy1 }, { x: ix0, y: iy0 }],
    ];
    for (const [a, b] of edges) {
      if (crossing({ ...w }, { ...w, x1: a.x, y1: a.y, x2: b.x, y2: b.y })) return true;
    }
  }
  return false;
}

/** A door on the given wall at its middle, when it fits. */
function doorOnWall(wall: FloorPlanWall, width: number, kind: 'Bathroom' | 'Single', newId: NewId): FloorPlanDoor | null {
  const len = wallLengthOf(wall);
  if (len < width + 0.2) return null;
  const t = len / 2;
  const p = pointAt(wall, t);
  let rotation = (Math.atan2(wall.y2 - wall.y1, wall.x2 - wall.x1) * 180) / Math.PI;
  if (rotation < 0) rotation += 360;
  return {
    id: newId('door'), doorType: kind, x: p.x, y: p.y, width, rotation: Math.round(rotation * 100) / 100,
    swingAngle: 90, wallId: wall.id, wallOffset: tidy(t), hostWallThickness: wall.thickness, layer: 'doors',
  };
}

/** Names the new room that fills this rectangle. */
function labelNewRoom(state: FloorState, before: FloorState, rect: RoomBox, type: RoomType): { state: FloorState; roomId?: string } {
  const cx = (rect.minX + rect.maxX) / 2, cy = (rect.minY + rect.maxY) / 2;
  const existing = new Set(before.rooms.map(r => r.id));
  const target = state.rooms.find(r => !existing.has(r.id) && (() => { const b = roomBox(r); return b && cx > b.minX && cx < b.maxX && cy > b.minY && cy < b.maxY; })());
  if (!target) return { state };
  const count = state.rooms.filter(r => r.roomType === type).length;
  const label = count > 0 ? `${type} ${count + 1}` : type;
  return { state: { ...state, rooms: state.rooms.map(r => (r.id === target.id ? { ...r, roomType: type, label, color: ROOM_TINT } : r)) }, roomId: target.id };
}

/**
 * Adds a walled room.
 *
 *  - Inside a chosen room (`insideRoomId`): the new room takes a corner of it, with two new
 *    inside walls and a door into the room. The chosen room keeps its name and becomes the
 *    rest of the space. The corner is one with no door or window on its walls.
 *  - Otherwise: the new room is built against the outside of the drawing, on the first side
 *    where it fits on the plot without crossing any wall, with a door into the building.
 */
export function addRoom(
  state: FloorState,
  type: RoomType,
  unit: FloorPlanUnit,
  plot: { length: number; width: number },
  newId: NewId,
  opts: { insideRoomId?: string; width?: number; length?: number } = {}
): EditResult & { roomId?: string } {
  const start = prepareForWallEdit(state, unit);
  const tol = joinTolerance(unit);
  const size = { ...defaultRoomSize(type, unit), ...(opts.width ? { width: opts.width } : {}), ...(opts.length ? { length: opts.length } : {}) };
  if (!(size.width >= minRoomSide(unit) && size.length >= minRoomSide(unit))) {
    return fail(`A room side must be at least ${formatDimension(minRoomSide(unit), unit)}.`);
  }
  const inner = defaultWallThickness(unit) / 2;
  const doorWidth = baseUnitOf(unit) === 'feet' ? 2.5 : 0.75;
  const kind = type === 'Bathroom' || type === 'Toilet' ? 'Bathroom' : 'Single';

  if (opts.insideRoomId) {
    const host = start.rooms.find(r => r.id === opts.insideRoomId);
    if (!host) return fail('That room is no longer on the plan.');
    const hostName = roomName(host);
    const box = host.fromWalls ? roomBox(host) : null;
    if (!box) return fail(`${hostName} is not a closed rectangle of walls, so a room can not be made inside it.`);
    const W = box.maxX - box.minX, H = box.maxY - box.minY;
    // Leave the host at least 40% of each side, so it stays usable and keeps its name.
    if (size.width > W * 0.6 || size.length > H * 0.6) {
      return fail(`A ${formatDimension(size.width, unit)} × ${formatDimension(size.length, unit)} ${type.toLowerCase()} does not fit inside ${hostName} (${formatDimension(W, unit)} × ${formatDimension(H, unit)}) and leave it usable.`);
    }
    const corners: { name: string; x0: number; y0: number; x1: number; y1: number; vx: number; hy: number }[] = [
      { name: 'top right', x0: box.maxX - size.width, y0: box.minY, x1: box.maxX, y1: box.minY + size.length, vx: box.maxX - size.width, hy: box.minY + size.length },
      { name: 'top left', x0: box.minX, y0: box.minY, x1: box.minX + size.width, y1: box.minY + size.length, vx: box.minX + size.width, hy: box.minY + size.length },
      { name: 'bottom right', x0: box.maxX - size.width, y0: box.maxY - size.length, x1: box.maxX, y1: box.maxY, vx: box.maxX - size.width, hy: box.maxY - size.length },
      { name: 'bottom left', x0: box.minX, y0: box.maxY - size.length, x1: box.minX + size.width, y1: box.maxY, vx: box.minX + size.width, hy: box.maxY - size.length },
    ];
    const openings = [...start.doors, ...start.windows];
    const blockedBy = (c: typeof corners[number]) => openings.some(o => o.x >= c.x0 - tol && o.x <= c.x1 + tol && o.y >= c.y0 - tol && o.y <= c.y1 + tol);
    const corner = corners.find(c => !blockedBy(c) && !rectBlocked(start.walls, c.x0, c.y0, c.x1, c.y1, tol));
    if (!corner) return fail(`Every corner of ${hostName} has a door, window or wall in the way.`);
    const vertical: FloorPlanWall = { id: newId('wall'), x1: corner.vx, y1: corner.y0, x2: corner.vx, y2: corner.y1, thickness: inner, wallType: 'partition' };
    const horizontal: FloorPlanWall = { id: newId('wall'), x1: corner.x0, y1: corner.hy, x2: corner.x1, y2: corner.hy, thickness: inner, wallType: 'partition' };
    const door = doorOnWall(wallLengthOf(horizontal) >= wallLengthOf(vertical) ? horizontal : vertical, doorWidth, kind, newId);
    const drawn = { ...start, walls: [...start.walls, vertical, horizontal], doors: door ? [...start.doors, door] : start.doors };
    const named = labelNewRoom(finish(drawn, unit, newId), start, { minX: corner.x0, maxX: corner.x1, minY: corner.y0, maxY: corner.y1 }, type);
    return {
      ok: true,
      state: named.state,
      roomId: named.roomId,
      summary: `Added a ${formatDimension(size.width, unit)} × ${formatDimension(size.length, unit)} ${type.toLowerCase()} in the ${corner.name} corner of ${hostName}`,
      changes: [`2 new inside walls${door ? ' and a door' : ''}`, `${hostName} becomes smaller by ${formatDimension(size.width, unit)} × ${formatDimension(size.length, unit)}`],
      warnings: door ? [] : ['There was no room for a door; add one where you want it.'],
      focus: { x: (corner.x0 + corner.x1) / 2, y: (corner.y0 + corner.y1) / 2 },
    };
  }

  const xs = start.walls.flatMap(w => [w.x1, w.x2]);
  const ys = start.walls.flatMap(w => [w.y1, w.y2]);
  const thick = start.walls.find(w => w.wallType === 'exterior')?.thickness || defaultWallThickness(unit);
  const W = size.width, H = size.length;
  const candidates: { name: string; x0: number; y0: number }[] = [];
  if (!xs.length) {
    const margin = baseUnitOf(unit) === 'feet' ? 2 : 0.6;
    candidates.push({ name: 'on the plot', x0: margin, y0: margin });
  } else {
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    candidates.push(
      { name: 'on the right side', x0: maxX, y0: minY },
      { name: 'on the right side', x0: maxX, y0: maxY - H },
      { name: 'at the bottom', x0: minX, y0: maxY },
      { name: 'at the bottom', x0: maxX - W, y0: maxY },
      { name: 'on the left side', x0: minX - W, y0: minY },
      { name: 'at the top', x0: minX, y0: minY - H },
    );
  }
  const fits = (c: { x0: number; y0: number }) =>
    c.x0 >= -1e-6 && c.y0 >= -1e-6 && c.x0 + W <= plot.length + 1e-6 && c.y0 + H <= plot.width + 1e-6 &&
    !rectBlocked(start.walls, c.x0, c.y0, c.x0 + W, c.y0 + H, tol);
  const spot = candidates.find(fits);
  if (!spot) {
    return fail(`There is no free space on the plot for a ${formatDimension(W, unit)} × ${formatDimension(H, unit)} ${type.toLowerCase()} beside the drawing. Select a room to put it inside that room instead.`);
  }
  const fresh = rectWalls(spot.x0, spot.y0, spot.x0 + W, spot.y0 + H, thick, 'exterior', newId);
  let walls = start.walls;
  const added: FloorPlanWall[] = [];
  for (const w of fresh) {
    const pieces = trimNewWall(w, walls, unit, () => newId('wall'));
    added.push(...pieces);
    walls = [...walls, ...pieces];
  }
  if (!added.length) return fail('Those walls are already on the plan.');
  // The door goes in the wall shared with the building (the side that was not added).
  const shared = fresh.find(w => !added.some(a => a.id === w.id));
  const doorHost = shared
    ? walls.find(w => w.id !== shared.id && pointSegmentDistance({ x: (shared.x1 + shared.x2) / 2, y: (shared.y1 + shared.y2) / 2 }, { x: w.x1, y: w.y1 }, { x: w.x2, y: w.y2 }) <= tol)
    : added[0];
  let doors = start.doors;
  if (doorHost) {
    const mid = shared ? { x: (shared.x1 + shared.x2) / 2, y: (shared.y1 + shared.y2) / 2 } : pointAt(doorHost, wallLengthOf(doorHost) / 2);
    const t = clamp(along(doorHost, mid), doorWidth / 2, wallLengthOf(doorHost) - doorWidth / 2);
    const clash = [...start.doors, ...start.windows].some(o => o.wallId === doorHost.id && Math.abs(along(doorHost, o) - t) < (o.width + doorWidth) / 2);
    if (wallLengthOf(doorHost) >= doorWidth + 0.2 && !clash) {
      const p = pointAt(doorHost, t);
      let rotation = (Math.atan2(doorHost.y2 - doorHost.y1, doorHost.x2 - doorHost.x1) * 180) / Math.PI;
      if (rotation < 0) rotation += 360;
      doors = [...doors, {
        id: newId('door'), doorType: kind, x: p.x, y: p.y, width: doorWidth, rotation: Math.round(rotation * 100) / 100,
        swingAngle: 90, wallId: doorHost.id, wallOffset: tidy(t), hostWallThickness: doorHost.thickness, layer: 'doors',
      }];
    }
  }
  const named = labelNewRoom(finish({ ...start, walls, doors }, unit, newId), start, { minX: spot.x0, maxX: spot.x0 + W, minY: spot.y0, maxY: spot.y0 + H }, type);
  return {
    ok: true,
    state: named.state,
    roomId: named.roomId,
    summary: `Added a ${formatDimension(W, unit)} × ${formatDimension(H, unit)} ${type.toLowerCase()} ${spot.name}`,
    changes: [`${added.length} new wall${added.length === 1 ? '' : 's'}${doors.length > start.doors.length ? ' and a door' : ''}`],
    warnings: doors.length > start.doors.length ? [] : ['No door was added: place one where you want it.'],
    focus: { x: spot.x0 + W / 2, y: spot.y0 + H / 2 },
  };
}
