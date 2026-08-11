// ============================================================================
// Validation — Zod schemas for all API inputs.
// Every user-controlled input is validated server-side before use.
// ============================================================================

import { z } from "zod";

const VALID_SIGNAL_WORDS = ["danger", "warning"] as const;
const VALID_DEPARTMENTS = [
  "Chemical Analysis",
  "Corrosion Testing",
  "Metallography",
  "Physical Metallurgy",
] as const;
const VALID_PICTOGRAMS = [
  "exploding-bomb",
  "flame",
  "flame-on-circle",
  "gas",
  "corrosion",
  "skull-and-crossbones",
  "exclamation-mark",
  "health-hazard",
  "environment",
] as const;
const VALID_HAZARD_CLASSES = [
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
] as const;

const nonEmptyString = (field: string) =>
  z
    .string()
    .trim()
    .min(1, `${field} is required`)
    .max(2000, `${field} is too long`);

/** Schema for creating a new chemical. */
export const createChemicalSchema = z.object({
  id: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/, "ID must be lowercase alphanumeric with dashes"),
  casNumber: nonEmptyString("CAS number").max(50),
  chemicalName: nonEmptyString("Chemical name").max(200),
  formula: nonEmptyString("Formula").max(100),
  tradeName: z.string().trim().max(200).optional().or(z.literal("")),
  manufacturer: z.string().trim().max(200).default(""),
  supplier: z.string().trim().max(200).default(""),
  signalWord: z.enum(VALID_SIGNAL_WORDS),
  hazardClasses: z.array(z.enum(VALID_HAZARD_CLASSES)).default([]),
  ghsPictograms: z.array(z.enum(VALID_PICTOGRAMS)).default([]),
  storageLocation: z.string().trim().max(300).default(""),
  department: z.enum(VALID_DEPARTMENTS),
  safetyInstructions: z.string().trim().max(10000).default(""),
  version: z.string().trim().max(20).default("1.0"),
  emergencyContact: z.string().trim().max(500).default(""),
  personalProtectiveEquipment: z.array(z.string().trim().max(300)).default([]),
  firstAidMeasures: z.string().trim().max(20000).default(""),
  firefightingMeasures: z.string().trim().max(20000).default(""),
  accidentalReleaseMeasures: z.string().trim().max(20000).default(""),
});

/** Schema for updating an existing chemical (all fields optional). */
export const updateChemicalSchema = createChemicalSchema.partial();

/** Schema for the SDS upload metadata (the file itself is validated separately). */
export const sdsUploadSchema = z.object({
  chemicalId: z.string().trim().min(1).max(100),
});

/** Max SDS file size: 10 MB. */
export const MAX_SDS_FILE_SIZE = 10 * 1024 * 1024;

/** Allowed MIME types for SDS uploads. */
export const ALLOWED_SDS_MIME_TYPES = ["application/pdf"];

/** Allowed file extensions for SDS uploads. */
export const ALLOWED_SDS_EXTENSIONS = [".pdf"];
