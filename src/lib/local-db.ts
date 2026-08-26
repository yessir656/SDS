// ============================================================================
// SDS-CHEM — Local Database (Dexie / IndexedDB)
// Offline-first client-side storage. All chemical data is synced from the
// backend; IndexedDB serves as the offline cache so the app works without
// a network connection.
// ============================================================================

import Dexie, { type Table } from "dexie";
import type {
  ChemicalRecord,
  LaboratoryLocation,
  UserPreferences,
  CatalogStats,
  CatalogQuery,
  GhsPictogram,
  Department,
  SdsDocumentRecord,
  SdsBlobCache,
  SyncMeta,
} from "@/types";
import { ALL_GHS_PICTOGRAMS, DEPARTMENTS, REGULATORY_CLASSIFICATIONS } from "@/types";

// ---------------------------------------------------------------------------
// Dexie database definition
// ---------------------------------------------------------------------------

export class SdsChemDatabase extends Dexie {
  chemicals!: Table<ChemicalRecord, string>;
  locations!: Table<LaboratoryLocation, string>;
  preferences!: Table<UserPreferences, string>;
  sdsDocuments!: Table<SdsDocumentRecord, string>;
  sdsBlobs!: Table<SdsBlobCache, string>;
  syncMeta!: Table<SyncMeta, string>;

  constructor() {
    super("sds-chem-db");

    // v1 — original static-seed schema.
    this.version(1).stores({
      chemicals:
        "id, casNumber, chemicalName, formula, tradeName, signalWord, department, *ghsPictograms, *hazardClasses, lastUpdated",
      locations: "id, division, building, hazardLevel",
      preferences: "id",
    });

    // v2 — server-synced schema. Adds SDS documents, cached PDF blobs, and
    // sync metadata. Clears chemicals on upgrade so they re-sync from the
    // backend with the new serverVersion / deletedAt fields.
    this.version(2).stores({
      chemicals:
        "id, casNumber, chemicalName, formula, tradeName, signalWord, department, *ghsPictograms, *hazardClasses, lastUpdated, serverVersion, deletedAt",
      locations: "id, division, building, hazardLevel",
      preferences: "id",
      sdsDocuments: "id, chemicalId, status, version, updatedAt",
      sdsBlobs: "sdsId, version, cachedAt",
      syncMeta: "id",
    }).upgrade(async (tx) => {
      // Clear the old static-seeded chemicals so the sync engine repopulates
      // them from the server with the new field shape.
      await tx.table("chemicals").clear();
      // Initialize sync metadata to trigger a full sync on next launch.
      await tx.table("syncMeta").put({
        id: "default",
        lastSyncTimestamp: 0,
        lastSyncAt: 0,
      });
    });
  }
}

/** Singleton database instance shared across the app. */
export const db = new SdsChemDatabase();

// ---------------------------------------------------------------------------
// Database initialization
// ---------------------------------------------------------------------------

let initPromise: Promise<void> | null = null;

/**
 * Opens the database and ensures default preferences exist.
 * Chemical data is NOT seeded locally — it comes from the backend via the
 * sync engine (see src/lib/sync-engine.ts).
 */
export async function initDatabase(): Promise<void> {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    await db.open();

    // Ensure default preferences exist.
    const prefs = await db.preferences.get("default");
    if (!prefs) {
      await db.preferences.put({
        id: "default",
        theme: "system",
        emergencyModeEnabled: true,
        favoriteChemicals: [],
        lastSearch: "",
      });
    }

    // Ensure sync metadata exists.
    const meta = await db.syncMeta.get("default");
    if (!meta) {
      await db.syncMeta.put({
        id: "default",
        lastSyncTimestamp: 0,
        lastSyncAt: 0,
      });
    }
  })();

  return initPromise;
}

// ---------------------------------------------------------------------------
// CRUD — Chemicals (local reads; writes are server-side via admin API)
// ---------------------------------------------------------------------------

export async function getAllChemicals(): Promise<ChemicalRecord[]> {
  await initDatabase();
  const all = await db.chemicals.toArray();
  return all
    .filter((c) => !c.deletedAt)
    .sort((a, b) => a.chemicalName.localeCompare(b.chemicalName));
}

export async function getChemicalById(
  id: string
): Promise<ChemicalRecord | undefined> {
  await initDatabase();
  return db.chemicals.get(id);
}

// ---------------------------------------------------------------------------
// Search & Filter
// ---------------------------------------------------------------------------

export async function searchChemicals(
  query: CatalogQuery
): Promise<ChemicalRecord[]> {
  await initDatabase();

  const { search, departments, signalWords, hazardClasses, regulatoryTags } =
    query;
  const term = search.trim().toLowerCase();

  let results = await db.chemicals.filter((c) => !c.deletedAt).toArray();

  if (term) {
    results = results.filter((c) => {
      const haystack = [
        c.chemicalName,
        c.tradeName ?? "",
        c.casNumber,
        c.formula,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }

  if (departments.length > 0) {
    results = results.filter((c) => departments.includes(c.department));
  }

  if (signalWords.length > 0) {
    results = results.filter((c) => signalWords.includes(c.signalWord));
  }

  if (hazardClasses.length > 0) {
    results = results.filter((c) =>
      c.hazardClasses.some((hc) => hazardClasses.includes(hc))
    );
  }

  if (regulatoryTags.length > 0) {
    results = results.filter((c) =>
      (c.regulatoryTags ?? []).some((t) => regulatoryTags.includes(t))
    );
  }

  if (query.hasRegulatoryTag) {
    results = results.filter((c) => (c.regulatoryTags ?? []).length > 0);
  }

  results.sort((a, b) =>
    a.chemicalName.localeCompare(b.chemicalName, undefined, {
      sensitivity: "base",
    })
  );

  return results;
}

export async function getSearchSuggestions(
  term: string,
  limit = 6
): Promise<string[]> {
  await initDatabase();
  const t = term.trim().toLowerCase();
  if (!t) return [];

  const all = await db.chemicals.filter((c) => !c.deletedAt).toArray();
  const matches = new Set<string>();

  for (const c of all) {
    if (c.chemicalName.toLowerCase().includes(t)) matches.add(c.chemicalName);
    if (c.tradeName && c.tradeName.toLowerCase().includes(t))
      matches.add(c.tradeName);
    if (c.casNumber.toLowerCase().includes(t)) matches.add(c.casNumber);
    if (c.formula.toLowerCase().includes(t)) matches.add(c.formula);
  }

  return Array.from(matches).slice(0, limit);
}

// ---------------------------------------------------------------------------
// Statistics / Dashboard
// ---------------------------------------------------------------------------

export async function getCatalogStats(
  chemicals?: ChemicalRecord[]
): Promise<CatalogStats> {
  await initDatabase();
  const list = chemicals ?? (await db.chemicals.filter((c) => !c.deletedAt).toArray());

  const dangerCount = list.filter((c) => c.signalWord === "danger").length;
  const warningCount = list.filter((c) => c.signalWord === "warning").length;

  const pictogramCounts: Record<string, number> = {};
  for (const p of ALL_GHS_PICTOGRAMS) pictogramCounts[p] = 0;
  for (const c of list) {
    for (const p of c.ghsPictograms) {
      pictogramCounts[p] = (pictogramCounts[p] ?? 0) + 1;
    }
  }

  const deptCounts: Record<string, number> = {};
  for (const d of DEPARTMENTS) deptCounts[d] = 0;
  for (const c of list) {
    deptCounts[c.department] = (deptCounts[c.department] ?? 0) + 1;
  }

  // Regulatory tags — only tags actually present on ≥1 chemical (mirrors the
  // pictogram style; zero-count tags would just clutter the dashboard).
  const tagCounts: Record<string, number> = {};
  for (const c of list) {
    for (const t of c.regulatoryTags ?? []) {
      tagCounts[t] = (tagCounts[t] ?? 0) + 1;
    }
  }

  return {
    totalChemicals: list.length,
    dangerCount,
    warningCount,
    pictogramCounts: (Object.entries(pictogramCounts) as [GhsPictogram, number][])
      .map(([pictogram, count]) => ({ pictogram, count }))
      .filter((x) => x.count > 0)
      .sort((a, b) => b.count - a.count),
    departmentCounts: (Object.entries(deptCounts) as [Department, number][])
      .map(([department, count]) => ({ department, count }))
      .sort((a, b) => b.count - a.count),
    regulatoryTagCounts: REGULATORY_CLASSIFICATIONS.map((tag) => ({
      tag,
      count: tagCounts[tag] ?? 0,
    })).filter((x) => x.count > 0).sort((a, b) => b.count - a.count),
    regulatedCount: list.filter((c) => (c.regulatoryTags ?? []).length > 0)
      .length,
  };
}

// ---------------------------------------------------------------------------
// SDS Documents (local)
// ---------------------------------------------------------------------------

export async function getSdsForChemical(
  chemicalId: string
): Promise<SdsDocumentRecord | undefined> {
  await initDatabase();
  return db.sdsDocuments.where("chemicalId").equals(chemicalId).first();
}

export async function getSdsBlob(
  sdsId: string
): Promise<SdsBlobCache | undefined> {
  await initDatabase();
  return db.sdsBlobs.get(sdsId);
}

// ---------------------------------------------------------------------------
// Preferences (local-only — never synced)
// ---------------------------------------------------------------------------

export async function getPreferences(): Promise<UserPreferences> {
  await initDatabase();
  const prefs = await db.preferences.get("default");
  return (
    prefs ?? {
      id: "default",
      theme: "system",
      emergencyModeEnabled: true,
      favoriteChemicals: [],
      lastSearch: "",
    }
  );
}

export async function updatePreferences(
  changes: Partial<UserPreferences>
): Promise<void> {
  await initDatabase();
  const current = await getPreferences();
  await db.preferences.put({ ...current, ...changes, id: "default" });
}

export async function toggleFavorite(chemicalId: string): Promise<void> {
  await initDatabase();
  const prefs = await getPreferences();
  const favorites = new Set(prefs.favoriteChemicals);
  if (favorites.has(chemicalId)) {
    favorites.delete(chemicalId);
  } else {
    favorites.add(chemicalId);
  }
  await updatePreferences({ favoriteChemicals: Array.from(favorites) });
}
