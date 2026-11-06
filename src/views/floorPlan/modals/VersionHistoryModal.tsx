import React from 'react';
import { History, X } from 'lucide-react';
import type { FloorPlanVersion } from '../../../db/types';

export interface VersionHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  versionNote: string;
  onVersionNoteChange: (val: string) => void;
  onCreateSnapshot: () => void;
  versionHistory?: FloorPlanVersion[];
  onRestoreSnapshot: (versionId: string) => void;
}

export const VersionHistoryModal: React.FC<VersionHistoryModalProps> = ({
  isOpen,
  onClose,
  versionNote,
  onVersionNoteChange,
  onCreateSnapshot,
  versionHistory = [],
  onRestoreSnapshot,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fp-calc-modal" role="dialog" aria-modal="true">
      <div className="fp-calc-dialog" style={{ maxWidth: 580 }}>
        <div className="fp-calc-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <History size={20} color="#1e293b" />
            <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a' }}>
              Floor Plan Version Snapshots
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
          {/* Create Snapshot Input */}
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              placeholder="Snapshot label (e.g. Prior to adding master bedroom)"
              value={versionNote}
              onChange={e => onVersionNoteChange(e.target.value)}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: 8,
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                color: '#0f172a',
                fontSize: '0.85rem',
              }}
            />
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={onCreateSnapshot}
            >
              Save Snapshot
            </button>
          </div>

          {/* List of Saved Snapshots */}
          <div style={{ marginTop: 16 }}>
            <h5
              style={{
                margin: '0 0 8px 0',
                color: '#475569',
                fontSize: '0.78rem',
                textTransform: 'uppercase',
              }}
            >
              Previous Snapshots
            </h5>
            {versionHistory.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {versionHistory.map(v => (
                  <div
                    key={v.versionId}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      background: '#f8fafc',
                      borderRadius: 8,
                      border: '1px solid #e2e8f0',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.85rem' }}>
                        {v.note || 'Snapshot'}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                        {new Date(v.timestamp).toLocaleString('en-IN')}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => onRestoreSnapshot(v.versionId)}
                    >
                      Restore
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: 24, textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>
                No version snapshots recorded yet. Create one above to preserve your design milestones.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
