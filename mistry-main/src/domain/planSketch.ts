/**
 * Freehand wall sketching: turns one rough finger, pen or mouse stroke into connected,
 * straight walls.
 *
 * Everything here works in PLAN units (feet or metres, see planGeometry.ts), never in screen
 * pixels. The editor converts a pixel-sized tolerance into plan units for the current zoom and
 * passes it in, so the same stroke gives the same walls at any zoom.
 *
 * What a stroke goes through, in order:
 *   1. Wobble is removed (Ramer-Douglas-Peucker) and small hooks and jogs are dropped.
 *   2. Each straight run is pulled to the nearest allowed angle if it is close to one.
 *   3. A line is fitted to each run and the corners are the crossings of those lines, so a
 *      hand-drawn box gets true right angles instead of four separately nudged corners.
 *   4. Stroke ends join an existing corner, wall crossing or wall that is within tolerance,
 *      and a stroke that ends near where it began is closed into a loop.
 *   5. Anything that would lie on top of a wall that already exists is cut away.
 *
 * Nothing is added to the plan here. The result says what was corrected and by how much, so
 * the editor can show it first and only commit a large correction when the user accepts it.
 */
import type { FloorPlanUnit, FloorPlanWall, WallType } from '../db/types';
import { baseUnitOf, joinTolerance, polygonArea, wallLengthOf, type Pt } from './planGeometry';

/** Wall directions a stroke is straightened to by default, in degrees (0 = horizontal). */
export const DEFAULT_SNAP_ANGLES = [0, 45, 90, 135];
export const ORTHO_SNAP_ANGLES = [0, 90];

export interface SketchOptions {
  unit: FloorPlanUnit;
  thickness: number;
  newId: () => string;
  wallType?: WallType;
  /** Directions a run may be straightened to. An empty list keeps every angle as drawn. */
  snapAngles?: number[];
  /** How far off horizontal or vertical a run may be and still be straightened. */
  angleToleranceDeg?: number;
  /** The same for the other snap angles (diagonals). */
  diagonalToleranceDeg?: number;
  /** Wobble smaller than this is ignored. */
  simplifyTolerance?: number;
  /** A stroke end this close to an existing corner, crossing or wall joins it. */
  endpointTolerance?: number;
  /** A stroke whose two ends are this close is closed into a loop. 0 never closes. */
  closeTolerance?: number;
  /** Shortest wall that is kept. */
  minSegment?: number;
  /** Grid step for wall positions. 0 leaves them where the stroke put them. */
  grid?: number;
  /** A correction that moves the stroke further than this is flagged for review. */
  reviewTolerance?: number;
}

export type SketchCorrection =
  | { kind: 'straightened'; count: number }
  | { kind: 'joined'; count: number }
  | { kind: 'closed'; gap: number }
  | { kind: 'overlap-removed'; count: number };

export interface SketchResult {
  /** New walls to add. Empty when the stroke was too short or is already on the plan. */
  walls: FloorPlanWall[];
  /** Corners of the interpreted stroke, before overlaps with existing walls were cut away. */
  vertices: Pt[];
  closed: boolean;
  corrections: SketchCorrection[];
  /** Furthest any part of the stroke was moved, in plan units. */
  maxShift: number;
  /** True when a correction is large enough that the user should confirm it. */
  needsReview: boolean;
  /** Why there are no walls, when there are none. */
  empty?: 'too-short' | 'duplicate';
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
/** Removes floating-point fuzz (11.999999999998 -> 12). Far below any real measurement. */
const clean = (v: number) => Math.round(v * 1e9) / 1e9;

export function pointSegmentDistance(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return dist(p, a);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function polylineLength(points: Pt[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += dist(points[i - 1], points[i]);
  return total;
}

/**
 * Ramer-Douglas-Peucker. Returns the indices of the points that are kept; the first and last
 * point always are.
 */
export function simplifyStrokeIndices(points: Pt[], tolerance: number): number[] {
  const n = points.length;
  if (n <= 2) return points.map((_, i) => i);
  const keep = new Uint8Array(n);
  keep[0] = 1;
  keep[n - 1] = 1;
  const stack: [number, number][] = [[0, n - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    let worst = -1;
    let worstD = tolerance;
    for (let i = a + 1; i < b; i++) {
      const d = pointSegmentDistance(points[i], points[a], points[b]);
      if (d > worstD) { worstD = d; worst = i; }
    }
    if (worst >= 0) {
      keep[worst] = 1;
      stack.push([a, worst], [worst, b]);
    }
  }
  const out: number[] = [];
  for (let i = 0; i < n; i++) if (keep[i]) out.push(i);
  return out;
}

export const simplifyStroke = (points: Pt[], tolerance: number): Pt[] =>
  simplifyStrokeIndices(points, tolerance).map(i => points[i]);

/** Direction of a line through a and b as an angle in [0, 180). */
export function directionDeg(a: Pt, b: Pt): number {
  const d = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
  return ((d % 180) + 180) % 180;
}

const directionGap = (a: number, b: number) => {
  const d = Math.abs(a - b) % 180;
  return Math.min(d, 180 - d);
};

/**
 * The allowed direction a run is straightened to, or null when it is not close enough to any.
 * Horizontal and vertical use `orthoTolerance`; every other angle uses `diagonalTolerance`.
 */
export function snapDirection(deg: number, angles: number[], orthoTolerance: number, diagonalTolerance: number): number | null {
  let best: number | null = null;
  let bestGap = Infinity;
  for (const raw of angles) {
    const angle = ((raw % 180) + 180) % 180;
    const gap = directionGap(deg, angle);
    if (gap <= (angle % 90 === 0 ? orthoTolerance : diagonalTolerance) && gap < bestGap) {
      bestGap = gap;
      best = angle;
    }
  }
  return best;
}

/** Unit vector for a direction. The common angles are exact, so no 1e-17 creeps into corners. */
function unitFor(deg: number): Pt {
  const a = ((deg % 180) + 180) % 180;
  if (a === 0) return { x: 1, y: 0 };
  if (a === 90) return { x: 0, y: 1 };
  if (a === 45) return { x: Math.SQRT1_2, y: Math.SQRT1_2 };
  if (a === 135) return { x: -Math.SQRT1_2, y: Math.SQRT1_2 };
  const r = (a * Math.PI) / 180;
  return { x: Math.cos(r), y: Math.sin(r) };
}

function intersectLines(p1: Pt, u1: Pt, p2: Pt, u2: Pt): Pt | null {
  const cross = u1.x * u2.y - u1.y * u2.x;
  if (Math.abs(cross) < 1e-6) return null;
  const t = ((p2.x - p1.x) * u2.y - (p2.y - p1.y) * u2.x) / cross;
  return { x: p1.x + t * u1.x, y: p1.y + t * u1.y };
}

const projectOnLine = (p: Pt, origin: Pt, u: Pt): Pt => {
  const t = (p.x - origin.x) * u.x + (p.y - origin.y) * u.y;
  return { x: origin.x + t * u.x, y: origin.y + t * u.y };
};

type Line4 = Pick<FloorPlanWall, 'x1' | 'y1' | 'x2' | 'y2'>;

/** Points where two walls cross away from their ends. A new wall can join there too. */
export function wallCrossings(walls: Line4[]): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < walls.length; i++) {
    for (let j = i + 1; j < walls.length; j++) {
      const a = walls[i], b = walls[j];
      const d1x = a.x2 - a.x1, d1y = a.y2 - a.y1, d2x = b.x2 - b.x1, d2y = b.y2 - b.y1;
      const denom = d1x * d2y - d1y * d2x;
      if (Math.abs(denom) < 1e-9) continue;
      const t = ((b.x1 - a.x1) * d2y - (b.y1 - a.y1) * d2x) / denom;
      const u = ((b.x1 - a.x1) * d1y - (b.y1 - a.y1) * d1x) / denom;
      if (t <= 0 || t >= 1 || u <= 0 || u >= 1) continue;
      out.push({ x: a.x1 + t * d1x, y: a.y1 + t * d1y });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Overlap with walls that already exist
// ---------------------------------------------------------------------------

/**
 * The parts of segment a-b that do not lie on top of any of `walls`. A wall counts as "on top"
 * when it runs along the same line (within `tolerance`) and shares more than a touching end.
 * Pieces shorter than `minPiece` are dropped.
 */
export function subtractCoveredSpans(a: Pt, b: Pt, walls: Line4[], tolerance: number, minPiece: number): { a: Pt; b: Pt }[] {
  const length = dist(a, b);
  if (length <= 0) return [];
  const ux = (b.x - a.x) / length, uy = (b.y - a.y) / length;
  const covered: [number, number][] = [];
  for (const w of walls) {
    const off1 = Math.abs((w.x1 - a.x) * uy - (w.y1 - a.y) * ux);
    const off2 = Math.abs((w.x2 - a.x) * uy - (w.y2 - a.y) * ux);
    if (off1 > tolerance || off2 > tolerance) continue;
    const t1 = (w.x1 - a.x) * ux + (w.y1 - a.y) * uy;
    const t2 = (w.x2 - a.x) * ux + (w.y2 - a.y) * uy;
    const from = Math.max(0, Math.min(t1, t2));
    const to = Math.min(length, Math.max(t1, t2));
    if (to - from > tolerance) covered.push([from, to]);
  }
  if (covered.length === 0) return [{ a, b }];
  covered.sort((p, q) => p[0] - q[0]);
  const pieces: { a: Pt; b: Pt }[] = [];
  const at = (t: number): Pt => (t <= 0 ? a : t >= length ? b : { x: clean(a.x + ux * t), y: clean(a.y + uy * t) });
  let cursor = 0;
  for (const [from, to] of covered) {
    if (from - cursor >= minPiece) pieces.push({ a: at(cursor), b: at(from) });
    cursor = Math.max(cursor, to);
  }
  if (length - cursor >= minPiece) pieces.push({ a: at(cursor), b: at(length) });
  return pieces;
}

/**
 * What is left of a new wall once the parts already covered by existing walls are removed.
 * An empty list means the wall is a duplicate and should not be added.
 */
export function trimNewWall(wall: FloorPlanWall, existing: FloorPlanWall[], unit: FloorPlanUnit, newId: () => string): FloorPlanWall[] {
  const tolerance = joinTolerance(unit);
  const pieces = subtractCoveredSpans({ x: wall.x1, y: wall.y1 }, { x: wall.x2, y: wall.y2 }, existing, tolerance, tolerance * 2);
  if (pieces.length === 1 && pieces[0].a.x === wall.x1 && pieces[0].a.y === wall.y1 && pieces[0].b.x === wall.x2 && pieces[0].b.y === wall.y2) return [wall];
  return pieces.map((p, i) => ({ ...wall, id: i === 0 ? wall.id : newId(), x1: p.a.x, y1: p.a.y, x2: p.b.x, y2: p.b.y }));
}

// ---------------------------------------------------------------------------
// Stroke -> walls
// ---------------------------------------------------------------------------

/** One straight run of the stroke: its two ends and the length-weighted centre of its points. */
interface Run {
  a: Pt;
  b: Pt;
  cx: number;
  cy: number;
  w: number;
  snapped: number | null;
}

const runLength = (r: Run) => dist(r.a, r.b);
const runHeading = (r: Run) => Math.atan2(r.b.y - r.a.y, r.b.x - r.a.x);

/** Change of heading from one run to the next: 0 = straight on, 180 = doubling back. */
function turnDeg(a: Run, b: Run): number {
  let d = Math.abs(runHeading(b) - runHeading(a)) * (180 / Math.PI);
  if (d > 180) d = 360 - d;
  return d;
}

const joinRuns = (first: Run, last: Run, snapped: number | null = null): Run => ({
  a: first.a, b: last.b, cx: first.cx + last.cx, cy: first.cy + last.cy, w: first.w + last.w, snapped,
});

function buildRun(points: Pt[], from: number, to: number): Run {
  let cx = 0, cy = 0, w = 0;
  for (let i = from; i < to; i++) {
    const len = dist(points[i], points[i + 1]);
    cx += ((points[i].x + points[i + 1].x) / 2) * len;
    cy += ((points[i].y + points[i + 1].y) / 2) * len;
    w += len;
  }
  return { a: points[from], b: points[to], cx, cy, w, snapped: null };
}

/**
 * Joins runs that continue in (almost) the same direction, and removes short jogs between
 * two runs that do. `same` decides whether two neighbours are one wall.
 */
function mergeRuns(runs: Run[], ring: boolean, same: (a: Run, b: Run) => boolean, jogLength: number): Run[] {
  let list = runs;
  for (let guard = 0; guard < 500; guard++) {
    const n = list.length;
    if (n <= (ring ? 3 : 1)) break;
    let next: Run[] | null = null;
    const pairs = ring ? n : n - 1;
    for (let i = 0; i < pairs && !next; i++) {
      const j = (i + 1) % n;
      if (!same(list[i], list[j])) continue;
      const merged = joinRuns(list[i], list[j], list[i].snapped);
      next = j === 0 ? [merged, ...list.slice(1, n - 1)] : [...list.slice(0, i), merged, ...list.slice(j + 1)];
    }
    if (!next && jogLength > 0 && n >= (ring ? 5 : 3)) {
      const first = ring ? 0 : 1;
      const last = ring ? n - 1 : n - 2;
      for (let i = first; i <= last && !next; i++) {
        const p = (i - 1 + n) % n, q = (i + 1) % n;
        if (runLength(list[i]) >= jogLength || !same(list[p], list[q])) continue;
        const merged: Run = {
          a: list[p].a, b: list[q].b, snapped: list[p].snapped,
          cx: list[p].cx + list[q].cx, cy: list[p].cy + list[q].cy, w: list[p].w + list[q].w,
        };
        if (!ring) next = [...list.slice(0, p), merged, ...list.slice(q + 1)];
        else {
          // Keep ring order: everything except p, i and q, with the merged run in p's place.
          const rest: Run[] = [];
          for (let k = 1; k <= n - 3; k++) rest.push(list[(q + k) % n]);
          next = [merged, ...rest];
        }
      }
    }
    if (!next) break;
    list = next;
  }
  return list;
}

const emptyResult = (empty: SketchResult['empty']): SketchResult => ({
  walls: [], vertices: [], closed: false, corrections: [], maxShift: 0, needsReview: false, empty,
});

/**
 * Interprets one freehand stroke as connected straight walls. See the notes at the top of
 * this file. `existing` is only read.
 */
export function interpretStroke(raw: Pt[], existing: FloorPlanWall[], opts: SketchOptions): SketchResult {
  const points: Pt[] = [];
  for (const p of raw) {
    if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
    const prev = points[points.length - 1];
    if (!prev || prev.x !== p.x || prev.y !== p.y) points.push({ x: p.x, y: p.y });
  }
  if (points.length < 2) return emptyResult('too-short');

  const feet = baseUnitOf(opts.unit) === 'feet';
  const minSegment = opts.minSegment ?? (feet ? 1 : 0.3);
  const endTol = opts.endpointTolerance ?? (feet ? 1.5 : 0.45);
  const xs = points.map(p => p.x), ys = points.map(p => p.y);
  const diagonal = Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  const pathLength = polylineLength(points);
  if (pathLength < minSegment || diagonal < minSegment * 0.75) return emptyResult('too-short');

  const simplifyTol = Math.max(opts.simplifyTolerance ?? joinTolerance(opts.unit) * 2, diagonal * 0.025);
  const angles = opts.snapAngles ?? DEFAULT_SNAP_ANGLES;
  const orthoTol = opts.angleToleranceDeg ?? 20;
  const diagTol = opts.diagonalToleranceDeg ?? Math.min(orthoTol, 12);
  const grid = opts.grid && opts.grid > 0 ? opts.grid : 0;
  const reviewTol = opts.reviewTolerance ?? Math.max(endTol * 1.5, diagonal * 0.1);

  // ── Open stroke or closed loop? ──────────────────────────────────────────
  const last = points.length - 1;
  const gap = dist(points[0], points[last]);
  const closeTol = opts.closeTolerance ?? Math.max(endTol, diagonal * 0.18);
  let closed = closeTol > 0 && points.length >= 6 && gap <= closeTol &&
    pathLength >= Math.max(minSegment * 4, gap * 4) && polygonArea(points) >= minSegment * minSegment;

  // ── 1. Remove wobble ─────────────────────────────────────────────────────
  let runs: Run[] = [];
  if (closed) {
    // Split the loop at the point furthest from where it began, then simplify both halves.
    let far = 1, farD = -1;
    for (let i = 1; i < last; i++) {
      const d = dist(points[i], points[0]);
      if (d > farD) { farD = d; far = i; }
    }
    const first = simplifyStrokeIndices(points.slice(0, far + 1), simplifyTol);
    const second = simplifyStrokeIndices(points.slice(far), simplifyTol).map(i => i + far);
    const idx = [...first, ...second.slice(1)];
    for (let i = 0; i + 1 < idx.length; i++) runs.push(buildRun(points, idx[i], idx[i + 1]));
    // The loop's two loose ends become one corner, halfway between them.
    const seam: Pt = { x: (points[0].x + points[last].x) / 2, y: (points[0].y + points[last].y) / 2 };
    runs[0] = { ...runs[0], a: seam };
    runs[runs.length - 1] = { ...runs[runs.length - 1], b: seam };
  } else {
    const idx = simplifyStrokeIndices(points, simplifyTol);
    for (let i = 0; i + 1 < idx.length; i++) runs.push(buildRun(points, idx[i], idx[i + 1]));
    // A small hook where the finger landed or lifted is not a wall.
    while (runs.length > 1 && runLength(runs[0]) < minSegment) runs = runs.slice(1);
    while (runs.length > 1 && runLength(runs[runs.length - 1]) < minSegment) runs = runs.slice(0, -1);
  }
  runs = runs.filter(r => runLength(r) > 1e-9);
  if (runs.length === 0) return emptyResult('too-short');

  const jog = Math.max(minSegment, simplifyTol * 1.5);
  runs = mergeRuns(runs, closed, (a, b) => turnDeg(a, b) < 18, jog);
  if (closed && runs.length < 3) closed = false;

  // ── 2. Straighten each run to an allowed angle ───────────────────────────
  let straightened = 0;
  for (const run of runs) {
    const drawn = directionDeg(run.a, run.b);
    run.snapped = angles.length ? snapDirection(drawn, angles, orthoTol, diagTol) : null;
  }
  runs = mergeRuns(runs, closed, (a, b) => a.snapped !== null && a.snapped === b.snapped && turnDeg(a, b) < 90, jog);
  if (closed && runs.length < 3) closed = false;
  for (const run of runs) {
    if (run.snapped !== null && directionGap(directionDeg(run.a, run.b), run.snapped) > 0.5) straightened += 1;
  }

  // ── 3. Fit a line to each run ────────────────────────────────────────────
  const n = runs.length;
  const lines = runs.map(run => {
    const chord = runLength(run) || 1;
    let u: Pt = run.snapped !== null ? unitFor(run.snapped) : { x: (run.b.x - run.a.x) / chord, y: (run.b.y - run.a.y) / chord };
    if (u.x * (run.b.x - run.a.x) + u.y * (run.b.y - run.a.y) < 0) u = { x: -u.x, y: -u.y };
    const p: Pt = run.w > 0 ? { x: run.cx / run.w, y: run.cy / run.w } : { x: (run.a.x + run.b.x) / 2, y: (run.a.y + run.b.y) / 2 };
    return { p, u, fixed: false };
  });

  const joinPoints: Pt[] = [...existing.flatMap(w => [{ x: w.x1, y: w.y1 }, { x: w.x2, y: w.y2 }]), ...wallCrossings(existing)];
  const nearestJoin = (to: Pt, within: number): Pt | null => {
    let best: Pt | null = null;
    let bestD = within;
    for (const j of joinPoints) {
      const d = dist(j, to);
      if (d <= bestD) { bestD = d; best = j; }
    }
    return best;
  };

  // Stroke ends that land on an existing corner or crossing are fixed there first, so the
  // lines are fitted through them rather than beside them.
  let joined = 0;
  let startJoin: Pt | null = null;
  let endJoin: Pt | null = null;
  if (!closed) {
    startJoin = nearestJoin(points[0], endTol);
    endJoin = nearestJoin(points[last], endTol);
    if (startJoin && endJoin && dist(startJoin, endJoin) < minSegment) endJoin = null;
    if (n === 1 && startJoin && endJoin) {
      // One run between two existing corners: it simply connects them.
      const len = dist(startJoin, endJoin);
      lines[0] = { p: startJoin, u: { x: (endJoin.x - startJoin.x) / len, y: (endJoin.y - startJoin.y) / len }, fixed: true };
      runs[0].snapped = null;
    } else {
      if (startJoin) { lines[0].p = startJoin; lines[0].fixed = true; }
      if (endJoin) { lines[n - 1].p = endJoin; lines[n - 1].fixed = true; }
    }
  }

  // Horizontal and vertical runs line up with existing corners nearby, otherwise with the grid.
  const alignTol = endTol * 0.6;
  lines.forEach((line, i) => {
    const snapped = runs[i].snapped;
    if (line.fixed || (snapped !== 0 && snapped !== 90)) return;
    const axis: 'x' | 'y' = snapped === 0 ? 'y' : 'x';
    let best: number | null = null;
    let bestD = alignTol;
    for (const j of joinPoints) {
      const d = Math.abs(j[axis] - line.p[axis]);
      if (d <= bestD) { bestD = d; best = j[axis]; }
    }
    if (best !== null) line.p = { ...line.p, [axis]: best };
    else if (grid) line.p = { ...line.p, [axis]: Math.round(line.p[axis] / grid) * grid };
  });

  // ── 4. Corners are where neighbouring lines cross ────────────────────────
  const vertexCount = closed ? n : n + 1;
  const vertices: Pt[] = new Array(vertexCount);
  const cornerBetween = (i: number, j: number, drawn: Pt): Pt => {
    const hit = intersectLines(lines[i].p, lines[i].u, lines[j].p, lines[j].u);
    const limit = Math.max(simplifyTol * 3, endTol * 2, 0.5 * Math.min(runLength(runs[i]), runLength(runs[j])));
    if (hit && dist(hit, drawn) <= limit) return hit;
    const longer = runLength(runs[i]) >= runLength(runs[j]) ? i : j;
    return projectOnLine(drawn, lines[longer].p, lines[longer].u);
  };
  if (closed) {
    for (let i = 0; i < n; i++) vertices[i] = cornerBetween((i - 1 + n) % n, i, runs[i].a);
  } else {
    for (let i = 1; i < n; i++) vertices[i] = cornerBetween(i - 1, i, runs[i].a);
    vertices[0] = startJoin ?? projectOnLine(points[0], lines[0].p, lines[0].u);
    vertices[n] = endJoin ?? projectOnLine(points[last], lines[n - 1].p, lines[n - 1].u);

    // A free end stops on the wall it reaches, or on the grid.
    const settleEnd = (index: number, runIndex: number, already: Pt | null) => {
      if (already) { joined += 1; return; }
      const end = vertices[index];
      const line = lines[runIndex];
      let best: Pt | null = null;
      let bestD = endTol;
      for (const w of existing) {
        const len = wallLengthOf(w);
        if (len <= 0) continue;
        const wu = { x: (w.x2 - w.x1) / len, y: (w.y2 - w.y1) / len };
        if (Math.abs(wu.x * line.u.y - wu.y * line.u.x) < 0.25) continue; // nearly parallel
        const d = pointSegmentDistance(end, { x: w.x1, y: w.y1 }, { x: w.x2, y: w.y2 });
        if (d > bestD) continue;
        const hit = intersectLines(line.p, line.u, { x: w.x1, y: w.y1 }, wu);
        if (!hit || dist(hit, end) > endTol * 2) continue;
        const t = (hit.x - w.x1) * wu.x + (hit.y - w.y1) * wu.y;
        if (t < -1e-6 || t > len + 1e-6) continue;
        bestD = d;
        best = hit;
      }
      if (best) { vertices[index] = best; joined += 1; return; }
      const snapped = runs[runIndex].snapped;
      if (grid && (snapped === 0 || snapped === 90)) {
        const along: 'x' | 'y' = snapped === 0 ? 'x' : 'y';
        vertices[index] = { ...end, [along]: Math.round(end[along] / grid) * grid };
      }
    };
    settleEnd(0, 0, startJoin);
    settleEnd(n, n - 1, endJoin);
  }

  // Horizontal and vertical walls are exactly so, not off by a rounding hair.
  for (let i = 0; i < n; i++) {
    const a = i, b = closed ? (i + 1) % n : i + 1;
    const snapped = runs[i].snapped;
    if (snapped === 0) {
      vertices[a] = { x: vertices[a].x, y: lines[i].p.y };
      vertices[b] = { x: vertices[b].x, y: lines[i].p.y };
    } else if (snapped === 90) {
      vertices[a] = { x: lines[i].p.x, y: vertices[a].y };
      vertices[b] = { x: lines[i].p.x, y: vertices[b].y };
    }
  }
  for (let i = 0; i < vertexCount; i++) {
    const keepExact = (i === 0 && startJoin) || (i === vertexCount - 1 && endJoin);
    if (!keepExact) vertices[i] = { x: clean(vertices[i].x), y: clean(vertices[i].y) };
  }

  // ── How far was the stroke moved? ────────────────────────────────────────
  const segments: [Pt, Pt][] = [];
  for (let i = 0; i < n; i++) segments.push([vertices[i], vertices[closed ? (i + 1) % n : i + 1]]);
  let maxShift = 0;
  for (const p of points) {
    let nearest = Infinity;
    for (const [a, b] of segments) nearest = Math.min(nearest, pointSegmentDistance(p, a, b));
    maxShift = Math.max(maxShift, nearest);
  }
  if (!closed) maxShift = Math.max(maxShift, dist(points[0], vertices[0]), dist(points[last], vertices[n]));

  // ── 5. Build the walls, without anything that is already on the plan ─────
  const overlapTol = joinTolerance(opts.unit);
  const walls: FloorPlanWall[] = [];
  let overlapRemoved = 0;
  for (const [a, b] of segments) {
    if (dist(a, b) < minSegment * 0.5) continue;
    const pieces = subtractCoveredSpans(a, b, [...existing, ...walls], overlapTol, minSegment * 0.5);
    if (pieces.length !== 1 || pieces[0].a !== a || pieces[0].b !== b) overlapRemoved += 1;
    for (const piece of pieces) {
      walls.push({
        id: opts.newId(),
        x1: piece.a.x, y1: piece.a.y, x2: piece.b.x, y2: piece.b.y,
        thickness: opts.thickness,
        wallType: opts.wallType ?? 'exterior',
        layer: 'walls',
      });
    }
  }

  const corrections: SketchCorrection[] = [];
  if (straightened > 0) corrections.push({ kind: 'straightened', count: straightened });
  if (joined > 0) corrections.push({ kind: 'joined', count: joined });
  if (closed) corrections.push({ kind: 'closed', gap });
  if (overlapRemoved > 0) corrections.push({ kind: 'overlap-removed', count: overlapRemoved });

  return {
    walls,
    vertices,
    closed,
    corrections,
    maxShift,
    needsReview: walls.length > 0 && (maxShift > reviewTol || (closed && gap > endTol)),
    empty: walls.length === 0 ? 'duplicate' : undefined,
  };
}

/** One line for the user about what a stroke became, e.g. "4 walls · straightened · room closed". */
export function describeSketch(result: SketchResult, formatLength: (value: number) => string): string {
  if (result.walls.length === 0) {
    return result.empty === 'duplicate' ? 'Those walls are already on the plan.' : 'That stroke was too short to be a wall.';
  }
  const parts = [`${result.walls.length} wall${result.walls.length === 1 ? '' : 's'}`];
  for (const c of result.corrections) {
    if (c.kind === 'straightened') parts.push('straightened');
    else if (c.kind === 'joined') parts.push(c.count === 1 ? 'joined to a corner' : 'joined at both ends');
    else if (c.kind === 'closed') parts.push(c.gap > 0.01 ? `closed a ${formatLength(c.gap)} gap` : 'closed');
    else if (c.kind === 'overlap-removed') parts.push('overlap removed');
  }
  return parts.join(' · ');
}
