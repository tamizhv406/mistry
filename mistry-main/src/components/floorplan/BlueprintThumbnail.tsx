import React, { useMemo } from 'react';
import type { FloorPlanWall, FloorPlanRoom, FloorPlanDoor, FloorPlanWindow } from '../../db/types';

interface BlueprintThumbnailProps {
  walls?: FloorPlanWall[];
  rooms?: FloorPlanRoom[];
  doors?: FloorPlanDoor[];
  windows?: FloorPlanWindow[];
  plotLength?: number;
  plotWidth?: number;
  unit?: string;
  style?: React.CSSProperties;
  className?: string;
  showLabels?: boolean;
}

const getRoomFillColor = (labelOrType: string): string => {
  const lower = (labelOrType || '').toLowerCase();
  if (lower.includes('bed')) return 'rgba(224, 242, 254, 0.75)'; // Soft Blue
  if (lower.includes('liv') || lower.includes('hall')) return 'rgba(254, 243, 199, 0.75)'; // Soft Amber
  if (lower.includes('kit') || lower.includes('din')) return 'rgba(220, 252, 231, 0.75)'; // Soft Mint
  if (lower.includes('bath') || lower.includes('toilet') || lower.includes('wc')) return 'rgba(243, 232, 255, 0.75)'; // Soft Purple
  if (lower.includes('balcony') || lower.includes('sitout') || lower.includes('porch')) return 'rgba(254, 215, 170, 0.65)'; // Soft Peach
  return 'rgba(241, 245, 249, 0.75)'; // Slate subtle
};

export const BlueprintThumbnail: React.FC<BlueprintThumbnailProps> = ({
  walls = [],
  rooms = [],
  doors = [],
  windows = [],
  plotLength = 40,
  plotWidth = 30,
  style,
  className,
  showLabels = true,
}) => {
  const { viewBox, hasGeometry, bounds } = useMemo(() => {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const w of walls) {
      minX = Math.min(minX, w.x1, w.x2);
      minY = Math.min(minY, w.y1, w.y2);
      maxX = Math.max(maxX, w.x1, w.x2);
      maxY = Math.max(maxY, w.y1, w.y2);
    }

    for (const r of rooms) {
      minX = Math.min(minX, r.x);
      minY = Math.min(minY, r.y);
      maxX = Math.max(maxX, r.x + r.width);
      maxY = Math.max(maxY, r.y + r.height);
    }

    const hasGeom = isFinite(minX) && isFinite(maxX) && (maxX > minX || maxY > minY);

    if (!hasGeom) {
      minX = 0;
      minY = 0;
      maxX = Math.max(10, plotLength || 40);
      maxY = Math.max(10, plotWidth || 30);
    }

    const width = Math.max(1, maxX - minX);
    const height = Math.max(1, maxY - minY);
    const padX = width * 0.1;
    const padY = height * 0.1;

    return {
      hasGeometry: hasGeom,
      bounds: { minX, minY, maxX, maxY, width, height },
      viewBox: `${minX - padX} ${minY - padY} ${width + 2 * padX} ${height + 2 * padY}`,
    };
  }, [walls, rooms, plotLength, plotWidth]);

  return (
    <svg
      viewBox={viewBox}
      className={className}
      style={{
        width: '100%',
        height: '100%',
        display: 'block',
        backgroundColor: '#ffffff',
        ...style,
      }}
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        {/* Subtle CAD grid */}
        <pattern id="cad-grid" width="4" height="4" patternUnits="userSpaceOnUse">
          <path d="M 4 0 L 0 0 0 4" fill="none" stroke="#f1f5f9" strokeWidth="0.15" />
        </pattern>
      </defs>

      {/* Grid Background */}
      <rect
        x={bounds.minX - bounds.width * 0.1}
        y={bounds.minY - bounds.height * 0.1}
        width={bounds.width * 1.2}
        height={bounds.height * 1.2}
        fill="url(#cad-grid)"
      />

      {/* Outer Plot Boundary Guide */}
      <rect
        x={bounds.minX}
        y={bounds.minY}
        width={bounds.width}
        height={bounds.height}
        fill="none"
        stroke="#e2e8f0"
        strokeWidth={Math.max(0.1, bounds.width * 0.005)}
        strokeDasharray="1 1"
      />

      {hasGeometry ? (
        <>
          {/* Rooms with soft architectural fills & labels */}
          {rooms.map((r, i) => {
            const fillColor = getRoomFillColor(r.label || r.roomType);
            const label = r.label || r.roomType;
            const fontSize = Math.max(0.7, Math.min(r.width * 0.15, r.height * 0.2, 1.3));

            return (
              <g key={r.id || `room-${i}`}>
                <rect
                  x={r.x}
                  y={r.y}
                  width={r.width}
                  height={r.height}
                  fill={fillColor}
                  stroke="#cbd5e1"
                  strokeWidth={0.2}
                  rx={0.2}
                />
                {showLabels && r.width >= 4 && r.height >= 3 && (
                  <text
                    x={r.x + r.width / 2}
                    y={r.y + r.height / 2}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="#334155"
                    fontSize={fontSize}
                    fontWeight="700"
                    fontFamily="system-ui, -apple-system, sans-serif"
                    letterSpacing="0.2px"
                  >
                    {label.length > 14 ? label.slice(0, 12) + '…' : label}
                  </text>
                )}
              </g>
            );
          })}

          {/* Wall lines */}
          {walls.map((w, i) => {
            const isInterior = w.wallType === 'interior';
            const strokeColor = isInterior ? '#334155' : '#0f172a';
            const strokeW = isInterior ? Math.max(0.35, (w.thickness || 0.5) * 0.7) : Math.max(0.65, (w.thickness || 0.75) * 0.85);

            return (
              <line
                key={w.id || `w-${i}`}
                x1={w.x1}
                y1={w.y1}
                x2={w.x2}
                y2={w.y2}
                stroke={strokeColor}
                strokeWidth={strokeW}
                strokeLinecap="round"
              />
            );
          })}

          {/* Windows (cyan lines) */}
          {windows.map((win, i) => {
            const wLen = win.width || 3;
            return (
              <rect
                key={win.id || `win-${i}`}
                x={win.x}
                y={win.y - 0.25}
                width={wLen}
                height={0.5}
                fill="#e0f2fe"
                stroke="#0284c7"
                strokeWidth={0.3}
              />
            );
          })}

          {/* Doors (amber swing arcs) */}
          {doors.map((d, i) => {
            const dWidth = d.width || 3;
            return (
              <g key={d.id || `door-${i}`}>
                <circle
                  cx={d.x}
                  cy={d.y}
                  r={dWidth}
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth={0.25}
                  strokeDasharray="0.5 0.5"
                />
                <line
                  x1={d.x}
                  y1={d.y}
                  x2={d.x + dWidth}
                  y2={d.y}
                  stroke="#d97706"
                  strokeWidth={0.4}
                />
              </g>
            );
          })}
        </>
      ) : (
        /* Empty canvas placeholder graphics */
        <g>
          <circle
            cx={bounds.minX + bounds.width / 2}
            cy={bounds.minY + bounds.height / 2}
            r={Math.min(bounds.width, bounds.height) * 0.25}
            fill="none"
            stroke="#e2e8f0"
            strokeWidth="0.4"
          />
          <text
            x={bounds.minX + bounds.width / 2}
            y={bounds.minY + bounds.height / 2}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="#94a3b8"
            fontSize={Math.min(bounds.width, bounds.height) * 0.08}
            fontWeight="600"
            fontFamily="system-ui, sans-serif"
          >
            CAD Blueprint Canvas
          </text>
        </g>
      )}
    </svg>
  );
};
