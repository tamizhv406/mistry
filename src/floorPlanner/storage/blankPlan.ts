import type { Plan } from '../model'
import { parsePlan } from '../model'
import { usePlanStore } from '../store/planStore'
import { showToast } from '../ui/Toast'

export function createBlankPlan(): Plan {
  return {
    version: 1,
    name: 'New Blank Plan',
    updatedAt: new Date().toISOString(),
    author: 'local',
    site: {
      width: 20000,
      depth: 15000,
      boundary: [
        { x: 0, y: 0 },
        { x: 20000, y: 0 },
        { x: 20000, y: 15000 },
        { x: 0, y: 15000 },
      ],
      zones: [],
    },
    materials: [
      {
        id: 'main-wall-200',
        name: 'Main Wall (200mm / 9")',
        kind: 'brick',
        thickness: 200,
        unitLength: 230,
        unitHeight: 75,
        jointMm: 10,
      },
      {
        id: 'partition-wall-100',
        name: 'Partition Wall (100mm / 4.5")',
        kind: 'brick',
        thickness: 100,
        unitLength: 230,
        unitHeight: 75,
        jointMm: 10,
      },
    ],
    walls: [],
    openings: [],
    furniture: [],
    rooms: [],
  }
}

export function loadBlankPlan(confirm = true) {
  const currentPlan = usePlanStore.getState().plan
  if (confirm && currentPlan && currentPlan.walls.length > 0) {
    const ok = window.confirm('Start a new blank plan? All current walls and items will be cleared.')
    if (!ok) return false
  }

  const blank = createBlankPlan()

  usePlanStore.getState().loadPlan(blank, { fit: true })
  usePlanStore.getState().setTool('wall')
  showToast('Created new blank plan! Select Wall tool (W) to start drawing.')
  return true
}

export async function loadDemoPlan(confirm = true) {
  const currentPlan = usePlanStore.getState().plan
  if (confirm && currentPlan && currentPlan.walls.length > 0) {
    const ok = window.confirm('Load sample demo plan? Any unsaved edits will be replaced.')
    if (!ok) return false
  }

  try {
    const res = await fetch(`${import.meta.env.BASE_URL}floor-planner/plans/demo.json`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    const parsed = parsePlan(data)
    if (!parsed.ok) throw new Error(parsed.error)


    usePlanStore.getState().loadPlan(parsed.plan, { fit: true })
    usePlanStore.getState().setTool('select')
    showToast('Loaded sample Nordic house plan.')
    return true
  } catch (err) {
    showToast(`Failed to load demo plan: ${(err as Error).message}`)
    return false
  }
}
