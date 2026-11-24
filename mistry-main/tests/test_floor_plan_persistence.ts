/**
 * Floor plan persistence against a real (in-memory) IndexedDB:
 * save, reload, edit, delete, and protection against overwriting newer changes.
 */
import 'fake-indexeddb/auto';
import type { FloorPlanWall, User } from '../src/db/types';

let passed = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (!cond) throw new Error(`FAILED: ${name}${detail !== undefined ? ' — got ' + JSON.stringify(detail) : ''}`);
  passed += 1;
  console.log(`  ✓ ${name}`);
}

const stamp = '2026-10-01T04:00:00.000Z';
const owner: User = { id: 'u1', username: 'owner', fullName: 'Owner', mobile: '', email: 'o@x.in', passwordHash: 'x', role: 'MISTRY', isActive: true, createdAt: stamp };
const other: User = { ...owner, id: 'u2', username: 'other', email: 'p@x.in' };
const wall = (id: string, x1: number, y1: number, x2: number, y2: number): FloorPlanWall => ({ id, x1, y1, x2, y2, thickness: 0.75, wallType: 'exterior' });
const box = (p: string, w: number, h: number) => [wall(`${p}1`, 0, 0, w, 0), wall(`${p}2`, w, 0, w, h), wall(`${p}3`, w, h, 0, h), wall(`${p}4`, 0, h, 0, 0)];

async function run() {
  const { db } = await import('../src/db/db');
  const fp = await import('../src/services/floorPlanService');
  const doc = await import('../src/domain/planDocument');
  await db.open();

  console.log('\n--- 1. Create, save, reload ---');
  const created = await fp.createFloorPlan(owner, { buildingName: 'House', floorName: 'Ground Floor', plotLength: 30, plotWidth: 20, unit: 'feet', walls: [], rooms: [], doors: [], windows: [] });
  check('Plan created', created.success && !!created.plan);
  const id = created.plan!.id;

  let plan = (await fp.getFloorPlanById(owner, id))!;
  let floors = doc.loadFloors(plan);
  check('A new plan opens with one empty ground floor', floors.length === 1 && floors[0].walls.length === 0);

  const ground = doc.normaliseFloor({ ...doc.emptyFloorState(), walls: box('g', 30, 20) }, 'feet', () => 'room-1').state;
  const s1 = await fp.updateFloorPlan(owner, id, doc.buildSavePayload(plan, floors, 0, ground), plan.revision || 0);
  check('First save succeeds and moves the revision to 1', s1.success && s1.revision === 1, s1);

  plan = (await fp.getFloorPlanById(owner, id))!;
  floors = doc.loadFloors(plan);
  check('Reload returns the same walls', JSON.stringify(floors[0].walls) === JSON.stringify(ground.walls));
  check('Reload returns the room with its exact area', floors[0].rooms.length === 1 && floors[0].rooms[0].area === 600 && floors[0].rooms[0].fromWalls === true);
  check('Stored thumbnail is a data URL', (plan.thumbnailDataUrl || '').startsWith('data:image/svg+xml'));

  console.log('\n--- 2. Edit, add a floor, reload ---');
  const view = doc.addFloor(floors, 0, doc.levelToState(floors[0]), 'First Floor', 10, () => 'lvl-1');
  const first = { ...doc.emptyFloorState(), walls: box('f', 20, 20) };
  const s2 = await fp.updateFloorPlan(owner, id, doc.buildSavePayload(plan, view.floors, view.activeIndex, first), plan.revision);
  check('Second save succeeds at revision 2', s2.success && s2.revision === 2, s2);
  plan = (await fp.getFloorPlanById(owner, id))!;
  floors = doc.loadFloors(plan);
  check('Both floors come back with their own walls', floors.length === 2 && floors[0].walls[0].id === 'g1' && floors[1].walls[0].id === 'f1');
  check('Top-level drawing is still the ground floor', plan.walls[0].id === 'g1');

  console.log('\n--- 3. No overwriting of newer changes ---');
  // Two editors opened the plan at revision 2. A saves first.
  const a = await fp.updateFloorPlan(owner, id, { notes: 'saved by A' }, 2);
  check('Editor A saves', a.success && a.revision === 3);
  const b = await fp.updateFloorPlan(owner, id, { notes: 'saved by B', walls: [] }, 2);
  check('Editor B is refused with a conflict, not saved over A', !b.success && b.conflict === true && b.revision === 3, b);
  plan = (await fp.getFloorPlanById(owner, id))!;
  check('A\'s work is intact', plan.notes === 'saved by A' && plan.walls.length === 4 && plan.revision === 3);
  const b2 = await fp.updateFloorPlan(owner, id, { notes: 'B after reloading' }, b.revision);
  check('B can save after taking the current revision', b2.success && b2.revision === 4);
  const forced = await fp.updateFloorPlan(owner, id, { notes: 'kept mine' });
  check('An explicit "keep my version" save is allowed and still advances the revision', forced.success && forced.revision === 5);

  const results = await Promise.all([1, 2, 3, 4, 5].map(i => fp.updateFloorPlan(owner, id, { notes: `race ${i}` }, 5)));
  check('Five saves racing from the same revision: exactly one wins', results.filter(r => r.success).length === 1 && results.filter(r => r.conflict).length === 4);

  console.log('\n--- 4. Access and delete ---');
  check('Another contractor can not save this plan', !(await fp.updateFloorPlan(other, id, { notes: 'x' })).success);
  let denied = false;
  try { await fp.getFloorPlanById(other, id); } catch { denied = true; }
  check('Another contractor can not open it', denied);
  check('Move to Recycle Bin', (await fp.softDeleteFloorPlan(owner, id)).success && (await fp.getFloorPlanById(owner, id)) === null);
  check('Restore brings the drawing back unchanged', (await fp.restoreFloorPlan(owner, id)).success && (await fp.getFloorPlanById(owner, id))!.walls.length === 4);
  const dup = await fp.duplicateFloorPlan(owner, id);
  check('Duplicate is a separate plan', dup.success && dup.plan!.id !== id && dup.plan!.walls.length === 4);
  check('Permanent delete removes it', (await fp.permanentlyDeleteFloorPlan(owner, id)).success && (await db.floorPlans.get(id)) === undefined);
  check('The duplicate is unaffected', (await db.floorPlans.get(dup.plan!.id))!.walls.length === 4);

  console.log(`\n✅ Floor plan persistence: all ${passed} checks passed.`);
}

run().catch(err => {
  console.error('\n❌', err.message);
  process.exit(1);
});
