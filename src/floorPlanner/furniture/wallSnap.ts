import type { Point, Wall } from '../model'

export type SnapBox = { x: number; y: number; w: number; d: number; rotationDeg: number }

export type WallSnapResult = { x: number; y: number; wallIds: string[] }

const PARALLEL = Math.cos((2 * Math.PI) / 180)

/**
 * Pulls a furniture box flush against nearby wall faces.
 *
 * Only walls parallel to one of the box axes (±2°) are considered, and only
 * when the box actually overlaps the wall along its length. The nearest face
 * within `tol` wins; a second, roughly perpendicular wall is then applied too,
 * so items drop cleanly into room corners. Movement happens only along wall
 * normals, so the grid position along the wall is preserved.
 */
export function snapToWalls(walls: readonly Wall[], box: SnapBox, tol: number): WallSnapResult {
  const rad = (box.rotationDeg * Math.PI) / 180
  const ux = { x: Math.cos(rad), y: Math.sin(rad) }
  const vy = { x: -Math.sin(rad), y: Math.cos(rad) }
  const extent = (n: Point) => (Math.abs(n.x * ux.x + n.y * ux.y) * box.w) / 2 + (Math.abs(n.x * vy.x + n.y * vy.y) * box.d) / 2

  type Cand = { n: Point; gap: number; id: string }
  const cands: Cand[] = []
  for (const wall of walls) {
    const dx = wall.b.x - wall.a.x
    const dy = wall.b.y - wall.a.y
    const len = Math.hypot(dx, dy)
    if (len < 1) continue
    const dir = { x: dx / len, y: dy / len }
    const n = { x: -dir.y, y: dir.x }
    const align = Math.max(Math.abs(n.x * ux.x + n.y * ux.y), Math.abs(n.x * vy.x + n.y * vy.y))
    if (align < PARALLEL) continue
    const rx = box.x - wall.a.x
    const ry = box.y - wall.a.y
    const along = rx * dir.x + ry * dir.y
    const half = extent(dir)
    if (along + half <= 0 || along - half >= len) continue
    const s = rx * n.x + ry * n.y
    const side = s < 0 ? -1 : 1
    const gap = s - side * (wall.thickness / 2 + extent(n))
    if (Math.abs(gap) > tol) continue
    cands.push({ n, gap, id: wall.id })
  }
  if (cands.length === 0) return { x: box.x, y: box.y, wallIds: [] }
  cands.sort((a, b) => Math.abs(a.gap) - Math.abs(b.gap))
  const first = cands[0]
  let x = box.x - first.gap * first.n.x
  let y = box.y - first.gap * first.n.y
  const wallIds = [first.id]
  const second = cands.find((c) => Math.abs(c.n.x * first.n.x + c.n.y * first.n.y) < 0.5)
  if (second) {
    x -= second.gap * second.n.x
    y -= second.gap * second.n.y
    wallIds.push(second.id)
  }
  return { x, y, wallIds }
}
