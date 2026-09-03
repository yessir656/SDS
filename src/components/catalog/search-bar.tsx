"use client";

// ============================================================================
// SearchBar — hero search with type-ahead suggestions
// Fresh: oversized pill input that anchors the catalog, with a frosted dropdown.
// Same contracts: useAppStore.setSearch + db.chemicals live query.
// ============================================================================

import { useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Search, X, CornerDownLeft } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/local-db";
import { useAppStore } from "@/store/app-store";
import { cn } from "@/lib/utils";

export function SearchBar() {
  const search = useAppStore((s) => s.query.search);
  const setSearch = useAppStore((s) => s.setSearch);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const allChemicals = useLiveQuery(() => db.chemicals.toArray(), [], []);

  const suggestions = (() => {
    const term = search.trim().toLowerCase();
    if (!term || allChemicals.length === 0) return [];
    const matches = new Set<string>();
    for (const c of allChemicals) {
      if (c.chemicalName.toLowerCase().includes(term))
        matches.add(c.chemicalName);
      if (c.tradeName && c.tradeName.toLowerCase().includes(term))
        matches.add(c.tradeName);
      if (c.casNumber.toLowerCase().includes(term))
        matches.add(c.casNumber);
      if (c.formula.toLowerCase().includes(term))
        matches.add(c.formula);
    }
    return Array.from(matches).slice(0, 6);
  })();

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      setSearch(suggestions[activeIndex]);
      setShowSuggestions(false);
      setActiveIndex(-1);
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
      setActiveIndex(-1);
    }
  };

  const clearSearch = () => {
    setSearch("");
    inputRef.current?.focus();
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="group relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-mirdc-cyan" />
        <Input
          ref={inputRef}
          id="catalog-search"
          type="search"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setActiveIndex(-1);
          }}
          onFocus={() => {
            if (suggestions.length > 0) setShowSuggestions(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Search by name, trade name, CAS number, or formula…"
          className="h-14 rounded-2xl border-2 border-border bg-card pl-12 pr-12 text-base shadow-panel transition-colors placeholder:text-muted-foreground/70 focus-visible:border-mirdc-cyan focus-visible:ring-mirdc-cyan/20"
          aria-label="Search chemicals"
          aria-autocomplete="list"
          aria-expanded={showSuggestions}
          aria-controls="search-suggestions"
        />
        {search && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={clearSearch}
            className="absolute right-2 top-1/2 h-9 w-9 -translate-y-1/2 rounded-full"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Frosted dropdown with type-ahead suggestions */}
      {showSuggestions && search.trim() && (
        <ul
          id="search-suggestions"
          role="listbox"
          className="absolute z-50 mt-2 w-full overflow-hidden rounded-2xl border border-border bg-popover/95 shadow-panel backdrop-blur-md"
        >
          {suggestions.length === 0 ? (
            <li className="px-4 py-3 text-sm text-muted-foreground">
              No matches found
            </li>
          ) : (
            suggestions.map((suggestion, idx) => (
              <li
                key={suggestion}
                role="option"
                aria-selected={idx === activeIndex}
                onMouseDown={(e) => {
                  e.preventDefault();
                  setSearch(suggestion);
                  setShowSuggestions(false);
                  setActiveIndex(-1);
                }}
                onMouseEnter={() => setActiveIndex(idx)}
                className={cn(
                  "flex cursor-pointer items-center justify-between gap-2 px-4 py-2.5 text-sm transition-colors",
                  idx === activeIndex
                    ? "bg-mirdc-cyan/10 text-foreground"
                    : "hover:bg-muted/60"
                )}
              >
                <span className="truncate font-medium">{suggestion}</span>
                {idx === activeIndex && (
                  <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                )}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}