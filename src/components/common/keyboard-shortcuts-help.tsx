"use client";

// ============================================================================
// KeyboardShortcutsHelp — a small "?" button that reveals the global
// shortcuts overlay. Lives in the bottom-left so it never overlaps the
// Emergency FAB (bottom-right).
// ============================================================================

import { useEffect, useState } from "react";
import { Keyboard, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/app-store";

const SHORTCUTS: { keys: string[]; label: string }[] = [
  { keys: ["/"], label: "Focus the catalog search" },
  { keys: ["Esc"], label: "Go back (emergency → detail → catalog)" },
  { keys: ["E"], label: "Open emergency info for the selected chemical" },
  { keys: ["?"], label: "Show this shortcuts panel" },
];

export function KeyboardShortcutsHelp() {
  const [open, setOpen] = useState(false);
  const currentView = useAppStore((s) => s.currentView);

  // Hide the floating "?" button on the detail view — it overlaps the
  // "View SDS PDF" button in the content grid (both sit at bottom-left).
  const showButton = currentView !== "detail";

  // `?` opens the overlay.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      const isTyping =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);
      if (isTyping) return;
      if (e.key === "?") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <>
      {showButton && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Show keyboard shortcuts"
          title="Keyboard shortcuts (?)"
          className={cn(
            "fixed bottom-5 left-5 z-30 hidden h-11 w-11 items-center justify-center rounded-full border border-border bg-card/95 text-muted-foreground shadow-panel backdrop-blur-sm transition-all hover:scale-105 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mirdc-cyan active:scale-95 lg:flex"
          )}
        >
          <Keyboard className="h-5 w-5" />
        </button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Keyboard className="h-5 w-5 text-mirdc-cyan" />
              Keyboard Shortcuts
            </DialogTitle>
            <DialogDescription>
              Power-user shortcuts for navigating the catalog faster. Shortcuts
              are ignored while you&apos;re typing in a field.
            </DialogDescription>
          </DialogHeader>
          <ul className="space-y-2.5">
            {SHORTCUTS.map((s) => (
              <li
                key={s.label}
                className="flex items-center justify-between gap-3"
              >
                <span className="text-sm text-foreground/90">{s.label}</span>
                <div className="flex gap-1">
                  {s.keys.map((k) => (
                    <kbd
                      key={k}
                      className="inline-flex h-7 min-w-7 items-center justify-center rounded-md border border-border bg-muted px-2 font-mono text-xs font-semibold text-foreground shadow-sm"
                    >
                      {k}
                    </kbd>
                  ))}
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex items-center justify-between border-t border-border pt-3">
            <p className="text-[11px] text-muted-foreground">
              Tip: press <kbd className="rounded border border-border bg-muted px-1 font-mono text-[10px]">?</kbd> anywhere to open this again.
            </p>
            <button
              onClick={() => setOpen(false)}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
              Close
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}