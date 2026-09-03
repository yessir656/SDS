// ============================================================================
// RegulatoryTags — badges for a chemical's regulatory classifications
// (DENR-EMB, PDEA, PNP, ...). Fresh: cyan-accented chips to match the
// command-center palette. Only non-empty tags render.
// Contract preserved: REGULATORY_CLASSIFICATIONS from @/types.
// ============================================================================

"use client";

import { Badge } from "@/components/ui/badge";
import { REGULATORY_CLASSIFICATIONS } from "@/types";

export interface RegulatoryTagsProps {
  tags?: string[] | null;
}

export function RegulatoryTags({ tags }: RegulatoryTagsProps) {
  const allowed = new Set(REGULATORY_CLASSIFICATIONS);
  const safe = (tags ?? []).filter((t) => t && allowed.has(t as typeof REGULATORY_CLASSIFICATIONS[number]));
  const otherCount = (tags ?? []).filter((t) => t && !allowed.has(t as typeof REGULATORY_CLASSIFICATIONS[number])).length;

  const visible: string[] = [...safe];
  if (otherCount > 0) visible.push(`Other (+${otherCount})`);

  if (!visible.length) return null;

  return (
    <div className="mt-2 flex flex-wrap gap-1">
      {visible.map((t) => (
        <Badge
          key={t}
          variant="secondary"
          className="border border-mirdc-cyan/30 bg-mirdc-cyan/5 text-[10px] font-semibold text-navy-700 dark:text-navy-200"
        >
          {t}
        </Badge>
      ))}
    </div>
  );
}