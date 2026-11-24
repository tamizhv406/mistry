import type Konva from 'konva'

let currentStage: Konva.Stage | null = null

export function setCanvasStage(stage: Konva.Stage | null) {
  currentStage = stage
  if (typeof window !== 'undefined') {
    ;(window as any).__canvasStage = stage
  }
}

export function getCanvasStage(): Konva.Stage | null {
  return currentStage
}
