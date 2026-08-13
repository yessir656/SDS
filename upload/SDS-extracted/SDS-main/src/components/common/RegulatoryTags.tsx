// ============================================================================
// RegulatoryTags — badges for a chemical's regulatory classifications
// (DENR-EMB, PDEA, PNP, ...). Only non-empty tags render.
// ============================================================================

"use client";

import { Badge } from "@/components/ui/badge";
import { REGULATORY_CLASSIFICATIONS } from "@/types";

export interface RegulatoryTagsProps {
  tags?: string[] | null;
}

export function RegulatoryTags({ tags }: RegulatoryTagsProps) {
  // Whitelist against the known classification set so admins can't spam the
  // namespace with arbitrary labels; anything else is collapsed into "Other".
  const allowed = new Set(REGULATORY_CLASSIFICATIONS);
  const safe = (tags ?? []).filter((t) => t && allowed.has(t as typeof REGULATORY_CLASSIFICATIONS[number]));
  const otherCount = (tags ?? []).filter((t) => t && !allowed.has(t as typeof REGULATORY_CLASSIFICATIONS[number])).length;

  const visible: string[] = [...safe];
  if (otherCount > 0) visible.push(`Other (+${otherCount})`);

  if (!visible.length) return null;

  return (
    <div className="mt-1.5 flex flex-wrap gap-1">
      {visible.map((t) => (
        <Badge
          key={t}
          variant="secondary"
          className="border-sky-300 bg-sky-50 text-[10px] font-semibold text-sky-800 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-200"
        >
          {t}
        </Badge>
      ))}
    </div>
  );
}
