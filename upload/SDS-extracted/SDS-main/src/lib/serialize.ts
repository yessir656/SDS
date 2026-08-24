// ============================================================================
// Serialization — converts Prisma models to the JSON shape the client expects.
// Kept consistent between the sync, chemicals, and admin endpoints.
// ============================================================================

import type { Chemical, SdsDocument } from "@prisma/client";

/** A chemical in the shape the client Dexie database stores. */
export interface ClientChemical {
  id: string;
  casNumber: string;
  chemicalName: string;
  formula: string;
  tradeName: string | null;
  manufacturer: string;
  supplier: string;
  signalWord: string;
  hazardClasses: string[];
  ghsPictograms: string[];
  storageLocation: string;
  department: string;
  safetyInstructions: string;
  version: string;
  emergencyContact: string;
  personalProtectiveEquipment: string[];
  regulatoryTags: string[];
  firstAidMeasures: string;
  firefightingMeasures: string;
  accidentalReleaseMeasures: string;
  sdsDocumentId: string;
  lastUpdated: number; // epoch ms — derived from updatedAt
  serverVersion: number; // sync key
  deletedAt: number | null;
}

/** An SDS document in the shape the client Dexie database stores (metadata only — no blob). */
export interface ClientSdsDocument {
  id: string;
  chemicalId: string;
  originalFileName: string;
  fileSize: number;
  mimeType: string;
  contentHash: string;
  status: string; // "placeholder" | "available"
  version: number;
  uploadedById: string | null;
  createdAt: number;
  updatedAt: number;
}

export function serializeChemical(c: Chemical): ClientChemical {
  return {
    id: c.id,
    casNumber: c.casNumber,
    chemicalName: c.chemicalName,
    formula: c.formula,
    tradeName: c.tradeName,
    manufacturer: c.manufacturer,
    supplier: c.supplier,
    signalWord: c.signalWord,
    hazardClasses: safeJsonArray(c.hazardClasses),
    ghsPictograms: safeJsonArray(c.ghsPictograms),
    storageLocation: c.storageLocation,
    department: c.department,
    safetyInstructions: c.safetyInstructions,
    version: c.version,
    emergencyContact: c.emergencyContact,
    personalProtectiveEquipment: safeJsonArray(c.personalProtectiveEquipment),
    regulatoryTags: safeJsonArray(c.regulatoryTags ?? "[]"),
    firstAidMeasures: c.firstAidMeasures,
    firefightingMeasures: c.firefightingMeasures,
    accidentalReleaseMeasures: c.accidentalReleaseMeasures,
    sdsDocumentId: c.id, // 1:1 — SDS id matches chemical id for client convenience
    lastUpdated: c.updatedAt.getTime(),
    serverVersion: c.serverVersion,
    deletedAt: c.deletedAt ? c.deletedAt.getTime() : null,
  };
}

export function serializeSds(s: SdsDocument): ClientSdsDocument {
  return {
    id: s.id,
    chemicalId: s.chemicalId,
    originalFileName: s.originalFileName,
    fileSize: s.fileSize,
    mimeType: s.mimeType,
    contentHash: s.contentHash,
    status: s.status,
    version: s.version,
    uploadedById: s.uploadedById,
    createdAt: s.createdAt.getTime(),
    updatedAt: s.updatedAt.getTime(),
  };
}

/** Safely parse a JSON-encoded array, returning [] on any error. */
function safeJsonArray(json: string): string[] {
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}
