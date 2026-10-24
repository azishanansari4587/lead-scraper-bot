import React from 'react';
import { Loader2 } from 'lucide-react';

export default function Button({
  children,
  variant = 'secondary', // 'primary' | 'secondary' | 'ghost' | 'danger' | 'icon'
  size = 'md', // 'sm' | 'md' | 'lg'
  loading = false,
  disabled = false,
  className = '',
  type = 'button',
  icon: Icon,
  ...props
}) {
  const variantClass = variant === 'icon' ? 'btn-icon' : `btn-${variant}`;
  const sizeClass = size === 'md' ? '' : `btn-${size}`;

  return (
    <button
      type={type}
      className={`btn ${variantClass} ${sizeClass} ${className}`.trim()}
      disabled={disabled || loading}
      aria-busy={loading}
      {...props}
    >
      {loading ? (
        <Loader2 size={size === 'sm' ? 12 : 16} className="spin" aria-hidden="true" />
      ) : Icon ? (
        <Icon size={size === 'sm' ? 13 : 16} aria-hidden="true" />
      ) : null}
      {children}
    </button>
  );
}
