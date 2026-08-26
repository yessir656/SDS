"use client";

// ============================================================================
// DashboardStats — overview statistics for the chemical catalog.
//
// UX notes:
//   - KPI cards are CLICKABLE filters: Total=clear, DANGER/WARNING toggle the
//     signal word, Regulated toggles "has any regulatory tag". Active state is
//     highlighted. Divisions is a meta-count (not a filter) so it stays static.
//   - Breakdown rows are clickable too: tapping a division row filters the
//     catalog to that division; tapping a regulated-agency row filters to that
//     tag. Active rows highlight so the tap visibly "did something".
//   - Compact on phones: tighter padding/typography below sm, 2-column KPI
//     grid (the 5th card spans both columns), denser breakdown rows.
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
import { Card, CardContent } from "@/components/ui/card";
import { GhsPictogram } from "@/components/ghs/pictograms";
import { cn } from "@/lib/utils";

export function DashboardStats() {
  // useLiveQuery keeps the stats reactive to DB changes.
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

  if (!stats) {
    return <StatsSkeleton />;
  }

  const hasAnyFilter =
    query.departments.length > 0 ||
    query.signalWords.length > 0 ||
    query.hazardClasses.length > 0 ||
    query.regulatoryTags.length > 0 ||
    query.hasRegulatoryTag;

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* KPI cards — tap to filter */}
      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-5">
        <StatCard
          icon={<FlaskConical className="h-4 w-4" />}
          label="Total Chemicals"
          value={stats.totalChemicals}
          accent="navy"
          onClick={hasAnyFilter ? clearFilters : undefined}
          active={false}
          title={hasAnyFilter ? "Tap to clear all filters" : undefined}
        />
        <StatCard
          icon={<ShieldAlert className="h-4 w-4" />}
          label="DANGER"
          value={stats.dangerCount}
          accent="red"
          onClick={() => toggleSignalWord("danger")}
          active={query.signalWords.includes("danger")}
        />
        <StatCard
          icon={<AlertTriangle className="h-4 w-4" />}
          label="WARNING"
          value={stats.warningCount}
          accent="amber"
          onClick={() => toggleSignalWord("warning")}
          active={query.signalWords.includes("warning")}
        />
        <StatCard
          icon={<Building2 className="h-4 w-4" />}
          label="Divisions"
          value={stats.departmentCounts.filter((d) => d.count > 0).length}
          accent="slate"
        />
        <StatCard
          icon={<Scale className="h-4 w-4" />}
          label="Regulated"
          value={stats.regulatedCount}
          accent="violet"
          onClick={stats.regulatedCount > 0 ? toggleRegulatedOnly : undefined}
          active={query.hasRegulatoryTag}
          title="Show only regulated chemicals"
        >
          {stats.regulatoryTagCounts.length > 0 && (
            <span className="mt-0.5 block truncate text-[10px] font-medium text-muted-foreground">
              {stats.regulatoryTagCounts
                .slice(0, 2)
                .map((t) => t.tag)
                .join(", ")}
              {stats.regulatoryTagCounts.length > 2
                ? ` +${stats.regulatoryTagCounts.length - 2}`
                : ""}
            </span>
          )}
        </StatCard>
      </div>

      {/* Pictogram distribution + division breakdown */}
      <div className="grid gap-2 sm:gap-3 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <CardContent className="p-3 sm:p-4">
            <h3 className="mb-2.5 text-[13px] font-semibold text-muted-foreground sm:mb-3 sm:text-sm">
              Most Common Hazards
            </h3>
            {stats.pictogramCounts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No data</p>
            ) : (
              <div className="space-y-2 sm:space-y-2.5">
                {stats.pictogramCounts.slice(0, 6).map((p) => {
                  const max = stats.pictogramCounts[0]?.count ?? 1;
                  const pct = Math.round((p.count / max) * 100);
                  return (
                    <div key={p.pictogram} className="flex items-center gap-2.5 sm:gap-3">
                      <GhsPictogram pictogram={p.pictogram} size={24} />
                      <div className="flex-1">
                        <div className="flex items-baseline justify-between">
                          <span className="text-[11px] font-medium sm:text-xs">
                            {p.pictogram
                              .split("-")
                              .map((w) => w[0].toUpperCase() + w.slice(1))
                              .join(" ")}
                          </span>
                          <span className="text-[11px] font-semibold text-muted-foreground sm:text-xs">
                            {p.count}
                          </span>
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-navy-500 transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardContent className="p-3 sm:p-4">
            <h3 className="mb-2.5 text-[13px] font-semibold text-muted-foreground sm:mb-3 sm:text-sm">
              Chemicals by Division
            </h3>
            <div className="space-y-1.5 sm:space-y-2">
              {stats.departmentCounts.map((d) => {
                const max = stats.departmentCounts[0]?.count ?? 1;
                const pct = Math.round((d.count / max) * 100);
                const active = query.departments.includes(d.department);
                return (
                  <button
                    key={d.department}
                    onClick={() => toggleDepartment(d.department)}
                    aria-pressed={active}
                    title={
                      active
                        ? `Tap to remove the "${d.department}" filter`
                        : `Filter catalog to ${d.department}`
                    }
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-lg p-1.5 text-left transition-colors sm:gap-3",
                      active
                        ? "bg-navy-100 ring-1 ring-navy-400 dark:bg-navy-900/60 dark:ring-navy-700"
                        : "hover:bg-muted/60"
                    )}
                  >
                    <div
                      className={cn(
                        "flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[11px] font-bold sm:h-7 sm:w-7 sm:text-xs",
                        active
                          ? "bg-navy-600 text-white"
                          : "bg-navy-50 text-navy-700 dark:bg-navy-950 dark:text-navy-300"
                      )}
                    >
                      {d.count}
                    </div>
                    <div className="flex-1">
                      <span className="text-[11px] font-medium sm:text-xs">
                        {d.department}
                      </span>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-navy-600/70 transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Regulatory classification breakdown (hidden until a tag exists) */}
      {stats.regulatoryTagCounts.length > 0 && (
        <Card className="overflow-hidden">
          <CardContent className="p-3 sm:p-4">
            <h3 className="mb-2.5 flex items-center gap-1.5 text-[13px] font-semibold text-muted-foreground sm:mb-3 sm:text-sm">
              <Scale className="h-4 w-4" />
              Regulated Chemicals
              <span className="text-[11px] font-normal opacity-70">
                — tap an agency to filter
              </span>
            </h3>
            <div className="grid gap-x-4 gap-y-1.5 sm:gap-x-6 sm:gap-y-2 lg:grid-cols-3">
              {stats.regulatoryTagCounts.map((t) => {
                const max = stats.regulatoryTagCounts[0]?.count ?? 1;
                const pct = Math.round((t.count / max) * 100);
                const active = query.regulatoryTags.includes(t.tag);
                return (
                  <button
                    key={t.tag}
                    onClick={() => toggleRegulatoryTag(t.tag)}
                    aria-pressed={active}
                    title={
                      active
                        ? `Tap to remove the ${t.tag} filter`
                        : `Filter catalog to ${t.tag} chemicals`
                    }
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg p-1.5 text-left transition-colors",
                      active
                        ? "bg-violet-100 ring-1 ring-violet-400 dark:bg-violet-950/60 dark:ring-violet-800"
                        : "hover:bg-muted/60"
                    )}
                  >
                    <div
                      className={cn(
                        "flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[11px] font-bold sm:h-7 sm:w-7 sm:text-xs",
                        active
                          ? "bg-violet-600 text-white"
                          : "bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300"
                      )}
                    >
                      {t.count}
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="block truncate text-[11px] font-medium sm:text-xs">
                        {t.tag}
                      </span>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-navy-600/70 transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

const ACCENT_STYLES: Record<string, string> = {
  navy: "bg-navy-50/70 dark:bg-navy-950/40",
  red: "bg-red-50/70 dark:bg-red-950/40",
  amber: "bg-amber-50/70 dark:bg-amber-950/40",
  slate: "bg-slate-100 dark:bg-slate-900/40",
  violet:
    "bg-violet-50/70 dark:bg-violet-950/40",
};

const ACCENT_ICON: Record<string, string> = {
  navy: "bg-navy-600 text-white",
  red: "bg-red-600 text-white",
  amber: "bg-amber-500 text-white",
  slate: "bg-slate-600 text-white",
  violet: "bg-violet-600 text-white",
};

function StatCard({
  icon,
  label,
  value,
  accent,
  onClick,
  active,
  title,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  /** When undefined, `children` renders the secondary line instead. */
  value?: number;
  accent: keyof typeof ACCENT_STYLES;
  /** Present ⇒ the card renders as a button (click-to-filter). */
  onClick?: () => void;
  /** Highlights the card when its filter is currently applied. */
  active?: boolean;
  title?: string;
  children?: React.ReactNode;
}) {
  const inner = (
    <CardContent className="flex items-center gap-2.5 p-3 sm:gap-3 sm:p-4">
      <span
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg sm:h-9 sm:w-9",
          ACCENT_ICON[accent]
        )}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <div className="text-xl font-bold leading-none sm:text-2xl">
          {value ?? ""}
        </div>
        <div className="mt-1 truncate text-[11px] font-medium text-muted-foreground sm:text-xs">
          {label}
        </div>
        {children}
      </div>
    </CardContent>
  );

  const base = cn(
    "transition-transform",
    ACCENT_STYLES[accent],
    active && "ring-2 ring-offset-1 ring-navy-500 dark:ring-offset-background"
  );

  if (onClick) {
    return (
      <button onClick={onClick} title={title} aria-pressed={active} className={cn(base, "text-left hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-500")}>
        {inner}
      </button>
    );
  }
  return <Card className={base} title={title}>{inner}</Card>;
}

function StatsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-5">
      {[0, 1, 2, 3, 4].map((i) => (
        <Card key={i} className={i === 4 ? "col-span-2 lg:col-span-1" : ""}>
          <CardContent className="flex items-center gap-2.5 p-3 sm:gap-3 sm:p-4">
            <div className="h-8 w-8 shrink-0 animate-pulse rounded-lg bg-muted sm:h-9 sm:w-9" />
            <div className="space-y-2">
              <div className="h-5 w-12 animate-pulse rounded bg-muted" />
              <div className="h-3 w-20 animate-pulse rounded bg-muted" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
