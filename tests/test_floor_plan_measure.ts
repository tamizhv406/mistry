/**
 * Floor Planner measurements: typed lengths and unit conversion, exact wall length with
 * joined walls following, dimension lines, clear room sizes, undo/redo of geometry edits and
 * reopening saved plans. Pure logic, no browser.
 */
import {
  PX_PER_UNIT, defaultGridStep, defaultWallThickness, endToKeep, formatAreaShort, formatDimension, formatLengthForInput, formatThickness,
  gridStepOptions, layoutDimension, lengthLimits, outsideNormal, parseLengthInput, parseThicknessInput, pixelsToPlan, planToScreen,
  resizeWall, roomInterior, screenToPlan, thicknessLimits, wallThicknessPresets,
} from '../src/domain/planMeasure';
import {
  findWallFaces, joinTolerance, minimumRoomArea, moveJoint, reattachTees, roomArea, translateWall, wallLengthOf, type Pt,
} from '../src/domain/planGeometry';
import {
  PlanHistory, buildSavePayload, emptyFloorState, levelToState, loadFloors, normaliseFloor, prepareForWallEdit, type FloorState,
} from '../src/domain/planDocument';
import { interpretStroke } from '../src/domain/planSketch';
import type { FloorPlan, FloorPlanUnit, FloorPlanWall } from '../src/db/types';

let passed = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (!cond) throw new Error(`FAILED: ${name}${detail !== undefined ? ' — got ' + JSON.stringify(detail) : ''}`);
  passed += 1;
  console.log(`  ✓ ${name}`);
}
const eq = (name: string, actual: unknown, expected: unknown) =>
  check(`${name} (${JSON.stringify(expected)})`, JSON.stringify(actual) === JSON.stringify(expected), actual);
const near = (name: string, actual: number, expected: number, eps = 1e-9) =>
  check(`${name} (${expected})`, Math.abs(actual - expected) <= eps, actual);

const wall = (id: string, x1: number, y1: number, x2: number, y2: number, thickness = 0.75): FloorPlanWall => ({ id, x1, y1, x2, y2, thickness, wallType: 'exterior' });
const box = (x: number, y: number, w: number, h: number, thickness = 0.75): FloorPlanWall[] => [
  wall('top', x, y, x + w, y, thickness), wall('right', x + w, y, x + w, y + h, thickness),
  wall('bottom', x + w, y + h, x, y + h, thickness), wall('left', x, y + h, x, y, thickness),
];
const byId = (walls: FloorPlanWall[], id: string) => walls.find(w => w.id === id)!;
const ends = (w: FloorPlanWall) => [[w.x1, w.y1], [w.x2, w.y2]];
const TOL = joinTolerance('feet');
const MIN = minimumRoomArea('feet');
let idSeq = 0;
const newId = () => `id-${++idSeq}`;
const value = (text: string, unit: FloorPlanUnit) => {
  const r = parseLengthInput(text, unit);
  if (!r.ok) throw new Error(`"${text}" was refused: ${r.error}`);
  return r.value;
};
const refused = (text: string, unit: FloorPlanUnit) => !parseLengthInput(text, unit).ok;

console.log('\n--- 1. Typing an exact length: feet and inches ---');
eq('12\' 6" is 12.5 ft', value(`12' 6"`, 'feet'), 12.5);
eq('12\'-6" (as printed on drawings)', value(`12'-6"`, 'feet'), 12.5);
eq('12ft 6in', value('12ft 6in', 'feet'), 12.5);
eq('12 feet 6 inches', value('12 feet 6 inches', 'feet'), 12.5);
eq('12 6 (space only, easy on a phone keypad)', value('12 6', 'feet'), 12.5);
eq('12-6', value('12-6', 'feet'), 12.5);
eq('A plain number is feet', value('12.5', 'feet'), 12.5);
eq('12\' on its own', value(`12'`, 'feet'), 12);
eq('6" on its own', value(`6"`, 'feet'), 0.5);
eq('150in', value('150in', 'feet'), 12.5);
near('12\' 6 1/2" (fraction of an inch)', value(`12' 6 1/2"`, 'feet'), 12 + 6.5 / 12);
near('12\' 6.5"', value(`12' 6.5"`, 'feet'), 12 + 6.5 / 12);
near('Inches past 12 carry into feet', value(`5' 14"`, 'feet'), 6 + 2 / 12);
eq('Curly quotes from a phone keyboard', value('12’ 6”', 'feet'), 12.5);
eq('Prime marks', value('12′ 6″', 'feet'), 12.5);
eq('Extra spaces and capitals', value('  12 FT   6 IN ', 'feet'), 12.5);
eq('Two single quotes as an inch mark', value(`12' 6''`, 'feet'), 12.5);

console.log('\n--- 2. Typing an exact length: metric, and across systems ---');
eq('A plain number is metres on a metre plan', value('3.5', 'meters'), 3.5);
eq('3.5m', value('3.5m', 'meters'), 3.5);
eq('350cm', value('350cm', 'meters'), 3.5);
eq('3500 mm', value('3500 mm', 'meters'), 3.5);
near('Feet typed into a metre plan are converted', value(`12' 6"`, 'meters'), 3.81, 1e-12);
near('10ft in a metre plan', value('10ft', 'meters'), 3.048, 1e-12);
near('Metres typed into a feet plan are converted', value('3.048m', 'feet'), 10, 1e-12);
near('1 m is 3.280839895 ft', value('1m', 'feet'), 3.2808398950131235, 1e-12);
near('2540 mm is 100 inches', value('2540mm', 'feet'), 100 / 12, 1e-12);
eq('Inches plans: a plain number is inches, stored in feet', value('150', 'inches'), 12.5);
near('Centimetre plans: a plain number is cm, stored in metres', value('381', 'centimeters'), 3.81, 1e-12);
check('Two bare numbers mean nothing on a metre plan', refused('3 50', 'meters'));
near('Conversion there and back keeps the length', value(`${value('37.25', 'feet') * 0.3048}m`, 'feet'), 37.25, 1e-12);

console.log('\n--- 3. Invalid measurements are refused ---');
for (const bad of ['', '   ', 'abc', '0', '0.0', `0' 0"`, '-5', `-12' 6"`, 'NaN', 'Infinity', '1e9', '12..5', `12' 6" 3`, '12 ft ft', '5/0"', '--3']) {
  check(`"${bad}" is refused`, refused(bad, 'feet'), parseLengthInput(bad, 'feet'));
}
check('A wall shorter than 3 inches is refused', refused('1"', 'feet'));
check('A wall longer than 1000 ft is refused', refused('5000', 'feet'));
check('A wall longer than 300 m is refused', refused('301', 'meters'));
check('The limits themselves are allowed', !refused('1000', 'feet') && !refused(`3"`, 'feet') && !refused('300', 'meters'));
const why = parseLengthInput('abc', 'feet');
check('The message says what to type instead', !why.ok && why.error.includes(`12' 6"`), why);
const whyZero = parseLengthInput('0', 'feet');
check('Zero is explained plainly', !whyZero.ok && whyZero.error === 'A length must be more than zero.', whyZero);
check('Every refusal carries a message', ['', 'x', '-1', '99999'].every(t => { const r = parseLengthInput(t, 'feet'); return !r.ok && r.error.length > 5; }));
eq('Length limits per unit', [lengthLimits('feet'), lengthLimits('meters')], [{ min: 0.25, max: 1000 }, { min: 0.05, max: 300 }]);

console.log('\n--- 4. Showing a length (rounding is for display only) ---');
eq('Feet and inches', [formatDimension(12.5, 'feet'), formatDimension(10, 'feet'), formatDimension(0.75, 'feet')], [`12'-6"`, `10'-0"`, `0'-9"`]);
eq('Quarter inches are shown', [formatDimension(12 + 6.5 / 12, 'feet'), formatDimension(12 + 6.25 / 12, 'feet'), formatDimension(12 + 6.75 / 12, 'feet')], [`12'-6½"`, `12'-6¼"`, `12'-6¾"`]);
eq('Inches never show as 12', formatDimension(11.9999, 'feet'), `12'-0"`);
eq('Other units', [formatDimension(12.5, 'inches'), formatDimension(3.814, 'meters'), formatDimension(3.81, 'centimeters')], [`150"`, '3.81 m', '381 cm']);
eq('Editable text', [formatLengthForInput(12.5, 'feet'), formatLengthForInput(3.5, 'meters'), formatLengthForInput(12.5, 'inches'), formatLengthForInput(3.81, 'centimeters')], [`12' 6"`, '3.5 m', `150"`, '381 cm']);
for (const unit of ['feet', 'inches', 'meters', 'centimeters'] as FloorPlanUnit[]) {
  for (const v of [0.5, 3.25, 9.75, 12 + 7 / 12, 23.333, 104.0625]) {
    near(`${unit}: ${v} survives being shown in the box and read back`, value(formatLengthForInput(v, unit), unit), v, 1e-4);
  }
}
eq('Area labels', [formatAreaShort(120, 'feet'), formatAreaShort(11.148, 'meters')], ['120.0 sq.ft', '11.15 m²']);

console.log('\n--- 5. Wall thickness is its own measurement ---');
const thick = (text: string, unit: FloorPlanUnit) => { const r = parseThicknessInput(text, unit); return r.ok ? r.value : null; };
eq('A plain number is inches on a feet plan', thick('9', 'feet'), 0.75);
eq('4.5"', thick('4.5"', 'feet'), 0.375);
near('230mm typed into a feet plan', thick('230mm', 'feet') ?? 0, 0.23 / 0.3048, 1e-12);
eq('A plain number is millimetres on a metric plan', thick('230', 'meters'), 0.23);
near('9" typed into a metric plan', thick('9"', 'meters') ?? 0, 0.2286, 1e-12);
eq('Zero, negative, text and absurd values are refused', [thick('0', 'feet'), thick('-9', 'feet'), thick('thick', 'feet'), thick('60', 'feet'), thick('5', 'meters')], [null, null, null, null, null]);
eq('Shown the way it is quoted on site', [formatThickness(0.75, 'feet'), formatThickness(0.375, 'feet'), formatThickness(0.23, 'meters')], [`9"`, `4.5"`, '230 mm']);
eq('Default wall is 9 inch / 230 mm', [defaultWallThickness('feet'), defaultWallThickness('meters'), defaultWallThickness('centimeters')], [0.75, 0.23, 0.23]);
check('Presets stay inside the limits', (['feet', 'meters'] as FloorPlanUnit[]).every(u => wallThicknessPresets(u).every(p => p.value >= thicknessLimits(u).min && p.value <= thicknessLimits(u).max)));
eq('Snap step: 6 inches, or 10 cm', [defaultGridStep('feet'), defaultGridStep('meters')], [0.5, 0.1]);
check('The default snap step is one of the choices', (['feet', 'meters'] as FloorPlanUnit[]).every(u => gridStepOptions(u).some(o => o.value === defaultGridStep(u))));
const thicker = box(0, 0, 12, 10).map(w => (w.id === 'top' ? { ...w, thickness: 1.5 } : w));
eq('Changing thickness never changes a wall\'s length', wallLengthOf(byId(thicker, 'top')), 12);

console.log('\n--- 6. Exact wall length: the room stays joined and square ---');
const room = box(0, 0, 12, 10);
const wider = resizeWall(room, 'top', 14, 'start', TOL);
eq('The wall has exactly the length typed', wallLengthOf(byId(wider, 'top')), 14);
eq('Its fixed end did not move', [byId(wider, 'top').x1, byId(wider, 'top').y1], [0, 0]);
eq('The wall at the corner moved with it, still vertical', ends(byId(wider, 'right')), [[14, 0], [14, 10]]);
eq('The opposite wall stretched to follow', ends(byId(wider, 'bottom')), [[14, 10], [0, 10]]);
check('The far wall was not touched', byId(wider, 'left') === byId(room, 'left'));
const widerFaces = findWallFaces(wider, TOL, MIN);
eq('The room is still closed, with four corners', [widerFaces.length, widerFaces[0].points.length], [1, 4]);
eq('Its area follows the new size', widerFaces[0].area, 140);
eq('The other dimensions update at once', [wallLengthOf(byId(wider, 'bottom')), wallLengthOf(byId(wider, 'right')), wallLengthOf(byId(wider, 'left'))], [14, 10, 10]);
eq('The original walls were not modified', ends(byId(room, 'top')), [[0, 0], [12, 0]]);

const fromOtherEnd = resizeWall(room, 'top', 14, 'end', TOL);
eq('Keeping the other end grows the wall the other way', ends(byId(fromOtherEnd, 'top')), [[-2, 0], [12, 0]]);
eq('...and carries the wall at that corner', ends(byId(fromOtherEnd, 'left')), [[-2, 10], [-2, 0]]);
const shorter = resizeWall(room, 'right', 7.5, 'start', TOL);
eq('Shortening works the same way', [wallLengthOf(byId(shorter, 'right')), ends(byId(shorter, 'bottom'))], [7.5, [[12, 7.5], [0, 7.5]]]);
eq('...and the room area follows', findWallFaces(shorter, TOL, MIN)[0].area, 90);

const exact = 12 + 7.3 / 12;
const precise = resizeWall(room, 'top', exact, 'start', TOL);
near('An awkward length is stored exactly, not rounded', wallLengthOf(byId(precise, 'top')), exact, 1e-12);
eq('...and only its label is rounded', formatDimension(wallLengthOf(byId(precise, 'top')), 'feet'), `12'-7¼"`);
let repeated = room;
for (let i = 0; i < 200; i++) repeated = resizeWall(resizeWall(repeated, 'top', exact, 'start', TOL), 'top', 12, 'start', TOL);
near('Editing a length 400 times does not drift', wallLengthOf(byId(repeated, 'top')), 12, 1e-9);
near('...and neither does the room', findWallFaces(repeated, TOL, MIN)[0].area, 120, 1e-6);

const lone = [wall('solo', 2, 2, 8, 2)];
eq('A free-standing wall just changes length', ends(resizeWall(lone, 'solo', 10, 'start', TOL)[0]), [[2, 2], [12, 2]]);
const diag = resizeWall([wall('d', 0, 0, 3, 4)], 'd', 10, 'start', TOL)[0];
eq('A diagonal wall keeps its direction', [diag.x2, diag.y2], [6, 8]);
const line = [wall('a', 0, 0, 10, 0), wall('b', 10, 0, 20, 0)];
const lineAfter = resizeWall(line, 'a', 12, 'start', TOL);
eq('A wall continuing in the same line gives up the length', [ends(byId(lineAfter, 'a')), ends(byId(lineAfter, 'b'))], [[[0, 0], [12, 0]], [[12, 0], [20, 0]]]);

for (const bad of [0, -3, NaN, Infinity, -Infinity]) {
  check(`A length of ${bad} changes nothing`, resizeWall(room, 'top', bad, 'start', TOL) === room);
}
check('An unknown wall changes nothing', resizeWall(room, 'nope', 5, 'start', TOL) === room);
check('The same length changes nothing', resizeWall(room, 'top', 12, 'start', TOL) === room);

eq('The joined end is the one kept in place', endToKeep([wall('a', 0, 0, 10, 0), wall('b', 10, 0, 10, 8)], 'a', TOL), 'end');
eq('With both ends joined, the start is kept', endToKeep(room, 'top', TOL), 'start');
eq('A free wall keeps its start', endToKeep(lone, 'solo', TOL), 'start');

console.log('\n--- 7. T-junctions stay attached ---');
const withPartition = [...room, wall('part', 0, 5, 12, 5, 0.375)];
const partWider = resizeWall(withPartition, 'top', 14, 'start', TOL);
eq('A partition ending on a wall follows that wall when the room is resized', ends(byId(partWider, 'part')), [[0, 5], [14, 5]]);
eq('...so there are still two rooms', findWallFaces(partWider, TOL, MIN).length, 2);
const partSlid = translateWall(withPartition, 'right', 3, 0, TOL);
eq('...and when the wall is dragged', ends(byId(partSlid, 'part')), [[0, 5], [15, 5]]);
eq('Dragged walls still stretch their corner neighbours', ends(byId(partSlid, 'top')), [[0, 0], [15, 0]]);
const partPivot = moveJoint(withPartition, { x: 12, y: 0 }, { x: 14, y: 0 }, TOL);
eq('...and when a corner is dragged (it stays halfway along the tilted wall)', ends(byId(partPivot, 'part')), [[0, 5], [13, 5]]);
const stretched = resizeWall([...room, wall('stub', 6, 0, 6, 4)], 'top', 14, 'start', TOL);
eq('A wall ending on a wall that only got longer stays where it is', ends(byId(stretched, 'stub')), [[6, 0], [6, 4]]);
check('Walls with no T-junction are returned untouched', reattachTees(room, room, TOL) === room);
const cornerOnly = moveJoint(room, { x: 12, y: 0 }, { x: 13, y: 1 }, TOL);
eq('A dragged corner moves every wall end that met there', [ends(byId(cornerOnly, 'top'))[1], ends(byId(cornerOnly, 'right'))[0]], [[13, 1], [13, 1]]);

console.log('\n--- 8. Dimension lines ---');
const centre: Pt = { x: 6, y: 5 };
const drawn = normaliseFloor({ ...emptyFloorState(), walls: room }, 'feet', newId).state;
eq('Dimension lines go outside the room on every side', ['top', 'right', 'bottom', 'left'].map(id => outsideNormal(byId(room, id), drawn.rooms, centre, 0.5)), [{ x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }]);
const reversed = wall('top-rev', 12, 0, 0, 0);
eq('...whichever way the wall was drawn', outsideNormal(reversed, drawn.rooms, centre, 0.5), { x: 0, y: -1 });
eq('A wall with no room faces away from the middle of the plan', outsideNormal(wall('free', 0, 20, 12, 20), [], centre, 0.5), { x: 0, y: 1 });
const n0 = outsideNormal(wall('mid', 0, 5, 12, 5), [], centre, 0.5);
check('A wall through the middle still gets one definite side', Math.abs(n0.y) === 1 && n0.x === 0, n0);

const dim = layoutDimension({ x: 100, y: 200 }, { x: 340, y: 200 }, { x: 0, y: -1 }, { offset: 30, gap: 6, overshoot: 5, labelLength: 60, labelHeight: 18, arrow: 7 });
eq('The dimension line runs parallel to the wall, offset outside it', dim.line, [{ x: 100, y: 170 }, { x: 340, y: 170 }]);
eq('Extension lines start clear of the wall and pass the dimension line', dim.extensions, [[{ x: 100, y: 194 }, { x: 100, y: 165 }], [{ x: 340, y: 194 }, { x: 340, y: 165 }]]);
eq('The label sits in the middle of the line', [dim.label, dim.fits, dim.rotation], [{ x: 220, y: 170 }, true, 0]);
check('The label is well clear of both wall corners', Math.min(Math.hypot(dim.label.x - 100, dim.label.y - 200), Math.hypot(dim.label.x - 340, dim.label.y - 200)) > 100);
const tiny = layoutDimension({ x: 100, y: 200 }, { x: 140, y: 200 }, { x: 0, y: -1 }, { offset: 30, gap: 6, overshoot: 5, labelLength: 60, labelHeight: 18, arrow: 7 });
eq('On a short wall the label moves further out instead of covering the corners', [tiny.fits, tiny.label], [false, { x: 120, y: 156 }]);
check('...and stays further from the wall than a resize handle reaches', 200 - tiny.label.y - 9 > 13);
const upright = layoutDimension({ x: 0, y: 300 }, { x: 0, y: 0 }, { x: -1, y: 0 }, { offset: 30, gap: 6, overshoot: 5, labelLength: 60, labelHeight: 18, arrow: 7 });
const flipped = layoutDimension({ x: 300, y: 0 }, { x: 0, y: 0 }, { x: 0, y: -1 }, { offset: 30, gap: 6, overshoot: 5, labelLength: 60, labelHeight: 18, arrow: 7 });
eq('Text along an upright wall reads upwards, whichever way the wall was drawn', [upright.rotation, layoutDimension({ x: 0, y: 0 }, { x: 0, y: 300 }, { x: -1, y: 0 }, { offset: 30, gap: 6, overshoot: 5, labelLength: 60, labelHeight: 18, arrow: 7 }).rotation], [-90, -90]);
eq('Text along a level wall drawn right to left is not upside down', flipped.rotation, 0);
const slope = layoutDimension({ x: 200, y: 0 }, { x: 0, y: 150 }, { x: 0, y: -1 }, { offset: 30, gap: 6, overshoot: 5, labelLength: 60, labelHeight: 18, arrow: 7 });
check('Labels are never upside down', slope.rotation >= -90 && slope.rotation < 90, slope.rotation);

console.log('\n--- 9. Zoom and pan never change real dimensions ---');
eq('20 screen pixels per plan unit at 100%', PX_PER_UNIT, 20);
const corner: Pt = { x: 12 + 7 / 12, y: 9.25 };
for (const view of [{ zoom: 0.2, panX: 0, panY: 0 }, { zoom: 0.63, panX: -148, panY: 77 }, { zoom: 1, panX: 40, panY: 40 }, { zoom: 4, panX: -2311, panY: 906 }]) {
  const back = screenToPlan(planToScreen(corner, view), view);
  check(`A corner is the same point at ${Math.round(view.zoom * 100)}% zoom`, Math.abs(back.x - corner.x) < 1e-9 && Math.abs(back.y - corner.y) < 1e-9, back);
}
near('A 24 px finger is 2 ft at 60% zoom', pixelsToPlan(24, 0.6), 2, 1e-12);
near('...and 0.3 ft at 400% zoom', pixelsToPlan(24, 4), 0.3, 1e-12);
const planStroke: Pt[] = [];
for (let i = 0; i <= 40; i++) planStroke.push({ x: 2.2 + (11.7 * i) / 40, y: 5.2 - (0.3 * i) / 40 + (i % 2 ? 0.08 : -0.08) });
const sketchAt = (view: { zoom: number; panX: number; panY: number }) =>
  interpretStroke(planStroke.map(p => planToScreen(p, view)).map(p => screenToPlan(p, view)), [], { unit: 'feet', thickness: 0.75, newId, grid: 0.5 }).walls.map(ends);
eq('The same stroke gives the same wall at 50% and at 300% zoom', sketchAt({ zoom: 0.5, panX: 12, panY: -30 }), sketchAt({ zoom: 3, panX: -400, panY: 250 }));

console.log('\n--- 10. Clear (inside) room size versus wall length ---');
const inside = roomInterior(drawn.rooms[0], room, TOL)!;
near('A 12 x 10 ft room with 9 inch walls is 11\'-3" clear', inside.width, 11.25);
near('...by 9\'-3" clear', inside.height, 9.25);
near('Clear area is 104.06 sq.ft', inside.area, 104.0625);
eq('Wall length is still the full 12 ft, centre to centre', wallLengthOf(byId(room, 'top')), 12);
eq('The centre-line outline area is still 120 sq.ft', roomArea(drawn.rooms[0]), 120);
const mixed = roomInterior(drawn.rooms[0], room.map(w => (w.id === 'left' ? { ...w, thickness: 0.375 } : w)), TOL)!;
near('A thinner wall on one side gives that much more clear width', mixed.width, 12 - 0.375 - 0.1875);
const ell = [wall('1', 0, 0, 20, 0), wall('2', 20, 0, 20, 10), wall('3', 20, 10, 10, 10), wall('4', 10, 10, 10, 18), wall('5', 10, 18, 0, 18), wall('6', 0, 18, 0, 0)];
const ellRoom = normaliseFloor({ ...emptyFloorState(), walls: ell }, 'feet', newId).state.rooms[0];
near('An L-shaped room: clear area inside 9 inch walls', roomInterior(ellRoom, ell, TOL)!.area, 19.25 * 9.25 + 9.25 * 8, 1e-9);
eq('A room placed by hand, with no walls on it, has no clear size to report', roomInterior({ x: 30, y: 30, width: 10, height: 8 }, room, TOL), null);
eq('Walls too thick to leave any space are not reported as a room size', roomInterior({ x: 0, y: 0, width: 1, height: 1 }, box(0, 0, 1, 1, 3), TOL), null);
const insideMetric = roomInterior({ x: 0, y: 0, width: 4, height: 3 }, box(0, 0, 4, 3, 0.23), joinTolerance('meters'))!;
near('Metric: a 4 x 3 m room with 230 mm walls is 3.77 x 2.77 m clear', insideMetric.width * 1000 + insideMetric.height, 3770 + 2.77, 1e-6);

console.log('\n--- 11. Undo and redo of geometry edits ---');
const history = new PlanHistory(50);
const s0: FloorState = normaliseFloor({ ...emptyFloorState(), walls: room }, 'feet', newId).state;
history.reset('floor', s0);
const s1: FloorState = normaliseFloor({ ...s0, walls: resizeWall(s0.walls, 'top', 14, 'start', TOL) }, 'feet', newId).state;
history.push('floor', s1);
const s2: FloorState = normaliseFloor({ ...s1, walls: moveJoint(s1.walls, { x: 14, y: 10 }, { x: 16, y: 12 }, TOL) }, 'feet', newId).state;
history.push('floor', s2);
eq('After two edits the room is 14 ft wide and no longer square', [wallLengthOf(byId(s2.walls, 'top')), s2.rooms[0].area !== 140], [14, true]);
const u1 = history.undo('floor')!;
eq('Undo brings back the 14 x 10 room', [wallLengthOf(byId(u1.walls, 'top')), u1.rooms[0].area, ends(byId(u1.walls, 'right'))], [14, 140, [[14, 0], [14, 10]]]);
const u2 = history.undo('floor')!;
eq('Undo again brings back the 12 x 10 room exactly', [u2.walls.map(ends), u2.rooms[0].area], [room.map(ends), 120]);
eq('There is nothing further to undo', history.undo('floor'), null);
const r1 = history.redo('floor')!;
eq('Redo returns the typed length', wallLengthOf(byId(r1.walls, 'top')), 14);
const r2 = history.redo('floor')!;
eq('Redo again returns the dragged corner', ends(byId(r2.walls, 'bottom'))[0], [16, 12]);
history.undo('floor');
history.push('floor', { ...s1, walls: resizeWall(s1.walls, 'top', 20, 'start', TOL) });
eq('A new edit after undo clears redo', history.canRedo('floor'), false);
history.push('floor', { ...s1, walls: resizeWall(s1.walls, 'top', 20, 'start', TOL) });
history.undo('floor');
eq('Recording the same state twice adds only one undo step', wallLengthOf(byId(history.undo('floor')?.walls ?? s1.walls, 'top')), 12);

console.log('\n--- 12. Saving, reopening and older plans ---');
const planBase = {
  id: 'p1', userId: 'u1', buildingName: 'Test House', floorName: 'Ground Floor', plotLength: 40, plotWidth: 30, unit: 'feet',
  walls: [], rooms: [], doors: [], windows: [], createdAt: 't', updatedAt: 't',
} as unknown as FloorPlan;
const edited: FloorState = normaliseFloor({ ...emptyFloorState(), walls: resizeWall(room, 'top', exact, 'start', TOL) }, 'feet', newId).state;
const floors = loadFloors(planBase);
const payload = buildSavePayload(planBase, floors, 0, edited);
const reopened = loadFloors(JSON.parse(JSON.stringify({ ...planBase, ...payload })) as FloorPlan);
eq('Every wall comes back exactly as it was saved', levelToState(reopened[0]).walls, edited.walls);
near('...including a length that is not a round number', wallLengthOf(byId(levelToState(reopened[0]).walls, 'top')), exact, 1e-12);
eq('The room and its area come back too', [levelToState(reopened[0]).rooms.length, levelToState(reopened[0]).rooms[0].area], [1, edited.rooms[0].area]);
eq('Saving does not touch the drawing in memory', edited.walls.map(ends), resizeWall(room, 'top', exact, 'start', TOL).map(ends));

// A plan saved by an older version: drawing in the top-level fields, no floors, walls with
// only the original fields and a room without the newer "fromWalls" flag.
const legacy = {
  ...planBase,
  walls: [
    { id: 'w1', x1: 0, y1: 0, x2: 12, y2: 0, thickness: 0.75, wallType: 'exterior' },
    { id: 'w2', x1: 12, y1: 0, x2: 12, y2: 10, thickness: 0.75, wallType: 'exterior' },
    { id: 'w3', x1: 12, y1: 10, x2: 0, y2: 10, thickness: 0.75, wallType: 'exterior' },
    { id: 'w4', x1: 0, y1: 10, x2: 0, y2: 0, thickness: 0.75, wallType: 'exterior' },
  ],
  rooms: [{ id: 'r1', roomType: 'Bedroom', label: 'Bedroom', x: 0, y: 0, width: 12, height: 10, rotation: 0 }],
  doors: [{ id: 'd1', doorType: 'Single', x: 6, y: 0, width: 3, rotation: 0 }],
} as unknown as FloorPlan;
const legacyFloors = loadFloors(legacy);
const legacyState = levelToState(legacyFloors[0]);
eq('An older plan opens with its drawing as the ground floor', [legacyFloors.length, legacyState.walls.length, legacyState.rooms.length, legacyState.doors.length], [1, 4, 1, 1]);
eq('Its walls are exactly where they were', legacyState.walls.map(w => [w.x1, w.y1, w.x2, w.y2]), [[0, 0, 12, 0], [12, 0, 12, 10], [12, 10, 0, 10], [0, 10, 0, 0]]);
eq('Its dimensions read the same', legacyState.walls.map(w => formatDimension(wallLengthOf(w), legacy.unit)), [`12'-0"`, `10'-0"`, `12'-0"`, `10'-0"`]);
const legacyTidy = normaliseFloor(legacyState, 'feet', newId).state;
eq('Opening it does not add a second room or rename the first', [legacyTidy.rooms.length, legacyTidy.rooms[0].label, legacyTidy.rooms[0].id], [1, 'Bedroom', 'r1']);
near('The old room now reports a clear size as well', roomInterior(legacyTidy.rooms[0], legacyTidy.walls, TOL)!.area, 104.0625);
const legacySaved = buildSavePayload(legacy, legacyFloors, 0, legacyState);
eq('Saving it again keeps every wall, room and door', [legacySaved.walls, legacySaved.rooms, legacySaved.doors], [legacy.walls, legacy.rooms, legacy.doors]);
const editedLegacy = resizeWall(legacyState.walls, 'w1', 15, 'start', TOL);
eq('The new length edit works on an older plan', [wallLengthOf(byId(editedLegacy, 'w1')), findWallFaces(editedLegacy, TOL, MIN)[0].area], [15, 150]);
// The order the editor uses for every wall edit: tie matching rooms, apply the edit, tidy up.
const tied = prepareForWallEdit(legacyState, 'feet');
eq('Before a wall edit, the old room is tied to the walls it already fills', [tied.rooms[0].fromWalls, tied.rooms[0].id, tied.rooms[0].label, tied.rooms[0].area], [true, 'r1', 'Bedroom', 120]);
eq('...without touching a single wall', tied.walls, legacyState.walls);
const grown = normaliseFloor({ ...tied, walls: resizeWall(tied.walls, 'w1', 15, 'start', TOL) }, 'feet', newId).state;
eq('...so it follows the edit instead of staying at its old size', [grown.rooms.length, grown.rooms[0].id, grown.rooms[0].label, grown.rooms[0].width, grown.rooms[0].area], [1, 'r1', 'Bedroom', 15, 150]);
const loose = { ...legacyState, rooms: [{ ...legacyState.rooms[0], width: 8 }] };
check('A room that does not fill its walls is left exactly as it was', prepareForWallEdit(loose, 'feet') === loose);
check('With nothing left to tie, the floor is returned untouched', prepareForWallEdit(tied, 'feet') === tied);
check('A floor with no rooms is returned untouched', prepareForWallEdit({ ...legacyState, rooms: [] }, 'feet').rooms.length === 0);
const metricLegacy = loadFloors({ ...legacy, unit: 'meters', walls: box(0, 0, 4, 3, 0.23) } as unknown as FloorPlan);
eq('A metre plan keeps metres', levelToState(metricLegacy[0]).walls.map(w => formatDimension(wallLengthOf(w), 'meters')), ['4.00 m', '3.00 m', '4.00 m', '3.00 m']);

console.log('\n--- 13. Selecting, zooming and label editing do not change geometry ---');
const before = JSON.stringify(room);
parseLengthInput('twelve feet', 'feet');
parseLengthInput('', 'feet');
formatDimension(wallLengthOf(byId(room, 'top')), 'feet');
outsideNormal(byId(room, 'top'), drawn.rooms, centre, 0.5);
roomInterior(drawn.rooms[0], room, TOL);
layoutDimension({ x: 0, y: 0 }, { x: 240, y: 0 }, { x: 0, y: -1 }, { offset: 30, gap: 6, overshoot: 5, labelLength: 60, labelHeight: 18, arrow: 7 });
eq('Measuring, labelling and a refused entry leave every wall untouched', JSON.stringify(room), before);
const opened = parseLengthInput(formatLengthForInput(wallLengthOf(byId(room, 'top')), 'feet'), 'feet');
check('Opening a label and confirming it unchanged is not an edit', opened.ok && resizeWall(room, 'top', opened.value, 'start', TOL) === room);
eq('A tap with the sketch tool adds no wall', interpretStroke([{ x: 6, y: 5 }, { x: 6.1, y: 5.05 }], room, { unit: 'feet', thickness: 0.75, newId }).walls.length, 0);
eq('A drag of zero distance moves nothing', translateWall(room, 'top', 0, 0, TOL) === room, true);

console.log(`\n✅ Floor Planner measurements: all ${passed} checks passed.\n`);
