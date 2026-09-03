"use client";

// ============================================================================
// FilterPanel — fresh chip + collapsible controls
// Contracts preserved: useAppStore filter actions + DEPARTMENTS/SIGNAL_WORDS/
// ALL_HAZARD_CLASSES/HAZARD_CLASS_LABELS/REGULATORY_CLASSIFICATIONS from types.
// ============================================================================

import { SlidersHorizontal, X, RotateCcw, ChevronDown } from "lucide-react";
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

  if (activeCount === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3 shadow-panel">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        <SlidersHorizontal className="h-3.5 w-3.5 text-mirdc-cyan" />
        Active ({activeCount})
      </div>
      <span className="mx-0.5 h-4 w-px bg-border" />

      {/* Active department chips */}
      {DEPARTMENTS.map((dept: Department) => {
        const active = query.departments.includes(dept);
        if (!active) return null;
        return (
          <FilterChip
            key={dept}
            label={dept}
            active
            onToggle={() => toggleDepartment(dept)}
          />
        );
      })}

      {/* Active signal-word chips */}
      {SIGNAL_WORDS.map((sw: SignalWord) => {
        const active = query.signalWords.includes(sw);
        if (!active) return null;
        return (
          <FilterChip
            key={sw}
            label={sw.toUpperCase()}
            active
            onToggle={() => toggleSignalWord(sw)}
            variant={sw === "danger" ? "danger" : "warning"}
          />
        );
      })}

      {/* Active hazard-class chips */}
      {ALL_HAZARD_CLASSES.map((hc: HazardClass) => {
        const active = query.hazardClasses.includes(hc);
        if (!active) return null;
        return (
          <FilterChip
            key={hc}
            label={HAZARD_CLASS_LABELS[hc]}
            active
            onToggle={() => toggleHazardClass(hc)}
          />
        );
      })}

      {/* Active regulatory-tag chips */}
      {REGULATORY_CLASSIFICATIONS.map((tag) => {
        const active = query.regulatoryTags.includes(tag);
        if (!active) return null;
        return (
          <FilterChip
            key={tag}
            label={tag}
            active
            onToggle={() => toggleRegulatoryTag(tag)}
          />
        );
      })}

      {query.hasRegulatoryTag && (
        <FilterChip label="Regulated" active onToggle={toggleRegulatedOnly} />
      )}

      <Button
        variant="ghost"
        size="sm"
        onClick={clearFilters}
        className="ml-auto h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
      >
        <RotateCcw className="h-3 w-3" />
        Clear all
      </Button>
    </div>
  );
}

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
    <div className="space-y-2">
      {activeCount > 0 && (
        <div className="flex items-center justify-between rounded-lg bg-mirdc-cyan/5 px-3 py-1.5">
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

function FilterSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <details open className="group rounded-lg border border-border/70">
      <summary className="flex cursor-pointer select-none items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:bg-muted/40 [&::-webkit-details-marker]:hidden">
        {title}
        <ChevronDown className="h-3.5 w-3.5 text-mirdc-cyan transition-transform group-open:rotate-180" />
      </summary>
      <div className="px-3 pb-3 pt-0.5">{children}</div>
    </details>
  );
}

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
      : "bg-background text-foreground border-border hover:border-mirdc-cyan hover:bg-mirdc-cyan/5",
    danger: active
      ? "bg-red-600 text-white border-red-600 hover:bg-red-700"
      : "bg-background text-foreground border-border hover:border-red-400 hover:bg-red-50 dark:hover:bg-red-950/30",
    warning: active
      ? "bg-amber-500 text-white border-amber-500 hover:bg-amber-600"
      : "bg-background text-foreground border-border hover:border-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30",
  };

  return (
    <button
      onClick={onToggle}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-all",
        variants[variant]
      )}
    >
      {active && <X className="h-3 w-3" />}
      {label}
    </button>
  );
}