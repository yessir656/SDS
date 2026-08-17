// ============================================================================
// usePagination — small client-side pagination hook.
//
// Keeps the current page in state and clamps it when the total number of
// pages shrinks (e.g. when the user types a search term that reduces the
// result set). Pass a `deps` array (like useEffect deps) so the page resets
// to 1 whenever the underlying filter/query changes.
//
// Implementation note: both the clamp and the reset use the React-blessed
// "adjust state during render" pattern (conditional setState during render)
// rather than useEffect+setState, which Next.js 16 / React 19 flags as a
// cascading-render hazard.
// ============================================================================

import { useState, useCallback } from "react";

export interface UsePaginationOptions {
  /** Items shown per page. */
  pageSize: number;
  /** Total number of items in the (filtered) result set. */
  total: number;
  /**
   * When any of these values change, the page resets to 1. Use this to react
   * to search-term / filter changes so the user never lands on an empty page.
   */
  deps?: unknown[];
  /** Initial page (1-based). Defaults to 1. */
  initialPage?: number;
}

export interface UsePaginationResult {
  page: number;
  pageSize: number;
  totalPages: number;
  total: number;
  /** Index (0-based) of the first item on the current page. */
  startIndex: number;
  /** Index (0-based) of the last item on the current page (exclusive end = startIndex + count). */
  endIndex: number;
  /** Number of items actually on the current page (<= pageSize). */
  count: number;
  setPage: (page: number) => void;
  nextPage: () => void;
  prevPage: () => void;
  /** Slice an array down to the current page. */
  paginate: <T>(items: T[]) => T[];
}

export function usePagination({
  pageSize,
  total,
  deps = [],
  initialPage = 1,
}: UsePaginationOptions): UsePaginationResult {
  const [page, setPage] = useState(initialPage);
  // Track the dep signature we last saw so we can reset to page 1 when the
  // caller's filters change. Serialized so inline-array deps compare stably.
  const depSignature = JSON.stringify(deps);
  const [lastSignature, setLastSignature] = useState(depSignature);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);

  // --- Adjust state during render (React-blessed pattern) -----------------
  // 1. Reset to page 1 when the caller's filter signature changes.
  if (depSignature !== lastSignature) {
    setLastSignature(depSignature);
    setPage(1);
  }
  // 2. Clamp the stored page if the result set shrank beneath it. Persisting
  //    the clamped value keeps subsequent "next" clicks correct.
  if (page !== safePage) {
    setPage(safePage);
  }

  const startIndex = (safePage - 1) * pageSize;
  const count = Math.min(pageSize, Math.max(0, total - startIndex));
  const endIndex = startIndex + count;

  const goTo = useCallback(
    (p: number) => {
      setPage(Math.min(Math.max(1, p), totalPages));
    },
    [totalPages]
  );
  const next = useCallback(
    () => setPage((p) => Math.min(totalPages, p + 1)),
    [totalPages]
  );
  const prev = useCallback(() => setPage((p) => Math.max(1, p - 1)), []);

  const paginate = useCallback(
    <T,>(items: T[]): T[] => items.slice(startIndex, endIndex),
    [startIndex, endIndex]
  );

  return {
    page: safePage,
    pageSize,
    totalPages,
    total,
    startIndex,
    endIndex,
    count,
    setPage: goTo,
    nextPage: next,
    prevPage: prev,
    paginate,
  };
}
