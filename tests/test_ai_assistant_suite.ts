import {
  extractStrokeGeometry,
  classifyDrawingStroke,
  validatePlanAction,
  diagnosePlanIssues,
  analyzePlanMetrics,
  generateProposedLayout,
  type Point2D,
  type ValidatedPlanAction,
} from '../src/services/aiFloorPlanEngine';
import {
  LocalFloorPlanAIProvider,
  type PlanContext,
} from '../src/services/aiProvider';
import type {
  FloorPlanWall,
  FloorPlanRoom,
  FloorPlanDoor,
  FloorPlanWindow,
  FloorPlanColumn,
  FloorPlanStaircase,
} from '../src/db/types';

let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${testName}`);
    passedTests++;
  } else {
    console.error(`  ✗ FAIL: ${testName}${detail ? ` - ${detail}` : ''}`);
    failedTests++;
  }
}

console.log('\n===============================================================');
console.log('BUILDING MISTRY — AI FLOOR PLAN ASSISTANT TEST SUITE');
console.log('Intelligent Geometry, Confidence Rules, Actions & Natural Commands');
console.log('===============================================================\n');

// ── 1. GEOMETRY ENGINE & FEATURE EXTRACTION ─────────────────
console.log('1. Testing Geometry Feature Extraction:');
const straightHorizontalStroke: Point2D[] = [
  { x: 0, y: 0 },
  { x: 3, y: 0.1 },
  { x: 6, y: -0.05 },
  { x: 10, y: 0 },
];
const featuresHoriz = extractStrokeGeometry(straightHorizontalStroke, [], 'feet');
assert(featuresHoriz.directLength === 10, 'Direct Euclidean length is accurately 10 ft');
assert(featuresHoriz.linearity > 0.95, `High linearity (${featuresHoriz.linearity.toFixed(2)}) for straight line`);
assert(featuresHoriz.closestCardinalDeg === 0, 'Snaps to 0° cardinal horizontal');
assert(featuresHoriz.cardinalDeviationDeg < 2, 'Deviation from 0° is under 2°');

// ── 2. CONFIDENCE SYSTEM & NO BLIND GUESSING ────────────────
console.log('\n2. Testing Confidence Rules & Classification:');

// A. Clean Wall: 90-100% safe automatic interpretation
const cleanWallStroke: Point2D[] = [
  { x: 0, y: 0 },
  { x: 5, y: 0 },
  { x: 10, y: 0 },
];
const wallResult = classifyDrawingStroke(cleanWallStroke, [], [], 'feet');
assert(wallResult.classification === 'wall', 'Classifies as wall');
assert(wallResult.confidence >= 0.90, `Confidence >= 90% (${(wallResult.confidence * 100).toFixed(0)}%) for orthogonal straight stroke`);
assert(!wallResult.requiresConfirmation, 'Safe for automatic conversion without asking');
assert(wallResult.suggestedAction.action === 'ADD_WALL', 'Produces ADD_WALL action');

// B. Rough Angled Wall: 70-89% asks confirmation
const angledWallStroke: Point2D[] = [
  { x: 0, y: 0 },
  { x: 5, y: 3.5 },
  { x: 10, y: 7 },
];
const angledResult = classifyDrawingStroke(angledWallStroke, [], [], 'feet');
assert(angledResult.classification === 'wall', 'Classifies angled line as wall');
assert(angledResult.confidence >= 0.70 && angledResult.confidence < 0.90,
  `Confidence in 70-89% range (${(angledResult.confidence * 100).toFixed(0)}%) for skewed angle`);
assert(angledResult.requiresConfirmation, 'Requires user confirmation before modifying canvas');

// C. Ambiguous / Messy Stroke: <70% asks user without guessing!
const messyStroke: Point2D[] = [
  { x: 0, y: 0 },
  { x: 1, y: 2 },
  { x: 0.5, y: -1 },
  { x: 2, y: 1 },
];
const ambiguousResult = classifyDrawingStroke(messyStroke, [], [], 'feet');
assert(ambiguousResult.isUncertain, 'Flags stroke as uncertain (<70%)');
assert(ambiguousResult.confidence < 0.70, `Confidence < 70% (${(ambiguousResult.confidence * 100).toFixed(0)}%)`);
assert(ambiguousResult.suggestedAction.action === 'NOOP', 'Does NOT blindly guess or modify canvas');
assert(ambiguousResult.options.length >= 4, 'Provides options: Wall, Room Boundary, Door, Window, Column');

// ── 3. ROOM BOUNDARY DETECTION ───────────────────────────────
console.log('\n3. Testing Closed Room Boundary Detection:');
const closedLoopStroke: Point2D[] = [
  { x: 0, y: 0 },
  { x: 12, y: 0 },
  { x: 12, y: 14 },
  { x: 0, y: 14 },
  { x: 0.2, y: 0.1 }, // closes near start
];
const roomResult = classifyDrawingStroke(closedLoopStroke, [], [], 'feet');
assert(roomResult.classification === 'room_boundary', 'Classifies closed polygon loop as room_boundary');
assert(roomResult.confidence >= 0.90, `High confidence (${(roomResult.confidence * 100).toFixed(0)}%) for closed room loop`);
assert(roomResult.suggestedAction.action === 'ADD_ROOM', 'Suggests ADD_ROOM action');
const roomPayload = roomResult.suggestedAction.payload;
assert(roomPayload.width === 12 && roomPayload.height === 14, `Dimensions extracted: ${roomPayload.width}×${roomPayload.height}`);
assert(roomPayload.area === 168, `Area calculated from actual geometry: ${roomPayload.area} sq ft`);

// ── 4. DOOR & WINDOW DETECTION ──────────────────────────────
console.log('\n4. Testing Door and Window Detection near Wall:');
const existingWall: FloorPlanWall = {
  id: 'w-main',
  x1: 0, y1: 0, x2: 20, y2: 0,
  thickness: 0.75, height: 10,
  wallType: 'exterior',
};

// Door: 3ft stroke perpendicular to existing wall
const doorStroke: Point2D[] = [
  { x: 5, y: 0 },
  { x: 5, y: 3 },
];
const doorResult = classifyDrawingStroke(doorStroke, [existingWall], [], 'feet');
assert(doorResult.classification === 'door', 'Identifies 3ft opening near wall as door');
assert(doorResult.requiresConfirmation, 'Prompts user for door type confirmation');
assert(doorResult.options.some(o => o.label.includes('Single Door')), 'Offers Single Door option');

// Window: 4ft stroke collinear with existing wall interior
const windowStroke: Point2D[] = [
  { x: 10, y: 0 },
  { x: 14, y: 0 },
];
const windowResult = classifyDrawingStroke(windowStroke, [existingWall], [], 'feet');
assert(windowResult.classification === 'window', 'Identifies 4ft opening situated along wall as window');
assert(windowResult.requiresConfirmation, 'Prompts for window confirmation');

// ── 5. COLUMN & STAIRCASE DETECTION ─────────────────────────
console.log('\n5. Testing Structural Column & Staircase Detection:');
// Compact square box (1.2 x 1.2 ft)
const columnStroke: Point2D[] = [
  { x: 2, y: 2 },
  { x: 3.2, y: 2 },
  { x: 3.2, y: 3.2 },
  { x: 2, y: 3.2 },
  { x: 2, y: 2 },
];
const colResult = classifyDrawingStroke(columnStroke, [], [], 'feet');
assert(colResult.classification === 'column', 'Detects compact square as structural column');
assert(colResult.suggestedAction.action === 'ADD_COLUMN', 'Generates ADD_COLUMN action');

// Staircase: multiple rapid inflections
const stairStroke: Point2D[] = [
  { x: 0, y: 0 }, { x: 3, y: 0 },
  { x: 0, y: 1 }, { x: 3, y: 1 },
  { x: 0, y: 2 }, { x: 3, y: 2 },
  { x: 0, y: 3 }, { x: 3, y: 3 },
  { x: 0, y: 4 }, { x: 3, y: 4 },
];
const stairResult = classifyDrawingStroke(stairStroke, [], [], 'feet');
assert(stairResult.classification === 'stair', 'Detects rapid zigzag inflections as staircase flight');

// ── 6. CONTROLLED ACTION ENGINE VALIDATION ──────────────────
console.log('\n6. Testing Controlled Action Engine Validation:');
// Valid wall
const validWallAction: ValidatedPlanAction = {
  action: 'ADD_WALL',
  payload: { x1: 0, y1: 0, x2: 12, y2: 0, thickness: 0.75, height: 10 },
  description: 'Test wall',
};
const v1 = validatePlanAction(validWallAction);
assert(v1.valid, 'Valid wall action passes schema validation');

// Invalid micro wall (< 0.05 units)
const invalidWallAction: ValidatedPlanAction = {
  action: 'ADD_WALL',
  payload: { x1: 0, y1: 0, x2: 0.01, y2: 0, thickness: 0.75, height: 10 },
  description: 'Micro stub',
};
const v2 = validatePlanAction(invalidWallAction);
assert(!v2.valid, 'Rejects zero / tiny micro-wall action safely');

// Negative room dimensions
const invalidRoomAction: ValidatedPlanAction = {
  action: 'ADD_ROOM',
  payload: { x: 0, y: 0, width: -10, height: 12 },
  description: 'Negative room',
};
const v3 = validatePlanAction(invalidRoomAction);
assert(!v3.valid, 'Rejects negative room dimensions');

// ── 7. NATURAL LANGUAGE COMMANDS & REFERENCE RESOLUTION ─────
console.log('\n7. Testing Natural Language Commands & Reference Resolution:');
const provider = new LocalFloorPlanAIProvider();

const mockRooms: FloorPlanRoom[] = [
  {
    id: 'r1',
    label: 'Room 1',
    roomType: 'Custom',
    x: 0, y: 0, width: 12, height: 14,
    area: 168, perimeter: 52, rotation: 0,
  },
  {
    id: 'r2',
    label: 'Room 2',
    roomType: 'Custom',
    x: 12, y: 0, width: 10, height: 10,
    area: 100, perimeter: 40, rotation: 0,
  },
];

const mockWalls: FloorPlanWall[] = [
  { id: 'w1', x1: 0, y1: 0, x2: 12, y2: 0, thickness: 0.75, height: 10, wallType: 'exterior' },
  { id: 'w2', x1: 12, y1: 0, x2: 12, y2: 14, thickness: 0.75, height: 10, wallType: 'interior' },
];

const contextWithSelection: PlanContext = {
  walls: mockWalls,
  rooms: mockRooms,
  doors: [],
  windows: [],
  selectedElement: { type: 'room', id: 'r1' },
  unit: 'feet',
};

async function testCommands() {
  // Command A: "Make this bedroom" on selected room
  const c1 = await provider.interpretCommand('Make this bedroom', contextWithSelection);
  assert(c1.success && c1.action?.action === 'UPDATE_ROOM', 'Interprets "Make this bedroom" with reference resolution');
  assert(c1.action?.property === 'roomType' && c1.action?.value === 'Bedroom', 'Resolves target property to Bedroom');

  // Command B: Tamil / Tanglish "kitchen mathu"
  const c2 = await provider.interpretCommand('kitchen mathu', contextWithSelection);
  assert(c2.success && c2.action?.value === 'Kitchen', 'Interprets Tanglish "kitchen mathu" to Kitchen');

  // Command C: "Make this wall 10 feet"
  const contextWallSelection: PlanContext = {
    ...contextWithSelection,
    selectedElement: { type: 'wall', id: 'w1' },
  };
  const c3 = await provider.interpretCommand('Make this wall 10 feet', contextWallSelection);
  assert(c3.success && c3.action?.action === 'UPDATE_WALL', 'Resizes selected wall to 10 feet');
  assert(c3.action?.payload.x2 === 10, 'Calculates correct new endpoint coordinate for 10 ft');

  // Command D: "How many rooms are there?"
  const c4 = await provider.interpretCommand('How many rooms are there?', contextWithSelection);
  assert(c4.success && c4.message.includes('2 rooms'), 'Reports accurate room count');

  // Command E: "Calculate total floor area"
  const c5 = await provider.interpretCommand('Calculate total floor area', contextWithSelection);
  assert(c5.success && c5.metricsReport !== undefined, 'Computes total gross floor area (268 sq.ft)');
  assert(c5.metricsReport?.grossFloorAreaSqUnits === 268, 'Exact calculated sum: 168 + 100 = 268 sq.ft');

  // Command F: "Switch to 3D"
  const c6 = await provider.interpretCommand('Switch to 3D', contextWithSelection);
  assert(c6.success && c6.action?.value === '3D', 'Executes SWITCH_VIEW to 3D');

  // Command G: "Fix my plan"
  const c7 = await provider.interpretCommand('Fix my plan', contextWithSelection);
  assert(c7.success && c7.diagnosticReport !== undefined, 'Triggers Fix My Plan diagnostic scanner');

  // Command H: Ambiguous room without selection prompts clarification
  const contextNoSelection: PlanContext = {
    ...contextWithSelection,
    selectedElement: null,
  };
  const c8 = await provider.interpretCommand('Make this kitchen', contextNoSelection);
  assert(!c8.success && c8.clarificationPrompt !== undefined, 'Asks user which room when ambiguous instead of guessing');
  assert(c8.clarificationPrompt?.options.length === 2, 'Lists all selectable candidate rooms');

  // ── 8. "FIX MY PLAN" DIAGNOSTIC SCANNER ───────────────────
  console.log('\n8. Testing "Fix My Plan" Diagnostic Scanner:');
  const openWallA: FloorPlanWall = { id: 'w-a', x1: 0, y1: 0, x2: 10, y2: 0, thickness: 0.75, height: 10, wallType: 'exterior' };
  const openWallB: FloorPlanWall = { id: 'w-b', x1: 10.8, y1: 0.1, x2: 10.8, y2: 10, thickness: 0.75, height: 10, wallType: 'exterior' };
  const issues = diagnosePlanIssues([openWallA, openWallB], [], [], [], 'feet');
  assert(issues.some(i => i.type === 'open_wall'), 'Detects open wall gap (0.8 ft gap)');

  // ── 9. "UNDERSTAND MY PLAN" GEOMETRIC METRICS ─────────────
  console.log('\n9. Testing "Understand My Plan" Real Metrics:');
  const report = analyzePlanMetrics(mockWalls, mockRooms, [], [], [], [], 'feet');
  assert(report.grossFloorAreaSqUnits === 268, 'Gross floor area matches real sum');
  assert(report.roomCount === 2, 'Room count is 2');
  assert(report.totalWallLength === 26, 'Linear wall length is 12 + 14 = 26 ft');

  // ── 10. "HELP ME DESIGN" PROPOSAL GENERATOR ───────────────
  console.log('\n10. Testing "Help Me Design" Proposed Layout:');
  const proposal = generateProposedLayout({
    plotWidth: 30,
    plotDepth: 40,
    unit: 'feet',
    bedrooms: 2,
    bathrooms: 2,
    facing: 'East',
    hasParking: true,
    hasPooja: true,
  });
  assert(proposal.walls.length >= 6, `Generates complete perimeter & interior walls (${proposal.walls.length} walls)`);
  assert(proposal.rooms.length >= 3, `Includes Living, Master Bedroom, Kitchen & Bedroom 2 (${proposal.rooms.length} rooms)`);
  assert(proposal.disclaimer.includes('AI-generated design suggestion'), 'Contains required architectural safety disclaimer');

  // ── SUMMARY ───────────────────────────────────────────────
  console.log('\n===============================================================');
  console.log(`TEST SUMMARY: ${passedTests} passed, ${failedTests} failed`);
  console.log('===============================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

testCommands();
