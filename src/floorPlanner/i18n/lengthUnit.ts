// How plan lengths and areas are shown: feet-inches (the default, as Mistry users work) or metres.
// The plan itself is always stored in millimetres; only labels, rulers, the grid and typed
// input change. Engineering figures (pipe coils, screed thickness, heat output) stay metric.
import { useSyncExternalStore } from 'react'
import { numberFormat, t } from '.'

export type LengthUnit = 'ft' | 'm'

export const MM_PER_FOOT = 304.8
export const MM_PER_INCH = 25.4
const SQFT_PER_M2 = 10.7639104

const STORE_KEY = 'mistry-fp-length-unit'

function read(): LengthUnit {
  try {
    return localStorage.getItem(STORE_KEY) === 'm' ? 'm' : 'ft'
  } catch {
    return 'ft'
  }
}

let current: LengthUnit = read()
const listeners = new Set<() => void>()

export const lengthUnit = (): LengthUnit => current
export const isFeet = () => current === 'ft'

export function setLengthUnit(unit: LengthUnit) {
  if (unit === current) return
  current = unit
  try {
    localStorage.setItem(STORE_KEY, unit)
  } catch {
    // The choice still applies until the page is closed.
  }
  for (const l of listeners) l()
}

export const useLengthUnit = () =>
  useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    lengthUnit,
    () => 'ft' as LengthUnit,
  )

const num = (v: number, maxDigits: number) => numberFormat({ maximumFractionDigits: maxDigits }).format(v)

const FRACTIONS: Record<number, string> = { 1: '¼', 2: '½', 3: '¾' }

/**
 * Feet and inches the way a drawing writes them: 12'-6", 12'-6½", 0'-9" → 9", 12'-0" → 12'.
 * `quarter` rounds to the nearest ¼ inch, otherwise to the nearest inch.
 */
export function formatFeetInches(mm: number, quarter = false): string {
  const sign = mm < 0 ? '-' : ''
  const steps = quarter ? 4 : 1
  const totalQ = Math.round((Math.abs(mm) / MM_PER_INCH) * steps)
  const feet = Math.floor(totalQ / (12 * steps))
  const restQ = totalQ - feet * 12 * steps
  const wholeIn = Math.floor(restQ / steps)
  const frac = quarter ? FRACTIONS[restQ % steps] ?? '' : ''
  const inches = `${wholeIn || !frac ? wholeIn : ''}${frac}"`
  if (feet === 0) return `${sign}${inches}`
  if (restQ === 0) return `${sign}${feet}'`
  return `${sign}${feet}'-${inches}`
}

/** A plan length with its unit: 12'-6" or 3.81 m / 450 mm. */
export function formatPlanLength(mm: number): string {
  if (isFeet()) return formatFeetInches(mm)
  if (Math.abs(mm) >= 1000) return `${num(mm / 1000, 2)} ${t('common:units.m')}`
  return `${Math.round(mm)} ${t('common:units.mm')}`
}

/** A precise value for an input box: 12'-6¼" or 3.812 (metres). */
export function formatLengthInput(mm: number): string {
  return isFeet() ? formatFeetInches(mm, true) : num(mm / 1000, 3)
}

/** An area given in square metres, shown as sq.ft or m². */
export function formatPlanArea(m2: number, digits = 1): string {
  if (isFeet()) return `${num(m2 * SQFT_PER_M2, 0)} sq.ft`
  return `${num(m2, digits)} ${t('common:units.m2')}`
}

/** The unit shown beside a length box. */
export const lengthSuffix = () => (isFeet() ? 'ft-in' : t('common:units.m'))

/** Snapping step for drawing: 3 inches in feet mode, 100 mm in metres. */
export const gridSnap = () => (isFeet() ? 76.2 : 100)

// Grid and ruler steps in millimetres. Feet mode uses whole inches and feet so lines fall on
// round numbers.
const FT_GRID_STEPS = [76.2, 152.4, 304.8, 1524, 3048, 15240]
const M_GRID_STEPS = [100, 500, 1000, 5000, 10000, 50000]
const FT_LABEL_STEPS = [304.8, 609.6, 1524, 3048, 6096, 15240, 30480, 60960]
const M_LABEL_STEPS = [500, 1000, 2000, 5000, 10000, 20000, 50000, 100000]

export const gridStepList = () => (isFeet() ? FT_GRID_STEPS : M_GRID_STEPS)
export const labelStepList = () => (isFeet() ? FT_LABEL_STEPS : M_LABEL_STEPS)
/** The step from which the grid draws a major line: 1 ft or 1 m. */
export const majorGridMin = () => (isFeet() ? MM_PER_FOOT : 1000)

/** Ruler tick label: 12' or 3.5. */
export const rulerLabel = (mm: number) => (isFeet() ? `${Math.round(mm / MM_PER_FOOT)}'` : num(mm / 1000, 1))
export const rulerUnit = () => (isFeet() ? 'ft' : t('common:units.m'))
