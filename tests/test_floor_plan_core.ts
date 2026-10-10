/**
 * Floor Planner core: units, rooms from walls, joined-wall editing, openings,
 * floors, undo history, save payload, import/export. Pure logic, no browser.
 */
import {
  METERS_PER_FOOT, SQM_PER_SQFT, baseUnitOf, lengthToMeters, lengthFromMeters, areaToSqM, areaToSqFt, mmToPlan, planToMm,
  formatFeetInches, formatPlanLength, formatPlanArea, wallLengthOf, polygonArea, polygonCentroid, pointInPolygon, roomArea, roomPerimeter,
  findWallFaces, syncRoomsWithWalls, moveJoint, translateWall, fitOpeningOnWall, openingOverlaps, reanchorOpenings, joinTolerance, minimumRoomArea,
} from '../src/domain/planGeometry';
import {
  PlanHistory, addFloor, buildSavePayload, buildThumbnail, commitActive, deleteFloor, duplicateFloor, emptyFloorState, exportPlan, levelToState,
  loadFloors, normaliseFloor, parsePlanFile, renameFloor, suggestFloorName, switchFloor, validateFloorName, type FloorState,
} from '../src/domain/planDocument';
import { formatArea, formatLength, mmToPlanUnits, planUnitsToMm } from '../src/services/geometryEngine';
import type { FloorPlan, FloorPlanDoor, FloorPlanLevel, FloorPlanRoom, FloorPlanWall } from '../src/db/types';

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
const box = (prefix: string, x: number, y: number, w: number, h: number): FloorPlanWall[] => [
  wall(`${prefix}-t`, x, y, x + w, y), wall(`${prefix}-r`, x + w, y, x + w, y + h),
  wall(`${prefix}-b`, x + w, y + h, x, y + h), wall(`${prefix}-l`, x, y + h, x, y),
];
let idSeq = 0;
const newId = () => `id-${++idSeq}`;
const TOL = joinTolerance('feet');
const MIN = minimumRoomArea('feet');

console.log('\n--- 1. Units and conversions ---');
eq('One foot is exactly 0.3048 m', METERS_PER_FOOT, 0.3048);
near('One sq.ft is 0.09290304 sq.m', SQM_PER_SQFT, 0.09290304, 1e-12);
eq('Base unit: inches plans are stored in feet', [baseUnitOf('feet'), baseUnitOf('inches'), baseUnitOf('meters'), baseUnitOf('centimeters')], ['feet', 'feet', 'meters', 'meters']);
near('10 ft in metres', lengthToMeters(10, 'feet'), 3.048);
near('3.048 m in feet', lengthFromMeters(3.048, 'feet'), 10);
near('Metre plans are not converted', lengthToMeters(4.5, 'meters'), 4.5);
near('Round trip keeps the length', lengthFromMeters(lengthToMeters(37.25, 'feet'), 'feet'), 37.25, 1e-12);
near('1200 sq.ft in sq.m', areaToSqM(1200, 'feet'), 111.483648, 1e-9);
near('100 sq.m in sq.ft', areaToSqFt(100, 'meters'), 1076.391041671, 1e-6);
near('230 mm wall in feet', mmToPlan(230, 'feet'), 0.754593176, 1e-8);
near('230 mm wall in metres', mmToPlan(230, 'meters'), 0.23);
near('mm round trip', planToMm(mmToPlan(115, 'feet'), 'feet'), 115, 1e-9);
eq('Feet and inches', [formatFeetInches(12.5), formatFeetInches(10), formatFeetInches(0.75)], [`12'-6"`, `10'-0"`, `0'-9"`]);
eq('Inches never show as 12', formatFeetInches(11.999), `12'-0"`);
eq('Length per plan unit', [formatPlanLength(12.5, 'feet'), formatPlanLength(12.5, 'inches'), formatPlanLength(3.81, 'meters'), formatPlanLength(3.81, 'centimeters')], [`12'-6"`, `150"`, '3.81 m', '381 cm']);
eq('Area in a feet plan', formatPlanArea(150, 'feet'), '150.0 sq.ft (13.9 m²)');
eq('Area in a metre plan', formatPlanArea(13.94, 'meters'), '13.94 m² (150.0 sq.ft)');
// The shared geometry engine must follow the same convention for the legacy display units.
near('Engine: 230 mm in an inches plan is still stored in feet', mmToPlanUnits(230, 'inches'), mmToPlan(230, 'feet'), 1e-12);
near('Engine: 230 mm in a centimetre plan is stored in metres', mmToPlanUnits(230, 'centimeters'), 0.23, 1e-12);
near('Engine: mm round trip for inches plans', planUnitsToMm(mmToPlanUnits(230, 'inches'), 'inches'), 230, 1e-9);
check('Engine: area of an inches plan is read as sq.ft', formatArea(150, 'inches').startsWith('150.0 sq.ft'), formatArea(150, 'inches'));
check('Engine: area of a centimetre plan is read as sq.m', formatArea(13.94, 'centimeters').startsWith('13.94 m²'), formatArea(13.94, 'centimeters'));
check('Engine: length of an inches plan is shown in inches', formatLength(12.5, 'inches').startsWith('150"'), formatLength(12.5, 'inches'));
check('Engine: length of a centimetre plan is shown in cm', formatLength(3.81, 'centimeters').startsWith('381 cm'), formatLength(3.81, 'centimeters'));

console.log('\n--- 2. Wall length, area, centroid ---');
eq('3-4-5 wall length', wallLengthOf(wall('w', 0, 0, 3, 4)), 5);
near('Diagonal wall length', wallLengthOf(wall('w', 2, 1, 12, 11)), Math.sqrt(200));
eq('Rectangle area', polygonArea([{ x: 0, y: 0 }, { x: 12, y: 0 }, { x: 12, y: 10 }, { x: 0, y: 10 }]), 120);
eq('Area does not depend on drawing direction', polygonArea([{ x: 0, y: 10 }, { x: 12, y: 10 }, { x: 12, y: 0 }, { x: 0, y: 0 }]), 120);
const lShape = [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 10 }, { x: 10, y: 10 }, { x: 10, y: 18 }, { x: 0, y: 18 }];
eq('L-shaped area = 200 + 80', polygonArea(lShape), 280);
eq('Triangle area', polygonArea([{ x: 0, y: 0 }, { x: 8, y: 0 }, { x: 0, y: 6 }]), 24);
eq('Centroid of a rectangle', polygonCentroid([{ x: 0, y: 0 }, { x: 12, y: 0 }, { x: 12, y: 10 }, { x: 0, y: 10 }]), { x: 6, y: 5 });
check('Point in the notch of an L is outside', !pointInPolygon({ x: 15, y: 15 }, lShape) && pointInPolygon({ x: 5, y: 15 }, lShape));
eq('Room area uses its outline when it has one', roomArea({ width: 20, height: 18, polygonPoints: lShape }), 280);
eq('Rectangular room area and perimeter', [roomArea({ width: 12, height: 10 }), roomPerimeter({ width: 12, height: 10 })], [120, 44]);

console.log('\n--- 3. Rooms from connected walls ---');
const single = findWallFaces(box('a', 0, 0, 12, 10), TOL, MIN);
eq('Four walls enclose one room', single.length, 1);
eq('Its area is exact', single[0].area, 120);
eq('Its perimeter is exact', single[0].perimeter, 44);
eq('It is bounded by all four walls', single[0].wallIds.length, 4);

eq('Three walls enclose nothing', findWallFaces(box('a', 0, 0, 12, 10).slice(0, 3), TOL, MIN).length, 0);
eq('A gap larger than the tolerance leaves the room open', findWallFaces([...box('a', 0, 0, 12, 10).slice(0, 3), wall('gap', 0, 10, 0, 1)], TOL, MIN).length, 0);
eq('A gap within the tolerance still closes', findWallFaces([...box('a', 0, 0, 12, 10).slice(0, 3), wall('near', 0.1, 9.9, 0.05, 0.1)], TOL, MIN).length, 1);

// Two rooms sharing a partition that meets the outer walls partway along (T-junctions).
const twoRooms = findWallFaces([...box('o', 0, 0, 30, 20), wall('mid', 16, 0, 16, 20, 0.5)], TOL, MIN);
eq('A partition makes two rooms', twoRooms.length, 2);
eq('Their areas are exact and add up', twoRooms.map(f => f.area).sort((a, b) => a - b), [280, 320]);
check('The shared wall bounds both', twoRooms.every(f => f.wallIds.includes('mid')));
eq('Outlines are clean rectangles (junction points removed)', twoRooms.map(f => f.points.length), [4, 4]);

// 2 BHK style: outer box, one full partition and one partial partition.
const threeRooms = findWallFaces([...box('o', 0, 0, 40, 30), wall('v', 22, 0, 22, 30), wall('h', 22, 15, 40, 15)], TOL, MIN);
eq('Three rooms from two partitions', threeRooms.length, 3);
eq('Three room areas', threeRooms.map(f => f.area).sort((a, b) => a - b), [270, 270, 660]);
eq('Room areas add up to the footprint', threeRooms.reduce((s, f) => s + f.area, 0), 1200);

const lWalls = lShape.map((p, i) => wall(`l${i}`, p.x, p.y, lShape[(i + 1) % lShape.length].x, lShape[(i + 1) % lShape.length].y));
const lFace = findWallFaces(lWalls, TOL, MIN);
eq('An L-shaped loop is one room', [lFace.length, lFace[0].area, lFace[0].points.length], [1, 280, 6]);

eq('A wall that stops short inside the room does not split it', findWallFaces([...box('o', 0, 0, 20, 20), wall('stub', 10, 0, 10, 12)], TOL, MIN).map(f => f.area), [400]);
eq('A wall outside the room is ignored', findWallFaces([...box('o', 0, 0, 20, 20), wall('far', 30, 0, 30, 20)], TOL, MIN).length, 1);
eq('Crossing walls make four rooms', findWallFaces([...box('o', 0, 0, 20, 20), wall('x', 10, 0, 10, 20), wall('y', 0, 10, 20, 10)], TOL, MIN).map(f => f.area), [100, 100, 100, 100]);
eq('Two separate buildings', findWallFaces([...box('a', 0, 0, 10, 10), ...box('b', 30, 0, 12, 10)], TOL, MIN).map(f => f.area), [100, 120]);
eq('Tiny slivers are not rooms', findWallFaces(box('s', 0, 0, 2, 2), TOL, MIN).length, 0);
eq('Metre plans use a metre-sized threshold', findWallFaces(box('m', 0, 0, 2, 1.5), joinTolerance('meters'), minimumRoomArea('meters')).map(f => f.area), [3]);
eq('Duplicate walls on the same line do not double the room', findWallFaces([...box('a', 0, 0, 12, 10), wall('dup', 0, 0, 12, 0)], TOL, MIN).length, 1);

console.log('\n--- 4. Rooms stay in step with walls ---');
const walls1 = [...box('o', 0, 0, 30, 20), wall('mid', 16, 0, 16, 20)];
const first = syncRoomsWithWalls([], walls1, 'feet', newId);
eq('Two rooms are created', first.added.length, 2);
check('New rooms are not given a guessed type', first.rooms.every(r => r.roomType === 'Custom' && /^Room \d+$/.test(r.label) && r.fromWalls === true));
const named = first.rooms.map(r => (r.area === 320 ? { ...r, label: 'Hall', roomType: 'Living Room' as const } : { ...r, label: 'Bedroom' }));

const again = syncRoomsWithWalls(named, walls1, 'feet', newId);
check('Nothing changes when walls have not moved', again.changed === false && again.rooms === named);

// Move the partition 2 ft to the right.
const movedWalls = walls1.map(w => (w.id === 'mid' ? { ...w, x1: 18, x2: 18 } : w));
const after = syncRoomsWithWalls(named, movedWalls, 'feet', newId);
const hall = after.rooms.find(r => r.label === 'Hall')!;
const bed = after.rooms.find(r => r.label === 'Bedroom')!;
eq('Hall grows to 18 x 20 and keeps its name and type', [hall.area, hall.width, hall.roomType], [360, 18, 'Living Room']);
eq('Bedroom shrinks to 12 x 20', [bed.area, bed.x, bed.width], [240, 18, 12]);
eq('Room ids are kept', [hall.id, bed.id].sort(), named.map(r => r.id).sort());
eq('No room added or removed', [after.added.length, after.removed.length], [0, 0]);

const noPartition = syncRoomsWithWalls(named, walls1.filter(w => w.id !== 'mid'), 'feet', newId);
eq('Removing the partition leaves one room of the whole area', [noPartition.rooms.length, noPartition.rooms[0].area, noPartition.removed.length], [1, 600, 1]);

const opened = syncRoomsWithWalls(named, walls1.filter(w => w.id !== 'o-t'), 'feet', newId);
eq('Opening the outer wall removes rooms that are no longer enclosed', opened.rooms.length, 0);

const manual: FloorPlanRoom = { id: 'manual', roomType: 'Kitchen', label: 'Kitchen block', x: 40, y: 0, width: 10, height: 8, rotation: 0 };
const keepManual = syncRoomsWithWalls([manual], walls1, 'feet', newId);
check('A hand-placed room elsewhere is left exactly as it was', keepManual.rooms.find(r => r.id === 'manual') === manual && keepManual.rooms.length === 3);

const filling: FloorPlanRoom = { id: 'fill', roomType: 'Bedroom', label: 'My bedroom', x: 16.5, y: 0.5, width: 13, height: 19, rotation: 0 };
const reserved = syncRoomsWithWalls([filling], walls1, 'feet', newId);
eq('A hand-placed room that fills a space stops a duplicate being made there', reserved.rooms.map(r => r.label).sort(), ['My bedroom', 'Room 2']);

const legacy: FloorPlanRoom = { id: 'legacy', roomType: 'Living Room', label: 'Living Room (320.0 sq.ft)', x: 0, y: 0, width: 16, height: 20, rotation: 0, polygonPoints: [{ x: 0, y: 0 }, { x: 16, y: 0 }, { x: 16, y: 20 }, { x: 0, y: 20 }] };
const adopted = syncRoomsWithWalls([legacy], walls1, 'feet', newId);
check('An earlier auto-detected room that matches its walls is adopted, not duplicated', adopted.rooms.filter(r => r.fromWalls).length === 2 && adopted.rooms.find(r => r.id === 'legacy')?.fromWalls === true);

console.log('\n--- 5. Editing joined walls ---');
const sq = box('q', 0, 0, 10, 10);
const dragged = moveJoint(sq, { x: 10, y: 10 }, { x: 14, y: 12 }, TOL);
eq('Dragging a corner moves both walls that meet there', dragged.filter(w => (w.x1 === 14 && w.y1 === 12) || (w.x2 === 14 && w.y2 === 12)).map(w => w.id).sort(), ['q-b', 'q-r']);
eq('Other corners do not move', [dragged[0].x1, dragged[0].y1, dragged[3].x2, dragged[3].y2], [0, 0, 0, 0]);
eq('The room is still closed after the corner moves', findWallFaces(dragged, TOL, MIN).length, 1);
near('Its area is recalculated', findWallFaces(dragged, TOL, MIN)[0].area, polygonArea([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 14, y: 12 }, { x: 0, y: 10 }]));
check('The original walls are not mutated', sq[1].x2 === 10 && sq[1].y2 === 10);

const slid = translateWall(sq, 'q-r', 5, 0, TOL);
eq('Sliding a wall stretches its neighbours', [slid.find(w => w.id === 'q-t')!.x2, slid.find(w => w.id === 'q-b')!.x1], [15, 15]);
eq('The slid wall keeps its length', wallLengthOf(slid.find(w => w.id === 'q-r')!), 10);
eq('The room stays closed and grows to 15 x 10', findWallFaces(slid, TOL, MIN).map(f => f.area), [150]);
check('A zero move returns the same walls', translateWall(sq, 'q-r', 0, 0, TOL) === sq);

console.log('\n--- 6. Doors and windows on walls ---');
const host = wall('h', 0, 0, 20, 0);
eq('An opening snaps onto the wall line', fitOpeningOnWall(host, 3, 8, 1.4), { x: 8, y: 0, rotation: 0, wallOffset: 8 });
eq('It can not hang off the start of the wall', fitOpeningOnWall(host, 3, -5, 0)?.x, 1.5);
eq('It can not hang off the end of the wall', fitOpeningOnWall(host, 3, 50, 0)?.x, 18.5);
eq('A wall shorter than the opening can not hold it', fitOpeningOnWall(wall('s', 0, 0, 2, 0), 3, 1, 0), null);
eq('Rotation follows a vertical wall', fitOpeningOnWall(wall('v', 5, 0, 5, 20), 3, 6, 10), { x: 5, y: 10, rotation: 90, wallOffset: 10 });
const doors: FloorPlanDoor[] = [{ id: 'd1', doorType: 'Single', x: 8, y: 0, width: 3, rotation: 0, wallId: 'h', wallOffset: 8 }];
check('Overlapping openings on one wall are detected', openingOverlaps('h', 9.5, 3, doors) && !openingOverlaps('h', 12, 3, doors));
check('An opening does not overlap itself', !openingOverlaps('h', 8, 3, doors, 'd1'));
check('Openings on different walls do not overlap', !openingOverlaps('other', 8, 3, doors));

const movedHost = [{ ...host, y1: 4, y2: 4 }];
const re = reanchorOpenings(doors, movedHost);
eq('A door follows its wall when the wall moves', [re.openings[0].x, re.openings[0].y, re.removed.length], [8, 4, 0]);
eq('A door goes when its wall is deleted', reanchorOpenings(doors, []).removed.map(d => d.id), ['d1']);
eq('A door goes when its wall becomes too short', reanchorOpenings(doors, [{ ...host, x2: 2 }]).removed.length, 1);
const free: FloorPlanDoor = { id: 'free', doorType: 'Single', x: 1, y: 1, width: 3, rotation: 0 };
check('Openings that are not on a wall are left alone', reanchorOpenings([free], []).openings[0] === free);

console.log('\n--- 7. Floors ---');
const stateOf = (walls: FloorPlanWall[]): FloorState => ({ ...emptyFloorState(), walls });
const groundWalls = box('g', 0, 0, 30, 20);
let floors: FloorPlanLevel[] = [{ id: 'lvl-0', name: 'Ground Floor', elevation: 0, ...emptyFloorState() }];
eq('Suggested name for the second floor', suggestFloorName(floors), 'First Floor');
const added = addFloor(floors, 0, stateOf(groundWalls), 'First Floor', 10, () => 'lvl-1');
eq('Adding a floor switches to it, empty', [added.activeIndex, added.state.walls.length, added.floors.length], [1, 0, 2]);
eq('The floor being left is saved first', added.floors[0].walls.length, 4);
eq('The new floor sits one storey up', added.floors[1].elevation, 10);

const firstWalls = box('f', 0, 0, 20, 20);
const back = switchFloor(added.floors, 1, stateOf(firstWalls), 0);
eq('Switching back shows the ground floor', [back.activeIndex, back.state.walls.map(w => w.id)[0]], [0, 'g-t']);
eq('First floor kept its own walls', back.floors[1].walls.map(w => w.id)[0], 'f-t');
const stay = switchFloor(back.floors, 0, back.state, 7);
eq('Switching to a floor that does not exist changes nothing', [stay.activeIndex, stay.floors.length], [0, 2]);

check('Blank and duplicate floor names are refused', !!validateFloorName(back.floors, '  ') && !!validateFloorName(back.floors, 'first floor') && validateFloorName(back.floors, 'Terrace') === null);
check('Renaming a floor to its own name is allowed', validateFloorName(back.floors, 'First Floor', 1) === null);
eq('Rename', renameFloor(back.floors, 1, ' Upper Floor ')[1].name, 'Upper Floor');

const withDoor: FloorState = { ...stateOf(groundWalls), doors: [{ id: 'd', doorType: 'Single', x: 5, y: 0, width: 3, rotation: 0, wallId: 'g-t', wallOffset: 5 }] };
let n = 0;
const dup = duplicateFloor(back.floors, 0, withDoor, 'Ground copy', 10, p => `${p}-copy-${++n}`);
eq('Duplicate floor is added and shown', [dup.floors.length, dup.activeIndex, dup.state.walls.length], [3, 2, 4]);
check('Copied elements have new ids', dup.state.walls.every(w => w.id.startsWith('wall-copy-')) && dup.state.doors[0].id.startsWith('door-copy-'));
check('A copied door is hosted on the copied wall', dup.state.walls.some(w => w.id === dup.state.doors[0].wallId));
check('The original floor is untouched', dup.floors[0].walls[0].id === 'g-t' && dup.floors[0].doors[0].wallId === 'g-t');

// Deleting: three floors G (4 walls, ids g-*), F (4 walls f-*), T (empty). Editing G.
const three: FloorPlanLevel[] = [
  { id: 'G', name: 'Ground Floor', ...stateOf(groundWalls) },
  { id: 'F', name: 'First Floor', ...stateOf(firstWalls) },
  { id: 'T', name: 'Terrace', ...emptyFloorState() },
];
const delActiveFirst = deleteFloor(three, 0, stateOf(groundWalls), 0)!;
eq('Deleting the ground floor while editing it shows the next floor', [delActiveFirst.floors.map(f => f.id), delActiveFirst.activeIndex, delActiveFirst.state.walls[0].id], [['F', 'T'], 0, 'f-t']);
check('The deleted floor\'s walls are not written into another floor', delActiveFirst.floors.every(f => f.walls.every(w => !w.id.startsWith('g-'))));
const delActiveMid = deleteFloor(three, 1, stateOf(firstWalls), 1)!;
eq('Deleting the middle floor while editing it shows the floor below', [delActiveMid.floors.map(f => f.id), delActiveMid.activeIndex, delActiveMid.state.walls[0].id], [['G', 'T'], 0, 'g-t']);
const delBelow = deleteFloor(three, 2, emptyFloorState(), 0)!;
eq('Deleting a floor below the one being edited keeps you on the same floor', [delBelow.floors.map(f => f.id), delBelow.activeIndex, delBelow.floors[delBelow.activeIndex].id], [['F', 'T'], 1, 'T']);
const delOther = deleteFloor(three, 0, stateOf([...groundWalls, wall('new', 5, 0, 5, 20)]), 2)!;
eq('Deleting another floor keeps unsaved edits on the current one', [delOther.activeIndex, delOther.floors[0].walls.length, delOther.state.walls.length], [0, 5, 5]);
eq('The only floor can not be deleted', deleteFloor([three[0]], 0, emptyFloorState(), 0), null);

eq('commitActive writes only the active floor', commitActive(three, 2, stateOf(groundWalls)).map(f => f.walls.length), [4, 4, 4]);

console.log('\n--- 8. Undo and redo ---');
const h = new PlanHistory(5);
const s0 = stateOf([]);
const s1 = stateOf([groundWalls[0]]);
const s2 = stateOf(groundWalls.slice(0, 2));
h.reset('G', s0);
check('Nothing to undo at the start', !h.canUndo('G') && !h.canRedo('G') && h.undo('G') === null);
h.push('G', s1);
h.push('G', s2);
eq('Undo goes back one step', h.undo('G')?.walls.length, 1);
eq('Undo again', h.undo('G')?.walls.length, 0);
check('Can not undo past the start', h.undo('G') === null && !h.canUndo('G'));
eq('Redo goes forward', [h.redo('G')?.walls.length, h.redo('G')?.walls.length, h.redo('G')], [1, 2, null]);
h.undo('G');
h.push('G', stateOf(groundWalls.slice(0, 3)));
check('A new edit after undo discards the redo steps', !h.canRedo('G') && h.undo('G')?.walls.length === 1);
h.push('G', stateOf(groundWalls.slice(0, 1)));
// We are one step back from the 3-wall state; re-pushing the current state must not add a
// step or throw away the redo that is still available.
check('Pushing an unchanged state is ignored', h.undo('G')?.walls.length === 0 && h.redo('G')?.walls.length === 1 && h.redo('G')?.walls.length === 3 && !h.canRedo('G'));

h.reset('F', stateOf(firstWalls));
h.push('F', stateOf(firstWalls.slice(0, 2)));
eq('Undo on the first floor returns first-floor walls only', h.undo('F')?.walls.map(w => w.id[0]), ['f', 'f', 'f', 'f']);
check('Undo on one floor never returns another floor\'s drawing', !h.canUndo('F') && h.undo('F') === null);

const snapshotSafe = stateOf([{ ...groundWalls[0] }]);
h.reset('S', snapshotSafe);
snapshotSafe.walls[0].x2 = 999;
h.push('S', stateOf([]));
eq('History keeps its own copy of each state', h.undo('S')?.walls[0].x2, 30);

const lim = new PlanHistory(3);
lim.reset('L', stateOf([]));
for (let i = 1; i <= 6; i++) lim.push('L', stateOf(Array.from({ length: i }, (_, k) => wall(`w${k}`, 0, k, 5, k))));
eq('History is capped but keeps the latest states', [lim.undo('L')?.walls.length, lim.undo('L')?.walls.length, lim.undo('L')], [5, 4, null]);

console.log('\n--- 9. Consistency after wall edits ---');
const start: FloorState = { ...stateOf([...box('o', 0, 0, 30, 20), wall('mid', 16, 0, 16, 20)]), doors: [{ id: 'd', doorType: 'Single', x: 16, y: 10, width: 3, rotation: 90, wallId: 'mid', wallOffset: 10 }] };
const norm = normaliseFloor(start, 'feet', newId);
eq('Rooms are created for enclosed spaces', [norm.state.rooms.length, norm.roomsAdded.length], [2, 2]);
const settled = normaliseFloor(norm.state, 'feet', newId);
check('Normalising a consistent floor returns the same object', settled.state === norm.state);
const withoutMid = normaliseFloor({ ...norm.state, walls: norm.state.walls.filter(w => w.id !== 'mid') }, 'feet', newId);
eq('Deleting a wall removes its door and merges the rooms', [withoutMid.state.doors.length, withoutMid.openingsRemoved, withoutMid.state.rooms.length, withoutMid.state.rooms[0].area], [0, 1, 1, 600]);

console.log('\n--- 10. Saving ---');
const plan = { id: 'p', userId: 'u', buildingName: 'Test House', floorName: 'Ground Floor', plotLength: 30, plotWidth: 20, unit: 'feet', walls: [], rooms: [], doors: [], windows: [], isDeleted: false, createdAt: 'x', updatedAt: 'x' } as FloorPlan;
const thumb = buildThumbnail(norm.state, 30, 20);
check('Thumbnail is a self-contained data URL, never a blob: link', thumb.startsWith('data:image/svg+xml;utf8,') && !thumb.includes('blob:'));
check('Thumbnail stays small', thumb.length < 6000, thumb.length);
const payload = buildSavePayload(plan, three, 1, stateOf([...firstWalls, wall('extra', 10, 0, 10, 20)]));
eq('All floors are saved, with the edited floor up to date', payload.floors!.map(f => f.walls.length), [4, 5, 0]);
eq('Top-level drawing mirrors the ground floor even while editing the first floor', payload.walls.map(w => w.id[0]), ['g', 'g', 'g', 'g']);
check('Saving does not mutate the floors passed in', three[1].walls.length === 4);

eq('A plan saved without floors opens with its drawing as the ground floor', loadFloors({ ...plan, walls: groundWalls }).map(f => [f.name, f.walls.length]), [['Ground Floor', 4]]);
eq('A template with empty placeholder floors keeps its drawing', loadFloors({ ...plan, walls: groundWalls, floors: [{ id: 'lvl-ground', name: 'Ground Floor', ...emptyFloorState() }] })[0].walls.length, 4);
eq('Saved floors win over the top-level mirror', loadFloors({ ...plan, walls: groundWalls, floors: three }).map(f => f.id), ['G', 'F', 'T']);
eq('levelToState fills missing lists', Object.values(levelToState({ walls: groundWalls })).map(v => v.length), [4, 0, 0, 0, 0, 0, 0, 0]);

console.log('\n--- 11. Export and import ---');
const exported = exportPlan({ ...plan, ceilingHeight: 10 }, three, '2026-10-11T00:00:00.000Z');
const reread = parsePlanFile(JSON.stringify(exported));
eq('Export then import keeps every floor', reread.floors.map(f => [f.name, f.walls.length]), [['Ground Floor', 4], ['First Floor', 4], ['Terrace', 0]]);
eq('Wall coordinates survive the round trip exactly', reread.floors[0].walls.map(w => [w.x1, w.y1, w.x2, w.y2]), groundWalls.map(w => [w.x1, w.y1, w.x2, w.y2]));
eq('Project details survive', [reread.buildingName, reread.unit, reread.plotLength, reread.plotWidth, reread.ceilingHeight], ['Test House', 'feet', 30, 20, 10]);
check('The export says it is not a certified drawing', /not a certified/i.test(exported.disclaimer));

const flat = parsePlanFile(JSON.stringify({ floorName: 'Ground Floor', buildingName: 'Old', plotLength: '40', plotWidth: 30, unit: 'meters', walls: groundWalls, rooms: [] }));
eq('The older flat format still imports', [flat.floors.length, flat.floors[0].walls.length, flat.unit, flat.plotLength], [1, 4, 'meters', 40]);
const dirty = parsePlanFile(JSON.stringify({ plotLength: 30, plotWidth: 20, unit: 'yards', floors: [{ walls: [wall('ok', 0, 0, 5, 0), { id: 'bad', x1: 'abc', y1: 0, x2: 1, y2: 1 }, null], doors: [{ x: 1 }] }] }));
eq('Broken items are dropped and an unknown unit falls back to feet', [dirty.floors[0].walls.length, dirty.floors[0].doors.length, dirty.unit], [1, 0, 'feet']);
const throws = (text: string) => { try { parsePlanFile(text); return ''; } catch (e) { return (e as Error).message; } };
check('A file that is not JSON is refused with a plain message', /not a floor plan file/i.test(throws('hello')));
check('A JSON file with no plot size is refused', /plot size/i.test(throws(JSON.stringify({ walls: [] }))));
check('A backup file is not mistaken for a plan', /plot size/i.test(throws(JSON.stringify({ appName: 'Building Mistry', data: {} }))));

console.log(`\n✅ Floor Planner core: all ${passed} checks passed.`);
