import { furnitureLayer, resolveFurniture } from '../furniture/catalog'
import { deleteZone, distanceToSegment, nextId, type Plan, type Point, type Wall } from '../model'
import { pointInPolygon } from '../stats/rooms'
import { deletePlan, emptySel } from './selection/model'

export type EraseKind = 'furniture' | 'openings' | 'walls' | 'zones'
/** For walls, `span` is the part that will go, as [from, to] in mm along the wall from `a`. */
export type EraseTarget = { kind: EraseKind; id: string; span?: [number, number] }

const sameTarget = (a: EraseTarget | null, b: EraseTarget | null) =>
  a?.kind === b?.kind && a?.id === b?.id && a?.span?.[0] === b?.span?.[0] && a?.span?.[1] === b?.span?.[1]
export { sameTarget }

/**
 * Points (mm along `wall` from `a`) where other walls cross it or join it in
 * the middle (T-junctions), plus both ends. Erasing removes only the stretch
 * between two neighbouring points, so a wall that overshoots a corner loses
 * just the overshoot, not the whole line.
 */
export function wallCuts(walls: readonly Wall[], wall: Wall): number[] {
  const dx = wall.b.x - wall.a.x
  const dy = wall.b.y - wall.a.y
  const len = Math.hypot(dx, dy)
  const cuts = [0, len]
  if (len < 1) return cuts
  for (const o of walls) {
    if (o.id === wall.id) continue
    const ex = o.b.x - o.a.x
    const ey = o.b.y - o.a.y
    const den = dx * ey - dy * ex
    if (Math.abs(den) < 1e-9) continue // parallel
    const fx = o.a.x - wall.a.x
    const fy = o.a.y - wall.a.y
    const t = (fx * ey - fy * ex) / den // along this wall, 0..1
    const u = (fx * dy - fy * dx) / den // along the other wall, 0..1
    const olen = Math.hypot(ex, ey) || 1
    if (u < -1 / olen || u > 1 + 1 / olen) continue
    const at = t * len
    if (at > 1 && at < len - 1) cuts.push(at)
  }
  cuts.sort((x, y) => x - y)
  return cuts.filter((c, i) => i === 0 || c - cuts[i - 1] > 1)
}

function wallSpanAt(walls: readonly Wall[], wall: Wall, p: Point): [number, number] {
  const len = Math.hypot(wall.b.x - wall.a.x, wall.b.y - wall.a.y) || 1
  const along = Math.min(len, Math.max(0, ((p.x - wall.a.x) * (wall.b.x - wall.a.x) + (p.y - wall.a.y) * (wall.b.y - wall.a.y)) / len))
  const cuts = wallCuts(walls, wall)
  for (let i = 0; i < cuts.length - 1; i++) if (along >= cuts[i] && along <= cuts[i + 1]) return [cuts[i], cuts[i + 1]]
  return [0, len]
}

/**
 * What the eraser would delete at world point `p`. Topmost first: furniture
 * (by draw layer, later items above earlier), then doors/windows, walls, and
 * site zones. `tol` widens hit areas (mm) so thin items are easy to tap.
 * Locked layers and locked zones are skipped.
 */
export function eraseTargetAt(plan: Plan, p: Point, tol: number, locked: Partial<Record<'walls' | 'furniture' | 'zones', boolean>>): EraseTarget | null {
  if (!locked.furniture) {
    const order = plan.furniture.map((f, i) => ({ f, i })).sort((a, b) => furnitureLayer(b.f.type) - furnitureLayer(a.f.type) || b.i - a.i)
    for (const { f } of order) {
      const { w, d } = resolveFurniture(f)
      const rad = (-(f.rotationDeg ?? 0) * Math.PI) / 180
      const dx = p.x - f.x
      const dy = p.y - f.y
      const u = dx * Math.cos(rad) - dy * Math.sin(rad)
      const v = dx * Math.sin(rad) + dy * Math.cos(rad)
      if (Math.abs(u) <= w / 2 + tol && Math.abs(v) <= d / 2 + tol) return { kind: 'furniture', id: f.id }
    }
  }
  if (!locked.walls) {
    for (const o of plan.openings) {
      const wall = plan.walls.find((x) => x.id === o.wallId)
      if (!wall) continue
      const len = Math.hypot(wall.b.x - wall.a.x, wall.b.y - wall.a.y)
      if (len < 1) continue
      const ux = (wall.b.x - wall.a.x) / len
      const uy = (wall.b.y - wall.a.y) / len
      const along = (p.x - wall.a.x) * ux + (p.y - wall.a.y) * uy
      const across = Math.abs(-(p.x - wall.a.x) * uy + (p.y - wall.a.y) * ux)
      if (along >= o.offset - tol && along <= o.offset + o.width + tol && across <= wall.thickness / 2 + tol) return { kind: 'openings', id: o.id }
    }
    for (const wall of plan.walls) {
      if (distanceToSegment(p, wall.a, wall.b) <= wall.thickness / 2 + tol) return { kind: 'walls', id: wall.id, span: wallSpanAt(plan.walls, wall, p) }
    }
  }
  if (!locked.zones) {
    const zones = plan.site.zones ?? []
    for (let i = zones.length - 1; i >= 0; i--) {
      const z = zones[i]
      if (!z.locked && z.polygon.length >= 3 && pointInPolygon(p, z.polygon)) return { kind: 'zones', id: z.id }
    }
  }
  return null
}

/**
 * Plan without the target. For a wall only `span` goes: the remaining pieces
 * stay as walls (the first keeps the id), doors and windows move with their
 * piece, and the ones inside the erased stretch are removed. A wall with no
 * cuts is deleted whole, together with its doors and windows.
 */
export function eraseTarget(plan: Plan, t: EraseTarget): Plan {
  if (t.kind === 'zones') return deleteZone(plan, t.id)
  const wall = t.kind === 'walls' ? plan.walls.find((w) => w.id === t.id) : undefined
  if (!wall || !t.span) return deletePlan(plan, { ...emptySel(), [t.kind]: [t.id] })
  const len = Math.hypot(wall.b.x - wall.a.x, wall.b.y - wall.a.y)
  const [s0, s1] = t.span
  const keepLeft = s0 > 1
  const keepRight = s1 < len - 1
  if (!keepLeft && !keepRight) return deletePlan(plan, { ...emptySel(), walls: [wall.id] })
  const at = (d: number): Point => ({ x: wall.a.x + ((wall.b.x - wall.a.x) * d) / len, y: wall.a.y + ((wall.b.y - wall.a.y) * d) / len })
  const pieces: Wall[] = []
  const leftId = keepLeft ? wall.id : undefined
  const rightId = keepRight ? (keepLeft ? nextId('w', plan.walls) : wall.id) : undefined
  if (leftId) pieces.push({ ...wall, id: leftId, b: at(s0) })
  if (rightId) pieces.push({ ...wall, id: rightId, a: at(s1) })
  const walls = plan.walls.flatMap((w) => (w.id === wall.id ? pieces : [w]))
  const openings = plan.openings.flatMap((o) => {
    if (o.wallId !== wall.id) return [o]
    if (leftId && o.offset + o.width <= s0) return [o]
    if (rightId && o.offset >= s1) return [{ ...o, wallId: rightId, offset: o.offset - s1 }]
    return []
  })
  return { ...plan, walls, openings }
}
