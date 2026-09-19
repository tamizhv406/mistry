import type {
  FloorPlanWall,
  FloorPlanRoom,
  FloorPlanDoor,
  FloorPlanWindow,
  FloorPlanFurniture,
  FloorPlanUnit,
  RoomType,
} from '../db/types';

// ============================================================
// Unit Conversions & Standard Wall Presets
// ============================================================

export const WALL_THICKNESS_PRESETS_MM = [100, 115, 150, 200, 230] as const;

/**
 * Converts millimeters to plan units
 */
export function mmToPlanUnits(mm: number, unit: FloorPlanUnit): number {
  switch (unit) {
    case 'meters':
      return mm / 1000;
    case 'centimeters':
      return mm / 10;
    case 'inches':
      return mm / 25.4;
    case 'feet':
    default:
      return mm / 304.8;
  }
}

/**
 * Converts plan units to millimeters
 */
export function planUnitsToMm(val: number, unit: FloorPlanUnit): number {
  switch (unit) {
    case 'meters':
      return val * 1000;
    case 'centimeters':
      return val * 10;
    case 'inches':
      return val * 25.4;
    case 'feet':
    default:
      return val * 304.8;
  }
}

/**
 * Format length in current unit with high precision display
 */
export function formatLength(val: number, unit: FloorPlanUnit): string {
  if (unit === 'feet') {
    const totalInches = Math.round(val * 12);
    const feet = Math.floor(totalInches / 12);
    const inches = totalInches % 12;
    if (inches === 0) return `${feet}'-0" [${(val * 0.3048).toFixed(2)}m]`;
    return `${feet}'-${inches}" [${(val * 0.3048).toFixed(2)}m]`;
  } else if (unit === 'inches') {
    return `${val.toFixed(1)}" [${(val * 25.4).toFixed(0)}mm]`;
  } else if (unit === 'centimeters') {
    return `${val.toFixed(0)} cm [${(val / 100).toFixed(2)}m]`;
  }
  return `${val.toFixed(2)} m`;
}

/**
 * Format area in current unit
 */
export function formatArea(areaSqUnits: number, unit: FloorPlanUnit): string {
  if (unit === 'feet') {
    return `${areaSqUnits.toFixed(1)} sq.ft (${(areaSqUnits * 0.092903).toFixed(1)} m²)`;
  } else if (unit === 'inches') {
    const sqFt = areaSqUnits / 144;
    return `${sqFt.toFixed(1)} sq.ft (${(sqFt * 0.092903).toFixed(1)} m²)`;
  } else if (unit === 'centimeters') {
    const sqM = areaSqUnits / 10000;
    return `${sqM.toFixed(2)} m² (${(sqM * 10.7639).toFixed(1)} sq.ft)`;
  }
  return `${areaSqUnits.toFixed(2)} m² (${(areaSqUnits * 10.7639).toFixed(1)} sq.ft)`;
}

// ============================================================
// Wall Geometry & Snapping
// ============================================================

export function getWallLength(w: FloorPlanWall): number {
  return Math.hypot(w.x2 - w.x1, w.y2 - w.y1);
}

export function getWallAngleDeg(w: FloorPlanWall): number {
  let angle = (Math.atan2(w.y2 - w.y1, w.x2 - w.x1) * 180) / Math.PI;
  if (angle < 0) angle += 360;
  return angle;
}

export interface SnapPoint {
  x: number;
  y: number;
  type: 'endpoint' | 'midpoint' | 'grid' | 'wall' | 'wall-axis' | 'none';
  wallId?: string;
  dist?: number;
}

/**
 * Finds nearest wall endpoint, midpoint, or wall centerline, falling back to grid snap
 */
export function findSnapPoint(
  x: number,
  y: number,
  walls: FloorPlanWall[],
  gridSize: number = 0.5,
  snapThreshold: number = 0.6,
  snapToEndpoints: boolean = true,
  snapToWall: boolean = true,
  excludeWallId?: string
): SnapPoint {
  let best: SnapPoint | null = null;
  let minDist = snapThreshold;

  // 1. Check Wall Endpoints & Midpoints (highest priority)
  if (snapToEndpoints) {
    for (const w of walls) {
      if (w.id === excludeWallId) continue;

      // Start Endpoint
      const d1 = Math.hypot(w.x1 - x, w.y1 - y);
      if (d1 < minDist) {
        minDist = d1;
        best = { x: w.x1, y: w.y1, type: 'endpoint', wallId: w.id, dist: d1 };
      }

      // End Endpoint
      const d2 = Math.hypot(w.x2 - x, w.y2 - y);
      if (d2 < minDist) {
        minDist = d2;
        best = { x: w.x2, y: w.y2, type: 'endpoint', wallId: w.id, dist: d2 };
      }

      // Midpoint
      const midX = (w.x1 + w.x2) / 2;
      const midY = (w.y1 + w.y2) / 2;
      const dMid = Math.hypot(midX - x, midY - y);
      if (dMid < minDist && dMid < snapThreshold * 0.75) {
        minDist = dMid;
        best = { x: midX, y: midY, type: 'midpoint', wallId: w.id, dist: dMid };
      }
    }
  }

  if (best) return best;

  // 2. Check Wall Centerline Snapping (projected onto line segment)
  if (snapToWall) {
    const proj = projectPointOntoWall(x, y, walls, minDist, excludeWallId);
    if (proj) {
      return {
        x: proj.projectedX,
        y: proj.projectedY,
        type: 'wall',
        wallId: proj.wall.id,
        dist: proj.distance,
      };
    }
  }

  // 3. Fallback to Grid Snapping
  if (gridSize > 0) {
    const gx = Math.round(x / gridSize) * gridSize;
    const gy = Math.round(y / gridSize) * gridSize;
    return {
      x: gx,
      y: gy,
      type: 'grid',
      dist: Math.hypot(gx - x, gy - y),
    };
  }

  return { x, y, type: 'none', dist: 0 };
}

/**
 * Orthogonal alignment: snaps wall to exact 0°, 90°, 180°, 270°, or 45° if near
 */
export function snapAngleOrtho(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  snapThresholdDeg: number = 15,
  strictOrtho: boolean = false
): { x: number; y: number } {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (len < 0.001) return { x: x2, y: y2 };

  let angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
  if (angleDeg < 0) angleDeg += 360;

  if (strictOrtho) {
    const quadrant = (Math.round(angleDeg / 90) * 90) % 360;
    const rad = (quadrant * Math.PI) / 180;
    const cos = Math.abs(Math.cos(rad)) < 1e-6 ? 0 : Math.cos(rad);
    const sin = Math.abs(Math.sin(rad)) < 1e-6 ? 0 : Math.sin(rad);
    return {
      x: x1 + Math.round(len * cos * 1000) / 1000,
      y: y1 + Math.round(len * sin * 1000) / 1000,
    };
  }

  const targets = [0, 45, 90, 135, 180, 225, 270, 315, 360];
  for (const t of targets) {
    const diff = Math.min(
      Math.abs(angleDeg - t),
      Math.abs(angleDeg - (t - 360)),
      Math.abs(angleDeg - (t + 360))
    );
    if (diff <= snapThresholdDeg) {
      const rad = (t * Math.PI) / 180;
      const cos = Math.abs(Math.cos(rad)) < 1e-6 ? 0 : Math.cos(rad);
      const sin = Math.abs(Math.sin(rad)) < 1e-6 ? 0 : Math.sin(rad);
      return {
        x: x1 + Math.round(len * cos * 1000) / 1000,
        y: y1 + Math.round(len * sin * 1000) / 1000,
      };
    }
  }

  return { x: x2, y: y2 };
}

// ============================================================
// Wall-Opening Hosting (Doors & Windows)
// ============================================================

export interface HostedOpeningInfo {
  wall: FloorPlanWall;
  snappedX: number;
  snappedY: number;
  projectedX: number;
  projectedY: number;
  wallOffset: number;
  rotation: number;
  angleDeg: number;
  distance: number;
}

/**
 * Projects a point (x, y) onto the nearest wall centerline within maxDistance
 */
export function projectPointOntoWall(
  x: number,
  y: number,
  walls: FloorPlanWall[],
  maxDistance: number = 1.5,
  excludeWallId?: string
): HostedOpeningInfo | null {
  let closest: HostedOpeningInfo | null = null;
  let minD = maxDistance;

  for (const w of walls) {
    if (w.id === excludeWallId) continue;
    const dx = w.x2 - w.x1;
    const dy = w.y2 - w.y1;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) continue;

    // Projection factor t along wall segment [0, 1]
    let t = ((x - w.x1) * dx + (y - w.y1) * dy) / lenSq;
    // Keep opening within wall interior (margin 0.3 units from ends)
    const margin = 0.3 / Math.sqrt(lenSq);
    t = Math.max(margin, Math.min(1 - margin, t));

    const projX = w.x1 + t * dx;
    const projY = w.y1 + t * dy;
    const dist = Math.hypot(x - projX, y - projY);

    if (dist < minD) {
      minD = dist;
      let angle = (Math.atan2(dy, dx) * 180) / Math.PI;
      if (angle < 0) angle += 360;
      closest = {
        wall: w,
        snappedX: projX,
        snappedY: projY,
        projectedX: projX,
        projectedY: projY,
        wallOffset: t * Math.sqrt(lenSq),
        rotation: Math.round(angle),
        angleDeg: Math.round(angle),
        distance: dist,
      };
    }
  }

  return closest;
}

/**
 * Snaps a wall-mounted furniture item (TV, Split AC, Mirror) against the nearest wall
 */
export function snapWallMountedItem(
  x: number,
  y: number,
  width: number,
  depth: number,
  walls: FloorPlanWall[],
  maxDistance: number = 2.5
): { x: number; y: number; rotation: number; wallId?: string; wall: FloorPlanWall } | null {
  const host = projectPointOntoWall(x, y, walls, maxDistance);
  if (!host) return null;

  // Align object flush against the wall surface
  const rad = (host.rotation * Math.PI) / 180;
  // Perpendicular normal pointing out
  const normX = -Math.sin(rad);
  const normY = Math.cos(rad);

  const halfDepth = depth / 2;
  const wallHalfThick = host.wall.thickness / 2;
  const offsetDist = wallHalfThick + halfDepth;

  return {
    x: host.snappedX + normX * offsetDist,
    y: host.snappedY + normY * offsetDist,
    rotation: host.rotation,
    wallId: host.wall.id,
    wall: host.wall,
  };
}

// ============================================================
// Enclosed Room Detection
// ============================================================

interface GraphNode {
  id: string;
  x: number;
  y: number;
  neighbors: string[]; // Connected Node IDs
}

/**
 * Builds a planar graph from walls and detects closed polygon rooms
 */
export function detectEnclosedRooms(
  walls: FloorPlanWall[],
  unit: FloorPlanUnit = 'feet',
  tolerance: number = 0.35
): Omit<FloorPlanRoom, 'id'>[] {
  if (walls.length < 3) return [];

  // 1. Extract distinct nodes (cluster endpoints within tolerance)
  const nodes: GraphNode[] = [];
  function getOrCreateNode(x: number, y: number): GraphNode {
    for (const n of nodes) {
      if (Math.hypot(n.x - x, n.y - y) <= tolerance) {
        return n;
      }
    }
    const newNode: GraphNode = {
      id: `node-${nodes.length}`,
      x,
      y,
      neighbors: [],
    };
    nodes.push(newNode);
    return newNode;
  }

  // 2. Connect graph edges
  for (const w of walls) {
    const n1 = getOrCreateNode(w.x1, w.y1);
    const n2 = getOrCreateNode(w.x2, w.y2);
    if (n1.id !== n2.id) {
      if (!n1.neighbors.includes(n2.id)) n1.neighbors.push(n2.id);
      if (!n2.neighbors.includes(n1.id)) n2.neighbors.push(n1.id);
    }
  }

  // 3. Simple Box / Rectangle Room Finder for CAD floor plans
  // Identifies 4-vertex cycles or bounding loops
  const detectedRooms: Omit<FloorPlanRoom, 'id'>[] = [];
  const visitedCycles = new Set<string>();

  // Helper: Shoelace Polygon Area
  function polygonArea(pts: { x: number; y: number }[]): number {
    let area = 0;
    for (let i = 0; i < pts.length; i++) {
      const j = (i + 1) % pts.length;
      area += pts[i].x * pts[j].y;
      area -= pts[j].x * pts[i].y;
    }
    return Math.abs(area) / 2;
  }

  // Helper: Polygon Perimeter
  function polygonPerimeter(pts: { x: number; y: number }[]): number {
    let p = 0;
    for (let i = 0; i < pts.length; i++) {
      const j = (i + 1) % pts.length;
      p += Math.hypot(pts[j].x - pts[i].x, pts[j].y - pts[i].y);
    }
    return p;
  }

  // Find 4-node cycles (standard architectural rooms)
  for (const nA of nodes) {
    for (const idB of nA.neighbors) {
      const nB = nodes.find(n => n.id === idB)!;
      for (const idC of nB.neighbors) {
        if (idC === nA.id) continue;
        const nC = nodes.find(n => n.id === idC)!;
        for (const idD of nC.neighbors) {
          if (idD === nB.id || idD === nA.id) continue;
          const nD = nodes.find(n => n.id === idD)!;
          if (nD.neighbors.includes(nA.id)) {
            // Found a 4-node cycle: A -> B -> C -> D -> A
            const cycleKey = [nA.id, nB.id, nC.id, nD.id].sort().join(':');
            if (!visitedCycles.has(cycleKey)) {
              visitedCycles.add(cycleKey);

              const pts = [
                { x: nA.x, y: nA.y },
                { x: nB.x, y: nB.y },
                { x: nC.x, y: nC.y },
                { x: nD.x, y: nD.y },
              ];

              const area = polygonArea(pts);
              const perimeter = polygonPerimeter(pts);

              // Filter out tiny degenerate slivers or zero areas
              if (area >= 12) { // at least ~12 sq.ft (e.g. small powder room)
                const minX = Math.min(...pts.map(p => p.x));
                const maxX = Math.max(...pts.map(p => p.x));
                const minY = Math.min(...pts.map(p => p.y));
                const maxY = Math.max(...pts.map(p => p.y));

                const w = maxX - minX;
                const h = maxY - minY;

                // Guess default room type based on proportions & size
                let roomType: RoomType = 'Living Room';
                if (area < 35) roomType = 'Toilet';
                else if (area < 65) roomType = 'Bathroom';
                else if (area < 110) roomType = 'Kitchen';
                else if (area < 160) roomType = 'Bedroom';
                else if (area < 250) roomType = 'Master Bedroom';

                detectedRooms.push({
                  roomType,
                  label: `${roomType} (${formatArea(area, unit)})`,
                  x: minX,
                  y: minY,
                  width: w,
                  height: h,
                  area,
                  perimeter,
                  polygonPoints: pts,
                  rotation: 0,
                  ceilingHeight: 10,
                  floorFinish: 'Vitrified Tiles',
                });
              }
            }
          }
        }
      }
    }
  }

  return detectedRooms;
}

// ============================================================
// Architectural Wall Openings, Bounding Box & Host Matching
// ============================================================

export interface WallSolidSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  length: number;
  tStart: number;
  tEnd: number;
}

export interface WallOpeningInterval {
  tStart: number;
  tEnd: number;
  centerT: number;
  type: 'door' | 'window';
  id: string;
  door?: FloorPlanDoor;
  window?: FloorPlanWindow;
  width: number;
}

export interface WallOpeningsResult {
  wallId: string;
  totalLength: number;
  solidSegments: WallSolidSegment[];
  openings: WallOpeningInterval[];
}

/**
 * Computes solid wall sub-segments and door/window opening intervals along a host wall.
 * Cuts genuine architectural openings into the wall for doors and windows.
 */
export function computeWallSegmentsWithOpenings(
  wall: FloorPlanWall,
  doors: FloorPlanDoor[] = [],
  windows: FloorPlanWindow[] = []
): WallOpeningsResult {
  const L = Math.hypot(wall.x2 - wall.x1, wall.y2 - wall.y1);
  if (L < 0.001) {
    return { wallId: wall.id, totalLength: 0, solidSegments: [], openings: [] };
  }

  const ux = (wall.x2 - wall.x1) / L;
  const uy = (wall.y2 - wall.y1) / L;
  const hostThick = wall.thickness || 0.75;
  const snapThreshold = Math.max(1.5, hostThick * 2);

  const rawOpenings: WallOpeningInterval[] = [];

  // 1. Collect door openings on this wall
  for (const d of doors) {
    let t: number | null = null;
    if (d.wallId === wall.id) {
      if (typeof d.wallOffset === 'number' && !isNaN(d.wallOffset)) {
        t = d.wallOffset;
      } else {
        t = (d.x - wall.x1) * ux + (d.y - wall.y1) * uy;
      }
    } else {
      // Check proximity to wall centerline
      const projT = (d.x - wall.x1) * ux + (d.y - wall.y1) * uy;
      if (projT >= -0.5 && projT <= L + 0.5) {
        const perpDist = Math.hypot(d.x - (wall.x1 + projT * ux), d.y - (wall.y1 + projT * uy));
        if (perpDist <= snapThreshold) {
          t = projT;
        }
      }
    }

    if (t !== null && t >= 0 && t <= L) {
      const w = d.width || 3;
      const tStart = Math.max(0, t - w / 2);
      const tEnd = Math.min(L, t + w / 2);
      if (tEnd - tStart > 0.1) {
        rawOpenings.push({
          tStart,
          tEnd,
          centerT: (tStart + tEnd) / 2,
          type: 'door',
          id: d.id,
          door: d,
          width: w,
        });
      }
    }
  }

  // 2. Collect window openings on this wall
  for (const win of windows) {
    let t: number | null = null;
    if (win.wallId === wall.id) {
      if (typeof win.wallOffset === 'number' && !isNaN(win.wallOffset)) {
        t = win.wallOffset;
      } else {
        t = (win.x - wall.x1) * ux + (win.y - wall.y1) * uy;
      }
    } else {
      const projT = (win.x - wall.x1) * ux + (win.y - wall.y1) * uy;
      if (projT >= -0.5 && projT <= L + 0.5) {
        const perpDist = Math.hypot(win.x - (wall.x1 + projT * ux), win.y - (wall.y1 + projT * uy));
        if (perpDist <= snapThreshold) {
          t = projT;
        }
      }
    }

    if (t !== null && t >= 0 && t <= L) {
      const w = win.width || 4;
      const tStart = Math.max(0, t - w / 2);
      const tEnd = Math.min(L, t + w / 2);
      if (tEnd - tStart > 0.1) {
        rawOpenings.push({
          tStart,
          tEnd,
          centerT: (tStart + tEnd) / 2,
          type: 'window',
          id: win.id,
          window: win,
          width: w,
        });
      }
    }
  }

  // Sort openings along wall from 0 to L
  rawOpenings.sort((a, b) => a.tStart - b.tStart);

  // Merge overlapping door intervals to cut wall cleanly
  // (Doors create total wall gaps; windows embed within the wall with sills)
  const doorCutIntervals: { tStart: number; tEnd: number }[] = [];
  for (const op of rawOpenings) {
    if (op.type === 'door') {
      if (doorCutIntervals.length === 0) {
        doorCutIntervals.push({ tStart: op.tStart, tEnd: op.tEnd });
      } else {
        const prev = doorCutIntervals[doorCutIntervals.length - 1];
        if (op.tStart <= prev.tEnd + 0.05) {
          prev.tEnd = Math.max(prev.tEnd, op.tEnd);
        } else {
          doorCutIntervals.push({ tStart: op.tStart, tEnd: op.tEnd });
        }
      }
    }
  }

  // Calculate solid wall segments between cuts
  const solidSegments: WallSolidSegment[] = [];
  if (doorCutIntervals.length === 0) {
    solidSegments.push({
      x1: wall.x1,
      y1: wall.y1,
      x2: wall.x2,
      y2: wall.y2,
      length: L,
      tStart: 0,
      tEnd: L,
    });
  } else {
    let curT = 0;
    for (const cut of doorCutIntervals) {
      if (cut.tStart > curT + 0.05) {
        const sx1 = wall.x1 + curT * ux;
        const sy1 = wall.y1 + curT * uy;
        const sx2 = wall.x1 + cut.tStart * ux;
        const sy2 = wall.y1 + cut.tStart * uy;
        solidSegments.push({
          x1: sx1,
          y1: sy1,
          x2: sx2,
          y2: sy2,
          length: cut.tStart - curT,
          tStart: curT,
          tEnd: cut.tStart,
        });
      }
      curT = Math.max(curT, cut.tEnd);
    }

    if (curT < L - 0.05) {
      const sx1 = wall.x1 + curT * ux;
      const sy1 = wall.y1 + curT * uy;
      solidSegments.push({
        x1: sx1,
        y1: sy1,
        x2: wall.x2,
        y2: wall.y2,
        length: L - curT,
        tStart: curT,
        tEnd: L,
      });
    }
  }

  return {
    wallId: wall.id,
    totalLength: L,
    solidSegments,
    openings: rawOpenings,
  };
}

/**
 * Calculates the bounding box across all geometry (walls, rooms, columns, furniture, stairs).
 * Used for automatic fit-to-screen to ensure the building occupies 70-85% of canvas.
 */
export function calculatePlanBoundingBox(
  walls: FloorPlanWall[] = [],
  rooms: FloorPlanRoom[] = [],
  doors: FloorPlanDoor[] = [],
  windows: FloorPlanWindow[] = [],
  furniture: FloorPlanFurniture[] = [],
  columns: any[] = [],
  stairs: any[] = [],
  plotLength: number = 40,
  plotWidth: number = 30
): {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
  hasGeometry: boolean;
} {
  const xs: number[] = [];
  const ys: number[] = [];

  for (const w of walls) {
    xs.push(w.x1, w.x2);
    ys.push(w.y1, w.y2);
  }

  for (const r of rooms) {
    xs.push(r.x, r.x + r.width);
    ys.push(r.y, r.y + r.height);
    if (r.polygonPoints) {
      for (const p of r.polygonPoints) {
        xs.push(p.x);
        ys.push(p.y);
      }
    }
  }

  for (const d of doors) {
    xs.push(d.x, d.x + (d.width || 3));
    ys.push(d.y, d.y + (d.width || 3));
  }

  for (const win of windows) {
    xs.push(win.x, win.x + (win.width || 4));
    ys.push(win.y, win.y + (win.width || 4));
  }

  for (const f of furniture) {
    xs.push(f.x, f.x + (f.width || 3));
    ys.push(f.y, f.y + (f.height || 3));
  }

  for (const c of columns) {
    xs.push(c.x, c.x + (c.size || 1));
    ys.push(c.y, c.y + (c.size || 1));
  }

  for (const s of stairs) {
    xs.push(s.x, s.x + (s.width || 3));
    ys.push(s.y, s.y + (s.length || 10));
  }

  const hasGeometry = xs.length > 0;

  if (!hasGeometry) {
    // Default to plot boundary
    const pW = plotLength > 0 ? plotLength : 40;
    const pH = plotWidth > 0 ? plotWidth : 30;
    return {
      minX: 0,
      maxX: pW,
      minY: 0,
      maxY: pH,
      width: pW,
      height: pH,
      centerX: pW / 2,
      centerY: pH / 2,
      hasGeometry: false,
    };
  }

  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxY - minY);

  return {
    minX,
    maxX,
    minY,
    maxY,
    width,
    height,
    centerX: minX + width / 2,
    centerY: minY + height / 2,
    hasGeometry: true,
  };
}

/**
 * Finds the host wall for a door or window, snaps to centerline, and inherits host wall thickness
 */
export function findHostWallForOpening(
  x: number,
  y: number,
  walls: FloorPlanWall[],
  threshold: number = 2.0
): {
  wall: FloorPlanWall;
  projectedX: number;
  projectedY: number;
  offset: number;
  angleDeg: number;
  wallThickness: number;
} | null {
  let bestDist = threshold;
  let bestMatch: {
    wall: FloorPlanWall;
    projectedX: number;
    projectedY: number;
    offset: number;
    angleDeg: number;
    wallThickness: number;
  } | null = null;

  for (const wall of walls) {
    const L = Math.hypot(wall.x2 - wall.x1, wall.y2 - wall.y1);
    if (L < 0.01) continue;

    const ux = (wall.x2 - wall.x1) / L;
    const uy = (wall.y2 - wall.y1) / L;
    const t = (x - wall.x1) * ux + (y - wall.y1) * uy;

    // Must project reasonably within the wall segment
    if (t >= -0.5 && t <= L + 0.5) {
      const clampedT = Math.max(0, Math.min(L, t));
      const px = wall.x1 + clampedT * ux;
      const py = wall.y1 + clampedT * uy;
      const dist = Math.hypot(x - px, y - py);

      if (dist < bestDist) {
        bestDist = dist;
        let angle = Math.atan2(wall.y2 - wall.y1, wall.x2 - wall.x1) * 180 / Math.PI;
        if (angle < 0) angle += 360;
        bestMatch = {
          wall,
          projectedX: px,
          projectedY: py,
          offset: clampedT,
          angleDeg: Math.round(angle),
          wallThickness: wall.thickness || 0.75,
        };
      }
    }
  }

  return bestMatch;
}

/**
 * Standard Architectural Window Catalog Specifications
 */
export const ARCHITECTURAL_WINDOW_TYPES: {
  type: string;
  label: string;
  defaultWidth: number;   // in feet
  defaultHeight: number;  // in feet
  defaultSillHeight: number; // in feet
  frameThickness: number; // in feet (e.g. 2.5 inches = ~0.2 ft)
  glazingType: 'single' | 'double' | 'sliding' | 'triple' | 'louvers';
  description: string;
}[] = [
  {
    type: 'Single Window',
    label: 'Single Window (Casement)',
    defaultWidth: 3.0,
    defaultHeight: 4.0,
    defaultSillHeight: 3.0,
    frameThickness: 0.18,
    glazingType: 'single',
    description: 'Standard 3 ft single-leaf casement window with exterior sill',
  },
  {
    type: 'Double Window',
    label: 'Double Window',
    defaultWidth: 4.0,
    defaultHeight: 4.0,
    defaultSillHeight: 3.0,
    frameThickness: 0.2,
    glazingType: 'double',
    description: '4 ft double-leaf window with center mullion',
  },
  {
    type: 'Sliding Window',
    label: 'Sliding Window (2-Track)',
    defaultWidth: 5.0,
    defaultHeight: 4.0,
    defaultSillHeight: 3.0,
    frameThickness: 0.22,
    glazingType: 'sliding',
    description: '5 ft 2-track sliding UPVC/Aluminium window with overlapping sashes',
  },
  {
    type: 'Large Window',
    label: 'Large Picture Window',
    defaultWidth: 6.0,
    defaultHeight: 5.0,
    defaultSillHeight: 2.5,
    frameThickness: 0.22,
    glazingType: 'triple',
    description: '6 ft large panoramic window for living rooms and halls',
  },
  {
    type: 'Bay Window',
    label: 'Bay Window',
    defaultWidth: 6.0,
    defaultHeight: 5.0,
    defaultSillHeight: 2.0,
    frameThickness: 0.22,
    glazingType: 'triple',
    description: 'Projecting 3-panel bay window creating an architectural alcove',
  },
  {
    type: 'Corner Window',
    label: 'Corner Window',
    defaultWidth: 4.0,
    defaultHeight: 4.0,
    defaultSillHeight: 3.0,
    frameThickness: 0.2,
    glazingType: 'double',
    description: 'Wrap-around corner window with frameless or slim corner post',
  },
  {
    type: 'Fixed Window',
    label: 'Fixed Glass Light',
    defaultWidth: 4.0,
    defaultHeight: 3.5,
    defaultSillHeight: 3.5,
    frameThickness: 0.16,
    glazingType: 'single',
    description: 'Non-operable fixed glass pane for daylight illumination',
  },
  {
    type: 'Ventilator',
    label: 'High Ventilator / Louver',
    defaultWidth: 2.0,
    defaultHeight: 1.5,
    defaultSillHeight: 6.5,
    frameThickness: 0.16,
    glazingType: 'louvers',
    description: 'High-level frosted glass louver ventilator for bathrooms & kitchens',
  },
];
