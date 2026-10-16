/**
 * Floor-plan geometry: units, rooms derived from connected walls, joined-wall editing.
 *
 * COORDINATE SYSTEM
 *   Plan coordinates are plain numbers in the plan's BASE unit:
 *     - feet   for plans in 'feet' (and the legacy 'inches' display option)
 *     - metres for plans in 'meters' (and the legacy 'centimeters' display option)
 *   x grows to the right, y grows downward (screen convention). One unit on the plan is one
 *   foot or one metre on site; nothing is scaled or rounded when stored.
 *
 * A plan drawn here is a conceptual layout. It is not a certified structural or
 * architectural drawing.
 */
import type { FloorPlanDoor, FloorPlanRoom, FloorPlanUnit, FloorPlanWall, FloorPlanWindow } from '../db/types';

// ---------------------------------------------------------------------------
// Units
// ---------------------------------------------------------------------------

export type BaseUnit = 'feet' | 'meters';

/** Exact by definition (international foot). */
export const METERS_PER_FOOT = 0.3048;
export const SQM_PER_SQFT = METERS_PER_FOOT * METERS_PER_FOOT; // 0.09290304

export function baseUnitOf(unit: FloorPlanUnit): BaseUnit {
  return unit === 'meters' || unit === 'centimeters' ? 'meters' : 'feet';
}

export function lengthToMeters(value: number, unit: FloorPlanUnit): number {
  return baseUnitOf(unit) === 'feet' ? value * METERS_PER_FOOT : value;
}

export function lengthFromMeters(meters: number, unit: FloorPlanUnit): number {
  return baseUnitOf(unit) === 'feet' ? meters / METERS_PER_FOOT : meters;
}

export function lengthToFeet(value: number, unit: FloorPlanUnit): number {
  return baseUnitOf(unit) === 'feet' ? value : value / METERS_PER_FOOT;
}

export function areaToSqM(area: number, unit: FloorPlanUnit): number {
  return baseUnitOf(unit) === 'feet' ? area * SQM_PER_SQFT : area;
}

export function areaToSqFt(area: number, unit: FloorPlanUnit): number {
  return baseUnitOf(unit) === 'feet' ? area : area / SQM_PER_SQFT;
}

export function mmToPlan(mm: number, unit: FloorPlanUnit): number {
  return lengthFromMeters(mm / 1000, unit);
}

export function planToMm(value: number, unit: FloorPlanUnit): number {
  return lengthToMeters(value, unit) * 1000;
}

/** 12.5 ft -> 12'-6". Rounds to the nearest inch and carries 12 inches into the next foot. */
export function formatFeetInches(feet: number): string {
  const sign = feet < 0 ? '-' : '';
  const totalInches = Math.round(Math.abs(feet) * 12);
  return `${sign}${Math.floor(totalInches / 12)}'-${totalInches % 12}"`;
}

/** Length as the user reads it for this plan's unit. */
export function formatPlanLength(value: number, unit: FloorPlanUnit): string {
  switch (unit) {
    case 'feet': return formatFeetInches(value);
    case 'inches': return `${Math.round(value * 12)}"`;
    case 'centimeters': return `${Math.round(value * 100)} cm`;
    default: return `${value.toFixed(2)} m`;
  }
}

/** Area in the plan's own system, with the other system in brackets. */
export function formatPlanArea(area: number, unit: FloorPlanUnit): string {
  const sqFt = areaToSqFt(area, unit);
  const sqM = areaToSqM(area, unit);
  return baseUnitOf(unit) === 'feet'
    ? `${sqFt.toFixed(1)} sq.ft (${sqM.toFixed(1)} m²)`
    : `${sqM.toFixed(2)} m² (${sqFt.toFixed(1)} sq.ft)`;
}

// ---------------------------------------------------------------------------
// Basic geometry
// ---------------------------------------------------------------------------

export interface Pt { x: number; y: number }

export const wallLengthOf = (w: Pick<FloorPlanWall, 'x1' | 'y1' | 'x2' | 'y2'>) => Math.hypot(w.x2 - w.x1, w.y2 - w.y1);

/** Shoelace formula. Positive when the points run clockwise on screen (y down). */
export function signedPolygonArea(points: Pt[]): number {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return sum / 2;
}

export const polygonArea = (points: Pt[]) => Math.abs(signedPolygonArea(points));

export function polygonPerimeter(points: Pt[]): number {
  let p = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    p += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return p;
}

export function polygonCentroid(points: Pt[]): Pt {
  const a = signedPolygonArea(points);
  if (Math.abs(a) < 1e-9) {
    return { x: points.reduce((s, p) => s + p.x, 0) / points.length, y: points.reduce((s, p) => s + p.y, 0) / points.length };
  }
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const q = points[(i + 1) % points.length];
    const cross = p.x * q.y - q.x * p.y;
    cx += (p.x + q.x) * cross;
    cy += (p.y + q.y) * cross;
  }
  return { x: cx / (6 * a), y: cy / (6 * a) };
}

export function pointInPolygon(pt: Pt, points: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i];
    const b = points[j];
    if (a.y > pt.y !== b.y > pt.y && pt.x < ((b.x - a.x) * (pt.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/** Area of a room from its own outline: polygon when it has one, otherwise width x height. */
export function roomArea(room: Pick<FloorPlanRoom, 'width' | 'height' | 'polygonPoints'>): number {
  return room.polygonPoints && room.polygonPoints.length >= 3 ? polygonArea(room.polygonPoints) : Math.abs(room.width * room.height);
}

export function roomPerimeter(room: Pick<FloorPlanRoom, 'width' | 'height' | 'polygonPoints'>): number {
  return room.polygonPoints && room.polygonPoints.length >= 3
    ? polygonPerimeter(room.polygonPoints)
    : 2 * (Math.abs(room.width) + Math.abs(room.height));
}

// ---------------------------------------------------------------------------
// Rooms from connected walls
// ---------------------------------------------------------------------------

export interface WallFace {
  points: Pt[];       // outline, collinear points removed
  area: number;
  perimeter: number;
  centroid: Pt;
  wallIds: string[];  // walls that bound this space
}

/** Walls whose ends are this close are treated as joined. In plan units. */
export function joinTolerance(unit: FloorPlanUnit): number {
  return baseUnitOf(unit) === 'feet' ? 0.3 : 0.09;
}

/** Smallest enclosed space reported as a room: about 1 sq.m. */
export function minimumRoomArea(unit: FloorPlanUnit): number {
  return baseUnitOf(unit) === 'feet' ? 10 : 1;
}

/**
 * Finds every enclosed space formed by the wall centre-lines.
 *
 * Works for rooms of any shape, for rooms that share walls, and for walls that meet another
 * wall partway along it (T-junctions) or cross it. Walls that do not close a loop are ignored.
 */
export function findWallFaces(walls: FloorPlanWall[], tolerance: number, minArea: number): WallFace[] {
  const segs = walls.filter(w => wallLengthOf(w) > tolerance);
  if (segs.length < 3) return [];

  // 1. Nodes: endpoints clustered within the tolerance.
  const nodes: Pt[] = [];
  const nodeAt = (x: number, y: number): number => {
    for (let i = 0; i < nodes.length; i++) if (Math.hypot(nodes[i].x - x, nodes[i].y - y) <= tolerance) return i;
    nodes.push({ x, y });
    return nodes.length - 1;
  };
  for (const w of segs) { nodeAt(w.x1, w.y1); nodeAt(w.x2, w.y2); }

  // Crossings also become nodes so that crossing walls divide the space.
  for (let i = 0; i < segs.length; i++) {
    for (let j = i + 1; j < segs.length; j++) {
      const p = segmentIntersection(segs[i], segs[j]);
      if (p) nodeAt(p.x, p.y);
    }
  }

  // 2. Edges: each wall split at every node lying on it.
  const edgeKeys = new Set<string>();
  const edges: { a: number; b: number; wallId: string }[] = [];
  for (const w of segs) {
    const len = wallLengthOf(w);
    const ux = (w.x2 - w.x1) / len;
    const uy = (w.y2 - w.y1) / len;
    const onWall: { t: number; node: number }[] = [];
    for (let n = 0; n < nodes.length; n++) {
      const dx = nodes[n].x - w.x1;
      const dy = nodes[n].y - w.y1;
      const t = dx * ux + dy * uy;
      const off = Math.abs(dx * uy - dy * ux);
      if (off <= tolerance && t >= -tolerance && t <= len + tolerance) onWall.push({ t, node: n });
    }
    onWall.sort((p, q) => p.t - q.t);
    for (let k = 0; k + 1 < onWall.length; k++) {
      const a = onWall[k].node;
      const b = onWall[k + 1].node;
      if (a === b) continue;
      const key = a < b ? `${a}:${b}` : `${b}:${a}`;
      if (edgeKeys.has(key)) continue;
      edgeKeys.add(key);
      edges.push({ a, b, wallId: w.id });
    }
  }

  // 3. Drop dead ends: an edge with a free end cannot enclose anything.
  let live = edges;
  for (;;) {
    const degree = new Map<number, number>();
    for (const e of live) { degree.set(e.a, (degree.get(e.a) || 0) + 1); degree.set(e.b, (degree.get(e.b) || 0) + 1); }
    const pruned = live.filter(e => (degree.get(e.a) || 0) > 1 && (degree.get(e.b) || 0) > 1);
    if (pruned.length === live.length) break;
    live = pruned;
  }
  if (live.length < 3) return [];

  // 4. Walk the faces. At each node take the next edge clockwise from the one we arrived on.
  type Half = { from: number; to: number; wallId: string; angle: number; used: boolean };
  const halves: Half[] = [];
  const outgoing = new Map<number, Half[]>();
  for (const e of live) {
    for (const [from, to] of [[e.a, e.b], [e.b, e.a]] as const) {
      const h: Half = { from, to, wallId: e.wallId, angle: Math.atan2(nodes[to].y - nodes[from].y, nodes[to].x - nodes[from].x), used: false };
      halves.push(h);
      if (!outgoing.has(from)) outgoing.set(from, []);
      outgoing.get(from)!.push(h);
    }
  }
  for (const list of outgoing.values()) list.sort((p, q) => p.angle - q.angle);

  const faces: WallFace[] = [];
  for (const start of halves) {
    if (start.used) continue;
    const loop: Half[] = [];
    let h = start;
    let guard = 0;
    while (!h.used && guard++ < halves.length + 2) {
      h.used = true;
      loop.push(h);
      const around = outgoing.get(h.to)!;
      const back = around.findIndex(o => o.to === h.from);
      h = around[(back - 1 + around.length) % around.length];
    }
    if (loop.length < 3) continue;
    const raw = loop.map(x => nodes[x.from]);
    // Interior faces come out with a positive signed area; the outside boundary is negative.
    if (signedPolygonArea(raw) <= 0) continue;
    const points = dropCollinear(raw, tolerance / 4);
    const area = polygonArea(points);
    if (points.length < 3 || area < minArea) continue;
    faces.push({
      points,
      area,
      perimeter: polygonPerimeter(points),
      centroid: polygonCentroid(points),
      wallIds: Array.from(new Set(loop.map(x => x.wallId))),
    });
  }
  return faces.sort((p, q) => p.centroid.y - q.centroid.y || p.centroid.x - q.centroid.x);
}

function segmentIntersection(a: FloorPlanWall, b: FloorPlanWall): Pt | null {
  const d1x = a.x2 - a.x1, d1y = a.y2 - a.y1, d2x = b.x2 - b.x1, d2y = b.y2 - b.y1;
  const denom = d1x * d2y - d1y * d2x;
  if (Math.abs(denom) < 1e-9) return null; // parallel
  const t = ((b.x1 - a.x1) * d2y - (b.y1 - a.y1) * d2x) / denom;
  const u = ((b.x1 - a.x1) * d1y - (b.y1 - a.y1) * d1x) / denom;
  if (t <= 0 || t >= 1 || u <= 0 || u >= 1) return null;
  return { x: a.x1 + t * d1x, y: a.y1 + t * d1y };
}

function dropCollinear(points: Pt[], eps: number): Pt[] {
  const out: Pt[] = [];
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const prev = points[(i - 1 + n) % n];
    const cur = points[i];
    const next = points[(i + 1) % n];
    const len = Math.hypot(next.x - prev.x, next.y - prev.y) || 1;
    const off = Math.abs((next.x - prev.x) * (cur.y - prev.y) - (next.y - prev.y) * (cur.x - prev.x)) / len;
    if (off > eps) out.push({ x: cur.x, y: cur.y });
  }
  return out;
}

export interface RoomSyncResult {
  rooms: FloorPlanRoom[];
  added: FloorPlanRoom[];
  removed: FloorPlanRoom[];
  changed: boolean;
}

const round4 = (n: number) => Math.round(n * 10000) / 10000;

function faceToRoomGeometry(face: WallFace) {
  const xs = face.points.map(p => p.x);
  const ys = face.points.map(p => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return {
    x: round4(x),
    y: round4(y),
    width: round4(Math.max(...xs) - x),
    height: round4(Math.max(...ys) - y),
    polygonPoints: face.points.map(p => ({ x: round4(p.x), y: round4(p.y) })),
    area: round4(face.area),
    perimeter: round4(face.perimeter),
    shapeType: (face.points.length === 4 ? 'rectangle' : 'polygon') as FloorPlanRoom['shapeType'],
  };
}

const centreOf = (r: FloorPlanRoom): Pt =>
  r.polygonPoints && r.polygonPoints.length >= 3 ? polygonCentroid(r.polygonPoints) : { x: r.x + r.width / 2, y: r.y + r.height / 2 };

/**
 * Keeps wall-derived rooms in step with the walls.
 *
 *  - A room made from walls (`fromWalls`) follows its enclosure: outline, size and area are
 *    recomputed, and its name and type are kept. If its walls no longer enclose a space the
 *    room is removed.
 *  - A newly enclosed space becomes a new room called "Room N". Its type is left as Custom:
 *    the app does not guess what a room is for.
 *  - Rooms placed by hand are never moved or resized here. If one already fills an enclosed
 *    space, no second room is created for that space.
 */
export function syncRoomsWithWalls(
  rooms: FloorPlanRoom[],
  walls: FloorPlanWall[],
  unit: FloorPlanUnit,
  newId: () => string
): RoomSyncResult {
  const faces = findWallFaces(walls, joinTolerance(unit), minimumRoomArea(unit));
  const taken = new Set<number>();
  const next: FloorPlanRoom[] = [];
  const removed: FloorPlanRoom[] = [];
  let changed = false;

  const claim = (room: FloorPlanRoom): number => {
    const c = centreOf(room);
    let idx = faces.findIndex((f, i) => !taken.has(i) && pointInPolygon(c, f.points));
    if (idx < 0) {
      // The walls moved: take the nearest free space if it is close to where the room was.
      let best = Infinity;
      faces.forEach((f, i) => {
        if (taken.has(i)) return;
        const d = Math.hypot(f.centroid.x - c.x, f.centroid.y - c.y);
        if (d < best && d <= Math.max(room.width, room.height)) { best = d; idx = i; }
      });
    }
    return idx;
  };

  // Hand-placed rooms first: they keep their geometry and may reserve the space they fill.
  for (const room of rooms) {
    if (room.fromWalls) continue;
    const c = centreOf(room);
    const idx = faces.findIndex((f, i) => !taken.has(i) && pointInPolygon(c, f.points));
    if (idx >= 0) {
      const ratio = roomArea(room) / faces[idx].area;
      const samePlace = Math.hypot(faces[idx].centroid.x - c.x, faces[idx].centroid.y - c.y) <= joinTolerance(unit) * 2;
      if (samePlace && Math.abs(ratio - 1) < 0.03) {
        // An earlier auto-detected room that matches its walls exactly: adopt it.
        next.push({ ...room, ...faceToRoomGeometry(faces[idx]), fromWalls: true });
        taken.add(idx);
        changed = true;
        continue;
      }
      if (ratio >= 0.6) taken.add(idx);
    }
    next.push(room);
  }

  for (const room of rooms) {
    if (!room.fromWalls) continue;
    const idx = claim(room);
    if (idx < 0) {
      removed.push(room);
      changed = true;
      continue;
    }
    taken.add(idx);
    const geom = faceToRoomGeometry(faces[idx]);
    const same =
      room.x === geom.x && room.y === geom.y && room.width === geom.width && room.height === geom.height &&
      room.area === geom.area && JSON.stringify(room.polygonPoints) === JSON.stringify(geom.polygonPoints);
    if (same) next.push(room);
    else { next.push({ ...room, ...geom }); changed = true; }
  }

  const added: FloorPlanRoom[] = [];
  let counter = next.length;
  faces.forEach((face, i) => {
    if (taken.has(i)) return;
    counter += 1;
    const room: FloorPlanRoom = {
      id: newId(),
      roomType: 'Custom',
      label: `Room ${counter}`,
      rotation: 0,
      fromWalls: true,
      layer: 'rooms',
      ...faceToRoomGeometry(face),
    };
    added.push(room);
    next.push(room);
    changed = true;
  });

  return { rooms: changed ? next : rooms, added, removed, changed };
}

/**
 * Ties hand-placed rooms to the walls around them when they already fill the enclosed space
 * exactly (same place, area within 3%). Plans saved before rooms followed their walls contain
 * such rooms; once tied, a room follows later wall edits instead of being left behind at its
 * old size. Run this on the drawing as it is BEFORE a wall edit. Nothing is added or removed,
 * and a room that does not match its walls is left exactly as it is.
 */
export function adoptRoomsMatchingWalls(rooms: FloorPlanRoom[], walls: FloorPlanWall[], unit: FloorPlanUnit): FloorPlanRoom[] {
  if (!rooms.some(r => !r.fromWalls)) return rooms;
  const tolerance = joinTolerance(unit);
  const faces = findWallFaces(walls, tolerance, minimumRoomArea(unit));
  if (faces.length === 0) return rooms;
  const taken = new Set<number>();
  const faceAt = (c: Pt) => faces.findIndex((f, i) => !taken.has(i) && pointInPolygon(c, f.points));
  for (const room of rooms) {
    if (!room.fromWalls) continue;
    const idx = faceAt(centreOf(room));
    if (idx >= 0) taken.add(idx);
  }
  let changed = false;
  const next = rooms.map(room => {
    if (room.fromWalls) return room;
    const c = centreOf(room);
    const idx = faceAt(c);
    if (idx < 0) return room;
    const samePlace = Math.hypot(faces[idx].centroid.x - c.x, faces[idx].centroid.y - c.y) <= tolerance * 2;
    if (!samePlace || Math.abs(roomArea(room) / faces[idx].area - 1) >= 0.03) return room;
    taken.add(idx);
    changed = true;
    return { ...room, ...faceToRoomGeometry(faces[idx]), fromWalls: true };
  });
  return changed ? next : rooms;
}

// ---------------------------------------------------------------------------
// Editing joined walls
// ---------------------------------------------------------------------------

/**
 * Moves a corner. Every wall end that sits on the corner moves with it, so walls that were
 * joined stay joined. `walls` must be the walls as they were when the drag started.
 */
export function moveJoint(walls: FloorPlanWall[], from: Pt, to: Pt, tolerance: number): FloorPlanWall[] {
  const moved = walls.map(w => {
    const at1 = Math.hypot(w.x1 - from.x, w.y1 - from.y) <= tolerance;
    const at2 = Math.hypot(w.x2 - from.x, w.y2 - from.y) <= tolerance;
    if (!at1 && !at2) return w;
    return { ...w, x1: at1 ? to.x : w.x1, y1: at1 ? to.y : w.y1, x2: at2 ? to.x : w.x2, y2: at2 ? to.y : w.y2 };
  });
  return reattachTees(walls, moved, tolerance);
}

/**
 * Keeps T-junctions together. A wall end that rested on the side of another wall (away from
 * that wall's own ends) before an edit is put back on it afterwards, at the same fraction
 * along it, when the edit moved that wall out from under it. An end the edit already moved,
 * or one that still lies on its wall, is left alone.
 *
 * `before` and `after` must hold the same walls in the same order, and a wall the edit did not
 * touch must be the same object in both.
 */
export function reattachTees(before: FloorPlanWall[], after: FloorPlanWall[], tolerance: number): FloorPlanWall[] {
  if (before.length !== after.length) return after;
  let changed = false;
  const out = after.map((wall, i) => {
    const old = before[i];
    if (!old || old.id !== wall.id) return wall;
    let next = wall;
    for (const end of [1, 2] as const) {
      const ox = end === 1 ? old.x1 : old.x2, oy = end === 1 ? old.y1 : old.y2;
      if ((end === 1 ? wall.x1 : wall.x2) !== ox || (end === 1 ? wall.y1 : wall.y2) !== oy) continue;
      for (let h = 0; h < before.length; h++) {
        const host = before[h], moved = after[h];
        if (h === i || host === moved) continue;
        const len = wallLengthOf(host);
        if (len <= tolerance * 2) continue;
        const ux = (host.x2 - host.x1) / len, uy = (host.y2 - host.y1) / len;
        const t = (ox - host.x1) * ux + (oy - host.y1) * uy;
        const off = Math.abs((ox - host.x1) * uy - (oy - host.y1) * ux);
        if (off > tolerance || t <= tolerance || t >= len - tolerance) continue;
        const movedLen = wallLengthOf(moved);
        if (movedLen <= 0) continue;
        const mx = (moved.x2 - moved.x1) / movedLen, my = (moved.y2 - moved.y1) / movedLen;
        const stillAt = (ox - moved.x1) * mx + (oy - moved.y1) * my;
        const stillOff = Math.abs((ox - moved.x1) * my - (oy - moved.y1) * mx);
        if (stillOff <= tolerance * 1e-3 && stillAt >= 0 && stillAt <= movedLen) continue;
        const f = t / len;
        const px = moved.x1 + (moved.x2 - moved.x1) * f, py = moved.y1 + (moved.y2 - moved.y1) * f;
        next = end === 1 ? { ...next, x1: px, y1: py } : { ...next, x2: px, y2: py };
        changed = true;
        break;
      }
    }
    return next;
  });
  return changed ? out : after;
}

/**
 * Slides a whole wall by (dx, dy). Walls joined to either end stretch to follow it.
 * `walls` must be the walls as they were when the drag started.
 */
export function translateWall(walls: FloorPlanWall[], wallId: string, dx: number, dy: number, tolerance: number): FloorPlanWall[] {
  const target = walls.find(w => w.id === wallId);
  if (!target || (dx === 0 && dy === 0)) return walls;
  const ends: Pt[] = [{ x: target.x1, y: target.y1 }, { x: target.x2, y: target.y2 }];
  const moved = walls.map(w => {
    if (w.id === wallId) return { ...w, x1: w.x1 + dx, y1: w.y1 + dy, x2: w.x2 + dx, y2: w.y2 + dy };
    const at1 = ends.some(e => Math.hypot(w.x1 - e.x, w.y1 - e.y) <= tolerance);
    const at2 = ends.some(e => Math.hypot(w.x2 - e.x, w.y2 - e.y) <= tolerance);
    if (!at1 && !at2) return w;
    return { ...w, x1: at1 ? w.x1 + dx : w.x1, y1: at1 ? w.y1 + dy : w.y1, x2: at2 ? w.x2 + dx : w.x2, y2: at2 ? w.y2 + dy : w.y2 };
  });
  return reattachTees(walls, moved, tolerance);
}

export interface OpeningFit {
  x: number;
  y: number;
  rotation: number;
  wallOffset: number;
}

/**
 * Where a door or window of this width sits on a wall: the nearest point on the wall to
 * (px, py), kept far enough from both ends that the whole opening is on the wall.
 * Returns null when the wall is too short for the opening.
 */
export function fitOpeningOnWall(wall: FloorPlanWall, width: number, px: number, py: number): OpeningFit | null {
  const len = wallLengthOf(wall);
  if (len <= 0 || width > len) return null;
  const ux = (wall.x2 - wall.x1) / len;
  const uy = (wall.y2 - wall.y1) / len;
  const half = width / 2;
  const t = Math.min(len - half, Math.max(half, (px - wall.x1) * ux + (py - wall.y1) * uy));
  let rotation = (Math.atan2(uy, ux) * 180) / Math.PI;
  if (rotation < 0) rotation += 360;
  return { x: round4(wall.x1 + ux * t), y: round4(wall.y1 + uy * t), rotation: Math.round(rotation * 100) / 100, wallOffset: round4(t) };
}

/** True when another opening on the same wall would overlap an opening centred at `offset`. */
export function openingOverlaps(
  wallId: string,
  offset: number,
  width: number,
  others: { id: string; wallId?: string; wallOffset?: number; width: number }[],
  ignoreId?: string
): boolean {
  return others.some(o =>
    o.id !== ignoreId && o.wallId === wallId && o.wallOffset !== undefined &&
    Math.abs(o.wallOffset - offset) < (o.width + width) / 2 - 1e-6
  );
}

/**
 * After walls change: openings stay on their wall (re-projected onto its new line), and an
 * opening whose wall was deleted, or whose wall became too short for it, is removed.
 */
export function reanchorOpenings<T extends FloorPlanDoor | FloorPlanWindow>(
  openings: T[],
  walls: FloorPlanWall[]
): { openings: T[]; removed: T[]; changed: boolean } {
  const byId = new Map(walls.map(w => [w.id, w]));
  const kept: T[] = [];
  const removed: T[] = [];
  let changed = false;
  for (const o of openings) {
    if (!o.wallId) { kept.push(o); continue; }
    const wall = byId.get(o.wallId);
    const fit = wall ? fitOpeningOnWall(wall, o.width, o.x, o.y) : null;
    if (!fit) { removed.push(o); changed = true; continue; }
    if (Math.abs(fit.x - o.x) < 1e-6 && Math.abs(fit.y - o.y) < 1e-6 && Math.abs(fit.rotation - o.rotation) < 0.01) {
      kept.push(o);
    } else {
      kept.push({ ...o, x: fit.x, y: fit.y, rotation: fit.rotation, wallOffset: fit.wallOffset });
      changed = true;
    }
  }
  return { openings: changed ? kept : openings, removed, changed };
}

/**
 * Partial Eraser helper: Splits a wall into two connected wall segments at point (px, py).
 * If the click is within endMargin of either end, the wall is not split.
 * Returns the two new wall segments [w1, w2] or null if the split point is too close to endpoints.
 */
export function splitWallAtPoint(
  wall: FloorPlanWall,
  px: number,
  py: number,
  newIdFn: () => string,
  endMargin: number = 0.5
): [FloorPlanWall, FloorPlanWall] | null {
  const len = wallLengthOf(wall);
  if (len <= endMargin * 2) return null;

  const ux = (wall.x2 - wall.x1) / len;
  const uy = (wall.y2 - wall.y1) / len;

  // Project point onto the wall line
  const t = (px - wall.x1) * ux + (py - wall.y1) * uy;
  if (t <= endMargin || t >= len - endMargin) {
    return null;
  }

  const splitX = round4(wall.x1 + ux * t);
  const splitY = round4(wall.y1 + uy * t);

  const w1: FloorPlanWall = {
    ...wall,
    id: wall.id, // keep original id for first segment
    x2: splitX,
    y2: splitY,
  };

  const w2: FloorPlanWall = {
    ...wall,
    id: newIdFn(),
    x1: splitX,
    y1: splitY,
  };

  return [w1, w2];
}
