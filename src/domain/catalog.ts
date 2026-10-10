/**
 * Built-in starter catalog. These rows are copied into the editable `catalogItems` table
 * on first use; after that the user's edits, additions and removals are what the app shows.
 *
 * Brand lists are a starting point for Tamil Nadu / South India, not a claim that every
 * brand or cement type is stocked by every dealer. Users can add or remove entries.
 */
import type { CatalogItem, MaterialCategory } from '../db/types';
import { TOOL_IMAGES } from './toolImages';

export const MATERIAL_UNITS = [
  'Bags', 'Nos', 'kg', 'Tonne', 'CFT', 'Unit (100 CFT)', 'Load', 'Litre', 'sq.ft', 'sq.m', 'Running ft', 'Metre', 'Box', 'Bundle', 'Length',
] as const;

export const MATERIAL_CATEGORY_LABEL: Record<MaterialCategory, string> = {
  cement: 'Cement',
  sand: 'River Sand',
  msand: 'M-Sand / P-Sand',
  aggregate: 'Aggregate (Jelly)',
  bricks: 'Bricks & Blocks',
  rod: 'Steel Rods',
  other: 'Other Materials',
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

export function cementItemName(brand: string, typeId: string): string {
  const t = CEMENT_TYPES.find(c => c.id === typeId);
  return `${brand.trim()} ${t ? t.label : ''} Cement`.replace(/\s+/g, ' ').trim();
}

type Seed = Pick<CatalogItem, 'id' | 'kind' | 'name' | 'category'> & Partial<Pick<CatalogItem, 'unit' | 'description'>> & { image?: string };

const CEMENT_BRANDS: Seed[] = [
  { id: 'brand-cement-ramco', kind: 'brand', category: 'cement', name: 'Ramco', description: 'The Ramco Cements' },
  { id: 'brand-cement-ultratech', kind: 'brand', category: 'cement', name: 'UltraTech', description: 'UltraTech Cement' },
  { id: 'brand-cement-india-cements', kind: 'brand', category: 'cement', name: 'India Cements', description: 'Sold as Sankar, Coromandel and Raasi' },
  { id: 'brand-cement-tancem', kind: 'brand', category: 'cement', name: 'TANCEM', description: 'Tamil Nadu Cements Corporation (Arasu / Valimai)' },
  { id: 'brand-cement-dalmia', kind: 'brand', category: 'cement', name: 'Dalmia', description: 'Dalmia Bharat Cement' },
  { id: 'brand-cement-chettinad', kind: 'brand', category: 'cement', name: 'Chettinad', description: 'Chettinad Cement' },
  { id: 'brand-cement-acc', kind: 'brand', category: 'cement', name: 'ACC', description: 'ACC Cement' },
];

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
  { id: 'mat-binding-wire', kind: 'material', category: 'other', name: 'Binding Wire', unit: 'kg' },
  { id: 'mat-cover-blocks', kind: 'material', category: 'other', name: 'Cover Blocks', unit: 'Nos' },
  { id: 'mat-nails', kind: 'material', category: 'other', name: 'Nails', unit: 'kg' },
  { id: 'mat-shuttering-ply', kind: 'material', category: 'other', name: 'Shuttering Plywood', unit: 'Nos' },
  { id: 'mat-waterproofing', kind: 'material', category: 'other', name: 'Waterproofing Compound', unit: 'Litre' },
  { id: 'mat-floor-tiles', kind: 'material', category: 'other', name: 'Floor Tiles', unit: 'Box' },
  { id: 'mat-wall-putty', kind: 'material', category: 'other', name: 'Wall Putty', unit: 'Bags' },
  { id: 'mat-primer', kind: 'material', category: 'other', name: 'Primer', unit: 'Litre' },
  { id: 'mat-paint', kind: 'material', category: 'other', name: 'Paint', unit: 'Litre' },
  { id: 'mat-pvc-pipe', kind: 'material', category: 'other', name: 'PVC Pipe', unit: 'Length' },
  { id: 'mat-conduit', kind: 'material', category: 'other', name: 'Electrical Conduit Pipe', unit: 'Length' },
];

export const TOOL_CATEGORIES = ['Hand tools', 'Measuring tools', 'Material handling', 'Power tools', 'Site equipment'] as const;

const TOOLS: Seed[] = [
  { id: 'tool-claw-hammer', kind: 'tool', category: 'Hand tools', name: 'Claw Hammer', image: 'claw-hammer' },
  { id: 'tool-sledge-hammer', kind: 'tool', category: 'Hand tools', name: 'Sledge Hammer', image: 'sledge-hammer' },
  { id: 'tool-pliers', kind: 'tool', category: 'Hand tools', name: 'Combination Pliers', image: 'pliers' },
  { id: 'tool-spanner', kind: 'tool', category: 'Hand tools', name: 'Spanner Set', image: 'spanner' },
  { id: 'tool-screwdriver', kind: 'tool', category: 'Hand tools', name: 'Screwdriver', image: 'screwdriver' },
  { id: 'tool-brick-trowel', kind: 'tool', category: 'Hand tools', name: 'Brick Trowel', image: 'brick-trowel' },
  { id: 'tool-plaster-trowel', kind: 'tool', category: 'Hand tools', name: 'Plastering Trowel', image: 'plastering-trowel' },
  { id: 'tool-crowbar', kind: 'tool', category: 'Hand tools', name: 'Crowbar', image: 'crowbar' },
  { id: 'tool-shovel', kind: 'tool', category: 'Hand tools', name: 'Shovel', image: 'shovel' },
  { id: 'tool-pickaxe', kind: 'tool', category: 'Hand tools', name: 'Pickaxe', image: 'pickaxe' },
  { id: 'tool-chisel', kind: 'tool', category: 'Hand tools', name: 'Chisel', image: 'chisel' },
  { id: 'tool-hand-saw', kind: 'tool', category: 'Hand tools', name: 'Hand Saw', image: 'hand-saw' },
  { id: 'tool-hacksaw', kind: 'tool', category: 'Hand tools', name: 'Hacksaw', image: 'hacksaw' },
  { id: 'tool-measuring-tape', kind: 'tool', category: 'Measuring tools', name: 'Measuring Tape', image: 'measuring-tape' },
  { id: 'tool-spirit-level', kind: 'tool', category: 'Measuring tools', name: 'Spirit Level', image: 'spirit-level' },
  { id: 'tool-laser-measure', kind: 'tool', category: 'Measuring tools', name: 'Laser Distance Measure', image: 'laser-measure' },
  { id: 'tool-plumb-bob', kind: 'tool', category: 'Measuring tools', name: 'Plumb Bob', image: 'plumb-bob' },
  { id: 'tool-try-square', kind: 'tool', category: 'Measuring tools', name: 'Try Square', image: 'try-square' },
  { id: 'tool-wheelbarrow', kind: 'tool', category: 'Material handling', name: 'Wheelbarrow', image: 'wheelbarrow' },
  { id: 'tool-ladder', kind: 'tool', category: 'Material handling', name: 'Ladder', image: 'ladder' },
  { id: 'tool-chain-block', kind: 'tool', category: 'Material handling', name: 'Chain Pulley Block', image: 'chain-block' },
  { id: 'tool-bucket', kind: 'tool', category: 'Material handling', name: 'Bucket', image: 'bucket' },
  { id: 'tool-drill', kind: 'tool', category: 'Power tools', name: 'Drill Machine', image: 'drill' },
  { id: 'tool-angle-grinder', kind: 'tool', category: 'Power tools', name: 'Angle Grinder', image: 'angle-grinder' },
  { id: 'tool-tile-cutter', kind: 'tool', category: 'Power tools', name: 'Tile Cutter', image: 'tile-cutter' },
  { id: 'tool-vibrator', kind: 'tool', category: 'Power tools', name: 'Concrete Vibrator', image: 'concrete-vibrator' },
  { id: 'tool-scaffolding', kind: 'tool', category: 'Site equipment', name: 'Scaffolding Pipes & Couplers', image: 'scaffolding' },
  { id: 'tool-steel-props', kind: 'tool', category: 'Site equipment', name: 'Steel Props', image: 'steel-props' },
  { id: 'tool-concrete-mixer', kind: 'tool', category: 'Site equipment', name: 'Concrete Mixer', image: 'concrete-mixer' },
  { id: 'tool-safety-helmet', kind: 'tool', category: 'Site equipment', name: 'Safety Helmet', image: 'safety-helmet' },
];

const SEED_STAMP = '2026-01-01T00:00:00.000Z';

export function builtInCatalog(): CatalogItem[] {
  return [...CEMENT_BRANDS, ...MATERIALS, ...TOOLS].map(seed => {
    const { image, ...rest } = seed;
    const photo = image ? TOOL_IMAGES[image] : undefined;
    return {
      ...rest,
      imageUrl: photo?.file,
      imageCredit: photo ? `${photo.author} — ${photo.license}` : undefined,
      isBuiltIn: true,
      isDeleted: false,
      createdAt: SEED_STAMP,
      updatedAt: SEED_STAMP,
    };
  });
}
