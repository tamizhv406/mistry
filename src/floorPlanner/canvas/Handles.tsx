import { Circle, Group, Line, Rect, Text } from 'react-konva'
import { t } from '../i18n'
import type { KonvaEventObject } from 'konva/lib/Node'
import type { Opening, Wall } from '../model'
import { resolveFurniture, type FurnitureItem } from '../furniture/catalog'
import { readableAngle } from './camera'
import { canvasTheme } from './theme'

export type HandleKind = 'a' | 'b' | 'move'

type Props = {
  wall: Wall
  scale: number
  onStart: (kind: HandleKind, e: KonvaEventObject<MouseEvent | TouchEvent>) => void
  onAdd?: (type: 'door' | 'window') => void
  viewRot?: number
  buttonsAt?: number
}

const R = 8.5

export function Handles({ wall, scale, onStart, onAdd, viewRot = 0, buttonsAt }: Props) {
  const px = 1 / scale
  const start = (kind: HandleKind) => (e: KonvaEventObject<MouseEvent | TouchEvent>) => {
    if ('button' in e.evt && e.evt.button !== 0) return
    e.cancelBubble = true
    onStart(kind, e)
  }
  const cursor = (value: string) => (e: KonvaEventObject<MouseEvent>) => {
    const stage = e.target.getStage()
    if (stage) stage.container().style.cursor = value
  }
  const mid = { x: (wall.a.x + wall.b.x) / 2, y: (wall.a.y + wall.b.y) / 2 }
  const angle = (Math.atan2(wall.b.y - wall.a.y, wall.b.x - wall.a.x) * 180) / Math.PI
  const arm = 5

  return (
    <>
      {(['a', 'b'] as const).map((end) => (
        <Circle
          key={end}
          x={wall[end].x}
          y={wall[end].y}
          radius={R * px}
          hitStrokeWidth={18 * px}
          fill="#ffffff"
          stroke={canvasTheme.accent}
          strokeWidth={3 * px}
          shadowColor="rgba(0,0,0,0.3)"
          shadowBlur={5 * px}
          shadowOffsetY={1.5 * px}
          onMouseDown={start(end)}
          onTouchStart={start(end)}
          onMouseEnter={cursor('crosshair')}
          onMouseLeave={cursor('')}
        />
      ))}
      <Group
        x={mid.x}
        y={mid.y}
        rotation={angle}
        scaleX={px}
        scaleY={px}
        onMouseDown={start('move')}
        onTouchStart={start('move')}
        onMouseEnter={cursor('move')}
        onMouseLeave={cursor('')}
      >
        <Circle radius={R + 3} fill={canvasTheme.accent} stroke="#ffffff" strokeWidth={2.2} hitStrokeWidth={16} />
        <Line points={[-arm, 0, arm, 0]} stroke="#ffffff" strokeWidth={2} lineCap="round" listening={false} />
        <Line points={[0, -arm, 0, arm]} stroke="#ffffff" strokeWidth={2} lineCap="round" listening={false} />
      </Group>
      {onAdd && (
        <Group
          x={buttonsAt === undefined ? mid.x : wall.a.x + ((wall.b.x - wall.a.x) / (Math.hypot(wall.b.x - wall.a.x, wall.b.y - wall.a.y) || 1)) * buttonsAt}
          y={buttonsAt === undefined ? mid.y : wall.a.y + ((wall.b.y - wall.a.y) / (Math.hypot(wall.b.x - wall.a.x, wall.b.y - wall.a.y) || 1)) * buttonsAt}
          rotation={readableAngle(angle, viewRot)}
          scaleX={px}
          scaleY={px}
        >
          {(
            [
              ['door', t('common:canvas.addDoor'), -62],
              ['window', t('common:canvas.addWindow'), 8],
            ] as const
          ).map(([type, text, x]) => (
            <Group
              key={type}
              x={x}
              y={-(wall.thickness * scale) / 2 - 30}
              onMouseDown={(e) => {
                e.cancelBubble = true
              }}
              onClick={(e) => {
                e.cancelBubble = true
                onAdd(type)
              }}
              onTap={(e) => {
                e.cancelBubble = true
                onAdd(type)
              }}
              onMouseEnter={cursor('pointer')}
              onMouseLeave={cursor('')}
            >
              <Rect width={56} height={22} cornerRadius={11} fill="#ffffff" stroke={canvasTheme.accent} strokeWidth={1.2} shadowColor="rgba(0,0,0,0.15)" shadowBlur={4} shadowOffsetY={1} />
              <Text width={56} height={22} align="center" verticalAlign="middle" text={text} fontSize={11} fontStyle="600" fontFamily={canvasTheme.font} fill={canvasTheme.accent} />
            </Group>
          ))}
        </Group>
      )}
    </>
  )
}

type OpeningHandlesProps = {
  wall: Wall
  opening: Opening
  scale: number
  onStart: (edge: 'op-start' | 'op-end', e: KonvaEventObject<MouseEvent | TouchEvent>) => void
}

export function OpeningHandles({ wall, opening, scale, onStart }: OpeningHandlesProps) {
  const px = 1 / scale
  const angle = (Math.atan2(wall.b.y - wall.a.y, wall.b.x - wall.a.x) * 180) / Math.PI
  const start = (edge: 'op-start' | 'op-end') => (e: KonvaEventObject<MouseEvent | TouchEvent>) => {
    if ('button' in e.evt && e.evt.button !== 0) return
    e.cancelBubble = true
    onStart(edge, e)
  }
  const cursor = (value: string) => (e: KonvaEventObject<MouseEvent>) => {
    const stage = e.target.getStage()
    if (stage) stage.container().style.cursor = value
  }
  return (
    <Group x={wall.a.x} y={wall.a.y} rotation={angle}>
      {(
        [
          ['op-start', opening.offset],
          ['op-end', opening.offset + opening.width],
        ] as const
      ).map(([edge, x]) => (
        <Rect
          key={edge}
          x={x - 4 * px}
          y={-9 * px}
          width={8 * px}
          height={18 * px}
          cornerRadius={3 * px}
          fill="#ffffff"
          stroke={canvasTheme.accent}
          strokeWidth={2 * px}
          hitStrokeWidth={10 * px}
          onMouseDown={start(edge)}
          onTouchStart={start(edge)}
          onMouseEnter={cursor('ew-resize')}
          onMouseLeave={cursor('')}
        />
      ))}
    </Group>
  )
}

export type FurnitureResizeHandleKind = 'n' | 's' | 'e' | 'w' | 'nw' | 'ne' | 'se' | 'sw'

type FurnitureHandlesProps = {
  item: FurnitureItem
  scale: number
  onStartRotate: (e: KonvaEventObject<MouseEvent | TouchEvent>) => void
  onStartResize: (handle: FurnitureResizeHandleKind, e: KonvaEventObject<MouseEvent | TouchEvent>) => void
}

export function FurnitureHandles({ item, scale, onStartRotate, onStartResize }: FurnitureHandlesProps) {
  const px = 1 / scale
  const r = resolveFurniture(item)
  const { w, d } = r
  const x = item.x
  const y = item.y
  const rotationDeg = item.rotationDeg

  const dist = d / 2 + 24 * px
  const cursor = (value: string) => (e: KonvaEventObject<MouseEvent>) => {
    const stage = e.target.getStage()
    if (stage) stage.container().style.cursor = value
  }

  const startResize = (kind: FurnitureResizeHandleKind) => (e: KonvaEventObject<MouseEvent | TouchEvent>) => {
    if ('button' in e.evt && e.evt.button !== 0) return
    e.cancelBubble = true
    const stage = e.target.getStage()
    if (stage) stage.stopDrag()
    onStartResize(kind, e)
  }

  const startRotate = (e: KonvaEventObject<MouseEvent | TouchEvent>) => {
    if ('button' in e.evt && e.evt.button !== 0) return
    e.cancelBubble = true
    onStartRotate(e)
  }

  return (
    <Group x={x} y={y} rotation={rotationDeg}>
      {/* Outer bounding box border */}
      <Rect
        x={-w / 2}
        y={-d / 2}
        width={w}
        height={d}
        stroke={canvasTheme.accent}
        strokeWidth={1.2 * px}
        dash={[4 * px, 3 * px]}
        listening={false}
      />

      {/* Rotation stem & handle */}
      <Line points={[0, -d / 2, 0, -dist]} stroke={canvasTheme.accent} strokeWidth={1.2 * px} listening={false} />
      <Group x={0} y={-dist} scaleX={px} scaleY={px}>
        <Circle
          radius={6.5}
          fill="#ffffff"
          stroke={canvasTheme.accent}
          strokeWidth={2}
          hitStrokeWidth={18}
          shadowColor="rgba(0,0,0,0.25)"
          shadowBlur={4}
          shadowOffsetY={1}
          onMouseDown={startRotate}
          onTouchStart={startRotate}
          onMouseEnter={cursor('grab')}
          onMouseLeave={cursor('')}
        />
      </Group>

      {/* Edge resize handles (pills) */}
      {/* East / Right edge: Width */}
      <Group x={w / 2} y={0} scaleX={px} scaleY={px}>
        <Rect
          x={-2.5}
          y={-8}
          width={5}
          height={16}
          cornerRadius={2.5}
          fill="#ffffff"
          stroke={canvasTheme.accent}
          strokeWidth={1.8}
          hitStrokeWidth={16}
          shadowColor="rgba(0,0,0,0.18)"
          shadowBlur={3}
          shadowOffsetY={1}
          onMouseDown={startResize('e')}
          onTouchStart={startResize('e')}
          onMouseEnter={cursor('ew-resize')}
          onMouseLeave={cursor('')}
        />
      </Group>

      {/* West / Left edge: Width */}
      <Group x={-w / 2} y={0} scaleX={px} scaleY={px}>
        <Rect
          x={-2.5}
          y={-8}
          width={5}
          height={16}
          cornerRadius={2.5}
          fill="#ffffff"
          stroke={canvasTheme.accent}
          strokeWidth={1.8}
          hitStrokeWidth={16}
          shadowColor="rgba(0,0,0,0.18)"
          shadowBlur={3}
          shadowOffsetY={1}
          onMouseDown={startResize('w')}
          onTouchStart={startResize('w')}
          onMouseEnter={cursor('ew-resize')}
          onMouseLeave={cursor('')}
        />
      </Group>

      {/* South / Bottom edge: Depth */}
      <Group x={0} y={d / 2} scaleX={px} scaleY={px}>
        <Rect
          x={-8}
          y={-2.5}
          width={16}
          height={5}
          cornerRadius={2.5}
          fill="#ffffff"
          stroke={canvasTheme.accent}
          strokeWidth={1.8}
          hitStrokeWidth={16}
          shadowColor="rgba(0,0,0,0.18)"
          shadowBlur={3}
          shadowOffsetY={1}
          onMouseDown={startResize('s')}
          onTouchStart={startResize('s')}
          onMouseEnter={cursor('ns-resize')}
          onMouseLeave={cursor('')}
        />
      </Group>

      {/* North / Top edge: Depth */}
      <Group x={0} y={-d / 2} scaleX={px} scaleY={px}>
        <Rect
          x={-8}
          y={-2.5}
          width={16}
          height={5}
          cornerRadius={2.5}
          fill="#ffffff"
          stroke={canvasTheme.accent}
          strokeWidth={1.8}
          hitStrokeWidth={16}
          shadowColor="rgba(0,0,0,0.18)"
          shadowBlur={3}
          shadowOffsetY={1}
          onMouseDown={startResize('n')}
          onTouchStart={startResize('n')}
          onMouseEnter={cursor('ns-resize')}
          onMouseLeave={cursor('')}
        />
      </Group>

      {/* Corner resize handles (squares) */}
      {/* Top-Left: NW */}
      <Group x={-w / 2} y={-d / 2} scaleX={px} scaleY={px}>
        <Rect
          x={-4.5}
          y={-4.5}
          width={9}
          height={9}
          cornerRadius={2}
          fill="#ffffff"
          stroke={canvasTheme.accent}
          strokeWidth={2}
          hitStrokeWidth={18}
          shadowColor="rgba(0,0,0,0.22)"
          shadowBlur={3}
          shadowOffsetY={1}
          onMouseDown={startResize('nw')}
          onTouchStart={startResize('nw')}
          onMouseEnter={cursor('nwse-resize')}
          onMouseLeave={cursor('')}
        />
      </Group>

      {/* Top-Right: NE */}
      <Group x={w / 2} y={-d / 2} scaleX={px} scaleY={px}>
        <Rect
          x={-4.5}
          y={-4.5}
          width={9}
          height={9}
          cornerRadius={2}
          fill="#ffffff"
          stroke={canvasTheme.accent}
          strokeWidth={2}
          hitStrokeWidth={18}
          shadowColor="rgba(0,0,0,0.22)"
          shadowBlur={3}
          shadowOffsetY={1}
          onMouseDown={startResize('ne')}
          onTouchStart={startResize('ne')}
          onMouseEnter={cursor('nesw-resize')}
          onMouseLeave={cursor('')}
        />
      </Group>

      {/* Bottom-Right: SE */}
      <Group x={w / 2} y={d / 2} scaleX={px} scaleY={px}>
        <Rect
          x={-4.5}
          y={-4.5}
          width={9}
          height={9}
          cornerRadius={2}
          fill="#ffffff"
          stroke={canvasTheme.accent}
          strokeWidth={2}
          hitStrokeWidth={18}
          shadowColor="rgba(0,0,0,0.22)"
          shadowBlur={3}
          shadowOffsetY={1}
          onMouseDown={startResize('se')}
          onTouchStart={startResize('se')}
          onMouseEnter={cursor('nwse-resize')}
          onMouseLeave={cursor('')}
        />
      </Group>

      {/* Bottom-Left: SW */}
      <Group x={-w / 2} y={d / 2} scaleX={px} scaleY={px}>
        <Rect
          x={-4.5}
          y={-4.5}
          width={9}
          height={9}
          cornerRadius={2}
          fill="#ffffff"
          stroke={canvasTheme.accent}
          strokeWidth={2}
          hitStrokeWidth={18}
          shadowColor="rgba(0,0,0,0.22)"
          shadowBlur={3}
          shadowOffsetY={1}
          onMouseDown={startResize('sw')}
          onTouchStart={startResize('sw')}
          onMouseEnter={cursor('nesw-resize')}
          onMouseLeave={cursor('')}
        />
      </Group>

      {/* Live Width dimension pill along bottom */}
      <Group x={0} y={d / 2 + 16 * px} scaleX={px} scaleY={px}>
        <Rect
          x={-28}
          y={-8.5}
          width={56}
          height={17}
          cornerRadius={8.5}
          fill="#ffffff"
          stroke={canvasTheme.accent}
          strokeWidth={1.2}
          shadowColor="rgba(0,0,0,0.15)"
          shadowBlur={3}
          shadowOffsetY={1}
          listening={false}
        />
        <Text
          x={-28}
          y={-8.5}
          width={56}
          height={17}
          align="center"
          verticalAlign="middle"
          text={`W: ${Math.round(w)}`}
          fontSize={10}
          fontStyle="600"
          fontFamily={canvasTheme.font}
          fill={canvasTheme.accent}
          listening={false}
        />
      </Group>

      {/* Live Depth dimension pill along right side */}
      <Group x={w / 2 + 16 * px} y={0} scaleX={px} scaleY={px}>
        <Rect
          x={-26}
          y={-8.5}
          width={52}
          height={17}
          cornerRadius={8.5}
          fill="#ffffff"
          stroke={canvasTheme.accent}
          strokeWidth={1.2}
          shadowColor="rgba(0,0,0,0.15)"
          shadowBlur={3}
          shadowOffsetY={1}
          listening={false}
        />
        <Text
          x={-26}
          y={-8.5}
          width={52}
          height={17}
          align="center"
          verticalAlign="middle"
          text={`D: ${Math.round(d)}`}
          fontSize={10}
          fontStyle="600"
          fontFamily={canvasTheme.font}
          fill={canvasTheme.accent}
          listening={false}
        />
      </Group>
    </Group>
  )
}

type RotateProps = {
  x: number
  y: number
  rotationDeg: number
  depth: number
  scale: number
  onStart: () => void
}

export function FurnitureRotateHandle({ x, y, rotationDeg, depth, scale, onStart }: RotateProps) {
  const px = 1 / scale
  const dist = depth / 2 + 22 * px
  const cursor = (value: string) => (e: KonvaEventObject<MouseEvent>) => {
    const stage = e.target.getStage()
    if (stage) stage.container().style.cursor = value
  }
  return (
    <Group x={x} y={y} rotation={rotationDeg}>
      <Line points={[0, -depth / 2, 0, -dist]} stroke={canvasTheme.accent} strokeWidth={1.2 * px} listening={false} />
      <Circle
        y={-dist}
        radius={6 * px}
        fill="#ffffff"
        stroke={canvasTheme.accent}
        strokeWidth={2 * px}
        hitStrokeWidth={10 * px}
        onMouseDown={(e) => {
          if (e.evt.button !== 0) return
          e.cancelBubble = true
          onStart()
        }}
        onTouchStart={(e) => {
          e.cancelBubble = true
          onStart()
        }}
        onMouseEnter={cursor('grab')}
        onMouseLeave={cursor('')}
      />
    </Group>
  )
}
