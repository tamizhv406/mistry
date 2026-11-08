import React, { useState, useEffect } from 'react';
import { X, Check, Delete, ArrowRight, Sparkles, Ruler } from 'lucide-react';
import type { SelectedElement } from '../types';
import type { FloorPlanDoor, FloorPlanFurniture, FloorPlanWindow, FloorPlanWall, FloorPlanRoom } from '../../../db/types';

export interface QuickDimensionModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedElement: SelectedElement | null;
  entity: any;
  unit: string;
  onApply: (width: number, height?: number) => void;
}

/**
 * Universal Mobile Direct Feet & Inches Numeric Keypad
 * Allows typing exact architectural measurements like "10ft 6in" × "12ft 0in"
 * seamlessly without relying solely on small +/- 1m stepper buttons.
 */
export const QuickDimensionModal: React.FC<QuickDimensionModalProps> = ({
  isOpen,
  onClose,
  selectedElement,
  entity,
  unit,
  onApply,
}) => {
  const isFeet = unit === 'feet';

  // Active target field: 'width' or 'height'
  const [activeField, setActiveField] = useState<'width' | 'height'>('width');

  // Input states
  const [widthFeet, setWidthFeet] = useState<string>('10');
  const [widthInches, setWidthInches] = useState<string>('0');
  const [heightFeet, setHeightFeet] = useState<string>('10');
  const [heightInches, setHeightInches] = useState<string>('0');

  // Metric states (when unit === 'meters')
  const [widthMeters, setWidthMeters] = useState<string>('3.0');
  const [heightMeters, setHeightMeters] = useState<string>('3.0');

  // Which entity type are we editing
  const [hasHeight, setHasHeight] = useState<boolean>(true);
  const [title, setTitle] = useState<string>('Set Dimensions');

  useEffect(() => {
    if (!isOpen || !selectedElement || !entity) return;

    let initW = 10;
    let initH = 10;
    let allowH = true;
    let itemTitle = 'Element';

    if (selectedElement.type === 'room') {
      const room = entity as FloorPlanRoom;
      itemTitle = room.label || room.roomType || 'Room';
      initW = Number(room.width || 12);
      initH = Number(room.height || 10);
      allowH = true;
    } else if (selectedElement.type === 'furniture') {
      const furn = entity as FloorPlanFurniture;
      itemTitle = furn.label || furn.itemType || 'Furniture';
      initW = Number(furn.width || 3);
      initH = Number(furn.height || 3);
      allowH = true;
    } else if (selectedElement.type === 'door') {
      const door = entity as FloorPlanDoor;
      itemTitle = door.doorType || 'Door';
      initW = Number(door.width || 3);
      allowH = false;
    } else if (selectedElement.type === 'window') {
      const win = entity as FloorPlanWindow;
      itemTitle = win.windowType || 'Window';
      initW = Number(win.width || 4);
      allowH = false;
    } else if (selectedElement.type === 'wall') {
      const wall = entity as any;
      itemTitle = wall.wallType === 'exterior' || wall.isExterior ? 'Exterior Wall' : 'Interior Wall';
      const x1 = wall.x1 ?? wall.start?.x ?? 0;
      const y1 = wall.y1 ?? wall.start?.y ?? 0;
      const x2 = wall.x2 ?? wall.end?.x ?? 0;
      const y2 = wall.y2 ?? wall.end?.y ?? 0;
      initW = Math.hypot(x2 - x1, y2 - y1);
      allowH = false;
    } else if (selectedElement.type === 'column') {
      const col = entity as any;
      itemTitle = 'Column';
      initW = Number(col.width || 1);
      initH = Number(col.depth || 1);
      allowH = true;
    }

    setTitle(itemTitle);
    setHasHeight(allowH);
    setActiveField('width');

    if (isFeet) {
      const wFt = Math.floor(initW);
      const wIn = Math.round((initW - wFt) * 12);
      setWidthFeet(String(wFt));
      setWidthInches(String(wIn));

      const hFt = Math.floor(initH);
      const hIn = Math.round((initH - hFt) * 12);
      setHeightFeet(String(hFt));
      setHeightInches(String(hIn));
    } else {
      setWidthMeters(initW.toFixed(2));
      setHeightMeters(initH.toFixed(2));
    }
  }, [isOpen, selectedElement, entity, isFeet]);

  if (!isOpen || !selectedElement || !entity) return null;

  // Active sub-field when in feet mode: 'ft' or 'in'
  // Handled by appending numbers or switching
  const handleKeypadPress = (val: string) => {
    if (isFeet) {
      if (activeField === 'width') {
        if (val === 'CLEAR') {
          setWidthFeet('0');
          setWidthInches('0');
        } else if (val === 'BACKSPACE') {
          if (widthInches.length > 0 && widthInches !== '0') {
            setWidthInches(prev => prev.length > 1 ? prev.slice(0, -1) : '0');
          } else {
            setWidthFeet(prev => prev.length > 1 ? prev.slice(0, -1) : '0');
          }
        } else {
          // Append digit to feet
          setWidthFeet(prev => (prev === '0' ? val : prev + val));
        }
      } else {
        if (val === 'CLEAR') {
          setHeightFeet('0');
          setHeightInches('0');
        } else if (val === 'BACKSPACE') {
          if (heightInches.length > 0 && heightInches !== '0') {
            setHeightInches(prev => prev.length > 1 ? prev.slice(0, -1) : '0');
          } else {
            setHeightFeet(prev => prev.length > 1 ? prev.slice(0, -1) : '0');
          }
        } else {
          setHeightFeet(prev => (prev === '0' ? val : prev + val));
        }
      }
    } else {
      // Metric meters mode
      const setter = activeField === 'width' ? setWidthMeters : setHeightMeters;
      if (val === 'CLEAR') {
        setter('0');
      } else if (val === 'BACKSPACE') {
        setter(prev => prev.length > 1 ? prev.slice(0, -1) : '0');
      } else if (val === '.') {
        setter(prev => prev.includes('.') ? prev : prev + '.');
      } else {
        setter(prev => (prev === '0' ? val : prev + val));
      }
    }
  };

  const handleSetInchesDirect = (inches: number) => {
    if (activeField === 'width') {
      setWidthInches(String(inches));
    } else {
      setHeightInches(String(inches));
    }
  };

  const handleApply = () => {
    let finalW = 10;
    let finalH: number | undefined = undefined;

    if (isFeet) {
      const wF = parseFloat(widthFeet) || 0;
      const wI = parseFloat(widthInches) || 0;
      finalW = Math.max(0.5, Number((wF + wI / 12).toFixed(2)));

      if (hasHeight) {
        const hF = parseFloat(heightFeet) || 0;
        const hI = parseFloat(heightInches) || 0;
        finalH = Math.max(0.5, Number((hF + hI / 12).toFixed(2)));
      }
    } else {
      finalW = Math.max(0.2, parseFloat(widthMeters) || 1);
      if (hasHeight) {
        finalH = Math.max(0.2, parseFloat(heightMeters) || 1);
      }
    }

    onApply(finalW, finalH);
    onClose();
  };

  // Preset dimension shortcuts for common Indian architectural standards
  const getPresets = (): { label: string; w: number; h?: number }[] => {
    const type = selectedElement.type;
    if (type === 'room') {
      return isFeet
        ? [
            { label: "10' × 10' (Bed)", w: 10, h: 10 },
            { label: "10' × 12' (Master)", w: 10, h: 12 },
            { label: "12' × 14' (Living)", w: 12, h: 14 },
            { label: "8' × 10' (Kitchen)", w: 8, h: 10 },
            { label: "4' × 7' (Bath)", w: 4, h: 7 },
            { label: "5' × 8' (Attached)", w: 5, h: 8 },
          ]
        : [
            { label: '3.0 × 3.0m', w: 3.0, h: 3.0 },
            { label: '3.0 × 3.6m', w: 3.0, h: 3.6 },
            { label: '3.6 × 4.2m', w: 3.6, h: 4.2 },
            { label: '2.4 × 3.0m', w: 2.4, h: 3.0 },
            { label: '1.2 × 2.1m', w: 1.2, h: 2.1 },
          ];
    } else if (type === 'door') {
      return isFeet
        ? [
            { label: "2'6\" (Toilet)", w: 2.5 },
            { label: "3'0\" (Room)", w: 3.0 },
            { label: "3'3\" (Office)", w: 3.25 },
            { label: "3'6\" (Main Door)", w: 3.5 },
          ]
        : [
            { label: '0.75m', w: 0.75 },
            { label: '0.90m', w: 0.90 },
            { label: '1.05m', w: 1.05 },
          ];
    } else if (type === 'window') {
      return isFeet
        ? [
            { label: "3'0\" (Bath)", w: 3.0 },
            { label: "4'0\" (Standard)", w: 4.0 },
            { label: "5'0\" (Living)", w: 5.0 },
            { label: "6'0\" (Sliding)", w: 6.0 },
          ]
        : [
            { label: '0.90m', w: 0.90 },
            { label: '1.20m', w: 1.20 },
            { label: '1.50m', w: 1.50 },
            { label: '1.80m', w: 1.80 },
          ];
    } else if (type === 'furniture') {
      return isFeet
        ? [
            { label: "Single Bed (3'×6')", w: 3, h: 6 },
            { label: "Queen Bed (5'×6.5')", w: 5, h: 6.5 },
            { label: "King Bed (6'×6.5')", w: 6, h: 6.5 },
            { label: "2-Seat Sofa (5'×3')", w: 5, h: 3 },
            { label: "Dining Table (4'×3')", w: 4, h: 3 },
          ]
        : [
            { label: 'Single (0.9×1.9m)', w: 0.9, h: 1.9 },
            { label: 'Queen (1.5×2.0m)', w: 1.5, h: 2.0 },
            { label: 'King (1.8×2.0m)', w: 1.8, h: 2.0 },
          ];
    }
    return [];
  };

  const presets = getPresets();

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        padding: '0',
        animation: 'fadeIn 0.15s ease-out',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '520px',
          backgroundColor: '#ffffff',
          borderTopLeftRadius: '24px',
          borderTopRightRadius: '24px',
          padding: '16px 18px 24px 18px',
          boxShadow: '0 -10px 40px rgba(0, 0, 0, 0.25)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          animation: 'slideUp 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Top Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '10px', backgroundColor: '#e0f2fe', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0284c7' }}>
              <Ruler size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>
                {title} அளவீடு (Exact Size)
              </h3>
              <p style={{ margin: 0, fontSize: '0.72rem', color: '#64748b' }}>
                அடி (Feet) மற்றும் அங்குலம் (Inches) நேரடி உள்ளீடு
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              border: 'none',
              backgroundColor: '#f1f5f9',
              color: '#64748b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Dimension Target Cards: Width & Length */}
        <div style={{ display: 'grid', gridTemplateColumns: hasHeight ? '1fr 1fr' : '1fr', gap: '10px' }}>
          {/* Width Card */}
          <div
            onClick={() => setActiveField('width')}
            style={{
              padding: '10px 12px',
              borderRadius: '14px',
              border: activeField === 'width' ? '2.5px solid #0284c7' : '1.5px solid #e2e8f0',
              backgroundColor: activeField === 'width' ? '#f0f9ff' : '#f8fafc',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: activeField === 'width' ? '#0369a1' : '#64748b' }}>
                WIDTH (அகலம்)
              </span>
              {activeField === 'width' && (
                <span style={{ fontSize: '0.68rem', backgroundColor: '#0284c7', color: '#fff', padding: '1px 6px', borderRadius: '6px', fontWeight: 700 }}>
                  Active
                </span>
              )}
            </div>
            {isFeet ? (
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                <span style={{ fontSize: '1.45rem', fontWeight: 900, color: '#0f172a' }}>{widthFeet}</span>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#64748b' }}>ft</span>
                <span style={{ fontSize: '1.45rem', fontWeight: 900, color: '#0f172a', marginLeft: '6px' }}>{widthInches}</span>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#64748b' }}>in</span>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                <span style={{ fontSize: '1.45rem', fontWeight: 900, color: '#0f172a' }}>{widthMeters}</span>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#64748b' }}>m</span>
              </div>
            )}
          </div>

          {/* Length Card */}
          {hasHeight && (
            <div
              onClick={() => setActiveField('height')}
              style={{
                padding: '10px 12px',
                borderRadius: '14px',
                border: activeField === 'height' ? '2.5px solid #0284c7' : '1.5px solid #e2e8f0',
                backgroundColor: activeField === 'height' ? '#f0f9ff' : '#f8fafc',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: activeField === 'height' ? '#0369a1' : '#64748b' }}>
                  LENGTH (நீளம்)
                </span>
                {activeField === 'height' && (
                  <span style={{ fontSize: '0.68rem', backgroundColor: '#0284c7', color: '#fff', padding: '1px 6px', borderRadius: '6px', fontWeight: 700 }}>
                    Active
                  </span>
                )}
              </div>
              {isFeet ? (
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                  <span style={{ fontSize: '1.45rem', fontWeight: 900, color: '#0f172a' }}>{heightFeet}</span>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#64748b' }}>ft</span>
                  <span style={{ fontSize: '1.45rem', fontWeight: 900, color: '#0f172a', marginLeft: '6px' }}>{heightInches}</span>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#64748b' }}>in</span>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                  <span style={{ fontSize: '1.45rem', fontWeight: 900, color: '#0f172a' }}>{heightMeters}</span>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#64748b' }}>m</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Quick Inches Selector (for Feet Mode) */}
        {isFeet && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflowX: 'auto', padding: '2px 0' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748b', whiteSpace: 'nowrap', marginRight: '2px' }}>
              அங்குலம்:
            </span>
            {[0, 2, 3, 4, 6, 8, 9, 10].map(inch => {
              const currentInch = activeField === 'width' ? widthInches : heightInches;
              const isSelected = currentInch === String(inch);
              return (
                <button
                  key={inch}
                  type="button"
                  onClick={() => handleSetInchesDirect(inch)}
                  style={{
                    padding: '4px 9px',
                    borderRadius: '8px',
                    border: isSelected ? '1.5px solid #0284c7' : '1px solid #cbd5e1',
                    backgroundColor: isSelected ? '#0284c7' : '#ffffff',
                    color: isSelected ? '#ffffff' : '#334155',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {inch}"
                </button>
              );
            })}
          </div>
        )}

        {/* Presets Bar */}
        {presets.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflowX: 'auto', padding: '2px 0' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748b', whiteSpace: 'nowrap', marginRight: '2px' }}>
              ஸ்டாண்டர்ட்:
            </span>
            {presets.map(p => (
              <button
                key={p.label}
                type="button"
                onClick={() => {
                  if (isFeet) {
                    const wF = Math.floor(p.w);
                    const wI = Math.round((p.w - wF) * 12);
                    setWidthFeet(String(wF));
                    setWidthInches(String(wI));
                    if (p.h !== undefined) {
                      const hF = Math.floor(p.h);
                      const hI = Math.round((p.h - hF) * 12);
                      setHeightFeet(String(hF));
                      setHeightInches(String(hI));
                    }
                  } else {
                    setWidthMeters(p.w.toFixed(2));
                    if (p.h !== undefined) setHeightMeters(p.h.toFixed(2));
                  }
                }}
                style={{
                  padding: '4px 10px',
                  borderRadius: '12px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#f8fafc',
                  color: '#334155',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        )}

        {/* Mobile Touch CAD Keypad */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '8px',
            backgroundColor: '#f1f5f9',
            padding: '10px',
            borderRadius: '16px',
          }}
        >
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', isFeet ? 'CLEAR' : '.', '0', 'BACKSPACE'].map(key => {
            const isBackspace = key === 'BACKSPACE';
            const isClear = key === 'CLEAR';
            return (
              <button
                key={key}
                type="button"
                onClick={() => handleKeypadPress(key)}
                style={{
                  height: '46px',
                  borderRadius: '10px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: isBackspace || isClear ? '#e2e8f0' : '#ffffff',
                  color: '#0f172a',
                  fontSize: isBackspace || isClear ? '0.78rem' : '1.25rem',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                  userSelect: 'none',
                }}
              >
                {isBackspace ? <Delete size={18} /> : isClear ? 'Clear' : key}
              </button>
            );
          })}
        </div>

        {/* Action Button: Apply */}
        <button
          type="button"
          onClick={handleApply}
          style={{
            height: '48px',
            width: '100%',
            borderRadius: '14px',
            border: 'none',
            backgroundColor: '#0284c7',
            color: '#ffffff',
            fontSize: '0.95rem',
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(2, 132, 199, 0.35)',
          }}
        >
          <Check size={18} />
          <span>அளவை உறுதிசெய் (Apply Dimension)</span>
        </button>
      </div>
    </div>
  );
};
