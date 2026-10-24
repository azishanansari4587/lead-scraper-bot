import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(({ title, message, type = 'info', duration = 4000 }) => {
    const id = Date.now() + Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, title, message, type }]);

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
  }, [removeToast]);

  const success = useCallback((message, title = 'Success') => {
    addToast({ message, title, type: 'success' });
  }, [addToast]);

  const error = useCallback((message, title = 'Error') => {
    addToast({ message, title, type: 'error' });
  }, [addToast]);

  const warning = useCallback((message, title = 'Warning') => {
    addToast({ message, title, type: 'warning' });
  }, [addToast]);

  const info = useCallback((message, title = 'Information') => {
    addToast({ message, title, type: 'info' });
  }, [addToast]);

  const icons = {
    success: <CheckCircle2 size={18} color="var(--success)" aria-hidden="true" />,
    error: <XCircle size={18} color="var(--danger)" aria-hidden="true" />,
    warning: <AlertTriangle size={18} color="var(--warning)" aria-hidden="true" />,
    info: <Info size={18} color="var(--info)" aria-hidden="true" />
  };

  return (
    <ToastContext.Provider value={{ addToast, success, error, warning, info, removeToast }}>
      {children}
      <div className="toast-container" role="region" aria-label="Notifications" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast-${toast.type}`} role="status">
            <div style={{ flexShrink: 0, marginTop: '2px' }}>
              {icons[toast.type]}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              {toast.title && (
                <div style={{ fontWeight: 700, fontSize: 'var(--font-sm)', color: 'var(--text-heading)', marginBottom: '2px' }}>
                  {toast.title}
                </div>
              )}
              <div style={{ color: 'var(--text-main)', fontSize: 'var(--font-xs)', lineHeight: '1.4', wordBreak: 'break-word' }}>
                {toast.message}
              </div>
            </div>
            <button
              type="button"
              className="btn-icon btn-ghost btn-sm"
              onClick={() => removeToast(toast.id)}
              aria-label="Dismiss notification"
              style={{ color: 'var(--text-muted)' }}
            >
              <X size={14} aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    // Graceful fallback if invoked outside provider
    return {
      success: (msg) => console.log('Toast [Success]:', msg),
      error: (msg) => console.error('Toast [Error]:', msg),
      warning: (msg) => console.warn('Toast [Warning]:', msg),
      info: (msg) => console.info('Toast [Info]:', msg)
    };
  }
  return context;
}

export default ToastProvider;
