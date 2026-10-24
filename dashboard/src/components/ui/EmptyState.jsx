import React from 'react';

export default function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className = ''
}) {
  return (
    <div className={`empty-state ${className}`.trim()}>
      {Icon && (
        <div className="empty-state-icon">
          <Icon size={24} aria-hidden="true" />
        </div>
      )}
      {title && <h4 className="empty-state-title">{title}</h4>}
      {description && <p className="empty-state-desc">{description}</p>}
      {action && <div style={{ marginTop: '8px' }}>{action}</div>}
    </div>
  );
}
