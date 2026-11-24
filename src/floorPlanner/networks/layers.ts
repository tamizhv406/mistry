import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { labelMap } from './labels'

export type LayerKey = 'walls' | 'furniture' | 'zones' | 'sewer' | 'water' | 'electric' | 'heating'

export const LAYER_LABELS: Record<LayerKey, string> = labelMap<LayerKey>(['walls', 'furniture', 'zones', 'sewer', 'water', 'electric', 'heating'], 'networks:shared.layers')

export const DIM_OPACITY = 0.4

export type LayerLocks = Record<LayerKey, boolean>

export const DEFAULT_LOCKS: LayerLocks = { walls: false, furniture: false, zones: false, sewer: false, water: false, electric: false, heating: false }

type LayersState = Record<LayerKey, boolean> & {
  locks: LayerLocks
  setLayer: (key: LayerKey, on: boolean) => void
  setLock: (key: LayerKey, locked: boolean) => void
}

export const useLayers = create<LayersState>()(
  persist(
    (set) => ({
      walls: true,
      furniture: true,
      zones: true,
      sewer: false,
      water: false,
      electric: false,
      heating: false,
      locks: DEFAULT_LOCKS,
      setLayer: (key, on) => set({ [key]: on } as Partial<LayersState>),
      setLock: (key, locked) => set((st) => ({ locks: { ...st.locks, [key]: locked } })),
    }),
    {
      name: 'house-planner:layers',
      version: 4,
      migrate: () => ({ walls: true, furniture: true, zones: true, sewer: false, water: false, electric: false, heating: false, locks: DEFAULT_LOCKS }) as LayersState,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ walls: s.walls, furniture: s.furniture, zones: s.zones, sewer: s.sewer, water: s.water, electric: s.electric, heating: s.heating, locks: s.locks }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<LayersState>
        const mergedLocks = { ...DEFAULT_LOCKS, ...p.locks }
        // Ensure walls default to unlocked (false) so walls can be selected and moved smoothly
        mergedLocks.walls = p.locks?.walls ?? false
        return { ...current, ...p, locks: mergedLocks }
      },
    },
  ),
)

export const useBaseOpacity = () => useLayers((s) => (s.sewer || s.water || s.electric || s.heating ? DIM_OPACITY : 1))
