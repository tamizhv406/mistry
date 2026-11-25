import type { MultiTierEstimateResult } from '../domain/buildingCalculator/multiTierEstimator';
import type { WorkerMonthlyStatement } from '../domain/salary';
import type { SiteStockPurchaseStatement } from '../domain/stock';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { APP_NAME } from '../config/brand';

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
  pdf.drawText(`${APP_NAME.toUpperCase()} - CONSTRUCTION ESTIMATE REPORT`, margin + 18, headerY + 44, 13, 'F2');

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
    `${APP_NAME} | Verified Estimation Document | Generated on ${dateStr}`,
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
  pdf.drawText(`${APP_NAME.toUpperCase()} QUOTATION`, margin + 14, headerY + 36, 13, 'F2');
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
  pdf.drawText(options.preparedBy || APP_NAME, margin + 14, curY - 24, 7.5, 'F2');

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
    `${APP_NAME} | Verified Civil Engineering Estimates | ${quoteRef}`,
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
  pdf.drawText(`${APP_NAME.toUpperCase()} - LABOUR WAGE SETTLEMENT SLIP`, margin + 18, headerY + 42, 12, 'F2');
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
  pdf.drawText(options.preparedBy || APP_NAME, margin + contentWidth - 210, curY - 26, 8, 'F2');
  pdf.drawLine(margin + contentWidth - 210, curY - 48, margin + contentWidth - 20, curY - 48);

  // 7. Footer
  pdf.setFillColor(148, 163, 184);
  pdf.drawText(
    `${APP_NAME} automated wage settlement slip. Keep a copy for tax and audit records.`,
    margin + 18,
    margin + 130,
    6.5,
    'F1'
  );
  pdf.drawText(
    `${APP_NAME} | Tamil Nadu Construction Management System | ${voucherRef}`,
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

function formatPdfMoney(amount: number): string {
  const rounded = Math.round((Number(amount) || 0) * 100) / 100;
  return `Rs. ${rounded.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

function formatDayShortForPdf(dayKey: string): string {
  const parts = dayKey.split('-');
  if (parts.length !== 3) return dayKey;
  return `${parts[2]}-${parts[1]}-${parts[0]}`;
}

function escapeHtml(text: string): string {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function workerMonthlyPdfFilename(statement: Pick<WorkerMonthlyStatement, 'workerName' | 'month'>): string {
  const safeWorker = (statement.workerName || 'worker')
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 32) || 'worker';
  const safeMonth = (statement.month || 'month').replace(/[^0-9-]/g, '');
  return `${APP_NAME}_Attendance_${safeWorker}_${safeMonth}.pdf`;
}

/**
 * Generates an A4 PDF report for a single worker's monthly day-by-day attendance and wage settlement.
 * Uses jsPDF + jspdf-autotable with the SiteMistry Orange (#F97316) & Charcoal (#1F2937) theme.
 */
export function generateWorkerMonthlyAttendancePdfBlob(statement: WorkerMonthlyStatement): Blob {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 32;
  const contentWidth = pageWidth - margin * 2;
  const generatedStr = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  // Top Header Banner (Charcoal #1F2937 + Orange #F97316 accent bar)
  doc.setFillColor(31, 41, 55);
  doc.rect(margin, margin, contentWidth, 56, 'F');
  doc.setFillColor(249, 115, 22);
  doc.rect(margin, margin, contentWidth, 4, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(`${APP_NAME.toUpperCase()} - WORKER ATTENDANCE & WAGE STATEMENT`, margin + 14, margin + 24);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(229, 231, 235);
  doc.text(`Project: ${statement.projectName}  |  Month: ${statement.monthLabel} (${statement.month})`, margin + 14, margin + 40);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(249, 115, 22);
  doc.text(`Generated: ${generatedStr}`, pageWidth - margin - 14, margin + 40, { align: 'right' });

  // Worker Details Card (#FAFAF9 fill, #E7E5E4 border)
  let y = margin + 66;
  doc.setFillColor(250, 250, 249);
  doc.setDrawColor(231, 229, 228);
  doc.roundedRect(margin, y, contentWidth, 48, 4, 4, 'FD');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(87, 83, 78);
  doc.text('WORKER NAME', margin + 12, y + 14);
  doc.text('TRADE / ROLE', margin + 190, y + 14);
  doc.text('DAILY WAGE RATE', margin + 330, y + 14);
  doc.text('LEAVE POLICY', margin + 445, y + 14);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(31, 41, 55);
  doc.text(statement.workerName, margin + 12, y + 30);
  doc.text(statement.workerRole, margin + 190, y + 30);
  doc.text(`${formatPdfMoney(statement.dailyWage)}/day`, margin + 330, y + 30);
  doc.text(statement.leavePaid ? 'Paid Leave' : 'Unpaid Leave', margin + 445, y + 30);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(87, 83, 78);
  doc.text(
    `Worker ID: #${statement.workerId.slice(-6).toUpperCase()}${statement.workerPhone ? `  |  Phone: ${statement.workerPhone}` : ''}`,
    margin + 12,
    y + 42,
  );

  // Summary Counts Bar
  y += 58;
  const kpis: Array<{ label: string; value: string; color: [number, number, number] }> = [
    { label: 'Present', value: String(statement.counts.present), color: [22, 163, 74] },
    { label: 'Half Day', value: String(statement.counts.half_day), color: [245, 158, 11] },
    { label: 'Overtime', value: String(statement.counts.overtime), color: [245, 158, 11] },
    { label: 'Leave', value: String(statement.counts.leave), color: [31, 41, 55] },
    { label: 'Absent', value: String(statement.counts.absent), color: [220, 38, 38] },
    { label: 'Payable Days', value: String(statement.workedDayEquivalents), color: [249, 115, 22] },
  ];
  const boxGap = 6;
  const boxW = (contentWidth - boxGap * (kpis.length - 1)) / kpis.length;
  kpis.forEach((kpi, idx) => {
    const bx = margin + idx * (boxW + boxGap);
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(231, 229, 228);
    doc.roundedRect(bx, y, boxW, 34, 3, 3, 'FD');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(87, 83, 78);
    doc.text(kpi.label, bx + boxW / 2, y + 12, { align: 'center' });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(kpi.color[0], kpi.color[1], kpi.color[2]);
    doc.text(kpi.value, bx + boxW / 2, y + 27, { align: 'center' });
  });

  // Day-by-day attendance log table (01 through 28/29/30/31)
  y += 44;
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin, top: margin, bottom: 44 },
    head: [['Date', 'Day', 'Status', 'Factor', 'Wage Earned', 'Notes / Remarks']],
    body: statement.days.map(row => {
      const noteParts: string[] = [];
      if (row.notes) noteParts.push(row.notes);
      if (row.correctionCount > 0) {
        noteParts.push(`${row.correctionCount} edit${row.correctionCount === 1 ? '' : 's'}`);
      }
      return [
        formatDayShortForPdf(row.date),
        row.weekdayShort,
        row.statusLabel,
        row.status === 'unmarked' ? '-' : row.dayValue.toFixed(1),
        row.status === 'unmarked' ? '-' : formatPdfMoney(row.earnedAmount),
        noteParts.join(' · ') || '-',
      ];
    }),
    styles: {
      font: 'helvetica',
      fontSize: 7.6,
      cellPadding: { top: 2.8, right: 5, bottom: 2.8, left: 5 },
      textColor: [31, 41, 55],
      lineColor: [231, 229, 228],
      lineWidth: 0.4,
    },
    headStyles: {
      fillColor: [31, 41, 55],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
    },
    alternateRowStyles: {
      fillColor: [250, 250, 249],
    },
    columnStyles: {
      0: { cellWidth: 66 },
      1: { cellWidth: 38 },
      2: { cellWidth: 88, fontStyle: 'bold' },
      3: { cellWidth: 44, halign: 'right' },
      4: { cellWidth: 78, halign: 'right' },
      5: { cellWidth: 'auto' },
    },
    didParseCell: hookData => {
      if (hookData.section !== 'body' || hookData.column.index !== 2) return;
      const dayRow = statement.days[hookData.row.index];
      if (!dayRow) return;
      if (dayRow.status === 'present') {
        hookData.cell.styles.textColor = [22, 163, 74];
      } else if (dayRow.status === 'half_day' || dayRow.status === 'overtime') {
        hookData.cell.styles.textColor = [245, 158, 11];
      } else if (dayRow.status === 'absent') {
        hookData.cell.styles.textColor = [220, 38, 38];
      } else if (dayRow.status === 'leave') {
        hookData.cell.styles.textColor = dayRow.dayValue > 0 ? [22, 163, 74] : [31, 41, 55];
      } else {
        hookData.cell.styles.textColor = [120, 113, 108];
        hookData.cell.styles.fontStyle = 'normal';
      }
    },
  });

  const tableEndY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 360;
  let finY = tableEndY + 14;
  const neededBlockHeight =
    158 +
    (statement.advancesTaken.length > 0 ? Math.min(statement.advancesTaken.length, 4) * 11 + 14 : 0) +
    (statement.salaryPayments.length > 0 ? Math.min(statement.salaryPayments.length, 4) * 11 + 14 : 0);

  if (finY + neededBlockHeight > pageHeight - 36) {
    doc.addPage();
    finY = margin;
  }

  // Financial Breakdown Card
  doc.setFillColor(31, 41, 55);
  doc.rect(margin, finY, contentWidth, 20, 'F');
  doc.setFillColor(249, 115, 22);
  doc.rect(margin, finY, 4, 20, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text('FINANCIAL SETTLEMENT SUMMARY', margin + 12, finY + 13);
  finY += 20;

  const summaryRows: Array<[string, string]> = [
    ['Daily Wage Rate', `${formatPdfMoney(statement.dailyWage)} / day`],
    [`Gross Earned Wages (${statement.workedDayEquivalents} payable days)`, formatPdfMoney(statement.grossEarned)],
    [
      `Recoverable Advances Taken (${statement.monthLabel})`,
      `(-) ${formatPdfMoney(statement.totalAdvancesDeducted)}`,
    ],
    [
      `Salary Already Paid (${statement.monthLabel})`,
      `(-) ${formatPdfMoney(statement.totalSalaryPaid)}`,
    ],
  ];

  if (statement.priorNetBalance !== 0) {
    summaryRows.push([
      statement.priorNetBalance > 0
        ? 'Prior Unpaid Balance Carried In'
        : 'Prior Excess Payment / Advance Carried In',
      statement.priorNetBalance > 0
        ? formatPdfMoney(statement.priorNetBalance)
        : `(-) ${formatPdfMoney(Math.abs(statement.priorNetBalance))}`,
    ]);
  }

  if (statement.totalNonRecoverableAdvances > 0) {
    summaryRows.push([
      'Non-Recoverable Grant / Gift (Not deducted)',
      formatPdfMoney(statement.totalNonRecoverableAdvances),
    ]);
  }

  summaryRows.push([
    statement.monthOverpaid > 0
      ? `Month Net Balance (Paid Ahead in ${statement.monthLabel})`
      : `Month Net Pay Due (${statement.monthLabel})`,
    statement.monthOverpaid > 0
      ? `${formatPdfMoney(statement.monthOverpaid)} ahead`
      : formatPdfMoney(statement.monthNetPay),
  ]);

  if (statement.overallPending !== statement.monthNetPay || statement.overallOverpaid !== statement.monthOverpaid) {
    summaryRows.push([
      statement.overallOverpaid > 0 ? 'Overall Account Position (Paid Ahead)' : 'Overall Net Balance Payable',
      statement.overallOverpaid > 0
        ? `${formatPdfMoney(statement.overallOverpaid)} ahead`
        : formatPdfMoney(statement.overallPending),
    ]);
  }

  autoTable(doc, {
    startY: finY,
    margin: { left: margin, right: margin, top: margin, bottom: 44 },
    body: summaryRows,
    styles: {
      font: 'helvetica',
      fontSize: 8.5,
      cellPadding: { top: 4, right: 8, bottom: 4, left: 8 },
      lineColor: [231, 229, 228],
      lineWidth: 0.4,
      textColor: [31, 41, 55],
    },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 140, halign: 'right', fontStyle: 'bold' },
    },
    didParseCell: hookData => {
      if (hookData.row.index === summaryRows.length - 1 || (statement.overallPending !== statement.monthNetPay && hookData.row.index === summaryRows.length - 2)) {
        hookData.cell.styles.fillColor = [255, 247, 237];
        hookData.cell.styles.fontStyle = 'bold';
        hookData.cell.styles.textColor = [154, 52, 18];
      }
    },
  });

  let afterFinY = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? finY + 90) + 10;

  if (statement.advancesTaken.length > 0 || statement.salaryPayments.length > 0) {
    const entryLines: string[] = [];
    for (const adv of statement.advancesTaken) {
      entryLines.push(`Advance on ${formatDayShortForPdf(adv.date)}: ${formatPdfMoney(adv.amount)}${adv.reason ? ` (${adv.reason})` : ''}`);
    }
    for (const pay of statement.salaryPayments) {
      entryLines.push(`Salary Paid on ${formatDayShortForPdf(pay.date)}: ${formatPdfMoney(pay.paidAmount)} (${pay.paymentMode || 'Cash'})`);
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(87, 83, 78);
    entryLines.slice(0, 6).forEach(line => {
      if (afterFinY < pageHeight - 78) {
        doc.text(`• ${line}`, margin + 4, afterFinY);
        afterFinY += 10;
      }
    });
  }

  // Signature Block
  const sigY = Math.max(afterFinY + 18, pageHeight - 78);
  if (sigY + 42 > pageHeight - 28) {
    doc.addPage();
    finY = margin + 20;
  }
  const drawSigY = sigY + 42 > pageHeight - 28 ? margin + 20 : sigY;
  doc.setDrawColor(156, 163, 175);
  doc.line(margin + 12, drawSigY + 24, margin + 195, drawSigY + 24);
  doc.line(pageWidth - margin - 195, drawSigY + 24, pageWidth - margin - 12, drawSigY + 24);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(31, 41, 55);
  doc.text('Worker Signature / Thumb', margin + 103, drawSigY + 35, { align: 'center' });
  doc.text('Site Manager Signature', pageWidth - margin - 103, drawSigY + 35, { align: 'center' });

  // Page footer on all pages
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(120, 113, 108);
    doc.text(`${APP_NAME} · Generated ${generatedStr}`, margin, pageHeight - 16);
    doc.text(`Page ${p} of ${totalPages}`, pageWidth - margin, pageHeight - 16, { align: 'right' });
  }

  return doc.output('blob');
}

/**
 * Builds standalone printable A4 HTML matching `generateWorkerMonthlyAttendancePdfBlob` 100%.
 */
export function buildWorkerMonthlyPrintHtml(statement: WorkerMonthlyStatement): string {
  const generatedStr = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const inr = (n: number) => `₹${(Math.round((Number(n) || 0) * 100) / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
  const statusColor = (status: string, value: number) => {
    if (status === 'present') return '#16A34A';
    if (status === 'half_day' || status === 'overtime') return '#F59E0B';
    if (status === 'absent') return '#DC2626';
    if (status === 'leave') return value > 0 ? '#16A34A' : '#1F2937';
    return '#78716C';
  };

  const rowsHtml = statement.days
    .map(
      d => `
      <tr>
        <td>${escapeHtml(formatDayShortForPdf(d.date))}</td>
        <td>${escapeHtml(d.weekdayShort)}</td>
        <td style="font-weight:700;color:${statusColor(d.status, d.dayValue)}">${escapeHtml(d.statusLabel)}</td>
        <td style="text-align:right">${d.status === 'unmarked' ? '—' : d.dayValue.toFixed(1)}</td>
        <td style="text-align:right">${d.status === 'unmarked' ? '—' : escapeHtml(inr(d.earnedAmount))}</td>
        <td>${escapeHtml(d.notes || (d.correctionCount > 0 ? `${d.correctionCount} edit(s)` : '—'))}</td>
      </tr>`,
    )
    .join('');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(workerMonthlyPdfFilename(statement))}</title>
<style>
  @page { size: A4 portrait; margin: 12mm; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #1F2937; margin: 0; background: #fff; font-size: 12px; }
  .banner { background: #1F2937; color: #fff; padding: 14px 16px; border-top: 4px solid #F97316; border-radius: 6px 6px 0 0; }
  .banner h1 { margin: 0; font-size: 15px; letter-spacing: 0.4px; }
  .banner p { margin: 4px 0 0; font-size: 11px; color: #E5E7EB; }
  .card { background: #FAFAF9; border: 1px solid #E7E5E4; padding: 10px 14px; margin: 10px 0; border-radius: 6px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
  .card small { display: block; font-size: 10px; color: #57534E; text-transform: uppercase; }
  .kpis { display: grid; grid-template-columns: repeat(6, 1fr); gap: 6px; margin-bottom: 10px; }
  .kpi { border: 1px solid #E7E5E4; border-radius: 6px; padding: 6px; text-align: center; }
  .kpi small { display: block; font-size: 10px; color: #57534E; }
  .kpi strong { font-size: 14px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
  th, td { border: 1px solid #E7E5E4; padding: 4px 6px; font-size: 11px; text-align: left; }
  th { background: #1F2937; color: #fff; }
  tbody tr:nth-child(even) { background: #FAFAF9; }
  .fin { border: 1px solid #E7E5E4; border-radius: 6px; overflow: hidden; page-break-inside: avoid; }
  .fin-head { background: #1F2937; color: #fff; padding: 7px 12px; font-weight: 700; border-left: 4px solid #F97316; }
  .fin-row { display: flex; justify-content: space-between; padding: 6px 12px; border-top: 1px solid #E7E5E4; }
  .fin-row.total { background: #FFF7ED; color: #9A3412; font-weight: 800; }
  .sigs { display: flex; justify-content: space-between; margin-top: 34px; page-break-inside: avoid; }
  .sig { width: 200px; text-align: center; border-top: 1px solid #9CA3AF; padding-top: 6px; font-weight: 700; font-size: 11px; }
</style>
</head>
<body>
  <div class="banner">
    <h1>${escapeHtml(APP_NAME.toUpperCase())} — WORKER ATTENDANCE &amp; WAGE STATEMENT</h1>
    <p>Project: ${escapeHtml(statement.projectName)} · Period: ${escapeHtml(statement.monthLabel)} (${escapeHtml(statement.month)}) · Generated: ${escapeHtml(generatedStr)}</p>
  </div>
  <div class="card">
    <div><small>Worker</small><strong>${escapeHtml(statement.workerName)}</strong></div>
    <div><small>Trade / Role</small><strong>${escapeHtml(statement.workerRole)}</strong></div>
    <div><small>Daily Wage</small><strong>${escapeHtml(inr(statement.dailyWage))}/day</strong></div>
    <div><small>Leave Policy</small><strong>${statement.leavePaid ? 'Paid Leave' : 'Unpaid Leave'}</strong></div>
  </div>
  <div class="kpis">
    <div class="kpi"><small>Present</small><strong style="color:#16A34A">${statement.counts.present}</strong></div>
    <div class="kpi"><small>Half Day</small><strong style="color:#F59E0B">${statement.counts.half_day}</strong></div>
    <div class="kpi"><small>Overtime</small><strong style="color:#F59E0B">${statement.counts.overtime}</strong></div>
    <div class="kpi"><small>Leave</small><strong>${statement.counts.leave}</strong></div>
    <div class="kpi"><small>Absent</small><strong style="color:#DC2626">${statement.counts.absent}</strong></div>
    <div class="kpi"><small>Payable Days</small><strong style="color:#F97316">${statement.workedDayEquivalents}</strong></div>
  </div>
  <table>
    <thead><tr><th>Date</th><th>Day</th><th>Status</th><th style="text-align:right">Factor</th><th style="text-align:right">Earned</th><th>Notes</th></tr></thead>
    <tbody>${rowsHtml}</tbody>
  </table>
  <div class="fin">
    <div class="fin-head">FINANCIAL SETTLEMENT SUMMARY</div>
    <div class="fin-row"><span>Gross Earned Wages (${statement.workedDayEquivalents} days)</span><strong>${escapeHtml(inr(statement.grossEarned))}</strong></div>
    <div class="fin-row"><span>Advances Deducted (${escapeHtml(statement.monthLabel)})</span><strong>− ${escapeHtml(inr(statement.totalAdvancesDeducted))}</strong></div>
    <div class="fin-row"><span>Salary Already Paid (${escapeHtml(statement.monthLabel)})</span><strong>− ${escapeHtml(inr(statement.totalSalaryPaid))}</strong></div>
    ${statement.priorNetBalance !== 0 ? `<div class="fin-row"><span>Prior Balance Carried In</span><strong>${escapeHtml(statement.priorNetBalance > 0 ? inr(statement.priorNetBalance) : `− ${inr(Math.abs(statement.priorNetBalance))}`)}</strong></div>` : ''}
    <div class="fin-row total"><span>${statement.monthOverpaid > 0 ? 'Paid Ahead (Month)' : 'Net Pay Due (Month)'}</span><strong>${escapeHtml(statement.monthOverpaid > 0 ? `${inr(statement.monthOverpaid)} ahead` : inr(statement.monthNetPay))}</strong></div>
    <div class="fin-row total"><span>${statement.overallOverpaid > 0 ? 'Overall Paid Ahead' : 'Overall Balance Due'}</span><strong>${escapeHtml(statement.overallOverpaid > 0 ? `${inr(statement.overallOverpaid)} ahead` : inr(statement.overallPending))}</strong></div>
  </div>
  <div class="sigs">
    <div class="sig">Worker Signature / Thumb</div>
    <div class="sig">Site Manager Signature</div>
  </div>
</body>
</html>`;
}

/**
 * Prints the monthly worker statement cleanly via a dedicated hidden iframe (bypassing
 * modal-hide print CSS rules), falling back to opening/downloading the PDF Blob if unavailable.
 */
export function printWorkerMonthlyStatement(statement: WorkerMonthlyStatement): boolean {
  if (typeof document === 'undefined') return false;
  const html = buildWorkerMonthlyPrintHtml(statement);
  try {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.setAttribute('aria-hidden', 'true');
    iframe.srcdoc = html;
    iframe.onload = () => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch {
        const blob = generateWorkerMonthlyAttendancePdfBlob(statement);
        downloadFile(blob, workerMonthlyPdfFilename(statement));
      } finally {
        setTimeout(() => iframe.remove(), 60_000);
      }
    };
    document.body.appendChild(iframe);
    return true;
  } catch {
    const blob = generateWorkerMonthlyAttendancePdfBlob(statement);
    const url = URL.createObjectURL(blob);
    const popup = typeof window !== 'undefined' ? window.open(url, '_blank', 'noopener,noreferrer') : null;
    if (!popup) downloadFile(blob, workerMonthlyPdfFilename(statement));
    return true;
  }
}

export function siteStockPurchasePdfFilename(
  statement: Pick<SiteStockPurchaseStatement, 'projectName' | 'startDate' | 'endDate'>,
): string {
  const safeSite = (statement.projectName || 'site')
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 32) || 'site';
  const from = (statement.startDate || '').replace(/[^0-9-]/g, '') || 'start';
  const to = (statement.endDate || '').replace(/[^0-9-]/g, '') || 'all';
  return `${APP_NAME}_Stock_Purchases_${safeSite}_${from}_${to}.pdf`;
}

/**
 * Generates an A4 PDF report of site-wise stock purchases for a selected date range,
 * including Date, Item, Quantity, Rate, Supplier, Invoice #, Bill Photo Reference, and Total Cost.
 */
export function generateSiteStockPurchasePdfBlob(statement: SiteStockPurchaseStatement): Blob {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 28;
  const contentWidth = pageWidth - margin * 2;
  const generatedStr = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  // Top Header Banner (Charcoal #1F2937 + Orange #F97316 accent bar)
  doc.setFillColor(31, 41, 55);
  doc.rect(margin, margin, contentWidth, 56, 'F');
  doc.setFillColor(249, 115, 22);
  doc.rect(margin, margin, contentWidth, 4, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(`${APP_NAME.toUpperCase()} - SITE STOCK PURCHASE REPORT`, margin + 14, margin + 24);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(229, 231, 235);
  doc.text(`Project: ${statement.projectName}  |  Period: ${statement.dateRangeLabel}`, margin + 14, margin + 40);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(249, 115, 22);
  doc.text(`Generated: ${generatedStr}`, pageWidth - margin - 14, margin + 40, { align: 'right' });

  // KPI Summary Strip
  let y = margin + 68;
  const kpis: Array<{ label: string; value: string; color: [number, number, number] }> = [
    { label: 'Purchase Entries', value: String(statement.totalPurchases), color: [31, 41, 55] },
    { label: 'With Bill Photo', value: String(statement.purchasesWithBillPhoto), color: [22, 163, 74] },
    { label: 'Total Cost', value: formatPdfMoney(statement.totalCost), color: [249, 115, 22] },
    {
      label: 'Balance Due',
      value: formatPdfMoney(statement.totalBalanceDue),
      color: statement.totalBalanceDue > 0 ? [220, 38, 38] : [22, 163, 74],
    },
  ];
  const gap = 8;
  const boxW = (contentWidth - gap * (kpis.length - 1)) / kpis.length;
  kpis.forEach((kpi, idx) => {
    const bx = margin + idx * (boxW + gap);
    doc.setFillColor(250, 250, 249);
    doc.setDrawColor(231, 229, 228);
    doc.roundedRect(bx, y, boxW, 38, 4, 4, 'FD');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(87, 83, 78);
    doc.text(kpi.label, bx + boxW / 2, y + 13, { align: 'center' });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(kpi.color[0], kpi.color[1], kpi.color[2]);
    doc.text(kpi.value, bx + boxW / 2, y + 29, { align: 'center' });
  });

  // Itemized Purchase Table
  y += 48;
  const bodyRows: string[][] =
    statement.rows.length > 0
      ? statement.rows.map(r => [
          formatDayShortForPdf(r.date),
          r.itemName,
          r.quantityDisplay,
          formatPdfMoney(r.rate),
          r.supplier,
          r.invoiceNumber,
          r.billPhotoReference,
          formatPdfMoney(r.totalCost),
        ])
      : [['-', 'No stock purchases recorded in this date range.', '-', '-', '-', '-', '-', '-']];

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin, top: margin, bottom: 48 },
    head: [['Date', 'Item', 'Qty', 'Rate', 'Supplier', 'Invoice #', 'Bill Photo Ref', 'Total']],
    body: bodyRows,
    foot: statement.rows.length > 0
      ? [[
          'TOTAL',
          `${statement.totalPurchases} entries`,
          '',
          '',
          `Paid: ${formatPdfMoney(statement.totalPaid)}`,
          `Due: ${formatPdfMoney(statement.totalBalanceDue)}`,
          `${statement.purchasesWithBillPhoto} bill(s)`,
          formatPdfMoney(statement.totalCost),
        ]]
      : undefined,
    styles: {
      font: 'helvetica',
      fontSize: 7.4,
      cellPadding: { top: 3.5, right: 4, bottom: 3.5, left: 4 },
      textColor: [31, 41, 55],
      lineColor: [231, 229, 228],
      lineWidth: 0.4,
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: [31, 41, 55],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.8,
    },
    footStyles: {
      fillColor: [255, 247, 237],
      textColor: [154, 52, 18],
      fontStyle: 'bold',
      fontSize: 8,
    },
    alternateRowStyles: {
      fillColor: [250, 250, 249],
    },
    columnStyles: {
      0: { cellWidth: 54 },
      1: { cellWidth: 92 },
      2: { cellWidth: 52, halign: 'right' },
      3: { cellWidth: 52, halign: 'right' },
      4: { cellWidth: 74 },
      5: { cellWidth: 54 },
      6: { cellWidth: 92 },
      7: { cellWidth: 69, halign: 'right', fontStyle: 'bold' },
    },
    didParseCell: hookData => {
      if (hookData.section !== 'body' || statement.rows.length === 0) return;
      if (hookData.column.index === 6) {
        const row = statement.rows[hookData.row.index];
        if (!row) return;
        if (!row.hasBillPhoto) {
          hookData.cell.styles.textColor = [120, 113, 108];
        } else if (row.billPhotoSyncStatus === 'pending' || row.billPhotoSyncStatus === 'failed') {
          hookData.cell.styles.textColor = [180, 83, 9];
          hookData.cell.styles.fontStyle = 'bold';
        } else {
          hookData.cell.styles.textColor = [22, 163, 74];
          hookData.cell.styles.fontStyle = 'bold';
        }
      }
    },
  });

  const endY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 120;
  let sigY = Math.max(endY + 28, pageHeight - 78);
  if (sigY + 42 > pageHeight - 28) {
    doc.addPage();
    sigY = margin + 32;
  }

  doc.setDrawColor(156, 163, 175);
  doc.line(margin + 12, sigY + 22, margin + 195, sigY + 22);
  doc.line(pageWidth - margin - 195, sigY + 22, pageWidth - margin - 12, sigY + 22);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(31, 41, 55);
  doc.text('Site Storekeeper / Manager', margin + 103, sigY + 34, { align: 'center' });
  doc.text('Accounts / Authorized Signatory', pageWidth - margin - 103, sigY + 34, { align: 'center' });

  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(120, 113, 108);
    doc.text(
      `${APP_NAME} · ${statement.projectName} · Generated ${generatedStr}`,
      margin,
      pageHeight - 16,
    );
    doc.text(`Page ${p} of ${totalPages}`, pageWidth - margin, pageHeight - 16, { align: 'right' });
  }

  return doc.output('blob');
}

/**
 * Builds standalone printable A4 HTML matching `generateSiteStockPurchasePdfBlob`.
 */
export function buildSiteStockPurchasePrintHtml(statement: SiteStockPurchaseStatement): string {
  const generatedStr = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const inr = (n: number) => `₹${(Math.round((Number(n) || 0) * 100) / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

  const rowsHtml =
    statement.rows.length > 0
      ? statement.rows
          .map(
            r => `
        <tr>
          <td>${escapeHtml(formatDayShortForPdf(r.date))}</td>
          <td>${escapeHtml(r.itemName)}</td>
          <td style="text-align:right">${escapeHtml(r.quantityDisplay)}</td>
          <td style="text-align:right">${escapeHtml(inr(r.rate))}</td>
          <td>${escapeHtml(r.supplier)}</td>
          <td>${escapeHtml(r.invoiceNumber)}</td>
          <td style="font-weight:${r.hasBillPhoto ? '700' : '400'};color:${!r.hasBillPhoto ? '#78716C' : r.billPhotoSyncStatus === 'pending' || r.billPhotoSyncStatus === 'failed' ? '#B45309' : '#16A34A'}">${escapeHtml(r.billPhotoReference)}</td>
          <td style="text-align:right;font-weight:700">${escapeHtml(inr(r.totalCost))}</td>
        </tr>`,
          )
          .join('')
      : `<tr><td colspan="8" style="text-align:center;color:#57534E;padding:18px">No stock purchases recorded in this date range.</td></tr>`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(siteStockPurchasePdfFilename(statement))}</title>
<style>
  @page { size: A4 portrait; margin: 12mm; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #1F2937; margin: 0; background: #fff; font-size: 11px; }
  .banner { background: #1F2937; color: #fff; padding: 14px 16px; border-top: 4px solid #F97316; border-radius: 6px 6px 0 0; }
  .banner h1 { margin: 0; font-size: 15px; letter-spacing: 0.4px; }
  .banner p { margin: 4px 0 0; font-size: 11px; color: #E5E7EB; }
  .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin: 10px 0 12px; }
  .kpi { border: 1px solid #E7E5E4; background: #FAFAF9; border-radius: 6px; padding: 8px; text-align: center; }
  .kpi small { display: block; font-size: 10px; color: #57534E; }
  .kpi strong { font-size: 14px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
  th, td { border: 1px solid #E7E5E4; padding: 5px 6px; font-size: 10.5px; text-align: left; }
  th { background: #1F2937; color: #fff; }
  tbody tr:nth-child(even) { background: #FAFAF9; }
  tfoot td { background: #FFF7ED; color: #9A3412; font-weight: 800; }
  .sigs { display: flex; justify-content: space-between; margin-top: 34px; page-break-inside: avoid; }
  .sig { width: 200px; text-align: center; border-top: 1px solid #9CA3AF; padding-top: 6px; font-weight: 700; font-size: 11px; }
</style>
</head>
<body>
  <div class="banner">
    <h1>${escapeHtml(APP_NAME.toUpperCase())} — SITE STOCK PURCHASE REPORT</h1>
    <p>Project: ${escapeHtml(statement.projectName)} · Period: ${escapeHtml(statement.dateRangeLabel)} · Generated: ${escapeHtml(generatedStr)}</p>
  </div>
  <div class="kpis">
    <div class="kpi"><small>Purchase Entries</small><strong>${statement.totalPurchases}</strong></div>
    <div class="kpi"><small>With Bill Photo</small><strong style="color:#16A34A">${statement.purchasesWithBillPhoto}</strong></div>
    <div class="kpi"><small>Total Cost</small><strong style="color:#F97316">${escapeHtml(inr(statement.totalCost))}</strong></div>
    <div class="kpi"><small>Balance Due</small><strong style="color:${statement.totalBalanceDue > 0 ? '#DC2626' : '#16A34A'}">${escapeHtml(inr(statement.totalBalanceDue))}</strong></div>
  </div>
  <table>
    <thead>
      <tr>
        <th>Date</th><th>Item</th><th style="text-align:right">Qty</th><th style="text-align:right">Rate</th><th>Supplier</th><th>Invoice #</th><th>Bill Photo Ref</th><th style="text-align:right">Total</th>
      </tr>
    </thead>
    <tbody>${rowsHtml}</tbody>
    ${statement.rows.length > 0 ? `<tfoot><tr><td colspan="4">TOTAL (${statement.totalPurchases} entries)</td><td>Paid: ${escapeHtml(inr(statement.totalPaid))}</td><td>Due: ${escapeHtml(inr(statement.totalBalanceDue))}</td><td>${statement.purchasesWithBillPhoto} bill(s)</td><td style="text-align:right">${escapeHtml(inr(statement.totalCost))}</td></tr></tfoot>` : ''}
  </table>
  <div class="sigs">
    <div class="sig">Site Storekeeper / Manager</div>
    <div class="sig">Accounts / Authorized Signatory</div>
  </div>
</body>
</html>`;
}

/**
 * Prints the site stock purchase report cleanly via hidden iframe with PDF download/open fallback.
 */
export function printSiteStockPurchaseStatement(statement: SiteStockPurchaseStatement): boolean {
  if (typeof document === 'undefined') return false;
  const html = buildSiteStockPurchasePrintHtml(statement);
  try {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.setAttribute('aria-hidden', 'true');
    iframe.srcdoc = html;
    iframe.onload = () => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch {
        const blob = generateSiteStockPurchasePdfBlob(statement);
        downloadFile(blob, siteStockPurchasePdfFilename(statement));
      } finally {
        setTimeout(() => iframe.remove(), 60_000);
      }
    };
    document.body.appendChild(iframe);
    return true;
  } catch {
    const blob = generateSiteStockPurchasePdfBlob(statement);
    const url = URL.createObjectURL(blob);
    const popup = typeof window !== 'undefined' ? window.open(url, '_blank', 'noopener,noreferrer') : null;
    if (!popup) downloadFile(blob, siteStockPurchasePdfFilename(statement));
    return true;
  }
}

