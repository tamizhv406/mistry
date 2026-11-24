import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PlanCanvas } from './canvas/PlanCanvas'
import { formatLength, type Plan, type Point } from './model'
import { startSync, useSyncStore } from './storage'
import { usePlanStore } from './store/planStore'
import { GridLegend } from './ui/GridLegend'
import { FurniturePanel } from './ui/FurniturePanel'
import { Header } from './ui/Header'
import { Toast } from './ui/Toast'
import { PreviewBar } from './ui/PreviewBar'
import { Inspector } from './ui/Inspector'
import { Toolbar } from './ui/Toolbar'
import { useSection, type SectionId } from './ui/useSection'

const View3D = lazy(() => import('./view3d'))
const MapView = lazy(() => import('./map'))
const EstimatePage = lazy(() => import('./estimate'))

const loadingKey: Record<Exclude<SectionId, 'plan'>, string> = {
  '3d': 'loading.3d',
  map: 'loading.map',
  estimate: 'loading.estimate',
}

function SectionPage({ section }: { section: Exclude<SectionId, 'plan'> }) {
  const { t } = useTranslation('common')
  const plan = usePlanStore((s) => s.plan)
  const commit = usePlanStore((s) => s.commit)
  const onChange = useCallback((next: Plan) => commit(next), [commit])
  const full = section === '3d' || section === 'map'
  return (
    <main className={`page ${full ? 'page--full' : ''}`}>
      <Suspense fallback={<div className="page__loading">{t(loadingKey[section])}</div>}>
        {!plan && <div className="page__loading">{t('loading.plan')}</div>}
        {section === '3d' && plan && <View3D plan={plan} onChange={onChange} />}
        {section === 'map' && plan && <MapView plan={plan} onChange={onChange} />}
        {section === 'estimate' && plan && <EstimatePage plan={plan} onChange={onChange} />}
      </Suspense>
    </main>
  )
}

export default function App({ planId }: { planId: string }) {
  const { t } = useTranslation('common')
  const tool = usePlanStore((s) => s.tool)
  const hasPlan = usePlanStore((s) => !!s.plan)
  const status = useSyncStore((s) => s.status)
  const camScale = usePlanStore((s) => s.cam?.scale ?? 0)
  const section = useSection()
  const [cursor, setCursor] = useState<{ p: Point | null; scale: number }>({ p: null, scale: 0 })

  useEffect(() => {
    startSync(planId)
  }, [planId])

  const onCursor = useCallback((p: Point | null, scale: number) => setCursor({ p, scale }), [])

  if (!hasPlan) {
    return (
      <div className="app app--page">
        <main className="page">
          <div className="page__loading">
            {status === 'error' ? t('sync.loadFailed', { defaultValue: 'Could not open this plan.' }) : t('loading.plan')}
          </div>
        </main>
        <Toast />
      </div>
    )
  }

  if (section !== 'plan') {
    return (
      <div className={`app app--page app--${section}`}>
        <SectionPage section={section} />
        <div className="overlay">
          <Header section={section} />
          <Toast />
          <PreviewBar />
        </div>
      </div>
    )
  }

  return (
    <div className="app app--plan">
      <PlanCanvas onCursor={onCursor} />
      <div className="overlay">
        <Header section={section} />
        <Toast />
        <PreviewBar />
        <Toolbar />
        <FurniturePanel />
        <Inspector />
        <footer className="status card">
          <span>
            {cursor.p ? t('status.cursor', { x: formatLength(cursor.p.x), y: formatLength(cursor.p.y) }) : t('status.cursorEmpty')}
          </span>
          {camScale > 0 && <GridLegend scale={camScale} />}
          <span className="muted">
            {tool === 'wall'
              ? t('status.hintWall')
              : tool === 'door'
                ? t('status.hintDoor')
                : tool === 'window'
                  ? t('status.hintWindow')
                  : t('status.hintSelect')}
          </span>
        </footer>
      </div>
    </div>
  )
}
