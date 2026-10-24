import React from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

export default function DataTable({
  columns = [],
  data = [],
  sortKey,
  sortDirection = 'asc', // 'asc' | 'desc'
  onSort,
  onRowClick,
  keyField = 'id',
  emptyContent,
  className = '',
  density = 'normal', // 'compact' | 'normal'
  stickyHeader = false
}) {
  return (
    <div className={`table-container ${className}`.trim()}>
      <table className={`data-table ${density === 'compact' ? 'compact' : ''}`.trim()}>
        <thead style={stickyHeader ? { position: 'sticky', top: 0, zIndex: 10 } : {}}>
          <tr>
            {columns.map((col) => {
              const isSorted = sortKey && sortKey === col.key;
              const isSortable = Boolean(col.sortable && onSort);

              return (
                <th
                  key={col.key}
                  className={isSortable ? 'sortable' : ''}
                  onClick={isSortable ? () => onSort(col.key) : undefined}
                  style={col.width ? { width: col.width, ...col.headerStyle } : col.headerStyle}
                  aria-sort={isSorted ? (sortDirection === 'asc' ? 'ascending' : 'descending') : undefined}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>{col.label}</span>
                    {isSortable && (
                      <span aria-hidden="true" style={{ opacity: isSorted ? 1 : 0.4 }}>
                        {isSorted ? (
                          sortDirection === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                        ) : (
                          <ArrowUpDown size={12} />
                        )}
                      </span>
                    )}
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} style={{ padding: 0 }}>
                {emptyContent || (
                  <div style={{ textAlign: 'center', padding: '36px', color: 'var(--text-dim)' }}>
                    No records found.
                  </div>
                )}
              </td>
            </tr>
          ) : (
            data.map((row, index) => {
              const rowKey = row[keyField] ?? index;
              const isClickable = Boolean(onRowClick);

              return (
                <tr
                  key={rowKey}
                  tabIndex={isClickable ? 0 : undefined}
                  onClick={isClickable ? () => onRowClick(row) : undefined}
                  onKeyDown={
                    isClickable
                      ? (e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onRowClick(row);
                          }
                        }
                      : undefined
                  }
                  style={isClickable ? { cursor: 'pointer' } : {}}
                >
                  {columns.map((col) => (
                    <td key={col.key} style={col.cellStyle}>
                      {col.render ? col.render(row[col.key], row, index) : row[col.key]}
                    </td>
                  ))}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
