import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('Bottom Bar Metrics and Right-Side Floating CAD Palette Layout', async (t) => {
  const editorFile = fs.readFileSync(
    path.join(process.cwd(), 'src/views/FloorPlanEditorView.tsx'),
    'utf-8'
  );
  const cssFile = fs.readFileSync(
    path.join(process.cwd(), 'src/index.css'),
    'utf-8'
  );

  await t.test('1. Floating info panel is removed from inside the canvas', () => {
    // Ensure .fp-info-panel is no longer rendered inside the canvas area
    assert.strictEqual(
      editorFile.includes('<div className="fp-info-panel'),
      false,
      'fp-info-panel should no longer be floating inside the canvas'
    );
  });

  await t.test('2. Bottom center bar replaces static selected element text with real-time metrics', () => {
    // Check that fp-bottom-center contains fp-bottom-metrics
    assert.ok(
      editorFile.includes('className="fp-bottom-center"'),
      'fp-bottom-center exists in FloorPlanEditorView'
    );
    assert.ok(
      editorFile.includes('className="fp-bottom-metrics"'),
      'fp-bottom-metrics is integrated inside the bottom status bar'
    );
    assert.ok(
      editorFile.includes('totalFloorArea.toFixed(1)'),
      'Floor Area is displayed in bottom bar'
    );
    assert.ok(
      editorFile.includes('editorState.walls.length'),
      'Walls count is displayed in bottom bar'
    );
    assert.ok(
      editorFile.includes('editorState.rooms.length'),
      'Rooms count is displayed in bottom bar'
    );
    assert.ok(
      editorFile.includes('editorState.columns.length'),
      'Columns count is displayed in bottom bar'
    );
    assert.ok(
      editorFile.includes('currentMousePos'),
      'Mouse cursor coordinates are displayed when hovered'
    );
    assert.ok(
      editorFile.includes('id="fp-bottom-measurements-toggle"'),
      'Quick Dims ON/OFF toggle is available in bottom bar'
    );
  });

  await t.test('3. Floating CAD controls is positioned vertically on the right edge of the canvas', () => {
    // Check CSS positioning of .fp-floating-cad-controls
    assert.ok(
      cssFile.includes('.fp-floating-cad-controls'),
      'CSS defines .fp-floating-cad-controls'
    );
    assert.ok(
      cssFile.includes('flex-direction: column;'),
      'CAD controls layout is vertical'
    );
    assert.ok(
      cssFile.includes('top: 50%;') && cssFile.includes('transform: translateY(-50%);'),
      'CAD controls are centered vertically on canvas'
    );
    assert.ok(
      cssFile.includes('right: 14px;'),
      'CAD controls are anchored to the right side'
    );
  });

  await t.test('4. Zoom preset menu pops out to the left for vertical layout', () => {
    assert.ok(
      cssFile.includes('.fp-cad-zoom-menu'),
      'CSS defines .fp-cad-zoom-menu'
    );
    assert.ok(
      cssFile.includes('right: calc(100% + 8px);'),
      'Zoom menu correctly pops out towards the canvas on the left'
    );
  });
});

