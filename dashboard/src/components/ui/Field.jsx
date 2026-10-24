import React, { useId } from 'react';

export default function Field({
  label,
  id: customId,
  hint,
  error,
  required = false,
  className = '',
  children,
  ...inputProps
}) {
  const generatedId = useId();
  const id = customId || generatedId;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;

  return (
    <div className={`form-field ${className}`.trim()}>
      {label && (
        <label htmlFor={id} className="form-label">
          <span>
            {label} {required && <span aria-hidden="true" style={{ color: 'var(--danger-text)' }}>*</span>}
          </span>
        </label>
      )}

      {children ? (
        typeof children === 'function' ? children({ id, hintId, errorId, error }) : children
      ) : (
        <input
          id={id}
          className="input"
          aria-invalid={Boolean(error)}
          aria-describedby={[hintId, errorId].filter(Boolean).join(' ') || undefined}
          required={required}
          {...inputProps}
        />
      )}

      {hint && !error && (
        <div id={hintId} className="form-hint">
          {hint}
        </div>
      )}

      {error && (
        <div id={errorId} className="form-error" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}
