"use client";

// ============================================================================
// DataPagination — reusable pagination footer for list/table views.
//
// Renders a left-aligned "Showing X–Y of Z" summary and a right-aligned
// nav with Previous / page numbers / Next using the shadcn pagination
// primitives. Designed to be dropped under any list (grid or table).
//
// When totalPages <= 1 the footer is hidden (nothing to paginate).
// ============================================================================

import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
} from "@/components/ui/pagination";

export interface DataPaginationProps {
  /** 1-based current page. */
  page: number;
  totalPages: number;
  /** Total items across all pages. */
  total: number;
  /** Items shown on the current page (= endIndex - startIndex). */
  count: number;
  /** 0-based start index of the current page. */
  startIndex: number;
  /** 0-based exclusive end index of the current page. */
  endIndex: number;
  /** Called with the new page number (1-based). */
  onPageChange: (page: number) => void;
  /** Optional singular/plural noun for the summary, e.g. "chemical". */
  noun?: string;
  /** Optional className for the wrapper. */
  className?: string;
}

/**
 * Builds the page-number list with leading/trailing ellipses.
 * Always shows the first and last page, plus a window around the current page.
 */
function buildPageList(current: number, total: number): (number | "ellipsis")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const out: (number | "ellipsis")[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) out.push("ellipsis");
  for (let p = start; p <= end; p++) out.push(p);
  if (end < total - 1) out.push("ellipsis");
  out.push(total);
  return out;
}

export function DataPagination({
  page,
  totalPages,
  total,
  count,
  startIndex,
  endIndex,
  onPageChange,
  noun = "item",
  className,
}: DataPaginationProps) {
  if (totalPages <= 1) return null;

  const pages = buildPageList(page, totalPages);
  const plural = noun.endsWith("s") ? noun : `${noun}s`;

  return (
    <div
      className={
        "flex flex-col items-center justify-between gap-3 px-1 py-2 sm:flex-row " +
        (className ?? "")
      }
    >
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {total === 0 ? (
          <>No {plural}</>
        ) : (
          <>
            Showing{" "}
            <span className="font-semibold text-foreground">
              {startIndex + 1}
              {"–"}
              {endIndex}
            </span>{" "}
            of <span className="font-semibold text-foreground">{total}</span>{" "}
            {total === 1 ? noun : plural}
          </>
        )}
      </p>

      <Pagination className="mx-0 sm:justify-end">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              href="#"
              aria-disabled={page <= 1}
              className={page <= 1 ? "pointer-events-none opacity-50" : ""}
              onClick={(e) => {
                e.preventDefault();
                if (page > 1) onPageChange(page - 1);
              }}
            />
          </PaginationItem>

          {pages.map((p, idx) =>
            p === "ellipsis" ? (
              <PaginationItem key={`ellipsis-${idx}`}>
                <PaginationEllipsis />
              </PaginationItem>
            ) : (
              <PaginationItem key={p}>
                <PaginationLink
                  href="#"
                  isActive={p === page}
                  onClick={(e) => {
                    e.preventDefault();
                    onPageChange(p);
                  }}
                >
                  {p}
                </PaginationLink>
              </PaginationItem>
            )
          )}

          <PaginationItem>
            <PaginationNext
              href="#"
              aria-disabled={page >= totalPages}
              className={
                page >= totalPages ? "pointer-events-none opacity-50" : ""
              }
              onClick={(e) => {
                e.preventDefault();
                if (page < totalPages) onPageChange(page + 1);
              }}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
}
