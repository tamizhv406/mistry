import React, { useState } from 'react';
import {
  RotateCw,
  Copy,
  FlipHorizontal,
  FlipVertical,
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
  Lock,
  Unlock,
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
  onFlipVertical?: () => void;
  onDelete: () => void;
  onDeselect: () => void;
  onToggleLock?: () => void;
  onToggleMore: () => void;
  onQuickResize: (width: number, height?: number) => void;
  onOpenExactDimension?: () => void;
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
  onFlipVertical,
  onDelete,
  onDeselect,
  onToggleLock,
  onToggleMore,
  onQuickResize,
  onOpenExactDimension,
  onNudge,
  onStepDimension,
}) => {
  const [showSteppers, setShowSteppers] = useState(false);

  if (!selectedElement || !entity) return null;

  const isLocked = !!entity.locked;
  const isFeet = unit === 'feet';
  const unitLabel = isFeet ? 'ft' : 'm';

  // Compute title, current dimensions & angle
  const getItemDetails = () => {
    let title = 'Element';
    let widthVal = 0;
    let heightVal = 0;
    let angleVal = 0;
    let hasHeight = false;

    if (selectedElement.type === 'furniture') {
      const furn = entity as FloorPlanFurniture;
      title = furn.label || furn.itemType || 'Furniture';
      widthVal = Number(furn.width || 0);
      heightVal = Number(furn.height || 0);
      angleVal = Math.round(furn.rotation || 0) % 360;
      hasHeight = true;
    } else if (selectedElement.type === 'door') {
      const door = entity as FloorPlanDoor;
      title = door.doorType || 'Door';
      widthVal = Number(door.width || 0);
      angleVal = Math.round(door.rotation || 0) % 360;
      hasHeight = false;
    } else if (selectedElement.type === 'window') {
      const win = entity as FloorPlanWindow;
      title = win.windowType || 'Window';
      widthVal = Number(win.width || 0);
      angleVal = Math.round(win.rotation || 0) % 360;
      hasHeight = false;
    } else if ((selectedElement as any).type === 'wall') {
      const wall = entity as any;
      const x1 = wall.x1 ?? wall.start?.x ?? 0;
      const y1 = wall.y1 ?? wall.start?.y ?? 0;
      const x2 = wall.x2 ?? wall.end?.x ?? 0;
      const y2 = wall.y2 ?? wall.end?.y ?? 0;
      widthVal = Math.hypot(x2 - x1, y2 - y1);
      angleVal = Math.round((Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI + 360) % 360;
      title = wall.wallType === 'exterior' || wall.isExterior ? 'Exterior Wall' : 'Interior Wall';
      hasHeight = false;
    } else if ((selectedElement as any).type === 'column') {
      const col = entity as any;
      title = 'Column';
      widthVal = Number(col.width || col.diameter || 1);
      heightVal = Number(col.depth || col.diameter || 1);
      hasHeight = true;
    }

    return {
      title,
      widthVal,
      heightVal,
      angleVal,
      hasHeight,
      widthStr: `${widthVal.toFixed(1)} ${unitLabel}`,
      heightStr: `${heightVal.toFixed(1)} ${unitLabel}`,
      angleStr: `${angleVal}°`,
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
          <div className="fp-context-quick-pills" style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '2px' }}>
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
          <div className="fp-context-quick-pills" style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '2px' }}>
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
          <div className="fp-context-quick-pills" style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '2px' }}>
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
        <div className="fp-context-quick-pills" style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '2px' }}>
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
            { label: "3'0\" Window", w: 3.0 },
            { label: "4'0\" Window", w: 4.0 },
            { label: "5'0\" Window", w: 5.0 },
            { label: "6'0\" Sliding", w: 6.0 },
          ]
        : [
            { label: '0.9m Window', w: 0.9 },
            { label: '1.2m Window', w: 1.2 },
            { label: '1.5m Window', w: 1.5 },
            { label: '1.8m Sliding', w: 1.8 },
          ];

      return (
        <div className="fp-context-quick-pills" style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '2px' }}>
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
      className="fp-mobile-context-bar"
      role="toolbar"
      aria-label="Element Transform Context Bar"
      style={{
        position: 'fixed',
        bottom: '80px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1000,
        width: 'calc(100% - 20px)',
        maxWidth: '490px',
        backgroundColor: 'rgba(255, 255, 255, 0.98)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1.5px solid #cbd5e1',
        borderRadius: '16px',
        boxShadow: '0 12px 32px -4px rgba(15, 23, 42, 0.22), 0 4px 12px rgba(15, 23, 42, 0.08)',
        padding: '8px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        touchAction: 'none',
      }}
    >
      {/* 1. Top Dimension Chips Bar: [ Width ] [ Length ] [ Angle ] + Done Button */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', borderBottom: '1px solid #f1f5f9', paddingBottom: '6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', minWidth: 0, overflowX: 'auto' }}>
          <span style={{ fontWeight: 800, fontSize: '0.82rem', color: '#0f172a', whiteSpace: 'nowrap', marginRight: '2px' }}>
            {details.title}
          </span>

          {/* Width Chip */}
          <button
            type="button"
            onClick={() => {
              if (onOpenExactDimension) onOpenExactDimension();
              else setShowSteppers(s => !s);
            }}
            title="Width dimension (Tap to type exact size in ft/in)"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '3px',
              fontSize: '0.72rem',
              fontWeight: 700,
              color: '#0369a1',
              backgroundColor: '#e0f2fe',
              padding: '2px 7px',
              borderRadius: '8px',
              border: '1px solid #bae6fd',
              whiteSpace: 'nowrap',
              cursor: 'pointer',
            }}
          >
            <span style={{ color: '#0284c7', fontWeight: 800 }}>W:</span>
            <span>{details.widthStr}</span>
          </button>

          {/* Length / Depth Chip */}
          {details.hasHeight && (
            <button
              type="button"
              onClick={() => {
                if (onOpenExactDimension) onOpenExactDimension();
                else setShowSteppers(s => !s);
              }}
              title="Length dimension (Tap to type exact size in ft/in)"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
                fontSize: '0.72rem',
                fontWeight: 700,
                color: '#0369a1',
                backgroundColor: '#e0f2fe',
                padding: '2px 7px',
                borderRadius: '8px',
                border: '1px solid #bae6fd',
                whiteSpace: 'nowrap',
                cursor: 'pointer',
              }}
            >
              <span style={{ color: '#0284c7', fontWeight: 800 }}>L:</span>
              <span>{details.heightStr}</span>
            </button>
          )}

          {/* Direct Feet/Inches Keypad Trigger Button */}
          {onOpenExactDimension && (
            <button
              type="button"
              onClick={onOpenExactDimension}
              title="Type exact feet and inches (நேரடி அடி/இன்ச் அளவு)"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '2px',
                fontSize: '0.70rem',
                fontWeight: 800,
                color: '#0284c7',
                backgroundColor: '#ffffff',
                padding: '2px 6px',
                borderRadius: '8px',
                border: '1.5px dashed #0284c7',
                whiteSpace: 'nowrap',
                cursor: 'pointer',
              }}
            >
              <span>⌨️ Size</span>
            </button>
          )}

          {/* Angle Chip */}
          <button
            type="button"
            onClick={onRotate90}
            title="Rotation Angle (Tap to rotate 90°)"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '3px',
              fontSize: '0.72rem',
              fontWeight: 700,
              color: '#475569',
              backgroundColor: '#f1f5f9',
              padding: '2px 7px',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              whiteSpace: 'nowrap',
              cursor: 'pointer',
            }}
          >
            <span style={{ color: '#64748b' }}>∠</span>
            <span>{details.angleStr}</span>
          </button>
        </div>

        {/* Done / Deselect Button */}
        <button
          type="button"
          onClick={onDeselect}
          title="Done (Deselect)"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '3px',
            padding: '3px 9px',
            borderRadius: '8px',
            border: '1px solid #cbd5e1',
            backgroundColor: '#f8fafc',
            color: '#334155',
            fontSize: '0.72rem',
            fontWeight: 700,
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          <Check size={13} color="#16a34a" />
          <span>Done</span>
        </button>
      </div>

      {/* 2. Optional Stepper and Nudge Panel (Collapsible or visible) */}
      {showSteppers && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', flexWrap: 'wrap', backgroundColor: '#f8fafc', padding: '6px 8px', borderRadius: '10px' }}>
          {/* Nudge D-Pad */}
          {onNudge && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
              <span style={{ fontSize: '0.66rem', fontWeight: 700, color: '#64748b', marginRight: '2px' }}>
                Nudge
              </span>
              <button
                type="button"
                disabled={isLocked}
                onClick={() => onNudge(-1, 0)}
                title="Nudge Left"
                style={{ width: '26px', height: '26px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff', cursor: 'pointer' }}
              >
                <ArrowLeft size={13} />
              </button>
              <button
                type="button"
                disabled={isLocked}
                onClick={() => onNudge(0, -1)}
                title="Nudge Up"
                style={{ width: '26px', height: '26px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff', cursor: 'pointer' }}
              >
                <ArrowUp size={13} />
              </button>
              <button
                type="button"
                disabled={isLocked}
                onClick={() => onNudge(0, 1)}
                title="Nudge Down"
                style={{ width: '26px', height: '26px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff', cursor: 'pointer' }}
              >
                <ArrowDown size={13} />
              </button>
              <button
                type="button"
                disabled={isLocked}
                onClick={() => onNudge(1, 0)}
                title="Nudge Right"
                style={{ width: '26px', height: '26px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff', cursor: 'pointer' }}
              >
                <ArrowRight size={13} />
              </button>
            </div>
          )}

          {/* Steppers */}
          {onStepDimension && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                <span style={{ fontSize: '0.66rem', fontWeight: 800, color: '#475569' }}>W</span>
                <button
                  type="button"
                  disabled={isLocked}
                  onClick={() => onStepDimension('width', -1)}
                  style={{ width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '5px', border: '1px solid #cbd5e1', background: '#ffffff', cursor: 'pointer' }}
                >
                  <Minus size={11} />
                </button>
                <button
                  type="button"
                  disabled={isLocked}
                  onClick={() => onStepDimension('width', 1)}
                  style={{ width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '5px', border: '1px solid #cbd5e1', background: '#ffffff', cursor: 'pointer' }}
                >
                  <Plus size={11} />
                </button>
              </div>

              {details.hasHeight && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                  <span style={{ fontSize: '0.66rem', fontWeight: 800, color: '#475569' }}>L</span>
                  <button
                    type="button"
                    disabled={isLocked}
                    onClick={() => onStepDimension('height', -1)}
                    style={{ width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '5px', border: '1px solid #cbd5e1', background: '#ffffff', cursor: 'pointer' }}
                  >
                    <Minus size={11} />
                  </button>
                  <button
                    type="button"
                    disabled={isLocked}
                    onClick={() => onStepDimension('height', 1)}
                    style={{ width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '5px', border: '1px solid #cbd5e1', background: '#ffffff', cursor: 'pointer' }}
                  >
                    <Plus size={11} />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 3. Quick Size Preset Pills */}
      {renderQuickPills()}

      {/* 4. Quick Action Buttons Row: [ Duplicate ] [ Flip H/V ] [ Lock ] [ Delete ] [ More ] */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '5px', paddingTop: '1px' }}>
        {/* Duplicate */}
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
            gap: '3px',
            padding: '6px 2px',
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            backgroundColor: '#ffffff',
            color: '#1e293b',
            fontSize: '0.72rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          <Copy size={13} />
          <span>Copy</span>
        </button>

        {/* Flip H/V */}
        <button
          type="button"
          disabled={isLocked}
          onClick={onFlipHorizontal}
          title="Flip Horizontal (Mirror)"
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '3px',
            padding: '6px 2px',
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            backgroundColor: '#ffffff',
            color: '#1e293b',
            fontSize: '0.72rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          <FlipHorizontal size={13} />
          <span>Flip</span>
        </button>

        {/* Flip Vertical if provided */}
        {onFlipVertical && (
          <button
            type="button"
            disabled={isLocked}
            onClick={onFlipVertical}
            title="Flip Vertical"
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '3px',
              padding: '6px 2px',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              backgroundColor: '#ffffff',
              color: '#1e293b',
              fontSize: '0.72rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <FlipVertical size={13} />
            <span>Flip V</span>
          </button>
        )}

        {/* Lock / Unlock */}
        {onToggleLock && (
          <button
            type="button"
            onClick={onToggleLock}
            title={isLocked ? 'Unlock Element' : 'Lock Element'}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '3px',
              padding: '6px 2px',
              borderRadius: '8px',
              border: isLocked ? '1px solid #fde68a' : '1px solid #e2e8f0',
              backgroundColor: isLocked ? '#fef3c7' : '#ffffff',
              color: isLocked ? '#d97706' : '#1e293b',
              fontSize: '0.72rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {isLocked ? <Unlock size={13} /> : <Lock size={13} />}
            <span>{isLocked ? 'Unlock' : 'Lock'}</span>
          </button>
        )}

        {/* Delete */}
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
            gap: '3px',
            padding: '6px 2px',
            borderRadius: '8px',
            border: '1px solid #fee2e2',
            backgroundColor: '#fef2f2',
            color: '#dc2626',
            fontSize: '0.72rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          <Trash2 size={13} />
          <span>Delete</span>
        </button>

        {/* More */}
        <button
          type="button"
          onClick={onToggleMore}
          title="Properties & Fine Tuning"
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '3px',
            padding: '6px 2px',
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            backgroundColor: '#ffffff',
            color: '#475569',
            fontSize: '0.72rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          <Sliders size={13} />
          <span>More</span>
        </button>
      </div>
    </div>
  );
};
