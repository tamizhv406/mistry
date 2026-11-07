import React from 'react';
import {
  RotateCw,
  Copy,
  FlipHorizontal,
  Trash2,
  Sliders,
  X,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Plus,
  Minus,
  Check,
} from 'lucide-react';
import type { SelectedElement } from '../types';
import type { FloorPlanDoor, FloorPlanFurniture, FloorPlanWindow, FloorPlanWall } from '../../../db/types';

export interface MobileContextBarProps {
  selectedElement: SelectedElement;
  entity: any;
  unit: string;
  onRotate90: () => void;
  onDuplicate: () => void;
  onFlipHorizontal: () => void;
  onDelete: () => void;
  onDeselect: () => void;
  onToggleMore: () => void;
  onQuickResize: (width: number, height?: number) => void;
  onNudge?: (dx: number, dy: number) => void;
  onStepDimension?: (dimension: 'width' | 'height', delta: number) => void;
}

export const MobileContextBar: React.FC<MobileContextBarProps> = ({
  selectedElement,
  entity,
  unit,
  onRotate90,
  onDuplicate,
  onFlipHorizontal,
  onDelete,
  onDeselect,
  onToggleMore,
  onQuickResize,
  onNudge,
  onStepDimension,
}) => {
  if (!selectedElement || !entity) return null;

  const isLocked = !!entity.locked;
  const isFeet = unit === 'feet';
  const unitLabel = isFeet ? 'ft' : 'm';

  // Compute title & current dimensions
  const getItemDetails = () => {
    if (selectedElement.type === 'furniture') {
      const furn = entity as FloorPlanFurniture;
      const name = furn.label || furn.itemType || 'Furniture';
      const w = Number(furn.width || 0).toFixed(1);
      const h = Number(furn.height || 0).toFixed(1);
      return {
        title: name,
        dimensions: `${w} × ${h} ${unitLabel}`,
        hasHeight: true,
      };
    }
    if (selectedElement.type === 'door') {
      const door = entity as FloorPlanDoor;
      const name = door.doorType || 'Door';
      const w = Number(door.width || 0).toFixed(1);
      return {
        title: name,
        dimensions: `${w} ${unitLabel}`,
        hasHeight: false,
      };
    }
    if (selectedElement.type === 'window') {
      const win = entity as FloorPlanWindow;
      const name = win.windowType || 'Window';
      const w = Number(win.width || 0).toFixed(1);
      return {
        title: name,
        dimensions: `${w} ${unitLabel}`,
        hasHeight: false,
      };
    }
    if ((selectedElement as any).type === 'wall') {
      const wall = entity as any;
      const x1 = wall.x1 ?? wall.start?.x ?? 0;
      const y1 = wall.y1 ?? wall.start?.y ?? 0;
      const x2 = wall.x2 ?? wall.end?.x ?? 0;
      const y2 = wall.y2 ?? wall.end?.y ?? 0;
      const len = Math.hypot(x2 - x1, y2 - y1);
      return {
        title: wall.wallType === 'exterior' || wall.isExterior ? 'Exterior Wall' : 'Interior Wall',
        dimensions: `${len.toFixed(1)} ${unitLabel}`,
        hasHeight: false,
      };
    }
    return {
      title: 'Element',
      dimensions: '',
      hasHeight: false,
    };
  };

  const details = getItemDetails();

  // Quick dimension presets
  const renderQuickPills = () => {
    if (selectedElement.type === 'furniture') {
      const furn = entity as FloorPlanFurniture;
      const itemType = (furn.itemType || '').toLowerCase();

      // Beds
      if (itemType.includes('bed')) {
        const presets = isFeet
          ? [
              { label: "Single (3'×6')", w: 3, h: 6 },
              { label: "Queen (5'×6.5')", w: 5, h: 6.5 },
              { label: "King (6'×6.5')", w: 6, h: 6.5 },
            ]
          : [
              { label: 'Single (0.9×1.9m)', w: 0.9, h: 1.9 },
              { label: 'Queen (1.5×2.0m)', w: 1.5, h: 2.0 },
              { label: 'King (1.8×2.0m)', w: 1.8, h: 2.0 },
            ];

        return (
          <div className="fp-context-quick-pills" style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px' }}>
            {presets.map((p) => {
              const active = Math.abs(furn.width - p.w) < 0.2 && Math.abs(furn.height - p.h) < 0.2;
              return (
                <button
                  key={p.label}
                  type="button"
                  className={`fp-quick-size-pill ${active ? 'active' : ''}`}
                  disabled={isLocked}
                  onClick={() => onQuickResize(p.w, p.h)}
                  style={{
                    padding: '3px 8px',
                    borderRadius: '12px',
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    border: active ? '1.5px solid #0284c7' : '1px solid #cbd5e1',
                    background: active ? '#0284c7' : '#f8fafc',
                    color: active ? '#ffffff' : '#334155',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        );
      }

      // Dining Tables / Tables
      if (itemType.includes('dining') || itemType.includes('table') || itemType.includes('desk')) {
        const presets = isFeet
          ? [
              { label: "4-Seat (3'×4')", w: 3, h: 4 },
              { label: "6-Seat (3'×5.5')", w: 3, h: 5.5 },
              { label: "8-Seat (3.5'×7.5')", w: 3.5, h: 7.5 },
            ]
          : [
              { label: '4-Seat (0.9×1.2m)', w: 0.9, h: 1.2 },
              { label: '6-Seat (0.9×1.6m)', w: 0.9, h: 1.6 },
              { label: '8-Seat (1.1×2.3m)', w: 1.1, h: 2.3 },
            ];

        return (
          <div className="fp-context-quick-pills" style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px' }}>
            {presets.map((p) => {
              const active = Math.abs(furn.width - p.w) < 0.2 && Math.abs(furn.height - p.h) < 0.2;
              return (
                <button
                  key={p.label}
                  type="button"
                  className={`fp-quick-size-pill ${active ? 'active' : ''}`}
                  disabled={isLocked}
                  onClick={() => onQuickResize(p.w, p.h)}
                  style={{
                    padding: '3px 8px',
                    borderRadius: '12px',
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    border: active ? '1.5px solid #0284c7' : '1px solid #cbd5e1',
                    background: active ? '#0284c7' : '#f8fafc',
                    color: active ? '#ffffff' : '#334155',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        );
      }

      // Sofas
      if (itemType.includes('sofa') || itemType.includes('couch')) {
        const presets = isFeet
          ? [
              { label: "1-Seat (3'×3')", w: 3, h: 3 },
              { label: "2-Seat (5'×3')", w: 5, h: 3 },
              { label: "3-Seat (7'×3')", w: 7, h: 3 },
            ]
          : [
              { label: '1-Seat (0.9×0.9m)', w: 0.9, h: 0.9 },
              { label: '2-Seat (1.5×0.9m)', w: 1.5, h: 0.9 },
              { label: '3-Seat (2.1×0.9m)', w: 2.1, h: 0.9 },
            ];

        return (
          <div className="fp-context-quick-pills" style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px' }}>
            {presets.map((p) => {
              const active = Math.abs(furn.width - p.w) < 0.2 && Math.abs(furn.height - p.h) < 0.2;
              return (
                <button
                  key={p.label}
                  type="button"
                  className={`fp-quick-size-pill ${active ? 'active' : ''}`}
                  disabled={isLocked}
                  onClick={() => onQuickResize(p.w, p.h)}
                  style={{
                    padding: '3px 8px',
                    borderRadius: '12px',
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    border: active ? '1.5px solid #0284c7' : '1px solid #cbd5e1',
                    background: active ? '#0284c7' : '#f8fafc',
                    color: active ? '#ffffff' : '#334155',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        );
      }
    }

    if (selectedElement.type === 'door') {
      const door = entity as FloorPlanDoor;
      const presets = isFeet
        ? [
            { label: "2'6\" (Bath)", w: 2.5 },
            { label: "3'0\" (Bed)", w: 3.0 },
            { label: "3'6\" (Main)", w: 3.5 },
          ]
        : [
            { label: '0.75m (Bath)', w: 0.75 },
            { label: '0.9m (Bed)', w: 0.9 },
            { label: '1.05m (Main)', w: 1.05 },
          ];

      return (
        <div className="fp-context-quick-pills" style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px' }}>
          {presets.map((p) => {
            const active = Math.abs(door.width - p.w) < 0.1;
            return (
              <button
                key={p.label}
                type="button"
                className={`fp-quick-size-pill ${active ? 'active' : ''}`}
                disabled={isLocked}
                onClick={() => onQuickResize(p.w)}
                style={{
                  padding: '3px 8px',
                  borderRadius: '12px',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  border: active ? '1.5px solid #0284c7' : '1px solid #cbd5e1',
                  background: active ? '#0284c7' : '#f8fafc',
                  color: active ? '#ffffff' : '#334155',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      );
    }

    if (selectedElement.type === 'window') {
      const win = entity as FloorPlanWindow;
      const presets = isFeet
        ? [
            { label: "3'0\"", w: 3.0 },
            { label: "4'0\"", w: 4.0 },
            { label: "5'0\"", w: 5.0 },
          ]
        : [
            { label: '0.9m', w: 0.9 },
            { label: '1.2m', w: 1.2 },
            { label: '1.5m', w: 1.5 },
          ];

      return (
        <div className="fp-context-quick-pills" style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px' }}>
          {presets.map((p) => {
            const active = Math.abs(win.width - p.w) < 0.1;
            return (
              <button
                key={p.label}
                type="button"
                className={`fp-quick-size-pill ${active ? 'active' : ''}`}
                disabled={isLocked}
                onClick={() => onQuickResize(p.w)}
                style={{
                  padding: '3px 8px',
                  borderRadius: '12px',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  border: active ? '1.5px solid #0284c7' : '1px solid #cbd5e1',
                  background: active ? '#0284c7' : '#f8fafc',
                  color: active ? '#ffffff' : '#334155',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      );
    }

    return null;
  };

  return (
    <div
      className="fp-mobile-context-bar no-print"
      role="toolbar"
      aria-label="Selected element actions"
      style={{
        position: 'fixed',
        bottom: '12px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1000,
        width: 'calc(100% - 24px)',
        maxWidth: '480px',
        backgroundColor: 'rgba(255, 255, 255, 0.98)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1.5px solid #cbd5e1',
        borderRadius: '16px',
        boxShadow: '0 12px 30px -4px rgba(15, 23, 42, 0.18), 0 4px 12px rgba(15, 23, 42, 0.08)',
        padding: '10px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}
    >
      {/* 1. Header: Item Name, Current Dimensions, and Done/Deselect */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', borderBottom: '1px solid #f1f5f9', paddingBottom: '6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
          <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {details.title}
          </span>
          {details.dimensions && (
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#0284c7', backgroundColor: '#e0f2fe', padding: '1px 7px', borderRadius: '8px', whiteSpace: 'nowrap' }}>
              {details.dimensions}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onDeselect}
          title="Done (Deselect)"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '3px',
            padding: '4px 10px',
            borderRadius: '8px',
            border: '1px solid #cbd5e1',
            backgroundColor: '#f8fafc',
            color: '#334155',
            fontSize: '0.75rem',
            fontWeight: 700,
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          <Check size={14} color="#16a34a" />
          <span>Done</span>
        </button>
      </div>

      {/* 2. Directional Nudges & Dimension Steppers Row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
        {/* Nudge D-Pad: [ ⬅️ ] [ ⬆️ ] [ ⬇️ ] [ ➡️ ] */}
        {onNudge && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: '#f1f5f9', padding: '3px 6px', borderRadius: '10px' }}>
            <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748b', marginRight: '2px' }}>
              Nudge ({isFeet ? '0.5\'' : '0.15m'})
            </span>
            <button
              type="button"
              disabled={isLocked}
              onClick={() => onNudge(-1, 0)}
              title="Nudge Left"
              style={{ width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff', cursor: 'pointer', color: '#1e293b' }}
            >
              <ArrowLeft size={14} />
            </button>
            <button
              type="button"
              disabled={isLocked}
              onClick={() => onNudge(0, -1)}
              title="Nudge Up"
              style={{ width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff', cursor: 'pointer', color: '#1e293b' }}
            >
              <ArrowUp size={14} />
            </button>
            <button
              type="button"
              disabled={isLocked}
              onClick={() => onNudge(0, 1)}
              title="Nudge Down"
              style={{ width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff', cursor: 'pointer', color: '#1e293b' }}
            >
              <ArrowDown size={14} />
            </button>
            <button
              type="button"
              disabled={isLocked}
              onClick={() => onNudge(1, 0)}
              title="Nudge Right"
              style={{ width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff', cursor: 'pointer', color: '#1e293b' }}
            >
              <ArrowRight size={14} />
            </button>
          </div>
        )}

        {/* Dimension Steppers: Width [ - ] [ + ] and Length [ - ] [ + ] */}
        {onStepDimension && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {/* Width Stepper */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '3px', backgroundColor: '#f1f5f9', padding: '3px 6px', borderRadius: '10px' }}>
              <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#475569' }}>W</span>
              <button
                type="button"
                disabled={isLocked}
                onClick={() => onStepDimension('width', -1)}
                title="Decrease Width"
                style={{ width: '26px', height: '26px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff', cursor: 'pointer', color: '#1e293b' }}
              >
                <Minus size={12} />
              </button>
              <button
                type="button"
                disabled={isLocked}
                onClick={() => onStepDimension('width', 1)}
                title="Increase Width"
                style={{ width: '26px', height: '26px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff', cursor: 'pointer', color: '#1e293b' }}
              >
                <Plus size={12} />
              </button>
            </div>

            {/* Length/Height Stepper */}
            {details.hasHeight && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '3px', backgroundColor: '#f1f5f9', padding: '3px 6px', borderRadius: '10px' }}>
                <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#475569' }}>L</span>
                <button
                  type="button"
                  disabled={isLocked}
                  onClick={() => onStepDimension('height', -1)}
                  title="Decrease Length"
                  style={{ width: '26px', height: '26px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff', cursor: 'pointer', color: '#1e293b' }}
                >
                  <Minus size={12} />
                </button>
                <button
                  type="button"
                  disabled={isLocked}
                  onClick={() => onStepDimension('height', 1)}
                  title="Increase Length"
                  style={{ width: '26px', height: '26px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff', cursor: 'pointer', color: '#1e293b' }}
                >
                  <Plus size={12} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3. Quick Size Preset Pills (Beds, Tables, Sofas, Doors, Windows) */}
      {renderQuickPills()}

      {/* 4. Action Buttons Row: Rotate, Flip, Duplicate, Delete, More */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', paddingTop: '2px' }}>
        <button
          type="button"
          disabled={isLocked}
          onClick={onRotate90}
          title="Rotate 90°"
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
            padding: '6px 4px',
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            backgroundColor: '#ffffff',
            color: '#1e293b',
            fontSize: '0.75rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          <RotateCw size={14} />
          <span>Rotate</span>
        </button>

        <button
          type="button"
          disabled={isLocked}
          onClick={onFlipHorizontal}
          title="Flip Horizontal"
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
            padding: '6px 4px',
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            backgroundColor: '#ffffff',
            color: '#1e293b',
            fontSize: '0.75rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          <FlipHorizontal size={14} />
          <span>Flip</span>
        </button>

        <button
          type="button"
          disabled={isLocked}
          onClick={onDuplicate}
          title="Duplicate Element"
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
            padding: '6px 4px',
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            backgroundColor: '#ffffff',
            color: '#1e293b',
            fontSize: '0.75rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          <Copy size={14} />
          <span>Copy</span>
        </button>

        <button
          type="button"
          disabled={isLocked}
          onClick={onDelete}
          title="Delete Element"
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
            padding: '6px 4px',
            borderRadius: '8px',
            border: '1px solid #fee2e2',
            backgroundColor: '#fef2f2',
            color: '#dc2626',
            fontSize: '0.75rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          <Trash2 size={14} />
          <span>Delete</span>
        </button>

        <button
          type="button"
          onClick={onToggleMore}
          title="Properties & Fine Tuning"
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
            padding: '6px 4px',
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            backgroundColor: '#ffffff',
            color: '#475569',
            fontSize: '0.75rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          <Sliders size={14} />
          <span>More</span>
        </button>
      </div>
    </div>
  );
};
