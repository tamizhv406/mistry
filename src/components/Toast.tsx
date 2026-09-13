import React, { useEffect } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const Toast: React.FC<ToastProps> = ({ toasts, onDismiss }) => {
  return (
    <div className="toast-container">
      {toasts.map(toast => (
        <SingleToast key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
};

const SingleToast: React.FC<{ toast: ToastMessage; onDismiss: (id: string) => void }> = ({
  toast,
  onDismiss,
}) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss(toast.id);
    }, 4000);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  return (
    <div className={`toast toast-${toast.type}`}>
      {toast.type === 'success' && <CheckCircle2 size={20} color="#10b981" />}
      {toast.type === 'error' && <AlertCircle size={20} color="#ef4444" />}
      {toast.type === 'info' && <Info size={20} color="#3b82f6" />}
      <span style={{ fontSize: '0.9rem', flex: 1 }}>{toast.message}</span>
      <button
        onClick={() => onDismiss(toast.id)}
        style={{ color: '#94a3b8', padding: '2px', display: 'flex', alignItems: 'center' }}
      >
        <X size={16} />
      </button>
    </div>
  );
};
