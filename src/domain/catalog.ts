/**
 * Built-in starter catalog. These rows are copied into the editable `catalogItems` table
 * on first use; after that the user's edits, additions and removals are what the app shows.
 *
 * Brand lists are a starting point for Tamil Nadu / South India, not a claim that every
 * brand or cement type is stocked by every dealer. Users can add or remove entries.
 */
import type { CatalogItem, MaterialCategory } from '../db/types';

export const MATERIAL_UNITS = [
  'Bags', 'Pieces', 'Nos', 'kg', 'Tonne', 'CFT', 'm³', 'Unit (100 CFT)', 'Load', 'Litre', 'sq.ft', 'sq.m', 'Running ft', 'Metre', 'Box', 'Bundle', 'Length',
] as const;

export const MATERIAL_CATEGORY_LABEL: Record<MaterialCategory, string> = {
  cement: 'Cement',
  sand: 'Sand',
  msand: 'M-Sand',
  aggregate: 'Legacy aggregate',
  bricks: 'Bricks',
  rod: 'Steel Rods',
  other: 'Legacy materials',
};

/**
 * Cement TYPE and GRADE are different things:
 *  - Type is the composition (OPC, PPC, PSC).
 *  - Grade (43, 53) is the 28-day compressive strength in MPa and applies to OPC only.
 * Brand is the manufacturer and is chosen separately.
 */
export interface CementTypeOption {
  id: string;
  type: 'OPC' | 'PPC' | 'PSC';
  grade?: '43' | '53';
  label: string;
  standard: string;
  note: string;
}

export const CEMENT_TYPES: CementTypeOption[] = [
  { id: 'opc-43', type: 'OPC', grade: '43', label: 'OPC 43 Grade', standard: 'IS 269', note: 'Ordinary Portland Cement. Common for plastering, brickwork and general RCC.' },
  { id: 'opc-53', type: 'OPC', grade: '53', label: 'OPC 53 Grade', standard: 'IS 269', note: 'Ordinary Portland Cement with higher early strength. Used for structural RCC.' },
  { id: 'ppc', type: 'PPC', label: 'PPC', standard: 'IS 1489 (Part 1)', note: 'Portland Pozzolana Cement (fly-ash based). Common for masonry, plastering and general concrete.' },
  { id: 'psc', type: 'PSC', label: 'PSC', standard: 'IS 455', note: 'Portland Slag Cement. Used where sulphate or chloride resistance is wanted, e.g. foundations.' },
];

/** `type` is a built-in type id ("opc-53") or the type's own name ("OPC 53 Grade", or one the user added). */
export function cementItemName(brand: string, type: string): string {
  const t = CEMENT_TYPES.find(c => c.id === type);
  return `${brand.trim()} ${t ? t.label : type.trim()} Cement`.replace(/\s+/g, ' ').trim();
}

/**
 * The five supported categories are the primary shelves. Older material categories and
 * custom catalog groups remain available together under Legacy materials.
 */
export interface MaterialGroup {
  id: string;
  label: string;
  category: MaterialCategory;
  keywords: string;      // extra words the search should find this shelf by
}

export const MATERIAL_MAIN_GROUPS: MaterialGroup[] = [
  { id: 'cement', label: 'Cement', category: 'cement', keywords: 'opc ppc psc bag' },
  { id: 'sand', label: 'Sand', category: 'sand', keywords: 'river sand plastering' },
  { id: 'msand', label: 'M-Sand', category: 'msand', keywords: 'p-sand manufactured crusher sand' },
  { id: 'bricks', label: 'Bricks', category: 'bricks', keywords: 'red clay fly ash aac blocks' },
  { id: 'rod', label: 'Steel Rods', category: 'rod', keywords: 'tmt rebar kambi iron' },
];

export const MATERIAL_GROUPS: MaterialGroup[] = [
  ...MATERIAL_MAIN_GROUPS,
  { id: 'legacy', label: 'Legacy materials', category: 'other', keywords: 'older existing records' },
];

export const materialGroup = (id: string): MaterialGroup =>
  MATERIAL_GROUPS.find(g => g.id === id) || MATERIAL_GROUPS[MATERIAL_GROUPS.length - 1];

/**
 * Assign new supported categories to their main shelf and keep every historic category
 * or custom group accessible without presenting it as a new primary category.
 */
export function materialGroupId(category: string): string {
  const key = category.trim().toLowerCase();
  if (MATERIAL_MAIN_GROUPS.some(group => group.id === key)) return key;
  return 'legacy';
}

export function materialUnitsForCategory(category: MaterialCategory | string): readonly string[] {
  switch (category.trim().toLowerCase()) {
    case 'cement':
      return ['Bags', 'kg'];
    case 'sand':
    case 'msand':
      return ['CFT', 'm³', 'Tonne', 'Unit (100 CFT)'];
    case 'bricks':
      return ['Pieces'];
    case 'rod':
    case 'steel rods':
      return ['kg', 'Tonne', 'Metre'];
    default:
      return MATERIAL_UNITS;
  }
}

type Seed = Pick<CatalogItem, 'id' | 'kind' | 'name' | 'category'> &
  Partial<Pick<CatalogItem, 'unit' | 'description' | 'group' | 'materialType' | 'grade' | 'standard'>>;

const CEMENT_BRANDS: Seed[] = [
  { id: 'brand-cement-ramco', kind: 'brand', category: 'cement', name: 'Ramco', description: 'The Ramco Cements' },
  { id: 'brand-cement-ultratech', kind: 'brand', category: 'cement', name: 'UltraTech', description: 'UltraTech Cement' },
  { id: 'brand-cement-india-cements', kind: 'brand', category: 'cement', name: 'India Cements', description: 'Sold as Sankar, Coromandel and Raasi' },
  { id: 'brand-cement-tancem', kind: 'brand', category: 'cement', name: 'TANCEM', description: 'Tamil Nadu Cements Corporation (Arasu / Valimai)' },
  { id: 'brand-cement-dalmia', kind: 'brand', category: 'cement', name: 'Dalmia', description: 'Dalmia Bharat Cement' },
  { id: 'brand-cement-chettinad', kind: 'brand', category: 'cement', name: 'Chettinad', description: 'Chettinad Cement' },
  { id: 'brand-cement-acc', kind: 'brand', category: 'cement', name: 'ACC', description: 'ACC Cement' },
];

// Each material shows its category icon (see domain/categoryIcons.ts); there are no bundled photos.
const MATERIALS: Seed[] = [
  { id: 'mat-cement', kind: 'material', category: 'cement', name: 'Cement', unit: 'Bags', description: '50 kg bag. Choose brand and type when buying.' },
  { id: 'mat-river-sand', kind: 'material', category: 'sand', name: 'River Sand', unit: 'Unit (100 CFT)' },
  { id: 'mat-msand', kind: 'material', category: 'msand', name: 'M-Sand (Concrete)', unit: 'Unit (100 CFT)' },
  { id: 'mat-psand', kind: 'material', category: 'msand', name: 'P-Sand (Plastering)', unit: 'Unit (100 CFT)' },
  { id: 'mat-jelly-20', kind: 'material', category: 'aggregate', name: '20 mm Blue Metal (Jelly)', unit: 'Unit (100 CFT)' },
  { id: 'mat-jelly-40', kind: 'material', category: 'aggregate', name: '40 mm Blue Metal (Jelly)', unit: 'Unit (100 CFT)' },
  { id: 'mat-jelly-12', kind: 'material', category: 'aggregate', name: '12 mm Blue Metal (Jelly)', unit: 'Unit (100 CFT)' },
  { id: 'mat-brick-red', kind: 'material', category: 'bricks', name: 'Red Clay Bricks', unit: 'Nos' },
  { id: 'mat-brick-flyash', kind: 'material', category: 'bricks', name: 'Fly Ash Bricks', unit: 'Nos' },
  { id: 'mat-block-aac', kind: 'material', category: 'bricks', name: 'AAC Blocks', unit: 'Nos' },
  { id: 'mat-block-solid', kind: 'material', category: 'bricks', name: 'Solid Concrete Blocks', unit: 'Nos' },
  { id: 'mat-block-hollow', kind: 'material', category: 'bricks', name: 'Hollow Concrete Blocks', unit: 'Nos' },
  { id: 'mat-binding-wire', kind: 'material', category: 'other', group: 'hardware', name: 'Binding Wire', unit: 'kg' },
  { id: 'mat-cover-blocks', kind: 'material', category: 'other', group: 'hardware', name: 'Cover Blocks', unit: 'Nos' },
  { id: 'mat-nails', kind: 'material', category: 'other', group: 'hardware', name: 'Nails', unit: 'kg' },
  { id: 'mat-shuttering-ply', kind: 'material', category: 'other', group: 'wood', name: 'Shuttering Plywood', unit: 'Nos' },
  { id: 'mat-waterproofing', kind: 'material', category: 'other', group: 'paint', name: 'Waterproofing Compound', unit: 'Litre' },
  { id: 'mat-floor-tiles', kind: 'material', category: 'other', group: 'tiles', name: 'Floor Tiles', unit: 'Box' },
  { id: 'mat-wall-tiles', kind: 'material', category: 'other', group: 'tiles', name: 'Wall Tiles', unit: 'Box' },
  { id: 'mat-granite', kind: 'material', category: 'other', group: 'tiles', name: 'Granite Slab', unit: 'sq.ft' },
  { id: 'mat-tile-adhesive', kind: 'material', category: 'other', group: 'tiles', name: 'Tile Adhesive', unit: 'Bags' },
  { id: 'mat-wall-putty', kind: 'material', category: 'other', group: 'paint', name: 'Wall Putty', unit: 'Bags' },
  { id: 'mat-primer', kind: 'material', category: 'other', group: 'paint', name: 'Primer', unit: 'Litre' },
  { id: 'mat-paint', kind: 'material', category: 'other', group: 'paint', name: 'Paint', unit: 'Litre' },
  { id: 'mat-pvc-pipe', kind: 'material', category: 'other', group: 'plumbing', name: 'PVC Pipe', unit: 'Length' },
  { id: 'mat-cpvc-pipe', kind: 'material', category: 'other', group: 'plumbing', name: 'CPVC Pipe', unit: 'Length' },
  { id: 'mat-conduit', kind: 'material', category: 'other', group: 'electrical', name: 'Electrical Conduit Pipe', unit: 'Length' },
  { id: 'mat-wire', kind: 'material', category: 'other', group: 'electrical', name: 'Electrical Wire', unit: 'Bundle' },
];

// Cement types start as the four documented ones and can be added to or removed like brands.
const CEMENT_TYPE_SEEDS: Seed[] = CEMENT_TYPES.map(c => ({
  id: `ctype-${c.id}`, kind: 'cement_type', category: 'cement', name: c.label, description: c.note,
  materialType: c.type, grade: c.grade, standard: c.standard,
}));

export const TOOL_CATEGORIES = ['Hand tools', 'Measuring tools', 'Material handling', 'Power tools', 'Site equipment'] as const;

const TOOLS: Seed[] = [
  { id: 'tool-claw-hammer', kind: 'tool', category: 'Hand tools', name: 'Claw Hammer' },
  { id: 'tool-sledge-hammer', kind: 'tool', category: 'Hand tools', name: 'Sledge Hammer' },
  { id: 'tool-pliers', kind: 'tool', category: 'Hand tools', name: 'Combination Pliers' },
  { id: 'tool-spanner', kind: 'tool', category: 'Hand tools', name: 'Spanner Set' },
  { id: 'tool-screwdriver', kind: 'tool', category: 'Hand tools', name: 'Screwdriver' },
  { id: 'tool-brick-trowel', kind: 'tool', category: 'Hand tools', name: 'Brick Trowel' },
  { id: 'tool-plaster-trowel', kind: 'tool', category: 'Hand tools', name: 'Plastering Trowel' },
  { id: 'tool-crowbar', kind: 'tool', category: 'Hand tools', name: 'Crowbar' },
  { id: 'tool-shovel', kind: 'tool', category: 'Hand tools', name: 'Shovel' },
  { id: 'tool-pickaxe', kind: 'tool', category: 'Hand tools', name: 'Pickaxe' },
  { id: 'tool-chisel', kind: 'tool', category: 'Hand tools', name: 'Chisel' },
  { id: 'tool-hand-saw', kind: 'tool', category: 'Hand tools', name: 'Hand Saw' },
  { id: 'tool-hacksaw', kind: 'tool', category: 'Hand tools', name: 'Hacksaw' },
  { id: 'tool-measuring-tape', kind: 'tool', category: 'Measuring tools', name: 'Measuring Tape' },
  { id: 'tool-spirit-level', kind: 'tool', category: 'Measuring tools', name: 'Spirit Level' },
  { id: 'tool-laser-measure', kind: 'tool', category: 'Measuring tools', name: 'Laser Distance Measure' },
  { id: 'tool-plumb-bob', kind: 'tool', category: 'Measuring tools', name: 'Plumb Bob' },
  { id: 'tool-try-square', kind: 'tool', category: 'Measuring tools', name: 'Try Square' },
  { id: 'tool-wheelbarrow', kind: 'tool', category: 'Material handling', name: 'Wheelbarrow' },
  { id: 'tool-ladder', kind: 'tool', category: 'Material handling', name: 'Ladder' },
  { id: 'tool-chain-block', kind: 'tool', category: 'Material handling', name: 'Chain Pulley Block' },
  { id: 'tool-bucket', kind: 'tool', category: 'Material handling', name: 'Bucket' },
  { id: 'tool-drill', kind: 'tool', category: 'Power tools', name: 'Drill Machine' },
  { id: 'tool-angle-grinder', kind: 'tool', category: 'Power tools', name: 'Angle Grinder' },
  { id: 'tool-tile-cutter', kind: 'tool', category: 'Power tools', name: 'Tile Cutter' },
  { id: 'tool-vibrator', kind: 'tool', category: 'Power tools', name: 'Concrete Vibrator' },
  { id: 'tool-scaffolding', kind: 'tool', category: 'Site equipment', name: 'Scaffolding Pipes & Couplers' },
  { id: 'tool-steel-props', kind: 'tool', category: 'Site equipment', name: 'Steel Props' },
  { id: 'tool-concrete-mixer', kind: 'tool', category: 'Site equipment', name: 'Concrete Mixer' },
  { id: 'tool-safety-helmet', kind: 'tool', category: 'Site equipment', name: 'Safety Helmet' },
];

const SEED_STAMP = '2026-01-01T00:00:00.000Z';

export function builtInCatalog(): CatalogItem[] {
  return [...CEMENT_BRANDS, ...CEMENT_TYPE_SEEDS, ...MATERIALS, ...TOOLS].map(seed => {
    return {
      ...seed,
      isBuiltIn: true,
      isDeleted: false,
      createdAt: SEED_STAMP,
      updatedAt: SEED_STAMP,
    };
  });
}
