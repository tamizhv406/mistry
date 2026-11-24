import { create } from 'zustand'
import { parsePlan, type Plan } from '../model'
import { t } from '../i18n'
import { usePlanStore } from '../store/planStore'
import { showToast } from '../ui/Toast'
import { isViewOnly } from '../store/viewOnly'
import { MistryPlanStorage } from './mistry'
import { ConflictError, type VersionInfo } from './types'

export type SyncStatus = 'loading' | 'saving' | 'saved' | 'error'

type SyncState = {
  status: SyncStatus
  savedAt: string | null
  rev: number | null
  error: string | null
}

export const useSyncStore = create<SyncState>()(() => ({
  status: 'loading',
  savedAt: null,
  rev: null,
  error: null,
}))

// Set by startSync() with the id of the Mistry floor plan record being edited.
export let serverStorage: MistryPlanStorage = new MistryPlanStorage('')

const MERGE_KEYS = ['walls', 'openings', 'furniture', 'materials'] as const

const sync = useSyncStore.setState

let confirmed: Plan | null = null
let loading = false
let inFlight = false
let started = false
let nextAuthor: string | null = null

function applyServer(plan: Plan, rev: number, fit: boolean) {
  confirmed = plan
  loading = true
  usePlanStore.getState().loadPlan(plan, { fit })
  loading = false
  sync({ rev, status: 'saved', savedAt: plan.updatedAt ?? new Date().toISOString(), error: null })
}

function fail(e: unknown) {
  sync({ status: 'error', error: (e as Error).message })
}

export async function loadFromServer(fit = true) {
  sync({ status: usePlanStore.getState().plan ? useSyncStore.getState().status : 'loading' })
  try {
    const { plan, rev } = await serverStorage.load()
    applyServer(plan, rev, fit)
  } catch (e) {
    fail(e)
  }
}

const byId = <T extends { id: string }>(list: T[] | undefined) => new Map((list ?? []).map((x) => [x.id, x]))
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

function mergeOnto(server: Plan, base: Plan, mine: Plan): Plan {
  const out: Record<string, unknown> = { ...server }
  for (const key of MERGE_KEYS) {
    const b = byId(base[key] as { id: string }[])
    const m = byId(mine[key] as { id: string }[])
    const s = byId(server[key] as { id: string }[])
    for (const [id, item] of m) {
      if (!b.has(id) || !same(b.get(id), item)) s.set(id, item)
    }
    for (const id of b.keys()) if (!m.has(id)) s.delete(id)
    out[key] = [...s.values()]
  }
  for (const key of Object.keys(mine) as (keyof Plan)[]) {
    if ((MERGE_KEYS as readonly string[]).includes(key) || key === 'rev' || key === 'updatedAt' || key === 'author') continue
    if (!same(mine[key], base[key])) out[key] = mine[key]
  }
  const parsed = parsePlan(out)
  if (!parsed.ok) throw new Error(parsed.error)
  return parsed.plan
}

function rollback(message: string) {
  if (confirmed) {
    loading = true
    usePlanStore.getState().loadPlan(confirmed)
    loading = false
  }
  showToast(message)
}

async function push() {
  if (inFlight) return
  const plan = usePlanStore.getState().plan
  const { rev } = useSyncStore.getState()
  if (!plan || !confirmed || rev === null || plan === confirmed) return
  if (isViewOnly()) {
    loading = true
    usePlanStore.getState().loadPlan(confirmed)
    loading = false
    return
  }
  inFlight = true
  sync({ status: 'saving' })
  const base = confirmed
  try {
    let saved
    const author = nextAuthor ?? 'web'
    nextAuthor = null
    try {
      saved = await serverStorage.save(plan, rev, author)
    } catch (e) {
      if (!(e instanceof ConflictError)) throw e
      let merged: Plan
      try {
        merged = mergeOnto(e.plan, base, plan)
      } catch {
        inFlight = false
        applyServer(e.plan, e.rev, false)
        showToast(t('common:sync.planChanged'))
        return
      }
      try {
        saved = await serverStorage.save(merged, e.rev, author)
      } catch {
        inFlight = false
        applyServer(e.plan, e.rev, false)
        showToast(t('common:sync.planChanged'))
        return
      }
      confirmed = { ...merged, rev: saved.rev, updatedAt: saved.updatedAt }
      sync({ rev: saved.rev, savedAt: saved.updatedAt, status: 'saved' })
      inFlight = false
      if (usePlanStore.getState().plan === plan) {
        loading = true
        usePlanStore.getState().commit(merged)
        loading = false
        const current = usePlanStore.getState().plan
        if (current) confirmed = current
      } else void push()
      return
    }
    const current = usePlanStore.getState().plan
    confirmed = plan
    sync({ rev: saved.rev, savedAt: saved.updatedAt, status: 'saved' })
    inFlight = false
    if (current !== plan) void push()
  } catch (e) {
    inFlight = false
    const reason = (e as Error).message
    rollback(reason ? t('common:sync.saveFailedReason', { reason }) : t('common:sync.saveFailed'))
    sync({ status: 'saved' })
  }
}

// Picks up a newer copy saved meanwhile, for example one Mistry's cloud sync pulled from another phone.
async function refreshIfStale() {
  if (inFlight || !confirmed || usePlanStore.getState().versionPreview) return
  try {
    const { plan, rev } = await serverStorage.load()
    if (rev !== useSyncStore.getState().rev && !inFlight) applyServer(plan, rev, false)
  } catch {
    return
  }
}

export function startSync(planId: string) {
  if (started) return
  started = true
  serverStorage = new MistryPlanStorage(planId)
  usePlanStore.subscribe((s, prev) => {
    if (s.plan !== prev.plan && !loading && s.plan && !s.versionPreview && !prev.versionPreview) void push()
  })
  window.addEventListener('focus', () => void refreshIfStale())
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void refreshIfStale()
  })
  void loadFromServer(true)
}

export async function listVersions(): Promise<{ source: 'server'; items: VersionInfo[] }> {
  return { source: 'server', items: await serverStorage.list() }
}

export async function restoreVersion(rev: number) {
  const plan = await serverStorage.get(rev)
  usePlanStore.getState().exitPreview()
  nextAuthor = `restore:rev${rev}`
  usePlanStore.getState().commit(plan)
}

export const listSnapshots = () => serverStorage.snapshots()
export const saveSnapshot = (name: string) => serverStorage.saveSnapshot(name)

let previewSource: string | null = null

export async function previewSnapshot(id: string, label: string) {
  const plan = await serverStorage.snapshot(id)
  previewSource = `restore:${id}`
  usePlanStore.getState().enterPreview(plan, label)
}

export async function previewRevision(rev: number) {
  const plan = await serverStorage.get(rev)
  previewSource = `restore:rev${rev}`
  usePlanStore.getState().enterPreview(plan, `#${rev}`)
}

export function restorePreview() {
  const st = usePlanStore.getState()
  const vp = st.versionPreview
  if (!vp) return
  const shown = st.plan
  st.exitPreview()
  nextAuthor = previewSource
  previewSource = null
  if (shown) usePlanStore.getState().commit(shown)
}
