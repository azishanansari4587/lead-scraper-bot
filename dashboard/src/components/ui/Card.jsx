import React from 'react';

export default function Card({
  title,
  subtitle,
  action,
  icon: Icon,
  className = '',
  children,
  ...props
}) {
  return (
    <div className={`card ${className}`.trim()} {...props}>
      {(title || action || Icon) && (
        <div className="card-header">
          <div>
            <h3 className="card-title">
              {Icon && <Icon size={18} color="var(--gold-primary)" aria-hidden="true" />}
              {title}
            </h3>
            {subtitle && <p className="page-subtitle">{subtitle}</p>}
          </div>
          {action && <div>{action}</div>}
        </div>
      )}
      {children}
    </div>
  );
}
