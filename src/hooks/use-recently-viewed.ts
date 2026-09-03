"use client";

// ============================================================================
// useRecentlyViewed — tracks the last N chemicals the user opened in the
// detail view. Stored in localStorage so it survives reloads + offline use.
// ----------------------------------------------------------------------------

import { useCallback, useEffect, useRef, useState } from "react";
import type { ChemicalRecord, GhsPictogram, SignalWord } from "@/types";

const STORAGE_KEY = "sds-chem:recently-viewed";
const MAX_RECENT = 6;

/** Minimal chemical snapshot stored in localStorage. */
export interface RecentChemical {
  id: string;
  chemicalName: string;
  casNumber: string;
  formula: string;
  signalWord: SignalWord;
  ghsPictograms: GhsPictogram[];
  viewedAt: number;
}

function readStore(): RecentChemical[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, MAX_RECENT);
  } catch {
    return [];
  }
}

function writeStore(items: RecentChemical[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(items.slice(0, MAX_RECENT))
    );
  } catch {
    // QuotaExceeded or disabled storage — silently no-op.
  }
}

/** Build a minimal snapshot from a full ChemicalRecord (cheap to store). */
function toRecent(c: ChemicalRecord): RecentChemical {
  return {
    id: c.id,
    chemicalName: c.chemicalName,
    casNumber: c.casNumber,
    formula: c.formula,
    signalWord: c.signalWord,
    ghsPictograms: c.ghsPictograms,
    viewedAt: Date.now(),
  };
}

export function useRecentlyViewed() {
  const [recents, setRecents] = useState<RecentChemical[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const didHydrate = useRef(false);

  useEffect(() => {
    if (didHydrate.current) return;
    didHydrate.current = true;
    const stored = readStore();
    queueMicrotask(() => {
      setRecents(stored);
      setHydrated(true);
    });
  }, []);

  /** Add (or re-add) a chemical to the front of the recents list. */
  const pushRecent = useCallback((chemical: ChemicalRecord) => {
    setRecents((prev) => {
      const snapshot = toRecent(chemical);
      const next = [snapshot, ...prev.filter((r) => r.id !== chemical.id)].slice(
        0,
        MAX_RECENT
      );
      writeStore(next);
      return next;
    });
  }, []);

  /** Remove a specific chemical from recents (used by the chip "x" button). */
  const removeRecent = useCallback((id: string) => {
    setRecents((prev) => {
      const next = prev.filter((r) => r.id !== id);
      writeStore(next);
      return next;
    });
  }, []);

  /** Clear all recents. */
  const clearRecents = useCallback(() => {
    setRecents([]);
    writeStore([]);
  }, []);

  return { recents, hydrated, pushRecent, removeRecent, clearRecents };
}