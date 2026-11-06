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

  await t.test('2. Bottom info panel displaying Unit, Plot, Level, Floor Area, Walls, and Room count is removed to maximize workspace', () => {
    // Ensure .fp-bottom-bar is removed from the Floor Planner screen to reduce clutter and maximize visible workspace
    assert.strictEqual(
      editorFile.includes('<div className="fp-bottom-bar'),
      false,
      'fp-bottom-bar information panel should be removed from FloorPlanEditorView to maximize workspace'
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

