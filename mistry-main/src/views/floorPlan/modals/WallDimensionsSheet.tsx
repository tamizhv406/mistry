import React from 'react';
import { Sheet, Field, Note, Segmented } from '../../../components/mobile/kit';
import { baseUnitOf } from '../../../domain/planGeometry';
import { formatDimension, formatThickness, wallThicknessPresets } from '../../../domain/planMeasure';
import type { FloorPlanWall, FloorPlanUnit } from '../../../db/types';
import { wallLength } from '../utils';

export interface WallEditState {
  wallId: string;
  length: string;
  thickness: string;
  angle?: string;
  keep: 'start' | 'end';
  x: string;
  x0: string;
  y: string;
  y0: string;
  error?: string;
}

export interface WallDimensionsSheetProps {
  wallEdit: WallEditState | null;
  walls: FloorPlanWall[];
  unit: FloorPlanUnit;
  onClose: () => void;
  onWallEditChange: (changes: Partial<WallEditState>) => void;
  onSubmitWallEdit: () => void;
}

export const WallDimensionsSheet: React.FC<WallDimensionsSheetProps> = ({
  wallEdit,
  walls,
  unit,
  onClose,
  onWallEditChange,
  onSubmitWallEdit,
}) => {
  if (!wallEdit) return null;
  const w = walls.find(x => x.id === wallEdit.wallId);
  if (!w) return null;

  const feet = baseUnitOf(unit) === 'feet';
  const level = Math.abs(w.x2 - w.x1) >= Math.abs(w.y2 - w.y1);
  const startFirst = level ? w.x1 <= w.x2 : w.y1 <= w.y2;
  const [first, second] = level ? ['Left end', 'Right end'] : ['Top end', 'Bottom end'];

  const setKeep = (keep: 'start' | 'end') => {
    const anchor = keep === 'start' ? { x: w.x1, y: w.y1 } : { x: w.x2, y: w.y2 };
    const x = String(Number(anchor.x.toFixed(4)));
    const y = String(Number(anchor.y.toFixed(4)));
    onWallEditChange({ keep, x, x0: x, y, y0: y, error: '' });
  };

  const onEnter = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onSubmitWallEdit();
    }
  };

  return (
    <Sheet
      open
      title="Wall size"
      subtitle={`Now ${formatDimension(wallLength(w), unit)} long and ${formatThickness(w.thickness, unit)} thick`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="m-btn" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="m-btn is-primary"
            onClick={onSubmitWallEdit}
            id="fp-wall-edit-apply"
          >
            Apply
          </button>
        </>
      }
    >
      <div className="fp-wall-edit">
        {wallEdit.error && (
          <div style={{ marginBottom: 12 }}>
            <Note tone="bad" role="alert">{wallEdit.error}</Note>
          </div>
        )}
        {w.locked && (
          <div style={{ marginBottom: 12 }}>
            <Note tone="warn">This wall is locked. Unlock it to change its size.</Note>
          </div>
        )}
        <Field
          label="Length"
          hint={
            feet ? (
              <>Type <strong>12 6</strong> or <strong>12' 6"</strong> for 12 ft 6 in. Metres work too: <strong>3.8m</strong>.</>
            ) : (
              <>Type <strong>3.5</strong> or <strong>350 cm</strong>. Feet work too: <strong>12' 6"</strong>.</>
            )
          }
        >
          <input
            id="fp-wall-edit-length"
            type="text"
            inputMode="text"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            enterKeyHint="done"
            value={wallEdit.length}
            aria-invalid={!!wallEdit.error}
            onChange={e => onWallEditChange({ length: e.target.value, error: '' })}
            onFocus={e => e.currentTarget.select()}
            onKeyDown={onEnter}
          />
        </Field>
        <div className="m-field">
          <span className="m-field-label">End that stays in place</span>
          <Segmented
            label="End that stays in place"
            value={wallEdit.keep}
            onChange={v => setKeep(v as 'start' | 'end')}
            options={[
              { value: startFirst ? 'start' : 'end', label: first },
              { value: startFirst ? 'end' : 'start', label: second },
            ]}
          />
          <span className="m-field-hint" style={{ display: 'block' }}>
            The other end moves. Walls joined to it move with it, so corners stay joined.
          </span>
        </div>
        <Field
          label="Angle (degrees)"
          hint="0° is horizontal to right, 90° is vertical down, 180° is left, 270° is up."
        >
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              id="fp-wall-edit-angle"
              type="number"
              inputMode="decimal"
              step="any"
              value={wallEdit.angle || '0'}
              onChange={e => onWallEditChange({ angle: e.target.value, error: '' })}
              onKeyDown={onEnter}
              style={{ flex: 1 }}
            />
            <span style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>deg</span>
          </div>
        </Field>
        <div className="fp-wall-edit-presets" role="group" aria-label="Common wall angles">
          {[0, 15, 30, 45, 90, 180, 270].map(a => (
            <button
              key={a}
              type="button"
              className="m-chip"
              aria-pressed={Number(wallEdit.angle) === a}
              onClick={() => onWallEditChange({ angle: String(a), error: '' })}
            >
              {a}°
            </button>
          ))}
        </div>
        <Field
          label={feet ? 'Thickness (inches)' : 'Thickness (mm)'}
          hint="Measured across the wall. It does not change the wall's length."
        >
          <input
            id="fp-wall-edit-thickness"
            type="text"
            inputMode="text"
            autoComplete="off"
            spellCheck={false}
            value={wallEdit.thickness}
            onChange={e => onWallEditChange({ thickness: e.target.value, error: '' })}
            onKeyDown={onEnter}
          />
        </Field>
        <div className="fp-wall-edit-presets" role="group" aria-label="Common wall thicknesses">
          {wallThicknessPresets(unit).map((p: { label: string; value: number }) => (
            <button
              key={p.label}
              type="button"
              className="m-chip"
              aria-pressed={wallEdit.thickness.trim() === formatThickness(p.value, unit)}
              onClick={() => onWallEditChange({ thickness: formatThickness(p.value, unit), error: '' })}
            >
              {p.label}
            </button>
          ))}
        </div>
        <details className="fp-wall-edit-more">
          <summary>Position</summary>
          <p className="m-field-hint" style={{ display: 'block', margin: '8px 0' }}>
            Where the end that stays is, measured from the plot's top-left corner, in {feet ? 'feet' : 'metres'}.
          </p>
          <div className="fp-wall-edit-xy">
            <Field label="From the left">
              <input
                id="fp-wall-edit-x"
                type="number"
                inputMode="decimal"
                step="any"
                value={wallEdit.x}
                onChange={e => onWallEditChange({ x: e.target.value, error: '' })}
                onKeyDown={onEnter}
              />
            </Field>
            <Field label="From the top">
              <input
                id="fp-wall-edit-y"
                type="number"
                inputMode="decimal"
                step="any"
                value={wallEdit.y}
                onChange={e => onWallEditChange({ y: e.target.value, error: '' })}
                onKeyDown={onEnter}
              />
            </Field>
          </div>
        </details>
        <p className="fp-wall-edit-note">
          Length is measured along the wall's centre line, corner to corner.
        </p>
      </div>
    </Sheet>
  );
};
