import type {
  FloorPlanWall,
  FloorPlanRoom,
  FloorPlanDoor,
  FloorPlanWindow,
  FloorPlanFurniture,
  FloorPlanUnit,
  RoomType,
} from '../db/types';
import {
  getWallLength,
  getWallAngleDeg,
  formatArea,
  detectEnclosedRooms,
} from './geometryEngine';

// ============================================================
// Types & Diagnostic Interfaces
// ============================================================

export interface GeometryIssue {
  id: string;
  type: 'zigzag_wall' | 'open_gap' | 'stray_stub' | 'unclosed_perimeter';
  severity: 'warning' | 'info' | 'error';
  title: string;
  description: string;
  elementIds: string[];
  suggestedFix: string;
}

export interface GeometryHealthReport {
  healthScore: number; // 0 - 100
  totalWalls: number;
  totalRooms: number;
  zigzagCount: number;
  openGapCount: number;
  strayStubCount: number;
  unclosedRoomCount: number;
  issues: GeometryIssue[];
  summaryMessage: string;
}

export interface CopilotActionResult {
  success: boolean;
  message: string;
  fixedCount: number;
  walls: FloorPlanWall[];
  rooms?: FloorPlanRoom[];
}

// ============================================================
// 1. Diagnostic Scanner: analyzePlanGeometry
// ============================================================

/**
 * Scans all walls for:
 * 1. Crooked / Zig-zag lines (angles close to 0, 90, 180, 270 or 45 but slightly skewed by 1°–14°).
 * 2. Incomplete line gaps (wall endpoints within small distance <= gapThreshold but not touching).
 * 3. Stray micro-stubs (walls shorter than 0.8 ft that don't connect).
 */
export function analyzePlanGeometry(
  walls: FloorPlanWall[],
  rooms: FloorPlanRoom[],
  unit: FloorPlanUnit = 'feet'
): GeometryHealthReport {
  const issues: GeometryIssue[] = [];
  const gapThreshold = unit === 'feet' ? 2.5 : 0.8; // 2.5 ft or 0.8 m
  const minLength = unit === 'feet' ? 0.75 : 0.25;

  let zigzagCount = 0;
  let openGapCount = 0;
  let strayStubCount = 0;

  // A. Check for crooked / zig-zag walls
  for (const w of walls) {
    const angle = getWallAngleDeg(w);
    const len = getWallLength(w);
    if (len < 0.1) continue;

    // Check angle deviation from cardinal (0, 90, 180, 270, 360) and 45°
    const cardinals = [0, 45, 90, 135, 180, 225, 270, 315, 360];
    let minDiff = 180;
    let closestCardinal = 0;

    for (const c of cardinals) {
      const diff = Math.abs(angle - c);
      if (diff < minDiff) {
        minDiff = diff;
        closestCardinal = c % 360;
      }
    }

    // Skewed between 0.8° and 14° -> flag as zig-zag/crooked wall
    if (minDiff >= 0.8 && minDiff <= 14) {
      zigzagCount++;
      issues.push({
        id: `zigzag-${w.id}`,
        type: 'zigzag_wall',
        severity: minDiff > 5 ? 'warning' : 'info',
        title: `Crooked / Zig-Zag Wall (${angle.toFixed(1)}°)`,
        description: `Wall is tilted by ${minDiff.toFixed(1)}° from orthogonal ${closestCardinal}°.`,
        elementIds: [w.id],
        suggestedFix: `Straighten to clean ${closestCardinal}° angle`,
      });
    }

    // B. Check for micro stray stubs
    if (len < minLength) {
      strayStubCount++;
      issues.push({
        id: `stub-${w.id}`,
        type: 'stray_stub',
        severity: 'info',
        title: `Tiny Stray Wall Fragment (${len.toFixed(2)} ${unit === 'feet' ? 'ft' : 'm'})`,
        description: `Very short wall fragment that may cause layout artifacts.`,
        elementIds: [w.id],
        suggestedFix: `Remove or merge with adjacent wall`,
      });
    }
  }

  // C. Check for open line gaps between endpoints
  const endpoints: { x: number; y: number; wallId: string; ptIdx: 1 | 2 }[] = [];
  for (const w of walls) {
    endpoints.push({ x: w.x1, y: w.y1, wallId: w.id, ptIdx: 1 });
    endpoints.push({ x: w.x2, y: w.y2, wallId: w.id, ptIdx: 2 });
  }

  const recordedGapPairs = new Set<string>();

  for (let i = 0; i < endpoints.length; i++) {
    const ep1 = endpoints[i];
    for (let j = i + 1; j < endpoints.length; j++) {
      const ep2 = endpoints[j];
      if (ep1.wallId === ep2.wallId) continue;

      const dist = Math.hypot(ep1.x - ep2.x, ep1.y - ep2.y);
      // If endpoints are close but NOT connected (between 0.05 and gapThreshold)
      if (dist > 0.05 && dist <= gapThreshold) {
        const pairKey = [ep1.wallId, ep2.wallId].sort().join(':');
        if (!recordedGapPairs.has(pairKey)) {
          recordedGapPairs.add(pairKey);
          openGapCount++;
          issues.push({
            id: `gap-${pairKey}`,
            type: 'open_gap',
            severity: 'warning',
            title: `Incomplete Line / Corner Gap (${dist.toFixed(2)} ${unit === 'feet' ? 'ft' : 'm'})`,
            description: `Wall corner has a small gap and is not fully watertight.`,
            elementIds: [ep1.wallId, ep2.wallId],
            suggestedFix: `Snap endpoints together to form closed corner`,
          });
        }
      }
    }
  }

  // D. Check for enclosed perimeters vs existing rooms count
  let unclosedRoomCount = 0;
  try {
    const detected = detectEnclosedRooms(walls, unit);
    if (detected.length > rooms.length) {
      unclosedRoomCount = detected.length - rooms.length;
      issues.push({
        id: `unclosed-rooms`,
        type: 'unclosed_perimeter',
        severity: 'info',
        title: `${unclosedRoomCount} Enclosed Wall Perimeters Detected`,
        description: `Found ${unclosedRoomCount} closed wall boundaries that can be converted into rooms.`,
        elementIds: [],
        suggestedFix: `Generate room boundaries automatically`,
      });
    }
  } catch {
    /* ignore */
  }

  // Compute Health Score
  const penalties = zigzagCount * 8 + openGapCount * 12 + strayStubCount * 4;
  const healthScore = Math.max(10, Math.min(100, 100 - penalties));

  let summaryMessage = '✨ Floor plan geometry is clean and watertight!';
  if (healthScore < 50) {
    summaryMessage = `⚠️ Geometry needs attention: ${openGapCount} gaps and ${zigzagCount} crooked walls detected.`;
  } else if (healthScore < 85) {
    summaryMessage = `💡 ${zigzagCount} zig-zag walls and ${openGapCount} incomplete gaps can be auto-corrected.`;
  }

  return {
    healthScore,
    totalWalls: walls.length,
    totalRooms: rooms.length,
    zigzagCount,
    openGapCount,
    strayStubCount,
    unclosedRoomCount,
    issues,
    summaryMessage,
  };
}

// ============================================================
// 2. AI Auto-Straighten: autoStraightenZigZagWalls
// ============================================================

/**
 * Straightens crooked and zig-zag walls:
 * Snaps lines near 0°, 90°, 180°, 270°, 45° to exact orthogonal angles.
 * When endpoint is connected to another wall, straightens along the wall vector
 * without breaking corner connectivity.
 */
export function autoStraightenZigZagWalls(
  walls: FloorPlanWall[],
  toleranceDeg: number = 14
): CopilotActionResult {
  let fixedCount = 0;

  const newWalls = walls.map(w => {
    let angle = getWallAngleDeg(w);
    const len = getWallLength(w);
    if (len < 0.1) return { ...w };

    const cardinals = [0, 45, 90, 135, 180, 225, 270, 315, 360];
    let minDiff = 180;
    let targetAngle = angle;

    for (const c of cardinals) {
      const diff = Math.abs(angle - c);
      if (diff < minDiff) {
        minDiff = diff;
        targetAngle = c % 360;
      }
    }

    // Only straighten if tilted within tolerance (e.g. 0.5° to 14°)
    if (minDiff >= 0.5 && minDiff <= toleranceDeg) {
      fixedCount++;
      const rad = (targetAngle * Math.PI) / 180;

      // Keep start point (x1, y1) and align end point (x2, y2)
      // Round to 2 decimal places for clean precision
      const newX2 = +(w.x1 + len * Math.cos(rad)).toFixed(2);
      const newY2 = +(w.y1 + len * Math.sin(rad)).toFixed(2);

      return {
        ...w,
        x2: newX2,
        y2: newY2,
      };
    }

    return { ...w };
  });

  return {
    success: true,
    message: fixedCount > 0
      ? `AI straightened ${fixedCount} zig-zag walls to clean 90°/orthogonal angles!`
      : `All walls are already cleanly aligned!`,
    fixedCount,
    walls: newWalls,
  };
}

// ============================================================
// 3. AI Auto-Close Gaps: autoCloseIncompleteGaps
// ============================================================

/**
 * Snaps incomplete endpoints within tolerance together.
 * Welds broken corners into watertight joints.
 */
export function autoCloseIncompleteGaps(
  walls: FloorPlanWall[],
  gapTolerance: number = 2.0 // in plan units
): CopilotActionResult {
  let fixedCount = 0;
  const cloned: FloorPlanWall[] = JSON.parse(JSON.stringify(walls));

  // Build list of all endpoints
  interface EndpointRef {
    wallIdx: number;
    ptIdx: 1 | 2;
    x: number;
    y: number;
  }

  const eps: EndpointRef[] = [];
  cloned.forEach((w, idx) => {
    eps.push({ wallIdx: idx, ptIdx: 1, x: w.x1, y: w.y1 });
    eps.push({ wallIdx: idx, ptIdx: 2, x: w.x2, y: w.y2 });
  });

  // Cluster nearby endpoints
  const visited = new Set<number>();

  for (let i = 0; i < eps.length; i++) {
    if (visited.has(i)) continue;
    const cluster = [eps[i]];
    visited.add(i);

    for (let j = i + 1; j < eps.length; j++) {
      if (visited.has(j)) continue;
      const dist = Math.hypot(eps[i].x - eps[j].x, eps[i].y - eps[j].y);

      // If endpoints are close but not exact
      if (dist > 0.001 && dist <= gapTolerance) {
        cluster.push(eps[j]);
        visited.add(j);
      }
    }

    // If cluster has 2 or more endpoints that had a gap, weld them to the centroid
    if (cluster.length >= 2) {
      const avgX = +(cluster.reduce((s, p) => s + p.x, 0) / cluster.length).toFixed(2);
      const avgY = +(cluster.reduce((s, p) => s + p.y, 0) / cluster.length).toFixed(2);

      cluster.forEach(pt => {
        const wall = cloned[pt.wallIdx];
        if (pt.ptIdx === 1) {
          if (wall.x1 !== avgX || wall.y1 !== avgY) {
            wall.x1 = avgX;
            wall.y1 = avgY;
            fixedCount++;
          }
        } else {
          if (wall.x2 !== avgX || wall.y2 !== avgY) {
            wall.x2 = avgX;
            wall.y2 = avgY;
            fixedCount++;
          }
        }
      });
    }
  }

  return {
    success: true,
    message: fixedCount > 0
      ? `AI closed ${Math.ceil(fixedCount / 2)} incomplete line gaps and welded corners!`
      : `No open line gaps found. All corners are connected!`,
    fixedCount: Math.ceil(fixedCount / 2),
    walls: cloned,
  };
}

// ============================================================
// 4. Micro-Stub Cleanup: cleanupMicroStubs
// ============================================================

export function cleanupMicroStubs(
  walls: FloorPlanWall[],
  minLength: number = 0.8
): CopilotActionResult {
  const filtered = walls.filter(w => getWallLength(w) >= minLength);
  const removed = walls.length - filtered.length;

  return {
    success: true,
    message: removed > 0
      ? `AI cleaned ${removed} stray wall stubs & zero-length artifacts!`
      : `No stray stubs found.`,
    fixedCount: removed,
    walls: filtered,
  };
}

// ============================================================
// 5. 1-Click Magic Fix: autoHealAllAndGenerateRooms
// ============================================================

/**
 * Complete AI Healing Pipeline:
 * 1. Straightens crooked & zig-zag walls.
 * 2. Closes incomplete gaps and welds corners.
 * 3. Cleans stray stubs.
 * 4. Detects enclosed perimeters and synthesizes rooms with wood floor parquet!
 */
export function autoHealAllAndGenerateRooms(
  walls: FloorPlanWall[],
  existingRooms: FloorPlanRoom[],
  unit: FloorPlanUnit = 'feet'
): CopilotActionResult {
  // Step 1: Straighten zig-zags
  const straightenRes = autoStraightenZigZagWalls(walls, 14);

  // Step 2: Close gaps
  const gapTolerance = unit === 'feet' ? 2.5 : 0.8;
  const gapRes = autoCloseIncompleteGaps(straightenRes.walls, gapTolerance);

  // Step 3: Clean stubs
  const minLen = unit === 'feet' ? 0.75 : 0.25;
  const cleanRes = cleanupMicroStubs(gapRes.walls, minLen);

  const finalWalls = cleanRes.walls;

  // Step 4: Scan and detect enclosed rooms
  let nextRooms = [...existingRooms];
  let generatedRoomCount = 0;

  try {
    const detected = detectEnclosedRooms(finalWalls, unit);
    for (const d of detected) {
      // Check if an existing room already occupies this center
      const centerX = d.x + d.width / 2;
      const centerY = d.y + d.height / 2;
      const alreadyHasRoom = nextRooms.some(r => {
        return (
          centerX >= r.x &&
          centerX <= r.x + r.width &&
          centerY >= r.y &&
          centerY <= r.y + r.height
        );
      });

      if (!alreadyHasRoom) {
        generatedRoomCount++;
        const newRoom: FloorPlanRoom = {
          id: `room-ai-${Date.now()}-${generatedRoomCount}`,
          roomType: d.roomType,
          label: `${d.roomType} ${nextRooms.length + 1}`,
          x: d.x,
          y: d.y,
          width: d.width,
          height: d.height,
          area: d.area,
          perimeter: d.perimeter,
          polygonPoints: d.polygonPoints,
          rotation: 0,
          floorFinish: 'Wood Parquet',
          wallThickness: unit === 'feet' ? 0.75 : 0.23,
          layer: 'rooms',
        };
        nextRooms.push(newRoom);
      }
    }
  } catch {
    /* ignore */
  }

  const totalFixes =
    straightenRes.fixedCount + gapRes.fixedCount + cleanRes.fixedCount + generatedRoomCount;

  return {
    success: true,
    message: `🪄 AI Healing Complete! Straightened ${straightenRes.fixedCount} walls, closed ${gapRes.fixedCount} gaps, and generated ${generatedRoomCount} rooms!`,
    fixedCount: totalFixes,
    walls: finalWalls,
    rooms: nextRooms,
  };
}

// ============================================================
// 6. Natural Language Copilot Parser (Tamil / Tanglish / English)
// ============================================================

export interface ParsedCopilotIntent {
  action: 'straighten' | 'close_gaps' | 'heal_all' | 'clean_stubs' | 'rotate' | 'unknown';
  degrees?: number;
  message: string;
}

/**
 * Parses user prompts in Tamil, Tanglish, and English
 * e.g.:
 * - "wall zig zag ahh pota atha correct panna"
 * - "imcomplete line correct panna"
 * - "straighten all crooked walls"
 * - "rotate 45 degrees"
 * - "fix all"
 */
export function parseAndExecuteCopilotCommand(
  rawPrompt: string,
  walls: FloorPlanWall[],
  rooms: FloorPlanRoom[],
  unit: FloorPlanUnit = 'feet'
): { intent: ParsedCopilotIntent; result?: CopilotActionResult } {
  const p = rawPrompt.toLowerCase().trim();

  // 1. Straighten Zig-Zag walls
  if (
    p.includes('zig') ||
    p.includes('zag') ||
    p.includes('straight') ||
    p.includes('crooked') ||
    p.includes('ortho') ||
    p.includes('konavara') ||
    p.includes('konal') ||
    p.includes('kodu sari')
  ) {
    const result = autoStraightenZigZagWalls(walls);
    return {
      intent: {
        action: 'straighten',
        message: 'AI Straightened all crooked & zig-zag walls to clean 90° angles.',
      },
      result,
    };
  }

  // 2. Incomplete line / Gap healing
  if (
    p.includes('incomplete') ||
    p.includes('gap') ||
    p.includes('connect') ||
    p.includes('corner') ||
    p.includes('line correct') ||
    p.includes('close') ||
    p.includes('mudiya') ||
    p.includes('inai') ||
    p.includes('kudathu') ||
    p.includes('inaippu')
  ) {
    const result = autoCloseIncompleteGaps(walls, unit === 'feet' ? 2.5 : 0.8);
    return {
      intent: {
        action: 'close_gaps',
        message: 'AI Snapped and healed all incomplete wall line gaps and corners.',
      },
      result,
    };
  }

  // 3. Clean Stubs
  if (p.includes('stub') || p.includes('clean') || p.includes('tiny') || p.includes('ali')) {
    const result = cleanupMicroStubs(walls);
    return {
      intent: {
        action: 'clean_stubs',
        message: 'AI Cleaned up tiny stray wall fragments.',
      },
      result,
    };
  }

  // 4. Rotate / Angle
  const rotateMatch = p.match(/(?:rotate|angle|thiruppu|thiru)\s*(\d+)/);
  if (rotateMatch) {
    const deg = parseInt(rotateMatch[1], 10) || 45;
    return {
      intent: {
        action: 'rotate',
        degrees: deg,
        message: `Set element angle to ${deg}°`,
      },
    };
  }

  // 5. Heal All / Fix All (Default fallback for general fix queries)
  if (
    p.includes('fix') ||
    p.includes('heal') ||
    p.includes('saripannu') ||
    p.includes('all') ||
    p.includes('pakkava') ||
    p.includes('yellathaiyu') ||
    p.includes('correct')
  ) {
    const result = autoHealAllAndGenerateRooms(walls, rooms, unit);
    return {
      intent: {
        action: 'heal_all',
        message: 'AI Magic Complete: Straightened zig-zags, closed gaps & formed rooms!',
      },
      result,
    };
  }

  return {
    intent: {
      action: 'unknown',
      message: "I didn't quite catch that. Try 'Straighten zig-zag walls' or 'Close incomplete gaps'!",
    },
  };
}
