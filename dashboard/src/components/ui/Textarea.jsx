import React from 'react';

export default function Textarea({
  className = '',
  id,
  rows = 3,
  ...props
}) {
  return (
    <textarea
      id={id}
      rows={rows}
      className={`textarea ${className}`.trim()}
      {...props}
    />
  );
}
