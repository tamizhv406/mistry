import React from 'react';
import { Keyboard, X } from 'lucide-react';

export interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fp-calc-modal" role="dialog" aria-modal="true">
      <div className="fp-calc-dialog" style={{ maxWidth: 500 }}>
        <div className="fp-calc-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Keyboard size={20} color="#1e293b" />
            <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a' }}>
              Keyboard Shortcuts
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
          <table className="fp-calc-table">
            <tbody>
              <tr><td><kbd style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: 4 }}>V</kbd></td><td>Select / Move Tool</td></tr>
              <tr><td><kbd style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: 4 }}>W</kbd></td><td>Wall Tool: one straight wall at a time</td></tr>
              <tr><td><kbd style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: 4 }}>S</kbd></td><td>Sketch Walls: a rough outline becomes straight walls</td></tr>
              <tr><td><kbd style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: 4 }}>R</kbd></td><td>Place Room Tool (rotates the selection when something is selected)</td></tr>
              <tr><td><kbd style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: 4 }}>D</kbd></td><td>Place Door Tool</td></tr>
              <tr><td><kbd style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: 4 }}>Enter</kbd></td><td>Type an exact size for the selected wall</td></tr>
              <tr><td><kbd style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: 4 }}>M</kbd></td><td>Toggle Dimensions & Measurements</td></tr>
              <tr><td><kbd style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: 4 }}>G</kbd></td><td>Toggle Grid</td></tr>
              <tr><td><kbd style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: 4 }}>H</kbd></td><td>Pan / Hand Tool</td></tr>
              <tr><td><kbd style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: 4 }}>F</kbd></td><td>Fit the Plan to the Screen</td></tr>
              <tr><td><kbd style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: 4 }}>0</kbd></td><td>Reset the View to 100%</td></tr>
              <tr><td><kbd style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: 4 }}>+ / -</kbd></td><td>Zoom In / Out</td></tr>
              <tr><td><kbd style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: 4 }}>Ctrl + Z</kbd></td><td>Undo</td></tr>
              <tr><td><kbd style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: 4 }}>Ctrl + Y / Ctrl + Shift + Z</kbd></td><td>Redo</td></tr>
              <tr><td><kbd style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: 4 }}>Ctrl + D</kbd></td><td>Duplicate Selected Element</td></tr>
              <tr><td><kbd style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: 4 }}>Ctrl + L</kbd></td><td>Lock / Unlock Selected Element</td></tr>
              <tr><td><kbd style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: 4 }}>Ctrl + C / Ctrl + V</kbd></td><td>Copy / Paste</td></tr>
              <tr><td><kbd style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: 4 }}>Ctrl + S</kbd></td><td>Save Floor Plan</td></tr>
              <tr><td><kbd style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: 4 }}>Del / Backspace</kbd></td><td>Delete Selected Element</td></tr>
              <tr><td><kbd style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: 4 }}>Esc</kbd></td><td>Cancel Drawing / Deselect</td></tr>
              <tr><td><kbd style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: 4 }}>Mouse Wheel</kbd></td><td>Zoom In / Out</td></tr>
              <tr><td><kbd style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: 4 }}>Middle Mouse / Alt+Drag</kbd></td><td>Pan Canvas</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
