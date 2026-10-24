import React from 'react';
import Modal from './Modal';
import Button from './Button';
import { AlertTriangle } from 'lucide-react';

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirm Action',
  message = 'Are you sure you want to proceed?',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
  loading = false
}) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            {cancelText}
          </Button>
          <Button variant={variant} onClick={onConfirm} loading={loading}>
            {confirmText}
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
        <div
          style={{
            width: '40px',
            height: '40px',
            borderRadius: 'var(--radius-pill)',
            background: variant === 'danger' ? 'var(--danger-bg)' : 'var(--warning-bg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}
        >
          <AlertTriangle
            size={20}
            color={variant === 'danger' ? 'var(--danger-text)' : 'var(--warning-text)'}
            aria-hidden="true"
          />
        </div>
        <div style={{ flex: 1, fontSize: 'var(--font-sm)', color: 'var(--text-main)', lineHeight: '1.5' }}>
          {message}
        </div>
      </div>
    </Modal>
  );
}
