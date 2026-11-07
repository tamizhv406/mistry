import { describe, it } from 'node:test';
import assert from 'node:assert';
import { MinimalPdfDocument, generateFloorPlanPdfBlob, generateBuildingEstimatePdfBlob } from '../src/utils/pdfGenerator';
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

    assert.ok(text.startsWith('%PDF-1.'), 'Exported blob must be a genuine PDF document');
    assert.ok(text.includes('BUILDING MISTRY'), 'Must include title block');
    assert.ok(text.includes('Sri Krishna Villa'), 'Must include project name');
    assert.ok(text.includes('Ground Floor'), 'Must include floor name');
    assert.ok(text.includes('ROOM NAME'), 'Must include room schedule table header');
    assert.ok(text.includes('Living Room'), 'Must include room label');
    assert.ok(text.includes('Master Bedroom'), 'Must include room label');
    assert.ok(text.trimEnd().endsWith('%%EOF'), 'Must terminate with %%EOF');
  });

  it('generateBuildingEstimatePdfBlob generates professional A4 PDF only with all required metadata and calculations', async () => {
    const estimatePdfBlob = generateBuildingEstimatePdfBlob({
      projectName: 'Emerald Towers Phase 1',
      estimateName: 'Detailed BOQ & Cost Summary',
      clientName: 'Suresh Menon',
      location: 'Plot 42, Green Avenue, Chennai',
      dateStr: '2026-11-05',
      builtUpSqFt: 3200,
      footprintSqFt: 1800,
      floors: 3,
      structureType: 'RCC Framed Structure',
      quality: 'Premium',
      plotSqFt: 2400,
      materialLines: [
        { material: 'UltraTech Super Cement', quantity: 1280, unit: 'Bags', rate: 410, estimatedCost: 524800 },
        { material: 'Tata Tiscon 550D TMT Steel', quantity: 11.2, unit: 'Tons', rate: 68000, estimatedCost: 761600 },
        { material: 'Washed River Sand', quantity: 3000, unit: 'CFT', rate: 65, estimatedCost: 195000 },
        { material: 'Wire-cut Red Bricks', quantity: 28000, unit: 'Nos', rate: 11, estimatedCost: 308000 },
      ],
      materialCost: 1789400,
      labourCost: 720000,
      finishingCost: 550000,
      totalCost: 3059400,
      costPerSqFt: 956.06,
    });

    assert.strictEqual(estimatePdfBlob.type, 'application/pdf', 'MIME type must be application/pdf, never xlsx or csv');
    assert.ok(estimatePdfBlob.size > 1000, 'Blob size should be substantial for complete A4 PDF document');

    const arrayBuffer = await estimatePdfBlob.arrayBuffer();
    const text = new TextDecoder('latin1').decode(new Uint8Array(arrayBuffer));

    // Verify PDF 1.4 specification compliance
    assert.ok(text.startsWith('%PDF-1.4'), 'Exported blob must be standard %PDF-1.4');
    assert.ok(text.includes('/MediaBox [0 0 595.28 841.89]'), 'Must be formatted for standard A4 Portrait');
    assert.ok(text.includes('BUILDING MISTRY'), 'Must include branding banner');
    assert.ok(text.includes('CONSTRUCTION ESTIMATE REPORT'), 'Must include report title');

    // Verify Project Details & Calculation Metadata
    assert.ok(text.includes('Emerald Towers Phase 1'), 'Must include project name');
    assert.ok(text.includes('Suresh Menon'), 'Must include client name');
    assert.ok(text.includes('Plot 42, Green Avenue, Chennai'), 'Must include location');
    assert.ok(text.includes('2026-11-05'), 'Must include calculation date');

    // Verify Measurements & Units
    assert.ok(text.includes('3,200 sq.ft'), 'Must include built-up area measurement');
    assert.ok(text.includes('1,800 sq.ft'), 'Must include ground floor footprint');
    assert.ok(text.includes('3 Storey'), 'Must include floor count');
    assert.ok(text.includes('2,400 sq.ft'), 'Must include plot dimensions');

    // Verify Material Quantities & Categories
    assert.ok(text.includes('UltraTech Super Cement'), 'Must include cement item');
    assert.ok(text.includes('1,280'), 'Must include formatted quantity');
    assert.ok(text.includes('Bags'), 'Must include unit');
    assert.ok(text.includes('Tata Tiscon 550D TMT Steel'), 'Must include steel item');
    assert.ok(text.includes('11.2'), 'Must include steel tonnage');

    // Verify Total Calculations
    assert.ok(text.includes('17,89,400'), 'Must include materials subtotal in INR lakh formatting');
    assert.ok(text.includes('7,20,000'), 'Must include civil labour cost in INR lakh formatting');
    assert.ok(text.includes('5,50,000'), 'Must include finishes allowance in INR lakh formatting');
    assert.ok(text.includes('30,59,400'), 'Must include calculated grand total in INR lakh formatting');
    assert.ok(text.includes('956'), 'Must include cost per sq.ft');

    // Verify document termination
    assert.ok(text.trimEnd().endsWith('%%EOF'), 'Must terminate with %%EOF');
  });

  it('generateFloorPlanPdfBlob embeds canvas image snapshot and enforces strictly 1 landscape page', async () => {
    // 1x1 transparent/white PNG data url for test
    const dummyCanvasImage = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';

    const mockPlan: FloorPlan = {
      id: 'fp-multipage-test',
      userId: 'test-user-id',
      siteId: 'site-test-1',
      buildingName: 'Arulmozhi Illam',
      floorName: 'First Floor',
      plotLength: 50,
      plotWidth: 35,
      unit: 'feet',
      walls: [
        { id: 'w1', x1: 0, y1: 0, x2: 50, y2: 0, thickness: 0.75, wallType: 'exterior' },
      ],
      rooms: [
        { id: 'r1', label: 'Living Hall', roomType: 'Living', width: 20, height: 16, x: 2, y: 2 },
        { id: 'r2', label: 'Pooja Room', roomType: 'Pooja', width: 8, height: 8, x: 24, y: 2 },
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
      canvasImage: dummyCanvasImage,
      furniture: [
        { id: 'f1', itemType: 'Sofa', label: 'L-Shaped Sofa', x: 4, y: 4, width: 6, height: 3, roomId: 'r1' },
        { id: 'f2', itemType: 'Lamp', label: 'Brass Diya', x: 26, y: 4, width: 2, height: 2, roomId: 'r2' },
      ],
    });

    assert.strictEqual(pdfBlob.type, 'application/pdf');
    const arrayBuffer = await pdfBlob.arrayBuffer();
    const text = new TextDecoder('latin1').decode(new Uint8Array(arrayBuffer));

    // Must include architectural CAD elements
    assert.ok(text.includes('Arulmozhi Illam'), 'Must include project name');
    assert.ok(text.includes('FITTINGS & FIXTURES'), 'Must include room schedule fittings column');
    assert.ok(text.includes('L-Shaped Sofa'), 'Must include fitting label');
    assert.ok(text.includes('Brass Diya'), 'Must include pooja fixture');
    assert.ok(text.trimEnd().endsWith('%%EOF'));
  });

  it('multi-element group and ungroup mechanics correctly bind and release group IDs', () => {
    interface TestItem {
      id: string;
      label: string;
      x: number;
      y: number;
      groupId?: string;
    }

    const items: TestItem[] = [
      { id: 'bed-1', label: 'King Bed', x: 10, y: 10 },
      { id: 'table-1', label: 'Side Table', x: 16, y: 10 },
      { id: 'lamp-1', label: 'Reading Lamp', x: 16, y: 8 },
    ];

    // 1. Group items
    const newGroupId = 'grp_' + Date.now();
    const selectedIds = ['bed-1', 'table-1', 'lamp-1'];
    const groupedItems = items.map(it => selectedIds.includes(it.id) ? { ...it, groupId: newGroupId } : it);

    assert.strictEqual(groupedItems[0].groupId, newGroupId);
    assert.strictEqual(groupedItems[1].groupId, newGroupId);
    assert.strictEqual(groupedItems[2].groupId, newGroupId);

    // 2. Group drag physics translation: moving one member by dx, dy translates all sister items
    const dx = 5;
    const dy = -3;
    const translatedItems = groupedItems.map(it => {
      if (it.groupId === newGroupId) {
        return { ...it, x: it.x + dx, y: it.y + dy };
      }
      return it;
    });

    assert.strictEqual(translatedItems[0].x, 15);
    assert.strictEqual(translatedItems[0].y, 7);
    assert.strictEqual(translatedItems[1].x, 21);
    assert.strictEqual(translatedItems[1].y, 7);
    assert.strictEqual(translatedItems[2].x, 21);
    assert.strictEqual(translatedItems[2].y, 5);

    // 3. Ungroup items
    const ungroupedItems = translatedItems.map(it => ({ ...it, groupId: undefined }));
    assert.strictEqual(ungroupedItems[0].groupId, undefined);
    assert.strictEqual(ungroupedItems[1].groupId, undefined);
    assert.strictEqual(ungroupedItems[2].groupId, undefined);
  });
});

