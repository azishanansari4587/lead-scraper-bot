import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function Pagination({
  currentPage = 1,
  totalItems = 0,
  pageSize = 15,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 15, 25, 50],
  className = ''
}) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(totalItems, currentPage * pageSize);

  // Generate page numbers
  const pages = [];
  const maxDisplayedPages = 5;
  let startPage = Math.max(1, currentPage - Math.floor(maxDisplayedPages / 2));
  let endPage = Math.min(totalPages, startPage + maxDisplayedPages - 1);

  if (endPage - startPage + 1 < maxDisplayedPages) {
    startPage = Math.max(1, endPage - maxDisplayedPages + 1);
  }

  for (let i = startPage; i <= endPage; i++) {
    pages.push(i);
  }

  return (
    <div className={`pagination-bar ${className}`.trim()}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span>
          Showing <strong>{startItem}</strong>–<strong>{endItem}</strong> of <strong>{totalItems}</strong> records
        </span>

        {onPageSizeChange && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label htmlFor="pagination-page-size" style={{ fontSize: 'var(--font-xs)', color: 'var(--text-dim)' }}>
              Rows per page:
            </label>
            <select
              id="pagination-page-size"
              className="select"
              style={{ width: 'auto', padding: '3px 8px', fontSize: 'var(--font-xs)' }}
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
            >
              {pageSizeOptions.map((sz) => (
                <option key={sz} value={sz}>
                  {sz}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="pagination-controls" role="navigation" aria-label="Pagination Navigation">
        <button
          type="button"
          className="pagination-page-btn"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          aria-label="Previous Page"
        >
          <ChevronLeft size={16} aria-hidden="true" />
        </button>

        {startPage > 1 && (
          <>
            <button
              type="button"
              className={`pagination-page-btn ${currentPage === 1 ? 'active' : ''}`}
              onClick={() => onPageChange(1)}
              aria-label="Page 1"
            >
              1
            </button>
            {startPage > 2 && <span style={{ padding: '0 4px', color: 'var(--text-dim)' }}>…</span>}
          </>
        )}

        {pages.map((p) => (
          <button
            key={p}
            type="button"
            className={`pagination-page-btn ${p === currentPage ? 'active' : ''}`}
            onClick={() => onPageChange(p)}
            aria-current={p === currentPage ? 'page' : undefined}
            aria-label={`Page ${p}`}
          >
            {p}
          </button>
        ))}

        {endPage < totalPages && (
          <>
            {endPage < totalPages - 1 && <span style={{ padding: '0 4px', color: 'var(--text-dim)' }}>…</span>}
            <button
              type="button"
              className={`pagination-page-btn ${currentPage === totalPages ? 'active' : ''}`}
              onClick={() => onPageChange(totalPages)}
              aria-label={`Page ${totalPages}`}
            >
              {totalPages}
            </button>
          </>
        )}

        <button
          type="button"
          className="pagination-page-btn"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          aria-label="Next Page"
        >
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
