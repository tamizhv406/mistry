/**
 * Category icons (Task 4): every material and tool category has a crisp vector icon and a colour;
 * old bundled stock-photo paths saved by earlier versions fall back to the icon without any
 * request for a missing file; the person's own photos are kept and shown first.
 */
import 'fake-indexeddb/auto';
import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as Lucide from 'lucide-react';
import type { CatalogItem, Site, User } from '../src/db/types';

let passed = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (!cond) throw new Error(`FAILED: ${name}${detail !== undefined ? ' — got ' + JSON.stringify(detail) : ''}`);
  passed += 1;
  console.log(`  ✓ ${name}`);
}

/** WCAG contrast ratio of two #rrggbb colours. */
function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const stamp = '2026-10-01T04:00:00.000Z';
const owner: User = { id: 'u-owner', username: 'owner', fullName: 'Owner', mobile: '', email: 'o@x.in', passwordHash: 'x', role: 'MISTRY', isActive: true, createdAt: stamp };
const PHOTO = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==';

async function run() {
  const icons = await import('../src/domain/categoryIcons');
  const { MaterialIcon, ToolIcon } = await import('../src/components/ui/CategoryIcon');
  const { ICON_COMPONENTS } = await import('../src/components/ui/categoryIconMap');
  const { SafeImage } = await import('../src/components/ui/SafeImage');
  const { builtInCatalog } = await import('../src/domain/catalog');

  console.log('\n--- 1. Every category has an icon and a colour ---');
  check('The nine categories are defined', icons.ICON_CATEGORIES.length === 9 &&
    ['cement', 'sand', 'steel', 'bricks', 'tools', 'electrical', 'plumbing', 'paint', 'other'].every(c => (icons.ICON_CATEGORIES as readonly string[]).includes(c)));
  for (const cat of icons.ICON_CATEGORIES) {
    const s = icons.CATEGORY_STYLE[cat];
    if (!s || !s.label || !s.labelTa || !/^#[0-9a-f]{6}$/i.test(s.fg) || !/^#[0-9a-f]{6}$/i.test(s.bg)) throw new Error(`Bad style for ${cat}`);
    if (contrast(s.fg, s.bg) < 4.5) throw new Error(`${cat}: icon colour only ${contrast(s.fg, s.bg).toFixed(2)}:1 on its background`);
  }
  check('Each has a label (English and Tamil) and an icon colour at least 4.5:1 on its background', true);
  check('No two categories share an icon', new Set(icons.ICON_CATEGORIES.map(c => icons.CATEGORY_STYLE[c].icon)).size === 9);
  check('No two categories share a colour', new Set(icons.ICON_CATEGORIES.map(c => icons.CATEGORY_STYLE[c].bg)).size === 9 &&
    new Set(icons.ICON_CATEGORIES.map(c => icons.CATEGORY_STYLE[c].fg)).size === 9);
  const lucide = Lucide as unknown as Record<string, unknown>;
  const missing = icons.ICON_NAMES.filter(n => !lucide[n]);
  check('Every icon name exists in lucide-react', missing.length === 0, missing);
  check('Every icon name is wired to a component', icons.ICON_NAMES.every(n => ICON_COMPONENTS[n] === lucide[n]));

  console.log('\n--- 2. Materials and tools resolve to the right category ---');
  const m = (category: string, name: string, group?: string) => icons.materialIconCategory({ category, name, group });
  check('Cement', m('cement', 'Ramco PPC Cement') === 'cement');
  check('Sand, M-Sand and aggregate (jelly)', m('sand', 'River Sand') === 'sand' && m('msand', 'P-Sand') === 'sand' && m('aggregate', '20 mm Blue Metal (Jelly)') === 'sand');
  check('Steel rods', m('rod', 'TMT 12 mm') === 'steel' && m('other', 'TMT Rod 8mm') === 'steel');
  check('Bricks and blocks', m('bricks', 'Red Clay Bricks') === 'bricks' && m('bricks', 'AAC Blocks') === 'bricks');
  check('Electrical, by shelf or by name', m('other', 'Electrical Wire', 'electrical') === 'electrical' && m('other', 'Copper wire 2.5 sq mm') === 'electrical');
  check('Plumbing, by shelf or by name', m('other', 'PVC Pipe', 'plumbing') === 'plumbing' && m('other', 'CPVC pipe 1 inch') === 'plumbing');
  check('Paint / finishing (paint, putty, tiles)', m('other', 'Wall Putty', 'paint') === 'paint' && m('other', 'Floor Tiles', 'tiles') === 'paint' && m('other', 'Asian Paints Primer') === 'paint');
  check('Wood, hardware and anything else fall back to Other', m('other', 'Shuttering Plywood', 'wood') === 'other' && m('other', 'Nails', 'hardware') === 'other' && m('other', 'Gunny bags') === 'other' && m('', '') === 'other');
  check('Binding wire on the hardware shelf is hardware, not electrical', m('other', 'Binding Wire', 'hardware') === 'other');
  check('Tiles and wood get their own picture in their category colour',
    icons.materialItemIcon({ category: 'other', group: 'tiles', name: 'Floor Tiles' }).icon === 'Grid2x2' &&
    icons.materialItemIcon({ category: 'other', group: 'wood', name: 'Shuttering Plywood' }).icon === 'TreePine' &&
    icons.materialItemIcon({ category: 'other', group: 'wood', name: 'Shuttering Plywood' }).bg === icons.CATEGORY_STYLE.other.bg);
  const catalog = builtInCatalog();
  const materials = catalog.filter(c => c.kind === 'material');
  const reached = new Set(materials.map(c => icons.materialIconCategory(c)));
  // Steel is recorded as rods (by diameter), not as a catalog material, so it is checked on its own.
  check('The built-in materials cover every material category; rods are steel',
    ['cement', 'sand', 'bricks', 'electrical', 'plumbing', 'paint', 'other'].every(c => reached.has(c as never)) &&
    icons.materialIconCategory({ category: 'rod' }) === 'steel', [...reached]);
  const tools = catalog.filter(c => c.kind === 'tool');
  check('Every built-in tool shows in the tools colour', tools.length >= 25 && tools.every(t => icons.toolIcon(t.name).bg === icons.CATEGORY_STYLE.tools.bg));
  check('Tools get a picture of their kind where one fits', icons.toolIconName('Claw Hammer') === 'Hammer' && icons.toolIconName('Measuring Tape') === 'Ruler' &&
    icons.toolIconName('Drill Machine') === 'Drill' && icons.toolIconName('Safety Helmet') === 'HardHat' && icons.toolIconName('Shovel') === 'Shovel');
  check('An unknown tool gets the wrench', icons.toolIconName('Plate Compactor') === 'Wrench' && icons.toolIconName('') === 'Wrench');

  console.log('\n--- 3. Old stock-photo paths fall back to the icon ---');
  const legacy = ['tool-images/drill.jpg', '/tool-images/claw-hammer.jpg', './material-images/cement.jpg', '/material-images/river-sand.jpg', 'https://example.app/tool-images/shovel.jpg', ' material-images/bricks.jpg '];
  check('Every form of an old bundled path is recognised', legacy.every(icons.isLegacyStockPhoto), legacy.filter(u => !icons.isLegacyStockPhoto(u)));
  check('…and is treated as "no photo"', legacy.every(u => icons.customPhoto(u) === undefined));
  check('Empty, missing and unrelated paths are "no photo" too', [undefined, null, '', '  ', 'icons/icon-192.png', 'javascript:alert(1)', 'data:text/html,<b>x</b>'].every(u => icons.customPhoto(u) === undefined));
  check('A user photo is not mistaken for an old path', !icons.isLegacyStockPhoto(PHOTO));
  const row = renderToStaticMarkup(React.createElement(ToolIcon, { name: 'Drill Machine', photo: 'tool-images/drill.jpg' }));
  check('A tool row with an old path renders the icon, no <img>', !row.includes('<img') && row.includes('<svg') && row.includes('data-category="tools"'), row);
  const mat = renderToStaticMarkup(React.createElement(MaterialIcon, { category: 'cement', name: 'Cement', photo: '/material-images/cement.jpg' }));
  check('A material with an old path renders the cement icon, no <img>', !mat.includes('<img') && mat.includes('data-category="cement"'), mat);
  const safe = renderToStaticMarkup(React.createElement(SafeImage, { src: 'tool-images/drill.jpg', fallbackCategory: 'drill' }));
  check('SafeImage never points an <img> at a removed stock photo', !safe.includes('tool-images') && /src="data:image\/svg\+xml/.test(safe), safe.slice(0, 160));

  console.log('\n--- 4. The person\'s own photo comes first ---');
  check('A camera / gallery photo is kept exactly', icons.customPhoto(PHOTO) === PHOTO && icons.customPhoto('data:image/png;base64,iVBORw0KGgo=') === 'data:image/png;base64,iVBORw0KGgo=');
  const own = renderToStaticMarkup(React.createElement(ToolIcon, { name: 'Plate Compactor', photo: PHOTO }));
  check('…and shown instead of the icon', own.includes('<img') && own.includes(`src="${PHOTO}"`) && !own.includes('<svg'), own.slice(0, 120));
  const big = renderToStaticMarkup(React.createElement(ToolIcon, { name: 'Plate Compactor', photo: PHOTO, size: 'lg' }));
  check('Badge sizes are fixed squares (row 30 px, sheet 64 px)', /width:30px;height:30px/.test(own) && /width:64px;height:64px/.test(big));

  console.log('\n--- 5. Saved data from older versions ---');
  const { db } = await import('../src/db/db');
  const svc = await import('../src/services/records');
  await db.open();
  // What an older version left in the database: built-in entries pointing at bundled photos,
  // one of them renamed by the user.
  const old: CatalogItem[] = catalog.map(c => ({
    ...c,
    imageUrl: c.kind === 'tool' ? `tool-images/${c.id.replace('tool-', '')}.jpg` : c.kind === 'material' ? 'material-images/cement.jpg' : undefined,
    imageCredit: c.kind === 'tool' || c.kind === 'material' ? 'Someone — CC BY-SA 4.0' : undefined,
  }));
  const renamed = old.find(c => c.id === 'tool-drill')!;
  renamed.name = 'Bosch Drill (ours)';
  await db.catalogItems.bulkPut(old);
  await svc.ensureCatalogSeeded();
  const after = await db.catalogItems.toArray();
  check('Starting the app clears the dead photo paths from the catalog', after.every(c => !icons.isLegacyStockPhoto(c.imageUrl) && !c.imageCredit), after.find(c => c.imageUrl)?.imageUrl);
  check('…and keeps everything else the user set', (await db.catalogItems.get('tool-drill'))?.name === 'Bosch Drill (ours)' && after.length === old.length);

  const site: Site = {
    id: 'ic1', userId: owner.id, name: 'Icon Site', ownerName: 'A', ownerPhone: '', address: '', area: '', buildingType: 'House',
    startDate: '2026-09-01', expectedCompletionDate: '2027-03-01', status: 'Active', isDeleted: false, createdAt: stamp, updatedAt: stamp,
  };
  await db.sites.put(site);
  // A tool added from the catalog by an older version copied the photo path into the tool.
  await db.toolAssets.put({
    id: 'ta-old', userId: owner.id, siteId: 'ic1', catalogItemId: 'tool-shovel', name: 'Shovel', category: 'Hand tools',
    imageUrl: 'tool-images/shovel.jpg', imageCredit: 'Shixart1985 — CC BY 2.0', totalQuantity: 3, condition: 'Good', isDeleted: false, createdAt: stamp, updatedAt: stamp,
  });
  const oldTool = await db.toolAssets.get('ta-old');
  check('An old tool record still opens, and shows the icon (no photo)', !!oldTool && icons.customPhoto(oldTool.imageUrl) === undefined);
  const edited = await svc.saveToolAsset(owner, 'ic1', { id: 'ta-old', name: 'Shovel', category: 'Hand tools', totalQuantity: 4, condition: 'Good' });
  const editedRow = await db.toolAssets.get('ta-old');
  check('Editing it drops the dead path and its credit, keeps the rest', edited.ok && !editedRow?.imageUrl && !editedRow?.imageCredit && editedRow?.totalQuantity === 4 && editedRow.catalogItemId === 'tool-shovel', editedRow);
  const stale = await svc.saveToolAsset(owner, 'ic1', { name: 'Ladder', category: 'Material handling', totalQuantity: 1, condition: 'Good', imageUrl: '/tool-images/ladder.jpg', imageCredit: 'x' });
  check('A dead path is never saved on a new tool', stale.ok && !(await db.toolAssets.get(stale.value.id))?.imageUrl);
  const mine = await svc.saveToolAsset(owner, 'ic1', { name: 'Plate Compactor', category: 'Site equipment', totalQuantity: 1, condition: 'Good', imageUrl: PHOTO });
  check('A custom tool keeps its own photo', mine.ok && (await db.toolAssets.get(mine.value.id))?.imageUrl === PHOTO);
  db.close();
  await db.open();
  const reopened = await db.toolAssets.get(mine.ok ? mine.value.id : '');
  check('…after the database is closed and opened again, and it is what the row shows', reopened?.imageUrl === PHOTO && icons.customPhoto(reopened.imageUrl) === PHOTO);

  console.log('\n--- 6. The stock photos are gone from the app ---');
  const root = process.cwd();
  check('public/tool-images and public/material-images are removed', !fs.existsSync(path.join(root, 'public/tool-images')) && !fs.existsSync(path.join(root, 'public/material-images')));
  const stale_refs: string[] = [];
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(tsx?|css|html|json)$/.test(e.name) && !p.endsWith('categoryIcons.ts') && /(tool|material)-images\//.test(fs.readFileSync(p, 'utf8'))) stale_refs.push(path.relative(root, p));
    }
  };
  walk(path.join(root, 'src'));
  check('No source file refers to the removed photo folders', stale_refs.length === 0, stale_refs);

  console.log(`\n✅ Category icons: all ${passed} checks passed.\n`);
}

run().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
