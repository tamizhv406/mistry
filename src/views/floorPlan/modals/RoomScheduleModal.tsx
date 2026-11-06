import React from 'react';
import { Box, X, Plus, Trash2 } from 'lucide-react';
import type { FloorPlanRoom, FloorPlanUnit, RoomType } from '../../../db/types';
import { computeRoomArea } from '../utils';
import { ROOM_COLORS, ROOM_TYPES } from '../constants';

export interface RoomScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  rooms: FloorPlanRoom[];
  totalFloorArea: number;
  plotLength: number;
  plotWidth: number;
  unit: FloorPlanUnit;
  onUpdateRoom: (id: string, changes: Partial<FloorPlanRoom>) => void;
  onDeleteRoom: (id: string) => void;
  onFocusRoom: (room: FloorPlanRoom) => void;
  draftRoomType: RoomType;
  onDraftRoomTypeChange: (val: RoomType) => void;
  draftRoomWidth: number;
  onDraftRoomWidthChange: (val: number) => void;
  draftRoomHeight: number;
  onDraftRoomHeightChange: (val: number) => void;
  draftRoomFloorFinish: string;
  onDraftRoomFloorFinishChange: (val: string) => void;
  onAddRoomByDimensions: (w: number, h: number, type: RoomType, finish: string) => void;
}

export const RoomScheduleModal: React.FC<RoomScheduleModalProps> = ({
  isOpen,
  onClose,
  rooms,
  totalFloorArea,
  plotLength,
  plotWidth,
  unit,
  onUpdateRoom,
  onDeleteRoom,
  onFocusRoom,
  draftRoomType,
  onDraftRoomTypeChange,
  draftRoomWidth,
  onDraftRoomWidthChange,
  draftRoomHeight,
  onDraftRoomHeightChange,
  draftRoomFloorFinish,
  onDraftRoomFloorFinishChange,
  onAddRoomByDimensions,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fp-calc-modal" role="dialog" aria-modal="true">
      <div className="fp-calc-dialog" style={{ maxWidth: 760 }}>
        <div className="fp-calc-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: 'rgba(16, 185, 129, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Box size={20} color="#15803d" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a' }}>
                Floor Plan Room Schedule & Breakdown
              </h3>
              <span style={{ fontSize: '0.78rem', color: '#475569' }}>
                Total Rooms in Floor Plan: <strong style={{ color: '#15803d' }}>{rooms.length} Rooms</strong> • Total Built-up Area: <strong style={{ color: '#1e293b' }}>{totalFloorArea.toFixed(1)} {unit === 'feet' ? 'sq.ft' : 'sq.m'}</strong>
              </span>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </div>

        <div className="fp-calc-body" style={{ maxHeight: '72vh', overflowY: 'auto' }}>
          {/* Metric Stat Cards */}
          <div className="fp-room-stat-grid">
            <div className="fp-room-stat-card">
              <span className="fp-room-stat-num" style={{ color: '#15803d' }}>
                {rooms.length}
              </span>
              <span className="fp-room-stat-label">Total Rooms</span>
            </div>
            <div className="fp-room-stat-card">
              <span className="fp-room-stat-num" style={{ color: '#1e293b' }}>
                {totalFloorArea.toFixed(1)} <small style={{ fontSize: '0.75rem' }}>{unit === 'feet' ? 'sq.ft' : 'sq.m'}</small>
              </span>
              <span className="fp-room-stat-label">Total Built-up Area</span>
            </div>
            <div className="fp-room-stat-card">
              <span className="fp-room-stat-num" style={{ color: '#b45309' }}>
                {plotLength * plotWidth} <small style={{ fontSize: '0.75rem' }}>{unit === 'feet' ? 'sq.ft' : 'sq.m'}</small>
              </span>
              <span className="fp-room-stat-label">Plot Area</span>
            </div>
            <div className="fp-room-stat-card">
              <span className="fp-room-stat-num" style={{ color: '#6d28d9' }}>
                {((totalFloorArea / Math.max(1, plotLength * plotWidth)) * 100).toFixed(1)}%
              </span>
              <span className="fp-room-stat-label">Plot Coverage</span>
            </div>
          </div>

          {/* Rooms Schedule Table */}
          <div style={{ marginBottom: 16 }}>
            <h5 style={{ margin: '0 0 8px 0', color: '#475569', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              All Configured Rooms & Dimensions
            </h5>
            {rooms.length > 0 ? (
              <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: 10 }}>
                <table className="fp-room-table">
                  <thead>
                    <tr>
                      <th style={{ width: 36 }}>#</th>
                      <th>Room Name</th>
                      <th>Type</th>
                      <th>Width ({unit === 'feet' ? 'ft' : 'm'})</th>
                      <th>Height ({unit === 'feet' ? 'ft' : 'm'})</th>
                      <th>Area</th>
                      <th>Finish</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rooms.map((rm, idx) => (
                      <tr key={rm.id}>
                        <td style={{ color: '#64748b', fontWeight: 700 }}>{idx + 1}</td>
                        <td>
                          <input
                            type="text"
                            value={rm.label}
                            onChange={e => onUpdateRoom(rm.id, { label: e.target.value })}
                            style={{
                              background: '#ffffff',
                              border: '1px solid #e2e8f0',
                              borderRadius: 5,
                              color: '#0f172a',
                              padding: '4px 8px',
                              fontSize: '0.82rem',
                              fontWeight: 600,
                              width: 120,
                            }}
                          />
                        </td>
                        <td>
                          <select
                            value={rm.roomType}
                            onChange={e => {
                              const rt = e.target.value as RoomType;
                              onUpdateRoom(rm.id, { roomType: rt, color: ROOM_COLORS[rt] });
                            }}
                            style={{
                              background: '#ffffff',
                              border: '1px solid #e2e8f0',
                              borderRadius: 5,
                              color: '#0f172a',
                              padding: '4px 6px',
                              fontSize: '0.78rem',
                            }}
                          >
                            {ROOM_TYPES.map(rt => <option key={rt} value={rt}>{rt}</option>)}
                          </select>
                        </td>
                        <td>
                          <input
                            type="number"
                            step={0.5}
                            className="fp-room-table-input"
                            value={rm.width}
                            onChange={e => onUpdateRoom(rm.id, { width: parseFloat(e.target.value) || 1 })}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            step={0.5}
                            className="fp-room-table-input"
                            value={rm.height}
                            onChange={e => onUpdateRoom(rm.id, { height: parseFloat(e.target.value) || 1 })}
                          />
                        </td>
                        <td style={{ fontWeight: 700, color: '#15803d' }}>
                          {computeRoomArea(rm, unit)}
                        </td>
                        <td>
                          <button
                            type="button"
                            className="fp-stepper-btn"
                            style={{ width: 'auto', padding: '2px 8px', fontSize: '0.72rem' }}
                            onClick={() => {
                              const next = rm.floorFinish === 'Color Tint' ? 'Wood Parquet' : 'Color Tint';
                              onUpdateRoom(rm.id, { floorFinish: next });
                            }}
                            title="Toggle Floor Finish"
                          >
                            {rm.floorFinish === 'Color Tint' ? '🎨 Tint' : '🪵 Wood'}
                          </button>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                            <button
                              type="button"
                              className="btn btn-outline btn-sm"
                              style={{ padding: '3px 8px', fontSize: '0.72rem' }}
                              onClick={() => onFocusRoom(rm)}
                              title="Focus & Select on Canvas"
                            >
                              🎯 Focus
                            </button>
                            <button
                              type="button"
                              className="btn btn-danger btn-sm"
                              style={{ padding: '3px 8px', fontSize: '0.72rem' }}
                              onClick={() => onDeleteRoom(rm.id)}
                              title="Delete Room"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ padding: 30, textAlign: 'center', color: '#64748b', background: '#f8fafc', borderRadius: 8 }}>
                No rooms created in this floor plan yet. Use the form below to add your first room!
              </div>
            )}
          </div>

          {/* Quick Add Room by Height & Width Inputs */}
          <div style={{ padding: 16, background: '#f8fafc', border: '1.5px solid #cbd5e1', borderRadius: 12 }}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '0.9rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Plus size={16} color="#1e293b" /> Add Room with Exact Height & Width
            </h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', color: '#475569', marginBottom: 4 }}>Type of Room</label>
                <select
                  value={draftRoomType}
                  onChange={e => onDraftRoomTypeChange(e.target.value as RoomType)}
                  style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 6, color: '#0f172a', padding: '7px 10px', fontSize: '0.82rem' }}
                >
                  {ROOM_TYPES.map(rt => <option key={rt} value={rt}>{rt}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', color: '#475569', marginBottom: 4 }}>Width ({unit === 'feet' ? 'ft' : 'm'})</label>
                <input
                  type="number"
                  step={0.5}
                  value={draftRoomWidth}
                  onChange={e => onDraftRoomWidthChange(parseFloat(e.target.value) || 1)}
                  style={{ width: 85, background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 6, color: '#0f172a', padding: '7px 8px', fontSize: '0.82rem', fontWeight: 600 }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', color: '#475569', marginBottom: 4 }}>Height ({unit === 'feet' ? 'ft' : 'm'})</label>
                <input
                  type="number"
                  step={0.5}
                  value={draftRoomHeight}
                  onChange={e => onDraftRoomHeightChange(parseFloat(e.target.value) || 1)}
                  style={{ width: 85, background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 6, color: '#0f172a', padding: '7px 8px', fontSize: '0.82rem', fontWeight: 600 }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', color: '#475569', marginBottom: 4 }}>Floor Finish</label>
                <select
                  value={draftRoomFloorFinish}
                  onChange={e => onDraftRoomFloorFinishChange(e.target.value)}
                  style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 6, color: '#0f172a', padding: '7px 10px', fontSize: '0.82rem' }}
                >
                  <option value="Wood Parquet">🪵 Wood Floor Parquet</option>
                  <option value="Color Tint">🎨 Color Tint</option>
                </select>
              </div>
              <div>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => onAddRoomByDimensions(draftRoomWidth, draftRoomHeight, draftRoomType, draftRoomFloorFinish)}
                >
                  <Plus size={16} /> Place Room on Canvas
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="fp-calc-footer">
          <button
            type="button"
            className="btn btn-outline"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
