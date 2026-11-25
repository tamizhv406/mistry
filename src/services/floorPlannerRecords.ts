/**
 * Floor plan records as the rest of Mistry sees them: creating one for the Floor Planner
 * (src/floorPlanner), and reading the few figures lists and cards show.
 *
 * A plan made with the Floor Planner keeps its drawing in `plannerPlan` (millimetres, the
 * planner's own format). Records without `engine` were made by the planner Mistry had before
 * 2026-11-24; they are kept so no data is lost, but the new planner cannot open them.
 */
import { db } from '../db/db';
import type { FloorPlan, Site, User } from '../db/types';
import { cloneTemplateFloorPlan, type HouseTemplate } from '../domain/houseTemplates';

const SQFT_PER_M2 = 10.7639104;

function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `fp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export const isPlannerRecord = (plan: FloorPlan) => plan.engine === 'house-planner';

interface PlannerShape {
  walls?: unknown[];
  openings?: unknown[];
  rooms?: unknown[];
  site?: { width?: number; depth?: number };
}

const shapeOf = (plan: FloorPlan): PlannerShape =>
  plan.plannerPlan && typeof plan.plannerPlan === 'object' ? (plan.plannerPlan as PlannerShape) : {};

/** Wall, opening and room counts for a list card. */
export function planCounts(plan: FloorPlan): { walls: number; openings: number; rooms: number } {
  if (!isPlannerRecord(plan)) {
    return {
      walls: plan.walls?.length ?? 0,
      openings: (plan.doors?.length ?? 0) + (plan.windows?.length ?? 0),
      rooms: plan.rooms?.length ?? 0,
    };
  }
  const p = shapeOf(plan);
  return { walls: p.walls?.length ?? 0, openings: p.openings?.length ?? 0, rooms: p.rooms?.length ?? 0 };
}

/** Plot size in feet for a card, e.g. "30' × 40'". */
export function plotText(plan: FloorPlan): string {
  const w = Math.round(plan.plotWidth || 0);
  const l = Math.round(plan.plotLength || 0);
  if (!w || !l) return '';
  if (isPlannerRecord(plan) || plan.unit === 'feet' || plan.unit === 'inches') return `${w}' × ${l}'`;
  return `${w} × ${l} m`;
}

/** Plot area in sq.ft, from the plot size. */
export function plotAreaSqFt(plan: FloorPlan): number {
  const w = plan.plotWidth || 0;
  const l = plan.plotLength || 0;
  if (isPlannerRecord(plan) || plan.unit === 'feet' || plan.unit === 'inches') return w * l;
  return w * l * SQFT_PER_M2;
}

/** Floor plans this user may see, newest first. */
export async function listFloorPlans(user: User, siteId?: string | null): Promise<FloorPlan[]> {
  const isAdmin = user.role === 'SUPER_ADMIN' || user.role === 'ADMIN';
  const plans = await db.floorPlans
    .filter(fp => !fp.isDeleted && (isAdmin || fp.userId === user.id) && (!siteId || fp.siteId === siteId))
    .toArray();
  return plans.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
}

/**
 * A new Floor Planner record. Without `plannerPlan` the planner fills in the drawing the first
 * time it opens the record (a blank plot with 9" and 4.5" brick walls ready); with one (a house
 * template) it opens that drawing. The plot size comes from the drawing's site when not given.
 */
export async function createPlannerRecord(
  user: User,
  options: {
    name: string;
    floorName?: string;
    site?: Site | null;
    plannerPlan?: unknown;
    plotWidth?: number;
    plotLength?: number;
  }
): Promise<FloorPlan> {
  const now = new Date().toISOString();
  const hasTemplate = Boolean(options.plannerPlan && typeof options.plannerPlan === 'object');
  const p = (hasTemplate ? options.plannerPlan : null) as { site?: { width?: number; depth?: number } } | null;
  const computedW = options.plotWidth ?? (p?.site?.width ? Math.round((p.site.width / 304.8) * 100) / 100 : 0);
  const computedL = options.plotLength ?? (p?.site?.depth ? Math.round((p.site.depth / 304.8) * 100) / 100 : 0);

  const record: FloorPlan = {
    id: newId(),
    userId: user.id,
    siteId: options.site?.id,
    siteName: options.site?.name,
    buildingName: options.name.trim() || 'New floor plan',
    floorName: options.floorName?.trim() || 'Ground Floor',
    plotLength: computedL,
    plotWidth: computedW,
    unit: 'feet',
    walls: [],
    rooms: [],
    doors: [],
    windows: [],
    engine: 'house-planner',
    ...(hasTemplate ? { plannerPlan: JSON.parse(JSON.stringify(options.plannerPlan)) } : {}),
    revision: 0,
    status: 'draft',
    isDeleted: false,
    createdAt: now,
    updatedAt: now,
  };
  await db.floorPlans.put(record);
  return record;
}

/**
 * Plans from a house template, one record per floor (a Duplex gives "Ground Floor" and
 * "First Floor"), each with its own copy of the drawing. Returns them in floor order; the
 * first one is the plan to open.
 */
export async function createRecordsFromTemplate(
  user: User,
  template: HouseTemplate,
  options: { name?: string; site?: Site | null } = {}
): Promise<FloorPlan[]> {
  const name = options.name?.trim() || (options.site ? `${options.site.name} – ${template.title}` : template.title);
  const records: FloorPlan[] = [];
  for (const floor of template.floors) {
    records.push(
      await createPlannerRecord(user, {
        name,
        floorName: floor.label,
        site: options.site,
        plannerPlan: cloneTemplateFloorPlan(template, floor.floorIndex, name),
        plotWidth: template.plotWidthFt,
        plotLength: template.plotDepthFt,
      })
    );
  }
  return records;
}

/** Rename a plan in the list. The planner shows the same name in its header. */
export async function renamePlannerRecord(plan: FloorPlan, name: string): Promise<void> {
  const clean = name.trim();
  if (!clean) return;
  const now = new Date().toISOString();
  const next: FloorPlan = { ...plan, buildingName: clean, updatedAt: now };
  if (isPlannerRecord(plan) && plan.plannerPlan && typeof plan.plannerPlan === 'object') {
    next.plannerPlan = { ...(plan.plannerPlan as object), name: clean };
  }
  await db.floorPlans.put(next);
}

/** The page the Floor Planner runs in, for the frame that hosts it. */
export function plannerUrl(planId: string): string {
  return `${import.meta.env.BASE_URL}floor-planner.html?plan=${encodeURIComponent(planId)}`;
}
