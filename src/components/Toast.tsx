import React, { useEffect, useRef } from 'react';
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
    <div className="toast-container" role="status" aria-live="polite">
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
  // The parent passes a new callback on every render. Reading it through a ref keeps the
  // timer running instead of restarting it, so a toast really does close after its time.
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;

  useEffect(() => {
    // Errors stay longer so they can be read.
    const timer = setTimeout(() => dismissRef.current(toast.id), toast.type === 'error' ? 6000 : 3500);
    return () => clearTimeout(timer);
  }, [toast.id, toast.type]);

  return (
    <div className={`toast toast-${toast.type}`} role={toast.type === 'error' ? 'alert' : undefined}>
      {toast.type === 'success' && <CheckCircle2 size={20} color="#10b981" />}
      {toast.type === 'error' && <AlertCircle size={20} color="#ef4444" />}
      {toast.type === 'info' && <Info size={20} color="#3b82f6" />}
      <span style={{ fontSize: '0.9rem', flex: 1 }}>{toast.message}</span>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss message"
        style={{ color: '#94a3b8', padding: '10px', margin: '-10px -6px -10px 0', display: 'flex', alignItems: 'center' }}
      >
        <X size={16} />
      </button>
    </div>
  );
};
