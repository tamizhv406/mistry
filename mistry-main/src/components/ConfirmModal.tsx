import React from 'react';
import { AlertTriangle, Trash2, RotateCcw, X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDanger?: boolean;
  type?: 'trash' | 'permanent-delete' | 'restore' | 'general';
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  isDanger = false,
  type = 'general',
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-dialog" style={{ maxWidth: '460px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {type === 'permanent-delete' && <AlertTriangle size={22} color="#ef4444" />}
            {type === 'trash' && <Trash2 size={22} color="#f59e0b" />}
            {type === 'restore' && <RotateCcw size={22} color="#10b981" />}
            {title}
          </h3>
          <button className="modal-close-btn" onClick={onCancel}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: '1.5' }}>
            {message}
          </p>

          {type === 'trash' && (
            <div style={{
              background: '#fef3c7',
              border: '1px solid #fcd34d',
              padding: '10px 14px',
              borderRadius: '8px',
              fontSize: '0.85rem',
              color: '#92400e'
            }}>
              💡 <strong>Safe Delete:</strong> This item will be moved to the <strong>Trash / Recycle Bin</strong>. You can recover it at any time.
            </div>
          )}

          {type === 'permanent-delete' && (
            <div style={{
              background: '#fee2e2',
              border: '1px solid #fca5a5',
              padding: '10px 14px',
              borderRadius: '8px',
              fontSize: '0.85rem',
              color: '#991b1b',
              fontWeight: 600,
            }}>
              ⚠️ <strong>WARNING:</strong> This action cannot be undone. The record will be permanently wiped from the database.
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            className={`btn ${isDanger ? 'btn-danger-solid' : type === 'restore' ? 'btn-success' : 'btn-primary'}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
