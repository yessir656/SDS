"use client";

// ============================================================================
// SDS-CHEM — Global App State (Zustand)
// Manages single-route SPA view switching, catalog query, and sync status.
// ============================================================================

import { create } from "zustand";
import type { AppView, CatalogQuery, ChemicalRecord, SyncStatus } from "@/types";

interface AppState {
  // --- View routing (single-page, no URL changes) ---
  currentView: AppView;
  selectedChemical: ChemicalRecord | null;

  // --- Catalog query state (search + filters) ---
  query: CatalogQuery;

  // --- Sync status ---
  syncStatus: SyncStatus;
  lastSyncAt: number | null;
  syncError: string | null;

  // --- Actions: view routing ---
  goCatalog: () => void;
  goToDetail: (chemical: ChemicalRecord) => void;
  goToEmergency: (chemical: ChemicalRecord) => void;
  clearSelection: () => void;

  // --- Actions: search & filters ---
  setSearch: (search: string) => void;
  toggleDepartment: (dept: CatalogQuery["departments"][number]) => void;
  toggleSignalWord: (sw: CatalogQuery["signalWords"][number]) => void;
  toggleHazardClass: (hc: CatalogQuery["hazardClasses"][number]) => void;
  toggleRegulatoryTag: (tag: string) => void;
  /** Show only chemicals that carry any regulatory classification tag. */
  toggleRegulatedOnly: () => void;
  clearFilters: () => void;

  // --- Actions: sync ---
  setSyncStatus: (status: SyncStatus, error?: string | null) => void;
  setLastSyncAt: (timestamp: number) => void;
}

const DEFAULT_QUERY: CatalogQuery = {
  search: "",
  departments: [],
  signalWords: [],
  hazardClasses: [],
  regulatoryTags: [],
  hasRegulatoryTag: false,
};

export const useAppStore = create<AppState>((set) => ({
  currentView: "catalog",
  selectedChemical: null,
  query: DEFAULT_QUERY,
  syncStatus: "offline",
  lastSyncAt: null,
  syncError: null,

  goCatalog: () => set({ currentView: "catalog", selectedChemical: null }),

  goToDetail: (chemical) =>
    set({ currentView: "detail", selectedChemical: chemical }),

  goToEmergency: (chemical) =>
    set({ currentView: "emergency", selectedChemical: chemical }),

  clearSelection: () => set({ selectedChemical: null }),

  setSearch: (search) => set((s) => ({ query: { ...s.query, search } })),

  toggleDepartment: (dept) =>
    set((s) => {
      const has = s.query.departments.includes(dept);
      return {
        query: {
          ...s.query,
          departments: has
            ? s.query.departments.filter((d) => d !== dept)
            : [...s.query.departments, dept],
        },
      };
    }),

  toggleSignalWord: (sw) =>
    set((s) => {
      const has = s.query.signalWords.includes(sw);
      return {
        query: {
          ...s.query,
          signalWords: has
            ? s.query.signalWords.filter((x) => x !== sw)
            : [...s.query.signalWords, sw],
        },
      };
    }),

  toggleHazardClass: (hc) =>
    set((s) => {
      const has = s.query.hazardClasses.includes(hc);
      return {
        query: {
          ...s.query,
          hazardClasses: has
            ? s.query.hazardClasses.filter((x) => x !== hc)
            : [...s.query.hazardClasses, hc],
        },
      };
    }),

  toggleRegulatoryTag: (tag) =>
    set((s) => {
      const has = s.query.regulatoryTags.includes(tag);
      return {
        query: {
          ...s.query,
          regulatoryTags: has
            ? s.query.regulatoryTags.filter((x) => x !== tag)
            : [...s.query.regulatoryTags, tag],
        },
      };
    }),

  toggleRegulatedOnly: () =>
    set((s) => ({
      query: { ...s.query, hasRegulatoryTag: !s.query.hasRegulatoryTag },
    })),

  clearFilters: () => set({ query: DEFAULT_QUERY }),

  setSyncStatus: (status, error = null) =>
    set({ syncStatus: status, syncError: error }),

  setLastSyncAt: (timestamp) => set({ lastSyncAt: timestamp }),
}));
