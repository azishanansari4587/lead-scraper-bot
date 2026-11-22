import React from 'react';

export function Badge({
  variant = 'neutral', // 'info' | 'warning' | 'success' | 'danger' | 'neutral' | 'primary'
  children,
  className = '',
  ...props
}) {
  return (
    <span className={`badge badge-${variant} ${className}`.trim()} {...props}>
      {children}
    </span>
  );
}

const STATUS_MAP = {
  new: { label: 'New Lead', variant: 'info' },
  contacted: { label: 'Contacted', variant: 'warning' },
  replied: { label: 'Replied', variant: 'primary' },
  sample_sent: { label: 'Sample Sent', variant: 'info' },
  quotation: { label: 'Quotation', variant: 'warning' },
  negotiation: { label: 'Negotiation', variant: 'primary' },
  won: { label: 'Won Deal', variant: 'success' },
  lost: { label: 'Lost', variant: 'danger' },
  repeat_client: { label: 'Repeat Client', variant: 'success' },
  not_interested: { label: 'Not Interested', variant: 'danger' }
};

export function StatusBadge({ status, className = '' }) {
  const meta = STATUS_MAP[status] || {
    label: (status || 'Unknown').replace(/_/g, ' '),
    variant: 'neutral'
  };

  return (
    <Badge variant={meta.variant} className={className}>
      {meta.label}
    </Badge>
  );
}

export function ScoreBadge({ score = 0, className = '' }) {
  const num = typeof score === 'number' ? score : parseInt(score, 10) || 0;
  let variant = 'score-low';
  if (num >= 70) variant = 'score-high';
  else if (num >= 40) variant = 'score-med';

  return (
    <span className={`badge badge-${variant} ${className}`.trim()}>
      {num} / 100
    </span>
  );
}

export default Badge;
