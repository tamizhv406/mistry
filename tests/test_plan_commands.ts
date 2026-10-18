/**
 * Building Mistry AI on the device: requests become checked proposals for the real floor
 * (walls, rooms, doors), never applied on their own, and bad input is answered, not crashed on.
 */
import { interpretPlanCommand, lengthsIn, type CommandContext, type CommandResult, type PlanProposal } from '../src/services/planCommands';
import { roomBox, type NewId } from '../src/domain/planEdit';
import { emptyFloorState, normaliseFloor, type FloorState } from '../src/domain/planDocument';
import { roomArea } from '../src/domain/planGeometry';
import type { FloorPlanUnit, FloorPlanWall } from '../src/db/types';

let passed = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (!cond) throw new Error(`FAILED: ${name}${detail !== undefined ? ' — got ' + JSON.stringify(detail) : ''}`);
  passed += 1;
  console.log(`  ✓ ${name}`);
}
let seq = 0;
const newId: NewId = p => `${p}-c${++seq}`;
const wall = (id: string, x1: number, y1: number, x2: number, y2: number, thickness = 0.75): FloorPlanWall => ({ id, x1, y1, x2, y2, thickness, wallType: 'exterior' });
const floor = (walls: FloorPlanWall[], unit: FloorPlanUnit = 'feet'): FloorState => normaliseFloor({ ...emptyFloorState(), walls }, unit, () => newId('room')).state;
const ctxFor = (state: FloorState, extra: Partial<CommandContext> = {}): CommandContext => ({ state, unit: 'feet', plot: { length: 40, width: 40 }, newId, selected: null, ...extra });
const proposal = (r: CommandResult): PlanProposal => {
  if (r.kind !== 'proposal') throw new Error(`expected a proposal, got ${r.kind}: ${'message' in r ? r.message : ''}`);
  return r.proposal;
};
const widthOf = (s: FloorState, id: string) => { const b = roomBox(s.rooms.find(r => r.id === id)!)!; return b.maxX - b.minX; };
const lengthOf = (s: FloorState, id: string) => { const b = roomBox(s.rooms.find(r => r.id === id)!)!; return b.maxY - b.minY; };

// Two rooms side by side: 12 × 12 and 12 × 12, partition at x = 12.
const house = () => {
  const s = floor([wall('top', 0, 0, 24, 0), wall('right', 24, 0, 24, 12), wall('bottom', 24, 12, 0, 12), wall('left', 0, 12, 0, 0), wall('mid', 12, 0, 12, 12, 0.375)]);
  const left = s.rooms.find(r => roomBox(r)!.minX === 0)!, right = s.rooms.find(r => roomBox(r)!.minX === 12)!;
  return { ...s, rooms: s.rooms.map(r => (r.id === left.id ? { ...r, label: 'Bedroom 1', roomType: 'Bedroom' as const } : r.id === right.id ? { ...r, label: 'Bedroom 2', roomType: 'Bedroom' as const } : r)) };
};
const ids = (s: FloorState) => ({ b1: s.rooms.find(r => r.label === 'Bedroom 1')!.id, b2: s.rooms.find(r => r.label === 'Bedroom 2')!.id });

console.log('\n--- 1. Reading sizes from a request ---');
check('"10 feet" → 10', JSON.stringify(lengthsIn(' make it 10 feet wide ', 'feet')) === '[10]');
check('"10 ft 6 in" → 10.5', JSON.stringify(lengthsIn(' 10 ft 6 in ', 'feet')) === '[10.5]');
check('"3500mm" is millimetres, not metres', JSON.stringify(lengthsIn(' 3500mm wide ', 'meters')) === '[3.5]');
check('"12 by 14 feet" in a metre plan is two lengths in feet', lengthsIn(' 12 by 14 feet ', 'meters').every((v, i) => Math.abs(v - [12, 14][i] * 0.3048) < 1e-9));
check('"7 in bedroom" is 7, not 7 inches', JSON.stringify(lengthsIn(' 5 by 7 in bedroom ', 'feet')) === '[5,7]');

console.log('\n--- 2. "Make this bedroom 10 feet wide" changes the real walls ---');
{
  const s = house();
  const { b1, b2 } = ids(s);
  const frozen = JSON.stringify(s);
  const p = proposal(interpretPlanCommand('Make this bedroom 10 feet wide', ctxFor(s, { selected: { type: 'room', id: b1 } })));
  check('Nothing is changed before Apply', JSON.stringify(s) === frozen);
  check('The proposal makes Bedroom 1 exactly 10 ft wide', widthOf(p.next, b1) === 10, widthOf(p.next, b1));
  check('…by moving the partition, so Bedroom 2 becomes 14 ft', widthOf(p.next, b2) === 14);
  check('The moved wall is the partition', p.next.walls.find(w => w.id === 'mid')!.x1 === 10);
  check('Both rooms that change are listed', p.changes.length === 2, p.changes);
  check('It is not marked as removing anything', !p.destructive);

  const two = interpretPlanCommand('make bedroom 10 feet wide', ctxFor(s));
  check('With two bedrooms and none selected, it asks which', two.kind === 'question' && two.options.length === 2, two);
  if (two.kind === 'question') {
    const picked = proposal(interpretPlanCommand('make bedroom 10 feet wide', ctxFor(s, { targetRoomId: two.options[1].roomId })));
    check('…and the answer applies to the room picked', widthOf(picked.next, two.options[1].roomId) === 10);
  }
  const named = proposal(interpretPlanCommand('make bedroom 2 10 feet wide', ctxFor(s)));
  check('"bedroom 2 10 feet wide": the 2 is the name, 10 is the size', widthOf(named.next, b2) === 10, widthOf(named.next, b2));

  const both = proposal(interpretPlanCommand('Make this room 10 by 9 feet', ctxFor(floor([wall('t', 0, 0, 12, 0), wall('r', 12, 0, 12, 12), wall('b', 12, 12, 0, 12), wall('l', 0, 12, 0, 0)]))));
  const rid = both.next.rooms[0].id;
  check('"10 by 9 feet" sets width and length', widthOf(both.next, rid) === 10 && lengthOf(both.next, rid) === 9);

  const longer = interpretPlanCommand('make bedroom 1 10 feet long', ctxFor(s));
  check('A change that can not be made is explained, and the plan is kept', longer.kind === 'answer' && /not changed/.test(longer.message), longer);
  const axis = interpretPlanCommand('make bedroom 1 10 feet', ctxFor(s));
  check('A size without "wide" or "long" asks which', axis.kind === 'unknown' && /width or the length/.test(axis.message), axis);

  const m = floor([wall('t', 0, 0, 4, 0, 0.23), wall('r', 4, 0, 4, 4, 0.23), wall('b', 4, 4, 0, 4, 0.23), wall('l', 0, 4, 0, 0, 0.23)], 'meters');
  const metric = proposal(interpretPlanCommand('make this room 3500 mm wide', { ...ctxFor(m), unit: 'meters', plot: { length: 9, width: 12 } }));
  check('Metre plans: 3500 mm wide → 3.5 m', Math.abs(widthOf(metric.next, metric.next.rooms[0].id) - 3.5) < 1e-9);
}

console.log('\n--- 3. "Add a bathroom" draws walls, a room and a door ---');
{
  const s = house();
  const { b1 } = ids(s);
  const out = proposal(interpretPlanCommand('Add a bathroom', ctxFor(s)));
  const bath = out.next.rooms.find(r => r.roomType === 'Bathroom');
  check('A bathroom room is in the proposal', !!bath && roomArea(bath) === 35, bath);
  check('New walls and a door come with it', out.next.walls.length > s.walls.length && out.next.doors.length === 1);
  check('The bedrooms are not changed', ['Bedroom 1', 'Bedroom 2'].every(l => roomArea(out.next.rooms.find(r => r.label === l)!) === 144));

  const inside = proposal(interpretPlanCommand('add a bathroom 5 by 6 in bedroom 1', ctxFor(s)));
  const ib = inside.next.rooms.find(r => r.roomType === 'Bathroom')!;
  const ibb = roomBox(ib)!;
  check('"5 by 6 in bedroom 1": inside Bedroom 1, 5 × 6 ft', ibb.maxX - ibb.minX === 5 && ibb.maxY - ibb.minY === 6 && ibb.maxX <= 12, ibb);
  check('Bedroom 1 keeps its name and is smaller', roomArea(inside.next.rooms.find(r => r.id === b1)!) === 144 - 30);
  const sel = proposal(interpretPlanCommand('add a toilet in this room', ctxFor(s, { selected: { type: 'room', id: b1 } })));
  check('"in this room" uses the selected room', sel.next.rooms.some(r => r.roomType === 'Toilet') && roomArea(sel.next.rooms.find(r => r.id === b1)!) < 144);
  const what = interpretPlanCommand('add something nice', ctxFor(s));
  check('An add without a room type asks which room', what.kind === 'unknown' && /Which room/.test(what.message));
}

console.log('\n--- 4. "Fix my plan" ---');
{
  // A 10 mm tilt, a 0.4 ft gap at one corner and a wall drawn twice.
  const tilt = 10 / 304.8;
  const s = floor([
    wall('top', 0, 0, 12, tilt), wall('right', 12, tilt, 12, 10), wall('bottom', 12, 10, 0, 10), wall('left', 0, 10, 0, 0.4),
    wall('again', 0, 10, 12, 10),
  ]);
  const frozen = JSON.stringify(s);
  const p = proposal(interpretPlanCommand('Fix my plan', ctxFor(s)));
  check('The plan is not changed before Apply', JSON.stringify(s) === frozen);
  check('The duplicate wall is removed', !p.next.walls.some(w => w.id === 'again') || !p.next.walls.some(w => w.id === 'bottom'));
  check('The corner gap is joined', p.next.walls.some(w => w.id === 'left' && w.y2 === 0) || p.next.walls.some(w => w.id === 'top' && w.y1 === 0.4));
  const top = p.next.walls.find(w => w.id === 'top')!;
  check('The 10 mm tilt is straightened', top.y1 === top.y2, top);
  check('Every fix is listed', p.changes.length >= 3, p.changes);
  check('The 10 mm difference is named in the list', p.changes.some(c => /10 mm/.test(c)), p.changes);
  check('Removing a wall marks it as removing something', p.destructive);
  check('The closed room appears', p.next.rooms.length === 1);

  const clean = interpretPlanCommand('fix my plan', ctxFor(house()));
  check('A clean plan: nothing to fix, nothing proposed', clean.kind === 'answer' && /Nothing to fix/.test(clean.message), clean);
}

console.log('\n--- 5. Rename, questions and bad input ---');
{
  const s = house();
  const { b1 } = ids(s);
  const rn = proposal(interpretPlanCommand('Rename this room to pooja', ctxFor(s, { selected: { type: 'room', id: b1 } })));
  const r = rn.next.rooms.find(x => x.id === b1)!;
  check('Rename sets the label and the room type', r.label === 'Pooja' && r.roomType === 'Pooja', r);
  const rn2 = proposal(interpretPlanCommand('rename bedroom 2 to guest room', ctxFor(s)));
  check('"rename bedroom 2 to guest room" renames Bedroom 2', rn2.next.rooms.some(x => x.label === 'Guest Room' && x.roomType === 'Guest Room') && rn2.next.rooms.some(x => x.label === 'Bedroom 1'));
  const area = interpretPlanCommand('what is the total area', ctxFor(s));
  check('A question about area is answered from the plan', area.kind === 'answer' && /288/.test(area.message), area);

  for (const bad of ['', '   ', 'x'.repeat(600), 'qwerty asdf']) {
    const res = interpretPlanCommand(bad, ctxFor(s));
    check(`Bad input ${JSON.stringify(bad.slice(0, 12))} is answered, not crashed on`, res.kind === 'unknown');
  }
  check('A missing request is handled', interpretPlanCommand(undefined as unknown as string, ctxFor(s)).kind === 'unknown');
  check('A missing plan is handled', interpretPlanCommand('fix my plan', { ...ctxFor(s), state: undefined as unknown as FloorState }).kind === 'unknown');
  const none = interpretPlanCommand('make this bedroom 10 feet wide', ctxFor(emptyFloorState()));
  check('An empty floor says there are no rooms', none.kind === 'answer' && /no rooms/.test(none.message));
}

console.log(`\n✅ Building Mistry AI commands: all ${passed} checks passed.\n`);
