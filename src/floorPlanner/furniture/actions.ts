import { addFurniture, snapOffset, type Furniture, type Plan, type Point } from '../model'
import { resolveFurniture } from './catalog'
import type { RoomTemplate } from './templates'

type Box = { x0: number; y0: number; x1: number; y1: number }

/** Axis-aligned bounds of a (possibly rotated) furniture item. */
export function itemBounds(f: Pick<Furniture, 'type' | 'x' | 'y' | 'rotationDeg' | 'w' | 'd'>): Box {
  const { w, d } = resolveFurniture(f)
  const rad = ((f.rotationDeg ?? 0) * Math.PI) / 180
  const c = Math.abs(Math.cos(rad))
  const s = Math.abs(Math.sin(rad))
  const hx = (c * w + s * d) / 2
  const hy = (s * w + c * d) / 2
  return { x0: f.x - hx, y0: f.y - hy, x1: f.x + hx, y1: f.y + hy }
}

function unionBounds(boxes: Box[]): Box {
  return boxes.reduce((a, b) => ({ x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) }))
}

const copyOf = (f: Furniture, x: number, y: number) => {
  const { type, rotationDeg, w, d, h, color } = f
  return { type, x: Math.round(x), y: Math.round(y), rotationDeg, ...(w !== undefined && { w }), ...(d !== undefined && { d }), ...(h !== undefined && { h }), ...(color !== undefined && { color }) }
}

/**
 * Copies furniture items next to the originals.
 * One item: placed beside it along its own width axis, so repeated Ctrl+D lays
 * out a row (chairs, columns, cabinets). Several items: the whole set is
 * shifted right by the width of its bounds, keeping their arrangement.
 */
export function duplicateFurniture(plan: Plan, ids: readonly string[]): { plan: Plan; ids: string[] } {
  const items = plan.furniture.filter((f) => ids.includes(f.id))
  if (items.length === 0) return { plan, ids: [] }
  let dx: number
  let dy: number
  if (items.length === 1) {
    const f = items[0]
    const { w } = resolveFurniture(f)
    const rad = ((f.rotationDeg ?? 0) * Math.PI) / 180
    dx = Math.cos(rad) * w
    dy = Math.sin(rad) * w
  } else {
    const b = unionBounds(items.map(itemBounds))
    dx = b.x1 - b.x0
    dy = 0
  }
  let next = plan
  const out: string[] = []
  for (const f of items) {
    const res = addFurniture(next, copyOf(f, f.x + dx, f.y + dy))
    next = res.plan
    out.push(res.id)
  }
  return { plan: next, ids: out }
}

/** Template items laid out relative to their origin, as plan furniture minus ids. */
function templateItems(t: RoomTemplate) {
  return t.items.map((i) => ({ type: i.type, x: i.x, y: i.y, rotationDeg: i.rotationDeg ?? 0, ...(i.w !== undefined && { w: i.w }), ...(i.d !== undefined && { d: i.d }) }))
}

/** Size of a template's footprint in mm (for previews and labels). */
export function templateBounds(t: RoomTemplate): Box {
  return unionBounds(templateItems(t).map(itemBounds))
}

/** Places a whole room set centred on `at` (grid-snapped); returns the new ids. */
export function placeTemplate(plan: Plan, t: RoomTemplate, at: Point): { plan: Plan; ids: string[] } {
  const items = templateItems(t)
  const b = unionBounds(items.map(itemBounds))
  const ox = snapOffset(at.x - (b.x0 + b.x1) / 2)
  const oy = snapOffset(at.y - (b.y0 + b.y1) / 2)
  let next = plan
  const ids: string[] = []
  for (const i of items) {
    const res = addFurniture(next, { ...i, x: i.x + ox, y: i.y + oy })
    next = res.plan
    ids.push(res.id)
  }
  return { plan: next, ids }
}
