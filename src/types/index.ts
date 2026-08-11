// ============================================================================
// SDS-CHEM — Core Type Definitions
// Safety Data Sheet Centralized System for Chemical Management
// ============================================================================

/**
 * The 9 standard GHS hazard pictograms.
 * Values match the GHS pictogram identifiers used throughout the app.
 */
export type GhsPictogram =
  | "exploding-bomb"
  | "flame"
  | "flame-on-circle"
  | "gas"
  | "corrosion"
  | "skull-and-crossbones"
  | "exclamation-mark"
  | "health-hazard"
  | "environment";

/**
 * GHS hazard classes (derived from the 9 pictograms + finer categories).
 */
export type HazardClass =
  | "explosive"
  | "flammable"
  | "oxidizing"
  | "compressed-gas"
  | "corrosive"
  | "toxic"
  | "harmful"
  | "irritant"
  | "sensitizer"
  | "carcinogen"
  | "reproductive-toxicant"
  | "specific-target-organ-toxicity"
  | "environmentally-hazardous";

/** GHS signal words — only two exist in the standard. */
export type SignalWord = "danger" | "warning";

/**
 * Laboratory departments / divisions at MIRDC.
 * Used for filtering chemicals by owning unit.
 */
export type Department =
  | "Chemical Analysis"
  | "Corrosion Testing"
  | "Metallography"
  | "Physical Metallurgy";

/** Sync status for local-vs-remote data tracking. */
export type SyncStatus =
  | "synced"
  | "local-changes"
  | "syncing"
  | "offline"
  | "error";

/** GHS pictogram metadata for display. */
export interface GhsPictogramInfo {
  id: GhsPictogram;
  label: string;
  description: string;
}

/** A single SDS section (standard GHS 16-section structure). */
export interface SdsSection {
  /** Section number 1–16. */
  number: number;
  title: string;
  /** Markdown-ish plain text content. */
  content: string;
  /** Whether this section is emergency-critical. */
  emergencyCritical?: boolean;
}

/** A Safety Data Sheet document linked to a chemical. */
export interface SdsDocument {
  id: string;
  chemicalId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  contentHash: string;
  uploadDate: number;
  version: string;
  sections: SdsSection[];
  /** Local storage path (informational in offline-first model). */
  localPath: string;
  isCached: boolean;
}

/** Physical laboratory location where a chemical is stored. */
export interface LaboratoryLocation {
  id: string;
  division: Department;
  building: string;
  roomNumber: string;
  cabinet: string;
  shelf: string;
  hazardLevel: "low" | "medium" | "high" | "extreme";
}

/** An emergency action step for a specific chemical. */
export interface EmergencyAction {
  id: string;
  chemicalId: string;
  actionType: "first-aid" | "firefighting" | "spill" | "ppe";
  title: string;
  description: string;
  priority: number;
}

/**
 * A complete chemical record with all SDS-relevant information.
 * This is the central entity stored in the local Dexie/IndexedDB database.
 */
export interface ChemicalRecord {
  id: string;
  casNumber: string;
  chemicalName: string;
  formula: string;
  tradeName?: string;
  manufacturer: string;
  supplier: string;

  signalWord: SignalWord;
  hazardClasses: HazardClass[];
  ghsPictograms: GhsPictogram[];

  storageLocation: string;
  department: Department;
  safetyInstructions: string;

  sdsDocumentId: string;
  lastUpdated: number;
  version: string;

  emergencyContact: string;
  personalProtectiveEquipment: string[];

  /** SDS Section 4 — First-aid measures. */
  firstAidMeasures: string;
  /** SDS Section 5 — Firefighting measures. */
  firefightingMeasures: string;
  /** SDS Section 6 — Accidental release (spill) measures. */
  accidentalReleaseMeasures: string;

  /** All 16 SDS sections (optional — for full detail view). */
  sdsSections?: SdsSection[];

  /** Server-managed sync field — incremented on every backend update. */
  serverVersion?: number;
  /** Soft-delete timestamp (epoch-ms). Set by the server; null when active. */
  deletedAt?: number | null;
}

/** User preferences stored locally (no auth, single-device). */
export interface UserPreferences {
  id: string;
  theme: "light" | "dark" | "system";
  emergencyModeEnabled: boolean;
  favoriteChemicals: string[];
  lastSearch: string;
}

/** Statistics computed from the chemical catalog. */
export interface CatalogStats {
  totalChemicals: number;
  dangerCount: number;
  warningCount: number;
  /** Pictogram ID → count, sorted descending. */
  pictogramCounts: { pictogram: GhsPictogram; count: number }[];
  /** Department → count. */
  departmentCounts: { department: Department; count: number }[];
}

/** Search/filter parameters for the catalog query. */
export interface CatalogQuery {
  search: string;
  departments: Department[];
  signalWords: SignalWord[];
  hazardClasses: HazardClass[];
}

/** Application view state (single-route SPA). */
export type AppView = "catalog" | "detail" | "emergency";

// ---------------------------------------------------------------------------
// SDS Document (client-side mirror of server SDS metadata — no blob here)
// ---------------------------------------------------------------------------

/** SDS document metadata stored locally. The actual PDF blob is cached separately. */
export interface SdsDocumentRecord {
  id: string;
  chemicalId: string;
  originalFileName: string;
  fileSize: number;
  mimeType: string;
  contentHash: string;
  status: "placeholder" | "available";
  version: number;
  uploadedById: string | null;
  createdAt: number;
  updatedAt: number;
}

/** Cached SDS PDF blob in IndexedDB — stored separately from metadata. */
export interface SdsBlobCache {
  sdsId: string;
  blob: Blob;
  version: number;
  cachedAt: number;
}

// ---------------------------------------------------------------------------
// Sync metadata
// ---------------------------------------------------------------------------

/** Tracks the last successful sync with the backend. */
export interface SyncMeta {
  id: string; // always "default"
  lastSyncTimestamp: number; // server epoch-ms from the last successful sync
  lastSyncAt: number; // local epoch-ms when the last sync completed
}

// ----------------------------------------------------------------------------
// Constant lookup tables
// ----------------------------------------------------------------------------

export const GHS_PICTOGRAM_INFO: Record<GhsPictogram, GhsPictogramInfo> = {
  "exploding-bomb": {
    id: "exploding-bomb",
    label: "Explosive",
    description: "Explosive; may explode under certain conditions.",
  },
  flame: {
    id: "flame",
    label: "Flammable",
    description: "Flammable material — ignites easily.",
  },
  "flame-on-circle": {
    id: "flame-on-circle",
    label: "Oxidizing",
    description: "May intensify fire; oxidizer.",
  },
  gas: {
    id: "gas",
    label: "Compressed Gas",
    description: "Contains gas under pressure.",
  },
  corrosion: {
    id: "corrosion",
    label: "Corrosive",
    description: "Corrosive to skin, eyes, and metals.",
  },
  "skull-and-crossbones": {
    id: "skull-and-crossbones",
    label: "Acute Toxicity",
    description: "Toxic — may be fatal if swallowed, inhaled, or absorbed.",
  },
  "exclamation-mark": {
    id: "exclamation-mark",
    label: "Irritant / Harmful",
    description: "May cause irritation or mild harmful effects.",
  },
  "health-hazard": {
    id: "health-hazard",
    label: "Health Hazard",
    description: "May cause serious long-term health effects.",
  },
  environment: {
    id: "environment",
    label: "Environmental Hazard",
    description: "Toxic to aquatic life and ecosystems.",
  },
};

export const HAZARD_CLASS_LABELS: Record<HazardClass, string> = {
  explosive: "Explosive",
  flammable: "Flammable",
  oxidizing: "Oxidizing",
  "compressed-gas": "Compressed Gas",
  corrosive: "Corrosive",
  toxic: "Acute Toxicity",
  harmful: "Harmful",
  irritant: "Irritant",
  sensitizer: "Sensitizer",
  carcinogen: "Carcinogen",
  "reproductive-toxicant": "Reproductive Toxicant",
  "specific-target-organ-toxicity": "Specific Target Organ Toxicity",
  "environmentally-hazardous": "Environmentally Hazardous",
};

export const DEPARTMENTS: Department[] = [
  "Chemical Analysis",
  "Corrosion Testing",
  "Metallography",
  "Physical Metallurgy",
];

export const SIGNAL_WORDS: SignalWord[] = ["danger", "warning"];

/** All 9 GHS pictogram IDs in display order. */
export const ALL_GHS_PICTOGRAMS: GhsPictogram[] = [
  "exploding-bomb",
  "flame",
  "flame-on-circle",
  "gas",
  "corrosion",
  "skull-and-crossbones",
  "exclamation-mark",
  "health-hazard",
  "environment",
];

/** All hazard class IDs. */
export const ALL_HAZARD_CLASSES: HazardClass[] = [
  "explosive",
  "flammable",
  "oxidizing",
  "compressed-gas",
  "corrosive",
  "toxic",
  "harmful",
  "irritant",
  "sensitizer",
  "carcinogen",
  "reproductive-toxicant",
  "specific-target-organ-toxicity",
  "environmentally-hazardous",
];
