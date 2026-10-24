import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

export default function Drawer({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  className = '',
  hasUnsavedChanges = false
}) {
  const drawerRef = useRef(null);

  const handleClose = () => {
    if (hasUnsavedChanges) {
      if (!window.confirm('You have unsaved changes in this lead profile. Are you sure you want to close?')) {
        return;
      }
    }
    onClose();
  };

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        handleClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    const timer = setTimeout(() => {
      if (drawerRef.current) {
        const focusable = drawerRef.current.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (focusable) focusable.focus();
      }
    }, 50);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      clearTimeout(timer);
    };
  }, [isOpen, hasUnsavedChanges]);

  if (!isOpen) return null;

  return (
    <div
      className="drawer-backdrop"
      onClick={handleClose}
      role="presentation"
    >
      <div
        ref={drawerRef}
        className={`drawer ${className}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-label={title || 'Side panel'}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="drawer-header">
          <div>
            <h2 style={{ fontSize: 'var(--font-lg)', fontWeight: 700, color: 'var(--text-heading)' }}>
              {title}
            </h2>
            {subtitle && (
              <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)', marginTop: '2px' }}>
                {subtitle}
              </div>
            )}
          </div>
          <button
            type="button"
            className="btn-icon btn-ghost btn-sm"
            onClick={handleClose}
            aria-label="Close side panel"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <div className="drawer-body">
          {children}
        </div>

        {footer && (
          <div className="drawer-footer">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
