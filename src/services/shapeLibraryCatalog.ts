import type {
  FloorPlanWall, FloorPlanRoom, FloorPlanDoor, FloorPlanWindow,
  FloorPlanFurniture, FloorPlanStaircase, FloorPlanColumn, FloorPlanAnnotation,
  FloorPlanUnit, RoomType, DoorType, WindowType,
} from '../db/types';

export type ShapeCategory =
  | 'Floor Plan'
  | 'Furniture'
  | 'Kitchen'
  | 'Bathroom'
  | 'Stairs'
  | 'Structural'
  | 'Electrical'
  | 'Plumbing'
  | 'Outdoor'
  | 'Annotation';

export type ShapeEntityType =
  | 'wall'
  | 'room'
  | 'door'
  | 'window'
  | 'furniture'
  | 'stairs'
  | 'column'
  | 'annotation';

export interface ShapeLibraryItem {
  id: string;
  name: string;
  category: ShapeCategory;
  width: number;      // in feet
  height: number;     // in feet
  description: string;
  entityType: ShapeEntityType;
  iconType: string;
  subType?: string;
  isCustom?: boolean;
}

export const SHAPE_CATEGORIES: { id: ShapeCategory; label: string; icon: string }[] = [
  { id: 'Floor Plan', label: '1. FLOOR PLAN', icon: '📐' },
  { id: 'Furniture', label: '2. FURNITURE', icon: '🛋' },
  { id: 'Kitchen', label: '3. KITCHEN', icon: '🍳' },
  { id: 'Bathroom', label: '4. BATHROOM', icon: '🚿' },
  { id: 'Stairs', label: '5. STAIRS', icon: '🪜' },
  { id: 'Structural', label: '6. STRUCTURAL', icon: '🏛' },
  { id: 'Electrical', label: '7. ELECTRICAL', icon: '⚡' },
  { id: 'Plumbing', label: '8. PLUMBING', icon: '🚰' },
  { id: 'Outdoor', label: '9. OUTDOOR', icon: '🌳' },
  { id: 'Annotation', label: '10. ANNOTATION', icon: '🏷' },
];

export const SHAPE_LIBRARY_CATALOG: ShapeLibraryItem[] = [
  // ── 1. FLOOR PLAN ──────────────────────────────────────────────
  {
    id: 'fp-wall',
    name: 'Wall',
    category: 'Floor Plan',
    width: 8,
    height: 0.75,
    description: 'Straight wall section (8 ft standard thickness)',
    entityType: 'wall',
    iconType: 'Wall',
    subType: 'exterior',
  },
  {
    id: 'fp-interior-wall',
    name: 'Interior Wall',
    category: 'Floor Plan',
    width: 8,
    height: 0.5,
    description: 'Interior partition wall (4.5" / 6" thickness)',
    entityType: 'wall',
    iconType: 'Interior Wall',
    subType: 'interior',
  },
  {
    id: 'fp-exterior-wall',
    name: 'Exterior Wall',
    category: 'Floor Plan',
    width: 10,
    height: 0.75,
    description: 'Heavy exterior load-bearing boundary wall (9" thickness)',
    entityType: 'wall',
    iconType: 'Exterior Wall',
    subType: 'exterior',
  },
  {
    id: 'fp-corner-wall',
    name: 'Corner Wall',
    category: 'Floor Plan',
    width: 6,
    height: 6,
    description: 'L-corner perpendicular wall join',
    entityType: 'wall',
    iconType: 'Corner Wall',
    subType: 'exterior',
  },
  {
    id: 'fp-room',
    name: 'Room',
    category: 'Floor Plan',
    width: 12,
    height: 10,
    description: 'Pre-sized room boundary with auto area tag (12×10 ft)',
    entityType: 'room',
    iconType: 'Room',
    subType: 'Living Room',
  },
  {
    id: 'fp-door-single',
    name: 'Door',
    category: 'Floor Plan',
    width: 2.5,
    height: 2.5,
    description: 'Standard single-leaf swing door (2.5 ft)',
    entityType: 'door',
    iconType: 'Door',
    subType: 'Single',
  },
  {
    id: 'fp-door-main',
    name: 'Main Entrance',
    category: 'Floor Plan',
    width: 3.5,
    height: 3.5,
    description: 'Main entrance door (3.5 ft)',
    entityType: 'door',
    iconType: 'Main Entrance',
    subType: 'Main Entrance',
  },
  {
    id: 'fp-door-bath',
    name: 'Bathroom Door',
    category: 'Floor Plan',
    width: 2.2,
    height: 2.2,
    description: 'Bathroom door (2.2 ft)',
    entityType: 'door',
    iconType: 'Bathroom Door',
    subType: 'Bathroom',
  },
  {
    id: 'fp-door-double',
    name: 'Double Door',
    category: 'Floor Plan',
    width: 5,
    height: 2.5,
    description: 'Double entrance swing door (5 ft)',
    entityType: 'door',
    iconType: 'Double Door',
    subType: 'Double',
  },
  {
    id: 'fp-door-sliding',
    name: 'Sliding Door',
    category: 'Floor Plan',
    width: 5,
    height: 1.5,
    description: '2-track sliding patio/balcony door (5 ft)',
    entityType: 'door',
    iconType: 'Sliding Door',
    subType: 'Sliding',
  },
  {
    id: 'fp-window-std',
    name: 'Window',
    category: 'Floor Plan',
    width: 3.5,
    height: 0.75,
    description: 'Standard casement exterior window (3.5 ft)',
    entityType: 'window',
    iconType: 'Window',
    subType: 'Standard',
  },
  {
    id: 'fp-window-single',
    name: 'Single Window',
    category: 'Floor Plan',
    width: 3,
    height: 0.75,
    description: 'Single casement window (3 ft)',
    entityType: 'window',
    iconType: 'Single Window',
    subType: 'Standard',
  },
  {
    id: 'fp-window-double',
    name: 'Double Window',
    category: 'Floor Plan',
    width: 5,
    height: 0.75,
    description: 'Double glazed window (5 ft)',
    entityType: 'window',
    iconType: 'Double Window',
    subType: 'Large',
  },
  {
    id: 'fp-window-large',
    name: 'Large Window',
    category: 'Floor Plan',
    width: 6,
    height: 0.75,
    description: 'Large living room picture window (6 ft)',
    entityType: 'window',
    iconType: 'Large Window',
    subType: 'Large',
  },
  {
    id: 'fp-window-bath',
    name: 'Bathroom Window',
    category: 'Floor Plan',
    width: 2,
    height: 0.75,
    description: 'High-level ventilator bathroom window (2 ft)',
    entityType: 'window',
    iconType: 'Bathroom Window',
    subType: 'Ventilator',
  },
  {
    id: 'fp-window-sliding',
    name: 'Sliding Window',
    category: 'Floor Plan',
    width: 4,
    height: 0.75,
    description: 'UPVC / Aluminum sliding window (4 ft)',
    entityType: 'window',
    iconType: 'Sliding Window',
    subType: 'Sliding',
  },
  {
    id: 'fp-opening',
    name: 'Opening',
    category: 'Floor Plan',
    width: 3,
    height: 0.75,
    description: 'Cased archway / wall pass opening without door',
    entityType: 'door',
    iconType: 'Opening',
    subType: 'Opening',
  },
  {
    id: 'fp-staircase',
    name: 'Staircase',
    category: 'Floor Plan',
    width: 3.5,
    height: 8,
    description: 'Circulation staircase flight (3.5×8 ft)',
    entityType: 'stairs',
    iconType: 'Staircase',
    subType: 'straight',
  },

  // ── 2. FURNITURE ──────────────────────────────────────────────
  {
    id: 'furn-single-bed',
    name: 'Single Bed',
    category: 'Furniture',
    width: 3,
    height: 6.5,
    description: 'Single cot bed (3×6.5 ft) with pillow & bedding',
    entityType: 'furniture',
    iconType: 'Single Bed',
  },
  {
    id: 'furn-double-bed',
    name: 'Double Bed',
    category: 'Furniture',
    width: 5,
    height: 6.5,
    description: 'Double master bed (5×6.5 ft) with dual pillows',
    entityType: 'furniture',
    iconType: 'Double Bed',
  },
  {
    id: 'furn-queen-bed',
    name: 'Queen Bed',
    category: 'Furniture',
    width: 5.5,
    height: 6.5,
    description: 'Queen size bed (5.5×6.5 ft) with pillows',
    entityType: 'furniture',
    iconType: 'Queen Bed',
  },
  {
    id: 'furn-king-bed',
    name: 'King Bed',
    category: 'Furniture',
    width: 6,
    height: 6.5,
    description: 'King size luxury bed (6×6.5 ft) with pillows & headboard',
    entityType: 'furniture',
    iconType: 'King Bed',
  },
  {
    id: 'furn-sofa',
    name: 'Sofa',
    category: 'Furniture',
    width: 7,
    height: 3,
    description: '3-seater living room sofa (7×3 ft)',
    entityType: 'furniture',
    iconType: 'Sofa',
  },
  {
    id: 'furn-l-sofa',
    name: 'L Sofa',
    category: 'Furniture',
    width: 7,
    height: 6,
    description: 'Corner sectional L-shaped sofa (7×6 ft)',
    entityType: 'furniture',
    iconType: 'L Sofa',
  },
  {
    id: 'furn-chair',
    name: 'Chair',
    category: 'Furniture',
    width: 2,
    height: 2,
    description: 'Standard accent / side chair (2×2 ft)',
    entityType: 'furniture',
    iconType: 'Chair',
  },
  {
    id: 'furn-armchair',
    name: 'Armchair',
    category: 'Furniture',
    width: 3,
    height: 3,
    description: '1-seater plush lounge armchair (3×3 ft)',
    entityType: 'furniture',
    iconType: 'Armchair',
  },
  {
    id: 'furn-coffee-table',
    name: 'Coffee Table',
    category: 'Furniture',
    width: 3.5,
    height: 2,
    description: 'Living room center coffee table (3.5×2 ft)',
    entityType: 'furniture',
    iconType: 'Coffee Table',
  },
  {
    id: 'furn-dining-table',
    name: 'Dining Table',
    category: 'Furniture',
    width: 5.5,
    height: 3.5,
    description: '6-seater family dining table with chairs (5.5×3.5 ft)',
    entityType: 'furniture',
    iconType: 'Dining Table',
  },
  {
    id: 'furn-dining-table-2',
    name: '2-seat Dining Table',
    category: 'Furniture',
    width: 2.5,
    height: 2.5,
    description: 'Compact 2-seater dining table with chairs (2.5×2.5 ft)',
    entityType: 'furniture',
    iconType: '2-seat Dining Table',
  },
  {
    id: 'furn-dining-table-4',
    name: '4-seat Dining Table',
    category: 'Furniture',
    width: 3.5,
    height: 3.5,
    description: 'Square 4-seater dining table with chairs (3.5×3.5 ft)',
    entityType: 'furniture',
    iconType: '4-seat Dining Table',
  },
  {
    id: 'furn-dining-table-8',
    name: '8-seat Dining Table',
    category: 'Furniture',
    width: 7,
    height: 3.5,
    description: 'Large 8-seater dining table with chairs (7×3.5 ft)',
    entityType: 'furniture',
    iconType: '8-seat Dining Table',
  },
  {
    id: 'furn-dining-chair',
    name: 'Dining Chair',
    category: 'Furniture',
    width: 1.8,
    height: 1.8,
    description: 'Dining chair with cushioned seat (1.8×1.8 ft)',
    entityType: 'furniture',
    iconType: 'Dining Chair',
  },
  {
    id: 'furn-wardrobe',
    name: 'Wardrobe',
    category: 'Furniture',
    width: 4,
    height: 2,
    description: '2-door bedroom wardrobe / closet (4×2 ft)',
    entityType: 'furniture',
    iconType: 'Wardrobe',
  },
  {
    id: 'furn-cabinet',
    name: 'Cabinet',
    category: 'Furniture',
    width: 3.5,
    height: 1.5,
    description: 'Storage credenza / storage cabinet (3.5×1.5 ft)',
    entityType: 'furniture',
    iconType: 'Cabinet',
  },
  {
    id: 'furn-tv',
    name: 'TV',
    category: 'Furniture',
    width: 4,
    height: 0.8,
    description: 'Flat screen television (4×0.8 ft)',
    entityType: 'furniture',
    iconType: 'TV',
  },
  {
    id: 'furn-tv-wall',
    name: 'Wall Mounted TV',
    category: 'Furniture',
    width: 4,
    height: 0.5,
    description: 'Wall-mounted slim television (4×0.5 ft)',
    entityType: 'furniture',
    iconType: 'Wall Mounted TV',
  },
  {
    id: 'furn-tv-stand',
    name: 'TV Stand',
    category: 'Furniture',
    width: 4.5,
    height: 1.5,
    description: 'Media console & TV entertainment stand (4.5×1.5 ft)',
    entityType: 'furniture',
    iconType: 'TV Stand',
  },
  {
    id: 'furn-ac-split',
    name: 'Split AC Indoor Unit',
    category: 'Furniture',
    width: 3.5,
    height: 0.8,
    description: 'Wall-mounted split AC indoor unit (3.5×0.8 ft)',
    entityType: 'furniture',
    iconType: 'Split AC Indoor Unit',
  },
  {
    id: 'furn-ac-outdoor',
    name: 'AC Outdoor Unit',
    category: 'Furniture',
    width: 2.5,
    height: 1.5,
    description: 'Air conditioner compressor / outdoor unit (2.5×1.5 ft)',
    entityType: 'furniture',
    iconType: 'AC Outdoor Unit',
  },
  {
    id: 'furn-desk',
    name: 'Desk',
    category: 'Furniture',
    width: 4,
    height: 2,
    description: 'Study / computer work desk (4×2 ft)',
    entityType: 'furniture',
    iconType: 'Desk',
  },
  {
    id: 'furn-study-chair',
    name: 'Study Chair',
    category: 'Furniture',
    width: 2,
    height: 2,
    description: 'Ergonomic study / office swivel chair (2×2 ft)',
    entityType: 'furniture',
    iconType: 'Study Chair',
  },
  {
    id: 'furn-bookshelf',
    name: 'Bookshelf',
    category: 'Furniture',
    width: 3.5,
    height: 1.2,
    description: 'Vertical shelving rack / library bookshelf (3.5×1.2 ft)',
    entityType: 'furniture',
    iconType: 'Bookshelf',
  },

  // ── 3. KITCHEN ──────────────────────────────────────────────
  {
    id: 'kit-kitchen-counter',
    name: 'Kitchen Counter',
    category: 'Kitchen',
    width: 6,
    height: 2,
    description: 'Granite modular kitchen worktop counter (6×2 ft)',
    entityType: 'furniture',
    iconType: 'Kitchen Counter',
  },
  {
    id: 'kit-sink',
    name: 'Sink',
    category: 'Kitchen',
    width: 3,
    height: 2,
    description: 'Stainless steel double-bowl kitchen sink (3×2 ft)',
    entityType: 'furniture',
    iconType: 'Sink',
  },
  {
    id: 'kit-stove',
    name: 'Stove',
    category: 'Kitchen',
    width: 2.5,
    height: 2,
    description: '4-burner gas stove / induction cooktop (2.5×2 ft)',
    entityType: 'furniture',
    iconType: 'Stove',
  },
  {
    id: 'kit-oven',
    name: 'Oven',
    category: 'Kitchen',
    width: 2.5,
    height: 2,
    description: 'Built-in convection oven unit (2.5×2 ft)',
    entityType: 'furniture',
    iconType: 'Oven',
  },
  {
    id: 'kit-refrigerator',
    name: 'Refrigerator',
    category: 'Kitchen',
    width: 2.5,
    height: 2.5,
    description: 'Double-door domestic refrigerator (2.5×2.5 ft)',
    entityType: 'furniture',
    iconType: 'Refrigerator',
  },
  {
    id: 'kit-dishwasher',
    name: 'Dishwasher',
    category: 'Kitchen',
    width: 2,
    height: 2,
    description: 'Under-counter automatic dishwasher (2×2 ft)',
    entityType: 'furniture',
    iconType: 'Dishwasher',
  },
  {
    id: 'kit-kitchen-cabinet',
    name: 'Kitchen Cabinet',
    category: 'Kitchen',
    width: 3,
    height: 1.5,
    description: 'Overhead / base modular kitchen cabinet (3×1.5 ft)',
    entityType: 'furniture',
    iconType: 'Kitchen Cabinet',
  },
  {
    id: 'kit-island',
    name: 'Island',
    category: 'Kitchen',
    width: 5,
    height: 3,
    description: 'Central cooking / preparation kitchen island (5×3 ft)',
    entityType: 'furniture',
    iconType: 'Island',
  },
  {
    id: 'kit-breakfast-counter',
    name: 'Breakfast Counter',
    category: 'Kitchen',
    width: 5,
    height: 1.8,
    description: 'Raised breakfast bar with counter stools (5×1.8 ft)',
    entityType: 'furniture',
    iconType: 'Breakfast Counter',
  },

  // ── 4. BATHROOM ──────────────────────────────────────────────
  {
    id: 'bath-toilet',
    name: 'Toilet',
    category: 'Bathroom',
    width: 2,
    height: 2.5,
    description: 'European water closet / commode with cistern (2×2.5 ft)',
    entityType: 'furniture',
    iconType: 'Toilet',
  },
  {
    id: 'bath-wash-basin',
    name: 'Wash Basin',
    category: 'Bathroom',
    width: 2,
    height: 1.5,
    description: 'Ceramic counter / wall-hung wash basin (2×1.5 ft)',
    entityType: 'furniture',
    iconType: 'Wash Basin',
  },
  {
    id: 'bath-shower',
    name: 'Shower',
    category: 'Bathroom',
    width: 3,
    height: 3,
    description: 'Glass cubicle walk-in shower enclosure (3×3 ft)',
    entityType: 'furniture',
    iconType: 'Shower',
  },
  {
    id: 'bath-bathtub',
    name: 'Bathtub',
    category: 'Bathroom',
    width: 5,
    height: 2.5,
    description: 'Full-length soaking bathtub (5×2.5 ft)',
    entityType: 'furniture',
    iconType: 'Bathtub',
  },
  {
    id: 'bath-bidet',
    name: 'Bidet',
    category: 'Bathroom',
    width: 1.5,
    height: 2,
    description: 'Floor-mounted ceramic bidet unit (1.5×2 ft)',
    entityType: 'furniture',
    iconType: 'Bidet',
  },
  {
    id: 'bath-bathroom-cabinet',
    name: 'Bathroom Cabinet',
    category: 'Bathroom',
    width: 2.5,
    height: 1.2,
    description: 'Under-sink bathroom vanity cabinet (2.5×1.2 ft)',
    entityType: 'furniture',
    iconType: 'Bathroom Cabinet',
  },
  {
    id: 'bath-vanity',
    name: 'Vanity',
    category: 'Bathroom',
    width: 3,
    height: 1.8,
    description: 'Bathroom vanity unit with integrated wash basin (3×1.8 ft)',
    entityType: 'furniture',
    iconType: 'Vanity',
  },
  {
    id: 'bath-mirror',
    name: 'Mirror',
    category: 'Bathroom',
    width: 2.5,
    height: 0.5,
    description: 'Wall-mounted vanity grooming mirror (2.5×0.5 ft)',
    entityType: 'furniture',
    iconType: 'Mirror',
  },
  {
    id: 'bath-floor-drain',
    name: 'Floor Drain',
    category: 'Bathroom',
    width: 1,
    height: 1,
    description: 'Stainless steel anti-cockroach floor drain trap (1×1 ft)',
    entityType: 'furniture',
    iconType: 'Floor Drain',
  },

  // ── 5. STAIRS ──────────────────────────────────────────────
  {
    id: 'stair-straight',
    name: 'Straight Stair',
    category: 'Stairs',
    width: 3.5,
    height: 8,
    description: 'Single flight straight run staircase (3.5×8 ft)',
    entityType: 'stairs',
    iconType: 'Straight Stair',
    subType: 'straight',
  },
  {
    id: 'stair-l',
    name: 'L Stair',
    category: 'Stairs',
    width: 6,
    height: 6,
    description: 'Quarter turn L-shaped staircase with landing (6×6 ft)',
    entityType: 'stairs',
    iconType: 'L Stair',
    subType: 'l-shape',
  },
  {
    id: 'stair-u',
    name: 'U Stair',
    category: 'Stairs',
    width: 6,
    height: 8,
    description: 'Half turn dog-legged U-shaped staircase (6×8 ft)',
    entityType: 'stairs',
    iconType: 'U Stair',
    subType: 'u-shape',
  },
  {
    id: 'stair-spiral',
    name: 'Spiral Stair',
    category: 'Stairs',
    width: 5,
    height: 5,
    description: 'Circular helical / spiral staircase (5×5 ft)',
    entityType: 'stairs',
    iconType: 'Spiral Stair',
    subType: 'spiral',
  },

  // ── 6. STRUCTURAL ──────────────────────────────────────────────
  {
    id: 'struct-column',
    name: 'Column',
    category: 'Structural',
    width: 0.75,
    height: 0.75,
    description: 'Reinforced concrete square column (9"×9")',
    entityType: 'column',
    iconType: 'Column',
    subType: 'square',
  },
  {
    id: 'struct-pillar',
    name: 'Pillar',
    category: 'Structural',
    width: 0.75,
    height: 0.75,
    description: 'Cylindrical round architectural pillar (9" dia)',
    entityType: 'column',
    iconType: 'Pillar',
    subType: 'round',
  },
  {
    id: 'struct-beam',
    name: 'Beam',
    category: 'Structural',
    width: 8,
    height: 0.75,
    description: 'Overhead RCC lintel / tie beam line (8 ft)',
    entityType: 'wall',
    iconType: 'Beam',
    subType: 'structural',
  },
  {
    id: 'struct-wall',
    name: 'Structural Wall',
    category: 'Structural',
    width: 8,
    height: 0.75,
    description: 'RCC shear / retainment structural load wall (8 ft)',
    entityType: 'wall',
    iconType: 'Structural Wall',
    subType: 'structural',
  },

  // ── 7. ELECTRICAL ──────────────────────────────────────────────
  {
    id: 'elec-light',
    name: 'Light',
    category: 'Electrical',
    width: 1.5,
    height: 1.5,
    description: 'Ceiling downlight / fixture symbol (1.5×1.5 ft)',
    entityType: 'furniture',
    iconType: 'Light',
  },
  {
    id: 'elec-fan',
    name: 'Ceiling Fan',
    category: 'Electrical',
    width: 3.5,
    height: 3.5,
    description: 'Ceiling fan with 3 blades symbol (3.5×3.5 ft)',
    entityType: 'furniture',
    iconType: 'Ceiling Fan',
  },
  {
    id: 'elec-switch',
    name: 'Switch',
    category: 'Electrical',
    width: 1,
    height: 0.6,
    description: 'Wall lighting control switch point symbol',
    entityType: 'furniture',
    iconType: 'Switch',
  },
  {
    id: 'elec-socket',
    name: 'Socket',
    category: 'Electrical',
    width: 1,
    height: 0.6,
    description: 'Power plug outlet / 16A socket point',
    entityType: 'furniture',
    iconType: 'Socket',
  },
  {
    id: 'elec-db',
    name: 'Distribution Board',
    category: 'Electrical',
    width: 2,
    height: 0.8,
    description: 'Main electrical distribution panel / MCB board',
    entityType: 'furniture',
    iconType: 'Distribution Board',
  },

  // ── 8. PLUMBING ──────────────────────────────────────────────
  {
    id: 'plumb-water-point',
    name: 'Water Point',
    category: 'Plumbing',
    width: 1,
    height: 1,
    description: 'Fresh water supply inlet / bib tap valve point',
    entityType: 'furniture',
    iconType: 'Water Point',
  },
  {
    id: 'plumb-drain',
    name: 'Drain',
    category: 'Plumbing',
    width: 1,
    height: 1,
    description: 'Waste water drainage outlet stack symbol',
    entityType: 'furniture',
    iconType: 'Drain',
  },
  {
    id: 'plumb-pipe',
    name: 'Pipe',
    category: 'Plumbing',
    width: 6,
    height: 0.4,
    description: 'Plumbing line run indicator (6 ft)',
    entityType: 'furniture',
    iconType: 'Pipe',
  },
  {
    id: 'plumb-floor-trap',
    name: 'Floor Trap',
    category: 'Plumbing',
    width: 1.2,
    height: 1.2,
    description: 'Gully / floor multi-inlet trap with water seal',
    entityType: 'furniture',
    iconType: 'Floor Trap',
  },

  // ── 9. OUTDOOR ──────────────────────────────────────────────
  {
    id: 'out-tree',
    name: 'Tree',
    category: 'Outdoor',
    width: 4.5,
    height: 4.5,
    description: 'Landscape tree canopy CAD plan symbol (4.5×4.5 ft)',
    entityType: 'furniture',
    iconType: 'Tree',
  },
  {
    id: 'out-plant',
    name: 'Plant',
    category: 'Outdoor',
    width: 2,
    height: 2,
    description: 'Ornamental shrub / potted foliage plant (2×2 ft)',
    entityType: 'furniture',
    iconType: 'Plant',
  },
  {
    id: 'out-garden',
    name: 'Garden',
    category: 'Outdoor',
    width: 8,
    height: 5,
    description: 'Landscaped garden green bed / lawn area (8×5 ft)',
    entityType: 'furniture',
    iconType: 'Garden',
  },
  {
    id: 'out-parking',
    name: 'Parking',
    category: 'Outdoor',
    width: 8,
    height: 16,
    description: 'Standard four-wheeler parking stall (8×16 ft)',
    entityType: 'furniture',
    iconType: 'Parking',
  },
  {
    id: 'out-car',
    name: 'Car',
    category: 'Outdoor',
    width: 6,
    height: 14,
    description: 'Sedan vehicle top view plan symbol (6×14 ft)',
    entityType: 'furniture',
    iconType: 'Car',
  },
  {
    id: 'out-gate',
    name: 'Gate',
    category: 'Outdoor',
    width: 8,
    height: 0.8,
    description: 'Compound driveway sliding / swing gate (8 ft)',
    entityType: 'door',
    iconType: 'Gate',
    subType: 'Sliding',
  },

  // ── 10. ANNOTATION ──────────────────────────────────────────────
  {
    id: 'annot-text',
    name: 'Text',
    category: 'Annotation',
    width: 3,
    height: 1.2,
    description: 'General text callout label',
    entityType: 'annotation',
    iconType: 'Text',
    subType: 'text',
  },
  {
    id: 'annot-room-label',
    name: 'Room Label',
    category: 'Annotation',
    width: 4,
    height: 1.5,
    description: 'Room identification title tag',
    entityType: 'annotation',
    iconType: 'Room Label',
    subType: 'room-label',
  },
  {
    id: 'annot-dimension',
    name: 'Dimension',
    category: 'Annotation',
    width: 6,
    height: 1.2,
    description: 'CAD linear measurement marker dimension line',
    entityType: 'annotation',
    iconType: 'Dimension',
    subType: 'dimension',
  },
  {
    id: 'annot-area',
    name: 'Area',
    category: 'Annotation',
    width: 3.5,
    height: 1.2,
    description: 'Square footage / square meter area computation badge',
    entityType: 'annotation',
    iconType: 'Area',
    subType: 'area',
  },
  {
    id: 'annot-north-arrow',
    name: 'North Arrow',
    category: 'Annotation',
    width: 2.5,
    height: 3,
    description: 'Architectural true North orientation compass pointer',
    entityType: 'annotation',
    iconType: 'North Arrow',
    subType: 'north',
  },
  {
    id: 'annot-scale',
    name: 'Scale',
    category: 'Annotation',
    width: 4,
    height: 1,
    description: 'Engineering graphic ratio scale indicator bar',
    entityType: 'annotation',
    iconType: 'Scale',
    subType: 'scale',
  },
  {
    id: 'annot-note',
    name: 'Note',
    category: 'Annotation',
    width: 3.5,
    height: 2,
    description: 'Architectural revision / site instruction note box',
    entityType: 'annotation',
    iconType: 'Note',
    subType: 'note',
  },
];

// ─────────────────────────────────────────────────────────────────
// Search & Filter Utilities
// ─────────────────────────────────────────────────────────────────

export function searchShapes(query: string, items: ShapeLibraryItem[] = SHAPE_LIBRARY_CATALOG): ShapeLibraryItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter(
    item =>
      item.name.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q) ||
      (item.subType && item.subType.toLowerCase().includes(q))
  );
}

// ─────────────────────────────────────────────────────────────────
// Persistence: Favorites & Recently Used
// ─────────────────────────────────────────────────────────────────

const FAVORITES_KEY_PREFIX = 'mistry_fp_favs_';
const RECENTS_KEY_PREFIX = 'mistry_fp_recents_';
const CUSTOM_SHAPES_KEY_PREFIX = 'mistry_fp_custom_shapes_';

const memoryStore: Record<string, string> = {};

function safeGetItem(key: string): string | null {
  try {
    if (typeof localStorage !== 'undefined') {
      const val = localStorage.getItem(key);
      if (val !== null) return val;
    }
  } catch {
    // fallback to memoryStore
  }
  return memoryStore[key] ?? null;
}

function safeSetItem(key: string, value: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, value);
    }
  } catch {
    // fallback to memoryStore
  }
  memoryStore[key] = value;
}

export function getFavoriteShapeIds(userId: string): string[] {
  try {
    const raw = safeGetItem(`${FAVORITES_KEY_PREFIX}${userId}`);
    return raw ? JSON.parse(raw) : ['fp-wall', 'fp-door-single', 'fp-window-std', 'furn-double-bed', 'bath-toilet', 'kit-sink'];
  } catch {
    return [];
  }
}

export function toggleFavoriteShape(userId: string, shapeId: string): string[] {
  try {
    const current = getFavoriteShapeIds(userId);
    const next = current.includes(shapeId)
      ? current.filter(id => id !== shapeId)
      : [...current, shapeId];
    safeSetItem(`${FAVORITES_KEY_PREFIX}${userId}`, JSON.stringify(next));
    return next;
  } catch {
    return [];
  }
}

export function getRecentShapeIds(userId: string): string[] {
  try {
    const raw = safeGetItem(`${RECENTS_KEY_PREFIX}${userId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function recordRecentShape(userId: string, shapeId: string): string[] {
  try {
    const current = getRecentShapeIds(userId);
    const filtered = current.filter(id => id !== shapeId);
    const next = [shapeId, ...filtered].slice(0, 16);
    safeSetItem(`${RECENTS_KEY_PREFIX}${userId}`, JSON.stringify(next));
    return next;
  } catch {
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────
// Custom Objects Storage
// ─────────────────────────────────────────────────────────────────

export function getCustomShapes(userId: string): ShapeLibraryItem[] {
  try {
    const raw = safeGetItem(`${CUSTOM_SHAPES_KEY_PREFIX}${userId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveCustomShape(userId: string, item: ShapeLibraryItem): ShapeLibraryItem[] {
  try {
    const current = getCustomShapes(userId);
    const existingIdx = current.findIndex(c => c.id === item.id);
    let next: ShapeLibraryItem[];
    if (existingIdx >= 0) {
      next = [...current];
      next[existingIdx] = item;
    } else {
      next = [item, ...current];
    }
    safeSetItem(`${CUSTOM_SHAPES_KEY_PREFIX}${userId}`, JSON.stringify(next));
    return next;
  } catch {
    return [];
  }
}

export function deleteCustomShape(userId: string, shapeId: string): ShapeLibraryItem[] {
  try {
    const current = getCustomShapes(userId);
    const next = current.filter(c => c.id !== shapeId);
    safeSetItem(`${CUSTOM_SHAPES_KEY_PREFIX}${userId}`, JSON.stringify(next));
    return next;
  } catch {
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────
// Canvas Entity Generator
// ─────────────────────────────────────────────────────────────────

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

export interface CreatedEntityResult {
  entityType: ShapeEntityType;
  payload:
    | FloorPlanWall
    | FloorPlanRoom
    | FloorPlanDoor
    | FloorPlanWindow
    | FloorPlanFurniture
    | FloorPlanStaircase
    | FloorPlanColumn
    | FloorPlanAnnotation;
}

export function createEntityFromShape(
  item: ShapeLibraryItem,
  x: number,
  y: number,
  _unit: FloorPlanUnit = 'feet'
): CreatedEntityResult {
  const w = item.width;
  const h = item.height;

  switch (item.entityType) {
    case 'wall': {
      const isPerpendicular = item.name.includes('Corner');
      const thickness = item.subType === 'interior' ? 0.5 : 0.75;
      return {
        entityType: 'wall',
        payload: {
          id: uid('wall'),
          x1: x,
          y1: y,
          x2: x + (isPerpendicular ? 4 : w),
          y2: y + (isPerpendicular ? 4 : 0),
          thickness,
          wallType: (item.subType as any) || 'exterior',
        } as FloorPlanWall,
      };
    }

    case 'room': {
      const roomType = (item.subType as RoomType) || 'Living Room';
      return {
        entityType: 'room',
        payload: {
          id: uid('room'),
          roomType,
          label: item.name === 'Room' ? roomType : item.name,
          x,
          y,
          width: w,
          height: h,
          rotation: 0,
        } as FloorPlanRoom,
      };
    }

    case 'door': {
      const doorType = (item.subType as DoorType) || 'Single';
      return {
        entityType: 'door',
        payload: {
          id: uid('door'),
          doorType,
          x,
          y,
          width: w,
          rotation: 0,
          swingAngle: doorType === 'Double' ? 90 : doorType === 'Sliding' ? 0 : 90,
        } as FloorPlanDoor,
      };
    }

    case 'window': {
      const windowType = (item.subType as WindowType) || 'Standard';
      return {
        entityType: 'window',
        payload: {
          id: uid('win'),
          windowType,
          x,
          y,
          width: w,
          rotation: 0,
        } as FloorPlanWindow,
      };
    }

    case 'column': {
      const shape = item.subType === 'round' ? 'round' : 'square';
      return {
        entityType: 'column',
        payload: {
          id: uid('col'),
          structType: 'Column',
          shape,
          x,
          y,
          width: w,
          depth: h,
          label: shape === 'round' ? 'P' : 'C',
        } as FloorPlanColumn,
      };
    }

    case 'stairs': {
      const stairType = (item.subType as any) || 'straight';
      return {
        entityType: 'stairs',
        payload: {
          id: uid('stair'),
          type: stairType,
          x,
          y,
          width: w,
          length: h,
          rotation: 0,
          steps: 14,
          direction: 'up',
        } as FloorPlanStaircase,
      };
    }

    case 'annotation': {
      let annotType: any = item.subType || 'text';
      let text = item.name;
      if (annotType === 'area') text = 'Area: 150 sq.ft';
      else if (annotType === 'dimension') text = '12\'-0" [3.66m]';
      else if (annotType === 'north') text = 'N';
      else if (annotType === 'scale') text = 'Scale 1:50';
      else if (annotType === 'note') text = 'NOTE: Verify all dimensions on site';

      return {
        entityType: 'annotation',
        payload: {
          id: uid('annot'),
          annotType,
          x,
          y,
          text,
          fontSize: 10,
        } as FloorPlanAnnotation,
      };
    }

    case 'furniture':
    default: {
      let category: any = item.category.toLowerCase();
      if (category === 'floor plan') category = 'utility';
      return {
        entityType: 'furniture',
        payload: {
          id: uid('furn'),
          category,
          itemType: item.iconType || item.name,
          label: item.name,
          x,
          y,
          width: w,
          height: h,
          rotation: 0,
        } as FloorPlanFurniture,
      };
    }
  }
}
