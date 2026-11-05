/**
 * Freehand wall sketching: a rough stroke becomes connected straight walls.
 * Stroke simplification, angle snapping, joining to existing geometry, room closure and
 * duplicate prevention. Pure logic, no browser.
 */
import {
  DEFAULT_SNAP_ANGLES, ORTHO_SNAP_ANGLES, describeSketch, directionDeg, interpretStroke, simplifyStroke, snapDirection,
  subtractCoveredSpans, trimNewWall, wallCrossings, type SketchOptions,
} from '../src/domain/planSketch';
import { findWallFaces, joinTolerance, minimumRoomArea, wallLengthOf, type Pt } from '../src/domain/planGeometry';
import { emptyFloorState, normaliseFloor } from '../src/domain/planDocument';
import { findSnapPoint } from '../src/services/geometryEngine';
import type { FloorPlanWall } from '../src/db/types';

let passed = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (!cond) throw new Error(`FAILED: ${name}${detail !== undefined ? ' — got ' + JSON.stringify(detail) : ''}`);
  passed += 1;
  console.log(`  ✓ ${name}`);
}
const eq = (name: string, actual: unknown, expected: unknown) =>
  check(`${name} (${JSON.stringify(expected)})`, JSON.stringify(actual) === JSON.stringify(expected), actual);
const near = (name: string, actual: number, expected: number, eps = 1e-6) =>
  check(`${name} (${expected})`, Math.abs(actual - expected) <= eps, actual);

const wall = (id: string, x1: number, y1: number, x2: number, y2: number, thickness = 0.75): FloorPlanWall => ({ id, x1, y1, x2, y2, thickness, wallType: 'exterior' });

// A repeatable "shaky finger": the same noise every run.
let seed = 12345;
const rand = () => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff - 0.5;
};
/** A hand-drawn path through the given corners: many points, each off by up to `shake`. */
function stroke(corners: Pt[], shake = 0.25, step = 0.35): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i + 1 < corners.length; i++) {
    const a = corners[i], b = corners[i + 1];
    const steps = Math.max(2, Math.round(Math.hypot(b.x - a.x, b.y - a.y) / step));
    for (let s = i === 0 ? 0 : 1; s <= steps; s++) {
      const t = s / steps;
      out.push({ x: a.x + (b.x - a.x) * t + rand() * 2 * shake, y: a.y + (b.y - a.y) * t + rand() * 2 * shake });
    }
  }
  return out;
}

let idSeq = 0;
const opts = (extra: Partial<SketchOptions> = {}): SketchOptions => ({
  unit: 'feet', thickness: 0.75, newId: () => `sk-${++idSeq}`, grid: 0.5, ...extra,
});
const ends = (w: FloorPlanWall) => [[w.x1, w.y1], [w.x2, w.y2]];
const isHorizontal = (w: FloorPlanWall) => w.y1 === w.y2;
const isVertical = (w: FloorPlanWall) => w.x1 === w.x2;

console.log('\n--- 1. Stroke simplification ---');
const noisyLine = stroke([{ x: 0, y: 0 }, { x: 20, y: 0 }], 0.2);
check('A shaky stroke has many points', noisyLine.length > 40, noisyLine.length);
eq('A shaky straight stroke is two points', simplifyStroke(noisyLine, 0.7).length, 2);
const noisyL = stroke([{ x: 0, y: 0 }, { x: 15, y: 0 }, { x: 15, y: 12 }], 0.2);
const simpleL = simplifyStroke(noisyL, 0.7);
eq('A shaky L is three points', simpleL.length, 3);
check('The kept corner is where the stroke turned', Math.hypot(simpleL[1].x - 15, simpleL[1].y) < 0.8, simpleL[1]);
eq('Simplifying keeps the first and last point', [simpleL[0], simpleL[2]], [noisyL[0], noisyL[noisyL.length - 1]]);
eq('Two points stay two points', simplifyStroke([{ x: 0, y: 0 }, { x: 5, y: 5 }], 1).length, 2);
check('A tolerance of zero keeps every real corner', simplifyStroke([{ x: 0, y: 0 }, { x: 5, y: 0.01 }, { x: 10, y: 0 }], 0).length === 3);

console.log('\n--- 2. Line detection: horizontal, vertical and diagonal snapping ---');
eq('5 degrees is horizontal', snapDirection(5, DEFAULT_SNAP_ANGLES, 20, 12), 0);
eq('176 degrees is horizontal too', snapDirection(176, DEFAULT_SNAP_ANGLES, 20, 12), 0);
eq('84 degrees is vertical', snapDirection(84, DEFAULT_SNAP_ANGLES, 20, 12), 90);
eq('50 degrees is a 45 degree diagonal', snapDirection(50, DEFAULT_SNAP_ANGLES, 20, 12), 45);
eq('128 degrees is the other diagonal', snapDirection(128, DEFAULT_SNAP_ANGLES, 20, 12), 135);
eq('30 degrees is left as drawn', snapDirection(30, DEFAULT_SNAP_ANGLES, 20, 12), null);
eq('With diagonals off, 44 degrees is left as drawn', snapDirection(44, ORTHO_SNAP_ANGLES, 20, 12), null);
eq('With no snap angles nothing is straightened', snapDirection(2, [], 20, 12), null);
eq('The snap angles are configurable', snapDirection(58, [0, 60, 90], 20, 12), 60);
near('Direction is measured modulo 180', directionDeg({ x: 5, y: 5 }, { x: 0, y: 5 }), 0);

const h = interpretStroke(stroke([{ x: 2.2, y: 5.3 }, { x: 14.1, y: 4.8 }]), [], opts());
eq('A rough horizontal stroke is one wall', h.walls.length, 1);
check('It is exactly horizontal', isHorizontal(h.walls[0]), h.walls[0]);
eq('It sits on the grid', [h.walls[0].y1, h.walls[0].x1 % 0.5, h.walls[0].x2 % 0.5], [5, 0, 0]);
near('Its length is close to what was drawn', wallLengthOf(h.walls[0]), 12, 0.5);
check('The correction is reported as straightening', h.corrections.some(c => c.kind === 'straightened'), h.corrections);

const v = interpretStroke(stroke([{ x: 7.8, y: 1.1 }, { x: 8.3, y: 13.2 }]), [], opts());
check('A rough vertical stroke is exactly vertical', v.walls.length === 1 && isVertical(v.walls[0]), v.walls);
eq('It is on the grid line it was drawn along', v.walls[0].x1, 8);

const d = interpretStroke(stroke([{ x: 1, y: 1 }, { x: 11, y: 11.8 }], 0.15), [], opts());
eq('A rough diagonal stroke is one wall', d.walls.length, 1);
near('It is exactly 45 degrees', Math.abs(d.walls[0].x2 - d.walls[0].x1), Math.abs(d.walls[0].y2 - d.walls[0].y1), 1e-6);

const slanted = interpretStroke(stroke([{ x: 0, y: 0 }, { x: 17.32, y: 10 }], 0.1), [], opts());
near('A 30 degree wall is kept at its own angle', directionDeg({ x: slanted.walls[0].x1, y: slanted.walls[0].y1 }, { x: slanted.walls[0].x2, y: slanted.walls[0].y2 }), 30, 1.5);
check('...and is not reported as straightened', !slanted.corrections.some(c => c.kind === 'straightened'), slanted.corrections);

const orthoOnly = interpretStroke(stroke([{ x: 1, y: 1 }, { x: 11, y: 11.8 }], 0.15), [], opts({ snapAngles: ORTHO_SNAP_ANGLES }));
check('With 90 degree snapping only, a diagonal stays as drawn', orthoOnly.walls.length === 1 && !isHorizontal(orthoOnly.walls[0]) && !isVertical(orthoOnly.walls[0]), orthoOnly.walls);
const free = interpretStroke(stroke([{ x: 2, y: 5.4 }, { x: 14, y: 4.7 }], 0.1), [], opts({ snapAngles: [], grid: 0 }));
check('With straightening off, the wall keeps its drawn tilt', free.walls.length === 1 && !isHorizontal(free.walls[0]), free.walls);

console.log('\n--- 3. A rough room becomes four joined walls ---');
const roughBox = stroke([{ x: 2.2, y: 2.3 }, { x: 13.8, y: 1.8 }, { x: 14.3, y: 12.2 }, { x: 1.8, y: 11.7 }, { x: 2.5, y: 2.9 }], 0.25);
const room = interpretStroke(roughBox, [], opts());
check('The stroke is recognised as a closed loop', room.closed, room);
eq('It becomes four walls', room.walls.length, 4);
check('Every wall is exactly horizontal or vertical', room.walls.every(w => isHorizontal(w) || isVertical(w)), room.walls);
const corners = room.vertices.map(p => `${p.x},${p.y}`).sort();
eq('The corners are on the grid, where they were drawn', corners, ['14,12', '14,2', '2,12', '2,2']);
room.walls.forEach((w, i) => {
  const next = room.walls[(i + 1) % room.walls.length];
  check(`Wall ${i + 1} ends exactly where the next one starts`, w.x2 === next.x1 && w.y2 === next.y1, [ends(w), ends(next)]);
});
const faces = findWallFaces(room.walls, joinTolerance('feet'), minimumRoomArea('feet'));
eq('The four walls enclose one space', faces.length, 1);
near('Its area is 12 ft x 10 ft', faces[0].area, 120);
const asFloor = normaliseFloor({ ...emptyFloorState(), walls: room.walls }, 'feet', () => `room-${++idSeq}`);
eq('The plan gets one room from those walls', [asFloor.roomsAdded.length, asFloor.state.rooms[0].area, asFloor.state.rooms[0].fromWalls], [1, 120, true]);
check('A neat closure does not need confirming', !room.needsReview, { maxShift: room.maxShift });
check('The closure is reported', room.corrections.some(c => c.kind === 'closed'), room.corrections);
check('The stroke was moved by less than the snap reach', room.maxShift < 1.5, room.maxShift);

const midStart = stroke([{ x: 8, y: 2.1 }, { x: 14.2, y: 1.9 }, { x: 13.9, y: 12.1 }, { x: 2.1, y: 11.8 }, { x: 1.9, y: 2.2 }, { x: 7.4, y: 1.8 }], 0.2);
const roomMid = interpretStroke(midStart, [], opts());
eq('A room started in the middle of a side is still four walls', [roomMid.closed, roomMid.walls.length], [true, 4]);
eq('...with the same four corners', roomMid.vertices.map(p => `${p.x},${p.y}`).sort(), ['14,12', '14,2', '2,12', '2,2']);

const lRoom = interpretStroke(stroke([
  { x: 0.2, y: 0.1 }, { x: 19.8, y: -0.2 }, { x: 20.1, y: 10.2 }, { x: 9.9, y: 9.8 }, { x: 10.2, y: 18.1 }, { x: -0.2, y: 17.9 }, { x: 0.3, y: 0.6 },
], 0.2), [], opts());
eq('An L-shaped room is six walls', [lRoom.closed, lRoom.walls.length], [true, 6]);
const lFaces = findWallFaces(lRoom.walls, joinTolerance('feet'), minimumRoomArea('feet'));
near('Its area is the real L shape, 280 sq.ft', lFaces[0]?.area ?? 0, 280);

const gappy = stroke([{ x: 2, y: 2 }, { x: 14, y: 2 }, { x: 14, y: 12 }, { x: 2, y: 12 }, { x: 2, y: 4.6 }], 0.15);
const withGap = interpretStroke(gappy, [], opts());
check('A loop left well short of its start is still offered as a closed room', withGap.closed && withGap.walls.length === 4, withGap);
check('...but only after the user confirms it', withGap.needsReview, withGap);
const leftOpen = interpretStroke(gappy, [], opts({ closeTolerance: 0 }));
check('Declining the closure keeps the stroke open', !leftOpen.closed && leftOpen.walls.length === 4, leftOpen);
check('The open version leaves the gap where it was drawn', Math.abs(leftOpen.vertices[leftOpen.vertices.length - 1].y - 4.5) < 0.6, leftOpen.vertices);
eq('A single long line is never closed', interpretStroke(stroke([{ x: 0, y: 0 }, { x: 30, y: 0 }]), [], opts()).closed, false);

console.log('\n--- 4. Joining existing walls: corners, T-junctions and crossings ---');
const base = [wall('a', 0, 0, 10, 0)];
const fromCorner = interpretStroke(stroke([{ x: 10.6, y: 0.5 }, { x: 10.3, y: 8.2 }], 0.15), base, opts());
eq('A stroke started near a wall end starts exactly on it', [fromCorner.walls[0].x1, fromCorner.walls[0].y1], [10, 0]);
check('The new wall is vertical from that corner', isVertical(fromCorner.walls[0]) && fromCorner.walls[0].y2 === 8, fromCorner.walls[0]);
check('The join is reported', fromCorner.corrections.some(c => c.kind === 'joined'), fromCorner.corrections);
const joinedFaces = findWallFaces([...base, ...fromCorner.walls, wall('c', 10, 8, 0, 8), wall('d', 0, 8, 0, 0)], joinTolerance('feet'), minimumRoomArea('feet'));
eq('No gap is left at the corner: the loop closes', joinedFaces.length, 1);

const toCorner = interpretStroke(stroke([{ x: 9.7, y: 7.9 }, { x: 10.4, y: 0.6 }], 0.15), base, opts());
eq('A stroke ended near a wall end ends exactly on it', [toCorner.walls[0].x2, toCorner.walls[0].y2], [10, 0]);

const farAway = interpretStroke(stroke([{ x: 13, y: 0.4 }, { x: 13.2, y: 8 }], 0.1), base, opts());
check('A stroke 3 ft from the corner is not pulled to it', farAway.walls[0].x1 === 13, farAway.walls[0]);
const tight = interpretStroke(stroke([{ x: 11.2, y: 0.9 }, { x: 11.3, y: 8 }], 0.05), base, opts({ endpointTolerance: 0.5 }));
check('The join distance is configurable: 0.5 ft does not reach a corner 1.5 ft away', tight.walls[0].x1 !== 10, tight.walls[0]);

const longWall = [wall('long', 0, 0, 20, 0)];
const tee = interpretStroke(stroke([{ x: 8.2, y: 6.1 }, { x: 7.9, y: 0.7 }], 0.15), longWall, opts());
eq('A stroke ending just short of a wall is carried onto it (T-junction)', [tee.walls[0].x2, tee.walls[0].y2], [8, 0]);
const overshoot = interpretStroke(stroke([{ x: 8.1, y: 6 }, { x: 8.2, y: -0.8 }], 0.1), longWall, opts());
eq('A stroke that overshoots a wall is trimmed back to it', [overshoot.walls[0].x2, overshoot.walls[0].y2], [8, 0]);
const teeFaces = findWallFaces([...longWall, wall('r', 20, 0, 20, 6), wall('b', 20, 6, 0, 6), wall('l', 0, 6, 0, 0),
  ...interpretStroke(stroke([{ x: 8.2, y: 5.6 }, { x: 7.9, y: 0.7 }], 0.1), [...longWall, wall('b', 20, 6, 0, 6)], opts()).walls], joinTolerance('feet'), minimumRoomArea('feet'));
eq('A partition drawn between two walls splits the room in two', teeFaces.length, 2);

const cross = [wall('h', 0, 5, 10, 5), wall('v', 5, 0, 5, 10)];
eq('Two crossing walls have one crossing point', wallCrossings(cross), [{ x: 5, y: 5 }]);
eq('Walls that only touch at their ends do not count as crossing', wallCrossings([wall('a', 0, 0, 5, 0), wall('b', 5, 0, 5, 5)]), []);
const fromCross = interpretStroke(stroke([{ x: 5.5, y: 5.4 }, { x: 12, y: 12.2 }], 0.1), cross, opts());
eq('A stroke started near a crossing starts exactly on it', [fromCross.walls[0].x1, fromCross.walls[0].y1], [5, 5]);
const offCentre = [wall('h', 0, 5, 14, 5), wall('v', 5, 0, 5, 12)];
const snapCross = findSnapPoint(5.3, 5.2, offCentre, 0.5, 0.75, true, true);
eq('The precise wall tool snaps to a crossing as well', [snapCross.type, snapCross.x, snapCross.y], ['intersection', 5, 5]);
eq('...and still prefers a nearer wall end', findSnapPoint(13.8, 5.1, offCentre, 0.5, 0.75, true, true).type, 'endpoint');
eq('...and ignores crossings when corner snapping is off', findSnapPoint(5.3, 5.2, offCentre, 0.5, 0.75, false, false).type, 'grid');

const twoCorners = [wall('a', 0, 0, 10, 0), wall('b', 0, 8, 10, 8.4)];
const bridge = interpretStroke(stroke([{ x: 10.3, y: 0.4 }, { x: 9.8, y: 8.0 }], 0.1), twoCorners, opts());
eq('A stroke between two existing corners connects exactly those corners', ends(bridge.walls[0]), [[10, 0], [10, 8.4]]);

console.log('\n--- 5. No duplicate or overlapping walls ---');
const dup = interpretStroke(stroke([{ x: 0.3, y: 0.2 }, { x: 9.8, y: -0.2 }], 0.1), base, opts());
eq('Drawing over an existing wall adds nothing', [dup.walls.length, dup.empty], [0, 'duplicate']);
const extend = interpretStroke(stroke([{ x: 5.2, y: 0.2 }, { x: 16.1, y: -0.2 }], 0.1), base, opts());
eq('A stroke that runs on past an existing wall only adds the new part', extend.walls.map(ends), [[[10, 0], [16, 0]]]);
check('The overlap is reported', extend.corrections.some(c => c.kind === 'overlap-removed'), extend.corrections);
const scribble = interpretStroke([...stroke([{ x: 0, y: 3 }, { x: 12, y: 3 }], 0.1), ...stroke([{ x: 12, y: 3.1 }, { x: 0.2, y: 3 }], 0.1)], [], opts());
check('Going back over the same line does not make two walls', scribble.walls.length === 1, scribble.walls.map(ends));

const a0 = { x: 0, y: 0 }, b0 = { x: 10, y: 0 };
eq('Nothing is cut from a wall that touches no other', subtractCoveredSpans(a0, b0, [wall('p', 0, 3, 10, 3)], 0.3, 0.6).length, 1);
eq('A wall under an identical wall is removed whole', subtractCoveredSpans(a0, b0, [wall('p', 10, 0, 0, 0)], 0.3, 0.6), []);
eq('A wall covered in its middle is split in two', subtractCoveredSpans(a0, b0, [wall('p', 4, 0, 6, 0)], 0.3, 0.6).map(p => [p.a.x, p.b.x]), [[0, 4], [6, 10]]);
eq('Walls that meet end to end do not overlap', subtractCoveredSpans(a0, b0, [wall('p', 10, 0, 20, 0)], 0.3, 0.6).length, 1);
eq('A wall crossing at a right angle does not overlap', subtractCoveredSpans(a0, b0, [wall('p', 5, -5, 5, 5)], 0.3, 0.6).length, 1);

const candidate = wall('new', 0, 0, 10, 0);
eq('Precise tool: an identical wall is refused', trimNewWall(candidate, [wall('old', 0, 0, 10, 0)], 'feet', () => 'x').length, 0);
eq('Precise tool: the same wall drawn the other way is refused', trimNewWall(candidate, [wall('old', 10, 0, 0, 0)], 'feet', () => 'x').length, 0);
eq('Precise tool: a wall extending an existing one keeps only the new part', trimNewWall(wall('new', 0, 0, 16, 0), [wall('old', 0, 0, 10, 0)], 'feet', () => 'x').map(ends), [[[10, 0], [16, 0]]]);
check('Precise tool: a separate wall is returned untouched', trimNewWall(candidate, [wall('old', 0, 4, 10, 4)], 'feet', () => 'x')[0] === candidate);

console.log('\n--- 6. Connected walls from one stroke ---');
const ell = interpretStroke(stroke([{ x: 1.1, y: 1.2 }, { x: 15.9, y: 0.8 }, { x: 16.2, y: 10.1 }], 0.2), [], opts());
eq('An L stroke is two walls', ell.walls.length, 2);
check('They share their corner exactly', ell.walls[0].x2 === ell.walls[1].x1 && ell.walls[0].y2 === ell.walls[1].y1, ell.walls.map(ends));
check('They meet at a right angle', isHorizontal(ell.walls[0]) && isVertical(ell.walls[1]), ell.walls.map(ends));
eq('The corner is on the grid', [ell.walls[0].x2, ell.walls[0].y2], [16, 1]);
const stepped = interpretStroke(stroke([{ x: 0, y: 0 }, { x: 8, y: 0 }, { x: 8, y: 0.7 }, { x: 16, y: 0.7 }], 0.05), [], opts());
eq('A small jog from an unsteady finger does not make extra walls', stepped.walls.length, 1);
const hooked = interpretStroke([{ x: 0.3, y: 0.5 }, { x: 0, y: 0 }, ...stroke([{ x: 0, y: 0 }, { x: 12, y: 0 }], 0.05), { x: 12.2, y: 0.4 }], [], opts());
eq('A hook where the finger landed or lifted is ignored', hooked.walls.length, 1);
const zig = interpretStroke(stroke([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 8 }, { x: 20, y: 8 }], 0.2), [], opts());
eq('A real step (8 ft) is kept as three walls', zig.walls.length, 3);

console.log('\n--- 7. Strokes that are not walls, and safety ---');
eq('A tap is not a wall', interpretStroke([{ x: 5, y: 5 }, { x: 5.05, y: 5.02 }], [], opts()).empty, 'too-short');
eq('A single point is not a wall', interpretStroke([{ x: 5, y: 5 }], [], opts()).walls.length, 0);
eq('An empty stroke is not a wall', interpretStroke([], [], opts()).walls.length, 0);
eq('Bad points are ignored, not turned into geometry', interpretStroke([{ x: NaN, y: 1 }, { x: 1, y: Infinity }], [], opts()).walls.length, 0);
const untouched = JSON.stringify(base);
interpretStroke(stroke([{ x: 10.5, y: 0.5 }, { x: 10.2, y: 8 }]), base, opts());
eq('Interpreting a stroke never changes the walls already on the plan', JSON.stringify(base), untouched);
check('Every new wall has finite coordinates and a real length',
  [h, v, d, room, lRoom, ell, zig].every(r => r.walls.every(w => [w.x1, w.y1, w.x2, w.y2].every(Number.isFinite) && wallLengthOf(w) >= 0.5)));
check('Every new wall has its own id', new Set(room.walls.map(w => w.id)).size === 4);
eq('New walls take the thickness that was asked for', interpretStroke(stroke([{ x: 0, y: 0 }, { x: 9, y: 0 }]), [], opts({ thickness: 0.375 })).walls[0].thickness, 0.375);

const wild = interpretStroke(stroke([{ x: 0, y: 0 }, { x: 12, y: 3.9 }, { x: 24, y: 0 }], 0.1), [], opts({ reviewTolerance: 0.5 }));
check('A correction larger than the review limit is flagged, never applied silently', wild.maxShift > 0.5 && wild.needsReview, wild);
eq('The same stroke always gives the same walls', interpretStroke(roughBox, [], opts()).vertices, room.vertices);

const dense = interpretStroke(stroke([{ x: 2.2, y: 2.3 }, { x: 13.8, y: 1.8 }, { x: 14.3, y: 12.2 }, { x: 1.8, y: 11.7 }, { x: 2.5, y: 2.9 }], 0.2, 0.08), [], opts());
eq('A slower stroke with many more points gives the same room', dense.vertices.map(p => `${p.x},${p.y}`).sort(), ['14,12', '14,2', '2,12', '2,2']);

const metric = interpretStroke(stroke([{ x: 1.02, y: 1.04 }, { x: 4.96, y: 0.97 }, { x: 5.03, y: 4.02 }, { x: 0.98, y: 3.97 }, { x: 1.05, y: 1.2 }], 0.05, 0.1), [],
  { unit: 'meters', thickness: 0.23, newId: () => `m-${++idSeq}`, grid: 0.1 });
eq('A metre plan closes a 4 m x 3 m room the same way', [metric.closed, metric.walls.length], [true, 4]);
near('Its area is 12 sq.m', findWallFaces(metric.walls, joinTolerance('meters'), minimumRoomArea('meters'))[0]?.area ?? 0, 12);

console.log('\n--- 8. What the user is told ---');
const fmt = (n: number) => `${n.toFixed(1)} ft`;
eq('A closed room', describeSketch(room, fmt).startsWith('4 walls'), true);
check('A closure names the gap it bridged', describeSketch(withGap, fmt).includes('closed a'), describeSketch(withGap, fmt));
eq('A duplicate', describeSketch(dup, fmt), 'Those walls are already on the plan.');
eq('A tap', describeSketch(interpretStroke([{ x: 1, y: 1 }], [], opts()), fmt), 'That stroke was too short to be a wall.');

console.log(`\n✅ Floor Planner sketching: all ${passed} checks passed.\n`);
