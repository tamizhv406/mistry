// Talking to the Mistry app that hosts the planner page in a frame.

/** Message types. The host listens for these on `window` (same origin only). */
export const HOST_MESSAGE = {
  back: 'mistry-floor-planner:back',
  sendAreaToEstimator: 'mistry-floor-planner:estimate-area',
  /** From the host: the user pressed the phone's back button. */
  closeRequest: 'mistry-floor-planner:close-request',
} as const

export function planIdFromUrl(): string {
  return new URLSearchParams(window.location.search).get('plan') ?? ''
}

const inFrame = () => window.parent && window.parent !== window

function post(message: Record<string, unknown>) {
  if (inFrame()) window.parent.postMessage(message, window.location.origin)
}

// Resolves once no save is running (or after `ms`), so closing never cuts off the last edit.
async function savesSettled(ms = 3000) {
  const { useSyncStore } = await import('./storage')
  const until = Date.now() + ms
  while (useSyncStore.getState().status === 'saving' && Date.now() < until) {
    await new Promise((r) => setTimeout(r, 50))
  }
}

/** Close the planner and go back to the plan list in Mistry, after any save in progress. */
export async function goBackToMistry() {
  await savesSettled()
  if (inFrame()) post({ type: HOST_MESSAGE.back })
  else window.history.back()
}

// The host asks to close (phone back button): finish saving, then say we are done.
window.addEventListener('message', (e) => {
  if (e.origin !== window.location.origin || e.source !== window.parent) return
  if ((e.data as { type?: string } | null)?.type === HOST_MESSAGE.closeRequest) void goBackToMistry()
})

/** Hand the plan's floor area (sq.ft) to Mistry's Building Estimator. */
export function sendAreaToEstimator(areaSqFt: number) {
  post({ type: HOST_MESSAGE.sendAreaToEstimator, areaSqFt })
}

export const hasHost = inFrame
