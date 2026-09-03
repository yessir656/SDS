"use client";

// ============================================================================
// ChemicalCard — "Specimen Card"
// Fresh: horizontal row with a colored hazard spine on the left, a cluster of
// GHS pictograms, identifiers, hazard chips, and a tap target.
// Contract preserved: ChemicalRecord + useAppStore.goToDetail.
// ============================================================================

import { memo } from "react";
import { MapPin, Building2, ChevronRight, ShieldAlert } from "lucide-react";
import { GhsPictogram } from "@/components/ghs/pictograms";
import { PpeList } from "@/components/common/PpeList";
import { RegulatoryTags } from "@/components/common/RegulatoryTags";
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
    <article
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
        "group relative flex cursor-pointer overflow-hidden rounded-2xl border border-border bg-card shadow-panel transition-all duration-200 hover:-translate-y-0.5 hover:border-mirdc-cyan/50 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mirdc-cyan dark:hover:border-mirdc-cyan/40"
      )}
    >
      {/* Hazard spine — a tall colored bar on the left edge */}
      <div
        className={cn(
          "w-1.5 shrink-0",
          isDanger ? "spine-danger" : "spine-warning"
        )}
        aria-hidden
      />

      <div className="flex min-w-0 flex-1 flex-col gap-3 p-4">
        {/* Header: name + signal word pill */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-lg font-bold tracking-tight text-foreground transition-colors group-hover:text-navy-700 dark:group-hover:text-mirdc-cyan">
              {chemical.chemicalName}
            </h3>
            <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 font-mono text-xs text-muted-foreground">
              <span>CAS {chemical.casNumber}</span>
              <span aria-hidden className="text-border">·</span>
              <span>{chemical.formula}</span>
            </div>
          </div>
          <span
            className={cn(
              "shrink-0 rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wider",
              isDanger
                ? "bg-red-50 text-red-700 ring-1 ring-red-200 dark:bg-red-950/50 dark:text-red-300 dark:ring-red-900"
                : "bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:ring-amber-900"
            )}
          >
            {chemical.signalWord}
          </span>
        </div>

        {/* GHS pictogram cluster */}
        {chemical.ghsPictograms.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {chemical.ghsPictograms.map((p) => (
              <GhsPictogram key={p} pictogram={p} size={38} />
            ))}
          </div>
        )}

        {/* Hazard chips (compact) */}
        {chemical.hazardClasses.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {chemical.hazardClasses.slice(0, 3).map((hc) => (
              <span
                key={hc}
                className="rounded-md bg-navy-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-navy-700 dark:bg-navy-950/60 dark:text-navy-200"
              >
                {hc
                  .split("-")
                  .map((w) => w[0].toUpperCase() + w.slice(1))
                  .join(" ")}
              </span>
            ))}
            {chemical.hazardClasses.length > 3 && (
              <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                +{chemical.hazardClasses.length - 3}
              </span>
            )}
          </div>
        )}

        {/* PPE quick-scan (icons only) */}
        <PpeList items={chemical.personalProtectiveEquipment} iconsOnly />

        {/* Regulatory tags */}
        <RegulatoryTags tags={chemical.regulatoryTags} />

        {/* Footer: location + department + chevron */}
        <div className="mt-auto flex items-center justify-between gap-2 border-t border-border/60 pt-3">
          <div className="flex min-w-0 flex-col gap-1 text-xs">
            <span className="flex items-center gap-1.5 truncate text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-mirdc-cyan" />
              <span className="truncate font-medium text-foreground/80">
                {chemical.storageLocation}
              </span>
            </span>
            <span className="flex items-center gap-1.5 truncate text-muted-foreground">
              <Building2 className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{chemical.department}</span>
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <span className="hidden items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-600 dark:bg-red-950/40 dark:text-red-400 sm:inline-flex">
              <ShieldAlert className="h-3 w-3" />
              Emergency
            </span>
            <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition-all group-hover:translate-x-0.5 group-hover:text-mirdc-cyan" />
          </div>
        </div>
      </div>
    </article>
  );
}

export const ChemicalCard = memo(ChemicalCardInner);