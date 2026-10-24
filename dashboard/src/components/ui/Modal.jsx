import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  footer,
  className = '',
  size = 'md', // 'sm' | 'md' | 'lg'
  hasUnsavedChanges = false
}) {
  const modalRef = useRef(null);

  const handleClose = () => {
    if (hasUnsavedChanges) {
      if (!window.confirm('You have unsaved changes. Are you sure you want to exit?')) {
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
    // Focus first interactive element inside modal
    const timer = setTimeout(() => {
      if (modalRef.current) {
        const focusable = modalRef.current.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
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
      className="modal-backdrop"
      onClick={handleClose}
      role="presentation"
    >
      <div
        ref={modalRef}
        className={`modal-content modal-${size} ${className}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-label={title || 'Dialog'}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2 style={{ fontSize: 'var(--font-md)', fontWeight: 700, color: 'var(--text-heading)' }}>
            {title}
          </h2>
          <button
            type="button"
            className="btn-icon btn-ghost btn-sm"
            onClick={handleClose}
            aria-label="Close dialog"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="modal-body">
          {children}
        </div>

        {footer && (
          <div className="modal-footer">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
