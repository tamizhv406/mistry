import { t } from '../i18n'

export type FurnitureCategory = 'bedroom' | 'living' | 'kitchen' | 'bathroom' | 'hall' | 'structure' | 'outdoor' | 'other'

export const FURNITURE_CATEGORIES: { id: FurnitureCategory; name: string }[] = (
  ['bedroom', 'living', 'kitchen', 'bathroom', 'hall', 'structure', 'outdoor', 'other'] as const
).map((id) => ({
  id,
  get name() {
    return t(`plan:furniture.categories.${id}`)
  },
}))

export type FurnitureItem = {
  id: string
  type: string
  x: number
  y: number
  rotationDeg: number
  w?: number
  d?: number
  h?: number
  color?: string
}

export type Clearance = { front?: number; side?: number }

/** Size preset shown as a pill in the inspector. */
export type SizePreset = { label: string; w: number; d: number; h?: number }

export type FurnitureDef = {
  type: string
  name: string
  category: FurnitureCategory
  w: number
  d: number
  h: number
  elevation?: number
  resizable: boolean
  /** Round / radial symbols: canvas resize always keeps the W:D ratio. */
  lockAspect?: boolean
  clearance?: Clearance
  presets?: SizePreset[]
  /** Draw order on the plan: 0 under everything (rugs), 1 default, 2 above (canopies, ceiling items). */
  layer?: number
  note?: string
}

const def = (
  type: string,
  category: FurnitureCategory,
  [w, d, h]: [number, number, number],
  extra: Partial<Pick<FurnitureDef, 'resizable' | 'lockAspect' | 'clearance' | 'presets' | 'layer' | 'elevation' | 'note'>> = {},
): FurnitureDef => ({
  type,
  get name() {
    return t(`plan:furniture.items.${type}`)
  },
  category,
  w,
  d,
  h,
  resizable: false,
  ...extra,
})

const SOFA_PRESETS: SizePreset[] = [
  { label: '2-seat 160', w: 1600, d: 900 },
  { label: '3-seat 220', w: 2200, d: 950 },
  { label: '4-seat 280', w: 2800, d: 950 },
]

export const FURNITURE_CATALOG: FurnitureDef[] = [
  def('bed-1600', 'bedroom', [1700, 2100, 1000], { clearance: { front: 600, side: 600 } }),
  def('bed-1800', 'bedroom', [1900, 2100, 1000], { clearance: { front: 600, side: 600 } }),
  def('bed-900', 'bedroom', [1000, 2100, 900], { clearance: { side: 600 } }),
  def('nightstand', 'bedroom', [450, 400, 550]),
  def('bed-round', 'bedroom', [2200, 2200, 900], {
    resizable: true,
    lockAspect: true,
    clearance: { front: 600 },
    presets: [{ label: 'Ø2000', w: 2000, d: 2000 }, { label: 'Ø2200', w: 2200, d: 2200 }, { label: 'Ø2400', w: 2400, d: 2400 }],
  }),
  def('bedside-lamp', 'bedroom', [300, 300, 550], { resizable: true, lockAspect: true }),
  def('wardrobe', 'bedroom', [1200, 600, 2200], { resizable: true, clearance: { front: 800 } }),
  def('dresser', 'bedroom', [1000, 450, 850], { resizable: true, clearance: { front: 700 } }),
  def('closet-built-in', 'bedroom', [2400, 650, 2600], { resizable: true, clearance: { front: 900 } }),
  def('dressing-table', 'bedroom', [1000, 450, 760], { resizable: true, clearance: { front: 700 } }),

  def('sofa-2', 'living', [1600, 900, 850], { resizable: true, clearance: { front: 600 }, presets: SOFA_PRESETS }),
  def('sofa', 'living', [2200, 950, 850], { resizable: true, clearance: { front: 600 }, presets: SOFA_PRESETS }),
  def('sofa-corner', 'living', [2700, 1650, 850], { resizable: true, clearance: { front: 600 } }),
  def('armchair', 'living', [850, 850, 850], { resizable: true, clearance: { front: 450 } }),
  def('coffee-table', 'living', [1100, 600, 450], { resizable: true }),
  def('coffee-table-round', 'living', [800, 800, 450], { resizable: true, lockAspect: true }),
  def('side-table', 'living', [500, 500, 550], { resizable: true, lockAspect: true }),
  def('rug', 'living', [2300, 1600, 10], {
    resizable: true,
    presets: [{ label: '160×230', w: 2300, d: 1600 }, { label: '200×300', w: 3000, d: 2000 }, { label: '250×350', w: 3500, d: 2500 }],
    layer: 0,
  }),
  def('rug-round', 'living', [1600, 1600, 10], { resizable: true, lockAspect: true, layer: 0 }),
  def('tv-stand', 'living', [1600, 420, 1300], { resizable: true }),
  def('media-console', 'living', [2200, 450, 500], { resizable: true, clearance: { front: 600 } }),
  def('floor-lamp', 'living', [400, 400, 1600], { resizable: true, lockAspect: true }),
  def('bookcase', 'living', [800, 350, 2000], { resizable: true, clearance: { front: 600 } }),
  def('plant', 'living', [450, 450, 1200], { resizable: true, lockAspect: true }),

  def('kitchen-l', 'kitchen', [2700, 2100, 900], {
    resizable: true,
    clearance: { front: 1000 },
    presets: [{ label: '2400×1800', w: 2400, d: 1800 }, { label: '2700×2100', w: 2700, d: 2100 }, { label: '3300×2400', w: 3300, d: 2400 }],
  }),
  def('kitchen-island', 'kitchen', [1800, 900, 900], { resizable: true, clearance: { front: 1000, side: 900 } }),
  def('bar-counter', 'kitchen', [1800, 950, 1050], { resizable: true, clearance: { side: 300 } }),
  def('bar-stool', 'kitchen', [400, 400, 750], { resizable: true, lockAspect: true }),
  def('kitchen-base', 'kitchen', [600, 600, 900], { resizable: true, clearance: { front: 1000 } }),
  def('kitchen-drawers', 'kitchen', [600, 600, 900], { resizable: true, clearance: { front: 1000 } }),
  def('kitchen-corner', 'kitchen', [900, 900, 900], { clearance: { front: 1000 } }),
  def('kitchen-upper', 'kitchen', [600, 330, 720], { resizable: true, elevation: 1450 }),
  def('kitchen-sink', 'kitchen', [800, 600, 900], { resizable: true, clearance: { front: 1000 } }),
  def('stove', 'kitchen', [600, 600, 900], { clearance: { front: 1000 } }),
  def('dishwasher', 'kitchen', [600, 600, 900], { clearance: { front: 1000 } }),
  def('fridge', 'kitchen', [600, 650, 2000], { clearance: { front: 1000 } }),
  def('dining-4', 'kitchen', [1200, 1600, 750], { resizable: true, clearance: { side: 300 } }),
  def('dining-6', 'kitchen', [1800, 1700, 750], { resizable: true, clearance: { side: 300 } }),
  def('dining-round', 'kitchen', [1800, 1800, 750], { resizable: true, lockAspect: true }),
  def('dining-square', 'kitchen', [1700, 1700, 750], { resizable: true, clearance: { side: 300 } }),
  def('chair', 'kitchen', [450, 520, 900]),

  def('toilet', 'bathroom', [380, 680, 780], { clearance: { front: 600, side: 200 } }),
  def('washbasin', 'bathroom', [600, 460, 850], { clearance: { front: 700 } }),
  def('vanity', 'bathroom', [800, 480, 850], { resizable: true, clearance: { front: 700 } }),
  def('bathtub', 'bathroom', [1700, 750, 600], { resizable: true, clearance: { front: 700 } }),
  def('bathtub-corner', 'bathroom', [1400, 1400, 600], { resizable: true, lockAspect: true, clearance: { front: 700 } }),
  def('jacuzzi', 'bathroom', [2000, 2000, 800], { resizable: true, lockAspect: true, clearance: { front: 700 } }),
  def('bathroom-counter', 'bathroom', [1400, 550, 850], { resizable: true, clearance: { front: 700 } }),
  def('shower', 'bathroom', [900, 900, 2000], { resizable: true, clearance: { front: 700 } }),
  def('washer', 'bathroom', [600, 600, 850], { clearance: { front: 800 } }),
  def('water-heater', 'bathroom', [450, 470, 800], { elevation: 1100 }),

  def('coat-rack', 'hall', [1000, 350, 1800], { resizable: true, clearance: { front: 600 } }),
  def('shoe-cabinet', 'hall', [800, 320, 1000], { resizable: true, clearance: { front: 600 } }),
  def('hall-wardrobe', 'hall', [1600, 600, 2400], { resizable: true, clearance: { front: 700 } }),

  def('stairs', 'structure', [1000, 3360, 2800], { resizable: true, clearance: { front: 900 } }),
  def('stairs-l', 'structure', [2000, 2900, 2800], { resizable: true, clearance: { front: 900 } }),
  def('stairs-u', 'structure', [2200, 2600, 2800], { resizable: true, clearance: { front: 900 } }),
  def('pillar', 'structure', [400, 400, 2800], { resizable: true }),
  def('pillar-round', 'structure', [350, 350, 2800], { resizable: true, lockAspect: true }),
  def('divider', 'structure', [1200, 80, 2000], { resizable: true }),

  def('car', 'outdoor', [1850, 4600, 1500], {
    resizable: true,
    clearance: { side: 700 },
    presets: [{ label: 'Compact', w: 1750, d: 4100 }, { label: 'Sedan', w: 1850, d: 4700 }, { label: 'SUV', w: 1950, d: 4900, h: 1750 }],
  }),
  def('tree', 'outdoor', [2500, 2500, 5000], { resizable: true, lockAspect: true, layer: 2 }),
  def('shrub', 'outdoor', [900, 900, 900], { resizable: true, lockAspect: true }),

  def('ceiling-fan', 'other', [1300, 1300, 300], { resizable: true, lockAspect: true, elevation: 2400, layer: 2 }),
  def('desk', 'other', [1200, 600, 750], { resizable: true, clearance: { front: 800 } }),
  def('office-chair', 'other', [650, 650, 1050]),
  def('fireplace', 'other', [1000, 550, 1100], { clearance: { front: 1000 } }),
  def('masonry-stove', 'other', [1150, 900, 2000], { resizable: true, clearance: { front: 1250, side: 380 } }),
  def('gas-boiler', 'other', [440, 340, 740], { elevation: 1000, clearance: { front: 700 } }),
  def('floor-boiler', 'other', [500, 650, 900], { clearance: { front: 1000, side: 400 } }),
]

export const FURNITURE_BY_TYPE: Record<string, FurnitureDef> = Object.fromEntries(
  FURNITURE_CATALOG.map((d) => [d.type, d]),
)

export function furnitureDef(type: string): FurnitureDef | undefined {
  return FURNITURE_BY_TYPE[type]
}

export type ResolvedFurniture = { def: FurnitureDef | undefined; w: number; d: number; h: number; elevation: number }

export function resolveFurniture(item: Pick<FurnitureItem, 'type' | 'w' | 'd' | 'h'>): ResolvedFurniture {
  const d = furnitureDef(item.type)
  return {
    def: d,
    w: item.w ?? d?.w ?? 600,
    d: item.d ?? d?.d ?? 600,
    h: item.h ?? d?.h ?? 900,
    elevation: d?.elevation ?? 0,
  }
}

export function furnitureLayer(type: string): number {
  return furnitureDef(type)?.layer ?? 1
}

export function createFurniture(type: string, x: number, y: number, id: string, rotationDeg = 0): FurnitureItem {
  return { id, type, x, y, rotationDeg }
}
