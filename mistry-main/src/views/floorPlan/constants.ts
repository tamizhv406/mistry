import type { RoomType, DoorType, WindowType } from '../../db/types';
import { PX_PER_UNIT } from '../../domain/planMeasure';
import type { FurnitureCatalogItem, Tool } from './types';

// Screen pixels per plan unit at 100% zoom.
export const GRID_SIZE_PX = PX_PER_UNIT;
export const MIN_ZOOM = 0.2;
export const MAX_ZOOM = 4;
export const SNAP_THRESHOLD = 0.5;
export const WALL_THICKNESS_DEFAULT = 0.75; // ft or m
export const WALL_HEIGHT_DEFAULT = 10;
export const UNDO_HISTORY_LIMIT = 50;

/** Every room is drawn with this one light fill (design system: rgba(248, 250, 252, 0.85)). */
export const ROOM_FILL = 'rgba(248, 250, 252, 0.85)';

export const ROOM_COLORS: Record<RoomType, string> = {
  'Living Room': 'rgba(251,191,36,0.18)',
  'Master Bedroom': 'rgba(147,197,253,0.22)',
  'Bedroom': 'rgba(96,165,250,0.18)',
  'Guest Room': 'rgba(165,180,252,0.18)',
  'Kids Room': 'rgba(244,114,182,0.18)',
  'Kitchen': 'rgba(52,211,153,0.18)',
  'Dining': 'rgba(100, 116, 139,0.18)',
  'Bathroom': 'rgba(129,140,248,0.18)',
  'Toilet': 'rgba(167,139,250,0.18)',
  'Utility': 'rgba(156,163,175,0.18)',
  'Balcony': 'rgba(34,197,94,0.18)',
  'Store': 'rgba(180,83,9,0.18)',
  'Store Room': 'rgba(180,83,9,0.18)',
  'Staircase': 'rgba(234,179,8,0.18)',
  'Parking': 'rgba(100,116,139,0.18)',
  'Garage': 'rgba(71,85,105,0.18)',
  'Study': 'rgba(14,165,233,0.18)',
  'Office': 'rgba(56,189,248,0.18)',
  'Pooja': 'rgba(239,68,68,0.18)',
  'Prayer Room': 'rgba(239,68,68,0.18)',
  'Corridor': 'rgba(203,213,225,0.18)',
  'Terrace': 'rgba(45,212,191,0.18)',
  'Custom': 'rgba(148,163,184,0.18)',
};

export const ROOM_TYPES: RoomType[] = [
  'Living Room', 'Master Bedroom', 'Bedroom', 'Guest Room', 'Kids Room',
  'Kitchen', 'Dining', 'Bathroom', 'Toilet', 'Utility', 'Balcony',
  'Store Room', 'Staircase', 'Parking', 'Garage', 'Study', 'Office',
  'Prayer Room', 'Pooja', 'Store', 'Corridor', 'Terrace', 'Custom',
];

export const DOOR_TYPES: DoorType[] = [
  'Single', 'Double', 'Main Entrance', 'Sliding', 'Pocket', 'Bathroom', 'Balcony', 'French', 'Opening',
];

export const WINDOW_TYPES: WindowType[] = [
  'Single Window', 'Double Window', 'Sliding Window', 'Large Window',
  'Bay Window', 'Corner Window', 'Fixed Window', 'Ventilator', 'Standard',
];

export const FURNITURE_CATALOG: FurnitureCatalogItem[] = [
  // Bedroom
  { itemType: 'Single Bed', label: 'Single Bed (3×6.5 ft)', category: 'bedroom', width: 3, height: 6.5 },
  { itemType: 'Double Bed', label: 'Double Bed (5×6.5 ft)', category: 'bedroom', width: 5, height: 6.5 },
  { itemType: 'Queen Bed', label: 'Queen Bed (5.5×6.5 ft)', category: 'bedroom', width: 5.5, height: 6.5 },
  { itemType: 'King Bed', label: 'King Bed (6×6.5 ft)', category: 'bedroom', width: 6, height: 6.5 },
  { itemType: 'Wardrobe', label: 'Wardrobe (4×2 ft)', category: 'bedroom', width: 4, height: 2 },
  { itemType: 'Dressing Table', label: 'Dressing Table (3.5×1.5 ft)', category: 'bedroom', width: 3.5, height: 1.5 },
  { itemType: 'Nightstand', label: 'Bedside Nightstand (1.5×1.5 ft)', category: 'bedroom', width: 1.5, height: 1.5 },

  // Living
  { itemType: '1-Seater Sofa', label: 'Armchair (3×3 ft)', category: 'living', width: 3, height: 3 },
  { itemType: '2-Seater Sofa', label: '2-Seater Sofa (5×3 ft)', category: 'living', width: 5, height: 3 },
  { itemType: '3-Seater Sofa', label: '3-Seater Sofa (7×3 ft)', category: 'living', width: 7, height: 3 },
  { itemType: 'L-shaped Sofa', label: 'L-Shaped Sectional Sofa (7×6 ft)', category: 'living', width: 7, height: 6 },
  { itemType: 'Coffee Table', label: 'Coffee Table (3.5×2 ft)', category: 'living', width: 3.5, height: 2 },
  { itemType: 'TV Unit', label: 'TV Console (4.5×1.5 ft)', category: 'living', width: 4.5, height: 1.5 },
  { itemType: 'Bookshelf', label: 'Bookshelf / Display (3.5×1.2 ft)', category: 'living', width: 3.5, height: 1.2 },
  { itemType: 'Shoe Rack', label: 'Shoe Rack / Foyer Cabinet (3×1.2 ft)', category: 'living', width: 3, height: 1.2 },

  // Dining & Study
  { itemType: 'Dining Table 4', label: 'Dining Table 4-Seat (3.5×3.5 ft)', category: 'dining', width: 3.5, height: 3.5 },
  { itemType: 'Dining Table 6', label: 'Dining Table 6-Seat (5.5×3.5 ft)', category: 'dining', width: 5.5, height: 3.5 },
  { itemType: 'Dining Table 8', label: 'Dining Table 8-Seat (7×3.5 ft)', category: 'dining', width: 7, height: 3.5 },
  { itemType: 'Study Desk', label: 'Study / Work Desk (4×2 ft)', category: 'dining', width: 4, height: 2 },
  { itemType: 'Office Chair', label: 'Desk Chair (2×2 ft)', category: 'dining', width: 2, height: 2 },

  // Kitchen
  { itemType: 'Kitchen Counter', label: 'Countertop (6×2 ft)', category: 'kitchen', width: 6, height: 2 },
  { itemType: 'Kitchen Sink', label: 'Kitchen Sink (3×2 ft)', category: 'kitchen', width: 3, height: 2 },
  { itemType: 'Gas Stove / Cooktop', label: 'Gas Stove / Hob (2.5×2 ft)', category: 'kitchen', width: 2.5, height: 2 },
  { itemType: 'Refrigerator', label: 'Refrigerator (2.5×2.5 ft)', category: 'kitchen', width: 2.5, height: 2.5 },
  { itemType: 'Kitchen Island', label: 'Kitchen Island (5×3 ft)', category: 'kitchen', width: 5, height: 3 },
  { itemType: 'Breakfast Counter', label: 'Breakfast Bar (5×1.8 ft)', category: 'kitchen', width: 5, height: 1.8 },

  // Bathroom & Sanitary
  { itemType: 'WC / Toilet', label: 'Commode / WC (2×2.5 ft)', category: 'bathroom', width: 2, height: 2.5 },
  { itemType: 'Indian Toilet', label: 'Squatting Pan / Orissa Pan (2×2.5 ft)', category: 'bathroom', width: 2, height: 2.5 },
  { itemType: 'Wash Basin', label: 'Wash Basin (2×1.5 ft)', category: 'bathroom', width: 2, height: 1.5 },
  { itemType: 'Bathroom Vanity', label: 'Vanity Counter (3×1.8 ft)', category: 'bathroom', width: 3, height: 1.8 },
  { itemType: 'Shower Cubicle', label: 'Shower Enclosure (3×3 ft)', category: 'bathroom', width: 3, height: 3 },
  { itemType: 'Bathtub', label: 'Bathtub (5×2.5 ft)', category: 'bathroom', width: 5, height: 2.5 },

  // Utility, Electrical, Structural & Outdoor
  { itemType: 'Washing Machine', label: 'Washing Machine (2×2 ft)', category: 'utility', width: 2, height: 2 },
  { itemType: 'Split AC', label: 'Split AC Indoor Unit (3×0.8 ft)', category: 'utility', width: 3, height: 0.8 },
  { itemType: 'Ceiling Fan', label: 'Ceiling Fan (3×3 ft)', category: 'utility', width: 3, height: 3 },
  { itemType: 'Distribution Board', label: 'Electrical DB Panel (2×0.8 ft)', category: 'utility', width: 2, height: 0.8 },
  { itemType: 'Column', label: 'Structural Pillar (1.5×1.5 ft)', category: 'structural', width: 1.5, height: 1.5 },
  { itemType: 'Plant', label: 'Indoor Planter (2×2 ft)', category: 'outdoor', width: 2, height: 2 },
  { itemType: 'Car Parking', label: 'Car Parking Bay (16×8 ft)', category: 'outdoor', width: 8, height: 16 },
];

export const simplifyFurnitureLabel = (itemType: string): string => {
  const map: Record<string, string> = {
    'Single Bed': 'Single Bed',
    'Double Bed': 'Double Bed',
    'Queen Bed': 'Queen Bed',
    'King Bed': 'King Bed',
    'Wardrobe': 'Wardrobe',
    'Dressing Table': 'Vanity Mirror',
    'Nightstand': 'Nightstand',
    '1-Seater Sofa': 'Sofa (1-Seat)',
    '2-Seater Sofa': 'Sofa (2-Seat)',
    '3-Seater Sofa': 'Sofa (3-Seat)',
    'L-shaped Sofa': 'L-Sofa',
    'Coffee Table': 'Coffee Table',
    'TV Unit': 'TV Console',
    'Bookshelf': 'Bookshelf',
    'Shoe Rack': 'Shoe Rack',
    'Dining Table 4': 'Dining (4P)',
    'Dining Table 6': 'Dining (6P)',
    'Dining Table 8': 'Dining (8P)',
    'Study Desk': 'Study Desk',
    'Office Chair': 'Desk Chair',
    'Kitchen Counter': 'Countertop',
    'Kitchen Sink': 'Sink',
    'Gas Stove / Cooktop': 'Gas Stove',
    'Refrigerator': 'Fridge',
    'Kitchen Island': 'Island',
    'Breakfast Counter': 'Breakfast Bar',
    'WC / Toilet': 'Commode / WC',
    'Indian Toilet': 'Orissa Pan',
    'Wash Basin': 'Wash Basin',
    'Bathroom Vanity': 'Vanity',
    'Shower Cubicle': 'Shower',
    'Bathtub': 'Bathtub',
    'Washing Machine': 'Washer',
    'Split AC': 'Split AC',
    'Ceiling Fan': 'Fan',
    'Distribution Board': 'DB Panel',
    'Column': 'Pillar',
    'Plant': 'Planter',
    'Car Parking': 'Car Bay',
  };
  return map[itemType] || itemType;
};

// First-use tips, one per tool.
export const TOOL_HINTS: Record<string, string> = {
  start: 'Pick Wall to begin. Sketch draws a whole room in one stroke; Straight draws one exact wall at a time.',
  select: 'Tap a wall to select it. Drag a round handle to resize it, or tap a red measurement to type an exact length.',
  wall: 'Drag to draw a straight wall, or tap its two ends. Switch to Sketch to draw a whole room in one go. Two fingers move and zoom.',
  ai_draw: 'Draw the room outline in one stroke. It is straightened and joined as you draw. Two fingers move and zoom.',
  door: 'Tap on a wall to place a door there.',
  window: 'Tap on a wall to place a window there.',
  room: 'Tap where the room should go. Closing a loop of walls also makes a room.',
  measure: 'Tap two points to measure the distance between them.',
  eraser: 'Tap a wall to erase only the part under your finger, up to the next joint.',
  split: 'Tap a wall where it should be cut. Each part can then be moved, sized or erased on its own.',
};

export function getLiveToolHint(tool: Tool): string {
  switch (tool) {
    case 'select':
      return 'Select Tool: Tap any wall, room, door, or item to move, resize, rotate, or delete.';
    case 'pan':
      return 'Pan Tool: Drag anywhere to move canvas. Hold Space or right-click drag anytime.';
    case 'wall':
      return 'Wall Tool: Click & drag to draw straight walls. Snaps at 90° and 45° automatically.';
    case 'ai_draw':
      return 'Sketch Tool: Draw a rough continuous outline. Auto-straightens and welds closed loops.';
    case 'eraser':
      return 'Eraser: tap a wall to erase only that part, up to the next joint. Tap a door, window or item to remove it.';
    case 'split':
      return 'Split: tap a wall where it should be cut into two walls.';
    case 'door':
      return 'Door Tool: Tap on any wall segment to place an architectural door.';
    case 'window':
      return 'Window Tool: Tap on any wall segment to place an architectural window.';
    case 'room':
      return 'Room Tool: Tap to place a room or close 4 walls to auto-generate an enclosed room.';
    case 'furniture':
      return 'Furniture Tool: Select items from library catalog and tap on canvas to place.';
    case 'column':
      return 'Column Tool: Tap anywhere on canvas to position a structural column/pillar.';
    case 'stairs':
      return 'Stairs Tool: Tap anywhere on canvas to place a staircase.';
    case 'measure':
      return 'Measure Tool: Tap two points on canvas to measure exact distance and angle.';
    case 'annotation':
      return 'Note Tool: Tap anywhere on canvas to place a custom text label or callout note.';
    default:
      return 'Click on canvas to draw or place elements.';
  }
}

export const HINTS_KEY = 'bm_fp_hints_seen';
