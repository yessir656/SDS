"use client";

// ============================================================================
// ChemicalCard — compact card for the catalog grid
// ============================================================================

import { memo } from "react";
import { MapPin, Building2, ChevronRight, ShieldAlert } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GhsPictogram } from "@/components/ghs/pictograms";
import { cn } from "@/lib/utils";
import type { ChemicalRecord } from "@/types";
import { useAppStore } from "@/store/app-store";

interface ChemicalCardProps {
  chemical: ChemicalRecord;
}

function ChemicalCardInner({ chemical }: ChemicalCardProps) {
  const goToDetail = useAppStore((s) => s.goToDetail);

  const isDanger = chemical.signalWord === "danger";

  return (
    <Card
      onClick={() => goToDetail(chemical)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          goToDetail(chemical);
        }
      }}
      className={cn(
        "group relative cursor-pointer overflow-hidden transition-all duration-200 hover:border-teal-400 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        isDanger && "border-l-4 border-l-red-500",
        !isDanger && "border-l-4 border-l-amber-400"
      )}
    >
      <CardContent className="p-4">
        {/* Top: name + signal word */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-base font-semibold text-foreground group-hover:text-teal-700 dark:group-hover:text-teal-400">
              {chemical.chemicalName}
            </h3>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
              <span className="font-mono">CAS {chemical.casNumber}</span>
              <span aria-hidden>·</span>
              <span className="font-mono">{chemical.formula}</span>
            </div>
          </div>
          <Badge
            variant="outline"
            className={cn(
              "shrink-0 text-[10px] font-bold uppercase tracking-wide",
              isDanger
                ? "border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300"
                : "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300"
            )}
          >
            {chemical.signalWord}
          </Badge>
        </div>

        {/* Middle: GHS pictograms */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {chemical.ghsPictograms.map((p) => (
            <GhsPictogram key={p} pictogram={p} size={36} />
          ))}
        </div>

        {/* Hazard chips */}
        {chemical.hazardClasses.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {chemical.hazardClasses.slice(0, 3).map((hc) => (
              <span
                key={hc}
                className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
              >
                {hc
                  .split("-")
                  .map((w) => w[0].toUpperCase() + w.slice(1))
                  .join(" ")}
              </span>
            ))}
            {chemical.hazardClasses.length > 3 && (
              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                +{chemical.hazardClasses.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Bottom: location + department */}
        <div className="mt-3 flex items-center justify-between gap-2 border-t border-border/60 pt-3 text-xs text-muted-foreground">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="flex items-center gap-1 truncate">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{chemical.storageLocation}</span>
            </span>
            <span className="flex items-center gap-1 truncate">
              <Building2 className="h-3 w-3 shrink-0" />
              <span className="truncate">{chemical.department}</span>
            </span>
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-teal-600" />
        </div>

        {/* Emergency quick-access hint */}
        <div className="mt-2 flex items-center gap-1 text-[10px] font-medium text-red-600/70 dark:text-red-400/70">
          <ShieldAlert className="h-3 w-3" />
          <span>Tap for emergency info</span>
        </div>
      </CardContent>
    </Card>
  );
}

export const ChemicalCard = memo(ChemicalCardInner);
