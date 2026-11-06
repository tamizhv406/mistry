import React from 'react';
import { RotateCw, Copy, FlipHorizontal, Trash2, Sliders, X } from 'lucide-react';
import type { SelectedElement } from '../types';
import type { FloorPlanDoor, FloorPlanFurniture, FloorPlanWindow } from '../../../db/types';

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
}) => {
  if (!selectedElement || !entity) return null;

  const isLocked = !!entity.locked;
  const isFeet = unit === 'feet';

  // Determine quick dimension presets
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
          <div className="fp-context-quick-pills">
            {presets.map((p) => {
              const active = Math.abs(furn.width - p.w) < 0.2 && Math.abs(furn.height - p.h) < 0.2;
              return (
                <button
                  key={p.label}
                  type="button"
                  className={`fp-quick-size-pill ${active ? 'active' : ''}`}
                  disabled={isLocked}
                  onClick={() => onQuickResize(p.w, p.h)}
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
              { label: "4-Seater (3'×4')", w: 3, h: 4 },
              { label: "6-Seater (3'×5.5')", w: 3, h: 5.5 },
              { label: "8-Seater (3.5'×7.5')", w: 3.5, h: 7.5 },
            ]
          : [
              { label: '4-Seater (0.9×1.2m)', w: 0.9, h: 1.2 },
              { label: '6-Seater (0.9×1.6m)', w: 0.9, h: 1.6 },
              { label: '8-Seater (1.1×2.3m)', w: 1.1, h: 2.3 },
            ];

        return (
          <div className="fp-context-quick-pills">
            {presets.map((p) => {
              const active = Math.abs(furn.width - p.w) < 0.2 && Math.abs(furn.height - p.h) < 0.2;
              return (
                <button
                  key={p.label}
                  type="button"
                  className={`fp-quick-size-pill ${active ? 'active' : ''}`}
                  disabled={isLocked}
                  onClick={() => onQuickResize(p.w, p.h)}
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
              { label: "1-Seater (3'×3')", w: 3, h: 3 },
              { label: "2-Seater (5'×3')", w: 5, h: 3 },
              { label: "3-Seater (7'×3')", w: 7, h: 3 },
            ]
          : [
              { label: '1-Seater (0.9×0.9m)', w: 0.9, h: 0.9 },
              { label: '2-Seater (1.5×0.9m)', w: 1.5, h: 0.9 },
              { label: '3-Seater (2.1×0.9m)', w: 2.1, h: 0.9 },
            ];

        return (
          <div className="fp-context-quick-pills">
            {presets.map((p) => {
              const active = Math.abs(furn.width - p.w) < 0.2 && Math.abs(furn.height - p.h) < 0.2;
              return (
                <button
                  key={p.label}
                  type="button"
                  className={`fp-quick-size-pill ${active ? 'active' : ''}`}
                  disabled={isLocked}
                  onClick={() => onQuickResize(p.w, p.h)}
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
        <div className="fp-context-quick-pills">
          {presets.map((p) => {
            const active = Math.abs(door.width - p.w) < 0.1;
            return (
              <button
                key={p.label}
                type="button"
                className={`fp-quick-size-pill ${active ? 'active' : ''}`}
                disabled={isLocked}
                onClick={() => onQuickResize(p.w)}
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
        <div className="fp-context-quick-pills">
          {presets.map((p) => {
            const active = Math.abs(win.width - p.w) < 0.1;
            return (
              <button
                key={p.label}
                type="button"
                className={`fp-quick-size-pill ${active ? 'active' : ''}`}
                disabled={isLocked}
                onClick={() => onQuickResize(p.w)}
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
    <div className="fp-mobile-context-bar no-print" role="toolbar" aria-label="Selected element actions">
      {/* Quick Dimension Selector Pills for Beds / Tables / Doors / Windows */}
      {renderQuickPills()}

      {/* Primary Floating Action Pill Toolbar */}
      <div className="fp-context-pill-row">
        <button
          type="button"
          className="fp-context-btn"
          disabled={isLocked}
          onClick={onRotate90}
          title="Rotate 90°"
        >
          <RotateCw size={15} />
          <span>Rotate</span>
        </button>

        <button
          type="button"
          className="fp-context-btn"
          disabled={isLocked}
          onClick={onDuplicate}
          title="Duplicate Element"
        >
          <Copy size={15} />
          <span>Duplicate</span>
        </button>

        <button
          type="button"
          className="fp-context-btn"
          disabled={isLocked}
          onClick={onFlipHorizontal}
          title="Flip Horizontal"
        >
          <FlipHorizontal size={15} />
          <span>Flip</span>
        </button>

        <button
          type="button"
          className="fp-context-btn danger"
          disabled={isLocked}
          onClick={onDelete}
          title="Delete Element"
        >
          <Trash2 size={15} />
          <span>Delete</span>
        </button>

        <button
          type="button"
          className="fp-context-btn"
          onClick={onToggleMore}
          title="Properties & Fine Tuning"
        >
          <Sliders size={15} />
          <span>More</span>
        </button>

        <button
          type="button"
          className="fp-context-btn"
          onClick={onDeselect}
          title="Deselect"
          style={{ padding: '0 8px' }}
        >
          <X size={15} />
        </button>
      </div>
    </div>
  );
};
