import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ComponentType } from 'react'
import { Circle, Layer, Line, Rect, Stage } from 'react-konva'
import type Konva from 'konva'
import { useTranslation } from 'react-i18next'
import type { KonvaEventObject } from 'konva/lib/Node'
import { FurnitureSymbol2D } from '../furniture/Symbol2D'
import { furnitureLayer, resolveFurniture } from '../furniture/catalog'
import { snapToWalls } from '../furniture/wallSnap'
import { eraseTarget, eraseTargetAt, sameTarget, type EraseTarget } from './eraser'
import { duplicateFurniture, placeTemplate } from '../furniture/actions'
import { roomTemplate } from '../furniture/templates'
import {
  addFurniture,
  addZone,
  deleteZone,
  updateZone,
  deleteFurniture,
  normalizeDeg,
  updateFurniture,
  OPENING_PRESETS,
  addOpening,
  deleteOpening,
  distanceToSegment,
  formatLength,
  fitOffset,
  fitOffsetClear,
  moveOpening,
  openingGaps,
  resizeOpening,
  snapOffset,
  updateOpening,
  wallDirection,
  type Opening,
  type Wall,
  endpointGroup,
  findMaterial,
  materialColor,
  moveEndpoint,
  moveWall,
  setWallLength,
  sitePolygon,
  wallColor,
  wallLength,
  wallMoveGroup,
  type EndRef,
  type Plan,
  type Point,
} from '../model'
import { redo, undo, usePlanStore } from '../store/planStore'
import { setBusy } from '../storage/busy'
import { isViewOnly, useViewOnly } from '../store/viewOnly'
import { anchorAt, clampScale, fitCamera, northAngle, normRot, toScreen, toWorld, type Camera } from './camera'
import { ViewControls } from './ViewControls'
import { MeasureLayer } from './MeasureLayer'
import { snapZonePoint, ZoneShape } from './ZoneShape'
import { measureTargets, polylineLength, snapMeasure, type Measure } from './measure'
import { RoomHover } from './RoomLabels'
import { detectRooms, pointInPolygon, type RoomFace } from '../stats/rooms'
import { showToast } from '../ui/Toast'
import { useUnderlayAlign, type UnderlayAlign } from '../map/useUnderlayAlign'
import { Grid } from './Grid'
import { FurnitureHandles, Handles, OpeningHandles, type FurnitureResizeHandleKind, type HandleKind } from './Handles'
import { labelAnchor, LengthLabel } from './LengthLabel'
import { Dimensions } from './Dimensions'
import { OpeningShape } from './OpeningShape'
import { Rulers } from './Rulers'
import { gridSnap, snapAngle, snapPoint, type Snap } from './snap'
import { formatLengthInput, lengthSuffix } from '../i18n/lengthUnit'
import { parseLength } from '../ui/LengthField'
import { canvasTheme, RULER_SIZE } from './theme'
import { useElementSize } from './useElementSize'
import { SewerLayer, WaterLayer, layerLocks, lockedToast, stopEdit, useBaseOpacity, useLayerLocks, useLayers, useNetworkEdit } from '../networks'
import { ElectricLayer } from '../networks/electric'
import { HeatingLayer } from '../networks/heating'
import { WallFill, WallOutline } from './WallShape'
import { setCanvasStage } from './stageRef'
import { buildingSel, CornerHint, formatDeg, groupRotateDeg, wrapDeg, emptySel, groupGuides, groupPolys, GroupOverlay, GuideLines, mergeSel, MoveHandle, movePlan, polysCenter, rectSel, ROTATE_CURSOR, rotatePlan, selBounds, selCenter, selHas, selectAll, toggleSel, withoutLocked, type ScreenRect, type SelKind, type Selection } from './selection'

const narrowView = () => window.innerWidth <= 760
const rulerTop = () => 0
const headerBottom = () => (narrowView() ? 24 + 6 + 52 : 24 + 8 + 52)
const chromeRect = (selector: string) => {
  const r = document.querySelector(selector)?.getBoundingClientRect()
  return r && r.width > 0 && r.height > 0 ? r : null
}
const fitPadding = (el?: HTMLElement | null) => {
  if (narrowView()) return { left: RULER_SIZE + 12, top: headerBottom() + 12, right: 12, bottom: 86 }
  const c = el?.getBoundingClientRect()
  const header = chromeRect('.header')
  const toolbar = chromeRect('.toolbar')
  const panel = chromeRect('.inspector')
  const left = c && toolbar && toolbar.right < c.left + c.width / 2 ? toolbar.right - c.left : RULER_SIZE
  const right = c && panel && panel.left > c.left + c.width / 2 ? c.right - panel.left : 0
  const top = c && header ? header.bottom - c.top : headerBottom()
  return { left: Math.max(RULER_SIZE, left) + 24, top: Math.max(0, top) + 24, right: Math.max(0, right) + 24, bottom: 24 }
}
const DEFAULT_CAM: Camera = { x: 0, y: 0, scale: 0.05 }
const DRAG_THRESHOLD_PX = 3
const WALL_SNAP_PX = 12
/** Extra hit radius for the eraser, in screen px, so thin walls are easy to tap. */
const ERASE_TOL_PX = 8
const FUR_NODE_PREFIX = 'fur:'

/**
 * Drop placement: if the drop point is within reach of a wall, turn the item so
 * its back (-d/2) faces that wall and pull it flush; otherwise keep it as is.
 */
const ERASE_RED = '#e5484d'

/** Red preview of what the eraser will delete under the pointer. */
function EraseHighlight({ plan, target, scale }: { plan: Plan; target: EraseTarget; scale: number }) {
  const common = { stroke: ERASE_RED, strokeWidth: 2 / scale, fill: 'rgba(229, 72, 77, 0.22)', listening: false }
  if (target.kind === 'furniture') {
    const f = plan.furniture.find((x) => x.id === target.id)
    if (!f) return null
    const { w, d } = resolveFurniture(f)
    return <Rect {...common} x={f.x} y={f.y} offsetX={w / 2} offsetY={d / 2} width={w} height={d} rotation={f.rotationDeg} />
  }
  if (target.kind === 'walls' || target.kind === 'openings') {
    const o = target.kind === 'openings' ? plan.openings.find((x) => x.id === target.id) : undefined
    const wall = plan.walls.find((x) => x.id === (o ? o.wallId : target.id))
    if (!wall) return null
    const len = Math.hypot(wall.b.x - wall.a.x, wall.b.y - wall.a.y) || 1
    const ux = (wall.b.x - wall.a.x) / len
    const uy = (wall.b.y - wall.a.y) / len
    const [s0, s1] = o ? [o.offset, o.offset + o.width] : (target.span ?? [0, len])
    return (
      <Line
        points={[wall.a.x + ux * s0, wall.a.y + uy * s0, wall.a.x + ux * s1, wall.a.y + uy * s1]}
        stroke="rgba(229, 72, 77, 0.55)"
        strokeWidth={wall.thickness + 4 / scale}
        lineCap="butt"
        listening={false}
      />
    )
  }
  const z = plan.site.zones?.find((x) => x.id === target.id)
  if (!z) return null
  return <Line {...common} points={z.polygon.flatMap((p) => [p.x, p.y])} closed />
}

function placeAgainstWall(walls: Plan['walls'], type: string, at: Point, tol: number): { x: number; y: number; rotationDeg: number } {
  const r = resolveFurniture({ type })
  let best: { dist: number; toward: Point } | null = null
  for (const wall of walls) {
    const dist = distanceToSegment(at, wall.a, wall.b)
    const reach = wall.thickness / 2 + r.d + tol
    if (dist > reach || (best && dist >= best.dist)) continue
    const len = Math.hypot(wall.b.x - wall.a.x, wall.b.y - wall.a.y)
    if (len < 1) continue
    const n = { x: -(wall.b.y - wall.a.y) / len, y: (wall.b.x - wall.a.x) / len }
    const s = (at.x - wall.a.x) * n.x + (at.y - wall.a.y) * n.y
    best = { dist, toward: s < 0 ? n : { x: -n.x, y: -n.y } }
  }
  if (!best || r.def?.lockAspect) {
    const s = snapToWalls(walls, { ...at, w: r.w, d: r.d, rotationDeg: 0 }, tol)
    return { x: Math.round(s.x), y: Math.round(s.y), rotationDeg: 0 }
  }
  // Local back direction (0, -1) rotated by θ is (sin θ, -cos θ).
  const rotationDeg = normalizeDeg(Math.round((Math.atan2(best.toward.x, -best.toward.y) * 180) / Math.PI))
  const s = snapToWalls(walls, { ...at, w: r.w, d: r.d, rotationDeg }, r.d + tol)
  return { x: Math.round(s.x), y: Math.round(s.y), rotationDeg }
}

type DragKind = HandleKind | 'op-move' | 'op-start' | 'op-end' | 'fur-move' | 'fur-rot' | 'fur-resize' | 'room-move' | 'group-move' | 'group-rot' | 'zone-vertex'

type DragExtra = {
  handle?: FurnitureResizeHandleKind
  initialW?: number
  initialD?: number
  initialX?: number
  initialY?: number
  initialRot?: number
}

type Ghost = { wallId: string; opening: Opening }

type Drag = {
  kind: DragKind
  wallId: string
  openingId?: string
  furnitureId?: string
  roomId?: string
  zoneId?: string
  vertex?: number
  origin: Point
  originScreen: Point
  base: Plan
  moved: boolean
  pick?: [SelKind, string]
  pivot?: Point
  altPivot?: Point
  handle?: FurnitureResizeHandleKind
  initialW?: number
  initialD?: number
  initialX?: number
  initialY?: number
  initialRot?: number
}

type LengthEdit = { wallId: string; value: string }

type ViewBox = { x: number; y: number; scale: number; width: number; height: number; rotationDeg?: number }

type UnderlayModules = {
  Underlay: ComponentType<{ plan: Plan; view: ViewBox; opacity?: number; geo?: UnderlayAlign['shown']; imagery?: UnderlayAlign['imagery'] }>
  Overlay: ComponentType<{ align: UnderlayAlign; view: ViewBox }>
  Controls: ComponentType<{ align: UnderlayAlign }>
}

function useUnderlay(enabled: boolean) {
  const [mods, setMods] = useState<UnderlayModules | null>(null)
  useEffect(() => {
    if (!enabled || mods) return
    let alive = true
    Promise.all([import('../map/SatelliteUnderlay'), import('../map/UnderlayAlign')])
      .then(([u, a]) => {
        if (alive) setMods({ Underlay: u.default as UnderlayModules['Underlay'], Overlay: a.default, Controls: a.UnderlayAlignControls })
      })
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [enabled, mods])
  return enabled ? mods : null
}

const NO_PLAN = { site: {} } as Plan

type Props = { onCursor?: (p: Point | null, scale: number) => void }

const isTyping = (e: KeyboardEvent) => {
  const el = e.target as HTMLElement
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable
}

export function PlanCanvas({ onCursor }: Props) {
  const { t } = useTranslation('common')
  const [containerRef, size] = useElementSize<HTMLDivElement>()
  const plan = usePlanStore((s) => s.plan)
  const tool = usePlanStore((s) => s.tool)
  const selectedWallId = usePlanStore((s) => s.selectedWallId)
  const selectedOpeningId = usePlanStore((s) => s.selectedOpeningId)
  const selectOpening = usePlanStore((s) => s.selectOpening)
  const doorPreset = usePlanStore((s) => s.doorPreset)
  const selectedFurnitureId = usePlanStore((s) => s.selectedFurnitureId)
  const selectFurniture = usePlanStore((s) => s.selectFurniture)
  const activeMaterialId = usePlanStore((s) => s.activeMaterialId)
  const fitNonce = usePlanStore((s) => s.fitNonce)
  const storedCam = usePlanStore((s) => s.cam)
  const setStoredCam = usePlanStore((s) => s.setCam)
  const selectWall = usePlanStore((s) => s.selectWall)
  const addWall = usePlanStore((s) => s.addWall)
  const deleteWall = usePlanStore((s) => s.deleteWall)
  const setTool = usePlanStore((s) => s.setTool)
  const commit = usePlanStore((s) => s.commit)
  const underlay = usePlanStore((s) => s.underlay)
  const underlayMods = useUnderlay(underlay.on)
  const Underlay = underlayMods?.Underlay ?? null
  const aligning = usePlanStore((s) => s.aligning) && underlay.on && !isViewOnly()
  const setAligning = usePlanStore((s) => s.setAligning)
  const align = useUnderlayAlign(
    plan ?? NO_PLAN,
    (geo) => {
      const current = usePlanStore.getState().plan
      if (current) commit({ ...current, site: { ...current.site, geo } })
    },
    (imagery) => {
      const current = usePlanStore.getState().plan
      if (current) commit({ ...current, site: { ...current.site, imagery } })
    },
  )

  const cam = storedCam ?? DEFAULT_CAM
  const layers = useLayers()
  const locks = useLayerLocks()
  const baseOpacity = useBaseOpacity()
  const viewOnly = useViewOnly()
  const rot = cam.rotation ?? 0
  const [cursor, setCursor] = useState<Snap | null>(null)
  const [eraseHover, setEraseHover] = useState<EraseTarget | null>(null)
  const [draftStart, setDraftStart] = useState<Point | null>(null)
  const [shiftDown, setShiftDown] = useState(false)
  const [drag, setDrag] = useState<Drag | null>(null)
  const [preview, setPreview] = useState<Plan | null>(null)
  const [lengthEdit, setLengthEdit] = useState<LengthEdit | null>(null)
  const [ghost, setGhost] = useState<Ghost | null>(null)
  const [measures, setMeasures] = useState<Measure[]>([])
  const [activeMeasure, setActiveMeasure] = useState<Measure | null>(null)
  const [measureCursor, setMeasureCursor] = useState<Point | null>(null)
  const [roomEdit, setRoomEdit] = useState<{ id: string; value: string } | null>(null)
  const [ctxMenu, setCtxMenu] = useState<{ left: number; top: number; at: Point } | null>(null)
  const [hoverRoom, setHoverRoom] = useState<RoomFace | null>(null)
  const group = usePlanStore((s) => s.group)
  const [marquee, setMarquee] = useState<(ScreenRect & { add: boolean }) | null>(null)
  const [groupInfo, setGroupInfo] = useState<{ text: string; at: Point } | null>(null)
  const [hoverCorner, setHoverCorner] = useState<Point | null>(null)
  const [hoverWall, setHoverWall] = useState<string | null>(null)
  const [hoverZone, setHoverZone] = useState<string | null>(null)
  const [zoneDraft, setZoneDraft] = useState<Point[]>([])
  const [zoneCursor, setZoneCursor] = useState<Point | null>(null)
  const selectedZoneId = usePlanStore((s) => s.selectedZoneId)
  const selectZone = usePlanStore((s) => s.selectZone)
  const finishZone = (pts: Point[]) => {
    const current = usePlanStore.getState().plan
    setZoneDraft([])
    if (!current || pts.length < 3) return
    const res = addZone(current, pts)
    commit(res.plan)
    setTool('select')
    selectZone(res.id)
  }
  const showDims = usePlanStore((s) => s.showDims)
  const panRef = useRef(false)
  const suppressClickUntil = useRef(0)
  const wallDragStartRef = useRef<Point | null>(null)
  // Touch wall drawing: a finger drag draws one wall from where it starts.
  const wallTouchRef = useRef<{ start: Point; screen: Point; moved: boolean } | null>(null)
  const lastTapAt = useRef(0)
  const skipWallClick = useRef(false)
  const middlePanRef = useRef<{ x: number; y: number; camX: number; camY: number } | null>(null)

  useEffect(() => {
    setBusy(!!drag || !!lengthEdit)
  }, [drag, lengthEdit])
  const stageRef = useRef<Konva.Stage>(null)
  useEffect(() => {
    setCanvasStage(stageRef.current)
  })
  const fittedRef = useRef(-1)
  const siteKeyRef = useRef<string | null>(null)

  const shown = preview ?? plan
  const hasPlan = !!plan
  const ready = size.width > 0 && size.height > 0

  useEffect(() => {
    if (!hasPlan || !ready || fittedRef.current === fitNonce) return
    const ps = usePlanStore.getState().plan?.site
    siteKeyRef.current = ps ? JSON.stringify([ps.boundary, ps.width, ps.depth]) : null
    const current = usePlanStore.getState().plan
    if (!current) return
    fittedRef.current = fitNonce
    setStoredCam(
      fitCamera(sitePolygon(current.site), size.width, size.height, fitPadding(containerRef.current), usePlanStore.getState().cam?.rotation ?? 0),
    )
  }, [hasPlan, ready, fitNonce, size.width, size.height, setStoredCam])

  const narrowNow = size.width > 0 && size.width <= 760
  const narrowRef = useRef<boolean | null>(null)
  useEffect(() => {
    if (size.width === 0) return
    if (narrowRef.current !== null && narrowRef.current !== narrowNow) usePlanStore.getState().requestFit()
    narrowRef.current = narrowNow
  }, [narrowNow, size.width])

  const siteKey = plan ? JSON.stringify([plan.site.boundary, plan.site.width, plan.site.depth]) : null
  useEffect(() => {
    if (!siteKey || siteKeyRef.current === null || siteKeyRef.current === siteKey) return
    siteKeyRef.current = siteKey
    usePlanStore.getState().requestFit()
  }, [siteKey])

  useEffect(() => {
    if (!viewOnly) return
    const st = usePlanStore.getState()
    if (st.tool !== 'select' && st.tool !== 'measure') st.setTool('select')
    if (st.aligning) st.setAligning(false)
    st.selectWall(null)
  }, [viewOnly])

  useEffect(() => {
    const st = usePlanStore.getState()
    if (locks.walls && (st.tool === 'wall' || st.tool === 'door' || st.tool === 'window')) st.setTool('select')
    if (locks.zones && st.tool === 'zone') st.setTool('select')
    if ((locks.walls && (st.selectedWallId || st.selectedOpeningId)) || (locks.furniture && st.selectedFurnitureId) || (locks.zones && st.selectedZoneId)) st.selectWall(null)
    if (st.group && st.tool !== 'building') st.setGroup(withoutLocked(st.group, locks))
  }, [locks.walls, locks.furniture, locks.zones, tool])

  useEffect(() => {
    if (tool !== 'wall') setDraftStart(null)
    if (tool !== 'door' && tool !== 'window') setGhost(null)
  }, [tool])

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setShiftDown(true)
      if (isTyping(e)) return
      const mod = e.metaKey || e.ctrlKey
      if (mod && (e.key === 'z' || e.key === 'Z' || e.key === 'я' || e.key === 'Я')) {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
        return
      }
      if (mod && (e.key === 'y' || e.key === 'н')) {
        e.preventDefault()
        redo()
        return
      }
      if (mod && (e.key === 'a' || e.key === 'ф' || e.key === 'A' || e.key === 'Ф') && !isViewOnly()) {
        const st = usePlanStore.getState()
        if (!st.plan) return
        e.preventDefault()
        st.setTool('select')
        st.setGroup(withoutLocked(selectAll(st.plan), layerLocks()))
        return
      }
      if (mod && (e.key === 'd' || e.key === 'D' || e.key === 'в' || e.key === 'В') && !isViewOnly()) {
        // Duplicate the selected furniture (single item or the furniture in a group).
        const st = usePlanStore.getState()
        const ids = st.group?.furniture.length ? st.group.furniture : st.selectedFurnitureId ? [st.selectedFurnitureId] : []
        if (!st.plan || ids.length === 0) return
        e.preventDefault()
        if (layerLocks().furniture) {
          lockedToast('furniture')
          return
        }
        const res = duplicateFurniture(st.plan, ids)
        st.commit(res.plan)
        if (res.ids.length === 1) st.selectFurniture(res.ids[0])
        else st.setGroup({ ...emptySel(), furniture: res.ids })
        return
      }
      if (mod) return
      const state = usePlanStore.getState()
      if (isViewOnly()) {
        if (e.key === 'm' || e.key === 'ь') setTool(state.tool === 'measure' ? 'select' : 'measure')
        if (e.key === 'Escape') {
          setMeasures([])
          setActiveMeasure(null)
        }
        return
      }
      if (e.key === 'Escape' && state.aligning) {
        setAligning(false)
        return
      }
      if (e.key === 'b' || e.key === 'и' || e.key === 'B' || e.key === 'И') {
        if (useNetworkEdit.getState().editing) stopEdit()
        setTool('building')
        return
      }
      if (e.key === 'Escape' && state.tool === 'building') {
        state.setGroup(null)
        setTool('select')
        return
      }
      if (state.group && (state.tool === 'select' || state.tool === 'building')) {
        const arrows: Record<string, Point> = { ArrowLeft: { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 }, ArrowUp: { x: 0, y: -1 }, ArrowDown: { x: 0, y: 1 } }
        const dir = arrows[e.key]
        if (dir) {
          e.preventDefault()
          const r = (-(state.cam?.rotation ?? 0) * Math.PI) / 180
          const wx = dir.x * Math.cos(r) - dir.y * Math.sin(r)
          const wy = dir.x * Math.sin(r) + dir.y * Math.cos(r)
          const step = e.shiftKey ? 1000 : 100
          if (Math.abs(wx) >= Math.abs(wy)) state.moveGroup(Math.sign(wx) * step, 0)
          else state.moveGroup(0, Math.sign(wy) * step)
          return
        }
        if (e.code === 'BracketLeft' || e.code === 'BracketRight') {
          e.preventDefault()
          state.rotateGroup((e.code === 'BracketLeft' ? -1 : 1) * (e.shiftKey ? 15 : 1))
          return
        }
        if (e.key === 'Delete' || e.key === 'Backspace') {
          e.preventDefault()
          state.deleteGroup()
          return
        }
        if (e.key === 'Escape') {
          state.setGroup(null)
          return
        }
      }
      const op = state.plan?.openings.find((o) => o.id === state.selectedOpeningId)
      const fur = state.plan?.furniture.find((f) => f.id === state.selectedFurnitureId)
      const lk = layerLocks()
      if (fur && state.plan && lk.furniture) return
      if (fur && state.plan && (e.key === 'Delete' || e.key === 'Backspace')) {
        e.preventDefault()
        state.commit(deleteFurniture(state.plan, fur.id))
        return
      }
      if (fur && state.plan && (e.key === 'r' || e.key === 'к' || e.key === 'R' || e.key === 'К')) {
        state.commit(updateFurniture(state.plan, fur.id, { rotationDeg: normalizeDeg(fur.rotationDeg + (e.shiftKey ? -90 : 90)) }))
        return
      }
      if (e.key === 'm' || e.key === 'ь' || e.key === 'M' || e.key === 'Ь') {
        if (state.tool === 'measure') {
          setMeasures([])
          setActiveMeasure(null)
        } else setTool('measure')
        return
      }
      if (state.tool === 'zone' && (e.key === 'Enter' || e.key === 'Escape')) {
        if (e.key === 'Enter') finishZone(zoneDraft)
        else if (zoneDraft.length) setZoneDraft([])
        else setTool('select')
        return
      }
      if (state.selectedZoneId && state.plan && (e.key === 'Delete' || e.key === 'Backspace') && !lk.zones) {
        e.preventDefault()
        if (!state.plan.site.zones?.find((z) => z.id === state.selectedZoneId)?.locked)
          state.commit(deleteZone(state.plan, state.selectedZoneId))
        return
      }
      if (e.key === 'Escape' && state.tool === 'measure') {
        setMeasures([])
        setActiveMeasure(null)
        return
      }
      if (e.key === 'Escape') {
        setCtxMenu(null)
        if (draftStart) setDraftStart(null)
        else if (state.tool !== 'select') setTool('select')
        else selectWall(null)
      } else if (lk.walls && (e.key === 'd' || e.key === 'в' || e.key === 'o' || e.key === 'щ' || e.key === 'w' || e.key === 'ц')) {
        lockedToast('walls')
      } else if (lk.walls && (op || state.selectedWallId)) {
        return
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && op && state.plan) {
        e.preventDefault()
        state.commit(deleteOpening(state.plan, op.id))
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && state.selectedWallId) {
        e.preventDefault()
        deleteWall(state.selectedWallId)
      } else if ((e.key === 'f' || e.key === 'а') && (op?.type === 'door' || op?.type === 'gate') && state.plan) {
        state.commit(updateOpening(state.plan, op.id, { side: op.side === 'left' ? 'right' : 'left' }))
      } else if ((e.key === 'h' || e.key === 'р') && op?.type === 'door' && state.plan) {
        state.commit(updateOpening(state.plan, op.id, { hinge: op.hinge === 'end' ? 'start' : 'end' }))
      } else if (e.key === 'v' || e.key === 'м') {
        setTool('select')
      } else if (e.key === 'e' || e.key === 'у') {
        setTool('erase')
      } else if (e.key === 'd' || e.key === 'в') {
        setTool('door')
      } else if (e.key === 'o' || e.key === 'щ') {
        setTool('window')
      } else if (e.key === 'w' || e.key === 'ц') {
        setTool('wall')
      } else if (e.key === 'Enter') {
        setDraftStart(null)
      }
    }
    const up = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setShiftDown(false)
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [draftStart, deleteWall, selectWall, setTool, setAligning, zoneDraft])

  const worldPointer = useCallback((): Point | null => {
    const p = stageRef.current?.getRelativePointerPosition()
    return p ? { x: p.x, y: p.y } : null
  }, [])

  const screenPointer = useCallback((): Point | null => {
    const p = stageRef.current?.getPointerPosition()
    return p ? { x: p.x, y: p.y } : null
  }, [])

  const startDrag = useCallback(
    (
      kind: DragKind,
      wallId: string,
      openingId?: string,
      furnitureId?: string,
      roomId?: string,
      zoneId?: string,
      vertex?: number,
      extra?: DragExtra,
    ) => {
      const origin = worldPointer()
      const originScreen = screenPointer()
      const base = usePlanStore.getState().plan
      if (!origin || !originScreen || !base) return
      stageRef.current?.stopDrag()
      setDrag({ kind, wallId, openingId, furnitureId, roomId, zoneId, vertex, origin, originScreen, base, moved: false, ...extra })
    },
    [screenPointer, worldPointer],
  )

  const dragPlan = (d: Drag, raw: Point, shift: boolean, alt: boolean): Plan => {
    if (d.kind === 'group-move' || d.kind === 'group-rot') {
      const g = usePlanStore.getState().group
      if (!g) return d.base
      const sp = screenPointer()
      if (d.kind === 'group-move') {
        const delta = { x: raw.x - d.origin.x, y: raw.y - d.origin.y }
        const snapped = shift
          ? snapAngle({ x: 0, y: 0 }, delta)
          : { x: Math.round(delta.x / gridSnap()) * gridSnap(), y: Math.round(delta.y / gridSnap()) * gridSnap() }
        if (sp) setGroupInfo({ text: t('canvas.groupMove', { x: formatLength(snapped.x), y: formatLength(snapped.y) }), at: sp })
        return movePlan(d.base, g, snapped)
      }
      const c = (alt && d.altPivot) || d.pivot || selCenter(d.base, g)
      if (!c) return d.base
      const deg = ((Math.atan2(raw.y - c.y, raw.x - c.x) - Math.atan2(d.origin.y - c.y, d.origin.x - c.x)) * 180) / Math.PI
      const snappedDeg = groupRotateDeg(d.base, g, wrapDeg(deg), shift)
      if (sp) setGroupInfo({ text: formatDeg(snappedDeg), at: sp })
      return rotatePlan(d.base, g, snappedDeg, c)
    }
    if (d.kind === 'zone-vertex') {
      const z = d.base.site.zones?.find((x) => x.id === d.zoneId)
      if (!z || z.locked || d.vertex === undefined) return d.base
      const prev = z.polygon[(d.vertex - 1 + z.polygon.length) % z.polygon.length]
      const p = snapZonePoint(raw, d.base, cam.scale, prev, shift, z.polygon[d.vertex])
      return updateZone(d.base, z.id, { polygon: z.polygon.map((q, i) => (i === d.vertex ? p : q)) })
    }
    if (d.kind === 'room-move') {
      const rooms = d.base.rooms ?? []
      const r = rooms.find((x) => x.id === d.roomId)
      if (!r) return d.base
      const nx = snapOffset(r.x + raw.x - d.origin.x)
      const ny = snapOffset(r.y + raw.y - d.origin.y)
      return { ...d.base, rooms: rooms.map((x) => (x.id === r.id ? { ...x, x: nx, y: ny } : x)) }
    }
    if (d.kind === 'fur-move' || d.kind === 'fur-rot') {
      const f = d.base.furniture.find((x) => x.id === d.furnitureId)
      if (!f) return d.base
      if (d.kind === 'fur-move') {
        // Grid first (50 mm, 10 mm with Shift), then pull flush to wall faces
        // within ~12 px. Alt moves freely along the grid without wall snapping.
        const step = shift ? 10 : undefined
        const gx = snapOffset(f.x + raw.x - d.origin.x, step)
        const gy = snapOffset(f.y + raw.y - d.origin.y, step)
        if (alt) return updateFurniture(d.base, f.id, { x: gx, y: gy })
        const r = resolveFurniture(f)
        const s = snapToWalls(d.base.walls, { x: gx, y: gy, w: r.w, d: r.d, rotationDeg: f.rotationDeg }, WALL_SNAP_PX / cam.scale)
        return updateFurniture(d.base, f.id, { x: Math.round(s.x), y: Math.round(s.y) })
      }
      const deg = (Math.atan2(raw.y - f.y, raw.x - f.x) * 180) / Math.PI + 90
      const step = shift ? 5 : 15
      return updateFurniture(d.base, f.id, { rotationDeg: normalizeDeg(Math.round(deg / step) * step) })
    }
    if (d.kind === 'fur-resize') {
      const f = d.base.furniture.find((x) => x.id === d.furnitureId)
      if (!f) return d.base
      const r = resolveFurniture(f)
      const w0 = d.initialW ?? r.w
      const d0 = d.initialD ?? r.d
      const x0 = d.initialX ?? f.x
      const y0 = d.initialY ?? f.y
      const rot = d.initialRot ?? f.rotationDeg
      const rad = (rot * Math.PI) / 180
      const cos = Math.cos(rad)
      const sin = Math.sin(rad)

      const dx = raw.x - x0
      const dy = raw.y - y0

      // Pointer in local furniture coordinate system (+u right, +v down)
      const u = dx * cos + dy * sin
      const v = -dx * sin + dy * cos

      const step = shift ? 10 : 50
      const snapDim = (val: number) => Math.round(val / step) * step
      const MIN_SIZE = 150

      let uMin = -w0 / 2
      let uMax = w0 / 2
      let vMin = -d0 / 2
      let vMax = d0 / 2

      const handle = d.handle ?? 'se'

      if (handle.includes('e')) {
        uMax = Math.max(uMin + MIN_SIZE, snapDim(u))
      } else if (handle.includes('w')) {
        uMin = Math.min(uMax - MIN_SIZE, snapDim(u))
      }

      if (handle.includes('s')) {
        vMax = Math.max(vMin + MIN_SIZE, snapDim(v))
      } else if (handle.includes('n')) {
        vMin = Math.min(vMax - MIN_SIZE, snapDim(v))
      }

      // Proportional resize: Alt, the inspector's "Keep proportions" toggle (touch), or always for round symbols.
      if ((alt || r.def?.lockAspect || usePlanStore.getState().keepRatio) && w0 > 0 && d0 > 0) {
        const ratio = w0 / d0
        const corner = handle.length === 2
        let lw: number
        let ld: number
        if (corner) {
          const f = Math.max((uMax - uMin) / w0, (vMax - vMin) / d0)
          lw = Math.max(MIN_SIZE, snapDim(w0 * f))
          ld = Math.max(MIN_SIZE, Math.round(lw / ratio))
          if (handle.includes('e')) uMax = uMin + lw
          else uMin = uMax - lw
          if (handle.includes('s')) vMax = vMin + ld
          else vMin = vMax - ld
        } else if (handle === 'e' || handle === 'w') {
          lw = uMax - uMin
          ld = Math.max(MIN_SIZE, Math.round(lw / ratio))
          vMin = -ld / 2
          vMax = ld / 2
        } else {
          ld = vMax - vMin
          lw = Math.max(MIN_SIZE, Math.round(ld * ratio))
          uMin = -lw / 2
          uMax = lw / 2
        }
      }

      const newW = Math.round(uMax - uMin)
      const newD = Math.round(vMax - vMin)

      // Center shift in local space
      const cu = (uMin + uMax) / 2
      const cv = (vMin + vMax) / 2

      // Transform center shift back to world space
      const newX = snapOffset(x0 + cu * cos - cv * sin)
      const newY = snapOffset(y0 + cu * sin + cv * cos)

      return updateFurniture(d.base, f.id, {
        x: newX,
        y: newY,
        w: newW,
        d: newD,
      })
    }
    const wall = d.base.walls.find((w) => w.id === d.wallId)
    if (!wall) return d.base
    if (d.kind === 'op-move' || d.kind === 'op-start' || d.kind === 'op-end') {
      const o = d.base.openings.find((x) => x.id === d.openingId)
      if (!o) return d.base
      const dir = wallDirection(wall)
      const along = (raw.x - wall.a.x) * dir.x + (raw.y - wall.a.y) * dir.y
      if (d.kind === 'op-move') {
        const start = (d.origin.x - wall.a.x) * dir.x + (d.origin.y - wall.a.y) * dir.y
        return moveOpening(d.base, o.id, snapOffset(o.offset + along - start))
      }
      return resizeOpening(d.base, o.id, d.kind === 'op-start' ? 'start' : 'end', snapOffset(along))
    }
    if (d.kind === 'move') {
      const delta = { x: raw.x - d.origin.x, y: raw.y - d.origin.y }
      const snapped = shift
        ? snapAngle({ x: 0, y: 0 }, delta)
        : { x: Math.round(delta.x / gridSnap()) * gridSnap(), y: Math.round(delta.y / gridSnap()) * gridSnap() }
      return moveWall(d.base, d.wallId, snapped, alt)
    }
    const ref: EndRef = { wallId: d.wallId, end: d.kind }
    const moving = endpointGroup(d.base, ref, alt)
    const fixed = wall[d.kind === 'a' ? 'b' : 'a']
    const skip = (wallId: string, end: 'a' | 'b') =>
      moving.some((r) => r.wallId === wallId && r.end === end) || (wallId === d.wallId && end !== d.kind)
    const snap = snapPoint(raw, d.base.walls, cam.scale, fixed, shift, skip)
    setCursor(snap)
    return moveEndpoint(d.base, ref, snap.point, alt)
  }

  const pinchRef = useRef<{ dist: number; center: Point } | null>(null)

  const onStageTouchStart = (e: KonvaEventObject<TouchEvent>) => {
    wallTouchRef.current = null
    if (tool !== 'wall' || viewOnly || e.evt.touches.length !== 1 || e.target !== stageRef.current || layerLocks().walls) return
    const raw = worldPointer()
    const sp = screenPointer()
    const current = usePlanStore.getState().plan
    if (!raw || !sp || !current) return
    wallTouchRef.current = { start: snapPoint(raw, current.walls, cam.scale, null, false).point, screen: sp, moved: false }
  }

  const onTouchMove = (e: KonvaEventObject<TouchEvent>) => {
    const touches = e.evt.touches
    if (touches.length < 2) {
      const wt = wallTouchRef.current
      if (wt && !wt.moved) {
        const sp = screenPointer()
        if (sp && Math.hypot(sp.x - wt.screen.x, sp.y - wt.screen.y) > 8) {
          // A drag (not a tap): preview the wall from the finger's start point.
          wt.moved = true
          setDraftStart(wt.start)
        }
      }
      if (!pinchRef.current) onMouseMove(e)
      return
    }
    if (wallTouchRef.current?.moved) setDraftStart(null)
    wallTouchRef.current = null
    e.evt.preventDefault()
    const stage = stageRef.current
    if (!stage) return
    if (stage.isDragging()) stage.stopDrag()
    if (drag) {
      setDrag(null)
      setPreview(null)
    }
    const rect = stage.container().getBoundingClientRect()
    const p1 = { x: touches[0].clientX - rect.left, y: touches[0].clientY - rect.top }
    const p2 = { x: touches[1].clientX - rect.left, y: touches[1].clientY - rect.top }
    const center = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 }
    const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y)
    suppressClickUntil.current = Date.now() + 500
    const prev = pinchRef.current
    pinchRef.current = { dist, center }
    if (!prev) return
    const current = usePlanStore.getState().cam ?? cam
    const world = toWorld(current, prev.center)
    const scale = clampScale(current.scale * (dist / prev.dist))
    setCam(anchorAt({ ...current, scale }, world, center))
  }

  const onTouchEnd = (e: KonvaEventObject<TouchEvent>) => {
    const wt = wallTouchRef.current
    if (wt && e.evt.touches.length === 0) {
      wallTouchRef.current = null
      if (wt.moved) {
        // Konva fires `tap` right after this touchend; the drag already drew the wall.
        suppressClickUntil.current = Date.now() + 400
        const raw = worldPointer()
        const current = usePlanStore.getState().plan
        if (raw && current) {
          const end = snapPoint(raw, current.walls, cam.scale, wt.start, shiftDown).point
          if (Math.hypot(end.x - wt.start.x, end.y - wt.start.y) >= 200) addWall(wt.start, end)
        }
        // On touch every drag is one wall; the next drag starts fresh.
        setDraftStart(null)
        setCursor(null)
      }
    }
    if (e.evt.touches.length < 2 && pinchRef.current) {
      pinchRef.current = null
      suppressClickUntil.current = Date.now() + 500
    }
  }

  const onMouseMove = (e: KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (middlePanRef.current && 'clientX' in e.evt) {
      const dx = (e.evt as MouseEvent).clientX - middlePanRef.current.x
      const dy = (e.evt as MouseEvent).clientY - middlePanRef.current.y
      setCam({ ...cam, x: middlePanRef.current.camX + dx, y: middlePanRef.current.camY + dy })
      return
    }
    const shift = e.evt.shiftKey || shiftDown
    const raw = worldPointer()
    if (!raw) return
    if (marquee) {
      const sp = screenPointer()
      if (sp) setMarquee({ ...marquee, x1: sp.x, y1: sp.y })
      return
    }
    if (drag) {
      const sp = screenPointer()
      const far =
        drag.moved ||
        (sp && Math.hypot(sp.x - drag.originScreen.x, sp.y - drag.originScreen.y) > DRAG_THRESHOLD_PX)
      if (!far) return
      if (!drag.moved) setDrag({ ...drag, moved: true })
      setPreview(dragPlan(drag, raw, shift, e.evt.altKey))
      onCursor?.(raw, cam.scale)
      return
    }
    if (tool === 'erase') {
      const current = usePlanStore.getState().plan
      const hit = current ? eraseTargetAt(current, raw, ERASE_TOL_PX / cam.scale, layerLocks()) : null
      if (!sameTarget(hit, eraseHover)) setEraseHover(hit)
      return
    }
    const walls = usePlanStore.getState().plan?.walls ?? []
    if (tool === 'zone') {
      const current = usePlanStore.getState().plan
      if (current) setZoneCursor(snapZonePoint(raw, current, cam.scale, zoneDraft.at(-1) ?? null, shift))
      onCursor?.(raw, cam.scale)
      return
    }
    if (tool === 'measure') {
      const from = activeMeasure?.points.at(-1) ?? null
      const snap = e.evt.altKey ? { point: raw } : snapMeasure(raw, targets, cam.scale, from, shift)
      setMeasureCursor(snap.point)
      onCursor?.(snap.point, cam.scale)
      return
    }
    if (tool === 'door' || tool === 'window') {
      setGhost(ghostAt(raw))
      setCursor(null)
      onCursor?.(raw, cam.scale)
      return
    }
    const snap = snapPoint(raw, walls, cam.scale, draftStart, shift)
    setCursor(snap)
    onCursor?.(snap.point, cam.scale)
    if (tool === 'select' && !viewOnly) {
      const face = findRoomAt(raw)
      if ((face?.id ?? null) !== (hoverRoom?.id ?? null)) setHoverRoom(face)
    } else if (hoverRoom) setHoverRoom(null)
    const sp = screenPointer()
    const corner =
      (tool === 'select' || tool === 'building') && !viewOnly && group && sp && e.target === stageRef.current && !groupPolygons.some((poly) => pointInPolygon(raw, poly))
        ? (groupCorners.find((c) => {
            const q = toScreen(cam, c)
            const dd = Math.hypot(q.x - sp.x, q.y - sp.y)
            return dd >= 6 && dd <= 24
          }) ?? null)
        : null
    if (corner !== hoverCorner) {
      setHoverCorner(corner)
      const st = stageRef.current
      if (st && (corner || hoverCorner)) st.container().style.cursor = corner ? ROTATE_CURSOR : ''
    }
  }

  function ghostAt(raw: Point): Ghost | null {
    const current = usePlanStore.getState().plan
    if (!current) return null
    let best: Wall | null = null
    let bestD = Infinity
    for (const w of current.walls) {
      const d = distanceToSegment(raw, w.a, w.b)
      if (d <= Math.max(w.thickness / 2, 14 / cam.scale) && d < bestD) {
        best = w
        bestD = d
      }
    }
    if (!best) return null
    const spec = OPENING_PRESETS[tool === 'window' ? 'window' : doorPreset]
    const dir = wallDirection(best)
    const along = (raw.x - best.a.x) * dir.x + (raw.y - best.a.y) * dir.y
    const offset = fitOffset(current, best.id, spec.width, snapOffset(along - spec.width / 2))
    if (offset === null) return null
    const { label: _label, ...rest } = spec
    void _label
    return { wallId: best.id, opening: { ...rest, id: '__ghost', wallId: best.id, offset } }
  }

  const groupPick = (kind: SelKind, id: string, shift: boolean) => {
    const st = usePlanStore.getState()
    if (shift) {
      const cur: Selection = st.group ?? {
        ...emptySel(),
        walls: st.selectedWallId ? [st.selectedWallId] : [],
        openings: st.selectedOpeningId ? [st.selectedOpeningId] : [],
        furniture: st.selectedFurnitureId ? [st.selectedFurnitureId] : [],
      }
      st.setGroup(toggleSel(cur, kind, id))
      stageRef.current?.stopDrag()
      suppressClickUntil.current = Date.now() + 350
      return true
    }
    if (!selHas(st.group, kind, id)) return false
    startDrag('group-move', '')
    setDrag((d) => (d ? { ...d, pick: [kind, id] } : d))
    return true
  }

  // Furniture event handlers are created once and read the latest closures
  // through a ref, so FurnitureSymbol2D's memo holds: while one item is
  // dragged, the other items are not re-rendered on every pointer move.
  const furLatest = useRef<{ groupPick: (k: SelKind, id: string, s: boolean) => boolean; selectFurniture: typeof selectFurniture; startDrag: typeof startDrag }>({
    groupPick: () => false,
    selectFurniture,
    startDrag,
  })
  useLayoutEffect(() => {
    furLatest.current = { groupPick: (k, id, s) => groupPick(k, id, s), selectFurniture, startDrag }
  })
  const furnitureEvents = useMemo(() => {
    const idOf = (e: KonvaEventObject<Event>) => String(e.currentTarget.id()).slice(FUR_NODE_PREFIX.length)
    const press = (e: KonvaEventObject<MouseEvent | TouchEvent>, shift: boolean) => {
      e.cancelBubble = true
      const id = idOf(e)
      const l = furLatest.current
      if (l.groupPick('furniture', id, shift)) return
      l.selectFurniture(id)
      l.startDrag('fur-move', '', undefined, id)
    }
    const select = (e: KonvaEventObject<MouseEvent | TouchEvent>) => {
      e.cancelBubble = true
      furLatest.current.selectFurniture(idOf(e))
    }
    const cursor = (value: string) => (e: KonvaEventObject<MouseEvent>) => {
      const st = e.target.getStage()
      if (st) st.container().style.cursor = value
    }
    return {
      onMouseDown: (e: KonvaEventObject<MouseEvent>) => {
        if (e.evt.button !== 0) return
        press(e, e.evt.shiftKey)
      },
      onTouchStart: (e: KonvaEventObject<TouchEvent>) => press(e, false),
      onClick: select,
      onTap: select,
      onMouseEnter: cursor('move'),
      onMouseLeave: cursor(''),
    }
  }, [])
  const sortedFurniture = useMemo(
    () => [...(shown?.furniture ?? [])].sort((a, b) => furnitureLayer(a.type) - furnitureLayer(b.type)),
    [shown?.furniture],
  )


  const finishMarquee = () => {
    if (!marquee) return
    setMarquee(null)
    suppressClickUntil.current = Date.now() + 350
    const current = usePlanStore.getState().plan
    if (!current || Math.hypot(marquee.x1 - marquee.x0, marquee.y1 - marquee.y0) < DRAG_THRESHOLD_PX) return
    const st = usePlanStore.getState()
    const hit = withoutLocked(rectSel(current, cam, marquee), layerLocks())
    st.setGroup(marquee.add && st.group ? mergeSel(st.group, hit) : hit)
  }

  useEffect(() => {
    if (!marquee) return
    const up = () => finishMarquee()
    window.addEventListener('mouseup', up)
    return () => window.removeEventListener('mouseup', up)
  })

  const finishDrag = useCallback(() => {
    if (!drag) return
    if (drag.moved && preview) commit(preview)
    if (!drag.moved && drag.pick) {
      const st = usePlanStore.getState()
      const [kind, id] = drag.pick
      if (kind === 'walls') st.selectWall(id)
      else if (kind === 'openings') st.selectOpening(id)
      else if (kind === 'furniture') st.selectFurniture(id)
    }
    setGroupInfo(null)
    suppressClickUntil.current = Date.now() + 350
    setDrag(null)
    setPreview(null)
    setCursor(null)
  }, [commit, drag, preview])

  useEffect(() => {
    if (!drag) return
    const up = () => finishDrag()
    // The OS can cancel a touch (notification shade, incoming call, palm
    // rejection). Without this the drag stayed active and the next unrelated
    // finger move kept dragging the item. Discard the gesture instead.
    const cancel = () => {
      setGroupInfo(null)
      setDrag(null)
      setPreview(null)
      setCursor(null)
    }
    window.addEventListener('mouseup', up)
    window.addEventListener('touchend', up)
    window.addEventListener('touchcancel', cancel)
    return () => {
      window.removeEventListener('mouseup', up)
      window.removeEventListener('touchend', up)
      window.removeEventListener('touchcancel', cancel)
    }
  }, [drag, finishDrag])

  const setCam = (next: Camera) => setStoredCam(next)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    let start = 0
    const onStart = (e: Event) => {
      e.preventDefault()
      start = usePlanStore.getState().cam?.rotation ?? 0
    }
    const onChange = (e: Event) => {
      e.preventDefault()
      const g = e as Event & { rotation?: number; clientX?: number; clientY?: number }
      const current = usePlanStore.getState().cam
      if (!current || g.rotation === undefined) return
      const rect = el.getBoundingClientRect()
      const at = { x: (g.clientX ?? rect.width / 2 + rect.left) - rect.left, y: (g.clientY ?? rect.height / 2 + rect.top) - rect.top }
      setStoredCam(anchorAt({ ...current, rotation: normRot(start + g.rotation) }, toWorld(current, at), at))
    }
    el.addEventListener('gesturestart', onStart)
    el.addEventListener('gesturechange', onChange)
    return () => {
      el.removeEventListener('gesturestart', onStart)
      el.removeEventListener('gesturechange', onChange)
    }
  }, [containerRef, setStoredCam])

  const onWheel = (e: KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault()
    const pointer = stageRef.current?.getPointerPosition()
    if (!pointer) return
    const world = toWorld(cam, pointer)
    if (e.evt.altKey) {
      const d = Math.abs(e.evt.deltaY) > Math.abs(e.evt.deltaX) ? e.evt.deltaY : e.evt.deltaX
      const rotation = normRot(rot + d * 0.15)
      setCam(anchorAt({ ...cam, rotation }, world, pointer))
      return
    }
    const intensity = e.evt.ctrlKey ? 0.01 : 0.0015
    const scale = clampScale(cam.scale * Math.exp(-e.evt.deltaY * intensity))
    setCam(anchorAt({ ...cam, scale }, world, pointer))
  }

  const onStageClick = (e: KonvaEventObject<MouseEvent | TouchEvent>) => {
    // Touch: Konva fires `tap` from its own touchend, before the window
    // touchend listener finishes the drag. A drag in progress means this tap
    // ended a press on an item (which stops listening while dragged), not a
    // tap on empty canvas — don't clear the selection.
    if (drag) return
    if (panRef.current) {
      panRef.current = false
      return
    }
    if (Date.now() < suppressClickUntil.current) return
    if ('button' in e.evt && e.evt.button !== 0) return
    setCtxMenu(null)
    if (tool === 'erase') {
      const raw = worldPointer()
      const current = usePlanStore.getState().plan
      if (!raw || !current || viewOnly) return
      const tol = ERASE_TOL_PX / cam.scale
      const hit = eraseTargetAt(current, raw, tol, layerLocks())
      if (hit) {
        selectWall(null)
        commit(eraseTarget(current, hit))
        setEraseHover(null)
        return
      }
      // Nothing erasable here, but a locked layer has something: say why.
      const lockedHit = eraseTargetAt(current, raw, tol, {})
      if (lockedHit) lockedToast(lockedHit.kind === 'openings' ? 'walls' : lockedHit.kind)
      return
    }
    if (tool === 'zone') {
      const raw = worldPointer()
      const current = usePlanStore.getState().plan
      if (!raw || !current) return
      const pt = snapZonePoint(raw, current, cam.scale, zoneDraft.at(-1) ?? null, e.evt.shiftKey || shiftDown)
      const first = zoneDraft[0]
      if (first && zoneDraft.length >= 3 && Math.hypot(first.x - pt.x, first.y - pt.y) * cam.scale < 12) {
        finishZone(zoneDraft)
        return
      }
      setZoneDraft([...zoneDraft, pt])
      return
    }
    if (tool === 'measure') {
      const raw = worldPointer()
      if (!raw) return
      const from = activeMeasure?.points.at(-1) ?? null
      const pt = e.evt.altKey ? raw : snapMeasure(raw, targets, cam.scale, from, e.evt.shiftKey || shiftDown).point
      const chain = e.evt.metaKey || e.evt.ctrlKey
      if (!activeMeasure) setActiveMeasure({ points: [pt] })
      else if (chain) setActiveMeasure({ points: [...activeMeasure.points, pt] })
      else {
        setMeasures((m) => [...m, { points: [...activeMeasure.points, pt] }])
        setActiveMeasure(null)
      }
      return
    }
    if (tool === 'select') {
      if (e.target === stageRef.current) selectWall(null)
      return
    }
    if (tool === 'building') {
      const at = worldPointer()
      if (!at || !buildingWallAt(at)) {
        usePlanStore.getState().setGroup(null)
        setTool('select')
      }
      return
    }
    if (tool === 'door' || tool === 'window') {
      const raw = worldPointer()
      const g = raw ? ghostAt(raw) : null
      if (!g || !plan) return
      const { id: _id, wallId: _w, offset, ...spec } = g.opening
      void _id
      void _w
      const res = addOpening(plan, g.wallId, spec, offset)
      if (res) {
        commit(res.plan)
        selectOpening(res.id)
      }
      return
    }
    if (skipWallClick.current) {
      skipWallClick.current = false
      return
    }
    const raw = worldPointer()
    if (!raw || !plan) return
    const snap = snapPoint(raw, plan.walls, cam.scale, draftStart, e.evt.shiftKey || shiftDown)
    if (!draftStart) {
      setDraftStart(snap.point)
      setCursor(snap)
      return
    }
    if (snap.point.x === draftStart.x && snap.point.y === draftStart.y) {
      setDraftStart(null)
      return
    }
    addWall(draftStart, snap.point)
    setDraftStart(snap.kind === 'endpoint' ? null : snap.point)
    setCursor(snap)
  }

  const applyLength = () => {
    if (!lengthEdit || !plan) return
    const mm = parseLength(lengthEdit.value)
    setLengthEdit(null)
    if (mm === null || !(mm > 0)) return
    commit(setWallLength(plan, lengthEdit.wallId, mm))
  }

  const activeMaterial = plan ? findMaterial(plan, activeMaterialId ?? undefined) : undefined
  const draftThickness = activeMaterial?.thickness ?? 200
  const site = plan ? sitePolygon(plan.site) : []
  const cursorPoint = cursor?.point ?? null
  const wallsCenter = useMemo(() => {
    const walls = plan?.walls ?? []
    if (walls.length === 0) return undefined
    const sum = walls.reduce((acc, w) => ({ x: acc.x + w.a.x + w.b.x, y: acc.y + w.a.y + w.b.y }), { x: 0, y: 0 })
    return { x: sum.x / (walls.length * 2), y: sum.y / (walls.length * 2) }
  }, [plan?.walls])

  const selectedWall = shown?.walls.find((w) => w.id === selectedWallId)
  const movingIds = useMemo(() => {
    if (!drag || !plan) return new Set<string>()
    if (drag.kind !== 'move' && drag.kind !== 'a' && drag.kind !== 'b') return new Set<string>()
    const refs = drag.kind === 'move' ? wallMoveGroup(plan, drag.wallId, false) : endpointGroup(plan, { wallId: drag.wallId, end: drag.kind }, false)
    return new Set(refs.map((r) => r.wallId))
  }, [drag, plan])

  const buttonsAlong = (w: Wall) => {
    const len = wallLength(w)
    const half = 70 / cam.scale
    const spans = (shown?.openings ?? []).filter((o) => o.wallId === w.id).map((o) => [o.offset - half, o.offset + o.width + half])
    const free = (p: number) => spans.every(([s0, e0]) => p < s0 || p > e0)
    const step = 10 / cam.scale
    for (let d = 0; d <= len / 2; d += step) {
      if (free(len / 2 + d)) return len / 2 + d
      if (free(len / 2 - d)) return len / 2 - d
    }
    return len / 2
  }
  const targets = useMemo(() => (plan ? measureTargets(plan) : { points: [], segments: [] }), [plan])
  const detection = useMemo(() => detectRooms(shown ?? NO_PLAN), [shown])
  const findRoomAt = (p: Point): RoomFace | null => {
    for (const b of detection.buildings) for (const r of b.rooms) if (pointInPolygon(p, r.clearPolygon)) return r
    return null
  }
  const chainSum = activeMeasure && activeMeasure.points.length > 1 ? polylineLength(activeMeasure.points) : null
  const roomEditItem = roomEdit && shown?.rooms?.find((r) => r.id === roomEdit.id)
  const roomEditPos = roomEditItem ? toScreen(cam, roomEditItem) : null
  const commitRoomName = () => {
    if (!roomEdit || !plan) return
    const name = roomEdit.value.trim()
    const rooms = plan.rooms ?? []
    setRoomEdit(null)
    commit({
      ...plan,
      rooms: name ? rooms.map((r) => (r.id === roomEdit.id ? { ...r, name } : r)) : rooms.filter((r) => r.id !== roomEdit.id),
    })
  }
  const addRoomLabel = (at: Point) => {
    if (!plan) return
    const rooms = plan.rooms ?? []
    const used = new Set(rooms.map((r) => r.id))
    let n = rooms.length + 1
    while (used.has(`r${n}`)) n += 1
    const id = `r${n}`
    const name = t('canvas.defaultRoomName')
    commit({ ...plan, rooms: [...rooms, { id, name, x: snapOffset(at.x), y: snapOffset(at.y) }] })
    setRoomEdit({ id, value: name })
    setCtxMenu(null)
  }

  const groupBounds = group && shown ? selBounds(shown, group) : null
  const buildingWallAt = (at: Point): string | null => {
    const b = detection.buildings.find((x) => pointInPolygon(at, x.footprint))
    if (b?.walls[0]) return b.walls[0].id
    return plan?.walls.find((w) => distanceToSegment(at, w.a, w.b) <= Math.max(w.thickness / 2, 6 / cam.scale))?.id ?? null
  }
  const groupPolygons = group && shown ? groupPolys(shown, detection.buildings, group) : []
  const groupCorners = groupPolygons.flat()
  const groupCenter = polysCenter(groupPolygons)
  const guides = group && shown && drag?.moved && drag.kind === 'group-move' ? groupGuides(shown, detection.buildings, group) : []
  const moveHandleAt = (() => {
    if (!groupCorners.length) return null
    const pts = groupCorners.map((c) => toScreen(cam, c))
    const xs = pts.map((p) => p.x)
    const maxY = Math.max(...pts.map((p) => p.y))
    return toWorld(cam, { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: maxY + 30 })
  })()
  const selFurniture = shown?.furniture.find((f) => f.id === selectedFurnitureId)
  const selOpening = shown?.openings.find((o) => o.id === selectedOpeningId)
  const selOpeningWall = selOpening && shown?.walls.find((w) => w.id === selOpening.wallId)
  const ghostWall = ghost && shown?.walls.find((w) => w.id === ghost.wallId)
  const dimOpening = ghost?.opening ?? selOpening
  const dimWall = ghost ? ghostWall : selOpeningWall

  const editWall = lengthEdit && shown?.walls.find((w) => w.id === lengthEdit.wallId)
  const editPos = editWall
    ? (() => {
        const p = labelAnchor(editWall.a, editWall.b, cam.scale, editWall.thickness / 2, wallsCenter)
        const sp = toScreen(cam, p)
        return { left: sp.x, top: sp.y }
      })()
    : null

  return (
    <div
      ref={containerRef}
      onDoubleClick={(e) => {
        const stage = stageRef.current
        if (tool !== 'select' || viewOnly || !locks.walls || !stage || !plan) return
        stage.setPointersPositions(e.nativeEvent)
        const at = stage.getRelativePointerPosition()
        if (at && plan.walls.some((w) => distanceToSegment(at, w.a, w.b) <= Math.max(w.thickness / 2, 6 / cam.scale)))
          showToast(t('canvas.moveHouseHint'))
      }}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('text/x-furniture') || e.dataTransfer.types.includes('text/x-room-template')) {
          e.preventDefault()
          e.dataTransfer.dropEffect = 'copy'
        }
      }}
      onDrop={(e) => {
        const type = e.dataTransfer.getData('text/x-furniture')
        const setId = e.dataTransfer.getData('text/x-room-template')
        const stage = stageRef.current
        const current = usePlanStore.getState().plan
        if ((!type && !setId) || !stage || !current) return
        e.preventDefault()
        if (layerLocks().furniture) {
          lockedToast('furniture')
          return
        }
        stage.setPointersPositions(e.nativeEvent)
        const p = stage.getRelativePointerPosition()
        if (!p) return
        const tpl = setId ? roomTemplate(setId) : undefined
        if (tpl) {
          const res = placeTemplate(current, tpl, p)
          commit(res.plan)
          setTool('select')
          usePlanStore.getState().setGroup({ ...emptySel(), furniture: res.ids })
          return
        }
        const placed = placeAgainstWall(current.walls, type, { x: snapOffset(p.x), y: snapOffset(p.y) }, WALL_SNAP_PX / cam.scale)
        const res = addFurniture(current, { type, ...placed })
        commit(res.plan)
        setTool('select')
        selectFurniture(res.id)
      }}
      className={`plan-canvas plan-canvas--${tool} ${drag?.moved ? 'plan-canvas--dragging' : ''}`}>
      {ready && (
        <Stage
          ref={stageRef}
          width={size.width}
          height={size.height}
          x={cam.x}
          y={cam.y}
          scaleX={cam.scale}
          scaleY={cam.scale}
          rotation={rot}
          draggable={(tool === 'select' || tool === 'building' || tool === 'erase') && !drag && !pinchRef.current && !marquee && !aligning}
          dragDistance={6}
          onDragStart={(e) => {
            if (e.target === stageRef.current) panRef.current = true
          }}
          onDragMove={(e) => {
            if (e.target === stageRef.current) setCam({ ...cam, x: e.target.x(), y: e.target.y() })
          }}
          onDragEnd={(e) => {
            if (e.target !== stageRef.current) return
            setCam({ ...cam, x: e.target.x(), y: e.target.y() })
            // A mouse pan is followed by a click within milliseconds; a touch pan
            // by none. A short window (not a flag left set) keeps the next real
            // tap from being swallowed after panning on a phone.
            panRef.current = false
            suppressClickUntil.current = Date.now() + 250
          }}
          onWheel={onWheel}
          onMouseMove={onMouseMove}
          onTouchStart={onStageTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onMouseDown={(e) => {
            if ('button' in e.evt && e.evt.button === 1) {
              e.evt.preventDefault()
              middlePanRef.current = { x: e.evt.clientX, y: e.evt.clientY, camX: cam.x, camY: cam.y }
              return
            }
            if (tool === 'wall' && 'button' in e.evt && e.evt.button === 0 && e.target === stageRef.current) {
              const raw = worldPointer()
              if (raw && plan) {
                const snap = snapPoint(raw, plan.walls, cam.scale, draftStart, e.evt.shiftKey || shiftDown)
                if (!draftStart) {
                  setDraftStart(snap.point)
                  wallDragStartRef.current = snap.point
                }
              }
              return
            }
            if (hoverCorner && (tool === 'select' || tool === 'building') && !viewOnly && e.target === stageRef.current && e.evt.button === 0) {
              const corner = hoverCorner
              const altPivot = groupCorners.reduce((m, c) =>
                Math.hypot(c.x - corner.x, c.y - corner.y) > Math.hypot(m.x - corner.x, m.y - corner.y) ? c : m,
              )
              stageRef.current?.stopDrag()
              startDrag('group-rot', '')
              setDrag((d) => (d ? { ...d, pivot: groupCenter ?? undefined, altPivot } : d))
              setHoverCorner(null)
              return
            }
            if (tool === 'building' && !viewOnly && !aligning && e.evt.button === 0 && plan) {
              const at = worldPointer()
              const wallId = at ? buildingWallAt(at) : null
              if (!wallId) return
              const st = usePlanStore.getState()
              if (!selHas(st.group, 'walls', wallId)) st.setGroup(buildingSel(plan, wallId))
              stageRef.current?.stopDrag()
              startDrag('group-move', '')
              return
            }
            if (tool === 'select' && !viewOnly && !aligning && e.target === stageRef.current && e.evt.button === 0 && layers.walls && locks.walls) {
              const at = worldPointer()
              if (at && plan?.walls.some((w) => distanceToSegment(at, w.a, w.b) <= Math.max(w.thickness / 2, 6 / cam.scale))) lockedToast('walls')
            }
            if (tool !== 'select' || viewOnly || aligning || e.target !== stageRef.current || e.evt.button !== 0 || !e.evt.shiftKey) return
            const sp = screenPointer()
            if (!sp) return
            stageRef.current?.stopDrag()
            setMarquee({ x0: sp.x, y0: sp.y, x1: sp.x, y1: sp.y, add: true })
          }}
          onMouseUp={() => {
            finishMarquee()
            finishDrag()
            middlePanRef.current = null
            if (tool === 'wall' && wallDragStartRef.current && draftStart && plan) {
              const raw = worldPointer()
              if (raw) {
                const snap = snapPoint(raw, plan.walls, cam.scale, draftStart, shiftDown)
                const d = Math.hypot(snap.point.x - wallDragStartRef.current.x, snap.point.y - wallDragStartRef.current.y)
                if (d >= 200) {
                  addWall(draftStart, snap.point)
                  setDraftStart(snap.kind === 'endpoint' ? null : snap.point)
                  suppressClickUntil.current = Date.now() + 300
                } else {
                  // A plain click: the press already set the start point. Skip
                  // exactly the click that follows, which would otherwise see
                  // "same point" and cancel it (click-click drawing never started).
                  skipWallClick.current = true
                }
              }
              wallDragStartRef.current = null
            }
          }}
          onMouseLeave={() => {
            setHoverRoom(null)
            if (!drag) setCursor(null)
            onCursor?.(null, cam.scale)
          }}
          onClick={(e) => {
            // Phones send a synthetic mouse click right after a tap. Handling
            // both ran every tap twice (wall taps cancelled themselves, the
            // eraser deleted two layers), so a click just after a tap is ignored.
            if (Date.now() - lastTapAt.current < 700) return
            onStageClick(e)
          }}
          onTap={(e) => {
            lastTapAt.current = Date.now()
            onStageClick(e)
          }}
          onDblClick={() => {
            setDraftStart(null)
            if (tool !== 'select' || viewOnly) return
            const at = worldPointer()
            const hitWall = at && plan?.walls.find((w) => distanceToSegment(at, w.a, w.b) <= Math.max(w.thickness / 2, 6 / cam.scale))
            if (hitWall && plan && locks.walls) return
            if (hitWall && plan) {
              usePlanStore.getState().setGroup(buildingSel(plan, hitWall.id))
              return
            }
            const face = at ? findRoomAt(at) : null
            const id = face?.labelIds[0]
            const r = id ? plan?.rooms?.find((x) => x.id === id) : null
            if (r) setRoomEdit({ id: r.id, value: r.name })
            else if (face && at) addRoomLabel(at)
          }}
          onContextMenu={(e) => {
            e.evt.preventDefault()
            setDraftStart(null)
            if (tool !== 'select' || viewOnly) return
            const at = worldPointer()
            const sp = screenPointer()
            if (!at || !sp) return
            const inside = detection.buildings.some((b) => b.rooms.some((r) => pointInPolygon(at, r.clearPolygon)))
            setCtxMenu(inside ? { left: sp.x, top: sp.y, at } : null)
          }}
        >
          <Layer listening={false}>
            {!underlay.on && (
              <Line
                points={site.flatMap((p) => [p.x, p.y])}
                closed
                fill={canvasTheme.site}
                shadowColor="rgba(40,30,20,0.12)"
                shadowBlur={24}
                shadowOffsetY={4}
                shadowForStrokeEnabled={false}
              />
            )}
            {Underlay && plan && (
              <Underlay
                plan={plan}
                view={{ x: cam.x, y: cam.y, scale: cam.scale, width: size.width, height: size.height, rotationDeg: rot }}
                opacity={underlay.opacity}
                geo={align.shown}
                imagery={align.imagery}
              />
            )}
            <Grid cam={cam} width={size.width} height={size.height} opacity={underlay.on ? 0.45 : 1} />
            <Line
              points={site.flatMap((p) => [p.x, p.y])}
              closed
              stroke={underlay.on ? '#ffffff' : canvasTheme.siteStroke}
              strokeWidth={(underlay.on ? 2.5 : 1.5) / cam.scale}
              dash={[10 / cam.scale, 6 / cam.scale]}
            />
          </Layer>
          {shown && (
            <Layer opacity={baseOpacity}>
              {layers.zones && (shown.site.zones ?? []).map((z) => (
                <ZoneShape
                  key={z.id}
                  zone={z}
                  scale={cam.scale}
                  viewRot={rot}
                  listening={tool === 'select' && !drag && !aligning && !viewOnly && !locks.zones}
                  showDims={z.id === hoverZone || z.id === selectedZoneId}
                  selected={z.id === selectedZoneId && !viewOnly}
                  onSelect={selectZone}
                  onHover={setHoverZone}
                  onVertexDown={(i) => startDrag('zone-vertex', '', undefined, undefined, undefined, z.id, i)}
                  onSideDblClick={(i, at) => {
                    const current = usePlanStore.getState().plan
                    const zz = current?.site.zones?.find((x) => x.id === z.id)
                    if (!current || !zz) return
                    const p = snapZonePoint(at, current, cam.scale, null, false)
                    const polygon = [...zz.polygon.slice(0, i + 1), p, ...zz.polygon.slice(i + 1)]
                    commit(updateZone(current, z.id, { polygon }))
                  }}
                  worldPointer={worldPointer}
                />
              ))}
              {layers.furniture && sortedFurniture.map((f) => (
                <FurnitureSymbol2D
                  key={f.id}
                  id={FUR_NODE_PREFIX + f.id}
                  item={f}
                  selected={f.id === selectedFurnitureId || selHas(group, 'furniture', f.id)}
                  listening={tool === 'select' && !drag && !aligning && !viewOnly && !locks.furniture}
                  {...furnitureEvents}
                />
              ))}
              {layers.walls && shown.walls.map((w) => (
                <WallOutline key={`o-${w.id}`} wall={w} scale={cam.scale} selected={w.id === selectedWallId || selHas(group, 'walls', w.id)} />
              ))}
              {layers.walls && shown.walls.map((w) => (
                <WallFill
                  key={`f-${w.id}`}
                  wall={w}
                  color={wallColor(shown, w)}
                  scale={cam.scale}
                  listening={tool === 'select' && !drag && !aligning && !viewOnly && !locks.walls}
                  selected={w.id === selectedWallId || selHas(group, 'walls', w.id)}
                  onSelect={selectWall}
                  onDragStart={(id, e) => {
                    if (groupPick('walls', id, e.evt.shiftKey)) return
                    selectWall(id)
                    startDrag('move', id)
                  }}
                  onHover={setHoverWall}
                />
              ))}
              {layers.walls && shown.openings.map((o) => {
                const wall = shown.walls.find((w) => w.id === o.wallId)
                return wall ? (
                  <OpeningShape
                    key={o.id}
                    wall={wall}
                    opening={o}
                    scale={cam.scale}
                    selected={o.id === selectedOpeningId || selHas(group, 'openings', o.id)}
                    listening={tool === 'select' && !drag && !aligning && !viewOnly && !locks.walls}
                    onPointerDown={(id, e) => {
                      if (groupPick('openings', id, e.evt.shiftKey)) return
                      selectOpening(id)
                      startDrag('op-move', wall.id, id)
                    }}
                  />
                ) : null
              })}
              {ghostWall && ghost && (
                <OpeningShape wall={ghostWall} opening={ghost.opening} scale={cam.scale} ghost selected />
              )}
              {shown.walls.map((w) =>
                lengthEdit?.wallId === w.id ||
                !(showDims || w.id === selectedWallId || w.id === hoverWall || (!!drag && movingIds.has(w.id))) ? null : (
                  <LengthLabel
                    key={`l-${w.id}`}
                    a={w.a}
                    b={w.b}
                    scale={cam.scale}
                    gap={w.thickness / 2}
                    accent={w.id === selectedWallId || (!!drag && movingIds.has(w.id))}
                    away={wallsCenter}
                    viewRot={rot}
                    onClick={tool === 'select' && !drag && !viewOnly && !locks.walls ? () => selectWall(w.id) : undefined}
                    onDblClick={
                      tool === 'select' && !drag && !viewOnly && !locks.walls
                        ? () => {
                            selectWall(w.id)
                            setLengthEdit({ wallId: w.id, value: formatLengthInput(wallLength(w)) })
                          }
                        : undefined
                    }
                  />
                ),
              )}
              {hoverRoom && !drag && !viewOnly && tool === 'select' && (
                <RoomHover room={hoverRoom} scale={cam.scale} viewRot={rot} />
              )}
              {tool === 'select' && !viewOnly && !locks.walls && selectedWall && (
                <Handles
                  wall={selectedWall}
                  scale={cam.scale}
                  viewRot={rot}
                  buttonsAt={buttonsAlong(selectedWall)}
                  onStart={(kind) => startDrag(kind, selectedWall.id)}
                  onAdd={(type) => {
                    if (!plan || drag) return
                    const spec = OPENING_PRESETS[type === 'window' ? 'window' : doorPreset]
                    const { label: _l, ...rest } = spec
                    void _l
                    const at = fitOffsetClear(plan, selectedWall.id, spec.width, Math.round((wallLength(selectedWall) - spec.width) / 2))
                    const res = at === null ? null : addOpening(plan, selectedWall.id, rest, at)
                    if (res) {
                      commit(res.plan)
                      selectOpening(res.id)
                    } else showToast(t('canvas.noRoomOnWall'))
                  }}
                />
              )}
              {dimWall && dimOpening && shown && (
                <Dimensions
                  wall={dimWall}
                  scale={cam.scale}
                  toward={wallsCenter}
                  viewRot={rot}
                  spans={(() => {
                    const g = openingGaps(shown, dimWall.id, dimOpening.offset, dimOpening.width, dimOpening.id)
                    return g ? [g.before, [dimOpening.offset, dimOpening.offset + dimOpening.width], g.after] : []
                  })()}
                />
              )}
              {tool === 'select' && !viewOnly && !locks.furniture && selFurniture && (
                <FurnitureHandles
                  item={selFurniture}
                  scale={cam.scale}
                  onStartRotate={() => startDrag('fur-rot', '', undefined, selFurniture.id)}
                  onStartResize={(handle) => {
                    const r = resolveFurniture(selFurniture)
                    startDrag('fur-resize', '', undefined, selFurniture.id, undefined, undefined, undefined, {
                      handle,
                      initialW: r.w,
                      initialD: r.d,
                      initialX: selFurniture.x,
                      initialY: selFurniture.y,
                      initialRot: selFurniture.rotationDeg,
                    })
                  }}
                />
              )}
              {tool === 'select' && !viewOnly && !locks.walls && selOpening && selOpeningWall && (
                <OpeningHandles
                  wall={selOpeningWall}
                  opening={selOpening}
                  scale={cam.scale}
                  onStart={(edge) => startDrag(edge, selOpeningWall.id, selOpening.id)}
                />
              )}
              {(tool === 'select' || tool === 'building') && !viewOnly && groupBounds && (
                <GroupOverlay
                  bounds={groupBounds}
                  scale={cam.scale}
                  onRotateStart={drag ? undefined : () => startDrag('group-rot', '')}
                />
              )}
              {(tool === 'select' || tool === 'building') && !viewOnly && group && hoverCorner && groupCenter && !drag && (
                <CornerHint corner={hoverCorner} center={groupCenter} scale={cam.scale} />
              )}
              {(tool === 'select' || tool === 'building') && !viewOnly && group && moveHandleAt && (!drag || drag.kind === 'group-move') && (
                <MoveHandle at={moveHandleAt} scale={cam.scale} viewRot={rot} onStart={() => startDrag('group-move', '')} />
              )}
              {guides.length > 0 && <GuideLines guides={guides} scale={cam.scale} />}
            </Layer>
          )}
          {shown && (
            <HeatingLayer plan={shown} scale={cam.scale} viewRot={rot} worldPointer={worldPointer} interactive={!viewOnly && !aligning && !drag && !locks.heating} />
          )}
          {shown && (
            <SewerLayer plan={shown} scale={cam.scale} viewRot={rot} worldPointer={worldPointer} interactive={!viewOnly && !aligning && !drag && !locks.sewer} />
          )}
          {shown && (
            <WaterLayer plan={shown} scale={cam.scale} viewRot={rot} worldPointer={worldPointer} interactive={!viewOnly && !aligning && !drag && !locks.water} />
          )}
          {shown && (
            <ElectricLayer plan={shown} scale={cam.scale} viewRot={rot} worldPointer={worldPointer} interactive={!viewOnly && !aligning && !drag && !locks.electric} />
          )}
          <Layer listening={false}>
            {tool === 'erase' && eraseHover && shown && <EraseHighlight plan={shown} target={eraseHover} scale={cam.scale} />}
            {tool === 'zone' && zoneDraft.length > 0 && (
              <>
                <Line
                  points={[...zoneDraft, ...(zoneCursor ? [zoneCursor] : [])].flatMap((p) => [p.x, p.y])}
                  stroke={canvasTheme.accent}
                  strokeWidth={1.8 / cam.scale}
                  fill="rgba(242, 107, 29, 0.06)"
                  closed={zoneDraft.length >= 2}
                  dash={[6 / cam.scale, 4 / cam.scale]}
                />
                {zoneDraft.map((p, i) => (
                  <Circle key={i} x={p.x} y={p.y} radius={(i === 0 ? 6 : 3.5) / cam.scale} fill={i === 0 ? '#ffffff' : canvasTheme.accent} stroke={canvasTheme.accent} strokeWidth={1.5 / cam.scale} />
                ))}
                {zoneCursor && (
                  <LengthLabel a={zoneDraft[zoneDraft.length - 1]} b={zoneCursor} scale={cam.scale} gap={0} accent viewRot={rot} />
                )}
              </>
            )}
            {tool === 'zone' && zoneCursor && (
              <Circle x={zoneCursor.x} y={zoneCursor.y} radius={4 / cam.scale} fill={canvasTheme.accent} />
            )}
            {tool === 'measure' && (
              <MeasureLayer measures={measures} active={activeMeasure} cursor={measureCursor} scale={cam.scale} viewRot={rot} />
            )}
            {tool !== 'measure' && measures.length > 0 && (
              <MeasureLayer measures={measures} active={null} cursor={null} scale={cam.scale} viewRot={rot} />
            )}
            {tool === 'wall' && draftStart && (
              <Circle
                name="wall-draft-start"
                x={draftStart.x}
                y={draftStart.y}
                radius={6 / cam.scale}
                fill={canvasTheme.accent}
                stroke="#ffffff"
                strokeWidth={2 / cam.scale}
                listening={false}
              />
            )}
            {tool === 'wall' && draftStart && cursorPoint && (cursorPoint.x !== draftStart.x || cursorPoint.y !== draftStart.y) && (
              <>
                <Line
                  points={[draftStart.x, draftStart.y, cursorPoint.x, cursorPoint.y]}
                  stroke={materialColor(activeMaterial)}
                  opacity={0.6}
                  strokeWidth={draftThickness}
                  lineCap="square"
                />
                <Line
                  points={[draftStart.x, draftStart.y, cursorPoint.x, cursorPoint.y]}
                  stroke={canvasTheme.accent}
                  strokeWidth={1.5 / cam.scale}
                  dash={[6 / cam.scale, 4 / cam.scale]}
                />
                <LengthLabel a={draftStart} b={cursorPoint} scale={cam.scale} gap={draftThickness / 2} accent viewRot={rot} />
              </>
            )}
            {(tool === 'wall' || (drag?.moved && drag.kind !== 'move' && drag.kind !== 'group-move' && drag.kind !== 'group-rot')) && cursorPoint && (
              <Circle
                x={cursorPoint.x}
                y={cursorPoint.y}
                radius={(cursor?.kind === 'endpoint' ? 9 : 4) / cam.scale}
                fill={cursor?.kind === 'endpoint' ? canvasTheme.accentSoft : canvasTheme.accent}
                stroke={canvasTheme.accent}
                strokeWidth={1.5 / cam.scale}
              />
            )}
          </Layer>
          {aligning && underlayMods && (
            <Layer>
              <underlayMods.Overlay
                align={align}
                view={{ x: cam.x, y: cam.y, scale: cam.scale, width: size.width, height: size.height, rotationDeg: rot }}
              />
            </Layer>
          )}
          {rot === 0 && (
            <Layer
              listening={false}
              x={-cam.x / cam.scale}
              y={-cam.y / cam.scale}
              scaleX={1 / cam.scale}
              scaleY={1 / cam.scale}
            >
              <Rulers cam={cam} width={size.width} height={size.height} cursor={cursorPoint} top={rulerTop()} />
            </Layer>
          )}
        </Stage>
      )}
      {aligning && underlayMods && (
        <div className="align-controls card">
          <div className="align-controls__head">
            <strong>{t('canvas.alignTitle')}</strong>
            <span className="muted">{t('canvas.alignHint')}</span>
          </div>
          <underlayMods.Controls align={align} />
        </div>
      )}
      {ready && plan && (
        <ViewControls
          rotation={rot}
          northUp={plan.site.geo ? normRot(-90 - northAngle(plan.site.geo.rotationDeg)) : null}
          onRotate={(rotation, fit) => {
            if (fit) {
              setCam(fitCamera(sitePolygon(plan.site), size.width, size.height, fitPadding(containerRef.current), normRot(rotation)))
              return
            }
            const center = { x: size.width / 2, y: size.height / 2 }
            setCam(anchorAt({ ...cam, rotation: normRot(rotation) }, toWorld(cam, center), center))
          }}
        />
      )}
      {marquee && (
        <div
          className="marquee"
          style={{
            left: Math.min(marquee.x0, marquee.x1),
            top: Math.min(marquee.y0, marquee.y1),
            width: Math.abs(marquee.x1 - marquee.x0),
            height: Math.abs(marquee.y1 - marquee.y0),
          }}
        />
      )}
      {guides.map((g, i) => {
        const at = toScreen(cam, { x: (g.a.x + g.b.x) / 2, y: (g.a.y + g.b.y) / 2 })
        return (
          <div key={i} className="group-delta group-delta--guide" style={{ left: at.x, top: at.y }}>
            {formatLength(g.d)}
          </div>
        )
      })}
      {groupInfo && drag?.moved && (
        <div className="group-delta" style={{ left: groupInfo.at.x, top: groupInfo.at.y - 14 }}>
          {groupInfo.text}
        </div>
      )}
      {ctxMenu && (
        <div className="ctx-menu card" style={{ left: ctxMenu.left, top: ctxMenu.top }}>
          <button className="menu__item" onClick={() => addRoomLabel(ctxMenu.at)}>
            {t('canvas.labelRoom')}
          </button>
        </div>
      )}
      {roomEdit && roomEditPos && (
        <form
          className="length-edit"
          style={{ left: roomEditPos.x, top: roomEditPos.y }}
          onSubmit={(e) => {
            e.preventDefault()
            commitRoomName()
          }}
        >
          <input
            autoFocus
            className="length-edit__input room-edit__input"
            value={roomEdit.value}
            onChange={(e) => setRoomEdit({ ...roomEdit, value: e.target.value })}
            onFocus={(e) => e.target.select()}
            onBlur={commitRoomName}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.stopPropagation()
                setRoomEdit(null)
              }
            }}
          />
        </form>
      )}
      {tool === 'measure' && (
        <div className="measure-hint card">
          {chainSum !== null
            ? t('canvas.measureSum', { sum: formatLength(chainSum) })
            : t('canvas.measureHint')}
        </div>
      )}
      {lengthEdit && editPos && (
        <form
          className="length-edit"
          style={{ left: editPos.left, top: editPos.top }}
          onSubmit={(e) => {
            e.preventDefault()
            applyLength()
          }}
        >
          <input
            autoFocus
            className="length-edit__input"
            value={lengthEdit.value}
            onChange={(e) => setLengthEdit({ ...lengthEdit, value: e.target.value })}
            onFocus={(e) => e.target.select()}
            onBlur={applyLength}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.stopPropagation()
                setLengthEdit(null)
              }
            }}
          />
          <span className="length-edit__unit">{lengthSuffix()}</span>
        </form>
      )}
      {tool === 'wall' && draftStart && !viewOnly && (
        <button
          type="button"
          className="btn btn--sm btn--primary wall-done"
          onClick={() => {
            setDraftStart(null)
            setCursor(null)
          }}
        >
          ✓ {t('plan:toolbar.finishWall')}
        </button>
      )}
    </div>
  )
}
