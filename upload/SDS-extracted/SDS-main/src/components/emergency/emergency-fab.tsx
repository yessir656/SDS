"use client";

// ============================================================================
// EmergencyFab — persistent floating action button for emergency access
// - In detail view: goes directly to the selected chemical's emergency info
// - In catalog view: opens a quick-select dialog to pick a chemical
// ============================================================================

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ShieldAlert, Search, X, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { GhsPictogram } from "@/components/ghs/pictograms";
import { db } from "@/lib/local-db";
import { useAppStore } from "@/store/app-store";
import { cn } from "@/lib/utils";

export function EmergencyFab() {
  const selectedChemical = useAppStore((s) => s.selectedChemical);
  const currentView = useAppStore((s) => s.currentView);
  const goToEmergency = useAppStore((s) => s.goToEmergency);
  const [dialogOpen, setDialogOpen] = useState(false);

  // If we're already in emergency view, don't show the FAB.
  if (currentView === "emergency") return null;

  const handleClick = () => {
    if (selectedChemical) {
      goToEmergency(selectedChemical);
    } else {
      setDialogOpen(true);
    }
  };

  return (
    <>
      <button
        onClick={handleClick}
        aria-label={
          selectedChemical
            ? `Open emergency info for ${selectedChemical.chemicalName}`
            : "Quick access emergency information"
        }
        className={cn(
          "fixed bottom-5 right-5 z-30 flex items-center gap-2 rounded-full bg-red-600 px-4 py-3.5 text-white shadow-lg shadow-red-600/30 transition-all duration-200 hover:bg-red-700 hover:shadow-xl hover:shadow-red-600/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2 active:scale-95",
          "animate-pulse-slow"
        )}
      >
        <ShieldAlert className="h-5 w-5" />
        <span className="text-sm font-bold uppercase tracking-wide">
          Emergency
        </span>
      </button>

      <QuickSelectDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  );
}

// ---------------------------------------------------------------------------

function QuickSelectDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [search, setSearch] = useState("");
  const goToEmergency = useAppStore((s) => s.goToEmergency);

  const chemicals = useLiveQuery(
    async () => {
      const all = await db.chemicals.toArray();
      if (!search.trim()) return all.sort((a, b) => a.chemicalName.localeCompare(b.chemicalName));
      const term = search.toLowerCase();
      return all
        .filter((c) =>
          [c.chemicalName, c.casNumber, c.formula, c.tradeName ?? ""]
            .join(" ")
            .toLowerCase()
            .includes(term)
        )
        .sort((a, b) => a.chemicalName.localeCompare(b.chemicalName));
    },
    [search],
    []
  );

  const handleSelect = (chemicalId: string) => {
    const chemical = chemicals?.find((c) => c.id === chemicalId);
    if (chemical) {
      onOpenChange(false);
      setSearch("");
      goToEmergency(chemical);
    }
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) setSearch("");
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md gap-0 p-0">
        <DialogHeader className="border-b border-border px-4 py-3">
          <DialogTitle className="flex items-center gap-2 text-base">
            <ShieldAlert className="h-5 w-5 text-red-600" />
            Emergency Quick Access
          </DialogTitle>
          <DialogDescription className="text-xs">
            Select a chemical to view its emergency response information.
          </DialogDescription>
        </DialogHeader>

        <div className="border-b border-border p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Type to search chemicals…"
              className="h-10 pl-9 pr-9 text-sm"
              autoFocus
            />
            {search && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSearch("")}
                className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>

        <div className="max-h-[50vh] overflow-y-auto p-2">
          {chemicals && chemicals.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No chemicals found.
            </div>
          ) : (
            <ul className="space-y-1">
              {chemicals?.map((c) => (
                <li key={c.id}>
                  <button
                    onClick={() => handleSelect(c.id)}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <div className="flex gap-1">
                      {c.ghsPictograms.slice(0, 2).map((p) => (
                        <GhsPictogram key={p} pictogram={p} size={28} />
                      ))}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">
                        {c.chemicalName}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        CAS {c.casNumber} · {c.storageLocation}
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
