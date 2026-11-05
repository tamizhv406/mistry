/**
 * Building Mistry AI, on the device: turns a typed request into a checked change to the floor
 * being edited.
 *
 *   "Fix my plan"                      joins small gaps, lines up walls that are a few mm out,
 *                                      removes duplicate and zero-length walls
 *   "Make this bedroom 10 feet wide"   moves the room's wall (rooms next to it follow)
 *   "Add a bathroom" / "… in bedroom"  draws a walled room with a door
 *   "Rename this room to Kitchen"      names the selected room
 *
 * Nothing is applied here. A request becomes a PROPOSAL: the complete next floor, a list of
 * what changes and anything that would be removed. The editor previews it and applies it only
 * when the user taps Apply, as one undoable step. A request that is not understood, or that
 * would not work on this plan, gets a plain answer and the plan is left as it is.
 */
import type { FloorPlanUnit, FloorPlanWall, RoomType } from '../db/types';
import {
  addRoom, applyAlignmentFix, findAlignmentIssues, formatMm, resizeRoom, roomName, type AlignmentIssue, type EditResult, type NewId,
} from '../domain/planEdit';
import { formatPlanArea, joinTolerance, baseUnitOf, moveJoint, roomArea, wallLengthOf, type Pt } from '../domain/planGeometry';
import { normaliseFloor, prepareForWallEdit, type FloorState } from '../domain/planDocument';
import { formatDimension, parseLengthInput } from '../domain/planMeasure';
import { pointSegmentDistance } from '../domain/planSketch';

export interface PlanProposal {
  title: string;
  summary: string;
  changes: string[];
  warnings: string[];
  /** True when something on the plan would be removed. The user confirms these twice. */
  destructive: boolean;
  next: FloorState;
  focus?: Pt;
}

export interface CommandOption { label: string; roomId: string }

export type CommandResult =
  | { kind: 'proposal'; proposal: PlanProposal }
  | { kind: 'answer'; message: string }
  | { kind: 'question'; message: string; options: CommandOption[] }
  | { kind: 'unknown'; message: string };

export interface CommandContext {
  state: FloorState;
  unit: FloorPlanUnit;
  plot: { length: number; width: number };
  selected?: { type: string; id: string } | null;
  /** Set when the user picked a room from a question: the request is about that room. */
  targetRoomId?: string;
  newId: NewId;
}

export const COMMAND_EXAMPLES = [
  'Fix my plan',
  'Make this bedroom 10 feet wide',
  'Add a bathroom',
  'Make this room 12 by 14 feet',
  'Rename this room to Kitchen',
];

const HELP = 'I can fix small gaps and measurement differences ("Fix my plan"), change a room size ("Make this bedroom 10 feet wide"), add a room ("Add a bathroom") or rename the selected room.';

// ---------------------------------------------------------------------------
// Reading the request
// ---------------------------------------------------------------------------

const ROOM_WORDS: { re: RegExp; type: RoomType }[] = [
  { re: /\bmaster\s*bed\s*room\b|\bmaster\b/, type: 'Master Bedroom' },
  { re: /\bguest\s*room\b/, type: 'Guest Room' },
  { re: /\bkids?\s*room\b|\bchildren'?s?\s*room\b/, type: 'Kids Room' },
  { re: /\bbed\s*rooms?\b/, type: 'Bedroom' },
  { re: /\bkitchen\b|\bsamayal\b/, type: 'Kitchen' },
  { re: /\bbath\s*rooms?\b|\bwash\s*rooms?\b|\bbath\b/, type: 'Bathroom' },
  { re: /\btoilets?\b|\bw\.?c\b|\brestroom\b/, type: 'Toilet' },
  { re: /\bliving\s*(room)?\b|\bhall\b|\blounge\b/, type: 'Living Room' },
  { re: /\bdining\b/, type: 'Dining' },
  { re: /\bpooja\b|\bpuja\b|\bprayer\b/, type: 'Pooja' },
  { re: /\bstore\s*(room)?\b|\bstorage\b/, type: 'Store' },
  { re: /\bbalcon(y|ies)\b/, type: 'Balcony' },
  { re: /\bstudy\b/, type: 'Study' },
  { re: /\boffice\b/, type: 'Office' },
  { re: /\butility\b|\bwash\s*area\b/, type: 'Utility' },
  { re: /\bparking\b|\bgarage\b|\bcar\s*porch\b/, type: 'Parking' },
  { re: /\bcorridor\b|\bpassage\b/, type: 'Corridor' },
];

function roomTypeIn(text: string): RoomType | null {
  for (const w of ROOM_WORDS) if (w.re.test(text)) return w.type;
  return null;
}

/**
 * Lengths written in the request, in plan units: "10 feet", "10ft 6in", "10'", "3.5 m",
 * "3500 mm", or a plain number (in the plan's own unit).
 */
export function lengthsIn(text: string, unit: FloorPlanUnit): number[] {
  // Longer unit words first ("mm" before "m"). A bare "in" is only inches straight after a
  // number ("6in") or after feet ("10 ft 6 in"): "7 in bedroom" means the room, not inches.
  const re = /(\d+(?:\.\d+)?)(?:\s*(millimet(?:er|re)s?|mm|centimet(?:er|re)s?|cm|feet|foot|ft|metres?|meters?|mtrs?|inch(?:es)?|'|"|m(?![a-z]))|(in)(?![a-z]))?(?:\s*(\d+(?:\.\d+)?)\s*(?:inch(?:es)?|in(?![a-z])|"))?/g;
  const found: { num: string; unit: string; inches?: string }[] = [];
  for (const m of text.matchAll(re)) {
    const word = m[2] || m[3] || '';
    const u = /^(feet|foot|ft|')$/.test(word) ? 'ft' : /^(m|metres?|meters?|mtrs?)$/.test(word) ? 'm'
      : /^(mm|millimet)/.test(word) ? 'mm' : /^(cm|centimet)/.test(word) ? 'cm' : /^(in|inch|")/.test(word) ? 'in' : '';
    found.push({ num: m[1], unit: u, inches: u === 'ft' ? m[4] : undefined });
  }
  // "12 by 14 feet": a number without a unit takes the unit written with the others.
  const written = [...found].reverse().find(f => f.unit)?.unit || '';
  const out: number[] = [];
  for (const f of found) {
    const u = f.unit || written;
    const typed = u === 'ft' && f.inches ? `${f.num}ft ${f.inches}in` : `${f.num}${u}`;
    const r = parseLengthInput(typed, unit, { min: 0.0001, max: 100000 });
    if (r.ok) out.push(r.value);
  }
  return out;
}

/** The request with room names taken out, so "bedroom 2" is not read as a 2 ft length. */
function withoutRoomNames(text: string, ctx: CommandContext): string {
  let out = text;
  const labels = ctx.state.rooms.map(r => (r.label || '').toLowerCase().trim()).filter(l => /\d/.test(l)).sort((a, b) => b.length - a.length);
  for (const l of labels) out = out.replace(new RegExp(`\\b${l.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b(?!\\s*(?:feet|foot|ft|'|m\\b|mm|cm|metres?|meters?|by))`, 'g'), ' ');
  return out;
}

const norm = (text: string) =>
  ` ${text.toLowerCase().replace(/[×*]/g, ' by ').replace(/(\d)\s*x\s*(\d)/g, '$1 by $2').replace(/\s+/g, ' ').trim()} `;

// ---------------------------------------------------------------------------
// Choosing the room a request is about
// ---------------------------------------------------------------------------

type RoomPick = { roomId: string } | { result: CommandResult };

function pickRoom(text: string, ctx: CommandContext, purpose: string): RoomPick {
  const rooms = ctx.state.rooms;
  if (ctx.targetRoomId && rooms.some(r => r.id === ctx.targetRoomId)) return { roomId: ctx.targetRoomId };
  const selectedRoom = ctx.selected?.type === 'room' ? rooms.find(r => r.id === ctx.selected!.id) : undefined;
  if (!rooms.length) return { result: { kind: 'answer', message: 'There are no rooms on this floor yet. Draw walls that close a space, then ask again.' } };

  // A room named in the request: its exact label first ("bedroom 2"), then its type.
  // "this bedroom", "this room": the room selected on the plan, whatever it is called.
  if (/\b(this|selected|current|that|it)\b/.test(text) && selectedRoom) return { roomId: selectedRoom.id };
  const byLabel = rooms.filter(r => r.label && new RegExp(`\\b${r.label.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(text));
  if (byLabel.length === 1) return { roomId: byLabel[0].id };
  const type = roomTypeIn(text);
  if (type) {
    const word = type.toLowerCase().split(' ')[0];
    const matches = rooms.filter(r => r.roomType === type || (r.label || '').toLowerCase().includes(word));
    if (matches.length === 1) return { roomId: matches[0].id };
    if (matches.length > 1) {
      if (selectedRoom && matches.some(m => m.id === selectedRoom.id)) return { roomId: selectedRoom.id };
      return { result: { kind: 'question', message: `Which ${type.toLowerCase()} ${purpose}?`, options: matches.map(m => ({ label: `${roomName(m)} (${formatPlanArea(roomArea(m), ctx.unit)})`, roomId: m.id })) } };
    }
    if (!selectedRoom) {
      return { result: { kind: 'question', message: `No room is named ${type.toLowerCase()} yet. Which room ${purpose}?`, options: rooms.map(m => ({ label: roomName(m), roomId: m.id })) } };
    }
  }
  if (selectedRoom) return { roomId: selectedRoom.id };
  if (rooms.length === 1) return { roomId: rooms[0].id };
  return { result: { kind: 'question', message: `Which room ${purpose}? You can also tap the room on the plan and ask again.`, options: rooms.map(m => ({ label: roomName(m), roomId: m.id })) } };
}

const fromEdit = (title: string, r: Extract<EditResult, { ok: true }>, destructive = false): CommandResult => ({
  kind: 'proposal',
  proposal: { title, summary: r.summary, changes: r.changes, warnings: r.warnings, destructive: destructive || r.warnings.some(w => /removed|went with/.test(w)), next: r.state, focus: r.focus },
});

// ---------------------------------------------------------------------------
// "Fix my plan"
// ---------------------------------------------------------------------------

/**
 * Which of an issue's two measurements to keep: the one that lines up with other walls, then
 * the rounder number (on site a tape reading of 150 is likelier than 140.6), then the first.
 */
export function preferredMeasurement(issue: AlignmentIssue, walls: FloorPlanWall[], unit: FloorPlanUnit): 0 | 1 {
  const tol = 1e-6;
  const shared = (v: number) => walls.filter(w => !issue.wallIds.includes(w.id) && (issue.orientation === 'horizontal'
    ? Math.abs(w.y1 - v) < tol || Math.abs(w.y2 - v) < tol
    : Math.abs(w.x1 - v) < tol || Math.abs(w.x2 - v) < tol)).length;
  const [a, b] = issue.measurements;
  const sa = shared(a.value), sb = shared(b.value);
  if (sa !== sb) return sa > sb ? 0 : 1;
  const step = baseUnitOf(unit) === 'feet' ? 25.4 / 2 : 5; // half an inch, or 5 mm
  const off = (mm: number) => Math.abs(mm / step - Math.round(mm / step));
  if (Math.abs(off(a.mm) - off(b.mm)) > 1e-6) return off(a.mm) < off(b.mm) ? 0 : 1;
  return 0;
}

function fixPlan(ctx: CommandContext): CommandResult {
  const { unit, newId } = ctx;
  const tol = joinTolerance(unit);
  let state = prepareForWallEdit(ctx.state, unit);
  const changes: string[] = [];
  const warnings: string[] = [];
  let destructive = false;

  // 1. Zero-length and tiny walls.
  const tiny = baseUnitOf(unit) === 'feet' ? 0.2 : 0.05;
  const small = state.walls.filter(w => wallLengthOf(w) < tiny && !w.locked);
  if (small.length) {
    state = { ...state, walls: state.walls.filter(w => !small.includes(w)) };
    changes.push(`Removed ${small.length} wall piece${small.length === 1 ? '' : 's'} shorter than ${formatDimension(tiny, unit)}.`);
    destructive = true;
  }

  // 2. Walls drawn twice on top of each other.
  const same = (a: FloorPlanWall, b: FloorPlanWall) =>
    (Math.hypot(a.x1 - b.x1, a.y1 - b.y1) < tol / 3 && Math.hypot(a.x2 - b.x2, a.y2 - b.y2) < tol / 3) ||
    (Math.hypot(a.x1 - b.x2, a.y1 - b.y2) < tol / 3 && Math.hypot(a.x2 - b.x1, a.y2 - b.y1) < tol / 3);
  const dupes = state.walls.filter((w, i) => !w.locked && state.walls.slice(0, i).some(o => same(o, w)));
  if (dupes.length) {
    state = { ...state, walls: state.walls.filter(w => !dupes.includes(w)), doors: state.doors.map(d => (dupes.some(w => w.id === d.wallId) ? { ...d, wallId: undefined } : d)) };
    changes.push(`Removed ${dupes.length} wall${dupes.length === 1 ? '' : 's'} drawn twice in the same place.`);
    destructive = true;
  }

  // 3. Wall ends that almost meet another wall end.
  const reach = baseUnitOf(unit) === 'feet' ? 1.5 : 0.45;
  const joinedAt = (p: Pt, self: FloorPlanWall) => state.walls.some(o => o.id !== self.id && (
    Math.hypot(o.x1 - p.x, o.y1 - p.y) <= tol || Math.hypot(o.x2 - p.x, o.y2 - p.y) <= tol ||
    pointSegmentDistance(p, { x: o.x1, y: o.y1 }, { x: o.x2, y: o.y2 }) <= tol));
  let gaps = 0;
  let widest = 0;
  // Of two loose ends, the one that moves is the one whose wall stays straight: the wall is
  // extended along its own line rather than tilted.
  const offLine = (w: FloorPlanWall, q: Pt) => {
    const len = wallLengthOf(w) || 1;
    return Math.abs((q.x - w.x1) * (w.y2 - w.y1) - (q.y - w.y1) * (w.x2 - w.x1)) / len;
  };
  for (let guard = 0; guard < 50; guard++) {
    let best: { from: Pt; to: Pt; d: number; tilt: number } | null = null;
    for (const w of state.walls) {
      if (w.locked) continue;
      for (const p of [{ x: w.x1, y: w.y1 }, { x: w.x2, y: w.y2 }]) {
        if (joinedAt(p, w)) continue;
        for (const o of state.walls) {
          if (o.id === w.id) continue;
          for (const q of [{ x: o.x1, y: o.y1 }, { x: o.x2, y: o.y2 }]) {
            const d = Math.hypot(q.x - p.x, q.y - p.y);
            if (d <= tol || d > reach) continue;
            const tilt = offLine(w, q);
            if (!best || tilt < best.tilt - 1e-9 || (Math.abs(tilt - best.tilt) <= 1e-9 && d < best.d)) best = { from: p, to: q, d, tilt };
          }
        }
      }
    }
    if (!best) break;
    state = { ...state, walls: moveJoint(state.walls, best.from, best.to, 1e-9) };
    gaps += 1;
    widest = Math.max(widest, best.d);
  }
  if (gaps) changes.push(`Joined ${gaps} open corner${gaps === 1 ? '' : 's'} (largest gap ${formatDimension(widest, unit)}).`);

  // 4. Measurements a few millimetres apart that should be the same.
  for (let guard = 0; guard < 30; guard++) {
    const issue = findAlignmentIssues(state.walls, unit)[0];
    if (!issue) break;
    const keep = preferredMeasurement(issue, state.walls, unit);
    const fixed = applyAlignmentFix(state, issue, keep, unit, newId);
    if (!fixed.ok) { warnings.push(fixed.reason); break; }
    state = fixed.state;
    const other = issue.measurements[keep === 0 ? 1 : 0];
    changes.push(`${issue.kind === 'step' ? 'Lined up two walls' : 'Straightened a wall'}: ${formatMm(issue.measurements[keep].mm)} and ${formatMm(other.mm)} from ${issue.reference} differed by ${formatMm(issue.differenceMm)}; ${formatMm(issue.measurements[keep].mm)} was kept.`);
  }

  if (!changes.length) {
    return { kind: 'answer', message: 'Nothing to fix: no open corners, duplicate walls or small measurement differences were found on this floor.' };
  }
  const next = normaliseFloor(state, unit, () => newId('room'));
  if (next.openingsRemoved) { warnings.push(`${next.openingsRemoved} door/window no longer fits its wall and will be removed.`); destructive = true; }
  return {
    kind: 'proposal',
    proposal: { title: 'Fix my plan', summary: `${changes.length} fix${changes.length === 1 ? '' : 'es'} ready. Check them, then Apply.`, changes, warnings, destructive, next: next.state },
  };
}

// ---------------------------------------------------------------------------
// The interpreter
// ---------------------------------------------------------------------------

/** Reads one request against the current floor. Never changes `ctx.state`. */
export function interpretPlanCommand(raw: string, ctx: CommandContext): CommandResult {
  const input = typeof raw === 'string' ? raw : '';
  if (!input.trim()) return { kind: 'unknown', message: 'Type what you want to change, for example "Add a bathroom".' };
  if (input.length > 500) return { kind: 'unknown', message: 'That request is too long. Ask for one change at a time.' };
  if (!ctx || !ctx.state || !Array.isArray(ctx.state.walls) || !Array.isArray(ctx.state.rooms)) {
    return { kind: 'unknown', message: 'The plan is still loading. Try again in a moment.' };
  }
  const text = norm(input);

  if (/\b(fix|repair|correct|clean ?up|tidy|check)\b/.test(text) && /\b(plan|drawing|walls?|lines?|dimensions?|measurements?|it|all|everything|geometry)\b/.test(text)
    || /\bsari ?pannu\b|\bfix my plan\b/.test(text)) {
    return fixPlan(ctx);
  }

  // Rename: "rename this room to Kitchen", "rename bedroom 2 as Guest Room", "call it Pooja".
  const rename = input.match(/\b(rename|call|name)\b\s*(.*)$/i);
  if (rename && !/\b(add|create)\b/i.test(input)) {
    const rest = rename[2];
    const to = rest.match(/^(.*?)\b(?:to|as)\b\s*(.+)$/i);
    const which = to ? to[1] : '';
    const raw = (to ? to[2] : rest.replace(/^(this|the|selected)\s+/i, '').replace(/^(room|it)\s+/i, ''))
      .replace(/["“”]/g, '').trim().slice(0, 40);
    if (!raw) return { kind: 'unknown', message: 'Say the new name, for example "Rename this room to Kitchen".' };
    const pick = pickRoom(norm(`${rename[1]} ${which || 'this'}`), ctx, 'should be renamed');
    if ('result' in pick) return pick.result;
    const label = raw.replace(/\b[a-z]/g, c => c.toUpperCase());
    const room = ctx.state.rooms.find(r => r.id === pick.roomId)!;
    const type = roomTypeIn(` ${label.toLowerCase()} `);
    const next = { ...ctx.state, rooms: ctx.state.rooms.map(r => (r.id === room.id ? { ...r, label, ...(type ? { roomType: type } : {}) } : r)) };
    return { kind: 'proposal', proposal: { title: 'Rename room', summary: `${roomName(room)} will be called ${label}.`, changes: [`${roomName(room)} → ${label}`], warnings: [], destructive: false, next } };
  }

  const lengths = lengthsIn(withoutRoomNames(text, ctx), ctx.unit);
  const wantsWidth = /\b(wide|width|breadth)\b/.test(text);
  const wantsLength = /\b(long|length|deep|depth)\b/.test(text);
  const isAdd = /\b(add|create|insert|put|new|need|want|build|make (?:a|an|one|another))\b/.test(text) && !/\b(wide|width|long|length|deep|depth)\b/.test(text);

  if (isAdd) {
    const type = roomTypeIn(text.replace(/\b(in|inside|into|within)\b.*$/, ''));
    if (!type) {
      return { kind: 'unknown', message: 'Which room should be added? For example "Add a bathroom" or "Add a kitchen 10 by 8 feet".' };
    }
    let insideRoomId: string | undefined = ctx.targetRoomId;
    const inside = text.match(/\b(?:in|inside|into|within)\b(.*)$/);
    if (!insideRoomId && inside) {
      const pick = pickRoom(inside[1], { ...ctx, targetRoomId: undefined }, 'should it go in');
      if ('result' in pick) return pick.result;
      insideRoomId = pick.roomId;
    }
    const size = lengths.length >= 2 ? { width: lengths[0], length: lengths[1] } : {};
    const r = addRoom(ctx.state, type, ctx.unit, ctx.plot, ctx.newId, { insideRoomId, ...size });
    if (!r.ok) {
      const sel = ctx.selected?.type === 'room' ? ctx.state.rooms.find(x => x.id === ctx.selected!.id) : undefined;
      if (!insideRoomId && sel) {
        const again = addRoom(ctx.state, type, ctx.unit, ctx.plot, ctx.newId, { insideRoomId: sel.id, ...size });
        if (again.ok) return fromEdit(`Add a ${type.toLowerCase()}`, again);
      }
      return { kind: 'answer', message: `${r.reason} The plan was not changed.` };
    }
    return fromEdit(`Add a ${type.toLowerCase()}`, r);
  }

  if (lengths.length && (wantsWidth || wantsLength || /\bby\b/.test(text))) {
    const pick = pickRoom(text, ctx, 'should change');
    if ('result' in pick) return pick.result;
    let size: { width?: number; length?: number };
    if (lengths.length >= 2 && /\bby\b/.test(text)) size = { width: lengths[0], length: lengths[1] };
    else if (wantsWidth && !wantsLength) size = { width: lengths[0] };
    else if (wantsLength && !wantsWidth) size = { length: lengths[0] };
    else if (lengths.length >= 2) size = { width: lengths[0], length: lengths[1] };
    else return { kind: 'unknown', message: 'Should that be the width (left to right) or the length (top to bottom)? Say "10 feet wide" or "10 feet long".' };
    const sides: { width?: 'left' | 'right'; length?: 'top' | 'bottom' } = {};
    if (/\b(left|west)\b/.test(text)) sides.width = 'left';
    if (/\b(right|east)\b/.test(text)) sides.width = 'right';
    if (/\b(top|north|upper)\b/.test(text)) sides.length = 'top';
    if (/\b(bottom|south|lower)\b/.test(text)) sides.length = 'bottom';
    const r = resizeRoom(ctx.state, pick.roomId, size, ctx.unit, ctx.newId, sides, ctx.plot);
    if (!r.ok) return { kind: 'answer', message: `${r.reason} The plan was not changed.` };
    const room = ctx.state.rooms.find(x => x.id === pick.roomId)!;
    return fromEdit(`Change ${roomName(room)}`, r);
  }

  if (lengths.length && roomTypeIn(text)) {
    return { kind: 'unknown', message: 'Should that be the width or the length? For example "Make this bedroom 10 feet wide".' };
  }

  if (/\b(area|how big|size|how many rooms|total)\b/.test(text)) {
    const rooms = ctx.state.rooms;
    if (!rooms.length) return { kind: 'answer', message: 'There are no rooms on this floor yet.' };
    const total = rooms.reduce((s, r) => s + roomArea(r), 0);
    const list = rooms.map(r => `${roomName(r)} ${formatPlanArea(roomArea(r), ctx.unit)}`).join('; ');
    return { kind: 'answer', message: `${rooms.length} room${rooms.length === 1 ? '' : 's'}, ${formatPlanArea(total, ctx.unit)} in all (wall centre lines). ${list}.` };
  }

  return { kind: 'unknown', message: HELP };
}
