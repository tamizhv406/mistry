// Entry of floor-planner.html. Mistry opens this page in a full-screen frame
// (src/views/FloorPlannerHostView.tsx) with ?plan=<floor plan record id>.
// Running in its own page keeps the planner's styles, keyboard shortcuts and stores apart
// from the rest of the app, and gives every opened plan a fresh start.
import './i18n'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { useTranslation } from 'react-i18next'
import './styles/tokens.css'
import './styles/ui.css'
import './index.css'
import App from './App.tsx'
import { planIdFromUrl } from './host'
import { useLengthUnit } from './i18n/lengthUnit'

const planId = planIdFromUrl()

// Remount on a language or unit change so memoized texts, labels and warnings are rebuilt.
function Root() {
  const { i18n } = useTranslation()
  const unit = useLengthUnit()
  return <App key={`${i18n.resolvedLanguage}-${unit}`} planId={planId} />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
