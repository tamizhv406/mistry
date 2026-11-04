import { describe, it } from 'node:test';
import assert from 'node:assert';
import { MinimalPdfDocument, generateFloorPlanPdfBlob } from '../src/utils/pdfGenerator';
import type { FloorPlan, FloorPlanWall, FloorPlanRoom } from '../src/db/types';

describe('[PDF Export Engine] Genuine PDF File & MIME Type Verification', () => {
  it('generates standard PDF 1.4 binary structure with valid xref table', () => {
    // 841.89 x 595.28 pt (A4 Landscape)
    const doc = new MinimalPdfDocument(841.89, 595.28);
    doc.setStrokeColor(15, 23, 42);
    doc.setLineWidth(1.5);
    doc.drawRect(20, 20, 800, 550, false, true);
    doc.drawText('BUILDING MISTRY CAD EXPORT', 30, 540, 14, 'F2');
    doc.drawText('Scale: 1:50 | Units: Feet & Inches', 30, 520, 10, 'F1');
    doc.drawLine(30, 510, 800, 510);

    const pdfBytes = doc.build();
    assert.ok(pdfBytes instanceof Uint8Array, 'Should return Uint8Array');
    assert.ok(pdfBytes.length > 500, 'PDF should have reasonable content length');

    const pdfText = new TextDecoder('latin1').decode(pdfBytes);

    // 1. Must start with standard PDF header
    assert.ok(pdfText.startsWith('%PDF-1.4'), 'Must start with %PDF-1.4 header');

    // 2. Must contain Catalog and Pages
    assert.ok(pdfText.includes('/Type /Catalog'), 'Must contain PDF Catalog');
    assert.ok(pdfText.includes('/Type /Pages'), 'Must contain PDF Pages');
    assert.ok(pdfText.includes('/Type /Page'), 'Must contain PDF Page');
    assert.ok(pdfText.includes('/MediaBox [0 0 841.89 595.28]'), 'Must have correct A4 Landscape dimensions');

    // 3. Must contain xref table and EOF
    assert.ok(pdfText.includes('xref'), 'Must contain valid xref cross-reference table');
    assert.ok(pdfText.includes('trailer'), 'Must contain PDF trailer');
    assert.ok(pdfText.includes('startxref'), 'Must contain startxref pointer');
    assert.ok(pdfText.trimEnd().endsWith('%%EOF'), 'Must end with %%EOF');
  });

  it('generates A4 Portrait PDF correctly', () => {
    // 595.28 x 841.89 pt (A4 Portrait)
    const doc = new MinimalPdfDocument(595.28, 841.89);
    doc.drawText('Portrait Architectural Sheet', 40, 800, 12, 'F1');
    const bytes = doc.build();
    const pdfText = new TextDecoder('latin1').decode(bytes);

    assert.ok(pdfText.includes('/MediaBox [0 0 595.28 841.89]'), 'Must have correct A4 Portrait dimensions');
    assert.ok(pdfText.includes('%%EOF'));
  });

  it('generateFloorPlanPdfBlob outputs genuine application/pdf Blob with metadata', async () => {
    const mockPlan: FloorPlan = {
      id: 'fp-test-12345678',
      userId: 'test-user-id',
      siteId: 'site-test-1',
      buildingName: 'Sri Krishna Villa',
      floorName: 'Ground Floor',
      plotLength: 40,
      plotWidth: 30,
      unit: 'feet',
      walls: [
        { id: 'w1', x1: 0, y1: 0, x2: 40, y2: 0, thickness: 0.75, wallType: 'exterior' },
        { id: 'w2', x1: 40, y1: 0, x2: 40, y2: 30, thickness: 0.75, wallType: 'exterior' },
      ],
      rooms: [
        { id: 'r1', label: 'Living Room', roomType: 'Living', width: 16, height: 14, x: 2, y: 2 },
        { id: 'r2', label: 'Master Bedroom', roomType: 'Master Bedroom', width: 14, height: 12, x: 18, y: 2 },
      ],
      doors: [],
      windows: [],
      floors: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const pdfBlob = await generateFloorPlanPdfBlob({
      plan: mockPlan,
      walls: mockPlan.walls,
      rooms: mockPlan.rooms,
      unit: 'feet',
      orientation: 'landscape',
      siteName: 'Site Alpha',
    });

    assert.strictEqual(pdfBlob.type, 'application/pdf', 'MIME type must be application/pdf');
    assert.ok(pdfBlob.size > 1000, 'Blob size should be substantial');

    const arrayBuffer = await pdfBlob.arrayBuffer();
    const text = new TextDecoder('latin1').decode(new Uint8Array(arrayBuffer));

    assert.ok(text.startsWith('%PDF-1.4'), 'Exported blob must be a genuine PDF document');
    assert.ok(text.includes('BUILDING MISTRY'), 'Must include title block');
    assert.ok(text.includes('Sri Krishna Villa'), 'Must include project name');
    assert.ok(text.includes('Ground Floor'), 'Must include floor name');
    assert.ok(text.includes('ROOM NAME'), 'Must include room schedule table header');
    assert.ok(text.includes('Living Room'), 'Must include room label');
    assert.ok(text.includes('Master Bedroom'), 'Must include room label');
    assert.ok(text.trimEnd().endsWith('%%EOF'), 'Must terminate with %%EOF');
  });
});

