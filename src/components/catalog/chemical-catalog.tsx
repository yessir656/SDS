"use client";

// ============================================================================
// ChemicalCatalog — main catalog view with stats, search, filters, grid
// ============================================================================

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  SlidersHorizontal,
  Inbox,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardStats } from "./dashboard-stats";
import { SearchBar } from "./search-bar";
import { FilterPanel, FilterControls } from "./filter-panel";
import { ChemicalCard } from "./chemical-card";
import { searchChemicals } from "@/lib/local-db";
import { useAppStore } from "@/store/app-store";

export function ChemicalCatalog() {
  const query = useAppStore((s) => s.query);
  const [showFilters, setShowFilters] = useState(false);

  const activeFilterCount =
    query.departments.length +
    query.signalWords.length +
    query.hazardClasses.length;

  // Reactive query: re-runs whenever the query object changes.
  const chemicals = useLiveQuery(
    async () => searchChemicals(query),
    [query],
    undefined
  );

  const isLoading = chemicals === undefined;
  const isEmpty = !isLoading && chemicals.length === 0;

  return (
    <div className="space-y-5">
      {/* Dashboard / stats overview */}
      <DashboardStats />

      {/* Search + filter toggle */}
      <div className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="flex-1">
            <SearchBar />
          </div>
          <Button
            variant="outline"
            onClick={() => setShowFilters((v) => !v)}
            className="h-11 gap-2 sm:w-auto"
            aria-expanded={showFilters}
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filters
            {activeFilterCount > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-navy-600 px-1 text-xs font-bold text-white">
                {activeFilterCount}
              </span>
            )}
          </Button>
        </div>

        {/* Active filter summary (always visible when filters active) */}
        {activeFilterCount > 0 && !showFilters && <FilterPanel />}

        {/* Expandable full filter controls */}
        {showFilters && (
          <Card>
            <CardContent className="p-4">
              <FilterControls />
            </CardContent>
          </Card>
        )}
      </div>

      {/* Results count */}
      {!isLoading && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing{" "}
            <span className="font-semibold text-foreground">
              {chemicals.length}
            </span>{" "}
            {chemicals.length === 1 ? "chemical" : "chemicals"}
          </p>
        </div>
      )}

      {/* Chemical grid */}
      {isLoading ? (
        <ChemicalGridSkeleton />
      ) : isEmpty ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {chemicals.map((chemical) => (
            <ChemicalCard key={chemical.id} chemical={chemical} />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function ChemicalGridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
        <Card key={i}>
          <CardContent className="space-y-3 p-4">
            <div className="flex justify-between">
              <div className="space-y-2">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-3 w-40" />
              </div>
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-9 w-9" />
              <Skeleton className="h-9 w-9" />
            </div>
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-2/3" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
          <Inbox className="h-7 w-7 text-muted-foreground" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-semibold">No chemicals found</h3>
          <p className="max-w-sm text-sm text-muted-foreground">
            Try adjusting your search term or clearing some filters to see more
            results.
          </p>
        </div>
        <SearchEmptyHint />
      </CardContent>
    </Card>
  );
}

function SearchEmptyHint() {
  return (
    <div className="mt-2 flex items-center gap-1.5 rounded-md bg-amber-50 px-3 py-1.5 text-xs text-amber-700 dark:bg-amber-950 dark:text-amber-300">
      <AlertCircle className="h-3.5 w-3.5" />
      <span>Search looks at name, trade name, CAS number, and formula.</span>
    </div>
  );
}
