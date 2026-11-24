import type { FloorPlanWall, FloorPlanUnit } from '../db/types';
import { planUnitsToMm, mmToPlanUnits, getWallLength, getWallAngleDeg } from './geometryEngine';

export interface ParallelGuideResult {
  sourceWall: FloorPlanWall;
  isVertical: boolean;
  isHorizontal: boolean;
  isAngled: boolean;
  distancePlanUnits: number;
  distanceMm: number;
  formattedDistance: string;
  guideStart: { x: number; y: number }; // Perpendicular start point on existing wall (world coordinates)
  guideEnd: { x: number; y: number };   // Perpendicular end point on new/moving wall (world coordinates)
  guideMid: { x: number; y: number };   // Midpoint for dimension label badge
  isSnapped: boolean;
  snappedMm?: number;
  snappedWallEnd?: { x: number; y: number };
  angleDeg: number;
}

// Common architectural and construction parallel offset presets in mm
export const COMMON_PARALLEL_OFFSETS_MM = [
  19,   // 3/4" / 19mm standard ply/furring/gap
  25,   // 1" spacer
  50,   // 2" stud/batten
  75,   // 3" partition
  100,  // 4" brick partition
  115,  // 4.5" half-brick wall
  150,  // 6" block wall
  200,  // 8" solid wall
  230,  // 9" standard main wall
  300,  // 12" thick wall / foundation
];

/**
 * Checks if two angles (in degrees 0..360) represent parallel lines.
 * Lines are parallel if angle difference is close to 0° or 180°.
 */
export function areAnglesParallel(ang1: number, ang2: number, toleranceDeg: number = 3.5): boolean {
  const norm1 = ((ang1 % 180) + 180) % 180;
  const norm2 = ((ang2 % 180) + 180) % 180;
  const diff = Math.abs(norm1 - norm2);
  return diff <= toleranceDeg || Math.abs(diff - 180) <= toleranceDeg;
}

/**
 * Finds the nearest parallel wall to the wall currently being drawn or adjusted,
 * calculates the perpendicular distance in mm, and determines if it snaps to a
 * standard or target distance (such as 19 mm).
 */
export function findParallelWallGuide(
  start: { x: number; y: number },
  currentEnd: { x: number; y: number },
  walls: FloorPlanWall[],
  unit: FloorPlanUnit,
  options?: {
    snapToleranceMm?: number;
    targetDistanceMm?: number;
    excludeWallId?: string;
    maxDistanceMm?: number;
  }
): ParallelGuideResult | null {
  const dx = currentEnd.x - start.x;
  const dy = currentEnd.y - start.y;
  const currentLen = Math.hypot(dx, dy);

  // Require a minimal stroke length so orientation is well-defined
  if (currentLen < 0.15) return null;

  const currentAngle = getWallAngleDeg({ x1: start.x, y1: start.y, x2: currentEnd.x, y2: currentEnd.y } as FloorPlanWall);
  const normCurrent = ((currentAngle % 180) + 180) % 180;

  const isVertical = Math.abs(normCurrent - 90) <= 4.0;
  const isHorizontal = normCurrent <= 4.0 || Math.abs(normCurrent - 180) <= 4.0;
  const isAngled = !isVertical && !isHorizontal;

  const snapTolMm = options?.snapToleranceMm ?? 6.0;
  const maxDistMm = options?.maxDistanceMm ?? 6000; // Look within 6 meters (20 ft)

  let bestResult: ParallelGuideResult | null = null;
  let minPerpDistPlan = Infinity;

  for (const w of walls) {
    if (options?.excludeWallId && w.id === options.excludeWallId) continue;
    const wLen = getWallLength(w);
    if (wLen < 0.2) continue;

    const wAngle = getWallAngleDeg(w);

    if (!areAnglesParallel(currentAngle, wAngle, 4.0)) continue;

    // ── Case 1: Vertical Parallel Walls ─────────────────────────────────
    if (isVertical) {
      const avgXCurrent = (start.x + currentEnd.x) / 2;
      const avgXWall = (w.x1 + w.x2) / 2;
      const perpDistPlan = Math.abs(avgXCurrent - avgXWall);
      const perpDistMm = planUnitsToMm(perpDistPlan, unit);

      if (perpDistMm < 1 || perpDistMm > maxDistMm) continue;

      // Determine perpendicular guide line Y position:
      // Try to anchor guide where the two vertical walls overlap along Y
      const currMinY = Math.min(start.y, currentEnd.y);
      const currMaxY = Math.max(start.y, currentEnd.y);
      const wallMinY = Math.min(w.y1, w.y2);
      const wallMaxY = Math.max(w.y1, w.y2);

      const overlapStart = Math.max(currMinY, wallMinY);
      const overlapEnd = Math.min(currMaxY, wallMaxY);

      let guideY: number;
      if (overlapStart <= overlapEnd) {
        guideY = (overlapStart + overlapEnd) / 2;
      } else {
        // Clamped midpoint if not directly overlapping
        const midY = (start.y + currentEnd.y) / 2;
        guideY = Math.max(wallMinY, Math.min(wallMaxY, midY));
      }

      if (perpDistPlan < minPerpDistPlan) {
        minPerpDistPlan = perpDistPlan;

        // Check snapping to target or common mm
        let isSnapped = false;
        let snappedMm: number | undefined;
        let snappedEnd: { x: number; y: number } | undefined;

        const candidateTargets = options?.targetDistanceMm
          ? [options.targetDistanceMm, ...COMMON_PARALLEL_OFFSETS_MM]
          : COMMON_PARALLEL_OFFSETS_MM;

        for (const target of candidateTargets) {
          if (Math.abs(perpDistMm - target) <= snapTolMm) {
            isSnapped = true;
            snappedMm = target;
            const targetPlanDist = mmToPlanUnits(target, unit);
            const sign = avgXCurrent >= avgXWall ? 1 : -1;
            const snappedX = avgXWall + sign * targetPlanDist;
            snappedEnd = { x: snappedX, y: currentEnd.y };
            break;
          }
        }

        const effectiveMm = isSnapped && snappedMm ? snappedMm : Math.round(perpDistMm * 10) / 10;
        const gStartX = avgXWall;
        const gEndX = isSnapped && snappedEnd ? snappedEnd.x : avgXCurrent;

        bestResult = {
          sourceWall: w,
          isVertical: true,
          isHorizontal: false,
          isAngled: false,
          distancePlanUnits: perpDistPlan,
          distanceMm: effectiveMm,
          formattedDistance: effectiveMm % 1 === 0 ? `${effectiveMm} mm` : `${effectiveMm.toFixed(1)} mm`,
          guideStart: { x: gStartX, y: guideY },
          guideEnd: { x: gEndX, y: guideY },
          guideMid: { x: (gStartX + gEndX) / 2, y: guideY },
          isSnapped,
          snappedMm,
          snappedWallEnd: snappedEnd,
          angleDeg: 90,
        };
      }
    }
    // ── Case 2: Horizontal Parallel Walls ───────────────────────────────
    else if (isHorizontal) {
      const avgYCurrent = (start.y + currentEnd.y) / 2;
      const avgYWall = (w.y1 + w.y2) / 2;
      const perpDistPlan = Math.abs(avgYCurrent - avgYWall);
      const perpDistMm = planUnitsToMm(perpDistPlan, unit);

      if (perpDistMm < 1 || perpDistMm > maxDistMm) continue;

      const currMinX = Math.min(start.x, currentEnd.x);
      const currMaxX = Math.max(start.x, currentEnd.x);
      const wallMinX = Math.min(w.x1, w.x2);
      const wallMaxX = Math.max(w.x1, w.x2);

      const overlapStart = Math.max(currMinX, wallMinX);
      const overlapEnd = Math.min(currMaxX, wallMaxX);

      let guideX: number;
      if (overlapStart <= overlapEnd) {
        guideX = (overlapStart + overlapEnd) / 2;
      } else {
        const midX = (start.x + currentEnd.x) / 2;
        guideX = Math.max(wallMinX, Math.min(wallMaxX, midX));
      }

      if (perpDistPlan < minPerpDistPlan) {
        minPerpDistPlan = perpDistPlan;

        let isSnapped = false;
        let snappedMm: number | undefined;
        let snappedEnd: { x: number; y: number } | undefined;

        const candidateTargets = options?.targetDistanceMm
          ? [options.targetDistanceMm, ...COMMON_PARALLEL_OFFSETS_MM]
          : COMMON_PARALLEL_OFFSETS_MM;

        for (const target of candidateTargets) {
          if (Math.abs(perpDistMm - target) <= snapTolMm) {
            isSnapped = true;
            snappedMm = target;
            const targetPlanDist = mmToPlanUnits(target, unit);
            const sign = avgYCurrent >= avgYWall ? 1 : -1;
            const snappedY = avgYWall + sign * targetPlanDist;
            snappedEnd = { x: currentEnd.x, y: snappedY };
            break;
          }
        }

        const effectiveMm = isSnapped && snappedMm ? snappedMm : Math.round(perpDistMm * 10) / 10;
        const gStartY = avgYWall;
        const gEndY = isSnapped && snappedEnd ? snappedEnd.y : avgYCurrent;

        bestResult = {
          sourceWall: w,
          isVertical: false,
          isHorizontal: true,
          isAngled: false,
          distancePlanUnits: perpDistPlan,
          distanceMm: effectiveMm,
          formattedDistance: effectiveMm % 1 === 0 ? `${effectiveMm} mm` : `${effectiveMm.toFixed(1)} mm`,
          guideStart: { x: guideX, y: gStartY },
          guideEnd: { x: guideX, y: gEndY },
          guideMid: { x: guideX, y: (gStartY + gEndY) / 2 },
          isSnapped,
          snappedMm,
          snappedWallEnd: snappedEnd,
          angleDeg: 0,
        };
      }
    }
    // ── Case 3: Angled Parallel Walls ───────────────────────────────────
    else {
      const wDx = w.x2 - w.x1;
      const wDy = w.y2 - w.y1;
      const uWx = wDx / wLen;
      const uWy = wDy / wLen;
      // Normal vector to wall
      const nWx = -uWy;
      const nWy = uWx;

      const currMidX = (start.x + currentEnd.x) / 2;
      const currMidY = (start.y + currentEnd.y) / 2;

      // Distance from currMid to wall line: dot product with normal
      const perpDistPlan = Math.abs(nWx * (currMidX - w.x1) + nWy * (currMidY - w.y1));
      const perpDistMm = planUnitsToMm(perpDistPlan, unit);

      if (perpDistMm < 1 || perpDistMm > maxDistMm) continue;

      if (perpDistPlan < minPerpDistPlan) {
        minPerpDistPlan = perpDistPlan;

        // Project currMid onto source wall line
        const signedDist = nWx * (currMidX - w.x1) + nWy * (currMidY - w.y1);
        const projX = currMidX - nWx * signedDist;
        const projY = currMidY - nWy * signedDist;

        let isSnapped = false;
        let snappedMm: number | undefined;

        const candidateTargets = options?.targetDistanceMm
          ? [options.targetDistanceMm, ...COMMON_PARALLEL_OFFSETS_MM]
          : COMMON_PARALLEL_OFFSETS_MM;

        for (const target of candidateTargets) {
          if (Math.abs(perpDistMm - target) <= snapTolMm) {
            isSnapped = true;
            snappedMm = target;
            break;
          }
        }

        const effectiveMm = isSnapped && snappedMm ? snappedMm : Math.round(perpDistMm * 10) / 10;

        bestResult = {
          sourceWall: w,
          isVertical: false,
          isHorizontal: false,
          isAngled: true,
          distancePlanUnits: perpDistPlan,
          distanceMm: effectiveMm,
          formattedDistance: effectiveMm % 1 === 0 ? `${effectiveMm} mm` : `${effectiveMm.toFixed(1)} mm`,
          guideStart: { x: projX, y: projY },
          guideEnd: { x: currMidX, y: currMidY },
          guideMid: { x: (projX + currMidX) / 2, y: (projY + currMidY) / 2 },
          isSnapped,
          snappedMm,
          angleDeg: currentAngle,
        };
      }
    }
  }

  return bestResult;
}

/**
 * Adjusts the current wall coordinate so that it is positioned at an exact
 * perpendicular distance (in mm) from the parallel source wall.
 * Does not alter the wall length or orientation.
 */
export function adjustWallToExactParallelDistance(
  start: { x: number; y: number },
  currentEnd: { x: number; y: number },
  sourceWall: FloorPlanWall,
  exactDistanceMm: number,
  unit: FloorPlanUnit
): { start: { x: number; y: number }; end: { x: number; y: number } } {
  const targetDistPlan = mmToPlanUnits(exactDistanceMm, unit);
  const wAngle = getWallAngleDeg(sourceWall);
  const normW = ((wAngle % 180) + 180) % 180;

  const isVertical = Math.abs(normW - 90) <= 4.0;
  const isHorizontal = normW <= 4.0 || Math.abs(normW - 180) <= 4.0;

  if (isVertical) {
    const avgXWall = (sourceWall.x1 + sourceWall.x2) / 2;
    const avgXCurr = (start.x + currentEnd.x) / 2;
    const sign = avgXCurr >= avgXWall ? 1 : -1;
    const targetX = avgXWall + sign * targetDistPlan;
    const shiftX = targetX - avgXCurr;
    return {
      start: { x: start.x + shiftX, y: start.y },
      end: { x: currentEnd.x + shiftX, y: currentEnd.y },
    };
  }

  if (isHorizontal) {
    const avgYWall = (sourceWall.y1 + sourceWall.y2) / 2;
    const avgYCurr = (start.y + currentEnd.y) / 2;
    const sign = avgYCurr >= avgYWall ? 1 : -1;
    const targetY = avgYWall + sign * targetDistPlan;
    const shiftY = targetY - avgYCurr;
    return {
      start: { x: start.x, y: start.y + shiftY },
      end: { x: currentEnd.x, y: currentEnd.y + shiftY },
    };
  }

  // Angled wall
  const wLen = getWallLength(sourceWall);
  const wDx = (sourceWall.x2 - sourceWall.x1) / wLen;
  const wDy = (sourceWall.y2 - sourceWall.y1) / wLen;
  const nX = -wDy;
  const nY = wDx;

  const currMidX = (start.x + currentEnd.x) / 2;
  const currMidY = (start.y + currentEnd.y) / 2;

  const currentSignedDist = nX * (currMidX - sourceWall.x1) + nY * (currMidY - sourceWall.y1);
  const sign = currentSignedDist >= 0 ? 1 : -1;
  const targetSignedDist = sign * targetDistPlan;
  const shiftDist = targetSignedDist - currentSignedDist;

  const shiftX = nX * shiftDist;
  const shiftY = nY * shiftDist;

  return {
    start: { x: start.x + shiftX, y: start.y + shiftY },
    end: { x: currentEnd.x + shiftX, y: currentEnd.y + shiftY },
  };
}

