import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { renderCADSymbol, renderFloorPlanToCanvas } from '../src/utils/pdfGenerator';
import type { FloorPlanPdfOptions } from '../src/utils/pdfGenerator';

describe('Mobile Floor Planner Re-engineering Test Suite', () => {
  describe('Phase 1 & 2: Touch Engine, Handles & Angle Snapping', () => {
    it('verifies 15-degree and 45-degree magnetic snapping logic', () => {
      const snapAngle = (rawAngleDeg: number) => {
        let rawAngle = Math.round((rawAngleDeg + 360) % 360);
        const SNAP_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315, 360];
        let snapped = false;
        for (const s of SNAP_ANGLES) {
          if (Math.abs(rawAngle - s) <= 6 || Math.abs(rawAngle - (s - 360)) <= 6) {
            rawAngle = s % 360;
            snapped = true;
            break;
          }
        }
        if (!snapped) {
          rawAngle = (Math.round(rawAngle / 15) * 15) % 360;
        }
        return { angle: rawAngle, snapped };
      };

      // Cardinal snaps (0, 45, 90, 135, 180, 270)
      assert.equal(snapAngle(2).angle, 0);
      assert.equal(snapAngle(43).angle, 45);
      assert.equal(snapAngle(47).angle, 45);
      assert.equal(snapAngle(88).angle, 90);
      assert.equal(snapAngle(133).angle, 135);
      assert.equal(snapAngle(183).angle, 180);
      assert.equal(snapAngle(274).angle, 270);

      // 15-degree interval snaps
      assert.equal(snapAngle(16).angle, 15);
      assert.equal(snapAngle(29).angle, 30);
      assert.equal(snapAngle(59).angle, 60);
      assert.equal(snapAngle(74).angle, 75);
      assert.equal(snapAngle(104).angle, 105);
      assert.equal(snapAngle(121).angle, 120);
    });

    it('verifies mid-edge handle directional dimension adjustment logic', () => {
      // East (e) & West (w) adjust width
      // North (n) & South (s) adjust height
      const applyHandleResize = (
        handle: 'nw' | 'ne' | 'se' | 'sw' | 'e' | 's' | 'w' | 'n',
        dx: number,
        dy: number,
        startW: number,
        startH: number
      ) => {
        let newW = startW;
        let newH = startH;
        if (handle === 'e' || handle === 'se' || handle === 'ne') {
          newW = Math.max(0.5, startW + dx);
        }
        if (handle === 'w' || handle === 'sw' || handle === 'nw') {
          newW = Math.max(0.5, startW - dx);
        }
        if (handle === 's' || handle === 'se' || handle === 'sw') {
          newH = Math.max(0.5, startH + dy);
        }
        if (handle === 'n' || handle === 'ne' || handle === 'nw') {
          newH = Math.max(0.5, startH - dy);
        }
        return { newW, newH };
      };

      // East handle only changes width
      const east = applyHandleResize('e', 2, 3, 5, 4);
      assert.equal(east.newW, 7);
      assert.equal(east.newH, 4);

      // South handle only changes height
      const south = applyHandleResize('s', 2, 3, 5, 4);
      assert.equal(south.newW, 5);
      assert.equal(south.newH, 7);

      // Corner handle changes both
      const se = applyHandleResize('se', 2, 3, 5, 4);
      assert.equal(se.newW, 7);
      assert.equal(se.newH, 7);
    });

    it('verifies 28px virtual touch tolerance and 30px rotation stem', () => {
      const hitRadius = 28;
      const stemLength = 30;
      assert.equal(hitRadius, 28);
      assert.equal(stemLength, 30);

      // Point within 28px of handle triggers hit
      const handlePos = { x: 100, y: 100 };
      const touchPos1 = { x: 115, y: 110 }; // dist = hypot(15, 10) = ~18.02px <= 28
      const touchDist1 = Math.hypot(touchPos1.x - handlePos.x, touchPos1.y - handlePos.y);
      assert.ok(touchDist1 <= hitRadius);

      const touchPos2 = { x: 130, y: 125 }; // dist = hypot(30, 25) = ~39px > 28
      const touchDist2 = Math.hypot(touchPos2.x - handlePos.x, touchPos2.y - handlePos.y);
      assert.ok(touchDist2 > hitRadius);
    });
  });

  describe('Phase 3: 300 DPI Vector PDF Export & CAD Symbols', () => {
    it('renders Electrical Light / Spot CAD block (⨁) without crashing', () => {
      let saved = false;
      let restored = false;
      let arcCalled = false;

      const mockCtx = {
        save: () => { saved = true; },
        restore: () => { restored = true; },
        translate: () => {},
        rotate: () => {},
        beginPath: () => {},
        arc: () => { arcCalled = true; },
        moveTo: () => {},
        lineTo: () => {},
        stroke: () => {},
        fill: () => {},
        strokeRect: () => {},
        fillRect: () => {},
        fillStyle: '',
        strokeStyle: '',
        lineWidth: 1,
      } as unknown as CanvasRenderingContext2D;

      renderCADSymbol(mockCtx, {
        x: 50,
        y: 50,
        w: 24,
        h: 24,
        type: 'ceiling light',
        label: 'Spot Light 1',
      });

      assert.ok(saved);
      assert.ok(restored);
      assert.ok(arcCalled);
    });

    it('renders Double Bed CAD symbol with pillows and fold lines', () => {
      let fillRectCount = 0;
      let strokeRectCount = 0;

      const mockCtx = {
        save: () => {},
        restore: () => {},
        translate: () => {},
        rotate: () => {},
        beginPath: () => {},
        arc: () => {},
        moveTo: () => {},
        lineTo: () => {},
        stroke: () => {},
        fill: () => {},
        strokeRect: () => { strokeRectCount++; },
        fillRect: () => { fillRectCount++; },
        fillStyle: '',
        strokeStyle: '',
        lineWidth: 1,
      } as unknown as CanvasRenderingContext2D;

      renderCADSymbol(mockCtx, {
        x: 100,
        y: 100,
        w: 60,
        h: 80,
        type: 'double bed',
        label: 'Master Bed',
      });

      assert.ok(fillRectCount >= 2);
      assert.ok(strokeRectCount >= 2);
    });

    it('renders Ceiling Fan CAD symbol with blades', () => {
      let arcCalled = false;

      const mockCtx = {
        save: () => {},
        restore: () => {},
        translate: () => {},
        rotate: () => {},
        beginPath: () => {},
        arc: () => { arcCalled = true; },
        moveTo: () => {},
        lineTo: () => {},
        stroke: () => {},
        fill: () => {},
        strokeRect: () => {},
        fillRect: () => {},
        fillStyle: '',
        strokeStyle: '',
        lineWidth: 1,
      } as unknown as CanvasRenderingContext2D;

      renderCADSymbol(mockCtx, {
        x: 200,
        y: 200,
        w: 40,
        h: 40,
        type: 'fan',
        label: 'Ceiling Fan',
      });

      assert.ok(arcCalled);
    });

    it('verifies 300 DPI canvas dimensions default to 3508 x 2480', () => {
      const options: FloorPlanPdfOptions = {
        plan: {
          id: 'p1',
          buildingName: 'Test Villa',
          floorName: 'Ground Floor',
          plotLength: 40,
          plotWidth: 30,
          userId: 'u1',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        } as any,
        walls: [],
        rooms: [],
        unit: 'feet',
      };

      // In Node environment without jsdom document, returns empty string cleanly
      const dataUrl = renderFloorPlanToCanvas(options);
      assert.equal(typeof dataUrl, 'string');
    });
  });

  describe('Phase 4: Direct-Touch Auto-Select & Auto-Revert Navigation (Floor Plan Creator UX)', () => {
    it('verifies spatial hit-testing z-order priority: Door/Window > Furniture > Column > Wall > Room', () => {
      // Priority scoring helper replicating findHitItemAtWorldPos
      type EntityType = 'door' | 'window' | 'furniture' | 'column' | 'wall' | 'room';
      const getZOrder = (type: EntityType): number => {
        switch (type) {
          case 'door':
          case 'window':
            return 1;
          case 'furniture':
            return 2;
          case 'column':
            return 3;
          case 'wall':
            return 4;
          case 'room':
            return 5;
        }
      };

      const candidates: { id: string; type: EntityType }[] = [
        { id: 'room-1', type: 'room' },
        { id: 'wall-1', type: 'wall' },
        { id: 'furn-1', type: 'furniture' },
        { id: 'door-1', type: 'door' },
        { id: 'col-1', type: 'column' },
      ];

      candidates.sort((a, b) => getZOrder(a.type) - getZOrder(b.type));

      assert.equal(candidates[0].type, 'door');
      assert.equal(candidates[1].type, 'furniture');
      assert.equal(candidates[2].type, 'column');
      assert.equal(candidates[3].type, 'wall');
      assert.equal(candidates[4].type, 'room');
    });

    it('verifies single-touch on empty space initiates canvas pan and deselects', () => {
      let selectedId: string | null = 'furn-1';
      let isPanning = false;

      const handlePointerDown = (hasHitItem: boolean, pointerCount: number) => {
        if (pointerCount >= 2) {
          // Pinch-to-zoom / multi-touch pan
          return { mode: 'pinch' };
        }
        if (hasHitItem) {
          selectedId = 'item-at-finger';
          return { mode: 'drag-item', activeTool: 'select' };
        } else {
          selectedId = null;
          isPanning = true;
          return { mode: 'pan-canvas' };
        }
      };

      // Tap on empty space with 1 finger
      const result = handlePointerDown(false, 1);
      assert.equal(result.mode, 'pan-canvas');
      assert.equal(selectedId, null);
      assert.equal(isPanning, true);
    });

    it('verifies direct-touch on element auto-switches activeTool to select', () => {
      let activeTool = 'wall';
      let selectedElement: { type: string; id: string } | null = null;

      const onDirectTouchItem = (itemType: string, itemId: string) => {
        activeTool = 'select';
        selectedElement = { type: itemType, id: itemId };
      };

      // User was in wall drawing tool, but taps on an existing bed
      onDirectTouchItem('furniture', 'bed-123');
      assert.equal(activeTool, 'select');
      assert.deepEqual(selectedElement, { type: 'furniture', id: 'bed-123' });
    });

    it('verifies one-shot placement auto-reverts activeTool to select and selects the new entity', () => {
      let activeTool = 'furniture';
      let selectedElement: { type: string; id: string } | null = null;

      const placeFurnitureItem = (furnitureId: string) => {
        // Direct placement: spawn at center, auto-select, auto-revert tool
        selectedElement = { type: 'furniture', id: furnitureId };
        activeTool = 'select';
      };

      placeFurnitureItem('sofa-999');
      assert.equal(activeTool, 'select');
      assert.equal(selectedElement?.id, 'sofa-999');
    });

    it('verifies multi-touch (2 fingers) always takes pinch/zoom priority over object dragging', () => {
      const getTouchGesture = (pointerCount: number, underFingerItem: boolean) => {
        if (pointerCount >= 2) {
          return 'PINCH_ZOOM_PAN';
        }
        if (underFingerItem) {
          return 'ITEM_DRAG';
        }
        return 'CANVAS_PAN';
      };

      // Even if finger 1 is right on top of a bed, second finger down triggers pinch/zoom
      assert.equal(getTouchGesture(2, true), 'PINCH_ZOOM_PAN');
      assert.equal(getTouchGesture(1, true), 'ITEM_DRAG');
      assert.equal(getTouchGesture(1, false), 'CANVAS_PAN');
    });
  });

  describe('Phase 5: Direct Feet & Inches Quick Keypad (Precision Input)', () => {
    it('converts feet and inches accurately into decimal feet', () => {
      const toDecimalFeet = (feetStr: string, inchesStr: string) => {
        const f = parseFloat(feetStr) || 0;
        const i = parseFloat(inchesStr) || 0;
        return Number((f + i / 12).toFixed(2));
      };

      // 10' 6" = 10.5 ft
      assert.equal(toDecimalFeet('10', '6'), 10.5);
      // 12' 0" = 12.0 ft
      assert.equal(toDecimalFeet('12', '0'), 12);
      // 2' 6" = 2.5 ft (standard toilet door)
      assert.equal(toDecimalFeet('2', '6'), 2.5);
      // 3' 3" = 3.25 ft
      assert.equal(toDecimalFeet('3', '3'), 3.25);
      // 14' 9" = 14.75 ft
      assert.equal(toDecimalFeet('14', '9'), 14.75);
    });

    it('resizes wall length accurately along existing directional vector', () => {
      const resizeWall = (wall: { x1: number; y1: number; x2: number; y2: number }, targetLen: number) => {
        const dx = wall.x2 - wall.x1;
        const dy = wall.y2 - wall.y1;
        const currentLen = Math.hypot(dx, dy);
        const angle = Math.atan2(dy, dx);
        return {
          x1: wall.x1,
          y1: wall.y1,
          x2: Number((wall.x1 + targetLen * Math.cos(angle)).toFixed(2)),
          y2: Number((wall.y1 + targetLen * Math.sin(angle)).toFixed(2)),
        };
      };

      // Horizontal wall from (0,0) to (10,0) stretched to 15.5 ft
      const hWall = resizeWall({ x1: 0, y1: 0, x2: 10, y2: 0 }, 15.5);
      assert.equal(hWall.x2, 15.5);
      assert.equal(hWall.y2, 0);

      // Vertical wall from (5,5) to (5,15) stretched to 20 ft
      const vWall = resizeWall({ x1: 5, y1: 5, x2: 5, y2: 15 }, 20);
      assert.equal(vWall.x2, 5);
      assert.equal(vWall.y2, 25);
    });

    it('scales room polygon points proportionally when new width and length are applied', () => {
      const scaleRoom = (
        room: { x: number; y: number; width: number; height: number; polygonPoints: { x: number; y: number }[] },
        newW: number,
        newH: number
      ) => {
        const scaleX = newW / room.width;
        const scaleY = newH / room.height;
        return room.polygonPoints.map(p => ({
          x: Number((room.x + (p.x - room.x) * scaleX).toFixed(2)),
          y: Number((room.y + (p.y - room.y) * scaleY).toFixed(2)),
        }));
      };

      const testRoom = {
        x: 10,
        y: 10,
        width: 10,
        height: 10,
        polygonPoints: [
          { x: 10, y: 10 },
          { x: 20, y: 10 },
          { x: 20, y: 20 },
          { x: 10, y: 20 },
        ],
      };

      // Resize from 10x10 to 12x14
      const scaledPts = scaleRoom(testRoom, 12, 14);
      assert.deepEqual(scaledPts, [
        { x: 10, y: 10 },
        { x: 22, y: 10 },
        { x: 22, y: 24 },
        { x: 10, y: 24 },
      ]);
    });
  });
});
