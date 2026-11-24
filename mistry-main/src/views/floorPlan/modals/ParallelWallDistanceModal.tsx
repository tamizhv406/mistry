import React from 'react';
import { Ruler, X } from 'lucide-react';
import { COMMON_PARALLEL_OFFSETS_MM, type ParallelGuideResult } from '../../../services/cadParallelGuide';

export interface ParallelWallDistanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  parallelGuide: ParallelGuideResult | null;
  customParallelMmInput: string;
  onCustomParallelMmInputChange: (val: string) => void;
  onApplyParallelDistance: (presetMm?: number) => void;
  parallelToleranceMm: number;
  onParallelToleranceMmChange: (val: number) => void;
}

export const ParallelWallDistanceModal: React.FC<ParallelWallDistanceModalProps> = ({
  isOpen,
  onClose,
  parallelGuide,
  customParallelMmInput,
  onCustomParallelMmInputChange,
  onApplyParallelDistance,
  parallelToleranceMm,
  onParallelToleranceMmChange,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fp-calc-modal" role="dialog" aria-modal="true">
      <div className="fp-calc-dialog" style={{ maxWidth: 520 }}>
        <div className="fp-calc-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Ruler size={20} color="#0284c7" />
            <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a' }}>
              CAD Parallel Wall Distance (mm)
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
          <div
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: 8,
              padding: '12px 14px',
              marginBottom: 16,
            }}
          >
            <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: 4 }}>
              Current Parallel Distance
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', fontFamily: 'monospace' }}>
                {parallelGuide ? parallelGuide.formattedDistance : `${customParallelMmInput || 19} mm`}
              </span>
              {parallelGuide?.isSnapped && (
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    color: '#16a34a',
                    background: '#dcfce7',
                    padding: '2px 8px',
                    borderRadius: 12,
                  }}
                >
                  SNAPPED
                </span>
              )}
              {parallelGuide && (
                <span style={{ fontSize: '0.8rem', color: '#64748b', marginLeft: 'auto' }}>
                  {parallelGuide.isVertical ? 'Vertical Wall' : parallelGuide.isHorizontal ? 'Horizontal Wall' : 'Angled Wall'}
                </span>
              )}
            </div>
          </div>

          {/* Input for mm */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: 6 }}>
              Exact Distance in Millimeters (mm):
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="number"
                step="0.5"
                min="1"
                max="10000"
                value={customParallelMmInput}
                onChange={e => onCustomParallelMmInputChange(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    onApplyParallelDistance();
                  }
                }}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: 6,
                  border: '1px solid #cbd5e1',
                  fontSize: '1rem',
                  fontFamily: 'monospace',
                }}
                placeholder="e.g. 19"
                id="fp-parallel-mm-input"
              />
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => onApplyParallelDistance()}
                id="fp-apply-parallel-btn"
              >
                Apply Exact
              </button>
            </div>
          </div>

          {/* Quick Preset Buttons */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Standard Architectural Presets (mm)
            </label>
            <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
              {COMMON_PARALLEL_OFFSETS_MM.map((presetMm: number) => {
                const isSelected = parseFloat(customParallelMmInput) === presetMm;
                return (
                  <button
                    key={presetMm}
                    type="button"
                    className={`fp-cat-chip ${isSelected ? 'active' : ''}`}
                    onClick={() => {
                      onCustomParallelMmInputChange(String(presetMm));
                      onApplyParallelDistance(presetMm);
                    }}
                  >
                    {presetMm} mm {presetMm === 19 ? '(3/4" Gap)' : presetMm === 50 ? '(2" Stud)' : presetMm === 115 ? '(4.5" Wall)' : presetMm === 230 ? '(9" Main)' : ''}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tolerance Selector */}
          <div style={{ marginBottom: 8 }}>
            <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Snapping Tolerance
            </label>
            <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
              {[3, 6, 12, 20].map(tol => (
                <button
                  key={tol}
                  type="button"
                  className={`fp-cat-chip ${parallelToleranceMm === tol ? 'active' : ''}`}
                  onClick={() => onParallelToleranceMmChange(tol)}
                >
                  ±{tol} mm
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="fp-calc-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 16px', borderTop: '1px solid #e2e8f0' }}>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={onClose}
          >
            Close
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => onApplyParallelDistance()}
          >
            Set Distance
          </button>
        </div>
      </div>
    </div>
  );
};
