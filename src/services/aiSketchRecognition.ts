import type {
  FloorPlanWall,
  FloorPlanRoom,
  FloorPlanUnit,
  RoomType,
} from '../db/types';
import {
  getWallAngleDeg,
  getWallLength,
  detectEnclosedRooms,
} from './geometryEngine';

// ============================================================
// Types & Interfaces for Real-Time AI Sketch Understanding
// ============================================================

export interface Point2D {
  x: number;
  y: number;
}

export interface WallRegularizationResult {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  wasStraightened: boolean;
  wasWelded: boolean;
  weldCount: number;
  straightenedAngle?: number;
  summaryMessage: string;
}

export interface RecognizedRoomResult {
  detected: boolean;
  room?: FloorPlanRoom;
  message?: string;
}

export interface SketchClassificationResult {
  type: 'straight_wall' | 'multi_wall_path' | 'enclosed_box_room' | 'none';
  walls: FloorPlanWall[];
  room?: FloorPlanRoom;
  confidence: number;
  summary: string;
}

// ============================================================
// 1. Real-Time Rough Line Regularization: regularizeRoughWall
// ============================================================

/**
 * Takes loosely drawn start and end points and interprets the user's intent:
 * 1. Magnetic Corner Snapping: If start or end is within snapRadius of any existing
 *    wall endpoint, snap it exactly so corners are watertight ("no gaps").
 * 2. Smart Angle Snap: If line is tilted within tolerance (default ±14°) of
 *    cardinals (0°, 90°, 180°, 270°) or 45°, snap to exact angle without wobbling.
 */
export function regularizeRoughWall(
  rawStart: Point2D,
  rawEnd: Point2D,
  existingWalls: FloorPlanWall[],
  options: {
    unit?: FloorPlanUnit;
    snapRadius?: number;
    angleToleranceDeg?: number;
    lockEndIfWelded?: boolean;
  } = {}
): WallRegularizationResult {
  const unit = options.unit || 'feet';
  const snapRadius = options.snapRadius ?? (unit === 'feet' ? 1.5 : 0.45);
  const angleTolerance = options.angleToleranceDeg ?? 14;

  let x1 = +rawStart.x.toFixed(2);
  let y1 = +rawStart.y.toFixed(2);
  let x2 = +rawEnd.x.toFixed(2);
  let y2 = +rawEnd.y.toFixed(2);

  let wasWelded = false;
  let weldCount = 0;
  let startWelded = false;
  let endWelded = false;

  // Step 1: Magnetic snap for start point to nearest existing endpoint
  let bestStartDist = snapRadius;
  let snappedStartX = x1;
  let snappedStartY = y1;

  for (const w of existingWalls) {
    const d1 = Math.hypot(x1 - w.x1, y1 - w.y1);
    if (d1 < bestStartDist) {
      bestStartDist = d1;
      snappedStartX = w.x1;
      snappedStartY = w.y1;
      startWelded = true;
    }
    const d2 = Math.hypot(x1 - w.x2, y1 - w.y2);
    if (d2 < bestStartDist) {
      bestStartDist = d2;
      snappedStartX = w.x2;
      snappedStartY = w.y2;
      startWelded = true;
    }
  }

  if (startWelded) {
    x1 = snappedStartX;
    y1 = snappedStartY;
    weldCount++;
    wasWelded = true;
  }

  // Step 2: Magnetic snap for end point to nearest existing endpoint
  let bestEndDist = snapRadius;
  let snappedEndX = x2;
  let snappedEndY = y2;

  for (const w of existingWalls) {
    const d1 = Math.hypot(x2 - w.x1, y2 - w.y1);
    if (d1 < bestEndDist) {
      bestEndDist = d1;
      snappedEndX = w.x1;
      snappedEndY = w.y1;
      endWelded = true;
    }
    const d2 = Math.hypot(x2 - w.x2, y2 - w.y2);
    if (d2 < bestEndDist) {
      bestEndDist = d2;
      snappedEndX = w.x2;
      snappedEndY = w.y2;
      endWelded = true;
    }
  }

  if (endWelded) {
    x2 = snappedEndX;
    y2 = snappedEndY;
    weldCount++;
    wasWelded = true;
  }

  // Step 3: Orthogonal / 45° Angle Regularization
  // If end point was NOT already snapped to an existing corner, we can safely straighten the line
  let wasStraightened = false;
  let straightenedAngle: number | undefined;

  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);

  if (len > 0.4 && (!endWelded || !startWelded)) {
    let rawDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
    if (rawDeg < 0) rawDeg += 360;

    const targets = [0, 45, 90, 135, 180, 225, 270, 315, 360];
    let minDiff = 180;
    let closestTarget = rawDeg;

    for (const t of targets) {
      const diff = Math.abs(rawDeg - t);
      if (diff < minDiff) {
        minDiff = diff;
        closestTarget = t % 360;
      }
    }

    if (minDiff >= 0.5 && minDiff <= angleTolerance) {
      wasStraightened = true;
      straightenedAngle = closestTarget;
      const rad = (closestTarget * Math.PI) / 180;

      if (!endWelded) {
        // Keep start point, straighten end point
        x2 = +(x1 + len * Math.cos(rad)).toFixed(2);
        y2 = +(y1 + len * Math.sin(rad)).toFixed(2);
      } else if (!startWelded) {
        // Keep end point, straighten start point backward
        x1 = +(x2 - len * Math.cos(rad)).toFixed(2);
        y1 = +(y2 - len * Math.sin(rad)).toFixed(2);
      }
    }
  }

  let summaryMessage = 'Wall placed';
  if (wasStraightened && wasWelded) {
    summaryMessage = `✨ Straightened to ${straightenedAngle}° & welded corner`;
  } else if (wasStraightened) {
    summaryMessage = `✨ Auto-straightened crooked line to ${straightenedAngle}°`;
  } else if (wasWelded) {
    summaryMessage = `✨ Corner magnetically welded (${weldCount} joint)`;
  }

  return {
    x1,
    y1,
    x2,
    y2,
    wasStraightened,
    wasWelded,
    weldCount,
    straightenedAngle,
    summaryMessage,
  };
}

// ============================================================
// 2. Real-Time Room Loop Recognition: recognizeRoomPerimeter
// ============================================================

const ROOM_NAME_SEQUENCE: RoomType[] = [
  'Living Room',
  'Master Bedroom',
  'Bedroom',
  'Kitchen',
  'Dining',
  'Guest Room',
  'Kids Room',
  'Bathroom',
  'Toilet',
  'Pooja',
  'Balcony',
  'Utility',
];

/**
 * Checks if the newly drawn wall completed a closed perimeter that can form an architectural room.
 */
export function recognizeRoomPerimeter(
  allWalls: FloorPlanWall[],
  existingRooms: FloorPlanRoom[],
  unit: FloorPlanUnit = 'feet'
): RecognizedRoomResult {
  try {
    const detectedRooms = detectEnclosedRooms(allWalls, unit);
    if (!detectedRooms || detectedRooms.length === 0) {
      return { detected: false };
    }

    // Find a detected room that does not yet overlap an existing room
    for (const d of detectedRooms) {
      const centerX = d.x + d.width / 2;
      const centerY = d.y + d.height / 2;

      const alreadyCovered = existingRooms.some(r => {
        return (
          centerX >= r.x &&
          centerX <= r.x + r.width &&
          centerY >= r.y &&
          centerY <= r.y + r.height
        );
      });

      if (!alreadyCovered && (d.area || 0) >= (unit === 'feet' ? 15 : 1.5)) {
        // Pick an intelligent room name based on count and area
        let chosenType: RoomType = 'Living Room';
        const usedTypes = new Set(existingRooms.map(r => r.roomType));

        for (const candidate of ROOM_NAME_SEQUENCE) {
          if (!usedTypes.has(candidate)) {
            chosenType = candidate;
            break;
          }
        }

        const roomIndex = existingRooms.length + 1;
        const newRoom: FloorPlanRoom = {
          id: `room-ai-live-${Date.now()}-${roomIndex}`,
          roomType: chosenType,
          label: `${chosenType}`,
          x: d.x,
          y: d.y,
          width: d.width,
          height: d.height,
          area: d.area || 0,
          perimeter: d.perimeter || 0,
          polygonPoints: d.polygonPoints,
          rotation: 0,
          floorFinish: 'Wood Parquet',
          wallThickness: unit === 'feet' ? 0.75 : 0.23,
          layer: 'rooms',
        };

        return {
          detected: true,
          room: newRoom,
          message: `✨ AI detected enclosed boundary! Created ${newRoom.label} (${Math.round(d.area || 0)} ${unit === 'feet' ? 'sq.ft' : 'm²'})`,
        };
      }
    }
  } catch (err) {
    /* ignore loop detection edge cases */
  }

  return { detected: false };
}

// ============================================================
// 3. Freehand CAD Gesture Recognition: classifySketchStroke
// ============================================================

/**
 * Classifies a sequence of freehand points from mouse/finger drag into:
 * - straight_wall: roughly linear stroke
 * - enclosed_box_room: roughly rectangular box stroke with start ~ end
 * - multi_wall_path: connected polyline
 */
export function classifySketchStroke(
  points: Point2D[],
  unit: FloorPlanUnit = 'feet',
  existingWalls: FloorPlanWall[] = []
): SketchClassificationResult {
  if (points.length < 2) {
    return {
      type: 'none',
      walls: [],
      confidence: 0,
      summary: 'Stroke too short',
    };
  }

  const pStart = points[0];
  const pEnd = points[points.length - 1];
  const totalChord = Math.hypot(pEnd.x - pStart.x, pEnd.y - pStart.y);

  // Compute bounding box
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  let pathLen = 0;

  for (let i = 0; i < points.length; i++) {
    minX = Math.min(minX, points[i].x);
    maxX = Math.max(maxX, points[i].x);
    minY = Math.min(minY, points[i].y);
    maxY = Math.max(maxY, points[i].y);
    if (i > 0) {
      pathLen += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    }
  }

  const boxW = maxX - minX;
  const boxH = maxY - minY;

  // Case A: Loop / Box Room Detection
  // Start and end points are close to each other, and path wraps around a box
  const loopClosureDist = Math.hypot(pEnd.x - pStart.x, pEnd.y - pStart.y);
  const minRoomDim = unit === 'feet' ? 4 : 1.2;

  if (
    points.length >= 8 &&
    boxW >= minRoomDim &&
    boxH >= minRoomDim &&
    loopClosureDist <= Math.max(boxW, boxH) * 0.35 &&
    pathLen > (boxW + boxH) * 1.5
  ) {
    // User roughly sketched a box/room!
    const thickness = unit === 'feet' ? 0.75 : 0.23;
    const now = Date.now();

    // Create 4 clean rectangular perimeter walls
    const wTop: FloorPlanWall = {
      id: `wall-sk-${now}-1`,
      x1: +minX.toFixed(2),
      y1: +minY.toFixed(2),
      x2: +maxX.toFixed(2),
      y2: +minY.toFixed(2),
      thickness,
      wallType: 'exterior',
      layer: 'walls',
    };
    const wRight: FloorPlanWall = {
      id: `wall-sk-${now}-2`,
      x1: +maxX.toFixed(2),
      y1: +minY.toFixed(2),
      x2: +maxX.toFixed(2),
      y2: +maxY.toFixed(2),
      thickness,
      wallType: 'exterior',
      layer: 'walls',
    };
    const wBottom: FloorPlanWall = {
      id: `wall-sk-${now}-3`,
      x1: +maxX.toFixed(2),
      y1: +maxY.toFixed(2),
      x2: +minX.toFixed(2),
      y2: +maxY.toFixed(2),
      thickness,
      wallType: 'exterior',
      layer: 'walls',
    };
    const wLeft: FloorPlanWall = {
      id: `wall-sk-${now}-4`,
      x1: +minX.toFixed(2),
      y1: +maxY.toFixed(2),
      x2: +minX.toFixed(2),
      y2: +minY.toFixed(2),
      thickness,
      wallType: 'exterior',
      layer: 'walls',
    };

    const roomArea = +(boxW * boxH).toFixed(2);
    const room: FloorPlanRoom = {
      id: `room-sk-${now}`,
      roomType: 'Living Room',
      label: `Room (${boxW.toFixed(1)}×${boxH.toFixed(1)})`,
      x: +minX.toFixed(2),
      y: +minY.toFixed(2),
      width: +boxW.toFixed(2),
      height: +boxH.toFixed(2),
      area: roomArea,
      perimeter: +(2 * (boxW + boxH)).toFixed(2),
      rotation: 0,
      floorFinish: 'Wood Parquet',
      wallThickness: thickness,
      layer: 'rooms',
    };

    return {
      type: 'enclosed_box_room',
      walls: [wTop, wRight, wBottom, wLeft],
      room,
      confidence: 0.92,
      summary: `✨ AI recognized box sketch! Created ${boxW.toFixed(1)}×${boxH.toFixed(1)} Room with 4 walls`,
    };
  }

  // Case B: Straight Wall Detection
  // Check linearity: pathLen vs direct chord length
  const linearityRatio = totalChord / Math.max(0.01, pathLen);

  if (linearityRatio > 0.75 && totalChord > 0.5) {
    const reg = regularizeRoughWall(pStart, pEnd, existingWalls, { unit });
    const wall: FloorPlanWall = {
      id: `wall-sk-${Date.now()}`,
      x1: reg.x1,
      y1: reg.y1,
      x2: reg.x2,
      y2: reg.y2,
      thickness: unit === 'feet' ? 0.75 : 0.23,
      wallType: 'exterior',
      layer: 'walls',
    };

    return {
      type: 'straight_wall',
      walls: [wall],
      confidence: 0.88,
      summary: reg.summaryMessage,
    };
  }

  return {
    type: 'none',
    walls: [],
    confidence: 0.2,
    summary: 'Could not classify stroke',
  };
}
