"use client";

// ============================================================================
// DashboardStats — "Telemetry Strip"
// Fresh layout: a hero KPI ribbon (click-to-filter) + two analytical panels.
// Same data contracts: getCatalogStats() + useAppStore filter actions.
// ============================================================================

import { useLiveQuery } from "dexie-react-hooks";
import {
  AlertTriangle,
  ShieldAlert,
  FlaskConical,
  Building2,
  Scale,
} from "lucide-react";
import { db, getCatalogStats } from "@/lib/local-db";
import { useAppStore } from "@/store/app-store";
import { Card } from "@/components/ui/card";
import { GhsPictogram } from "@/components/ghs/pictograms";
import { cn } from "@/lib/utils";
import type { CatalogStats } from "@/types";

export function DashboardStats() {
  const stats = useLiveQuery(async () => {
    const all = await db.chemicals.toArray();
    return getCatalogStats(all);
  }, []);

  const query = useAppStore((s) => s.query);
  const toggleDepartment = useAppStore((s) => s.toggleDepartment);
  const toggleSignalWord = useAppStore((s) => s.toggleSignalWord);
  const toggleRegulatoryTag = useAppStore((s) => s.toggleRegulatoryTag);
  const toggleRegulatedOnly = useAppStore((s) => s.toggleRegulatedOnly);
  const clearFilters = useAppStore((s) => s.clearFilters);

  if (!stats) return <TelemetrySkeleton />;

  const hasAnyFilter =
    query.departments.length > 0 ||
    query.signalWords.length > 0 ||
    query.hazardClasses.length > 0 ||
    query.regulatoryTags.length > 0 ||
    query.hasRegulatoryTag;

  return (
    <section className="space-y-3">
      {/* --- Hero KPI ribbon --- */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
        <KpiTile
          icon={<FlaskConical className="h-4 w-4" />}
          label="Total Chemicals"
          value={stats.totalChemicals}
          tone="navy"
          onClick={hasAnyFilter ? clearFilters : undefined}
          title={hasAnyFilter ? "Tap to clear all filters" : undefined}
        />
        <KpiTile
          icon={<ShieldAlert className="h-4 w-4" />}
          label="Danger"
          value={stats.dangerCount}
          tone="danger"
          onClick={() => toggleSignalWord("danger")}
          active={query.signalWords.includes("danger")}
        />
        <KpiTile
          icon={<AlertTriangle className="h-4 w-4" />}
          label="Warning"
          value={stats.warningCount}
          tone="warning"
          onClick={() => toggleSignalWord("warning")}
          active={query.signalWords.includes("warning")}
        />
        <KpiTile
          icon={<Building2 className="h-4 w-4" />}
          label="Divisions"
          value={stats.departmentCounts.filter((d) => d.count > 0).length}
          tone="slate"
        />
        <KpiTile
          icon={<Scale className="h-4 w-4" />}
          label="Regulated"
          value={stats.regulatedCount}
          tone="cyan"
          onClick={stats.regulatedCount > 0 ? toggleRegulatedOnly : undefined}
          active={query.hasRegulatoryTag}
          title="Show only regulated chemicals"
        />
      </div>

      {/* --- Analytical panels --- */}
      <div className="grid gap-2.5 lg:grid-cols-2">
        <HazardDistribution stats={stats} />
        <DivisionBreakdown
          stats={stats}
          active={query.departments}
          onToggle={toggleDepartment}
        />
      </div>

      {/* --- Regulatory breakdown (only when any tag exists) --- */}
      {stats.regulatoryTagCounts.length > 0 && (
        <Card className="shadow-panel overflow-hidden">
          <div className="flex items-center gap-2 border-b border-border/60 px-4 py-2.5">
            <Scale className="h-3.5 w-3.5 text-mirdc-cyan" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Regulated Chemicals
            </h3>
            <span className="text-[10px] text-muted-foreground/70">
              — tap an agency to filter
            </span>
          </div>
          <div className="grid gap-x-5 gap-y-2 p-3 sm:grid-cols-2 lg:grid-cols-3">
            {stats.regulatoryTagCounts.map((t) => {
              const max = stats.regulatoryTagCounts[0]?.count ?? 1;
              const pct = Math.round((t.count / max) * 100);
              const active = query.regulatoryTags.includes(t.tag);
              return (
                <button
                  key={t.tag}
                  onClick={() => toggleRegulatoryTag(t.tag)}
                  aria-pressed={active}
                  className={cn(
                    "group flex items-center gap-2.5 rounded-lg p-1.5 text-left transition-colors",
                    active
                      ? "bg-mirdc-cyan/10 ring-1 ring-mirdc-cyan/40"
                      : "hover:bg-muted/50"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[11px] font-bold transition-colors",
                      active
                        ? "bg-mirdc-cyan text-white"
                        : "bg-muted text-foreground"
                    )}
                  >
                    {t.count}
                  </span>
                  <div className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium">
                      {t.tag}
                    </span>
                    <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-mirdc-cyan/70 transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </Card>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------

const TONE_TILE: Record<string, string> = {
  navy: "border-navy-200 bg-navy-50/60 dark:border-navy-800 dark:bg-navy-900/30",
  danger: "border-red-200 bg-red-50/60 dark:border-red-900 dark:bg-red-950/30",
  warning: "border-amber-200 bg-amber-50/60 dark:border-amber-800 dark:bg-amber-950/30",
  slate: "border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/30",
  cyan: "border-mirdc-cyan/30 bg-mirdc-cyan/5 dark:bg-mirdc-cyan/10",
};

const TONE_ICON: Record<string, string> = {
  navy: "bg-navy-600 text-white",
  danger: "bg-red-600 text-white",
  warning: "bg-amber-500 text-white",
  slate: "bg-slate-600 text-white",
  cyan: "bg-mirdc-cyan text-white",
};

function KpiTile({
  icon,
  label,
  value,
  tone,
  onClick,
  active,
  title,
}: {
  icon: React.ReactNode;
  label: string;
  value?: number;
  tone: keyof typeof TONE_TILE;
  onClick?: () => void;
  active?: boolean;
  title?: string;
}) {
  const base = cn(
    "rounded-xl border p-3 transition-all duration-200",
    TONE_TILE[tone],
    active && "ring-2 ring-offset-1 ring-mirdc-cyan dark:ring-offset-background",
    onClick && "cursor-pointer hover:-translate-y-0.5 hover:shadow-panel focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mirdc-cyan"
  );

  const inner = (
    <div className="flex items-center gap-3">
      <span
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
          TONE_ICON[tone]
        )}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <div className="text-2xl font-bold leading-none tabular-nums">
          {value ?? "—"}
        </div>
        <div className="mt-1 truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </div>
      </div>
    </div>
  );

  if (onClick) {
    return (
      <button onClick={onClick} title={title} aria-pressed={active} className={base}>
        {inner}
      </button>
    );
  }
  return (
    <div className={base} title={title}>
      {inner}
    </div>
  );
}

function HazardDistribution({ stats }: { stats: CatalogStats }) {
  return (
    <Card className="shadow-panel overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border/60 px-4 py-2.5">
        <ShieldAlert className="h-3.5 w-3.5 text-red-500" />
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Most Common Hazards
        </h3>
      </div>
      <div className="space-y-2.5 p-4">
        {stats.pictogramCounts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No data</p>
        ) : (
          stats.pictogramCounts.slice(0, 6).map((p) => {
            const max = stats.pictogramCounts[0]?.count ?? 1;
            const pct = Math.round((p.count / max) * 100);
            return (
              <div key={p.pictogram} className="flex items-center gap-3">
                <GhsPictogram pictogram={p.pictogram} size={26} />
                <div className="flex-1">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs font-medium">
                      {p.pictogram
                        .split("-")
                        .map((w) => w[0].toUpperCase() + w.slice(1))
                        .join(" ")}
                    </span>
                    <span className="font-mono text-xs font-semibold text-muted-foreground">
                      {p.count}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-navy-600 to-mirdc-cyan transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
}

function DivisionBreakdown({
  stats,
  active,
  onToggle,
}: {
  stats: CatalogStats;
  active: Department[];
  onToggle: (d: Department) => void;
}) {
  return (
    <Card className="shadow-panel overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border/60 px-4 py-2.5">
        <Building2 className="h-3.5 w-3.5 text-navy-600 dark:text-navy-300" />
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Chemicals by Division
        </h3>
      </div>
      <div className="space-y-1.5 p-3">
        {stats.departmentCounts.map((d) => {
          const max = stats.departmentCounts[0]?.count ?? 1;
          const pct = Math.round((d.count / max) * 100);
          const isActive = active.includes(d.department);
          return (
            <button
              key={d.department}
              onClick={() => onToggle(d.department)}
              aria-pressed={isActive}
              title={isActive ? `Remove "${d.department}" filter` : `Filter to ${d.department}`}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg p-1.5 text-left transition-colors",
                isActive
                  ? "bg-navy-100 ring-1 ring-navy-400 dark:bg-navy-900/60 dark:ring-navy-600"
                  : "hover:bg-muted/60"
              )}
            >
              <span
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-md font-mono text-xs font-bold",
                  isActive
                    ? "bg-navy-600 text-white"
                    : "bg-navy-50 text-navy-700 dark:bg-navy-950 dark:text-navy-300"
                )}
              >
                {d.count}
              </span>
              <div className="flex-1">
                <span className="text-xs font-medium">{d.department}</span>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-navy-600/80 transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </Card>
  );
}

// Local type import to avoid a circular reference issue in the breakdown props.
type Department = import("@/types").Department;

function TelemetrySkeleton() {
  return (
    <section className="space-y-3">
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-[68px] animate-pulse rounded-xl border border-border bg-muted/40"
          />
        ))}
      </div>
      <div className="grid gap-2.5 lg:grid-cols-2">
        {[0, 1].map((i) => (
          <div
            key={i}
            className="h-48 animate-pulse rounded-xl border border-border bg-muted/40"
          />
        ))}
      </div>
    </section>
  );
}