import React from 'react';
import { Settings, X, Sparkles } from 'lucide-react';
import type { FloorPlanUnit } from '../../../db/types';
import { WALL_THICKNESS_PRESETS_MM, mmToPlanUnits } from '../../../services/geometryEngine';
import { gridStepOptions } from '../../../domain/planMeasure';

export interface CadSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  showTips: boolean;
  onShowTipsChange: (val: boolean) => void;
  isAiLiveAssistActive: boolean;
  onAiLiveAssistChange: (val: boolean) => void;
  unit: FloorPlanUnit;
  wallThickness: number;
  onWallThicknessChange: (val: number, label: string) => void;
  gridStep: number;
  onGridStepChange: (val: number) => void;
  snapReach: number;
  onSnapReachChange: (val: number) => void;
  dimTextScale: number;
  onDimTextScaleChange: (val: number) => void;
  snapToGridEnabled: boolean;
  onSnapToGridChange: (val: boolean) => void;
  snapToEndpointsEnabled: boolean;
  onSnapToEndpointsChange: (val: boolean) => void;
  snapToWallEnabled: boolean;
  onSnapToWallChange: (val: boolean) => void;
  isOrthoActive: boolean;
  onOrthoActiveChange: (val: boolean) => void;
  onLoadStarterPlan: () => void;
}

export const CadSettingsModal: React.FC<CadSettingsModalProps> = ({
  isOpen,
  onClose,
  showTips,
  onShowTipsChange,
  isAiLiveAssistActive,
  onAiLiveAssistChange,
  unit,
  wallThickness,
  onWallThicknessChange,
  gridStep,
  onGridStepChange,
  snapReach,
  onSnapReachChange,
  dimTextScale,
  onDimTextScaleChange,
  snapToGridEnabled,
  onSnapToGridChange,
  snapToEndpointsEnabled,
  onSnapToEndpointsChange,
  snapToWallEnabled,
  onSnapToWallChange,
  isOrthoActive,
  onOrthoActiveChange,
  onLoadStarterPlan,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fp-calc-modal" role="dialog" aria-modal="true">
      <div className="fp-calc-dialog" style={{ maxWidth: 560 }}>
        <div className="fp-calc-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Settings size={20} color="#1e293b" />
            <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a' }}>
              Drawing settings
            </h3>
          </div>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </div>

        <div className="fp-calc-body">
          {/* Help that is off by default */}
          <div style={{ marginBottom: 16, display: 'grid', gap: 8 }}>
            <label className="fp-setting-switch">
              <input
                type="checkbox"
                checked={showTips}
                onChange={e => onShowTipsChange(e.target.checked)}
                id="fp-setting-tips"
              />
              <span><strong>Show tips</strong> A one-line tip for the tool in hand, and first-use tips.</span>
            </label>
            <label className="fp-setting-switch">
              <input
                type="checkbox"
                checked={isAiLiveAssistActive}
                onChange={e => onAiLiveAssistChange(e.target.checked)}
                id="fp-setting-live-assist"
              />
              <span><strong>Read sketch strokes live</strong> Guesses what a freehand stroke is (door, window, room) and asks. Off by default.</span>
            </label>
          </div>

          {/* Wall Thickness Presets */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
              Standard Wall Thickness Presets
            </label>
            <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              {WALL_THICKNESS_PRESETS_MM.map((presetMm: number) => {
                const presetUnits = mmToPlanUnits(presetMm, unit);
                const isCurrent = Math.abs(wallThickness - presetUnits) < 0.05;
                return (
                  <button
                    key={presetMm}
                    type="button"
                    className={`fp-cat-chip ${isCurrent ? 'active' : ''}`}
                    onClick={() => onWallThicknessChange(presetUnits, `${presetMm}mm`)}
                  >
                    {presetMm} mm ({presetMm <= 115 ? 'Partition' : presetMm === 150 ? 'AAC Block' : '9" Brick'})
                  </button>
                );
              })}
            </div>
          </div>

          {/* Grid Spacing Presets */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
              Snap Step
            </label>
            <p style={{ fontSize: '0.8rem', color: '#475569', margin: '4px 0 0 0' }}>
              With Snap to Grid on, wall ends and anything you place or drag land on multiples of this.
            </p>
            <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              {gridStepOptions(unit).map((option: { value: number; label: string }) => (
                <button
                  key={option.label}
                  type="button"
                  className={`fp-cat-chip ${Math.abs(gridStep - option.value) < 1e-9 ? 'active' : ''}`}
                  aria-pressed={Math.abs(gridStep - option.value) < 1e-9}
                  onClick={() => onGridStepChange(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Snap Reach */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
              Snap Reach
            </label>
            <p style={{ fontSize: '0.8rem', color: '#475569', margin: '4px 0 0 0' }}>
              How close a wall end must be to a corner, crossing or wall before it joins it.
            </p>
            <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              {[{ label: 'Short', value: 0.6 }, { label: 'Normal', value: 1 }, { label: 'Long', value: 1.5 }].map(option => (
                <button
                  key={option.label}
                  type="button"
                  className={`fp-cat-chip ${snapReach === option.value ? 'active' : ''}`}
                  aria-pressed={snapReach === option.value}
                  onClick={() => onSnapReachChange(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Measurement Text Size */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
              Measurement Text Size
            </label>
            <p style={{ fontSize: '0.8rem', color: '#475569', margin: '4px 0 0 0' }}>
              Changes how large measurements are written on the plan. It never changes a wall's length.
            </p>
            <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              {[
                { label: 'Small', value: 0.85 },
                { label: 'Normal', value: 1 },
                { label: 'Large', value: 1.25 },
                { label: 'Extra large', value: 1.5 },
              ].map(option => (
                <button
                  key={option.label}
                  type="button"
                  className={`fp-cat-chip ${dimTextScale === option.value ? 'active' : ''}`}
                  aria-pressed={dimTextScale === option.value}
                  id={`fp-dim-text-${option.value}`}
                  onClick={() => onDimTextScaleChange(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* CAD Snapping Toggles */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
              Snapping & Alignment Guides
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#0f172a', cursor: 'pointer', fontSize: '0.88rem' }}>
                <input
                  type="checkbox"
                  checked={snapToGridEnabled}
                  onChange={e => onSnapToGridChange(e.target.checked)}
                />
                <span><strong>Snap to Grid:</strong> Magnetic alignment to background grid intervals</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#0f172a', cursor: 'pointer', fontSize: '0.88rem' }}>
                <input
                  type="checkbox"
                  checked={snapToEndpointsEnabled}
                  onChange={e => onSnapToEndpointsChange(e.target.checked)}
                />
                <span><strong>Snap to Endpoints:</strong> Automatic magnetic corner joining for enclosed walls</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#0f172a', cursor: 'pointer', fontSize: '0.88rem' }}>
                <input
                  type="checkbox"
                  checked={snapToWallEnabled}
                  onChange={e => onSnapToWallChange(e.target.checked)}
                />
                <span><strong>Snap Along Walls:</strong> Automatic hosting for doors, windows, TVs & ACs</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#0f172a', cursor: 'pointer', fontSize: '0.88rem' }}>
                <input
                  type="checkbox"
                  checked={isOrthoActive}
                  onChange={e => onOrthoActiveChange(e.target.checked)}
                />
                <span><strong>Ortho Mode:</strong> Constrain drawing to strictly horizontal & vertical lines</span>
              </label>
            </div>
          </div>

          {/* Starter Plan Template Loader */}
          <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 16, marginTop: 16 }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
              Architectural Starter Plan
            </label>
            <p style={{ fontSize: '0.82rem', color: '#475569', margin: '6px 0 12px 0' }}>
              Load a verified 30×40 2BHK architectural plan with living room, master bedroom, kitchen, dining, toilet, and columns.
            </p>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={onLoadStarterPlan}
            >
              <Sparkles size={16} /> Load 30×40 2BHK Plan
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
