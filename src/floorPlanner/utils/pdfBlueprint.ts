import { getCanvasStage } from '../canvas/stageRef'
import { formatLength, type Plan } from '../model'
import { usePlanStore } from '../store/planStore'
import { showToast } from '../ui/Toast'
import { APP_NAME } from '../../config/brand'

export async function exportPdfBlueprint(): Promise<boolean> {
  const plan: Plan | null = usePlanStore.getState().plan
  const stage = getCanvasStage()

  if (!plan) {
    showToast('No active floor plan to export.')
    return false
  }

  showToast('Generating architectural PDF blueprint...')

  try {
    const { jsPDF } = await import('jspdf')
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
    })

    const pageWidth = 297
    const pageHeight = 210
    const margin = 8
    const titleBlockH = 26

    // 1. Draw outer architectural blueprint border
    doc.setDrawColor(24, 43, 73) // deep blueprint navy
    doc.setLineWidth(1)
    doc.rect(margin, margin, pageWidth - margin * 2, pageHeight - margin * 2)

    doc.setLineWidth(0.3)
    doc.rect(margin + 1.5, margin + 1.5, pageWidth - (margin + 1.5) * 2, pageHeight - (margin + 1.5) * 2)

    // 2. Title Block Frame at bottom
    const tbY = pageHeight - margin - titleBlockH
    const tbW = pageWidth - margin * 2

    doc.setFillColor(248, 250, 252)
    doc.rect(margin, tbY, tbW, titleBlockH, 'FD')
    doc.line(margin, tbY, margin + tbW, tbY)

    // Divide title block into 3 columns
    const col1W = 105
    const col2W = 95

    doc.line(margin + col1W, tbY, margin + col1W, tbY + titleBlockH)
    doc.line(margin + col1W + col2W, tbY, margin + col1W + col2W, tbY + titleBlockH)

    // Column 1: Project Information
    doc.setTextColor(24, 43, 73)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.text('PROJECT:', margin + 4, tbY + 6)
    doc.setFontSize(12)
    doc.text(plan.name || 'RESIDENTIAL FLOOR PLAN', margin + 4, tbY + 12)

    doc.setFontSize(7.5)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(71, 85, 105)
    doc.text('ARCHITECTURAL 2D BLUEPRINT', margin + 4, tbY + 18)
    doc.text(`PLATFORM: ${APP_NAME.toUpperCase()} / FLOOR PLANNER`, margin + 4, tbY + 22)

    // Column 2: Plan Specifications & Schedule
    const wallsCount = plan.walls.length
    const doorsCount = plan.openings.filter((o) => o.type === 'door' || o.type === 'gate').length
    const windowsCount = plan.openings.filter((o) => o.type === 'window').length
    const roomsCount = plan.rooms?.length ?? 0

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(24, 43, 73)
    doc.text('PLAN SPECIFICATIONS:', margin + col1W + 4, tbY + 6)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(51, 65, 85)
    doc.text(`Site Bounds: ${formatLength(plan.site.width)} x ${formatLength(plan.site.depth)}`, margin + col1W + 4, tbY + 11)
    doc.text(`Total Walls: ${wallsCount} | Rooms: ${roomsCount}`, margin + col1W + 4, tbY + 16)
    doc.text(`Openings: ${doorsCount} Doors, ${windowsCount} Windows`, margin + col1W + 4, tbY + 21)

    // Column 3: Sheet Metadata & Status
    const today = new Date().toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(24, 43, 73)
    doc.text('SHEET DETAILS:', margin + col1W + col2W + 4, tbY + 6)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(51, 65, 85)
    doc.text(`Date: ${today}`, margin + col1W + col2W + 4, tbY + 11)
    doc.text('Scale: 1:100 (Metric mm)', margin + col1W + col2W + 4, tbY + 15)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(16, 185, 129) // green badge
    doc.text('STATUS: ISSUED FOR APPROVAL', margin + col1W + col2W + 4, tbY + 19)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(24, 43, 73)
    doc.text('SHEET: 01 / 01', margin + col1W + col2W + 4, tbY + 23)

    // 3. Render the Plan Canvas
    if (stage) {
      const dataUrl = stage.toDataURL({ pixelRatio: 2 })
      const stageW = stage.width()
      const stageH = stage.height()

      // Usable drawing area inside margins above title block
      const availW = pageWidth - margin * 2 - 8
      const availH = tbY - margin - 8

      const scale = Math.min(availW / stageW, availH / stageH)
      const renderW = stageW * scale
      const renderH = stageH * scale
      const renderX = margin + 4 + (availW - renderW) / 2
      const renderY = margin + 4 + (availH - renderH) / 2

      doc.addImage(dataUrl, 'PNG', renderX, renderY, renderW, renderH, undefined, 'FAST')
    }

    const safeName = (plan.name || 'Floor-Plan')
      .replace(/[^\w\d-]+/g, '-')
      .replace(/^-+|-+$/g, '')
    doc.save(`${safeName || 'floor-plan'}-blueprint.pdf`)
    showToast('Architectural PDF Blueprint downloaded!')
    return true
  } catch (err) {
    showToast(`PDF Export failed: ${(err as Error).message}`)
    return false
  }
}

export function printBlueprint() {
  window.print()
}
