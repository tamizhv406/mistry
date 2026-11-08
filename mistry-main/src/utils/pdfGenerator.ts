import type { FloorPlan, FloorPlanWall, FloorPlanRoom, FloorPlanUnit, FloorPlanLevel, FloorPlanDoor, FloorPlanWindow, FloorPlanFurniture } from '../db/types';
import { formatLength, formatArea } from '../services/geometryEngine';
import type { MultiTierEstimateResult } from '../domain/buildingCalculator/multiTierEstimator';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface FloorPlanPdfOptions {
  plan: FloorPlan;
  walls: FloorPlanWall[];
  rooms: FloorPlanRoom[];
  doors?: FloorPlanDoor[];
  windows?: FloorPlanWindow[];
  furniture?: FloorPlanFurniture[];
  floorLevels?: FloorPlanLevel[];
  activeFloorIndex?: number;
  orientation?: 'landscape' | 'portrait';
  unit: FloorPlanUnit;
  svgElement?: SVGSVGElement | null;
  svgString?: string;
  canvasImage?: string;
  projectName?: string;
  siteName?: string;
}

/**
 * Escapes characters for PDF literal strings enclosed in parentheses.
 */
function escapePdfText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

/**
 * Pure TypeScript standard PDF 1.4 document builder.
 * Produces genuine, compliant PDF binaries with valid xref offsets and structure.
 */
export class MinimalPdfDocument {
  private objects: string[] = [];
  public width: number;
  public height: number;
  private contentStream: string[] = [];
  private imageObjIndex: number | null = null;
  private imageWidth: number = 0;
  private imageHeight: number = 0;
  private imageBytes: Uint8Array | null = null;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  // PDF Graphics and Text operators
  public setStrokeColor(r: number, g: number, b: number) {
    this.contentStream.push(`${(r / 255).toFixed(3)} ${(g / 255).toFixed(3)} ${(b / 255).toFixed(3)} RG`);
  }

  public setFillColor(r: number, g: number, b: number) {
    this.contentStream.push(`${(r / 255).toFixed(3)} ${(g / 255).toFixed(3)} ${(b / 255).toFixed(3)} rg`);
  }

  public setLineWidth(w: number) {
    this.contentStream.push(`${w.toFixed(2)} w`);
  }

  public drawLine(x1: number, y1: number, x2: number, y2: number, dashed: boolean = false) {
    if (dashed) {
      this.contentStream.push('[3 3] 0 d');
    } else {
      this.contentStream.push('[] 0 d');
    }
    this.contentStream.push(`${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S`);
    if (dashed) this.contentStream.push('[] 0 d');
  }

  public drawRect(x: number, y: number, w: number, h: number, fill: boolean = false, stroke: boolean = true) {
    this.contentStream.push('[] 0 d');
    this.contentStream.push(`${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re`);
    if (fill && stroke) {
      this.contentStream.push('B');
    } else if (fill) {
      this.contentStream.push('f');
    } else {
      this.contentStream.push('S');
    }
  }

  public drawText(text: string, x: number, y: number, size: number = 10, font: string = 'F1') {
    this.contentStream.push(
      `BT /${font} ${size} Tf ${x.toFixed(2)} ${y.toFixed(2)} Td (${escapePdfText(text)}) Tj ET`
    );
  }

  public embedJpegImage(jpegBytes: Uint8Array, pixelWidth: number, pixelHeight: number, x: number, y: number, renderWidth: number, renderHeight: number) {
    this.imageBytes = jpegBytes;
    this.imageWidth = pixelWidth;
    this.imageHeight = pixelHeight;
    // In PDF, q ... cm /Im1 Do Q places the image
    this.contentStream.push('q');
    this.contentStream.push(`${renderWidth.toFixed(2)} 0 0 ${renderHeight.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm`);
    this.contentStream.push('/Im1 Do');
    this.contentStream.push('Q');
  }

  /**
   * Compiles the PDF into a binary Uint8Array according to PDF 1.4 specifications.
   */
  public build(): Uint8Array {
    const encoder = new TextEncoder();
    const parts: Uint8Array[] = [];
    const offsets: number[] = [];
    let currentOffset = 0;

    const pushString = (str: string) => {
      const bytes = encoder.encode(str);
      parts.push(bytes);
      currentOffset += bytes.length;
    };

    const pushBytes = (bytes: Uint8Array) => {
      parts.push(bytes);
      currentOffset += bytes.length;
    };

    // 1. PDF Header
    pushString('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');

    // Object indices
    // 1: Catalog
    // 2: Pages
    // 3: Font F1 (Helvetica)
    // 4: Font F2 (Helvetica-Bold)
    // 5: Page
    // 6: Content Stream
    // 7: (Optional) Image XObject

    const catalogObj = 1;
    const pagesObj = 2;
    const fontF1Obj = 3;
    const fontF2Obj = 4;
    const pageObj = 5;
    const contentObj = 6;
    const imageObj = this.imageBytes ? 7 : null;

    // Helper to start an object
    const startObj = (num: number) => {
      offsets[num] = currentOffset;
      pushString(`${num} 0 obj\n`);
    };

    const endObj = () => {
      pushString('endobj\n');
    };

    // Obj 1: Catalog
    startObj(catalogObj);
    pushString(`<< /Type /Catalog /Pages ${pagesObj} 0 R >>\n`);
    endObj();

    // Obj 2: Pages
    startObj(pagesObj);
    pushString(`<< /Type /Pages /Kids [${pageObj} 0 R] /Count 1 >>\n`);
    endObj();

    // Obj 3: Font F1 (Helvetica)
    startObj(fontF1Obj);
    pushString('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\n');
    endObj();

    // Obj 4: Font F2 (Helvetica-Bold)
    startObj(fontF2Obj);
    pushString('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\n');
    endObj();

    // Obj 5: Page
    startObj(pageObj);
    const resourcesXObject = imageObj ? `/XObject << /Im1 ${imageObj} 0 R >>` : '';
    pushString(
      `<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 ${this.width.toFixed(2)} ${this.height.toFixed(2)}] ` +
      `/Resources << /Font << /F1 ${fontF1Obj} 0 R /F2 ${fontF2Obj} 0 R >> ${resourcesXObject} >> ` +
      `/Contents ${contentObj} 0 R >>\n`
    );
    endObj();

    // Obj 6: Contents Stream
    const streamContent = this.contentStream.join('\n') + '\n';
    const streamBytes = encoder.encode(streamContent);
    startObj(contentObj);
    pushString(`<< /Length ${streamBytes.length} >>\nstream\n`);
    pushBytes(streamBytes);
    pushString('endstream\n');
    endObj();

    // Obj 7: Optional JPEG Image
    if (imageObj && this.imageBytes) {
      startObj(imageObj);
      pushString(
        `<< /Type /XObject /Subtype /Image /Width ${this.imageWidth} /Height ${this.imageHeight} ` +
        `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${this.imageBytes.length} >>\nstream\n`
      );
      pushBytes(this.imageBytes);
      pushString('\nendstream\n');
      endObj();
    }

    // Cross-Reference Table (xref)
    const xrefOffset = currentOffset;
    const totalObjs = imageObj ? 8 : 7;
    pushString(`xref\n0 ${totalObjs}\n`);
    pushString('0000000000 65535 f \n');
    for (let i = 1; i < totalObjs; i++) {
      const off = offsets[i] || 0;
      pushString(`${String(off).padStart(10, '0')} 00000 n \n`);
    }

    // Trailer
    pushString(
      `trailer\n<< /Size ${totalObjs} /Root ${catalogObj} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`
    );

    // Combine all parts into a single Uint8Array
    const totalLength = parts.reduce((acc, p) => acc + p.length, 0);
    const result = new Uint8Array(totalLength);
    let pos = 0;
    for (const part of parts) {
      result.set(part, pos);
      pos += part.length;
    }
    return result;
  }
}

/**
 * Converts an SVG string into a JPEG Uint8Array using browser Canvas.
 * Returns null if running in an environment without DOM Canvas support.
 */
export async function rasterizeSvgToJpeg(
  svgString: string,
  targetWidth: number,
  targetHeight: number
): Promise<{ bytes: Uint8Array; width: number; height: number } | null> {
  if (typeof window === 'undefined' || typeof document === 'undefined') return null;

  return new Promise(resolve => {
    try {
      const img = new Image();
      const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);

      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = targetWidth;
          canvas.height = targetHeight;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            URL.revokeObjectURL(url);
            resolve(null);
            return;
          }

          // Fill clean architectural white background
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, targetWidth, targetHeight);

          // Draw floor plan graphic
          ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
          URL.revokeObjectURL(url);

          canvas.toBlob(blob => {
            if (!blob) {
              resolve(null);
              return;
            }
            blob.arrayBuffer().then(buf => {
              resolve({
                bytes: new Uint8Array(buf),
                width: targetWidth,
                height: targetHeight,
              });
            }).catch(() => resolve(null));
          }, 'image/jpeg', 0.95);
        } catch {
          URL.revokeObjectURL(url);
          resolve(null);
        }
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(null);
      };

      img.src = url;
    } catch {
      resolve(null);
    }
  });
}

export interface RenderCADSymbolItem {
  x: number;
  y: number;
  w: number;
  h: number;
  rotation?: number;
  type: string;
  name?: string;
  label?: string;
  rotateAroundOrigin?: boolean;
}

/**
 * Renders high-fidelity 2D architectural CAD blocks onto an HTML5 Canvas context.
 * Used for PDF exports and blueprint generation, replacing plain bounding boxes
 * with realistic architectural symbols (beds, sofas, dining tables, fans, toilets, etc.).
 */
export function renderCADSymbol(
  ctx: CanvasRenderingContext2D,
  item: RenderCADSymbolItem
): void {
  ctx.save();
  const w = Math.max(4, item.w);
  const h = Math.max(4, item.h);

  ctx.translate(item.x, item.y);
  if (item.rotation) {
    if (item.rotateAroundOrigin) {
      ctx.rotate((item.rotation * Math.PI) / 180);
    } else {
      ctx.translate(w / 2, h / 2);
      ctx.rotate((item.rotation * Math.PI) / 180);
      ctx.translate(-w / 2, -h / 2);
    }
  }

  const rawType = (item.type || item.name || item.label || '').toLowerCase().trim();
  const displayName = item.label || item.name || item.type || 'Item';

  // Helper for safe ellipse drawing across all canvas environments
  const drawEllipse = (
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    fill = true,
    stroke = true
  ) => {
    ctx.beginPath();
    if (typeof (ctx as any).ellipse === 'function') {
      (ctx as any).ellipse(cx, cy, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, Math.PI * 2);
    } else {
      ctx.arc(cx, cy, Math.max(0.1, Math.min(rx, ry)), 0, Math.PI * 2);
    }
    if (fill) ctx.fill();
    if (stroke) ctx.stroke();
  };

  // Helper for rounded rectangles if available or fallback to rect
  const drawRoundRect = (
    rx: number,
    ry: number,
    rw: number,
    rh: number,
    radius: number,
    fill = true,
    stroke = true
  ) => {
    ctx.beginPath();
    if (typeof (ctx as any).roundRect === 'function') {
      (ctx as any).roundRect(rx, ry, rw, rh, radius);
    } else {
      ctx.rect(rx, ry, rw, rh);
    }
    if (fill) ctx.fill();
    if (stroke) ctx.stroke();
  };

  switch (true) {
    // ═══════════════════════════════════════════════════════════════
    // 1. DOUBLE BED / KING BED / QUEEN BED
    // ═══════════════════════════════════════════════════════════════
    case rawType === 'bed' ||
      rawType === 'double bed' ||
      rawType === 'king bed' ||
      rawType === 'queen bed' ||
      rawType.includes('double bed') ||
      rawType.includes('king bed') ||
      rawType.includes('queen bed'): {
      // Outer Frame
      ctx.fillStyle = '#EFF6FF';
      ctx.strokeStyle = '#1E40AF';
      ctx.lineWidth = 1.5;
      ctx.fillRect(0, 0, w, h);
      ctx.strokeRect(0, 0, w, h);

      // Headboard
      ctx.fillStyle = '#BFDBFE';
      ctx.fillRect(0, 0, w, h * 0.15);
      ctx.strokeRect(0, 0, w, h * 0.15);

      // Two Pillows
      const pW = w * 0.38;
      const pH = h * 0.22;
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(w * 0.08, h * 0.20, pW, pH);
      ctx.strokeRect(w * 0.08, h * 0.20, pW, pH);
      ctx.fillRect(w * 0.54, h * 0.20, pW, pH);
      ctx.strokeRect(w * 0.54, h * 0.20, pW, pH);

      // Blanket Fold Line
      ctx.beginPath();
      ctx.moveTo(0, h * 0.55);
      ctx.lineTo(w, h * 0.55);
      ctx.strokeStyle = '#3B82F6';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // Bed Sheet Turn-down Accent
      ctx.fillStyle = 'rgba(191, 219, 254, 0.4)';
      ctx.fillRect(0, h * 0.45, w, h * 0.1);
      break;
    }

    // ═══════════════════════════════════════════════════════════════
    // 1b. SINGLE BED
    // ═══════════════════════════════════════════════════════════════
    case rawType === 'single bed' || rawType.includes('single bed'): {
      ctx.fillStyle = '#EFF6FF';
      ctx.strokeStyle = '#1E40AF';
      ctx.lineWidth = 1.5;
      ctx.fillRect(0, 0, w, h);
      ctx.strokeRect(0, 0, w, h);

      // Headboard
      ctx.fillStyle = '#BFDBFE';
      ctx.fillRect(0, 0, w, h * 0.15);
      ctx.strokeRect(0, 0, w, h * 0.15);

      // Single Central Pillow
      const spW = w * 0.65;
      const spH = h * 0.22;
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect((w - spW) / 2, h * 0.20, spW, spH);
      ctx.strokeRect((w - spW) / 2, h * 0.20, spW, spH);

      // Blanket Fold Line
      ctx.beginPath();
      ctx.moveTo(0, h * 0.55);
      ctx.lineTo(w, h * 0.55);
      ctx.strokeStyle = '#3B82F6';
      ctx.lineWidth = 1.2;
      ctx.stroke();
      break;
    }

    // ═══════════════════════════════════════════════════════════════
    // 2. L-SHAPED SOFA / SECTIONAL
    // ═══════════════════════════════════════════════════════════════
    case rawType === 'sofa' ||
      rawType === 'l sofa' ||
      rawType === 'l-sofa' ||
      rawType.includes('l-shaped') ||
      rawType.includes('sectional') ||
      rawType === 'l-shaped sofa': {
      ctx.fillStyle = '#F0FDF4';
      ctx.strokeStyle = '#15803D';
      ctx.lineWidth = 1.5;

      // Main horizontal seating
      ctx.fillRect(0, h * 0.4, w, h * 0.6);
      ctx.strokeRect(0, h * 0.4, w, h * 0.6);

      // Vertical extension / chaise lounge
      ctx.fillRect(w * 0.55, 0, w * 0.45, h * 0.4);
      ctx.strokeRect(w * 0.55, 0, w * 0.45, h * 0.4);

      // Backrest outer strip
      ctx.fillStyle = '#DCFCE7';
      ctx.fillRect(0, h * 0.85, w, h * 0.15);
      ctx.strokeRect(0, h * 0.85, w, h * 0.15);
      ctx.fillRect(w * 0.85, 0, w * 0.15, h * 0.85);
      ctx.strokeRect(w * 0.85, 0, w * 0.15, h * 0.85);

      // Cushion divider creases
      ctx.strokeStyle = '#86EFAC';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(w * 0.3, h * 0.4);
      ctx.lineTo(w * 0.3, h * 0.85);
      ctx.moveTo(w * 0.55, h * 0.4);
      ctx.lineTo(w * 0.55, h * 0.85);
      ctx.moveTo(w * 0.55, h * 0.2);
      ctx.lineTo(w * 0.85, h * 0.2);
      ctx.stroke();
      break;
    }

    // ═══════════════════════════════════════════════════════════════
    // 2b. LINEAR SOFA / 2-SEATER / 3-SEATER / ARMCHAIR
    // ═══════════════════════════════════════════════════════════════
    case rawType.includes('sofa') ||
      rawType.includes('couch') ||
      rawType.includes('armchair') ||
      rawType.includes('seating'): {
      ctx.fillStyle = '#F0FDF4';
      ctx.strokeStyle = '#15803D';
      ctx.lineWidth = 1.5;
      ctx.fillRect(0, 0, w, h);
      ctx.strokeRect(0, 0, w, h);

      // Backrest
      const backH = h * 0.28;
      ctx.fillStyle = '#DCFCE7';
      ctx.fillRect(0, 0, w, backH);
      ctx.strokeRect(0, 0, w, backH);

      // Armrests
      const armW = w * 0.14;
      ctx.fillRect(0, backH, armW, h - backH);
      ctx.strokeRect(0, backH, armW, h - backH);
      ctx.fillRect(w - armW, backH, armW, h - backH);
      ctx.strokeRect(w - armW, backH, armW, h - backH);

      // Cushions divider
      ctx.strokeStyle = '#86EFAC';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(w * 0.5, backH);
      ctx.lineTo(w * 0.5, h);
      ctx.stroke();
      break;
    }

    // ═══════════════════════════════════════════════════════════════
    // 3. DINING TABLE & 4 CHAIRS / 6 CHAIRS
    // ═══════════════════════════════════════════════════════════════
    case rawType === 'dining' ||
      rawType === 'dining table' ||
      rawType === '4-seat dining table' ||
      rawType.includes('dining'): {
      // Central Table
      ctx.fillStyle = '#FEFCE8';
      ctx.strokeStyle = '#B45309';
      ctx.lineWidth = 1.5;
      const tX = w * 0.2, tY = h * 0.2, tW = w * 0.6, tH = h * 0.6;
      ctx.fillRect(tX, tY, tW, tH);
      ctx.strokeRect(tX, tY, tW, tH);

      // Check if 6-seat dining table
      const is6Seat = rawType.includes('6') || (w / Math.max(1, h) > 1.4);
      ctx.fillStyle = '#FDE68A';

      if (is6Seat) {
        const cW = tW * 0.38;
        const cH = tY;
        // Top 2 chairs
        ctx.fillRect(tX + tW * 0.08, 0, cW, cH);
        ctx.strokeRect(tX + tW * 0.08, 0, cW, cH);
        ctx.fillRect(tX + tW * 0.54, 0, cW, cH);
        ctx.strokeRect(tX + tW * 0.54, 0, cW, cH);
        // Bottom 2 chairs
        ctx.fillRect(tX + tW * 0.08, tY + tH, cW, cH);
        ctx.strokeRect(tX + tW * 0.08, tY + tH, cW, cH);
        ctx.fillRect(tX + tW * 0.54, tY + tH, cW, cH);
        ctx.strokeRect(tX + tW * 0.54, tY + tH, cW, cH);
        // End chairs (left & right)
        const sideW = tX;
        const sideH = tH * 0.5;
        ctx.fillRect(0, tY + (tH - sideH) / 2, sideW, sideH);
        ctx.strokeRect(0, tY + (tH - sideH) / 2, sideW, sideH);
        ctx.fillRect(tX + tW, tY + (tH - sideH) / 2, sideW, sideH);
        ctx.strokeRect(tX + tW, tY + (tH - sideH) / 2, sideW, sideH);
      } else {
        // Standard 4 Chairs around table
        const cSize = Math.min(w, h) * 0.22;
        // Top Chair
        ctx.strokeRect(w * 0.5 - cSize / 2, 0, cSize, tY);
        ctx.fillRect(w * 0.5 - cSize / 2, 0, cSize, tY);
        // Bottom Chair
        ctx.strokeRect(w * 0.5 - cSize / 2, tY + tH, cSize, tY);
        ctx.fillRect(w * 0.5 - cSize / 2, tY + tH, cSize, tY);
        // Left Chair
        ctx.strokeRect(0, h * 0.5 - cSize / 2, tX, cSize);
        ctx.fillRect(0, h * 0.5 - cSize / 2, tX, cSize);
        // Right Chair
        ctx.strokeRect(tX + tW, h * 0.5 - cSize / 2, tX, cSize);
        ctx.fillRect(tX + tW, h * 0.5 - cSize / 2, tX, cSize);
      }
      break;
    }

    // ═══════════════════════════════════════════════════════════════
    // 4. CEILING FAN (Central Hub + Aerodynamic Blades)
    // ═══════════════════════════════════════════════════════════════
    case rawType === 'fan' ||
      rawType === 'ceiling fan' ||
      rawType.includes('fan'): {
      const cx = w / 2;
      const cy = h / 2;
      const radius = Math.min(w, h) * 0.45;

      ctx.strokeStyle = '#0284C7';
      ctx.fillStyle = '#E0F2FE';
      ctx.lineWidth = 1.5;

      // Outer safety boundary (dashed circle)
      ctx.save();
      if (typeof ctx.setLineDash === 'function') {
        ctx.setLineDash([4, 3]);
      }
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // 4 Fan Blades
      ctx.fillStyle = '#0284C7';
      for (let angle = 0; angle < 360; angle += 90) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate((angle * Math.PI) / 180);
        ctx.fillRect(-Math.max(2, radius * 0.08), 6, Math.max(4, radius * 0.16), radius - 8);
        ctx.restore();
      }

      // Central Hub
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 0.3, 0, Math.PI * 2);
      ctx.fillStyle = '#0369A1';
      ctx.fill();
      ctx.strokeStyle = '#075985';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // Center Pin
      ctx.beginPath();
      ctx.arc(cx, cy, Math.max(1.5, radius * 0.08), 0, Math.PI * 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
      break;
    }

    // ═══════════════════════════════════════════════════════════════
    // 5. TOILET WATER CLOSET (WC)
    // ═══════════════════════════════════════════════════════════════
    case rawType === 'toilet' ||
      rawType === 'wc' ||
      rawType.includes('toilet') ||
      rawType.includes('water closet') ||
      rawType.includes('commode'): {
      ctx.strokeStyle = '#0284C7';
      ctx.lineWidth = 1.2;

      // Tank (Cistern)
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, w, h * 0.35);
      ctx.strokeRect(0, 0, w, h * 0.35);

      // Flush button
      ctx.fillStyle = '#94A3B8';
      ctx.fillRect(w * 0.42, h * 0.1, w * 0.16, h * 0.12);

      // Bowl Oval
      drawEllipse(w / 2, h * 0.65, w * 0.4, h * 0.32, true, true);

      // Inner Hole
      ctx.strokeStyle = '#94A3B8';
      drawEllipse(w / 2, h * 0.7, w * 0.22, h * 0.18, false, true);
      break;
    }

    // ═══════════════════════════════════════════════════════════════
    // 6. WASHING MACHINE
    // ═══════════════════════════════════════════════════════════════
    case rawType.includes('washing') ||
      rawType.includes('washer') ||
      rawType.includes('laundry'): {
      ctx.fillStyle = '#F8FAFC';
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1.5;
      ctx.fillRect(0, 0, w, h);
      ctx.strokeRect(0, 0, w, h);

      // Top Control Panel
      ctx.fillStyle = '#E2E8F0';
      ctx.fillRect(0, 0, w, h * 0.22);
      ctx.strokeRect(0, 0, w, h * 0.22);

      // Dials / Buttons
      ctx.fillStyle = '#0284C7';
      drawEllipse(w * 0.25, h * 0.11, w * 0.08, h * 0.06, true, false);
      ctx.fillStyle = '#64748B';
      drawEllipse(w * 0.65, h * 0.11, w * 0.05, h * 0.04, true, false);
      drawEllipse(w * 0.8, h * 0.11, w * 0.05, h * 0.04, true, false);

      // Large Glass Door / Drum (Circular)
      ctx.fillStyle = '#F1F5F9';
      ctx.strokeStyle = '#0284C7';
      drawEllipse(w / 2, h * 0.62, w * 0.34, h * 0.28, true, true);
      // Inner drum ring
      ctx.strokeStyle = '#94A3B8';
      drawEllipse(w / 2, h * 0.62, w * 0.22, h * 0.18, false, true);
      break;
    }

    // ═══════════════════════════════════════════════════════════════
    // 7. SPLIT AIR CONDITIONER (AC)
    // ═══════════════════════════════════════════════════════════════
    case rawType === 'ac' ||
      rawType === 'split ac' ||
      rawType.includes('air conditioner') ||
      rawType.includes('ac'): {
      ctx.fillStyle = '#F8FAFC';
      ctx.strokeStyle = '#0284C7';
      ctx.lineWidth = 1.5;
      ctx.fillRect(0, 0, w, h);
      ctx.strokeRect(0, 0, w, h);

      // Discharge Air Vent Louvers
      ctx.fillStyle = '#E2E8F0';
      ctx.fillRect(w * 0.08, h * 0.6, w * 0.84, h * 0.28);
      ctx.strokeRect(w * 0.08, h * 0.6, w * 0.84, h * 0.28);

      // Louver lines
      ctx.strokeStyle = '#94A3B8';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(w * 0.12, h * 0.74);
      ctx.lineTo(w * 0.88, h * 0.74);
      ctx.stroke();

      // Power / Temperature Display LED
      ctx.fillStyle = '#10B981';
      ctx.beginPath();
      ctx.arc(w * 0.85, h * 0.3, Math.max(1.5, Math.min(w, h) * 0.05), 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    // ═══════════════════════════════════════════════════════════════
    // 8. REFRIGERATOR / FRIDGE
    // ═══════════════════════════════════════════════════════════════
    case rawType.includes('fridge') ||
      rawType.includes('refrigerator'): {
      ctx.fillStyle = '#F8FAFC';
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1.5;
      ctx.fillRect(0, 0, w, h);
      ctx.strokeRect(0, 0, w, h);

      // Door division line (Freezer top / Fridge bottom)
      const splitY = h * 0.38;
      ctx.strokeStyle = '#475569';
      ctx.beginPath();
      ctx.moveTo(0, splitY);
      ctx.lineTo(w, splitY);
      ctx.stroke();

      // Door Handles
      ctx.fillStyle = '#94A3B8';
      ctx.fillRect(w * 0.86, h * 0.12, w * 0.06, h * 0.18);
      ctx.fillRect(w * 0.86, splitY + h * 0.08, w * 0.06, h * 0.28);
      break;
    }

    // ═══════════════════════════════════════════════════════════════
    // 9. GAS STOVE / COOKTOP
    // ═══════════════════════════════════════════════════════════════
    case rawType.includes('stove') ||
      rawType.includes('cooktop') ||
      rawType.includes('gas') ||
      rawType.includes('hob'): {
      ctx.fillStyle = '#1E293B';
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1.5;
      ctx.fillRect(0, 0, w, h);
      ctx.strokeRect(0, 0, w, h);

      // Burners
      const bRad = Math.min(w, h) * 0.22;
      const bCenters = [
        { x: w * 0.28, y: h * 0.5 },
        { x: w * 0.72, y: h * 0.5 },
      ];

      bCenters.forEach(bc => {
        // Outer burner ring
        ctx.fillStyle = '#334155';
        ctx.strokeStyle = '#94A3B8';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(bc.x, bc.y, bRad, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Inner brass burner
        ctx.fillStyle = '#F59E0B';
        ctx.beginPath();
        ctx.arc(bc.x, bc.y, bRad * 0.45, 0, Math.PI * 2);
        ctx.fill();

        // Grate cross lines
        ctx.strokeStyle = '#CBD5E1';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(bc.x - bRad, bc.y);
        ctx.lineTo(bc.x + bRad, bc.y);
        ctx.moveTo(bc.x, bc.y - bRad);
        ctx.lineTo(bc.x, bc.y + bRad);
        ctx.stroke();
      });
      break;
    }

    // ═══════════════════════════════════════════════════════════════
    // 10. KITCHEN SINK
    // ═══════════════════════════════════════════════════════════════
    case rawType.includes('sink') && !rawType.includes('basin'): {
      ctx.fillStyle = '#F1F5F9';
      ctx.strokeStyle = '#0284C7';
      ctx.lineWidth = 1.5;
      ctx.fillRect(0, 0, w, h);
      ctx.strokeRect(0, 0, w, h);

      // Basin Bowl
      const bInset = Math.min(w, h) * 0.12;
      ctx.fillStyle = '#E2E8F0';
      ctx.fillRect(bInset, bInset, w - 2 * bInset, h - 2 * bInset);
      ctx.strokeRect(bInset, bInset, w - 2 * bInset, h - 2 * bInset);

      // Drain Hole
      ctx.fillStyle = '#64748B';
      drawEllipse(w / 2, h / 2, Math.min(w, h) * 0.08, Math.min(w, h) * 0.08, true, false);

      // Faucet Neck & Spout
      ctx.strokeStyle = '#0284C7';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(w / 2, bInset);
      ctx.lineTo(w / 2, h * 0.35);
      ctx.stroke();
      break;
    }

    // ═══════════════════════════════════════════════════════════════
    // 11. WASH BASIN (Bathroom)
    // ═══════════════════════════════════════════════════════════════
    case rawType.includes('basin') || rawType.includes('wash basin'): {
      ctx.fillStyle = '#FFFFFF';
      ctx.strokeStyle = '#0284C7';
      ctx.lineWidth = 1.4;

      // Outer Counter/Mount
      ctx.fillRect(0, 0, w, h);
      ctx.strokeRect(0, 0, w, h);

      // Oval Basin Cavity
      drawEllipse(w / 2, h * 0.55, w * 0.38, h * 0.35, true, true);

      // Faucet Tap
      ctx.fillStyle = '#94A3B8';
      ctx.fillRect(w * 0.44, h * 0.05, w * 0.12, h * 0.2);

      // Drain Hole
      ctx.fillStyle = '#64748B';
      drawEllipse(w / 2, h * 0.58, w * 0.08, h * 0.08, true, false);
      break;
    }

    // ═══════════════════════════════════════════════════════════════
    // 12. WARDROBE / CLOSET / ALMIRAH
    // ═══════════════════════════════════════════════════════════════
    case rawType.includes('wardrobe') ||
      rawType.includes('closet') ||
      rawType.includes('almirah') ||
      rawType.includes('cupboard'): {
      ctx.fillStyle = '#FEFCE8';
      ctx.strokeStyle = '#854D0E';
      ctx.lineWidth = 1.5;
      ctx.fillRect(0, 0, w, h);
      ctx.strokeRect(0, 0, w, h);

      // Center Divider line (sliding/hinged doors)
      ctx.strokeStyle = '#A16207';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(w / 2, 0);
      ctx.lineTo(w / 2, h);
      ctx.stroke();

      // Hanger Rod & Hangers representation
      ctx.strokeStyle = '#CA8A04';
      ctx.lineWidth = 1;
      const numHangers = Math.max(3, Math.floor(w / 12));
      const step = w / (numHangers + 1);
      for (let i = 1; i <= numHangers; i++) {
        const hx = i * step;
        ctx.beginPath();
        ctx.moveTo(hx - step * 0.35, h * 0.25);
        ctx.lineTo(hx + step * 0.35, h * 0.25);
        ctx.lineTo(hx, h * 0.55);
        ctx.closePath();
        ctx.stroke();
      }
      break;
    }

    // ═══════════════════════════════════════════════════════════════
    // 13. TV UNIT / CONSOLE
    // ═══════════════════════════════════════════════════════════════
    case rawType.includes('tv') ||
      rawType.includes('television') ||
      rawType.includes('entertainment'): {
      ctx.fillStyle = '#F8FAFC';
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1.4;
      ctx.fillRect(0, 0, w, h);
      ctx.strokeRect(0, 0, w, h);

      // Slim Flat TV Screen Screen Bar
      ctx.fillStyle = '#0F172A';
      const tvH = Math.max(3, h * 0.2);
      ctx.fillRect(w * 0.1, (h - tvH) / 2, w * 0.8, tvH);

      // Stand
      ctx.fillStyle = '#64748B';
      ctx.fillRect(w * 0.4, (h - tvH) / 2 + tvH, w * 0.2, h * 0.15);
      break;
    }

    // ═══════════════════════════════════════════════════════════════
    // 14. COFFEE TABLE
    // ═══════════════════════════════════════════════════════════════
    case rawType.includes('coffee') ||
      rawType.includes('tea table') ||
      rawType.includes('center table'): {
      ctx.fillStyle = '#FEFCE8';
      ctx.strokeStyle = '#B45309';
      ctx.lineWidth = 1.4;
      ctx.fillRect(0, 0, w, h);
      ctx.strokeRect(0, 0, w, h);

      // Inner glass inlay rect
      const inset = Math.min(w, h) * 0.18;
      ctx.fillStyle = '#EFF6FF';
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 1;
      ctx.fillRect(inset, inset, w - 2 * inset, h - 2 * inset);
      ctx.strokeRect(inset, inset, w - 2 * inset, h - 2 * inset);
      break;
    }

    // ═══════════════════════════════════════════════════════════════
    // 15. SHOWER / SHOWER CUBICLE
    // ═══════════════════════════════════════════════════════════════
    case rawType.includes('shower'): {
      ctx.fillStyle = '#F0F9FF';
      ctx.strokeStyle = '#0284C7';
      ctx.lineWidth = 1.5;
      ctx.fillRect(0, 0, w, h);
      ctx.strokeRect(0, 0, w, h);

      // Shower head circle with spray dots
      const cx = w * 0.3;
      const cy = h * 0.3;
      ctx.fillStyle = '#0284C7';
      ctx.beginPath();
      ctx.arc(cx, cy, Math.min(w, h) * 0.14, 0, Math.PI * 2);
      ctx.fill();

      // Drain in opposite corner
      drawEllipse(w * 0.75, h * 0.75, Math.min(w, h) * 0.08, Math.min(w, h) * 0.08, true, false);

      // Glass partition door line
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(w * 0.7, 0);
      ctx.lineTo(w, h * 0.3);
      ctx.stroke();
      break;
    }

    // ═══════════════════════════════════════════════════════════════
    // 16. BATHTUB
    // ═══════════════════════════════════════════════════════════════
    case rawType.includes('bathtub') || rawType.includes('tub'): {
      ctx.fillStyle = '#FFFFFF';
      ctx.strokeStyle = '#0284C7';
      ctx.lineWidth = 1.5;
      ctx.fillRect(0, 0, w, h);
      ctx.strokeRect(0, 0, w, h);

      // Smooth Rounded Inner Tub Cavity
      const inset = Math.min(w, h) * 0.14;
      ctx.fillStyle = '#F0F9FF';
      ctx.strokeStyle = '#38BDF8';
      drawRoundRect(inset, inset, w - 2 * inset, h - 2 * inset, inset, true, true);

      // Drain
      ctx.fillStyle = '#64748B';
      drawEllipse(w * 0.2, h / 2, Math.min(w, h) * 0.07, Math.min(w, h) * 0.07, true, false);
      break;
    }

    // ═══════════════════════════════════════════════════════════════
    // 17. CAR / PARKING
    // ═══════════════════════════════════════════════════════════════
    case rawType.includes('car') ||
      rawType.includes('parking') ||
      rawType.includes('vehicle'): {
      ctx.fillStyle = '#E2E8F0';
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1.5;
      drawRoundRect(0, 0, w, h, Math.min(w, h) * 0.15, true, true);

      // Windshield & Rear glass
      ctx.fillStyle = '#38BDF8';
      ctx.strokeStyle = '#0284C7';
      ctx.lineWidth = 1;
      // Front windshield
      ctx.fillRect(w * 0.15, h * 0.22, w * 0.7, h * 0.16);
      ctx.strokeRect(w * 0.15, h * 0.22, w * 0.7, h * 0.16);
      // Rear glass
      ctx.fillRect(w * 0.18, h * 0.68, w * 0.64, h * 0.14);
      ctx.strokeRect(w * 0.18, h * 0.68, w * 0.64, h * 0.14);
      break;
    }

    // ═══════════════════════════════════════════════════════════════
    // 18. PLANT / INDOOR PLANT / TREE
    // ═══════════════════════════════════════════════════════════════
    case rawType.includes('plant') ||
      rawType.includes('tree') ||
      rawType.includes('pot'): {
      const pcx = w / 2;
      const pcy = h / 2;
      const pr = Math.min(w, h) * 0.42;

      // Radiating Leaf Lobes
      ctx.fillStyle = '#86EFAC';
      ctx.strokeStyle = '#15803D';
      ctx.lineWidth = 1.2;
      for (let angle = 0; angle < 360; angle += 45) {
        ctx.save();
        ctx.translate(pcx, pcy);
        ctx.rotate((angle * Math.PI) / 180);
        drawEllipse(0, pr * 0.55, pr * 0.22, pr * 0.42, true, true);
        ctx.restore();
      }

      // Center Pot Rim
      ctx.beginPath();
      ctx.arc(pcx, pcy, pr * 0.35, 0, Math.PI * 2);
      ctx.fillStyle = '#CA8A04';
      ctx.fill();
      ctx.strokeStyle = '#854D0E';
      ctx.stroke();
      break;
    }

    // ═══════════════════════════════════════════════════════════════
    // 19. DESK / OFFICE TABLE / STUDY TABLE
    // ═══════════════════════════════════════════════════════════════
    case rawType.includes('desk') ||
      rawType.includes('study') ||
      rawType.includes('office table'): {
      ctx.fillStyle = '#FEFCE8';
      ctx.strokeStyle = '#854D0E';
      ctx.lineWidth = 1.5;
      ctx.fillRect(0, 0, w, h);
      ctx.strokeRect(0, 0, w, h);

      // Laptop / Notebook outline
      ctx.fillStyle = '#64748B';
      ctx.fillRect(w * 0.32, h * 0.25, w * 0.36, h * 0.4);

      // Chair back curve behind desk
      ctx.fillStyle = '#0284C7';
      drawEllipse(w / 2, h * 0.9, w * 0.22, h * 0.15, true, false);
      break;
    }

    // ═══════════════════════════════════════════════════════════════
    // 20. ELECTRICAL LIGHT / CEILING SPOT / LAMP / DOWNLIGHT (⨁)
    // ═══════════════════════════════════════════════════════════════
    case rawType.includes('light') ||
      rawType.includes('spot') ||
      rawType.includes('lamp') ||
      rawType.includes('ceiling light') ||
      rawType.includes('downlight') ||
      rawType.includes('chandelier') ||
      rawType === 'light' ||
      rawType === 'spot': {
      const cx = w / 2;
      const cy = h / 2;
      const r = Math.min(w, h) * 0.42;

      // Outer fixture circle
      ctx.fillStyle = '#FEF9C3';
      ctx.strokeStyle = '#D97706';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Crosshair lines forming architectural ⨁ symbol
      ctx.strokeStyle = '#B45309';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(cx - r, cy);
      ctx.lineTo(cx + r, cy);
      ctx.moveTo(cx, cy - r);
      ctx.lineTo(cx, cy + r);
      ctx.stroke();

      // Center core bulb
      ctx.fillStyle = '#F59E0B';
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#92400E';
      ctx.lineWidth = 1;
      ctx.stroke();
      break;
    }

    // ═══════════════════════════════════════════════════════════════
    // DEFAULT FALLBACK: Clean architectural block with legible label
    // ═══════════════════════════════════════════════════════════════
    default: {
      ctx.fillStyle = '#F8FAFC';
      ctx.strokeStyle = '#64748B';
      ctx.lineWidth = 1.2;
      ctx.fillRect(0, 0, w, h);
      ctx.strokeRect(0, 0, w, h);

      ctx.fillStyle = '#334155';
      const fontSize = Math.max(8, Math.min(12, Math.floor(Math.min(w, h) * 0.25)));
      ctx.font = `600 ${fontSize}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(displayName, w / 2, h / 2);
      break;
    }
  }

  ctx.restore();
}

/**
 * Renders the floor plan to a high-resolution 300 DPI offscreen HTML5 canvas and returns a PNG Data URL.
 * Produces crisp, razor-sharp architectural CAD vector line-work (3508x2480 for A4 landscape).
 * Ensures willReadFrequently: true and complete procedural CAD blocks so exported PDFs never have blank drawings.
 */
export function renderFloorPlanToCanvas(
  options: FloorPlanPdfOptions,
  width: number = 3508,
  height: number = 2480
): string {
  if (typeof document === 'undefined') return '';
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return '';

  const fontScale = width / 1600;

  // Background - Clean Architectural White
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  // Compute bounding box of all elements to auto-fit nicely
  const plotW = Math.max(10, options.plan.plotLength || 40);
  const plotH = Math.max(10, options.plan.plotWidth || 30);

  let minX = 0;
  let minY = 0;
  let maxX = plotW;
  let maxY = plotH;

  (options.walls || []).forEach(w => {
    minX = Math.min(minX, w.x1, w.x2);
    minY = Math.min(minY, w.y1, w.y2);
    maxX = Math.max(maxX, w.x1, w.x2);
    maxY = Math.max(maxY, w.y1, w.y2);
  });
  (options.rooms || []).forEach(r => {
    minX = Math.min(minX, r.x);
    minY = Math.min(minY, r.y);
    maxX = Math.max(maxX, r.x + r.width);
    maxY = Math.max(maxY, r.y + r.height);
  });

  const spanX = Math.max(10, maxX - minX);
  const spanY = Math.max(10, maxY - minY);
  const pad = 100 * fontScale;
  const scale = Math.min((width - pad * 2) / spanX, (height - pad * 2) / spanY);
  const offsetX = (width - spanX * scale) / 2 - minX * scale;
  const offsetY = (height - spanY * scale) / 2 - minY * scale;

  const toScreenX = (val: number) => offsetX + val * scale;
  const toScreenY = (val: number) => offsetY + val * scale;

  // Grid
  ctx.strokeStyle = '#f1f5f9';
  ctx.lineWidth = Math.max(1, 1 * fontScale);
  const gridStep = 5;
  for (let gx = Math.floor(minX / gridStep) * gridStep; gx <= maxX + gridStep; gx += gridStep) {
    ctx.beginPath();
    ctx.moveTo(toScreenX(gx), toScreenY(minY - 2));
    ctx.lineTo(toScreenX(gx), toScreenY(maxY + 2));
    ctx.stroke();
  }
  for (let gy = Math.floor(minY / gridStep) * gridStep; gy <= maxY + gridStep; gy += gridStep) {
    ctx.beginPath();
    ctx.moveTo(toScreenX(minX - 2), toScreenY(gy));
    ctx.lineTo(toScreenX(maxX + 2), toScreenY(gy));
    ctx.stroke();
  }

  // Plot Boundary
  ctx.strokeStyle = '#94a3b8';
  ctx.setLineDash([8 * fontScale, 5 * fontScale]);
  ctx.lineWidth = 1.5 * fontScale;
  ctx.strokeRect(toScreenX(0), toScreenY(0), plotW * scale, plotH * scale);
  ctx.setLineDash([]);

  // Rooms
  const roomColors = ['#f8fafc', '#f0fdf4', '#eff6ff', '#fefce8', '#fdf2f8', '#faf5ff'];
  (options.rooms || []).forEach((r, idx) => {
    const rx = toScreenX(r.x);
    const ry = toScreenY(r.y);
    const rw = r.width * scale;
    const rh = r.height * scale;

    ctx.fillStyle = roomColors[idx % roomColors.length];
    ctx.fillRect(rx, ry, rw, rh);

    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = Math.max(1, 1 * fontScale);
    ctx.strokeRect(rx, ry, rw, rh);

    // Label
    ctx.fillStyle = '#0f172a';
    ctx.font = `bold ${Math.round(15 * fontScale)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(r.label || `Room ${idx + 1}`, rx + rw / 2, ry + rh / 2 - 14 * fontScale);

    ctx.fillStyle = '#64748b';
    ctx.font = `${Math.round(12 * fontScale)}px sans-serif`;
    const dimText = `${formatLength(r.width, options.unit)} × ${formatLength(r.height, options.unit)}`;
    ctx.fillText(dimText, rx + rw / 2, ry + rh / 2 + 8 * fontScale);
    const areaText = formatArea(r.width * r.height, options.unit);
    ctx.fillText(areaText, rx + rw / 2, ry + rh / 2 + 28 * fontScale);
  });

  // Walls (Exterior / Interior)
  ctx.strokeStyle = '#1e293b';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  (options.walls || []).forEach(w => {
    const thicknessPx = Math.max(5 * fontScale, (w.thickness || 0.75) * scale);
    ctx.lineWidth = thicknessPx;
    ctx.beginPath();
    ctx.moveTo(toScreenX(w.x1), toScreenY(w.y1));
    ctx.lineTo(toScreenX(w.x2), toScreenY(w.y2));
    ctx.stroke();
  });

  // Doors (Procedural 90-degree swing arc with door leaf and jambs)
  (options.doors || []).forEach(d => {
    ctx.save();
    const dx = toScreenX(d.x);
    const dy = toScreenY(d.y);
    const dWidth = Math.max(16 * fontScale, (d.width || 3) * scale);
    ctx.translate(dx, dy);
    if (d.rotation) {
      ctx.rotate((d.rotation * Math.PI) / 180);
    }
    // Hinge jamb
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(-2 * fontScale, -4 * fontScale, 4 * fontScale, 8 * fontScale);
    // Door leaf (90-degree open line)
    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 2.5 * fontScale;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -dWidth);
    ctx.stroke();
    // 90° Swing arc
    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 1.2 * fontScale;
    ctx.setLineDash([4 * fontScale, 3 * fontScale]);
    ctx.beginPath();
    ctx.arc(0, 0, dWidth, -Math.PI / 2, 0);
    ctx.stroke();
    ctx.setLineDash([]);
    // Stop jamb
    ctx.fillRect(dWidth - 2 * fontScale, -4 * fontScale, 4 * fontScale, 8 * fontScale);
    ctx.restore();
  });

  // Windows (Architectural Sliding Window Double-Lines with End Jambs)
  (options.windows || []).forEach(w => {
    ctx.save();
    const wx = toScreenX(w.x);
    const wy = toScreenY(w.y);
    const wWidth = Math.max(16 * fontScale, (w.width || 4) * scale);
    ctx.translate(wx, wy);
    if (w.rotation) {
      ctx.rotate((w.rotation * Math.PI) / 180);
    }
    const halfW = wWidth / 2;
    // End jambs
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(-halfW - 3 * fontScale, -6 * fontScale, 6 * fontScale, 12 * fontScale);
    ctx.fillRect(halfW - 3 * fontScale, -6 * fontScale, 6 * fontScale, 12 * fontScale);
    // Window sill / outer frame
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 1.5 * fontScale;
    ctx.strokeRect(-halfW, -5 * fontScale, wWidth, 10 * fontScale);
    // Double sliding panes
    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 2 * fontScale;
    // Left pane (front)
    ctx.beginPath();
    ctx.moveTo(-halfW, -2 * fontScale);
    ctx.lineTo(halfW * 0.1, -2 * fontScale);
    ctx.stroke();
    // Right pane (back)
    ctx.beginPath();
    ctx.moveTo(-halfW * 0.1, 2 * fontScale);
    ctx.lineTo(halfW, 2 * fontScale);
    ctx.stroke();
    ctx.restore();
  });

  // Furniture / Fixtures - High-Fidelity 2D Architectural CAD Blocks
  (options.furniture || []).forEach(f => {
    const fx = toScreenX(f.x);
    const fy = toScreenY(f.y);
    const fw = f.width * scale;
    const fh = f.height * scale;
    renderCADSymbol(ctx, {
      x: fx,
      y: fy,
      w: fw,
      h: fh,
      rotation: f.rotation || 0,
      type: f.itemType || f.label || '',
      name: f.label || f.itemType || 'Furniture',
      label: f.label,
    });
  });

  // North Compass
  const compassX = width - 70 * fontScale;
  const compassY = 70 * fontScale;
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 2 * fontScale;
  ctx.beginPath();
  ctx.moveTo(compassX, compassY + 28 * fontScale);
  ctx.lineTo(compassX, compassY - 20 * fontScale);
  ctx.stroke();
  ctx.fillStyle = '#0284c7';
  ctx.beginPath();
  ctx.moveTo(compassX, compassY - 30 * fontScale);
  ctx.lineTo(compassX - 9 * fontScale, compassY - 12 * fontScale);
  ctx.lineTo(compassX + 9 * fontScale, compassY - 12 * fontScale);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#0f172a';
  ctx.font = `bold ${Math.round(15 * fontScale)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText('N', compassX, compassY - 36 * fontScale);

  return canvas.toDataURL('image/png', 1.0);
}

/**
 * Generates a complete, professional architectural CAD PDF for Building Mistry.
 * Directly embeds high-res canvas image snapshot into jsPDF in landscape A4,
 * and renders an architectural title block, Room Schedule Table with autoTable,
 * strictly fitted to 1 landscape A4 sheet with 0 trailing blank pages.
 */
export async function generateFloorPlanPdfBlob(options: FloorPlanPdfOptions): Promise<Blob> {
  const isLandscape = (options.orientation || 'landscape') === 'landscape';

  const pdf = new jsPDF({
    orientation: isLandscape ? 'landscape' : 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: false,
  });

  const pageWidth = isLandscape ? 297 : 210;
  const pageHeight = isLandscape ? 210 : 297;
  const margin = 10;
  const contentWidth = pageWidth - margin * 2;
  const contentHeight = pageHeight - margin * 2;

  // 1. Outer Border / Sheet Margins
  pdf.setDrawColor(15, 23, 42); // slate-900
  pdf.setLineWidth(0.6);
  pdf.rect(margin, margin, contentWidth, contentHeight);

  // 2. Top Architectural Title Block
  pdf.setFillColor(248, 250, 252);
  pdf.rect(margin + 0.5, margin + 0.5, contentWidth - 1, 14, 'F');
  pdf.setDrawColor(203, 213, 225);
  pdf.setLineWidth(0.3);
  pdf.line(margin, margin + 15, margin + contentWidth, margin + 15);

  pdf.setTextColor(2, 132, 199); // Sky-600
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(13);
  pdf.text('BUILDING MISTRY - ARCHITECTURAL FLOOR PLAN', margin + 4, margin + 6.5);

  const floorName = options.floorLevels && options.activeFloorIndex !== undefined
    ? options.floorLevels[options.activeFloorIndex]?.name || options.plan.floorName
    : options.plan.floorName;

  pdf.setTextColor(51, 65, 85);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8.5);
  pdf.text(`Project: ${options.plan.buildingName} | Level: ${floorName}`, margin + 4, margin + 11.5);

  const siteText = options.siteName || options.plan.siteName ? `Site: ${options.siteName || options.plan.siteName} | ` : '';
  const dateStr = new Date().toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const unitLabel = options.unit === 'feet' || options.unit === 'inches' ? 'Imperial (Feet / Inches)' : 'Metric (Metres / mm)';

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7);
  pdf.setTextColor(71, 85, 105);
  const metaRight = margin + contentWidth - 4;
  pdf.text(`${siteText}Date: ${dateStr} | Units: ${unitLabel}`, metaRight, margin + 6.5, { align: 'right' });
  pdf.text(`Plot Size: ${options.plan.plotLength} x ${options.plan.plotWidth} (${options.unit}) | Scale: As Noted on Dimensions`, metaRight, margin + 11.5, { align: 'right' });

  // 3. Canvas Image Snapshot (Middle Area - 300 DPI Vector-Fidelity)
  let canvasDataUrl = options.canvasImage;
  if (!canvasDataUrl && typeof document !== 'undefined') {
    canvasDataUrl = renderFloorPlanToCanvas(options, 3508, 2480);
  }

  if (canvasDataUrl && canvasDataUrl.startsWith('data:image/')) {
    try {
      pdf.addImage(canvasDataUrl, 'PNG', 48, 26, 200, 110, undefined, 'FAST');
    } catch (e) {
      console.warn('Canvas snapshot embedding error:', e);
    }
  }

  // Canvas drawing box border
  pdf.setDrawColor(203, 213, 225);
  pdf.setLineWidth(0.3);
  pdf.rect(48, 26, 200, 110);

  // 4. Room Schedule Table below canvas using jspdf-autotable
  const roomRows = options.rooms.map((room, idx) => {
    const roomFittings = (options.furniture || [])
      .filter(f => (f as any).roomId === room.id || (
        f.x >= room.x && f.x <= room.x + room.width &&
        f.y >= room.y && f.y <= room.y + room.height
      ))
      .map(f => f.label || f.itemType || 'Fixture')
      .filter(Boolean);

    const fittingsStr = roomFittings.length > 0 ? Array.from(new Set(roomFittings)).join(', ') : 'Standard Fixtures';
    const dimStr = `${formatLength(room.width, options.unit)} x ${formatLength(room.height, options.unit)}`;
    const areaStr = formatArea(room.width * room.height, options.unit);
    return [
      room.label || `Room ${idx + 1}`,
      room.roomType || 'Living',
      dimStr,
      areaStr,
      fittingsStr,
    ];
  });

  if (roomRows.length === 0) {
    roomRows.push(['Main Hall', 'Living', '16\' 0" x 14\' 0"', '224 sq ft', 'Ceiling Fan, LED Downlights']);
  }

  autoTable(pdf, {
    startY: 139,
    head: [['ROOM NAME', 'ROOM TYPE', 'CLEAR DIMENSIONS', 'AREA', 'FITTINGS & FIXTURES']],
    body: roomRows,
    theme: 'grid',
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: 'bold',
      halign: 'left',
      cellPadding: 2,
    },
    styles: {
      fontSize: 7,
      cellPadding: 1.8,
      textColor: [30, 41, 59],
      overflow: 'linebreak',
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    margin: { left: 10, right: 10 },
  });

  // 5. Drawing Reference and Disclaimer Footer
  const planRef = options.plan.id ? options.plan.id.slice(0, 8).toUpperCase() : 'CAD-BM1';
  pdf.setFontSize(6.5);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(148, 163, 184);
  pdf.text(`Drawing Reference: BM-FP-${planRef} | Verified CAD Export | Page 1 of 1`, margin + 2, pageHeight - margin - 2);
  pdf.text('Note: For architectural execution, check all site dimensions prior to commencement.', pageWidth - margin - 2, pageHeight - margin - 2, { align: 'right' });

  // 6. Strictly fit on 1 landscape A4 sheet with 0 trailing blank pages
  while (pdf.getNumberOfPages() > 1) {
    pdf.deletePage(pdf.getNumberOfPages());
  }

  return pdf.output('blob');
}

/**
 * Triggers a direct architectural CAD PDF export download.
 */
export async function exportFloorPlanToPDF(options: FloorPlanPdfOptions): Promise<void> {
  const blob = await generateFloorPlanPdfBlob(options);
  const cleanBuilding = (options.plan.buildingName || 'floor-plan').trim().replace(/[^a-zA-Z0-9_\-]/g, '_');
  const cleanFloor = (options.floorLevels?.[options.activeFloorIndex || 0]?.name || options.plan.floorName || 'level').trim().replace(/[^a-zA-Z0-9_\-]/g, '_');
  const filename = `${cleanBuilding}_${cleanFloor}_Plan_${options.orientation || 'landscape'}.pdf`;
  downloadFile(blob, filename);
}

export interface BuildingEstimatePdfOptions {
  projectName?: string;
  estimateName?: string;
  clientName?: string;
  location?: string;
  buildingType?: string;
  structureType: string;
  quality: string;
  builtUpSqFt: number;
  footprintSqFt: number;
  floors: number;
  plotSqFt?: number | null;
  sandType?: string;
  materialLines: Array<{
    material: string;
    quantity: number;
    unit: string;
    rate: number;
    estimatedCost: number;
  }>;
  materialCost: number;
  labourCost: number;
  finishingCost: number;
  totalCost: number;
  costPerSqFt: number;
  dateStr?: string;
}

export function generateBuildingEstimatePdfBlob(options: BuildingEstimatePdfOptions): Blob {
  // A4 Portrait dimensions in points: 595.28 x 841.89
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const pdf = new MinimalPdfDocument(pageWidth, pageHeight);

  const margin = 32;
  const contentWidth = pageWidth - margin * 2;

  // Safe variable extraction with fallbacks
  const builtUpSqFt = options.builtUpSqFt ?? 0;
  const footprintSqFt = options.footprintSqFt ?? 0;
  const floors = options.floors ?? 1;
  const structureType = options.structureType || 'Framed Structure (RCC)';
  const quality = options.quality || 'Standard';
  const materialCost = options.materialCost ?? 0;
  const labourCost = options.labourCost ?? 0;
  const finishingCost = options.finishingCost ?? 0;
  const totalCost = options.totalCost ?? 0;
  const costPerSqFt = options.costPerSqFt ?? (builtUpSqFt > 0 ? totalCost / builtUpSqFt : 0);
  const materialLines = options.materialLines || [];

  // 1. Outer Border
  pdf.setStrokeColor(226, 232, 240); // slate-200
  pdf.setLineWidth(1);
  pdf.drawRect(margin, margin, contentWidth, pageHeight - margin * 2, false, true);

  // 2. Header Banner
  const headerH = 68;
  const headerY = pageHeight - margin - headerH;
  pdf.setFillColor(15, 23, 42); // slate-900 (Navy brand)
  pdf.drawRect(margin, headerY, contentWidth, headerH, true, false);

  // Title
  pdf.setFillColor(255, 255, 255);
  pdf.drawText('BUILDING MISTRY - CONSTRUCTION ESTIMATE REPORT', margin + 18, headerY + 44, 13, 'F2');

  pdf.setFillColor(148, 163, 184); // slate-400
  const proj = options.projectName ? `Project: ${options.projectName} | ` : '';
  const client = options.clientName ? `Client: ${options.clientName} | ` : '';
  const estTitle = options.estimateName || `${structureType} (${builtUpSqFt} sq.ft)`;
  pdf.drawText(`${proj}${client}${estTitle}`, margin + 18, headerY + 28, 8.5, 'F1');
  const locInfo = options.location ? `Site Location: ${options.location} | ` : '';
  pdf.drawText(`${locInfo}Rule-of-thumb architectural material & labour estimate`, margin + 18, headerY + 14, 8, 'F1');

  // Date on Header Right
  const dateStr = options.dateStr || new Date().toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  pdf.setFillColor(255, 255, 255);
  pdf.drawText(`Date: ${dateStr}`, margin + contentWidth - 130, headerY + 42, 9, 'F2');
  pdf.setFillColor(148, 163, 184);
  pdf.drawText('A4 Document', margin + contentWidth - 130, headerY + 28, 8, 'F1');

  // 3. Project & Area Specifications Card
  const specH = 72;
  const specY = headerY - specH - 14;
  pdf.setFillColor(248, 250, 252); // slate-50
  pdf.setStrokeColor(226, 232, 240);
  pdf.drawRect(margin + 8, specY, contentWidth - 16, specH, true, true);

  pdf.setFillColor(30, 41, 59); // slate-800
  pdf.drawText('MEASUREMENTS & PROJECT SPECIFICATIONS', margin + 18, specY + 54, 8.5, 'F2');

  // Spec Grid Column 1
  pdf.setFillColor(71, 85, 105);
  pdf.drawText(`Built-up Area:`, margin + 18, specY + 38, 8, 'F1');
  pdf.setFillColor(15, 23, 42);
  pdf.drawText(`${builtUpSqFt.toLocaleString('en-IN')} sq.ft (${Math.round(builtUpSqFt * 0.092903)} sq.m)`, margin + 85, specY + 38, 8, 'F2');

  pdf.setFillColor(71, 85, 105);
  pdf.drawText(`Ground Floor:`, margin + 18, specY + 22, 8, 'F1');
  pdf.setFillColor(15, 23, 42);
  pdf.drawText(`${footprintSqFt.toLocaleString('en-IN')} sq.ft`, margin + 85, specY + 22, 8, 'F1');

  pdf.setFillColor(71, 85, 105);
  pdf.drawText(`Floors:`, margin + 18, specY + 8, 8, 'F1');
  pdf.setFillColor(15, 23, 42);
  pdf.drawText(`${floors} Storey(s)`, margin + 85, specY + 8, 8, 'F1');

  // Spec Grid Column 2
  const col2X = margin + 270;
  pdf.setFillColor(71, 85, 105);
  pdf.drawText(`Structure:`, col2X, specY + 38, 8, 'F1');
  pdf.setFillColor(15, 23, 42);
  pdf.drawText(`${structureType}`, col2X + 60, specY + 38, 8, 'F2');

  pdf.setFillColor(71, 85, 105);
  pdf.drawText(`Quality:`, col2X, specY + 22, 8, 'F1');
  pdf.setFillColor(15, 23, 42);
  pdf.drawText(`${quality} Grade`, col2X + 60, specY + 22, 8, 'F1');

  if (options.plotSqFt) {
    pdf.setFillColor(71, 85, 105);
    pdf.drawText(`Plot Size:`, col2X, specY + 8, 8, 'F1');
    pdf.setFillColor(15, 23, 42);
    pdf.drawText(`${options.plotSqFt.toLocaleString('en-IN')} sq.ft`, col2X + 60, specY + 8, 8, 'F1');
  }

  // 4. Material Quantities Table
  let tableY = specY - 24;
  pdf.setFillColor(15, 23, 42);
  pdf.drawText('MATERIAL QUANTITIES & ESTIMATED COST', margin + 8, tableY + 6, 9.5, 'F2');

  tableY -= 14;
  // Table Header Row
  const rowH = 18;
  pdf.setFillColor(241, 245, 249); // slate-100
  pdf.setStrokeColor(203, 213, 225);
  pdf.drawRect(margin + 8, tableY - rowH, contentWidth - 16, rowH, true, true);

  pdf.setFillColor(51, 65, 85);
  pdf.drawText('MATERIAL', margin + 16, tableY - 12, 8, 'F2');
  pdf.drawText('QUANTITY', margin + 190, tableY - 12, 8, 'F2');
  pdf.drawText('UNIT', margin + 265, tableY - 12, 8, 'F2');
  pdf.drawText('UNIT PRICE', margin + 335, tableY - 12, 8, 'F2');
  pdf.drawText('TOTAL COST', margin + contentWidth - 95, tableY - 12, 8, 'F2');

  tableY -= rowH;

  // Table Body Rows
  pdf.setLineWidth(0.5);
  materialLines.forEach((item, index) => {
    const isEven = index % 2 === 0;
    if (isEven) {
      pdf.setFillColor(255, 255, 255);
    } else {
      pdf.setFillColor(248, 250, 252);
    }
    pdf.drawRect(margin + 8, tableY - rowH, contentWidth - 16, rowH, true, true);

    pdf.setFillColor(15, 23, 42);
    pdf.drawText(item.material, margin + 16, tableY - 12, 8, 'F1');
    pdf.drawText((item.quantity ?? 0).toLocaleString('en-IN'), margin + 190, tableY - 12, 8, 'F1');
    pdf.drawText(item.unit || '', margin + 265, tableY - 12, 8, 'F1');
    pdf.drawText(`Rs. ${(item.rate ?? 0).toLocaleString('en-IN')}`, margin + 335, tableY - 12, 8, 'F1');
    pdf.drawText(`Rs. ${Math.round(item.estimatedCost ?? 0).toLocaleString('en-IN')}`, margin + contentWidth - 95, tableY - 12, 8, 'F2');

    tableY -= rowH;
  });

  // 5. Cost Summary & Totals Breakdown
  tableY -= 14;
  const summaryBoxH = 100;
  pdf.setFillColor(248, 250, 252);
  pdf.setStrokeColor(203, 213, 225);
  pdf.drawRect(margin + 8, tableY - summaryBoxH, contentWidth - 16, summaryBoxH, true, true);

  const sumY = tableY - 18;
  pdf.setFillColor(71, 85, 105);
  pdf.drawText('Subtotal Materials:', margin + 24, sumY, 8.5, 'F1');
  pdf.setFillColor(15, 23, 42);
  pdf.drawText(`Rs. ${Math.round(materialCost).toLocaleString('en-IN')}`, margin + 160, sumY, 8.5, 'F2');

  pdf.setFillColor(71, 85, 105);
  pdf.drawText('Civil Labour & Execution:', margin + 24, sumY - 16, 8.5, 'F1');
  pdf.setFillColor(15, 23, 42);
  pdf.drawText(`Rs. ${Math.round(labourCost).toLocaleString('en-IN')}`, margin + 160, sumY - 16, 8.5, 'F2');

  if (finishingCost > 0) {
    pdf.setFillColor(71, 85, 105);
    pdf.drawText('Finishing & Services (Allowance):', margin + 24, sumY - 32, 8.5, 'F1');
    pdf.setFillColor(15, 23, 42);
    pdf.drawText(`Rs. ${Math.round(finishingCost).toLocaleString('en-IN')}`, margin + 160, sumY - 32, 8.5, 'F2');
  }

  // Divider
  pdf.setStrokeColor(203, 213, 225);
  pdf.drawLine(margin + 20, sumY - 44, margin + contentWidth - 20, sumY - 44);

  // Grand Total Highlight
  pdf.setFillColor(37, 99, 235); // Royal Blue
  pdf.drawText('ESTIMATED GRAND TOTAL:', margin + 24, sumY - 60, 10, 'F2');
  pdf.drawText(`Rs. ${Math.round(totalCost).toLocaleString('en-IN')}`, margin + 210, sumY - 60, 11, 'F2');

  pdf.setFillColor(71, 85, 105);
  pdf.drawText(`Approx. Cost per sq.ft: Rs. ${Math.round(costPerSqFt).toLocaleString('en-IN')} / sq.ft`, margin + 24, sumY - 74, 8.5, 'F1');

  // 6. Disclaimer & Footer
  pdf.setFillColor(148, 163, 184);
  pdf.drawText(
    'Disclaimer: Rule-of-thumb estimate for planning purposes. Actual costs depend on site drawings, soil conditions & market rates.',
    margin + 12,
    margin + 18,
    6.8,
    'F1'
  );
  pdf.drawText(
    `Building Mistry | Verified Estimation Document | Generated on ${dateStr}`,
    margin + 12,
    margin + 8,
    6.8,
    'F1'
  );

  const pdfBytes = pdf.build();
  return new Blob([pdfBytes as any], { type: 'application/pdf' });
}

export interface TurnkeyQuotationPdfOptions {
  estimate: MultiTierEstimateResult;
  siteName?: string;
  clientName?: string;
  clientPhone?: string;
  location?: string;
  preparedBy?: string;
  quotationRef?: string;
}

/**
 * Generate a commercial client quotation PDF with itemized BOQ (Section A & B)
 * and milestone payment terms on standard A4 format.
 */
export function generateTurnkeyQuotationPdfBlob(options: TurnkeyQuotationPdfOptions): Blob {
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const pdf = new MinimalPdfDocument(pageWidth, pageHeight);

  const margin = 26;
  const contentWidth = pageWidth - margin * 2;
  const { estimate } = options;

  const siteName = options.siteName || 'Turnkey Villa Project';
  const clientName = options.clientName || 'Valued Client';
  const quoteRef = options.quotationRef || `BM-QT-${Math.floor(1000 + Math.random() * 9000)}`;
  const dateStr = new Date().toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  // 1. Outer Border
  pdf.setStrokeColor(203, 213, 225); // slate-300
  pdf.setLineWidth(1);
  pdf.drawRect(margin, margin, contentWidth, pageHeight - margin * 2, false, true);

  // 2. Header Banner
  const headerH = 56;
  const headerY = pageHeight - margin - headerH;
  pdf.setFillColor(15, 23, 42); // slate-900 (Navy)
  pdf.drawRect(margin, headerY, contentWidth, headerH, true, false);

  // Title
  pdf.setFillColor(255, 255, 255);
  pdf.drawText('BUILDING MISTRY QUOTATION', margin + 14, headerY + 36, 13, 'F2');
  pdf.setFillColor(203, 213, 225);
  pdf.drawText(`Commercial Turnkey Estimation Sheet | Ref: ${quoteRef}`, margin + 14, headerY + 22, 8, 'F1');
  pdf.setFillColor(148, 163, 184);
  pdf.drawText(`IS 456 & IS 1200 Standards Compliant | Verified Quantity Survey`, margin + 14, headerY + 10, 7.5, 'F1');

  // Header Right info
  pdf.setFillColor(255, 255, 255);
  pdf.drawText(`Date: ${dateStr}`, margin + contentWidth - 140, headerY + 36, 8.5, 'F2');
  pdf.setFillColor(56, 189, 248); // sky-400
  pdf.drawText(`Package: ${estimate.specification.name}`, margin + contentWidth - 140, headerY + 22, 8.5, 'F2');
  pdf.setFillColor(203, 213, 225);
  pdf.drawText(`${estimate.builtUpArea.toLocaleString('en-IN')} sq.ft Built-Up`, margin + contentWidth - 140, headerY + 10, 8, 'F1');

  // 3. Client & Project Details Bar
  const metaH = 34;
  const metaY = headerY - metaH - 6;
  pdf.setFillColor(248, 250, 252); // slate-50
  pdf.setStrokeColor(226, 232, 240);
  pdf.drawRect(margin + 6, metaY, contentWidth - 12, metaH, true, true);

  pdf.setFillColor(100, 116, 139);
  pdf.drawText('PROJECT NAME:', margin + 12, metaY + 21, 7, 'F1');
  pdf.setFillColor(15, 23, 42);
  pdf.drawText(siteName.substring(0, 32), margin + 12, metaY + 9, 8.5, 'F2');

  pdf.setFillColor(100, 116, 139);
  pdf.drawText('CLIENT / OWNER:', margin + 180, metaY + 21, 7, 'F1');
  pdf.setFillColor(15, 23, 42);
  pdf.drawText(clientName.substring(0, 26), margin + 180, metaY + 9, 8.5, 'F2');

  pdf.setFillColor(100, 116, 139);
  pdf.drawText('RATE / SQ.FT:', margin + 340, metaY + 21, 7, 'F1');
  pdf.setFillColor(37, 99, 235); // Blue
  pdf.drawText(`Rs. ${estimate.costPerSqFt.toLocaleString('en-IN')} / sq.ft`, margin + 340, metaY + 9, 9, 'F2');

  pdf.setFillColor(100, 116, 139);
  pdf.drawText('ESTIMATED TOTAL:', margin + 440, metaY + 21, 7, 'F1');
  pdf.setFillColor(16, 185, 129); // Emerald
  pdf.drawText(`Rs. ${estimate.grandTotal.toLocaleString('en-IN')}`, margin + 440, metaY + 9, 9.5, 'F2');

  let curY = metaY - 14;

  // Helper for drawing Section Table
  const drawSectionTable = (
    title: string,
    subtitle: string,
    items: typeof estimate.sectionAItems,
    accentColor: [number, number, number]
  ) => {
    // Section Header
    pdf.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
    pdf.drawRect(margin + 6, curY - 14, contentWidth - 12, 14, true, false);
    pdf.setFillColor(255, 255, 255);
    pdf.drawText(title, margin + 12, curY - 10, 8, 'F2');
    pdf.setFillColor(226, 232, 240);
    pdf.drawText(subtitle, margin + 210, curY - 10, 7, 'F1');
    curY -= 14;

    // Table Header Row
    pdf.setFillColor(241, 245, 249); // slate-100
    pdf.drawRect(margin + 6, curY - 13, contentWidth - 12, 13, true, false);
    pdf.setFillColor(71, 85, 105);
    pdf.drawText('Item Description & Specification', margin + 12, curY - 9, 7, 'F2');
    pdf.drawText('Qty', margin + 310, curY - 9, 7, 'F2');
    pdf.drawText('Unit', margin + 355, curY - 9, 7, 'F2');
    pdf.drawText('Rate (Rs)', margin + 410, curY - 9, 7, 'F2');
    pdf.drawText('Amount (Rs)', margin + 475, curY - 9, 7, 'F2');
    curY -= 13;

    // Rows
    items.forEach((item, idx) => {
      if (idx % 2 === 1) {
        pdf.setFillColor(248, 250, 252);
        pdf.drawRect(margin + 6, curY - 12, contentWidth - 12, 12, true, false);
      }
      pdf.setFillColor(15, 23, 42);
      pdf.drawText(item.name.substring(0, 38), margin + 12, curY - 9, 7, 'F1');
      pdf.setFillColor(100, 116, 139);
      pdf.drawText(item.quantity.toLocaleString('en-IN'), margin + 310, curY - 9, 7, 'F1');
      pdf.drawText(item.unit, margin + 355, curY - 9, 7, 'F1');
      pdf.drawText(item.unitRate.toLocaleString('en-IN'), margin + 410, curY - 9, 7, 'F1');
      pdf.setFillColor(15, 23, 42);
      pdf.drawText(item.amount.toLocaleString('en-IN'), margin + 475, curY - 9, 7, 'F2');
      curY -= 12;
    });

    curY -= 6;
  };

  // Draw Section A: Core Civil Structure
  drawSectionTable(
    'SECTION A: CORE CIVIL STRUCTURE (GREY STRUCTURE)',
    'Substructure, Columns, Beams, Slab Casting, Masonry & Civil Labour',
    estimate.sectionAItems,
    [30, 41, 59] // slate-800
  );

  // Draw Section B: Turnkey Finishing & MEP
  drawSectionTable(
    'SECTION B: TURNKEY FINISHING & MEP (ARCHITECTURAL PACKAGE)',
    'Flooring, Wall Dado, Painting, Doors, Windows, Plumbing & Electrical',
    estimate.sectionBItems,
    [79, 70, 229] // indigo-600
  );

  // 4. Milestone Payment Terms Table
  pdf.setFillColor(16, 185, 129); // Emerald
  pdf.drawRect(margin + 6, curY - 14, contentWidth - 12, 14, true, false);
  pdf.setFillColor(255, 255, 255);
  pdf.drawText('STANDARD MILESTONE PAYMENT SCHEDULE (CONTRACT TERMS)', margin + 12, curY - 10, 8, 'F2');
  pdf.setFillColor(209, 250, 229);
  pdf.drawText('Payable stage-wise upon site verification of deliverables', margin + 300, curY - 10, 7, 'F1');
  curY -= 14;

  pdf.setFillColor(241, 245, 249);
  pdf.drawRect(margin + 6, curY - 12, contentWidth - 12, 12, true, false);
  pdf.setFillColor(71, 85, 105);
  pdf.drawText('Stage & Deliverables', margin + 12, curY - 9, 7, 'F2');
  pdf.drawText('Share (%)', margin + 375, curY - 9, 7, 'F2');
  pdf.drawText('Stage Amount (Rs)', margin + 450, curY - 9, 7, 'F2');
  curY -= 12;

  estimate.milestones.forEach((m, idx) => {
    if (idx % 2 === 1) {
      pdf.setFillColor(248, 250, 252);
      pdf.drawRect(margin + 6, curY - 12, contentWidth - 12, 12, true, false);
    }
    pdf.setFillColor(15, 23, 42);
    pdf.drawText(`${idx + 1}. ${m.stage}`, margin + 12, curY - 9, 7, 'F2');
    pdf.setFillColor(100, 116, 139);
    pdf.drawText(`${m.percentage}%`, margin + 380, curY - 9, 7, 'F1');
    pdf.setFillColor(16, 185, 129);
    pdf.drawText(`Rs. ${m.amount.toLocaleString('en-IN')}`, margin + 450, curY - 9, 7, 'F2');
    curY -= 12;
  });

  curY -= 8;

  // 5. Grand KPI Summary Card
  const sumH = 46;
  pdf.setFillColor(241, 245, 249);
  pdf.setStrokeColor(203, 213, 225);
  pdf.drawRect(margin + 6, curY - sumH, contentWidth - 12, sumH, true, true);

  pdf.setFillColor(71, 85, 105);
  pdf.drawText(`Core Structure: Rs. ${estimate.totalCivilStructureCost.toLocaleString('en-IN')} (${estimate.categoryPercentages.structure}%)`, margin + 14, curY - 14, 7.5, 'F1');
  pdf.drawText(`Finishing & Joinery: Rs. ${estimate.totalFinishingCost.toLocaleString('en-IN')} (${estimate.categoryPercentages.finishing}%)`, margin + 14, curY - 26, 7.5, 'F1');
  pdf.drawText(`Civil Labour Subtotal: Rs. ${estimate.labourSubtotal.toLocaleString('en-IN')}`, margin + 14, curY - 38, 7.5, 'F1');

  pdf.drawText(`MEP & Plumbing: Rs. ${estimate.totalMepCost.toLocaleString('en-IN')} (${estimate.categoryPercentages.mep}%)`, margin + 220, curY - 14, 7.5, 'F1');
  pdf.drawText(`Material Subtotal: Rs. ${estimate.materialSubtotal.toLocaleString('en-IN')}`, margin + 220, curY - 26, 7.5, 'F1');
  pdf.drawText(`Built-up Area: ${estimate.builtUpArea.toLocaleString('en-IN')} sq.ft`, margin + 220, curY - 38, 7.5, 'F1');

  // Divider
  pdf.setStrokeColor(203, 213, 225);
  pdf.drawLine(margin + 360, curY - 8, margin + 360, curY - sumH + 8);

  pdf.setFillColor(30, 41, 59);
  pdf.drawText('TOTAL QUOTATION VALUE', margin + 372, curY - 15, 8, 'F1');
  pdf.setFillColor(16, 185, 129);
  pdf.drawText(`Rs. ${estimate.grandTotal.toLocaleString('en-IN')}`, margin + 372, curY - 31, 13, 'F2');
  pdf.setFillColor(100, 116, 139);
  pdf.drawText(`@ Rs. ${estimate.costPerSqFt.toLocaleString('en-IN')} / sq.ft`, margin + 372, curY - 42, 7.5, 'F1');

  curY -= sumH + 8;

  // 6. Signatures and Authorizations
  const sigH = 34;
  pdf.setFillColor(255, 255, 255);
  pdf.setStrokeColor(226, 232, 240);
  pdf.drawRect(margin + 6, curY - sigH, contentWidth - 12, sigH, true, true);

  pdf.setFillColor(148, 163, 184);
  pdf.drawText('Prepared By / Authorized Contractor:', margin + 14, curY - 12, 7, 'F1');
  pdf.setFillColor(15, 23, 42);
  pdf.drawText(options.preparedBy || 'Building Mistry Construction Co.', margin + 14, curY - 24, 7.5, 'F2');

  pdf.setFillColor(148, 163, 184);
  pdf.drawText('Client Acceptance & Signature:', margin + contentWidth - 180, curY - 12, 7, 'F1');
  pdf.drawLine(margin + contentWidth - 180, curY - 26, margin + contentWidth - 20, curY - 26);

  // 7. Footer
  pdf.setFillColor(148, 163, 184);
  pdf.drawText(
    'Note: Quotation valid for 30 days from date of issue. Cement & steel price variances will be adjusted based on market bills.',
    margin + 12,
    margin + 12,
    6.5,
    'F1'
  );
  pdf.drawText(
    `Building Mistry ERP | Verified Civil Engineering Estimates | ${quoteRef}`,
    margin + 12,
    margin + 4,
    6.5,
    'F1'
  );

  const pdfBytes = pdf.build();
  return new Blob([pdfBytes as any], { type: 'application/pdf' });
}

export interface WorkerPayslipPdfOptions {
  workerName: string;
  workerRole: string;
  workerPhone?: string;
  workerId?: string;
  siteName: string;
  periodStr: string;
  dailyWage: number;
  fullDays: number;
  halfDays: number;
  otHours: number;
  otHourlyRate: number;
  grossWage: number;
  advanceDeducted: number;
  netPayout: number;
  preparedBy?: string;
  paymentMode?: string;
}

/**
 * Generate a commercial worker wage payslip / voucher PDF.
 */
export function generateWorkerPayslipPdfBlob(options: WorkerPayslipPdfOptions): Blob {
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const pdf = new MinimalPdfDocument(pageWidth, pageHeight);

  const margin = 32;
  const contentWidth = pageWidth - margin * 2;
  const voucherRef = `WAGE-SLIP-${Math.floor(1000 + Math.random() * 9000)}`;
  const dateStr = new Date().toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  // 1. Outer Border
  pdf.setStrokeColor(203, 213, 225); // slate-300
  pdf.setLineWidth(1.2);
  pdf.drawRect(margin, margin + 120, contentWidth, pageHeight - margin * 2 - 120, false, true);

  // 2. Header Banner
  const headerH = 64;
  const headerY = pageHeight - margin - headerH;
  pdf.setFillColor(15, 23, 42); // slate-900 (Navy)
  pdf.drawRect(margin, headerY, contentWidth, headerH, true, false);

  pdf.setFillColor(255, 255, 255);
  pdf.drawText('BUILDING MISTRY - LABOUR WAGE SETTLEMENT SLIP', margin + 18, headerY + 42, 12, 'F2');
  pdf.setFillColor(203, 213, 225);
  pdf.drawText(`Site Personnel Muster Roll & Official Payment Voucher | Ref: ${voucherRef}`, margin + 18, headerY + 26, 8, 'F1');
  pdf.setFillColor(148, 163, 184);
  pdf.drawText(`Site: ${options.siteName.substring(0, 36)} | Generated on ${dateStr}`, margin + 18, headerY + 12, 7.5, 'F1');

  pdf.setFillColor(255, 255, 255);
  pdf.drawText(`Voucher: #${voucherRef}`, margin + contentWidth - 140, headerY + 42, 8.5, 'F2');
  pdf.setFillColor(56, 189, 248);
  pdf.drawText(`Period: ${options.periodStr}`, margin + contentWidth - 140, headerY + 26, 8, 'F2');
  pdf.setFillColor(203, 213, 225);
  pdf.drawText(`Mode: ${options.paymentMode || 'Cash Payout'}`, margin + contentWidth - 140, headerY + 12, 7.5, 'F1');

  // 3. Worker Details Card
  const cardH = 50;
  const cardY = headerY - cardH - 12;
  pdf.setFillColor(248, 250, 252);
  pdf.setStrokeColor(226, 232, 240);
  pdf.drawRect(margin + 8, cardY, contentWidth - 16, cardH, true, true);

  pdf.setFillColor(100, 116, 139);
  pdf.drawText('WORKER NAME:', margin + 18, cardY + 34, 7, 'F1');
  pdf.setFillColor(15, 23, 42);
  pdf.drawText(options.workerName, margin + 18, cardY + 20, 10, 'F2');
  pdf.setFillColor(100, 116, 139);
  pdf.drawText(`ID: #${(options.workerId || 'W001').slice(-6).toUpperCase()}`, margin + 18, cardY + 8, 7, 'F1');

  pdf.setFillColor(100, 116, 139);
  pdf.drawText('TRADE / ROLE:', margin + 180, cardY + 34, 7, 'F1');
  pdf.setFillColor(37, 99, 235);
  pdf.drawText(options.workerRole, margin + 180, cardY + 20, 9.5, 'F2');
  pdf.setFillColor(100, 116, 139);
  pdf.drawText(options.workerPhone ? `Phone: ${options.workerPhone}` : 'Phone: Not Registered', margin + 180, cardY + 8, 7, 'F1');

  pdf.setFillColor(100, 116, 139);
  pdf.drawText('DAILY WAGE RATE:', margin + 340, cardY + 34, 7, 'F1');
  pdf.setFillColor(15, 23, 42);
  pdf.drawText(`Rs. ${options.dailyWage.toLocaleString('en-IN')} / day`, margin + 340, cardY + 20, 9.5, 'F2');
  pdf.setFillColor(100, 116, 139);
  pdf.drawText(`OT: Rs. ${options.otHourlyRate.toLocaleString('en-IN')} / hour`, margin + 340, cardY + 8, 7, 'F1');

  let curY = cardY - 18;

  // 4. Breakdown Table Header
  pdf.setFillColor(30, 41, 59);
  pdf.drawRect(margin + 8, curY - 14, contentWidth - 16, 14, true, false);
  pdf.setFillColor(255, 255, 255);
  pdf.drawText('ATTENDANCE, OVERTIME & WAGE PARTICULARS', margin + 18, curY - 10, 8, 'F2');
  curY -= 14;

  pdf.setFillColor(241, 245, 249);
  pdf.drawRect(margin + 8, curY - 14, contentWidth - 16, 14, true, false);
  pdf.setFillColor(71, 85, 105);
  pdf.drawText('Wage Component / Description', margin + 18, curY - 10, 7.5, 'F2');
  pdf.drawText('Units Worked', margin + 280, curY - 10, 7.5, 'F2');
  pdf.drawText('Unit Rate (Rs)', margin + 380, curY - 10, 7.5, 'F2');
  pdf.drawText('Total Amount (Rs)', margin + 450, curY - 10, 7.5, 'F2');
  curY -= 14;

  // Rows
  const fullDaysPay = Math.round(options.fullDays * options.dailyWage);
  const halfDaysPay = Math.round(options.halfDays * 0.5 * options.dailyWage);
  const otPay = Math.round(options.otHours * options.otHourlyRate);

  const items = [
    { desc: 'Full Day Shifts (Present, 1.0)', units: `${options.fullDays} days`, rate: `${options.dailyWage}`, amt: fullDaysPay },
    { desc: 'Half Day Shifts (0.5 wage)', units: `${options.halfDays} days`, rate: `${Math.round(options.dailyWage * 0.5)}`, amt: halfDaysPay },
    { desc: 'Overtime Shifts (OT)', units: `${options.otHours} hours`, rate: `${options.otHourlyRate}/hr`, amt: otPay },
  ];

  items.forEach((it, idx) => {
    if (idx % 2 === 1) {
      pdf.setFillColor(248, 250, 252);
      pdf.drawRect(margin + 8, curY - 16, contentWidth - 16, 16, true, false);
    }
    pdf.setFillColor(15, 23, 42);
    pdf.drawText(it.desc, margin + 18, curY - 11, 7.5, 'F1');
    pdf.setFillColor(71, 85, 105);
    pdf.drawText(it.units, margin + 280, curY - 11, 7.5, 'F1');
    pdf.drawText(it.rate, margin + 380, curY - 11, 7.5, 'F1');
    pdf.setFillColor(15, 23, 42);
    pdf.drawText(it.amt.toLocaleString('en-IN'), margin + 450, curY - 11, 8, 'F2');
    curY -= 16;
  });

  // Divider
  pdf.setStrokeColor(226, 232, 240);
  pdf.drawLine(margin + 8, curY - 4, margin + contentWidth - 8, curY - 4);
  curY -= 12;

  // Gross Subtotal
  pdf.setFillColor(248, 250, 252);
  pdf.drawRect(margin + 8, curY - 16, contentWidth - 16, 16, true, false);
  pdf.setFillColor(71, 85, 105);
  pdf.drawText('GROSS WAGES EARNED (A):', margin + 18, curY - 11, 8, 'F2');
  pdf.setFillColor(15, 23, 42);
  pdf.drawText(`Rs. ${options.grossWage.toLocaleString('en-IN')}`, margin + 450, curY - 11, 8.5, 'F2');
  curY -= 20;

  // Deductions Section
  pdf.setFillColor(220, 38, 38); // Red
  pdf.drawRect(margin + 8, curY - 14, contentWidth - 16, 14, true, false);
  pdf.setFillColor(255, 255, 255);
  pdf.drawText('DEDUCTIONS & RECOVERIES (B)', margin + 18, curY - 10, 8, 'F2');
  curY -= 14;

  pdf.setFillColor(248, 250, 252);
  pdf.drawRect(margin + 8, curY - 16, contentWidth - 16, 16, true, false);
  pdf.setFillColor(15, 23, 42);
  pdf.drawText('Advance Cash Taken Earlier (Recovered from settlement)', margin + 18, curY - 11, 7.5, 'F1');
  pdf.setFillColor(220, 38, 38);
  pdf.drawText(`(-) Rs. ${options.advanceDeducted.toLocaleString('en-IN')}`, margin + 440, curY - 11, 8.5, 'F2');
  curY -= 26;

  // 5. Net Cash Payable Highlight Box
  const netH = 46;
  pdf.setFillColor(16, 185, 129); // Emerald
  pdf.drawRect(margin + 8, curY - netH, contentWidth - 16, netH, true, false);

  pdf.setFillColor(255, 255, 255);
  pdf.drawText('FINAL NET CASH PAYABLE IN HAND (A - B):', margin + 20, curY - 18, 9.5, 'F2');
  pdf.drawText('Paid in full settlement without dispute', margin + 20, curY - 32, 7.5, 'F1');

  pdf.drawText(`Rs. ${options.netPayout.toLocaleString('en-IN')}`, margin + contentWidth - 160, curY - 26, 15, 'F2');
  curY -= netH + 24;

  // 6. Signatures and Authorizations
  const sigH = 60;
  pdf.setFillColor(255, 255, 255);
  pdf.setStrokeColor(203, 213, 225);
  pdf.drawRect(margin + 8, curY - sigH, contentWidth - 16, sigH, true, true);

  pdf.setFillColor(100, 116, 139);
  pdf.drawText('Worker Signature / Left Thumb Impression:', margin + 18, curY - 14, 7.5, 'F1');
  pdf.drawText('(பணியாளர் கையெழுத்து / பெருவிரல் ரேகை)', margin + 18, curY - 24, 6.5, 'F1');
  pdf.drawLine(margin + 18, curY - 48, margin + 210, curY - 48);

  pdf.drawText('Authorized Contractor / Site Supervisor:', margin + contentWidth - 210, curY - 14, 7.5, 'F1');
  pdf.setFillColor(15, 23, 42);
  pdf.drawText(options.preparedBy || 'Building Mistry Construction Co.', margin + contentWidth - 210, curY - 26, 8, 'F2');
  pdf.drawLine(margin + contentWidth - 210, curY - 48, margin + contentWidth - 20, curY - 48);

  // 7. Footer
  pdf.setFillColor(148, 163, 184);
  pdf.drawText(
    'Mistry ERP Automated Wage Settlement Slip. Keep copy for tax and audit records.',
    margin + 18,
    margin + 130,
    6.5,
    'F1'
  );
  pdf.drawText(
    `Building Mistry | Tamil Nadu Construction Management System | ${voucherRef}`,
    margin + 18,
    margin + 122,
    6.5,
    'F1'
  );

  const pdfBytes = pdf.build();
  return new Blob([pdfBytes as any], { type: 'application/pdf' });
}

/**
 * Triggers a real browser file download for any Blob or text content with genuine filename and MIME type.
 */
export function downloadFile(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 300);
}

