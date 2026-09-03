"use client";

// ============================================================================
// RecentlyViewed — quick-access chips for the last chemicals the user opened.
// ============================================================================

import { Clock, X, Trash2, ChevronRight, Loader2 } from "lucide-react";
import { useState } from "react";
import { GhsPictogram } from "@/components/ghs/pictograms";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/app-store";
import { useRecentlyViewed } from "@/hooks/use-recently-viewed";
import { getChemicalById } from "@/lib/local-db";
import { toast } from "@/hooks/use-toast";

export function RecentlyViewed({ hasActiveQuery }: { hasActiveQuery: boolean }) {
  const { recents, hydrated, removeRecent, clearRecents } = useRecentlyViewed();
  const goToDetail = useAppStore((s) => s.goToDetail);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  if (!hydrated) return null;
  if (hasActiveQuery) return null;
  if (recents.length === 0) return null;

  const openRecent = async (recentId: string) => {
    if (loadingId) return;
    setLoadingId(recentId);
    try {
      const full = await getChemicalById(recentId);
      if (!full) {
        removeRecent(recentId);
        toast({
          title: "Chemical no longer available",
          description:
            "This chemical was removed from the local database. It has been cleared from your recents.",
          variant: "destructive",
        });
        return;
      }
      goToDetail(full);
    } catch {
      toast({
        title: "Couldn't open chemical",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-3 shadow-panel sm:p-4">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
          <Clock className="h-3.5 w-3.5 text-mirdc-cyan" />
          Recently Viewed
          <span className="font-normal normal-case tracking-normal text-muted-foreground/70">
            · {recents.length}
          </span>
        </h3>
        <button
          onClick={clearRecents}
          className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          title="Clear recently viewed"
          aria-label="Clear recently viewed"
        >
          <Trash2 className="h-3 w-3" />
          Clear
        </button>
      </div>
      <ul className="flex flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:gap-2">
        {recents.map((c) => {
          const isDanger = c.signalWord === "danger";
          const isLoadingThis = loadingId === c.id;
          return (
            <li key={c.id} className="contents">
              <button
                onClick={() => openRecent(c.id)}
                disabled={isLoadingThis}
                className={cn(
                  "group flex w-full items-center gap-2.5 rounded-xl border border-border bg-background px-3 py-2 text-left transition-all hover:border-mirdc-cyan/50 hover:shadow-panel focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mirdc-cyan disabled:cursor-wait disabled:opacity-60 sm:w-auto"
                )}
              >
                <span
                  className={cn(
                    "h-8 w-1 shrink-0 rounded-full",
                    isDanger ? "spine-danger" : "spine-warning"
                  )}
                  aria-hidden
                />
                {c.ghsPictograms[0] && (
                  <GhsPictogram pictogram={c.ghsPictograms[0]} size={28} />
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-foreground">
                    {c.chemicalName}
                  </div>
                  <div className="truncate font-mono text-[11px] text-muted-foreground">
                    CAS {c.casNumber}
                  </div>
                </div>
                {isLoadingThis ? (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-mirdc-cyan" />
                ) : (
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-mirdc-cyan" />
                )}
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    removeRecent(c.id);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      e.stopPropagation();
                      removeRecent(c.id);
                    }
                  }}
                  className="ml-1 flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  title="Remove from recents"
                  aria-label={`Remove ${c.chemicalName} from recently viewed`}
                >
                  <X className="h-3 w-3" />
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}