import React from 'react';

export function Skeleton({
  width = '100%',
  height = '20px',
  borderRadius = 'var(--radius-sm)',
  className = '',
  style = {}
}) {
  return (
    <div
      className={`skeleton ${className}`.trim()}
      style={{
        width,
        height,
        borderRadius,
        ...style
      }}
      aria-hidden="true"
    />
  );
}

export function SkeletonRow({ columns = 5 }) {
  return (
    <tr>
      {Array.from({ length: columns }).map((_, idx) => (
        <td key={idx}>
          <Skeleton height="16px" width={idx === 0 ? '70%' : '50%'} />
        </td>
      ))}
    </tr>
  );
}

export function SkeletonCard() {
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <Skeleton height="20px" width="40%" />
      <Skeleton height="36px" width="60%" />
      <Skeleton height="14px" width="80%" />
    </div>
  );
}

export default Skeleton;
