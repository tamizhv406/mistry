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
 * Universal AutoCAD / Figma Mobile Touch Transform Bounding Box.
 * Features:
 * - 2px solid #0284c7 border with 4px padding offset
 * - 4 Corner Handles with 32px touch target and 12px visible white pill with shadow
 * - Top Rotation Dial with 24px stem and tactile snapping handle
 * - Center drag surface for seamless touch dragging
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

  // Touch hit area radius (16px radius = 32px diameter hit box)
  const hitR = 16;
  // Visible node radius (6px radius = 12px diameter circular white pill)
  const nodeR = 6;
  const stemLen = 24;

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
          {/* 2. Top Rotation Dial Stem & Handle */}
          {!hideRotationDial && onRotateStart && (
            <g className="fp-rotation-dial-group">
              {/* Stem line extending 24px above top center */}
              <line
                x1={x + width / 2}
                y1={by}
                x2={x + width / 2}
                y2={by - stemLen}
                stroke="#0284c7"
                strokeWidth={2}
                strokeDasharray="3,2"
              />

              {/* 32px Invisible Touch Hit Target + 14px Visible Handle */}
              <g
                style={{ cursor: 'grab', touchAction: 'none' }}
                onPointerDown={(e) => handlePointerDown(e, () => onRotateStart(e))}
                onMouseDown={(e) => handlePointerDown(e, () => onRotateStart(e))}
              >
                {/* 32px hit area */}
                <circle
                  cx={x + width / 2}
                  cy={by - stemLen}
                  r={hitR}
                  fill="transparent"
                />
                {/* Visible rotation circle */}
                <circle
                  cx={x + width / 2}
                  cy={by - stemLen}
                  r={nodeR + 1}
                  fill="#0284c7"
                  stroke="#ffffff"
                  strokeWidth={2}
                  style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.25))' }}
                />
                <circle
                  cx={x + width / 2}
                  cy={by - stemLen}
                  r={2.5}
                  fill="#ffffff"
                />
              </g>
            </g>
          )}

          {/* 3. 4 Corner Resize Handles */}
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
              style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }}
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
              style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }}
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
              style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }}
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
              style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }}
            />
          </g>
        </>
      )}
    </g>
  );
};
