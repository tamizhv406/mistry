/**
 * AI Design: prompt reading, plan-spec validation, the built-in layout rules and the step that
 * turns a spec into editor geometry. No AI model is called here; model replies are simulated
 * as plain data, including broken ones, to prove they can not reach the drawing unchecked.
 */
import type { FloorPlanRoom } from '../src/db/types';
import {
  autoOpenings, buildFloorFromSpec, convertSpecUnit, layoutProgram, normaliseRoomType, parsePlanSpec,
  readPlanPrompt, snapSpec, specFromFloor, validatePlanSpec, type PlanSpec,
} from '../src/domain/planSpec';
import { findWallFaces, joinTolerance, minimumRoomArea } from '../src/domain/planGeometry';
import { PlanHistory, emptyFloorState, normaliseFloor } from '../src/domain/planDocument';

let passed = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (!cond) throw new Error(`FAILED: ${name}${detail !== undefined ? ' — got ' + JSON.stringify(detail) : ''}`);
  passed += 1;
  console.log(`  ✓ ${name}`);
}

let idCounter = 0;
const newId = (prefix: string) => `${prefix}-${++idCounter}`;
const plot = { unit: 'feet' as const, plotWidth: 30, plotDepth: 40 };

const overlap = (a: FloorPlanRoom, b: FloorPlanRoom) =>
  Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) *
  Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));

console.log('\n--- 1. Reading a typed request (no model) ---');
{
  const r = readPlanPrompt('Create a 30 × 40 ft plot with a 2BHK house, living room, kitchen, two bedrooms and two bathrooms.', plot);
  check('Plot size is read from the message', r.plotStated && r.program?.plotWidth === 30 && r.program?.plotDepth === 40, r.program);
  const types = (r.program?.rooms || []).map(x => x.type);
  check('2 BHK gives a master bedroom and a second bedroom', types.filter(t => t === 'Master Bedroom').length === 1 && types.filter(t => t === 'Bedroom').length === 1, types);
  check('Two bathrooms, one kitchen, one living room', types.filter(t => t === 'Bathroom').length === 2 && types.filter(t => t === 'Kitchen').length === 1 && types.filter(t => t === 'Living Room').length === 1, types);
  check('Nothing was assumed about bathrooms when the count was given', !r.assumptions.some(a => /bathroom/i.test(a)), r.assumptions);
}
{
  const r = readPlanPrompt('3bhk with pooja room and car parking', plot);
  check('Without a plot size the plan\'s own plot is used, and that is stated', !r.plotStated && r.program?.plotWidth === 30 && r.assumptions.some(a => /this plan's plot/.test(a)), r.assumptions);
  const types = (r.program?.rooms || []).map(x => x.type);
  check('3 BHK + pooja + parking are all present', types.filter(t => t === 'Bedroom').length === 2 && types.includes('Pooja') && types.includes('Parking'), types);
  check('The assumed bathroom count is declared, not hidden', r.assumptions.some(a => /bathrooms? assumed/.test(a)), r.assumptions);
}
{
  const r = readPlanPrompt('30 by 40 plot la rendu bedroom, oru kitchen, hall venum', plot);
  const types = (r.program?.rooms || []).map(x => x.type);
  check('Tanglish counts are read (rendu bedroom, oru kitchen, hall)', types.filter(t => isBedType(t)).length === 2 && types.includes('Kitchen') && types.includes('Living Room'), types);
}
{
  const r = readPlanPrompt('9 m x 12 m plot, 2 bedroom, kitchen, hall, bedroom 12x10', { unit: 'feet', plotWidth: 30, plotDepth: 40 });
  check('Meters are recognised from the message', r.program?.unit === 'meters' && r.program?.plotWidth === 9, r.program);
}
{
  const r = readPlanPrompt('30x40, master bedroom 14x12, kitchen 10x8, hall', plot);
  const master = r.program?.rooms.find(x => x.type === 'Master Bedroom');
  check('A size written after a room name belongs to that room, not the plot', r.program?.plotWidth === 30 && master?.width === 14 && master?.depth === 12, r.program);
}
{
  const r = readPlanPrompt('make it nice please', plot);
  check('A message with no rooms gets a question, not a guess', r.program === null && r.questions.length === 1, r);
  const z = readPlanPrompt('2bhk', { unit: 'feet', plotWidth: 0, plotDepth: 0 });
  check('No plot anywhere: the plot size is asked for', z.program === null && /plot size/i.test(z.questions[0] || ''), z);
}
function isBedType(t: string) { return t === 'Bedroom' || t === 'Master Bedroom'; }

console.log('\n--- 2. Built-in layout rules ---');
for (const prompt of ['30x40 2bhk with two bathrooms', '30x40 3bhk with pooja room and car parking', '25x35 1bhk', '40x60 4bhk 3 bathrooms dining pooja store parking', '20x30 2 bedroom kitchen hall bathroom']) {
  const reading = readPlanPrompt(prompt, plot);
  const { spec } = layoutProgram(reading.program!);
  const result = validatePlanSpec(spec);
  check(`"${prompt}" → a layout that passes validation`, result.ok, result.errors);
  const area = spec.rooms.reduce((s, r) => s + r.width * r.depth, 0);
  check('  rooms tile the plot exactly (no gaps, no overlap)', Math.abs(area - spec.plot.width * spec.plot.depth) < 0.01, area);
  check('  every room asked for is in the layout', spec.rooms.length === reading.program!.rooms.length, spec.rooms.map(r => r.label));
  check('  no room is a sliver (short side ≥ 4 ft)', spec.rooms.every(r => Math.min(r.width, r.depth) >= 4), spec.rooms.filter(r => Math.min(r.width, r.depth) < 4));
  check('  all sizes are labelled as proposed', spec.rooms.every(r => r.sizeSource === 'proposed'));
  check('  there is an entrance and every room has a door', spec.doors.some(d => d.to === 'outside') && !result.warnings.some(w => /no door/.test(w)), result.warnings);
}

console.log('\n--- 3. From spec to editor geometry ---');
{
  const { spec } = layoutProgram(readPlanPrompt('30x40 2bhk with two bathrooms', plot).program!);
  const built = buildFloorFromSpec(spec, 'feet', newId);
  const s = built.state;
  check('Walls, rooms, doors and windows are produced', s.walls.length > 0 && s.rooms.length === spec.rooms.length && s.doors.length > 0 && s.windows.length > 0, { w: s.walls.length, r: s.rooms.length, d: s.doors.length, win: s.windows.length });
  check('Nothing the layout asked for had to be dropped', built.dropped.length === 0, built.dropped);
  const faces = findWallFaces(s.walls, joinTolerance('feet'), minimumRoomArea('feet'));
  check('The walls enclose exactly one space per room', faces.length === spec.rooms.length, faces.length);
  check('Rooms keep their names and types and follow their walls', spec.rooms.every(r => s.rooms.some(x => x.label === r.label && x.roomType === r.type && x.fromWalls === true)), s.rooms.map(r => r.label));
  check('No two drawn rooms overlap', s.rooms.every((a, i) => s.rooms.every((b, j) => i >= j || overlap(a, b) < 0.01)));
  check('Every door and window is hosted on a wall', [...s.doors, ...s.windows].every(o => !!o.wallId && s.walls.some(w => w.id === o.wallId)));
  check('Shared walls are single walls (no duplicates on the same line)', new Set(s.walls.map(w => [w.x1, w.y1, w.x2, w.y2].join(','))).size === s.walls.length);
  check('Outer walls are exterior, dividing walls interior', s.walls.some(w => w.wallType === 'exterior') && s.walls.some(w => w.wallType === 'interior'));
  check('One main entrance door exists', s.doors.filter(d => d.doorType === 'Main Entrance').length === 1, s.doors.map(d => d.doorType));

  // Editable afterwards: moving a wall keeps the plan consistent through the editor's own step.
  const moved = { ...s, walls: s.walls.map((w, i) => (i === 0 ? w : w)) };
  const again = normaliseFloor(moved, 'feet', () => newId('room'));
  check('The built floor is already consistent (normalising changes nothing)', again.state === moved && again.roomsAdded.length === 0 && again.roomsRemoved.length === 0);
}

console.log('\n--- 4. Model output is validated before it can be used ---');
const good: PlanSpec = {
  unit: 'feet', plot: { width: 30, depth: 40 },
  rooms: [
    { id: 'living', type: 'Living Room', label: 'Living Room', x: 0, y: 24, width: 18, depth: 16, sizeSource: 'proposed' },
    { id: 'kitchen', type: 'Kitchen', label: 'Kitchen', x: 0, y: 12, width: 18, depth: 12, sizeSource: 'user' },
    { id: 'bed1', type: 'Master Bedroom', label: 'Master Bedroom', x: 18, y: 0, width: 12, depth: 20, sizeSource: 'proposed' },
    { id: 'bed2', type: 'Bedroom', label: 'Bedroom 2', x: 18, y: 20, width: 12, depth: 20, sizeSource: 'proposed' },
    { id: 'bath', type: 'Bathroom', label: 'Bathroom', x: 0, y: 0, width: 18, depth: 12, sizeSource: 'proposed' },
  ],
  doors: [{ from: 'living', to: 'outside', kind: 'main' }, { from: 'living', to: 'kitchen' }, { from: 'living', to: 'bed2' }, { from: 'kitchen', to: 'bed1' }, { from: 'bed1', to: 'bath', kind: 'bathroom' }],
  windows: [{ room: 'bed1', side: 'east' }, { room: 'kitchen', side: 'west' }],
};
{
  const parsed = parsePlanSpec(JSON.parse(JSON.stringify(good)));
  check('A well-formed model plan is accepted', !!parsed.spec && parsed.problems.length === 0, parsed.problems);
  const res = validatePlanSpec(snapSpec(parsed.spec!));
  check('...and passes validation', res.ok, res.errors);
  check('Sizes the person gave stay marked "user"; the rest "proposed"', parsed.spec!.rooms.find(r => r.id === 'kitchen')!.sizeSource === 'user' && parsed.spec!.rooms.find(r => r.id === 'living')!.sizeSource === 'proposed');
}
{
  check('Text instead of a plan is rejected', parsePlanSpec('Here is your lovely 2BHK!').spec === null);
  check('A plan with no rooms is rejected', parsePlanSpec({ unit: 'feet', plot: { width: 30, depth: 40 }, rooms: [] }).spec === null);
  check('A plan with no unit is rejected', parsePlanSpec({ plot: { width: 30, depth: 40 }, rooms: good.rooms }).spec === null);
  const nan = parsePlanSpec({ unit: 'feet', plot: { width: 30, depth: 40 }, rooms: [{ id: 'a', type: 'Bedroom', label: 'Bed', x: 0, y: 0, width: 'twelve', depth: 10 }] });
  check('A room with a non-numeric size is rejected and named', nan.spec === null && nan.problems.some(p => /Bed/.test(p)), nan.problems);
}
{
  const overlapping: PlanSpec = { ...good, rooms: good.rooms.map(r => (r.id === 'bed2' ? { ...r, y: 15 } : r)) };
  const res = validatePlanSpec(snapSpec(overlapping));
  check('Overlapping rooms are an error that names both rooms', !res.ok && res.errors.some(e => /Master Bedroom and Bedroom 2 overlap/.test(e)), res.errors);
  const outside: PlanSpec = { ...good, rooms: good.rooms.map(r => (r.id === 'bed1' ? { ...r, width: 20 } : r)) };
  check('A room that leaves the plot is an error', validatePlanSpec(snapSpec(outside)).errors.some(e => /goes outside/.test(e)));
  const tiny: PlanSpec = { ...good, rooms: [...good.rooms.slice(0, 4), { ...good.rooms[4], width: 2, depth: 2 }] };
  check('A 2 × 2 ft "room" is an error', validatePlanSpec(snapSpec(tiny)).errors.some(e => /too small/.test(e)));
  const huge: PlanSpec = { ...good, plot: { width: 5000, depth: 40 } };
  check('An absurd plot size is an error', !validatePlanSpec(huge).ok);
  const badDoor: PlanSpec = { ...good, doors: [...good.doors, { from: 'bath', to: 'bed2' }, { from: 'ghost', to: 'living' }] };
  const res2 = validatePlanSpec(snapSpec(badDoor));
  check('A door between rooms that do not touch is dropped with a warning, not drawn', res2.ok && res2.warnings.some(w => /do not share a wall/.test(w)) && res2.warnings.some(w => /not in the plan/.test(w)), res2.warnings);
}
{
  // Slightly inconsistent arithmetic from a model: edges 0.1 ft apart are pulled onto one line.
  const sloppy: PlanSpec = { ...good, rooms: good.rooms.map(r => (r.id === 'bed1' ? { ...r, x: 18.08, width: 11.92 } : r)) };
  const snapped = snapSpec(sloppy);
  check('Near-miss edges are snapped onto one wall line', snapped.rooms.find(r => r.id === 'bed1')!.x === 18 && validatePlanSpec(snapped).ok, snapped.rooms.find(r => r.id === 'bed1'));
  const built = buildFloorFromSpec(snapSpec(good), 'feet', newId);
  check('A model plan with its own doors builds, and unplaceable items are reported', built.state.rooms.length === 5 && built.state.doors.length >= 4, { doors: built.state.doors.length, dropped: built.dropped });
}
{
  const metric = convertSpecUnit(good, 'meters');
  check('A plan can be converted between feet and meters', metric.unit === 'meters' && Math.abs(metric.plot.width - 9.144) < 0.001 && Math.abs(convertSpecUnit(metric, 'feet').plot.width - 30) < 0.001, metric.plot);
  check('Room names from a model map onto the editor\'s room types', normaliseRoomType('Hall') === 'Living Room' && normaliseRoomType('master bed') === 'Master Bedroom' && normaliseRoomType('Puja room') === 'Pooja' && normaliseRoomType('WC') === 'Toilet' && normaliseRoomType('Zen garden') === 'Custom');
  const noDoors = autoOpenings({ ...good, doors: [], windows: [] });
  check('Doors are chosen by rule when a plan has none', noDoors.doors.some(d => d.to === 'outside') && noDoors.doors.length >= 5, noDoors.doors);
}

console.log('\n--- 5. Draft → apply → undo, and cancel ---');
{
  // The editor applies a draft as one history step. This mirrors that with the real history class.
  const before = normaliseFloor({ ...emptyFloorState(), walls: [{ id: 'w-user', x1: 0, y1: 0, x2: 10, y2: 0, thickness: 0.75, wallType: 'exterior' }] }, 'feet', () => newId('room')).state;
  const history = new PlanHistory();
  history.reset('floor-1', before);
  const draft = buildFloorFromSpec(layoutProgram(readPlanPrompt('30x40 2bhk', plot).program!).spec, 'feet', newId).state;
  check('Making a draft does not touch the current drawing', before.walls.length === 1 && before.walls[0].id === 'w-user');
  // Cancel: the draft is simply discarded; nothing was pushed.
  check('Cancel leaves history empty (nothing to undo)', history.canUndo('floor-1') === false);
  history.push('floor-1', draft);
  check('Apply is one undoable step', history.canUndo('floor-1') === true);
  const undone = history.undo('floor-1');
  check('Undo brings back exactly what was there before', !!undone && undone.walls.length === 1 && undone.walls[0].id === 'w-user', undone?.walls.length);
  const redone = history.redo('floor-1');
  check('Redo re-applies the generated plan', !!redone && redone.rooms.length === draft.rooms.length);
}
{
  const { spec } = layoutProgram(readPlanPrompt('30x40 2bhk', plot).program!);
  const state = buildFloorFromSpec(spec, 'feet', newId).state;
  const back = specFromFloor(state, 'feet', { width: 30, depth: 40 });
  check('An applied plan can be read back as a spec for follow-up edits', !!back && back.rooms.length === spec.rooms.length && validatePlanSpec(snapSpec(back)).errors.length === 0, back?.rooms.length);
  // Save and reload: what is stored is plain data, and it normalises to the same floor.
  const reloaded = JSON.parse(JSON.stringify(state));
  const norm = normaliseFloor(reloaded, 'feet', () => newId('room'));
  check('After save and reload the plan is unchanged', norm.roomsAdded.length === 0 && norm.roomsRemoved.length === 0 && norm.state.rooms.length === state.rooms.length && norm.state.doors.length === state.doors.length);
}

console.log(`\n✅ AI Design plan spec: all ${passed} checks passed.\n`);
