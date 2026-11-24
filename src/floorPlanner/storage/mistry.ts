// Plan storage inside Mistry: one record in the app's `floorPlans` table (IndexedDB via Dexie).
// Mistry's cloud sync uploads the whole record, so the plan, its recent versions and its named
// snapshots reach Supabase with no extra work here.
import { db } from '../../db/db'
import type { FloorPlan, PlannerStoredSnapshot, PlannerStoredVersion } from '../../db/types'
import { parsePlan, type Plan } from '../model'
import { createBlankPlan } from './blankPlan'
import { ConflictError, type Loaded, type PlanStorage, type Saved, type VersionInfo } from './types'

export type SnapshotInfo = { id: string; name: string; rev?: number; createdAt?: string; author?: string }

/** Versions kept per plan. Each is a full copy of the plan, so the record stays small enough to sync. */
export const MAX_VERSIONS = 15
export const MAX_SNAPSHOTS = 20

const MM_PER_FOOT = 304.8

function toPlan(data: unknown): Plan {
  const parsed = parsePlan(data)
  if (!parsed.ok) throw new Error(parsed.error)
  return parsed.plan
}

/** The summary fields the rest of Mistry shows (lists, search, dashboard), taken from the plan. */
export function summaryFields(plan: Plan): Partial<FloorPlan> {
  return {
    buildingName: plan.name || 'Floor plan',
    plotWidth: Math.round((plan.site.width / MM_PER_FOOT) * 100) / 100,
    plotLength: Math.round((plan.site.depth / MM_PER_FOOT) * 100) / 100,
    unit: 'feet',
  }
}

export class MistryPlanStorage implements PlanStorage {
  readonly kind = 'local' as const
  readonly planId: string

  constructor(planId: string) {
    this.planId = planId
  }

  private async record(): Promise<FloorPlan> {
    const rec = await db.floorPlans.get(this.planId)
    if (!rec || rec.isDeleted) throw new Error('This floor plan was not found. It may have been deleted.')
    return rec
  }

  async load(): Promise<Loaded> {
    const rec = await this.record()
    let plan: Plan
    if (rec.plannerPlan) {
      plan = toPlan(rec.plannerPlan)
    } else {
      plan = { ...createBlankPlan(), name: rec.buildingName || 'New floor plan' }
    }
    return { plan, rev: rec.revision ?? 0, updatedAt: rec.updatedAt, author: plan.author }
  }

  async save(plan: Plan, baseRev: number, author = 'web'): Promise<Saved> {
    const now = new Date().toISOString()
    let saved: Saved | null = null
    await db.transaction('rw', db.floorPlans, async () => {
      const rec = await this.record()
      const rev = rec.revision ?? 0
      if (rev !== baseRev && rec.plannerPlan) throw new ConflictError(toPlan(rec.plannerPlan), rev)
      const nextRev = rev + 1
      const stored = { ...plan, rev: nextRev, updatedAt: now, author }
      const version: PlannerStoredVersion = {
        rev: nextRev,
        updatedAt: now,
        author,
        walls: plan.walls.length,
        openings: plan.openings.length,
        plan: stored,
      }
      const versions = [version, ...(rec.plannerVersions ?? [])].slice(0, MAX_VERSIONS)
      await db.floorPlans.put({
        ...rec,
        ...summaryFields(plan),
        engine: 'house-planner',
        plannerPlan: stored,
        plannerVersions: versions,
        revision: nextRev,
        updatedAt: now,
      })
      saved = { rev: nextRev, updatedAt: now }
    })
    return saved!
  }

  async list(): Promise<VersionInfo[]> {
    const rec = await this.record()
    return (rec.plannerVersions ?? []).map(({ plan: _plan, ...info }) => info)
  }

  async get(rev: number): Promise<Plan> {
    const rec = await this.record()
    const v = rec.plannerVersions?.find((x) => x.rev === rev)
    if (!v) throw new Error(`Version #${rev} is no longer kept.`)
    return toPlan(v.plan)
  }

  async snapshots(): Promise<SnapshotInfo[]> {
    const rec = await this.record()
    return (rec.plannerSnapshots ?? []).map(({ plan: _plan, ...info }) => info)
  }

  async saveSnapshot(name: string): Promise<SnapshotInfo> {
    let info: SnapshotInfo | null = null
    await db.transaction('rw', db.floorPlans, async () => {
      const rec = await this.record()
      if (!rec.plannerPlan) throw new Error('Draw something first, then save a version.')
      const snap: PlannerStoredSnapshot = {
        id: `snap-${Date.now().toString(36)}`,
        name,
        rev: rec.revision,
        createdAt: new Date().toISOString(),
        plan: rec.plannerPlan,
      }
      const snaps = [snap, ...(rec.plannerSnapshots ?? [])].slice(0, MAX_SNAPSHOTS)
      await db.floorPlans.put({ ...rec, plannerSnapshots: snaps, updatedAt: new Date().toISOString() })
      const { plan: _plan, ...rest } = snap
      info = rest
    })
    return info!
  }

  async snapshot(id: string): Promise<Plan> {
    const rec = await this.record()
    const s = rec.plannerSnapshots?.find((x) => x.id === id)
    if (!s) throw new Error('That saved version was not found.')
    return toPlan(s.plan)
  }
}
