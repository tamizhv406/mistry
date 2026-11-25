/**
 * Ready-made Indian house plans (1 BHK, 2 BHK, 3 BHK, Duplex) for the Floor Planner.
 *
 * Each floor is a normal Floor Planner `Plan` (millimetres): walls on a shared grid so every
 * junction meets exactly, doors and windows placed with the editor's own clearances (250 mm from
 * a corner, 300 mm between openings), a room label inside every room, and furniture. Rooms are
 * laid out in feet and their areas are centre-line sizes (width × length).
 *
 * A Duplex has one plan per floor (Ground Floor, First Floor) with the staircase in the same place
 * on both; the planner draws one floor at a time, so each floor is saved as its own plan.
 *
 * Templates are read-only: opening one always makes a deep copy (`cloneTemplateFloorPlan`).
 */
import type { Furniture, Material, Opening, Plan, RoomLabelItem, Wall } from '../floorPlanner/model/schema';

export const MM_PER_FOOT = 304.8;
const WALL_HEIGHT_MM = 3000;
const EXT_WALL_MM = 200;
const INT_WALL_MM = 100;
/** Same clearances the editor uses when an opening is moved (model/edit.ts). */
export const OPENING_CORNER_MM = 250;
export const OPENING_PIER_MM = 300;
const MIN_DOOR_MM = 600;
const MIN_WINDOW_MM = 450;

export type HouseTemplateType = '1 BHK' | '2 BHK' | '3 BHK' | 'Duplex';
export type RoomKind = NonNullable<RoomLabelItem['kind']>;

/** What a room is for (used for the room summary, checks and colours). */
export type RoomRole =
  | 'sitout'
  | 'living'
  | 'dining'
  | 'kitchen'
  | 'bedroom'
  | 'attached-bath'
  | 'common-toilet'
  | 'pooja'
  | 'balcony'
  | 'staircase'
  | 'utility'
  | 'lounge'
  | 'foyer';

export interface TemplateRoomSpec {
  id: string;
  name: string;
  role: RoomRole;
  kind: RoomKind;
  floorIndex: number; // 0 = Ground Floor, 1 = First Floor
  floorLabel: string;
  xFt: number;
  yFt: number;
  wFt: number;
  hFt: number;
  /** wFt × hFt, centre-line. */
  areaSqFt: number;
}

export interface TemplateFloor {
  floorIndex: number;
  label: string;
  plan: Plan;
  rooms: TemplateRoomSpec[];
  areaSqFt: number;
}

export interface HouseTemplate {
  id: string;
  title: string;
  type: HouseTemplateType;
  plotWidthFt: number;
  plotDepthFt: number;
  /** All floors together. */
  builtUpSqFt: number;
  description: string;
  /** e.g. "Sit-out, Hall, Kitchen, 2 Bed, 2 Bath, Pooja". */
  roomSummary: string;
  floors: TemplateFloor[];
  /** Every room on every floor. */
  rooms: TemplateRoomSpec[];
}

export const HOUSE_TEMPLATE_TYPES: readonly ('All' | HouseTemplateType)[] = ['All', '1 BHK', '2 BHK', '3 BHK', 'Duplex'];

const MATERIALS: Material[] = [
  { id: 'main-wall-200', name: 'Main Wall (200mm / 9")', kind: 'brick', thickness: EXT_WALL_MM, unitLength: 230, unitHeight: 75, jointMm: 10 },
  { id: 'partition-wall-100', name: 'Partition Wall (100mm / 4.5")', kind: 'brick', thickness: INT_WALL_MM, unitLength: 230, unitHeight: 75, jointMm: 10 },
];

const ft = (feet: number) => Math.round(feet * MM_PER_FOOT);
const ROLE_KIND: Record<RoomRole, RoomKind> = {
  sitout: 'hall', living: 'living', dining: 'hall', kitchen: 'kitchen', bedroom: 'bedroom', 'attached-bath': 'bath',
  'common-toilet': 'bath', pooja: 'hall', balcony: 'hall', staircase: 'hall', utility: 'storage', lounge: 'living', foyer: 'hall',
};

type Edge = 'north' | 'south' | 'east' | 'west';
/** [id, name, role, x, y, w, h] in feet from the plot's back-left corner (y grows towards the road). */
type RawRoom = [string, string, RoomRole, number, number, number, number];
type DoorSpec = { between: [string, string]; width?: number } | { entrance: string; edge: Edge; width?: number };
type WindowSpec = [room: string, edge: Edge, width?: number, kind?: 'ventilator'];
type FurnitureSpec = [type: string, room: string, dxFt: number, dyFt: number, rotationDeg: number];

interface FloorSpec {
  label: string;
  rooms: RawRoom[];
  doors: DoorSpec[];
  windows: WindowSpec[];
  furniture: FurnitureSpec[];
}

interface WallMeta {
  wall: Wall;
  sideA: string | null; // above (horizontal) or left (vertical)
  sideB: string | null; // below (horizontal) or right (vertical)
  exterior?: Edge;
}

const wallLen = (w: Wall) => Math.hypot(w.b.x - w.a.x, w.b.y - w.a.y);

/** Walls of one floor: one wall per straight run between two rooms (or a room and outside). */
function buildWalls(rooms: RawRoom[], seq: { wall: number }): WallMeta[] {
  const xs = [...new Set(rooms.flatMap(r => [r[3], r[3] + r[5]]))].sort((a, b) => a - b);
  const ys = [...new Set(rooms.flatMap(r => [r[4], r[4] + r[6]]))].sort((a, b) => a - b);
  const cols = xs.length - 1;
  const rows = ys.length - 1;
  const owner = (ci: number, ri: number): string | null => {
    if (ci < 0 || ri < 0 || ci >= cols || ri >= rows) return null;
    const cx = (xs[ci] + xs[ci + 1]) / 2;
    const cy = (ys[ri] + ys[ri + 1]) / 2;
    return rooms.find(r => cx > r[3] && cx < r[3] + r[5] && cy > r[4] && cy < r[4] + r[6])?.[0] ?? null;
  };
  const metas: WallMeta[] = [];
  const push = (a: { x: number; y: number }, b: { x: number; y: number }, sideA: string | null, sideB: string | null, exterior?: Edge) => {
    const ext = sideA === null || sideB === null;
    metas.push({
      wall: {
        id: `w${++seq.wall}`,
        a: { x: ft(a.x), y: ft(a.y) },
        b: { x: ft(b.x), y: ft(b.y) },
        thickness: ext ? EXT_WALL_MM : INT_WALL_MM,
        height: WALL_HEIGHT_MM,
        materialId: ext ? 'main-wall-200' : 'partition-wall-100',
      },
      sideA,
      sideB,
      exterior,
    });
  };
  for (let ri = 0; ri <= rows; ri++) {
    let ci = 0;
    while (ci < cols) {
      const top = owner(ci, ri - 1);
      const bottom = owner(ci, ri);
      if (top === bottom) { ci++; continue; }
      let end = ci + 1;
      while (end < cols && owner(end, ri - 1) === top && owner(end, ri) === bottom) end++;
      push({ x: xs[ci], y: ys[ri] }, { x: xs[end], y: ys[ri] }, top, bottom, top === null ? 'north' : bottom === null ? 'south' : undefined);
      ci = end;
    }
  }
  for (let ci = 0; ci <= cols; ci++) {
    let ri = 0;
    while (ri < rows) {
      const left = owner(ci - 1, ri);
      const right = owner(ci, ri);
      if (left === right) { ri++; continue; }
      let end = ri + 1;
      while (end < rows && owner(ci - 1, end) === left && owner(ci, end) === right) end++;
      push({ x: xs[ci], y: ys[ri] }, { x: xs[ci], y: ys[end] }, left, right, left === null ? 'west' : right === null ? 'east' : undefined);
      ri = end;
    }
  }
  return metas;
}

function buildFloor(templateId: string, floorIndex: number, floor: FloorSpec, plot: { w: number; d: number }, title: string): TemplateFloor {
  const seq = { wall: 0 };
  const metas = buildWalls(floor.rooms, seq);
  const openings: Opening[] = [];
  const taken = new Map<string, Array<[number, number]>>();
  const fail = (what: string) => {
    throw new Error(`House template ${templateId} (${floor.label}): ${what}`);
  };

  /** Puts an opening on the wall with the editor's clearances, narrowing it if needed. */
  const place = (meta: WallMeta, type: Opening['type'], want: number, height: number, sill: number, door: boolean, what: string) => {
    const len = wallLen(meta.wall);
    const used = (taken.get(meta.wall.id) ?? []).sort((p, q) => p[0] - q[0]);
    // Free stretches between the corners and the openings already on this wall.
    const free: Array<[number, number]> = [];
    let cursor = OPENING_CORNER_MM;
    for (const [s, e] of used) {
      free.push([cursor, s - OPENING_PIER_MM]);
      cursor = e + OPENING_PIER_MM;
    }
    free.push([cursor, len - OPENING_CORNER_MM]);
    const best = free.map(([s, e]) => [s, e, e - s] as const).sort((p, q) => q[2] - p[2])[0];
    const min = door ? MIN_DOOR_MM : MIN_WINDOW_MM;
    if (!best || best[2] < min) fail(`no room on the wall for ${what}`);
    const width = Math.floor(Math.min(want, best[2]) / 50) * 50;
    // Centred in the free stretch, snapped to 50 mm like the editor.
    let offset = Math.round((best[0] + (best[2] - width) / 2) / 50) * 50;
    offset = Math.min(Math.max(offset, Math.ceil(best[0])), Math.floor(best[1] - width));
    used.push([offset, offset + width]);
    taken.set(meta.wall.id, used);
    openings.push({
      id: `${type === 'window' ? 'win' : 'd'}${openings.length + 1}`,
      wallId: meta.wall.id,
      type,
      offset,
      width,
      height,
      sill,
      ...(door ? { hinge: 'start' as const, side: 'right' as const } : {}),
    });
  };
  const longest = (list: WallMeta[]) => list.sort((p, q) => wallLen(q.wall) - wallLen(p.wall))[0];

  for (const d of floor.doors) {
    if ('between' in d) {
      const [a, b] = d.between;
      const meta = longest(metas.filter(m => (m.sideA === a && m.sideB === b) || (m.sideA === b && m.sideB === a)));
      if (!meta) fail(`rooms ${a} and ${b} share no wall`);
      place(meta, 'door', d.width ?? 800, 2000, 0, true, `the door ${a}–${b}`);
    } else {
      const meta = longest(metas.filter(m => m.exterior === d.edge && (m.sideA === d.entrance || m.sideB === d.entrance)));
      if (!meta) fail(`${d.entrance} has no ${d.edge} outside wall`);
      place(meta, 'door', d.width ?? 1000, 2100, 0, true, `the main door of ${d.entrance}`);
    }
  }
  for (const [room, edge, width, kind] of floor.windows) {
    const meta = longest(metas.filter(m => m.exterior === edge && (m.sideA === room || m.sideB === room)));
    if (!meta) fail(`${room} has no ${edge} outside wall for a window`);
    if (kind === 'ventilator') place(meta, 'window', width ?? 600, 600, 1500, false, `the ventilator of ${room}`);
    else place(meta, 'window', width ?? 1200, 1350, 850, false, `the window of ${room}`);
  }

  const roomById = new Map(floor.rooms.map(r => [r[0], r]));
  const rooms: TemplateRoomSpec[] = floor.rooms.map(([id, name, role, x, y, w, h]) => ({
    id, name, role, kind: ROLE_KIND[role], floorIndex, floorLabel: floor.label,
    xFt: x, yFt: y, wFt: w, hFt: h, areaSqFt: Math.round(w * h * 100) / 100,
  }));
  const labels: RoomLabelItem[] = rooms.map(r => ({
    id: `room-${r.id}`, name: r.name, kind: r.kind, x: ft(r.xFt + r.wFt / 2), y: ft(r.yFt + r.hFt / 2),
  }));
  const furniture: Furniture[] = floor.furniture.map(([type, room, dx, dy, rotationDeg], i) => {
    const r = roomById.get(room);
    if (!r) fail(`furniture ${type} is in unknown room ${room}`);
    return { id: `f${i + 1}`, type, x: ft(r![3] + r![5] / 2 + dx), y: ft(r![4] + r![6] / 2 + dy), rotationDeg };
  });

  const W = ft(plot.w);
  const D = ft(plot.d);
  const plan: Plan = {
    version: 1,
    name: floorIndex === 0 ? title : `${title} – ${floor.label}`,
    author: 'template',
    site: {
      convention: 'y-down-clockwise',
      width: W,
      depth: D,
      boundary: [{ x: 0, y: 0 }, { x: W, y: 0 }, { x: W, y: D }, { x: 0, y: D }],
      street: { side: [2, 3], note: 'Front road' },
    },
    materials: MATERIALS.map(m => ({ ...m })),
    walls: metas.map(m => m.wall),
    openings,
    furniture,
    rooms: labels,
  };
  return { floorIndex, label: floor.label, plan, rooms, areaSqFt: Math.round(rooms.reduce((s, r) => s + r.areaSqFt, 0)) };
}

function summarize(rooms: TemplateRoomSpec[]): string {
  const count = (...roles: RoomRole[]) => rooms.filter(r => roles.includes(r.role)).length;
  const has = (role: RoomRole) => count(role) > 0;
  const parts = [
    has('sitout') && 'Sit-out',
    has('living') && 'Hall',
    has('dining') && 'Dining',
    has('kitchen') && 'Kitchen',
    `${count('bedroom')} Bed`,
    `${count('attached-bath', 'common-toilet')} Bath`,
    has('pooja') && 'Pooja',
    has('balcony') && 'Balcony',
    has('staircase') && 'Staircase',
  ];
  return parts.filter(Boolean).join(', ');
}

function template(spec: {
  id: string;
  title: string;
  type: HouseTemplateType;
  plot: [number, number];
  description: string;
  floors: FloorSpec[];
}): HouseTemplate {
  const plot = { w: spec.plot[0], d: spec.plot[1] };
  const floors = spec.floors.map((f, i) => buildFloor(spec.id, i, f, plot, spec.title));
  const rooms = floors.flatMap(f => f.rooms);
  return {
    id: spec.id,
    title: spec.title,
    type: spec.type,
    plotWidthFt: plot.w,
    plotDepthFt: plot.d,
    builtUpSqFt: floors.reduce((s, f) => s + f.areaSqFt, 0),
    description: spec.description,
    roomSummary: summarize(rooms),
    floors,
    rooms,
  };
}

// North (y = 0) is the back of the plot; the road is on the south side (y = plot depth).
export const HOUSE_TEMPLATES: readonly HouseTemplate[] = [
  template({
    id: '1bhk-20x30',
    title: '1 BHK Compact Home',
    type: '1 BHK',
    plot: [20, 30],
    description: 'Single-bedroom home on a 20×30 ft plot: sit-out, hall, kitchen, bedroom with attached bath, common toilet and pooja room.',
    floors: [{
      label: 'Ground Floor',
      rooms: [
        ['bed', 'Bedroom', 'bedroom', 0, 0, 12, 12],
        ['att', 'Attached Bath', 'attached-bath', 12, 0, 8, 6],
        ['toilet', 'Common Toilet', 'common-toilet', 12, 6, 8, 6],
        ['kitchen', 'Kitchen', 'kitchen', 0, 12, 7, 11],
        ['hall', 'Hall', 'living', 7, 12, 13, 11],
        ['sitout', 'Sit-out', 'sitout', 0, 23, 14, 7],
        ['pooja', 'Pooja Room', 'pooja', 14, 23, 6, 7],
      ],
      doors: [
        { entrance: 'sitout', edge: 'south', width: 1000 },
        { between: ['sitout', 'hall'], width: 1000 },
        { between: ['hall', 'kitchen'], width: 800 },
        { between: ['hall', 'bed'], width: 800 },
        { between: ['hall', 'toilet'], width: 700 },
        { between: ['hall', 'pooja'], width: 700 },
        { between: ['bed', 'att'], width: 700 },
      ],
      windows: [
        ['bed', 'north', 1200], ['bed', 'west', 1200], ['att', 'north', 600, 'ventilator'], ['toilet', 'east', 600, 'ventilator'],
        ['kitchen', 'west', 1000], ['hall', 'east', 1200], ['sitout', 'south', 1200],
      ],
      furniture: [
        ['bed-1600', 'bed', 0, -1, 0], ['wardrobe', 'bed', -4.5, 3.5, 90], ['toilet', 'att', 2, -1, 0], ['washbasin', 'att', -2, -1.8, 0],
        ['toilet', 'toilet', 2, 1, 180], ['sofa', 'hall', 3.5, 0, 270], ['coffee-table', 'hall', 0.5, 0, 90], ['kitchen-l', 'kitchen', -1.5, -2.5, 90],
      ],
    }],
  }),

  template({
    id: '2bhk-20x30',
    title: '2 BHK Smart Home',
    type: '2 BHK',
    plot: [20, 30],
    description: 'Compact 2 BHK on a 20×30 ft plot: sit-out, hall, dining, kitchen, master bedroom with attached bath, bedroom 2, common toilet and pooja room.',
    floors: [{
      label: 'Ground Floor',
      rooms: [
        ['bed1', 'Master Bedroom', 'bedroom', 0, 0, 10, 10.5],
        ['bed2', 'Bedroom 2', 'bedroom', 10, 0, 10, 10.5],
        ['att', 'Attached Bath', 'attached-bath', 0, 10.5, 5.5, 6],
        ['dining', 'Dining', 'dining', 5.5, 10.5, 9, 6],
        ['toilet', 'Common Toilet', 'common-toilet', 14.5, 10.5, 5.5, 6],
        ['hall', 'Hall', 'living', 0, 16.5, 13, 8],
        ['kitchen', 'Kitchen', 'kitchen', 13, 16.5, 7, 8],
        ['pooja', 'Pooja Room', 'pooja', 0, 24.5, 5.5, 5.5],
        ['sitout', 'Sit-out', 'sitout', 5.5, 24.5, 14.5, 5.5],
      ],
      doors: [
        { entrance: 'sitout', edge: 'south', width: 1000 },
        { between: ['sitout', 'hall'], width: 1000 },
        { between: ['hall', 'pooja'], width: 700 },
        { between: ['hall', 'kitchen'], width: 800 },
        { between: ['hall', 'dining'], width: 1000 },
        { between: ['dining', 'toilet'], width: 700 },
        { between: ['dining', 'bed1'], width: 800 },
        { between: ['dining', 'bed2'], width: 800 },
        { between: ['bed1', 'att'], width: 700 },
      ],
      windows: [
        ['bed1', 'north', 1100], ['bed1', 'west', 1000], ['bed2', 'north', 1100], ['bed2', 'east', 1000],
        ['att', 'west', 600, 'ventilator'], ['toilet', 'east', 600, 'ventilator'],
        ['hall', 'west', 1200], ['kitchen', 'east', 1000], ['sitout', 'south', 1200],
      ],
      furniture: [
        ['bed-1600', 'bed1', 0, -1, 0], ['bed-1600', 'bed2', 0, -1, 0], ['toilet', 'att', 0, -1.5, 0], ['toilet', 'toilet', 0, -1.5, 0],
        ['dining-4', 'dining', 0, 0, 0], ['sofa', 'hall', -4, 0, 90], ['kitchen-l', 'kitchen', 1, 1.5, 180],
      ],
    }],
  }),

  template({
    id: '2bhk-30x40',
    title: '2 BHK Family Home',
    type: '2 BHK',
    plot: [30, 40],
    description: 'Roomy 2 BHK on a 30×40 ft plot: sit-out, balcony, hall, dining, kitchen, utility, pooja room, two bedrooms, attached bath and common toilet.',
    floors: [{
      label: 'Ground Floor',
      rooms: [
        ['master', 'Master Bedroom', 'bedroom', 0, 0, 13, 12],
        ['att', 'Attached Bath', 'attached-bath', 13, 0, 5, 7],
        ['toilet', 'Common Toilet', 'common-toilet', 13, 7, 5, 5],
        ['bed2', 'Bedroom 2', 'bedroom', 18, 0, 12, 12],
        ['kitchen', 'Kitchen', 'kitchen', 0, 12, 8, 11],
        ['dining', 'Dining', 'dining', 8, 12, 16, 11],
        ['pooja', 'Pooja Room', 'pooja', 24, 12, 6, 5.5],
        ['utility', 'Utility / Store', 'utility', 24, 17.5, 6, 5.5],
        ['hall', 'Hall', 'living', 0, 23, 30, 11],
        ['sitout', 'Sit-out', 'sitout', 0, 34, 18, 6],
        ['balcony', 'Balcony', 'balcony', 18, 34, 12, 6],
      ],
      doors: [
        { entrance: 'sitout', edge: 'south', width: 1000 },
        { between: ['sitout', 'hall'], width: 1000 },
        { between: ['hall', 'balcony'], width: 900 },
        { between: ['hall', 'dining'], width: 1000 },
        { between: ['dining', 'kitchen'], width: 900 },
        { between: ['dining', 'pooja'], width: 700 },
        { between: ['dining', 'utility'], width: 700 },
        { between: ['dining', 'toilet'], width: 700 },
        { between: ['dining', 'master'], width: 800 },
        { between: ['dining', 'bed2'], width: 800 },
        { between: ['master', 'att'], width: 700 },
      ],
      windows: [
        ['master', 'north', 1300], ['master', 'west', 1200], ['bed2', 'north', 1300], ['bed2', 'east', 1200],
        ['att', 'north', 600, 'ventilator'], ['kitchen', 'west', 1200], ['utility', 'east', 900], ['hall', 'west', 1400], ['hall', 'east', 1400],
        ['sitout', 'south', 1500], ['balcony', 'south', 1500],
      ],
      furniture: [
        ['bed-1800', 'master', 0, -1, 0], ['wardrobe', 'master', -5, 3, 90], ['bed-1600', 'bed2', 0, -1, 0], ['toilet', 'att', 0, -2, 0],
        ['dining-6', 'dining', 0, 0, 0], ['kitchen-l', 'kitchen', -1.5, -2.5, 90], ['sofa', 'hall', 0, -3, 0], ['coffee-table', 'hall', 0, 0.5, 0],
      ],
    }],
  }),

  template({
    id: '3bhk-30x40',
    title: '3 BHK Family Home',
    type: '3 BHK',
    plot: [30, 40],
    description: 'Three-bedroom home on a 30×40 ft plot: sit-out, balcony, hall, dining, kitchen, pooja room, two bedrooms with attached baths, bedroom 3 and common toilet.',
    floors: [{
      label: 'Ground Floor',
      rooms: [
        ['master', 'Master Bedroom', 'bedroom', 0, 0, 12, 12],
        ['att1', 'Attached Bath 1', 'attached-bath', 12, 0, 6, 6],
        ['att2', 'Attached Bath 2', 'attached-bath', 12, 6, 6, 6],
        ['bed2', 'Bedroom 2', 'bedroom', 18, 0, 12, 12],
        ['kitchen', 'Kitchen', 'kitchen', 0, 12, 7, 11],
        ['dining', 'Dining', 'dining', 7, 12, 17, 11],
        ['toilet', 'Common Toilet', 'common-toilet', 24, 12, 6, 5.5],
        ['pooja', 'Pooja Room', 'pooja', 24, 17.5, 6, 5.5],
        ['bed3', 'Bedroom 3', 'bedroom', 0, 23, 11, 11],
        ['hall', 'Hall', 'living', 11, 23, 19, 11],
        ['sitout', 'Sit-out', 'sitout', 0, 34, 18, 6],
        ['balcony', 'Balcony', 'balcony', 18, 34, 12, 6],
      ],
      doors: [
        { entrance: 'sitout', edge: 'south', width: 1000 },
        { between: ['sitout', 'hall'], width: 1000 },
        { between: ['sitout', 'balcony'], width: 900 },
        { between: ['hall', 'dining'], width: 1000 },
        { between: ['hall', 'bed3'], width: 800 },
        { between: ['dining', 'kitchen'], width: 900 },
        { between: ['dining', 'toilet'], width: 700 },
        { between: ['dining', 'pooja'], width: 700 },
        { between: ['dining', 'master'], width: 800 },
        { between: ['dining', 'bed2'], width: 800 },
        { between: ['master', 'att1'], width: 700 },
        { between: ['bed2', 'att2'], width: 700 },
      ],
      windows: [
        ['master', 'north', 1300], ['master', 'west', 1200], ['bed2', 'north', 1300], ['bed2', 'east', 1200],
        ['att1', 'north', 600, 'ventilator'], ['toilet', 'east', 600, 'ventilator'], ['bed3', 'west', 1200], ['kitchen', 'west', 1000],
        ['hall', 'east', 1400], ['sitout', 'south', 1500], ['balcony', 'south', 1300],
      ],
      furniture: [
        ['bed-1800', 'master', 0, -1, 0], ['bed-1600', 'bed2', 0, -1, 0], ['bed-900', 'bed3', -2.5, 0, 90], ['dining-6', 'dining', 0, 0, 0],
        ['kitchen-l', 'kitchen', -1, -2.5, 90], ['sofa-corner', 'hall', 2, -1, 0], ['toilet', 'toilet', 1.5, -1, 0], ['toilet', 'att1', 0, -1.5, 0],
      ],
    }],
  }),

  template({
    id: '3bhk-30x50',
    title: '3 BHK Spacious Residence',
    type: '3 BHK',
    plot: [30, 50],
    description: 'Spacious 3 BHK on a 30×50 ft plot: verandah, foyer, staircase for a future floor, hall, dining, kitchen, pooja room, three bedrooms and three baths.',
    floors: [{
      label: 'Ground Floor',
      rooms: [
        ['master', 'Master Bedroom', 'bedroom', 0, 0, 13, 14],
        ['att1', 'Attached Bath 1', 'attached-bath', 13, 0, 4, 7],
        ['att2', 'Attached Bath 2', 'attached-bath', 13, 7, 4, 7],
        ['bed2', 'Bedroom 2', 'bedroom', 17, 0, 13, 14],
        ['kitchen', 'Kitchen', 'kitchen', 0, 14, 8, 12],
        ['dining', 'Dining', 'dining', 8, 14, 16, 12],
        ['toilet', 'Common Toilet', 'common-toilet', 24, 14, 6, 6],
        ['pooja', 'Pooja Room', 'pooja', 24, 20, 6, 6],
        ['bed3', 'Bedroom 3', 'bedroom', 0, 26, 12, 11],
        ['hall', 'Hall', 'living', 12, 26, 18, 11],
        ['foyer', 'Entrance Foyer', 'foyer', 0, 37, 18, 7],
        ['stairs', 'Staircase', 'staircase', 18, 37, 12, 7],
        ['sitout', 'Verandah', 'sitout', 0, 44, 30, 6],
      ],
      doors: [
        { entrance: 'sitout', edge: 'south', width: 1000 },
        { between: ['sitout', 'foyer'], width: 1000 },
        { between: ['foyer', 'stairs'], width: 900 },
        { between: ['foyer', 'hall'], width: 1000 },
        { between: ['hall', 'dining'], width: 1000 },
        { between: ['hall', 'bed3'], width: 800 },
        { between: ['dining', 'kitchen'], width: 900 },
        { between: ['dining', 'toilet'], width: 700 },
        { between: ['dining', 'pooja'], width: 700 },
        { between: ['dining', 'master'], width: 800 },
        { between: ['dining', 'bed2'], width: 800 },
        { between: ['master', 'att1'], width: 700 },
        { between: ['bed2', 'att2'], width: 700 },
      ],
      windows: [
        ['master', 'north', 1400], ['master', 'west', 1300], ['bed2', 'north', 1400], ['bed2', 'east', 1300],
        ['att1', 'north', 600, 'ventilator'], ['toilet', 'east', 600, 'ventilator'], ['bed3', 'west', 1200], ['kitchen', 'west', 1100],
        ['hall', 'east', 1500], ['foyer', 'west', 1000], ['stairs', 'east', 1100], ['sitout', 'south', 1500],
      ],
      furniture: [
        ['bed-1800', 'master', 0, -1.5, 0], ['bed-1600', 'bed2', 0, -1.5, 0], ['bed-1600', 'bed3', -1.5, 0, 90], ['dining-6', 'dining', 0, 0, 0],
        ['kitchen-l', 'kitchen', -1.5, -3, 90], ['sofa', 'hall', 5, 0, 270], ['stairs-l', 'stairs', 2, 0, 0], ['toilet', 'att1', 0, -2, 0],
      ],
    }],
  }),

  template({
    id: 'duplex-20x30',
    title: 'Duplex Home (G+1)',
    type: 'Duplex',
    plot: [20, 30],
    description: 'Two-floor home on a 20×30 ft plot. Ground: sit-out, hall, dining, kitchen, pooja, parents bedroom, common toilet, staircase. First: lounge, balcony, two bedrooms with attached baths.',
    floors: [
      {
        label: 'Ground Floor',
        rooms: [
          ['bed', 'Parents Bedroom', 'bedroom', 0, 0, 10, 10.5],
          ['kitchen', 'Kitchen', 'kitchen', 10, 0, 10, 10.5],
          ['toilet', 'Common Toilet', 'common-toilet', 0, 10.5, 5, 5.5],
          ['dining', 'Dining', 'dining', 5, 10.5, 10, 5.5],
          ['pooja', 'Pooja Room', 'pooja', 15, 10.5, 5, 5.5],
          ['hall', 'Hall', 'living', 0, 16, 13, 8.5],
          ['stairs', 'Staircase', 'staircase', 13, 16, 7, 8.5],
          ['sitout', 'Sit-out', 'sitout', 0, 24.5, 20, 5.5],
        ],
        doors: [
          { entrance: 'sitout', edge: 'south', width: 1000 },
          { between: ['sitout', 'hall'], width: 1000 },
          { between: ['hall', 'stairs'], width: 900 },
          { between: ['hall', 'dining'], width: 1000 },
          { between: ['dining', 'toilet'], width: 700 },
          { between: ['dining', 'pooja'], width: 700 },
          { between: ['dining', 'bed'], width: 800 },
          { between: ['dining', 'kitchen'], width: 800 },
        ],
        windows: [
          ['bed', 'north', 1100], ['bed', 'west', 1000], ['kitchen', 'north', 1100], ['kitchen', 'east', 1000],
          ['toilet', 'west', 600, 'ventilator'], ['hall', 'west', 1200], ['stairs', 'east', 900], ['sitout', 'south', 1200],
        ],
        furniture: [
          ['bed-1600', 'bed', 0, -1, 0], ['kitchen-l', 'kitchen', 2, -2, 90], ['dining-4', 'dining', 0, 0, 0],
          ['sofa', 'hall', -4, 0, 90], ['stairs-l', 'stairs', 0, 0, 0], ['toilet', 'toilet', 0, -1, 0],
        ],
      },
      {
        label: 'First Floor',
        rooms: [
          ['master', 'Master Bedroom', 'bedroom', 0, 0, 10, 11],
          ['bed2', 'Bedroom 2', 'bedroom', 10, 0, 10, 11],
          ['att1', 'Attached Bath 1', 'attached-bath', 0, 11, 5.5, 5],
          ['landing', 'Upper Passage', 'lounge', 5.5, 11, 9, 5],
          ['att2', 'Attached Bath 2', 'attached-bath', 14.5, 11, 5.5, 5],
          ['lounge', 'Family Lounge', 'lounge', 0, 16, 13, 8.5],
          ['stairs', 'Staircase', 'staircase', 13, 16, 7, 8.5],
          ['balcony', 'Balcony', 'balcony', 0, 24.5, 20, 5.5],
        ],
        doors: [
          { between: ['stairs', 'lounge'], width: 900 },
          { between: ['lounge', 'balcony'], width: 1000 },
          { between: ['lounge', 'landing'], width: 900 },
          { between: ['landing', 'master'], width: 800 },
          { between: ['landing', 'bed2'], width: 800 },
          { between: ['master', 'att1'], width: 700 },
          { between: ['bed2', 'att2'], width: 700 },
        ],
        windows: [
          ['master', 'north', 1100], ['master', 'west', 1000], ['bed2', 'north', 1100], ['bed2', 'east', 1000],
          ['att1', 'west', 600, 'ventilator'], ['att2', 'east', 600, 'ventilator'], ['lounge', 'west', 1200], ['stairs', 'east', 900],
          ['balcony', 'south', 1500],
        ],
        furniture: [
          ['bed-1800', 'master', 0, -1, 0], ['bed-1600', 'bed2', 0, -1, 0], ['toilet', 'att1', 0, -0.5, 90], ['toilet', 'att2', 0, -0.5, 270],
          ['sofa-2', 'lounge', -4, 0, 90], ['stairs-l', 'stairs', 0, 0, 0],
        ],
      },
    ],
  }),

  template({
    id: 'duplex-30x40',
    title: 'Duplex Villa (G+1)',
    type: 'Duplex',
    plot: [30, 40],
    description: 'Two-floor villa on a 30×40 ft plot. Ground: sit-out, car porch, hall, dining, kitchen, pooja, parents bedroom with attached bath, common toilet, staircase. First: family lounge, upper hall, balcony, three bedrooms, two attached baths.',
    floors: [
      {
        label: 'Ground Floor',
        rooms: [
          ['guest', 'Parents Bedroom', 'bedroom', 0, 0, 12, 12.5],
          ['att', 'Attached Bath', 'attached-bath', 12, 0, 5.5, 6],
          ['toilet', 'Common Toilet', 'common-toilet', 12, 6, 5.5, 6.5],
          ['kitchen', 'Kitchen', 'kitchen', 17.5, 0, 12.5, 12.5],
          ['pooja', 'Pooja Room', 'pooja', 0, 12.5, 7, 10.5],
          ['dining', 'Dining', 'dining', 7, 12.5, 23, 10.5],
          ['hall', 'Hall', 'living', 0, 23, 20, 10.5],
          ['stairs', 'Staircase', 'staircase', 20, 23, 10, 10.5],
          ['sitout', 'Sit-out', 'sitout', 0, 33.5, 19, 6.5],
          ['porch', 'Car Porch', 'sitout', 19, 33.5, 11, 6.5],
        ],
        doors: [
          { entrance: 'sitout', edge: 'south', width: 1000 },
          { between: ['sitout', 'porch'], width: 900 },
          { between: ['sitout', 'hall'], width: 1000 },
          { between: ['hall', 'stairs'], width: 1000 },
          { between: ['hall', 'dining'], width: 1000 },
          { between: ['dining', 'pooja'], width: 750 },
          { between: ['dining', 'kitchen'], width: 900 },
          { between: ['dining', 'toilet'], width: 700 },
          { between: ['dining', 'guest'], width: 800 },
          { between: ['guest', 'att'], width: 700 },
        ],
        windows: [
          ['guest', 'north', 1300], ['guest', 'west', 1200], ['att', 'north', 600, 'ventilator'], ['kitchen', 'north', 1300], ['kitchen', 'east', 1200],
          ['hall', 'west', 1400], ['stairs', 'east', 1200], ['porch', 'south', 1500], ['sitout', 'south', 1500],
        ],
        furniture: [
          ['bed-1600', 'guest', 0, -1.5, 0], ['kitchen-l', 'kitchen', 2.5, -2.5, 90], ['dining-6', 'dining', 2, 0, 0],
          ['sofa-corner', 'hall', -4, -1, 0], ['stairs-u', 'stairs', 0, 0, 0], ['toilet', 'att', 0, -1.5, 0],
        ],
      },
      {
        label: 'First Floor',
        rooms: [
          ['master', 'Master Bedroom', 'bedroom', 0, 0, 12, 13],
          ['att1', 'Attached Bath 1', 'attached-bath', 12, 0, 5.5, 6.5],
          ['att2', 'Attached Bath 2', 'attached-bath', 12, 6.5, 5.5, 6.5],
          ['bed2', 'Bedroom 2', 'bedroom', 17.5, 0, 12.5, 13],
          ['lounge', 'Family Lounge', 'lounge', 0, 13, 30, 10],
          ['bed3', 'Bedroom 3', 'bedroom', 0, 23, 12, 10.5],
          ['upper', 'Upper Hall', 'lounge', 12, 23, 8, 10.5],
          ['stairs', 'Staircase', 'staircase', 20, 23, 10, 10.5],
          ['balcony', 'Balcony', 'balcony', 0, 33.5, 30, 6.5],
        ],
        doors: [
          { between: ['stairs', 'upper'], width: 1000 },
          { between: ['upper', 'balcony'], width: 1000 },
          { between: ['upper', 'lounge'], width: 1000 },
          { between: ['lounge', 'bed3'], width: 800 },
          { between: ['lounge', 'master'], width: 800 },
          { between: ['lounge', 'bed2'], width: 800 },
          { between: ['master', 'att1'], width: 700 },
          { between: ['bed2', 'att2'], width: 700 },
        ],
        windows: [
          ['master', 'north', 1300], ['master', 'west', 1200], ['att1', 'north', 600, 'ventilator'], ['bed2', 'north', 1300], ['bed2', 'east', 1200],
          ['bed3', 'west', 1100], ['lounge', 'west', 1300], ['lounge', 'east', 1300], ['stairs', 'east', 1200], ['balcony', 'south', 1800],
        ],
        furniture: [
          ['bed-1800', 'master', 0, -1.5, 0], ['bed-1600', 'bed2', 0, -1.5, 0], ['bed-1600', 'bed3', -1.5, 0, 90],
          ['sofa', 'lounge', 0, 2, 180], ['desk', 'upper', 0, 2, 0], ['stairs-u', 'stairs', 0, 0, 0], ['toilet', 'att1', 0, -1.5, 0],
        ],
      },
    ],
  }),
];

export function houseTemplateById(id: string): HouseTemplate | undefined {
  return HOUSE_TEMPLATES.find(t => t.id === id);
}

/** "20×30 ft • 600 sq ft" */
export function templateSizeText(t: HouseTemplate): string {
  return `${t.plotWidthFt}×${t.plotDepthFt} ft • ${t.builtUpSqFt.toLocaleString('en-IN')} sq ft`;
}

/** "12′ × 11′ · 132 sq ft" */
export function roomSizeText(r: TemplateRoomSpec): string {
  const f = (v: number) => (Number.isInteger(v) ? `${v}′` : `${Math.floor(v)}′${Math.round((v % 1) * 12)}″`);
  return `${f(r.wFt)} × ${f(r.hFt)} · ${Math.round(r.areaSqFt)} sq ft`;
}

/**
 * A new, independent copy of one floor's plan, ready to save or load into the editor.
 * The template itself is never changed.
 */
export function cloneTemplateFloorPlan(template: HouseTemplate, floorIndex = 0, name?: string): Plan {
  const floor = template.floors[floorIndex] ?? template.floors[0];
  const plan = structuredClone(floor.plan) as Plan;
  const base = (name || template.title).trim() || template.title;
  plan.name = template.floors.length > 1 ? `${base} – ${floor.label}` : base;
  plan.updatedAt = new Date().toISOString();
  plan.rev = 0;
  delete plan.author;
  return plan;
}
