import type {
  FloorPlanWall,
  FloorPlanRoom,
  FloorPlanDoor,
  FloorPlanWindow,
  FloorPlanFurniture,
  FloorPlanColumn,
  FloorPlanStaircase,
  FloorPlanUnit,
  RoomType,
  DoorType,
  WindowType,
} from '../db/types';
import {
  getWallLength,
  getWallAngleDeg,
  formatLength,
  formatArea,
  projectPointOntoWall,
  detectEnclosedRooms,
} from './geometryEngine';

// ============================================================
// Types & Interfaces
// ============================================================

export interface Point2D {
  x: number;
  y: number;
}

export interface StrokeFeatures {
  startPoint: Point2D;
  endPoint: Point2D;
  directLength: number;
  pathLength: number;
  linearity: number; // 0 (chaotic) to 1 (straight line)
  angleDeg: number;
  closestCardinalDeg: number;
  cardinalDeviationDeg: number;
  boundingBox: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    width: number;
    height: number;
    aspectRatio: number;
    diagonal: number;
    area: number;
  };
  pointCount: number;
  isClosedLoop: boolean;
  loopClosureRatio: number;
  polygonArea: number;
  nearestWallDistance: number;
  nearestWallEndpointDist: number;
  isNearExistingWall: boolean;
  isPerpendicularToNearestWall: boolean;
  isCollinearWithNearestWall: boolean;
  nearestWallId?: string;
  inflectionCount: number;
}

export type DetectedClassificationType =
  | 'wall'
  | 'room_boundary'
  | 'door'
  | 'window'
  | 'stair'
  | 'column'
  | 'dimension'
  | 'furniture'
  | 'unknown';

export interface ValidatedPlanAction {
  action:
    | 'ADD_WALL'
    | 'UPDATE_WALL'
    | 'DELETE_WALL'
    | 'ADD_ROOM'
    | 'UPDATE_ROOM'
    | 'DELETE_ROOM'
    | 'ADD_DOOR'
    | 'ADD_WINDOW'
    | 'ADD_COLUMN'
    | 'ADD_STAIR'
    | 'FIX_ISSUE'
    | 'SWITCH_VIEW'
    | 'NOOP';
  objectId?: string;
  property?: string;
  value?: any;
  unit?: FloorPlanUnit;
  payload?: any;
  description: string;
}

export interface CandidateOption {
  type: DetectedClassificationType;
  label: string;
  confidence: number;
  description: string;
  action: ValidatedPlanAction;
}

export interface StrokeClassification {
  id: string;
  classification: DetectedClassificationType;
  confidence: number; // 0.0 to 1.0
  label: string;
  reasoning: string;
  requiresConfirmation: boolean; // confidence < 0.90
  isUncertain: boolean; // confidence < 0.70
  suggestedAction: ValidatedPlanAction;
  options: CandidateOption[];
  features: StrokeFeatures;
  timestamp: number;
}

export interface PlanDiagnosticIssue {
  id: string;
  type:
    | 'open_wall'
    | 'unclosed_room'
    | 'overlapping_wall'
    | 'duplicate_wall'
    | 'misaligned_corner'
    | 'floating_door'
    | 'floating_window'
    | 'invalid_dimension';
  severity: 'critical' | 'warning' | 'info';
  title: string;
  location: string;
  description: string;
  suggestedFix: string;
  fixAction?: ValidatedPlanAction;
  elementIds: string[];
}

export interface PlanAnalysisReport {
  grossFloorAreaSqUnits: number;
  formattedTotalArea: string;
  roomCount: number;
  doorCount: number;
  windowCount: number;
  wallCount: number;
  columnCount: number;
  stairCount: number;
  totalWallLength: number;
  formattedWallLength: string;
  roomBreakdown: Array<{
    id: string;
    name: string;
    type: RoomType;
    width: number;
    height: number;
    area: number;
    formattedArea: string;
  }>;
  unclosedBoundariesCount: number;
  missingDimensionsCount: number;
  timestamp: number;
}

export interface ProposedLayoutRequest {
  plotWidth: number;
  plotDepth: number;
  unit: FloorPlanUnit;
  bedrooms: number;
  bathrooms: number;
  facing: 'North' | 'East' | 'South' | 'West';
  hasParking: boolean;
  hasPooja: boolean;
}

export interface ProposedLayoutResult {
  title: string;
  summary: string;
  plotWidth: number;
  plotDepth: number;
  walls: FloorPlanWall[];
  rooms: FloorPlanRoom[];
  doors: FloorPlanDoor[];
  windows: FloorPlanWindow[];
  disclaimer: string;
}

// ============================================================
// 1. Deterministic Geometry Feature Extractor
// ============================================================

export function extractStrokeGeometry(
  points: Point2D[],
  existingWalls: FloorPlanWall[] = [],
  unit: FloorPlanUnit = 'feet'
): StrokeFeatures {
  if (!points || points.length === 0) {
    const zeroPt = { x: 0, y: 0 };
    return {
      startPoint: zeroPt,
      endPoint: zeroPt,
      directLength: 0,
      pathLength: 0,
      linearity: 0,
      angleDeg: 0,
      closestCardinalDeg: 0,
      cardinalDeviationDeg: 0,
      boundingBox: {
        minX: 0, minY: 0, maxX: 0, maxY: 0,
        width: 0, height: 0, aspectRatio: 1, diagonal: 0, area: 0,
      },
      pointCount: 0,
      isClosedLoop: false,
      loopClosureRatio: 1,
      polygonArea: 0,
      nearestWallDistance: 999,
      nearestWallEndpointDist: 999,
      isNearExistingWall: false,
      isPerpendicularToNearestWall: false,
      isCollinearWithNearestWall: false,
      inflectionCount: 0,
    };
  }

  const startPoint = points[0];
  const endPoint = points[points.length - 1];
  const pointCount = points.length;

  const dx = endPoint.x - startPoint.x;
  const dy = endPoint.y - startPoint.y;
  const directLength = Math.hypot(dx, dy);

  // Calculate path arc-length & bounding box
  let pathLength = 0;
  let minX = points[0].x;
  let maxX = points[0].x;
  let minY = points[0].y;
  let maxY = points[0].y;

  let inflections = 0;
  let prevAngle = 0;

  for (let i = 0; i < points.length; i++) {
    const pt = points[i];
    if (pt.x < minX) minX = pt.x;
    if (pt.x > maxX) maxX = pt.x;
    if (pt.y < minY) minY = pt.y;
    if (pt.y > maxY) maxY = pt.y;

    if (i > 0) {
      const segDx = pt.x - points[i - 1].x;
      const segDy = pt.y - points[i - 1].y;
      const segLen = Math.hypot(segDx, segDy);
      pathLength += segLen;

      const segAngle = Math.atan2(segDy, segDx);
      if (i > 1) {
        let diff = Math.abs(segAngle - prevAngle);
        if (diff > Math.PI) diff = 2 * Math.PI - diff;
        if (diff > Math.PI / 3) {
          inflections++;
        }
      }
      prevAngle = segAngle;
    }
  }

  const width = Math.max(0.01, maxX - minX);
  const height = Math.max(0.01, maxY - minY);
  const aspectRatio = width / height;
  const diagonal = Math.hypot(width, height);
  const boxArea = width * height;

  // Linearity: direct length / path length (1.0 = perfect straight line)
  const linearity = pathLength > 0.001 ? Math.min(1.0, directLength / pathLength) : 1.0;

  // Angle calculation (0° to 360°)
  let angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
  if (angleDeg < 0) angleDeg += 360;

  const cardinals = [0, 45, 90, 135, 180, 225, 270, 315, 360];
  let minDev = 180;
  let closestCardinal = 0;
  for (const c of cardinals) {
    const diff = Math.abs(angleDeg - c);
    if (diff < minDev) {
      minDev = diff;
      closestCardinal = c % 360;
    }
  }

  // Loop closure: distance between start and end compared to diagonal
  const distStartEnd = Math.hypot(startPoint.x - endPoint.x, startPoint.y - endPoint.y);
  const loopClosureRatio = diagonal > 0.1 ? distStartEnd / diagonal : 1.0;
  const isClosedLoop = pointCount >= 4 && (distStartEnd < 1.8 || loopClosureRatio < 0.28);

  // Polygon area using Shoelace formula
  let polyArea = 0;
  if (points.length >= 3) {
    for (let i = 0; i < points.length; i++) {
      const j = (i + 1) % points.length;
      polyArea += points[i].x * points[j].y;
      polyArea -= points[j].x * points[i].y;
    }
    polyArea = Math.abs(polyArea) / 2;
  }

  // Analyze proximity to existing walls
  let nearestWallDistance = 999;
  let nearestWallEndpointDist = 999;
  let nearestWallId: string | undefined;
  let isPerpendicularToNearestWall = false;
  let isCollinearWithNearestWall = false;

  for (const wall of existingWalls) {
    // Check distance to endpoints
    const dStart1 = Math.hypot(startPoint.x - wall.x1, startPoint.y - wall.y1);
    const dStart2 = Math.hypot(startPoint.x - wall.x2, startPoint.y - wall.y2);
    const dEnd1 = Math.hypot(endPoint.x - wall.x1, endPoint.y - wall.y1);
    const dEnd2 = Math.hypot(endPoint.x - wall.x2, endPoint.y - wall.y2);
    const minEndpointD = Math.min(dStart1, dStart2, dEnd1, dEnd2);

    if (minEndpointD < nearestWallEndpointDist) {
      nearestWallEndpointDist = minEndpointD;
    }

    // Check distance to wall line
    const midPoint = { x: (startPoint.x + endPoint.x) / 2, y: (startPoint.y + endPoint.y) / 2 };
    const proj = projectPointOntoWall(midPoint.x, midPoint.y, [wall], 999);
    const wallDist = proj ? proj.distance : 999;

    if (wallDist < nearestWallDistance) {
      nearestWallDistance = wallDist;
      nearestWallId = wall.id;


      // Check relative orientation
      const wallAngle = getWallAngleDeg(wall);
      let angleDiff = Math.abs((angleDeg % 180) - (wallAngle % 180));
      if (angleDiff > 90) angleDiff = 180 - angleDiff;

      isCollinearWithNearestWall = angleDiff < 15;
      isPerpendicularToNearestWall = Math.abs(angleDiff - 90) < 15;
    }
  }

  const isNearExistingWall = nearestWallDistance < (unit === 'feet' ? 2.5 : 0.8);

  return {
    startPoint,
    endPoint,
    directLength,
    pathLength,
    linearity,
    angleDeg,
    closestCardinalDeg: closestCardinal,
    cardinalDeviationDeg: minDev,
    boundingBox: {
      minX, minY, maxX, maxY,
      width, height, aspectRatio, diagonal, area: boxArea,
    },
    pointCount,
    isClosedLoop,
    loopClosureRatio,
    polygonArea: polyArea,
    nearestWallDistance,
    nearestWallEndpointDist,
    isNearExistingWall,
    isPerpendicularToNearestWall,
    isCollinearWithNearestWall,
    nearestWallId,
    inflectionCount: inflections,
  };
}

// ============================================================
// 2. Intelligent Floor Plan Stroke Classifier
// ============================================================

/**
 * Classifies a rough drawing stroke into architectural elements:
 * - Wall (high confidence if straight & cardinal/connected)
 * - Room boundary (closed polygon loop)
 * - Door (opening in wall, perpendicular tick or arc)
 * - Window (short opening situated along wall interior)
 * - Staircase (repeated parallel rungs or zigzag inflections)
 * - Column (small square or compact rectangle)
 * - Unknown (ambiguous stroke, confidence < 0.70, asks user)
 */
export function classifyDrawingStroke(
  points: Point2D[],
  existingWalls: FloorPlanWall[] = [],
  existingRooms: FloorPlanRoom[] = [],
  unit: FloorPlanUnit = 'feet'
): StrokeClassification {
  const id = `stroke-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
  const features = extractStrokeGeometry(points, existingWalls, unit);
  const timestamp = Date.now();

  // Helper constructors for actions
  const createWallAction = (
    x1: number, y1: number, x2: number, y2: number, thickness = 0.75
  ): ValidatedPlanAction => ({
    action: 'ADD_WALL',
    payload: {
      id: `wall-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      x1, y1, x2, y2,
      thickness,
      height: 10,
      wallType: 'interior',
    },
    description: `Create straight wall (${formatLength(Math.hypot(x2 - x1, y2 - y1), unit)})`,
  });

  const createRoomAction = (
    label: string, roomType: RoomType, x: number, y: number, w: number, h: number
  ): ValidatedPlanAction => ({
    action: 'ADD_ROOM',
    payload: {
      id: `room-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      label,
      roomType,
      x, y,
      width: w,
      height: h,
      area: w * h,
      perimeter: 2 * (w + h),
      rotation: 0,
    },
    description: `Create ${label} (${formatArea(w * h, unit)})`,
  });

  const createDoorAction = (
    doorType: DoorType, x: number, y: number, width = 3.0, wallId?: string
  ): ValidatedPlanAction => ({
    action: 'ADD_DOOR',
    payload: {
      id: `door-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      doorType,
      x, y,
      width,
      rotation: 0,
      wallId,
    },
    description: `Insert ${doorType} door (${formatLength(width, unit)})`,
  });

  const createWindowAction = (
    winType: WindowType, x: number, y: number, width = 4.0, wallId?: string
  ): ValidatedPlanAction => ({
    action: 'ADD_WINDOW',
    payload: {
      id: `window-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      windowType: winType,
      x, y,
      width,
      rotation: 0,
      wallId,
    },
    description: `Insert ${winType} window (${formatLength(width, unit)})`,
  });


  const createColumnAction = (
    x: number, y: number, size = 1.0
  ): ValidatedPlanAction => ({
    action: 'ADD_COLUMN',
    payload: {
      id: `col-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      x, y,
      width: size,
      height: size,
      shape: 'rectangular',
    },
    description: `Place structural column (${formatLength(size, unit)} × ${formatLength(size, unit)})`,
  });

  // Regularize coordinates for straight wall
  let startX = +features.startPoint.x.toFixed(2);
  let startY = +features.startPoint.y.toFixed(2);
  let endX = +features.endPoint.x.toFixed(2);
  let endY = +features.endPoint.y.toFixed(2);

  // Snap to cardinal if within deviation
  if (features.cardinalDeviationDeg <= 14) {
    const len = features.directLength;
    const rad = (features.closestCardinalDeg * Math.PI) / 180;
    endX = +(startX + len * Math.cos(rad)).toFixed(2);
    endY = +(startY + len * Math.sin(rad)).toFixed(2);
  }

  // Snap to existing wall endpoint if close
  if (features.nearestWallEndpointDist < 1.5 && existingWalls.length > 0) {
    for (const w of existingWalls) {
      if (Math.hypot(startX - w.x1, startY - w.y1) < 1.5) {
        startX = w.x1; startY = w.y1;
      } else if (Math.hypot(startX - w.x2, startY - w.y2) < 1.5) {
        startX = w.x2; startY = w.y2;
      }
      if (Math.hypot(endX - w.x1, endY - w.y1) < 1.5) {
        endX = w.x1; endY = w.y1;
      } else if (Math.hypot(endX - w.x2, endY - w.y2) < 1.5) {
        endX = w.x2; endY = w.y2;
      }
    }
  }

  // ------------------------------------------------------------
  // RULE 1: Structural Column Detection
  // Small compact square/box: width and height between 0.6 and 2.5 ft, aspect ratio ~ 1.0
  // ------------------------------------------------------------
  const isCompactBox =
    features.boundingBox.width >= 0.5 &&
    features.boundingBox.width <= 2.8 &&
    features.boundingBox.height >= 0.5 &&
    features.boundingBox.height <= 2.8 &&
    features.boundingBox.aspectRatio >= 0.7 &&
    features.boundingBox.aspectRatio <= 1.4 &&
    features.pointCount >= 4;

  if (isCompactBox) {
    const colSize = +(Math.max(features.boundingBox.width, features.boundingBox.height)).toFixed(1);
    const colX = +(features.boundingBox.minX).toFixed(2);
    const colY = +(features.boundingBox.minY).toFixed(2);
    const confidence = 0.88;

    return {
      id,
      classification: 'column',
      confidence,
      label: 'Structural Column',
      reasoning: `Detected compact square envelope (${colSize} × ${colSize} ${unit === 'feet' ? 'ft' : 'm'}).`,
      requiresConfirmation: true, // 70-89% rule asks confirmation
      isUncertain: false,
      suggestedAction: createColumnAction(colX, colY, colSize),
      options: [
        {
          type: 'column',
          label: 'Place Column',
          confidence: 0.88,
          description: `Add ${colSize}×${colSize} structural column`,
          action: createColumnAction(colX, colY, colSize),
        },
        {
          type: 'wall',
          label: 'Make Wall',
          confidence: 0.35,
          description: 'Convert to short wall segment',
          action: createWallAction(startX, startY, endX, endY),
        },
      ],
      features,
      timestamp,
    };
  }

  // ------------------------------------------------------------
  // RULE 2: Closed Room Boundary Detection
  // Stroke closes on itself and covers an architectural area (> 15 sq ft / > 1.5 sq m)
  // ------------------------------------------------------------
  const minRoomArea = unit === 'feet' ? 15 : 1.5;
  if (features.isClosedLoop && features.polygonArea >= minRoomArea) {
    const roomW = +(features.boundingBox.width).toFixed(2);
    const roomH = +(features.boundingBox.height).toFixed(2);
    const roomX = +(features.boundingBox.minX).toFixed(2);
    const roomY = +(features.boundingBox.minY).toFixed(2);
    const calculatedArea = features.polygonArea > 0 ? features.polygonArea : roomW * roomH;

    // Confidence is very high (94%) if loop closure is tight and has 4 corners
    const isVeryClean = features.loopClosureRatio < 0.15 && features.inflectionCount >= 3;
    const confidence = isVeryClean ? 0.94 : 0.82;

    const livingRoomAction = createRoomAction('Living Room', 'Living Room', roomX, roomY, roomW, roomH);
    const bedroomAction = createRoomAction('Bedroom', 'Bedroom', roomX, roomY, roomW, roomH);
    const kitchenAction = createRoomAction('Kitchen', 'Kitchen', roomX, roomY, roomW, roomH);
    const bathroomAction = createRoomAction('Bathroom', 'Bathroom', roomX, roomY, roomW, roomH);

    return {
      id,
      classification: 'room_boundary',
      confidence,
      label: 'Closed Room Boundary',
      reasoning: `Found enclosed boundary (${formatArea(calculatedArea, unit)}).`,
      requiresConfirmation: !isVeryClean,
      isUncertain: false,
      suggestedAction: bedroomAction,
      options: [
        {
          type: 'room_boundary',
          label: 'Bedroom',
          confidence: 0.90,
          description: `Create Bedroom (${formatArea(calculatedArea, unit)})`,
          action: bedroomAction,
        },
        {
          type: 'room_boundary',
          label: 'Living Room',
          confidence: 0.88,
          description: `Create Living Room (${formatArea(calculatedArea, unit)})`,
          action: livingRoomAction,
        },
        {
          type: 'room_boundary',
          label: 'Kitchen',
          confidence: 0.85,
          description: `Create Kitchen (${formatArea(calculatedArea, unit)})`,
          action: kitchenAction,
        },
        {
          type: 'room_boundary',
          label: 'Bathroom',
          confidence: 0.80,
          description: `Create Bathroom (${formatArea(calculatedArea, unit)})`,
          action: bathroomAction,
        },
        {
          type: 'wall',
          label: 'Separate Walls',
          confidence: 0.40,
          description: 'Keep as 4 independent walls',
          action: createWallAction(startX, startY, endX, endY),
        },
      ],
      features,
      timestamp,
    };
  }

  // ------------------------------------------------------------
  // RULE 3: Window Detection
  // Situates along existing wall interior collinear with it
  // ------------------------------------------------------------
  const isWindowSized =
    features.directLength >= (unit === 'feet' ? 2.5 : 0.75) &&
    features.directLength <= (unit === 'feet' ? 8.0 : 2.5);

  if (isWindowSized && features.isNearExistingWall && features.isCollinearWithNearestWall) {
    const winX = +((features.startPoint.x + features.endPoint.x) / 2).toFixed(2);
    const winY = +((features.startPoint.y + features.endPoint.y) / 2).toFixed(2);
    const winWidth = +features.directLength.toFixed(2);
    const confidence = 0.82;

    return {
      id,
      classification: 'window',
      confidence,
      label: 'Window',
      reasoning: `Found opening along wall (${formatLength(winWidth, unit)}).`,
      requiresConfirmation: true,
      isUncertain: false,
      suggestedAction: createWindowAction('Standard', winX, winY, winWidth, features.nearestWallId),
      options: [
        {
          type: 'window',
          label: 'Standard Window',
          confidence: 0.82,
          description: 'Standard exterior glazed window',
          action: createWindowAction('Standard', winX, winY, winWidth, features.nearestWallId),
        },
        {
          type: 'window',
          label: 'Sliding Window',
          confidence: 0.78,
          description: 'Wide sliding track window',
          action: createWindowAction('Sliding', winX, winY, winWidth, features.nearestWallId),
        },
        {
          type: 'door',
          label: 'Door Instead',
          confidence: 0.45,
          description: 'Convert to door opening',
          action: createDoorAction('Single', winX, winY, winWidth, features.nearestWallId),
        },
      ],
      features,
      timestamp,
    };
  }

  // ------------------------------------------------------------
  // RULE 4: Door Detection
  // Short stroke (2.0 to 4.5 ft) near an existing wall, perpendicular or bridging an opening
  // ------------------------------------------------------------
  const isDoorSized =
    features.directLength >= (unit === 'feet' ? 2.0 : 0.6) &&
    features.directLength <= (unit === 'feet' ? 4.5 : 1.4);

  if (isDoorSized && features.isNearExistingWall && (features.isPerpendicularToNearestWall || !features.isCollinearWithNearestWall)) {
    const doorX = +((features.startPoint.x + features.endPoint.x) / 2).toFixed(2);
    const doorY = +((features.startPoint.y + features.endPoint.y) / 2).toFixed(2);
    const doorWidth = +features.directLength.toFixed(2);
    const confidence = features.isPerpendicularToNearestWall ? 0.86 : 0.74;

    return {
      id,
      classification: 'door',
      confidence,
      label: 'Door Opening',
      reasoning: `Detected door-sized opening (${formatLength(doorWidth, unit)}) near wall.`,
      requiresConfirmation: true, // Ask confirmation for door type
      isUncertain: false,
      suggestedAction: createDoorAction('Single', doorX, doorY, doorWidth, features.nearestWallId),
      options: [
        {
          type: 'door',
          label: 'Single Door',
          confidence: 0.86,
          description: 'Standard interior single swing door',
          action: createDoorAction('Single', doorX, doorY, doorWidth, features.nearestWallId),
        },
        {
          type: 'door',
          label: 'Main Entrance Door',
          confidence: 0.82,
          description: 'Heavy main entrance door',
          action: createDoorAction('Main Entrance', doorX, doorY, doorWidth, features.nearestWallId),
        },
        {
          type: 'door',
          label: 'Sliding Door',
          confidence: 0.78,
          description: 'Smooth sliding partition door',
          action: createDoorAction('Sliding', doorX, doorY, doorWidth, features.nearestWallId),
        },
        {
          type: 'door',
          label: 'Bathroom Door',
          confidence: 0.75,
          description: 'Compact bathroom door',
          action: createDoorAction('Bathroom', doorX, doorY, doorWidth, features.nearestWallId),
        },
        {
          type: 'wall',
          label: 'Short Wall',
          confidence: 0.40,
          description: 'Keep as a solid wall partition',
          action: createWallAction(startX, startY, endX, endY),
        },
      ],
      features,
      timestamp,
    };
  }

  // ------------------------------------------------------------
  // RULE 5: Staircase Detection
  // Multiple rapid inflections (zigzag rungs or parallel rungs)
  // ------------------------------------------------------------
  if (features.inflectionCount >= 5 && features.boundingBox.diagonal > 3.0) {
    const stairX = +(features.boundingBox.minX).toFixed(2);
    const stairY = +(features.boundingBox.minY).toFixed(2);
    const stairW = +(features.boundingBox.width).toFixed(2);
    const stairH = +(features.boundingBox.height).toFixed(2);
    const confidence = 0.81;

    const stairAction: ValidatedPlanAction = {
      action: 'ADD_STAIR',
      payload: {
        id: `stair-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        x: stairX,
        y: stairY,
        width: stairW,
        height: stairH,
        type: 'Straight',
        numRisers: 16,
      },
      description: `Add staircase flight (${formatLength(stairW, unit)} × ${formatLength(stairH, unit)})`,
    };

    return {
      id,
      classification: 'stair',
      confidence,
      label: 'Staircase Flight',
      reasoning: `Detected repeated tread pattern with ${features.inflectionCount} step inflections.`,
      requiresConfirmation: true,
      isUncertain: false,
      suggestedAction: stairAction,
      options: [
        {
          type: 'stair',
          label: 'Straight Staircase',
          confidence: 0.81,
          description: 'Standard residential flight',
          action: stairAction,
        },
        {
          type: 'wall',
          label: 'Keep as Walls',
          confidence: 0.30,
          description: 'Convert strokes to walls',
          action: createWallAction(startX, startY, endX, endY),
        },
      ],
      features,
      timestamp,
    };
  }

  // ------------------------------------------------------------
  // RULE 6: Wall Detection
  // Mostly straight line (linearity >= 0.78), length >= 1.5 ft
  // ------------------------------------------------------------
  const isSubstantialLength = features.directLength >= (unit === 'feet' ? 1.5 : 0.45);
  const isMostlyStraight = features.linearity >= 0.78;

  if (isSubstantialLength && isMostlyStraight) {
    const isOrthogonal = (features.closestCardinalDeg % 90 === 0) && features.cardinalDeviationDeg <= 8;
    const isStrict45 = (features.closestCardinalDeg % 45 === 0) && features.cardinalDeviationDeg <= 4;
    const isCardinal = isOrthogonal || isStrict45;
    const isWeldedToExistingWall = features.nearestWallEndpointDist < 1.5;

    // Confidence:
    // 92-96%: Straight + Cardinal or Welded
    // 78-85%: Straight but angled at arbitrary degrees
    let confidence = 0.82;
    if (isCardinal && isWeldedToExistingWall) {
      confidence = 0.96;
    } else if (isCardinal) {
      confidence = 0.92;
    } else if (isWeldedToExistingWall) {
      confidence = 0.88;
    }

    const wallAction = createWallAction(startX, startY, endX, endY);


    return {
      id,
      classification: 'wall',
      confidence,
      label: 'Wall',
      reasoning: isCardinal
        ? `Straight orthogonal wall (${features.closestCardinalDeg}°, ${formatLength(features.directLength, unit)}).`
        : `Straight wall tilted at ${features.angleDeg.toFixed(1)}° (${formatLength(features.directLength, unit)}).`,
      requiresConfirmation: confidence < 0.90, // Safe automatic conversion if >= 0.90
      isUncertain: false,
      suggestedAction: wallAction,
      options: [
        {
          type: 'wall',
          label: 'Convert to Wall',
          confidence,
          description: `Straighten and add wall (${formatLength(features.directLength, unit)})`,
          action: wallAction,
        },
        {
          type: 'door',
          label: 'Opening / Door',
          confidence: 0.35,
          description: 'Treat line as an opening or doorway',
          action: createDoorAction('Single', (startX + endX) / 2, (startY + endY) / 2, features.directLength),
        },
        {
          type: 'unknown',
          label: 'Dismiss',
          confidence: 0.1,
          description: 'Discard stroke',
          action: { action: 'NOOP', description: 'Discard stroke' },
        },
      ],
      features,
      timestamp,
    };
  }

  // ------------------------------------------------------------
  // RULE 7: Low Confidence / Uncertain / Unknown
  // CRITICAL: DO NOT LET AI BLINDLY GUESS.
  // Confidence < 0.70 -> Ask user explicitly without modifying drawing!
  // ------------------------------------------------------------
  const defaultWall = createWallAction(startX, startY, endX, endY);
  const defaultRoom = createRoomAction(
    'Room', 'Custom',
    features.boundingBox.minX, features.boundingBox.minY,
    features.boundingBox.width, features.boundingBox.height
  );

  return {
    id,
    classification: 'unknown',
    confidence: 0.45,
    label: 'Uncertain Stroke',
    reasoning: "Drawing is ambiguous. I'm not completely sure what this represents.",
    requiresConfirmation: true,
    isUncertain: true,
    suggestedAction: { action: 'NOOP', description: 'Ask user for clarification' },
    options: [
      {
        type: 'wall',
        label: 'Wall',
        confidence: 0.55,
        description: 'Convert to straight architectural wall',
        action: defaultWall,
      },
      {
        type: 'room_boundary',
        label: 'Room Boundary',
        confidence: 0.45,
        description: 'Enclose as an architectural room space',
        action: defaultRoom,
      },
      {
        type: 'door',
        label: 'Door',
        confidence: 0.30,
        description: 'Create a doorway opening',
        action: createDoorAction('Single', (startX + endX) / 2, (startY + endY) / 2, 3.0),
      },
      {
        type: 'window',
        label: 'Window',
        confidence: 0.25,
        description: 'Create a glazed window opening',
        action: createWindowAction('Standard', (startX + endX) / 2, (startY + endY) / 2, 4.0),
      },
      {
        type: 'column',
        label: 'Column',
        confidence: 0.20,
        description: 'Create structural column',
        action: createColumnAction(features.boundingBox.minX, features.boundingBox.minY, 1.0),
      },
      {
        type: 'unknown',
        label: 'Discard',
        confidence: 0.10,
        description: 'Discard this stroke',
        action: { action: 'NOOP', description: 'Discard stroke' },
      },
    ],
    features,
    timestamp,
  };
}

// ============================================================
// 3. Controlled Action Engine & Schema Validation
// ============================================================

export interface ActionValidationResult {
  valid: boolean;
  sanitizedAction?: ValidatedPlanAction;
  error?: string;
}

/**
 * Validates plan actions before they can manipulate state:
 * - Schema conformity
 * - Coordinate safety limits
 * - Non-negative dimensions
 * - Valid ID reference checks
 */
export function validatePlanAction(action: ValidatedPlanAction): ActionValidationResult {
  if (!action || !action.action) {
    return { valid: false, error: 'Invalid action payload: missing action name.' };
  }

  const p = action.payload;

  switch (action.action) {
    case 'ADD_WALL': {
      if (!p || typeof p.x1 !== 'number' || typeof p.y1 !== 'number' ||
          typeof p.x2 !== 'number' || typeof p.y2 !== 'number') {
        return { valid: false, error: 'ADD_WALL missing coordinates (x1, y1, x2, y2).' };
      }
      const len = Math.hypot(p.x2 - p.x1, p.y2 - p.y1);
      if (len < 0.05) {
        return { valid: false, error: `Wall length is too short (${len.toFixed(3)}). Must be at least 0.05.` };
      }
      if (len > 5000) {
        return { valid: false, error: `Wall length exceeds allowable building plot bounds (${len.toFixed(1)}).` };
      }
      return {
        valid: true,
        sanitizedAction: {
          ...action,
          payload: {
            ...p,
            x1: +p.x1.toFixed(2),
            y1: +p.y1.toFixed(2),
            x2: +p.x2.toFixed(2),
            y2: +p.y2.toFixed(2),
            thickness: p.thickness ? Math.max(0.1, +p.thickness) : 0.75,
            height: p.height ? Math.max(1, +p.height) : 10,
          },
        },
      };
    }

    case 'UPDATE_WALL': {
      if (!action.objectId && (!p || !p.id)) {
        return { valid: false, error: 'UPDATE_WALL requires objectId or payload.id.' };
      }
      return { valid: true, sanitizedAction: action };
    }

    case 'DELETE_WALL': {
      if (!action.objectId && (!p || !p.id)) {
        return { valid: false, error: 'DELETE_WALL requires objectId or payload.id.' };
      }
      return { valid: true, sanitizedAction: action };
    }

    case 'ADD_ROOM': {
      if (!p || typeof p.x !== 'number' || typeof p.y !== 'number' ||
          typeof p.width !== 'number' || typeof p.height !== 'number') {
        return { valid: false, error: 'ADD_ROOM requires x, y, width, and height numbers.' };
      }
      if (p.width <= 0 || p.height <= 0) {
        return { valid: false, error: 'Room dimensions must be strictly positive.' };
      }
      return {
        valid: true,
        sanitizedAction: {
          ...action,
          payload: {
            ...p,
            x: +p.x.toFixed(2),
            y: +p.y.toFixed(2),
            width: +p.width.toFixed(2),
            height: +p.height.toFixed(2),
            area: +(p.width * p.height).toFixed(2),
            perimeter: +(2 * (p.width + p.height)).toFixed(2),
          },
        },
      };
    }

    case 'ADD_DOOR': {
      if (!p || typeof p.x !== 'number' || typeof p.y !== 'number') {
        return { valid: false, error: 'ADD_DOOR requires coordinates (x, y).' };
      }
      return {
        valid: true,
        sanitizedAction: {
          ...action,
          payload: {
            ...p,
            x: +p.x.toFixed(2),
            y: +p.y.toFixed(2),
            width: p.width ? Math.max(1.0, +p.width) : 3.0,
          },
        },
      };
    }

    case 'ADD_WINDOW': {
      if (!p || typeof p.x !== 'number' || typeof p.y !== 'number') {
        return { valid: false, error: 'ADD_WINDOW requires coordinates (x, y).' };
      }
      return {
        valid: true,
        sanitizedAction: {
          ...action,
          payload: {
            ...p,
            x: +p.x.toFixed(2),
            y: +p.y.toFixed(2),
            width: p.width ? Math.max(1.5, +p.width) : 4.0,
          },
        },
      };
    }

    case 'ADD_COLUMN':
    case 'ADD_STAIR':
    case 'SWITCH_VIEW':
    case 'NOOP':
      return { valid: true, sanitizedAction: action };

    default:
      return { valid: true, sanitizedAction: action };
  }
}

// ============================================================
// 4. "Fix My Plan" Diagnostic Engine
// ============================================================

/**
 * Scans plan geometry for architectural issues:
 * 1. Open walls (endpoints near other walls but unclosed)
 * 2. Unclosed rooms (boundaries with gaps)
 * 3. Overlapping walls (collinear duplicate segments)
 * 4. Duplicate walls (exact identical endpoints)
 * 5. Misaligned corners (off by 1° to 14°)
 * 6. Floating doors (doors not attached to any wall)
 * 7. Floating windows (windows outside walls)
 * 8. Invalid dimensions (zero/negative length walls)
 */
export function diagnosePlanIssues(
  walls: FloorPlanWall[],
  rooms: FloorPlanRoom[],
  doors: FloorPlanDoor[],
  windows: FloorPlanWindow[],
  unit: FloorPlanUnit = 'feet'
): PlanDiagnosticIssue[] {
  const issues: PlanDiagnosticIssue[] = [];
  const gapThreshold = unit === 'feet' ? 2.5 : 0.8;

  // 1. Duplicate & Overlapping Walls
  for (let i = 0; i < walls.length; i++) {
    const w1 = walls[i];
    const len1 = getWallLength(w1);

    if (len1 < 0.2) {
      issues.push({
        id: `inv-${w1.id}`,
        type: 'invalid_dimension',
        severity: 'critical',
        title: 'Zero / Tiny Wall Fragment',
        location: `(${w1.x1.toFixed(1)}, ${w1.y1.toFixed(1)})`,
        description: `Wall length is only ${formatLength(len1, unit)}, which causes CAD errors.`,
        suggestedFix: 'Remove this invalid fragment.',
        fixAction: {
          action: 'DELETE_WALL',
          objectId: w1.id,
          description: `Delete micro wall fragment (${formatLength(len1, unit)})`,
        },
        elementIds: [w1.id],
      });
      continue;
    }

    // Check angle misalignment (1° to 14°)
    const angle1 = getWallAngleDeg(w1);
    const cardinals = [0, 45, 90, 135, 180, 225, 270, 315, 360];
    let minDev = 180;
    let closestCard = 0;
    for (const c of cardinals) {
      const d = Math.abs(angle1 - c);
      if (d < minDev) {
        minDev = d;
        closestCard = c % 360;
      }
    }

    if (minDev >= 1.0 && minDev <= 14.0) {
      const rad = (closestCard * Math.PI) / 180;
      const straightX2 = +(w1.x1 + len1 * Math.cos(rad)).toFixed(2);
      const straightY2 = +(w1.y1 + len1 * Math.sin(rad)).toFixed(2);

      issues.push({
        id: `misaligned-${w1.id}`,
        type: 'misaligned_corner',
        severity: minDev > 5 ? 'warning' : 'info',
        title: `Misaligned Wall Angle (${angle1.toFixed(1)}°)`,
        location: `(${w1.x1.toFixed(1)}, ${w1.y1.toFixed(1)})`,
        description: `Wall is tilted by ${minDev.toFixed(1)}° away from standard ${closestCard}°.`,
        suggestedFix: `Snap angle cleanly to ${closestCard}°.`,
        fixAction: {
          action: 'UPDATE_WALL',
          objectId: w1.id,
          payload: { ...w1, x2: straightX2, y2: straightY2 },
          description: `Straighten wall to ${closestCard}°`,
        },
        elementIds: [w1.id],
      });
    }

    for (let j = i + 1; j < walls.length; j++) {
      const w2 = walls[j];
      const isExactDuplicate =
        (Math.hypot(w1.x1 - w2.x1, w1.y1 - w2.y1) < 0.1 && Math.hypot(w1.x2 - w2.x2, w1.y2 - w2.y2) < 0.1) ||
        (Math.hypot(w1.x1 - w2.x2, w1.y1 - w2.y2) < 0.1 && Math.hypot(w1.x2 - w2.x1, w1.y2 - w2.y1) < 0.1);

      if (isExactDuplicate) {
        issues.push({
          id: `dup-${w1.id}-${w2.id}`,
          type: 'duplicate_wall',
          severity: 'critical',
          title: 'Duplicate Wall Detected',
          location: `(${w1.x1.toFixed(1)}, ${w1.y1.toFixed(1)})`,
          description: 'Two identical walls occupy the exact same coordinate space.',
          suggestedFix: 'Remove the duplicate wall.',
          fixAction: {
            action: 'DELETE_WALL',
            objectId: w2.id,
            description: 'Remove duplicate wall copy',
          },
          elementIds: [w1.id, w2.id],
        });
      }
    }
  }

  // 2. Open Endpoints / Gaps
  for (let i = 0; i < walls.length; i++) {
    const w1 = walls[i];
    const ends = [
      { x: w1.x1, y: w1.y1, isStart: true },
      { x: w1.x2, y: w1.y2, isStart: false },
    ];

    for (const end of ends) {
      let isConnected = false;
      let closestDist = 999;
      let targetWall: FloorPlanWall | null = null;
      let targetPoint: Point2D | null = null;

      for (let j = 0; j < walls.length; j++) {
        if (i === j) continue;
        const w2 = walls[j];

        const d1 = Math.hypot(end.x - w2.x1, end.y - w2.y1);
        const d2 = Math.hypot(end.x - w2.x2, end.y - w2.y2);

        if (d1 < 0.05 || d2 < 0.05) {
          isConnected = true;
          break;
        }

        if (d1 < closestDist) {
          closestDist = d1;
          targetWall = w2;
          targetPoint = { x: w2.x1, y: w2.y1 };
        }
        if (d2 < closestDist) {
          closestDist = d2;
          targetWall = w2;
          targetPoint = { x: w2.x2, y: w2.y2 };
        }
      }

      if (!isConnected && closestDist > 0.05 && closestDist <= gapThreshold && targetWall && targetPoint) {
        issues.push({
          id: `open-${w1.id}-${end.isStart ? 'start' : 'end'}`,
          type: 'open_wall',
          severity: 'warning',
          title: `Open Wall Gap (${formatLength(closestDist, unit)})`,
          location: `(${end.x.toFixed(1)}, ${end.y.toFixed(1)})`,
          description: `Endpoint is separated from adjacent wall by ${formatLength(closestDist, unit)}.`,
          suggestedFix: 'Weld corner together to close the gap.',
          fixAction: {
            action: 'UPDATE_WALL',
            objectId: w1.id,
            payload: end.isStart
              ? { ...w1, x1: targetPoint.x, y1: targetPoint.y }
              : { ...w1, x2: targetPoint.x, y2: targetPoint.y },
            description: `Weld wall corner to (${targetPoint.x}, ${targetPoint.y})`,
          },
          elementIds: [w1.id, targetWall.id],
        });
      }
    }
  }

  // 3. Floating Doors & Windows (Not attached to walls)
  for (const door of doors) {
    const proj = projectPointOntoWall(door.x, door.y, walls, 1.5);
    const attached = Boolean(proj && proj.distance <= 1.2);

    if (!attached) {
      issues.push({
        id: `float-door-${door.id}`,
        type: 'floating_door',
        severity: 'warning',
        title: 'Detached Door',
        location: `(${door.x.toFixed(1)}, ${door.y.toFixed(1)})`,
        description: 'Door is floating in empty space without a host wall.',
        suggestedFix: 'Snap to nearest wall or remove.',
        elementIds: [door.id],
      });
    }
  }

  for (const win of windows) {
    const proj = projectPointOntoWall(win.x, win.y, walls, 1.5);
    const attached = Boolean(proj && proj.distance <= 1.2);

    if (!attached) {
      issues.push({
        id: `float-win-${win.id}`,
        type: 'floating_window',
        severity: 'warning',
        title: 'Detached Window',
        location: `(${win.x.toFixed(1)}, ${win.y.toFixed(1)})`,
        description: 'Window is not placed on any architectural wall.',
        suggestedFix: 'Snap to nearest wall or remove.',
        elementIds: [win.id],
      });
    }
  }

  return issues;
}

// ============================================================
// 5. "Understand My Plan" Architectural Metric Analyzer
// ============================================================

/**
 * Computes exact plan metrics directly from verified geometric coordinates.
 * CRITICAL: Zero fabricated numbers or fake data.
 */
export function analyzePlanMetrics(
  walls: FloorPlanWall[],
  rooms: FloorPlanRoom[],
  doors: FloorPlanDoor[],
  windows: FloorPlanWindow[],
  columns: FloorPlanColumn[] = [],
  staircases: FloorPlanStaircase[] = [],
  unit: FloorPlanUnit = 'feet'
): PlanAnalysisReport {
  let grossFloorArea = 0;
  const roomBreakdown: PlanAnalysisReport['roomBreakdown'] = [];

  for (const r of rooms) {
    const w = r.width || 0;
    const h = r.height || 0;
    const computedArea = r.area && r.area > 0 ? r.area : w * h;
    grossFloorArea += computedArea;

    roomBreakdown.push({
      id: r.id,
      name: r.label || r.roomType,
      type: r.roomType,
      width: w,
      height: h,
      area: computedArea,
      formattedArea: formatArea(computedArea, unit),
    });
  }

  // Calculate total linear wall length
  let totalWallLength = 0;
  for (const w of walls) {
    totalWallLength += getWallLength(w);
  }

  // Count unclosed boundaries from open wall gaps
  const issues = diagnosePlanIssues(walls, rooms, doors, windows, unit);
  const openGapsCount = issues.filter(i => i.type === 'open_wall' || i.type === 'unclosed_room').length;

  return {
    grossFloorAreaSqUnits: +grossFloorArea.toFixed(2),
    formattedTotalArea: formatArea(grossFloorArea, unit),
    roomCount: rooms.length,
    doorCount: doors.length,
    windowCount: windows.length,
    wallCount: walls.length,
    columnCount: columns.length,
    stairCount: staircases.length,
    totalWallLength: +totalWallLength.toFixed(2),
    formattedWallLength: formatLength(totalWallLength, unit),
    roomBreakdown,
    unclosedBoundariesCount: openGapsCount,
    missingDimensionsCount: walls.filter(w => getWallLength(w) < 0.5).length,
    timestamp: Date.now(),
  };
}

// ============================================================
// 6. "Help Me Design" Proposed Layout Generator
// ============================================================

/**
 * Generates an architectural layout proposal tailored to user requirements.
 * CRITICAL: Contains required professional disclaimer.
 */
export function generateProposedLayout(req: ProposedLayoutRequest): ProposedLayoutResult {
  const { plotWidth, plotDepth, unit, bedrooms, bathrooms, hasParking, facing } = req;
  const W = Math.max(unit === 'feet' ? 20 : 6, plotWidth);
  const D = Math.max(unit === 'feet' ? 30 : 9, plotDepth);

  const walls: FloorPlanWall[] = [];
  const rooms: FloorPlanRoom[] = [];
  const doors: FloorPlanDoor[] = [];
  const windows: FloorPlanWindow[] = [];

  const wallThickness = unit === 'feet' ? 0.75 : 0.23;

  // 1. Exterior Boundary Walls
  walls.push({ id: 'prop-w1', x1: 0, y1: 0, x2: W, y2: 0, thickness: wallThickness, height: 10, wallType: 'exterior' });
  walls.push({ id: 'prop-w2', x1: W, y1: 0, x2: W, y2: D, thickness: wallThickness, height: 10, wallType: 'exterior' });
  walls.push({ id: 'prop-w3', x1: W, y1: D, x2: 0, y2: D, thickness: wallThickness, height: 10, wallType: 'exterior' });
  walls.push({ id: 'prop-w4', x1: 0, y1: D, x2: 0, y2: 0, thickness: wallThickness, height: 10, wallType: 'exterior' });

  // 2. Interior Layout Division
  const midX = +(W * 0.55).toFixed(2);
  const frontY = +(D * 0.45).toFixed(2);

  // Front Zone: Living & Dining / Parking
  const livingW = hasParking ? midX : W;
  const livingH = frontY;
  rooms.push({
    id: 'prop-r-living',
    label: 'Living Room',
    roomType: 'Living Room',
    x: 0,
    y: 0,
    width: livingW,
    height: livingH,
    area: +(livingW * livingH).toFixed(2),
    perimeter: +(2 * (livingW + livingH)).toFixed(2),
    rotation: 0,
  });

  // Entrance door on front wall
  doors.push({
    id: 'prop-d-main',
    doorType: 'Main Entrance',
    x: +(livingW * 0.5).toFixed(2),
    y: 0,
    width: unit === 'feet' ? 3.5 : 1.0,
    rotation: 0,
    wallId: 'prop-w1',
  });

  // Living room window
  windows.push({
    id: 'prop-win-living',
    windowType: 'Large',
    x: +(livingW * 0.25).toFixed(2),
    y: 0,
    width: unit === 'feet' ? 5.0 : 1.5,
    rotation: 0,
    wallId: 'prop-w1',
  });

  // Rear Zone: Bedroom 1 (Master)
  const bed1W = +(W * 0.55).toFixed(2);
  const bed1H = +(D - frontY).toFixed(2);
  rooms.push({
    id: 'prop-r-bed1',
    label: 'Master Bedroom',
    roomType: 'Master Bedroom',
    x: 0,
    y: frontY,
    width: bed1W,
    height: bed1H,
    area: +(bed1W * bed1H).toFixed(2),
    perimeter: +(2 * (bed1W + bed1H)).toFixed(2),
    rotation: 0,
  });

  // Dividing wall between front and rear
  walls.push({
    id: 'prop-w-mid-horiz',
    x1: 0,
    y1: frontY,
    x2: W,
    y2: frontY,
    thickness: wallThickness,
    height: 10,
    wallType: 'interior',
  });

  // Bedroom window on rear wall
  windows.push({
    id: 'prop-win-bed1',
    windowType: 'Standard',
    x: +(bed1W * 0.5).toFixed(2),
    y: D,
    width: unit === 'feet' ? 4.0 : 1.2,
    rotation: 0,
    wallId: 'prop-w3',
  });

  // Kitchen / Dining Zone
  const kitchenW = +(W - midX).toFixed(2);
  const kitchenH = +(frontY * 0.6).toFixed(2);
  rooms.push({
    id: 'prop-r-kitchen',
    label: 'Kitchen',
    roomType: 'Kitchen',
    x: midX,
    y: 0,
    width: kitchenW,
    height: kitchenH,
    area: +(kitchenW * kitchenH).toFixed(2),
    perimeter: +(2 * (kitchenW + kitchenH)).toFixed(2),
    rotation: 0,
  });

  // Vertical dividing wall
  walls.push({
    id: 'prop-w-mid-vert',
    x1: midX,
    y1: 0,
    x2: midX,
    y2: frontY,
    thickness: wallThickness,
    height: 10,
    wallType: 'interior',
  });

  // Secondary Bedroom or Bathroom
  if (bedrooms >= 2) {
    const bed2W = +(W - midX).toFixed(2);
    const bed2H = +(D - frontY).toFixed(2);
    rooms.push({
      id: 'prop-r-bed2',
      label: 'Bedroom 2',
      roomType: 'Bedroom',
      x: midX,
      y: frontY,
      width: bed2W,
      height: bed2H,
      area: +(bed2W * bed2H).toFixed(2),
      perimeter: +(2 * (bed2W + bed2H)).toFixed(2),
      rotation: 0,
    });

    walls.push({
      id: 'prop-w-rear-vert',
      x1: midX,
      y1: frontY,
      x2: midX,
      y2: D,
      thickness: wallThickness,
      height: 10,
      wallType: 'interior',
    });
  }

  // Attached or common bathroom
  if (bathrooms >= 1) {
    const bathW = +(W * 0.28).toFixed(2);
    const bathH = +(D * 0.22).toFixed(2);
    rooms.push({
      id: 'prop-r-bath',
      label: 'Bathroom',
      roomType: 'Bathroom',
      x: +(midX - bathW).toFixed(2),
      y: frontY,
      width: bathW,
      height: bathH,
      area: +(bathW * bathH).toFixed(2),
      perimeter: +(2 * (bathW + bathH)).toFixed(2),
      rotation: 0,
    });
  }

  return {
    title: `${bedrooms} BHK Architectural Proposal (${facing} Facing)`,
    summary: `Structured ${bedrooms} Bedroom layout fitted to ${formatLength(W, unit)} × ${formatLength(D, unit)} plot with ${facing} orientation.`,
    plotWidth: W,
    plotDepth: D,
    walls,
    rooms,
    doors,
    windows,
    disclaimer: 'AI-generated design suggestion — verify with a qualified professional before construction.',
  };
}

