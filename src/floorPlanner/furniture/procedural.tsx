import { RoundedBox } from '@react-three/drei'
import { useEffect, useMemo, type ReactNode } from 'react'
import * as THREE from 'three'
import { finishMaterial, type Finish, type FurnitureLook } from './materials3d'

const M = 0.001

type Paint = { look: FurnitureLook; color?: string; primary: Finish[] }
type V3 = [number, number, number]

const PROCEDURAL = new Set([
  'wardrobe',
  'hall-wardrobe',
  'dresser',
  'dishwasher',
  'water-heater',
  'shoe-cabinet',
  'fireplace',
  'masonry-stove',
  'gas-boiler',
  'floor-boiler',
  'bookcase',
  'table-round',
  'generic',
  'bed-round',
  'bedside-lamp',
  'floor-lamp',
  'closet-built-in',
  'dressing-table',
  'coffee-table-round',
  'side-table',
  'rug',
  'rug-round',
  'kitchen-l',
  'kitchen-island',
  'bar-counter',
  'bar-stool',
  'bathtub-corner',
  'jacuzzi',
  'stairs',
  'stairs-l',
  'stairs-u',
  'pillar',
  'pillar-round',
  'divider',
  'car',
  'tree',
  'shrub',
  'ceiling-fan',
])

export function hasProcedural(type: string) {
  return PROCEDURAL.has(type)
}

function mat(paint: Paint, f: Finish) {
  return finishMaterial(f, paint.look, paint.primary.includes(f) ? paint.color : undefined)
}

function Box({ p, s, f, r = 0, paint }: { p: V3; s: V3; f: Finish; r?: number; paint: Paint }) {
  const size = s.map((v) => Math.max(v, 0.5) * M) as V3
  const pos = p.map((v) => v * M) as V3
  const radius = Math.min(r, ...s.map((v) => v / 2 - 0.5)) * M
  if (radius <= 0.0005) {
    return (
      <mesh position={pos} material={mat(paint, f)} castShadow receiveShadow>
        <boxGeometry args={size} />
      </mesh>
    )
  }
  return <RoundedBox args={size} radius={radius} smoothness={3} position={pos} material={mat(paint, f)} castShadow receiveShadow />
}

function Cyl({ p, r, r2, h, f, paint, rot, seg = 32 }: { p: V3; r: number; r2?: number; h: number; f: Finish; paint: Paint; rot?: V3; seg?: number }) {
  return (
    <mesh position={p.map((v) => v * M) as V3} rotation={rot} material={mat(paint, f)} castShadow receiveShadow>
      <cylinderGeometry args={[(r2 ?? r) * M, r * M, h * M, seg]} />
    </mesh>
  )
}

function Handle({ x, y, z, len, vertical, paint }: { x: number; y: number; z: number; len: number; vertical?: boolean; paint: Paint }) {
  return <Box p={[x, y, z + 12]} s={vertical ? [12, len, 14] : [len, 12, 14]} r={5} f="metalMedium" paint={paint} />
}

type P = { w: number; d: number; h: number; paint: Paint }

function Wardrobe({ w, d, h, paint }: P) {
  const plinth = 80
  const doors = Math.max(1, Math.round(w / 500))
  const dw = w / doors
  const items: ReactNode[] = [
    <Box key="c" p={[0, h / 2, -10]} s={[w, h, d - 20]} r={6} f="wood" paint={paint} />,
    <Box key="p" p={[0, plinth / 2, d / 2 - 60]} s={[w - 40, plinth, 20]} f="woodDark" paint={paint} />,
  ]
  for (let i = 0; i < doors; i++) {
    const x = -w / 2 + dw * (i + 0.5)
    items.push(<Box key={`d${i}`} p={[x, plinth + (h - plinth) / 2, d / 2 - 10]} s={[dw - 4, h - plinth - 6, 20]} r={4} f="wood" paint={paint} />)
    const hx = x + (i % 2 ? -1 : 1) * (dw / 2 - 45)
    items.push(<Handle key={`h${i}`} x={hx} y={h * 0.5} z={d / 2} len={260} vertical paint={paint} />)
  }
  return <>{items}</>
}

function HallWardrobe({ w, d, h, paint }: P) {
  const pw = w / 2 + 40
  return (
    <>
      <Box p={[0, h / 2, -20]} s={[w, h, d - 40]} r={6} f="wood" paint={paint} />
      <Box p={[0, 40, d / 2 - 50]} s={[w - 20, 80, 20]} f="woodDark" paint={paint} />
      <Box p={[0, h - 25, d / 2 - 20]} s={[w, 50, 40]} f="metalMedium" paint={paint} />
      <Box p={[-w / 2 + pw / 2, h / 2 + 20, d / 2 - 38]} s={[pw, h - 90, 18]} r={3} f="wood" paint={paint} />
      <Box p={[w / 2 - pw / 2, h / 2 + 20, d / 2 - 14]} s={[pw, h - 90, 18]} r={3} f="glass" paint={paint} />
      <Box p={[w / 2 - pw / 2, h / 2 + 20, d / 2 - 22]} s={[pw - 60, h - 150, 4]} f="metalLight" paint={paint} />
    </>
  )
}

function Drawers({ w, d, h, paint, rows, legs }: P & { rows: number; legs: number }) {
  const cols = Math.max(1, Math.round(w / 500))
  const top = 25
  const bodyH = h - legs
  const fh = (bodyH - top - 30) / rows
  const cw = (w - 30) / cols
  const items: ReactNode[] = [
    <Box key="c" p={[0, legs + bodyH / 2, -10]} s={[w, bodyH, d - 20]} r={8} f="wood" paint={paint} />,
    <Box key="t" p={[0, h - top / 2, 0]} s={[w + 10, top, d + 10]} r={6} f="wood" paint={paint} />,
  ]
  if (legs > 0) {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) items.push(<Box key={`l${sx}${sz}`} p={[sx * (w / 2 - 50), legs / 2, sz * (d / 2 - 50)]} s={[30, legs, 30]} r={6} f="woodDark" paint={paint} />)
  }
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = -w / 2 + 15 + cw * (c + 0.5)
      const y = legs + 15 + fh * (r + 0.5)
      items.push(<Box key={`f${r}${c}`} p={[x, y, d / 2 - 8]} s={[cw - 6, fh - 6, 18]} r={4} f="wood" paint={paint} />)
      items.push(<Handle key={`h${r}${c}`} x={x} y={y + fh * 0.2} z={d / 2} len={Math.min(160, cw * 0.4)} paint={paint} />)
    }
  }
  return <>{items}</>
}

function ShoeCabinet({ w, d, h, paint }: P) {
  const cols = Math.max(1, Math.round(w / 450))
  const cw = w / cols
  const fh = (h - 80) / 2
  const items: ReactNode[] = [
    <Box key="c" p={[0, h / 2, -10]} s={[w, h, d - 20]} r={6} f="plaster" paint={paint} />,
    <Box key="t" p={[0, h - 12, 0]} s={[w + 10, 24, d + 10]} r={5} f="wood" paint={paint} />,
  ]
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < cols; c++) {
      const x = -w / 2 + cw * (c + 0.5)
      const y = 60 + fh * (r + 0.5)
      items.push(<Box key={`f${r}${c}`} p={[x, y, d / 2 - 6]} s={[cw - 6, fh - 6, 16]} r={4} f="plaster" paint={paint} />)
      items.push(<Handle key={`h${r}${c}`} x={x} y={y + fh / 2 - 40} z={d / 2} len={Math.min(140, cw * 0.4)} paint={paint} />)
    }
  }
  return <>{items}</>
}

function Dishwasher({ w, d, h, paint }: P) {
  const top = 38
  return (
    <>
      <Box p={[0, (h - top) / 2, -10]} s={[w - 4, h - top, d - 20]} r={4} f="metalLight" paint={paint} />
      <Box p={[0, h - top / 2, 10]} s={[w, top, d + 20]} r={4} f="stone" paint={paint} />
      <Box p={[0, 50, d / 2 - 40]} s={[w - 10, 100, 20]} f="woodDark" paint={paint} />
      <Box p={[0, (h - top + 100) / 2, d / 2 - 8]} s={[w - 8, h - top - 110, 16]} r={4} f="metalLight" paint={paint} />
      <Box p={[0, h - top - 45, d / 2 + 2]} s={[w - 8, 70, 6]} r={3} f="metalDark" paint={paint} />
      <Handle x={0} y={h - top - 120} z={d / 2} len={w * 0.6} paint={paint} />
    </>
  )
}

function WaterHeater({ w, d, h, paint }: P) {
  const r = Math.min(w, d) / 2
  const cz = d / 2 - r
  return (
    <>
      <Cyl p={[0, h / 2, cz]} r={r} h={h - r * 0.5} f="metalLight" paint={paint} />
      <mesh position={[0, (h - r * 0.25) * M, cz * M]} scale={[1, 0.25, 1]} material={mat(paint, 'metalLight')} castShadow>
        <sphereGeometry args={[r * M, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>
      <mesh position={[0, r * 0.25 * M, cz * M]} scale={[1, 0.25, 1]} rotation={[Math.PI, 0, 0]} material={mat(paint, 'metalLight')} castShadow>
        <sphereGeometry args={[r * M, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>
      <Box p={[0, h * 0.35, cz + r - 5]} s={[r * 0.6, r * 0.35, 16]} r={6} f="metalDark" paint={paint} />
      <Cyl p={[-r * 0.3, -60, cz]} r={12} h={140} f="metal" paint={paint} />
      <Cyl p={[r * 0.3, -60, cz]} r={12} h={140} f="metal" paint={paint} />
      <Box p={[0, h * 0.75, -d / 2 + 10]} s={[r * 1.1, 60, 20]} f="metalMedium" paint={paint} />
    </>
  )
}

function GasBoiler({ w, d, h, paint }: P) {
  return (
    <>
      <Box p={[0, h / 2, 0]} s={[w, h, d]} r={30} f="white" paint={paint} />
      <Box p={[0, 70, d / 2 - 4]} s={[w - 40, 90, 14]} r={10} f="metalDark" paint={paint} />
      <Box p={[-w * 0.2, 70, d / 2 + 4]} s={[w * 0.25, 40, 4]} r={2} f="screen" paint={paint} />
      <Cyl p={[0, h + 90, -d / 2 + 120]} r={50} h={180} f="metal" paint={paint} />
      {[-0.3, -0.1, 0.1, 0.3].map((x) => (
        <Cyl key={x} p={[w * x, -70, 0]} r={11} h={140} f="metal" paint={paint} />
      ))}
    </>
  )
}

function FloorBoiler({ w, d, h, paint }: P) {
  return (
    <>
      <Box p={[0, h / 2, 0]} s={[w, h, d]} r={25} f="white" paint={paint} />
      <Box p={[0, h - 60, d / 2 - 4]} s={[w - 30, 90, 14]} r={10} f="metalDark" paint={paint} />
      <Box p={[0, h * 0.42, d / 2 - 2]} s={[w - 60, h * 0.55, 8]} r={8} f="white" paint={paint} />
      <Cyl p={[0, h + 150, -d / 2 + 150]} r={75} h={300} f="metal" paint={paint} />
      <Box p={[0, 25, 0]} s={[w + 10, 50, d + 10]} r={6} f="metalMedium" paint={paint} />
    </>
  )
}

function Fireplace({ w, d, h, paint }: P) {
  const fw = w * 0.56
  const fh = h * 0.5
  return (
    <>
      <Box p={[0, 40, 90]} s={[w + 300, 80, d + 180]} r={10} f="stone" paint={paint} />
      <Box p={[0, h / 2, 0]} s={[w, h, d]} r={10} f="plaster" paint={paint} />
      <Box p={[0, h - 30, 30]} s={[w + 120, 60, d + 60]} r={10} f="wood" paint={paint} />
      <Box p={[0, 80 + fh / 2, d / 2 - 90]} s={[fw, fh, 200]} r={20} f="soot" paint={paint} />
      <Box p={[0, 80 + fh + 30, d / 2 - 5]} s={[fw + 40, 50, 20]} r={6} f="stone" paint={paint} />
      <Box p={[0, 80 + 25, d / 2 - 60]} s={[fw * 0.6, 50, 120]} r={20} f="woodDark" paint={paint} />
    </>
  )
}

function MasonryStove({ w, d, h, paint }: P) {
  const doorW = Math.min(360, w * 0.35)
  return (
    <>
      <Box p={[0, h / 2, 0]} s={[w, h, d]} r={15} f="brick" paint={paint} />
      <Box p={[0, h - 40, 0]} s={[w + 40, 80, d + 40]} r={15} f="brick" paint={paint} />
      <Box p={[0, 130, 0]} s={[w + 40, 260, d + 40]} r={15} f="brick" paint={paint} />
      <Box p={[0, 420, d / 2 + 4]} s={[doorW, doorW * 0.8, 16]} r={8} f="metalDark" paint={paint} />
      <Box p={[0, 180, d / 2 + 22]} s={[doorW * 0.8, 110, 12]} r={6} f="metalDark" paint={paint} />
      <Box p={[0, h * 0.65, d / 2 + 2]} s={[w * 0.6, 12, 10]} f="metalMedium" paint={paint} />
    </>
  )
}

function Bookcase({ w, d, h, paint }: P) {
  const t = 22
  const shelves = Math.max(2, Math.round(h / 380))
  const step = (h - 2 * t - 60) / shelves
  const sections = Math.max(1, Math.round(w / 420))
  const sw = (w - 2 * t) / sections
  const tones: Finish[] = ['linen', 'textileDark', 'woodDark', 'textileBlue', 'linen', 'textile']
  const items: ReactNode[] = [
    <Box key="l" p={[-w / 2 + t / 2, h / 2, 0]} s={[t, h, d]} f="wood" paint={paint} />,
    <Box key="r" p={[w / 2 - t / 2, h / 2, 0]} s={[t, h, d]} f="wood" paint={paint} />,
    <Box key="b" p={[0, h / 2, -d / 2 + 5]} s={[w - 2 * t, h, 10]} f="wood" paint={paint} />,
    <Box key="k" p={[0, 30, d / 2 - 30]} s={[w - 2 * t, 60, 20]} f="woodDark" paint={paint} />,
  ]
  for (let i = 1; i < sections; i++) items.push(<Box key={`v${i}`} p={[-w / 2 + t + sw * i, h / 2, 0]} s={[t, h - 2 * t, d - 20]} f="wood" paint={paint} />)
  for (let i = 0; i <= shelves; i++) {
    const y = 60 + t / 2 + step * i
    items.push(<Box key={`s${i}`} p={[0, i === shelves ? h - t / 2 : y, 0]} s={[w, t, d]} f="wood" paint={paint} />)
    if (i === shelves) continue
    for (let c = 0; c < sections; c++) {
      if ((i + c) % 3 === 2) continue
      const seed = i * 7 + c * 3
      const fill = 0.45 + ((seed * 37) % 40) / 100
      const bw = (sw - 40) * fill
      const bh = step * (0.62 + ((seed * 13) % 20) / 100)
      const x0 = -w / 2 + t + sw * c + 20 + (seed % 2 ? sw - 40 - bw : 0)
      const parts = Math.max(2, Math.round(bw / 70))
      for (let k = 0; k < parts; k++) {
        const pw = bw / parts
        const ph = bh * (0.85 + ((seed + k * 5) % 4) * 0.05)
        items.push(<Box key={`bk${i}-${c}-${k}`} p={[x0 + pw * (k + 0.5), y + t / 2 + ph / 2, 10]} s={[pw - 4, ph, d * 0.7]} r={3} f={tones[(seed + k) % tones.length]} paint={paint} />)
      }
    }
  }
  return <>{items}</>
}

function RoundTable({ w, h, paint }: P) {
  const r = w / 2
  return (
    <>
      <Cyl p={[0, h - 18, 0]} r={r} h={36} f="wood" paint={paint} seg={64} />
      <Cyl p={[0, (h - 36) / 2, 0]} r={45} h={h - 36} f="wood" paint={paint} />
      <Cyl p={[0, 12, 0]} r={r * 0.45} h={24} f="woodDark" paint={paint} seg={48} />
    </>
  )
}

// --- Extended library ------------------------------------------------------
// Plan local (x, y) maps to 3D (x, z); the back side is -d/2, the front +d/2.
// Stair geometry mirrors symbols.ts (same TREAD and flight widths) so 2D and 3D agree.

const TREAD = 280

function Sphere({ p, r, f, paint, sy = 1 }: { p: V3; r: number; f: Finish; paint: Paint; sy?: number }) {
  return (
    <mesh position={p.map((v) => v * M) as V3} scale={[1, sy, 1]} material={mat(paint, f)} castShadow receiveShadow>
      <sphereGeometry args={[r * M, 24, 16]} />
    </mesh>
  )
}

/** Extrudes a plan outline (local mm, y down) upwards by h. */
function Extruded({ pts, h, y = 0, f, paint }: { pts: [number, number][]; h: number; y?: number; f: Finish; paint: Paint }) {
  const geo = useMemo(() => {
    const shape = new THREE.Shape(pts.map(([x, py]) => new THREE.Vector2(x * M, -py * M)))
    return new THREE.ExtrudeGeometry(shape, { depth: h * M, bevelEnabled: false })
  }, [pts, h])
  // Free the old GPU buffers when the item is resized or removed.
  useEffect(() => () => geo.dispose(), [geo])
  return <mesh geometry={geo} position={[0, y * M, 0]} rotation={[-Math.PI / 2, 0, 0]} material={mat(paint, f)} castShadow receiveShadow />
}

function BedRound({ w, d, h, paint }: P) {
  const r = Math.min(w, d) / 2
  const base = Math.min(300, h * 0.35)
  const items: ReactNode[] = [
    <Cyl key="b" p={[0, base / 2, 0]} r={r} h={base} f="woodDark" paint={paint} seg={64} />,
    <Cyl key="m" p={[0, base + 100, 0]} r={r - 50} h={200} f="linen" paint={paint} seg={64} />,
  ]
  const segs = 9
  for (let i = 0; i < segs; i++) {
    const a = ((-150 + (120 / segs) * (i + 0.5)) * Math.PI) / 180
    const len = (2 * Math.PI * r * (120 / 360)) / segs + 10
    items.push(
      <group key={`h${i}`} position={[Math.cos(a) * (r - 40) * M, 0, Math.sin(a) * (r - 40) * M]} rotation={[0, -a - Math.PI / 2, 0]}>
        <Box p={[0, h / 2, 0]} s={[len, h, 80]} r={20} f="textile" paint={paint} />
      </group>,
    )
  }
  const R = r - 60
  const pw = Math.min(560, R * 0.46)
  for (const sx of [-1, 1]) items.push(<Box key={`p${sx}`} p={[sx * (pw / 2 + 35), base + 250, -R * 0.62]} s={[pw, 110, Math.min(300, R * 0.24)]} r={45} f="white" paint={paint} />)
  return <>{items}</>
}

function Lamp({ w, d, h, paint, floor }: P & { floor?: boolean }) {
  const r = Math.min(w, d) / 2
  const shadeH = Math.min(floor ? 320 : 240, h * 0.4)
  const shadeR = floor ? r * 0.82 : r
  return (
    <>
      <Cyl p={[0, 15, 0]} r={floor ? r * 0.6 : r * 0.5} h={30} f="metalDark" paint={paint} />
      <Cyl p={[0, (h - shadeH) / 2, 0]} r={12} h={h - shadeH} f="metalMedium" paint={paint} seg={12} />
      <Cyl p={[0, h - shadeH / 2, 0]} r={shadeR} r2={shadeR * 0.72} h={shadeH} f="lamp" paint={paint} />
    </>
  )
}

function Rug({ w, d, h, paint, round }: P & { round?: boolean }) {
  const t = Math.min(h, 15)
  if (round) {
    const r = Math.min(w, d) / 2
    return (
      <>
        <Cyl p={[0, t / 2, 0]} r={r} h={t} f="textileDark" paint={paint} seg={64} />
        <Cyl p={[0, t / 2 + 1, 0]} r={r * 0.82} h={t} f="linen" paint={paint} seg={64} />
      </>
    )
  }
  const band = Math.min(160, w * 0.1, d * 0.1)
  return (
    <>
      <Box p={[0, t / 2, 0]} s={[w, t, d]} f="textileDark" paint={paint} />
      <Box p={[0, t / 2 + 1, 0]} s={[w - 2 * band, t, d - 2 * band]} f="linen" paint={paint} />
    </>
  )
}

function Worktop({ x, z, w, d, h, paint }: { x: number; z: number; w: number; d: number; h: number; paint: Paint }) {
  return (
    <>
      <Box p={[x, (h - 40) / 2, z - 10]} s={[w, h - 40, d - 20]} f="wood" paint={paint} />
      <Box p={[x, h - 20, z]} s={[w, 40, d]} f="stone" paint={paint} />
    </>
  )
}

function KitchenL({ w, d, h, paint }: P) {
  const D = Math.min(600, w / 2, d / 2)
  const items: ReactNode[] = [
    <Worktop key="t" x={0} z={-d / 2 + D / 2} w={w} d={D} h={h} paint={paint} />,
    <group key="s" rotation={[0, Math.PI / 2, 0]}>
      <Worktop x={-(D + (d - D) / 2) + d / 2} z={-w / 2 + D / 2} w={d - D} d={D} h={h} paint={paint} />
    </group>,
  ]
  const topRun = w - D
  const sideRun = d - D
  if (topRun >= 900) {
    const sw = Math.min(800, topRun - 100)
    const sx = -w / 2 + D + Math.max(sw / 2 + 50, Math.min(topRun * 0.55, topRun - sw / 2 - 50))
    const bw = Math.min(450, sw * 0.55)
    items.push(<Box key="sink" p={[sx - sw / 2 + 70 + bw / 2, h - 18, -d / 2 + D / 2 - 20]} s={[bw, 6, D - 230]} r={2} f="metalLight" paint={paint} />)
  }
  if (sideRun >= 700) {
    const sy = -d / 2 + D + Math.max(350, Math.min(sideRun * 0.5, sideRun - 350))
    items.push(<Box key="hob" p={[-w / 2 + D / 2, h + 3, sy]} s={[D - 90, 6, 560]} r={2} f="metalDark" paint={paint} />)
  }
  return <>{items}</>
}

function KitchenIsland({ w, d, h, paint }: P) {
  const over = Math.min(300, d * 0.35)
  return (
    <>
      <Box p={[0, (h - 40) / 2, -over / 2]} s={[w - 40, h - 40, d - over]} f="wood" paint={paint} />
      <Box p={[0, h - 20, 0]} s={[w, 40, d]} f="stone" paint={paint} />
    </>
  )
}

function Stool({ r, h, paint }: { r: number; h: number; paint: Paint }) {
  return (
    <>
      <Cyl p={[0, 10, 0]} r={r * 0.75} h={20} f="metalDark" paint={paint} />
      <Cyl p={[0, h / 2, 0]} r={20} h={h} f="metalMedium" paint={paint} seg={12} />
      <Cyl p={[0, h * 0.35, 0]} r={r * 0.85} h={12} f="metalMedium" paint={paint} />
      <Cyl p={[0, h - 30, 0]} r={r * 0.75} h={60} f="textile" paint={paint} />
    </>
  )
}

function BarCounter({ w, d, h, paint }: P) {
  const cd = Math.min(500, d * 0.55)
  const sr = Math.max(120, Math.min(190, (d - cd - 60) / 2))
  const stools = Math.max(1, Math.floor(w / 600))
  const sz = Math.min(-d / 2 + cd + 40 + sr, d / 2 - sr)
  const items: ReactNode[] = [
    <Box key="c" p={[0, (h - 40) / 2, -d / 2 + cd / 2 - 40]} s={[w, h - 40, cd - 80]} f="wood" paint={paint} />,
    <Box key="t" p={[0, h - 20, -d / 2 + cd / 2]} s={[w, 40, cd]} f="stone" paint={paint} />,
  ]
  for (let i = 0; i < stools; i++) {
    items.push(
      <group key={i} position={[(-w / 2 + (w / stools) * (i + 0.5)) * M, 0, sz * M]}>
        <Stool r={sr} h={Math.min(750, h - 280)} paint={paint} />
      </group>,
    )
  }
  return <>{items}</>
}

function BathtubCorner({ w, d, h, paint }: P) {
  const pts = useMemo(() => {
    const x0 = -w / 2
    const y0 = -d / 2
    const e = Math.min(w, d) * 0.32
    const det = w * w * d * d - e ** 4
    const rx = Math.sqrt(det / (d * d - e * e))
    const ry = Math.sqrt(det / (w * w - e * e))
    const out: [number, number][] = [
      [x0, y0],
      [x0 + w, y0],
    ]
    const a0 = Math.asin(e / ry)
    const a1 = Math.acos(e / rx)
    for (let i = 0; i <= 24; i++) {
      const a = a0 + ((a1 - a0) * i) / 24
      out.push([x0 + Math.cos(a) * rx, y0 + Math.sin(a) * ry])
    }
    out.push([x0, y0 + d])
    return out
  }, [w, d])
  const s = Math.min(w, d)
  return (
    <>
      <Extruded pts={pts} h={h} f="porcelain" paint={paint} />
      <group position={[(-w / 2 + w * 0.42) * M, (h + 1) * M, (-d / 2 + d * 0.42) * M]} rotation={[0, -Math.PI / 4, 0]} scale={[1, 1, 0.63]}>
        <Cyl p={[0, 0, 0]} r={s * 0.43} h={4} f="water" paint={paint} seg={48} />
      </group>
    </>
  )
}

function Jacuzzi({ w, d, h, paint }: P) {
  const s = Math.min(w, d)
  return (
    <>
      <Box p={[0, h / 2, 0]} s={[w, h, d]} r={s * 0.12} f="porcelain" paint={paint} />
      <Cyl p={[0, h + 2, 0]} r={s / 2 - 110} h={4} f="water" paint={paint} seg={64} />
    </>
  )
}

function Step({ x, z, sx, sz, top, paint }: { x: number; z: number; sx: number; sz: number; top: number; paint: Paint }) {
  return <Box p={[x, top / 2, z]} s={[sx, top, sz]} f="wood" paint={paint} />
}

function Stairs({ w, d, h, paint }: P) {
  const steps = Math.max(3, Math.round(d / TREAD))
  const t = d / steps
  const rise = h / steps
  return (
    <>
      {Array.from({ length: steps }, (_, i) => (
        <Step key={i} x={0} z={d / 2 - (i + 0.5) * t} sx={w} sz={t} top={(i + 1) * rise} paint={paint} />
      ))}
    </>
  )
}

function StairsL({ w, d, h, paint }: P) {
  const f = Math.min(1000, w * 0.48, d * 0.48)
  const n1 = Math.max(2, Math.round((d - f) / TREAD))
  const t1 = (d - f) / n1
  const n2 = Math.max(2, Math.round((w - f) / TREAD))
  const t2 = (w - f) / n2
  const rise = h / (n1 + n2 + 1)
  const items: ReactNode[] = []
  for (let i = 0; i < n1; i++) items.push(<Step key={`a${i}`} x={-w / 2 + f / 2} z={d / 2 - (i + 0.5) * t1} sx={f} sz={t1} top={(i + 1) * rise} paint={paint} />)
  items.push(<Step key="l" x={-w / 2 + f / 2} z={-d / 2 + f / 2} sx={f} sz={f} top={(n1 + 1) * rise} paint={paint} />)
  for (let j = 0; j < n2; j++) items.push(<Step key={`b${j}`} x={-w / 2 + f + (j + 0.5) * t2} z={-d / 2 + f / 2} sx={t2} sz={f} top={(n1 + 2 + j) * rise} paint={paint} />)
  return <>{items}</>
}

function StairsU({ w, d, h, paint }: P) {
  const well = Math.min(150, w * 0.08)
  const f = (w - well) / 2
  const land = Math.min(f, d * 0.4)
  const run = d - land
  const steps = Math.max(2, Math.round(run / TREAD))
  const t = run / steps
  const rise = h / (2 * steps + 1)
  const xl = -w / 2 + f / 2
  const xr = w / 2 - f / 2
  const items: ReactNode[] = []
  for (let i = 0; i < steps; i++) {
    items.push(<Step key={`a${i}`} x={xl} z={d / 2 - (i + 0.5) * t} sx={f} sz={t} top={(i + 1) * rise} paint={paint} />)
    items.push(<Step key={`b${i}`} x={xr} z={-d / 2 + land + (i + 0.5) * t} sx={f} sz={t} top={(steps + 2 + i) * rise} paint={paint} />)
  }
  items.push(<Step key="l" x={0} z={-d / 2 + land / 2} sx={w} sz={land} top={(steps + 1) * rise} paint={paint} />)
  items.push(<Box key="w" p={[0, h / 2, -d / 2 + land + run / 2]} s={[well, h, run]} f="plaster" paint={paint} />)
  return <>{items}</>
}

function Divider({ w, d, h, paint }: P) {
  const panels = Math.max(2, Math.round(w / 450))
  const items: ReactNode[] = []
  for (let i = 0; i < panels; i++) {
    const xa = -w / 2 + (w / panels) * i
    const xb = xa + w / panels
    const za = i % 2 ? d / 2 : -d / 2
    const zb = i % 2 ? -d / 2 : d / 2
    const len = Math.hypot(xb - xa, zb - za)
    items.push(
      <group key={i} position={[((xa + xb) / 2) * M, 0, ((za + zb) / 2) * M]} rotation={[0, -Math.atan2(zb - za, xb - xa), 0]}>
        <Box p={[0, h / 2 + 20, 0]} s={[len - 10, h - 40, 22]} r={6} f="textile" paint={paint} />
      </group>,
    )
  }
  return <>{items}</>
}

function Car({ w, d, h, paint }: P) {
  const bw = w * 0.88
  const wr = Math.min(340, h * 0.22)
  const ww = w * 0.12
  const bodyH = h * 0.42
  const items: ReactNode[] = [
    <Box key="b" p={[0, wr * 0.5 + bodyH / 2, 0]} s={[bw, bodyH, d]} r={Math.min(180, bodyH / 2 - 1)} f="textileBlue" paint={paint} />,
    <Box key="c" p={[0, wr * 0.5 + bodyH + (h - wr * 0.5 - bodyH) / 2 - 5, d * 0.06]} s={[bw * 0.76, h - wr * 0.5 - bodyH, d * 0.48]} r={120} f="glass" paint={paint} />,
    <Box key="r" p={[0, h - 15, d * 0.06]} s={[bw * 0.7, 30, d * 0.3]} r={12} f="textileBlue" paint={paint} />,
  ]
  for (const sx of [-1, 1]) {
    for (const fy of [0.19, 0.8]) items.push(<Cyl key={`w${sx}${fy}`} p={[sx * (w / 2 - ww / 2), wr, -d / 2 + d * fy]} r={wr} h={ww} f="metalDark" paint={paint} rot={[0, 0, Math.PI / 2]} />)
  }
  return <>{items}</>
}

function Tree({ w, d, h, paint, low }: P & { low?: boolean }) {
  const r = Math.min(w, d) / 2
  if (low) {
    return (
      <>
        <Sphere p={[0, h * 0.5, 0]} r={r * 0.9} sy={h / (r * 1.8)} f="plant" paint={paint} />
        <Sphere p={[r * 0.35, h * 0.4, r * 0.2]} r={r * 0.55} sy={h / (r * 1.8)} f="plant" paint={paint} />
      </>
    )
  }
  const trunk = h * 0.42
  return (
    <>
      <Cyl p={[0, trunk / 2, 0]} r={Math.max(60, r * 0.08)} h={trunk} f="woodDark" paint={paint} seg={12} />
      <Sphere p={[0, trunk + (h - trunk) / 2, 0]} r={r * 0.85} sy={(h - trunk) / (r * 1.7)} f="plant" paint={paint} />
      <Sphere p={[r * 0.35, trunk + (h - trunk) * 0.35, -r * 0.25]} r={r * 0.5} f="plant" paint={paint} />
    </>
  )
}

function CeilingFan({ w, d, h, paint }: P) {
  const R = Math.min(w, d) / 2
  return (
    <>
      <Cyl p={[0, h * 0.7, 0]} r={12} h={h * 0.6} f="metalMedium" paint={paint} seg={12} />
      <Cyl p={[0, h * 0.25, 0]} r={R * 0.17} h={Math.min(120, h * 0.4)} f="metalLight" paint={paint} />
      {[0, 1, 2, 3].map((i) => (
        <group key={i} rotation={[0, (i * Math.PI) / 2 + Math.PI / 4, 0]}>
          <Box p={[0, h * 0.22, -R * 0.57]} s={[R * 0.24, 12, R * 0.86]} r={5} f="wood" paint={paint} />
        </group>
      ))}
    </>
  )
}

function Generic({ w, d, h, paint }: P) {
  return <Box p={[0, h / 2, 0]} s={[w, h, d]} r={20} f="white" paint={paint} />
}

export function ProceduralFurniture({ type, w, d, h, paint }: { type: string } & P) {
  const p = { w, d, h, paint }
  switch (type) {
    case 'wardrobe':
      return <Wardrobe {...p} />
    case 'hall-wardrobe':
      return <HallWardrobe {...p} />
    case 'dresser':
      return <Drawers {...p} rows={3} legs={0} />
    case 'shoe-cabinet':
      return <ShoeCabinet {...p} />
    case 'dishwasher':
      return <Dishwasher {...p} />
    case 'water-heater':
      return <WaterHeater {...p} />
    case 'gas-boiler':
      return <GasBoiler {...p} />
    case 'floor-boiler':
      return <FloorBoiler {...p} />
    case 'fireplace':
      return <Fireplace {...p} />
    case 'masonry-stove':
      return <MasonryStove {...p} />
    case 'bookcase':
      return <Bookcase {...p} />
    case 'table-round':
      return <RoundTable {...p} />
    case 'coffee-table-round':
    case 'side-table':
      return <RoundTable {...p} w={Math.min(w, d)} />
    case 'bed-round':
      return <BedRound {...p} />
    case 'bedside-lamp':
      return <Lamp {...p} />
    case 'floor-lamp':
      return <Lamp {...p} floor />
    case 'closet-built-in':
      return <Wardrobe {...p} />
    case 'dressing-table':
      return (
        <>
          <Drawers {...p} rows={1} legs={Math.max(0, h - 220)} />
          <Box p={[0, h + 350, -d / 2 + 20]} s={[Math.min(w * 0.7, 900), 700, 20]} r={6} f="glass" paint={paint} />
        </>
      )
    case 'rug':
      return <Rug {...p} />
    case 'rug-round':
      return <Rug {...p} round />
    case 'kitchen-l':
      return <KitchenL {...p} />
    case 'kitchen-island':
      return <KitchenIsland {...p} />
    case 'bar-counter':
      return <BarCounter {...p} />
    case 'bar-stool':
      return <Stool r={Math.min(w, d) / 2} h={h} paint={paint} />
    case 'bathtub-corner':
      return <BathtubCorner {...p} />
    case 'jacuzzi':
      return <Jacuzzi {...p} />
    case 'stairs':
      return <Stairs {...p} />
    case 'stairs-l':
      return <StairsL {...p} />
    case 'stairs-u':
      return <StairsU {...p} />
    case 'pillar':
      return <Box p={[0, h / 2, 0]} s={[w, h, d]} f="plaster" paint={paint} />
    case 'pillar-round':
      return <Cyl p={[0, h / 2, 0]} r={Math.min(w, d) / 2} h={h} f="plaster" paint={paint} seg={32} />
    case 'divider':
      return <Divider {...p} />
    case 'car':
      return <Car {...p} />
    case 'tree':
      return <Tree {...p} />
    case 'shrub':
      return <Tree {...p} low />
    case 'ceiling-fan':
      return <CeilingFan {...p} />
    default:
      return <Generic {...p} />
  }
}
