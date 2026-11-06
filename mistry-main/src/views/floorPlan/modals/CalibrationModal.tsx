import React from 'react';
import { Image as ImageIcon, X, Lock, Unlock, Eye, Trash2 } from 'lucide-react';
import type { BackgroundPlanImage, FloorPlanLevel, FloorPlanUnit } from '../../../db/types';
import { uid } from '../utils';

export interface CalibrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  unit: FloorPlanUnit;
  currentFloor: FloorPlanLevel;
  bgImageScaleW: number;
  bgImageScaleH: number;
  bgImageOpacity: number;
  onBgImageLoaded: (bg: BackgroundPlanImage) => void;
  onUpdateBgImage: (changes: Partial<BackgroundPlanImage>) => void;
  onRemoveBgImage: () => void;
}

export const CalibrationModal: React.FC<CalibrationModalProps> = ({
  isOpen,
  onClose,
  unit,
  currentFloor,
  bgImageScaleW,
  bgImageScaleH,
  bgImageOpacity,
  onBgImageLoaded,
  onUpdateBgImage,
  onRemoveBgImage,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fp-calc-modal no-print" role="dialog" aria-modal="true">
      <div className="fp-calc-dialog" style={{ maxWidth: 480 }}>
        <div className="fp-calc-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ImageIcon size={20} color="#1e293b" />
            <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a' }}>
              Background Reference Plan Image
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

        <div className="fp-calc-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <p style={{ fontSize: '0.82rem', color: '#475569', margin: 0 }}>
            Import an existing blueprint, surveyor drawing, or sketch (PNG/JPG) to trace over in Building Mistry CAD.
          </p>

          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6 }}>
              Upload Image File
            </label>
            <input
              type="file"
              accept="image/png, image/jpeg, image/webp"
              style={{ fontSize: '0.8rem', color: '#0f172a' }}
              onChange={e => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => {
                  const dataUrl = reader.result as string;
                  const bg: BackgroundPlanImage = {
                    id: uid('bg'),
                    url: dataUrl,
                    x: 0,
                    y: 0,
                    width: bgImageScaleW,
                    height: bgImageScaleH,
                    opacity: bgImageOpacity,
                    locked: true,
                    visible: true,
                  };
                  onBgImageLoaded(bg);
                };
                reader.readAsDataURL(file);
              }}
            />
          </div>

          {currentFloor.backgroundImage && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: '0.78rem', color: '#475569' }}>Width ({unit === 'feet' ? 'ft' : 'm'})</label>
                  <input
                    type="number"
                    className="fp-inspector-input"
                    value={currentFloor.backgroundImage.width}
                    onChange={e => {
                      const w = parseFloat(e.target.value) || 10;
                      onUpdateBgImage({ width: w });
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.78rem', color: '#475569' }}>Height ({unit === 'feet' ? 'ft' : 'm'})</label>
                  <input
                    type="number"
                    className="fp-inspector-input"
                    value={currentFloor.backgroundImage.height}
                    onChange={e => {
                      const h = parseFloat(e.target.value) || 10;
                      onUpdateBgImage({ height: h });
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', color: '#475569', display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span>Opacity</span>
                  <span>{Math.round((currentFloor.backgroundImage.opacity ?? 0.5) * 100)}%</span>
                </label>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.05"
                  value={currentFloor.backgroundImage.opacity ?? 0.5}
                  style={{ width: '100%' }}
                  onChange={e => {
                    const op = parseFloat(e.target.value);
                    onUpdateBgImage({ opacity: op });
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 8 }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    const isLocked = !currentFloor.backgroundImage?.locked;
                    onUpdateBgImage({ locked: isLocked });
                  }}
                >
                  {currentFloor.backgroundImage.locked ? <Lock size={14} /> : <Unlock size={14} />}
                  <span>{currentFloor.backgroundImage.locked ? 'Locked' : 'Unlocked'}</span>
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    const isVis = currentFloor.backgroundImage?.visible === false;
                    onUpdateBgImage({ visible: isVis });
                  }}
                >
                  <Eye size={14} />
                  <span>{currentFloor.backgroundImage.visible !== false ? 'Visible' : 'Hidden'}</span>
                </button>
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={onRemoveBgImage}
                >
                  <Trash2 size={14} />
                  <span>Remove</span>
                </button>
              </div>
            </>
          )}
        </div>

        <div className="fp-calc-footer" style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={onClose}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
