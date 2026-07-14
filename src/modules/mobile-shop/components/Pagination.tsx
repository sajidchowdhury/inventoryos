'use client';

import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems?: number;
  itemsPerPage?: number;
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  totalItems,
  itemsPerPage,
}: PaginationProps) {
  if (totalPages <= 1) {
    // Still show count info if provided
    if (totalItems !== undefined) {
      return (
        <div className="flex items-center justify-between px-3 py-2 text-xs text-gray-400">
          <span>{totalItems} item(s)</span>
        </div>
      );
    }
    return null;
  }

  // Generate page numbers to show (current ± 2, plus first and last)
  const pages: (number | '...')[] = [];
  const addPage = (p: number) => { if (!pages.includes(p)) pages.push(p); };

  addPage(1);
  if (currentPage - 2 > 2) pages.push('...');
  for (let i = Math.max(2, currentPage - 2); i <= Math.min(totalPages - 1, currentPage + 2); i++) {
    addPage(i);
  }
  if (currentPage + 2 < totalPages - 1) pages.push('...');
  if (totalPages > 1) addPage(totalPages);

  const startItem = totalItems !== undefined && itemsPerPage
    ? (currentPage - 1) * itemsPerPage + 1
    : 0;
  const endItem = totalItems !== undefined && itemsPerPage
    ? Math.min(currentPage * itemsPerPage, totalItems)
    : 0;

  return (
    <div className="flex items-center justify-between gap-2 px-3 py-2 border-t border-gray-100">
      {/* Count info */}
      {totalItems !== undefined && (
        <span className="text-[10px] text-gray-400 hidden sm:block">
          {startItem}–{endItem} of {totalItems}
        </span>
      )}

      {/* Page buttons */}
      <div className="flex items-center gap-1 ml-auto">
        {/* Previous */}
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="w-8 h-8 rounded-lg flex items-center justify-center disabled:opacity-30 hover:bg-gray-100 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {/* Page numbers */}
        {pages.map((page, i) =>
          page === '...' ? (
            <span key={`ellipsis-${i}`} className="w-8 h-8 flex items-center justify-center text-gray-400">
              <MoreHorizontal className="w-4 h-4" />
            </span>
          ) : (
            <button
              key={page}
              onClick={() => onPageChange(page)}
              className={cn(
                'w-8 h-8 rounded-lg text-xs font-semibold transition-colors',
                page === currentPage
                  ? 'bg-violet-500 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              )}
            >
              {page}
            </button>
          )
        )}

        {/* Next */}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="w-8 h-8 rounded-lg flex items-center justify-center disabled:opacity-30 hover:bg-gray-100 transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
