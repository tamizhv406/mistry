import React, { useState, useEffect, useRef, useCallback, useReducer, useMemo } from 'react';
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
} from 'lucide-react';
import type {
  FloorPlan, FloorPlanWall, FloorPlanRoom, FloorPlanDoor, FloorPlanWindow,
  FloorPlanFurniture, FloorPlanStaircase, FloorPlanColumn, FloorPlanAnnotation,
  FloorPlanLevel, RoomType, DoorType, WindowType, FloorPlanUnit, User,
  FloorPlanLayerConfig,
} from '../db/types';
import {
  getFloorPlanById, updateFloorPlan, saveFloorPlanVersion, restoreFloorPlanVersion,
  exportFloorPlanAsDxf, exportFloorPlanAsProjectJson, createStarterFloorPlan,
} from '../services/floorPlanService';
import {
  findSnapPoint, snapAngleOrtho, getWallLength, getWallAngleDeg,
  formatLength, formatArea, projectPointOntoWall, snapWallMountedItem,
  detectEnclosedRooms, WALL_THICKNESS_PRESETS_MM, mmToPlanUnits, planUnitsToMm,
  computeWallSegmentsWithOpenings, calculatePlanBoundingBox, findHostWallForOpening,
  ARCHITECTURAL_WINDOW_TYPES,
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


// ─────────────────────────────────────────────────────────
// Constants & Catalogs
// ─────────────────────────────────────────────────────────

const GRID_SIZE_PX = 20;
const MIN_ZOOM = 0.2;
const MAX_ZOOM = 4;
const SNAP_THRESHOLD = 0.5;
const WALL_THICKNESS_DEFAULT = 0.75; // ft or m
const WALL_HEIGHT_DEFAULT = 10;
const UNDO_HISTORY_LIMIT = 50;

const ROOM_COLORS: Record<RoomType, string> = {
  'Living Room': 'rgba(251,191,36,0.18)',
  'Master Bedroom': 'rgba(147,197,253,0.22)',
  'Bedroom': 'rgba(96,165,250,0.18)',
  'Guest Room': 'rgba(165,180,252,0.18)',
  'Kids Room': 'rgba(244,114,182,0.18)',
  'Kitchen': 'rgba(52,211,153,0.18)',
  'Dining': 'rgba(251,146,60,0.18)',
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
  'Single', 'Double', 'Main Entrance', 'Sliding', 'Pocket', 'Bathroom', 'Balcony', 'French',
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
  | 'ai_draw';

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

function snapToGrid(val: number, gridSize: number = SNAP_THRESHOLD): number {
  return Math.round(val / gridSize) * gridSize;
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

function computeRoomArea(r: FloorPlanRoom, unit: FloorPlanUnit): string {
  const area = r.width * r.height;
  if (unit === 'feet') return `${area.toFixed(1)} sq.ft`;
  if (unit === 'inches') return `${(area / 144).toFixed(1)} sq.ft`;
  if (unit === 'centimeters') return `${(area / 10000).toFixed(2)} sq.m`;
  return `${area.toFixed(2)} sq.m`;
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
  const [editorState, dispatch] = useReducer(editorReducer, {
    walls: [], rooms: [], doors: [], windows: [],
    furniture: [], stairs: [], columns: [], annotations: [],
  });
  const historyRef = useRef<EditorState[]>([]);
  const historyIndexRef = useRef(-1);

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

  // AI Real-Time Sketch & Live Assist State ("user summa line draw panna athe understand panna purinjiganu")
  const [isAiLiveAssistActive, setIsAiLiveAssistActive] = useState(true);
  const [aiLiveFeedback, setAiLiveFeedback] = useState<{ message: string; timestamp: number } | null>(null);
  const [freehandPoints, setFreehandPoints] = useState<Point2D[]>([]);
  const [isFreehandDrawing, setIsFreehandDrawing] = useState(false);

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

  const toggleDockMinimized = useCallback(() => {
    setIsBottomDockMinimized(prev => {
      const next = !prev;
      localStorage.setItem('bm_fp_dock_minimized', String(next));
      return next;
    });
  }, []);

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
      return `${wallLength(w).toFixed(1)} ${unit === 'feet' ? 'ft' : 'm'} • ${Math.round(getWallAngleDeg(w))}° (${w.wallType})`;
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
    { id: 'furniture', name: 'Furniture', visible: true, locked: false, color: '#8b5a2b' },
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
  const [gridSpacingMm, setGridSpacingMm] = useState(100);
  const [snapIndicator, setSnapIndicator] = useState<(SnapPoint & { screenX: number; screenY: number }) | null>(null);
  const [liveLengthBadge, setLiveLengthBadge] = useState<{ lengthStr: string; angleDeg: number; screenX: number; screenY: number } | null>(null);

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

  // Pan state
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const panMovedRef = useRef(false);
  const touchStartRef = useRef<{ x: number; y: number; panX: number; panY: number; dist?: number } | null>(null);

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
        const initialFloors: FloorPlanLevel[] = loaded.floors && loaded.floors.length > 0
          ? loaded.floors
          : [{
              id: 'level-ground',
              name: loaded.floorName || 'Ground Floor',
              walls: loaded.walls || [],
              rooms: loaded.rooms || [],
              doors: loaded.doors || [],
              windows: loaded.windows || [],
              furniture: loaded.furniture || [],
              stairs: loaded.stairs || [],
              columns: loaded.columns || [],
              annotations: loaded.annotations || [],
            }];

        setFloorLevels(initialFloors);
        setActiveFloorIndex(0);

        const currentLvl = initialFloors[0];
        const state: EditorState = {
          walls: currentLvl.walls || [],
          rooms: currentLvl.rooms || [],
          doors: currentLvl.doors || [],
          windows: currentLvl.windows || [],
          furniture: currentLvl.furniture || [],
          stairs: currentLvl.stairs || [],
          columns: currentLvl.columns || [],
          annotations: currentLvl.annotations || [],
        };
        dispatch({ type: 'SET_STATE', payload: state });
        pushHistory(state);

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
    const idx = historyIndexRef.current + 1;
    historyRef.current = historyRef.current.slice(0, idx);
    historyRef.current.push(JSON.parse(JSON.stringify(state)));
    if (historyRef.current.length > UNDO_HISTORY_LIMIT) {
      historyRef.current.shift();
    } else {
      historyIndexRef.current = idx;
    }
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
    const vw = containerRef.current?.clientWidth || (window.innerWidth - 80);
    const vh = containerRef.current?.clientHeight || (window.innerHeight - 140);
    const geomW = bbox.width * GRID_SIZE_PX;
    const geomH = bbox.height * GRID_SIZE_PX;
    const fitZoom = Math.min(4.0, Math.max(MIN_ZOOM, Math.min((vw * 0.78) / geomW, (vh * 0.78) / geomH)));
    setZoom(+fitZoom.toFixed(2));
    setPanX(Math.round(vw / 2 - bbox.centerX * GRID_SIZE_PX * fitZoom));
    setPanY(Math.round(vh / 2 - bbox.centerY * GRID_SIZE_PX * fitZoom));
  }, [editorState, plan]);

  const dispatchWithHistory = useCallback((action: EditorAction) => {
    dispatch(action);
    const next = editorReducer(editorState, action);
    pushHistory(next);
    markUnsaved();
  }, [editorState, pushHistory, markUnsaved]);

  const handleUndo = useCallback(() => {
    if (historyIndexRef.current > 0) {
      historyIndexRef.current -= 1;
      const prev = historyRef.current[historyIndexRef.current];
      dispatch({ type: 'SET_STATE', payload: JSON.parse(JSON.stringify(prev)) });
      markUnsaved();
    }
  }, [markUnsaved]);

  const handleRedo = useCallback(() => {
    if (historyIndexRef.current < historyRef.current.length - 1) {
      historyIndexRef.current += 1;
      const next = historyRef.current[historyIndexRef.current];
      dispatch({ type: 'SET_STATE', payload: JSON.parse(JSON.stringify(next)) });
      markUnsaved();
    }
  }, [markUnsaved]);

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

  const handleSave = useCallback(async () => {
    if (!plan) return;
    setSaving(true);
    setSaveStatus('saving');
    try {
      // Sync active level into floorLevels array
      const updatedFloors = floorLevels.map((lvl, idx) => {
        if (idx === activeFloorIndex) {
          return {
            ...lvl,
            walls: editorState.walls,
            rooms: editorState.rooms,
            doors: editorState.doors,
            windows: editorState.windows,
            furniture: editorState.furniture,
            stairs: editorState.stairs,
            columns: editorState.columns,
            annotations: editorState.annotations,
          };
        }
        return lvl;
      });

      let thumbnailDataUrl: string | undefined;
      if (svgRef.current) {
        try {
          const svgData = new XMLSerializer().serializeToString(svgRef.current);
          const blob = new Blob([svgData], { type: 'image/svg+xml' });
          thumbnailDataUrl = URL.createObjectURL(blob);
        } catch { /* non-critical */ }
      }

      const res = await updateFloorPlan(user, plan.id, {
        walls: editorState.walls,
        rooms: editorState.rooms,
        doors: editorState.doors,
        windows: editorState.windows,
        furniture: editorState.furniture,
        stairs: editorState.stairs,
        columns: editorState.columns,
        annotations: editorState.annotations,
        floors: updatedFloors,
        thumbnailDataUrl,
      });

      if (res.success) {
        setSaveStatus('saved');
        setFloorLevels(updatedFloors);
        onNotify('Floor plan saved successfully!', 'success');
      } else {
        setSaveStatus('unsaved');
        onNotify(res.error || 'Save failed', 'error');
      }
    } finally {
      setSaving(false);
    }
  }, [plan, editorState, floorLevels, activeFloorIndex, user, onNotify]);

  // Debounced auto-save
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (saveStatus === 'unsaved' && plan) {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
      autoSaveTimer.current = setTimeout(() => { handleSave(); }, 3500);
    }
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
  }, [editorState, saveStatus, handleSave, plan]);

  // ── Multi-Floor Level Handlers ─────────────────────────

  const handleSwitchFloor = (newIndex: number) => {
    if (newIndex === activeFloorIndex || newIndex < 0 || newIndex >= floorLevels.length) return;
    // Save current level state into array
    const updatedFloors = floorLevels.map((lvl, idx) => {
      if (idx === activeFloorIndex) {
        return {
          ...lvl,
          walls: editorState.walls,
          rooms: editorState.rooms,
          doors: editorState.doors,
          windows: editorState.windows,
          furniture: editorState.furniture,
          stairs: editorState.stairs,
          columns: editorState.columns,
          annotations: editorState.annotations,
        };
      }
      return lvl;
    });

    setFloorLevels(updatedFloors);
    setActiveFloorIndex(newIndex);

    const target = updatedFloors[newIndex];
    const nextState: EditorState = {
      walls: target.walls || [],
      rooms: target.rooms || [],
      doors: target.doors || [],
      windows: target.windows || [],
      furniture: target.furniture || [],
      stairs: target.stairs || [],
      columns: target.columns || [],
      annotations: target.annotations || [],
    };
    dispatch({ type: 'SET_STATE', payload: nextState });
    pushHistory(nextState);
    setSelectedElement(null);
    onNotify(`Switched to ${target.name}`, 'info');
  };

  const handleAddFloor = () => {
    const floorNumber = floorLevels.length + 1;
    const name = window.prompt('Enter Floor / Level Name:', `${floorNumber === 2 ? 'First' : floorNumber === 3 ? 'Second' : `${floorNumber}th`} Floor`);
    if (!name || !name.trim()) return;

    const newLevel: FloorPlanLevel = {
      id: uid('level'),
      name: name.trim(),
      elevation: (floorLevels.length) * (plan?.ceilingHeight || 10),
      walls: [],
      rooms: [],
      doors: [],
      windows: [],
      furniture: [],
      stairs: [],
      columns: [],
      annotations: [],
    };

    const updated = [...floorLevels, newLevel];
    setFloorLevels(updated);
    handleSwitchFloor(updated.length - 1);
    markUnsaved();
    onNotify(`Created new level "${name}"`, 'success');
  };

  const handleDuplicateFloor = () => {
    const current = floorLevels[activeFloorIndex];
    const defaultName = `${current?.name || 'Floor'} (Duplicate)`;
    const name = window.prompt('Enter name for cloned floor level:', defaultName);
    if (!name || !name.trim()) return;

    const newLevel: FloorPlanLevel = {
      id: uid('level'),
      name: name.trim(),
      elevation: (floorLevels.length) * (plan?.ceilingHeight || 10),
      walls: editorState.walls.map(w => ({ ...w, id: uid('wall') })),
      rooms: editorState.rooms.map(r => ({ ...r, id: uid('room') })),
      doors: editorState.doors.map(d => ({ ...d, id: uid('door') })),
      windows: editorState.windows.map(w => ({ ...w, id: uid('win') })),
      columns: editorState.columns.map(c => ({ ...c, id: uid('col') })),
      stairs: editorState.stairs.map(s => ({ ...s, id: uid('stair') })),
      furniture: editorState.furniture.map(f => ({ ...f, id: uid('furn') })),
      annotations: editorState.annotations.map(a => ({ ...a, id: uid('annot') })),
    };

    const updated = [...floorLevels, newLevel];
    setFloorLevels(updated);
    handleSwitchFloor(updated.length - 1);
    markUnsaved();
    onNotify(`Duplicated floor layout to "${name}"`, 'success');
  };

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
      dispatchWithHistory({
        type: 'UPDATE_WALL',
        id,
        changes: {
          x1: snapToGrid(mx - newDx / 2),
          y1: snapToGrid(my - newDy / 2),
          x2: snapToGrid(mx + newDx / 2),
          y2: snapToGrid(my + newDy / 2),
        },
      });
    }
  }, [selectedElement, editorState, dispatchWithHistory]);

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
    [svgToWorld, unit, user, dispatchWithHistory, onNotify]
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
    [plan, unit, user, dispatchWithHistory, onNotify]
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
    if (type === 'wall') dispatchWithHistory({ type: 'DELETE_WALL', id });
    else if (type === 'room') dispatchWithHistory({ type: 'DELETE_ROOM', id });
    else if (type === 'door') dispatchWithHistory({ type: 'DELETE_DOOR', id });
    else if (type === 'window') dispatchWithHistory({ type: 'DELETE_WINDOW', id });
    else if (type === 'column') dispatchWithHistory({ type: 'DELETE_COLUMN', id });
    else if (type === 'stairs') dispatchWithHistory({ type: 'DELETE_STAIRS', id });
    else if (type === 'furniture') dispatchWithHistory({ type: 'DELETE_FURNITURE', id });
    else if (type === 'annotation') dispatchWithHistory({ type: 'DELETE_ANNOTATION', id });
    setSelectedElement(null);
  }, [selectedElement, getSelectedEntity, dispatchWithHistory, onNotify]);

  // ── Wall Angle Rotation Helper ────────────────────────
  const rotateWallToAngle = useCallback((wall: FloorPlanWall, targetDeg: number) => {
    const len = wallLength(wall);
    const rad = (targetDeg * Math.PI) / 180;
    const x2 = +(wall.x1 + len * Math.cos(rad)).toFixed(3);
    const y2 = +(wall.y1 + len * Math.sin(rad)).toFixed(3);
    dispatchWithHistory({ type: 'UPDATE_WALL', id: wall.id, changes: { x2, y2 } });
  }, [dispatchWithHistory]);

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

      // Ctrl + K / Cmd + K: AI Floor Plan Assistant Panel Shortcut
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setIsAiAssistantOpen(prev => !prev);
        return;
      }

      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        setIsSpacePressed(true);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); handleUndo(); }
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
      }
      if (e.key === 'v' || e.key === 'V') setActiveTool('select');
      if (e.key === 'w' || e.key === 'W') setActiveTool('wall');
      if (e.key === 'a' || e.key === 'A') setActiveTool('ai_draw');

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
    handleToggleLockSelected, handleRotateSelected
  ]);

  // ── Mouse Handlers ────────────────────────────────────

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

      if (activeTool === 'wall') {
        if (!isDrawingWall) {
          const snapPt = findSnapPoint(
            world.x, world.y, editorState.walls,
            snapToGridEnabled ? SNAP_THRESHOLD : 0, 0.75,
            snapToEndpointsEnabled, snapToWallEnabled
          );
          setWallStart({ x: snapPt.x, y: snapPt.y });
          setIsDrawingWall(true);
        } else if (wallStart) {
          let snapPt = findSnapPoint(
            world.x, world.y, editorState.walls,
            snapToGridEnabled ? SNAP_THRESHOLD : 0, 0.75,
            snapToEndpointsEnabled, snapToWallEnabled
          );
          if (e.shiftKey || isOrthoActive) {
            const ortho = snapAngleOrtho(wallStart.x, wallStart.y, snapPt.x, snapPt.y);
            snapPt = { ...snapPt, x: ortho.x, y: ortho.y };
          }

          let targetX1 = wallStart.x;
          let targetY1 = wallStart.y;
          let targetX2 = snapPt.x;
          let targetY2 = snapPt.y;

          // Real-time AI Rough Line Regularization ("user summa line draw panna athe understand panna purinjiganu")
          if (isAiLiveAssistActive) {
            const reg = regularizeRoughWall(
              { x: targetX1, y: targetY1 },
              { x: targetX2, y: targetY2 },
              editorState.walls,
              { unit, angleToleranceDeg: 14 }
            );
            targetX1 = reg.x1;
            targetY1 = reg.y1;
            targetX2 = reg.x2;
            targetY2 = reg.y2;
            if (reg.wasStraightened || reg.wasWelded) {
              triggerAiFeedback(reg.summaryMessage);
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
            const nextWalls = [...editorState.walls, newWall];
            dispatchWithHistory({
              type: 'ADD_WALL',
              payload: newWall,
            });

            // Real-Time Room Loop Recognition ("3-4 walls sernthu room anaa AI purinjikanum")
            if (isAiLiveAssistActive) {
              const rec = recognizeRoomPerimeter(nextWalls, editorState.rooms, unit);
              if (rec.detected && rec.room) {
                dispatchWithHistory({
                  type: 'ADD_ROOM',
                  payload: rec.room,
                });
                triggerAiFeedback(rec.message || `✨ AI detected Room! Created ${rec.room.label}`);
                onNotify(rec.message || `✨ AI detected Room! Created ${rec.room.label}`, 'success');
              }
            } else {
              try {
                const detectedRooms = detectEnclosedRooms(nextWalls, unit);
                if (detectedRooms.length > 0 && editorState.rooms.length === 0) {
                  const best = detectedRooms[0];
                  dispatchWithHistory({
                    type: 'ADD_ROOM',
                    payload: {
                      id: uid('room'),
                      roomType: 'Living Room',
                      label: 'Room 1',
                      x: best.x,
                      y: best.y,
                      width: best.width,
                      height: best.height,
                      rotation: 0,
                      color: ROOM_COLORS['Living Room'],
                      floorFinish: 'Wood Parquet',
                      wallThickness: wallThickness,
                      layer: 'rooms',
                    },
                  });
                  onNotify(`Enclosed room perimeter detected! Area: ${formatArea(best.area || 0, unit)}`, 'success');
                }
              } catch { /* ignore */ }
            }
          }
          setWallStart({ x: targetX2, y: targetY2 });
          setLiveLengthBadge(null);
          setSnapIndicator(null);
        }
      } else if (activeTool === 'ai_draw') {
        // Start continuous freehand sketch stroke
        setIsFreehandDrawing(true);
        setFreehandPoints([{ x: world.x, y: world.y }]);
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
        const host = findHostWallForOpening(world.x, world.y, editorState.walls, 2.5);
        const newDoorId = uid('door');
        const defaultWidth = unit === 'feet' ? (selectedDoorType === 'Double' ? 5.0 : selectedDoorType === 'Main Entrance' ? 3.5 : 3.0) : 0.9;
        dispatchWithHistory({
          type: 'ADD_DOOR',
          payload: {
            id: newDoorId,
            doorType: selectedDoorType,
            x: host ? host.projectedX : snapped.x,
            y: host ? host.projectedY : snapped.y,
            width: defaultWidth,
            rotation: host ? host.angleDeg : 0,
            swingAngle: 90,
            wallId: host ? host.wall.id : undefined,
            wallOffset: host ? host.offset : undefined,
            hostWallThickness: host ? host.wallThickness : wallThickness,
            layer: 'doors',
          },
        });
        setSelectedElement({ type: 'door', id: newDoorId });
        setActiveTool('select');
        onNotify(host ? `Placed ${selectedDoorType} Door embedded on ${host.wall.wallType} wall` : `Placed ${selectedDoorType} Door`, 'success');
      } else if (activeTool === 'window') {
        const host = findHostWallForOpening(world.x, world.y, editorState.walls, 2.5);
        const winSpec = ARCHITECTURAL_WINDOW_TYPES.find(w => w.type === selectedWindowType);
        const newWinId = uid('win');
        dispatchWithHistory({
          type: 'ADD_WINDOW',
          payload: {
            id: newWinId,
            windowType: selectedWindowType,
            x: host ? host.projectedX : snapped.x,
            y: host ? host.projectedY : snapped.y,
            width: winSpec ? winSpec.defaultWidth : (unit === 'feet' ? 4.0 : 1.2),
            height: winSpec ? winSpec.defaultHeight : (unit === 'feet' ? 4.0 : 1.2),
            sillHeight: winSpec ? winSpec.defaultSillHeight : (unit === 'feet' ? 3.0 : 0.9),
            frameThickness: winSpec ? winSpec.frameThickness : 0.18,
            rotation: host ? host.angleDeg : 0,
            wallId: host ? host.wall.id : undefined,
            wallOffset: host ? host.offset : undefined,
            hostWallThickness: host ? host.wallThickness : wallThickness,
            layer: 'windows',
          },
        });
        setSelectedElement({ type: 'window', id: newWinId });
        setActiveTool('select');
        onNotify(host ? `Placed ${selectedWindowType} embedded on ${host.wall.wallType} wall` : `Placed ${selectedWindowType}`, 'success');
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
      } else if (activeTool === 'select') {
        setSelectedElement(null);
      }
    },
    [
      activeTool, isDrawingWall, wallStart, wallThickness, resizingWall,
      selectedRoomType, selectedDoorType, selectedWindowType, columnShape,
      stairType, selectedFurnitureToPlace, svgToWorld, getSvgPos, panX, panY,
      snapToGridEnabled, snapToEndpointsEnabled, snapToWallEnabled, isOrthoActive,
      editorState.walls, editorState.rooms.length, unit, dispatchWithHistory, onNotify,
      isSpacePressed
    ]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      const svgPos = getSvgPos(e);
      const world = svgToWorld(svgPos.x, svgPos.y);

      if (resizingWall) {
        const sx = snapToGrid(world.x);
        const sy = snapToGrid(world.y);
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

      // Continuous AI Smart Freehand Sketch Tracking
      if (activeTool === 'ai_draw' && isFreehandDrawing) {
        setFreehandPoints(pts => [...pts, { x: world.x, y: world.y }]);
        return;
      }

      // Drawing wall live length and snap calculation
      if (isDrawingWall && wallStart) {
        let snapPt = findSnapPoint(
          world.x, world.y, editorState.walls,
          snapToGridEnabled ? SNAP_THRESHOLD : 0, 0.75,
          snapToEndpointsEnabled, snapToWallEnabled
        );
        if (e.shiftKey || isOrthoActive) {
          const ortho = snapAngleOrtho(wallStart.x, wallStart.y, snapPt.x, snapPt.y);
          snapPt = { ...snapPt, x: ortho.x, y: ortho.y };
        }
        const len = Math.hypot(snapPt.x - wallStart.x, snapPt.y - wallStart.y);
        let angle = (Math.atan2(snapPt.y - wallStart.y, snapPt.x - wallStart.x) * 180) / Math.PI;
        if (angle < 0) angle += 360;

        setLiveLengthBadge({
          lengthStr: formatLength(len, unit),
          angleDeg: Math.round(angle),
          screenX: svgPos.x + 18,
          screenY: svgPos.y - 18,
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
        const snappedDx = snapToGrid(dx);
        const snappedDy = snapToGrid(dy);

        const { type, id } = selectedElement;
        if (type === 'wall') {
          const snap = dragElementSnapshot as FloorPlanWall;
          dispatch({
            type: 'UPDATE_WALL', id,
            changes: {
              x1: snapToGrid(snap.x1 + snappedDx),
              y1: snapToGrid(snap.y1 + snappedDy),
              x2: snapToGrid(snap.x2 + snappedDx),
              y2: snapToGrid(snap.y2 + snappedDy),
            },
          });
        } else if (type === 'room') {
          const snap = dragElementSnapshot as FloorPlanRoom;
          dispatch({
            type: 'UPDATE_ROOM', id,
            changes: { x: snapToGrid(snap.x + snappedDx), y: snapToGrid(snap.y + snappedDy) },
          });
        } else if (type === 'door' || type === 'window') {
          // Snap hosted door/window along nearest wall
          const hostProj = projectPointOntoWall(world.x, world.y, editorState.walls, 1.2);
          if (hostProj) {
            if (type === 'door') {
              dispatch({
                type: 'UPDATE_DOOR', id,
                changes: { x: hostProj.projectedX, y: hostProj.projectedY, rotation: Math.round(hostProj.angleDeg), wallId: hostProj.wall.id }
              });
            } else {
              dispatch({
                type: 'UPDATE_WINDOW', id,
                changes: { x: hostProj.projectedX, y: hostProj.projectedY, rotation: Math.round(hostProj.angleDeg), wallId: hostProj.wall.id }
              });
            }
          } else {
            const snap = dragElementSnapshot;
            if (type === 'door') {
              dispatch({ type: 'UPDATE_DOOR', id, changes: { x: snapToGrid(snap.x + snappedDx), y: snapToGrid(snap.y + snappedDy) } });
            } else {
              dispatch({ type: 'UPDATE_WINDOW', id, changes: { x: snapToGrid(snap.x + snappedDx), y: snapToGrid(snap.y + snappedDy) } });
            }
          }
        } else if (type === 'column') {
          const snap = dragElementSnapshot as FloorPlanColumn;
          dispatch({
            type: 'UPDATE_COLUMN', id,
            changes: { x: snapToGrid(snap.x + snappedDx), y: snapToGrid(snap.y + snappedDy) },
          });
        } else if (type === 'stairs') {
          const snap = dragElementSnapshot as FloorPlanStaircase;
          dispatch({
            type: 'UPDATE_STAIRS', id,
            changes: { x: snapToGrid(snap.x + snappedDx), y: snapToGrid(snap.y + snappedDy) },
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
            changes: { x: snapToGrid(snap.x + snappedDx), y: snapToGrid(snap.y + snappedDy) },
          });
        } else if (type === 'annotation') {
          const snap = dragElementSnapshot as FloorPlanAnnotation;
          dispatch({
            type: 'UPDATE_ANNOTATION', id,
            changes: { x: snapToGrid(snap.x + snappedDx), y: snapToGrid(snap.y + snappedDy) },
          });
        }
        return;
      }

      setCurrentMousePos({ x: snapToGrid(world.x), y: snapToGrid(world.y) });
    },
    [
      resizingWall, isPanning, panStart, isDrawingWall, wallStart, isDragging, dragStartPos,
      dragElementSnapshot, selectedElement, svgToWorld, getSvgPos, snapToGridEnabled,
      snapToEndpointsEnabled, snapToWallEnabled, isOrthoActive, editorState.walls, unit, zoom, panX, panY
    ]
  );

  const handleMouseUp = useCallback(() => {
    setLiveLengthBadge(null);
    setSnapIndicator(null);

    // AI Intelligent Sketch Interpretation & Classification Engine
    if (activeTool === 'ai_draw' && isFreehandDrawing) {
      setIsFreehandDrawing(false);
      if (freehandPoints.length >= 2) {
        // Run intelligent multi-layer geometry classifier (classifyDrawingStroke & classifySketchStroke)
        const strokeResult = classifyDrawingStroke(freehandPoints, editorState.walls, editorState.rooms, unit);

        // Confidence Rules:
        // 90-100%: Safe automatic interpretation when geometry rules also agree
        // 70-89%: Ask user for confirmation
        // Below 70%: Ask user, do NOT automatically modify the drawing
        if (strokeResult.confidence >= 0.90 && !strokeResult.requiresConfirmation) {
          executeValidatedAction(strokeResult.suggestedAction);
          triggerAiFeedback(`${strokeResult.label} detected — converted`);
          onNotify(`${strokeResult.label} detected — converted`, 'success');

          // Check if this action closed a room loop
          if (strokeResult.classification === 'wall') {
            const nextWalls = [...editorState.walls, strokeResult.suggestedAction.payload];
            const rec = recognizeRoomPerimeter(nextWalls, editorState.rooms, unit);
            if (rec.detected && rec.room) {
              dispatchWithHistory({
                type: 'ADD_ROOM',
                payload: rec.room,
              });
              triggerAiFeedback(rec.message || `✨ AI detected and created ${rec.room.label}!`);
              onNotify(rec.message || `✨ AI detected and created ${rec.room.label}!`, 'success');
            }
          }
        } else if (strokeResult.confidence >= 0.70) {
          // 70–89%: Ask user for confirmation without breaking canvas
          setPendingClassification(strokeResult);
          setIsAiAssistantOpen(true);
          triggerAiFeedback(`Looks like a ${strokeResult.label}. Confirm in Assistant.`);
        } else {
          // Below 70%: Do NOT guess blindly. Ask user!
          setPendingClassification(strokeResult);
          setIsAiAssistantOpen(true);
          triggerAiFeedback("I found a possible shape, but I'm not completely sure. What should this be?");
        }
      }
      setFreehandPoints([]);
      return;
    }

    if (resizingWall) {
      pushHistory(editorState);
      markUnsaved();
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
      pushHistory(editorState);
      markUnsaved();
      setIsDragging(false);
      setDragStartPos(null);
      setDragElementSnapshot(null);
    }
  }, [
    resizingWall, isPanning, isDragging, selectedElement, editorState, pushHistory, markUnsaved,
    activeTool, isFreehandDrawing, freehandPoints, unit, dispatchWithHistory, onNotify, triggerAiFeedback,
    executeValidatedAction, setPendingClassification, setIsAiAssistantOpen
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

  const handleTouchStart = useCallback(
    (e: React.TouchEvent<SVGSVGElement>) => {
      if (e.touches.length === 1) {
        const t = e.touches[0];
        const svgRect = svgRef.current?.getBoundingClientRect();
        if (!svgRect) return;
        touchStartRef.current = {
          x: t.clientX - svgRect.left,
          y: t.clientY - svgRect.top,
          panX,
          panY,
        };
        setIsPanning(true);
      } else if (e.touches.length === 2) {
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
      }
    },
    [panX, panY]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent<SVGSVGElement>) => {
      if (!touchStartRef.current) return;
      if (e.touches.length === 1) {
        const t = e.touches[0];
        const svgRect = svgRef.current?.getBoundingClientRect();
        if (!svgRect) return;
        const curX = t.clientX - svgRect.left;
        const curY = t.clientY - svgRect.top;
        const dx = curX - touchStartRef.current.x;
        const dy = curY - touchStartRef.current.y;
        setPanX(touchStartRef.current.panX + dx);
        setPanY(touchStartRef.current.panY + dy);
      } else if (e.touches.length === 2 && touchStartRef.current.dist) {
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
        const factor = dist / touchStartRef.current.dist;
        const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom * factor));
        setZoom(newZoom);
      }
    },
    [zoom]
  );

  const handleTouchEnd = useCallback(() => {
    touchStartRef.current = null;
    setIsPanning(false);
  }, []);

  // ── Element Selection MouseDown ───────────────────────

  const handleElementMouseDown = useCallback(
    (
      e: React.MouseEvent,
      type: 'wall' | 'room' | 'door' | 'window' | 'column' | 'stairs' | 'furniture' | 'annotation',
      id: string
    ) => {
      if (activeTool !== 'select') return;
      e.stopPropagation();
      setSelectedElement({ type, id });
      const svgPos = getSvgPos(e as unknown as React.MouseEvent<SVGSVGElement>);
      setDragStartPos(svgPos);
      setIsDragging(true);

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
        return;
      }

      setDragElementSnapshot(snapshot ? JSON.parse(JSON.stringify(snapshot)) : null);
    },
    [activeTool, getSvgPos, editorState]
  );

  // ── Metric Computations ───────────────────────────────

  const totalFloorArea = editorState.rooms.reduce((s, r) => s + r.width * r.height, 0);
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

  const handleExportPNG = useCallback(() => {
    if (!svgRef.current) return;
    const svgData = new XMLSerializer().serializeToString(svgRef.current);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    const canvas = document.createElement('canvas');
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = viewMode === 'blueprint' ? '#0f172a' : '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      const link = document.createElement('a');
      link.download = `${plan?.buildingName || 'floor-plan'}-${floorLevels[activeFloorIndex]?.name || 'level'}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    };
    img.src = url;
  }, [plan, viewMode, floorLevels, activeFloorIndex]);

  const handleExportPDF = useCallback(() => {
    if (!svgRef.current || !plan) return;
    const svgClone = svgRef.current.cloneNode(true) as SVGSVGElement;
    const svgWidth = Math.max(850, plan.plotLength * GRID_SIZE_PX * zoom + 140);
    const svgHeight = Math.max(650, plan.plotWidth * GRID_SIZE_PX * zoom + 140);
    svgClone.setAttribute('width', `${svgWidth}`);
    svgClone.setAttribute('height', `${svgHeight}`);

    const svgData = new XMLSerializer().serializeToString(svgClone);

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
            <h1>BUILDING MISTRY CAD</h1>
            <p>Architectural Floor Plan & Engineering Drawing</p>
            <p><strong>Project:</strong> ${plan.buildingName} ${plan.siteName ? `| <strong>Site:</strong> ${plan.siteName}` : ''}</p>
          </div>
          <div class="meta-grid">
            <div><strong>Drawing Level:</strong> ${floorLevels[activeFloorIndex]?.name || plan.floorName}</div>
            <div><strong>Scale:</strong> 1:${Math.round(1 / zoom * 20)}</div>
            <div><strong>Plot Size:</strong> ${plan.plotLength} × ${plan.plotWidth} ${unit}</div>
            <div><strong>Date:</strong> ${new Date().toLocaleDateString('en-IN')}</div>
            <div><strong>Total Carpet Area:</strong> ${totalFloorArea.toFixed(1)} ${unit === 'feet' ? 'sq.ft' : 'sq.m'}</div>
            <div><strong>Status:</strong> ${plan.status || 'Active CAD Drawing'}</div>
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
                <th>Carpet Area</th>
              </tr>
            </thead>
            <tbody>
              ${roomRows}
              <tr style="background: #f1f5f9; font-weight: 700;">
                <td colspan="3" style="padding: 6px 12px; border: 1px solid #cbd5e1; text-align: right;">Total Floor Area:</td>
                <td style="padding: 6px 12px; border: 1px solid #cbd5e1; color: #0284c7;">
                  ${totalFloorArea.toFixed(1)} ${unit === 'feet' ? 'sq.ft' : 'sq.m'}
                </td>
              </tr>
            </tbody>
          </table>
        ` : ''}

        <div class="footer-note">
          <span>* Generated by Building Mistry CAD Suite. Verify all dimensions on site prior to construction.</span>
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
  }, [plan, zoom, editorState.rooms, floorLevels, activeFloorIndex, totalFloorArea, unit]);

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
      const jsonContent = exportFloorPlanAsProjectJson(plan, floorLevels, activeFloorIndex);
      const blob = new Blob([jsonContent], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `${plan.buildingName || 'floor-plan'}-project.json`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
      onNotify('Project JSON backup exported successfully!', 'success');
    } catch (err: any) {
      onNotify(`Failed to export Project JSON: ${err.message}`, 'error');
    }
  }, [plan, floorLevels, activeFloorIndex, onNotify]);

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

  return (
    <div className={`fp-editor-root ${viewMode === 'blueprint' ? 'fp-blueprint-mode' : viewMode === 'presentation' ? 'fp-presentation-mode' : ''}`}>
      {/* ── Editor Header ─────────────────────────────── */}
      <div className="fp-editor-header no-print">
        <div className="fp-editor-header-left">
          {plan.siteId && onBackToSite ? (
            <button
              type="button"
              className="fp-editor-back-btn"
              onClick={() => onBackToSite(plan.siteId!)}
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
              onClick={onBack}
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

          {/* Floor Level Switcher */}
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
              title="Design CAD View"
            >
              Design
            </button>
            <button
              type="button"
              className={`fp-view-mode-btn ${viewMode === 'blueprint' ? 'active' : ''}`}
              onClick={() => setViewMode('blueprint')}
              title="Blueprint CAD View"
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

          {/* 3D Preview */}
          <button
            type="button"
            className="fp-tool-btn"
            onClick={() => setShow3D(true)}
            title="3D Architectural Preview"
            id="fp-3d-btn"
          >
            <Box size={18} />
            <span className="fp-tool-btn-label">3D</span>
          </button>

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
            onClick={() => setIsAiAssistantOpen(prev => !prev)}
            title="✨ AI Floor Plan Assistant (Ctrl + K)"
            id="fp-copilot-btn"
            data-testid="fp-ai-assistant-btn"
          >
            <Sparkles size={16} className="animate-pulse text-amber-300" />
            <span>✨ AI Assistant</span>
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
              title="Export CAD Drawings"
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
                  <FileCode size={16} color="#38bdf8" />
                  <span>AutoCAD DXF (.dxf)</span>
                </button>
                <button
                  type="button"
                  className="fp-more-item"
                  onClick={() => { setShowExportMenu(false); handleExportProjectJSON(); }}
                  id="fp-export-json-btn"
                >
                  <FileDown size={16} color="#34d399" />
                  <span>Project CAD JSON (.json)</span>
                </button>
                <button
                  type="button"
                  className="fp-more-item"
                  onClick={() => { setShowExportMenu(false); handleExportPDF(); }}
                  id="fp-export-pdf-btn"
                >
                  <FileDown size={16} color="#f59e0b" />
                  <span>Architectural PDF Sheet</span>
                </button>
                <button
                  type="button"
                  className="fp-more-item"
                  onClick={() => { setShowExportMenu(false); handleExportPNG(); }}
                  id="fp-export-png-btn"
                >
                  <Download size={16} color="#a78bfa" />
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
            title="CAD Layers Panel"
            id="fp-layers-toggle-btn"
          >
            <Layers size={18} />
            <span className="fp-tool-btn-label">Layers</span>
          </button>

          {/* CAD Settings */}
          <button
            type="button"
            className="fp-tool-btn"
            onClick={() => setShowSettingsModal(true)}
            title="CAD & Snapping Settings"
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
                  <Sparkles size={16} color="#f59e0b" /> Load 30x40 Sample Plan
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

      {/* ── Tool Palette ──────────────────────────────── */}
      <div className="fp-toolbar no-print">
        {/* Select / Move */}
        <button
          type="button"
          className={`fp-tool-palette-btn ${activeTool === 'select' ? 'active' : ''}`}
          onClick={() => { setActiveTool('select'); setIsDrawingWall(false); setWallStart(null); }}
          title="Select / Move (V)"
          id="fp-tool-select"
        >
          <MousePointer2 size={20} />
          <span>Select</span>
        </button>

        {/* Pan / Hand */}
        <button
          type="button"
          className={`fp-tool-palette-btn ${activeTool === 'pan' ? 'active' : ''}`}
          onClick={() => {
            setActiveTool('pan');
            setIsDrawingWall(false);
            setWallStart(null);
            setSelectedElement(null);
          }}
          title="Pan Blueprint Canvas (H / Hold Space + Drag / Right-Click Drag)"
          id="fp-tool-pan"
        >
          <Hand size={20} />
          <span>Pan</span>
        </button>

        {/* Wall */}
        <button
          type="button"
          className={`fp-tool-palette-btn ${activeTool === 'wall' ? 'active' : ''}`}
          onClick={() => { setActiveTool('wall'); setSelectedElement(null); }}
          title="Draw Wall (W)"
          id="fp-tool-wall"
        >
          <Pencil size={20} />
          <span>Wall</span>
        </button>

        {/* Door */}
        <div className="fp-tool-palette-group">
          <button
            type="button"
            className={`fp-tool-palette-btn ${activeTool === 'door' ? 'active' : ''}`}
            onClick={() => { setActiveTool('door'); setSelectedElement(null); }}
            title="Place Door (D)"
            id="fp-tool-door"
          >
            <DoorOpen size={20} />
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

        {/* Window */}
        <div className="fp-tool-palette-group">
          <button
            type="button"
            className={`fp-tool-palette-btn ${activeTool === 'window' ? 'active' : ''}`}
            onClick={() => { setActiveTool('window'); setSelectedElement(null); }}
            title="Place Window"
            id="fp-tool-window"
          >
            <AppWindow size={20} />
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

        {/* Room */}
        <div className="fp-tool-palette-group">
          <button
            type="button"
            className={`fp-tool-palette-btn ${activeTool === 'room' ? 'active' : ''}`}
            onClick={() => { setActiveTool('room'); setSelectedElement(null); }}
            title="Place Room (R)"
            id="fp-tool-room"
          >
            <Square size={20} />
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

        {/* Column / Pillar */}
        <div className="fp-tool-palette-group">
          <button
            type="button"
            className={`fp-tool-palette-btn ${activeTool === 'column' ? 'active' : ''}`}
            onClick={() => { setActiveTool('column'); setSelectedElement(null); }}
            title="Place Structural Column"
            id="fp-tool-column"
          >
            <Columns size={20} />
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

        {/* Stairs */}
        <div className="fp-tool-palette-group">
          <button
            type="button"
            className={`fp-tool-palette-btn ${activeTool === 'stairs' ? 'active' : ''}`}
            onClick={() => { setActiveTool('stairs'); setSelectedElement(null); }}
            title="Place Staircase"
            id="fp-tool-stairs"
          >
            <Split size={20} />
            <span>Stairs</span>
          </button>
          {activeTool === 'stairs' && (
            <select
              value={stairType}
              onChange={e => setStairType(e.target.value as any)}
              className="fp-tool-select"
            >
              <option value="straight">Straight Flight</option>
              <option value="l-shape">L-Shape / Quarter Turn</option>
              <option value="u-shape">U-Shape / Dog Legged</option>
              <option value="spiral">Spiral</option>
            </select>
          )}
        </div>

        {/* Furniture Library */}
        <button
          type="button"
          className={`fp-tool-palette-btn ${activeTool === 'furniture' ? 'active' : ''}`}
          onClick={() => setShowFurnitureModal(true)}
          title="Open Furniture & Symbols Library"
          id="fp-tool-furniture"
        >
          <Armchair size={20} />
          <span>Furniture</span>
        </button>

        {/* Dimensions */}
        <button
          type="button"
          className={`fp-tool-palette-btn ${showDimensions ? 'active' : ''}`}
          onClick={() => setShowDimensions(d => !d)}
          title="Toggle CAD Dimensions (M)"
          id="fp-tool-dimension"
        >
          <Ruler size={20} />
          <span>Dimension</span>
        </button>

        {/* Text Annotation */}
        <button
          type="button"
          className={`fp-tool-palette-btn ${activeTool === 'annotation' ? 'active' : ''}`}
          onClick={() => { setActiveTool('annotation'); setSelectedElement(null); }}
          title="Place Text Note / Callout"
        >
          <PenTool size={20} />
          <span>Note</span>
        </button>

        {/* Delete button */}
        {selectedElement && (
          <button
            type="button"
            className="fp-tool-palette-btn fp-tool-danger"
            onClick={handleDeleteSelected}
            title="Delete selected element (Del)"
            id="fp-delete-selected-btn"
          >
            <Trash2 size={20} />
            <span>Delete</span>
          </button>
        )}

        {/* Shape Library Toggle */}
        <button
          type="button"
          className={`fp-tool-palette-btn ${isShapeLibraryOpen ? 'active' : ''}`}
          onClick={() => setIsShapeLibraryOpen(o => !o)}
          title="Toggle Shape Library Panel"
          id="fp-tool-shape-library"
        >
          <Layers size={20} />
          <span>Library</span>
        </button>

        {/* AI Natural Draw Mode ("user summa line draw panna athe understand panna purinjiganu") */}
        <button
          type="button"
          className={`fp-tool-palette-btn fp-tool-smart-pen ${activeTool === 'ai_draw' ? 'active' : ''}`}
          onClick={() => {
            setActiveTool('ai_draw');
            setSelectedElement(null);
            triggerAiFeedback('✨ AI Draw Mode Active: Draw roughly — AI detects walls, rooms, doors & windows!');
          }}
          title="✨ AI Draw Mode: Draw freely without picking Wall/Door first. AI interprets with confidence scoring."
          id="fp-tool-smart-draw"
          data-testid="fp-tool-ai-draw"
        >
          <PenTool size={20} className="text-amber-400" />
          <span style={{ fontWeight: 800 }}>✨ AI Draw</span>
        </button>

        {/* AI Assistant in Left Tool Palette */}
        <button
          type="button"
          className="fp-tool-palette-btn fp-tool-copilot"
          onClick={() => setIsAiAssistantOpen(prev => !prev)}
          title="✨ AI Floor Plan Assistant Panel (Ctrl + K)"
          id="fp-tool-copilot-palette"
          style={{
            background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.28), rgba(245, 158, 11, 0.2))',
            border: '1.5px solid #8b5cf6',
          }}
        >
          <Sparkles size={20} color="#fbbf24" className="animate-pulse" />
          <span style={{ color: '#fbbf24', fontWeight: 800 }}>✨ AI Assist</span>
        </button>


        <div className="fp-toolbar-divider" />

        {/* Wall Thickness Input */}
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

        {/* Toggle Grid */}
        <button
          type="button"
          className={`fp-tool-palette-btn ${showGrid ? 'active' : ''}`}
          onClick={() => setShowGrid(g => !g)}
          title="Toggle Grid"
        >
          <Layers size={20} />
          <span>Grid</span>
        </button>
      </div>

      {/* ── Main Workspace: Shape Library + Canvas ────── */}
      <div className="fp-canvas-workspace">
        <FloorPlanShapeLibrary
          user={user}
          unit={unit}
          isOpen={isShapeLibraryOpen}
          onToggleOpen={() => setIsShapeLibraryOpen(o => !o)}
          onSelectShape={handleSelectShapeFromLibrary}
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
          }}
        >
          {/* Floating Canvas AI Copilot Pill */}
          <button
            type="button"
            className="fp-canvas-floating-copilot"
            onClick={() => setIsCopilotOpen(true)}
            title="Open AI Floor Plan Copilot (Straighten zig-zags & weld gaps)"
            id="fp-canvas-floating-copilot-btn"
          >
            <Sparkles size={16} color="#fbbf24" />
            <span>AI Copilot</span>
            {(geometryReport.zigzagCount > 0 || geometryReport.openGapCount > 0) && (
              <span className="fp-copilot-floating-badge">
                {geometryReport.zigzagCount + geometryReport.openGapCount} Fixes
              </span>
            )}
          </button>

          {/* ── AI Real-Time Live Assist Canvas HUD ("user summa line draw panna athe understand panna purinjiganu") ── */}
          <div className="fp-ai-live-hud" id="fp-ai-live-hud">
            <div className={`fp-ai-hud-indicator ${isAiLiveAssistActive ? 'active' : 'inactive'}`} />
            <button
              type="button"
              className="fp-ai-hud-toggle"
              onClick={() => setIsAiLiveAssistActive(a => !a)}
              title="Toggle AI Real-Time Sketch & Drawing Understanding"
            >
              <Sparkles size={14} color={isAiLiveAssistActive ? '#fbbf24' : '#94a3b8'} />
              <span>AI Live Assist: {isAiLiveAssistActive ? 'ON' : 'OFF'}</span>
            </button>
          </div>

          {/* Real-Time AI Understanding Feedback Toast */}
          {aiLiveFeedback && (
            <div className="fp-ai-feedback-toast" role="status" aria-live="polite">
              <Sparkles size={16} color="#fbbf24" />
              <span>{aiLiveFeedback.message}</span>
            </div>
          )}

          <svg
            ref={svgRef}
            className="fp-canvas-svg"
            width="100%"
            height="100%"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onContextMenu={e => e.preventDefault()}
            onDragOver={e => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'copy';
            }}
            onDrop={handleCanvasDrop}
            style={{ display: 'block', touchAction: 'none' }}
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

            {/* Planner 5D Wood Flooring Parquet Pattern */}
            <pattern
              id="fp-wood-parquet"
              width={48 * zoom}
              height={48 * zoom}
              patternUnits="userSpaceOnUse"
              patternTransform={`translate(${panX % (48 * zoom)}, ${panY % (48 * zoom)})`}
            >
              <rect width={48 * zoom} height={48 * zoom} fill="#dfbe98" />
              <path
                d={`M 0 0 L ${48*zoom} 0 M 0 ${24*zoom} L ${48*zoom} ${24*zoom} M ${24*zoom} 0 L ${24*zoom} ${24*zoom} M 0 ${48*zoom} L ${48*zoom} ${48*zoom} M ${12*zoom} ${24*zoom} L ${12*zoom} ${48*zoom} M ${36*zoom} ${24*zoom} L ${36*zoom} ${48*zoom}`}
                stroke="#af8a64"
                strokeWidth={1}
                fill="none"
                opacity={0.85}
              />
              <path
                d={`M 2 ${8*zoom} L ${22*zoom} ${8*zoom} M 2 ${16*zoom} L ${22*zoom} ${16*zoom} M ${26*zoom} ${32*zoom} L ${46*zoom} ${32*zoom} M ${26*zoom} ${40*zoom} L ${46*zoom} ${40*zoom}`}
                stroke="#c49e75"
                strokeWidth={0.6}
                strokeDasharray={`${4*zoom},${3*zoom}`}
                fill="none"
                opacity={0.5}
              />
            </pattern>

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
          </defs>

          {showGrid && (
            <>
              <rect width="100%" height="100%" fill="url(#fp-grid-pattern)" />
              <rect width="100%" height="100%" fill="url(#fp-major-grid)" />
            </>
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
            const isWoodFloor = room.floorFinish !== 'Color Tint';
            const wallThickPx = Math.max(7, Math.min(14, (room.wallThickness || 0.75) * 8 * zoom));

            return (
              <g
                key={room.id}
                onMouseDown={e => handleElementMouseDown(e, 'room', room.id)}
                style={{ cursor: activeTool === 'select' ? 'move' : undefined }}
              >
                {/* 1. Floor Finish (Wood Parquet or Plain Color Tint) */}
                <rect
                  x={rx}
                  y={ry}
                  width={rw}
                  height={rh}
                  fill={isWoodFloor ? 'url(#fp-wood-parquet)' : (room.color || ROOM_COLORS[room.roomType] || 'rgba(251,191,36,0.18)')}
                  rx={2 * zoom}
                />
                {/* Subtle room tint overlay on top of wood floor */}
                {isWoodFloor && (
                  <rect
                    x={rx}
                    y={ry}
                    width={rw}
                    height={rh}
                    fill={room.color || 'rgba(217, 119, 6, 0.08)'}
                    rx={2 * zoom}
                    style={{ pointerEvents: 'none' }}
                  />
                )}

                {/* 2. Planner 5D Perimeter Wall Border */}
                <rect
                  x={rx}
                  y={ry}
                  width={rw}
                  height={rh}
                  fill="none"
                  stroke={isSelected ? '#059669' : (viewMode === 'blueprint' ? '#93c5fd' : '#10b981')}
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
                    stroke="#38bdf8"
                    strokeWidth={2 * zoom}
                    strokeDasharray={`${6 * zoom},${4 * zoom}`}
                    rx={4 * zoom}
                    style={{ pointerEvents: 'none' }}
                  />
                )}

                {/* On-Canvas Rotation Knob & Stalk */}
                {isSelected && !room.locked && (
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
                    fill="rgba(15, 23, 42, 0.86)"
                    stroke="rgba(255, 255, 255, 0.16)"
                    strokeWidth={1}
                  />
                  <text
                    x={rx + rw / 2}
                    y={ry + rh / 2 + 4 * zoom}
                    textAnchor="middle"
                    fontSize={Math.max(8.5, 10.5 * zoom)}
                    fill="#f8fafc"
                    fontFamily="'Outfit', sans-serif"
                    fontWeight="700"
                  >
                    {room.label} ({computeRoomArea(room, unit)})
                  </text>
                </g>

                {/* 4. Planner 5D Exterior Dimension Lines & Arrows */}
                {(showDimensions || isSelected) && (
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
                        fill="rgba(15, 23, 42, 0.92)"
                        stroke="rgba(16, 185, 129, 0.45)"
                        strokeWidth={1}
                      />
                      <text
                        x={rx + rw / 2}
                        y={ry - 16 * zoom}
                        textAnchor="middle"
                        fontSize={Math.max(8, 10 * zoom)}
                        fill="#f8fafc"
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
                          fill="rgba(15, 23, 42, 0.92)"
                          stroke="rgba(16, 185, 129, 0.45)"
                          strokeWidth={1}
                        />
                        <text
                          x={rx - 18 * zoom}
                          y={ry + rh / 2 + 2 * zoom}
                          textAnchor="middle"
                          fontSize={Math.max(8, 10 * zoom)}
                          fill="#f8fafc"
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
                onMouseDown={e => handleElementMouseDown(e, 'stairs', stair.id)}
                style={{ cursor: activeTool === 'select' ? 'move' : undefined }}
              >
                <rect
                  x={sx} y={sy} width={sw} height={sl}
                  fill={viewMode === 'blueprint' ? 'rgba(234,179,8,0.1)' : 'rgba(254,243,199,0.4)'}
                  stroke={isSelected ? '#f59e0b' : viewMode === 'blueprint' ? '#fde047' : '#d97706'}
                  strokeWidth={2 * zoom}
                />
                {/* Steps lines */}
                {Array.from({ length: steps }).map((_, i) => {
                  const stepY = sy + (i * sl) / steps;
                  return (
                    <line
                      key={i}
                      x1={sx} y1={stepY} x2={sx + sw} y2={stepY}
                      stroke={viewMode === 'blueprint' ? '#fde047' : '#d97706'}
                      strokeWidth={1 * zoom}
                    />
                  );
                })}
                {/* Up/Down arrow */}
                <line
                  x1={sx + sw / 2} y1={sy + sl - 6 * zoom}
                  x2={sx + sw / 2} y2={sy + 10 * zoom}
                  stroke="#b45309" strokeWidth={2 * zoom}
                />
                <polygon
                  points={`${sx + sw / 2},${sy + 4 * zoom} ${sx + sw / 2 - 4 * zoom},${sy + 12 * zoom} ${sx + sw / 2 + 4 * zoom},${sy + 12 * zoom}`}
                  fill="#b45309"
                />
                <text
                  x={sx + sw / 2} y={sy + sl / 2} textAnchor="middle"
                  fontSize={8 * zoom} fill="#b45309" fontWeight="700"
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
                onMouseDown={e => handleElementMouseDown(e, 'furniture', furn.id)}
                style={{ cursor: activeTool === 'select' ? 'move' : undefined }}
              >
                {isSelected && (
                  <rect
                    x={fx - 4 * zoom} y={fy - 4 * zoom}
                    width={fw + 8 * zoom} height={fh + 8 * zoom}
                    fill="none" stroke="#f59e0b" strokeWidth={2 * zoom}
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
                onMouseDown={e => handleElementMouseDown(e, 'column', col.id)}
                style={{ cursor: activeTool === 'select' ? 'move' : undefined }}
              >
                {col.shape === 'round' ? (
                  <circle
                    cx={cx} cy={cy} r={cw / 2}
                    fill={isSelected ? '#f59e0b' : viewMode === 'blueprint' ? '#38bdf8' : '#334155'}
                    stroke="#ffffff" strokeWidth={1 * zoom}
                  />
                ) : (
                  <>
                    <rect
                      x={cx - cw / 2} y={cy - cd / 2} width={cw} height={cd}
                      fill={isSelected ? '#f59e0b' : viewMode === 'blueprint' ? '#1e40af' : '#1e293b'}
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
            const len = wallLength(wall);
            const mx = (wall.x1 + wall.x2) / 2;
            const my = (wall.y1 + wall.y2) / 2;
            const angle = Math.atan2(wall.y2 - wall.y1, wall.x2 - wall.x1) * 180 / Math.PI;

            // Compute solid wall segments and door openings along this wall
            const { solidSegments, openings } = computeWallSegmentsWithOpenings(
              wall,
              editorState.doors,
              editorState.windows
            );

            const wallFillColor = isSelected
              ? '#f59e0b'
              : viewMode === 'blueprint'
              ? (wall.wallType === 'exterior' ? '#93c5fd' : '#bfdbfe')
              : (wall.wallType === 'exterior' ? '#0f172a' : wall.wallType === 'partition' ? '#475569' : '#1e293b');

            const wallBorderColor = isSelected
              ? '#fbbf24'
              : viewMode === 'blueprint'
              ? '#60a5fa'
              : '#020617';

            return (
              <g
                key={wall.id}
                onMouseDown={e => handleElementMouseDown(e, 'wall', wall.id)}
                style={{ cursor: activeTool === 'select' ? 'move' : undefined }}
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

                {/* Dimension label */}
                {showDimensions && isLayerVisible('dimensions') && len > 0.5 && (
                  <text
                    x={mx * GRID_SIZE_PX * zoom + panX}
                    y={my * GRID_SIZE_PX * zoom + panY - strokeW / 2 - 5 * zoom}
                    textAnchor="middle"
                    fontSize={Math.max(8, 10 * zoom)}
                    fill={viewMode === 'blueprint' ? '#93c5fd' : '#334155'}
                    fontFamily="'Outfit', sans-serif"
                    fontWeight="700"
                    transform={`rotate(${angle > 90 || angle < -90 ? angle + 180 : angle}, ${mx * GRID_SIZE_PX * zoom + panX}, ${my * GRID_SIZE_PX * zoom + panY})`}
                    style={{ pointerEvents: 'none' }}
                  >
                    {formatDim(len, unit)}
                  </text>
                )}

                {/* Wall Endpoints / Resize Handles */}
                {isSelected ? (
                  <>
                    <circle
                      cx={wall.x1 * GRID_SIZE_PX * zoom + panX}
                      cy={wall.y1 * GRID_SIZE_PX * zoom + panY}
                      r={7 * zoom}
                      fill="#f59e0b"
                      stroke="#ffffff"
                      strokeWidth={2 * zoom}
                      style={{ cursor: 'crosshair' }}
                      onMouseDown={e => { e.stopPropagation(); setResizingWall({ id: wall.id, endpoint: 1 }); }}
                    />
                    <circle
                      cx={wall.x2 * GRID_SIZE_PX * zoom + panX}
                      cy={wall.y2 * GRID_SIZE_PX * zoom + panY}
                      r={7 * zoom}
                      fill="#f59e0b"
                      stroke="#ffffff"
                      strokeWidth={2 * zoom}
                      style={{ cursor: 'crosshair' }}
                      onMouseDown={e => { e.stopPropagation(); setResizingWall({ id: wall.id, endpoint: 2 }); }}
                    />
                  </>
                ) : (
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
                onMouseDown={e => handleElementMouseDown(e, 'door', door.id)}
                style={{ cursor: activeTool === 'select' ? 'move' : undefined }}
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
                  fill={isSelected ? '#f59e0b' : '#b45309'}
                  stroke={isSelected ? '#fbbf24' : '#78350f'}
                  strokeWidth={1}
                />
                <rect
                  x={dx + dw / 2 - 2 * zoom}
                  y={dy - wallThickPx / 2}
                  width={4 * zoom}
                  height={wallThickPx}
                  fill={isSelected ? '#f59e0b' : '#b45309'}
                  stroke={isSelected ? '#fbbf24' : '#78350f'}
                  strokeWidth={1}
                />

                {/* Door Leaf (Solid wood panel pivoted at opening) */}
                <g transform={`scale(${flipH}, ${flipV})`}>
                  <rect
                    x={dx - dw / 2}
                    y={dy - dw}
                    width={3.5 * zoom}
                    height={dw}
                    fill={isSelected ? '#f59e0b' : viewMode === 'blueprint' ? '#93c5fd' : '#f8fafc'}
                    stroke={isSelected ? '#fbbf24' : viewMode === 'blueprint' ? '#60a5fa' : '#334155'}
                    strokeWidth={1.5 * zoom}
                    rx={1}
                  />

                  {/* 90° Swing Arc */}
                  <path
                    d={`M ${dx - dw / 2} ${dy - dw} A ${dw} ${dw} 0 0 1 ${dx + dw / 2} ${dy}`}
                    fill="none"
                    stroke={isSelected ? '#f59e0b' : viewMode === 'blueprint' ? '#60a5fa' : '#64748b'}
                    strokeWidth={1.2 * zoom}
                    strokeDasharray={`${4 * zoom},${3 * zoom}`}
                  />
                </g>

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
                onMouseDown={e => handleElementMouseDown(e, 'window', win.id)}
                style={{ cursor: activeTool === 'select' ? 'move' : undefined }}
                className="fp-window-group"
              >
                {/* Outer Frame embedded matching exact host wall thickness */}
                <rect
                  x={wx - ww / 2}
                  y={wy - wallThickPx / 2}
                  width={ww}
                  height={wallThickPx}
                  fill={viewMode === 'blueprint' ? 'rgba(30,58,138,0.4)' : 'rgba(255,255,255,0.95)'}
                  stroke={isSelected ? '#f59e0b' : viewMode === 'blueprint' ? '#93c5fd' : '#0284c7'}
                  strokeWidth={1.8 * zoom}
                />

                {/* Exterior Window Sill projection */}
                <line
                  x1={wx - ww / 2 - 3 * zoom}
                  y1={wy - wallThickPx / 2 - 2 * zoom}
                  x2={wx + ww / 2 + 3 * zoom}
                  y2={wy - wallThickPx / 2 - 2 * zoom}
                  stroke={isSelected ? '#f59e0b' : viewMode === 'blueprint' ? '#60a5fa' : '#0369a1'}
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
                      stroke={isSelected ? '#fbbf24' : '#0284c7'}
                      strokeWidth={1.8 * zoom}
                    />
                    <line
                      x1={wx - 4 * zoom}
                      y1={wy + 2 * zoom}
                      x2={wx + ww / 2 - 3 * zoom}
                      y2={wy + 2 * zoom}
                      stroke={isSelected ? '#fbbf24' : '#0284c7'}
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
                      stroke={isSelected ? '#fbbf24' : '#38bdf8'}
                      strokeWidth={2 * zoom}
                    />
                    <line
                      x1={wx}
                      y1={wy - wallThickPx / 2}
                      x2={wx}
                      y2={wy + wallThickPx / 2}
                      stroke={isSelected ? '#fbbf24' : '#0284c7'}
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
                      stroke={isSelected ? '#fbbf24' : '#38bdf8'}
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
                onMouseDown={e => handleElementMouseDown(e, 'annotation', annot.id)}
                style={{ cursor: activeTool === 'select' ? 'move' : undefined }}
              >
                <text
                  x={ax} y={ay}
                  fontSize={Math.max(9, (annot.fontSize || 10) * zoom)}
                  fill={isSelected ? '#f59e0b' : viewMode === 'blueprint' ? '#67e8f9' : '#0f172a'}
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
              stroke={viewMode === 'blueprint' ? '#60a5fa' : '#f59e0b'}
              strokeWidth={Math.max(2, wallThickness * GRID_SIZE_PX * zoom)}
              strokeDasharray={`${8 * zoom},${4 * zoom}`}
              opacity={0.7}
            />
          )}

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

          {/* Live Freehand Sketch Stroke in AI Smart Draw Mode ("user summa line draw panna athe understand panna purinjiganu") */}
          {isFreehandDrawing && freehandPoints.length > 1 && (
            <polyline
              points={freehandPoints.map(p => `${p.x * GRID_SIZE_PX * zoom + panX},${p.y * GRID_SIZE_PX * zoom + panY}`).join(' ')}
              fill="none"
              stroke="#c084fc"
              strokeWidth={3.5 * zoom}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={`${5 * zoom},${3 * zoom}`}
              style={{
                pointerEvents: 'none',
                filter: 'drop-shadow(0 0 8px rgba(192, 132, 252, 0.85))',
              }}
            />
          )}
        </svg>

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
            {liveLengthBadge.lengthStr} • {liveLengthBadge.angleDeg}°
          </div>
        )}

        {/* ── Planner5D Bottom Property Dock ─────────── */}
        {showBottomDock && selectedElement && (() => {
          const entity = getSelectedEntity();
          if (!entity) return null;
          const isLocked = !!entity.locked;
          const isDrawingActive = isDrawingWall || isFreehandDrawing || !!resizingWall || isDragging || isPanning;

          if (isBottomDockMinimized) {
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
                  <button
                    type="button"
                    className="fp-dock-mini-btn"
                    onClick={toggleDockMinimized}
                    title="Expand Full Controls (▲)"
                    id="fp-dock-expand-btn"
                  >
                    <ChevronUp size={13} />
                    <span>Expand</span>
                  </button>
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
                  <button
                    type="button"
                    className="fp-dock-mini-btn danger"
                    onClick={handleDeleteSelected}
                    disabled={isLocked}
                    title="Delete Element (Del)"
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
                <span style={{ color: '#38bdf8', fontSize: '0.78rem' }}>
                  {(entity as any).label || (entity as any).itemType || (entity as any).doorType || (entity as any).windowType || (entity as any).wallType || ''}
                </span>
              </div>

              <div className="fp-prop-dock-inputs">
                {selectedElement.type === 'wall' && (() => {
                  const w = entity as FloorPlanWall;
                  return (
                    <>
                      <div className="fp-prop-pill">
                        <span className="fp-prop-pill-label">Length</span>
                        <input
                          type="number"
                          step="0.25"
                          className="fp-prop-pill-input"
                          value={wallLength(w).toFixed(2)}
                          disabled={isLocked}
                          onChange={e => {
                            const newLen = parseFloat(e.target.value);
                            if (newLen > 0.5) {
                              const curLen = wallLength(w);
                              const ratio = newLen / curLen;
                              dispatch({
                                type: 'UPDATE_WALL',
                                id: w.id,
                                changes: {
                                  x2: w.x1 + (w.x2 - w.x1) * ratio,
                                  y2: w.y1 + (w.y2 - w.y1) * ratio,
                                },
                              });
                              markUnsaved();
                            }
                          }}
                        />
                        <span className="fp-prop-pill-unit">{unit === 'feet' ? 'ft' : 'm'}</span>
                      </div>
                      <div className="fp-prop-pill">
                        <span className="fp-prop-pill-label">Thick</span>
                        <input
                          type="number"
                          step="0.1"
                          className="fp-prop-pill-input"
                          value={w.thickness}
                          disabled={isLocked}
                          onChange={e => {
                            dispatch({ type: 'UPDATE_WALL', id: w.id, changes: { thickness: parseFloat(e.target.value) || 0.75 } });
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

                      {/* Width with Steppers < > */}
                      <div className="fp-prop-pill">
                        <span className="fp-prop-pill-label">Width, {unit === 'feet' ? 'ft' : 'm'}</span>
                        <button
                          type="button"
                          className="fp-stepper-btn"
                          disabled={isLocked || r.width <= 1}
                          onClick={() => {
                            const step = unit === 'feet' ? 0.5 : 0.25;
                            dispatch({ type: 'UPDATE_ROOM', id: r.id, changes: { width: Math.max(1, +(r.width - step).toFixed(2)) } });
                            markUnsaved();
                          }}
                          title="Decrease Width"
                        >
                          &lt;
                        </button>
                        <input
                          type="number"
                          step={unit === 'feet' ? 0.5 : 0.25}
                          className="fp-prop-pill-input"
                          value={r.width}
                          disabled={isLocked}
                          onChange={e => {
                            dispatch({ type: 'UPDATE_ROOM', id: r.id, changes: { width: parseFloat(e.target.value) || 1 } });
                            markUnsaved();
                          }}
                        />
                        <button
                          type="button"
                          className="fp-stepper-btn"
                          disabled={isLocked}
                          onClick={() => {
                            const step = unit === 'feet' ? 0.5 : 0.25;
                            dispatch({ type: 'UPDATE_ROOM', id: r.id, changes: { width: +(r.width + step).toFixed(2) } });
                            markUnsaved();
                          }}
                          title="Increase Width"
                        >
                          &gt;
                        </button>
                      </div>

                      {/* Height (Length) with Steppers < > */}
                      <div className="fp-prop-pill">
                        <span className="fp-prop-pill-label">Height, {unit === 'feet' ? 'ft' : 'm'}</span>
                        <button
                          type="button"
                          className="fp-stepper-btn"
                          disabled={isLocked || r.height <= 1}
                          onClick={() => {
                            const step = unit === 'feet' ? 0.5 : 0.25;
                            dispatch({ type: 'UPDATE_ROOM', id: r.id, changes: { height: Math.max(1, +(r.height - step).toFixed(2)) } });
                            markUnsaved();
                          }}
                          title="Decrease Height"
                        >
                          &lt;
                        </button>
                        <input
                          type="number"
                          step={unit === 'feet' ? 0.5 : 0.25}
                          className="fp-prop-pill-input"
                          value={r.height}
                          disabled={isLocked}
                          onChange={e => {
                            dispatch({ type: 'UPDATE_ROOM', id: r.id, changes: { height: parseFloat(e.target.value) || 1 } });
                            markUnsaved();
                          }}
                        />
                        <button
                          type="button"
                          className="fp-stepper-btn"
                          disabled={isLocked}
                          onClick={() => {
                            const step = unit === 'feet' ? 0.5 : 0.25;
                            dispatch({ type: 'UPDATE_ROOM', id: r.id, changes: { height: +(r.height + step).toFixed(2) } });
                            markUnsaved();
                          }}
                          title="Increase Height"
                        >
                          &gt;
                        </button>
                      </div>

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

                      {/* Floor Finish Toggle (Wood Floor / Plain Color) */}
                      <button
                        type="button"
                        className={`fp-prop-toggle-btn ${r.floorFinish !== 'Color Tint' ? 'active' : ''}`}
                        disabled={isLocked}
                        onClick={() => {
                          const next = r.floorFinish === 'Color Tint' ? 'Wood Parquet' : 'Color Tint';
                          dispatch({ type: 'UPDATE_ROOM', id: r.id, changes: { floorFinish: next } });
                          markUnsaved();
                        }}
                        title="Toggle Wood Flooring Parquet vs Plain Tint"
                      >
                        {r.floorFinish === 'Color Tint' ? '🎨 Plain Tint' : '🪵 Wood Floor'}
                      </button>

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
            onClick={() => setZoom(1.0)}
            title="Reset Zoom to 100%"
            id="fp-cad-100-btn"
          >
            <span>100%</span>
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
            style={{ cursor: 'pointer', background: 'rgba(56, 189, 248, 0.12)', borderRadius: 6, padding: '2px 8px' }}
            onClick={() => setShowRoomScheduleModal(true)}
            title="Click to view Room Schedule & Details"
          >
            <span className="fp-info-label" style={{ color: '#38bdf8' }}>Rooms 📋</span>
            <span className="fp-info-value" style={{ color: '#38bdf8', fontWeight: 800 }}>{editorState.rooms.length}</span>
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
            <h3><Layers size={16} color="#38bdf8" /> CAD Layers</h3>
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
                      background: layer.color || '#38bdf8',
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

      {/* ── Properties Panel ──────────────────────────── */}
      {selectedElement && (
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
                  <label>Width ({unit === 'feet' ? 'ft' : 'm'})</label>
                  <input
                    type="number"
                    min={1}
                    step={0.5}
                    value={room.width}
                    onChange={e => {
                      dispatch({ type: 'UPDATE_ROOM', id: room.id, changes: { width: parseFloat(e.target.value) || 1 } });
                      markUnsaved();
                    }}
                  />
                </div>
                <div className="fp-prop-row">
                  <label>Height ({unit === 'feet' ? 'ft' : 'm'})</label>
                  <input
                    type="number"
                    min={1}
                    step={0.5}
                    value={room.height}
                    onChange={e => {
                      dispatch({ type: 'UPDATE_ROOM', id: room.id, changes: { height: parseFloat(e.target.value) || 1 } });
                      markUnsaved();
                    }}
                  />
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
            ? 'Click to start drawing wall'
            : activeTool === 'furniture' && selectedFurnitureToPlace
            ? `Click on canvas to place ${selectedFurnitureToPlace.itemType}`
            : activeTool === 'column'
            ? 'Click on grid intersection to place structural column'
            : activeTool === 'stairs'
            ? 'Click to place staircase flight'
            : selectedElement
            ? `Selected: ${selectedElement.type.toUpperCase()} (drag to move, orange handles to resize, Del to delete)`
            : 'Select an element or choose a tool from the left toolbar'}
        </div>
        <div className="fp-bottom-right">
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
                <Armchair size={20} color="#38bdf8" />
                <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#f8fafc' }}>
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
                <Calculator size={20} color="#f59e0b" />
                <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#f8fafc' }}>
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
                    <td><strong style={{ color: '#f59e0b' }}>{estimatedBricks.toLocaleString()} pcs</strong></td>
                    <td>Based on {totalWallLength.toFixed(1)} {unit} wall length & {ceilingHeight} ft ceiling height</td>
                  </tr>
                  <tr>
                    <td><strong>Cement Bags (PPC/OPC)</strong></td>
                    <td><strong style={{ color: '#38bdf8' }}>{estimatedCementBags} bags</strong></td>
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
                  <Box size={20} color="#10b981" />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#f8fafc' }}>
                    Floor Plan Room Schedule & Breakdown
                  </h3>
                  <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                    Total Rooms in Floor Plan: <strong style={{ color: '#4ade80' }}>{editorState.rooms.length} Rooms</strong> • Total Built-up Area: <strong style={{ color: '#38bdf8' }}>{totalFloorArea.toFixed(1)} {unit === 'feet' ? 'sq.ft' : 'sq.m'}</strong>
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
                  <span className="fp-room-stat-num" style={{ color: '#4ade80' }}>
                    {editorState.rooms.length}
                  </span>
                  <span className="fp-room-stat-label">Total Rooms</span>
                </div>
                <div className="fp-room-stat-card">
                  <span className="fp-room-stat-num" style={{ color: '#38bdf8' }}>
                    {totalFloorArea.toFixed(1)} <small style={{ fontSize: '0.75rem' }}>{unit === 'feet' ? 'sq.ft' : 'sq.m'}</small>
                  </span>
                  <span className="fp-room-stat-label">Total Built-up Area</span>
                </div>
                <div className="fp-room-stat-card">
                  <span className="fp-room-stat-num" style={{ color: '#fbbf24' }}>
                    {plan.plotLength * plan.plotWidth} <small style={{ fontSize: '0.75rem' }}>{unit === 'feet' ? 'sq.ft' : 'sq.m'}</small>
                  </span>
                  <span className="fp-room-stat-label">Plot Area</span>
                </div>
                <div className="fp-room-stat-card">
                  <span className="fp-room-stat-num" style={{ color: '#a78bfa' }}>
                    {((totalFloorArea / Math.max(1, plan.plotLength * plan.plotWidth)) * 100).toFixed(1)}%
                  </span>
                  <span className="fp-room-stat-label">Plot Coverage</span>
                </div>
              </div>

              {/* Rooms Schedule Table */}
              <div style={{ marginBottom: 16 }}>
                <h5 style={{ margin: '0 0 8px 0', color: '#94a3b8', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  All Configured Rooms & Dimensions
                </h5>
                {editorState.rooms.length > 0 ? (
                  <div style={{ overflowX: 'auto', border: '1px solid #334155', borderRadius: 10 }}>
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
                                  background: '#1e293b',
                                  border: '1px solid #334155',
                                  borderRadius: 5,
                                  color: '#f8fafc',
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
                                  background: '#1e293b',
                                  border: '1px solid #334155',
                                  borderRadius: 5,
                                  color: '#f8fafc',
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
                            <td style={{ fontWeight: 700, color: '#34d399' }}>
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
                  <div style={{ padding: 30, textAlign: 'center', color: '#64748b', background: 'rgba(30,41,59,0.4)', borderRadius: 8 }}>
                    No rooms created in this floor plan yet. Use the form below to add your first room!
                  </div>
                )}
              </div>

              {/* Quick Add Room by Height & Width Inputs */}
              <div style={{ padding: 16, background: 'rgba(15, 23, 42, 0.7)', border: '1.5px solid rgba(56, 189, 248, 0.3)', borderRadius: 12 }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '0.9rem', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Plus size={16} color="#38bdf8" /> Add Room with Exact Height & Width
                </h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', color: '#94a3b8', marginBottom: 4 }}>Type of Room</label>
                    <select
                      value={draftRoomType}
                      onChange={e => setDraftRoomType(e.target.value as RoomType)}
                      style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 6, color: '#fff', padding: '7px 10px', fontSize: '0.82rem' }}
                    >
                      {ROOM_TYPES.map(rt => <option key={rt} value={rt}>{rt}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', color: '#94a3b8', marginBottom: 4 }}>Width ({unit === 'feet' ? 'ft' : 'm'})</label>
                    <input
                      type="number"
                      step={0.5}
                      value={draftRoomWidth}
                      onChange={e => setDraftRoomWidth(parseFloat(e.target.value) || 1)}
                      style={{ width: 85, background: '#1e293b', border: '1px solid #334155', borderRadius: 6, color: '#fff', padding: '7px 8px', fontSize: '0.82rem', fontWeight: 600 }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', color: '#94a3b8', marginBottom: 4 }}>Height ({unit === 'feet' ? 'ft' : 'm'})</label>
                    <input
                      type="number"
                      step={0.5}
                      value={draftRoomHeight}
                      onChange={e => setDraftRoomHeight(parseFloat(e.target.value) || 1)}
                      style={{ width: 85, background: '#1e293b', border: '1px solid #334155', borderRadius: 6, color: '#fff', padding: '7px 8px', fontSize: '0.82rem', fontWeight: 600 }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', color: '#94a3b8', marginBottom: 4 }}>Floor Finish</label>
                    <select
                      value={draftRoomFloorFinish}
                      onChange={e => setDraftRoomFloorFinish(e.target.value)}
                      style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 6, color: '#fff', padding: '7px 10px', fontSize: '0.82rem' }}
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
                <Plus size={20} color="#38bdf8" />
                <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#f8fafc' }}>
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
                  <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginBottom: 6, fontWeight: 600 }}>
                    Type of Room
                  </label>
                  <select
                    value={draftRoomType}
                    onChange={e => setDraftRoomType(e.target.value as RoomType)}
                    style={{ width: '100%', background: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#fff', padding: '9px 12px', fontSize: '0.85rem' }}
                  >
                    {ROOM_TYPES.map(rt => <option key={rt} value={rt}>{rt}</option>)}
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginBottom: 6, fontWeight: 600 }}>
                      Width ({unit === 'feet' ? 'ft' : 'm'})
                    </label>
                    <input
                      type="number"
                      step={0.5}
                      value={draftRoomWidth}
                      onChange={e => setDraftRoomWidth(parseFloat(e.target.value) || 1)}
                      style={{ width: '100%', background: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#fff', padding: '9px 12px', fontSize: '0.9rem', fontWeight: 700 }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginBottom: 6, fontWeight: 600 }}>
                      Height / Length ({unit === 'feet' ? 'ft' : 'm'})
                    </label>
                    <input
                      type="number"
                      step={0.5}
                      value={draftRoomHeight}
                      onChange={e => setDraftRoomHeight(parseFloat(e.target.value) || 1)}
                      style={{ width: '100%', background: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#fff', padding: '9px 12px', fontSize: '0.9rem', fontWeight: 700 }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginBottom: 6, fontWeight: 600 }}>
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
                      style={{ width: '100%', background: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#fff', padding: '9px 12px', fontSize: '0.9rem' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginBottom: 6, fontWeight: 600 }}>
                      Floor Finish
                    </label>
                    <select
                      value={draftRoomFloorFinish}
                      onChange={e => setDraftRoomFloorFinish(e.target.value)}
                      style={{ width: '100%', background: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#fff', padding: '9px 12px', fontSize: '0.85rem' }}
                    >
                      <option value="Wood Parquet">🪵 Wood Floor Parquet</option>
                      <option value="Color Tint">🎨 Plain Tint</option>
                    </select>
                  </div>
                </div>

                <div style={{ background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '10px 14px', borderRadius: 8 }}>
                  <span style={{ fontSize: '0.82rem', color: '#34d399', fontWeight: 600 }}>
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
                <History size={20} color="#38bdf8" />
                <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#f8fafc' }}>
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
                  placeholder="Snapshot label (e.g., Prior to adding master bedroom)"
                  value={versionNote}
                  onChange={e => setVersionNote(e.target.value)}
                  style={{ flex: 1, padding: '8px 12px', borderRadius: 8, background: '#1e293b', border: '1px solid #334155', color: '#f8fafc', fontSize: '0.85rem' }}
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
                <h5 style={{ margin: '0 0 8px 0', color: '#94a3b8', fontSize: '0.78rem', textTransform: 'uppercase' }}>
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
                          background: 'rgba(30,41,59,0.5)',
                          borderRadius: 8,
                          border: '1px solid #334155',
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 600, color: '#f1f5f9', fontSize: '0.85rem' }}>
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
                <Keyboard size={20} color="#38bdf8" />
                <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#f8fafc' }}>
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
                  <tr><td><kbd style={{ background: '#334155', padding: '2px 6px', borderRadius: 4 }}>V</kbd></td><td>Select / Move Tool</td></tr>
                  <tr><td><kbd style={{ background: '#334155', padding: '2px 6px', borderRadius: 4 }}>W</kbd></td><td>Draw Wall Tool</td></tr>
                  <tr><td><kbd style={{ background: '#334155', padding: '2px 6px', borderRadius: 4 }}>R</kbd></td><td>Place Room Tool</td></tr>
                  <tr><td><kbd style={{ background: '#334155', padding: '2px 6px', borderRadius: 4 }}>D</kbd></td><td>Place Door Tool</td></tr>
                  <tr><td><kbd style={{ background: '#334155', padding: '2px 6px', borderRadius: 4 }}>M</kbd></td><td>Toggle Dimensions & Measurements</td></tr>
                  <tr><td><kbd style={{ background: '#334155', padding: '2px 6px', borderRadius: 4 }}>H</kbd></td><td>Pan / Hand Tool</td></tr>
                  <tr><td><kbd style={{ background: '#334155', padding: '2px 6px', borderRadius: 4 }}>Ctrl + Z</kbd></td><td>Undo</td></tr>
                  <tr><td><kbd style={{ background: '#334155', padding: '2px 6px', borderRadius: 4 }}>Ctrl + Y</kbd></td><td>Redo</td></tr>
                  <tr><td><kbd style={{ background: '#334155', padding: '2px 6px', borderRadius: 4 }}>Ctrl + S</kbd></td><td>Save Floor Plan</td></tr>
                  <tr><td><kbd style={{ background: '#334155', padding: '2px 6px', borderRadius: 4 }}>Del / Backspace</kbd></td><td>Delete Selected Element</td></tr>
                  <tr><td><kbd style={{ background: '#334155', padding: '2px 6px', borderRadius: 4 }}>Esc</kbd></td><td>Cancel Drawing / Deselect</td></tr>
                  <tr><td><kbd style={{ background: '#334155', padding: '2px 6px', borderRadius: 4 }}>Mouse Wheel</kbd></td><td>Zoom In / Out</td></tr>
                  <tr><td><kbd style={{ background: '#334155', padding: '2px 6px', borderRadius: 4 }}>Middle Mouse / Alt+Drag</kbd></td><td>Pan Canvas</td></tr>
                </tbody>
              </table>
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
                <Settings size={20} color="#38bdf8" />
                <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#f8fafc' }}>
                  CAD Precision & Drawing Settings
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
              {/* Wall Thickness Presets */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>
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
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>
                  Grid Spacing
                </label>
                <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                  {[50, 100, 200, 500, 1000].map(spacing => (
                    <button
                      key={spacing}
                      type="button"
                      className={`fp-cat-chip ${gridSpacingMm === spacing ? 'active' : ''}`}
                      onClick={() => {
                        setGridSpacingMm(spacing);
                        onNotify(`Grid spacing set to ${spacing}mm`, 'info');
                      }}
                    >
                      {spacing} mm
                    </button>
                  ))}
                </div>
              </div>

              {/* CAD Snapping Toggles */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>
                  Snapping & Alignment Guides
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#f1f5f9', cursor: 'pointer', fontSize: '0.88rem' }}>
                    <input
                      type="checkbox"
                      checked={snapToGridEnabled}
                      onChange={e => setSnapToGridEnabled(e.target.checked)}
                    />
                    <span><strong>Snap to Grid:</strong> Magnetic alignment to background grid intervals</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#f1f5f9', cursor: 'pointer', fontSize: '0.88rem' }}>
                    <input
                      type="checkbox"
                      checked={snapToEndpointsEnabled}
                      onChange={e => setSnapToEndpointsEnabled(e.target.checked)}
                    />
                    <span><strong>Snap to Endpoints:</strong> Automatic magnetic corner joining for enclosed walls</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#f1f5f9', cursor: 'pointer', fontSize: '0.88rem' }}>
                    <input
                      type="checkbox"
                      checked={snapToWallEnabled}
                      onChange={e => setSnapToWallEnabled(e.target.checked)}
                    />
                    <span><strong>Snap Along Walls:</strong> Automatic hosting for doors, windows, TVs & ACs</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#f1f5f9', cursor: 'pointer', fontSize: '0.88rem' }}>
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
              <div style={{ borderTop: '1px solid #334155', paddingTop: 16, marginTop: 16 }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>
                  Architectural Starter Plan
                </label>
                <p style={{ fontSize: '0.82rem', color: '#94a3b8', margin: '6px 0 12px 0' }}>
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
                  <Sparkles size={20} color="#fbbf24" />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#f8fafc' }}>
                    AI Floor Plan Copilot
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.78rem', color: '#94a3b8' }}>
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
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f1f5f9' }}>
                    Plan Geometry Health
                  </span>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: geometryReport.healthScore >= 80 ? '#10b981' : '#f59e0b' }}>
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
                <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: 6 }}>
                  {geometryReport.summaryMessage}
                </div>
              </div>
            </div>

            {/* Feedback notification if any */}
            {copilotLastMessage && (
              <div className="fp-copilot-msg-alert">
                <CheckCircle2 size={16} color="#10b981" />
                <span>{copilotLastMessage}</span>
              </div>
            )}

            {/* 1-Click Magic Fix Card */}
            <div className="fp-copilot-magic-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ fontSize: '1.4rem' }}>🪄</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#f8fafc' }}>
                    1-Click Auto-Heal & Generate Rooms
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#cbd5e1' }}>
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
                <Sparkles size={14} /> Natural Language AI Assistant (Tamil / Tanglish / English)
              </label>
              <form onSubmit={handleCopilotSubmitPrompt} className="fp-copilot-prompt-form">
                <input
                  type="text"
                  className="fp-copilot-prompt-input"
                  placeholder="e.g., 'wall zig zag ahh pota correct panna' or 'rotate 45'"
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
        onApplyFix={executeValidatedAction}
        onApplyAllFixes={actions => {
          actions.forEach(a => executeValidatedAction(a));
          onNotify(`Applied ${actions.length} safe architectural fixes.`, 'success');
        }}
      />

      {/* ── "Analyze Plan" Geometric Metrics Modal ── */}
      <PlanAnalysisModal
        isOpen={isAnalyzePlanModalOpen}
        onClose={() => setIsAnalyzePlanModalOpen(false)}
        report={analysisReport}
        unit={unit}
      />

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

