"use client";

// ============================================================================
// FilterPanel — department / signal word / hazard class filters
// ============================================================================

import { Filter, X, RotateCcw, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/app-store";
import {
  DEPARTMENTS,
  SIGNAL_WORDS,
  ALL_HAZARD_CLASSES,
  HAZARD_CLASS_LABELS,
  REGULATORY_CLASSIFICATIONS,
} from "@/types";
import type { Department, SignalWord, HazardClass } from "@/types";

export function FilterPanel() {
  const query = useAppStore((s) => s.query);
  const toggleDepartment = useAppStore((s) => s.toggleDepartment);
  const toggleSignalWord = useAppStore((s) => s.toggleSignalWord);
  const toggleHazardClass = useAppStore((s) => s.toggleHazardClass);
  const toggleRegulatoryTag = useAppStore((s) => s.toggleRegulatoryTag);
  const toggleRegulatedOnly = useAppStore((s) => s.toggleRegulatedOnly);
  const clearFilters = useAppStore((s) => s.clearFilters);

  const activeCount =
    query.departments.length +
    query.signalWords.length +
    query.hazardClasses.length +
    query.regulatoryTags.length +
    (query.hasRegulatoryTag ? 1 : 0);

  if (activeCount === 0) {
    return null;
  }

  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <Filter className="h-3.5 w-3.5" />
          Active Filters ({activeCount})
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={clearFilters}
          className="h-7 gap-1 px-2 text-xs"
        >
          <RotateCcw className="h-3 w-3" />
          Clear all
        </Button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {/* Department filter chips */}
        {DEPARTMENTS.map((dept: Department) => {
          const active = query.departments.includes(dept);
          return (
            <FilterChip
              key={dept}
              label={dept}
              active={active}
              onToggle={() => toggleDepartment(dept)}
            />
          );
        })}

        <span className="mx-1 self-center text-border">|</span>

        {/* Signal word chips */}
        {SIGNAL_WORDS.map((sw: SignalWord) => {
          const active = query.signalWords.includes(sw);
          return (
            <FilterChip
              key={sw}
              label={sw.toUpperCase()}
              active={active}
              onToggle={() => toggleSignalWord(sw)}
              variant={sw === "danger" ? "danger" : "warning"}
            />
          );
        })}

        <span className="mx-1 self-center text-border">|</span>

        {/* Hazard class chips */}
        {ALL_HAZARD_CLASSES.map((hc: HazardClass) => {
          const active = query.hazardClasses.includes(hc);
          if (!active) return null;
          return (
            <FilterChip
              key={hc}
              label={HAZARD_CLASS_LABELS[hc]}
              active={true}
              onToggle={() => toggleHazardClass(hc)}
            />
          );
        })}

        {query.regulatoryTags.length > 0 && (
          <>
            <span className="mx-1 self-center text-border">|</span>

            {/* Active regulatory tag chips */}
            {REGULATORY_CLASSIFICATIONS.map((tag) => {
              const active = query.regulatoryTags.includes(tag);
              if (!active) return null;
              return (
                <FilterChip
                  key={tag}
                  label={tag}
                  active={true}
                  onToggle={() => toggleRegulatoryTag(tag)}
                />
              );
            })}
          </>
        )}

        {query.hasRegulatoryTag && (
          <>
            <span className="mx-1 self-center text-border">|</span>
            <FilterChip
              label="Regulated"
              active={true}
              onToggle={toggleRegulatedOnly}
            />
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Collapsible filter controls (departments + signal words + hazard dropdown)
// ---------------------------------------------------------------------------

export function FilterControls() {
  const query = useAppStore((s) => s.query);
  const toggleDepartment = useAppStore((s) => s.toggleDepartment);
  const toggleSignalWord = useAppStore((s) => s.toggleSignalWord);
  const toggleHazardClass = useAppStore((s) => s.toggleHazardClass);
  const toggleRegulatoryTag = useAppStore((s) => s.toggleRegulatoryTag);
  const toggleRegulatedOnly = useAppStore((s) => s.toggleRegulatedOnly);
  const clearFilters = useAppStore((s) => s.clearFilters);

  const activeCount =
    query.departments.length +
    query.signalWords.length +
    query.hazardClasses.length +
    query.regulatoryTags.length +
    (query.hasRegulatoryTag ? 1 : 0);

  return (
    <div className="space-y-1.5">
      {/* Header with clear-all when filters are active */}
      {activeCount > 0 && (
        <div className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-1.5">
          <span className="text-xs font-medium text-muted-foreground">
            {activeCount} active {activeCount === 1 ? "filter" : "filters"}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="h-7 gap-1 px-2 text-xs"
          >
            <RotateCcw className="h-3 w-3" />
            Clear all
          </Button>
        </div>
      )}

      {/* Each section collapses independently — keeps the panel compact on
          phones (tap a heading to open/close; open by default). */}
      <FilterSection title="Division">
        <div className="flex flex-wrap gap-1.5">
          {DEPARTMENTS.map((dept: Department) => (
            <FilterChip
              key={dept}
              label={dept}
              active={query.departments.includes(dept)}
              onToggle={() => toggleDepartment(dept)}
            />
          ))}
        </div>
      </FilterSection>

      <FilterSection title="Signal Word">
        <div className="flex flex-wrap gap-1.5">
          {SIGNAL_WORDS.map((sw: SignalWord) => (
            <FilterChip
              key={sw}
              label={sw.toUpperCase()}
              active={query.signalWords.includes(sw)}
              onToggle={() => toggleSignalWord(sw)}
              variant={sw === "danger" ? "danger" : "warning"}
            />
          ))}
        </div>
      </FilterSection>

      <FilterSection title="Hazard Class">
        <div className="flex flex-wrap gap-1.5">
          {ALL_HAZARD_CLASSES.map((hc: HazardClass) => (
            <FilterChip
              key={hc}
              label={HAZARD_CLASS_LABELS[hc]}
              active={query.hazardClasses.includes(hc)}
              onToggle={() => toggleHazardClass(hc)}
            />
          ))}
        </div>
      </FilterSection>

      <FilterSection title="Regulatory">
        <div className="flex flex-wrap gap-1.5">
          <FilterChip
            label="Regulated (any agency)"
            active={query.hasRegulatoryTag}
            onToggle={toggleRegulatedOnly}
          />
          {REGULATORY_CLASSIFICATIONS.map((tag) => (
            <FilterChip
              key={tag}
              label={tag}
              active={query.regulatoryTags.includes(tag)}
              onToggle={() => toggleRegulatoryTag(tag)}
            />
          ))}
        </div>
      </FilterSection>
    </div>
  );
}

// ---------------------------------------------------------------------------

/** Collapsible filter section — native <details> for zero-JS reliability. */
function FilterSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <details open className="group rounded-md border border-border/60">
      <summary className="flex cursor-pointer select-none items-center justify-between px-2.5 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:bg-muted/40 [&::-webkit-details-marker]:hidden">
        {title}
        <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
      </summary>
      <div className="px-2.5 pb-2.5 pt-0.5">{children}</div>
    </details>
  );
}

// ---------------------------------------------------------------------------

function FilterChip({
  label,
  active,
  onToggle,
  variant = "default",
}: {
  label: string;
  active: boolean;
  onToggle: () => void;
  variant?: "default" | "danger" | "warning";
}) {
  const variants: Record<string, string> = {
    default: active
      ? "bg-navy-600 text-white border-navy-600 hover:bg-navy-700"
      : "bg-background text-foreground border-border hover:border-navy-400 hover:bg-accent",
    danger: active
      ? "bg-red-600 text-white border-red-600 hover:bg-red-700"
      : "bg-background text-foreground border-border hover:border-red-400 hover:bg-accent",
    warning: active
      ? "bg-amber-500 text-white border-amber-500 hover:bg-amber-600"
      : "bg-background text-foreground border-border hover:border-amber-400 hover:bg-accent",
  };

  return (
    <button
      onClick={onToggle}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
        variants[variant]
      )}
    >
      {active && <X className="h-3 w-3" />}
      {label}
    </button>
  );
}
