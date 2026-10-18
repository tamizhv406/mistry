/**
 * Floor Planner editing: erasing one wall segment, splitting walls, lining walls up after a
 * small measuring difference, changing room sizes through their walls and adding rooms.
 * Pure logic, no browser.
 */
import {
  addRoom, applyAlignmentFix, deleteRoom, eraseWallSegment, findAlignmentIssues, formatMm, resizeRoom, roomBox, splitWall, splitWallAtJunctions,
  wallJunctions, wallSegmentAt, type NewId,
} from '../src/domain/planEdit';
import { joinTolerance, moveJoint, roomArea, wallLengthOf } from '../src/domain/planGeometry';
import { PlanHistory, buildSavePayload, emptyFloorState, loadFloors, normaliseFloor, type FloorState } from '../src/domain/planDocument';
import { interpretStroke } from '../src/domain/planSketch';
import type { FloorPlan, FloorPlanDoor, FloorPlanLevel, FloorPlanUnit, FloorPlanWall } from '../src/db/types';

let passed = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (!cond) throw new Error(`FAILED: ${name}${detail !== undefined ? ' — got ' + JSON.stringify(detail) : ''}`);
  passed += 1;
  console.log(`  ✓ ${name}`);
}
const near = (name: string, actual: number, expected: number, eps = 1e-9) =>
  check(`${name} (${expected})`, Math.abs(actual - expected) <= eps, actual);

let seq = 0;
const newId: NewId = prefix => `${prefix}-n${++seq}`;
const wall = (id: string, x1: number, y1: number, x2: number, y2: number, thickness = 0.75): FloorPlanWall => ({ id, x1, y1, x2, y2, thickness, wallType: 'exterior' });
const floor = (walls: FloorPlanWall[], unit: FloorPlanUnit = 'feet', doors: FloorPlanDoor[] = []): FloorState =>
  normaliseFloor({ ...emptyFloorState(), walls, doors }, unit, () => newId('room')).state;
const ok = <T extends { ok: boolean }>(r: T): Extract<T, { ok: true }> => {
  if (!r.ok) throw new Error(`refused: ${(r as unknown as { reason: string }).reason}`);
  return r as Extract<T, { ok: true }>;
};
const byId = (s: FloorState, id: string) => s.walls.find(w => w.id === id)!;
const door = (id: string, wallId: string, x: number, y: number, width = 3): FloorPlanDoor =>
  ({ id, doorType: 'Single', x, y, width, rotation: 0, wallId, wallOffset: x, layer: 'doors' });
const TOL = joinTolerance('feet');

// Two rooms side by side. The top and bottom walls run the whole 24 ft; the partition at
// x = 10 meets them partway (T-junctions).
const twoRooms = () => floor([
  wall('top', 0, 0, 24, 0), wall('right', 24, 0, 24, 12), wall('bottom', 24, 12, 0, 12), wall('left', 0, 12, 0, 0),
  wall('mid', 10, 0, 10, 12, 0.375),
]);

console.log('\n--- 1. Junctions and segments ---');
{
  const s = twoRooms();
  check('Two rooms are found', s.rooms.length === 2, s.rooms.length);
  check('The top wall has one junction, where the partition meets it', JSON.stringify(wallJunctions(s.walls, 'top', TOL)) === '[10]', wallJunctions(s.walls, 'top', TOL));
  check('The partition has none (it meets other walls at its own ends)', wallJunctions(s.walls, 'mid', TOL).length === 0);
  const seg = wallSegmentAt(s.walls, 'top', { x: 4, y: 0.2 }, TOL)!;
  check('A tap left of the junction is on the 0–10 ft segment', seg.t0 === 0 && seg.t1 === 10 && !seg.whole, seg);
  const seg2 = wallSegmentAt(s.walls, 'top', { x: 17, y: -0.3 }, TOL)!;
  check('A tap right of it is on the 10–24 ft segment', seg2.t0 === 10 && seg2.t1 === 24, seg2);
  check('A wall nothing meets is one whole segment', wallSegmentAt(s.walls, 'mid', { x: 10, y: 5 }, TOL)!.whole);
  // A wall that crosses another one is divided at the crossing.
  const cross = floor([wall('h', 0, 5, 20, 5), wall('v', 8, 0, 8, 10)]);
  check('A crossing divides both walls', wallJunctions(cross.walls, 'h', TOL)[0] === 8 && wallJunctions(cross.walls, 'v', TOL)[0] === 5);
}

console.log('\n--- 2. Erasing one segment, not the whole wall ---');
{
  const start = { ...twoRooms() };
  const withDoors = { ...start, doors: [door('d-left', 'top', 5, 0), door('d-right', 'top', 18, 0)] };
  const before = JSON.stringify(withDoors);
  const r = ok(eraseWallSegment(withDoors, 'top', { x: 5, y: 0.1 }, 'feet', newId));
  check('The input floor is not changed', JSON.stringify(withDoors) === before);
  const top = byId(r.state, 'top');
  check('Only the 0–10 ft part of the top wall is gone', top && top.x1 === 10 && top.y1 === 0 && top.x2 === 24 && top.y2 === 0, top);
  check('No new walls appear; the others are untouched', r.state.walls.length === 5 &&
    ['right', 'bottom', 'left', 'mid'].every(id => JSON.stringify(byId(r.state, id)) === JSON.stringify(byId(start, id))));
  check('The left room is open now, so it is no longer a room', r.state.rooms.length === 1);
  near('The right room keeps its exact area', roomArea(r.state.rooms[0]), 14 * 12);
  check('The door on the erased part went with it', !r.state.doors.some(d => d.id === 'd-left'));
  const kept = r.state.doors.find(d => d.id === 'd-right')!;
  check('The door on the remaining part stays exactly where it was', kept && kept.x === 18 && kept.y === 0 && kept.wallId === 'top', kept);
  near('…measured from the start of the wall that is left', kept.wallOffset!, 8);
  check('The result says what was erased', /10'-0"/.test(r.summary) && /rest stays/.test(r.summary), r.summary);
  check('…and that a door went with it', r.warnings.length === 1 && /door/.test(r.warnings[0]), r.warnings);

  // Erasing the middle segment of a wall with two junctions leaves two separate walls.
  const three = floor([
    wall('top', 0, 0, 30, 0), wall('right', 30, 0, 30, 12), wall('bottom', 30, 12, 0, 12), wall('left', 0, 12, 0, 0),
    wall('m1', 10, 0, 10, 12), wall('m2', 20, 0, 20, 12),
  ]);
  const mid = ok(eraseWallSegment(three, 'top', { x: 15, y: 0 }, 'feet', newId));
  const tops = mid.state.walls.filter(w => w.y1 === 0 && w.y2 === 0);
  check('The middle segment is erased, both outer parts stay', tops.length === 2 &&
    tops.some(w => w.id === 'top' && w.x1 === 0 && w.x2 === 10) && tops.some(w => w.id !== 'top' && w.x1 === 20 && w.x2 === 30), tops);
  check('The partitions are untouched', JSON.stringify(byId(mid.state, 'm1')) === JSON.stringify(byId(three, 'm1')));

  // Regression: the opened room must not take over the room next door (it used to, when it
  // came first in the list and its own space was gone).
  const named = { ...start, rooms: start.rooms.map(r => ({ ...r, label: roomBox(r)!.minX === 0 ? 'Kitchen' : 'Bedroom' })) };
  const leftFirst = { ...named, rooms: [...named.rooms].sort(a => (a.label === 'Kitchen' ? -1 : 1)) };
  const opened = ok(eraseWallSegment(leftFirst, 'left', { x: 0, y: 6 }, 'feet', newId));
  check('The room next door keeps its own name and id', opened.state.rooms.length === 1 && opened.state.rooms[0].label === 'Bedroom' &&
    opened.state.rooms[0].id === named.rooms.find(r => r.label === 'Bedroom')!.id, opened.state.rooms.map(r => r.label));

  const lone = floor([wall('a', 0, 0, 10, 0), wall('b', 0, 5, 10, 5)]);
  const whole = ok(eraseWallSegment(lone, 'a', { x: 3, y: 0 }, 'feet', newId));
  check('A wall nothing meets is erased whole', whole.state.walls.length === 1 && whole.state.walls[0].id === 'b');
  check('…and says so', /Wall erased/.test(whole.summary), whole.summary);

  const locked = floor([{ ...wall('a', 0, 0, 10, 0), locked: true }]);
  check('A locked wall is not erased', !eraseWallSegment(locked, 'a', { x: 3, y: 0 }, 'feet', newId).ok);
  check('An unknown wall is refused, not crashed on', !eraseWallSegment(locked, 'nope', { x: 3, y: 0 }, 'feet', newId).ok);
}

console.log('\n--- 3. Splitting a wall into walls edited on their own ---');
{
  const s = { ...floor([wall('a', 0, 0, 20, 0), wall('b', 20, 0, 20, 10)]), doors: [door('d1', 'a', 15, 0)] };
  const r = ok(splitWall(s, 'a', { x: 7.3, y: 0.2 }, 'feet', newId));
  const [id1, id2] = r.ids!;
  const p1 = byId(r.state, id1), p2 = byId(r.state, id2);
  check('The first part keeps the wall id', id1 === 'a');
  check('The cut is exactly on the wall line at 7.3 ft', p1.x2 === 7.3 && p1.y2 === 0 && p2.x1 === 7.3 && p2.y1 === 0, [p1, p2]);
  check('The outer ends are unchanged', p1.x1 === 0 && p1.y1 === 0 && p2.x2 === 20 && p2.y2 === 0);
  near('The two lengths add up to the original', wallLengthOf(p1) + wallLengthOf(p2), 20);
  check('Both parts keep thickness and type', p2.thickness === 0.75 && p2.wallType === 'exterior');
  const d = r.state.doors[0];
  check('The door moves to the part it stands on, at the same spot', d.wallId === id2 && d.x === 15 && d.y === 0, d);
  near('…and its offset is measured from that part', d.wallOffset!, 15 - 7.3, 1e-9);
  check('The corner wall still meets the second part', byId(r.state, 'b').x1 === p2.x2 && byId(r.state, 'b').y1 === p2.y2);
  check('The summary gives both lengths', /7'-3/.test(r.summary) && /12'-8/.test(r.summary), r.summary);

  check('Splitting next to an end is refused', !splitWall(s, 'a', { x: 0.2, y: 0 }, 'feet', newId).ok);
  const through = splitWall(s, 'a', { x: 15.5, y: 0 }, 'feet', newId);
  check('Splitting through a door is refused, with the reason', !through.ok && /door/.test((through as { reason: string }).reason));

  // Moving the shared corner afterwards keeps the two parts joined.
  const moved = moveJoint(r.state.walls, { x: 7.3, y: 0 }, { x: 7.3, y: 2 }, TOL);
  const m1 = moved.find(w => w.id === id1)!, m2 = moved.find(w => w.id === id2)!;
  check('Dragging the new corner moves both parts together', m1.x2 === 7.3 && m1.y2 === 2 && m2.x1 === 7.3 && m2.y1 === 2);

  // A split near a junction lands exactly on it.
  const t = twoRooms();
  const snapped = ok(splitWall(t, 'top', { x: 10.2, y: 0 }, 'feet', newId));
  check('A split within reach of a junction is made exactly at the junction', byId(snapped.state, 'top').x2 === 10, byId(snapped.state, 'top'));
  check('Splitting does not change any room', snapped.state.rooms.length === 2 &&
    snapped.state.rooms.map(r2 => roomArea(r2)).sort((a, b) => a - b).join() === '120,168');

  const all = ok(splitWallAtJunctions(twoRooms(), 'top', 'feet', newId));
  check('Split at joints cuts the wall at every junction', all.ids!.length === 2);
  check('…and refuses a wall with no junctions', !splitWallAtJunctions(twoRooms(), 'mid', 'feet', newId).ok);
}

console.log('\n--- 4. Small measuring differences: shown, never changed silently ---');
{
  // The example from the site: a wall 150 mm below the reference line at one end and 140 mm
  // at the other. Plan in metres.
  const s = floor([wall('w', 1, 0.15, 4, 0.14, 0.23), wall('v', 4, 0.14, 4, 3, 0.23)], 'meters');
  const frozen = JSON.stringify(s.walls);
  const issues = findAlignmentIssues(s.walls, 'meters');
  check('Finding issues changes nothing', JSON.stringify(s.walls) === frozen);
  const i = issues.find(x => x.wallIds[0] === 'w')!;
  check('The tilted wall is reported', !!i && i.kind === 'out_of_line', issues);
  near('First measurement: 150 mm', i.measurements[0].mm, 150, 1e-6);
  near('Second measurement: 140 mm', i.measurements[1].mm, 140, 1e-6);
  near('Difference: 10 mm', i.differenceMm, 10, 1e-6);
  check('Both are measured from a real line', /top edge of the plot/.test(i.reference));
  check('The difference reads "10 mm"', formatMm(i.differenceMm) === '10 mm', formatMm(i.differenceMm));
  check('The vertical wall is not reported', !issues.some(x => x.wallIds.includes('v')));

  const fix = ok(applyAlignmentFix(s, i, 0, 'meters', newId));
  const w = byId(fix.state, 'w'), v = byId(fix.state, 'v');
  check('Keeping 150 mm moves the other end to 150 mm', w.y1 === 0.15 && w.y2 === 0.15, w);
  check('The joined wall moves with it, so they stay joined', v.x1 === 4 && v.y1 === 0.15 && v.y2 === 3, v);
  check('The fix says what moved', /10 mm/.test(fix.changes[0]), fix.changes);
  check('After the fix nothing is reported for that wall', !findAlignmentIssues(fix.state.walls, 'meters').some(x => x.wallIds.includes('w')));
  const other = ok(applyAlignmentFix(s, i, 1, 'meters', newId));
  check('Keeping 140 mm instead moves the first end', byId(other.state, 'w').y1 === 0.14 && byId(other.state, 'w').y2 === 0.14);

  // Two walls that continue each other, 10 mm apart, joined by a 10 mm jog.
  const step = floor([wall('a', 0, 3.15, 3, 3.15, 0.23), wall('jog', 3, 3.15, 3, 3.14, 0.23), wall('b', 3, 3.14, 6, 3.14, 0.23)], 'meters');
  const st = findAlignmentIssues(step.walls, 'meters').find(x => x.kind === 'step')!;
  check('A 10 mm step between two walls is reported', !!st && Math.round(st.differenceMm) === 10, st);
  const stFix = ok(applyAlignmentFix(step, st, 0, 'meters', newId));
  check('Fixing it lines both walls up on the kept line', stFix.state.walls.filter(x => x.y1 === 3.15 && x.y2 === 3.15).length === 2, stFix.state.walls);
  check('…and removes the jog that has no length left', !stFix.state.walls.some(x => x.id === 'jog'));

  const fine = floor([wall('a', 0, 0, 10, 0), wall('b', 10, 0, 10, 10), wall('c', 0, 0, 7, 7)]);
  check('Straight walls and diagonal walls report nothing', findAlignmentIssues(fine.walls, 'feet').length === 0);
  const big = floor([wall('a', 0, 0, 3, 0.4, 0.23)], 'meters');
  check('A 400 mm difference is taken as intended and not reported', findAlignmentIssues(big.walls, 'meters').length === 0);
  const feet = floor([wall('a', 0, 10, 12, 10 + 10 / 304.8)]);
  check('Works in feet plans too (10 mm on a feet plan)', Math.round(findAlignmentIssues(feet.walls, 'feet')[0]?.differenceMm) === 10);
}

console.log('\n--- 5. Room sizes changed through the walls ---');
{
  const s = twoRooms();
  const left = s.rooms.find(r => roomBox(r)!.minX === 0)!;
  const right = s.rooms.find(r => roomBox(r)!.minX === 10)!;
  const r = ok(resizeRoom(s, left.id, { width: 8 }, 'feet', newId));
  const lb = roomBox(r.state.rooms.find(x => x.id === left.id)!)!;
  const rb = roomBox(r.state.rooms.find(x => x.id === right.id)!)!;
  check('The room is now exactly 8 ft wide', lb.maxX - lb.minX === 8, lb);
  check('The partition moved; the room next to it grew by the same 2 ft', rb.minX === 8 && rb.maxX === 24, rb);
  check('The outside walls did not move', byId(r.state, 'left').x1 === 0 && byId(r.state, 'right').x1 === 24);
  check('Both changed rooms are listed', r.changes.length === 2 && r.changes.some(c => /8'-0"/.test(c)) && r.changes.some(c => /16'-0"/.test(c)), r.changes);
  check('Room names are kept', r.state.rooms.find(x => x.id === left.id)!.label === left.label);

  const longer = resizeRoom(s, left.id, { length: 10 }, 'feet', newId);
  check('A side whose wall runs on past the room is not moved; the reason is given', !longer.ok && /runs on past/.test((longer as { reason: string }).reason));

  const single = floor([wall('t', 0, 0, 14, 0), wall('r', 14, 0, 14, 12), wall('b', 14, 12, 0, 12), wall('l', 0, 12, 0, 0)]);
  const room = single.rooms[0];
  const both = ok(resizeRoom(single, room.id, { width: 10, length: 11 }, 'feet', newId, {}, { length: 30, width: 40 }));
  const bb = roomBox(both.state.rooms[0])!;
  check('Width and length set together', bb.maxX - bb.minX === 10 && bb.maxY - bb.minY === 11, bb);
  near('Area follows: 110 sq.ft', roomArea(both.state.rooms[0]), 110);
  const leftSide = ok(resizeRoom(single, room.id, { width: 10 }, 'feet', newId, { width: 'left' }));
  check('The left side can be chosen instead', roomBox(leftSide.state.rooms[0])!.minX === 4);
  const outside = ok(resizeRoom(single, room.id, { width: 40 }, 'feet', newId, {}, { length: 30, width: 40 }));
  check('Going past the plot is allowed but warned about', outside.warnings.some(w => /outside the plot/.test(w)));

  check('A missing size is refused', !resizeRoom(single, room.id, {}, 'feet', newId).ok);
  check('A size that is not a number is refused', !resizeRoom(single, room.id, { width: NaN }, 'feet', newId).ok);
  check('A negative size is refused', !resizeRoom(single, room.id, { width: -5 }, 'feet', newId).ok);
  check('A tiny size is refused', !resizeRoom(single, room.id, { width: 1 }, 'feet', newId).ok);
  check('An unknown room is refused', !resizeRoom(single, 'nope', { width: 10 }, 'feet', newId).ok);
  const same = resizeRoom(single, room.id, { width: 14 }, 'feet', newId);
  check('The same size is reported as no change', !same.ok && /already/.test((same as { reason: string }).reason));

  const placed: FloorState = { ...emptyFloorState(), rooms: [{ id: 'hp', roomType: 'Bedroom', label: 'Bedroom', x: 2, y: 2, width: 12, height: 10, rotation: 0 }] };
  const hp = ok(resizeRoom(placed, 'hp', { width: 10 }, 'feet', newId));
  check('A hand-placed room simply gets the new width', hp.state.rooms[0].width === 10 && hp.state.rooms[0].height === 10 && hp.state.rooms[0].x === 2);
}

console.log('\n--- 6. Adding a room ---');
{
  const single = floor([wall('t', 2, 2, 14, 2), wall('r', 14, 2, 14, 14), wall('b', 14, 14, 2, 14), wall('l', 2, 14, 2, 2)]);
  const host = single.rooms[0];
  const inside = ok(addRoom(single, 'Bathroom', 'feet', { length: 30, width: 40 }, newId, { insideRoomId: host.id }));
  const bath = inside.state.rooms.find(r => r.id === inside.roomId)!;
  check('A bathroom is added inside the room', !!bath && bath.roomType === 'Bathroom' && bath.label === 'Bathroom', bath);
  near('It is 5 × 7 ft', roomArea(bath), 35);
  const rest = inside.state.rooms.find(r => r.id === host.id)!;
  check('The room it was made in keeps its name', !!rest && rest.label === host.label);
  near('…and is smaller by exactly that much', roomArea(rest), 144 - 35);
  check('Two inside walls and a bathroom door are added', inside.state.walls.length === 6 && inside.state.doors.length === 1 && inside.state.doors[0].doorType === 'Bathroom');

  const outside = ok(addRoom(single, 'Bathroom', 'feet', { length: 30, width: 40 }, newId));
  const ob = roomBox(outside.state.rooms.find(r => r.id === outside.roomId)!)!;
  check('Without a room chosen it is built against the outside wall', ob.minX === 14 && ob.maxX === 19 && ob.minY === 2 && ob.maxY === 9, ob);
  check('The shared wall is not doubled (3 new walls)', outside.state.walls.length === 7, outside.state.walls.length);
  check('It gets a door through the shared wall', outside.state.doors.length === 1 && outside.state.doors[0].wallId === 'r');
  check('The first room is unchanged', outside.state.rooms.some(r => r.id === host.id && roomArea(r) === 144));

  const tiny = floor([wall('t', 0, 0, 10, 0), wall('r', 10, 0, 10, 10), wall('b', 10, 10, 0, 10), wall('l', 0, 10, 0, 0)]);
  check('No space on the plot is refused, with a reason', !addRoom(tiny, 'Bedroom', 'feet', { length: 10, width: 10 }, newId).ok);
  check('A room too big for the chosen room is refused', !addRoom(tiny, 'Living Room', 'feet', { length: 30, width: 40 }, newId, { insideRoomId: tiny.rooms[0].id }).ok);
  const empty = ok(addRoom(emptyFloorState(), 'Kitchen', 'meters', { length: 9, width: 12 }, newId));
  check('On an empty plan the room is drawn on the plot (metres)', empty.state.walls.length === 4 && empty.state.rooms.length === 1 && empty.state.rooms[0].roomType === 'Kitchen');
}

console.log('\n--- 6b. Deleting a room ---');
{
  const s = twoRooms();
  const left = s.rooms.find(r => roomBox(r)!.minX === 0)!;
  const right = s.rooms.find(r => roomBox(r)!.minX === 10)!;
  const d = ok(deleteRoom(s, left.id, 'feet', newId));
  check('The room is gone', !d.state.rooms.some(r => r.id === left.id));
  check('The room next door stays closed, with its area', d.state.rooms.length === 1 && d.state.rooms[0].id === right.id && roomArea(d.state.rooms[0]) === 168);
  check('The shared partition stays', !!d.state.walls.find(w => w.id === 'mid'));
  check('The left wall (used only by that room) is gone', !d.state.walls.some(w => w.id === 'left'));
  const top = d.state.walls.find(w => w.id === 'top' || (w.y1 === 0 && w.y2 === 0))!;
  check('Only the room\'s part of the long top wall is removed', top && Math.min(top.x1, top.x2) === 10 && Math.max(top.x1, top.x2) === 24, top);
  // A room surrounded by others on every side can not be deleted without opening them.
  const grid = floor([
    wall('o1', 0, 0, 30, 0), wall('o2', 30, 0, 30, 30), wall('o3', 30, 30, 0, 30), wall('o4', 0, 30, 0, 0),
    wall('v1', 10, 0, 10, 30), wall('v2', 20, 0, 20, 30), wall('h1', 0, 10, 30, 10), wall('h2', 0, 20, 30, 20),
  ]);
  const centre = grid.rooms.find(r => { const b = roomBox(r)!; return b.minX === 10 && b.minY === 10; })!;
  check('A room with every wall shared is refused, with the reason', !deleteRoom(grid, centre.id, 'feet', newId).ok);
  const placed: FloorState = { ...emptyFloorState(), rooms: [{ id: 'hp', roomType: 'Bedroom', label: 'Bedroom', x: 2, y: 2, width: 12, height: 10, rotation: 0 }] };
  check('A hand-placed room is simply removed', ok(deleteRoom(placed, 'hp', 'feet', newId)).state.rooms.length === 0);
}

console.log('\n--- 7. Undo, saving and reopening keep the edited geometry ---');
{
  const s = twoRooms();
  const history = new PlanHistory();
  history.reset('f1', s);
  const erased = ok(eraseWallSegment(s, 'top', { x: 5, y: 0 }, 'feet', newId)).state;
  history.push('f1', erased);
  const split = ok(splitWall(erased, 'bottom', { x: 6, y: 12 }, 'feet', newId)).state;
  history.push('f1', split);
  check('Undo goes back one edit', JSON.stringify(history.undo('f1')) === JSON.stringify(erased));
  check('Undo again restores the original exactly', JSON.stringify(history.undo('f1')) === JSON.stringify(s));
  check('Redo brings the erase back', JSON.stringify(history.redo('f1')) === JSON.stringify(erased));

  const plan = { id: 'p', plotLength: 30, plotWidth: 40, floorName: 'Ground Floor', unit: 'feet' } as FloorPlan;
  const floors: FloorPlanLevel[] = [{ id: 'f1', name: 'Ground Floor', walls: [], rooms: [], doors: [], windows: [] }];
  const saved = JSON.parse(JSON.stringify(buildSavePayload(plan, floors, 0, split)));
  const reopened = loadFloors({ ...plan, ...saved } as FloorPlan)[0];
  check('Split walls are saved and reopened exactly', JSON.stringify(reopened.walls) === JSON.stringify(split.walls));
  check('Rooms are reopened unchanged', JSON.stringify(reopened.rooms) === JSON.stringify(split.rooms));
}

console.log('\n--- 8. Freehand walls snap to straight lines ---');
{
  const wobble = [{ x: 0, y: 0 }, { x: 3, y: 0.2 }, { x: 6, y: -0.15 }, { x: 9, y: 0.1 }, { x: 12, y: 0.25 }];
  const sketch = { unit: 'feet' as const, thickness: 0.75, newId: () => newId('wall') };
  const res = interpretStroke(wobble, [], sketch);
  check('A wobbly stroke becomes one straight horizontal wall', res.walls.length === 1 && res.walls[0].y1 === res.walls[0].y2, res.walls);
  const diag = interpretStroke([{ x: 0, y: 0 }, { x: 4, y: 4.3 }, { x: 8, y: 7.8 }], [], sketch);
  const d = diag.walls[0];
  check('A rough diagonal snaps to exactly 45°', !!d && Math.abs(Math.abs(d.x2 - d.x1) - Math.abs(d.y2 - d.y1)) < 1e-9, d);
}

console.log(`\n✅ Plan editing: all ${passed} checks passed.\n`);
