"use client";

// ============================================================================
// SearchBar — instant search with type-ahead suggestions
// Uses useLiveQuery for reactive, effect-free suggestion fetching.
// ============================================================================

import { useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Search, X, ArrowRight } from "lucide-react";
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

  // Load all chemicals once via live query (reactive to DB changes).
  const allChemicals = useLiveQuery(() => db.chemicals.toArray(), [], []);

  // Compute suggestions synchronously from the loaded chemicals.
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

  // Close suggestions when clicking outside.
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
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
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
          className="h-11 pl-9 pr-9 text-sm"
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
            className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Type-ahead suggestions dropdown */}
      {showSuggestions && search.trim() && (
        <ul
          id="search-suggestions"
          role="listbox"
          className="absolute z-50 mt-1 w-full overflow-hidden rounded-lg border border-border bg-popover border border-border"
        >
          {suggestions.length === 0 ? (
            <li className="px-3 py-2.5 text-sm text-muted-foreground">
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
                  "flex cursor-pointer items-center justify-between gap-2 px-3 py-2 text-sm transition-colors",
                  idx === activeIndex
                    ? "bg-accent text-accent-foreground"
                    : "hover:bg-accent/50"
                )}
              >
                <span className="truncate">{suggestion}</span>
                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
