import React from 'react';
import { Sheet, Note } from '../../../components/mobile/kit';
import { PLAN_DISCLAIMER, PLAN_REVIEW_NOTE } from '../../../domain/planDocument';
import { baseUnitOf } from '../../../domain/planGeometry';
import type { FloorPlanUnit } from '../../../db/types';

export interface DrawingTipsModalProps {
  isOpen: boolean;
  onClose: () => void;
  unit: FloorPlanUnit;
}

export const DrawingTipsModal: React.FC<DrawingTipsModalProps> = ({
  isOpen,
  onClose,
  unit,
}) => {
  return (
    <Sheet open={isOpen} title="Drawing tips" onClose={onClose}>
      <div className="fp-help">
        <h3>Drawing walls</h3>
        <ul>
          <li><strong>Sketch:</strong> draw a room outline in one stroke. It is straightened, joined to nearby corners and closed into a room as you draw. A large correction is shown first and added only if you choose Use.</li>
          <li><strong>Straight:</strong> drag out one wall, or tap its two ends, for exact placement.</li>
          <li><strong>Two fingers</strong> always move and zoom the plan and never draw. On a computer, scroll to zoom and drag empty space to move.</li>
          <li><strong>Undo</strong> takes back the last change, including a whole sketched room.</li>
        </ul>
        <h3>Editing</h3>
        <ul>
          <li>With Select, tap a wall. Drag a round handle to resize it; the walls joined at that corner follow.</li>
          <li>Tap a red measurement to type an exact length, thickness or position.</li>
          <li>Snap pulls ends to the grid and to nearby corners. Turn it off to place things freely.</li>
        </ul>
        <h3>What the measurements mean</h3>
        <ul>
          <li><span className="fp-help-swatch is-red" /> <strong>Red, outside a wall:</strong> the wall's length, corner to corner along its centre line.</li>
          <li><span className="fp-help-swatch is-green" /> <strong>Green, inside a room:</strong> the clear size between the inner wall faces.</li>
          <li><strong>Thickness</strong> is measured across a wall and never changes its length.</li>
          <li>Room area on the plan and in totals is measured to the wall centre lines. The green "Inside" figure is the clear floor area.</li>
          <li>Lengths are stored exactly, in {baseUnitOf(unit) === 'feet' ? 'feet' : 'metres'}; only the text on screen is rounded{unit === 'feet' ? ' (to a quarter inch)' : ''}.</li>
        </ul>
        <Note tone="warn">
          {PLAN_DISCLAIMER} {PLAN_REVIEW_NOTE}
        </Note>
      </div>
    </Sheet>
  );
};
