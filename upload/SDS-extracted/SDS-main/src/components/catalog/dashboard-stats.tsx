"use client";

// ============================================================================
// DashboardStats — overview statistics for the chemical catalog
// ============================================================================

import { useLiveQuery } from "dexie-react-hooks";
import { AlertTriangle, ShieldAlert, FlaskConical, Building2 } from "lucide-react";
import { db, getCatalogStats } from "@/lib/local-db";
import { Card, CardContent } from "@/components/ui/card";
import { GhsPictogram } from "@/components/ghs/pictograms";
import { cn } from "@/lib/utils";

export function DashboardStats() {
  // useLiveQuery keeps the stats reactive to DB changes.
  const stats = useLiveQuery(async () => {
    const all = await db.chemicals.toArray();
    return getCatalogStats(all);
  }, []);

  if (!stats) {
    return <StatsSkeleton />;
  }

  return (
    <div className="space-y-4">
      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          icon={<FlaskConical className="h-4 w-4" />}
          label="Total Chemicals"
          value={stats.totalChemicals}
          accent="teal"
        />
        <StatCard
          icon={<ShieldAlert className="h-4 w-4" />}
          label="DANGER"
          value={stats.dangerCount}
          accent="red"
        />
        <StatCard
          icon={<AlertTriangle className="h-4 w-4" />}
          label="WARNING"
          value={stats.warningCount}
          accent="amber"
        />
        <StatCard
          icon={<Building2 className="h-4 w-4" />}
          label="Departments"
          value={stats.departmentCounts.filter((d) => d.count > 0).length}
          accent="slate"
        />
      </div>

      {/* Pictogram distribution + department breakdown */}
      <div className="grid gap-3 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <CardContent className="p-4">
            <h3 className="mb-3 text-sm font-semibold text-muted-foreground">
              Most Common Hazards
            </h3>
            {stats.pictogramCounts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No data</p>
            ) : (
              <div className="space-y-2.5">
                {stats.pictogramCounts.slice(0, 6).map((p) => {
                  const max = stats.pictogramCounts[0]?.count ?? 1;
                  const pct = Math.round((p.count / max) * 100);
                  return (
                    <div key={p.pictogram} className="flex items-center gap-3">
                      <GhsPictogram pictogram={p.pictogram} size={28} />
                      <div className="flex-1">
                        <div className="flex items-baseline justify-between">
                          <span className="text-xs font-medium">
                            {p.pictogram
                              .split("-")
                              .map((w) => w[0].toUpperCase() + w.slice(1))
                              .join(" ")}
                          </span>
                          <span className="text-xs font-semibold text-muted-foreground">
                            {p.count}
                          </span>
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-teal-500 transition-all duration-500"
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
          <CardContent className="p-4">
            <h3 className="mb-3 text-sm font-semibold text-muted-foreground">
              Chemicals by Department
            </h3>
            <div className="space-y-2.5">
              {stats.departmentCounts.map((d) => {
                const max = stats.departmentCounts[0]?.count ?? 1;
                const pct = Math.round((d.count / max) * 100);
                return (
                  <div key={d.department} className="flex items-center gap-3">
                    <div className="flex h-7 w-7 items-center justify-center rounded-md bg-teal-50 text-xs font-bold text-teal-700 dark:bg-teal-950 dark:text-teal-300">
                      {d.count}
                    </div>
                    <div className="flex-1">
                      <span className="text-xs font-medium">{d.department}</span>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-teal-600/70 transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

const ACCENT_STYLES: Record<string, string> = {
  teal: "border-teal-200 bg-teal-50/50 dark:border-teal-900 dark:bg-teal-950/30",
  red: "border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/30",
  amber: "border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/30",
  slate: "border-slate-200 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-900/30",
};

const ACCENT_ICON: Record<string, string> = {
  teal: "bg-teal-600 text-white",
  red: "bg-red-600 text-white",
  amber: "bg-amber-500 text-white",
  slate: "bg-slate-600 text-white",
};

function StatCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  accent: keyof typeof ACCENT_STYLES;
}) {
  return (
    <Card className={cn("border", ACCENT_STYLES[accent])}>
      <CardContent className="flex items-center gap-3 p-4">
        <span
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
            ACCENT_ICON[accent]
          )}
        >
          {icon}
        </span>
        <div className="min-w-0">
          <div className="text-2xl font-bold leading-none">{value}</div>
          <div className="mt-1 truncate text-xs font-medium text-muted-foreground">
            {label}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StatsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {[0, 1, 2, 3].map((i) => (
        <Card key={i}>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="h-9 w-9 shrink-0 animate-pulse rounded-lg bg-muted" />
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
