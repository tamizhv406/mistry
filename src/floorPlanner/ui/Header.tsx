import { useTranslation } from 'react-i18next'
import { formatLength } from '../model'
import { usePlanStore } from '../store/planStore'
import { useViewOnly } from '../store/viewOnly'
import { Badge } from './Badge'
import { HeaderMenu } from './HeaderMenu'
import { SaveIndicator } from './SaveIndicator'
import { Segmented } from './Segmented'
import { sectionHref, sections, useNarrow, type SectionId } from './useSection'
import { loadBlankPlan } from '../storage'
import { exportPdfBlueprint } from '../utils/pdfBlueprint'
import { goBackToMistry } from '../host'

const meters = (mm: number) => formatLength(mm)


export function Header({ section }: { section: SectionId }) {
  const { t } = useTranslation('common')
  const plan = usePlanStore((s) => s.plan)
  const narrow = useNarrow()
  const viewOnly = useViewOnly()
  const tabs = sections.map((s) => ({
    value: s.id,
    label: t(s.label),
    href: sectionHref(s.id),
  }))
  const subtitle = plan
    ? t('header.subtitle', {
        width: meters(plan.site.width),
        depth: meters(plan.site.depth),
        walls: t('header.walls', { count: plan.walls.length }),
        openings: t('header.openings', { count: plan.openings.length }),
      })
    : ''

  return (
    <header className={`header card header--${section}`}>
      <button
        type="button"
        className="btn btn--sm btn--ghost header__back"
        onClick={() => void goBackToMistry()}
        aria-label="Back to floor plans"
        title="Back to floor plans"
        style={{ height: 32, width: 32, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, flexShrink: 0 }}
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>
      <div className="header__text" title={plan ? `${plan.name} — ${subtitle}` : undefined}>
        <span className="header__title">{plan?.name ?? t('header.loadingPlan')}</span>
        {plan && <span className="header__meta">{subtitle}</span>}
      </div>
      {viewOnly && (
        <Badge tone="neutral" className="header__view">
          {t('header.viewOnly')}
        </Badge>
      )}
      {!viewOnly && (
        <>
          <button
            type="button"
            className="btn btn--sm btn--primary header__blank-btn"
            onClick={() => loadBlankPlan()}
            title="Start a new blank floor plan (Building Mistry style)"
            style={{
              height: 32,
              padding: '0 12px',
              fontSize: '12.5px',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              borderRadius: 8,
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>{narrow ? 'Blank' : 'Blank Plan'}</span>
          </button>
          <button
            type="button"
            className="btn btn--sm btn--ghost header__pdf-btn"
            onClick={() => void exportPdfBlueprint()}
            title="Download scaled architectural PDF Blueprint"
            style={{
              height: 32,
              padding: '0 10px',
              fontSize: '12.5px',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              borderRadius: 8,
              cursor: 'pointer',
              flexShrink: 0,
              border: '1px solid var(--line-strong)',
            }}
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="12" y1="18" x2="12" y2="12" />
              <line x1="9" y1="15" x2="15" y2="15" />
            </svg>
            <span>{narrow ? 'PDF' : 'PDF Blueprint'}</span>
          </button>
        </>
      )}
      <SaveIndicator />
      <Segmented options={tabs} value={section} className="header__tabs" />
      <HeaderMenu />
    </header>
  )
}
