import { t } from '../i18n'

/**
 * Ready-made room sets. Coordinates are item centres in mm, relative to the
 * set's own origin; y grows down and the main wall is at the top (y = 0), so
 * items with rotation 0 have their back against it. Rotation: 90 → back to the
 * right, 180 → back down, 270 → back to the left. Gaps follow common
 * clearances (≥ 600 mm beside beds, ~900 mm in front of wardrobes, ~1000 mm
 * kitchen aisle).
 */
export type TemplateItem = { type: string; x: number; y: number; rotationDeg?: number; w?: number; d?: number }
export type RoomTemplate = { id: string; readonly name: string; items: TemplateItem[] }

const tpl = (id: string, items: TemplateItem[]): RoomTemplate => ({
  id,
  get name() {
    return t(`plan:furniture.templates.${id}`)
  },
  items,
})

export const ROOM_TEMPLATES: RoomTemplate[] = [
  tpl('bedroom', [
    { type: 'rug', x: 0, y: 1750, w: 2300, d: 1600 },
    { type: 'bed-1600', x: 0, y: 1050 },
    { type: 'nightstand', x: -1125, y: 200 },
    { type: 'nightstand', x: 1125, y: 200 },
    { type: 'bedside-lamp', x: -1125, y: 200 },
    { type: 'bedside-lamp', x: 1125, y: 200 },
    { type: 'wardrobe', x: 0, y: 3300, rotationDeg: 180, w: 1800 },
  ]),
  tpl('living', [
    { type: 'rug', x: 0, y: 1650, w: 2300, d: 1600 },
    { type: 'sofa', x: 0, y: 475 },
    { type: 'coffee-table', x: 0, y: 1650 },
    { type: 'armchair', x: -1700, y: 1650, rotationDeg: 270 },
    { type: 'armchair', x: 1700, y: 1650, rotationDeg: 90 },
    { type: 'tv-stand', x: 0, y: 3650, rotationDeg: 180 },
    { type: 'plant', x: -1450, y: 275 },
    { type: 'floor-lamp', x: 1450, y: 250 },
  ]),
  tpl('dining', [
    { type: 'dining-6', x: 0, y: 0 },
    { type: 'dresser', x: 0, y: -1975, w: 1600 },
    { type: 'plant', x: 1075, y: -1975 },
  ]),
  tpl('kitchen', [
    { type: 'kitchen-l', x: 1350, y: 1050 },
    { type: 'fridge', x: 3000, y: 325 },
    { type: 'kitchen-island', x: 2500, y: 2050 },
    { type: 'bar-stool', x: 1900, y: 2750 },
    { type: 'bar-stool', x: 2500, y: 2750 },
    { type: 'bar-stool', x: 3100, y: 2750 },
  ]),
  tpl('bathroom', [
    { type: 'bathtub', x: 850, y: 375 },
    { type: 'toilet', x: 2100, y: 340 },
    { type: 'vanity', x: 500, y: 2160, rotationDeg: 180 },
    { type: 'washer', x: 1700, y: 2100, rotationDeg: 180 },
  ]),
  tpl('office', [
    { type: 'desk', x: 0, y: 350, w: 1400, d: 700 },
    { type: 'office-chair', x: 0, y: 1050, rotationDeg: 180 },
    { type: 'bookcase', x: 1150, y: 175 },
    { type: 'plant', x: -1000, y: 225 },
  ]),
]

export function roomTemplate(id: string): RoomTemplate | undefined {
  return ROOM_TEMPLATES.find((x) => x.id === id)
}
