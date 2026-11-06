import type {
  FloorPlanWall,
  FloorPlanRoom,
  FloorPlanDoor,
  FloorPlanWindow,
  FloorPlanFurniture,
  FloorPlanStaircase,
  FloorPlanColumn,
  FloorPlanAnnotation,
  RoomType,
  DoorType,
  WindowType,
  FloorPlanUnit,
  User,
} from '../../db/types';

export interface FurnitureCatalogItem {
  itemType: string;
  label: string;
  category: 'bedroom' | 'living' | 'dining' | 'kitchen' | 'bathroom' | 'utility' | 'outdoor' | 'structural';
  width: number; // in feet
  height: number; // in feet
}

export type Tool =
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

export type ViewMode = 'design' | 'blueprint' | 'presentation';

export type SelectedElement =
  | { type: 'wall'; id: string }
  | { type: 'room'; id: string }
  | { type: 'door'; id: string }
  | { type: 'window'; id: string }
  | { type: 'column'; id: string }
  | { type: 'stairs'; id: string }
  | { type: 'furniture'; id: string }
  | { type: 'annotation'; id: string }
  | null;

export interface EditorState {
  walls: FloorPlanWall[];
  rooms: FloorPlanRoom[];
  doors: FloorPlanDoor[];
  windows: FloorPlanWindow[];
  furniture: FloorPlanFurniture[];
  stairs: FloorPlanStaircase[];
  columns: FloorPlanColumn[];
  annotations: FloorPlanAnnotation[];
}

export type EditorAction =
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

export interface FloorPlanEditorViewProps {
  planId: string;
  user: User;
  onBack: () => void;
  onBackToSite?: (siteId: string) => void;
  onNotify: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onOpenEstimator?: (areaSqFt: number) => void;
  onNavigateToCalculator?: (builtUpSqFt: number) => void;
}
