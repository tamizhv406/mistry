import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Input } from './Input'
import { formatLengthInput, isFeet, lengthSuffix, MM_PER_FOOT, MM_PER_INCH } from '../i18n/lengthUnit'

const FRACTION: Record<string, number> = { '¼': 0.25, '½': 0.5, '¾': 0.75 }

// "6 1/2", "6½", "6.5" → 6.5
function inchNumber(raw: string): number | null {
  const s = raw.trim()
  if (!s) return 0
  const m = s.match(/^(\d+(?:\.\d+)?)?\s*(?:(\d+)\/(\d+)|([¼½¾]))?$/)
  if (!m || (!m[1] && !m[2] && !m[4])) return null
  let v = m[1] ? Number(m[1]) : 0
  if (m[2]) v += Number(m[2]) / Number(m[3])
  if (m[4]) v += FRACTION[m[4]]
  return Number.isFinite(v) ? v : null
}

/**
 * A typed length in millimetres, or null when it is not a length.
 * Accepts 12'6", 12'-6", 12' 6 1/2", 12ft 6in, 150", 150in, 3.5m, 350cm, 3500mm.
 * A plain number is in the unit the planner shows: feet in feet mode ("12.5", or "12 6" for
 * 12'-6"), and metres or millimetres in metre mode.
 */
export function parseLength(raw: string): number | null {
  const text = raw.trim().toLowerCase().replace(',', '.').replace(/[’′]/g, "'").replace(/[”″]/g, '"')
  if (!text) return null

  // Feet and inches: 12'6", 12'-6", 12' 6 1/2", 12ft 6in, 12ft
  const ftIn = text.match(/^(\d+(?:\.\d+)?)\s*(?:'|ft|feet)\s*-?\s*(.*?)\s*(?:"|in|inch|inches)?$/)
  if (ftIn) {
    const inches = inchNumber(ftIn[2])
    if (inches === null) return null
    return Math.round(Number(ftIn[1]) * MM_PER_FOOT + inches * MM_PER_INCH)
  }

  // Inches only: 36", 36in, 6 1/2"
  const inOnly = text.match(/^(.+?)\s*(?:"|in|inch|inches)$/)
  if (inOnly) {
    const inches = inchNumber(inOnly[1])
    return inches === null ? null : Math.round(inches * MM_PER_INCH)
  }

  if (isFeet()) {
    // "12 6" means 12 ft 6 in; a lone number is feet.
    const pair = text.match(/^(\d+)\s+(\d+(?:\.\d+)?)$/)
    if (pair) return Math.round(Number(pair[1]) * MM_PER_FOOT + Number(pair[2]) * MM_PER_INCH)
    const lone = text.match(/^\d*\.?\d+$/)
    if (lone) return Math.round(Number(text) * MM_PER_FOOT)
  }

  const s = text.replace(/\s+/g, '')

  // Inches only: e.g. 36", 36in
  const inMatch = s.match(/^(\d+(?:\.\d+)?)(?:"|in)$/)
  if (inMatch) {
    return Math.round(Number(inMatch[1]) * 25.4)
  }

  const m = s.match(/^(-?\d*\.?\d+)(мм|mm|см|cm|м|m)?$/)
  if (!m) return null
  const v = Number(m[1])
  if (!Number.isFinite(v)) return null
  const unit = m[2]
  if (unit === 'мм' || unit === 'mm') return Math.round(v)
  if (unit === 'см' || unit === 'cm') return Math.round(v * 10)
  if (unit === 'м' || unit === 'm') return Math.round(v * 1000)
  return m[1].includes('.') || (Math.abs(v) < 30 && v > 0) ? Math.round(v * 1000) : Math.round(v)
}

type Props = {
  value: number
  onCommit: (mm: number) => void
  min?: number
  step?: number
  showSteppers?: boolean
  label?: string
  title?: string
}

export function LengthField({ value, onCommit, min = 0, step: stepMm = 50, showSteppers, label, title }: Props) {
  // In feet mode the arrows move by whole inches (50 mm → 2").
  const step = isFeet() ? Math.max(1, Math.round(stepMm / MM_PER_INCH)) * MM_PER_INCH : stepMm
  const { t } = useTranslation('common')
  const [draft, setDraft] = useState<string | null>(null)
  const [invalid, setInvalid] = useState(false)
  const commit = () => {
    if (draft === null) return
    const mm = parseLength(draft)
    if (mm === null || mm < min) {
      setInvalid(true)
      return
    }
    setDraft(null)
    setInvalid(false)
    if (mm !== Math.round(value)) onCommit(mm)
  }

  const stepDown = () => {
    const next = Math.max(min, Math.round(value - step))
    setDraft(null)
    setInvalid(false)
    if (next !== Math.round(value)) onCommit(next)
  }

  const stepUp = () => {
    const next = Math.round(value + step)
    setDraft(null)
    setInvalid(false)
    if (next !== Math.round(value)) onCommit(next)
  }

  const stepText = isFeet() ? `${Math.round(step / MM_PER_INCH)}"` : `${step} mm`

  const inputEl = (
    <Input
      size="sm"
      label={showSteppers ? undefined : label}
      title={title ?? t('lengthField.title')}
      suffix={isFeet() ? lengthSuffix() : t('units.mm')}
      invalid={invalid}
      value={draft ?? (isFeet() ? formatLengthInput(value) : String(Math.round(value)))}
      onChange={(e) => {
        setDraft(e.target.value)
        setInvalid(false)
      }}
      onFocus={(e) => e.target.select()}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          commit()
          ;(e.target as HTMLInputElement).blur()
        } else if (e.key === 'Escape') {
          setDraft(null)
          setInvalid(false)
          ;(e.target as HTMLInputElement).blur()
        } else if (e.key === 'ArrowUp') {
          e.preventDefault()
          stepUp()
        } else if (e.key === 'ArrowDown') {
          e.preventDefault()
          stepDown()
        }
      }}
    />
  )

  if (!showSteppers) return inputEl

  return (
    <div className="length-stepper">
      {label && <span className="length-stepper__label">{label}</span>}
      <div className="length-stepper__controls">
        <button
          type="button"
          className="length-stepper__btn length-stepper__btn--sub"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            stepDown()
          }}
          disabled={value <= min}
          title={`-${stepText}`}
          aria-label={`Decrease by ${stepText}`}
        >
          −
        </button>
        <div className="length-stepper__input">{inputEl}</div>
        <button
          type="button"
          className="length-stepper__btn length-stepper__btn--add"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            stepUp()
          }}
          title={`+${stepText}`}
          aria-label={`Increase by ${stepText}`}
        >
          +
        </button>
      </div>
    </div>
  )
}
