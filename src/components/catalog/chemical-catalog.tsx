"use client";

// ============================================================================
// ChemicalCatalog — fresh catalog shell
// Telemetry strip → hero search + filter toggle → active-filter summary →
// specimen-card list (2-col on desktop, 1-col mobile) → pagination.
// Contracts preserved: searchChemicals + usePagination + DataPagination.
// ============================================================================

import { useState, useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { SlidersHorizontal, Inbox, AlertCircle, FilterX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardStats } from "./dashboard-stats";
import { SearchBar } from "./search-bar";
import { FilterPanel, FilterControls } from "./filter-panel";
import { ChemicalCard } from "./chemical-card";
import { RecentlyViewed } from "./recently-viewed";
import { DataPagination } from "@/components/common/data-pagination";
import { usePagination } from "@/hooks/use-pagination";
import { searchChemicals } from "@/lib/local-db";
import { useAppStore } from "@/store/app-store";

const PAGE_SIZE = 8;

export function ChemicalCatalog() {
  const query = useAppStore((s) => s.query);
  const clearFilters = useAppStore((s) => s.clearFilters);
  const [showFilters, setShowFilters] = useState(false);

  const activeFilterCount =
    query.departments.length +
    query.signalWords.length +
    query.hazardClasses.length +
    query.regulatoryTags.length +
    (query.hasRegulatoryTag ? 1 : 0);

  const chemicals = useLiveQuery(
    async () => searchChemicals(query),
    [query],
    undefined
  );

  const isLoading = chemicals === undefined;
  const safeChemicals = useMemo(() => chemicals ?? [], [chemicals]);
  const isEmpty = !isLoading && safeChemicals.length === 0;

  // Whether the user has typed a search term or activated any filter — used to
  // hide the "Recently viewed" strip (it would just be noise among results).
  const hasActiveQuery =
    query.search.trim() !== "" || activeFilterCount > 0;

  const pagination = usePagination({
    pageSize: PAGE_SIZE,
    total: safeChemicals.length,
    deps: [query.search, query.departments, query.signalWords, query.hazardClasses, query.regulatoryTags, query.hasRegulatoryTag, isLoading],
  });
  const pageItems = pagination.paginate(safeChemicals);

  return (
    <div className="space-y-6">
      {/* 1. Telemetry strip (KPIs + hazard/division breakdowns) */}
      <DashboardStats />

      {/* 2. Recently viewed (only when no active search/filters) */}
      <RecentlyViewed hasActiveQuery={hasActiveQuery} />

      {/* 3. Hero search + filter toggle — sticky below the navy header so
            search stays reachable even on a long scrolled catalog. */}
      <div className="sticky top-16 z-30 -mx-4 space-y-3 bg-background/80 px-4 py-3 backdrop-blur-md sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="flex flex-col gap-2.5 sm:flex-row">
          <div className="flex-1">
            <SearchBar />
          </div>
          <Button
            variant="outline"
            onClick={() => setShowFilters((v) => !v)}
            className={cnFilters(showFilters, activeFilterCount)}
            aria-expanded={showFilters}
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filters
            {activeFilterCount > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-mirdc-cyan px-1.5 text-xs font-bold text-white">
                {activeFilterCount}
              </span>
            )}
          </Button>
        </div>

        {/* Active-filter summary (always visible when filters active) */}
        {activeFilterCount > 0 && !showFilters && <FilterPanel />}

        {/* Expandable full filter controls — height-capped + scrollable */}
        {showFilters && (
          <div className="max-h-[60vh] overflow-y-auto rounded-2xl border border-border bg-card p-4 shadow-panel scrollbar-thin">
            <FilterControls />
          </div>
        )}
      </div>

      {/* 3. Results count */}
      {!isLoading && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing{" "}
            <span className="font-semibold text-foreground">
              {safeChemicals.length}
            </span>{" "}
            {safeChemicals.length === 1 ? "chemical" : "chemicals"}
            {pagination.totalPages > 1 && (
              <>
                {" "}· page{" "}
                <span className="font-semibold text-foreground">
                  {pagination.page}
                </span>{" "}
                of {pagination.totalPages}
              </>
            )}
          </p>
        </div>
      )}

      {/* 4. Specimen-card list */}
      {isLoading ? (
        <CatalogSkeleton />
      ) : isEmpty ? (
        <EmptyState
          hasActiveQuery={hasActiveQuery}
          onClearFilters={() => clearFilters()}
        />
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-2">
            {pageItems.map((chemical) => (
              <ChemicalCard key={chemical.id} chemical={chemical} />
            ))}
          </div>
          <DataPagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            total={pagination.total}
            count={pagination.count}
            startIndex={pagination.startIndex}
            endIndex={pagination.endIndex}
            onPageChange={pagination.setPage}
            noun="chemical"
          />
        </div>
      )}
    </div>
  );
}

function cnFilters(showFilters: boolean, active: number) {
  const base = "h-14 gap-2 rounded-2xl border-2 sm:w-auto px-5 ";
  if (showFilters) {
    return base + "border-navy-600 bg-navy-600 text-white hover:bg-navy-700";
  }
  if (active > 0) {
    return base + "border-mirdc-cyan bg-mirdc-cyan/5 text-foreground hover:bg-mirdc-cyan/10";
  }
  return base + "border-border bg-card text-foreground hover:border-mirdc-cyan/50";
}

// ---------------------------------------------------------------------------

function CatalogSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className="flex gap-3 rounded-2xl border border-border bg-card p-4 shadow-panel"
        >
          <div className="w-1.5 shrink-0 rounded-full bg-muted" />
          <div className="flex-1 space-y-3">
            <div className="flex justify-between gap-3">
              <div className="space-y-2">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-3 w-52" />
              </div>
              <Skeleton className="h-6 w-16 rounded-md" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-9 w-9" />
              <Skeleton className="h-9 w-9" />
            </div>
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({
  hasActiveQuery,
  onClearFilters,
}: {
  hasActiveQuery: boolean;
  onClearFilters: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border bg-card px-6 py-16 text-center shadow-panel">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
        <Inbox className="h-8 w-8 text-muted-foreground" />
      </div>
      <div className="space-y-1.5">
        <h3 className="text-lg font-semibold">No chemicals found</h3>
        <p className="max-w-sm text-sm text-muted-foreground">
          {hasActiveQuery
            ? "Try adjusting your search term or clearing your filters to see more results."
            : "The catalog is empty. An administrator can add chemicals from the admin dashboard."}
        </p>
      </div>
      {hasActiveQuery ? (
        <Button onClick={onClearFilters} className="gap-2">
          <FilterX className="h-4 w-4" />
          Clear search &amp; filters
        </Button>
      ) : null}
      <div className="flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-1.5 text-xs text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
        <AlertCircle className="h-3.5 w-3.5" />
        <span>Search looks at name, trade name, CAS number, and formula.</span>
      </div>
    </div>
  );
}