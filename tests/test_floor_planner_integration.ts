/**
 * Floor Planner inside Mistry: feet-inches input and labels, and plan storage in the app's
 * `floorPlans` table (versions, named snapshots, conflicts, the fields lists show).
 *
 * The planner's code uses Vite features (import.meta.glob for its translations), so its
 * modules are loaded through a Vite server in SSR mode rather than imported directly.
 */
import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const g = globalThis as Record<string, any>;
const store: Record<string, string> = {};
g.localStorage = {
  getItem: (k: string) => (k in store ? store[k] : null),
  setItem: (k: string, v: string) => {
    store[k] = String(v);
  },
  removeItem: (k: string) => {
    delete store[k];
  },
};
g.document ??= { documentElement: {}, title: '', cookie: '', querySelector: () => null };
g.window ??= { location: { search: '', hash: '' }, addEventListener: () => {}, matchMedia: () => ({ matches: false }) };
g.navigator ??= { language: 'en' };

const root = fileURLToPath(new URL('..', import.meta.url));
const server = await createServer({
  root,
  configFile: false,
  server: { middlewareMode: true, hmr: false, ws: false },
  appType: 'custom',
  logLevel: 'error',
  optimizeDeps: { noDiscovery: true },
});
const load = (p: string) => server.ssrLoadModule(p) as Promise<any>;

let failures = 0;
async function check(name: string, fn: () => unknown | Promise<unknown>) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failures++;
    console.error(`  ✗ ${name}\n    ${(err as Error).message}`);
  }
}

try {
  const units = await load('/src/floorPlanner/i18n/lengthUnit.ts');
  const { parseLength } = await load('/src/floorPlanner/ui/LengthField.tsx');
  const { db } = await load('/src/db/db.ts');
  const { MistryPlanStorage } = await load('/src/floorPlanner/storage/mistry.ts');
  const { ConflictError } = await load('/src/floorPlanner/storage/types.ts');
  const records = await load('/src/services/floorPlannerRecords.ts');

  console.log('\nFeet-inches (default unit)');
  await check('feet mode is the default', () => assert.equal(units.lengthUnit(), 'ft'));
  await check('12\'-6" is 3810 mm', () => assert.equal(parseLength(`12'-6"`), 3810));
  await check('12\'6", 12ft 6in and "12 6" all read the same', () => {
    assert.equal(parseLength(`12'6"`), 3810);
    assert.equal(parseLength('12ft 6in'), 3810);
    assert.equal(parseLength('12 6'), 3810);
  });
  await check('a plain number is feet', () => assert.equal(parseLength('10'), 3048));
  await check('inches with a fraction', () => assert.equal(parseLength(`6 1/2"`), 165));
  await check('metric input still works in feet mode', () => {
    assert.equal(parseLength('3.5m'), 3500);
    assert.equal(parseLength('350cm'), 3500);
    assert.equal(parseLength('3500mm'), 3500);
  });
  await check('text that is not a length is refused', () => {
    assert.equal(parseLength(''), null);
    assert.equal(parseLength('abc'), null);
  });
  await check('labels: 12\'-6", 9", whole feet', () => {
    assert.equal(units.formatFeetInches(3810), `12'-6"`);
    assert.equal(units.formatFeetInches(228.6), `9"`);
    assert.equal(units.formatFeetInches(3048), `10'`);
    assert.equal(units.formatFeetInches(3822.7, true), `12'-6½"`);
  });
  await check('areas show in sq.ft', () => assert.equal(units.formatPlanArea(10), '108 sq.ft'));
  await check('drawing snaps to 3 inches', () => assert.equal(units.gridSnap(), 76.2));

  console.log('\nMetres (toggle)');
  units.setLengthUnit('m');
  await check('the choice is remembered', () => assert.equal(store['mistry-fp-length-unit'], 'm'));
  await check('a plain number with a decimal is metres', () => assert.equal(parseLength('3.5'), 3500));
  await check('feet typed in metre mode are converted', () => assert.equal(parseLength(`10'`), 3048));
  await check('labels in metres', () => assert.equal(units.formatPlanLength(3810), '3.81 m'));
  units.setLengthUnit('ft');

  console.log('\nPlan storage in the floorPlans table');
  const user = { id: 'user-1', role: 'CONTRACTOR', name: 'Test' } as any;
  const rec = await records.createPlannerRecord(user, { name: 'Murugan house', floorName: 'Ground Floor', site: null });
  const storage = new MistryPlanStorage(rec.id);

  await check('a new record is a Floor Planner record', () => assert.equal(records.isPlannerRecord(rec), true));
  const first = await storage.load();
  await check('a new record opens as a blank plan named after it', () => {
    assert.equal(first.plan.name, 'Murugan house');
    assert.equal(first.plan.walls.length, 0);
    assert.equal(first.rev, 0);
  });

  const wall = { id: 'w1', a: { x: 0, y: 0 }, b: { x: 3810, y: 0 }, thickness: 230, height: 3000 };
  const saved = await storage.save({ ...first.plan, walls: [wall] }, first.rev, 'test');
  await check('saving bumps the revision and stores the plan', async () => {
    assert.equal(saved.rev, 1);
    const stored = await db.floorPlans.get(rec.id);
    assert.equal(stored.revision, 1);
    assert.equal(stored.plannerPlan.walls.length, 1);
    assert.equal(stored.engine, 'house-planner');
  });
  await check('the plot size is kept in feet for lists', async () => {
    const stored = await db.floorPlans.get(rec.id);
    assert.equal(stored.unit, 'feet');
    assert.ok(Math.abs(stored.plotWidth - 20000 / 304.8) < 0.01);
    assert.equal(records.planCounts(stored).walls, 1);
  });
  await check('a save from an older revision is refused as a conflict', async () => {
    await assert.rejects(() => storage.save(first.plan, 0, 'other-tab'), (e: unknown) => e instanceof ConflictError);
  });

  for (let i = 2; i <= 18; i++) {
    const cur = await storage.load();
    await storage.save({ ...cur.plan, name: `Rev ${i}` }, cur.rev, 'test');
  }
  await check('only the last 15 versions are kept', async () => {
    const list = await storage.list();
    assert.equal(list.length, 15);
    assert.equal(list[0].rev, 18);
    assert.equal((list[0] as any).plan, undefined, 'the list must not carry whole plans');
  });
  await check('a kept version can be opened', async () => {
    const v = await storage.get(10);
    assert.equal(v.name, 'Rev 10');
  });
  await check('a version that is no longer kept says so', async () => {
    await assert.rejects(() => storage.get(1));
  });

  const snap = await storage.saveSnapshot('Before client meeting');
  await check('a named version is saved and can be opened', async () => {
    const list = await storage.snapshots();
    assert.equal(list[0].name, 'Before client meeting');
    const plan = await storage.snapshot(snap.id);
    assert.equal(plan.name, 'Rev 18');
  });

  await check('renaming from the list renames the plan too', async () => {
    const stored = await db.floorPlans.get(rec.id);
    await records.renamePlannerRecord(stored, 'Murugan villa');
    const loaded = await storage.load();
    assert.equal(loaded.plan.name, 'Murugan villa');
  });

  await check('plans made by the old planner are listed but marked', async () => {
    const now = new Date().toISOString();
    await db.floorPlans.put({
      id: 'legacy-1', userId: user.id, buildingName: 'Old plan', floorName: 'GF', plotLength: 40, plotWidth: 30,
      unit: 'feet', walls: [], rooms: [], doors: [], windows: [], isDeleted: false, createdAt: now, updatedAt: now,
    });
    const list = await records.listFloorPlans(user);
    const legacy = list.find((p: any) => p.id === 'legacy-1');
    assert.ok(legacy);
    assert.equal(records.isPlannerRecord(legacy), false);
    assert.equal(records.plotText(legacy), `30' × 40'`);
  });

  await check('a deleted plan does not open', async () => {
    const stored = await db.floorPlans.get(rec.id);
    await db.floorPlans.put({ ...stored, isDeleted: true });
    await assert.rejects(() => storage.load());
  });
} finally {
  await server.close();
}

if (failures) {
  console.error(`\n${failures} Floor Planner integration check(s) failed.`);
  process.exit(1);
}
console.log('\nAll Floor Planner integration checks passed.');
