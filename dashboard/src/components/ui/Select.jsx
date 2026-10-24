import React from 'react';

export default function Select({
  options = [],
  className = '',
  id,
  children,
  ...props
}) {
  return (
    <select id={id} className={`select ${className}`.trim()} {...props}>
      {children
        ? children
        : options.map((opt) => {
            const value = typeof opt === 'object' ? opt.value : opt;
            const label = typeof opt === 'object' ? opt.label : opt;
            return (
              <option key={value} value={value}>
                {label}
              </option>
            );
          })}
    </select>
  );
}
