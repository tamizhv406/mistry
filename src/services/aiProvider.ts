import type {
  FloorPlanWall,
  FloorPlanRoom,
  FloorPlanDoor,
  FloorPlanWindow,
  FloorPlanColumn,
  FloorPlanStaircase,
  FloorPlanUnit,
  RoomType,
  DoorType,
  WindowType,
} from '../db/types';
import {
  formatLength,
  formatArea,
  getWallLength,
} from './geometryEngine';
import {
  classifyDrawingStroke,
  validatePlanAction,
  diagnosePlanIssues,
  analyzePlanMetrics,
  generateProposedLayout,
} from './aiFloorPlanEngine';
import type {
  Point2D,
  StrokeClassification,
  ValidatedPlanAction,
  PlanDiagnosticIssue,
  PlanAnalysisReport,
  ProposedLayoutResult,
  ProposedLayoutRequest,
} from './aiFloorPlanEngine';

// ============================================================
// Types & Interfaces
// ============================================================

export interface PlanContext {
  walls: FloorPlanWall[];
  rooms: FloorPlanRoom[];
  doors: FloorPlanDoor[];
  windows: FloorPlanWindow[];
  columns?: FloorPlanColumn[];
  staircases?: FloorPlanStaircase[];
  selectedElement?: { type: string; id: string } | null;
  cursorPos?: Point2D | null;
  unit: FloorPlanUnit;
}

export interface ClarificationOption {
  label: string;
  action: ValidatedPlanAction;
  description?: string;
}

export interface AICommandResult {
  success: boolean;
  understood: boolean;
  message: string;
  action?: ValidatedPlanAction;
  clarificationPrompt?: {
    question: string;
    options: ClarificationOption[];
  };
  diagnosticReport?: PlanDiagnosticIssue[];
  metricsReport?: PlanAnalysisReport;
  layoutProposal?: ProposedLayoutResult;
}

export interface FloorPlanAIProvider {
  classifyDrawing(points: Point2D[], context: PlanContext): Promise<StrokeClassification>;
  interpretCommand(command: string, context: PlanContext): Promise<AICommandResult>;
  explainDetection(classification: StrokeClassification): string;
}

// ============================================================
// Local Deterministic AI Provider Implementation
// ============================================================

export class LocalFloorPlanAIProvider implements FloorPlanAIProvider {
  /**
   * Classify user freehand stroke into architectural entity with confidence scoring.
   */
  async classifyDrawing(points: Point2D[], context: PlanContext): Promise<StrokeClassification> {
    return classifyDrawingStroke(points, context.walls, context.rooms, context.unit);
  }

  /**
   * Provides user-facing explanation of detection.
   */
  explainDetection(c: StrokeClassification): string {
    const pct = Math.round(c.confidence * 100);
    return `${c.label} (${pct}% confidence): ${c.reasoning}`;
  }

  /**
   * Interprets natural language floor plan commands, resolving spatial references.
   */
  async interpretCommand(rawCommand: string, context: PlanContext): Promise<AICommandResult> {
    const text = rawCommand.trim().toLowerCase();
    const { walls, rooms, doors, windows, columns = [], staircases = [], selectedElement, unit } = context;

    if (!text) {
      return {
        success: false,
        understood: false,
        message: 'Please type or speak a floor plan command.',
      };
    }

    // ─────────────────────────────────────────────────────────
    // 1. "Fix My Plan" / "Plan sari pannu"
    // ─────────────────────────────────────────────────────────
    if (
      text.includes('fix my plan') ||
      text.includes('fix plan') ||
      text.includes('sari pannu') ||
      text.includes('heal plan') ||
      text.includes('repair plan') ||
      text.includes('check issues')
    ) {
      const issues = diagnosePlanIssues(walls, rooms, doors, windows, unit);
      if (issues.length === 0) {
        return {
          success: true,
          understood: true,
          message: '✨ Your floor plan is in great health! No geometric gaps, overlaps, or misalignments found.',
          diagnosticReport: [],
        };
      }
      return {
        success: true,
        understood: true,
        message: `Found ${issues.length} possible geometric issues in your plan.`,
        diagnosticReport: issues,
      };
    }

    // ─────────────────────────────────────────────────────────
    // 2. "Analyze Plan" / "Understand My Plan" / "Area calculations"
    // ─────────────────────────────────────────────────────────
    if (
      text.includes('analyze plan') ||
      text.includes('understand plan') ||
      text.includes('floor area') ||
      text.includes('total area') ||
      text.includes('area yevlo') ||
      text.includes('summary') ||
      text.includes('metrics')
    ) {
      const report = analyzePlanMetrics(walls, rooms, doors, windows, columns, staircases, unit);
      return {
        success: true,
        understood: true,
        message: `Plan analyzed: Gross Area ${report.formattedTotalArea} across ${report.roomCount} rooms and ${report.doorCount} doors.`,
        metricsReport: report,
      };
    }

    // ─────────────────────────────────────────────────────────
    // 3. "How many rooms are there?" / "Room count"
    // ─────────────────────────────────────────────────────────
    if (text.includes('how many rooms') || text.includes('ethana room') || text.includes('room count')) {
      const count = rooms.length;
      if (count === 0) {
        return {
          success: true,
          understood: true,
          message: 'There are currently no defined rooms in this plan. Use "AI Draw" or the Room tool to create one.',
        };
      }
      const names = rooms.map(r => r.label || r.roomType).join(', ');
      return {
        success: true,
        understood: true,
        message: `There are ${count} rooms: ${names}.`,
      };
    }

    // ─────────────────────────────────────────────────────────
    // 4. "Show me the bedroom area" / Specific room area queries
    // ─────────────────────────────────────────────────────────
    const roomTypeMatches: RoomType[] = [
      'Living Room', 'Bedroom', 'Master Bedroom', 'Kitchen', 'Dining',
      'Bathroom', 'Toilet', 'Balcony', 'Study', 'Pooja', 'Store',
    ];

    for (const rType of roomTypeMatches) {
      if (text.includes(rType.toLowerCase()) && (text.includes('area') || text.includes('size') || text.includes('yevlo'))) {
        const matching = rooms.filter(r => (r.label || r.roomType).toLowerCase().includes(rType.toLowerCase()));
        if (matching.length === 0) {
          return {
            success: false,
            understood: true,
            message: `No ${rType} found in your floor plan.`,
          };
        }
        const details = matching
          .map(r => `${r.label || r.roomType}: ${formatArea(r.area || r.width * r.height, unit)}`)
          .join('; ');
        return {
          success: true,
          understood: true,
          message: `${rType} area: ${details}`,
        };
      }
    }


    // ─────────────────────────────────────────────────────────
    // 5. "Help me design" / "I need a 2 bedroom house"
    // ─────────────────────────────────────────────────────────
    if (
      text.includes('help me design') ||
      text.includes('design house') ||
      text.includes('bhk') ||
      text.includes('bedroom house') ||
      text.includes('plot design')
    ) {
      // Parse bedroom count
      let beds = 2;
      const bedMatch = text.match(/(\d+)\s*(bhk|bedroom|bed)/);
      if (bedMatch) beds = Math.max(1, Math.min(5, parseInt(bedMatch[1], 10)));

      // Parse plot dimensions if mentioned e.g. "30 by 40", "30x40"
      let plotW = unit === 'feet' ? 30 : 9;
      let plotD = unit === 'feet' ? 40 : 12;
      const dimMatch = text.match(/(\d+)\s*(?:by|x|\*)\s*(\d+)/);
      if (dimMatch) {
        plotW = parseInt(dimMatch[1], 10);
        plotD = parseInt(dimMatch[2], 10);
      }

      const req: ProposedLayoutRequest = {
        plotWidth: plotW,
        plotDepth: plotD,
        unit,
        bedrooms: beds,
        bathrooms: beds >= 2 ? 2 : 1,
        facing: text.includes('south') ? 'South' : text.includes('west') ? 'West' : text.includes('east') ? 'East' : 'North',
        hasParking: text.includes('parking') || text.includes('car'),
        hasPooja: text.includes('pooja') || text.includes('prayer'),
      };

      const proposal = generateProposedLayout(req);
      return {
        success: true,
        understood: true,
        message: `Proposed ${proposal.title}. Review layout before applying to plan.`,
        layoutProposal: proposal,
      };
    }

    // ─────────────────────────────────────────────────────────
    // 6. "Switch to 3D" / "Switch to 2D"
    // ─────────────────────────────────────────────────────────
    if (text.includes('3d') || text.includes('three d') || text.includes('switch to 3d') || text.includes('3d kaatu')) {
      return {
        success: true,
        understood: true,
        message: 'Switched to 3D architectural visualization.',
        action: {
          action: 'SWITCH_VIEW',
          value: '3D',
          description: 'Switch to 3D perspective preview',
        },
      };
    }
    if (text.includes('2d') || text.includes('two d') || text.includes('switch to 2d')) {
      return {
        success: true,
        understood: true,
        message: 'Switched to 2D drafting canvas.',
        action: {
          action: 'SWITCH_VIEW',
          value: '2D',
          description: 'Switch to 2D canvas',
        },
      };
    }

    // ─────────────────────────────────────────────────────────
    // 7. "Show dimensions" / "Hide dimensions"
    // ─────────────────────────────────────────────────────────
    if (text.includes('show dimension') || text.includes('display dimension') || text.includes('show measurements')) {
      return {
        success: true,
        understood: true,
        message: 'Dimensions displayed on all walls.',
        action: {
          action: 'NOOP',
          payload: { setting: 'showDimensions', value: true },
          description: 'Show dimension markers',
        },
      };
    }
    if (text.includes('hide dimension')) {
      return {
        success: true,
        understood: true,
        message: 'Wall dimensions hidden.',
        action: {
          action: 'NOOP',
          payload: { setting: 'showDimensions', value: false },
          description: 'Hide dimension markers',
        },
      };
    }

    // ─────────────────────────────────────────────────────────
    // 8. Spatial Reference Resolution: "this room", "make this kitchen", etc.
    // ─────────────────────────────────────────────────────────
    const targetRoomTypes: RoomType[] = [
      'Living Room', 'Bedroom', 'Master Bedroom', 'Kitchen', 'Dining',
      'Bathroom', 'Toilet', 'Study', 'Pooja', 'Store', 'Balcony', 'Utility',
    ];

    for (const rType of targetRoomTypes) {
      const typeLower = rType.toLowerCase();
      if (
        text.includes(`make this ${typeLower}`) ||
        text.includes(`make this room ${typeLower}`) ||
        text.includes(`change this to ${typeLower}`) ||
        text.includes(`rename to ${typeLower}`) ||
        text.includes(`${typeLower} mathu`) ||
        text.includes(`${typeLower} aaku`)
      ) {
        // Resolve reference
        let targetRoom: FloorPlanRoom | null = null;
        if (selectedElement && selectedElement.type === 'room') {
          targetRoom = rooms.find(r => r.id === selectedElement.id) || null;
        }

        if (!targetRoom && rooms.length === 1) {
          targetRoom = rooms[0];
        }

        if (!targetRoom && rooms.length > 1) {
          return {
            success: false,
            understood: true,
            message: 'Which enclosed area should I use?',
            clarificationPrompt: {
              question: `Which room should be renamed to "${rType}"?`,
              options: rooms.map(r => ({
                label: `${r.label || r.roomType} (${formatArea(r.area || r.width * r.height, unit)})`,
                action: {
                  action: 'UPDATE_ROOM',
                  objectId: r.id,
                  property: 'roomType',
                  value: rType,
                  description: `Rename ${r.label || r.roomType} to ${rType}`,
                },
              })),
            },
          };
        }

        if (!targetRoom) {
          return {
            success: false,
            understood: true,
            message: 'Please tap or select a room first, or draw an enclosed boundary.',
          };
        }

        return {
          success: true,
          understood: true,
          message: `Done. Room renamed to ${rType}.`,
          action: {
            action: 'UPDATE_ROOM',
            objectId: targetRoom.id,
            property: 'roomType',
            value: rType,
            description: `Rename ${targetRoom.label || targetRoom.roomType} to ${rType}`,
          },
        };
      }
    }

    // ─────────────────────────────────────────────────────────
    // 9. "Make this wall 10 feet" / "Make this wall 12 feet"
    // ─────────────────────────────────────────────────────────
    const wallLenMatch = text.match(/(?:make|set|change)\s+(?:this\s+)?wall\s+(?:to\s+)?(\d+(?:\.\d+)?)\s*(feet|ft|m|meters|meter)?/);
    if (wallLenMatch) {
      const targetLen = parseFloat(wallLenMatch[1]);
      let targetWall: FloorPlanWall | null = null;

      if (selectedElement && selectedElement.type === 'wall') {
        targetWall = walls.find(w => w.id === selectedElement.id) || null;
      }

      if (!targetWall && walls.length === 1) {
        targetWall = walls[0];
      }

      if (!targetWall && walls.length > 1) {
        return {
          success: false,
          understood: true,
          message: 'Which wall do you want to resize?',
          clarificationPrompt: {
            question: `Which wall would you like to set to ${targetLen} ${unit === 'feet' ? 'ft' : 'm'}?`,
            options: walls.slice(0, 5).map(w => {
              const curLen = getWallLength(w);
              const angle = Math.atan2(w.y2 - w.y1, w.x2 - w.x1);
              const newX2 = +(w.x1 + targetLen * Math.cos(angle)).toFixed(2);
              const newY2 = +(w.y1 + targetLen * Math.sin(angle)).toFixed(2);
              return {
                label: `Wall (${formatLength(curLen, unit)}) at (${w.x1.toFixed(0)}, ${w.y1.toFixed(0)})`,
                action: {
                  action: 'UPDATE_WALL',
                  objectId: w.id,
                  payload: { ...w, x2: newX2, y2: newY2 },
                  description: `Resize wall to ${formatLength(targetLen, unit)}`,
                },
              };
            }),
          },
        };
      }

      if (!targetWall) {
        return {
          success: false,
          understood: true,
          message: 'Please select a wall to adjust its length.',
        };
      }

      const angle = Math.atan2(targetWall.y2 - targetWall.y1, targetWall.x2 - targetWall.x1);
      const newX2 = +(targetWall.x1 + targetLen * Math.cos(angle)).toFixed(2);
      const newY2 = +(targetWall.y1 + targetLen * Math.sin(angle)).toFixed(2);

      return {
        success: true,
        understood: true,
        message: `Wall length updated to ${formatLength(targetLen, unit)}.`,
        action: {
          action: 'UPDATE_WALL',
          objectId: targetWall.id,
          payload: { ...targetWall, x2: newX2, y2: newY2 },
          description: `Resize wall to ${formatLength(targetLen, unit)}`,
        },
      };
    }

    // ─────────────────────────────────────────────────────────
    // 10. "Make this room 12 by 14 feet" / "12x14"
    // ─────────────────────────────────────────────────────────
    const roomDimMatch = text.match(/(?:make|set|resize)\s+(?:this\s+)?room\s+(?:to\s+)?(\d+(?:\.\d+)?)\s*(?:by|x|\*)\s*(\d+(?:\.\d+)?)/);
    if (roomDimMatch) {
      const targetW = parseFloat(roomDimMatch[1]);
      const targetH = parseFloat(roomDimMatch[2]);

      let targetRoom: FloorPlanRoom | null = null;
      if (selectedElement && selectedElement.type === 'room') {
        targetRoom = rooms.find(r => r.id === selectedElement.id) || null;
      }
      if (!targetRoom && rooms.length === 1) {
        targetRoom = rooms[0];
      }

      if (!targetRoom) {
        return {
          success: false,
          understood: true,
          message: 'Please select a room to resize.',
        };
      }

      return {
        success: true,
        understood: true,
        message: `Room resized to ${targetW} × ${targetH} (${formatArea(targetW * targetH, unit)}).`,
        action: {
          action: 'UPDATE_ROOM',
          objectId: targetRoom.id,
          payload: {
            ...targetRoom,
            width: targetW,
            height: targetH,
            area: targetW * targetH,
            perimeter: 2 * (targetW + targetH),
          },
          description: `Resize ${targetRoom.label || targetRoom.roomType} to ${targetW}×${targetH}`,
        },
      };
    }

    // ─────────────────────────────────────────────────────────
    // 11. "Add door" / "Add window"
    // ─────────────────────────────────────────────────────────
    if (text.includes('add door') || text.includes('insert door') || text.includes('door podu')) {
      return {
        success: true,
        understood: true,
        message: 'What type of door?',
        clarificationPrompt: {
          question: 'What type of door would you like to add?',
          options: [
            {
              label: 'Single Door (3 ft)',
              action: {
                action: 'ADD_DOOR',
                payload: {
                  id: `door-${Date.now()}`,
                  type: 'Single',
                  x: context.cursorPos?.x || 10,
                  y: context.cursorPos?.y || 0,
                  width: unit === 'feet' ? 3.0 : 0.9,
                },
                description: 'Add Single Door',
              },
            },
            {
              label: 'Double Door (5 ft)',
              action: {
                action: 'ADD_DOOR',
                payload: {
                  id: `door-${Date.now()}`,
                  type: 'Double',
                  x: context.cursorPos?.x || 10,
                  y: context.cursorPos?.y || 0,
                  width: unit === 'feet' ? 5.0 : 1.5,
                },
                description: 'Add Double Door',
              },
            },
            {
              label: 'Sliding Door (6 ft)',
              action: {
                action: 'ADD_DOOR',
                payload: {
                  id: `door-${Date.now()}`,
                  type: 'Sliding',
                  x: context.cursorPos?.x || 10,
                  y: context.cursorPos?.y || 0,
                  width: unit === 'feet' ? 6.0 : 1.8,
                },
                description: 'Add Sliding Door',
              },
            },
            {
              label: 'Main Entrance Door (3.5 ft)',
              action: {
                action: 'ADD_DOOR',
                payload: {
                  id: `door-${Date.now()}`,
                  type: 'Main Entrance',
                  x: context.cursorPos?.x || 10,
                  y: context.cursorPos?.y || 0,
                  width: unit === 'feet' ? 3.5 : 1.05,
                },
                description: 'Add Main Entrance Door',
              },
            },
          ],
        },
      };
    }

    if (text.includes('add window') || text.includes('insert window') || text.includes('window vai')) {
      return {
        success: true,
        understood: true,
        message: 'Standard window ready to place. Click along a wall or confirm.',
        action: {
          action: 'ADD_WINDOW',
          payload: {
            id: `window-${Date.now()}`,
            type: 'Standard',
            x: context.cursorPos?.x || 10,
            y: context.cursorPos?.y || 0,
            width: unit === 'feet' ? 4.0 : 1.2,
          },
          description: 'Insert standard window',
        },
      };
    }

    // ─────────────────────────────────────────────────────────
    // 12. "Delete this room" / "Delete this wall"
    // ─────────────────────────────────────────────────────────
    if (text.includes('delete') || text.includes('remove')) {
      if (selectedElement) {
        return {
          success: true,
          understood: true,
          message: `Deleted selected ${selectedElement.type}.`,
          action: {
            action: selectedElement.type === 'room' ? 'DELETE_ROOM' : 'DELETE_WALL',
            objectId: selectedElement.id,
            description: `Delete ${selectedElement.type} ${selectedElement.id}`,
          },
        };
      }
      return {
        success: false,
        understood: true,
        message: 'Please select an element first to delete it.',
      };
    }

    // Fallback if not recognized
    return {
      success: false,
      understood: false,
      message: `I didn't quite catch that. Try commands like "Make this bedroom", "Make this wall 10 feet", "Fix my plan", or "Analyze plan".`,
    };
  }
}

// ============================================================
// AI Provider Singleton / Factory
// ============================================================

let currentAIProvider: FloorPlanAIProvider = new LocalFloorPlanAIProvider();

export function getAIProvider(): FloorPlanAIProvider {
  return currentAIProvider;
}

export function setAIProvider(provider: FloorPlanAIProvider): void {
  currentAIProvider = provider;
}
