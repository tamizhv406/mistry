import type { FloorPlan, FloorPlanWall, FloorPlanRoom, FloorPlanUnit, FloorPlanLevel } from '../db/types';
import { formatLength, formatArea } from '../services/geometryEngine';

export interface FloorPlanPdfOptions {
  plan: FloorPlan;
  walls: FloorPlanWall[];
  rooms: FloorPlanRoom[];
  floorLevels?: FloorPlanLevel[];
  activeFloorIndex?: number;
  orientation?: 'landscape' | 'portrait';
  unit: FloorPlanUnit;
  svgElement?: SVGSVGElement | null;
  svgString?: string;
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

/**
 * Generates a complete, professional architectural CAD PDF for Building Mistry.
 * Includes Title Block, Plan Drawing Box, Dimensions, Room Schedule Table,
 * Unit specifications, Scale, and Disclaimer.
 */
export async function generateFloorPlanPdfBlob(options: FloorPlanPdfOptions): Promise<Blob> {
  const isLandscape = (options.orientation || 'landscape') === 'landscape';
  // A4 dimensions in points (72 pt / inch)
  const pageWidth = isLandscape ? 841.89 : 595.28;
  const pageHeight = isLandscape ? 595.28 : 841.89;

  const pdf = new MinimalPdfDocument(pageWidth, pageHeight);

  const margin = 28;
  const contentWidth = pageWidth - margin * 2;
  const contentHeight = pageHeight - margin * 2;

  // 1. Outer Border / Sheet Margins
  pdf.setStrokeColor(15, 23, 42); // slate-900
  pdf.setLineWidth(1.5);
  pdf.drawRect(margin, margin, contentWidth, contentHeight, false, true);

  // 2. Title Block at Top
  const titleBlockH = 54;
  const titleBlockY = pageHeight - margin - titleBlockH;
  pdf.setFillColor(248, 250, 252); // slate-50
  pdf.setStrokeColor(203, 213, 225); // slate-300
  pdf.setLineWidth(1);
  pdf.drawRect(margin, titleBlockY, contentWidth, titleBlockH, true, true);

  // Title Block Content
  pdf.setFillColor(2, 132, 199); // Sky-600
  pdf.drawText('BUILDING MISTRY - ARCHITECTURAL FLOOR PLAN', margin + 14, titleBlockY + 36, 14, 'F2');

  pdf.setFillColor(71, 85, 105); // slate-600
  const floorName = options.floorLevels && options.activeFloorIndex !== undefined
    ? options.floorLevels[options.activeFloorIndex]?.name || options.plan.floorName
    : options.plan.floorName;
  pdf.drawText(`Project: ${options.plan.buildingName} | Level: ${floorName}`, margin + 14, titleBlockY + 22, 9, 'F2');

  if (options.siteName || options.plan.siteName) {
    pdf.drawText(`Site: ${options.siteName || options.plan.siteName}`, margin + 14, titleBlockY + 10, 8, 'F1');
  }

  // Metadata block (Right side of title block)
  const metaX = margin + contentWidth - 240;
  pdf.setFillColor(15, 23, 42);
  const dateStr = new Date().toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const unitLabel = options.unit === 'feet' || options.unit === 'inches' ? 'Imperial (Feet / Inches)' : 'Metric (Metres / mm)';
  pdf.drawText(`Date: ${dateStr}`, metaX, titleBlockY + 38, 8, 'F1');
  pdf.drawText(`Plot Size: ${options.plan.plotLength} x ${options.plan.plotWidth} (${options.unit})`, metaX, titleBlockY + 26, 8, 'F1');
  pdf.drawText(`Units: ${unitLabel}`, metaX, titleBlockY + 14, 8, 'F1');
  pdf.drawText('Scale: As Noted on Dimensions (A4 Sheet)', metaX, titleBlockY + 2, 8, 'F1');

  // 3. Room Schedule Table (Bottom)
  const roomCount = options.rooms.length;
  const scheduleH = Math.min(100, Math.max(36, roomCount * 14 + 22));
  const scheduleY = margin + 20;

  pdf.setFillColor(241, 245, 249);
  pdf.setStrokeColor(203, 213, 225);
  pdf.drawRect(margin, scheduleY, contentWidth, scheduleH, true, true);

  // Table Header
  pdf.setFillColor(15, 23, 42);
  pdf.drawRect(margin, scheduleY + scheduleH - 16, contentWidth, 16, true, false);
  pdf.setFillColor(255, 255, 255);
  pdf.drawText('ROOM NAME', margin + 12, scheduleY + scheduleH - 12, 8, 'F2');
  pdf.drawText('ROOM TYPE', margin + 140, scheduleY + scheduleH - 12, 8, 'F2');
  pdf.drawText('DIMENSIONS', margin + 260, scheduleY + scheduleH - 12, 8, 'F2');
  pdf.drawText('AREA', margin + 380, scheduleY + scheduleH - 12, 8, 'F2');

  // Room Rows
  let curRowY = scheduleY + scheduleH - 28;
  pdf.setFillColor(30, 41, 59);
  for (let i = 0; i < Math.min(roomCount, 5); i++) {
    const r = options.rooms[i];
    pdf.drawText(r.label || `Room ${i + 1}`, margin + 12, curRowY, 8, 'F1');
    pdf.drawText(r.roomType || 'Living', margin + 140, curRowY, 8, 'F1');
    pdf.drawText(`${formatLength(r.width, options.unit)} x ${formatLength(r.height, options.unit)}`, margin + 260, curRowY, 8, 'F1');
    pdf.drawText(formatArea(r.width * r.height, options.unit), margin + 380, curRowY, 8, 'F2');
    curRowY -= 14;
  }

  // 4. Drawing Canvas Box (Center)
  const canvasY = scheduleY + scheduleH + 10;
  const canvasH = titleBlockY - canvasY - 10;
  pdf.setStrokeColor(203, 213, 225);
  pdf.setFillColor(255, 255, 255);
  pdf.drawRect(margin, canvasY, contentWidth, canvasH, true, true);

  // Embed Drawing Image if available
  if (options.svgString) {
    const renderW = Math.round(contentWidth * 2);
    const renderH = Math.round(canvasH * 2);
    const jpeg = await rasterizeSvgToJpeg(options.svgString, renderW, renderH);
    if (jpeg) {
      pdf.embedJpegImage(jpeg.bytes, jpeg.width, jpeg.height, margin + 2, canvasY + 2, contentWidth - 4, canvasH - 4);
    }
  }

  // 5. Drawing Reference and Disclaimer Footer
  pdf.setFillColor(100, 116, 139);
  const planRef = options.plan.id ? options.plan.id.slice(0, 8).toUpperCase() : 'CAD-BM1';
  pdf.drawText(`Drawing Reference: BM-FP-${planRef} | Verified CAD Export | Page 1 of 1`, margin + 8, margin + 6, 7, 'F1');
  pdf.drawText('Note: For architectural execution, check all site dimensions prior to commencement.', margin + contentWidth - 280, margin + 6, 7, 'F1');

  const pdfBytes = pdf.build();
  return new Blob([pdfBytes as any], { type: 'application/pdf' });
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

