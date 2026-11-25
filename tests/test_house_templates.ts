/**
 * House templates for the Floor Planner (task sheet, Task 8): 1/2/3 BHK and Duplex on 20×30 and
 * 30×40 ft plots, the rooms each needs, geometry the planner's own room finder agrees with,
 * doors and windows that fit their walls by the editor's rules, every room reachable through a
 * door, previews, and copies that can be edited and saved without touching the template.
 *
 * Planner modules use Vite features, so they load through a Vite server in SSR mode (as in
 * test_floor_planner_integration.ts).
 */
import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const g = globalThis as Record<string, any>;
const store: Record<string, string> = {};
g.localStorage = {
  getItem: (k: string) => (k in store ? store[k] : null),
  setItem: (k: string, v: string) => { store[k] = String(v); },
  removeItem: (k: string) => { delete store[k]; },
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
let passed = 0;
async function check(name: string, fn: () => unknown | Promise<unknown>) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failures++;
    console.error(`  ✗ ${name}\n    ${(err as Error).message}`);
  }
}
const read = (p: string) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

try {
  const T = await load('/src/domain/houseTemplates.ts');
  const { parsePlan } = await load('/src/floorPlanner/model/schema.ts');
  const { detectRooms } = await load('/src/floorPlanner/stats/rooms.ts');
  const edit = await load('/src/floorPlanner/model/edit.ts');
  const { furnitureCatalog } = await load('/src/floorPlanner/furniture/catalog.ts').catch(() => ({ furnitureCatalog: null }));
  const catalogSrc = read('src/floorPlanner/furniture/catalog.ts');
  const { db } = await load('/src/db/db.ts');
  const records = await load('/src/services/floorPlannerRecords.ts');
  const React = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { HouseTemplatePreview } = await load('/src/components/floorplan/HouseTemplatePreview.tsx');

  const templates: any[] = T.HOUSE_TEMPLATES;
  const SQFT_PER_M2 = 10.7639104;
  const wallLen = (w: any) => Math.hypot(w.b.x - w.a.x, w.b.y - w.a.y);

  console.log('\n1. Catalogue: types and plot sizes');
  await check('1 BHK, 2 BHK, 3 BHK and Duplex are all there', () => {
    for (const type of ['1 BHK', '2 BHK', '3 BHK', 'Duplex']) assert.ok(templates.some(t => t.type === type), type);
  });
  await check('20×30 ft and 30×40 ft plots are both covered (and a 30×50 ft one)', () => {
    const plots = new Set(templates.map(t => `${t.plotWidthFt}x${t.plotDepthFt}`));
    for (const p of ['20x30', '30x40', '30x50']) assert.ok(plots.has(p), p);
    assert.ok(templates.some(t => t.type === '2 BHK' && t.plotWidthFt === 20) && templates.some(t => t.type === '2 BHK' && t.plotWidthFt === 30));
    assert.ok(templates.some(t => t.type === 'Duplex' && t.plotWidthFt === 20) && templates.some(t => t.type === 'Duplex' && t.plotWidthFt === 30));
  });
  await check('Filter chips: All, 1 BHK, 2 BHK, 3 BHK, Duplex', () => assert.deepEqual([...T.HOUSE_TEMPLATE_TYPES], ['All', '1 BHK', '2 BHK', '3 BHK', 'Duplex']));
  await check('Ids are unique', () => assert.equal(new Set(templates.map(t => t.id)).size, templates.length));

  console.log('\n2. Rooms each template needs');
  const roles = (t: any, floor?: number) => t.rooms.filter((r: any) => floor === undefined || r.floorIndex === floor).map((r: any) => r.role);
  const count = (t: any, role: string) => roles(t).filter((r: string) => r === role).length;
  for (const t of templates) {
    await check(`${t.id}: sit-out, hall, kitchen, bedrooms, attached bath, common toilet, pooja`, () => {
      const need = { '1 BHK': 1, '2 BHK': 2, '3 BHK': 3, Duplex: 3 }[t.type as string]!;
      if (t.type === 'Duplex') assert.ok(count(t, 'bedroom') >= need, 'bedrooms');
      else assert.equal(count(t, 'bedroom'), need, 'bedrooms');
      for (const role of ['sitout', 'living', 'kitchen', 'attached-bath', 'common-toilet', 'pooja']) assert.ok(count(t, role) >= 1, role);
      if (t.type !== '1 BHK') assert.ok(count(t, 'dining') >= 1, 'dining');
      if (t.type === '3 BHK') assert.ok(count(t, 'attached-bath') >= 2, 'two attached baths');
    });
  }
  await check('Duplex: ground has sit-out, hall, dining, kitchen, pooja, bedroom, toilet, staircase; first has lounge, 2 bedrooms + attached baths, balcony, staircase', () => {
    for (const t of templates.filter(x => x.type === 'Duplex')) {
      assert.equal(t.floors.length, 2);
      assert.deepEqual(t.floors.map((f: any) => f.label), ['Ground Floor', 'First Floor']);
      const g0 = roles(t, 0);
      for (const role of ['sitout', 'living', 'dining', 'kitchen', 'pooja', 'bedroom', 'common-toilet', 'staircase']) assert.ok(g0.includes(role), `ground ${role}`);
      const f1 = roles(t, 1);
      assert.ok(f1.includes('lounge') && f1.includes('balcony') && f1.includes('staircase'), 'first floor');
      assert.ok(f1.filter((r: string) => r === 'bedroom').length >= 2 && f1.filter((r: string) => r === 'attached-bath').length >= 2, 'first floor beds');
    }
  });
  await check('Balcony and staircase appear in the catalogue', () => {
    assert.ok(templates.some(t => count(t, 'balcony') > 0));
    assert.ok(templates.some(t => count(t, 'staircase') > 0));
  });
  await check('Room summary on the card, e.g. "Sit-out, Hall, Kitchen, 1 Bed, 2 Bath, Pooja"', () => {
    const one = T.houseTemplateById('1bhk-20x30');
    assert.equal(one.roomSummary, 'Sit-out, Hall, Kitchen, 1 Bed, 2 Bath, Pooja');
    assert.equal(T.templateSizeText(one), '20×30 ft • 600 sq ft');
    assert.equal(T.templateSizeText(T.houseTemplateById('2bhk-30x40')), '30×40 ft • 1,200 sq ft');
  });

  console.log('\n3. Geometry and areas');
  for (const t of templates) {
    for (const floor of t.floors) {
      const tag = `${t.id} ${floor.label}`;
      const plan = floor.plan;
      await check(`${tag}: a valid planner plan`, () => {
        const parsed = parsePlan(plan);
        assert.ok(parsed.ok, parsed.ok ? '' : parsed.error);
      });
      await check(`${tag}: rooms fill the plot exactly, without overlaps (${floor.areaSqFt} sq ft)`, () => {
        const rooms = floor.rooms;
        for (const r of rooms) assert.ok(r.wFt > 0 && r.hFt > 0 && r.areaSqFt === Math.round(r.wFt * r.hFt * 100) / 100, r.name);
        for (let i = 0; i < rooms.length; i++) {
          const a = rooms[i];
          assert.ok(a.xFt >= 0 && a.yFt >= 0 && a.xFt + a.wFt <= t.plotWidthFt + 1e-9 && a.yFt + a.hFt <= t.plotDepthFt + 1e-9, `${a.name} inside the plot`);
          for (let j = i + 1; j < rooms.length; j++) {
            const b = rooms[j];
            const overlap = Math.min(a.xFt + a.wFt, b.xFt + b.wFt) - Math.max(a.xFt, b.xFt) > 1e-9 && Math.min(a.yFt + a.hFt, b.yFt + b.hFt) - Math.max(a.yFt, b.yFt) > 1e-9;
            assert.ok(!overlap, `${a.name} overlaps ${b.name}`);
          }
        }
        assert.ok(Math.abs(floor.areaSqFt - t.plotWidthFt * t.plotDepthFt) < 1, `${floor.areaSqFt} vs plot`);
      });
      await check(`${tag}: the planner finds every room, each with its own label and the template's area`, () => {
        const det = detectRooms(plan);
        assert.equal(det.unmatchedLabels.length, 0, `unmatched: ${det.unmatchedLabels.map((l: any) => l.name)}`);
        assert.equal(det.buildings.length, 1, 'one building');
        const faces = det.buildings[0].rooms;
        assert.equal(faces.length, floor.rooms.length, `faces ${faces.length} vs rooms ${floor.rooms.length}`);
        for (const r of floor.rooms) {
          const face = faces.find((f: any) => f.labelIds.includes(`room-${r.id}`));
          assert.ok(face, `${r.name} has no room`);
          assert.equal(face.labelIds.length, 1, `${r.name} shares its room`);
          const axisSqFt = face.axisAreaM2 * SQFT_PER_M2;
          assert.ok(Math.abs(axisSqFt - r.areaSqFt) < 0.6, `${r.name}: planner ${axisSqFt.toFixed(1)} vs ${r.areaSqFt}`);
          assert.ok(face.areaM2 * SQFT_PER_M2 < r.areaSqFt, `${r.name}: carpet area is inside the walls`);
        }
      });
      await check(`${tag}: walls meet cleanly (no zero-length, no overlapping walls, outer walls 9", inner 4.5")`, () => {
        for (const w of plan.walls) {
          assert.ok(wallLen(w) > 0);
          assert.ok(w.a.x === w.b.x || w.a.y === w.b.y, 'straight walls');
          assert.ok([200, 100].includes(w.thickness));
        }
        const onLine = new Map<string, Array<[number, number]>>();
        for (const w of plan.walls) {
          const h = w.a.y === w.b.y;
          const key = h ? `h${w.a.y}` : `v${w.a.x}`;
          const span: [number, number] = h ? [Math.min(w.a.x, w.b.x), Math.max(w.a.x, w.b.x)] : [Math.min(w.a.y, w.b.y), Math.max(w.a.y, w.b.y)];
          for (const [s, e] of onLine.get(key) ?? []) assert.ok(span[1] <= s || span[0] >= e, `walls overlap on ${key}`);
          onLine.set(key, [...(onLine.get(key) ?? []), span]);
        }
        const outer = plan.walls.filter((w: any) => [w.a.x, w.b.x].every((x: number) => x === 0) || [w.a.y, w.b.y].every((y: number) => y === 0)
          || [w.a.x, w.b.x].every((x: number) => x === plan.site.width) || [w.a.y, w.b.y].every((y: number) => y === plan.site.depth));
        assert.ok(outer.length > 0 && outer.every((w: any) => w.thickness === 200));
      });
      await check(`${tag}: doors and windows sit on real walls and fit by the editor's rules`, () => {
        const walls = new Map(plan.walls.map((w: any) => [w.id, w]));
        for (const o of plan.openings) {
          const w = walls.get(o.wallId);
          assert.ok(w, `${o.id} has no wall`);
          const len = wallLen(w);
          assert.ok(o.offset >= T.OPENING_CORNER_MM && o.offset + o.width <= len - T.OPENING_CORNER_MM, `${o.id} too close to a corner`);
          assert.equal(edit.fitOffsetClear(plan, o.wallId, o.width, o.offset, o.id), o.offset, `${o.id} not where the editor would allow it`);
          if (o.type === 'door') assert.ok(o.width >= 600 && o.height >= 2000, `${o.id} door size`);
          if (o.type === 'window') assert.ok(o.width >= 450 && o.sill > 0, `${o.id} window size`);
        }
        for (const [id, list] of Object.entries(Object.groupBy(plan.openings, (o: any) => o.wallId))) {
          const sorted = (list as any[]).sort((a, b) => a.offset - b.offset);
          for (let i = 1; i < sorted.length; i++) assert.ok(sorted[i].offset - (sorted[i - 1].offset + sorted[i - 1].width) >= T.OPENING_PIER_MM, `openings too close on ${id}`);
        }
      });
      await check(`${tag}: windows only on outside walls; bedrooms, hall and kitchen get daylight`, () => {
        const ext = new Set(plan.walls.filter((w: any) => w.thickness === 200).map((w: any) => w.id));
        for (const o of plan.openings.filter((x: any) => x.type === 'window')) assert.ok(ext.has(o.wallId), `${o.id} on an inside wall`);
        const det = detectRooms(plan);
        for (const r of floor.rooms.filter((x: any) => ['bedroom', 'living', 'kitchen'].includes(x.role))) {
          const face = det.buildings[0].rooms.find((f: any) => f.labelIds.includes(`room-${r.id}`));
          const wallIds = new Set(face.edges.map((e: any) => e.wall.id));
          assert.ok(plan.openings.some((o: any) => o.type === 'window' && wallIds.has(o.wallId)), `${r.name} has no window`);
        }
      });
      await check(`${tag}: every room can be reached through doors (from the main door, or the stairs upstairs)`, () => {
        const det = detectRooms(plan);
        const faces = det.buildings[0].rooms;
        const roomOfFace = new Map(faces.map((f: any) => [f, floor.rooms.find((r: any) => f.labelIds.includes(`room-${r.id}`))]));
        const wallRooms = new Map<string, any[]>();
        for (const f of faces) for (const e of f.edges) wallRooms.set(e.wall.id, [...(wallRooms.get(e.wall.id) ?? []), roomOfFace.get(f)]);
        const doors = plan.openings.filter((o: any) => o.type === 'door');
        let start: any;
        if (floor.floorIndex === 0) {
          const main = doors.find((d: any) => (wallRooms.get(d.wallId) ?? []).length === 1);
          assert.ok(main, 'no main door on an outside wall');
          const w = plan.walls.find((x: any) => x.id === main.wallId);
          assert.ok(w.a.y === plan.site.depth && w.b.y === plan.site.depth, 'main door faces the road (front wall)');
          start = wallRooms.get(main.wallId)![0];
        } else {
          start = floor.rooms.find((r: any) => r.role === 'staircase');
        }
        const seen = new Set([start.id]);
        const queue = [start.id];
        while (queue.length) {
          const cur = queue.shift();
          for (const d of doors) {
            const rs = (wallRooms.get(d.wallId) ?? []).map((r: any) => r.id);
            if (rs.length === 2 && rs.includes(cur)) {
              const next = rs[0] === cur ? rs[1] : rs[0];
              if (!seen.has(next)) { seen.add(next); queue.push(next); }
            }
          }
        }
        const missing = floor.rooms.filter((r: any) => !seen.has(r.id)).map((r: any) => r.name);
        assert.deepEqual(missing, [], `cannot reach ${missing}`);
        for (const d of doors) assert.ok((wallRooms.get(d.wallId) ?? []).length >= 1, `${d.id} floats`);
      });
      await check(`${tag}: furniture is from the planner's catalogue and inside its room`, () => {
        for (const f of plan.furniture) {
          assert.ok(furnitureCatalog ? furnitureCatalog.some((c: any) => c.id === f.type) : catalogSrc.includes(`'${f.type}'`), `${f.type} unknown`);
          const inRoom = floor.rooms.some((r: any) => f.x > r.xFt * 304.8 && f.x < (r.xFt + r.wFt) * 304.8 && f.y > r.yFt * 304.8 && f.y < (r.yFt + r.hFt) * 304.8);
          assert.ok(inRoom, `${f.type} outside the rooms`);
        }
      });
    }
  }
  await check('Duplex: the staircase is in the same place on both floors', () => {
    for (const t of templates.filter(x => x.type === 'Duplex')) {
      const [a, b] = t.floors.map((f: any) => f.rooms.find((r: any) => r.role === 'staircase'));
      assert.deepEqual([a.xFt, a.yFt, a.wFt, a.hFt], [b.xFt, b.yFt, b.wFt, b.hFt], t.id);
    }
  });
  await check('Built-up area = sum of all floors (Duplex 30×40 → 2,400 sq ft)', () => {
    assert.equal(T.houseTemplateById('duplex-30x40').builtUpSqFt, 2400);
    assert.equal(T.houseTemplateById('duplex-20x30').builtUpSqFt, 1200);
    assert.equal(T.houseTemplateById('3bhk-30x40').builtUpSqFt, 1200);
  });
  await check('Room size text, e.g. 12′ × 12′ · 144 sq ft and 10′6″ sizes', () => {
    const t = T.houseTemplateById('2bhk-20x30');
    assert.equal(T.roomSizeText(t.rooms.find((r: any) => r.id === 'bed1')), '10′ × 10′6″ · 105 sq ft');
  });

  console.log('\n4. Preview thumbnails');
  for (const t of templates) {
    await check(`${t.id}: preview draws every floor's walls, doors/windows and rooms`, () => {
      const html = renderToStaticMarkup(React.createElement(HouseTemplatePreview, { template: t, height: 160 }));
      assert.ok(html.startsWith('<div') && html.includes('<svg') && html.includes('role="img"'));
      const walls = t.floors.reduce((s: number, f: any) => s + f.plan.walls.length, 0);
      const openings = t.floors.reduce((s: number, f: any) => s + f.plan.openings.length, 0);
      assert.equal((html.match(/data-wall=/g) || []).length, walls, 'walls');
      assert.equal((html.match(/data-opening=/g) || []).length, openings, 'openings');
      assert.equal((html.match(/data-room=/g) || []).length, t.rooms.length, 'rooms');
      if (t.floors.length > 1) assert.ok(html.includes('Ground Floor') && html.includes('First Floor'), 'floor captions');
      assert.ok(html.includes(t.title), 'accessible name');
    });
  }

  console.log('\n5. Opening a template: an independent, editable copy');
  const tpl = T.houseTemplateById('2bhk-30x40');
  const before = JSON.stringify(tpl);
  const copy = T.cloneTemplateFloorPlan(tpl, 0, 'Murugan house');
  await check('The copy is a valid plan named after the user', () => {
    assert.ok(parsePlan(copy).ok);
    assert.equal(copy.name, 'Murugan house');
    assert.equal(copy.rev, 0);
    assert.notEqual(copy.walls, tpl.floors[0].plan.walls);
  });
  await check('Editing the copy (move a wall, resize, rename a room, add / move / delete doors and windows) leaves the template untouched', () => {
    let p = copy;
    const w = p.walls.find((x: any) => x.thickness === 100);
    p = edit.moveWall(p, w.id, w.a.x === w.b.x ? { x: 300, y: 0 } : { x: 0, y: 300 });
    p = edit.setWallLength(p, p.walls[0].id, wallLen(p.walls[0]) + 300);
    p = edit.updateWall(p, p.walls[1].id, { thickness: 230 });
    p.rooms[0].name = 'Big Bedroom';
    const longWall = [...p.walls].sort((a: any, b: any) => wallLen(b) - wallLen(a))[0];
    const added = edit.addOpening(p, longWall.id, edit.OPENING_PRESETS.window, 100);
    assert.ok(added, 'a window can be added');
    p = added.plan;
    p = edit.moveOpening(p, p.openings[0].id, p.openings[0].offset + 100);
    p = edit.deleteOpening(p, p.openings[1].id);
    p.furniture.push({ id: 'f-new', type: 'sofa', x: 1000, y: 1000, rotationDeg: 0 });
    assert.ok(parsePlan(p).ok, 'still a valid plan');
    assert.equal(JSON.stringify(tpl), before, 'template changed');
    assert.equal(tpl.floors[0].plan.rooms[0].name, 'Master Bedroom');
  });
  await check('Every copy is separate from the next one', () => {
    const a = T.cloneTemplateFloorPlan(tpl);
    const b = T.cloneTemplateFloorPlan(tpl);
    a.walls.pop();
    assert.equal(b.walls.length, tpl.floors[0].plan.walls.length);
  });

  const user = { id: 'u-1', username: 'ravi', fullName: 'Ravi', email: 'r@example.test', mobile: '', passwordHash: '', role: 'MISTRY', isActive: true, createdAt: '2026-01-01' };
  await check('From the plan list: a 1-floor template makes one saved plan that opens in the planner', async () => {
    const [rec] = await records.createRecordsFromTemplate(user, T.houseTemplateById('1bhk-20x30'), { name: 'Selvi house' });
    const saved = await db.floorPlans.get(rec.id);
    assert.equal(saved.engine, 'house-planner');
    assert.equal(saved.buildingName, 'Selvi house');
    assert.equal(saved.floorName, 'Ground Floor');
    assert.equal(saved.plotWidth, 20);
    assert.equal(saved.plotLength, 30);
    assert.equal(saved.plannerPlan.walls.length, T.houseTemplateById('1bhk-20x30').floors[0].plan.walls.length);
    const { MistryPlanStorage } = await load('/src/floorPlanner/storage/mistry.ts');
    const loaded = await new MistryPlanStorage(rec.id).load();
    assert.equal(loaded.plan.name, 'Selvi house');
    assert.equal(loaded.plan.rooms.length, 7);
  });
  await check('A Duplex makes "Ground Floor" and "First Floor" plans, saved and editable separately', async () => {
    const site = { id: 'site-1', name: 'Anna Nagar' };
    const recs = await records.createRecordsFromTemplate(user, T.houseTemplateById('duplex-30x40'), { site });
    assert.deepEqual(recs.map((r: any) => r.floorName), ['Ground Floor', 'First Floor']);
    assert.ok(recs.every((r: any) => r.siteId === 'site-1' && r.buildingName === 'Anna Nagar – Duplex Villa (G+1)'));
    const { MistryPlanStorage } = await load('/src/floorPlanner/storage/mistry.ts');
    const storage = new MistryPlanStorage(recs[1].id);
    const loaded = await storage.load();
    assert.ok(loaded.plan.name.endsWith('First Floor'));
    const edited = edit.deleteOpening(loaded.plan, loaded.plan.openings[0].id);
    await storage.save(edited, loaded.rev);
    const again = await db.floorPlans.get(recs[1].id);
    assert.equal(again.plannerPlan.openings.length, loaded.plan.openings.length - 1);
    const ground = await db.floorPlans.get(recs[0].id);
    assert.equal(ground.plannerPlan.openings.length, T.houseTemplateById('duplex-30x40').floors[0].plan.openings.length, 'ground floor untouched');
  });

  console.log('\n6. Screens and name');
  const list = read('src/views/FloorPlanListView.tsx');
  const modal = read('src/floorPlanner/ui/TemplatesModal.tsx');
  await check('Plan list: "Start from a house template" with filter chips, previews and Use template', () => {
    assert.ok(list.includes('HouseTemplatePreview') && list.includes('HOUSE_TEMPLATE_TYPES') && list.includes('createRecordsFromTemplate'));
    assert.ok(list.includes('Start from a house template'));
  });
  await check('In the planner: Templates modal with chips, previews, and a button per floor for a Duplex', () => {
    assert.ok(modal.includes('HouseTemplatePreview') && modal.includes('HOUSE_TEMPLATE_TYPES') && modal.includes('cloneTemplateFloorPlan'));
    assert.ok(modal.includes('t.floors.map'));
    assert.ok(read('src/floorPlanner/ui/HeaderMenu.tsx').includes('<TemplatesModal'));
  });
  await check('Template chips and buttons: ≥44px tall, ≥14px text', () => {
    for (const [file, marker] of [['src/styles/erp-views.css', 'Floor Planner House Templates'], ['src/floorPlanner/styles/ui.css', 'IN-EDITOR HOUSE TEMPLATES MODAL']]) {
      const css = read(file);
      assert.ok(css.includes(marker), `${file} template styles`);
      const tpl = css.slice(css.indexOf(marker));
      for (const m of tpl.matchAll(/font-size:\s*(\d+)px/g)) assert.ok(Number(m[1]) >= 14, `font ${m[1]}px`);
      for (const m of tpl.matchAll(/min-height:\s*(\d+)px/g)) assert.ok(Number(m[1]) >= 44, `min-height ${m[1]}px`);
    }
  });
  await check('Floor Planner tooltip and PDF header use APP_NAME (no "Building Mistry")', () => {
    assert.ok(read('src/floorPlanner/ui/Header.tsx').includes('APP_NAME'));
    assert.ok(read('src/floorPlanner/utils/pdfBlueprint.ts').includes('${APP_NAME.toUpperCase()}'));
    const leftovers = [read('src/floorPlanner/ui/Header.tsx'), read('src/floorPlanner/utils/pdfBlueprint.ts')].some(s => /Building Mistry|BUILDING MISTRY/.test(s));
    assert.ok(!leftovers);
  });
} finally {
  await server.close();
}

if (failures) {
  console.error(`\n${failures} house template check(s) failed (${passed} passed).`);
  process.exit(1);
}
console.log(`\n✅ House templates: all ${passed} checks passed.\n`);
