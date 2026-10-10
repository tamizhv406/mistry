/**
 * The floor-plan document: floors, undo history, what gets saved, import and export.
 * Pure functions and one small class, so the rules that protect a user's drawing can be tested
 * without a browser.
 *
 * One model feeds everything: the 2D editor, the 3D preview, exports and the saved record all
 * read the same `FloorPlanLevel[]`.
 */
import type {
  FloorPlan, FloorPlanAnnotation, FloorPlanColumn, FloorPlanDoor, FloorPlanFurniture, FloorPlanLevel, FloorPlanRoom,
  FloorPlanStaircase, FloorPlanUnit, FloorPlanWall, FloorPlanWindow,
} from '../db/types';
import { reanchorOpenings, syncRoomsWithWalls } from './planGeometry';

export interface FloorState {
  walls: FloorPlanWall[];
  rooms: FloorPlanRoom[];
  doors: FloorPlanDoor[];
  windows: FloorPlanWindow[];
  furniture: FloorPlanFurniture[];
  stairs: FloorPlanStaircase[];
  columns: FloorPlanColumn[];
  annotations: FloorPlanAnnotation[];
}

export const emptyFloorState = (): FloorState => ({
  walls: [], rooms: [], doors: [], windows: [], furniture: [], stairs: [], columns: [], annotations: [],
});

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

export function levelToState(level: Partial<FloorPlanLevel> | undefined): FloorState {
  return {
    walls: level?.walls || [],
    rooms: level?.rooms || [],
    doors: level?.doors || [],
    windows: level?.windows || [],
    furniture: level?.furniture || [],
    stairs: level?.stairs || [],
    columns: level?.columns || [],
    annotations: level?.annotations || [],
  };
}

export function stateToLevel(level: FloorPlanLevel, state: FloorState): FloorPlanLevel {
  return { ...level, ...state };
}

const hasGeometry = (s: Partial<FloorState> | undefined) =>
  !!s && ((s.walls?.length || 0) + (s.rooms?.length || 0) + (s.doors?.length || 0) + (s.windows?.length || 0) +
    (s.furniture?.length || 0) + (s.columns?.length || 0) + (s.stairs?.length || 0) > 0);

/**
 * The floors of a saved plan. Older plans (and starter templates) keep their drawing in the
 * plan's top-level fields with no floors, or with empty placeholder floors; that drawing is
 * adopted as the ground floor instead of being silently dropped.
 */
export function loadFloors(plan: FloorPlan): FloorPlanLevel[] {
  const top = levelToState(plan);
  if (!plan.floors || plan.floors.length === 0) {
    return [{ id: 'level-ground', name: plan.floorName || 'Ground Floor', elevation: 0, ...top }];
  }
  const floors = plan.floors.map(f => ({ ...f, ...levelToState(f) }));
  if (!floors.some(hasGeometry) && hasGeometry(top)) floors[0] = { ...floors[0], ...top };
  return floors;
}

export interface FloorsView {
  floors: FloorPlanLevel[];
  activeIndex: number;
  state: FloorState;
}

/** Writes what is on screen back into its floor. Call before anything reads `floors`. */
export function commitActive(floors: FloorPlanLevel[], activeIndex: number, state: FloorState): FloorPlanLevel[] {
  return floors.map((f, i) => (i === activeIndex ? stateToLevel(f, state) : f));
}

export function switchFloor(floors: FloorPlanLevel[], activeIndex: number, state: FloorState, toIndex: number): FloorsView {
  const committed = commitActive(floors, activeIndex, state);
  if (toIndex < 0 || toIndex >= committed.length) return { floors: committed, activeIndex, state };
  return { floors: committed, activeIndex: toIndex, state: levelToState(committed[toIndex]) };
}

export const DEFAULT_FLOOR_NAMES = ['Ground Floor', 'First Floor', 'Second Floor', 'Third Floor', 'Fourth Floor', 'Fifth Floor'];

export function suggestFloorName(floors: FloorPlanLevel[]): string {
  const used = new Set(floors.map(f => f.name.trim().toLowerCase()));
  return DEFAULT_FLOOR_NAMES.find(n => !used.has(n.toLowerCase())) || `Floor ${floors.length + 1}`;
}

export function validateFloorName(floors: FloorPlanLevel[], name: string, ignoreIndex?: number): string | null {
  const trimmed = name.trim();
  if (!trimmed) return 'Enter a name for the floor.';
  if (trimmed.length > 40) return 'Keep the floor name under 40 characters.';
  if (floors.some((f, i) => i !== ignoreIndex && f.name.trim().toLowerCase() === trimmed.toLowerCase())) {
    return `There is already a floor called "${trimmed}".`;
  }
  return null;
}

export function addFloor(
  floors: FloorPlanLevel[], activeIndex: number, state: FloorState, name: string, storeyHeight: number, newId: () => string
): FloorsView {
  const committed = commitActive(floors, activeIndex, state);
  const level: FloorPlanLevel = { id: newId(), name: name.trim(), elevation: committed.length * storeyHeight, ...emptyFloorState() };
  const next = [...committed, level];
  return { floors: next, activeIndex: next.length - 1, state: levelToState(level) };
}

/** Copies the current floor. Every element gets a new id, and hosted doors/windows follow their copied wall. */
export function duplicateFloor(
  floors: FloorPlanLevel[], activeIndex: number, state: FloorState, name: string, storeyHeight: number, newId: (prefix: string) => string
): FloorsView {
  const committed = commitActive(floors, activeIndex, state);
  const src = clone(levelToState(committed[activeIndex]));
  const wallIds = new Map<string, string>();
  const walls = src.walls.map(w => { const id = newId('wall'); wallIds.set(w.id, id); return { ...w, id }; });
  const rehost = <T extends { wallId?: string }>(o: T): T => (o.wallId ? { ...o, wallId: wallIds.get(o.wallId) } : o);
  const level: FloorPlanLevel = {
    id: newId('level'),
    name: name.trim(),
    elevation: committed.length * storeyHeight,
    walls,
    rooms: src.rooms.map(r => ({ ...r, id: newId('room') })),
    doors: src.doors.map(d => rehost({ ...d, id: newId('door') })),
    windows: src.windows.map(w => rehost({ ...w, id: newId('win') })),
    furniture: src.furniture.map(f => rehost({ ...f, id: newId('furn') })),
    stairs: src.stairs.map(s => ({ ...s, id: newId('stair') })),
    columns: src.columns.map(c => ({ ...c, id: newId('col') })),
    annotations: src.annotations.map(a => ({ ...a, id: newId('annot') })),
  };
  const next = [...committed, level];
  return { floors: next, activeIndex: next.length - 1, state: levelToState(level) };
}

export function renameFloor(floors: FloorPlanLevel[], index: number, name: string): FloorPlanLevel[] {
  return floors.map((f, i) => (i === index ? { ...f, name: name.trim() } : f));
}

/**
 * Removes a floor. The floor shown afterwards is loaded from the remaining floors, never from
 * what was on screen, so a deleted floor's drawing can not end up inside another floor.
 * The last remaining floor can not be deleted.
 */
export function deleteFloor(floors: FloorPlanLevel[], activeIndex: number, state: FloorState, index: number): FloorsView | null {
  if (floors.length <= 1 || index < 0 || index >= floors.length) return null;
  const committed = commitActive(floors, activeIndex, state);
  const next = committed.filter((_, i) => i !== index);
  const nextActive = index < activeIndex ? activeIndex - 1 : index === activeIndex ? Math.max(0, index - 1) : activeIndex;
  return { floors: next, activeIndex: nextActive, state: levelToState(next[nextActive]) };
}

// ---------------------------------------------------------------------------
// Undo / redo
// ---------------------------------------------------------------------------

/**
 * Undo history kept separately for each floor. Undo on one floor can therefore never bring
 * back another floor's drawing.
 */
export class PlanHistory {
  private stacks = new Map<string, { entries: FloorState[]; index: number }>();
  private limit: number;

  constructor(limit = 60) {
    this.limit = limit;
  }

  /** Starts (or restarts) a floor's history at this state. */
  reset(floorId: string, state: FloorState): void {
    this.stacks.set(floorId, { entries: [clone(state)], index: 0 });
  }

  has(floorId: string): boolean {
    return this.stacks.has(floorId);
  }

  /** Records a new state. Anything that had been undone is discarded, as usual. */
  push(floorId: string, state: FloorState): void {
    const stack = this.stacks.get(floorId);
    if (!stack) return this.reset(floorId, state);
    const snapshot = clone(state);
    if (JSON.stringify(stack.entries[stack.index]) === JSON.stringify(snapshot)) return; // nothing changed
    stack.entries = stack.entries.slice(0, stack.index + 1);
    stack.entries.push(snapshot);
    if (stack.entries.length > this.limit) stack.entries.shift();
    stack.index = stack.entries.length - 1;
  }

  canUndo(floorId: string): boolean {
    const s = this.stacks.get(floorId);
    return !!s && s.index > 0;
  }

  canRedo(floorId: string): boolean {
    const s = this.stacks.get(floorId);
    return !!s && s.index < s.entries.length - 1;
  }

  undo(floorId: string): FloorState | null {
    const s = this.stacks.get(floorId);
    if (!s || s.index <= 0) return null;
    s.index -= 1;
    return clone(s.entries[s.index]);
  }

  redo(floorId: string): FloorState | null {
    const s = this.stacks.get(floorId);
    if (!s || s.index >= s.entries.length - 1) return null;
    s.index += 1;
    return clone(s.entries[s.index]);
  }

  forget(floorId: string): void {
    this.stacks.delete(floorId);
  }
}

// ---------------------------------------------------------------------------
// Keeping one floor consistent
// ---------------------------------------------------------------------------

export interface NormaliseResult {
  state: FloorState;
  roomsAdded: FloorPlanRoom[];
  roomsRemoved: FloorPlanRoom[];
  openingsRemoved: number;
}

/**
 * Brings a floor back to a consistent state after its walls changed: doors and windows stay
 * on their walls (or go with a deleted wall) and wall-enclosed rooms are recalculated.
 */
export function normaliseFloor(state: FloorState, unit: FloorPlanUnit, newId: () => string): NormaliseResult {
  const doors = reanchorOpenings(state.doors, state.walls);
  const windows = reanchorOpenings(state.windows, state.walls);
  const rooms = syncRoomsWithWalls(state.rooms, state.walls, unit, newId);
  const changed = doors.changed || windows.changed || rooms.changed;
  return {
    state: changed ? { ...state, doors: doors.openings, windows: windows.openings, rooms: rooms.rooms } : state,
    roomsAdded: rooms.added,
    roomsRemoved: rooms.removed,
    openingsRemoved: doors.removed.length + windows.removed.length,
  };
}

// ---------------------------------------------------------------------------
// Saving
// ---------------------------------------------------------------------------

/**
 * A small picture of the ground floor for plan lists, as a self-contained SVG data URL.
 * (A `blob:` URL must never be stored: it stops working as soon as the page is closed.)
 */
export function buildThumbnail(state: FloorState, plotLength: number, plotWidth: number): string {
  const W = 240, H = 180, pad = 10;
  const xs = [0, plotLength, ...state.walls.flatMap(w => [w.x1, w.x2])];
  const ys = [0, plotWidth, ...state.walls.flatMap(w => [w.y1, w.y2])];
  const minX = Math.min(...xs), minY = Math.min(...ys);
  const spanX = Math.max(1, Math.max(...xs) - minX), spanY = Math.max(1, Math.max(...ys) - minY);
  const k = Math.min((W - pad * 2) / spanX, (H - pad * 2) / spanY);
  const ox = (W - spanX * k) / 2, oy = (H - spanY * k) / 2;
  const px = (x: number) => (ox + (x - minX) * k).toFixed(1);
  const py = (y: number) => (oy + (y - minY) * k).toFixed(1);
  const rooms = state.rooms.map(r => {
    const pts = r.polygonPoints && r.polygonPoints.length >= 3
      ? r.polygonPoints
      : [{ x: r.x, y: r.y }, { x: r.x + r.width, y: r.y }, { x: r.x + r.width, y: r.y + r.height }, { x: r.x, y: r.y + r.height }];
    return `<polygon points="${pts.map(p => `${px(p.x)},${py(p.y)}`).join(' ')}" fill="#fde9c8"/>`;
  }).join('');
  const walls = state.walls.map(w =>
    `<line x1="${px(w.x1)}" y1="${py(w.y1)}" x2="${px(w.x2)}" y2="${py(w.y2)}" stroke="#1e293b" stroke-width="${Math.max(1.5, (w.thickness || 0.5) * k).toFixed(1)}" stroke-linecap="square"/>`
  ).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#f8fafc"/>${rooms}${walls}</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export type SavePayload = Pick<FloorPlan,
  'walls' | 'rooms' | 'doors' | 'windows' | 'furniture' | 'stairs' | 'columns' | 'annotations' | 'floors' | 'thumbnailDataUrl' | 'floorName'>;

/**
 * Everything written when a plan is saved. All floors are saved together. The plan's top-level
 * drawing fields always mirror the ground floor (older screens read them), whichever floor is
 * being edited.
 */
export function buildSavePayload(plan: Pick<FloorPlan, 'plotLength' | 'plotWidth' | 'floorName'>, floors: FloorPlanLevel[], activeIndex: number, state: FloorState): SavePayload {
  const committed = commitActive(floors, activeIndex, state);
  const ground = levelToState(committed[0]);
  return {
    ...ground,
    floors: committed,
    floorName: committed[0]?.name || plan.floorName,
    thumbnailDataUrl: buildThumbnail(ground, plan.plotLength, plan.plotWidth),
  };
}

// ---------------------------------------------------------------------------
// Export / import
// ---------------------------------------------------------------------------

export const PLAN_EXPORT_SCHEMA = '2.1.0';
export const PLAN_DISCLAIMER =
  'Conceptual layout for planning and discussion. Not a certified structural or architectural drawing. Verify all dimensions on site.';

export interface PlanExport {
  application: string;
  schemaVersion: string;
  exportedAt: string;
  disclaimer: string;
  project: { name: string; units: FloorPlanUnit; plotLength: number; plotWidth: number; ceilingHeight?: number };
  floors: FloorPlanLevel[];
}

export function exportPlan(plan: FloorPlan, floors: FloorPlanLevel[], exportedAt: string): PlanExport {
  return {
    application: 'Mistry Floor Planner',
    schemaVersion: PLAN_EXPORT_SCHEMA,
    exportedAt,
    disclaimer: PLAN_DISCLAIMER,
    project: { name: plan.buildingName, units: plan.unit, plotLength: plan.plotLength, plotWidth: plan.plotWidth, ceilingHeight: plan.ceilingHeight },
    floors: clone(floors),
  };
}

export interface ImportedPlan {
  buildingName: string;
  unit: FloorPlanUnit;
  plotLength: number;
  plotWidth: number;
  ceilingHeight?: number;
  floors: FloorPlanLevel[];
}

const UNITS: FloorPlanUnit[] = ['feet', 'meters', 'inches', 'centimeters'];
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : NaN);

function cleanLevel(raw: any, index: number): FloorPlanLevel {
  const list = (v: unknown) => (Array.isArray(v) ? v.filter(x => x && typeof x === 'object') : []);
  const walls = list(raw?.walls).filter((w: any) => [w.x1, w.y1, w.x2, w.y2].every(v => Number.isFinite(num(v)))).map((w: any, i: number) => ({
    ...w, id: String(w.id || `wall-import-${index}-${i}`), x1: num(w.x1), y1: num(w.y1), x2: num(w.x2), y2: num(w.y2),
    thickness: Number.isFinite(num(w.thickness)) && num(w.thickness) > 0 ? num(w.thickness) : 0.5, wallType: w.wallType || 'interior',
  }));
  const placed = (items: any[], prefix: string) =>
    items.filter(o => Number.isFinite(num(o.x)) && Number.isFinite(num(o.y))).map((o, i) => ({ ...o, id: String(o.id || `${prefix}-import-${index}-${i}`), x: num(o.x), y: num(o.y) }));
  return {
    id: String(raw?.id || `level-import-${index}`),
    name: typeof raw?.name === 'string' && raw.name.trim() ? raw.name.trim().slice(0, 40) : DEFAULT_FLOOR_NAMES[index] || `Floor ${index + 1}`,
    elevation: Number.isFinite(num(raw?.elevation)) ? num(raw.elevation) : undefined,
    walls,
    rooms: placed(list(raw?.rooms), 'room'),
    doors: placed(list(raw?.doors), 'door'),
    windows: placed(list(raw?.windows), 'win'),
    furniture: placed(list(raw?.furniture), 'furn'),
    stairs: placed(list(raw?.stairs), 'stair'),
    columns: placed(list(raw?.columns), 'col'),
    annotations: placed(list(raw?.annotations), 'annot'),
  };
}

/**
 * Reads a plan file: either this app's export (`project` + `floors`) or the older flat format
 * (`floorName`, `plotLength`, `walls`, ...). Throws an Error with a plain message when the file
 * is not a floor plan. Nothing in the file is trusted: numbers are checked and bad items dropped.
 */
export function parsePlanFile(text: string): ImportedPlan {
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('This file is not a floor plan file (it is not valid JSON).');
  }
  if (!data || typeof data !== 'object') throw new Error('This file is not a floor plan file.');

  const project = data.project && typeof data.project === 'object' ? data.project : data;
  const plotLength = num(project.plotLength);
  const plotWidth = num(project.plotWidth);
  if (!(plotLength > 0) || !(plotWidth > 0)) throw new Error('This file has no plot size, so it can not be opened as a floor plan.');

  const unitRaw = project.units || project.unit || data.unit;
  const unit: FloorPlanUnit = UNITS.includes(unitRaw) ? unitRaw : 'feet';
  const rawFloors: any[] = Array.isArray(data.floors) && data.floors.length > 0
    ? data.floors
    : [{ name: data.floorName, walls: data.walls, rooms: data.rooms, doors: data.doors, windows: data.windows, furniture: data.furniture, stairs: data.stairs, columns: data.columns, annotations: data.annotations }];

  const floors = rawFloors.slice(0, 20).map(cleanLevel);
  // Flat files that also carry empty placeholder floors keep their drawing in the top-level fields.
  if (!floors.some(hasGeometry) && hasGeometry(levelToState(data))) floors[0] = { ...floors[0], ...levelToState(cleanLevel(data, 0)) };

  const name = project.name || data.buildingName || data.floorName || 'Imported plan';
  const ceiling = num(project.ceilingHeight ?? data.ceilingHeight);
  return {
    buildingName: String(name).slice(0, 80),
    unit,
    plotLength,
    plotWidth,
    ceilingHeight: ceiling > 0 ? ceiling : undefined,
    floors,
  };
}
