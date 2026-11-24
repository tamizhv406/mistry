/**
 * One look for every material and tool: a coloured square with a crisp vector icon.
 *
 * The app used to ship small stock photographs (`public/tool-images/`, `public/material-images/`)
 * that looked blurry on phones. They are gone. Each item now shows the icon of its category, in
 * that category's colour. A photo is shown only when the person added their own one
 * (a `data:image/...` URL from the camera or gallery).
 *
 * Records saved by older versions may still hold a bundled path such as
 * `tool-images/drill.jpg`. Those files no longer exist, so such a path counts as "no photo" and
 * the icon is shown instead, without the browser ever requesting the missing file.
 *
 * This file has no React in it, so it can be tested in Node. `components/ui/CategoryIcon.tsx`
 * maps the icon names to lucide-react components.
 */

export const ICON_CATEGORIES = ['cement', 'sand', 'steel', 'bricks', 'tools', 'electrical', 'plumbing', 'paint', 'other'] as const;
export type IconCategory = typeof ICON_CATEGORIES[number];

/** lucide-react icon names used by the badges. Every name here must exist in lucide-react. */
export const ICON_NAMES = [
  'Package', 'Mountain', 'Anvil', 'BrickWall', 'Wrench', 'Zap', 'Droplets', 'PaintRoller', 'Boxes',
  // finer icons inside a category (same colour as the category)
  'Grid2x2', 'TreePine', 'Hammer', 'Shovel', 'Pickaxe', 'Ruler', 'Drill', 'Disc3', 'HardHat', 'Construction', 'Cylinder', 'Link', 'Scissors',
] as const;
export type IconName = typeof ICON_NAMES[number];

export interface CategoryStyle {
  label: string;
  labelTa: string;
  icon: IconName;
  /** Icon colour. At least 4.5:1 against `bg`. */
  fg: string;
  bg: string;
}

export const CATEGORY_STYLE: Record<IconCategory, CategoryStyle> = {
  cement:     { label: 'Cement',             labelTa: 'சிமெண்ட்',      icon: 'Package',     fg: '#334155', bg: '#e2e8f0' },
  sand:       { label: 'Sand / Aggregate',   labelTa: 'மணல் / ஜல்லி',   icon: 'Mountain',    fg: '#854d0e', bg: '#fef3c7' },
  steel:      { label: 'Steel / Rods',       labelTa: 'கம்பி',          icon: 'Anvil',       fg: '#3730a3', bg: '#e0e7ff' },
  bricks:     { label: 'Bricks / Blocks',    labelTa: 'செங்கல்',        icon: 'BrickWall',   fg: '#9a3412', bg: '#ffedd5' },
  tools:      { label: 'Tools / Machinery',  labelTa: 'கருவிகள்',       icon: 'Wrench',      fg: '#0f766e', bg: '#ccfbf1' },
  electrical: { label: 'Electrical',         labelTa: 'மின்சாரம்',      icon: 'Zap',         fg: '#6d28d9', bg: '#ede9fe' },
  plumbing:   { label: 'Plumbing',           labelTa: 'பிளம்பிங்',       icon: 'Droplets',    fg: '#075985', bg: '#e0f2fe' },
  paint:      { label: 'Paint / Finishing',  labelTa: 'பெயிண்ட்',        icon: 'PaintRoller', fg: '#9d174d', bg: '#fce7f3' },
  other:      { label: 'Wood / Hardware / Other', labelTa: 'மற்றவை',     icon: 'Boxes',       fg: '#3f6212', bg: '#ecfccb' },
};

const norm = (s?: string) => (s || '').trim().toLowerCase();

/** Words in a name or group that place a material in a category, checked in this order. */
const MATERIAL_WORDS: [IconCategory, RegExp][] = [
  ['cement', /\bcement\b|\bopc\b|\bppc\b|\bpsc\b/],
  ['steel', /\bsteel\b|\btmt\b|\brod|\brebar|\bkambi\b|\bbinding wire\b/],
  ['bricks', /\bbrick|\bblock|\baac\b|\bsengal\b/],
  ['sand', /\bsand\b|m-sand|p-sand|\bmsand\b|\bjelly\b|\bmetal\b|\baggregate|\bgravel|\bstone\b/],
  ['plumbing', /\bplumb|\bpipe\b|\bpvc\b|\bcpvc\b|\btap\b|\bvalve|\bsanitary|\btank\b/],
  ['electrical', /\belectric|\bwire\b|\bcable|\bconduit|\bswitch|\bmcb\b|\blight\b/],
  ['paint', /\bpaint|\bprimer|\bputty|\bwaterproof|\btile|\bgranite|\bmarble|\bfinish|\bdistemper|\benamel/],
];

/**
 * The category a material shows. Its stock category decides first (cement, sand, rod, bricks),
 * then its catalog group (electrical, plumbing, paint, tiles, wood, hardware), then words in its name.
 */
export function materialIconCategory(item: { category?: string; group?: string; name?: string }): IconCategory {
  const c = norm(item.category);
  if (c === 'cement') return 'cement';
  if (c === 'sand' || c === 'msand' || c === 'aggregate') return 'sand';
  if (c === 'rod' || c === 'steel' || c === 'steel rods') return 'steel';
  if (c === 'bricks' || c === 'blocks') return 'bricks';
  const g = norm(item.group);
  if (g === 'electrical') return 'electrical';
  if (g === 'plumbing') return 'plumbing';
  if (g === 'paint' || g === 'tiles' || g === 'finishing') return 'paint';
  if (g === 'wood' || g === 'hardware') return 'other';
  const text = `${norm(item.name)} ${c}`;
  for (const [cat, re] of MATERIAL_WORDS) if (re.test(text)) return cat;
  return 'other';
}

/** A finer icon for some materials, kept in their category's colour. */
function materialIconName(cat: IconCategory, item: { group?: string; name?: string }): IconName {
  const text = `${norm(item.group)} ${norm(item.name)}`;
  if (cat === 'paint' && /\btile|\bgranite|\bmarble/.test(text)) return 'Grid2x2';
  if (cat === 'other' && /\bwood|\bply|\btimber|\bshutter/.test(text)) return 'TreePine';
  return CATEGORY_STYLE[cat].icon;
}

const TOOL_WORDS: [IconName, RegExp][] = [
  ['Hammer', /hammer/],
  ['Pickaxe', /pickaxe|pick axe|crowbar|kadapaarai/],
  ['Shovel', /shovel|spade|mammoty|trowel/],
  ['Ruler', /tape|level|laser|measure|square|plumb|ruler/],
  ['Drill', /drill/],
  ['Disc3', /grinder|cutting machine/],
  ['Scissors', /cutter|saw|hacksaw|chisel/],
  ['HardHat', /helmet|safety|gloves|boots|harness/],
  ['Construction', /scaffold|prop|shuttering|centering/],
  ['Cylinder', /mixer|vibrator|bucket|drum|wheelbarrow/],
  ['Link', /chain|pulley|rope|hoist/],
];

/** The icon for a tool: a picture of that kind of tool where one fits, else a wrench. */
export function toolIconName(name?: string): IconName {
  const n = norm(name);
  for (const [icon, re] of TOOL_WORDS) if (re.test(n)) return icon;
  return CATEGORY_STYLE.tools.icon;
}

export interface ItemIcon {
  category: IconCategory;
  icon: IconName;
  fg: string;
  bg: string;
  label: string;
}

export function materialItemIcon(item: { category?: string; group?: string; name?: string }): ItemIcon {
  const category = materialIconCategory(item);
  const s = CATEGORY_STYLE[category];
  return { category, icon: materialIconName(category, item), fg: s.fg, bg: s.bg, label: s.label };
}

export function toolIcon(name?: string): ItemIcon {
  const s = CATEGORY_STYLE.tools;
  return { category: 'tools', icon: toolIconName(name), fg: s.fg, bg: s.bg, label: s.label };
}

/** A path to one of the stock photos older versions bundled (the files have been removed). */
export function isLegacyStockPhoto(url?: string | null): boolean {
  if (!url) return false;
  return /(^|\/)(tool-images|material-images)\//i.test(url.trim());
}

/**
 * The person's own photo, if the record has one; otherwise undefined and the icon is shown.
 * Only pictures the person added count: camera / gallery data URLs and blob URLs. Old bundled
 * stock paths, empty strings and anything else are treated as "no photo", so no `<img>` is ever
 * pointed at a file that does not exist.
 */
export function customPhoto(url?: string | null): string | undefined {
  const u = (url || '').trim();
  if (!u || isLegacyStockPhoto(u)) return undefined;
  if (/^data:image\/(png|jpe?g|webp|gif|avif|heic|heif);/i.test(u)) return u;
  if (u.startsWith('blob:')) return u;
  return undefined;
}
