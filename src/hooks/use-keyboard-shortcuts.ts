"use client";

// ============================================================================
// useKeyboardShortcuts — global power-user shortcuts for the public PWA.
//   `/`            → focus the catalog search box (catalog view only)
//   `Escape`       → back: emergency → detail → catalog
//   `e` / `E`      → jump straight to the selected chemical's emergency info
// ============================================================================

import { useEffect } from "react";
import { useAppStore } from "@/store/app-store";

export function useKeyboardShortcuts() {
  const currentView = useAppStore((s) => s.currentView);
  const selectedChemical = useAppStore((s) => s.selectedChemical);
  const goCatalog = useAppStore((s) => s.goCatalog);
  const goToDetail = useAppStore((s) => s.goToDetail);
  const goToEmergency = useAppStore((s) => s.goToEmergency);

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
      const hasSelection =
        typeof window !== "undefined" && !!window.getSelection()?.toString();

      // --- Escape: always allowed (even while typing) — pops one view back.
      if (e.key === "Escape") {
        if (currentView === "catalog" && isTyping) {
          return;
        }
        if (currentView === "emergency" && selectedChemical) {
          goToDetail(selectedChemical);
        } else if (currentView === "detail") {
          goCatalog();
        }
        return;
      }

      if (isTyping || hasSelection) return;

      // --- `/` focuses the catalog search.
      if (e.key === "/" && currentView === "catalog") {
        e.preventDefault();
        document.getElementById("catalog-search")?.focus();
        return;
      }

      // --- `e` opens emergency info for the selected chemical.
      if ((e.key === "e" || e.key === "E") && selectedChemical) {
        e.preventDefault();
        goToEmergency(selectedChemical);
        return;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [currentView, selectedChemical, goCatalog, goToDetail, goToEmergency]);
}