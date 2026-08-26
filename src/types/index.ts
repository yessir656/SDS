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
  /** Regulatory classification tags (DENR-EMB, PDEA, PNP, ...). Optional. */
  regulatoryTags?: string[];

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
  /** Regulatory tag → count (only tags on ≥1 chemical), sorted descending. */
  regulatoryTagCounts: { tag: string; count: number }[];
  /** Number of chemicals carrying at least one regulatory tag. */
  regulatedCount: number;
}

/** Search/filter parameters for the catalog query. */
export interface CatalogQuery {
  search: string;
  departments: Department[];
  signalWords: SignalWord[];
  hazardClasses: HazardClass[];
  /** Regulatory classification tags (DENR-EMB, PDEA, ...) — any-of filter. */
  regulatoryTags: string[];
  /** When true, show only chemicals that carry ANY regulatory tag. */
  hasRegulatoryTag: boolean;
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

// ---------------------------------------------------------------------------
// PPE (Personal Protective Equipment)
// ---------------------------------------------------------------------------
// Stored in the DB as a JSON-encoded `string[]` (one short phrase per line,
// e.g. "Nitrile gloves (powder-free)"). At render time these are normalized
// into { code, label, note } objects so each item can show an inline icon + a
// small note badge. See src/lib/ppe.ts.

/** Canonical icon keys for PPE items. Picked deterministically from the label. */
export type PpeCode =
  | "gloves-powderfree"
  | "gloves"
  | "goggles"
  | "face-shield"
  | "mask"
  | "respirator"
  | "lab-coat"
  | "apron"
  | "boots"
  | "coverall"
  | "hearing"
  | "other";

/** A single PPE item as rendered in the UI. */
export interface PpeItem {
  code: PpeCode;
  label: string;
  /** Extra detail parsed from parentheses, e.g. "powder-free, size L". */
  note?: string;
}

// ---------------------------------------------------------------------------
// Regulatory classifications (from the Aug-12 stakeholder meeting)
// ---------------------------------------------------------------------------

/**
 * Regulatory classification tags that may be attached to a chemical.
 * Only chemicals subject to the relevant agency carry a given tag.
 * (Mirrors the controlled/regulated-chemicals list Gina will provide.)
 */
export const REGULATORY_CLASSIFICATIONS = [
  "DENR-EMB",
  "PNP",
  "PDEA",
  "FDA",
  "DOT",
  "DOH",
  "Other",
] as const;
export type RegulatoryClassification = (typeof REGULATORY_CLASSIFICATIONS)[number];

// ---------------------------------------------------------------------------
// Emergency contacts (Aug-12 meeting §4.1)
// ---------------------------------------------------------------------------

/** One entry in the MIRDC-wide emergency contacts list. */
export interface EmergencyContactEntry {
  /** e.g. "Pollution Control Officer", "Fire Brigade". */
  role: string;
  /** Person or unit to contact. */
  name: string;
  /**
   * Dialable phone for a `tel:` link. Omit until a public/internal number is
   * provided — entries without a number render as role+name only.
   */
  phone?: string;
}

/**
 * Designated MIRDC emergency contacts per the Aug-12 meeting (4.1).
 * Internal line numbers are not published in the meeting notes — add the
 * `phone` value here to enable tap-to-call on each.
 */
export const EMERGENCY_CONTACTS: EmergencyContactEntry[] = [
  { role: "Pollution Control Officer", name: "Ms. Gina Catalan" },
  { role: "Chemical Spillage Brigade", name: "Ms. Mary Joy Bautista" },
  { role: "Fire Brigade", name: "BFP Taguig City FTI", phone: "166" },
  { role: "First Aid Brigade", name: "Ms. Deborah Balota" },
  { role: "Safety Officer", name: "Engr. Nestor Colibao" },
];

/** Always-callable hotlines shown at the top of the Emergency Contacts block. */
export const EMERGENCY_HOTLINES: EmergencyContactEntry[] = [
  { role: "MIRDC facility", name: "MIRDC Main Building", phone: "+63 2 8837 0713" },
  { role: "Poison Control", name: "Philippine Poison Control", phone: "(02) 8521 3225" },
  { role: "Fire & Rescue", name: "BFP National Hotline", phone: "166" },
];
