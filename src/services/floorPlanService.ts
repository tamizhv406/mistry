import { db } from '../db/db';
import type {
  FloorPlan,
  User,
  FloorPlanLevel,
  FloorPlanWall,
  FloorPlanRoom,
  FloorPlanDoor,
  FloorPlanWindow,
  FloorPlanColumn,
  FloorPlanFurniture,
  FloorPlanUnit,
} from '../db/types';

const INITIAL_ADMIN_EMAIL =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_INITIAL_ADMIN_EMAIL) ||
  'tamilthilagan82@gmail.com';

function isElevatedUser(user: User): boolean {
  return (
    user.role === 'ADMIN' ||
    user.role === 'SUPER_ADMIN' ||
    user.role === 'SUB_ADMIN' ||
    (user.email || '').toLowerCase() === INITIAL_ADMIN_EMAIL.toLowerCase()
  );
}

/**
 * Create a new floor plan for a user
 */
export async function createFloorPlan(
  user: User,
  data: Omit<FloorPlan, 'id' | 'userId' | 'isDeleted' | 'createdAt' | 'updatedAt'>
): Promise<{ success: boolean; plan?: FloorPlan; error?: string }> {
  try {
    const now = new Date().toISOString();
    const plan: FloorPlan = {
      id: `fp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      userId: user.id,
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
      ...data,
      walls: data.walls ?? [],
      rooms: data.rooms ?? [],
      doors: data.doors ?? [],
      windows: data.windows ?? [],
    };
    await db.floorPlans.put(plan);
    await db.logActivity(
      user.id,
      user.fullName || user.username,
      user.role,
      plan.siteId,
      plan.siteName,
      'CREATE',
      `Created floor plan: ${plan.floorName} (${plan.buildingName})`
    );
    return { success: true, plan };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to create floor plan.' };
  }
}

/**
 * Get all floor plans for a user (scoped by userId, elevated users see all)
 */
export async function getFloorPlansForUser(user: User): Promise<FloorPlan[]> {
  if (isElevatedUser(user)) {
    return db.floorPlans
      .filter(fp => !fp.isDeleted)
      .reverse()
      .sortBy('createdAt');
  }
  return db.floorPlans
    .filter(fp => !fp.isDeleted && fp.userId === user.id)
    .reverse()
    .sortBy('createdAt');
}

/**
 * Get floor plans for a specific site (scoped by user)
 */
export async function getFloorPlansForSite(user: User, siteId: string): Promise<FloorPlan[]> {
  const all = await getFloorPlansForUser(user);
  return all.filter(fp => fp.siteId === siteId);
}

/**
 * Get a specific floor plan by ID (with ownership check)
 */
export async function getFloorPlanById(
  user: User,
  planId: string
): Promise<FloorPlan | null> {
  const plan = await db.floorPlans.get(planId);
  if (!plan || plan.isDeleted) return null;
  if (!isElevatedUser(user) && plan.userId !== user.id) {
    throw new Error('Access Denied: You do not have permission to view this floor plan.');
  }
  return plan;
}

/**
 * Update an existing floor plan
 */
export async function updateFloorPlan(
  user: User,
  planId: string,
  data: Partial<Omit<FloorPlan, 'id' | 'userId' | 'createdAt'>>
): Promise<{ success: boolean; error?: string }> {
  const plan = await db.floorPlans.get(planId);
  if (!plan) return { success: false, error: 'Floor plan not found.' };
  if (!isElevatedUser(user) && plan.userId !== user.id) {
    return { success: false, error: 'Access Denied: You cannot edit this floor plan.' };
  }
  try {
    await db.floorPlans.update(planId, {
      ...data,
      updatedAt: new Date().toISOString(),
    });
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to update floor plan.' };
  }
}

/**
 * Soft delete a floor plan (moves to recycle bin)
 */
export async function softDeleteFloorPlan(
  user: User,
  planId: string
): Promise<{ success: boolean; error?: string }> {
  const plan = await db.floorPlans.get(planId);
  if (!plan) return { success: false, error: 'Floor plan not found.' };
  if (!isElevatedUser(user) && plan.userId !== user.id) {
    return { success: false, error: 'Access Denied: You cannot delete this floor plan.' };
  }
  const now = new Date().toISOString();
  await db.floorPlans.update(planId, {
    isDeleted: true,
    deletedAt: now,
    updatedAt: now,
  });
  await db.logActivity(
    user.id,
    user.fullName || user.username,
    user.role,
    plan.siteId,
    plan.siteName,
    'SOFT_DELETE',
    `Moved floor plan to Recycle Bin: ${plan.floorName}`
  );
  return { success: true };
}

/**
 * Restore a soft-deleted floor plan
 */
export async function restoreFloorPlan(
  user: User,
  planId: string
): Promise<{ success: boolean; error?: string }> {
  const plan = await db.floorPlans.get(planId);
  if (!plan) return { success: false, error: 'Floor plan not found.' };
  if (!isElevatedUser(user) && plan.userId !== user.id) {
    return { success: false, error: 'Access Denied.' };
  }
  const now = new Date().toISOString();
  await db.floorPlans.update(planId, {
    isDeleted: false,
    deletedAt: undefined,
    updatedAt: now,
  });
  return { success: true };
}

/**
 * Duplicate a floor plan (deep copy with new ID)
 */
export async function duplicateFloorPlan(
  user: User,
  planId: string
): Promise<{ success: boolean; plan?: FloorPlan; error?: string }> {
  const original = await getFloorPlanById(user, planId);
  if (!original) return { success: false, error: 'Floor plan not found.' };

  const now = new Date().toISOString();
  const copy: FloorPlan = {
    ...JSON.parse(JSON.stringify(original)),
    id: `fp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    userId: user.id,
    floorName: `${original.floorName} (Copy)`,
    thumbnailDataUrl: undefined,
    isDeleted: false,
    deletedAt: undefined,
    createdAt: now,
    updatedAt: now,
    walls: original.walls.map(w => ({ ...w, id: `wall-${Date.now()}-${Math.random().toString(36).slice(2, 5)}` })),
    rooms: original.rooms.map(r => ({ ...r, id: `room-${Date.now()}-${Math.random().toString(36).slice(2, 5)}` })),
    doors: original.doors.map(d => ({ ...d, id: `door-${Date.now()}-${Math.random().toString(36).slice(2, 5)}` })),
    windows: original.windows.map(w => ({ ...w, id: `win-${Date.now()}-${Math.random().toString(36).slice(2, 5)}` })),
  };

  await db.floorPlans.put(copy);
  return { success: true, plan: copy };
}

/**
 * Permanently delete a floor plan (no recovery)
 */
export async function permanentlyDeleteFloorPlan(
  user: User,
  planId: string
): Promise<{ success: boolean; error?: string }> {
  const plan = await db.floorPlans.get(planId);
  if (!plan) return { success: false, error: 'Floor plan not found.' };
  if (!isElevatedUser(user) && plan.userId !== user.id) {
    return { success: false, error: 'Access Denied.' };
  }
  await db.floorPlans.delete(planId);
  return { success: true };
}

/**
 * Get recently updated floor plans (for dashboard)
 */
export async function getRecentFloorPlans(user: User, limit = 5): Promise<FloorPlan[]> {
  const all = await getFloorPlansForUser(user);
  return all
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, limit);
}

/**
 * Save a named version snapshot of a floor plan
 */
export async function saveFloorPlanVersion(
  user: User,
  planId: string,
  note = 'Manual Snapshot'
): Promise<{ success: boolean; versionNumber?: number; error?: string }> {
  const plan = await getFloorPlanById(user, planId);
  if (!plan) return { success: false, error: 'Floor plan not found.' };

  const versions = plan.versionHistory || [];
  const nextVer = versions.length + 1;
  const snapshotData = {
    walls: plan.walls,
    rooms: plan.rooms,
    doors: plan.doors,
    windows: plan.windows,
    furniture: plan.furniture,
    stairs: plan.stairs,
    columns: plan.columns,
    annotations: plan.annotations,
    floors: plan.floors,
    layers: plan.layers,
  };

  const newVersion = {
    versionId: `v-${Date.now()}`,
    versionNumber: nextVer,
    timestamp: new Date().toISOString(),
    note,
    snapshot: JSON.stringify(snapshotData),
  };

  const updatedVersions = [newVersion, ...versions].slice(0, 20); // Keep last 20
  await db.floorPlans.update(planId, {
    versionHistory: updatedVersions,
    updatedAt: new Date().toISOString(),
  });

  return { success: true, versionNumber: nextVer };
}

/**
 * Restore a previous version snapshot of a floor plan
 */
export async function restoreFloorPlanVersion(
  user: User,
  planId: string,
  versionId: string
): Promise<{ success: boolean; error?: string }> {
  const plan = await getFloorPlanById(user, planId);
  if (!plan) return { success: false, error: 'Floor plan not found.' };

  const version = plan.versionHistory?.find(v => v.versionId === versionId);
  if (!version) return { success: false, error: 'Version not found.' };

  try {
    const data = JSON.parse(version.snapshot);
    await db.floorPlans.update(planId, {
      ...data,
      updatedAt: new Date().toISOString(),
    });
    return { success: true };
  } catch (err: any) {
    return { success: false, error: 'Failed to restore snapshot: ' + err.message };
  }
}

/**
 * Standard starter templates (with realistic layout geometry)
 */
export interface FloorPlanStarterTemplate {
  id: string;
  name: string;
  description: string;
  bhk: string;
  plotLength: number;
  plotWidth: number;
  unit: 'feet' | 'meters';
  walls: any[];
  rooms: any[];
  doors: any[];
  windows: any[];
  furniture?: any[];
}

export const STARTER_TEMPLATES: FloorPlanStarterTemplate[] = [
  {
    id: 'tpl-1bhk',
    name: 'Compact 1 BHK (30 × 20 ft)',
    description: 'Living room, master bedroom, kitchen, attached bath & balcony (600 sq.ft)',
    bhk: '1 BHK',
    plotLength: 30,
    plotWidth: 20,
    unit: 'feet',
    walls: [
      { id: 'w-1', x1: 0, y1: 0, x2: 30, y2: 0, thickness: 0.75, wallType: 'exterior' },
      { id: 'w-2', x1: 30, y1: 0, x2: 30, y2: 20, thickness: 0.75, wallType: 'exterior' },
      { id: 'w-3', x1: 30, y1: 20, x2: 0, y2: 20, thickness: 0.75, wallType: 'exterior' },
      { id: 'w-4', x1: 0, y1: 20, x2: 0, y2: 0, thickness: 0.75, wallType: 'exterior' },
      { id: 'w-5', x1: 16, y1: 0, x2: 16, y2: 20, thickness: 0.5, wallType: 'interior' },
      { id: 'w-6', x1: 16, y1: 12, x2: 30, y2: 12, thickness: 0.5, wallType: 'interior' },
    ],
    rooms: [
      { id: 'r-1', roomType: 'Living Room', label: 'Living & Dining', x: 0, y: 0, width: 16, height: 20, rotation: 0 },
      { id: 'r-2', roomType: 'Bedroom', label: 'Master Bedroom', x: 16, y: 0, width: 14, height: 12, rotation: 0 },
      { id: 'r-3', roomType: 'Kitchen', label: 'Kitchen', x: 16, y: 12, width: 14, height: 8, rotation: 0 },
    ],
    doors: [
      { id: 'd-1', doorType: 'Main Entrance', x: 0.5, y: 10, width: 3.5, rotation: 0, swingAngle: 90 },
      { id: 'd-2', doorType: 'Single', x: 16, y: 6, width: 3, rotation: 90, swingAngle: 90 },
      { id: 'd-3', doorType: 'Single', x: 16, y: 16, width: 3, rotation: 90, swingAngle: 90 },
    ],
    windows: [
      { id: 'wn-1', windowType: 'Large', x: 2, y: 0, width: 5, rotation: 0 },
      { id: 'wn-2', windowType: 'Standard', x: 20, y: 0, width: 4, rotation: 0 },
      { id: 'wn-3', windowType: 'Standard', x: 28, y: 16, width: 3, rotation: 90 },
    ],
  },
  {
    id: 'tpl-2bhk',
    name: 'Modern 2 BHK (40 × 30 ft)',
    description: 'Spacious hall, 2 bedrooms, 2 baths, kitchen & utility (1200 sq.ft)',
    bhk: '2 BHK',
    plotLength: 40,
    plotWidth: 30,
    unit: 'feet',
    walls: [
      { id: 'w-1', x1: 0, y1: 0, x2: 40, y2: 0, thickness: 0.75, wallType: 'exterior' },
      { id: 'w-2', x1: 40, y1: 0, x2: 40, y2: 30, thickness: 0.75, wallType: 'exterior' },
      { id: 'w-3', x1: 40, y1: 30, x2: 0, y2: 30, thickness: 0.75, wallType: 'exterior' },
      { id: 'w-4', x1: 0, y1: 30, x2: 0, y2: 0, thickness: 0.75, wallType: 'exterior' },
      { id: 'w-5', x1: 22, y1: 0, x2: 22, y2: 30, thickness: 0.5, wallType: 'interior' },
      { id: 'w-6', x1: 22, y1: 15, x2: 40, y2: 15, thickness: 0.5, wallType: 'interior' },
      { id: 'w-7', x1: 0, y1: 18, x2: 22, y2: 18, thickness: 0.5, wallType: 'interior' },
    ],
    rooms: [
      { id: 'r-1', roomType: 'Living Room', label: 'Living Room', x: 0, y: 0, width: 22, height: 18, rotation: 0 },
      { id: 'r-2', roomType: 'Kitchen', label: 'Kitchen & Dining', x: 0, y: 18, width: 22, height: 12, rotation: 0 },
      { id: 'r-3', roomType: 'Master Bedroom', label: 'Master Bedroom', x: 22, y: 0, width: 18, height: 15, rotation: 0 },
      { id: 'r-4', roomType: 'Bedroom', label: 'Bed Room 2', x: 22, y: 15, width: 18, height: 15, rotation: 0 },
    ],
    doors: [
      { id: 'd-1', doorType: 'Main Entrance', x: 1, y: 9, width: 3.5, rotation: 0, swingAngle: 90 },
      { id: 'd-2', doorType: 'Single', x: 22, y: 6, width: 3, rotation: 90, swingAngle: 90 },
      { id: 'd-3', doorType: 'Single', x: 22, y: 22, width: 3, rotation: 90, swingAngle: 90 },
    ],
    windows: [
      { id: 'wn-1', windowType: 'Large', x: 6, y: 0, width: 6, rotation: 0 },
      { id: 'wn-2', windowType: 'Standard', x: 28, y: 0, width: 4, rotation: 0 },
      { id: 'wn-3', windowType: 'Standard', x: 28, y: 30, width: 4, rotation: 0 },
    ],
  },
  {
    id: 'tpl-3bhk',
    name: 'Luxury 3 BHK Villa (50 × 35 ft)',
    description: '3 bedrooms, pooja room, dining, open kitchen, 3 bathrooms (1750 sq.ft)',
    bhk: '3 BHK',
    plotLength: 50,
    plotWidth: 35,
    unit: 'feet',
    walls: [
      { id: 'w-1', x1: 0, y1: 0, x2: 50, y2: 0, thickness: 0.75, wallType: 'exterior' },
      { id: 'w-2', x1: 50, y1: 0, x2: 50, y2: 35, thickness: 0.75, wallType: 'exterior' },
      { id: 'w-3', x1: 50, y1: 35, x2: 0, y2: 35, thickness: 0.75, wallType: 'exterior' },
      { id: 'w-4', x1: 0, y1: 35, x2: 0, y2: 0, thickness: 0.75, wallType: 'exterior' },
      { id: 'w-5', x1: 26, y1: 0, x2: 26, y2: 35, thickness: 0.5, wallType: 'interior' },
      { id: 'w-6', x1: 26, y1: 18, x2: 50, y2: 18, thickness: 0.5, wallType: 'interior' },
      { id: 'w-7', x1: 0, y1: 20, x2: 26, y2: 20, thickness: 0.5, wallType: 'interior' },
    ],
    rooms: [
      { id: 'r-1', roomType: 'Living Room', label: 'Grand Living Hall', x: 0, y: 0, width: 26, height: 20, rotation: 0 },
      { id: 'r-2', roomType: 'Kitchen', label: 'Modular Kitchen', x: 0, y: 20, width: 16, height: 15, rotation: 0 },
      { id: 'r-3', roomType: 'Pooja', label: 'Pooja Room', x: 16, y: 20, width: 10, height: 15, rotation: 0 },
      { id: 'r-4', roomType: 'Master Bedroom', label: 'Master Suite', x: 26, y: 0, width: 24, height: 18, rotation: 0 },
      { id: 'r-5', roomType: 'Bedroom', label: 'Guest Bedroom', x: 26, y: 18, width: 24, height: 17, rotation: 0 },
    ],
    doors: [
      { id: 'd-1', doorType: 'Main Entrance', x: 1, y: 10, width: 4, rotation: 0, swingAngle: 90 },
      { id: 'd-2', doorType: 'Single', x: 26, y: 8, width: 3, rotation: 90, swingAngle: 90 },
      { id: 'd-3', doorType: 'Single', x: 26, y: 25, width: 3, rotation: 90, swingAngle: 90 },
    ],
    windows: [
      { id: 'wn-1', windowType: 'Large', x: 8, y: 0, width: 6, rotation: 0 },
      { id: 'wn-2', windowType: 'Large', x: 35, y: 0, width: 6, rotation: 0 },
      { id: 'wn-3', windowType: 'Standard', x: 35, y: 35, width: 4, rotation: 0 },
    ],
  },
];

// ============================================================
// CAD DXF & Structured Project JSON Export / Import
// ============================================================

export function exportFloorPlanAsProjectJson(
  plan: FloorPlan,
  floors?: FloorPlanLevel[],
  activeFloorIndex?: number
): string {
  const exportPayload = {
    application: 'Building Mistry CAD',
    schemaVersion: '2.0.0',
    project: {
      id: plan.id,
      name: plan.buildingName,
      floorName: plan.floorName,
      units: plan.unit,
      plotWidth: plan.plotWidth,
      plotLength: plan.plotLength,
      createdAt: plan.createdAt,
      updatedAt: plan.updatedAt,
    },
    activeFloorIndex: activeFloorIndex ?? 0,
    floors:
      floors && floors.length > 0
        ? floors
        : plan.floors && plan.floors.length > 0
        ? plan.floors
        : [
            {
              id: 'ground-floor',
              name: plan.floorName || 'Ground Floor',
              elevation: 0,
              walls: plan.walls || [],
              rooms: plan.rooms || [],
              doors: plan.doors || [],
              windows: plan.windows || [],
              furniture: plan.furniture || [],
              stairs: plan.stairs || [],
              columns: plan.columns || [],
              annotations: plan.annotations || [],
              dimensions: plan.dimensions || [],
            },
          ],
    layers: plan.layers || [],
  };
  return JSON.stringify(exportPayload, null, 2);
}

export function exportFloorPlanAsDxf(
  plan: FloorPlan,
  walls?: FloorPlanWall[],
  rooms?: FloorPlanRoom[],
  doors?: FloorPlanDoor[],
  windows?: FloorPlanWindow[],
  columns?: FloorPlanColumn[],
  furniture?: FloorPlanFurniture[],
  unit?: FloorPlanUnit
): string {
  const lines: string[] = [];
  const planWalls = walls ?? plan.walls ?? [];
  const planRooms = rooms ?? plan.rooms ?? [];
  const planDoors = doors ?? plan.doors ?? [];
  const planWindows = windows ?? plan.windows ?? [];
  const planColumns = columns ?? plan.columns ?? [];
  const planFurniture = furniture ?? plan.furniture ?? [];

  // DXF Header
  lines.push('0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1015\n0\nENDSEC');

  // DXF Tables & Layers
  lines.push('0\nSECTION\n2\nTABLES\n0\nTABLE\n2\nLAYER');
  lines.push('0\nLAYER\n2\nWALLS\n70\n0\n62\n7\n6\nCONTINUOUS');
  lines.push('0\nLAYER\n2\nA-WALL\n70\n0\n62\n7\n6\nCONTINUOUS');
  lines.push('0\nLAYER\n2\nDOORS\n70\n0\n62\n1\n6\nCONTINUOUS');
  lines.push('0\nLAYER\n2\nA-DOOR\n70\n0\n62\n1\n6\nCONTINUOUS');
  lines.push('0\nLAYER\n2\nWINDOWS\n70\n0\n62\n4\n6\nCONTINUOUS');
  lines.push('0\nLAYER\n2\nA-GLAZ\n70\n0\n62\n4\n6\nCONTINUOUS');
  lines.push('0\nLAYER\n2\nFURNITURE\n70\n0\n62\n3\n6\nCONTINUOUS');
  lines.push('0\nLAYER\n2\nA-FURN\n70\n0\n62\n3\n6\nCONTINUOUS');
  lines.push('0\nLAYER\n2\nCOLUMNS\n70\n0\n62\n5\n6\nCONTINUOUS');
  lines.push('0\nLAYER\n2\nA-COLS\n70\n0\n62\n5\n6\nCONTINUOUS');
  lines.push('0\nLAYER\n2\nDIMENSIONS\n70\n0\n62\n2\n6\nCONTINUOUS');
  lines.push('0\nLAYER\n2\nA-ANNO\n70\n0\n62\n2\n6\nCONTINUOUS');
  lines.push('0\nENDTAB\n0\nENDSEC');

  // DXF Entities
  lines.push('0\nSECTION\n2\nENTITIES');

  // Walls
  for (const w of planWalls) {
    lines.push(
      `0\nLINE\n8\nWALLS\n10\n${w.x1.toFixed(3)}\n20\n${w.y1.toFixed(3)}\n30\n0.0\n11\n${w.x2.toFixed(3)}\n21\n${w.y2.toFixed(3)}\n31\n0.0`
    );
  }

  // Doors
  for (const d of planDoors) {
    lines.push(
      `0\nCIRCLE\n8\nDOORS\n10\n${d.x.toFixed(3)}\n20\n${d.y.toFixed(3)}\n30\n0.0\n40\n${(d.width / 2).toFixed(3)}`
    );
  }

  // Windows
  for (const win of planWindows) {
    lines.push(
      `0\nLINE\n8\nWINDOWS\n10\n${win.x.toFixed(3)}\n20\n${win.y.toFixed(3)}\n30\n0.0\n11\n${(win.x + win.width).toFixed(3)}\n21\n${win.y.toFixed(3)}\n31\n0.0`
    );
  }

  // Columns
  for (const col of planColumns) {
    const halfW = (col.width || 1) / 2;
    const halfD = (col.depth || col.width || 1) / 2;
    lines.push(
      `0\nLINE\n8\nCOLUMNS\n10\n${(col.x - halfW).toFixed(3)}\n20\n${(col.y - halfD).toFixed(3)}\n30\n0.0\n11\n${(col.x + halfW).toFixed(3)}\n21\n${(col.y - halfD).toFixed(3)}\n31\n0.0`
    );
    lines.push(
      `0\nLINE\n8\nCOLUMNS\n10\n${(col.x + halfW).toFixed(3)}\n20\n${(col.y - halfD).toFixed(3)}\n30\n0.0\n11\n${(col.x + halfW).toFixed(3)}\n21\n${(col.y + halfD).toFixed(3)}\n31\n0.0`
    );
    lines.push(
      `0\nLINE\n8\nCOLUMNS\n10\n${(col.x + halfW).toFixed(3)}\n20\n${(col.y + halfD).toFixed(3)}\n30\n0.0\n11\n${(col.x - halfW).toFixed(3)}\n21\n${(col.y + halfD).toFixed(3)}\n31\n0.0`
    );
    lines.push(
      `0\nLINE\n8\nCOLUMNS\n10\n${(col.x - halfW).toFixed(3)}\n20\n${(col.y + halfD).toFixed(3)}\n30\n0.0\n11\n${(col.x - halfW).toFixed(3)}\n21\n${(col.y - halfD).toFixed(3)}\n31\n0.0`
    );
  }

  // Furniture
  for (const f of planFurniture) {
    const text = `${f.label || f.itemType}`;
    lines.push(
      `0\nTEXT\n8\nFURNITURE\n10\n${f.x.toFixed(3)}\n20\n${f.y.toFixed(3)}\n30\n0.0\n40\n0.8\n1\n${text}`
    );
  }

  // Rooms Labels
  for (const r of planRooms) {
    const text = `${r.label || r.roomType}`;
    lines.push(
      `0\nTEXT\n8\nDIMENSIONS\n10\n${(r.x + r.width / 2).toFixed(3)}\n20\n${(r.y + r.height / 2).toFixed(3)}\n30\n0.0\n40\n1.0\n1\n${text}`
    );
  }

  // Footer
  lines.push('0\nENDSEC\n0\nEOF');

  return lines.join('\n');
}

export function createStarterFloorPlan(
  userOrId?: User | string,
  siteIdOrName?: string,
  unit: FloorPlanUnit = 'feet'
): FloorPlan {
  const now = new Date().toISOString();
  const userId =
    typeof userOrId === 'object' && userOrId !== null
      ? userOrId.id
      : typeof userOrId === 'string'
      ? userOrId
      : 'user-cad';
  const buildingName =
    typeof userOrId === 'string' && siteIdOrName
      ? siteIdOrName
      : 'Architectural Starter Plan';
  const siteId =
    typeof userOrId === 'object' && userOrId !== null ? siteIdOrName : undefined;

  return {
    id: typeof userOrId === 'string' ? userOrId : `fp-starter-${Date.now()}`,
    userId,
    siteId,
    buildingName,
    floorName: 'Ground Floor',
    plotLength: 30,
    plotWidth: 40,
    unit,
    walls: [
      // Outer Perimeter (30 ft x 40 ft)
      { id: 'w-ext-1', x1: 0, y1: 0, x2: 40, y2: 0, thickness: 0.75, wallType: 'exterior' },
      { id: 'w-ext-2', x1: 40, y1: 0, x2: 40, y2: 30, thickness: 0.75, wallType: 'exterior' },
      { id: 'w-ext-3', x1: 40, y1: 30, x2: 0, y2: 30, thickness: 0.75, wallType: 'exterior' },
      { id: 'w-ext-4', x1: 0, y1: 30, x2: 0, y2: 0, thickness: 0.75, wallType: 'exterior' },
      // Interior Dividing Walls
      { id: 'w-int-1', x1: 22, y1: 0, x2: 22, y2: 30, thickness: 0.5, wallType: 'interior' },
      { id: 'w-int-2', x1: 22, y1: 15, x2: 40, y2: 15, thickness: 0.5, wallType: 'interior' },
      { id: 'w-int-3', x1: 0, y1: 18, x2: 22, y2: 18, thickness: 0.5, wallType: 'interior' },
      { id: 'w-int-4', x1: 14, y1: 18, x2: 14, y2: 30, thickness: 0.5, wallType: 'interior' },
      { id: 'w-int-5', x1: 34, y1: 15, x2: 34, y2: 30, thickness: 0.5, wallType: 'interior' },
    ],
    rooms: [
      { id: 'r-1', roomType: 'Living Room', label: 'Living Room', x: 0, y: 0, width: 22, height: 18, area: 396, rotation: 0 },
      { id: 'r-2', roomType: 'Kitchen', label: 'Kitchen & Dining', x: 0, y: 18, width: 14, height: 12, area: 168, rotation: 0 },
      { id: 'r-3', roomType: 'Toilet', label: 'Toilet', x: 14, y: 18, width: 8, height: 12, area: 96, rotation: 0 },
      { id: 'r-4', roomType: 'Master Bedroom', label: 'Master Bedroom', x: 22, y: 0, width: 18, height: 15, area: 270, rotation: 0 },
      { id: 'r-5', roomType: 'Bedroom', label: 'Bedroom 2', x: 22, y: 15, width: 12, height: 15, area: 180, rotation: 0 },
      { id: 'r-6', roomType: 'Bathroom', label: 'Attached Bath', x: 34, y: 15, width: 6, height: 15, area: 90, rotation: 0 },
    ],
    doors: [
      { id: 'd-1', doorType: 'Main Entrance', x: 1, y: 8, width: 3.5, rotation: 0, swingAngle: 90 },
      { id: 'd-2', doorType: 'Single', x: 22, y: 5, width: 3, rotation: 90, swingAngle: 90 },
      { id: 'd-3', doorType: 'Single', x: 22, y: 20, width: 3, rotation: 90, swingAngle: 90 },
      { id: 'd-4', doorType: 'Bathroom', x: 14, y: 22, width: 2.5, rotation: 90, swingAngle: 90 },
      { id: 'd-5', doorType: 'Bathroom', x: 34, y: 20, width: 2.5, rotation: 90, swingAngle: 90 },
    ],
    windows: [
      { id: 'wn-1', windowType: 'Large', x: 6, y: 0, width: 6, rotation: 0 },
      { id: 'wn-2', windowType: 'Standard', x: 28, y: 0, width: 4, rotation: 0 },
      { id: 'wn-3', windowType: 'Standard', x: 26, y: 30, width: 4, rotation: 0 },
      { id: 'wn-4', windowType: 'Ventilator', x: 36, y: 30, width: 2, rotation: 0 },
      { id: 'wn-5', windowType: 'Standard', x: 4, y: 30, width: 4, rotation: 0 },
    ],
    columns: [
      { id: 'col-1', x: 0, y: 0, width: 1, depth: 1, shape: 'rectangular' },
      { id: 'col-2', x: 22, y: 0, width: 1, depth: 1, shape: 'rectangular' },
      { id: 'col-3', x: 40, y: 0, width: 1, depth: 1, shape: 'rectangular' },
      { id: 'col-4', x: 0, y: 18, width: 1, depth: 1, shape: 'rectangular' },
      { id: 'col-5', x: 22, y: 18, width: 1, depth: 1, shape: 'rectangular' },
      { id: 'col-6', x: 40, y: 18, width: 1, depth: 1, shape: 'rectangular' },
      { id: 'col-7', x: 0, y: 30, width: 1, depth: 1, shape: 'rectangular' },
      { id: 'col-8', x: 22, y: 30, width: 1, depth: 1, shape: 'rectangular' },
      { id: 'col-9', x: 40, y: 30, width: 1, depth: 1, shape: 'rectangular' },
    ],
    furniture: [
      { id: 'f-1', category: 'living', itemType: '3-Seater Sofa', label: 'Sofa', x: 4, y: 3, width: 7, height: 3, rotation: 0 },
      { id: 'f-2', category: 'living', itemType: 'Wall Mounted TV', label: 'Smart TV', x: 12, y: 0.3, width: 4, height: 0.5, rotation: 0, wallMounted: true },
      { id: 'f-3', category: 'dining', itemType: '4-seat Dining Table', label: 'Dining Table', x: 3, y: 21, width: 3.5, height: 3.5, rotation: 0 },
      { id: 'f-4', category: 'bedroom', itemType: 'King Bed', label: 'King Bed', x: 26, y: 3, width: 6, height: 6.5, rotation: 0 },
      { id: 'f-5', category: 'bedroom', itemType: 'Split AC Indoor Unit', label: 'Inverter AC', x: 34, y: 0.4, width: 3.5, height: 0.8, rotation: 0, wallMounted: true },
      { id: 'f-6', category: 'bathroom', itemType: 'Toilet', label: 'WC Toilet', x: 16, y: 24, width: 2, height: 2.5, rotation: 0 },
      { id: 'f-7', category: 'bathroom', itemType: 'Wash Basin', label: 'Wash Basin', x: 19, y: 20, width: 2, height: 1.5, rotation: 0 },
    ],
    floors: [
      {
        id: 'lvl-ground',
        name: 'Ground Floor',
        elevation: 0,
        walls: [],
        rooms: [],
        doors: [],
        windows: [],
        furniture: [],
      },
    ],
    layers: [
      { id: 'layer-walls', name: 'Walls', visible: true, locked: false },
      { id: 'layer-rooms', name: 'Rooms', visible: true, locked: false },
      { id: 'layer-doors', name: 'Doors', visible: true, locked: false },
      { id: 'layer-windows', name: 'Windows', visible: true, locked: false },
      { id: 'layer-columns', name: 'Columns', visible: true, locked: false },
      { id: 'layer-furniture', name: 'Furniture', visible: true, locked: false },
      { id: 'layer-dimensions', name: 'Dimensions', visible: true, locked: false },
    ],
    isDeleted: false,
    createdAt: now,
    updatedAt: now,
  };
}
