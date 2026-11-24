import React from 'react';
import { Link2, Unlink2, RotateCw, Trash2, X, Layers, Boxes } from 'lucide-react';

export interface SideGroupToolbarProps {
  selectedCount: number;
  hasGroupedItems: boolean;
  onGroup: () => void;
  onUngroup: () => void;
  onDeselect: () => void;
  onRotateGroup?: () => void;
  onDeleteGroup?: () => void;
}

export const SideGroupToolbar: React.FC<SideGroupToolbarProps> = ({
  selectedCount,
  hasGroupedItems,
  onGroup,
  onUngroup,
  onDeselect,
  onRotateGroup,
  onDeleteGroup,
}) => {
  if (selectedCount <= 0) return null;

  return (
    <div
      className="fp-side-group-toolbar no-print"
      role="toolbar"
      aria-label="Group and ungroup elements"
      style={{
        position: 'fixed',
        right: '24px',
        top: '50%',
        transform: 'translateY(-50%)',
        zIndex: 1000,
        backgroundColor: 'rgba(15, 23, 42, 0.96)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1.5px solid #334155',
        borderRadius: '14px',
        boxShadow: '0 20px 35px -5px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.05)',
        padding: '14px 16px',
        color: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        minWidth: '210px',
        maxWidth: '260px',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #334155', paddingBottom: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '28px', height: '28px', borderRadius: '8px', backgroundColor: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Layers size={16} color="#ffffff" />
          </div>
          <div>
            <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#f8fafc', lineHeight: 1.2 }}>
              {selectedCount} Items Selected
            </div>
            <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
              குழு தேர்வு
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onDeselect}
          title="Deselect All (Esc)"
          aria-label="Deselect All"
          style={{
            background: 'none',
            border: 'none',
            color: '#94a3b8',
            cursor: 'pointer',
            padding: '4px',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <X size={16} />
        </button>
      </div>

      {/* Primary Action Buttons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {/* Group Button */}
        <button
          type="button"
          onClick={onGroup}
          disabled={selectedCount < 2}
          title="Group selected items (🔗 ஒன்றாக்குக)"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '9px 12px',
            borderRadius: '10px',
            border: 'none',
            backgroundColor: selectedCount >= 2 ? '#0284c7' : '#334155',
            color: selectedCount >= 2 ? '#ffffff' : '#64748b',
            fontSize: '0.82rem',
            fontWeight: 700,
            cursor: selectedCount >= 2 ? 'pointer' : 'not-allowed',
            transition: 'background-color 0.15s ease',
            boxShadow: selectedCount >= 2 ? '0 2px 6px rgba(2, 132, 199, 0.3)' : 'none',
          }}
        >
          <Link2 size={16} />
          <span>Group (🔗 ஒன்றாக்குக)</span>
        </button>

        {/* Ungroup Button */}
        <button
          type="button"
          onClick={onUngroup}
          disabled={!hasGroupedItems}
          title="Ungroup items (🔓 பிரிக்க)"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '9px 12px',
            borderRadius: '10px',
            border: hasGroupedItems ? '1px solid #d97706' : '1px solid #334155',
            backgroundColor: hasGroupedItems ? '#78350f' : '#1e293b',
            color: hasGroupedItems ? '#fef3c7' : '#64748b',
            fontSize: '0.82rem',
            fontWeight: 700,
            cursor: hasGroupedItems ? 'pointer' : 'not-allowed',
            transition: 'background-color 0.15s ease',
          }}
        >
          <Unlink2 size={16} />
          <span>Ungroup (🔓 பிரிக்க)</span>
        </button>
      </div>

      {/* Secondary Actions: Rotate & Delete */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', paddingTop: '4px', borderTop: '1px solid #1e293b' }}>
        {onRotateGroup && (
          <button
            type="button"
            onClick={onRotateGroup}
            title="Rotate Group 90°"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              padding: '7px 8px',
              borderRadius: '8px',
              border: '1px solid #334155',
              backgroundColor: '#1e293b',
              color: '#f8fafc',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <RotateCw size={13} />
            <span>Rotate</span>
          </button>
        )}

        {onDeleteGroup && (
          <button
            type="button"
            onClick={onDeleteGroup}
            title="Delete Group"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              padding: '7px 8px',
              borderRadius: '8px',
              border: '1px solid #7f1d1d',
              backgroundColor: '#450a0a',
              color: '#fca5a5',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <Trash2 size={13} />
            <span>Delete</span>
          </button>
        )}
      </div>
    </div>
  );
};
