import { useEffect, useRef } from 'react';
import { plannerUrl } from '../services/floorPlannerRecords';

// Kept in step with HOST_MESSAGE in src/floorPlanner/host.ts.
const MSG_BACK = 'mistry-floor-planner:back';
const MSG_AREA = 'mistry-floor-planner:estimate-area';
const MSG_CLOSE_REQUEST = 'mistry-floor-planner:close-request';

interface FloorPlannerHostViewProps {
  planId: string;
  onBack: () => void;
  onSendAreaToEstimator: (areaSqFt: number) => void;
}

/**
 * Shows the Floor Planner full screen. The planner is its own page (floor-planner.html), so
 * its styles, keyboard shortcuts and state never mix with the rest of Mistry. It reads and
 * saves the plan straight in the app's database, and talks back here only to close or to hand
 * a floor area to the Building Estimator.
 */
export function FloorPlannerHostView({ planId, onBack, onSendAreaToEstimator }: FloorPlannerHostViewProps) {
  const frameRef = useRef<HTMLIFrameElement>(null);

  // Phone back button (App.tsx sends 'mistry:back' first): ask the planner to finish saving and
  // close. It answers with MSG_BACK; if it does not answer in time, close anyway.
  useEffect(() => {
    let fallback: ReturnType<typeof setTimeout> | undefined;
    const onAppBack = (e: Event) => {
      e.preventDefault();
      const win = frameRef.current?.contentWindow;
      if (!win) {
        onBack();
        return;
      }
      win.postMessage({ type: MSG_CLOSE_REQUEST }, window.location.origin);
      clearTimeout(fallback);
      fallback = setTimeout(onBack, 4000);
    };
    window.addEventListener('mistry:back', onAppBack);
    return () => {
      window.removeEventListener('mistry:back', onAppBack);
      clearTimeout(fallback);
    };
  }, [onBack]);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      const data = e.data as { type?: string; areaSqFt?: unknown } | null;
      if (!data || typeof data !== 'object') return;
      if (e.source !== frameRef.current?.contentWindow) return;
      if (data.type === MSG_BACK) onBack();
      if (data.type === MSG_AREA && typeof data.areaSqFt === 'number' && data.areaSqFt > 0) {
        onSendAreaToEstimator(data.areaSqFt);
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [onBack, onSendAreaToEstimator]);

  return (
    <iframe
      ref={frameRef}
      key={planId}
      title="Floor Planner"
      src={plannerUrl(planId)}
      allow="fullscreen"
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        border: 0,
        zIndex: 1000,
        background: '#f3f1ec',
      }}
    />
  );
}
