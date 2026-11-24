import type { FloorPlanUnit } from '../../db/types';
import { prepareForWallEdit, normaliseFloor } from '../../domain/planDocument';
import type { EditorState, EditorAction } from './types';
import { uid } from './utils';

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
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

export const WALL_ACTIONS = new Set<EditorAction['type']>(['ADD_WALL', 'UPDATE_WALL', 'DELETE_WALL', 'SET_WALLS']);

/**
 * Applies an edit and, when walls changed, brings the floor back to a consistent state:
 * rooms enclosed by walls are recalculated and doors/windows stay on (or go with) their wall.
 */
export function reducePlan(state: EditorState, action: EditorAction, unit: FloorPlanUnit): EditorState {
  if (!WALL_ACTIONS.has(action.type)) return editorReducer(state, action);
  // Rooms that already match their walls (older plans) are tied to them first, so they
  // follow this edit instead of being left behind at their old size.
  const next = editorReducer(prepareForWallEdit(state, unit), action);
  return normaliseFloor(next, unit, () => uid('room')).state;
}
