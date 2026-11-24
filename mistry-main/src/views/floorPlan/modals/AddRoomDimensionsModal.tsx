import React from 'react';
import { Plus, X } from 'lucide-react';
import type { FloorPlanUnit, RoomType } from '../../../db/types';
import { ROOM_TYPES } from '../constants';

export interface AddRoomDimensionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  unit: FloorPlanUnit;
  draftRoomType: RoomType;
  onDraftRoomTypeChange: (val: RoomType) => void;
  draftRoomWidth: number;
  onDraftRoomWidthChange: (val: number) => void;
  draftRoomHeight: number;
  onDraftRoomHeightChange: (val: number) => void;
  draftRoomThickness: number;
  onDraftRoomThicknessChange: (val: number) => void;
  draftRoomFloorFinish: string;
  onDraftRoomFloorFinishChange: (val: string) => void;
  onAddRoomByDimensions: (w: number, h: number, type: RoomType, finish: string) => void;
}

export const AddRoomDimensionsModal: React.FC<AddRoomDimensionsModalProps> = ({
  isOpen,
  onClose,
  unit,
  draftRoomType,
  onDraftRoomTypeChange,
  draftRoomWidth,
  onDraftRoomWidthChange,
  draftRoomHeight,
  onDraftRoomHeightChange,
  draftRoomThickness,
  onDraftRoomThicknessChange,
  draftRoomFloorFinish,
  onDraftRoomFloorFinishChange,
  onAddRoomByDimensions,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fp-calc-modal" role="dialog" aria-modal="true">
      <div className="fp-calc-dialog" style={{ maxWidth: 480 }}>
        <div className="fp-calc-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Plus size={20} color="#1e293b" />
            <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a' }}>
              Add Room by Exact Dimensions
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', color: '#475569', marginBottom: 6, fontWeight: 600 }}>
                Type of Room
              </label>
              <select
                value={draftRoomType}
                onChange={e => onDraftRoomTypeChange(e.target.value as RoomType)}
                style={{ width: '100%', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, color: '#0f172a', padding: '9px 12px', fontSize: '0.85rem' }}
              >
                {ROOM_TYPES.map(rt => <option key={rt} value={rt}>{rt}</option>)}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', color: '#475569', marginBottom: 6, fontWeight: 600 }}>
                  Width ({unit === 'feet' ? 'ft' : 'm'})
                </label>
                <input
                  type="number"
                  step={0.5}
                  value={draftRoomWidth}
                  onChange={e => onDraftRoomWidthChange(parseFloat(e.target.value) || 1)}
                  style={{ width: '100%', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, color: '#0f172a', padding: '9px 12px', fontSize: '0.9rem', fontWeight: 700 }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', color: '#475569', marginBottom: 6, fontWeight: 600 }}>
                  Height / Length ({unit === 'feet' ? 'ft' : 'm'})
                </label>
                <input
                  type="number"
                  step={0.5}
                  value={draftRoomHeight}
                  onChange={e => onDraftRoomHeightChange(parseFloat(e.target.value) || 1)}
                  style={{ width: '100%', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, color: '#0f172a', padding: '9px 12px', fontSize: '0.9rem', fontWeight: 700 }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', color: '#475569', marginBottom: 6, fontWeight: 600 }}>
                  Wall Thickness ({unit === 'feet' ? 'in' : 'cm'})
                </label>
                <input
                  type="number"
                  step={1}
                  value={unit === 'feet' ? Math.round(draftRoomThickness * 12) : Math.round(draftRoomThickness * 100)}
                  onChange={e => {
                    const val = parseFloat(e.target.value) || 9;
                    onDraftRoomThicknessChange(unit === 'feet' ? val / 12 : val / 100);
                  }}
                  style={{ width: '100%', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, color: '#0f172a', padding: '9px 12px', fontSize: '0.9rem' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', color: '#475569', marginBottom: 6, fontWeight: 600 }}>
                  Floor Finish
                </label>
                <select
                  value={draftRoomFloorFinish}
                  onChange={e => onDraftRoomFloorFinishChange(e.target.value)}
                  style={{ width: '100%', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, color: '#0f172a', padding: '9px 12px', fontSize: '0.85rem' }}
                >
                  <option value="Wood Parquet">🪵 Wood Floor Parquet</option>
                  <option value="Color Tint">🎨 Plain Tint</option>
                </select>
              </div>
            </div>

            <div style={{ background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '10px 14px', borderRadius: 8 }}>
              <span style={{ fontSize: '0.82rem', color: '#15803d', fontWeight: 600 }}>
                Computed Room Area: {unit === 'feet' ? `${(draftRoomWidth * draftRoomHeight).toFixed(1)} sq.ft` : `${(draftRoomWidth * draftRoomHeight).toFixed(2)} sq.m`}
              </span>
            </div>
          </div>
        </div>

        <div className="fp-calc-footer">
          <button
            type="button"
            className="btn btn-outline"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => onAddRoomByDimensions(draftRoomWidth, draftRoomHeight, draftRoomType, draftRoomFloorFinish)}
          >
            <Plus size={16} /> Place Room on Plan
          </button>
        </div>
      </div>
    </div>
  );
};
