// ============================================================================
// PpeList — renders a chemical's PPE as icon + label (+ optional note).
// ----------------------------------------------------------------------------
// Offline-first: icons are inline SVG via lucide-react (no remote images).
// Each item's icon is chosen deterministically from its `code`; the note is
// shown as a small muted badge (e.g. "powder-free").
// ============================================================================

"use client";

import { type ComponentType } from "react";
import {
  Hand,
  Eye,
  Shield,
  Wind,
  Droplet,
  Shirt,
  Footprints,
  User,
  Volume2,
  HelpCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { LucideProps } from "lucide-react";
import type { PpeItem, PpeCode } from "@/types";
import { normalizePpe } from "@/lib/ppe";

const ICON_COLORS: Record<PpeCode, string> = {
  "gloves": "text-navy-600",
  "gloves-powderfree": "text-navy-600",
  "goggles": "text-blue-600",
  "face-shield": "text-green-600",
  "mask": "text-amber-600",
  "respirator": "text-red-600",
  "lab-coat": "text-slate-600",
  "apron": "text-orange-600",
  "boots": "text-amber-800",
  "coverall": "text-indigo-600",
  "hearing": "text-purple-600",
  "other": "text-muted-foreground",
};

const ICON_MAP: Record<PpeCode, ComponentType<LucideProps>> = {
  gloves: Hand,
  "gloves-powderfree": Hand,
  goggles: Eye,
  "face-shield": Shield,
  respirator: Wind,
  mask: Droplet,
  "lab-coat": Shirt,
  apron: Shirt,
  boots: Footprints,
  coverall: User,
  hearing: Volume2,
  other: HelpCircle,
};

export interface PpeListProps {
  /** Raw stored value (string[] / string / PpeItem[]) — normalized automatically. */
  items: string[] | string | PpeItem[] | undefined | null;
  /** Compact pills layout for dense catalog cards. */
  compact?: boolean;
  /** Icon-only quick-scan row (used beside the emergency contact). */
  iconsOnly?: boolean;
}

export function PpeList({ items, compact = false, iconsOnly = false }: PpeListProps) {
  const normalized: PpeItem[] = normalizePpe(items);

  if (!normalized.length) {
    return (
      <span className={`inline text-sm text-muted-foreground ${compact ? "text-xs" : ""}`}>
        None specified
      </span>
    );
  }

  // Icon-only quick-scan row (e.g. beside the emergency contact).
  if (iconsOnly) {
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        {normalized.map((p, i) => {
          const Icon = ICON_MAP[p.code] ?? ICON_MAP.other;
          const color = ICON_COLORS[p.code] ?? ICON_COLORS.other;
          return (
            <span
              key={`${p.label}-${i}`}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-navy-100 dark:bg-navy-900/50"
              title={`${p.label}${p.note ? ` — ${p.note}` : ""}`}
              aria-label={`PPE: ${p.label}`}
            >
              <Icon className={`h-4 w-4 ${color}`} aria-hidden />
            </span>
          );
        })}
      </div>
    );
  }

  return (
    <div
      className={`flex flex-wrap gap-2 ${
        compact ? "gap-1.5" : "gap-2"
      }`}
    >
      {normalized.map((p, i) => {
        const Icon = ICON_MAP[p.code] ?? ICON_MAP.other;
        const color = ICON_COLORS[p.code] ?? ICON_COLORS.other;
        const base = compact
          ? "inline-flex items-center gap-1 rounded-md border border-navy-200 bg-navy-100 px-1.5 py-0.5 text-xs font-medium text-navy-900 dark:border-navy-700 dark:bg-navy-900/50 dark:text-navy-100"
          : "inline-flex items-center gap-2 rounded-lg border border-navy-200 bg-navy-100 px-3 py-2 text-sm font-medium text-navy-900 dark:border-navy-700 dark:bg-navy-900/50 dark:text-navy-100";
        return (
          <span key={`${p.label}-${i}`} className={base}>
            <Icon className={`h-4 w-4 ${color}`} aria-hidden />
            <span>{p.label}</span>
            {p.note && (
              <Badge
                variant="secondary"
                className="ml-1 whitespace-normal font-normal"
                title={p.note}
              >
                {p.note}
              </Badge>
            )}
          </span>
        );
      })}
    </div>
  );
}
