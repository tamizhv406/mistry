import React, { useState, useEffect, useLayoutEffect, useRef, useCallback, useReducer, useMemo } from 'react';
import { flushSync } from 'react-dom';
import {
  ArrowLeft, Save, Undo2, Redo2, ZoomIn, ZoomOut, Maximize2,
  Trash2, Copy, MousePointer2, Pencil, Square, DoorOpen, AppWindow,
  Eye, Download, Printer, Layers, RotateCcw, Move, ChevronDown,
  CheckCircle2, AlertCircle, Building2, PenTool, ScanLine, Box,
  Ruler, FileDown, Armchair, Columns, ChevronRight, History,
  Keyboard, Plus, Split, Palette, Sparkles, X, Info, Calculator,
  Compass, Lock, Unlock, RotateCw, ClipboardCopy, ClipboardPaste,
  Settings, FlipHorizontal, FlipVertical, FileCode, Check, Magnet, Hand,
  ChevronUp, GripHorizontal, SlidersHorizontal, Grid as GridIcon,
  MoreVertical, Shapes, Minus, Type, Image as ImageIcon,
  Maximize, Minimize, FilePlus, Edit, Bed, Sofa, Utensils, Bath, Zap,
  Eraser, Search, LocateFixed, LayoutGrid,
} from 'lucide-react';
import type {
  FloorPlan, FloorPlanWall, FloorPlanRoom, FloorPlanDoor, FloorPlanWindow,
  FloorPlanFurniture, FloorPlanStaircase, FloorPlanColumn, FloorPlanAnnotation,
  FloorPlanLevel, RoomType, DoorType, WindowType, FloorPlanUnit, User,
  FloorPlanLayerConfig, BackgroundPlanImage, RoomShapeType, StaircaseType,
} from '../db/types';
import {
  getFloorPlanById, updateFloorPlan, saveFloorPlanVersion, restoreFloorPlanVersion,
  exportFloorPlanAsDxf, exportFloorPlanAsProjectJson, createStarterFloorPlan,
  STARTER_TEMPLATES,
} from '../services/floorPlanService';
import type { FloorPlanStarterTemplate } from '../services/floorPlanService';
import {
  findSnapPoint, snapAngleOrtho, getWallLength, getWallAngleDeg,
  formatLength, formatArea, projectPointOntoWall, snapWallMountedItem,
  detectEnclosedRooms, WALL_THICKNESS_PRESETS_MM, mmToPlanUnits, planUnitsToMm,
  computeWallSegmentsWithOpenings, calculatePlanBoundingBox, findHostWallForOpening,
  ARCHITECTURAL_WINDOW_TYPES,
  generateLShapedRoom, generateUShapedRoom, generateTShapedRoom,
  computePolygonArea, computePolygonPerimeter,
  mirrorWall, mirrorOpening, mirrorRoom, mirrorFurniture,
} from '../services/geometryEngine';
import type { SnapPoint } from '../services/geometryEngine';
import { FloorPlan3DPreview } from '../components/FloorPlan3DPreview';
import { ArchitecturalSymbol } from '../components/visuals/ArchitecturalSymbols';
import { FloorPlanShapeLibrary } from '../components/FloorPlanShapeLibrary';
import {
  createEntityFromShape, recordRecentShape,
  saveCustomShape,
} from '../services/shapeLibraryCatalog';
import type { ShapeLibraryItem } from '../services/shapeLibraryCatalog';
import {
  analyzePlanGeometry,
  autoStraightenZigZagWalls,
  autoCloseIncompleteGaps,
  cleanupMicroStubs,
  autoHealAllAndGenerateRooms,
  parseAndExecuteCopilotCommand,
} from '../services/aiFloorPlanCopilot';
import type { GeometryHealthReport } from '../services/aiFloorPlanCopilot';
import {
  regularizeRoughWall,
  recognizeRoomPerimeter,
  classifySketchStroke,
} from '../services/aiSketchRecognition';
import type { Point2D } from '../services/aiSketchRecognition';
import { AIAssistantPanel } from '../components/AIAssistantPanel';
import { PlanDiagnosticModal } from '../components/PlanDiagnosticModal';
import { PlanAnalysisModal } from '../components/PlanAnalysisModal';
import { HelpMeDesignModal } from '../components/HelpMeDesignModal';
import {
  classifyDrawingStroke,
  validatePlanAction,
  diagnosePlanIssues,
  analyzePlanMetrics,
} from '../services/aiFloorPlanEngine';
import type {
  StrokeClassification,
  PlanDiagnosticIssue,
  PlanAnalysisReport,
  ProposedLayoutResult,
  ValidatedPlanAction,
} from '../services/aiFloorPlanEngine';
import type { PlanContext } from '../services/aiProvider';


import {
  PlanHistory, PLAN_DISCLAIMER, PLAN_REVIEW_NOTE, addFloor, buildSavePayload, deleteFloor, duplicateFloor, exportPlan, levelToState, loadFloors,
  normaliseFloor, prepareForWallEdit, renameFloor, suggestFloorName, switchFloor, validateFloorName, type FloorsView,
} from '../domain/planDocument';
import {
  areaToSqFt, baseUnitOf, fitOpeningOnWall, formatPlanArea, joinTolerance, moveJoint, openingOverlaps, planToMm, pointInPolygon, roomArea, roomPerimeter,
  translateWall,
} from '../domain/planGeometry';
import {
  DEFAULT_SNAP_ANGLES, ORTHO_SNAP_ANGLES, describeSketch, directionDeg, interpretStroke, pointSegmentDistance, snapDirection, trimNewWall,
  type SketchOptions, type SketchResult,
} from '../domain/planSketch';
import {
  PX_PER_UNIT, defaultGridStep, defaultWallThickness, endToKeep, formatAreaShort, formatDimension, formatLengthForInput, formatThickness,
  gridStepOptions, layoutDimension, outsideNormal, parseLengthInput, parseThicknessInput, pixelsToPlan, resizeWall, roomInterior,
  roomOutline, wallThicknessPresets, formatOtherUnits, type RoomInterior,
} from '../domain/planMeasure';
import {
  applyAlignmentFix, deleteRoom, eraseWallSegment, findAlignmentIssues, formatMm, resizeRoom, roomBox, splitWall, splitWallAtJunctions, wallJunctions,
  wallSegmentAt, type AlignmentIssue, type EditResult, type NewId,
} from '../domain/planEdit';
import { MistryAiSheet } from '../components/MistryAiSheet';
import { ConfirmSheet, Field, Note, Segmented, Sheet } from '../components/mobile/kit';

// ─────────────────────────────────────────────────────────
// Constants & Catalogs
// ─────────────────────────────────────────────────────────

// Screen pixels per plan unit at 100% zoom. Zoom and pan only change the view: stored
// coordinates stay in feet or metres (see src/domain/planGeometry.ts).
const GRID_SIZE_PX = PX_PER_UNIT;
const MIN_ZOOM = 0.2;
const MAX_ZOOM = 4;
const SNAP_THRESHOLD = 0.5;
const WALL_THICKNESS_DEFAULT = 0.75; // ft or m
const WALL_HEIGHT_DEFAULT = 10;
const UNDO_HISTORY_LIMIT = 50;

/** Every room is drawn with this one light fill (design system: rgba(248, 250, 252, 0.85)). */
const ROOM_FILL = 'rgba(248, 250, 252, 0.85)';

const ROOM_COLORS: Record<RoomType, string> = {
  'Living Room': 'rgba(251,191,36,0.18)',
  'Master Bedroom': 'rgba(147,197,253,0.22)',
  'Bedroom': 'rgba(96,165,250,0.18)',
  'Guest Room': 'rgba(165,180,252,0.18)',
  'Kids Room': 'rgba(244,114,182,0.18)',
  'Kitchen': 'rgba(52,211,153,0.18)',
  'Dining': 'rgba(100, 116, 139,0.18)',
  'Bathroom': 'rgba(129,140,248,0.18)',
  'Toilet': 'rgba(167,139,250,0.18)',
  'Utility': 'rgba(156,163,175,0.18)',
  'Balcony': 'rgba(34,197,94,0.18)',
  'Store': 'rgba(180,83,9,0.18)',
  'Store Room': 'rgba(180,83,9,0.18)',
  'Staircase': 'rgba(234,179,8,0.18)',
  'Parking': 'rgba(100,116,139,0.18)',
  'Garage': 'rgba(71,85,105,0.18)',
  'Study': 'rgba(14,165,233,0.18)',
  'Office': 'rgba(56,189,248,0.18)',
  'Pooja': 'rgba(239,68,68,0.18)',
  'Prayer Room': 'rgba(239,68,68,0.18)',
  'Corridor': 'rgba(203,213,225,0.18)',
  'Terrace': 'rgba(45,212,191,0.18)',
  'Custom': 'rgba(148,163,184,0.18)',
};

const ROOM_TYPES: RoomType[] = [
  'Living Room', 'Master Bedroom', 'Bedroom', 'Guest Room', 'Kids Room',
  'Kitchen', 'Dining', 'Bathroom', 'Toilet', 'Utility', 'Balcony',
  'Store Room', 'Staircase', 'Parking', 'Garage', 'Study', 'Office',
  'Prayer Room', 'Pooja', 'Store', 'Corridor', 'Terrace', 'Custom',
];

const DOOR_TYPES: DoorType[] = [
  'Single', 'Double', 'Main Entrance', 'Sliding', 'Pocket', 'Bathroom', 'Balcony', 'French', 'Opening',
];

const WINDOW_TYPES: WindowType[] = [
  'Single Window', 'Double Window', 'Sliding Window', 'Large Window',
  'Bay Window', 'Corner Window', 'Fixed Window', 'Ventilator', 'Standard',
];

interface FurnitureCatalogItem {
  itemType: string;
  label: string;
  category: 'bedroom' | 'living' | 'dining' | 'kitchen' | 'bathroom' | 'utility' | 'outdoor';
  width: number; // in feet
  height: number; // in feet
}

const FURNITURE_CATALOG: FurnitureCatalogItem[] = [
  // Bedroom
  { itemType: 'Single Bed', label: 'Single Bed (3×6.5 ft)', category: 'bedroom', width: 3, height: 6.5 },
  { itemType: 'Double Bed', label: 'Double Bed (5×6.5 ft)', category: 'bedroom', width: 5, height: 6.5 },
  { itemType: 'King Bed', label: 'King Bed (6×6.5 ft)', category: 'bedroom', width: 6, height: 6.5 },
  { itemType: 'Wardrobe', label: 'Wardrobe (4×2 ft)', category: 'bedroom', width: 4, height: 2 },

  // Living
  { itemType: '1-Seater Sofa', label: 'Armchair (3×3 ft)', category: 'living', width: 3, height: 3 },
  { itemType: '2-Seater Sofa', label: '2-Seater Sofa (5×3 ft)', category: 'living', width: 5, height: 3 },
  { itemType: '3-Seater Sofa', label: '3-Seater Sofa (7×3 ft)', category: 'living', width: 7, height: 3 },
  { itemType: 'Coffee Table', label: 'Coffee Table (3.5×2 ft)', category: 'living', width: 3.5, height: 2 },
  { itemType: 'TV Unit', label: 'TV Console (4.5×1.5 ft)', category: 'living', width: 4.5, height: 1.5 },

  // Dining & Study
  { itemType: 'Dining Table 4', label: 'Dining Table 4-Seat (3.5×3.5 ft)', category: 'dining', width: 3.5, height: 3.5 },
  { itemType: 'Dining Table 6', label: 'Dining Table 6-Seat (5.5×3.5 ft)', category: 'dining', width: 5.5, height: 3.5 },
  { itemType: 'Study Desk', label: 'Study / Work Desk (4×2 ft)', category: 'dining', width: 4, height: 2 },
  { itemType: 'Office Chair', label: 'Desk Chair (2×2 ft)', category: 'dining', width: 2, height: 2 },

  // Kitchen
  { itemType: 'Kitchen Counter', label: 'Countertop (6×2 ft)', category: 'kitchen', width: 6, height: 2 },
  { itemType: 'Kitchen Sink', label: 'Kitchen Sink (3×2 ft)', category: 'kitchen', width: 3, height: 2 },
  { itemType: 'Gas Stove / Cooktop', label: 'Gas Stove / Hob (2.5×2 ft)', category: 'kitchen', width: 2.5, height: 2 },
  { itemType: 'Refrigerator', label: 'Refrigerator (2.5×2.5 ft)', category: 'kitchen', width: 2.5, height: 2.5 },

  // Bathroom
  { itemType: 'WC / Toilet', label: 'Commode / WC (2×2.5 ft)', category: 'bathroom', width: 2, height: 2.5 },
  { itemType: 'Wash Basin', label: 'Wash Basin (2×1.5 ft)', category: 'bathroom', width: 2, height: 1.5 },
  { itemType: 'Shower Cubicle', label: 'Shower Enclosure (3×3 ft)', category: 'bathroom', width: 3, height: 3 },
  { itemType: 'Bathtub', label: 'Bathtub (5×2.5 ft)', category: 'bathroom', width: 5, height: 2.5 },

  // Utility & Outdoor
  { itemType: 'Washing Machine', label: 'Washing Machine (2×2 ft)', category: 'utility', width: 2, height: 2 },
  { itemType: 'Car Parking', label: 'Car Parking Bay (16×8 ft)', category: 'outdoor', width: 8, height: 16 },
];

type Tool =
  | 'select'
  | 'wall'
  | 'room'
  | 'door'
  | 'window'
  | 'column'
  | 'stairs'
  | 'furniture'
  | 'dimension'
  | 'annotation'
  | 'pan'
  | 'measure'
  | 'ai_draw'
  | 'eraser'
  | 'split';

type ViewMode = 'design' | 'blueprint' | 'presentation';

type SelectedElement =
  | { type: 'wall'; id: string }
  | { type: 'room'; id: string }
  | { type: 'door'; id: string }
  | { type: 'window'; id: string }
  | { type: 'column'; id: string }
  | { type: 'stairs'; id: string }
  | { type: 'furniture'; id: string }
  | { type: 'annotation'; id: string }
  | null;

interface EditorState {
  walls: FloorPlanWall[];
  rooms: FloorPlanRoom[];
  doors: FloorPlanDoor[];
  windows: FloorPlanWindow[];
  furniture: FloorPlanFurniture[];
  stairs: FloorPlanStaircase[];
  columns: FloorPlanColumn[];
  annotations: FloorPlanAnnotation[];
}

type EditorAction =
  | { type: 'SET_STATE'; payload: EditorState }
  | { type: 'SET_WALLS'; walls: FloorPlanWall[] }
  | { type: 'ADD_WALL'; payload: FloorPlanWall }
  | { type: 'UPDATE_WALL'; id: string; changes: Partial<FloorPlanWall> }
  | { type: 'DELETE_WALL'; id: string }
  | { type: 'ADD_ROOM'; payload: FloorPlanRoom }
  | { type: 'UPDATE_ROOM'; id: string; changes: Partial<FloorPlanRoom> }
  | { type: 'DELETE_ROOM'; id: string }
  | { type: 'ADD_DOOR'; payload: FloorPlanDoor }
  | { type: 'UPDATE_DOOR'; id: string; changes: Partial<FloorPlanDoor> }
  | { type: 'DELETE_DOOR'; id: string }
  | { type: 'ADD_WINDOW'; payload: FloorPlanWindow }
  | { type: 'UPDATE_WINDOW'; id: string; changes: Partial<FloorPlanWindow> }
  | { type: 'DELETE_WINDOW'; id: string }
  | { type: 'ADD_COLUMN'; payload: FloorPlanColumn }
  | { type: 'UPDATE_COLUMN'; id: string; changes: Partial<FloorPlanColumn> }
  | { type: 'DELETE_COLUMN'; id: string }
  | { type: 'ADD_STAIRS'; payload: FloorPlanStaircase }
  | { type: 'UPDATE_STAIRS'; id: string; changes: Partial<FloorPlanStaircase> }
  | { type: 'DELETE_STAIRS'; id: string }
  | { type: 'ADD_FURNITURE'; payload: FloorPlanFurniture }
  | { type: 'UPDATE_FURNITURE'; id: string; changes: Partial<FloorPlanFurniture> }
  | { type: 'DELETE_FURNITURE'; id: string }
  | { type: 'ADD_ANNOTATION'; payload: FloorPlanAnnotation }
  | { type: 'UPDATE_ANNOTATION'; id: string; changes: Partial<FloorPlanAnnotation> }
  | { type: 'DELETE_ANNOTATION'; id: string };

function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case 'SET_STATE':
      return action.payload;
    case 'SET_WALLS':
      return { ...state, walls: action.walls };
    case 'ADD_WALL':
      return { ...state, walls: [...state.walls, action.payload] };
    case 'UPDATE_WALL':
      return { ...state, walls: state.walls.map(w => w.id === action.id ? { ...w, ...action.changes } : w) };
    case 'DELETE_WALL':
      return { ...state, walls: state.walls.filter(w => w.id !== action.id) };
    case 'ADD_ROOM':
      return { ...state, rooms: [...state.rooms, action.payload] };
    case 'UPDATE_ROOM':
      return { ...state, rooms: state.rooms.map(r => r.id === action.id ? { ...r, ...action.changes } : r) };
    case 'DELETE_ROOM':
      return { ...state, rooms: state.rooms.filter(r => r.id !== action.id) };
    case 'ADD_DOOR':
      return { ...state, doors: [...state.doors, action.payload] };
    case 'UPDATE_DOOR':
      return { ...state, doors: state.doors.map(d => d.id === action.id ? { ...d, ...action.changes } : d) };
    case 'DELETE_DOOR':
      return { ...state, doors: state.doors.filter(d => d.id !== action.id) };
    case 'ADD_WINDOW':
      return { ...state, windows: [...state.windows, action.payload] };
    case 'UPDATE_WINDOW':
      return { ...state, windows: state.windows.map(w => w.id === action.id ? { ...w, ...action.changes } : w) };
    case 'DELETE_WINDOW':
      return { ...state, windows: state.windows.filter(w => w.id !== action.id) };
    case 'ADD_COLUMN':
      return { ...state, columns: [...state.columns, action.payload] };
    case 'UPDATE_COLUMN':
      return { ...state, columns: state.columns.map(c => c.id === action.id ? { ...c, ...action.changes } : c) };
    case 'DELETE_COLUMN':
      return { ...state, columns: state.columns.filter(c => c.id !== action.id) };
    case 'ADD_STAIRS':
      return { ...state, stairs: [...state.stairs, action.payload] };
    case 'UPDATE_STAIRS':
      return { ...state, stairs: state.stairs.map(s => s.id === action.id ? { ...s, ...action.changes } : s) };
    case 'DELETE_STAIRS':
      return { ...state, stairs: state.stairs.filter(s => s.id !== action.id) };
    case 'ADD_FURNITURE':
      return { ...state, furniture: [...state.furniture, action.payload] };
    case 'UPDATE_FURNITURE':
      return { ...state, furniture: state.furniture.map(f => f.id === action.id ? { ...f, ...action.changes } : f) };
    case 'DELETE_FURNITURE':
      return { ...state, furniture: state.furniture.filter(f => f.id !== action.id) };
    case 'ADD_ANNOTATION':
      return { ...state, annotations: [...state.annotations, action.payload] };
    case 'UPDATE_ANNOTATION':
      return { ...state, annotations: state.annotations.map(a => a.id === action.id ? { ...a, ...action.changes } : a) };
    case 'DELETE_ANNOTATION':
      return { ...state, annotations: state.annotations.filter(a => a.id !== action.id) };
    default:
      return state;
  }
}

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

const WALL_ACTIONS = new Set<EditorAction['type']>(['ADD_WALL', 'UPDATE_WALL', 'DELETE_WALL', 'SET_WALLS']);

/**
 * Applies an edit and, when walls changed, brings the floor back to a consistent state:
 * rooms enclosed by walls are recalculated and doors/windows stay on (or go with) their wall.
 */
function reducePlan(state: EditorState, action: EditorAction, unit: FloorPlanUnit): EditorState {
  if (!WALL_ACTIONS.has(action.type)) return editorReducer(state, action);
  // Rooms that already match their walls (older plans) are tied to them first, so they
  // follow this edit instead of being left behind at their old size.
  const next = editorReducer(prepareForWallEdit(state, unit), action);
  return normaliseFloor(next, unit, () => uid('room')).state;
}

function roundToStep(val: number, step: number): number {
  return step > 0 ? Math.round(val / step) * step : val;
}

/** Removes floating-point fuzz (11.999999999998 -> 12) without rounding any real measurement. */
const tidy = (v: number) => Math.round(v * 1e9) / 1e9;

// First-use tips, one per tool. Each is shown once per browser and never again after "Got it".
const TOOL_HINTS: Record<string, string> = {
  start: 'Pick Wall to begin. Sketch draws a whole room in one stroke; Straight draws one exact wall at a time.',
  select: 'Tap a wall to select it. Drag a round handle to resize it, or tap a red measurement to type an exact length.',
  wall: 'Drag to draw a straight wall, or tap its two ends. Switch to Sketch to draw a whole room in one go. Two fingers move and zoom.',
  ai_draw: 'Draw the room outline in one stroke. It is straightened and joined as you draw. Two fingers move and zoom.',
  door: 'Tap on a wall to place a door there.',
  window: 'Tap on a wall to place a window there.',
  room: 'Tap where the room should go. Closing a loop of walls also makes a room.',
  measure: 'Tap two points to measure the distance between them.',
  eraser: 'Tap a wall to erase only the part under your finger, up to the next joint.',
  split: 'Tap a wall where it should be cut. Each part can then be moved, sized or erased on its own.',
};

function getLiveToolHint(tool: Tool): string {
  switch (tool) {
    case 'select':
      return 'Select Tool: Tap any wall, room, door, or item to move, resize, rotate, or delete.';
    case 'pan':
      return 'Pan Tool: Drag anywhere to move canvas. Hold Space or right-click drag anytime.';
    case 'wall':
      return 'Wall Tool: Click & drag to draw straight walls. Snaps at 90° and 45° automatically.';
    case 'ai_draw':
      return 'Sketch Tool: Draw a rough continuous outline. Auto-straightens and welds closed loops.';
    case 'eraser':
      return 'Eraser: tap a wall to erase only that part, up to the next joint. Tap a door, window or item to remove it.';
    case 'split':
      return 'Split: tap a wall where it should be cut into two walls.';
    case 'door':
      return 'Door Tool: Tap on any wall segment to place an architectural door.';
    case 'window':
      return 'Window Tool: Tap on any wall segment to place an architectural window.';
    case 'room':
      return 'Room Tool: Tap to place a room or close 4 walls to auto-generate an enclosed room.';
    case 'furniture':
      return 'Furniture Tool: Select items from library catalog and tap on canvas to place.';
    case 'column':
      return 'Column Tool: Tap anywhere on canvas to position a structural column/pillar.';
    case 'stairs':
      return 'Stairs Tool: Tap anywhere on canvas to place a staircase.';
    case 'measure':
      return 'Measure Tool: Tap two points on canvas to measure exact distance and angle.';
    case 'annotation':
      return 'Note Tool: Tap anywhere on canvas to place a custom text label or callout note.';
    default:
      return 'Click on canvas to draw or place elements.';
  }
}
const HINTS_KEY = 'bm_fp_hints_seen';

function readSetting(key: string, fallback: string): string {
  try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
}
function writeSetting(key: string, value: string): void {
  try { localStorage.setItem(key, value); } catch { /* private mode: the setting lasts for this visit only */ }
}

function formatDim(val: number, unit: FloorPlanUnit): string {
  if (unit === 'feet') {
    const totalInches = Math.round(val * 12);
    const feet = Math.floor(totalInches / 12);
    const inches = totalInches % 12;
    if (inches === 0) return `${feet} ft`;
    return `${feet} ft ${inches} in`;
  } else if (unit === 'inches') {
    return `${Math.round(val * 12)} in`;
  } else if (unit === 'centimeters') {
    return `${Math.round(val * 100)} cm`;
  }
  return `${val.toFixed(2)} m`;
}

function wallLength(w: FloorPlanWall): number {
  return Math.sqrt((w.x2 - w.x1) ** 2 + (w.y2 - w.y1) ** 2);
}

// Coordinates are in feet (feet/inches plans) or metres (metre/centimetre plans), so the
// outline area is already in sq.ft or sq.m. It is the area of the outline as drawn.
function computeRoomArea(r: FloorPlanRoom, unit: FloorPlanUnit): string {
  const area = roomArea(r);
  return baseUnitOf(unit) === 'feet' ? `${area.toFixed(1)} sq.ft` : `${area.toFixed(2)} sq.m`;
}

function computeRoomPerimeter(r: FloorPlanRoom, unit: FloorPlanUnit): string {
  const perimeter = roomPerimeter(r);
  if (unit === 'feet') return `${perimeter.toFixed(1)} ft`;
  if (unit === 'inches') return `${(perimeter * 12).toFixed(1)} in`;
  if (unit === 'centimeters') return `${(perimeter * 100).toFixed(0)} cm`;
  return `${perimeter.toFixed(2)} m`;
}

// ─────────────────────────────────────────────────────────
// FloorPlanEditorView Component
// ─────────────────────────────────────────────────────────

interface FloorPlanEditorViewProps {
  planId: string;
  user: User;
  onBack: () => void;
  onBackToSite?: (siteId: string) => void;
  onNotify: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onOpenEstimator?: (areaSqFt: number) => void;
}

export const FloorPlanEditorView: React.FC<FloorPlanEditorViewProps> = ({
  planId,
  user,
  onBack,
  onBackToSite,
  onNotify,
  onOpenEstimator,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [plan, setPlan] = useState<FloorPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'unsaved' | 'saving'>('saved');
  const unit: FloorPlanUnit = plan?.unit || 'feet';

  // Multi-floor levels
  const [floorLevels, setFloorLevels] = useState<FloorPlanLevel[]>([]);
  const [activeFloorIndex, setActiveFloorIndex] = useState(0);

  // Editor state with undo/redo
  const planReducer = useCallback((s: EditorState, a: EditorAction) => reducePlan(s, a, unit), [unit]);
  const [editorState, dispatch] = useReducer(planReducer, {
    walls: [], rooms: [], doors: [], windows: [],
    furniture: [], stairs: [], columns: [], annotations: [],
  });
  // Undo history is kept per floor, so undo can never bring one floor's drawing into another.
  const historyRef = useRef(new PlanHistory(UNDO_HISTORY_LIMIT));
  const activeFloorIdRef = useRef('level-ground');
  const [, setHistoryTick] = useState(0);
  const canUndo = historyRef.current.canUndo(activeFloorIdRef.current);
  const canRedo = historyRef.current.canRedo(activeFloorIdRef.current);
  // Latest values for code that runs outside the render that created it (autosave, unload).
  const latestRef = useRef<{ plan: FloorPlan | null; floors: FloorPlanLevel[]; activeIndex: number; state: EditorState; dirty: boolean }>({
    plan: null, floors: [], activeIndex: 0, state: editorState, dirty: false,
  });
  const [floorDialog, setFloorDialog] = useState<{ mode: 'add' | 'duplicate' | 'rename'; value: string; error: string } | null>(null);
  const [confirmDeleteFloor, setConfirmDeleteFloor] = useState(false);

  // Tools & View Modes
  const [activeTool, setActiveTool] = useState<Tool>('select');
  const [selectedElement, setSelectedElement] = useState<SelectedElement>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('design');
  const [showGrid, setShowGrid] = useState(true);
  const [showDimensions, setShowDimensions] = useState(true);
  const [show3D, setShow3D] = useState(false);

  // Shape Library & Clipboard State
  const [isShapeLibraryOpen, setIsShapeLibraryOpen] = useState(false);
  const [showZoomDropdown, setShowZoomDropdown] = useState(false);
  const [clipboardElement, setClipboardElement] = useState<{ type: string; data: any } | null>(null);

  // Modals & Panels
  const [showFurnitureModal, setShowFurnitureModal] = useState(false);
  const [furnitureCategory, setFurnitureCategory] = useState<string>('all');
  const [selectedFurnitureToPlace, setSelectedFurnitureToPlace] = useState<FurnitureCatalogItem | null>(null);

  const [showEstimationModal, setShowEstimationModal] = useState(false);
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);
  const [showVersionModal, setShowVersionModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [versionNote, setVersionNote] = useState('');

  // AI Floor Plan Copilot State ("pakkavana oru AI assistant venu")
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);
  const [copilotPrompt, setCopilotPrompt] = useState('');
  const [copilotLoading, setCopilotLoading] = useState(false);
  const [copilotLastMessage, setCopilotLastMessage] = useState<string | null>(null);

  // Live Geometry Diagnostics (tracks zig-zag walls, open line gaps, micro stubs)
  const geometryReport: GeometryHealthReport = useMemo(() => {
    return analyzePlanGeometry(editorState.walls, editorState.rooms, unit);
  }, [editorState.walls, editorState.rooms, unit]);

  // Which side of each wall its dimension line is drawn on: outside the room it encloses.
  const wallOutside = useMemo(() => {
    const sides = new Map<string, { x: number; y: number }>();
    const walls = editorState.walls;
    if (walls.length === 0) return sides;
    const xs = walls.flatMap(w => [w.x1, w.x2]);
    const ys = walls.flatMap(w => [w.y1, w.y2]);
    const centre = { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 };
    const probe = baseUnitOf(unit) === 'feet' ? 0.5 : 0.15;
    for (const w of walls) sides.set(w.id, outsideNormal(w, editorState.rooms, centre, probe));
    return sides;
  }, [editorState.walls, editorState.rooms, unit]);

  // Walls with a room on both sides. Their length label would sit in the middle of a room,
  // over the room's name, so by default it is drawn a little towards one end instead.
  const wallsBetweenRooms = useMemo(() => {
    const between = new Set<string>();
    const probe = baseUnitOf(unit) === 'feet' ? 0.5 : 0.15;
    for (const w of editorState.walls) {
      const len = Math.hypot(w.x2 - w.x1, w.y2 - w.y1);
      if (!(len > 0)) continue;
      const n = { x: -(w.y2 - w.y1) / len, y: (w.x2 - w.x1) / len };
      const mid = { x: (w.x1 + w.x2) / 2, y: (w.y1 + w.y2) / 2 };
      const reach = (w.thickness || 0) / 2 + probe;
      const inRoom = (s: number) => editorState.rooms.some(r => pointInPolygon({ x: mid.x + n.x * reach * s, y: mid.y + n.y * reach * s }, roomOutline(r)));
      if (inRoom(1) && inRoom(-1)) between.add(w.id);
    }
    return between;
  }, [editorState.walls, editorState.rooms, unit]);

  // Clear size of each wall-enclosed room, between the inner wall faces. Derived from the
  // walls on every change; never stored.
  const roomInteriors = useMemo(() => {
    const inside = new Map<string, RoomInterior>();
    for (const r of editorState.rooms) {
      if (!r.fromWalls) continue;
      const inner = roomInterior(r, editorState.walls, joinTolerance(unit));
      if (inner) inside.set(r.id, inner);
    }
    return inside;
  }, [editorState.walls, editorState.rooms, unit]);

  // AI Real-Time Sketch & Live Assist State ("user summa line draw panna athe understand panna purinjiganu")
  const [isAiLiveAssistActive, setIsAiLiveAssistActive] = useState(false);
  const [aiLiveFeedback, setAiLiveFeedback] = useState<{ message: string; timestamp: number } | null>(null);
  const [freehandPoints, setFreehandPoints] = useState<Point2D[]>([]);
  const [isFreehandDrawing, setIsFreehandDrawing] = useState(false);

  // Sketch mode of the Wall tool: one rough stroke becomes straight, joined walls.
  //   sketchPreview  - what the stroke would become, redrawn while the finger moves
  //   sketchProposal - a result with a large correction, waiting for the user to accept it
  //   sketchNotice   - what was just added, with an Undo button
  const freehandRef = useRef<Point2D[]>([]);
  const [sketchPreview, setSketchPreview] = useState<SketchResult | null>(null);
  const [sketchProposal, setSketchProposal] = useState<{ result: SketchResult; points: Point2D[] } | null>(null);
  const [sketchNotice, setSketchNotice] = useState<string | null>(null);
  const [sketchAngles, setSketchAngles] = useState<'45' | '90' | 'free'>(() => {
    const saved = readSetting('bm_fp_sketch_angles', '45');
    return saved === '90' || saved === 'free' ? saved : '45';
  });
  // The wall mode last used, so the Wall button returns to it.
  const [wallMode, setWallMode] = useState<'wall' | 'ai_draw'>(() => (readSetting('bm_fp_wall_mode', 'wall') === 'ai_draw' ? 'ai_draw' : 'wall'));

  useEffect(() => {
    if (!sketchNotice) return;
    const timer = setTimeout(() => setSketchNotice(null), 6000);
    return () => clearTimeout(timer);
  }, [sketchNotice]);

  // Typing an exact size for a wall (opened by tapping its measurement).
  const [wallEdit, setWallEdit] = useState<{
    wallId: string; length: string; length0: string; thickness: string; thickness0: string;
    x: string; x0: string; y: string; y0: string; keep: 'start' | 'end'; error: string;
  } | null>(null);
  const dimHitRef = useRef<string | null>(null);
  const openWallEditRef = useRef<(wallId: string) => void>(() => {});

  // Where the selected wall was last tapped: Split and "Erase part" act there.
  const [wallTap, setWallTap] = useState<{ id: string; point: { x: number; y: number } } | null>(null);
  // A measurement label being dragged to a clearer spot (display only, see FloorPlanWall).
  const [dimDrag, setDimDrag] = useState<{ wallId: string; offset: number; shift: number } | null>(null);
  const dimDragRef = useRef<{ wallId: string; startX: number; startY: number; offset0: number; shift0: number; normal: { x: number; y: number }; dir: { x: number; y: number } } | null>(null);
  // Measurement check: small differences between measurements that should match.
  const [showChecks, setShowChecks] = useState(false);
  const [ignoredChecks, setIgnoredChecks] = useState<string[]>([]);
  // Tutorials and first-use tips stay hidden unless the user turns them on (Settings).
  const [showTips, setShowTips] = useState<boolean>(() => readSetting('bm_fp_show_tips', '0') === '1');
  const [isMistryAiOpen, setIsMistryAiOpen] = useState(false);
  const [aiPreview, setAiPreview] = useState<EditorState | null>(null);
  const alignmentIssues = useMemo(
    () => findAlignmentIssues(editorState.walls, unit).filter(i => !ignoredChecks.includes(i.id)),
    [editorState.walls, unit, ignoredChecks]
  );

  // Size of the measurement text on the plan. A view setting: it never changes a length.
  const [dimTextScale, setDimTextScale] = useState<number>(() => {
    const saved = Number(readSetting('bm_fp_dim_text', '1'));
    return [0.85, 1, 1.25, 1.5].includes(saved) ? saved : 1;
  });

  const [showHelpSheet, setShowHelpSheet] = useState(false);
  const [seenHints, setSeenHints] = useState<string[]>(() => {
    try {
      const saved = JSON.parse(readSetting(HINTS_KEY, '[]'));
      return Array.isArray(saved) ? saved.filter(x => typeof x === 'string') : [];
    } catch {
      return [];
    }
  });
  const dismissHint = useCallback((key: string) => {
    setSeenHints(prev => {
      if (prev.includes(key)) return prev;
      const next = [...prev, key];
      writeSetting(HINTS_KEY, JSON.stringify(next));
      return next;
    });
  }, []);
  // A tip has done its job once its tool has been used: the first change made with a tool
  // retires that tool's tip, and picking any tool retires the "where to start" tip.
  const hintWatchRef = useRef({ tool: activeTool, state: editorState, loading });
  useEffect(() => {
    const prev = hintWatchRef.current;
    hintWatchRef.current = { tool: activeTool, state: editorState, loading };
    if (loading || prev.loading) return;
    if (prev.tool !== activeTool) dismissHint('start');
    else if (prev.state !== editorState && TOOL_HINTS[activeTool]) dismissHint(activeTool);
  }, [activeTool, editorState, loading, dismissHint]);

  const triggerAiFeedback = useCallback((msg: string) => {
    setAiLiveFeedback({ message: msg, timestamp: Date.now() });
  }, []);

  useEffect(() => {
    if (!aiLiveFeedback) return;
    const timer = setTimeout(() => {
      setAiLiveFeedback(null);
    }, 3500);
    return () => clearTimeout(timer);
  }, [aiLiveFeedback]);

  // AI Floor Plan Assistant & Interpretation Engine ("Building Mistry AI")
  const [isAiAssistantOpen, setIsAiAssistantOpen] = useState(false);
  const [pendingClassification, setPendingClassification] = useState<StrokeClassification | null>(null);
  const [isFixPlanModalOpen, setIsFixPlanModalOpen] = useState(false);
  const [diagnosticIssues, setDiagnosticIssues] = useState<PlanDiagnosticIssue[]>([]);
  const [isAnalyzePlanModalOpen, setIsAnalyzePlanModalOpen] = useState(false);
  const [analysisReport, setAnalysisReport] = useState<PlanAnalysisReport | null>(null);
  const [isDesignModalOpen, setIsDesignModalOpen] = useState(false);

  // Planner 5D Direct Dimension & Room Schedule State
  const [showRoomScheduleModal, setShowRoomScheduleModal] = useState(false);
  const [showAddRoomModal, setShowAddRoomModal] = useState(false);
  const [draftRoomWidth, setDraftRoomWidth] = useState<number>(() => unit === 'feet' ? 14 : 4.5);
  const [draftRoomHeight, setDraftRoomHeight] = useState<number>(() => unit === 'feet' ? 12 : 3.5);
  const [draftRoomType, setDraftRoomType] = useState<RoomType>('Living Room');
  const [draftRoomThickness, setDraftRoomThickness] = useState<number>(() => unit === 'feet' ? 0.75 : 0.23);
  const [draftRoomFloorFinish, setDraftRoomFloorFinish] = useState<string>('Wood Parquet');

  // Mobile-First CAD Workspace State (< 768px)
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' ? window.innerWidth <= 768 : false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showMobileShapes, setShowMobileShapes] = useState(false);
  const [showMobileMoreTools, setShowMobileMoreTools] = useState(false);
  const [showMobileDetails, setShowMobileDetails] = useState(false);
  const [showMobileProperties, setShowMobileProperties] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // ── Desktop Professional CAD Engine & States ──────
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showFloorMenu, setShowFloorMenu] = useState(false);
  type DesktopCategory = 'STRUCTURE' | 'OPENINGS' | 'FURNITURE' | 'ELECTRICAL' | 'ANNOTATION' | 'TOOLS';
  const [activeDesktopCategory, setActiveDesktopCategory] = useState<DesktopCategory | null>('STRUCTURE');

  // Interactive Measurement Tape Tool
  const [measureStart, setMeasureStart] = useState<{ x: number; y: number } | null>(null);
  const [measureCurrent, setMeasureCurrent] = useState<{ x: number; y: number } | null>(null);
  const [isMeasuring, setIsMeasuring] = useState(false);

  // Background Reference Image State
  const [showBgImageModal, setShowBgImageModal] = useState(false);
  const [bgImageScaleW, setBgImageScaleW] = useState<number>(30);
  const [bgImageScaleH, setBgImageScaleH] = useState<number>(40);
  const [bgImageOpacity, setBgImageOpacity] = useState<number>(0.5);

  // Usability Enhancement States (Priorities 1 - 5)
  const [dismissedStartCard, setDismissedStartCard] = useState(false);
  const [showStarterTemplatesModal, setShowStarterTemplatesModal] = useState(false);
  const [showGuidedChecklist, setShowGuidedChecklist] = useState(false);
  const [mobileToolSearch, setMobileToolSearch] = useState('');
  const [diagnosticBeacon, setDiagnosticBeacon] = useState<{ x: number; y: number; title: string; id: string } | null>(null);
  const [editingRoomInlineId, setEditingRoomInlineId] = useState<string | null>(null);

  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const handleToggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen?.().then(() => setIsFullscreen(false)).catch(() => {});
    }
  }, []);

  // Floating Bottom Property Dock Controls ("work pannu mothu disturb pannuthu itha yethna pannu")
  const [isBottomDockMinimized, setIsBottomDockMinimized] = useState<boolean>(() => {
    return localStorage.getItem('bm_fp_dock_minimized') === 'true';
  });
  const [showBottomDock, setShowBottomDock] = useState<boolean>(() => {
    const saved = localStorage.getItem('bm_fp_show_bottom_dock');
    return saved !== null ? saved === 'true' : true;
  });
  const [dockPos, setDockPos] = useState<{ x: number; y: number } | null>(() => {
    try {
      const saved = localStorage.getItem('bm_fp_dock_pos');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // On a phone a tapped element only shows the small summary bar. The full controls open when
  // the user asks for them, and only for that element: the next selection is compact again.
  const [phoneDockOpenFor, setPhoneDockOpenFor] = useState<string | null>(null);

  const toggleDockMinimized = useCallback(() => {
    if (isMobile) {
      const id = selectedElement?.id ?? null;
      setPhoneDockOpenFor(cur => (cur === id ? null : id));
      return;
    }
    setIsBottomDockMinimized(prev => {
      const next = !prev;
      localStorage.setItem('bm_fp_dock_minimized', String(next));
      return next;
    });
  }, [isMobile, selectedElement]);

  const toggleShowBottomDock = useCallback((val?: boolean) => {
    setShowBottomDock(prev => {
      const next = val !== undefined ? val : !prev;
      localStorage.setItem('bm_fp_show_bottom_dock', String(next));
      return next;
    });
  }, []);

  const resetDockPosition = useCallback(() => {
    setDockPos(null);
    localStorage.removeItem('bm_fp_dock_pos');
  }, []);

  const handleDockDragStart = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const dockEl = document.getElementById('fp-bottom-dock') || document.getElementById('fp-room-tool-dock');
    const rect = dockEl ? dockEl.getBoundingClientRect() : { left: window.innerWidth / 2 - 200, top: window.innerHeight - 120, width: 400 };
    const startX = e.clientX;
    const startY = e.clientY;
    const initialLeft = rect.left;
    const initialTop = rect.top;
    const dockWidth = rect.width || 380;

    const onMouseMove = (moveEvt: MouseEvent) => {
      const dx = moveEvt.clientX - startX;
      const dy = moveEvt.clientY - startY;
      const newX = Math.max(12, Math.min(window.innerWidth - dockWidth - 12, initialLeft + dx));
      const newY = Math.max(70, Math.min(window.innerHeight - 55, initialTop + dy));
      const pos = { x: Math.round(newX), y: Math.round(newY) };
      setDockPos(pos);
      try {
        localStorage.setItem('bm_fp_dock_pos', JSON.stringify(pos));
      } catch {}
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, []);

  const getDockEntitySummary = useCallback((entity: any, type: string) => {
    if (!entity) return '';
    if (type === 'wall') {
      const w = entity as FloorPlanWall;
      return `${formatDimension(wallLength(w), unit)} long • ${formatThickness(w.thickness, unit)} thick`;
    }
    if (type === 'room') {
      const r = entity as FloorPlanRoom;
      return `${computeRoomArea(r, unit)} (${r.roomType})`;
    }
    if (type === 'door') {
      return `${entity.doorType || 'Single'} (${entity.width || 3} ${unit === 'feet' ? 'ft' : 'm'})`;
    }
    if (type === 'window') {
      return `${entity.windowType || 'Standard'} (${entity.width || 4} ${unit === 'feet' ? 'ft' : 'm'})`;
    }
    if (type === 'column') {
      return `${entity.columnShape || 'Column'} (${entity.size || 1} ${unit === 'feet' ? 'ft' : 'm'})`;
    }
    if (type === 'stairs') {
      return `${entity.stairType || 'Stairs'}`;
    }
    if (type === 'furniture') {
      return `${entity.label || entity.itemType || 'Furniture'}`;
    }
    if (type === 'annotation') {
      return `"${entity.text || 'Note'}"`;
    }
    return '';
  }, [unit]);

  // Multi-Layer Engine
  const [layers, setLayers] = useState<FloorPlanLayerConfig[]>([
    { id: 'walls', name: 'Walls', visible: true, locked: false, color: '#1e293b' },
    { id: 'rooms', name: 'Rooms', visible: true, locked: false, color: '#fbbf24' },
    { id: 'doors', name: 'Doors', visible: true, locked: false, color: '#60a5fa' },
    { id: 'windows', name: 'Windows', visible: true, locked: false, color: '#38bdf8' },
    { id: 'furniture', name: 'Furniture', visible: true, locked: false, color: '#475569' },
    { id: 'kitchen', name: 'Kitchen', visible: true, locked: false, color: '#10b981' },
    { id: 'bathroom', name: 'Bathroom', visible: true, locked: false, color: '#a855f7' },
    { id: 'structure', name: 'Structure / Columns', visible: true, locked: false, color: '#64748b' },
    { id: 'stairs', name: 'Stairs', visible: true, locked: false, color: '#d97706' },
    { id: 'hvac', name: 'HVAC / Electrical', visible: true, locked: false, color: '#06b6d4' },
    { id: 'dimensions', name: 'Dimensions', visible: true, locked: false, color: '#94a3b8' },
    { id: 'annotations', name: 'Annotations', visible: true, locked: false, color: '#64748b' },
  ]);
  const [isLayersOpen, setIsLayersOpen] = useState(false);

  // Precision CAD Snapping & Drawing state
  const [snapToGridEnabled, setSnapToGridEnabled] = useState(true);
  const [snapToEndpointsEnabled, setSnapToEndpointsEnabled] = useState(true);
  const [snapToWallEnabled, setSnapToWallEnabled] = useState(true);
  const [isOrthoActive, setIsOrthoActive] = useState(false);
  // Step that positions snap to, in plan units (6 in or 10 cm by default; set when the plan loads).
  const [gridStep, setGridStep] = useState(SNAP_THRESHOLD);
  // How far a finger or pointer reaches for a corner or wall: a multiple of the normal reach.
  const [snapReach, setSnapReach] = useState<number>(() => {
    const saved = Number(readSetting('bm_fp_snap_reach', '1'));
    return [0.6, 1, 1.5].includes(saved) ? saved : 1;
  });
  // Grid snapping for everything that is placed or dragged. Read through a ref so handlers
  // created in an earlier render still follow the current Snap setting.
  const gridRef = useRef({ step: gridStep, on: snapToGridEnabled });
  gridRef.current = { step: gridStep, on: snapToGridEnabled };
  const snapToGrid = useCallback((val: number) => (gridRef.current.on ? roundToStep(val, gridRef.current.step) : val), []);
  const [snapIndicator, setSnapIndicator] = useState<(SnapPoint & { screenX: number; screenY: number }) | null>(null);
  const [liveLengthBadge, setLiveLengthBadge] = useState<{
    lengthStr: string; angleDeg: number; screenX: number; screenY: number;
    /** The same length in the other units (m / mm, or mm / ft-in). */
    alt?: string;
    /** What the end point snapped to, when it snapped to something other than the grid. */
    snapped?: string;
  } | null>(null);

  // Tool specific configurations
  const [wallThickness, setWallThickness] = useState(WALL_THICKNESS_DEFAULT);
  const [selectedRoomType, setSelectedRoomType] = useState<RoomType>('Living Room');
  const [selectedDoorType, setSelectedDoorType] = useState<DoorType>('Single');
  const [selectedWindowType, setSelectedWindowType] = useState<WindowType>('Standard');
  const [columnShape, setColumnShape] = useState<'square' | 'rectangular' | 'round'>('square');
  const [stairType, setStairType] = useState<'straight' | 'l-shape' | 'u-shape' | 'spiral'>('straight');

  // Canvas transform
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);

  // Drawing state
  const [isDrawingWall, setIsDrawingWall] = useState(false);
  const [wallStart, setWallStart] = useState<{ x: number; y: number } | null>(null);
  const [currentMousePos, setCurrentMousePos] = useState<{ x: number; y: number } | null>(null);

  // Resizing state
  const [resizingWall, setResizingWall] = useState<{ id: string; endpoint: 1 | 2 } | null>(null);

  // Drag state
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartPos, setDragStartPos] = useState<{ x: number; y: number } | null>(null);
  const [dragElementSnapshot, setDragElementSnapshot] = useState<any>(null);
  const [dragHostedOpeningsSnapshot, setDragHostedOpeningsSnapshot] = useState<{
    doors: FloorPlanDoor[];
    windows: FloorPlanWindow[];
  } | null>(null);

  // Pan state
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const panMovedRef = useRef(false);
  const touchStartRef = useRef<{ x: number; y: number; panX: number; panY: number; dist?: number } | null>(null);

  // Pointer input (mouse, touch and pen through one path).
  const supportsPointer = typeof window !== 'undefined' && 'PointerEvent' in window;
  const elementHitRef = useRef(false);
  // Where and when the last canvas tap ended. The browser sends a follow-up "click" for every
  // tap; if a button has appeared under the finger by then (for example Delete on the item
  // that was just placed) that click must not press it.
  const lastTapRef = useRef({ time: 0, x: 0, y: 0 });
  useEffect(() => {
    const swallowGhostClick = (ev: MouseEvent) => {
      const tap = lastTapRef.current;
      if (Date.now() - tap.time < 500 && Math.hypot(ev.clientX - tap.x, ev.clientY - tap.y) < 30) {
        ev.stopPropagation();
        ev.preventDefault();
      }
    };
    window.addEventListener('click', swallowGhostClick, true);
    return () => window.removeEventListener('click', swallowGhostClick, true);
  }, []);
  const dragStartStateRef = useRef<EditorState | null>(null);
  // `others` are the walls that do not end at the dragged corner: the corner can snap onto them.
  const jointDragRef = useRef<{ walls: FloorPlanWall[]; others: FloorPlanWall[]; origin: { x: number; y: number } } | null>(null);
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const pendingSelectRef = useRef<SelectedElement>(null);
  const pendingViewRef = useRef<{ panX: number; panY: number; zoom: number } | null>(null);
  const pendingMoveRef = useRef<{ x: number; y: number; shiftKey: boolean; altKey: boolean } | null>(null);
  const moveFrameRef = useRef(0);
  const resetGestureRef = useRef<() => void>(() => {});
  const latestInputRef = useRef<{
    handleMouseDown: (e: React.MouseEvent<SVGSVGElement>) => void;
    handleMouseMove: (e: React.MouseEvent<SVGSVGElement>) => void;
    handleMouseUp: () => void;
    finishWallAt: (start: { x: number; y: number }, e: React.MouseEvent<SVGSVGElement>) => { x: number; y: number };
    isDrawingWall: boolean;
  }>({ handleMouseDown: () => {}, handleMouseMove: () => {}, handleMouseUp: () => {}, finishWallAt: start => start, isDrawingWall: false });
  // True while the last canvas press came from a finger or pen (the length badge then sits
  // clear of the fingertip).
  const touchInputRef = useRef(false);
  const gestureRef = useRef<{
    kind: 'none' | 'single' | 'pinch';
    onElement: boolean;
    pendingSelect: SelectedElement;
    /** Wall whose measurement label the finger landed on; a tap there opens the length box. */
    dimHit: string | null;
    downAt: { x: number; y: number };
    moved: boolean;
    dragDrawing: boolean;
    /** Start of the wall being dragged out; kept here so finishing it never waits on state. */
    wallStart: { x: number; y: number } | null;
    panning: boolean;
    waitForAllUp: boolean;
    startDist: number;
    startZoom: number;
    anchor: { x: number; y: number };
  }>({ kind: 'none', onElement: false, pendingSelect: null, dimHit: null, downAt: { x: 0, y: 0 }, moved: false, dragDrawing: false, wallStart: null, panning: false, waitForAllUp: false, startDist: 1, startZoom: 1, anchor: { x: 0, y: 0 } });

  // Layer Helpers
  const isLayerVisible = useCallback((layerId?: string) => {
    if (!layerId) return true;
    const l = layers.find(item => item.id === layerId);
    return l ? l.visible : true;
  }, [layers]);

  const isLayerLocked = useCallback((layerId?: string) => {
    if (!layerId) return false;
    const l = layers.find(item => item.id === layerId);
    return l ? l.locked : false;
  }, [layers]);

  const toggleLayerVisibility = (layerId: string) => {
    setLayers(prev => prev.map(l => l.id === layerId ? { ...l, visible: !l.visible } : l));
  };

  const toggleLayerLock = (layerId: string) => {
    setLayers(prev => prev.map(l => l.id === layerId ? { ...l, locked: !l.locked } : l));
  };

  // ── Load Plan ──────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getFloorPlanById(user, planId).then(loaded => {
      if (cancelled) return;
      if (loaded) {
        setPlan(loaded);
        // loadFloors also adopts drawings saved in the plan's top-level fields (older plans
        // and starter templates), so nothing that was saved is left behind.
        const initialFloors: FloorPlanLevel[] = loadFloors(loaded);

        setFloorLevels(initialFloors);
        setActiveFloorIndex(0);

        // New walls and the snap step follow the plan's unit system (9 in / 6 in, or 230 mm / 10 cm).
        setGridStep(defaultGridStep(loaded.unit));
        setWallThickness(defaultWallThickness(loaded.unit));

        const state: EditorState = levelToState(initialFloors[0]);
        dispatch({ type: 'SET_STATE', payload: state });
        historyRef.current = new PlanHistory(UNDO_HISTORY_LIMIT);
        activeFloorIdRef.current = initialFloors[0].id;
        historyRef.current.reset(initialFloors[0].id, state);
        revisionRef.current = loaded.revision || 0;
        conflictRef.current = false;
        setSaveConflict(false);
        setHistoryTick(t => t + 1);
        setSaveStatus('saved');

        // Automatic Fit-To-Screen on load: calculates actual geometry bounding box
        const bbox = calculatePlanBoundingBox(
          state.walls,
          state.rooms,
          state.doors,
          state.windows,
          state.furniture,
          state.columns,
          state.stairs,
          loaded.plotLength,
          loaded.plotWidth
        );
        const vw = containerRef.current?.clientWidth || (window.innerWidth - 80);
        const vh = containerRef.current?.clientHeight || (window.innerHeight - 140);
        const geomW = bbox.width * GRID_SIZE_PX;
        const geomH = bbox.height * GRID_SIZE_PX;
        const fitZoom = Math.min(3.0, Math.max(MIN_ZOOM, Math.min((vw * 0.78) / geomW, (vh * 0.78) / geomH)));
        setZoom(+fitZoom.toFixed(2));
        setPanX(Math.round(vw / 2 - bbox.centerX * GRID_SIZE_PX * fitZoom));
        setPanY(Math.round(vh / 2 - bbox.centerY * GRID_SIZE_PX * fitZoom));
      }
      setLoading(false);
    }).catch(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [planId, user]);

  // ── History ───────────────────────────────────────────

  const pushHistory = useCallback((state: EditorState) => {
    historyRef.current.push(activeFloorIdRef.current, state);
    setHistoryTick(t => t + 1);
  }, []);

  const markUnsaved = useCallback(() => setSaveStatus('unsaved'), []);

  // ── Auto Fit-To-Screen Handler ────────────────────────
  const handleFitToScreen = useCallback(() => {
    const bbox = calculatePlanBoundingBox(
      editorState.walls,
      editorState.rooms,
      editorState.doors,
      editorState.windows,
      editorState.furniture,
      editorState.columns,
      editorState.stairs,
      plan?.plotLength || 40,
      plan?.plotWidth || 30
    );
    const vw = containerRef.current?.clientWidth || (window.innerWidth - (window.innerWidth <= 768 ? 16 : 80));
    const vh = containerRef.current?.clientHeight || (window.innerHeight - (window.innerWidth <= 768 ? 120 : 140));
    const geomW = bbox.width * GRID_SIZE_PX;
    const geomH = bbox.height * GRID_SIZE_PX;
    const isMobileView = typeof window !== 'undefined' && window.innerWidth <= 768;
    const paddingFactor = isMobileView ? 0.94 : 0.84;
    // On a phone the corner pills (top) and the floating toolbar (bottom) lie over the canvas.
    // The plan is fitted into the clear band between them, so nothing starts hidden under a bar.
    const insetTop = isMobileView ? 56 : 0;
    const insetBottom = isMobileView ? 88 : 0;
    const clearH = Math.max(120, vh - insetTop - insetBottom);
    // Dimension lines sit outside the walls: leave room for them, so a fitted plan shows its
    // measurements too.
    const dimPad = showDimensions && editorState.walls.length > 0 ? (isMobileView ? 44 : 60) : 0;
    const fitW = Math.max(120, vw * paddingFactor - dimPad * 2);
    const fitH = Math.max(120, clearH * paddingFactor - dimPad * 2);
    const fitZoom = Math.min(4.0, Math.max(MIN_ZOOM, Math.min(fitW / geomW, fitH / geomH)));
    setZoom(+fitZoom.toFixed(2));
    setPanX(Math.round(vw / 2 - bbox.centerX * GRID_SIZE_PX * fitZoom));
    setPanY(Math.round(insetTop + clearH / 2 - bbox.centerY * GRID_SIZE_PX * fitZoom));
  }, [editorState, plan, showDimensions]);

  // Auto-fit plot to available viewport on initial load
  const didInitialFitRef = useRef(false);
  useEffect(() => {
    if (!loading && plan && containerRef.current && !didInitialFitRef.current) {
      didInitialFitRef.current = true;
      const t = setTimeout(() => {
        handleFitToScreen();
      }, 150);
      return () => clearTimeout(t);
    }
  }, [loading, plan, handleFitToScreen]);

  // Set by an edit that must become its own undo step. The step is recorded from the drawing
  // as it actually is once the edit has been applied (see the recording effect below), so the
  // history holds exactly what is on screen, including the ids of rooms the edit created.
  const captureNowRef = useRef(false);

  const dispatchWithHistory = useCallback((action: EditorAction) => {
    captureNowRef.current = true;
    dispatch(action);
    // Worked out here only to tell the user what the edit did.
    const next = reducePlan(editorState, action, unit);
    markUnsaved();
    if (WALL_ACTIONS.has(action.type)) {
      const before = new Set(editorState.rooms.map(r => r.id));
      const created = next.rooms.filter(r => r.fromWalls && !before.has(r.id));
      if (created.length === 1) onNotify(`Room created from walls: ${formatPlanArea(roomArea(created[0]), unit)}. Tap it to name it.`, 'success');
      else if (created.length > 1) onNotify(`${created.length} rooms created from walls. Tap a room to name it.`, 'success');
      const lostOpenings = editorState.doors.length + editorState.windows.length - next.doors.length - next.windows.length;
      if (lostOpenings > 0) onNotify(`${lostOpenings} door/window removed with its wall.`, 'info');
    }
  }, [editorState, markUnsaved, unit, onNotify]);

  const handleUndo = useCallback(() => {
    // Record what is on screen first (a no-op when it already is), so undo steps back from
    // exactly this drawing and redo can return to it.
    if (latestRef.current.plan) historyRef.current.push(activeFloorIdRef.current, latestRef.current.state);
    const prev = historyRef.current.undo(activeFloorIdRef.current);
    if (!prev) return;
    dispatch({ type: 'SET_STATE', payload: prev });
    setSelectedElement(null);
    setSketchNotice(null);
    setSketchProposal(null);
    setHistoryTick(t => t + 1);
    markUnsaved();
  }, [markUnsaved]);

  const handleRedo = useCallback(() => {
    const next = historyRef.current.redo(activeFloorIdRef.current);
    if (!next) return;
    dispatch({ type: 'SET_STATE', payload: next });
    setSelectedElement(null);
    setHistoryTick(t => t + 1);
    markUnsaved();
  }, [markUnsaved]);

  const newPlanId: NewId = useCallback(prefix => uid(prefix), []);

  /**
   * Applies an edit worked out by src/domain/planEdit (a whole, consistent floor) as one undo
   * step, and says what it did with an Undo button. A refused edit only explains why; an edit
   * that would leave the drawing exactly as it is reports that nothing changed.
   */
  const applyEdit = useCallback((r: EditResult, select: SelectedElement = null): boolean => {
    if (!r.ok) {
      onNotify(r.reason, 'info');
      return false;
    }
    if (JSON.stringify(r.state) === JSON.stringify(editorState)) {
      onNotify('Nothing changed on the plan.', 'info');
      return false;
    }
    dispatchWithHistory({ type: 'SET_STATE', payload: r.state });
    setSelectedElement(select);
    setSketchProposal(null);
    setSketchNotice(r.warnings.length ? `${r.summary}. ${r.warnings.join(' ')}` : r.summary);
    return true;
  }, [editorState, dispatchWithHistory, onNotify]);

  // Recording undo steps. An edit made through dispatchWithHistory is recorded at once. Other
  // edits (typing in a property box, a rotation select) change the drawing directly; those
  // are recorded once they settle, so undo covers them as well. A drag is recorded once, when
  // it ends. Recording a drawing that is already the latest step does nothing.
  const dragActive = isDragging || !!resizingWall;
  useEffect(() => {
    if (loading || dragActive) return;
    const record = () => {
      historyRef.current.push(activeFloorIdRef.current, editorState);
      setHistoryTick(t => t + 1);
    };
    if (captureNowRef.current) {
      captureNowRef.current = false;
      record();
      return;
    }
    const timer = setTimeout(record, 400);
    return () => clearTimeout(timer);
  }, [editorState, loading, dragActive]);

  /** 100% zoom with the drawing centred: the view to return to after getting lost. */
  const handleResetView = useCallback(() => {
    const bbox = calculatePlanBoundingBox(
      editorState.walls, editorState.rooms, editorState.doors, editorState.windows,
      editorState.furniture, editorState.columns, editorState.stairs,
      plan?.plotLength || 40, plan?.plotWidth || 30
    );
    const vw = containerRef.current?.clientWidth || window.innerWidth;
    const vh = containerRef.current?.clientHeight || window.innerHeight;
    setZoom(1);
    setPanX(Math.round(vw / 2 - bbox.centerX * GRID_SIZE_PX));
    setPanY(Math.round(vh / 2 - bbox.centerY * GRID_SIZE_PX));
  }, [editorState, plan]);

  useLayoutEffect(() => {
    if (!pendingViewRef.current && svgRef.current) svgRef.current.style.transform = '';
  }, [panX, panY, zoom]);

  // ── Coordinate Conversion ────────────────────────────

  const svgToWorld = useCallback(
    (svgX: number, svgY: number) => ({
      x: (svgX - panX) / (GRID_SIZE_PX * zoom),
      y: (svgY - panY) / (GRID_SIZE_PX * zoom),
    }),
    [panX, panY, zoom]
  );

  const getSvgPos = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const rect = svgRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }, []);

  // ── Save ──────────────────────────────────────────────

  latestRef.current = { plan, floors: floorLevels, activeIndex: activeFloorIndex, state: editorState, dirty: saveStatus !== 'saved' };
  const saveSeqRef = useRef(0);
  const revisionRef = useRef(0);
  const saveInFlightRef = useRef<Promise<boolean> | null>(null);
  const saveQueuedRef = useRef<{ announce: boolean } | null>(null);
  const conflictRef = useRef(false);
  const [saveConflict, setSaveConflict] = useState(false);

  /**
   * Writes every floor to the database. Always reads the latest drawing, so it is safe to call
   * from a timer, from the Back button or while the page is being closed.
   * `announce` is true only when the user pressed Save; autosave reports through the status chip.
   */
  const saveNow = useCallback(async (announce = false, overwrite = false): Promise<boolean> => {
    // One save at a time. A save asked for while another is running is not started in
    // parallel; it runs once, right after, with whatever is newest by then.
    if (saveInFlightRef.current) {
      saveQueuedRef.current = saveQueuedRef.current || { announce: false };
      saveQueuedRef.current.announce = saveQueuedRef.current.announce || announce;
      return saveInFlightRef.current;
    }
    const run = async (): Promise<boolean> => {
      const { plan: p, floors, activeIndex, state } = latestRef.current;
      if (!p || conflictRef.current) return false;
      saveSeqRef.current += 1;
      setSaving(true);
      setSaveStatus('saving');
      try {
        const payload = buildSavePayload(p, floors, activeIndex, state);
        // The revision check refuses the save if another tab or device saved this plan first,
        // instead of silently overwriting their newer work.
        const res = await updateFloorPlan(user, p.id, payload, overwrite ? undefined : revisionRef.current);
        if (res.success) {
          revisionRef.current = res.revision ?? revisionRef.current + 1;
          // If the drawing changed while this save was in flight, it is still unsaved.
          const stillSame = latestRef.current.state === state && latestRef.current.floors === floors;
          setSaveStatus(stillSame ? 'saved' : 'unsaved');
          if (announce) onNotify('Floor plan saved', 'success');
          return true;
        }
        setSaveStatus('unsaved');
        if (res.conflict) {
          conflictRef.current = true;
          setSaveConflict(true);
        } else {
          onNotify(res.error || 'The plan could not be saved. Your drawing is still open; try Save again.', 'error');
        }
        return false;
      } catch (err) {
        setSaveStatus('unsaved');
        onNotify('The plan could not be saved: ' + (err as Error).message, 'error');
        return false;
      } finally {
        setSaving(false);
      }
    };
    const flight = run().finally(() => {
      saveInFlightRef.current = null;
      const queued = saveQueuedRef.current;
      saveQueuedRef.current = null;
      if (queued && latestRef.current.dirty && !conflictRef.current) void saveNow(queued.announce);
    });
    saveInFlightRef.current = flight;
    return flight;
  }, [user, onNotify]);

  /** After a conflict: keep this device's drawing (overwrite) or load the other one. */
  const resolveConflict = useCallback(async (keepMine: boolean) => {
    const p = latestRef.current.plan;
    if (!p) return;
    if (keepMine) {
      conflictRef.current = false;
      setSaveConflict(false);
      const ok = await saveNow(true, true);
      if (!ok) onNotify('Your version could not be saved. Try again.', 'error');
      return;
    }
    try {
      const fresh = await getFloorPlanById(user, p.id);
      if (!fresh) throw new Error('The plan is no longer available.');
      const floors = loadFloors(fresh);
      const state = levelToState(floors[0]);
      setPlan(fresh);
      setFloorLevels(floors);
      setActiveFloorIndex(0);
      dispatch({ type: 'SET_STATE', payload: state });
      historyRef.current = new PlanHistory(UNDO_HISTORY_LIMIT);
      activeFloorIdRef.current = floors[0].id;
      historyRef.current.reset(floors[0].id, state);
      revisionRef.current = fresh.revision || 0;
      setHistoryTick(t => t + 1);
      setSelectedElement(null);
      conflictRef.current = false;
      setSaveConflict(false);
      setSaveStatus('saved');
      onNotify('Loaded the other version of this plan', 'info');
    } catch (err) {
      onNotify('The other version could not be loaded: ' + (err as Error).message, 'error');
    }
  }, [user, onNotify, saveNow]);

  const handleSave = useCallback(() => { void saveNow(true); }, [saveNow]);

  // Autosave shortly after the last change.
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (saveStatus === 'unsaved' && plan && !saveConflict) {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
      autoSaveTimer.current = setTimeout(() => { void saveNow(false); }, 1500);
    }
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
  }, [editorState, floorLevels, saveStatus, saveNow, plan, saveConflict]);

  // Never lose the last few seconds of work: save when the app goes to the background, when
  // the page is closed or refreshed, and when the editor itself is left.
  useEffect(() => {
    const flush = () => { if (latestRef.current.dirty) void saveNow(false); };
    const onVisibility = () => { if (document.visibilityState === 'hidden') flush(); };
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!latestRef.current.dirty) return;
      flush();
      e.preventDefault();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', flush);
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', flush);
      window.removeEventListener('beforeunload', onBeforeUnload);
      flush();
    };
  }, [saveNow]);

  /** Leaves the editor only after pending changes are written. */
  const leaveEditor = useCallback(async (go: () => void) => {
    if (latestRef.current.dirty) await saveNow(false);
    go();
  }, [saveNow]);

  // ── Multi-Floor Level Handlers ─────────────────────────

  // All floor changes go through src/domain/planDocument.ts. Each one first writes what is on
  // screen back into its floor, then returns the complete next view, so there is no moment
  // where the screen and the stored floors disagree.
  const applyFloorsView = (view: FloorsView, changed: boolean) => {
    setFloorLevels(view.floors);
    setActiveFloorIndex(view.activeIndex);
    const floorId = view.floors[view.activeIndex].id;
    activeFloorIdRef.current = floorId;
    dispatch({ type: 'SET_STATE', payload: view.state });
    if (!historyRef.current.has(floorId)) historyRef.current.reset(floorId, view.state);
    setHistoryTick(t => t + 1);
    setSelectedElement(null);
    setIsDrawingWall(false);
    setWallStart(null);
    if (changed) markUnsaved();
  };

  const handleSwitchFloor = (newIndex: number) => {
    if (newIndex === activeFloorIndex || newIndex < 0 || newIndex >= floorLevels.length) return;
    applyFloorsView(switchFloor(floorLevels, activeFloorIndex, editorState, newIndex), false);
  };

  const handleAddFloor = () => setFloorDialog({ mode: 'add', value: suggestFloorName(floorLevels), error: '' });

  const handleDuplicateFloor = () => {
    const base = `${floorLevels[activeFloorIndex]?.name || 'Floor'} copy`;
    let name = base;
    for (let i = 2; validateFloorName(floorLevels, name) && i < 50; i++) name = `${base} ${i}`;
    setFloorDialog({ mode: 'duplicate', value: name, error: '' });
  };

  const handleRenameFloor = () => {
    const current = floorLevels[activeFloorIndex];
    if (current) setFloorDialog({ mode: 'rename', value: current.name, error: '' });
  };

  const submitFloorDialog = () => {
    if (!floorDialog) return;
    const error = validateFloorName(floorLevels, floorDialog.value, floorDialog.mode === 'rename' ? activeFloorIndex : undefined);
    if (error) return setFloorDialog({ ...floorDialog, error });
    const name = floorDialog.value.trim();
    const storey = plan?.ceilingHeight || WALL_HEIGHT_DEFAULT;
    if (floorDialog.mode === 'add') {
      applyFloorsView(addFloor(floorLevels, activeFloorIndex, editorState, name, storey, () => uid('level')), true);
      onNotify(`${name} added`, 'success');
    } else if (floorDialog.mode === 'duplicate') {
      applyFloorsView(duplicateFloor(floorLevels, activeFloorIndex, editorState, name, storey, uid), true);
      onNotify(`Copied to ${name}`, 'success');
    } else {
      setFloorLevels(renameFloor(floorLevels, activeFloorIndex, name));
      markUnsaved();
    }
    setFloorDialog(null);
  };

  const handleDeleteFloor = () => {
    if (floorLevels.length <= 1) {
      onNotify('A plan needs at least one floor, so this one can not be deleted.', 'info');
      return;
    }
    setConfirmDeleteFloor(true);
  };

  const confirmDeleteCurrentFloor = () => {
    const removed = floorLevels[activeFloorIndex];
    const view = deleteFloor(floorLevels, activeFloorIndex, editorState, activeFloorIndex);
    setConfirmDeleteFloor(false);
    if (!view) return;
    historyRef.current.forget(removed.id);
    applyFloorsView(view, true);
    onNotify(`${removed.name} deleted`, 'info');
  };

  const handleNewProject = useCallback(() => {
    if (window.confirm('Start a new floor plan project? Any unsaved changes will be lost.')) {
      handleLoadStarterPlan();
    }
  }, []);

  // ── Selected Entity Helpers ─────────────────────────

  const getSelectedEntity = useCallback(() => {
    if (!selectedElement) return null;
    const { type, id } = selectedElement;
    if (type === 'wall') return editorState.walls.find(w => w.id === id);
    if (type === 'room') return editorState.rooms.find(r => r.id === id);
    if (type === 'door') return editorState.doors.find(d => d.id === id);
    if (type === 'window') return editorState.windows.find(w => w.id === id);
    if (type === 'furniture') return editorState.furniture.find(f => f.id === id);
    if (type === 'stairs') return editorState.stairs.find(s => s.id === id);
    if (type === 'column') return editorState.columns.find(c => c.id === id);
    if (type === 'annotation') return editorState.annotations.find(a => a.id === id);
    return null;
  }, [selectedElement, editorState]);

  const isSelectedLocked = useMemo(() => {
    return !!getSelectedEntity()?.locked;
  }, [getSelectedEntity]);

  // ── Toggle Lock ───────────────────────────────────────

  const handleToggleLockSelected = useCallback(() => {
    if (!selectedElement) return;
    const { type, id } = selectedElement;
    const current = getSelectedEntity();
    const nextLocked = !current?.locked;

    if (type === 'wall') dispatchWithHistory({ type: 'UPDATE_WALL', id, changes: { locked: nextLocked } });
    else if (type === 'room') dispatchWithHistory({ type: 'UPDATE_ROOM', id, changes: { locked: nextLocked } });
    else if (type === 'door') dispatchWithHistory({ type: 'UPDATE_DOOR', id, changes: { locked: nextLocked } });
    else if (type === 'window') dispatchWithHistory({ type: 'UPDATE_WINDOW', id, changes: { locked: nextLocked } });
    else if (type === 'furniture') dispatchWithHistory({ type: 'UPDATE_FURNITURE', id, changes: { locked: nextLocked } });
    else if (type === 'stairs') dispatchWithHistory({ type: 'UPDATE_STAIRS', id, changes: { locked: nextLocked } });
    else if (type === 'column') dispatchWithHistory({ type: 'UPDATE_COLUMN', id, changes: { locked: nextLocked } });
    else if (type === 'annotation') dispatchWithHistory({ type: 'UPDATE_ANNOTATION', id, changes: { locked: nextLocked } });

    onNotify(nextLocked ? '🔒 Element locked (drag & edit disabled)' : '🔓 Element unlocked', 'info');
  }, [selectedElement, getSelectedEntity, dispatchWithHistory, onNotify]);

  // ── Duplicate Selected ────────────────────────────────

  const handleDuplicateSelected = useCallback(() => {
    if (!selectedElement) return;
    const { type, id } = selectedElement;
    const offset = 1; // 1 ft offset

    if (type === 'wall') {
      const el = editorState.walls.find(w => w.id === id);
      if (!el) return;
      const clone: FloorPlanWall = { ...el, id: uid('wall'), x1: el.x1 + offset, y1: el.y1 + offset, x2: el.x2 + offset, y2: el.y2 + offset, locked: false };
      dispatchWithHistory({ type: 'ADD_WALL', payload: clone });
      setSelectedElement({ type: 'wall', id: clone.id });
    } else if (type === 'room') {
      const el = editorState.rooms.find(r => r.id === id);
      if (!el) return;
      const clone: FloorPlanRoom = { ...el, id: uid('room'), x: el.x + offset, y: el.y + offset, label: `${el.label} (Copy)`, locked: false };
      dispatchWithHistory({ type: 'ADD_ROOM', payload: clone });
      setSelectedElement({ type: 'room', id: clone.id });
    } else if (type === 'door') {
      const el = editorState.doors.find(d => d.id === id);
      if (!el) return;
      const clone: FloorPlanDoor = { ...el, id: uid('door'), x: el.x + offset, y: el.y + offset, locked: false };
      dispatchWithHistory({ type: 'ADD_DOOR', payload: clone });
      setSelectedElement({ type: 'door', id: clone.id });
    } else if (type === 'window') {
      const el = editorState.windows.find(w => w.id === id);
      if (!el) return;
      const clone: FloorPlanWindow = { ...el, id: uid('win'), x: el.x + offset, y: el.y + offset, locked: false };
      dispatchWithHistory({ type: 'ADD_WINDOW', payload: clone });
      setSelectedElement({ type: 'window', id: clone.id });
    } else if (type === 'furniture') {
      const el = editorState.furniture.find(f => f.id === id);
      if (!el) return;
      const clone: FloorPlanFurniture = { ...el, id: uid('furn'), x: el.x + offset, y: el.y + offset, locked: false };
      dispatchWithHistory({ type: 'ADD_FURNITURE', payload: clone });
      setSelectedElement({ type: 'furniture', id: clone.id });
    } else if (type === 'stairs') {
      const el = editorState.stairs.find(s => s.id === id);
      if (!el) return;
      const clone: FloorPlanStaircase = { ...el, id: uid('stair'), x: el.x + offset, y: el.y + offset, locked: false };
      dispatchWithHistory({ type: 'ADD_STAIRS', payload: clone });
      setSelectedElement({ type: 'stairs', id: clone.id });
    } else if (type === 'column') {
      const el = editorState.columns.find(c => c.id === id);
      if (!el) return;
      const clone: FloorPlanColumn = { ...el, id: uid('col'), x: el.x + offset, y: el.y + offset, locked: false };
      dispatchWithHistory({ type: 'ADD_COLUMN', payload: clone });
      setSelectedElement({ type: 'column', id: clone.id });
    } else if (type === 'annotation') {
      const el = editorState.annotations.find(a => a.id === id);
      if (!el) return;
      const clone: FloorPlanAnnotation = { ...el, id: uid('annot'), x: el.x + offset, y: el.y + offset, locked: false };
      dispatchWithHistory({ type: 'ADD_ANNOTATION', payload: clone });
      setSelectedElement({ type: 'annotation', id: clone.id });
    }
    onNotify('Duplicated selected element', 'info');
  }, [selectedElement, editorState, dispatchWithHistory, onNotify]);

  // ── Copy & Paste ──────────────────────────────────────

  const handleCopySelected = useCallback(() => {
    const data = getSelectedEntity();
    if (selectedElement && data) {
      setClipboardElement({ type: selectedElement.type, data: JSON.parse(JSON.stringify(data)) });
      onNotify(`Copied ${selectedElement.type} to clipboard (Ctrl+C)`, 'info');
    }
  }, [selectedElement, getSelectedEntity, onNotify]);

  const handlePaste = useCallback(() => {
    if (!clipboardElement) return;
    const { type, data } = clipboardElement;
    const offset = 1;

    if (type === 'wall') {
      const clone: FloorPlanWall = { ...data, id: uid('wall'), x1: data.x1 + offset, y1: data.y1 + offset, x2: data.x2 + offset, y2: data.y2 + offset, locked: false };
      dispatchWithHistory({ type: 'ADD_WALL', payload: clone });
      setSelectedElement({ type: 'wall', id: clone.id });
    } else if (type === 'room') {
      const clone: FloorPlanRoom = { ...data, id: uid('room'), x: data.x + offset, y: data.y + offset, locked: false };
      dispatchWithHistory({ type: 'ADD_ROOM', payload: clone });
      setSelectedElement({ type: 'room', id: clone.id });
    } else if (type === 'door') {
      const clone: FloorPlanDoor = { ...data, id: uid('door'), x: data.x + offset, y: data.y + offset, locked: false };
      dispatchWithHistory({ type: 'ADD_DOOR', payload: clone });
      setSelectedElement({ type: 'door', id: clone.id });
    } else if (type === 'window') {
      const clone: FloorPlanWindow = { ...data, id: uid('win'), x: data.x + offset, y: data.y + offset, locked: false };
      dispatchWithHistory({ type: 'ADD_WINDOW', payload: clone });
      setSelectedElement({ type: 'window', id: clone.id });
    } else if (type === 'furniture') {
      const clone: FloorPlanFurniture = { ...data, id: uid('furn'), x: data.x + offset, y: data.y + offset, locked: false };
      dispatchWithHistory({ type: 'ADD_FURNITURE', payload: clone });
      setSelectedElement({ type: 'furniture', id: clone.id });
    } else if (type === 'stairs') {
      const clone: FloorPlanStaircase = { ...data, id: uid('stair'), x: data.x + offset, y: data.y + offset, locked: false };
      dispatchWithHistory({ type: 'ADD_STAIRS', payload: clone });
      setSelectedElement({ type: 'stairs', id: clone.id });
    } else if (type === 'column') {
      const clone: FloorPlanColumn = { ...data, id: uid('col'), x: data.x + offset, y: data.y + offset, locked: false };
      dispatchWithHistory({ type: 'ADD_COLUMN', payload: clone });
      setSelectedElement({ type: 'column', id: clone.id });
    } else if (type === 'annotation') {
      const clone: FloorPlanAnnotation = { ...data, id: uid('annot'), x: data.x + offset, y: data.y + offset, locked: false };
      dispatchWithHistory({ type: 'ADD_ANNOTATION', payload: clone });
      setSelectedElement({ type: 'annotation', id: clone.id });
    }
    onNotify(`Pasted ${type} from clipboard (Ctrl+V)`, 'success');
  }, [clipboardElement, dispatchWithHistory, onNotify]);

  // ── Rotate Selected ───────────────────────────────────

  const handleRotateSelected = useCallback(() => {
    if (!selectedElement) return;
    const { type, id } = selectedElement;

    if (type === 'furniture') {
      const f = editorState.furniture.find(item => item.id === id);
      if (!f || f.locked) return;
      const nextRot = ((f.rotation || 0) + 90) % 360;
      dispatchWithHistory({ type: 'UPDATE_FURNITURE', id, changes: { rotation: nextRot } });
    } else if (type === 'door') {
      const d = editorState.doors.find(item => item.id === id);
      if (!d || d.locked) return;
      const nextRot = ((d.rotation || 0) + 90) % 360;
      dispatchWithHistory({ type: 'UPDATE_DOOR', id, changes: { rotation: nextRot } });
    } else if (type === 'window') {
      const w = editorState.windows.find(item => item.id === id);
      if (!w || w.locked) return;
      const nextRot = ((w.rotation || 0) + 90) % 360;
      dispatchWithHistory({ type: 'UPDATE_WINDOW', id, changes: { rotation: nextRot } });
    } else if (type === 'stairs') {
      const s = editorState.stairs.find(item => item.id === id);
      if (!s || s.locked) return;
      const nextRot = ((s.rotation || 0) + 90) % 360;
      dispatchWithHistory({ type: 'UPDATE_STAIRS', id, changes: { rotation: nextRot } });
    } else if (type === 'room') {
      const r = editorState.rooms.find(item => item.id === id);
      if (!r || r.locked) return;
      dispatchWithHistory({ type: 'UPDATE_ROOM', id, changes: { width: r.height, height: r.width } });
    } else if (type === 'wall') {
      const wall = editorState.walls.find(item => item.id === id);
      if (!wall || wall.locked) return;
      const mx = (wall.x1 + wall.x2) / 2;
      const my = (wall.y1 + wall.y2) / 2;
      const dx = wall.x2 - wall.x1;
      const dy = wall.y2 - wall.y1;
      const newDx = -dy;
      const newDy = dx;
      // A quarter turn about the wall's middle. Not snapped to the grid: turning a wall must
      // never change its length.
      dispatchWithHistory({
        type: 'UPDATE_WALL',
        id,
        changes: {
          x1: tidy(mx - newDx / 2),
          y1: tidy(my - newDy / 2),
          x2: tidy(mx + newDx / 2),
          y2: tidy(my + newDy / 2),
        },
      });
    }
  }, [selectedElement, editorState, dispatchWithHistory]);

  const handleMirrorSelected = useCallback((axis: 'horizontal' | 'vertical' = 'horizontal') => {
    if (!selectedElement) {
      onNotify('Select an element first to mirror it.', 'info');
      return;
    }
    const { type, id } = selectedElement;
    if (type === 'wall') {
      const w = editorState.walls.find(x => x.id === id);
      if (!w || w.locked) return;
      const center = axis === 'horizontal' ? (w.x1 + w.x2) / 2 : (w.y1 + w.y2) / 2;
      const mirrored = mirrorWall(w, axis, center);
      dispatchWithHistory({ type: 'UPDATE_WALL', id, changes: mirrored });
      onNotify('Wall mirrored', 'success');
    } else if (type === 'room') {
      const r = editorState.rooms.find(x => x.id === id);
      if (!r || r.locked) return;
      const center = axis === 'horizontal' ? r.x + r.width / 2 : r.y + r.height / 2;
      const mirrored = mirrorRoom(r, axis, center);
      dispatchWithHistory({ type: 'UPDATE_ROOM', id, changes: mirrored });
      onNotify('Room mirrored', 'success');
    } else if (type === 'door') {
      const d = editorState.doors.find(x => x.id === id);
      if (!d || d.locked) return;
      dispatchWithHistory({ type: 'UPDATE_DOOR', id, changes: { flipHorizontal: !d.flipHorizontal } });
      onNotify('Door mirrored', 'success');
    } else if (type === 'window') {
      const win = editorState.windows.find(x => x.id === id);
      if (!win || win.locked) return;
      const mirrored = mirrorOpening(win, axis, win.x);
      dispatchWithHistory({ type: 'UPDATE_WINDOW', id, changes: mirrored });
      onNotify('Window mirrored', 'success');
    } else if (type === 'furniture') {
      const f = editorState.furniture.find(x => x.id === id);
      if (!f || f.locked) return;
      const center = axis === 'horizontal' ? f.x + f.width / 2 : f.y + f.height / 2;
      const mirrored = mirrorFurniture(f, axis, center);
      dispatchWithHistory({ type: 'UPDATE_FURNITURE', id, changes: mirrored });
      onNotify('Item mirrored', 'success');
    }
  }, [selectedElement, editorState, dispatchWithHistory, onNotify]);

  // ── Save Selection As Custom Shape ────────────────────

  const handleSaveSelectionAsCustom = useCallback((name: string) => {
    if (!selectedElement || !user?.id) return;
    const { type, id } = selectedElement;
    let customItem: ShapeLibraryItem | null = null;

    if (type === 'furniture') {
      const f = editorState.furniture.find(item => item.id === id);
      if (f) {
        customItem = {
          id: `custom-${Date.now()}`,
          name,
          category: 'Furniture',
          width: f.width,
          height: f.height,
          description: `Custom ${f.itemType} (${f.width}×${f.height} ft)`,
          entityType: 'furniture',
          iconType: f.itemType,
          isCustom: true,
        };
      }
    } else if (type === 'room') {
      const r = editorState.rooms.find(item => item.id === id);
      if (r) {
        customItem = {
          id: `custom-${Date.now()}`,
          name,
          category: 'Floor Plan',
          width: r.width,
          height: r.height,
          description: `Custom Room (${r.width}×${r.height} ft)`,
          entityType: 'room',
          iconType: 'Room',
          subType: r.roomType,
          isCustom: true,
        };
      }
    } else if (type === 'wall') {
      const w = editorState.walls.find(item => item.id === id);
      if (w) {
        const len = Math.max(1, Math.round(wallLength(w)));
        customItem = {
          id: `custom-${Date.now()}`,
          name,
          category: 'Floor Plan',
          width: len,
          height: w.thickness,
          description: `Custom Wall (${len} ft)`,
          entityType: 'wall',
          iconType: 'Wall',
          subType: w.wallType,
          isCustom: true,
        };
      }
    } else if (type === 'door') {
      const d = editorState.doors.find(item => item.id === id);
      if (d) {
        customItem = {
          id: `custom-${Date.now()}`,
          name,
          category: 'Floor Plan',
          width: d.width,
          height: 2.5,
          description: `Custom ${d.doorType} (${d.width} ft)`,
          entityType: 'door',
          iconType: 'Door',
          subType: d.doorType,
          isCustom: true,
        };
      }
    } else if (type === 'window') {
      const win = editorState.windows.find(item => item.id === id);
      if (win) {
        customItem = {
          id: `custom-${Date.now()}`,
          name,
          category: 'Floor Plan',
          width: win.width,
          height: 0.75,
          description: `Custom ${win.windowType} (${win.width} ft)`,
          entityType: 'window',
          iconType: 'Window',
          subType: win.windowType,
          isCustom: true,
        };
      }
    } else if (type === 'column') {
      const col = editorState.columns.find(item => item.id === id);
      if (col) {
        customItem = {
          id: `custom-${Date.now()}`,
          name,
          category: 'Structural',
          width: col.width,
          height: col.depth,
          description: `Custom Column (${col.width}×${col.depth} ft)`,
          entityType: 'column',
          iconType: col.shape === 'round' ? 'Pillar' : 'Column',
          subType: col.shape,
          isCustom: true,
        };
      }
    }

    if (customItem) {
      saveCustomShape(user.id, customItem);
      onNotify(`Saved "${name}" into Custom Shapes Library!`, 'success');
    }
  }, [selectedElement, editorState, user, onNotify]);

  // ── Canvas Drag & Drop from Shape Library ─────────────

  const handleCanvasDrop = useCallback(
    (e: React.DragEvent<SVGSVGElement>) => {
      e.preventDefault();
      try {
        const raw = e.dataTransfer.getData('application/json');
        if (!raw) return;
        const item: ShapeLibraryItem = JSON.parse(raw);
        if (!item || !item.entityType) return;

        const rect = svgRef.current!.getBoundingClientRect();
        const svgX = e.clientX - rect.left;
        const svgY = e.clientY - rect.top;
        const world = svgToWorld(svgX, svgY);
        const sx = snapToGrid(world.x);
        const sy = snapToGrid(world.y);

        const res = createEntityFromShape(item, sx, sy, unit);
        if (res.entityType === 'wall') {
          dispatchWithHistory({ type: 'ADD_WALL', payload: res.payload as FloorPlanWall });
          setSelectedElement({ type: 'wall', id: res.payload.id });
        } else if (res.entityType === 'room') {
          dispatchWithHistory({ type: 'ADD_ROOM', payload: res.payload as FloorPlanRoom });
          setSelectedElement({ type: 'room', id: res.payload.id });
        } else if (res.entityType === 'door') {
          dispatchWithHistory({ type: 'ADD_DOOR', payload: res.payload as FloorPlanDoor });
          setSelectedElement({ type: 'door', id: res.payload.id });
        } else if (res.entityType === 'window') {
          dispatchWithHistory({ type: 'ADD_WINDOW', payload: res.payload as FloorPlanWindow });
          setSelectedElement({ type: 'window', id: res.payload.id });
        } else if (res.entityType === 'furniture') {
          dispatchWithHistory({ type: 'ADD_FURNITURE', payload: res.payload as FloorPlanFurniture });
          setSelectedElement({ type: 'furniture', id: res.payload.id });
        } else if (res.entityType === 'stairs') {
          dispatchWithHistory({ type: 'ADD_STAIRS', payload: res.payload as FloorPlanStaircase });
          setSelectedElement({ type: 'stairs', id: res.payload.id });
        } else if (res.entityType === 'column') {
          dispatchWithHistory({ type: 'ADD_COLUMN', payload: res.payload as FloorPlanColumn });
          setSelectedElement({ type: 'column', id: res.payload.id });
        } else if (res.entityType === 'annotation') {
          dispatchWithHistory({ type: 'ADD_ANNOTATION', payload: res.payload as FloorPlanAnnotation });
          setSelectedElement({ type: 'annotation', id: res.payload.id });
        }

        if (user?.id) {
          recordRecentShape(user.id, item.id);
        }
        setActiveTool('select');
        onNotify(`Placed ${item.name} onto plan`, 'success');
      } catch (err) {
        console.error('Error handling canvas drop:', err);
      }
    },
    [svgToWorld, unit, user, dispatchWithHistory, onNotify, snapToGrid]
  );

  // ── Click To Add from Shape Library ───────────────────

  const handleSelectShapeFromLibrary = useCallback(
    (item: ShapeLibraryItem) => {
      const centerX = snapToGrid((plan?.plotLength || 30) / 2);
      const centerY = snapToGrid((plan?.plotWidth || 20) / 2);
      const res = createEntityFromShape(item, centerX, centerY, unit);

      if (res.entityType === 'wall') {
        dispatchWithHistory({ type: 'ADD_WALL', payload: res.payload as FloorPlanWall });
        setSelectedElement({ type: 'wall', id: res.payload.id });
      } else if (res.entityType === 'room') {
        dispatchWithHistory({ type: 'ADD_ROOM', payload: res.payload as FloorPlanRoom });
        setSelectedElement({ type: 'room', id: res.payload.id });
      } else if (res.entityType === 'door') {
        dispatchWithHistory({ type: 'ADD_DOOR', payload: res.payload as FloorPlanDoor });
        setSelectedElement({ type: 'door', id: res.payload.id });
      } else if (res.entityType === 'window') {
        dispatchWithHistory({ type: 'ADD_WINDOW', payload: res.payload as FloorPlanWindow });
        setSelectedElement({ type: 'window', id: res.payload.id });
      } else if (res.entityType === 'furniture') {
        dispatchWithHistory({ type: 'ADD_FURNITURE', payload: res.payload as FloorPlanFurniture });
        setSelectedElement({ type: 'furniture', id: res.payload.id });
      } else if (res.entityType === 'stairs') {
        dispatchWithHistory({ type: 'ADD_STAIRS', payload: res.payload as FloorPlanStaircase });
        setSelectedElement({ type: 'stairs', id: res.payload.id });
      } else if (res.entityType === 'column') {
        dispatchWithHistory({ type: 'ADD_COLUMN', payload: res.payload as FloorPlanColumn });
        setSelectedElement({ type: 'column', id: res.payload.id });
      } else if (res.entityType === 'annotation') {
        dispatchWithHistory({ type: 'ADD_ANNOTATION', payload: res.payload as FloorPlanAnnotation });
        setSelectedElement({ type: 'annotation', id: res.payload.id });
      }

      if (user?.id) {
        recordRecentShape(user.id, item.id);
      }
      setActiveTool('select');
      onNotify(`Added ${item.name} to plan. You can drag, rotate, or resize it.`, 'info');
    },
    [plan, unit, user, dispatchWithHistory, onNotify, snapToGrid]
  );

  // ── Delete Selected ───────────────────────────────────

  const handleDeleteSelected = useCallback(() => {
    if (!selectedElement) return;
    const entity = getSelectedEntity();
    if (entity?.locked) {
      onNotify('This element is locked. Unlock it first to delete.', 'info');
      return;
    }
    const { type, id } = selectedElement;
    if (type === 'room' && editorState.rooms.find(r => r.id === id)?.fromWalls) {
      // A room made by walls is the space inside them: deleting it removes its own walls,
      // so it asks first (see deleteRoom in planEdit.ts).
      setConfirmRoomDelete(id);
      return;
    }
    if (type === 'wall') dispatchWithHistory({ type: 'DELETE_WALL', id });
    else if (type === 'room') dispatchWithHistory({ type: 'DELETE_ROOM', id });
    else if (type === 'door') dispatchWithHistory({ type: 'DELETE_DOOR', id });
    else if (type === 'window') dispatchWithHistory({ type: 'DELETE_WINDOW', id });
    else if (type === 'column') dispatchWithHistory({ type: 'DELETE_COLUMN', id });
    else if (type === 'stairs') dispatchWithHistory({ type: 'DELETE_STAIRS', id });
    else if (type === 'furniture') dispatchWithHistory({ type: 'DELETE_FURNITURE', id });
    else if (type === 'annotation') dispatchWithHistory({ type: 'DELETE_ANNOTATION', id });
    setSelectedElement(null);
  }, [selectedElement, getSelectedEntity, dispatchWithHistory, onNotify, editorState.rooms]);

  // ── One wall, piece by piece ──────────────────────────
  // Split and "Erase part" act where the selected wall was tapped (its middle if unknown).
  const selectedWall = selectedElement?.type === 'wall' ? editorState.walls.find(w => w.id === selectedElement.id) || null : null;
  const selectedWallPoint = selectedWall
    ? (wallTap && wallTap.id === selectedWall.id ? wallTap.point : { x: (selectedWall.x1 + selectedWall.x2) / 2, y: (selectedWall.y1 + selectedWall.y2) / 2 })
    : null;
  const selectedWallJoints = selectedWall ? wallJunctions(editorState.walls, selectedWall.id, joinTolerance(unit)).length : 0;

  const handleSplitSelectedWall = () => {
    if (!selectedWall || !selectedWallPoint) return;
    const r = splitWall(editorState, selectedWall.id, { x: snapToGrid(selectedWallPoint.x), y: snapToGrid(selectedWallPoint.y) }, unit, newPlanId);
    if (applyEdit(r, r.ok && r.ids ? { type: 'wall', id: r.ids[0] } : selectedElement)) setWallTap(null);
  };
  const handleSplitSelectedAtJoints = () => {
    if (!selectedWall) return;
    const r = splitWallAtJunctions(editorState, selectedWall.id, unit, newPlanId);
    if (applyEdit(r, selectedElement)) setWallTap(null);
  };
  const handleEraseSelectedPart = () => {
    if (!selectedWall || !selectedWallPoint) return;
    if (applyEdit(eraseWallSegment(editorState, selectedWall.id, selectedWallPoint, unit, newPlanId))) setWallTap(null);
  };
  const [confirmRoomDelete, setConfirmRoomDelete] = useState<string | null>(null);

  // ── Room sheet: one place to name, type, size and delete a room ──
  const [roomSheet, setRoomSheet] = useState<{
    id: string; width: string; length: string; width0: string; length0: string; widthSide: 'right' | 'left'; lengthSide: 'bottom' | 'top'; error: string;
  } | null>(null);
  const openRoomSheet = (id: string) => {
    const r = editorState.rooms.find(x => x.id === id);
    if (!r) return;
    const box = roomBox(r);
    const width = formatLengthForInput(box ? box.maxX - box.minX : r.width, unit);
    const length = formatLengthForInput(box ? box.maxY - box.minY : r.height, unit);
    setRoomSheet({ id, width, length, width0: width, length0: length, widthSide: 'right', lengthSide: 'bottom', error: '' });
  };
  const applyRoomSize = () => {
    if (!roomSheet) return;
    // Only a size the user changed is applied: an untouched box keeps the exact size, never
    // the rounded number shown in it.
    const size: { width?: number; length?: number } = {};
    if (roomSheet.width.trim() !== roomSheet.width0) {
      const w = parseLengthInput(roomSheet.width, unit);
      if (!w.ok) return setRoomSheet({ ...roomSheet, error: `Width: ${w.error}` });
      size.width = w.value;
    }
    if (roomSheet.length.trim() !== roomSheet.length0) {
      const l = parseLengthInput(roomSheet.length, unit);
      if (!l.ok) return setRoomSheet({ ...roomSheet, error: `Length: ${l.error}` });
      size.length = l.value;
    }
    if (size.width === undefined && size.length === undefined) return setRoomSheet(null);
    const r = resizeRoom(editorState, roomSheet.id, size, unit, newPlanId,
      { width: roomSheet.widthSide, length: roomSheet.lengthSide }, plan ? { length: plan.plotLength, width: plan.plotWidth } : undefined);
    if (!r.ok) return setRoomSheet({ ...roomSheet, error: r.reason });
    if (applyEdit(r, { type: 'room', id: roomSheet.id })) setRoomSheet(null);
  };

  // ── Wall Angle Rotation Helper ────────────────────────
  const rotateWallToAngle = useCallback((wall: FloorPlanWall, targetDeg: number) => {
    const len = wallLength(wall);
    const rad = (targetDeg * Math.PI) / 180;
    // Length is kept exactly; only floating-point fuzz is removed.
    const x2 = tidy(wall.x1 + len * Math.cos(rad));
    const y2 = tidy(wall.y1 + len * Math.sin(rad));
    dispatchWithHistory({ type: 'UPDATE_WALL', id: wall.id, changes: { x2, y2 } });
  }, [dispatchWithHistory]);

  // ── Exact wall size (opened by tapping a wall's measurement) ──────────
  const openWallEdit = (wallId: string) => {
    const w = editorState.walls.find(x => x.id === wallId);
    if (!w) return;
    const keep = endToKeep(editorState.walls, wallId, joinTolerance(unit));
    const anchor = keep === 'start' ? { x: w.x1, y: w.y1 } : { x: w.x2, y: w.y2 };
    const length = formatLengthForInput(wallLength(w), unit);
    const thickness = formatThickness(w.thickness || defaultWallThickness(unit), unit);
    const x = String(Number(anchor.x.toFixed(4)));
    const y = String(Number(anchor.y.toFixed(4)));
    setSelectedElement({ type: 'wall', id: wallId });
    setWallEdit({ wallId, length, length0: length, thickness, thickness0: thickness, x, x0: x, y, y0: y, keep, error: '' });
  };
  openWallEditRef.current = openWallEdit;

  /**
   * Applies the wall box as one undo step. Only a field the user actually changed is applied,
   * so opening the box and pressing Apply can never nudge the drawing. Every value is checked
   * before anything is touched; a refused value leaves the plan exactly as it was.
   */
  const submitWallEdit = () => {
    if (!wallEdit) return;
    const w = editorState.walls.find(x => x.id === wallEdit.wallId);
    if (!w) { setWallEdit(null); return; }
    const fail = (error: string) => setWallEdit({ ...wallEdit, error });
    const lengthChanged = wallEdit.length.trim() !== wallEdit.length0;
    const thicknessChanged = wallEdit.thickness.trim() !== wallEdit.thickness0;
    const moved = wallEdit.x.trim() !== wallEdit.x0 || wallEdit.y.trim() !== wallEdit.y0;
    if (!lengthChanged && !thicknessChanged && !moved) { setWallEdit(null); return; }
    if (w.locked) return fail('This wall is locked. Unlock it to change it.');

    const length = parseLengthInput(wallEdit.length, unit);
    if (lengthChanged && !length.ok) return fail(length.error);
    const thickness = parseThicknessInput(wallEdit.thickness, unit);
    if (thicknessChanged && !thickness.ok) return fail(thickness.error);
    const px = Number(wallEdit.x), py = Number(wallEdit.y);
    if (moved && (wallEdit.x.trim() === '' || wallEdit.y.trim() === '' || !Number.isFinite(px) || !Number.isFinite(py) || Math.abs(px) > 5000 || Math.abs(py) > 5000)) {
      return fail('Enter the position as two numbers.');
    }

    const tol = joinTolerance(unit);
    let walls = editorState.walls;
    if (moved) {
      const anchor = wallEdit.keep === 'start' ? { x: w.x1, y: w.y1 } : { x: w.x2, y: w.y2 };
      walls = translateWall(walls, w.id, px - anchor.x, py - anchor.y, tol);
    }
    if (lengthChanged && length.ok) walls = resizeWall(walls, w.id, length.value, wallEdit.keep, tol);
    if (thicknessChanged && thickness.ok) {
      walls = walls.map(x => (x.id === w.id ? { ...x, thickness: thickness.value, thicknessMm: Math.round(planToMm(thickness.value, unit)) } : x));
    }
    if (walls !== editorState.walls) dispatchWithHistory({ type: 'SET_WALLS', walls });
    setWallEdit(null);
  };

  /**
   * Canva-style Quick Length Adjuster: +/- step adjustment directly from canvas widget.
   */
  const handleQuickAdjustWallLength = useCallback((wallId: string, delta: number) => {
    const wall = editorState.walls.find(w => w.id === wallId);
    if (!wall || wall.locked) return;
    const curLen = wallLength(wall);
    const newLen = Math.max(0.5, curLen + delta);
    const tol = joinTolerance(unit);
    const keep = endToKeep(editorState.walls, wallId, tol);
    const updatedWalls = resizeWall(editorState.walls, wallId, newLen, keep, tol);
    if (updatedWalls !== editorState.walls) {
      dispatchWithHistory({ type: 'SET_WALLS', walls: updatedWalls });
      markUnsaved();
      onNotify(`Wall length: ${formatDimension(newLen, unit)}`, 'info');
    }
  }, [editorState.walls, unit, dispatchWithHistory, markUnsaved, onNotify]);

  // ── AI Floor Plan Copilot Handlers ────────────────────
  const handleCopilotStraighten = useCallback(() => {
    setCopilotLoading(true);
    setTimeout(() => {
      const res = autoStraightenZigZagWalls(editorState.walls);
      if (res.fixedCount > 0) {
        dispatchWithHistory({ type: 'SET_STATE', payload: { ...editorState, walls: res.walls } });
        onNotify(res.message, 'success');
        setCopilotLastMessage(res.message);
      } else {
        onNotify(res.message, 'info');
        setCopilotLastMessage(res.message);
      }
      setCopilotLoading(false);
    }, 200);
  }, [editorState, dispatchWithHistory, onNotify]);

  const handleCopilotCloseGaps = useCallback(() => {
    setCopilotLoading(true);
    setTimeout(() => {
      const gapTol = unit === 'feet' ? 2.5 : 0.8;
      const res = autoCloseIncompleteGaps(editorState.walls, gapTol);
      if (res.fixedCount > 0) {
        dispatchWithHistory({ type: 'SET_STATE', payload: { ...editorState, walls: res.walls } });
        onNotify(res.message, 'success');
        setCopilotLastMessage(res.message);
      } else {
        onNotify(res.message, 'info');
        setCopilotLastMessage(res.message);
      }
      setCopilotLoading(false);
    }, 200);
  }, [editorState, unit, dispatchWithHistory, onNotify]);

  const handleCopilotCleanStubs = useCallback(() => {
    setCopilotLoading(true);
    setTimeout(() => {
      const res = cleanupMicroStubs(editorState.walls);
      if (res.fixedCount > 0) {
        dispatchWithHistory({ type: 'SET_STATE', payload: { ...editorState, walls: res.walls } });
        onNotify(res.message, 'success');
        setCopilotLastMessage(res.message);
      } else {
        onNotify(res.message, 'info');
        setCopilotLastMessage(res.message);
      }
      setCopilotLoading(false);
    }, 200);
  }, [editorState, dispatchWithHistory, onNotify]);

  const handleCopilotHealAll = useCallback(() => {
    setCopilotLoading(true);
    setTimeout(() => {
      const res = autoHealAllAndGenerateRooms(editorState.walls, editorState.rooms, unit);
      if (res.fixedCount > 0) {
        dispatchWithHistory({
          type: 'SET_STATE',
          payload: {
            ...editorState,
            walls: res.walls,
            rooms: res.rooms || editorState.rooms,
          },
        });
        onNotify(res.message, 'success');
        setCopilotLastMessage(res.message);
      } else {
        onNotify(res.message, 'info');
        setCopilotLastMessage(res.message);
      }
      setCopilotLoading(false);
    }, 300);
  }, [editorState, unit, dispatchWithHistory, onNotify]);

  const handleCopilotSubmitPrompt = useCallback((e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!copilotPrompt.trim()) return;

    setCopilotLoading(true);
    setTimeout(() => {
      const { intent, result } = parseAndExecuteCopilotCommand(
        copilotPrompt,
        editorState.walls,
        editorState.rooms,
        unit
      );

      if (intent.action === 'rotate' && intent.degrees !== undefined && selectedElement) {
        if (selectedElement.type === 'room') {
          dispatchWithHistory({ type: 'UPDATE_ROOM', id: selectedElement.id, changes: { rotation: intent.degrees } });
          setCopilotLastMessage(`Rotated room to ${intent.degrees}°`);
          onNotify(`Rotated room to ${intent.degrees}°`, 'success');
        } else if (selectedElement.type === 'wall') {
          const w = editorState.walls.find(item => item.id === selectedElement.id);
          if (w) rotateWallToAngle(w, intent.degrees);
          setCopilotLastMessage(`Rotated wall to ${intent.degrees}°`);
          onNotify(`Rotated wall to ${intent.degrees}°`, 'success');
        }
      } else if (result && result.fixedCount > 0) {
        dispatchWithHistory({
          type: 'SET_STATE',
          payload: {
            ...editorState,
            walls: result.walls,
            rooms: result.rooms || editorState.rooms,
          },
        });
        onNotify(result.message, 'success');
        setCopilotLastMessage(result.message);
      } else if (result) {
        onNotify(result.message, 'info');
        setCopilotLastMessage(result.message);
      } else {
        setCopilotLastMessage(intent.message);
      }

      setCopilotPrompt('');
      setCopilotLoading(false);
    }, 250);
  }, [copilotPrompt, editorState, unit, selectedElement, rotateWallToAngle, dispatchWithHistory, onNotify]);

  // Context for AI Floor Plan Assistant
  const planContext = useMemo<PlanContext>(() => ({
    walls: editorState.walls,
    rooms: editorState.rooms,
    doors: editorState.doors,
    windows: editorState.windows,
    columns: editorState.columns,
    staircases: editorState.stairs,
    selectedElement: selectedElement as any,
    unit,
  }), [editorState.walls, editorState.rooms, editorState.doors, editorState.windows, editorState.columns, editorState.stairs, selectedElement, unit]);

  // Locate diagnostic issue on canvas with animated beacon
  const handleLocateDiagnosticIssue = useCallback((issue: any) => {
    let targetX = 0;
    let targetY = 0;
    let found = false;

    if (issue.elementIds && issue.elementIds.length > 0) {
      for (const id of issue.elementIds) {
        const wall = editorState.walls.find(w => w.id === id);
        if (wall) {
          targetX = (wall.x1 + wall.x2) / 2;
          targetY = (wall.y1 + wall.y2) / 2;
          found = true;
          break;
        }
        const room = editorState.rooms.find(r => r.id === id);
        if (room) {
          targetX = room.x + room.width / 2;
          targetY = room.y + room.height / 2;
          found = true;
          break;
        }
        const door = editorState.doors.find(d => d.id === id);
        if (door) {
          targetX = door.x;
          targetY = door.y;
          found = true;
          break;
        }
        const win = editorState.windows.find(w => w.id === id);
        if (win) {
          targetX = win.x;
          targetY = win.y;
          found = true;
          break;
        }
      }
    }

    if (!found && issue.location) {
      const match = String(issue.location).match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
      if (match) {
        targetX = parseFloat(match[1]);
        targetY = parseFloat(match[2]);
        found = true;
      }
    }

    if (found) {
      const containerW = containerRef.current?.clientWidth || window.innerWidth;
      const containerH = containerRef.current?.clientHeight || window.innerHeight;
      const newZoom = 1.35;
      const targetScreenX = containerW / 2;
      const targetScreenY = containerH / 2;
      setPanX(targetScreenX - targetX * GRID_SIZE_PX * newZoom);
      setPanY(targetScreenY - targetY * GRID_SIZE_PX * newZoom);
      setZoom(newZoom);

      setDiagnosticBeacon({
        x: targetX,
        y: targetY,
        title: issue.title || 'Diagnostic Issue',
        id: issue.id,
      });

      setTimeout(() => {
        setDiagnosticBeacon(b => (b?.id === issue.id ? null : b));
      }, 6000);
      onNotify(`Focused on: ${issue.title} (${issue.location})`, 'info');
    } else {
      onNotify(`Issue located at ${issue.location}`, 'info');
    }
  }, [editorState, onNotify]);

  // Apply chosen starter template into current floor
  const handleApplyStarterTemplate = useCallback((tpl: FloorPlanStarterTemplate) => {
    const wallIdMap = new Map<string, string>();
    const walls = tpl.walls.map(w => {
      const newId = uid('wall');
      wallIdMap.set(w.id, newId);
      return { ...w, id: newId };
    });

    const rooms = (tpl.rooms || []).map(r => ({ ...r, id: uid('room') }));
    const doors = (tpl.doors || []).map(d => ({
      ...d,
      id: uid('door'),
      wallId: d.wallId ? wallIdMap.get(d.wallId) : undefined,
    }));
    const windows = (tpl.windows || []).map(w => ({
      ...w,
      id: uid('win'),
      wallId: w.wallId ? wallIdMap.get(w.wallId) : undefined,
    }));
    const furniture = (tpl.furniture || []).map(f => ({ ...f, id: uid('furn') }));

    const nextState: EditorState = {
      walls,
      rooms,
      doors,
      windows,
      furniture,
      stairs: [],
      columns: [],
      annotations: [],
    };
    dispatchWithHistory({ type: 'SET_STATE', payload: nextState });
    markUnsaved();
    setShowStarterTemplatesModal(false);
    setDismissedStartCard(true);
    setTimeout(() => handleFitToScreen(), 150);
    onNotify(`Loaded ${tpl.name} layout successfully!`, 'success');
  }, [dispatchWithHistory, markUnsaved, handleFitToScreen, onNotify]);

  // Execute validated actions produced by AI or user confirmations
  const executeValidatedAction = useCallback((action: ValidatedPlanAction) => {
    const validation = validatePlanAction(action);
    if (!validation.valid || !validation.sanitizedAction) {
      onNotify(validation.error || 'Invalid action rejected by safety engine.', 'error');
      return;
    }
    const sa = validation.sanitizedAction;
    const p = sa.payload;

    switch (sa.action) {
      case 'ADD_WALL': {
        if (p) {
          dispatchWithHistory({
            type: 'ADD_WALL',
            payload: p,
          });
          triggerAiFeedback(`Wall added (${formatLength(Math.hypot(p.x2 - p.x1, p.y2 - p.y1), unit)})`);
        }
        break;
      }
      case 'UPDATE_WALL': {
        if (sa.objectId && p) {
          dispatchWithHistory({
            type: 'UPDATE_WALL',
            id: sa.objectId,
            changes: p,
          });
        }
        break;
      }
      case 'DELETE_WALL': {
        const id = sa.objectId || p?.id;
        if (id) {
          dispatchWithHistory({
            type: 'DELETE_WALL',
            id,
          });
        }
        break;
      }
      case 'ADD_ROOM': {
        if (p) {
          dispatchWithHistory({
            type: 'ADD_ROOM',
            payload: p,
          });
          triggerAiFeedback(`Room added (${p.label || p.roomType || 'Room'})`);
        }
        break;
      }
      case 'UPDATE_ROOM': {
        const id = sa.objectId || p?.id;
        if (id) {
          const existing = editorState.rooms.find(r => r.id === id);
          if (existing) {
            const updated = {
              ...existing,
              ...(sa.property ? { [sa.property]: sa.value } : p),
            };
            dispatchWithHistory({
              type: 'UPDATE_ROOM',
              id,
              changes: updated,
            });
          }
        }
        break;
      }
      case 'DELETE_ROOM': {
        const id = sa.objectId || p?.id;
        if (id) {
          dispatchWithHistory({
            type: 'DELETE_ROOM',
            id,
          });
        }
        break;
      }
      case 'ADD_DOOR': {
        if (p) {
          dispatchWithHistory({
            type: 'ADD_DOOR',
            payload: p,
          });
          triggerAiFeedback(`Door added (${p.doorType || p.type || 'Single'})`);
        }
        break;
      }
      case 'ADD_WINDOW': {
        if (p) {
          dispatchWithHistory({
            type: 'ADD_WINDOW',
            payload: p,
          });
          triggerAiFeedback(`Window added (${p.windowType || p.type || 'Standard'})`);
        }
        break;
      }
      case 'ADD_COLUMN': {
        if (p) {
          dispatchWithHistory({
            type: 'ADD_COLUMN',
            payload: p,
          });
          triggerAiFeedback(`Column placed (${p.width}×${p.height})`);
        }
        break;
      }
      case 'ADD_STAIR': {
        if (p) {
          dispatchWithHistory({
            type: 'ADD_STAIRS',
            payload: p,
          });
          triggerAiFeedback('Staircase flight added');
        }
        break;
      }
      case 'SWITCH_VIEW': {
        if (sa.value === '3D') {
          setShow3D(true);
        } else {
          setShow3D(false);
        }
        break;
      }
      default:
        break;
    }
  }, [dispatchWithHistory, editorState.rooms, triggerAiFeedback, unit, onNotify]);

  const handleOpenFixPlanModal = useCallback(() => {
    const issues = diagnosePlanIssues(
      editorState.walls,
      editorState.rooms,
      editorState.doors,
      editorState.windows,
      unit
    );
    setDiagnosticIssues(issues);
    setIsFixPlanModalOpen(true);
  }, [editorState.walls, editorState.rooms, editorState.doors, editorState.windows, unit]);

  const handleOpenAnalyzeModal = useCallback(() => {
    const report = analyzePlanMetrics(
      editorState.walls,
      editorState.rooms,
      editorState.doors,
      editorState.windows,
      editorState.columns,
      editorState.stairs,
      unit
    );
    setAnalysisReport(report);
    setIsAnalyzePlanModalOpen(true);
  }, [editorState.walls, editorState.rooms, editorState.doors, editorState.windows, editorState.columns, editorState.stairs, unit]);


  const handleApplyLayoutProposal = useCallback((proposal: ProposedLayoutResult) => {
    dispatchWithHistory({
      type: 'SET_STATE',
      payload: {
        ...editorState,
        walls: [...editorState.walls, ...proposal.walls],
        rooms: [...editorState.rooms, ...proposal.rooms],
        doors: [...editorState.doors, ...proposal.doors],
        windows: [...editorState.windows, ...proposal.windows],
      },
    });
    triggerAiFeedback(`Applied ${proposal.title}`);
    onNotify(`Applied ${proposal.title}`, 'success');
  }, [dispatchWithHistory, editorState, triggerAiFeedback, onNotify]);

  // ── Keyboard Shortcuts ───────────────────────────────

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      // While a sheet is open the keys belong to it, not to the drawing behind it.
      if (document.querySelector('.m-sheet-backdrop')) return;

      // Ctrl + K / Cmd + K: Building Mistry AI
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setIsMistryAiOpen(prev => !prev);
        return;
      }

      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        setIsSpacePressed(true);
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        if (e.shiftKey) handleRedo(); else handleUndo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') { e.preventDefault(); handleRedo(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); handleSave(); }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C')) { e.preventDefault(); handleCopySelected(); }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'v' || e.key === 'V')) { e.preventDefault(); handlePaste(); }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'd' || e.key === 'D')) { e.preventDefault(); handleDuplicateSelected(); }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'l' || e.key === 'L')) { e.preventDefault(); handleToggleLockSelected(); }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedElement) { handleDeleteSelected(); }
      }
      if (e.key === 'Escape') {
        setIsDrawingWall(false);
        setWallStart(null);
        setActiveTool('select');
        setSelectedElement(null);
        setSelectedFurnitureToPlace(null);
        setIsAiAssistantOpen(false);
        setIsMistryAiOpen(false);
        setSketchProposal(null);
      }
      // The single-letter shortcuts below never fire together with Ctrl / Cmd / Alt, so
      // Ctrl+D (duplicate) does not also pick the Door tool.
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'v' || e.key === 'V') setActiveTool('select');
      if (e.key === 'w' || e.key === 'W') setActiveTool('wall');
      if (e.key === 'e' || e.key === 'E') setActiveTool('eraser');
      if (e.key === 'a' || e.key === 'A' || e.key === 's' || e.key === 'S') setActiveTool('ai_draw');

      if (e.key === 'r' || e.key === 'R') {
        if (selectedElement && activeTool === 'select') {
          handleRotateSelected();
        } else {
          setActiveTool('room');
        }
      }
      if (e.key === 'd' || e.key === 'D') setActiveTool('door');
      if (e.key === 'm' || e.key === 'M') setShowDimensions(d => !d);
      if (e.key === 'h' || e.key === 'H') setActiveTool('pan');
      if (e.key === 'g' || e.key === 'G') setShowGrid(g => !g);
      if (e.key === 'f' || e.key === 'F') handleFitToScreen();
      if (e.key === '0') handleResetView();
      if (e.key === '+' || e.key === '=') setZoom(z => Math.min(MAX_ZOOM, +(z * 1.25).toFixed(2)));
      if (e.key === '-' || e.key === '_') setZoom(z => Math.max(MIN_ZOOM, +(z * 0.8).toFixed(2)));
      if (e.key === 'Enter' && selectedElement?.type === 'wall') openWallEditRef.current(selectedElement.id);
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [
    selectedElement, activeTool, handleUndo, handleRedo, handleSave,
    handleDeleteSelected, handleCopySelected, handlePaste, handleDuplicateSelected,
    handleToggleLockSelected, handleRotateSelected, handleFitToScreen, handleResetView
  ]);

  // ── Snapping ──────────────────────────────────────────
  // How far the pointer reaches for a corner, crossing or wall. It is a finger-sized distance
  // on screen, converted to plan units for the current zoom, so snapping feels the same zoomed
  // in or out. The Snap reach setting scales it.
  const snapReachPlan = () => {
    const feet = baseUnitOf(unit) === 'feet';
    const reach = pixelsToPlan((touchInputRef.current ? 22 : 14) * snapReach, zoom);
    return Math.min(feet ? 3 : 0.9, Math.max(feet ? 0.25 : 0.08, reach));
  };

  const snapAt = (x: number, y: number, walls: FloorPlanWall[] = editorState.walls, toWalls = snapToWallEnabled) =>
    findSnapPoint(x, y, walls, snapToGridEnabled ? gridStep : 0, snapReachPlan(), snapToEndpointsEnabled, toWalls);

  /** Settings for reading a freehand stroke, for the current zoom, unit and Snap choices. */
  const sketchOptions = (extra: Partial<SketchOptions> = {}): SketchOptions => {
    const feet = baseUnitOf(unit) === 'feet';
    const joins = snapToEndpointsEnabled || snapToWallEnabled;
    return {
      unit,
      thickness: wallThickness,
      newId: () => uid('wall'),
      snapAngles: sketchAngles === '45' ? DEFAULT_SNAP_ANGLES : sketchAngles === '90' ? ORTHO_SNAP_ANGLES : [],
      // Wobble up to about a fingertip wide is ignored.
      simplifyTolerance: Math.max(joinTolerance(unit) * 2, pixelsToPlan(touchInputRef.current ? 12 : 8, zoom)),
      endpointTolerance: joins ? Math.max(snapReachPlan() * 1.25, joinTolerance(unit) * 2) : joinTolerance(unit),
      minSegment: Math.min(feet ? 2 : 0.6, Math.max(feet ? 1 : 0.3, pixelsToPlan(12, zoom))),
      grid: snapToGridEnabled ? gridStep : 0,
      ...extra,
    };
  };

  /** Adds the walls a stroke became, as one undo step, and says what was done. */
  const commitSketch = (result: SketchResult) => {
    setSketchProposal(null);
    if (result.walls.length === 0) return;
    dispatchWithHistory({ type: 'SET_WALLS', walls: [...editorState.walls, ...result.walls] });
    setSketchNotice(describeSketch(result, v => formatDimension(v, unit)));
  };

  // Handlers created in an earlier render reach the current versions through this ref.
  const liveRef = useRef({ snapAt, sketchOptions, commitSketch });
  liveRef.current = { snapAt, sketchOptions, commitSketch };

  // ── Mouse Handlers ────────────────────────────────────

  /**
   * Ends a wall at the pointer and returns where it ended. `start` is passed in rather than
   * read from state, so a touch drag finishes its own wall even when the finger lifts before
   * the next render.
   */
  const finishWallAt = (start: { x: number; y: number }, e: React.MouseEvent<SVGSVGElement>) => {
    const svgPos = getSvgPos(e);
    const world = svgToWorld(svgPos.x, svgPos.y);
    let snapPt = snapAt(world.x, world.y);
    if (e.shiftKey || isOrthoActive) {
      const ortho = snapAngleOrtho(start.x, start.y, snapPt.x, snapPt.y);
      snapPt = { ...snapPt, x: ortho.x, y: ortho.y };
    }

    const targetX1 = start.x;
    const targetY1 = start.y;
    let targetX2 = snapPt.x;
    let targetY2 = snapPt.y;

    // Canva-style Auto-Correct: A wall drawn nearly level (0°/180°), upright (90°/270°) or at 45°
    // is automatically straightened ("user thapa draw pannu auto currect aganu canva erukka mari").
    const joinedSomething = snapPt.type === 'endpoint' || snapPt.type === 'midpoint' || snapPt.type === 'intersection' || snapPt.type === 'wall';
    if (!joinedSomething) {
      const dx = targetX2 - targetX1;
      const dy = targetY2 - targetY1;
      const dist = Math.hypot(dx, dy);
      if (dist > 0.35) {
        const snapped = snapDirection(directionDeg({ x: targetX1, y: targetY1 }, { x: targetX2, y: targetY2 }), DEFAULT_SNAP_ANGLES, 16, 12);
        if (snapped === 0) {
          targetY2 = targetY1;
        } else if (snapped === 90) {
          targetX2 = targetX1;
        } else if (snapped === 45 || snapped === 135) {
          const run = snapToGridEnabled ? snapToGrid((Math.abs(dx) + Math.abs(dy)) / 2) : (Math.abs(dx) + Math.abs(dy)) / 2;
          targetX2 = targetX1 + Math.sign(dx) * run;
          targetY2 = targetY1 + Math.sign(dy) * run;
        }
      }
    }

    if (Math.abs(targetX2 - targetX1) > 0.05 || Math.abs(targetY2 - targetY1) > 0.05) {
      const newWall: FloorPlanWall = {
        id: uid('wall'),
        x1: targetX1,
        y1: targetY1,
        x2: targetX2,
        y2: targetY2,
        thickness: wallThickness,
        wallType: 'exterior',
        layer: 'walls',
      };
      // A wall is never laid on top of one that is already there: only the part that is
      // new is added, and an exact repeat adds nothing.
      const pieces = trimNewWall(newWall, editorState.walls, unit, () => uid('wall'));
      if (pieces.length === 0) {
        onNotify('There is already a wall there.', 'info');
      } else if (pieces.length === 1) {
        // Adding the wall also recalculates the rooms it encloses (see reducePlan), for
        // rooms of any shape. The room is named "Room N"; its use is never guessed.
        dispatchWithHistory({ type: 'ADD_WALL', payload: pieces[0] });
      } else {
        dispatchWithHistory({ type: 'SET_WALLS', walls: [...editorState.walls, ...pieces] });
      }
    }
    return { x: targetX2, y: targetY2 };
  };

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (resizingWall) return;

      // Panning triggers:
      // 1. Middle mouse button (button === 1)
      // 2. Right mouse button (button === 2)
      // 3. Spacebar held + left click
      // 4. Alt + left click
      // 5. Active tool is 'pan'
      // 6. Active tool is 'select' and clicking empty background
      if (
        e.button === 1 ||
        e.button === 2 ||
        (e.button === 0 && (e.altKey || isSpacePressed || activeTool === 'pan' || activeTool === 'select'))
      ) {
        const svgPos = getSvgPos(e);
        setIsPanning(true);
        panMovedRef.current = false;
        setPanStart({ x: svgPos.x, y: svgPos.y, panX, panY });
        e.preventDefault();
        return;
      }
      if (e.button !== 0) return;

      const svgPos = getSvgPos(e);
      const world = svgToWorld(svgPos.x, svgPos.y);
      const snapped = { x: snapToGrid(world.x), y: snapToGrid(world.y) };

      // The wall under the pointer: within a finger's reach on screen, whatever the zoom.
      const wallUnder = (): FloorPlanWall | null => {
        const reach = pixelsToPlan(isMobile ? 24 : 14, zoom);
        let best: FloorPlanWall | null = null;
        let bestDist = Infinity;
        for (const w of editorState.walls) {
          const d = pointSegmentDistance(world, { x: w.x1, y: w.y1 }, { x: w.x2, y: w.y2 });
          if (d <= reach + (w.thickness || 0) / 2 && d < bestDist) { bestDist = d; best = w; }
        }
        return best;
      };

      if (activeTool === 'eraser') {
        const reach = pixelsToPlan(isMobile ? 26 : 16, zoom);
        const doorHit = editorState.doors.find(d => Math.hypot(d.x - world.x, d.y - world.y) <= Math.max(reach, d.width / 2));
        if (doorHit) { handleEraseElement('door', doorHit.id); return; }
        const winHit = editorState.windows.find(w => Math.hypot(w.x - world.x, w.y - world.y) <= Math.max(reach, w.width / 2));
        if (winHit) { handleEraseElement('window', winHit.id); return; }
        const furnHit = editorState.furniture.find(f => Math.hypot(f.x - world.x, f.y - world.y) <= Math.max(reach, f.width / 2));
        if (furnHit) { handleEraseElement('furniture', furnHit.id); return; }
        const colHit = editorState.columns.find(c => Math.hypot(c.x - world.x, c.y - world.y) <= Math.max(reach, (c.width || 0) / 2));
        if (colHit) { handleEraseElement('column', colHit.id); return; }
        const stairHit = editorState.stairs.find(s => Math.hypot(s.x - world.x, s.y - world.y) <= reach);
        if (stairHit) { handleEraseElement('stairs', stairHit.id); return; }
        // A wall: only the part between the two nearest joints is erased, never the walls it
        // is connected to (src/domain/planEdit.ts, eraseWallSegment).
        const hitWall = wallUnder();
        if (hitWall) {
          applyEdit(eraseWallSegment(editorState, hitWall.id, world, unit, newPlanId));
          return;
        }
        const roomHit = editorState.rooms.find(r => pointInPolygon(world, roomOutline(r)));
        if (roomHit) {
          if (roomHit.fromWalls) {
            onNotify('This room is the space inside its walls. Erase a wall to open it up.', 'info');
            return;
          }
          handleEraseElement('room', roomHit.id);
          return;
        }
        return;
      }

      if (activeTool === 'split') {
        const hitWall = wallUnder();
        if (!hitWall) {
          onNotify(editorState.walls.length ? 'Tap on a wall to split it there.' : 'Draw a wall first.', 'info');
          return;
        }
        // The cut follows the grid when Snap is on, so the two parts get round lengths.
        const at = { x: snapToGrid(world.x), y: snapToGrid(world.y) };
        applyEdit(splitWall(editorState, hitWall.id, at, unit, newPlanId));
        return;
      }

      if (activeTool === 'wall') {
        if (!isDrawingWall) {
          const snapPt = liveRef.current.snapAt(world.x, world.y);
          setWallStart({ x: snapPt.x, y: snapPt.y });
          setIsDrawingWall(true);
        } else if (wallStart) {
          // Through the ref: always the newest snap, thickness and angle settings.
          setWallStart(latestInputRef.current.finishWallAt(wallStart, e));
          setLiveLengthBadge(null);
          setSnapIndicator(null);
        }
      } else if (activeTool === 'ai_draw') {
        // Sketch mode: a new stroke starts. A result still waiting to be accepted is dropped,
        // the same as pressing Redraw.
        freehandRef.current = [{ x: world.x, y: world.y }];
        setSketchProposal(null);
        setSketchNotice(null);
        setSketchPreview(null);
        setIsFreehandDrawing(true);
        setFreehandPoints(freehandRef.current);
      } else if (activeTool === 'room') {
        const w = draftRoomWidth || (unit === 'feet' ? 14 : 4.5);
        const h = draftRoomHeight || (unit === 'feet' ? 12 : 3.5);
        const newRoomId = uid('room');
        const roomNum = editorState.rooms.length + 1;
        const newRoom: FloorPlanRoom = {
          id: newRoomId,
          roomType: selectedRoomType,
          label: `${selectedRoomType} ${roomNum}`,
          x: snapped.x,
          y: snapped.y,
          width: w,
          height: h,
          rotation: 0,
          color: ROOM_COLORS[selectedRoomType],
          floorFinish: draftRoomFloorFinish || 'Wood Parquet',
          wallThickness: draftRoomThickness || (unit === 'feet' ? 0.75 : 0.23),
          layer: 'rooms',
        };
        dispatchWithHistory({
          type: 'ADD_ROOM',
          payload: newRoom,
        });
        setSelectedElement({ type: 'room', id: newRoomId });
        setActiveTool('select');
        onNotify(`Placed ${newRoom.label} (${w}×${h} ${unit === 'feet' ? 'ft' : 'm'})`, 'success');
      } else if (activeTool === 'door') {
        const feetBased = baseUnitOf(unit) === 'feet';
        const host = findHostWallForOpening(world.x, world.y, editorState.walls, feetBased ? 2.5 : 0.8);
        const defaultWidth = feetBased
          ? (selectedDoorType === 'Double' ? 5.0 : selectedDoorType === 'Main Entrance' ? 3.5 : 3.0)
          : (selectedDoorType === 'Double' ? 1.5 : selectedDoorType === 'Main Entrance' ? 1.05 : 0.9);
        // A door must sit on a wall, fit within it and not overlap another opening.
        if (!host) {
          onNotify(editorState.walls.length ? 'Tap on a wall to place the door.' : 'Draw a wall first. A door is placed on a wall.', 'info');
          return;
        }
        const fit = fitOpeningOnWall(host.wall, defaultWidth, world.x, world.y);
        if (!fit) {
          onNotify(`This wall is too short for a ${formatDim(defaultWidth, unit)} door.`, 'info');
          return;
        }
        if (openingOverlaps(host.wall.id, fit.wallOffset, defaultWidth, [...editorState.doors, ...editorState.windows])) {
          onNotify('There is already a door or window at this spot. Tap a clear part of the wall.', 'info');
          return;
        }
        const newDoorId = uid('door');
        dispatchWithHistory({
          type: 'ADD_DOOR',
          payload: {
            id: newDoorId,
            doorType: selectedDoorType,
            x: fit.x,
            y: fit.y,
            width: defaultWidth,
            rotation: fit.rotation,
            swingAngle: 90,
            wallId: host.wall.id,
            wallOffset: fit.wallOffset,
            hostWallThickness: host.wallThickness,
            layer: 'doors',
          },
        });
        setSelectedElement({ type: 'door', id: newDoorId });
        setActiveTool('select');
        onNotify(`${selectedDoorType} door placed (${formatDim(defaultWidth, unit)} wide)`, 'success');
      } else if (activeTool === 'window') {
        const feetBased = baseUnitOf(unit) === 'feet';
        const host = findHostWallForOpening(world.x, world.y, editorState.walls, feetBased ? 2.5 : 0.8);
        const winSpec = ARCHITECTURAL_WINDOW_TYPES.find(w => w.type === selectedWindowType);
        // Window presets are defined in feet; convert them for metre plans.
        const toPlan = (feet: number) => (feetBased ? feet : Math.round(feet * 0.3048 * 100) / 100);
        const winWidth = toPlan(winSpec ? winSpec.defaultWidth : 4.0);
        // A window must sit on a wall, fit within it and not overlap another opening.
        if (!host) {
          onNotify(editorState.walls.length ? 'Tap on a wall to place the window.' : 'Draw a wall first. A window is placed on a wall.', 'info');
          return;
        }
        const fit = fitOpeningOnWall(host.wall, winWidth, world.x, world.y);
        if (!fit) {
          onNotify(`This wall is too short for a ${formatDim(winWidth, unit)} window.`, 'info');
          return;
        }
        if (openingOverlaps(host.wall.id, fit.wallOffset, winWidth, [...editorState.doors, ...editorState.windows])) {
          onNotify('There is already a door or window at this spot. Tap a clear part of the wall.', 'info');
          return;
        }
        const newWinId = uid('win');
        dispatchWithHistory({
          type: 'ADD_WINDOW',
          payload: {
            id: newWinId,
            windowType: selectedWindowType,
            x: fit.x,
            y: fit.y,
            width: winWidth,
            height: toPlan(winSpec ? winSpec.defaultHeight : 4.0),
            sillHeight: toPlan(winSpec ? winSpec.defaultSillHeight : 3.0),
            frameThickness: toPlan(winSpec ? winSpec.frameThickness : 0.18),
            rotation: fit.rotation,
            wallId: host.wall.id,
            wallOffset: fit.wallOffset,
            hostWallThickness: host.wallThickness,
            layer: 'windows',
          },
        });
        setSelectedElement({ type: 'window', id: newWinId });
        setActiveTool('select');
        onNotify(`${selectedWindowType} window placed (${formatDim(winWidth, unit)} wide)`, 'success');
      } else if (activeTool === 'column') {
        dispatchWithHistory({
          type: 'ADD_COLUMN',
          payload: {
            id: uid('col'),
            shape: columnShape,
            x: snapped.x,
            y: snapped.y,
            width: columnShape === 'rectangular' ? 1.25 : 0.75,
            depth: 0.75,
            label: 'C',
            layer: 'structure',
          },
        });
        setActiveTool('select');
      } else if (activeTool === 'stairs') {
        dispatchWithHistory({
          type: 'ADD_STAIRS',
          payload: {
            id: uid('stair'),
            type: stairType,
            x: snapped.x,
            y: snapped.y,
            width: 3.5,
            length: 8,
            rotation: 0,
            steps: 14,
            direction: 'up',
            layer: 'stairs',
          },
        });
        setActiveTool('select');
      } else if (activeTool === 'furniture' && selectedFurnitureToPlace) {
        let posX = snapped.x;
        let posY = snapped.y;
        let rot = 0;
        const name = selectedFurnitureToPlace.itemType.toLowerCase();
        if (name.includes('tv') || name.includes('ac')) {
          const wallSnap = snapWallMountedItem(world.x, world.y, selectedFurnitureToPlace.width, selectedFurnitureToPlace.height, editorState.walls, 1.5);
          if (wallSnap) {
            posX = wallSnap.x;
            posY = wallSnap.y;
            rot = Math.round(wallSnap.rotation);
          }
        }
        dispatchWithHistory({
          type: 'ADD_FURNITURE',
          payload: {
            id: uid('furn'),
            itemType: selectedFurnitureToPlace.itemType,
            label: selectedFurnitureToPlace.itemType,
            category: selectedFurnitureToPlace.category,
            x: posX,
            y: posY,
            width: selectedFurnitureToPlace.width,
            height: selectedFurnitureToPlace.height,
            rotation: rot,
            layer: selectedFurnitureToPlace.category === 'kitchen' ? 'kitchen' : selectedFurnitureToPlace.category === 'bathroom' ? 'bathroom' : 'furniture',
          },
        });
        setSelectedFurnitureToPlace(null);
        setActiveTool('select');
      } else if (activeTool === 'annotation') {
        const text = window.prompt('Enter CAD annotation / label text:', 'Note');
        if (text && text.trim()) {
          dispatchWithHistory({
            type: 'ADD_ANNOTATION',
            payload: {
              id: uid('annot'),
              x: snapped.x,
              y: snapped.y,
              text: text.trim(),
              fontSize: 10,
              layer: 'annotations',
            },
          });
        }
        setActiveTool('select');
      } else if (activeTool === 'measure') {
        const snapPt = liveRef.current.snapAt(world.x, world.y);
        const pt = { x: snapPt.x, y: snapPt.y };
        if (!isMeasuring || !measureStart) {
          setMeasureStart(pt);
          setMeasureCurrent(pt);
          setIsMeasuring(true);
        } else {
          setMeasureCurrent(pt);
          setIsMeasuring(false);
          const dist = Math.hypot(pt.x - measureStart.x, pt.y - measureStart.y);
          const angle = (Math.atan2(pt.y - measureStart.y, pt.x - measureStart.x) * 180 / Math.PI + 360) % 360;
          onNotify(`Tape Measurement: ${formatLength(dist, unit)} at ${Math.round(angle)}°`, 'info');
        }
        return;
      } else if (activeTool === 'select') {
        setSelectedElement(null);
      }
    },
    [
      activeTool, isDrawingWall, wallStart, wallThickness, resizingWall,
      selectedRoomType, selectedDoorType, selectedWindowType, columnShape,
      stairType, selectedFurnitureToPlace, svgToWorld, getSvgPos, panX, panY,
      isOrthoActive,
      editorState, unit, dispatchWithHistory, onNotify,
      isSpacePressed, isMeasuring, measureStart,
      zoom, isMobile, snapToGrid, applyEdit, newPlanId,
      draftRoomWidth, draftRoomHeight, draftRoomThickness, draftRoomFloorFinish,
    ]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      const svgPos = getSvgPos(e);
      const world = svgToWorld(svgPos.x, svgPos.y);

      if (resizingWall) {
        if (jointDragRef.current) {
          // Move the corner: every wall end that met here moves together, so joined walls
          // stay joined. Rooms and hosted doors/windows follow through the reducer.
          // The corner snaps onto another corner or crossing within reach (so it can be
          // joined to a different wall), otherwise to the grid, and follows Snap on/off.
          const to = liveRef.current.snapAt(world.x, world.y, jointDragRef.current.others, false);
          dispatch({ type: 'SET_WALLS', walls: moveJoint(jointDragRef.current.walls, jointDragRef.current.origin, { x: to.x, y: to.y }, joinTolerance(unit)) });
          if (to.type === 'endpoint' || to.type === 'intersection' || to.type === 'midpoint') {
            setSnapIndicator({ ...to, screenX: to.x * GRID_SIZE_PX * zoom + panX, screenY: to.y * GRID_SIZE_PX * zoom + panY });
          } else {
            setSnapIndicator(null);
          }
          return;
        }
        const sx = snapToGridEnabled ? snapToGrid(world.x) : world.x;
        const sy = snapToGridEnabled ? snapToGrid(world.y) : world.y;
        if (resizingWall.endpoint === 1) {
          dispatch({ type: 'UPDATE_WALL', id: resizingWall.id, changes: { x1: sx, y1: sy } });
        } else {
          dispatch({ type: 'UPDATE_WALL', id: resizingWall.id, changes: { x2: sx, y2: sy } });
        }
        return;
      }

      if (isPanning && panStart) {
        const dx = svgPos.x - panStart.x;
        const dy = svgPos.y - panStart.y;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
          panMovedRef.current = true;
        }
        setPanX(panStart.panX + dx);
        setPanY(panStart.panY + dy);
        return;
      }

      // Sketch mode: follow the finger and show, live, the straight walls the stroke would
      // become. Nothing is added to the plan until the finger lifts.
      if (activeTool === 'ai_draw' && isFreehandDrawing) {
        const pts = [...freehandRef.current, { x: world.x, y: world.y }];
        freehandRef.current = pts;
        setFreehandPoints(pts);
        setSketchPreview(interpretStroke(pts, editorState.walls, liveRef.current.sketchOptions()));
        return;
      }

      // Drawing wall live length and snap calculation
      if (isDrawingWall && wallStart) {
        let snapPt = liveRef.current.snapAt(world.x, world.y);
        if (e.shiftKey || isOrthoActive) {
          const ortho = snapAngleOrtho(wallStart.x, wallStart.y, snapPt.x, snapPt.y);
          snapPt = { ...snapPt, x: ortho.x, y: ortho.y };
        } else if (snapPt.type === 'none' || snapPt.type === 'grid') {
          // Canva-style Smart Angle Auto-Correction:
          const dx = snapPt.x - wallStart.x;
          const dy = snapPt.y - wallStart.y;
          const rawDist = Math.hypot(dx, dy);
          if (rawDist > 0.35) {
            const snappedAngle = snapDirection(directionDeg(wallStart, snapPt), DEFAULT_SNAP_ANGLES, 16, 12);
            if (snappedAngle === 0) {
              snapPt = { ...snapPt, y: wallStart.y };
            } else if (snappedAngle === 90) {
              snapPt = { ...snapPt, x: wallStart.x };
            } else if (snappedAngle === 45 || snappedAngle === 135) {
              const signX = Math.sign(dx) || 1;
              const signY = Math.sign(dy) || 1;
              const run = (Math.abs(dx) + Math.abs(dy)) / 2;
              snapPt = { ...snapPt, x: wallStart.x + signX * run, y: wallStart.y + signY * run };
            }
          }
        }
        const len = Math.hypot(snapPt.x - wallStart.x, snapPt.y - wallStart.y);
        let angle = (Math.atan2(snapPt.y - wallStart.y, snapPt.x - wallStart.x) * 180) / Math.PI;
        if (angle < 0) angle += 360;

        // Mouse: beside the cursor. Finger: at the middle of the wall, above it, so neither
        // the fingertip nor the end point being placed is covered.
        const startSx = wallStart.x * GRID_SIZE_PX * zoom + panX;
        const startSy = wallStart.y * GRID_SIZE_PX * zoom + panY;
        setLiveLengthBadge({
          lengthStr: formatDimension(len, unit),
          alt: formatOtherUnits(len, unit),
          snapped: snapPt.type === 'endpoint' ? 'joins a corner' : snapPt.type === 'midpoint' ? 'at a wall middle'
            : snapPt.type === 'wall' || snapPt.type === 'intersection' ? 'joins a wall'
            : snapPt.type === 'wall-axis' ? 'lines up with a wall' : undefined,
          angleDeg: Math.round(angle),
          screenX: touchInputRef.current ? Math.max(8, (startSx + svgPos.x) / 2 - 40) : svgPos.x + 18,
          screenY: touchInputRef.current ? Math.max(8, (startSy + svgPos.y) / 2 - 44) : svgPos.y - 18,
        });

        if (snapPt.type !== 'none') {
          setSnapIndicator({
            ...snapPt,
            screenX: snapPt.x * GRID_SIZE_PX * zoom + panX,
            screenY: snapPt.y * GRID_SIZE_PX * zoom + panY,
          });
        } else {
          setSnapIndicator(null);
        }
        setCurrentMousePos({ x: snapPt.x, y: snapPt.y });
        return;
      }

      if (isDragging && dragStartPos && dragElementSnapshot && selectedElement) {
        const dx = world.x - svgToWorld(dragStartPos.x, dragStartPos.y).x;
        const dy = world.y - svgToWorld(dragStartPos.y, dragStartPos.y).y;
        const snappedDx = snapToGridEnabled ? snapToGrid(dx) : dx;
        const snappedDy = snapToGridEnabled ? snapToGrid(dy) : dy;

        const { type, id } = selectedElement;
        if (type === 'wall' && dragStartStateRef.current) {
          // Slide the wall; walls joined to its ends stretch with it. Doors, windows and
          // rooms follow through the reducer, so the plan stays connected.
          dispatch({ type: 'SET_WALLS', walls: translateWall(dragStartStateRef.current.walls, id, snappedDx, snappedDy, joinTolerance(unit)) });
        } else if (type === 'wall') {
          const snap = dragElementSnapshot as FloorPlanWall;
          dispatch({
            type: 'UPDATE_WALL', id,
            changes: {
              x1: snapToGridEnabled ? snapToGrid(snap.x1 + snappedDx) : snap.x1 + snappedDx,
              y1: snapToGridEnabled ? snapToGrid(snap.y1 + snappedDy) : snap.y1 + snappedDy,
              x2: snapToGridEnabled ? snapToGrid(snap.x2 + snappedDx) : snap.x2 + snappedDx,
              y2: snapToGridEnabled ? snapToGrid(snap.y2 + snappedDy) : snap.y2 + snappedDy,
            },
          });
          // Synchronize hosted doors & windows so they stay attached to the moving wall
          if (dragHostedOpeningsSnapshot) {
            dragHostedOpeningsSnapshot.doors.forEach(d => {
              dispatch({
                type: 'UPDATE_DOOR',
                id: d.id,
                changes: {
                  x: snapToGridEnabled ? snapToGrid(d.x + snappedDx) : d.x + snappedDx,
                  y: snapToGridEnabled ? snapToGrid(d.y + snappedDy) : d.y + snappedDy,
                },
              });
            });
            dragHostedOpeningsSnapshot.windows.forEach(w => {
              dispatch({
                type: 'UPDATE_WINDOW',
                id: w.id,
                changes: {
                  x: snapToGridEnabled ? snapToGrid(w.x + snappedDx) : w.x + snappedDx,
                  y: snapToGridEnabled ? snapToGrid(w.y + snappedDy) : w.y + snappedDy,
                },
              });
            });
          }
        } else if (type === 'room') {
          const snap = dragElementSnapshot as FloorPlanRoom;
          if (snap.fromWalls) return; // move its walls instead; the room follows them
          dispatch({
            type: 'UPDATE_ROOM', id,
            changes: {
              x: snapToGridEnabled ? snapToGrid(snap.x + snappedDx) : snap.x + snappedDx,
              y: snapToGridEnabled ? snapToGrid(snap.y + snappedDy) : snap.y + snappedDy,
            },
          });
        } else if (type === 'door' || type === 'window') {
          // Snap hosted door/window along nearest wall
          // A door or window lives on a wall. It slides along the nearest wall, is kept clear
          // of the wall ends, and can not be dropped on top of another opening or off a wall.
          const hostProj = projectPointOntoWall(world.x, world.y, editorState.walls, baseUnitOf(unit) === 'feet' ? 3 : 0.9);
          const width = Number((dragElementSnapshot as { width?: number }).width) || 0;
          const fit = hostProj ? fitOpeningOnWall(hostProj.wall, width, world.x, world.y) : null;
          const taken = fit && hostProj
            ? openingOverlaps(hostProj.wall.id, fit.wallOffset, width, [...editorState.doors, ...editorState.windows], id)
            : false;
          if (fit && hostProj && !taken) {
            const changes = { x: fit.x, y: fit.y, rotation: fit.rotation, wallId: hostProj.wall.id, wallOffset: fit.wallOffset, hostWallThickness: hostProj.wall.thickness };
            if (type === 'door') dispatch({ type: 'UPDATE_DOOR', id, changes });
            else dispatch({ type: 'UPDATE_WINDOW', id, changes });
          }
        } else if (type === 'column') {
          const snap = dragElementSnapshot as FloorPlanColumn;
          dispatch({
            type: 'UPDATE_COLUMN', id,
            changes: {
              x: snapToGridEnabled ? snapToGrid(snap.x + snappedDx) : snap.x + snappedDx,
              y: snapToGridEnabled ? snapToGrid(snap.y + snappedDy) : snap.y + snappedDy,
            },
          });
        } else if (type === 'stairs') {
          const snap = dragElementSnapshot as FloorPlanStaircase;
          dispatch({
            type: 'UPDATE_STAIRS', id,
            changes: {
              x: snapToGridEnabled ? snapToGrid(snap.x + snappedDx) : snap.x + snappedDx,
              y: snapToGridEnabled ? snapToGrid(snap.y + snappedDy) : snap.y + snappedDy,
            },
          });
        } else if (type === 'furniture') {
          const snap = dragElementSnapshot as FloorPlanFurniture;
          const name = (snap.itemType || '').toLowerCase();
          if (name.includes('tv') || name.includes('ac')) {
            const wallSnap = snapWallMountedItem(world.x, world.y, snap.width, snap.height, editorState.walls, 1.5);
            if (wallSnap) {
              dispatch({
                type: 'UPDATE_FURNITURE', id,
                changes: { x: wallSnap.x, y: wallSnap.y, rotation: Math.round(wallSnap.rotation) }
              });
              return;
            }
          }
          dispatch({
            type: 'UPDATE_FURNITURE', id,
            changes: {
              x: snapToGridEnabled ? snapToGrid(snap.x + snappedDx) : snap.x + snappedDx,
              y: snapToGridEnabled ? snapToGrid(snap.y + snappedDy) : snap.y + snappedDy,
            },
          });
        } else if (type === 'annotation') {
          const snap = dragElementSnapshot as FloorPlanAnnotation;
          dispatch({
            type: 'UPDATE_ANNOTATION', id,
            changes: {
              x: snapToGridEnabled ? snapToGrid(snap.x + snappedDx) : snap.x + snappedDx,
              y: snapToGridEnabled ? snapToGrid(snap.y + snappedDy) : snap.y + snappedDy,
            },
          });
        }
        return;
      }

      if (activeTool === 'measure' && isMeasuring && measureStart) {
        const snapPt = liveRef.current.snapAt(world.x, world.y);
        setMeasureCurrent({ x: snapPt.x, y: snapPt.y });
        return;
      }

      setCurrentMousePos({ x: snapToGrid(world.x), y: snapToGrid(world.y) });
    },
    [
      resizingWall, isPanning, panStart, isDrawingWall, wallStart, isDragging, dragStartPos,
      dragElementSnapshot, selectedElement, svgToWorld, getSvgPos,
      isOrthoActive, editorState.walls, unit, zoom, panX, panY,
      activeTool, isMeasuring, measureStart, isFreehandDrawing, snapToGrid
    ]
  );

  const handleMouseUp = useCallback(() => {
    setLiveLengthBadge(null);
    setSnapIndicator(null);

    // Sketch mode: the stroke is read as straight, joined walls (src/domain/planSketch.ts).
    // Small corrections (wobble, a few degrees of tilt, a corner within snap reach) are
    // applied at once as one undo step and reported with an Undo button. A large correction
    // is only shown: it is added when the user accepts it, never silently.
    if (activeTool === 'ai_draw' && isFreehandDrawing) {
      const pts = freehandRef.current;
      freehandRef.current = [];
      setIsFreehandDrawing(false);
      setFreehandPoints([]);
      setSketchPreview(null);
      const result = interpretStroke(pts, editorState.walls, liveRef.current.sketchOptions());
      if (result.walls.length === 0) {
        // A plain tap says nothing; a real stroke that came to nothing is explained.
        if (pts.length > 4) onNotify(describeSketch(result, v => formatDimension(v, unit)), 'info');
      } else if (result.needsReview) {
        setSketchProposal({ result, points: pts });
      } else {
        liveRef.current.commitSketch(result);
      }
      return;
    }

    if (resizingWall) {
      if (dragStartStateRef.current !== editorState) {
        pushHistory(editorState);
        markUnsaved();
      }
      dragStartStateRef.current = null;
      jointDragRef.current = null;
      setResizingWall(null);
      return;
    }
    if (isPanning) {
      setIsPanning(false);
      setPanStart(null);
      if (!panMovedRef.current && activeTool === 'select') {
        setSelectedElement(null);
      }
      return;
    }
    if (isDragging && selectedElement) {
      if (dragStartStateRef.current !== editorState) {
        pushHistory(editorState);
        markUnsaved();
      }
      dragStartStateRef.current = null;
      setIsDragging(false);
      setDragStartPos(null);
      setDragElementSnapshot(null);
      setDragHostedOpeningsSnapshot(null);
    }
  }, [
    resizingWall, isPanning, isDragging, selectedElement, editorState, pushHistory, markUnsaved,
    activeTool, isFreehandDrawing, unit, onNotify
  ]);

  // ── Wheel Pan & Zoom ──────────────────────────────────

  const handleWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault();
      const svgRect = svgRef.current?.getBoundingClientRect();
      if (!svgRect) return;
      const mouseX = e.clientX - svgRect.left;
      const mouseY = e.clientY - svgRect.top;

      if (e.shiftKey) {
        // Shift + Wheel = Horizontal pan
        setPanX(x => x - e.deltaY);
      } else if (e.altKey || (Math.abs(e.deltaX) > 0 && Math.abs(e.deltaX) > Math.abs(e.deltaY))) {
        // Trackpad 2-finger pan
        setPanX(x => x - e.deltaX);
        setPanY(y => y - e.deltaY);
      } else {
        // Standard CAD Zoom directly centered on mouse pointer position
        const factor = e.deltaY < 0 ? 1.12 : 0.89;
        const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, +(zoom * factor).toFixed(3)));
        if (newZoom !== zoom) {
          const scale = newZoom / zoom;
          setPanX(Math.round(mouseX - scale * (mouseX - panX)));
          setPanY(Math.round(mouseY - scale * (mouseY - panY)));
          setZoom(newZoom);
        }
      }
    },
    [zoom, panX, panY]
  );

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  // ── Touch Pan & Pinch Zoom Handlers ───────────────────

  // ── Touch Pan & Pinch Zoom Handlers ───────────────────

  const touchToMouseEvent = (t: React.Touch) => {
    return {
      clientX: t.clientX,
      clientY: t.clientY,
      button: 0,
      buttons: 1,
      preventDefault: () => {},
      stopPropagation: () => {},
      shiftKey: false,
      altKey: false,
    } as unknown as React.MouseEvent<SVGSVGElement>;
  };

  const handleTouchStart = useCallback(
    (e: React.TouchEvent<SVGSVGElement>) => {
      if (e.touches.length === 2) {
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
        const svgRect = svgRef.current?.getBoundingClientRect();
        if (!svgRect) return;
        touchStartRef.current = {
          x: (t1.clientX + t2.clientX) / 2 - svgRect.left,
          y: (t1.clientY + t2.clientY) / 2 - svgRect.top,
          panX,
          panY,
          dist,
        };
        setIsPanning(true);
      } else if (e.touches.length === 1) {
        const t = e.touches[0];
        if (activeTool === 'pan') {
          const svgRect = svgRef.current?.getBoundingClientRect();
          if (!svgRect) return;
          touchStartRef.current = {
            x: t.clientX - svgRect.left,
            y: t.clientY - svgRect.top,
            panX,
            panY,
          };
          setIsPanning(true);
        } else {
          handleMouseDown(touchToMouseEvent(t));
        }
      }
    },
    [panX, panY, activeTool, handleMouseDown]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent<SVGSVGElement>) => {
      if (e.touches.length === 2 && touchStartRef.current?.dist) {
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
        const factor = dist / touchStartRef.current.dist;
        const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, +(zoom * factor).toFixed(3)));
        setZoom(newZoom);
        const svgRect = svgRef.current?.getBoundingClientRect();
        if (svgRect) {
          const midX = (t1.clientX + t2.clientX) / 2 - svgRect.left;
          const midY = (t1.clientY + t2.clientY) / 2 - svgRect.top;
          const dx = midX - touchStartRef.current.x;
          const dy = midY - touchStartRef.current.y;
          setPanX(touchStartRef.current.panX + dx);
          setPanY(touchStartRef.current.panY + dy);
        }
      } else if (e.touches.length === 1) {
        const t = e.touches[0];
        if (isPanning && touchStartRef.current) {
          const svgRect = svgRef.current?.getBoundingClientRect();
          if (!svgRect) return;
          const curX = t.clientX - svgRect.left;
          const curY = t.clientY - svgRect.top;
          const dx = curX - touchStartRef.current.x;
          const dy = curY - touchStartRef.current.y;
          setPanX(touchStartRef.current.panX + dx);
          setPanY(touchStartRef.current.panY + dy);
        } else if (!isPanning) {
          handleMouseMove(touchToMouseEvent(t));
        }
      }
    },
    [zoom, isPanning, handleMouseMove]
  );

  const handleTouchEnd = useCallback(() => {
    if (isPanning) {
      touchStartRef.current = null;
      setIsPanning(false);
    } else {
      handleMouseUp();
    }
  }, [isPanning, handleMouseUp]);

  // ── Element Selection MouseDown ───────────────────────

  const handleElementMouseDown = useCallback(
    (
      e: React.MouseEvent,
      type: 'wall' | 'room' | 'door' | 'window' | 'column' | 'stairs' | 'furniture' | 'annotation',
      id: string
    ) => {
      if (activeTool !== 'select') return;
      // A second finger starts a pinch; it never grabs the element under it.
      if ((e as React.PointerEvent).pointerType === 'touch' && (e as React.PointerEvent).isPrimary === false) return;
      if (type === 'wall') {
        const at = getSvgPos(e as unknown as React.MouseEvent<SVGSVGElement>);
        setWallTap({ id, point: svgToWorld(at.x, at.y) });
      }
      // On a touch screen a drag that happens to start on a wall or room must not move it.
      // The first tap selects; only an element that is already selected can be dragged.
      if ((e as React.PointerEvent).pointerType === 'touch' && selectedElement?.id !== id) {
        pendingSelectRef.current = { type, id } as SelectedElement;
        return;
      }
      // Tell the canvas handler that this press landed on an element (so it does not start
      // panning), while still letting it track the pointer for pinch detection.
      elementHitRef.current = true;
      if (!supportsPointer) e.stopPropagation();
      setSelectedElement({ type, id });
      const svgPos = getSvgPos(e as unknown as React.MouseEvent<SVGSVGElement>);
      setDragStartPos(svgPos);
      setIsDragging(true);
      // Whole-floor snapshot: lets a drag be cancelled cleanly and joined walls follow.
      dragStartStateRef.current = editorState;

      let snapshot: any = null;
      if (type === 'wall') snapshot = editorState.walls.find(w => w.id === id);
      else if (type === 'room') snapshot = editorState.rooms.find(r => r.id === id);
      else if (type === 'door') snapshot = editorState.doors.find(d => d.id === id);
      else if (type === 'window') snapshot = editorState.windows.find(w => w.id === id);
      else if (type === 'column') snapshot = editorState.columns.find(c => c.id === id);
      else if (type === 'stairs') snapshot = editorState.stairs.find(s => s.id === id);
      else if (type === 'furniture') snapshot = editorState.furniture.find(f => f.id === id);
      else if (type === 'annotation') snapshot = editorState.annotations.find(a => a.id === id);

      if (snapshot?.locked) {
        setIsDragging(false);
        setDragStartPos(null);
        setDragElementSnapshot(null);
        setDragHostedOpeningsSnapshot(null);
        return;
      }

      setDragElementSnapshot(snapshot ? JSON.parse(JSON.stringify(snapshot)) : null);
      if (type === 'wall') {
        const hostedDoors = editorState.doors.filter(d => d.wallId === id);
        const hostedWindows = editorState.windows.filter(w => w.wallId === id);
        setDragHostedOpeningsSnapshot({
          doors: JSON.parse(JSON.stringify(hostedDoors)),
          windows: JSON.parse(JSON.stringify(hostedWindows)),
        });
      } else {
        setDragHostedOpeningsSnapshot(null);
      }
    },
    [activeTool, getSvgPos, svgToWorld, editorState, selectedElement]
  );

  const handleEraseElement = useCallback((type: string, id: string) => {
    if (type === 'wall') {
      dispatchWithHistory({ type: 'DELETE_WALL', id });
      onNotify('Wall erased', 'info');
    } else if (type === 'room') {
      dispatchWithHistory({ type: 'DELETE_ROOM', id });
      onNotify('Room erased', 'info');
    } else if (type === 'door') {
      dispatchWithHistory({ type: 'DELETE_DOOR', id });
      onNotify('Door erased', 'info');
    } else if (type === 'window') {
      dispatchWithHistory({ type: 'DELETE_WINDOW', id });
      onNotify('Window erased', 'info');
    } else if (type === 'furniture') {
      dispatchWithHistory({ type: 'DELETE_FURNITURE', id });
      onNotify('Furniture erased', 'info');
    } else if (type === 'column') {
      dispatchWithHistory({ type: 'DELETE_COLUMN', id });
      onNotify('Column erased', 'info');
    } else if (type === 'stairs') {
      dispatchWithHistory({ type: 'DELETE_STAIRS', id });
      onNotify('Stairs erased', 'info');
    } else if (type === 'annotation') {
      dispatchWithHistory({ type: 'DELETE_ANNOTATION', id });
      onNotify('Annotation erased', 'info');
    }
    setSelectedElement(null);
  }, [dispatchWithHistory, onNotify]);

  // ── Pointer input: mouse, touch and pen through one path ──────────────
  //
  // Touch rules (they exist to prevent accidental drawing on a phone):
  //   • Two fingers always pinch-zoom and pan. Whatever the first finger had started is undone.
  //   • Select tool: drag empty space to move the view, drag an element to move it.
  //   • Wall tool: drag to draw a wall, or tap its two ends one after the other.
  //   • Door / Window / Room and other placing tools: a tap places, a drag only moves the view.

  const elementDownProps = (
    type: 'wall' | 'room' | 'door' | 'window' | 'column' | 'stairs' | 'furniture' | 'annotation',
    id: string
  ) => {
    // Eraser and Split act on a tap, worked out by the canvas from where the finger landed
    // (handleMouseDown). Elements do not take the press themselves, so a pinch or a pan that
    // happens to start on a wall never erases or cuts it.
    if (activeTool !== 'select') return { style: { pointerEvents: 'none' as const } };
    return supportsPointer
      ? { onPointerDown: (e: React.PointerEvent) => handleElementMouseDown(e, type, id) }
      : { onMouseDown: (e: React.MouseEvent) => handleElementMouseDown(e, type, id) };
  };

  const beginJointDrag = (e: React.SyntheticEvent, wall: FloorPlanWall, endpoint: 1 | 2) => {
    // Corners are only dragged with the Select tool, and never by the second finger of a pinch.
    if (activeTool !== 'select') return;
    const pe = e as unknown as React.PointerEvent;
    if (pe.pointerType === 'touch' && pe.isPrimary === false) return;
    elementHitRef.current = true;
    if (!supportsPointer) e.stopPropagation();
    if (wall.locked) {
      onNotify('This wall is locked. Unlock it to resize it.', 'info');
      return;
    }
    dragStartStateRef.current = editorState;
    const origin = endpoint === 1 ? { x: wall.x1, y: wall.y1 } : { x: wall.x2, y: wall.y2 };
    const tol = joinTolerance(unit);
    const meets = (x: number, y: number) => Math.hypot(x - origin.x, y - origin.y) <= tol;
    jointDragRef.current = {
      walls: editorState.walls,
      others: editorState.walls.filter(w => !meets(w.x1, w.y1) && !meets(w.x2, w.y2)),
      origin,
    };
    setResizingWall({ id: wall.id, endpoint });
  };

  /** Pressing a wall's measurement label. The length box opens when the press turns out to be a tap. */
  const dimDownProps = (wallId: string) => {
    if (activeTool !== 'select') return { style: { pointerEvents: 'none' as const } };
    const down = (e: React.SyntheticEvent) => {
      const pe = e as unknown as React.PointerEvent;
      if (pe.pointerType === 'touch' && pe.isPrimary === false) return;
      // Stops the browser's follow-up mouse events, which would land on the sheet that opens.
      e.preventDefault();
      dimHitRef.current = wallId;
      if (!supportsPointer) {
        e.stopPropagation();
        dimHitRef.current = null;
        openWallEditRef.current(wallId);
      }
    };
    return supportsPointer ? { onPointerDown: down } : { onMouseDown: down };
  };

  const jointDownProps = (wall: FloorPlanWall, endpoint: 1 | 2) => {
    if (activeTool !== 'select') return { style: { pointerEvents: 'none' as const } };
    return supportsPointer
      ? { onPointerDown: (e: React.PointerEvent) => beginJointDrag(e, wall, endpoint) }
      : { onMouseDown: (e: React.MouseEvent) => beginJointDrag(e, wall, endpoint) };
  };

  const fakeMouse = (x: number, y: number, shiftKey = false, altKey = false) => ({
    clientX: x, clientY: y, button: 0, buttons: 1, shiftKey, altKey,
    preventDefault: () => {}, stopPropagation: () => {},
  }) as unknown as React.MouseEvent<SVGSVGElement>;

  // The newest handlers, for code that runs after this render (animation frames, flushes).
  latestInputRef.current = { handleMouseDown, handleMouseMove, handleMouseUp, finishWallAt, isDrawingWall };

  // While a finger is on the canvas the toolbars ignore touches, so a resting thumb or palm
  // can not switch tools or open a sheet in the middle of a stroke. Set on the DOM directly:
  // it must not cost a re-render. Mouse input never sets it.
  const syncGestureFlag = () => {
    containerRef.current?.closest('.fp-editor-root')?.toggleAttribute('data-gesture', pointersRef.current.size > 0);
  };

  // ── Smooth view gestures ───────────────────────────────────────────────
  // Re-rendering a large plan for every finger movement is slow (profiled: ~170 ms per move
  // for 260 walls on a mid-range phone). While panning or pinching, the drawing is therefore
  // moved with a CSS transform only, and the new pan/zoom is written to state once, when the
  // gesture ends. `pendingViewRef` holds the view that is on screen but not yet in state.
  const showPendingView = (view: { panX: number; panY: number; zoom: number }) => {
    pendingViewRef.current = view;
    const svg = svgRef.current;
    if (!svg) return;
    const s = view.zoom / zoom;
    svg.style.transformOrigin = '0 0';
    svg.style.transform = `translate(${view.panX - s * panX}px, ${view.panY - s * panY}px) scale(${s})`;
  };

  const commitPendingView = () => {
    const view = pendingViewRef.current;
    pendingViewRef.current = null;
    if (!view) return;
    if (view.panX === panX && view.panY === panY && view.zoom === zoom) {
      if (svgRef.current) svgRef.current.style.transform = '';
      return;
    }
    // The transform is cleared in a layout effect, in the same frame as the re-render.
    setZoom(view.zoom);
    setPanX(view.panX);
    setPanY(view.panY);
  };

  // ── One move per animation frame ───────────────────────────────────────
  // Pointer moves can arrive faster than the plan can re-render. Only the latest position
  // is processed each frame, so the drawing never falls behind the finger.
  const queueMove = (x: number, y: number, shiftKey = false, altKey = false) => {
    pendingMoveRef.current = { x, y, shiftKey, altKey };
    if (moveFrameRef.current) return;
    moveFrameRef.current = requestAnimationFrame(() => {
      moveFrameRef.current = 0;
      const m = pendingMoveRef.current;
      pendingMoveRef.current = null;
      if (m) latestInputRef.current.handleMouseMove(fakeMouse(m.x, m.y, m.shiftKey, m.altKey));
    });
  };

  /** Applies a still-waiting move now and re-renders, so "up" sees the final position. */
  const flushMove = () => {
    if (moveFrameRef.current) {
      cancelAnimationFrame(moveFrameRef.current);
      moveFrameRef.current = 0;
    }
    const m = pendingMoveRef.current;
    pendingMoveRef.current = null;
    if (m) flushSync(() => latestInputRef.current.handleMouseMove(fakeMouse(m.x, m.y, m.shiftKey, m.altKey)));
  };

  /** Undoes whatever a single finger had started, so a pinch never leaves a mark on the plan. */
  const cancelSingleGesture = () => {
    const g = gestureRef.current;
    if (moveFrameRef.current) {
      cancelAnimationFrame(moveFrameRef.current);
      moveFrameRef.current = 0;
    }
    pendingMoveRef.current = null;
    if ((isDragging || resizingWall) && dragStartStateRef.current) {
      dispatch({ type: 'SET_STATE', payload: dragStartStateRef.current });
    }
    dragStartStateRef.current = null;
    jointDragRef.current = null;
    setIsDragging(false);
    setDragStartPos(null);
    setDragElementSnapshot(null);
    setDragHostedOpeningsSnapshot(null);
    setResizingWall(null);
    setIsPanning(false);
    setPanStart(null);
    setIsDrawingWall(false);
    setWallStart(null);
    setCurrentMousePos(null);
    freehandRef.current = [];
    setIsFreehandDrawing(false);
    setFreehandPoints([]);
    setSketchPreview(null);
    setLiveLengthBadge(null);
    setSnapIndicator(null);
    g.dragDrawing = false;
    g.wallStart = null;
    g.panning = false;
    g.dimHit = null;
    dimDragRef.current = null;
    setDimDrag(null);
  };

  // Leaving the Wall tool drops any wall that was started but not finished, whichever
  // button, shortcut or sheet changed the tool.
  useEffect(() => {
    if (activeTool === 'wall') return;
    setIsDrawingWall(false);
    setWallStart(null);
    setLiveLengthBadge(null);
    setSnapIndicator(null);
  }, [activeTool]);

  // The Wall button returns to whichever wall mode (Straight or Sketch) was used last.
  // Leaving Sketch drops a stroke that was still waiting for a decision.
  useEffect(() => {
    if (activeTool === 'wall' || activeTool === 'ai_draw') {
      setWallMode(activeTool);
      writeSetting('bm_fp_wall_mode', activeTool);
    }
    if (activeTool !== 'ai_draw') {
      freehandRef.current = [];
      setIsFreehandDrawing(false);
      setFreehandPoints([]);
      setSketchPreview(null);
      setSketchProposal(null);
    }
  }, [activeTool]);

  const cycleSketchAngles = () => {
    const next = sketchAngles === '45' ? '90' : sketchAngles === '90' ? 'free' : '45';
    setSketchAngles(next);
    writeSetting('bm_fp_sketch_angles', next);
  };

  // The newest reset, for the window listeners below.
  useEffect(() => {
    resetGestureRef.current = () => {
      if (pointersRef.current.size === 0 && gestureRef.current.kind === 'none') return;
      pointersRef.current.clear();
      cancelSingleGesture();
      commitPendingView();
      gestureRef.current.kind = 'none';
      syncGestureFlag();
    };
  });

  // Leaving the app, a system dialog or turning the phone can swallow the "finger up" event.
  // The gesture in progress is dropped then, so no half-drawn wall or stuck pinch is left.
  useEffect(() => {
    const reset = () => resetGestureRef.current();
    const onVisibility = () => { if (document.hidden) reset(); };
    window.addEventListener('blur', reset);
    window.addEventListener('orientationchange', reset);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('blur', reset);
      window.removeEventListener('orientationchange', reset);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  const pinchPoints = () => {
    const [a, b] = Array.from(pointersRef.current.values());
    const rect = svgRef.current!.getBoundingClientRect();
    // The rectangle already includes any gesture transform, so measure against the container.
    const host = containerRef.current?.getBoundingClientRect() || rect;
    return {
      dist: Math.max(1, Math.hypot(b.x - a.x, b.y - a.y)),
      midX: (a.x + b.x) / 2 - host.left,
      midY: (a.y + b.y) / 2 - host.top,
    };
  };

  // ── Moving a measurement label ─────────────────────────
  // A tap on a label opens the exact-length box; a drag moves the label (out from the wall,
  // or along it) so it can be read clearly. Only where the label is drawn changes: the wall
  // and its length are never touched.
  /** Where a label sits along its wall when the user has not moved it, in plan units. */
  const autoDimSlide = (wall: FloorPlanWall) => {
    if (!wallsBetweenRooms.has(wall.id)) return 0;
    const k = GRID_SIZE_PX * zoom;
    const onScreen = wallLength(wall) * k;
    const labelLength = formatDimension(wallLength(wall), unit).length * dimFontPx * 0.6 + 12;
    // Far enough along to clear the room's name in the middle, and only when the wall is long
    // enough on screen that the label stays well clear of its corners (where taps select the
    // walls that meet there). Otherwise it stays centred; it can always be dragged.
    const need = labelLength / 2 + 24;
    return need <= onScreen / 2 - labelLength / 2 - 40 ? -need / k : 0;
  };
  const beginDimDrag = (wallId: string, clientX: number, clientY: number) => {
    const wall = editorState.walls.find(w => w.id === wallId);
    const side = wallOutside.get(wallId);
    if (!wall || !side) return;
    const len = wallLength(wall) || 1;
    dimDragRef.current = {
      wallId, startX: clientX, startY: clientY,
      offset0: wall.dimensionOffset || 0, shift0: wall.dimensionShift ?? autoDimSlide(wall),
      normal: side, dir: { x: (wall.x2 - wall.x1) / len, y: (wall.y2 - wall.y1) / len },
    };
  };
  const moveDimDrag = (clientX: number, clientY: number) => {
    const d = dimDragRef.current;
    if (!d) return;
    const dx = clientX - d.startX, dy = clientY - d.startY;
    const scale = GRID_SIZE_PX * zoom;
    // Not closer to the wall than where it starts, and not more than 20 ft / 6 m out.
    const maxOut = baseUnitOf(unit) === 'feet' ? 20 : 6;
    const offset = Math.min(maxOut, Math.max(0, d.offset0 + (dx * d.normal.x + dy * d.normal.y) / scale));
    const shift = Math.min(maxOut, Math.max(-maxOut, d.shift0 + (dx * d.dir.x + dy * d.dir.y) / scale));
    dimDragLatestRef.current = { wallId: d.wallId, offset, shift };
    setDimDrag({ wallId: d.wallId, offset, shift });
  };
  const endDimDrag = () => {
    const d = dimDragRef.current;
    const last = dimDragLatestRef.current;
    dimDragRef.current = null;
    dimDragLatestRef.current = null;
    setDimDrag(null);
    if (d && last && last.wallId === d.wallId) {
      dispatchWithHistory({ type: 'UPDATE_WALL', id: d.wallId, changes: { dimensionOffset: tidy(last.offset), dimensionShift: tidy(last.shift) } });
    }
  };
  const dimDragLatestRef = useRef<{ wallId: string; offset: number; shift: number } | null>(null);
  const mouseDimRef = useRef<{ wallId: string; x: number; y: number; moved: boolean } | null>(null);

  const onCanvasPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    const onElement = elementHitRef.current;
    elementHitRef.current = false;
    const pendingSelect = pendingSelectRef.current;
    pendingSelectRef.current = null;
    const dimHit = dimHitRef.current;
    dimHitRef.current = null;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* capture is a nicety */ }
    touchInputRef.current = e.pointerType !== 'mouse';

    if (e.pointerType === 'mouse') {
      // A click on a measurement opens its length box and does nothing else: no pan, no
      // deselect. A drag from it moves the label instead (decided when the button comes up).
      if (dimHit && e.button === 0) {
        mouseDimRef.current = { wallId: dimHit, x: e.clientX, y: e.clientY, moved: false };
        return;
      }
      if (!onElement) handleMouseDown(e as unknown as React.MouseEvent<SVGSVGElement>);
      return;
    }

    const g = gestureRef.current;
    // A primary touch means no other finger is down. Anything still tracked was left behind by
    // an interrupted gesture (app switch, system dialog, lost capture) and must not turn this
    // touch into a pinch.
    if (e.isPrimary && pointersRef.current.size > 0) {
      pointersRef.current.clear();
      if (!onElement) cancelSingleGesture();
      commitPendingView();
      g.kind = 'none';
    }
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointersRef.current.size === 1) {
      Object.assign(g, {
        kind: 'single', onElement, pendingSelect, dimHit, downAt: { x: e.clientX, y: e.clientY },
        moved: false, dragDrawing: false, wallStart: null, panning: false,
      });
      // Freehand sketching starts at once; everything else waits to see tap or drag.
      if (activeTool === 'ai_draw') handleMouseDown(fakeMouse(e.clientX, e.clientY));
    } else if (pointersRef.current.size === 2) {
      cancelSingleGesture();
      const base = pendingViewRef.current || { panX, panY, zoom };
      const p = pinchPoints();
      Object.assign(g, {
        kind: 'pinch', startDist: p.dist, startZoom: base.zoom,
        // The plan point between the fingers; it stays between them while pinching.
        anchor: { x: (p.midX - base.panX) / (GRID_SIZE_PX * base.zoom), y: (p.midY - base.panY) / (GRID_SIZE_PX * base.zoom) },
      });
    }
  };

  const onCanvasPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.pointerType === 'mouse') {
      const md = mouseDimRef.current;
      if (md) {
        if (!md.moved && Math.hypot(e.clientX - md.x, e.clientY - md.y) > 4) {
          md.moved = true;
          beginDimDrag(md.wallId, md.x, md.y);
        }
        if (md.moved) moveDimDrag(e.clientX, e.clientY);
        return;
      }
      queueMove(e.clientX, e.clientY, e.shiftKey, e.altKey);
      return;
    }
    if (!pointersRef.current.has(e.pointerId)) return;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gestureRef.current;

    if (g.kind === 'pinch') {
      if (pointersRef.current.size < 2) return;
      const p = pinchPoints();
      // Zoom is always worked out from where the pinch started, so it can not run away.
      const nextZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, +((g.startZoom * p.dist) / g.startDist).toFixed(3)));
      showPendingView({
        zoom: nextZoom,
        panX: Math.round(p.midX - g.anchor.x * GRID_SIZE_PX * nextZoom),
        panY: Math.round(p.midY - g.anchor.y * GRID_SIZE_PX * nextZoom),
      });
      return;
    }
    if (g.kind !== 'single') return;

    if (!g.moved && Math.hypot(e.clientX - g.downAt.x, e.clientY - g.downAt.y) > 8) {
      g.moved = true;
      if (g.dimHit && (activeTool === 'select' || activeTool === 'pan')) beginDimDrag(g.dimHit, g.downAt.x, g.downAt.y);
    }
    if (!g.moved) return;
    if (dimDragRef.current) {
      moveDimDrag(e.clientX, e.clientY);
      return;
    }

    // Dragging a selected element / wall corner, or sketching freehand.
    if (g.onElement || activeTool === 'ai_draw') {
      queueMove(e.clientX, e.clientY);
      return;
    }
    if (activeTool === 'wall') {
      if (!g.dragDrawing) {
        // Drag to draw: the wall starts where the finger first touched. A start point left by
        // an earlier tap is only continued when the drag begins on it; a drag anywhere else
        // draws its own wall, so an old tap never pulls a wall across the plan.
        const down = getSvgPos(fakeMouse(g.downAt.x, g.downAt.y));
        const onAnchor = latestInputRef.current.isDrawingWall && !!wallStart && Math.hypot(
          down.x - (wallStart.x * GRID_SIZE_PX * zoom + panX),
          down.y - (wallStart.y * GRID_SIZE_PX * zoom + panY)
        ) <= 36;
        if (!onAnchor) {
          g.dragDrawing = true;
          const world = svgToWorld(down.x, down.y);
          const start = snapAt(world.x, world.y);
          g.wallStart = { x: start.x, y: start.y };
          setWallStart(g.wallStart);
          setIsDrawingWall(true);
          return;
        }
      }
      queueMove(e.clientX, e.clientY);
      return;
    }
    // Any other tool: a one-finger drag moves the view. Nothing is placed or changed.
    g.panning = true;
    panMovedRef.current = true;
    showPendingView({ zoom, panX: Math.round(panX + e.clientX - g.downAt.x), panY: Math.round(panY + e.clientY - g.downAt.y) });
  };

  const onCanvasPointerUp = (e: React.PointerEvent<SVGSVGElement>, cancelled = false) => {
    if (e.pointerType === 'mouse') {
      const md = mouseDimRef.current;
      if (md) {
        mouseDimRef.current = null;
        if (md.moved) {
          if (cancelled) { dimDragRef.current = null; setDimDrag(null); } else endDimDrag();
        } else if (!cancelled) {
          openWallEditRef.current(md.wallId);
        }
        return;
      }
      flushMove();
      latestInputRef.current.handleMouseUp();
      return;
    }
    if (!pointersRef.current.has(e.pointerId)) return;
    pointersRef.current.delete(e.pointerId);
    lastTapRef.current = { time: Date.now(), x: e.clientX, y: e.clientY };
    const g = gestureRef.current;

    if (g.kind === 'pinch') {
      // The finger left on the screen after a pinch does nothing until the screen is clear.
      if (pointersRef.current.size === 0) {
        g.kind = 'none';
        commitPendingView();
      }
      return;
    }
    if (g.kind !== 'single') return;
    g.kind = 'none';

    if (dimDragRef.current) {
      g.dimHit = null;
      if (cancelled) { dimDragRef.current = null; setDimDrag(null); } else endDimDrag();
      return;
    }
    if (cancelled) {
      cancelSingleGesture();
      commitPendingView();
      return;
    }
    flushMove();
    const input = latestInputRef.current;

    if (g.onElement || activeTool === 'ai_draw') {
      input.handleMouseUp();
      return;
    }
    if (g.panning) {
      g.panning = false;
      commitPendingView();
      return;
    }
    if (activeTool === 'wall') {
      if (g.dragDrawing) {
        // The wall ends where the finger lifts. A drag that barely left the spot is a shaky
        // tap, not a wall: it leaves no stub behind. One drag is one wall; the next drag
        // starts fresh and is not joined to this one unless it snaps there.
        const stub = Math.hypot(e.clientX - g.downAt.x, e.clientY - g.downAt.y) < 16;
        if (!stub && g.wallStart) input.finishWallAt(g.wallStart, fakeMouse(e.clientX, e.clientY));
        setIsDrawingWall(false);
        setWallStart(null);
      } else if (g.moved && input.isDrawingWall) {
        input.handleMouseDown(fakeMouse(e.clientX, e.clientY)); // continues from a tapped start point
      } else if (!g.moved) {
        input.handleMouseDown(fakeMouse(g.downAt.x, g.downAt.y));
      }
      g.dragDrawing = false;
      g.wallStart = null;
      setLiveLengthBadge(null);
      setSnapIndicator(null);
      return;
    }
    if (g.moved) return;
    if (g.dimHit) {
      // A tap on a measurement opens its length box. (A drag from it only moved the view.)
      const wallId = g.dimHit;
      g.dimHit = null;
      openWallEditRef.current(wallId);
      return;
    }
    if (activeTool === 'select' || activeTool === 'pan') {
      // A tap selects what was tapped, or clears the selection on empty space.
      setSelectedElement(g.pendingSelect);
      return;
    }
    // A tap with a placing tool places the item at the tapped point.
    input.handleMouseDown(fakeMouse(g.downAt.x, g.downAt.y));
    input.handleMouseUp();
  };

  const canvasInputProps = supportsPointer
    ? {
        onPointerDown: (e: React.PointerEvent<SVGSVGElement>) => {
          try { onCanvasPointerDown(e); } finally { syncGestureFlag(); }
        },
        onPointerMove: onCanvasPointerMove,
        onPointerUp: (e: React.PointerEvent<SVGSVGElement>) => {
          try { onCanvasPointerUp(e); } finally { syncGestureFlag(); }
        },
        onPointerCancel: (e: React.PointerEvent<SVGSVGElement>) => {
          try { onCanvasPointerUp(e, true); } finally { syncGestureFlag(); }
        },
      }
    : {
        // Browsers without Pointer Events: the earlier mouse + touch handlers.
        onMouseDown: handleMouseDown,
        onMouseMove: handleMouseMove,
        onMouseUp: handleMouseUp,
        onMouseLeave: handleMouseUp,
        onTouchStart: handleTouchStart,
        onTouchMove: handleTouchMove,
        onTouchEnd: handleTouchEnd,
      };

  // ── Metric Computations ───────────────────────────────

  // Sum of room outline areas (an L-shaped room counts its real outline, not its bounding box).
  const totalFloorArea = editorState.rooms.reduce((s, r) => s + roomArea(r), 0);
  const totalWallLength = editorState.walls.reduce((s, w) => s + wallLength(w), 0);
  const ceilingHeight = plan?.ceilingHeight || WALL_HEIGHT_DEFAULT;

  // Materials Estimation Calculations
  const wallArea = totalWallLength * ceilingHeight;
  const wallVolume = wallArea * wallThickness;
  const estimatedBricks = Math.ceil(wallVolume * 13.5); // Standard 9" brick
  const estimatedCementBags = Math.ceil((wallVolume * 0.25) / 1.25 + (wallArea * 2 * 0.05)); // Mortar + Plaster
  const estimatedSandCuFt = Math.ceil(wallVolume * 0.65);
  const estimatedSteelKg = Math.ceil(editorState.columns.length * 28 + totalWallLength * 1.8);
  const estimatedTileArea = Math.ceil(totalFloorArea * 1.1); // 10% wastage
  const estimatedPaintLitres = Math.ceil((wallArea * 2) / 80);

  // ── Export Handlers ───────────────────────────────────

  /**
   * A stand-alone copy of the drawing that frames the whole plan, whatever part of it is on
   * screen right now. Used for PNG and print/PDF so an export is never a cropped viewport.
   */
  const buildExportSvg = useCallback((): { text: string; width: number; height: number } | null => {
    if (!svgRef.current || !plan) return null;
    // A selected wall is drawn blue; the picture shows the plan as it is, not the selection.
    if (selectedElement) flushSync(() => setSelectedElement(null));
    const bbox = calculatePlanBoundingBox(
      editorState.walls, editorState.rooms, editorState.doors, editorState.windows,
      editorState.furniture, editorState.columns, editorState.stairs, plan.plotLength, plan.plotWidth
    );
    const k = GRID_SIZE_PX * zoom;
    const margin = 60;
    const w = bbox.width * k + margin * 2;
    const h = bbox.height * k + margin * 2;
    const x = (bbox.centerX - bbox.width / 2) * k + panX - margin;
    const y = (bbox.centerY - bbox.height / 2) * k + panY - margin;
    const clone = svgRef.current.cloneNode(true) as SVGSVGElement;
    // Editing aids are not part of the drawing: selection handles and highlights, the AI
    // preview and the live guide while drawing stay out of a picture or print.
    clone.querySelectorAll('.fp-wall-segment-hint, .fp-ai-preview, .fp-live-dim, .fp-wall-handles').forEach(n => n.remove());
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('viewBox', `${x} ${y} ${w} ${h}`);
    // Export at a fixed, generous resolution regardless of the current zoom.
    const scale = Math.min(4, 2000 / Math.max(w, h));
    const width = Math.round(w * scale);
    const height = Math.round(h * scale);
    clone.setAttribute('width', String(width));
    clone.setAttribute('height', String(height));
    clone.removeAttribute('style');
    return { text: new XMLSerializer().serializeToString(clone), width, height };
  }, [plan, editorState, zoom, panX, panY, selectedElement]);

  const handleExportPNG = useCallback(() => {
    const svg = buildExportSvg();
    if (!svg || !plan) return;
    const floorName = floorLevels[activeFloorIndex]?.name || 'Floor';
    const footer = 64;
    const url = URL.createObjectURL(new Blob([svg.text], { type: 'image/svg+xml;charset=utf-8' }));
    const img = new Image();
    const fail = () => {
      URL.revokeObjectURL(url);
      onNotify('The picture could not be created on this device. Try Print / PDF instead.', 'error');
    };
    img.onerror = fail;
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = svg.width;
        canvas.height = svg.height + footer;
        const ctx = canvas.getContext('2d');
        if (!ctx) return fail();
        ctx.fillStyle = viewMode === 'blueprint' ? '#0f172a' : '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, svg.width, svg.height);
        // Caption: what this is, its units, and what it is not.
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, svg.height, canvas.width, footer);
        ctx.fillStyle = '#0f172a';
        ctx.font = '600 20px sans-serif';
        ctx.fillText(`${plan.buildingName} · ${floorName} · dimensions in ${baseUnitOf(unit) === 'feet' ? 'feet and inches' : 'metres'} · not to scale`, 16, svg.height + 26);
        ctx.fillStyle = '#475569';
        ctx.font = '15px sans-serif';
        ctx.fillText(PLAN_DISCLAIMER, 16, svg.height + 50);
        URL.revokeObjectURL(url);
        canvas.toBlob(blob => {
          if (!blob || blob.size === 0) return onNotify('The picture could not be created on this device.', 'error');
          const fileName = `${plan.buildingName || 'floor-plan'}-${floorName}.png`.replace(/[\\/:*?"<>|]+/g, '-');
          const link = document.createElement('a');
          const blobUrl = URL.createObjectURL(blob);
          link.download = fileName;
          link.href = blobUrl;
          document.body.appendChild(link);
          link.click();
          link.remove();
          setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
          onNotify(`Picture created: ${fileName}`, 'success');
        }, 'image/png');
      } catch {
        fail();
      }
    };
    img.src = url;
  }, [buildExportSvg, plan, viewMode, floorLevels, activeFloorIndex, unit, onNotify]);

  const handleExportPDF = useCallback(() => {
    const exportSvg = buildExportSvg();
    if (!exportSvg || !plan) return;
    const svgData = exportSvg.text;

    const roomRows = editorState.rooms.map(r => `
      <tr>
        <td style="padding: 6px 12px; border: 1px solid #cbd5e1;">${r.label}</td>
        <td style="padding: 6px 12px; border: 1px solid #cbd5e1;">${r.roomType}</td>
        <td style="padding: 6px 12px; border: 1px solid #cbd5e1;">${formatDim(r.width, unit)} × ${formatDim(r.height, unit)}</td>
        <td style="padding: 6px 12px; border: 1px solid #cbd5e1; font-weight: 600;">${computeRoomArea(r, unit)}</td>
      </tr>
    `).join('');

    const printHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${plan.buildingName} - ${floorLevels[activeFloorIndex]?.name || plan.floorName} Architectural Plan</title>
        <style>
          @page { size: A4 landscape; margin: 10mm; }
          body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 16px; color: #1e293b; background: #ffffff; }
          .title-block {
            display: grid;
            grid-template-columns: 2fr 3fr;
            border: 2px solid #0f172a;
            padding: 12px 16px;
            margin-bottom: 12px;
            background: #f8fafc;
          }
          .title-block h1 { margin: 0 0 4px 0; font-size: 20px; font-weight: 800; color: #0284c7; }
          .title-block p { margin: 2px 0; font-size: 11px; color: #475569; }
          .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; font-size: 11px; }
          .canvas-box {
            width: 100%;
            border: 1px solid #cbd5e1;
            padding: 12px;
            box-sizing: border-box;
            background: #ffffff;
            display: flex;
            justify-content: center;
            align-items: center;
            margin-bottom: 12px;
          }
          .canvas-box svg { max-width: 100%; max-height: 480px; }
          .schedule-table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 12px; }
          .schedule-table th { background: #0f172a; color: #ffffff; padding: 6px 10px; text-align: left; }
          .footer-note { font-size: 9px; color: #64748b; border-top: 1px solid #cbd5e1; padding-top: 6px; display: flex; justify-content: space-between; }
        </style>
      </head>
      <body>
        <div class="title-block">
          <div>
            <h1>MISTRY FLOOR PLAN</h1>
            <p>Conceptual layout for planning and discussion</p>
            <p><strong>Project:</strong> ${plan.buildingName} ${plan.siteName ? `| <strong>Site:</strong> ${plan.siteName}` : ''}</p>
          </div>
          <div class="meta-grid">
            <div><strong>Drawing Level:</strong> ${floorLevels[activeFloorIndex]?.name || plan.floorName}</div>
            <div><strong>Scale:</strong> Not to scale. Use the written dimensions.</div>
            <div><strong>Plot Size:</strong> ${formatDim(plan.plotLength, unit)} × ${formatDim(plan.plotWidth, unit)}</div>
            <div><strong>Date:</strong> ${new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric' })}</div>
            <div><strong>Total room area:</strong> ${formatPlanArea(totalFloorArea, unit)}</div>
            <div><strong>Units:</strong> ${baseUnitOf(unit) === 'feet' ? 'Feet and inches' : 'Metres'}</div>
          </div>
        </div>

        <div class="canvas-box">
          ${svgData}
        </div>

        ${editorState.rooms.length > 0 ? `
          <table class="schedule-table">
            <thead>
              <tr>
                <th>Room Name</th>
                <th>Type</th>
                <th>Dimensions</th>
                <th>Area (room outline)</th>
              </tr>
            </thead>
            <tbody>
              ${roomRows}
              <tr style="background: #f1f5f9; font-weight: 700;">
                <td colspan="3" style="padding: 6px 12px; border: 1px solid #cbd5e1; text-align: right;">Total room area:</td>
                <td style="padding: 6px 12px; border: 1px solid #cbd5e1; color: #0284c7;">
                  ${formatPlanArea(totalFloorArea, unit)}
                </td>
              </tr>
            </tbody>
          </table>
        ` : ''}

        <div class="footer-note">
          <span>${PLAN_DISCLAIMER} ${PLAN_REVIEW_NOTE}</span>
          <span>Drawing Ref: ${plan.id.slice(0, 8)} | Page 1 of 1</span>
        </div>

        <script>
          window.onload = function() { setTimeout(function() { window.print(); }, 300); };
        </script>
      </body>
      </html>
    `;

    const printWin = window.open('', '_blank');
    if (printWin) {
      printWin.document.open();
      printWin.document.write(printHtml);
      printWin.document.close();
    } else {
      window.print();
    }
  }, [buildExportSvg, plan, editorState.rooms, floorLevels, activeFloorIndex, totalFloorArea, unit]);

  const handleExportDXF = useCallback(() => {
    if (!plan) return;
    try {
      const dxfContent = exportFloorPlanAsDxf(
        plan,
        editorState.walls,
        editorState.rooms,
        editorState.doors,
        editorState.windows,
        editorState.columns,
        editorState.furniture,
        unit
      );
      const blob = new Blob([dxfContent], { type: 'application/dxf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `${plan.buildingName || 'floor-plan'}-${floorLevels[activeFloorIndex]?.name || 'level'}.dxf`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
      onNotify('AutoCAD DXF exported successfully!', 'success');
    } catch (err: any) {
      onNotify(`Failed to export DXF: ${err.message}`, 'error');
    }
  }, [plan, editorState, floorLevels, activeFloorIndex, unit, onNotify]);

  const handleExportProjectJSON = useCallback(() => {
    if (!plan) return;
    try {
      // Every floor, with the floor on screen written back first so the file is up to date.
      const floors = switchFloor(floorLevels, activeFloorIndex, editorState, activeFloorIndex).floors;
      const jsonContent = JSON.stringify(exportPlan(plan, floors, new Date().toISOString()), null, 2);
      const blob = new Blob([jsonContent], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `${plan.buildingName || 'floor-plan'}-project.json`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
      onNotify('Plan file created. It can be opened again with Import Plan.', 'success');
    } catch (err: any) {
      onNotify(`Failed to export Project JSON: ${err.message}`, 'error');
    }
  }, [plan, floorLevels, activeFloorIndex, editorState, onNotify]);

  const handleLoadStarterPlan = useCallback(() => {
    if (!window.confirm('Load 30x40 2BHK Starter Plan? Current unsaved elements on this level will be replaced.')) return;
    const starter = createStarterFloorPlan('starter', '30x40 2BHK Sample Home', unit);
    dispatchWithHistory({
      type: 'SET_STATE',
      payload: {
        walls: starter.walls || [],
        rooms: starter.rooms || [],
        doors: starter.doors || [],
        windows: starter.windows || [],
        columns: starter.columns || [],
        furniture: starter.furniture || [],
        stairs: starter.stairs || [],
        annotations: starter.annotations || [],
      },
    });
    setSelectedElement(null);
    setShowSettingsModal(false);
    onNotify('Loaded 30x40 2BHK Starter Architectural Plan!', 'success');
  }, [unit, dispatchWithHistory, onNotify]);

  // ── Version Snapshot Handlers ─────────────────────────

  const handleCreateSnapshot = async () => {
    if (!plan) return;
    const note = versionNote.trim() || `Snapshot ${new Date().toLocaleTimeString()}`;
    const res = await saveFloorPlanVersion(user, plan.id, note);
    if (res.success) {
      onNotify('Version snapshot saved!', 'success');
      setVersionNote('');
      // Reload plan to refresh versionHistory
      const refreshed = await getFloorPlanById(user, plan.id);
      if (refreshed) setPlan(refreshed);
    } else {
      onNotify('Failed to create snapshot', 'error');
    }
  };

  const handleRestoreSnapshot = async (versionId: string) => {
    if (!plan) return;
    if (!window.confirm('Restore this version? Unsaved changes in the current view will be replaced.')) return;
    const res = await restoreFloorPlanVersion(user, plan.id, versionId);
    if (res.success) {
      const refreshed = await getFloorPlanById(user, plan.id);
      if (refreshed) {
        setPlan(refreshed);
        const state: EditorState = {
          walls: refreshed.walls || [],
          rooms: refreshed.rooms || [],
          doors: refreshed.doors || [],
          windows: refreshed.windows || [],
          furniture: refreshed.furniture || [],
          stairs: refreshed.stairs || [],
          columns: refreshed.columns || [],
          annotations: refreshed.annotations || [],
        };
        dispatch({ type: 'SET_STATE', payload: state });
        pushHistory(state);
        setShowVersionModal(false);
        onNotify('Version restored successfully!', 'success');
      }
    } else {
      onNotify('Failed to restore snapshot', 'error');
    }
  };

  const handleAddRoomByDimensions = (
    w: number,
    h: number,
    type: RoomType,
    finish: string = 'Wood Parquet'
  ) => {
    if (!plan) return;
    const roomCount = editorState.rooms.length;
    const plotL = plan.plotLength || 40;
    const plotW = plan.plotWidth || 30;
    const posX = Math.max(1, Math.min(plotL - w, 4 + (roomCount % 3) * 4));
    const posY = Math.max(1, Math.min(plotW - h, 4 + Math.floor(roomCount / 3) * 4));
    const newId = uid('room');

    const newRoom: FloorPlanRoom = {
      id: newId,
      roomType: type,
      label: `${type} ${roomCount + 1}`,
      x: snapToGrid(posX),
      y: snapToGrid(posY),
      width: w,
      height: h,
      rotation: 0,
      color: ROOM_COLORS[type],
      floorFinish: finish,
      wallThickness: unit === 'feet' ? 0.75 : 0.23,
      layer: 'rooms',
    };

    dispatchWithHistory({
      type: 'ADD_ROOM',
      payload: newRoom,
    });
    setSelectedElement({ type: 'room', id: newId });
    setShowAddRoomModal(false);
    onNotify(`Added ${newRoom.label} (${w} × ${h} ${unit === 'feet' ? 'ft' : 'm'})`, 'success');
  };

  const handleFocusRoom = (room: FloorPlanRoom) => {
    if (!containerRef.current) return;
    const cW = containerRef.current.clientWidth;
    const cH = containerRef.current.clientHeight;
    const roomCenterX = (room.x + room.width / 2) * GRID_SIZE_PX * zoom;
    const roomCenterY = (room.y + room.height / 2) * GRID_SIZE_PX * zoom;
    setPanX(cW / 2 - roomCenterX);
    setPanY(cH / 2 - roomCenterY);
    setSelectedElement({ type: 'room', id: room.id });
    setShowRoomScheduleModal(false);
    onNotify(`Selected ${room.label}`, 'info');
  };

  // ── Additional Professional Exports: SVG & JPEG ───────

  const handleExportSVG = useCallback(() => {
    if (!svgRef.current || !plan) return;
    const svgData = new XMLSerializer().serializeToString(svgRef.current);
    const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `${plan.buildingName || 'floor-plan'}-${floorLevels[activeFloorIndex]?.name || 'level'}.svg`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
    onNotify('Exported SVG vector drawing!', 'success');
  }, [plan, floorLevels, activeFloorIndex, onNotify]);

  const handleExportJPEG = useCallback(() => {
    if (!svgRef.current || !plan) return;
    const svgData = new XMLSerializer().serializeToString(svgRef.current);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    const canvas = document.createElement('canvas');
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width || 1200;
      canvas.height = img.height || 800;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = viewMode === 'blueprint' ? '#0f172a' : '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      const link = document.createElement('a');
      link.download = `${plan.buildingName || 'floor-plan'}-${floorLevels[activeFloorIndex]?.name || 'level'}.jpg`;
      link.href = canvas.toDataURL('image/jpeg', 0.95);
      link.click();
      onNotify('Exported high-res JPEG image!', 'success');
    };
    img.src = url;
  }, [plan, viewMode, floorLevels, activeFloorIndex, onNotify]);

  // ── Structure & Symbol Quick-Add Functions ───────────

  const handleAddSquareRoom = useCallback(() => {
    handleAddRoomByDimensions(12, 12, 'Living Room', 'Wood Parquet');
  }, [handleAddRoomByDimensions]);

  const handleAddLShapedRoom = useCallback(() => {
    const roomCount = editorState.rooms.length;
    const posX = snapToGrid(4 + (roomCount % 3) * 6);
    const posY = snapToGrid(4 + Math.floor(roomCount / 3) * 6);
    const w = 14;
    const h = 14;
    const pts = generateLShapedRoom(posX, posY, w, h, 6, 7);
    const area = computePolygonArea(pts);
    const perimeter = computePolygonPerimeter(pts);
    const newId = uid('room');
    const newRoom: FloorPlanRoom = {
      id: newId,
      roomType: 'Living Room',
      label: `L-Shape Room ${roomCount + 1}`,
      x: posX,
      y: posY,
      width: w,
      height: h,
      shapeType: 'l-shape',
      polygonPoints: pts,
      area,
      perimeter,
      rotation: 0,
      color: ROOM_COLORS['Living Room'],
      floorFinish: 'Wood Parquet',
      wallThickness: unit === 'feet' ? 0.75 : 0.23,
      layer: 'rooms',
    };
    dispatchWithHistory({ type: 'ADD_ROOM', payload: newRoom });
    setSelectedElement({ type: 'room', id: newId });
    onNotify('Added L-shaped room (exact Shoelace area)', 'success');
  }, [editorState.rooms, unit, dispatchWithHistory, onNotify, snapToGrid]);

  const handleAddUShapedRoom = useCallback(() => {
    const roomCount = editorState.rooms.length;
    const posX = snapToGrid(4 + (roomCount % 3) * 6);
    const posY = snapToGrid(4 + Math.floor(roomCount / 3) * 6);
    const w = 16;
    const h = 14;
    const pts = generateUShapedRoom(posX, posY, w, h, 6, 7);
    const area = computePolygonArea(pts);
    const perimeter = computePolygonPerimeter(pts);
    const newId = uid('room');
    const newRoom: FloorPlanRoom = {
      id: newId,
      roomType: 'Living Room',
      label: `U-Shape Room ${roomCount + 1}`,
      x: posX,
      y: posY,
      width: w,
      height: h,
      shapeType: 'u-shape',
      polygonPoints: pts,
      area,
      perimeter,
      rotation: 0,
      color: ROOM_COLORS['Living Room'],
      floorFinish: 'Wood Parquet',
      wallThickness: unit === 'feet' ? 0.75 : 0.23,
      layer: 'rooms',
    };
    dispatchWithHistory({ type: 'ADD_ROOM', payload: newRoom });
    setSelectedElement({ type: 'room', id: newId });
    onNotify('Added U-shaped room (exact Shoelace area)', 'success');
  }, [editorState.rooms, unit, dispatchWithHistory, onNotify, snapToGrid]);

  const handleAddTShapedRoom = useCallback(() => {
    const roomCount = editorState.rooms.length;
    const posX = snapToGrid(4 + (roomCount % 3) * 6);
    const posY = snapToGrid(4 + Math.floor(roomCount / 3) * 6);
    const w = 14;
    const h = 16;
    const pts = generateTShapedRoom(posX, posY, w, h, 6, 9);
    const area = computePolygonArea(pts);
    const perimeter = computePolygonPerimeter(pts);
    const newId = uid('room');
    const newRoom: FloorPlanRoom = {
      id: newId,
      roomType: 'Living Room',
      label: `T-Shape Room ${roomCount + 1}`,
      x: posX,
      y: posY,
      width: w,
      height: h,
      shapeType: 't-shape',
      polygonPoints: pts,
      area,
      perimeter,
      rotation: 0,
      color: ROOM_COLORS['Living Room'],
      floorFinish: 'Wood Parquet',
      wallThickness: unit === 'feet' ? 0.75 : 0.23,
      layer: 'rooms',
    };
    dispatchWithHistory({ type: 'ADD_ROOM', payload: newRoom });
    setSelectedElement({ type: 'room', id: newId });
    onNotify('Added T-shaped room (exact Shoelace area)', 'success');
  }, [editorState.rooms, unit, dispatchWithHistory, onNotify, snapToGrid]);

  const handleAddWallPreset = useCallback((preset: 'exterior' | 'interior' | 'partition') => {
    const thick = preset === 'exterior' ? (unit === 'feet' ? 0.75 : 0.23) : preset === 'interior' ? (unit === 'feet' ? 0.375 : 0.115) : (unit === 'feet' ? 0.25 : 0.075);
    setWallThickness(thick);
    setActiveTool('wall');
    setSelectedElement(null);
    onNotify(`Activated ${preset} wall tool (${formatLength(thick, unit)})`, 'info');
  }, [unit, onNotify]);

  const handleAddDoorPreset = useCallback((dType: DoorType) => {
    setSelectedDoorType(dType);
    setActiveTool('door');
    setSelectedElement(null);
    onNotify(`Activated ${dType} placement tool`, 'info');
  }, [onNotify]);

  const handleAddWindowPreset = useCallback((wType: WindowType) => {
    setSelectedWindowType(wType);
    setActiveTool('window');
    setSelectedElement(null);
    onNotify(`Activated ${wType} placement tool`, 'info');
  }, [onNotify]);

  const handleAddStairPreset = useCallback((type: StaircaseType) => {
    const newStair: FloorPlanStaircase = {
      id: uid('stair'),
      stairType: type,
      x: snapToGrid(10),
      y: snapToGrid(10),
      width: unit === 'feet' ? 3.5 : 1.0,
      length: unit === 'feet' ? 10 : 3.0,
      rotation: 0,
      numSteps: 16,
      direction: 'UP',
      layer: 'stairs',
    };
    dispatchWithHistory({ type: 'ADD_STAIRS', payload: newStair });
    setSelectedElement({ type: 'stairs', id: newStair.id });
    onNotify(`Added ${type} Staircase`, 'success');
  }, [unit, dispatchWithHistory, onNotify, snapToGrid]);

  const handleAddLanding = useCallback(() => {
    const newLanding: FloorPlanRoom = {
      id: uid('room'),
      roomType: 'Corridor',
      label: 'Stair Landing',
      x: snapToGrid(12),
      y: snapToGrid(12),
      width: unit === 'feet' ? 6 : 1.8,
      height: unit === 'feet' ? 4 : 1.2,
      rotation: 0,
      color: 'rgba(234,179,8,0.2)',
      floorFinish: 'Vitrified Tiles',
      layer: 'rooms',
    };
    dispatchWithHistory({ type: 'ADD_ROOM', payload: newLanding });
    setSelectedElement({ type: 'room', id: newLanding.id });
    onNotify('Added Landing Platform', 'success');
  }, [unit, dispatchWithHistory, onNotify, snapToGrid]);

  const handleAddVoid = useCallback(() => {
    const newVoid: FloorPlanRoom = {
      id: uid('room'),
      roomType: 'Custom',
      label: 'Void / Cutout',
      x: snapToGrid(14),
      y: snapToGrid(14),
      width: unit === 'feet' ? 8 : 2.4,
      height: unit === 'feet' ? 8 : 2.4,
      rotation: 0,
      color: 'rgba(239, 68, 68, 0.08)',
      floorFinish: 'Color Tint',
      layer: 'rooms',
    };
    dispatchWithHistory({ type: 'ADD_ROOM', payload: newVoid });
    setSelectedElement({ type: 'room', id: newVoid.id });
    onNotify('Added Void Cutout Area', 'success');
  }, [unit, dispatchWithHistory, onNotify, snapToGrid]);

  const handleAddFurnitureItem = useCallback((item: FurnitureCatalogItem) => {
    const newId = uid('furn');
    const newFurn: FloorPlanFurniture = {
      id: newId,
      category: item.category,
      itemType: item.itemType,
      label: item.label,
      x: snapToGrid(10),
      y: snapToGrid(10),
      width: item.width,
      height: item.height,
      rotation: 0,
      layer: 'furniture',
    };
    dispatchWithHistory({ type: 'ADD_FURNITURE', payload: newFurn });
    setSelectedElement({ type: 'furniture', id: newId });
    onNotify(`Added ${item.itemType} to plan`, 'success');
  }, [dispatchWithHistory, onNotify, snapToGrid]);

  const handleAddElectricalItem = useCallback((name: string) => {
    const newId = uid('furn');
    const newElec: FloorPlanFurniture = {
      id: newId,
      category: 'electrical',
      itemType: name,
      label: name,
      x: snapToGrid(10),
      y: snapToGrid(10),
      width: 1.5,
      height: 1.5,
      rotation: 0,
      layer: 'furniture',
    };
    dispatchWithHistory({ type: 'ADD_FURNITURE', payload: newElec });
    setSelectedElement({ type: 'furniture', id: newId });
    onNotify(`Added ${name} to plan`, 'success');
  }, [dispatchWithHistory, onNotify, snapToGrid]);

  const handleAddAnnotationPreset = useCallback((type: 'dimension' | 'note' | 'label') => {
    if (type === 'dimension') {
      setActiveTool('dimension');
      setSelectedElement(null);
      onNotify('Click wall or drag on canvas to place Dimension Line', 'info');
    } else {
      const newId = uid('annot');
      const newAnnot: FloorPlanAnnotation = {
        id: newId,
        x: snapToGrid(10),
        y: snapToGrid(10),
        text: type === 'note' ? 'Architectural Note' : 'General Label',
        fontSize: 12,
        rotation: 0,
        layer: 'annotations',
      };
      dispatchWithHistory({ type: 'ADD_ANNOTATION', payload: newAnnot });
      setSelectedElement({ type: 'annotation', id: newId });
      onNotify('Added Text Annotation', 'success');
    }
  }, [dispatchWithHistory, onNotify, snapToGrid]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 400, color: '#64748b' }}>
        Loading CAD floor plan editor...
      </div>
    );
  }

  if (!plan) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#ef4444' }}>
        Floor plan not found or access denied.
        <br />
        <button className="btn btn-outline" style={{ marginTop: 16 }} onClick={onBack}>
          Back to Floor Plans
        </button>
      </div>
    );
  }

  const plotW = plan.plotLength * GRID_SIZE_PX * zoom;
  const plotH = plan.plotWidth * GRID_SIZE_PX * zoom;
  const currentFloor = floorLevels[activeFloorIndex] || { name: plan.floorName };

  const hintKey = activeTool === 'select' && editorState.walls.length === 0 && editorState.rooms.length === 0 ? 'start' : activeTool;
  const activeHint = showTips && TOOL_HINTS[hintKey] && !seenHints.includes(hintKey) ? hintKey : null;

  // Measurement text: a fixed, readable size on screen at any zoom, scaled by the user's
  // text-size setting. It is drawn from the wall's real length on every render.
  const dimFontPx = (isMobile ? 12 : 11.5) * dimTextScale;
  const dimColor = viewMode === 'blueprint' ? '#fca5a5' : '#dc2626';
  const dimLabelsTappable = activeTool === 'select' || activeTool === 'pan';
  const toScreen = (x: number, y: number) => ({ x: x * GRID_SIZE_PX * zoom + panX, y: y * GRID_SIZE_PX * zoom + panY });

  /** The walls a sketch stroke would become, drawn over the plan (dashed while awaiting a decision). */
  const renderSketchWalls = (result: SketchResult, raw: Point2D[], pending: boolean) => (
    <g className="fp-sketch-preview" style={{ pointerEvents: 'none' }}>
      {raw.length > 1 && (
        <polyline
          points={raw.map(p => { const s = toScreen(p.x, p.y); return `${s.x},${s.y}`; }).join(' ')}
          fill="none"
          stroke="#94a3b8"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="2,5"
        />
      )}
      {result.walls.map(w => {
        const a = toScreen(w.x1, w.y1), b = toScreen(w.x2, w.y2);
        const len = wallLength(w);
        const longEnough = Math.hypot(b.x - a.x, b.y - a.y) > 64;
        return (
          <g key={w.id}>
            <line
              x1={a.x} y1={a.y} x2={b.x} y2={b.y}
              stroke="#0f172a"
              strokeOpacity={pending ? 0.75 : 0.6}
              strokeWidth={Math.max(4, w.thickness * GRID_SIZE_PX * zoom)}
              strokeLinecap="square"
              strokeDasharray={pending ? '10,7' : undefined}
            />
            <circle cx={a.x} cy={a.y} r={4} fill="#ffffff" stroke="#1e293b" strokeWidth={2} />
            <circle cx={b.x} cy={b.y} r={4} fill="#ffffff" stroke="#1e293b" strokeWidth={2} />
            {longEnough && (
              <text
                x={(a.x + b.x) / 2}
                y={(a.y + b.y) / 2 - Math.max(4, w.thickness * GRID_SIZE_PX * zoom) / 2 - 6}
                textAnchor="middle"
                fontSize={dimFontPx}
                fontWeight="700"
                fontFamily="'Outfit', sans-serif"
                fill="#0f172a"
                stroke="#ffffff"
                strokeWidth={3}
                paintOrder="stroke"
              >
                {formatDimension(len, unit)}
              </text>
            )}
          </g>
        );
      })}
    </g>
  );

  return (
    <div className={`fp-editor-root ${viewMode === 'blueprint' ? 'fp-blueprint-mode' : viewMode === 'presentation' ? 'fp-presentation-mode' : ''}`}>
      {/* ── Mobile Top Header (< 768px) ────────────────── */}
      <header className="fp-mobile-header no-print" aria-label="Mobile CAD Navigation">
        <div className="fp-mobile-header-left">
          {plan.siteId && onBackToSite ? (
            <button
              type="button"
              className="fp-mobile-back-btn"
              onClick={() => leaveEditor(() => onBackToSite(plan.siteId!))}
              title="Back to Construction Site"
              aria-label="Back to Site"
            >
              <ArrowLeft size={18} />
            </button>
          ) : (
            <button
              type="button"
              className="fp-mobile-back-btn"
              onClick={() => leaveEditor(onBack)}
              title="Back to Floor Plans"
              aria-label="Back to Plans"
            >
              <ArrowLeft size={18} />
            </button>
          )}

          {/* Plan name with its save state and size underneath. Tap for the full overview. */}
          <div
            className="fp-mobile-title-group"
            role="button"
            tabIndex={0}
            title="Plan overview"
            onClick={() => setShowMobileDetails(true)}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setShowMobileDetails(true); }}
          >
            <h2 className="fp-mobile-title">{currentFloor.name || 'Floor Plan'}</h2>
            <span className="fp-mobile-subtitle fp-mobile-status-strip">
              <span className={`fp-status-save-text ${saving ? 'saving' : saveStatus === 'saved' ? 'saved' : 'unsaved'}`}>
                {saving ? 'Saving…' : saveStatus === 'saved' ? 'Saved' : 'Not saved'}
              </span>
              <span className="fp-status-dot">•</span>
              <span>{totalFloorArea.toFixed(0)} {unit === 'feet' ? 'sq.ft' : 'sq.m'}</span>
            </span>
          </div>
        </div>

        <div className="fp-mobile-header-right">
          <button type="button" className="fp-mobile-header-btn" onClick={handleUndo} disabled={!canUndo} aria-label="Undo" title="Undo" id="fp-mobile-undo">
            <Undo2 size={19} />
          </button>
          <button type="button" className="fp-mobile-header-btn" onClick={handleRedo} disabled={!canRedo} aria-label="Redo" title="Redo" id="fp-mobile-redo">
            <Redo2 size={19} />
          </button>

          {/* Icon only, so the header never changes width while the plan autosaves. The line
              under the title always spells out Saved / Saving / Not saved. */}
          <button
            type="button"
            className={`fp-mobile-save-btn ${saving ? 'saving' : saveStatus === 'saved' ? 'saved' : 'unsaved'}`}
            onClick={handleSave}
            disabled={saving}
            title="Save Floor Plan"
            aria-label={saving ? 'Saving' : saveStatus === 'saved' ? 'Saved' : 'Save'}
            id="fp-mobile-save-btn"
          >
            {saving ? (
              <RotateCcw size={16} className="spin" />
            ) : saveStatus === 'saved' ? (
              <CheckCircle2 size={18} />
            ) : (
              <Save size={17} />
            )}
          </button>

          <button
            type="button"
            className="fp-mobile-menu-btn"
            onClick={() => setShowMobileMenu(true)}
            title="Floors and view options"
            aria-label="More Options"
            id="fp-mobile-menu-btn"
          >
            <MoreVertical size={18} />
          </button>
        </div>
      </header>

      {/* ── Editor Header ─────────────────────────────── */}

      <div className="fp-editor-header no-print">
        <div className="fp-editor-header-left">
          {plan.siteId && onBackToSite ? (
            <button
              type="button"
              className="fp-editor-back-btn"
              onClick={() => leaveEditor(() => onBackToSite(plan.siteId!))}
              title="Back to Construction Site"
              style={{ width: 'auto', padding: '0 12px', gap: 6 }}
            >
              <ArrowLeft size={16} />
              <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>Back to Site</span>
            </button>
          ) : (
            <button
              type="button"
              className="fp-editor-back-btn"
              onClick={() => leaveEditor(onBack)}
              title="Back to Floor Plans"
              style={{ width: 'auto', padding: '0 12px', gap: 6 }}
            >
              <ArrowLeft size={16} />
              <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>Back to Plans</span>
            </button>
          )}

          <div className="fp-editor-title-group">
            <h2 className="fp-editor-title">{currentFloor.name}</h2>
            <span className="fp-editor-subtitle">{plan.buildingName}</span>
            {plan.siteName && (
              <span className="fp-editor-site-badge">
                <Building2 size={12} /> {plan.siteName}
              </span>
            )}
          </div>

          {/* New Project Button */}
          <button
            type="button"
            className="fp-tool-btn"
            onClick={handleNewProject}
            title="Start New Floor Plan Project"
            id="fp-header-new-project-btn"
            style={{ width: 'auto', padding: '0 10px', gap: 6 }}
          >
            <FilePlus size={15} color="#1e293b" />
            <span className="fp-tool-btn-label" style={{ display: 'inline', fontWeight: 600 }}>New Project</span>
          </button>

          {/* Professional Floor Selector & Menu */}
          <div className="fp-floor-selector-group" style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#f8fafc', padding: '2px 8px', borderRadius: 6, border: '1px solid #e2e8f0' }}>
            <Layers size={14} color="#1e293b" />
            <select
              value={activeFloorIndex}
              onChange={e => handleSwitchFloor(Number(e.target.value))}
              className="fp-floor-dropdown"
              style={{ background: 'transparent', color: '#0f172a', border: 'none', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', outline: 'none' }}
              title="Select Active Floor Level"
            >
              {floorLevels.map((lvl, idx) => (
                <option key={lvl.id || idx} value={idx} style={{ background: '#f8fafc', color: '#0f172a' }}>
                  {lvl.name}
                </option>
              ))}
            </select>
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                className="fp-floor-menu-btn"
                onClick={() => setShowFloorMenu(m => !m)}
                title="Floor Operations (Add, Rename, Duplicate, Delete)"
                style={{ background: 'transparent', border: 'none', color: '#475569', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '2px 4px' }}
              >
                <MoreVertical size={14} />
              </button>
              {showFloorMenu && (
                <div
                  className="fp-more-dropdown"
                  style={{ left: 0, top: '100%', minWidth: 160, zIndex: 1000 }}
                  onMouseLeave={() => setShowFloorMenu(false)}
                >
                  <button
                    type="button"
                    className="fp-more-item"
                    onClick={() => { setShowFloorMenu(false); handleAddFloor(); }}
                  >
                    <Plus size={14} color="#1e293b" />
                    <span>Add Floor</span>
                  </button>
                  <button
                    type="button"
                    className="fp-more-item"
                    onClick={() => { setShowFloorMenu(false); handleRenameFloor(); }}
                  >
                    <Edit size={14} color="#334155" />
                    <span>Rename Floor</span>
                  </button>
                  <button
                    type="button"
                    className="fp-more-item"
                    onClick={() => { setShowFloorMenu(false); handleDuplicateFloor(); }}
                  >
                    <Copy size={14} color="#15803d" />
                    <span>Duplicate Floor</span>
                  </button>
                  <button
                    type="button"
                    className="fp-more-item danger"
                    onClick={() => { setShowFloorMenu(false); handleDeleteFloor(); }}
                  >
                    <Trash2 size={14} color="#dc2626" />
                    <span>Delete Floor</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Floor Level Quick Switcher */}
          <div className="fp-level-switcher">
            {floorLevels.map((lvl, idx) => (
              <button
                key={lvl.id || idx}
                type="button"
                className={`fp-level-btn ${idx === activeFloorIndex ? 'active' : ''}`}
                onClick={() => handleSwitchFloor(idx)}
                title={`Switch to ${lvl.name}`}
              >
                {lvl.name}
              </button>
            ))}
            <button
              type="button"
              className="fp-level-action-btn"
              onClick={handleAddFloor}
              title="Add a new floor / level"
            >
              <Plus size={13} /> Add
            </button>
            <button
              type="button"
              className="fp-level-action-btn"
              onClick={handleDuplicateFloor}
              title="Clone current floor layout to a new level"
            >
              <Copy size={13} /> Duplicate
            </button>
          </div>
        </div>

        {/* Center: Undo/Redo & Zoom */}
        <div className="fp-editor-header-center">
          <button type="button" className="fp-tool-btn" onClick={handleUndo} title="Undo (Ctrl+Z)" id="fp-undo-btn">
            <Undo2 size={18} />
          </button>
          <button type="button" className="fp-tool-btn" onClick={handleRedo} title="Redo (Ctrl+Y)" id="fp-redo-btn">
            <Redo2 size={18} />
          </button>

          <div className="fp-header-divider" />

          <button type="button" className="fp-tool-btn" onClick={() => setZoom(z => Math.min(MAX_ZOOM, z * 1.2))} title="Zoom In">
            <ZoomIn size={18} />
          </button>
          <span className="fp-zoom-label">{Math.round(zoom * 100)}%</span>
          <button type="button" className="fp-tool-btn" onClick={() => setZoom(z => Math.max(MIN_ZOOM, z * 0.83))} title="Zoom Out">
            <ZoomOut size={18} />
          </button>
          <button
            type="button"
            className="fp-tool-btn"
            onClick={() => {
              const vw = containerRef.current?.clientWidth || 800;
              const vh = containerRef.current?.clientHeight || 600;
              const margin = 80;
              const availW = Math.max(200, vw - margin * 2);
              const availH = Math.max(200, vh - margin * 2);
              const rawPlotW = plan.plotLength * GRID_SIZE_PX;
              const rawPlotH = plan.plotWidth * GRID_SIZE_PX;
              const fitZoom = Math.min(1.2, Math.max(MIN_ZOOM, Math.min(availW / rawPlotW, availH / rawPlotH)));
              setZoom(fitZoom);
              setPanX((vw - rawPlotW * fitZoom) / 2);
              setPanY((vh - rawPlotH * fitZoom) / 2);
            }}
            title="Reset View / Fit Screen"
          >
            <Maximize2 size={18} />
          </button>
          <button
            type="button"
            className={`fp-tool-btn ${activeTool === 'pan' ? 'active' : ''}`}
            onClick={() => setActiveTool(t => t === 'pan' ? 'select' : 'pan')}
            title="Pan Blueprint Canvas (H)"
            id="fp-pan-header-btn"
          >
            <Hand size={18} />
          </button>
        </div>

        {/* Right: Modes, 3D, Export, Save */}
        <div className="fp-editor-header-right">
          {/* 2D View Modes */}
          <div className="fp-view-modes">
            <button
              type="button"
              className={`fp-view-mode-btn ${viewMode === 'design' ? 'active' : ''}`}
              onClick={() => setViewMode('design')}
              title="Design view"
            >
              Design
            </button>
            <button
              type="button"
              className={`fp-view-mode-btn ${viewMode === 'blueprint' ? 'active' : ''}`}
              onClick={() => setViewMode('blueprint')}
              title="Blueprint view"
            >
              Blueprint
            </button>
            <button
              type="button"
              className={`fp-view-mode-btn ${viewMode === 'presentation' ? 'active' : ''}`}
              onClick={() => setViewMode('presentation')}
              title="Presentation View"
            >
              Presentation
            </button>
          </div>

          {/* Floorplanner-style Segmented 2D / 3D Toggle */}
          <div className="fp-floorplanner-dim-toggle" role="group" aria-label="Dimension View Mode">
            <button
              type="button"
              className={`fp-dim-toggle-btn ${!show3D ? 'active' : ''}`}
              onClick={() => setShow3D(false)}
              title="2D CAD Floor Plan"
              id="fp-2d-btn"
            >
              <span>2D</span>
            </button>
            <button
              type="button"
              className={`fp-dim-toggle-btn ${show3D ? 'active' : ''}`}
              onClick={() => setShow3D(true)}
              title="3D Walkthrough Preview"
              id="fp-3d-btn"
            >
              <Box size={14} />
              <span>3D</span>
            </button>
          </div>

          {/* Live Room Schedule / Counter Button ("namba room ethana irukku") */}
          <button
            type="button"
            className="fp-header-room-counter"
            onClick={() => setShowRoomScheduleModal(true)}
            title="View All Rooms & Breakdown"
            id="fp-header-room-counter-btn"
          >
            <Box size={16} />
            <span>Rooms: {editorState.rooms.length}</span>
          </button>

          {/* AI Architectural Floor Plan Assistant ("Building Mistry AI") */}
          <button
            type="button"
            className="fp-copilot-btn"
            onClick={() => { setIsMistryAiOpen(prev => !prev); setIsAiAssistantOpen(false); }}
            title="Building Mistry AI: ask for a change to the plan (Ctrl + K)"
            id="fp-copilot-btn"
            data-testid="fp-ai-assistant-btn"
          >
            <Sparkles size={16} />
            <span>Building Mistry AI</span>
            <span className="hidden sm:inline text-[10px] opacity-75 px-1.5 py-0.5 rounded bg-black/20 font-mono">
              Ctrl+K
            </span>
          </button>


          {/* Estimation Panel */}
          <button
            type="button"
            className="fp-tool-btn"
            onClick={() => setShowEstimationModal(true)}
            title="Material & Cost Estimation"
            id="fp-calc-btn"
          >
            <Calculator size={18} />
            <span className="fp-tool-btn-label">Materials</span>
          </button>

          {/* Export Dropdown */}
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              className="fp-tool-btn"
              onClick={() => setShowExportMenu(m => !m)}
              title="Export or print the plan"
              id="fp-export-menu-btn"
            >
              <Download size={18} />
              <span className="fp-tool-btn-label">Export</span>
              <ChevronDown size={14} />
            </button>
            {showExportMenu && (
              <div className="fp-more-dropdown" onMouseLeave={() => setShowExportMenu(false)}>
                <button
                  type="button"
                  className="fp-more-item"
                  onClick={() => { setShowExportMenu(false); handleExportDXF(); }}
                  id="fp-export-dxf-btn"
                >
                  <FileCode size={16} color="#1e293b" />
                  <span>AutoCAD DXF (.dxf)</span>
                </button>
                <button
                  type="button"
                  className="fp-more-item"
                  onClick={() => { setShowExportMenu(false); handleExportProjectJSON(); }}
                  id="fp-export-json-btn"
                >
                  <FileDown size={16} color="#15803d" />
                  <span>Plan file (.json)</span>
                </button>
                <button
                  type="button"
                  className="fp-more-item"
                  onClick={() => { setShowExportMenu(false); handleExportPDF(); }}
                  id="fp-export-pdf-btn"
                >
                  <FileDown size={16} color="#334155" />
                  <span>Print / PDF</span>
                </button>
                <button
                  type="button"
                  className="fp-more-item"
                  onClick={() => { setShowExportMenu(false); handleExportSVG(); }}
                  id="fp-export-svg-btn"
                >
                  <Download size={16} color="#1e293b" />
                  <span>SVG Vector Drawing (.svg)</span>
                </button>
                <button
                  type="button"
                  className="fp-more-item"
                  onClick={() => { setShowExportMenu(false); handleExportJPEG(); }}
                  id="fp-export-jpeg-btn"
                >
                  <Download size={16} color="#334155" />
                  <span>JPEG High-Res Image (.jpg)</span>
                </button>
                <button
                  type="button"
                  className="fp-more-item"
                  onClick={() => { setShowExportMenu(false); handleExportPNG(); }}
                  id="fp-export-png-btn"
                >
                  <Download size={16} color="#6d28d9" />
                  <span>PNG High-Res Image</span>
                </button>
              </div>
            )}
          </div>

          {/* CAD Layers Drawer Toggle */}
          <button
            type="button"
            className={`fp-tool-btn ${isLayersOpen ? 'active' : ''}`}
            onClick={() => setIsLayersOpen(o => !o)}
            title="Layers"
            id="fp-layers-toggle-btn"
          >
            <Layers size={18} />
            <span className="fp-tool-btn-label">Layers</span>
          </button>

          {/* Fullscreen Toggle */}
          <button
            type="button"
            className="fp-tool-btn"
            onClick={handleToggleFullscreen}
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Canvas'}
            id="fp-fullscreen-btn"
          >
            {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
            <span className="fp-tool-btn-label">Full</span>
          </button>

          {/* CAD Settings */}
          <button
            type="button"
            className="fp-tool-btn"
            onClick={() => setShowSettingsModal(true)}
            title="Drawing settings"
            id="fp-settings-btn"
          >
            <Settings size={18} />
          </button>

          {/* More Dropdown */}
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              className="fp-tool-btn"
              onClick={() => setShowMoreMenu(m => !m)}
              title="More Actions"
            >
              <ChevronDown size={18} />
            </button>
            {showMoreMenu && (
              <div className="fp-more-dropdown" onMouseLeave={() => setShowMoreMenu(false)}>
                <button
                  type="button"
                  className="fp-more-item"
                  onClick={() => { setShowMoreMenu(false); setShowVersionModal(true); }}
                >
                  <History size={16} /> Version History
                </button>
                <button
                  type="button"
                  className="fp-more-item"
                  onClick={() => { setShowMoreMenu(false); setShowShortcutsModal(true); }}
                >
                  <Keyboard size={16} /> Keyboard Shortcuts
                </button>
                <button
                  type="button"
                  className="fp-more-item"
                  onClick={() => { setShowMoreMenu(false); handleLoadStarterPlan(); }}
                >
                  <Sparkles size={16} color="#334155" /> Load 30x40 Sample Plan
                </button>
                <button
                  type="button"
                  className="fp-more-item danger"
                  onClick={() => {
                    setShowMoreMenu(false);
                    if (window.confirm('Clear all elements from current floor level?')) {
                      dispatchWithHistory({
                        type: 'SET_STATE',
                        payload: {
                          walls: [], rooms: [], doors: [], windows: [],
                          furniture: [], stairs: [], columns: [], annotations: [],
                        },
                      });
                    }
                  }}
                >
                  <Trash2 size={16} /> Clear Floor Level
                </button>
              </div>
            )}
          </div>

          {/* Save Button */}
          <button
            type="button"
            className={`btn btn-primary fp-save-btn ${saving ? 'loading' : ''}`}
            onClick={handleSave}
            disabled={saving}
            id="fp-save-btn"
          >
            {saving ? (
              <><RotateCcw size={16} className="spin" /> Saving...</>
            ) : saveStatus === 'saved' ? (
              <><CheckCircle2 size={16} /> Saved</>
            ) : (
              <><Save size={16} /> Save</>
            )}
          </button>
        </div>
      </div>

      {/* ── Categorized Tool Palette (Priority 2) ──────────────────────────────── */}
      <div className="fp-toolbar no-print">
        {/* GROUP 1: DRAW */}
        <div className="fp-toolbar-group" aria-label="Drawing Tools">
          <span className="fp-toolbar-group-label">Draw</span>
          <button
            type="button"
            className={`fp-tool-palette-btn ${activeTool === 'select' ? 'active' : ''}`}
            onClick={() => { setActiveTool('select'); setIsDrawingWall(false); setWallStart(null); }}
            title="Select / Move (V)"
            id="fp-tool-select"
          >
            <MousePointer2 size={18} />
            <span>Select</span>
          </button>
          <button
            type="button"
            className={`fp-tool-palette-btn ${activeTool === 'pan' ? 'active' : ''}`}
            onClick={() => { setActiveTool('pan'); setIsDrawingWall(false); setWallStart(null); setSelectedElement(null); }}
            title="Pan Blueprint Canvas (H / Hold Space + Drag)"
            id="fp-tool-pan"
          >
            <Hand size={18} />
            <span>Pan</span>
          </button>
          <button
            type="button"
            className={`fp-tool-palette-btn ${activeTool === 'wall' ? 'active' : ''}`}
            onClick={() => { setActiveTool('wall'); setSelectedElement(null); }}
            title="Draw Wall (W)"
            id="fp-tool-wall"
          >
            <Pencil size={18} />
            <span>Wall</span>
          </button>
          <button
            type="button"
            className={`fp-tool-palette-btn fp-tool-smart-pen ${activeTool === 'ai_draw' ? 'active' : ''}`}
            onClick={() => { setActiveTool('ai_draw'); setSelectedElement(null); }}
            title="Sketch walls (S): draw rough outline to auto-straighten"
            id="fp-tool-smart-draw"
            data-testid="fp-tool-ai-draw"
          >
            <PenTool size={18} className="text-amber-500" />
            <span style={{ fontWeight: 800 }}>Sketch</span>
          </button>
          <button
            type="button"
            className={`fp-tool-palette-btn ${activeTool === 'eraser' ? 'active' : ''}`}
            onClick={() => { setActiveTool('eraser'); setSelectedElement(null); setIsDrawingWall(false); setWallStart(null); }}
            title="Eraser (E / Tap to delete any element)"
            id="fp-tool-eraser"
          >
            <Eraser size={18} />
            <span>Eraser</span>
          </button>
          <button
            type="button"
            className={`fp-tool-palette-btn ${activeTool === 'split' ? 'active' : ''}`}
            onClick={() => { setActiveTool('split'); setSelectedElement(null); setIsDrawingWall(false); setWallStart(null); }}
            title="Split: click a wall where it should be cut into two walls"
            id="fp-tool-split"
          >
            <Split size={18} />
            <span>Split</span>
          </button>
          <button
            type="button"
            className="fp-tool-palette-btn"
            onClick={() => setShowChecks(true)}
            title="Measurement check: small differences between measurements that should match"
            id="fp-tool-checks"
          >
            <Ruler size={18} />
            <span>Check{alignmentIssues.length ? ` (${alignmentIssues.length})` : ''}</span>
          </button>
        </div>

        {/* GROUP 2: OPENINGS */}
        <div className="fp-toolbar-group" aria-label="Openings Tools">
          <span className="fp-toolbar-group-label">Openings</span>
          <div className="fp-tool-palette-group">
            <button
              type="button"
              className={`fp-tool-palette-btn ${activeTool === 'door' ? 'active' : ''}`}
              onClick={() => { setActiveTool('door'); setSelectedElement(null); }}
              title="Place Door (D)"
              id="fp-tool-door"
            >
              <DoorOpen size={18} />
              <span>Door</span>
            </button>
            {activeTool === 'door' && (
              <select
                value={selectedDoorType}
                onChange={e => setSelectedDoorType(e.target.value as DoorType)}
                className="fp-tool-select"
                id="fp-door-type-select"
              >
                {DOOR_TYPES.map(dt => <option key={dt} value={dt}>{dt}</option>)}
              </select>
            )}
          </div>
          <div className="fp-tool-palette-group">
            <button
              type="button"
              className={`fp-tool-palette-btn ${activeTool === 'window' ? 'active' : ''}`}
              onClick={() => { setActiveTool('window'); setSelectedElement(null); }}
              title="Place Window"
              id="fp-tool-window"
            >
              <AppWindow size={18} />
              <span>Window</span>
            </button>
            {activeTool === 'window' && (
              <select
                value={selectedWindowType}
                onChange={e => setSelectedWindowType(e.target.value as WindowType)}
                className="fp-tool-select"
                id="fp-window-type-select"
              >
                {WINDOW_TYPES.map(wt => <option key={wt} value={wt}>{wt}</option>)}
              </select>
            )}
          </div>
        </div>

        {/* GROUP 3: FURNISH */}
        <div className="fp-toolbar-group" aria-label="Furnishing Tools">
          <span className="fp-toolbar-group-label">Furnish</span>
          <div className="fp-tool-palette-group">
            <button
              type="button"
              className={`fp-tool-palette-btn ${activeTool === 'room' ? 'active' : ''}`}
              onClick={() => { setActiveTool('room'); setSelectedElement(null); }}
              title="Place Room (R)"
              id="fp-tool-room"
            >
              <Square size={18} />
              <span>Room</span>
            </button>
            {activeTool === 'room' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <select
                  value={selectedRoomType}
                  onChange={e => setSelectedRoomType(e.target.value as RoomType)}
                  className="fp-tool-select"
                  id="fp-room-type-select"
                >
                  {ROOM_TYPES.map(rt => <option key={rt} value={rt}>{rt}</option>)}
                </select>
                <button
                  type="button"
                  className="fp-stepper-btn"
                  style={{ width: 'auto', padding: '0 6px', height: 28, fontSize: '0.72rem' }}
                  onClick={() => setShowAddRoomModal(true)}
                  title="Add room by typing Height & Width"
                >
                  + Size
                </button>
              </div>
            )}
          </div>
          <button
            type="button"
            className={`fp-tool-palette-btn ${activeTool === 'furniture' ? 'active' : ''}`}
            onClick={() => setShowFurnitureModal(true)}
            title="Open Furniture & Symbols Library"
            id="fp-tool-furniture"
          >
            <Armchair size={18} />
            <span>Furniture</span>
          </button>
          <div className="fp-tool-palette-group">
            <button
              type="button"
              className={`fp-tool-palette-btn ${activeTool === 'column' ? 'active' : ''}`}
              onClick={() => { setActiveTool('column'); setSelectedElement(null); }}
              title="Place Structural Column"
              id="fp-tool-column"
            >
              <Columns size={18} />
              <span>Column</span>
            </button>
            {activeTool === 'column' && (
              <select
                value={columnShape}
                onChange={e => setColumnShape(e.target.value as any)}
                className="fp-tool-select"
              >
                <option value="square">Square (9"×9")</option>
                <option value="rectangular">Rectangular (9"×15")</option>
                <option value="round">Round Pillar</option>
              </select>
            )}
          </div>
          <div className="fp-tool-palette-group">
            <button
              type="button"
              className={`fp-tool-palette-btn ${activeTool === 'stairs' ? 'active' : ''}`}
              onClick={() => { setActiveTool('stairs'); setSelectedElement(null); }}
              title="Place Staircase"
              id="fp-tool-stairs"
            >
              <Split size={18} />
              <span>Stairs</span>
            </button>
            {activeTool === 'stairs' && (
              <select
                value={stairType}
                onChange={e => setStairType(e.target.value as any)}
                className="fp-tool-select"
              >
                <option value="straight">Straight Flight</option>
                <option value="l-shape">L-Shape</option>
                <option value="u-shape">U-Shape</option>
                <option value="spiral">Spiral</option>
              </select>
            )}
          </div>
        </div>

        {/* GROUP 4: MEASURE */}
        <div className="fp-toolbar-group" aria-label="Measure Tools">
          <span className="fp-toolbar-group-label">Measure</span>
          <button
            type="button"
            className={`fp-tool-palette-btn ${showDimensions ? 'active' : ''}`}
            onClick={() => setShowDimensions(d => !d)}
            title="Show or hide measurements (M)"
            id="fp-tool-dimension"
          >
            <Ruler size={18} />
            <span>Dimension</span>
          </button>
          <button
            type="button"
            className={`fp-tool-palette-btn ${activeTool === 'measure' ? 'active' : ''}`}
            onClick={() => {
              setActiveTool(t => t === 'measure' ? 'select' : 'measure');
              setMeasureStart(null);
              setMeasureCurrent(null);
              setIsMeasuring(false);
            }}
            title="Measure Tape Distance & Angle"
            id="fp-tool-measure-tape"
          >
            <ScanLine size={18} />
            <span>Tape</span>
          </button>
          <button
            type="button"
            className={`fp-tool-palette-btn ${activeTool === 'annotation' ? 'active' : ''}`}
            onClick={() => { setActiveTool('annotation'); setSelectedElement(null); }}
            title="Place Text Note / Callout"
          >
            <PenTool size={18} />
            <span>Note</span>
          </button>
        </div>

        {/* GROUP 5: VIEW & ASSIST */}
        <div className="fp-toolbar-group" aria-label="View & Workspace">
          <span className="fp-toolbar-group-label">View</span>
          <button
            type="button"
            className={`fp-tool-palette-btn ${showGrid ? 'active' : ''}`}
            onClick={() => setShowGrid(g => !g)}
            title="Toggle Grid"
          >
            <Layers size={18} />
            <span>Grid</span>
          </button>
          <button
            type="button"
            className={`fp-tool-palette-btn ${viewMode === 'blueprint' ? 'active' : ''}`}
            onClick={() => setViewMode(v => v === 'blueprint' ? 'design' : 'blueprint')}
            title="Blueprint view"
          >
            <FileCode size={18} />
            <span>Blueprint</span>
          </button>
          <button
            type="button"
            className="fp-tool-palette-btn"
            onClick={() => setShow3D(true)}
            title="Open the 3D preview"
          >
            <Box size={18} />
            <span>3D</span>
          </button>
          <button
            type="button"
            className="fp-tool-palette-btn fp-tool-copilot"
            onClick={() => { setIsMistryAiOpen(prev => !prev); setIsAiAssistantOpen(false); }}
            title="Building Mistry AI: ask for a change to the plan (Ctrl + K)"
            id="fp-tool-copilot-palette"
            style={{
              background: '#f8fafc',
              border: '1.5px solid #cbd5e1',
            }}
          >
            <Sparkles size={18} color="#334155" className="animate-pulse" />
            <span style={{ color: '#0f172a', fontWeight: 800 }}>AI Assist</span>
          </button>
        </div>

        {/* Wall Thickness Input & Delete Action */}
        <div className="fp-toolbar-control">
          <label htmlFor="fp-wall-thickness">Wall</label>
          <input
            id="fp-wall-thickness"
            type="number"
            min={0.25}
            max={3}
            step={0.25}
            value={wallThickness}
            onChange={e => setWallThickness(parseFloat(e.target.value) || WALL_THICKNESS_DEFAULT)}
            className="fp-thickness-input"
          />
          <span className="fp-unit-label">{unit === 'feet' ? 'ft' : 'm'}</span>
        </div>

        {selectedElement && (
          <button
            type="button"
            className="fp-tool-palette-btn fp-tool-danger"
            onClick={handleDeleteSelected}
            title="Delete selected element (Del)"
            id="fp-delete-selected-btn"
          >
            <Trash2 size={18} />
            <span>Delete</span>
          </button>
        )}
      </div>

      {/* ── One-line tool tip: only when tips are turned on in Settings ── */}
      {showTips && (
        <div className="fp-live-hint-bar no-print" role="status" aria-live="polite">
          <span className="fp-live-hint-tag">{activeTool.replace('_', ' ')}</span>
          <span className="fp-live-hint-text">{getLiveToolHint(activeTool)}</span>
        </div>
      )}

      {/* ── Desktop Professional CAD Workspace ────────── */}
      <div className="fp-desktop-workspace">
        {/* ── Left Toolbar (Compact Vertical Professional Toolbar) ── */}
        <aside className="fp-desktop-left-toolbar no-print" aria-label="Professional Left CAD Toolbar">
          <button
            type="button"
            className={`fp-vert-tool-btn ${activeTool === 'select' ? 'active' : ''}`}
            onClick={() => { setActiveTool('select'); setIsDrawingWall(false); setWallStart(null); }}
            title="Select / Move (V)"
            id="fp-vert-select-btn"
          >
            <MousePointer2 size={18} />
            <span className="fp-vert-tool-label">Select</span>
          </button>
          <button
            type="button"
            className={`fp-vert-tool-btn ${activeTool === 'pan' ? 'active' : ''}`}
            onClick={() => {
              setActiveTool(t => t === 'pan' ? 'select' : 'pan');
              setIsDrawingWall(false);
              setWallStart(null);
            }}
            title="Pan Blueprint Canvas (H / Space+Drag)"
            id="fp-vert-pan-btn"
          >
            <Hand size={18} />
            <span className="fp-vert-tool-label">Pan</span>
          </button>
          <button
            type="button"
            className={`fp-vert-tool-btn ${activeTool === 'measure' ? 'active' : ''}`}
            onClick={() => {
              setActiveTool(t => t === 'measure' ? 'select' : 'measure');
              setMeasureStart(null);
              setMeasureCurrent(null);
              setIsMeasuring(false);
            }}
            title="Measure Distance & Angle (M)"
            id="fp-vert-measure-btn"
          >
            <Ruler size={18} />
            <span className="fp-vert-tool-label">Measure</span>
          </button>

          <div style={{ height: 1, background: '#f1f5f9', margin: '4px 0', width: '80%' }} />

          <button
            type="button"
            className="fp-vert-tool-btn"
            onClick={handleRotateSelected}
            disabled={!selectedElement || isSelectedLocked}
            title="Rotate Selected 90° (R)"
            id="fp-vert-rotate-btn"
          >
            <RotateCw size={18} />
            <span className="fp-vert-tool-label">Rotate</span>
          </button>
          <button
            type="button"
            className="fp-vert-tool-btn"
            onClick={() => handleMirrorSelected('horizontal')}
            disabled={!selectedElement || isSelectedLocked}
            title="Mirror Selected (Flip)"
            id="fp-vert-mirror-btn"
          >
            <FlipHorizontal size={18} />
            <span className="fp-vert-tool-label">Mirror</span>
          </button>
          <button
            type="button"
            className="fp-vert-tool-btn"
            onClick={handleDuplicateSelected}
            disabled={!selectedElement}
            title="Clone Selected Element"
            id="fp-vert-clone-btn"
          >
            <Copy size={18} />
            <span className="fp-vert-tool-label">Clone</span>
          </button>
          <button
            type="button"
            className="fp-vert-tool-btn"
            style={{ color: selectedElement ? '#dc2626' : undefined }}
            onClick={handleDeleteSelected}
            disabled={!selectedElement || isSelectedLocked}
            title="Delete Selected (Del)"
            id="fp-vert-delete-btn"
          >
            <Trash2 size={18} />
            <span className="fp-vert-tool-label">Delete</span>
          </button>

          <div style={{ height: 1, background: '#f1f5f9', margin: '4px 0', width: '80%' }} />

          <button
            type="button"
            className="fp-vert-tool-btn"
            onClick={handleUndo}
            title="Undo (Ctrl+Z)"
            id="fp-vert-undo-btn"
          >
            <Undo2 size={18} />
            <span className="fp-vert-tool-label">Undo</span>
          </button>
          <button
            type="button"
            className="fp-vert-tool-btn"
            onClick={handleRedo}
            title="Redo (Ctrl+Y)"
            id="fp-vert-redo-btn"
          >
            <Redo2 size={18} />
            <span className="fp-vert-tool-label">Redo</span>
          </button>
        </aside>

        {/* ── Center Workspace: Shape Library + Canvas ────── */}
        <div className="fp-canvas-workspace">
        <FloorPlanShapeLibrary
          user={user}
          unit={unit}
          isOpen={isShapeLibraryOpen}
          onToggleOpen={() => setIsShapeLibraryOpen(o => !o)}
          onSelectShape={handleSelectShapeFromLibrary}
          onSelectTemplate={handleApplyStarterTemplate}
          selectedCanvasElement={selectedElement}
          onSaveSelectionAsCustom={handleSaveSelectionAsCustom}
        />

        {/* ── Canvas Area ───────────────────────────────── */}
        <div
          className="fp-canvas-container"
          ref={containerRef}
          style={{
            cursor: isPanning
              ? 'grabbing'
              : isSpacePressed || activeTool === 'pan'
              ? 'grab'
              : activeTool === 'select'
              ? 'default'
              : 'crosshair',
            touchAction: 'none',
            overscrollBehavior: 'none',
            userSelect: 'none',
            WebkitUserSelect: 'none',
          }}
        >
          {/* Mobile view switch (< 768px): a small pill in the top-left corner of the canvas */}
          <div className="fp-mobile-mode-bar no-print" role="tablist" aria-label="View Modes">
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'design'}
              className={`fp-mobile-mode-btn ${viewMode === 'design' ? 'active' : ''}`}
              onClick={() => setViewMode('design')}
            >
              Design
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'blueprint'}
              className={`fp-mobile-mode-btn ${viewMode === 'blueprint' ? 'active' : ''}`}
              onClick={() => setViewMode('blueprint')}
            >
              Blueprint
            </button>
            <button
              type="button"
              className="fp-mobile-mode-btn btn-3d"
              onClick={() => setShow3D(true)}
              title="Open the 3D preview"
            >
              <Box size={14} />
              3D
            </button>
          </div>

          {/* Mobile Floating Zoom Pill (< 768px) */}
          <div className="fp-mobile-zoom-pill no-print" aria-label="Canvas Zoom Controls">
            <button
              type="button"
              className="fp-mobile-zoom-btn"
              onClick={() => setZoom(z => Math.max(MIN_ZOOM, +(z * 0.8).toFixed(2)))}
              title="Zoom Out"
              aria-label="Zoom Out"
            >
              <Minus size={16} />
            </button>
            <button
              type="button"
              className="fp-mobile-zoom-text"
              onClick={handleResetView}
              title="Reset the view to 100%"
              aria-label={`Zoom ${Math.round(zoom * 100)} percent. Reset the view to 100 percent`}
              id="fp-mobile-zoom-reset"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              type="button"
              className="fp-mobile-zoom-btn"
              onClick={() => setZoom(z => Math.min(MAX_ZOOM, +(z * 1.25).toFixed(2)))}
              title="Zoom In"
              aria-label="Zoom In"
            >
              <Plus size={16} />
            </button>
            <button
              type="button"
              className="fp-mobile-zoom-fit"
              onClick={handleFitToScreen}
              title="Fit entire floor plan to screen"
              aria-label="Fit plan to screen"
            >
              <Maximize2 size={15} />
            </button>
          </div>

          {/* Building Mistry AI: one entry point, on every screen size */}
          <button
            type="button"
            className="fp-fab-ai no-print"
            onClick={() => { setIsMistryAiOpen(true); setIsAiAssistantOpen(false); setIsCopilotOpen(false); }}
            title="Building Mistry AI: ask for a change to the plan"
            aria-label="Open Building Mistry AI"
            id="fp-mobile-fab-ai"
          >
            <Sparkles size={18} />
            <span className="fp-fab-ai-label">AI</span>
          </button>

          {/* Sketch result that needs a decision: a large correction is shown on the canvas
              (dashed) and is only added when the user accepts it. */}
          {sketchProposal && (
            <div className="fp-ai-stroke-card no-print" role="dialog" aria-label="Check these walls" id="fp-sketch-review">
              <div className="fp-ai-stroke-content">
                <PenTool size={16} color="#1e293b" style={{ flexShrink: 0 }} />
                <span className="fp-ai-stroke-text">
                  {describeSketch(sketchProposal.result, v => formatDimension(v, unit))}. Use these walls?
                </span>
              </div>
              <div className="fp-ai-stroke-actions">
                <button
                  type="button"
                  className="fp-ai-btn-convert"
                  id="fp-sketch-accept"
                  onClick={() => commitSketch(sketchProposal.result)}
                >
                  Use
                </button>
                {sketchProposal.result.closed && (
                  <button
                    type="button"
                    className="fp-ai-btn-dismiss"
                    id="fp-sketch-open"
                    title="Add the walls as drawn, without closing the gap"
                    onClick={() => {
                      const open = interpretStroke(sketchProposal.points, editorState.walls, sketchOptions({ closeTolerance: 0 }));
                      if (open.walls.length > 0) commitSketch(open);
                      else setSketchProposal(null);
                    }}
                  >
                    Leave open
                  </button>
                )}
                <button
                  type="button"
                  className="fp-ai-btn-dismiss"
                  id="fp-sketch-discard"
                  onClick={() => setSketchProposal(null)}
                >
                  Redraw
                </button>
              </div>
            </div>
          )}

          {/* What a sketch stroke just added, with a one-tap Undo. It clears itself. */}
          {sketchNotice && !sketchProposal && (
            <div className="fp-sketch-chip no-print" role="status" aria-live="polite" id="fp-sketch-notice">
              <CheckCircle2 size={15} aria-hidden="true" />
              <span>{sketchNotice}</span>
              <button type="button" onClick={handleUndo} id="fp-sketch-undo">Undo</button>
            </div>
          )}

          {/* First-use tip for the tool in hand. Shown once; "Got it" hides it for good. */}
          {activeHint && !sketchProposal && !sketchNotice && (
            <div className="fp-hint-card no-print" role="note" id="fp-tool-hint">
              <Info size={16} aria-hidden="true" />
              <span>{TOOL_HINTS[activeHint]}</span>
              <button type="button" onClick={() => dismissHint(activeHint)} id="fp-tool-hint-ok">Got it</button>
            </div>
          )}

          {/* The older "AI Copilot" pill and "AI Live Assist" switch used to float here. They
              are folded into the one Building Mistry AI button above, so nothing else sits on
              the drawing. Live stroke reading stays off unless turned on in Settings. */}

          {/* Real-Time AI Understanding Feedback Toast */}
          {aiLiveFeedback && (
            <div className="fp-ai-feedback-toast" role="status" aria-live="polite">
              <Sparkles size={16} color="#334155" />
              <span>{aiLiveFeedback.message}</span>
            </div>
          )}

          <svg
            ref={svgRef}
            className="fp-canvas-svg"
            width="100%"
            height="100%"
            {...canvasInputProps}
            onContextMenu={e => e.preventDefault()}
            onDragOver={e => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'copy';
            }}
            onDrop={handleCanvasDrop}
            style={{ display: 'block', touchAction: 'none', overscrollBehavior: 'none', userSelect: 'none', WebkitUserSelect: 'none' }}
            aria-label="Floor plan drawing canvas"
            role="img"
          >
          {/* ── SVG Defs: Patterns & Dimension Markers ──────── */}
          <defs>
            {showGrid && (
              <>
                <pattern
                  id="fp-grid-pattern"
                  width={GRID_SIZE_PX * zoom}
                  height={GRID_SIZE_PX * zoom}
                  patternUnits="userSpaceOnUse"
                  patternTransform={`translate(${panX % (GRID_SIZE_PX * zoom)}, ${panY % (GRID_SIZE_PX * zoom)})`}
                >
                  <path
                    d={`M ${GRID_SIZE_PX * zoom} 0 L 0 0 0 ${GRID_SIZE_PX * zoom}`}
                    fill="none"
                    stroke={viewMode === 'blueprint' ? 'rgba(100,149,237,0.3)' : 'rgba(148,163,184,0.22)'}
                    strokeWidth={0.5}
                  />
                </pattern>
                <pattern
                  id="fp-major-grid"
                  width={GRID_SIZE_PX * zoom * 5}
                  height={GRID_SIZE_PX * zoom * 5}
                  patternUnits="userSpaceOnUse"
                  patternTransform={`translate(${panX % (GRID_SIZE_PX * zoom * 5)}, ${panY % (GRID_SIZE_PX * zoom * 5)})`}
                >
                  <path
                    d={`M ${GRID_SIZE_PX * zoom * 5} 0 L 0 0 0 ${GRID_SIZE_PX * zoom * 5}`}
                    fill="none"
                    stroke={viewMode === 'blueprint' ? 'rgba(100,149,237,0.5)' : 'rgba(100,116,139,0.2)'}
                    strokeWidth={0.8}
                  />
                </pattern>
              </>
            )}

            {/* Rooms use one plain light fill (ROOM_FILL); there is no floor texture. */}

            {/* Planner 5D Dimension Arrow Markers */}
            <marker
              id="fp-dim-arrow-green-start"
              viewBox="0 0 10 10"
              refX="2"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto"
            >
              <path d="M 9 2 L 1 5 L 9 8 z" fill="#059669" />
            </marker>
            <marker
              id="fp-dim-arrow-green-end"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto"
            >
              <path d="M 1 2 L 9 5 L 1 8 z" fill="#059669" />
            </marker>

            {/* Wall dimension arrowheads. Red = wall length; green (above) = clear inside size. */}
            <marker id="fp-dim-arrow-red-start" viewBox="0 0 10 10" refX="1" refY="5" markerWidth="7" markerHeight="7" orient="auto" markerUnits="userSpaceOnUse">
              <path d="M 10 1.5 L 1 5 L 10 8.5 z" fill={dimColor} />
            </marker>
            <marker id="fp-dim-arrow-red-end" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto" markerUnits="userSpaceOnUse">
              <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill={dimColor} />
            </marker>
          </defs>

          {showGrid && (
            <>
              <rect width="100%" height="100%" fill="url(#fp-grid-pattern)" />
              <rect width="100%" height="100%" fill="url(#fp-major-grid)" />
            </>
          )}

          {/* ── Background Reference Plan Image (FloorPlanCreator standard) ── */}
          {currentFloor.backgroundImage && currentFloor.backgroundImage.visible !== false && currentFloor.backgroundImage.url && (
            <image
              href={currentFloor.backgroundImage.url}
              x={panX + currentFloor.backgroundImage.x * GRID_SIZE_PX * zoom}
              y={panY + currentFloor.backgroundImage.y * GRID_SIZE_PX * zoom}
              width={currentFloor.backgroundImage.width * GRID_SIZE_PX * zoom}
              height={currentFloor.backgroundImage.height * GRID_SIZE_PX * zoom}
              opacity={currentFloor.backgroundImage.opacity ?? 0.5}
              style={{ pointerEvents: currentFloor.backgroundImage.locked ? 'none' : 'auto' }}
            />
          )}

          {/* ── Plot Boundary ────────────────────────── */}
          <rect
            x={panX}
            y={panY}
            width={plotW}
            height={plotH}
            fill={viewMode === 'blueprint' ? 'rgba(30,58,138,0.15)' : 'rgba(248,250,252,0.9)'}
            stroke={viewMode === 'blueprint' ? '#93c5fd' : '#334155'}
            strokeWidth={2.5 * zoom}
            strokeDasharray={viewMode === 'blueprint' ? undefined : `${10 * zoom},${5 * zoom}`}
          />

          {/* Plot Dimension Labels */}
          {showDimensions && plan && (
            <>
              <text
                x={panX + plotW / 2}
                y={panY - 10 * zoom}
                textAnchor="middle"
                fontSize={12 * zoom}
                fill={viewMode === 'blueprint' ? '#93c5fd' : '#475569'}
                fontFamily="'Outfit', sans-serif"
                fontWeight="600"
              >
                {formatDim(plan.plotLength, unit)} (Plot Length)
              </text>
              <text
                x={panX - 12 * zoom}
                y={panY + plotH / 2}
                textAnchor="middle"
                fontSize={12 * zoom}
                fill={viewMode === 'blueprint' ? '#93c5fd' : '#475569'}
                fontFamily="'Outfit', sans-serif"
                fontWeight="600"
                transform={`rotate(-90, ${panX - 12 * zoom}, ${panY + plotH / 2})`}
              >
                {formatDim(plan.plotWidth, unit)} (Plot Width)
              </text>
            </>
          )}

          {/* ── Rooms (Planner 5D Style CAD Rendering) ─── */}
          {editorState.rooms.map(room => {
            if (!isLayerVisible('rooms')) return null;
            const rx = room.x * GRID_SIZE_PX * zoom + panX;
            const ry = room.y * GRID_SIZE_PX * zoom + panY;
            const rw = room.width * GRID_SIZE_PX * zoom;
            const rh = room.height * GRID_SIZE_PX * zoom;
            const isSelected = selectedElement?.id === room.id;
            const wallThickPx = Math.max(7, Math.min(14, (room.wallThickness || 0.75) * 8 * zoom));
            const hasPoly = !!(room.polygonPoints && room.polygonPoints.length >= 3);
            const polyPointsStr = hasPoly
              ? room.polygonPoints!.map(p => `${p.x * GRID_SIZE_PX * zoom + panX},${p.y * GRID_SIZE_PX * zoom + panY}`).join(' ')
              : '';

            return (
              <g
                key={room.id}
                style={{ cursor: activeTool === 'select' ? 'move' : undefined }}
                {...elementDownProps('room', room.id)}
              >
                {hasPoly ? (
                  <>
                    {/* 1. One plain, light fill for every room (the floor finish is a property, not drawn) */}
                    <polygon
                      points={polyPointsStr}
                      fill={viewMode === 'blueprint' ? 'rgba(30,58,138,0.18)' : ROOM_FILL}
                    />
                    {/* 2. Outline: only for a room placed by hand (a wall room's walls are drawn already) */}
                    <polygon
                      points={polyPointsStr}
                      fill="none"
                      stroke={room.fromWalls ? 'none' : (viewMode === 'blueprint' ? '#93c5fd' : '#1e293b')}
                      strokeWidth={wallThickPx}
                      style={{ pointerEvents: 'none' }}
                    />
                    {/* Active Selection Glow for Polygon */}
                    {isSelected && (
                      <polygon
                        points={polyPointsStr}
                        fill="none"
                        stroke="#2563eb"
                        strokeWidth={2.5 * zoom}
                        strokeDasharray={`${6 * zoom},${4 * zoom}`}
                        style={{ pointerEvents: 'none' }}
                      />
                    )}
                  </>
                ) : (
                  <>
                    {/* 1. Plain light fill */}
                    <rect
                      x={rx}
                      y={ry}
                      width={rw}
                      height={rh}
                      fill={viewMode === 'blueprint' ? 'rgba(30,58,138,0.18)' : ROOM_FILL}
                      rx={2 * zoom}
                    />
                    {/* 2. Planner 5D Perimeter Wall Border */}
                    <rect
                      x={rx}
                      y={ry}
                      width={rw}
                      height={rh}
                      fill="none"
                      stroke={room.fromWalls ? 'none' : (viewMode === 'blueprint' ? '#93c5fd' : '#1e293b')}
                      strokeWidth={wallThickPx}
                      rx={2 * zoom}
                      style={{ pointerEvents: 'none' }}
                    />

                    {/* Active Selection Glow Box */}
                    {isSelected && (
                      <rect
                        x={rx - 4 * zoom}
                        y={ry - 4 * zoom}
                        width={rw + 8 * zoom}
                        height={rh + 8 * zoom}
                        fill="none"
                        stroke="#2563eb"
                        strokeWidth={2 * zoom}
                        strokeDasharray={`${6 * zoom},${4 * zoom}`}
                        rx={4 * zoom}
                        style={{ pointerEvents: 'none' }}
                      />
                    )}
                  </>
                )}

                {/* On-Canvas Rotation Knob & Stalk */}
                {isSelected && !room.locked && !room.fromWalls && (
                  <g
                    className="fp-rotation-handle-group"
                    style={{ cursor: 'pointer' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      const next = ((room.rotation || 0) + 45) % 360;
                      dispatchWithHistory({ type: 'UPDATE_ROOM', id: room.id, changes: { rotation: next } });
                    }}
                  >
                    <line
                      x1={rx + rw / 2}
                      y1={ry}
                      x2={rx + rw / 2}
                      y2={ry - 26 * zoom}
                      stroke="#0284c7"
                      strokeWidth={1.5 * zoom}
                      strokeDasharray={`${3 * zoom},${2 * zoom}`}
                    />
                    <circle
                      cx={rx + rw / 2}
                      cy={ry - 26 * zoom}
                      r={9 * zoom}
                      fill="#0284c7"
                      stroke="#ffffff"
                      strokeWidth={2}
                    />
                    <text
                      x={rx + rw / 2}
                      y={ry - 23 * zoom}
                      textAnchor="middle"
                      fontSize={10 * zoom}
                      fill="#ffffff"
                      style={{ pointerEvents: 'none', userSelect: 'none' }}
                    >
                      ↻
                    </text>
                  </g>
                )}

                {room.locked && (
                  <g transform={`translate(${rx + rw - 14 * zoom}, ${ry + 4 * zoom})`}>
                    <circle cx={5 * zoom} cy={5 * zoom} r={5 * zoom} fill="#ef4444" />
                    <text x={5 * zoom} y={7.5 * zoom} textAnchor="middle" fontSize={5 * zoom} fill="#ffffff">🔒</text>
                  </g>
                )}

                {/* 3. Center Label Pill matching Planner 5D Screenshot: "Room (24.980 m2)" */}
                <g style={{ pointerEvents: 'none' }}>
                  <rect
                    x={rx + rw / 2 - Math.max(52, (room.label.length * 4.2 + 28) * zoom)}
                    y={ry + rh / 2 - 11 * zoom}
                    width={Math.max(104, (room.label.length * 8.4 + 56) * zoom)}
                    height={22 * zoom}
                    rx={6 * zoom}
                    fill="rgba(255, 255, 255, 0.94)"
                    stroke="#cbd5e1"
                    strokeWidth={1}
                  />
                  <text
                    x={rx + rw / 2}
                    y={ry + rh / 2 + 4 * zoom}
                    textAnchor="middle"
                    fontSize={Math.max(8.5, 10.5 * zoom)}
                    fill="#0f172a"
                    fontFamily="'Outfit', sans-serif"
                    fontWeight="700"
                  >
                    {room.label} ({computeRoomArea(room, unit)})
                  </text>
                </g>

                {/* Clear size inside a wall-enclosed room (green): the space between the inner
                    wall faces. Wall lengths are the red lines outside the walls. */}
                {(() => {
                  const inner = roomInteriors.get(room.id);
                  if (!inner || !(showDimensions || isSelected)) return null;
                  const a = toScreen(inner.x, inner.y);
                  const iw = inner.width * GRID_SIZE_PX * zoom;
                  const ih = inner.height * GRID_SIZE_PX * zoom;
                  const isBox = inner.polygon.length === 4 && Math.abs(inner.area - inner.width * inner.height) < 1e-6;
                  // Width x height for a rectangular room, with the clear area when there is
                  // room for it (always when selected); the clear area alone for other shapes.
                  const size = isBox ? `Inside ${formatDimension(inner.width, unit)} × ${formatDimension(inner.height, unit)}` : `Inside ${formatAreaShort(inner.area, unit)}`;
                  const full = isBox ? `${size} · ${formatAreaShort(inner.area, unit)}` : size;
                  const roomFor = (text: string) => iw > text.length * dimFontPx * 0.56 + 12 && ih > 74;
                  const label = isSelected || roomFor(full) ? full : size;
                  if (!isSelected && !roomFor(label)) return null;
                  return (
                    <g style={{ pointerEvents: 'none' }} className="fp-room-inside">
                      {isSelected && (
                        <polygon
                          points={inner.polygon.map(p => { const s = toScreen(p.x, p.y); return `${s.x},${s.y}`; }).join(' ')}
                          fill="none"
                          stroke="#059669"
                          strokeWidth={1.2}
                          strokeDasharray="5,4"
                        />
                      )}
                      {isSelected && isBox && iw > 90 && ih > 90 && (
                        <>
                          <line
                            x1={a.x + 2} y1={a.y + 14} x2={a.x + iw - 2} y2={a.y + 14}
                            stroke="#059669" strokeWidth={1.2}
                            markerStart="url(#fp-dim-arrow-green-start)" markerEnd="url(#fp-dim-arrow-green-end)"
                          />
                          <line
                            x1={a.x + 14} y1={a.y + 2} x2={a.x + 14} y2={a.y + ih - 2}
                            stroke="#059669" strokeWidth={1.2}
                            markerStart="url(#fp-dim-arrow-green-start)" markerEnd="url(#fp-dim-arrow-green-end)"
                          />
                        </>
                      )}
                      <text
                        x={rx + rw / 2}
                        y={ry + rh / 2 + 11 * zoom + dimFontPx + 5}
                        textAnchor="middle"
                        fontSize={dimFontPx}
                        fontWeight="700"
                        fontFamily="'Outfit', sans-serif"
                        fill="#047857"
                        stroke="#ffffff"
                        strokeWidth={3}
                        paintOrder="stroke"
                      >
                        {label}
                      </text>
                    </g>
                  );
                })()}

                {/* 4. Planner 5D Exterior Dimension Lines & Arrows. A room placed by hand
                    carries its own size here; a wall-enclosed room is dimensioned by its walls. */}
                {(showDimensions || isSelected) && !room.fromWalls && (
                  <>
                    {/* Top Width Dimension line with witness extensions */}
                    <g style={{ pointerEvents: 'none' }}>
                      <line x1={rx} y1={ry} x2={rx} y2={ry - 26 * zoom} stroke="#94a3b8" strokeWidth={0.8} strokeDasharray="2,2" />
                      <line x1={rx + rw} y1={ry} x2={rx + rw} y2={ry - 26 * zoom} stroke="#94a3b8" strokeWidth={0.8} strokeDasharray="2,2" />
                      <line
                        x1={rx} y1={ry - 18 * zoom}
                        x2={rx + rw} y2={ry - 18 * zoom}
                        stroke="#059669"
                        strokeWidth={1.5}
                        markerStart="url(#fp-dim-arrow-green-start)"
                        markerEnd="url(#fp-dim-arrow-green-end)"
                      />
                      <rect
                        x={rx + rw / 2 - 25 * zoom}
                        y={ry - 27 * zoom}
                        width={50 * zoom}
                        height={16 * zoom}
                        rx={4 * zoom}
                        fill="#ffffff"
                        stroke="rgba(16, 185, 129, 0.45)"
                        strokeWidth={1}
                      />
                      <text
                        x={rx + rw / 2}
                        y={ry - 16 * zoom}
                        textAnchor="middle"
                        fontSize={Math.max(8, 10 * zoom)}
                        fill="#0f172a"
                        fontFamily="'Outfit', sans-serif"
                        fontWeight="700"
                      >
                        {formatDim(room.width, unit)}
                      </text>
                    </g>

                    {/* Left/Side Height Dimension line with witness extensions */}
                    <g style={{ pointerEvents: 'none' }}>
                      <line x1={rx} y1={ry} x2={rx - 26 * zoom} y2={ry} stroke="#94a3b8" strokeWidth={0.8} strokeDasharray="2,2" />
                      <line x1={rx} y1={ry + rh} x2={rx - 26 * zoom} y2={ry + rh} stroke="#94a3b8" strokeWidth={0.8} strokeDasharray="2,2" />
                      <line
                        x1={rx - 18 * zoom} y1={ry}
                        x2={rx - 18 * zoom} y2={ry + rh}
                        stroke="#059669"
                        strokeWidth={1.5}
                        markerStart="url(#fp-dim-arrow-green-start)"
                        markerEnd="url(#fp-dim-arrow-green-end)"
                      />
                      <g transform={`rotate(-90, ${rx - 18 * zoom}, ${ry + rh / 2})`}>
                        <rect
                          x={rx - 18 * zoom - 25 * zoom}
                          y={ry + rh / 2 - 9 * zoom}
                          width={50 * zoom}
                          height={16 * zoom}
                          rx={4 * zoom}
                          fill="#ffffff"
                          stroke="rgba(16, 185, 129, 0.45)"
                          strokeWidth={1}
                        />
                        <text
                          x={rx - 18 * zoom}
                          y={ry + rh / 2 + 2 * zoom}
                          textAnchor="middle"
                          fontSize={Math.max(8, 10 * zoom)}
                          fill="#0f172a"
                          fontFamily="'Outfit', sans-serif"
                          fontWeight="700"
                        >
                          {formatDim(room.height, unit)}
                        </text>
                      </g>
                    </g>
                  </>
                )}
              </g>
            );
          })}

          {/* ── Staircases ──────────────────────────── */}
          {editorState.stairs.map(stair => {
            if (!isLayerVisible('stairs')) return null;
            const sx = stair.x * GRID_SIZE_PX * zoom + panX;
            const sy = stair.y * GRID_SIZE_PX * zoom + panY;
            const sw = stair.width * GRID_SIZE_PX * zoom;
            const sl = stair.length * GRID_SIZE_PX * zoom;
            const steps = stair.steps || 14;
            const isSelected = selectedElement?.id === stair.id;
            return (
              <g
                key={stair.id}
                transform={`rotate(${stair.rotation || 0}, ${sx + sw / 2}, ${sy + sl / 2})`}
                style={{ cursor: activeTool === 'select' ? 'move' : undefined }}
                {...elementDownProps('stairs', stair.id)}
              >
                <rect
                  x={sx} y={sy} width={sw} height={sl}
                  fill={viewMode === 'blueprint' ? 'rgba(234,179,8,0.1)' : 'rgba(241,245,249,0.6)'}
                  stroke={isSelected ? '#2563eb' : viewMode === 'blueprint' ? '#fde047' : '#475569'}
                  strokeWidth={2 * zoom}
                />
                {/* Steps lines */}
                {Array.from({ length: steps }).map((_, i) => {
                  const stepY = sy + (i * sl) / steps;
                  return (
                    <line
                      key={i}
                      x1={sx} y1={stepY} x2={sx + sw} y2={stepY}
                      stroke={viewMode === 'blueprint' ? '#fde047' : '#475569'}
                      strokeWidth={1 * zoom}
                    />
                  );
                })}
                {/* Up/Down arrow */}
                <line
                  x1={sx + sw / 2} y1={sy + sl - 6 * zoom}
                  x2={sx + sw / 2} y2={sy + 10 * zoom}
                  stroke="#475569" strokeWidth={2 * zoom}
                />
                <polygon
                  points={`${sx + sw / 2},${sy + 4 * zoom} ${sx + sw / 2 - 4 * zoom},${sy + 12 * zoom} ${sx + sw / 2 + 4 * zoom},${sy + 12 * zoom}`}
                  fill="#475569"
                />
                <text
                  x={sx + sw / 2} y={sy + sl / 2} textAnchor="middle"
                  fontSize={8 * zoom} fill="#334155" fontWeight="700"
                >
                  UP
                </text>
              </g>
            );
          })}

          {/* ── Furniture ───────────────────────────── */}
          {editorState.furniture.map(furn => {
            if (!isLayerVisible(furn.layer || 'furniture') && !isLayerVisible('furniture')) return null;
            const fx = furn.x * GRID_SIZE_PX * zoom + panX;
            const fy = furn.y * GRID_SIZE_PX * zoom + panY;
            const fw = furn.width * GRID_SIZE_PX * zoom;
            const fh = furn.height * GRID_SIZE_PX * zoom;
            const isSelected = selectedElement?.id === furn.id;
            return (
              <g
                key={furn.id}
                transform={`rotate(${furn.rotation || 0}, ${fx + fw / 2}, ${fy + fh / 2})`}
                style={{ cursor: activeTool === 'select' ? 'move' : undefined }}
                {...elementDownProps('furniture', furn.id)}
              >
                {isSelected && (
                  <rect
                    x={fx - 4 * zoom} y={fy - 4 * zoom}
                    width={fw + 8 * zoom} height={fh + 8 * zoom}
                    fill="none" stroke="#2563eb" strokeWidth={2 * zoom}
                    strokeDasharray={`${4 * zoom},${2 * zoom}`}
                  />
                )}
                {furn.locked && (
                  <g transform={`translate(${fx + fw - 12 * zoom}, ${fy + 2 * zoom})`}>
                    <circle cx={5 * zoom} cy={5 * zoom} r={5 * zoom} fill="#ef4444" />
                    <text x={5 * zoom} y={7.5 * zoom} textAnchor="middle" fontSize={5 * zoom} fill="#ffffff">🔒</text>
                  </g>
                )}
                <foreignObject x={fx} y={fy} width={fw} height={fh}>
                  <div style={{ width: '100%', height: '100%', pointerEvents: 'none' }}>
                    <ArchitecturalSymbol
                      itemType={furn.itemType}
                      width={fw}
                      height={fh}
                      blueprintMode={viewMode === 'blueprint'}
                    />
                  </div>
                </foreignObject>
              </g>
            );
          })}

          {/* ── Columns / Pillars ────────────────────── */}
          {editorState.columns.map(col => {
            if (!isLayerVisible('structure')) return null;
            const cx = col.x * GRID_SIZE_PX * zoom + panX;
            const cy = col.y * GRID_SIZE_PX * zoom + panY;
            const cw = col.width * GRID_SIZE_PX * zoom;
            const cd = col.depth * GRID_SIZE_PX * zoom;
            const isSelected = selectedElement?.id === col.id;
            return (
              <g
                key={col.id}
                style={{ cursor: activeTool === 'select' ? 'move' : undefined }}
                {...elementDownProps('column', col.id)}
              >
                {col.shape === 'round' ? (
                  <circle
                    cx={cx} cy={cy} r={cw / 2}
                    fill={isSelected ? '#2563eb' : viewMode === 'blueprint' ? '#38bdf8' : '#334155'}
                    stroke="#ffffff" strokeWidth={1 * zoom}
                  />
                ) : (
                  <>
                    <rect
                      x={cx - cw / 2} y={cy - cd / 2} width={cw} height={cd}
                      fill={isSelected ? '#2563eb' : viewMode === 'blueprint' ? '#1e40af' : '#1e293b'}
                      stroke="#ffffff" strokeWidth={1.2 * zoom}
                    />
                    {/* Crosshatch */}
                    <line
                      x1={cx - cw / 2} y1={cy - cd / 2} x2={cx + cw / 2} y2={cy + cd / 2}
                      stroke="#94a3b8" strokeWidth={1 * zoom}
                    />
                    <line
                      x1={cx - cw / 2} y1={cy + cd / 2} x2={cx + cw / 2} y2={cy - cd / 2}
                      stroke="#94a3b8" strokeWidth={1 * zoom}
                    />
                  </>
                )}
              </g>
            );
          })}

          {/* ── Walls (Thick Architectural Geometry with Door Openings) ── */}
          {editorState.walls.map(wall => {
            if (!isLayerVisible('walls')) return null;
            const strokeW = Math.max(3, (wall.thickness || 0.75) * GRID_SIZE_PX * zoom);
            const isSelected = selectedElement?.id === wall.id;

            // Compute solid wall segments and door openings along this wall
            const { solidSegments, openings } = computeWallSegmentsWithOpenings(
              wall,
              editorState.doors,
              editorState.windows
            );

            // Walls are #1E293B (partitions a little lighter); the selected wall is blue.
            const wallFillColor = isSelected
              ? '#2563eb'
              : viewMode === 'blueprint'
              ? (wall.wallType === 'exterior' ? '#93c5fd' : '#bfdbfe')
              : (wall.wallType === 'partition' ? '#475569' : '#1e293b');

            const wallBorderColor = isSelected
              ? '#1d4ed8'
              : viewMode === 'blueprint'
              ? '#60a5fa'
              : '#0f172a';

            return (
              <g
                key={wall.id}
                style={{ cursor: activeTool === 'select' ? 'move' : undefined }}
                {...elementDownProps('wall', wall.id)}
                className="fp-wall-group"
              >
                {/* Full-length transparent click target for easy selection */}
                <line
                  x1={wall.x1 * GRID_SIZE_PX * zoom + panX}
                  y1={wall.y1 * GRID_SIZE_PX * zoom + panY}
                  x2={wall.x2 * GRID_SIZE_PX * zoom + panX}
                  y2={wall.y2 * GRID_SIZE_PX * zoom + panY}
                  stroke="transparent"
                  strokeWidth={Math.max(20, strokeW + 12)}
                />

                {/* Render Solid Wall Sub-Segments (Cut cleanly at door openings!) */}
                {solidSegments.map((seg, sIdx) => {
                  const sx1 = seg.x1 * GRID_SIZE_PX * zoom + panX;
                  const sy1 = seg.y1 * GRID_SIZE_PX * zoom + panY;
                  const sx2 = seg.x2 * GRID_SIZE_PX * zoom + panX;
                  const sy2 = seg.y2 * GRID_SIZE_PX * zoom + panY;

                  return (
                    <g key={`seg-${sIdx}`}>
                      {/* Thick Wall Body */}
                      <line
                        x1={sx1} y1={sy1} x2={sx2} y2={sy2}
                        stroke={wallFillColor}
                        strokeWidth={strokeW}
                        strokeLinecap="square"
                      />
                      {/* Architectural Edge Contrast Lines for CAD depth */}
                      {zoom > 0.5 && strokeW > 6 && (
                        <line
                          x1={sx1} y1={sy1} x2={sx2} y2={sy2}
                          stroke={wallBorderColor}
                          strokeWidth={Math.max(1, 0.8 * zoom)}
                          strokeDasharray={wall.wallType === 'partition' ? `${4 * zoom},${2 * zoom}` : undefined}
                        />
                      )}
                    </g>
                  );
                })}

                {/* Door Openings: Floor Threshold & Wall Return Jambs */}
                {openings.filter(op => op.type === 'door').map((op, oIdx) => {
                  const L = Math.hypot(wall.x2 - wall.x1, wall.y2 - wall.y1);
                  const ux = (wall.x2 - wall.x1) / L;
                  const uy = (wall.y2 - wall.y1) / L;
                  const nx = -uy;
                  const ny = ux;

                  // Opening start and end points along centerline
                  const osX1 = (wall.x1 + op.tStart * ux) * GRID_SIZE_PX * zoom + panX;
                  const osY1 = (wall.y1 + op.tStart * uy) * GRID_SIZE_PX * zoom + panY;
                  const osX2 = (wall.x1 + op.tEnd * ux) * GRID_SIZE_PX * zoom + panX;
                  const osY2 = (wall.y1 + op.tEnd * uy) * GRID_SIZE_PX * zoom + panY;

                  const halfThick = strokeW / 2;

                  return (
                    <g key={`door-cut-${oIdx}`} style={{ pointerEvents: 'none' }}>
                      {/* Floor threshold line */}
                      <line
                        x1={osX1} y1={osY1} x2={osX2} y2={osY2}
                        stroke={viewMode === 'blueprint' ? 'rgba(147,197,253,0.3)' : '#cbd5e1'}
                        strokeWidth={1 * zoom}
                        strokeDasharray="2,2"
                      />
                      {/* Wall Jamb Return at tStart */}
                      <line
                        x1={osX1 - nx * halfThick} y1={osY1 - ny * halfThick}
                        x2={osX1 + nx * halfThick} y2={osY1 + ny * halfThick}
                        stroke={wallBorderColor}
                        strokeWidth={1.5 * zoom}
                      />
                      {/* Wall Jamb Return at tEnd */}
                      <line
                        x1={osX2 - nx * halfThick} y1={osY2 - ny * halfThick}
                        x2={osX2 + nx * halfThick} y2={osY2 + ny * halfThick}
                        stroke={wallBorderColor}
                        strokeWidth={1.5 * zoom}
                      />
                    </g>
                  );
                })}

                {/* The wall's length is drawn in the dimension layer further down, above
                    everything else, so its label can be tapped. */}

                {/* Wall end points. The selected wall's resize handles are drawn in their own
                    layer above every wall (see "Resize handles" below): inside this group a
                    neighbouring wall drawn later would lie over them and take the touch. */}
                {isSelected ? null : (
                  <>
                    <circle
                      cx={wall.x1 * GRID_SIZE_PX * zoom + panX}
                      cy={wall.y1 * GRID_SIZE_PX * zoom + panY}
                      r={Math.max(2, 3.5 * zoom)}
                      fill={viewMode === 'blueprint' ? '#60a5fa' : '#475569'}
                      style={{ pointerEvents: 'none' }}
                    />
                    <circle
                      cx={wall.x2 * GRID_SIZE_PX * zoom + panX}
                      cy={wall.y2 * GRID_SIZE_PX * zoom + panY}
                      r={Math.max(2, 3.5 * zoom)}
                      fill={viewMode === 'blueprint' ? '#60a5fa' : '#475569'}
                      style={{ pointerEvents: 'none' }}
                    />
                  </>
                )}
              </g>
            );
          })}

          {/* ── Doors (Architectural Leaf, Swing Arc & Jambs) ────── */}
          {editorState.doors.map(door => {
            if (!isLayerVisible('doors')) return null;
            const dx = door.x * GRID_SIZE_PX * zoom + panX;
            const dy = door.y * GRID_SIZE_PX * zoom + panY;
            const dw = (door.width || 3) * GRID_SIZE_PX * zoom;
            const isSelected = selectedElement?.id === door.id;

            // Host wall thickness matching: Single source of truth!
            const host = findHostWallForOpening(door.x, door.y, editorState.walls, 2.0);
            const wallThickVal = host ? host.wallThickness : (door.hostWallThickness || 0.75);
            const wallThickPx = wallThickVal * GRID_SIZE_PX * zoom;

            const swingAngle = door.swingAngle || 90;
            const flipH = door.flipHorizontal ? -1 : 1;
            const flipV = door.flipVertical ? -1 : 1;

            return (
              <g
                key={door.id}
                transform={`rotate(${door.rotation}, ${dx}, ${dy})`}
                style={{ cursor: activeTool === 'select' ? 'move' : undefined }}
                {...elementDownProps('door', door.id)}
                className="fp-door-group"
              >
                {/* Click target */}
                <rect
                  x={dx - dw / 2}
                  y={dy - wallThickPx / 2 - 4 * zoom}
                  width={dw}
                  height={wallThickPx + 8 * zoom}
                  fill="transparent"
                />

                {/* Wood Frame Jambs on both sides matching host wall thickness */}
                <rect
                  x={dx - dw / 2 - 2 * zoom}
                  y={dy - wallThickPx / 2}
                  width={4 * zoom}
                  height={wallThickPx}
                  fill={isSelected ? '#2563eb' : '#475569'}
                  stroke={isSelected ? '#1d4ed8' : '#334155'}
                  strokeWidth={1}
                />
                <rect
                  x={dx + dw / 2 - 2 * zoom}
                  y={dy - wallThickPx / 2}
                  width={4 * zoom}
                  height={wallThickPx}
                  fill={isSelected ? '#2563eb' : '#475569'}
                  stroke={isSelected ? '#1d4ed8' : '#334155'}
                  strokeWidth={1}
                />

                {/* Door Leaf or Pass-Through Opening */}
                {door.doorType === 'Opening' ? (
                  /* Pass-through opening / archway: clean opening casing, no door leaf or swing arc */
                  <g>
                    <line
                      x1={dx - dw / 2}
                      y1={dy - wallThickPx / 2}
                      x2={dx - dw / 2}
                      y2={dy + wallThickPx / 2}
                      stroke={isSelected ? '#2563eb' : '#94a3b8'}
                      strokeWidth={2 * zoom}
                    />
                    <line
                      x1={dx + dw / 2}
                      y1={dy - wallThickPx / 2}
                      x2={dx + dw / 2}
                      y2={dy + wallThickPx / 2}
                      stroke={isSelected ? '#2563eb' : '#94a3b8'}
                      strokeWidth={2 * zoom}
                    />
                    <line
                      x1={dx - dw / 2}
                      y1={dy}
                      x2={dx + dw / 2}
                      y2={dy}
                      stroke={isSelected ? '#2563eb' : '#64748b'}
                      strokeWidth={1.5 * zoom}
                      strokeDasharray={`${4 * zoom},${3 * zoom}`}
                    />
                  </g>
                ) : (
                  /* Standard Door Leaf and Swing Arc */
                  <g transform={`scale(${flipH}, ${flipV})`}>
                    <rect
                      x={dx - dw / 2}
                      y={dy - dw}
                      width={3.5 * zoom}
                      height={dw}
                      fill={isSelected ? '#2563eb' : viewMode === 'blueprint' ? '#93c5fd' : '#f8fafc'}
                      stroke={isSelected ? '#1d4ed8' : viewMode === 'blueprint' ? '#60a5fa' : '#334155'}
                      strokeWidth={1.5 * zoom}
                      rx={1}
                    />

                    {/* 90° Swing Arc */}
                    <path
                      d={`M ${dx - dw / 2} ${dy - dw} A ${dw} ${dw} 0 0 1 ${dx + dw / 2} ${dy}`}
                      fill="none"
                      stroke={isSelected ? '#2563eb' : viewMode === 'blueprint' ? '#60a5fa' : '#64748b'}
                      strokeWidth={1.2 * zoom}
                      strokeDasharray={`${4 * zoom},${3 * zoom}`}
                    />
                  </g>
                )}

                {/* Door label */}
                {zoom > 0.6 && (
                  <text
                    x={dx}
                    y={dy - wallThickPx / 2 - 6 * zoom}
                    textAnchor="middle"
                    fontSize={Math.max(7, 9 * zoom)}
                    fill={viewMode === 'blueprint' ? '#93c5fd' : '#64748b'}
                    fontFamily="'Outfit', sans-serif"
                    fontWeight="600"
                    style={{ pointerEvents: 'none' }}
                  >
                    {door.doorType} ({formatDim(door.width, unit)})
                  </text>
                )}
              </g>
            );
          })}

          {/* ── Windows (Embedded Frame, Glazing & Exterior Sill) ── */}
          {editorState.windows.map(win => {
            if (!isLayerVisible('windows')) return null;
            const wx = win.x * GRID_SIZE_PX * zoom + panX;
            const wy = win.y * GRID_SIZE_PX * zoom + panY;
            const ww = (win.width || 4) * GRID_SIZE_PX * zoom;
            const isSelected = selectedElement?.id === win.id;

            // Single source of truth: host wall thickness
            const host = findHostWallForOpening(win.x, win.y, editorState.walls, 2.0);
            const wallThickVal = host ? host.wallThickness : (win.hostWallThickness || 0.75);
            const wallThickPx = wallThickVal * GRID_SIZE_PX * zoom;

            const winType = win.windowType || 'Standard';

            return (
              <g
                key={win.id}
                transform={`rotate(${win.rotation}, ${wx}, ${wy})`}
                style={{ cursor: activeTool === 'select' ? 'move' : undefined }}
                {...elementDownProps('window', win.id)}
                className="fp-window-group"
              >
                {/* Outer Frame embedded matching exact host wall thickness */}
                <rect
                  x={wx - ww / 2}
                  y={wy - wallThickPx / 2}
                  width={ww}
                  height={wallThickPx}
                  fill={viewMode === 'blueprint' ? 'rgba(30,58,138,0.4)' : 'rgba(255,255,255,0.95)'}
                  stroke={isSelected ? '#2563eb' : viewMode === 'blueprint' ? '#93c5fd' : '#0284c7'}
                  strokeWidth={1.8 * zoom}
                />

                {/* Exterior Window Sill projection */}
                <line
                  x1={wx - ww / 2 - 3 * zoom}
                  y1={wy - wallThickPx / 2 - 2 * zoom}
                  x2={wx + ww / 2 + 3 * zoom}
                  y2={wy - wallThickPx / 2 - 2 * zoom}
                  stroke={isSelected ? '#2563eb' : viewMode === 'blueprint' ? '#60a5fa' : '#0369a1'}
                  strokeWidth={2.5 * zoom}
                />

                {/* Glazing Lines based on Window Type */}
                {winType.includes('Sliding') ? (
                  <>
                    <line
                      x1={wx - ww / 2 + 3 * zoom}
                      y1={wy - 2 * zoom}
                      x2={wx + 4 * zoom}
                      y2={wy - 2 * zoom}
                      stroke={isSelected ? '#1d4ed8' : '#0284c7'}
                      strokeWidth={1.8 * zoom}
                    />
                    <line
                      x1={wx - 4 * zoom}
                      y1={wy + 2 * zoom}
                      x2={wx + ww / 2 - 3 * zoom}
                      y2={wy + 2 * zoom}
                      stroke={isSelected ? '#1d4ed8' : '#0284c7'}
                      strokeWidth={1.8 * zoom}
                    />
                  </>
                ) : winType.includes('Ventilator') ? (
                  <>
                    {[-ww / 3, 0, ww / 3].map((off, idx) => (
                      <line
                        key={idx}
                        x1={wx + off - 4 * zoom}
                        y1={wy - wallThickPx / 2 + 2 * zoom}
                        x2={wx + off + 4 * zoom}
                        y2={wy + wallThickPx / 2 - 2 * zoom}
                        stroke="#0ea5e9"
                        strokeWidth={1.2 * zoom}
                      />
                    ))}
                  </>
                ) : winType.includes('Double') || winType.includes('Large') ? (
                  <>
                    <line
                      x1={wx - ww / 2 + 2 * zoom}
                      y1={wy}
                      x2={wx + ww / 2 - 2 * zoom}
                      y2={wy}
                      stroke={isSelected ? '#1d4ed8' : '#38bdf8'}
                      strokeWidth={2 * zoom}
                    />
                    <line
                      x1={wx}
                      y1={wy - wallThickPx / 2}
                      x2={wx}
                      y2={wy + wallThickPx / 2}
                      stroke={isSelected ? '#1d4ed8' : '#0284c7'}
                      strokeWidth={2 * zoom}
                    />
                  </>
                ) : (
                  <>
                    <line
                      x1={wx - ww / 2 + 2 * zoom}
                      y1={wy}
                      x2={wx + ww / 2 - 2 * zoom}
                      y2={wy}
                      stroke={isSelected ? '#1d4ed8' : '#38bdf8'}
                      strokeWidth={2 * zoom}
                    />
                  </>
                )}

                {/* Window Label */}
                {zoom > 0.6 && (
                  <text
                    x={wx}
                    y={wy + wallThickPx / 2 + 10 * zoom}
                    textAnchor="middle"
                    fontSize={Math.max(7, 9 * zoom)}
                    fill={viewMode === 'blueprint' ? '#93c5fd' : '#0284c7'}
                    fontFamily="'Outfit', sans-serif"
                    fontWeight="700"
                    style={{ pointerEvents: 'none' }}
                  >
                    W: {formatDim(win.width, unit)}
                  </text>
                )}
              </g>
            );
          })}

          {/* ── Annotations ──────────────────────────── */}
          {editorState.annotations.map(annot => {
            if (!isLayerVisible('annotations')) return null;
            const ax = annot.x * GRID_SIZE_PX * zoom + panX;
            const ay = annot.y * GRID_SIZE_PX * zoom + panY;
            const isSelected = selectedElement?.id === annot.id;
            return (
              <g
                key={annot.id}
                style={{ cursor: activeTool === 'select' ? 'move' : undefined }}
                {...elementDownProps('annotation', annot.id)}
              >
                <text
                  x={ax} y={ay}
                  fontSize={Math.max(9, (annot.fontSize || 10) * zoom)}
                  fill={isSelected ? '#2563eb' : viewMode === 'blueprint' ? '#67e8f9' : '#0f172a'}
                  fontFamily="'Outfit', sans-serif"
                  fontWeight="600"
                >
                  {annot.text}
                </text>
              </g>
            );
          })}

          {/* ── Live Wall Preview (while drawing) ────── */}
          {isDrawingWall && wallStart && currentMousePos && (
            <line
              x1={wallStart.x * GRID_SIZE_PX * zoom + panX}
              y1={wallStart.y * GRID_SIZE_PX * zoom + panY}
              x2={currentMousePos.x * GRID_SIZE_PX * zoom + panX}
              y2={currentMousePos.y * GRID_SIZE_PX * zoom + panY}
              stroke={viewMode === 'blueprint' ? '#60a5fa' : '#1e293b'}
              strokeWidth={Math.max(2, wallThickness * GRID_SIZE_PX * zoom)}
              strokeDasharray={`${8 * zoom},${4 * zoom}`}
              opacity={0.55}
              style={{ pointerEvents: 'none' }}
            />
          )}
          {/* Building Mistry AI preview: what Apply would change. New or moved walls dashed
              blue, walls that would go dashed red, changed rooms outlined with their new size.
              Nothing here is part of the plan. */}
          {aiPreview && (() => {
            const now = new Map(editorState.walls.map(w => [w.id, w]));
            const next = new Map(aiPreview.walls.map(w => [w.id, w]));
            const same = (a: FloorPlanWall, b: FloorPlanWall) => a.x1 === b.x1 && a.y1 === b.y1 && a.x2 === b.x2 && a.y2 === b.y2;
            const added = aiPreview.walls.filter(w => !now.has(w.id) || !same(now.get(w.id)!, w));
            const gone = editorState.walls.filter(w => !next.has(w.id) || !same(next.get(w.id)!, w));
            const roomsNow = new Map(editorState.rooms.map(r => [r.id, r]));
            const changedRooms = aiPreview.rooms.filter(r => {
              const o = roomsNow.get(r.id);
              return !o || Math.abs(roomArea(o) - roomArea(r)) > 1e-6 || o.label !== r.label;
            });
            const line = (w: FloorPlanWall, color: string, key: string, dash: string) => {
              const a = toScreen(w.x1, w.y1), b = toScreen(w.x2, w.y2);
              return <line key={key} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={color} strokeWidth={Math.max(3, (w.thickness || 0.5) * GRID_SIZE_PX * zoom)} strokeOpacity={0.55} strokeDasharray={dash} strokeLinecap="butt" />;
            };
            return (
              <g className="fp-ai-preview" style={{ pointerEvents: 'none' }}>
                {gone.map(w => line(w, '#dc2626', `g-${w.id}`, '6,5'))}
                {added.map(w => line(w, '#2563eb', `a-${w.id}`, '10,5'))}
                {changedRooms.map(r => {
                  const pts = roomOutline(r).map(p => toScreen(p.x, p.y));
                  const c = pts.reduce((s, p) => ({ x: s.x + p.x / pts.length, y: s.y + p.y / pts.length }), { x: 0, y: 0 });
                  return (
                    <g key={`r-${r.id}`}>
                      <polygon points={pts.map(p => `${p.x},${p.y}`).join(' ')} fill="rgba(37, 99, 235, 0.08)" stroke="#2563eb" strokeWidth={1.5} strokeDasharray="4,4" />
                      <text x={c.x} y={c.y} textAnchor="middle" fontSize={12} fontWeight={700} fill="#1e3a8a" fontFamily="'Outfit', sans-serif">
                        {(r.label || r.roomType)} · {formatAreaShort(roomArea(r), unit)}
                      </text>
                    </g>
                  );
                })}
              </g>
            );
          })()}

          {/* Live dimension line beside the wall being drawn. Dashed: it is a guide while the
              finger moves; the wall's real dimension line appears once the wall is placed. */}
          {isDrawingWall && wallStart && currentMousePos && (() => {
            const a = toScreen(wallStart.x, wallStart.y), b = toScreen(currentMousePos.x, currentMousePos.y);
            const px = Math.hypot(b.x - a.x, b.y - a.y);
            if (px < 24) return null;
            const len = Math.hypot(currentMousePos.x - wallStart.x, currentMousePos.y - wallStart.y);
            const n = { x: (a.y - b.y) / px, y: (b.x - a.x) / px };
            const normal = n.y < 0 || (n.y === 0 && n.x < 0) ? n : { x: -n.x, y: -n.y };
            const text = formatDimension(len, unit);
            const labelLength = text.length * dimFontPx * 0.6 + 12;
            const labelHeight = dimFontPx + 8;
            const half = Math.max(3, wallThickness * GRID_SIZE_PX * zoom) / 2;
            const d = layoutDimension(a, b, normal, { offset: half + 22 + labelHeight / 2, gap: half + 3, overshoot: 5, labelLength, labelHeight, arrow: 7 });
            return (
              <g className="fp-live-dim" style={{ pointerEvents: 'none' }}>
                {d.extensions.map(([p, q], i) => <line key={i} x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke="#475569" strokeWidth={0.9} />)}
                <line x1={d.line[0].x} y1={d.line[0].y} x2={d.line[1].x} y2={d.line[1].y} stroke="#475569" strokeWidth={1.2} strokeDasharray="5,3" />
                <g transform={`rotate(${d.rotation}, ${d.label.x}, ${d.label.y})`}>
                  <rect x={d.label.x - labelLength / 2} y={d.label.y - labelHeight / 2} width={labelLength} height={labelHeight} rx={4} fill="#0f172a" />
                  <text x={d.label.x} y={d.label.y + dimFontPx * 0.36} textAnchor="middle" fontSize={dimFontPx} fill="#ffffff" fontFamily="'Outfit', sans-serif" fontWeight="700">{text}</text>
                </g>
              </g>
            );
          })()}

          {/* ── Blueprint Overlays ───────────────────── */}
          {viewMode === 'blueprint' && (
            <>
              {/* North Indicator */}
              <g transform={`translate(${panX + plotW + 40 * zoom}, ${panY})`}>
                <circle cx={0} cy={0} r={18 * zoom} fill="none" stroke="#93c5fd" strokeWidth={1.5 * zoom} />
                <text x={0} y={-5 * zoom} textAnchor="middle" fontSize={14 * zoom} fill="#f0f9ff" fontFamily="'Outfit', sans-serif" fontWeight="800">N</text>
                <line x1={0} y1={-18 * zoom} x2={0} y2={0} stroke="#f0f9ff" strokeWidth={2 * zoom} />
                <polygon points={`0,${-18 * zoom} ${-4 * zoom},0 ${4 * zoom},0`} fill="#f0f9ff" />
              </g>
              {/* Scale Indicator */}
              <g transform={`translate(${panX}, ${panY + plotH + 30 * zoom})`}>
                <text x={0} y={0} fontSize={10 * zoom} fill="#93c5fd" fontFamily="'Outfit', sans-serif">
                  Scale: 1:{Math.round(1 / zoom * 20)} | {formatDim(5, unit)} = {Math.round(5 * GRID_SIZE_PX * zoom)}px
                </text>
              </g>
              {/* Title Block */}
              <g transform={`translate(${panX}, ${panY + plotH + 50 * zoom})`}>
                <text x={0} y={0} fontSize={11 * zoom} fill="#bfdbfe" fontFamily="'Outfit', sans-serif" fontWeight="700">
                  {plan.buildingName} — {currentFloor.name}
                </text>
                {plan.siteName && (
                  <text x={0} y={16 * zoom} fontSize={9 * zoom} fill="#93c5fd" fontFamily="'Outfit', sans-serif">
                    Site: {plan.siteName}
                  </text>
                )}
              </g>
            </>
          )}

          {/* ── Wall dimensions ──────────────────────────────────────────────
              One dimension line per wall, outside the room: extension lines, arrowheads and
              the length, all worked out from the wall's real end points on every render, so
              they follow a drag as it happens. Red by default. With the Select tool, tapping
              a label opens a box to type the exact length. */}
          {showDimensions && isLayerVisible('dimensions') && isLayerVisible('walls') && (
            <g className="fp-wall-dims">
              {editorState.walls.map(wall => {
                const len = wallLength(wall);
                const side = wallOutside.get(wall.id);
                if (!side || len <= 0) return null;
                const isSelected = selectedElement?.id === wall.id;
                const p1 = toScreen(wall.x1, wall.y1);
                const p2 = toScreen(wall.x2, wall.y2);
                const onScreen = Math.hypot(p2.x - p1.x, p2.y - p1.y);
                // Too small on screen to dimension legibly: zoom in, or select the wall.
                if (onScreen < 30 && !isSelected) return null;
                const halfThick = Math.max(3, (wall.thickness || 0.75) * GRID_SIZE_PX * zoom) / 2;
                const text = formatDimension(len, unit);
                const labelLength = text.length * dimFontPx * 0.6 + 12;
                const labelHeight = dimFontPx + 8;
                // Where the user moved this label to (display only; see FloorPlanWall).
                const dragging = dimDrag?.wallId === wall.id;
                const extraOut = (dragging ? dimDrag!.offset : wall.dimensionOffset || 0) * GRID_SIZE_PX * zoom;
                const placed = dragging ? dimDrag!.shift : wall.dimensionShift;
                const slide = (placed !== undefined ? placed : autoDimSlide(wall)) * GRID_SIZE_PX * zoom;
                const d = layoutDimension(p1, p2, side, {
                  // Clear of the wall face and of the round resize handles at its ends.
                  offset: halfThick + (isMobile ? 26 : 20) + labelHeight / 2 + extraOut,
                  gap: halfThick + 3,
                  overshoot: 5,
                  labelLength,
                  labelHeight,
                  arrow: 7,
                });
                const label = { x: d.label.x + ((p2.x - p1.x) / onScreen) * slide, y: d.label.y + ((p2.y - p1.y) / onScreen) * slide };
                const lineMid = { x: (d.line[0].x + d.line[1].x) / 2, y: (d.line[0].y + d.line[1].y) / 2 };
                const hitW = Math.max(labelLength, isMobile ? 56 : 44);
                const hitH = Math.max(labelHeight, isMobile ? 40 : 28);
                return (
                  <g key={wall.id} className="fp-wall-dim" data-wall-id={wall.id}>
                    <g style={{ pointerEvents: 'none' }}>
                      {d.extensions.map(([a, b], i) => (
                        <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={dimColor} strokeWidth={0.9} strokeOpacity={0.85} />
                      ))}
                      <line
                        x1={d.line[0].x} y1={d.line[0].y} x2={d.line[1].x} y2={d.line[1].y}
                        stroke={dimColor}
                        strokeWidth={isSelected ? 1.8 : 1.2}
                        markerStart={onScreen > 26 ? 'url(#fp-dim-arrow-red-start)' : undefined}
                        markerEnd={onScreen > 26 ? 'url(#fp-dim-arrow-red-end)' : undefined}
                      />
                      {Math.abs(slide) > onScreen / 2 - labelLength / 2 && (
                        <line x1={lineMid.x} y1={lineMid.y} x2={label.x} y2={label.y} stroke={dimColor} strokeWidth={0.8} strokeDasharray="2,2" />
                      )}
                    </g>
                    <g
                      transform={`rotate(${d.rotation}, ${label.x}, ${label.y})`}
                      className="fp-wall-dim-label"
                      style={{ pointerEvents: dimLabelsTappable ? 'auto' : 'none', cursor: dimLabelsTappable ? (dragging ? 'grabbing' : 'text') : undefined }}
                      {...dimDownProps(wall.id)}
                    >
                      <title>{`Wall length ${text} (centre to centre). Tap to type an exact length; drag to move the label.`}</title>
                      <rect x={label.x - hitW / 2} y={label.y - hitH / 2} width={hitW} height={hitH} fill="transparent" />
                      <rect
                        x={label.x - labelLength / 2}
                        y={label.y - labelHeight / 2}
                        width={labelLength}
                        height={labelHeight}
                        rx={4}
                        fill="#ffffff"
                        stroke={isSelected || dragging ? '#dc2626' : 'rgba(220, 38, 38, 0.45)'}
                        strokeWidth={isSelected || dragging ? 1.6 : 1}
                      />
                      <text
                        x={label.x}
                        y={label.y + dimFontPx * 0.36}
                        textAnchor="middle"
                        fontSize={dimFontPx}
                        fill="#b91c1c"
                        fontFamily="'Outfit', sans-serif"
                        fontWeight="700"
                        style={{ userSelect: 'none' }}
                      >
                        {text}
                      </text>
                    </g>
                  </g>
                );
              })}
            </g>
          )}

          {/* ── Resize handles of the selected wall ──────────────────────────
              Above every wall and label, so they can always be grabbed. Each handle sits in a
              larger invisible circle (44 px across on a phone) so a finger need not be exact.
              Dragging one moves the corner; every wall that meets there follows. */}
          {/* The part of the selected wall that "Erase part" removes (when other walls meet it),
              and a cut mark where Split will cut it: where the wall was tapped. */}
          {selectedWall && activeTool === 'select' && wallTap?.id === selectedWall.id && isLayerVisible('walls') && (() => {
            const seg = wallSegmentAt(editorState.walls, selectedWall.id, wallTap.point, joinTolerance(unit));
            if (!seg) return null;
            const len = wallLength(selectedWall);
            if (len <= 0) return null;
            const ux = (selectedWall.x2 - selectedWall.x1) / len, uy = (selectedWall.y2 - selectedWall.y1) / len;
            const t = Math.min(len, Math.max(0, (wallTap.point.x - selectedWall.x1) * ux + (wallTap.point.y - selectedWall.y1) * uy));
            const a = toScreen(seg.a.x, seg.a.y), b = toScreen(seg.b.x, seg.b.y);
            const m = toScreen(selectedWall.x1 + ux * t, selectedWall.y1 + uy * t);
            const half = Math.max(8, (selectedWall.thickness || 0.75) * GRID_SIZE_PX * zoom / 2 + 6);
            return (
              <g className="fp-wall-segment-hint" style={{ pointerEvents: 'none' }}>
                {!seg.whole && (
                  <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#2563eb" strokeOpacity={0.3} strokeWidth={half * 2} strokeLinecap="butt" />
                )}
                <line x1={m.x - uy * half} y1={m.y + ux * half} x2={m.x + uy * half} y2={m.y - ux * half} stroke="#2563eb" strokeWidth={2.5} strokeDasharray="4,3" />
              </g>
            );
          })()}

          {selectedElement?.type === 'wall' && activeTool === 'select' && isLayerVisible('walls') && (() => {
            const wall = editorState.walls.find(w => w.id === selectedElement.id);
            if (!wall) return null;
            const r = Math.min(16, Math.max(isMobile ? 12 : 7, 5 * zoom));
            return (
              <g className="fp-wall-handles">
                {([1, 2] as const).map(end => {
                  const h = toScreen(end === 1 ? wall.x1 : wall.x2, end === 1 ? wall.y1 : wall.y2);
                  return (
                    <g
                      key={end}
                      className="fp-wall-handle"
                      data-end={end}
                      style={{ cursor: wall.locked ? 'not-allowed' : 'grab' }}
                      {...jointDownProps(wall, end)}
                    >
                      <circle cx={h.x} cy={h.y} r={isMobile ? 22 : 13} fill="transparent" />
                      <circle
                        cx={h.x} cy={h.y} r={r}
                        fill={wall.locked ? '#94a3b8' : '#ffffff'}
                        stroke={wall.locked ? '#64748b' : '#2563eb'}
                        strokeWidth={3}
                      />
                      <circle cx={h.x} cy={h.y} r={r * 0.34} fill={wall.locked ? '#64748b' : '#2563eb'} />
                    </g>
                  );
                })}
              </g>
            );
          })()}

          {/* Sketch mode: the finger's stroke (faint) and, over it, the straight walls it
              would become. Nothing here is part of the plan until the finger lifts. */}
          {isFreehandDrawing && freehandPoints.length > 1 && (
            sketchPreview
              ? renderSketchWalls(sketchPreview, freehandPoints, false)
              : (
                <polyline
                  points={freehandPoints.map(p => `${p.x * GRID_SIZE_PX * zoom + panX},${p.y * GRID_SIZE_PX * zoom + panY}`).join(' ')}
                  fill="none"
                  stroke="#94a3b8"
                  strokeWidth={1.5}
                  strokeDasharray="2,5"
                  style={{ pointerEvents: 'none' }}
                />
              )
          )}
          {sketchProposal && renderSketchWalls(sketchProposal.result, sketchProposal.points, true)}

          {/* ── Interactive 2-Point Measure Tape (FloorPlanCreator standard) ── */}
          {measureStart && measureCurrent && (
            <g className="fp-measure-tape-overlay" style={{ pointerEvents: 'none' }}>
              <line
                x1={measureStart.x * GRID_SIZE_PX * zoom + panX}
                y1={measureStart.y * GRID_SIZE_PX * zoom + panY}
                x2={measureCurrent.x * GRID_SIZE_PX * zoom + panX}
                y2={measureCurrent.y * GRID_SIZE_PX * zoom + panY}
                stroke="#10b981"
                strokeWidth={2.5 * zoom}
                strokeDasharray={`${6 * zoom},${4 * zoom}`}
              />
              <circle
                cx={measureStart.x * GRID_SIZE_PX * zoom + panX}
                cy={measureStart.y * GRID_SIZE_PX * zoom + panY}
                r={5 * zoom}
                fill="#10b981"
                stroke="#ffffff"
                strokeWidth={1.5 * zoom}
              />
              <circle
                cx={measureCurrent.x * GRID_SIZE_PX * zoom + panX}
                cy={measureCurrent.y * GRID_SIZE_PX * zoom + panY}
                r={5 * zoom}
                fill="#10b981"
                stroke="#ffffff"
                strokeWidth={1.5 * zoom}
              />
              {(() => {
                const dx = measureCurrent.x - measureStart.x;
                const dy = measureCurrent.y - measureStart.y;
                const dist = Math.hypot(dx, dy);
                const deg = Math.round((Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360);
                const midX = ((measureStart.x + measureCurrent.x) / 2) * GRID_SIZE_PX * zoom + panX;
                const midY = ((measureStart.y + measureCurrent.y) / 2) * GRID_SIZE_PX * zoom + panY;
                return (
                  <g transform={`translate(${midX}, ${midY - 12 * zoom})`}>
                    <rect
                      x={-60 * zoom}
                      y={-14 * zoom}
                      width={120 * zoom}
                      height={22 * zoom}
                      rx={4 * zoom}
                      fill="#ffffff"
                      stroke="#10b981"
                      strokeWidth={1.2 * zoom}
                    />
                    <text
                      x={0}
                      y={2 * zoom}
                      textAnchor="middle"
                      fill="#0f172a"
                      fontSize={11 * zoom}
                      fontWeight="bold"
                      fontFamily="'Outfit', sans-serif"
                    >
                      {formatDim(dist, unit)} ({deg}°)
                    </text>
                  </g>
                );
              })()}

              {/* Actionable Plan Quality Diagnostic Canvas Beacon (Priority 4) */}
              {diagnosticBeacon && (
                <g
                  className="fp-diagnostic-beacon"
                  transform={`translate(${diagnosticBeacon.x * GRID_SIZE_PX}, ${diagnosticBeacon.y * GRID_SIZE_PX})`}
                >
                  <circle
                    r={28}
                    fill="rgba(239, 68, 68, 0.16)"
                    stroke="#ef4444"
                    strokeWidth={2}
                    className="fp-beacon-ring"
                  />
                  <circle
                    r={7}
                    fill="#dc2626"
                    className="fp-beacon-core"
                  />
                  <line x1={-16} y1={0} x2={16} y2={0} stroke="#dc2626" strokeWidth={1.5} />
                  <line x1={0} y1={-16} x2={0} y2={16} stroke="#dc2626" strokeWidth={1.5} />
                  <g transform="translate(0, -22)">
                    <rect
                      x={-Math.min(90, Math.max(50, diagnosticBeacon.title.length * 4))}
                      y={-18}
                      width={Math.min(180, Math.max(100, diagnosticBeacon.title.length * 8))}
                      height={20}
                      rx={6}
                      fill="#dc2626"
                      stroke="#ffffff"
                      strokeWidth={1}
                    />
                    <text
                      x={0}
                      y={-4}
                      fill="#ffffff"
                      fontSize={10}
                      fontWeight="bold"
                      textAnchor="middle"
                      fontFamily="sans-serif"
                    >
                      {diagnosticBeacon.title.length > 25 ? `${diagnosticBeacon.title.slice(0, 25)}...` : diagnosticBeacon.title}
                    </text>
                  </g>
                </g>
              )}
            </g>
          )}
        </svg>

        {/* Measurement check: a small badge at each spot where two measurements that should
            match differ by a few millimetres. Tapping one opens the check; nothing changes
            until a measurement is chosen there. */}
        {alignmentIssues.length > 0 && showDimensions && activeTool === 'select' && !isDrawingWall && !dimDrag && !isDragging && !resizingWall && (
          <div className="fp-check-badges no-print">
            {alignmentIssues.slice(0, 12).map(issue => {
              const s = toScreen(issue.focus.x, issue.focus.y);
              return (
                <button
                  key={issue.id}
                  type="button"
                  className="fp-check-badge"
                  style={{ left: s.x, top: s.y }}
                  onClick={() => setShowChecks(true)}
                  title={`Measurements differ by ${formatMm(issue.differenceMm)}. Tap to check.`}
                  aria-label={`Measurements differ by ${formatMm(issue.differenceMm)}. Open the measurement check.`}
                >
                  {formatMm(issue.differenceMm)}
                </button>
              );
            })}
          </div>
        )}

        {/* Live Snap Circle Indicator */}
        {snapIndicator && (
          <div
            className="fp-snap-indicator"
            style={{ left: snapIndicator.screenX, top: snapIndicator.screenY }}
            title={`Snapped to ${snapIndicator.type}`}
          />
        )}

        {/* Live Wall Drawing Floating Length Badge */}
        {liveLengthBadge && (
          <div
            className="fp-live-length-badge"
            style={{ left: liveLengthBadge.screenX, top: liveLengthBadge.screenY }}
          >
            <strong>{liveLengthBadge.lengthStr}</strong>
            {liveLengthBadge.alt && <span className="fp-live-length-alt"> · {liveLengthBadge.alt}</span>}
            <span className="fp-live-length-alt"> · {liveLengthBadge.angleDeg}°</span>
            {liveLengthBadge.snapped && <span className="fp-live-length-snap">{liveLengthBadge.snapped}</span>}
          </div>
        )}

        {/* Priority 1: First-Time Guided Flow Welcome Card */}
        {editorState.walls.length === 0 && editorState.rooms.length === 0 && !dismissedStartCard && !loading && (
          <div className="fp-start-flow-card no-print">
            <div className="fp-start-card-header">
              <div>
                <h3 className="fp-start-card-title">
                  <Sparkles size={20} className="text-amber-500" />
                  Start Your Floor Plan
                </h3>
                <p className="fp-start-card-subtitle">
                  Select how you would like to begin your drawing:
                </p>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setDismissedStartCard(true)}
                title="Close and use blank canvas"
              >
                <X size={16} />
              </button>
            </div>

            <div className="fp-start-card-options">
              <button
                type="button"
                className="fp-start-option-btn"
                onClick={() => {
                  setDismissedStartCard(true);
                  setActiveTool('wall');
                  onNotify('Blank plan ready. Click and drag on canvas to draw outer walls.', 'info');
                }}
              >
                <div className="fp-start-option-icon">
                  <Pencil size={22} />
                </div>
                <span className="fp-start-option-name">Blank Plan</span>
                <span className="fp-start-option-desc">Start drawing straight outer walls freely</span>
              </button>

              <button
                type="button"
                className="fp-start-option-btn"
                onClick={() => setShowStarterTemplatesModal(true)}
              >
                <div className="fp-start-option-icon">
                  <LayoutGrid size={22} />
                </div>
                <span className="fp-start-option-name">Starter Template</span>
                <span className="fp-start-option-desc">Pick 1 BHK, 2 BHK, 3 BHK, or Duplex layout</span>
              </button>

              <button
                type="button"
                className="fp-start-option-btn"
                onClick={() => {
                  setDismissedStartCard(true);
                  setShowBgImageModal(true);
                }}
              >
                <div className="fp-start-option-icon">
                  <ImageIcon size={22} />
                </div>
                <span className="fp-start-option-name">Import Image</span>
                <span className="fp-start-option-desc">Upload a blueprint/photo to trace over</span>
              </button>
            </div>
          </div>
        )}

        {/* Priority 1: Guided Steps Checklist Widget */}
        {showGuidedChecklist && (editorState.walls.length < 8 || editorState.rooms.length === 0) && (
          <div className="fp-guided-steps-widget no-print" role="region" aria-label="Guided Steps">
            <div className="fp-guided-steps-header">
              <span className="flex items-center gap-1.5 font-bold">
                <CheckCircle2 size={14} /> Guided Steps
              </span>
              <button
                type="button"
                onClick={() => setShowGuidedChecklist(false)}
                className="btn btn-ghost btn-xs"
                title="Hide guided checklist"
              >
                <X size={13} />
              </button>
            </div>
            <div className="flex flex-col gap-1">
              <div
                className={`fp-guided-step-item ${editorState.walls.length >= 4 ? 'is-done' : ''}`}
                onClick={() => setActiveTool('wall')}
                title="Click to activate Wall tool"
              >
                <span className="fp-guided-step-num">{editorState.walls.length >= 4 ? '✓' : '1'}</span>
                <span>Draw outer walls ({editorState.walls.length}/4)</span>
              </div>
              <div
                className={`fp-guided-step-item ${editorState.rooms.length >= 1 ? 'is-done' : ''}`}
                onClick={() => setActiveTool('room')}
                title="Click to activate Room tool"
              >
                <span className="fp-guided-step-num">{editorState.rooms.length >= 1 ? '✓' : '2'}</span>
                <span>Add rooms ({editorState.rooms.length})</span>
              </div>
              <div
                className={`fp-guided-step-item ${(editorState.doors.length + editorState.windows.length) >= 1 ? 'is-done' : ''}`}
                onClick={() => setActiveTool('door')}
                title="Click to activate Door tool"
              >
                <span className="fp-guided-step-num">{(editorState.doors.length + editorState.windows.length) >= 1 ? '✓' : '3'}</span>
                <span>Place doors & windows ({editorState.doors.length + editorState.windows.length})</span>
              </div>
              <div
                className={`fp-guided-step-item ${showDimensions ? 'is-done' : ''}`}
                onClick={() => setShowDimensions(d => !d)}
                title="Click to toggle dimensions"
              >
                <span className="fp-guided-step-num">{showDimensions ? '✓' : '4'}</span>
                <span>Check dimensions</span>
              </div>
            </div>
          </div>
        )}

        {/* Priority 5: Floating Room Center Badge & Inline Details Editor */}
        {selectedElement?.type === 'room' && !isDrawingWall && !isPanning && (() => {
          const room = editorState.rooms.find(r => r.id === selectedElement.id);
          if (!room) return null;
          const rx = room.x + room.width / 2;
          const ry = room.y + room.height / 2;
          const screenPos = toScreen(rx, ry);

          return (
            <React.Fragment key={room.id}>
              <div
                className="fp-room-center-badge no-print"
                style={{
                  left: `${screenPos.x}px`,
                  top: `${screenPos.y - (editingRoomInlineId === room.id ? 90 : 36)}px`,
                }}
              >
                <span>🏠 {room.label || room.roomType}</span>
                <span>•</span>
                <span>{computeRoomArea(room, unit)}</span>
                <span>•</span>
                <span style={{ color: '#0369a1', fontSize: '0.68rem' }}>{room.floorFinish || 'Vitrified Tiles'}</span>
                <button
                  type="button"
                  className="fp-room-badge-edit-btn"
                  onClick={e => {
                    e.stopPropagation();
                    setEditingRoomInlineId(id => id === room.id ? null : room.id);
                  }}
                  title="Direct Room Details Edit"
                >
                  <Edit size={11} />
                  <span>{editingRoomInlineId === room.id ? 'Done' : 'Edit'}</span>
                </button>
              </div>

              {editingRoomInlineId === room.id && (
                <div
                  className="fp-room-quick-edit-popover no-print"
                  style={{
                    position: 'absolute',
                    left: `${screenPos.x}px`,
                    top: `${screenPos.y - 10}px`,
                    transform: 'translate(-50%, 0)',
                    background: '#ffffff',
                    border: '1.5px solid #0284c7',
                    borderRadius: '12px',
                    padding: '10px 14px',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
                    zIndex: 65,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    minWidth: '220px',
                  }}
                  onClick={e => e.stopPropagation()}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0369a1' }}>Edit Room Details</span>
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs"
                      onClick={() => setEditingRoomInlineId(null)}
                    >
                      <X size={13} />
                    </button>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 600 }}>Room Name</label>
                    <input
                      type="text"
                      value={room.label}
                      onChange={e => {
                        dispatchWithHistory({ type: 'UPDATE_ROOM', id: room.id, changes: { label: e.target.value } });
                        markUnsaved();
                      }}
                      className="fp-inspector-input"
                      style={{ width: '100%', fontSize: '0.8rem', padding: '4px 8px' }}
                    />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                    <div>
                      <label style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 600 }}>Width ({unit === 'feet' ? 'ft' : 'm'})</label>
                      <input
                        type="number"
                        step="0.5"
                        value={room.width}
                        onChange={e => {
                          const nw = parseFloat(e.target.value) || 1;
                          dispatchWithHistory({ type: 'UPDATE_ROOM', id: room.id, changes: { width: nw } });
                          markUnsaved();
                        }}
                        className="fp-inspector-input"
                        style={{ width: '100%', fontSize: '0.8rem', padding: '4px 8px' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 600 }}>Length ({unit === 'feet' ? 'ft' : 'm'})</label>
                      <input
                        type="number"
                        step="0.5"
                        value={room.height}
                        onChange={e => {
                          const nh = parseFloat(e.target.value) || 1;
                          dispatchWithHistory({ type: 'UPDATE_ROOM', id: room.id, changes: { height: nh } });
                          markUnsaved();
                        }}
                        className="fp-inspector-input"
                        style={{ width: '100%', fontSize: '0.8rem', padding: '4px 8px' }}
                      />
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 600 }}>Floor Finish</label>
                    <select
                      value={room.floorFinish || 'Vitrified Tiles'}
                      onChange={e => {
                        dispatchWithHistory({ type: 'UPDATE_ROOM', id: room.id, changes: { floorFinish: e.target.value } });
                        markUnsaved();
                      }}
                      className="fp-inspector-input"
                      style={{ width: '100%', fontSize: '0.8rem', padding: '4px 8px' }}
                    >
                      {['Vitrified Tiles', 'Marble', 'Granite', 'Wood Parquet', 'Ceramic Tiles', 'Concrete', 'Color Tint'].map(f => (
                        <option key={f} value={f}>{f}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </React.Fragment>
          );
        })()}

        {/* Priority 3: On-Canvas Floating Quick Action Bar for non-walls (doors, windows, furniture, columns, stairs) */}
        {selectedElement && selectedElement.type !== 'wall' && selectedElement.type !== 'room' && !isDrawingWall && !isFreehandDrawing && !isPanning && activeTool === 'select' && (() => {
          const entity = getSelectedEntity();
          if (!entity) return null;
          const isLocked = !!entity.locked;
          const ex = 'x' in entity ? (entity as any).x : 0;
          const ey = 'y' in entity ? (entity as any).y : 0;
          const screenPos = toScreen(ex, ey);

          return (
            <div
              className="fp-selection-quick-actions no-print"
              style={{
                position: 'absolute',
                left: `${screenPos.x}px`,
                top: `${screenPos.y - (isMobile ? 44 : 36)}px`,
                transform: 'translate(-50%, -50%)',
                zIndex: 60,
              }}
            >
              <button
                type="button"
                className="fp-quick-act-btn"
                onClick={e => { e.stopPropagation(); handleRotateSelected(); }}
                disabled={isLocked}
                title="Rotate 90° (R)"
                aria-label="Rotate"
              >
                <RotateCw size={14} />
              </button>
              <button
                type="button"
                className="fp-quick-act-btn"
                onClick={e => { e.stopPropagation(); handleDuplicateSelected(); }}
                title="Duplicate (Ctrl+D)"
                aria-label="Duplicate"
              >
                <Copy size={14} />
              </button>
              <button
                type="button"
                className="fp-quick-act-btn"
                onClick={e => { e.stopPropagation(); handleToggleLockSelected(); }}
                title={isLocked ? "Unlock (Ctrl+L)" : "Lock (Ctrl+L)"}
                aria-label="Lock"
              >
                {isLocked ? <Lock size={14} /> : <Unlock size={14} />}
              </button>
              <button
                type="button"
                className="fp-quick-act-btn danger"
                onClick={e => { e.stopPropagation(); handleDeleteSelected(); }}
                disabled={isLocked}
                title="Delete (Del)"
                aria-label="Delete"
              >
                <Trash2 size={14} />
              </button>
            </div>
          );
        })()}

        {/* Canva-style On-Canvas Floating Quick Length Adjuster */}
        {selectedElement?.type === 'wall' && !isDrawingWall && !isFreehandDrawing && !isPanning && !resizingWall && activeTool === 'select' && (() => {
          const wall = editorState.walls.find(w => w.id === selectedElement.id);
          if (!wall) return null;
          const midX = (wall.x1 + wall.x2) / 2;
          const midY = (wall.y1 + wall.y2) / 2;
          const screenPos = toScreen(midX, midY);
          const len = wallLength(wall);
          const step = baseUnitOf(unit) === 'feet' ? 1 : 0.25;
          const stepLabel = baseUnitOf(unit) === 'feet' ? '1 ft' : '0.25 m';

          return (
            <div
              className="fp-canva-length-adjuster"
              style={{
                position: 'absolute',
                left: `${screenPos.x}px`,
                top: `${screenPos.y - (isMobile ? 44 : 36)}px`,
                transform: 'translate(-50%, -50%)',
                zIndex: 60,
              }}
            >
              <button
                type="button"
                className="fp-canva-len-btn"
                disabled={wall.locked || len <= step}
                onClick={e => {
                  e.stopPropagation();
                  handleQuickAdjustWallLength(wall.id, -step);
                }}
                title={`Shorten by ${stepLabel}`}
                aria-label="Decrease wall length"
              >
                <Minus size={13} />
              </button>
              <button
                type="button"
                className="fp-canva-len-display"
                onClick={e => {
                  e.stopPropagation();
                  openWallEdit(wall.id);
                }}
                title="Tap to type exact length (Enter)"
              >
                <Ruler size={12} style={{ color: '#0f172a' }} />
                <span>{formatDimension(len, unit)}</span>
              </button>
              <button
                type="button"
                className="fp-canva-len-btn"
                disabled={wall.locked}
                onClick={e => {
                  e.stopPropagation();
                  handleQuickAdjustWallLength(wall.id, step);
                }}
                title={`Lengthen by ${stepLabel}`}
                aria-label="Increase wall length"
              >
                <Plus size={13} />
              </button>
            </div>
          );
        })()}

        {/* ── Planner5D Bottom Property Dock ─────────── */}
        {(showBottomDock || isMobile) && selectedElement && (() => {
          const entity = getSelectedEntity();
          if (!entity) return null;
          const isLocked = !!entity.locked;
          const isDrawingActive = isDrawingWall || isFreehandDrawing || !!resizingWall || isDragging || isPanning;
          // Phones have no side inspector, so the dock is always there, compact until opened.
          const dockMinimized = isMobile ? phoneDockOpenFor !== selectedElement.id : isBottomDockMinimized;

          if (dockMinimized) {
            return (
              <div
                className={`fp-bottom-property-dock fp-dock-minimized no-print ${isDrawingActive ? 'fp-dock-drawing-active' : ''}`}
                id="fp-bottom-dock"
                style={dockPos ? { left: `${dockPos.x}px`, top: `${dockPos.y}px`, bottom: 'auto', transform: 'none' } : undefined}
              >
                <div
                  className="fp-prop-dock-drag-handle"
                  title="Drag to reposition dock (Double-click to center)"
                  onMouseDown={handleDockDragStart}
                  onDoubleClick={resetDockPosition}
                >
                  <GripHorizontal size={14} />
                </div>
                <div
                  className="fp-dock-mini-badge"
                  onClick={toggleDockMinimized}
                  title="Click to expand full controls (▲)"
                >
                  <span className="fp-dock-mini-type">{selectedElement.type.toUpperCase()}</span>
                  <span className="fp-dock-mini-summary">{getDockEntitySummary(entity, selectedElement.type)}</span>
                </div>
                <div className="fp-dock-mini-actions">
                  {selectedElement.type === 'wall' && (
                    <button
                      type="button"
                      className="fp-dock-mini-btn"
                      onClick={() => openWallEdit(selectedElement.id)}
                      title="Type an exact length, thickness or position (Enter)"
                      id="fp-dock-size-btn"
                    >
                      <Ruler size={13} />
                      <span>Size</span>
                    </button>
                  )}
                  {selectedElement.type === 'wall' && (
                    <button
                      type="button"
                      className="fp-dock-mini-btn"
                      onClick={handleSplitSelectedWall}
                      disabled={isLocked}
                      title="Cut this wall into two walls where you tapped it"
                      id="fp-dock-split-btn"
                    >
                      <Split size={13} />
                      <span>Split</span>
                    </button>
                  )}
                  {selectedElement.type === 'wall' && selectedWallJoints > 0 && (
                    <button
                      type="button"
                      className="fp-dock-mini-btn"
                      onClick={handleEraseSelectedPart}
                      disabled={isLocked}
                      title="Erase only the highlighted part of this wall, up to the next joint"
                      id="fp-dock-erase-part-btn"
                    >
                      <Eraser size={13} />
                      <span>Erase part</span>
                    </button>
                  )}
                  {selectedElement.type === 'room' ? (
                    // A room has one sheet for name, type, size and delete.
                    <button
                      type="button"
                      className="fp-dock-mini-btn"
                      onClick={() => openRoomSheet(selectedElement.id)}
                      title="Name, type and size of this room"
                      id="fp-dock-room-btn"
                    >
                      <Edit size={13} />
                      <span>Edit room</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="fp-dock-mini-btn"
                      onClick={toggleDockMinimized}
                      title="Expand Full Controls (▲)"
                      id="fp-dock-expand-btn"
                    >
                      <ChevronUp size={13} />
                      <span>{isMobile ? 'Edit' : 'Expand'}</span>
                    </button>
                  )}
                  {!(selectedElement.type === 'room' && (entity as FloorPlanRoom).fromWalls) && (
                    <button
                      type="button"
                      className="fp-dock-mini-btn"
                      onClick={handleRotateSelected}
                      disabled={isLocked}
                      title="Rotate 90° (R)"
                      aria-label="Rotate 90 degrees"
                      id="fp-dock-rotate-btn"
                    >
                      <RotateCw size={13} />
                      <span>Rotate</span>
                    </button>
                  )}
                  <button
                    type="button"
                    className="fp-dock-mini-btn"
                    onClick={handleDuplicateSelected}
                    title="Duplicate (Ctrl + D)"
                    aria-label="Duplicate"
                    id="fp-dock-duplicate-btn"
                  >
                    <Copy size={13} />
                  </button>
                  <button
                    type="button"
                    className="fp-dock-mini-btn"
                    onClick={handleToggleLockSelected}
                    title={isLocked ? 'Unlock (Ctrl + L)' : 'Lock so it can not be moved or deleted (Ctrl + L)'}
                    aria-label={isLocked ? 'Unlock' : 'Lock'}
                    aria-pressed={isLocked}
                    id="fp-dock-lock-btn"
                  >
                    {isLocked ? <Lock size={13} /> : <Unlock size={13} />}
                  </button>
                  {!isMobile && (
                    <button
                      type="button"
                      className="fp-dock-mini-btn"
                      onClick={() => toggleShowBottomDock(false)}
                      title="Hide Floating Dock (Use Right Sidebar Inspector)"
                      id="fp-dock-sidebar-btn"
                    >
                      <SlidersHorizontal size={12} />
                      <span>Sidebar Only</span>
                    </button>
                  )}
                  <button
                    type="button"
                    className="fp-dock-mini-btn danger"
                    onClick={handleDeleteSelected}
                    disabled={isLocked}
                    title="Delete Element (Del)"
                    aria-label="Delete"
                    id="fp-dock-delete-btn"
                  >
                    <Trash2 size={12} />
                  </button>
                  <button
                    type="button"
                    className="fp-dock-mini-btn"
                    onClick={() => setSelectedElement(null)}
                    title="Deselect (Esc)"
                  >
                    <X size={12} />
                  </button>
                </div>
              </div>
            );
          }

          return (
            <div
              className={`fp-bottom-property-dock no-print ${isDrawingActive ? 'fp-dock-drawing-active' : ''}`}
              id="fp-bottom-dock"
              style={dockPos ? { left: `${dockPos.x}px`, top: `${dockPos.y}px`, bottom: 'auto', transform: 'none' } : undefined}
            >
              <div
                className="fp-prop-dock-drag-handle"
                title="Drag to move dock out of the way (Double-click to reset)"
                onMouseDown={handleDockDragStart}
                onDoubleClick={resetDockPosition}
              >
                <GripHorizontal size={14} />
              </div>

              <div className="fp-prop-dock-title">
                {selectedElement.type.toUpperCase()}{' '}
                <span style={{ color: '#1e293b', fontSize: '0.78rem' }}>
                  {(entity as any).label || (entity as any).itemType || (entity as any).doorType || (entity as any).windowType || (entity as any).wallType || ''}
                </span>
              </div>

              <div className="fp-prop-dock-inputs">
                {selectedElement.type === 'wall' && (() => {
                  const w = entity as FloorPlanWall;
                  return (
                    <>
                      {/* Length and thickness are typed in the wall-size box: it reads feet and
                          inches, keeps joined walls joined and is one undo step. */}
                      <button
                        type="button"
                        className="fp-prop-pill fp-prop-pill-btn"
                        onClick={() => openWallEdit(w.id)}
                        title="Type an exact length"
                        id="fp-dock-length"
                      >
                        <span className="fp-prop-pill-label">Length</span>
                        <strong>{formatDimension(wallLength(w), unit)}</strong>
                      </button>
                      <button
                        type="button"
                        className="fp-prop-pill fp-prop-pill-btn"
                        onClick={() => openWallEdit(w.id)}
                        title="Change the wall thickness"
                        id="fp-dock-thickness"
                      >
                        <span className="fp-prop-pill-label">Thick</span>
                        <strong>{formatThickness(w.thickness, unit)}</strong>
                      </button>
                      <div className="fp-prop-pill">
                        <span className="fp-prop-pill-label">Angle</span>
                        <button
                          type="button"
                          className="fp-stepper-btn"
                          disabled={isLocked}
                          onClick={() => {
                            const cur = getWallAngleDeg(w);
                            const next = (cur - 15 + 360) % 360;
                            rotateWallToAngle(w, next);
                          }}
                          title="Rotate -15°"
                        >
                          ↺
                        </button>
                        <input
                          type="number"
                          min={0}
                          max={359}
                          step={15}
                          className="fp-prop-pill-input"
                          style={{ width: 46 }}
                          value={Math.round(getWallAngleDeg(w))}
                          disabled={isLocked}
                          onChange={e => {
                            const deg = (parseFloat(e.target.value) || 0) % 360;
                            rotateWallToAngle(w, deg < 0 ? deg + 360 : deg);
                          }}
                        />
                        <button
                          type="button"
                          className="fp-stepper-btn"
                          disabled={isLocked}
                          onClick={() => {
                            const cur = getWallAngleDeg(w);
                            const next = (cur + 15) % 360;
                            rotateWallToAngle(w, next);
                          }}
                          title="Rotate +15°"
                        >
                          ↻
                        </button>
                      </div>
                      <div className="fp-angle-presets">
                        {[0, 45, 90, 180].map(deg => (
                          <button
                            key={deg}
                            type="button"
                            className={`fp-angle-chip ${Math.round(getWallAngleDeg(w)) % 360 === deg ? 'active' : ''}`}
                            onClick={() => rotateWallToAngle(w, deg)}
                          >
                            {deg}°
                          </button>
                        ))}
                      </div>
                    </>
                  );
                })()}

                {selectedElement.type === 'room' && (() => {
                  const r = entity as FloorPlanRoom;
                  const roomIndex = editorState.rooms.findIndex(rm => rm.id === r.id);
                  const totalRooms = editorState.rooms.length;
                  const wallThickVal = r.wallThickness || (unit === 'feet' ? 0.75 : 0.23);
                  return (
                    <>
                      {/* Planner 5D Area Badge */}
                      <div className="fp-room-area-badge" title="Room Area">
                        <span style={{ fontWeight: 800 }}>#</span>
                        <span>{computeRoomArea(r, unit)}</span>
                      </div>

                      {/* Type of Room Dropdown */}
                      <div className="fp-prop-pill">
                        <span className="fp-prop-pill-label">Type</span>
                        <select
                          value={r.roomType}
                          disabled={isLocked}
                          className="fp-prop-pill-select"
                          onChange={e => {
                            const rt = e.target.value as RoomType;
                            dispatch({
                              type: 'UPDATE_ROOM',
                              id: r.id,
                              changes: { roomType: rt, color: ROOM_COLORS[rt] }
                            });
                            markUnsaved();
                          }}
                        >
                          {ROOM_TYPES.map(rt => <option key={rt} value={rt}>{rt}</option>)}
                        </select>
                      </div>

                      {/* Size: typed in the room sheet, which moves the room's walls (rooms next to it follow). */}
                      <button
                        type="button"
                        className="fp-prop-pill fp-prop-pill-btn"
                        onClick={() => openRoomSheet(r.id)}
                        disabled={isLocked}
                        title="Change the width and length of this room"
                        id="fp-dock-room-size"
                      >
                        <span className="fp-prop-pill-label">Size</span>
                        <strong>{(() => { const b = roomBox(r); return b ? `${formatDimension(b.maxX - b.minX, unit)} × ${formatDimension(b.maxY - b.minY, unit)}` : formatAreaShort(roomArea(r), unit); })()}</strong>
                      </button>

                      {!r.fromWalls && (
                      <>
                      {/* Wall Thickness with Steppers < > */}
                      <div className="fp-prop-pill">
                        <span className="fp-prop-pill-label">Thick, {unit === 'feet' ? 'in' : 'cm'}</span>
                        <button
                          type="button"
                          className="fp-stepper-btn"
                          disabled={isLocked}
                          onClick={() => {
                            const cur = r.wallThickness || (unit === 'feet' ? 0.75 : 0.23);
                            dispatch({ type: 'UPDATE_ROOM', id: r.id, changes: { wallThickness: Math.max(0.3, +(cur - 0.1).toFixed(2)) } });
                            markUnsaved();
                          }}
                        >
                          &lt;
                        </button>
                        <span className="fp-prop-pill-input" style={{ width: 44 }}>
                          {unit === 'feet' ? Math.round(wallThickVal * 12) : Math.round(wallThickVal * 100)}
                        </span>
                        <button
                          type="button"
                          className="fp-stepper-btn"
                          disabled={isLocked}
                          onClick={() => {
                            const cur = r.wallThickness || (unit === 'feet' ? 0.75 : 0.23);
                            dispatch({ type: 'UPDATE_ROOM', id: r.id, changes: { wallThickness: +(cur + 0.1).toFixed(2) } });
                            markUnsaved();
                          }}
                        >
                          &gt;
                        </button>
                      </div>

                      {/* Room Angle & Rotation Pill */}
                      <div className="fp-prop-pill">
                        <span className="fp-prop-pill-label">Angle</span>
                        <button
                          type="button"
                          className="fp-stepper-btn"
                          disabled={isLocked}
                          onClick={() => {
                            const cur = r.rotation || 0;
                            const next = (cur - 15 + 360) % 360;
                            dispatchWithHistory({ type: 'UPDATE_ROOM', id: r.id, changes: { rotation: next } });
                          }}
                          title="Rotate -15°"
                        >
                          ↺
                        </button>
                        <input
                          type="number"
                          min={0}
                          max={359}
                          step={15}
                          className="fp-prop-pill-input"
                          style={{ width: 46 }}
                          value={Math.round(r.rotation || 0)}
                          disabled={isLocked}
                          onChange={e => {
                            const val = (parseFloat(e.target.value) || 0) % 360;
                            dispatchWithHistory({ type: 'UPDATE_ROOM', id: r.id, changes: { rotation: val < 0 ? val + 360 : val } });
                          }}
                        />
                        <button
                          type="button"
                          className="fp-stepper-btn"
                          disabled={isLocked}
                          onClick={() => {
                            const cur = r.rotation || 0;
                            const next = (cur + 15) % 360;
                            dispatchWithHistory({ type: 'UPDATE_ROOM', id: r.id, changes: { rotation: next } });
                          }}
                          title="Rotate +15°"
                        >
                          ↻
                        </button>
                      </div>
                      <div className="fp-angle-presets">
                        {[0, 45, 90, 180].map(deg => (
                          <button
                            key={deg}
                            type="button"
                            className={`fp-angle-chip ${Math.round(r.rotation || 0) % 360 === deg ? 'active' : ''}`}
                            onClick={() => {
                              dispatchWithHistory({ type: 'UPDATE_ROOM', id: r.id, changes: { rotation: deg } });
                            }}
                          >
                            {deg}°
                          </button>
                        ))}
                      </div>

                      </>
                      )}

                      {/* Room Schedule & Total Rooms button ("namba room ethana irukku") */}
                      <button
                        type="button"
                        className="fp-room-count-dock-btn"
                        onClick={() => setShowRoomScheduleModal(true)}
                        title="View All Rooms & Schedule"
                      >
                        🏠 Room {roomIndex + 1} of {totalRooms} (Schedule)
                      </button>
                    </>
                  );
                })()}

                {(selectedElement.type === 'door' || selectedElement.type === 'window') && (() => {
                  const isDoor = selectedElement.type === 'door';
                  const d = entity as (FloorPlanDoor | FloorPlanWindow);
                  return (
                    <>
                      <div className="fp-prop-pill">
                        <span className="fp-prop-pill-label">Width</span>
                        <input
                          type="number"
                          step="0.25"
                          className="fp-prop-pill-input"
                          value={d.width}
                          disabled={isLocked}
                          onChange={e => {
                            const v = parseFloat(e.target.value) || 1;
                            if (isDoor) dispatch({ type: 'UPDATE_DOOR', id: d.id, changes: { width: v } });
                            else dispatch({ type: 'UPDATE_WINDOW', id: d.id, changes: { width: v } });
                            markUnsaved();
                          }}
                        />
                        <span className="fp-prop-pill-unit">{unit === 'feet' ? 'ft' : 'm'}</span>
                      </div>
                      <div className="fp-prop-pill">
                        <span className="fp-prop-pill-label">Angle</span>
                        <input
                          type="number"
                          step="15"
                          className="fp-prop-pill-input"
                          value={d.rotation}
                          disabled={isLocked}
                          onChange={e => {
                            const v = parseInt(e.target.value) || 0;
                            if (isDoor) dispatch({ type: 'UPDATE_DOOR', id: d.id, changes: { rotation: v } });
                            else dispatch({ type: 'UPDATE_WINDOW', id: d.id, changes: { rotation: v } });
                            markUnsaved();
                          }}
                        />
                        <span className="fp-prop-pill-unit">°</span>
                      </div>
                      {isDoor && (
                        <div className="fp-prop-pill">
                          <span className="fp-prop-pill-label">Swing</span>
                          <span className="fp-prop-pill-input">{(d as FloorPlanDoor).swingAngle || 90}°</span>
                        </div>
                      )}
                    </>
                  );
                })()}

                {selectedElement.type === 'furniture' && (() => {
                  const f = entity as FloorPlanFurniture;
                  return (
                    <>
                      <div className="fp-prop-pill">
                        <span className="fp-prop-pill-label">Width</span>
                        <input
                          type="number"
                          step="0.5"
                          className="fp-prop-pill-input"
                          value={f.width}
                          disabled={isLocked}
                          onChange={e => {
                            dispatch({ type: 'UPDATE_FURNITURE', id: f.id, changes: { width: parseFloat(e.target.value) || 1 } });
                            markUnsaved();
                          }}
                        />
                        <span className="fp-prop-pill-unit">{unit === 'feet' ? 'ft' : 'm'}</span>
                      </div>
                      <div className="fp-prop-pill">
                        <span className="fp-prop-pill-label">Depth</span>
                        <input
                          type="number"
                          step="0.5"
                          className="fp-prop-pill-input"
                          value={f.height}
                          disabled={isLocked}
                          onChange={e => {
                            dispatch({ type: 'UPDATE_FURNITURE', id: f.id, changes: { height: parseFloat(e.target.value) || 1 } });
                            markUnsaved();
                          }}
                        />
                        <span className="fp-prop-pill-unit">{unit === 'feet' ? 'ft' : 'm'}</span>
                      </div>
                      <div className="fp-prop-pill">
                        <span className="fp-prop-pill-label">Angle</span>
                        <button
                          type="button"
                          className="fp-stepper-btn"
                          disabled={isLocked}
                          onClick={() => {
                            const cur = f.rotation || 0;
                            const next = (cur - 15 + 360) % 360;
                            dispatchWithHistory({ type: 'UPDATE_FURNITURE', id: f.id, changes: { rotation: next } });
                          }}
                          title="Rotate -15°"
                        >
                          ↺
                        </button>
                        <input
                          type="number"
                          min={0}
                          max={359}
                          step={15}
                          className="fp-prop-pill-input"
                          style={{ width: 46 }}
                          value={Math.round(f.rotation || 0)}
                          disabled={isLocked}
                          onChange={e => {
                            const deg = (parseInt(e.target.value) || 0) % 360;
                            dispatchWithHistory({ type: 'UPDATE_FURNITURE', id: f.id, changes: { rotation: deg < 0 ? deg + 360 : deg } });
                          }}
                        />
                        <button
                          type="button"
                          className="fp-stepper-btn"
                          disabled={isLocked}
                          onClick={() => {
                            const cur = f.rotation || 0;
                            const next = (cur + 15) % 360;
                            dispatchWithHistory({ type: 'UPDATE_FURNITURE', id: f.id, changes: { rotation: next } });
                          }}
                          title="Rotate +15°"
                        >
                          ↻
                        </button>
                      </div>
                      <div className="fp-angle-presets">
                        {[0, 45, 90, 180].map(deg => (
                          <button
                            key={deg}
                            type="button"
                            className={`fp-angle-chip ${Math.round(f.rotation || 0) % 360 === deg ? 'active' : ''}`}
                            onClick={() => {
                              dispatchWithHistory({ type: 'UPDATE_FURNITURE', id: f.id, changes: { rotation: deg } });
                            }}
                          >
                            {deg}°
                          </button>
                        ))}
                      </div>
                    </>
                  );
                })()}

                {selectedElement.type === 'column' && (() => {
                  const c = entity as FloorPlanColumn;
                  return (
                    <>
                      <div className="fp-prop-pill">
                        <span className="fp-prop-pill-label">Width</span>
                        <input
                          type="number"
                          step="0.25"
                          className="fp-prop-pill-input"
                          value={c.width}
                          disabled={isLocked}
                          onChange={e => {
                            dispatch({ type: 'UPDATE_COLUMN', id: c.id, changes: { width: parseFloat(e.target.value) || 0.75 } });
                            markUnsaved();
                          }}
                        />
                        <span className="fp-prop-pill-unit">{unit === 'feet' ? 'ft' : 'm'}</span>
                      </div>
                      <div className="fp-prop-pill">
                        <span className="fp-prop-pill-label">Depth</span>
                        <input
                          type="number"
                          step="0.25"
                          className="fp-prop-pill-input"
                          value={c.depth}
                          disabled={isLocked}
                          onChange={e => {
                            dispatch({ type: 'UPDATE_COLUMN', id: c.id, changes: { depth: parseFloat(e.target.value) || 0.75 } });
                            markUnsaved();
                          }}
                        />
                        <span className="fp-prop-pill-unit">{unit === 'feet' ? 'ft' : 'm'}</span>
                      </div>
                    </>
                  );
                })()}
              </div>

              <div className="fp-prop-dock-actions">
                {selectedElement.type === 'wall' && (
                  <>
                    <button type="button" className="fp-dock-action-btn" onClick={handleSplitSelectedWall} disabled={isLocked} title="Split here: cut this wall into two walls where you tapped it" id="fp-dock-split-here-btn">
                      <Split size={14} />
                    </button>
                    {selectedWallJoints > 0 && (
                      <>
                        <button type="button" className="fp-dock-action-btn" onClick={handleSplitSelectedAtJoints} disabled={isLocked} title={`Split at the ${selectedWallJoints} joint${selectedWallJoints === 1 ? '' : 's'}: one wall per part`} id="fp-dock-split-joints-btn">
                          <Columns size={14} />
                        </button>
                        <button type="button" className="fp-dock-action-btn danger" onClick={handleEraseSelectedPart} disabled={isLocked} title="Erase only the highlighted part, up to the next joint" id="fp-dock-erase-part-full-btn">
                          <Eraser size={14} />
                        </button>
                      </>
                    )}
                  </>
                )}
                <button
                  type="button"
                  className="fp-dock-action-btn"
                  onClick={handleRotateSelected}
                  disabled={isLocked}
                  title="Rotate 90° (R)"
                  id="fp-dock-rotate-btn"
                >
                  <RotateCw size={14} />
                </button>
                <button
                  type="button"
                  className="fp-dock-action-btn"
                  onClick={() => {
                    if (selectedElement.type === 'door') {
                      const d = entity as FloorPlanDoor;
                      dispatchWithHistory({ type: 'UPDATE_DOOR', id: d.id, changes: { rotation: ((d.rotation || 0) + 180) % 360 } });
                    } else if (selectedElement.type === 'furniture') {
                      const f = entity as FloorPlanFurniture;
                      dispatchWithHistory({ type: 'UPDATE_FURNITURE', id: f.id, changes: { rotation: ((f.rotation || 0) + 180) % 360 } });
                    }
                  }}
                  disabled={isLocked}
                  title="Flip Horizontal"
                  id="fp-dock-flip-h-btn"
                >
                  <FlipHorizontal size={14} />
                </button>
                <button
                  type="button"
                  className="fp-dock-action-btn"
                  onClick={() => {
                    if (selectedElement.type === 'door') {
                      const d = entity as FloorPlanDoor;
                      dispatchWithHistory({ type: 'UPDATE_DOOR', id: d.id, changes: { swingAngle: ((d.swingAngle || 90) === 90 ? -90 : 90) } });
                    }
                  }}
                  disabled={isLocked}
                  title="Flip Swing Vertical"
                  id="fp-dock-flip-v-btn"
                >
                  <FlipVertical size={14} />
                </button>
                <button
                  type="button"
                  className="fp-dock-action-btn"
                  onClick={toggleDockMinimized}
                  title="Minimize Dock to Slim Bar (▼)"
                  id="fp-dock-minimize-btn"
                >
                  <ChevronDown size={14} />
                </button>
                <button
                  type="button"
                  className="fp-dock-action-btn"
                  onClick={() => toggleShowBottomDock(false)}
                  title="Hide Floating Dock (Use Right Sidebar Inspector)"
                  id="fp-dock-to-sidebar-btn"
                >
                  <SlidersHorizontal size={14} />
                </button>
                <button
                  type="button"
                  className="fp-dock-action-btn"
                  onClick={handleDuplicateSelected}
                  title="Duplicate Element (Ctrl+D)"
                  id="fp-dock-dup-btn"
                >
                  <Copy size={14} />
                </button>
                <button
                  type="button"
                  className={`fp-dock-action-btn ${isLocked ? 'danger' : ''}`}
                  onClick={handleToggleLockSelected}
                  title={isLocked ? 'Unlock Element' : 'Lock Element'}
                  id="fp-dock-lock-btn"
                >
                  {isLocked ? <Lock size={14} /> : <Unlock size={14} />}
                </button>
                <button
                  type="button"
                  className="fp-dock-action-btn danger"
                  onClick={handleDeleteSelected}
                  disabled={isLocked}
                  title="Delete Element (Del)"
                  id="fp-dock-del-btn"
                >
                  <Trash2 size={14} />
                </button>
                <button
                  type="button"
                  className="fp-dock-action-btn"
                  onClick={() => setSelectedElement(null)}
                  title="Deselect (Esc)"
                  id="fp-dock-close-btn"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          );
        })()}

        {/* ── Planner 5D Direct Room Placement Dock when Room Tool Active ── */}
        {showBottomDock && activeTool === 'room' && !selectedElement && (() => {
          const isDrawingActive = isDrawingWall || isFreehandDrawing || !!resizingWall || isDragging || isPanning;
          return (
            <div
              className={`fp-bottom-property-dock no-print ${isDrawingActive ? 'fp-dock-drawing-active' : ''}`}
              id="fp-room-tool-dock"
              style={dockPos ? { left: `${dockPos.x}px`, top: `${dockPos.y}px`, bottom: 'auto', transform: 'none' } : undefined}
            >
              <div
                className="fp-prop-dock-drag-handle"
                title="Drag to reposition (Double-click to reset)"
                onMouseDown={handleDockDragStart}
                onDoubleClick={resetDockPosition}
              >
                <GripHorizontal size={14} />
              </div>
              <div className="fp-room-area-badge">
                <span style={{ fontWeight: 800 }}>#</span>
                <span>New Room</span>
              </div>
              <div className="fp-prop-pill">
                <span className="fp-prop-pill-label">Type</span>
                <select
                  value={selectedRoomType}
                  className="fp-prop-pill-select"
                  onChange={e => setSelectedRoomType(e.target.value as RoomType)}
                >
                  {ROOM_TYPES.map(rt => <option key={rt} value={rt}>{rt}</option>)}
                </select>
              </div>
              <div className="fp-prop-pill">
                <span className="fp-prop-pill-label">Width, {unit === 'feet' ? 'ft' : 'm'}</span>
                <button
                  type="button"
                  className="fp-stepper-btn"
                  onClick={() => setDraftRoomWidth(w => Math.max(1, +(w - 0.5).toFixed(2)))}
                  title="Decrease Width"
                >
                  &lt;
                </button>
                <input
                  type="number"
                  step={0.5}
                  className="fp-prop-pill-input"
                  value={draftRoomWidth}
                  onChange={e => setDraftRoomWidth(parseFloat(e.target.value) || 1)}
                />
                <button
                  type="button"
                  className="fp-stepper-btn"
                  onClick={() => setDraftRoomWidth(w => +(w + 0.5).toFixed(2))}
                  title="Increase Width"
                >
                  &gt;
                </button>
              </div>
              <div className="fp-prop-pill">
                <span className="fp-prop-pill-label">Height, {unit === 'feet' ? 'ft' : 'm'}</span>
                <button
                  type="button"
                  className="fp-stepper-btn"
                  onClick={() => setDraftRoomHeight(h => Math.max(1, +(h - 0.5).toFixed(2)))}
                  title="Decrease Height"
                >
                  &lt;
                </button>
                <input
                  type="number"
                  step={0.5}
                  className="fp-prop-pill-input"
                  value={draftRoomHeight}
                  onChange={e => setDraftRoomHeight(parseFloat(e.target.value) || 1)}
                />
                <button
                  type="button"
                  className="fp-stepper-btn"
                  onClick={() => setDraftRoomHeight(h => +(h + 0.5).toFixed(2))}
                  title="Increase Height"
                >
                  &gt;
                </button>
              </div>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                style={{ padding: '6px 14px', fontSize: '0.8rem', gap: 5 }}
                onClick={() => handleAddRoomByDimensions(draftRoomWidth, draftRoomHeight, selectedRoomType, draftRoomFloorFinish)}
              >
                <Plus size={14} /> Place Room
              </button>
              <button
                type="button"
                className="fp-room-count-dock-btn"
                onClick={() => setShowRoomScheduleModal(true)}
                title="View All Rooms & Schedule"
              >
                🏠 Rooms: {editorState.rooms.length} (Schedule)
              </button>
              <button
                type="button"
                className="fp-dock-action-btn"
                onClick={() => toggleShowBottomDock(false)}
                title="Hide Floating Dock"
              >
                <X size={14} />
              </button>
            </div>
          );
        })()}

        {/* ── Premium Floating CAD Canvas Controls (Bottom Right) ── */}
        <div className="fp-floating-cad-controls no-print" id="fp-cad-controls">
          <button
            type="button"
            className="fp-cad-btn"
            onClick={() => setZoom(z => Math.max(MIN_ZOOM, +(z * 0.8).toFixed(2)))}
            title="Zoom Out (-)"
            id="fp-cad-zoom-out"
          >
            <ZoomOut size={15} />
          </button>

          {/* Zoom Preset Selector */}
          <div className="fp-cad-zoom-dropdown-wrapper">
            <button
              type="button"
              className="fp-cad-zoom-badge"
              onClick={() => setShowZoomDropdown(prev => !prev)}
              title="Select Zoom Preset"
              id="fp-cad-zoom-badge"
            >
              <span>{Math.round(zoom * 100)}%</span>
              <ChevronDown size={11} />
            </button>
            {showZoomDropdown && (
              <div className="fp-cad-zoom-menu">
                {[0.25, 0.5, 0.75, 1.0, 1.5, 2.0, 4.0, 8.0].map(zVal => (
                  <button
                    key={zVal}
                    type="button"
                    className={`fp-cad-zoom-option ${Math.round(zoom * 100) === Math.round(zVal * 100) ? 'active' : ''}`}
                    onClick={() => {
                      setZoom(zVal);
                      setShowZoomDropdown(false);
                    }}
                  >
                    {Math.round(zVal * 100)}%
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            className="fp-cad-btn"
            onClick={() => setZoom(z => Math.min(MAX_ZOOM, +(z * 1.25).toFixed(2)))}
            title="Zoom In (+)"
            id="fp-cad-zoom-in"
          >
            <ZoomIn size={15} />
          </button>

          {/* FIT Button: Auto-fit entire building to viewport */}
          <button
            type="button"
            className="fp-cad-btn fp-cad-btn-fit"
            onClick={handleFitToScreen}
            title="Fit Building to Screen (Fit)"
            id="fp-cad-fit-btn"
          >
            <Maximize2 size={13} />
            <span>FIT</span>
          </button>

          <button
            type="button"
            className="fp-cad-btn"
            onClick={handleResetView}
            title="Reset the view: 100% zoom, plan centred (0)"
            id="fp-cad-100-btn"
          >
            <span>100%</span>
          </button>

          <button
            type="button"
            className="fp-cad-btn"
            onClick={() => setShowHelpSheet(true)}
            title="Drawing tips and what the measurements mean"
            aria-label="Drawing tips"
            id="fp-cad-help-btn"
          >
            <Info size={15} />
          </button>

          <div className="fp-cad-divider" />

          <button
            type="button"
            className={`fp-cad-btn ${showGrid ? 'active' : ''}`}
            onClick={() => setShowGrid(g => !g)}
            title="Toggle Grid (G)"
            id="fp-cad-grid-toggle"
          >
            <GridIcon size={14} />
          </button>

          <button
            type="button"
            className={`fp-cad-btn ${snapToGridEnabled || snapToEndpointsEnabled ? 'active' : ''}`}
            onClick={() => {
              const next = !(snapToGridEnabled && snapToEndpointsEnabled);
              setSnapToGridEnabled(next);
              setSnapToEndpointsEnabled(next);
              setSnapToWallEnabled(next);
            }}
            title="Toggle Snapping (S)"
            id="fp-cad-snap-toggle"
          >
            <Magnet size={14} />
          </button>
        </div>

        {/* ── Bottom Floating Info Panel ───────────── */}
        <div className="fp-info-panel no-print">
          <div className="fp-info-item">
            <span className="fp-info-label">Floor Area</span>
            <span className="fp-info-value">{totalFloorArea.toFixed(1)} {unit === 'feet' ? 'sq.ft' : 'sq.m'}</span>
          </div>
          <div className="fp-info-item">
            <span className="fp-info-label">Walls</span>
            <span className="fp-info-value">{editorState.walls.length}</span>
          </div>
          <div
            className="fp-info-item"
            style={{ cursor: 'pointer', background: '#f8fafc', borderRadius: 6, padding: '2px 8px' }}
            onClick={() => setShowRoomScheduleModal(true)}
            title="Click to view Room Schedule & Details"
          >
            <span className="fp-info-label" style={{ color: '#1e293b' }}>Rooms 📋</span>
            <span className="fp-info-value" style={{ color: '#1e293b', fontWeight: 800 }}>{editorState.rooms.length}</span>
          </div>
          <div className="fp-info-item">
            <span className="fp-info-label">Columns</span>
            <span className="fp-info-value">{editorState.columns.length}</span>
          </div>
          {currentMousePos && (
            <div className="fp-info-item">
              <span className="fp-info-label">Cursor</span>
              <span className="fp-info-value">
                {formatDim(currentMousePos.x, unit)}, {formatDim(currentMousePos.y, unit)}
              </span>
            </div>
          )}
          <button
            type="button"
            className={`fp-dock-status-toggle ${showBottomDock ? 'active' : ''}`}
            onClick={() => toggleShowBottomDock()}
            title={showBottomDock ? "Floating Property Dock is ON (Click to Hide & use Right Sidebar only)" : "Floating Property Dock is OFF (Click to Show on Canvas)"}
          >
            <span>{showBottomDock ? (isBottomDockMinimized ? '📐 Dock: Mini' : '📐 Dock: ON') : '📐 Dock: OFF'}</span>
          </button>
        </div>
      </div>

      {/* ── CAD Layers Drawer ─────────────────────────── */}
      {isLayersOpen && (
        <div className="fp-layers-drawer no-print" id="fp-layers-panel">
          <div className="fp-layers-header">
            <h3><Layers size={16} color="#1e293b" /> Layers</h3>
            <button
              type="button"
              className="fp-layer-icon-btn"
              onClick={() => setIsLayersOpen(false)}
              title="Close Layers"
            >
              <X size={16} />
            </button>
          </div>
          <div className="fp-layers-list">
            {layers.map(layer => (
              <div key={layer.id} className="fp-layer-row">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      background: layer.color || '#334155',
                      display: 'inline-block',
                    }}
                  />
                  <span style={{ fontWeight: 600 }}>{layer.name}</span>
                </div>
                <div className="fp-layer-actions">
                  <button
                    type="button"
                    className={`fp-layer-icon-btn ${layer.visible ? 'active' : ''}`}
                    onClick={() => toggleLayerVisibility(layer.id)}
                    title={layer.visible ? 'Hide Layer' : 'Show Layer'}
                  >
                    {layer.visible ? <Eye size={14} /> : <Eye size={14} style={{ opacity: 0.3 }} />}
                  </button>
                  <button
                    type="button"
                    className={`fp-layer-icon-btn ${layer.locked ? 'locked' : ''}`}
                    onClick={() => toggleLayerLock(layer.id)}
                    title={layer.locked ? 'Unlock Layer' : 'Lock Layer'}
                  >
                    {layer.locked ? <Lock size={14} /> : <Unlock size={14} />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>

        {/* ── Right Symbol / Structure Panel (FloorPlanCreator standard) ── */}
        <aside className="fp-desktop-right-panel no-print" aria-label="Symbol & Structure Library">
          {/* Numerical Precision Inspector */}
          <div className="fp-numerical-inspector">
            <h4>Exact position</h4>
            {selectedElement ? (
              <div>
                {selectedElement.type === 'wall' && (() => {
                  const w = editorState.walls.find(x => x.id === selectedElement.id);
                  if (!w) return null;
                  const len = getWallLength(w);
                  const ang = getWallAngleDeg(w);
                  return (
                    <div className="fp-inspector-content">
                      <div className="fp-inspector-row">
                        <label>Wall Type</label>
                        <span style={{ fontWeight: 600, color: '#1e293b' }}>{w.wallType}</span>
                      </div>
                      <div className="fp-inspector-row">
                        <label>Length</label>
                        <button
                          type="button"
                          className="fp-inspector-input"
                          style={{ textAlign: 'left', cursor: 'pointer', fontWeight: 700 }}
                          onClick={() => openWallEdit(w.id)}
                          title="Type an exact length (Enter)"
                          id="fp-inspector-length"
                        >
                          {formatDimension(len, unit)}
                        </button>
                      </div>
                      <div className="fp-inspector-row">
                        <label>Thickness</label>
                        <select
                          className="fp-inspector-input"
                          value={w.thickness}
                          onChange={e => {
                            const th = parseFloat(e.target.value);
                            dispatchWithHistory({ type: 'UPDATE_WALL', id: w.id, changes: { thickness: th } });
                            markUnsaved();
                          }}
                        >
                          <option value={unit === 'feet' ? 0.75 : 0.23}>9" Ext ({formatLength(unit === 'feet' ? 0.75 : 0.23, unit)})</option>
                          <option value={unit === 'feet' ? 0.375 : 0.115}>4.5" Int ({formatLength(unit === 'feet' ? 0.375 : 0.115, unit)})</option>
                          <option value={unit === 'feet' ? 0.25 : 0.075}>3" Part ({formatLength(unit === 'feet' ? 0.25 : 0.075, unit)})</option>
                        </select>
                      </div>
                      <div className="fp-inspector-row">
                        <label>Angle</label>
                        <span style={{ fontSize: '0.8rem', color: '#475569' }}>{Math.round(ang)}°</span>
                      </div>
                    </div>
                  );
                })()}

                {selectedElement.type === 'room' && (() => {
                  const r = editorState.rooms.find(x => x.id === selectedElement.id);
                  if (!r) return null;
                  const area = computeRoomArea(r, unit);
                  const perim = computeRoomPerimeter(r, unit);
                  return (
                    <div className="fp-inspector-content">
                      <div className="fp-inspector-row">
                        <label>Room Name</label>
                        <input
                          type="text"
                          className="fp-inspector-input"
                          value={r.label}
                          onChange={e => {
                            dispatchWithHistory({ type: 'UPDATE_ROOM', id: r.id, changes: { label: e.target.value } });
                            markUnsaved();
                          }}
                        />
                      </div>
                      <div className="fp-inspector-row">
                        <label>Width ({unit === 'feet' ? 'ft' : 'm'})</label>
                        <input
                          type="number"
                          step="0.5"
                          className="fp-inspector-input"
                          value={r.width}
                          onChange={e => {
                            const nw = parseFloat(e.target.value) || 1;
                            dispatchWithHistory({ type: 'UPDATE_ROOM', id: r.id, changes: { width: nw } });
                            markUnsaved();
                          }}
                        />
                      </div>
                      <div className="fp-inspector-row">
                        <label>Length/Height ({unit === 'feet' ? 'ft' : 'm'})</label>
                        <input
                          type="number"
                          step="0.5"
                          className="fp-inspector-input"
                          value={r.height}
                          onChange={e => {
                            const nh = parseFloat(e.target.value) || 1;
                            dispatchWithHistory({ type: 'UPDATE_ROOM', id: r.id, changes: { height: nh } });
                            markUnsaved();
                          }}
                        />
                      </div>
                      <div className="fp-inspector-row">
                        <label>Area (Shoelace)</label>
                        <span style={{ color: '#15803d', fontWeight: 700, fontSize: '0.85rem' }}>
                          {area} {unit === 'feet' ? 'sq.ft' : 'sq.m'}
                        </span>
                      </div>
                      <div className="fp-inspector-row">
                        <label>Perimeter</label>
                        <span style={{ color: '#1e293b', fontWeight: 600, fontSize: '0.8rem' }}>
                          {perim} {unit}
                        </span>
                      </div>
                      <div className="fp-inspector-row">
                        <label>Floor Finish</label>
                        <select
                          className="fp-inspector-input"
                          value={r.floorFinish || 'Vitrified Tiles'}
                          onChange={e => {
                            dispatchWithHistory({ type: 'UPDATE_ROOM', id: r.id, changes: { floorFinish: e.target.value } });
                            markUnsaved();
                          }}
                        >
                          {['Vitrified Tiles', 'Marble', 'Granite', 'Wood Parquet', 'Ceramic Tiles', 'Concrete', 'Color Tint'].map(f => (
                            <option key={f} value={f}>{f}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  );
                })()}

                {selectedElement.type === 'door' && (() => {
                  const d = editorState.doors.find(x => x.id === selectedElement.id);
                  if (!d) return null;
                  return (
                    <div className="fp-inspector-content">
                      <div className="fp-inspector-row">
                        <label>Door Type</label>
                        <select
                          className="fp-inspector-input"
                          value={d.doorType}
                          onChange={e => {
                            dispatchWithHistory({ type: 'UPDATE_DOOR', id: d.id, changes: { doorType: e.target.value as DoorType } });
                            markUnsaved();
                          }}
                        >
                          {DOOR_TYPES.map(dt => (<option key={dt} value={dt}>{dt}</option>))}
                        </select>
                      </div>
                      <div className="fp-inspector-row">
                        <label>Width ({unit === 'feet' ? 'ft' : 'm'})</label>
                        <input
                          type="number"
                          step="0.25"
                          className="fp-inspector-input"
                          value={d.width}
                          onChange={e => {
                            const nw = parseFloat(e.target.value) || 1;
                            dispatchWithHistory({ type: 'UPDATE_DOOR', id: d.id, changes: { width: nw } });
                            markUnsaved();
                          }}
                        />
                      </div>
                      <div className="fp-inspector-row">
                        <label>Swing Angle</label>
                        <select
                          className="fp-inspector-input"
                          value={d.swingAngle || 90}
                          onChange={e => {
                            dispatchWithHistory({ type: 'UPDATE_DOOR', id: d.id, changes: { swingAngle: parseInt(e.target.value) } });
                            markUnsaved();
                          }}
                        >
                          <option value={90}>90°</option>
                          <option value={45}>45°</option>
                          <option value={180}>180°</option>
                        </select>
                      </div>
                    </div>
                  );
                })()}

                {selectedElement.type === 'window' && (() => {
                  const w = editorState.windows.find(x => x.id === selectedElement.id);
                  if (!w) return null;
                  return (
                    <div className="fp-inspector-content">
                      <div className="fp-inspector-row">
                        <label>Window Type</label>
                        <select
                          className="fp-inspector-input"
                          value={w.windowType}
                          onChange={e => {
                            dispatchWithHistory({ type: 'UPDATE_WINDOW', id: w.id, changes: { windowType: e.target.value as WindowType } });
                            markUnsaved();
                          }}
                        >
                          {WINDOW_TYPES.map(wt => (<option key={wt} value={wt}>{wt}</option>))}
                        </select>
                      </div>
                      <div className="fp-inspector-row">
                        <label>Width ({unit === 'feet' ? 'ft' : 'm'})</label>
                        <input
                          type="number"
                          step="0.25"
                          className="fp-inspector-input"
                          value={w.width}
                          onChange={e => {
                            const nw = parseFloat(e.target.value) || 1;
                            dispatchWithHistory({ type: 'UPDATE_WINDOW', id: w.id, changes: { width: nw } });
                            markUnsaved();
                          }}
                        />
                      </div>
                      <div className="fp-inspector-row">
                        <label>Height ({unit === 'feet' ? 'ft' : 'm'})</label>
                        <input
                          type="number"
                          step="0.25"
                          className="fp-inspector-input"
                          value={w.height || (unit === 'feet' ? 4 : 1.2)}
                          onChange={e => {
                            const nh = parseFloat(e.target.value) || 1;
                            dispatchWithHistory({ type: 'UPDATE_WINDOW', id: w.id, changes: { height: nh } });
                            markUnsaved();
                          }}
                        />
                      </div>
                    </div>
                  );
                })()}

                {selectedElement.type === 'furniture' && (() => {
                  const f = editorState.furniture.find(x => x.id === selectedElement.id);
                  if (!f) return null;
                  return (
                    <div className="fp-inspector-content">
                      <div className="fp-inspector-row">
                        <label>Item Name</label>
                        <input
                          type="text"
                          className="fp-inspector-input"
                          value={f.label || f.itemType}
                          onChange={e => {
                            dispatchWithHistory({ type: 'UPDATE_FURNITURE', id: f.id, changes: { label: e.target.value } });
                            markUnsaved();
                          }}
                        />
                      </div>
                      <div className="fp-inspector-row">
                        <label>Width ({unit === 'feet' ? 'ft' : 'm'})</label>
                        <input
                          type="number"
                          step="0.25"
                          className="fp-inspector-input"
                          value={f.width}
                          onChange={e => {
                            const nw = parseFloat(e.target.value) || 1;
                            dispatchWithHistory({ type: 'UPDATE_FURNITURE', id: f.id, changes: { width: nw } });
                            markUnsaved();
                          }}
                        />
                      </div>
                      <div className="fp-inspector-row">
                        <label>Length/Depth</label>
                        <input
                          type="number"
                          step="0.25"
                          className="fp-inspector-input"
                          value={f.height}
                          onChange={e => {
                            const nh = parseFloat(e.target.value) || 1;
                            dispatchWithHistory({ type: 'UPDATE_FURNITURE', id: f.id, changes: { height: nh } });
                            markUnsaved();
                          }}
                        />
                      </div>
                      <div className="fp-inspector-row">
                        <label>Rotation</label>
                        <select
                          className="fp-inspector-input"
                          value={f.rotation || 0}
                          onChange={e => {
                            dispatchWithHistory({ type: 'UPDATE_FURNITURE', id: f.id, changes: { rotation: parseInt(e.target.value) } });
                            markUnsaved();
                          }}
                        >
                          <option value={0}>0°</option>
                          <option value={45}>45°</option>
                          <option value={90}>90°</option>
                          <option value={135}>135°</option>
                          <option value={180}>180°</option>
                          <option value={270}>270°</option>
                        </select>
                      </div>
                    </div>
                  );
                })()}
              </div>
            ) : (
              <p style={{ fontSize: '0.75rem', color: '#475569', margin: 0 }}>
                Select any wall, room, door, window, or symbol to view and edit its exact real-world dimensions.
              </p>
            )}
          </div>

          {/* Categorized Library Accordion */}
          <div className="fp-category-accordion">
            {/* STRUCTURE */}
            <div className="fp-accordion-section">
              <button
                type="button"
                className={`fp-accordion-header ${activeDesktopCategory === 'STRUCTURE' ? 'active' : ''}`}
                onClick={() => setActiveDesktopCategory(c => c === 'STRUCTURE' ? null : 'STRUCTURE')}
              >
                <span>STRUCTURE</span>
                {activeDesktopCategory === 'STRUCTURE' ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
              {activeDesktopCategory === 'STRUCTURE' && (
                <div className="fp-accordion-body">
                  <button type="button" className="fp-symbol-item-btn" onClick={handleAddSquareRoom}>
                    <Square size={16} color="#1e293b" />
                    <span>Square Room</span>
                  </button>
                  <button type="button" className="fp-symbol-item-btn" onClick={handleAddLShapedRoom}>
                    <Shapes size={16} color="#1e293b" />
                    <span>L-Shaped Room</span>
                  </button>
                  <button type="button" className="fp-symbol-item-btn" onClick={handleAddUShapedRoom}>
                    <Shapes size={16} color="#1e293b" />
                    <span>U-Shaped Room</span>
                  </button>
                  <button type="button" className="fp-symbol-item-btn" onClick={handleAddTShapedRoom}>
                    <Shapes size={16} color="#1e293b" />
                    <span>T-Shaped Room</span>
                  </button>
                  <button type="button" className="fp-symbol-item-btn" onClick={() => { setActiveTool('room'); onNotify('Click canvas to place custom room', 'info'); }}>
                    <Shapes size={16} color="#1e293b" />
                    <span>Custom Room</span>
                  </button>
                  <button type="button" className="fp-symbol-item-btn" onClick={() => handleAddWallPreset('exterior')}>
                    <Pencil size={16} color="#334155" />
                    <span>9" Exterior Wall</span>
                  </button>
                  <button type="button" className="fp-symbol-item-btn" onClick={() => handleAddWallPreset('interior')}>
                    <Pencil size={16} color="#334155" />
                    <span>4.5" Interior Wall</span>
                  </button>
                  <button type="button" className="fp-symbol-item-btn" onClick={() => handleAddWallPreset('partition')}>
                    <Pencil size={16} color="#334155" />
                    <span>3" Partition Wall</span>
                  </button>
                  <button type="button" className="fp-symbol-item-btn" onClick={() => handleAddStairPreset('Straight')}>
                    <Columns size={16} color="#6d28d9" />
                    <span>Staircase Flight</span>
                  </button>
                  <button type="button" className="fp-symbol-item-btn" onClick={handleAddLanding}>
                    <Square size={16} color="#334155" />
                    <span>Landing Platform</span>
                  </button>
                  <button type="button" className="fp-symbol-item-btn" onClick={handleAddVoid}>
                    <X size={16} color="#dc2626" />
                    <span>Void / Cutout</span>
                  </button>
                  <button type="button" className="fp-symbol-item-btn" onClick={() => setShowBgImageModal(true)}>
                    <ImageIcon size={16} color="#15803d" />
                    <span>Image Background</span>
                  </button>
                </div>
              )}
            </div>

            {/* OPENINGS */}
            <div className="fp-accordion-section">
              <button
                type="button"
                className={`fp-accordion-header ${activeDesktopCategory === 'OPENINGS' ? 'active' : ''}`}
                onClick={() => setActiveDesktopCategory(c => c === 'OPENINGS' ? null : 'OPENINGS')}
              >
                <span>OPENINGS</span>
                {activeDesktopCategory === 'OPENINGS' ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
              {activeDesktopCategory === 'OPENINGS' && (
                <div className="fp-accordion-body">
                  <button type="button" className="fp-symbol-item-btn" onClick={() => handleAddDoorPreset('Single')}>
                    <DoorOpen size={16} color="#1e293b" />
                    <span>Single Door</span>
                  </button>
                  <button type="button" className="fp-symbol-item-btn" onClick={() => handleAddDoorPreset('Double')}>
                    <DoorOpen size={16} color="#1e293b" />
                    <span>Double Door</span>
                  </button>
                  <button type="button" className="fp-symbol-item-btn" onClick={() => handleAddDoorPreset('Sliding')}>
                    <DoorOpen size={16} color="#1e293b" />
                    <span>Sliding Door</span>
                  </button>
                  <button type="button" className="fp-symbol-item-btn" onClick={() => handleAddWindowPreset('Single Window')}>
                    <AppWindow size={16} color="#1e293b" />
                    <span>Single Window</span>
                  </button>
                  <button type="button" className="fp-symbol-item-btn" onClick={() => handleAddDoorPreset('Opening')}>
                    <Split size={16} color="#334155" />
                    <span>Wall Opening</span>
                  </button>
                </div>
              )}
            </div>

            {/* FURNITURE */}
            <div className="fp-accordion-section">
              <button
                type="button"
                className={`fp-accordion-header ${activeDesktopCategory === 'FURNITURE' ? 'active' : ''}`}
                onClick={() => setActiveDesktopCategory(c => c === 'FURNITURE' ? null : 'FURNITURE')}
              >
                <span>FURNITURE</span>
                {activeDesktopCategory === 'FURNITURE' ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
              {activeDesktopCategory === 'FURNITURE' && (
                <div className="fp-accordion-body">
                  <button type="button" className="fp-symbol-item-btn" onClick={() => handleAddFurnitureItem({ category: 'bedroom', itemType: 'Bed (Queen)', label: 'Bed', width: 5.5, height: 6.5 })}>
                    <Bed size={16} color="#6d28d9" />
                    <span>Queen Bed</span>
                  </button>
                  <button type="button" className="fp-symbol-item-btn" onClick={() => handleAddFurnitureItem({ category: 'living', itemType: 'Sofa 3-Seater', label: 'Sofa', width: 7.0, height: 3.0 })}>
                    <Sofa size={16} color="#6d28d9" />
                    <span>3-Seater Sofa</span>
                  </button>
                  <button type="button" className="fp-symbol-item-btn" onClick={() => handleAddFurnitureItem({ category: 'dining', itemType: 'Dining Table 6-Seater', label: 'Dining Table', width: 5.0, height: 3.5 })}>
                    <Square size={16} color="#6d28d9" />
                    <span>Dining Table</span>
                  </button>
                  <button type="button" className="fp-symbol-item-btn" onClick={() => handleAddFurnitureItem({ category: 'living', itemType: 'Armchair', label: 'Chair', width: 2.8, height: 2.8 })}>
                    <Armchair size={16} color="#6d28d9" />
                    <span>Lounge Chair</span>
                  </button>
                  <button type="button" className="fp-symbol-item-btn" onClick={() => handleAddFurnitureItem({ category: 'bedroom', itemType: 'Wardrobe 3-Door', label: 'Wardrobe', width: 6.0, height: 2.0 })}>
                    <Square size={16} color="#6d28d9" />
                    <span>Wardrobe</span>
                  </button>
                  <button type="button" className="fp-symbol-item-btn" onClick={() => handleAddFurnitureItem({ category: 'kitchen', itemType: 'Kitchen Counter Sink', label: 'Kitchen Sink', width: 4.0, height: 2.0 })}>
                    <Utensils size={16} color="#15803d" />
                    <span>Kitchen Counter Sink</span>
                  </button>
                  <button type="button" className="fp-symbol-item-btn" onClick={() => handleAddFurnitureItem({ category: 'bathroom', itemType: 'Bathroom Commode', label: 'Commode', width: 2.2, height: 2.5 })}>
                    <Bath size={16} color="#1e293b" />
                    <span>Bathroom Commode</span>
                  </button>
                  <button type="button" className="fp-symbol-item-btn" onClick={() => handleAddFurnitureItem({ category: 'kitchen', itemType: 'Refrigerator', label: 'Fridge', width: 2.8, height: 2.8 })}>
                    <Box size={16} color="#334155" />
                    <span>Refrigerator</span>
                  </button>
                </div>
              )}
            </div>

            {/* ELECTRICAL */}
            <div className="fp-accordion-section">
              <button
                type="button"
                className={`fp-accordion-header ${activeDesktopCategory === 'ELECTRICAL' ? 'active' : ''}`}
                onClick={() => setActiveDesktopCategory(c => c === 'ELECTRICAL' ? null : 'ELECTRICAL')}
              >
                <span>ELECTRICAL</span>
                {activeDesktopCategory === 'ELECTRICAL' ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
              {activeDesktopCategory === 'ELECTRICAL' && (
                <div className="fp-accordion-body">
                  <button type="button" className="fp-symbol-item-btn" onClick={() => handleAddElectricalItem('Ceiling Light')}>
                    <Zap size={16} color="#334155" />
                    <span>Ceiling Light</span>
                  </button>
                  <button type="button" className="fp-symbol-item-btn" onClick={() => handleAddElectricalItem('Wall Switch')}>
                    <Zap size={16} color="#334155" />
                    <span>Wall Switch</span>
                  </button>
                  <button type="button" className="fp-symbol-item-btn" onClick={() => handleAddElectricalItem('Power Socket')}>
                    <Zap size={16} color="#334155" />
                    <span>Power Socket</span>
                  </button>
                  <button type="button" className="fp-symbol-item-btn" onClick={() => handleAddElectricalItem('Ceiling Fan')}>
                    <RotateCw size={16} color="#334155" />
                    <span>Ceiling Fan</span>
                  </button>
                </div>
              )}
            </div>

            {/* ANNOTATION */}
            <div className="fp-accordion-section">
              <button
                type="button"
                className={`fp-accordion-header ${activeDesktopCategory === 'ANNOTATION' ? 'active' : ''}`}
                onClick={() => setActiveDesktopCategory(c => c === 'ANNOTATION' ? null : 'ANNOTATION')}
              >
                <span>ANNOTATION</span>
                {activeDesktopCategory === 'ANNOTATION' ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
              {activeDesktopCategory === 'ANNOTATION' && (
                <div className="fp-accordion-body">
                  <button type="button" className="fp-symbol-item-btn" onClick={() => setShowDimensions(d => !d)}>
                    <Ruler size={16} color="#1e293b" />
                    <span>Dimension Lines ({showDimensions ? 'ON' : 'OFF'})</span>
                  </button>
                  <button type="button" className="fp-symbol-item-btn" onClick={() => handleAddAnnotationPreset('note')}>
                    <Type size={16} color="#1e293b" />
                    <span>Note</span>
                  </button>
                  <button type="button" className="fp-symbol-item-btn" onClick={() => handleAddAnnotationPreset('label')}>
                    <ChevronRight size={16} color="#1e293b" />
                    <span>Direction Arrow</span>
                  </button>
                  <button type="button" className="fp-symbol-item-btn" onClick={() => handleAddAnnotationPreset('label')}>
                    <Type size={16} color="#1e293b" />
                    <span>Room Label Tag</span>
                  </button>
                </div>
              )}
            </div>

            {/* TOOLS */}
            <div className="fp-accordion-section">
              <button
                type="button"
                className={`fp-accordion-header ${activeDesktopCategory === 'TOOLS' ? 'active' : ''}`}
                onClick={() => setActiveDesktopCategory(c => c === 'TOOLS' ? null : 'TOOLS')}
              >
                <span>TOOLS</span>
                {activeDesktopCategory === 'TOOLS' ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
              {activeDesktopCategory === 'TOOLS' && (
                <div className="fp-accordion-body">
                  <button
                    type="button"
                    className="fp-symbol-item-btn"
                    onClick={() => {
                      setActiveTool('measure');
                      setMeasureStart(null);
                      setMeasureCurrent(null);
                      setIsMeasuring(false);
                      onNotify('Click 2 points on canvas to measure distance & angle', 'info');
                    }}
                  >
                    <Ruler size={16} color="#15803d" />
                    <span>Tape Measure</span>
                  </button>
                  <button type="button" className="fp-symbol-item-btn" onClick={() => setShowRoomScheduleModal(true)}>
                    <Calculator size={16} color="#1e293b" />
                    <span>Area Schedule</span>
                  </button>
                  <button type="button" className="fp-symbol-item-btn" onClick={() => setShowRoomScheduleModal(true)}>
                    <ScanLine size={16} color="#1e293b" />
                    <span>Perimeter Breakdown</span>
                  </button>
                  <button type="button" className="fp-symbol-item-btn" onClick={() => setShowBgImageModal(true)}>
                    <ImageIcon size={16} color="#334155" />
                    <span>Background Image</span>
                  </button>
                  <button type="button" className="fp-symbol-item-btn" onClick={() => setShowSettingsModal(true)}>
                    <Settings size={16} color="#475569" />
                    <span>Scale & Snapping</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>

      {/* ── Properties Panel ────────────────────────────
          Not on phones: there the compact dock above the toolbar is the only selection panel,
          so tapping an element never covers the drawing with two panels. */}
      {selectedElement && !isMobile && (
        <div className="fp-properties-panel no-print">
          {/* Quick Action CAD Toolbar */}
          <div className="fp-props-actions-toolbar">
            <button
              type="button"
              className="fp-props-action-btn"
              onClick={handleRotateSelected}
              disabled={isSelectedLocked}
              title="Rotate 90° (R)"
              id="fp-action-rotate"
            >
              <RotateCw size={14} />
              <span>Rotate</span>
            </button>
            <button
              type="button"
              className="fp-props-action-btn"
              onClick={handleDuplicateSelected}
              title="Duplicate (Ctrl+D)"
              id="fp-action-duplicate"
            >
              <Copy size={14} />
              <span>Duplicate</span>
            </button>
            <button
              type="button"
              className="fp-props-action-btn"
              onClick={handleCopySelected}
              title="Copy (Ctrl+C)"
              id="fp-action-copy"
            >
              <ClipboardCopy size={14} />
              <span>Copy</span>
            </button>
            {clipboardElement && (
              <button
                type="button"
                className="fp-props-action-btn"
                onClick={handlePaste}
                title="Paste (Ctrl+V)"
                id="fp-action-paste"
              >
                <ClipboardPaste size={14} />
                <span>Paste</span>
              </button>
            )}
            <button
              type="button"
              className={`fp-props-action-btn ${isSelectedLocked ? 'locked' : ''}`}
              onClick={handleToggleLockSelected}
              title={isSelectedLocked ? 'Unlock Element (Ctrl+L)' : 'Lock Element (Ctrl+L)'}
              id="fp-action-lock"
            >
              {isSelectedLocked ? <Lock size={14} /> : <Unlock size={14} />}
              <span>{isSelectedLocked ? 'Locked' : 'Lock'}</span>
            </button>
            <button
              type="button"
              className="fp-props-action-btn danger"
              onClick={handleDeleteSelected}
              disabled={isSelectedLocked}
              title="Delete (Del)"
              id="fp-action-delete"
            >
              <Trash2 size={14} />
              <span>Delete</span>
            </button>
          </div>
          {selectedElement.type === 'wall' && (() => {
            const wall = editorState.walls.find(w => w.id === selectedElement.id);
            if (!wall) return null;
            return (
              <div className="fp-props-inner">
                <h4>Wall Properties</h4>
                <div className="fp-prop-row">
                  <label>Length</label>
                  <span>{formatDim(wallLength(wall), unit)}</span>
                </div>
                <div className="fp-prop-row">
                  <label>Type</label>
                  <select
                    value={wall.wallType}
                    onChange={e => {
                      dispatch({ type: 'UPDATE_WALL', id: wall.id, changes: { wallType: e.target.value as any } });
                      markUnsaved();
                    }}
                  >
                    <option value="exterior">Exterior (Load Bearing)</option>
                    <option value="interior">Interior</option>
                    <option value="partition">Partition</option>
                  </select>
                </div>
                <div className="fp-prop-row">
                  <label>Thickness</label>
                  <input
                    type="number"
                    min={0.25}
                    max={3}
                    step={0.25}
                    value={wall.thickness}
                    onChange={e => {
                      dispatch({ type: 'UPDATE_WALL', id: wall.id, changes: { thickness: parseFloat(e.target.value) } });
                      markUnsaved();
                    }}
                  />
                </div>
                <button type="button" className="btn btn-danger btn-sm" onClick={handleDeleteSelected}>
                  <Trash2 size={14} /> Delete Wall
                </button>
              </div>
            );
          })()}

          {selectedElement.type === 'room' && (() => {
            const room = editorState.rooms.find(r => r.id === selectedElement.id);
            if (!room) return null;
            return (
              <div className="fp-props-inner">
                <h4>Room Properties</h4>
                <div className="fp-prop-row">
                  <label>Label</label>
                  <input
                    type="text"
                    value={room.label}
                    onChange={e => {
                      dispatch({ type: 'UPDATE_ROOM', id: room.id, changes: { label: e.target.value } });
                      markUnsaved();
                    }}
                  />
                </div>
                <div className="fp-prop-row">
                  <label>Type</label>
                  <select
                    value={room.roomType}
                    onChange={e => {
                      const rt = e.target.value as RoomType;
                      dispatch({ type: 'UPDATE_ROOM', id: room.id, changes: { roomType: rt, color: ROOM_COLORS[rt] } });
                      markUnsaved();
                    }}
                  >
                    {ROOM_TYPES.map(rt => <option key={rt} value={rt}>{rt}</option>)}
                  </select>
                </div>
                <div className="fp-prop-row">
                  <label>Size</label>
                  {/* Typed in the room sheet: a room made by walls changes size by moving its
                      walls, which a plain number box here could not do. */}
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => openRoomSheet(room.id)} id="fp-prop-room-size">
                    {(() => { const b = roomBox(room); return b ? `${formatDimension(b.maxX - b.minX, unit)} × ${formatDimension(b.maxY - b.minY, unit)}` : formatAreaShort(roomArea(room), unit); })()} · Change
                  </button>
                </div>
                <div className="fp-prop-row">
                  <label>Area</label>
                  <span>{computeRoomArea(room, unit)}</span>
                </div>
                <button type="button" className="btn btn-danger btn-sm" onClick={handleDeleteSelected}>
                  <Trash2 size={14} /> Delete Room
                </button>
              </div>
            );
          })()}

          {(selectedElement.type === 'door' || selectedElement.type === 'window') && (() => {
            const el =
              selectedElement.type === 'door'
                ? editorState.doors.find(d => d.id === selectedElement.id)
                : editorState.windows.find(w => w.id === selectedElement.id);
            if (!el) return null;
            const isDoor = selectedElement.type === 'door';
            return (
              <div className="fp-props-inner">
                <h4>{isDoor ? 'Door' : 'Window'} Properties</h4>
                <div className="fp-prop-row">
                  <label>Type</label>
                  <span>{isDoor ? (el as FloorPlanDoor).doorType : (el as FloorPlanWindow).windowType}</span>
                </div>
                <div className="fp-prop-row">
                  <label>Width ({unit === 'feet' ? 'ft' : 'm'})</label>
                  <input
                    type="number"
                    min={0.5}
                    step={0.25}
                    value={el.width}
                    onChange={e => {
                      const v = parseFloat(e.target.value) || 1;
                      if (isDoor) dispatch({ type: 'UPDATE_DOOR', id: el.id, changes: { width: v } });
                      else dispatch({ type: 'UPDATE_WINDOW', id: el.id, changes: { width: v } });
                      markUnsaved();
                    }}
                  />
                </div>
                <div className="fp-prop-row">
                  <label>Rotation</label>
                  <select
                    value={el.rotation}
                    onChange={e => {
                      const v = parseInt(e.target.value);
                      if (isDoor) dispatch({ type: 'UPDATE_DOOR', id: el.id, changes: { rotation: v } });
                      else dispatch({ type: 'UPDATE_WINDOW', id: el.id, changes: { rotation: v } });
                      markUnsaved();
                    }}
                  >
                    <option value={0}>0°</option>
                    <option value={90}>90°</option>
                    <option value={180}>180°</option>
                    <option value={270}>270°</option>
                  </select>
                </div>
                <button type="button" className="btn btn-danger btn-sm" onClick={handleDeleteSelected}>
                  <Trash2 size={14} /> Delete
                </button>
              </div>
            );
          })()}

          {selectedElement.type === 'furniture' && (() => {
            const f = editorState.furniture.find(item => item.id === selectedElement.id);
            if (!f) return null;
            return (
              <div className="fp-props-inner">
                <h4>Furniture Properties</h4>
                <div className="fp-prop-row">
                  <label>Item</label>
                  <span>{f.itemType}</span>
                </div>
                <div className="fp-prop-row">
                  <label>Rotation</label>
                  <select
                    value={f.rotation || 0}
                    onChange={e => {
                      dispatch({ type: 'UPDATE_FURNITURE', id: f.id, changes: { rotation: parseInt(e.target.value) } });
                      markUnsaved();
                    }}
                  >
                    <option value={0}>0°</option>
                    <option value={45}>45°</option>
                    <option value={90}>90°</option>
                    <option value={135}>135°</option>
                    <option value={180}>180°</option>
                    <option value={270}>270°</option>
                  </select>
                </div>
                <button type="button" className="btn btn-danger btn-sm" onClick={handleDeleteSelected}>
                  <Trash2 size={14} /> Delete
                </button>
              </div>
            );
          })()}

          {selectedElement.type === 'column' && (() => {
            const c = editorState.columns.find(col => col.id === selectedElement.id);
            if (!c) return null;
            return (
              <div className="fp-props-inner">
                <h4>Column Properties</h4>
                <div className="fp-prop-row">
                  <label>Shape</label>
                  <span>{c.shape}</span>
                </div>
                <button type="button" className="btn btn-danger btn-sm" onClick={handleDeleteSelected}>
                  <Trash2 size={14} /> Delete Column
                </button>
              </div>
            );
          })()}

          {selectedElement.type === 'stairs' && (() => {
            const s = editorState.stairs.find(stair => stair.id === selectedElement.id);
            if (!s) return null;
            return (
              <div className="fp-props-inner">
                <h4>Staircase Properties</h4>
                <div className="fp-prop-row">
                  <label>Type</label>
                  <span>{s.type}</span>
                </div>
                <div className="fp-prop-row">
                  <label>Rotation</label>
                  <select
                    value={s.rotation || 0}
                    onChange={e => {
                      dispatch({ type: 'UPDATE_STAIRS', id: s.id, changes: { rotation: parseInt(e.target.value) } });
                      markUnsaved();
                    }}
                  >
                    <option value={0}>0°</option>
                    <option value={90}>90°</option>
                    <option value={180}>180°</option>
                    <option value={270}>270°</option>
                  </select>
                </div>
                <button type="button" className="btn btn-danger btn-sm" onClick={handleDeleteSelected}>
                  <Trash2 size={14} /> Delete Staircase
                </button>
              </div>
            );
          })()}
        </div>
      )}

      {/* ── Mobile Contextual Subtoolbar (< 768px) ────── */}
      {(activeTool === 'wall' || activeTool === 'ai_draw') && (
        <div className="fp-mobile-subtoolbar no-print">
          {/* The two ways to draw a wall, side by side, so it is always clear which is on. */}
          <div className="fp-wall-mode" role="group" aria-label="How to draw walls">
            <button
              type="button"
              className={`fp-wall-mode-btn ${activeTool === 'wall' ? 'active' : ''}`}
              aria-pressed={activeTool === 'wall'}
              title="Straight: drag out one exact wall, or tap its two ends"
              id="fp-wall-mode-straight"
              onClick={() => setActiveTool('wall')}
            >
              <Minus size={14} /> Straight
            </button>
            <button
              type="button"
              className={`fp-wall-mode-btn ${activeTool === 'ai_draw' ? 'active' : ''}`}
              aria-pressed={activeTool === 'ai_draw'}
              title="Sketch: draw a rough outline and it becomes straight, joined walls"
              id="fp-wall-mode-sketch"
              onClick={() => setActiveTool('ai_draw')}
            >
              <PenTool size={14} /> Sketch
            </button>
          </div>
          {(() => {
            const snapOn = snapToGridEnabled || snapToEndpointsEnabled || snapToWallEnabled;
            return (
              <button
                type="button"
                className={`fp-mobile-sub-btn ${snapOn ? 'active' : ''}`}
                aria-pressed={snapOn}
                title="Snap to grid, wall ends and walls. Off = draw freely at any angle."
                id="fp-mobile-snap-toggle"
                onClick={() => {
                  setSnapToGridEnabled(!snapOn);
                  setSnapToEndpointsEnabled(!snapOn);
                  setSnapToWallEnabled(!snapOn);
                }}
              >
                <Magnet size={14} /> Snap {snapOn ? 'On' : 'Off'}
              </button>
            );
          })()}
          {activeTool === 'wall' ? (
            <button
              type="button"
              className={`fp-mobile-sub-btn ${isOrthoActive ? 'active' : ''}`}
              aria-pressed={isOrthoActive}
              title="Pull walls to 0°, 45° and 90° when they are close to it"
              id="fp-mobile-angle-toggle"
              onClick={() => setIsOrthoActive(v => !v)}
            >
              Angle {isOrthoActive ? 'On' : 'Off'}
            </button>
          ) : (
            <button
              type="button"
              className={`fp-mobile-sub-btn ${sketchAngles !== 'free' ? 'active' : ''}`}
              title="Which angles a sketched wall is straightened to. Tap to change."
              id="fp-sketch-angles"
              onClick={cycleSketchAngles}
            >
              {sketchAngles === '45' ? 'Straighten: 45° + 90°' : sketchAngles === '90' ? 'Straighten: 90° only' : 'Straighten: off'}
            </button>
          )}
          <span style={{ fontSize: '0.68rem', color: '#475569', padding: '0 4px', fontWeight: 600 }}>Thick:</span>
          {wallThicknessPresets(unit).map(p => (
            <button
              key={p.label}
              type="button"
              className={`fp-mobile-sub-btn ${Math.abs(wallThickness - p.value) < 1e-6 ? 'active' : ''}`}
              aria-pressed={Math.abs(wallThickness - p.value) < 1e-6}
              onClick={() => setWallThickness(p.value)}
            >
              {p.label}
            </button>
          ))}
          {isDrawingWall && (
            <button
              type="button"
              className="fp-mobile-sub-btn"
              style={{ background: 'rgba(239,68,68,0.2)', color: '#dc2626', borderColor: 'rgba(239,68,68,0.4)' }}
              onClick={() => {
                setIsDrawingWall(false);
                setWallStart(null);
                setLiveLengthBadge(null);
                setSnapIndicator(null);
              }}
            >
              Cancel Wall
            </button>
          )}
          {isDrawingWall && (
            <button
              type="button"
              className="fp-mobile-sub-btn active"
              onClick={() => {
                setIsDrawingWall(false);
                setWallStart(null);
                setLiveLengthBadge(null);
                setSnapIndicator(null);
                setActiveTool('select');
              }}
            >
              Done
            </button>
          )}
        </div>
      )}

      {activeTool === 'door' && (
        <div className="fp-mobile-subtoolbar no-print">
          <span style={{ fontSize: '0.68rem', color: '#475569', padding: '0 4px', fontWeight: 600 }}>Door:</span>
          {DOOR_TYPES.map(dt => (
            <button
              key={dt}
              type="button"
              className={`fp-mobile-sub-btn ${selectedDoorType === dt ? 'active' : ''}`}
              onClick={() => setSelectedDoorType(dt)}
            >
              {dt}
            </button>
          ))}
        </div>
      )}

      {activeTool === 'window' && (
        <div className="fp-mobile-subtoolbar no-print">
          <span style={{ fontSize: '0.68rem', color: '#475569', padding: '0 4px', fontWeight: 600 }}>Window:</span>
          {WINDOW_TYPES.map(wt => (
            <button
              key={wt}
              type="button"
              className={`fp-mobile-sub-btn ${selectedWindowType === wt ? 'active' : ''}`}
              onClick={() => setSelectedWindowType(wt)}
            >
              {wt}
            </button>
          ))}
        </div>
      )}

      {activeTool === 'room' && (
        <div className="fp-mobile-subtoolbar no-print">
          <span style={{ fontSize: '0.68rem', color: '#475569', padding: '0 4px', fontWeight: 600 }}>Room:</span>
          {ROOM_TYPES.slice(0, 5).map(rt => (
            <button
              key={rt}
              type="button"
              className={`fp-mobile-sub-btn ${selectedRoomType === rt ? 'active' : ''}`}
              onClick={() => setSelectedRoomType(rt)}
            >
              {rt}
            </button>
          ))}
          <button
            type="button"
            className="fp-mobile-sub-btn"
            style={{ background: '#f1f5f9', color: '#1e293b' }}
            onClick={() => setShowAddRoomModal(true)}
          >
            + Custom Size
          </button>
        </div>
      )}

      {activeTool === 'column' && (
        <div className="fp-mobile-subtoolbar no-print">
          <span style={{ fontSize: '0.68rem', color: '#475569', padding: '0 4px', fontWeight: 600 }}>Column:</span>
          {[
            { id: 'square', label: '9"×9" Square' },
            { id: 'rectangular', label: '9"×15" Rect' },
            { id: 'round', label: 'Round Pillar' },
          ].map(c => (
            <button
              key={c.id}
              type="button"
              className={`fp-mobile-sub-btn ${columnShape === c.id ? 'active' : ''}`}
              onClick={() => setColumnShape(c.id as any)}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}

      {activeTool === 'stairs' && (
        <div className="fp-mobile-subtoolbar no-print">
          <span style={{ fontSize: '0.68rem', color: '#475569', padding: '0 4px', fontWeight: 600 }}>Stair:</span>
          {[
            { id: 'straight', label: 'Straight' },
            { id: 'l-shape', label: 'L-Shape' },
            { id: 'u-shape', label: 'Dog-Leg' },
            { id: 'spiral', label: 'Spiral' },
          ].map(st => (
            <button
              key={st.id}
              type="button"
              className={`fp-mobile-sub-btn ${stairType === st.id ? 'active' : ''}`}
              onClick={() => setStairType(st.id as any)}
            >
              {st.label}
            </button>
          ))}
        </div>
      )}

      {/* ── Mobile Bottom Toolbar (< 768px) ────────────────
          A floating pill with the six everyday tools, and a round button for everything else. */}
      <nav className="fp-mobile-toolbar no-print" aria-label="Mobile Floor Plan Drawing Toolbar">
        <div className="fp-mobile-tool-pill">
        <button
          type="button"
          className={`fp-mobile-tool-btn ${activeTool === 'select' ? 'active' : ''}`}
          onClick={() => { setActiveTool('select'); setIsDrawingWall(false); setWallStart(null); }}
          title="Select / Move"
          id="fp-mobile-tool-select"
        >
          <MousePointer2 size={20} />
          <span className="fp-mobile-tool-label">Select</span>
        </button>

        <button
          type="button"
          className={`fp-mobile-tool-btn ${activeTool === 'wall' || activeTool === 'ai_draw' ? 'active' : ''}`}
          aria-pressed={activeTool === 'wall' || activeTool === 'ai_draw'}
          onClick={() => { setActiveTool(wallMode); setSelectedElement(null); }}
          title="Draw walls (Straight or Sketch)"
          id="fp-mobile-tool-wall"
        >
          <Pencil size={20} />
          <span className="fp-mobile-tool-label">Wall</span>
        </button>

        <button
          type="button"
          className={`fp-mobile-tool-btn ${activeTool === 'eraser' ? 'active' : ''}`}
          onClick={() => { setActiveTool('eraser'); setSelectedElement(null); setIsDrawingWall(false); setWallStart(null); }}
          title="Eraser (Tap any wall, door, window or furniture to delete)"
          id="fp-mobile-tool-eraser"
        >
          <Eraser size={20} />
          <span className="fp-mobile-tool-label">Eraser</span>
        </button>

        <button
          type="button"
          className={`fp-mobile-tool-btn ${activeTool === 'door' ? 'active' : ''}`}
          onClick={() => { setActiveTool('door'); setSelectedElement(null); }}
          title="Place Door"
          id="fp-mobile-tool-door"
        >
          <DoorOpen size={20} />
          <span className="fp-mobile-tool-label">Door</span>
        </button>

        <button
          type="button"
          className={`fp-mobile-tool-btn ${activeTool === 'window' ? 'active' : ''}`}
          onClick={() => { setActiveTool('window'); setSelectedElement(null); }}
          title="Place Window"
          id="fp-mobile-tool-window"
        >
          <AppWindow size={20} />
          <span className="fp-mobile-tool-label">Window</span>
        </button>

        <button
          type="button"
          className={`fp-mobile-tool-btn ${activeTool === 'room' ? 'active' : ''}`}
          onClick={() => { setActiveTool('room'); setSelectedElement(null); }}
          title="Place Room"
          id="fp-mobile-tool-room"
        >
          <Square size={20} />
          <span className="fp-mobile-tool-label">Room</span>
        </button>

        <button
          type="button"
          className={`fp-mobile-tool-btn ${activeTool === 'measure' ? 'active' : ''}`}
          onClick={() => { setActiveTool('measure'); setSelectedElement(null); setIsMeasuring(false); setMeasureStart(null); setMeasureCurrent(null); }}
          title="Measure a distance"
          id="fp-mobile-tool-measure"
        >
          <Ruler size={20} />
          <span className="fp-mobile-tool-label">Tape</span>
        </button>

        {/* Everything else (Split, measurement check, shapes, furniture…): a plain item in
            the same bar, not a large floating button. */}
        <button
          type="button"
          className={`fp-mobile-tool-btn fp-mobile-tool-more ${activeTool === 'split' || showMobileMoreTools ? 'active' : ''}`}
          onClick={() => setShowMobileMoreTools(true)}
          title="Split, measurement check, shapes, furniture and more tools"
          aria-label="More tools"
          aria-expanded={showMobileMoreTools}
          id="fp-mobile-tool-more"
        >
          {activeTool === 'split' ? <Split size={20} /> : <MoreVertical size={20} />}
          <span className="fp-mobile-tool-label">{activeTool === 'split' ? 'Split' : 'More'}</span>
        </button>
        </div>
      </nav>

      {/* ── Bottom Status Bar ─────────────────────────── */}

      <div className="fp-bottom-bar no-print">
        <div className="fp-bottom-left">
          <span><strong>Unit:</strong> {unit === 'feet' ? 'Feet (ft / in)' : unit}</span>
          <span style={{ opacity: 0.4 }}>•</span>
          <span><strong>Plot:</strong> {plan.plotLength} × {plan.plotWidth} {unit}</span>
          <span style={{ opacity: 0.4 }}>•</span>
          <span><strong>Level:</strong> {currentFloor.name}</span>
        </div>
        <div className="fp-bottom-center">
          {isDrawingWall
            ? 'Click end point to finish wall (Esc to cancel)'
            : activeTool === 'wall'
            ? 'Straight wall: click to start, click again to finish'
            : activeTool === 'ai_draw'
            ? 'Sketch: press and draw a rough outline. It becomes straight, joined walls when you let go'
            : activeTool === 'furniture' && selectedFurnitureToPlace
            ? `Click on canvas to place ${selectedFurnitureToPlace.itemType}`
            : activeTool === 'column'
            ? 'Click on grid intersection to place structural column'
            : activeTool === 'stairs'
            ? 'Click to place staircase flight'
            : selectedElement
            ? `Selected: ${selectedElement.type.toUpperCase()} (drag to move, round handles to resize, click a red measurement to type a length, Del to delete)`
            : 'Select an element or choose a tool from the left toolbar'}
        </div>
        <div className="fp-bottom-right">
          <span className="fp-bottom-disclaimer" title={`${PLAN_DISCLAIMER} ${PLAN_REVIEW_NOTE}`}>Planning sketch, not a certified drawing</span>
          <span className={`fp-status-tag ${saveStatus}`}>
            {saveStatus === 'saving' ? '● Saving...' : saveStatus === 'unsaved' ? '● Unsaved' : '● Saved'}
          </span>
        </div>
      </div>

      {/* ── Furniture Library Modal ───────────────────── */}
      {showFurnitureModal && (
        <div className="fp-furniture-modal" role="dialog" aria-modal="true">
          <div className="fp-furniture-dialog">
            <div className="fp-furniture-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Armchair size={20} color="#1e293b" />
                <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a' }}>
                  CAD Architectural Symbols & Furniture
                </h3>
              </div>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setShowFurnitureModal(false)}
              >
                <X size={16} />
              </button>
            </div>

            <div className="fp-furniture-categories">
              {['all', 'bedroom', 'living', 'dining', 'kitchen', 'bathroom', 'utility', 'outdoor'].map(cat => (
                <button
                  key={cat}
                  type="button"
                  className={`fp-cat-chip ${furnitureCategory === cat ? 'active' : ''}`}
                  onClick={() => setFurnitureCategory(cat)}
                >
                  {cat.charAt(0).toUpperCase() + cat.slice(1)}
                </button>
              ))}
            </div>

            <div className="fp-furniture-grid">
              {FURNITURE_CATALOG
                .filter(item => furnitureCategory === 'all' || item.category === furnitureCategory)
                .map(item => (
                  <div
                    key={item.itemType}
                    className="fp-furniture-item-card"
                    onClick={() => {
                      setSelectedFurnitureToPlace(item);
                      setActiveTool('furniture');
                      setShowFurnitureModal(false);
                      onNotify(`Selected ${item.itemType}. Click anywhere on the plan to place.`, 'info');
                    }}
                  >
                    <div className="fp-furniture-icon-box">
                      <ArchitecturalSymbol
                        itemType={item.itemType}
                        width={48}
                        height={48}
                        blueprintMode={viewMode === 'blueprint'}
                      />
                    </div>
                    <div className="fp-furniture-name">{item.itemType}</div>
                    <div className="fp-furniture-dims">{item.width} × {item.height} ft</div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Material & Cost Estimation Modal ──────────── */}
      {showEstimationModal && (
        <div className="fp-calc-modal" role="dialog" aria-modal="true">
          <div className="fp-calc-dialog">
            <div className="fp-calc-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Calculator size={20} color="#334155" />
                <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a' }}>
                  Floor Plan Material & Quantity Estimation
                </h3>
              </div>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setShowEstimationModal(false)}
              >
                <X size={16} />
              </button>
            </div>

            <div className="fp-calc-body">
              <div className="fp-calc-metric-grid">
                <div className="fp-calc-metric-card">
                  <span className="fp-calc-metric-title">Floor Area</span>
                  <span className="fp-calc-metric-num">{totalFloorArea.toFixed(0)}</span>
                  <span className="fp-calc-metric-unit">{unit === 'feet' ? 'sq.ft' : 'sq.m'}</span>
                </div>
                <div className="fp-calc-metric-card">
                  <span className="fp-calc-metric-title">Wall Length</span>
                  <span className="fp-calc-metric-num">{totalWallLength.toFixed(1)}</span>
                  <span className="fp-calc-metric-unit">{unit === 'feet' ? 'ft' : 'm'}</span>
                </div>
                <div className="fp-calc-metric-card">
                  <span className="fp-calc-metric-title">Est. Bricks</span>
                  <span className="fp-calc-metric-num">{estimatedBricks.toLocaleString()}</span>
                  <span className="fp-calc-metric-unit">Standard modular</span>
                </div>
                <div className="fp-calc-metric-card">
                  <span className="fp-calc-metric-title">Cement Bags</span>
                  <span className="fp-calc-metric-num">{estimatedCementBags}</span>
                  <span className="fp-calc-metric-unit">50 kg bags</span>
                </div>
              </div>

              <table className="fp-calc-table">
                <thead>
                  <tr>
                    <th>Material Item</th>
                    <th>Calculated Quantity</th>
                    <th>Usage Basis</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>Red Clay Bricks / AAC Blocks</strong></td>
                    <td><strong style={{ color: '#b45309' }}>{estimatedBricks.toLocaleString()} pcs</strong></td>
                    <td>Based on {totalWallLength.toFixed(1)} {unit} wall length & {ceilingHeight} ft ceiling height</td>
                  </tr>
                  <tr>
                    <td><strong>Cement Bags (PPC/OPC)</strong></td>
                    <td><strong style={{ color: '#1e293b' }}>{estimatedCementBags} bags</strong></td>
                    <td>Masonry mortar 1:6 + Internal/External plaster</td>
                  </tr>
                  <tr>
                    <td><strong>Sand / M-Sand</strong></td>
                    <td><strong>{estimatedSandCuFt} cu.ft</strong></td>
                    <td>Mortar binding & wall finishing</td>
                  </tr>
                  <tr>
                    <td><strong>Steel Rebar</strong></td>
                    <td><strong>{estimatedSteelKg} kg</strong></td>
                    <td>Columns, lintels & sill bands</td>
                  </tr>
                  <tr>
                    <td><strong>Flooring Tiles</strong></td>
                    <td><strong>{estimatedTileArea} sq.ft</strong></td>
                    <td>Carpet area + 10% cutting wastage</td>
                  </tr>
                  <tr>
                    <td><strong>Wall Paint (2 Coats)</strong></td>
                    <td><strong>{estimatedPaintLitres} litres</strong></td>
                    <td>Interior & exterior wall surface coverage</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="fp-calc-footer">
              {onOpenEstimator && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    const sqFt = unit === 'feet' ? totalFloorArea : totalFloorArea * 10.764;
                    setShowEstimationModal(false);
                    onOpenEstimator(sqFt);
                  }}
                >
                  <Sparkles size={16} /> Open in Building Calculator
                </button>
              )}
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setShowEstimationModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Room Schedule & Breakdown Modal ("namba room ethana irukku") ── */}
      {showRoomScheduleModal && (
        <div className="fp-calc-modal" role="dialog" aria-modal="true">
          <div className="fp-calc-dialog" style={{ maxWidth: 760 }}>
            <div className="fp-calc-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: 8, background: 'rgba(16, 185, 129, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Box size={20} color="#15803d" />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a' }}>
                    Floor Plan Room Schedule & Breakdown
                  </h3>
                  <span style={{ fontSize: '0.78rem', color: '#475569' }}>
                    Total Rooms in Floor Plan: <strong style={{ color: '#15803d' }}>{editorState.rooms.length} Rooms</strong> • Total Built-up Area: <strong style={{ color: '#1e293b' }}>{totalFloorArea.toFixed(1)} {unit === 'feet' ? 'sq.ft' : 'sq.m'}</strong>
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setShowRoomScheduleModal(false)}
              >
                <X size={16} />
              </button>
            </div>

            <div className="fp-calc-body" style={{ maxHeight: '72vh', overflowY: 'auto' }}>
              {/* Metric Stat Cards */}
              <div className="fp-room-stat-grid">
                <div className="fp-room-stat-card">
                  <span className="fp-room-stat-num" style={{ color: '#15803d' }}>
                    {editorState.rooms.length}
                  </span>
                  <span className="fp-room-stat-label">Total Rooms</span>
                </div>
                <div className="fp-room-stat-card">
                  <span className="fp-room-stat-num" style={{ color: '#1e293b' }}>
                    {totalFloorArea.toFixed(1)} <small style={{ fontSize: '0.75rem' }}>{unit === 'feet' ? 'sq.ft' : 'sq.m'}</small>
                  </span>
                  <span className="fp-room-stat-label">Total Built-up Area</span>
                </div>
                <div className="fp-room-stat-card">
                  <span className="fp-room-stat-num" style={{ color: '#b45309' }}>
                    {plan.plotLength * plan.plotWidth} <small style={{ fontSize: '0.75rem' }}>{unit === 'feet' ? 'sq.ft' : 'sq.m'}</small>
                  </span>
                  <span className="fp-room-stat-label">Plot Area</span>
                </div>
                <div className="fp-room-stat-card">
                  <span className="fp-room-stat-num" style={{ color: '#6d28d9' }}>
                    {((totalFloorArea / Math.max(1, plan.plotLength * plan.plotWidth)) * 100).toFixed(1)}%
                  </span>
                  <span className="fp-room-stat-label">Plot Coverage</span>
                </div>
              </div>

              {/* Rooms Schedule Table */}
              <div style={{ marginBottom: 16 }}>
                <h5 style={{ margin: '0 0 8px 0', color: '#475569', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  All Configured Rooms & Dimensions
                </h5>
                {editorState.rooms.length > 0 ? (
                  <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: 10 }}>
                    <table className="fp-room-table">
                      <thead>
                        <tr>
                          <th style={{ width: 36 }}>#</th>
                          <th>Room Name</th>
                          <th>Type</th>
                          <th>Width ({unit === 'feet' ? 'ft' : 'm'})</th>
                          <th>Height ({unit === 'feet' ? 'ft' : 'm'})</th>
                          <th>Area</th>
                          <th>Finish</th>
                          <th style={{ textAlign: 'right' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {editorState.rooms.map((rm, idx) => (
                          <tr key={rm.id}>
                            <td style={{ color: '#64748b', fontWeight: 700 }}>{idx + 1}</td>
                            <td>
                              <input
                                type="text"
                                value={rm.label}
                                onChange={e => {
                                  dispatch({ type: 'UPDATE_ROOM', id: rm.id, changes: { label: e.target.value } });
                                  markUnsaved();
                                }}
                                style={{
                                  background: '#ffffff',
                                  border: '1px solid #e2e8f0',
                                  borderRadius: 5,
                                  color: '#0f172a',
                                  padding: '4px 8px',
                                  fontSize: '0.82rem',
                                  fontWeight: 600,
                                  width: 120,
                                }}
                              />
                            </td>
                            <td>
                              <select
                                value={rm.roomType}
                                onChange={e => {
                                  const rt = e.target.value as RoomType;
                                  dispatch({ type: 'UPDATE_ROOM', id: rm.id, changes: { roomType: rt, color: ROOM_COLORS[rt] } });
                                  markUnsaved();
                                }}
                                style={{
                                  background: '#ffffff',
                                  border: '1px solid #e2e8f0',
                                  borderRadius: 5,
                                  color: '#0f172a',
                                  padding: '4px 6px',
                                  fontSize: '0.78rem',
                                }}
                              >
                                {ROOM_TYPES.map(rt => <option key={rt} value={rt}>{rt}</option>)}
                              </select>
                            </td>
                            <td>
                              <input
                                type="number"
                                step={0.5}
                                className="fp-room-table-input"
                                value={rm.width}
                                onChange={e => {
                                  dispatch({ type: 'UPDATE_ROOM', id: rm.id, changes: { width: parseFloat(e.target.value) || 1 } });
                                  markUnsaved();
                                }}
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                step={0.5}
                                className="fp-room-table-input"
                                value={rm.height}
                                onChange={e => {
                                  dispatch({ type: 'UPDATE_ROOM', id: rm.id, changes: { height: parseFloat(e.target.value) || 1 } });
                                  markUnsaved();
                                }}
                              />
                            </td>
                            <td style={{ fontWeight: 700, color: '#15803d' }}>
                              {computeRoomArea(rm, unit)}
                            </td>
                            <td>
                              <button
                                type="button"
                                className="fp-stepper-btn"
                                style={{ width: 'auto', padding: '2px 8px', fontSize: '0.72rem' }}
                                onClick={() => {
                                  const next = rm.floorFinish === 'Color Tint' ? 'Wood Parquet' : 'Color Tint';
                                  dispatch({ type: 'UPDATE_ROOM', id: rm.id, changes: { floorFinish: next } });
                                  markUnsaved();
                                }}
                                title="Toggle Floor Finish"
                              >
                                {rm.floorFinish === 'Color Tint' ? '🎨 Tint' : '🪵 Wood'}
                              </button>
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                                <button
                                  type="button"
                                  className="btn btn-outline btn-sm"
                                  style={{ padding: '3px 8px', fontSize: '0.72rem' }}
                                  onClick={() => handleFocusRoom(rm)}
                                  title="Focus & Select on Canvas"
                                >
                                  🎯 Focus
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-danger btn-sm"
                                  style={{ padding: '3px 8px', fontSize: '0.72rem' }}
                                  onClick={() => {
                                    dispatch({ type: 'DELETE_ROOM', id: rm.id });
                                    markUnsaved();
                                  }}
                                  title="Delete Room"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div style={{ padding: 30, textAlign: 'center', color: '#64748b', background: '#f8fafc', borderRadius: 8 }}>
                    No rooms created in this floor plan yet. Use the form below to add your first room!
                  </div>
                )}
              </div>

              {/* Quick Add Room by Height & Width Inputs */}
              <div style={{ padding: 16, background: '#f8fafc', border: '1.5px solid #cbd5e1', borderRadius: 12 }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '0.9rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Plus size={16} color="#1e293b" /> Add Room with Exact Height & Width
                </h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', color: '#475569', marginBottom: 4 }}>Type of Room</label>
                    <select
                      value={draftRoomType}
                      onChange={e => setDraftRoomType(e.target.value as RoomType)}
                      style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 6, color: '#0f172a', padding: '7px 10px', fontSize: '0.82rem' }}
                    >
                      {ROOM_TYPES.map(rt => <option key={rt} value={rt}>{rt}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', color: '#475569', marginBottom: 4 }}>Width ({unit === 'feet' ? 'ft' : 'm'})</label>
                    <input
                      type="number"
                      step={0.5}
                      value={draftRoomWidth}
                      onChange={e => setDraftRoomWidth(parseFloat(e.target.value) || 1)}
                      style={{ width: 85, background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 6, color: '#0f172a', padding: '7px 8px', fontSize: '0.82rem', fontWeight: 600 }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', color: '#475569', marginBottom: 4 }}>Height ({unit === 'feet' ? 'ft' : 'm'})</label>
                    <input
                      type="number"
                      step={0.5}
                      value={draftRoomHeight}
                      onChange={e => setDraftRoomHeight(parseFloat(e.target.value) || 1)}
                      style={{ width: 85, background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 6, color: '#0f172a', padding: '7px 8px', fontSize: '0.82rem', fontWeight: 600 }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', color: '#475569', marginBottom: 4 }}>Floor Finish</label>
                    <select
                      value={draftRoomFloorFinish}
                      onChange={e => setDraftRoomFloorFinish(e.target.value)}
                      style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 6, color: '#0f172a', padding: '7px 10px', fontSize: '0.82rem' }}
                    >
                      <option value="Wood Parquet">🪵 Wood Floor Parquet</option>
                      <option value="Color Tint">🎨 Color Tint</option>
                    </select>
                  </div>
                  <div>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => handleAddRoomByDimensions(draftRoomWidth, draftRoomHeight, draftRoomType, draftRoomFloorFinish)}
                    >
                      <Plus size={16} /> Place Room on Canvas
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="fp-calc-footer">
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setShowRoomScheduleModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Room with Dimensions Modal ───────────── */}
      {showAddRoomModal && (
        <div className="fp-calc-modal" role="dialog" aria-modal="true">
          <div className="fp-calc-dialog" style={{ maxWidth: 480 }}>
            <div className="fp-calc-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Plus size={20} color="#1e293b" />
                <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a' }}>
                  Add Room by Exact Dimensions
                </h3>
              </div>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setShowAddRoomModal(false)}
              >
                <X size={16} />
              </button>
            </div>

            <div className="fp-calc-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: '#475569', marginBottom: 6, fontWeight: 600 }}>
                    Type of Room
                  </label>
                  <select
                    value={draftRoomType}
                    onChange={e => setDraftRoomType(e.target.value as RoomType)}
                    style={{ width: '100%', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, color: '#0f172a', padding: '9px 12px', fontSize: '0.85rem' }}
                  >
                    {ROOM_TYPES.map(rt => <option key={rt} value={rt}>{rt}</option>)}
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', color: '#475569', marginBottom: 6, fontWeight: 600 }}>
                      Width ({unit === 'feet' ? 'ft' : 'm'})
                    </label>
                    <input
                      type="number"
                      step={0.5}
                      value={draftRoomWidth}
                      onChange={e => setDraftRoomWidth(parseFloat(e.target.value) || 1)}
                      style={{ width: '100%', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, color: '#0f172a', padding: '9px 12px', fontSize: '0.9rem', fontWeight: 700 }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', color: '#475569', marginBottom: 6, fontWeight: 600 }}>
                      Height / Length ({unit === 'feet' ? 'ft' : 'm'})
                    </label>
                    <input
                      type="number"
                      step={0.5}
                      value={draftRoomHeight}
                      onChange={e => setDraftRoomHeight(parseFloat(e.target.value) || 1)}
                      style={{ width: '100%', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, color: '#0f172a', padding: '9px 12px', fontSize: '0.9rem', fontWeight: 700 }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', color: '#475569', marginBottom: 6, fontWeight: 600 }}>
                      Wall Thickness ({unit === 'feet' ? 'in' : 'cm'})
                    </label>
                    <input
                      type="number"
                      step={1}
                      value={unit === 'feet' ? Math.round(draftRoomThickness * 12) : Math.round(draftRoomThickness * 100)}
                      onChange={e => {
                        const val = parseFloat(e.target.value) || 9;
                        setDraftRoomThickness(unit === 'feet' ? val / 12 : val / 100);
                      }}
                      style={{ width: '100%', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, color: '#0f172a', padding: '9px 12px', fontSize: '0.9rem' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', color: '#475569', marginBottom: 6, fontWeight: 600 }}>
                      Floor Finish
                    </label>
                    <select
                      value={draftRoomFloorFinish}
                      onChange={e => setDraftRoomFloorFinish(e.target.value)}
                      style={{ width: '100%', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, color: '#0f172a', padding: '9px 12px', fontSize: '0.85rem' }}
                    >
                      <option value="Wood Parquet">🪵 Wood Floor Parquet</option>
                      <option value="Color Tint">🎨 Plain Tint</option>
                    </select>
                  </div>
                </div>

                <div style={{ background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '10px 14px', borderRadius: 8 }}>
                  <span style={{ fontSize: '0.82rem', color: '#15803d', fontWeight: 600 }}>
                    Computed Room Area: {unit === 'feet' ? `${(draftRoomWidth * draftRoomHeight).toFixed(1)} sq.ft` : `${(draftRoomWidth * draftRoomHeight).toFixed(2)} sq.m`}
                  </span>
                </div>
              </div>
            </div>

            <div className="fp-calc-footer">
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setShowAddRoomModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => handleAddRoomByDimensions(draftRoomWidth, draftRoomHeight, draftRoomType, draftRoomFloorFinish)}
              >
                <Plus size={16} /> Place Room on Plan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Version History Modal ─────────────────────── */}
      {showVersionModal && (
        <div className="fp-calc-modal" role="dialog" aria-modal="true">
          <div className="fp-calc-dialog" style={{ maxWidth: 580 }}>
            <div className="fp-calc-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <History size={20} color="#1e293b" />
                <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a' }}>
                  Floor Plan Version Snapshots
                </h3>
              </div>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setShowVersionModal(false)}
              >
                <X size={16} />
              </button>
            </div>

            <div className="fp-calc-body">
              {/* Create Snapshot Input */}
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  placeholder="Snapshot label (Prior to adding master bedroom)"
                  value={versionNote}
                  onChange={e => setVersionNote(e.target.value)}
                  style={{ flex: 1, padding: '8px 12px', borderRadius: 8, background: '#ffffff', border: '1px solid #e2e8f0', color: '#0f172a', fontSize: '0.85rem' }}
                />
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={handleCreateSnapshot}
                >
                  Save Snapshot
                </button>
              </div>

              {/* List of Saved Snapshots */}
              <div style={{ marginTop: 16 }}>
                <h5 style={{ margin: '0 0 8px 0', color: '#475569', fontSize: '0.78rem', textTransform: 'uppercase' }}>
                  Previous Snapshots
                </h5>
                {plan.versionHistory && plan.versionHistory.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {plan.versionHistory.map(v => (
                      <div
                        key={v.versionId}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 14px',
                          background: '#f8fafc',
                          borderRadius: 8,
                          border: '1px solid #e2e8f0',
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.85rem' }}>
                            {v.note || 'Snapshot'}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                            {new Date(v.timestamp).toLocaleString('en-IN')}
                          </div>
                        </div>
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          onClick={() => handleRestoreSnapshot(v.versionId)}
                        >
                          Restore
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ padding: 24, textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>
                    No version snapshots recorded yet. Create one above to preserve your design milestones.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Keyboard Shortcuts Modal ──────────────────── */}
      {showShortcutsModal && (
        <div className="fp-calc-modal" role="dialog" aria-modal="true">
          <div className="fp-calc-dialog" style={{ maxWidth: 500 }}>
            <div className="fp-calc-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Keyboard size={20} color="#1e293b" />
                <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a' }}>
                  Keyboard Shortcuts
                </h3>
              </div>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setShowShortcutsModal(false)}
              >
                <X size={16} />
              </button>
            </div>

            <div className="fp-calc-body">
              <table className="fp-calc-table">
                <tbody>
                  <tr><td><kbd style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: 4 }}>V</kbd></td><td>Select / Move Tool</td></tr>
                  <tr><td><kbd style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: 4 }}>W</kbd></td><td>Wall Tool: one straight wall at a time</td></tr>
                  <tr><td><kbd style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: 4 }}>S</kbd></td><td>Sketch Walls: a rough outline becomes straight walls</td></tr>
                  <tr><td><kbd style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: 4 }}>R</kbd></td><td>Place Room Tool (rotates the selection when something is selected)</td></tr>
                  <tr><td><kbd style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: 4 }}>D</kbd></td><td>Place Door Tool</td></tr>
                  <tr><td><kbd style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: 4 }}>Enter</kbd></td><td>Type an exact size for the selected wall</td></tr>
                  <tr><td><kbd style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: 4 }}>M</kbd></td><td>Toggle Dimensions & Measurements</td></tr>
                  <tr><td><kbd style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: 4 }}>G</kbd></td><td>Toggle Grid</td></tr>
                  <tr><td><kbd style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: 4 }}>H</kbd></td><td>Pan / Hand Tool</td></tr>
                  <tr><td><kbd style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: 4 }}>F</kbd></td><td>Fit the Plan to the Screen</td></tr>
                  <tr><td><kbd style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: 4 }}>0</kbd></td><td>Reset the View to 100%</td></tr>
                  <tr><td><kbd style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: 4 }}>+ / -</kbd></td><td>Zoom In / Out</td></tr>
                  <tr><td><kbd style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: 4 }}>Ctrl + Z</kbd></td><td>Undo</td></tr>
                  <tr><td><kbd style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: 4 }}>Ctrl + Y / Ctrl + Shift + Z</kbd></td><td>Redo</td></tr>
                  <tr><td><kbd style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: 4 }}>Ctrl + D</kbd></td><td>Duplicate Selected Element</td></tr>
                  <tr><td><kbd style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: 4 }}>Ctrl + L</kbd></td><td>Lock / Unlock Selected Element</td></tr>
                  <tr><td><kbd style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: 4 }}>Ctrl + C / Ctrl + V</kbd></td><td>Copy / Paste</td></tr>
                  <tr><td><kbd style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: 4 }}>Ctrl + S</kbd></td><td>Save Floor Plan</td></tr>
                  <tr><td><kbd style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: 4 }}>Del / Backspace</kbd></td><td>Delete Selected Element</td></tr>
                  <tr><td><kbd style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: 4 }}>Esc</kbd></td><td>Cancel Drawing / Deselect</td></tr>
                  <tr><td><kbd style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: 4 }}>Mouse Wheel</kbd></td><td>Zoom In / Out</td></tr>
                  <tr><td><kbd style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: 4 }}>Middle Mouse / Alt+Drag</kbd></td><td>Pan Canvas</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Background Image Calibration Modal (FloorPlanCreator standard) ── */}
      {showBgImageModal && (
        <div className="fp-calc-modal no-print" role="dialog" aria-modal="true">
          <div className="fp-calc-dialog" style={{ maxWidth: 480 }}>
            <div className="fp-calc-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <ImageIcon size={20} color="#1e293b" />
                <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a' }}>
                  Background Reference Plan Image
                </h3>
              </div>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setShowBgImageModal(false)}
              >
                <X size={16} />
              </button>
            </div>

            <div className="fp-calc-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <p style={{ fontSize: '0.82rem', color: '#475569', margin: 0 }}>
                Import an existing blueprint, surveyor drawing, or sketch (PNG/JPG) to trace over in Building Mistry CAD.
              </p>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6 }}>
                  Upload Image File
                </label>
                <input
                  type="file"
                  accept="image/png, image/jpeg, image/webp"
                  style={{ fontSize: '0.8rem', color: '#0f172a' }}
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = () => {
                      const dataUrl = reader.result as string;
                      const bg: BackgroundPlanImage = {
                        id: uid('bg'),
                        url: dataUrl,
                        x: 0,
                        y: 0,
                        width: bgImageScaleW,
                        height: bgImageScaleH,
                        opacity: bgImageOpacity,
                        locked: true,
                        visible: true,
                      };
                      setFloorLevels(prev => prev.map((lvl, idx) => idx === activeFloorIndex ? { ...lvl, backgroundImage: bg } : lvl));
                      markUnsaved();
                      onNotify('Background reference image imported successfully', 'success');
                    };
                    reader.readAsDataURL(file);
                  }}
                />
              </div>

              {currentFloor.backgroundImage && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label style={{ fontSize: '0.78rem', color: '#475569' }}>Width ({unit === 'feet' ? 'ft' : 'm'})</label>
                      <input
                        type="number"
                        className="fp-inspector-input"
                        value={currentFloor.backgroundImage.width}
                        onChange={e => {
                          const w = parseFloat(e.target.value) || 10;
                          setBgImageScaleW(w);
                          setFloorLevels(prev => prev.map((lvl, idx) => idx === activeFloorIndex && lvl.backgroundImage ? { ...lvl, backgroundImage: { ...lvl.backgroundImage, width: w } } : lvl));
                          markUnsaved();
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.78rem', color: '#475569' }}>Height ({unit === 'feet' ? 'ft' : 'm'})</label>
                      <input
                        type="number"
                        className="fp-inspector-input"
                        value={currentFloor.backgroundImage.height}
                        onChange={e => {
                          const h = parseFloat(e.target.value) || 10;
                          setBgImageScaleH(h);
                          setFloorLevels(prev => prev.map((lvl, idx) => idx === activeFloorIndex && lvl.backgroundImage ? { ...lvl, backgroundImage: { ...lvl.backgroundImage, height: h } } : lvl));
                          markUnsaved();
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: '0.78rem', color: '#475569', display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span>Opacity</span>
                      <span>{Math.round((currentFloor.backgroundImage.opacity ?? 0.5) * 100)}%</span>
                    </label>
                    <input
                      type="range"
                      min="0.1"
                      max="1.0"
                      step="0.05"
                      value={currentFloor.backgroundImage.opacity ?? 0.5}
                      style={{ width: '100%' }}
                      onChange={e => {
                        const op = parseFloat(e.target.value);
                        setBgImageOpacity(op);
                        setFloorLevels(prev => prev.map((lvl, idx) => idx === activeFloorIndex && lvl.backgroundImage ? { ...lvl, backgroundImage: { ...lvl.backgroundImage, opacity: op } } : lvl));
                        markUnsaved();
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 8 }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        const isLocked = !currentFloor.backgroundImage?.locked;
                        setFloorLevels(prev => prev.map((lvl, idx) => idx === activeFloorIndex && lvl.backgroundImage ? { ...lvl, backgroundImage: { ...lvl.backgroundImage, locked: isLocked } } : lvl));
                        markUnsaved();
                      }}
                    >
                      {currentFloor.backgroundImage.locked ? <Lock size={14} /> : <Unlock size={14} />}
                      <span>{currentFloor.backgroundImage.locked ? 'Locked' : 'Unlocked'}</span>
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        const isVis = currentFloor.backgroundImage?.visible === false;
                        setFloorLevels(prev => prev.map((lvl, idx) => idx === activeFloorIndex && lvl.backgroundImage ? { ...lvl, backgroundImage: { ...lvl.backgroundImage, visible: isVis } } : lvl));
                        markUnsaved();
                      }}
                    >
                      <Eye size={14} />
                      <span>{currentFloor.backgroundImage.visible !== false ? 'Visible' : 'Hidden'}</span>
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      onClick={() => {
                        setFloorLevels(prev => prev.map((lvl, idx) => idx === activeFloorIndex ? { ...lvl, backgroundImage: undefined } : lvl));
                        markUnsaved();
                        onNotify('Background reference image removed', 'info');
                      }}
                    >
                      <Trash2 size={14} />
                      <span>Remove</span>
                    </button>
                  </div>
                </>
              )}
            </div>

            <div className="fp-calc-footer" style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => setShowBgImageModal(false)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── CAD Drawing & Snapping Settings Modal ────── */}
      {showSettingsModal && (
        <div className="fp-calc-modal" role="dialog" aria-modal="true">
          <div className="fp-calc-dialog" style={{ maxWidth: 560 }}>
            <div className="fp-calc-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Settings size={20} color="#1e293b" />
                <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a' }}>
                  Drawing settings
                </h3>
              </div>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setShowSettingsModal(false)}
              >
                <X size={16} />
              </button>
            </div>

            <div className="fp-calc-body">
              {/* Help that is off by default, so nothing pops up while drawing */}
              <div style={{ marginBottom: 16, display: 'grid', gap: 8 }}>
                <label className="fp-setting-switch">
                  <input
                    type="checkbox"
                    checked={showTips}
                    onChange={e => { setShowTips(e.target.checked); writeSetting('bm_fp_show_tips', e.target.checked ? '1' : '0'); }}
                    id="fp-setting-tips"
                  />
                  <span><strong>Show tips</strong> A one-line tip for the tool in hand, and first-use tips.</span>
                </label>
                <label className="fp-setting-switch">
                  <input
                    type="checkbox"
                    checked={isAiLiveAssistActive}
                    onChange={e => setIsAiLiveAssistActive(e.target.checked)}
                    id="fp-setting-live-assist"
                  />
                  <span><strong>Read sketch strokes live</strong> Guesses what a freehand stroke is (door, window, room) and asks. Off by default.</span>
                </label>
              </div>

              {/* Wall Thickness Presets */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
                  Standard Wall Thickness Presets
                </label>
                <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                  {WALL_THICKNESS_PRESETS_MM.map(presetMm => {
                    const presetUnits = mmToPlanUnits(presetMm, unit);
                    const isCurrent = Math.abs(wallThickness - presetUnits) < 0.05;
                    return (
                      <button
                        key={presetMm}
                        type="button"
                        className={`fp-cat-chip ${isCurrent ? 'active' : ''}`}
                        onClick={() => {
                          setWallThickness(presetUnits);
                          onNotify(`Wall thickness set to ${presetMm}mm (${presetUnits.toFixed(2)} ${unit === 'feet' ? 'ft' : 'm'})`, 'info');
                        }}
                      >
                        {presetMm} mm ({presetMm <= 115 ? 'Partition' : presetMm === 150 ? 'AAC Block' : '9" Brick'})
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Grid Spacing Presets */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
                  Snap Step
                </label>
                <p style={{ fontSize: '0.8rem', color: '#475569', margin: '4px 0 0 0' }}>
                  With Snap to Grid on, wall ends and anything you place or drag land on multiples of this.
                </p>
                <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                  {gridStepOptions(unit).map(option => (
                    <button
                      key={option.label}
                      type="button"
                      className={`fp-cat-chip ${Math.abs(gridStep - option.value) < 1e-9 ? 'active' : ''}`}
                      aria-pressed={Math.abs(gridStep - option.value) < 1e-9}
                      onClick={() => setGridStep(option.value)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* How far a finger reaches for a corner or wall */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
                  Snap Reach
                </label>
                <p style={{ fontSize: '0.8rem', color: '#475569', margin: '4px 0 0 0' }}>
                  How close a wall end must be to a corner, crossing or wall before it joins it.
                </p>
                <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                  {[{ label: 'Short', value: 0.6 }, { label: 'Normal', value: 1 }, { label: 'Long', value: 1.5 }].map(option => (
                    <button
                      key={option.label}
                      type="button"
                      className={`fp-cat-chip ${snapReach === option.value ? 'active' : ''}`}
                      aria-pressed={snapReach === option.value}
                      onClick={() => { setSnapReach(option.value); writeSetting('bm_fp_snap_reach', String(option.value)); }}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Measurement text size: a view setting only */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
                  Measurement Text Size
                </label>
                <p style={{ fontSize: '0.8rem', color: '#475569', margin: '4px 0 0 0' }}>
                  Changes how large measurements are written on the plan. It never changes a wall's length.
                </p>
                <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                  {[{ label: 'Small', value: 0.85 }, { label: 'Normal', value: 1 }, { label: 'Large', value: 1.25 }, { label: 'Extra large', value: 1.5 }].map(option => (
                    <button
                      key={option.label}
                      type="button"
                      className={`fp-cat-chip ${dimTextScale === option.value ? 'active' : ''}`}
                      aria-pressed={dimTextScale === option.value}
                      id={`fp-dim-text-${option.value}`}
                      onClick={() => { setDimTextScale(option.value); writeSetting('bm_fp_dim_text', String(option.value)); }}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* CAD Snapping Toggles */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
                  Snapping & Alignment Guides
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#0f172a', cursor: 'pointer', fontSize: '0.88rem' }}>
                    <input
                      type="checkbox"
                      checked={snapToGridEnabled}
                      onChange={e => setSnapToGridEnabled(e.target.checked)}
                    />
                    <span><strong>Snap to Grid:</strong> Magnetic alignment to background grid intervals</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#0f172a', cursor: 'pointer', fontSize: '0.88rem' }}>
                    <input
                      type="checkbox"
                      checked={snapToEndpointsEnabled}
                      onChange={e => setSnapToEndpointsEnabled(e.target.checked)}
                    />
                    <span><strong>Snap to Endpoints:</strong> Automatic magnetic corner joining for enclosed walls</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#0f172a', cursor: 'pointer', fontSize: '0.88rem' }}>
                    <input
                      type="checkbox"
                      checked={snapToWallEnabled}
                      onChange={e => setSnapToWallEnabled(e.target.checked)}
                    />
                    <span><strong>Snap Along Walls:</strong> Automatic hosting for doors, windows, TVs & ACs</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#0f172a', cursor: 'pointer', fontSize: '0.88rem' }}>
                    <input
                      type="checkbox"
                      checked={isOrthoActive}
                      onChange={e => setIsOrthoActive(e.target.checked)}
                    />
                    <span><strong>Ortho Mode:</strong> Constrain drawing to strictly horizontal & vertical lines</span>
                  </label>
                </div>
              </div>

              {/* Starter Plan Template Loader */}
              <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 16, marginTop: 16 }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
                  Architectural Starter Plan
                </label>
                <p style={{ fontSize: '0.82rem', color: '#475569', margin: '6px 0 12px 0' }}>
                  Load a verified 30×40 2BHK architectural plan with living room, master bedroom, kitchen, dining, toilet, and columns.
                </p>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={handleLoadStarterPlan}
                >
                  <Sparkles size={16} /> Load 30×40 2BHK Plan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 3D Preview Modal ─────────────────────────── */}
      <Sheet
        open={!!floorDialog}
        title={floorDialog?.mode === 'add' ? 'Add floor' : floorDialog?.mode === 'duplicate' ? 'Duplicate this floor' : 'Rename floor'}
        subtitle={floorDialog?.mode === 'duplicate' ? `Copies everything on ${currentFloor.name}` : undefined}
        onClose={() => setFloorDialog(null)}
        footer={
          <>
            <button type="button" className="m-btn" onClick={() => setFloorDialog(null)}>Cancel</button>
            <button type="button" className="m-btn is-primary" onClick={submitFloorDialog}>
              {floorDialog?.mode === 'add' ? 'Add floor' : floorDialog?.mode === 'duplicate' ? 'Duplicate' : 'Save name'}
            </button>
          </>
        }
      >
        {floorDialog?.error && <div style={{ marginBottom: 12 }}><Note tone="bad" role="alert">{floorDialog.error}</Note></div>}
        <Field label="Floor name">
          <input
            type="text"
            value={floorDialog?.value || ''}
            maxLength={40}
            onChange={e => floorDialog && setFloorDialog({ ...floorDialog, value: e.target.value, error: '' })}
            onKeyDown={e => { if (e.key === 'Enter') submitFloorDialog(); }}
            placeholder="First Floor"
          />
        </Field>
      </Sheet>

      {/* ── Measurement check ──────────────────────────────────────────────
          Each item shows two real measurements from the same line and their difference. The
          user picks the right one; the other is moved to match (joined walls follow). Nothing
          is changed without that choice. */}
      <Sheet
        open={showChecks}
        title="Measurement check"
        subtitle={alignmentIssues.length ? `${alignmentIssues.length} small difference${alignmentIssues.length === 1 ? '' : 's'} found` : 'No small differences'}
        onClose={() => setShowChecks(false)}
      >
        {alignmentIssues.length === 0 ? (
          <Note tone="ok">The walls line up. No measurements are a few millimetres apart.</Note>
        ) : (
          <div className="fp-checks" id="fp-checks">
            <p className="m-calc-note" style={{ marginTop: 0 }}>
              These measurements are a few millimetres apart, where they are probably meant to be the same. Pick the measurement that is right. Nothing changes until you do.
            </p>
            {alignmentIssues.map(issue => {
              const show = (m: { value: number; mm: number }) =>
                baseUnitOf(unit) === 'feet' ? `${formatDimension(m.value, unit)} (${formatMm(m.mm)})` : formatMm(m.mm);
              return (
                <div key={issue.id} className="fp-check" data-check-id={issue.id}>
                  <div className="fp-check-title">
                    {issue.kind === 'step'
                      ? `Two walls are ${formatMm(issue.differenceMm)} out of line`
                      : `A wall is ${formatMm(issue.differenceMm)} out of straight`}
                  </div>
                  <div className="fp-check-ref">Measured from {issue.reference}</div>
                  <dl className="fp-check-values">
                    {issue.measurements.map(m => (
                      <div key={m.label}><dt>{m.label}</dt><dd>{show(m)}</dd></div>
                    ))}
                    <div className="is-diff"><dt>Difference</dt><dd>{formatMm(issue.differenceMm)}</dd></div>
                  </dl>
                  <div className="fp-check-actions">
                    {([0, 1] as const).map(k => (
                      <button
                        key={k}
                        type="button"
                        className="m-btn is-small is-primary"
                        onClick={() => { if (applyEdit(applyAlignmentFix(editorState, issue, k, unit, newPlanId))) setShowChecks(alignmentIssues.length > 1); }}
                      >
                        Use {formatMm(issue.measurements[k].mm)}
                      </button>
                    ))}
                    <button
                      type="button"
                      className="m-btn is-small"
                      onClick={() => {
                        const vw = containerRef.current?.clientWidth || window.innerWidth;
                        const vh = containerRef.current?.clientHeight || window.innerHeight;
                        setPanX(Math.round(vw / 2 - issue.focus.x * GRID_SIZE_PX * zoom));
                        setPanY(Math.round(vh / 2 - issue.focus.y * GRID_SIZE_PX * zoom));
                        setSelectedElement({ type: 'wall', id: issue.wallIds[0] });
                        setShowChecks(false);
                      }}
                    >
                      Show
                    </button>
                    <button type="button" className="m-btn is-small" onClick={() => setIgnoredChecks(list => [...list, issue.id])}>
                      Keep as drawn
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Sheet>

      {/* ── Room: name, type, size and delete, in one sheet ────────────────────
          A room made by walls changes size by moving its walls (rooms next to it follow);
          the sheet says which wall moves and refuses a change that would break the plan. */}
      {(() => {
        const room = roomSheet ? editorState.rooms.find(r => r.id === roomSheet.id) : undefined;
        if (!roomSheet || !room) return null;
        const box = roomBox(room);
        const inner = roomInteriors.get(room.id);
        const COMMON: RoomType[] = ['Bedroom', 'Master Bedroom', 'Kitchen', 'Bathroom', 'Toilet', 'Living Room', 'Dining', 'Balcony', 'Pooja', 'Store', 'Study', 'Utility'];
        const setType = (rt: RoomType) => {
          const generic = !room.label || /^Room \d+$/.test(room.label) || room.label === room.roomType;
          dispatchWithHistory({ type: 'UPDATE_ROOM', id: room.id, changes: { roomType: rt, ...(generic ? { label: rt } : {}) } });
        };
        return (
          <Sheet
            open
            title={room.label || room.roomType}
            subtitle={`${formatPlanArea(roomArea(room), unit)}${inner ? ` · inside ${formatDimension(inner.width, unit)} × ${formatDimension(inner.height, unit)}` : ''}`}
            onClose={() => setRoomSheet(null)}
            footer={
              <>
                <button type="button" className="m-btn is-danger" onClick={() => { setRoomSheet(null); setSelectedElement({ type: 'room', id: room.id }); if (room.fromWalls) setConfirmRoomDelete(room.id); else dispatchWithHistory({ type: 'DELETE_ROOM', id: room.id }); }} disabled={!!room.locked} id="fp-room-sheet-delete">
                  <Trash2 size={18} /> Delete
                </button>
                <button type="button" className="m-btn is-primary" onClick={applyRoomSize} disabled={!!room.locked} id="fp-room-sheet-apply">
                  <Check size={18} /> Done
                </button>
              </>
            }
          >
            {roomSheet.error && <div style={{ marginBottom: 12 }}><Note tone="bad" role="alert">{roomSheet.error}</Note></div>}
            {room.locked && <div style={{ marginBottom: 12 }}><Note>This room is locked. Unlock it to change it.</Note></div>}
            <Field label="Name">
              <input
                type="text"
                value={room.label}
                maxLength={40}
                disabled={!!room.locked}
                onChange={e => dispatch({ type: 'UPDATE_ROOM', id: room.id, changes: { label: e.target.value } })}
                id="fp-room-sheet-name"
              />
            </Field>
            <div className="m-chips fp-room-type-chips" role="group" aria-label="Room type">
              {COMMON.map(rt => (
                <button key={rt} type="button" className={`m-chip ${room.roomType === rt ? 'is-on' : ''}`} aria-pressed={room.roomType === rt} disabled={!!room.locked} onClick={() => setType(rt)}>
                  {rt}
                </button>
              ))}
            </div>
            {box || !room.polygonPoints ? (
              <>
                <div className="m-field-2" style={{ marginTop: 12 }}>
                  <Field label="Width (left to right)">
                    <input type="text" inputMode="decimal" autoComplete="off" value={roomSheet.width} disabled={!!room.locked}
                      onChange={e => setRoomSheet({ ...roomSheet, width: e.target.value, error: '' })} id="fp-room-sheet-width" />
                  </Field>
                  <Field label="Length (top to bottom)">
                    <input type="text" inputMode="decimal" autoComplete="off" value={roomSheet.length} disabled={!!room.locked}
                      onChange={e => setRoomSheet({ ...roomSheet, length: e.target.value, error: '' })} id="fp-room-sheet-length" />
                  </Field>
                </div>
                {room.fromWalls && (
                  <div className="m-field-2">
                    <Segmented label="Wall that moves for the width" value={roomSheet.widthSide} onChange={v => setRoomSheet({ ...roomSheet, widthSide: v })}
                      options={[{ value: 'right', label: 'Right wall' }, { value: 'left', label: 'Left wall' }]} />
                    <Segmented label="Wall that moves for the length" value={roomSheet.lengthSide} onChange={v => setRoomSheet({ ...roomSheet, lengthSide: v })}
                      options={[{ value: 'bottom', label: 'Bottom wall' }, { value: 'top', label: 'Top wall' }]} />
                  </div>
                )}
                <p className="m-calc-note">
                  Wall centre to wall centre, the same as the area. {room.fromWalls ? 'Rooms next to the moved wall grow or shrink with it.' : ''}
                </p>
              </>
            ) : (
              <p className="m-calc-note">This room is not a rectangle, so its size is changed by moving its walls or corners.</p>
            )}
          </Sheet>
        );
      })()}

      <ConfirmSheet
        open={!!confirmRoomDelete}
        title={`Delete ${(() => { const r = editorState.rooms.find(x => x.id === confirmRoomDelete); return r ? r.label || r.roomType : 'this room'; })()}?`}
        message="The room's own walls are removed with it. Walls it shares with other rooms stay, so the rooms next to it are not opened up. You can undo this."
        confirmLabel="Delete room"
        danger
        onConfirm={() => {
          const id = confirmRoomDelete;
          setConfirmRoomDelete(null);
          if (id) applyEdit(deleteRoom(editorState, id, unit, newPlanId));
        }}
        onCancel={() => setConfirmRoomDelete(null)}
      />

      {/* ── Exact wall size: length, thickness and position, typed in ───────── */}
      <Sheet
        open={!!wallEdit}
        title="Wall size"
        subtitle={(() => {
          const w = wallEdit && editorState.walls.find(x => x.id === wallEdit.wallId);
          return w ? `Now ${formatDimension(wallLength(w), unit)} long and ${formatThickness(w.thickness, unit)} thick` : undefined;
        })()}
        onClose={() => setWallEdit(null)}
        footer={
          <>
            <button type="button" className="m-btn" onClick={() => setWallEdit(null)}>Cancel</button>
            <button type="button" className="m-btn is-primary" onClick={submitWallEdit} id="fp-wall-edit-apply">Apply</button>
          </>
        }
      >
        {wallEdit && (() => {
          const w = editorState.walls.find(x => x.id === wallEdit.wallId);
          if (!w) return null;
          const feet = baseUnitOf(unit) === 'feet';
          const level = Math.abs(w.x2 - w.x1) >= Math.abs(w.y2 - w.y1);
          const startFirst = level ? w.x1 <= w.x2 : w.y1 <= w.y2;
          const [first, second] = level ? ['Left end', 'Right end'] : ['Top end', 'Bottom end'];
          const setKeep = (keep: 'start' | 'end') => {
            const anchor = keep === 'start' ? { x: w.x1, y: w.y1 } : { x: w.x2, y: w.y2 };
            const x = String(Number(anchor.x.toFixed(4))), y = String(Number(anchor.y.toFixed(4)));
            setWallEdit({ ...wallEdit, keep, x, x0: x, y, y0: y, error: '' });
          };
          const onEnter = (e: React.KeyboardEvent) => { if (e.key === 'Enter') { e.preventDefault(); submitWallEdit(); } };
          return (
            <div className="fp-wall-edit">
              {wallEdit.error && <div style={{ marginBottom: 12 }}><Note tone="bad" role="alert">{wallEdit.error}</Note></div>}
              {w.locked && <div style={{ marginBottom: 12 }}><Note tone="warn">This wall is locked. Unlock it to change its size.</Note></div>}
              <Field
                label="Length"
                hint={feet
                  ? <>Type <strong>12 6</strong> or <strong>12' 6"</strong> for 12 ft 6 in. Metres work too: <strong>3.8m</strong>.</>
                  : <>Type <strong>3.5</strong> or <strong>350 cm</strong>. Feet work too: <strong>12' 6"</strong>.</>}
              >
                <input
                  id="fp-wall-edit-length"
                  type="text"
                  inputMode="text"
                  autoComplete="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  enterKeyHint="done"
                  value={wallEdit.length}
                  aria-invalid={!!wallEdit.error}
                  onChange={e => setWallEdit({ ...wallEdit, length: e.target.value, error: '' })}
                  onFocus={e => e.currentTarget.select()}
                  onKeyDown={onEnter}
                />
              </Field>
              <div className="m-field">
                <span className="m-field-label">End that stays in place</span>
                <Segmented
                  label="End that stays in place"
                  value={wallEdit.keep}
                  onChange={setKeep}
                  options={[
                    { value: startFirst ? 'start' : 'end', label: first },
                    { value: startFirst ? 'end' : 'start', label: second },
                  ]}
                />
                <span className="m-field-hint" style={{ display: 'block' }}>The other end moves. Walls joined to it move with it, so corners stay joined.</span>
              </div>
              <Field label={feet ? 'Thickness (inches)' : 'Thickness (mm)'} hint="Measured across the wall. It does not change the wall's length.">
                <input
                  id="fp-wall-edit-thickness"
                  type="text"
                  inputMode="text"
                  autoComplete="off"
                  spellCheck={false}
                  value={wallEdit.thickness}
                  onChange={e => setWallEdit({ ...wallEdit, thickness: e.target.value, error: '' })}
                  onKeyDown={onEnter}
                />
              </Field>
              <div className="fp-wall-edit-presets" role="group" aria-label="Common wall thicknesses">
                {wallThicknessPresets(unit).map(p => (
                  <button
                    key={p.label}
                    type="button"
                    className="m-chip"
                    aria-pressed={wallEdit.thickness.trim() === formatThickness(p.value, unit)}
                    onClick={() => setWallEdit({ ...wallEdit, thickness: formatThickness(p.value, unit), error: '' })}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <details className="fp-wall-edit-more">
                <summary>Position</summary>
                <p className="m-field-hint" style={{ display: 'block', margin: '8px 0' }}>
                  Where the end that stays is, measured from the plot's top-left corner, in {feet ? 'feet' : 'metres'}.
                </p>
                <div className="fp-wall-edit-xy">
                  <Field label="From the left">
                    <input id="fp-wall-edit-x" type="number" inputMode="decimal" step="any" value={wallEdit.x} onChange={e => setWallEdit({ ...wallEdit, x: e.target.value, error: '' })} onKeyDown={onEnter} />
                  </Field>
                  <Field label="From the top">
                    <input id="fp-wall-edit-y" type="number" inputMode="decimal" step="any" value={wallEdit.y} onChange={e => setWallEdit({ ...wallEdit, y: e.target.value, error: '' })} onKeyDown={onEnter} />
                  </Field>
                </div>
              </details>
              <p className="fp-wall-edit-note">Length is measured along the wall's centre line, corner to corner.</p>
            </div>
          );
        })()}
      </Sheet>

      {/* ── Drawing tips, what the measurements mean, and the limits of this tool ── */}
      <Sheet open={showHelpSheet} title="Drawing tips" onClose={() => setShowHelpSheet(false)}>
        <div className="fp-help">
          <h3>Drawing walls</h3>
          <ul>
            <li><strong>Sketch:</strong> draw a room outline in one stroke. It is straightened, joined to nearby corners and closed into a room as you draw. A large correction is shown first and added only if you choose Use.</li>
            <li><strong>Straight:</strong> drag out one wall, or tap its two ends, for exact placement.</li>
            <li><strong>Two fingers</strong> always move and zoom the plan and never draw. On a computer, scroll to zoom and drag empty space to move.</li>
            <li><strong>Undo</strong> takes back the last change, including a whole sketched room.</li>
          </ul>
          <h3>Editing</h3>
          <ul>
            <li>With Select, tap a wall. Drag a round handle to resize it; the walls joined at that corner follow.</li>
            <li>Tap a red measurement to type an exact length, thickness or position.</li>
            <li>Snap pulls ends to the grid and to nearby corners. Turn it off to place things freely.</li>
          </ul>
          <h3>What the measurements mean</h3>
          <ul>
            <li><span className="fp-help-swatch is-red" /> <strong>Red, outside a wall:</strong> the wall's length, corner to corner along its centre line.</li>
            <li><span className="fp-help-swatch is-green" /> <strong>Green, inside a room:</strong> the clear size between the inner wall faces.</li>
            <li><strong>Thickness</strong> is measured across a wall and never changes its length.</li>
            <li>Room area on the plan and in totals is measured to the wall centre lines. The green "Inside" figure is the clear floor area.</li>
            <li>Lengths are stored exactly, in {baseUnitOf(unit) === 'feet' ? 'feet' : 'metres'}; only the text on screen is rounded{unit === 'feet' ? ' (to a quarter inch)' : ''}.</li>
          </ul>
          <Note tone="warn">
            {PLAN_DISCLAIMER} {PLAN_REVIEW_NOTE}
          </Note>
        </div>
      </Sheet>

      <Sheet
        open={saveConflict}
        title="This plan was changed somewhere else"
        onClose={() => { /* a choice is needed; the drawing stays open either way */ }}
        footer={
          <>
            <button type="button" className="m-btn" onClick={() => resolveConflict(false)}>Load the other version</button>
            <button type="button" className="m-btn is-primary" onClick={() => resolveConflict(true)}>Keep my version</button>
          </>
        }
      >
        <Note tone="warn">
          The same plan was saved from another tab or device after you opened it here. Nothing has been overwritten.
        </Note>
        <p style={{ marginTop: 12, color: 'var(--m-ink-2)', lineHeight: 1.5 }}>
          <strong>Keep my version</strong> saves what is on this screen and replaces the other one.{' '}
          <strong>Load the other version</strong> discards the changes on this screen that were not saved.
        </p>
      </Sheet>

      <ConfirmSheet
        open={confirmDeleteFloor}
        title={`Delete ${currentFloor.name}?`}
        message={<>Everything drawn on this floor will be removed: {editorState.walls.length} walls, {editorState.rooms.length} rooms, {editorState.doors.length + editorState.windows.length} doors and windows. The other floors are not affected. This can not be undone.</>}
        confirmLabel="Delete floor"
        danger
        onConfirm={confirmDeleteCurrentFloor}
        onCancel={() => setConfirmDeleteFloor(false)}
      />

      {show3D && plan && (
        <FloorPlan3DPreview
          plan={plan}
          walls={editorState.walls}
          rooms={editorState.rooms}
          doors={editorState.doors}
          windows={editorState.windows}
          columns={editorState.columns}
          stairs={editorState.stairs}
          furniture={editorState.furniture}
          onClose={() => setShow3D(false)}
        />
      )}

      {/* ── AI Floor Plan Copilot Drawer ("pakkavana oru AI assistant venu") ─────────────────────────── */}
      {isCopilotOpen && (
        <div className="fp-copilot-backdrop" onClick={() => setIsCopilotOpen(false)}>
          <div className="fp-copilot-drawer" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
            {/* Header */}
            <div className="fp-copilot-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div className="fp-copilot-badge-icon">
                  <Sparkles size={20} color="#334155" />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>
                    AI Floor Plan Copilot
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.78rem', color: '#475569' }}>
                    Auto-straightens zig-zag walls, heals broken gaps & auto-generates rooms
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="fp-copilot-close-btn"
                onClick={() => setIsCopilotOpen(false)}
                title="Close Copilot"
              >
                <X size={18} />
              </button>
            </div>

            {/* Health Card */}
            <div className="fp-copilot-health-card">
              <div className="fp-copilot-score-badge">
                <span className="fp-copilot-score-num">{geometryReport.healthScore}</span>
                <span className="fp-copilot-score-label">/ 100</span>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a' }}>
                    Plan Geometry Health
                  </span>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: geometryReport.healthScore >= 80 ? '#15803d' : '#b45309' }}>
                    {geometryReport.healthScore >= 80 ? 'Good Condition' : 'Needs Optimization'}
                  </span>
                </div>
                <div className="fp-copilot-meter-bar">
                  <div
                    className="fp-copilot-meter-fill"
                    style={{
                      width: `${geometryReport.healthScore}%`,
                      background: geometryReport.healthScore >= 80
                        ? 'linear-gradient(90deg, #10b981, #34d399)'
                        : 'linear-gradient(90deg, #f59e0b, #ef4444)',
                    }}
                  />
                </div>
                <div style={{ fontSize: '0.78rem', color: '#475569', marginTop: 6 }}>
                  {geometryReport.summaryMessage}
                </div>
              </div>
            </div>

            {/* Feedback notification if any */}
            {copilotLastMessage && (
              <div className="fp-copilot-msg-alert">
                <CheckCircle2 size={16} color="#15803d" />
                <span>{copilotLastMessage}</span>
              </div>
            )}

            {/* 1-Click Magic Fix Card */}
            <div className="fp-copilot-magic-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ fontSize: '1.4rem' }}>🪄</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>
                    1-Click Auto-Heal & Generate Rooms
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#334155' }}>
                    Fixes all zig-zags, welds gaps, and automatically creates furnished rooms!
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="fp-copilot-magic-btn"
                disabled={copilotLoading}
                onClick={handleCopilotHealAll}
              >
                {copilotLoading ? 'Processing...' : 'Run Full Auto-Heal'}
              </button>
            </div>

            {/* Individual AI Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, margin: '14px 0' }}>
              {/* Action 1: Straighten Zig-Zag Walls */}
              <div className="fp-copilot-action-card">
                <div className="fp-copilot-action-info">
                  <div className="fp-copilot-action-title">
                    <span>Straighten Zig-Zag Walls</span>
                    <span className="fp-copilot-action-count">
                      {geometryReport.zigzagCount} Crooked
                    </span>
                  </div>
                  <p className="fp-copilot-action-desc">
                    Snaps hand-drawn tilted or crooked walls to clean 90° and 45° angles.
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  disabled={copilotLoading || geometryReport.zigzagCount === 0}
                  onClick={handleCopilotStraighten}
                >
                  Straighten
                </button>
              </div>

              {/* Action 2: Weld Incomplete Gaps */}
              <div className="fp-copilot-action-card">
                <div className="fp-copilot-action-info">
                  <div className="fp-copilot-action-title">
                    <span>Close Incomplete Line Gaps</span>
                    <span className="fp-copilot-action-count">
                      {geometryReport.openGapCount} Gaps
                    </span>
                  </div>
                  <p className="fp-copilot-action-desc">
                    Snaps disconnected endpoints together to form watertight corners.
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  disabled={copilotLoading || geometryReport.openGapCount === 0}
                  onClick={handleCopilotCloseGaps}
                >
                  Close Gaps
                </button>
              </div>

              {/* Action 3: Clean Stray Micro-Stubs */}
              <div className="fp-copilot-action-card">
                <div className="fp-copilot-action-info">
                  <div className="fp-copilot-action-title">
                    <span>Clean Stray Micro-Stubs</span>
                    <span className="fp-copilot-action-count">
                      {geometryReport.strayStubCount} Stubs
                    </span>
                  </div>
                  <p className="fp-copilot-action-desc">
                    Deletes tiny dangling wall fragments shorter than 0.8 {unit === 'feet' ? 'ft' : 'm'}.
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  disabled={copilotLoading || geometryReport.strayStubCount === 0}
                  onClick={handleCopilotCleanStubs}
                >
                  Clean
                </button>
              </div>
            </div>

            {/* Natural Language Prompt Assistant */}
            <div className="fp-copilot-prompt-section">
              <label className="fp-copilot-prompt-label">
                <Sparkles size={14} /> Natural Language Design Assistant
              </label>
              <form onSubmit={handleCopilotSubmitPrompt} className="fp-copilot-prompt-form">
                <input
                  type="text"
                  className="fp-copilot-prompt-input"
                  placeholder={'Describe: "Add a 12 by 10 foot room beside kitchen" or "Rotate 45 degrees"'}
                  value={copilotPrompt}
                  onChange={e => setCopilotPrompt(e.target.value)}
                />
                <button
                  type="submit"
                  className="fp-copilot-send-btn"
                  disabled={copilotLoading || !copilotPrompt.trim()}
                >
                  Send
                </button>
              </form>
              <div className="fp-copilot-quick-prompts">
                <button
                  type="button"
                  className="fp-copilot-quick-chip"
                  onClick={() => setCopilotPrompt('wall zig zag ahh pota correct panna')}
                >
                  wall zig zag ahh pota correct panna
                </button>
                <button
                  type="button"
                  className="fp-copilot-quick-chip"
                  onClick={() => setCopilotPrompt('incomplete line correct panna')}
                >
                  incomplete line correct panna
                </button>
                <button
                  type="button"
                  className="fp-copilot-quick-chip"
                  onClick={() => setCopilotPrompt('fix all geometry')}
                >
                  fix all geometry
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Building Mistry AI: proposals previewed on the plan, applied on Apply ── */}
      <MistryAiSheet
        open={isMistryAiOpen}
        onClose={() => setIsMistryAiOpen(false)}
        state={editorState}
        unit={unit}
        plot={{ length: plan.plotLength, width: plan.plotWidth }}
        selected={selectedElement}
        newId={newPlanId}
        onPreview={next => setAiPreview(next)}
        onApply={next => applyEdit(
          { ok: true, state: next, summary: 'Building Mistry AI change applied', changes: [], warnings: [] },
          selectedElement && [...next.walls, ...next.rooms].some(e => e.id === selectedElement.id) ? selectedElement : null,
        )}
        onUndo={handleUndo}
      />

      {/* ── AI Floor Plan Assistant Side Panel / Mobile Bottom Sheet ── */}
      <AIAssistantPanel
        isOpen={isAiAssistantOpen}
        onClose={() => setIsAiAssistantOpen(false)}
        planContext={planContext}
        onExecuteAction={executeValidatedAction}
        onUndoLastAction={handleUndo}
        pendingClassification={pendingClassification}
        onClearPendingClassification={() => setPendingClassification(null)}
        onOpenFixPlanModal={handleOpenFixPlanModal}
        onOpenAnalyzeModal={handleOpenAnalyzeModal}
        onOpenDesignModal={() => setIsDesignModalOpen(true)}
        onSwitch3D={() => setShow3D(true)}
        onToggleDimensions={() => setShowDimensions(d => !d)}
      />

      {/* ── "Fix My Plan" Diagnostic Modal ── */}
      <PlanDiagnosticModal
        isOpen={isFixPlanModalOpen}
        onClose={() => setIsFixPlanModalOpen(false)}
        issues={diagnosticIssues}
        unit={unit}
        onLocateIssue={handleLocateDiagnosticIssue}
        onApplyFix={executeValidatedAction}
        onApplyAllFixes={actions => {
          actions.forEach(a => executeValidatedAction(a));
          onNotify(`Applied ${actions.length} safe architectural fixes.`, 'success');
        }}
      />

      {/* ── Starter Templates Chooser Modal (Priority 1) ── */}
      {showStarterTemplatesModal && (
        <div className="fp-ai-dialog fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-800/40">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                  <LayoutGrid className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    Choose a Starter Floor Plan Template
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Instantly load a professionally proportioned architectural layout.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowStarterTemplatesModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              {STARTER_TEMPLATES.map(tpl => (
                <div
                  key={tpl.id}
                  onClick={() => handleApplyStarterTemplate(tpl)}
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 hover:border-amber-500 dark:hover:border-amber-500 hover:bg-amber-50/30 dark:hover:bg-amber-950/20 cursor-pointer transition-all flex flex-col justify-between group shadow-sm hover:shadow"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300">
                        {tpl.bhk}
                      </span>
                      <span className="text-xs text-slate-500 font-mono">
                        {tpl.plotLength} × {tpl.plotWidth} {tpl.unit === 'feet' ? 'ft' : 'm'}
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                      {tpl.name}
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                      {tpl.description}
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-200/60 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
                    <span>{tpl.rooms.length} Rooms • {tpl.walls.length} Walls • {tpl.doors.length} Doors</span>
                    <span className="font-semibold text-amber-600 group-hover:translate-x-0.5 transition-transform">Use &rarr;</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex justify-end">
              <button
                type="button"
                onClick={() => setShowStarterTemplatesModal(false)}
                className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── "Analyze Plan" Geometric Metrics Modal ── */}
      <PlanAnalysisModal
        isOpen={isAnalyzePlanModalOpen}
        onClose={() => setIsAnalyzePlanModalOpen(false)}
        report={analysisReport}
        unit={unit}
      />

      {/* ── Mobile More Menu Bottom Sheet (< 768px) ────── */}
      {showMobileMenu && (
        <div className="fp-mobile-sheet-backdrop" onClick={() => setShowMobileMenu(false)}>
          <div className="fp-mobile-sheet" onClick={e => e.stopPropagation()} role="dialog" aria-label="Floor Plan Menu">
            <div className="fp-mobile-sheet-handle" />
            <div className="fp-mobile-sheet-header">
              <span className="fp-mobile-sheet-title">Floor Plan Menu</span>
              <button
                type="button"
                className="fp-mobile-sheet-close"
                onClick={() => setShowMobileMenu(false)}
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>

            {/* Floor Levels Switcher */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Floor Levels
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {floorLevels.map((lvl, idx) => (
                  <button
                    key={lvl.id || idx}
                    type="button"
                    className={`fp-mobile-sub-btn ${idx === activeFloorIndex ? 'active' : ''}`}
                    onClick={() => {
                      handleSwitchFloor(idx);
                      setShowMobileMenu(false);
                    }}
                  >
                    {idx === activeFloorIndex && <Check size={12} />}
                    {lvl.name}
                  </button>
                ))}
                <button
                  type="button"
                  className="fp-mobile-sub-btn"
                  onClick={() => {
                    handleAddFloor();
                    setShowMobileMenu(false);
                  }}
                  title="Add Level"
                >
                  <Plus size={12} /> Add Level
                </button>
                <button
                  type="button"
                  className="fp-mobile-sub-btn"
                  onClick={() => {
                    handleDuplicateFloor();
                    setShowMobileMenu(false);
                  }}
                  title="Duplicate Level"
                >
                  <Copy size={12} /> Duplicate
                </button>
              </div>
            </div>

            {/* Quick Actions Grid */}
            <div className="fp-mobile-sheet-grid">
              <button
                type="button"
                className="fp-mobile-grid-btn"
                onClick={() => {
                  setShowMobileMenu(false);
                  handleExportDXF();
                }}
              >
                <div className="fp-mobile-grid-btn-icon"><FileCode size={18} /></div>
                <span>Export DXF</span>
              </button>

              <button
                type="button"
                className="fp-mobile-grid-btn"
                onClick={() => {
                  setShowMobileMenu(false);
                  handleExportPDF();
                }}
              >
                <div className="fp-mobile-grid-btn-icon"><FileDown size={18} /></div>
                <span>Export PDF Sheet</span>
              </button>

              <button
                type="button"
                className="fp-mobile-grid-btn"
                onClick={() => {
                  setShowMobileMenu(false);
                  handleExportPNG();
                }}
              >
                <div className="fp-mobile-grid-btn-icon"><Download size={18} /></div>
                <span>Export PNG</span>
              </button>

              <button
                type="button"
                className="fp-mobile-grid-btn"
                onClick={() => {
                  setShowMobileMenu(false);
                  setShowEstimationModal(true);
                }}
              >
                <div className="fp-mobile-grid-btn-icon"><Calculator size={18} /></div>
                <span>Material Estimator</span>
              </button>

              <button
                type="button"
                className="fp-mobile-grid-btn"
                onClick={() => {
                  setShowMobileMenu(false);
                  setIsLayersOpen(true);
                }}
              >
                <div className="fp-mobile-grid-btn-icon"><Layers size={18} /></div>
                <span>Layers</span>
              </button>

              <button
                type="button"
                className="fp-mobile-grid-btn"
                onClick={() => {
                  setShowMobileMenu(false);
                  setShowSettingsModal(true);
                }}
              >
                <div className="fp-mobile-grid-btn-icon"><Settings size={18} /></div>
                <span>Drawing settings</span>
              </button>

              <button
                type="button"
                className="fp-mobile-grid-btn"
                onClick={() => {
                  setShowMobileMenu(false);
                  setShowVersionModal(true);
                }}
              >
                <div className="fp-mobile-grid-btn-icon"><History size={18} /></div>
                <span>Version History</span>
              </button>

              <button
                type="button"
                className="fp-mobile-grid-btn danger"
                onClick={() => {
                  setShowMobileMenu(false);
                  if (window.confirm('Clear all elements from current floor level?')) {
                    dispatchWithHistory({
                      type: 'SET_STATE',
                      payload: {
                        walls: [], rooms: [], doors: [], windows: [],
                        furniture: [], stairs: [], columns: [], annotations: [],
                      },
                    });
                  }
                }}
              >
                <div className="fp-mobile-grid-btn-icon"><Trash2 size={18} /></div>
                <span>Clear Floor Level</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Mobile Shapes Bottom Sheet (< 768px) ────────── */}
      {showMobileShapes && (
        <div className="fp-mobile-sheet-backdrop" onClick={() => setShowMobileShapes(false)}>
          <div className="fp-mobile-sheet" onClick={e => e.stopPropagation()} role="dialog" aria-label="CAD Shapes">
            <div className="fp-mobile-sheet-handle" />
            <div className="fp-mobile-sheet-header">
              <span className="fp-mobile-sheet-title">Room shapes</span>
              <button
                type="button"
                className="fp-mobile-sheet-close"
                onClick={() => setShowMobileShapes(false)}
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>

            <div className="fp-mobile-sheet-grid">
              <button
                type="button"
                className="fp-mobile-grid-btn"
                onClick={() => {
                  handleAddRoomByDimensions(14, 12, 'Living Room');
                  setShowMobileShapes(false);
                }}
              >
                <div className="fp-mobile-grid-btn-icon"><Square size={18} /></div>
                <div>
                  <div>Rectangle Room</div>
                  <div style={{ fontSize: '0.68rem', color: '#475569' }}>14 × 12 {unit === 'feet' ? 'ft' : 'm'} standard</div>
                </div>
              </button>

              <button
                type="button"
                className="fp-mobile-grid-btn"
                onClick={() => {
                  handleAddRoomByDimensions(10, 10, 'Bedroom');
                  setShowMobileShapes(false);
                }}
              >
                <div className="fp-mobile-grid-btn-icon"><Square size={18} /></div>
                <div>
                  <div>Square Room</div>
                  <div style={{ fontSize: '0.68rem', color: '#475569' }}>10 × 10 {unit === 'feet' ? 'ft' : 'm'} room</div>
                </div>
              </button>

              <button
                type="button"
                className="fp-mobile-grid-btn"
                onClick={() => {
                  setActiveTool('column');
                  setColumnShape('round');
                  setShowMobileShapes(false);
                  onNotify('Round pillar/column active: tap canvas to place', 'info');
                }}
              >
                <div className="fp-mobile-grid-btn-icon"><Shapes size={18} /></div>
                <div>
                  <div>Circle / Round</div>
                  <div style={{ fontSize: '0.68rem', color: '#475569' }}>Circular pillar or round space</div>
                </div>
              </button>

              <button
                type="button"
                className="fp-mobile-grid-btn"
                onClick={() => {
                  setActiveTool('wall');
                  setIsDrawingWall(false);
                  setWallStart(null);
                  setShowMobileShapes(false);
                  onNotify('Polygon mode: tap consecutive points to enclose polygon', 'info');
                }}
              >
                <div className="fp-mobile-grid-btn-icon"><Pencil size={18} /></div>
                <div>
                  <div>Polygon / L-Shape</div>
                  <div style={{ fontSize: '0.68rem', color: '#475569' }}>Multi-corner room geometry</div>
                </div>
              </button>

              <button
                type="button"
                className="fp-mobile-grid-btn"
                style={{ gridColumn: 'span 2' }}
                onClick={() => {
                  setIsShapeLibraryOpen(true);
                  setShowMobileShapes(false);
                }}
              >
                <div className="fp-mobile-grid-btn-icon"><Layers size={18} /></div>
                <div>
                  <div>Browse Full Shape Library</div>
                  <div style={{ fontSize: '0.68rem', color: '#475569' }}>More than 50 symbols and ready room shapes</div>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Mobile More Tools Bottom Sheet (< 768px) ─────── */}
      {showMobileMoreTools && (
        <div className="fp-mobile-sheet-backdrop" onClick={() => setShowMobileMoreTools(false)}>
          <div className="fp-mobile-sheet" onClick={e => e.stopPropagation()} role="dialog" aria-label="Add and more tools">
            <div className="fp-mobile-sheet-handle" />
            <div className="fp-mobile-sheet-header">
              <span className="fp-mobile-sheet-title">Add & more tools</span>
              <button
                type="button"
                className="fp-mobile-sheet-close"
                onClick={() => setShowMobileMoreTools(false)}
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>

            {/* Searchable Tool Picker (Priority 3) */}
            <div className="fp-mobile-search-bar">
              <Search size={16} color="#64748b" />
              <input
                type="text"
                value={mobileToolSearch}
                onChange={e => setMobileToolSearch(e.target.value)}
                placeholder="Search tools (e.g. wall, shapes, column, stair)..."
                className="fp-mobile-search-input"
              />
              {mobileToolSearch && (
                <button
                  type="button"
                  onClick={() => setMobileToolSearch('')}
                  style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                  aria-label="Clear search"
                >
                  <X size={14} color="#64748b" />
                </button>
              )}
            </div>

            <div className="fp-mobile-sheet-grid">
              {(!mobileToolSearch || 'split cut wall segment'.includes(mobileToolSearch.toLowerCase())) && (
                <button
                  type="button"
                  className={`fp-mobile-grid-btn ${activeTool === 'split' ? 'active' : ''}`}
                  id="fp-mobile-tool-split"
                  onClick={() => {
                    setActiveTool('split');
                    setSelectedElement(null);
                    setShowMobileMoreTools(false);
                    onNotify('Split: tap a wall where it should be cut into two walls.', 'info');
                  }}
                >
                  <div className="fp-mobile-grid-btn-icon"><Split size={18} /></div>
                  <span>Split wall</span>
                </button>
              )}

              {(!mobileToolSearch || 'measurement check dimension correction align mm'.includes(mobileToolSearch.toLowerCase())) && (
                <button
                  type="button"
                  className="fp-mobile-grid-btn"
                  id="fp-mobile-tool-checks"
                  onClick={() => {
                    setShowMobileMoreTools(false);
                    setShowChecks(true);
                  }}
                >
                  <div className="fp-mobile-grid-btn-icon"><Ruler size={18} /></div>
                  <span>Check measurements{alignmentIssues.length ? ` (${alignmentIssues.length})` : ''}</span>
                </button>
              )}

              {(!mobileToolSearch || 'room shapes library'.includes(mobileToolSearch.toLowerCase())) && (
                <button
                  type="button"
                  className="fp-mobile-grid-btn"
                  id="fp-mobile-tool-shapes"
                  onClick={() => {
                    setShowMobileMoreTools(false);
                    setShowMobileShapes(true);
                  }}
                >
                  <div className="fp-mobile-grid-btn-icon"><Shapes size={18} /></div>
                  <span>Room Shapes</span>
                </button>
              )}

              {(!mobileToolSearch || 'structural column pillar'.includes(mobileToolSearch.toLowerCase())) && (
                <button
                  type="button"
                  className="fp-mobile-grid-btn"
                  onClick={() => {
                    setActiveTool('column');
                    setSelectedElement(null);
                    setShowMobileMoreTools(false);
                  }}
                >
                  <div className="fp-mobile-grid-btn-icon"><Columns size={18} /></div>
                  <span>Structural Column</span>
                </button>
              )}

              {(!mobileToolSearch || 'staircase stairs flight'.includes(mobileToolSearch.toLowerCase())) && (
                <button
                  type="button"
                  className="fp-mobile-grid-btn"
                  onClick={() => {
                    setActiveTool('stairs');
                    setSelectedElement(null);
                    setShowMobileMoreTools(false);
                  }}
                >
                  <div className="fp-mobile-grid-btn-icon"><Split size={18} /></div>
                  <span>Staircase</span>
                </button>
              )}

              {(!mobileToolSearch || 'furniture symbols bed sofa table'.includes(mobileToolSearch.toLowerCase())) && (
                <button
                  type="button"
                  className="fp-mobile-grid-btn"
                  onClick={() => {
                    setShowFurnitureModal(true);
                    setShowMobileMoreTools(false);
                  }}
                >
                  <div className="fp-mobile-grid-btn-icon"><Armchair size={18} /></div>
                  <span>Furniture & Symbols</span>
                </button>
              )}

              {(!mobileToolSearch || 'dimensions measure ruler'.includes(mobileToolSearch.toLowerCase())) && (
                <button
                  type="button"
                  className="fp-mobile-grid-btn"
                  onClick={() => {
                    setShowDimensions(d => !d);
                    setShowMobileMoreTools(false);
                    onNotify(`Dimensions ${!showDimensions ? 'Shown' : 'Hidden'}`, 'info');
                  }}
                >
                  <div className="fp-mobile-grid-btn-icon"><Ruler size={18} /></div>
                  <span>{showDimensions ? 'Hide Dimensions' : 'Show Dimensions'}</span>
                </button>
              )}

              {(!mobileToolSearch || 'text note annotation callout'.includes(mobileToolSearch.toLowerCase())) && (
                <button
                  type="button"
                  className="fp-mobile-grid-btn"
                  onClick={() => {
                    setActiveTool('annotation');
                    setSelectedElement(null);
                    setShowMobileMoreTools(false);
                  }}
                >
                  <div className="fp-mobile-grid-btn-icon"><Type size={18} /></div>
                  <span>Text Note</span>
                </button>
              )}

              {(!mobileToolSearch || 'sketch walls ai draw'.includes(mobileToolSearch.toLowerCase())) && (
                <button
                  type="button"
                  className="fp-mobile-grid-btn"
                  onClick={() => {
                    setActiveTool('ai_draw');
                    setSelectedElement(null);
                    setShowMobileMoreTools(false);
                  }}
                >
                  <div className="fp-mobile-grid-btn-icon" style={{ color: '#1e293b' }}><PenTool size={18} /></div>
                  <span>Sketch Walls</span>
                </button>
              )}

              {(!mobileToolSearch || 'drawing tips help'.includes(mobileToolSearch.toLowerCase())) && (
                <button
                  type="button"
                  className="fp-mobile-grid-btn"
                  id="fp-mobile-help"
                  onClick={() => {
                    setShowMobileMoreTools(false);
                    setShowHelpSheet(true);
                  }}
                >
                  <div className="fp-mobile-grid-btn-icon"><Info size={18} /></div>
                  <span>Drawing Tips</span>
                </button>
              )}

              {(!mobileToolSearch || 'pan canvas hand move'.includes(mobileToolSearch.toLowerCase())) && (
                <button
                  type="button"
                  className="fp-mobile-grid-btn"
                  onClick={() => {
                    setActiveTool('pan');
                    setIsDrawingWall(false);
                    setWallStart(null);
                    setSelectedElement(null);
                    setShowMobileMoreTools(false);
                  }}
                >
                  <div className="fp-mobile-grid-btn-icon"><Hand size={18} /></div>
                  <span>Pan Canvas</span>
                </button>
              )}

              {(!mobileToolSearch || 'reset view 100% zoom'.includes(mobileToolSearch.toLowerCase())) && (
                <button
                  type="button"
                  className="fp-mobile-grid-btn"
                  id="fp-mobile-reset-view"
                  onClick={() => {
                    handleResetView();
                    setShowMobileMoreTools(false);
                  }}
                >
                  <div className="fp-mobile-grid-btn-icon"><Maximize size={18} /></div>
                  <span>Reset View (100%)</span>
                </button>
              )}

              {(!mobileToolSearch || 'grid lines'.includes(mobileToolSearch.toLowerCase())) && (
                <button
                  type="button"
                  className="fp-mobile-grid-btn"
                  onClick={() => {
                    setShowGrid(g => !g);
                    setShowMobileMoreTools(false);
                  }}
                >
                  <div className="fp-mobile-grid-btn-icon"><GridIcon size={18} /></div>
                  <span>{showGrid ? 'Hide Grid' : 'Show Grid'}</span>
                </button>
              )}

              {(!mobileToolSearch || 'magnet snap snapping'.includes(mobileToolSearch.toLowerCase())) && (
                <button
                  type="button"
                  className="fp-mobile-grid-btn"
                  onClick={() => {
                    const next = !(snapToGridEnabled && snapToEndpointsEnabled);
                    setSnapToGridEnabled(next);
                    setSnapToEndpointsEnabled(next);
                    setSnapToWallEnabled(next);
                    setShowMobileMoreTools(false);
                    onNotify(`Snapping ${next ? 'Enabled' : 'Disabled'}`, 'info');
                  }}
                >
                  <div className="fp-mobile-grid-btn-icon"><Magnet size={18} /></div>
                  <span>{snapToGridEnabled ? 'Disable Snap' : 'Enable Snap'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Mobile Details Bottom Sheet (< 768px) ───────── */}
      {showMobileDetails && (
        <div className="fp-mobile-sheet-backdrop" onClick={() => setShowMobileDetails(false)}>
          <div className="fp-mobile-sheet" onClick={e => e.stopPropagation()} role="dialog" aria-label="Plan Overview">
            <div className="fp-mobile-sheet-handle" />
            <div className="fp-mobile-sheet-header">
              <span className="fp-mobile-sheet-title">Plan Overview & Statistics</span>
              <button
                type="button"
                className="fp-mobile-sheet-close"
                onClick={() => setShowMobileDetails(false)}
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>

            <div className="fp-mobile-sheet-grid">
              <div className="fp-mobile-grid-btn" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '0.68rem', color: '#475569' }}>TOTAL FLOOR AREA</span>
                <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1e293b' }}>
                  {totalFloorArea.toFixed(1)} {unit === 'feet' ? 'sq.ft' : 'sq.m'}
                </span>
              </div>

              <div
                className="fp-mobile-grid-btn"
                style={{ flexDirection: 'column', alignItems: 'flex-start', cursor: 'pointer' }}
                onClick={() => {
                  setShowMobileDetails(false);
                  setShowRoomScheduleModal(true);
                }}
              >
                <span style={{ fontSize: '0.68rem', color: '#475569' }}>ROOMS SCHEDULE</span>
                <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#15803d' }}>
                  {editorState.rooms.length} Rooms (View)
                </span>
              </div>

              <div className="fp-mobile-grid-btn" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '0.68rem', color: '#475569' }}>WALLS COUNT</span>
                <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>
                  {editorState.walls.length} Walls
                </span>
              </div>

              <div className="fp-mobile-grid-btn" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '0.68rem', color: '#475569' }}>COLUMNS COUNT</span>
                <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>
                  {editorState.columns.length} Columns
                </span>
              </div>

              <div className="fp-mobile-grid-btn" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '0.68rem', color: '#475569' }}>OPENINGS</span>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a' }}>
                  {editorState.doors.length} Doors • {editorState.windows.length} Windows
                </span>
              </div>

              <div className="fp-mobile-grid-btn" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '0.68rem', color: '#475569' }}>SAVE STATUS</span>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: saveStatus === 'saved' ? '#15803d' : '#b45309' }}>
                  {saveStatus === 'saved' ? 'Saved to local database' : 'Unsaved changes pending'}
                </span>
              </div>
            </div>

            <button
              type="button"
              className="btn btn-primary"
              style={{ marginTop: 8, width: '100%' }}
              onClick={() => {
                setShowMobileDetails(false);
                setShowRoomScheduleModal(true);
              }}
            >
              View Full Room Schedule Table
            </button>

            <p className="fp-wall-edit-note" style={{ marginTop: 12 }}>
              Areas are measured to the wall centre lines. {PLAN_DISCLAIMER} {PLAN_REVIEW_NOTE}
            </p>
          </div>
        </div>
      )}

      {/* ── "Help Me Design" Proposed Layout Modal ── */}
      <HelpMeDesignModal
        isOpen={isDesignModalOpen}
        onClose={() => setIsDesignModalOpen(false)}
        unit={unit}
        onApplyLayout={handleApplyLayoutProposal}
      />
    </div>
  );
};
