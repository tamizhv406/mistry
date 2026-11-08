import React from 'react';

export interface TransformBoundingBoxProps {
  x: number;          // Local or canvas top-left X (in px)
  y: number;          // Local or canvas top-left Y (in px)
  width: number;      // Width (in px)
  height: number;     // Height (in px)
  isLocked?: boolean;
  aspectRatioLocked?: boolean;
  hideRotationDial?: boolean;
  onResizeStart: (e: React.SyntheticEvent, handle: 'nw' | 'ne' | 'se' | 'sw' | 'e' | 's' | 'w' | 'n') => void;
  onRotateStart?: (e: React.SyntheticEvent) => void;
  onDragStart?: (e: React.SyntheticEvent) => void;
}

/**
 * Universal Mobile-First AutoCAD / Figma Touch Transform Bounding Box.
 * Features:
 * - 2px solid #0284c7 border with 4px padding offset
 * - 28px virtual touch tolerance radius for seamless touch dragging without jumping
 * - 4 Corner Handles with generous 56px touch target and 13px visible pill with drop shadow
 * - 4 Mid-Edge Directional Handles (N, S, E, W) for single-axis dimension adjustment
 * - 30px Rotation Stem and Dial with tactile angle snapping
 * - Center drag surface with touch-action: none for reliable dragging
 */
export const TransformBoundingBox: React.FC<TransformBoundingBoxProps> = ({
  x,
  y,
  width,
  height,
  isLocked = false,
  hideRotationDial = false,
  onResizeStart,
  onRotateStart,
  onDragStart,
}) => {
  const pad = 4;
  const bx = x - pad;
  const by = y - pad;
  const bw = width + pad * 2;
  const bh = height + pad * 2;

  // Touch hit area radius (28px radius = 56px touch target diameter for mobile fingers)
  const hitR = 28;
  // Visible node radius
  const nodeR = 6.5;
  // 30px rotation stem extending outside top center
  const stemLen = 30;

  const handlePointerDown = (
    e: React.SyntheticEvent,
    action: () => void
  ) => {
    e.stopPropagation();
    if ('preventDefault' in e && (e as any).cancelable) {
      (e as any).preventDefault();
    }
    if ('setPointerCapture' in e.target && 'pointerId' in (e as any)) {
      try {
        (e.target as Element).setPointerCapture((e as any).pointerId);
      } catch {
        // Pointer capture not supported on this node
      }
    }
    action();
  };

  const midX = x + width / 2;
  const midY = y + height / 2;

  return (
    <g className="fp-touch-transform-box" style={{ touchAction: 'none' }}>
      {/* 1. Selection Bounding Box Rectangle (Center Drag Target) */}
      <rect
        x={bx}
        y={by}
        width={bw}
        height={bh}
        fill="rgba(2, 132, 199, 0.08)"
        stroke="#0284c7"
        strokeWidth={2}
        strokeDasharray="4 3"
        rx={4}
        style={{ cursor: isLocked ? 'not-allowed' : 'move', touchAction: 'none' }}
        onPointerDown={onDragStart ? (e) => handlePointerDown(e, () => onDragStart(e)) : undefined}
        onMouseDown={onDragStart ? (e) => handlePointerDown(e, () => onDragStart(e)) : undefined}
      />

      {!isLocked && (
        <>
          {/* 2. Top Rotation Dial Stem & Handle (30px Stem) */}
          {!hideRotationDial && onRotateStart && (
            <g className="fp-rotation-dial-group">
              {/* 30px Stem line extending above top center */}
              <line
                x1={midX}
                y1={by}
                x2={midX}
                y2={by - stemLen}
                stroke="#0284c7"
                strokeWidth={2}
                strokeDasharray="3 2"
              />

              {/* 56px Invisible Touch Hit Target + Visible Rotation Dial */}
              <g
                style={{ cursor: 'grab', touchAction: 'none' }}
                onPointerDown={(e) => handlePointerDown(e, () => onRotateStart(e))}
                onMouseDown={(e) => handlePointerDown(e, () => onRotateStart(e))}
              >
                {/* 56px touch target */}
                <circle
                  cx={midX}
                  cy={by - stemLen}
                  r={hitR}
                  fill="transparent"
                />
                {/* Visible rotation circle */}
                <circle
                  cx={midX}
                  cy={by - stemLen}
                  r={nodeR + 2}
                  fill="#0284c7"
                  stroke="#ffffff"
                  strokeWidth={2}
                  style={{ filter: 'drop-shadow(0 2px 5px rgba(0,0,0,0.3))' }}
                />
                {/* Center dot / rotation icon accent */}
                <circle
                  cx={midX}
                  cy={by - stemLen}
                  r={2.5}
                  fill="#ffffff"
                />
              </g>
            </g>
          )}

          {/* 3. 4 Mid-Edge Single-Axis Handles (N, S, E, W) */}
          {/* North (N) Handle - Vertical Dimension */}
          <g
            style={{ cursor: 'ns-resize', touchAction: 'none' }}
            onPointerDown={(e) => handlePointerDown(e, () => onResizeStart(e, 'n'))}
            onMouseDown={(e) => handlePointerDown(e, () => onResizeStart(e, 'n'))}
          >
            <circle cx={midX} cy={y} r={hitR} fill="transparent" />
            <rect
              x={midX - 8}
              y={y - 4}
              width={16}
              height={8}
              rx={4}
              fill="#ffffff"
              stroke="#0284c7"
              strokeWidth={1.8}
              style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.25))' }}
            />
            {/* Directional grip mark */}
            <line x1={midX - 3} y1={y} x2={midX + 3} y2={y} stroke="#0284c7" strokeWidth={1.5} />
          </g>

          {/* South (S) Handle - Vertical Dimension */}
          <g
            style={{ cursor: 'ns-resize', touchAction: 'none' }}
            onPointerDown={(e) => handlePointerDown(e, () => onResizeStart(e, 's'))}
            onMouseDown={(e) => handlePointerDown(e, () => onResizeStart(e, 's'))}
          >
            <circle cx={midX} cy={y + height} r={hitR} fill="transparent" />
            <rect
              x={midX - 8}
              y={y + height - 4}
              width={16}
              height={8}
              rx={4}
              fill="#ffffff"
              stroke="#0284c7"
              strokeWidth={1.8}
              style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.25))' }}
            />
            <line x1={midX - 3} y1={y + height} x2={midX + 3} y2={y + height} stroke="#0284c7" strokeWidth={1.5} />
          </g>

          {/* West (W) Handle - Horizontal Dimension */}
          <g
            style={{ cursor: 'ew-resize', touchAction: 'none' }}
            onPointerDown={(e) => handlePointerDown(e, () => onResizeStart(e, 'w'))}
            onMouseDown={(e) => handlePointerDown(e, () => onResizeStart(e, 'w'))}
          >
            <circle cx={x} cy={midY} r={hitR} fill="transparent" />
            <rect
              x={x - 4}
              y={midY - 8}
              width={8}
              height={16}
              rx={4}
              fill="#ffffff"
              stroke="#0284c7"
              strokeWidth={1.8}
              style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.25))' }}
            />
            <line x1={x} y1={midY - 3} x2={x} y2={midY + 3} stroke="#0284c7" strokeWidth={1.5} />
          </g>

          {/* East (E) Handle - Horizontal Dimension */}
          <g
            style={{ cursor: 'ew-resize', touchAction: 'none' }}
            onPointerDown={(e) => handlePointerDown(e, () => onResizeStart(e, 'e'))}
            onMouseDown={(e) => handlePointerDown(e, () => onResizeStart(e, 'e'))}
          >
            <circle cx={x + width} cy={midY} r={hitR} fill="transparent" />
            <rect
              x={x + width - 4}
              y={midY - 8}
              width={8}
              height={16}
              rx={4}
              fill="#ffffff"
              stroke="#0284c7"
              strokeWidth={1.8}
              style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.25))' }}
            />
            <line x1={x + width} y1={midY - 3} x2={x + width} y2={midY + 3} stroke="#0284c7" strokeWidth={1.5} />
          </g>

          {/* 4. 4 Corner Dual-Axis Resize Handles */}
          {/* Top-Left (NW) */}
          <g
            style={{ cursor: 'nwse-resize', touchAction: 'none' }}
            onPointerDown={(e) => handlePointerDown(e, () => onResizeStart(e, 'nw'))}
            onMouseDown={(e) => handlePointerDown(e, () => onResizeStart(e, 'nw'))}
          >
            <circle cx={x} cy={y} r={hitR} fill="transparent" />
            <circle
              cx={x}
              cy={y}
              r={nodeR}
              fill="#ffffff"
              stroke="#0284c7"
              strokeWidth={2}
              style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.25))' }}
            />
          </g>

          {/* Top-Right (NE) */}
          <g
            style={{ cursor: 'nesw-resize', touchAction: 'none' }}
            onPointerDown={(e) => handlePointerDown(e, () => onResizeStart(e, 'ne'))}
            onMouseDown={(e) => handlePointerDown(e, () => onResizeStart(e, 'ne'))}
          >
            <circle cx={x + width} cy={y} r={hitR} fill="transparent" />
            <circle
              cx={x + width}
              cy={y}
              r={nodeR}
              fill="#ffffff"
              stroke="#0284c7"
              strokeWidth={2}
              style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.25))' }}
            />
          </g>

          {/* Bottom-Right (SE) */}
          <g
            style={{ cursor: 'nwse-resize', touchAction: 'none' }}
            onPointerDown={(e) => handlePointerDown(e, () => onResizeStart(e, 'se'))}
            onMouseDown={(e) => handlePointerDown(e, () => onResizeStart(e, 'se'))}
          >
            <circle cx={x + width} cy={y + height} r={hitR} fill="transparent" />
            <circle
              cx={x + width}
              cy={y + height}
              r={nodeR}
              fill="#ffffff"
              stroke="#0284c7"
              strokeWidth={2}
              style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.25))' }}
            />
          </g>

          {/* Bottom-Left (SW) */}
          <g
            style={{ cursor: 'nesw-resize', touchAction: 'none' }}
            onPointerDown={(e) => handlePointerDown(e, () => onResizeStart(e, 'sw'))}
            onMouseDown={(e) => handlePointerDown(e, () => onResizeStart(e, 'sw'))}
          >
            <circle cx={x} cy={y + height} r={hitR} fill="transparent" />
            <circle
              cx={x}
              cy={y + height}
              r={nodeR}
              fill="#ffffff"
              stroke="#0284c7"
              strokeWidth={2}
              style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.25))' }}
            />
          </g>
        </>
      )}
    </g>
  );
};
